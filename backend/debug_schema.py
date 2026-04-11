import psycopg2
conn = psycopg2.connect('postgresql://postgres:12345@localhost:5432/disaster_db')
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'disaster_events'")
with open('debug_schema.log', 'w') as f:
    for row in cur.fetchall():
        f.write(f"{row}\n")
