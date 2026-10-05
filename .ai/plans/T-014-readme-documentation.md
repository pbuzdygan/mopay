# T-014: Short README with linked detailed documentation

- Owner: Codex
- Status: done
- Handoff: ready
- Base: dev /e1ab0b4, clean worktree; T-013 committed externally.
- Scope: move whole backend-tests/import-limits/security-checks/browser-headers/release-check/security-variable sections to docs/TESTING.md, IMPORT_EXPORT.md, SECURITY.md, CONFIGURATION.md. README retains overview/screenshots/quick start/basic setup and explicit descriptive links, especially full variable documentation. Keep existing content, correct relative links and incoming anchors. No architecture/runtime/deployment changes.
- Acceptance: all original section content preserved in destination files; explicit README links including variable reference and direct section anchors; local relative paths/fragments valid; diff/whitespace and untracked documents reviewed. No build needed for documentation only. Changelog1.6.2, PROJECT moved link and task closure updated.

## Completion evidence

Moved complete Backend regression tests, XLSX import limits, Automated security checks, Browser security headers, Release check, Security environment variables and Import notes bodies into the four agreed guides. Also retained the full optional security configuration example in CONFIGURATION instead of the quick-start Compose block, plus source-verified basic/release variable reference. README retains direct descriptive pointers/old section anchors and a Documentation index; full variables explicitly linked before Compose and in Environment variables. PROJECT imports link updated; changelog1.6.2 records reorganization. README279 ->193lines.

`python3 /tmp/mopay-t014-check-docs.py`: passed98 relative links/fragments, all7 section bodies and optional example preserved (only relative links/header level adjusted), balanced code fences. `git diff --check`: passed. Inspected new docs and README diff; no architecture/code/runtime/settings/secret changes. No build/application tests needed for documentation-only change; external URLs not network-checked. Base/old README backup /tmp/mopay-t014-readme-before.md. No commit/push/deploy; registry and ignored STATE done/ready.
