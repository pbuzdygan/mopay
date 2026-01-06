import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import ExcelJS from 'exceljs';
import { exportYearsToWorkbook, exportImportTemplateWorkbook } from './export.js';
import { encryptNumber, decryptToNumber, KEY_FINGERPRINT } from './encryption.js';
import { runEncryptionMigration, evaluateEncryptionState, repairEncryptionState } from './migration.js';
import { runTagsMigration } from './tagsMigration.js';
import { initializePin, verifyPinValue } from './pin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8010);
const APP_PIN = process.env.APP_PIN || '';
const APP_VERSION = process.env.APP_VERSION || 'dev';
const APP_REPO = process.env.APP_REPO || 'pbuzdygan/mopay';
const APP_CHANNEL = process.env.APP_CHANNEL || 'main';
let keyMismatch = false;

const getMetaValue = (key) => db.prepare('SELECT value FROM meta WHERE key=?').get(key);
const setMetaValue = (key, value) =>
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?, ?)').run(key, value);

const KEY_MISMATCH_MESSAGE =
  'Your APP_ENC_KEY has been changed! Revert to previous encryption key to keep your data.';
const KEY_MISMATCH_RESPONSE = {
  error: 'ENCRYPTION_KEY_MISMATCH',
  message: `${KEY_MISMATCH_MESSAGE} You can also reset the database to start fresh with the current key.`,
};

const guardKeyMismatch = (res) => {
  if (!keyMismatch) return false;
  res.status(409).json(KEY_MISMATCH_RESPONSE);
  return true;
};
const migrationInfo = runEncryptionMigration(db);
console.log(migrationInfo.migrationRan ? 'Encryption migration executed on startup' : 'Encryption migration not required');
const tagsMigrationInfo = runTagsMigration(db);
console.log(
  tagsMigrationInfo.created
    ? 'Tagging migration executed (entry_tags table ready)'
    : 'Tagging migration not required'
);
initializePin(db, APP_PIN);
const fingerprintRow = getMetaValue('enc_key_fingerprint');
if (!fingerprintRow?.value) {
  setMetaValue('enc_key_fingerprint', KEY_FINGERPRINT);
  setMetaValue('enc_key_mismatch', '0');
} else if (fingerprintRow.value !== KEY_FINGERPRINT) {
  keyMismatch = true;
  setMetaValue('enc_key_mismatch', '1');
  console.error(KEY_MISMATCH_MESSAGE);
} else {
  setMetaValue('enc_key_mismatch', '0');
}

if (!keyMismatch) {
  const encryptionState = evaluateEncryptionState(db);
  if (!encryptionState.hasData) {
    console.log('Encryption verification: no monetary data stored yet (ready for encrypted writes)');
  } else if (encryptionState.encrypted) {
    console.log('Encryption verification: monetary columns confirmed encrypted');
  } else {
    const sources = encryptionState.sources.join(', ');
    console.warn(`Encryption verification: detected unencrypted monetary values in: ${sources || 'unknown tables'}`);
    const repairInfo = repairEncryptionState(db);
    if (repairInfo.changed) {
      console.log(
        `Encryption repair applied (entries: ${repairInfo.entriesUpdated}, goals: ${repairInfo.goalsUpdated}, items: ${repairInfo.itemsUpdated})`
      );
      const postState = evaluateEncryptionState(db);
      if (postState.encrypted) {
        console.log('Encryption verification after repair: monetary columns confirmed encrypted');
      } else {
        console.warn('Encryption verification after repair still detects issues – manual inspection recommended');
      }
    } else {
      console.warn('Encryption repair ran but no values needed updating – please inspect the database manually');
    }
  }
} else {
  console.warn('Mopay is locked because the encryption key does not match the stored data.');
}

const MONTH_COLUMNS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TAG_COLORS = new Set(['grey','green','orange','red']);

const clampText = (value, max = 80) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const getCellText = (value) => {
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

const getCellNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object') {
    if ('result' in value) return getCellNumber(value.result);
    if ('text' in value) return getCellNumber(value.text);
  }
  return 0;
};

const parseImportWorkbook = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = wb.worksheets;
  if (!sheets.length) {
    const err = new Error('NO_SHEETS');
    err.code = 'NO_SHEETS';
    throw err;
  }
  const sheetNamePattern = /^\d{4}$/;
  const entries = [];
  for (const sheet of sheets) {
    if (!sheetNamePattern.test(sheet.name)) {
      const err = new Error('INVALID_SHEET_NAME');
      err.code = 'INVALID_SHEET_NAME';
      throw err;
    }
    const cellValue = sheet.getCell(1, 1).value;
    const text = getCellText(cellValue);
    if (text !== 'Mopay Import Template') {
      const err = new Error('INVALID_HEADER');
      err.code = 'INVALID_HEADER';
      throw err;
    }
    entries.push({ year: Number(sheet.name), sheet });
  }
  return entries;
};

const findSectionRow = (sheet, label) => {
  let rowIndex = null;
  sheet.getColumn(1).eachCell((cell, rowNumber) => {
    if (getCellText(cell.value) === label) rowIndex = rowNumber;
  });
  return rowIndex;
};

const parseEntriesSection = (sheet, label, type, yearId) => {
  const sectionRow = findSectionRow(sheet, label);
  if (!sectionRow) return [];
  const data = [];
  const commentColumnIndex = 14;
  let row = sectionRow + 2;
  while (row <= sheet.rowCount) {
    const nameText = getCellText(sheet.getCell(row, 1).value);
    if (nameText === 'Total') break;
    const months = MONTH_COLUMNS.map((_, idx) => getCellNumber(sheet.getCell(row, 2 + idx).value));
    const comment = getCellText(sheet.getCell(row, commentColumnIndex).value);
    if (nameText) {
      data.push({
        type,
        name: clampText(nameText, 80),
        comment: clampText(comment, 240),
        months,
        yearId,
      });
    }
    row += 1;
  }
  return data;
};

const parseSavingsSection = (sheet) => {
  const savingsRow = findSectionRow(sheet, 'Savings');
  if (!savingsRow) return [];
  const startCols = [1, 4, 7, 10];
  const goals = [];
  for (let row = savingsRow + 2; row <= sheet.rowCount; row += 1) {
    for (const startCol of startCols) {
      const title = getCellText(sheet.getCell(row, startCol).value);
      if (!title || title === 'Target' || title === 'Name' || title === 'Total') continue;
      const targetLabel = getCellText(sheet.getCell(row + 1, startCol).value);
      const headerLabel = getCellText(sheet.getCell(row + 2, startCol).value);
      const valueHeader = getCellText(sheet.getCell(row + 2, startCol + 1).value);
      if (targetLabel !== 'Target' || headerLabel !== 'Name' || valueHeader !== 'Value') continue;

      const targetValue = getCellNumber(sheet.getCell(row + 1, startCol + 1).value);
      const items = [];
      for (let r = row + 3; r <= sheet.rowCount; r += 1) {
        const nameText = getCellText(sheet.getCell(r, startCol).value);
        if (nameText === 'Total') break;
        const value = getCellNumber(sheet.getCell(r, startCol + 1).value);
        if (!nameText && value === 0) continue;
        items.push({
          name: clampText(nameText || '', 80),
          value,
        });
      }
      goals.push({
        name: clampText(title, 80),
        targetValue,
        items,
      });
    }
  }
  return goals;
};

const clearYearData = (yearId) => {
  db.prepare('DELETE FROM entries WHERE year_id=?').run(yearId);
  const goalIds = db.prepare('SELECT id FROM savings_goals WHERE year_id=?').all(yearId).map((row) => row.id);
  if (goalIds.length) {
    db.prepare(`DELETE FROM savings_items WHERE goal_id IN (${goalIds.map(() => '?').join(',')})`).run(...goalIds);
    db.prepare(`DELETE FROM savings_goals WHERE id IN (${goalIds.map(() => '?').join(',')})`).run(...goalIds);
  }
};

const getYearRow = (yearValue) => {
  const numericYear = Number(yearValue);
  if (!Number.isInteger(numericYear)) return null;
  return db.prepare('SELECT id FROM years WHERE year=?').get(numericYear);
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', (_req,res)=> res.json({ status: 'ok' }));

app.get('/api/meta', (_req, res) => {
  res.json({ version: APP_VERSION, repo: APP_REPO, channel: APP_CHANNEL });
});

// Pin verification
app.post('/api/pin/verify', (req,res)=>{
  const { pin } = req.body || {};
  if (typeof pin === 'string' && verifyPinValue(db, pin)) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Wrong Pin' });
});

// Years
app.get('/api/years', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const years = db.prepare('SELECT year FROM years ORDER BY year ASC').all().map(r=>r.year);
  res.json({ years });
});
app.get('/api/years/exists', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const c = db.prepare('SELECT COUNT(1) c FROM years').get().c;
  res.json({ hasAny: c > 0 });
});
app.post('/api/years', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { year } = req.body;
  if (!Number.isInteger(year) || String(year).length !== 4) return res.status(400).json({ error: 'Invalid year' });
  try {
    db.prepare('INSERT INTO years(year) VALUES (?)').run(year);
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Year already in database' });
    throw e;
  }
});
app.delete('/api/years', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { years } = req.body;
  if (!Array.isArray(years) || years.length===0) return res.status(400).json({ error: 'No years provided' });
  const found = db.prepare(`SELECT id, year FROM years WHERE year IN (${years.map(()=>'?').join(',')})`).all(...years);
  const ids = found.map(x=>x.id);
  if (ids.length) {
    db.prepare(`DELETE FROM entries WHERE year_id IN (${ids.map(()=>'?').join(',')})`).run(...ids);

    const goals = db
      .prepare(`SELECT id FROM savings_goals WHERE year_id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids);
    const goalIds = goals.map((g) => g.id);
    if (goalIds.length) {
      db.prepare(`DELETE FROM savings_items WHERE goal_id IN (${goalIds.map(() => '?').join(',')})`).run(...goalIds);
      db.prepare(`DELETE FROM savings_goals WHERE id IN (${goalIds.map(() => '?').join(',')})`).run(...goalIds);
    }

    db.prepare(`DELETE FROM years WHERE id IN (${ids.map(()=>'?').join(',')})`).run(...ids);
  }
  res.json({ ok: true, removedYears: found.map(x=>x.year) });
});

// Entries
app.get('/api/entries', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { type, year } = req.query;
  if (!['income','expense'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const y = Number(year);
  if (!Number.isInteger(y)) return res.status(400).json({ error: 'Invalid year' });
  const yr = db.prepare('SELECT id FROM years WHERE year=?').get(y);
  if (!yr) return res.json({ entries: [] });
  const rows = db.prepare(
    `SELECT id, name, comment, sort_index, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, "Dec" as Decm
     FROM entries WHERE type=? AND year_id=? ORDER BY sort_index, id`
  ).all(type, yr.id);
  const decrypted = rows.map((row)=>({
    ...row,
    Jan: decryptToNumber(row.Jan),
    Feb: decryptToNumber(row.Feb),
    Mar: decryptToNumber(row.Mar),
    Apr: decryptToNumber(row.Apr),
    May: decryptToNumber(row.May),
    Jun: decryptToNumber(row.Jun),
    Jul: decryptToNumber(row.Jul),
    Aug: decryptToNumber(row.Aug),
    Sep: decryptToNumber(row.Sep),
    Oct: decryptToNumber(row.Oct),
    Nov: decryptToNumber(row.Nov),
    Decm: decryptToNumber(row.Decm),
  }));
  res.json({ entries: decrypted });
});
app.post('/api/entries', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { type, year, name } = req.body;
  if (!['income','expense'].includes(type) || !name) return res.status(400).json({ error: 'Invalid payload' });
  const yr = db.prepare('SELECT id FROM years WHERE year=?').get(year);
  if (!yr) return res.status(404).json({ error: 'Year not found' });
  const mx = db.prepare('SELECT COALESCE(MAX(sort_index),0) mx FROM entries WHERE year_id=? AND type=?').get(yr.id, type).mx;
  const monthColumnsSql = MONTH_COLUMNS.map((col) => (col === 'Dec' ? '"Dec"' : col)).join(', ');
  const monthPlaceholders = MONTH_COLUMNS.map(() => '?').join(', ');
  const zeroValues = MONTH_COLUMNS.map(() => encryptNumber(0));
  const stmt = db.prepare(
    `INSERT INTO entries(type,name,year_id,sort_index,${monthColumnsSql}) VALUES (?,?,?,?,${monthPlaceholders})`
  );
  const info = stmt.run(type, name, yr.id, mx + 1, ...zeroValues);
  res.json({ ok: true, id: info.lastInsertRowid });
});

const normalizeMonth = (month) => {
  if (typeof month !== 'string') return null;
  const match = MONTH_COLUMNS.find((m) => m.toLowerCase() === month.toLowerCase());
  return match ?? null;
};

app.get('/api/tags', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const y = Number(req.query.year);
  if (!Number.isInteger(y)) return res.status(400).json({ error: 'Invalid year' });
  const rows = db.prepare(
    `SELECT t.id, t.entry_id as entryId, t.month, t.color, t.text
     FROM entry_tags t
     JOIN entries e ON e.id = t.entry_id
     JOIN years y ON y.id = e.year_id
     WHERE y.year=?`
  ).all(y);
  res.json({ tags: rows });
});

app.post('/api/tags', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { entryId, month, color, text } = req.body || {};
  if (!Number.isInteger(entryId)) return res.status(400).json({ error: 'Invalid entryId' });
  const normalizedMonth = normalizeMonth(month);
  if (!normalizedMonth) return res.status(400).json({ error: 'Invalid month' });
  if (typeof color !== 'string' || !TAG_COLORS.has(color)) return res.status(400).json({ error: 'Invalid color' });
  const entry = db.prepare('SELECT id FROM entries WHERE id=?').get(entryId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const tagText = clampText(text ?? '', 200);
  db.prepare(
    `INSERT INTO entry_tags(entry_id, month, color, text, created_at, updated_at)
     VALUES (@entryId, @month, @color, @text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(entry_id, month)
     DO UPDATE SET color=excluded.color, text=excluded.text, updated_at=CURRENT_TIMESTAMP`
  ).run({ entryId, month: normalizedMonth, color, text: tagText });
  res.json({ ok: true });
});

app.delete('/api/tags', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const entryId = Number(req.query.entryId);
  const normalizedMonth = normalizeMonth(req.query.month);
  if (!Number.isInteger(entryId)) return res.status(400).json({ error: 'Invalid entryId' });
  if (!normalizedMonth) return res.status(400).json({ error: 'Invalid month' });
  db.prepare('DELETE FROM entry_tags WHERE entry_id=? AND month=?').run(entryId, normalizedMonth);
  res.json({ ok: true });
});
app.patch('/api/entries/:id', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { id } = req.params;
  const payload = req.body || {};
  const fields = ['name','comment','sort_index','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sets = [], vals = [];
  for (const f of fields) if (f in payload) {
    const col = (f==='Dec') ? '"Dec"' : f;
    let value = payload[f];
    if (['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].includes(f)) {
      value = encryptNumber(value);
    }
    sets.push(`${col}=?`);
    vals.push(value);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(id);
  const info = db.prepare(`UPDATE entries SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json({ ok: true, updated: info.changes });
});
app.delete('/api/entries', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length===0) return res.status(400).json({ error: 'No ids' });
  const info = db.prepare(`DELETE FROM entries WHERE id IN (${ids.map(()=>'?').join(',')})`).run(...ids);
  res.json({ ok: true, removed: info.changes });
});
app.post('/api/entries/reorder', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });
  const stmt = db.prepare('UPDATE entries SET sort_index=? WHERE id=?');
  let i = 1;
  const tx = db.transaction(list => { for (const id of list) stmt.run(i++, id); });
  tx(orderedIds);
  res.json({ ok: true });
});

// Savings
app.get('/api/savings', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { year } = req.query;
  const yr = getYearRow(year);
  if (!yr) {
    if (!Number.isInteger(Number(year))) return res.status(400).json({ error: 'Invalid year' });
    return res.json({ goals: [] });
  }
  const goals = db
    .prepare('SELECT id, name, target_value AS targetValue, sort_index FROM savings_goals WHERE year_id=? ORDER BY sort_index, id')
    .all(yr.id);
  const goalIds = goals.map((g)=>g.id);
  const items = goalIds.length
    ? db
        .prepare(
          `SELECT id, goal_id AS goalId, name, value, sort_index
           FROM savings_items
           WHERE goal_id IN (${goalIds.map(()=>'?').join(',')})
           ORDER BY sort_index, id`
        )
        .all(...goalIds)
    : [];
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.goalId)) grouped.set(item.goalId, []);
    grouped.get(item.goalId).push({
      id: item.id,
      goalId: item.goalId,
      name: item.name ?? '',
      value: item.value,
      sortIndex: item.sort_index ?? item.sortIndex ?? 0,
    });
  }
  const response = goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetValue: goal.targetValue == null ? null : decryptToNumber(goal.targetValue),
    sortIndex: goal.sort_index ?? goal.sortIndex ?? 0,
    items: (grouped.get(goal.id) ?? []).map(item => ({
      ...item,
      value: decryptToNumber(item.value),
    })),
  }));
  res.json({ goals: response });
});

app.post('/api/savings', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { year, name, targetValue } = req.body || {};
  const yr = getYearRow(year);
  if (!yr) return res.status(400).json({ error: 'Invalid or unknown year' });
  const trimmedName = clampText(name, 80);
  if (!trimmedName) return res.status(400).json({ error: 'Goal name required' });
  let target = null;
  if (targetValue !== undefined && targetValue !== null && targetValue !== '') {
    const n = Number(targetValue);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'Invalid target value' });
    target = encryptNumber(n);
  }
  const mx = db
    .prepare('SELECT COALESCE(MAX(sort_index), 0) AS mx FROM savings_goals WHERE year_id=?')
    .get(yr.id).mx;
  const info = db
    .prepare('INSERT INTO savings_goals(year_id, name, target_value, sort_index) VALUES (?,?,?,?)')
    .run(yr.id, trimmedName, target, Number(mx ?? 0) + 1);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.patch('/api/savings/:goalId', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { goalId } = req.params;
  const payload = req.body || {};
  const sets = [];
  const vals = [];
  if (typeof payload.name === 'string') {
    const trimmed = clampText(payload.name, 80);
    if (!trimmed) return res.status(400).json({ error: 'Goal name required' });
    sets.push('name=?');
    vals.push(trimmed);
  }
  if ('targetValue' in payload) {
    if (payload.targetValue === null || payload.targetValue === '') {
      sets.push('target_value=?');
      vals.push(null);
    } else {
      const num = Number(payload.targetValue);
      if (!Number.isFinite(num)) return res.status(400).json({ error: 'Invalid target value' });
      sets.push('target_value=?');
      vals.push(encryptNumber(num));
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(goalId);
  const info = db.prepare(`UPDATE savings_goals SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json({ ok: true, updated: info.changes });
});

app.delete('/api/savings/:goalId', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { goalId } = req.params;
  const info = db.prepare('DELETE FROM savings_goals WHERE id=?').run(goalId);
  res.json({ ok: true, removed: info.changes });
});

app.post('/api/savings/:goalId/items', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { goalId } = req.params;
  const goal = db.prepare('SELECT id FROM savings_goals WHERE id=?').get(goalId);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const { name = '', value = 0 } = req.body || {};
  const trimmedName = clampText(name, 80);
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return res.status(400).json({ error: 'Invalid value' });
  const mx = db.prepare('SELECT COALESCE(MAX(sort_index),0) AS mx FROM savings_items WHERE goal_id=?').get(goalId)
    .mx;
  const info = db
    .prepare('INSERT INTO savings_items(goal_id, name, value, sort_index) VALUES (?,?,?,?)')
    .run(goalId, trimmedName || null, encryptNumber(numericValue), Number(mx ?? 0) + 1);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.patch('/api/savings/items/:itemId', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { itemId } = req.params;
  const payload = req.body || {};
  const sets = [];
  const vals = [];
  if ('name' in payload) {
    const trimmed = clampText(payload.name, 80);
    sets.push('name=?');
    vals.push(trimmed || null);
  }
  if ('value' in payload) {
    const num = Number(payload.value);
    if (!Number.isFinite(num)) return res.status(400).json({ error: 'Invalid value' });
    sets.push('value=?');
    vals.push(encryptNumber(num));
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(itemId);
  const info = db.prepare(`UPDATE savings_items SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json({ ok: true, updated: info.changes });
});

app.delete('/api/savings/items/:itemId', (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { itemId } = req.params;
  const info = db.prepare('DELETE FROM savings_items WHERE id=?').run(itemId);
  res.json({ ok: true, removed: info.changes });
});

// Export
app.post('/api/export', async (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { years } = req.body;
  if (!Array.isArray(years) || years.length===0) return res.status(400).json({ error: 'No years' });
  const wb = await exportYearsToWorkbook(years);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="mopay_export.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

app.get('/api/import/template', async (_req,res)=>{
  if (guardKeyMismatch(res)) return;
  const wb = await exportImportTemplateWorkbook();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="mopay_import_template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

app.post('/api/import/validate', async (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { name, data } = req.body || {};
  if (name !== 'mopay_import_template.xlsx') {
    return res.status(400).json({ ok: false, error: 'INVALID_NAME' });
  }
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ ok: false, error: 'MISSING_DATA' });
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    const sheets = await parseImportWorkbook(buffer);
    const years = sheets.map(({ year }) => year);
    const existing = years.length
      ? db.prepare(`SELECT year FROM years WHERE year IN (${years.map(() => '?').join(',')})`).all(...years)
      : [];
    const existingSet = new Set(existing.map((row) => row.year));
    res.json({
      ok: true,
      years: years.map((year) => ({ year, exists: existingSet.has(year) })),
    });
  } catch (err) {
    console.error('Import template validation failed', err);
    res.status(400).json({ ok: false, error: 'INVALID_FILE' });
  }
});

app.post('/api/import', async (req,res)=>{
  if (guardKeyMismatch(res)) return;
  const { name, data, overwriteYears } = req.body || {};
  if (name !== 'mopay_import_template.xlsx') {
    return res.status(400).json({ ok: false, error: 'INVALID_NAME' });
  }
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ ok: false, error: 'MISSING_DATA' });
  }
  const overwriteSet = new Set(
    Array.isArray(overwriteYears)
      ? overwriteYears.map((year) => Number(year)).filter((year) => Number.isInteger(year))
      : []
  );

  try {
    const buffer = Buffer.from(data, 'base64');
    const sheets = await parseImportWorkbook(buffer);
    const years = sheets.map(({ year }) => year);
    const existing = years.length
      ? db.prepare(`SELECT year FROM years WHERE year IN (${years.map(() => '?').join(',')})`).all(...years)
      : [];
    const existingSet = new Set(existing.map((row) => row.year));

    const results = {
      imported: [],
      skipped: [],
      overwritten: [],
    };

    const importTx = db.transaction(() => {
      for (const { year, sheet } of sheets) {
        const exists = existingSet.has(year);
        const shouldOverwrite = overwriteSet.has(year);
        if (exists && !shouldOverwrite) {
          results.skipped.push(year);
          continue;
        }

        let yearRow = getYearRow(year);
        if (exists && yearRow && shouldOverwrite) {
          clearYearData(yearRow.id);
          results.overwritten.push(year);
        }
        if (!yearRow) {
          db.prepare('INSERT INTO years(year) VALUES (?)').run(year);
          yearRow = getYearRow(year);
        }
        if (!yearRow) throw new Error('YEAR_CREATE_FAILED');

        const entries = [
          ...parseEntriesSection(sheet, 'Incomes', 'income', yearRow.id),
          ...parseEntriesSection(sheet, 'Expenses', 'expense', yearRow.id),
        ];
        const monthColumnsSql = MONTH_COLUMNS.map((col) => (col === 'Dec' ? '"Dec"' : col)).join(', ');
        const monthPlaceholders = MONTH_COLUMNS.map(() => '?').join(', ');
        const insertEntry = db.prepare(
          `INSERT INTO entries(type,name,year_id,comment,${monthColumnsSql},sort_index)
           VALUES (?,?,?, ?, ${monthPlaceholders}, ?)`
        );
        let sortIndex = 0;
        for (const entry of entries) {
          const months = entry.months.map((value) => encryptNumber(value));
          insertEntry.run(
            entry.type,
            entry.name,
            entry.yearId,
            entry.comment || null,
            ...months,
            sortIndex
          );
          sortIndex += 1;
        }

        const goals = parseSavingsSection(sheet);
        const insertGoal = db.prepare(
          'INSERT INTO savings_goals(year_id, name, target_value, sort_index) VALUES (?,?,?,?)'
        );
        const insertItem = db.prepare(
          'INSERT INTO savings_items(goal_id, name, value, sort_index) VALUES (?,?,?,?)'
        );
        goals.forEach((goal, goalIndex) => {
          const info = insertGoal.run(
            yearRow.id,
            goal.name,
            encryptNumber(goal.targetValue),
            goalIndex
          );
          const goalId = info.lastInsertRowid;
          goal.items.forEach((item, itemIndex) => {
            insertItem.run(goalId, item.name || null, encryptNumber(item.value), itemIndex);
          });
        });

        results.imported.push(year);
      }
    });

    importTx();
    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('Import failed', err);
    res.status(400).json({ ok: false, error: 'IMPORT_FAILED' });
  }
});

// Encryption status for migration notice
app.get('/api/encryption/status', (_req,res)=>{
  const migrated = db.prepare("SELECT value FROM meta WHERE key='enc_migrated'").get();
  const notice = db.prepare("SELECT value FROM meta WHERE key='enc_notice_pending'").get();
  res.json({
    encryptionEnabled: true,
    migrationRan: migrated?.value === '1',
    showNotice: notice?.value === '1',
    keyMismatch,
  });
});

app.post('/api/encryption/notice-ack', (_req,res)=>{
  db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('enc_notice_pending','0')").run();
  res.json({ ok: true });
});

app.post('/api/encryption/reset', (req,res)=>{
  if (!keyMismatch) return res.status(400).json({ error: 'Reset not available', message: 'Encryption key mismatch not detected.' });
  const { confirm } = req.body || {};
  if (confirm !== true) {
    return res.status(400).json({ error: 'ConfirmationRequired', message: 'Reset confirmation flag is required.' });
  }
  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM entries').run();
    db.prepare('DELETE FROM savings_items').run();
    db.prepare('DELETE FROM savings_goals').run();
    db.prepare('DELETE FROM years').run();
    setMetaValue('enc_migrated', '1');
    setMetaValue('enc_notice_pending', '0');
    setMetaValue('enc_key_mismatch', '0');
    setMetaValue('enc_key_fingerprint', KEY_FINGERPRINT);
  });
  resetTx();
  keyMismatch = false;
  console.warn('All Mopay data has been deleted after encryption key reset confirmation.');
  res.json({ ok: true });
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req,res)=> res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, ()=> console.log('Mopay app listening on :' + PORT));
