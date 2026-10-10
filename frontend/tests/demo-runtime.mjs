// Full demo generator/API/UI contract with disposable storage and loopback only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { chromium, ui } from './ui-helpers.mjs';
const backend = path.resolve(import.meta.dirname, '../../backend');

test('real demo dataset renders desktop/mobile Expenses, Incomes, Savings and Reports', { timeout: 30000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mopay-demo-browser-'));
  let child, browser;
  try {
    for (const name of await fs.readdir(backend)) if (/\.(js|sql)$/.test(name) || name === 'package.json') await fs.copyFile(path.join(backend, name), path.join(root, name));
    await fs.symlink(path.join(backend, 'node_modules'), path.join(root, 'node_modules'));
    await fs.symlink(path.resolve(import.meta.dirname, '../dist'), path.join(root, 'public'));
    const source = await fs.readFile(path.join(root, 'server.js'), 'utf8');
    await fs.writeFile(path.join(root, 'server.js'), source.replace('app.listen(PORT,', "const fixtureServer = app.listen(PORT, '127.0.0.1',").replace("console.log('Mopay app listening on :' + PORT);", "console.log('Fixture port: ' + fixtureServer.address().port);"));
    child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DB_FILE: path.join(root, 'mopay.sqlite'), APP_DEMO: 'true', APP_PIN: '', APP_ENC_KEY: randomBytes(32).toString('base64'), SECURITY_WEBHOOK_URL: '', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    child.stdout.on('data', value => { logs += value; }); child.stderr.on('data', value => { logs += value; });
    for (let i = 0; i < 150 && child.exitCode === null && !logs.includes('Fixture port:'); i++) await new Promise(resolve => setTimeout(resolve, 20));
    const port = logs.match(/Fixture port: (\d+)/)?.[1];
    assert.ok(port, 'Isolated demo backend started');
    const origin = `http://127.0.0.1:${port}`;
    browser = await chromium.launch();
    for (const mobile of [false, true]) {
      const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ json: [] }));
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await page.getByText('Demo PIN: 1234', { exact: false }).waitFor();
      await ui.unlock(page, '1234');
      await ui.pinDialog(page).waitFor({ state: 'detached' });
      await ui.annualTotals(page).waitFor();
      assert.equal(await ui.currentSection(page), 'Overview');
      await ui.openSection(page, 'Expenses');
      await page.getByText('Rent', { exact: true }).waitFor();
      // Every group row, including Ungrouped, has exactly one collapse control.
      assert.equal(await ui.collapseGroup(page).count(), 8);
      await ui.collapseGroup(page).first().click();
      await page.getByText('Rent', { exact: true }).waitFor({ state: 'hidden' });
      await ui.openSection(page, 'Incomes');
      await page.getByText('Main salary', { exact: true }).waitFor();
      await ui.openSection(page, 'Savings');
      await ui.openGoal(page, 'Emergency fund');
      await page.getByText('Contribution 1', { exact: true }).waitFor();
      await ui.openSection(page, 'Overview');
      await ui.annualTotals(page).waitFor();
      if (process.env.MOPAY_SCREENSHOTS) await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/real-demo-${mobile ? 'mobile' : 'desktop'}-reports.png` });
      await ui.openSection(page, 'Expenses');
      await page.getByText('Groceries', { exact: true }).waitFor();
      if (process.env.MOPAY_SCREENSHOTS) await page.screenshot({ path: `${process.env.MOPAY_SCREENSHOTS}/real-demo-${mobile ? 'mobile' : 'desktop'}-expenses.png` });
      // Settings: no year creation, deletion or import in demo mode, each explained; export works.
      // Each section is its own sub-page, so every check opens its section first.
      await ui.openSettings(page);
      assert.equal(await (await ui.showSettingsSection(page, 'Danger zone')).getByRole('checkbox').count(), 0);
      const years = await ui.showSettingsSection(page, 'Years');
      await years.getByText('Demo data is read only. Years cannot be created or deleted.', { exact: true }).waitFor();
      assert.equal(await years.getByRole('button', { name: 'Add year', exact: true }).count(), 0);
      const data = await ui.showSettingsSection(page, 'Import & export');
      await data.getByText('Import is not available in demo mode.', { exact: true }).waitFor();
      assert.equal(await data.getByRole('button', { name: 'Import…', exact: true }).count(), 0);
      await data.getByRole('button', { name: 'Export…', exact: true }).click();
      await ui.dialog(page, 'Export data').getByRole('button', { name: /^\d{4}$/ }).first().click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: /^Export \d/ }).click();
      assert.equal((await download).suggestedFilename(), 'mopay_export.xlsx');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    await fs.rm(root, { recursive: true, force: true });
  }
});
