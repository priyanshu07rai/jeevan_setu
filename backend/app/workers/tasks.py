import os
from app.workers.celery_app import celery
import structlog
from flask_socketio import SocketIO
from datetime import datetime
import traceback
import hashlib

logger = structlog.get_logger(__name__)

# -----------------------------------------------------------------------
# Lazy Flask app + SocketIO emitter
# Initialised once on first task, NOT at import time to avoid circular imports
# -----------------------------------------------------------------------
_flask_app = None
_ext_socketio = None

def _get_flask_app():
    global _flask_app
    if _flask_app is None:
        from app import create_app
        from app.utils.logger import setup_logger
        _flask_app = create_app(os.environ.get('FLASK_ENV', 'dev'))
        setup_logger(_flask_app, "celery_worker")
    return _flask_app

def _get_socketio():
    global _ext_socketio
    if _ext_socketio is None:
        app = _get_flask_app()
        redis_url = app.config.get('REDIS_URL')
        _ext_socketio = SocketIO(message_queue=redis_url if redis_url else None)
    return _ext_socketio


    return max(0.0, min(1.0, score))

def calculate_priority_score(report):
    """
    Calculates the urgency/priority of a report (0.0 to 10.0)
    Rules:
    - Flood/Fire + Multiple People = High Urgency
    - Keywords like 'trapped', 'emergency', 'help' increase priority
    """
    score = 3.0 # Base priority
    
    # Disaster Type Weights
    weights = {'Flood': 3.0, 'Fire': 3.5, 'Earthquake': 4.0, 'Conflict': 3.0, 'Medical': 2.5}
    score += weights.get(report.disaster_type, 1.0)
    
    # People Impact (High impact = High priority)
    if report.people_count > 0:
        score += min(report.people_count * 0.5, 4.0)
        
    # Keyword analysis
    msg = report.message.lower()
    if any(k in msg for k in ['urgent', 'dying', 'trapped', 'critical', 'breath']):
        score += 2.0
    elif 'help' in msg:
        score += 1.0
        
    return max(0.0, min(10.0, score))


@celery.task(bind=True, max_retries=3, acks_late=True)
def process_report_task(self, report_id, request_id='unknown'):
    # Deferred imports to avoid circular dependency at module level
    from app import db
    from app.models import Report, SystemEvent, FailedTask
    from app.services.location_service import process_text_for_location
    from app.utils.rate_limit import check_duplicate_report
    # Optional geo/AI imports — gracefully skip if unavailable (no PostGIS/shapely)
    try:
        from geoalchemy2.shape import from_shape
        from shapely.geometry import Point
        _geo_available = True
    except ImportError:
        _geo_available = False
    try:
        from app.models.intelligence import RiskPrediction
        from app.services.feature_builder import FeatureBuilder
        from disaster_intelligence.models.distress_predictor import DistressPredictor
        _ai_available = True
    except ImportError:
        _ai_available = False

    flask_app = _get_flask_app()
    ext_socketio = _get_socketio()

    structlog.contextvars.bind_contextvars(report_id=report_id, request_id=request_id, task_id=self.request.id)
    
    with flask_app.app_context():
        try:
            report = Report.query.filter_by(report_id=report_id).first()
            if not report:
                logger.error("report_not_found_in_db")
                return False

            logger.info("processing_began")

            report.status = 'processing'
            report.processing_stage = 'processing'
            db.session.commit()

            # Deduplication
            time_str = report.reported_at.isoformat() if report.reported_at else report.received_at.isoformat()
            report_hash = hashlib.sha256(f"{report.message}|{report.phone}|{time_str}".encode()).hexdigest()
            if check_duplicate_report(report_hash):
                report.is_duplicate = True
                logger.warning("duplicate_detected")

            # Location Extraction
            if report.latitude is None or report.longitude is None:
                lat, lon, extracted_text = process_text_for_location(report.message)
                if lat and lon:
                    report.latitude = lat
                    report.longitude = lon
                    report.location_text = extracted_text
                    report.processing_stage = 'location_extracted'
                    logger.info("location_extracted_successfully", text=extracted_text)

            # Scoring
            report.data_confidence_score = calculate_confidence_score(report)
            report.priority_score = calculate_priority_score(report)
            report.processing_stage = 'validated'
            report.status = 'processed'
            report.processing_stage = 'completed'

            event = SystemEvent(
                event_type='report_processed',
                event_message=f'Report {report_id} processed successfully',
                report_id=report_id
            )
            db.session.add(event)
            db.session.commit()

            # Emit real-time WebSocket events
            if ext_socketio:
                ext_socketio.emit('new_disaster_event', {
                    "type": "Disaster Report",
                    "lat": report.latitude,
                    "lon": report.longitude,
                    "description": report.message,
                    "priority": report.priority_score,
                    "disaster_type": report.disaster_type
                })
                ext_socketio.emit('new_report', report.to_dict())

            # AI Prediction (only when geo + AI deps are available)
            if report.latitude and report.longitude and _ai_available:
                try:
                    logger.info("ai_distress_prediction_running", lat=report.latitude, lon=report.longitude)
                    features = FeatureBuilder.build_features(report.latitude, report.longitude, 24)
                    vector = FeatureBuilder.vectorize(features)
                    risk_score = DistressPredictor().predict(vector)

                    risk_entry = RiskPrediction(
                        lat=report.latitude,
                        lon=report.longitude,
                        risk_score=risk_score,
                        disaster_type="flood",
                        features_used=str(features)
                    )
                    db.session.add(risk_entry)
                    db.session.commit()

                    if risk_score > 0.75 and ext_socketio:
                        logger.warning("HIGH_RISK_AI_PREDICTION", score=risk_score)
                        ext_socketio.emit('new_risk_prediction', {
                            "lat": report.latitude,
                            "lon": report.longitude,
                            "risk": risk_score
                        })

                except Exception as ai_err:
                    logger.error("ai_inference_failed", error=str(ai_err))

            logger.info("processing_completed", final_score=report.data_confidence_score)
            return True

        except Exception as e:
            logger.error("processing_failed", error=str(e), exc_info=True)
            try:
                report = Report.query.filter_by(report_id=report_id).first()
                if report:
                    report.status = 'failed'
                    report.processing_stage = 'failed'
                    db.session.commit()
            except:
                pass

            try:
                raise self.retry(exc=e, countdown=10 ** self.request.retries)
            except self.MaxRetriesExceededError:
                handle_failed_task(self.request.id, report_id, str(e), self.request.retries)
                logger.critical("max_retries_exceeded_sent_to_dlq")
                raise


def handle_failed_task(task_id, report_id, error_message, retries):
    """Writes failed task to Dead Letter Queue DB Table"""
    from app import db
    from app.models import FailedTask
    flask_app = _get_flask_app()
    with flask_app.app_context():
        failed_entry = FailedTask(
            task_id=task_id,
            report_id=report_id,
            error_message=error_message,
            retry_count=retries
        )
        db.session.add(failed_entry)
        db.session.commit()
