/**
 * Adobe PDF Services conversion gateway for RankNova GitHub Pages.
 * Secrets live only in Cloudflare Worker runtime, deployed through GitHub Actions.
 * REST sequence: token -> asset registration -> signed upload -> conversion job ->
 * poll status -> signed download; no user documents are persisted by this Worker.
 *
 * Adobe API reference:
 * https://developer.adobe.com/document-services/docs/overview/pdf-services-api/gettingstarted/
 */
const ADOBE = 'https://pdf-services.adobe.io';
const MODES = Object.freeze({
  'pdf-to-word': {
    inputMime: 'application/pdf', outputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    operation: 'exportpdf', extension: '.pdf', outputExtension: '.docx'
  },
  'word-to-pdf': {
    inputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    outputMime: 'application/pdf', operation: 'createpdf', extension: '.docx', outputExtension: '.pdf'
  }
});
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 24 * 1024 * 1024;

function apiResponse(body, status, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '300';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function outputResponse(bytes, mode, origin) {
  const meta = MODES[mode];
  return new Response(bytes, {
    status: 200, headers: {
      'Content-Type': meta.outputMime,
      'Content-Disposition': 'attachment; filename="converted' + meta.outputExtension + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Vary': 'Origin'
    }
  });
}

// Prevent an external API response from turning this Worker into an SSRF proxy.
function adobeJobUrl(raw) {
  if (typeof raw !== 'string') throw new Error('Missing job URL.');
  const url = new URL(raw, ADOBE);
  if (url.protocol !== 'https:' || url.origin !== ADOBE || !url.pathname.startsWith('/operation/')) {
    throw new Error('Unexpected Adobe job URL.');
  }
  return url.toString();
}

function signedStorageUrl(raw) {
  if (typeof raw !== 'string') throw new Error('Missing signed storage URL.');
  const u = new URL(raw);
  const allowedS3 = /^dcplatformstorageservice-prod-[a-z0-9-]+\.s3(?:-accelerate)?(?:\.[a-z0-9-]+)?\.amazonaws\.com$/i.test(u.hostname);
  if (u.protocol !== 'https:' || u.username || u.password || !allowedS3) {
    throw new Error('Unexpected Adobe storage URL.');
  }
  return u.toString();
}

async function verifyTurnstile(token, secret, hostname, clientIp) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return false;
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (clientIp && clientIp !== 'unknown') form.set('remoteip', clientIp);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form, redirect: 'manual', signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) return false;
  const checked = await res.json();
  return checked?.success === true && checked.hostname === hostname;
}

async function getJson(res, publicError) {
  if (res.status === 429) throw Object.assign(new Error('Adobe API quota or rate limit reached. Try again later.'), { status: 429 });
  if (!res.ok) throw new Error(publicError);
  return res.json();
}

async function adobeConvert(bytes, mode, env) {
  const meta = MODES[mode];
  const auth = new URLSearchParams({
    client_id: env.ADOBE_CLIENT_ID,
    client_secret: env.ADOBE_CLIENT_SECRET
  });
  const tokenRes = await fetch(ADOBE + '/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: auth.toString(), redirect: 'manual', signal: AbortSignal.timeout(16000)
  });
  const tokenJson = await getJson(tokenRes, 'Adobe authentication failed. Check the API credentials.');
  const token = tokenJson.access_token;
  if (typeof token !== 'string' || token.length < 12) throw new Error('Adobe authentication returned no access token.');
  const headers = { 'X-API-Key': env.ADOBE_CLIENT_ID, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  const assetResponse = await fetch(ADOBE + '/assets', {
    method: 'POST', headers, body: JSON.stringify({ mediaType: meta.inputMime }),
    redirect: 'manual', signal: AbortSignal.timeout(16000)
  });
  const registered = await getJson(assetResponse, 'Adobe could not register the document.');
  if (typeof registered.assetID !== 'string' || !registered.assetID.startsWith('urn:aaid:')) {
    throw new Error('Adobe asset registration did not return a valid asset ID.');
  }
  const uploadUrl = signedStorageUrl(registered.uploadUri);
  const uploaded = await fetch(uploadUrl, {
    method: 'PUT', headers: { 'Content-Type': meta.inputMime }, body: bytes,
    redirect: 'manual', signal: AbortSignal.timeout(45000)
  });
  if (!uploaded.ok) throw new Error('Adobe document upload failed.');

  const params = { assetID: registered.assetID };
  if (mode === 'pdf-to-word') params.targetFormat = 'docx';
  const jobRes = await fetch(ADOBE + '/operation/' + meta.operation, {
    method: 'POST', headers, body: JSON.stringify(params),
    redirect: 'manual', signal: AbortSignal.timeout(16000)
  });
  await getJsonOrEmpty(jobRes);
  const jobUrl = adobeJobUrl(jobRes.headers.get('location'));
  // 24 polls x 2 seconds (~48 seconds) plus upload / download time; no unbounded loops.
  let downloadUrl = '';
  for (let i = 0; i < 24; i++) {
    const check = await fetch(jobUrl, {
      method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(15000)
    });
    const job = await getJson(check, 'Adobe job status could not be retrieved.');
    if (job.status === 'done') {
      downloadUrl = signedStorageUrl(job.asset?.downloadUri);
      break;
    }
    if (job.status === 'failed') throw new Error('Adobe could not convert this document. Try another file.');
    if (job.status !== 'in progress') throw new Error('Adobe returned an unexpected job status.');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!downloadUrl) throw Object.assign(new Error('Conversion is taking too long. Try a smaller document.'), { status: 504 });
  const output = await fetch(downloadUrl, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(40000) });
  if (!output.ok) throw new Error('Converted file download failed.');
  const declaredSize = Number(output.headers.get('content-length') || 0);
  if (declaredSize > MAX_OUTPUT_BYTES) throw new Error('Converted file is too large for this service.');
  const outputBytes = new Uint8Array(await output.arrayBuffer());
  if (!outputBytes.length || outputBytes.byteLength > MAX_OUTPUT_BYTES) throw new Error('Converted file exceeds the size limit.');
  if (mode === 'word-to-pdf' && new TextDecoder().decode(outputBytes.subarray(0, 5)) !== '%PDF-')
    throw new Error('Adobe did not return a valid PDF.');
  if (mode === 'pdf-to-word' && (outputBytes[0] !== 0x50 || outputBytes[1] !== 0x4B))
    throw new Error('Adobe did not return a valid DOCX.');
  return outputBytes;
}

async function getJsonOrEmpty(res) {
  if (res.status === 429) throw Object.assign(new Error('Adobe API quota or rate limit reached. Try again later.'), { status: 429 });
  if (res.status !== 201 && res.status !== 200 && res.status !== 202) {
    throw new Error('Adobe conversion job could not start.');
  }
}

function validInput(bytes, mode) {
  if (mode === 'pdf-to-word') {
    return new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-';
  }
  return bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.APP_ORIGIN || 'https://mmoavia7861.github.io';
    const origin = request.headers.get('Origin') || '';
    const mode = url.pathname.startsWith('/api/convert/') ? url.pathname.slice('/api/convert/'.length) : null;

    if (url.pathname === '/health' && request.method === 'GET') {
      return apiResponse({
        status: 'ok',
        adobeConfigured: Boolean(env.ADOBE_CLIENT_ID && env.ADOBE_CLIENT_SECRET && env.TURNSTILE_SECRET && env.RATE_LIMITER)
      }, 200);
    }
    if (!mode || !Object.hasOwn(MODES, mode)) return apiResponse({ error: 'Not found.' }, 404);
    if (origin !== allowedOrigin) return apiResponse({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '300',
        'Vary': 'Origin'
      } });
    }
    if (request.method !== 'POST') return apiResponse({ error: 'Method not allowed.' }, 405, origin);
    if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET || !env.TURNSTILE_SECRET || !env.RATE_LIMITER) {
      return apiResponse({ error: 'Adobe converter backend is not configured yet.' }, 503, origin);
    }
    const headerSize = Number(request.headers.get('content-length') || 0);
    if (headerSize > MAX_BYTES + 65536) return apiResponse({ error: 'File must be 10 MB or smaller.' }, 413, origin);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
      return apiResponse({ error: 'Send a multipart file upload.' }, 415, origin);
    }
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const limit = await env.RATE_LIMITER.limit({ key: 'adobe:' + clientIp });
      if (!limit.success) return apiResponse({ error: 'Too many conversions. Try again in a minute.' }, 429, origin);
    } catch {
      return apiResponse({ error: 'Rate limiter unavailable.' }, 503, origin);
    }
    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size < 10 || file.size > MAX_BYTES ||
          !file.name.toLowerCase().endsWith(MODES[mode].extension)) {
        return apiResponse({ error: 'Choose a valid PDF or DOCX file up to 10 MB.' }, 400, origin);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!validInput(bytes, mode)) return apiResponse({ error: 'Document does not match the selected file type.' }, 400, origin);
      const verified = await verifyTurnstile(form.get('turnstileToken'), env.TURNSTILE_SECRET, new URL(allowedOrigin).hostname, clientIp);
      if (!verified) return apiResponse({ error: 'Security verification failed or expired. Try again.' }, 403, origin);
      const output = await adobeConvert(bytes, mode, env);
      return outputResponse(output, mode, origin);
    } catch (error) {
      // No upstream response bodies, request files, bearer tokens or credentials are logged.
      const status = error?.status === 429 ? 429 : error?.status === 504 ? 504 : 502;
      const message = error instanceof Error ? error.message : 'Adobe conversion failed.';
      return apiResponse({ error: message }, status, origin);
    }
  }
};
