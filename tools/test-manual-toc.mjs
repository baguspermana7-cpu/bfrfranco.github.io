#!/usr/bin/env node
/**
 * test-manual-toc.mjs — K26 (owner 2026-11-09: manuals "bener2 intuitive dan menarik utk dibaca").
 * Every long manual (>= 4 content sections) gets an "On this page" navigation built from its own h2 headings.
 *   T1 every long manual loads js/rz-manual-toc.js and css/rz-manual-toc.css
 *   T2 1440 px: a rail lists every content h2 once, every link resolves to an element, the rail sits beside the text
 *      column (no overlap) and inside the viewport
 *   T3 390 px: a collapsed "On this page" disclosure (or the page's own static contents block) and no horizontal scroll
 *   T5 1440, light and dark: every rail text (caption, numbers, links, the current link) meets AA against the page
 *      background behind the rail (red: epms-telemetry light, a manual without the --mn tokens, fell back to #8a93a0)
 *   T4 three sample manuals: a clicked link lands its heading just below the fixed bar (not under it), and after
 *      scrolling into section 5 its link carries aria-current="true"
 * Red proof: before the module existed, T1 failed on every long manual.
 *   node tools/test-manual-toc.mjs [--page=manual/cx.html]
 */
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const only = (process.argv.find((a) => a.startsWith('--page=')) || '').slice(7);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// a content h2 is any h2 in main.mn-wrap that is not the title of a static contents block
const contentH2 = (html) => {
  const main = (html.split('<main')[1] || '').split('</main>')[0];
  return (main.match(/<h2\b[^>]*>/g) || []).filter((h) => !/contents-title/.test(h)).length;
};
const all = (await readdir(join(ROOT, 'manual'))).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => 'manual/' + f);
const pages = all.filter((p) => (!only || p === only) && contentH2(readFileSync(join(ROOT, p), 'utf8')) >= 4);

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };

const unwired = pages.filter((p) => { const t = readFileSync(join(ROOT, p), 'utf8'); return !/rz-manual-toc\.js/.test(t) || !/rz-manual-toc\.css/.test(t); });
check(!unwired.length, `T1 ${pages.length - unwired.length}/${pages.length} long manuals load the contents module${unwired.length ? ' — missing: ' + unwired.slice(0, 5).join(', ') + (unwired.length > 5 ? ' …' : '') : ''}`);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const open = async (page, w, h = 900, theme = 'dark') => {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h });
  await p.evaluateOnNewDocument((th) => { try { localStorage.setItem('rz-cookie-consent', 'declined'); localStorage.setItem('theme', th); } catch (e) {} }, theme);
  await p.goto(BASE + page, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
  await new Promise((r) => setTimeout(r, 400));
  return p;
};
try {
  const bad2 = [], bad3 = [], bad5 = [];
  const contrast = () => {
    const rgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const bgOf = (e) => { for (let a = e; a; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
    const nav = document.querySelector('nav.rz-mtoc-rail'); if (!nav || nav.hidden) return [];
    const links = [...nav.querySelectorAll('a')]; if (links[2]) links[2].setAttribute('aria-current', 'true');
    const out = [];
    for (const e of [nav.querySelector('.rz-mtoc-cap'), ...links, ...nav.querySelectorAll('.rz-mtoc-num')]) {
      if (!e) continue; const fg = rgb(getComputedStyle(e).color), bg = bgOf(nav.parentElement);
      const a = lum(fg), b = lum(bg), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (k < 4.5) out.push(`${e.className || e.tagName.toLowerCase()} ${k.toFixed(2)}`);
    }
    return out;
  };
  for (const page of pages) {
    let p = await open(page, 1440);
    const r = await p.evaluate(() => {
      const nav = document.querySelector('nav.rz-mtoc-rail'); const main = document.querySelector('main.mn-wrap');
      const h2 = [...main.querySelectorAll('h2')].filter((h) => h.id !== 'contents-title' && !h.closest('nav'));
      if (!nav) return { err: 'no rail', h2: h2.length };
      const links = [...nav.querySelectorAll('a[href^="#"]')];
      const resolved = links.filter((a) => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))).length;
      const nr = nav.getBoundingClientRect(), cols = [...main.children].filter((c) => c !== nav && c.offsetHeight).map((c) => c.getBoundingClientRect());
      const left = Math.min(...cols.map((c) => c.left));
      return { h2: h2.length, links: links.length, resolved, gap: Math.round(left - nr.right), inView: nr.left >= 0 && nr.right <= innerWidth, visible: nr.width > 0 && getComputedStyle(nav).visibility !== 'hidden' };
    });
    if (r.err || r.links !== r.h2 || r.resolved !== r.links || r.gap < 8 || !r.inView || !r.visible) bad2.push(`${page.slice(7)} ${JSON.stringify(r)}`);
    const lowD = await p.evaluate(contrast); if (lowD.length) bad5.push(`${page.slice(7)} dark ${lowD.slice(0, 2).join(', ')}`);
    await p.close();
    p = await open(page, 1440, 900, 'light');
    const lowL = await p.evaluate(contrast); if (lowL.length) bad5.push(`${page.slice(7)} light ${lowL.slice(0, 2).join(', ')}`);
    await p.close();
    p = await open(page, 390);
    const m = await p.evaluate(() => ({ disc: !!document.querySelector('details.rz-mtoc-disc:not([open])') || !!document.querySelector('nav[aria-labelledby="contents-title"]'), ov: document.documentElement.scrollWidth - innerWidth }));
    if (!m.disc || m.ov > 0) bad3.push(`${page.slice(7)} ${JSON.stringify(m)}`);
    await p.close();
  }
  check(!bad2.length, `T2 1440: rail lists every content h2, all links resolve, beside the column — ${pages.length - bad2.length}/${pages.length}${bad2.length ? ' — ' + bad2.slice(0, 3).join(' | ') : ''}`);
  check(!bad3.length, `T3 390: collapsed contents, no horizontal scroll — ${pages.length - bad3.length}/${pages.length}${bad3.length ? ' — ' + bad3.slice(0, 3).join(' | ') : ''}`);
  check(!bad5.length, `T5 1440 light + dark: rail text meets AA on its background — ${pages.length * 2 - bad5.length}/${pages.length * 2}${bad5.length ? ' — ' + bad5.slice(0, 4).join(' | ') : ''}`);
  for (const page of ['manual/cx.html', 'manual/datahallai.html', 'manual/tco.html'].filter((x) => pages.includes(x))) {
    const p = await open(page, 1440);
    const t = await p.evaluate(async () => {
      const nav = document.querySelector('nav.rz-mtoc-rail'); if (!nav) return { err: 'no rail' };
      const links = [...nav.querySelectorAll('a')]; const bar = document.querySelector('.navbar'); const barB = bar ? bar.getBoundingClientRect().bottom : 0;
      const settle = async () => { let last = -1, same = 0; for (let i = 0; i < 80 && same < 4; i++) { await new Promise((r) => setTimeout(r, 100)); same = scrollY === last ? same + 1 : 0; last = scrollY; } };
      links[3].click(); await settle();
      const tgt = document.getElementById(decodeURIComponent(links[3].getAttribute('href').slice(1)));
      const h = (tgt.matches('h2') ? tgt : tgt.querySelector('h2') || tgt).getBoundingClientRect().top;
      const sec = document.getElementById(decodeURIComponent(links[4].getAttribute('href').slice(1)));
      window.scrollTo({ top: sec.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }); await settle(); await new Promise((r) => setTimeout(r, 200));
      return { landed: Math.round(h - barB), cur: links.findIndex((a) => a.getAttribute('aria-current') === 'true') };
    });
    check(!t.err && t.landed >= 0 && t.landed <= 64 && t.cur === 4, `T4 ${page.slice(7)}: link 4 lands its heading ${t.landed} px below the bar, section 5 marks link ${t.cur} current${t.err ? ' — ' + t.err : ''}`);
    await p.close();
  }
} finally { await browser.close(); server.close(); }
console.log(fail ? `FAIL — ${fail} check(s)` : `MANUAL CONTENTS — ${pages.length} long manuals carry a working "On this page" navigation`);
process.exit(fail ? 1 : 0);
