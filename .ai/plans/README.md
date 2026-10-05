# Execution Plans

Use a plan only for work that is ambiguous, risky, crosses subsystems, changes architecture or persistent data, requires migration, or is likely to outlive one focused session. Small and obvious changes should be implemented directly.

Name a plan `T-NNN-short-slug.md` and link it from `.ai/STATE.md`. The plan must be understandable from the repository and the file itself without relying on a previous chat.

## Closure registry (2026-10-05)

All listed tasks are **done**; handoff is **ready**. This records verified scope completion, not Git commit, release or deployment. T-010 through T-012 changes remain in the worktree for user review; preserve them. Current snapshot is the ignored `.ai/STATE.md`. Residual vendor vulnerabilities and production/browser verification limits are explicit in [container assessment](../../docs/CONTAINER_SECURITY.md) and individual plans; they are not silently marked fixed.

| Task | Completed scope / evidence |
| --- | --- |
| [T-001](T-001-project-profile.md) | Project profile and accepted environment/verification decisions |
| [T-002](T-002-readme-handoff.md) | README and shared handoff baseline |
| [T-003](T-003-ui-flicker.md) | Table/modal/details flash corrections and rendered regression checks |
| [T-004](T-004-ignore-artifacts.md) | Git/Docker artifact ignores; test sources retained, excluded from image |
| [T-005](T-005-security-review.md) | Initial review; fixes implemented in T-006/T-007/T-010 |
| [T-006](T-006-backend-security-fixes.md) | Export/atomic PATCH/non-finite savings security regressions |
| [T-007](T-007-import-dependencies-ci.md) | Bounded XLSX worker, dependencies, Node24 CI gates |
| [T-008](T-008-ci-runners.md) | Ubuntu24.04 runner pins; retrospective closure, commit52ad702 |
| [T-009](T-009-pin-tailwind.md) | PIN fade fix, Tailwind4, clean npm audits;8UI/22backend/image gates |
| [T-010](T-010-browser-security.md) | CSP/framing/PWA;23backend/8UI/2browser security/image gates |
| [T-011](T-011-container-scan.md) | Successful baseline scan and OOM recovery; remediation transferred to T-012 |
| [T-012](T-012-container-remediation.md) | Assessed container fixes; full rescan,5entrypoint regressions/image smoke and residual vendor review |

Copy the template below and remove guidance that does not apply.

```markdown
# T-NNN: Outcome

- Status: idle | in_progress | blocked | done
- Owner: codex | claude | human | other
- Created: YYYY-MM-DD
- Updated: YYYY-MM-DD

## Outcome and acceptance

State the observable result and a short checklist proving it is complete.

## Context

Link the relevant specifications, decisions, code entry points, and tests. Summarize only facts that are not obvious from those sources.

## Scope

- In scope:
- Out of scope:

## Constraints and risks

List compatibility, security, data, migration, deployment, resource, or rollback constraints.

## Implementation steps

- [ ] 1. A concrete, verifiable increment.
- [ ] 2. The next increment.
- [ ] 3. Documentation, migration, or cleanup required by the change.

Update this checklist as work proceeds. Do not leave completed work marked open.

## Verification

List exact commands, manual checks, expected results, and failure cases. Include security checks when `.ai/SECURITY.md` applies.

## Decisions

Record minor decisions here. Create and link an ADR for choices that affect architecture, public contracts, persistent formats, security boundaries, or major dependencies.

## Handoff

Keep the current checkpoint here only when detail would make `.ai/STATE.md` too large. State what is done, what remains, changed files, verification evidence, risks, and the exact next action.
```

A completed plan may remain as focused design history if it explains the resulting system. Remove or archive plans that only duplicate Git history or current documentation.

