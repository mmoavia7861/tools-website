import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/api.mjs';

const base = 'https://toolscresta.com';
const configured = { GEMINI_API_KEY: '', ADOBE_CLIENT_ID: '', ADOBE_CLIENT_SECRET: '', TURNSTILE_SECRET: '' };
const env = { ...configured, ASSETS: { fetch: async () => new Response('static assets served', { status: 200 }) } };

test('configuration status never exposes API secrets', async () => {
  const response = await worker.fetch(new Request(base + '/api/integrations/status'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { success: true, gemini: false, adobe: false, turnstile: false });
});

test('Gemini endpoint must not fake an answer without keys', async () => {
  const response = await worker.fetch(new Request(base + '/api/assistant/chat', { method: 'POST' }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('Adobe endpoint must not claim conversion without credentials', async () => {
  const response = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', { method: 'POST' }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('API only accepts same-origin browser requests', async () => {
  const response = await worker.fetch(new Request(base + '/api/cards/generate', {
    method: 'POST',
    headers: { Origin: 'https://untrusted.example' },
  }), env);
  assert.equal(response.status, 403);
});

test('static routes still delegate to original assets', async () => {
  const response = await worker.fetch(new Request(base + '/'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'static assets served');
});

test('unsupported API paths are rejected', async () => {
  const response = await worker.fetch(new Request(base + '/api/private', { method: 'POST' }), env);
  assert.equal(response.status, 404);
});

// Turnstile error categories must not be conflated. No provider keys or tokens
// are written to logs or to user-visible messages.
const sampleBody = { kind: 'visiting', prompt: 'A professional blue and white visiting card', token: 'mock-turnstile-token' };

async function simulateSiteverify(code) {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({
      success: false,
      'error-codes': [code],
    });
    const response = await worker.fetch(new Request(base + '/api/cards/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only-not-real', TURNSTILE_SECRET: 'test-only-not-real' });
    return { status: response.status, body: await response.json() };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('incorrect private Turnstile secret is reported as configuration failure', async () => {
  const result = await simulateSiteverify('invalid-input-secret');
  assert.equal(result.status, 503);
  assert.match(result.body.error, /server Secret Key is incorrect/);
  assert.doesNotMatch(result.body.error, /test-only-not-real/);
});

test('expired or reused Turnstile token advises new verification', async () => {
  const result = await simulateSiteverify('timeout-or-duplicate');
  assert.equal(result.status, 403);
  assert.match(result.body.error, /expired or already used/i);
});
