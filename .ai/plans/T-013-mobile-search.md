# T-013: Mobile input focus and search access

- Owner: Codex
- Status: done
- Handoff: ready
- Base: dev /76700dd, clean tree; prior tasks committed externally.
- Scope: prevent mobile focus zoom caused by small form text; search in mobile year/menu/search/lock/theme row, desktop layout preserved; / and Ctrl/Cmd+K focus visible search without stealing from editors/modals/PIN/Reports. Manual zoom remains enabled.
- Acceptance: computed editable field font>=16px across mobile views/dialogs/compact/PIN; one visible search with accessible label, no overflow at320/390/767px and landscape; correct filtering/reset in Expenses/Incomes/Savings, shortcut/escape and denial cases; production build and existing enforced-CSP UI regressions pass. Actual iOS keyboard/autofocus zoom remains unverified if no real Safari available.
- Risk: responsive controls/duplicate hidden search must have unique IDs and visible ref selection; preserve auth/input handling. Existing viewport effects and user pinch zoom unchanged. No dependencies/backend/deployment changes. Changelog1.6.2/docs/state/closure registry updated after checks.

## Completion evidence

- MainBar renders one visible responsive search (unique desktop/mobile IDs and refs) in mobile Year/Menu/Search/Lock/Theme row; desktop placement retained. Visible-ref shortcut handling works across breakpoints/landscape. / and Ctrl/Cmd+K do not steal normal editing, modal/details/PIN focus or activate Reports; Escape clears/blurs.
- global.css gives all editable input/textarea/select/contenteditable text >=16px for small or coarse-touch screens; max(16px,1rem) preserves larger inherited sizing, even with compact root15px. Viewport metadata/user zoom unchanged. Landscape flex gives search usable remaining space and eliminates duplicate utility icons.
- `npm --prefix frontend run build`: passed (484 modules, PWA generated). `node --test frontend/tests/ui-transitions.mjs`: final8/8 passed,64.5s; enforced CSP/no policy or page errors. Added filter, shortcut, reset and protected focus cases; touch contexts verify visible field sizes and toolbar order/width at320/390/767 and900x400, PIN/modal/table/details/goal fields captured. Initial expanded run caught landscape overlap; fixed from measurements, targeted mobile2/2 and final full8/8 passed.
- Exact UI environment: LD_LIBRARY_PATH=/tmp/mopay-browser-libs/root/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/mopay-playwright MOPAY_PLAYWRIGHT_MODULE=/home/buzsys/github/leandocs_dev/node_modules/@playwright/test MOPAY_SCREENSHOTS=/home/buzsys/github/mopay_dev/.cache/mopay-ui-t013. Actual rendered390portrait and900landscape images inspected; screenshots remain ignored.
- `node --check frontend/tests/ui-transitions.mjs` and `git diff --check`: passed. No established TypeScript/lint gate; Vite build is not a typecheck. Real iOS/Safari software keyboard/autofocus behavior not reproduced by Chromium; field-size condition verified, device check documented.
- Changed MainBar/global.css, expanded existing UI tests and test README, root README and changelog1.6.2; task registry and local state closed. No backend/dependencies/auth/CSP/API changes, commit/push/deploy or production data.
