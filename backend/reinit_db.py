from app import create_app, db
import os

app = create_app(os.getenv('FLASK_ENV', 'dev'))
with app.app_context():
    # Drop all tables first to apply schema changes cleanly
    db.drop_all()
    db.create_all()
    print("Database tables re-created successfully with updated schema.")
