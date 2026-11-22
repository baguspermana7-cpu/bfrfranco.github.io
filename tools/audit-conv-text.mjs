#!/usr/bin/env node
/* audit-conv-text.mjs — how much text the Conventional BMS pages show, and how much of it is said twice
   (PRD-CONV-BMS-DECLUTTER, owner R185). Measured on the RENDER at 1440 x 900 (and 390 x 844), first screen and whole
   page, after the plant has drawn.
     words      visible words on the first screen (text nodes with a painted box inside the viewport)
     wordsHtml  the same without the drawing (SVG text: tags and readings on the sheet)
     dupLabels  a visible label (letters, >= 2 words or >= 6 chars) shown more than once on the first screen
     dupValues  a visible reading (number + unit, e.g. "19.4 C") shown more than once on the first screen
   --json prints the raw result; --page=x.html limits the run. Read-only, no verdict (the gate is test-conv-declutter). */
import puppeteer from 'puppeteer';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PAGES = ['datahall.html', 'chiller-plant.html', 'fuel-system.html', 'water-system.html', 'fire-system.html', 'ict.html', 'EPMS_Telemetry.html'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };

export function serve(root = ROOT) {
  const srv = http.createServer((q, r) => {
    const p = join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { r.statusCode = 404; return r.end(); }
    r.setHeader('content-type', MIME[extname(p)] || 'application/octet-stream'); r.end(readFileSync(p));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

/* runs in the page */
export function collect() {
  const vw = innerWidth, vh = innerHeight, items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const el = n.parentElement; if (!el || el.closest('script,style,noscript,template,[aria-hidden="true"] title,title,desc')) continue;
    if (el.closest('#cookie-banner,.cookie-banner,[data-cookie],.cc-banner')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    let hidden = false; for (let a = el; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) { hidden = true; break; } if (a.hidden || a.closest('[hidden],dialog:not([open])')) { hidden = true; break; } }
    if (hidden) continue;
    const inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    items.push({ t, inView, svg: !!el.closest('svg'), tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), y: Math.round(r.top) });
  }
  return items;
}

const words = (s) => (s.match(/[A-Za-z0-9][A-Za-z0-9.,%/°+-]*/g) || []).length;
const VALUE = /(-?\d+(?:[.,]\d+)?)\s*(°?\s?[CF]\b|kW|MW|kVA|kPa|bar|L\/s|L\b|m3\/h|%|A\b|V\b|Hz|Gbps|RH|ppm)/g;
export function summarise(items) {
  const view = items.filter((i) => i.inView);
  const lab = new Map(), val = new Map();
  for (const i of view) {
    const k = i.t.toLowerCase();
    if (/[a-z]/.test(k) && (k.split(' ').length >= 2 || k.length >= 6)) lab.set(k, (lab.get(k) || 0) + 1);
    for (const m of i.t.matchAll(VALUE)) { const v = (m[1] + ' ' + m[2].replace(/[°\s]/g, '')).toLowerCase(); val.set(v, (val.get(v) || 0) + 1); }
  }
  const dup = (m) => [...m].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
  const dl = dup(lab), dv = dup(val);
  return { words: view.reduce((s, i) => s + words(i.t), 0), wordsHtml: view.filter((i) => !i.svg).reduce((s, i) => s + words(i.t), 0), wordsPage: items.reduce((s, i) => s + words(i.t), 0), nodes: view.length,
    dupLabels: dl.reduce((s, [, c]) => s + c - 1, 0), dupValues: dv.reduce((s, [, c]) => s + c - 1, 0), topLabels: dl.slice(0, 12), topValues: dv.slice(0, 12) };
}

export async function measure(browser, base, page, w = 1440, h = 900) {
  const pg = await browser.newPage();
  try {
    await pg.setViewport({ width: w, height: h });
    await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('rz-cookie-consent', 'declined'); } catch (e) { /* */ } });
    await pg.goto(base + '/' + page, { waitUntil: 'load', timeout: 60000 });
    await new Promise((ok) => setTimeout(ok, 3500));
    const items = await pg.evaluate(collect);
    return { page, w, ...summarise(items), items };
  } finally { await pg.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), only = args.filter((a) => a.startsWith('--page=')).map((a) => a.slice(7));
  const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  for (const p of only.length ? only : PAGES) for (const [w, h] of [[1440, 900], [390, 844]]) {
    const r = await measure(browser, base, p, w, h); out.push(r);
    if (!args.includes('--json')) {
      console.log(`${p.padEnd(22)} ${String(w).padStart(4)}  words ${String(r.words).padStart(4)} html ${String(r.wordsHtml).padStart(4)} (page ${r.wordsPage})  dupLabels ${r.dupLabels}  dupValues ${r.dupValues}`);
      if (w === 1440) { console.log('   labels: ' + r.topLabels.map(([k, c]) => `${c}× "${k.slice(0, 40)}"`).join(' · ')); console.log('   values: ' + r.topValues.map(([k, c]) => `${c}× ${k}`).join(' · ')); }
    }
  }
  if (args.includes('--json')) console.log(JSON.stringify(out.map(({ items, ...r }) => r)));
  await browser.close(); srv.close();
}
