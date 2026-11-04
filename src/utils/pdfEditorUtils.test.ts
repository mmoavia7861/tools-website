import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertNormalizedToPdfCoords,
  hexToRgb01,
  reorderArray,
  normalizeRotation,
  createDefaultTextElement,
  createSignatureElement
} from './pdfEditorUtils.ts';

test('reorderArray moves items correctly without modifying original', () => {
  const original = ['A', 'B', 'C', 'D'];
  const movedForward = reorderArray(original, 0, 2);
  assert.deepEqual(movedForward, ['B', 'C', 'A', 'D']);
  assert.deepEqual(original, ['A', 'B', 'C', 'D'], 'Original must be untouched');

  const movedBackward = reorderArray(original, 3, 1);
  assert.deepEqual(movedBackward, ['A', 'D', 'B', 'C']);

  // Edge cases
  assert.deepEqual(reorderArray(original, -1, 2), original);
  assert.deepEqual(reorderArray(original, 1, 99), original);
  assert.deepEqual(reorderArray(original, 1, 1), original);
});

test('normalizeRotation snaps angles to 0, 90, 180, 270', () => {
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(90), 90);
  assert.equal(normalizeRotation(180), 180);
  assert.equal(normalizeRotation(270), 270);
  assert.equal(normalizeRotation(360), 0);
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(-90), 270);
});

test('hexToRgb01 parses hex values accurately', () => {
  assert.deepEqual(hexToRgb01('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(hexToRgb01('#FFFFFF'), { r: 1, g: 1, b: 1 });
  assert.deepEqual(hexToRgb01('#FFF'), { r: 1, g: 1, b: 1 });
  
  // Custom hex: #2563EB (Tailwind blue-600)
  const blue = hexToRgb01('#2563EB');
  assert.equal(Math.round(blue.r * 255), 37);
  assert.equal(Math.round(blue.g * 255), 99);
  assert.equal(Math.round(blue.b * 255), 235);

  // Invalid hex defaults to black
  assert.deepEqual(hexToRgb01('invalid'), { r: 0, g: 0, b: 0 });
});

test('convertNormalizedToPdfCoords converts top-left DOM coords to bottom-left PDF coords', () => {
  const pageWidth = 612; // Standard Letter width (pts)
  const pageHeight = 792; // Standard Letter height (pts)

  // Top-left element in DOM: normX = 0.1, normY = 0.1, normWidth = 0.2, normHeight = 0.05
  // DOM: y from top is 0.1 * 792 = 79.2
  // Height is 0.05 * 792 = 39.6
  // Bottom in PDF is 792 - 79.2 - 39.6 = 673.2
  const coords = convertNormalizedToPdfCoords(0.1, 0.1, 0.2, 0.05, pageWidth, pageHeight);
  assert.equal(coords.x, 61.2);
  assert.equal(coords.width, 122.4);
  assert.equal(coords.height, 39.6);
  assert.equal(coords.y, 673.2);
});

test('createDefaultTextElement and createSignatureElement produce valid objects', () => {
  const textEl = createDefaultTextElement(0, 'Hello World', 0.25, 0.4);
  assert.equal(textEl.type, 'text');
  assert.equal(textEl.text, 'Hello World');
  assert.equal(textEl.pageIndex, 0);

  const sigEl = createSignatureElement(1, 'data:image/png;base64,abc', 0.5, 0.6);
  assert.equal(sigEl.type, 'signature');
  assert.equal(sigEl.imageDataUrl, 'data:image/png;base64,abc');
  assert.equal(sigEl.pageIndex, 1);
});
