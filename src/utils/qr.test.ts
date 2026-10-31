import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeWifiString, buildWifiPayload, buildVCardPayload, validateUrl } from './qr';

test('escapeWifiString properly escapes colons, semicolons, backslashes and commas', () => {
  assert.equal(escapeWifiString('My:Home;Network\\With,Special"Chars'), 'My\\:Home\\;Network\\\\With\\,Special\\"Chars');
  assert.equal(escapeWifiString('StandardNet'), 'StandardNet');
  assert.equal(escapeWifiString(''), '');
});

test('buildWifiPayload generates correct WPA payload', () => {
  const result = buildWifiPayload({
    ssid: 'RankNova_Guest',
    password: 'p@ss:word;123',
    encryption: 'WPA',
    hidden: false
  });
  assert.equal(result, 'WIFI:T:WPA;S:RankNova_Guest;P:p@ss\\:word\\;123;;');
});

test('buildWifiPayload handles open networks without password', () => {
  const result = buildWifiPayload({
    ssid: 'FreeAirportWifi',
    encryption: 'nopass',
    hidden: true
  });
  assert.equal(result, 'WIFI:T:nopass;S:FreeAirportWifi;H:true;;');
});

test('buildVCardPayload generates standard compliant vCard 3.0', () => {
  const result = buildVCardPayload({
    firstName: 'Nova',
    lastName: 'Engineer',
    organization: 'RankNova Tools',
    title: 'Lead Architect',
    phone: '+1-555-0199',
    email: 'nova@ranknova.test',
    website: 'https://ranknova.test'
  });

  assert.ok(result.includes('BEGIN:VCARD'));
  assert.ok(result.includes('VERSION:3.0'));
  assert.ok(result.includes('FN:Nova Engineer'));
  assert.ok(result.includes('N:Engineer;Nova;;;'));
  assert.ok(result.includes('ORG:RankNova Tools'));
  assert.ok(result.includes('TITLE:Lead Architect'));
  assert.ok(result.includes('TEL;TYPE=CELL:+1-555-0199'));
  assert.ok(result.includes('EMAIL;TYPE=INTERNET:nova@ranknova.test'));
  assert.ok(result.includes('URL:https://ranknova.test'));
  assert.ok(result.includes('END:VCARD'));
});

test('validateUrl validates http and https URLs and rejects invalid protocols', () => {
  const validHttps = validateUrl('https://example.com/path?q=1');
  assert.equal(validHttps.valid, true);
  assert.equal(validHttps.formatted, 'https://example.com/path?q=1');

  const autoHttps = validateUrl('example.com');
  assert.equal(autoHttps.valid, true);
  assert.equal(autoHttps.formatted, 'https://example.com/');

  const invalidScheme = validateUrl('ftp://secret-server.local');
  assert.equal(invalidScheme.valid, false);

  const javascriptScheme = validateUrl('javascript:alert(1)');
  assert.equal(javascriptScheme.valid, false);

  const empty = validateUrl('   ');
  assert.equal(empty.valid, false);
});
