# UI transition regression check

Build the frontend with `npm --prefix frontend run build`, then run:

```sh
MOPAY_PLAYWRIGHT_MODULE=/absolute/path/to/an/installed/playwright \
  node --test frontend/tests/ui-transitions.mjs
```

The module can also be an existing `@playwright/test` installation. It must have its matching Chromium browser and system libraries available. If Playwright is already resolvable from the test directory, omit `MOPAY_PLAYWRIGHT_MODULE`. This focused check does not add project dependencies or a general test framework.

The check serves the production frontend build through browser request interception, supplies synthetic API fixtures, blocks service workers and intercepts external requests. It never starts the backend or uses real sessions or financial data.

Four desktop/mobile scenarios cover light/Normal and dark/Compact presentation, initial and cached table switches, rapid switching, New Entry opening/closing/reopening, and entry/group details. Computed opacity is sampled on animation frames to detect table dimming and fade reversals, including the native animation completion flash. Uncaught browser errors also fail the check.

Four additional desktop/mobile light/dark scenarios exercise rejected PINs and successful unlocks with disposable mock credentials. The PIN overlay must fade monotonically and stay removed after login; no real authentication backend is used.

Set `MOPAY_SCREENSHOTS` to an existing temporary directory to capture rendered dialogs and details panels. This is a Chromium presentation regression check; it does not verify API writes or reproduce GPU behavior on every browser/device.

Scenarios also render Savings and Reports. For migration comparisons, `MOPAY_UI_DIST` selects a saved frontend build and `MOPAY_UI_METRICS` writes measured rectangles, colors, typography and spacing to a temporary JSON file. Use identical fixtures/viewports for both builds; generated captures and metrics stay outside Git/Docker contexts.
