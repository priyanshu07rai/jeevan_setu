import requests
import json

base_url = "http://localhost:5001/api/v2"

def test_vol_detail(vid):
    r = requests.get(f"{base_url}/volunteers/{vid}")
    if r.ok:
        print(f"Volunteer {vid} detail:")
        print(json.dumps(r.json(), indent=2))
    else:
        print(f"Failed to get volunteer {vid}: {r.status_code} {r.text}")

test_vol_detail(5)
