# Mopay

Full-stack Mopay app (React + Vite + Tailwind + Flask + SQLite) — ready for Docker.

## Quick start
1. create data dir: `mkdir -p ./data`
2. export a PIN (min 8 chars): `export MOPAY_PIN='yourlongpin123'`
3. docker-compose up --build -d
4. open http://localhost:3000

**Do not commit your PIN** into git. Configure it in environment or a secret manager.
