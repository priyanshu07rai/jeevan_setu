import psycopg2
conn = psycopg2.connect("postgresql://postgres:12345@localhost:5432/disaster_db")
cur = conn.cursor()

# Get all volunteers with their IDs
cur.execute("SELECT id, name FROM volunteers")
vols = cur.fetchall()
print("All volunteers:")
for v in vols:
    print(f"  ID #{v[0]}: {v[1]}")

cur.close()
conn.close()
