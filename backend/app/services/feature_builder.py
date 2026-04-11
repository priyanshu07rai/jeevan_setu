import numpy as np

class FeatureBuilder:
    """
    Service responsible for compositing spatial features, satellite heuristics,
    and historical report data into a flat feature vector required by AI Models
    (e.g., RandomForest/XGBoost).
    """

    @staticmethod
    def build_features(lat, lon, time_window, disaster_type="flood"):
        """
        STUB: Aggregates environmental features for a specific geo-point.
        """
        # Simulated database/API calls to fetch heuristic indicators
        # 1. Distance to nearest water body (meters)
        distance_to_river = np.random.uniform(50, 5000)
        
        # 2. Rainfall over last 24h (mm)
        rainfall_24h = np.random.uniform(0, 150)
        
        # 3. Population density (people per sq km)
        population_density = np.random.uniform(100, 20000)
        
        # 4. Elevation / Topographic slope (degrees)
        elevation_meters = np.random.uniform(10, 1500)
        
        # 5. Live Satellite Output scores (if active)
        satellite_flood_extent_score = np.random.uniform(0.0, 1.0)
        
        features = {
            "dist_to_river_m": distance_to_river,
            "rainfall_24h_mm": rainfall_24h,
            "population_density": population_density,
            "elevation_m": elevation_meters,
            "satellite_indicator_score": satellite_flood_extent_score
        }
        
        return features

    @staticmethod
    def vectorize(feature_dict):
        """Converts feature dictionary into standard numpy array for inference"""
        return np.array([
            feature_dict["dist_to_river_m"],
            feature_dict["rainfall_24h_mm"],
            feature_dict["population_density"],
            feature_dict["elevation_m"],
            feature_dict["satellite_indicator_score"]
        ]).reshape(1, -1)
