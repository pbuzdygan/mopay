// Parses the Mopay import template without touching the database, so the
// validate endpoint can run the same parse as the import itself (dry run) and
// report structural problems with sheet/cell locations before any write.

export const TEMPLATE_MARKER = 'Mopay Import Template';
export const MONTH_COLUMNS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NAME_MAX = 80;
const COMMENT_MAX = 240;
const GROUP_NAME_MAX = 40;
const COMMENT_COLUMN = 14; // Name + 12 months + Comment
const MAX_REPORTED_ISSUES = 20;
const SECTION_LABELS = ['Incomes', 'Expenses', 'Savings'];
const GROUP_HEADER = /^group\s*:\s*(.*)$/i;
const TEMPLATE_EXAMPLE_ENTRIES = new Set([
  'Example Income', 'Example Expense', 'Example Ungrouped Income', 'Example Ungrouped Expense',
]);
const TEMPLATE_EXAMPLE_GROUP = 'Example name';

export const clampText = (value, max = NAME_MAX) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export const getCellText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((chunk) => chunk.text).join('').trim();
    if ('text' in value) return String(value.text).trim();
    if ('result' in value) return getCellText(value.result);
  }
  return '';
};

// Returns { value } for a usable amount or { error } describing why the cell
// cannot be read. Empty cells are 0 and '-' means "no value" (null), matching
// the editor and the export format.
export const readAmount = (raw) => {
  if (raw === null || raw === undefined) return { value: 0 };
  if (typeof raw === 'number') return Number.isFinite(raw) ? { value: raw } : { error: 'is not a finite number' };
  if (raw instanceof Date) return { error: 'is a date, expected an amount' };
  if (typeof raw === 'object') {
    if ('formula' in raw || 'sharedFormula' in raw) {
      if (!('result' in raw) || raw.result === undefined) {
        return { error: 'is a formula without a calculated value; open and save the file in a spreadsheet app' };
      }
      if (raw.result && typeof raw.result === 'object' && 'error' in raw.result) return { error: `is a formula error (${raw.result.error})` };
      return readAmount(raw.result);
    }
    if ('richText' in raw || 'text' in raw) return readAmount(getCellText(raw));
    return { error: 'has an unsupported value' };
  }
  if (typeof raw !== 'string') return { error: 'has an unsupported value' };
  const text = raw.trim();
  if (text === '') return { value: 0 };
  if (text === '-' || text === '–') return { value: null };
  // Accept spaces/non-breaking spaces as thousands separators and one decimal comma.
  const cleaned = text.replace(/[\s ]+/g, '').replace(',', '.');
  const parsed = /^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
  return Number.isFinite(parsed) ? { value: parsed } : { error: `"${text.slice(0, 20)}" is not a number` };
};

const TAG_COLOR_HEX_TO_NAME = new Map([
  ['D9D9D9', 'grey'],
  ['FF0000', 'red'],
  ['FFC000', 'orange'],
  ['92D050', 'green'],
]);

const normalizeHex = (value) => {
  if (typeof value !== 'string') return null;
  let hex = value.replace('#', '').trim();
  if (hex.length === 8) hex = hex.slice(2);
  if (hex.length !== 6) return null;
  return hex.toUpperCase();
};

const getNoteText = (note) => {
  if (!note) return '';
  if (typeof note === 'string') return note.trim();
  if (typeof note === 'object') {
    if ('text' in note) return String(note.text ?? '').trim();
    if (Array.isArray(note.texts)) return note.texts.map((chunk) => chunk.text ?? '').join('').trim();
    if (Array.isArray(note.richText)) return note.richText.map((chunk) => chunk.text ?? '').join('').trim();
  }
  return '';
};

const getCellFillHex = (cell) => {
  const fill = cell?.fill;
  if (!fill || fill.type !== 'pattern') return null;
  const color = fill.fgColor;
  if (!color) return null;
  const hex = normalizeHex(color.argb || color.value || color.rgb);
  if (!hex || hex === 'FFFFFF') return null;
  return hex;
};

const parseTagFromCell = (cell) => {
  const noteText = getNoteText(cell?.note);
  const fillHex = getCellFillHex(cell);
  const color = fillHex ? TAG_COLOR_HEX_TO_NAME.get(fillHex) ?? 'grey' : null;
  if (!color && !noteText) return null;
  return { color: color ?? (noteText ? 'grey' : 'none'), text: noteText };
};

const columnLetter = (column) => {
  let letters = '';
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
};
const cellAddress = (row, column) => `${columnLetter(column)}${row}`;

const textAt = (sheet, row, column) => getCellText(sheet.getCell(row, column).value);

// Finds section label rows in template order (first match after the previous
// section) so an entry named like a later section cannot move the boundary.
const locateSections = (sheet) => {
  const found = {};
  let from = 1;
  for (const label of SECTION_LABELS) {
    for (let row = from; row <= sheet.rowCount; row += 1) {
      if (textAt(sheet, row, 1) === label) {
        found[label] = row;
        from = row + 1;
        break;
      }
    }
  }
  return found;
};

const isUngroupedName = (name) => !name || name.toLowerCase() === 'ungrouped';

function parseEntriesSection(sheet, label, sections, report) {
  const items = [];
  const labelRow = sections[label];
  if (!labelRow) {
    report.warning(`${label} section not found; no ${label.toLowerCase()} will be imported`, sheet.name);
    return items;
  }
  const endMarker = `End of ${label}`;
  // A section ends at its own marker, at 'Total', or at the next section label,
  // so a deleted end marker can no longer swallow the following sections.
  const stopLabels = new Set([endMarker, 'Total', ...SECTION_LABELS.filter((item) => item !== label)]);
  let row = labelRow + 1;
  if (textAt(sheet, row, 1) === 'Name') row += 1;
  let groupName = null;
  for (; row <= sheet.rowCount; row += 1) {
    const nameText = textAt(sheet, row, 1);
    if (stopLabels.has(nameText)) break;
    const groupMatch = GROUP_HEADER.exec(nameText);
    if (groupMatch) {
      const name = clampText(groupMatch[1], GROUP_NAME_MAX);
      groupName = isUngroupedName(name) ? null : name;
      items.push({ kind: 'group', name: groupName });
      continue;
    }

    const months = [];
    const tags = {};
    let hasAmounts = false;
    MONTH_COLUMNS.forEach((month, index) => {
      const cell = sheet.getCell(row, 2 + index);
      const amount = readAmount(cell.value);
      if (amount.error) {
        if (nameText) report.error(`${month} amount ${amount.error}`, sheet.name, cellAddress(row, 2 + index));
        else hasAmounts = true;
        months.push(0);
        return;
      }
      if (amount.value !== 0) hasAmounts = true;
      months.push(amount.value);
      const tag = parseTagFromCell(cell);
      if (tag) tags[month] = tag;
    });
    if (!nameText) {
      // Blank spacer rows are fine; amounts without a name would be lost.
      if (hasAmounts) report.error('row has amounts but no name in column A', sheet.name, cellAddress(row, 1));
      continue;
    }
    items.push({
      kind: 'entry',
      name: clampText(nameText, NAME_MAX),
      comment: clampText(textAt(sheet, row, COMMENT_COLUMN), COMMENT_MAX),
      months,
      tags,
      row,
    });
  }
  return items;
}

function parseSavingsSection(sheet, sections, report) {
  const savingsRow = sections.Savings;
  if (!savingsRow) return [];
  let lastRow = sheet.rowCount;
  for (let row = savingsRow + 1; row <= sheet.rowCount; row += 1) {
    if (textAt(sheet, row, 1) === 'End of Savings') {
      lastRow = row - 1;
      break;
    }
  }
  const startCols = [1, 4, 7, 10];
  const goals = [];
  const amountAt = (row, column) => {
    const amount = readAmount(sheet.getCell(row, column).value);
    if (amount.error) {
      report.error(`savings amount ${amount.error}`, sheet.name, cellAddress(row, column));
      return 0;
    }
    return amount.value ?? 0;
  };
  for (let row = savingsRow + 1; row <= lastRow; row += 1) {
    for (const startCol of startCols) {
      const title = textAt(sheet, row, startCol);
      if (!title || title === 'Target' || title === 'Name' || title === 'Total') continue;
      if (textAt(sheet, row + 1, startCol) !== 'Target'
        || textAt(sheet, row + 2, startCol) !== 'Name'
        || textAt(sheet, row + 2, startCol + 1) !== 'Value') continue;

      const targetValue = amountAt(row + 1, startCol + 1);
      const items = [];
      for (let r = row + 3; r <= lastRow; r += 1) {
        const nameText = textAt(sheet, r, startCol);
        if (nameText === 'Total') break;
        // The next goal table stacked below in the same column starts a new goal.
        if (textAt(sheet, r + 1, startCol) === 'Target' && textAt(sheet, r + 2, startCol) === 'Name') break;
        const value = amountAt(r, startCol + 1);
        // Empty rows (no name, zero or no value) are ignored.
        if (!nameText && !value) continue;
        items.push({ name: clampText(nameText, NAME_MAX), value });
      }
      goals.push({ name: clampText(title, NAME_MAX), targetValue, items });
    }
  }
  return goals;
}

function createReport() {
  const errors = [];
  const warnings = [];
  let errorCount = 0;
  return {
    errors,
    warnings,
    get errorCount() { return errorCount; },
    error(message, sheet, cell) {
      errorCount += 1;
      if (errors.length < MAX_REPORTED_ISSUES) errors.push({ sheet, cell, message });
    },
    warning(message, sheet) {
      if (warnings.length < MAX_REPORTED_ISSUES) warnings.push({ sheet, message });
    },
  };
}

function exampleWarnings(sheet, incomes, expenses, goals, report) {
  const leftovers = [];
  for (const item of [...incomes, ...expenses]) {
    if (item.kind === 'entry' && TEMPLATE_EXAMPLE_ENTRIES.has(item.name)) leftovers.push(`entry "${item.name}"`);
    if (item.kind === 'group' && item.name === TEMPLATE_EXAMPLE_GROUP) leftovers.push(`group "${item.name}"`);
  }
  for (const goal of goals) {
    if (goal.name === TEMPLATE_EXAMPLE_GROUP) leftovers.push(`savings goal "${goal.name}"`);
  }
  if (leftovers.length) {
    report.warning(`template example rows will be imported as real data: ${[...new Set(leftovers)].join(', ')}. Delete them if not needed.`, sheet.name);
  }
}

/**
 * Parses every worksheet of an import workbook.
 * Returns { ok: true, years: [{ year, sheet, incomes, expenses, goals, counts }], warnings }
 * or { ok: false, message, errors, errorCount, warnings }.
 */
export function parseImportTemplate(workbook) {
  const report = createReport();
  const years = [];
  const sheets = workbook.worksheets ?? [];
  if (!sheets.length) report.error('the file contains no worksheets');
  for (const sheet of sheets) {
    const name = String(sheet.name ?? '').trim();
    if (!/^\d{4}$/.test(name)) {
      report.error(name.toUpperCase() === 'YYYY'
        ? 'rename sheet "YYYY" to the year it contains, for example 2026'
        : `sheet name "${name}" is not a year; every sheet must be named with a four-digit year (remove other sheets)`, name);
      continue;
    }
    if (years.some((item) => item.year === Number(name))) {
      report.error(`year ${name} appears in more than one sheet`, name);
      continue;
    }
    if (textAt(sheet, 1, 1) !== TEMPLATE_MARKER) {
      report.error(`cell A1 must contain "${TEMPLATE_MARKER}" (keep the template title row)`, name, 'A1');
      continue;
    }
    const sections = locateSections(sheet);
    if (!sections.Incomes && !sections.Expenses && !sections.Savings) {
      report.error('no Incomes, Expenses or Savings section label found in column A', name);
      continue;
    }
    const incomes = parseEntriesSection(sheet, 'Incomes', sections, report);
    const expenses = parseEntriesSection(sheet, 'Expenses', sections, report);
    const goals = parseSavingsSection(sheet, sections, report);
    exampleWarnings(sheet, incomes, expenses, goals, report);
    const countGroups = (items) => new Set(items.filter((item) => item.kind === 'group' && item.name).map((item) => item.name)).size;
    years.push({
      year: Number(name),
      sheet,
      incomes,
      expenses,
      goals,
      counts: {
        incomes: incomes.filter((item) => item.kind === 'entry').length,
        expenses: expenses.filter((item) => item.kind === 'entry').length,
        groups: countGroups(incomes) + countGroups(expenses),
        goals: goals.length,
      },
    });
  }
  if (report.errorCount) {
    const hidden = report.errorCount - report.errors.length;
    return {
      ok: false,
      message: `The file cannot be imported: ${report.errorCount} problem${report.errorCount === 1 ? '' : 's'} found${hidden > 0 ? ` (first ${report.errors.length} shown)` : ''}.`,
      errors: report.errors,
      errorCount: report.errorCount,
      warnings: report.warnings,
    };
  }
  return { ok: true, years, warnings: report.warnings };
}

// Builds the bounded JSON body returned for an unusable template.
export const templateErrorBody = (result) => ({
  ok: false,
  error: 'INVALID_TEMPLATE',
  message: result.message,
  issues: result.errors,
  issueCount: result.errorCount,
  warnings: result.warnings,
});
