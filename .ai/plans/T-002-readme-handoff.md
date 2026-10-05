# T-002: Correct one README phrase and verify session handoff

- Status: complete
- Owner: claude-code (Opus 5.5) / resuming session 2026-10-05
- Created: 2026-10-05
- Updated: 2026-10-05

## Outcome and acceptance

Exercise real continuation in a fresh session using the same working directory. The user authorized this test after the initial project profile was prepared.

- [x] Resuming agent reads AGENTS.md, PROJECT.md and STATE.md, checks Git, and records its ownership before editing.
- [x] In README.md under `Generate Your APP_ENC_KEY`, replace only `stored it securley` with `store it securely`.
- [x] README diff contains exactly that one phrase correction on one line; no unrelated changes.
- [x] Documentation verification passes; no build, container, dependency install or application test is needed.
- [x] Plan and local STATE.md record actual verification, completed outcome and ready handoff.
- [x] Final user report is in Polish and states whether continuation required additional task information.

## Context and scope

- [Instructions](../../AGENTS.md), [project profile](../PROJECT.md), [local state](../STATE.md).
- [README](../../README.md): target phrase is at line 133 at preparation time. Find by heading/phrase rather than relying on that line number.
- In scope: the phrase correction, this plan and local state updates.
- Out of scope: broader README grammar/content corrections, security guidance rewrite, application/configuration changes, example Compose files, archive cleanup, commits/pushes and deployment.
- Base commit: `9d357b5a9a2b04a2bb587e6702e5d9801e09de2d`; branch `dev`.
- Existing tracked changes/deletions and untracked instruction files belong to previous work. Preserve them; STATE.md lists the baseline.

## Steps

- [x] Identify the target, confirm README has no current diff, and prepare self-contained handoff documents.
- [x] Resume in a fresh session, reconcile Git with STATE.md, claim ownership, and reread target context.
- [x] Apply the one-phrase correction and verify the narrow diff.
- [x] Mark T-002 complete, update local state, and report the outcome.

## Verification

Run from repository root:

- `git status --short`: reconcile with the recorded baseline; investigate additional overlapping changes before editing.
- `git diff -- README.md`: before editing, expected empty at the prepared checkpoint; after editing, exactly one line with `stored it securley` changed to `store it securely`.
- `rg -n 'stored it securley|store it securely' README.md`: after correction, only the new phrase should match.
- `git diff --check`: expected success; separate any pre-existing failure.
- `git check-ignore -v .ai/STATE.md`: expected `.ai/.gitignore` rule `/STATE.md`.
- Inspect this plan and STATE.md for truthful completion/check results; keep state under 120 lines.

No automated regression test is justified for this spelling/grammar correction. Do not run the application or change Markdown rendering.

## Handoff

- Completed 2026-10-05 by claude-code (Opus 5.5) in a fresh session; no extra task information was needed beyond STATE.md and this plan.
- Git matched the recorded baseline (HEAD 9d357b5, branch dev, README diff empty) before editing.
- README.md line 133: `stored it securley` → `store it securely`; diff is exactly one line.
- Checks passed: `git diff -- README.md` (one-line change), `rg -n 'stored it securley|store it securely' README.md` (only new phrase), `git diff --check`, `git check-ignore -v .ai/STATE.md` (`.ai/.gitignore:2:/STATE.md`).
- No commit or push performed. No next action remains for T-002.
