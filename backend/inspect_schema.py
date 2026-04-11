import psycopg2
import sys

def main():
    try:
        conn = psycopg2.connect('postgresql://postgres:12345@localhost:5432/disaster_db')
        cur = conn.cursor()
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'citizens'")
        cols = cur.fetchall()
        for col in cols:
            print(f"{col[0]}: {col[1]}")
    except Exception as e:
        print(e)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    main()
