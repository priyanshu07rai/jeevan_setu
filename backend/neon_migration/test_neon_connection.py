#!/usr/bin/env python3
"""
test_neon_connection.py
Run this script to verify your Neon DB connection is working.

Usage:
    cd backend
    python neon_migration/test_neon_connection.py
"""

import os
import sys

# Load .env from backend folder
from pathlib import Path
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    print(f"[OK] Loaded .env from {env_path}")
else:
    print(f"[WARN] No .env found at {env_path}, using system environment")

DATABASE_URL = os.environ.get('DATABASE_URL', '')

if not DATABASE_URL:
    print("[ERROR] DATABASE_URL is not set in .env")
    sys.exit(1)

# Normalize postgres:// -> postgresql://
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

if not DATABASE_URL.startswith('postgresql://'):
    print(f"[ERROR] DATABASE_URL doesn't look like a PostgreSQL URL: {DATABASE_URL[:40]}...")
    sys.exit(1)

print(f"[INFO] Connecting to: {DATABASE_URL[:50]}...")

try:
    import psycopg2
    import psycopg2.extras
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Check connection
    cur.execute("SELECT version();")
    row = cur.fetchone()
    print("[OK] Connected to Neon successfully!")
    print(f"   PostgreSQL version: {row['version'][:60]}...")

    # List tables
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    tables = [r['table_name'] for r in cur.fetchall()]

    if tables:
        print(f"\n[INFO] Tables found ({len(tables)}):")
        for t in tables:
            cur.execute(f"SELECT COUNT(*) as cnt FROM {t};")
            cnt = cur.fetchone()['cnt']
            print(f"   - {t} ({cnt} rows)")
    else:
        print("\n[WARN] No tables found -- run init_neon_schema.py to create schema")

    cur.close()
    conn.close()
    print("\n[DONE] Neon DB connection test PASSED!")

except ImportError:
    print("[ERROR] psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] Connection FAILED: {e}")
    sys.exit(1)
