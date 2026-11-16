import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/api.mjs';

const base = 'https://toolscresta.com';
const configured = { GEMINI_API_KEY: '', ADOBE_CLIENT_ID: '', ADOBE_CLIENT_SECRET: '', TURNSTILE_SECRET: '' };
const env = { ...configured, ASSETS: { fetch: async () => new Response('static assets served', { status: 200 }) } };

test('health endpoint exposes only minimal operational status', async () => {
  const response = await worker.fetch(new Request(base + '/api/health'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'toolscresta-api');
  assert.equal(JSON.stringify(body).includes('secret'), false);
});

test('admin provider status does not expose credentials', async () => {
  const response = await worker.fetch(new Request(base + '/api/admin/status'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.pdfServerCompression, false);
  assert.equal(JSON.stringify(body).includes('secret'), false);
});

test('Adobe mode exposes only the public runtime Turnstile site key', async () => {
  const testEnv = {
    ...env,
    ADOBE_CLIENT_ID: 'private-adobe-client',
    ADOBE_CLIENT_SECRET: 'private-adobe-secret',
    TURNSTILE_SECRET: 'private-turnstile-secret',
    TURNSTILE_SITE_KEY: '0x4AAAAAA_PUBLIC_SITE_KEY'
  };
  const response = await worker.fetch(new Request(base + '/api/integrations/status'), testEnv);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.adobe, true);
  assert.equal(data.turnstile, true);
  assert.equal(data.turnstileSiteKey, testEnv.TURNSTILE_SITE_KEY);
  const body = JSON.stringify(data);
  assert.ok(!body.includes(testEnv.ADOBE_CLIENT_ID));
  assert.ok(!body.includes(testEnv.ADOBE_CLIENT_SECRET));
  assert.ok(!body.includes(testEnv.TURNSTILE_SECRET));
  assert.ok(!body.includes('access_token'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Adobe site-key status is empty when no public key is configured', async () => {
  const response = await worker.fetch(new Request(base + '/api/integrations/status'), env);
  const data = await response.json();
  assert.equal(data.turnstileSiteKey, '');
});

test('configuration status never exposes API secrets', async () => {
  const response = await worker.fetch(new Request(base + '/api/integrations/status'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { success: true, gemini: false, adobe: false, turnstile: false, workersAi: false });
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

test('preview Worker accepts same-origin requests without bypassing configuration checks', async () => {
  const preview = 'https://toolscresta-preview.example.workers.dev';
  const response = await worker.fetch(new Request(preview + '/api/cards/generate-background', {
    method: 'POST',
    headers: { Origin: preview, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'wedding', prompt: 'Elegant floral wedding invitation', token: 'mock-turnstile-token' })
  }), env);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /AI is not enabled/i);
});

test('preview Worker checks Turnstile against its own hostname, not a hardcoded production domain', async () => {
  const preview = 'https://toolscresta-preview.example.workers.dev';
  const originalFetch = globalThis.fetch;
  let verifiedHostname = preview.replace(/^https:\/\//, '');
  try {
    globalThis.fetch = async () => Response.json({ success: true, hostname: verifiedHostname });
    const makeRequest = (ip) => new Request(preview + '/api/cards/generate-background', {
      method: 'POST',
      headers: { Origin: preview, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ kind: 'wedding', prompt: 'Elegant floral wedding invitation', token: 'mock-turnstile-token' })
    });
    const secured = { ...env, TURNSTILE_SECRET: 'mock-server-secret',
      AI: { run: async () => ({ image: 'a'.repeat(320) }) } };
    const accepted = await worker.fetch(makeRequest('198.51.100.61'), secured);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).success, true);
    verifiedHostname = 'another-site.example';
    const rejected = await worker.fetch(makeRequest('198.51.100.62'), secured);
    assert.equal(rejected.status, 403);
    assert.match((await rejected.json()).error, /hostname mismatch/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('siteverify subrequest uses Cloudflare-supported redirect mode and Gemini returns real parsed design', async () => {
  const originalFetch = globalThis.fetch;
  const destinations = [];
  try {
    globalThis.fetch = async (url, options) => {
      destinations.push(String(url));
      // In the Cloudflare Workers runtime, redirect:error throws before sending a request.
      assert.equal(options.redirect, 'manual');
      if (String(url).includes('/turnstile/v0/siteverify')) {
        return Response.json({ success: true, hostname: 'toolscresta.com' });
      }
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return Response.json({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({
              headline: 'Test Card', subheading: 'Graphic Designer',
              primary: '#123D78', accent: '#3A94EA', background: '#EFF7FF',
              style: 'modern', font: 'sans',
            }) }] },
          }],
        });
      }
      throw new Error('Unexpected provider URL');
    };
    const response = await worker.fetch(new Request(base + '/api/cards/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(json.design.headline, 'Test Card');
    assert.equal(destinations.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini editable card request uses a lower-latency model and minimal thinking', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      assert.match(String(url), /gemini-3\.5-flash-lite:generateContent/);
      const request = JSON.parse(options.body);
      assert.equal(request.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: 'Fast Gemini Card', primary: '#123D78' }) }] } }] });
    };
    const response = await worker.fetch(new Request(base + '/api/cards/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).design.headline, 'Fast Gemini Card');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini image billing denial explains paid-tier requirement without leaking provider response', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => String(url).includes('/turnstile/v0/siteverify')
      ? Response.json({ success: true, hostname: 'toolscresta.com' })
      : Response.json({ error: { message: 'private upstream message' } }, { status: 403 });
    const response = await worker.fetch(new Request(base + '/api/cards/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.match(data.error, /paid billing/i);
    assert.doesNotMatch(data.error, /private upstream message/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini image HTTP 429 is reported as quota or billing failure', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => String(url).includes('/turnstile/v0/siteverify')
      ? Response.json({ success: true, hostname: 'toolscresta.com' })
      : Response.json({ error: { message: 'private upstream message' } }, { status: 429 });
    const response = await worker.fetch(new Request(base + '/api/cards/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /quota or billing limit/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini image request has a minimal API payload (no optional format fields)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.generationConfig, { responseModalities: ['IMAGE'] });
      assert.match(payload.contents[0].parts[0].text, /16:9/);
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: {
        mimeType: 'image/png', data: 'iVBORw0KGgo='
      } }] } }] });
    };
    const response = await worker.fetch(new Request(base + '/api/cards/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 200);
    assert.match((await response.json()).image, /^data:image\/png;base64,/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini image HTTP 400 FAILED_PRECONDITION gives billing guidance without exposing upstream response', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => String(url).includes('/turnstile/v0/siteverify')
      ? Response.json({ success: true, hostname: 'toolscresta.com' })
      : Response.json({ error: {
          status: 'FAILED_PRECONDITION',
          message: 'Free tier is not supported; sensitive-upstream-info-123'
        } }, { status: 400 });
    const response = await worker.fetch(new Request(base + '/api/cards/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.match(result.error, /paid billing/);
    assert.doesNotMatch(result.error, /sensitive-upstream-info-123/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini image HTTP 400 INVALID_ARGUMENT remains a configuration error', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => String(url).includes('/turnstile/v0/siteverify')
      ? Response.json({ success: true, hostname: 'toolscresta.com' })
      : Response.json({ error: {
          status: 'INVALID_ARGUMENT',
          message: 'Bad generationConfig parameters'
        } }, { status: 400 });
    const response = await worker.fetch(new Request(base + '/api/cards/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify(sampleBody),
    }), { ...env, GEMINI_API_KEY: 'test-only', TURNSTILE_SECRET: 'test-only' });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /request rejected by Google/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cloudflare AI background endpoint requires its Worker AI binding', async () => {
  const response = await worker.fetch(new Request(base + '/api/cards/generate-background', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
    body: JSON.stringify(sampleBody),
  }), { ...env, TURNSTILE_SECRET: 'test-secret' });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /AI is not enabled/);
});

test('Cloudflare Workers AI status is exposed as a boolean, never a secret', async () => {
  const response = await worker.fetch(new Request(base + '/api/integrations/status'), {
    ...env, AI: { run: async () => ({}) }
  });
  const body = await response.json();
  assert.equal(body.workersAi, true);
  assert.equal(body.turnstile, false);
  assert.equal(body.gemini, false);
});

test('Cloudflare AI creates a genuine background without forwarding names or contact details', async () => {
  const originalFetch = globalThis.fetch;
  let invocation;
  try {
    globalThis.fetch = async (url) => {
      assert.match(String(url), /turnstile\/v0\/siteverify/);
      return Response.json({ success: true, hostname: 'toolscresta.com' });
    };
    const body = { ...sampleBody,
      prompt: 'modern blue floral card. Name: Aisha Khan. Phone: +92 300 1234567. Email: aisha@example.com.'
    };
    const response = await worker.fetch(new Request(base + '/api/cards/generate-background', {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'Origin': base, 'CF-Connecting-IP': '198.51.100.11'
      },
      body: JSON.stringify(body),
    }), { ...env, TURNSTILE_SECRET: 'test-secret', AI: {
      run: async (model, input) => {
        invocation = { model, input };
        return { image: 'a'.repeat(320) };
      }
    } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.source, 'cloudflare-workers-ai');
    assert.match(result.image, /^data:image\/jpeg;base64,/);
    assert.equal(invocation.model, '@cf/black-forest-labs/flux-1-schnell');
    assert.equal(invocation.input.steps, 4);
    assert.match(invocation.input.prompt, /blue.*floral/);
    assert.doesNotMatch(invocation.input.prompt, /Aisha|1234567|example\.com/i);
    assert.match(invocation.input.prompt, /NO typography/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Cloudflare AI free allowance exceeded returns actionable 429', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ success: true, hostname: 'toolscresta.com' });
    const response = await worker.fetch(new Request(base + '/api/cards/generate-background', {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'Origin': base, 'CF-Connecting-IP': '198.51.100.12'
      },
      body: JSON.stringify(sampleBody),
    }), { ...env, TURNSTILE_SECRET: 'test-secret', AI: {
      run: async () => { throw new Error('Neuron quota exceeded'); }
    } });
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /daily free allowance/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('Cloudflare AI rejects non-same-origin requests before generating artwork', async () => {
  const response = await worker.fetch(new Request(base + '/api/cards/generate-background', {
    method: 'POST', headers: { Origin: 'https://unknown.example' },
  }), { ...env, TURNSTILE_SECRET: 'test-secret', AI: { run: async () => ({ image: 'a'.repeat(200) }) } });
  assert.equal(response.status, 403);
});

test('Adobe REST export flow uploads a real PDF and downloads DOCX (mocked upstream)', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const storage = 'https://dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com/test-file?X-Amz-Signature=sample';
  const jobStatus = 'https://pdf-services-ue1.adobe.io/operation/exportpdf/test-job/status?requestId=mock';
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), method: options.method || 'GET' });
      if (String(url).includes('/turnstile/v0/siteverify')) {
        return Response.json({ success: true, hostname: 'toolscresta.com' });
      }
      if (String(url) === 'https://ims-na1.adobelogin.com/ims/token/v3') {
        assert.match(String(options.body), /client_id=test-client/);
        assert.match(String(options.body), /client_secret=test-secret/);
        const fields = new URLSearchParams(String(options.body));
        assert.equal(fields.get('grant_type'), 'client_credentials');
        assert.equal(fields.get('scope'), 'openid,AdobeID,DCAPI,additional_info.projectedProductContext');
        return Response.json({ access_token: 'mock-access-token' });
      }
      if (String(url) === 'https://pdf-services.adobe.io/assets') {
        return Response.json({ assetID: 'urn:aaid:AS:UE1:sample-asset', uploadUri: storage });
      }
      if (String(url) === storage && options.method === 'PUT') {
        assert.equal(options.headers['Content-Type'], 'application/pdf');
        assert.ok(options.body instanceof File, 'Upload must use a sized File body, not a full ArrayBuffer');
        return new Response('', { status: 200 });
      }
      if (String(url) === 'https://pdf-services.adobe.io/operation/exportpdf') {
        assert.equal(JSON.parse(options.body).targetFormat, 'docx');
        return new Response('', { status: 201, headers: { location: '/operation/exportpdf/test-job/status' } });
      }
      if (String(url) === jobStatus) {
        return Response.json({ status: 'done', asset: { downloadUri: storage } });
      }
      if (String(url) === storage && options.method === 'GET') {
        return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01]), { status: 200 });
      }
      throw new Error('Unexpected upstream call');
    };
    const body = new FormData();
    body.append('file', new File([new TextEncoder().encode('%PDF-1.7\nmock')], 'demo.pdf', { type: 'application/pdf' }));
    body.append('turnstileToken', 'mock-turnstile-token');
    const response = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.90' }, body
    }), {
      ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile'
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /wordprocessingml/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())].slice(0,2), [0x50,0x4b]);
    assert.equal(calls.length, 7);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe job HTTP 201 without Location identifies missing header safely', async () => {
  const originalFetch = globalThis.fetch;
  const storage = 'https://dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com/file?X-Amz-Signature=sample';
  try {
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.includes('/turnstile/v0/siteverify'))
        return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (target.endsWith('/ims/token/v3'))
        return Response.json({ access_token: 'mock-access-token' });
      if (target.endsWith('/assets'))
        return Response.json({ assetID: 'urn:aaid:AS:UE1:test', uploadUri: storage });
      if (target === storage && options.method === 'PUT')
        return new Response('', { status: 200 });
      if (target.endsWith('/operation/exportpdf'))
        return new Response('', { status: 201 });
      throw new Error('Unexpected upstream request');
    };
    const form = new FormData();
    form.append('file', new File([new TextEncoder().encode('%PDF-1.7\\nmock')], 'demo.pdf'));
    form.append('turnstileToken', 'fresh-token-abc');
    const resp = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.222' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'client', ADOBE_CLIENT_SECRET: 'secret', TURNSTILE_SECRET: 'secret' });
    assert.equal(resp.status, 502);
    const body = await resp.json();
    assert.match(body.error, /did not send a Location header/);
    assert.match(body.error, /Job HTTP 201; missing/);
    assert.doesNotMatch(body.error, /mock-access-token|X-Amz-Signature/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe rejects untrusted job Location without fetching it or exposing its URL', async () => {
  const originalFetch = globalThis.fetch;
  const storage = 'https://dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com/file?X-Amz-Signature=sample';
  let fetchedUntrusted = false;
  try {
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.includes('untrusted.example')) { fetchedUntrusted = true; throw new Error('Unsafe request'); }
      if (target.includes('/turnstile/v0/siteverify'))
        return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (target.endsWith('/ims/token/v3'))
        return Response.json({ access_token: 'mock-access-token' });
      if (target.endsWith('/assets'))
        return Response.json({ assetID: 'urn:aaid:AS:UE1:test', uploadUri: storage });
      if (target === storage && options.method === 'PUT')
        return new Response('', { status: 200 });
      if (target.endsWith('/operation/exportpdf'))
        return new Response('', { status: 201, headers: { location: 'https://untrusted.example/operation/exportpdf/secret/status' } });
      throw new Error('Unexpected upstream request');
    };
    const form = new FormData();
    form.append('file', new File([new TextEncoder().encode('%PDF-1.7\\nmock')], 'demo.pdf'));
    form.append('turnstileToken', 'fresh-token-xyz');
    const resp = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.223' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'client', ADOBE_CLIENT_SECRET: 'secret', TURNSTILE_SECRET: 'secret' });
    assert.equal(resp.status, 502);
    const body = await resp.json();
    assert.match(body.error, /untrusted/);
    assert.doesNotMatch(body.error, /untrusted\.example|secret\/status/);
    assert.equal(fetchedUntrusted, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe credentials authorization failures return safe configuration errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => String(url).includes('/turnstile/v0/siteverify')
      ? Response.json({ success: true, hostname: 'toolscresta.com' })
      : String(url).endsWith('/ims/token/v3')
        ? Response.json({ access_token: 'mock' })
        : new Response('Upstream private error', { status: 403 });
    const body = new FormData();
    body.append('file', new File([new TextEncoder().encode('%PDF-1.7\nmock')], 'demo.pdf'));
    body.append('turnstileToken', 'mock-turnstile-token');
    const response = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.91' }, body
    }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.match(result.error, /rejected these API credentials or access permissions/);
    assert.doesNotMatch(result.error, /private error/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe REST create flow uploads DOCX and returns PDF (mocked upstream)', async () => {
  const originalFetch = globalThis.fetch;
  const storage = 'https://dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com/docx?X-Amz-Signature=sample';
  const statusUrl = 'https://pdf-services-ew1.adobe.io/operation/createpdf/test-job/status';
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), method: options.method || 'GET' });
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (String(url).endsWith('/ims/token/v3')) return Response.json({ access_token: 'mock-token' });
      if (String(url).endsWith('/assets')) return Response.json({ assetID: 'urn:aaid:AS:UE1:test-docx', uploadUri: storage });
      if (String(url) === storage && options.method === 'PUT') {
        assert.equal(options.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        assert.ok(options.body instanceof File, 'Upload must use a sized File body, not a full ArrayBuffer');
        return new Response('', { status: 200 });
      }
      if (String(url).endsWith('/operation/createpdf')) {
        const payload = JSON.parse(options.body);
        assert.deepEqual(payload, { assetID: 'urn:aaid:AS:UE1:test-docx' });
        return new Response('', { status: 201, headers: { location: statusUrl } });
      }
      if (String(url) === statusUrl) return Response.json({ status: 'done', asset: { downloadUri: storage } });
      if (String(url) === storage && options.method === 'GET') return new Response(new TextEncoder().encode('%PDF-1.7\nmock'));
      throw new Error('Unexpected upstream request');
    };
    const form = new FormData();
    form.append('file', new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01])], 'sample.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }));
    form.append('turnstileToken', 'mock-turnstile-token');
    const response = await worker.fetch(new Request(base + '/api/convert/word-to-pdf', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.92' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(new TextDecoder().decode(await response.arrayBuffer()).slice(0,5), '%PDF-');
    assert.equal(requests.length, 7);
  } finally { globalThis.fetch = originalFetch; }
});


test('Adobe IMS OAuth invalid_client is diagnosed without exposing upstream data', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (String(url) === 'https://ims-na1.adobelogin.com/ims/token/v3') {
        return Response.json({
          error: 'invalid_client',
          error_description: 'SECRET-DATA-MUST-NEVER-REACH-USERS'
        }, { status: 400 });
      }
      throw new Error('Unexpected upstream request');
    };
    const form = new FormData();
    form.append('file', new File([new TextEncoder().encode('%PDF-1.7\\nmock')], 'demo.pdf'));
    form.append('turnstileToken', 'fresh-turnstile');
    const result = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.177' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
    assert.equal(result.status, 503);
    const body = await result.json();
    assert.match(body.error, /invalid_client/);
    assert.doesNotMatch(body.error, /SECRET-DATA|test-client|test-secret/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe IMS OAuth invalid_scope explains how to correct Cloudflare scopes', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (String(url) === 'https://ims-na1.adobelogin.com/ims/token/v3')
        return Response.json({ error: 'invalid_scope', error_description: 'PRIVATE' }, { status: 400 });
      throw new Error('Unexpected upstream request');
    };
    const form = new FormData();
    form.append('file', new File([new TextEncoder().encode('%PDF-1.7\\nmock')], 'demo.pdf'));
    form.append('turnstileToken', 'fresh-turnstile');
    const result = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.178' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
    assert.equal(result.status, 503);
    const body = await result.json();
    assert.match(body.error, /invalid_scope/);
    assert.match(body.error, /ADOBE_OAUTH_SCOPES/);
    assert.doesNotMatch(body.error, /PRIVATE/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe cloud permits PDF inputs over old 10 MB limit and reaches IMS token step', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (String(url) === 'https://ims-na1.adobelogin.com/ims/token/v3')
        return Response.json({ error: 'invalid_client' }, { status: 400 });
      throw new Error('Unexpected upstream request');
    };
    // 11 MiB: previously rejected by the hard-coded 10 MiB limit.
    const pdfBytes = new Uint8Array(11 * 1024 * 1024);
    pdfBytes.set(new TextEncoder().encode('%PDF-1.7'));
    const form = new FormData();
    form.append('file', new File([pdfBytes], 'large.pdf', { type: 'application/pdf' }));
    form.append('turnstileToken', 'fresh-turnstile');
    const response = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.179' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /invalid_client/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe cloud accepts Word DOCX files larger than the old 10 MB limit', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/turnstile/v0/siteverify')) return Response.json({ success: true, hostname: 'toolscresta.com' });
      if (String(url) === 'https://ims-na1.adobelogin.com/ims/token/v3')
        return Response.json({ error: 'invalid_client' }, { status: 400 });
      throw new Error('Unexpected upstream request');
    };
    const docxBytes = new Uint8Array(11 * 1024 * 1024);
    docxBytes.set([0x50, 0x4b, 0x03, 0x04]);
    const form = new FormData();
    form.append('file', new File([docxBytes], 'large.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    form.append('turnstileToken', 'fresh-turnstile');
    const response = await worker.fetch(new Request(base + '/api/convert/word-to-pdf', {
      method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.181' }, body: form
    }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /invalid_client/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Adobe requests exceeding 50 MiB are rejected before parsing uploaded data', async () => {
  const payload = new FormData();
  payload.append('file', new File([new TextEncoder().encode('%PDF-1.7\\nmock')], 'demo.pdf'));
  const response = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
    method: 'POST',
    headers: {
      Origin: base,
      'CF-Connecting-IP': '198.51.100.180',
      'Content-Length': String(51 * 1024 * 1024),
    },
    body: payload
  }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-turnstile' });
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /50 MB/);
});

for (const providerStatus of [400, 401, 403, 429, 503]) {
  test('Adobe token auth HTTP ' + providerStatus + ' is diagnosed without leaking secrets', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        if (String(url).includes('/turnstile/v0/siteverify')) {
          return Response.json({ success: true, hostname: 'toolscresta.com' });
        }
        assert.match(String(url), /ims-na1\.adobelogin\.com\/ims\/token\/v3/);
        return Response.json({ error: 'private upstream body with secret data' }, { status: providerStatus });
      };
      const form = new FormData();
      form.append('file', new File([new TextEncoder().encode('%PDF-1.7\nmock')], 'sample.pdf'));
      form.append('turnstileToken', 'mock-turnstile-token');
      const response = await worker.fetch(new Request(base + '/api/convert/pdf-to-word', {
        method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '198.51.100.' + providerStatus },
        body: form,
      }), { ...env, ADOBE_CLIENT_ID: 'test-client', ADOBE_CLIENT_SECRET: 'test-secret', TURNSTILE_SECRET: 'test-secret' });
      assert.equal(response.status, providerStatus === 429 ? 429 : providerStatus >= 500 ? 502 : 503);
      const data = await response.json();
      assert.match(data.error, new RegExp(String(providerStatus)));
      assert.doesNotMatch(data.error, /private upstream body|test-secret|test-client/);
    } finally { globalThis.fetch = originalFetch; }
  });
}
