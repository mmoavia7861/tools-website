import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { AdminOtpState, handleAdminOtp, mintOtpVerifiedCustomToken,
  otpConfigured, verifyFirebasePasswordIdToken } from '../worker/admin-otp.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const origin = 'https://toolscresta.com';
const owner = 'moaviah760@gmail.com';
const project = 'gen-lang-client-0295520231';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

async function keypair() {
  const pair = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
  }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  return { pair, jwk: { ...jwk, kid: 'unit-test-key' }, pem: '-----BEGIN PRIVATE KEY-----\n' + pkcs8 + '\n-----END PRIVATE KEY-----' };
}

async function passwordToken(pair, updates = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: project, iss: 'https://securetoken.google.com/' + project,
    sub: 'existing-owner-uid', email: owner, email_verified: true,
    firebase: { sign_in_provider: 'password' },
    auth_time: now - 20, iat: now - 20, exp: now + 1200, ...updates
  };
  const unsigned = encode({ alg: 'RS256', kid: 'unit-test-key' }) + '.' + encode(payload);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(unsigned));
  return unsigned + '.' + Buffer.from(sig).toString('base64url');
}

function fakeDurableObject() {
  const map = new Map();
  const storage = {
    get: async key => map.get(key),
    put: async (key, value) => { map.set(key, value); },
    delete: async key => { map.delete(key); }
  };
  const state = { storage, blockConcurrencyWhile: fn => fn() };
  const handler = new AdminOtpState(state);
  // The real Durable Object stub receives (URL, init); normalize that to
  // a Request so our tests exercise the same path as Cloudflare production.
  return { fetch: (input, init) => handler.fetch(input instanceof Request ? input : new Request(input, init)), map };
}

function envFor(key) {
  const fake = fakeDurableObject();
  return {
    fake,
    env: {
      RESEND_API_KEY: 're_TEST_BUT_LONG_ENOUGH',
      OTP_FROM_EMAIL: 'security@toolscresta.com',
      OTP_HASH_SECRET: 'a-long-independent-otp-hmac-server-secret-0123456789',
      FIREBASE_SERVICE_ACCOUNT_EMAIL: 'toolscresta-otp-signer@gen-lang-client-0295520231.iam.gserviceaccount.com',
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: key.pem,
      ADMIN_OTP: { idFromName: uid => uid, get: () => fake },
    },
  };
}

test('OTP is fail-closed without an email provider, signer, and durable state', () => {
  assert.equal(otpConfigured({}), false);
  assert.equal(otpConfigured({ RESEND_API_KEY: 'x' }), false);
});

test('Firebase password token is cryptographically checked and owner-only', async () => {
  const key = await keypair();
  const fetchImpl = async () => Response.json({ keys: [key.jwk] });
  const signed = await passwordToken(key.pair);
  const principal = await verifyFirebasePasswordIdToken(signed, { fetchImpl });
  assert.equal(principal?.uid, 'existing-owner-uid');
  assert.equal(await verifyFirebasePasswordIdToken(signed + 'x', { fetchImpl }), null);
  assert.equal(await verifyFirebasePasswordIdToken(await passwordToken(key.pair, {
    email: 'other@gmail.com'
  }), { fetchImpl }), null);
  assert.equal(await verifyFirebasePasswordIdToken(await passwordToken(key.pair, {
    firebase: { sign_in_provider: 'google.com' }
  }), { fetchImpl }), null);
  assert.equal(await verifyFirebasePasswordIdToken(await passwordToken(key.pair, {
    email_verified: false
  }), { fetchImpl }), null);
  assert.equal(await verifyFirebasePasswordIdToken(await passwordToken(key.pair, {
    auth_time: Math.floor(Date.now() / 1000) - 3600
  }), { fetchImpl }), null);
});

test('OTP can be consumed only once and locks after five wrong attempts', async () => {
  const state = fakeDurableObject();
  const call = async body => {
    const result = await state.fetch(new Request('https://internal/command', {
      method: 'POST', body: JSON.stringify({ uid: 'owner', authTime: 123, ...body })
    }));
    return { status: result.status, data: await result.json() };
  };
  assert.equal((await call({ action: 'issue', hash: 'a'.repeat(43) })).status, 200);
  assert.equal((await call({ action: 'consume', hash: 'a'.repeat(43) })).status, 200);
  assert.equal((await call({ action: 'consume', hash: 'a'.repeat(43) })).status, 403);
  // A new issue is rate limited, preventing immediate replay/reissue.
  assert.equal((await call({ action: 'issue', hash: 'b'.repeat(43) })).status, 429);
  state.map.set('sendHistory', []);
  assert.equal((await call({ action: 'issue', hash: 'b'.repeat(43) })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await call({ action: 'consume', hash: 'c'.repeat(43) })).status, 403);
  assert.equal((await call({ action: 'consume', hash: 'c'.repeat(43) })).status, 403);
  assert.equal((await call({ action: 'consume', hash: 'b'.repeat(43) })).status, 429);
});

test('Custom token carries OTP privilege only after verified code and uses original UID', async () => {
  const key = await keypair();
  const { env } = envFor(key);
  const jwt = await mintOtpVerifiedCustomToken(env, 'existing-owner-uid');
  const [head, body, signature] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  assert.equal(claims.uid, 'existing-owner-uid');
  assert.equal(claims.claims.toolscresta_otp, true);
  assert.ok(claims.exp - claims.iat <= 300);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key.pair.publicKey,
    Buffer.from(signature, 'base64url'), new TextEncoder().encode(head + '.' + body));
  assert.equal(valid, true);
});

test('End-to-end send, verify, replay deny, and untrusted origin deny', async () => {
  const key = await keypair();
  const { env } = envFor(key);
  const jwt = await passwordToken(key.pair);
  const originalFetch = globalThis.fetch;
  let mailCode = '';
  let mailCount = 0;
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes('jwk/securetoken@')) return Response.json({ keys: [key.jwk] });
      if (String(url) === 'https://api.resend.com/emails') {
        mailCount++;
        const msg = JSON.parse(options.body);
        assert.deepEqual(msg.to, [owner]);
        mailCode = /code is: (\d{6})/.exec(msg.text)?.[1] || '';
        return Response.json({ id: 'email-test-id' });
      }
      throw Error('Unexpected URL reached: ' + url);
    };
    const req = (route, body = {}, customOrigin = origin) => new Request(origin + '/api/admin/otp/' + route, {
      method: 'POST',
      headers: { Origin: customOrigin, Authorization: 'Bearer ' + jwt,
        'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal((await handleAdminOtp(req('send', {}, 'https://evil.example'), env,
      '/api/admin/otp/send')).status, 403);
    const send = await handleAdminOtp(req('send'), env, '/api/admin/otp/send');
    assert.equal(send.status, 200);
    assert.match(mailCode, /^\d{6}$/);
    assert.equal(mailCount, 1);
    const wrong = await handleAdminOtp(req('verify', { code: 'bad' }), env, '/api/admin/otp/verify');
    assert.equal(wrong.status, 400);
    const verified = await handleAdminOtp(req('verify', { code: mailCode }), env, '/api/admin/otp/verify');
    assert.equal(verified.status, 200);
    const result = await verified.json();
    assert.equal(result.success, true);
    const minted = JSON.parse(Buffer.from(result.customToken.split('.')[1], 'base64url').toString());
    assert.equal(minted.uid, 'existing-owner-uid');
    assert.equal(minted.claims.toolscresta_otp, true);
    assert.equal((await handleAdminOtp(req('verify', { code: mailCode }), env,
      '/api/admin/otp/verify')).status, 403);
  } finally { globalThis.fetch = originalFetch; }
});

test('OTP diagnostic never exposes missing binding names to unauthenticated visitors', async () => {
  const res = await handleAdminOtp(new Request(origin + '/api/admin/otp/status', {
    method: 'GET'
  }), {}, '/api/admin/otp/status');
  const payload = await res.json();
  assert.deepEqual(payload, { success: true, configured: false });
  assert.equal('missing' in payload, false);
});

test('Only a verified owner password session can see missing binding names (not secret values)', async () => {
  const key = await keypair();
  const bearer = await passwordToken(key.pair);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      if (String(url).includes('jwk/securetoken@')) return Response.json({ keys: [key.jwk] });
      throw Error('Unexpected request');
    };
    const statusRequest = authorization => new Request(origin + '/api/admin/otp/status', {
      headers: { Authorization: authorization }
    });
    const owner = await handleAdminOtp(statusRequest('Bearer ' + bearer), {}, '/api/admin/otp/status');
    const report = await owner.json();
    assert.equal(report.configured, false);
    assert.ok(report.missing.includes('RESEND_API_KEY'));
    assert.ok(report.missing.includes('ADMIN_OTP'));
    assert.equal(Object.values(report).some(value => String(value).includes('private_key')), false);
    const invalid = await handleAdminOtp(statusRequest('Bearer invalid'), {}, '/api/admin/otp/status');
    assert.equal('missing' in await invalid.json(), false);
  } finally { globalThis.fetch = originalFetch; }
});


test('Six-digit OTP expiry is reported separately from lost or changed login challenges', async () => {
  const state = fakeDurableObject();
  const call = async (action, hash, authTime = 123) => {
    const r = await state.fetch(new Request('https://internal/command', {
      method: 'POST',
      body: JSON.stringify({ uid: 'owner', action, hash, authTime })
    }));
    return { status: r.status, data: await r.json() };
  };
  const original = await call('issue', 'a'.repeat(43));
  assert.equal(original.status, 200);
  assert.ok(original.data.expiresAt > Date.now());
  assert.ok(original.data.expiresAt <= Date.now() + 5 * 60 * 1000);
  const changedSession = await call('consume', 'a'.repeat(43), 124);
  assert.equal(changedSession.data.errorCode, 'SESSION_CHANGED');
  // An immediate consume for the matching session still works.
  assert.equal((await call('consume', 'a'.repeat(43))).status, 200);
  const used = await call('consume', 'a'.repeat(43));
  assert.equal(used.data.errorCode, 'CODE_UNAVAILABLE');
  // Build an expired challenge without actually waiting five minutes.
  state.map.set('sendHistory', []);
  assert.equal((await call('issue', 'b'.repeat(43))).status, 200);
  const stale = state.map.get('challenge');
  stale.expiresAt = Date.now() - 1000;
  state.map.set('challenge', stale);
  const expired = await call('consume', 'b'.repeat(43));
  assert.equal(expired.data.errorCode, 'CODE_EXPIRED');
  assert.equal(state.map.has('challenge'), false);
});

test('Server provides actual code expiration time after a successful send', async () => {
  const key = await keypair();
  const { env } = envFor(key);
  const jwt = await passwordToken(key.pair);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      if (String(url).includes('jwk/securetoken@')) return Response.json({ keys: [key.jwk] });
      if (String(url) === 'https://api.resend.com/emails') return Response.json({ id: 'mail-id' });
      throw Error('Unexpected fetch ' + String(url));
    };
    const response = await handleAdminOtp(new Request(origin + '/api/admin/otp/send', {
      method: 'POST',
      headers: { Origin: origin, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: '{}'
    }), env, '/api/admin/otp/send');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.ok(result.expiresAt > Date.now());
  } finally { globalThis.fetch = originalFetch; }
});


test('A broken Firebase signing key cannot consume a valid one-time code', async () => {
  const key = await keypair();
  const { env } = envFor(key);
  const jwt = await passwordToken(key.pair);
  const originalFetch = globalThis.fetch;
  let sentCode = '';
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes('jwk/securetoken@')) return Response.json({ keys: [key.jwk] });
      if (String(url) === 'https://api.resend.com/emails') {
        sentCode = /code is: (\d{6})/.exec(JSON.parse(options.body).text)?.[1] || '';
        return Response.json({ id: 'mailer' });
      }
      throw Error('Unexpected upstream URL');
    };
    const post = (route, body = {}) => new Request(origin + '/api/admin/otp/' + route, {
      method: 'POST',
      headers: { Origin: origin, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal((await handleAdminOtp(post('send'), env, '/api/admin/otp/send')).status, 200);
    assert.match(sentCode, /^\d{6}$/);
    const validKey = env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY;
    env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = 'invalid signing private key';
    const failed = await handleAdminOtp(post('verify', { code: sentCode }), env, '/api/admin/otp/verify');
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).errorCode, 'SIGNER_PEM_FORMAT');
    env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = validKey;
    const retry = await handleAdminOtp(post('verify', { code: sentCode }), env, '/api/admin/otp/verify');
    assert.equal(retry.status, 200, 'valid code should remain available after a transient key failure');
  } finally { globalThis.fetch = originalFetch; }
});


test('Cloudflare secret formats: raw PEM, escaped newlines, JSON-escaped PEM and service-account JSON', async () => {
  const key = await keypair();
  const { env } = envFor(key);
  const variants = [
    key.pem,
    key.pem.replace(/\n/g, '\\n'),
    JSON.stringify(key.pem),
    JSON.stringify({
      type: 'service_account', project_id: project,
      client_email: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
      private_key: key.pem
    })
  ];
  for (const secret of variants) {
    env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = secret;
    const token = await mintOtpVerifiedCustomToken(env, 'existing-owner-uid');
    const [header, payload, signature] = token.split('.');
    assert.equal(JSON.parse(Buffer.from(payload, 'base64url').toString()).uid, 'existing-owner-uid');
    assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key.pair.publicKey,
      Buffer.from(signature, 'base64url'), new TextEncoder().encode(header + '.' + payload)), true);
  }
});

test('Reject wrong project and mismatched service-account JSON without emitting secret text', async () => {
  const key = await keypair();
  const { env } = envFor(key);
  env.FIREBASE_SERVICE_ACCOUNT_EMAIL = 'otp@other-project.iam.gserviceaccount.com';
  await assert.rejects(mintOtpVerifiedCustomToken(env, 'owner'));
  env.FIREBASE_SERVICE_ACCOUNT_EMAIL = 'toolscresta-otp-signer@' + project + '.iam.gserviceaccount.com';
  env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = JSON.stringify({
    type: 'service_account', project_id: project,
    client_email: 'different@' + project + '.iam.gserviceaccount.com',
    private_key: key.pem
  });
  await assert.rejects(mintOtpVerifiedCustomToken(env, 'owner'));
});

test('Do not issue any OTP or call Resend if signer is malformed', async () => {
  const key = await keypair();
  const { env, fake } = envFor(key);
  env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = 'not a private key';
  const jwt = await passwordToken(key.pair);
  const originalFetch = globalThis.fetch;
  let mailSent = false;
  try {
    globalThis.fetch = async url => {
      if (String(url).includes('jwk/securetoken@')) return Response.json({ keys: [key.jwk] });
      if (String(url) === 'https://api.resend.com/emails') { mailSent = true; return Response.json({ id: 'fail' }); }
      throw Error('Unexpected upstream request');
    };
    const response = await handleAdminOtp(new Request(origin + '/api/admin/otp/send', {
      method: 'POST',
      headers: { Origin: origin, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: '{}'
    }), env, '/api/admin/otp/send');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.errorCode, 'SIGNER_PEM_FORMAT');
    assert.equal(body.error.includes('not a private key'), false);
    assert.equal(fake.map.has('challenge'), false);
    assert.equal(mailSent, false);
  } finally { globalThis.fetch = originalFetch; }
});
