"""
citizen_auth_routes.py — Unified Citizen Auth API
Serves both desktop web and mobile app on the same /api/v2/auth/ prefix.

Endpoints:
  POST  /api/v2/auth/register      — start registration (sends OTP)
  POST  /api/v2/auth/verify-otp    — verify OTP, commit citizen, return JWT
  POST  /api/v2/auth/login         — authenticate + return JWT
  POST  /api/v2/auth/refresh       — refresh access token
  POST  /api/v2/auth/logout        — client-side logout (clear tokens)
  GET   /api/v2/auth/profile       — get citizen profile (JWT required)
  PUT   /api/v2/auth/profile       — update citizen profile (JWT required)
  POST  /api/v2/auth/resend-otp    — resend OTP for pending registration
"""

from flask import Blueprint, jsonify, request
from flask_cors import CORS, cross_origin
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('citizen_auth', __name__)
CORS(auth_bp)


def _require_jwt():
    """
    Extracts and validates JWT from Authorization header.
    Returns (payload_dict, None) on success.
    Returns (None, error_response_tuple) on failure.
    """
    from services.citizen_auth_service import decode_token

    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None, (jsonify({'error': 'Authorization token required'}), 401)

    token = auth.split(' ', 1)[1]
    payload = decode_token(token)
    if not payload:
        return None, (jsonify({'error': 'Invalid or expired token'}), 401)

    if payload.get('type') == 'refresh':
        return None, (jsonify({'error': 'Access token required, not refresh token'}), 401)

    return payload, None


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/register
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/register', methods=['POST', 'OPTIONS'])
@cross_origin()
def register():
    """
    Start registration flow.
    Body: { "full_name", "email", "password", "phone"?, "device_type"? }
    Returns: { "status": "otp_sent", "message": "..." }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data        = request.json or {}
    full_name   = (data.get('full_name') or data.get('name') or '').strip()
    email       = (data.get('email') or '').strip().lower()
    password    = (data.get('password') or '').strip()
    phone       = (data.get('phone') or '').strip()
    device_type = (data.get('device_type') or 'unknown').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        from services.citizen_auth_service import CitizenAuthService
        result = CitizenAuthService.start_registration(email, password, full_name, phone, device_type)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 409
    except Exception as e:
        logger.exception(f"Register error: {e}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/verify-otp
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/verify-otp', methods=['POST', 'OPTIONS'])
@cross_origin()
def verify_otp():
    """
    Verify OTP and commit citizen account to database.
    Body: { "email", "otp_code", "device_type"? }
    Returns: { "status": "ok", "id", "name", "email", "access_token", "refresh_token", ... }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data        = request.json or {}
    email       = (data.get('email') or '').strip().lower()
    otp_code    = (data.get('otp_code') or data.get('otp') or '').strip()
    device_type = (data.get('device_type') or 'unknown').strip()

    if not email or not otp_code:
        return jsonify({'error': 'Email and OTP code are required'}), 400

    try:
        from services.citizen_auth_service import CitizenAuthService
        result = CitizenAuthService.verify_otp_and_commit(email, otp_code, device_type)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception(f"OTP verify error: {e}")
        return jsonify({'error': 'Verification failed. Please try again.'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/login
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/login', methods=['POST', 'OPTIONS'])
@cross_origin()
def login():
    """
    Authenticate citizen. Works for desktop and mobile.
    Body: { "email", "password", "device_type"?, "device_id"? }
    Returns: full citizen profile + JWT tokens
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data        = request.json or {}
    email       = (data.get('email') or '').strip().lower()
    password    = (data.get('password') or '').strip()
    device_type = (data.get('device_type') or 'unknown').strip()
    device_id   = (data.get('device_id') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    try:
        from services.citizen_auth_service import CitizenAuthService
        result = CitizenAuthService.login(email, password, device_type, device_id)
        return jsonify(result), 200
    except PermissionError as e:
        return jsonify({'error': str(e)}), 429   # Too Many Requests
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        logger.exception(f"Login error: {e}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/refresh
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/refresh', methods=['POST', 'OPTIONS'])
@cross_origin()
def refresh_token():
    """
    Exchange refresh token for a new access token.
    Body: { "refresh_token" }
    Returns: { "access_token", "expires_in" }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data          = request.json or {}
    refresh_token = (data.get('refresh_token') or '').strip()

    if not refresh_token:
        return jsonify({'error': 'refresh_token is required'}), 400

    from services.citizen_auth_service import decode_token, generate_tokens

    payload = decode_token(refresh_token)
    if not payload or payload.get('type') != 'refresh':
        return jsonify({'error': 'Invalid or expired refresh token'}), 401

    tokens = generate_tokens(int(payload['sub']), payload['email'], payload.get('device', 'unknown'))
    return jsonify({
        'access_token': tokens['access_token'],
        'expires_in': tokens['expires_in'],
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v2/auth/profile
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/profile', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_profile():
    """
    Get citizen profile. Requires Bearer JWT.
    Returns: full citizen profile dict
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    payload, err = _require_jwt()
    if err:
        return err

    try:
        from services.citizen_auth_service import CitizenAuthService
        profile = CitizenAuthService.get_profile(int(payload['sub']))
        if not profile:
            return jsonify({'error': 'Citizen not found'}), 404
        profile['role'] = 'citizen'
        return jsonify(profile), 200
    except Exception as e:
        logger.exception(f"Profile fetch error: {e}")
        return jsonify({'error': 'Could not fetch profile'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# PUT /api/v2/auth/profile
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/profile', methods=['PUT', 'OPTIONS'])
@cross_origin()
def update_profile():
    """
    Update citizen profile fields (name, phone, emergency_mode).
    Requires Bearer JWT.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    payload, err = _require_jwt()
    if err:
        return err

    data           = request.json or {}
    citizen_id     = int(payload['sub'])
    name           = data.get('name')
    phone          = data.get('phone')
    emergency_mode = data.get('emergency_mode')

    from db import get_db_connection, execute, release_db_connection

    updates = []
    params  = []
    if name is not None:
        updates.append('name = ?')
        params.append(name.strip())
    if phone is not None:
        updates.append('phone = ?')
        params.append(phone.strip())
    if emergency_mode is not None:
        updates.append('emergency_mode = ?')
        params.append(bool(emergency_mode))

    if not updates:
        return jsonify({'error': 'No fields to update'}), 400

    params.append(citizen_id)
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        execute(cur, f"UPDATE citizens SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    finally:
        cur.close()
        release_db_connection(conn)

    # Broadcast profile update to all citizen devices via Socket.IO
    try:
        from app import socketio
        socketio.emit('citizen_sync', {
            'type': 'profile_update',
            'citizen_id': citizen_id,
            'email': payload['email'],
            'name': name,
            'phone': phone,
            'emergency_mode': emergency_mode,
        }, room=f"citizen:{payload['email']}")
    except Exception:
        pass

    return jsonify({'status': 'ok', 'message': 'Profile updated'}), 200


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/resend-otp
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/resend-otp', methods=['POST', 'OPTIONS'])
@cross_origin()
def resend_otp():
    """
    Resend OTP for pending registration.
    Body: { "email" }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data  = request.json or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    try:
        from services.citizen_auth_service import CitizenAuthService
        result = CitizenAuthService.resend_otp(email)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception(f"Resend OTP error: {e}")
        return jsonify({'error': 'Could not resend OTP'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/forgot-password
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/forgot-password', methods=['POST', 'OPTIONS'])
@cross_origin()
def forgot_password():
    """
    Start password recovery flow.
    Body: { "email" }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data  = request.json or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    try:
        from services.citizen_auth_service import CitizenAuthService
        result = CitizenAuthService.start_password_reset(email)
        return jsonify(result), 200
    except Exception as e:
        logger.exception(f"Forgot password error: {e}")
        return jsonify({'error': 'Could not start password recovery'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/reset-password
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/reset-password', methods=['POST', 'OPTIONS'])
@cross_origin()
def reset_password():
    """
    Complete password recovery flow.
    Body: { "email", "otp_code", "new_password" }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data         = request.json or {}
    email        = (data.get('email') or '').strip().lower()
    otp_code     = (data.get('otp_code') or data.get('otp') or '').strip()
    new_password = (data.get('new_password') or data.get('password') or '').strip()

    if not email or not otp_code or not new_password:
        return jsonify({'error': 'Email, OTP, and new password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        from services.citizen_auth_service import CitizenAuthService
        result = CitizenAuthService.commit_password_reset(email, otp_code, new_password)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception(f"Reset password error: {e}")
        return jsonify({'error': 'Could not reset password'}), 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v2/auth/logout
# ─────────────────────────────────────────────────────────────────────────────
@auth_bp.route('/auth/logout', methods=['POST', 'OPTIONS'])
@cross_origin()
def logout():
    """
    Client-side logout. Returns success — client must clear stored tokens.
    Also emits a socket disconnect signal to the citizen room.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    payload, _ = _require_jwt()  # Best-effort — don't block if token expired
    if payload:
        email = payload.get('email', '')
        try:
            from app import socketio
            socketio.emit('citizen_logout', {'email': email}, room=f"citizen:{email}")
        except Exception:
            pass

    return jsonify({'status': 'ok', 'message': 'Logged out successfully'}), 200
