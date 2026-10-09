# Final Ledger UI migration

Accepted by the user on 2026-10-09. Target design: [final-ledger.html](../../docs/mockup_UI/final-ledger.html), rationale and feature map in [mockup README](../../docs/mockup_UI/README.md), rules in [UI design guidelines](../UI_DESIGN_GUIDELINES.md).

## Intended outcome

The frontend moves to the Final Ledger design: sidebar shell, Overview as the start page (former Reports), Expenses/Incomes grid with a non-modal inspector drawer (Value → Entry details → Tag → Entry), Savings as list + detail, Settings as a page, and a dedicated mobile layout below 960 px.

Acceptance criteria:

- **Feature parity (primary constraint):** every row in the parity inventory below is reachable and behaves as before (or as the documented replacement), in normal and demo mode, on desktop and mobile, light and dark. No release on `dev` may leave a feature unreachable, even temporarily.
- **Deliberate changes are allowed, accidental loss is not.** When implementation shows that a function or code path should work differently or better, the change is made on purpose: the parity row is updated with the new behaviour and the reason, a test covers the new behaviour, and the CHANGELOG lists it under *Changes*. A behaviour that disappears without such a record is a defect.
- No backend, API, database, dependency or CSP changes. Frontend-only.
- Existing regressions pass after their selectors are updated: `ui-transitions.mjs`, `ui-parity.mjs` (added in Phase 0), `browser-security.mjs`, `demo-runtime.mjs`. Tests are never weakened; each replaced assertion keeps or extends the behaviour it checked.
- No regressions of fixed defects: table/modal/details flicker (T-003), PIN overlay fade (T-009), 16 px editable text on mobile (T-013), collapsed-group restore before paint (v1.6.3), search shortcuts and denial cases (T-013).
- Text colour tokens meet WCAG AA (4.5:1) in both themes; visible focus; keyboard operation of grid, drawer, menus and dialogs; `prefers-reduced-motion` respected.
- Rendered checks at 1440, 1024, 767, 390, 320 px and 900×400 landscape, light and dark.

## Decisions (D1, D2 and D10 confirmed by the user on 2026-10-09, D3–D5 before Phase 4; others are proposed defaults to confirm before their phase)

| # | Decision | Default | Phase |
| --- | --- | --- | --- |
| D1 | Start view | **Confirmed.** Always open **Overview** after load/unlock; the last tab is no longer restored. Year selection stays persisted. | 2 |
| D2 | Internal tab key | **Confirmed.** Keep `'reports'` as the store key, label it "Overview" – avoids persistence and test churn. | 2 |
| D3 | Tag mode | **Confirmed.** Removed on desktop and mobile; tagging only in the inspector / bottom sheet, after parity is verified. | 4 |
| D4 | Cell click | **Confirmed.** Single click selects the cell and opens the inspector; double-click, Enter or typing edits in place; arrows/Tab move the selection; Esc cancels edit, then closes the drawer. | 4 |
| D5 | "Same month previous year" | **Confirmed.** Match the entry by exact name and type in the previous year (data Reports already loads). No match → "—". No API change. | 4 |
| D6 | Theme "System" | Stored under a **new key** `themeMode` (`light`/`dark`/`system`); the existing `theme` key keeps the resolved `light`/`dark` so an older build still works after rollback. | 7 |
| D7 | Settings view | Not persisted as `tab` (an older build would render an unknown tab). Held in non-persisted view state. | 7 |
| D8 | Deferred enhancements | "Copy entries and groups to new year", entry counts in year deletion and Overview "vs 2025" for metrics not already compared today are **out of scope** (separate tasks; copy needs many non-atomic calls or a backend endpoint). | – |
| D9 | Delivery | Phased replacement on `dev`, each phase complete and shippable; no parallel old/new UI toggle (cost of maintaining two UIs outweighs benefit for a single-instance app). | all |
| D10 | Version | **Confirmed: v2.0.0.** Accumulate notes under one `v2.0.0 (unreleased)` CHANGELOG section during all phases; `main` is merged only after Phase 9. The user decides final release timing. | 9 |

### Version assessment (D10)

SemVer distinguishes breaking from compatible changes. For MOPAY the technical interfaces stay compatible: API, database, encryption, configuration, Docker setup and XLSX formats are unchanged, and the upgrade needs no migration or rollback steps. By that measure alone 1.7.0 would be defensible.

The user-facing contract, however, changes in ways existing users must relearn: Reports becomes Overview and the start page, Tag mode is removed (tagging moves to the inspector), a single click selects instead of editing, the hamburger menu and its modals are replaced by a Settings page, and the mobile layout is new. These are breaking changes to learned workflows, and the whole visual identity changes. A major version signals this honestly and sets the right expectation in release notes. **Recommendation: v2.0.0**, with release notes stating "no data, API or configuration migration required".

Intermediate phases are not released to `main` as 1.7.x/1.8.x, because the UI would be half old, half new. If an urgent fix is needed on `main` during the migration, it ships as 1.6.x from the current code.

## Parity inventory

Every row gets a check in the phase that moves it. "Test" = automated in `frontend/tests`, "Render" = screenshot inspection, "Manual" = scripted manual check with synthetic data. Rows marked † had no automated test before Phase 0; the Phase 0 column notes what now covers them (`ui-parity.mjs` unless stated otherwise).

| ID | Feature (current) | New location | Phase | Verification |
| --- | --- | --- | --- | --- |
| F01 | Tabs Expenses / Incomes / Savings / Reports | Sidebar: Overview, Expenses, Incomes, Savings; mobile bottom bar | 2, 8 | Test |
| F02 | Working-year dropdown, per-mode persistence (`year` / `demo-year`) | Sidebar year switch; mobile More | 2, 8 | Test |
| F03 | Search: `/`, Ctrl/Cmd+K focus, Esc clears/blurs, no focus steal from editors/modals/PIN, disabled on Reports | Page header search; hidden on Overview | 2 | Test |
| F04 | Search filtering in Expenses, Incomes, Savings incl. no-match message | Same | 3, 6 | Test |
| F05 | New entry (optionally preselected group) | *New entry* split button; inspector group variant | 3, 4 | Test |
| F06 | New group | Split button menu, Edit menu | 3 | Test |
| F07 | Inline month value edit: decimal input filter, Enter saves, Esc reverts, blur saves, `-` = null, empty = 0, `.` is a thousands separator | Grid edit-in-place (D4: Enter, F2, typing or double-click; Tab saves and moves) and inspector Value with quick fill (previous month, average, clear). **Phase 4 fix:** a failed save keeps the typed value and shows an error with *Retry* and *Undo change* (inspector footer, or above the grid when the inspector is closed); same rules for both editors, the inspector skips unchanged values | 4 | Test |
| F08 | Arrange: drag entries **within** a group and drag groups (dnd-kit); moving an entry to another group uses the Group field in details (F12), not drag | Edit → Arrange, mode banner | 3 | Test (mode entry/exit, value/details blocked, entry and group drag payloads) |
| F09 | Remove mode: select entries and groups, *Remove selected* (no confirmation today), clear on exit, search leaves the mode | Edit → Remove, mode banner, bulk bar. **Phase 3 change:** the bulk bar names the selection, removal needs confirmation (Cancel keeps the selection, the dialog says which entries move to Ungrouped), a failure is shown and retried without resending already removed groups | 3 | Test |
| F10 | Tag a month cell: colours none/grey/green/orange/red, note, clear, save; none + empty note removes; Enter saves; Cancel/Esc discard | Inspector Tag section; mobile sheet. **Phase 4 change (D3):** Tags mode and its popover are removed; a colour saves on click, the note on Enter/blur (two requests when both change), Escape reverts a changed note, *Clear tag* removes it | 4 | Test |
| F11 | Tag display: colour + note tooltip | Cell bar + note corner + `title`; the note is the cell's accessible description; inspector Tag section | 3, 4 | Render + Test |
| F12 | Entry details: rename, change group/ungroup, comment, remove with confirmation | Inspector Entry details + footer. **Phase 4 change:** no *Save changes*/*Cancel*; name saves on Enter/blur, group on change, comment on blur, each as its own PATCH with only that field (the backend accepts partial patches); an empty name is not saved; Escape reverts a changed field; failures keep the draft with *Retry* | 4 | Test |
| F13 | Group details: rename, add entry to group, arrange group, remove group with confirmation | Inspector group variant (*Add entry to group*, *Arrange*, *Remove group* → *Confirm*); rename saves on Enter/blur | 4 | Test |
| F14 | Group collapse/expand, persisted per mode/type/year, restored before paint | Group row toggle | 3 | Test (existing) |
| F15 | Sum, Avg, Total row, current-month highlight | Sticky header/name/total, summary strip (desktop, whole units) | 3 | Test + Render |
| F16 | Show group totals setting | Settings → Display; group rows | 3, 7 | Test |
| F17 | Normal / Compact density (`data-view`) | Settings → Display | 3, 7 | Render |
| F18 | Ungrouped entries section (collapsible, persisted) | Grid "Ungrouped" group | 3 | Test |
| F19 | Empty states (no year, no entries, no goals, no report data) | Each view; grid: "No expenses in <year> yet." instead of an empty Ungrouped row | 3, 5, 6 | Render; grid also Test |
| F20 | Savings: add goal (name, optional target) | *New goal* → dialog (SavingsGoalModal restyled) | 6 | Test |
| F21 | Savings: edit goal (prefilled; clearing target = no target), remove goal with confirmation (outside click cancels) | Goal detail header / ⋯ menu | 6 | Test |
| F22 | Savings items: add (blank item opens in edit, Esc removes it), inline edit name/value, remove (no confirmation), temporary withdrawal (negative), balance | Quick add form + item rows | 6 | Test |
| F23 | Savings progress %, "No target" goals | Goal list + detail | 6 | Render |
| F24 | Reports KPIs income/expenses/net with previous-year comparison | Overview KPI row | 5 | Test (`.reports-story-hero` replaced) |
| F25 | Month by month with best/weakest | Overview month cards | 5 | Render + Test |
| F26 | Savings overview (saved, target progress, remaining, reached, without target) | Overview Savings card | 5 | Render |
| F27 | Where money went (groups) + top 5 entries | Overview horizontal bars | 5 | Render |
| F28 | Predictability (income/expense stability, steadiest, most variable) | Overview Predictability card | 5 | Render |
| F29 | Year operations: create year (4 digits, duplicate message), delete years with second-click confirmation. Today **all** years can be deleted (the subtitle only advises keeping one); after deletion the working year becomes the latest remaining year even if it was not deleted; adding a year does **not** switch to it (defect, see Phase 0 results) | Settings → Years / Danger zone | 7 | Test (characterises current behaviour; Phase 7 changes are deliberate and recorded) |
| F30 | Initiate year on first run (not dismissible; opens underneath Year operations after deleting all years) | InitiateYearModal restyled | 1 | Test |
| F31 | Export: choose years, XLSX download | Settings → Import & export (dialog) | 7 | Test (`ui-parity`, demo-runtime download) |
| F32 | Import: template download, validation, overwrite confirmation, progress, limits/retryable errors | Settings → Import & export (ImportModal flow) | 7 | Test for dialog and template download; † Manual with synthetic XLSX for validation, overwrite and progress |
| F33 | Settings: release info, update check vs GitHub | Settings → About; sidebar version | 2, 7 | Render (Settings captured in Phase 0 baseline); controls checked by Test |
| F34 | Lock session (logout, clears session) | Sidebar, Settings → Security, mobile More | 2, 7 | Test |
| F35 | Theme toggle light/dark with transition | Sidebar segment, Settings (+ System, D6) | 2, 7 | Test |
| F36 | PIN guard: verify, wrong PIN, rate limit/locked state, fade | Restyled overlay | 1 | Test (existing) |
| F37 | Demo mode: banner, public PIN hint, read-only values, no Year ops/Import, demo/normal switch | Sidebar/header banner; inspector read-only; Settings sections explain | 2–7 | Test (existing demo scenarios) |
| F38 | Encryption migration notice, key mismatch modal with reset | Restyled dialogs | 1 | Test (notice acknowledgement; mismatch not dismissible, reset confirmation, failed reset shown; success reload not exercised) |
| F39 | Runtime-mode load error with Retry | Restyled | 1 | Test (existing) |
| F40 | PWA install prompt (AddToHomeScreen), offline assets | Unchanged behaviour | 1 | Test (browser-security) |
| F41 | Entry comment (CommentModal) | Inspector comment field (saves on blur). `CommentModal` was no longer opened anywhere since the details panel took over comments; it is removed | 4 | Test |
| F42 | Keyboard: search shortcuts, modal focus, Esc | Plus grid navigation (arrows, Home/End, roving tabindex), Shift+Enter into the inspector, Escape closes it and returns focus, keyboard Arrange (Space, arrows) | 4 | Test |
| F43 | Mobile ≥16 px editable text, no horizontal overflow, landscape toolbar | Mobile layout | 8 | Test (existing, adapted) |
| F44 | Update-available indicator | Sidebar version dot + Settings → About | 2 | Render |

## Approach

Each phase ends with: production build, all four Chromium suites, rendered desktop/mobile light/dark inspection, parity rows of that phase checked, changelog entry. Commits/pushes only on explicit request (project policy).

### Phase 0 – Baseline and parity harness (tests only, current UI) – done 2026-10-09

- Capture baseline screenshots of all views/dialogs in both themes (ignored cache dir, as in T-016).
- Make test selectors design-independent: prefer roles, accessible names and `data-testid` where no accessible name exists, instead of `.table-context-panel`, `.context-new-button`, `.mainbar-search-input`, `.year-trigger`, `.reports-story-hero`, `.btn-ghost-premium`. Run green on the **current** UI so later failures mean behaviour change, not selector drift.
- Add missing coverage for † rows (remove mode, tags, group details, ungrouped, goal edit/remove, withdrawal, year create/delete validation, save-error surfacing) using the existing synthetic fixtures.
- Record a render-time baseline of the grid with a large synthetic year (e.g. 200 entries) to compare after Phase 3.

#### Phase 0 results

- Selectors in `ui-transitions.mjs`, `browser-security.mjs` and `demo-runtime.mjs` moved to `frontend/tests/ui-helpers.mjs` (roles, accessible names, `data-testid` hooks). Later phases change the helpers, not each assertion. Supporting attributes only, no visual change: dialog semantics and a labelled close button in `ModalBase`, PIN overlay as a labelled dialog, names for year switch, month cells/inputs, remove checkboxes, reorder handles, tag popover controls, savings item fields, Settings toggles and the Reports totals group; aria-hidden dropdown carets. No added attribute is referenced by CSS.
- New `ui-parity.mjs` (18 tests in Phase 0, 20 after Phase 1, 25 after Phase 2) covers the former † rows except the manual parts of F32; new `grid-render-baseline.mjs` measures the grid.
- Baseline (ignored, local): `.cache/ui-baseline/` holds the build (`dist/`, use with `MOPAY_UI_DIST`), 98 screenshots of all views and dialogs in both themes, `layout-metrics.json` and `grid-render.json`. Grid baseline on this host, 200 entries: first load 400 ms, cached switch from Savings 218 ms and from Incomes 182 ms (medians of 7).
- Findings to decide deliberately in their phase (not changed in Phase 0): adding a year in Year operations does not switch the working year because the year guard in `MainBar` runs before the year list refreshes (F29; user decided 2026-10-09 to fix it in Phase 7 with the Settings page, not as a separate 1.6.x fix); all years can be deleted (F29); the first-run dialog opens underneath Year operations (F30); bulk removal has no confirmation (F09); month save failures are not surfaced (F07). A newly added savings item intermittently did not open in edit mode because `GoalItemsLedger` cleared `editingRowId` before the refreshed items rendered (F22); confirmed and fixed in Phase 1 because it made the parity suite flaky.
- The frontend has no `tsconfig.json`, so the `npx tsc --noEmit -p frontend` signal below is unavailable without a separate task.

### Phase 1 – Design tokens and base components (no layout change) – done 2026-10-09

- Add `styles/tokens.css`: colours per theme (values from the mockup, incl. darkened `--text-3`), spacing 4/8, radii 6/8/12, type scale, shadows, motion 120–250 ms, z-index. Map existing `uilight.css`/`uidark.css` variables to tokens so current components restyle in place.
- Base components replacing `SoftButton`/`Surface`/ad-hoc classes: Button (primary/secondary/ghost/danger, loading, disabled), IconButton with tooltip, Input/Select/Textarea, Segmented, Switch, Menu (keyboard), Dialog (from `ModalBase`), Drawer, Badge, Callout.
- Icons: keep Tabler SVGs in `public/icons/ui`; add the few used by the design (home, folder, x, dots, check, comment, chevrons, refresh, shield). Same stroke style.
- Restyle PIN guard, initiate-year, encryption and error states (F30, F36, F38, F39).

#### Phase 1 results

- `styles/tokens.css` holds the mockup palette per theme plus spacing (`--sp-*`), radii, type scale, motion (`--dur-*`, zeroed under `prefers-reduced-motion`), z-index and control heights. Values that missed WCAG AA 4.5:1 against bg/surface/surface-2/surface-3 were adjusted: light `--text-3` #62666F, `--success` #157552, `--warning` #8E5A05, `--danger` #B93D36, `--expense` #B04D32; dark `--text-3` #9898A4 and `--on-danger` #1A0B0A (white on dark danger was 2.9:1). `uilight.css`/`uidark.css` are replaced by `legacy-bridge.css`, which maps the old variable names onto tokens; legacy `var(--border)` uses `--border-strong` so existing form controls keep their contrast. The existing screens therefore take the new palette without layout changes.
- Base components in `components/ui`: Icon, Button (primary/secondary/ghost/danger, sm, loading), IconButton (label = accessible name + tooltip), Input/Select/Textarea (label, hint, error wired with `aria-describedby`/`aria-invalid`), Badge, Callout, Dialog. **Deviation:** Menu, Segmented, Switch and Drawer are built in the phase that first uses them (Menu and Segmented in Phase 2, Drawer in Phase 4, Switch in Phase 7) so each is tested with its real consumer instead of shipping unused code.
- `ModalBase` now renders the shared Dialog, so every existing modal has the new frame. Deliberate behaviour changes, covered by `ui-parity` keyboard tests: Escape closes dismissible dialogs (fields that handle Escape themselves call `preventDefault`, e.g. the savings target field), Tab/Shift+Tab stay inside the top dialog, focus returns to the opener, and the first-run year and key-mismatch dialogs ignore Escape. `MotionConfig reducedMotion="user"` honours reduced motion. The search shortcut guard now checks `[aria-modal="true"]`.
- Restyled F30 (labelled Year field with hint and error), F36 (PIN card on an opaque background instead of a blurred scrim over the shell; form submit, error below the field), F38 (callouts, danger buttons for reset) and F39 (status card with Retry). Icons added: x, refresh, shield, alert-triangle, chevrons, dots, home, folder, message.
- Bug fix (F22): savings items keep the edit state while the refreshed list loads. New characterised defect (F21, Phase 6): Escape in the goal target field should restore the saved target, but the following blur reformats the typed draft.
- Checks: build; ui-transitions 12/12, ui-parity 20/20 (twice; savings/keyboard tests 30× without failure), browser-security 2/2, demo-runtime 1/1, backend 29/29; renders of PIN, dialog and error state at 1024, 390, 320 and 900×400 in both themes without horizontal overflow; grid render unchanged (Savings→Expenses median 231 ms, Incomes→Expenses 183 ms vs. 218/182 ms baseline; this phase does not touch the grid).

### Phase 2 – Application shell – done 2026-10-09

- Desktop (≥960 px): sidebar with brand, working year, Overview / Expenses / Incomes / Savings with totals, Settings, Lock, theme, version + update dot. Page header component (title, subtitle, toolbar slot).
- Overview first in navigation and start view (D1, D2).
- `MainBar` responsibilities move: tabs → sidebar, year → sidebar, search/New/Edit → page header. Until Phase 7 lands, Year operations, Import, Export and Settings stay reachable through a temporary sidebar "Data" group opening the existing modals (parity gate: no unreachable function).
- Mobile (<960 px) temporarily keeps the current mobile toolbar until Phase 8.
- Demo banner placed in the shell.

#### Phase 2 results

- Desktop (≥960 px): `components/shell` adds the sidebar (brand, working-year listbox, Overview/Expenses/Incomes/Savings with yearly totals or goal count, temporary **Data** group with Year operations, Import data and Export data, Settings, Lock session, Light/Dark segment, version with update link) and the page header (title + year, subtitle with counts, search, Edit menu with Arrange/Remove/Tags/New group, *New entry* split button with *New group*, *New goal* on Savings). In an edit mode the header shows a mode badge, *Remove selected* and *Done* until Phase 3 adds the mode banner and bulk bar. Demo status sits above the header; demo hides editing actions, Year operations and Import as before.
- Below 960 px the previous toolbar (`MainBar`) stays, now with Overview as the first tab; it shares navigation, edit-mode, search and lock logic with the sidebar through `shell/useShell.ts`. App-wide effects (first-run year dialog, year guard, mode reset, `/` and Ctrl/Cmd+K) moved from `MainBar` into `useShellEffects`, so they no longer depend on which toolbar is visible.
- D1/D2 implemented: the app always starts on Overview (internal key `reports`), also after unlocking; the year selection stays persisted per mode. The `tab` key is still written for rollback compatibility but no longer read.
- F03 change: Overview has no search field on desktop (it was disabled on Reports); the narrow toolbar keeps the disabled field until Phase 8.
- Sidebar totals reuse the views' query keys; inline month edits now also update the shared entries query data so the totals follow edits without a refetch.
- New base components: Menu (menu-button keyboard pattern) and Segmented.
- Known interim limitation until Phase 3: the legacy grid needs about 1 420 px, so next to the sidebar at 1440 px Dec/Sum/Avg are reached by horizontal scrolling inside the table (the page itself does not overflow). Phase 3 replaces the grid with a table that has a sticky name column.
- Checks: build; ui-transitions 12/12, ui-parity 25/25 (new: sidebar shell, D1 start/unlock, totals after edit, year listbox and Edit menu keyboard, theme segment, split button, update link F44, narrow toolbar tabs), browser-security 2/2, demo-runtime 1/1 (desktop sidebar and mobile toolbar), backend 29/29; renders at 1440, 1024, 960 and 959 px in both themes without page overflow; grid timing unchanged (217/188 ms medians).

### Phase 3 – Expenses / Incomes grid – done 2026-10-09

- Semantic `<table>` with sticky header, name column and total row; group rows with inline subtotals (respecting F16); Ungrouped section; current-month column; tag cues (bar + note corner + `title`); summary strip (year to date, monthly average, current month vs average, highest month – computed client-side).
- Edit menu (Arrange, Remove, New group); mode banner; bulk bar with specific labels and confirmation. Keep dnd-kit wiring and collapse-before-paint logic unchanged; restyle only.
- Compare grid render time with the Phase 0 baseline.

#### Phase 3 results

- `TableView` renders a semantic `<table>` (`components/table/GridRows.tsx`, `TableGridRows.tsx`, styles in `styles/grid.css`): one `<tbody>` per group, entry names as row headers, sticky header, name column and total row inside a scroll frame (desktop height-limited so header and totals stay visible), group rows with subtotals only when *Show group totals* is on (F16), Ungrouped section, current-month column, tag bar + note corner + `title`, comment marker, Compact density. Classes use the `ledger-` prefix because Tailwind scans the sources and `grid` is a utility (`display: grid`), which broke the table layout.
- Unchanged on purpose: `saveMonth` and the inline value rules (F07, known gap stays for Phase 4), the `useLayoutEffect` collapse restore (v1.6.3), the dnd-kit sensors, contexts, payloads and handlers (`SortableScope` only wraps them; its accessibility nodes are portaled to `document.body` because inline they would be `<div>`s inside the table), Tag mode and its popover, and the details panel.
- Summary strip (desktop): year total, monthly average (same value as the Total row Avg), current month vs average (red when unfavourable: above for expenses, below for incomes; arrow and words, not colour only) and highest month, from the same visible totals as the Total row. Whole units like the sidebar, so the exact values stay in the grid and the strip does not repeat them.
- Edit modes: the header badge and the header/narrow-toolbar *Remove selected* buttons are replaced by a mode banner (`role="status"`) above the grid and, in Remove mode, a bulk bar below it (`components/table/EditModeBars.tsx`). Store fields `bulkRemoveRequestId`/`requestBulkRemove` are removed; the removal runs from the bar's confirmation. Edit menu labels stay *Arrange*, *Remove*, *Tags* until Phase 4 removes Tags.
- Layout: at 1440 px all 14 value columns fit next to the sidebar with five-digit monthly totals and six-digit yearly sums, at 12 px between 960 and 1599 px (13 px from 1600 px and below 960 px). From 960 to about 1300 px and on the narrow layout the table scrolls horizontally inside its frame with the name column pinned; the page itself never overflows. This removes the Phase 2 interim limitation.
- Tests: `ui-parity` 25/25 with extended assertions (summary strip values, no horizontal grid overflow at 1440 px, tag note as accessible description, empty-year message, bulk removal confirmation/cancel/failure/retry payloads). The Arrange drag helper now waits 100 ms after a drop: dnd-kit swallows clicks for 50 ms after a drop by design, and the faster grid let the following *Done* click land inside that window (4 of 12 runs failed without the wait, 16 of 16 passed with it; the HEAD build passed 6 of 6 because its slower render delayed the click).
- Checks: build; ad hoc `tsc --strict --noUnusedLocals` over the changed files clean (no project tsconfig); ui-transitions 12/12, ui-parity 25/25 (three runs), browser-security 2/2, demo-runtime 1/1; renders at 1440, 1024, 767, 390, 320 and 900×400 in both themes (view, inline edit, Remove with selection and confirmation, Arrange; Compact with group totals and the empty year at 1440 and 390) without page overflow and with 16 px inline inputs on mobile; grid timing with 200 entries: cached switch from Savings 183 ms and from Incomes 167 ms (medians of 7) vs. 218/182 ms baseline, first load is a single sample (353–425 ms vs. 400 ms).
- Remaining for later phases: Arrange is pointer-only as before (keyboard grid model and sortable keyboard support belong to Phase 4); the narrow layout keeps the horizontally scrolling grid until the month list (Phase 8); a value-save failure is still unsurfaced (Phase 4).

### Phase 4 – Inspector drawer – done 2026-10-09

- Non-modal overlay drawer (no layout reflow, no scrim), 360 px, focus moves into it on open and returns to the cell on close; selected row highlighted.
- Sections in order: Value (quick fill: previous month, average, clear) → Entry details (name, group, comment) → Tag (colour + note) → Entry (12-month bars with average line; Sum, Average, vs previous month, same month previous year per D5). Footer: save status and *Remove entry* with confirmation.
- Variants: group row (F13), entry name (details + chart only), demo read-only (no inputs, explanation).
- Grid keyboard model (D4) with ARIA grid semantics and roving tabindex.
- Explicit save feedback: pending, saved, and inline error with retry for value, details and tag saves; today `saveMonth` has no error handling – fix as part of this phase without changing API calls.
- After parity rows F07, F10–F13, F41 pass: remove `TableContextPanel`, `TagEditorPopover`, `CommentModal` usage and the `'tag'` edit mode (D3).

#### Phase 4 results

- `components/table/Inspector.tsx`: a non-modal overlay drawer (`aside` named after the selection, no scrim, no layout reflow, 360 px; below 960 px a bottom sheet of at most 75 % height until Phase 8). Sections: Value (quick fill: previous month, average, clear) → Entry details (name, group, comment) → Tag (colour swatches + note) → Entry (12 bars with the average line; Sum, Average, vs previous month, same month of the previous year). Variants: group (rename, add entry to group, arrange, remove), entry name (details and facts only), demo read-only (texts and an explanation, no inputs or remove). Footer: save status (*Saving…*, *Saved hh:mm*, error with *Retry*/*Undo change*) and remove with *Confirm*. The drawer fades/slides with the Dialog's CSS-variable opacity technique; the transitions suite checks monotonic opacity and that no dialog layer exists.
- D4: one click selects a month cell and opens the inspector; Enter, F2, a typed digit/sign/separator or a double-click edit in place; Tab/Shift+Tab in the editor save and move; Escape cancels an edit, then closes the drawer and returns focus to the cell (or to the name that opened it). Arrow keys, Home and End move between month cells; while the inspector shows a cell the selection follows. Shift+Enter moves focus into the inspector. Entry and group names move focus into it directly.
- **Deviation from "ARIA grid semantics":** the table keeps native table semantics (row headers, captions) with buttons in the month cells and a roving tabindex among them, instead of `role="grid"`. The buttons keep their names (`entry, month: value`), and the name, collapse and handle buttons stay reachable with Tab. A full ARIA grid would have to move all of those into arrow navigation; that is not justified for this table. Focus stays in the grid on a cell click, because D4 lets typing edit the selected cell in place.
- D5: same name in the previous year from the `['entries', type, year - 1]` query that Overview uses (fetched only while the inspector shows an entry and the year exists); no match or no value → "—". January has no "vs previous month".
- D3: Tags mode, `TagEditorPopover`, `TableContextPanel` and the unused `CommentModal` (with its store state) are deleted, ahead of the Phase 9 list. The Edit menu and the narrow Actions menu offer Arrange and Remove.
- Saves: `useSaveStatus` serves values, details, tags and removals. Value edits stay optimistic as before, with undo. A failure stays visible until it is retried or undone, even if later saves succeed. Fields remember the last submitted value, so Enter followed by blur, or a blur caused by clicking *Retry*, does not send a change twice.
- Arrange gains dnd-kit's `KeyboardSensor` (Space/Enter picks up, arrows move, Space/Enter drops, Escape cancels). Payloads and handlers are unchanged.
- Rows get stable callbacks and a shared empty tag object, so memoised rows skip re-rendering when the selection or focus moves. Grid timing with 200 entries: cached switches 167/150 ms (Phase 3: 183/167 ms, baseline 218/182 ms); first load 388 ms (single sample).
- Tests: `ui-parity` 27/27 (new: cell inspector with value, quick fill, keyboard model, Tab/Escape semantics, roving tabindex, tags, D5; details rewritten for single-field saves, empty name, Retry; F07 failure now asserts error, Retry and Undo instead of the unhandled rejection; Edit menu without Tags; keyboard reordering). The keyboard sorting test paces its keys by 100 ms because dnd-kit updates the drop target on the next frames. `ui-transitions` 12/12 (inspector open/close opacity, no modal layer, cell selection with focus return, demo read-only inspector). Helpers: `details` is the inspector, `rowName`/`openDetails` look up names inside the grid (the inspector repeats the name as its title), `selectCell`, `editCell` (focus + Enter) and `inspectorValue`. The parity fixture has 2025 incomes for D5.
- Checks: build; ad hoc strict `tsc --noUnusedLocals` over all 51 sources clean; ui-transitions 12/12, ui-parity 27/27, browser-security 2/2, demo-runtime 1/1, backend not touched; renders at 1440, 1024, 767, 390, 320 and 900×400 in both themes (cell, save error, group, entry): the drawer stays inside the viewport, no page overflow, editable inspector text 16 px on mobile.
- Remaining: on the narrow layout the bottom sheet covers most of the grid while open (non-modal, closed with ✕ or Escape) until the Phase 8 sheet; screen-reader testing is still a documented gap.

### Phase 5 – Overview (former Reports)

- Rebuild `ReportsView` layout as Overview: KPI row → month by month (best/weakest labelled, current month outlined, no-data dashed) → where money went (groups + top 5 as horizontal bars) beside Savings → Predictability.
- Reuse `reports/analytics.ts` unchanged; no new metrics. Keep existing empty/partial-data messages.
- Month card click opens Expenses with that month's column selected (no inspector auto-open).

### Phase 6 – Savings list + detail

- Goal list (progress, % or "No target") and goal detail (balance vs target, remaining, contributions, withdrawals, items).
- Quick add form = existing two calls (`addItem` then `updateItem`). On second-call failure, show the error and remove the empty item (or keep it marked with retry) – never leave a silent empty item.
- Item inline edit/remove on hover/focus; goal edit via existing dialog; goal delete with confirmation. Search filters goals as today.

### Phase 7 – Settings page

- Non-persisted settings view (D7) with sections Display (theme incl. System per D6, density, group totals), Security (lock, encryption status), Years (create year), Import & export (Export dialog, template download, ImportModal flow unchanged), About (version, channel, update check), Danger zone (delete years: checklist, working year protected, export reminder, typed confirmation).
- Demo mode: Years/Import sections show a read-only explanation.
- Remove the temporary sidebar "Data" group and the hamburger menu once F29–F35 pass.

### Phase 8 – Mobile (<960 px)

- Bottom tab bar (Overview, Expenses, Incomes, Savings, More); More = Settings, working year, theme, lock, version.
- Expenses/Incomes as month list with month stepper and month summary; tap opens bottom sheet in inspector order (Value, Entry details, Tag, Entry facts); Arrange/Remove reachable from a page menu.
- Overview, Savings and Settings stacked versions. Keep ≥16 px editable text, 44 px touch targets, landscape handling from T-013.

### Phase 9 – Cleanup and documentation

- Delete unused CSS from `global.css` (currently ~5 000 lines) and unused components (`MainBar`, `Surface`, `SoftButton`, `SettingsModal`, `YearOperationsModal` if fully replaced; `TableContextPanel`, `TagEditorPopover` and `CommentModal` were already removed in Phase 4). Verify with build and a search for references.
- Update README screenshots (T-016 procedure), `docs/ARCHITECTURE.md` UI section, `frontend/tests/README.md`, CHANGELOG; keep `docs/mockup_UI` as design reference.
- Final full parity pass over all 44 rows in normal and demo mode.
- CHANGELOG `v2.0.0`: *Breaking UI changes* (navigation, start page, tagging, click-to-select, settings page, mobile), *Improvements* (deliberate functional changes recorded per parity row), *Upgrade notes* (no migration; data, API, configuration unchanged; rollback = previous image).

## Risks and verification

- **Hidden feature loss** – mitigated by the parity inventory, Phase 0 coverage of † rows, per-phase gates and a final full pass. Any row that cannot be kept blocks the phase and is raised with the user.
- **Interaction change (D3, D4)** – single click no longer starts editing; mitigated by edit-on-type/Enter/double-click and tests for each path. Revisit after user validation on the `dev` image.
- **Drawer covers last columns** – accepted in design; selected row highlight and drawer header name the cell; verify the selected cell is never the only indicator.
- **Flicker/animation regressions** – reuse T-003 opacity sampling in `ui-transitions.mjs` for drawer open/close and view switches.
- **Rollback** – frontend-only, no data or API changes; revert the phase commits. Persistence keys stay backward compatible (D6, D7); new keys are ignored by older builds.
- **PWA caches** – no header-policy change expected, so the `index.html` revision comment stays; if any header change becomes necessary, bump it as required by the project profile.
- **Accessibility** – ARIA grid pattern is complex; test with keyboard only and check accessible names in tests. Screen-reader testing remains a documented gap unless available.
- **No typecheck gate** – Vite build does not typecheck and the frontend has no `tsconfig.json`, so a local `tsc` signal needs a separate task; rely on the build and the browser suites.

Commands per phase (from repository root, Playwright environment as in [test guide](../../frontend/tests/README.md)):

```sh
npm --prefix frontend run build
node --test frontend/tests/ui-transitions.mjs
node --test frontend/tests/ui-parity.mjs
node --test frontend/tests/browser-security.mjs
node --test frontend/tests/demo-runtime.mjs
git diff --check
```

## References

- Design: [final-ledger.html](../../docs/mockup_UI/final-ledger.html), [mockup README](../../docs/mockup_UI/README.md), [UI design guidelines](../UI_DESIGN_GUIDELINES.md)
- Code: [App.tsx](../../frontend/src/App.tsx), [store.ts](../../frontend/src/store.ts), [api.ts](../../frontend/src/api.ts), [MainBar](../../frontend/src/components/MainBar.tsx), [TableView](../../frontend/src/components/TableView.tsx), [TableContextPanel](../../frontend/src/components/table/TableContextPanel.tsx), [ReportsView](../../frontend/src/components/ReportsView.tsx), [analytics](../../frontend/src/reports/analytics.ts), [SavingsView](../../frontend/src/components/SavingsView.tsx), [global.css](../../frontend/src/styles/global.css)
- Constraints: [project profile](../PROJECT.md), [browser security policy](../../backend/browserSecurity.js), prior UI tasks [T-003](T-003-ui-flicker.md), [T-009](T-009-pin-tailwind.md), [T-013](T-013-mobile-search.md), [T-016](T-016-readme-screenshots.md)
