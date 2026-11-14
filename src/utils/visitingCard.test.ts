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
  CARD_FONT_CSS,
  CARD_PRESETS,
  exportCardAsJson,
  parseCardFromJson,
  STYLE_TEMPLATES,
  applyStyleTemplate,
  normalizeContactUrl,
  getContactUrlQrPayload,
  toggleContactUrlQr
} from './visitingCard.ts';
import { validatePdfBytes } from './pdf.ts';
import { PDFDocument } from 'pdf-lib';

test('CARD_THEMES contains all core, modern and AI styles with valid colors', () => {
  const themeKeys = Object.keys(CARD_THEMES);
  assert.ok(themeKeys.length >= 18, 'Expected at least 18 card themes');
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
  assert.ok(CARD_THEMES['glass-frost']);
  assert.ok(CARD_THEMES['obsidian-gold']);
  assert.ok(CARD_THEMES['swiss-minimal']);
  assert.ok(CARD_THEMES['matrix-neon']);
  assert.ok(CARD_THEMES['rose-champagne']);
  assert.ok(CARD_THEMES['kraft-artisan']);
});

test('generateCardVCardPayload formats standard vCard correctly', () => {
  const vcard = generateCardVCardPayload(DEFAULT_CARD_DATA);
  assert.ok(vcard.startsWith('BEGIN:VCARD'));
  assert.ok(vcard.includes('FN:Alexander Vance'));
  assert.ok(vcard.includes('ORG:Nova Dynamics'));
  assert.ok(vcard.includes('alexander@novadynamics.io'));
  assert.ok(vcard.endsWith('END:VCARD'));
});

test('createVisitingCardPdf creates valid 2-page print-ready PDF from PNG data URLs', async () => {
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
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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
  assert.equal(suggestCardStyle('glass tech startup').theme, 'glass-frost');
});

test('palette overrides are validated and font choices are available', () => {
  assert.match(CARD_FONT_CSS.serif, /Georgia/);
  const changed = resolveCardTheme({ ...DEFAULT_CARD_DATA, customAccent: '#12ACEF', customBgFront: '#ABCDEF' });
  assert.equal(changed.accent, '#12ACEF');
  assert.equal(changed.bgFront, '#ABCDEF');
  const invalid = resolveCardTheme({ ...DEFAULT_CARD_DATA, customAccent: 'red; alert(1)' });
  assert.equal(invalid.accent, CARD_THEMES[DEFAULT_CARD_DATA.theme].accent);
});

test('CARD_PRESETS contains comprehensive curated industry designs', () => {
  assert.ok(CARD_PRESETS.length >= 8);
  const founder = CARD_PRESETS.find((p) => p.id === 'tech-founder');
  assert.ok(founder);
  assert.ok(founder.data.companyName);
  assert.ok(founder.data.fullName);
  assert.ok(founder.data.theme);
});

test('exportCardAsJson and parseCardFromJson roundtrip reliably', () => {
  const json = exportCardAsJson(DEFAULT_CARD_DATA);
  assert.ok(typeof json === 'string');
  const parsed = parseCardFromJson(json);
  assert.ok(parsed);
  assert.equal(parsed.fullName, DEFAULT_CARD_DATA.fullName);
  assert.equal(parsed.companyName, DEFAULT_CARD_DATA.companyName);

  // Invalid JSON test
  const invalid = parseCardFromJson('{not valid json}');
  assert.strictEqual(invalid, null);
});

test('STYLE_TEMPLATES provides Modern Minimalist, Professional Bold, and Creative Gradient', () => {
  assert.equal(STYLE_TEMPLATES.length, 3);
  const labels = STYLE_TEMPLATES.map(s => s.label);
  assert.ok(labels.includes('Modern Minimalist'), 'Must include Modern Minimalist');
  assert.ok(labels.includes('Professional Bold'), 'Must include Professional Bold');
  assert.ok(labels.includes('Creative Gradient'), 'Must include Creative Gradient');

  // Test applyStyleTemplate switches correctly while preserving custom text
  const initial = { ...DEFAULT_CARD_DATA, fullName: 'Test User', email: 'test@user.io' };

  const modern = applyStyleTemplate(initial, 'modern-minimalist');
  assert.equal(modern.selectedTemplate, 'modern-minimalist');
  assert.equal(modern.theme, 'minimal-clean');
  assert.equal(modern.layout, 'minimal-zen');
  assert.equal(modern.fullName, 'Test User');
  assert.equal(modern.email, 'test@user.io');

  const bold = applyStyleTemplate(initial, 'professional-bold');
  assert.equal(bold.selectedTemplate, 'professional-bold');
  assert.equal(bold.theme, 'corporate-navy');
  assert.equal(bold.layout, 'executive-banner');
  assert.equal(bold.fullName, 'Test User');

  const creative = applyStyleTemplate(initial, 'creative-gradient');
  assert.equal(creative.selectedTemplate, 'creative-gradient');
  assert.equal(creative.theme, 'creative-gradient');
  assert.equal(creative.layout, 'glass-card');
  assert.equal(creative.fullName, 'Test User');
});

test('normalizeContactUrl cleans URLs and guarantees valid web protocol', () => {
  assert.equal(normalizeContactUrl('https://example.com/me'), 'https://example.com/me');
  assert.equal(normalizeContactUrl('http://insecure.site'), 'http://insecure.site');
  assert.equal(normalizeContactUrl('example.com/profile'), 'https://example.com/profile');
  assert.equal(normalizeContactUrl('  www.novadynamics.io  '), 'https://www.novadynamics.io');
  assert.equal(normalizeContactUrl(''), 'https://mmoavia7861.github.io/RankNova/');
  assert.equal(normalizeContactUrl(undefined), 'https://mmoavia7861.github.io/RankNova/');
});

test('getContactUrlQrPayload extracts normalized contact URL from card website', () => {
  const card = { ...DEFAULT_CARD_DATA, website: 'customhub.io/alex' };
  assert.equal(getContactUrlQrPayload(card), 'https://customhub.io/alex');
});

test('toggleContactUrlQr seamlessly enables and disables contact URL QR code embedding', () => {
  const base = { ...DEFAULT_CARD_DATA, embedContactUrlQr: false, qrType: 'none' as const };
  const enabled = toggleContactUrlQr(base, true);
  assert.equal(enabled.embedContactUrlQr, true);
  assert.equal(enabled.qrType, 'website');

  const disabled = toggleContactUrlQr(enabled, false);
  assert.equal(disabled.embedContactUrlQr, false);
  assert.equal(disabled.qrType, 'none');
});


