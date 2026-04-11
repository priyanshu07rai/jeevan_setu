import os
import sys
import time
from dotenv import load_dotenv
load_dotenv()
from app import create_app, socketio
from db import get_db_connection, release_db_connection, execute, insert_and_get_id

app = create_app(os.getenv('FLASK_ENV') or 'dev')

active_locations = {}
active_sids = {}

@socketio.on('locationUpdate')
def handle_location(data):
    vol_id = data.get('id') or data.get('volunteerId')
    if not vol_id: return
    
    from flask import request
    active_sids[request.sid] = vol_id
    
    active_locations[vol_id] = {
        'lat': data.get('lat'),
        'lng': data.get('lng'),
        'timestamp': time.time()
    }
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "UPDATE volunteers SET lat = ?, lon = ?, last_updated = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?", (data.get('lat'), data.get('lng'), vol_id))
        conn.commit()
        release_db_connection(conn)
        
        # Notify admins and volunteers
        socketio.emit('rosterUpdate', namespace='/admin')
        socketio.emit('locationBroadcast', {
            'volunteerId': vol_id,
            'lat': data.get('lat'),
            'lng': data.get('lng'),
            'timestamp': active_locations[vol_id]['timestamp']
        })
    except Exception as e:
        print("Location sync err:", e)

@socketio.on('heartbeat')
def handle_heartbeat(data):
    vol_id = data.get('id') or data.get('volunteerId')
    if not vol_id: return
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "UPDATE volunteers SET last_updated = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?", (vol_id,))
        conn.commit()
        release_db_connection(conn)
        socketio.emit('rosterUpdate', namespace='/admin')
    except Exception:
        pass

@socketio.on('disconnect')
def handle_disconnect():
    from flask import request
    vol_id = active_sids.pop(request.sid, None)
    if vol_id:
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            execute(cur, "UPDATE volunteers SET is_online = 0 WHERE id = ?", (vol_id,))
            conn.commit()
            release_db_connection(conn)
            socketio.emit('rosterUpdate', namespace='/admin')
        except Exception as e:
            print("Disconnect err:", e)

from flask_socketio import join_room, leave_room

@socketio.on('register_volunteer')
def handle_register_volunteer(data):
    vol_id = data.get('volunteerId')
    if vol_id:
        join_room(str(vol_id))
        print(f"Volunteer {vol_id} joined dedicated Socket room.")

@socketio.on('join')
def handle_join(data):
    vol_id = data.get('user_id')
    if vol_id:
        join_room(f"user_{vol_id}")
        print(f"Volunteer {vol_id} joined room user_{vol_id}")


# ─── CITIZEN UNIFIED IDENTITY ROOMS ──────────────────────────────────────────

@socketio.on('citizen_join')
def handle_citizen_join(data):
    """
    Called by desktop and mobile apps after successful citizen login.
    Both devices join the same room keyed by email, enabling cross-device sync.
    """
    from flask import request as freq
    email = (data.get('email') or '').strip().lower()
    if not email:
        return

    room = f"citizen:{email}"
    join_room(room)
    print(f"[CitizenSync] Device joined room {room} (sid={freq.sid})")

    # Fetch full citizen state and emit back to the joining device
    try:
        conn = get_db_connection()
        cur  = conn.cursor()
        execute(cur,
            "SELECT id, email, name, phone, otp_verified, emergency_mode, last_login, last_device FROM citizens WHERE email = ?",
            (email,)
        )
        from db import row_to_dict as rdict
        profile = rdict(cur.fetchone())
        cur.close()
        release_db_connection(conn)
        if profile:
            socketio.emit('citizen_sync', {
                'type': 'initial_state',
                'profile': profile,
            }, room=room)
    except Exception as e:
        print(f"[CitizenSync] Profile fetch error: {e}")


@socketio.on('citizen_update')
def handle_citizen_update(data):
    """
    Broadcast profile/emergency updates to all devices of the same citizen.
    Called by desktop or mobile when profile changes.
    """
    email = (data.get('email') or '').strip().lower()
    if not email:
        return
    room = f"citizen:{email}"
    socketio.emit('citizen_sync', {**data, 'type': data.get('type', 'profile_update')}, room=room)
    print(f"[CitizenSync] Update broadcast to room {room}: {data.get('type')}")


@socketio.on('citizen_emergency')
def handle_citizen_emergency(data):
    """
    Emergency mode activation — broadcast to all citizen devices immediately.
    data: { email, emergency_mode: true/false, lat?, lng?, sos_id? }
    """
    email = (data.get('email') or '').strip().lower()
    if not email:
        return

    # Persist emergency_mode in DB
    try:
        conn = get_db_connection()
        cur  = conn.cursor()
        execute(cur,
            "UPDATE citizens SET emergency_mode = ? WHERE email = ?",
            (bool(data.get('emergency_mode', True)), email)
        )
        conn.commit()
        cur.close()
        release_db_connection(conn)
    except Exception as e:
        print(f"[CitizenSync] Emergency update DB error: {e}")

    # Broadcast to all devices of this citizen
    socketio.emit('citizen_sync', {
        'type': 'emergency_update',
        **data
    }, room=f"citizen:{email}")
    print(f"[CitizenSync] Emergency mode broadcast to citizen:{email}")


@socketio.on('citizen_sos')
def handle_citizen_sos(data):
    """
    When citizen submits SOS — broadcast to all their devices + notify admin.
    data: { email, sos_id, lat, lng, disaster_type, description }
    """
    email = (data.get('email') or '').strip().lower()
    if not email:
        return
    # Sync to all citizen devices
    socketio.emit('citizen_sync', {
        'type': 'sos_submitted',
        **data
    }, room=f"citizen:{email}")
    # Also notify admin command center
    socketio.emit('new_sos_event', data, namespace='/admin')
    print(f"[CitizenSync] SOS event broadcast for citizen:{email}")

@socketio.on('sendEmergency')
def handle_send_emergency(data):
    target_ids = data.get('targetIds', [])
    if not target_ids: return
    for vid in target_ids:
        socketio.emit('emergencyRequest', data, room=str(vid))

def assign_task_to_volunteer(volunteer_id, data):
    conn = get_db_connection()
    cur = conn.cursor()
    
    mission_data = data.get("missionData", {})
    incident_type = mission_data.get("incidentType", "Emergency Dispatch")
    message = mission_data.get("message", "Action Required")
    location = mission_data.get("location", "Unknown Area")
    
    desc = f"{incident_type} Incident Alert. Location: {location}. Mission order: {message}"
    
    mission_id = insert_and_get_id(cur, "INSERT INTO disaster_events (disaster_type, description, status, assigned_volunteer_id, severity) VALUES (?, ?, 'DISPATCHED', ?, 10)", (incident_type, desc, volunteer_id))
    
    # Handle specific volunteer_messages table if needed
    try:
        execute(cur, "INSERT INTO volunteer_messages (volunteer_id, mission_id, sender, message) VALUES (?, ?, 'admin', ?)", (volunteer_id, 0, 'admin', message))
    except: pass

    execute(cur, "UPDATE volunteers SET status = 'ON_MISSION' WHERE id = ?", (volunteer_id,))
    
    conn.commit()
    release_db_connection(conn)
    
    try:
        from services.inventory_service import InventoryService
        InventoryService.process_dispatch()
        from services.activity_service import ActivityService
        ActivityService.log_event('DISPATCH', f"Tactical request assigned to V-{volunteer_id}. {incident_type} forces dispatched.")
    except Exception: pass
    return True

@socketio.on('emergencyRespond')
def handle_emergency_respond(data):
    v_id = data.get('volunteerId')
    status = data.get('status')
    if status == 'ACCEPTED':
        try:
            assign_task_to_volunteer(v_id, data)
            socketio.emit('updateAdmin', {'volunteerId': v_id, 'status': 'ON_MISSION'}, namespace='/admin')
        except Exception as e:
            print("Dispatch Error:", e)
    else:
        socketio.emit('updateAdmin', {'volunteerId': v_id, 'status': 'AVAILABLE'}, namespace='/admin')

import socket
import subprocess
import signal
import logging

def is_port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # Use a short timeout for quick checks
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) != 0

def kill_port_owner(port):
    """
    Windows-specific: Find and terminate any process using exactly the target port.
    """
    if os.name != 'nt': return
    try:
        # 1. Find PID using the port
        cmd = f"netstat -ano | findstr : {port}"
        output = subprocess.check_output(cmd, shell=True).decode()
        pids = set()
        for line in output.strip().split('\n'):
            if f':{port}' in line:
                pid = line.strip().split()[-1]
                pids.add(pid)
        
        # 2. Kill them all
        for pid in pids:
            if int(pid) == os.getpid(): continue
            print(f" * Freeing port {port} (Terminating PID {pid})...")
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def get_safe_port(start_port, max_tries=5):
    """
    Attemps to free the port first, then falls back to incrementing.
    """
    port = start_port
    for _ in range(max_tries):
        if is_port_free(port):
            return port
        kill_port_owner(port)
        # Check again after a small delay
        time.sleep(0.5)
        if is_port_free(port):
            return port
        # Fallback to next port
        print(f" * Port {port} remains busy, trying fallback...")
        port += 1
    return port

def graceful_shutdown(signum, frame):
    print("\n * Releasing socket handles and shutting down...")
    # Signal handlers don't need to do much for development mode, 
    # but we exit cleanly to ensure the OS recovers the port.
    sys.exit(0)

if __name__ == '__main__':
    # Singleton Guard: Check for lock file
    LOCK_FILE = os.path.join(os.path.dirname(__file__), ".server.lock")
    if os.path.exists(LOCK_FILE):
        # Check if the process is actually still alive (basic check)
        try:
            with open(LOCK_FILE, 'r') as f:
                old_pid = int(f.read().strip())
            # On windows, tasklist can check if PID exists
            if os.name == 'nt':
                check = subprocess.run(f"tasklist /FI \"PID eq {old_pid}\"", capture_output=True, shell=True).stdout.decode()
                if str(old_pid) in check:
                    print(f" ! CRITICAL: Port conflict/Duplicate detected (PID {old_pid}). Close existing terminal first.")
                    sys.exit(1)
        except: pass
    
    # Write new lock
    with open(LOCK_FILE, 'w') as f:
        f.write(str(os.getpid()))

    # Register Shutdown Handlers
    signal.signal(signal.SIGINT, graceful_shutdown)
    signal.signal(signal.SIGTERM, graceful_shutdown)
    
    # Find available port
    base_port = int(os.getenv('PORT', 5001))
    port = get_safe_port(base_port)
    
    from sockets.admin_socket import register_admin_sockets
    register_admin_sockets(socketio, app)
    from sockets.inventory_socket import register_inventory_sockets
    register_inventory_sockets(socketio)
    
    print(f" * Disaster Platform Gateway starting on http://0.0.0.0:{port} (Eventlet/Gunicorn Ready)")
    
    try:
        socketio.run(app, host='0.0.0.0', port=port, use_reloader=False, log_output=True)
    finally:
        # Cleanup lock on exit
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
