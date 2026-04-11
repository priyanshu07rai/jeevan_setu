from datetime import datetime
from app import db

class FailedTask(db.Model):
    __tablename__ = 'failed_tasks'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(100), nullable=False, index=True)
    report_id = db.Column(db.String(50), db.ForeignKey('reports.report_id'), nullable=True, index=True)
    error_message = db.Column(db.Text, nullable=False)
    retry_count = db.Column(db.Integer, default=0)
    failed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "report_id": self.report_id,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "failed_at": self.failed_at.isoformat() if self.failed_at else None
        }
