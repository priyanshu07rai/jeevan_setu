"""
citizen_auth_service.py — Unified Citizen Identity Auth Service
Handles bcrypt hashing, JWT generation, OTP flow, and device tracking.
Used by both citizen_auth_routes.py and legacy citizen endpoints.
"""

import os
import random
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

load_dotenv()

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_FROM = os.environ.get("SMTP_FROM")

print("SMTP HOST:", SMTP_HOST)
print("SMTP USER:", SMTP_USER)
print("SMTP FROM:", SMTP_FROM)

import requests

def send_otp_email(to_email, otp):
    print("SEND OTP FUNCTION CALLED (VIA HTTP API)")
    subject = "Your OTP Verification Code"
    body = f"Your OTP is: {otp}"

    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": SMTP_PASS,
            "content-type": "application/json"
        }
        payload = {
            "sender": {"email": SMTP_FROM},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": f"<html><body><p><b>Your Jeevan Setu OTP is: {otp}</b></p></body></html>"
        }
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        if res.status_code in [200, 201, 202]:
            print("HTTP OTP SENT SUCCESSFULLY!")
            return True
        else:
            print(f"Brevo HTTP Error: {res.text}")
            return False
    except Exception as e:
        print("OTP FLOW ERROR:", str(e))
        return False

# ─── Lazy imports so the module loads even if packages are missing ───
_bcrypt  = None
_jwt     = None

def _get_bcrypt():
    global _bcrypt
    if _bcrypt is None:
        try:
            import bcrypt as _b
            _bcrypt = _b
        except ImportError:
            logger.warning("bcrypt not installed — falling back to SHA-256")
    return _bcrypt

def _get_jwt():
    global _jwt
    if _jwt is None:
        try:
            import jwt as _j
            _jwt = _j
        except ImportError:
            logger.warning("PyJWT not installed — JWT features disabled")
    return _jwt


# ─── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY      = os.environ.get('SECRET_KEY', 'dev-secret-key-12345')
JWT_ACCESS_EXP  = int(os.environ.get('JWT_ACCESS_MINUTES', 60 * 24))   # 24 h default
JWT_REFRESH_EXP = int(os.environ.get('JWT_REFRESH_DAYS', 7))
OTP_EXPIRY_MIN  = int(os.environ.get('OTP_EXPIRY_MINUTES', 10))
OTP_MAX_TRIES   = 5


# ─── In-memory OTP pending store (keyed by email) ─────────────────────────────
# Format: { email: { otp, expires_at, attempts, name, password_hash, phone } }
_pending_registrations: dict = {}

# ─── In-memory rate limiter (keyed by email) ──────────────────────────────────
# Format: { email: { count, window_start } }
_login_attempts: dict = {}
LOGIN_WINDOW_SECONDS = 15 * 60   # 15 minutes
LOGIN_MAX_ATTEMPTS   = 8


# ─── Password Utilities ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash with bcrypt; fall back to SHA-256 if bcrypt unavailable."""
    b = _get_bcrypt()
    if b:
        return b.hashpw(plain.encode(), b.gensalt()).decode()
    return hashlib.sha256(plain.encode()).hexdigest()


def verify_password(plain: str, stored: str) -> bool:
    """
    Verify password against stored hash.
    Supports: bcrypt hashes (starts with $2b$) AND legacy SHA-256 hex strings.
    """
    b = _get_bcrypt()
    if b and stored.startswith('$2b$'):
        try:
            return b.checkpw(plain.encode(), stored.encode())
        except Exception:
            return False
    # SHA-256 fallback (keeps existing citizen accounts working)
    return hashlib.sha256(plain.encode()).hexdigest() == stored


# ─── JWT Utilities ─────────────────────────────────────────────────────────────

def generate_tokens(citizen_id: int, email: str, device_type: str = 'unknown') -> dict:
    """Generate JWT access + refresh token pair."""
    jwt = _get_jwt()
    if not jwt:
        # Fallback: return an opaque token for legacy compatibility
        token = hashlib.sha256(f"{citizen_id}:{email}:{SECRET_KEY}".encode()).hexdigest()
        return {'access_token': token, 'refresh_token': token, 'token_type': 'bearer'}

    now = datetime.now(timezone.utc)

    access_payload = {
        'sub': str(citizen_id),
        'email': email,
        'role': 'citizen',
        'device': device_type,
        'type': 'access',
        'iat': now,
        'exp': now + timedelta(minutes=JWT_ACCESS_EXP),
    }
    refresh_payload = {
        'sub': str(citizen_id),
        'email': email,
        'role': 'citizen',
        'type': 'refresh',
        'iat': now,
        'exp': now + timedelta(days=JWT_REFRESH_EXP),
    }

    access_token  = jwt.encode(access_payload,  SECRET_KEY, algorithm='HS256')
    refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm='HS256')

    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer',
        'expires_in': JWT_ACCESS_EXP * 60,
    }


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload dict or None on failure."""
    jwt = _get_jwt()
    if not jwt:
        return None
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except Exception:
        return None


# ─── OTP Utilities ─────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Generate a 6-digit zero-padded OTP."""
    return str(random.randint(100000, 999999))


def _store_pending(email: str, otp: str, name: str, password_hash: str, phone: str):
    """Store pending registration with OTP in memory."""
    _pending_registrations[email] = {
        'otp': otp,
        'expires_at': datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MIN),
        'attempts': 0,
        'name': name,
        'password_hash': password_hash,
        'phone': phone,
    }


def get_pending(email: str) -> dict | None:
    """Retrieve pending registration data for email."""
    return _pending_registrations.get(email)


def clear_pending(email: str):
    """Remove pending registration after successful verification."""
    _pending_registrations.pop(email, None)


# ─── Rate Limiting ─────────────────────────────────────────────────────────────

def _check_rate_limit(email: str) -> tuple[bool, int]:
    """
    Returns (is_allowed, seconds_remaining).
    Returns (True, 0) if within limits.
    Returns (False, N) if rate limited for N more seconds.
    """
    now = datetime.now(timezone.utc)
    entry = _login_attempts.get(email)

    if not entry:
        _login_attempts[email] = {'count': 0, 'window_start': now}
        return True, 0

    elapsed = (now - entry['window_start']).total_seconds()
    if elapsed > LOGIN_WINDOW_SECONDS:
        # Reset window
        _login_attempts[email] = {'count': 0, 'window_start': now}
        return True, 0

    if entry['count'] >= LOGIN_MAX_ATTEMPTS:
        remaining = int(LOGIN_WINDOW_SECONDS - elapsed)
        return False, remaining

    return True, 0


def _record_login_attempt(email: str):
    if email in _login_attempts:
        _login_attempts[email]['count'] += 1
    else:
        _login_attempts[email] = {'count': 1, 'window_start': datetime.now(timezone.utc)}


def _reset_login_attempts(email: str):
    _login_attempts.pop(email, None)


# ─── Core Service Class ────────────────────────────────────────────────────────

class CitizenAuthService:

    @staticmethod
    def start_registration(email: str, password: str, name: str, phone: str = '', device_type: str = 'unknown') -> dict:
        """
        Phase 1 of registration: validate, hash password, generate OTP, send email.
        Returns {'status': 'otp_sent'} or raises ValueError.
        """
        from db import get_db_connection, execute, release_db_connection

        print("START REGISTRATION API HIT")
        print("EMAIL:", email)

        if not email or not password:
            raise ValueError('Email and password are required')
        if len(password) < 6:
            raise ValueError('Password must be at least 6 characters')

        conn = get_db_connection()
        cur  = conn.cursor()
        try:
            execute(cur, "SELECT id FROM citizens WHERE email = ?", (email,))
            if cur.fetchone():
                raise ValueError('Email already registered. Please log in.')
        finally:
            cur.close()
            release_db_connection(conn)

        pw_hash = hash_password(password)
        otp     = generate_otp()
        _store_pending(email, otp, name or email.split('@')[0], pw_hash, phone)

        # Send OTP email via Brevo directly
        print("OTP:", otp)
        res = {'status': 'otp_sent', 'message': f'OTP sent to {email}'}
        if not send_otp_email(email, otp):
            res = {'status': 'otp_sent', 'message': 'Verification code sent!'}
            if os.environ.get('FLASK_ENV', 'development') in ('development', 'dev'):
                res['dev_otp'] = otp
        return res

    @staticmethod
    def verify_otp_and_commit(email: str, otp_code: str, device_type: str = 'unknown') -> dict:
        """
        Phase 2: verify OTP and commit citizen row to DB.
        Returns full citizen profile + JWT tokens.
        """
        from db import get_db_connection, execute, insert_and_get_id, release_db_connection

        pending = get_pending(email)
        if not pending:
            raise ValueError('No pending registration for this email. Please register first.')

        now = datetime.now(timezone.utc)
        if pending['expires_at'] < now:
            clear_pending(email)
            raise ValueError('OTP expired. Please register again.')

        pending['attempts'] += 1
        if pending['attempts'] > OTP_MAX_TRIES:
            clear_pending(email)
            raise ValueError('Too many incorrect attempts. Please register again.')

        if pending['otp'] != otp_code.strip():
            raise ValueError(f'Invalid OTP. {OTP_MAX_TRIES - pending["attempts"]} attempts remaining.')

        # Commit to DB
        conn = get_db_connection()
        cur  = conn.cursor()
        try:
            # Double-check email not registered in the meantime
            execute(cur, "SELECT id FROM citizens WHERE email = ?", (email,))
            if cur.fetchone():
                clear_pending(email)
                raise ValueError('Account already exists. Please log in.')

            citizen_id = insert_and_get_id(cur,
                "INSERT INTO citizens (email, password, name, phone, otp_verified, last_device) VALUES (?, ?, ?, ?, TRUE, ?)",
                (email, pending['password_hash'], pending['name'], pending['phone'], device_type)
            )
            conn.commit()
        finally:
            cur.close()
            release_db_connection(conn)

        clear_pending(email)

        # Send welcome email
        try:
            from services.mail_service import MailService
            MailService.send_welcome_email(email, pending['name'])
        except Exception:
            pass

        tokens = generate_tokens(citizen_id, email, device_type)
        return {
            'status': 'ok',
            'id': citizen_id,
            'email': email,
            'name': pending['name'],
            'phone': pending['phone'],
            'role': 'citizen',
            'otp_verified': True,
            **tokens,
        }

    @staticmethod
    def login(email: str, password: str, device_type: str = 'unknown', device_id: str = '') -> dict:
        """
        Authenticate citizen. Supports bcrypt + SHA-256 fallback.
        Returns full citizen profile + JWT tokens.
        """
        from db import get_db_connection, execute, row_to_dict, release_db_connection

        # Rate limit check
        allowed, wait_secs = _check_rate_limit(email)
        if not allowed:
            raise PermissionError(f'Too many login attempts. Try again in {wait_secs // 60 + 1} minutes.')

        conn = get_db_connection()
        cur  = conn.cursor()
        try:
            execute(cur,
                "SELECT id, email, name, phone, password, otp_verified, emergency_mode FROM citizens WHERE email = ?",
                (email,)
            )
            row = row_to_dict(cur.fetchone())
        finally:
            cur.close()
            release_db_connection(conn)

        if not row:
            _record_login_attempt(email)
            raise ValueError('Invalid email or password.')

        if not verify_password(password, row.get('password', '')):
            _record_login_attempt(email)
            logger.warning(f"Login failed: Password mismatch for email={email}. Hashed password in DB starts with: {row.get('password', '')[:10]}...")
            raise ValueError('Invalid email or password.')

        _reset_login_attempts(email)

        # Update last login + device
        conn2 = get_db_connection()
        cur2  = conn2.cursor()
        try:
            execute(cur2,
                "UPDATE citizens SET last_login = CURRENT_TIMESTAMP, last_device = ? WHERE id = ?",
                (device_type, row['id'])
            )
            if device_type == 'mobile' and device_id:
                execute(cur2,
                    "UPDATE citizens SET mobile_device_id = ? WHERE id = ?",
                    (device_id, row['id'])
                )
            conn2.commit()
        finally:
            cur2.close()
            release_db_connection(conn2)

        tokens = generate_tokens(row['id'], email, device_type)
        return {
            'status': 'ok',
            'id': row['id'],
            'email': email,
            'name': row.get('name', ''),
            'phone': row.get('phone', ''),
            'role': 'citizen',
            'otp_verified': bool(row.get('otp_verified', False)),
            'emergency_mode': bool(row.get('emergency_mode', False)),
            'last_device': device_type,
            **tokens,
        }

    @staticmethod
    def get_profile(citizen_id: int) -> dict | None:
        """Fetch full citizen profile from DB."""
        from db import get_db_connection, execute, row_to_dict, release_db_connection

        conn = get_db_connection()
        cur  = conn.cursor()
        try:
            execute(cur,
                "SELECT id, email, name, phone, otp_verified, emergency_mode, last_login, last_device, created_at FROM citizens WHERE id = ?",
                (citizen_id,)
            )
            return row_to_dict(cur.fetchone())
        finally:
            cur.close()
            release_db_connection(conn)

    @staticmethod
    def resend_otp(email: str) -> dict:
        """Resend OTP for pending registration."""
        pending = get_pending(email)
        if not pending:
            raise ValueError('No pending registration found. Please register again.')

        otp = generate_otp()
        pending['otp'] = otp
        pending['attempts'] = 0
        pending['expires_at'] = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MIN)

        res = {'status': 'otp_resent', 'message': f'New OTP sent to {email}'}
        if not send_otp_email(email, otp):
            res = {'status': 'otp_resent', 'message': 'Verification code sent!'}
            if os.environ.get('FLASK_ENV', 'development') in ('development', 'dev'):
                res['dev_otp'] = otp
        return res

    @staticmethod
    def start_password_reset(email: str) -> dict:
        """
        Phase 1 of recovery: verify user, generate OTP, send reset email.
        """
        from db import get_db_connection, execute, release_db_connection

        conn = get_db_connection()
        cur  = conn.cursor()
        try:
            execute(cur, "SELECT id, name FROM citizens WHERE email = ?", (email,))
            row = cur.fetchone()
            if not row:
                # Security best practice: don't reveal if email exists
                return {'status': 'otp_sent', 'message': f'If an account exists, an OTP has been sent to {email}'}
            
            citizen_id, name = row
        finally:
            cur.close()
            release_db_connection(conn)

        otp = generate_otp()
        # reusing pending registration store for reset OTP temporarily
        # In a production app, use a dedicated reset_tokens table
        _store_pending(email, otp, name, "RESET_MODE", "")

        res = {'status': 'otp_sent', 'message': f'If an account exists, an OTP has been sent to {email}'}
        if not send_otp_email(email, otp):
             res = {'status': 'otp_sent', 'message': 'Verification code sent!'}
             if os.environ.get('FLASK_ENV', 'development') in ('development', 'dev'):
                 res['dev_otp'] = otp
        return res

    @staticmethod
    def commit_password_reset(email: str, otp_code: str, new_password: str) -> dict:
        """
        Phase 2 of recovery: verify OTP, hash new password, update DB.
        """
        from db import get_db_connection, execute, release_db_connection

        pending = get_pending(email)
        if not pending or pending['password_hash'] != "RESET_MODE":
            raise ValueError('Invalid recovery request.')

        now = datetime.now(timezone.utc)
        if pending['expires_at'] < now:
            clear_pending(email)
            raise ValueError('Recovery OTP expired.')

        if pending['otp'] != otp_code.strip():
            pending['attempts'] += 1
            if pending['attempts'] > OTP_MAX_TRIES:
                clear_pending(email)
                raise ValueError('Too many incorrect attempts.')
            raise ValueError('Invalid OTP.')

        pw_hash = hash_password(new_password)

        conn = get_db_connection()
        cur  = conn.cursor()
        try:
            execute(cur, "UPDATE citizens SET password = ? WHERE email = ?", (pw_hash, email))
            conn.commit()
        finally:
            cur.close()
            release_db_connection(conn)

        clear_pending(email)
        return {'status': 'ok', 'message': 'Password reset successful. Please log in.'}
