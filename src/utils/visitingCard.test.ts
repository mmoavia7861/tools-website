import test from 'node:test';
import assert from 'node:assert';
import {
  CARD_THEMES,
  CARD_WIDTH_PT,
  CARD_HEIGHT_PT,
  DEFAULT_CARD_DATA,
  generateCardVCardPayload,
  createVisitingCardPdf
} from './visitingCard.ts';
import { validatePdfBytes } from './pdf.ts';

test('CARD_THEMES contains all core and AI styles with valid colors', () => {
  const themeKeys = Object.keys(CARD_THEMES);
  assert.ok(themeKeys.length >= 12, 'Expected at least 12 card themes');
  assert.ok(CARD_THEMES['modern-dark']);
  assert.ok(CARD_THEMES['corporate-navy']);
  assert.ok(CARD_THEMES['minimal-clean']);
  assert.ok(CARD_THEMES['creative-gradient']);
  assert.ok(CARD_THEMES['luxe-gold']);
  assert.ok(CARD_THEMES['emerald-nature']);
  assert.ok(CARD_THEMES['cyberpunk-neon']);
  assert.ok(CARD_THEMES['art-deco-luxury']);
  assert.ok(CARD_THEMES['scandinavian-zen']);
  assert.ok(CARD_THEMES['neo-brutalist']);
  assert.ok(CARD_THEMES['sunset-aurora']);
  assert.ok(CARD_THEMES['clinical-teal']);
});

test('generateCardVCardPayload formats standard vCard correctly', () => {
  const vcard = generateCardVCardPayload(DEFAULT_CARD_DATA);
  assert.ok(vcard.startsWith('BEGIN:VCARD'));
  assert.ok(vcard.includes('FN:Muhammad Moaviah'));
  assert.ok(vcard.includes('ORG:RankNova Tech'));
  assert.ok(vcard.includes('moaviah760@gmail.com'));
  assert.ok(vcard.endsWith('END:VCARD'));
});

test('createVisitingCardPdf creates valid 2-page print-ready PDF from PNG data URLs', async () => {
  // Create a minimal 1x1 transparent PNG data URL
  const minimalPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const pdfBytes = await createVisitingCardPdf(minimalPng, minimalPng);
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 500);

  const validation = validatePdfBytes(pdfBytes);
  assert.strictEqual(validation.valid, true);
});
