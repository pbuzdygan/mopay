# T-011: Container vulnerability verification

- Owner: Codex
- Status: done
- Baseline: dev / 52ad702 plus completed uncommitted T-010; preserve all changes.
- Scope: scan actual local runtime image and current Node 24 Debian base; remediate compatible confirmed fixable package findings and document residual risk. No production/deployment/publishing or application dependencies changes.
- Acceptance: pinned verified scanner and current database; machine-readable full findings and package/fix review; image changes, if needed, pass build and isolated native SQLite/auth/import/header smoke; recurring CI image scan if evidence supports a coherent gate; docs/changelog 1.6.2 and local state accurate.
- Security: scanner sees only disposable exported local image, not host secrets or Docker socket. Check official release/checksum before execution. Findings do not prove exploitation/reachability; distinguish fixed/unfixed and vendor backports. Do not silence findings or disable database freshness checks. Preserve non-root runtime and existing base distro/native ABI unless a migration is justified.
- Handoff: ready; scan completed, findings remediation explicitly continued in T-012.

## Completion evidence

Official Grype 0.120.0 checksum verified; final scan exited 0 with current valid 2026-10-05 DB. Two preceding OOM failures resolved by disk-backed cache/TMPDIR and bounded Go memory/concurrency. Full report /tmp/mopay-t011-baseline.json; assessment /tmp/mopay-t011-container-review.md. 263 package/advisory matches,25 reported fixable,10 fixable High/Critical. These are not proof of exploitability. Current Node24 base pulled and version24.21.0 confirmed. No image remediation claimed by this completed diagnostic stage; its implementation and final verification belong to T-012.
