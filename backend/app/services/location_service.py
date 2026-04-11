import spacy
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
import logging

logger = logging.getLogger(__name__)

# Load spacy model lazily
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except Exception as e:
            logger.error(f"Failed to load spacy model: {e}")
            _nlp = False # Prevents repeated load attempts if failed
    return _nlp

# Initialize geocoder
geolocator = Nominatim(user_agent="disaster_data_collection_agent")

def extract_location_entities(text):
    nlp = get_nlp()
    if not nlp:
        return []

    doc = nlp(text)
    locations = []
    
    # Extract GPE (Geopolitical Entity), LOC (Non-GPE locations), FAC (Facilities/Landmarks)
    for ent in doc.ents:
        if ent.label_ in ['GPE', 'LOC', 'FAC']:
            locations.append(ent.text)
            
    # As a fallback or addition, we might just use the whole text if it's short, or custom regex.
    return locations

def geocode_location(location_phrase):
    try:
        location = geolocator.geocode(location_phrase, timeout=5)
        if location:
            return {
                "latitude": location.latitude,
                "longitude": location.longitude,
                "address": location.address
            }
    except (GeocoderTimedOut, GeocoderUnavailable) as e:
        logger.warning(f"Geocoding service unavailable or timed out for phrase '{location_phrase}': {e}")
    except Exception as e:
        logger.error(f"Unexpected error during geocoding: {e}")
        
    return None

def process_text_for_location(text):
    """
    Attempts to extract location from text and geocode it.
    Returns (latitude, longitude, extracted_text) or (None, None, None)
    """
    locations = extract_location_entities(text)
    
    if not locations:
        return None, None, None
        
    # Try the most specific combination or just the first one found
    # For a real system, you might combine them or rank them.
    # Here we just try joining them first, then individually if that fails.
    
    combined_phrase = " ".join(locations)
    geo_data = geocode_location(combined_phrase)
    
    if geo_data:
        return geo_data['latitude'], geo_data['longitude'], combined_phrase
        
    for loc in locations:
        geo_data = geocode_location(loc)
        if geo_data:
            return geo_data['latitude'], geo_data['longitude'], loc
            
    return None, None, combined_phrase
