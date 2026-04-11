import psycopg2

def main():
    conn = psycopg2.connect('postgresql://postgres:12345@localhost:5432/disaster_db')
    cur = conn.cursor()
    col = 'ai_verified'
    col_type = 'INTEGER'
    try:
        cur.execute(f"ALTER TABLE disaster_events ADD COLUMN IF NOT EXISTS {col} {col_type}")
        conn.commit()
        print("Success")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == '__main__':
    main()
