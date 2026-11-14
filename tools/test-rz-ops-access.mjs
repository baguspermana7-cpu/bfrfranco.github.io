#!/usr/bin/env node
/**
 * test-rz-ops-access.mjs — rz-ops admin console: access gate + escaping + phone layout.
 *
 * Access laws (each FAILED on the v3.57.0 page and PASSES after the v3.57.1 hardening):
 *   A1  a forged localStorage session (rz_premium_session role=root) with NO Supabase user → login shown,
 *       sidebar + console hidden
 *   A2  a signed-in Supabase user whose own profile tier is not root → login shown
 *   A3  a signed-in root profile → console shown
 *   X1  Mayar fields typed by payers render as text: an <img onerror> payload creates no element and runs nothing
 *   M1  at 390 px no section of the console scrolls the page sideways (scrollWidth <= 390 on every tab)
 *   E1  no uncaught page errors in any scenario (E1d: every tab opened on the root console)
 *
 * Function laws (each FAILED on 9b2647b30 / v3.57.2 and PASSES after the "make it real or make it honest" pass):
 *   D1  dashboard total users, tier counts (donut), 6-month growth series and the Users table equal the stubbed
 *       `profiles` rows exactly; the audit timeline shows exactly the stubbed `audit_log` rows
 *   D2  two loads of the console give identical dashboard + users text (nothing is drawn from Math.random)
 *   D3  no invented revenue / MRR / uptime / session / calculation numbers on Dashboard or Revenue; those metrics
 *       say "No data source"; the month-over-month line is computed (no "+-" text)
 *   D4  a Supabase error on the profiles read is shown on the dashboard and Users tab, not hidden
 *   R1  the Credentials tab, its nav item, the in-memory Create-account form and the '[redacted]' rows are gone
 *   S1  Subscribers and User Activity say where their data comes from (newsletter_subscribers / this browser only),
 *       and opening User Activity writes no generated events into localStorage
 *   X2  a profile display_name carrying markup renders as text in the Users table
 *   C1  js/rz-cookie-consent.js is not loaded on the console; the clock does not run before login
 *   V1  anti-vibecode: no translateY hover lift on .btn/.login-submit/.ua-cat-card, no backdrop blur on
 *       .modal-overlay, no gradient or glow on .btn-purple
 *
 * js/rz-supabase.js is replaced in-browser by a stub (request interception) so the gate can be driven
 * without real credentials; the stub returns a fixed list of profiles / audit rows built once per run.
 * Usage: node tools/test-rz-ops-access.mjs [--file rz-ops-p7x3k9m.html]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require('puppeteer'); }
catch { puppeteer = require(path.join(process.env.HOME, 'rz-work/node_modules/puppeteer')); }

const ROOT = process.cwd();
const FILE = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : 'rz-ops-p7x3k9m.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || FILE;
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(abs)] || 'application/octet-stream' });
  fs.createReadStream(abs).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));   // free port: never a shared gate port
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ── Fixed fixtures (built once per run, so two loads see identical data). Dates are UTC month buckets. ──
const NOW = new Date();
const monthStart = k => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - k, 2, 10, 0, 0)).toISOString();
const XSS = '<img src=x onerror="window.__pwned2=1">';
const PROFILES = [
  { id: 'u2', email: 'bagus@resistancezero.com', tier: 'root', display_name: 'Bagus', created_at: monthStart(17) },
  { id: 'p1', email: 'alpha@example.com', tier: 'pro', display_name: 'Alpha', created_at: monthStart(0) },
  { id: 'p2', email: 'bravo@example.com', tier: 'free', display_name: null, created_at: monthStart(0) },
  { id: 'p3', email: 'charlie@example.com', tier: 'free', display_name: 'Charlie', created_at: monthStart(1) },
  { id: 'p4', email: 'delta@example.com', tier: 'demo', display_name: 'Delta', created_at: monthStart(2) },
  { id: 'p5', email: 'echo@example.com', tier: 'pro', display_name: 'Echo', created_at: monthStart(3) },
  { id: 'p6', email: 'xss@example.com', tier: 'free', display_name: XSS, created_at: monthStart(0) },
];
const ago = d => new Date(NOW.getTime() - d * 864e5).toISOString();
const AUDIT = [
  { id: 1, actor_id: 'p1', action: 'pdf_exported', target_type: 'calc', target_id: null, meta: { calc: 'capex' }, created_at: ago(1) },
  { id: 2, actor_id: 'p6', action: 'scenario_saved', target_type: 'scenario', target_id: 's1', meta: { calc: 'opex' }, created_at: ago(2) },
  { id: 3, actor_id: 'u2', action: 'pdf_exported', target_type: 'calc', target_id: null, meta: { calc: 'pue' }, created_at: ago(3) },
  { id: 4, actor_id: 'p3', action: 'scenario_opened', target_type: 'scenario', target_id: 's2', meta: {}, created_at: ago(45) },
];
// Expected dashboard numbers, derived here independently of the page.
const TIERS = PROFILES.reduce((m, p) => (m[p.tier] = (m[p.tier] || 0) + 1, m), {});
const MONTHS = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 5 + i, 1)); return d.toISOString().slice(0, 7); });
const NEW_PER_MONTH = MONTHS.map(m => PROFILES.filter(p => p.created_at.slice(0, 7) === m).length);
const TOTAL_PER_MONTH = MONTHS.map(m => PROFILES.filter(p => p.created_at.slice(0, 7) <= m).length);

function stub(user, tier, opts = {}) {
  return `const u=${JSON.stringify(user)};const P=${JSON.stringify(PROFILES)};const A=${JSON.stringify(AUDIT)};
    const perr=${JSON.stringify(opts.profilesError || null)};
    const api={configured:true,
    getUser:async()=>u,getSession:async()=>u?{user:u}:null,
    getProfile:async()=>({data:u?{id:u.id,email:u.email,tier:${JSON.stringify(tier)}}:null,error:null}),
    signIn:async()=>({error:'stub'}),signOut:async()=>({}),
    listProfiles:async()=>({data:[]}),
    listAllProfiles:async()=>perr?{data:[],error:perr}:{data:P.map(r=>Object.assign({},r)),error:null},
    listAuditLog:async()=>({data:A.map(r=>Object.assign({},r)),error:null}),
    listSubscribers:async()=>({data:[],error:null}),
    getFeatureOverrides:async()=>({data:[],error:null}),
    listEducators:async()=>({data:[],error:null})};
    api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
const law = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };

const ROOT_USER = { id: 'u2', email: 'bagus@resistancezero.com' };
let cookieScriptRequested = false;

// RZ_OPS_SHOTS=<dir> also writes dashboard + users screenshots (1440 and 390 px) of the stubbed console.
const SHOTS = process.env.RZ_OPS_SHOTS || '';
async function shots(page, tag) {
  if (!SHOTS) return;
  for (const sec of ['dashboard', 'users']) {
    await page.evaluate(id => { showSection(id); window.scrollTo(0, 0); }, sec);
    // A fullPage capture resizes mid-shot and Chart.js redraws into the wrong box; grow the viewport and wait instead.
    const vp = page.viewport();
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: vp.width, height: Math.min(h, 4000) });
    await new Promise(res => setTimeout(res, 800));
    await page.screenshot({ path: path.join(SHOTS, `w2a-${sec}-${tag}.png`) });
    await page.setViewport(vp);
  }
  await page.evaluate(() => showSection('dashboard'));
}

async function open({ user = null, tier = 'free', forged = false, width = 1440, opts = {} }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (u.includes('/js/rz-supabase.js')) return r.respond({ status: 200, contentType: 'text/javascript', body: stub(user, tier, opts) });
    if (u.includes('/js/rz-cookie-consent.js')) cookieScriptRequested = true;
    if (!u.startsWith(BASE) && !/jsdelivr|cdnjs|googleapis|gstatic/.test(u)) return r.respond({ status: 204, body: '' });
    r.continue();
  });
  if (forged) {
    await page.evaluateOnNewDocument(() => localStorage.setItem('rz_premium_session', JSON.stringify(
      { email: 'bagus@resistancezero.com', tier: 'pro', role: 'root', expires: new Date(Date.now() + 864e5).toISOString() })));
  }
  await page.goto(BASE + FILE, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const vis = await page.evaluate(() => {
    const shown = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    return { login: shown('loginPage'), main: shown('main-content'), sidebar: shown('sidebar'), sw: document.documentElement.scrollWidth,
      clock: (document.getElementById('topbarTime') || {}).textContent || '' };
  });
  return { page, vis, errors };
}

try {
  let r = await open({ forged: true });
  law('A1', r.vis.login && !r.vis.main && !r.vis.sidebar, `forged session, no Supabase user → ${JSON.stringify(r.vis)}`);
  law('C1b', r.vis.clock === '', `clock before login: ${JSON.stringify(r.vis.clock)} (must stay empty until a root login)`);
  law('E1a', r.errors.length === 0, `page errors: ${JSON.stringify(r.errors)}`); await r.page.close();

  r = await open({ user: { id: 'u1', email: 'someone@example.com' }, tier: 'pro', forged: true });
  law('A2', r.vis.login && !r.vis.main, `signed-in tier=pro (+forged root session) → ${JSON.stringify(r.vis)}`);
  law('E1b', r.errors.length === 0, `page errors: ${JSON.stringify(r.errors)}`); await r.page.close();

  r = await open({ user: ROOT_USER, tier: 'root' });
  law('A3', !r.vis.login && r.vis.main && r.vis.sidebar, `signed-in tier=root → ${JSON.stringify(r.vis)}`);
  law('E1c', r.errors.length === 0, `page errors: ${JSON.stringify(r.errors)}`);
  const xss = await r.page.evaluate(() => {
    window.__pwned = 0;
    const p = '<img src=x onerror="window.__pwned=1">';
    const body = document.getElementById('mayarRecentBody') || document.querySelector('[id^="mayar"][id$="Body"]');
    renderMayarTxRows([{ createdAt: '2026-11-01', customerName: p, customerEmail: p, description: p, amount: 1, status: p }], body.id);
    renderMayarCustomerDetail({ name: p, email: p, id: p });
    showMayarToast(p, 'info');
    return new Promise(res => setTimeout(() => res({
      pwned: window.__pwned,
      imgs: document.querySelectorAll(`#${body.id} img, #mayarCustDetail img, .mayar-toast img`).length,
    }), 300));
  });
  law('X1', xss.pwned === 0 && xss.imgs === 0, `payload in Mayar rows/detail/toast → ${JSON.stringify(xss)}`);

  // ── Function laws ──
  const snap = () => r.page.evaluate(() => {
    const txt = id => (document.getElementById(id) || {}).innerText || '';
    const C = window.Chart && Chart.getChart ? Chart.getChart : () => null;
    const g = C('chartGrowth'), t = C('chartTier');
    const tier = {};
    if (t) t.data.labels.forEach((l, i) => { tier[String(l).toLowerCase()] = t.data.datasets[0].data[i]; });
    const totalKpi = [...document.querySelectorAll('#kpiGrid .kpi')].find(k => /total users/i.test(k.innerText));
    const sideKpi = [...document.querySelectorAll('#kpiGrid .kpi')].find(k => /sign-ups this month/i.test(k.innerText));
    return {
      dash: txt('sec-dashboard'), users: txt('sec-users'), revenue: txt('sec-revenue'),
      totalUsers: totalKpi ? (totalKpi.querySelector('.kpi-val') || {}).textContent : null,
      signupsThisMonth: sideKpi ? (sideKpi.querySelector('.kpi-val') || {}).textContent : null,
      growthTotal: g ? g.data.datasets[0].data.slice() : null,
      growthNew: g && g.data.datasets[1] ? g.data.datasets[1].data.slice() : null,
      growthLabels: g ? g.data.labels.slice() : null,
      tier,
      pgInfo: txt('pgInfo'), nav: txt('navUserCount'),
    };
  });
  const s1 = await snap();
  // Users table: walk every page and collect emails.
  const tableEmails = await r.page.evaluate(async () => {
    showSection('users');
    const out = [];
    const pages = Math.max(1, document.querySelectorAll('#pgBtns .pg-btn').length);
    for (let p = 1; p <= pages; p++) {
      if (typeof goPage === 'function') goPage(p);
      document.querySelectorAll('#userTbody tr').forEach(tr => { const m = tr.innerText.match(/[\w.+-]+@[\w.-]+/); if (m) out.push(m[0]); });
    }
    showSection('dashboard');
    return out.sort();
  });
  const wantEmails = PROFILES.map(p => p.email).sort();
  const tierOk = Object.keys(TIERS).every(k => s1.tier[k] === TIERS[k]) && Object.keys(s1.tier).every(k => (s1.tier[k] || 0) === (TIERS[k] || 0));
  const d1 = String(s1.totalUsers).trim() === String(PROFILES.length) && tierOk
    && JSON.stringify(s1.growthTotal) === JSON.stringify(TOTAL_PER_MONTH)
    && JSON.stringify(s1.growthNew) === JSON.stringify(NEW_PER_MONTH)
    && JSON.stringify(tableEmails) === JSON.stringify(wantEmails)
    && String(s1.nav).trim() === String(PROFILES.length)
    && String(s1.signupsThisMonth).trim() === String(NEW_PER_MONTH[5]);
  law('D1', d1, `total=${s1.totalUsers} (want ${PROFILES.length}), tiers=${JSON.stringify(s1.tier)} (want ${JSON.stringify(TIERS)}), growth total=${JSON.stringify(s1.growthTotal)} (want ${JSON.stringify(TOTAL_PER_MONTH)}), new=${JSON.stringify(s1.growthNew)} (want ${JSON.stringify(NEW_PER_MONTH)}), sign-ups this month=${s1.signupsThisMonth} (want ${NEW_PER_MONTH[5]}), table emails=${tableEmails.length} (want ${wantEmails.length}${JSON.stringify(tableEmails) === JSON.stringify(wantEmails) ? ', same set' : ', DIFFERENT set'}), nav=${s1.nav}`);
  const audit = await r.page.evaluate(() => { showSection('audit'); return document.querySelectorAll('#auditTimeline .tl-item').length; });
  law('D1b', audit === AUDIT.length, `audit timeline items=${audit} (want ${AUDIT.length} stubbed audit_log rows)`);
  const fake = /\$\s?\d|99\.97|MRR\s*\$|\b2\.1%|\+-|1,?200\b/;
  const d3dash = s1.dash.match(fake), d3rev = s1.revenue.match(fake);
  law('D3', !d3dash && !d3rev && /no data source/i.test(s1.dash) && /no data source/i.test(s1.revenue),
    `invented numbers: dashboard=${JSON.stringify(d3dash && d3dash[0])} revenue=${JSON.stringify(d3rev && d3rev[0])}; "No data source" on dashboard=${/no data source/i.test(s1.dash)} revenue=${/no data source/i.test(s1.revenue)}`);
  const x2 = await r.page.evaluate(() => { showSection('users'); return { imgs: document.querySelectorAll('#userTbody img').length, pwned: window.__pwned2 || 0 }; });
  law('X2', x2.imgs === 0 && x2.pwned === 0, `display_name markup in Users table → ${JSON.stringify(x2)}`);
  const r1 = await r.page.evaluate(() => ({
    credSection: !!document.getElementById('sec-credentials'),
    credNav: !!document.querySelector('[data-section="credentials"]'),
    createModal: !!document.getElementById('createModal'),
    createFn: typeof window.submitCreateAccount === 'function',
    redacted: document.documentElement.outerHTML.includes('[redacted]'),
    publicPwWarn: /public pw/i.test(document.body.innerText) || typeof window.SUPA_PUBLIC_PW !== 'undefined',
  }));
  law('R1', !Object.values(r1).some(Boolean), `leftovers: ${JSON.stringify(r1)}`);
  const s1b = await r.page.evaluate(async () => {
    try { localStorage.removeItem('rz_user_events'); } catch (e) {}
    showSection('subscribers'); await new Promise(res => setTimeout(res, 300));
    const sub = document.getElementById('sec-subscribers').innerText;
    showSection('activity'); await new Promise(res => setTimeout(res, 300));
    const act = document.getElementById('sec-activity').innerText;
    let stored = 0; try { stored = JSON.parse(localStorage.getItem('rz_user_events') || '[]').length; } catch (e) {}
    return { subNamesTable: /newsletter_subscribers/.test(sub), actBrowserOnly: /this browser only/i.test(act), stored };
  });
  law('S1', s1b.subNamesTable && s1b.actBrowserOnly && s1b.stored === 0, `subscribers names its table=${s1b.subNamesTable}, activity says "This browser only"=${s1b.actBrowserOnly}, events written by opening the tab=${s1b.stored}`);
  const tabErrs = await r.page.evaluate(async () => {
    for (const sec of document.querySelectorAll('.section')) { showSection(sec.id.replace(/^sec-/, '')); await new Promise(res => setTimeout(res, 150)); }
    showSection('dashboard'); return true;
  }).then(() => r.errors.slice());
  law('E1d', tabErrs.length === 0, `page errors after opening every tab: ${JSON.stringify(tabErrs)}`);
  const v1 = await r.page.evaluate(() => {
    const bad = [];
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch (e) { continue; }
      for (const ru of rules) {
        const sel = ru.selectorText || '', css = ru.style ? ru.style.cssText : '';
        if (/(\.btn|\.login-submit|\.ua-cat-card)\S*:hover/.test(sel) && /translateY/.test(css)) bad.push(sel + ' lift');
        if (/^\.modal-overlay$/.test(sel.trim()) && /backdrop-filter:\s*blur/.test(css)) bad.push(sel + ' blur');
        if (/^\.btn-purple$/.test(sel.trim()) && (/gradient/.test(css) || /box-shadow/.test(css))) bad.push(sel + ' gradient/glow');
      }
    }
    return bad;
  });
  law('V1', v1.length === 0, `anti-vibecode leftovers: ${JSON.stringify(v1)}`);
  law('C1', !cookieScriptRequested && !(await r.page.$('script[src*="rz-cookie-consent"]')), `cookie consent requested=${cookieScriptRequested}`);
  await r.page.close();

  r = await open({ user: ROOT_USER, tier: 'root' });
  const s2 = await snap();
  await shots(r.page, '1440');
  law('D2', s1.dash === s2.dash && s1.users === s2.users && s1.dash.length > 0,
    `two loads: dashboard text identical=${s1.dash === s2.dash} (${s1.dash.length} chars), users text identical=${s1.users === s2.users}`);
  await r.page.close();

  r = await open({ user: ROOT_USER, tier: 'root', opts: { profilesError: 'stub: relation profiles timed out' } });
  const d4 = await r.page.evaluate(() => ({
    dash: /supabase/i.test(document.getElementById('sec-dashboard').innerText) && /timed out/.test(document.getElementById('sec-dashboard').innerText),
    users: /timed out/.test(document.getElementById('sec-users').innerText),
  }));
  law('D4', d4.dash && d4.users, `profiles read fails → error shown on dashboard=${d4.dash}, users=${d4.users}`);
  law('E1e', r.errors.length === 0, `page errors: ${JSON.stringify(r.errors)}`);
  await r.page.close();
  r = await open({ user: ROOT_USER, tier: 'root', width: 390 });
  await shots(r.page, '390');
  const widths = await r.page.evaluate(async () => {
    const out = {};
    for (const sec of document.querySelectorAll('.section')) {
      showSection(sec.id.replace(/^sec-/, ''));
      await new Promise(res => setTimeout(res, 120));
      out[sec.id] = document.documentElement.scrollWidth;
    }
    return out;
  });
  const wide = Object.entries(widths).filter(([, w]) => w > 390);
  law('M1', wide.length === 0, `390 px, ${Object.keys(widths).length} sections, wider than viewport: ${JSON.stringify(Object.fromEntries(wide))}`);
  await r.page.close();
} finally {
  await browser.close();
  server.close();
}
console.log(failures.length ? `RESULT: ${failures.length} law(s) failed: ${failures.join(', ')}` : 'RESULT: all laws pass');
process.exit(failures.length ? 1 : 0);
