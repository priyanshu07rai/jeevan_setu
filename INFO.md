# JEEVAN SETU — PRESENTATION CONTENT
### Disaster Intelligence Command & Citizen Platform
> Structured content for PowerPoint slides. Each section is clearly labeled by slide number.

---

## SLIDE 2 — BRIEF ABOUT YOUR SOLUTION

**Project Name:** Jeevan Setu
**Tagline:** *Lending a Hand When Humanity Calls.*

**Overview:**
Jeevan Setu (meaning "Life Bridge" in Hindi) is a full-stack, real-time disaster management and humanitarian response platform. It connects three critical actors in any disaster scenario — **Citizens** (victims and reporters), **Volunteers / NGO Responders**, and **Admin Command Centers** — into a single, unified intelligence framework.

**Purpose:**
The platform is designed for rapid emergency reporting, real-time resource allocation, supply logistics tracking, and coordinated field response during natural or man-made disasters.

**Target Users:**
- **Citizens** — Individuals affected by disasters who need to send SOS alerts or track relief operations.
- **Field Volunteers & NGOs** — First responders who accept missions, deliver aid, and upload field proof.
- **Administrators / Command Centers** — Government bodies and relief organizations that oversee and coordinate the entire response operation.

**Problem It Solves:**
During disasters, communication collapses, information is siloed, and resources are misallocated due to a lack of real-time coordination. Jeevan Setu solves this by providing a tri-layer platform — a mobile app for citizens (with offline-first capability), a web portal for volunteers, and a high-fidelity admin dashboard for command control — all powered by a single real-time backend.

---

## SLIDE 3 — OPPORTUNITIES

### a. How This Solution Is Different From Existing Ideas

| Aspect | Existing Solutions | Jeevan Setu |
|---|---|---|
| Connectivity | Requires stable internet | Offline-first with SQLite queuing and SMS fallback |
| User Roles | Single-role portals | Tri-role architecture (Citizen, Volunteer, Admin) |
| AI Integration | None / basic | AI-powered incident verification using image analysis (GPT-4o-mini Vision) |
| Real-time Updates | Delayed or manual | Socket.IO live updates for all portals |
| Evidence | Text-only reports | Photo/video evidence upload with AI confidence scoring |
| Notifications | Email-based | Push notifications (Expo/FCM), in-app broadcast modals, and SMS gateway fallback |

### b. How It Effectively Solves the Problem

- **For Citizens:** A mobile app that works even without internet. SOS signals are queued in SQLite locally and automatically synced when connectivity is restored. SMS fallback activates in zero-data zones.
- **For Volunteers:** A field portal that shows live mission assignments, allows GPS location sharing, admin messaging, and proof-of-delivery uploads.
- **For Admins:** A high-fidelity command dashboard with an interactive live map showing volunteer positions, SOS incident clusters, supply stock alerts, donor management, and victim registration.

### c. Unique Selling Proposition (USP)

> **Jeevan Setu is the only open disaster response platform that combines an offline-first mobile application, an AI-powered incident triage engine, and real-time Socket.IO command intelligence — all within a single unified architecture designed specifically for low-resource, high-urgency disaster zones.**

Key differentiators:
- AI verification of SOS images with fraud detection (confidence scoring)
- Offline-first mobile app with automatic background synchronization
- SMS gateway fallback for zero-connectivity scenarios
- Tri-role, role-gated web and mobile portals
- Real-time drag-and-drop dispatch with live inventory depletion tracking
- OTP-based citizen identity verification via email (Brevo API)

---

## SLIDE 4 — LIST OF FEATURES

### Citizen Mobile App (Expo React Native)
- Citizen registration and login with OTP email verification (via Brevo)
- GPS-locked SOS signal submission (Flood, Fire, Earthquake, Medical, Conflict, Other)
- Photo/video evidence upload directly from camera or gallery
- Offline SOS queue (SQLite) with automatic sync when network returns
- SMS fallback for zero-data zones using Expo SMS
- Real-time live map showing user's GPS location (Leaflet via WebView)
- Resource availability viewer
- Donation portal with top donor leaderboard
- Push notification reception (Expo / FCM-backed)
- Priority broadcast modal with animated in-app alert

### Volunteer Web Portal
- Name + access code authentication
- Live mission dashboard showing assigned disaster events
- GPS location sharing with backend (real-time tracking)
- Secure bidirectional messaging with Admin HQ
- Field proof upload (photos/videos) per mission
- Mission completion workflow
- Live inventory tracking for field resources

### Admin Web Dashboard
- Full incident map with AI-tagged SOS events
- Live volunteer location tracking (Leaflet map)
- Dispatch engine — assign volunteers to incidents
- Supply inventory management with smart stock alerts
- Victim / survivor registration portal (ZK-DID compatible design)
- Donor management and contribution tracking with heart reactions
- Real-time impact feed (donations + SOS activity combined)
- Admin-to-volunteer messaging (Socket.IO powered)
- Admin control room for global oversight
- Broadcast message system to all citizen devices

### Backend Intelligence Engine
- AI-powered incident image analysis using OpenAI GPT-4o-mini Vision
- Rule-based fallback triage scoring system
- AI confidence scoring and fraud detection on SOS images
- RESTful API (50+ endpoints) supporting both SQLite and PostgreSQL
- Socket.IO real-time event emission for all dashboards
- Expo Push Notification integration (server-side token management)
- Brevo transactional email service for OTP and welcome emails
- JWT-based authentication with bcrypt password hashing
- Rate limiting on all authentication endpoints
- Celery + Redis task queue (optional for background jobs)
- Kafka integration hooks (optional for high-throughput environments)
- Prometheus metrics exporter for monitoring

---

## SLIDE 5 — PROCESS FLOW DIAGRAM / USE-CASE DIAGRAM

**[DESCRIPTION FOR MANUAL DIAGRAM CREATION]**

*Create a flowchart with three swim lanes: Citizen (left), Backend System (center), and Admin/Volunteer (right). Use rounded rectangle boxes for actions/processes, diamond shapes for decision points, and arrows for data flow. Suggested colors: Blue for Citizen lane, Orange for Backend/System lane, Green for Admin/Volunteer lane.*

---

### Full Step-by-Step Flow:

**CITIZEN FLOW:**
1. Citizen opens the Jeevan Setu mobile app.
2. Citizen registers with name, email, and password.
3. **[Decision Point]:** System sends OTP via Brevo email API.
4. Citizen enters OTP → Account confirmed → JWT token issued.
5. Citizen lands on Home Screen (GPS permission requested).
6. Citizen taps "SOS" → SOS Screen opens.
7. **[Decision Point]:** Is internet available?
   - **YES (Online):** Fill SOS form (type, description, people count) → Optionally attach photo evidence → Tap "SEND EMERGENCY SIGNAL" → POST to `/api/v2/report` → Backend runs AI triage → Record stored in DB → Volunteer notified → Screen transitions to SOS Success Screen.
   - **NO (Offline):** SOS is saved to local SQLite queue → SMS fallback triggered → When network returns, app auto-retries → POST synced to backend.
8. Citizen can also view Resources, Donations, Map Dashboard, and Priority Broadcasts.

**BACKEND SYSTEM FLOW:**
1. Receives SOS POST at `/api/v2/report`.
2. Parses form data (multipart if with image, JSON if without).
3. If image present → Calls OpenAI GPT-4o-mini Vision API with image + context prompt.
4. AI returns: scene description, disaster type, confidence score, severity level (CRITICAL/HIGH/MEDIUM/LOW), severity score.
5. **[Decision Point]:** AI confidence > 0.6? → `ai_verified = TRUE` else `ai_verified = FALSE`.
6. Inserts full record into `disaster_events` table.
7. Emits Socket.IO event to all connected Admin dashboards.
8. Triggers Expo Push Notification (if registered tokens exist).

**ADMIN FLOW:**
1. Admin logs in (username + password → JWT issued).
2. Admin sees live Incident Map with all SOS events color-coded by severity.
3. Admin reviews AI analysis report on each incident.
4. Admin selects volunteer(s) → Clicks Dispatch → Volunteer status set to `ON_MISSION`.
5. Disaster event status updated to `DISPATCHED`.
6. Admin monitors live GPS location of dispatched volunteer on map.
7. Admin can send messages to volunteer portal.
8. Volunteer accepts mission → Delivers aid → Uploads field proof → Marks complete.
9. Admin confirms → Disaster event status → `RESOLVED`.

**VOLUNTEER FLOW:**
1. Volunteer logs in with access code.
2. Volunteer sees assigned missions on dashboard.
3. Volunteer shares live GPS location to command HQ.
4. Volunteer receives admin messages.
5. Volunteer uploads photo/video proof of relief delivery.
6. Volunteer marks mission as complete.

---

## SLIDE 6 — WIREFRAMES / MOCK DIAGRAMS

**[DESCRIPTION FOR MANUAL DIAGRAM CREATION]**

*Create simple wireframe mockups (black outline on white background, or dark-theme) for each screen described below. Each wireframe should show boxes/placeholders for buttons, cards, maps, and text sections. Label each screen clearly.*

---

### Screen 1: Citizen Mobile — Login Screen
- **Top half:** Jeevan Setu logo (glowing orange), platform tagline in small text.
- **Center:** Two tab buttons — "CITIZEN LOGIN" (highlighted) and "RESPONDER LOGIN".
- **Below tabs:** Email input field, Password input field.
- **Buttons:** Primary orange "LOGIN" button, secondary "Register" link text below.
- **Bottom:** Small privacy notice text.

---

### Screen 2: Citizen Mobile — Home Screen
- **Header bar:** Logo (left), notification bell icon (right).
- **Network status chip:** Green dot "ONLINE / OFFLINE" indicator.
- **4-column stats grid:** Active Alerts (orange) | Volunteers (green) | Shelters (blue) | Aid Sent (purple).
- **Main buttons (2 large tiles in grid):**
  - 🆘 SOS Emergency (red glow)
  - 🗺 Live Map Dashboard
  - 📦 Resources
  - 💙 Donate
- **Bottom:** Priority Broadcast area (orange border card, initially hidden).

---

### Screen 3: Citizen Mobile — SOS Screen
- **Header:** Back button (left), "SOS SIGNAL" title (red), GPS Status chip (right: green = LOCKED / amber = SCANNING).
- **Card 1 — Emergency Type:** 2×3 grid of type buttons (Flood, Fire, Earthquake, Medical, Conflict, Other) with emoji icons.
- **Map View (tall card):** Live Leaflet WebView of current GPS location with pulsing marker. Shows coordinate text overlay.
- **Card 3 — Situation Description:** Multi-line text input.
- **Card 4 — Split row:** People Affected (number input) | Evidence Upload (camera/gallery picker → thumbnail preview on selection).
- **Bottom:** Large red "SEND EMERGENCY SIGNAL" button. Warning text below. "Cancel" link.

---

### Screen 4: Web — Admin Dashboard
- **Left sidebar:** Navigation links — Dashboard, Incidents, Volunteers, Supplies, Victims, Broadcasts, Donors.
- **Top bar:** Title "DISASTER INTELLIGENCE COMMAND CENTER", connected status indicator, admin user info.
- **Main area (3-column layout):**
  - Left (wide): Leaflet map with SOS incident pins (color-coded by severity) and volunteer location pins.
  - Right top: Real-time activity feed (donations + SOS events).
  - Right bottom: Quick stats cards (Active Alerts, Online Volunteers, Supplies, Aid Total).
- **Incident table below map:** Rows for each disaster event showing: type, location, AI severity, status, assigned volunteer, action buttons (Verify / Dispatch / Resolve).

---

### Screen 5: Web — Volunteer Field Portal
- **Header:** "FIELD OPERATIONS PORTAL", volunteer name + access code confirmed.
- **Top card:** GPS location sharing toggle. "Share Location" button.
- **Mission cards (scrollable list):** Each card shows: Disaster type icon, location data, description excerpt, status badge (NEW/DISPATCHED), action buttons: "Accept" and "Complete Mission".
- **Admin Messages section:** Chat-like message thread, text input + send button.
- **Proof Upload section:** Drag-and-drop area (or file picker), media grid of uploaded proofs.

---

### Screen 6: Web — Donor Page
- **Header:** Title "RELIEF DONATION PORTAL".
- **Form card:** Donor name input, Amount input (₹), Category dropdown (Food / Medical / Shelter / General), "DONATE NOW" button.
- **Top Donors leaderboard (right side):** Ranked list showing donor name, amount contributed (in L = Lakhs format), ❤️ heart count, "Salute" button.

---

## SLIDE 7 — ARCHITECTURE DIAGRAM

**[DESCRIPTION FOR MANUAL DIAGRAM CREATION]**

*Create a layered architecture diagram with three horizontal tiers: Client Layer (top), Backend Layer (middle), and Data/Infrastructure Layer (bottom). Use labeled boxes and directional arrows to show data flow. Use icons where possible (mobile phone for mobile app, monitor for web, server rack for backend, cylinder for database).*

---

### System Architecture Description:

**CLIENT LAYER (Top)**

```
[ Citizen Mobile App ]           [ Volunteer Web Portal ]      [ Admin Web Dashboard ]
  React Native + Expo              React + Vite + Tailwind        React + Vite + Tailwind
  SQLite offline queue             React-Leaflet map              React-Leaflet map
  Expo Location + SMS              Socket.IO client               Socket.IO client
  Expo Notifications               Recharts analytics             Recharts analytics
  WebView (Leaflet maps)
```

**Communication:** All clients communicate with the Backend over HTTPS REST API and WebSocket (Socket.IO).

---

**BACKEND LAYER (Middle)**

```
[ Flask Application Server ]
  Python / Flask 3.x
  Flask-SocketIO + Eventlet (WebSocket server)
  Flask-CORS (Cross-origin requests)
  JWT Authentication (PyJWT)
  bcrypt password hashing

  ┌─── API Blueprints ──────────────────────────────────────────────────┐
  │  /api/v2/report         — Submit SOS incident (multipart/JSON)      │
  │  /api/v2/disasters      — GET all geo-tagged incidents              │
  │  /api/v2/dispatch       — Assign volunteer to mission               │
  │  /api/v2/volunteer/*    — Volunteer CRUD + location + messages      │
  │  /api/v2/auth/*         — Citizen register / login / OTP           │
  │  /api/v2/donations/*    — Donor management + heart reactions        │
  │  /api/v2/push/register  — Expo Push Token registration             │
  │  /api/v2/broadcast/*    — Admin broadcast management               │
  │  /api/v2/supplies       — Inventory management                     │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─── Service Layer ────────────────────────────────────────────────────┐
  │  CitizenAuthService     — OTP flow, JWT, bcrypt, rate limiting      │
  │  InventoryService       — Supply stock + dispatch depletion         │
  │  ActivityService        — Event feed logging                        │
  │  MailService            — Brevo email dispatch                      │
  │  WeatherService         — External weather data integration         │
  │  AI Decision Engine     — OpenAI GPT-4o-mini Vision (image triage)  │
  └─────────────────────────────────────────────────────────────────────┘
```

---

**EXTERNAL SERVICES (Right side / cloud icons)**

```
[ Brevo API ]          — Transactional OTP + Welcome emails
[ OpenAI API ]         — GPT-4o-mini Vision for AI image analysis
[ Expo Push API ]      — Firebase Cloud Messaging (FCM) backed push notifications
[ Twilio / SMS GW ]    — SMS fallback for zero-connectivity zones (webhook ingest)
[ Redis ]              — (Optional) Celery task queue broker
[ Kafka ]              — (Optional) High-throughput event streaming
```

---

**DATA LAYER (Bottom)**

```
[ SQLite ]             — Local development database (disaster_local.db)
[ PostgreSQL + PostGIS ] — Production database with geo-indexing support

  Key Tables:
  - disaster_events  (id, type, lat, lon, description, severity, status, ai_verified, image_url)
  - volunteers       (id, name, skills, status, lat, lon, organization)
  - citizens         (id, email, password_hash, otp_verified, device_type)
  - donations        (donor_name, amount, category)
  - donation_likes   (user_email, donor_name)
  - volunteer_messages (volunteer_id, sender, message)
  - volunteer_proofs (volunteer_id, filename, file_type, severity)
  - relief_supplies  (item, quantity, threshold)
  - push_tokens      (token)
  - broadcasts       (message, created_at)
```

**Deployment:**
- Backend containerized via Docker + Docker Compose
- Production server: Gunicorn (WSGI) + Eventlet (ASGI/WebSocket)
- Procfile defined for Render.com / Heroku cloud deployment
- Mobile app distributed via Expo EAS Build (APK/IPA)

---

## SLIDE 8 — TECHNOLOGIES TO BE USED

### Frontend — Web Portal
| Technology | Purpose |
|---|---|
| React 19 | Core UI framework (Citizen + Admin + Volunteer portals) |
| Vite 7 | Build tool and dev server |
| Tailwind CSS 4 | Utility-first styling |
| React Router DOM 7 | Client-side routing and role-based navigation |
| React-Leaflet / Leaflet.js | Interactive map (incident markers + volunteer tracking) |
| Socket.IO Client | Real-time WebSocket data updates |
| Recharts | Analytics charts (supply levels, incident stats) |
| Framer Motion | UI animations and transitions |
| Lucide React | Icon library |

### Mobile App
| Technology | Purpose |
|---|---|
| React Native 0.81 | Cross-platform mobile UI |
| Expo SDK 54 | Managed workflow, device APIs |
| Expo Location | GPS coordinate acquisition |
| Expo Notifications | Push notification reception (FCM-backed) |
| Expo SQLite | Local offline queue database |
| Expo SMS | SMS fallback for zero-connectivity |
| Expo Image Picker | Camera + gallery evidence capture |
| react-native-webview | Embedded Leaflet map rendering |
| NetInfo | Network connectivity detection |
| AsyncStorage | Local persistent key-value storage |
| Axios | HTTP client for API calls |
| React Navigation 7 (Stack) | Screen navigation |
| Expo EAS Build | Production APK/IPA build system |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.9+ | Core backend language |
| Flask 3.x | REST API framework |
| Flask-SocketIO + Eventlet | Real-time WebSocket server |
| Flask-SQLAlchemy | ORM for database models |
| Flask-CORS | Cross-origin request handling |
| PyJWT | JSON Web Token generation/verification |
| bcrypt | Password hashing |
| Gunicorn | Production WSGI server |
| Celery | Asynchronous task queue (optional) |
| Redis | Message broker for Celery (optional) |
| kafka-python-ng | Kafka integration for event streaming (optional) |
| GeoPy / GeoAlchemy2 | Geospatial calculations |
| spaCy | NLP for incident description analysis |
| scikit-learn / XGBoost | ML triage models |
| NumPy | Numerical processing |
| Prometheus Flask Exporter | Metrics and monitoring |
| python-dotenv | Environment variable management |
| Docker + Docker Compose | Containerization |

### External APIs & Services
| Service | Purpose |
|---|---|
| Brevo (Sendinblue) API | Transactional OTP + welcome emails |
| OpenAI GPT-4o-mini Vision | AI incident image analysis + fraud detection |
| Expo Push Notification Service | Push notifications (backed by FCM for Android, APNs for iOS) |
| Twilio (SMS Gateway) | Offline SMS fallback dispatch |

### Database
| Technology | Purpose |
|---|---|
| SQLite | Local development and MVP |
| PostgreSQL + PostGIS | Production deployment with geospatial indexing |

---

## SLIDE 9 — ESTIMATED IMPLEMENTATION COST (OPTIONAL)

*All figures are approximate and represent realistic monthly/one-time estimates for an early-stage MVP deployment.*

### Development Cost (One-Time)
| Component | Estimate |
|---|---|
| Backend API development | ✅ Completed (in-house) |
| Web frontend development | ✅ Completed (in-house) |
| Mobile app development | ✅ Completed (in-house) |
| Total one-time dev cost | **₹0 (Hackathon / Academic Project)** |

### Hosting & Infrastructure (Monthly)
| Service | Provider | Estimated Monthly Cost |
|---|---|---|
| Backend server | Render.com (free tier) / Railway | ₹0 – ₹1,200 |
| PostgreSQL database | Render / Supabase free tier | ₹0 – ₹800 |
| Redis instance | Upstash free tier | ₹0 |
| File uploads storage | Cloudinary / AWS S3 basic | ₹0 – ₹400 |
| Total hosting | | **₹0 – ₹2,400/month** |

### External API Costs (Monthly)
| Service | Free Tier | Paid (if exceeded) |
|---|---|---|
| Brevo Email | 300 emails/day free | ~₹1,500/month for 20K emails |
| OpenAI API | Pay-as-you-go | ~₹0.08 per image analysis |
| Expo Push | Free | Free up to 1M pushes/month |
| Twilio SMS | Trial credits | ~₹0.75 per SMS |
| Total API cost | | **₹0 – ₹3,000/month** |

### App Distribution
| Item | Cost |
|---|---|
| Google Play Store developer account | ₹2,070 (one-time) |
| Expo EAS Build (production builds) | Free (limited) |

### **Total Estimated Cost**
| Stage | Cost |
|---|---|
| MVP / Demo (current) | **₹0** |
| Early deployment (first 3 months) | **₹0 – ₹5,000/month** |
| Scale-up (10,000+ users) | **₹8,000 – ₹20,000/month** |

---

## SLIDE 10 — SNAPSHOTS OF THE MVP

**[DESCRIPTION FOR MANUAL SNAPSHOT COLLECTION]**

*Take actual screenshots from the running application for each of the following views. Use the access instructions in README.md to run the application locally. Each snapshot should be cropped to show only the relevant screen content.*

---

### Snapshot 1 — Citizen Mobile: Login Screen
Show the login screen of the Jeevan Setu mobile app. Should display the platform name/logo in orange, two tab options (Citizen Login / Responder Login), email and password fields, and the login button. Dark background theme (#080b10).

### Snapshot 2 — Citizen Mobile: Home Screen
Show the citizen home screen after login. Should display the 4-stat grid (Active Alerts, Field Responders, Safe Shelters, Aid Sent), the navigation tiles (SOS, Map, Resources, Donate), and the network status indicator. Demonstrate the real-time stats being populated.

### Snapshot 3 — Citizen Mobile: SOS Screen (GPS Locked)
Show the SOS screen with the GPS successfully locked. Should display the emergency type selector (with Flood/Fire/Earthquake highlighted), the embedded Leaflet map with a pulsing red GPS marker at the user's location, the coordinate overlay panel, the description text field, and people count + evidence upload cards. GPS chip in top-right should show "LOCKED" in green.

### Snapshot 4 — Citizen Mobile: SOS Success Screen
Show the screen displayed after a successful SOS submission. Should display confirmation message, the disaster type selected, GPS coordinates transmitted, and a "Return Home" button.

### Snapshot 5 — Web: Admin Dashboard (Main View)
Show the full admin dashboard with the live Leaflet incident map (with SOS pins colored by severity), the real-time activity feed on the right, stat cards at the top, and the incident data table below the map. Data should be populated with at least 2-3 active incidents.

### Snapshot 6 — Web: Volunteer Field Portal
Show the volunteer dashboard after login. Should display the assigned mission cards (with disaster type, location, and action buttons), the GPS location sharing control, and the admin message thread panel.

### Snapshot 7 — Web: Home Page (Citizen Web Interface)
Show the landing/home page of the web portal. Should display the hero section ("Lending a Hand when Humanity Calls"), the 4-stat grid, the real-time impact feed card, and the top donors leaderboard.

### Snapshot 8 — Web: Donor Page
Show the donation portal. Should display the donation form (donor name, amount, category) and the top contributors leaderboard with heart/salute buttons.

---

## SLIDE 11 — ADDITIONAL DETAILS / FUTURE DEVELOPMENT

### Immediate Improvements (Short-term)
- **Production Deployment Hardening:** Move from SQLite local DB to fully managed PostgreSQL (Supabase / AWS RDS) with proper migrations for all tables.
- **Kafka Event Streaming:** Enable the existing Kafka integration hooks for high-throughput disaster zones generating thousands of concurrent SOS events.
- **SMS Ingest Gateway:** Complete the Twilio SMS webhook (`/api/mobile/sms-ingest`) to allow victims without smartphones to submit structured SOS via standard SMS (e.g., `SOS#Flood#LAT:26.7#LON:83.3#PPL:12`).
- **AI Model Fine-tuning:** Fine-tune the severity scoring model using historical disaster data collected from the platform's `disaster_events` table.

### Medium-term Roadmap
- **ZK-DID Victim Registration:** Formalize the Zero-Knowledge Decentralized Identity integration for privacy-preserving victim registration — preventing duplicate aid claims while protecting personal identity.
- **Aadhaar / DigiLocker Integration:** For India-specific deployments, allow citizens to verify identity via Aadhaar OTP or DigiLocker document validation.
- **Multi-language Support:** Add Hindi, Bengali, Tamil, and Telugu language support for the mobile app to reach wider rural populations.
- **Voice SOS:** Allow citizens to submit SOS reports via voice command (speech-to-text) for use by illiterate or injured users.
- **Satellite Imagery Analysis:** The existing `sentinelsat` and `rasterio` dependencies indicate a planned satellite image overlay layer — activate Copernicus/Sentinel-2 flood mapping for macro-area disaster visualization.

### Long-term Scalability Plans
- **Mesh Network / LoRa Integration:** The `mesh_receiver.py` module in the backend indicates planned support for LoRa/mesh radio packet relay — allowing SOS signals from areas with zero cellular coverage to be relayed hop-by-hop to the nearest internet-connected node.
- **Regional Multi-tenancy:** Architecture to support multiple independent disaster zones (state-level or district-level command centers) with isolated data and unified national oversight.
- **Partner NGO API:** Expose a documented public API for partner organizations (Red Cross, NDRF, etc.) to pull incident data, push resource updates, and integrate their own field apps.
- **Predictive Dispatch:** Use ML models trained on historical data to pre-position volunteers and supplies in areas with elevated disaster risk (weather triggers, seismic activity).
- **iOS App Distribution:** Submit to Apple App Store (requires Apple Developer account: ~$99/year).
- **Digital Twin:** Real-time 3D visualization of the disaster zone using GIS data, satellite imagery, and live field reports.

---

## SLIDE 12 — LINKS

*The following links are placeholders. Replace with actual URLs before the presentation.*

### 1. GitHub Public Repository
```
https://github.com/[your-username]/jeevansetu
```
> Replace `[your-username]` with the actual GitHub account. If the repository is private, make it public before submission.

### 2. Demo Video (3 Minutes)
```
https://www.youtube.com/watch?v=[VIDEO_ID]
```
> Record a 3-minute walkthrough covering: (1) Citizen SOS flow on mobile, (2) Admin dashboard receiving the SOS and dispatching a volunteer, (3) Volunteer accepting and completing the mission. Upload to YouTube (unlisted or public).

### 3. MVP Link (Live Deployment)
```
https://jeevansetu-api.onrender.com
```
> Backend API base URL (Render.com deployment, as referenced in the source code). For the web frontend, add the corresponding Vercel/Netlify/Render deployment URL.

### 4. Working Prototype Link
```
https://[frontend-deployment-url].vercel.app
```
> Replace with the actual deployed frontend URL.

---
---
*INFO.md generated by analyzing the Jeevan Setu project codebase (jeevansetu_final/disaster_supply).*
*All content is derived from the actual project source code, architecture, and implemented features.*
*Do not modify any source code files — this document is read-only informational content.*
