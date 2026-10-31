import test from 'node:test';
import assert from 'node:assert/strict';
import { convertImagesToPdf } from './imageToPdf';
import { validatePdfBytes } from './pdf';

// 1x1 valid PNG buffer
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
]);

test('convertImagesToPdf throws error on empty image list', async () => {
  await assert.rejects(async () => {
    await convertImagesToPdf([]);
  }, /At least one image is required/);
});

test('convertImagesToPdf generates valid PDF bytes from PNG', async () => {
  const pdfBytes = await convertImagesToPdf([
    { data: TINY_PNG, format: 'png' }
  ], { pageSize: 'fit' });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 100);

  // Validate the generated PDF signature
  const validation = validatePdfBytes(pdfBytes);
  assert.equal(validation.valid, true);
});

test('convertImagesToPdf handles A4 portrait and landscape options', async () => {
  const pdfBytes = await convertImagesToPdf([
    { data: TINY_PNG, format: 'png' }
  ], { pageSize: 'a4', orientation: 'portrait', margin: 'small' });

  assert.ok(pdfBytes.byteLength > 100);
  const validation = validatePdfBytes(pdfBytes);
  assert.equal(validation.valid, true);
});

test('convertImagesToPdf applies rotation, page numbers, and watermark', async () => {
  const pdfBytes = await convertImagesToPdf([
    { data: TINY_PNG, format: 'png', rotation: 90 },
    { data: TINY_PNG, format: 'png', rotation: 180 }
  ], {
    pageSize: 'a4',
    addPageNumbers: true,
    pageNumberPosition: 'bottom-center',
    watermarkText: 'CONFIDENTIAL',
    watermarkOpacity: 0.3
  });

  assert.ok(pdfBytes.byteLength > 200);
  const validation = validatePdfBytes(pdfBytes);
  assert.equal(validation.valid, true);
});
