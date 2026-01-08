export function runGroupsMigration(db) {
  const created = ensureGroupsTable(db);
  const altered = ensureEntriesGroupColumn(db);
  ensureGroupIndexes(db);
  return { created: created || altered };
}

function ensureGroupsTable(db) {
  const existing = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entry_groups'")
    .get();
  if (existing) return false;
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('income','expense')) NOT NULL,
      name TEXT NOT NULL,
      year_id INTEGER NOT NULL,
      sort_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(year_id) REFERENCES years(id)
    );
  `);
  return true;
}

function ensureEntriesGroupColumn(db) {
  const cols = db.prepare("PRAGMA table_info('entries')").all();
  const has = cols.some((c) => c.name === 'group_id');
  if (has) return false;
  db.exec('ALTER TABLE entries ADD COLUMN group_id INTEGER;');
  return true;
}

function ensureGroupIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entry_groups_year_type ON entry_groups(year_id, type);
    CREATE INDEX IF NOT EXISTS idx_entries_year_type_group ON entries(year_id, type, group_id, sort_index);
  `);
}
