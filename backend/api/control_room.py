from flask import Blueprint, jsonify
from flask_cors import CORS
from services.weather import WeatherSimulator
from services.decision_engine import DecisionEngine

bp = Blueprint('control_room', __name__)
CORS(bp)

@bp.route('/control-room/data', methods=['GET'])
def get_control_room_data():
    """
    Returns the real-time aggregated snapshot required by the Control Room Dashboard.
    Includes Weather Quadrants, Analyzed Risks, and Suggestion Prompts.
    """
    try:
        # Initialize grid definitions if not already bootstrapped
        WeatherSimulator.initialize_zones()
        
        # Simulate real-time radar shifting for demonstration
        WeatherSimulator.refresh_weather()
        
        # Read the raw zone coordinates and weather parameters
        raw_weather_grid = WeatherSimulator.get_zone_data()
        
        # Pass to the intelligent rules engine to append Volunteer & SOS dynamics
        intelligence = DecisionEngine.evaluate_map_state(raw_weather_grid)
        
        return jsonify({
            'success': True,
            'map_zones': intelligence['zones'],
            'suggestions': intelligence['suggestions'],
            'timestamp': __import__('time').time()
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
