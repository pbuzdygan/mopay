# T-001: Prepare the Mopay project profile draft

- Status: done
- Owner: codex
- Created: 2026-10-05
- Updated: 2026-10-05

## Outcome and acceptance

A reviewable `.ai/PROJECT.md` grounded in local repository evidence:

- [x] Replace every template placeholder.
- [x] Separate confirmed repository facts, proposed policies, and pending user decisions.
- [x] Link evidence and identify unverified commands and unavailable checks.
- [x] Preserve application/configuration and unrelated user changes.
- [x] Record documentation verification and a clear next action.

## Context

- [Universal instructions](../../AGENTS.md)
- [Project profile](../PROJECT.md)
- [Security baseline](../SECURITY.md)
- [README](../../README.md), [architecture](../../docs/ARCHITECTURE.md)
- [Backend package](../../backend/package.json), [frontend package](../../frontend/package.json)
- [Dockerfile](../../Dockerfile), [release workflow](../../.github/workflows/docker-publish.yml)

## Scope

- In scope: profile draft, this plan, ignored local state.
- Out of scope: code, operational configuration, template redesign, test setup, commits/deployment, next-session exercise.

## Constraints and risks

- Repository is already dirty; preserve user-owned changes.
- Backend startup opens and modifies its database; Compose mounts local `./data`.
- Do not inspect secret values or run services. This is not a security audit.
- A repository observation does not establish accepted policy or successful runtime behavior.
- Rollback: restore only this task's documentation edits if requested; never discard unrelated work.

## Implementation steps

- [x] Inspect Git, existing context, relevant code, documentation, and configuration.
- [x] Populate PROJECT.md with sourced facts and clearly pending recommendations.
- [x] Check links, placeholders, whitespace and scope; finalize local state and report.

## Verification

- Run a targeted documentation check for local Markdown links, unresolved placeholders, required sections and STATE.md length.
- Run `git diff --check` and inspect `git status --short` / relevant diffs.
- Do not run application builds/tests for a documentation-only draft; explicitly report that command recipes are unverified.

Results (2026-10-05):

- `git diff --check`: passed; tracked changes only.
- `git check-ignore -v .ai/STATE.md`: passed; ignored by `.ai/.gitignore`.
- `python3 - <<'PY'` with standard-library `pathlib`/`re` assertions: passed for PROJECT.md, this plan and STATE.md; no unresolved placeholders, missing local link targets, trailing whitespace or missing final newlines; required profile markers present; STATE.md under 120 lines.
- `git status --short` and `git diff --stat`: original tracked modifications/deletions preserved; this task changes only documents under `.ai/`.
- `node --version`: `v24.21.0`; `npm --version`: `11.19.0`.
- Application builds, services, dependency installs/scanners and runtime tests: not run; outside documentation-only scope.

## Decisions

- User accepted English code/documentation/commits and Polish conversation; Mopay is in production with ongoing development on dev.
- User accepted local archive with later cleanup and work only on dev; user manually merges/releases main after checking the development image. No Git action or archive deletion is currently requested.
- User confirmed the current host is dev and authorized local execution/testing and overwriting local test DB/volume data. Production is elsewhere; the two example Compose files must not be used/modified for tests.
- User accepted the recommended change-specific completion gates. Test tooling/runtime configuration remain separate implementation tasks.
- Do not adopt new project policy implicitly. List decision IDs in the profile.
- User will select a small next-session exercise after reviewing the profile.

## Handoff

Initial operational profile is ready. All five decision groups are incorporated; no user decision blocks the first handoff exercise. No new formal product specification hierarchy was accepted: existing AGENTS.md priority applies. Next: select a small task, record its scope/acceptance criteria and checkpoint under a new stable task ID, then resume it in a fresh session using the same worktree. The actual handoff and local runtime have not been exercised yet.
