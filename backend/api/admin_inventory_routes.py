from flask import Blueprint, jsonify
from flask_cors import CORS
from services.inventory_service import InventoryService
from services.activity_service import ActivityService

bp = Blueprint('admin_inventory', __name__)
CORS(bp)

@bp.route('/admin/inventory', methods=['GET'])
def get_inventory():
    try:
        rows = InventoryService.get_all_inventory()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/activity', methods=['GET'])
def get_activity():
    try:
        rows = ActivityService.get_recent_logs()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
