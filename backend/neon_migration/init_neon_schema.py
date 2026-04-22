#!/usr/bin/env python3
"""
init_neon_schema.py
If you are starting fresh on Neon (no dump available from Render),
run this to create all tables from scratch using the same schema as the app.

Usage:
    cd backend
    python neon_migration/init_neon_schema.py
"""

import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    print(f"[OK] Loaded .env from {env_path}")

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if not DATABASE_URL.startswith('postgresql://') and not DATABASE_URL.startswith('postgres://'):
    print("[ERROR] DATABASE_URL must point to a PostgreSQL/Neon database")
    print(f"   Current value: {DATABASE_URL[:60]}")
    sys.exit(1)

print("[INFO] Initializing Neon database schema...")
print("   This will create all tables (safe -- uses CREATE TABLE IF NOT EXISTS)")

from db import ensure_tables
ensure_tables()

print("[DONE] Schema initialized on Neon!")
print("\nRun test_neon_connection.py to verify.")
