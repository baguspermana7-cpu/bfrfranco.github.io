/**
 * Firebase Admin SDK initialization.
 * Verifies Firebase ID tokens sent from the frontend.
 *
 * Credential resolution order:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var (path to service account JSON)
 *   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env vars (inline)
 *   3. Application Default Credentials (works on Cloud Run automatically)
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Option 1: JSON key file path
    credential = admin.credential.applicationDefault();
    console.log('Firebase: using GOOGLE_APPLICATION_CREDENTIALS file');
  } else if (clientEmail && privateKey && !privateKey.startsWith('TODO')) {
    // Option 2: Inline credentials from env vars
    credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    });
    console.log('Firebase: using inline service account credentials');
  } else {
    // Option 3: ADC (works on Cloud Run with default service account)
    try {
      credential = admin.credential.applicationDefault();
      console.log('Firebase: using Application Default Credentials');
    } catch (e) {
      console.warn('Firebase: No credentials found. Auth verification will fail.');
      console.warn('  Fix: Generate a service account key from Firebase Console');
      console.warn('  → Project Settings → Service accounts → Generate new private key');
      credential = null;
    }
  }

  if (credential) {
    admin.initializeApp({ credential, projectId });
  } else {
    admin.initializeApp({ projectId });
  }
}

const auth = admin.auth();
const messaging = admin.messaging();

/**
 * Verify a Firebase ID token and return the decoded claims.
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
async function verifyIdToken(idToken) {
  return auth.verifyIdToken(idToken);
}

module.exports = { admin, auth, messaging, verifyIdToken };
