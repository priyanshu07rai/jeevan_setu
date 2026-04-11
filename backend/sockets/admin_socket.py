import time
from flask import request
from services.weather_service import WeatherService
from services.decision_engine import DecisionEngine

def register_admin_sockets(socketio, app):
    """
    Registers the dynamic map bounding viewport sockets.
    Instead of broadcasting universally, we calculate intelligence
    specifically for the coordinates requested by the client viewport.
    """
    @socketio.on('control_room:bounds', namespace='/admin')
    def handle_bounds(data):
        try:
            north = data.get('north')
            south = data.get('south')
            east = data.get('east')
            west = data.get('west')
            zoom = data.get('zoom', 12)
            
            # Missing bound safety
            if not all([north, south, east, west]):
                return
                
            # Dynamic grid resolution based on zoom
            step = 0.05 if zoom < 10 else 0.02
            
            # Generate pure RAM grid mapping bounds to chunks
            grid = WeatherService.generate_grid(north, south, east, west, step)
            
            # Apply SOS + Rain logic
            intelligence = DecisionEngine.evaluate_map_state(grid)
            
            payload = {
                'map_zones': intelligence['zones'],
                'suggestions': intelligence['suggestions'],
                'timestamp': time.time()
            }
            
            # Emit securely ONLY to the specific Admin browser session
            socketio.emit('control_room:update', payload, namespace='/admin', to=request.sid)
            
        except Exception as e:
            print("[Admin Socket Bounds Error]", e)
            import traceback
            traceback.print_exc()
