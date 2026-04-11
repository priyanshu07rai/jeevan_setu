import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def clear_db():
    conn = None
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
            "donation_likes",
            "citizens",
            "broadcasts",
            "volunteer_messages",
            "volunteer_proofs",
            "volunteer_inventory",
            "inventory_requests",
            "inventory_stock",
            "activity_logs",
            "risk_predictions",
            "weather_zones",
            "payment_config",
            "payment_requests"
        ]
        
        for table in tables:
            try:
                print(f"TRUNCATING: {table}...")
                cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;")
                conn.commit() # COMMIT AFTER EVERY SUCCESSFUL TRUNCATE
                print(f"SUCCESS: {table} empty.")
            except Exception as e:
                print(f"SKIPPING {table} (Probably missing): {e}")
                conn.rollback() # ONLY ROLLBACK THE FAILED TRUNCATE

        cur.close()
        conn.close()
        print("\nDATABASE RESET SESSION COMPLETE.")
    except Exception as e:
        if conn: conn.rollback()
        print(f"Critical clearing failed: {e}")

if __name__ == "__main__":
    clear_db()
