# Changelog

## v1.5.4

### Bug fix
- refactored bulk remove trigger flow: removed global `window` event dependency and replaced it with explicit Zustand request signaling (`bulkRemoveRequestId`), reducing cross-component coupling and preventing event-listener drift
- stabilized optimistic table updates by moving from full local data copies to per-entry overlay patches, reducing risk of state desync between React Query cache and UI
- fixed import modal error handling: switched from brittle `JSON.parse(err.message)` to structured `ApiError` parsing (`status`, `body`, `retryAfterSeconds`)
- fixed import overwrite flow reliability by correctly handling backend `OVERWRITE_REQUIRED` payload (`years`) without dropping validated import payload state
- fixed backend entry update/create validation gaps: `name`, `comment`, `sort_index`, and month values are now validated and normalized before DB write/encryption
- runtime image now drops root privileges (`USER node`) before starting Mopay backend
- fixed non-root startup compatibility for existing bind-mounted DB volumes by adding runtime entrypoint ownership repair before dropping privileges
- hardened runtime entrypoint DB permission checks with explicit `SQLITE_READONLY` diagnostics when host bind-mount permissions block writes

### New Features
- added table query-state composition hook `useTableQueryState` to centralize entries/groups/tags reads and optimistic entry overlays
- added reusable table layout rows (`TableHeaderRow`, `TableTotalRow`) to separate static rendering concerns from interaction logic in `TableView`

### Improvements
- performance-oriented `TableView` architecture update:
  - removed duplicated local mirrors for groups/tags query data
  - narrowed store subscriptions in hot paths and reduced broad state reads
  - converted core row/group render blocks to memoized components
  - kept optimistic reorder/group/name/month updates while reducing full-list rewrites
- maintainability improvements:
  - introduced typed table models in `frontend/src/components/table/types.ts`
  - reduced `TableView` responsibilities by moving query/overlay logic and UI-only rows to dedicated modules
  - import UI now uses a dedicated error classifier for `OVERWRITE_REQUIRED`, `IMPORT_IN_PROGRESS`, `SQLITE_BUSY`, auth/session errors, and encryption-key mismatch responses
  - backend entries now use shared normalizers for payload validation (`normalizeEntryName`, `normalizeEntryComment`, `normalizeEntrySortIndex`, `normalizeEntryMonthValue`) to prevent invalid encrypted values from being persisted
  - hardened compose defaults with `security_opt: no-new-privileges:true` for both GHCR and local-build deployment flows
- documentation update:
  - refreshed `README.md` and `docs/ARCHITECTURE.md` to reflect current grouping, import scope, PIN session model, release check behavior, and deployment/security notes
- UI improvement: introducing icons instead of text

## v1.5.3

### Bug fix
- lockout UX fix: the PIN attempt that crosses the failure threshold now returns immediate `429 LOCKOUT` (with `Retry-After`) without requiring page reload/new tab

### New Features
- added optional webhook-based security alerting for high-volume failed PIN attempts (`SECURITY_WEBHOOK_URL` + alert thresholds)
- Pin Guard: implemented server-side PIN sessions (issued on `/api/pin/verify`, revoked on `/api/pin/logout`) with sliding expiration and in-memory token store

### Improvements
- Pin Guard: added brute-force protections for PIN verification:
  - per-IP rate limiting (minute + burst window)
  - progressive lockout after repeated failures
  - `Retry-After` response header on temporary blocks
  - minimum response delay to reduce timing/oracle value
- Pin Guard: added security audit logging for auth denials, PIN failures/successes, and rate-limit/lockout events
- UI improvement: introducing icons as replacement of "named actions"
- Pin Guard: security hardening:
  - backend API now requires an active PIN session token (`X-Mopay-Session`) for all protected `/api/*` routes
  - CORS hardening: wildcard reflective CORS removed; cross-origin API access now opt-in via `CORS_ALLOWED_ORIGINS`
  - frontend lock flow now revokes backend session token (not only UI state), and PIN unlock invalidates queries to refresh secured data immediately

## v1.5.2

- UI corrections - fields in the incomes and expense tables dont resizing entire row while in input mode
- Improvement of mobile view and introducing compact view to simplify using on mobile screens
- Improvement in UI animations - eliminating places where loading content was causing "blinking" - now transitions are smooth
- PWA cache improvement - now properly recognise new releases without enforcing page reload
- Github workflow fix:
  - ```dev``` releases build+push to ```:dev_latest``` (including versioned ```:dev_<version>```) without touching ```:latest```
  - ```main``` releases build+push to ```:latest``` (including versioned ```:<version>```)

## v1.5.1

- :fire: Introducing dash "-" in value fields as "N/A" - gives option to ignore cell in calculations (avg, reports/stability)
- import now preserves tag notes from Excel and maps tag colors (unsupported/missing colors with notes fall back to grey)
  - supported colors (they are the main colors form excel color picker):
    - #D9D9D9 → grey
    - #FF0000 → red
    - #FFC000 → orange
    - #92D050 → green
- maintenance cleanup removes orphaned data on startup (logged)
- improving Import and export menu UI - more consistent, less buttons
- import overwrite preflight: shows exact years to overwrite and prevents accidental skips when DB changes between validate and import
- backend now handles `SQLITE_BUSY` more gracefully (busy_timeout + friendly errors) and serializes imports to avoid concurrent overwrite conflicts

## v1.5.0

- :fire: New feature - now incomes and expenses can be moved into collapsible groups. To make life easier, export and import feature now supports grouping also.
- update notification improvement - release info moved to Setting menu, update notification visible on navigation bar only when new update released
- UI improvements ended in recreating "Edit mode" menu - all operations in one place
- minor UI improvements mainly focusing on paddings and properlu using UI's space

## v1.4.0

- :fire::boom: **Import feature** has been implemented - Import flow with template download, validation, year overwrite confirmation, and progress/status feedback.
- security fix for exceljs library and its dependencies

## v1.3.7 - Tagging feature improvements

- security fix for frontend and backend based on npm audit results
- addjusting/improving mobile operations on **Tagging** feature
- UI improvement - main table has more narrow entries heights

## v1.3.6 - UI improvements

- compact mobile view - better adjustments of spacings and improvements
- compact na full view improvments
- settings menu improvement and reorganization - more compact in "settings style" with toggles

## v1.3.5 - Year operations modal imprvements

- correcting year deletion behavior (now with confirmation)
- relocating operation confirmation (for year removal and add) - no more inconsistent window
- new year picker area - now marking year for deletion shows visible "red" as warning also list of years builds horizontally to safe space/optimize window

## v1.3.4 – Mobile modals & VA fixes

- improvements in compacted modal layout on mobile/responsive screens (less padding/spacing, desktop untouched)
- Version Awareness now consistently picks the newest release per channel (dev/main) instead of relying on API order

## v1.3.3 – Dev channel & VA refinements

- release workflow tags dev builds improvements (devN and latest at the same time)
- backend/frontend version awareness now detects whether the instance runs on `main`/`latest` or `dev_latest` and only suggests upgrades from the matching branch
- polished the settings modal lock button and “Working on year …” caption to align with the rest of the UI

## v1.3.2 – Minor corrections to the UI

- small dropdown menus corrections - improving UI clarity

## v1.3.1 – Tagging implementation

- small correction to the implemented tagging feature

## v1.3 – Tagging implementation

- Added structured tags per entry/month with Tag Builder mode (color highlight + hover details).
- Introduced backend `entry_tags` table, migration, and `/api/tags` endpoints.
- Updated UI (TableView, Edit menu) plus docs (`ARCHITECTURE.md`).
- Excel export now reflects tag colors and embeds tag notes as spreadsheet comments.

## v1.2.5 – UI alignment fixes

- tightened year dropdown menu/button sizing and made tables stretch correctly across months

## v1.2.4 – Adjusting VA feature and mobile view

- removing hover tip on VA feature
- normalizing year selector style in mobile view

## v1.2.3 – Minor adjustment of VA feature

- correcting tag string building

## 1.2.2 – Corrections of Version awareness feature and year selector

- adjusting style of VA feature (Version awareness)
- adjusting handling default year selector in "missing-cache" scenario

## 1.2.1 – Version awareness feature relocation in UI

- Relocation of Version awareness feature from footer are to banner area for better visibility

## 1.2 – PWA prompt tweaks & Version awareness

- Restyled the add-to-home-screen notification to align with the core UI buttons/fonts and added a Skip action with session persistence.
- Docker build now injects the release/tag into the image, exposing `/api/meta` with backend/app version data.
- UI footer displays the running Mopay version and pings GitHub Releases to show an “Update available” badge when a newer tag exists.

## 1.1.1 – UI language adjustments

- Translated remaining Polish UI strings (PWA install banner, offline mode bullet) to English.
- Updated PWA manifest description and encryption notice text files to match the new copy.
- README screenshot captions now use English labels (Savings, Reports, Settings).

## 1.1 – Data encryption

- Added transparent encryption for all monetary data:
  - monthly values in entries (`Jan`–`Dec` for incomes/expenses),
  - savings goals target values,
  - savings items values,
  - PIN is now stored as a salted hash wrapped in encryption.
- Mopay now requires an encryption key via `APP_ENC_KEY`:
  - generate a key, for example: `openssl rand -base64 32`,
  - set it in your Docker config, e.g. `APP_ENC_KEY=base64:...` in `docker-compose.yml`.
- Existing databases:
  - on first start with a valid `APP_ENC_KEY`, Mopay encrypts all existing numeric values in-place,
  - the app shows a one-time in-app notice that your data has been encrypted.
- Missing key:
  - if `APP_ENC_KEY` is not set, the backend does not start and logs:
    `Error: APP_ENC_KEY environment variable is required for Mopay to start.`  
  - running Mopay without encryption is no longer supported.
- Changed key (mismatch with existing data):
  - Mopay detects when `APP_ENC_KEY` does not match the key used to encrypt the current database,
  - access to data is blocked and a clear message is shown:
    `Your APP_ENC_KEY has been changed! Revert to previous encryption key to keep your data.`,
  - in the UI you can either:
    - restore the previous `APP_ENC_KEY` in your Docker config to keep all data, or
    - wipe all stored data and start fresh with the current key (requires a two-step confirmation in a red “Confirm reset” dialog).
