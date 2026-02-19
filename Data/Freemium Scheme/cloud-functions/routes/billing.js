/**
 * Billing routes: /api/create-checkout, /api/plans, /api/subscriptions
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/firebase-auth');
const { checkoutLimiter } = require('../middleware/rate-limit');
const { supaAdmin } = require('../services/supabase');
const { createInvoice } = require('../services/mayar');

const router = Router();

/**
 * GET /api/plans — List active plans (public).
 */
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from('plans')
      .select('id, name, tier, billing_cycle, price_idr, price_usd, features, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch plans' });
    }
    res.json({ plans: data });
  } catch (err) {
    console.error('GET /api/plans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/subscriptions — User's subscription history.
 */
router.get('/subscriptions', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from('subscriptions')
      .select('*, plans(name, tier, billing_cycle, price_idr)')
      .eq('user_id', req.user.uid)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
    res.json({ subscriptions: data });
  } catch (err) {
    console.error('GET /api/subscriptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/create-checkout — Create Mayar invoice and return payment URL.
 */
router.post('/create-checkout', checkoutLimiter, requireAuth, async (req, res) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ error: 'plan_id is required' });
    }

    const userId = req.user.uid;
    const userEmail = req.user.email;

    // 1. Fetch plan
    const { data: plan, error: planErr } = await supaAdmin
      .from('plans').select('*').eq('id', plan_id).eq('is_active', true).single();

    if (planErr || !plan) {
      return res.status(400).json({ error: 'Invalid or inactive plan' });
    }
    if (plan.tier === 'free') {
      return res.status(400).json({ error: 'Cannot checkout free plan' });
    }

    // 2. Fetch user profile
    const { data: profile } = await supaAdmin
      .from('profiles').select('full_name, phone, email').eq('id', userId).single();

    // 3. Calculate amount with tax
    const amountIdr = plan.price_idr;
    const taxIdr = Math.round(amountIdr * 0.11);
    const totalIdr = amountIdr + taxIdr;

    // 4. Generate keys
    const idempotencyKey = `${userId}-${plan_id}-${Date.now()}`;
    const externalId = `RZ-${plan_id}-${userId.slice(0, 8)}-${Date.now()}`;

    // 5. Invoice number
    const { data: invNum } = await supaAdmin.rpc('generate_invoice_number');

    // 6. Check existing subscription
    const { data: existingSub } = await supaAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due'])
      .limit(1);

    const kind = (existingSub && existingSub.length > 0) ? 'renewal' : 'new';
    const subscriptionId = existingSub?.[0]?.id || null;

    // 7. Create Mayar invoice
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const mayarData = await createInvoice({
      name: profile?.full_name || userEmail,
      email: userEmail,
      mobile: profile?.phone || '0000000000',
      redirectUrl: 'https://resistancezero.com/dashboard.html?payment=success',
      description: `ResistanceZero ${plan.name} — ${externalId}`,
      expiredAt,
      items: [{ quantity: 1, rate: totalIdr, description: `${plan.name} subscription` }]
    });

    if (mayarData.statusCode !== 200 || !mayarData.data) {
      console.error('Mayar invoice create failed:', mayarData);
      return res.status(502).json({ error: 'Payment gateway error' });
    }

    // 8. Store invoice
    const { data: invoice, error: invErr } = await supaAdmin
      .from('invoices')
      .insert({
        user_id: userId, subscription_id: subscriptionId, plan_id,
        invoice_number: invNum, amount_idr: amountIdr, tax_idr: taxIdr, total_idr: totalIdr,
        status: 'sent', kind, due_date: expiredAt,
        mayar_invoice_id: mayarData.data.id,
        mayar_transaction_id: mayarData.data.transactionId,
        checkout_url: mayarData.data.link,
        external_id: externalId, idempotency_key: idempotencyKey
      })
      .select().single();

    if (invErr) {
      console.error('Invoice insert error:', invErr);
      return res.status(500).json({ error: 'Failed to create invoice record' });
    }

    // 9. Create pending subscription if new
    if (kind === 'new') {
      await supaAdmin.from('subscriptions').insert({
        user_id: userId, plan_id, status: 'active',
        current_period_start: new Date().toISOString(),
        renewal_mode: 'manual_qris'
      });
    }

    // 10. Audit
    await supaAdmin.from('audit_log').insert({
      user_id: userId, action: 'CHECKOUT_CREATED',
      detail: { plan_id, invoice_id: invoice.id, amount: totalIdr }
    });

    res.json({
      checkout_url: mayarData.data.link,
      invoice_id: invoice.id,
      invoice_number: invNum,
      amount: totalIdr,
      expires_at: expiredAt
    });

  } catch (err) {
    console.error('POST /api/create-checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
