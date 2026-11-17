#!/usr/bin/env node
/**
 * test-tier-authority.mjs — the tier a visitor gets is the tier of the profile the Supabase server holds.
 *
 * PRD: documentation/prd/datahall-ai/PRD_PENDING_2026_11_17.md §1 (P1). Laws:
 *   T1 a signed-in account whose profile says `free` reads `free`; the calculator stays in its free mode
 *   T2 a typed record `tier: "pro"` with nobody signed in reads `free`; the calculator stays in its free mode
 *   T3 the demo account reads `demo`
 *   T4 a profile that says `pro` reads `pro` and the calculator's Pro mode is on
 * The calculator's own state (`isPremiumUser`, set by its inline reader of rz_premium_session) is read beside
 * `_rzAuth.getTier()`: the calculators do not ask auth.js, they read the record themselves.
 * Reported until P1-1 ships (exit 0 with --report); strict afterwards.
 *
 * Run: rz-lane -l 3 -t 300 -- node tools/test-tier-authority.mjs [--report]
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInSupabaseBody, signedOutSupabaseBody } from './lib/signed-in-supabase.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPORT = process.argv.includes('--report');
const PAGE = 'capex-calculator.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0])); if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const results = [];
const law = (id, ok, msg) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };

async function read(body, record) {
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', (r) => { if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body }); return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort(); });
  await pg.evaluateOnNewDocument((rec) => { try { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('rz_cookie_consent', 'declined');
    if (rec) { localStorage.setItem('rz_premium_session', JSON.stringify(rec)); localStorage.setItem('sb-gate-auth-token', '{"gate":true}'); } } } catch (e) { /* none */ } }, record);
  await pg.goto(ORIGIN + PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const out = await pg.evaluate(() => ({ tier: window._rzAuth && window._rzAuth.getTier ? window._rzAuth.getTier() : 'no _rzAuth',
    feature: (() => { try { return typeof isPremiumUser === 'undefined' ? null : !!isPremiumUser; } catch (e) { return null; } })() }));   // the page's own Pro state
  await pg.close(); return out;
}
const rec = (email, tier, role) => ({ email, tier, role, expires: '2099-01-01T00:00:00Z' });
const t1 = await read(signedInSupabaseBody({ email: 'free.user@example.com', tier: 'free' }), rec('free.user@example.com', 'free', 'pro'));
law('T1', t1.tier === 'free' && t1.feature === false, `profile tier free: getTier "${t1.tier}" (want free), calculator Pro mode ${t1.feature === null ? 'unreadable' : t1.feature ? 'ON' : 'off'} (want off)`);
const t2 = await read(signedOutSupabaseBody(), rec('typed@example.com', 'pro', 'pro'));
law('T2', t2.tier === 'free' && t2.feature === false, `typed record tier pro, nobody signed in: getTier "${t2.tier}" (want free), calculator Pro mode ${t2.feature === null ? 'unreadable' : t2.feature ? 'ON' : 'off'} (want off)`);
const t3 = await read(signedInSupabaseBody({ email: 'demo@resistancezero.com', tier: 'demo' }), rec('demo@resistancezero.com', 'demo', 'demo'));
law('T3', t3.tier === 'demo', `demo account: getTier "${t3.tier}" (want demo), calculator Pro mode ${t3.feature === null ? 'unreadable' : t3.feature ? 'on' : 'off'} (demo mode is the page's to decide)`);
const t4 = await read(signedInSupabaseBody({ email: 'pro.user@example.com', tier: 'pro' }), rec('pro.user@example.com', 'pro', 'pro'));
law('T4', t4.tier === 'pro' && t4.feature === true, `profile tier pro: getTier "${t4.tier}" (want pro), calculator Pro mode ${t4.feature === null ? 'unreadable' : t4.feature ? 'on' : 'OFF'} (want on)`);
await browser.close(); srv.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} laws pass${REPORT && failed ? ' (reported, not gating: PRD_PENDING §1 P1-1 not shipped)' : ''}`);
process.exit(failed && !REPORT ? 1 : 0);
