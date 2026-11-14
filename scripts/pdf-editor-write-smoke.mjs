/**
 * End-to-end PDF Writer smoke test for the static GitHub Pages build.
 * Run from the repository root after building /RankNova/ for preview.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4173/RankNova/edit-pdf/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLogs = '';
server.stdout.on('data', data => { serverLogs += String(data); });
server.stderr.on('data', data => { serverLogs += String(data); });
let browser;
try {
  let ready = false;
  for (let tries = 0; tries < 60; tries++) {
    try {
      const res = await fetch(url);
      if (res.ok) { ready = true; break; }
    } catch { /* preview starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Vite preview was not ready: ' + serverLogs);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const javascriptErrors = [];
  page.on('pageerror', error => javascriptErrors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Free PDF Editor & Signer/i }).waitFor();

  const document = await PDFDocument.create();
  const sample = document.addPage([500, 700]);
  sample.drawText('Original Content', { x: 60, y: 610, size: 16 });
  const originalBytes = await document.save();

  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(originalBytes)
  });

  const addText = page.getByRole('button', { name: 'Add Words / Text' });
  await addText.waitFor();
  await addText.click();
  const editor = page.getByRole('textbox', { name: 'Edit PDF replacement text' });
  await editor.waitFor({ timeout: 20000 });
  await editor.fill('RankNova Write Test');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.ok(await page.getByTestId('pdf-editor-page').getByText('RankNova Write Test').isVisible(), 'Typed words should appear on PDF');

  await page.getByRole('button', { name: 'Write Anywhere (Click PDF)' }).click();
  await page.getByTestId('pdf-editor-page').click({ position: { x: 35, y: 145 } });
  await editor.waitFor();
  await editor.fill('Placed second line');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.ok(await page.getByTestId('pdf-editor-page').getByText('Placed second line').isVisible(), 'Click-to-write words should appear');

  await page.getByRole('button', { name: /Save & Export PDF/i }).click();
  await page.getByText('Edited PDF Ready for Download!').waitFor({ timeout: 20000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: /Download.*\.pdf/ }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.pdf$/);
  const savedPath = await download.path();
  assert.ok(savedPath);
  const bytes = readFileSync(savedPath);
  assert.equal(bytes.toString('ascii', 0, 5), '%PDF-', 'Must download a real PDF file');
  const result = await PDFDocument.load(bytes);
  assert.equal(result.getPageCount(), 1);
  assert.equal(javascriptErrors.length, 0, 'Unexpected JS errors: ' + javascriptErrors.join(' | '));
  console.log('PASS: upload PDF, Add Text, type, Write Anywhere, export, download valid edited PDF');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
