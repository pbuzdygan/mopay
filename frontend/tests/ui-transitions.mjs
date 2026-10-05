// Run after the frontend build. Use an existing Playwright installation via
// MOPAY_PLAYWRIGHT_MODULE, or install Playwright separately for local checks.
// No backend, real session, financial data or outbound requests are used.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { test } from 'node:test';
import { randomInt, randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MOPAY_PLAYWRIGHT_MODULE || 'playwright');
const dist = process.env.MOPAY_UI_DIST ? resolve(process.env.MOPAY_UI_DIST) : resolve(import.meta.dirname, '../dist');
const layouts = {};
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function fixture(route) {
  const url = new URL(route.request().url());
  if (url.hostname !== 'mopay.test') return route.fulfill({ json: [] });
  if (url.pathname.startsWith('/api/')) {
    const income = url.searchParams.get('type') === 'income';
    const responses = {
      '/api/years': { years: [2025, 2026] },
      '/api/meta': { version: '1.6.2', channel: 'main' },
      '/api/encryption/status': { encryptionEnabled: false, keyMismatch: false },
      '/api/entries': { entries: [{ id: income ? 2 : 1, name: income ? 'Test salary' : 'Test groceries', groupId: 10, sort_index: 0, Jan: 100, comment: 'Synthetic fixture' }] },
      '/api/entry-groups': { groups: [{ id: 10, name: 'Test group', sortIndex: 0 }] },
      '/api/tags': { tags: [] },
      '/api/savings': { goals: [{ id: 200, name: 'Synthetic savings', targetValue: 1000, sortIndex: 1, items: [{ id: 201, name: 'Synthetic contribution', value: 100, sortIndex: 1 }] }] },
    };
    assert.ok(url.pathname in responses, `Unexpected API call: ${url.pathname}`);
    return route.fulfill({ json: responses[url.pathname] });
  }
  const file = resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  assert.ok(file.startsWith(dist + sep));
  try {
    const body = await readFile(file);
    const extension = file.slice(file.lastIndexOf('.'));
    await route.fulfill({ body, contentType: mime[extension] || 'application/octet-stream' });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await route.fulfill({ status: 404, body: '' });
  }
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
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    window.opacitySampleId++;
    return window.opacityFrames;
  });
}

function monotonic(frames, direction) {
  assert.ok(frames.length > 5, 'Enough animation frames were sampled');
  for (let i = 1; i < frames.length; i++) {
    assert.ok(direction * (frames[i] - frames[i - 1]) >= -0.04,
      `Opacity reversed direction: ${frames[i - 1]} -> ${frames[i]}`);
  }
  assert.ok(Math.abs(frames.at(-1) - (direction === 1 ? 1 : 0)) < 0.01);
}

async function capture(page, name) {
  if (process.env.MOPAY_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/${name}.png` });
  }
  if (process.env.MOPAY_UI_METRICS) {
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
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
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
        await page.locator('#pin-guard-input').waitFor();
        await page.waitForTimeout(600);
        const card = await page.locator('.pin-guard-card').boundingBox();
        assert.ok(card.x >= 0 && card.y >= 0 && card.x + card.width <= (mobile ? 390 : 1440), 'PIN card stays inside viewport');
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-pin`);
        await page.locator('#pin-guard-input').fill('0000');
        await page.getByRole('button', { name: 'Enter', exact: true }).click();
        await page.getByText('Wrong PIN', { exact: true }).waitFor();
        assert.equal(await page.locator('.pin-guard-overlay').count(), 1);
        await page.locator('#pin-guard-input').waitFor({ state: 'visible' });
        await page.waitForTimeout(1900);
        await page.locator('#pin-guard-input').fill(pin);
        monotonic(await sample(page, '.pin-guard-card', () => page.getByRole('button', { name: 'Enter', exact: true }).click(), true), -1);
        await page.locator('.pin-guard-overlay').waitFor({ state: 'detached' });
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.pin-guard-overlay').count(), 0, 'Successful login does not reinsert PIN overlay');
        await page.getByText('Test groceries', { exact: true }).waitFor();
        assert.deepEqual(errors, []);
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
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
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
          const frames = await sample(page, '.table-content', () =>
            page.getByRole('tab', { name: tab }).click(), true);
          assert.ok(frames.every(value => value === 1), 'Table must stay fully opaque');
          await page.getByText(tab === 'Incomes' ? 'Test salary' : 'Test groceries', { exact: true }).waitFor();
        }
        const rapidFrames = await sample(page, '.table-content', () => page.evaluate(async () => {
          for (const label of ['Incomes', 'Expenses', 'Incomes', 'Expenses']) {
            [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent.trim() === label).click();
            await new Promise(resolve => setTimeout(resolve, 30));
          }
        }), true);
        assert.ok(rapidFrames.every(value => value === 1), 'Rapid switches must not dim the table');

        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-table`);
        for (const section of ['Savings', 'Reports']) {
          await page.getByRole('tab', { name: section }).click();
          if (section === 'Savings') await page.getByText('Synthetic savings', { exact: true }).waitFor();
          else await page.locator('.reports-story-hero').waitFor();
          await page.waitForTimeout(500);
          await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-${section.toLowerCase()}`);
        }
        await page.getByRole('tab', { name: 'Expenses' }).click();
        await page.getByText('Test groceries', { exact: true }).waitFor();
        await page.waitForTimeout(350);

        const openEntry = async () => {
          await page.locator('.context-new-button:visible').click();
          await page.getByRole('button', { name: 'Entry', exact: true }).click();
        };
        const modal = '.modal-overlay-premium';
        monotonic(await sample(page, '.modal-card-premium', openEntry, true), 1);
        assert.equal(await page.locator(modal).evaluate(node => getComputedStyle(node).backdropFilter), 'none');
        await page.locator('#entry-name-input').fill('Draft');
        await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-modal`);
        monotonic(await sample(page, '.modal-card-premium', () => page.locator(`${modal} .btn-ghost-premium`).click(), true), -1);
        await openEntry();
        await page.locator(`${modal} .btn-ghost-premium`).click();
        await openEntry();
        await page.waitForTimeout(300);
        assert.equal(await page.locator(modal).count(), 1, 'Rapid reopen leaves one overlay');
        await page.locator(`${modal} .btn-ghost-premium`).click();
        await page.locator(modal).waitFor({ state: 'detached' });

        for (const target of ['Test groceries', 'Test group']) {
          monotonic(await sample(page, '.table-context-panel', () => page.getByText(target, { exact: true }).click()), 1);
          assert.equal(await page.locator('.table-context-backdrop').evaluate(node => getComputedStyle(node).backdropFilter), 'none');
          const box = await page.locator('.table-context-panel').boundingBox();
          assert.ok(box.x >= 0 && box.y >= 0, 'Details stay within the viewport');
          await capture(page, `${mobile ? 'mobile' : 'desktop'}-${theme}-${target === 'Test group' ? 'group' : 'entry'}`);
          monotonic(await sample(page, '.table-context-panel', () => page.keyboard.press('Escape')), -1);
        }
        assert.deepEqual(errors, [], 'No uncaught browser errors');
      } finally {
        await browser.close();
      }
    });
  }
}
