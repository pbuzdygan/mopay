import Database from 'better-sqlite3';
import fs from 'fs';

const dbFile = process.env.DB_FILE || './mopay.sqlite';
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const busyTimeoutMs = Number(process.env.SQLITE_BUSY_TIMEOUT_MS ?? 5000);
if (Number.isFinite(busyTimeoutMs) && busyTimeoutMs >= 0) {
  db.pragma(`busy_timeout = ${Math.floor(busyTimeoutMs)}`);
}

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
db.exec(schema);

export default db;
