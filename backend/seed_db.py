import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def seed_db():
    try:
        db_url = os.environ.get('DATABASE_URL') or 'postgresql://postgres:password@localhost:5432/disaster_db'
        if db_url.startswith('postgresql://'):
            db_url = db_url.replace('postgresql://', 'postgres://')
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # Create missing tables if they don't exist by reusing the actual app's ensure_tables
        from app import create_app
        app = create_app('dev')
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS risk_predictions (
                id SERIAL PRIMARY KEY,
                lat FLOAT,
                lon FLOAT,
                risk_score FLOAT,
                disaster_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Insert Seed Data
        cur.execute("""
            INSERT INTO disaster_events (disaster_type, lat, lon, description, severity, status)
            VALUES ('Flood', 26.7606, 83.3732, 'Flood near Ramgarh Tal', 4, 'REPORTED')
            ON CONFLICT DO NOTHING;

            INSERT INTO risk_predictions (lat, lon, risk_score, disaster_type)
            VALUES 
            (26.7606, 83.3732, 0.82, 'Flood'),
            (26.7550, 83.3650, 0.64, 'Flood')
            ON CONFLICT DO NOTHING;

            INSERT INTO volunteers (name, lat, lon, skills)
            VALUES 
            ('John Doe', 26.7650, 83.3800, 'Medical, Swimming'),
            ('Jane Smith', 26.7700, 83.3700, 'Search and Rescue')
            ON CONFLICT DO NOTHING;

            INSERT INTO shelters (name, lat, lon, capacity)
            VALUES 
            ('City Sports Complex', 26.7580, 83.3600, 500),
            ('Primary School A', 26.7800, 83.4000, 200)
            ON CONFLICT DO NOTHING;

            INSERT INTO relief_supplies (location_name, food_packets, medical_kits, water, active_teams)
            VALUES 
            ('HQ Base', 1000, 50, 2000, 5)
            ON CONFLICT DO NOTHING;
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("Database seeded successfully.")
    except Exception as e:
        print(f"Seeding failed: {e}")

if __name__ == "__main__":
    seed_db()
