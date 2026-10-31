import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePdfBytes, formatBytes, calculateReduction } from './pdf';

test('validatePdfBytes detects valid PDF magic bytes %PDF-', () => {
  // Create mock valid PDF buffer with %PDF- header
  const validHeader = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const result = validatePdfBytes(validHeader);
  assert.equal(result.valid, true);
  assert.equal(result.fileSize, validHeader.byteLength);
});

test('validatePdfBytes rejects non-PDF file headers', () => {
  const invalidHeader = new TextEncoder().encode('<html><body>Not a PDF</body></html>');
  const result = validatePdfBytes(invalidHeader);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes('Invalid file signature'));
});

test('validatePdfBytes rejects empty buffer', () => {
  const empty = new Uint8Array(0);
  const result = validatePdfBytes(empty);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes('empty'));
});

test('validatePdfBytes enforces max size limits', () => {
  const smallLimit = 50; // 50 bytes limit
  const buffer = new TextEncoder().encode('%PDF-1.7 and some extra trailing bytes that exceed fifty characters total in length');
  const result = validatePdfBytes(buffer, smallLimit);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes('exceeds maximum allowed size'));
});

test('formatBytes correctly formats various byte ranges', () => {
  assert.equal(formatBytes(0), '0 Bytes');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(5242880), '5 MB');
});

test('calculateReduction calculates genuine percentages and floors at 0 for larger files', () => {
  assert.equal(calculateReduction(1000, 500), 50);
  assert.equal(calculateReduction(1000, 750), 25);
  assert.equal(calculateReduction(1000, 1000), 0);
  assert.equal(calculateReduction(1000, 1200), 0); // No negative fabrication
});
