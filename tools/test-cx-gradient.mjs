#!/usr/bin/env node
/**
 * test-cx-gradient.mjs — K34 (owner 2026-11-09 "Mainkan gradien. Yg sangat cantik", for the Cx page).
 * axe cannot judge text over a gradient (it reports such nodes as incomplete), so this measures it directly:
 *   G1 the two owner-gradient fills (hero, Full-analysis call) render a gradient; panels carry only a 1 px rim, so
 *      axe keeps judging their text (a gradient FILL makes axe skip every node in it — found v3.35.6)
 *   G2 every text run in the hero, the tab strip and the Full-analysis call meets AA (4.5:1, 3:1 large) against the BRIGHTEST/DARKEST
 *      background pixel under it, with the text hidden — 1440 and 390 px, light and dark
 *   G3 no gradient text anywhere on the page
 * --mutate puts the hero's muted tier back to the page token; G2 must then fail (red proof: 11 runs below AA).
 *   node tools/test-cx-gradient.mjs [--mutate]
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MUTATE = process.argv.includes('--mutate');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = http.createServer(async (req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));   // a free port: never a fixed one another session may hold
const URL = `http://127.0.0.1:${server.address().port}/cx-calculator.html`;

const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const dec = await browser.newPage();
const decode = (buf) => dec.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  return { width: im.width, data: Array.from(x.getImageData(0, 0, im.width, im.height).data) }; }, buf.toString('base64'));
try {
  for (const theme of ['dark', 'light']) for (const vw of [1440, 390]) {
    const p = await browser.newPage(); await p.setViewport({ width: vw, height: 1000 });
    await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); localStorage.setItem('rz-cookie-consent', 'declined'); } catch (e) {} }, theme);
    await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    if (MUTATE) await p.addStyleTag({ content: '.tool-head :is(.eyebrow,.basis,.crumb,h1 .muted){color:var(--rzt-muted)!important}' });
    await p.waitForFunction(() => document.querySelector('.tool-tabs [role="tab"]'), { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    const tag = `${theme} ${vw}`;
    if (vw === 1440) {
      const surf = await p.evaluate(() => [...document.querySelectorAll('[data-rz-owner-gradient]')].map((e) => ({ id: e.id || e.className.split(' ')[0], grad: /gradient/.test(getComputedStyle(e).backgroundImage) })));
      const want = ['tool-head', 'cxFullRow'];
      check(want.every((w) => surf.some((s) => s.id === w && s.grad)), `G1 ${tag}: ${want.length} owner surfaces render a gradient (${surf.filter((s) => s.grad).length}/${surf.length} tagged surfaces lit)`);
      const gt = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const c = getComputedStyle(e); return /gradient/.test(c.backgroundImage) && /text/.test(c.webkitBackgroundClip || c.backgroundClip); }).length);
      check(gt === 0, `G3 ${tag}: no gradient text — read ${gt}`);
    }
    // each measured block is scrolled into the viewport and read in viewport coordinates (a full-page clip beyond the
    // viewport reads back black, and resizing the viewport re-lays vh/sticky content)
    let runs = [], low = [], worst = { k: 99 };
    await p.addStyleTag({ content: '#cookieBanner{display:none!important}' });
    for (const sel of ['.tool-head', '.tool-tabs', '.tool-full']) {
      await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -70); }, sel);
      await new Promise((r) => setTimeout(r, 500));
      const part = await p.evaluate((s) => {
        const out = []; const root = document.querySelector(s); if (!root) return out;
        for (const e of [root, ...root.querySelectorAll('*')]) {
          const t = [...e.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); if (!t) continue;
          const rg = document.createRange(); rg.selectNodeContents(t); const r = rg.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom > innerHeight || r.top < 0) continue;
          const c = getComputedStyle(e); const fs = parseFloat(c.fontSize);
          out.push({ text: t.textContent.trim().slice(0, 28), color: c.color, x: r.left, y: r.top, w: r.width, h: r.height, need: fs >= 24 || (fs >= 18.66 && +c.fontWeight >= 700) ? 3 : 4.5 });
        }
        return out;
      }, sel);
      const hide = await p.addStyleTag({ content: sel + ' *, ' + sel + ' { -webkit-text-fill-color: transparent !important; color: transparent !important; text-shadow: none !important }' });
      await new Promise((r) => setTimeout(r, 250));
      const img = await decode(await p.screenshot());
      await p.evaluate((h) => h.remove(), hide);
      for (const r of part) {
        const m = r.color.match(/[\d.]+/g).map(Number), lt = lum(m[0], m[1], m[2]); let min = 99;
        for (let y = Math.floor(r.y); y < r.y + r.h; y += 2) for (let x = Math.floor(r.x); x < r.x + r.w; x += 2) {
          if (x < 0 || x >= img.width || y < 0) continue; const i = (img.width * y + x) * 4; if (i + 2 >= img.data.length) continue;
          min = Math.min(min, ratio(lt, lum(img.data[i], img.data[i + 1], img.data[i + 2])));
        }
        if (min / r.need < worst.k) worst = { k: min / r.need, s: `"${r.text}" ${min.toFixed(2)}:1` };
        if (min < r.need) low.push(`"${r.text}" ${min.toFixed(2)} < ${r.need}`);
      }
      runs = runs.concat(part);
    }
    check(runs.length >= 8 && !low.length, `G2 ${tag}: ${runs.length} text runs meet AA over the gradient, tightest ${worst.s}${low.length ? ' — ' + low.slice(0, 4).join('; ') : ''}`);
    await p.close();
  }
} finally { await browser.close(); server.close(); }
console.log(fail ? `FAIL — ${fail} check(s)` : 'CX GRADIENT — every owner gradient is lit, no gradient text, every hero text run reads at AA');
process.exit(fail ? 1 : 0);
