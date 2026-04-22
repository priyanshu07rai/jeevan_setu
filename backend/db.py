"""
db.py — Unified Database Connection Layer
Supports both SQLite (local dev) and PostgreSQL (production).
All other modules should import get_db_connection from here.
"""
import os
import sqlite3
import logging
from decimal import Decimal
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()  # strip() prevents newline-in-sslmode crash

# Render uses postgres:// which psycopg2 needs as postgresql://
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

IS_POSTGRES = DATABASE_URL.startswith('postgresql://')

_POOL = None

def get_pool():
    global _POOL
    if IS_POSTGRES and _POOL is None:
        try:
            import psycopg2.pool
            import psycopg2.extras
            _POOL = psycopg2.pool.SimpleConnectionPool(1, 20, dsn=DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
            logger.info("PostgreSQL connection pool initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL pool: {e}")
    return _POOL

_SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'disaster_local.db')


class PooledConnectionWrapper:
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._pool_returned = False

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        if not self._pool_returned and self._pool:
            # We don't want to actually close the psycopg2 connection, just return it.
            # But if a rollback is needed, we should probably do it so we don't return dirty state.
            try:
                self._conn.rollback()
            except Exception:
                pass
            self._pool.putconn(self._conn)
            self._pool_returned = True

    def __del__(self):
        self.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)

def get_db_connection():
    """
    Returns a DB-API 2.0 connection.
    - SQLite: sqlite3 with Row factory
    - PostgreSQL: wrapped psycopg2 connection from pool
    """
    if IS_POSTGRES:
        pool = get_pool()
        if pool:
            conn = pool.getconn()
            return PooledConnectionWrapper(conn, pool)
        else:
            import psycopg2
            import psycopg2.extras
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
            conn.autocommit = False
            return conn
    else:
        conn = sqlite3.connect(_SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

def release_db_connection(conn):
    """Closes or returns the connection to the pool handled by wrapper."""
    conn.close()


def ph(n=1):
    """
    Return the right placeholder string.
    ph(1) → '?' or '%s'
    ph(3) → '(?, ?, ?)' or '(%s, %s, %s)'
    """
    mark = '%s' if IS_POSTGRES else '?'
    if n == 1:
        return mark
    return '(' + ', '.join([mark] * n) + ')'


def adapt_sql(sql: str) -> str:
    """Convert SQLite-style ? placeholders to %s for PostgreSQL."""
    if IS_POSTGRES:
        return sql.replace('?', '%s')
    return sql


def serial_pk() -> str:
    """Return the correct auto-increment primary key type."""
    return 'SERIAL PRIMARY KEY' if IS_POSTGRES else 'INTEGER PRIMARY KEY AUTOINCREMENT'


def now_fn() -> str:
    """Return the current-timestamp function."""
    return 'NOW()' if IS_POSTGRES else 'CURRENT_TIMESTAMP'


def execute(cur, sql: str, params=None):
    """
    Execute a query, automatically adapting placeholders.
    Use this everywhere instead of cur.execute() directly.
    """
    adapted = adapt_sql(sql)
    # Convert 'INSERT OR IGNORE' to 'ON CONFLICT DO NOTHING' for Postgres
    if IS_POSTGRES:
        if 'INSERT OR IGNORE INTO' in adapted.upper():
            # Basic replacement for simple cases
            import re
            adapted = re.sub(r'INSERT OR IGNORE INTO', 'INSERT INTO', adapted, flags=re.IGNORECASE)
            if 'ON CONFLICT' not in adapted.upper():
                 adapted += " ON CONFLICT DO NOTHING"
    
    if params is None:
        cur.execute(adapted)
    else:
        cur.execute(adapted, params)

def insert_and_get_id(cur, sql: str, params=None):
    """
    Executes an INSERT and returning the last inserted ID.
    Handles 'RETURNING id' for Postgres and cur.lastrowid for SQLite.
    """
    if IS_POSTGRES:
        # Use our own execute wrapper to handle OR IGNORE / ON CONFLICT logic
        # But for returning ID, we need to append RETURNING id *before* ON CONFLICT if both exist.
        # However, many inserts here are simple or already handled.
        # Let's use a simpler approach for ID inserts since they usually aren't 'OR IGNORE'.
        raw_sql = sql.replace('?', '%s')
        if "RETURNING" not in raw_sql.upper():
            # If it's a conflict-handled insert, RETURNING must come AFTER ON CONFLICT DO NOTHING
            if "ON CONFLICT DO NOTHING" in raw_sql.upper():
                 raw_sql += " RETURNING id"
            elif "INSERT OR IGNORE" in raw_sql.upper():
                 # Handle the translation here for ID retrieval
                 raw_sql = raw_sql.replace("INSERT OR IGNORE INTO", "INSERT INTO")
                 raw_sql += " ON CONFLICT DO NOTHING RETURNING id"
            else:
                 raw_sql += " RETURNING id"
        
        if params:
            cur.execute(raw_sql, params)
        else:
            cur.execute(raw_sql)
        row = cur.fetchone()
        return row.get('id') if isinstance(row, dict) else row[0] if row else None
    else:
        execute(cur, sql, params)
        return cur.lastrowid

def _serialize_val(val):
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, datetime):
        return val.isoformat()
    return val

def rows_to_dicts(rows) -> list:
    """Convert fetchall() results to list of plain dicts (works for both SQLite and PG)."""
    if rows is None:
        return []
    result = []
    for row in rows:
        d = row
        if not isinstance(row, dict):
            try:
                d = dict(row)
            except (TypeError, ValueError):
                pass
        
        if isinstance(d, dict):
            fixed_d = {k: _serialize_val(v) for k, v in d.items()}
            result.append(fixed_d)
        else:
            result.append(_serialize_val(d))
    return result

def row_to_dict(row) -> dict:
    """Convert a single fetchone() result to a plain dict."""
    if row is None:
        return None
    d = row
    if not isinstance(row, dict):
        try:
            d = dict(row)
        except (TypeError, ValueError):
            return _serialize_val(row)
    return {k: _serialize_val(v) for k, v in d.items()}

def _add_col_safe(cur, table, col, col_type):
    """Add a column if it doesn't exist — handles both SQLite and PostgreSQL."""
    if IS_POSTGRES:
        try:
            execute(cur, f"SAVEPOINT add_{col}")
            execute(cur, f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}")
            execute(cur, f"RELEASE SAVEPOINT add_{col}")
        except Exception:
            execute(cur, f"ROLLBACK TO SAVEPOINT add_{col}")
    else:
        try:
            execute(cur, f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except Exception:
            pass  # Column already exists

def ensure_tables():
    """Ensures all necessary tables exist in the current database."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    pk = serial_pk()
    now = now_fn()
    
    logger.info(f"Ensuring tables exist (Postgres: {IS_POSTGRES})")
    
    try:
        # Volunteers Table
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS volunteers (
                id {pk},
                name TEXT,
                phone TEXT,
                skills TEXT,
                lat FLOAT,
                lon FLOAT,
                status TEXT DEFAULT 'AVAILABLE',
                is_online INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT {now},
                created_at TIMESTAMP DEFAULT {now},
                organization_name TEXT,
                organization_type TEXT,
                access_code TEXT
            )
        """)
        
        # Disaster Events / Missions
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS disaster_events (
                id {pk},
                disaster_type TEXT,
                description TEXT,
                status TEXT DEFAULT 'NEW',
                assigned_volunteer_id INTEGER,
                severity FLOAT DEFAULT 5.0,
                lat FLOAT,
                lon FLOAT,
                created_at TIMESTAMP DEFAULT {now}
            )
        """)
        
        # Inventory Stock (Central HQ)
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS inventory_stock (
                id {pk},
                warehouse_name TEXT,
                latitude FLOAT,
                longitude FLOAT,
                food_qty INTEGER DEFAULT 0,
                water_qty INTEGER DEFAULT 0,
                medical_qty INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT {now}
            )
        """)
        
        # Volunteer Inventory (Field)
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS volunteer_inventory (
                id {pk},
                volunteer_id TEXT UNIQUE,
                food_qty INTEGER DEFAULT 0,
                water_qty INTEGER DEFAULT 0,
                medical_qty INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT {now}
            )
        """)
        
        # Inventory Requests
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS inventory_requests (
                id {pk},
                from_volunteer_id TEXT,
                type TEXT,
                food_qty INTEGER DEFAULT 0,
                water_qty INTEGER DEFAULT 0,
                medical_qty INTEGER DEFAULT 0,
                status TEXT DEFAULT 'PENDING',
                timestamp TIMESTAMP DEFAULT {now}
            )
        """)

        # Master Identity seeding removed to avoid registration conflicts
        pass

        # Broadcasts
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS broadcasts (
                id {pk},
                message TEXT,
                active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT {now}
            )
        """)

        # Donations
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS donations (
                id {pk},
                donor_name TEXT DEFAULT 'Anonymous',
                amount FLOAT NOT NULL DEFAULT 0,
                category TEXT DEFAULT 'General Relief',
                created_at TIMESTAMP DEFAULT {now}
            )
        """)

        # Donation Likes
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS donation_likes (
                id {pk},
                user_email TEXT,
                donor_name TEXT,
                UNIQUE(user_email, donor_name)
            )
        """)

        # Citizens (Unified Web/Mobile Identity)
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS citizens (
                id {pk},
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                phone TEXT,
                otp_verified BOOLEAN DEFAULT FALSE,
                emergency_mode BOOLEAN DEFAULT FALSE,
                last_login TIMESTAMP,
                last_device TEXT,
                mobile_device_id TEXT,
                desktop_session_id TEXT,
                created_at TIMESTAMP DEFAULT {now}
            )
        """)

        # Safe migrations for citizens — add new columns to existing tables
        for col, col_type in [
            ('otp_verified',       'BOOLEAN DEFAULT FALSE'),
            ('emergency_mode',     'BOOLEAN DEFAULT FALSE'),
            ('last_login',         'TIMESTAMP'),
            ('last_device',        'TEXT'),
            ('mobile_device_id',   'TEXT'),
            ('desktop_session_id', 'TEXT'),
        ]:
            _add_col_safe(cur, 'citizens', col, col_type)

        # Shelters
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS shelters (
                id {pk},
                name TEXT,
                lat FLOAT,
                lon FLOAT,
                capacity INTEGER,
                current_occupancy INTEGER DEFAULT 0
            )
        """)

        # Volunteer Messages
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS volunteer_messages (
                id {pk},
                volunteer_id INTEGER NOT NULL,
                mission_id INTEGER,
                sender TEXT DEFAULT 'admin',
                message TEXT,
                created_at TIMESTAMP DEFAULT {now}
            )
        """)

        # Volunteer Proofs
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS volunteer_proofs (
                id {pk},
                volunteer_id INTEGER NOT NULL,
                mission_id INTEGER,
                filename TEXT,
                original_name TEXT,
                file_type TEXT,
                severity TEXT DEFAULT 'medium',
                caption TEXT,
                created_at TIMESTAMP DEFAULT {now}
            )
        """)

        # Relief Supplies (Extra mapping)
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS relief_supplies (
                id {pk},
                location_name TEXT,
                food_packets INTEGER,
                medical_kits INTEGER,
                water INTEGER,
                active_teams INTEGER
            )
        """)

        # Weather Zones
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS weather_zones (
                zone_id TEXT PRIMARY KEY,
                lat_start FLOAT,
                lat_end FLOAT,
                lng_start FLOAT,
                lng_end FLOAT,
                rainfall FLOAT DEFAULT 0,
                condition TEXT DEFAULT 'Clear',
                alerts TEXT,
                last_updated TIMESTAMP DEFAULT {now}
            )
        """)
        
        # --- SAFE MIGRATIONS (Add columns if they were missed) ---
        for col, col_type in [
            ('ai_verified', 'INTEGER DEFAULT 0'),
            ('ai_confidence', 'FLOAT DEFAULT 0.0'),
            ('severity_level', "TEXT DEFAULT 'LOW'"),
            ('severity_score', 'INTEGER DEFAULT 0'),
            ('image_url', 'TEXT'),
            ('ai_description', 'TEXT')
        ]:
            _add_col_safe(cur, 'disaster_events', col, col_type)

        conn.commit()
        logger.info("Database tables/columns verified successfully.")
    except Exception as e:
        logger.error(f"Error during database synchronization: {e}")
        conn.rollback()
    finally:
        release_db_connection(conn)
