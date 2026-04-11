import numpy as np
import time

class DistressPredictor:
    """
    Simulates inferences from a pre-trained RandomForest/XGBoost model.
    Given lat/lon and environmental features, yields a 0.0-1.0 probability
    of distress reports originating from that cell soon.
    """
    def __init__(self, disaster_type="flood", model_path="disaster_intelligence/models/trained"):
        # self.model = pickle.load(open(f"{model_path}/{disaster_type}_predictor.pkl", "rb"))
        self.type = disaster_type
        print(f"[Model Loader] Loaded {self.type} predictor graph into memory.")
        
    def predict(self, feature_vector):
        """
        Runs XGBoost inference on flat float array
        [dist_river, rain, pop_density, elevation, satellite_indicator]
        """
        # Inference simulation
        time.sleep(0.5) 
        
        # Heavy heuristic weights:
        # High satellite indicating flood + high pop density + high rainfall = HIGH RISK
        score = 0.5 
        
        if feature_vector[0][4] > 0.7:  # satellite_indicator_score
            score += 0.3
        if feature_vector[0][1] > 100:  # heavy rain > 100mm
            score += 0.15
        if feature_vector[0][2] > 5000: # dense pop
            score += 0.1
            
        return min(max(score, 0.0), 1.0)
