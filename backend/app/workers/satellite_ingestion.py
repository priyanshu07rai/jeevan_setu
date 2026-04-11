import os
from datetime import datetime, timedelta
import structlog
from app.workers.celery_app import celery
from app import create_app, db
from app.models.intelligence import SatelliteImage
from geoalchemy2.shape import from_shape
from shapely.geometry import box

logger = structlog.get_logger(__name__)
flask_app = create_app(os.environ.get('FLASK_ENV', 'dev'))

def download_satellite_tile(region_bbox, time_window, satellite_name="Sentinel-1"):
    """
    STUB: Simulates querying the Sentinel API (Copernicus) or EarthData.
    Returns metadata list mimicking a search response format.
    """
    logger.info(f"querying_{satellite_name}_api", bbox=region_bbox, window=time_window)
    # Mocking a response representing a newly acquired radar tile
    return [{
        "satellite": satellite_name,
        "timestamp": datetime.utcnow() - timedelta(hours=2),
        "bbox": region_bbox,
        "cloud_cover": 12.5,
        "file_path": f"/tmp/satcache/{satellite_name}_{int(datetime.utcnow().timestamp())}.tiff",
        "mock_url": "https://scihub.copernicus.eu/stub/12345"
    }]

@celery.task(bind=True)
def ingest_satellite_imagery(self):
    """Periodic task fetching recent satellite passes over target BBOX"""
    structlog.contextvars.bind_contextvars(task="satellite_ingestion")
    
    with flask_app.app_context():
        region_bbox = flask_app.config['REGION_BBOX']
        logger.info("satellite_poll_started", region=flask_app.config['REGION_NAME'])
        
        try:
            # 1. Fetch from Multiple Platforms
            new_tiles = []
            new_tiles.extend(download_satellite_tile(region_bbox, 24, "Sentinel-1")) # SAR for Floods
            new_tiles.extend(download_satellite_tile(region_bbox, 24, "MODIS")) # Thermal for Wildfires
            
            # 2. Store Metadata in DB
            for tile in new_tiles:
                # Convert bbox [minX, minY, maxX, maxY] to shapely Polygon
                geom = box(tile['bbox'][0], tile['bbox'][1], tile['bbox'][2], tile['bbox'][3])
                
                sat_image = SatelliteImage(
                    satellite_name=tile['satellite'],
                    timestamp=tile['timestamp'],
                    bbox=from_shape(geom, srid=4326),
                    file_path=tile['file_path'],
                    cloud_cover=tile.get('cloud_cover'),
                    processed_status='pending'
                )
                db.session.add(sat_image)
            
            db.session.commit()
            logger.info("satellite_ingestion_complete", count=len(new_tiles))
            
            # TODO: Chain to disaster_detection pipeline here
            return True
            
        except Exception as e:
            logger.error("satellite_ingestion_error", error=str(e))
            return False

# Schedule it in celery
celery.conf.beat_schedule.update({
    'poll-satellites-every-12-hours': {
        'task': 'app.workers.satellite_ingestion.ingest_satellite_imagery',
        'schedule': 43200.0, # 12 hours
    },
})
