import psycopg2
conn = psycopg2.connect("postgresql://postgres:12345@localhost:5432/disaster_db")
cur = conn.cursor()

# Show all volunteers
cur.execute("SELECT id, name, status FROM volunteers")
vols = cur.fetchall()
print("Volunteers:")
for v in vols:
    print(f"  id={v[0]}, name={v[1]}, status={v[2]}")

# Show all disasters
cur.execute("SELECT id, disaster_type, status, assigned_volunteer_id FROM disaster_events ORDER BY id")
rows = cur.fetchall()
print("\nAll disasters:")
for r in rows:
    print(f"  id={r[0]}, type={r[1]}, status={r[2]}, volunteer_id={r[3]}")

# Check messages for volunteers to find who's linked to disaster 1
cur.execute("SELECT DISTINCT volunteer_id FROM volunteer_messages")
msg_vols = cur.fetchall()
print("\nVolunteers with messages:", msg_vols)

cur.execute("SELECT DISTINCT volunteer_id FROM volunteer_proofs")
proof_vols = cur.fetchall()
print("Volunteers with proofs:", proof_vols)

cur.close()
conn.close()
