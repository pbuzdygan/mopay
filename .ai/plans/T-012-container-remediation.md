# T-012: Remediate assessed container findings

- Status: done
- Owner: Codex
- Handoff: ready
- Baseline: dev /52ad702 plus completed uncommitted T-010/T-011.

## Goal / acceptance

Assess all T-011 fixable and High/Critical matches; remove unused runtime package managers, replace gosu with already-installed setpriv while preserving root/non-root/permission-denial behavior, apply same-distro Debian updates and pin reviewed Node24 digest. Full fresh rescan, isolated image/API/native/import/header tests and root entrypoint regression checks must pass. Preserve non-root service and SQLite compatibility. Document actual unresolved vendor findings without hiding them. Changelog1.6.2 and truthful closure/handoff index; no commit/push/deploy.

## Threat model / decisions

Bundled npm/Yarn are install-time tools unnecessary at runtime; remove their files after dependency installation rather than patching nested dependencies manually. gosu Go network/TLS findings are not established remotely reachable in its privilege-drop usage, but remove the unnecessary Go binary in favor of existing util-linux setpriv. Debian-only security updates preserve ABI/distro; do not change base distro or application lockfiles. Scanner uses exported disposable image, disk-backed ignored cache and current DB; no Docker socket/secrets. Residual unknown/unfixed OS findings require explicit package/vendor disposition, not ignores. Data schema unchanged; rollback previous image, preserving volume.

## Steps

- [x] Close earlier diagnostic tasks with evidence and separate remaining implementation.
- [x] Inspect vendor/package reachability and implement minimal Docker/entrypoint fixes.
- [x] Rebuild, full rescan and realistic root/non-root/permission/SIGTERM runtime checks.
- [x] Record residual findings, documentation/changelog and final ready handoff.

## Completion / verification

- Dockerfile pins reviewed Node24.21.0 multi-arch manifest digest; same-release runtime apt upgrade applied PCRE2 10.42-1+deb12u2, Perl5.36.0-7+deb12u4 and tzdata. Removed global npm/npx/Yarn and gosu; entrypoint uses installed setpriv. Native SQLite3.53.4 has no libsqlite3 dynamic dependency; removed unused system libsqlite3.
- Final `docker build -t mopay-local-security:t012 .` passed. Full Grype0.120.0 rescan (disk-backed cache, GOMAXPROCS2/GOMEMLIMIT384MiB, current valid DB, no ignores/filtering) exited0. Baseline263 ->228matches; all25 initially reported fixable matches absent (10High). Final raw7Critical/59High/75Medium/12Low/59Negligible/16Unknown;140not-fixed/88wont-fix. These are scanner counts, not exploitability.
- Vendor review: all5 raw Critical Perl findings fixed in installed u4 per current Debian tracker; scanner feed lag retained in report. Two glibc Critical matches remain same CVE2026-5450, no Bookworm update, vendor no-dsa/minor; essential native library not removed. Remaining High OS packages have no reported fix in DB and all available APT updates applied; no blanket safety claims/ignore rules. Full assessment docs/CONTAINER_SECURITY.md; local228-row residual inventory /tmp/mopay-t012-residual-inventory.md and JSON /tmp/mopay-t012-scan.json.
- `MOPAY_TEST_IMAGE=mopay-local-security:t012 node --test docker/tests/entrypoint.test.mjs`:5/5 passed twice, final after libsqlite removal. Root and explicit node startup, PID1/UID/GID/groups/write, unwritable dir denial, failed root-drop denial and SIGTERM tested. Containers/tmpfs fixtures removed after checks.
- Final isolated image smoke with /tmp/mopay-t010-image-smoke.mjs passed startup/health, non-root, native SQLite, wrong/valid auth, bounded XLSX import and UI/SW/API security headers; network-none/read-only/no production data. Log /tmp/mopay-t012-docker-build.log. No active Grype/test containers remained.
- `sh -n docker/entrypoint.sh`, `node --check docker/tests/entrypoint.test.mjs`, `git diff --check` passed; STATE/cache paths confirmed ignored. Frontend production build occurs in image; T-01023backend/8UI/2CSP-PWA gates remain recorded and unaffected by backend/frontend source changes in T-012 (none).
- docs/CONTAINER_SECURITY.md, README, PROJECT and changelog1.6.2 updated; task registry/STATE explicitly closes T-001 through T-012. Completed implementation can be uncommitted: no commit/push/deploy authorized or executed. Residual vendor monitoring, other architectures, production proxy/TLS and recurring CI OS scans are future scopes, not unfinished current implementation. No DB migration; rollback prior image.
