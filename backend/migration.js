import { encryptNumber, isEncrypted } from './encryption.js';

export function runEncryptionMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const already = db.prepare("SELECT value FROM meta WHERE key='enc_migrated'").get();
  if (already?.value === '1') {
    return { migrationRan: false };
  }

  const markMeta = db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)');
  const result = encryptMonetaryValues(db);
  markMeta.run('enc_migrated', '1');
  markMeta.run('enc_notice_pending', result.changed ? '1' : '0');
  return { migrationRan: result.changed };
}

export function repairEncryptionState(db) {
  return encryptMonetaryValues(db);
}

export function evaluateEncryptionState(db) {
  const sources = [];
  let hasData = false;

  const entry = db.prepare('SELECT Jan FROM entries WHERE Jan IS NOT NULL LIMIT 1').get();
  if (entry && entry.Jan !== null && entry.Jan !== undefined) {
    hasData = true;
    if (typeof entry.Jan === 'number' || !isEncrypted(entry.Jan)) sources.push('entries');
  }

  const goal = db.prepare('SELECT target_value FROM savings_goals WHERE target_value IS NOT NULL LIMIT 1').get();
  if (goal && goal.target_value !== null && goal.target_value !== undefined) {
    hasData = true;
    if (typeof goal.target_value === 'number' || !isEncrypted(goal.target_value)) sources.push('savings_goals');
  }

  const item = db.prepare('SELECT value FROM savings_items WHERE value IS NOT NULL LIMIT 1').get();
  if (item && item.value !== null && item.value !== undefined) {
    hasData = true;
    if (typeof item.value === 'number' || !isEncrypted(item.value)) sources.push('savings_items');
  }

  return {
    hasData,
    encrypted: sources.length === 0,
    sources,
  };
}

function encryptMonetaryValues(db) {
  let entriesUpdated = 0;
  let goalsUpdated = 0;
  let itemsUpdated = 0;

  const tx = db.transaction(() => {
    const entries = db
      .prepare(
        `SELECT id, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, "Dec" as Decm FROM entries`
      )
      .all();
    if (entries.length) {
      const upd = db.prepare(
        `UPDATE entries SET
          Jan=@Jan, Feb=@Feb, Mar=@Mar, Apr=@Apr, May=@May, Jun=@Jun,
          Jul=@Jul, Aug=@Aug, Sep=@Sep, Oct=@Oct, Nov=@Nov, "Dec"=@Decm
         WHERE id=@id`
      );
      for (const row of entries) {
        const payload = {
          id: row.id,
          Jan: ensureEncrypted(row.Jan),
          Feb: ensureEncrypted(row.Feb),
          Mar: ensureEncrypted(row.Mar),
          Apr: ensureEncrypted(row.Apr),
          May: ensureEncrypted(row.May),
          Jun: ensureEncrypted(row.Jun),
          Jul: ensureEncrypted(row.Jul),
          Aug: ensureEncrypted(row.Aug),
          Sep: ensureEncrypted(row.Sep),
          Oct: ensureEncrypted(row.Oct),
          Nov: ensureEncrypted(row.Nov),
          Decm: ensureEncrypted(row.Decm),
        };
        if (payloadChanged(row, payload)) {
          entriesUpdated += 1;
          upd.run(payload);
        }
      }
    }

    const goals = db.prepare('SELECT id, target_value FROM savings_goals').all();
    if (goals.length) {
      const upd = db.prepare('UPDATE savings_goals SET target_value=? WHERE id=?');
      for (const goal of goals) {
        const encrypted = ensureEncrypted(goal.target_value);
        if (encrypted !== goal.target_value) {
          goalsUpdated += 1;
          upd.run(encrypted, goal.id);
        }
      }
    }

    const items = db.prepare('SELECT id, value FROM savings_items').all();
    if (items.length) {
      const upd = db.prepare('UPDATE savings_items SET value=? WHERE id=?');
      for (const item of items) {
        const encrypted = ensureEncrypted(item.value);
        if (encrypted !== item.value) {
          itemsUpdated += 1;
          upd.run(encrypted, item.id);
        }
      }
    }
  });

  tx();
  const changed = entriesUpdated + goalsUpdated + itemsUpdated > 0;
  return { changed, entriesUpdated, goalsUpdated, itemsUpdated };
}

function ensureEncrypted(value) {
  if (value === null || value === undefined) return null;
  if (isEncrypted(value)) return value;
  return encryptNumber(value);
}

function payloadChanged(original, payload) {
  return (
    payload.Jan !== original.Jan ||
    payload.Feb !== original.Feb ||
    payload.Mar !== original.Mar ||
    payload.Apr !== original.Apr ||
    payload.May !== original.May ||
    payload.Jun !== original.Jun ||
    payload.Jul !== original.Jul ||
    payload.Aug !== original.Aug ||
    payload.Sep !== original.Sep ||
    payload.Oct !== original.Oct ||
    payload.Nov !== original.Nov ||
    payload.Decm !== original.Decm
  );
}
