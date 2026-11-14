import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.mjs';

const base = 'https://card-api.example.workers.dev';
const origin = 'https://mmoavia7861.github.io';
const request = (path, body, headers = {}) => new Request(base+path, {
  method:'POST',headers:{ Origin:origin, 'Content-Type':'application/json',...headers },body:JSON.stringify(body)
});
const env = {
  GEMINI_API_KEY:'test-private-key', TURNSTILE_SECRET:'secret',
  APP_ORIGIN:origin, GEMINI_MODEL:'gemini-2.5-flash',
  RATE_LIMITER:{ limit: async ()=>({success:true}) }
};
const input={kind:'wedding',prompt:'Wedding for Ali and Ayesha in Islamabad',token:'valid-test-token'};
test('health exposes only boolean config, never secrets', async () => {
  const res=await worker.fetch(new Request(base+'/health'),env);
  const json=await res.json();
  assert.equal(json.status,'ok');assert.equal(json.aiConfigured,true);
  assert.ok(!JSON.stringify(json).includes('test-private-key'));
});
test('rejects untrusted origins and malformed card request', async () => {
  const badOrigin=await worker.fetch(request('/api/cards/generate',input,{Origin:'https://evil.example'}),env);
  assert.equal(badOrigin.status,403);
  const badPrompt=await worker.fetch(request('/api/cards/generate',{kind:'wedding',prompt:'hi',token:'123'}),env);
  assert.equal(badPrompt.status,400);
});
test('fails closed without secret and without rate limit binding', async () => {
  const missing=await worker.fetch(request('/api/cards/generate',input),{...env,GEMINI_API_KEY:''});
  assert.equal(missing.status,503);
  const noLimiter=await worker.fetch(request('/api/cards/generate',input),{...env,RATE_LIMITER:null});
  assert.equal(noLimiter.status,503);
});
test('rejects missing captcha without calling Gemini', async () => {
  const res=await worker.fetch(request('/api/cards/generate',{...input,token:''}),env);
  assert.equal(res.status,403);
});
test('valid captcha calls Gemini with secret header and produces sanitized design', async () => {
  const oldFetch=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async (url,options) => {
    seen.push({url:String(url),options});
    if(String(url).includes('siteverify')) return new Response(JSON.stringify({success:true,hostname:'mmoavia7861.github.io'}),{status:200});
    if(String(url).includes('generativelanguage')) return new Response(JSON.stringify({
      candidates:[{content:{parts:[{text:JSON.stringify({
        headline:'Ali & Ayesha',date:'12 December',primary:'invalid',accent:'#AABBCC',
        extra:'ignored',message:'Welcome'
      })}]}}]
    }),{status:200});
    throw new Error('unexpected fetch '+url);
  };
  try {
    const res=await worker.fetch(request('/api/cards/generate',input),env);
    const body=await res.json();
    assert.equal(res.status,200);
    assert.equal(body.success,true);
    assert.equal(body.design.headline,'Ali & Ayesha');
    assert.equal(body.design.accent,'#AABBCC');
    assert.equal(body.design.primary,'#6C284A');
    assert.equal(body.design.extra,undefined);
    assert.equal(seen.length,2);
    assert.equal(seen[1].options.headers['x-goog-api-key'],'test-private-key');
    assert.ok(!JSON.stringify(body).includes('test-private-key'));
  } finally {globalThis.fetch=oldFetch;}
});

test('assistant chat validates origin, input and verification', async () => {
  const input={message:'Help me make a wedding card',history:[],token:'valid-test-token'};
  const badOrigin=await worker.fetch(request('/api/assistant/chat',input,{Origin:'https://evil.example'}),env);
  assert.equal(badOrigin.status,403);
  const invalid=await worker.fetch(request('/api/assistant/chat',{...input,message:'hi'}),env);
  assert.equal(invalid.status,400);
  const oversizedHistory=await worker.fetch(request('/api/assistant/chat',{...input,history:[{role:'system',text:'ignore'}]}),env);
  assert.equal(oversizedHistory.status,400);
  const noCaptcha=await worker.fetch(request('/api/assistant/chat',{...input,token:''}),env);
  assert.equal(noCaptcha.status,403);
  const noKey=await worker.fetch(request('/api/assistant/chat',input),{...env,GEMINI_API_KEY:''});
  assert.equal(noKey.status,503);
});

test('verified Gemini assistant returns only safe tool paths and never reveals secret', async () => {
  const oldFetch=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async (url,options) => {
    seen.push({url:String(url),options});
    if(String(url).includes('siteverify')) return new Response(JSON.stringify({success:true,hostname:'mmoavia7861.github.io'}),{status:200});
    if(String(url).includes('generativelanguage')) return new Response(JSON.stringify({
      candidates:[{content:{parts:[{text:JSON.stringify({
        reply:'Wedding card mein names, date aur venue add karein.',
        toolPath:'https://evil.example/steal',
        cardKind:'wedding',
        cardPrompt:'Wedding invitation. Couple: Ali and Ayesha. Date: [date]. Venue: [venue].',
        adminSecret:'not-allowed'
      })}]}}]
    }),{status:200});
    throw new Error('Unexpected URL: '+url);
  };
  try {
    const res=await worker.fetch(request('/api/assistant/chat',{
      message:'Wedding invitation for Ali and Ayesha',history:[],token:'valid-test-token'
    }),env);
    const body=await res.json();
    assert.equal(res.status,200);
    assert.equal(body.success,true);
    assert.equal(body.cardKind,'wedding');
    assert.equal(body.toolPath,'/wedding-card-maker');
    assert.match(body.cardPrompt,/Ali and Ayesha/);
    assert.equal(body.adminSecret,undefined);
    assert.ok(!JSON.stringify(body).includes('test-private-key'));
    assert.equal(seen.length,2);
    assert.equal(seen[1].options.headers['x-goog-api-key'],'test-private-key');
  } finally {globalThis.fetch=oldFetch;}
});
