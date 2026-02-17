/**
 * ResistanceZero SaaS API — Google Cloud Run
 * v2.0.0 — Firebase Auth + Supabase DB + Mayar Payments
 *
 * Endpoints:
 *   GET  /health              — health check
 *   GET  /api/me              — user profile + entitlements (Firebase JWT)
 *   PUT  /api/profile         — update user profile
 *   POST /api/fcm-token       — register FCM push token
 *   GET  /api/plans           — list active plans (public)
 *   GET  /api/subscriptions   — user's subscription history
 *   POST /api/create-checkout — create Mayar invoice
 *   POST /api/webhook/mayar   — receive Mayar webhook
 *   POST /api/projects        — CRUD saved calculator configs
 *   POST /api/usage           — log usage event
 *   GET  /api/exports         — user's export history
 *   GET  /api/dashboard       — aggregated dashboard data
 *   POST /api/reconcile       — admin: manual entitlement reconciliation
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rate-limit');

// Route modules
const authRoutes = require('./routes/auth');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhook');
const projectRoutes = require('./routes/projects');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Security ───────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Static pages handle their own CSP
}));

// ─── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  credentials: true
}));

// ─── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── Global rate limit ──────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    auth: 'firebase',
    timestamp: new Date().toISOString()
  });
});

// ─── Mount routes ───────────────────────────────────────────────────────────
app.use('/api', authRoutes);           // /api/me, /api/profile, /api/fcm-token
app.use('/api', billingRoutes);        // /api/plans, /api/subscriptions, /api/create-checkout
app.use('/api/webhook', webhookRoutes); // /api/webhook/mayar
app.use('/api/projects', projectRoutes); // /api/projects CRUD
app.use('/api', analyticsRoutes);      // /api/usage, /api/exports, /api/dashboard
app.use('/api', adminRoutes);          // /api/reconcile

// ─── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ResistanceZero API v2.0.0 running on port ${PORT}`);
  console.log(`Auth: Firebase (project: ${process.env.FIREBASE_PROJECT_ID})`);
  console.log(`DB: ${process.env.SUPABASE_URL}`);
  console.log(`Payment: ${process.env.MAYAR_API_BASE || 'https://api.mayar.id/hl/v1'}`);
});
