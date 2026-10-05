# T-007: XLSX bounds and compatible dependency/CI security maintenance

- Owner: Codex
- Status: done
- Scope: SEC-02 XLSX resource budgets, compatible dependency patches and Node 24 GitHub Actions; preserve all T-006 work.
- Excludes: Tailwind major migration, CSP, production/commit/push/deploy.

## Acceptance

- Both import endpoints reject excessive compressed/expanded/archive/XML/workbook input before DB writes; count actual inflated bytes rather than trusting ZIP sizes.
- Parse in one bounded worker with deadline/heap limit and shared admission control; malformed inputs, timeout and worker failure leave the main process alive and release the slot.
- Standard template validation/import, selection, overwrite and transaction behavior remain compatible. Disposable regression fixtures cover failure, denial, concurrency and recovery.
- Patch compatible vulnerable dependency branches without force-upgrading frameworks; compare final npm audits and document unresolved advisory rather than suppressing it.
- Pin official Node 24 action releases to reviewed SHAs; run backend regressions and production dependency audit before release image publishing. Full frontend audit remains visible, with unresolved build-only braces finding documented.
- Changelog 1.6.2/docs, JS checks, regression suite, frontend build, workflow/config review and local Docker build pass; report unavailable external verification.

## Design / security

Use already installed ExcelJS dependencies unzipper 0.12.3, JSZip 3.10.1 and saxes 5.x as explicit imports (no new resolved production packages). Stream ZIP members with real byte budgets, parse XML with SAX for structural limits, rebuild checked names/content to prevent ZIP reader interpretation differences, then ExcelJS inside the worker. No archive extraction or external requests. Heap limits do not bound native buffers: compressed, expanded and individual-member caps provide complementary bounds. Worker has no inherited secrets; parent authenticates requests first. Existing data/schema remain unchanged. Resource defaults: 6 MiB compressed, 24 MiB expanded total, 4 MiB/member, 128 archive entries, 20 sheets, 5000 rows/sheet (10000 total), 64 columns, 100000 cells and merged cells total, XML depth 32, 30 s deadline, 192 MiB worker old-space. Sheet IDs bounded to 10000 and normalized on return; member names bounded to 256 characters/8 path segments. Shared parser admission rejects overlap with 429.

## Completion evidence — 2026-10-05

- `node --test backend/tests/*.test.mjs`: final 22/22 passed (6309 ms), including actual-byte/forged ZIP budgets, canonical filename interpretation, sparse/duplicate row/cell limits, DTD/traversal rejection, worker deadline/crash/exit and shared admission recovery, both HTTP endpoints' 413/408/429 behavior, denial, valid template import/overwrite/skip, and preserved T-006 regressions.
- `node --check` on server, four import modules and both test files: passed. `git diff --check`, new-source whitespace, workflow YAML/full SHA and `bash -n` validation: passed. Actionlint unavailable; workflow not run on GitHub.
- `npm --prefix backend ci --omit=dev --ignore-scripts --no-audit --cache /tmp/mopay-security-npm-cache` and frontend `ci --no-audit` with same cache: passed; Docker install also reproduced final lockfiles.
- Patched versions: backend qs 6.16.0, morgan 1.12.1, brace-expansion 2.1.7; frontend brace-expansion 2.1.7/5.0.12, fast-uri 3.1.8, nanoid 3.3.20. Direct parser declarations reuse existing resolved packages.
- Backend production audit and frontend lockfile production audit at `--audit-level=moderate`: passed, zero findings. Full frontend lockfile audit exited 1: five high records, one underlying unpatched braces advisory (GHSA-vfj7-8cjw-p6xm), propagated through Tailwind 3. JSON: `/tmp/mopay-t007-frontend-audit.json`. Full build audit is visible/informational; runtime audits gate CI.
- `npm --prefix frontend run build`: passed. `docker build -t mopay-local-security:t007 .`: passed; final log `/tmp/mopay-t007-docker-build.log`. Existing Docker NODE_ENV=development build emits a JS chunk-size warning; no frontend source changes.
- Disposable read-only/network-none container smoke (script `/tmp/mopay-t007-image-smoke.mjs`, tmpfs DB, user node, no production mounts): passed native SQLite, startup/health, PIN session, actual validation/import, isolated worker, anonymous denial and test-source exclusion. Container removed automatically.
- Official checkout v7.0.1, login-action v4.6.0 and setup-node v6 SHAs/runtime definitions verified; release values moved to quoted shell env vars. Security workflow is callable by publishing job and also runs on PR/push to main/dev.
- Changelog 1.6.2, README and project command/workflow profile updated. No migration, stored-data rewrite, commit/push/deploy. Remaining work: Tailwind/build advisory, CSP and container OS/production proxy/TLS verification. No assertion of a complete security audit.
