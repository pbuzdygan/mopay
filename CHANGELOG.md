## v0.3.1 (package.json versions unchanged)
- Fix: Export XLSX query — resolved `ambiguous column name: id` by using `ORDER BY sort_index, e.id`.
- Fix: Theme system now uses `data-theme` (no link element toggling). Dark/Light (Peri Mist/Ash) works after Vite build.
- Build: DSM-friendly (`--legacy-peer-deps --no-audit --no-fund`). Port 8010, `/health` endpoint.
