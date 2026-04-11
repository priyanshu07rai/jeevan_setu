import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def verify_counts():
    try:
        db_url = os.environ.get('DATABASE_URL')
        if db_url.startswith('postgresql://'):
            db_url = db_url.replace('postgresql://', 'postgres://')
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        tables = [
            "disaster_events", 
            "volunteers", 
            "shelters", 
            "relief_supplies",
            "donations",
            "victims"
        ]
        
        print("TABLE COUNTS:")
        for table in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                print(f"- {table}: {count}")
            except Exception as e:
                print(f"- {table}: ERROR or NOT FOUND")
                conn.rollback()

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    verify_counts()
