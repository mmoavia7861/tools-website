import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TOOLS, INSTALLED_TOOLS, validateToolCatalog, canVisitTool,
  canonicalToolPath, visibleTools, readHomeSettings
} from '../data/toolCatalog';

test('every preinstalled route has a unique safe catalog entry', () => {
  assert.equal(DEFAULT_TOOLS.length, INSTALLED_TOOLS.length);
  assert.equal(new Set(DEFAULT_TOOLS.map(t => t.path)).size, DEFAULT_TOOLS.length);
  assert.equal(validateToolCatalog({ items: DEFAULT_TOOLS })?.length, DEFAULT_TOOLS.length);
});

test('admin hidden tools disappear from directory and direct alias routes', () => {
  const tools = DEFAULT_TOOLS.map(tool =>
    tool.path === '/compress-video' ? { ...tool, enabled: false } : tool);
  assert.equal(canVisitTool(tools, '/compress-video'), false);
  assert.equal(canVisitTool(tools, '/video-compressor'), false);
  assert.equal(canonicalToolPath('/visiting-card'), '/visiting-card-generator');
  assert.equal(visibleTools(tools).some(tool => tool.id === 'compress-video'), false);
  assert.equal(canVisitTool(tools, '/edit-pdf'), true);
});

test('drafts cannot publish unimplemented tools or arbitrary URLs', () => {
  const draft = {
    id: 'image-resizer', title: 'Image Resizer', description: 'Future idea',
    path: '', status: 'draft' as const, enabled: false, featured: false, sortOrder: 25
  };
  const good = validateToolCatalog({ items: [draft] });
  assert.equal(good?.length, 1);
  assert.deepEqual(visibleTools(good || []), []);
  assert.equal(validateToolCatalog({ items: [{ ...draft, enabled: true }] }), null);
  assert.equal(validateToolCatalog({ items: [{ ...draft, path: 'https://untrusted.example/' }] }), null);
  assert.equal(validateToolCatalog({ items: [{ ...DEFAULT_TOOLS[0], path: 'https://untrusted.example/' }] }), null);
  assert.equal(validateToolCatalog({ items: [{ ...DEFAULT_TOOLS[0], id: 'admin' }] }), null);
});

test('homepage content validates text and rejects executable markup as code', () => {
  const content = readHomeSettings({ headline: 'My Online Tools', highlight: 'Fast', description: 'Safe tools', announcement: 'Notice' });
  assert.equal(content.headline, 'My Online Tools');
  assert.equal(readHomeSettings({ headline: '' }).headline, 'Free Online Tools.');
});
