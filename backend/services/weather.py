import random
import time
from api.disasters import get_db_connection

# Gorakhpur Base Bounds (the default map view area in Jeevan Setu)
GKP_LAT_MIN = 26.65
GKP_LAT_MAX = 26.85
GKP_LNG_MIN = 83.25
GKP_LNG_MAX = 83.50

GRID_DIVISIONS = 8 # Creates an 8x8 grid

class WeatherSimulator:
    """
    Simulates live geospatial weather data (rainfall, conditions)
    across a defined map grid, persisting to SQLite for the Control Room.
    """
    
    @classmethod
    def initialize_zones(cls):
        """Creates the geometric grid boundaries in the database."""
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if initialized
        cur.execute("SELECT COUNT(*) FROM weather_zones")
        if cur.fetchone()[0] > 0:
            conn.close()
            return
            
        lat_step = (GKP_LAT_MAX - GKP_LAT_MIN) / GRID_DIVISIONS
        lng_step = (GKP_LNG_MAX - GKP_LNG_MIN) / GRID_DIVISIONS
        
        for i in range(GRID_DIVISIONS):
            for j in range(GRID_DIVISIONS):
                zone_id = f"Z-{str(i).zfill(2)}-{str(j).zfill(2)}"
                lat_s = GKP_LAT_MIN + (i * lat_step)
                lat_e = lat_s + lat_step
                lng_s = GKP_LNG_MIN + (j * lng_step)
                lng_e = lng_s + lng_step
                
                cur.execute(
                    "INSERT INTO weather_zones (zone_id, lat_start, lat_end, lng_start, lng_end) VALUES (?, ?, ?, ?, ?)",
                    (zone_id, lat_s, lat_e, lng_s, lng_e)
                )
        conn.commit()
        conn.close()
        print(f"Weather Simulator: Initialized {GRID_DIVISIONS*GRID_DIVISIONS} grid zones.")

    @classmethod
    def refresh_weather(cls):
        """Randomize weather params safely simulating real radar."""
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT zone_id FROM weather_zones")
        zones = cur.fetchall()
        
        conditions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Heavy Rain', 'Thunderstorm']
        
        for z in zones:
            # 70% chance of rain in a specific quadrant if simulating a monsoon scenario
            # Let's keep it truly random but weighted
            draw = random.random()
            if draw > 0.8:
                cond = 'Thunderstorm'
                rain = random.uniform(20.0, 60.0) # mm/hr
            elif draw > 0.6:
                cond = 'Heavy Rain'
                rain = random.uniform(10.0, 20.0)
            elif draw > 0.4:
                cond = 'Light Rain'
                rain = random.uniform(1.0, 10.0)
            else:
                cond = random.choice(['Clear', 'Partly Cloudy', 'Overcast'])
                rain = 0.0
                
            alert = "Flood Warning" if rain > 40 else ""
            
            cur.execute("""
                UPDATE weather_zones 
                SET rainfall = ?, condition = ?, alerts = ?, last_updated = CURRENT_TIMESTAMP
                WHERE zone_id = ?
            """, (rain, cond, alert, z['zone_id']))
            
        conn.commit()
        conn.close()
        
    @classmethod
    def get_zone_data(cls):
        """Fetch the physical grid geometries and current weather."""
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM weather_zones")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
