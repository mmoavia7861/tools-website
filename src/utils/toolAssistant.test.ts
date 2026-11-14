import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCardPrompt, suggestTool, isAssistantPath } from './toolAssistant';
import { draftFromPrompt } from './aiCard';

test('visiting, wedding and birthday requests suggest the right card maker', () => {
  const wedding = suggestTool('shaadi wedding card for Ali and Ayesha');
  assert.equal(wedding.cardKind, 'wedding');
  assert.equal(wedding.toolPath, '/wedding-card-maker');
  assert.match(wedding.cardPrompt || '', /Ali and Ayesha/);
  assert.equal(suggestTool('birthday invitation for Sara').cardKind, 'birthday');
  assert.equal(suggestTool('business visiting card').cardKind, 'visiting');
});

test('PDF questions route to relevant tools and explain real limitations', () => {
  assert.equal(suggestTool('pdf ko word mein convert karo').toolPath, '/pdf-to-word');
  assert.equal(suggestTool('word to pdf convert').toolPath, '/word-to-pdf');
  assert.equal(suggestTool('pdf compress size kam karo').toolPath, '/compress-pdf');
  assert.equal(suggestTool('pdf edit aur signature').toolPath, '/edit-pdf');
  assert.equal(suggestTool('image to pdf').toolPath, '/image-to-pdf');
  assert.match(suggestTool('PDF to Word').reply, /OCR/);
});

test('never invents user card facts and restricts tool paths', () => {
  const prompt = makeCardPrompt('wedding', 'Wedding for Ali and Ayesha on 12 December');
  assert.match(prompt, /Ali and Ayesha/);
  assert.equal(draftFromPrompt('wedding', prompt).headline, 'Ali & Ayesha');
  assert.match(makeCardPrompt('birthday'), /\[celebrant\]/);
  assert.ok(prompt.length <= 1400);
  assert.equal(isAssistantPath('/wedding-card-maker'), true);
  assert.equal(isAssistantPath('https://evil.example'), false);
  assert.equal(isAssistantPath('/admin'), false);
});
