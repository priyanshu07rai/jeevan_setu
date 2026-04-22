# 🚀 Jeevan Setu — Render → Neon DB Migration

This folder contains everything you need to move your PostgreSQL database
from Render (jeevansetu-db) to Neon's free tier before the **2026-05-11** deadline.

---

## 📋 EXACT STEPS (follow in order)

### STEP 1 — Create a Neon account & database
1. Go to https://neon.tech and sign up (free, no credit card needed)
2. Click **"New Project"**
3. Name it: `jeevansetu`
4. Region: choose **closest to India** (e.g., AWS ap-south-1 Mumbai)
5. After creation, click **"Connection Details"**
6. Copy the **Connection String** — it looks like:
   ```
   postgresql://neondb_owner:xxxxxxxx@ep-xxxx.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```
7. Save this string — you'll use it in every step below.

---

### STEP 2 — Export data from Render (dump the old DB)
> Do this BEFORE May 11. You need pg_dump installed locally OR use Render's shell.

**Option A — Using Render Shell (easiest, no install needed)**
1. Go to your Render dashboard → `jeevansetu-db` → **Shell** tab
2. Run:
   ```bash
   pg_dump $DATABASE_URL --no-owner --no-acl -F p -f /tmp/jeevansetu_dump.sql
   ```
3. Download the file from Render Shell (use the download button or copy-paste the output)

**Option B — From your local machine (pg_dump must be installed)**
```bash
# Replace with your actual Render DATABASE_URL
pg_dump "postgresql://jeevansetu_db_user:xxxx@oregon-postgres.render.com/jeevansetu_db" \
  --no-owner --no-acl -F p -f neon_migration/jeevansetu_dump.sql
```

> The dump file `jeevansetu_dump.sql` should be saved inside this `neon_migration/` folder.

---

### STEP 3 — Import data into Neon
```bash
# Replace with YOUR Neon connection string from Step 1
psql "postgresql://neondb_owner:xxxxxxxx@ep-xxxx.ap-south-1.aws.neon.tech/neondb?sslmode=require" \
  -f neon_migration/jeevansetu_dump.sql
```

If you don't have psql locally, use **Neon's SQL Editor** (in-browser):
1. Open your Neon project → **SQL Editor**
2. Paste the contents of `jeevansetu_dump.sql` and run

---

### STEP 4 — Update your backend .env
Open `backend/.env` and change the DATABASE_URL line:

**BEFORE:**
```
DATABASE_URL=postgresql://jeevansetu_db_user:xxxx@oregon-postgres.render.com/jeevansetu_db
```

**AFTER:**
```
DATABASE_URL=postgresql://neondb_owner:xxxxxxxx@ep-xxxx.ap-south-1.aws.neon.tech/neondb?sslmode=require
```

A template file is provided in this folder: `neon_migration/env_template.txt`

---

### STEP 5 — Update Render backend environment variables
1. Go to Render Dashboard → your **backend Web Service** (not the DB)
2. Go to **Environment** tab
3. Find `DATABASE_URL` and replace with the Neon connection string
4. Click **Save Changes** → Render will auto-redeploy

---

### STEP 6 — Verify connection works
Run the test script:
```bash
cd backend
python neon_migration/test_neon_connection.py
```
You should see: ✅ Connected to Neon successfully!

---

### STEP 7 — Delete the Render database (after confirming everything works)
1. Keep the Render DB alive for at least **3-5 days** after migration to confirm stability
2. Once confirmed → go to Render → jeevansetu-db → **Delete Database**

---

## ✅ What does NOT change
- Your Flask backend code (db.py, config.py — already support PostgreSQL)
- Your frontend/mobile app code (they talk to the backend, not the DB directly)
- Your backend API endpoints
- Your requirements.txt (psycopg2-binary is already there)

## ⚠️ Neon Free Tier Limits
- 0.5 GB storage (sufficient for this project)
- Auto-suspend after 5 minutes of inactivity (first query after idle will take ~1-2 seconds)
- 1 project, 1 database

---

*Migration prepared: 2026-04-22*
