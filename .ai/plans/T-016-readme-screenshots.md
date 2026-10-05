# T-016: Refresh README screenshots

- Status: done
- Owner: Codex
- Created: 2026-10-05

## Acceptance and scope

Ten actual Chromium screenshots of the current built UI under branding: 0 Expenses,1 Incomes,2 Savings,3 Reports,4 Year operations, each dark/light with suffix _new.png. Consistent desktop viewport and synthetic household finance data. README links and labels match each view. Preserve old images. No source behavior/dependency changes, real data or backend secrets; intercept APIs and external requests, block service workers.

## Steps

- [x] Build and render actual UI using synthetic fixture responses.
- [x] Capture and visually inspect all ten PNGs.
- [x] Update README references and shared completion state; verify links, dimensions and diff.

## Evidence

- `npm --prefix frontend run build`: passed.
- `LD_LIBRARY_PATH=/tmp/mopay-browser-libs/root/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/mopay-playwright node /tmp/mopay-t016-capture.mjs`: passed; ten actual screenshots at1600x1000, both themes, synthetic budget/groups/savings and prior-year comparison. No uncaught page errors or CSP violations. API/assets served through interception, all external requests intercepted; no backend/real sessions/data.
- All ten files visually inspected through view_image: selected sections, full table totals, expanded first Savings goal, reports panels and centered Year operations modal visible.
- Python PNG signature/dimension checks and all README HTML image links: passed. Existing images retained. README theme alt labels corrected; Settings caption changed to Year operations.
- `git diff --check`: passed.

No app behavior, dependencies or production resources changed. Screenshots illustrate fixtures rather than real user data; desktop captures only.
