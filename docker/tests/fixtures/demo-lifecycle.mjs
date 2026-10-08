// Executed only in a disposable --network none container with /data on tmpfs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/app/package.json');
const Database = require('better-sqlite3');
const key = randomBytes(32).toString('base64');
const pin = '87654321';
let child;
const stop = async () => { if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } };
async function start(demo) {
  await stop();
  child = spawn('/usr/local/bin/docker-entrypoint.sh', ['node', 'server.js'], { cwd: '/app', env: { ...process.env, APP_DEMO: demo, APP_PIN: pin, APP_ENC_KEY: key, PORT: '8010', SECURITY_WEBHOOK_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  for (let i = 0; i < 150 && child.exitCode === null; i++) {
    if (logs.includes('Mopay app listening')) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Disposable image app failed to start: ' + logs);
}
const call = async (route, token, method = 'GET', body) => fetch('http://127.0.0.1:8010' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Mopay-Session': token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const login = async value => (await (await call('/api/pin/verify', null, 'POST', { pin: value })).json()).sessionToken;
const normalSnapshot = () => {
  const db = new Database('/data/mopay.sqlite', { readonly: true });
  try { return { years: db.prepare('SELECT * FROM years').all(), pin: db.prepare("SELECT value FROM meta WHERE key='pin_hash'").get().value }; }
  finally { db.close(); }
};
try {
  assert.notEqual(process.getuid(), 0);
  await start('false');
  const normalToken = await login(pin);
  assert.equal((await call('/api/years', normalToken, 'POST', { year: 2020 })).status, 200);
  await stop();
  const before = normalSnapshot();
  // Demo must start even when the inactive normal database is not writable.
  fs.chmodSync('/data/mopay.sqlite', 0o400);
  await start('true');
  const demoToken = await login('1234');
  assert.ok(demoToken);
  const years = (await (await call('/api/years', demoToken)).json()).years;
  assert.equal(years.length, 2);
  assert.equal((await call('/api/years', demoToken, 'POST', { year: 2020 })).status, 403);
  assert.equal((await call('/api/years', normalToken)).status, 401);
  assert.equal((await (await call('/api/meta')).json()).demo, true);
  const first = JSON.parse(fs.readFileSync('/data/mopay.demo.state.json')).generation;
  for (const file of ['/data/mopay.demo.sqlite', '/data/mopay.demo.state.json']) assert.equal(fs.statSync(file).uid, process.getuid());
  assert.deepEqual(normalSnapshot(), before);
  await start('true');
  assert.equal(JSON.parse(fs.readFileSync('/data/mopay.demo.state.json')).generation, first);
  fs.chmodSync('/data/mopay.sqlite', 0o600);
  await start('false');
  assert.ok(await login(pin));
  assert.deepEqual(normalSnapshot(), before);
  assert.equal(JSON.parse(fs.readFileSync('/data/mopay.demo.state.json')).phase, 'inactive');
  await start('true');
  assert.notEqual(JSON.parse(fs.readFileSync('/data/mopay.demo.state.json')).generation, first);
  assert.deepEqual(normalSnapshot(), before);
  console.log('PASS');
} finally { await stop(); }
