from db import get_db_connection

conn = get_db_connection()
cur = conn.cursor()
cur.execute("SELECT * FROM volunteers LIMIT 1")
row = cur.fetchone()
print(f"Row type: {type(row)}")
print(f"Row: {row}")
print(f"Row dict: {dict(row)}")
