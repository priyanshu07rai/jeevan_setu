import os
import psycopg2

def drop_tables():
    db_url = os.environ.get('DATABASE_URL') or 'postgresql://postgres:12345@localhost:5432/disaster_db'
    if db_url.startswith('postgresql://'):
        db_url = db_url.replace('postgresql://', 'postgres://')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS disaster_events CASCADE;")
    cur.execute("DROP TABLE IF EXISTS risk_predictions CASCADE;")
    conn.commit()
    cur.close()
    conn.close()
    print("Tables dropped.")

if __name__ == "__main__":
    drop_tables()
