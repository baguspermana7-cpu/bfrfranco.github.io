/**
 * Admin routes: /api/reconcile
 * Administrative operations (protected by admin middleware).
 */
const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/firebase-auth');
const { supaAdmin } = require('../services/supabase');

const router = Router();

/**
 * POST /api/reconcile — Manual entitlement reconciliation.
 */
router.post('/reconcile', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supaAdmin.rpc('reconcile_entitlements');
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await supaAdmin.from('audit_log').insert({
      user_id: req.user.uid,
      action: 'ADMIN_RECONCILE',
      detail: { actions: data, triggered_by: req.user.email }
    });

    res.json({ ok: true, actions: data });
  } catch (err) {
    console.error('POST /api/reconcile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
