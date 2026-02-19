/**
 * Firebase Connectivity & Configuration Test
 * Tests what's possible without a service account key
 */
require('dotenv').config();

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const WARN = '\x1b[33mWARN\x1b[0m';
let passed = 0, failed = 0, warned = 0;

function ok(name, condition, detail) {
  if (condition) { console.log('  ' + PASS + ' ' + name + (detail ? ' -- ' + detail : '')); passed++; }
  else { console.log('  ' + FAIL + ' ' + name + (detail ? ' -- ' + detail : '')); failed++; }
}
function warn(name, detail) { console.log('  ' + WARN + ' ' + name + (detail ? ' -- ' + detail : '')); warned++; }

async function run() {
  // ══════════════════════════════════════════
  console.log('\n=== 1. ENVIRONMENT VARIABLES ===');
  ok('FIREBASE_PROJECT_ID set', !!process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_PROJECT_ID);

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const hasServiceAccount = clientEmail && !clientEmail.startsWith('TODO') && privateKey && !privateKey.startsWith('TODO');
  if (hasServiceAccount) {
    ok('FIREBASE_CLIENT_EMAIL set', true, clientEmail.substring(0, 30) + '...');
    ok('FIREBASE_PRIVATE_KEY set', true, 'present (' + privateKey.length + ' chars)');
  } else {
    warn('FIREBASE_CLIENT_EMAIL', 'NOT SET -- service account key needed');
    warn('FIREBASE_PRIVATE_KEY', 'NOT SET -- service account key needed');
  }

  const hasGoogleCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (hasGoogleCreds) {
    ok('GOOGLE_APPLICATION_CREDENTIALS set', true, process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  // ══════════════════════════════════════════
  console.log('\n=== 2. FIREBASE ADMIN SDK INITIALIZATION ===');
  let admin, auth;
  try {
    const firebaseService = require('./services/firebase');
    admin = firebaseService.admin;
    auth = firebaseService.auth;
    ok('firebase-admin loads', !!admin);
    ok('admin.apps initialized', admin.apps.length > 0, admin.apps.length + ' app(s)');
    ok('auth service available', !!auth);
    ok('messaging service available', !!firebaseService.messaging);
    ok('verifyIdToken function exists', typeof firebaseService.verifyIdToken === 'function');
  } catch (e) {
    ok('firebase-admin loads', false, e.message);
  }

  // ══════════════════════════════════════════
  console.log('\n=== 3. FIREBASE PROJECT CONNECTIVITY ===');
  // Test via Firebase REST API (public endpoints, no auth needed)
  const projectId = process.env.FIREBASE_PROJECT_ID;

  // Test 1: Firebase Auth REST API - check project exists
  try {
    const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const data = await res.json();
    // If Email/Password is enabled, anonymous signup might work or fail with specific error
    // If not enabled, we get "OPERATION_NOT_ALLOWED" or "ADMIN_ONLY_OPERATION"
    if (data.error) {
      const code = data.error.message;
      if (code === 'OPERATION_NOT_ALLOWED') {
        warn('Firebase Auth: Email/Password sign-in', 'NOT ENABLED -- enable in Firebase Console > Authentication > Sign-in method');
      } else if (code === 'ADMIN_ONLY_OPERATION') {
        warn('Firebase Auth: anonymous signup', 'DISABLED (expected) -- project reachable');
        ok('Firebase project reachable', true, 'API responded');
      } else {
        ok('Firebase project reachable', true, 'API responded with: ' + code);
      }
    } else {
      ok('Firebase project reachable', true, 'anonymous signup succeeded');
      // Clean up: we accidentally created an anonymous user
      warn('Anonymous user created', 'clean up in Firebase Console if needed');
    }
  } catch (e) {
    ok('Firebase project reachable', false, e.message);
  }

  // Test 2: Check if Email/Password auth is enabled
  try {
    const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test-probe@nonexistent.com', password: 'probe123', returnSecureToken: true })
    });
    const data = await res.json();
    if (data.error) {
      const code = data.error.message;
      if (code === 'EMAIL_NOT_FOUND' || code === 'INVALID_LOGIN_CREDENTIALS') {
        ok('Email/Password auth ENABLED', true, 'auth method active');
      } else if (code === 'OPERATION_NOT_ALLOWED') {
        warn('Email/Password auth NOT ENABLED', 'Go to Firebase Console > Authentication > Sign-in method > Enable Email/Password');
      } else {
        ok('Email/Password auth check', true, 'response: ' + code);
      }
    }
  } catch (e) {
    ok('Email/Password auth check', false, e.message);
  }

  // Test 3: Check Google OAuth
  try {
    const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: 'id_token=fake&providerId=google.com',
        requestUri: 'https://resistancezero.com',
        returnSecureToken: true
      })
    });
    const data = await res.json();
    if (data.error) {
      const code = data.error.message;
      if (code.includes('OPERATION_NOT_ALLOWED')) {
        warn('Google OAuth NOT ENABLED', 'optional -- enable if needed');
      } else if (code.includes('INVALID_IDP_RESPONSE') || code.includes('INVALID_CREDENTIAL')) {
        ok('Google OAuth ENABLED', true, 'provider active (token was fake, expected fail)');
      } else {
        ok('Google OAuth check', true, 'response: ' + code.substring(0, 60));
      }
    }
  } catch (e) {
    ok('Google OAuth check', false, e.message);
  }

  // ══════════════════════════════════════════
  console.log('\n=== 4. FIREBASE ADMIN TOKEN VERIFICATION ===');
  if (hasServiceAccount || hasGoogleCreds) {
    // Test verifying a fake token (should fail with auth/argument-error, not connection error)
    try {
      await auth.verifyIdToken('fake-token-for-testing');
      ok('token verification', false, 'should have thrown');
    } catch (e) {
      if (e.code === 'auth/argument-error' || e.code === 'auth/invalid-id-token') {
        ok('verifyIdToken rejects bad token', true, e.code);
      } else {
        ok('verifyIdToken connectivity', false, e.code + ': ' + e.message);
      }
    }

    // Test listing users (requires admin SDK)
    try {
      const listResult = await auth.listUsers(1);
      ok('listUsers works', true, listResult.users.length + ' user(s) found');
    } catch (e) {
      if (e.code === 'auth/insufficient-permission') {
        warn('listUsers', 'insufficient permission -- check service account roles');
      } else {
        ok('listUsers', false, e.code + ': ' + e.message);
      }
    }
  } else {
    warn('Admin token verification SKIPPED', 'no service account credentials');
    warn('Admin listUsers SKIPPED', 'no service account credentials');
    console.log('  → Generate service account key:');
    console.log('    Firebase Console > Project Settings > Service accounts > Generate new private key');
  }

  // ══════════════════════════════════════════
  console.log('\n=== 5. FRONTEND CONFIG VALIDATION ===');
  try {
    const fs = require('fs');
    const configPath = 'C:/Users/User/Sandbox/firebase-config.js';
    const content = fs.readFileSync(configPath, 'utf8');

    ok('firebase-config.js exists', true);
    ok('contains apiKey', content.includes('AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A'));
    ok('contains projectId', content.includes('resistancezero-a5ad5'));
    ok('contains authDomain', content.includes('resistancezero-a5ad5.firebaseapp.com'));
    ok('contains appId', content.includes('1:416280004490:web:9cc660ea78df69e1636a73'));
    ok('contains API_BASE', content.includes('bfrfranco-github-io-586770625232.us-central1.run.app'));
  } catch (e) {
    ok('firebase-config.js exists', false, e.message);
  }

  // ══════════════════════════════════════════
  console.log('\n=== 6. FIREBASE AUTH MIDDLEWARE ===');
  try {
    const { requireAuth, requireAdmin } = require('./middleware/firebase-auth');
    ok('requireAuth function exists', typeof requireAuth === 'function');
    ok('requireAdmin function exists', typeof requireAdmin === 'function');

    // Test requireAuth rejects missing header
    const mockReq = { headers: {} };
    const mockRes = { status: (code) => ({ json: (body) => { mockRes._code = code; mockRes._body = body; } }) };
    await requireAuth(mockReq, mockRes, () => {});
    ok('requireAuth rejects no token', mockRes._code === 401, 'status: ' + mockRes._code);

    // Test requireAuth rejects bad header format
    const mockReq2 = { headers: { authorization: 'NotBearer xxx' } };
    const mockRes2 = { status: (code) => ({ json: (body) => { mockRes2._code = code; } }) };
    await requireAuth(mockReq2, mockRes2, () => {});
    ok('requireAuth rejects non-Bearer', mockRes2._code === 401);

    // Test requireAdmin rejects non-admin
    const mockReq3 = { user: { email: 'nobody@test.com' } };
    const mockRes3 = { status: (code) => ({ json: (body) => { mockRes3._code = code; } }) };
    requireAdmin(mockReq3, mockRes3, () => { mockRes3._code = 200; });
    ok('requireAdmin rejects non-admin email', mockRes3._code === 403);

    // Test requireAdmin accepts admin email
    const mockReq4 = { user: { email: 'bagusdpermana7@gmail.com' } };
    const mockRes4 = {};
    let nextCalled = false;
    requireAdmin(mockReq4, mockRes4, () => { nextCalled = true; });
    ok('requireAdmin accepts admin email', nextCalled);
  } catch (e) {
    ok('middleware test', false, e.message);
  }

  // ══════════════════════════════════════════
  console.log('\n========================================');
  console.log('  TOTAL : ' + (passed + failed) + ' tests, ' + warned + ' warnings');
  console.log('  ' + PASS + '  : ' + passed);
  if (failed) console.log('  ' + FAIL + '  : ' + failed);
  if (warned) console.log('  ' + WARN + '  : ' + warned);
  console.log('========================================');

  if (failed === 0) {
    console.log('\n  ALL TESTS PASSED!');
    if (warned > 0) console.log('  (' + warned + ' warnings — check items above)');
    console.log('');
  } else {
    console.log('\n  ' + failed + ' test(s) FAILED.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
