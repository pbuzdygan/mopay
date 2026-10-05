# T-010: Browser security headers

- Owner: Codex
- Status: done
- Baseline: dev / 52ad702, clean worktree; T-009 committed externally.
- Scope: enforce CSP and deny framing for Express-served UI/assets/API; preserve PIN, animations, downloads, GitHub release checks and PWA. No dependencies or deployment changes.
- Threat model: untrusted content must not run inline/eval/external scripts; foreign sites must not frame financial UI. CSP supplements server authentication and escaping, does not replace either.
- Acceptance: headers on success/denial/static/fallback; browser proves forbidden script/frame blocked and existing UI still works; service worker registration/offline assets work; backend suite/build pass. Existing inline style attributes required by React/Motion allowed narrowly; external CSS/scripts disallowed; GitHub API explicitly allowed. No forced HTTPS/HSTS because local HTTP and TLS termination are deployment decisions.
- Verification: isolated HTTP/browser fixtures and loopback disposable backend; no production data/outbound calls. Document origin limitations, cached PWA update behavior and rollback (revert headers only, no data migration).

## Completion evidence

- Shared backend middleware sends enforced CSP and X-Frame-Options DENY before authentication/parsing/static/fallback routes; existing nosniff/referrer/API no-store retained. No auth/session/data or dependency changes.
- `npm --prefix frontend run build`: passed. `node --test backend/tests/*.test.mjs`: 23/23 passed with isolated loopback fixtures (initial sandbox run could not start the fixture; rerun with authorized local execution passed).
- `node --test frontend/tests/ui-transitions.mjs`: 8/8 passed under enforced CSP, zero unexpected violations. `node --test frontend/tests/browser-security.mjs`: 2/2 passed; actual Chromium blocks inline/eval/external scripts/connections and framing, permits intercepted GitHub API, registration/controlled reload/offline PWA with cached CSP and blob download.
- Browser environment: LD_LIBRARY_PATH=/tmp/mopay-browser-libs/root/usr/lib/x86_64-linux-gnu, PLAYWRIGHT_BROWSERS_PATH=/tmp/mopay-playwright, MOPAY_PLAYWRIGHT_MODULE=/home/buzsys/github/leandocs_dev/node_modules/@playwright/test. No new test dependencies.
- PWA document comment refreshes HTML MD5/precache revision; checked against saved prior build and generated sw.js. Offline clients retain old headers until online update/reload, documented.
- `docker build -t mopay-local-security:t010 .`: passed; image smoke via /tmp/mopay-t010-image-smoke.mjs passed on network-none/read-only/non-root disposable container, including actual UI/SW/API headers, native SQLite, startup/auth denial and bounded import. Log: /tmp/mopay-t010-docker-build.log.
- Node syntax checks for changed backend/test JS and `git diff --check`: passed. Changelog 1.6.2, README, project/test documentation updated.
- Unverified: Safari/Firefox, production reverse proxy/TLS, container OS CVEs; no established typecheck/lint. No commit/push/deploy. Next security step: container OS vulnerability scan.
