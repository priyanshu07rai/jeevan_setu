import psycopg2

def main():
    try:
        conn = psycopg2.connect('postgresql://postgres:12345@localhost:5432/disaster_db')
        cur = conn.cursor()
        
        # Manually add missing columns with error handling
        for col, col_type in [
            ('otp_verified',       'BOOLEAN DEFAULT FALSE'),
            ('emergency_mode',     'BOOLEAN DEFAULT FALSE'),
            ('last_login',         'TIMESTAMP'),
            ('last_device',        'TEXT'),
            ('mobile_device_id',   'TEXT'),
            ('desktop_session_id', 'TEXT'),
        ]:
            try:
                cur.execute(f"ALTER TABLE citizens ADD COLUMN {col} {col_type}")
                print(f"Added {col}")
            except Exception as e:
                conn.rollback()
                print(f"Column {col} skip (likely exists): {e}")
            else:
                conn.commit()
                
        print("Migration done.")
    except Exception as e:
        print(f"Fatal migration error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    main()
