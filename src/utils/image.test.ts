import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageSignature, checkImageDimensionSafety } from './image';

test('validateImageSignature recognizes valid PNG magic bytes', () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const result = validateImageSignature(pngHeader);
  assert.equal(result.valid, true);
  assert.equal(result.format, 'png');
  assert.equal(result.mimeType, 'image/png');
});

test('validateImageSignature recognizes valid JPEG magic bytes', () => {
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const result = validateImageSignature(jpegHeader);
  assert.equal(result.valid, true);
  assert.equal(result.format, 'jpeg');
  assert.equal(result.mimeType, 'image/jpeg');
});

test('validateImageSignature recognizes valid WebP magic bytes', () => {
  const webpHeader = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50  // WEBP
  ]);
  const result = validateImageSignature(webpHeader);
  assert.equal(result.valid, true);
  assert.equal(result.format, 'webp');
  assert.equal(result.mimeType, 'image/webp');
});

test('validateImageSignature rejects unauthorized / corrupt byte sequences', () => {
  const badBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
  const result = validateImageSignature(badBytes);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes('Unsupported or corrupted'));
});

test('checkImageDimensionSafety enforces limits against decompression bombs', () => {
  assert.equal(checkImageDimensionSafety(1920, 1080).safe, true);
  assert.equal(checkImageDimensionSafety(4096, 4096).safe, true);
  assert.equal(checkImageDimensionSafety(5000, 3000).safe, false); // Exceeds max dim 4096
  assert.equal(checkImageDimensionSafety(0, 100).safe, false);
  assert.equal(checkImageDimensionSafety(-10, -10).safe, false);
});
