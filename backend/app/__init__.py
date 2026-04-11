from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
from config import config_by_name

db = SQLAlchemy()
migrate = Migrate()
socketio = SocketIO(cors_allowed_origins="*", message_queue=None, async_mode=None)

def create_app(config_name='dev'):
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    from db import ensure_tables
    with app.app_context():
        ensure_tables()

    db.init_app(app)
    migrate.init_app(app, db)
    
    # Enable CORS for the API routes
    from flask_cors import CORS
    CORS(app)
    
    # Use Redis message queue for SocketIO only when Redis is available
    # Falls back to in-process (no cross-worker broadcasts) for local dev without Docker
    redis_url = app.config.get('REDIS_URL', None)
    try:
        if redis_url:
            import redis as redis_lib
            r = redis_lib.from_url(redis_url, socket_connect_timeout=1)
            r.ping()
            socketio.init_app(app, message_queue=redis_url)
            app.logger.info(f"SocketIO connected to Redis: {redis_url}")
        else:
            raise ConnectionError("No REDIS_URL configured")
    except Exception:
        socketio.init_app(app, message_queue=None)
        app.logger.info("Local Mode: Starting without Redis (Rate limiting disabled).")

    # Register app utilities
    from app.utils.logger import setup_logger
    from app.utils.rate_limit import init_redis
    from app.utils.errors import register_error_handlers
    from app.middlewares import init_middlewares
    from prometheus_flask_exporter import PrometheusMetrics
    
    setup_logger(app, "api_gateway")
    init_redis(app)
    register_error_handlers(app)
    init_middlewares(app)
    
    # Initialize Prometheus Metrics setup globally
    # Guard against double-registration (e.g., when tasks.py also calls create_app)
    try:
        metrics = PrometheusMetrics(app)
        metrics.info('app_info', 'Disaster Relief API Gateway', version='2.0.0')
    except ValueError:
        pass  # Already registered — harmless in local/worker dual-init scenarios

    # Register blueprints
    from api.disasters import bp as disasters_bp
    from app.routes.report_routes import report_bp, mesh_bp
    from app.routes.monitoring_routes import monitoring_bp
    from api.payment import payment_bp
    from api.admin_control_routes import bp as control_room_bp
    
    app.register_blueprint(disasters_bp, url_prefix='/api/v2')
    app.register_blueprint(report_bp, url_prefix='/api/v2')
    app.register_blueprint(mesh_bp, url_prefix='/mesh')
    app.register_blueprint(monitoring_bp, url_prefix='/')
    app.register_blueprint(payment_bp, url_prefix='/api/payment')
    app.register_blueprint(control_room_bp, url_prefix='/api/v2')
    
    from api.admin_inventory_routes import bp as admin_inventory_bp
    app.register_blueprint(admin_inventory_bp, url_prefix='/api/v2')

    from api.admin_inventory_sync_routes import bp as admin_inventory_sync_bp
    app.register_blueprint(admin_inventory_sync_bp, url_prefix='/api/v2')

    from api.citizen_auth_routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/v2')

    # Also register legacy auth routes (admin)
    from api.auth_routes import bp as legacy_auth_bp
    app.register_blueprint(legacy_auth_bp, url_prefix='/api/v2')

    return app
