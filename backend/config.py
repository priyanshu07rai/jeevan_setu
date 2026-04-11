import os
from dotenv import load_dotenv

load_dotenv()

# Resolve base directory (the backend/ folder)
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'hard-to-guess-string'
    # Use SQLite by default for local dev (no PostgreSQL required)
    _db_url = os.environ.get('DATABASE_URL') or ''
    if _db_url.startswith('postgresql://') or _db_url.startswith('postgres://'):
        SQLALCHEMY_DATABASE_URI = _db_url
    else:
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(_BASE_DIR, 'disaster_local.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or 'redis://localhost:6379/1'
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or 'redis://localhost:6379/2'
    
    # Kafka Integration
    USE_KAFKA = os.environ.get('USE_KAFKA', 'false').lower() in ('true', '1')
    KAFKA_BROKER_URL = os.environ.get('KAFKA_BROKER_URL', 'kafka:9092')
    
    # Intelligence Region Settings (Target Gorakhpur area by default)
    REGION_NAME = os.environ.get('REGION_NAME', 'Gorakhpur')
    # BBOX format: [min_lon, min_lat, max_lon, max_lat] -> Standard for GeoJSON and Shapely
    REGION_BBOX = [float(x) for x in os.environ.get('REGION_BBOX', '83.1,26.6,83.6,27.0').split(',')]

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config_by_name = dict(
    dev=DevelopmentConfig,
    development=DevelopmentConfig,
    prod=ProductionConfig,
    production=ProductionConfig
)
