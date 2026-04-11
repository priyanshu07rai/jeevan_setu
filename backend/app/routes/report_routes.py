from flask import Blueprint, request, jsonify, current_app, g
from app import db
from app.models import Report, Attachment, SystemEvent
from app.services.validation_service import validate_report_data
from app.utils.rate_limit import check_rate_limit
from datetime import datetime
from prometheus_client import Counter
import structlog

logger = structlog.get_logger(__name__)
report_bp = Blueprint('report', __name__)
mesh_bp = Blueprint('mesh', __name__)

def _make_counter(name, description):
    """Create a counter, ignoring duplicate-registration errors on reimport."""
    try:
        return Counter(name, description)
    except ValueError:
        from prometheus_client import REGISTRY
        return REGISTRY._names_to_collectors.get(name)

reports_received_counter = _make_counter('total_reports_received', 'Total number of received support reports')
duplicate_detected_counter = _make_counter('duplicate_reports_detected', 'Total number of duplicate reports blocked or flagged')
mesh_reports_received_counter = _make_counter('mesh_reports_received', 'Total number of received mesh reports')

@report_bp.route('/report', methods=['POST'])
@reports_received_counter.count_exceptions()
def submit_report():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "code": 400, "message": "Invalid JSON format"}), 400

    # Rate limiting
    phone = data.get('phone', 'unknown')
    ip_address = request.remote_addr
    identifier = phone if phone != 'unknown' else ip_address
    
    allowed, retry_after = check_rate_limit(identifier)
    if not allowed:
        current_app.logger.warning(f"Rate limit exceeded for {identifier}")
        return jsonify({"status": "error", "code": 429, "message": f"Rate limit exceeded. Try again in {retry_after}s"}), 429

    # Validation
    validated_data, errors = validate_report_data(data)
    if errors:
        return jsonify({"status": "error", "code": 400, "message": "Validation failed", "details": errors}), 400

    try:
        from app.workers.tasks import process_report_task
        # Create report record
        reported_at = validated_data.get('reported_at')
        if not reported_at and not validated_data.get('is_offline_submission'):
            reported_at = datetime.utcnow()
            
        new_report = Report(
            name=validated_data.get('name'),
            phone=validated_data.get('phone'),
            message=validated_data.get('description') or validated_data.get('message'),
            latitude=validated_data.get('lat') or validated_data.get('latitude'),
            longitude=validated_data.get('lon') or validated_data.get('longitude'),
            source=validated_data.get('source', 'web'),
            disaster_type=validated_data.get('disaster_type', 'Other'),
            people_count=validated_data.get('people_count', 0),
            reported_at=reported_at
        )

        # Log evidence if provided
        evidence = validated_data.get('evidence')
        if evidence:
            logger.info("report_evidence_received", evidence_preview=evidence[:100])

        db.session.add(new_report)
        db.session.flush() # Get ID without committing

        # Handle attachments
        attachments_data = validated_data.get('attachments', [])
        if attachments_data:
            for attach_data in attachments_data:
                attachment = Attachment(
                    report_id=new_report.id,
                    file_url=attach_data['file_url'],
                    file_type=attach_data['file_type']
                )
                db.session.add(attachment)

        # Log system event
        event = SystemEvent(
            event_type='new_report_received',
            event_message=f'Report received from {new_report.source}',
            report_id=new_report.report_id,
            source_ip=ip_address
        )
        db.session.add(event)
        
        db.session.commit()

        # Update Structlog context for the current request
        structlog.contextvars.bind_contextvars(report_id=new_report.report_id)

        # Send to Celery task: passing request ID for tracing!
        request_id = getattr(g, 'request_id', 'unknown')
        process_report_task.delay(new_report.report_id, request_id)

        logger.info("report_created_and_queued", report_id=new_report.report_id, source=new_report.source)
        
        return jsonify({
            "status": "received",
            "report_id": new_report.report_id
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error("failed_to_save_report", error=str(e), exc_info=True)
        return jsonify({"status": "error", "code": 500, "message": "Failed to save report"}), 500

@report_bp.route('/reports/unprocessed', methods=['GET'])
def get_unprocessed_reports():
    try:
        reports = Report.query.filter_by(status='processed', is_verified=False).order_by(Report.priority_score.desc().nullslast()).limit(100).all()
        logger.info("fetched_unprocessed_reports", count=len(reports))
        return jsonify({
            "status": "success",
            "count": len(reports),
            "data": [report.to_dict() for report in reports]
        }), 200
    except Exception as e:
        logger.error("error_fetching_unprocessed_reports", error=str(e))
        return jsonify({"status": "error", "code": 500, "message": "Database error"}), 500

@report_bp.route('/reports/update', methods=['POST'])
def update_report():
    data = request.get_json()
    if not data or 'report_id' not in data:
        return jsonify({"status": "error", "code": 400, "message": "Missing report_id"}), 400

    report_id = data['report_id']
    try:
        report = Report.query.filter_by(report_id=report_id).first()
        if not report:
            return jsonify({"status": "error", "code": 404, "message": "Report not found"}), 404

        if 'priority_score' in data:
            report.priority_score = data['priority_score']
        if 'is_verified' in data:
            report.is_verified = data['is_verified']
        if 'status' in data:
            report.status = data['status']

        event = SystemEvent(
            event_type='report_updated_by_ai',
            event_message=f'Report {report_id} updated via AI engine',
            report_id=report_id
        )
        db.session.add(event)
        db.session.commit()

        logger.info("report_updated_by_ai", report_id=report_id)

        return jsonify({
            "status": "success",
            "message": "Report updated",
            "report_id": report_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error("error_updating_report", report_id=report_id, error=str(e))
        return jsonify({"status": "error", "code": 500, "message": "Database error"}), 500

@mesh_bp.route('/report', methods=['POST'])
@mesh_reports_received_counter.count_exceptions()
def submit_mesh_report():
    data = request.get_json()
    if not data or 'mesh_id' not in data:
        return jsonify({"status": "error", "code": 400, "message": "Invalid Mesh JSON format or missing mesh_id"}), 400

    ip_address = request.remote_addr
    request_id = getattr(g, 'request_id', 'unknown')
    
    structlog.contextvars.bind_contextvars(mesh_id=data['mesh_id'])
    
    # Forward the raw payload to the dedicated Mesh extraction Celery task
    try:
        from app.workers.mesh_ingestion import process_mesh_report_task
        process_mesh_report_task.delay(data, ip_address, request_id)
        logger.info("mesh_report_queued", origin_device=data.get('origin_device'))
        
        return jsonify({
            "status": "received_by_gateway",
            "mesh_id": data['mesh_id']
        }), 201
    except Exception as e:
        logger.error("failed_to_queue_mesh_report", error=str(e), exc_info=True)
        return jsonify({"status": "error", "code": 500, "message": "Failed to handle mesh report"}), 500
