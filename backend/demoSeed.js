import { encryptNumber, KEY_FINGERPRINT } from './encryption.js';
import { DEMO_OWNER } from './demoState.js';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const expenses = [
  ['Housing', 'Rent', 'Electricity', 'Water', 'Internet'],
  ['Food', 'Groceries', 'Lunches', 'Coffee', 'Restaurants'],
  ['Transport', 'Fuel', 'Public transport', 'Car insurance'],
  ['Health', 'Pharmacy', 'Dentist', 'Fitness'],
  ['Leisure', 'Cinema', 'Books', 'Subscriptions', 'Games'],
  ['Family', 'School', 'Clothing', 'Gifts'],
  ['Travel', 'Holiday', 'Weekend trips', 'Travel insurance'],
];
const incomes = [['Salary', 'Main salary', 'Partner salary'], ['Side work', 'Freelance', 'Tutoring'], ['Other income', 'Interest', 'Refunds']];

export function seedDemo(db, state) {
  const meta = key => db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value;
  if (meta('enc_key_fingerprint') && meta('enc_key_fingerprint') !== KEY_FINGERPRINT) {
    throw new Error('Demo encryption key mismatch; restore the previous APP_ENC_KEY');
  }
  if (meta('demo_generation') === state.generation) return false;
  if (state.phase === 'active') throw new Error('Demo database generation does not match its state');
  db.transaction(() => {
    // Only application-owned demo tables reach this transaction (checked before opening).
    for (const table of ['entry_tags', 'entries', 'entry_groups', 'savings_items', 'savings_goals', 'years']) db.exec(`DELETE FROM ${table}`);
    const groupInsert = db.prepare('INSERT INTO entry_groups(type,name,year_id,sort_index) VALUES(?,?,?,?)');
    const entryInsert = db.prepare(`INSERT INTO entries(type,name,year_id,group_id,comment,sort_index,${months.map(m => `"${m}"`).join(',')}) VALUES(${Array(18).fill('?').join(',')})`);
    const goalInsert = db.prepare('INSERT INTO savings_goals(year_id,name,target_value,sort_index) VALUES(?,?,?,?)');
    const itemInsert = db.prepare('INSERT INTO savings_items(goal_id,name,value,sort_index) VALUES(?,?,?,?)');
    for (const year of [state.year - 1, state.year]) {
      const yearId = db.prepare('INSERT INTO years(year) VALUES(?)').run(year).lastInsertRowid;
      for (const [type, groups] of [['expense', expenses], ['income', incomes]]) {
        let position = 0;
        for (const [index, [groupName, ...names]] of groups.entries()) {
          const groupId = groupInsert.run(type, groupName, yearId, index).lastInsertRowid;
          for (const [item, name] of names.entries()) {
            const base = type === 'income' ? (index === 0 ? 4300 + item * 1200 : 180 + item * 250) : index === 0 && item === 0 ? 1800 : 50 + (index + 1) * 35 + item * 65;
            const amounts = months.map((_, month) => encryptNumber(year === state.year && month > state.month ? 0 : Math.round(base * (year === state.year ? 1.05 : 1) * (1 + ((month + item) % 3) * 0.04))));
            const entryId = entryInsert.run(type, name, yearId, groupId, item === 0 ? `Sample ${groupName.toLowerCase()} entry` : '', position++, ...amounts).lastInsertRowid;
            if (item === 0) db.prepare('INSERT INTO entry_tags(entry_id,month,color,text) VALUES(?,?,?,?)').run(entryId, 'Jan', index % 2 ? 'green' : 'orange', 'Sample note');
          }
        }
        entryInsert.run(type, type === 'expense' ? 'Miscellaneous' : 'One-off bonus', yearId, null, 'Ungrouped sample', position, ...months.map((_, m) => encryptNumber(m === 0 ? 120 : 0)));
      }
      for (const [index, name] of ['Emergency fund', 'Summer holiday', 'New bicycle', 'Home improvements'].entries()) {
        const target = [12000, 5000, 2000, 8000][index];
        const goalId = goalInsert.run(yearId, name, encryptNumber(target), index).lastInsertRowid;
        const progress = [0.65, 0.35, 1, 0.15][index];
        const balance = Math.round(target * progress);
        const contribution = Math.floor(balance / 3);
        for (let i = 0; i < 3; i++) itemInsert.run(goalId, `Contribution ${i + 1}`, encryptNumber(i === 2 ? balance - contribution * 2 : contribution), i);
      }
    }
    const put = db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)');
    for (const [key, value] of Object.entries({ demo_owner: DEMO_OWNER, demo_generation: state.generation, demo_seed_version: '1', demo_years: JSON.stringify([state.year - 1, state.year]), enc_key_fingerprint: KEY_FINGERPRINT })) put.run(key, value);
  })();
  return true;
}
