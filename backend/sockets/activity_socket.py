from app import socketio

def emit_feed(log_dict):
    """Broadcasts a single new activity log object immediately to control room active clients."""
    socketio.emit('activity:new', log_dict, namespace='/admin')

def emit_inventory(inventory_list):
    """Broadcasts current aggregated inventory state seamlessly."""
    socketio.emit('inventory:update', inventory_list, namespace='/admin')

# This isn't strictly necessary as the core `admin_socket.py` already manages `/admin` connects,
# but it provides a clean API namespace wrapper.
def register_activity_sockets(socketio, app):
    pass
