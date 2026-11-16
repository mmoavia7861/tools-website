import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_EMAIL, isOwnerOtpSession } from './adminAccess';

test('only the verified owner with server-verified email OTP has admin access', () => {
  assert.equal(isOwnerOtpSession(OWNER_EMAIL, true, 'custom', true), true);
  assert.equal(isOwnerOtpSession(OWNER_EMAIL.toUpperCase(), true, 'custom', true), true);
  assert.equal(isOwnerOtpSession(OWNER_EMAIL, true, 'password', true), false);
  assert.equal(isOwnerOtpSession(OWNER_EMAIL, true, 'password', false), false);
  assert.equal(isOwnerOtpSession(OWNER_EMAIL, true, 'custom', false), false);
  assert.equal(isOwnerOtpSession(OWNER_EMAIL, true, 'google.com', true), false);
  assert.equal(isOwnerOtpSession(OWNER_EMAIL, false, 'custom', true), false);
  assert.equal(isOwnerOtpSession('other@gmail.com', true, 'custom', true), false);
  assert.equal(isOwnerOtpSession(null, true, 'custom', true), false);
});
