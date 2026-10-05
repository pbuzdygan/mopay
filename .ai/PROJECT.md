# Mopay Project Profile

## Goal and scope

MOPAY is a self-hosted household finance application used in production and developed on `dev`: income, expenses, reports, savings, XLSX import/export, PIN access and encrypted monetary values. See [README](../README.md) and [architecture](../docs/ARCHITECTURE.md); verify task-relevant documentation against current code. No standalone accepted product specification or OpenAPI contract has been established. Existing [plans](plans/README.md) retain their decisions and verification history; the [ADR template](decisions/0000-template.md) is not an accepted decision.

## Required verification

Run commands from the repository root unless stated otherwise. Match checks to changed behavior and use isolated synthetic fixtures. Missing required checks are verification gaps: report them and keep implementation completion pending. A build or scanner alone does not prove correctness or security. Broader lint/typecheck tooling requires a separate scoped task.

| Change | Required evidence |
| --- | --- |
| Documentation only | Wording, source links, placeholders and diff review; `git diff --check`; inspect untracked documents separately. Application build is unnecessary. |
| Backend | Targeted success/failure regressions (`node --test backend/tests/*.test.mjs`), syntax checks for changed JavaScript, isolated runtime check when startup/DB behavior matters. |
| Frontend / visible behavior | `npm --prefix frontend run build`, relevant regressions and rendered desktop/mobile workflow checks. UI tests: `node --test frontend/tests/ui-transitions.mjs`; prerequisites in [test guide](../frontend/tests/README.md). |
| API / persistent data | Verify request/response contracts and consumers, invalid/denied/duplicate cases as applicable, migration/import checks with disposable DB, backup and rollback requirements. |
| Security | Evidence for relevant [SECURITY.md](SECURITY.md) controls, realistic denial/abuse cases and unverified areas; dependency review when dependencies change. |
| Infrastructure / deployment | Configuration/image validation, permissions, mounts, health, data transition and rollback review. Deploy only on explicit request; post-deploy checks when deployment is requested. |

[CI](../.github/workflows/security-checks.yml) runs backend regressions, frontend build and dependency gates: `npm --prefix backend audit --omit=dev --audit-level=moderate` and `npm --prefix frontend audit --package-lock-only --audit-level=moderate`. Audits send dependency information to the configured registry. No lint/typecheck gate is established; Vite build is not type checking. Tool availability, host capacity, test resource limits and actual external-service reachability are not fully established; inspect them when needed.

For container/base-image changes, repeat the local OS scan with a current vulnerability database; residual findings and vendor/backport discrepancies are documented in [container assessment](../docs/CONTAINER_SECURITY.md). CI npm audits are separate from OS scans. Build locally with `docker build -t mopay-local-review .`; entrypoint checks use `MOPAY_TEST_IMAGE=<local-image> node --test docker/tests/entrypoint.test.mjs` with disposable tmpfs, never real data.

## Protected resources and unsafe commands

- This machine is an authorized development host: routine local builds, starts and tests, including containers, need no renewed permission within the requested task. Identify exact local test targets before resetting disposable databases or volumes. Use synthetic data and development credentials; production is elsewhere and excluded.
- Protect PIN/encryption keys, sessions, environment files, webhook/cloud/registry credentials and real financial records. Never request or record their values. Secret files, production configuration, real data and lockfiles may change only when the task requires it and project rules allow it.
- Do not use or modify `docker-compose.yml` or `local-build-docker-compose.yml` to conduct tests: they are user-facing deployment examples. Use separate test configuration or explicit Docker commands with dedicated mounts, preferably loopback-only published ports and disabled production integrations/webhooks.
- Backend startup applies schema, migrations and orphan cleanup: starting it writes data. Use an isolated absolute `DB_FILE`, disposable PIN/key and explicit network isolation; the server does not bind explicitly to loopback. Avoid parallel application processes against one DB.
- Both example Compose files mount `./data:/data`; the root entrypoint can recursively change data ownership/permissions. Scope test mounts to identified disposable local resources.
- `docs/archive/` stays local and ignored and is excluded from requirements and continuity. Later cleanup is intended but deletion is not authorized. Generated output and dependencies are not requirement sources.

## Additional project constraints

These preserve accepted decisions D-01–D-05 (2026-10-05), without adding new policy:

- Code, documentation and commits use English; user conversation uses Polish.
- Work and requested pushes target `dev`; do not create task branches by default. The user validates the GitHub-built development image, manually merges into `main` and creates the main release. Agents do not take over these steps. Local verification supplements that release checkpoint. Commits, pushes, PRs, releases, deployment and other external mutations require explicit user requests. No additional commit naming convention or changelog timing is established.
- Follow existing instruction priority and repository evidence; no formal specification hierarchy has been accepted. Do not infer requirements from stale documentation or assume implemented behavior is correct.
- Preserve encryption-key compatibility and mismatch safeguards; monetary encryption does not mean every DB field is encrypted. Trace affected [encryption](../backend/encryption.js) and [migration](../backend/migration.js) contracts before changing them.
- Trace authentication/session, bounded import and overwrite/transaction contracts through [server](../backend/server.js) and [API client](../frontend/src/api.ts). Import budgets and retryable errors are documented in [import guide](../docs/IMPORT_EXPORT.md#xlsx-import-limits).
- Browser header-policy changes must increment the document revision comment in `frontend/index.html` so PWA precaches refresh. Preserve the intended [browser security policy](../backend/browserSecurity.js) and API `NetworkOnly` caching; offline assets do not establish offline financial editing. Production proxy enforcement remains unverified; local browser/PWA checks are in [test guide](../frontend/tests/README.md).
