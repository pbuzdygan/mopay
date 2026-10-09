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
      if (path === '/api/entries') return ok({ entries: year === 2026 ? state.entries[type] : [] });
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
    await ui.cell(page, 'Groceries', 'Jan').click();
    const jan = ui.cellInput(page, 'Groceries', 'Jan');
    assert.equal(await jan.inputValue(), '100,00');
    await jan.fill('2a5,5');
    assert.equal(await jan.inputValue(), '25,5');
    await jan.press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Jan: 25.5 });
    assert.equal(await cellText(page, 'Groceries', 'Jan'), '25,50');
    // Escape reverts without saving.
    await ui.cell(page, 'Groceries', 'Jan').click();
    await ui.cellInput(page, 'Groceries', 'Jan').fill('999');
    await ui.cellInput(page, 'Groceries', 'Jan').press('Escape');
    await expectNoWrite(api, w);
    assert.equal(await cellText(page, 'Groceries', 'Jan'), '25,50');
    // Blur saves; '-' clears the value (null).
    await ui.cell(page, 'Groceries', 'Feb').click();
    await ui.cellInput(page, 'Groceries', 'Feb').fill('-');
    await ui.cellInput(page, 'Groceries', 'Feb').evaluate(node => node.blur());
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Feb: null });
    assert.equal(await cellText(page, 'Groceries', 'Feb'), '-');
    // An empty field saves 0; '.' is a thousands separator and ',' the decimal separator.
    await ui.cell(page, 'Groceries', 'Mar').click();
    await ui.cellInput(page, 'Groceries', 'Mar').fill('');
    await ui.cellInput(page, 'Groceries', 'Mar').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Mar: 0 });
    assert.equal(await cellText(page, 'Groceries', 'Mar'), '0,00');
    await ui.cell(page, 'Groceries', 'Dec').click();
    await ui.cellInput(page, 'Groceries', 'Dec').fill('1.234,5');
    await ui.cellInput(page, 'Groceries', 'Dec').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Dec: 1234.5 });
    assert.equal(await cellText(page, 'Groceries', 'Dec'), '1 234,50');
    await page.getByText('2 340,00', { exact: true }).waitFor(); // total of the year

    // Known gap (plan F07, fixed in Phase 4): a failed month save keeps the
    // optimistic value and is not shown to the user; it only surfaces as an
    // unhandled rejection. Phase 4 replaces this with a visible error and retry.
    api.failNext('PATCH', /^\/api\/entries\/1$/);
    await ui.cell(page, 'Groceries', 'Apr').click();
    await ui.cellInput(page, 'Groceries', 'Apr').fill('7');
    await ui.cellInput(page, 'Groceries', 'Apr').press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { Apr: 7 });
    assert.equal(api.writes.at(-1).failed, true);
    assert.equal(await cellText(page, 'Groceries', 'Apr'), '7,00');
    await page.waitForTimeout(200);
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, ['Synthetic failure']);
    await screenshot(page, `${label.replace(' ', '-')}-values`);
    // F19: a year without entries explains the empty grid.
    await ui.selectYear(page, 2025);
    await page.getByText('No expenses in 2025 yet.', { exact: true }).waitFor();
    await screenshot(page, `${label.replace(' ', '-')}-empty`);
  }));

  test(`${label}: entry and group details (F05, F12, F13, F41)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    // F13: group details.
    await ui.openDetails(page, 'Household');
    let details = ui.dialog(page, 'Group details');
    await details.getByText('2 entries in this group.', { exact: true }).waitFor();
    await details.getByRole('textbox', { name: 'Name' }).fill('Home');
    await details.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entry-groups/10', { name: 'Home' });
    await details.waitFor({ state: 'detached' });
    await page.getByText('Home', { exact: true }).waitFor();
    // Add entry to this group: New entry opens with the group preselected (F05).
    await ui.openDetails(page, 'Home');
    await ui.dialog(page, 'Group details').getByRole('button', { name: '+ Add entry here', exact: true }).click();
    const addEntry = ui.dialog(page, 'Add expense entry');
    await addEntry.waitFor();
    await expectValue(addEntry.getByRole('combobox', { name: 'Place entry in' }), '10');
    await addEntry.getByRole('textbox', { name: 'Name' }).fill('Water');
    await addEntry.getByRole('button', { name: 'Add entry', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/entries', { type: 'expense', year: 2026, name: 'Water', groupId: 10 });
    await page.getByText('Water', { exact: true }).waitFor();
    await ui.dialog(page).waitFor({ state: 'detached' });
    // Arrange from group details enters arrange mode.
    await ui.openDetails(page, 'Home');
    await ui.dialog(page, 'Group details').getByRole('button', { name: 'Arrange', exact: true }).click();
    await page.getByRole('button', { name: 'Reorder group Home', exact: true }).waitFor();
    assert.match(await ui.editMenu(page).textContent(), /Arrange/);
    await ui.exitEditMode(page);
    await page.getByRole('button', { name: 'Reorder group Home', exact: true }).waitFor({ state: 'detached' });
    // Remove group with confirmation; its entries become ungrouped.
    await ui.openDetails(page, 'Transport');
    details = ui.dialog(page, 'Group details');
    await details.getByRole('button', { name: 'Remove group', exact: true }).click();
    await expectNoWrite(api, w);
    await details.getByRole('button', { name: 'Confirm', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/entry-groups', { ids: [11] });
    await details.waitFor({ state: 'detached' });
    await page.getByText('Transport', { exact: true }).waitFor({ state: 'detached' });
    await page.getByText('Fuel', { exact: true }).waitFor();

    // F12/F41: rename, move to another group, comment.
    await ui.openDetails(page, 'Groceries');
    details = ui.dialog(page, 'Entry details');
    await details.getByRole('textbox', { name: 'Name' }).fill('Food');
    await details.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'Ungrouped' });
    await details.getByRole('textbox', { name: 'Comment' }).fill('Weekly shop');
    await screenshot(page, `${label.replace(' ', '-')}-entry-details`);
    await details.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { name: 'Food', groupId: null, comment: 'Weekly shop' });
    await details.waitFor({ state: 'detached' });
    await page.getByText('Food', { exact: true }).waitFor();
    await ui.openDetails(page, 'Food');
    assert.equal(await details.getByRole('textbox', { name: 'Comment' }).inputValue(), 'Weekly shop');
    await details.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'Home' });
    await details.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { name: 'Food', groupId: 10, comment: 'Weekly shop' });
    await details.waitFor({ state: 'detached' });
    // Save errors are shown and keep the panel open with the draft.
    api.failNext('PATCH', /^\/api\/entries\/1$/);
    await ui.openDetails(page, 'Food');
    await details.getByRole('textbox', { name: 'Name' }).fill('Food 2');
    await details.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/entries/1', { name: 'Food 2', groupId: 10, comment: 'Weekly shop' });
    await details.getByRole('alert').filter({ hasText: 'Synthetic failure' }).waitFor();
    assert.equal(await details.getByRole('textbox', { name: 'Name' }).inputValue(), 'Food 2');
    await details.getByRole('button', { name: 'Cancel', exact: true }).click();
    await details.waitFor({ state: 'detached' });
    assert.equal(await page.getByText('Food 2', { exact: true }).count(), 0);
    // Remove entry with confirmation.
    await ui.openDetails(page, 'Fuel');
    await details.getByRole('button', { name: 'Remove entry', exact: true }).click();
    await expectNoWrite(api, w);
    await details.getByRole('button', { name: 'Confirm', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/entries', { ids: [3] });
    await page.getByText('Fuel', { exact: true }).waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
  }));

  test(`${label}: arrange, remove and tag modes (F08, F09, F10, F11)`, () => openApp(context, async ({ page, api, errors }) => {
    let w = 0;
    // F08: arrange mode shows handles, blocks value editing and details.
    await ui.enterEditMode(page, 'Arrange');
    await page.getByRole('button', { name: 'Reorder Rent', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Reorder group / }).count(), 2);
    await ui.cell(page, 'Rent', 'Jan').click();
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
    await screenshot(page, `${label.replace(' ', '-')}-arrange`);
    await ui.exitEditMode(page);
    await page.getByRole('button', { name: 'Reorder Rent', exact: true }).waitFor({ state: 'detached' });

    // F10/F11: tag mode edits month tags; existing notes are rendered.
    assert.equal(await page.getByText('Synthetic note', { exact: true }).count(), 1);
    assert.equal(await ui.cellNote(page, 'Groceries', 'Feb'), 'Synthetic note');
    assert.equal(await ui.cellNote(page, 'Groceries', 'Jan'), null);
    await ui.enterEditMode(page, 'Tags');
    await ui.cell(page, 'Rent', 'Mar').click();
    let tag = ui.dialog(page, 'Mar details');
    assert.equal(await tag.getByRole('button', { name: 'None', exact: true }).getAttribute('aria-pressed'), 'true');
    await tag.getByRole('button', { name: 'Orange', exact: true }).click();
    await tag.getByRole('textbox', { name: 'Note' }).fill('Check invoice');
    await screenshot(page, `${label.replace(' ', '-')}-tag`);
    await tag.getByRole('button', { name: 'Save', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 2, month: 'Mar', color: 'orange', text: 'Check invoice' });
    await tag.waitFor({ state: 'detached' });
    await page.getByText('Check invoice', { exact: true }).waitFor({ state: 'attached' });
    // Reopen: saved values are prefilled; Cancel and Escape do not save.
    await ui.cell(page, 'Rent', 'Mar').click();
    assert.equal(await tag.getByRole('button', { name: 'Orange', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await tag.getByRole('textbox', { name: 'Note' }).inputValue(), 'Check invoice');
    await tag.getByRole('button', { name: 'Cancel', exact: true }).click();
    await ui.cell(page, 'Rent', 'Mar').click();
    await page.keyboard.press('Escape');
    await tag.waitFor({ state: 'detached' });
    await expectNoWrite(api, w);
    // Clear removes the tag.
    await ui.cell(page, 'Rent', 'Mar').click();
    await tag.getByRole('button', { name: 'Clear', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/tags?entryId=2&month=Mar', null);
    await page.getByText('Check invoice', { exact: true }).waitFor({ state: 'detached' });
    // No colour and an empty note also remove the tag.
    await ui.cell(page, 'Groceries', 'Feb').click();
    tag = ui.dialog(page, 'Feb details');
    assert.equal(await tag.getByRole('button', { name: 'Green', exact: true }).getAttribute('aria-pressed'), 'true');
    await tag.getByRole('button', { name: 'None', exact: true }).click();
    await tag.getByRole('textbox', { name: 'Note' }).fill('');
    await tag.getByRole('button', { name: 'Save', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/tags?entryId=1&month=Feb', null);
    // Enter in the note saves.
    await ui.cell(page, 'Gifts', 'Jan').click();
    tag = ui.dialog(page, 'Jan details');
    await tag.getByRole('button', { name: 'Grey', exact: true }).click();
    await tag.getByRole('textbox', { name: 'Note' }).fill('Birthday');
    await tag.getByRole('textbox', { name: 'Note' }).press('Enter');
    w = await expectWrite(api, w, 'POST', '/api/tags', { entryId: 4, month: 'Jan', color: 'grey', text: 'Birthday' });
    await ui.exitEditMode(page);

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
    // F23: progress and goals without target.
    await ui.goal(page, 'Emergency fund').filter({ hasText: '250,00 / 1 000,00' }).filter({ hasText: '25%' }).waitFor();
    await screenshot(page, `${label.replace(' ', '-')}-savings`);
    await ui.goal(page, 'Holiday').filter({ hasText: 'No target' }).waitFor();
    // F20: add goal.
    await page.getByRole('button', { name: /^(Add goal|New goal)$/ }).click();
    let goalDialog = ui.dialog(page, 'Add savings goal');
    await goalDialog.waitFor();
    await settleGoalDialog(page);
    await goalDialog.getByRole('textbox', { name: 'Name' }).fill('Car');
    await goalDialog.getByRole('textbox', { name: 'Target amount' }).fill('2000');
    await goalDialog.getByRole('button', { name: 'Add goal', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/savings', { year: 2026, name: 'Car', targetValue: 2000 });
    await goalDialog.waitFor({ state: 'detached' });
    await ui.goal(page, 'Car').waitFor();
    // F21: edit goal (prefilled), then clear the target.
    await page.getByRole('button', { name: 'Edit Emergency fund', exact: true }).click();
    goalDialog = ui.dialog(page, 'Edit savings goal');
    await expectValue(goalDialog.getByRole('textbox', { name: 'Name' }), 'Emergency fund');
    await settleGoalDialog(page);
    await expectValue(goalDialog.getByRole('textbox', { name: 'Target amount' }), '1 000,00');
    await goalDialog.getByRole('textbox', { name: 'Name' }).fill('Safety fund');
    await goalDialog.getByRole('textbox', { name: 'Target amount' }).fill('1500');
    await goalDialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/savings/200', { name: 'Safety fund', targetValue: 1500 });
    await goalDialog.waitFor({ state: 'detached' });
    await ui.goal(page, 'Safety fund').filter({ hasText: '250,00 / 1 500,00' }).waitFor();
    await page.getByRole('button', { name: 'Edit Safety fund', exact: true }).click();
    await expectValue(goalDialog.getByRole('textbox', { name: 'Target amount' }), '1 500,00');
    await settleGoalDialog(page);
    await goalDialog.getByRole('textbox', { name: 'Target amount' }).fill('');
    await goalDialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/savings/200', { name: 'Safety fund', targetValue: null });
    await goalDialog.waitFor({ state: 'detached' });
    await ui.goal(page, 'Safety fund').filter({ hasText: 'No target' }).waitFor();
    // Remove goal needs confirmation; clicking elsewhere cancels it.
    await page.getByRole('button', { name: 'Remove Holiday', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm removal of Holiday', exact: true }).waitFor();
    await ui.search(page).click();
    await ui.search(page).press('Escape');
    await page.getByRole('button', { name: 'Remove Holiday', exact: true }).click();
    await expectNoWrite(api, w);
    await page.getByRole('button', { name: 'Confirm removal of Holiday', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/savings/210', null);
    await ui.goal(page, 'Holiday').waitFor({ state: 'detached' });

    // F22: items, temporary withdrawal and balance.
    await ui.goal(page, 'Safety fund').click();
    await page.getByText('Temporary withdrawal', { exact: true }).waitFor();
    const balance = page.getByText('Current balance', { exact: true }).locator('..');
    await expectText(balance, /250,00$/);
    await page.getByRole('button', { name: '+ Add item', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/savings/200/items', {});
    const note = page.getByRole('textbox', { name: 'Source or note' });
    const amount = page.getByRole('textbox', { name: 'Amount' });
    await expectFocused(note);
    await note.fill('Car repair');
    await amount.fill('abc-20');
    assert.equal(await amount.inputValue(), '-20');
    assert.equal(await page.getByText('Temporary withdrawal', { exact: true }).count(), 2);
    await screenshot(page, `${label.replace(' ', '-')}-savings-edit`);
    await amount.press('Enter');
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/1001', { name: 'Car repair', value: -20 });
    await page.getByText('Car repair', { exact: true }).waitFor();
    await expectText(balance, /230,00$/);
    await page.getByRole('button', { name: 'Edit Contribution', exact: true }).click();
    await expectFocused(note);
    await amount.fill('400');
    await page.getByRole('button', { name: 'Save item', exact: true }).click();
    w = await expectWrite(api, w, 'PATCH', '/api/savings/items/201', { name: 'Contribution', value: 400 });
    await page.getByText('+400,00', { exact: true }).waitFor();
    await expectText(balance, /330,00$/);
    // Escape on a new blank item removes it.
    await page.getByRole('button', { name: '+ Add item', exact: true }).click();
    w = await expectWrite(api, w, 'POST', '/api/savings/200/items', {});
    await note.press('Escape');
    w = await expectWrite(api, w, 'DELETE', '/api/savings/items/1002', null);
    await note.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Remove Repair', exact: true }).click();
    w = await expectWrite(api, w, 'DELETE', '/api/savings/items/202', null);
    await page.getByText('Repair', { exact: true }).waitFor({ state: 'detached' });
    await expectText(balance, /380,00$/);
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
    const edit = page.getByRole('button', { name: 'Edit Emergency fund', exact: true });
    await edit.click();
    const goal = ui.dialog(page, 'Edit savings goal');
    await goal.waitFor();
    await expectFocused(goal.getByRole('textbox', { name: 'Name' }));
    await settleGoalDialog(page);
    // Escape in the target field is handled by the field and keeps the dialog open.
    // Known defect (F21, Phase 6): it should restore 1 000,00, but the blur that
    // follows reformats the stale draft, so the typed value stays.
    const target = goal.getByRole('textbox', { name: 'Target amount' });
    await target.fill('5');
    await target.press('Escape');
    await expectValue(target, '5,00');
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
    await ui.cell(page, 'Groceries', 'Jan').click();
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
