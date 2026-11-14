#!/usr/bin/env node
/**
 * test-rz-ops-access.mjs — rz-ops admin console: access gate + escaping + phone layout.
 *
 * Laws (each must FAIL on the v3.57.0 page and PASS after the hardening):
 *   A1  a forged localStorage session (rz_premium_session role=root) with NO Supabase user → login shown,
 *       sidebar + console hidden
 *   A2  a signed-in Supabase user whose own profile tier is not root → login shown
 *   A3  a signed-in root profile → console shown
 *   X1  Mayar fields typed by payers render as text: an <img onerror> payload creates no element and runs nothing
 *   M1  at 390 px no section of the console scrolls the page sideways (scrollWidth <= 390 on every tab)
 *   E1  no uncaught page errors in any scenario
 *
 * js/rz-supabase.js is replaced in-browser by a stub (request interception) so the gate can be driven
 * without real credentials. Usage: node tools/test-rz-ops-access.mjs [--file rz-ops-p7x3k9m.html]
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

function stub(user, tier) {
  return `const u=${JSON.stringify(user)};const api={configured:true,
    getUser:async()=>u,getSession:async()=>u?{user:u}:null,
    getProfile:async()=>({data:u?{id:'x',email:u.email,tier:${JSON.stringify(tier)}}:null,error:null}),
    signIn:async()=>({error:'stub'}),signOut:async()=>({}),listProfiles:async()=>({data:[]})};
    api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
const law = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };

async function open({ user = null, tier = 'free', forged = false, width = 1440 }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (u.includes('/js/rz-supabase.js')) return r.respond({ status: 200, contentType: 'text/javascript', body: stub(user, tier) });
    if (!u.startsWith(BASE) && !/jsdelivr|cdnjs|googleapis|gstatic/.test(u)) return r.respond({ status: 204, body: '' });
    r.continue();
  });
  if (forged) {
    await page.evaluateOnNewDocument(() => localStorage.setItem('rz_premium_session', JSON.stringify(
      { email: 'bagus@resistancezero.com', tier: 'pro', role: 'root', expires: new Date(Date.now() + 864e5).toISOString() })));
  }
  await page.goto(BASE + FILE, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  const vis = await page.evaluate(() => {
    const shown = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    return { login: shown('loginPage'), main: shown('main-content'), sidebar: shown('sidebar'), sw: document.documentElement.scrollWidth };
  });
  return { page, vis, errors };
}

try {
  let r = await open({ forged: true });
  law('A1', r.vis.login && !r.vis.main && !r.vis.sidebar, `forged session, no Supabase user → ${JSON.stringify(r.vis)}`);
  law('E1a', r.errors.length === 0, `page errors: ${JSON.stringify(r.errors)}`); await r.page.close();

  r = await open({ user: { id: 'u1', email: 'someone@example.com' }, tier: 'pro', forged: true });
  law('A2', r.vis.login && !r.vis.main, `signed-in tier=pro (+forged root session) → ${JSON.stringify(r.vis)}`);
  law('E1b', r.errors.length === 0, `page errors: ${JSON.stringify(r.errors)}`); await r.page.close();

  r = await open({ user: { id: 'u2', email: 'bagus@resistancezero.com' }, tier: 'root' });
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
  await r.page.close();

  r = await open({ user: { id: 'u2', email: 'bagus@resistancezero.com' }, tier: 'root', width: 390 });
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
