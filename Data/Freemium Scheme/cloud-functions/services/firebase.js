/**
 * Firebase Admin SDK initialization.
 * Verifies Firebase ID tokens sent from the frontend.
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
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
