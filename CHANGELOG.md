# Changelog

## v2.0.0 (unreleased)

New Final Ledger user interface. Data, API, database, encryption, configuration, Docker setup and XLSX formats are unchanged; no migration is required.

### Breaking UI changes
- **new navigation**: on screens 960 px and wider a sidebar holds the working year, Overview, Expenses, Incomes and Savings (with yearly totals), Settings, Lock session, the theme switch and the version/update link; each page has a header with search, an *Edit* menu and a *New entry* split button (with *New group*). The toolbar and its menu are gone
- **Reports is renamed Overview**, is listed first and is always the start page after loading or unlocking; the selected year is still remembered
- **Tags mode is removed**; tags are set in the inspector (desktop) or the bottom sheet (mobile)
- **a single click on a month only selects it**; a double-click or Shift+Enter opens the inspector, and Enter, F2 or typing a number edits the value in place
- **Settings is a page** (sidebar *Settings*, or *More → Settings* below 960 px) with Display, Security, Years, Import & export, About, Help and Danger zone, each shown on its own when chosen in the section menu; it replaces the Settings and Year operations dialogs
- **new mobile layout below 960 px**: a top bar with search behind an icon and an *Actions* menu (New entry, New group, Arrange, Remove), and a bottom tab bar (Overview, Expenses, Incomes, Savings, More); More holds Settings, the working year, theme and Lock session. Expenses and Incomes are a **month list** instead of the horizontally scrolling year grid
- search is no longer shown on Overview; `/` and Ctrl/Cmd+K focus the search field of the current page (below 960 px they open it)

### Improvements
- Final Ledger design tokens (colours per theme meeting WCAG AA text contrast, spacing, radii, type scale, motion, z-index) and base components (buttons, fields with visible labels, hints and inline errors, callouts, dialogs, menus, switches) used across the app
- redesigned the PIN screen, first-run year dialog, encryption dialogs and the application-mode error page
- the new entry, new group, export and import dialogs and the install prompt use the base components; import and export results are announced to screen readers, and the install prompt stays above the mobile tab bar
- dialogs use a shared frame: Escape closes dismissible dialogs, keyboard focus stays inside the open dialog and returns to the control that opened it; required dialogs (first-run year, encryption key mismatch) cannot be dismissed
- menus and the year selector can be operated with the keyboard (arrow keys, Home/End, Enter, Escape); animations respect the system reduced-motion setting
- Expenses and Incomes use a new grid: a table with a sticky header, entry-name column and total row; quiet group rows with optional subtotals; the current month highlighted; tags shown as a coloured bar on the month (with a corner mark and tooltip for notes); a comment marker next to entry names; and an empty-year message. At 1440 px all twelve months, Sum and Avg are visible without horizontal scrolling
- a summary strip above the grid shows the year total, monthly average, current month compared with the average and the highest month (desktop)
- Arrange and Remove modes show a banner explaining the mode; in Remove mode a bar below the grid names the selection (for example "Remove 1 group and 2 entries") and offers *Clear selection*
- removing selected entries and groups now asks for confirmation and states which entries move to Ungrouped; previously the selection was deleted immediately
- Expenses and Incomes have an inspector panel on the right (a bottom sheet below 960 px) that replaces the details panel and the tag popover. It shows the selected month's value with quick fill (previous month, average, clear), the entry's name, group and comment, the month's tag colour and note, and a 12-month chart with sum, average, change against the previous month and the same month of the previous year (matched by entry name). Group rows open group details (rename, add entry, arrange, remove). In demo mode it is read only
- in the grid, Tab saves and moves to the next month, arrow keys, Home and End move between months, Shift+Enter opens the inspector and Escape closes it; an open inspector follows clicks on other months and closes with a click outside the table
- the inspector of a month shows the value, the entry's name and group with an *Entry details* link, the tag and the chart; name, group, comment and *Remove entry* are in the entry details (click the entry name, or *Entry details*), so the fields are no longer shown twice
- inspector fields save on their own (name and tag note on Enter or when leaving the field, group and tag colour on change, comment when leaving the field) and show *Saving…*/*Saved hh:mm*; *Save changes* and *Cancel* are gone, and Escape reverts a changed field
- Arrange mode can also be used with the keyboard (Space picks up a row, arrow keys move it, Space drops it)
- Overview has a new layout: income, expenses, net result (each compared with the previous year) and savings in goals at the top, then the year month by month, where money went next to the savings overview, and predictability
- clicking a month on Overview opens Expenses with that month's column highlighted and its first cell focused (below 960 px the month list opens on that month); *Open savings* goes to Savings
- Where money went shows expense groups as horizontal bars instead of a donut chart; groups and top entries use the same scale (share of expenses)
- Overview month cards mark the current month, show the net result in whole units (exact values in the tooltip) and label months without data
- Savings shows a list of goals with progress next to the selected goal's details: balance against the target, remaining amount, contributions, withdrawals and the items
- savings items are added with a form (note, amount and *Contribution* or *Temporary withdrawal*) instead of an empty row; a withdrawal is marked next to its note
- removing a savings goal now asks for confirmation in a dialog that says how many items are removed; the goal menu (⋯) holds *Remove goal*
- new theme option **System** that follows the device setting
- creating a year now makes it the working year
- deleting years moved to the Danger zone: the working year cannot be deleted (so at least one year always remains and the working year stays selected), the selected years must be typed to confirm, and a reminder offers an export first
- Settings → About shows when updates were last checked and offers *Check again*; Security shows whether encryption is active
- new Settings → **Help** section lists all keyboard shortcuts by area (search, table, value editing, inspector, Arrange, menus and dialogs, savings items, month list)
- in demo mode, Settings explains why years and import are not available instead of hiding them
- the month list (below 960 px) steps between months, shows the month's income, expenses and net and the previous month per entry; tapping an entry opens a bottom sheet with the same sections and saving as the desktop inspector; Arrange and Remove work directly in the list
- 44 px touch targets in the mobile bars, lists and sheets; editable text stays at 16 px on small and touch screens
- the Expenses/Incomes grid renders faster with 200 entries (cached switch about 20 % faster than v1.6.3 on the reference host)
- removed the previous design's unused components, stylesheets and icons; the CSS bundle shrank from 182 kB to 80 kB (gzip 30 kB to 15 kB)
- added accessible names and dialog semantics to controls (dialogs and their close button, PIN overlay, year selector, month cells, remove checkboxes, reorder handles, tag editor, savings item fields and Settings toggles)
- moved browser-test selectors to shared role/name-based helpers and added feature-parity regressions with request-payload checks for value editing, the inspector, Arrange/Remove, savings, years, export, the import flow (validation, overwrite confirmation, retry), Settings, encryption dialogs, the install prompt and the mobile layout, plus a grid render-time measurement
- a backend demo-mode regression no longer fails on slow CI runners: the test waits up to 15 s for its fixture server instead of 3 s

### Bug fix
- a newly added savings item now reliably opens for editing; previously it could stay closed when the refreshed list arrived late
- a failed removal of selected entries or groups is now shown in the Remove bar and can be retried; previously it failed silently
- a failed save of a month value is now shown with *Retry* and *Undo change*; previously the value looked saved although the server had rejected it
- Escape in the savings goal target field now restores the saved target; previously the typed value stayed
- failed savings changes (adding or editing a goal, adding, saving or removing an item, removing a goal) are now shown and can be retried; a failed item add no longer leaves an empty item behind
- adding a year in Settings now switches to it; previously the working year jumped back to the previous one
- failures when adding or deleting a year or downloading the import template are now shown
- typing into a month without a value no longer saves a negative number ("55" became "-55" after Enter, F2 or a double-click) or 0 (in the inspector); the editor opens empty, an existing value is selected so typing replaces it, and leaving a month unchanged saves nothing. The fault was already present in v1.6.3
- saving a value with Enter no longer reopens a closed inspector
- an import error (for example another import running, a busy database or an expired session) is now shown when years are marked for overwrite; previously the message was cleared immediately, and changing the year selection now clears an earlier result instead

### Upgrade notes
- no data, database, API, encryption-key or configuration migration; the Docker image, environment variables, mounts and XLSX import/export formats are unchanged
- browser preferences carry over: the working year (normal and demo), theme, table density and group totals. The theme choice is also stored under a new `themeMode` key that older versions ignore; the app always opens on Overview
- rollback: run the previous image (v1.6.3); stored preferences stay compatible

## v1.6.3

### Bug fix
- restored saved group collapse state before painting Expenses/Incomes tables, preventing expanded rows from briefly flashing when switching menus or years
- updated proxy-addr to 2.0.8 to fix IPv4-mapped IPv6 trust-subnet IP spoofing (GHSA-jqcg-44mw-7w3h)
- updated source-map-js to 1.2.2 to fix indexed source-map offset denial of service in frontend tooling (GHSA-68fv-2mgg-jv7q)

### Improvements
- added APP_DEMO opt-in read-only demonstration mode with a separate clearly named database, public demo PIN, two sample years and recoverable one-time generation; normal startup rearms the next demo activation without mixing sample and existing data

## v1.6.2

### Bug fix
- prevented small mobile form text from triggering focus zoom by preserving at least 16px editable text, including search, PIN, table fields and dialogs, without disabling user zoom
- fixed the PIN login overlay briefly flashing back after a successful unlock and preserved mobile card alignment during its exit animation
- bounded XLSX import/validation archive expansion and worksheet structure, isolated parsing with a time/heap budget, and prevented concurrent parsing from exhausting the backend
- fixed malformed export requests and asynchronous XLSX download failures that could terminate the backend; export years are validated, limited to 100 per request, and deduplicated
- made entry patches atomic: rejected fields or database failures no longer leave changed groups, neighbouring row order, or partially saved values
- rejected non-finite savings item amounts on creation, matching existing update validation
- removed the whole-table dimming animation when switching Expenses/Incomes or years, including unnecessary fading of cached tables
- fixed competing CSS and Motion opacity animations on shared modal overlays that could cause flashes when opening or closing dialogs
- fixed a one-frame opacity reset at the end of native fade animations in shared dialogs and entry/group details panels
- simplified entry/group details transitions and replaced animated full-screen backdrop blur with stable dimming for shared dialogs and details panels

### Improvements
- added configurable container storage ownership via `PUID`/`PGID` (default `1000:1000`), validated non-root IDs, ownership repair limited to `/data`, and database permission checks after dropping privileges; aligned the Docker database default with `/data/mopay.sqlite`
- shortened README by moving detailed configuration, import limits, regression tests and browser/CI security documentation into linked guides under docs
- moved mobile search into the year/menu/lock/theme row, using available space between Menu and Lock; added `/` and Ctrl/Cmd+K search focus shortcuts that preserve editing and modal/PIN focus
- hardened the runtime image with a digest-pinned Node 24 base and Debian security updates, removed runtime npm/Yarn and unused system SQLite, and replaced gosu with existing setpriv; verified privilege dropping, permission denial and SIGTERM handling and documented full container scan results and residual vendor advisories
- enforced a restrictive browser Content Security Policy and denied framing of the app, while preserving PIN animations, GitHub release checks, blob downloads and PWA offline assets; refreshed the PWA document revision for adoption of the new headers
- migrated to Tailwind CSS 4 with its official Vite plugin, preserving existing theme/layout behavior and removing the vulnerable Tailwind 3/braces build chain; full frontend dependency audits now gate CI
- pinned security and image-publishing runners to Ubuntu 24.04 to avoid automatic host OS changes during the ubuntu-latest migration
- patched compatible backend and frontend build dependencies; upgraded and SHA-pinned GitHub Actions to Node 24
- added recurring backend security regressions, dependency audit gates and frontend build checks before image publication
- expanded Git and Docker ignore rules for dependencies, generated builds/test reports, local environment and credential files, SQLite data, logs and temporary/editor artifacts; Docker builds also exclude test sources and local agent context

## v1.6.1

### Bug fix
- fixed an infinite React update loop when table query data was temporarily unavailable (for example after an expired session), which could leave the entry details panel stuck in `Saving…`
- corrected Settings toggle UI alignment and UI elements visibility
- corrected Expense and Income tables reaction on entering value field

### Improvements

- Improving UI elements ergonomy, look and behaviour
  - widened the desktop workspace and introduced aligned, flexible amount columns sized for six-digit monthly values and larger sum/average totals
- Compact view introduction
  - added a persistent `Normal` / `Compact` view preference that applies denser typography and spacing across the entire desktop application while preserving mobile touch targets
  - extended Compact density to mobile views
- added an accent-aware search field beside the main navigation with instant filtering for Expenses, Incomes, and Savings, automatic reset when changing sections, and a clear active-filter state
- Reports section improvements, reorganization and new section introduction (Savings Overview)

## v1.6.0

### Bug fix
- fixed PIN rate-limit and security-alert state cleanup so expired per-IP entries are pruned correctly and retained state cannot grow without a configured bound
- UI adjustments and fixes

### New Features
- current month marker for current year (now you see current month at glance)
- redesigned Savings goals as a full-width
- redesigned Reports as a single responsive yearly financial overview
- added previous-year percentage comparisons to the Reports annual metrics
- redesigned Expenses and Incomes table operations around a context-first workspace

### Improvements
- dependency and runtime security maintenance:
  - upgraded build and runtime images from Node.js 20 to Node.js 24 LTS and declared Node.js 24 as the supported runtime
  - updated backend/frontend dependencies and lockfiles, including patched transitive versions of `body-parser`, `path-to-regexp`, `qs`, `tmp`, and `uuid`
  - made backend production dependency installation reproducible with bundled `better-sqlite3` prebuilds and lifecycle scripts disabled
- API request DoS hardening:
  - protected API JSON bodies are now authenticated before parsing
  - added dedicated JSON limits: `2 KB` for PIN verification, `64 KB` for standard authenticated API requests, and `10 MB` for authenticated import requests; export response size is unaffected
  - moved PIN hashing to asynchronous `scrypt` and added a configurable concurrent verification limit (`APP_PIN_MAX_CONCURRENT`, default `2`) with `429` backpressure
  - capped retained PIN rate-limit/audit IP state with `APP_PIN_MAX_TRACKED_IPS` (default `10000`)
- lightweight HTTP hardening:
  - disabled the Express `X-Powered-By` header and added `X-Content-Type-Options`, `Referrer-Policy`, and no-store caching for API responses
  - added optional trusted reverse-proxy hop configuration through `APP_TRUST_PROXY` without bundling a proxy service in Docker Compose

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
