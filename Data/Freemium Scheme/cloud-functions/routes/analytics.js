/**
 * Analytics routes: /api/usage, /api/exports, /api/dashboard
 * Tracks calculator usage, manages exports, provides dashboard data.
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/firebase-auth');
const { supaAdmin } = require('../services/supabase');

const router = Router();

/**
 * POST /api/usage — Log a usage event (calc run, page view, etc).
 */
router.post('/usage', requireAuth, async (req, res) => {
  try {
    const { event_type, calculator, metadata } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    await supaAdmin.from('usage_events').insert({
      user_id: req.user.uid,
      event_type,
      calculator: calculator || null,
      metadata: metadata || {},
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/exports — User's export history.
 */
router.get('/exports', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from('exports')
      .select('id, calculator_type, export_type, status, created_at, download_count')
      .eq('user_id', req.user.uid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch exports' });
    }
    res.json({ exports: data });
  } catch (err) {
    console.error('GET /api/exports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/dashboard — Aggregated dashboard data for the user.
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const [profileRes, entRes, subRes, projectsRes, exportsRes, usageRes] = await Promise.all([
      supaAdmin.from('profiles').select('*').eq('id', userId).single(),
      supaAdmin.from('entitlements').select('*').eq('user_id', userId).single(),
      supaAdmin.from('subscriptions').select('*, plans(name, tier, billing_cycle, price_idr)')
        .eq('user_id', userId).in('status', ['active', 'past_due', 'cancelled'])
        .order('created_at', { ascending: false }).limit(1).single(),
      supaAdmin.from('projects').select('id, name, calculator_type, updated_at')
        .eq('user_id', userId).order('updated_at', { ascending: false }),
      supaAdmin.from('exports').select('id, calculator_type, export_type, status, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supaAdmin.from('usage_events').select('event_type, calculator, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    ]);

    res.json({
      profile: profileRes.data,
      entitlements: entRes.data,
      subscription: subRes.data || null,
      projects: projectsRes.data || [],
      recent_exports: exportsRes.data || [],
      recent_usage: usageRes.data || [],
      stats: {
        total_projects: projectsRes.data?.length || 0,
        total_exports: exportsRes.data?.length || 0
      }
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
