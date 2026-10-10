import type { ReactNode } from 'react';

// Settings → Help: keyboard shortcuts as implemented (search: shell/useShell.ts;
// grid: TableView.tsx and table/GridRows.tsx; inspector: table/Inspector.tsx;
// menus: ui/Menu.tsx and shell/YearSwitch.tsx; dialogs: ui/Dialog.tsx;
// savings items: SavingsView.tsx). Keep this list in step with those handlers.

type Shortcut = { keys: ReactNode; action: string };
type Group = { id: string; title: string; note?: string; items: Shortcut[] };

const Or = () => <span className="prefs-keys-or"> or </span>;

const GROUPS: Group[] = [
  {
    id: 'search',
    title: 'Search',
    note: 'Expenses, Incomes and Savings. Not while another field or a dialog is in use.',
    items: [
      { keys: <><kbd>/</kbd><Or /><kbd>Ctrl</kbd>+<kbd>K</kbd><Or /><kbd>⌘</kbd>+<kbd>K</kbd></>, action: 'Go to search (below 960 px it opens the search field)' },
      { keys: <kbd>Esc</kbd>, action: 'In search: clear it and leave the field' },
    ],
  },
  {
    id: 'grid',
    title: 'Expenses and Incomes table',
    note: 'Screens 960 px and wider. A click selects a month; the inspector opens with a double-click or Shift+Enter, follows further clicks while open, and closes with a click outside the table.',
    items: [
      { keys: <><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></>, action: 'Move between months and entries' },
      { keys: <><kbd>Home</kbd><Or /><kbd>End</kbd></>, action: 'First or last month of the row' },
      { keys: <><kbd>Enter</kbd><Or /><kbd>F2</kbd></>, action: 'Edit the value in place (the current value is selected, typing replaces it)' },
      { keys: <><kbd>0</kbd>–<kbd>9</kbd> <kbd>,</kbd> <kbd>.</kbd> <kbd>-</kbd></>, action: 'Start editing with that character' },
      { keys: <><kbd>Shift</kbd>+<kbd>Enter</kbd><Or />double-click</>, action: 'Open the inspector on the month' },
      { keys: <kbd>Esc</kbd>, action: 'Close the inspector and return to the month' },
    ],
  },
  {
    id: 'value',
    title: 'Editing a value',
    note: 'Use a comma for decimals. A single - clears the month; clearing a value saves 0; a month without a value that is left unchanged stays empty.',
    items: [
      { keys: <kbd>Enter</kbd>, action: 'Save' },
      { keys: <><kbd>Tab</kbd><Or /><kbd>Shift</kbd>+<kbd>Tab</kbd></>, action: 'Save and move to the next or previous month' },
      { keys: <kbd>Esc</kbd>, action: 'Cancel the change' },
    ],
  },
  {
    id: 'inspector',
    title: 'Inspector and bottom sheet',
    items: [
      { keys: <kbd>Enter</kbd>, action: 'Save the value, name, group name or tag note (a comment saves when you leave the field)' },
      { keys: <kbd>Esc</kbd>, action: 'Undo an unsaved change in the field; press again to close' },
    ],
  },
  {
    id: 'arrange',
    title: 'Arrange mode',
    note: 'Move focus to a row handle with Tab first.',
    items: [
      { keys: <><kbd>Space</kbd><Or /><kbd>Enter</kbd></>, action: 'Pick up the row, or drop it' },
      { keys: <><kbd>↑</kbd><kbd>↓</kbd></>, action: 'Move the picked-up row' },
      { keys: <kbd>Esc</kbd>, action: 'Cancel the move' },
    ],
  },
  {
    id: 'menus',
    title: 'Menus, year selector and dialogs',
    items: [
      { keys: <><kbd>↓</kbd><kbd>↑</kbd></>, action: 'Open a menu or the year selector, then move between items' },
      { keys: <><kbd>Home</kbd><Or /><kbd>End</kbd></>, action: 'First or last item' },
      { keys: <kbd>Enter</kbd>, action: 'Choose the item' },
      { keys: <kbd>Esc</kbd>, action: 'Close the menu or dialog (the first-run year and encryption key dialogs stay open)' },
      { keys: <kbd>Tab</kbd>, action: 'In a dialog: move between its controls; focus stays inside until it closes' },
    ],
  },
  {
    id: 'savings',
    title: 'Savings items',
    items: [
      { keys: <kbd>Enter</kbd>, action: 'Save the item being edited' },
      { keys: <kbd>Esc</kbd>, action: 'Stop editing without saving (an empty new item is removed)' },
    ],
  },
  {
    id: 'list',
    title: 'Month list',
    note: 'Below 960 px, with a connected keyboard.',
    items: [
      { keys: <kbd>Tab</kbd>, action: 'Move between entries' },
      { keys: <kbd>Enter</kbd>, action: 'Open the entry in the bottom sheet' },
      { keys: <kbd>Esc</kbd>, action: 'Close the sheet and return to the entry' },
    ],
  },
];

export function KeyboardShortcuts() {
  return (
    <div className="prefs-help">
      {GROUPS.map((group) => (
        <table key={group.id} className="prefs-keys">
          <caption>
            <span className="prefs-row-title">{group.title}</span>
            {group.note && <span className="prefs-row-description">{group.note}</span>}
          </caption>
          <thead className="sr-only">
            <tr><th scope="col">Keys</th><th scope="col">Action</th></tr>
          </thead>
          <tbody>
            {group.items.map((item) => (
              <tr key={item.action}>
                <th scope="row">{item.keys}</th>
                <td>{item.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
