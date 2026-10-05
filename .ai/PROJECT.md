# Mopay Project Profile

- Status: initial operational baseline ready for use; user-confirmed policies are marked Accepted. Command recipes remain unverified at runtime.
- Evidence reviewed: 2026-10-05, local branch `dev`, commit `9d357b5` plus existing uncommitted documentation changes.
- Scope of confirmation: source/configuration inspection, not application execution, security audit, or verification of external services.

## How to read this profile

- **Confirmed**: supported by the linked repository sources or a named local inspection.
- **Accepted**: explicitly established by the user; operational statements are user-confirmed, not independently checked against production.
- **Proposed**: a recommendation awaiting acceptance; not permission to change infrastructure, dependencies, or release policy.
- **Pending D-NN**: a user decision or operational fact that cannot be established from the repository.
- Existing [AGENTS.md](../AGENTS.md) and [SECURITY.md](SECURITY.md) rules remain in effect; this profile supplies project facts and accepted project-specific rules.
- A missing check is **unavailable**, not automatically **not applicable**. Record verification gaps explicitly.

## Identity and outcome

**Confirmed** — [README](../README.md), [changelog](../CHANGELOG.md):

- Project: MOPAY, a self-hosted household finance application for yearly/monthly income, expenses, reports, and savings.
- Additional flows: grouping, month tags, XLSX import/export, PIN access, monetary-value encryption, PWA assets, release status.
- Repository includes release history through `v1.6.1`; this does not establish the version deployed anywhere.
- Reviewed documentation and most code/UI terminology are English. This user conversation is Polish.
- Package metadata versions are `0.2.0`; displayed release metadata instead uses build/runtime variables ([Dockerfile](../Dockerfile), [API metadata](../backend/server.js), [release UI](../frontend/src/utils/release.ts)).

**Accepted D-01 (2026-10-05)**: Mopay is already used in production and continues to be developed on `dev`. Code, documentation and commits use English; user conversation uses Polish.

## Sources of truth

**Confirmed**:

- [README](../README.md): product overview, installation and configuration guidance; not a complete acceptance specification.
- [Architecture](../docs/ARCHITECTURE.md): implementation overview; validate task-relevant claims against code before relying on them.
- [Server](../backend/server.js) and [frontend API client](../frontend/src/api.ts): implemented HTTP contract and consumers.
- [Schema](../backend/schema.sql), [database bootstrap](../backend/db.js), and migration modules: persistent structure and startup transitions.
- No standalone product specification, OpenAPI contract, or accepted ADR was found in the reviewed files. [ADR template](decisions/0000-template.md) is not an accepted decision.
- Git is evidence of actual changes; local [STATE.md](STATE.md) is a continuation aid and must be reconciled with it.

Apply the instruction priority in AGENTS.md. No new product specification or formal ranking of conflicting project specifications has been accepted. For now, use the linked documentation and code as evidence for the requested task; do not infer a new requirement from stale documentation or treat current behavior as automatically correct. Resolve material conflicts as required by AGENTS.md. A more detailed specification hierarchy can be introduced when such specifications exist; it is not a prerequisite for the first handoff exercise.

**Accepted archive policy, D-02 (2026-10-05)**: `docs/archive/` stays local and ignored; the user intends to remove it during a later cleanup. Do not rely on it for current requirements or new-session continuity. This statement does not authorize deleting it now. Generated output, dependency directories, and the ADR template are not requirement sources.

## Technology and structure

**Confirmed** — [backend package](../backend/package.json), [frontend package](../frontend/package.json), [Dockerfile](../Dockerfile):

- Runtime: Node.js `>=24 <25`; Docker pins reviewed `node:24.21.0-bookworm-slim` manifest digest (T-012). Runtime build applies available same-release Debian updates, uses existing setpriv and omits global npm/Yarn and unused system libsqlite3; native better-sqlite3 provides SQLite. See [container assessment](../docs/CONTAINER_SECURITY.md).
- Dependencies: npm with separate tracked `package-lock.json` files under `backend/` and `frontend/`.
- Backend: JavaScript ES modules, Express, better-sqlite3, ExcelJS.
- Frontend: TypeScript/TSX, React 18, Vite 7, Tailwind 4 with the official Vite plugin (T-009), React Query, Zustand, PWA plugin.
- Deployment shape: one Express process serves `/api` and built frontend assets from `public/`; default backend/container port `8010`.
- Persistence: SQLite, WAL, foreign keys; configured via `DB_FILE`. The Docker entrypoint defaults to `/data/mopay.sqlite`; outside Docker, the backend default is `./mopay.sqlite` relative to process working directory. Container runtime/data UID and GID are configured with `PUID`/`PGID`, independently defaulting to `1000`; see [configuration](../docs/CONFIGURATION.md#storage-ownership-uidgid).

| Path | Responsibility | Boundary to inspect when changing it |
| --- | --- | --- |
| [backend/server.js](../backend/server.js) | Routes, parsers, startup migrations/cleanup, import orchestration, static serving | Client contracts, authentication, database writes |
| [backend/db.js](../backend/db.js), [schema](../backend/schema.sql), migration modules | Database connection, schema, persistent transitions | Existing data and startup side effects |
| [auth](../backend/auth.js), [pin](../backend/pin.js), [security](../backend/security.js), [encryption](../backend/encryption.js) | Sessions, PIN checks, throttling/audit, encryption | Secrets, access denial, resource limits |
| [frontend/src/api.ts](../frontend/src/api.ts), [store](../frontend/src/store.ts) | HTTP bindings, error/session handling, shared UI state | Server responses and affected consumers |
| [TableView](../frontend/src/components/TableView.tsx), [table helpers](../frontend/src/components/table/), [SavingsView](../frontend/src/components/SavingsView.tsx), [ReportsView](../frontend/src/components/ReportsView.tsx) | Main user workflows | Rendered behavior, query state, calculations |
| [Dockerfile](../Dockerfile), [entrypoint](../docker/entrypoint.sh), [release workflow](../.github/workflows/docker-publish.yml) | Build, runtime permissions, publishing | Host volumes, credentials, external side effects |

Use symbol searches before reading central files in full. This table is a navigation aid, not a claim that every listed module was audited.

## Commands and verification availability

**Confirmed recipe sources**: package scripts and Dockerfile. Commands below have **not been executed for this draft**, except toolchain version checks. Run from repository root unless otherwise stated. Inspect scripts before execution and apply the resource constraints below.

| Purpose | Command or availability | Conditions and limits |
| --- | --- | --- |
| Toolchain | `node --version`, `npm --version` | Executed here: Node `v24.21.0`, npm `11.19.0`; not a permanent environment guarantee |
| Frontend setup | `npm --prefix frontend ci --no-audit --prefer-offline` | Mirrors Docker install flags; network/cache and lifecycle scripts may be involved |
| Backend setup | `npm --prefix backend ci --omit=dev --ignore-scripts --no-audit --prefer-offline` | Mirrors runtime install flags; native-module compatibility not verified locally |
| Frontend development | `npm --prefix frontend run dev -- --host 127.0.0.1` | [API client](../frontend/src/api.ts) uses `VITE_API_BASE` or same origin; [Vite config](../frontend/vite.config.ts) has no backend proxy; split-origin setup needs compatible backend CORS |
| Backend development | From `backend/`: `npm start` | Only with isolated absolute `DB_FILE`, disposable valid PIN/key, explicit loopback-safe execution environment; startup changes DB and may trigger configured integrations |
| Format / lint | Unavailable: no script/config found in reviewed tracked files | Do not claim these passed |
| Type check | Unavailable: no typecheck script or `tsconfig` found | TypeScript dependency exists; Vite build is not a substitute for type checking |
| Backend security regressions | `node --test backend/tests/*.test.mjs` | Added in T-006/T-007; disposable DB/source fixtures, loopback-only API and bounded worker tests; not a comprehensive application suite |
| Frontend build | `npm --prefix frontend run build` | Writes `frontend/dist`; requires dependencies; no backend/security coverage |
| Full image build | `docker build -t mopay-local-review .` | Local image only; uses network, disk and native dependencies; do not publish |
| Security dependencies | `npm --prefix backend audit --omit=dev --audit-level=moderate`; `npm --prefix frontend audit --package-lock-only --audit-level=moderate` | CI gates backend production and all frontend dependencies; communicates dependency information to the configured registry |
| Integration / UI | `node --test frontend/tests/ui-transitions.mjs` | Isolated intercepted Chromium fixtures; browser prerequisites and optional comparison outputs documented in frontend/tests/README.md |
| Documentation | `git diff --check` plus link/placeholder inspection | Untracked documents need separate checks; build is unnecessary for documentation-only changes |

**Confirmed restrictions**:

- Backend imports [db.js](../backend/db.js) and executes schema/migrations/orphan cleanup before listening ([server](../backend/server.js)). Starting it is a write operation, not a read-only check.
- Both [deployment Compose](../docker-compose.yml) and [local-build Compose](../local-build-docker-compose.yml) bind-mount `./data:/data`; local-build configuration also sets `NODE_ENV=production` and exposes host port `9010` to container `8010`.
- [Entrypoint](../docker/entrypoint.sh) can recursively change ownership/permissions of `/data` when started as root. Scope test mounts to the authorized local development/test data described in D-03.
- The server calls `listen(PORT)` without an explicit loopback host. A disposable DB alone does not provide network isolation.
- Do not use or modify the two example Compose files for tests. Local test database reset/overwrite is authorized under D-03; production data is excluded. Avoid parallel application processes against one DB and release/push commands as verification shortcuts.

**Accepted D-03/D-04**: local execution/testing on this development host is authorized and the completion gates below apply. Test instances use their own configuration rather than either example Compose file. No test runtime configuration or new tooling has been implemented by this profile update; resource limits are not specified.

## Git, release, and documentation

**Confirmed**:

- Current local branch: `dev`; local `origin/HEAD` points to `origin/main`. This is cached local Git metadata, not live verification of hosting settings.
- Recent history includes releases merged from `dev`; existing commit subjects do not establish a mandatory naming convention.
- [Workflow](../.github/workflows/docker-publish.yml) runs on published GitHub releases targeting `main` or `dev`, builds an image and pushes to GHCR. Reusable [security checks](../.github/workflows/security-checks.yml) run backend regressions, backend production and full frontend dependency audit gates, and a frontend build (T-007/T-009). No lint/typecheck or container OS CVE scan is established.
- Channels/tags: `main` → `latest` and version tag; `dev` → `dev_latest` and `dev_` version tag.
- [Changelog](../CHANGELOG.md) groups release changes into fixes/features/improvements.
- Existing [AGENTS.md](../AGENTS.md) requires explicit user requests for commits, merges, pushes, PRs, releases, deployment and external mutations.

**Accepted branch/release workflow, D-05 (2026-10-05)**:

- Development work and requested pushes target `dev`; do not create task branches by default.
- The user checks the GitHub-built development image. If it works correctly, the user manually merges `dev` into `main` through GitHub and manually creates the main release.
- Agents do not take over the user's merge/release steps. Describing this workflow is not a request to commit or push now; explicit-action rules in AGENTS.md still apply.
- No additional commit naming convention or changelog update timing has been accepted. Follow existing style when those actions are requested; avoid introducing a new convention implicitly.

## Environments and protected resources

**Confirmed**:

- Documented production model: self-hosted Docker, optional reverse proxy; this does not identify any actual production host.
- Repository CI is an image-publishing workflow; no separate staging/test environment is described in the inspected configuration.
- Git ignores local `.ai/STATE.md`; continuation through that file currently assumes the same working directory. Separate clones/worktrees need an explicit transfer mechanism.
- Encryption requires `APP_ENC_KEY`: a base64-encoded 32-byte key, optionally with `base64:` prefix. PIN initialization requires `APP_PIN` with 4–8 digits ([encryption](../backend/encryption.js), [pin](../backend/pin.js)). Never record values here.
- Update UI uses GitHub Releases ([release provider](../frontend/src/components/ReleaseStatusProvider.tsx)); security tooling supports outbound webhook alerts ([security](../backend/security.js)). Actual network reachability is unverified.

**Existing safety rules applied to Mopay**:

- Local development/test database and volume data on this host may be overwritten under D-03. Confirm the target belongs to the local test instance before reset/removal; unrelated repository/user files and remote production resources are outside that authorization.
- Protect PIN/encryption keys, session tokens, environment files, webhook credentials, cloud credentials and registry credentials. Do not copy values into documentation/state/test output.
- `.env`, production deployment settings, production data and lockfiles remain subject to [AGENTS.md](../AGENTS.md); local test-data authorization does not permit changing production resources or example deployment files.
- Use only disposable fixture data and an explicitly isolated runtime for future API/migration tests.

**Accepted D-03 (2026-10-05)**:

- This machine is a development host. Agents may build, start and test Mopay locally, including containers, as needed for the requested task without asking again for routine local execution permission.
- Database/test data and volumes used by local test instances on this host are disposable and may be overwritten/reset. Use synthetic fixtures and development credentials; identify exact local targets before destructive operations.
- Production is hosted elsewhere and remains outside local test scope. Do not connect tests to it or use production integrations/credentials.
- `docker-compose.yml` and `local-build-docker-compose.yml` are user-facing deployment examples also shipped to main. Do not use or modify them to conduct tests. Run test containers with separate configuration or explicit Docker commands and dedicated local mounts.
- Prefer loopback-only published test ports and disable production webhooks/integrations. No production topology change or new staging service is required.
- The user's GitHub development-image check remains the release checkpoint; local agent verification supplements it.
- The host's tool availability and resource capacity have not been fully inspected. Check them when a task needs them; this is not a blocker to adopting the profile. Never request credential values or real financial records.

## Completion gates — accepted D-04 (2026-10-05)

These gates supplement existing universal verification requirements. Missing infrastructure is a reported verification gap, not a passing result.

| Change type | Required evidence before implementation is marked done |
| --- | --- |
| Documentation only | Review wording, source links, unresolved placeholders and relevant diff; `git diff --check`; inspect untracked documents separately |
| Internal backend change | Targeted regression/failure tests, syntax checks for changed JS, isolated runtime check when behavior depends on startup/DB |
| Frontend or user-visible change | Frontend build, relevant regression checks, rendered desktop/mobile workflow verification; report missing typecheck tooling |
| API, schema or persistent data | Request/response contract and consumers verified; invalid/denied/duplicate cases as applicable; migration/import checks with disposable DB; documented rollback/backup requirements |
| Security-sensitive change | Applicable SECURITY.md evidence, realistic denial/abuse cases, remaining unverified controls; dependency review if dependencies change |
| Deployment or infrastructure | Configuration/image validation as relevant; permissions, mounts, health, data transition and rollback reviewed; explicit user request before deployment; post-deploy checks only when deployment is requested |

Until testing is established, completion reports must identify behavior not verified automatically. A successful build or dependency scanner alone does not prove a secure implementation.

**Accepted D-04**: for UI changes, build and inspect the changed workflow; for backend/API changes, verify success and realistic failure paths on synthetic data; for persistent/security changes, include migration/denial checks as applicable. Add targeted regression tests with behavior changes. Establish broader lint/typecheck/test tooling in a separate scoped task; accepting these gates does not request installing it now. Keep agent implementation verification distinct from the user's later development-image check and release decision. If a required check cannot run, report the gap and keep implementation completion pending rather than declaring a pass.

## Project-specific boundaries to preserve

**Confirmed implementation characteristics**; changes require tracing affected contracts and [SECURITY.md](SECURITY.md), rather than assuming these are immutable product requirements:

- Single-application PIN/session model; frontend sends `X-Mopay-Session`, backend also accepts Bearer tokens. Sessions are in memory and disappear on restart ([auth](../backend/auth.js), [API client](../frontend/src/api.ts)).
- Protected API requests are authenticated before parsing; current public API allowlist is PIN verify/logout, metadata, encryption status. JSON limits are 2 KB for PIN verification, 64 KB for standard requests, 10 MB for import ([server](../backend/server.js)).
- Monetary values use application-level AES-256-GCM; preserve existing key compatibility and mismatch safeguards ([encryption](../backend/encryption.js), [migration](../backend/migration.js)). Do not imply every database field is encrypted.
- Imports require `mopay_import_template.xlsx`, validate input, and use overwrite confirmation/transaction orchestration ([server](../backend/server.js), [export](../backend/export.js)).
- T-007 bounds import/validation in a shared worker parser; byte/structure/time budgets and retryable API errors are documented in [Import and export](../docs/IMPORT_EXPORT.md#xlsx-import-limits). No schema migration or stored-data rewrite accompanies this change.
- PWA caches documents/assets; `/api/` requests are `NetworkOnly`. Offline assets do not establish offline financial editing ([Vite config](../frontend/vite.config.ts)).
- T-010 enforces [browser security headers](../backend/browserSecurity.js): no framing or inline/eval scripts; same-origin UI/API/assets/workers with an explicit GitHub API connection allowance. React/Motion style attributes remain allowed. Header-policy changes must also increment the document revision comment in frontend/index.html so PWA precaches refresh. Local browser enforcement/PWA checks are documented in frontend/tests/README.md; production proxy behavior is unverified.
- One process per DB file is the recommendation in the server's busy-error response; avoid designing tests around shared live DB access.
- T-011 container scan and T-012 remediation are documented in docs/CONTAINER_SECURITY.md; OS findings are not zero (including scanner/vendor backport discrepancies). CI npm audits remain separate; repeat the local OS scan with a current DB before accepting new base/update changes. `MOPAY_TEST_IMAGE=<local-image> node --test docker/tests/entrypoint.test.mjs` verifies actual entrypoint root/non-root/denial/SIGTERM behavior with disposable tmpfs and no real data.

## Accepted user decisions

| ID | Decision or information needed | Recommendation / reason |
| --- | --- | --- |
| D-01 | Accepted: production product, ongoing development on dev; language policy | English repository and commits; Polish conversation |
| D-02 | Accepted: local archive, later cleanup | No deletion now; use current documentation/code as evidence and existing instruction priority; no new formal specification designated |
| D-03 | Accepted: current host is dev, local execution/testing authorized | Local test DB/volumes may be overwritten; production elsewhere; example Compose files excluded from test use/changes |
| D-04 | Accepted: change-specific completion evidence | Gates above; report unavailable checks; build/manual checks plus relevant regression/failure tests; broader tooling is a separate task |
| D-05 | Branch/release workflow accepted; no new commit/changelog convention | Work only on dev; user validates development image and manually merges/releases main; agents commit/push only on request |

This profile authorizes routine local test execution and disposable local test-data operations within requested tasks. It does not request a code change, a test run now, new dependencies, commits/pushes, production actions or archive cleanup. The next-session exercise is a separate task.

## Out of scope for this preparation

- Application fixes, refactoring, security remediation, dependency upgrades or new test tools.
- Changes to universal instruction templates, archival migration, actual releases/deployments, and the later small next-session handoff exercise.
- This list describes T-001 only. Permanent product exclusions require an explicit product decision.
