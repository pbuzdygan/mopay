# Import and export

[Back to README](../README.md) · [Backend tests and export failure behavior](TESTING.md#backend-regression-tests)

## Import notes

- Use the template downloaded from Mopay. Any `.xlsx` file name is accepted (for example `mopay_import_template (1).xlsx`); the content is what is validated.
- Import supports new years and overwriting existing years after explicit confirmation.
- Imported workbook data includes entries, groups, month tags, savings goals, and savings items.
- The user guide with a filled-in example is the [project wiki](https://github.com/pbuzdygan/mopay/wiki).

### Template rules

Parsing lives in [importTemplate.js](../backend/importTemplate.js) and runs without database access, so `POST /api/import/validate` performs the same parse as `POST /api/import` (dry run).

| Element | Rule |
| --- | --- |
| Worksheets | Every sheet is named with a four-digit year (`YYYY` in the template must be renamed); one sheet per year; no other sheets. |
| A1 | Exactly `Mopay Import Template` on every sheet. |
| Section labels | `Incomes`, `Expenses`, `Savings` in column A, in this order. At least one must be present; a missing Incomes/Expenses label is reported as a warning. |
| Header row | The `Name, Jan…Dec, Comment` row after a label is optional. |
| Section end | `End of Incomes` / `End of Expenses`, `Total`, or the next section label. |
| Groups | `Group: <name>` (prefix case-insensitive) starts a group up to 40 characters. `Group: Ungrouped` (case-insensitive) or `Group:` with no name returns to ungrouped. Rows before the first group header are ungrouped. Both headers are optional; groups without rows are still created. |
| Entry rows | Name in column A (80 characters), months in B–M, comment in N (240 characters). Blank rows are ignored. |
| Amounts | Number, empty (0) or `-` (no value). Text with spaces as thousands separators and one decimal comma is accepted (`1 250,50`). Other text, dates, formula errors and formulas without a cached result are rejected with their cell address. |
| Savings | Goal tables of title / `Target` / `Name, Value` / items in column groups A, D, G, J, up to `End of Savings`. Tables may be stacked in a column. Empty item rows are ignored. |

Template example rows (`Group: Example name`, `Example Income`, `Example Ungrouped …`, savings goal `Example name`) are not required. If left in the file they are imported as real data and validation returns a warning.

Validation response: `{ ok: true, years: [{ year, exists, incomes, expenses, groups, goals }], warnings: [{ sheet, message }] }`. An unusable template returns `400 { ok: false, error: 'INVALID_TEMPLATE', message, issues: [{ sheet, cell?, message }], issueCount, warnings }` with at most 20 issues; an unreadable archive returns `INVALID_FILE`, a non-`.xlsx` name `INVALID_NAME`.

### Existing years

Existing years are skipped unless marked for overwrite and confirmed. Overwrite deletes the year's entries, groups, tags, savings goals and items, then inserts the file content. All selected years are written in one transaction: a failure leaves the database unchanged. Mopay export workbooks (`Mopay Export YYYY`) use a different layout and are not import templates.


## XLSX import limits

Validation and import share one parser slot. The authenticated JSON body limit remains 10 MB; XLSX data must use canonical base64 and stay within these fixed budgets:

| Resource | Limit |
| --- | --- |
| Compressed XLSX | 6 MiB |
| Actual expanded archive content | 24 MiB total, 4 MiB per member |
| Archive members / worksheets | 128 / 20 |
| Rows / columns | 5000 / 64 per worksheet, counting the highest row/column holding a cell value and merged ranges; 10000 rows total |
| Explicit cells / merged cell area | 100000 each, across the workbook |
| XML nesting depth | 32 |
| Parsing deadline / worker old-space | 30 seconds / 192 MiB |

Members are streamed and counted before ExcelJS parsing, then rebuilt with checked names/content to avoid differing ZIP filename interpretations. No archive is extracted. DTDs, encrypted/unsupported archives, duplicate/traversal paths and excessively long/deep member names are rejected. Worksheet rows without cell values and the optional `<dimension>` element are removed before any check (LibreOffice writes such rows up to row 1048576 after rows are deleted); all budgets then apply to exactly the rebuilt content ExcelJS receives, so sparse rows holding values and merged ranges still count toward the limits. An additional sheet-ID bound prevents pathological sparse allocation; returned model IDs are normalized internally. Parsing runs in a worker without inherited environment credentials; its heap bound complements byte budgets and is not an operating-system memory limit.

Excessive files return `413 IMPORT_LIMIT_EXCEEDED`; concurrent parsing returns `429 IMPORT_BUSY` with `Retry-After: 1`; the deadline returns `408 IMPORT_TIMEOUT`. Existing `423 IMPORT_IN_PROGRESS` protects a running import. Both endpoints apply the same limits before database writes. Split oversized workbooks by year or remove unused content before retrying.

