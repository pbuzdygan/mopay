import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { runtimeConfig } from '../runtimeConfig.js';
import { readState, writeState, reserveGeneration, completeStartup } from '../demoState.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const backend = path.resolve(import.meta.dirname, '..');
const key = randomBytes(32).toString('base64');
process.env.APP_ENC_KEY = key;
const { seedDemo } = await import('../demoSeed.js');
const { decryptToNumber } = await import('../encryption.js');
const normalPin = '87654321';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mopay-demo-'));
  for (const name of await fs.readdir(backend)) {
    if (/\.(js|sql)$/.test(name) || name === 'package.json') await fs.copyFile(path.join(backend, name), path.join(root, name));
  }
  await fs.symlink(path.join(backend, 'node_modules'), path.join(root, 'node_modules'));
  const server = await fs.readFile(path.join(root, 'server.js'), 'utf8');
  await fs.writeFile(path.join(root, 'server.js'), server.replace('app.listen(PORT,', "app.listen(PORT, '127.0.0.1',"));
  return { root, config: runtimeConfig({ DB_FILE: path.join(root, 'mopay.sqlite'), APP_DEMO: 'true' }) };
}

async function start(root, demo, extra = {}) {
  const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DB_FILE: path.join(root, 'mopay.sqlite'), APP_DEMO: demo, APP_PIN: normalPin, APP_ENC_KEY: key, PORT: '0', SECURITY_WEBHOOK_URL: '', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  // PORT=0 is accepted; report the ephemeral address in the isolated copy only.
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const stop = async () => { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } };
  for (let i = 0; i < 150 && child.exitCode === null; i++) {
    const match = output.match(/Fixture port: (\d+)/);
    if (match) return { child, stop, origin: `http://127.0.0.1:${match[1]}`, output: () => output };
    await delay(20);
  }
  await stop();
  throw new Error(`Fixture startup failed: ${output}`);
}

async function prepare(root) {
  const file = path.join(root, 'server.js');
  const source = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, source.replace("app.listen(PORT, '127.0.0.1',", "const fixtureServer = app.listen(PORT, '127.0.0.1',").replace("console.log('Mopay app listening on :' + PORT);", "console.log('Fixture port: ' + fixtureServer.address().port);"));
}
async function login(app, pin) {
  const res = await fetch(app.origin + '/api/pin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  return { status: res.status, ...(await res.json()) };
}
const snapshot = file => {
  const db = new Database(file, { readonly: true });
  try { return Object.fromEntries(['years', 'entries', 'entry_groups', 'savings_goals', 'savings_items', 'entry_tags', 'meta'].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])); }
  finally { db.close(); }
};

test('demo configuration defaults, filenames and invalid inputs', () => {
  for (const value of [undefined, '', 'false', ' false ']) assert.equal(runtimeConfig({ APP_DEMO: value }).demo, false);
  assert.equal(runtimeConfig({ APP_DEMO: ' true ' }).demo, true);
  for (const value of ['yes', '1', 'TRUE']) assert.throws(() => runtimeConfig({ APP_DEMO: value }), /APP_DEMO/);
  for (const [file, expected] of [['finanse.sqlite', 'finanse.demo.sqlite'], ['finanse.db', 'finanse.demo.db'], ['finanse', 'finanse.demo.sqlite']]) {
    assert.equal(path.basename(runtimeConfig({ DB_FILE: file }).demoFile), expected);
  }
});

test('demo lifecycle preserves normal data and PIN; API writes default to denied', async () => {
  const { root, config } = await fixture();
  await prepare(root);
  let app;
  let webhookCalls = 0;
  const webhook = createServer((_req, res) => { webhookCalls++; res.end(); });
  webhook.listen(0, '127.0.0.1');
  await once(webhook, 'listening');
  try {
    app = await start(root, 'false');
    const normal = await login(app, normalPin);
    const headers = { 'Content-Type': 'application/json', 'X-Mopay-Session': normal.sessionToken };
    assert.equal((await fetch(app.origin + '/api/years', { method: 'POST', headers, body: JSON.stringify({ year: 2020 }) })).status, 200);
    await app.stop();
    const before = snapshot(config.normalFile);
    await assert.rejects(fs.access(config.stateFile));
    app = await start(root, 'true', { APP_PIN: '', SECURITY_ALERT_PIN_FAIL_THRESHOLD: '1', SECURITY_WEBHOOK_URL: `http://127.0.0.1:${webhook.address().port}/alert` });
    const meta = await (await fetch(app.origin + '/api/meta')).json();
    assert.equal(meta.demo, true); assert.equal(meta.demoPin, '1234');
    assert.equal((await fetch(app.origin + '/api/years', { headers })).status, 401, 'Previous normal session is invalid');
    const demo = await login(app, '1234'); assert.equal(demo.status, 200);
    assert.equal((await login(app, '0000')).status, 401);
    await delay(100);
    assert.equal(webhookCalls, 0, 'Demo PIN failures never call configured security webhooks');
    const demoHeaders = { 'Content-Type': 'application/json', 'X-Mopay-Session': demo.sessionToken };
    const years = (await (await fetch(app.origin + '/api/years', { headers: demoHeaders })).json()).years;
    assert.equal(years.length, 2);
    for (const type of ['expense', 'income']) {
      const entries = (await (await fetch(`${app.origin}/api/entries?type=${type}&year=${years[1]}`, { headers: demoHeaders })).json()).entries;
      assert.ok(entries.length > 6);
    }
    const source = await fs.readFile(path.join(root, 'server.js'), 'utf8');
    const routes = [...source.matchAll(/app\.(post|patch|delete|put)\('([^']+)'/g)]
      .map(([, method, route]) => [method.toUpperCase(), route.replace(/:[a-zA-Z]+/g, '1')])
      .filter(([, route]) => !['/api/pin/verify', '/api/pin/logout', '/api/export'].includes(route));
    const seeded = snapshot(config.demoFile);
    for (const [method, route] of routes) {
      const response = await fetch(app.origin + route, { method, headers: demoHeaders, body: '{}' });
      assert.equal(response.status, 403, `${method} ${route}`);
      assert.equal((await response.json()).error, 'DEMO_READ_ONLY');
    }
    assert.deepEqual(snapshot(config.demoFile), seeded);
    const exported = await fetch(app.origin + '/api/export', { method: 'POST', headers: demoHeaders, body: JSON.stringify({ years }) });
    assert.equal(exported.status, 200); assert.ok((await exported.arrayBuffer()).byteLength > 1000);
    assert.deepEqual(snapshot(config.normalFile), before);
    const firstGeneration = readState(config.stateFile).generation;
    await app.stop();
    app = await start(root, 'true');
    assert.equal(readState(config.stateFile).generation, firstGeneration);
    assert.deepEqual(snapshot(config.demoFile), seeded);
    await app.stop();
    app = await start(root, '');
    assert.equal(readState(config.stateFile).phase, 'inactive');
    assert.equal((await login(app, '1234')).status, 401);
    assert.equal((await login(app, normalPin)).status, 200);
    assert.deepEqual(snapshot(config.normalFile), before);
    const normalMeta = await (await fetch(app.origin + '/api/meta')).json();
    assert.equal(normalMeta.demo, false); assert.equal('demoPin' in normalMeta, false);
    await app.stop();
    app = await start(root, 'true');
    assert.notEqual(readState(config.stateFile).generation, firstGeneration);
    assert.deepEqual(snapshot(config.normalFile), before);
    await app.stop();
  } finally { if (app) await app.stop(); await new Promise(resolve => webhook.close(resolve)); await fs.rm(root, { recursive: true, force: true }); }
});

test('seed retries are atomic, freeze the generation clock and reject key mismatch', async () => {
  const { root, config } = await fixture();
  let db;
  try {
    const state = reserveGeneration(config, new Date(2026, 9, 8));
    assert.deepEqual(reserveGeneration(config, new Date(2027, 0, 1)), state);
    db = new Database(config.demoFile);
    db.exec(await fs.readFile(path.join(root, 'schema.sql'), 'utf8'));
    db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY,value TEXT)');
    db.prepare('INSERT INTO meta VALUES(?,?)').run('demo_owner', 'mopay-demo-v1');
    assert.equal(seedDemo(db, state), true);
    assert.equal(seedDemo(db, state), false, 'Committed seed only needs state finalization');
    completeStartup(config, state);
    assert.deepEqual(db.prepare('SELECT year FROM years ORDER BY year').all().map(r => r.year), [2025, 2026]);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM entry_groups').get().n, 20);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM savings_goals').get().n, 8);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    const entry = db.prepare('SELECT e.Jan,e.Nov FROM entries e JOIN years y ON y.id=e.year_id WHERE y.year=2026 LIMIT 1').get();
    assert.ok(entry.Jan.startsWith('enc:')); assert.ok(decryptToNumber(entry.Jan) > 0); assert.equal(decryptToNumber(entry.Nov), 0);
    const old = db.prepare('SELECT * FROM entries').all();
    completeStartup({ ...config, demo: false });
    const next = reserveGeneration(config, new Date(2027, 0, 1));
    db.exec("CREATE TRIGGER synthetic_seed_failure BEFORE INSERT ON entries BEGIN SELECT RAISE(ABORT, 'Synthetic seed failure'); END");
    assert.throws(() => seedDemo(db, next), /Synthetic seed failure/);
    assert.deepEqual(db.prepare('SELECT * FROM entries').all(), old, 'Old generation survives seed failure');
    db.exec('DROP TRIGGER synthetic_seed_failure');
    seedDemo(db, next);
    assert.deepEqual(db.prepare('SELECT year FROM years ORDER BY year').all().map(r => r.year), [2026, 2027]);
    db.prepare("UPDATE meta SET value='wrong' WHERE key='enc_key_fingerprint'").run();
    assert.throws(() => seedDemo(db, next), /key mismatch/);
  } finally { if (db) db.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('unowned database, aliases, corrupt state and failed normal startup fail safely', async () => {
  const { root, config } = await fixture();
  await prepare(root);
  let app;
  try {
    const db = new Database(config.normalFile); db.exec('CREATE TABLE private_data(value TEXT)'); db.close();
    await fs.copyFile(config.normalFile, config.demoFile);
    reserveGeneration(config);
    await assert.rejects(start(root, 'true'), /not an owned/);
    await fs.unlink(config.demoFile);
    await fs.symlink(config.normalFile, config.demoFile);
    await assert.rejects(start(root, 'true'), /Unsafe demo/);
    await fs.unlink(config.demoFile);
    await fs.link(config.normalFile, config.demoFile);
    await assert.rejects(start(root, 'true'), /Unsafe demo/);
    await fs.unlink(config.demoFile);
    app = await start(root, 'true'); await app.stop();
    const active = readState(config.stateFile);
    await assert.rejects(start(root, 'false', { APP_PIN: '' }), /APP_PIN must/);
    assert.equal(readState(config.stateFile).phase, 'active');
    await assert.rejects(start(root, 'false', { DB_FILE: config.demoFile }), /points to a demo/);
    await assert.rejects(start(root, 'true', { APP_ENC_KEY: randomBytes(32).toString('base64') }), /key mismatch/);
    await fs.writeFile(config.stateFile, '{broken');
    await assert.rejects(start(root, 'true'), /Fixture startup failed/);
    writeState(config.stateFile, active);
    await fs.unlink(config.demoFile);
    await assert.rejects(start(root, 'true'), /Active demo database is missing/);
  } finally { if (app) await app.stop(); await fs.rm(root, { recursive: true, force: true }); }
});
