# Import and export

[Back to README](../README.md) · [Backend tests and export failure behavior](TESTING.md#backend-regression-tests)

## Import notes

- Use the template downloaded from Mopay. The backend expects the uploaded file name to stay `mopay_import_template.xlsx`.
- Import supports new years and overwriting existing years after explicit confirmation.
- Imported workbook data includes entries, groups, month tags, savings goals, and savings items.


## XLSX import limits

Validation and import share one parser slot. The authenticated JSON body limit remains 10 MB; XLSX data must use canonical base64 and stay within these fixed budgets:

| Resource | Limit |
| --- | --- |
| Compressed XLSX | 6 MiB |
| Actual expanded archive content | 24 MiB total, 4 MiB per member |
| Archive members / worksheets | 128 / 20 |
| Rows / columns | 5000 / 64 per worksheet, including declared dimensions; 10000 rows total |
| Explicit cells / merged cell area | 100000 each, across the workbook |
| XML nesting depth | 32 |
| Parsing deadline / worker old-space | 30 seconds / 192 MiB |

Members are streamed and counted before ExcelJS parsing, then rebuilt with checked names/content to avoid differing ZIP filename interpretations. No archive is extracted. DTDs, encrypted/unsupported archives, duplicate/traversal paths and excessively long/deep member names are rejected. Sparse rows and ranges count toward dimension limits. An additional sheet-ID bound prevents pathological sparse allocation; returned model IDs are normalized internally. Parsing runs in a worker without inherited environment credentials; its heap bound complements byte budgets and is not an operating-system memory limit.

Excessive files return `413 IMPORT_LIMIT_EXCEEDED`; concurrent parsing returns `429 IMPORT_BUSY` with `Retry-After: 1`; the deadline returns `408 IMPORT_TIMEOUT`. Existing `423 IMPORT_IN_PROGRESS` protects a running import. Both endpoints apply the same limits before database writes. Split oversized workbooks by year or remove unused content before retrying.

