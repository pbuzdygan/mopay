import Database from 'better-sqlite3';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { config } from './runtimeConfig.js';
import { checkFile, readState, reserveGeneration, DEMO_OWNER } from './demoState.js';
import { seedDemo } from './demoSeed.js';

const dbFile = config.dbFile;
const previousState = readState(config.stateFile);
if (config.demo) {
  checkFile(config.demoFile);
  checkFile(`${config.demoFile}-wal`);
  checkFile(`${config.demoFile}-shm`);
  checkFile(config.stateFile);
  if (fs.existsSync(dbFile) && !previousState) throw new Error('Existing demo database is missing its state file');
  if (!fs.existsSync(dbFile) && previousState?.phase === 'active') throw new Error('Active demo database is missing; restore its backup');
  if (fs.existsSync(config.normalFile) && fs.existsSync(dbFile)) {
    const normal = fs.statSync(config.normalFile);
    const demo = fs.statSync(dbFile);
    if (normal.dev === demo.dev && normal.ino === demo.ino) throw new Error('Demo database aliases normal database');
  }
}
if (fs.existsSync(dbFile)) {
  const inspection = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    const hasMeta = inspection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").get();
    const owner = hasMeta && inspection.prepare("SELECT value FROM meta WHERE key='demo_owner'").get()?.value;
    if (config.demo && owner !== DEMO_OWNER) throw new Error('Existing demo path is not an owned Mopay demo database');
    if (!config.demo && owner) throw new Error('DB_FILE points to a demo database; select the normal database');
  } finally { inspection.close(); }
}
export const demoState = config.demo ? reserveGeneration(config) : null;
if (config.demo && !fs.existsSync(dbFile)) {
  // Publish an owned database atomically: a crash cannot leave an unmarked destination.
  const temporary = `${dbFile}.${randomUUID()}.tmp`;
  const initial = new Database(temporary);
  try {
    initial.transaction(() => {
      initial.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)');
      initial.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('demo_owner', DEMO_OWNER);
    })();
    initial.close();
    fs.linkSync(temporary, dbFile);
  } finally {
    if (initial.open) initial.close();
    fs.unlinkSync(temporary);
  }
}
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const busyTimeoutMs = Number(process.env.SQLITE_BUSY_TIMEOUT_MS ?? 5000);
if (Number.isFinite(busyTimeoutMs) && busyTimeoutMs >= 0) {
  db.pragma(`busy_timeout = ${Math.floor(busyTimeoutMs)}`);
}

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
db.exec(schema);
if (config.demo) seedDemo(db, demoState);

export default db;
