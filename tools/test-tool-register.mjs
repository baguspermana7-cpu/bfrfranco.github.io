#!/usr/bin/env node
/**
 * test-tool-register — the hub calculators render on the TOOL register (css/rz-tool.css), checked on the
 * COMPUTED style of every element a visitor sees, in both themes, at 1440 and at a 390 px phone. Source scans passed rendered slop before
 * (CLAUDE.md "Rejected patterns" 16), so this reads the browser, not the files.
 *
 *   T0  every page in tools/apply-tool-register.py is wired (its --check exits 0)
 *   T1  no navy surface: background hue 200-250, s >= .25, l <= .22, larger than 2 % of the viewport
 *   T2  no second hue in chrome (buttons, links, chips, pills, tags, tabs, headings, labels):
 *       colour / background / border with s > .45 outside amber (20-45) and fault red
 *   T3  no glass (backdrop-filter), no gradient text, no gradient on a button / logo, no gradient surface > 1 % of the viewport
 *   T4  no coloured floating button (position:fixed, saturated, not amber)
 *   T5  no Fraunces (or any serif) in the computed font of h1/h2
 *   T6  no invisible text: own text with contrast < 1.6 against the first opaque background behind it
 *       (skipped over gradients and images). Caught white readouts on white panels in light mode.
 *   T7  no second hue anywhere outside instruments (own parse: alpha >= .05, so .12-tinted fills count):
 *       (a) ink colour (s > .45, .2 < l < .85) outside amber and fault red, where ink = own text, an icon
 *           (i, fa-*, a ::before glyph) or a form field; (b) any saturated fill (s > .45) outside amber and
 *           fault red, whatever its size; (c) a navy-band fill (T1's band and alpha > .25) > 400 px^2 (chips T1's 2 % misses).
 *       Caught tco's cyan/green KPI values, the cyan FREE MODE indicators and opex's rainbow progress bars.
 *       Proven red: 39 T7 failures on the round-1 tree; the hardened T7 (alpha, icons, independent branches)
 *       fails 40 page×theme×width checks on the round-2 tree (42 when (c) also read alpha .05 fills: slider tracks).
 *   T8  no second-hue border: any visible border side (width > 0, style not none/hidden) or outline whose colour
 *       (alpha >= .05) has s > .45 outside amber and fault red. Proven red: 29 T8 failures on the round-2c tree (hero intro boxes, cx hero rule, fire ok-KPI stripe, tia active type button).
 *   T9  readable text: T6's own text over its first opaque background (translucent ink composited) must reach
 *       4.5:1, or 3:1 at >= 24 px / >= 18.66 px bold; disabled fields skipped. Proven red: 46 T9 failures on the round-3 tree (light muted token, slate inline text, white-on-amber).
 *  Structural checks (the render, not the source) — added with the shell refit:
 *   T10 no stat-tile strip: >= 3 sibling boxes each holding a >= 1.1rem mono number outside [data-rz-fact-list]
 *   T11 no position:fixed element except the nav, .rz-toast*, .rz-sheet*
 *   T12 the page head (header / hero) carries no <img>, no background-image, no radius > 4 px, no badge / pill
 *   T13 the bar (.tool-bar, else the innermost container between head and first field holding >= 3 buttons/selects) has <= 6 controls (aria-pressed chips = 1 group); no FREE MODE / FULL ACCESS / PRO ACTIVE text pill anywhere
 *   T14 no second hue (red included) on labels, eyebrows, headings, crumbs; red only inside a .tool-results note cell,
 *       never on a fact-list value
 *   T15 no dashed/dotted border, no box-shadow, no `transition: all`, no :hover transform, radius <= 4 px on panels
 *   T16 one nav.hub-nav, one footer.hub-foot, no inline style in the footer, no other navbar / footer
 *   T19 chart series (Chart.js datasets, inline SVG >= 40 px) amber or neutral grey; opt-out [data-rz-series-meaning]
 *   T20 signed in (long account email) the page fits a 360 px phone: scrollWidth <= 360
 *   T21 every local stylesheet / script link carries ?v= (rz-tracker.js, untokened site-wide, excepted)
 *   T18 no logo tile (initials / icon in a filled or bordered box in the nav or beside a heading)
 *   T17 behaviour (dark 1440, once per page): every id the page JS targets (tools/extract-calc-ids.mjs) exists; each preset
 *       clicks without a page error; editing a numeric input changes the results region; the Free/Full toggle shows a full row.
 * Instruments are exempt: svg, canvas, img, video, figure, maps and [class*=chart|gauge|diagram|...].
 *
 * Proven red: on the tree before v3.24.26 it fails every page (pue navy 74 elements, tco 81, capex 71 ...).
 * Run:  node tools/test-tool-register.mjs [--page=x.html]
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { extractCalcIds } from './extract-calc-ids.mjs';
function headIds(pg) {
  const ref = pg.replace(/1\.html$/, '.html');
  try {
    const html = execFileSync('git', ['show', 'HEAD:' + ref], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
  } catch { return null; }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = (await import('puppeteer')).default;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const listSrc = readFileSync(join(ROOT, 'tools/apply-tool-register.py'), 'utf8');
const PAGES = [...listSrc.match(/PAGES = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+\.html)'/g)].map((m) => m[1]);
const only = (process.argv.find((a) => a.startsWith('--page=')) || '').slice(7);
const pages = only ? only.split(',') : PAGES;

let fail = 0;
const redBy = {};
const ok = (n, c, info) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : ' — ' + JSON.stringify(info))); if (!c) { fail++; const k = n.match(/^T\d+/); if (k) redBy[k[0]] = (redBy[k[0]] || 0) + 1; } };

for (const o of only ? only.split(',') : []) if (!PAGES.includes(o)) console.log('  - T0 skipped: ' + o + ' is a mockup, not a wired calculator page');
else try {
  execFileSync('python3', [join(ROOT, 'tools/apply-tool-register.py'), '--check'], { stdio: 'pipe' });
  ok(`T0 all ${PAGES.length} calculator pages declare the tool register and load css/rz-tool.css`, true);
} catch (e) {
  ok('T0 every calculator page is wired to the tool register', false, String(e.stdout).trim().split('\n').slice(-2));
}

const server = http.createServer((req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });

function scan() {
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
  const parse = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m && (m[4] === undefined || +m[4] > 0.25) ? hsl(+m[1], +m[2], +m[3]) : null; };
  const INSTR = 'svg, canvas, img, video, figure, .leaflet-container, [class*="chart"], [class*="gauge"], [class*="diagram"], [class*="sld"], [class*="schematic"], [class*="scope"], [class*="hmi"], [class*="mimic"], [class*="badge-status"], [class*="status-"]';
  const VA = innerWidth * innerHeight, o = { navy: [], hue: [], glass: [], gradText: [], gradSurf: [], fab: [], serif: [], invisible: [], hue7: [], border: [], unread: [] };
  const name = (e) => ((e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] + '<' + String(e.parentElement && e.parentElement.className).split(' ')[0]).slice(0, 48);
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest(INSTR)) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const bg = parse(cs.backgroundColor);
    if (bg && bg[0] >= 200 && bg[0] <= 250 && bg[1] >= .25 && bg[2] <= .22 && r.width * r.height > VA * 0.02) o.navy.push(name(e));
    if (cs.backdropFilter && cs.backdropFilter !== 'none') o.glass.push(name(e));
    if (/gradient/.test(cs.backgroundImage) && (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text')) o.gradText.push(name(e));
    const chrome = e.matches('button, a, [role=button], .btn, [class*="btn"], [class*="chip"], [class*="pill"], [class*="tag"], [class*="tab"], [class*="logo"], h1, h2, h3, h4, label');
    // a gradient fill on a button or logo is a second accent whatever its size (cx's teal Calculate button)
    if (!o.gradText.includes(name(e)) && /gradient/.test(cs.backgroundImage) && (chrome || r.width * r.height > VA * 0.01)) o.gradSurf.push(name(e));
    if (chrome) for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
      const c = parse(cs[prop]); if (!c) continue; const [h, s, l] = c;
      if (s > .45 && l > .2 && l < .85 && !(h >= 20 && h <= 45) && !(h >= 350 || h <= 10)) { o.hue.push(name(e) + ':' + prop.slice(0, 2) + ':' + Math.round(h)); break; }
    }
    // T7: every element, not just chrome — readout values, badges, icons, fields, bars and small navy chips
    {
      const p7 = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m && (m[4] === undefined || +m[4] >= 0.05) ? hsl(+m[1], +m[2], +m[3]) : null; };
      const pseudo = getComputedStyle(e, '::before').content;
      const ink = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        || e.matches('i, [class^="fa"], [class*=" fa-"], input, select, textarea') || (pseudo && pseudo !== 'none' && pseudo !== 'normal' && pseudo !== '""');
      const off = (h) => !(h >= 20 && h <= 45) && !(h >= 350 || h <= 10);
      const c = p7(cs.color), b7 = p7(cs.backgroundColor);
      if (ink && c && c[1] > .45 && c[2] > .2 && c[2] < .85 && off(c[0])) o.hue7.push(name(e) + ':co:' + Math.round(c[0]));
      if (b7 && b7[1] > .45 && off(b7[0])) o.hue7.push(name(e) + ':ba:' + Math.round(b7[0]));
      // (c) reads the shared parse (alpha > .25) like T1: a 14-24 % film of the near-black line token (#111827) on a light
      // panel composites to grey, not navy (opex/pue/tier/tia slider and bar tracks were false hits at alpha .05)
      if (bg && bg[0] >= 200 && bg[0] <= 250 && bg[1] >= .25 && bg[2] <= .22 && r.width * r.height > 400) o.hue7.push(name(e) + ':navy:' + Math.round(bg[0]));
    }
    // T8: a saturated border or outline is a second accent at any size (opex's green P50 tile border, teal selected cards)
    {
      const p8 = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m && (m[4] === undefined || +m[4] >= 0.05) ? hsl(+m[1], +m[2], +m[3]) : null; };
      const sat = (c) => c && c[1] > .45 && !(c[0] >= 20 && c[0] <= 45) && !(c[0] >= 350 || c[0] <= 10);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (!(parseFloat(cs['border' + side + 'Width']) > 0) || /^(none|hidden)$/.test(cs['border' + side + 'Style'])) continue;
        const c = p8(cs['border' + side + 'Color']); if (sat(c)) { o.border.push(name(e) + ':bo:' + Math.round(c[0])); break; }
      }
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) { const c = p8(cs.outlineColor); if (sat(c)) o.border.push(name(e) + ':ou:' + Math.round(c[0])); }
    }
    if (cs.position === 'fixed' && r.width < 220 && r.height < 120 && bg && bg[1] > .45 && !(bg[0] >= 20 && bg[0] <= 45)) o.fab.push(name(e) + ':' + Math.round(bg[0]));
    if (/^H[12]$/.test(e.tagName) && /fraunces|serif/i.test(cs.fontFamily.split(',')[0]) && !/sans/i.test(cs.fontFamily.split(',')[0])) o.serif.push(name(e) + ':' + cs.fontFamily.split(',')[0]);
    // T6: own text whose colour nearly equals the first opaque background behind it (a dark readout panel
    // flattened to white left its white numbers invisible on tco and capex in light mode)
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const fg = cs.color.match(/[\d.]+/g);
    if (own && fg && !(fg[3] !== undefined && +fg[3] < .3) && +cs.opacity > .3) {
      let bgc = null;
      for (let x = e; x; x = x.parentElement) {
        const v = getComputedStyle(x);
        if (v.backgroundImage !== 'none' && x !== document.body && x !== document.documentElement) { bgc = null; break; }
        const m = v.backgroundColor.match(/[\d.]+/g);
        if (m && (m[3] === undefined || +m[3] > .9)) { bgc = m; break; }
      }
      if (bgc) {
        const lum = (a) => { const [r, g, b] = a.slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
        const L1 = lum(fg), L2 = lum(bgc), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        if (ratio < 1.6) o.invisible.push(name(e) + ' "' + e.textContent.trim().slice(0, 20) + '" ' + ratio.toFixed(2));
        // T9: the same text must be readable — WCAG AA 4.5, or 3 for large text (>= 24 px, or >= 18.66 px bold).
        // Translucent ink is composited over its background first, so a 60 % white does not pass as white.
        const a = (fg[3] === undefined ? 1 : +fg[3]) * +cs.opacity, fs = parseFloat(cs.fontSize);
        const ink = fg.slice(0, 3).map((v, i) => +v * a + +bgc[i] * (1 - a)), Li = lum(ink);
        const r9 = (Math.max(Li, L2) + .05) / (Math.min(Li, L2) + .05), need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
        if (r9 < need && r.width > 1 && r.height > 1 && !e.matches(':disabled, [aria-disabled="true"]') && !e.closest('[aria-disabled="true"]'))
          o.unread.push(name(e) + ' "' + e.textContent.trim().slice(0, 20) + '" ' + r9.toFixed(2));
      }
    }
  }
  for (const k in o) o[k] = [...new Set(o[k])];
  return o;
}

function scan2() {
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
  const col = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m && (m[4] === undefined || +m[4] >= 0.05) ? { hsl: hsl(+m[1], +m[2], +m[3]), a: m[4] === undefined ? 1 : +m[4] } : null; };
  const INSTR = 'svg, canvas, img, video, figure, .fig, .leaflet-container, [class*="chart"], [class*="gauge"], [class*="diagram"], [class*="schematic"], [class*="scope"], [class*="hmi"], [class*="mimic"]';
  const nm = (e) => ((e.id ? '#' + e.id : '') + '.' + String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).split(' ')[0] + '<' + String(e.parentElement && e.parentElement.className).split(' ')[0]).slice(0, 44);
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const o = { tile: [], fixed: [], head: [], bar: [], hue: [], style: [], shell: [], logo: [] };
  const mono = (cs) => /mono|consolas|courier/i.test(cs.fontFamily);
  const all = [...document.querySelectorAll('body *')].filter((e) => !e.closest('script, style, noscript') && vis(e));

  // T10 stat-tile strips
  const holdsNumber = (box) => [...box.querySelectorAll('*')].some((d) => {
    if (d.closest('svg, canvas')) return false;
    const own = [...d.childNodes].some((n) => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!own) return false; const c = getComputedStyle(d);
    return mono(c) && parseFloat(c.fontSize) >= 17.6;
  });
  const seen = new Set();
  for (const e of all) {
    const par = e.parentElement; if (!par || seen.has(par) || par.closest('[data-rz-fact-list]') || par.closest('svg, canvas')) continue;
    seen.add(par);
    const kids = [...par.children].filter((k) => vis(k) && k.getBoundingClientRect().width > 60);
    if (kids.length < 3) continue;
    const boxes = kids.filter((k) => { const c = getComputedStyle(k); const bw = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(c['border' + s + 'Width']) > 0 && !/none|hidden/.test(c['border' + s + 'Style'])); return (bw || col(c.backgroundColor)) && holdsNumber(k); });
    if (boxes.length >= 3) o.tile.push(nm(par) + ' x' + boxes.length);
  }

  // T11 fixed elements
  for (const e of all) {
    if (getComputedStyle(e).position !== 'fixed') continue;
    if (e.closest('.hub-nav, nav, [class*="rz-toast"], [class*="rz-sheet"], .skip-link')) continue;
    o.fixed.push(nm(e));
  }

  // T12 page head
  const heads = [...document.querySelectorAll('header.tool-head, header:not(nav *):not(.hub-nav), [class*="hero"]:not(nav *)')].filter((h) => vis(h) && !h.closest('nav, footer, main section section'));
  const head = heads.slice(0, 3);
  for (const h of head) {
    for (const e of [h, ...h.querySelectorAll('*')]) {
      if (!vis(e)) continue; const c = getComputedStyle(e);
      if (e.tagName === 'IMG' || e.tagName === 'PICTURE') { o.head.push('img ' + nm(e)); continue; }
      if (c.backgroundImage !== 'none') o.head.push('bgimg ' + nm(e));
      const rads = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((s) => c['border' + s + 'Radius']);
      if (rads.some((v) => parseFloat(v) > 4 || /%/.test(v))) o.head.push('radius ' + nm(e) + ' ' + rads[0]);
      const framed = col(c.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(c['border' + s + 'Width']) > 0 && !/none|hidden/.test(c['border' + s + 'Style']));
      if (framed && e !== h && (rads.some((v) => parseFloat(v) >= 999) || (c.textTransform === 'uppercase' && mono(c) && e.textContent.trim().length < 30))) o.head.push('pill ' + nm(e));
    }
  }

  // T13 toolbar by COUNT: .tool-bar, else the innermost container after the page head and before the first field that holds >= 3
  // buttons / selects / button-links. aria-pressed chips count as one group. > 6 fails. Mode text pills fail anywhere.
  {
    const CTRL = 'button, a[role=button], select, a.btn, a[class*="btn"]';
    const firstField = [...document.querySelectorAll('main input:not([type=hidden]), main select, main textarea')].find((f) => vis(f) && !f.closest('nav, header, .hub-nav'));
    let bar = document.querySelector('.tool-bar');
    if (!bar) {
      const h0 = head[0];
      const cands = [...document.querySelectorAll('main div, main section, main ul, main nav, main form')].filter((c) => vis(c)
        && !c.closest('nav, footer, .hub-nav') && (!h0 || (h0.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING && !h0.contains(c)))
        && (!firstField || (!c.contains(firstField) && (c.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING)))
        && [...c.querySelectorAll(CTRL)].filter(vis).length >= 3);
      bar = cands.find((c) => !cands.some((d) => d !== c && c.contains(d))) || null;
    }
    if (bar) {
      const ctl = [...bar.querySelectorAll(CTRL)].filter(vis);
      const pressed = ctl.filter((c) => c.hasAttribute('aria-pressed') && !c.closest('.seg'));
      const n = ctl.length - pressed.length + (pressed.length ? 1 : 0);
      if (n > 6) o.bar.push(nm(bar) + ' holds ' + n + ' controls (' + ctl.length + ' elements)');
    }
    for (const e of all) { const t = [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim(); if (/FREE MODE|FULL ACCESS|PRO ACTIVE|PRO MODE/i.test(t) && t.length < 30) o.bar.push('pill "' + t + '" ' + nm(e)); }
  }

  // T14 second hue on labels
  const LAB = 'h1, h2, h3, h4, h5, h6, label, legend, th, summary, [class*="eyebrow"], [class*="kick"], [class*="label"], [class*="lbl"], [class*="crumb"], [class*="subtitle"], [class*="section-title"], [class*="group"] > span, [class*="eyebrow"] *';
  for (const e of all) {
    if (!e.matches(LAB) || e.closest(INSTR) || e.closest('.tool-results [class*="note"], .tool-results [class*="state"]')) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const c = col(getComputedStyle(e).color); if (!c) continue; const [h, s, l] = c.hsl;
    if (s > .45 && l > .15 && l < .9 && !(h >= 20 && h <= 45)) o.hue.push(nm(e) + ':' + Math.round(h));
  }
  // T14 also: a readout VALUE is never red; red is a state word in the note cell
  for (const e of document.querySelectorAll('[data-rz-fact-list] [class*="value"], [data-rz-fact-list] [class*="val"]')) {
    if (!vis(e) || e.closest('[class*="note"], [class*="state"]')) continue;
    const c = col(getComputedStyle(e).color); if (!c) continue; const [h, s, l] = c.hsl;
    if (s > .45 && l > .15 && l < .9 && (h <= 15 || h >= 345)) o.hue.push('red value ' + nm(e));
  }

  // T15 dashed / shadow / transition:all / hover transform / radius on panels
  for (const e of all) {
    if (e.closest('svg, canvas')) continue; const c = getComputedStyle(e);
    if (['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(c['border' + s + 'Width']) > 0 && /dashed|dotted/.test(c['border' + s + 'Style']))) o.style.push('dash ' + nm(e));
    if (c.boxShadow !== 'none' && !e.matches('input, select, textarea, button')) o.style.push('shadow ' + nm(e));
    if (c.transitionProperty === 'all' && parseFloat(c.transitionDuration) > 0) o.style.push('trans-all ' + nm(e));
    const r = e.getBoundingClientRect();
    if (r.width >= 120 && r.height >= 60 && !e.matches('input, select, textarea, button, nav, nav *') && !e.closest('.tool-bar, .hub-nav, .dropdown-menu, canvas')) {
      const framed = col(c.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(c['border' + s + 'Width']) > 0 && !/none|hidden/.test(c['border' + s + 'Style']));
      const rads = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((s) => c['border' + s + 'Radius']);
      if (framed && rads.some((v) => parseFloat(v) > 4 || /%/.test(v))) o.style.push('radius ' + nm(e) + ' ' + rads[0]);
    }
  }
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch (er) { continue; }
    const walk = (list) => { for (const r of list) {
      if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
      if (!r.selectorText || !/:hover/.test(r.selectorText) || !r.style) continue;
      const t = r.style.getPropertyValue('transform');
      if (!t || t === 'none' || /^translate[XY]?\(\s*0/.test(t)) continue;
      for (const part of r.selectorText.split(',')) {
        if (!/:hover/.test(part) || /\.chev|nav|dropdown/.test(part)) continue;
        let hit = null; try { hit = document.querySelector(part.replace(/:(hover|focus-visible|focus|active)/g, '').trim() || 'x'); } catch (er) {}
        if (hit && vis(hit)) { o.style.push('hover-transform ' + part.trim().slice(0, 50)); break; }
      }
    } };
    walk(rules);
  }

  // T16 shell
  const navs = document.querySelectorAll('nav.hub-nav, .hub-nav');
  if (navs.length !== 1) o.shell.push('hub-nav x' + navs.length);
  const other = [...document.querySelectorAll('.navbar:not(.hub-nav), nav.cx-nav, nav.rfs-navbar, .rfs-navbar, .cx-nav')].filter(vis);
  if (other.length) o.shell.push('foreign nav ' + other.map(nm).join(','));
  const foots = [...document.querySelectorAll('footer, .footer, .footer-enhanced')].filter(vis);
  if (!document.querySelector('footer.hub-foot')) o.shell.push('no footer.hub-foot');
  for (const f of foots) { if (!f.classList.contains('hub-foot') && !f.closest('.hub-foot')) o.shell.push('foreign footer ' + nm(f)); }
  const hf = document.querySelector('footer.hub-foot');
  if (hf && (hf.hasAttribute('style') || hf.querySelector('[style]'))) o.shell.push('inline style in footer');

  // T18 logo tile
  const tileBox = (e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect();
    if (r.width < 18 || r.width > 96 || r.height < 18 || r.height > 96) return false;
    const filled = /gradient/.test(c.backgroundImage) || col(c.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(c['border' + s + 'Width']) > 0 && !/none|hidden/.test(c['border' + s + 'Style']));
    return !!filled; };
  const onlyGlyph = (e) => { const t = e.textContent.trim(); if (t.length > 0 && t.length <= 3 && !e.querySelector('img, svg, i')) return true; return !t && !!e.querySelector('img, svg, i') ; };
  for (const e of document.querySelectorAll('nav a, nav div, nav span, .nav-logo, .nav-brand, [class*="logo"], [class*="brand"]')) {
    if (!vis(e) || e.matches('button, .nav-icon, .theme-toggle, .hamburger, .rz-nav-burger') || e.closest('button')) continue;
    if (tileBox(e) && onlyGlyph(e)) o.logo.push('nav tile ' + nm(e));
  }
  const heads2 = [...document.querySelectorAll('h1, h2, h3')].filter(vis);
  for (const e of all) {
    if (e.matches('button, a, input, select, nav *') || e.closest('nav, button, a')) continue;
    if (!tileBox(e) || !onlyGlyph(e)) continue; const r = e.getBoundingClientRect();
    for (const h of heads2) { const hr = h.getBoundingClientRect(); const side = r.right <= hr.left + 8 && r.right > hr.left - 40 && r.bottom > hr.top && r.top < hr.bottom; const above = r.bottom <= hr.top + 4 && r.bottom > hr.top - 28 && r.left < hr.right && r.right > hr.left; if (side || above) { o.logo.push('icon box before ' + h.tagName + ' ' + nm(e)); break; } }
  }
  for (const k in o) o[k] = [...new Set(o[k])];
  // T19 chart series: amber or neutral grey only. Canvas through the Chart.js registry, inline SVG shapes >= 40 px.
  // A series whose colour carries data meaning opts out with [data-rz-series-meaning] on its figure.
  o.series = [];
  const cx2 = document.createElement('canvas').getContext('2d');
  const toRgb = (v) => { if (typeof v !== 'string' || !v || v === 'none' || /url\(/.test(v)) return null; cx2.fillStyle = '#010203'; cx2.fillStyle = v; const f = cx2.fillStyle; if (f === '#010203' && !/^#010203$/i.test(v)) return null; const h = f.match(/^#([0-9a-f]{6})$/i); if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; } const r = f.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return r ? [+r[1], +r[2], +r[3], r[4] === undefined ? 1 : +r[4]] : null; };
  const offHue = (v) => { const c = toRgb(v); if (!c || c[3] < 0.15) return false; const [h, sat, l] = hsl(c[0], c[1], c[2]); if (sat < 0.30 || l < 0.1 || l > 0.94) return false; return !(h >= 28 && h <= 50); };
  const CH = window.Chart; const charts = CH ? (CH.instances ? Object.values(CH.instances) : []) : [];
  for (const ch of charts) {
    const cv = ch.canvas; if (!cv || !vis(cv) || cv.closest('[data-rz-series-meaning]')) continue;
    for (const ds of (ch.data && ch.data.datasets) || []) for (const k of ['borderColor', 'backgroundColor', 'pointBackgroundColor']) {
      const vals = Array.isArray(ds[k]) ? ds[k] : [ds[k]];
      const bad = vals.find(offHue); if (bad) { o.series.push('chart #' + (cv.id || '?') + ' ' + (ds.label || '').slice(0, 16) + ' ' + bad); break; }
    }
  }
  for (const sv of document.querySelectorAll('svg')) {
    const r = sv.getBoundingClientRect(); if (r.width < 40 || r.height < 40 || !vis(sv) || sv.closest('nav, .hub-nav, footer, .hub-foot, button, [data-rz-series-meaning]')) continue;
    for (const sh of sv.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse')) {
      const cs = getComputedStyle(sh); const bad = [cs.stroke, cs.fill].find(offHue);
      if (bad) { o.series.push('svg ' + nm(sv.parentElement || sv) + ' ' + bad); break; }
    }
  }
  o.series = [...new Set(o.series)];
  return o;
}

async function behaviour(pg) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 100)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon|supabase|CORS|ERR_|Content Security|integrity/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 100)); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', 'dark'); } catch (e) {} });
  try { await p.goto(base + pg, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) {}
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await new Promise((r) => setTimeout(r, 1200));
  const ex = extractCalcIds(pg, ROOT);
  const res = { missing: [], errs: [], presets: 0, changed: null, fullRow: null, idCount: ex.ids.length };
  // contract = ids the JS binds AND the page carried before the refit (git HEAD of the page; a mockup X1.html is held to
  // HEAD:X.html). Ids absent from HEAD belong to shared code for other pages (script.min.js contact form, cookie bar).
  const refIds = headIds(pg);
  res.missing = await p.evaluate((ids) => ids.filter((i) => !document.getElementById(i)), ex.ids.filter((i) => !ex.dynamic.includes(i) && (!refIds || refIds.has(i))));
  const region = () => p.evaluate(() => { const r = [...document.querySelectorAll('.tool-results')]; const els = r.length ? r : [...document.querySelectorAll('[class*="results"], [class*="kpi"], .metric-grid, [id*="esult"], [id$="Kpis"]')]; const list = els.length ? els : [document.querySelector('main') || document.body]; return list.map((e) => e.innerText).join('\n'); });
  const clickable = await p.evaluate(() => [...document.querySelectorAll('.preset-btn, [data-preset], .preset-chip')].map((b, i) => { b.setAttribute('data-t17', i); return i; }));
  for (const i of clickable) { try { await p.evaluate((i) => { const b = document.querySelector('[data-t17="' + i + '"]'); if (b && !b.disabled) b.click(); }, i); await new Promise((r) => setTimeout(r, 250)); res.presets++; } catch (e) { errs.push('click: ' + e.message.slice(0, 60)); } }
  // the FIRST numeric input inside the inputs region (never the nav) must drive the results; record which one and what moved
  const before = await region();
  const pick = () => { const root = document.querySelector('.tool-inputs, .input-panel, .calculator-grid, aside') || document.querySelector('main') || document.body; return [...root.querySelectorAll('input[type=number]')].find((e) => e.offsetParent && !e.disabled && !e.readOnly && !e.closest('nav')); };
  res.input = await p.evaluate(() => { const root = document.querySelector('.tool-inputs, .input-panel, .calculator-grid, aside') || document.querySelector('main') || document.body; const e = [...root.querySelectorAll('input[type=number]')].find((e) => e.offsetParent && !e.disabled && !e.readOnly && !e.closest('nav')); return e ? (e.id || e.name || 'input') + '=' + e.value : null; });
  res.changed = false;
  if (res.input) {
    await p.evaluate(() => { const root = document.querySelector('.tool-inputs, .input-panel, .calculator-grid, aside') || document.querySelector('main') || document.body; const e = [...root.querySelectorAll('input[type=number]')].find((e) => e.offsetParent && !e.disabled && !e.readOnly && !e.closest('nav')); const v = parseFloat(e.value) || 10; const mn = e.min !== '' ? +e.min : -1e9, mx = e.max !== '' ? +e.max : 1e9; let nv = Math.round(v * 1.37 * 100) / 100 + 1; if (nv > mx) nv = Math.max(mn, v * 0.7); e.value = String(nv); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 700));
    let after = await region();
    if (after === before) {
      res.viaButton = await p.evaluate(() => { const b = [...document.querySelectorAll('button, input[type=button]')].find((b) => b.offsetParent && /^\s*(calculate|compute|run|analy[sz]e|hitung)\b/i.test(b.textContent || b.value || '')); if (b) { b.click(); return (b.id || b.textContent.trim()).slice(0, 30); } return null; });
      if (res.viaButton) { await new Promise((r) => setTimeout(r, 900)); after = await region(); }
    }
    if (after !== before) { const bl = before.split('\n'), al = after.split('\n'); const i = al.findIndex((l, k) => l !== bl[k]); res.changed = true; res.moved = (bl[i] || '').slice(0, 30) + ' -> ' + (al[i] || '').slice(0, 30); }
  }
  // explain tooltips: hovering a trigger must open the panel. Runs on a clean page: before Free/Full (opens the login modal) and Save
  res.explain = null;
  // behavior:'instant' — the register sets scroll-behavior:smooth, so a plain scrollIntoView measures the rect
  // before the scroll lands and the mouse hovers empty space (false red on capex live + pue1)
  const trig = await p.evaluate(async () => { const t = [...document.querySelectorAll('.rzx-trigger')].find((e) => e.getClientRects().length); if (!t) return null; t.scrollIntoView({ block: 'center', behavior: 'instant' }); await new Promise((r) => setTimeout(r, 120)); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (trig) await p.mouse.move(1, 1);
  if (trig) { await p.mouse.move(trig.x, trig.y); await new Promise((r) => setTimeout(r, 900)); res.explain = await p.evaluate(() => { const pn = document.getElementById('rzExplainPanel'); return !!pn && pn.getBoundingClientRect().height > 0 && getComputedStyle(pn).visibility !== 'hidden' && getComputedStyle(pn).display !== 'none'; });
    if (!res.explain) res.explainTop = await p.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.tagName + '#' + e.id + '.' + String(e.className).split(' ')[0] + '<' + (e.parentElement && String(e.parentElement.className).split(' ')[0])).slice(0, 70) : 'none'; }, trig.x, trig.y); }
  // explain panel never covers its own trigger: on a 600 px viewport a tall panel fits neither below nor above a
  // mid-screen trigger; covering it steals the pointer and the panel closes again (rz-explain position() bug, 2026-11-01)
  res.explainCover = null;
  if (trig) {
    const vp = p.viewport();
    await p.setViewport({ ...vp, height: 600 });
    res.explainCover = await p.evaluate(async () => {
      const t = [...document.querySelectorAll('.rzx-trigger')].find((e) => e.getClientRects().length); if (!t) return null;
      t.scrollIntoView({ block: 'center', behavior: 'instant' }); await new Promise((r) => setTimeout(r, 120));
      t.blur(); t.focus(); await new Promise((r) => setTimeout(r, 200));
      const pn = document.getElementById('rzExplainPanel'); if (!pn || getComputedStyle(pn).display === 'none') return 'not open';
      const a = t.getBoundingClientRect(), b = pn.getBoundingClientRect();
      const ov = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) * Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      t.blur(); if (window.RZExplain) window.RZExplain.close();
      return ov > 0 ? 'covers ' + Math.round(ov) + ' px² (panel ' + Math.round(b.top) + '-' + Math.round(b.bottom) + ', trigger ' + Math.round(a.top) + ')' : 'clear';
    });
    await p.setViewport(vp);
  }
  const tog = await p.evaluate(() => !!document.querySelector('#btnProMode, [data-mode="pro"], .mode-btn[data-mode]'));
  if (tog) {
    await p.evaluate(() => { const b = document.querySelector('#btnProMode, [data-mode="pro"]'); if (b) b.click(); });
    await new Promise((r) => setTimeout(r, 500));
    res.fullRow = await p.evaluate(() => [...document.querySelectorAll('.tool-full, .pro-section, .pro-overlay')].some((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none'));
  }
  // account pill: the floating rz-scenario pill must be gone, its destination (account.html) reachable from the page, and the toolbar Save must do its job
  res.pill = await p.evaluate(() => !!document.getElementById('rzAccountPill'));
  res.accountLink = await p.evaluate(() => !![...document.querySelectorAll('a[href="account.html"]')].length);
  res.saveBtn = await p.evaluate(() => !!document.getElementById('btnSaveAccount'));
  res.shell = await p.evaluate(() => document.body.classList.contains('tool'));
  if (res.saveBtn) {
    const e0 = errs.length; const pages0 = (await browser.pages()).length;
    await p.evaluate(() => document.getElementById('btnSaveAccount').click());
    await new Promise((r) => setTimeout(r, 1500));
    res.saveMsg = await p.evaluate(() => { const m = document.getElementById('acctSaveMsg'); return m && m.textContent.trim() ? m.textContent.trim().slice(0, 60) : ''; });
    const opened = (await browser.pages()).filter((x) => /account\.html/.test(x.url())).length;
    res.saveOk = (!!res.saveMsg || opened > 0) && errs.length === e0;
    res.saveInfo = res.saveMsg || (opened ? 'opened account.html' : 'nothing happened');
  }
  res.errs = [...new Set(errs)];
  await ctx.close();
  return res;
}

for (const pg of pages) {
  { // T21 every local stylesheet / script carries a ?v= token, or a returning visitor keeps the old file
    const html = readFileSync(join(ROOT, pg), 'utf8');
    const bare = [...html.matchAll(/<(?:link[^>]+href|script[^>]+src)="(?!https?:|\/\/|data:)([^"?#]+\.(?:css|js))"/g)].map((m) => m[1]).filter((a) => a !== 'rz-tracker.js');
    ok(`T21 ${pg}: every local stylesheet and script is cache-tokened`, !bare.length, bare);
  }
  for (const [theme, w] of [['dark', 1440], ['light', 1440], ['dark', 390], ['light', 390]]) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
    await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); } catch (e) {} }, theme);
    try { await p.goto(base + pg, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) {}
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await new Promise((r) => setTimeout(r, 1200));
    // scrolled state: back-to-top buttons only exist after a scroll (cx's teal one hid from the resting scan)
    await p.evaluate(() => { window.scrollTo(0, 1500); window.dispatchEvent(new Event('scroll')); });
    await new Promise((r) => setTimeout(r, 400));
    const o = await p.evaluate(scan);
    await p.evaluate(() => window.scrollTo(0, 0)); await new Promise((r) => setTimeout(r, 300));
    const o2 = await p.evaluate(scan2);
    await ctx.close();
    const tag = `${pg} ${theme} ${w}`;
    ok(`T1 ${tag}: no navy surface`, !o.navy.length, o.navy.slice(0, 5));
    ok(`T2 ${tag}: one accent in chrome`, !o.hue.length, o.hue.slice(0, 5));
    ok(`T3 ${tag}: no glass / gradient text / gradient surface`, !o.glass.length && !o.gradText.length && !o.gradSurf.length, { glass: o.glass.slice(0, 3), gradText: o.gradText.slice(0, 3), gradSurf: o.gradSurf.slice(0, 3) });
    ok(`T4 ${tag}: no coloured floating button`, !o.fab.length, o.fab.slice(0, 3));
    ok(`T5 ${tag}: sans headings`, !o.serif.length, o.serif.slice(0, 3));
    ok(`T6 ${tag}: no invisible text (contrast >= 1.6 against its own background)`, !o.invisible.length, o.invisible.slice(0, 4));
    ok(`T7 ${tag}: no second hue in text, fills or small navy chips`, !o.hue7.length, o.hue7.slice(0, 6));
    ok(`T8 ${tag}: no second-hue border`, !o.border.length, o.border.slice(0, 6));
    ok(`T9 ${tag}: readable text (contrast >= 4.5)`, !o.unread.length, o.unread.slice(0, 6));
    ok(`T10 ${tag}: no stat-tile strip`, !o2.tile.length, o2.tile.slice(0, 4));
    ok(`T11 ${tag}: nothing fixed but nav / toast / sheet`, !o2.fixed.length, o2.fixed.slice(0, 4));
    ok(`T12 ${tag}: page head has no image, panel radius or pill`, !o2.head.length, o2.head.slice(0, 5));
    ok(`T13 ${tag}: .tool-bar <= 6 controls, no mode pills`, !o2.bar.length, o2.bar.slice(0, 4));
    ok(`T14 ${tag}: no second hue (red included) on labels`, !o2.hue.length, o2.hue.slice(0, 5));
    ok(`T15 ${tag}: no dashed border, shadow, transition:all, hover transform, big radius`, !o2.style.length, o2.style.slice(0, 5));
    ok(`T16 ${tag}: hub nav + hub footer, no inline style in footer`, !o2.shell.length, o2.shell.slice(0, 4));
    ok(`T18 ${tag}: no logo tile / icon box before a heading`, !o2.logo.length, o2.logo.slice(0, 4));
    ok(`T19 ${tag}: chart series amber or grey only`, !o2.series.length, o2.series.slice(0, 5));
  }
  const b = await behaviour(pg);
  ok(`T17 ${pg}: all ${b.idCount} JS-bound ids exist`, !b.missing.length, b.missing.slice(0, 8));
  ok(`T17 ${pg}: ${b.presets} preset click(s) and the inputs raise no console / page error`, !b.errs.length, b.errs.slice(0, 4));
  if (b.input === null) console.log(`  · T17 ${pg}: no numeric input (checklist) — input-drive check not applicable`);
  else ok(`T17 ${pg}: first numeric input ${b.input} changes the results region${b.viaButton ? ' (via ' + b.viaButton + ')' : ''}${b.moved ? ' [' + b.moved + ']' : ''}`, b.changed === true, { input: b.input });
  ok(`T17 ${pg}: Free/Full toggle shows the full row`, b.fullRow !== false, { fullRow: b.fullRow });
  if (b.saveBtn && b.shell) {
    ok(`T17 ${pg}: no floating account pill; account.html reachable from the page`, !b.pill && b.accountLink, { pill: b.pill, accountLink: b.accountLink });
    ok(`T17 ${pg}: toolbar Save does what the pill did (${b.saveInfo})`, b.saveOk === true, { saveInfo: b.saveInfo });
  }
  if (b.explain !== null) ok(`T17 ${pg}: hovering an explain trigger opens the panel`, b.explain === true, { explain: b.explain, top: b.explainTop });
  if (b.explainCover !== null) ok(`T17 ${pg}: the explain panel never covers its trigger (600 px viewport)`, b.explainCover === 'clear', { cover: b.explainCover });
  // T20 signed in on a phone: a long account email widened capex to 461 px and pushed the menu button off-screen
  {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'a.very.long.address@example.com', tier: 'pro', expires: Date.now() + 864e5 })); } catch (e) {} });
    try { await p.goto(base + pg, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) {}
    await new Promise((r) => setTimeout(r, 1200));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    await ctx.close();
    ok(`T20 ${pg}: signed in, the page fits a 360 px phone`, sw <= 360, { scrollWidth: sw });
  }
}
await browser.close();
server.close();
if (fail) console.log('RED BY CHECK: ' + Object.keys(redBy).sort((a, b) => a.slice(1) - b.slice(1)).map((k) => k + '=' + redBy[k]).join(' '));
console.log(fail ? `\n✗ TOOL REGISTER — ${fail} check(s) failed` : `\nTOOL REGISTER — all checks pass on ${pages.length} page(s) × 2 themes × 2 widths`);
process.exit(fail ? 1 : 0);
