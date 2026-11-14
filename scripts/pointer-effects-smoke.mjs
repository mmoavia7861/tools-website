import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
server.stdout.on('data', chunk => { log += String(chunk); });
server.stderr.on('data', chunk => { log += String(chunk); });
const base = 'http://127.0.0.1:4178' + (process.env.PAGES_BASE_PATH || '/RankNova/');
let browser;
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    try {
      const response = await fetch(base);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  assert.ok(ready, 'Preview did not start: ' + log);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const desktop = await browser.newPage({ viewport: { width: 1365, height: 850 } });
  await desktop.goto(base);
  await desktop.locator('.tc-pointer-layer').waitFor();
  await desktop.mouse.move(300, 240);
  await desktop.waitForFunction(() => document.querySelector('.tc-pointer-layer')?.getAttribute('data-pointer-active') === 'true');
  assert.equal(await desktop.locator('.tc-pointer-layer').evaluate(el => el.style.getPropertyValue('--tc-x')), '300px');
  assert.equal(await desktop.locator('.tc-pointer-layer').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  await desktop.mouse.click(320, 260);
  assert.ok(await desktop.locator('.tc-pointer-ripple').count(), 'Desktop click burst missing');
  await desktop.getByRole('button', { name: 'Free Tools', exact: true }).click();
  assert.ok(desktop.url().includes((process.env.PAGES_BASE_PATH || '/RankNova/') + 'qr-code-generator/'), 'Cursor overlay blocked desktop navigation');

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 1
  });
  const mobile = await mobileContext.newPage();
  await mobile.goto(base);
  await mobile.locator('.tc-pointer-layer').waitFor();
  assert.notEqual(await mobile.locator('.tc-mobile-orb').first().evaluate(el => getComputedStyle(el).display), 'none', 'Mobile ambient effect missing');
  await mobile.touchscreen.tap(190, 280);
  assert.ok(await mobile.locator('.tc-pointer-ripple').count(), 'Mobile tap ripple missing');
  await mobile.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await mobile.getByRole('button', { name: 'QR Generator' }).click();
  assert.ok(mobile.url().includes((process.env.PAGES_BASE_PATH || '/RankNova/') + 'qr-code-generator/'), 'Pointer overlay blocked mobile navigation');
  await mobile.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await mobile.locator('.tc-pointer-layer').evaluate(el => getComputedStyle(el).display), 'none', 'Reduced-motion setting not respected');
  await mobileContext.close();
  console.log('PASS: ToolCresta desktop cursor glow, click burst, mobile ambient/tap animation, navigation and reduced motion.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
