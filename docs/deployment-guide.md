# Study Buddy — Cloud Deployment Guide
**Target Environments:** Render (Recommended Free Tier), Railway, or Docker Container (AWS/GCP/VPS)  
**Repository Remote:** `https://github.com/Thanvik931/STUDY-BUDDY-.git`  
**Node Version:** v22 LTS &bull; **Database:** MongoDB Atlas  

---

## ⚡ Quick Start: 3-Minute Deployment on Render (Recommended)

Render offers a free tier, native Node.js support, automatic SSL certificates (`https://`), and continuous deployment whenever you push code to GitHub.

### Step 1: Ensure MongoDB Atlas Allows Cloud Connections
Before deploying, make sure your MongoDB Atlas cluster allows incoming connections from cloud IP addresses:
1. Log in to [MongoDB Atlas Console](https://cloud.mongodb.com).
2. In the left sidebar under **Security**, click **Network Access**.
3. Click the green **+ Add IP Address** button.
4. Click **Allow Access from Anywhere** (`0.0.0.0/0`) and click **Confirm**.
   *(This ensures your Render cloud instance can reach your database cluster).*

---

### Step 2: Deploy on Render via Web Dashboard
1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. Click **New +** in the top navigation bar, then select **Web Service**.
3. Select your GitHub repository: `Thanvik931/STUDY-BUDDY-`.
4. Configure the service parameters:
   - **Name:** `study-buddy-ai` *(or any unique name you choose)*
   - **Region:** Closest to your users (e.g., Oregon, Frankfurt, Singapore)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

---

### Step 3: Configure Environment Variables
Under the **Environment Variables** section on Render, add the following variables:

| Key | Example Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enforces production security policies and strict HSTS |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` | Your live MongoDB Atlas connection string |
| `MONGODB_DB` | `study_buddy_db` | Target MongoDB database |
| `SESSION_SECRET` | *(64-character random hex string)* | Cryptographic key for HMAC sessions |
| `SITE_URL` | `https://study-buddy-ai.onrender.com` | The public HTTPS URL assigned by Render |
| `CONTACT_EMAIL` | `support@yourdomain.com` | Administrative contact email |
| `GEMINI_API_KEY` | *(your Gemini API key)* | Powers Socratic tutoring and generative lessons |
| `ALLOWED_ORIGINS` | `*` | Permits web requests to the API |

> [!TIP]
> **To generate a secure 64-character hex `SESSION_SECRET`**, run this in your terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

5. Click **Create Web Service**.
6. Render will run `npm install`, copy vendor assets (`Chart.js`), launch `server.js`, and verify `/api/health`.
7. Once live, your application will be accessible at: `https://study-buddy-ai.onrender.com`

---

## 🚂 Option 2: Deploy on Railway

Railway automatically detects Node.js projects from GitHub and provides instant deployment:

1. Go to [https://railway.app](https://railway.app) and log in with GitHub.
2. Click **New Project** &rarr; **Deploy from GitHub repo**.
3. Select `Thanvik931/STUDY-BUDDY-`.
4. Click **Variables** and paste the same environment variables as listed above.
5. In **Settings** &rarr; **Networking**, click **Generate Domain** to get your public HTTPS URL.
6. Railway will automatically deploy and monitor the container.

---

## 🐳 Option 3: Deploy with Docker (Any VPS / AWS EC2 / DigitalOcean)

This repository includes a multi-stage production [`Dockerfile`](file:///c:/Users/RUSHITHA/Desktop/Mongodb%20Hackathon/Dockerfile) and [`.dockerignore`](file:///c:/Users/RUSHITHA/Desktop/Mongodb%20Hackathon/.dockerignore).

### 1. Build the Docker Image
```bash
docker build -t study-buddy:latest .
```

### 2. Run the Container
```bash
docker run -d \
  --name study-buddy \
  -p 3000:3000 \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e MONGODB_URI="your_mongodb_uri" \
  -e MONGODB_DB="study_buddy_db" \
  -e SESSION_SECRET="your_64_hex_secret" \
  -e SITE_URL="https://yourdomain.com" \
  -e CONTACT_EMAIL="support@yourdomain.com" \
  -e GEMINI_API_KEY="your_gemini_key" \
  study-buddy:latest
```

### 3. Verify Container Health
```bash
docker ps
curl http://localhost:3000/api/health
# Response: {"status":"ok"}
```

---

## 🛡️ Production Verification Checklist
After deploying, verify the live instance:
- [ ] Access the landing page: `https://<your-domain>/`
- [ ] Test the **1-Click Judge Demo (Evaluator Ravi Kumar)** button.
- [ ] Test the **🏆 Hackathon Rubric** modal in the top header.
- [ ] Navigate the **Left Sidebar** across all 9 features.
- [ ] Check `/api/health` returns HTTP 200 `{ "status": "ok" }`.
- [ ] Check `/api/metrics` displays process telemetry.
