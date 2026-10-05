# T-009: PIN transition regression, then Tailwind security migration

- Owner: Codex
- Status: done
- Baseline: dev / 485540b; preserve uncommitted T-008 workflow/docs changes.
- User sequence: fix and verify post-PIN flash first, then migrate Tailwind/build chain.

## Acceptance / sequence

1. Reproduce login fade reversal in computed browser frames; valid login fades monotonically without a second PIN overlay on desktop/mobile. Wrong PIN remains locked; cached sessions and session-denial behavior remain intact. Preserve backend PIN/session controls; scope mobile viewport variables to the live overlay so effect cleanup does not move an exiting card.
2. After PIN fix passes production build and browser checks, capture Tailwind 3 presentation baseline, migrate to official Tailwind 4 Vite integration and remove vulnerable Tailwind 3 build dependencies. Preserve app colors, dimensions, utility semantics, layering and desktop/mobile light/dark Normal/Compact workflows. Modern-browser support change must be documented.
3. Compatible lockfile update, full frontend audit clean, build/browser regressions/backend security suite/local image validation pass. Update changelog 1.6.2 and docs. No commit/push/deploy or production data.

## Risk / verification

Native Motion opacity completion can restore old inline values before AnimatePresence removes nodes. Test real computed ancestor opacity at animation frames; apply the existing CSS-variable pattern if evidence confirms. CSS variable scope must keep mobile keyboard/exit alignment stable. Authentication deny/expiry behavior must not be bypassed to hide flashes.

Tailwind 4 has breaking Preflight/utilities/CSS-layer changes. Inspect official upgrade guide, preserve custom unlayered CSS priority, migrate explicit configuration/tokens, rename changed utilities only where semantics require, handle custom @apply dependencies. Avoid automatic broad source rewrites. Use isolated intercepted UI fixtures/Chromium with no production data or outbound requests; preserve baseline screenshots/geometry and compare after migration. Worker/native/OS compatibility verified in local disposable image.

## Completion evidence

- PIN baseline failed 3/4 browser scenarios; CSS-variable opacity and overlay-local viewport state fixed the exit reversal. Expanded UI suite passed 8/8 after migration, including wrong/valid PIN and existing session fixtures.
- Tailwind 4.3.3 official Vite integration replaced v3/PostCSS configuration; preserved theme, cascade, compact spacing, placeholder/border/outline/shadow/blur semantics. Compared 28 v3/v4 Chromium captures: measured geometry and styles unchanged; maximum mean RGB pixel difference 0.00661/255. Safari/Firefox not locally tested; minimum supported versions documented.
- Frontend build passed; backend regressions passed 22/22. Full frontend and backend production npm audits returned zero vulnerabilities. CI full frontend audit now blocks moderate-or-higher findings; preserved T-008 Ubuntu runner pins.
- Local Docker image mopay-local-security:t009 built and passed isolated non-root smoke: startup/health, authentication denial, native SQLite, bounded XLSX worker and exclusion of test sources. No production data, publishing, commit or push.
- Evidence artifacts: /tmp/mopay-t009-{v3,v4}-comparison, /tmp/mopay-t009-{v3,v4}-metrics.json, /tmp/mopay-t009-pixel-comparison.json, /tmp/mopay-t009-docker-build.log. Changelog 1.6.2 and project/test documentation updated.
