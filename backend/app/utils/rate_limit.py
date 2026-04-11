import redis
import os
from flask import current_app

redis_client = None

def init_redis(app):
    global redis_client
    url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
    try:
        r = redis.from_url(url, socket_connect_timeout=1)
        r.ping()
        redis_client = r
    except Exception:
        redis_client = None
        print(f"--- INFO: Redis unavailable at {url}. Rate limiting and deduplication disabled (Safe for Local Dev).")
        print(f"--- TIP: Use 'docker-compose up redis -d' to enable full intelligence layer features.")

def check_rate_limit(identifier, limit=5, window=60):
    """
    Check if the identifier has exceeded the limit within the time window.
    Returns (True, None) if allowed.
    Returns (False, int) if rate limited, int is seconds until retry.
    """
    if not redis_client:
        return True, None

    key = f"rate_limit:{identifier}"
    current_count = redis_client.get(key)
    
    if current_count and int(current_count) >= limit:
        ttl = redis_client.ttl(key)
        return False, ttl

    pipe = redis_client.pipeline()
    pipe.incr(key)
    if not current_count:
        pipe.expire(key, window)
    pipe.execute()

    return True, None

def check_duplicate_report(report_hash, ttl_seconds=600):
    """
    Check if a similar report exists within the last 10 minutes.
    Returns True if it's a duplicate, False otherwise.
    """
    if not redis_client:
        return False

    key = f"duplicate_report:{report_hash}"
    is_duplicate = redis_client.exists(key)
    
    if not is_duplicate:
        redis_client.setex(key, ttl_seconds, "1")
    
    return is_duplicate
