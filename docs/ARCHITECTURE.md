# **MOPAY – Architecture & Technical Overview**

## **1\. High‑Level Overview**

MOPAY is a self‑hosted personal finance and home payments app focused on:

-   Tracking yearly **income** and **expense** lines month by month
-   Managing **multiple years** in a single database
-   Defining **savings goals** and tracking progress toward them
-   Providing lightweight **analytics reports** (balances, leaders, stability)
-   Protecting access with a **PIN guard**
-   Running as a **PWA** with a modern, responsive UI

The app is split into:

-   **Backend**: Node.js + Express + SQLite (via better-sqlite3) + Excel export
-   **Frontend**: React + TypeScript + Vite + Tailwind CSS, with React Query and Zustand

---

## **2\. Tech Stack**

-   **Backend**
    
    -   Node.js (ESM)
    -   Express
    -   better-sqlite3 for SQLite access
    -   ExcelJS for XLSX export
-   **Frontend**
    
    -   React + TypeScript
    -   Vite bundler
    -   Tailwind CSS (custom design system in CSS)
    -   React Query (@tanstack/react-query) for data fetching + caching
    -   Zustand for global app state
    -   @dnd-kit for drag‑and‑drop row ordering
    -   framer-motion for animations
-   **Deployment**
    
    -   Docker & docker‑compose
    -   Single container exposing port 8010

---

## **3\. Repository Structure**

`backend/ db.js # SQLite initialization and schema loading export.js # Export selected years into styled XLSX workbook schema.sql # Database schema server.js # Express server and REST API frontend/ index.html # Vite entry HTML src/ api.ts # Typed API client (fetch wrapper) App.tsx # Root React application component main.tsx # React entry + React Query/Zustand providers store.ts # Global state with Zustand components/ # UI components, views and modals reports/ # Report definitions and IDs utils/ # Currency + month utilities styles/ # Global CSS / themes`

---

## **4\. Backend**

### **4.1 Database Initialization (**<span style="color: rgb(77, 170, 252)">**backend/db.js**</span>**,** <span style="color: rgb(77, 170, 252)">**backend/schema.sql**</span>**)**

-   Resolves DB location from DB\_FILE env (default <span style="color: rgb(77, 170, 252)">./mopay.sqlite</span>).
-   Opens a better-sqlite3 connection, enabling:
    
    -   journal\_mode = WAL
    -   foreign\_keys = ON
-   Loads and executes <span style="color: rgb(77, 170, 252)">schema.sql</span> at startup. Schema:

Tables:

-   years
    
    -   id (PK), year (unique integer, e.g. 2024)
-   entries
    
    -   id (PK)
    -   type ('income' | 'expense')
    -   name (entry label)
    -   year\_id (FK → [<span style="color: rgb(77, 170, 252)">years.id</span>](http://years.id))
    -   comment (optional)
    -   Jan … "Dec" (REAL, monthly amounts)
    -   sort\_index (ordering within year + type)
-   savings\_goals
    
    -   id (PK)
    -   year\_id (FK → [<span style="color: rgb(77, 170, 252)">years.id</span>](http://years.id))
    -   name
    -   target\_value (optional numeric target)
    -   sort\_index
    -   created\_at
-   savings\_items
    
    -   id (PK)
    -   goal\_id (FK → <span style="color: rgb(77, 170, 252)">savings\_</span>[<span style="color: rgb(77, 170, 252)">goals.id</span>](http://goals.id), ON DELETE CASCADE)
    -   name (optional)
    -   value (numeric)
    -   sort\_index

Indexes exist on (year\_id, type) and savings foreign keys for performance.

### **4.2 Express Server (**<span style="color: rgb(77, 170, 252)">**backend/server.js**</span>**)**

Configuration:

-   PORT (default 8010)
-   APP\_PIN: if empty, PIN verification always succeeds; if set, used to protect the UI.

Common helpers:

-   clampText(value, max) – trims and limits text to a given length.
-   getYearRow(year) – validates a numeric year and returns corresponding row from years.

Middleware:

-   cors({ origin: true, credentials: true })
-   express.json()
-   morgan('dev') logging

Static UI:

-   express.static for backend/public
-   Catch‑all GET \* serving <span style="color: rgb(77, 170, 252)">public/index.html</span> for the SPA.

### **4.3 API Endpoints**

All APIs return JSON unless stated otherwise.

#### Health & PIN

-   GET /health
    
    -   Returns { status: 'ok' } for health checks.
-   POST /api/pin/verify
    
    -   Input: { pin: string }
    -   Behavior:
        
        -   If APP\_PIN is empty → { ok: true }
        -   If APP\_PIN set → checks 4–8 digit PIN; returns 401 on mismatch.

#### Years

-   GET /api/years
    
    -   Returns { years: number\[\] } sorted ascending.
-   GET /api/years/exists
    
    -   Returns { hasAny: boolean }.
-   POST /api/years
    
    -   Input: { year: number } (4 digits).
    -   Inserts a new year; 409 on duplicate.
-   DELETE /api/years
    
    -   Input: { years: number\[\] }.
    -   Deletes selected years and all associated data:
        
        -   entries for those years
        -   savings\_goals and savings\_items for those years

#### Entries (Incomes & Expenses)

-   GET /api/entries?type=income|expense&year=YYYY
    
    -   Looks up year\_id and returns:
        
        -   { entries: \[{ id, name, comment, sort\_index, Jan, ..., Decm }\] }
    -   Uses alias "Dec" AS Decm for the December column.
-   POST /api/entries
    
    -   Input: { type: 'income' | 'expense', year: number, name: string }
    -   Adds entry with sort\_index = max + 1 within that year+type.
-   PATCH /api/entries/:id
    
    -   Input: any subset of:
        
        -   name, comment, sort\_index, Jan..Dec
    -   Updates selected columns; fails with 400 if nothing provided.
-   DELETE /api/entries
    
    -   Input: { ids: number\[\] }
    -   Bulk delete by id.
-   POST /api/entries/reorder
    
    -   Input: { orderedIds: number\[\] }
    -   Reassigns sort\_index in the given order using a transaction.

#### Savings

-   GET /api/savings?year=YYYY
    
    -   Returns goals for the year or \[\] if year not found.
    -   Response format:
        
        `{ goals: Array<{ id: number; name: string; targetValue: number | null; sortIndex: number; items: Array<{ id: number; goalId: number; name: string; value: number; sortIndex: number; }>; }>; }`
        
-   POST /api/savings
    
    -   Input: { year: number, name: string, targetValue: number | null }
    -   Validates year, clamps goal name, and inserts with sort\_index = max + 1.
-   PATCH /api/savings/:goalId
    
    -   Input: any subset of { name?: string, targetValue?: number | null }
    -   Validates target as number or null; requires at least one field.
-   DELETE /api/savings/:goalId
    
    -   Deletes goal; savings\_items are removed via FK cascade.
-   POST /api/savings/:goalId/items
    
    -   Input body: optional { name, value } (defaults empty name / 0).
    -   Inserts item with next sort\_index under the goal.
-   PATCH /api/savings/items/:itemId
    
    -   Input: { name?, value? } (value must be numeric).
-   DELETE /api/savings/items/:itemId
    
    -   Deletes an individual item.

#### Export

-   POST /api/export
    
    -   Input: { years: number\[\] }.
    -   Uses exportYearsToWorkbook to build an in‑memory XLSX workbook.
    -   Response:
        
        -   Content type: <span style="color: rgb(77, 170, 252)">application/vnd.openxmlformats-officedocument.spreadsheetml.sheet</span>
        -   Content-Disposition: attachment; filename="mopay\_export.xlsx"

### **4.4 Excel Export Implementation (**<span style="color: rgb(77, 170, 252)">**backend/export.js**</span>**)**

-   Uses ExcelJS + a custom color palette and borders.
-   For each requested year:
    
    -   Creates a worksheet named with that year.
    -   Row 1: big title “Mopay Export {year}”.
    -   Renders sections in order:
        
        1.  Incomes table (all income entries, monthly columns + sum/avg/comment)
        2.  Expenses table (same structure)
        3.  Savings section:
            
            -   Renders each goal as a mini‑table with:
                
                -   Title row
                -   Target row
                -   Item rows
                -   Total row
            -   Goals are laid out in a grid (TABLES\_PER\_ROW per row).
-   Currency formatting via #,##0.00 and explicit numeric formats.

---

## **5\. Frontend**

### **5.1 Global State (**<span style="color: rgb(77, 170, 252)">**frontend/src/store.ts**</span>**)**

Zustand store holds core application state:

-   Core fields:
    
    -   tab: 'expenses' | 'incomes' | 'savings' | 'reports'
    -   year: number | null – active year
    -   theme: 'light' | 'dark'
    -   editMode: null | 'name' | 'order' | 'remove'
    -   pinSession: boolean – whether PIN has been verified
-   Selection state:
    
    -   removeSelection: Set<number> – entries selected for bulk removal
    -   selectedReports: ReportId\[\] – active reports in the Reports view
-   Modal state:
    
    -   <span style="color: rgb(77, 170, 252)">modals.add</span>, modals.comment, modals.yearOps, modals.export,  
        modals.settings, modals.initiateYear
    -   goalModal: { open: boolean; goalId: number | null }
-   Actions:
    
    -   setTab, setYear, setTheme, setEditMode, setPinSession
    -   toggleRemoveId, clearRemove
    -   toggleReport, clearReports
    -   openModal, closeModal, setComment
    -   openGoalModal, closeGoalModal
-   Some values are persisted in localStorage: tab, year, theme, selectedReports.

### **5.2 API Client (**<span style="color: rgb(77, 170, 252)">**frontend/src/api.ts**</span>**)**

-   api(path, init?):
    
    -   Wraps fetch against VITE\_API\_BASE (if set).
    -   Always sends Content-Type: application/json by default.
    -   If response is JSON, returns parsed JSON; otherwise returns the Response.
-   Api collection:
    
    -   verifyPin(pin)
    -   years.list(), .exists(), .add(year), .remove(years)
    -   entries.list(type, year), <span style="color: rgb(77, 170, 252)">.add(...)</span>, .patch(id, payload), .remove(ids), .reorder(orderedIds)
    -   savings.list(year), <span style="color: rgb(77, 170, 252)">.addGoal(...)</span>, .updateGoal(id, payload), .removeGoal(id),  
        .addItem(goalId), .updateItem(itemId, payload), .removeItem(itemId)
    -   exportYears(years) – calls /api/export and triggers XLSX download in the browser.

All screen components use Api via React Query hooks for data fetching/invalidation.

### **5.3 Root Application (**<span style="color: rgb(77, 170, 252)">**frontend/src/App.tsx**</span>**)**

-   Imports global CSS and wires the main layout:
    
    -   Sticky header with “glass” effect based on scroll position.
    -   Applies theme via document.documentElement.dataset.theme and a short “theme-changing” class for smooth transitions.
-   Renders:
    
    -   <PinGuard /> – PIN overlay
    -   <MainBar /> – navigation, actions and year selection
    -   Tab content:
        
        -   TableView for expenses/incomes
        -   SavingsView for goals
        -   ReportsView for analytics
    -   Modals: InitiateYearModal, AddEntryModal, CommentModal, YearOperationsModal,  
        ExportModal, SettingsModal, SavingsGoalModal
    -   AddToHomeScreen – PWA install hint (mobile add‑to‑home‑screen).

### **5.4 Main UI Components**

#### 5.4.1 MainBar (<span style="color: rgb(77, 170, 252)">frontend/src/components/MainBar.tsx</span>)

-   Top navigation bar responsible for:
    
    -   Tab switching (Expenses/Incomes/Savings/Reports)
    -   Year selection via YearDropdown (data from /api/years)
    -   Theme toggle
    -   Session lock (clears PIN session)
    -   Dropdown “Menu” with:
        
        -   “Year operations” → YearOperationsModal
        -   “Export data” → ExportModal
        -   “Settings” → SettingsModal
-   Primary action area depends on current tab:
    
    -   Expenses/Incomes:
        
        -   Default: “Add entry” and “Edit entries” dropdown (change name/order/remove).
        -   In edit mode: “Remove selected” or “Exit mode”.
    -   Savings:
        
        -   “Add goal” button (opens SavingsGoalModal).
    -   Reports:
        
        -   Report toggles based on REPORT\_DEFINITIONS.

#### 5.4.2 TableView (Entries) (<span style="color: rgb(77, 170, 252)">frontend/src/components/TableView.tsx</span>)

-   Central table for income/expense entries:
    
    -   Columns: comment icon, name, 12 months, Sum, Avg.
-   Key features:
    
    -   Uses React Query (useEntries) to fetch entries by type + year.
    -   Inline editing:
        
        -   Click name to edit (in name edit mode).
        -   Click monthly amount to edit it (with currency input parsing).
    -   Drag‑and‑drop (@dnd-kit):
        
        -   “Change order” mode allows reordering rows.
        -   Persisted via /api/entries/reorder.
    -   Bulk remove:
        
        -   “Remove entries” mode uses checkboxes + global removeSelection.
        -   Removal triggered via a custom bulk:remove event and /api/entries DELETE.
        -   Includes local animation before deleting.
    -   Totals:
        
        -   Computes per‑month sums, total sum and average, rendered in a “Total” row.

#### 5.4.3 SavingsView (<span style="color: rgb(77, 170, 252)">frontend/src/components/SavingsView.tsx</span>)

-   Shows savings goals for the selected year:
    
    -   If no year → “Select a year” placeholder.
    -   If loading → loading state.
    -   If no goals → informational message + “Add goal” button.
-   For each goal renders a GoalCard:
    
    -   Header with goal name, Edit and Remove actions.
    -   Optional progress bar if targetValue set: current / target and %.
    -   GoalItemsTable:
        
        -   Editable rows for items (name + value), in place.
        -   Empty row content deletes the item on blur.
        -   “+ Add item” button.
        -   Displays total goal value.

All updates (add/remove/update item, remove goal) invalidate the \['savings', year\] query.

#### 5.4.4 ReportsView (<span style="color: rgb(77, 170, 252)">frontend/src/components/ReportsView.tsx</span>)

-   Fetches both income and expense entries for the active year.
-   Renders cards for each report selected in selectedReports.
-   Report definitions (<span style="color: rgb(77, 170, 252)">frontend/src/reports/config.ts</span>):
    
    -   monthly-balance (“Income vs expenses”)
        
        -   Shows total income, total expense, net, best/worst month.
        -   Renders per‑month balance bars.
    -   spending-leaders (“Top expenses”)
        
        -   Top 5 expense entries by annual total and their share.
    -   income-stability (“Income stability”)
        
        -   Displays streams sorted by coefficient of variation (std dev / mean).
    -   expense-stability (“Expense stability”)
        
        -   Same metric focused on expenses, highlights volatile categories.

No server‑side analytics; all computed in the browser from fetched entries.

#### 5.4.5 PinGuard (<span style="color: rgb(77, 170, 252)">frontend/src/components/PinGuard.tsx</span>)

-   Full‑screen overlay that blocks the UI until PIN is verified.
-   Behavior:
    
    -   On mount:
        
        -   Checks sessionStorage\["pin-ok"\]; if "1", unblocks immediately.
    -   On submit:
        
        -   Sends { pin } to /api/pin/verify.
        -   On success: marks pinSession in store and caches "pin-ok" = "1" in sessionStorage.
        -   On failure: clears input, shows transient “Wrong PIN” feedback.
    -   MainBar “lock” action clears this session and returns to PIN screen.

### **5.5 Modals (Overview)**

All modals use a shared ModalBase and are controlled from Zustand:

-   InitiateYearModal
    
    -   Shown automatically if there are no years.
    -   Asks user for initial year (e.g. 2024), calls <span style="color: rgb(77, 170, 252)">Api.years.add</span>, sets active year.
-   AddEntryModal
    
    -   Adds a new income/expense entry to the current year.
    -   Invalidates the corresponding entries query.
-   CommentModal
    
    -   Allows editing comment attached to a single entry.
-   YearOperationsModal
    
    -   Add year: numeric field + add button, prevents duplicates, auto‑selects new year.
    -   Cleanup: checkbox list of years to delete; handles active year fallback.
-   ExportModal
    
    -   Year selection for data export.
    -   Calls Api.exportYears to download XLSX.
-   SettingsModal
    
    -   General configuration UI (e.g., theme, maybe more as project evolves).
-   SavingsGoalModal
    
    -   Form for creating or editing a savings goal (name + optional target).

### **5.6 Utility Modules**

-   <span style="color: rgb(77, 170, 252)">utils/currency.ts</span>
    
    -   pln(n) – formats number as PLN using Intl.NumberFormat.
    -   formatCurrency(value) – local UI format 1 234,56 style.
    -   parseCurrencyInput(input) – parses flexible string input into number.
-   <span style="color: rgb(77, 170, 252)">utils/months.ts</span>
    
    -   MONTHS constant array and MonthKey type alias.

---

## **6\. Data Flow Summary**

1.  **User selects a year / tab in UI**
    
    -   Zustand updates year / tab, persisted to localStorage.
2.  **React Query fetches data**
    
    -   Components call <span style="color: rgb(77, 170, 252)">Api.\*</span>, which wraps REST calls.
    -   Queries cached and invalidated after mutations.
3.  **Express serves data from SQLite**
    
    -   Each API route interacts with better-sqlite3 using prepared statements.
    -   Business logic is simple and mostly 1:1 with UI needs.
4.  **User edits data**
    
    -   Frontend applies optimistic or near‑optimistic updates (e.g. reordering, animation).
    -   Backend persists changes.
5.  **Export**
    
    -   UI sends selected years to /api/export.
    -   Backend builds Excel workbook using DB data and returns a downloadable XLSX.

---

## **7\. Configuration & Environment**

Important environment variables:

-   PORT – HTTP port (default 8010 inside container).
-   DB\_FILE – path to SQLite file (e.g. <span style="color: rgb(77, 170, 252)">/data/mopay.sqlite</span> in Docker).
-   APP\_PIN – 4–8 digit PIN. If empty, PIN guard is effectively disabled.
-   NODE\_ENV – production for optimized build.

---

## **8\. Extending the Project (Guidelines)**

-   **New backend features**
    
    -   Add DB columns/tables in <span style="color: rgb(77, 170, 252)">backend/schema.sql</span>.
    -   Expose them via new endpoints or extend existing ones in <span style="color: rgb(77, 170, 252)">backend/server.js</span>.
    -   If they should be included in Excel export, update <span style="color: rgb(77, 170, 252)">backend/export.js</span>.
-   **New frontend features**
    
    -   Model global state in <span style="color: rgb(77, 170, 252)">frontend/src/store.ts</span> if cross‑cutting.
    -   Expose backend endpoints in <span style="color: rgb(77, 170, 252)">frontend/src/api.ts</span>.
    -   Use React Query for data fetching with clear queryKeys.
    -   Build new views in frontend/src/components and connect through MainBar or new tabs.
-   **New reports**
    
    -   Add a ReportId and metadata in <span style="color: rgb(77, 170, 252)">frontend/src/reports/config.ts</span>.
    -   Implement a card component in ReportsView and map the ID to the new renderer.

---

This documentation is intended as a compact overview of how MOPAY is structured and how its main functions are implemented.