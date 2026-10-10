# MOPAY

<p align="center">
  <img src="branding/mopay_banner.png" alt="MOPAY Banner" width="25%">
</p>


**MOPAY** is a self-hosted personal finance and home monthly payments management application.

- ✅ Modern UI (React + Vite + Tailwind)
- ✅ Backend API (Node.js)
- ✅ PWA – works offline and behaves like a native app
- ✅ Manage multiple years, entries, entry groups and savings goals, with a yearly overview
- ✅ Responsive layout: sidebar and inspector on desktop, month list and bottom tabs on phones
- ✅ Designed for self-hosting (Docker, docker-compose, reverse proxy friendly)
- ✅ Secured with encryption key
- ✅ PIN session protection for frontend and backend API
- ✅ Tagging - tag month with color and text to quickly identify needed informations
- ✅ Import - speedup on Mopay implementation by preparing data in excel and simply import entire year to mopay
- ✅ Release status indicator with GitHub release check

---
## Demo / Screenshots

### Overview
<p align="center">
  <img src="branding/v2_overview_dark.png" width="45%" alt="Overview Dark">
  <img src="branding/v2_overview_light.png" width="45%" alt="Overview Light">
</p>

### Expenses with the inspector
<p align="center">
  <img src="branding/v2_expenses_dark.png" width="45%" alt="Expenses with inspector Dark">
  <img src="branding/v2_expenses_light.png" width="45%" alt="Expenses with inspector Light">
</p>

### Incomes
<p align="center">
  <img src="branding/v2_incomes_dark.png" width="45%" alt="Incomes Dark">
  <img src="branding/v2_incomes_light.png" width="45%" alt="Incomes Light">
</p>

### Savings
<p align="center">
  <img src="branding/v2_savings_dark.png" width="45%" alt="Savings Dark">
  <img src="branding/v2_savings_light.png" width="45%" alt="Savings Light">
</p>

### Settings
<p align="center">
  <img src="branding/v2_settings_dark.png" width="45%" alt="Settings Dark">
  <img src="branding/v2_settings_light.png" width="45%" alt="Settings Light">
</p>

### Mobile
<p align="center">
  <img src="branding/v2_mobile_overview_dark.png" width="30%" alt="Mobile Overview Dark">
  <img src="branding/v2_mobile_expenses_light.png" width="30%" alt="Mobile Expenses month list Light">
  <img src="branding/v2_mobile_sheet_dark.png" width="30%" alt="Mobile entry bottom sheet Dark">
</p>

---

## Features

- Manage **financial years**
- Add, edit, reorder, group, and delete **income and expense entries**
- **Overview** of the year: income, expenses and net result compared with the previous year, month by month, where money went, savings and predictability
- **Inspector** next to the Expenses/Incomes grid: edit a month's value, the entry's name, group and comment, and its tag without leaving the table
- Track **savings goals** and progress
- **Entry groups** for better table organization in incomes and expenses
- **PIN guard** built-in with backend API session protection via `X-Mopay-Session`
- **Offline** mode (PWA, asset caching)
- **Data encryption** - your incomes and expeneses values are secured with encryption key
- **Tagging** on board - tag element with color and comment
- :fire:**Import feature**  use new function for **faster data input** or financial data **migration collected in excel sheets**. Import flow with template download, validation, year overwrite confirmation, and progress/status feedback.
- **Import scope** includes entries, groups, month tags, savings goals, and savings items
- **Release info** in settings with update check against GitHub Releases
- **Demo mode** - check how Mopay works with sample data [Demo data configuration](docs/CONFIGURATION.md#demo-mode)

---

## Run with Docker (GHCR)

The easiest way to get started is to use compose file:

Full descriptions of environment variables and optional settings are in [Configuration](docs/CONFIGURATION.md).

Notes:
- `ghcr.io/pbuzdygan/mopay:latest` tracks releases from `main`.
- `ghcr.io/pbuzdygan/mopay:dev_latest` tracks releases from `dev`.

```bash
services:
  mopay:
    image: ghcr.io/pbuzdygan/mopay:latest
    container_name: mopay
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true

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
      # Optional storage owner (defaults to 1000:1000):
      # - PUID=1000
      # - PGID=1000
      - APP_PIN=123456 #PIN 4-8 digits
      - APP_ENC_KEY=REPLACE_WITH_YOUR_KEY
      - NODE_ENV=production
      # Use only behind one trusted reverse-proxy hop (for example Nginx Proxy Manager):
      # - APP_TRUST_PROXY=1
      # - CORS_ALLOWED_ORIGINS=https://mopay.example.com
      # Optional security settings: see docs/CONFIGURATION.md


# Health check (optional but recommended)
#    healthcheck:
#      test: ["CMD", "curl", "-f", "http://localhost:8010"]
#      interval: 30s
#      timeout: 5s
#      retries: 5
```
### Generate Your APP_ENC_KEY

Result of below command is Your encryption key - store it securely - without it, Your Mopay will not start and Your data will be lost.

```bash
openssl rand -base64 32

```

Accepted formats:

- raw base64 output from `openssl rand -base64 32`
- `base64:<value>`

## Import notes

Download the Mopay template and keep its name `mopay_import_template.xlsx`. See [Import and export](docs/IMPORT_EXPORT.md) for the supported data, overwrite behavior and limits.

## Release check

Settings shows release/update information. See [release checks and metadata configuration](docs/CONFIGURATION.md#release-check), including the browser network requirement.

<a id="security-environment-variables-v153"></a>

## Environment variables

The **full environment-variable reference**, including defaults, security options and release metadata, is in [Configuration](docs/CONFIGURATION.md). See [basic variables](docs/CONFIGURATION.md#basic-environment-variables) and [security environment variables (v1.5.3+)](docs/CONFIGURATION.md#security-environment-variables-v153).

## Backend regression tests

Commands, fixture isolation, coverage and failure behavior are documented in [Testing](docs/TESTING.md#backend-regression-tests).

## XLSX import limits

Workbook size/structure limits, parsing budgets and error responses are listed in [Import and export](docs/IMPORT_EXPORT.md#xlsx-import-limits).

## Automated security checks

CI gates and their scope are documented in [Security](docs/SECURITY.md#automated-security-checks). The separate [container assessment](docs/CONTAINER_SECURITY.md) covers OS findings and remediation.

## Deployment notes

### Browser security headers

Serve the UI and API through the same browser origin. See [browser security headers](docs/SECURITY.md#browser-security-headers) for CSP, framing protection, proxy requirements and PWA updates.

- API JSON is parsed only after session authentication, except for the PIN endpoint, which has a `2 KB` limit. Normal authenticated API requests have a `64 KB` limit; authenticated import requests retain the `10 MB` limit. Export response size is unaffected.
- Mopay runs without root privileges, using UID/GID `1000:1000` by default. Set `PUID` and `PGID` in Compose to select another storage owner; see [storage ownership configuration](docs/CONFIGURATION.md#storage-ownership-uidgid).
- Startup entrypoint repairs `/data` ownership, drops privileges to the selected UID/GID and checks database write access.
- The runtime image uses existing Debian `setpriv` for privilege dropping and omits npm/Yarn and unused system SQLite. Dependencies are installed during build; run the service with `node server.js`. The reviewed Node 24.21.0 base is digest-pinned; available same-release Debian updates are applied during runtime build. See the [container assessment](docs/CONTAINER_SECURITY.md) for rebuild/scan commands and remaining vendor advisories.
- For production, keep persistent storage mounted only for `/data`.
- Bind-mounted `./data` must be writable by the configured UID/GID.
- Avoid sharing one SQLite file between multiple Mopay instances.
- Avoid NAS/sync folders for the live database when possible, because SQLite lock contention will degrade reliability.
- If logs show `SQLITE_READONLY`, repair host permissions once and restart:
  - `sudo chown -R 1000:1000 ./data && sudo chmod -R u+rwX ./data` (replace both IDs with your configured `PUID:PGID`).

## Documentation

- [Configuration](docs/CONFIGURATION.md) — full environment-variable reference, security settings and release checks.
- [Import and export](docs/IMPORT_EXPORT.md) — supported workbook data, validation limits and error responses.
- [Testing](docs/TESTING.md) — backend regressions and links to UI/container checks.
- [Security](docs/SECURITY.md) — automated checks, browser headers and deployment requirements.
- [Container assessment](docs/CONTAINER_SECURITY.md) — image scan results, remediation and remaining findings.
- [Architecture](docs/ARCHITECTURE.md) — application structure and design.

## Buy Me a Coffee
If You like results of my efforts, feel free to show that by supporting me.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/pbuzdygan)
<p align="left">
  <img src="branding/bmc_qr.png" width="25%" alt="BMC QR code">
</p>

## Search shortcuts and mobile forms

In Expenses, Incomes and Savings, press `/` or **Ctrl+K** (**Cmd+K** on macOS) to focus search when not editing another field. **Escape** clears search and leaves the field. Shortcuts do not move focus behind the PIN screen or an open dialog; Overview and Settings have no search. **Settings → Help** lists every keyboard shortcut, including table navigation, editing and Arrange mode.

Below 960 px MOPAY uses a mobile layout: a top bar with search behind an icon (the shortcuts open it) and an *Actions* menu, a bottom tab bar with Overview, Expenses, Incomes, Savings and More, and Expenses/Incomes as a month list whose entries open in a bottom sheet. Editable fields keep at least 16px text on small/touch screens to avoid small-text focus zoom; manual pinch zoom remains available. The layout was checked in Chromium mobile emulation at 320, 390 and 767 px and 900×400 landscape; real iOS/Safari keyboard behavior still needs a device check.
