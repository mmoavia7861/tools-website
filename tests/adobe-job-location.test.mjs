import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdobeJobLocation } from '../worker/api.mjs';

const valid = [
  ['https://pdf-services.adobe.io/operation/exportpdf/abc123/status', 'exportpdf'],
  ['https://pdf-services-ue1.adobe.io/operation/exportpdf/abc123/status', 'exportpdf'],
  ['https://pdf-services-ew1.adobe.io/operation/exportpdf/abc123/status', 'exportpdf'],
  ['https://pdf-services-ue1.adobe.io/operation/exportpdf/abc123/status?requestId=test', 'exportpdf'],
  ['https://pdf-services-ew1.adobe.io/operation/createpdf/1234-5678/status', 'createpdf'],
  ['/operation/exportpdf/abc123/status', 'exportpdf'],
  ['operation/createpdf/abc123/status', 'createpdf'],
];
for (const [location, operation] of valid) {
  test('accepts official Adobe polling Location: ' + location, () => {
    const result = resolveAdobeJobLocation(location, operation);
    assert.ok(result.url, JSON.stringify(result));
    assert.match(result.url, /^https:\/\/pdf-services(?:-(?:ue1|ew1))?\.adobe\.io\/operation\//);
  });
}

const rejected = [
  ['https://not-adobe.example/operation/exportpdf/abc123/status', 'exportpdf'],
  ['https://pdf-services.adobe.io.evil.example/operation/exportpdf/abc123/status', 'exportpdf'],
  ['http://pdf-services.adobe.io/operation/exportpdf/abc123/status', 'exportpdf'],
  ['https://evil@pdf-services.adobe.io/operation/exportpdf/abc123/status', 'exportpdf'],
  ['https://pdf-services.adobe.io/operation/createpdf/abc123/status', 'exportpdf'],
  ['https://pdf-services.adobe.io/operation/exportpdf/abc123/other', 'exportpdf'],
  ['https://pdf-services.adobe.io/operation/exportpdf/abc123/status#token', 'exportpdf'],
  ['https://pdf-services.adobe.io/operation/exportpdf/abc123/status?' + 'a'.repeat(1100), 'exportpdf'],
  ['https://pdf-services.adobe.io/operation/exportpdf/abc123/status\nHost: evil', 'exportpdf'],
];
for (const [location, operation] of rejected) {
  test('rejects unsafe Adobe polling Location', () => {
    const result = resolveAdobeJobLocation(location, operation);
    assert.equal(result.url, undefined);
    assert.ok(result.reason);
  });
}
