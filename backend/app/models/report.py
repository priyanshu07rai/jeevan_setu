import uuid
from datetime import datetime
from app import db

class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(100), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_text = db.Column(db.String(255), nullable=True)
    source = db.Column(db.String(50), nullable=False) # sms, web, mobile, volunteer, api
    reported_at = db.Column(db.DateTime, nullable=False)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_duplicate = db.Column(db.Boolean, default=False)
    is_verified = db.Column(db.Boolean, default=False)
    priority_score = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(50), default='pending') # pending, processing, processed, failed
    processing_stage = db.Column(db.String(50), default='pending') # pending, queued, processing, location_extracted, validated, completed, failed
    disaster_type = db.Column(db.String(50), nullable=True) # Flood, Fire, etc.
    people_count = db.Column(db.Integer, default=0)
    data_confidence_score = db.Column(db.Float, nullable=True) # 0.0 - 1.0
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attachments = db.relationship('Attachment', backref='report', lazy=True, cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super(Report, self).__init__(**kwargs)
        if not self.report_id:
            self.report_id = f"REP_{uuid.uuid4().hex[:8].upper()}"

    def to_dict(self):
        return {
            "id": self.id,
            "report_id": self.report_id,
            "name": self.name,
            "phone": self.phone,
            "message": self.message,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "location_text": self.location_text,
            "source": self.source,
            "reported_at": self.reported_at.isoformat() if self.reported_at else None,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "is_duplicate": self.is_duplicate,
            "is_verified": self.is_verified,
            "priority_score": self.priority_score,
            "status": self.status,
            "processing_stage": self.processing_stage,
            "disaster_type": self.disaster_type,
            "people_count": self.people_count,
            "data_confidence_score": self.data_confidence_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "attachments": [a.to_dict() for a in self.attachments]
        }


class Attachment(db.Model):
    __tablename__ = 'attachments'

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('reports.id'), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False) # image, video, audio

    def to_dict(self):
        return {
            "id": self.id,
            "file_url": self.file_url,
            "file_type": self.file_type
        }
