// Run after the frontend build. Use an existing Playwright installation via
// MOPAY_PLAYWRIGHT_MODULE, or install Playwright separately for local checks.
// No backend, real session, financial data or outbound requests are used.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { randomInt, randomBytes } from 'node:crypto';
import { chromium, hooks, serveAsset, ui } from './ui-helpers.mjs';

const layouts = {};

async function fixture(route) {
  const url = new URL(route.request().url());
  if (url.hostname !== 'mopay.test') return route.fulfill({ json: [] });
  if (url.pathname.startsWith('/api/')) {
    const income = url.searchParams.get('type') === 'income';
    const responses = {
      '/api/years': { years: [2025, 2026] },
      '/api/meta': { version: '1.6.3', channel: 'main', demo: false },
      '/api/encryption/status': { encryptionEnabled: false, keyMismatch: false },
      '/api/entries': { entries: [{ id: income ? 2 : 1, name: income ? 'Test salary' : 'Test groceries', groupId: 10, sort_index: 0, Jan: 100, comment: 'Synthetic fixture' }] },
      '/api/entry-groups': { groups: [{ id: 10, name: 'Test group', sortIndex: 0 }] },
      '/api/tags': { tags: [] },
      '/api/savings': { goals: [{ id: 200, name: 'Synthetic savings', targetValue: 1000, sortIndex: 1, items: [{ id: 201, name: 'Synthetic contribution', value: 100, sortIndex: 1 }] }] },
    };
    assert.ok(url.pathname in responses, `Unexpected API call: ${url.pathname}`);
    return route.fulfill({ json: responses[url.pathname] });
  }
  return serveAsset(route, url);
}

// Sample actual computed opacity on animation frames, including ancestors.
async function sample(page, selector, action, ancestorOpacity = false) {
  await page.evaluate(({ selector, ancestorOpacity }) => {
    window.opacityFrames = [];
    const sampleId = window.opacitySampleId = (window.opacitySampleId || 0) + 1;
    const frame = () => {
      if (window.opacitySampleId !== sampleId) return;
      let node = document.querySelector(selector);
      let opacity = node ? 1 : 0;
      while (node) {
        opacity *= Number(getComputedStyle(node).opacity);
        node = ancestorOpacity ? node.parentElement : null;
      }
      window.opacityFrames.push(opacity);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, { selector, ancestorOpacity });
  await action();
  // Include a stable ending even on throttled headless rendering; retain the
  // minimum frame count and every opacity/reversal assertion.
  await page.waitForTimeout(650);
  return page.evaluate(() => {
    window.opacitySampleId++;
    return window.opacityFrames;
  });
}

function monotonic(frames, direction) {
  assert.ok(frames.length > 5, `Enough animation frames were sampled (received ${frames.length})`);
  for (let i = 1; i < frames.length; i++) {
    assert.ok(direction * (frames[i] - frames[i - 1]) >= -0.04,
      `Opacity reversed direction: ${frames[i - 1]} -> ${frames[i]}`);
  }
  assert.ok(Math.abs(frames.at(-1) - (direction === 1 ? 1 : 0)) < 0.01);
}

async function capture(page, name) {
  const smallInputs = await page.evaluate(() => {
    if (!matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)').matches) return [];
    return [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')]
      .filter(node => node.getClientRects().length && !['checkbox', 'radio', 'range', 'color', 'file', 'hidden', 'button', 'submit', 'reset'].includes(node.type))
      .filter(node => parseFloat(getComputedStyle(node).fontSize) < 16)
      .map(node => node.id || node.className);
  });
  assert.deepEqual(smallInputs, [], 'Mobile editable fields use at least 16px text');
  if (process.env.MOPAY_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/${name}.png` });
  }
  if (process.env.MOPAY_UI_METRICS) {
    // Deliberately class-based: these metrics compare the old design during migration.
    layouts[name] = await page.evaluate(() => [...document.querySelectorAll(
      '.app-container, .mainbar-shell, .table-content, .table-row-premium, .reports-story-hero, .savings-table, .modal-card-premium, .table-context-panel, .pin-guard-card, .btn, .input',
    )].filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).map(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        selector: node.className,
        rect: ['x', 'y', 'width', 'height'].map(key => Number(rect[key].toFixed(2))),
        color: style.color, background: style.backgroundColor, font: style.fontSize,
        radius: style.borderRadius, padding: style.padding, border: style.borderWidth,
      };
    }));
    await writeFile(process.env.MOPAY_UI_METRICS, JSON.stringify(layouts, null, 2) + '\n');
  }
}

for (const mobile of [false, true]) {
  for (const theme of ['light', 'dark']) {
    test(`${mobile ? 'mobile' : 'desktop'} ${theme}: PIN denial and monotonic unlock`, async () => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({
          viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
          serviceWorkers: 'block',
          isMobile: mobile,
          hasTouch: mobile,
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          window.cspViolations = [];
          document.addEventListener('securitypolicyviolation', event => {
            window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
          });
        });
        const pin = String(randomInt(10000000, 99999999));
        const token = randomBytes(32).toString('base64url');
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname === 'mopay.test' && url.pathname === '/api/pin/verify') {
            const valid = route.request().postDataJSON().pin === pin;
            return route.fulfill({ status: valid ? 200 : 401, json: valid ? { ok: true, sessionToken: token } : { ok: false } });
          }
          return fixture(route);
        });
        await page.addInitScript(({ theme }) => {
          localStorage.setItem('year', '2026');
          localStorage.setItem('theme', JSON.stringify(theme));
        }, { theme });
        await page.goto('http://mopay.test/');
        await ui.pinInput(page).waitFor();
        await page.waitForTimeout(600);
        const card = await page.locator(hooks.pinCard).boundingBox();
        assert.ok(card.x >= 0 && card.y >= 0 && card.x + card.width <= (mobile ? 390 : 1440), 'PIN card stays inside viewport');
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-pin`);
        await page.getByRole('button', { name: 'Enter', exact: true }).focus();
        await page.keyboard.press('Control+k');
        assert.equal(await page.locator('input[type="search"]:focus').count(), 0, 'Shortcut cannot focus the app behind PIN');
        await ui.unlock(page, '0000');
        await page.getByText('Wrong PIN', { exact: true }).waitFor();
        assert.equal(await ui.pinDialog(page).count(), 1);
        await ui.pinInput(page).waitFor({ state: 'visible' });
        await page.waitForTimeout(1900);
        await ui.pinInput(page).fill(pin);
        monotonic(await sample(page, hooks.pinCard, () => page.getByRole('button', { name: 'Enter', exact: true }).click(), true), -1);
        await ui.pinDialog(page).waitFor({ state: 'detached' });
        await page.waitForTimeout(400);
        assert.equal(await ui.pinDialog(page).count(), 0, 'Successful login does not reinsert PIN overlay');
        await page.getByText('Test groceries', { exact: true }).waitFor();
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.cspViolations), [], 'Existing UI produces no CSP violations');
      } finally {
        await browser.close();
      }
    });
  }
}

for (const mobile of [false, true]) {
  for (const theme of ['light', 'dark']) {
    const viewMode = theme === 'dark' ? 'compact' : 'normal';
    test(`${mobile ? 'mobile' : 'desktop'} ${theme} ${viewMode}: stable tables and overlays`, async () => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({
          viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
          serviceWorkers: 'block',
          isMobile: mobile,
          hasTouch: mobile,
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          window.cspViolations = [];
          document.addEventListener('securitypolicyviolation', event => {
            window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
          });
        });
        await page.route('**/*', fixture);
        await page.addInitScript(({ theme, viewMode }) => {
          localStorage.setItem('year', '2026');
          localStorage.setItem('theme', JSON.stringify(theme));
          localStorage.setItem('viewMode', JSON.stringify(viewMode));
          sessionStorage.setItem('pin-ok', '1');
          sessionStorage.setItem('pin-token', 'synthetic-ui-test');
        }, { theme, viewMode });
        await page.goto('http://mopay.test/');
        await page.getByText('Test groceries', { exact: true }).waitFor();
        await page.waitForTimeout(500);

        for (const tab of ['Incomes', 'Expenses', 'Incomes', 'Expenses']) {
          const frames = await sample(page, hooks.table, () =>
            ui.openSection(page, tab), true);
          assert.ok(frames.every(value => value === 1), 'Table must stay fully opaque');
          await page.getByText(tab === 'Incomes' ? 'Test salary' : 'Test groceries', { exact: true }).waitFor();
        }
        const rapidFrames = await sample(page, hooks.table, () => page.evaluate(async () => {
          for (const label of ['Incomes', 'Expenses', 'Incomes', 'Expenses']) {
            [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent.trim() === label).click();
            await new Promise(resolve => setTimeout(resolve, 30));
          }
        }), true);
        assert.ok(rapidFrames.every(value => value === 1), 'Rapid switches must not dim the table');

        // Persist both tables as collapsed, then sample what the browser actually paints.
        for (const tab of ['Incomes', 'Expenses']) {
          await ui.openSection(page, tab);
          await ui.collapseGroup(page).click();
        }
        for (const tab of ['Incomes', 'Expenses', 'Savings', 'Expenses']) {
          const frames = await sample(page, hooks.expandedGroup, () => ui.openSection(page, tab));
          assert.ok(frames.length > 5 && frames.every(value => value === 0),
            'Saved collapsed groups must never paint expanded during menu switches');
        }
        await page.evaluate(() => {
          // An empty uncached table also renders the Ungrouped placeholder.
          localStorage.setItem('group-collapsed:expense:2025', JSON.stringify({ 'g:10': true, ungrouped: true }));
        });
        for (const year of ['2025', '2026']) {
          await ui.yearSwitch(page).click();
          const frames = await sample(page, hooks.expandedGroup, () =>
            page.getByRole('option', { name: year, exact: true }).click());
          assert.ok(frames.length > 5 && frames.every(value => value === 0),
            'Saved collapsed groups must never paint expanded during year switches');
          await ui.expandGroup(page).waitFor();
        }
        for (const tab of ['Incomes', 'Expenses']) {
          await ui.openSection(page, tab);
          await ui.expandGroup(page).click();
          await page.getByText(tab === 'Incomes' ? 'Test salary' : 'Test groceries', { exact: true }).waitFor();
        }

        for (const [section, item] of [['Expenses', 'Test groceries'], ['Incomes', 'Test salary'], ['Savings', 'Synthetic savings']]) {
          await ui.openSection(page, section);
          await page.getByText(item, { exact: true }).waitFor();
          const search = ui.search(page);
          assert.equal(await search.count(), 1);
          for (const key of ['/', 'Control+k', 'Meta+k']) {
            await search.evaluate(node => node.blur());
            await page.keyboard.press(key);
            assert.equal(await search.evaluate(node => node === document.activeElement), true);
          }
          await search.fill('No matching synthetic fixture');
          await page.getByText(item, { exact: true }).waitFor({ state: 'hidden' });
          await search.fill(item);
          await page.getByText(item, { exact: true }).waitFor();
          await search.press('/');
          assert.equal(await search.inputValue(), item + '/');
          await search.press('Escape');
          assert.equal(await search.inputValue(), '');
          assert.equal(await search.evaluate(node => node === document.activeElement), false);
          await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-search-${section.toLowerCase()}`);
        }
        await ui.openSection(page, 'Reports');
        // Search is disabled on Reports today; Overview may hide it instead (plan F03).
        const disabledSearch = ui.search(page);
        assert.equal(await disabledSearch.isDisabled(), true);
        await page.keyboard.press('Control+k');
        assert.equal(await page.locator('input[type="search"]:focus').count(), 0);
        await ui.openSection(page, 'Expenses');
        await page.getByText('Test groceries', { exact: true }).waitFor();

        if (mobile) {
          for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 767, height: 844 }, { width: 900, height: 400 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(200);
            // Each toolbar control must be present exactly once (boundingBox is strict).
            const year = await ui.yearSwitch(page).boundingBox();
            const menu = await ui.appMenu(page).boundingBox();
            const search = await ui.search(page).boundingBox();
            const lock = await ui.lock(page).boundingBox();
            const themeButton = await ui.themeToggle(page).boundingBox();
            await capture(page, `mobile-${theme}-${viewport.width}-search-row`);
            const layout = JSON.stringify({ viewport, year, menu, search, lock, themeButton });
            assert.ok(year.x + year.width <= menu.x && menu.x + menu.width <= search.x && search.x + search.width <= lock.x && lock.x + lock.width <= themeButton.x, layout);
            assert.ok(search.width >= 60 && themeButton.x + themeButton.width <= viewport.width, 'Search fits between menu and lock without toolbar overflow: ' + layout);
            assert.ok(Math.abs(menu.y - search.y) < 7 && Math.abs(lock.y - search.y) < 7, 'Controls share one row');
            assert.equal(await ui.search(page).count(), 1);
            await page.keyboard.press('/');
            assert.equal(await ui.search(page).evaluate(node => node === document.activeElement), true);
            await page.keyboard.press('Escape');
            await capture(page, `mobile-${theme}-${viewport.width}-search-row`);
          }
          await page.setViewportSize({ width: 390, height: 844 });
        }
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-table`);
        for (const section of ['Savings', 'Reports']) {
          await ui.openSection(page, section);
          if (section === 'Savings') await page.getByText('Synthetic savings', { exact: true }).waitFor();
          else await ui.annualTotals(page).waitFor();
          await page.waitForTimeout(500);
          await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-${section.toLowerCase()}`);
        }
        await ui.openSection(page, 'Expenses');
        await page.getByText('Test groceries', { exact: true }).waitFor();
        await page.waitForTimeout(350);

        const openEntry = () => ui.openNew(page, 'Entry');
        monotonic(await sample(page, hooks.dialog, openEntry, true), 1);
        assert.equal(await page.locator(hooks.dialogBackdrop).evaluate(node => getComputedStyle(node).backdropFilter), 'none');
        await page.locator('#entry-name-input').fill('Draft');
        await page.keyboard.press('Control+k');
        assert.equal(await page.locator('#entry-name-input').evaluate(node => node === document.activeElement), true);
        await page.locator('#entry-name-input').press('/');
        assert.equal(await page.locator('#entry-name-input').inputValue(), 'Draft/');
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-modal`);
        await ui.closeDialog(page).focus();
        await page.keyboard.press('/');
        assert.equal(await page.locator('input[type="search"]:focus').count(), 0, 'Shortcut cannot steal focus from an open modal');
        monotonic(await sample(page, hooks.dialog, () => ui.closeDialog(page).click(), true), -1);
        await openEntry();
        await ui.closeDialog(page).click();
        await openEntry();
        await page.waitForTimeout(300);
        assert.equal(await page.locator(hooks.dialogBackdrop).count(), 1, 'Rapid reopen leaves one overlay');
        assert.equal(await ui.dialog(page).count(), 1, 'Rapid reopen leaves one dialog');
        await ui.closeDialog(page).click();
        await ui.dialog(page).waitFor({ state: 'detached' });

        for (const target of ['Test groceries', 'Test group']) {
          monotonic(await sample(page, hooks.dialog, () => ui.openDetails(page, target)), 1);
          assert.equal(await page.locator(hooks.detailsBackdrop).evaluate(node => getComputedStyle(node).backdropFilter), 'none');
          const box = await ui.details(page).boundingBox();
          assert.ok(box.x >= 0 && box.y >= 0, 'Details stay within the viewport');
          await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-${target === 'Test group' ? 'group' : 'entry'}`);
          monotonic(await sample(page, hooks.dialog, () => page.keyboard.press('Escape')), -1);
        }
        assert.deepEqual(errors, [], 'No uncaught browser errors');
      } finally {
        await browser.close();
      }
    });
  }
}

for (const mobile of [false, true]) {
  for (const theme of ['light', 'dark']) {
    test(`${mobile ? 'mobile' : 'desktop'} ${theme}: demo read-only UI and mode changes`, async () => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
        let demo = true;
        let metadataFails = true;
        let validToken = '';
        const writes = [];
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ theme }) => {
          localStorage.setItem('theme', JSON.stringify(theme));
          if (!localStorage.getItem('demo-fixture-initialized')) {
            localStorage.setItem('year', '2025');
            localStorage.setItem('tab', JSON.stringify('expenses'));
            localStorage.setItem('demo-fixture-initialized', 'true');
            sessionStorage.setItem('pin-token', 'expired-normal-token');
            sessionStorage.setItem('pin-ok', '1');
          }
        }, { theme });
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname !== 'mopay.test' || !url.pathname.startsWith('/api/')) return fixture(route);
          if (url.pathname === '/api/meta') {
            if (metadataFails) return route.fulfill({ status: 503, json: {} });
            return route.fulfill({ json: { version: '1.6.3', channel: 'main', demo, ...(demo ? { demoPin: '1234' } : {}) } });
          }
          if (url.pathname === '/api/pin/verify') {
            const ok = route.request().postDataJSON().pin === (demo ? '1234' : '87654321');
            if (ok) validToken = demo ? 'demo-fixture-token' : 'normal-fixture-token';
            return route.fulfill({ status: ok ? 200 : 401, json: ok ? { ok: true, sessionToken: validToken } : { ok: false } });
          }
          if (url.pathname !== '/api/encryption/status' && route.request().headers()['x-mopay-session'] !== validToken) return route.fulfill({ status: 401, json: { error: 'INVALID_SESSION' } });
          if (route.request().method() !== 'GET') writes.push(url.pathname);
          if (url.pathname === '/api/entries') return route.fulfill({ json: { entries: [{ id: 1, name: demo ? 'Demo groceries' : 'Private groceries', groupId: 10, sort_index: 0, Jan: 100, comment: 'Synthetic fixture' }] } });
          return fixture(route);
        });
        await page.goto('http://mopay.test/');
        await page.getByText('Could not load application mode.', { exact: false }).waitFor();
        assert.equal(await ui.newButton(page).count(), 0);
        assert.equal(await page.getByText('Demo PIN:', { exact: false }).count(), 0);
        metadataFails = false;
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await page.getByText('Demo PIN: 1234', { exact: false }).waitFor();
        assert.equal(await page.getByText('Private groceries', { exact: true }).count(), 0);
        await ui.unlock(page, '1234');
        await ui.pinDialog(page).waitFor({ state: 'detached' });
        await page.getByText('Demo groceries', { exact: true }).waitFor();
        assert.equal(await ui.demoBanner(page).count(), 1);
        assert.equal(await ui.newButton(page).count() + await ui.editMenu(page).count(), 0);
        await ui.cell(page, 'Demo groceries', 'Jan').click();
        assert.equal(await page.getByRole('textbox').count(), 0, 'Demo values cannot be edited');
        await ui.openDetails(page, 'Demo groceries');
        await ui.details(page).waitFor();
        assert.equal(await ui.details(page).getByRole('textbox', { name: 'Name' }).evaluate(node => node.readOnly), true);
        assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).count(), 0);
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-demo-details`);
        await ui.closeDetails(page).click();
        await ui.details(page).waitFor({ state: 'detached' });
        for (const name of ['Incomes', 'Savings', 'Reports', 'Expenses']) {
          await ui.openSection(page, name);
          if (name === 'Savings') {
            await page.getByText('Synthetic savings', { exact: true }).click();
            await page.getByText('Synthetic contribution', { exact: true }).waitFor();
            assert.equal(await page.getByRole('button', { name: /^Edit |^Remove / }).count(), 0);
            assert.equal(await page.getByRole('button', { name: '+ Add item', exact: true }).isDisabled(), true);
          }
        }
        await ui.search(page).fill('Demo groceries');
        await page.getByText('Demo groceries', { exact: true }).waitFor();
        await ui.search(page).press('Escape');
        await ui.collapseGroup(page).click();
        await page.getByText('Demo groceries', { exact: true }).waitFor({ state: 'hidden' });
        await ui.expandGroup(page).click();
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-demo-table`);
        demo = false; validToken = '';
        await page.reload();
        await ui.pinInput(page).waitFor();
        assert.equal(await ui.demoBanner(page).count(), 0);
        assert.equal(await page.getByText('Demo groceries', { exact: true }).count(), 0);
        await ui.unlock(page, '87654321');
        await page.getByText('Private groceries', { exact: true }).waitFor();
        assert.equal(await ui.yearSwitch(page).getAttribute('aria-label'), 'Working year 2025');
        demo = true; validToken = '';
        await page.reload();
        await page.getByText('Demo PIN: 1234', { exact: false }).waitFor();
        assert.equal(await page.getByText('Private groceries', { exact: true }).count(), 0);
        assert.deepEqual(writes, []);
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });
  }
}
