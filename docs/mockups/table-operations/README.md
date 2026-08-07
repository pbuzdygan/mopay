# Expenses & Incomes — operation redesign lab

Open [`table-operations-lab.html`](./table-operations-lab.html) directly in a browser. The file is self-contained and does not call Mopay's backend or change application data.

The lab compares three interaction models using the same finance table:

1. **Context workspace (recommended)** — row and group details open in a side panel, amount and tag metadata share one cell popover, while `Arrange` and `Select` remain short-lived modes.
2. **Inline rail** — actions expand directly below the selected row.
3. **Command bar** — operations are driven from selection and a searchable command palette.

Useful interactions in the recommended prototype:

- `+ New` → add an entry or group;
- click a row name or `…` → edit its name, group and comment in the drawer;
- click a group `…` → group actions in the drawer;
- click a month value → edit the amount, tag colour and note together;
- `Arrange` → reveal drag affordances only while ordering;
- `Select` → reveal checkboxes and a temporary removal bar.

This is an interaction prototype, not a pixel-perfect production implementation. It intentionally keeps the twelve-month table to expose the real horizontal-space constraint.
