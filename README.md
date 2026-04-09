# MOPAY

<p align="center">
  <img src="branding/mopay_banner.png" alt="MOPAY Banner" width="25%">
</p>


**MOPAY** is a self-hosted personal finance and home monthly payments management application.

- ✅ Modern UI (React + Vite + Tailwind)
- ✅ Backend API (Node.js)
- ✅ PWA – works offline and behaves like a native app
- ✅ Manage multiple years, entries, entry groups, reports, and savings goals
- ✅ Designed for self-hosting (Docker, docker-compose, reverse proxy friendly)
- ✅ Secured with encryption key
- ✅ PIN session protection for frontend and backend API
- ✅ Tagging - tag month with color and text to quickly identify needed informations
- ✅ Import - speedup on Mopay implementation by preparing data in excel and simply import entire year to mopay
- ✅ Release status indicator with GitHub release check

---
## Demo / Screenshots

### Main UI
<p align="center">
  <img src="branding/0_dark.png" width="45%" alt="Main UI Expenses Dark">
  <img src="branding/0_light.png" width="45%" alt="Main UI Expenses Dark">
</p>
<p align="center">
  <img src="branding/1_dark.png" width="45%" alt="Main UI Incomes Dark">
  <img src="branding/1_light.png" width="45%" alt="Main UI Incomes Dark">
</p>

### Savings
<p align="center">
  <img src="branding/2_dark.png" width="45%" alt="Savings Dark">
  <img src="branding/2_light.png" width="45%" alt="Savings Light">
</p>

### Reports
<p align="center">
  <img src="branding/3_dark.png" width="45%" alt="Reports Dark">
  <img src="branding/3_light.png" width="45%" alt="Reports Light">
</p>

### Settings
<p align="center">
  <img src="branding/4_dark.png" width="45%" alt="Settings Dark">
  <img src="branding/4_light.png" width="45%" alt="Settings Light">
</p>

---

## Features

- Manage **financial years**
- Add, edit, reorder, group, and delete **income and expense entries**
- Generate **reports and summaries**
- Track **savings goals** and progress
- **Entry groups** for better table organization in incomes and expenses
- **PIN guard** built-in with backend API session protection via `X-Mopay-Session`
- **Offline** mode (PWA, asset caching)
- **Data encryption** - your incomes and expeneses values are secured with encryption key
- **Tagging** on board - tag element with color and comment
- :fire:**Import feature**  use new function for **faster data input** or financial data **migration collected in excel sheets**. Import flow with template download, validation, year overwrite confirmation, and progress/status feedback.
- **Import scope** includes entries, groups, month tags, savings goals, and savings items
- **Release info** in settings with update check against GitHub Releases

---

## Run with Docker (GHCR)

The easiest way to get started is to use compose file:

Notes:
- `ghcr.io/pbuzdygan/mopay:latest` tracks releases from `main`.
- `ghcr.io/pbuzdygan/mopay:dev_latest` tracks releases from `dev`.

```bash
services:
  mopay:
    image: ghcr.io/pbuzdygan/mopay:latest
    container_name: mopay
    restart: unless-stopped

# MOPAY backend/frontend listens on port 8010 inside the container
    ports:
      - "8010:8010"

# Persistent data (if backend writes anything to /data)
    volumes:
      - ./data:/data

# Environment variables
    environment:
#      - PORT=8010 #in network_mode host You can set different than default port
      - DB_FILE=/data/mopay.sqlite
      - APP_PIN=123456 #PIN 4-8 digits
      - APP_ENC_KEY=REPLACE_WITH_YOUR_KEY
      - NODE_ENV=production
      # Optional security hardening (v1.5.3+):
      # - APP_SESSION_TTL_SECONDS=43200
      # - APP_SESSION_MAX_ACTIVE=5000
      # - APP_PIN_RATE_LIMIT_PER_MIN=12
      # - APP_PIN_RATE_LIMIT_BURST=4
      # - APP_PIN_RATE_LIMIT_BURST_WINDOW_MS=10000
      # - APP_PIN_LOCK_THRESHOLD=6
      # - APP_PIN_LOCK_BASE_MS=120000
      # - APP_PIN_LOCK_MAX_MS=1800000
      # - APP_PIN_MIN_RESPONSE_MS=250
      # - CORS_ALLOWED_ORIGINS=https://mopay.example.com
      # - SECURITY_WEBHOOK_URL=https://example.com/webhook
      # - SECURITY_ALERT_PIN_FAIL_THRESHOLD=20
      # - SECURITY_ALERT_PIN_FAIL_WINDOW_MS=600000
      # - SECURITY_ALERT_COOLDOWN_MS=900000
      # - SQLITE_BUSY_TIMEOUT_MS=5000

# Health check (optional but recommended)
#    healthcheck:
#      test: ["CMD", "curl", "-f", "http://localhost:8010"]
#      interval: 30s
#      timeout: 5s
#      retries: 5
```
### Generate Your APP_ENC_KEY

Result of below command is Your encryption key - stored it securley - without it, Your Mopay will not start and Your data will be lost.

```bash
openssl rand -base64 32

```

Accepted formats:

- raw base64 output from `openssl rand -base64 32`
- `base64:<value>`

## Import notes

- Use the template downloaded from Mopay. The backend expects the uploaded file name to stay `mopay_import_template.xlsx`.
- Import supports new years and overwriting existing years after explicit confirmation.
- Imported workbook data includes entries, groups, month tags, savings goals, and savings items.

## Release check

- The frontend can display release/update information in Settings.
- Release status is resolved from backend metadata and GitHub Releases for the configured repository/channel.
- In restricted environments, outbound browser access to `api.github.com` may be required for update detection.

## Security environment variables (v1.5.3+)

Mopay now protects backend API endpoints with a PIN session token (`X-Mopay-Session`).
Below variables let you tune security behavior.

- `APP_SESSION_TTL_SECONDS` (default: `43200`)
  - PIN session idle timeout (sliding expiration in seconds).
- `APP_SESSION_MAX_ACTIVE` (default: `5000`)
  - Max number of in-memory active sessions before oldest entries are evicted.

- `APP_PIN_RATE_LIMIT_PER_MIN` (default: `12`)
  - Max PIN verify attempts per IP per minute.
- `APP_PIN_RATE_LIMIT_BURST` (default: `4`)
  - Max burst attempts per IP in short window.
- `APP_PIN_RATE_LIMIT_BURST_WINDOW_MS` (default: `10000`)
  - Burst window size in milliseconds.

- `APP_PIN_LOCK_THRESHOLD` (default: `6`)
  - Failed PIN attempts required to trigger lockout.
- `APP_PIN_LOCK_BASE_MS` (default: `120000`)
  - Initial lockout duration in milliseconds.
- `APP_PIN_LOCK_MAX_MS` (default: `1800000`)
  - Max lockout duration in milliseconds.
- `APP_PIN_MIN_RESPONSE_MS` (default: `250`)
  - Minimum response duration for `/api/pin/verify` to reduce timing signal.

- `CORS_ALLOWED_ORIGINS` (default: empty)
  - Optional comma-separated allowlist for cross-origin API calls.
  - Example: `https://mopay.example.com,https://admin.example.com`
  - If empty, Mopay does not enable cross-origin API access.

- `SECURITY_WEBHOOK_URL` (default: empty)
  - Optional webhook endpoint for security alerts.
- `SECURITY_ALERT_PIN_FAIL_THRESHOLD` (default: `20`)
  - Failed PIN events required to trigger alert.
- `SECURITY_ALERT_PIN_FAIL_WINDOW_MS` (default: `600000`)
  - Time window for counting failed PIN events.
- `SECURITY_ALERT_COOLDOWN_MS` (default: `900000`)
  - Minimum interval between repeated alerts for the same source.

- `SQLITE_BUSY_TIMEOUT_MS` (default: `5000`)
  - SQLite busy timeout in milliseconds.
  - Useful when storage is slow or the DB file is temporarily locked.

## Deployment notes

- For production, prefer running the container with a dedicated non-root user and persistent storage mounted only for `/data`.
- Avoid sharing one SQLite file between multiple Mopay instances.
- Avoid NAS/sync folders for the live database when possible, because SQLite lock contention will degrade reliability.

## Buy Me a Coffee
If You like results of my efforts, feel free to show that by supporting me.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/pbuzdygan)
<p align="left">
  <img src="branding/bmc_qr.png" width="25%" alt="BMC QR code">
</p>
