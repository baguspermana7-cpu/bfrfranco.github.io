#!/usr/bin/env node
/**
 * test-rz-ops-theme.mjs — rz-ops admin console: one theme across the console AND its embedded apps.
 *
 * Laws (each FAILED on 552c7ce35 / v3.58.1 and PASSES after the wave-5 theme alignment):
 *   T1  every embedded app (Stock Investment = Apps/dca-app, Finance Terminal, IDR Stocks = StockMap) shows
 *       the console theme after it loads, and again after each toggle (light→dark and dark→light), for a
 *       console that starts dark and one that starts light. "Shows" = the app's <html data-theme> AND the
 *       luminance of what it actually paints (dark < 0.2, light > 0.5).
 *   T2  0 theme-mismatched large backgrounds (>= 6000 px², opaque) on every console tab + the shell
 *       (sidebar/topbar), in both themes: a light box in dark (lum > 0.5) or a dark box in light (lum < 0.05).
 *   T3  0 text elements under the WCAG AA targets on every tab + the shell, in both themes: 4.5:1 for body
 *       text, 3:1 for large text (>= 24 px, or >= 18.66 px at weight >= 700). The checker composites every
 *       background layer up the ancestor chain (alpha colours over what is under them) and, where a layer is
 *       a gradient, measures against EVERY colour stop and keeps the worst — the seed audit fell back to the
 *       parent colour and called a gradient button 1.05:1.
 *   T4  Settings → System Health carries no hardcoded numbers (99.97% / 42ms / 0.02% / P95 120ms), no
 *       "Mock" button or toast; its round-trip tile is a measured "<n> ms" and its Supabase tile says reachable.
 *   T5  the topbar clock names the viewer's real zone (Intl short timeZoneName), never a fixed "UTC+7".
 *   T6  AUTH_V2 off (production): no V2-only control or the Tier Manager nav item is visible.
 *   E1  no uncaught page errors.
 *
 * js/rz-supabase.js is stubbed in-browser (request interception), like tools/test-rz-ops-access.mjs.
 * Usage: node tools/test-rz-ops-theme.mjs [--all]   [RZ_OPS_THEME_SHOTS=<dir> also writes w5-*.png screenshots]
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
const FILE = 'rz-ops-p7x3k9m.html';
const SHOTS = process.env.RZ_OPS_THEME_SHOTS || '';
const ALL = process.argv.includes('--all');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;   // e.g. --only T2,T3 while iterating
const run = id => !ONLY || ONLY.includes(id);          // print every finding, not the first dozen
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

const PROFILES = [
  { id: 'u2', email: 'bagus@resistancezero.com', tier: 'root', display_name: 'Bagus', created_at: '2026-06-02T10:00:00Z' },
  { id: 'p1', email: 'alpha@example.com', tier: 'pro', display_name: 'Alpha', created_at: '2026-10-02T10:00:00Z' },
  { id: 'p2', email: 'bravo@example.com', tier: 'free', display_name: null, created_at: '2026-09-02T10:00:00Z' },
  { id: 'p3', email: 'delta@example.com', tier: 'demo', display_name: 'Delta', created_at: '2026-08-02T10:00:00Z' },
  { id: 'p4', email: 'eve@example.com', tier: 'educator', display_name: 'Eve', created_at: '2026-08-02T10:00:00Z' },
];
const AUDIT = [
  { id: 1, actor_id: 'p1', action: 'pdf_exported', target_type: 'calc', target_id: null, meta: { calc: 'capex' }, created_at: new Date(Date.now() - 864e5).toISOString() },
];
const STUB = `const u={id:'u2',email:'bagus@resistancezero.com'};const P=${JSON.stringify(PROFILES)};const A=${JSON.stringify(AUDIT)};
  const api={configured:true,getUser:async()=>u,getSession:async()=>({user:u}),
  getProfile:async()=>({data:{id:'u2',email:u.email,tier:'root'},error:null}),
  signIn:async()=>({error:'stub'}),signOut:async()=>({}),listProfiles:async()=>({data:[]}),
  listAllProfiles:async()=>({data:P.map(r=>Object.assign({},r)),error:null}),
  listAuditLog:async()=>({data:A.map(r=>Object.assign({},r)),error:null}),
  listSubscribers:async()=>({data:[],error:null}),getFeatureOverrides:async()=>({data:[],error:null}),
  listEducators:async()=>({data:[],error:null}),isEducator:async()=>false};
  api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;

const IFRAMES = { 'stock-investment': 'dca-iframe', 'finance-terminal': 'finance-terminal-iframe', 'idr-stocks': 'idr-stocks-iframe' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
const law = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };
const pageErrors = [];

async function open(theme, { width = 1440, tz = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  if (tz) await page.emulateTimezone(tz);
  page.on('pageerror', e => pageErrors.push(`${theme}: ${String(e.message).slice(0, 140)}`));
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (u.includes('/js/rz-supabase.js')) return r.respond({ status: 200, contentType: 'text/javascript', body: STUB });
    if (!u.startsWith(BASE) && !/jsdelivr|cdnjs|googleapis|gstatic|unpkg/.test(u)) return r.respond({ status: 204, body: '' });
    r.continue();
  });
  // The console's saved choice, set in the top frame only (the embedded apps must take it from the console).
  await page.evaluateOnNewDocument(t => { if (window.top === window) localStorage.setItem('rz_admin_theme', t); }, theme);
  await page.goto(BASE + FILE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.main-wrap') && getComputedStyle(document.querySelector('.main-wrap')).display !== 'none', { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  return page;
}

// ── In-page checker (serialised into the page) ──
function auditSection(sel, theme) {
  const parse = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, under) => { const a = top.a; return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const stops = img => (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  // Every background layer from the element up to the first opaque solid colour; gradients fan out into stops.
  function backgrounds(el) {
    const layers = [];
    for (let x = el; x; x = x.parentElement) {
      const cs = getComputedStyle(x);
      const img = cs.backgroundImage;
      if (img && img !== 'none') {
        if (/url\(/.test(img)) return null;                     // a picture: contrast not judgeable from CSS
        const s = stops(img); if (s.length) layers.push({ grad: s });
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push({ solid: c }); if (c.a >= 0.999 && !(img && img !== 'none')) break; }
    }
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }];             // the canvas under everything
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      if (L.solid) cands = cands.map(c => over(L.solid, c));
      else cands = L.grad.flatMap(s => cands.map(c => over(s, c)));
    }
    return cands;
  }
  const root = document.querySelector(sel);
  const out = { mismatch: [], low: [] };
  if (!root) return out;
  const tag = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')).slice(0, 48);
  root.querySelectorAll('*').forEach(e => {
    if (e.closest('.leaflet-container, iframe, svg, canvas, .rz-admin-v2-hidden')) return;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const cs = getComputedStyle(e);
    if (cs.visibility !== 'visible' || !e.getClientRects().length) return;
    let op = 1; for (let x = e; x; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
    if (op < 0.6 || e.matches(':disabled')) return;              // WCAG exempts inactive controls
    // T2 — large opaque backgrounds that belong to the other theme
    const own = parse(cs.backgroundColor); const img = cs.backgroundImage;
    if (r.width * r.height >= 6000) {
      let c = own && own.a >= 0.5 ? own : null;
      if (img && img !== 'none' && !/url\(/.test(img)) { const s = stops(img).filter(x => x.a >= 0.5); if (s.length) c = s[0]; }
      if (c) { const l = lum(c); if ((theme === 'dark' && l > 0.5) || (theme === 'light' && l < 0.05)) out.mismatch.push(`${tag(e)} lum=${l.toFixed(2)}`); }
    }
    // T3 — contrast of the element's own text
    const text = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!/[A-Za-z0-9]/.test(text)) return;
    const fg = parse(cs.color); if (!fg) return;
    const bgs = backgrounds(e); if (!bgs) return;
    const worst = Math.min(...bgs.map(b => ratio(over(fg, b), b)));
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (worst < need - 0.005) out.low.push(`${tag(e)} ${worst.toFixed(2)}<${need} "${text.slice(0, 28)}"`);
  });
  return out;
}

// Theme an embedded app actually shows: its <html data-theme> + the luminance it paints.
async function iframeTheme(page, id) {
  const fh = await page.$('#' + id); if (!fh) return { attr: 'missing' };
  const fr = await fh.contentFrame(); if (!fr) return { attr: 'no-frame' };
  return fr.evaluate(() => {
    const parse = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    let el = document.elementFromPoint(innerWidth / 2, Math.min(300, innerHeight / 2));
    let L = null;
    for (let x = el; x; x = x.parentElement) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c.a >= 0.9) { L = lum(c); break; } }
    if (L === null) { const c = parse(getComputedStyle(document.body).backgroundColor); L = c && c.a > 0.5 ? lum(c) : 1; }
    return { attr: document.documentElement.getAttribute('data-theme'), lum: +L.toFixed(3) };
  });
}
const shows = (t, want) => t.attr === want && (want === 'dark' ? t.lum < 0.2 : t.lum > 0.5);

async function loadIframes(page) {
  for (const [sec, id] of Object.entries(IFRAMES)) {
    await page.evaluate(s => showSection(s), sec);
    await page.waitForFunction(i => { const f = document.getElementById(i); const d = f && f.contentDocument; return d && d.readyState === 'complete' && d.location.href !== 'about:blank' && d.body && d.body.children.length; }, { timeout: 30000 }, id).catch(() => {});
    await sleep(sec === 'stock-investment' ? 2500 : 1500);
  }
}
async function allIframes(page) {
  const r = {}; for (const [sec, id] of Object.entries(IFRAMES)) r[sec] = await iframeTheme(page, id); return r;
}
async function shot(page, name) {
  if (!SHOTS) return;
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
  await page.screenshot({ path: path.join(SHOTS, `w5-${name}.png`) });
}

// ── T1: embedded app theme, both starting themes, after load and after each toggle ──
for (const start of run('T1') ? ['dark', 'light'] : []) {
  const page = await open(start);
  await loadIframes(page);
  let want = start;
  const steps = [['load', await allIframes(page)]];
  for (const n of [1, 2]) {
    await page.evaluate(() => toggleAdminTheme()); await sleep(1200);
    want = want === 'dark' ? 'light' : 'dark';
    steps.push([`toggle${n}`, await allIframes(page), want]);
  }
  steps[0].push(start);
  for (const [step, res, w] of steps) {
    const bad = Object.entries(res).filter(([, t]) => !shows(t, w));
    law(`T1-${start}-${step}`, bad.length === 0, `console=${w} ` + Object.entries(res).map(([k, t]) => `${k}:${t.attr}/${t.lum}`).join(' '));
  }
  await page.close();
}

// ── T2/T3: every console tab + shell, both themes (+ T4/T6 on the same loads) ──
for (const theme of run('T2') || run('T3') || run('T4') ? ['dark', 'light'] : []) {
  const page = await open(theme);
  const secs = await page.evaluate(() => [...document.querySelectorAll('.section')].map(s => s.id.replace(/^sec-/, '')));
  let mismatch = [], low = [];
  const shell = await page.evaluate(auditSection, '.sidebar', theme);
  const top = await page.evaluate(auditSection, '.topbar', theme);
  for (const r of [shell, top]) { mismatch.push(...r.mismatch.map(x => `shell ${x}`)); low.push(...r.low.map(x => `shell ${x}`)); }
  for (const s of secs) {
    if (IFRAMES[s]) continue;                                    // the app inside is T1's business
    await page.evaluate(s => { showSection(s); window.scrollTo(0, 0); }, s);
    await sleep(s === 'benchmarks' ? 1500 : 400);
    const r = await page.evaluate(auditSection, '#sec-' + s, theme);
    mismatch.push(...r.mismatch.map(x => `${s} ${x}`)); low.push(...r.low.map(x => `${s} ${x}`));
    if (['dashboard', 'users', 'settings'].includes(s)) await shot(page, `${s}-${theme}-1440`);
  }
  law(`T2-${theme}`, mismatch.length === 0, `${mismatch.length} mismatched backgrounds ${JSON.stringify(ALL ? mismatch : mismatch.slice(0, 8))}`);
  law(`T3-${theme}`, low.length === 0, `${low.length} low-contrast text ${(ALL ? '\n  ' + low.join('\n  ') : JSON.stringify(low.slice(0, 12)))}`);
  if (SHOTS) for (const app of Object.keys(IFRAMES)) { await page.evaluate(a => showSection(a), app); await sleep(3500); await shot(page, `${app}-${theme}-1440`); }

  if (theme === 'dark') {
    // T4 — System Health is measured, nothing is mock
    await page.evaluate(() => showSection('settings')); await sleep(800);
    const h = await page.evaluate(() => {
      const sec = document.getElementById('sec-settings');
      return { text: sec.innerText, mockBtn: [...sec.querySelectorAll('button')].filter(b => /mock|backup data|clear cache/i.test(b.textContent)).map(b => b.textContent.trim()),
        rtt: (document.getElementById('healthRtt') || {}).textContent || null, supa: (document.getElementById('healthSupa') || {}).textContent || null };
    });
    const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
    const fake = ['99.97%', '42ms', '0.02%', 'P95: 120ms'].filter(x => h.text.includes(x));
    law('T4a', fake.length === 0, `hardcoded health numbers shown: ${JSON.stringify(fake)}`);
    law('T4b', h.mockBtn.length === 0 && !/Mock:|mock data/i.test(src), `mock buttons ${JSON.stringify(h.mockBtn)}; "Mock:" in source: ${/Mock:|mock data/i.test(src)}`);
    law('T4c', /^\d+ ms$/.test(h.rtt || '') && /reachable/i.test(h.supa || ''), `round-trip tile "${h.rtt}", Supabase tile "${h.supa}"`);
    // T6 — AUTH_V2 is off in production: nothing of it is visible
    const v2 = await page.evaluate(() => [...document.querySelectorAll('.rz-admin-v2-only, #navTiers, #addUserV2Btn, #auditSourceToggle')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility === 'visible').map(e => e.id || e.className));
    law('T6', v2.length === 0, `visible V2 controls with AUTH_V2 off: ${JSON.stringify(v2)}`);
  }
  await page.close();
}

// ── T5: the clock names the real zone ──
for (const tz of run('T5') ? ['America/New_York', 'Asia/Jakarta'] : []) {
  const page = await open('dark', { tz });
  await sleep(1200);
  const r = await page.evaluate(() => ({ shown: document.getElementById('topbarTime').textContent,
    zone: new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName').value }));
  law(`T5-${tz}`, r.shown.trim().endsWith(' ' + r.zone) && !(r.zone !== 'GMT+7' && /UTC\+7/.test(r.shown)), `clock "${r.shown}", real zone ${r.zone}`);
  await page.close();
}

// Dashboard at 390 px (screenshot only)
if (SHOTS) {
  for (const theme of ['dark', 'light']) { const p = await open(theme, { width: 390 }); await shot(p, `dashboard-${theme}-390`); await p.close(); }
}

law('E1', pageErrors.length === 0, `${pageErrors.length} page errors ${JSON.stringify(pageErrors.slice(0, 5))}`);
await browser.close(); server.close();
console.log(failures.length ? `\nFAIL ${failures.length}: ${failures.join(' ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
