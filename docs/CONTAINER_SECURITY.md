# Container security assessment

Reviewed 2026-10-05 (T-011 baseline / T-012 remediation). Scope: local Linux/amd64 production image, known OS and bundled-library advisories. No production environment or penetration test. Counts are package/advisory matches, not unique exploitable vulnerabilities.

## Changes verified

- Both build/runtime stages pin reviewed Node 24.21.0 Bookworm manifest digest `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- Runtime installs available same-release Debian updates during build. PCRE2 is `10.42-1+deb12u2`, fixing [CVE-2026-103111](https://security-tracker.debian.org/tracker/CVE-2026-103111). Perl is `5.36.0-7+deb12u4`; tzdata also updated. Release builds already use `--no-cache`; rebuild and rescan periodically because package versions and vulnerability data change.
- Global npm/npx and Yarn/yarnpkg removed after dependency installation. Their vulnerable nested dependencies were outside the application's npm audit lockfiles. Runtime commands must use `node server.js`, not `npm start`; npm remains in the frontend build stage.
- Removed gosu and its old embedded Go library. Existing Debian util-linux `setpriv` preserves privilege dropping and exec/SIGTERM behavior. Since T-015, it uses validated numeric `PUID`/`PGID` (default `1000:1000`) and clears supplementary groups; see [storage ownership configuration](CONFIGURATION.md#storage-ownership-uidgid). No new runtime package added.
- Removed unused system libsqlite3: the loaded better-sqlite3 Linux/amd64 native module links libc/libstdc++/libgcc/libm, not libsqlite3; `select sqlite_version()` returns bundled `3.53.4`. This removes the separate vulnerable Debian 3.40.1 library without changing database schema or app lockfiles. The native module and XLSX/API regressions passed.

## Full scan and remaining findings

Official Anchore Grype 0.120.0 binary SHA256: `a5a1218dce63acdac152a6b3b5bb366e7267e36f4069848cf455543b3fa5700e`. Database valid, built 2026-10-05; scan scope is the final squashed image, without ignore rules or hiding unfixed findings.

| Measurement | Baseline | Remediated image |
| --- | ---: | ---: |
| All package/advisory matches | 263 | 228 |
| Critical | 8 | 7 |
| High | 72 | 59 |
| Medium | 91 | 75 |
| Low | 14 | 12 |
| Negligible / Unknown | 62 / 16 | 59 / 16 |
| Reported fix available, all severities | 25 | 0 |
| Reported fix available, High/Critical | 10 | 0 |

All 25 originally fixable matches are absent after patching/removing the affected packages. Remaining raw matches are Debian packages: 140 `not-fixed`, 88 `wont-fix` in this database. These labels are not proof that a finding is harmless or that vendor data is always current.

### Critical disposition

| Raw finding | Installed package / disposition | Vendor evidence |
| --- | --- | --- |
| CVE-2026-5450 (2 matches) | libc6/libc-bin 2.36-9+deb12u14; Bookworm remains affected, Debian marks no-dsa/minor. This library is required by Node/native modules; retain and monitor, do not claim fixed. Exploitation depends on the affected scanf format usage; no reachability proof or exploit test was performed. | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-5450) |
| CVE-2026-8376 | perl-base 5.36.0-7+deb12u4; vendor says fixed; raw scanner feed lags the update. | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-8376) |
| CVE-2026-13221 | Same installed Perl update, fixed by vendor. | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-13221) |
| CVE-2026-42496 | Same installed Perl update, fixed by vendor. | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-42496) |
| CVE-2026-12087 | Same installed Perl update, fixed by vendor. | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-12087) |
| CVE-2026-57433 | Same installed Perl update, fixed by vendor. | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-57433) |

Other High findings involve util-linux family, glibc/C++ runtime, Perl, ACL/TASN1, zlib/gzip and ncurses packages. All available Bookworm updates were applied; this scanner database reports no fixes for these remaining matches. App source inspection found no API path invoking Perl or accepting shell commands, but this is not an exhaustive reachability analysis of native code. Essential OS packages were not forcibly removed, and no exception/ignore rules were added. A distro/distroless migration would be separate compatibility work rather than a claimed fix in this task.

## Verification and reproduction

```sh
docker build --pull -t mopay-local-security:review .
MOPAY_TEST_IMAGE=mopay-local-security:review node --test docker/tests/entrypoint.test.mjs
mkdir -p .cache/mopay-security/tmp
docker image save mopay-local-security:review -o .cache/mopay-security/image.tar
TMPDIR="$PWD/.cache/mopay-security/tmp" \
GOMAXPROCS=2 GOMEMLIMIT=384MiB \
GRYPE_DB_CACHE_DIR="$PWD/.cache/mopay-security/db" \
GRYPE_CHECK_FOR_APP_UPDATE=false \
grype docker-archive:"$PWD/.cache/mopay-security/image.tar" -o json \
  --file .cache/mopay-security/report.json
```

Install Grype from its official checksum-verified release before this command. Cache/exports/reports are local and ignored by Git/Docker. On this host `/tmp` is RAM-backed: two initial database extractions were killed by OOM; disk-backed cache/TMPDIR solved the failure. Database freshness checks were retained. Exit 0 means the scan completed, not that no advisories were found; inspect the JSON and vendor status. Existing npm CI gates do not run the OS scan; this remains an explicit local verification step.

Five entrypoint checks pass: root repairs only disposable tmpfs data and execs as node/PID1; explicit node start; unwritable-directory denial; failure-to-drop-privileges denial; SIGTERM delivery/clean exit. An isolated network-none/read-only/non-root image smoke passed native SQLite, health, PIN denial/login, bounded XLSX import and UI/SW/API headers. No production mounts/data, ports, publishing or deployment were used.

The scan and original five-test evidence are recorded in the T-012 plan; T-015 adds seventeen entrypoint regression checks for configurable identity, data ownership transitions and denial paths. `.ai/STATE.md` holds the latest task snapshot. Verify other architectures separately; only amd64 was tested. Rollback is the previous image with the existing volume; no database migration is introduced. New base digests/OS updates require rebuild, rescan and native/entrypoint checks. Production reverse proxy/TLS and automatic recurring OS scanning remain outside this change.
