import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
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
  // GitHub Pages serves generated /route/index.html with HTTP 200, rather
  // than a 404 fallback that cannot be indexed by Google.
  const real = existsSync(target)
    ? (statSync(target).isDirectory() ? resolve(target, 'index.html') : target)
    : resolve(root, '404.html');
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
  assert.equal(new URL(page.url()).pathname, '/tools-website/qr-code-generator/', 'App navigation lost project base path');
  assert.ok((await page.locator('#root').innerText()).includes('QR'), 'QR tool page did not render');

  // These deep links must return actual 200 pages, not SEO-hostile 404 fallbacks.
  const qrResponse = await page.goto(rootUrl + 'qr-code-generator/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  assert.equal(qrResponse?.status(), 200);
  await page.waitForSelector('#root header', { timeout: 25000 });
  assert.ok((await page.locator('#root').innerText()).includes('QR'), 'Direct deep link did not render on static fallback');
  for (const [slug, expectedTitle] of [
    ['about', 'About RankNova'],
    ['contact', 'Contact RankNova'],
    ['privacy-policy', 'Privacy Policy'],
    ['terms', 'Terms of Service']
  ]) {
    const response = await page.goto(rootUrl + slug + '/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    assert.equal(response?.status(), 200, slug + ' returned HTTP 404, which blocks indexing');
    await page.waitForSelector('#root header', { timeout: 25000 });
    assert.ok((await page.title()).includes(expectedTitle.split(' ')[0]), 'Missing title for ' + slug);
  }
  // Real Visiting Card Maker interactions and an actual client-side download.
  const cardResponse = await page.goto(rootUrl + 'visiting-card-generator/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  assert.equal(cardResponse?.status(), 200, 'Visiting card deep link must be indexable');
  await page.getByRole('heading', { name: 'Professional Visiting Card Maker' }).waitFor();
  await page.locator('#card-size').selectOption('eu');
  await page.locator('#card-font').selectOption('serif');
  assert.ok((await page.locator('#root').innerText()).includes('85 × 55 mm'), 'International business card size did not render');
  const imageDownload = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /Front JPG/i }).click();
  const jpg = await imageDownload;
  assert.match(jpg.suggestedFilename(), /\.jpg$/i, 'Front JPG button did not download a JPEG');
  const pdfDownload = page.waitForEvent('download', { timeout: 25000 });
  await page.getByRole('button', { name: /Download 2-Page Print PDF/i }).click();
  const pdf = await pdfDownload;
  assert.match(pdf.suggestedFilename(), /\.pdf$/i, '2-page PDF button did not download a PDF');
  assert.equal(runtimeErrors.length, 0, 'Browser errors after card exports: ' + JSON.stringify(runtimeErrors));

  const sitemapResponse = await page.goto(rootUrl + 'sitemap.xml');
  assert.equal(sitemapResponse?.status(), 200);
  const sitemap = await sitemapResponse?.text();
  assert.ok(sitemap?.includes('https://mmoavia7861.github.io/tools-website/privacy-policy/'), 'Legal page absent from sitemap');
  assert.ok(!sitemap?.includes('https://ranknova.app'), 'Unverified other domain remains in sitemap');
  assert.equal(runtimeErrors.length, 0, 'Browser errors after navigation: ' + JSON.stringify(runtimeErrors));

  console.log('PASS: tools-website home, Vite JS assets, QR tool routing, crawlable legal pages and sitemap render.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
