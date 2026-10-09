// Feature-parity regressions for functions without earlier browser coverage
// (rows marked † in .ai/plans/final-ledger-ui-migration.md). A stateful
// synthetic API records every write so tests verify request payloads, not only
// the rendered result. No backend, real session, data or outbound request is used.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, hooks, serveAsset, ui } from './ui-helpers.mjs';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function createApi({ encryption = { encryptionEnabled: false, keyMismatch: false } } = {}) {
  let nextId = 1000;
  const state = {
    years: [2025, 2026],
    groups: { expense: [{ id: 10, name: 'Household', sortIndex: 0 }, { id: 11, name: 'Transport', sortIndex: 1 }], income: [] },
    entries: {
      expense: [
        { id: 1, name: 'Groceries', groupId: 10, sort_index: 1, Jan: 100, Feb: 200, comment: '' },
        { id: 2, name: 'Rent', groupId: 10, sort_index: 2, Jan: 1000, comment: '' },
        { id: 3, name: 'Fuel', groupId: 11, sort_index: 1, Jan: 50, comment: '' },
        { id: 4, name: 'Gifts', groupId: null, sort_index: 1, Jan: 30, comment: '' },
      ],
      income: [{ id: 20, name: 'Salary', groupId: null, sort_index: 1, Jan: 5000, comment: '' }],
    },
    // Previous year: only incomes, for the same-month comparison (plan D5).
    previous: { expense: [], income: [{ id: 120, name: 'Salary', groupId: null, sort_index: 1, Jan: 4600, comment: '' }] },
    tags: [{ entryId: 1, month: 'Feb', color: 'green', text: 'Synthetic note' }],
    savings: [
      { id: 200, name: 'Emergency fund', targetValue: 1000, sortIndex: 1, items: [
        { id: 201, goalId: 200, name: 'Contribution', value: 300, sortIndex: 1 },
        { id: 202, goalId: 200, name: 'Repair', value: -50, sortIndex: 2 },
      ] },
      { id: 210, name: 'Holiday', targetValue: null, sortIndex: 2, items: [] },
    ],
  };
  const writes = [];
  const failures = [];
  const allEntries = () => [...state.entries.expense, ...state.entries.income];
  const items = () => state.savings.flatMap(goal => goal.items);

  async function handle(route, url) {
    const request = route.request();
    const method = request.method();
    const path = url.pathname;
    const body = method === 'GET' || method === 'DELETE' && !request.postData() ? null : request.postDataJSON();
    const year = Number(url.searchParams.get('year'));
    const type = url.searchParams.get('type');
    if (method !== 'GET') {
      const failure = failures.findIndex(item => item.method === method && item.path.test(path));
      writes.push({ method, path: path + url.search, body, failed: failure >= 0 });
      if (failure >= 0) {
        const [{ status, json }] = failures.splice(failure, 1);
        return route.fulfill({ status, json });
      }
    }
    const ok = (json = { ok: true }) => route.fulfill({ json });
    const id = Number(path.split('/').at(-1));
    if (method === 'GET') {
      if (path === '/api/meta') return ok({ version: '1.6.3', channel: 'main', demo: false });
      if (path === '/api/encryption/status') return ok(encryption);
      if (path === '/api/years') return ok({ years: state.years });
      if (path === '/api/entries') return ok({ entries: year === 2026 ? state.entries[type] : year === 2025 ? state.previous[type] : [] });
      if (path === '/api/entry-groups') return ok({ groups: year === 2026 ? state.groups[type] : [] });
      if (path === '/api/tags') return ok({ tags: year === 2026 ? state.tags : [] });
      if (path === '/api/savings') return ok({ goals: year === 2026 ? state.savings : [] });
    }
    if (method === 'GET' && path === '/api/import/template') return route.fulfill({ body: Buffer.from('synthetic template'), contentType: XLSX });
    if (method === 'POST' && path === '/api/export') return route.fulfill({ body: Buffer.from('synthetic export'), contentType: XLSX });
    if (method === 'POST' && path === '/api/entry-groups') {
      const group = { id: nextId++, name: body.name, sortIndex: 9 };
      state.groups[body.type].push(group);
      return ok({ id: group.id });
    }
    if (method === 'POST' && path === '/api/pin/logout') return ok();
    if (method === 'POST' && path === '/api/pin/verify') {
      const valid = body.pin === '24681357';
      return route.fulfill({ status: valid ? 200 : 401, json: valid ? { ok: true, sessionToken: 'synthetic-session-token' } : { ok: false } });
    }
    if (method === 'POST' && (path === '/api/encryption/notice-ack' || path === '/api/encryption/reset')) return ok();
    if (method === 'POST' && path === '/api/years') { state.years = [...state.years, body.year].sort(); return ok(); }
    if (method === 'DELETE' && path === '/api/years') { state.years = state.years.filter(item => !body.years.includes(item)); return ok(); }
    if (method === 'POST' && path === '/api/entries') {
      const entry = { id: nextId++, name: body.name, groupId: body.groupId ?? null, sort_index: 99, comment: '' };
      state.entries[body.type].push(entry);
      return ok({ id: entry.id });
    }
    if (method === 'PATCH' && path.startsWith('/api/entries/')) {
      const entry = allEntries().find(item => item.id === id);
      Object.assign(entry, Object.fromEntries(Object.entries(body).map(([key, value]) => [key === 'Dec' ? 'Decm' : key, value])));
      return ok();
    }
    if (method === 'DELETE' && path === '/api/entries') {
      for (const list of Object.values(state.entries)) list.splice(0, list.length, ...list.filter(item => !body.ids.includes(item.id)));
      return ok();
    }
    if (method === 'POST' && path === '/api/entries/reorder') {
      body.orderedIds.forEach((entryId, index) => { allEntries().find(item => item.id === entryId).sort_index = index + 1; });
      return ok();
    }
    if (method === 'PATCH' && path === '/api/entry-groups/order') {
      body.orderedIds.forEach((groupId, index) => { state.groups[body.type].find(item => item.id === groupId).sortIndex = index; });
      return ok();
    }
    if (method === 'PATCH' && path.startsWith('/api/entry-groups/')) {
      Object.assign(state.groups.expense.find(item => item.id === id), body);
      return ok();
    }
    if (method === 'DELETE' && path === '/api/entry-groups') {
      state.groups.expense = state.groups.expense.filter(item => !body.ids.includes(item.id));
      allEntries().forEach(item => { if (body.ids.includes(item.groupId)) item.groupId = null; });
      return ok();
    }
    if (method === 'POST' && path === '/api/tags') {
      state.tags = [...state.tags.filter(tag => tag.entryId !== body.entryId || tag.month !== body.month), body];
      return ok();
    }
    if (method === 'DELETE' && path === '/api/tags') {
      const entryId = Number(url.searchParams.get('entryId'));
      state.tags = state.tags.filter(tag => tag.entryId !== entryId || tag.month !== url.searchParams.get('month'));
      return ok();
    }
    if (method === 'POST' && path === '/api/savings') {
      state.savings.push({ id: nextId++, name: body.name, targetValue: body.targetValue, sortIndex: 9, items: [] });
      return ok();
    }
    if (method === 'POST' && /^\/api\/savings\/\d+\/items$/.test(path)) {
      const goalId = Number(path.split('/')[3]);
      const item = { id: nextId++, goalId, name: '', value: 0, sortIndex: 9 };
      state.savings.find(goal => goal.id === goalId).items.push(item);
      return ok({ id: item.id });
    }
    if (method === 'PATCH' && path.startsWith('/api/savings/items/')) { Object.assign(items().find(item => item.id === id), body); return ok(); }
    if (method === 'DELETE' && path.startsWith('/api/savings/items/')) {
      state.savings.forEach(goal => { goal.items = goal.items.filter(item => item.id !== id); });
      return ok();
    }
    if (method === 'PATCH' && path.startsWith('/api/savings/')) { Object.assign(state.savings.find(goal => goal.id === id), body); return ok(); }
    if (method === 'DELETE' && path.startsWith('/api/savings/')) { state.savings = state.savings.filter(goal => goal.id !== id); return ok(); }
    assert.fail(`Unexpected API call: ${method} ${path}`);
  }

  return {
    handle,
    writes,
    // Make the next matching write fail once, as the backend would on a database error.
    failNext(method, path, status = 500, json = { error: 'Synthetic failure' }) {
      failures.push({ method, path, status, json });
    },
  };
}

async function writeCount(api, count) {
  for (let i = 0; i < 100 && api.writes.length < count; i++) await new Promise(resolve => setTimeout(resolve, 20));
}

// Wait for the next write and compare it with the expected request.
async function expectWrite(api, from, method, path, body) {
  await writeCount(api, from + 1);
  assert.ok(api.writes.length > from, `Expected ${method} ${path}`);
  const { failed, ...write } = api.writes[from];
  assert.deepEqual(write, { method, path, body: body ?? null });
  return from + 1;
}

// Dialogs prefill fields in an effect after opening; wait before editing.
async function expectValue(locator, value) {
  let actual;
  for (let i = 0; i < 100; i++) {
    actual = await locator.inputValue();
    if (actual === value) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(actual, value);
}

async function expectText(locator, pattern) {
  let actual;
  for (let i = 0; i < 100; i++) {
    actual = await locator.textContent();
    if (pattern.test(actual)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.match(actual, pattern);
}

// The savings item editor focuses its note field on the next animation frame.
async function expectFocused(locator) {
  for (let i = 0; i < 100 && !await locator.evaluate(node => node === document.activeElement); i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(await locator.evaluate(node => node === document.activeElement), true);
}

// SavingsGoalModal refocuses its Name field 100 ms after opening; editing
// another field before then can lose keystrokes to Name.
const settleGoalDialog = (page) => page.waitForTimeout(150);

async function expectNoWrite(api, from) {
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.deepEqual(api.writes.slice(from), []);
}

async function openApp({ mobile, theme, encryption, section = 'Expenses', releases = [] }, scenario) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      serviceWorkers: 'block',
      isMobile: mobile,
      hasTouch: mobile,
    });
    const api = createApi({ encryption });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-09T12:00:00'));
    await page.addInitScript(({ theme }) => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => {
        window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
      });
      if (!sessionStorage.getItem('parity-initialized')) {
        localStorage.setItem('year', '2026');
        localStorage.setItem('theme', JSON.stringify(theme));
        sessionStorage.setItem('pin-ok', '1');
        sessionStorage.setItem('pin-token', 'synthetic-ui-test');
        sessionStorage.setItem('parity-initialized', '1');
      }
    }, { theme });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'api.github.com') return route.fulfill({ json: releases });
      if (url.hostname !== 'mopay.test') return route.fulfill({ json: [] });
      return url.pathname.startsWith('/api/') ? api.handle(route, url) : serveAsset(route, url);
    });
    await page.goto('http://mopay.test/');
    // The app always starts on Overview (plan D1); most scenarios then open a section.
    await ui.annualTotals(page).waitFor();
    assert.equal(await ui.currentSection(page), 'Overview');
    if (section) {
      await ui.openSection(page, section);
      if (section === 'Expenses') await page.getByText('Groceries', { exact: true }).waitFor();
    }
    await scenario({ page, api, errors });
    assert.deepEqual(await page.evaluate(() => window.cspViolations), [], 'No CSP violations');
  } finally {
    await browser.close();
  }
}

async function screenshot(page, name) {
  if (process.env.MOPAY_SCREENSHOTS) await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/parity-${name}.png` });
}

const cellText = (page, entry, month) => ui.cell(page, entry, month).textContent();

for (const context of [{ mobile: false, theme: 'light' }, { mobile: true, theme: 'dark' }]) {
  const label = `${context.mobile ? 'mobile' : 'desktop'} ${context.theme}`;

  test(`${label}: totals, ungrouped entries and inline month values (F07, F15, F16, F18)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    // F15: current month and totals.
    assert.equal(await page.locator('[aria-current="date"]').textContent(), 'Oct');
    await page.getByText('1 180,00', { exact: true }).waitFor();
    // Phase 3: summary strip (desktop; the narrow layout hides it until Phase 8)
    // and all 12 months, Sum and Avg visible without horizontal scrolling at 1440 px.
    if (context.mobile) {
      assert.equal(await ui.summaryValue(page, 'Year total').isVisible(), false);
    } else {
      assert.equal(await ui.summaryValue(page, 'Year total').textContent(), '1 380');
      assert.equal(await ui.summaryValue(page, 'Monthly average').textContent(), '115');
      assert.equal(await ui.summaryValue(page, 'October').textContent(), '0▼ 100,0% below average');
      assert.equal(await ui.summaryValue(page, 'Highest month').textContent(), 'January · 1 180');
      assert.equal(await page.locator(hooks.table).evaluate(node => node.scrollWidth - node.clientWidth), 0);
    }
    // F16: group subtotals follow the Settings toggle and persist.
    assert.equal(await page.getByText('1 100,00', { exact: true }).count(), 0);
    await ui.openAppMenuItem(page, 'Settings');
    await ui.dialog(page, 'Settings').getByRole('button', { name: 'Group totals' }).click();
    await page.getByText('1 100,00', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('showGroupTotals')), 'true');
    await ui.dialog(page, 'Settings').getByRole('button', { name: 'Group totals' }).click();
    await ui.closeDialog(page).click();
    await ui.dialog(page).waitFor({ state: 'detached' });
    assert.equal(await page.getByText('1 100,00', { exact: true }).count(), 0);

    // F18: ungrouped entries have their own collapsible section, saved per type/year.
    await page.getByText('Ungrouped', { exact: true }).waitFor();
    await page.getByText('Gifts', { exact: true }).waitFor();
    await ui.collapseGroup(page).last().click();
    await page.getByText('Gifts', { exact: true }).waitFor({ state: 'hidden' });
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('group-collapsed:expense:2026'))), { ungrouped: true });
    await ui.expandGroup(page).click();
    await page.getByText('Gifts', { exact: true }).waitFor();

    // F07: decimal filter and Enter save.
    await ui.editCell(page, 'Groceries', 'Jan');
    const jan = ui.cellInput(page, 'Groceries', 'Jan');
    assert.equal(await jan.inputValue(), '100,00');
    await jan.fill('2a5,5');
    assert.equal(await jan.inputValue(), '25,5');
    await jan.press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Jan: 25.5 });
    assert.equal(await cellText(page, 'Groceries', 'Jan'), '25,50');
    // Escape reverts without saving.
    await ui.editCell(page, 'Groceries', 'Jan');
    await ui.cellInput(page, 'Groceries', 'Jan').fill('999');
    await ui.cellInput(page, 'Groceries', 'Jan').press('Escape');
    await expectNoWrite(api, w);
    assert.equal(await cellText(page, 'Groceries', 'Jan'), '25,50');
    // Blur saves; '-' clears the value (null).
    await ui.editCell(page, 'Groceries', 'Feb');
    await ui.cellInput(page, 'Groceries', 'Feb').fill('-');
    await ui.cellInput(page, 'Groceries', 'Feb').evaluate(node => node.blur());
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Feb: null });
    assert.equal(await cellText(page, 'Groceries', 'Feb'), '-');
    // An empty field saves 0; '.' is a thousands separator and ',' the decimal separator.
    await ui.editCell(page, 'Groceries', 'Mar');
    await ui.cellInput(page, 'Groceries', 'Mar').fill('');
    await ui.cellInput(page, 'Groceries', 'Mar').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Mar: 0 });
    assert.equal(await cellText(page, 'Groceries', 'Mar'), '0,00');
    await ui.editCell(page, 'Groceries', 'Dec');
    await ui.cellInput(page, 'Groceries', 'Dec').fill('1.234,5');
    await ui.cellInput(page, 'Groceries', 'Dec').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Dec: 1234.5 });
    assert.equal(await cellText(page, 'Groceries', 'Dec'), '1 234,50');
    await page.getByText('2 340,00', { exact: true }).waitFor(); // total of the year

    // Phase 4 fix (F07): a failed month save keeps the typed value, shows an
    // error with Retry, and Undo restores the previous value without a request.
    api.failNext('PATCH', /^\/api\/entries\/1$/);
    await ui.editCell(page, 'Groceries', 'Apr');
    await ui.cellInput(page, 'Groceries', 'Apr').fill('7');
    await ui.cellInput(page, 'Groceries', 'Apr').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Apr: 7 });
    assert.equal(api.writes.at(-1).failed, true);
    assert.equal(await cellText(page, 'Groceries', 'Apr'), '7,00');
    const saveError = page.getByRole('alert').filter({ hasText: 'Could not save Groceries, Apr. Synthetic failure' });
    await saveError.waitFor();
    await saveError.getByRole('button', { name: 'Retry', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Apr: 7 });
    await saveError.waitFor({ state: 'detached' });
    api.failNext('PATCH', /^\/api\/entries\/1$/);
    await ui.editCell(page, 'Groceries', 'May');
    await ui.cellInput(page, 'Groceries', 'May').fill('8');
    await ui.cellInput(page, 'Groceries', 'May').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { May: 8 });
    const undoError = page.getByRole('alert').filter({ hasText: 'Could not save Groceries, May.' });
    await undoError.getByRole('button', { name: 'Undo change', exact: true }).click();
    await undoError.waitFor({ state: 'detached' });
    assert.equal(await cellText(page, 'Groceries', 'May'), '-');
    await expectNoWrite(api, w);
    assert.deepEqual(errors, []);
    await screenshot(page, `${label.replace(' ', '-')}-values`);
    // F19: a year without entries explains the empty grid.
    await ui.selectYear(page, 2025);
    await page.getByText('No expenses in 2025 yet.', { exact: true }).waitFor();
    await screenshot(page, `${label.replace(' ', '-')}-empty`);
  }));

  test(`${label}: entry and group details in the inspector (F05, F12, F13, F41)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    // F13: group details. Phase 4: fields save on Enter/blur, one field per request.
    await ui.openDetails(page, 'Household');
    let details = ui.details(page);
    await details.getByText('2 entries in this group.', { exact: true }).waitFor();
    await details.getByRole('textbox', { name: 'Name' }).fill('Home');
    await details.getByRole('textbox', { name: 'Name' }).press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entry-groups/10', { name: 'Home' });
    await ui.rowName(page, 'Home').waitFor();
    await details.getByRole('status').filter({ hasText: /^Saved \d\d:\d\d$/ }).waitFor();
    // Escape closes the inspector and returns focus to the group name.
    await page.keyboard.press('Escape');
    await details.waitFor({ state: 'detached' });
    await expectFocused(ui.rowName(page, 'Home'));
    // Add entry to this group: New entry opens with the group preselected (F05).
    await ui.openDetails(page, 'Home');
    await details.getByRole('button', { name: 'Add entry to group', exact: true }).click();
    const addEntry = ui.dialog(page, 'Add expense entry');
    await addEntry.waitFor();
    await expectValue(addEntry.getByRole('combobox', { name: 'Place entry in' }), '10');
    await addEntry.getByRole('textbox', { name: 'Name' }).fill('Water');
    await addEntry.getByRole('button', { name: 'Add entry', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/entries', { type: 'expense', year: 2026, name: 'Water', groupId: 10 });
    await ui.rowName(page, 'Water').waitFor();
    await ui.dialog(page).waitFor({ state: 'detached' });
    // Arrange from group details enters arrange mode.
    await ui.openDetails(page, 'Home');
    await details.getByRole('button', { name: 'Arrange', exact: true }).click();
    await page.getByRole('button', { name: 'Reorder group Home', exact: true }).waitFor();
    assert.match(await ui.editMenu(page).textContent(), /Arrange/);
    await ui.exitEditMode(page);
    await page.getByRole('button', { name: 'Reorder group Home', exact: true }).waitFor({ state: 'detached' });
    // Remove group with confirmation; its entries become ungrouped.
    await ui.openDetails(page, 'Transport');
    await details.getByRole('button', { name: 'Remove group', exact: true }).click();
    await expectNoWrite(api, w);
    await details.getByRole('button', { name: 'Confirm', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/entry-groups', { ids: [11] });
    await details.waitFor({ state: 'detached' });
    await ui.rowName(page, 'Transport').waitFor({ state: 'detached' });
    await ui.rowName(page, 'Fuel').waitFor();

    // F12/F41: rename, move to another group, comment.
    await ui.openDetails(page, 'Groceries');
    await details.getByRole('textbox', { name: 'Name' }).fill('Food');
    await details.getByRole('textbox', { name: 'Name' }).press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { name: 'Food' });
    await details.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'Ungrouped' });
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { groupId: null });
    await details.getByRole('textbox', { name: 'Comment' }).fill('Weekly shop');
    await screenshot(page, `${label.replace(' ', '-')}-entry-details`);
    await details.getByRole('textbox', { name: 'Comment' }).press('Tab');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { comment: 'Weekly shop' });
    await expectNoWrite(api, w);
    await ui.rowName(page, 'Food').waitFor();
    await ui.closeDetails(page).click();
    await details.waitFor({ state: 'detached' });
    await ui.openDetails(page, 'Food');
    assert.equal(await details.getByRole('textbox', { name: 'Comment' }).inputValue(), 'Weekly shop');
    await details.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'Home' });
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { groupId: 10 });
    // An empty name is not saved; Escape restores the saved name.
    await details.getByRole('textbox', { name: 'Name' }).fill(' ');
    await details.getByRole('textbox', { name: 'Name' }).press('Enter');
    await details.getByText('Enter a name.', { exact: true }).waitFor();
    await details.getByRole('textbox', { name: 'Name' }).press('Escape');
    assert.equal(await details.getByRole('textbox', { name: 'Name' }).inputValue(), 'Food');
    await expectNoWrite(api, w);
    // Save errors are shown with Retry and keep the draft.
    api.failNext('PATCH', /^\/api\/entries\/1$/);
    await details.getByRole('textbox', { name: 'Name' }).fill('Food 2');
    await details.getByRole('textbox', { name: 'Name' }).press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { name: 'Food 2' });
    const failure = details.getByRole('alert').filter({ hasText: 'Could not save the details of Food. Synthetic failure' });
    await failure.waitFor();
    assert.equal(await details.getByRole('textbox', { name: 'Name' }).inputValue(), 'Food 2');
    await failure.getByRole('button', { name: 'Retry', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { name: 'Food 2' });
    await failure.waitFor({ state: 'detached' });
    await ui.rowName(page, 'Food 2').waitFor();
    await ui.closeDetails(page).click();
    await details.waitFor({ state: 'detached' });
    // Remove entry with confirmation.
    await ui.openDetails(page, 'Fuel');
    await details.getByRole('button', { name: 'Remove entry', exact: true }).click();
    await expectNoWrite(api, w);
    await details.getByRole('button', { name: 'Confirm', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/entries', { ids: [3] });
    await ui.rowName(page, 'Fuel').waitFor({ state: 'detached' });
    await details.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
  }));

  test(`${label}: cell inspector, keyboard and tags (D4, D5, F07, F10, F11, F42)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    const details = ui.details(page);
    // D4: a single click selects the cell and opens the inspector, no in-place editor.
    await ui.selectCell(page, 'Rent', 'Mar');
    await details.waitFor();
    assert.equal(await ui.cellInput(page, 'Rent', 'Mar').count(), 0);
    assert.equal(await ui.cell(page, 'Rent', 'Mar').getAttribute('aria-current'), 'true');
    assert.equal(await details.getByRole('heading', { level: 2 }).textContent(), 'March 2026');
    // Value: saves on Enter; quick fill uses the previous month or the average; Clear sets no value.
    await ui.inspectorValue(page).fill('12,5');
    await ui.inspectorValue(page).press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/2', { Mar: 12.5 });
    assert.equal(await cellText(page, 'Rent', 'Mar'), '12,50');
    await details.getByRole('button', { name: 'Use average 506,25', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/2', { Mar: 506.25 });
    await details.getByRole('button', { name: 'Clear value', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/2', { Mar: null });
    assert.equal(await cellText(page, 'Rent', 'Mar'), '-');
    await ui.inspectorValue(page).press('Escape');
    await details.waitFor({ state: 'detached' });
    await expectFocused(ui.cell(page, 'Rent', 'Mar'));
    // Keyboard (F42): arrows move between month cells; typing a digit edits in place.
    await page.keyboard.press('ArrowLeft');
    await expectFocused(ui.cell(page, 'Rent', 'Feb'));
    await page.keyboard.press('ArrowUp');
    await expectFocused(ui.cell(page, 'Groceries', 'Feb'));
    await page.keyboard.press('End');
    await expectFocused(ui.cell(page, 'Groceries', 'Dec'));
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await expectFocused(ui.cell(page, 'Rent', 'Jan'));
    await page.keyboard.press('9');
    assert.equal(await ui.cellInput(page, 'Rent', 'Jan').inputValue(), '9');
    await page.keyboard.press('5');
    // Tab saves and moves to the next month.
    await page.keyboard.press('Tab');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/2', { Jan: 95 });
    await expectFocused(ui.cell(page, 'Rent', 'Feb'));
    await expectNoWrite(api, w);
    // Only the active month cell is in the Tab order (roving tabindex).
    assert.deepEqual(await page.getByTestId('entry-table').locator('button[tabindex="0"][data-month]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['Rent, Feb: -']);
    // Double-click edits in place too (desktop; the narrow layout's sheet opens on the first tap).
    if (context.mobile) {
      await ui.selectCell(page, 'Gifts', 'Feb');
      await ui.editCell(page, 'Gifts', 'Feb');
    } else {
      await ui.cell(page, 'Gifts', 'Feb').dblclick();
    }
    await ui.cellInput(page, 'Gifts', 'Feb').fill('3');
    await ui.cellInput(page, 'Gifts', 'Feb').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/4', { Feb: 3 });
    // Escape in the editor cancels the edit first and keeps the inspector open.
    await ui.editCell(page, 'Gifts', 'Feb');
    await ui.cellInput(page, 'Gifts', 'Feb').press('Escape');
    await details.waitFor();
    await expectNoWrite(api, w);
    // With the inspector open the selection follows the arrow keys; Shift+Enter moves into it.
    await page.keyboard.press('ArrowLeft');
    assert.equal(await details.getByRole('heading', { level: 2 }).textContent(), 'January 2026');
    await page.keyboard.press('Shift+Enter');
    await expectFocused(ui.inspectorValue(page));
    await page.keyboard.press('Escape');
    await details.waitFor({ state: 'detached' });

    // F10/F11: tags are edited in the inspector (Tags mode removed, D3).
    assert.equal(await page.getByText('Synthetic note', { exact: true }).count(), 1);
    assert.equal(await ui.cellNote(page, 'Groceries', 'Feb'), 'Synthetic note');
    assert.equal(await ui.cellNote(page, 'Groceries', 'Jan'), null);
    await ui.selectCell(page, 'Rent', 'Mar');
    const colour = (name) => details.getByRole('group', { name: 'Tag colour' }).getByRole('button', { name, exact: true });
    assert.equal(await colour('No tag').getAttribute('aria-pressed'), 'true');
    await colour('Orange').click();
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 2, month: 'Mar', color: 'orange', text: '' });
    await details.getByRole('textbox', { name: 'Note' }).fill('Check invoice');
    await screenshot(page, `${label.replace(' ', '-')}-tag`);
    await details.getByRole('textbox', { name: 'Note' }).press('Enter');
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 2, month: 'Mar', color: 'orange', text: 'Check invoice' });
    await page.getByText('Check invoice', { exact: true }).waitFor({ state: 'attached' });
    await details.getByRole('textbox', { name: 'Note' }).press('Tab');
    await expectNoWrite(api, w);
    // Escape reverts a changed note without saving.
    await details.getByRole('textbox', { name: 'Note' }).fill('Draft');
    await details.getByRole('textbox', { name: 'Note' }).press('Escape');
    assert.equal(await details.getByRole('textbox', { name: 'Note' }).inputValue(), 'Check invoice');
    await expectNoWrite(api, w);
    // Clear tag removes it.
    await details.getByRole('button', { name: 'Clear tag', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/tags?entryId=2&month=Mar', null);
    await page.getByText('Check invoice', { exact: true }).waitFor({ state: 'detached' });
    await ui.closeDetails(page).click();
    await details.waitFor({ state: 'detached' });
    // No colour and an empty note also remove the tag.
    await ui.selectCell(page, 'Groceries', 'Feb');
    assert.equal(await colour('Green').getAttribute('aria-pressed'), 'true');
    // Entry facts: change against the previous month; no entry of that name in 2025 (D5).
    const facts = details.getByRole('region', { name: 'Entry 2026' });
    const fact = (term) => facts.getByText(term, { exact: true }).locator('xpath=following-sibling::dd[1]');
    await facts.getByText('February 2025', { exact: true }).waitFor();
    assert.equal(await fact('vs January').textContent(), '▲ 100% (100,00)');
    assert.equal(await fact('February 2025').textContent(), '—');
    await details.getByRole('textbox', { name: 'Note' }).fill('');
    await details.getByRole('textbox', { name: 'Note' }).press('Enter');
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 1, month: 'Feb', color: 'green', text: '' });
    await colour('No tag').click();
    w = await expectWrite(api, w, 'DELETE', '/api/tags?entryId=1&month=Feb', null);
    await ui.closeDetails(page).click();
    await details.waitFor({ state: 'detached' });
    // Colour first, then a note saved with Enter.
    await ui.selectCell(page, 'Gifts', 'Jan');
    await colour('Grey').click();
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 4, month: 'Jan', color: 'grey', text: '' });
    await details.getByRole('textbox', { name: 'Note' }).fill('Birthday');
    await details.getByRole('textbox', { name: 'Note' }).press('Enter');
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 4, month: 'Jan', color: 'grey', text: 'Birthday' });
    await ui.closeDetails(page).click();
    await details.waitFor({ state: 'detached' });

    // D5: Incomes compare with the entry of the same name in the previous year.
    await ui.openSection(page, 'Incomes');
    await ui.selectCell(page, 'Salary', 'Jan');
    await facts.getByText('January 2025', { exact: true }).waitFor();
    assert.equal(await fact('January 2025').textContent(), '4 600,00');
    await screenshot(page, `${label.replace(' ', '-')}-cell-inspector`);
    assert.deepEqual(errors, []);
  }));

  test(`${label}: arrange and remove modes (F08, F09)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    // F08: arrange mode shows handles, blocks value editing and details.
    await ui.enterEditMode(page, 'Arrange');
    await page.getByRole('button', { name: 'Reorder Rent', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Reorder group / }).count(), 2);
    await ui.cell(page, 'Rent', 'Jan').click();
    await ui.cell(page, 'Rent', 'Jan').press('Enter');
    assert.equal(await page.getByRole('textbox').count(), 0);
    await ui.openDetails(page, 'Rent');
    assert.equal(await ui.details(page).count(), 0);
    // Drag within a group (dnd-kit pointer sensor); entries cannot be dragged
    // between groups – moving uses the Group field in details (F12).
    const drag = async (source, target) => {
      const from = await page.getByRole('button', { name: source, exact: true }).boundingBox();
      const to = await page.getByRole('button', { name: target, exact: true }).boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 4, { steps: 12 });
      await page.mouse.up();
      // dnd-kit swallows clicks for 50 ms after a drop so the drop cannot click
      // the control under the pointer; a user cannot click again that fast.
      await page.waitForTimeout(100);
    };
    await drag('Reorder Rent', 'Reorder Groceries');
    w = await expectWrite(api, w, 'POST', '/api/entries/reorder', { orderedIds: [2, 1] });
    await drag('Reorder group Transport', 'Reorder group Household');
    w = await expectWrite(api, w, 'PATCH', '/api/entry-groups/order', { type: 'expense', year: 2026, orderedIds: [11, 10] });
    // Keyboard reordering: Space picks the row up, arrows move it, Space drops it.
    // dnd-kit updates the drop target on the next frames, so keys are paced.
    await page.getByRole('button', { name: 'Reorder Rent', exact: true }).focus();
    for (const key of ['Space', 'ArrowDown', 'Space']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(100);
    }
    w = await expectWrite(api, w, 'POST', '/api/entries/reorder', { orderedIds: [1, 2] });
    await page.waitForTimeout(100);
    await screenshot(page, `${label.replace(' ', '-')}-arrange`);
    await ui.exitEditMode(page);
    await page.getByRole('button', { name: 'Reorder Rent', exact: true }).waitFor({ state: 'detached' });

    // F09: remove mode selects entries and groups; selection clears on exit.
    await ui.enterEditMode(page, 'Remove');
    assert.equal(await ui.removeSelected(page).isDisabled(), true);
    await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).check();
    assert.equal(await ui.removeSelected(page).isDisabled(), false);
    await ui.exitEditMode(page);
    await ui.enterEditMode(page, 'Remove');
    assert.equal(await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).isChecked(), false);
    assert.equal(await ui.removeSelected(page).isDisabled(), true);
    // Typing a search leaves the mode.
    await ui.search(page).fill('Rent');
    await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).waitFor({ state: 'detached' });
    await ui.search(page).press('Escape');
    await ui.enterEditMode(page, 'Remove');
    await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select group Transport', exact: true }).check();
    await screenshot(page, `${label.replace(' ', '-')}-remove`);
    // Phase 3 change: the bulk bar names the selection and removal needs confirmation.
    assert.equal(await ui.removeSelected(page).textContent(), 'Remove 1 group and 1 entry');
    await ui.removeSelected(page).click();
    const confirm = ui.dialog(page, 'Remove 1 group and 1 entry?');
    await confirm.getByText('1 entry in this group stays and moves to Ungrouped.', { exact: false }).waitFor();
    // Cancel sends nothing and keeps the selection.
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    await confirm.waitFor({ state: 'detached' });
    await expectNoWrite(api, w);
    assert.equal(await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).isChecked(), true);
    // A failed removal is shown and stays in the mode; the retry skips the group
    // that was already removed.
    api.failNext('DELETE', /^\/api\/entries$/);
    await ui.removeSelected(page).click();
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/entry-groups', { ids: [11] });
    w = await expectWrite(api, w, 'DELETE', '/api/entries', { ids: [2] });
    assert.equal(api.writes.at(-1).failed, true);
    await page.getByRole('alert').filter({ hasText: 'Could not remove the selection. Try again.' }).waitFor();
    await page.getByText('Transport', { exact: true }).waitFor({ state: 'detached' });
    await expectText(ui.removeSelected(page), /^Remove 1 entry$/);
    await ui.removeSelected(page).click();
    await ui.dialog(page, 'Remove 1 entry?').getByRole('button', { name: 'Remove', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/entries', { ids: [2] });
    await page.getByText('Rent', { exact: true }).waitFor({ state: 'detached' });
    await page.getByText('Transport', { exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('checkbox').first().waitFor({ state: 'detached' });
    await page.getByText('Fuel', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  }));

  test(`${label}: savings goals and items (F20, F21, F22, F23)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    await ui.openSection(page, 'Savings');
    // F23: progress and goals without target in the list; the first goal is selected.
    await ui.goal(page, 'Emergency fund').filter({ hasText: '250,00 of 1 000,00' }).filter({ hasText: '25%' }).waitFor();
    await ui.goal(page, 'Holiday').filter({ hasText: '0,00 · No target' }).waitFor();
    assert.equal(await ui.goal(page, 'Emergency fund').getAttribute('aria-current'), 'true');
    let detail = ui.goalDetail(page, 'Emergency fund');
    await detail.getByText('Target 1 000,00 · 2026', { exact: true }).waitFor();
    assert.equal(await detail.getByRole('progressbar', { name: 'Progress toward target' }).getAttribute('aria-valuenow'), '25');
    // Remaining, contributions and withdrawals.
    assert.deepEqual(await detail.getByRole('definition').allTextContents(), ['750,00', '300,00', '-50,00']);
    await screenshot(page, `${label.replace(' ', '-')}-savings`);
    await ui.openGoal(page, 'Holiday');
    assert.equal(await ui.goal(page, 'Holiday').getAttribute('aria-current'), 'true');
    await ui.goalDetail(page, 'Holiday').getByText('No target · 2026', { exact: true }).waitFor();
    assert.equal(await ui.goalDetail(page, 'Holiday').getByRole('progressbar').count(), 0);

    // F20: add goal; a failed save keeps the dialog and its values.
    await page.getByRole('button', { name: /^(Add goal|New goal)$/ }).click();
    let goalDialog = ui.dialog(page, 'Add savings goal');
    await goalDialog.waitFor();
    await settleGoalDialog(page);
    await goalDialog.getByRole('textbox', { name: 'Name' }).fill('Car');
    await goalDialog.getByRole('textbox', { name: 'Target amount' }).fill('2000');
    api.failNext('POST', /^\/api\/savings$/);
    await goalDialog.getByRole('button', { name: 'Add goal', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/savings', { year: 2026, name: 'Car', targetValue: 2000 });
    await goalDialog.getByText('Could not save the goal. Try again.', { exact: true }).waitFor();
    await expectValue(goalDialog.getByRole('textbox', { name: 'Name' }), 'Car');
    await goalDialog.getByRole('button', { name: 'Add goal', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/savings', { year: 2026, name: 'Car', targetValue: 2000 });
    await goalDialog.waitFor({ state: 'detached' });
    await ui.goal(page, 'Car').waitFor();
    // F21: edit goal (prefilled), then clear the target.
    await ui.openGoal(page, 'Emergency fund');
    detail = ui.goalDetail(page, 'Emergency fund');
    await detail.getByRole('button', { name: 'Edit goal', exact: true }).click();
    goalDialog = ui.dialog(page, 'Edit savings goal');
    await expectValue(goalDialog.getByRole('textbox', { name: 'Name' }), 'Emergency fund');
    await settleGoalDialog(page);
    await expectValue(goalDialog.getByRole('textbox', { name: 'Target amount' }), '1 000,00');
    await goalDialog.getByRole('textbox', { name: 'Name' }).fill('Safety fund');
    await goalDialog.getByRole('textbox', { name: 'Target amount' }).fill('1500');
    await goalDialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/savings/200', { name: 'Safety fund', targetValue: 1500 });
    await goalDialog.waitFor({ state: 'detached' });
    await ui.goal(page, 'Safety fund').filter({ hasText: '250,00 of 1 500,00' }).waitFor();
    detail = ui.goalDetail(page, 'Safety fund');
    await detail.getByRole('button', { name: 'Edit goal', exact: true }).click();
    await expectValue(goalDialog.getByRole('textbox', { name: 'Target amount' }), '1 500,00');
    await settleGoalDialog(page);
    await goalDialog.getByRole('textbox', { name: 'Target amount' }).fill('');
    await goalDialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/savings/200', { name: 'Safety fund', targetValue: null });
    await goalDialog.waitFor({ state: 'detached' });
    await ui.goal(page, 'Safety fund').filter({ hasText: '250,00 · No target' }).waitFor();
    // Remove goal needs confirmation in a dialog; an outside click and Cancel keep it,
    // a failure is shown and the goal stays.
    await ui.openGoal(page, 'Holiday');
    await ui.openGoalRemoval(page);
    const removeDialog = ui.dialog(page, 'Remove Holiday?');
    await removeDialog.getByText('The goal has no items.', { exact: true }).waitFor();
    await page.mouse.click(4, 4);
    await removeDialog.waitFor({ state: 'detached' });
    await ui.openGoalRemoval(page);
    await removeDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await removeDialog.waitFor({ state: 'detached' });
    await expectNoWrite(api, w);
    api.failNext('DELETE', /^\/api\/savings\/210$/);
    await ui.openGoalRemoval(page);
    await removeDialog.getByRole('button', { name: 'Remove goal', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/savings/210', null);
    await ui.goalDetail(page, 'Holiday').getByText('Could not remove the goal. Try again.', { exact: true }).waitFor();
    await ui.openGoalRemoval(page);
    await removeDialog.getByRole('button', { name: 'Remove goal', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/savings/210', null);
    await ui.goal(page, 'Holiday').waitFor({ state: 'detached' });
    // The first remaining goal is selected afterwards.
    await ui.goalDetail(page, 'Safety fund').waitFor();
    assert.equal(await ui.goal(page, 'Safety fund').getAttribute('aria-current'), 'true');

    // F22: the quick add form creates an item with two calls; the type sets the sign.
    detail = ui.goalDetail(page, 'Safety fund');
    await ui.itemRow(page, 'Repair').getByText('Temporary withdrawal', { exact: true }).waitFor();
    const balance = ui.goalBalance(page);
    await expectText(balance, /250,00$/);
    const form = ui.addItemForm(page);
    const formNote = form.getByRole('textbox', { name: 'Source or note' });
    const formAmount = form.getByRole('textbox', { name: 'Amount' });
    const addItem = form.getByRole('button', { name: 'Add item', exact: true });
    assert.equal(await addItem.isDisabled(), true, 'Nothing to add yet');
    await formNote.fill('Bonus');
    await formAmount.fill('-1.200,5');
    assert.equal(await formAmount.inputValue(), '1.200,5', 'The sign comes from the type');
    await formAmount.press('Enter');
    w = await expectWrite(api, w, 'POST', '/api/savings/200/items', {});
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1001', { name: 'Bonus', value: 1200.5 });
    await ui.itemRow(page, 'Bonus').waitFor();
    await expectValue(formNote, '');
    await expectFocused(formNote);
    await expectText(balance, /1 450,50$/);
    await formNote.fill('Car repair');
    await formAmount.fill('20');
    await form.getByRole('radio', { name: 'Temporary withdrawal' }).check();
    await addItem.click();
    w = await expectWrite(api, w, 'POST', '/api/savings/200/items', {});
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1002', { name: 'Car repair', value: -20 });
    await ui.itemRow(page, 'Car repair').getByText('Temporary withdrawal', { exact: true }).waitFor();
    assert.equal(await form.getByRole('radio', { name: 'Contribution' }).isChecked(), true);
    await expectText(balance, /1 430,50$/);
    // A failed second call removes the empty item again and keeps the typed values.
    await formNote.fill('Lost');
    await formAmount.fill('5');
    api.failNext('PATCH', /^\/api\/savings\/items\//);
    await addItem.click();
    w = await expectWrite(api, w, 'POST', '/api/savings/200/items', {});
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1003', { name: 'Lost', value: 5 });
    w = await expectWrite(api, w, 'DELETE', '/api/savings/items/1003', null);
    await form.getByText('Could not save the item, so it was not added. Try again.', { exact: true }).waitFor();
    await expectValue(formNote, 'Lost');
    assert.equal(await ui.itemRow(page, 'Untitled item').count(), 0, 'No silent empty item');
    await screenshot(page, `${label.replace(' ', '-')}-savings-add-error`);
    // If removing it fails too, the empty item stays visible with an explanation;
    // Escape in its editor removes a blank item.
    api.failNext('PATCH', /^\/api\/savings\/items\//);
    api.failNext('DELETE', /^\/api\/savings\/items\//);
    await addItem.click();
    w = await expectWrite(api, w, 'POST', '/api/savings/200/items', {});
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1004', { name: 'Lost', value: 5 });
    w = await expectWrite(api, w, 'DELETE', '/api/savings/items/1004', null);
    await form.getByText('Could not save the item. An empty item was left in the list; edit or remove it.', { exact: true }).waitFor();
    await ui.itemRow(page, 'Untitled item').getByRole('button', { name: 'Edit item', exact: true }).click();
    const editor = ui.itemEditor(page);
    const note = editor.getByRole('textbox', { name: 'Source or note' });
    const amount = editor.getByRole('textbox', { name: 'Amount' });
    await expectFocused(note);
    await note.press('Escape');
    w = await expectWrite(api, w, 'DELETE', '/api/savings/items/1004', null);
    await ui.itemRow(page, 'Untitled item').waitFor({ state: 'detached' });

    // Inline edit: save with the button, Enter after a failure, Escape reverts.
    await page.getByRole('button', { name: 'Edit Contribution', exact: true }).click();
    await expectFocused(note);
    await amount.fill('400');
    await editor.getByRole('button', { name: 'Save item', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/201', { name: 'Contribution', value: 400 });
    await page.getByText('+400,00', { exact: true }).waitFor();
    await expectText(balance, /1 530,50$/);
    await page.getByRole('button', { name: 'Edit Bonus', exact: true }).click();
    await expectFocused(note);
    await amount.fill('1300');
    api.failNext('PATCH', /^\/api\/savings\/items\/1001$/);
    await amount.press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1001', { name: 'Bonus', value: 1300 });
    await detail.getByText('Could not save the item. Try again.', { exact: true }).waitFor();
    await expectValue(amount, '1300');
    await amount.press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1001', { name: 'Bonus', value: 1300 });
    await editor.waitFor({ state: 'detached' });
    await expectText(balance, /1 630,00$/);
    assert.equal(await detail.getByText('Could not save the item. Try again.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Edit Car repair', exact: true }).click();
    await expectFocused(note);
    await amount.fill('abc-30');
    assert.equal(await amount.inputValue(), '-30');
    await editor.getByText('Temporary withdrawal', { exact: true }).waitFor();
    await screenshot(page, `${label.replace(' ', '-')}-savings-edit`);
    await amount.press('Escape');
    await editor.waitFor({ state: 'detached' });
    await expectNoWrite(api, w);
    await ui.itemRow(page, 'Car repair').getByText('-20,00', { exact: true }).waitFor();
    // Removing an item needs no confirmation.
    await page.getByRole('button', { name: 'Remove Repair', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/savings/items/202', null);
    await ui.itemRow(page, 'Repair').waitFor({ state: 'detached' });
    await expectText(balance, /1 680,00$/);
    assert.deepEqual(errors, []);
  }));

  test(`${label}: year operations and first-run year (F29, F30)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    await ui.openAppMenuItem(page, 'Year operations');
    const dialog = ui.dialog(page, 'Year operations');
    const year = dialog.getByRole('textbox', { name: 'Year' });
    const add = dialog.getByRole('button', { name: 'Add year', exact: true });
    // Only digits, exactly four.
    await year.fill('20a7');
    assert.equal(await year.inputValue(), '207');
    assert.equal(await add.isDisabled(), true);
    await year.fill('2026');
    await add.click();
    await dialog.getByText('Year 2026 already exists', { exact: true }).waitFor();
    await expectNoWrite(api, w);
    await year.fill('2027');
    await year.press('Enter');
    w = await expectWrite(api, w, 'POST', '/api/years', { year: 2027 });
    await dialog.getByText('Year 2027 added', { exact: true }).waitFor();
    assert.equal(await year.inputValue(), '');
    // Known defect: the dialog selects the new year, but the year list is still
    // stale, so the year guard in MainBar immediately restores the previous
    // year. Fixing it is a deliberate change to record in the plan (F29).
    await page.waitForTimeout(300);
    assert.equal(await ui.yearSwitch(page).getAttribute('aria-label'), 'Working year 2026');
    // Deleting years needs a second click to confirm; afterwards the working
    // year becomes the latest remaining year, even if it was not deleted.
    await dialog.getByRole('button', { name: '2025', exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: '2025', exact: true }).getAttribute('aria-pressed'), 'true');
    await dialog.getByRole('button', { name: 'Delete 1 year(s)', exact: true }).click();
    await expectNoWrite(api, w);
    await screenshot(page, `${label.replace(' ', '-')}-year-delete`);
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/years', { years: [2025] });
    await dialog.getByText('Removed 1 year(s)', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: '2025', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await ui.yearSwitch(page).getAttribute('aria-label'), 'Working year 2027');
    // Today nothing prevents deleting every year (the subtitle only advises
    // keeping one); the first-run dialog then asks for a new year (F30). It
    // opens underneath Year operations, which has to be closed first.
    await dialog.getByRole('button', { name: '2026', exact: true }).click();
    await dialog.getByRole('button', { name: '2027', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete 2 year(s)', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/years', { years: [2026, 2027] });
    const initiate = ui.dialog(page, 'Initiate MOPAY');
    await initiate.waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await initiate.getByRole('button', { name: 'Close dialog' }).count(), 0, 'First-run dialog cannot be dismissed');
    await initiate.getByRole('textbox', { name: 'Year' }).press('Escape');
    await page.waitForTimeout(250);
    assert.equal(await initiate.isVisible(), true, 'Escape does not dismiss the first-run dialog');
    await screenshot(page, `${label.replace(' ', '-')}-initiate-year`);
    const start = initiate.getByRole('button', { name: 'Start', exact: true });
    await initiate.getByRole('textbox', { name: 'Year' }).fill('203');
    assert.equal(await start.isDisabled(), true);
    await initiate.getByRole('textbox', { name: 'Year' }).fill('2030');
    await start.click();
    w = await expectWrite(api, w, 'POST', '/api/years', { year: 2030 });
    await initiate.waitFor({ state: 'detached' });
    assert.equal(await ui.yearSwitch(page).getAttribute('aria-label'), 'Working year 2030');
    // A year without values or goals shows the Overview empty state (F19).
    await ui.openSection(page, 'Overview');
    await page.getByText('Add income or expense values, or create a Savings goal, to build your financial story.', { exact: true }).waitFor();
    assert.equal(await ui.annualTotals(page).count(), 0);
    assert.deepEqual(errors, []);
  }));

  // Fixture: 2026 incomes Jan 5 000; expenses Jan 1 180 and Feb 200; 2025 incomes
  // Jan 4 600 and no expenses; goals 250 of a 1 000 target plus one without target.
  // The clock is fixed to 9 October 2026, so October is the current month.
  test(`${label}: Overview KPIs, months, spending, savings and predictability (F24–F28)`, () => openApp({ ...context, section: null }, async ({ page, api, errors }) => {
    const kpi = (term) => ui.overviewKpi(page, term).textContent();
    assert.equal(await kpi('Income'), 'Income5 000,00↑ +8,7% vs 2025');
    assert.equal(await kpi('Expenses'), 'Expenses1 380,00No baseline vs 2025');
    assert.equal(await kpi('Net result'), 'Net result+3 620,00↓ -21,3% vs 2025');
    assert.equal(await kpi('Saved in goals'), 'Saved in goals250,0025% of targets covered');

    // Best and weakest months are named in text; the current month is marked; months without data say so.
    assert.equal(await ui.overviewMonth(page, 'Jan').getAttribute('aria-label'), 'Jan: net +3 820,00, income 5 000,00, expenses 1 180,00, best month');
    assert.equal(await ui.overviewMonth(page, 'Jan').textContent(), 'JanBest+3 820');
    assert.equal(await ui.overviewMonth(page, 'Feb').getAttribute('aria-label'), 'Feb: net -200,00, income 0,00, expenses 200,00, weakest month');
    assert.equal(await ui.overviewMonth(page, 'Feb').textContent(), 'FebWeakest-200');
    assert.equal(await ui.overviewMonth(page, 'Oct').getAttribute('aria-label'), 'Oct: no activity, current month');
    assert.equal(await ui.overviewMonth(page, 'Oct').getAttribute('aria-current'), 'date');
    assert.equal(await ui.overviewMonth(page, 'Oct').textContent(), 'OctNo data');
    assert.equal(await ui.overviewMonth(page, 'Mar').getAttribute('aria-current'), null);

    // Groups and the top entries as bars with amount and share of expenses.
    const spending = ui.overviewCard(page, 'Where money went');
    assert.deepEqual(await spending.getByRole('list').first().getByRole('listitem').allTextContents(),
      ['Household1 300,0094,2%', 'Transport50,003,6%', 'Ungrouped30,002,2%']);
    assert.deepEqual(await spending.getByRole('list').nth(1).getByRole('listitem').allTextContents(),
      ['1Rent1 000,0072,5%', '2Groceries300,0021,7%', '3Fuel50,003,6%', '4Gifts30,002,2%']);

    const savings = ui.overviewCard(page, 'Savings overview');
    assert.equal(await savings.getByRole('progressbar', { name: 'Overall savings target progress' }).getAttribute('aria-valuenow'), '25');
    await savings.getByText('250,00 of 1 000,00 covered', { exact: true }).waitFor();
    assert.deepEqual(await savings.getByRole('definition').allTextContents(), ['750,00', '0 of 1', '0,00']);

    const predictability = ui.overviewCard(page, 'Predictability');
    assert.equal(await predictability.getByRole('progressbar', { name: 'Expenses stability' }).getAttribute('aria-valuenow'), '29');
    assert.equal(await predictability.getByRole('progressbar', { name: 'Income stability' }).count(), 0);
    await predictability.getByText('Not enough data', { exact: true }).waitFor();
    await predictability.getByText('Groceries varied most month to month', { exact: true }).waitFor();
    await screenshot(page, `${label.replace(' ', '-')}-overview`);

    // A month opens Expenses with that month's first visible cell focused, without the inspector.
    await ui.overviewMonth(page, 'Feb').click();
    await ui.cell(page, 'Groceries', 'Feb').waitFor();
    assert.equal(await ui.currentSection(page), 'Expenses');
    await expectFocused(ui.cell(page, 'Groceries', 'Feb'));
    assert.equal(await ui.cell(page, 'Groceries', 'Feb').getAttribute('tabindex'), '0');
    assert.equal(await ui.details(page).count(), 0, 'No inspector opens');
    await screenshot(page, `${label.replace(' ', '-')}-overview-month`);
    // Arrow keys continue from there; a month without data works the same way.
    await page.keyboard.press('ArrowDown');
    await expectFocused(ui.cell(page, 'Rent', 'Feb'));
    await ui.openSection(page, 'Overview');
    await ui.overviewMonth(page, 'Oct').click();
    await expectFocused(ui.cell(page, 'Groceries', 'Oct'));
    assert.equal(await ui.details(page).count(), 0);

    await ui.openSection(page, 'Overview');
    await ui.overviewCard(page, 'Savings overview').getByRole('button', { name: 'Open savings', exact: true }).click();
    assert.equal(await ui.currentSection(page), 'Savings');
    await expectNoWrite(api, 0);
    assert.deepEqual(errors, []);
  }));
}

for (const mobile of [false, true]) {
  for (const theme of ['light', 'dark']) {
    const label = `${mobile ? 'mobile' : 'desktop'} ${theme}`;
    test(`${label}: new group, export, import and settings dialogs (F06, F31, F32, F33)`, () => openApp({ mobile, theme }, async ({ page, api, errors }) => {
      let w = 0;
      const name = label.replace(' ', '-');
      // F06: new group.
      await ui.openNew(page, 'Group');
      const group = ui.dialog(page, 'Add expense group');
      await group.getByRole('textbox', { name: 'Name' }).fill('Leisure');
      await screenshot(page, `${name}-new-group`);
      await group.getByRole('button', { name: 'Add group', exact: true }).click();
      w = await expectWrite(api, w, 'POST', '/api/entry-groups', { type: 'expense', year: 2026, name: 'Leisure' });
      await page.getByText('Leisure', { exact: true }).waitFor();
      await group.waitFor({ state: 'detached' });
      // F31: export selected years as an XLSX download.
      await ui.openAppMenuItem(page, 'Export data');
      const exportDialog = ui.dialog(page, 'Export data');
      await exportDialog.getByRole('button', { name: '2026', exact: true }).click();
      await screenshot(page, `${name}-export`);
      const exportDownload = page.waitForEvent('download');
      await exportDialog.getByRole('button', { name: 'Export 1', exact: true }).click();
      assert.equal((await exportDownload).suggestedFilename(), 'mopay_export.xlsx');
      w = await expectWrite(api, w, 'POST', '/api/export', { years: [2026] });
      await ui.closeDialog(page).click();
      await exportDialog.waitFor({ state: 'detached' });
      // F32: import dialog and template download (validation/overwrite stay a
      // manual check with a synthetic XLSX, see the plan).
      await ui.openAppMenuItem(page, 'Import data');
      const importDialog = ui.dialog(page, 'Import data');
      await screenshot(page, `${name}-import`);
      const templateDownload = page.waitForEvent('download');
      await importDialog.getByRole('button', { name: 'Download template', exact: true }).click();
      assert.equal((await templateDownload).suggestedFilename(), 'mopay_import_template.xlsx');
      assert.equal(await importDialog.getByRole('button', { name: 'Import', exact: true }).isEnabled(), true);
      await ui.closeDialog(page).click();
      await importDialog.waitFor({ state: 'detached' });
      // F33/F16/F17/F35: settings dialog controls.
      await ui.openAppMenuItem(page, 'Settings');
      const settings = ui.dialog(page, 'Settings');
      for (const control of ['Group totals', 'View density', 'Dark theme', 'Screen lock']) {
        await settings.getByRole('button', { name: control, exact: true }).waitFor();
      }
      assert.equal(await settings.getByRole('button', { name: 'Dark theme', exact: true }).getAttribute('aria-pressed'), String(theme === 'dark'));
      await screenshot(page, `${name}-settings`);
      await settings.getByRole('button', { name: 'View density', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.view), 'compact');
      await settings.getByRole('button', { name: 'View density', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.view), 'normal');
      await ui.closeDialog(page).click();
      await settings.waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
    }));
  }
}

for (const context of [{ mobile: false, theme: 'light' }, { mobile: true, theme: 'dark' }]) {
  const label = `${context.mobile ? 'mobile' : 'desktop'} ${context.theme}`;
  const name = label.replace(' ', '-');

  test(`${label}: encryption notice is acknowledged (F38)`, () => openApp({ ...context, encryption: { encryptionEnabled: true, showNotice: true, keyMismatch: false }, section: null }, async ({ page, api, errors }) => {
    const notice = ui.dialog(page, 'Your data has been encrypted');
    await notice.waitFor();
    await screenshot(page, `${name}-encryption-notice`);
    await notice.getByRole('button', { name: 'Got it', exact: true }).click();
    await expectWrite(api, 0, 'POST', '/api/encryption/notice-ack', {});
    await notice.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
  }));

  test(`${label}: encryption key mismatch blocks the app until reset (F38)`, () => openApp({ ...context, encryption: { encryptionEnabled: true, keyMismatch: true }, section: null }, async ({ page, api, errors }) => {
    let w = 0;
    const mismatch = ui.dialog(page, 'Encryption key mismatch');
    await mismatch.waitFor();
    assert.equal(await mismatch.getByRole('button', { name: 'Close dialog' }).count(), 0, 'Mismatch dialog cannot be dismissed');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    assert.equal(await mismatch.isVisible(), true, 'Escape does not dismiss the mismatch dialog');
    assert.equal(await ui.dialog(page, 'Your data has been encrypted').count(), 0);
    await screenshot(page, `${name}-encryption-mismatch`);
    // Reset needs confirmation; Cancel returns without a request.
    await mismatch.getByRole('button', { name: 'Reset all data and start fresh', exact: true }).click();
    await mismatch.getByText('Confirm reset: all years, entries, and savings data will be permanently deleted.', { exact: true }).waitFor();
    await mismatch.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expectNoWrite(api, w);
    // A failed reset is shown; success reloads the page (not exercised here).
    api.failNext('POST', /^\/api\/encryption\/reset$/);
    await mismatch.getByRole('button', { name: 'Reset all data and start fresh', exact: true }).click();
    await mismatch.getByRole('button', { name: 'Confirm reset', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/encryption/reset', { confirm: true });
    await mismatch.getByText('Synthetic failure', { exact: true }).waitFor();
    await mismatch.waitFor();
    assert.deepEqual(errors, []);
  }));
}

for (const context of [{ mobile: false, theme: 'light' }, { mobile: true, theme: 'dark' }]) {
  const label = `${context.mobile ? 'mobile' : 'desktop'} ${context.theme}`;

  test(`${label}: dialog keyboard – Escape, focus trap and focus return (F42)`, () => openApp(context, async ({ page, api, errors }) => {
    const focusedInside = (dialog) => dialog.evaluate(node => node.contains(document.activeElement));
    // Tab and Shift+Tab stay inside the open dialog.
    await ui.openNew(page, 'Entry');
    const addEntry = ui.dialog(page, 'Add expense entry');
    await addEntry.waitFor();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await focusedInside(addEntry), true, 'Tab keeps focus in the dialog');
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Shift+Tab');
      assert.equal(await focusedInside(addEntry), true, 'Shift+Tab keeps focus in the dialog');
    }
    // Escape closes a dismissible dialog without saving.
    await page.keyboard.press('Escape');
    await addEntry.waitFor({ state: 'detached' });
    // Focus returns to the control that opened the dialog.
    await ui.openSection(page, 'Savings');
    const edit = ui.goalDetail(page, 'Emergency fund').getByRole('button', { name: 'Edit goal', exact: true });
    await edit.click();
    const goal = ui.dialog(page, 'Edit savings goal');
    await goal.waitFor();
    await expectFocused(goal.getByRole('textbox', { name: 'Name' }));
    await settleGoalDialog(page);
    // Escape in the target field restores the saved target and keeps the dialog
    // open (F21 defect fixed in Phase 6: the following blur reformatted the draft).
    const target = goal.getByRole('textbox', { name: 'Target amount' });
    await target.fill('5');
    await target.press('Escape');
    await expectValue(target, '1 000,00');
    await page.waitForTimeout(100);
    await expectValue(target, '1 000,00');
    assert.equal(await goal.isVisible(), true);
    await goal.getByRole('textbox', { name: 'Name' }).press('Escape');
    await goal.waitFor({ state: 'detached' });
    await expectFocused(edit);
    assert.deepEqual(api.writes, []);
    assert.deepEqual(errors, []);
  }));
}

for (const theme of ['light', 'dark']) {
  const desktop = { mobile: false, theme };

  test(`desktop ${theme}: sidebar shell, Overview start and session (F01, F02, F34, F35, D1)`, () => openApp({ ...desktop, section: null }, async ({ page, api, errors }) => {
    let w = 0;
    const nav = page.getByRole('navigation', { name: 'Primary' });
    assert.deepEqual(await nav.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))),
      ['Overview', 'Expenses', 'Incomes', 'Savings']);
    assert.equal(await ui.search(page).count(), 0, 'Overview has no search field');
    // Section totals follow the data and inline edits (whole units).
    assert.equal(await page.locator('#sidebar-meta-expenses').textContent(), '1 380');
    assert.equal(await page.locator('#sidebar-meta-incomes').textContent(), '5 000');
    assert.equal(await page.locator('#sidebar-meta-savings').textContent(), '2 goals');
    await ui.openSection(page, 'Expenses');
    assert.equal(await ui.currentSection(page), 'Expenses');
    await ui.editCell(page, 'Groceries', 'Jan');
    await ui.cellInput(page, 'Groceries', 'Jan').fill('25,5');
    await ui.cellInput(page, 'Groceries', 'Jan').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Jan: 25.5 });
    await expectText(page.locator('#sidebar-meta-expenses'), /^1 306$/);

    // Working year: keyboard listbox, persisted per mode.
    const yearSwitch = ui.yearSwitch(page);
    await yearSwitch.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('listbox', { name: 'Available years' }).waitFor();
    assert.equal(await page.getByRole('option', { name: '2026' }).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape');
    await page.getByRole('listbox').waitFor({ state: 'detached' });
    await expectFocused(yearSwitch);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expectText(page.getByRole('heading', { level: 1 }), /^Expenses 2025$/);
    assert.equal(await yearSwitch.getAttribute('aria-label'), 'Working year 2025');
    assert.equal(await page.evaluate(() => localStorage.getItem('year')), '2025');

    // Theme segment.
    const other = theme === 'light' ? 'Dark theme' : 'Light theme';
    await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: other }).click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme === 'light' ? 'dark' : 'light');
    assert.equal(await page.getByRole('button', { name: other }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: theme === 'light' ? 'Light theme' : 'Dark theme' }).click();
    await screenshot(page, `desktop-${theme}-shell`);

    // Lock and unlock: always back to Overview, year selection kept (D1).
    await page.getByRole('button', { name: 'Lock session', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/pin/logout', {});
    await ui.pinDialog(page).waitFor();
    await ui.unlock(page, '24681357');
    w = await expectWrite(api, w, 'POST', '/api/pin/verify', { pin: '24681357' });
    await ui.pinDialog(page).waitFor({ state: 'detached' });
    await expectText(page.getByRole('heading', { level: 1 }), /^Overview 2025$/);
    assert.equal(await ui.currentSection(page), 'Overview');
    assert.deepEqual(errors, []);
  }));

  test(`desktop ${theme}: page header menus and update indicator (F05, F06, F42, F44)`, () => openApp({
    ...desktop,
    releases: [{ tag_name: 'v9.0.0', name: 'v9.0.0', html_url: 'https://github.com/pbuzdygan/mopay/releases/tag/v9.0.0', target_commitish: 'main' }],
  }, async ({ page, api, errors }) => {
    // F44: a newer release on the app's channel shows a link in the sidebar.
    const update = page.getByRole('link', { name: 'Update available · v9.0.0' });
    await update.waitFor();
    assert.equal(await update.getAttribute('href'), 'https://github.com/pbuzdygan/mopay/releases/tag/v9.0.0');
    assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Expenses 2026');
    assert.equal(await page.getByText('4 entries in 2 groups', { exact: true }).count(), 1);
    // Edit menu: menu button keyboard pattern.
    const edit = ui.editMenu(page);
    await edit.focus();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu', { name: 'Edit' });
    await menu.waitFor();
    const focused = () => page.evaluate(() => document.activeElement?.textContent);
    // D3: Tags mode is gone; tagging lives in the inspector.
    assert.deepEqual(await menu.getByRole('menuitem').allTextContents(), ['Arrange', 'Remove', 'New group']);
    assert.equal(await focused(), 'Arrange');
    await page.keyboard.press('ArrowDown');
    assert.equal(await focused(), 'Remove');
    await page.keyboard.press('End');
    assert.equal(await focused(), 'New group');
    await page.keyboard.press('Home');
    assert.equal(await focused(), 'Arrange');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });
    await expectFocused(edit);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.getByText('Remove mode', { exact: true }).waitFor();
    assert.equal(await ui.editMenu(page).textContent(), 'Edit · Remove');
    await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).waitFor();
    await screenshot(page, `desktop-${theme}-header-remove`);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Select Rent', exact: true }).waitFor({ state: 'detached' });
    // New entry split button: primary action and the group option.
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await ui.dialog(page, 'Add expense entry').waitFor();
    await page.keyboard.press('Escape');
    await ui.dialog(page).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'More create options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New group', exact: true }).click();
    await ui.dialog(page, 'Add expense group').waitFor();
    await page.keyboard.press('Escape');
    await ui.dialog(page).waitFor({ state: 'detached' });
    assert.deepEqual(api.writes, []);
    assert.deepEqual(errors, []);
  }));
}

test('mobile light: narrow toolbar keeps tabs with Overview first (F01)', () => openApp({ mobile: true, theme: 'light', section: null }, async ({ page, errors }) => {
  assert.equal(await page.getByRole('navigation', { name: 'Primary' }).count(), 0, 'Sidebar is hidden below 960px');
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Overview', 'Expenses', 'Incomes', 'Savings']);
  assert.equal(await ui.search(page).isDisabled(), true);
  assert.deepEqual(errors, []);
}));
