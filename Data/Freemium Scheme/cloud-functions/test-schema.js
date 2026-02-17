/**
 * Comprehensive Supabase Schema Test Suite
 * Tests all 14 tables, 4 functions, triggers, RLS, constraints, cascades
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const WARN = '\x1b[33mWARN\x1b[0m';
let passed = 0, failed = 0, warned = 0;

function ok(name, condition, detail) {
  if (condition) {
    console.log('  ' + PASS + ' ' + name + (detail ? ' -- ' + detail : ''));
    passed++;
  } else {
    console.log('  ' + FAIL + ' ' + name + (detail ? ' -- ' + detail : ''));
    failed++;
  }
  return condition;
}

async function run() {
  const TEST_UID = 'test_user_' + Date.now();
  const TEST_EMAIL = 'test_' + Date.now() + '@test.com';

  // ══════════════════════════════════════════
  console.log('\n=== 1. TABLE EXISTENCE (14 tables) ===');
  const tables = [
    'profiles', 'plans', 'subscriptions', 'invoices', 'payments',
    'entitlements', 'projects', 'exports', 'webhook_log',
    'usage_events', 'audit_log', 'reminder_log', 'fcm_tokens'
  ];
  for (const t of tables) {
    const { error } = await db.from(t).select('*').limit(0);
    ok(t, !error, error ? error.message : 'accessible');
  }

  // ══════════════════════════════════════════
  console.log('\n=== 2. SEED DATA (plans) ===');
  const { data: plans } = await db.from('plans').select('*').order('sort_order');
  ok('plans has 5 rows', plans && plans.length === 5, plans?.length + ' rows');
  ok('free plan exists', plans?.some(p => p.id === 'free' && p.tier === 'free'));
  ok('pro_monthly exists', plans?.some(p => p.id === 'pro_monthly' && p.price_idr === 199000));
  ok('pro_annual exists', plans?.some(p => p.id === 'pro_annual' && p.price_idr === 1990000));
  ok('report_single exists', plans?.some(p => p.id === 'report_single' && p.price_idr === 99000));
  ok('report_comparison exists', plans?.some(p => p.id === 'report_comparison' && p.price_idr === 149000));

  const freePlan = plans?.find(p => p.id === 'free');
  ok('free features: can_export_pdf=false', freePlan?.features?.can_export_pdf === false);
  ok('free features: watermark=true', freePlan?.features?.watermark === true);
  const proPlan = plans?.find(p => p.id === 'pro_monthly');
  ok('pro features: can_export_pdf=true', proPlan?.features?.can_export_pdf === true);
  ok('pro features: watermark=false', proPlan?.features?.watermark === false);

  // ══════════════════════════════════════════
  console.log('\n=== 3. PROFILE CRUD + UPSERT ===');
  const { data: prof, error: profErr } = await db.from('profiles').upsert({
    id: TEST_UID, email: TEST_EMAIL, full_name: 'Test User',
    firebase_provider: 'password', last_login_at: new Date().toISOString()
  }, { onConflict: 'id' }).select().single();
  ok('profile insert', !profErr && prof?.id === TEST_UID, profErr?.message || prof?.email);

  const { data: profUpd, error: updErr } = await db.from('profiles')
    .update({ company: 'TestCorp', country: 'SG' }).eq('id', TEST_UID).select().single();
  ok('profile update', !updErr && profUpd?.company === 'TestCorp');

  // Upsert same profile (should update, not duplicate)
  const { data: profUps2, error: ups2Err } = await db.from('profiles').upsert({
    id: TEST_UID, email: TEST_EMAIL, full_name: 'Updated Name',
    last_login_at: new Date().toISOString()
  }, { onConflict: 'id' }).select().single();
  ok('profile upsert (no dup)', !ups2Err && profUps2?.full_name === 'Updated Name');

  // ══════════════════════════════════════════
  console.log('\n=== 4. UPDATED_AT TRIGGER ===');
  const created = new Date(prof.updated_at).getTime();
  await new Promise(r => setTimeout(r, 1100));
  const { data: profTrig } = await db.from('profiles')
    .update({ full_name: 'Trigger Test' }).eq('id', TEST_UID).select().single();
  const updated = new Date(profTrig.updated_at).getTime();
  ok('updated_at auto-updates on profiles', updated > created, 'diff: ' + (updated - created) + 'ms');

  // ══════════════════════════════════════════
  console.log('\n=== 5. ENTITLEMENTS (free tier default) ===');
  const { data: ent, error: entErr } = await db.from('entitlements')
    .upsert({ user_id: TEST_UID, tier: 'free' }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select().single();
  ok('entitlement insert (free)', !entErr && ent?.tier === 'free', entErr?.message);
  ok('free: can_export_pdf=false', ent?.can_export_pdf === false);
  ok('free: watermark=true', ent?.watermark === true);
  ok('free: max_projects=0', ent?.max_projects === 0);
  ok('free: max_exports_per_day=0', ent?.max_exports_per_day === 0);

  // ══════════════════════════════════════════
  console.log('\n=== 6. SUBSCRIPTION + SYNC_ENTITLEMENTS TRIGGER ===');

  // 6a. Create active pro_monthly subscription
  const { data: sub, error: subErr } = await db.from('subscriptions').insert({
    user_id: TEST_UID, plan_id: 'pro_monthly', status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }).select().single();
  ok('subscription insert', !subErr && sub?.status === 'active', subErr?.message);

  // Check entitlements synced to pro
  await new Promise(r => setTimeout(r, 500));
  const { data: entPro } = await db.from('entitlements').select('*').eq('user_id', TEST_UID).single();
  ok('sync -> tier=pro', entPro?.tier === 'pro', 'got: ' + entPro?.tier);
  ok('sync -> can_export_pdf=true', entPro?.can_export_pdf === true);
  ok('sync -> can_save_projects=true', entPro?.can_save_projects === true);
  ok('sync -> can_advanced_mode=true', entPro?.can_advanced_mode === true);
  ok('sync -> can_compare=true', entPro?.can_compare === true);
  ok('sync -> can_full_breakdown=true', entPro?.can_full_breakdown === true);
  ok('sync -> watermark=false', entPro?.watermark === false);
  ok('sync -> max_it_load_kw=100000', entPro?.max_it_load_kw === 100000);
  ok('sync -> max_projects=5', entPro?.max_projects === 5);
  ok('sync -> max_exports_per_day=10', entPro?.max_exports_per_day === 10);

  // 6b. Test past_due
  await db.from('subscriptions').update({ status: 'past_due' }).eq('id', sub.id);
  await new Promise(r => setTimeout(r, 500));
  const { data: entPD } = await db.from('entitlements').select('*').eq('user_id', TEST_UID).single();
  ok('past_due: can_export_pdf=false', entPD?.can_export_pdf === false);
  ok('past_due: watermark=true', entPD?.watermark === true);
  ok('past_due: tier still pro', entPD?.tier === 'pro');

  // 6c. Test expired (period_end in past)
  await db.from('subscriptions').update({
    status: 'expired',
    current_period_end: new Date(Date.now() - 86400000).toISOString()
  }).eq('id', sub.id);
  await new Promise(r => setTimeout(r, 500));
  const { data: entExp } = await db.from('entitlements').select('*').eq('user_id', TEST_UID).single();
  ok('expired: tier=free', entExp?.tier === 'free', 'got: ' + entExp?.tier);
  ok('expired: can_advanced_mode=false', entExp?.can_advanced_mode === false);
  ok('expired: max_projects=0', entExp?.max_projects === 0);
  ok('expired: watermark=true', entExp?.watermark === true);

  // ══════════════════════════════════════════
  console.log('\n=== 7. GENERATE_INVOICE_NUMBER FUNCTION ===');
  const { data: invNum1 } = await db.rpc('generate_invoice_number');
  ok('generates INV-YYYY-NNNNNN format', invNum1 && invNum1.startsWith('INV-2026-'), 'got: ' + invNum1);

  const { data: invNum2 } = await db.rpc('generate_invoice_number');
  ok('sequential increment', invNum1 !== invNum2, invNum1 + ' -> ' + invNum2);

  // ══════════════════════════════════════════
  console.log('\n=== 8. INVOICE INSERT ===');
  // Re-activate subscription for payment test
  await db.from('subscriptions').update({
    status: 'active',
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }).eq('id', sub.id);

  const mayarInvId = 'test_mayar_' + Date.now();
  const extId = 'RZ-test-' + Date.now();
  const { data: inv, error: invErr } = await db.from('invoices').insert({
    user_id: TEST_UID, subscription_id: sub.id, plan_id: 'pro_monthly',
    invoice_number: invNum1, amount_idr: 199000, tax_idr: 21890, total_idr: 220890,
    status: 'sent', kind: 'new', due_date: new Date(Date.now() + 86400000).toISOString(),
    mayar_invoice_id: mayarInvId, external_id: extId
  }).select().single();
  ok('invoice insert', !invErr && inv?.invoice_number === invNum1, invErr?.message);

  // ══════════════════════════════════════════
  console.log('\n=== 9. PROCESS_PAYMENT_WEBHOOK FUNCTION ===');
  const payId = 'pay_test_' + Date.now();
  const { data: whResult, error: rpcErr } = await db.rpc('process_payment_webhook', {
    p_mayar_invoice_id: mayarInvId,
    p_external_id: extId,
    p_status: 'paid',
    p_payment_id: payId,
    p_payment_method: 'qris',
    p_amount: 220890,
    p_raw_webhook: { test: true }
  });
  ok('process_payment_webhook runs', !rpcErr, rpcErr?.message);
  ok('result ok=true', whResult?.ok === true, JSON.stringify(whResult));
  ok('result action=activated', whResult?.action === 'activated');

  // Verify side effects
  const { data: invPaid } = await db.from('invoices').select('status').eq('id', inv.id).single();
  ok('invoice -> paid', invPaid?.status === 'paid');

  const { data: payRec } = await db.from('payments').select('*').eq('invoice_id', inv.id).single();
  ok('payment record created', payRec?.status === 'paid' && payRec?.payment_method === 'qris');
  ok('payment amount correct', payRec?.amount_idr === 220890);

  const { data: auditPay } = await db.from('audit_log').select('*')
    .eq('user_id', TEST_UID).eq('action', 'PAYMENT_SUCCESS').limit(1).single();
  ok('audit_log: PAYMENT_SUCCESS', !!auditPay);

  // Idempotency test
  const { data: dup } = await db.rpc('process_payment_webhook', {
    p_mayar_invoice_id: mayarInvId, p_external_id: extId,
    p_status: 'paid', p_payment_id: 'pay_dup', p_payment_method: 'qris',
    p_amount: 220890, p_raw_webhook: { dup: true }
  });
  ok('idempotent: Already processed', dup?.message === 'Already processed', JSON.stringify(dup));

  // Amount mismatch test
  const mayarInvId2 = 'test_mayar2_' + Date.now();
  const extId2 = 'RZ-test2-' + Date.now();
  await db.from('invoices').insert({
    user_id: TEST_UID, plan_id: 'pro_monthly', invoice_number: invNum2,
    amount_idr: 199000, tax_idr: 21890, total_idr: 220890,
    status: 'sent', kind: 'new', mayar_invoice_id: mayarInvId2, external_id: extId2
  });
  const { data: mismatch } = await db.rpc('process_payment_webhook', {
    p_mayar_invoice_id: mayarInvId2, p_external_id: extId2,
    p_status: 'paid', p_payment_id: 'pay_mm', p_payment_method: 'qris',
    p_amount: 999999, p_raw_webhook: {}
  });
  ok('amount mismatch rejected', mismatch?.ok === false && mismatch?.error === 'Amount mismatch');

  // ══════════════════════════════════════════
  console.log('\n=== 10. PROJECTS CRUD ===');
  const { data: proj, error: projErr } = await db.from('projects').insert({
    user_id: TEST_UID, calculator_type: 'capex', name: 'Test DC Config',
    config: { it_load: 5000, pue: 1.4 }, calc_version: 'v1.0'
  }).select().single();
  ok('project insert', !projErr && proj?.name === 'Test DC Config', projErr?.message);

  const { data: projUpd } = await db.from('projects')
    .update({ name: 'Updated Config' }).eq('id', proj.id).select().single();
  ok('project update', projUpd?.name === 'Updated Config');
  ok('project updated_at trigger', new Date(projUpd.updated_at) > new Date(proj.created_at));

  // ══════════════════════════════════════════
  console.log('\n=== 11. EXPORTS ===');
  const { data: exp, error: expIErr } = await db.from('exports').insert({
    user_id: TEST_UID, project_id: proj.id, calculator_type: 'capex',
    export_type: 'pdf', status: 'ready', download_count: 0, max_downloads: 3
  }).select().single();
  ok('export insert', !expIErr && exp?.export_type === 'pdf', expIErr?.message);

  // ══════════════════════════════════════════
  console.log('\n=== 12. WEBHOOK LOG (dedup) ===');
  const whEvtId = 'wh_test_' + Date.now();
  const { error: whErr1 } = await db.from('webhook_log').insert({
    provider: 'mayar', provider_event_id: whEvtId, event_type: 'payment.received',
    status: 'received', raw_payload: { test: 1 }
  });
  ok('webhook_log insert', !whErr1);

  const { error: whErr2 } = await db.from('webhook_log').insert({
    provider: 'mayar', provider_event_id: whEvtId, event_type: 'payment.received',
    status: 'received', raw_payload: { test: 2 }
  });
  ok('webhook_log dedup constraint', whErr2?.code === '23505', whErr2?.code);

  // ══════════════════════════════════════════
  console.log('\n=== 13. USAGE EVENTS ===');
  const { error: usageErr } = await db.from('usage_events').insert({
    user_id: TEST_UID, event_type: 'calc_run', calculator: 'capex',
    metadata: { it_load: 5000 }, ip_address: '127.0.0.1'
  });
  ok('usage_event insert', !usageErr, usageErr?.message);

  // ══════════════════════════════════════════
  console.log('\n=== 14. AUDIT LOG ===');
  const { error: auditErr } = await db.from('audit_log').insert({
    user_id: TEST_UID, action: 'TEST_ACTION', detail: { note: 'comprehensive test' }
  });
  ok('audit_log insert', !auditErr, auditErr?.message);

  // ══════════════════════════════════════════
  console.log('\n=== 15. REMINDER LOG ===');
  const { error: remErr } = await db.from('reminder_log').insert({
    user_id: TEST_UID, subscription_id: sub.id, channel: 'email',
    reminder_type: 'renewal_7d', delivered: true
  });
  ok('reminder_log insert', !remErr, remErr?.message);

  // ══════════════════════════════════════════
  console.log('\n=== 16. FCM TOKENS ===');
  const fcmTok = 'fcm_test_' + Date.now();
  const { error: fcmErr } = await db.from('fcm_tokens').insert({
    user_id: TEST_UID, token: fcmTok,
    device_info: { os: 'Android', model: 'Pixel 8' }
  });
  ok('fcm_token insert', !fcmErr, fcmErr?.message);

  const { error: fcmDup } = await db.from('fcm_tokens').insert({
    user_id: TEST_UID, token: fcmTok
  });
  ok('fcm_token unique(user_id,token)', fcmDup?.code === '23505');

  // ══════════════════════════════════════════
  console.log('\n=== 17. RECONCILE_ENTITLEMENTS FUNCTION ===');
  const { data: reconResult, error: reconErr } = await db.rpc('reconcile_entitlements');
  ok('reconcile_entitlements runs', !reconErr, reconErr?.message);
  ok('reconcile returns array', Array.isArray(reconResult));

  // ══════════════════════════════════════════
  console.log('\n=== 18. RLS -- ANON KEY BLOCKED ===');
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpenJpa2ZqZnl4dHh5a3VpcHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjU3MzEsImV4cCI6MjA4NjkwMTczMX0.otukd5M1_FfxBVlklleMW7Gt_D_MPGWzcmwIFsVX9mY';
  const anonDb = createClient(process.env.SUPABASE_URL, anonKey);

  const { data: anonPlans } = await anonDb.from('plans').select('id').limit(1);
  ok('anon CAN read plans (public)', anonPlans?.length > 0);

  const { data: anonProf } = await anonDb.from('profiles').select('*').limit(1);
  ok('anon BLOCKED from profiles', anonProf?.length === 0);

  const { data: anonSubs } = await anonDb.from('subscriptions').select('*').limit(1);
  ok('anon BLOCKED from subscriptions', anonSubs?.length === 0);

  const { data: anonPay } = await anonDb.from('payments').select('*').limit(1);
  ok('anon BLOCKED from payments', anonPay?.length === 0);

  const { data: anonEnt } = await anonDb.from('entitlements').select('*').limit(1);
  ok('anon BLOCKED from entitlements', anonEnt?.length === 0);

  const { data: anonInv } = await anonDb.from('invoices').select('*').limit(1);
  ok('anon BLOCKED from invoices', anonInv?.length === 0);

  const { data: anonProj } = await anonDb.from('projects').select('*').limit(1);
  ok('anon BLOCKED from projects', anonProj?.length === 0);

  const { error: anonWrite } = await anonDb.from('profiles').insert({ id: 'hacker', email: 'h@h.com' });
  ok('anon BLOCKED from writing profiles', !!anonWrite);

  // ══════════════════════════════════════════
  console.log('\n=== 19. CHECK CONSTRAINTS ===');

  const { error: badTier } = await db.from('plans').insert({
    id: 'bad', name: 'Bad', tier: 'invalid', billing_cycle: 'none', price_idr: 0
  });
  ok('plans: invalid tier rejected', !!badTier);

  const { error: badCycle } = await db.from('plans').insert({
    id: 'bad2', name: 'Bad', tier: 'free', billing_cycle: 'invalid', price_idr: 0
  });
  ok('plans: invalid billing_cycle rejected', !!badCycle);

  const { error: badSubSt } = await db.from('subscriptions').insert({
    user_id: TEST_UID, plan_id: 'free', status: 'invalid'
  });
  ok('subscriptions: invalid status rejected', !!badSubSt);

  const { error: badInvSt } = await db.from('invoices').insert({
    user_id: TEST_UID, plan_id: 'free', amount_idr: 0, total_idr: 0, status: 'invalid', kind: 'new'
  });
  ok('invoices: invalid status rejected', !!badInvSt);

  const { error: badInvKind } = await db.from('invoices').insert({
    user_id: TEST_UID, plan_id: 'free', amount_idr: 0, total_idr: 0, status: 'draft', kind: 'invalid'
  });
  ok('invoices: invalid kind rejected', !!badInvKind);

  const { error: badCalc } = await db.from('projects').insert({
    user_id: TEST_UID, calculator_type: 'invalid', name: 'Bad', config: {}
  });
  ok('projects: invalid calculator_type rejected', !!badCalc);

  const { error: badExpType } = await db.from('exports').insert({
    user_id: TEST_UID, calculator_type: 'capex', export_type: 'invalid', status: 'pending'
  });
  ok('exports: invalid export_type rejected', !!badExpType);

  const { error: badChannel } = await db.from('reminder_log').insert({
    user_id: TEST_UID, channel: 'invalid', reminder_type: 'test'
  });
  ok('reminder_log: invalid channel rejected', !!badChannel);

  // ══════════════════════════════════════════
  console.log('\n=== 20. CASCADE DELETE ===');
  // Financial tables (invoices, payments, exports) intentionally do NOT cascade
  // — must clean them up first to preserve audit trail in production
  const { error: noCascade } = await db.from('profiles').delete().eq('id', TEST_UID);
  ok('invoices FK blocks profile delete (by design)', !!noCascade, 'financial records protected');

  // Clean non-cascading records first
  await db.from('payments').delete().eq('user_id', TEST_UID);
  await db.from('exports').delete().eq('user_id', TEST_UID);
  await db.from('invoices').delete().eq('user_id', TEST_UID);
  await db.from('usage_events').delete().eq('user_id', TEST_UID);
  await db.from('audit_log').delete().eq('user_id', TEST_UID);
  await db.from('reminder_log').delete().eq('user_id', TEST_UID);
  await db.from('webhook_log').delete().match({ provider_event_id: whEvtId });

  // Now profile delete should succeed and cascade to subs, entitlements, projects, fcm
  const { error: delErr } = await db.from('profiles').delete().eq('id', TEST_UID);
  ok('profile delete succeeds after cleanup', !delErr, delErr?.message);

  const { data: rs } = await db.from('subscriptions').select('id').eq('user_id', TEST_UID);
  ok('cascade: subscriptions deleted', rs?.length === 0);

  const { data: re } = await db.from('entitlements').select('user_id').eq('user_id', TEST_UID);
  ok('cascade: entitlements deleted', re?.length === 0);

  const { data: rp } = await db.from('projects').select('id').eq('user_id', TEST_UID);
  ok('cascade: projects deleted', rp?.length === 0);

  const { data: rf } = await db.from('fcm_tokens').select('id').eq('user_id', TEST_UID);
  ok('cascade: fcm_tokens deleted', rf?.length === 0);

  // Verify full cleanup
  const { data: remaining } = await db.from('profiles').select('id').eq('id', TEST_UID);
  ok('cleanup: no test data remains', remaining?.length === 0);

  // ══════════════════════════════════════════
  console.log('\n========================================');
  console.log('  TOTAL : ' + (passed + failed) + ' tests');
  console.log('  ' + PASS + '  : ' + passed);
  if (failed) console.log('  ' + FAIL + '  : ' + failed);
  if (warned) console.log('  ' + WARN + '  : ' + warned);
  console.log('========================================');

  if (failed === 0) {
    console.log('\n  ALL TESTS PASSED! Database schema is fully operational.\n');
  } else {
    console.log('\n  ' + failed + ' test(s) FAILED. Review output above.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
