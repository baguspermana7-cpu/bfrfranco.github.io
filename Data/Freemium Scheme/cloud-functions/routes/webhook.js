/**
 * Webhook routes: /api/webhook/mayar
 * Receives Mayar payment webhooks, verifies via API, processes.
 */
const { Router } = require('express');
const { webhookLimiter } = require('../middleware/rate-limit');
const { supaAdmin } = require('../services/supabase');
const { verifyInvoice, fetchPaymentMethod } = require('../services/mayar');
const { sendPaymentReceipt } = require('../services/email');

const router = Router();

/**
 * POST /api/webhook/mayar — Receive and process Mayar webhook.
 */
router.post('/mayar', webhookLimiter, async (req, res) => {
  const startTime = Date.now();
  const payload = req.body;

  try {
    const eventType = payload.event || 'unknown';
    const providerEventId = payload.data?.id || `wh-${Date.now()}`;

    // 1. Log to webhook_log (idempotent via unique constraint)
    const { error: logErr } = await supaAdmin.from('webhook_log').insert({
      provider: 'mayar',
      provider_event_id: providerEventId,
      event_type: eventType,
      status: 'received',
      raw_payload: payload
    });

    if (logErr?.code === '23505') {
      return res.status(200).json({ ok: true, message: 'Already processed' });
    }

    // 2. Route by event type
    if (eventType === 'payment.received') {
      await handlePaymentReceived(payload, providerEventId);
    } else if (eventType === 'membership.memberExpired') {
      await handleMemberExpired(payload, providerEventId);
    } else if (eventType === 'membership.memberUnsubscribed') {
      await handleMemberUnsubscribed(payload, providerEventId);
    } else if (eventType === 'payment.reminder') {
      await updateWebhookStatus(providerEventId, 'processed');
    } else {
      await updateWebhookStatus(providerEventId, 'ignored');
    }

    console.log(`Webhook ${eventType} processed in ${Date.now() - startTime}ms`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(200).json({ ok: true, message: 'Error logged' });
  }
});

async function handlePaymentReceived(payload, providerEventId) {
  const data = payload.data || {};
  const mayarInvoiceId = data.id;
  const amount = data.amount;

  if (!mayarInvoiceId) {
    await updateWebhookStatus(providerEventId, 'failed', 'Missing invoice ID');
    return;
  }

  // Verify via Mayar API
  const { verified } = await verifyInvoice(mayarInvoiceId);
  if (!verified) {
    await updateWebhookStatus(providerEventId, 'failed', 'Verification failed');
    return;
  }

  const paymentMethod = await fetchPaymentMethod(mayarInvoiceId);

  // Find our invoice
  const { data: invoice } = await supaAdmin
    .from('invoices')
    .select('id, external_id, user_id, invoice_number, plan_id')
    .eq('mayar_invoice_id', mayarInvoiceId)
    .limit(1).single();

  if (!invoice) {
    await updateWebhookStatus(providerEventId, 'failed', `No invoice for Mayar ID: ${mayarInvoiceId}`);
    return;
  }

  // Process payment atomically
  const { error: rpcErr } = await supaAdmin.rpc('process_payment_webhook', {
    p_mayar_invoice_id: mayarInvoiceId,
    p_external_id: invoice.external_id,
    p_status: 'paid',
    p_payment_id: data.transactionId || mayarInvoiceId,
    p_payment_method: paymentMethod,
    p_amount: amount,
    p_raw_webhook: payload
  });

  if (rpcErr) {
    await updateWebhookStatus(providerEventId, 'failed', rpcErr.message);
    return;
  }

  // Send receipt email
  const { data: profile } = await supaAdmin.from('profiles').select('email').eq('id', invoice.user_id).single();
  const { data: plan } = await supaAdmin.from('plans').select('name').eq('id', invoice.plan_id).single();
  if (profile?.email) {
    sendPaymentReceipt(profile.email, {
      invoiceNumber: invoice.invoice_number,
      planName: plan?.name || 'Pro',
      amount,
      paidAt: new Date().toISOString()
    }).catch(err => console.warn('Receipt email failed:', err.message));
  }

  await updateWebhookStatus(providerEventId, 'processed');
}

async function handleMemberExpired(payload, providerEventId) {
  const email = payload.data?.customerEmail;
  if (!email) {
    await updateWebhookStatus(providerEventId, 'failed', 'No customer email');
    return;
  }

  const { data: profile } = await supaAdmin.from('profiles').select('id').eq('email', email).single();
  if (!profile) {
    await updateWebhookStatus(providerEventId, 'ignored', 'User not found');
    return;
  }

  await supaAdmin.from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('user_id', profile.id).in('status', ['active', 'past_due']);

  await supaAdmin.from('audit_log').insert({ user_id: profile.id, action: 'MEMBERSHIP_EXPIRED', detail: payload });
  await updateWebhookStatus(providerEventId, 'processed');
}

async function handleMemberUnsubscribed(payload, providerEventId) {
  const email = payload.data?.customerEmail;
  if (!email) {
    await updateWebhookStatus(providerEventId, 'failed', 'No customer email');
    return;
  }

  const { data: profile } = await supaAdmin.from('profiles').select('id').eq('email', email).single();
  if (!profile) {
    await updateWebhookStatus(providerEventId, 'ignored', 'User not found');
    return;
  }

  await supaAdmin.from('subscriptions')
    .update({
      status: 'cancelled', cancelled_at: new Date().toISOString(),
      cancel_reason: 'User unsubscribed via Mayar', updated_at: new Date().toISOString()
    })
    .eq('user_id', profile.id).eq('status', 'active');

  await supaAdmin.from('audit_log').insert({ user_id: profile.id, action: 'MEMBERSHIP_CANCELLED', detail: payload });
  await updateWebhookStatus(providerEventId, 'processed');
}

async function updateWebhookStatus(providerEventId, status, errorMessage = null) {
  await supaAdmin.from('webhook_log')
    .update({ status, error_message: errorMessage, processed_at: new Date().toISOString() })
    .eq('provider_event_id', providerEventId);
}

module.exports = router;
