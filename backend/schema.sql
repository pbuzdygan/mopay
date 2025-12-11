CREATE TABLE IF NOT EXISTS years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('income','expense')) NOT NULL,
  name TEXT NOT NULL,
  year_id INTEGER NOT NULL,
  comment TEXT,
  Jan REAL DEFAULT 0, Feb REAL DEFAULT 0, Mar REAL DEFAULT 0, Apr REAL DEFAULT 0,
  May REAL DEFAULT 0, Jun REAL DEFAULT 0, Jul REAL DEFAULT 0, Aug REAL DEFAULT 0,
  Sep REAL DEFAULT 0, Oct REAL DEFAULT 0, Nov REAL DEFAULT 0, "Dec" REAL DEFAULT 0,
  sort_index INTEGER DEFAULT 0,
  FOREIGN KEY(year_id) REFERENCES years(id)
);
CREATE INDEX IF NOT EXISTS idx_entries_year_type ON entries(year_id, type);

CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  target_value REAL,
  sort_index INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(year_id) REFERENCES years(id)
);

CREATE TABLE IF NOT EXISTS savings_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  name TEXT,
  value REAL DEFAULT 0,
  sort_index INTEGER DEFAULT 0,
  FOREIGN KEY(goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_year ON savings_goals(year_id);
CREATE INDEX IF NOT EXISTS idx_savings_items_goal ON savings_items(goal_id);

CREATE TABLE IF NOT EXISTS entry_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  color TEXT NOT NULL,
  text TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_tags_entry_month ON entry_tags(entry_id, month);
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);
