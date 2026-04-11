# Disaster Intelligence Command Center

A full-stack, real-time disaster management and visualization platform designed for rapid emergency reporting, resource allocation, and logistics tracking during critical events.

### ✨ Key Features
- **Admin Control Room**: Real-time visualization of live volunteer locations and SOS alerts on an interactive map.
- **Supply Intelligence Layer**: Robust inventory management, live activity feeds, and smart stock alerts powered by Socket.IO.

## 🏗️ Architecture

The project has recently been migrated to a highly resilient micro-frontend architecture split into three main environments:
1. **`backend/`**: Python/Flask API serving the Command Dashboard and the Mobile App. Handles database ingestion, sync queues, and AI Triage.
2. **`frontend_web/`**: React web application tailored strictly for Admins, NGOs, and Command Center Volunteers. High-bandwidth, secure access.
3. **`mobile_app/`**: Expo React Native mobile application designed for Citizens. Offline-first, low-bandwidth, with SQLite queues and SMS Gateway fallbacks.

## Tech Stack
- **Frontend Web:** React, Vite, Tailwind CSS, React-Leaflet.
- **Mobile App:** React Native, Expo, SQLite, Axios.
- **Backend:** Python, Flask, Flask-SQLAlchemy, Eventlet/Socket.IO.
- **Database:** SQLite (default for local dev) or PostgreSQL with PostGIS.

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Node.js** (v18+)
2. **Python** (v3.9+)

### 1. Database Setup
By default, the backend runs on an SQLite database (`disaster_local.db`) allowing for an instantaneous local development setup. No PostgreSQL installation is required unless you configure the `DATABASE_URL`.

Navigate to the `backend` directory to run the seeding script to build schemas and insert mock tracking data:
```bash
cd backend
python seed_db.py
```

### 2. Backend Configuration
Stay in the `backend/` directory, configure your environment variables, and start the Eventlet/Flask server:
```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
python run.py
```
*The backend will start running on `http://0.0.0.0:5001`. **Note:** You must allow this app through your Windows Firewall on "Private Networks" so your phone can reach it!*

### 3. Frontend Web Configuration (Command Center)
Navigate to the `frontend_web/` directory and start the Vite development server:
```bash
cd frontend_web
cp .env.example .env
npm install
npm run dev
```
*The dashboard will start running on `http://localhost:5173`.*

### 4. Mobile App Configuration (Citizen Hub)
To run the citizen offline-first mobile app:
```bash
cd mobile_app
npm install
npx expo start -c
```
*Make sure your `mobile_app/src/constants.js` points to your laptop's Wi-Fi IP (e.g., `192.168.1.x`) rather than localhost, otherwise your phone won't connect to the backend API!*

---

## 🗺️ Core Experiences
1. **Admin Intelligence Dashboard:** Navigate to `http://localhost:5173/admin` to manage global response logistics and ZK-DID victim registration.
2. **Volunteer Dashboard:** Navigate to `http://localhost:5173/field` to accept and resolve relief missions.
3. **Citizen Offline App:** Open the Expo app on your physical device. It will automatically detect network status and gracefully switch to SMS fallback queues if you disconnect from Wi-Fi.

## API Structure (v2)
- `POST /api/v2/report` - Submit a new disaster incident.
- `GET /api/v2/disasters` - Retrieve all geo-tagged incidents.
- `POST /api/mobile/sos` - Offline-first SOS gateway.
- `POST /api/mobile/sync` - Bulk upload offline queued SQLite packets.
- `POST /api/mobile/sms-ingest` - SMS Twilio webhook interceptor for zero-data zones.
