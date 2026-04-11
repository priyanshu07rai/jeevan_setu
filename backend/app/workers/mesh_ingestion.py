from app.workers.celery_app import celery
from app import create_app, db
from app.models import Report, SystemEvent
from app.utils.rate_limit import check_duplicate_report
from datetime import datetime
import structlog
import uuid
import hashlib

flask_app = create_app('dev')
logger = structlog.get_logger(__name__)

@celery.task(bind=True, max_retries=3)
def process_mesh_report_task(self, data, ip_address, request_id='unknown'):
    # Bind context
    mesh_id = data.get('mesh_id', 'unknown')
    structlog.contextvars.bind_contextvars(request_id=request_id, task_id=self.request.id, mesh_id=mesh_id)
    
    with flask_app.app_context():
        try:
            logger.info("processing_mesh_report", origin=data.get('origin_device'))
            
            # Mesh Deduplication Check
            # Hash(mesh_id + timestamp) -> Redis TTL 20 mins
            timestamp_str = data.get('timestamp', '')
            hash_input = f"{mesh_id}|{timestamp_str}"
            mesh_hash = hashlib.sha256(hash_input.encode()).hexdigest()
            
            if check_duplicate_report(mesh_hash, ttl_seconds=1200): # 20 mins
                logger.warning("duplicate_mesh_report_dropped")
                return False
                
            # Convert to standard report format
            lat, lon = None, None
            if 'gps' in data and isinstance(data['gps'], list) and len(data['gps']) == 2:
                lat, lon = float(data['gps'][0]), float(data['gps'][1])
                
            report_id = f"REP_{uuid.uuid4().hex[:8].upper()}"
            
            new_report = Report(
                report_id=report_id,
                name=f"Device_{data.get('origin_device', 'Unknown')}",
                phone="mesh_network",
                message=data.get('message', ''),
                latitude=lat,
                longitude=lon,
                source="mesh",
                reported_at=datetime.fromisoformat(data['timestamp']) if 'timestamp' in data else datetime.utcnow(),
                processing_stage="queued"
            )
            
            db.session.add(new_report)
            
            # Additional Context Event
            event = SystemEvent(
                event_type='mesh_report_ingested',
                event_message=f"Received via mesh gateway from {data.get('origin_device')} (hops: {data.get('hop_count')})",
                report_id=report_id,
                source_ip=ip_address
            )
            db.session.add(event)
            db.session.commit()
            
            logger.info("mesh_converted_to_standard", report_id=report_id)
            
            # Send to main processing pipeline (Stage 2+)
            from app.workers.tasks import process_report_task
            process_report_task.delay(report_id, request_id)
            
            return True

        except Exception as e:
            logger.error("mesh_ingestion_failed", error=str(e), exc_info=True)
            db.session.rollback()
            try:
                raise self.retry(exc=e, countdown=10)
            except self.MaxRetriesExceededError:
                from app.workers.tasks import handle_failed_task
                handle_failed_task(self.request.id, f"Mesh: {mesh_id}", str(e), self.request.retries)
                raise
