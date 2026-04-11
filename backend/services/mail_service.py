import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

class MailService:
    @staticmethod
    def _get_html_wrapper(content_html):
        """Wraps content in a premium Jeevan Setu themed email template."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }}
                .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
                .header {{ background: linear-gradient(135deg, #e8630a 0%, #ff8c42 100%); padding: 40px 20px; text-align: center; color: white; }}
                .logo-text {{ font-size: 28px; font-weight: 800; letter-spacing: -1px; margin: 0; }}
                .content {{ padding: 40px 30px; text-align: center; }}
                .otp-box {{ background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; margin: 30px 0; display: inline-block; min-width: 200px; }}
                .otp-code {{ font-size: 42px; font-weight: 800; color: #e8630a; letter-spacing: 12px; margin-left: 12px; font-family: 'Courier New', monospace; }}
                .footer {{ background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
                .btn {{ background: #e8630a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 20px; }}
                .security-note {{ font-size: 11px; color: #94a3b8; margin-top: 20px; font-style: italic; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="logo-text">🛰 JEEVAN SETU</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Unified Citizen Identity</p>
                </div>
                <div class="content">
                    {content_html}
                </div>
                <div class="footer">
                    &copy; {datetime.now().year} Jeevan Setu Command Center. All rights reserved.<br>
                    This is an automated security notification.
                </div>
            </div>
        </body>
        </html>
        """

    @staticmethod
    def send_email(to_email, subject, body_text, body_html=None):
        from datetime import datetime
        server_host = os.environ.get('SMTP_SERVER', 'smtp-relay.brevo.com')
        server_port = int(os.environ.get('SMTP_PORT', 587))
        user = os.environ.get('SMTP_USER', '')
        password = os.environ.get('SMTP_PASS', '')
        mail_from_email = os.environ.get('MAIL_FROM', user)
        mail_from_name = os.environ.get('MAIL_FROM_NAME', 'Jeevan Setu')
        
        mail_from = f"{mail_from_name} <{mail_from_email}>"

        if not user or not password:
            logger.warning("SMTP credentials not configured. Skipping email.")
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = mail_from
            msg['To'] = to_email
            msg['Subject'] = subject

            # Plain text part
            msg.attach(MIMEText(body_text, 'plain'))
            
            # HTML part
            if body_html:
                msg.attach(MIMEText(body_html, 'html'))

            server = smtplib.SMTP(server_host, server_port)
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
            server.quit()
            logger.info(f"Email successfully sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    @staticmethod
    def send_otp_email(to_email, otp, name="Citizen", expiry_minutes=10, flow_type="register"):
        """Send a branded OTP verification email (Supports registration and password reset)."""
        if flow_type == "reset":
            subject = f"🔑 {otp} is your password recovery code"
            title = "Password Recovery"
            desc = "Please use the verification code below to reset your Jeevan Setu account password."
        else:
            subject = f"🛡 {otp} is your Jeevan Setu verification code"
            title = "Verify Your Identity"
            desc = "Please use the verification code below to complete your registration on the Jeevan Setu platform."
        
        body_text = (
            f"Hello {name},\n\n"
            f"{title}\n"
            f"Your verification code is: {otp}\n"
            f"This code will expire in {expiry_minutes} minutes.\n\n"
            f"If you didn't request this, please ignore this email.\n\n"
            f"— Jeevan Setu Team"
        )
        
        html_content = f"""
            <h2 style="margin-bottom: 10px;">{title}</h2>
            <p>Hello <strong>{name}</strong>,</p>
            <p>{desc}</p>
            
            <div class="otp-box">
                <div class="otp-code">{otp}</div>
            </div>
            
            <p style="margin-top: 0;">This code expires in <strong>{expiry_minutes} minutes</strong>.</p>
            <p class="security-note">For security, do not share this code with anyone. Jeevan Setu staff will never ask for your OTP.</p>
        """
        
        body_html = MailService._get_html_wrapper(html_content)
        return MailService.send_email(to_email, subject, body_text, body_html)

    @staticmethod
    def send_welcome_email(to_email, name):
        subject = "✅ Welcome to Jeevan Setu — Account Verified"
        
        body_text = f"Hello {name},\n\nYour account has been successfully verified. You can now access all disaster response services."
        
        html_content = f"""
            <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
            <h2 style="color: #10b981;">Account Verified!</h2>
            <p>Hello <strong>{name}</strong>,</p>
            <p>Your Jeevan Setu identity is now active and secure. You can use your credentials to log in on both our web dashboard and mobile application.</p>
            
            <p>Stay safe in emergency conditions by keeping your mobile app location services active.</p>
            
            <a href="#" class="btn">Launch Command Dashboard</a>
        """
        
        body_html = MailService._get_html_wrapper(html_content)
        return MailService.send_email(to_email, subject, body_text, body_html)
