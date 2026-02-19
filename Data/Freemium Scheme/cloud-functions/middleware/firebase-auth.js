/**
 * Firebase Auth middleware for Express.
 * Verifies Firebase ID tokens from the Authorization header.
 * Attaches decoded user info to req.user.
 */
const { verifyIdToken } = require('../services/firebase');

/**
 * Require a valid Firebase ID token.
 * Sets req.user = { uid, email, name, picture, firebase_provider }
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const idToken = authHeader.slice(7);
  try {
    const decoded = await verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || '',
      picture: decoded.picture || '',
      firebase_provider: decoded.firebase?.sign_in_provider || 'unknown'
    };
    next();
  } catch (err) {
    console.error('Firebase token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require admin access. Must be used after requireAuth.
 */
function requireAdmin(req, res, next) {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase());
  if (!adminEmails.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
