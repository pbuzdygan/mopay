# Execution Plans

Use a plan only for work that is ambiguous, risky, crosses subsystems, changes architecture or persistent data, requires migration, or is likely to outlive one focused session. Small and obvious changes should be implemented directly.

Name a plan `T-NNN-short-slug.md` and link it from `.ai/STATE.md`. The plan must be understandable from the repository and the file itself without relying on a previous chat.

Copy the template below and remove guidance that does not apply.

```markdown
# T-NNN: Outcome

- Status: proposed | active | blocked | complete
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

