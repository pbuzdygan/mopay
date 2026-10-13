# Intended outcome

Release v2.0.2: an import template filled in good faith imports successfully, and a file that cannot be imported reports *what* is wrong and *where* (sheet, cell) instead of the generic "Invalid template structure. Check Guide". Template example rows (`Group: Example name`, `Example …`) are optional; the only structure a user must keep is the A1 marker, year-named sheets and the section labels they use.

## Current state (v2.0.1, before this change)

Validation (`POST /api/import/validate`) checks only:

1. browser file name is exactly `mopay_import_template.xlsx` (also checked in the browser before upload);
2. archive/XML budgets (`importArchive.js`, worker) and ExcelJS readability;
3. every worksheet name is four digits (`YYYY` in the template must be renamed);
4. cell A1 of every worksheet is exactly `Mopay Import Template`.

Any failure, including an unreadable file, is shown as one generic message. Section content is not checked until `POST /api/import`, which fails as `IMPORT_FAILED` or silently accepts questionable data. `Group: Example name` is **not** required by any rule; a renamed file (for example `mopay_import_template (1).xlsx` after a second download) or an unrenamed `YYYY` sheet produce the same generic message, which makes such causes indistinguishable.

Section parsing (`parseEntriesSection` in `server.js`):

- label row `Incomes` / `Expenses` is the *last* matching cell in column A; the row after it is always skipped as the header, even if the user deleted it;
- rows are read until `Total`, `End of <Section>` or the sheet end; a deleted end marker makes Incomes absorb the Expenses label, header and entries (Expenses are then imported twice);
- `Group: <name>` starts a group; `Group: Ungrouped` (exact case) or an empty name means ungrouped; rows before the first group header are ungrouped; groups are created even when empty;
- a row without a name is dropped even if it has amounts; non-numeric amounts (`1.234,56`, `12 zł`, formulas without cached result, dates) silently become 0; `-` means no value; empty means 0;
- template example rows are imported as real entries/groups/goals when left in the file.

Existing years: validation marks each year as new or existing. Existing years are skipped by default; marking a year for overwrite requires the "Agree to overwrite" confirmation. Overwrite deletes all entries, groups, tags, savings goals and savings items of that year and inserts the file content; the whole import is one transaction (all selected years or nothing). The server rejects an explicit year selection that includes an existing year not marked for overwrite (`OVERWRITE_REQUIRED`).

Other findings (not changed here): Excel export (`Mopay Export YYYY`, Sum/Avg columns, `Total` rows) is not an import template, so export → import round-trip is not supported.

## Approach

- Move template parsing into a DB-free module `backend/importTemplate.js` used by both endpoints, so validation runs the same parse as import (dry run).
- Accept any `.xlsx` file name up to 255 characters (browser and server); content checks remain the trust boundary.
- Return `INVALID_TEMPLATE` with a summary message and a bounded list of issues `{ sheet, cell, message }`; keep `INVALID_FILE` for unreadable archives.
- Tolerant structure: optional header row, sections end at their end marker *or* the next section label, case-insensitive `Group:` prefix and `Ungrouped`, `Group: Ungrouped` header optional (rows without a group are ungrouped), example group/rows optional.
- Strict data: rows with amounts but no name, and amounts that are not numbers, fail validation with cell addresses instead of silently losing data.
- Warnings (non-blocking) for leftover template example rows and missing sections; per-year counts shown in the import dialog before confirmation.
- Document the template rules in `docs/IMPORT_EXPORT.md` and draft a user wiki page.

## Risks and verification

- Files with invalid amounts that used to import as 0 are now rejected with the cell list (intentional; prevents silent data loss).
- No DB schema, encryption or overwrite semantics change; rollback: run the v2.0.1 image.
- Checks: `node --test backend/tests/*.test.mjs` (new template regressions), `npm --prefix frontend run build`, isolated-DB end-to-end import of edited templates.

## References

[server import endpoints](../../backend/server.js), [template export](../../backend/export.js), [import dialog](../../frontend/src/components/modals/ImportModal.tsx), [import docs](../../docs/IMPORT_EXPORT.md).
