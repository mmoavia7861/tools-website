import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTargetDimensions,
  estimateCompressedSize,
  calculateBitrateForTargetSize,
  formatVideoDuration,
  getPresetConfig
} from './videoCompressorUtils.ts';

test('calculateTargetDimensions scales while guaranteeing even dimensions', () => {
  // 1080p scaled to 720p (maxDimension 1280)
  const dims = calculateTargetDimensions(1920, 1080, 1280);
  assert.equal(dims.width, 1280);
  assert.equal(dims.height, 720);
  assert.equal(dims.width % 2, 0, 'Width must be even');
  assert.equal(dims.height % 2, 0, 'Height must be even');

  // Portrait 1080x1920 scaled to max 854 (480p)
  const portrait = calculateTargetDimensions(1080, 1920, 854);
  assert.equal(portrait.width % 2, 0);
  assert.equal(portrait.height % 2, 0);
  assert.ok(portrait.height <= 854);

  // Smaller than maxDimension retains original with even parity
  const small = calculateTargetDimensions(640, 480, 1280);
  assert.equal(small.width, 640);
  assert.equal(small.height, 480);
});

test('estimateCompressedSize calculates expected byte size', () => {
  // 30 seconds at 1000 kbps video + 128 kbps audio
  const estimated = estimateCompressedSize(30, 1000, 128);
  assert.ok(estimated > 4_000_000 && estimated < 4_600_000, `Estimated ${estimated} within reasonable bounds`);
});

test('calculateBitrateForTargetSize computes video bitrate within bounds', () => {
  // Target 15MB in 60 seconds
  const bitrate = calculateBitrateForTargetSize(15 * 1024 * 1024, 60, 96);
  assert.ok(bitrate >= 200 && bitrate <= 12000);

  // Very short video gets clamped to max
  const shortBitrate = calculateBitrateForTargetSize(100 * 1024 * 1024, 1, 96);
  assert.equal(shortBitrate, 12000);
});

test('formatVideoDuration formats seconds properly', () => {
  assert.equal(formatVideoDuration(0), '0:00');
  assert.equal(formatVideoDuration(45), '0:45');
  assert.equal(formatVideoDuration(125), '2:05');
  assert.equal(formatVideoDuration(3665), '1:01:05');
});

test('getPresetConfig returns valid presets', () => {
  const discord = getPresetConfig('discord', 30);
  assert.ok(discord.targetBitrateKbps > 0);
  assert.equal(discord.frameRate, 30);

  const whatsapp = getPresetConfig('whatsapp', 30);
  assert.ok(whatsapp.targetBitrateKbps > 0);
  assert.equal(whatsapp.maxDimension, 854);

  const balanced = getPresetConfig('balanced', 30);
  assert.equal(balanced.maxDimension, 1280);
});
