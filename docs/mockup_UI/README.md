# MOPAY UI concepts

Conceptual redesign proposals for the MOPAY frontend, based on
[UI design guidelines](../../.ai/UI_DESIGN_GUIDELINES.md). These are static,
clickable HTML mockups. **No application code, configuration or data was
changed**, and nothing here is loaded by the app.

Open [index.html](index.html) in a browser (works from the file system, no
build or server). Each concept page has a screen switcher and a light/dark
toggle in the top bar, and design notes under the mockup that cite the
relevant guideline sections (§n).

| File | Concept | Screens |
| --- | --- | --- |
| [final-ledger.html](final-ledger.html) | **Final** – A + inspector (C) + savings and settings (D) + mobile (B) + Overview | Overview, expenses, cell selected, edit menu, remove mode, savings, settings, mobile |
| [concept-a-ledger.html](concept-a-ledger.html) | A · Ledger – sidebar shell, spreadsheet-grade grid | Expenses, entry drawer, tag mode, remove mode, savings, year operations |
| [concept-b-monthly.html](concept-b-monthly.html) | B · Monthly – top navigation, month-first workflow | Month view, year view, mobile (list, edit sheet, more menu) |
| [concept-c-inspector.html](concept-c-inspector.html) | C · Inspector – three panes, no modes, command palette | Cell selected, multi-select, command palette, reports |
| [concept-d-calm.html](concept-d-calm.html) | D · Calm home – overview-first, warm and readable | Overview, savings goal, settings page, PIN screen |

`shared/` holds the synthetic demo data (values mirror the README
screenshots), the Tabler-style icon sprite and the mockup chrome. Mockups use
the Inter font shipped in `frontend/public/fonts`.

## Final direction

Selected on 2026-10-09: **Concept A · Ledger** as the base, combined with:

| From | Element | How it is adapted |
| --- | --- | --- |
| C · Inspector | Cell selected panel | Inspector content in the order **Value → Entry details → Tag → Entry** (12-month chart, then Sum, Average, vs previous month, same month previous year), shown as Concept A's drawer: it slides over the right part of the table, non-modal, and the layout underneath never changes. The selected row keeps an accent highlight. `Esc` closes it. Replaces the details panel, Tag mode and its popover. |
| D · Calm home | Savings | Goal list + goal detail with a quick add form (contribution / temporary withdrawal), styled with A tokens. |
| D · Calm home | Settings page | Display, Security, Years, Import & export, About, Danger zone. Year operations, Import and Export leave the sidebar; A's year deletion safeguards (counts, protected working year, typed confirmation) move into the Danger zone. |
| Reports | Overview | Reports is renamed **Overview**, placed first in the sidebar and opened after unlock. It keeps only today's Reports content, ordered summary → month by month → where money went + savings → predictability, with the donut replaced by horizontal bars. Same calculations as `reports/analytics.ts`. |
| B · Monthly | Mobile | Month list with stepper and summary, bottom tab bar; tapping an entry opens a bottom sheet in the same order as the desktop inspector. |

What changes compared with Concept A alone:

- Tag mode is removed on desktop; tagging is done in the inspector. The
  *Edit* menu keeps Arrange and Remove.
- Clicking a value selects it; double-click, Enter or typing still edits in
  place and arrows move the selection.
- The entry drawer is replaced by the inspector, which keeps the drawer's overlay behaviour.
- Navigation order: Overview, Expenses, Incomes, Savings (desktop sidebar and mobile tab bar).

Open points for the final design:

- Group-row and entry-name selection states of the inspector are described
  but not drawn.
- While the inspector is open it covers the last columns (about Oct–Avg at
  1440 px); the selected month may be under the panel. The panel header names
  the month and the row stays highlighted; closing the panel reveals the
  columns again.
- Year-over-year percentages on Overview are illustrative in the mockup.

## What all concepts share

- Semantic colour tokens per theme (background, surface layers, text levels,
  border, accent, focus, success/warning/danger, income/expense, tag colours),
  with a separate dark palette rather than inverted colours (§6, §23).
- Group rows lose the saturated accent bars; colour is reserved for state and
  meaning. Tags show colour **and** a non-colour cue (bar/underline, visible
  note) (§18).
- One primary action per context, descriptive labels (`Remove 2 entries`,
  `Save tag`, `Delete 2024`) (§9, §24).
- Tabular numerals, right-aligned amounts, sticky headers/totals (§13).
- 4/8 px spacing, radii 6/8/12 px, shadows only on floating layers (§4, §8).
- Same icon family as today (Tabler outline) (§10).

## Feature coverage

Every current function and where it lives in each concept. "As today" means
the existing component can keep its behaviour with new styling.

| Current function | A · Ledger | B · Monthly | C · Inspector | D · Calm home |
| --- | --- | --- | --- | --- |
| Tabs Expenses / Incomes / Savings / Reports | Sidebar | Top tabs; mobile bottom bar | Rail | Tabs; Reports → Overview |
| Year selector | Sidebar "Working year" | Top bar select | Bar next to title | Header select |
| Search (`/`, Ctrl/Cmd+K, Esc) | Header search | Top bar search | Palette (Ctrl+K) + `/` table search | Header search |
| New entry / New group | Split button | `New ▾` | Button + palette | As A |
| Inline month value edit | Grid cell, keyboard nav | Month list field; year grid cell | Grid cell + inspector field | As A |
| Arrange (drag order) | Edit menu → handle column | `⋯` menu | Hover grip, `Alt+↑/↓`; mode on touch | As A |
| Remove (bulk entries/groups) | Edit menu → checkboxes + bulk bar | `⋯` menu | Hover checkboxes + inspector bulk panel | As A |
| Tags (colour + note) | Tag mode + popover | Note under name; sheet on mobile | Inspector, no mode | As A; notes list on Overview |
| Entry details (name, group, comment, remove) | Right drawer | Row `⋯` → details | Inspector | As A |
| Group details (rename, add entry, arrange, remove) | Drawer for group row | Group `⋯` | Inspector for group | As A |
| Collapse/expand groups (persisted) | Group row toggle | Year view toggle | Group row toggle | As A |
| Sum / Avg / Total / current month highlight | Yes, sticky totals | Year view; month total in list | Yes | As A |
| Show group totals setting | Kept (always-on subtotal proposed) | Kept | Kept | Settings page |
| Normal / Compact density | Settings | Settings | Sub-bar toggle | Settings page |
| Savings goals, optional target, progress | Goal list rows | As today, restyled (not mocked) | Not mocked, follows A | List + detail |
| Savings items, temporary withdrawal | Expandable items, badge | As today | Follows A | Detail table, quick add form |
| Reports KPIs with year-over-year | Not mocked, restyled | Side panel (month) | KPI row | Overview hero |
| Month by month, best/weakest | Not mocked | Strip in side panel | Combined chart | Net bar chart |
| Where money went, top entries | Not mocked | – (Reports tab as today) | Bars + table | Overview / Full analysis |
| Predictability | Not mocked | – (Reports tab as today) | Not mocked, kept in Reports | Full analysis page |
| Year operations (create, delete, ≥1 year) | Dialog, typed confirmation | Menu → dialog | Rail "Years" / palette | Settings: Years + Danger zone |
| Export (choose years) | Sidebar → dialog | Menu → dialog | Rail "Data" / palette | Settings: Import & export |
| Import (template, validation, overwrite confirm, progress) | Sidebar → dialog as today | Menu → dialog as today | Rail "Data" / palette | Settings: Import & export |
| Settings: release info, update check | Sidebar footer version | More menu footer | Status bar | Settings: About |
| Lock session | Sidebar footer | Top bar icon; mobile More | Rail | Header icon; Settings |
| Theme toggle | Sidebar segment | Top bar icon; mobile More | Palette / settings | Settings (+ System) |
| PIN guard | As today, restyled | As today | As today | Redesigned PIN screen |
| Demo mode (no year ops/import, read-only) | Hide/disable items as today | Same | Same | Sections show read-only explanation |
| First-run year setup, encryption notices, key mismatch | As today, restyled dialogs | Same | Same | Same |
| PWA install prompt | As today | As today | As today | As today |

Not every screen of every concept is mocked; the gaps are marked "not mocked"
above and reuse the concept's patterns.

## Functional improvements proposed

All are optional and independent of the visual direction. API impact was
checked against the current client ([api.ts](../../frontend/src/api.ts)).

| Improvement | Concept | API impact |
| --- | --- | --- |
| Keyboard cell navigation (arrows, Tab, Enter, Esc) | A | None – same per-month `PATCH` |
| Inline group subtotals always visible | A | None |
| Entry insight in details (sum, average, highest, 12-month bars) | A, C | None – computed from loaded data |
| Year deletion with typed confirmation and entry counts | A | None for confirmation; counts from loaded data where available |
| Copy entries and groups when creating a year (values empty) | A, D | None required (existing create calls); a server-side endpoint would be faster |
| Month view with previous month and change | B | None |
| Suggest / fill empty values from previous month | B | None – existing `PATCH` per entry |
| Net result row in year grid | B | None – data used by Reports |
| Mobile bottom sheet for value + tag + note | B | None |
| Tags and multi-select without modes on desktop | C | None |
| Move several entries to a group at once | C | None – existing entry update per item |
| Command palette | C | None |
| Visible "Saved" state and status bar | C | None |
| Overview home, "month still empty" prompt | D | None |
| Notes from tags list | D | None – tags already loaded per year |
| Quick contribution form in savings goal | D | None – same savings item model |
| Theme "System" option | D | None (local preference) |

## Recommendation

Start from **A** (guideline §29: extend the existing design language; lowest
risk; keeps users' spatial memory). Add **B's month view** as a second view of
Expenses/Incomes – the largest workflow gain, and it gives phones a real
layout instead of a scrolling grid. Then adopt **D's settings page** and
**notes from tags**. Treat **C's command palette** and inspector as a later,
optional power-user layer.

A practical sequence:

1. Introduce design tokens (colour, spacing, radius, typography) in
   `frontend/src/styles` and restyle existing components without layout
   changes. Low risk; UI regression tests in
   [frontend/tests](../../frontend/tests/README.md) cover transitions.
2. Application shell (A): sidebar on desktop, top bar + drawer on mobile.
3. Grid refinements: sticky columns/totals, quieter group rows, tag cues,
   keyboard navigation.
4. Month view (B) behind the `Month | Year` toggle.
5. Settings page and Overview elements (D).

## Limitations

- Mockups are static: interactions are illustrated by state, not wired. Data is
  synthetic; percentages vs 2025 are illustrative.
- Accessibility was designed for (semantic tables, labels, focus styles,
  reduced motion). All text colour tokens were computed to meet WCAG AA
  (4.5:1) against their backgrounds in both themes; the mockups were not
  audited with assistive technology.
- Rendered and checked in Chromium at 1440 px and 390 px widths; other browsers
  were not checked.
