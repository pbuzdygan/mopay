import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { exportYearsToWorkbook } from './export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8010);
const APP_PIN = process.env.APP_PIN || '';

const clampText = (value, max = 80) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const getYearRow = (yearValue) => {
  const numericYear = Number(yearValue);
  if (!Number.isInteger(numericYear)) return null;
  return db.prepare('SELECT id FROM years WHERE year=?').get(numericYear);
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (_req,res)=> res.json({ status: 'ok' }));

// Pin verification (auto-pass if APP_PIN empty)
app.post('/api/pin/verify', (req,res)=>{
  const { pin } = req.body || {};
  if (!APP_PIN) return res.json({ ok: true });
  if (typeof pin === 'string' && pin === APP_PIN && pin.length >= 4 && pin.length <= 8) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Wrong Pin' });
});

// Years
app.get('/api/years', (req,res)=>{
  const years = db.prepare('SELECT year FROM years ORDER BY year ASC').all().map(r=>r.year);
  res.json({ years });
});
app.get('/api/years/exists', (req,res)=>{
  const c = db.prepare('SELECT COUNT(1) c FROM years').get().c;
  res.json({ hasAny: c > 0 });
});
app.post('/api/years', (req,res)=>{
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
  res.json({ entries: rows });
});
app.post('/api/entries', (req,res)=>{
  const { type, year, name } = req.body;
  if (!['income','expense'].includes(type) || !name) return res.status(400).json({ error: 'Invalid payload' });
  const yr = db.prepare('SELECT id FROM years WHERE year=?').get(year);
  if (!yr) return res.status(404).json({ error: 'Year not found' });
  const mx = db.prepare('SELECT COALESCE(MAX(sort_index),0) mx FROM entries WHERE year_id=? AND type=?').get(yr.id, type).mx;
  const info = db.prepare('INSERT INTO entries(type,name,year_id,sort_index) VALUES (?,?,?,?)').run(type, name, yr.id, mx+1);
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.patch('/api/entries/:id', (req,res)=>{
  const { id } = req.params;
  const payload = req.body || {};
  const fields = ['name','comment','sort_index','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sets = [], vals = [];
  for (const f of fields) if (f in payload) {
    const col = (f==='Dec') ? '"Dec"' : f;
    sets.push(`${col}=?`);
    vals.push(payload[f]);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(id);
  const info = db.prepare(`UPDATE entries SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json({ ok: true, updated: info.changes });
});
app.delete('/api/entries', (req,res)=>{
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length===0) return res.status(400).json({ error: 'No ids' });
  const info = db.prepare(`DELETE FROM entries WHERE id IN (${ids.map(()=>'?').join(',')})`).run(...ids);
  res.json({ ok: true, removed: info.changes });
});
app.post('/api/entries/reorder', (req,res)=>{
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
      value: Number(item.value ?? 0),
      sortIndex: item.sort_index ?? item.sortIndex ?? 0,
    });
  }
  const response = goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetValue: goal.targetValue == null ? null : Number(goal.targetValue),
    sortIndex: goal.sort_index ?? goal.sortIndex ?? 0,
    items: grouped.get(goal.id) ?? [],
  }));
  res.json({ goals: response });
});

app.post('/api/savings', (req,res)=>{
  const { year, name, targetValue } = req.body || {};
  const yr = getYearRow(year);
  if (!yr) return res.status(400).json({ error: 'Invalid or unknown year' });
  const trimmedName = clampText(name, 80);
  if (!trimmedName) return res.status(400).json({ error: 'Goal name required' });
  let target = null;
  if (targetValue !== undefined && targetValue !== null && targetValue !== '') {
    const n = Number(targetValue);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'Invalid target value' });
    target = n;
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
      vals.push(num);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(goalId);
  const info = db.prepare(`UPDATE savings_goals SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json({ ok: true, updated: info.changes });
});

app.delete('/api/savings/:goalId', (req,res)=>{
  const { goalId } = req.params;
  const info = db.prepare('DELETE FROM savings_goals WHERE id=?').run(goalId);
  res.json({ ok: true, removed: info.changes });
});

app.post('/api/savings/:goalId/items', (req,res)=>{
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
    .run(goalId, trimmedName || null, numericValue, Number(mx ?? 0) + 1);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.patch('/api/savings/items/:itemId', (req,res)=>{
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
    vals.push(num);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(itemId);
  const info = db.prepare(`UPDATE savings_items SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json({ ok: true, updated: info.changes });
});

app.delete('/api/savings/items/:itemId', (req,res)=>{
  const { itemId } = req.params;
  const info = db.prepare('DELETE FROM savings_items WHERE id=?').run(itemId);
  res.json({ ok: true, removed: info.changes });
});

// Export
app.post('/api/export', async (req,res)=>{
  const { years } = req.body;
  if (!Array.isArray(years) || years.length===0) return res.status(400).json({ error: 'No years' });
  const wb = await exportYearsToWorkbook(years);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="mopay_export.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req,res)=> res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, ()=> console.log('Mopay app listening on :' + PORT));
