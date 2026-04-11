import sqlite3
import os

db_path = 'disaster_local.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get columns
cur.execute("PRAGMA table_info(citizens)")
cols = [c[1] for c in cur.fetchall()]
print(f"Current columns in 'citizens': {cols}")

if 'username' in cols and 'email' not in cols:
    print("Renaming 'username' to 'email'...")
    cur.execute("ALTER TABLE citizens RENAME COLUMN username TO email")
    conn.commit()
    print("Success: Column renamed.")
elif 'email' in cols:
    print("Column 'email' already exists.")
else:
    print("Neither 'username' nor 'email' found. Check table existence.")

conn.close()
