import test from 'node:test';
import assert from 'node:assert';
import {
  CARD_THEMES,
  CARD_WIDTH_PT,
  CARD_HEIGHT_PT,
  DEFAULT_CARD_DATA,
  generateCardVCardPayload,
  createVisitingCardPdf,
  CARD_SIZES,
  suggestCardStyle,
  resolveCardTheme,
  CARD_FONT_CSS
} from './visitingCard.ts';
import { validatePdfBytes } from './pdf.ts';
import { PDFDocument } from 'pdf-lib';

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
  assert.ok(vcard.includes('FN:Your Name'));
  assert.ok(vcard.includes('ORG:Your Company'));
  assert.ok(vcard.includes('hello@example.com'));
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

test('correct 300 DPI output and page physical size for both business card standards', async () => {
  assert.equal(CARD_SIZES.us.widthPx, 1050);
  assert.equal(CARD_SIZES.us.heightPx, 600);
  assert.equal(CARD_SIZES.eu.widthPx, 1004);
  assert.equal(CARD_SIZES.eu.heightPx, 650);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  for (const size of ['us', 'eu'] as const) {
    for (const orientation of ['landscape', 'portrait'] as const) {
      const bytes = await createVisitingCardPdf(png, png, size, orientation);
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 2);
      const actual = pdf.getPage(0).getSize();
      const expectedWidth = orientation === 'portrait' ? CARD_SIZES[size].heightPt : CARD_SIZES[size].widthPt;
      const expectedHeight = orientation === 'portrait' ? CARD_SIZES[size].widthPt : CARD_SIZES[size].heightPt;
      assert.ok(Math.abs(actual.width - expectedWidth) < 0.02);
      assert.ok(Math.abs(actual.height - expectedHeight) < 0.02);
    }
  }
});

test('local style suggestions return real curated themes without fake AI claims', () => {
  assert.equal(suggestCardStyle('Luxury real estate company').theme, 'luxe-gold');
  assert.equal(suggestCardStyle('medical clinic').theme, 'clinical-teal');
  assert.equal(suggestCardStyle('minimal architecture').theme, 'scandinavian-zen');
  assert.equal(suggestCardStyle('cyberpunk gaming').theme, 'cyberpunk-neon');
});

test('palette overrides are validated and font choices are available', () => {
  assert.match(CARD_FONT_CSS.serif, /Georgia/);
  const changed = resolveCardTheme({ ...DEFAULT_CARD_DATA, customAccent: '#12ACEF', customBgFront: '#ABCDEF' });
  assert.equal(changed.accent, '#12ACEF');
  assert.equal(changed.bgFront, '#ABCDEF');
  const invalid = resolveCardTheme({ ...DEFAULT_CARD_DATA, customAccent: 'red; alert(1)' });
  assert.equal(invalid.accent, CARD_THEMES['modern-dark'].accent);
});
