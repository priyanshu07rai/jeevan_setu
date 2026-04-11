from db import get_db_connection, execute, serial_pk, insert_and_get_id, row_to_dict, rows_to_dicts

class ActivityService:
    """
    Manages the live activity log stream.
    Used selectively across existing dispatch points as a safe, isolated hook.
    """
    @classmethod
    def setup_table(cls):
        conn = get_db_connection()
        cur = conn.cursor()
        pk = serial_pk()
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id {pk},
                type TEXT,
                message TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    @classmethod
    def log_event(cls, event_type, message):
        """Generates a log and attempts to stream it over sockets instantly."""
        cls.setup_table()
        conn = get_db_connection()
        cur = conn.cursor()
        log_id = insert_and_get_id(cur, "INSERT INTO activity_logs (type, message) VALUES (?, ?)", (event_type, message))
        execute(cur, "SELECT * FROM activity_logs WHERE id = ?", (log_id,))
        
        # Format for reliable JSON transmission
        new_log = row_to_dict(cur.fetchone())
        conn.commit()
        conn.close()
        
        # Emit via socket natively, bypassing errors if socket server isn't mapped
        try:
            from sockets.activity_socket import emit_feed
            emit_feed(new_log)
        except ImportError:
            pass # App booting context
        except Exception as e:
            print("[Activity Feed Broadcast Failed]", e)
            
        return new_log
            
    @classmethod
    def get_recent_logs(cls):
        cls.setup_table()
        conn = get_db_connection()
        cur = conn.cursor()
        # Fetch latest 50
        execute(cur, "SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50")
        rows = rows_to_dicts(cur.fetchall())
        conn.close()
        return rows
