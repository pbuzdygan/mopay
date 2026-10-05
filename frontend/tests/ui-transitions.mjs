// Run after the frontend build. Use an existing Playwright installation via
// MOPAY_PLAYWRIGHT_MODULE, or install Playwright separately for local checks.
// No backend, real session, financial data or outbound requests are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MOPAY_PLAYWRIGHT_MODULE || 'playwright');
const dist = resolve(import.meta.dirname, '../dist');
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

        const openEntry = async () => {
          await page.locator('.context-new-button:visible').click();
          await page.getByRole('button', { name: 'Entry', exact: true }).click();
        };
        const modal = '.modal-overlay-premium';
        monotonic(await sample(page, '.modal-card-premium', openEntry, true), 1);
        assert.equal(await page.locator(modal).evaluate(node => getComputedStyle(node).backdropFilter), 'none');
        await page.locator('#entry-name-input').fill('Draft');
        if (process.env.MOPAY_SCREENSHOTS) {
          await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/${mobile ? 'mobile' : 'desktop'}-${theme}-modal.png` });
        }
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
          if (process.env.MOPAY_SCREENSHOTS) {
            await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/${mobile ? 'mobile' : 'desktop'}-${theme}.png` });
          }
          monotonic(await sample(page, '.table-context-panel', () => page.keyboard.press('Escape')), -1);
        }
        assert.deepEqual(errors, [], 'No uncaught browser errors');
      } finally {
        await browser.close();
      }
    });
  }
}
