import smtplib
import os
from dotenv import load_dotenv

load_dotenv()

def test_smtp():
    host = os.environ.get('SMTP_SERVER', 'smtp-relay.brevo.com')
    port = int(os.environ.get('SMTP_PORT', 587))
    user = os.environ.get('SMTP_USER', '')
    password = os.environ.get('SMTP_PASS', '')
    
    print(f"Testing SMTP with: {host}:{port} and user {user}")
    
    try:
        server = smtplib.SMTP(host, port)
        server.set_debuglevel(1)
        server.starttls()
        # Try both the email and the string 'api_key'
        try:
            print("Trying email as user...")
            server.login(user, password)
            print("✅ Login with email successful!")
        except Exception:
            print("Trying 'api_key' as user...")
            server.login('api_key', password)
            print("✅ Login with 'api_key' successful!")
        server.quit()
    except Exception as e:
        print(f"❌ SMTP Error: {e}")

if __name__ == "__main__":
    test_smtp()
