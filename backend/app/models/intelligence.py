from app import db
from datetime import datetime
import json

class SatelliteImage(db.Model):
    __tablename__ = 'satellite_images'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    satellite_name = db.Column(db.String(50), nullable=False)  # e.g., 'Sentinel-1', 'Sentinel-2'
    timestamp = db.Column(db.DateTime, nullable=False)
    bbox_json = db.Column(db.Text, nullable=True)  # Store bbox as JSON text (SQLite compatible)
    file_path = db.Column(db.String(255), nullable=True)
    cloud_cover = db.Column(db.Float, nullable=True)
    metadata_json = db.Column(db.Text, nullable=True)  # Store as JSON text (SQLite compatible)
    processed_status = db.Column(db.String(50), default='pending')  # pending, detecting, completed, failed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'satellite_name': self.satellite_name,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'processed_status': self.processed_status
        }


class RiskPrediction(db.Model):
    __tablename__ = 'risk_predictions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    lat = db.Column(db.Float, nullable=False)   # Latitude (replaces PostGIS geometry)
    lon = db.Column(db.Float, nullable=False)   # Longitude
    risk_score = db.Column(db.Float, nullable=False)  # 0.0 to 1.0 AI probability
    disaster_type = db.Column(db.String(50), nullable=False)  # flood, wildfire, conflict
    features_used = db.Column(db.Text, nullable=True)  # Input factors as JSON text
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'lat': self.lat,
            'lon': self.lon,
            'risk_score': self.risk_score,
            'disaster_type': self.disaster_type,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None
        }
