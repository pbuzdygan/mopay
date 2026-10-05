# T-006: Backend security fixes for v1.6.2

- Owner: Codex
- Status: done
- Baseline: dev / a926da9; preserve untracked T-005 review plan.
- Authorized scope: SEC-01 export process survival, SEC-03 atomic entry patches, SEC-04 finite savings amounts; tests and v1.6.2 changelog.
- Excludes XLSX decompression limits, dependencies/CI updates, CSP, production actions and data repair.

## Acceptance criteria

1. Invalid/oversized export year lists return 400, duplicate valid years export once, unexpected async failures return a controlled error without ending the process; successful XLSX export/template behavior retained.
2. Validate the entire entry patch before writes; grouping, ordering and fields succeed atomically or roll back. Failed validation, cross-type/year group assignment and database failure leave all affected rows unchanged.
3. Savings item creation/update reject non-finite amounts and preserve valid numeric/zero/negative values; invalid requests do not write.
4. Regression tests use fresh synthetic DB/key/PIN and loopback-only runtime, cover anonymous denial, malformed JSON, success and failure paths. Backend syntax checks, relevant frontend build and git diff check pass.
5. Document changes under v1.6.2 and test invocation. No new dependencies or schema migration.

## Design and security

- Preserve server-side authentication, group year/type checks, allowlisted SQL columns and parameter binding.
- Validate export years as numeric four-digit integers with bounded cardinality, then deduplicate; frontend supplies number arrays.
- Route async exporter failures through Express 4 error middleware; handle errors after streaming headers without writing a second response.
- Move entry writes behind complete validation into one SQLite transaction, preserving existing sort normalization behavior.
- Keep accepted savings numeric conversion contract; add finite-number enforcement at creation as already used by updates.
- Disposable fixtures only; test faults stay in the test process/database, never production data.

## Completion evidence (2026-10-05)

- `node --test backend/tests/security-regressions.test.mjs`: 8/8 passed on a fresh loopback fixture, including malformed/anonymous requests, boundary and duplicate years, valid XLSX/template validation, async build/write/busy/partial-stream failures, rejected patches, database-trigger rollback, valid grouped/ungrouped writes, encrypted amounts and rejected non-finite savings writes.
- `node --check backend/server.js` and `node --check backend/tests/security-regressions.test.mjs`: passed.
- `npm --prefix frontend run build`: passed (Vite/PWA). Inspected existing frontend API consumers; successful contracts retained. No frontend source changes or new rendered UI behavior.
- `git diff --check` and separate untracked test/plan whitespace checks: passed. Built assets/state ignored; Docker context excludes test sources.
- Changelog v1.6.2 and README document the fixes, export bounds and test invocation. No schema/dependency changes or stored-data rewrite; source rollback requires no migration.
- No commit, push, deployment, production verification or full container scan performed. Other review findings remain separate work: XLSX resource limits, dependencies/CI and browser headers.
