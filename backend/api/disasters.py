"""
disasters.py — Disaster Intelligence API Blueprint
Supports both SQLite (local dev) and PostgreSQL (production).
DB connection is provided by db.py unified layer.
"""

import os
import uuid
import requests
import base64
from flask import Blueprint, jsonify, request, send_from_directory
from flask_cors import CORS, cross_origin
import logging
logger = logging.getLogger(__name__)
from werkzeug.utils import secure_filename

# ─── Unified DB Layer ───
from db import get_db_connection, adapt_sql, rows_to_dicts, row_to_dict as db_row_to_dict, IS_POSTGRES, execute, insert_and_get_id

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXT = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mkv'}

bp = Blueprint('disasters', __name__)
CORS(bp)


# ─── SCHEMA MANAGEMENT ───
# Delegated to unified db.py layer (db.ensure_tables)
def row_to_dict(row): return db_row_to_dict(row)
def rows_to_list(rows): return rows_to_dicts(rows)


# ─── OPERATIONAL DATA ───

@bp.route('/activity', methods=['GET'])
def get_activity():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, """
            SELECT 'donation' as type, donor_name as title,
                   ('Contributed ₹' || CAST(amount AS TEXT)) as detail,
                   '#e8630a' as color, created_at as time, 'DONATION' as status
            FROM donations
            UNION ALL
            SELECT 'victim' as type, disaster_type as title, description as detail,
                   CASE WHEN status = 'RESOLVED' THEN '#10b981' ELSE '#f43f5e' END as color,
                   created_at as time, status
            FROM disaster_events
            ORDER BY time DESC LIMIT 15
        """)
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/donations/top', methods=['GET'])
def get_top_donors():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, """
            SELECT donor_name as name, SUM(amount) as amount,
                   (SELECT COUNT(*) FROM donation_likes WHERE donor_name = donations.donor_name) as hearts
            FROM donations
            GROUP BY donor_name
            ORDER BY amount DESC LIMIT 10
        """)
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/donations', methods=['GET'])
def get_donations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT donor_name, amount, category, created_at FROM donations ORDER BY created_at DESC LIMIT 50")
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/donations/like', methods=['POST'])
def like_donor():
    try:
        data = request.json or {}
        email = data.get("email")
        name = data.get("donor_name")
        conn = get_db_connection()
        cur = conn.cursor()
        sql = "INSERT INTO donation_likes (user_email, donor_name) VALUES (?, ?) ON CONFLICT DO NOTHING" if IS_POSTGRES else "INSERT OR IGNORE INTO donation_likes (user_email, donor_name) VALUES (?, ?)"
        execute(cur, sql, (email, name))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/supplies', methods=['GET'])
def get_supplies():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM relief_supplies")
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/donations', methods=['POST'])
@cross_origin()
def post_donation():
    try:
        data = request.json or {}
        name = data.get("donor_name", "Anonymous")
        amount = float(data.get("amount", 0))
        cat = data.get("category", "General Relief")
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO donations (donor_name, amount, category) VALUES (?, ?, ?)",
            (name, amount, cat)
        )
        conn.commit()
        cur.close()
        conn.close()

        # Real-time broadcast (optional, no crash if fails)
        try:
            from app import socketio
            socketio.emit('new_donation_event', {"donor_name": name, "amount": amount, "category": cat})
        except Exception:
            pass

        return jsonify({"status": "success"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


# ─── PRETRAINED AI MODULES ───

def analyze_disaster(description, people):
    """Fallback Rule-Based logic for severity extraction"""
    score = 0
    if people > 10: score += 4
    elif people > 5: score += 3
    else: score += 1
        
    desc_clean = description.lower()
    if "trapped" in desc_clean: score += 3
    if "medical" in desc_clean: score += 2
        
    if score >= 7: return "CRITICAL", score
    elif score >= 5: return "HIGH", score
    elif score >= 3: return "MEDIUM", score
    else: return "LOW", score

def analyze_incident_image(image_filename, manual_desc, people_count):
    """Hits OpenAI Vision API to extract visual intelligence. Falls back to manual desc rules if no key."""
    def fallback():
        sev_level, sev_score = analyze_disaster(manual_desc, people_count)
        return {
            "scene_description": "No visual intelligence available. Defaulting to manual textual analysis.",
            "disaster_type": "Unknown",
            "confidence_score": 0.0,
            "severity_level": sev_level,
            "severity_score": sev_score,
            "ai_verified": 0
        }

    if not image_filename: return fallback()
    
    image_path = os.path.join(UPLOAD_DIR, image_filename)
    if not os.path.exists(image_path): return fallback()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("[AI] OPENAI_API_KEY not found. Using fallback heuristics.")
        return fallback()

    try:
        with open(image_path, "rb") as bf:
            b64_img = base64.b64encode(bf.read()).decode('utf-8')
        
        prompt = f"""
        You are an advanced emergency operations incident analyzer. 
        Analyze this image uploaded by a citizen in distress.
        They manually described it as: "{manual_desc}" and claimed {people_count} are affected/trapped.
        
        Return ONLY a JSON object evaluating the image and context:
        {{
           "scene_description": "A detailed 2-3 sentence visual summary of what the image actually depicts and if it seems plausible.",
           "disaster_type": "Classified Type (e.g. Flood, Fire, Medical, Conflict, Fake)",
           "confidence_score": <float between 0.0 and 1.0 indicating if this looks like a genuine real disaster photo vs a stock or fabricated photo>,
           "severity_level": "<CRITICAL, HIGH, MEDIUM, LOW>",
           "severity_score": <integer 1 to 10>
        }}
        """

        payload = {
            "model": "gpt-4o-mini",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                ]
            }],
            "response_format": {"type": "json_object"}
        }

        resp = requests.post("https://api.openai.com/v1/chat/completions", 
                             headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, 
                             json=payload, timeout=12)
        resp.raise_for_status()

        import json
        content = resp.json()['choices'][0]['message']['content']
        ai_data = json.loads(content)
        
        # Determine verified status based on confidence
        ai_data['ai_verified'] = 1 if ai_data.get('confidence_score', 0) > 0.6 else 0
        return ai_data
    except Exception as e:
        print(f"[AI API ERROR] {e}")
        return fallback()

# ─── CORE POSTERS ───

@bp.route('/report', methods=['POST'])
@cross_origin()
def submit_report():
    try:
        # Form Data processing (Live Web Request)
        if request.content_type and 'multipart' in request.content_type:
            dtype   = request.form.get('disaster_type', 'Other')
            desc    = request.form.get('description', '')
            lat     = float(request.form.get('lat', 26.7606))
            lon     = float(request.form.get('lng', 83.3732)) 
            ppl     = int(request.form.get('people_count', 0))
            name    = request.form.get('name', 'Anonymous')
            phone   = request.form.get('phone', 'Unknown')
            
            image_url = ""
            file = request.files.get('evidence_file')
            if file and file.filename:
                ext = file.filename.rsplit('.', 1)[-1].lower()
                fname = f"SOS_{uuid.uuid4().hex[:8]}.{ext}"
                file.save(os.path.join(UPLOAD_DIR, fname))
                image_url = fname
        else:
            # JSON Fallback processing (Legacy/Mobile)
            data  = request.json or {}
            dtype = data.get('disaster_type', 'Other')
            desc  = data.get('description', '')
            lat   = float(data.get('lat', 26.7606))
            lon   = float(data.get('lon', data.get('lng', 83.3732)))
            ppl   = int(data.get('people_count', 0))
            name  = data.get('name', 'Anonymous')
            phone = data.get('phone', 'Unknown')
            image_url = data.get('evidence', '')
            if image_url in ('None', 'No photo attached'): image_url = ""

        # Legacy UI Fallback Score calculation 
        legacy_sev = 5.0
        if ppl > 0: legacy_sev += min(ppl * 0.5, 4.0)
        if dtype in ['Fire', 'Earthquake']: legacy_sev += 1.0
        legacy_sev = min(legacy_sev, 10.0)

        full_desc = f"{desc}\n\n[REPORTER]: {name} | [CONTACT]: {phone} | [TRAPPED]: {ppl}"
        
        # New Feature Executions
        ai_analysis = analyze_incident_image(image_url, desc, ppl)
        
        ai_verif  = ai_analysis.get('ai_verified', 0)
        ai_conf   = float(ai_analysis.get('confidence_score', 0.0))
        sev_level = ai_analysis.get('severity_level', 'LOW')
        sev_score = int(ai_analysis.get('severity_score', 0))
        ai_desc   = ai_analysis.get('scene_description', '')

        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            """INSERT INTO disaster_events (
                 disaster_type, lat, lon, description, severity, status,
                 ai_verified, ai_confidence, severity_level, severity_score, image_url, ai_description
               ) VALUES (?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?)""",
            (dtype, lat, lon, full_desc, legacy_sev, int(ai_verif), ai_conf, sev_level, sev_score, image_url, ai_desc)
        )
        conn.commit()
        cur.close()
        conn.close()

        try:
            from services.activity_service import ActivityService
            ActivityService.log_event('SOS', f"New SOS Request received from {name}")
        except Exception as e:
            pass


        return jsonify({"status": "success"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


# ─── CORE GETTERS ───

@bp.route('/disasters', methods=['GET'])
def get_disasters():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "SELECT id, disaster_type as type, lat, lon, description, severity as priority, status, created_at, assigned_volunteer_id, ai_verified, ai_confidence, severity_level, severity_score, image_url, ai_description FROM disaster_events ORDER BY created_at DESC"
        )
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/disasters/<int:id>/status', methods=['POST'])
def update_disaster_status(id):
    try:
        data = request.json or {}
        new_status = data.get('status', 'VERIFIED')
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "UPDATE disaster_events SET status = ? WHERE id = ?", (new_status, id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "updated"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/auth', methods=['POST'])
def auth_volunteer():
    try:
        data = request.json or {}
        name = (data.get('name') or '').strip()
        code = (data.get('access_code') or '').strip()
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "SELECT * FROM volunteers WHERE LOWER(name) = LOWER(?) AND (access_code = ? OR access_code IS NULL OR access_code = '')",
            (name, code)
        )
        vol = row_to_dict(cur.fetchone())
        cur.close()
        conn.close()
        if not vol:
            return jsonify({"error": "Invalid name or access code"}), 401
        return jsonify(vol), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers', methods=['GET'])
def get_volunteers():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM volunteers ORDER BY created_at DESC")
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers', methods=['POST'])
def add_volunteer():
    try:
        data = request.json or {}
        name = data.get("name")
        skills = data.get("skills", "General")
        lat = data.get("lat", 0)
        lon = data.get("lon", 0)
        access_code = data.get("access_code", "")
        phone = data.get("phone", "")
        org_name = data.get("organization_name", "")
        org_type = data.get("organization_type", "NGO")
        
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO volunteers (name, skills, status, access_code, lat, lon, phone, organization_name, organization_type) VALUES (?, ?, 'AVAILABLE', ?, ?, ?, ?, ?, ?)",
            (name, skills, access_code, lat, lon, phone, org_name, org_type)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteer/location', methods=['POST'])
def update_volunteer_location():
    try:
        data = request.json or {}
        vid = data.get('volunteer_id')
        lat = data.get('lat')
        lng = data.get('lng')
        if not vid or lat is None or lng is None:
            return jsonify({"error": "Missing params"}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "UPDATE volunteers SET lat = ?, lon = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", (lat, lng, vid))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "updated"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/admin/team/map', methods=['GET'])
def get_team_map():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, """
            SELECT id, name, phone, lat, lon as lng, organization_name, organization_type, status, last_updated, last_updated as lastSeen, is_online as isOnline 
            FROM volunteers 
            ORDER BY name ASC
        """)
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/<int:id>', methods=['GET'])
def get_volunteer(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM volunteers WHERE id = ?", (id,))
        vol = row_to_dict(cur.fetchone())
        if not vol:
            cur.close()
            conn.close()
            return jsonify({"error": "Not found"}), 404
        execute(cur,
            "SELECT id, disaster_type as type, lat, lon, description, severity, status, created_at FROM disaster_events WHERE assigned_volunteer_id = ? ORDER BY created_at DESC",
            (id,)
        )
        vol['missions'] = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(vol), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/<int:id>', methods=['DELETE'])
def delete_volunteer(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "DELETE FROM volunteers WHERE id = ?", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/<int:id>/messages', methods=['GET'])
def get_volunteer_messages(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM volunteer_messages WHERE volunteer_id = ? ORDER BY created_at ASC", (id,))
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/<int:id>/messages', methods=['POST'])
def send_volunteer_message(id):
    try:
        data = request.json or {}
        msg = data.get("message", "")
        sender = data.get("sender", "admin")
        mission_id = data.get("mission_id", None)
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO volunteer_messages (volunteer_id, mission_id, sender, message) VALUES (?, ?, ?, ?)",
            (id, mission_id, sender, msg)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "sent"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/<int:id>/proofs', methods=['GET'])
def get_proofs(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM volunteer_proofs WHERE volunteer_id = ? ORDER BY created_at DESC", (id,))
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/volunteers/<int:id>/proofs', methods=['POST'])
def upload_proof(id):
    try:
        file = request.files.get('file')
        severity = request.form.get('severity', 'medium')
        caption = request.form.get('caption', '')
        mission_id = request.form.get('mission_id', None)
        if not file or not file.filename:
            return jsonify({"error": "No file"}), 400
        ext = file.filename.rsplit('.', 1)[-1].lower()
        if ext not in ALLOWED_EXT:
            return jsonify({"error": "File type not allowed"}), 400
        fname = f"{uuid.uuid4().hex}.{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        file.save(fpath)
        file_type = 'video' if ext in {'mp4', 'mov', 'avi', 'mkv'} else 'image'
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO volunteer_proofs (volunteer_id, mission_id, filename, original_name, file_type, severity, caption) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (id, mission_id, fname, secure_filename(file.filename), file_type, severity, caption)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "uploaded", "filename": fname, "url": f"/api/v2/uploads/{fname}"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/uploads/<filename>', methods=['GET'])
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@bp.route('/disasters/<int:disaster_id>/resolve', methods=['POST'])
def resolve_disaster(disaster_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT assigned_volunteer_id FROM disaster_events WHERE id = ?", (disaster_id,))
        row = row_to_dict(cur.fetchone())
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": "Not found"}), 404
        vol_id = row['assigned_volunteer_id']
        execute(cur, "UPDATE disaster_events SET status = 'RESOLVED' WHERE id = ?", (disaster_id,))
        if vol_id:
            execute(cur,
                "SELECT COUNT(*) as cnt FROM disaster_events WHERE assigned_volunteer_id = ? AND status = 'DISPATCHED'",
                (vol_id,)
            )
            row_cnt = row_to_dict(cur.fetchone())
            remaining = row_cnt['cnt'] if row_cnt else 0
            if remaining == 0:
                execute(cur, "UPDATE volunteers SET status = 'AVAILABLE' WHERE id = ?", (vol_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "resolved"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


# ─── DISPATCH & MISSIONS ───

@bp.route('/dispatch', methods=['POST'])
def dispatch_volunteer():
    try:
        data = request.json or {}
        v_id = data.get("volunteer_id")
        r_ids = data.get("report_ids", [])
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "UPDATE volunteers SET status = 'ON_MISSION' WHERE id = ?", (v_id,))
        for r_id in r_ids:
            execute(cur,
                "UPDATE disaster_events SET status = 'DISPATCHED', assigned_volunteer_id = ? WHERE id = ?",
                (v_id, r_id)
            )
        conn.commit()
        cur.close()
        conn.close()
        
        try:
            from services.inventory_service import InventoryService
            InventoryService.process_dispatch()
            from services.activity_service import ActivityService
            ActivityService.log_event('DISPATCH', f"Task Force dispatched for Volunteer ID {v_id}. Resources utilized.")
        except Exception as e:
            pass

        return jsonify({"status": "success"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/missions/complete', methods=['POST'])
def complete_mission():
    try:
        data = request.json or {}
        v_id = data.get("volunteer_id")
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "UPDATE volunteers SET status = 'AVAILABLE' WHERE id = ?", (v_id,))
        execute(cur, "UPDATE disaster_events SET status = 'RESOLVED' WHERE assigned_volunteer_id = ?", (v_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        try:
            from services.activity_service import ActivityService
            ActivityService.log_event('DELIVERY', f"Mission Complete by personnel V-{v_id}. Relief delivered safely.")
        except Exception as e:
            pass

        return jsonify({"status": "success"}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500



# ─── CITIZEN AUTH (LEGACY - REMOVED FOR SECURITY) ───
# All citizen auth is now handled by /api/v2/auth/* routes in citizen_auth_routes.py


# ─── GLOBAL BROADCAST ───

@bp.route('/broadcast', methods=['POST'])
def post_broadcast():
    try:
        msg = request.json.get("message", "").strip()
        if not msg:
            return jsonify({"error": "message is required"}), 400
        conn = get_db_connection()
        cur = conn.cursor()
        # Insert new broadcast — active column is BOOLEAN in PostgreSQL, use TRUE
        execute(cur, "INSERT INTO broadcasts (message) VALUES (?)", (msg,))
        conn.commit()
        cur.close()
        conn.close()
        try:
            from app import socketio
            socketio.emit('global_broadcast', {"message": msg})
        except Exception:
            pass
        return jsonify({"status": "success"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/broadcast/latest', methods=['GET'])
def get_latest_broadcast():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Simply grab the most recently inserted broadcast — no active filter needed
        execute(cur, "SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 1")
        row = row_to_dict(cur.fetchone())
        cur.close()
        conn.close()
        return jsonify(row if row else {}), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/shelters', methods=['GET'])
def get_shelters():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur, "SELECT * FROM shelters")
        rows = rows_to_list(cur.fetchall())
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


# ─── MOBILE OFFLINE-FIRST API ENDPOINTS ───

@bp.route('/mobile/sos', methods=['POST'])
@cross_origin()
def mobile_sos():
    try:
        data = request.json or {}
        dtype = data.get('disaster_type') or data.get('type', 'SOS')
        desc = data.get('description', '')
        lat = float(data.get('lat', 26.7606))
        lon = float(data.get('lng', 83.3732))
        ppl = int(data.get('people_count', 0))
        name = data.get('name', 'Anonymous')
        phone = data.get('phone', 'Citizen Device')
        evidence = data.get('evidence', 'None')
        timestamp = data.get('timestamp')

        severity = 5.0
        if ppl > 0:
            severity += min(ppl * 0.5, 4.0)
        if dtype in ['Fire', 'Earthquake', 'Medical']:
            severity += 1.0
        severity = min(severity, 10.0)

        full_desc = f"{desc}\n\n[MOBILE SOS]\n[REPORTER]: {name} | [CONTACT]: {phone} | [TRAPPED]: {ppl} | [EVIDENCE]: {evidence} | [TIME]: {timestamp}"

        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO disaster_events (disaster_type, lat, lon, description, severity, status) VALUES (?, ?, ?, ?, ?, 'NEW')",
            (dtype, lat, lon, full_desc, severity)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "synced": True}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/mobile/resource-request', methods=['POST'])
@cross_origin()
def mobile_resource_req():
    try:
        data = request.json or {}
        needs = data.get('needs', [])
        lat = float(data.get('lat', 26.7606))
        lon = float(data.get('lng', 83.3732))

        full_desc = f"[MOBILE RESOURCE REQ] | Needs: {', '.join(needs)}"

        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO disaster_events (disaster_type, lat, lon, description, severity, status) VALUES (?, ?, ?, ?, ?, 'NEW')",
            ('Resource Request', lat, lon, full_desc, 7.0)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/mobile/sync', methods=['POST'])
@cross_origin()
def mobile_sync():
    """Sync an offline queue of packets."""
    try:
        data = request.json or {}
        packets = data.get('packets', [])
        conn = get_db_connection()
        cur = conn.cursor()

        for p in packets:
            dtype = p.get('disaster_type') or p.get('type', 'Offline Sync')
            lat = float(p.get('lat', 26.7606))
            lon = float(p.get('lng', 83.3732))
            desc = p.get('description', '')
            ppl = int(p.get('people_count', 0))
            name = p.get('name', 'Anonymous')
            phone = p.get('phone', 'Citizen Device')
            evidence = p.get('evidence', 'None')

            severity = 5.0
            if ppl > 0:
                severity += min(ppl * 0.5, 4.0)
            if dtype in ['Fire', 'Earthquake', 'Medical']:
                severity += 1.0
            severity = min(severity, 10.0)

            full_desc = f"{desc}\n\n[OFFLINE SYNC DELAYED]\n[REPORTER]: {name} | [CONTACT]: {phone} | [TRAPPED]: {ppl} | [EVIDENCE]: {evidence} | [ORIG_TIME]: {p.get('timestamp')}"
            execute(cur,
                "INSERT INTO disaster_events (disaster_type, lat, lon, description, severity, status) VALUES (?, ?, ?, ?, ?, 'NEW')",
                (dtype, lat, lon, full_desc, severity)
            )

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "synced_count": len(packets)}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/mobile/sms-ingest', methods=['POST'])
@cross_origin()
def mobile_sms_ingest():
    """Ingest SMS format e.g. SOS#LAT:25.4#LON:81.8"""
    try:
        data = request.form or request.json or {}
        body = (data.get('Body', '') or '').strip() or (data.get('message', '') or '').strip()

        lat = 0.0
        lon = 0.0
        dtype = "SMS FALLBACK"
        if "#LAT:" in body and "#LON:" in body:
            try:
                parts = body.split('#')
                dtype = parts[0]
                lat = float(parts[1].split(':')[1])
                lon = float(parts[2].split(':')[1])
            except Exception:
                pass

        full_desc = f"[SMS INGESTION] | Raw: {body}"

        conn = get_db_connection()
        cur = conn.cursor()
        execute(cur,
            "INSERT INTO disaster_events (disaster_type, lat, lon, description, severity, status) VALUES (?, ?, ?, ?, ?, 'NEW')",
            (dtype, lat, lon, full_desc, 10.0)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "received": True}), 201
    except Exception as e:
        logger.exception(f"Route failed: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/ai-assistant', methods=['POST'])
@cross_origin()
def ai():
    try:
        msg = request.json.get("message", "")
        key = os.environ.get("GROQ_API_KEY")
        if not key:
            return jsonify({"error": "GROQ_API_KEY not configured.", "reply": "AI assistant temporarily unavailable."}), 500
            
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": msg}]},
            timeout=30
        )
        return jsonify({"reply": r.json()['choices'][0]['message']['content']})
    except Exception as e:
        return jsonify({"error": str(e), "reply": "AI assistant temporarily unavailable."}), 500
