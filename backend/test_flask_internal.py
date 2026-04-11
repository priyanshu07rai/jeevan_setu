import json
from app import create_app

app = create_app('dev')
app.testing = True
client = app.test_client()

print("Testing /api/v2/activity")
try:
    response = client.get('/api/v2/activity')
    print("Status:", response.status_code)
    print("Data:", response.get_data(as_text=True))
except Exception as e:
    import traceback
    traceback.print_exc()

print("\nTesting /api/v2/volunteers")
try:
    response = client.get('/api/v2/volunteers')
    print("Status:", response.status_code)
    print("Data:", response.get_data(as_text=True))
except Exception as e:
    import traceback
    traceback.print_exc()
