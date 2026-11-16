import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_EMAIL, isOwnerPasswordSession } from './adminAccess';

test('only verified owner with Firebase password session is an admin', () => {
  assert.equal(isOwnerPasswordSession(OWNER_EMAIL, true, 'password'), true);
  assert.equal(isOwnerPasswordSession(OWNER_EMAIL.toUpperCase(), true, 'password'), true);
  assert.equal(isOwnerPasswordSession(OWNER_EMAIL, true, 'google.com'), false);
  assert.equal(isOwnerPasswordSession(OWNER_EMAIL, false, 'password'), false);
  assert.equal(isOwnerPasswordSession('other@gmail.com', true, 'password'), false);
  assert.equal(isOwnerPasswordSession(null, true, 'password'), false);
  assert.equal(isOwnerPasswordSession(OWNER_EMAIL, true, null), false);
});
