# MOPAY

<p align="center">
  <img src="branding/mopay_banner.png" alt="MOPAY Banner" width="25%">
</p>


**MOPAY** is a self-hosted personal finance and home monthly payments management application.

- ✅ Modern UI (React + Vite + Tailwind)
- ✅ Backend API (Node.js)
- ✅ PWA – works offline and behaves like a native app
- ✅ Manage multiple years, entries, reports, and savings goals
- ✅ Designed for self-hosting (Docker, docker-compose, reverse proxy friendly)
- ✅ Secured with encryption key
- ✅ Tagging - tag month with color and text to quickly identify needed informations
- ✅ Import - speedup on Mopay implementation by preparing data in excel and simply import entire year to mopay

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
- Add, edit, and delete **income and expense entries**
- Generate **reports and summaries**
- Track **savings goals** and progress
- **PIN guard** built-in (secure access)
- **Offline** mode (PWA, asset caching)
- **Data encryption** - your incomes and expeneses values are secured with encryption key
- **Tagging** on board - tag element with color and comment
- :fire:**Import feature**  use new function for **faster data input** or financial data **migration collected in excel sheets**. Import flow with template download, validation, year overwrite confirmation, and progress/status feedback.

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

## Buy Me a Coffee
If You like results of my efforts, feel free to show that by supporting me.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/pbuzdygan)
<p align="left">
  <img src="branding/bmc_qr.png" width="25%" alt="BMC QR code">
</p>
