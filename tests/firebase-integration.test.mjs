import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const config = JSON.parse(source('firebase-applet-config.json'));
const cli = JSON.parse(source('firebase.json'));
const service = source('src/services/firebase.ts');
const admin = source('src/views/AdminView.tsx');
const contact = source('src/views/ContactView.tsx');
const rules = source('firestore.rules');

test('Firebase client uses the configured named database, not the default database', () => {
  assert.ok(config.projectId);
  assert.ok(config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)');
  assert.match(service, /getFirestore\(app,\s*firebaseConfig\.firestoreDatabaseId\)/);
  assert.equal(cli.firestore.length, 1);
  assert.equal(cli.firestore[0].database, config.firestoreDatabaseId);
  assert.equal(cli.firestore[0].rules, 'firestore.rules');
});

test('Admin access requires verified Gmail/password plus a server-issued email OTP token', () => {
  assert.match(admin, /signInWithEmailAndPassword\(auth,/);
  assert.match(admin, /isOwnerOtpSession/);
  assert.match(admin, /AdminOtpChallenge/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.token\.firebase\.sign_in_provider == 'custom'/);
  assert.match(rules, /request\.auth\.token\.toolscresta_otp == true/);
  assert.match(rules, /match \/admins\/\{adminId\} \{\s*allow read, write: if false;/);
  assert.doesNotMatch(rules, /exists\(\/databases\/\$\(database\)\/documents\/admins\//);
});

test('Contact messages are not readable by visitors and use a strict create schema', () => {
  const block = rules.split('match /contact_messages/{messageId} {')[1].split('\n    }')[0];
  assert.match(block, /allow get, list: if isAdmin\(\)/);
  assert.match(block, /keys\(\)\.hasOnly/);
  assert.match(block, /createdAt/);
  assert.match(block, /incoming\(\)\.status == 'new'/);
  assert.match(block, /affectedKeys\(\)\.hasOnly\(\['status'\]\)/);
  for (const key of ['name', 'email', 'category', 'message', 'status', 'createdAt']) {
    assert.ok(contact.includes(key + ':') || contact.includes(key + ','), 'Contact payload must include ' + key);
  }
});

test('Admin inbox reads saved Firestore messages only for authenticated owner', () => {
  assert.match(admin, /const loadMessages = async/);
  assert.match(admin, /if \(!isOwner\) return;/);
  assert.match(admin, /collection\(db,\s*'contact_messages'\)/);
  assert.match(admin, /orderBy\('createdAt',\s*'desc'\)/);
  assert.match(admin, /limit\(100\)/);
  assert.match(admin, /updateDoc\(doc\(db,\s*'contact_messages',\s*messageId\),\s*\{\s*status\s*\}\)/);
  assert.match(admin, /testConnection\(\)/);
});

test('Admin UI reacts to ID token provider changes even when Firebase UID is unchanged', () => {
  assert.match(service, /onIdTokenChanged/);
  assert.match(admin, /onIdTokenChanged\(auth,/);
  assert.match(admin, /token\.signInProvider === 'custom'/);
  assert.match(admin, /token\.claims\.toolscresta_otp === true/);
});
