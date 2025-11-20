MOPAY – Architecture & Technical Overview
1. High‑Level Overview
MOPAY is a self‑hosted personal finance and home payments app focused on:

Tracking yearly income and expense lines month by month
Managing multiple years in a single database
Defining savings goals and tracking progress toward them
Providing lightweight analytics reports (balances, leaders, stability)
Protecting access with a PIN guard
Running as a PWA with a modern, responsive UI
The app is split into:

Backend: Node.js + Express + SQLite (via better-sqlite3) + Excel export
Frontend: React + TypeScript + Vite + Tailwind CSS, with React Query and Zustand
2. Tech Stack
Backend
Node.js (ESM)
Express
better-sqlite3 for SQLite access
ExcelJS for XLSX export
Frontend
React + TypeScript
Vite bundler
Tailwind CSS (custom design system in CSS)
React Query (@tanstack/react-query) for data fetching + caching
Zustand for global app state
@dnd-kit for drag‑and‑drop row ordering
framer-motion for animations
Deployment
Docker & docker‑compose
Single container exposing port 8010
3. Repository Structure
backend/
  db.js           # SQLite initialization and schema loading
  export.js       # Export selected years into styled XLSX workbook
  schema.sql      # Database schema
  server.js       # Express server and REST API

frontend/
  index.html      # Vite entry HTML
  src/
    api.ts        # Typed API client (fetch wrapper)
    App.tsx       # Root React application component
    main.tsx      # React entry + React Query/Zustand providers
    store.ts      # Global state with Zustand
    components/   # UI components, views and modals
    reports/      # Report definitions and IDs
    utils/        # Currency + month utilities
    styles/       # Global CSS / themes
4. Backend
4.1 Database Initialization (backend/db.js, backend/schema.sql)
Resolves DB location from DB_FILE env (default ./mopay.sqlite).
Opens a better-sqlite3 connection, enabling:
journal_mode = WAL
foreign_keys = ON
Loads and executes schema.sql at startup. Schema:
Tables:

years
id (PK), year (unique integer, e.g. 2024)
entries
id (PK)
type ('income' | 'expense')
name (entry label)
year_id (FK → years.id)
comment (optional)
Jan … "Dec" (REAL, monthly amounts)
sort_index (ordering within year + type)
savings_goals
id (PK)
year_id (FK → years.id)
name
target_value (optional numeric target)
sort_index
created_at
savings_items
id (PK)
goal_id (FK → savings_goals.id, ON DELETE CASCADE)
name (optional)
value (numeric)
sort_index
Indexes exist on (year_id, type) and savings foreign keys for performance.

4.2 Express Server (backend/server.js)
Configuration:

PORT (default 8010)
APP_PIN: if empty, PIN verification always succeeds; if set, used to protect the UI.
Common helpers:

clampText(value, max) – trims and limits text to a given length.
getYearRow(year) – validates a numeric year and returns corresponding row from years.
Middleware:

cors({ origin: true, credentials: true })
express.json()
morgan('dev') logging
Static UI:

express.static for backend/public
Catch‑all GET * serving public/index.html for the SPA.
4.3 API Endpoints
All APIs return JSON unless stated otherwise.

Health & PIN
GET /health
Returns { status: 'ok' } for health checks.
POST /api/pin/verify
Input: { pin: string }
Behavior:
If APP_PIN is empty → { ok: true }
If APP_PIN set → checks 4–8 digit PIN; returns 401 on mismatch.
Years
GET /api/years
Returns { years: number[] } sorted ascending.
GET /api/years/exists
Returns { hasAny: boolean }.
POST /api/years
Input: { year: number } (4 digits).
Inserts a new year; 409 on duplicate.
DELETE /api/years
Input: { years: number[] }.
Deletes selected years and all associated data:
entries for those years
savings_goals and savings_items for those years
Entries (Incomes & Expenses)
GET /api/entries?type=income|expense&year=YYYY
Looks up year_id and returns:
{ entries: [{ id, name, comment, sort_index, Jan, ..., Decm }] }
Uses alias "Dec" AS Decm for the December column.
POST /api/entries
Input: { type: 'income' | 'expense', year: number, name: string }
Adds entry with sort_index = max + 1 within that year+type.
PATCH /api/entries/:id
Input: any subset of:
name, comment, sort_index, Jan..Dec
Updates selected columns; fails with 400 if nothing provided.
DELETE /api/entries
Input: { ids: number[] }
Bulk delete by id.
POST /api/entries/reorder
Input: { orderedIds: number[] }
Reassigns sort_index in the given order using a transaction.
Savings
GET /api/savings?year=YYYY
Returns goals for the year or [] if year not found.
Response format:
{
  goals: Array<{
    id: number;
    name: string;
    targetValue: number | null;
    sortIndex: number;
    items: Array<{
      id: number;
      goalId: number;
      name: string;
      value: number;
      sortIndex: number;
    }>;
  }>;
}
POST /api/savings
Input: { year: number, name: string, targetValue: number | null }
Validates year, clamps goal name, and inserts with sort_index = max + 1.
PATCH /api/savings/:goalId
Input: any subset of { name?: string, targetValue?: number | null }
Validates target as number or null; requires at least one field.
DELETE /api/savings/:goalId
Deletes goal; savings_items are removed via FK cascade.
POST /api/savings/:goalId/items
Input body: optional { name, value } (defaults empty name / 0).
Inserts item with next sort_index under the goal.
PATCH /api/savings/items/:itemId
Input: { name?, value? } (value must be numeric).
DELETE /api/savings/items/:itemId
Deletes an individual item.
Export
POST /api/export
Input: { years: number[] }.
Uses exportYearsToWorkbook to build an in‑memory XLSX workbook.
Response:
Content type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="mopay_export.xlsx"
4.4 Excel Export Implementation (backend/export.js)
Uses ExcelJS + a custom color palette and borders.
For each requested year:
Creates a worksheet named with that year.
Row 1: big title “Mopay Export {year}”.
Renders sections in order:
Incomes table (all income entries, monthly columns + sum/avg/comment)
Expenses table (same structure)
Savings section:
Renders each goal as a mini‑table with:
Title row
Target row
Item rows
Total row
Goals are laid out in a grid (TABLES_PER_ROW per row).
Currency formatting via #,##0.00 and explicit numeric formats.
5. Frontend
5.1 Global State (frontend/src/store.ts)
Zustand store holds core application state:

Core fields:
tab: 'expenses' | 'incomes' | 'savings' | 'reports'
year: number | null – active year
theme: 'light' | 'dark'
editMode: null | 'name' | 'order' | 'remove'
pinSession: boolean – whether PIN has been verified
Selection state:
removeSelection: Set<number> – entries selected for bulk removal
selectedReports: ReportId[] – active reports in the Reports view
Modal state:
modals.add, modals.comment, modals.yearOps, modals.export,
modals.settings, modals.initiateYear
goalModal: { open: boolean; goalId: number | null }
Actions:
setTab, setYear, setTheme, setEditMode, setPinSession
toggleRemoveId, clearRemove
toggleReport, clearReports
openModal, closeModal, setComment
openGoalModal, closeGoalModal
Some values are persisted in localStorage: tab, year, theme, selectedReports.
5.2 API Client (frontend/src/api.ts)
api(path, init?):
Wraps fetch against VITE_API_BASE (if set).
Always sends Content-Type: application/json by default.
If response is JSON, returns parsed JSON; otherwise returns the Response.
Api collection:
verifyPin(pin)
years.list(), .exists(), .add(year), .remove(years)
entries.list(type, year), .add(...), .patch(id, payload), .remove(ids), .reorder(orderedIds)
savings.list(year), .addGoal(...), .updateGoal(id, payload), .removeGoal(id),
.addItem(goalId), .updateItem(itemId, payload), .removeItem(itemId)
exportYears(years) – calls /api/export and triggers XLSX download in the browser.
All screen components use Api via React Query hooks for data fetching/invalidation.

5.3 Root Application (frontend/src/App.tsx)
Imports global CSS and wires the main layout:
Sticky header with “glass” effect based on scroll position.
Applies theme via document.documentElement.dataset.theme and a short “theme-changing” class for smooth transitions.
Renders:
<PinGuard /> – PIN overlay
<MainBar /> – navigation, actions and year selection
Tab content:
TableView for expenses/incomes
SavingsView for goals
ReportsView for analytics
Modals: InitiateYearModal, AddEntryModal, CommentModal, YearOperationsModal,
ExportModal, SettingsModal, SavingsGoalModal
AddToHomeScreen – PWA install hint (mobile add‑to‑home‑screen).
5.4 Main UI Components
5.4.1 MainBar (frontend/src/components/MainBar.tsx)
Top navigation bar responsible for:
Tab switching (Expenses/Incomes/Savings/Reports)
Year selection via YearDropdown (data from /api/years)
Theme toggle
Session lock (clears PIN session)
Dropdown “Menu” with:
“Year operations” → YearOperationsModal
“Export data” → ExportModal
“Settings” → SettingsModal
Primary action area depends on current tab:
Expenses/Incomes:
Default: “Add entry” and “Edit entries” dropdown (change name/order/remove).
In edit mode: “Remove selected” or “Exit mode”.
Savings:
“Add goal” button (opens SavingsGoalModal).
Reports:
Report toggles based on REPORT_DEFINITIONS.
5.4.2 TableView (Entries) (frontend/src/components/TableView.tsx)
Central table for income/expense entries:
Columns: comment icon, name, 12 months, Sum, Avg.
Key features:
Uses React Query (useEntries) to fetch entries by type + year.
Inline editing:
Click name to edit (in name edit mode).
Click monthly amount to edit it (with currency input parsing).
Drag‑and‑drop (@dnd-kit):
“Change order” mode allows reordering rows.
Persisted via /api/entries/reorder.
Bulk remove:
“Remove entries” mode uses checkboxes + global removeSelection.
Removal triggered via a custom bulk:remove event and /api/entries DELETE.
Includes local animation before deleting.
Totals:
Computes per‑month sums, total sum and average, rendered in a “Total” row.
5.4.3 SavingsView (frontend/src/components/SavingsView.tsx)
Shows savings goals for the selected year:
If no year → “Select a year” placeholder.
If loading → loading state.
If no goals → informational message + “Add goal” button.
For each goal renders a GoalCard:
Header with goal name, Edit and Remove actions.
Optional progress bar if targetValue set: current / target and %.
GoalItemsTable:
Editable rows for items (name + value), in place.
Empty row content deletes the item on blur.
“+ Add item” button.
Displays total goal value.
All updates (add/remove/update item, remove goal) invalidate the ['savings', year] query.

5.4.4 ReportsView (frontend/src/components/ReportsView.tsx)
Fetches both income and expense entries for the active year.

Renders cards for each report selected in selectedReports.

Report definitions (frontend/src/reports/config.ts):

monthly-balance (“Income vs expenses”)
Shows total income, total expense, net, best/worst month.
Renders per‑month balance bars.
spending-leaders (“Top expenses”)
Top 5 expense entries by annual total and their share.
income-stability (“Income stability”)
Displays streams sorted by coefficient of variation (std dev / mean).
expense-stability (“Expense stability”)
Same metric focused on expenses, highlights volatile categories.
No server‑side analytics; all computed in the browser from fetched entries.

5.4.5 PinGuard (frontend/src/components/PinGuard.tsx)
Full‑screen overlay that blocks the UI until PIN is verified.
Behavior:
On mount:
Checks sessionStorage["pin-ok"]; if "1", unblocks immediately.
On submit:
Sends { pin } to /api/pin/verify.
On success: marks pinSession in store and caches "pin-ok" = "1" in sessionStorage.
On failure: clears input, shows transient “Wrong PIN” feedback.
MainBar “lock” action clears this session and returns to PIN screen.
5.5 Modals (Overview)
All modals use a shared ModalBase and are controlled from Zustand:

InitiateYearModal
Shown automatically if there are no years.
Asks user for initial year (e.g. 2024), calls Api.years.add, sets active year.
AddEntryModal
Adds a new income/expense entry to the current year.
Invalidates the corresponding entries query.
CommentModal
Allows editing comment attached to a single entry.
YearOperationsModal
Add year: numeric field + add button, prevents duplicates, auto‑selects new year.
Cleanup: checkbox list of years to delete; handles active year fallback.
ExportModal
Year selection for data export.
Calls Api.exportYears to download XLSX.
SettingsModal
General configuration UI (e.g., theme, maybe more as project evolves).
SavingsGoalModal
Form for creating or editing a savings goal (name + optional target).
5.6 Utility Modules
utils/currency.ts
pln(n) – formats number as PLN using Intl.NumberFormat.
formatCurrency(value) – local UI format 1 234,56 style.
parseCurrencyInput(input) – parses flexible string input into number.
utils/months.ts
MONTHS constant array and MonthKey type alias.
6. Data Flow Summary
User selects a year / tab in UI
Zustand updates year / tab, persisted to localStorage.
React Query fetches data
Components call Api.*, which wraps REST calls.
Queries cached and invalidated after mutations.
Express serves data from SQLite
Each API route interacts with better-sqlite3 using prepared statements.
Business logic is simple and mostly 1:1 with UI needs.
User edits data
Frontend applies optimistic or near‑optimistic updates (e.g. reordering, animation).
Backend persists changes.
Export
UI sends selected years to /api/export.
Backend builds Excel workbook using DB data and returns a downloadable XLSX.
7. Configuration & Environment
Important environment variables:

PORT – HTTP port (default 8010 inside container).
DB_FILE – path to SQLite file (e.g. /data/mopay.sqlite in Docker).
APP_PIN – 4–8 digit PIN. If empty, PIN guard is effectively disabled.
NODE_ENV – production for optimized build.
8. Extending the Project (Guidelines)
New backend features
Add DB columns/tables in backend/schema.sql.
Expose them via new endpoints or extend existing ones in backend/server.js.
If they should be included in Excel export, update backend/export.js.
New frontend features
Model global state in frontend/src/store.ts if cross‑cutting.
Expose backend endpoints in frontend/src/api.ts.
Use React Query for data fetching with clear queryKeys.
Build new views in frontend/src/components and connect through MainBar or new tabs.
New reports
Add a ReportId and metadata in frontend/src/reports/config.ts.
Implement a card component in ReportsView and map the ID to the new renderer.
This documentation is intended as a compact overview of how MOPAY is structured and how its main functions are implemented.





######################################################3


MOPAY – Architecture & Technical Overview
1. High‑Level Overview
MOPAY is a self‑hosted personal finance and home payments app focused on:

Tracking yearly income and expense lines month by month
Managing multiple years in a single database
Defining savings goals and tracking progress toward them
Providing lightweight analytics reports (balances, leaders, stability)
Protecting access with a PIN guard
Running as a PWA with a modern, responsive UI
The app is split into:

Backend: Node.js + Express + SQLite (via better-sqlite3) + Excel export
Frontend: React + TypeScript + Vite + Tailwind CSS, with React Query and Zustand
2. Tech Stack
Backend
Node.js (ESM)
Express
better-sqlite3 for SQLite access
ExcelJS for XLSX export
Frontend
React + TypeScript
Vite bundler
Tailwind CSS (custom design system in CSS)
React Query (@tanstack/react-query) for data fetching + caching
Zustand for global app state
@dnd-kit for drag‑and‑drop row ordering
framer-motion for animations
Deployment
Docker & docker‑compose
Single container exposing port 8010
3. Repository Structure
backend/
  db.js           # SQLite initialization and schema loading
  export.js       # Export selected years into styled XLSX workbook
  schema.sql      # Database schema
  server.js       # Express server and REST API

frontend/
  index.html      # Vite entry HTML
  src/
    api.ts        # Typed API client (fetch wrapper)
    App.tsx       # Root React application component
    main.tsx      # React entry + React Query/Zustand providers
    store.ts      # Global state with Zustand
    components/   # UI components, views and modals
    reports/      # Report definitions and IDs
    utils/        # Currency + month utilities
    styles/       # Global CSS / themes
4. Backend
4.1 Database Initialization (backend/db.js, backend/schema.sql)
Resolves DB location from DB_FILE env (default ./mopay.sqlite).
Opens a better-sqlite3 connection, enabling:
journal_mode = WAL
foreign_keys = ON
Loads and executes schema.sql at startup. Schema:
Tables:

years
id (PK), year (unique integer, e.g. 2024)
entries
id (PK)
type ('income' | 'expense')
name (entry label)
year_id (FK → years.id)
comment (optional)
Jan … "Dec" (REAL, monthly amounts)
sort_index (ordering within year + type)
savings_goals
id (PK)
year_id (FK → years.id)
name
target_value (optional numeric target)
sort_index
created_at
savings_items
id (PK)
goal_id (FK → savings_goals.id, ON DELETE CASCADE)
name (optional)
value (numeric)
sort_index
Indexes exist on (year_id, type) and savings foreign keys for performance.

4.2 Express Server (backend/server.js)
Configuration:

PORT (default 8010)
APP_PIN: if empty, PIN verification always succeeds; if set, used to protect the UI.
Common helpers:

clampText(value, max) – trims and limits text to a given length.
getYearRow(year) – validates a numeric year and returns corresponding row from years.
Middleware:

cors({ origin: true, credentials: true })
express.json()
morgan('dev') logging
Static UI:

express.static for backend/public
Catch‑all GET * serving public/index.html for the SPA.
4.3 API Endpoints
All APIs return JSON unless stated otherwise.

Health & PIN
GET /health
Returns { status: 'ok' } for health checks.
POST /api/pin/verify
Input: { pin: string }
Behavior:
If APP_PIN is empty → { ok: true }
If APP_PIN set → checks 4–8 digit PIN; returns 401 on mismatch.
Years
GET /api/years
Returns { years: number[] } sorted ascending.
GET /api/years/exists
Returns { hasAny: boolean }.
POST /api/years
Input: { year: number } (4 digits).
Inserts a new year; 409 on duplicate.
DELETE /api/years
Input: { years: number[] }.
Deletes selected years and all associated data:
entries for those years
savings_goals and savings_items for those years
Entries (Incomes & Expenses)
GET /api/entries?type=income|expense&year=YYYY
Looks up year_id and returns:
{ entries: [{ id, name, comment, sort_index, Jan, ..., Decm }] }
Uses alias "Dec" AS Decm for the December column.
POST /api/entries
Input: { type: 'income' | 'expense', year: number, name: string }
Adds entry with sort_index = max + 1 within that year+type.
PATCH /api/entries/:id
Input: any subset of:
name, comment, sort_index, Jan..Dec
Updates selected columns; fails with 400 if nothing provided.
DELETE /api/entries
Input: { ids: number[] }
Bulk delete by id.
POST /api/entries/reorder
Input: { orderedIds: number[] }
Reassigns sort_index in the given order using a transaction.
Savings
GET /api/savings?year=YYYY
Returns goals for the year or [] if year not found.
Response format:
{
  goals: Array<{
    id: number;
    name: string;
    targetValue: number | null;
    sortIndex: number;
    items: Array<{
      id: number;
      goalId: number;
      name: string;
      value: number;
      sortIndex: number;
    }>;
  }>;
}
POST /api/savings
Input: { year: number, name: string, targetValue: number | null }
Validates year, clamps goal name, and inserts with sort_index = max + 1.
PATCH /api/savings/:goalId
Input: any subset of { name?: string, targetValue?: number | null }
Validates target as number or null; requires at least one field.
DELETE /api/savings/:goalId
Deletes goal; savings_items are removed via FK cascade.
POST /api/savings/:goalId/items
Input body: optional { name, value } (defaults empty name / 0).
Inserts item with next sort_index under the goal.
PATCH /api/savings/items/:itemId
Input: { name?, value? } (value must be numeric).
DELETE /api/savings/items/:itemId
Deletes an individual item.
Export
POST /api/export
Input: { years: number[] }.
Uses exportYearsToWorkbook to build an in‑memory XLSX workbook.
Response:
Content type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="mopay_export.xlsx"
4.4 Excel Export Implementation (backend/export.js)
Uses ExcelJS + a custom color palette and borders.
For each requested year:
Creates a worksheet named with that year.
Row 1: big title “Mopay Export {year}”.
Renders sections in order:
Incomes table (all income entries, monthly columns + sum/avg/comment)
Expenses table (same structure)
Savings section:
Renders each goal as a mini‑table with:
Title row
Target row
Item rows
Total row
Goals are laid out in a grid (TABLES_PER_ROW per row).
Currency formatting via #,##0.00 and explicit numeric formats.
5. Frontend
5.1 Global State (frontend/src/store.ts)
Zustand store holds core application state:

Core fields:
tab: 'expenses' | 'incomes' | 'savings' | 'reports'
year: number | null – active year
theme: 'light' | 'dark'
editMode: null | 'name' | 'order' | 'remove'
pinSession: boolean – whether PIN has been verified
Selection state:
removeSelection: Set<number> – entries selected for bulk removal
selectedReports: ReportId[] – active reports in the Reports view
Modal state:
modals.add, modals.comment, modals.yearOps, modals.export,
modals.settings, modals.initiateYear
goalModal: { open: boolean; goalId: number | null }
Actions:
setTab, setYear, setTheme, setEditMode, setPinSession
toggleRemoveId, clearRemove
toggleReport, clearReports
openModal, closeModal, setComment
openGoalModal, closeGoalModal
Some values are persisted in localStorage: tab, year, theme, selectedReports.
5.2 API Client (frontend/src/api.ts)
api(path, init?):
Wraps fetch against VITE_API_BASE (if set).
Always sends Content-Type: application/json by default.
If response is JSON, returns parsed JSON; otherwise returns the Response.
Api collection:
verifyPin(pin)
years.list(), .exists(), .add(year), .remove(years)
entries.list(type, year), .add(...), .patch(id, payload), .remove(ids), .reorder(orderedIds)
savings.list(year), .addGoal(...), .updateGoal(id, payload), .removeGoal(id),
.addItem(goalId), .updateItem(itemId, payload), .removeItem(itemId)
exportYears(years) – calls /api/export and triggers XLSX download in the browser.
All screen components use Api via React Query hooks for data fetching/invalidation.

5.3 Root Application (frontend/src/App.tsx)
Imports global CSS and wires the main layout:
Sticky header with “glass” effect based on scroll position.
Applies theme via document.documentElement.dataset.theme and a short “theme-changing” class for smooth transitions.
Renders:
<PinGuard /> – PIN overlay
<MainBar /> – navigation, actions and year selection
Tab content:
TableView for expenses/incomes
SavingsView for goals
ReportsView for analytics
Modals: InitiateYearModal, AddEntryModal, CommentModal, YearOperationsModal,
ExportModal, SettingsModal, SavingsGoalModal
AddToHomeScreen – PWA install hint (mobile add‑to‑home‑screen).
5.4 Main UI Components
5.4.1 MainBar (frontend/src/components/MainBar.tsx)
Top navigation bar responsible for:
Tab switching (Expenses/Incomes/Savings/Reports)
Year selection via YearDropdown (data from /api/years)
Theme toggle
Session lock (clears PIN session)
Dropdown “Menu” with:
“Year operations” → YearOperationsModal
“Export data” → ExportModal
“Settings” → SettingsModal
Primary action area depends on current tab:
Expenses/Incomes:
Default: “Add entry” and “Edit entries” dropdown (change name/order/remove).
In edit mode: “Remove selected” or “Exit mode”.
Savings:
“Add goal” button (opens SavingsGoalModal).
Reports:
Report toggles based on REPORT_DEFINITIONS.
5.4.2 TableView (Entries) (frontend/src/components/TableView.tsx)
Central table for income/expense entries:
Columns: comment icon, name, 12 months, Sum, Avg.
Key features:
Uses React Query (useEntries) to fetch entries by type + year.
Inline editing:
Click name to edit (in name edit mode).
Click monthly amount to edit it (with currency input parsing).
Drag‑and‑drop (@dnd-kit):
“Change order” mode allows reordering rows.
Persisted via /api/entries/reorder.
Bulk remove:
“Remove entries” mode uses checkboxes + global removeSelection.
Removal triggered via a custom bulk:remove event and /api/entries DELETE.
Includes local animation before deleting.
Totals:
Computes per‑month sums, total sum and average, rendered in a “Total” row.
5.4.3 SavingsView (frontend/src/components/SavingsView.tsx)
Shows savings goals for the selected year:
If no year → “Select a year” placeholder.
If loading → loading state.
If no goals → informational message + “Add goal” button.
For each goal renders a GoalCard:
Header with goal name, Edit and Remove actions.
Optional progress bar if targetValue set: current / target and %.
GoalItemsTable:
Editable rows for items (name + value), in place.
Empty row content deletes the item on blur.
“+ Add item” button.
Displays total goal value.
All updates (add/remove/update item, remove goal) invalidate the ['savings', year] query.

5.4.4 ReportsView (frontend/src/components/ReportsView.tsx)
Fetches both income and expense entries for the active year.

Renders cards for each report selected in selectedReports.

Report definitions (frontend/src/reports/config.ts):

monthly-balance (“Income vs expenses”)
Shows total income, total expense, net, best/worst month.
Renders per‑month balance bars.
spending-leaders (“Top expenses”)
Top 5 expense entries by annual total and their share.
income-stability (“Income stability”)
Displays streams sorted by coefficient of variation (std dev / mean).
expense-stability (“Expense stability”)
Same metric focused on expenses, highlights volatile categories.
No server‑side analytics; all computed in the browser from fetched entries.

5.4.5 PinGuard (frontend/src/components/PinGuard.tsx)
Full‑screen overlay that blocks the UI until PIN is verified.
Behavior:
On mount:
Checks sessionStorage["pin-ok"]; if "1", unblocks immediately.
On submit:
Sends { pin } to /api/pin/verify.
On success: marks pinSession in store and caches "pin-ok" = "1" in sessionStorage.
On failure: clears input, shows transient “Wrong PIN” feedback.
MainBar “lock” action clears this session and returns to PIN screen.
5.5 Modals (Overview)
All modals use a shared ModalBase and are controlled from Zustand:

InitiateYearModal
Shown automatically if there are no years.
Asks user for initial year (e.g. 2024), calls Api.years.add, sets active year.
AddEntryModal
Adds a new income/expense entry to the current year.
Invalidates the corresponding entries query.
CommentModal
Allows editing comment attached to a single entry.
YearOperationsModal
Add year: numeric field + add button, prevents duplicates, auto‑selects new year.
Cleanup: checkbox list of years to delete; handles active year fallback.
ExportModal
Year selection for data export.
Calls Api.exportYears to download XLSX.
SettingsModal
General configuration UI (e.g., theme, maybe more as project evolves).
SavingsGoalModal
Form for creating or editing a savings goal (name + optional target).
5.6 Utility Modules
utils/currency.ts
pln(n) – formats number as PLN using Intl.NumberFormat.
formatCurrency(value) – local UI format 1 234,56 style.
parseCurrencyInput(input) – parses flexible string input into number.
utils/months.ts
MONTHS constant array and MonthKey type alias.
6. Data Flow Summary
User selects a year / tab in UI
Zustand updates year / tab, persisted to localStorage.
React Query fetches data
Components call Api.*, which wraps REST calls.
Queries cached and invalidated after mutations.
Express serves data from SQLite
Each API route interacts with better-sqlite3 using prepared statements.
Business logic is simple and mostly 1:1 with UI needs.
User edits data
Frontend applies optimistic or near‑optimistic updates (e.g. reordering, animation).
Backend persists changes.
Export
UI sends selected years to /api/export.
Backend builds Excel workbook using DB data and returns a downloadable XLSX.
7. Configuration & Environment
Important environment variables:

PORT – HTTP port (default 8010 inside container).
DB_FILE – path to SQLite file (e.g. /data/mopay.sqlite in Docker).
APP_PIN – 4–8 digit PIN. If empty, PIN guard is effectively disabled.
NODE_ENV – production for optimized build.
8. Extending the Project (Guidelines)
New backend features
Add DB columns/tables in backend/schema.sql.
Expose them via new endpoints or extend existing ones in backend/server.js.
If they should be included in Excel export, update backend/export.js.
New frontend features
Model global state in frontend/src/store.ts if cross‑cutting.
Expose backend endpoints in frontend/src/api.ts.
Use React Query for data fetching with clear queryKeys.
Build new views in frontend/src/components and connect through MainBar or new tabs.
New reports
Add a ReportId and metadata in frontend/src/reports/config.ts.
Implement a card component in ReportsView and map the ID to the new renderer.
This documentation is intended as a compact overview of how MOPAY is structured and how its main functions are implemented. You can copy it into your repository (for example as docs/ARCHITECTURE.md) and adjust or expand sections over time as the project evolves.

wyegeneruj z tego gotowy plik ARCHITECTURE.md do pobrania


# MOPAY – Architecture & Technical Overview

## 1. High‑Level Overview

MOPAY is a self‑hosted personal finance and home payments app focused on:

- Tracking yearly **income** and **expense** lines month by month
- Managing **multiple years** in a single database
- Defining **savings goals** and tracking progress toward them
- Providing lightweight **analytics reports** (balances, leaders, stability)
- Protecting access with a **PIN guard**
- Running as a **PWA** with a modern, responsive UI

The app is split into:

- **Backend**: Node.js + Express + SQLite (via `better-sqlite3`) + Excel export
- **Frontend**: React + TypeScript + Vite + Tailwind CSS, with React Query and Zustand

---

## 2. Tech Stack

- **Backend**
  - Node.js (ESM)
  - Express
  - `better-sqlite3` for SQLite access
  - `ExcelJS` for XLSX export
- **Frontend**
  - React + TypeScript
  - Vite bundler
  - Tailwind CSS (custom design system in CSS)
  - React Query (`@tanstack/react-query`) for data fetching + caching
  - Zustand for global app state
  - `@dnd-kit` for drag‑and‑drop row ordering
  - `framer-motion` for animations
- **Deployment**
  - Docker & docker‑compose
  - Single container exposing port `8010`

---

## 3. Repository Structure

```text
backend/
  db.js           # SQLite initialization and schema loading
  export.js       # Export selected years into styled XLSX workbook
  schema.sql      # Database schema
  server.js       # Express server and REST API

frontend/
  index.html      # Vite entry HTML
  src/
    api.ts        # Typed API client (fetch wrapper)
    App.tsx       # Root React application component
    main.tsx      # React entry + React Query/Zustand providers
    store.ts      # Global state with Zustand
    components/   # UI components, views and modals
    reports/      # Report definitions and IDs
    utils/        # Currency + month utilities
    styles/       # Global CSS / themes
4. Backend
4.1 Database Initialization (backend/db.js, backend/schema.sql)
Resolves DB location from DB_FILE env (default ./mopay.sqlite).
Opens a better-sqlite3 connection, enabling:
journal_mode = WAL
foreign_keys = ON
Loads and executes schema.sql at startup.
Schema tables:

years
id (PK), year (unique integer, e.g. 2024)
entries
id (PK)
type ('income' | 'expense')
name (entry label)
year_id (FK → years.id)
comment (optional)
Jan … "Dec" (REAL, monthly amounts)
sort_index (ordering within year + type)
savings_goals
id (PK)
year_id (FK → years.id)
name
target_value (optional numeric target)
sort_index
created_at
savings_items
id (PK)
goal_id (FK → savings_goals.id, ON DELETE CASCADE)
name (optional)
value (numeric)
sort_index
Indexes exist on (year_id, type) and savings foreign keys for performance.

4.2 Express Server (backend/server.js)
Configuration:

PORT (default 8010)
APP_PIN: if empty, PIN verification always succeeds; if set, used to protect the UI.
Helpers:

clampText(value, max) – trims and limits text to a given length.
getYearRow(year) – validates a numeric year and returns the corresponding row from years.
Middleware:

cors({ origin: true, credentials: true })
express.json()
morgan('dev') logging
Static UI:

express.static for backend/public
Catch‑all GET * serving public/index.html for the SPA.
4.3 API Endpoints
All APIs return JSON unless stated otherwise.

Health & PIN
GET /health
Returns { status: 'ok' } for health checks.

POST /api/pin/verify
Input: { pin: string }
Behavior:

If APP_PIN is empty → { ok: true }
If APP_PIN set → checks 4–8 digit PIN; returns 401 on mismatch.
Years
GET /api/years
Returns { years: number[] } sorted ascending.

GET /api/years/exists
Returns { hasAny: boolean }.

POST /api/years
Input: { year: number } (4 digits).
Inserts a new year; 409 on duplicate.

DELETE /api/years
Input: { years: number[] }.
Deletes selected years and all associated data:

entries for those years
savings_goals and savings_items for those years
Entries (Incomes & Expenses)
GET /api/entries?type=income|expense&year=YYYY
Looks up year_id and returns:

{ entries: [{ id, name, comment, sort_index, Jan, ..., Decm }] }
("Dec" AS Decm is used for December column.)
POST /api/entries
Input: { type: 'income' | 'expense', year: number, name: string }
Adds entry with sort_index = max + 1 within that year+type.

PATCH /api/entries/:id
Input: any subset of:

name, comment, sort_index, Jan..Dec
Updates selected columns; 400 if nothing provided.
DELETE /api/entries
Input: { ids: number[] }
Bulk delete by id.

POST /api/entries/reorder
Input: { orderedIds: number[] }
Reassigns sort_index in the given order using a transaction.

Savings
GET /api/savings?year=YYYY
Returns goals for the year or [] if year not found.

Response format:

{
  goals: Array<{
    id: number;
    name: string;
    targetValue: number | null;
    sortIndex: number;
    items: Array<{
      id: number;
      goalId: number;
      name: string;
      value: number;
      sortIndex: number;
    }>;
  }>;
}
POST /api/savings
Input: { year: number, name: string, targetValue: number | null }
Validates year, clamps goal name, and inserts with sort_index = max + 1.

PATCH /api/savings/:goalId
Input: any subset of { name?: string, targetValue?: number | null }
Validates target as number or null; requires at least one field.

DELETE /api/savings/:goalId
Deletes goal; savings_items are removed via FK cascade.

POST /api/savings/:goalId/items
Input body: optional { name, value } (defaults empty name / 0).
Inserts item with next sort_index under the goal.

PATCH /api/savings/items/:itemId
Input: { name?, value? } (value must be numeric).

DELETE /api/savings/items/:itemId
Deletes an individual item.

Export
POST /api/export
Input: { years: number[] }.
Uses exportYearsToWorkbook to build an in‑memory XLSX workbook.

Response:

Content type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="mopay_export.xlsx"
4.4 Excel Export (backend/export.js)
Uses ExcelJS + a custom color palette and borders.
For each requested year:
Creates a worksheet named with that year.
Row 1: big title “Mopay Export {year}”.
Renders sections in order:
Incomes table (all income entries, monthly columns + sum/avg/comment)
Expenses table (same structure)
Savings section:
Renders each goal as a mini‑table with:
Title row
Target row
Item rows
Total row
Goals are laid out in a grid (TABLES_PER_ROW per row).
Currency formatting via #,##0.00 and explicit numeric formats.
5. Frontend
5.1 Global State (frontend/src/store.ts)
Zustand store holds core application state:

Core fields:
tab: 'expenses' | 'incomes' | 'savings' | 'reports'
year: number | null – active year
theme: 'light' | 'dark'
editMode: null | 'name' | 'order' | 'remove'
pinSession: boolean – whether PIN has been verified
Selection state:
removeSelection: Set<number> – entries selected for bulk removal
selectedReports: ReportId[] – active reports in the Reports view
Modal state:
modals.add, modals.comment, modals.yearOps, modals.export,
modals.settings, modals.initiateYear
goalModal: { open: boolean; goalId: number | null }
Actions:
setTab, setYear, setTheme, setEditMode, setPinSession
toggleRemoveId, clearRemove
toggleReport, clearReports
openModal, closeModal, setComment
openGoalModal, closeGoalModal
Some values are persisted in localStorage: tab, year, theme, selectedReports.
5.2 API Client (frontend/src/api.ts)
api(path, init?):

Wraps fetch against VITE_API_BASE (if set).
Always sends Content-Type: application/json by default.
If response is JSON, returns parsed JSON; otherwise returns the Response.
Api collection:

verifyPin(pin)
years.list(), .exists(), .add(year), .remove(years)
entries.list(type, year), .add(...), .patch(id, payload), .remove(ids), .reorder(orderedIds)
savings.list(year), .addGoal(...), .updateGoal(id, payload), .removeGoal(id),
.addItem(goalId), .updateItem(itemId, payload), .removeItem(itemId)
exportYears(years) – calls /api/export and triggers XLSX download in the browser.
All screen components use Api via React Query hooks for data fetching/invalidation.

5.3 Root Application (frontend/src/App.tsx)
Imports global CSS and wires the main layout:
Sticky header with “glass” effect based on scroll position.
Applies theme via document.documentElement.dataset.theme and a short “theme-changing” class for smooth transitions.
Renders:
<PinGuard /> – PIN overlay
<MainBar /> – navigation, actions and year selection
Tab content:
TableView for expenses/incomes
SavingsView for goals
ReportsView for analytics
Modals:
InitiateYearModal
AddEntryModal
CommentModal
YearOperationsModal
ExportModal
SettingsModal
SavingsGoalModal
AddToHomeScreen – PWA install hint (mobile add‑to‑home‑screen).
5.4 Main UI Components
5.4.1 MainBar (frontend/src/components/MainBar.tsx)
Top navigation bar responsible for:

Tab switching (Expenses/Incomes/Savings/Reports)
Year selection via YearDropdown (data from /api/years)
Theme toggle
Session lock (clears PIN session)
Dropdown “Menu” with:
“Year operations” → YearOperationsModal
“Export data” → ExportModal
“Settings” → SettingsModal
Primary action area depends on current tab:

Expenses/Incomes
Default: “Add entry” and “Edit entries” dropdown (change name/order/remove).
In edit mode: “Remove selected” or “Exit mode”.
Savings
“Add goal” button (opens SavingsGoalModal).
Reports
Report toggles based on REPORT_DEFINITIONS.
5.4.2 TableView (Entries) (frontend/src/components/TableView.tsx)
Central table for income/expense entries:

Columns: comment icon, name, 12 months, Sum, Avg.
Key features:

Uses React Query (useEntries) to fetch entries by type + year.
Inline editing:
Click name to edit (in name edit mode).
Click monthly amount to edit it (with currency input parsing).
Drag‑and‑drop (@dnd-kit):
“Change order” mode allows reordering rows.
Persisted via /api/entries/reorder.
Bulk remove:
“Remove entries” mode uses checkboxes + global removeSelection.
Removal triggered via a custom bulk:remove event and /api/entries DELETE.
Includes local animation before deleting.
Totals:
Computes per‑month sums, total sum and average, rendered in a “Total” row.
5.4.3 SavingsView (frontend/src/components/SavingsView.tsx)
Shows savings goals for the selected year:

If no year → “Select a year” placeholder.
If loading → loading state.
If no goals → informational message + “Add goal” button.
For each goal renders a GoalCard:

Header with goal name, Edit and Remove actions.
Optional progress bar if targetValue set: current / target and %.
GoalItemsTable:
Editable rows for items (name + value), in place.
Empty row content deletes the item on blur.
“+ Add item” button.
Displays total goal value.
All updates (add/remove/update item, remove goal) invalidate the ['savings', year] query.

5.4.4 ReportsView (frontend/src/components/ReportsView.tsx)
Fetches both income and expense entries for the active year.

Renders cards for each report selected in selectedReports.

Report definitions (frontend/src/reports/config.ts):

monthly-balance (“Income vs expenses”)
Shows total income, total expense, net, best/worst month.
Renders per‑month balance bars.
spending-leaders (“Top expenses`)
Top 5 expense entries by annual total and their share.
income-stability (“Income stability”)
Displays streams sorted by coefficient of variation (std dev / mean).
expense-stability (“Expense stability”)
Same metric focused on expenses, highlights volatile categories.
All report analytics are computed client‑side from fetched entries.

5.4.5 PinGuard (frontend/src/components/PinGuard.tsx)
Full‑screen overlay that blocks the UI until PIN is verified.
Behavior:

On mount:
Checks sessionStorage["pin-ok"]; if "1", unblocks immediately.
On submit:
Sends { pin } to /api/pin/verify.
On success: marks pinSession in store and caches "pin-ok" = "1" in sessionStorage.
On failure: clears input, shows transient “Wrong PIN” feedback.
MainBar “lock” action clears this session and returns to PIN screen.
5.5 Modals (Overview)
All modals use a shared ModalBase and are controlled from Zustand:

InitiateYearModal
Shown automatically if there are no years.
Asks user for initial year (e.g. 2024), calls Api.years.add, sets active year.
AddEntryModal
Adds a new income/expense entry to the current year.
Invalidates the corresponding entries query.
CommentModal
Allows editing comment attached to a single entry.
YearOperationsModal
Add year: numeric field + add button, prevents duplicates, auto‑selects new year.
Cleanup: checkbox list of years to delete; handles active year fallback.
ExportModal
Year selection for data export.
Calls Api.exportYears to download XLSX.
SettingsModal
General configuration UI (e.g., theme, maybe more as project evolves).
SavingsGoalModal
Form for creating or editing a savings goal (name + optional target).
5.6 Utility Modules
utils/currency.ts
pln(n) – formats number as PLN using Intl.NumberFormat.
formatCurrency(value) – local UI format 1 234,56 style.
parseCurrencyInput(input) – parses flexible string input into number.
utils/months.ts
MONTHS constant array and MonthKey type alias.
6. Data Flow Summary
User selects a year / tab in UI
Zustand updates year / tab, persisted to localStorage.

React Query fetches data
Components call Api.*, which wraps REST calls. Queries are cached and invalidated after mutations.

Express serves data from SQLite
Each API route interacts with better-sqlite3 using prepared statements. Business logic is simple and mostly 1:1 with UI needs.

User edits data
Frontend applies optimistic or near‑optimistic updates (e.g. reordering, animation). Backend persists changes.

Export
UI sends selected years to /api/export. Backend builds an Excel workbook using DB data and returns a downloadable XLSX.

7. Configuration & Environment
Important environment variables:

PORT – HTTP port (default 8010 inside container).
DB_FILE – path to SQLite file (e.g. /data/mopay.sqlite in Docker).
APP_PIN – 4–8 digit PIN. If empty, PIN guard is effectively disabled.
NODE_ENV – production for optimized build.
8. Extending the Project
New backend features

Add DB columns/tables in backend/schema.sql.
Expose them via new endpoints or extend existing ones in backend/server.js.
If they should be included in Excel export, update backend/export.js.
New frontend features

Model global state in frontend/src/store.ts if cross‑cutting.
Expose backend endpoints in frontend/src/api.ts.
Use React Query for data fetching with clear queryKeys.
Build new views in frontend/src/components and connect through MainBar or new tabs.
New reports

Add a ReportId and metadata in frontend/src/reports/config.ts.
Implement a card component in ReportsView and map the ID to the new renderer.
This document provides a compact overview of how MOPAY is structured and how its main functions are implemented. 