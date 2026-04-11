import os
import requests
import json
import time
import numpy as np
from datetime import datetime

# Fallback values if API fails/missing
DEFAULT_WEATHER = {
    'rainfall': 0.0,
    'condition': 'Clear',
    'alerts': ''
}

# Very simple dictionary RAM cache to prevent rate-limit spam on rapid scroll
# Key: "lat,lng" (rounded to 0.5 degrees roughly), Value: (weather_dict, timestamp)
_WEATHER_CACHE = {}

class WeatherService:
    """
    Live OpenWeatherMap Integration for the Control Room.
    Using a single center-point API call to avoid rate limits,
    distributing cached/fallback weather across a deterministic grid.
    """
    
    @classmethod
    def get_weather(cls, center_lat, center_lon):
        """Fetch weather for any center coordinate, using a localized cache."""
        
        # Grid block caching resolution (0.5 degree chunk prevents excessive OWM calls)
        cache_lat = round(center_lat * 2) / 2
        cache_lon = round(center_lon * 2) / 2
        cache_key = f"{cache_lat},{cache_lon}"
        
        # Check RAM cache (valid for 5 minutes)
        if cache_key in _WEATHER_CACHE:
            cached_data, timestamp = _WEATHER_CACHE[cache_key]
            if time.time() - timestamp < 300:
                print(f"[WeatherService] Serving cached weather for {cache_key}")
                return cached_data
        
        api_key = os.environ.get('OPENWEATHER_API_KEY')
        if not api_key:
            return DEFAULT_WEATHER
            
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={center_lat}&lon={center_lon}&appid={api_key}&units=metric"
            resp = requests.get(url, timeout=5)
            if resp.status_code != 200:
                print(f"OWM API failed ({resp.status_code}). Using fallback.")
                return DEFAULT_WEATHER
                
            data = resp.json()
            
            condition = data['weather'][0]['main']
            rain = 0.0
            if 'rain' in data and '1h' in data['rain']:
                rain = data['rain']['1h']
                
            weather_data = {
                'rainfall': rain,
                'condition': condition,
                'alerts': 'Heavy Rain Warning' if rain > 15 else ''
            }
            
            # Save to RAM cache
            _WEATHER_CACHE[cache_key] = (weather_data, time.time())
            return weather_data
            
        except requests.RequestException as e:
            print("Weather API exception:", e)
            return DEFAULT_WEATHER

    @classmethod
    def generate_grid(cls, north, south, east, west, step):
        """Creates the geometric grid objects completely in RAM."""
        
        weather = cls.get_weather((north + south)/2.0, (east + west)/2.0)
        
        # Increase the bounds slightly to allow full np.arange coverage without clipping edges
        lat_steps = np.arange(south, north, step)
        lng_steps = np.arange(west, east, step)
        
        grid = []
        for i, lat_s in enumerate(lat_steps):
            for j, lng_s in enumerate(lng_steps):
                lat_e = lat_s + step
                lng_e = lng_s + step
                
                # Make sure we don't wildly exceed bounds on the last loop
                if lat_e > north + step: lat_e = north
                if lng_e > east + step: lng_e = east

                zone_id = f"Z-{str(i).zfill(2)}-{str(j).zfill(2)}"
                
                grid.append({
                    'zone_id': zone_id,
                    'lat_start': lat_s,
                    'lat_end': lat_e,
                    'lng_start': lng_s,
                    'lng_end': lng_e,
                    'rainfall': weather['rainfall'],
                    'condition': weather['condition'],
                    'alerts': weather['alerts']
                })
                
        return grid
