from flask import Blueprint, jsonify
from flask_cors import CORS

bp = Blueprint('control_room', __name__)
CORS(bp)

@bp.route('/control-room/data', methods=['GET'])
def get_control_room_data():
    """
    Deprecated for dynamic websocket viewport bounds updates.
    Returns graceful fallback.
    """
    return jsonify({
        'success': True,
        'map_zones': [],
        'suggestions': [],
        'timestamp': __import__('time').time(),
        'message': 'Connecting to Radar Viewport Stream...'
    }), 200
