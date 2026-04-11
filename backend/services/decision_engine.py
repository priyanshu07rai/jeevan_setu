from db import get_db_connection, execute, rows_to_dicts

class DecisionEngine:
    """
    Calculates geographical risk scores based on real-time SOS density, 
    volunteer scarcity, and rainfall metrics using a weighted risk formula.
    """

    @classmethod
    def evaluate_map_state(cls, weather_data):
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Fetch active SOS
        execute(cur, "SELECT lat, lon FROM disaster_events WHERE status IN ('REPORTED', 'DISPATCHED')")
        sos_points = rows_to_dicts(cur.fetchall())
        
        # 2. Fetch volunteers
        execute(cur, "SELECT lat, lon, status, is_online FROM volunteers")
        vols = rows_to_dicts(cur.fetchall())
        conn.close()
        
        analyzed_zones = []
        suggestions = []
        
        for z in weather_data:
            lat_s = z['lat_start']
            lat_e = z['lat_end']
            lng_s = z['lng_start']
            lng_e = z['lng_end']
            rain = z['rainfall']
            
            # Count SOS in this polygon
            sos_count = sum(
                1 for p in sos_points 
                if (p['lat'] is not None and p['lon'] is not None) and 
                   (lat_s <= p['lat'] < lat_e) and (lng_s <= p['lon'] < lng_e)
            )
            
            # Count active available volunteers in this polygon
            vol_count = sum(
                1 for v in vols
                if (v['lat'] is not None and v['lon'] is not None) and
                   (lat_s <= v['lat'] < lat_e) and (lng_s <= v['lon'] < lng_e) and
                   v['status'] == 'AVAILABLE' and v['is_online'] == 1
            )
            
            # Upgraded Rule-based Risk Engine (Weighted)
            risk_score = (sos_count * 2) + rain
            
            if risk_score > 10:
                risk_level = 'HIGH RISK'
                color = '#ef4444' # RED
            elif risk_score > 5:
                risk_level = 'MEDIUM RISK'
                color = '#f97316' # ORANGE
            elif risk_score > 0:
                risk_level = 'LOW RISK'
                color = '#eab308' # YELLOW
            else:
                risk_level = 'SAFE'
                color = '#10b981' # GREEN
                
            # Suggestion Engine (Actionable intel for right panel)
            if risk_level == 'HIGH RISK':
                if vol_count < sos_count:
                    suggestions.append({
                        'zone': z['zone_id'],
                        'priority': 'CRITICAL',
                        'type': 'Evacuation/Deployment',
                        'message': f"Critical SOS Density in Zone {z['zone_id']}. Deficit of {sos_count - vol_count} personnel required. Deploy teams immediately."
                    })
                
            elif risk_level == 'MEDIUM RISK':
                if rain > 5:
                    suggestions.append({
                        'zone': z['zone_id'],
                        'priority': 'WARNING',
                        'type': 'Weather Alert',
                        'message': f"Emerging risk in Zone {z['zone_id']} due to rainfall and alerts. Recommend proactive mobilization."
                    })
                    
            z_enriched = dict(z)
            z_enriched['sos_count'] = sos_count
            z_enriched['vol_count'] = vol_count
            z_enriched['risk_level'] = risk_level
            z_enriched['color'] = color
            
            analyzed_zones.append(z_enriched)
            
        return {
            'zones': analyzed_zones,
            'suggestions': sorted(suggestions, key=lambda x: 0 if x['priority']=='CRITICAL' else 1)[:10]
        }
