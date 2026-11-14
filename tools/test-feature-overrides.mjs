#!/usr/bin/env node
/**
 * test-feature-overrides.mjs — feature overrides + educator role come from Supabase, never from the
 * visitor's own localStorage (audit F2).
 *
 * Laws (V1, V2, V4, A1, A2 FAILED on dda7820b0 / v3.57.6 and PASS after; V3 and P1 are non-regression):
 *   V1  a signed-out visitor who writes rz_admin_features_by_page granting free page-access on
 *       standards-ltc-lab stays locked, and the key is deleted on load
 *   V1c a forged sessionStorage cache (rz_flag_overrides_v1) granting the same thing stays locked too
 *   V2  an override served by (stubbed) Supabase IS applied on the real gated page: a free grant unlocks
 *       standards-ltc-lab; a pro restriction locks it for a pro visitor
 *   V3  Supabase unavailable (module 503, or the table read errors) → shipped defaults (free locked, pro
 *       unlocked) with 0 page errors
 *   V4  a visitor who writes rz_admin_educators with their own email does not get the educator role
 *       (datahall-ai page-access stays false) and the key is deleted on load
 *   P1  a second page load inside the cache TTL makes no Supabase request (first paint never waits)
 *   A1  rz-ops: toggling a matrix cell calls setFeatureOverride(page, feature, tier, value) once, shows
 *       "Saved", and leaves localStorage byte-identical; a failed write reverts the box and shows the error
 *   A2  rz-ops: Promote calls addEducator(email), Demote calls removeEducator(email); a listed email
 *       carrying markup renders as text
 *   E1  0 uncaught page errors in every scenario
 *
 * js/rz-supabase.js is replaced in-browser by a stub (request interception, dispatching rz-supa-ready).
 * Usage: node tools/test-feature-overrides.mjs
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
const PAGE = 'standards-ltc-lab.html';
const OPS = 'rz-ops-p7x3k9m.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || PAGE;
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(abs)] || 'application/octet-stream' });
  fs.createReadStream(abs).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));   // free random port: never a shared gate port
const BASE = `http://127.0.0.1:${server.address().port}/`;

const XSS_EMAIL = '<img src=x onerror="window.__pwnedE=1">@x.com';

/** Stub module body. opts: user, tier, rows, readError, writeError, educators. Records calls on window.__calls. */
function stub(opts = {}) {
  return `const o=${JSON.stringify(opts)};
    window.__calls=window.__calls||{get:0,set:[],setMany:[],del:[],add:[],remove:[]};
    let edu=(o.educators||[]).map(e=>({email:e,added_at:'2026-11-01T00:00:00Z'}));
    const api={configured:true,
      getUser:async()=>o.user||null,getSession:async()=>o.user?{user:o.user}:null,
      getProfile:async()=>({data:o.user?{id:o.user.id,email:o.user.email,tier:o.tier||'free'}:null,error:null}),
      signIn:async()=>({error:'stub'}),signOut:async()=>({}),
      listAllProfiles:async()=>({data:[],error:null}),listAuditLog:async()=>({data:[],error:null}),
      listSubscribers:async()=>({data:[],error:null}),
      isEducator:async()=>({data:false,error:null}),
      getFeatureOverrides:async()=>{window.__calls.get++;return o.readError?{data:[],error:o.readError}:{data:(o.rows||[]).map(r=>Object.assign({updated_at:'2026-11-14T00:00:00Z'},r)),error:null}},
      setFeatureOverride:async(p,f,t,e)=>{window.__calls.set.push([p,f,t,e]);return o.writeError?{error:o.writeError}:{data:{page_key:p,feature_key:f,tier:t,enabled:e},error:null}},
      setFeatureOverrides:async(rows)=>{window.__calls.setMany.push(rows);return {data:rows,error:null}},
      deleteFeatureOverrides:async(p)=>{window.__calls.del.push(p);return {error:null}},
      listEducators:async()=>({data:edu.slice(),error:null}),
      addEducator:async(e)=>{window.__calls.add.push(e);edu.unshift({email:e,added_at:'2026-11-14T00:00:00Z'});return {data:{email:e},error:null}},
      removeEducator:async(e)=>{window.__calls.remove.push(e);edu=edu.filter(x=>x.email!==e);return {error:null}}};
    api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
const law = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const session = email => ({ email, tier: 'pro', expires: new Date(Date.now() + 864e5).toISOString() });

async function open(file, { stubOpts = {}, supaDown = false, local = {}, sess = {}, page: reuse = null, settle = 2600 } = {}) {
  let page = reuse;
  if (!page) {   // one isolated context per scenario: localStorage must not leak between scenarios
    const ctx = await browser.createBrowserContext();
    page = await ctx.newPage();
    const close = page.close.bind(page);
    page.close = async () => { await close(); await ctx.close(); };
  }
  const st = reuse ? reuse.__st : { errors: [], supaReqs: 0 };
  if (!reuse) {
    page.__st = st;
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', e => st.errors.push(String(e.message).slice(0, 160)));
    page.on('dialog', d => d.accept());
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      if (u.includes('/js/rz-supabase.js')) {
        st.supaReqs++;
        if (page.__down) return r.respond({ status: 503, body: '' });
        return r.respond({ status: 200, contentType: 'text/javascript', body: stub(page.__stubOpts) });
      }
      if (!u.startsWith(BASE) && !/jsdelivr|cdnjs|googleapis|gstatic/.test(u)) return r.respond({ status: 204, body: '' });
      r.continue();
    });
    await page.evaluateOnNewDocument((local, sess) => {
      if (sessionStorage.getItem('__seeded')) return;      // seed once per tab; reloads keep what the page wrote
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(sess)) sessionStorage.setItem(k, v);
    }, local, sess);
  }
  page.__stubOpts = stubOpts; page.__down = supaDown;
  await page.goto(BASE + file, { waitUntil: 'load', timeout: 60000 });
  await wait(settle);
  return page;
}
const gateState = page => page.evaluate(() => ({
  locked: document.body.classList.contains('locked'),
  has: window._rzFeatures ? window._rzFeatures.has('standards-ltc-lab', 'page-access') : null,
  source: window._rzFeatures && window._rzFeatures.source ? window._rzFeatures.source() : 'n/a',
  legacyKey: localStorage.getItem('rz_admin_features_by_page'),
}));

const GRANT_FREE = { page_key: 'standards-ltc-lab', feature_key: 'page-access', tier: 'free', enabled: true };
const DENY_PRO = { page_key: 'standards-ltc-lab', feature_key: 'page-access', tier: 'pro', enabled: false };

try {
  // ── V1: forged localStorage grant ──
  let p = await open(PAGE, { local: { rz_admin_features_by_page: JSON.stringify({ 'standards-ltc-lab': { 'page-access': { free: true, demo: true, pro: true, root: true } } }) } });
  let g = await gateState(p);
  law('V1', g.locked && g.has === false && g.legacyKey === null, `forged rz_admin_features_by_page → ${JSON.stringify(g)} (want locked, has=false, key deleted)`);
  law('E1a', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();

  // ── V1c: forged sessionStorage cache (fresh, granting) with Supabase down ──
  p = await open(PAGE, { supaDown: true, sess: { rz_flag_overrides_v1: JSON.stringify({ t: Date.now(), rows: [GRANT_FREE] }) } });
  g = await gateState(p);
  law('V1c', g.locked && g.has === false, `forged fresh cache granting free + Supabase down → ${JSON.stringify(g)}`);
  law('E1b', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();

  // ── V2: server grant unlocks a free visitor; server restriction locks a pro visitor ──
  p = await open(PAGE, { stubOpts: { rows: [GRANT_FREE] } });
  g = await gateState(p);
  law('V2', !g.locked && g.has === true && g.source === 'server', `server row free=true → ${JSON.stringify(g)} (want unlocked, source=server)`);
  law('E1c', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();

  p = await open(PAGE, { stubOpts: { rows: [DENY_PRO] }, local: { rz_premium_session: JSON.stringify(session('pro.user@example.com')) } });
  g = await gateState(p);
  law('V2b', g.locked && g.has === false, `pro visitor + server row pro=false → ${JSON.stringify(g)} (want locked)`);
  law('E1d', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();

  // ── V3: Supabase unavailable → defaults, no errors ──
  p = await open(PAGE, { supaDown: true });
  g = await gateState(p);
  const v3a = g.locked && g.has === false;
  const e3a = p.__st.errors.slice(); await p.close();
  p = await open(PAGE, { stubOpts: { readError: 'Could not find the table public.feature_overrides in the schema cache' }, local: { rz_premium_session: JSON.stringify(session('pro.user@example.com')) } });
  const g3b = await gateState(p);
  const e3b = p.__st.errors.slice(); await p.close();
  law('V3', v3a && !g3b.locked && g3b.has === true && g3b.source !== 'server',
    `module 503, free → ${JSON.stringify(g)}; table read error, pro → ${JSON.stringify(g3b)} (want free locked, pro unlocked, defaults)`);
  law('E1e', e3a.length === 0 && e3b.length === 0, `page errors: ${JSON.stringify(e3a.concat(e3b))}`);

  // ── V4: forged educator list ──
  p = await open(PAGE, { local: { rz_admin_educators: JSON.stringify(['teach@example.com']), rz_premium_session: JSON.stringify(session('teach@example.com')) } });
  const v4 = await p.evaluate(() => ({
    role: window._rzAuth.getRoleFromSession(window._rzAuth.getSession()),
    dcAi: window._rzFeatures.has('datahall-ai', 'page-access'),
    key: localStorage.getItem('rz_admin_educators'),
  }));
  law('V4', v4.role !== 'educator' && v4.dcAi === false && v4.key === null, `forged rz_admin_educators → ${JSON.stringify(v4)} (want role≠educator, datahall-ai false, key deleted)`);
  law('E1f', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();

  // ── P1: reload inside the TTL makes no Supabase request ──
  p = await open(PAGE, { stubOpts: { rows: [] } });
  const first = p.__st.supaReqs;
  await open(PAGE, { page: p, stubOpts: { rows: [] } });
  const second = p.__st.supaReqs - first;
  law('P1', first >= 1 && second === 0, `rz-supabase.js requests: first load ${first}, reload within TTL ${second} (want ≥1 then 0)`);
  await p.close();

  // ── A1: rz-ops toggle writes through setFeatureOverride, never localStorage ──
  const ROOT_USER = { id: 'u2', email: 'bagus@resistancezero.com' };
  p = await open(OPS, { stubOpts: { user: ROOT_USER, tier: 'root', rows: [] }, settle: 3000 });
  const dump = () => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  const cellBox = (tier) => p.evaluate(async (tier) => {
    showSection('features'); selectFeaturePage('standards-ltc-lab');
    await new Promise(r => setTimeout(r, 200));
    const row = [...document.querySelectorAll('#featureMatrixBody tr')].find(tr => /page-access/.test(tr.cells[0].textContent));
    if (!row) return { found: false };
    const col = { free: 1, demo: 2, pro: 3, root: 4 }[tier];
    const box = row.cells[col].querySelector('input[type=checkbox]');
    box.setAttribute('data-test-box', tier);
    return { found: true, checked: box.checked, disabled: box.disabled };
  }, tier);
  const before = await dump();
  const c0 = await cellBox('free');
  if (c0.found) await p.evaluate(() => document.querySelector('[data-test-box="free"]').click());
  await wait(600);
  const a1 = await p.evaluate(() => ({ calls: (window.__calls || {}).set || [], status: (document.getElementById('featureFlagsStatus') || {}).textContent || '' }));
  const after = await dump();
  law('A1', c0.found && !c0.disabled && JSON.stringify(a1.calls) === JSON.stringify([['standards-ltc-lab', 'page-access', 'free', true]]) && /saved/i.test(a1.status) && before === after,
    `cell found=${c0.found} enabled=${!c0.disabled}; setFeatureOverride calls=${JSON.stringify(a1.calls)}; status=${JSON.stringify(a1.status.trim())}; localStorage unchanged=${before === after}`);
  law('E1g', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();

  p = await open(OPS, { stubOpts: { user: ROOT_USER, tier: 'root', rows: [], writeError: 'new row violates row-level security policy' }, settle: 3000 });
  const c1 = await cellBox('demo');
  if (c1.found) await p.evaluate(() => document.querySelector('[data-test-box="demo"]').click());
  await wait(600);
  const a1b = await p.evaluate(() => ({ checked: document.querySelector('[data-test-box="demo"]') ? document.querySelector('[data-test-box="demo"]').checked : null, status: (document.getElementById('featureFlagsStatus') || {}).textContent || '' }));
  law('A1b', c1.found && a1b.checked === c1.checked && /row-level security/.test(a1b.status),
    `failed write → box back to ${a1b.checked} (was ${c1.checked}), status=${JSON.stringify(a1b.status.trim())}`);
  await p.close();

  // ── A2: educator promote / demote through rzSupa ──
  p = await open(OPS, { stubOpts: { user: ROOT_USER, tier: 'root', rows: [], educators: [XSS_EMAIL] }, settle: 3000 });
  const hasForm = await p.evaluate(() => { showSection('users'); return !!document.getElementById('eduEmail'); });
  let a2 = { hasForm };
  if (hasForm) {
    await p.type('#eduEmail', 'Teach@Example.com');
    await p.click('#eduAddBtn');
    await wait(500);
    a2 = await p.evaluate(() => ({ hasForm: true, add: window.__calls.add, listed: document.getElementById('eduTbody').textContent.includes('teach@example.com'),
      imgs: document.querySelectorAll('#eduTbody img').length, pwned: window.__pwnedE || 0, xssText: document.getElementById('eduTbody').textContent.includes('<img') }));
    await p.evaluate(() => { const b = [...document.querySelectorAll('#eduTbody button')].find(x => x.getAttribute('data-email') === 'teach@example.com'); b && b.click(); });
    await wait(500);
    a2.remove = await p.evaluate(() => window.__calls.remove);
  }
  law('A2', a2.hasForm && JSON.stringify(a2.add) === '["teach@example.com"]' && a2.listed && JSON.stringify(a2.remove) === '["teach@example.com"]',
    `promote → addEducator ${JSON.stringify(a2.add)}, listed=${a2.listed}; demote → removeEducator ${JSON.stringify(a2.remove)}`);
  law('A2x', a2.hasForm && a2.imgs === 0 && !a2.pwned && a2.xssText, `markup email renders as text: imgs=${a2.imgs} pwned=${a2.pwned} text=${a2.xssText}`);
  law('E1h', p.__st.errors.length === 0, `page errors: ${JSON.stringify(p.__st.errors)}`); await p.close();
} finally {
  await browser.close();
  server.close();
}
console.log(failures.length ? `RESULT: ${failures.length} law(s) failed: ${failures.join(', ')}` : 'RESULT: all laws pass');
process.exit(failures.length ? 1 : 0);
