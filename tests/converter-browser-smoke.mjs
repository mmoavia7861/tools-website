/**
 * Real-browser smoke test for the two free document converters.
 * Run after npm run build:production and installing Playwright Chromium.
 * Never calls Adobe or any external conversion API.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';

const base = 'http://127.0.0.1:4173';
const temp = await mkdtemp(join(tmpdir(), 'toolscresta-converters-'));
const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', chunk => { serverOutput += String(chunk).slice(-4000); });
}

let browser;
async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Preview server exited early: ' + serverOutput);
    try {
      const res = await fetch(base + '/pdf-to-word/');
      if (res.ok) return;
    } catch { /* starting */ }
    await sleep(250);
  }
  throw new Error('Preview server did not start: ' + serverOutput);
}
async function convert(page, route, input, mimeType, outputName) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Convert in browser & download' }).waitFor();
  await page.locator('input[type="file"]').setInputFiles({
    name: input.name,
    mimeType,
    buffer: input.data
  });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: 'Convert in browser & download' }).click()
  ]);
  const output = join(temp, outputName);
  await download.saveAs(output);
  assert.equal(await page.locator('[role="alert"]').count(), 0, 'Converter should display no error');
  return readFile(output);
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });

  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdfPage.drawText('ToolsCresta Free PDF To Word Smoke Test', { x: 40, y: 780, font, size: 14 });
  const wordBytes = await convert(page, '/pdf-to-word/', {
    name: 'smoke.pdf', data: Buffer.from(await pdf.save())
  }, 'application/pdf', 'smoke.docx');
  assert.equal(wordBytes.subarray(0, 2).toString('utf8'), 'PK', 'DOCX must be a ZIP file');
  const extracted = await mammoth.extractRawText({ buffer: wordBytes });
  assert.match(extracted.value, /ToolsCresta Free PDF To Word Smoke Test/);

  const word = new Document({
    sections: [{ children: [new Paragraph('ToolsCresta Free Word To PDF Smoke Test')] }]
  });
  const pdfBytes = await convert(page, '/word-to-pdf/', {
    name: 'smoke.docx', data: Buffer.from(await Packer.toBuffer(word))
  }, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'smoke-converted.pdf');
  assert.equal(pdfBytes.subarray(0, 5).toString('utf8'), '%PDF-', 'Output must be a PDF');
  const generatedPdf = await PDFDocument.load(pdfBytes);
  assert.ok(generatedPdf.getPageCount() >= 1, 'PDF must contain a page');

  console.log('PASS: PDF to Word and Word to PDF downloaded valid files in Chromium.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await rm(temp, { recursive: true, force: true });
}
