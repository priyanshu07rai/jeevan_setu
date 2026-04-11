import requests
import json
import time
import random

# Stub representing a Hardware Gateway node (Raspberry Pi, Relief Vehicle Laptop, etc)
# that listens for local Mesh Network (Bluetooth/LoRa) broadcasts and bridges them
# to the remote API.

SERVER_URL = "http://localhost:5001/mesh/report"

def listen_mesh_network():
    """Stub simulating fetching data from a hypothetical local mesh radio interface."""
    time.sleep(random.uniform(2.0, 10.0)) # Simulate sporadic arrival of packets
    return {
        "mesh_id": f"MESH_{random.randint(10000, 99999)}",
        "origin_device": f"device_{random.randint(1, 99)}",
        "timestamp": "2026-03-11T19:02:22",
        "message": "5 people trapped near bridge",
        "gps": [26.76 + random.uniform(-0.02, 0.02), 83.37 + random.uniform(-0.02, 0.02)],
        "hop_count": random.randint(1, 4)
    }

MAX_RETRIES = 3
REQUEST_TIMEOUT = 15  # seconds — give a busy Flask server time to respond

def forward_message(data):
    """Forward mesh packet to API with retry logic."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(SERVER_URL, json=data, timeout=REQUEST_TIMEOUT)
            if response.status_code == 201:
                print(f"[SUCCESS] Forwarded Mesh ID {data['mesh_id']} | Status: {response.json().get('status')}")
                return  # Done
            else:
                print(f"[ERROR] API Reject ({attempt}/{MAX_RETRIES}): {response.status_code} - {response.text[:100]}")
        except requests.exceptions.Timeout:
            print(f"[TIMEOUT] Gateway busy, retry {attempt}/{MAX_RETRIES}...")
            time.sleep(2 ** attempt)  # Exponential backoff: 2s, 4s, 8s
        except requests.exceptions.ConnectionError as e:
            print(f"[OFFLINE] Cannot reach internet gateway. (Message cached locally) — {e}")
            return  # No point retrying a refused connection
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Unexpected error ({attempt}/{MAX_RETRIES}): {e}")
            time.sleep(1)

    print(f"[GIVE-UP] Packet {data['mesh_id']} could not be delivered after {MAX_RETRIES} retries.")


if __name__ == "__main__":
    print("starting_mesh_radio_gateway_listener...")
    try:
        while True:
            # 1. Listen for local Bluetooth/WiFi-Direct/LoRa broadcast
            msg = listen_mesh_network()
            print(f"[RECEIVED] Local packet from {msg['origin_device']} (hops: {msg['hop_count']})")
            
            # 2. Push to internet
            forward_message(msg)
    except KeyboardInterrupt:
        print("shutting_down_mesh_gateway")
