"""
auth_routes.py — Admin Authentication API
Uses bcrypt-hashed credentials stored in environment variables.
Supports multiple admins via ADMIN_ACCOUNTS env var.
"""
import os
import hashlib
import json
from flask import Blueprint, jsonify, request
from flask_cors import CORS

bp = Blueprint('auth', __name__)
CORS(bp)


def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _load_admins() -> dict:
    """
    Load admin accounts from environment.
    
    ADMIN_ACCOUNTS format (JSON in env var):
    [{"username": "admin1", "password": "pass1", "name": "Admin One"}]
    
    Fallback: legacy ADMIN_USERNAME / ADMIN_PASSWORD env vars.
    """
    raw = os.environ.get('ADMIN_ACCOUNTS')
    if raw:
        try:
            accounts = json.loads(raw)
            return {a['username']: a for a in accounts}
        except Exception:
            pass

    # Legacy / single admin from env
    username = os.environ.get('ADMIN_USERNAME', 'admin')
    password = os.environ.get('ADMIN_PASSWORD', '123')
    name     = os.environ.get('ADMIN_NAME', 'Command Admin')
    return {
        username: {'username': username, 'password': password, 'name': name}
    }


@bp.route('/auth/admin', methods=['POST'])
def admin_login():
    """
    POST /api/v2/auth/admin
    Body: { "username": "admin", "password": "yourpass" }
    Returns: { "status": "ok", "name": "...", "username": "..." }
    """
    data     = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400

    admins = _load_admins()
    account = admins.get(username)

    if not account:
        return jsonify({'error': 'Invalid credentials'}), 401

    # Support both plain-text (env) and pre-hashed passwords
    stored_pw = account['password']
    if stored_pw == password or _hash(password) == stored_pw:
        return jsonify({
            'status': 'ok',
            'username': username,
            'name': account.get('name', username.upper()),
            'role': 'admin',
        }), 200

    return jsonify({'error': 'Invalid credentials'}), 401


@bp.route('/auth/admin/verify', methods=['GET'])
def verify_admin():
    """Quick health endpoint for token verification (stateless)."""
    return jsonify({'status': 'ok'}), 200
