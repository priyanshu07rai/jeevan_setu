from flask import request
from services.volunteer_inventory_service import VolunteerInventoryService
from services.activity_service import ActivityService

def register_inventory_sockets(socketio_app):
    @socketio_app.on('inventory:update', namespace='/admin')
    def on_update(data):
        print(f"DEBUG: Inventory update received from frontend: {data}")
        try:
            vol_id = data.get('volunteer_id')
            items = data.get('items', {})
            VolunteerInventoryService.update_inventory(vol_id, items)
            
            # Personal isolated channel (Safe response)
            socketio_app.emit('inventory:ack', {"status": "success", "action": "update"}, to=request.sid, namespace='/admin')
            
            # Trigger clients to do a fresh fetch silently to ensure real-time UI
            socketio_app.emit('inventory:refresh', {}, namespace='/admin')
            
        except Exception as e:
            socketio_app.emit('inventory:error', {"error": str(e)}, to=request.sid, namespace='/admin')

    @socketio_app.on('inventory:request', namespace='/admin')
    def on_request(data):
        print(f"DEBUG: Inventory request received from frontend: {data}")
        try:
            vol_id = data.get('volunteer_id')
            req_type = data.get('type')
            items = data.get('items', {})
            
            VolunteerInventoryService.create_request(vol_id, req_type, items)
            
            # Personal isolated channel
            socketio_app.emit('inventory:ack', {"status": "success", "action": "request"}, to=request.sid, namespace='/admin')
            
            # Refresh everyone globally
            socketio_app.emit('inventory:refresh', {}, namespace='/admin')
        except Exception as e:
            socketio_app.emit('inventory:error', {"error": str(e)}, to=request.sid, namespace='/admin')

    @socketio_app.on('inventory:transfer', namespace='/admin')
    def on_transfer(data):
        print(f"DEBUG: Inventory transfer received from frontend: {data}")
        try:
            from_id = data.get('from')
            to_id = data.get('to')
            items = data.get('items')
            req_id = data.get('request_id')
            
            VolunteerInventoryService.process_transfer(from_id, to_id, items, req_id)
            ActivityService.log_event("TRANSFER", f"P2P Transfer Approved seamlessly from Vol {from_id} to Vol {to_id}")
            
            socketio_app.emit('inventory:ack', {"status": "transfer_complete"}, to=request.sid, namespace='/admin')
            socketio_app.emit('inventory:refresh', {}, namespace='/admin')
        except Exception as e:
            socketio_app.emit('inventory:error', {"error": str(e)}, to=request.sid, namespace='/admin')
