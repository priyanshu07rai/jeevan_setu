from datetime import datetime
from app import db

class SystemEvent(db.Model):
    __tablename__ = 'system_events'

    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(100), nullable=False, index=True)
    event_message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    report_id = db.Column(db.String(50), nullable=True, index=True) # Optional link to a specific report
    source_ip = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "event_message": self.event_message,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "report_id": self.report_id,
            "source_ip": self.source_ip
        }
