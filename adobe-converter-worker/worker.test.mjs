import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.mjs';

const origin = 'https://mmoavia7861.github.io';
const url = 'https://ranknova-adobe-converter.example.workers.dev';
const storage = 'https://dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com/input?X-Amz-Signature=mock';
const outputStorage = 'https://dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com/output?X-Amz-Signature=mock';
const env = {
  APP_ORIGIN: origin,
  ADOBE_CLIENT_ID: 'private-client-id',
  ADOBE_CLIENT_SECRET: 'private-client-secret',
  TURNSTILE_SECRET: 'private-turnstile-secret',
  RATE_LIMITER: { limit: async () => ({ success: true }) }
};
const pdf = new Uint8Array(new TextEncoder().encode('%PDF-1.7\nmock pdf data'));
const docx = new Uint8Array([0x50,0x4B,0x03,0x04,0x01,0x02,0x03,0x04,0x05,0x06,0x07]);
function request(mode, content, originHeader = origin, token = 'valid-turnstile-token-123') {
  const form = new FormData();
  form.set('file', new File([content], mode === 'pdf-to-word' ? 'example.pdf' : 'example.docx'));
  form.set('turnstileToken', token);
  return new Request(url + '/api/convert/' + mode, { method:'POST', headers:{ Origin:originHeader }, body:form });
}
test('health returns no credentials', async () => {
  const res = await worker.fetch(new Request(url + '/health'),env);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.adobeConfigured,true);
  assert.equal(JSON.stringify(data).includes(env.ADOBE_CLIENT_SECRET),false);
});
test('disallow non-RankNova origins and reject missing backend secrets', async () => {
  assert.equal((await worker.fetch(request('pdf-to-word',pdf,'https://evil.example'),env)).status,403);
  assert.equal((await worker.fetch(request('pdf-to-word',pdf),{...env,ADOBE_CLIENT_SECRET:''})).status,503);
  assert.equal((await worker.fetch(request('pdf-to-word',pdf),{...env,RATE_LIMITER:null})).status,503);
});
test('invalid magic and empty security token rejected before calling Adobe', async () => {
  assert.equal((await worker.fetch(request('word-to-pdf',pdf),env)).status,400);
  assert.equal((await worker.fetch(request('pdf-to-word',pdf,origin,''),env)).status,403);
});
test('successful PDF to DOCX REST flow uses official endpoints, never leaks auth',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async (address,options={})=>{
    const target=String(address);calls.push({target,options});
    if(target.includes('siteverify')) return Response.json({success:true,hostname:'mmoavia7861.github.io'});
    if(target.endsWith('/token')) return Response.json({access_token:'secret-adobe-access-token'});
    if(target.endsWith('/assets')) return Response.json({assetID:'urn:aaid:AS:UE1:sample',uploadUri:storage});
    if(target===storage) return new Response(null,{status:200});
    if(target.endsWith('/operation/exportpdf')) {
      assert.equal(JSON.parse(options.body).targetFormat,'docx');
      return new Response(null,{status:201,headers:{location:'https://pdf-services.adobe.io/operation/exportpdf/job1/status'}});
    }
    if(target.endsWith('/status')) return Response.json({status:'done',asset:{downloadUri:outputStorage}});
    if(target===outputStorage) return new Response(docx,{status:200,headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});
    throw new Error('unexpected request to '+target);
  };
  try {
    const response=await worker.fetch(request('pdf-to-word',pdf),env);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/wordprocessingml/);
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),docx);
    assert.equal(calls.length,7);
    const auth=calls.find(c=>c.target.endsWith('/token'));
    assert.match(String(auth.options.body),/client_secret=private-client-secret/);
    assert.equal(JSON.stringify(await worker.fetch(new Request(url+'/health'),env)).includes('private-client'),false);
  }finally{globalThis.fetch=original;}
});
test('successful DOCX to PDF sends createpdf operation and validates PDF bytes', async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async (address,options={})=>{
    const target=String(address);
    if(target.includes('siteverify'))return Response.json({success:true,hostname:'mmoavia7861.github.io'});
    if(target.endsWith('/token'))return Response.json({access_token:'secret-adobe-access-token'});
    if(target.endsWith('/assets'))return Response.json({assetID:'urn:aaid:AS:UE1:sample',uploadUri:storage});
    if(target===storage)return new Response(null,{status:200});
    if(target.endsWith('/operation/createpdf')){
      assert.deepEqual(JSON.parse(options.body),{assetID:'urn:aaid:AS:UE1:sample'});
      return new Response(null,{status:201,headers:{location:'https://pdf-services.adobe.io/operation/createpdf/job2/status'}});
    }
    if(target.endsWith('/status'))return Response.json({status:'done',asset:{downloadUri:outputStorage}});
    if(target===outputStorage)return new Response(pdf,{status:200});
    throw new Error('unexpected '+target);
  };
  try {
    const response=await worker.fetch(request('word-to-pdf',docx),env);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'application/pdf');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),pdf);
  }finally{globalThis.fetch=original;}
});
test('untrusted signed storage URI is rejected without uploading a document',async()=>{
  const original=globalThis.fetch;let putCalls=0;
  globalThis.fetch=async (address,options={})=>{
    const target=String(address);
    if(options.method==='PUT')putCalls++;
    if(target.includes('siteverify'))return Response.json({success:true,hostname:'mmoavia7861.github.io'});
    if(target.endsWith('/token'))return Response.json({access_token:'secret-adobe-access-token'});
    if(target.endsWith('/assets'))return Response.json({assetID:'urn:aaid:AS:UE1:sample',uploadUri:'https://attacker.example/upload'});
    throw new Error('unexpected '+target);
  };
  try{
    const response=await worker.fetch(request('pdf-to-word',pdf),env);
    assert.equal(response.status,502);
    assert.equal(putCalls,0);
  }finally{globalThis.fetch=original;}
});
