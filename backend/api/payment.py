"""
payment.py — Admin-controlled Payment Configuration API
Endpoints:
  GET  /api/payment/config  — Return current payment config (for citizens/mobile)
  POST /api/payment/config  — Admin updates config (with optional QR image upload)
"""

import os
import uuid
import sqlite3
from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

payment_bp = Blueprint('payment', __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMG = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'}


# ─── DB HELPERS ───────────────────────────────────────────────────────────────

def _get_db_path():
    base = os.path.dirname(os.path.abspath(__file__))  # api/
    return os.path.join(base, '..', 'disaster_local.db')


def _get_conn():
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _ensure_table():
    """Create payment_config table if it doesn't exist."""
    try:
        conn = _get_conn()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS payment_config (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                upi_id        TEXT    DEFAULT '',
                qr_image_url  TEXT    DEFAULT '',
                account_name  TEXT    DEFAULT '',
                account_number TEXT   DEFAULT '',
                ifsc          TEXT    DEFAULT '',
                bank_name     TEXT    DEFAULT '',
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS payment_requests (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT,
                donor_name    TEXT,
                amount        REAL,
                category      TEXT,
                proof_url     TEXT,
                status        TEXT DEFAULT 'pending',
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Seed a blank row if the table is empty so GET always has data
        cur = conn.execute("SELECT COUNT(*) FROM payment_config")
        if cur.fetchone()[0] == 0:
            conn.execute("""
                INSERT INTO payment_config (upi_id, qr_image_url, account_name, account_number, ifsc, bank_name)
                VALUES ('', '', '', '', '', '')
            """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[payment] Table setup warning: {e}")


_ensure_table()


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@payment_bp.route('/config', methods=['GET'])
@cross_origin()
def get_payment_config():
    """Return the current admin-set payment configuration."""
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT * FROM payment_config ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({}), 200
        data = dict(row)
        # Build the full URL for the QR image so clients can embed it directly
        if data.get('qr_image_url') and not data['qr_image_url'].startswith('http'):
            data['qr_image_url_full'] = f"/api/v2/uploads/{data['qr_image_url']}"
        else:
            data['qr_image_url_full'] = data.get('qr_image_url', '')
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payment_bp.route('/config', methods=['POST'])
@cross_origin()
def update_payment_config():
    """Admin updates payment configuration. Accepts multipart/form-data or JSON."""
    try:
        # Support both multipart (with file) and JSON
        if request.content_type and 'multipart' in request.content_type:
            upi_id         = request.form.get('upi_id', '')
            account_name   = request.form.get('account_name', '')
            account_number = request.form.get('account_number', '')
            ifsc           = request.form.get('ifsc', '')
            bank_name      = request.form.get('bank_name', '')
        else:
            body           = request.get_json(force=True) or {}
            upi_id         = body.get('upi_id', '')
            account_name   = body.get('account_name', '')
            account_number = body.get('account_number', '')
            ifsc           = body.get('ifsc', '')
            bank_name      = body.get('bank_name', '')

        # Handle optional QR image upload
        qr_image_url = ''
        qr_file = request.files.get('qr_image')
        remove_qr = request.form.get('remove_qr') == 'true'

        if qr_file and qr_file.filename and not remove_qr:
            ext = qr_file.filename.rsplit('.', 1)[-1].lower()
            if ext not in ALLOWED_IMG:
                return jsonify({"error": "Invalid image type. Use PNG, JPG, or WebP."}), 400
            fname = f"qr_{uuid.uuid4().hex}.{ext}"
            qr_file.save(os.path.join(UPLOAD_DIR, fname))
            qr_image_url = fname  # stored as filename; full URL built in GET
        elif request.content_type and 'multipart' not in request.content_type:
            # JSON path: accept a pre-existing URL string in qr_image_url field
            body = request.get_json(force=True) or {}
            qr_image_url = body.get('qr_image_url', '')

        conn = _get_conn()
        cur = conn.execute("SELECT id FROM payment_config ORDER BY id DESC LIMIT 1")
        existing = cur.fetchone()

        if existing:
            # Check for remove_qr flag first to nullify
            if remove_qr:
                conn.execute("""
                    UPDATE payment_config
                    SET upi_id=?, account_name=?, account_number=?, ifsc=?, bank_name=?,
                        qr_image_url='', updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                """, (upi_id, account_name, account_number, ifsc, bank_name, existing['id']))
            elif qr_image_url:
                conn.execute("""
                    UPDATE payment_config
                    SET upi_id=?, account_name=?, account_number=?, ifsc=?, bank_name=?,
                        qr_image_url=?, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                """, (upi_id, account_name, account_number, ifsc, bank_name, qr_image_url, existing['id']))
            else:
                conn.execute("""
                    UPDATE payment_config
                    SET upi_id=?, account_name=?, account_number=?, ifsc=?, bank_name=?,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                """, (upi_id, account_name, account_number, ifsc, bank_name, existing['id']))
        else:
            conn.execute("""
                INSERT INTO payment_config (upi_id, qr_image_url, account_name, account_number, ifsc, bank_name)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (upi_id, qr_image_url, account_name, account_number, ifsc, bank_name))

        conn.commit()
        conn.close()

        return jsonify({"status": "success", "message": "Payment configuration updated."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── PAYMENT APPROVAL FLOW ────────────────────────────────────────────────────

@payment_bp.route('/request', methods=['POST'])
@cross_origin()
def create_payment_request():
    """Citizen submits a payment proof for approval."""
    try:
        data = request.json or {}
        user_id = data.get('user_id', 'citizen')
        donor_name = data.get('donor_name', 'Anonymous')
        amount = float(data.get('amount', 0))
        category = data.get('category', 'General Relief')
        proof_url = data.get('proof_url', '')

        conn = _get_conn()
        cur = conn.execute("""
            INSERT INTO payment_requests (user_id, donor_name, amount, category, proof_url, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        """, (user_id, donor_name, amount, category, proof_url))
        req_id = cur.lastrowid
        conn.commit()
        conn.close()

        return jsonify({"status": "success", "message": "Payment submitted, waiting for admin approval", "id": req_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payment_bp.route('/all', methods=['GET'])
@cross_origin()
def get_all_requests():
    """Admin fetches all payment requests."""
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT * FROM payment_requests ORDER BY created_at DESC")
        rows = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payment_bp.route('/user/<string:user_id>', methods=['GET'])
@cross_origin()
def get_user_requests(user_id):
    """Fetch payment requests for a specific citizen."""
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT * FROM payment_requests WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        rows = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payment_bp.route('/approve/<int:req_id>', methods=['POST'])
@cross_origin()
def approve_payment(req_id):
    """Admin approves a payment, converting it into an active donation ledger entry."""
    try:
        conn = _get_conn()
        
        # 1. Get request
        cur = conn.execute("SELECT * FROM payment_requests WHERE id = ?", (req_id,))
        req = cur.fetchone()
        if not req:
            conn.close()
            return jsonify({"error": "Request not found"}), 404
        
        # 2. Update status
        conn.execute("UPDATE payment_requests SET status = 'approved' WHERE id = ?", (req_id,))
        
        # 3. Add to live donations table if it wasn't already approved
        if req['status'] != 'approved':
            conn.execute("""
                INSERT INTO donations (donor_name, amount, category)
                VALUES (?, ?, ?)
            """, (req['donor_name'], req['amount'], req['category']))

        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Payment received ✅"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@payment_bp.route('/reject/<int:req_id>', methods=['POST'])
@cross_origin()
def reject_payment(req_id):
    """Admin rejects a payment proof."""
    try:
        conn = _get_conn()
        conn.execute("UPDATE payment_requests SET status = 'rejected' WHERE id = ?", (req_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Verification failed ❌"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
