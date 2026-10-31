import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = resolve('dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.json': 'application/json', '.woff2': 'font/woff2', '.xml': 'application/xml'
};
const base = '/tools-website/';

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
  if (!pathname.startsWith(base)) {
    res.writeHead(404); res.end('Not on this project site'); return;
  }
  const filePath = pathname.slice(base.length) || 'index.html';
  const target = resolve(root, filePath);
  if (!target.startsWith(root + sep)) {
    res.writeHead(403); res.end(); return;
  }
  // GitHub Pages serves this copied 404 page on direct visits to SPA routes.
  const real = existsSync(target) ? target : resolve(root, '404.html');
  if (!existsSync(real)) { res.writeHead(404); res.end(); return; }
  res.statusCode = existsSync(target) ? 200 : 404;
  res.setHeader('Content-Type', mime[extname(real)] || 'application/octet-stream');
  res.end(readFileSync(real));
});
await new Promise(ok => server.listen(4177, '127.0.0.1', ok));

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const runtimeErrors = [];
  const assetErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && url.includes('/tools-website/assets/')) {
      assetErrors.push(response.status() + ' ' + url);
    }
  });

  const rootUrl = 'http://127.0.0.1:4177/tools-website/';
  const response = await page.goto(rootUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('#root header', { timeout: 25000 });
  assert.equal(response?.status(), 200, 'Project home URL returned non-200');
  assert.ok((await page.locator('#root').innerText()).includes('QR'), 'Home page did not render real React content');

  const compiledSrc = await page.locator('script[type="module"]').getAttribute('src');
  assert.match(compiledSrc || '', /^\/tools-website\/assets\/.+\.js$/, 'Bundle is not loaded from project base path');
  assert.equal(assetErrors.length, 0, 'Compiled asset 404s: ' + JSON.stringify(assetErrors));
  assert.equal(runtimeErrors.length, 0, 'Homepage JavaScript crashes: ' + JSON.stringify(runtimeErrors));

  await page.locator('header nav button').filter({ hasText: 'QR Generator' }).click();
  assert.equal(new URL(page.url()).pathname, '/tools-website/qr-code-generator', 'App navigation lost project base path');
  assert.ok((await page.locator('#root').innerText()).includes('QR'), 'QR tool page did not render');

  // Direct deep-link reload: Pages serves copied 404.html containing the app.
  await page.goto(rootUrl + 'qr-code-generator', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('#root header', { timeout: 25000 });
  assert.ok((await page.locator('#root').innerText()).includes('QR'), 'Direct deep link did not render on static fallback');
  assert.equal(runtimeErrors.length, 0, 'Browser errors after navigation: ' + JSON.stringify(runtimeErrors));

  console.log('PASS: tools-website home, Vite JS assets, QR tool routing, and SPA deep links render.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
