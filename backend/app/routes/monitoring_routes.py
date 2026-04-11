from flask import Blueprint, jsonify, current_app
from app import db

monitoring_bp = Blueprint('monitoring', __name__)

@monitoring_bp.route('/ping', methods=['GET'])
def ping():
    """Zero-dependency health check for load testing raw Flask throughput."""
    return jsonify({"status": "ok", "service": "Disaster Relief API"}), 200

@monitoring_bp.route('/health', methods=['GET'])
def health_check():
    health_status = {
        "api": "healthy",
        "database": "unknown",
        "redis": "unknown"
    }
    
    # Check Database
    try:
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        health_status["database"] = "connected"
    except Exception as e:
        current_app.logger.error(f"Database health check failed: {e}")
        health_status["database"] = "disconnected"

    # Check Redis
    from app.utils.rate_limit import redis_client
    if redis_client:
        try:
            if redis_client.ping():
                health_status["redis"] = "connected"
            else:
                health_status["redis"] = "disconnected"
        except Exception as e:
            current_app.logger.error(f"Redis health check failed: {e}")
            health_status["redis"] = "disconnected"

    # overall status
    status_code = 200 if (health_status["database"] == "connected" and health_status["redis"] == "connected") else 503
    
    return jsonify(health_status), status_code
