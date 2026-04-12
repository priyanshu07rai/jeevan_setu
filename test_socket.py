import socketio
import time

sio = socketio.Client()

@sio.event(namespace='/admin')
def connect():
    print('connected to /admin!', flush=True)

@sio.event(namespace='/admin')
def connect_error(data):
    print('connection failed to /admin!', data, flush=True)

@sio.event(namespace='/admin')
def disconnect():
    print('disconnected from /admin!', flush=True)

print("Connecting...", flush=True)
sio.connect('https://jeevansetu-api.onrender.com', namespaces=['/admin'], transports=['polling', 'websocket'])
print("Wait for auth...", flush=True)
time.sleep(3)
sio.disconnect()
