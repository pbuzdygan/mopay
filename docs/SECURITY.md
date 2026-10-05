# Security

[Back to README](../README.md) · [Security environment variables](CONFIGURATION.md#security-environment-variables-v153) · [Container assessment](CONTAINER_SECURITY.md)

Operational security documentation for Mopay users and administrators. Agent instructions are maintained separately in `.ai/SECURITY.md`.

## Automated security checks

[Security checks](../.github/workflows/security-checks.yml) run on pull requests/pushes to `main` and `dev`, and are required by the release image workflow before publication. Security checks and image publishing both pin the host runner to `ubuntu-24.04`, keeping host OS upgrades deliberate; the application's container continues to use Debian-based Node.js 24. They use SHA-pinned Node 24 actions, run backend regressions, gate on moderate-or-higher backend production and full frontend dependency advisories, and build the frontend.

After the Tailwind 4 migration, the lockfiles have zero backend production and full frontend npm audit findings (verified 2026-10-05). The vulnerable Tailwind 3/braces build chain has been removed. Full frontend audits, including build tools, now also block CI on moderate-or-higher advisories. These CI checks do not scan container OS packages or verify production proxy/TLS configuration. The separate local [container assessment](CONTAINER_SECURITY.md) records OS scanning, remediation, vendor backport discrepancies and remaining findings.

The frontend uses Tailwind CSS 4 and the official `@tailwindcss/vite` plugin. Theme tokens and explicit source discovery live in `frontend/src/styles/global.css`; obsolete Tailwind/PostCSS configuration files were removed. Utilities remain unlayered beside existing component CSS to preserve the previous cascade; reset/theme layers stay below them. Browser support follows [Tailwind 4 requirements](https://tailwindcss.com/docs/upgrade-guide#browser-requirements): Safari 16.4+, Chrome 111+ and Firefox 128+. Chromium desktop/mobile light/dark workflows were compared against the Tailwind 3 build; Safari and Firefox were not exercised locally.


## Browser security headers

Express sends enforced `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` on UI, assets and API responses, including denied requests. CSP blocks framing (even by the same origin), inline JavaScript, `eval`, plugins, embedded frames and external scripts/styles. Assets, manifests, workers and API calls are same-origin; `https://api.github.com` is explicitly allowed for release checks. Style attributes remain allowed for React/Motion positioning, animations and charts; inline style elements are blocked. Blob downloads remain supported.

Serve the built UI and `/api` through the same browser origin, including when using a reverse proxy. A cross-origin `VITE_API_BASE` is outside this policy and will be blocked even if CORS permits it. Preserve these headers at the proxy; additional CSP headers intersect with this policy rather than replacing it. Framing the app in another dashboard is intentionally disabled. HSTS/HTTPS redirects remain the responsibility of a deployment with configured TLS; local HTTP is still supported.

Existing PWA installations need an online service-worker update and reload to receive the new policy; previously cached documents cannot gain headers while offline. This release changes the document revision so the new worker refreshes its precached HTML with the headers. Browser enforcement, PIN/modal/table flows, service-worker registration, controlled reload, offline assets and blob downloads were checked in Chromium on synthetic fixtures; Safari/Firefox and production proxy configuration were not checked. See [browser security tests](../frontend/tests/README.md). Rolling back the header middleware requires no database migration; cached clients also need an online update/reload.

