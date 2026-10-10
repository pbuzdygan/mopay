// Built frontend + real HTTP headers/PWA, synthetic responses, no external access.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { browserSecurityHeaders } from '../../backend/browserSecurity.js';
import { chromium, ui } from './ui-helpers.mjs';
const dist = resolve(import.meta.dirname, '../dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function serverFixture() {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture.test').pathname;
    // Unprotected parent proves that the child's frame-ancestors denies embedding.
    if (pathname === '/parent') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<iframe src="/"></iframe>');
    }
    for (const [name, value] of Object.entries(browserSecurityHeaders)) res.setHeader(name, value);
    if (pathname === '/probe') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<script src="/probe.js"></script><script>window.inlineExecuted = true</script><script src="https://forbidden.test/attack.js"></script>');
    }
    if (pathname === '/probe.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      return res.end(`window.violations=[]; document.addEventListener('securitypolicyviolation', e => window.violations.push(e.effectiveDirective)); window.allowedScript=true; try { eval('window.evalExecuted=true'); } catch { window.evalBlocked=true; } fetch('https://forbidden.test/leak').catch(() => {});`);
    }
    if (pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(pathname === '/api/meta' ? { version: '1.6.3', channel: 'main', demo: false } : { encryptionEnabled: false, keyMismatch: false }));
    }
    const file = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(dist + sep)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test('CSP blocks inline/eval/external scripts and connections; child denies framing', { timeout: 30000 }, async () => {
  const { server, origin } = await serverFixture();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const escaped = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin !== origin) {
        escaped.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(origin + '/probe');
    await page.waitForFunction(() => window.evalBlocked && window.violations.includes('connect-src'));
    assert.equal(await page.evaluate(() => window.allowedScript), true);
    assert.equal(await page.evaluate(() => window.inlineExecuted || window.evalExecuted), undefined);
    assert.deepEqual(escaped, [], 'CSP stops forbidden requests before network');
    await page.goto(origin + '/parent');
    await page.waitForTimeout(500);
    assert.equal(await page.frames()[1].locator('#root').count(), 0, 'Framed app cannot render');
    assert.match(page.frames()[1].url(), /^chrome-error:/, 'Browser refused framed navigation');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('CSP permits production PWA registration, controlled reload and offline document/assets', { timeout: 30000 }, async () => {
  const { server, origin } = await serverFixture();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    let githubRequests = 0;
    await context.route('https://**/*', route => {
      assert.equal(new URL(route.request().url()).origin, 'https://api.github.com');
      githubRequests++;
      return route.fulfill({ json: [], headers: { 'Access-Control-Allow-Origin': origin } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.violations = [];
      document.addEventListener('securitypolicyviolation', e => window.violations.push(e.effectiveDirective));
    });
    await page.goto(origin);
    await ui.pinInput(page).waitFor();
    await page.evaluate(async () => {
      const response = await fetch('https://api.github.com/repos/pbuzdygan/mopay/releases?per_page=30');
      if (!response.ok) throw new Error('Mock release request failed');
      await response.json();
    });
    assert.ok(githubRequests > 0, 'Release API is allowed and intercepted locally');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await ui.pinInput(page).waitFor();
    assert.deepEqual(await page.evaluate(() => window.violations), []);
    await context.setOffline(true);
    const response = await page.reload();
    assert.equal(response.fromServiceWorker(), true);
    assert.equal(response.headers()['content-security-policy'], browserSecurityHeaders['Content-Security-Policy']);
    // Assets work offline, but runtime mode is NetworkOnly and must be confirmed online.
    await page.getByText('Could not load application mode.', { exact: false }).waitFor();
    assert.equal(await ui.pinInput(page).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.violations), []);
    assert.deepEqual(errors, []);
    // Download blob navigation is intentionally allowed without enabling blob scripts/workers.
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await ui.pinInput(page).waitFor();
    const download = page.waitForEvent('download');
    await page.evaluate(() => {
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(new Blob(['synthetic download']));
      anchor.download = 'fixture.txt';
      document.body.append(anchor); anchor.click(); anchor.remove();
    });
    assert.equal((await download).suggestedFilename(), 'fixture.txt');
    assert.deepEqual(await page.evaluate(() => window.violations), []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
