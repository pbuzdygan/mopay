export function runTagsMigration(db) {
  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entry_tags'")
    .get();
  if (hasTable) {
    return { created: false };
  }

  db.exec(`
    CREATE TABLE entry_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      color TEXT NOT NULL,
      text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX idx_entry_tags_entry_month ON entry_tags(entry_id, month);
    CREATE INDEX idx_entry_tags_entry ON entry_tags(entry_id);
  `);

  return { created: true };
}
