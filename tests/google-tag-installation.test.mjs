import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.source.html', import.meta.url), 'utf8');
const banner = readFileSync(new URL('../src/components/CookieBanner.tsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');

test('ToolsCresta uses exactly one Google tag from the new analytics setup', () => {
  assert.equal((html.match(/gtag\/js\?id=GTM-TLK8X39X/g) || []).length, 1);
  assert.ok(!html.includes('G-QQ1H25LES8'), 'Do not reuse the old Google Analytics stream');
});

test('Google Consent Mode v2 defaults precede the Google tag loader', () => {
  const def = html.indexOf("gtag('consent', 'default'");
  const loader = html.indexOf('gtag/js?id=GTM-TLK8X39X');
  assert.ok(def > -1 && loader > def);
  for (const category of ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization']) {
    assert.ok(html.includes("'" + category + "': 'denied'"));
  }
});

test('Analytics consent persists and is sent to Google consent update', () => {
  assert.ok(html.includes("toolscresta_privacy_consent"));
  assert.ok(banner.includes("localStorage.setItem('toolscresta_privacy_consent'"));
  assert.ok(banner.includes("tag('consent', 'update'"));
  assert.ok(banner.includes("analytics_storage: allowed ? 'granted' : 'denied'"));
  assert.ok(footer.includes("localStorage.removeItem('toolscresta_privacy_consent')"));
  assert.ok(footer.includes("analytics_storage: 'denied'"));
});
