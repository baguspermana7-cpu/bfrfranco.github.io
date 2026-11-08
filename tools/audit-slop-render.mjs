#!/usr/bin/env node
/**
 * audit-slop-render.mjs — every sitemap page, rendered in BOTH themes, scanned for the structural slop tells.
 *
 * Owner 2026-11-07: "kamu kan sudah audit semua page saya via robot agar nggak ada yang terlewat, ini kenapa masih
 * ada yang ai design slop sekali" (glossary.html: rails, pills, hover slide, blur, aurora). The earlier sweeps
 * recoloured pages and the structural gates covered only the journal and calculator families, so a page could be
 * on-palette and still carry every structural tell. Owner 2026-11-08 (PRD §41 K19): "pasti ada, saya nggak mau,
 * sempurnakan, saya tidak mau ada yang miss" — the dark-only, six-tell version passed index.html at 80 tells and the
 * hover lift on 40+ pages, so this version reads COMPUTED style in light AND dark and knows the rest of
 * standarization/ANTI_VIBECODE_STANDARD.md §A:
 *
 *   rail    coloured left/right stripe: one side border >= 2 px, the others <= 1 px, saturated colour, box >= 40 px tall
 *           (exempt only when the element itself carries a state class: ok/warn/fault/alarm/trip/run/stop/state-*)
 *   pill    rounded chip: radius >= 12 px on a box < 44 px tall that has a fill or border (badge/tag/pill); same state-class exemption
 *   round   rounded panel: radius > 8 px on a filled box >= 200 px wide
 *   blur    backdrop-filter other than none
 *   lift    a :hover rule that sets a transform (from the page's own stylesheets), on a selector the page matches
 *   grad    a gradient background on a box >= 120 x 40 (charts/canvas/img excluded)
 *   gtext   gradient text (background-clip: text with a gradient image)                        §A27
 *   tall    `transition: all` (computed transition-property "all" with a non-zero duration)     §A23
 *   shadow  a resting box-shadow (not inset, not a focus ring) on a filled box >= 160 px wide   §A11
 *   serif   a serif display face (Fraunces / Playfair / Georgia / …) on text >= 20 px           §A34
 *   navy    a navy surface: blue-hued (205–250°) saturated dark background on a box >= 200 x 80 §A33
 *   marquee a running keyword strip: animation named marquee/ticker/scroll on an overflow-hidden track §A30
 *   tiles   a stat-tile strip: >= 3 sibling filled boxes each led by a big numeral             §A28
 *   emoji   pictographic emoji in visible text outside code                                     §A5
 *
 *   node tools/audit-slop-render.mjs [--pages a.html,b.html] [--themes light,dark] [--json out.json] [--strict]
 * Env RZ_BASE (default http://127.0.0.1:8164). Report only (exit 0) unless --strict, which exits 1 when any page
 * carries a tell in either theme. Run under the shared browser lock (rz-lane).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.RZ_BASE || 'http://127.0.0.1:8164';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let puppeteer;
try { puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer'); }
catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }

const pages = arg('--pages') ? arg('--pages').split(',')
  : [...readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)]
    .map((m) => m[1] || 'index.html').map((p) => (p.endsWith('/') ? p + 'index.html' : p));
const themes = (arg('--themes') || 'light,dark').split(',');
export const KEYS = ['rail', 'pill', 'round', 'blur', 'lift', 'grad', 'gtext', 'tall', 'shadow', 'serif', 'navy', 'marquee', 'tiles', 'emoji'];

function scan(keys) {
  const rgb = (c) => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); if (!m) return null;
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] === undefined ? 1 : +m[4] }; };
  const sat = (c) => { const p = rgb(c); if (!p || p.a < 0.25) return 0; const mx = Math.max(p.r, p.g, p.b), mn = Math.min(p.r, p.g, p.b); return mx === 0 ? 0 : (mx - mn) / mx; };
  const hue = (c) => { const p = rgb(c); if (!p) return -1; const mx = Math.max(p.r, p.g, p.b), mn = Math.min(p.r, p.g, p.b), d = mx - mn; if (d < 1e-6) return -1;
    let h = mx === p.r ? ((p.g - p.b) / d) % 6 : mx === p.g ? (p.b - p.r) / d + 2 : (p.r - p.g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
  const light = (c) => { const p = rgb(c); return p ? (Math.max(p.r, p.g, p.b) + Math.min(p.r, p.g, p.b)) / 2 : 1; };
  const transparent = (c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c);
  // A 1 px offset with no blur and no spread is a drawn hairline (a sticky table column keeps its rule this way, since
  // collapsed borders scroll away with the cell), not a shadow. Every shadow in the list must be one.
  const hairline = (bs) => bs.split(/,(?![^(]*\))/).every((p) => { const n = (p.match(/-?\d+(?:\.\d+)?px/g) || []).map(parseFloat);
    return n.length >= 3 && Math.abs(n[0]) <= 1 && Math.abs(n[1]) <= 1 && n[2] === 0 && (n[3] || 0) === 0; });
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const inArt = (e) => e.closest('canvas,svg,figure,[data-rz-chart],.chart,.legend,code,pre,kbd,samp');
  // A circle (|w - h| <= 2 px and radius >= half the side, e.g. an ISA pump symbol) is not a pill: a pill is a capsule;
  // a 30x30 box with a 12 px radius is still counted.
  // A state rail or state chip is content, not decoration (IEC 62682 severity ramp): exempt ONLY when the element
  // ITSELF carries a state class from this fixed list — never by register or page. Agreed with the LTC session
  // 2026-11-08: `.cap-card.ok` and `#alarmStrip.state-warn` are exempt, a plain `.pump-unit` rail is still reported.
  const STATE_CLASS = /^(ok|warn|fault|alarm|trip|run|stop|state-[a-z0-9-]+)$/;
  const stateful = (e) => [...e.classList].some((k) => STATE_CLASS.test(k));
  // R079 (owner 2026-11-07, explicit request with a reference shot): the homepage nav is a link capsule and its
  // Contact/Correspondence buttons are pills. Exempt ONLY on the homepage and ONLY for the element that carries
  // data-rz-owner-shape itself; the same attribute anywhere else is still reported (tools/test-slop-precision.mjs).
  const ownerShape = (e) => e.hasAttribute('data-rz-owner-shape') && /\/(index\.html)?$/.test(location.pathname);
  const tileParents = new Set();
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') continue;
    const bl = parseFloat(c.borderLeftWidth), br = parseFloat(c.borderRightWidth), bt = parseFloat(c.borderTopWidth), bb = parseFloat(c.borderBottomWidth);
    const side = bl >= 2 && bt <= 1 && bb <= 1 && br <= 1 ? c.borderLeftColor : br >= 2 && bt <= 1 && bb <= 1 && bl <= 1 ? c.borderRightColor : null;
    if (side && sat(side) > 0.25 && r.height >= 40 && c.borderLeftStyle !== 'none' && !stateful(e)) out.rail.push(name(e));
    const rr = c.borderTopLeftRadius; const rad = /%/.test(rr) ? (parseFloat(rr) || 0) * Math.min(r.width, r.height) / 100 : (parseFloat(rr) || 0);
    const filled = !transparent(c.backgroundColor) || bt >= 1;
    if (rad >= 12 && r.height < 44 && filled && !(Math.abs(r.width - r.height) <= 2 && rad >= Math.min(r.width, r.height) / 2 - 0.5) && e.tagName !== 'INPUT' && !/toggle|switch|avatar|dot|knob|thumb/i.test(e.className) && !stateful(e) && !ownerShape(e)) out.pill.push(name(e));
    if (rad > 8 && r.width >= 200 && !transparent(c.backgroundColor) && !ownerShape(e)) out.round.push(name(e));
    if (c.backdropFilter && c.backdropFilter !== 'none') out.blur.push(name(e));
    const grad = /gradient/.test(c.backgroundImage);
    if (grad && r.width >= 120 && r.height >= 40 && !inArt(e)) out.grad.push(name(e));
    if (grad && /text/.test(c.webkitBackgroundClip || c.backgroundClip)) out.gtext.push(name(e));
    if (c.transitionProperty.split(',').some((p) => p.trim() === 'all') && c.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) out.tall.push(name(e));
    if (c.boxShadow !== 'none' && !/inset/.test(c.boxShadow) && r.width >= 160 && r.height >= 40 && !transparent(c.backgroundColor)
      && !(document.activeElement === e) && c.position !== 'fixed' && !e.closest('[role="dialog"],dialog,.modal,[class*="modal"],[class*="overlay"],[class*="dropdown"],[class*="popover"],[class*="tooltip"],[class*="toast"],[class*="sheet"]')
      && !/^(0px 0px 0px \d+(?:\.\d+)?px)/.test(c.boxShadow) && !hairline(c.boxShadow)) out.shadow.push(name(e));
    const fam = c.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (/fraunces|playfair|georgia|garamond|merriweather|lora|crimson|cormorant|libre baskerville|times/i.test(fam) && parseFloat(c.fontSize) >= 20 && e.textContent.trim()) out.serif.push(name(e));
    if (!transparent(c.backgroundColor) && r.width >= 200 && r.height >= 80 && !inArt(e)) { const h = hue(c.backgroundColor), s = sat(c.backgroundColor), l = light(c.backgroundColor); if (h >= 205 && h <= 250 && s >= 0.35 && l <= 0.3) out.navy.push(name(e)); }
    if (/marquee|ticker|scroll/i.test(c.animationName) && c.animationName !== 'none') { const t = e.parentElement; if (t && /hidden|clip/.test(getComputedStyle(t).overflowX)) out.marquee.push(name(e)); }
    if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{2712}\u{2719}-\u{27BF}\u{2B50}\u{2B55}]/u.test([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')) && !inArt(e)) out.emoji.push(name(e));
    // stat tiles: a parent whose >= 3 filled children each open with a big numeral
    const par = e.parentElement;
    if (par && !tileParents.has(par) && par.children.length >= 3 && par.children.length <= 8) {
      const kids = [...par.children].filter((k) => { const kr = k.getBoundingClientRect(), kc = getComputedStyle(k); return kr.width >= 100 && kr.width <= 560 && kr.height >= 60 && kr.height <= 420 && (!transparent(kc.backgroundColor) || parseFloat(kc.borderTopWidth) >= 1); });
      if (kids.length >= 3 && kids.length === par.children.length) {
        const led = kids.filter((k) => { const big = [...k.querySelectorAll('*')].find((x) => parseFloat(getComputedStyle(x).fontSize) >= 22 && /^[\s$€£+±~<>≈]*[\d][\d.,]*\s*[%+xkKMBmhWs]?/.test(x.textContent.trim())); return !!big; });
        if (led.length >= 3 && !par.closest('[data-rz-fact-list],table,[data-rz-register="cockpit"],.rz-metabar,[class*="result"],[id*="esult"]')) { tileParents.add(par); out.tiles.push(name(par)); }
      }
    }
  }
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; }
    const walk = (rs) => { for (const ru of rs) { if (ru.cssRules && !ru.selectorText) { walk(ru.cssRules); continue; }
      if (ru.selectorText && /:hover/.test(ru.selectorText) && ru.style && ru.style.transform && ru.style.transform !== 'none'
        && !/scale\(1\)|translate(?:X|Y)?\(0(?:px)?\)/.test(ru.style.transform)) {
        const sel = ru.selectorText.replace(/:hover/g, ''); try { if (document.querySelector(sel)) out.lift.push(ru.selectorText.slice(0, 50)); } catch {} } } };
    walk(rules);
  }
  const uniq = (a) => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((p, q) => q[1] - p[1]); };
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { n: v.length, top: uniq(v).slice(0, 4) }]));
}

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const report = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/robots.txt`);
  for (const theme of themes) {
    await page.evaluate((t) => { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); }, theme);
    for (const p of pages) {
      try {
        await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await new Promise((r) => setTimeout(r, 900));
        const r = await page.evaluate(scan, KEYS);
        const score = Object.values(r).reduce((s, v) => s + v.n, 0);
        report.push({ page: p, theme, score, ...r });
      } catch (err) { report.push({ page: p, theme, error: String(err.message).slice(0, 80) }); }
    }
  }
} finally { await browser.close(); }
report.sort((a, b) => (b.score || 0) - (a.score || 0));
console.log('page'.padEnd(44) + 'theme '.padEnd(6) + KEYS.map((k) => k.slice(0, 5).padStart(6)).join(''));
for (const r of report) {
  if (r.error) { console.log(r.page.padEnd(44) + r.theme.padEnd(6) + '  ERROR ' + r.error); continue; }
  if (!r.score) continue;
  console.log(r.page.slice(0, 43).padEnd(44) + r.theme.padEnd(6) + KEYS.map((k) => String(r[k].n).padStart(6)).join(''));
}
const totals = Object.fromEntries(KEYS.map((k) => [k, report.reduce((s, r) => s + (r[k] ? r[k].n : 0), 0)]));
const dirty = new Set(report.filter((r) => r.score || r.error).map((r) => r.page));
console.log(`\n${pages.length} pages × ${themes.length} theme(s) · ${pages.length - dirty.size} pages clean in every theme · ${dirty.size} with at least one tell or error`);
console.log('totals: ' + KEYS.map((k) => `${k} ${totals[k]}`).join(' · '));
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(report, null, 1));
if (process.argv.includes('--strict') && dirty.size) { console.log('FAIL — the owner judges the rendered page; every tell above is one he will find'); process.exit(1); }
