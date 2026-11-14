import test from 'node:test';
import assert from 'node:assert/strict';
import { blankCard, cardSize, draftFromPrompt, sanitizeCardDraft, PALETTES, EXAMPLES } from './aiCard';

test('all three card kinds have local prompt examples and correct output dimensions', () => {
  for (const kind of ['visiting', 'wedding', 'birthday'] as const) {
    assert.ok(EXAMPLES[kind].length >= 8);
    const draft = blankCard(kind);
    assert.equal(draft.kind, kind);
    assert.match(draft.primary, /^#[\da-fA-F]{6}$/);
    assert.ok(cardSize(kind).width > 0);
    assert.ok(cardSize(kind).pdfWidth > 0);
  }
});
test('local template reads labelled visiting card details without claiming Gemini', () => {
  const draft = draftFromPrompt('visiting', EXAMPLES.visiting);
  assert.equal(draft.headline, 'Aisha Khan');
  assert.equal(draft.subheading, 'Graphic Designer');
  assert.equal(draft.organization, 'Creative Studio');
  assert.equal(draft.contact, '+92 300 1234567');
  assert.equal(draft.email, 'aisha@example.com');
});
test('local template extracts wedding and birthday names without inventing event facts', () => {
  const wedding = draftFromPrompt('wedding', 'Elegant floral wedding invitation for Ali and Ayesha. Date: 12 December 2027. Venue: Rose Garden Hall.');
  assert.equal(wedding.headline, 'Ali & Ayesha');
  assert.equal(wedding.date, '12 December 2027');
  assert.equal(wedding.venue, 'Rose Garden Hall');
  assert.equal(wedding.contact, '');
  const birthday = draftFromPrompt('birthday', "Colorful balloons for Sara's 10th birthday. Venue: Garden.");
  assert.equal(birthday.headline, 'Sara');
  assert.equal(birthday.date, '');
});
test('AI output rejects injected image source, invalid colors and unknown keys', () => {
  const ai = sanitizeCardDraft({ headline: 'Good', primary: 'url(javascript:alert(1))', accent: '#ABCDEF', imageData: '<svg>', extra: 'evil', date: 123 }, 'wedding');
  assert.equal(ai.headline, 'Good');
  assert.equal(ai.accent, '#ABCDEF');
  assert.equal(ai.primary, blankCard('wedding').primary);
  assert.equal(ai.imageData, '');
  assert.equal(ai.date, '');
  assert.equal((ai as any).extra, undefined);
});
test('palette list has valid colors', () => {
  for (const p of PALETTES) for (const c of [p.primary,p.accent,p.background]) assert.match(c,/^#[0-9A-Fa-f]{6}$/);
});
