import ExcelJS from 'exceljs';
import db from './db.js';
import { decryptToNumber } from './encryption.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CURRENCY_FORMAT = '#,##0.00';
const TABLES_PER_ROW = 4;
const SAVINGS_DATA_COLUMNS = 2;
const SAVINGS_GAP = 1;

const palette = {
  accent: '6667AB',
  accentHover: '5B5DA0',
  surface: 'FFFFFF',
  surfaceAlt: 'F7F8FB',
  subtle: 'ECEFFC',
  total: 'E3E4F6',
  border: 'D8DAF0',
  text: '1C1C28',
  textMuted: '5A5B6A',
  textOnAccent: 'FFFFFF',
};

const toArgb = (hex) => {
  const clean = hex.replace('#', '').trim();
  return `FF${clean.toUpperCase()}`;
};

const buildBorder = () => ({
  top: { style: 'thin', color: { argb: toArgb(palette.border) } },
  bottom: { style: 'thin', color: { argb: toArgb(palette.border) } },
  left: { style: 'thin', color: { argb: toArgb(palette.border) } },
  right: { style: 'thin', color: { argb: toArgb(palette.border) } },
});

const fills = {
  accent: { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(palette.accent) } },
  header: { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(palette.subtle) } },
  body: { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(palette.surface) } },
  total: { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(palette.total) } },
};

const TAG_COLOR_MAP = {
  green: 'CDEFD6',
  orange: 'FFE4C4',
  red: 'F8D1D1',
};

function styleTableRow(row, variant = 'body', textColumns = [1]) {
  const fill =
    variant === 'header'
      ? fills.header
      : variant === 'total'
      ? fills.total
      : fills.body;

  row.eachCell((cell, colNumber) => {
    cell.fill = fill;
    cell.border = buildBorder();
    const isTextColumn = textColumns.includes(colNumber);
    cell.alignment = {
      vertical: 'middle',
      horizontal: variant === 'header' ? 'center' : isTextColumn ? 'left' : 'right',
    };
    cell.font = {
      bold: variant !== 'body',
      color: { argb: toArgb(palette.text) },
    };
    if (!isTextColumn && typeof cell.value === 'number') {
      cell.numFmt = CURRENCY_FORMAT;
    }
  });
}

function styleSectionTitle(sheet, rowIndex, text) {
  sheet.mergeCells(rowIndex, 1, rowIndex, 4);
  const cell = sheet.getCell(rowIndex, 1);
  cell.value = text;
  cell.font = {
    bold: true,
    size: 14,
    color: { argb: toArgb(palette.accentHover) },
  };
  cell.alignment = { vertical: 'middle' };
}

function renderEntriesSection(sheet, year, type, startRow) {
  styleSectionTitle(sheet, startRow, type === 'income' ? 'Incomes' : 'Expenses');
  const headerRow = sheet.addRow(['Name', ...MONTHS, 'Sum', 'Avg', 'Comment']);
  const commentColumnIndex = 1 + MONTHS.length + 3;
  styleTableRow(headerRow, 'header', [1, commentColumnIndex]);

  const rows = db.prepare(
    `SELECT e.id, name, comment, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, "Dec" as Decm
     FROM entries e JOIN years y ON e.year_id=y.id
     WHERE y.year=? AND type=? ORDER BY sort_index, e.id`
  ).all(year, type);

  const tagRows = db
    .prepare(
      `SELECT t.entry_id as entryId, t.month, t.color, t.text
       FROM entry_tags t
       JOIN entries e ON e.id = t.entry_id
       JOIN years y ON y.id = e.year_id
       WHERE y.year=? AND e.type=?`
    )
    .all(year, type);

  const tagsByEntry = new Map();
  for (const tag of tagRows) {
    if (!tagsByEntry.has(tag.entryId)) tagsByEntry.set(tag.entryId, {});
    tagsByEntry.get(tag.entryId)[tag.month] = { color: tag.color, text: tag.text?.trim() };
  }

  const monthlyTotals = new Array(MONTHS.length).fill(0);
  for (const entry of rows) {
    const values = MONTHS.map((month) => {
      const raw = month === 'Dec' ? entry.Decm : entry[month];
      return decryptToNumber(raw);
    });
    values.forEach((value, idx) => {
      monthlyTotals[idx] += value;
    });
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = values.length ? sum / values.length : 0;
    const dataRow = sheet.addRow([entry.name, ...values, sum, avg, entry.comment ?? '']);
    styleTableRow(dataRow, 'body', [1, commentColumnIndex]);

    const entryTags = tagsByEntry.get(entry.id);
    if (entryTags) {
      MONTHS.forEach((month, monthIdx) => {
        const tag = entryTags[month];
        if (!tag) return;
        const colorHex = TAG_COLOR_MAP[tag.color];
        if (!colorHex) return;
        const cellIndex = 2 + monthIdx;
        const cell = dataRow.getCell(cellIndex);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: toArgb(colorHex) },
        };
        if (tag.text) {
          cell.note = tag.text;
        }
      });
    }
  }

  const totalSum = monthlyTotals.reduce((acc, val) => acc + val, 0);
  const totalAvg = monthlyTotals.length ? totalSum / monthlyTotals.length : 0;
  const totalRow = sheet.addRow(['Total', ...monthlyTotals, totalSum, totalAvg, '']);
  styleTableRow(totalRow, 'total', [1, commentColumnIndex]);

  const spacer = sheet.addRow([]);
  return spacer.number + 1;
}

function renderTemplateEntriesSection(sheet, type, startRow) {
  styleSectionTitle(sheet, startRow, type === 'income' ? 'Incomes' : 'Expenses');
  const headerRow = sheet.addRow(['Name', ...MONTHS, 'Comment']);
  const commentColumnIndex = 1 + MONTHS.length + 1;
  styleTableRow(headerRow, 'header', [1, commentColumnIndex]);

  const values = MONTHS.map(() => 0);
  const name = type === 'income' ? 'Example Income' : 'Example Expense';
  const dataRow = sheet.addRow([name, ...values, '']);
  styleTableRow(dataRow, 'body', [1, commentColumnIndex]);

  const totalRow = sheet.addRow(['Total', ...values, '']);
  styleTableRow(totalRow, 'total', [1, commentColumnIndex]);

  const spacer = sheet.addRow([]);
  return spacer.number + 1;
}

function styleSavingsRow(sheet, rowIndex, startCol, endCol, variant = 'body') {
  const fill =
    variant === 'title'
      ? fills.accent
      : variant === 'header'
      ? fills.header
      : variant === 'total'
      ? fills.total
      : fills.body;

  if (variant === 'title') {
    const cell = sheet.getCell(rowIndex, startCol);
    cell.border = buildBorder();
    cell.fill = fill;
    cell.font = {
      bold: true,
      color: { argb: toArgb(palette.textOnAccent) },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    return;
  }

  for (let col = startCol; col <= endCol; col++) {
    const cell = sheet.getCell(rowIndex, col);
    cell.border = buildBorder();
    cell.fill = fill;
    let fontColor = palette.text;
    let bold = variant !== 'body';
    let horizontal = col === startCol ? 'left' : 'right';
    if (variant === 'title') {
      fontColor = palette.textOnAccent;
      horizontal = 'center';
      bold = true;
    }
    cell.font = {
      bold,
      color: { argb: toArgb(fontColor) },
    };
    cell.alignment = { vertical: 'middle', horizontal };
    if (typeof cell.value === 'number' && col === endCol) {
      cell.numFmt = CURRENCY_FORMAT;
    }
  }
}

function renderGoalTable(sheet, goal, items, startRow, startCol) {
  const endCol = startCol + SAVINGS_DATA_COLUMNS - 1;
  const totalValue = items.reduce((sum, item) => sum + decryptToNumber(item.value), 0);

  sheet.mergeCells(startRow, startCol, startRow, endCol);
  sheet.getCell(startRow, startCol).value = goal.name;
  styleSavingsRow(sheet, startRow, startCol, endCol, 'title');

  let row = startRow + 1;
  sheet.getCell(row, startCol).value = 'Target';
  sheet.getCell(row, startCol + 1).value =
    goal.targetValue === null || goal.targetValue === undefined ? null : decryptToNumber(goal.targetValue);
  if (goal.targetValue === null || goal.targetValue === undefined) {
    sheet.getCell(row, startCol + 1).value = '—';
  }
  styleSavingsRow(sheet, row, startCol, endCol, 'header');

  row += 1;
  sheet.getCell(row, startCol).value = 'Name';
  sheet.getCell(row, startCol + 1).value = 'Value';
  styleSavingsRow(sheet, row, startCol, endCol, 'header');

  if (items.length === 0) {
    row += 1;
    sheet.getCell(row, startCol).value = '—';
    sheet.getCell(row, startCol + 1).value = 0;
    styleSavingsRow(sheet, row, startCol, endCol, 'body');
  } else {
    for (const item of items) {
      row += 1;
      sheet.getCell(row, startCol).value = item.name || '';
      sheet.getCell(row, startCol + 1).value = decryptToNumber(item.value);
      styleSavingsRow(sheet, row, startCol, endCol, 'body');
    }
  }

  row += 1;
  sheet.getCell(row, startCol).value = 'Total';
  sheet.getCell(row, startCol + 1).value = totalValue;
  styleSavingsRow(sheet, row, startCol, endCol, 'total');

  return row - startRow + 1;
}

function renderSavingsSection(sheet, yearId, startRow) {
  styleSectionTitle(sheet, startRow, 'Savings');
  const goals = db
    .prepare(
      `SELECT id, name, target_value AS targetValue
       FROM savings_goals
       WHERE year_id=?
       ORDER BY sort_index, id`
    )
    .all(yearId);

  if (goals.length === 0) {
    const infoRow = sheet.addRow(['No savings goals recorded for this year.']);
    sheet.mergeCells(infoRow.number, 1, infoRow.number, 4);
    styleTableRow(infoRow, 'body');
    const spacer = sheet.addRow([]);
    return spacer.number + 1;
  }

  const goalIds = goals.map((g) => g.id);
  const items = goalIds.length
    ? db
        .prepare(
          `SELECT goal_id AS goalId, name, value
           FROM savings_items
           WHERE goal_id IN (${goalIds.map(() => '?').join(',')})
           ORDER BY sort_index, id`
        )
        .all(...goalIds)
    : [];
  const itemsByGoal = new Map();
  for (const item of items) {
    if (!itemsByGoal.has(item.goalId)) itemsByGoal.set(item.goalId, []);
    itemsByGoal.get(item.goalId).push(item);
  }

  let currentRow = startRow + 2;
  let maxHeightInGroup = 0;

  goals.forEach((goal, index) => {
    const columnIndex = index % TABLES_PER_ROW;
    if (columnIndex === 0 && index !== 0) {
      currentRow += maxHeightInGroup + 2;
      maxHeightInGroup = 0;
    }
    const startCol = 1 + columnIndex * (SAVINGS_DATA_COLUMNS + SAVINGS_GAP);
    const height = renderGoalTable(sheet, goal, itemsByGoal.get(goal.id) ?? [], currentRow, startCol);
    if (height > maxHeightInGroup) maxHeightInGroup = height;
  });

  const spacer = sheet.addRow([]);
  return spacer.number + 1;
}

function renderTemplateSavingsSection(sheet, startRow) {
  styleSectionTitle(sheet, startRow, 'Savings');
  const goal = { name: 'Example name', targetValue: 0 };
  const items = [{ name: 'Example', value: 0 }];
  const currentRow = startRow + 2;
  renderGoalTable(sheet, goal, items, currentRow, 1);
  const spacer = sheet.addRow([]);
  return spacer.number + 1;
}

export async function exportYearsToWorkbook(years) {
  const workbook = new ExcelJS.Workbook();
  const yearLookup = db.prepare('SELECT id FROM years WHERE year=?');

  for (const year of years) {
    const yearRow = yearLookup.get(year);
    if (!yearRow) continue;

    const sheet = workbook.addWorksheet(String(year));
    sheet.mergeCells(1, 1, 1, 8);
    const headCell = sheet.getCell(1, 1);
    headCell.value = `Mopay Export ${year}`;
    headCell.font = {
      bold: true,
      size: 16,
      color: { argb: toArgb(palette.textOnAccent) },
    };
    headCell.alignment = { horizontal: 'center', vertical: 'middle' };
    headCell.fill = fills.accent;
    headCell.border = buildBorder();

    let rowPointer = 3;
    rowPointer = renderEntriesSection(sheet, year, 'income', rowPointer);
    rowPointer = renderEntriesSection(sheet, year, 'expense', rowPointer);
    rowPointer = renderSavingsSection(sheet, yearRow.id, rowPointer);

    sheet.columns = [
      { key: 'name', width: 24 },
      ...Array.from({ length: 12 }, () => ({ width: 10 })),
      { key: 'sum', width: 12 },
      { key: 'avg', width: 12 },
      { key: 'comment', width: 28 },
    ];
  }

  return workbook;
}

export async function exportImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('YYYY');
  sheet.mergeCells(1, 1, 1, 8);
  const headCell = sheet.getCell(1, 1);
  headCell.value = 'Mopay Import Template';
  headCell.font = {
    bold: true,
    size: 16,
    color: { argb: toArgb(palette.textOnAccent) },
  };
  headCell.alignment = { horizontal: 'center', vertical: 'middle' };
  headCell.fill = fills.accent;
  headCell.border = buildBorder();

  let rowPointer = 3;
  rowPointer = renderTemplateEntriesSection(sheet, 'income', rowPointer);
  rowPointer = renderTemplateEntriesSection(sheet, 'expense', rowPointer);
  rowPointer = renderTemplateSavingsSection(sheet, rowPointer);

  sheet.columns = [
    { key: 'name', width: 24 },
    ...Array.from({ length: 12 }, () => ({ width: 10 })),
    { key: 'comment', width: 28 },
  ];

  return workbook;
}
