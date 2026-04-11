import os
from app.workers.celery_app import celery
from app import create_app, db
from app.models import Report, SystemEvent
from app.utils.logger import setup_logger
from datetime import datetime
import structlog
import uuid
import random

flask_app = create_app(os.environ.get('FLASK_ENV', 'dev'))
# Worker Logger 
setup_logger(flask_app, "celery_worker_social")
logger = structlog.get_logger(__name__)

KEYWORDS = ['flood', 'earthquake', 'trapped', 'help', 'collapsed']

def fetch_mock_reddit_data():
    """Stub simulating fetching disaster data from Reddit API"""
    if random.random() > 0.5:
        return [
            {"text": "People are trapped on roof near Aami river railway bridge due to flood", "author": "local_user123"}
        ]
    return []

def fetch_mock_twitter_data():
    """Stub simulating fetching disaster data from Twitter/X API"""
    if random.random() > 0.7:
        return [
            {"text": "Earthquake collapsed the old building on Main St, need help!", "author": "news_bot"}
        ]
    return []

@celery.task
def listen_social_media():
    """Periodic task fetching disaster signals from social media APIs"""
    structlog.contextvars.bind_contextvars(task="social_media_listener")
    
    with flask_app.app_context():
        logger.info("social_media_poll_started")
        
        # 1. Fetch data
        signals = []
        try:
            signals.extend(fetch_mock_reddit_data())
            signals.extend(fetch_mock_twitter_data())
        except Exception as e:
            logger.error("social_media_fetch_error", error=str(e))
            return False
            
        if not signals:
            logger.info("no_signals_found")
            return True
            
        # 2. Process and Store
        for signal in signals:
            if not any(kw in signal['text'].lower() for kw in KEYWORDS):
                continue
                
            report_id = f"SM_{uuid.uuid4().hex[:8].upper()}"
            
            new_report = Report(
                report_id=report_id,
                name=signal['author'],
                phone='social_media',
                message=signal['text'],
                source='social_media',
                reported_at=datetime.utcnow()
            )
            
            db.session.add(new_report)
            
            # Send to main processing pipeline
            from app.workers.tasks import process_report_task
            db.session.commit()
            
            process_report_task.delay(report_id, "social_media_ingest")
            logger.info("social_media_report_created", report_id=report_id)

        # Log event
        event = SystemEvent(
            event_type='social_media_ingestion',
            event_message=f'Ingested {len(signals)} reports from social media',
        )
        db.session.add(event)
        db.session.commit()
        
        return True

# Schedule it in celery
celery.conf.beat_schedule.update({
    'poll-social-media-every-5-mins': {
        'task': 'app.workers.social_media_listener.listen_social_media',
        'schedule': 300.0, # 5 minutes
    },
})
