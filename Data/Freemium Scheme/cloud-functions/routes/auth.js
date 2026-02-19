/**
 * Auth routes: /api/me, /api/profile, /api/fcm-token
 * Handles Firebase→Supabase user bridge.
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/firebase-auth');
const { authLimiter } = require('../middleware/rate-limit');
const { supaAdmin } = require('../services/supabase');
const { sendWelcome } = require('../services/email');

const router = Router();

/**
 * GET /api/me — User profile + entitlements.
 * On first call, creates profile + free entitlements (upsert).
 * This replaces the old Supabase handle_new_user() trigger.
 */
router.get('/me', authLimiter, requireAuth, async (req, res) => {
  try {
    const { uid, email, name, picture, firebase_provider } = req.user;

    // Upsert profile (creates on first login, updates on subsequent)
    const { data: profile, error: profileErr } = await supaAdmin
      .from('profiles')
      .upsert({
        id: uid,
        email: email,
        full_name: name || undefined,
        avatar_url: picture || undefined,
        firebase_provider: firebase_provider,
        last_login_at: new Date().toISOString()
      }, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();

    if (profileErr) {
      console.error('Profile upsert error:', profileErr);
      return res.status(500).json({ error: 'Failed to load profile' });
    }

    // Ensure entitlements exist (upsert free tier if missing)
    const { data: entitlements } = await supaAdmin
      .from('entitlements')
      .upsert({ user_id: uid, tier: 'free' }, { onConflict: 'user_id', ignoreDuplicates: true })
      .select()
      .single();

    // Fetch active subscription if any
    const { data: subscription } = await supaAdmin
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', uid)
      .in('status', ['active', 'past_due', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check if this is a new user (created just now)
    const isNewUser = profile && (new Date() - new Date(profile.created_at)) < 5000;
    if (isNewUser) {
      sendWelcome(email, name).catch(err => console.warn('Welcome email failed:', err.message));
      await supaAdmin.from('audit_log').insert({
        user_id: uid,
        action: 'USER_CREATED',
        detail: { provider: firebase_provider }
      });
    }

    res.json({
      profile,
      entitlements: entitlements || {
        tier: 'free', can_export_pdf: false, can_save_projects: false,
        can_advanced_mode: false, can_compare: false, can_full_breakdown: false,
        watermark: true, max_it_load_kw: 5000, max_projects: 0, max_exports_per_day: 0
      },
      subscription: subscription || null
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/profile — Update user profile fields.
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    const allowed = ['full_name', 'company', 'country', 'phone', 'invoice_name', 'invoice_address'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supaAdmin
      .from('profiles')
      .update(updates)
      .eq('id', uid)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ profile: data });
  } catch (err) {
    console.error('PUT /api/profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fcm-token — Register FCM token for push notifications.
 */
router.post('/fcm-token', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    const { token, device_info } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const { error } = await supaAdmin
      .from('fcm_tokens')
      .upsert({
        user_id: uid,
        token: token,
        device_info: device_info || {}
      }, { onConflict: 'user_id,token' });

    if (error) {
      console.error('FCM token upsert error:', error);
      return res.status(500).json({ error: 'Failed to register token' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/fcm-token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
