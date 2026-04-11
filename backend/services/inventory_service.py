import math
from db import get_db_connection, execute, serial_pk, rows_to_dicts, row_to_dict
from services.activity_service import ActivityService

class InventoryService:
    """
    Manages the Supply Intelligence Layer inventory natively separated
    from existing DB schemas. Deductions trigger via hook observers.
    """
    
    @classmethod
    def setup_table(cls):
        conn = get_db_connection()
        cur = conn.cursor()
        pk = serial_pk()
        execute(cur, f"""
            CREATE TABLE IF NOT EXISTS inventory_stock (
                id {pk},
                warehouse_name TEXT,
                latitude REAL,
                longitude REAL,
                food_qty INTEGER,
                water_qty INTEGER,
                medical_qty INTEGER,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Smart Seed: Populate realistic warehouses specifically mapping Gorakhpur if empty
        execute(cur, "SELECT COUNT(*) as cnt FROM inventory_stock")
        row = row_to_dict(cur.fetchone())
        if row and row['cnt'] == 0:
            seed_data = [
                ("Gorakhpur Central Base", 26.7600, 83.3700, 600, 800, 200),
                ("North Relief Depot", 26.8000, 83.3900, 300, 400, 80),
                ("South Field Station", 26.7100, 83.3600, 100, 150, 40)
            ]
            for sd in seed_data:
                execute(cur, "INSERT INTO inventory_stock (warehouse_name, latitude, longitude, food_qty, water_qty, medical_qty) VALUES (?, ?, ?, ?, ?, ?)", sd)
        
        conn.commit()
        conn.close()

    @classmethod
    def get_all_inventory(cls):
        cls.setup_table()
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM inventory_stock")
        rows = rows_to_dicts(cur.fetchall())
        conn.close()
        return rows

    @classmethod
    def process_dispatch(cls, target_lat=None, target_lng=None):
        """
        Listens to dispatch approvals safely without mutating the main logic.
        Extracts fixed supply counts and deducts them from nearest spatial warehouse.
        """
        cls.setup_table()
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM inventory_stock")
        warehouses = rows_to_dicts(cur.fetchall())
        
        if not warehouses:
            conn.close()
            return
            
        selected_wh = warehouses[0]
        
        # Euclidean Spatial mapping logic (Fast approximation)
        if target_lat is not None and target_lng is not None:
            min_dist = float('inf')
            for wh in warehouses:
                d = math.hypot(wh['latitude'] - float(target_lat), wh['longitude'] - float(target_lng))
                if d < min_dist:
                    min_dist = d
                    selected_wh = wh
        
        # Hypothetical dispatch chunk requirements
        dec_food = 40
        dec_water = 60
        dec_med = 10
        
        new_food = max(0, selected_wh['food_qty'] - dec_food)
        new_wtr = max(0, selected_wh['water_qty'] - dec_water)
        new_med = max(0, selected_wh['medical_qty'] - dec_med)
        
        execute(cur,
            "UPDATE inventory_stock SET food_qty=?, water_qty=?, medical_qty=?, last_updated=CURRENT_TIMESTAMP WHERE id=?", 
            (new_food, new_wtr, new_med, selected_wh['id'])
        )
        conn.commit()
        
        print(f"[Supply Intelligence] Deducted supplies mechanically from {selected_wh['warehouse_name']}")
        
        # --- SMART ALERTS ---
        if new_food < 100:
            ActivityService.log_event("ALERT", f"Low Food stock at {selected_wh['warehouse_name']} ({new_food} units left)")
        if new_wtr < 100:
            ActivityService.log_event("ALERT", f"Low Water stock at {selected_wh['warehouse_name']} ({new_wtr} units left)")
        if new_med < 25:
            ActivityService.log_event("ALERT", f"Critical Medical shortage at {selected_wh['warehouse_name']} ({new_med} units left)")
            
        conn.close()
        
        # Relay instantly via sockets
        try:
            from sockets.activity_socket import emit_inventory
            emit_inventory(cls.get_all_inventory())
        except Exception:
            pass
