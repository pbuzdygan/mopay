# MOPAY Architecture

## 1. Overview

MOPAY is a self-hosted personal finance application for yearly household budgeting.
The product centers around one SQLite database and one Node.js process serving both the REST API and the built frontend.

Core capabilities implemented in the current codebase:

- yearly income and expense planning
- entry grouping within income and expense tables
- month-level tags with color and note
- savings goals with nested savings items
- XLSX export and XLSX import based on a strict template
- PIN-based access control backed by short-lived session tokens
- application-level encryption for monetary data
- PWA frontend with offline-capable assets
- release metadata and update indicator in the UI

## 2. Runtime Shape

MOPAY runs as a single container/process application:

- backend: Express server in [`backend/server.js`](.../backend/server.js)
- database: SQLite via [`backend/db.js`](.../backend/db.js)
- frontend build output: served from `/app/public` by Express

The same backend process:

- initializes schema and migrations
- validates encryption state
- stores and verifies PIN data
- exposes REST endpoints under `/api`
- serves the SPA shell for all non-API routes

## 3. Repository Structure

Key repository areas:

- [`backend/`](.../backend)
  - [`server.js`](.../backend/server.js): API, import flow, auth gating, SPA hosting
  - [`db.js`](.../backend/db.js): SQLite connection, pragmas, schema bootstrap
  - [`schema.sql`](.../backend/schema.sql): base schema
  - [`encryption.js`](.../backend/encryption.js): AES-GCM helpers and key fingerprint
  - [`migration.js`](.../backend/migration.js): encryption migration and repair
  - [`pin.js`](.../backend/pin.js): encrypted PIN hash initialization and verification
  - [`auth.js`](.../backend/auth.js): in-memory session token store
  - [`security.js`](.../backend/security.js): PIN attempt throttling, lockout, alerting
  - [`export.js`](.../backend/export.js): XLSX export and import-template generation
  - [`tagsMigration.js`](.../backend/tagsMigration.js): tag table migration
  - [`groupsMigration.js`](.../backend/groupsMigration.js): grouping migration
- [`frontend/src/`](.../frontend/src)
  - [`App.tsx`](.../frontend/src/App.tsx): app shell and global modals
  - [`api.ts`](.../frontend/src/api.ts): fetch wrapper and API bindings
  - [`store.ts`](.../frontend/src/store.ts): Zustand UI state
  - [`components/TableView.tsx`](.../frontend/src/components/TableView.tsx): income/expense table, DnD, groups, tags
  - [`components/SavingsView.tsx`](.../frontend/src/components/SavingsView.tsx): savings goals/items UI
  - [`components/ReportsView.tsx`](.../frontend/src/components/ReportsView.tsx): reports UI
  - [`components/PinGuard.tsx`](.../frontend/src/components/PinGuard.tsx): PIN unlock overlay
  - [`components/ReleaseStatusProvider.tsx`](.../frontend/src/components/ReleaseStatusProvider.tsx): release metadata polling
  - [`components/modals/`](.../frontend/src/components/modals): add/edit/import/export/settings flows
- [`Dockerfile`](.../Dockerfile): multi-stage build and runtime image
- [`docker-compose.yml`](.../docker-compose.yml): GHCR deployment example

## 4. Data Model

Base tables are created from [`backend/schema.sql`](.../backend/schema.sql), then extended/verified by targeted migrations.

Main tables:

- `years`
  - one row per financial year
- `entry_groups`
  - optional grouping of entries per `year_id` and `type`
- `entries`
  - income/expense rows
  - includes `name`, optional `comment`, optional `group_id`, `sort_index`
  - monthly values are stored in `Jan` through `Dec`
- `entry_tags`
  - one optional tag per `(entry_id, month)`
  - stores color, note text, timestamps
- `savings_goals`
  - savings containers per year
- `savings_items`
  - rows nested under a savings goal
- `meta`
  - created by migration code
  - stores encryption and PIN-related metadata such as `enc_migrated`, `enc_notice_pending`, `enc_key_fingerprint`, `pin_hash`

Important indexing currently present:

- `idx_entry_groups_year_type`
- `idx_entries_year_type`
- `idx_savings_goals_year`
- `idx_savings_items_goal`
- `idx_entry_tags_entry_month`
- `idx_entry_tags_entry`

## 5. Backend

### 5.1 Database Bootstrap

[`backend/db.js`](.../backend/db.js) opens the SQLite file from `DB_FILE` and applies:

- `journal_mode = WAL`
- `foreign_keys = ON`
- `busy_timeout` from `SQLITE_BUSY_TIMEOUT_MS` if provided

At startup, the backend also:

- runs encryption migration/repair
- runs tag migration
- runs grouping migration
- performs orphan cleanup for inconsistent legacy rows
- initializes encrypted PIN storage

### 5.2 Encryption

Monetary data is encrypted at the application layer with AES-256-GCM.

Encrypted scope:

- entry monthly values
- `savings_goals.target_value`
- `savings_items.value`
- stored PIN hash record in `meta`

Behavior:

- `APP_ENC_KEY` is mandatory
- the backend stores a fingerprint of the active key
- if the key fingerprint changes, data endpoints are blocked with HTTP `409`
- the frontend displays a dedicated mismatch modal and can trigger a destructive reset flow

### 5.3 Authentication and Session Model

MOPAY does not use user accounts. Access is protected by one application PIN.

Current flow:

1. Frontend submits PIN to `POST /api/pin/verify`
2. Backend verifies the PIN against an encrypted scrypt-based record in `meta`
3. Backend issues an in-memory session token
4. Frontend sends the token via `X-Mopay-Session`
5. `/api` routes are protected except a small public allowlist

Session implementation details:

- session storage is in-memory only
- expiration is sliding
- session metadata stores IP and user-agent
- restart clears all sessions

### 5.4 Security Controls

[`backend/security.js`](.../backend/security.js) implements:

- per-IP request throttling for PIN verification
- burst protection
- escalating lockout after repeated failures
- optional webhook alerts after high failure volume
- structured security logging

CORS is disabled unless `CORS_ALLOWED_ORIGINS` is configured.
When enabled, only explicitly allowed origins can call the API cross-origin.

### 5.5 Import/Export

[`backend/export.js`](.../backend/export.js) is responsible for:

- exporting selected years to a styled XLSX workbook
- generating the canonical XLSX import template

[`backend/server.js`](.../backend/server.js) handles import orchestration:

- validates workbook structure and sheet names
- maps import sheets to target years
- supports partial import selection
- requires explicit overwrite selection for existing years
- imports groups, entries, tags, savings goals, and savings items in a transaction
- guards against concurrent imports with an in-process lock

## 6. API Surface

Major endpoint groups:

- metadata and health
  - `GET /health`
  - `GET /api/meta`
- PIN/session
  - `POST /api/pin/verify`
  - `POST /api/pin/logout`
- years
  - `GET /api/years`
  - `GET /api/years/exists`
  - `POST /api/years`
  - `DELETE /api/years`
- entry groups
  - `GET /api/entry-groups`
  - `POST /api/entry-groups`
  - `PATCH /api/entry-groups/order`
  - `PATCH /api/entry-groups/:id`
  - `DELETE /api/entry-groups`
- entries
  - `GET /api/entries`
  - `POST /api/entries`
  - `PATCH /api/entries/:id`
  - `DELETE /api/entries`
  - `POST /api/entries/reorder`
- tags
  - `GET /api/tags`
  - `POST /api/tags`
  - `DELETE /api/tags`
- savings
  - `GET /api/savings`
  - `POST /api/savings`
  - `PATCH /api/savings/:goalId`
  - `DELETE /api/savings/:goalId`
  - `POST /api/savings/:goalId/items`
  - `PATCH /api/savings/items/:itemId`
  - `DELETE /api/savings/items/:itemId`
- import/export
  - `POST /api/export`
  - `GET /api/import/template`
  - `POST /api/import/validate`
  - `POST /api/import`
- encryption status/reset
  - `GET /api/encryption/status`
  - `POST /api/encryption/notice-ack`
  - `POST /api/encryption/reset`

## 7. Frontend

### 7.1 Composition

The frontend is a single-page React application bootstrapped by Vite.

Main screens:

- table view for incomes/expenses
- savings view
- reports view

Global modal flows include:

- add entry
- add group
- comment editing
- year operations
- export
- import
- settings
- savings goal editing
- encryption migration notice
- encryption key mismatch recovery

### 7.2 State and Data Fetching

Frontend state is split between:

- React Query for server data
- Zustand for UI/session/preferences state

Examples of Zustand-managed state:

- active tab and year
- theme mode
- edit mode
- PIN session flag
- selected reports
- modal visibility
- release channel/version metadata
- group-total display preference

### 7.3 Release Status

[`frontend/src/components/ReleaseStatusProvider.tsx`](.../frontend/src/components/ReleaseStatusProvider.tsx) performs two jobs:

- reads backend metadata (`version`, `repo`, `channel`) from `/api/meta`
- polls GitHub Releases for the configured repository and channel to determine whether an update is available

This means the browser may perform outbound requests to `api.github.com` when release information is enabled.

### 7.4 PWA

The frontend is built with `vite-plugin-pwa`.
Static assets and the manifest live in [`frontend/public/`](.../frontend/public).

## 8. Deployment

Build and runtime packaging are defined in [`Dockerfile`](.../Dockerfile):

- stage 1: install frontend dependencies and build Vite assets
- stage 2: install backend production dependencies, copy backend sources, copy built frontend

Default container/runtime assumptions:

- internal port: `8010`
- persistent database path typically mounted under `/data`
- runtime env vars include `DB_FILE`, `APP_PIN`, `APP_ENC_KEY`, `APP_VERSION`, `APP_CHANNEL`, `APP_REPO`

## 9. Current Architectural Constraints

Important constraints visible in the current implementation:

- session storage is process-local and disappears on restart
- import lock is process-local, so it only protects a single running backend instance
- the backend is concentrated in one large server file, which increases maintenance cost
- the main table UI is concentrated in one large component, which increases rendering and change risk
- release checking depends on direct client-side access to GitHub APIs

These are current characteristics of the system, not necessarily defects, but they should be considered in future refactors.
