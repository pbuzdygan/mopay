import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { loadImportWorkbook } from '../importParser.js';
import { parseImportTemplate, readAmount } from '../importTemplate.js';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const zeros = MONTHS.map(() => 0);

// Mirrors the layout of exportImportTemplateWorkbook(); `edit` receives the row
// list (column A text + month values) before it is written to the sheet.
function templateRows() {
  return [
    ['Mopay Import Template'],
    [],
    ['Incomes'],
    ['Name', ...MONTHS, 'Comment'],
    ['Group: Example name'],
    ['Example Income', ...zeros],
    ['Group: Ungrouped'],
    ['Example Ungrouped Income', ...zeros],
    ['End of Incomes'],
    [],
    ['Expenses'],
    ['Name', ...MONTHS, 'Comment'],
    ['Group: Example name'],
    ['Example Expense', ...zeros],
    ['Group: Ungrouped'],
    ['Example Ungrouped Expense', ...zeros],
    ['End of Expenses'],
    [],
    ['Savings'],
    [],
    ['Example name'],
    ['Target', 0],
    ['Name', 'Value'],
    ['Example', 0],
    ['End of Savings'],
  ];
}

function workbookFrom(rows, sheetName = '2026') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row, index) => {
    row.forEach((value, column) => { if (value !== undefined) sheet.getCell(index + 1, column + 1).value = value; });
  });
  return workbook;
}

const replaceRows = (rows, label, replacement) => {
  const index = rows.findIndex((row) => row[0] === label);
  assert.notEqual(index, -1, label);
  rows.splice(index, 1, ...replacement);
  return rows;
};

const removeRows = (rows, labels) => rows.filter((row) => !labels.includes(row[0]));

const entries = (items) => items.filter((item) => item.kind === 'entry');

test('template without the example group imports entries placed under Group: Ungrouped', async () => {
  let rows = removeRows(templateRows(), ['Group: Example name', 'Example Income', 'Example Expense', 'Example name', 'Target', 'Value', 'Example']);
  rows = replaceRows(rows, 'Example Ungrouped Income', [['Salary', 5000, 5000, ...MONTHS.slice(2).map(() => 5100), 'net']]);
  rows = replaceRows(rows, 'Example Ungrouped Expense', [['Rent', ...MONTHS.map(() => '1 500,50')], ['Fuel', '-', 200]]);
  // Round-trip through XLSX and the bounded worker, as the endpoint does.
  const buffer = Buffer.from(await workbookFrom(rows).xlsx.writeBuffer());
  const parsed = parseImportTemplate(await loadImportWorkbook(buffer.toString('base64')));

  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.deepEqual(parsed.warnings, []);
  const [year] = parsed.years;
  assert.equal(year.year, 2026);
  assert.deepEqual(year.counts, { incomes: 1, expenses: 2, groups: 0, goals: 0 });
  assert.deepEqual(year.incomes, [
    { kind: 'group', name: null },
    { kind: 'entry', name: 'Salary', comment: 'net', months: [5000, 5000, ...MONTHS.slice(2).map(() => 5100)], tags: {}, row: 6 },
  ]);
  const [rent, fuel] = entries(year.expenses);
  assert.deepEqual(rent.months, MONTHS.map(() => 1500.5));
  assert.deepEqual(fuel.months.slice(0, 3), [null, 200, 0]);
});

test('Group: Ungrouped header is optional and matched case-insensitively', () => {
  let rows = removeRows(templateRows(), ['Group: Example name', 'Group: Ungrouped']);
  rows = replaceRows(rows, 'Example Expense', [['Group: Home'], ['Rent', ...zeros], ['group: ungrouped'], ['Misc', ...zeros]]);
  const parsed = parseImportTemplate(workbookFrom(rows));
  assert.equal(parsed.ok, true);
  const { incomes, expenses } = parsed.years[0];
  assert.deepEqual(incomes.map((item) => item.name), ['Example Income', 'Example Ungrouped Income']);
  assert.deepEqual(expenses.map((item) => [item.kind, item.name]), [
    ['group', 'Home'], ['entry', 'Rent'], ['group', null], ['entry', 'Misc'], ['entry', 'Example Ungrouped Expense'],
  ]);
  assert.equal(parsed.years[0].counts.groups, 1);
});

test('deleted end marker and header row do not swallow or drop rows', () => {
  let rows = removeRows(templateRows(), ['End of Incomes']);
  // Delete the Expenses header row (the second "Name" row).
  rows.splice(rows.findIndex((row, index) => row[0] === 'Name' && index > 5), 1);
  const parsed = parseImportTemplate(workbookFrom(rows));
  assert.equal(parsed.ok, true);
  const { incomes, expenses } = parsed.years[0];
  assert.deepEqual(entries(incomes).map((item) => item.name), ['Example Income', 'Example Ungrouped Income']);
  assert.deepEqual(entries(expenses).map((item) => item.name), ['Example Expense', 'Example Ungrouped Expense']);
});

test('leftover template examples are imported but reported as a warning', () => {
  const parsed = parseImportTemplate(workbookFrom(templateRows()));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0].message, /group "Example name".*entry "Example Income".*savings goal "Example name"/);
  assert.deepEqual(parsed.years[0].goals[0].items, [{ name: 'Example', value: 0 }]);
});

test('unreadable amounts and nameless rows fail with cell addresses instead of becoming 0', () => {
  let rows = replaceRows(templateRows(), 'Example Ungrouped Income', [
    ['Bonus', '1.234,56', 'abc'],
    [undefined, 300],
    [],
  ]);
  rows = replaceRows(rows, 'Example Expense', [['Fees', { formula: 'B1*2' }, { formula: 'B1*2', result: 4 }]]);
  const parsed = parseImportTemplate(workbookFrom(rows));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errorCount, 4);
  assert.deepEqual(parsed.errors.map(({ cell }) => cell), ['B8', 'C8', 'A9', 'B16']);
  assert.match(parsed.errors[0].message, /^Jan amount "1\.234,56" is not a number/);
  assert.match(parsed.errors[2].message, /amounts but no name/);
  assert.match(parsed.errors[3].message, /formula without a calculated value/);
  assert.equal(parsed.errors[0].sheet, '2026');
});

test('sheet name and title marker problems are reported precisely', () => {
  const workbook = workbookFrom(templateRows(), 'YYYY');
  workbook.addWorksheet('Notes');
  const other = workbook.addWorksheet('2025');
  other.getCell('A1').value = 'My budget';
  const parsed = parseImportTemplate(workbook);
  assert.equal(parsed.ok, false);
  assert.deepEqual(parsed.errors.map(({ sheet, cell }) => [sheet, cell]), [['YYYY', undefined], ['Notes', undefined], ['2025', 'A1']]);
  assert.match(parsed.errors[0].message, /rename sheet "YYYY"/);
  assert.match(parsed.message, /3 problems found/);
});

test('sheet without any section label is rejected', () => {
  const parsed = parseImportTemplate(workbookFrom([['Mopay Import Template'], [], ['Salary', 100]]));
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors[0].message, /no Incomes, Expenses or Savings section/);
});

test('missing Savings section is fine; missing Expenses section is a warning', () => {
  const rows = templateRows();
  const parsed = parseImportTemplate(workbookFrom(rows.slice(0, rows.findIndex((row) => row[0] === 'Expenses'))));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.warnings.map((item) => item.message).filter((message) => /section not found/.test(message)), [
    'Expenses section not found; no expenses will be imported',
  ]);
  assert.deepEqual(parsed.years[0].goals, []);
});

test('savings goals stacked in one column are parsed separately', () => {
  const rows = templateRows();
  const goalStart = rows.findIndex((row) => row[0] === 'Example name' && rows.indexOf(row) > 15);
  rows.splice(goalStart, 4,
    ['Car'], ['Target', 1000], ['Name', 'Value'], ['Deposit', 200], [],
    ['Holiday'], ['Target', '2 000'], ['Name', 'Value'], ['May', 150]);
  const parsed = parseImportTemplate(workbookFrom(rows));
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.deepEqual(parsed.years[0].goals, [
    { name: 'Car', targetValue: 1000, items: [{ name: 'Deposit', value: 200 }] },
    { name: 'Holiday', targetValue: 2000, items: [{ name: 'May', value: 150 }] },
  ]);
});

test('amount reader accepts template conventions and rejects ambiguous text', () => {
  assert.deepEqual(readAmount(null), { value: 0 });
  assert.deepEqual(readAmount(''), { value: 0 });
  assert.deepEqual(readAmount('-'), { value: null });
  assert.deepEqual(readAmount('–'), { value: null });
  assert.deepEqual(readAmount('1 234,5'), { value: 1234.5 });
  assert.deepEqual(readAmount('-12.25'), { value: -12.25 });
  assert.deepEqual(readAmount({ formula: 'A1', result: 7 }), { value: 7 });
  assert.ok(readAmount('12 zł').error);
  assert.ok(readAmount('1,234.56').error);
  assert.ok(readAmount(new Date()).error);
  assert.ok(readAmount({ formula: 'A1/0', result: { error: '#DIV/0!' } }).error);
});
