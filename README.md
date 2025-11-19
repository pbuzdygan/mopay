# Docketis

Single-container app: Express + SQLite (better-sqlite3) + React (Vite) + Tailwind + Zustand + TanStack Query + Framer Motion + dnd-kit.

## Run
```bash
APP_PIN= docker compose up --build
```
App: `http://<NAS_IP>:8010`  
Health: `http://<NAS_IP>:8010/health` → `{ "status": "ok" }`

## Deployment notes for Synology DSM
- Dockerfile uses `npm install --legacy-peer-deps --no-audit --no-fund` to avoid peer-deps stalls and audit/fund noise.
- **Why not `npm ci`?** On DSM/Node 20 small lockfile/npm drifts may cause `EUSAGE`. This project does **not** run `npm ci` during build.
- If frontend build fails, the image still builds with a **placeholder** `public/index.html`. Check logs and rebuild later.

## Quick test checklist
1. `APP_PIN= docker compose up --build`
2. Open `http://<NAS_IP>:8010`.
3. Add entry (Add modal) – confirm validation.
4. Switch to `Edit → Change order` – drag rows and ensure persistence.
5. `Edit → Remove` – select multiple rows; confirm sticky footer Remove works.
6. Menu → Year operations → add/remove years.
7. Menu → Export → Select year(s) → **XLSX downloads**.
8. Menu → Settings → Toggle **Light/Dark** (Peri Mist/Ash).

## Expected boot log
```
Docketis app listening on :8010
```
