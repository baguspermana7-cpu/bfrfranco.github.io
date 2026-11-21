#!/usr/bin/env node
/**
 * audit-editorial-render.mjs — PRD-P22: does the RENDERED page use the design scale?
 *
 * Source audits (audit-vibecode) read CSS text; this reads computed styles after the cascade, at 1440 px, on every
 * published page (root + sitemap subfolders, the list audit-responsive-layout walks). Per visible element:
 *   font-size   (only elements that own a text node, so inheritance is counted once) — on a design.md type token
 *   margin / padding / gap (each side)                                   — on the 4 px grid, or a <= 2 px hairline
 *   border-radius (each corner)                    — 0, <= the 4 px instrument ceiling, a --rz-radius token, a circle,
 *                                                     a pill, or a % value
 * Skipped by rule (each has a fixture row): zero-size or hidden boxes, SVG internals, iframes, icon fonts, gap on a box
 * that is not flex/grid/multi-column, vertical margin on an inline box (neither moves anything).
 * Scale: data/design-scale.json (generated from design.md by tools/build-design-scale.mjs). Tolerance 0.5 px.
 *
 * The gate is a RATCHET: tools/editorial-render-ratchet.json holds each page's count; a count may only fall.
 *   node tools/audit-editorial-render.mjs                 compare to the ratchet (exit 1 on a rise or an unknown page)
 *   node tools/audit-editorial-render.mjs --measure       print counts + top 10 offenders per page, no verdict
 *   node tools/audit-editorial-render.mjs --page=x.html   one page (repeatable)
 *   node tools/audit-editorial-render.mjs --tighten       lower ratchet counts that fell (never raises one)
 *   a ratchet entry with mode 'kinds' (changelog.html) compares distinct off-scale kinds, not the total
 *   node tools/audit-editorial-render.mjs --add-new       record pages missing from the ratchet at their current count
 * Raising a count needs an `exemptions` entry in the ratchet with the owner's approval and a reason (PRD §12).
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = JSON.parse(readFileSync(join(ROOT, 'data/design-scale.json'), 'utf8'));
const RATCHET = join(ROOT, 'tools/editorial-render-ratchet.json');
const SKIP = /^(rz-|plan-|planb|google|404|sitemap|robots|llms|article-9-paper)/;

export function listPages() {
  const sm = join(ROOT, 'sitemap.xml');
  const sub = existsSync(sm)
    ? [...readFileSync(sm, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => { const p = m[1].trim().replace(/^https?:\/\/[^/]+\/?/, ''); return p.endsWith('/') ? p + 'index.html' : p; })
        .filter((p) => p.includes('/') && p.endsWith('.html') && existsSync(join(ROOT, p)) && !SKIP.test(p.split('/').pop()) && !/(^|\/)rz-/.test(p))
    : [];
  return [...new Set([...readdirSync(ROOT).filter((f) => f.endsWith('.html') && !SKIP.test(f)), ...sub])].sort();
}

/* In-page walker. Returns { font, space, radius, offenders: [[key, n]] }. Pure function of the DOM + scale. */
export function walkInPage(scale) {
  var tol = scale.tolerancePx, grid = scale.spacing.gridPx, hair = scale.spacing.hairlineMaxPx;
  var fonts = scale.fontSize.allowed, radii = scale.radius.tokens, ceil = scale.radius.instrumentCeilingPx;
  function near(v, list) { for (var i = 0; i < list.length; i++) if (Math.abs(v - list[i]) <= tol) return true; return false; }
  function onGrid(v) { v = Math.abs(v); if (v <= hair + tol) return true; var r = v % grid; return r <= tol || grid - r <= tol; }
  function radiusOk(raw, w, h) {
    if (/%/.test(raw)) return true;
    var v = parseFloat(raw); if (!isFinite(v) || v <= tol) return true;
    if (v <= ceil + tol || near(v, radii) || v >= 999) return true;
    return v >= Math.min(w, h) / 2 - tol;   /* a circle or a fully rounded end: shape, not decoration */
  }
  function iconish(el, cs) {
    var c = typeof el.className === 'string' ? el.className : '';
    return /(^|\s)(fa[srlbd]?|fa-[\w-]+|material-icons|icon[\w-]*)(\s|$)/.test(c) || /Font Awesome|Material Icons/i.test(cs.fontFamily);
  }
  function key(el) {
    var c = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + c;
  }
  var out = { font: 0, space: 0, radius: 0, offenders: {} };
  var kinds = {};
  /* kind = tag.classes prop:value WITHOUT the id: a log page (changelog.html) adds one id'd entry per release, and the
   * same off-scale rule repeated in a new entry is not a new defect */
  function kindKey(el) { var c = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; return el.tagName.toLowerCase() + c; }
  function hit(cat, el, prop, val) { out[cat]++; var k = key(el) + ' ' + prop + ':' + val; out.offenders[k] = (out.offenders[k] || 0) + 1; kinds[kindKey(el) + ' ' + prop + ':' + val] = 1; }
  var all = document.body ? document.body.getElementsByTagName('*') : [];
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.closest('svg') || el.tagName === 'IFRAME' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
    var r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (iconish(el, cs)) continue;
    var ownsText = false;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) { ownsText = true; break; }
    if (ownsText) { var fs = parseFloat(cs.fontSize); if (!near(fs, fonts)) hit('font', el, 'font-size', Math.round(fs * 100) / 100 + 'px'); }
    /* only values that move something: gap on a flex/grid/multi-column box, vertical margin on a non-inline box */
    /* the floating site bar (css/rz-nav-float.css) is a dated owner exception (ANTI_VIBECODE_STANDARD §B, 2026-11-18):
       its own 12 px radius, its top gap and its auto-centring margins are the exception, not drift (v3.86.1) */
    var siteBar = el.matches('.navbar[data-rz-bar], .navbar[data-rz-float]');
    var layoutBox = /flex|grid/.test(cs.display) || (cs.columnCount !== 'auto' && cs.columnCount !== '1');
    var inline = cs.display === 'inline';
    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap'].forEach(function (p) {
      if ((p === 'rowGap' || p === 'columnGap') && !layoutBox) return;
      if ((p === 'marginTop' || p === 'marginBottom') && inline) return;
      if (siteBar && p.indexOf('margin') === 0) return;
      var v = parseFloat(cs[p]); if (isFinite(v) && !onGrid(v)) hit('space', el, p, Math.round(v * 100) / 100 + 'px');
    });
    ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].forEach(function (p) {
      var raw = cs[p]; if (!siteBar && !radiusOk(raw, r.width, r.height)) hit('radius', el, p, raw);
    });
  }
  out.kinds = Object.keys(kinds).length;
  out.offenders = Object.keys(out.offenders).map(function (k) { return [k, out.offenders[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  return out;
}

export async function measurePage(browser, url, scale = SCALE) {
  const tab = await browser.newPage();
  try {
    await tab.setViewport({ width: SCALE.viewport, height: 900 });
    await tab.setRequestInterception(true);
    tab.on('request', (rq) => (rq.url().startsWith('file:') || rq.url().startsWith('data:') ? rq.continue() : rq.abort()));
    /* the clock is pinned to local noon of today: achievements.html unlocks "Night Owl" between 22:00 and 05:00 and
       its unlocked card adds 4 off-scale values, so the same tree passed at 20:00 and failed at 00:40 (v3.62.1) */
    await tab.evaluateOnNewDocument(() => {
      const D = Date, noon = new D(); noon.setHours(12, 0, 0, 0); const t0 = noon.getTime(), w0 = D.now();
      const now = () => t0 + (D.now() - w0);
      function P(...a) { return new.target ? (a.length ? new D(...a) : new D(now())) : new D(now()).toString(); }
      P.prototype = D.prototype; P.now = now; P.parse = D.parse; P.UTC = D.UTC;
      window.Date = P;
    });
    await tab.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    /* settle: the DOM a page builds in script must be there before it is counted (a fixed 300 ms let 3 of 278
     * pages differ between two runs) — wait until the element count holds for two 250 ms polls, at most 4 s */
    let last = -1, same = 0;
    for (let t = 0; t < 16 && same < 2; t++) {
      await new Promise((ok) => setTimeout(ok, 250));
      const n = await tab.evaluate(() => document.getElementsByTagName('*').length);
      same = n === last ? same + 1 : 0; last = n;
    }
    /* entrance animations would be sampled mid-flight (memory: a11y contrast flake) — finish them first */
    await tab.evaluate(() => { try { document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* infinite */ } }); } catch (e) { /* none */ } });
    return await tab.evaluate(walkInPage, scale);
  } finally { await tab.close(); }
}

/* A ratchet entry is compared by total, or — mode 'kinds', for a page whose content grows by design (changelog.html
 * gains an entry every release) — by the number of distinct off-scale kinds, so a release adds no rise while a NEW
 * off-scale rule still fails. Pure, so the fixture test can prove both modes without a browser. */
export function verdict(base, g, allow = 0) {
  const n = g.font + g.space + g.radius;
  if (base.mode === 'kinds') return { rise: g.kinds > base.kinds + allow, fell: g.kinds < base.kinds, was: base.kinds + ' kinds', now: g.kinds + ' kinds' };
  return { rise: n > base.total + allow, fell: n < base.total, was: String(base.total), now: String(n) };
}
function entry(base, g) {
  const n = g.font + g.space + g.radius, e = { total: n, font: g.font, space: g.space, radius: g.radius };
  return base && base.mode === 'kinds' ? Object.assign({ mode: 'kinds', kinds: g.kinds, reason: base.reason }, e) : e;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => a.startsWith('--page=')).map((a) => a.slice(7));
  const MEASURE = args.includes('--measure'), TIGHTEN = args.includes('--tighten'), ADD = args.includes('--add-new');
  const pages = only.length ? only : listPages();
  const ratchet = existsSync(RATCHET) ? JSON.parse(readFileSync(RATCHET, 'utf8')) : { pages: {}, exemptions: {} };
  const { default: puppeteer } = await import('puppeteer');
  const t0 = Date.now();
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const got = {}, unmeasured = [];
  try {
    for (const p of pages) {
      try { got[p] = await measurePage(browser, pathToFileURL(join(ROOT, p)).href); }
      catch (e) { unmeasured.push(p + ': ' + String(e.message || e).slice(0, 80)); }
    }
  } finally { await browser.close(); }
  const secs = Math.round((Date.now() - t0) / 1000);
  let rises = [], unknown = [], fell = 0, total = 0;
  for (const p of Object.keys(got)) {
    const g = got[p], n = g.font + g.space + g.radius; total += n;
    if (MEASURE) {
      console.log(p.padEnd(48) + ' total ' + String(n).padStart(5) + '  kinds ' + g.kinds + '  font ' + g.font + '  space ' + g.space + '  radius ' + g.radius);
      g.offenders.forEach(([k, c]) => console.log('      ' + String(c).padStart(4) + '  ' + k));
      continue;
    }
    const base = ratchet.pages[p];
    const allow = (ratchet.exemptions[p] && ratchet.exemptions[p].total) || 0;
    if (!base) { unknown.push(p + ' (' + n + ')'); if (ADD) ratchet.pages[p] = { total: n, font: g.font, space: g.space, radius: g.radius }; continue; }
    const v = verdict(base, g, allow);
    if (v.rise) rises.push(p + ': ' + v.was + ' -> ' + v.now + ' (' + g.offenders.slice(0, 3).map(([k]) => k).join(' | ') + ')');
    else if (v.fell) { fell++; if (TIGHTEN) ratchet.pages[p] = entry(base, g); }
  }
  if (MEASURE) { console.log('\n' + Object.keys(got).length + ' pages, ' + total + ' off-scale values, ' + secs + ' s' + (unmeasured.length ? '; UNMEASURED ' + unmeasured.join('; ') : '')); process.exit(unmeasured.length ? 1 : 0); }
  if (TIGHTEN || ADD) { writeFileSync(RATCHET, JSON.stringify(ratchet, null, 2) + '\n'); console.log('ratchet written' + (TIGHTEN ? ' (' + fell + ' page(s) lowered)' : '') + (ADD ? ' (' + unknown.length + ' page(s) added)' : '')); }
  const fail = rises.length || unmeasured.length || (unknown.length && !ADD);
  console.log('EDITORIAL RENDER SCALE — ' + Object.keys(got).length + ' pages, ' + total + ' off-scale values, ' + fell + ' page(s) below their ratchet, ' + secs + ' s');
  rises.forEach((r) => console.log('  ROSE   ' + r));
  if (!ADD) unknown.forEach((u) => console.log('  NEW    ' + u + ' — not in the ratchet; run node tools/audit-editorial-render.mjs --add-new --page=<page>'));
  unmeasured.forEach((u) => console.log('  UNMEASURED ' + u));
  console.log(fail ? 'FAIL' : 'PASS — no page rose above its ratchet');
  process.exit(fail ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
