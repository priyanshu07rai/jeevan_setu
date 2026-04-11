from flask import Blueprint, jsonify, request
from flask_cors import CORS
from services.volunteer_inventory_service import VolunteerInventoryService

bp = Blueprint('admin_inventory_sync', __name__)
CORS(bp)

@bp.route('/admin/volunteer-inventory', methods=['GET'])
def get_vol_inv():
    try:
        rows = VolunteerInventoryService.get_all_inventory()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/inventory-requests', methods=['GET'])
def get_inv_reqs():
    try:
        rows = VolunteerInventoryService.get_all_requests()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/inventory-matches', methods=['GET'])
def get_inv_matches():
    try:
        rows = VolunteerInventoryService.match_requests()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/inventory/update', methods=['POST'])
def update_inventory_api():
    print("DEBUG: Inventory update received via API", request.json)
    try:
        data = request.json
        vol_id = data.get('volunteer_id') or data.get('volunteerId')
        items = data.get('items', {})
        VolunteerInventoryService.update_inventory(vol_id, items)
        
        # Trigger real-time refresh if socketio is active
        from app import socketio
        socketio.emit('inventory:refresh', {}, namespace='/admin')
        
        return jsonify({"status": "success", "action": "update"}), 200
    except Exception as e:
        print("ERROR processing update API:", str(e))
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/inventory/request', methods=['POST'])
def request_inventory_api():
    print("DEBUG: Inventory request received via API", request.json)
    try:
        data = request.json
        vol_id = data.get('volunteer_id') or data.get('volunteerId')
        req_type = data.get('type')
        items = data.get('items', {})
        VolunteerInventoryService.create_request(vol_id, req_type, items)
        
        from app import socketio
        socketio.emit('inventory:refresh', {}, namespace='/admin')
        
        return jsonify({"status": "success", "action": "request"}), 200
    except Exception as e:
        print("ERROR processing request API:", str(e))
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/inventory-requests/<int:req_id>/approve', methods=['POST'])
def approve_request_api(req_id):
    try:
        res = VolunteerInventoryService.process_admin_action(req_id, 'APPROVE')
        from app import socketio
        socketio.emit('request_update', {'message': f'Your {res["type"]} was APPROVED!', 'status': res["status"], 'req_id': req_id}, to=f"user_{res['vid']}")
        socketio.emit('inventory:refresh', {}, namespace='/admin')
        return jsonify({"status": "success", "action": "approve"}), 200
    except Exception as e:
        print("ERROR approving request:", str(e))
        return jsonify({"error": str(e)}), 400

@bp.route('/admin/inventory-requests/<int:req_id>/reject', methods=['POST'])
def reject_request_api(req_id):
    try:
        res = VolunteerInventoryService.process_admin_action(req_id, 'REJECT')
        from app import socketio
        socketio.emit('request_update', {'message': f'Your {res["type"]} was REJECTED.', 'status': res["status"], 'req_id': req_id}, to=f"user_{res['vid']}")
        socketio.emit('inventory:refresh', {}, namespace='/admin')
        return jsonify({"status": "success", "action": "reject"}), 200
    except Exception as e:
        print("ERROR rejecting request:", str(e))
        return jsonify({"error": str(e)}), 400
