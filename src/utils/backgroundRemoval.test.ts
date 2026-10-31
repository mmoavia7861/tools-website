import test from 'node:test';
import assert from 'node:assert';
import {
  calculateColorDistance,
  sampleBackgroundPalette,
  removeBackgroundFromImageData
} from './backgroundRemoval.ts';

test('calculateColorDistance correctly measures identical and distant colors', () => {
  const distIdentical = calculateColorDistance(255, 255, 255, 255, 255, 255);
  assert.strictEqual(distIdentical, 0);

  const distBlackWhite = calculateColorDistance(0, 0, 0, 255, 255, 255);
  assert.ok(distBlackWhite > 200, `Expected distance > 200, got ${distBlackWhite}`);
});

test('sampleBackgroundPalette identifies dominant border colors', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill entire image with white background (255, 255, 255, 255)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }

  // Draw a red subject in the center (10, 10)
  for (let y = 8; y <= 12; y++) {
    for (let x = 8; x <= 12; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 255; // Red
      data[idx + 1] = 0;
      data[idx + 2] = 0;
    }
  }

  const palette = sampleBackgroundPalette(data, width, height, 4);
  assert.ok(palette.length > 0);
  assert.strictEqual(palette[0].r, 255);
  assert.strictEqual(palette[0].g, 255);
  assert.strictEqual(palette[0].b, 255);
});

test('removeBackgroundFromImageData erases white background while preserving subject', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);

  // Background is white
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }

  // Draw a black subject in the center
  for (let y = 8; y <= 12; y++) {
    for (let x = 8; x <= 12; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
    }
  }

  const result = removeBackgroundFromImageData(
    { data, width, height },
    { tolerance: 30, featherRadius: 0, protectCenter: true }
  );

  assert.ok(result.removedPixelsCount > 200, 'Expected most white background pixels to be removed');

  // Verify corner pixel (0,0) is now transparent
  assert.strictEqual(data[3], 0, 'Corner alpha should be 0');

  // Verify center pixel (10,10) is still opaque black
  const centerIdx = (10 * width + 10) * 4;
  assert.strictEqual(data[centerIdx + 3], 255, 'Center subject alpha should remain 255');
  assert.strictEqual(data[centerIdx], 0);
});
