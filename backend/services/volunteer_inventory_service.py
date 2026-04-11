from typing import Dict, List, Any
from db import get_db_connection, adapt_sql, execute, release_db_connection, row_to_dict, rows_to_dicts

class VolunteerInventoryService:
    @classmethod
    def get_all_inventory(cls) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            execute(cur, """
                SELECT vi.*, COALESCE(v.name, 'Unknown (' || vi.volunteer_id || ')') as volunteer_name 
                FROM volunteer_inventory vi 
                LEFT JOIN volunteers v ON v.id = CAST(vi.volunteer_id AS INTEGER)
            """)
            rows = rows_to_dicts(cur.fetchall())
            return rows
        finally:
            release_db_connection(conn)

    @classmethod
    def get_inventory(cls, vol_id: str) -> Dict[str, Any]:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            execute(cur, "SELECT * FROM volunteer_inventory WHERE volunteer_id = ?", (vol_id,))
            row = row_to_dict(cur.fetchone())
            if row: return row
            return {"volunteer_id": vol_id, "food_qty": 0, "water_qty": 0, "medical_qty": 0}
        finally:
            release_db_connection(conn)

    @classmethod
    def update_inventory(cls, vol_id: str, data: Dict[str, int]):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            # Upsert logic - check existence
            execute(cur, "SELECT id FROM volunteer_inventory WHERE volunteer_id=?", (vol_id,))
            exists = cur.fetchone()
            
            if exists:
                execute(cur, """
                    UPDATE volunteer_inventory 
                    SET food_qty=?, water_qty=?, medical_qty=?, last_updated=CURRENT_TIMESTAMP 
                    WHERE volunteer_id=?
                """, (int(data.get('food_qty', 0)), int(data.get('water_qty', 0)), int(data.get('medical_qty', 0)), str(vol_id)))
            else:
                execute(cur, """
                    INSERT INTO volunteer_inventory (volunteer_id, food_qty, water_qty, medical_qty) 
                    VALUES (?, ?, ?, ?)
                """, (str(vol_id), int(data.get('food_qty', 0)), int(data.get('water_qty', 0)), int(data.get('medical_qty', 0))))
            
            conn.commit()
            return cls.get_inventory(vol_id)
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            release_db_connection(conn)

    @classmethod
    def create_request(cls, vol_id: str, req_type: str, items: Dict[str, int]):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            execute(cur, """
                INSERT INTO inventory_requests (from_volunteer_id, type, food_qty, water_qty, medical_qty, status)
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            """, (str(vol_id), str(req_type), int(items.get('food_qty', 0)), int(items.get('water_qty', 0)), int(items.get('medical_qty', 0))))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            release_db_connection(conn)

    @classmethod
    def get_all_requests(cls):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            execute(cur, """
                SELECT ir.*, COALESCE(v.name, 'Unknown (' || ir.from_volunteer_id || ')') as volunteer_name 
                FROM inventory_requests ir 
                LEFT JOIN volunteers v ON v.id = CAST(ir.from_volunteer_id AS INTEGER)
                ORDER BY ir.timestamp DESC
            """)
            rows = rows_to_dicts(cur.fetchall())
            return rows
        finally:
            release_db_connection(conn)

    @classmethod
    def match_requests(cls):
        """ Suggests matches natively between PENDING requests and volunteers offering / surplus """
        requests = [r for r in cls.get_all_requests() if r['status'] == 'PENDING' and r['type'] == 'REQUEST']
        inventory = cls.get_all_inventory()
        
        matches = []
        for req in requests:
            for inv in inventory:
                if inv['volunteer_id'] == req['from_volunteer_id']:
                    continue
                
                can_satisfy = True
                if req['food_qty'] > 0 and inv['food_qty'] < req['food_qty']: can_satisfy = False
                if req['water_qty'] > 0 and inv['water_qty'] < req['water_qty']: can_satisfy = False
                if req['medical_qty'] > 0 and inv['medical_qty'] < req['medical_qty']: can_satisfy = False
                
                if can_satisfy:
                    matches.append({
                        "request_id": req['id'],
                        "from": inv['volunteer_id'],
                        "to": req['from_volunteer_id'],
                        "from_name": inv.get('volunteer_name', inv['volunteer_id']),
                        "to_name": req.get('volunteer_name', req['from_volunteer_id']),
                        "items": {
                            "food_qty": req['food_qty'],
                            "water_qty": req['water_qty'],
                            "medical_qty": req['medical_qty']
                        }
                    })
        return matches

    @classmethod
    def process_transfer(cls, from_id: str, to_id: str, items: Dict[str, int], req_id: int):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            # Auto-create receiver record if missing
            execute(cur, "SELECT * FROM volunteer_inventory WHERE volunteer_id=?", (to_id,))
            if not cur.fetchone():
                execute(cur, "INSERT INTO volunteer_inventory (volunteer_id) VALUES (?)", (to_id,))
                
            # Safely check sender logic
            execute(cur, "SELECT * FROM volunteer_inventory WHERE volunteer_id=?", (from_id,))
            from_inv = row_to_dict(cur.fetchone())
            
            if not from_inv:
                raise Exception("Sender inventory completely empty.")
                
            req_food = int(items.get('food_qty', 0))
            req_water = int(items.get('water_qty', 0))
            req_med = int(items.get('medical_qty', 0))
            
            if (from_inv['food_qty'] < req_food or
                from_inv['water_qty'] < req_water or
                from_inv['medical_qty'] < req_med):
                raise Exception("Race condition avoided: Insufficient stock exists for this transaction.")
                
            # Synchronous updates
            execute(cur, """
                UPDATE volunteer_inventory 
                SET food_qty = food_qty - ?, water_qty = water_qty - ?, medical_qty = medical_qty - ?
                WHERE volunteer_id = ?
            """, (req_food, req_water, req_med, from_id))

            execute(cur, """
                UPDATE volunteer_inventory 
                SET food_qty = food_qty + ?, water_qty = water_qty + ?, medical_qty = medical_qty + ?
                WHERE volunteer_id = ?
            """, (req_food, req_water, req_med, to_id))

            if req_id is not None:
                execute(cur, "UPDATE inventory_requests SET status='COMPLETED' WHERE id=?", (req_id,))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            release_db_connection(conn)

    @classmethod
    def process_admin_action(cls, req_id: int, action: str):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            execute(cur, "SELECT * FROM inventory_requests WHERE id=?", (req_id,))
            req = row_to_dict(cur.fetchone())
            if not req:
                raise Exception(f"Request {req_id} not found.")
            
            if req['status'] != 'PENDING':
                raise Exception(f"Request {req_id} has already been processed.")

            new_status = 'APPROVED' if action.upper() == 'APPROVE' else 'REJECTED'
            
            if action.upper() == 'APPROVE':
                req_food = int(req['food_qty'])
                req_water = int(req['water_qty'])
                req_med = int(req['medical_qty'])
                vid = req['from_volunteer_id']
                r_type = req['type']

                # Fetch central inventory
                execute(cur, "SELECT * FROM inventory_stock LIMIT 1")
                central = row_to_dict(cur.fetchone())
                if not central and r_type == 'REQUEST':
                     raise Exception("Central inventory not found.")
                
                # Fetch/Init volunteer inventory
                execute(cur, "SELECT * FROM volunteer_inventory WHERE volunteer_id=?", (vid,))
                vol_inv = row_to_dict(cur.fetchone())
                if not vol_inv:
                    execute(cur, "INSERT INTO volunteer_inventory (volunteer_id) VALUES (?)", (vid,))
                    vol_inv = {'food_qty': 0, 'water_qty': 0, 'medical_qty': 0}

                if r_type == 'REQUEST':
                    # Volunteer requested from HQ
                    if (central['food_qty'] < req_food or
                        central['water_qty'] < req_water or
                        central['medical_qty'] < req_med):
                        raise Exception("Insufficient stock in central inventory.")

                    execute(cur, """
                        UPDATE inventory_stock
                        SET food_qty = food_qty - ?, water_qty = water_qty - ?, medical_qty = medical_qty - ?
                        WHERE id = ?
                    """, (req_food, req_water, req_med, central['id']))

                    execute(cur, """
                        UPDATE volunteer_inventory
                        SET food_qty = food_qty + ?, water_qty = water_qty + ?, medical_qty = medical_qty + ?
                        WHERE volunteer_id = ?
                    """, (req_food, req_water, req_med, vid))

                elif r_type == 'OFFER':
                    # Volunteer offered to HQ
                    if (vol_inv['food_qty'] < req_food or
                        vol_inv['water_qty'] < req_water or
                        vol_inv['medical_qty'] < req_med):
                        raise Exception("Volunteer does not have enough stock to offer.")
                    
                    execute(cur, """
                        UPDATE volunteer_inventory
                        SET food_qty = food_qty - ?, water_qty = water_qty - ?, medical_qty = medical_qty - ?
                        WHERE volunteer_id = ?
                    """, (req_food, req_water, req_med, vid))
                    
                    if central:
                        execute(cur, """
                            UPDATE inventory_stock
                            SET food_qty = food_qty + ?, water_qty = water_qty + ?, medical_qty = medical_qty + ?
                            WHERE id = ?
                        """, (req_food, req_water, req_med, central['id']))
                    else:
                        # Create central if not exists
                        execute(cur, """
                            INSERT INTO inventory_stock (warehouse_name, food_qty, water_qty, medical_qty)
                            VALUES ('Gorakhpur Central Base', ?, ?, ?)
                        """, (req_food, req_water, req_med))
                
            # Update request status
            execute(cur, "UPDATE inventory_requests SET status=? WHERE id=?", (new_status, req_id))
            
            conn.commit()
            return {"vid": req['from_volunteer_id'], "status": new_status, "type": req['type']}
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            release_db_connection(conn)
