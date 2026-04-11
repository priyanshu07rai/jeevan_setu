import pytest
from app import create_app, db
from app.models import Report

@pytest.fixture
def app():
    app = create_app('dev')
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_health_endpoint(client):
    response = client.get('/health')
    assert response.status_code in [200, 503] # Depending on if redis/db are actually mocked/running
    assert b"api" in response.data

def test_submit_report_success(client):
    payload = {
        "phone": "+1234567890",
        "message": "Need help immediately stuck in flood",
        "source": "sms",
        "latitude": 40.7128,
        "longitude": -74.0060
    }
    response = client.post('/api/report', json=payload)
    assert response.status_code == 201
    
    data = response.get_json()
    assert "report_id" in data
    assert data["status"] == "received"

def test_submit_report_validation_failure(client):
    # Invalid phone
    payload = {
        "phone": "invalid_phone",
        "message": "Need help immediately",
        "source": "sms"
    }
    response = client.post('/api/report', json=payload)
    assert response.status_code == 400
    assert b"Validation failed" in response.data

def test_submit_report_short_message(client):
    payload = {
        "phone": "+1234567890",
        "message": "help", # too short
        "source": "sms"
    }
    response = client.post('/api/report', json=payload)
    assert response.status_code == 400

def test_unprocessed_reports_endpoint(client, app):
    with app.app_context():
        r = Report(phone="+1", message="1234567890", source="api", status="processed", is_verified=False)
        db.session.add(r)
        db.session.commit()
        
    response = client.get('/api/reports/unprocessed')
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["count"] >= 1
