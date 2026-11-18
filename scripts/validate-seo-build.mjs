/**
 * Validate real, generated HTML before GitHub Pages/Cloudflare release.
 * This is a source/build test; it does not claim a live Lighthouse score.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist';
const read = path => readFileSync(join(root, path), 'utf8');
const xml = read('sitemap.xml');
const robots = read('robots.txt');
const urls = [...xml.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
assert.ok(urls.length >= 20, 'Missing expected public tool and legal routes');
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URL');
assert.ok(urls.every(url => url.startsWith('https://toolscresta.com/')), 'Sitemap must use primary ToolsCresta domain only');
assert.ok(!urls.some(url => url.includes('/admin/') || url.includes('/api/')), 'Sitemap exposed private/backend URL');
assert.match(robots, /Sitemap: https:\/\/toolscresta\.com\/sitemap\.xml/);

const titles = new Set();
for (const url of urls) {
  const route = new URL(url).pathname;
  const entry = route === '/' ? 'index.html' : route.slice(1) + 'index.html';
  assert.ok(existsSync(join(root, entry)), 'Missing indexable entrypoint ' + route);
  const html = read(entry);
  assert.match(html, /<meta name="description" content="[^"]+"/, route + ' lacks a description');
  assert.match(html, /<meta property="og:url" content="https:\/\/toolscresta\.com\//, route + ' lacks primary OG URL');
  assert.match(html, /"@type":"WebPage"/, route + ' lacks WebPage structured data');
  const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonical.length, 1, route + ' must have exactly one canonical');
  assert.equal(canonical[0][1], url, route + ' canonical differs from sitemap');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  assert.ok(title && title.length > 12 && !titles.has(title), 'Duplicate/missing title for ' + route);
  titles.add(title);
  assert.doesNotMatch(html, /<meta name="robots" content="noindex/i, 'Public sitemap entry incorrectly noindex: ' + route);
}

for (const path of ['admin/index.html', '404.html']) {
  assert.match(read(path), /<meta name="robots" content="noindex/i, path + ' must not be indexed');
}
const homepage = read('index.html');
const entryJs = [...homepage.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map(match => match[1])
  .find(url => url.includes('/assets/index-') && url.endsWith('.js'));
assert.ok(entryJs, 'Compiled main JS script missing from HTML');
const bundle = entryJs.slice(entryJs.indexOf('/assets/') + 1);
const bytes = statSync(join(root, bundle)).size;
// Guard against accidentally re-introducing the huge Firebase SDK to the entrypoint.
assert.ok(bytes <= 450_000, 'Initial main JavaScript exceeds 450KB; review eager imports');
console.log('SEO + performance budget PASS:', urls.length, 'canonical routes; main entry',
  Math.round(bytes / 1024) + ' KiB (uncompressed).');
