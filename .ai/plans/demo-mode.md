# Demo mode implementation plan

## Intended outcome

Setting `APP_DEMO=true` and recreating the container opens a dedicated, populated demonstration database. Missing, empty or `false` means normal mode. Demo never opens the normal database for application writes, changes its PIN, or inserts sample records into it. This document plans implementation; no application changes or deployment are included yet.

Demo is read only for financial data. Users can log in, browse Expenses/Incomes/Savings/Reports, select either sample year, search, collapse groups and change local presentation settings. Creating, editing, reordering and deleting records or years, importing data and resetting encryption are unavailable and denied by the backend.

The public demonstration PIN is `1234`, explicitly shown on the demo login screen and in a demo-only startup message. It is a public demo access code, not a secret or a fallback for normal authentication. Normal mode continues to require `APP_PIN`; both modes retain the existing `APP_ENC_KEY` requirement and fingerprint safeguards. Do not log the normal PIN or encryption key.

## Activation and storage contract

| Successful startup | Result |
| --- | --- |
| Normal mode, no previous demo | Existing normal behavior; no demo files need to be created. |
| First demo activation | Create and seed the demo database once. |
| Demo restart while still enabled | Reuse the same sample years and generation; no reseeding. |
| Normal startup after demo | Use the normal database; mark the demo cycle inactive without opening or deleting the demo database. |
| Demo startup after observed normal startup | Refresh only the application-owned demo data in one transaction. |
| Interrupted or failed startup | Recover consistently on retry; never leave a successful partial seed or silently fall back to the normal database. |

- Configuration takes effect at process startup. A successful startup with demo disabled must occur between activations; edits to `.env` that are never applied cannot be detected. Mopay never rewrites the environment variable or Compose configuration.
- `DB_FILE` continues to identify the normal database. Derive the demo path from it before importing/opening the database: `/data/mopay.sqlite` -> `/data/mopay.demo.sqlite`; `/data/finanse.sqlite` -> `/data/finanse.demo.sqlite`. Preserve a `.db` extension similarly; for other filenames append `.demo.sqlite`. Resolve relative paths once against the startup directory.
- Keep a small versioned state file beside the demo database, e.g. `/data/mopay.demo.state.json`. It stores activation/generation metadata only, with no financial records or credentials. Persist it in the same mounted storage.
- Trim the environment value and accept `true`, `false` or empty/missing; reject other values with a clear configuration error before database initialization. Use one backend configuration parser and verify the entrypoint selects the same paths.
- Mark demo ownership, seed version, sample years and generation ID in demo database metadata. An existing database without the expected ownership marker must never be cleared or claimed as demo. Check existing ownership before schema/migration writes, using a read-only inspection where necessary.
- Reject demo paths that alias the normal database through symlinks/hard links, and unsafe state-file destinations. Do not permit a demo-owned database to be opened as the normal database by an accidental `DB_FILE` setting. Path conflicts fail visibly.
- Refresh owned demo records transactionally rather than unlinking an open SQLite database or its WAL/SHM files. Do not delete the entire storage directory.
- Normal mode only updates an existing demo state file after normal initialization succeeds; it does not require demo metadata on installations that have never enabled demo. Demo metadata errors must be visible, not silently interpreted as permission to reset.

## Implementation sequence

### 1. Runtime configuration and database selection

- Introduce a small backend module for mode parsing, normal/demo paths and activation state. Keep `DB_FILE` semantics stable; do not overwrite it with the demo path and then derive another path from it.
- Update `backend/db.js` so selection and ownership checks happen before `new Database`, WAL/schema initialization and the server's migrations, orphan cleanup or PIN initialization.
- Update `docker/entrypoint.sh` to check the effective database and state directory permissions as the configured non-root identity. Demo must not require opening or write-checking the inactive normal database. Preserve existing PUID/PGID and ownership policy.
- Keep one application process per storage set, as currently required. Reject incompatible state versions and corrupt files with actionable errors; do not add automatic destructive recovery.

### 2. Recoverable activation and deterministic sample generator

- Implement generation state with an inactive flag and a pending/committed generation ID. Before seeding, atomically reserve the intended generation in the state file. Store the same ID with all seeded data inside one SQLite transaction; then atomically mark the activation committed.
- On retry after interruption, compare state and database generation IDs. A committed database generation only needs state finalization; an uncommitted seed is retried. Repeated `true` startups never allocate a new generation after successful activation.
- Re-enabling after a successful normal startup starts a new generation. Clearing old demo records, inserting replacements and updating demo metadata must commit together, or preserve the old generation on failure.
- Add a bounded generator using existing schema, parameterized statements and `encryptNumber` for all monetary values. Do not import XLSX, use real data, call external services or introduce dependencies.
- Freeze current year and previous year when reserving a generation. Suggested per-year fixture: 7 expense groups / 25 entries, 3 income groups / 6 entries, 4 savings goals with several contributions, comments and tags. Include recurring costs, seasonal payments, varied incomes and savings goals at different completion levels.
- Use fixed formulas instead of randomness. Past year has all months; current year has amounts through the current month and empty future months. Include some ungrouped entries to demonstrate that workflow. Provide coherent report totals and comparisons, and persist generation years across New Year restarts.
- Initialize the demo PIN only in the selected demo database. Retain existing encryption verification; a key mismatch fails safely without exposing data or auto-clearing either database. Normal mode retains current credential behavior.

### 3. API contract and write restriction

- Extend `/api/meta` with `demo: boolean` and a public `demoPin` only when demo is enabled. Never expose `APP_PIN`, database paths, key material or sample financial records through public metadata.
- Add centralized demo enforcement after authorization and before protected handlers/body parsing where practical. Permit authenticated reads plus an explicit small allowlist of non-financial-write POST operations: PIN verify/logout and XLSX export. Export remains bounded and uses only the active demo database.
- Deny all other protected mutating operations with `403` and `{ error: 'DEMO_READ_ONLY', message: 'Demo mode is read only.' }`. Cover imports/validation, years, entries, groups, tags, savings, reordering and encryption notice/reset. New mutating routes must default to denied in demo.
- Keep existing PIN rate limits, authentication, sessions, CSP, import limits and normal-mode API behavior. Logout remains possible. Process restarts invalidate in-memory sessions; an old browser token must not grant normal access after switching out of demo.
- Suppress production security webhooks in demo so public demo traffic cannot trigger configured external alerts; retain local security enforcement and appropriate local logs. Normal integrations remain unchanged.

### 4. Frontend mode initialization and presentation

- Load mode metadata independently of PIN authentication, reusing the `/api/meta` request where sensible. Represent loading/error explicitly; do not briefly enable edits or display a demo PIN until runtime mode is known. Disable write controls while metadata is unresolved, including entry/group detail fields.
- Display English UI copy: a persistent `Demo mode` badge with `Sample data — read only`, and `Demo PIN: 1234` on the demo PIN screen. Make the badge readable on mobile and in both themes.
- Hide or disable New Entry, group creation, edit/tag/order/remove modes, year creation/deletion, import and encryption reset. Entry/group details, comments and savings details remain viewable without save/delete affordances. Keep export, filtering, collapsing, navigation and local appearance settings usable.
- Map `DEMO_READ_ONLY` to a clear UI error if a stale view attempts a write; backend denial remains authoritative.
- On mode change/reload, discard cached financial responses and verify any cached PIN session through a protected request before displaying financial data. Do not let the PWA or React Query present previous normal data under the demo badge or demo data as normal records.
- Namespace mode-specific local year/collapse selections or validate them against available years. Select the newest available demo year when the saved normal year is absent; do not overwrite the normal-mode selection unnecessarily. Theme/view preferences can remain shared.

### 5. Documentation and delivery

- Document `APP_DEMO` in `docs/CONFIGURATION.md`, including default, exact activation cycle, dedicated filenames, public demo PIN, read-only behavior, encryption requirement and persistence.
- Add an optional disabled setting to user-facing Compose examples if useful; never use those examples to run tests. Clarify that `.env` must actually be passed into the container's environment.
- Explain removal/rollback: recreate with `APP_DEMO=false` or omit it, retaining the normal PIN, encryption key and storage. Demo files remain separate and can be removed manually while stopped; automatic demo disablement does not delete them.
- Add the changelog entry during implementation. Confirm the release version from then-current repository/user context; this plan does not create a tag or release.
- Implement on `dev` without a task branch by default. Commit/push/deployment require a separate user request. The user validates the development image and handles main/release as established project policy.

## Verification and acceptance

Use only disposable directories, synthetic databases, test PIN/key values and isolated runtime/container instances. Do not touch production or real financial data.

- Configuration/path tests: missing/empty/false/true, malformed values, default/custom/relative database names, absent storage, permission failures, aliasing and pre-existing unowned demo paths.
- Lifecycle tests: first activation, repeated true, true->false->true, true->missing->true, failed normal initialization, process interruption before/after seed commit and before state finalization, corrupt/unsupported state, missing demo database and mismatched generation metadata. Deliberately inject failures and verify transactional recovery without duplicate data.
- Preservation tests: seed a synthetic normal database with a private test PIN and encrypted values; enable/restart/reset demo and compare normal database content and PIN metadata before/after. Read snapshots without accidentally invoking normal startup migrations. Also prove normal-mode writes and authentication still work after returning.
- Dataset tests: exactly two saved years, all three financial areas populated, consistent groups/tags, encrypted amounts, report totals, savings progress and empty future months. Control the generator clock, including a year-boundary restart.
- API tests: authenticated demo reads/export succeed; representative and complete route inventory of writes is denied without data changes, including direct calls bypassing UI. Missing/expired/wrong-mode sessions still fail. Demo PIN never unlocks the normal fixture; public metadata contains no normal credentials or paths. Configured webhooks are not contacted in demo.
- Browser tests: desktop/mobile, light/dark, badge/PIN, login, Expenses/Incomes/Savings/Reports, year selection, search, collapse, export and read-only details. Verify stale browser state, cached tokens, slow/failed metadata and demo->normal->demo reloads. Check no normal records flash during mode changes and existing UI transitions remain stable.
- Required gates: `node --test backend/tests/*.test.mjs`, syntax checks for changed JavaScript, `npm --prefix frontend run build`, `node --test frontend/tests/ui-transitions.mjs`, `node --test frontend/tests/browser-security.mjs` with the documented Playwright setup, and `git diff --check`.
- Build the local image and run `docker/tests/entrypoint.test.mjs` against it when entrypoint changes land. Add a container lifecycle check with disposable persistent storage for effective paths, generated demo data, normal-data preservation and non-root permissions. Publish only on explicit authorization.
- Check documentation links and review the complete diff. Any missing gate or unresolved safety case leaves implementation completion pending.

## References

- [Project constraints and gates](../PROJECT.md), [security baseline](../SECURITY.md).
- [Database initialization](../../backend/db.js), [schema](../../backend/schema.sql), [server startup and API](../../backend/server.js).
- [PIN initialization](../../backend/pin.js), [encryption](../../backend/encryption.js), [sessions](../../backend/auth.js).
- [Container entrypoint](../../docker/entrypoint.sh), [entrypoint tests](../../docker/tests/entrypoint.test.mjs).
- [Frontend API](../../frontend/src/api.ts), [store](../../frontend/src/store.ts), [application](../../frontend/src/App.tsx), [metadata provider](../../frontend/src/components/ReleaseStatusProvider.tsx), [PIN screen](../../frontend/src/components/PinGuard.tsx).
- [Configuration guide](../../docs/CONFIGURATION.md), [browser test guide](../../frontend/tests/README.md).
