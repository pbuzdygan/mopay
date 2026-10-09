// Render-time measurement of the Expenses grid with a large synthetic year
// (200 entries in 10 groups, values in every month, some tags). It records a
// baseline before the grid is rebuilt and compares builds via MOPAY_UI_DIST;
// timings depend on the host, so only compare runs from the same machine.
// Set MOPAY_GRID_METRICS to a temporary JSON path to keep the results.
// Since Phase 2 the app starts on Overview and the sidebar loads the entries
// for its totals, so "first load" no longer includes the entries request.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium, sectionControlsSelector, serveAsset, ui } from './ui-helpers.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const groups = Array.from({ length: 10 }, (_, index) => ({ id: 100 + index, name: `Group ${index + 1}`, sortIndex: index }));
const entries = Array.from({ length: 200 }, (_, index) => ({
  id: 1000 + index,
  name: `Entry ${index + 1}`,
  groupId: 100 + (index % 10),
  sort_index: index,
  comment: '',
  ...Object.fromEntries(MONTHS.map((month, monthIndex) => [month === 'Dec' ? 'Decm' : month, ((index + 1) * 37 + monthIndex * 11) % 5000])),
}));
const tags = entries.filter((_, index) => index % 9 === 0).map(entry => ({ entryId: entry.id, month: 'Mar', color: 'orange', text: 'Synthetic note' }));
const runs = Number(process.env.MOPAY_GRID_RUNS || 7);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

test('Expenses grid render time with 200 entries', { timeout: 120000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('year', '2026');
      sessionStorage.setItem('pin-ok', '1');
      sessionStorage.setItem('pin-token', 'synthetic-ui-test');
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'mopay.test') return route.fulfill({ json: [] });
      if (!url.pathname.startsWith('/api/')) return serveAsset(route, url);
      const expense = url.searchParams.get('type') === 'expense';
      const responses = {
        '/api/meta': { version: '1.6.3', channel: 'main', demo: false },
        '/api/encryption/status': { encryptionEnabled: false, keyMismatch: false },
        '/api/years': { years: [2026] },
        '/api/entries': { entries: expense ? entries : [] },
        '/api/entry-groups': { groups: expense ? groups : [] },
        '/api/tags': { tags },
        '/api/savings': { goals: [] },
      };
      assert.ok(url.pathname in responses, `Unexpected API call: ${url.pathname}`);
      return route.fulfill({ json: responses[url.pathname] });
    });
    await page.goto('http://mopay.test/');
    await ui.section(page, 'Expenses').waitFor();

    // Time from the tab click to the second frame after all 200 rows exist,
    // so layout and paint of the complete grid are included.
    const measure = (fromTab, toTab) => page.evaluate(({ fromTab, toTab, selector }) => new Promise(resolve => {
      const tab = label => [...document.querySelectorAll(selector)].find(node => node.getClientRects().length && node.textContent.trim().startsWith(label));
      tab(fromTab).click();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const start = performance.now();
        tab(toTab).click();
        const poll = () => {
          if (document.querySelectorAll('button[aria-label*=", Jan: "]').length === 200) {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
          } else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }));
    }), { fromTab, toTab, selector: sectionControlsSelector });

    const first = await measure('Savings', 'Expenses');
    const cached = [];
    for (let i = 0; i < runs; i++) cached.push(await measure('Savings', 'Expenses'));
    const tabSwitch = [];
    for (let i = 0; i < runs; i++) tabSwitch.push(await measure('Incomes', 'Expenses'));
    const result = {
      dist: process.env.MOPAY_UI_DIST || 'frontend/dist',
      entries: entries.length,
      firstLoadMs: Number(first.toFixed(1)),
      cachedFromSavingsMedianMs: Number(median(cached).toFixed(1)),
      cachedFromIncomesMedianMs: Number(median(tabSwitch).toFixed(1)),
      samples: { cached: cached.map(v => Number(v.toFixed(1))), tabSwitch: tabSwitch.map(v => Number(v.toFixed(1))) },
    };
    console.log(JSON.stringify(result));
    if (process.env.MOPAY_GRID_METRICS) await writeFile(process.env.MOPAY_GRID_METRICS, JSON.stringify(result, null, 2) + '\n');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
