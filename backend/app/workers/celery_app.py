import os
from celery import Celery
from kombu import Exchange, Queue

def make_celery(app_name=__name__):
    from config import config_by_name
    import redis as redis_lib
    
    env = os.environ.get('FLASK_ENV', 'dev')
    app_config = config_by_name[env]

    # Detect if Redis is actually available to avoid event loop blocking
    redis_url = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/1')
    redis_available = False
    try:
        r = redis_lib.from_url(redis_url, socket_connect_timeout=1)
        r.ping()
        redis_available = True
    except Exception:
        pass

    if redis_available:
        broker_url = redis_url
        result_backend = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/2')
    else:
        # Fallback for local development without Docker
        broker_url = 'memory://'
        result_backend = None
        print("!!! WARNING: Redis unavailable. Celery using 'memory://' broker. Tasks will not persist.")

    celery_app = Celery(
        app_name,
        broker=broker_url,
        backend=result_backend,
        include=['app.workers.tasks', 'app.workers.social_media_listener']
    )

    celery_app.conf.update(
        result_expires=3600,
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
        broker_connection_retry_on_startup=False, # Prevent blocking startup
        task_reject_on_worker_lost=True,
        task_acks_late=True,
    )
    
    return celery_app

celery = make_celery()

# Schedule periodic tasks
celery.conf.beat_schedule = {
    'aggregate-weather-alerts-every-10-minutes': {
        'task': 'app.workers.tasks.aggregate_weather_alerts',
        'schedule': 600.0, # 10 minutes
    },
}
