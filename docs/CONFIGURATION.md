# Configuration

[Back to README](../README.md) · [Security](SECURITY.md)

This is the environment-variable reference for basic setup, release metadata and optional security controls. Keep credentials in your deployment environment; use the quick-start example in [README](../README.md#run-with-docker-ghcr) as a starting point.

## Basic environment variables

| Variable | Default / requirement | Description |
| --- | --- | --- |
| `PORT` | `8010` | Port used by the backend inside the container. |
| `DB_FILE` | `./mopay.sqlite` outside the Docker example | SQLite path; use `/data/mopay.sqlite` with persistent Docker storage. |
| `APP_PIN` | Required, 4–8 digits | PIN used to unlock the application and obtain an API session. |
| `APP_ENC_KEY` | Required | Base64-encoded 32-byte encryption key, optionally prefixed with `base64:`. Keep the key securely for the existing database; see [key generation](../README.md#generate-your-app_enc_key). |
| `NODE_ENV` | `production` in the runtime image | Node.js execution environment. |
| `VITE_API_BASE` | Empty, frontend build | Uses the same browser origin by default. A cross-origin value is blocked by the served UI's CSP; use a same-origin reverse proxy as described in [browser security headers](SECURITY.md#browser-security-headers). |

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
- `APP_PIN_MAX_CONCURRENT` (default: `2`)
  - Max number of concurrent PIN hash checks. Additional requests receive `429` and can retry.
- `APP_PIN_MAX_TRACKED_IPS` (default: `10000`)
  - Max number of IP entries retained by the PIN rate limiter and alert tracker.
- `APP_TRUST_PROXY` (default: empty)
  - Number of trusted reverse-proxy hops. Set `1` when Mopay is reached through one Nginx Proxy Manager hop.
  - Leave empty when Mopay is accessed directly. Mopay does not add or configure a proxy container.

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


## Optional security configuration example

The quick-start example omits optional settings for readability. Add the relevant entries to its `environment` section after reviewing the descriptions above:

```yaml
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
      # - APP_PIN_MAX_CONCURRENT=2
      # - APP_PIN_MAX_TRACKED_IPS=10000
      # Use only behind one trusted reverse-proxy hop (for example Nginx Proxy Manager):
      # - APP_TRUST_PROXY=1
      # - CORS_ALLOWED_ORIGINS=https://mopay.example.com
      # - SECURITY_WEBHOOK_URL=https://example.com/webhook
      # - SECURITY_ALERT_PIN_FAIL_THRESHOLD=20
      # - SECURITY_ALERT_PIN_FAIL_WINDOW_MS=600000
      # - SECURITY_ALERT_COOLDOWN_MS=900000
      # - SQLITE_BUSY_TIMEOUT_MS=5000
```

## Release check

- The frontend can display release/update information in Settings.
- Release status is resolved from backend metadata and GitHub Releases for the configured repository/channel.
- In restricted environments, outbound browser access to `api.github.com` may be required for update detection.


### Release metadata variables

| Variable | Scope | Default / purpose |
| --- | --- | --- |
| `APP_VERSION` | Docker build argument and backend runtime metadata | `dev`; release workflow supplies the release tag. |
| `APP_REPO` | Docker build argument and backend runtime metadata | `pbuzdygan/mopay`. |
| `APP_CHANNEL` | Docker build argument and backend runtime metadata | `main`; use `dev` for development releases. |
| `VITE_APP_VERSION` | Frontend build | Populated from `APP_VERSION` by the Dockerfile. |
| `VITE_GITHUB_REPO` | Frontend build | Populated from `APP_REPO`; controls the browser's GitHub release lookup. |
| `VITE_APP_CHANNEL` | Frontend build | Populated from `APP_CHANNEL`. |

The prebuilt frontend's `VITE_*` variables are fixed at build time. Runtime backend metadata alone does not rebuild its GitHub repository configuration. For release checks, allow browser connections to `api.github.com` as described in [browser security headers](SECURITY.md#browser-security-headers).
