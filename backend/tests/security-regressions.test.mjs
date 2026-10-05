import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
let root, child, db, origin, token;
let logs = '';
let entryId, targetGroupId, incomeGroupId, otherYearGroupId, goalId;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function request(endpoint, { method = 'GET', body, raw, auth = true } = {}) {
  const headers = {};
  if (auth && token) headers['X-Mopay-Session'] = token;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(origin + endpoint, {
    method, headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    signal: AbortSignal.timeout(5000),
  });
}

async function json(endpoint, options) {
  const response = await request(endpoint, options);
  return { status: response.status, body: await response.json() };
}

async function create(endpoint, body) {
  const result = await json(endpoint, { method: 'POST', body });
  assert.equal(result.status, 200);
  return result.body.id;
}

const entrySnapshot = () => db.prepare('SELECT * FROM entries ORDER BY id').all();
const savingsSnapshot = () => db.prepare('SELECT * FROM savings_items ORDER BY id').all();

async function assertAlive() {
  assert.equal(child.exitCode, null, 'Backend process remains alive');
  const response = await request('/health', { auth: false });
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  assert.equal((await json('/api/years')).status, 200);
}

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mopay-regression-'));
  for (const file of await fs.readdir(backend)) {
    if (/\.(js|sql)$/.test(file) || file === 'package.json') {
      await fs.copyFile(path.join(backend, file), path.join(root, file));
    }
  }
  await fs.symlink(path.join(backend, 'node_modules'), path.join(root, 'node_modules'));
  // Only the disposable copy's binding changes; real route/middleware code runs.
  const source = await fs.readFile(path.join(root, 'server.js'), 'utf8');
  assert.equal(source.split('app.listen(PORT,').length, 2);
  await fs.writeFile(path.join(root, 'server.js'), source.replace('app.listen(PORT,', "app.listen(PORT, '127.0.0.1',"));
  const workerSource = await fs.readFile(path.join(root, 'importWorker.js'), 'utf8');
  await fs.writeFile(path.join(root, 'importWorker.js'), `
import { existsSync, writeFileSync } from 'node:fs';
if (existsSync('./parse-timeout.flag')) await new Promise(resolve => setTimeout(resolve, 1000));
if (existsSync('./parse-delay.flag')) {
  writeFileSync('./parse-started.flag', 'started');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
` + workerSource);
  const parserSource = await fs.readFile(path.join(root, 'importParser.js'), 'utf8');
  await fs.writeFile(path.join(root, 'importParser.js'),
    "import { existsSync as fixtureTimeout } from 'node:fs';\n" +
    parserSource.replace('timeoutMs = limits.timeoutMs', "timeoutMs = fixtureTimeout('./parse-timeout.flag') ? 50 : limits.timeoutMs"));

  // Inject dependency faults only in this fixture, retaining the real exporter
  // for successful downloads. The production server is never patched for faults.
  await fs.rename(path.join(root, 'export.js'), path.join(root, 'original-export.js'));
  await fs.writeFile(path.join(root, 'export.js'), `
import { readFileSync, existsSync } from 'node:fs';
import * as original from './original-export.js';
function fault(kind) {
  if (!existsSync('./download-fault.json')) return null;
  const value = JSON.parse(readFileSync('./download-fault.json', 'utf8'));
  return value.kind === kind ? value.mode : null;
}
async function workbook(kind, args) {
  const mode = fault(kind);
  if (mode === 'build') throw new Error('Synthetic workbook build failure');
  if (mode === 'busy') throw Object.assign(new Error('Synthetic lock'), { code: 'SQLITE_BUSY' });
  const wb = await original[kind](...args);
  if (mode === 'write' || mode === 'partial') {
    wb.xlsx.write = async (response) => {
      if (mode === 'partial') response.write('synthetic partial XLSX');
      throw new Error('Synthetic workbook write failure');
    };
  }
  return wb;
}
export const exportYearsToWorkbook = (...args) => workbook('exportYearsToWorkbook', args);
export const exportImportTemplateWorkbook = (...args) => workbook('exportImportTemplateWorkbook', args);
`);

  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  const pin = String(randomInt(10000000, 99999999));
  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    // Do not inherit local secrets, databases or webhook integrations.
    env: {
      PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port),
      DB_FILE: path.join(root, 'fixture.sqlite'),
      APP_PIN: pin, APP_ENC_KEY: randomBytes(32).toString('base64'),
      APP_PIN_MIN_RESPONSE_MS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, 'Fixture starts without exiting');
    try {
      const response = await request('/health', { auth: false });
      ready = response.ok;
      await response.arrayBuffer();
    } catch (error) {
      if (error.cause?.code !== 'ECONNREFUSED') throw error;
    }
    if (ready) break;
    await delay(50);
  }
  assert.ok(ready, 'Loopback fixture becomes ready');
  const login = await json('/api/pin/verify', { method: 'POST', body: { pin }, auth: false });
  assert.equal(login.status, 200);
  token = login.body.sessionToken;
  assert.ok(token);
  db = new Database(path.join(root, 'fixture.sqlite'));
  await create('/api/years', { year: 2026 });
  await create('/api/years', { year: 2027 });
  const sourceGroupId = await create('/api/entry-groups', { year: 2026, type: 'expense', name: 'Source' });
  targetGroupId = await create('/api/entry-groups', { year: 2026, type: 'expense', name: 'Target' });
  incomeGroupId = await create('/api/entry-groups', { year: 2026, type: 'income', name: 'Income' });
  otherYearGroupId = await create('/api/entry-groups', { year: 2027, type: 'expense', name: 'Other year' });
  entryId = await create('/api/entries', { year: 2026, type: 'expense', name: 'Synthetic entry', groupId: sourceGroupId });
  await create('/api/entries', { year: 2026, type: 'expense', name: 'Source neighbour', groupId: sourceGroupId });
  await create('/api/entries', { year: 2026, type: 'expense', name: 'Target neighbour', groupId: targetGroupId });
  goalId = await create('/api/savings', { year: 2026, name: 'Synthetic goal', targetValue: 100 });
}, { timeout: 15000 });

after(async () => {
  db?.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
  if (root) await fs.rm(root, { recursive: true, force: true });
  if (token) assert.ok(!logs.includes(token), 'Session tokens are absent from server logs');
});

test('protected changed routes deny anonymous requests before parsing', async () => {
  const beforeEntries = entrySnapshot();
  const beforeSavings = savingsSnapshot();
  for (const [endpoint, method] of [
    ['/api/export', 'POST'], ['/api/import/template', 'GET'],
    ['/api/import', 'POST'], ['/api/import/validate', 'POST'],
    [`/api/entries/${entryId}`, 'PATCH'], [`/api/savings/${goalId}/items`, 'POST'],
  ]) {
    const result = await json(endpoint, { method, auth: false, ...(method === 'GET' ? {} : { raw: '{' }) });
    assert.equal(result.status, 401);
  }
  assert.deepEqual(entrySnapshot(), beforeEntries);
  assert.deepEqual(savingsSnapshot(), beforeSavings);
});

test('malformed and bounded export inputs return 400 without terminating backend', async () => {
  for (const body of [undefined, {}, { years: [] }, { years: '2026' },
    ...[{}, null, '2026', true, 2026.5, 999, 10000].map(year => ({ years: [year] })),
    { years: Array(101).fill(2026) },
  ]) {
    assert.equal((await json('/api/export', { method: 'POST', body })).status, 400);
  }
  assert.deepEqual(await json('/api/export', { method: 'POST', raw: '{' }), {
    status: 400, body: { ok: false, error: 'INVALID_JSON' },
  });
  await assertAlive();
});

test('export deduplicates valid years and template remains a readable XLSX', async () => {
  const response = await request('/api/export', { method: 'POST', body: { years: Array(100).fill(2026) } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /mopay_export.xlsx/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['2026']);
  const template = await request('/api/import/template');
  assert.equal(template.status, 200);
  assert.match(template.headers.get('content-disposition'), /mopay_import_template.xlsx/);
  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
  assert.equal(templateWorkbook.worksheets[0].name, 'YYYY');
  templateWorkbook.worksheets[0].name = '2028';
  const data = Buffer.from(await templateWorkbook.xlsx.writeBuffer()).toString('base64');
  const validated = await json('/api/import/validate', {
    method: 'POST', body: { name: 'mopay_import_template.xlsx', data },
  });
  assert.equal(validated.status, 200);
  assert.deepEqual(validated.body.years, [{ year: 2028, exists: false }]);
});

test('download build/write failures return safe errors; partial streams abort without crashing', async () => {
  for (const [kind, endpoint, options] of [
    ['exportYearsToWorkbook', '/api/export', { method: 'POST', body: { years: [2026] } }],
    ['exportImportTemplateWorkbook', '/api/import/template', {}],
  ]) {
    for (const mode of ['build', 'write', 'busy', 'partial']) {
      await fs.writeFile(path.join(root, 'download-fault.json'), JSON.stringify({ kind, mode }));
      try {
        if (mode === 'partial') {
          await assert.rejects(async () => {
            const response = await request(endpoint, options);
            await response.arrayBuffer();
          }, /terminated|fetch failed/);
        } else {
          const result = await json(endpoint, options);
          assert.equal(result.status, mode === 'busy' ? 503 : 500);
          if (mode !== 'busy') assert.deepEqual(result.body, { ok: false, error: 'INTERNAL_ERROR' });
          assert.ok(!JSON.stringify(result.body).includes('Synthetic'));
        }
        await assertAlive();
      } finally {
        await fs.unlink(path.join(root, 'download-fault.json'));
      }
    }
  }
});

test('invalid entry fields and incompatible groups leave all rows and order unchanged', async () => {
  for (const fields of [{ name: 123 }, { name: ' ' }, { comment: {} }, { sort_index: -1 }, { Jan: 'Infinity' }]) {
    const before = entrySnapshot();
    const result = await json(`/api/entries/${entryId}`, { method: 'PATCH', body: { groupId: targetGroupId, ...fields } });
    assert.equal(result.status, 400);
    assert.deepEqual(entrySnapshot(), before);
  }
  for (const groupId of [incomeGroupId, otherYearGroupId, 999999]) {
    const before = entrySnapshot();
    assert.equal((await json(`/api/entries/${entryId}`, { method: 'PATCH', body: { groupId, name: 'Changed' } })).status, 404);
    assert.deepEqual(entrySnapshot(), before);
  }
});

test('database failure rolls back group, normalized neighbour order and fields', async () => {
  // Leave intentional gaps so group normalization would visibly alter neighbours.
  db.prepare('UPDATE entries SET sort_index=id * 10').run();
  const before = entrySnapshot();
  db.exec(`CREATE TRIGGER fixture_reject_name BEFORE UPDATE OF name ON entries
    WHEN NEW.name='Synthetic database failure'
    BEGIN SELECT RAISE(ABORT, 'Synthetic transaction failure'); END`);
  try {
    const result = await json(`/api/entries/${entryId}`, {
      method: 'PATCH', body: { groupId: targetGroupId, name: 'Synthetic database failure', Jan: 10 },
    });
    assert.deepEqual(result, { status: 500, body: { ok: false, error: 'INTERNAL_ERROR' } });
    assert.deepEqual(entrySnapshot(), before);
    await assertAlive();
  } finally {
    db.exec('DROP TRIGGER fixture_reject_name');
  }
});

test('valid entry patch moves, normalizes, saves encrypted amount and can ungroup', async () => {
  const result = await json(`/api/entries/${entryId}`, {
    method: 'PATCH', body: { groupId: targetGroupId, name: ' Renamed ', comment: ' Note ', Jan: 123.45 },
  });
  assert.deepEqual(result, { status: 200, body: { ok: true, updated: 1 } });
  const entries = (await json('/api/entries?type=expense&year=2026')).body.entries;
  const entry = entries.find(row => row.id === entryId);
  assert.equal(entry.groupId, targetGroupId);
  assert.equal(entry.name, 'Renamed');
  assert.equal(entry.comment, 'Note');
  assert.equal(entry.Jan, 123.45);
  assert.match(String(db.prepare('SELECT Jan FROM entries WHERE id=?').get(entryId).Jan), /^enc:/);
  const targetOrder = db.prepare('SELECT sort_index FROM entries WHERE group_id=? ORDER BY sort_index').all(targetGroupId);
  assert.deepEqual(targetOrder.map(row => row.sort_index), [1, 2]);
  const ungroup = await json(`/api/entries/${entryId}`, { method: 'PATCH', body: { group_id: null } });
  assert.deepEqual(ungroup, { status: 200, body: { ok: true, updated: 1 } });
  assert.equal(db.prepare('SELECT group_id FROM entries WHERE id=?').get(entryId).group_id, null);
  assert.equal((await json(`/api/entries/${entryId}`, { method: 'PATCH', body: {} })).status, 400);
  assert.equal((await json(`/api/entries/${entryId}`, { method: 'PATCH', body: { groupId: null } })).status, 400);
});

test('non-finite savings creation/update cannot write; finite amounts retain their values', async () => {
  for (const value of ['Infinity', '-Infinity', '1e309', 'NaN', 'invalid']) {
    const before = savingsSnapshot();
    assert.equal((await json(`/api/savings/${goalId}/items`, { method: 'POST', body: { name: 'Invalid', value } })).status, 400);
    assert.deepEqual(savingsSnapshot(), before);
  }
  // A JSON numeric exponent can also decode to Infinity on the server.
  const before = savingsSnapshot();
  assert.equal((await json(`/api/savings/${goalId}/items`, { method: 'POST', raw: '{"value":1e309}' })).status, 400);
  assert.deepEqual(savingsSnapshot(), before);
  for (const value of [0, -12.5, 125.75, '25.5']) {
    const id = await create(`/api/savings/${goalId}/items`, { name: 'Valid', value });
    const goals = (await json('/api/savings?year=2026')).body.goals;
    assert.equal(goals.find(goal => goal.id === goalId).items.find(item => item.id === id).value, Number(value));
    assert.match(String(db.prepare('SELECT value FROM savings_items WHERE id=?').get(id).value), /^enc:/);
    const unchanged = savingsSnapshot();
    assert.equal((await json(`/api/savings/items/${id}`, { method: 'PATCH', body: { name: 'Invalid update', value: 'Infinity' } })).status, 400);
    assert.deepEqual(savingsSnapshot(), unchanged);
    assert.equal((await json(`/api/savings/items/${id}`, { method: 'PATCH', body: { value: -3.5 } })).status, 200);
    const updated = (await json('/api/savings?year=2026')).body.goals.find(goal => goal.id === goalId);
    assert.equal(updated.items.find(item => item.id === id).value, -3.5);
  }
});

async function importFixture() {
  const response = await request('/api/import/template');
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  workbook.worksheets[0].name = '2028';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('both import endpoints reject excess expanded data without changing existing rows', async () => {
  const zip = await JSZip.loadAsync(await importFixture());
  zip.file('xl/media/padding.bin', Buffer.alloc(4 * 1024 * 1024 + 1, 65));
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const before = entrySnapshot();
  const years = db.prepare('SELECT * FROM years ORDER BY id').all();
  for (const endpoint of ['/api/import/validate', '/api/import']) {
    const result = await json(endpoint, {
      method: 'POST', body: { name: 'mopay_import_template.xlsx', data: buffer.toString('base64'), overwriteYears: [2026] },
    });
    assert.equal(result.status, 413);
    assert.equal(result.body.error, 'IMPORT_LIMIT_EXCEEDED');
    assert.deepEqual(entrySnapshot(), before);
    assert.deepEqual(db.prepare('SELECT * FROM years ORDER BY id').all(), years);
  }
  await assertAlive();
});

test('validation and import share admission; health remains responsive and slot recovers', async () => {
  const data = (await importFixture()).toString('base64');
  const body = { name: 'mopay_import_template.xlsx', data };
  await fs.writeFile(path.join(root, 'parse-delay.flag'), 'delay');
  let first;
  try {
    first = json('/api/import/validate', { method: 'POST', body });
    let started = false;
    for (let i = 0; i < 100; i++) {
      try {
        await fs.access(path.join(root, 'parse-started.flag'));
        started = true;
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await delay(10);
    }
    assert.ok(started, 'Fixture signals that worker has started');
    for (const endpoint of ['/api/import/validate', '/api/import']) {
      const response = await request(endpoint, { method: 'POST', body });
      assert.equal(response.status, 429);
      assert.equal(response.headers.get('retry-after'), '1');
      assert.equal((await response.json()).error, 'IMPORT_BUSY');
    }
    await assertAlive();
    assert.equal((await first).status, 200);
  } finally {
    if (first) await first;
    await fs.unlink(path.join(root, 'parse-delay.flag'));
  }
  assert.equal((await json('/api/import/validate', { method: 'POST', body })).status, 200);
});

test('import deadlines return controlled errors without writes and allow a later import', async () => {
  const data = (await importFixture()).toString('base64');
  const body = { name: 'mopay_import_template.xlsx', data, importYears: [2028] };
  const before = entrySnapshot();
  await fs.writeFile(path.join(root, 'parse-timeout.flag'), 'short fixture deadline');
  try {
    for (const endpoint of ['/api/import/validate', '/api/import']) {
      const result = await json(endpoint, { method: 'POST', body });
      assert.equal(result.status, 408);
      assert.equal(result.body.error, 'IMPORT_TIMEOUT');
      assert.deepEqual(entrySnapshot(), before);
      await assertAlive();
    }
  } finally {
    await fs.unlink(path.join(root, 'parse-timeout.flag'));
  }
  assert.equal((await json('/api/import/validate', { method: 'POST', body })).status, 200);
});

test('normal import, duplicate handling, selection and explicit overwrite remain compatible', async () => {
  const data = (await importFixture()).toString('base64');
  const body = { name: 'mopay_import_template.xlsx', data, importYears: [2028] };
  const imported = await json('/api/import', { method: 'POST', body });
  assert.equal(imported.status, 200);
  assert.deepEqual(imported.body.imported, [2028]);
  const semanticEntries = async () => {
    const rows = [];
    for (const type of ['income', 'expense']) {
      const response = await json(`/api/entries?year=2028&type=${type}`);
      rows.push(...response.body.entries.map(({ id, groupId, ...fields }) => fields));
    }
    return rows;
  };
  const originalValues = await semanticEntries();
  const before = entrySnapshot();
  const duplicate = await json('/api/import', { method: 'POST', body });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.error, 'OVERWRITE_REQUIRED');
  assert.deepEqual(entrySnapshot(), before);
  const importedId = before.find(row => row.year_id !== 1).id;
  assert.equal((await json(`/api/entries/${importedId}`, {
    method: 'PATCH', body: { name: 'Synthetic local edit', Jan: 999 },
  })).status, 200);
  const overwritten = await json('/api/import', { method: 'POST', body: { ...body, overwriteYears: [2028] } });
  assert.equal(overwritten.status, 200);
  assert.deepEqual(overwritten.body.overwritten, [2028]);
  assert.deepEqual(await semanticEntries(), originalValues);
  assert.deepEqual(entrySnapshot().filter(row => row.year_id === 1), before.filter(row => row.year_id === 1));
  const afterOverwrite = entrySnapshot();
  const skipped = await json('/api/import', { method: 'POST', body: { ...body, importYears: [] } });
  assert.equal(skipped.status, 200);
  assert.deepEqual(skipped.body.skipped, [2028]);
  assert.deepEqual(entrySnapshot(), afterOverwrite);
});
