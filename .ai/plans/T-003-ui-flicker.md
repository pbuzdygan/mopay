# T-003: UI flicker fixes for v1.6.2

- Owner: Codex
- Status: done
- Scope: Expenses/Incomes table transitions, shared modal and entry/group details animations, regression checks, changelog.
- Preserve all pre-existing documentation changes. No commit, push or deployment requested.

## Acceptance criteria

1. Switching Expenses/Incomes does not deliberately dim the entire table, including cached data and rapid switches.
2. Modal and details opening/closing use predictable opacity transitions without competing animation engines or full-screen animated blur.
3. Verify rendered desktop/mobile workflows with synthetic data, including rapid reopen and entry/group details; add focused regression coverage without production dependencies.
4. Frontend build and `git diff --check` pass; changes documented under v1.6.2.

## Diagnosis

- `TableView.tsx` explicitly animates opacity to 0.55 on mount and type/year changes.
- `ModalBase.tsx` and `.modal-overlay-premium` animate the same overlay opacity independently (Framer Motion and CSS), allowing opacity to jump when the CSS animation ends.
- Shared overlays blur the full viewport while changing opacity; details additionally combine CSS sliding and Motion fading.
- Browser frame measurements after removing competing CSS still showed a one-frame opacity reset from ~0.999 to 0 at native animation completion. Animating CSS variables through Motion's frame loop removed that measured regression, including the modal card.
- Boundaries: presentation only; preserve API/session behavior, validation and React text escaping. Tests use synthetic responses; no production financial data.

## Verification

- `npm --prefix frontend run build`: passed after final source changes.
- `node --test frontend/tests/ui-transitions.mjs` with local Playwright/browser/library environment: 4/4 passed. Light/Normal and dark/Compact on desktop/mobile; initial/cached/rapid table switches; modal card and overlay effective opacity; closing/reopening; entry/group details; no uncaught browser errors.
- Inspected rendered desktop light and mobile dark dialogs and details screenshots under `/tmp/mopay-ui-screenshots`.
- `node --check frontend/tests/ui-transitions.mjs` and `git diff --check`: passed.
- Browser regression failed on the earlier implementation with measured ~1 -> 0 -> 1 opacity; final implementation passes the same monotonicity check.
- No backend/API/data migration changes. Other browser engines and physical device/GPU behavior remain unverified.
