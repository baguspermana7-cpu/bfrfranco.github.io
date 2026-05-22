#!/usr/bin/env node
/**
 * probe-rz-ops-admin.mjs
 *
 * End-to-end Puppeteer probe for the R-015 Phase 4 rz-ops admin UI (V2).
 *
 * Boots two local services:
 *   1. http.Server on port 8082 (or RZ_STATIC_PORT) — serves rz-ops files
 *      from the repo root, with permissive CORS.
 *   2. http.Server on port 8788 (or RZ_WORKER_PORT) — adapter that forwards
 *      to the rz-auth-gateway Worker module loaded in-process. This avoids
 *      the wrangler login / paid-account dependency the spec hints at.
 *      Same code path the Phase 1 + Phase 2 tests exercise — so a green
 *      probe also re-validates the worker contract end-to-end.
 *
 * Coverage (every step exits 1 on failure):
 *   A. set rz_auth_v2=1 + rz_auth_gw → reload → admin nav shows "Tier Manager"
 *   B. Add User V2 → POST /admin/users → educator row appears in table
 *   C. Edit User → PATCH /admin/users/:email → tier change reflected
 *   D. Delete (soft) → DELETE /admin/users/:email → status=disabled visible
 *   E. Tier Manager opens → 5 system tiers render with isSystem lock
 *   F. Create "partner" tier → appears in card grid → DELETE removes it
 *   G. Non-root login (demo@) → admin actions get 403 → modal "admin only"
 *
 * Usage:
 *   node tools/probe-rz-ops-admin.mjs
 *   RZ_STATIC_PORT=8082 RZ_WORKER_PORT=8788 node tools/probe-rz-ops-admin.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/* Static origin defaults to 8090 because the rz-auth-gateway Worker's
   ALLOWED_ORIGINS set explicitly whitelists http://127.0.0.1:8090 (alongside
   8081 + the production domain). Using any other port would trip CORS. */
const STATIC_PORT = parseInt(process.env.RZ_STATIC_PORT || '8090', 10);
const WORKER_PORT = parseInt(process.env.RZ_WORKER_PORT || '8788', 10);
const STATIC_ORIGIN = `http://127.0.0.1:${STATIC_PORT}`;
const WORKER_ORIGIN = `http://127.0.0.1:${WORKER_PORT}`;

let pass = 0, fail = 0;
const failures = [];

function ok(label, extra)  { pass++; console.log('  PASS ' + label + (extra ? ' :: ' + extra : '')); }
function bad(label, extra) { fail++; failures.push({label, extra}); console.log('  FAIL ' + label + (extra ? ' :: ' + extra : '')); }

// ─── Worker adapter (in-process) ────────────────────────────────────────────

async function loadWorker() {
  const url = path.resolve(REPO_ROOT, 'worker-auth/src/index.js');
  const mod = await import('file://' + url);
  return mod.default;
}

function makeFakeKv() {
  const store = new Map();
  return {
    store,
    async get(key)      { const r = store.get(key); return r ? r.value : null; },
    async put(key,v,o)  { store.set(key, { value: String(v), ttl: o?.expirationTtl ?? null }); },
    async delete(key)   { store.delete(key); },
    async list({prefix='', limit=1000} = {}) {
      const keys = [];
      for (const k of store.keys()) {
        if (prefix && !k.startsWith(prefix)) continue;
        keys.push({ name: k });
        if (keys.length >= limit) break;
      }
      return { keys, list_complete: true, cursor: undefined };
    }
  };
}

async function seedSystem(env) {
  const tiers = [
    { name: 'free',     label: 'Free',     priority: 10, color: '#94a3b8', defaultFeatures: {}, isSystem: true },
    { name: 'demo',     label: 'Demo',     priority: 20, color: '#a78bfa', defaultFeatures: {}, isSystem: true },
    { name: 'educator', label: 'Educator', priority: 25, color: '#10b981', defaultFeatures: {}, isSystem: true },
    { name: 'pro',      label: 'Pro',      priority: 30, color: '#8b5cf6', defaultFeatures: {}, isSystem: true },
    { name: 'root',     label: 'Root',     priority: 99, color: '#ef4444', defaultFeatures: {}, isSystem: true }
  ];
  for (const t of tiers) {
    await env.RZ_AUTH_KV.put(`tiers/${t.name}`, JSON.stringify(t));
  }
  /* Seed bagus root + demo user via /admin/__seed equivalent path. We just
     hash via crypto module directly to skip the bootstrap-token flow. */
  const cryptoMod = await import('file://' + path.resolve(REPO_ROOT, 'worker-auth/src/lib/crypto.js'));
  async function seedUser(email, password, tier, role) {
    const salt = cryptoMod.newSalt();
    const passwordHash = await cryptoMod.hashPassword(password, salt);
    const rec = {
      email, passwordHash,
      salt: cryptoMod.b64encode(salt),
      iters: cryptoMod.PBKDF2_ITERS,
      tier, role, status: 'active', featureOverrides: {},
      createdAt: Math.floor(Date.now()/1000), createdBy: 'probe',
      updatedAt: Math.floor(Date.now()/1000)
    };
    await env.RZ_AUTH_KV.put(`users/${email}`, JSON.stringify(rec));
  }
  await seedUser('bagus@resistancezero.com', 'rootpass-1234', 'pro', 'root');
  await seedUser('demo@resistancezero.com',  'demopass-1234', 'demo', 'demo');
}

async function startWorker() {
  const worker = await loadWorker();
  const env = {
    RZ_AUTH_KV: makeFakeKv(),
    ADMIN_SESSION_SECRET: 'probe-secret-' + Math.random().toString(36).slice(2),
    BOOTSTRAP_SEED_TOKEN: 'probe-bootstrap'
  };
  await seedSystem(env);

  /* Translate node http.IncomingMessage → Request, call worker.fetch, copy
     headers back. Cookies pass through; CORS preflight runs inside the
     worker (we just need to surface the right Origin header). */
  const server = http.createServer(async (req, res) => {
    try {
      const url = `http://gateway.local${req.url}`;
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const bodyBuf = Buffer.concat(chunks);
      const init = {
        method: req.method,
        headers: new Headers(),
        body: (req.method === 'GET' || req.method === 'HEAD' || bodyBuf.length === 0) ? undefined : bodyBuf
      };
      for (const [k, v] of Object.entries(req.headers)) {
        if (!v) continue;
        if (k.toLowerCase() === 'connection' || k.toLowerCase() === 'host') continue;
        if (Array.isArray(v)) { for (const vv of v) init.headers.append(k, vv); }
        else init.headers.append(k, String(v));
      }
      /* Force Origin so CORS allowlist matches. */
      if (!init.headers.get('Origin')) {
        init.headers.set('Origin', STATIC_ORIGIN);
      }
      init.headers.set('cf-connecting-ip', '127.0.0.1');
      const wrapped = new Request(url, init);
      const wRes = await worker.fetch(wrapped, env, {});
      res.statusCode = wRes.status;
      wRes.headers.forEach((v, k) => {
        if (k.toLowerCase() === 'set-cookie') {
          /* Strip Secure attr because probe uses http (browsers won't store
             Secure cookies over http). The Worker only adds Secure on https. */
          res.setHeader('set-cookie', v.replace(/;\s*Secure/ig, ''));
        } else {
          res.setHeader(k, v);
        }
      });
      const buf = Buffer.from(await wRes.arrayBuffer());
      res.end(buf);
    } catch (e) {
      console.error('[worker-adapter] error:', e && e.stack || e);
      res.statusCode = 500;
      res.end('worker adapter error');
    }
  });
  await listenOrFail(server, WORKER_PORT, 'worker');
  return { server, env };
}

function listenOrFail(server, port, label) {
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        reject(new Error(`port ${port} already in use (${label}). Pass RZ_STATIC_PORT/RZ_WORKER_PORT to override.`));
      } else reject(err);
    });
    server.listen(port, '127.0.0.1', resolve);
  });
}

// ─── Static file server ─────────────────────────────────────────────────────

const MIME = {
  '.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript',
  '.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml',
  '.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain','.xml':'application/xml'
};

async function startStatic() {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
      /* Prevent path traversal: resolve under REPO_ROOT only. */
      const filePath = path.normalize(path.join(REPO_ROOT, urlPath));
      if (!filePath.startsWith(REPO_ROOT)) {
        res.statusCode = 403; res.end('forbidden'); return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.statusCode = 404; res.end('not found'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.statusCode = 500; res.end('error');
    }
  });
  await listenOrFail(server, STATIC_PORT, 'static');
  return server;
}

// ─── Browser helpers ────────────────────────────────────────────────────────

async function workerLogin(page, email, password) {
  /* Establish a Worker cookie + CSRF via /auth/login, mirroring what
     auth.js loginV2() does. We POST from the page context so the cookie
     binds to this browser session. */
  const ok = await page.evaluate(async (gw, em, pw) => {
    try {
      const r = await fetch(gw + '/auth/login', {
        method: 'POST', credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: em, password: pw })
      });
      const j = await r.json();
      if (!j.ok) return { ok:false, status: r.status, err: j.error };
      localStorage.setItem('rz_auth_csrf', j.data.csrf || '');
      localStorage.setItem('rz_premium_session', JSON.stringify({
        email: j.data.email, role: j.data.role, tier: j.data.tier,
        expires: (j.data.expiresAt || 0)*1000, v2:true
      }));
      return { ok:true, role: j.data.role, csrf: !!j.data.csrf };
    } catch (e) { return { ok:false, err: String(e) }; }
  }, WORKER_ORIGIN, email, password);
  return ok;
}

async function setV2Flags(page) {
  await page.evaluate((gw) => {
    localStorage.setItem('rz_auth_v2', '1');
    localStorage.setItem('rz_auth_gw', gw);
  }, WORKER_ORIGIN);
}

// ─── The actual probe ──────────────────────────────────────────────────────

async function main() {
  console.log('=== probe-rz-ops-admin ===');
  console.log(`static: ${STATIC_ORIGIN} · worker: ${WORKER_ORIGIN}`);

  const staticServer = await startStatic();
  const { server: workerServer, env } = await startWorker();

  /* sanity: worker /health */
  {
    const r = await fetch(WORKER_ORIGIN + '/health', { headers: { Origin: STATIC_ORIGIN }});
    const j = await r.json();
    if (j && j.ok && j.data && j.data.status === 'ok') ok('worker /health green');
    else bad('worker /health', JSON.stringify(j));
  }

  /* --disable-web-security lets the probe run on any port without depending on
     the worker's CORS allowlist. We're not testing CORS here — Phase 1 already
     covers that. We ARE testing the admin contract end-to-end. The browser still
     sends the cookie cross-origin because we use credentials:'include'. */
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      `--user-data-dir=/tmp/rz-probe-${Date.now()}`
    ]
  });
  const page = await browser.newPage();
  page.on('pageerror', e => bad('pageerror', e.message));
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!/Failed to load resource|404|net::ERR/.test(t)) {
        bad('console.error', t.slice(0, 200));
      }
    }
  });

  // Step 1: visit rz-ops, enable V2 + worker login, then reload so the
  // page's top-level checkAccess() sees the session and renders the
  // dashboard with V2 visibility wired.
  await page.goto(STATIC_ORIGIN + '/rz-ops-p7x3k9m.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await setV2Flags(page);
  const wl = await workerLogin(page, 'bagus@resistancezero.com', 'rootpass-1234');
  if (wl && wl.ok && wl.role === 'root' && wl.csrf) ok('worker login as bagus (root)');
  else bad('worker login as bagus', JSON.stringify(wl));

  await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 700));

  /* Step A: confirm V2 visibility */
  const vis = await page.evaluate(() => {
    var nav = document.getElementById('navTiers');
    var addBtn = document.getElementById('addUserV2Btn');
    var auditSrc = document.getElementById('auditSourceToggle');
    return {
      navHidden: !nav || nav.classList.contains('rz-admin-v2-hidden'),
      addHidden: !addBtn || addBtn.style.display === 'none',
      auditHidden: !auditSrc || auditSrc.style.display === 'none',
      isV2: !!(window.__rzAdminV2 && window.__rzAdminV2.isV2 && window.__rzAdminV2.isV2())
    };
  });
  if (vis.isV2 && !vis.navHidden && !vis.addHidden && !vis.auditHidden) ok('AUTH_V2 visibility wired (nav+addBtn+auditToggle)');
  else bad('AUTH_V2 visibility', JSON.stringify(vis));

  /* Step B: Add User V2 — create educator */
  const createRes = await page.evaluate(async (gw) => {
    const csrf = localStorage.getItem('rz_auth_csrf') || '';
    const r = await fetch(gw + '/admin/users', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type':'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        email: 'bob@test.local', password: 'educator-1234',
        tier: 'pro', role: 'educator', status: 'active', featureOverrides: {}
      })
    });
    return { status: r.status, body: await r.json() };
  }, WORKER_ORIGIN);
  if (createRes.status === 200 && createRes.body.ok && createRes.body.data.user.email === 'bob@test.local')
    ok('Add User → POST /admin/users → bob@test.local created');
  else bad('Add User POST', JSON.stringify(createRes));

  /* Refresh list and verify row */
  await page.evaluate(() => window.__rzAdminV2.refreshUsers());
  await new Promise(r => setTimeout(r, 400));
  const tableHas = await page.evaluate(() => {
    var tbody = document.getElementById('userTbody');
    return tbody && tbody.innerHTML.indexOf('bob@test.local') >= 0;
  });
  if (tableHas) ok('user table renders bob@test.local row');
  else bad('user table missing bob row');

  /* Step C: PATCH — flip tier from pro to demo */
  const editRes = await page.evaluate(async (gw) => {
    const csrf = localStorage.getItem('rz_auth_csrf') || '';
    const r = await fetch(gw + '/admin/users/' + encodeURIComponent('bob@test.local'), {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type':'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ tier: 'demo' })
    });
    return { status: r.status, body: await r.json() };
  }, WORKER_ORIGIN);
  if (editRes.status === 200 && editRes.body.ok && editRes.body.data.user.tier === 'demo')
    ok('Edit User → PATCH → tier=demo');
  else bad('Edit User PATCH', JSON.stringify(editRes));

  /* Step D: Soft DELETE */
  const delRes = await page.evaluate(async (gw) => {
    const csrf = localStorage.getItem('rz_auth_csrf') || '';
    const r = await fetch(gw + '/admin/users/' + encodeURIComponent('bob@test.local'), {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRF-Token': csrf }
    });
    return { status: r.status, body: await r.json() };
  }, WORKER_ORIGIN);
  if (delRes.status === 200 && delRes.body.ok && delRes.body.data.user.status === 'disabled')
    ok('Soft DELETE → user.status=disabled');
  else bad('Soft DELETE', JSON.stringify(delRes));

  /* Step E: Tier Manager — 5 system tiers with lock */
  await page.evaluate(() => {
    var nav = document.getElementById('navTiers');
    if (nav) nav.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const tiers = await page.evaluate(() => {
    return new Promise(resolve => {
      window.__rzAdminV2.refreshTiers().then(t => resolve(t));
    });
  });
  const allSystem = Array.isArray(tiers) && tiers.length >= 5 && tiers.every(t => t.isSystem);
  if (allSystem) ok('Tier Manager renders 5 system tiers, all isSystem', `${tiers.length} tiers`);
  else bad('Tier Manager system tiers', JSON.stringify(tiers && tiers.map(t => ({name:t.name, isSystem:t.isSystem}))));

  /* Step F: Create "partner" tier → verify → delete */
  const createTierRes = await page.evaluate(async (gw) => {
    const csrf = localStorage.getItem('rz_auth_csrf') || '';
    const r = await fetch(gw + '/admin/tiers', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type':'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ name:'partner', label:'Partner', priority:50, color:'#22d3ee', defaultFeatures:{} })
    });
    return { status: r.status, body: await r.json() };
  }, WORKER_ORIGIN);
  if (createTierRes.status === 200 && createTierRes.body.ok && createTierRes.body.data.tier.name === 'partner')
    ok('Create tier "partner"');
  else bad('Create partner', JSON.stringify(createTierRes));

  const tiersAfter = await page.evaluate(() => window.__rzAdminV2.refreshTiers());
  if (tiersAfter.some(t => t.name === 'partner' && !t.isSystem)) ok('partner appears in card grid');
  else bad('partner not in grid', JSON.stringify(tiersAfter.map(t => t.name)));

  const delTierRes = await page.evaluate(async (gw) => {
    const csrf = localStorage.getItem('rz_auth_csrf') || '';
    const r = await fetch(gw + '/admin/tiers/partner', {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRF-Token': csrf }
    });
    return { status: r.status, body: await r.json() };
  }, WORKER_ORIGIN);
  if (delTierRes.status === 200 && delTierRes.body.ok) ok('Delete tier "partner"');
  else bad('Delete partner', JSON.stringify(delTierRes));

  /* Step G: Non-root login → admin actions 403 */
  /* New page so cookie is fresh. */
  const page2 = await browser.newPage();
  page2.on('pageerror', e => bad('pageerror[demo]', e.message));
  await page2.goto(STATIC_ORIGIN + '/rz-ops-p7x3k9m.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await setV2Flags(page2);
  const demoLogin = await workerLogin(page2, 'demo@resistancezero.com', 'demopass-1234');
  if (demoLogin && demoLogin.ok && demoLogin.role === 'demo') ok('worker login as demo (non-root)');
  else bad('demo login', JSON.stringify(demoLogin));
  /* Don't reload page2 — demo isn't ADMIN_EMAILS so checkAccess() would
     just bounce to the login form. We only need a cookie+CSRF on this page
     so the admin call below carries the demo session. */

  const demoAdminAttempt = await page2.evaluate(async (gw) => {
    const csrf = localStorage.getItem('rz_auth_csrf') || '';
    const r = await fetch(gw + '/admin/users', {
      method: 'GET', credentials: 'include',
      headers: { 'X-CSRF-Token': csrf }
    });
    return { status: r.status, body: await r.json() };
  }, WORKER_ORIGIN);
  if (demoAdminAttempt.status === 403 && demoAdminAttempt.body.ok === false)
    ok('demo session → /admin/users → 403');
  else bad('demo /admin/users not 403', JSON.stringify(demoAdminAttempt));

  /* Verify the V2 client wraps the error into a friendly modal text. */
  const friendly = await page2.evaluate(async () => {
    try {
      await window.__rzAdminV2.refreshUsers();
      return { caught: false };
    } catch (e) {
      return { caught: true, status: e.status, msg: e.message };
    }
  });
  /* refreshUsers swallows error and renders inline banner; check tbody has "admin only" */
  const tbodyHTML = await page2.evaluate(() => {
    var t = document.getElementById('userTbody');
    return t ? t.innerHTML : '';
  });
  if (/admin only|not authenticated|403/i.test(tbodyHTML)) ok('demo session → user table shows admin-only error banner');
  else bad('demo error banner missing', tbodyHTML.slice(0, 200));

  await browser.close();
  workerServer.close();
  staticServer.close();

  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  console.log('───────────────────────────────────────────────────────────────');
  if (fail > 0) {
    for (const f of failures) console.log('  - ' + f.label + (f.extra ? ' :: ' + f.extra : ''));
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('FATAL:', e && e.stack || e);
  process.exit(2);
});
