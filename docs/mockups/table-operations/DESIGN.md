# Expenses & Incomes operation redesign

## Current behaviour

The production table uses one global `editMode` with five mutually exclusive values: `name`, `group`, `order`, `tag`, and `remove`. Selecting a mode in `MainBar` changes the meaning of the table's narrow leading cell and prevents month-value editing until the user exits the mode.

| Intent | Current interaction | Main friction |
| --- | --- | --- |
| Add an entry | `Add entry` → name-only modal | Group cannot be chosen even though the API already accepts `groupId` |
| Add a group | Separate `Add group` → name-only modal | Two primary actions consume header space |
| Rename | Enter `Change name`, find the row/group, edit, exit | A local one-object change requires global state |
| Move an entry | Enter `Change group`, use a small row control, exit | Control is far from the mode selector and has little room |
| Reorder | Enter `Change order`, drag within the exposed structure, exit | A mode is justified here, but it is mixed with unrelated edit tools |
| Add a tag/note | Enter `Tags`, click a month, edit, exit | Amount and metadata for the same cell live in separate workflows |
| Remove | Enter `Remove entry`, select objects, confirm in header, exit | Bulk selection is useful, but it is presented as a permanent edit category |

The grid is already approximately 1,218 px wide before surrounding spacing. Adding a permanent operations column would increase horizontal scrolling, especially on mobile. Reusing the leading 28 px slot for unrelated emoji makes controls compact but changes their meaning between modes and reduces discoverability.

## Recommendation: object-first context workspace

The recommended design separates frequent data entry from less frequent structure management:

- A single `+ New` menu contains **New entry** and **New group**. The entry form includes a group selector; this needs no backend contract change.
- Clicking an entry name or its `…` opens an entry inspector. It owns **name**, **group**, **comment**, and **remove**.
- Clicking a group's `…` opens group actions: **rename**, **add entry here**, **arrange**, and **remove**.
- Clicking an amount preserves the existing fast inline editor. Tagging is activated from the shared `Actions` menu; while that focused mode is active, clicking a month opens **tag colour** and **note**. Normal cells do not carry an extra icon.
- `Arrange`, `Remove`, and `Tags` are explicit temporary operations selected from one `Actions` menu. Selecting the active operation again finishes it.
- `Remove` shows checkboxes and the removal action only while active; moving remains an item-level operation and tags remain month-level operations.
- Desktop uses a right drawer; narrow screens use the same content as a bottom sheet. The table does not gain a permanent column.

The central rule is: **choose the object first for local changes; choose a mode first only for an operation spanning multiple objects.**

## Alternatives considered

### Inline action rail

Clicking an entry expands a toolbar directly below it. This is discoverable and keeps context close, but the table jumps vertically and several open rows become noisy. It is a reasonable fallback if a drawer feels too detached during user testing.

### Command bar

Users select objects and search for a command. This yields the cleanest table and good keyboard support, but it creates a learning cost that is disproportionate for an occasional, single-user home-lab tool. It could later complement the recommended design as an optional shortcut rather than replace it.

## Proposed production architecture

Keep one shared interaction model for both Expenses and Incomes. Avoid duplicating components by type.

- `NewMenu`: controls entry/group creation and passes an optional preselected group.
- `EntryEditor`: reusable form content rendered in a desktop drawer or mobile sheet.
- `GroupMenu` / `GroupEditor`: contextual group actions and rename flow.
- `TagEditorPopover`: is opened by clicking a month value only while the `Tags` action is active.
- `ArrangeToolbar`: owns only ordering state and drag affordances.
- `SelectionToolbar`: owns selected IDs and bulk actions.
- `TableView`: renders values and contextual triggers; it should no longer interpret five unrelated global edit modes.

The existing endpoints for adding entries, patching names/groups, updating order, tagging, and removal should remain authoritative. The first implementation should not combine requests into a new generic mutation endpoint.

## Safe implementation sequence

### 1. Establish behavioural coverage

- Add focused tests around entry creation, rename, group move, ordering, tags, and removal.
- Record keyboard rules: Enter saves, Escape cancels/closes, focus returns to the invoking control.
- Confirm identical behaviour for Expenses and Incomes through the shared table path.

This phase changes no user-facing workflow.

### 2. Consolidate creation

- Add the `+ New` menu while temporarily keeping the existing modal internals.
- Extend `AddEntryModal` with a group selector and send the already-supported `groupId`.
- Allow `Add entry here` from a group menu to preselect and lock/focus that group as appropriate.
- Remove the two old header buttons only after both menu paths are covered.

This is the smallest independent production slice and an easy rollback point.

### 3. Introduce contextual entry and group editing

- Build the shared drawer/sheet shell with focus trapping and responsive placement.
- Move name, group, and comment editing into `EntryEditor`.
- Add group `…` actions and group rename.
- Keep the legacy `name` and `group` modes behind the existing state until the new paths pass tests, then remove them together.

Do not optimistically close the inspector before an API failure is resolved; keep the user's input and show the error beside the action.

### 4. Merge value and tag editing

- Reuse `TagEditorPopover` logic inside the month-value editor rather than creating a second tag implementation.
- Preserve quick numeric entry and keyboard movement between months.
- Make tag/note fields progressive: visually compact until requested or already populated.
- Remove global `tag` mode after parity checks, including clear-tag behaviour.

This is the highest interaction-risk slice and should be verified separately on mouse, touch, and keyboard.

### 5. Split ordering and bulk selection into focused modes

- Rename `Change order` to `Arrange`; show drag handles and a short instruction banner only while active.
- Initially preserve current ordering constraints and API calls. Cross-group movement remains in the entry inspector, avoiding a coupled backend change.
- Present ordering, removal, and tagging under a shared `Actions` menu; show their controls only while the selected operation is active.
- Preserve group-selection semantics and require a clear confirmation when deleting a group together with entries.

### 6. Remove legacy mode infrastructure

- Delete the unused `name`, `group`, `tag`, and `remove` branches only after the new paths are live and tested.
- Keep ordering and selection as small local UI states instead of a generic global edit enum.
- Remove obsolete hints, emoji indicators, CSS, and modal wiring.
- Update the `1.6.0` changelog section when implementation begins; this design-only prototype does not alter the changelog.

## Acceptance criteria

- A new entry can be named and assigned to a group in one submission.
- Rename, move-group, comment, and remove are reachable from the entry itself without entering a global mode.
- Amount editing is never disabled merely because another entry's details are open.
- Amount, tag, and note for one month can be reviewed from one place.
- Reordering and bulk selection clearly indicate their temporary state and have an obvious exit.
- The table gains no permanent operations column and remains usable at the current minimum viewport.
- Every operation is keyboard reachable, has a visible focus state, and returns focus after overlays close.
- Existing API payloads, encrypted value handling, reports, imports, and exports remain unchanged.
- Expenses and Incomes use the same components and pass the same interaction tests.

## Verification strategy

- Component tests for menus, drawer/sheet forms, popover save/cancel, selection, and focus restoration.
- Integration tests for each existing API mutation, including failed requests and retry without lost input.
- Desktop checks at wide and horizontally constrained widths.
- Touch checks for the bottom sheet, month-cell targets, and scroll-versus-tap behaviour.
- Regression checks for amount keyboard entry, group collapse, totals, current-month highlight, tags, comments, and ordering.

The implementation should be delivered in small slices rather than replacing `TableView` in one rewrite. Each slice can retain the old path briefly, which reduces regression risk and keeps the production table operational throughout the migration.
