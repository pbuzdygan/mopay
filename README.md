# Mopay (no-auth)

Monthly income/expense tracker — React (Vite + Tailwind) frontend, Flask + SQLite backend.
**No authorization**. Import/Export CSV included.

## Quick start
```bash
mkdir -p ./data
docker compose up --build -d
# open
http://localhost:8080
```

## Notes (Synology DSM 7.3)
- Frontend is built with Vite and served via `serve` (static server). No proxying is required, the app calls backend at `http://localhost:8000` (set at build time).
- If you run behind Synology Reverse Proxy, map 8080 → frontend and 8000 → backend.
