# T-005: Mopay security verification

- Owner: Codex
- Status: done
- Mode: review only; do not patch dependencies, application or release workflow without a follow-up implementation request.
- Baseline: current dev worktree, reconcile with Git; earlier T-003/T-004 changes are now committed.

## Scope and acceptance

- Audit both npm lockfiles against current advisories; distinguish backend runtime, shipped frontend code and build-only tools.
- Review trusted API boundaries, PIN/session controls, input handling, encryption, XLSX import/export, browser output, outbound integration, container and CI configuration.
- Exercise representative success/denial/malformed-input cases using synthetic data and an isolated runtime; never use production data, secrets or configured integrations.
- Verify the Node 20 GitHub Actions warning against official sources.
- Record severity, evidence, exploit prerequisites, practical effect and recommended fixes; label unverified controls and limitations.
- Keep unpublished detailed findings local (STATE.md and /tmp report); no commit/push/deploy, dependency update or production action.

## Verification approach

- npm audit with package-lock-only; no audit fix or lockfile edits.
- Local fixtures/unit probes and isolated backend integration checks as available.
- Inspect workflow and Dockerfile source; image/host/proxy assessment limited to resources actually available.
- Review-only completion requires a clear findings report, not a claim of zero vulnerabilities.

## Completion

- Current dependency audits completed for both lockfiles and frontend production-only dependencies; underlying findings/JSON retained locally.
- Source review and isolated synthetic security probes completed, including Chromium rendering and controlled failure paths. No application fixes applied.
- Detailed unpublished findings, severity, prerequisites, commands and limitations: `/tmp/mopay-security-review-2026-10-05.md`; results: `/tmp/mopay-security-probe-results.json`; continuation summary in ignored STATE.md.
- Official GitHub deprecation notice and current action runtime definitions verified.
- Final `git diff --check` passed. Container OS/deployed image, production proxy/TLS and comprehensive secret/history scanning remain unverified and explicitly documented.
