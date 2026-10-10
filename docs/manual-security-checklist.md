#  Manual Security & Launch Checklist
**Study Buddy — Production Hardening Manual Verification (Rule 13.14)**

This checklist details all actions that cannot be fully automated by code and require human operator verification in cloud dashboards.

---

## 1. MongoDB Atlas Configuration
- [ ] **Rotate Database Credentials:**
  - Navigate to **MongoDB Atlas > Security > Database Access**.
  - Select your application user and change the password.
  - Update `MONGODB_URI` in your production secret store.
  - *Rationale:* Git history scan identified older historical commits where a development connection string was committed before `.gitignore` enforcement.
- [ ] **Restrict Network Access:**
  - Navigate to **MongoDB Atlas > Security > Network Access**.
  - Delete `0.0.0.0/0` (Allow Access from Anywhere) used during hackathon development.
  - Add only your specific application hosting IP addresses or AWS VPC peering / PrivateLink.
- [ ] **Enable Atlas Automated Daily Backups:**
  - Verify that Continuous Cloud Backups are enabled for your cluster.

---

## 2. Third-Party AI & Secret Providers
- [ ] **Rotate Anthropic Claude API Key:**
  - Go to **Anthropic Console > API Keys**.
  - Generate a new secret key for production.
  - Revoke development keys.
- [ ] **Generate Production `SESSION_SECRET`:**
  - On the production server, generate a 64-character random hex string:
    ```bash
    node -e "console.log(crypto.randomBytes(32).toString('hex'))"
    ```
  - Store strictly in production environment variables (never commit to git).

---

## 3. Hosting & Deployment Environment
- [ ] **Set `NODE_ENV=production`:**
  - Verifies that:
    - `DEMO_MODE` and `STRESS_MODE` cause the server to refuse startup if accidentally left on.
    - Rate limiter bypass header `x-stress-bypass-limit` is disabled.
    - Cookies use the `__Host-sid` prefix with `Secure: true`.
    - HSTS header with 1-year max-age is emitted.
    - Stack traces are strictly masked from responses.
- [ ] **Enforce HTTPS Termination:**
  - Verify that Cloudflare / Render / AWS ALB terminates TLS 1.3 and passes `X-Forwarded-Proto: https`.
- [ ] **Enable Cloudflare Turnstile (Optional):**
  - If deploying to public traffic, register your domain at Cloudflare Turnstile and populate `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

---

## 4. Operational Monitoring
- [ ] **Admin Account Provisioning:**
  - Create the initial admin user using the secure CLI script:
    ```bash
    node scripts/admin-create.js
    ```
- [ ] **Audit Log Monitoring:**
  - Verify that administrative access to `/api/health/detailed` is working and that audit events are stored in `admin_audit` with the 90-day TTL index.
