#!/usr/bin/env node
/**
 * audit-render-register.mjs — WI-WEB-ALLPAGES-001 AC3: the register, read from the RENDER.
 *
 * A source sweep cannot see what the cascade paints (memory: "slop gate must read the render").
 * This loads every published page (sitemap.xml) in {light, dark} × {390, 1440} and counts, on
 * visible elements outside svg/canvas/iframe:
 *   navy-band   an opaque background in the navy cast (hue 205–240°, s ≥ 0.25, L ≤ 0.30) —
 *               graphite #0E0F12 / #16181D (s ≈ 0.13) is the register and does not match
 *   neon        text, background or border in saturated neon green (hue 100–165°, s ≥ 0.9, L ≥ 0.4)
 *   serif       chrome (h1–h4, nav, button, [class*=hero]) whose first computed family is a serif
 *   wash        a band (≥ 50 % of the viewport wide) painted by a gradient with a dark chromatic stop
 *               (alpha ≥ .3, s ≥ .35, L .08–.45) outside the amber accent (hue 20–55°) — the teal,
 *               green, red and blue hero washes the contact sheet showed in BOTH themes, which the
 *               navy and neon bands miss because they are dark and off-hue (WI-WEB-ALLPAGES-001 AC5);
 *               an element named like a data encoding (bar, gauge, fill, legend, scale …), a strip
 *               ≤ 16 px tall (a colour scale) and an inline bar fill (style width: N%) are exempt
 *
 * Out of scope (contract WI-WEB-ALLPAGES-001): the homepage without an approved mockup, LTC-owned
 * pages, paper documents, changelog.html, design artefacts. They are listed, not scanned.
 *
 *   node tools/audit-render-register.mjs [--strict] [--json] [--only REGEX] [--root DIR] [--list]
 */
import puppeteer from 'puppeteer';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const ROOT = opt('--root') || process.cwd();
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
const THEMES = ['light', 'dark'];
const WIDTHS = [390, 1440];

export const OUT_OF_SCOPE = [
  [/^index\.html$/, 'homepage: owner-approved mockup first'],
  [/^changelog\.html$/, 'historical record'],
  [/^article-9-paper\.html$/, 'paper document'],
  [/(^|\/)ltc-|^(capex|opex|tco|roi|pue)-calculator\.html$|^(carbon-footprint|cx-calculator|spares-readiness-calculator|tier-advisor|tia-942-checklist|fire-calculator|fire-checklist|rfs-readiness-workbench|pillar-fire-safety|standards-ltc-lab)\.html$|^manual\/(pillar-fire-safety|standards-ltc-lab|ltc-system-modelling-lab)\.html$/, 'LTC-owned page'],
  [/(^|\/)(rz-|plan-|planb)/, 'design artefact'],
];
const scopeReason = (p) => { for (const [re, why] of OUT_OF_SCOPE) if (re.test(p)) return why; return null; };

export function population(root) {
  const raw = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const paths = [...raw.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const p = m[1].trim().replace(/^https?:\/\/[^/]+\/?/, '');
    return p === '' ? 'index.html' : p.endsWith('/') ? p + 'index.html' : p;
  }).filter((p) => /\.html$/.test(p) && existsSync(join(root, p)));
  return [...new Set(paths)].sort();
}

/* Runs in the page. Pure function of the DOM, returned as plain data. */
function probe() {
  const rgb = (c) => { const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (!m) return null; return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a: m[4] === undefined ? 1 : +m[4] }; };
  const hsl = ({ r, g, b }) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; if (d < 1e-4) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l }; };
  const navy = (c) => { const x = rgb(c); if (!x || x.a < 0.5) return false; const { h, s, l } = hsl(x); return h >= 205 && h <= 240 && s >= 0.25 && l <= 0.30; };
  const neon = (c) => { const x = rgb(c); if (!x || x.a < 0.3) return false; const { h, s, l } = hsl(x); return h >= 100 && h <= 165 && s >= 0.9 && l >= 0.4 && l <= 0.7; };
  const wash = (c) => { const x = rgb(c); if (!x || x.a < 0.3) return false; const { h, s, l } = hsl(x); return s >= 0.35 && l >= 0.08 && l <= 0.45 && !(h >= 20 && h <= 55); };
  const DATA = /bar|gauge|fill|legend|scale|meter|track|progress|heat|spark|chart|slider/i; // data encodings, not chrome
  const SERIF = /^\s*["']?(serif|fraunces|georgia|times|playfair|merriweather|lora|dm serif|source serif|libre baskerville|cormorant|crimson|eb garamond|noto serif|pt serif)/i;
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const out = { navy: [], neon: [], serif: [], wash: [] };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg,canvas,iframe,script,style,noscript')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const bx = el.getBoundingClientRect(); if (bx.width < 2 || bx.height < 2) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (navy(cs.backgroundColor) || (/gradient/.test(cs.backgroundImage) && (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).some(navy))) out.navy.push(name(el));
    if ((ownText && neon(cs.color)) || neon(cs.backgroundColor) || ['Top', 'Bottom', 'Left', 'Right'].some((s) => parseFloat(cs['border' + s + 'Width']) > 0 && neon(cs['border' + s + 'Color']))) out.neon.push(name(el));
    if (bx.width >= innerWidth * 0.5 && bx.height > 16 && !/width:\s*[\d.]+%/.test(el.getAttribute('style') || '') && !DATA.test((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '')) && /gradient/.test(cs.backgroundImage) && (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).some(wash)) out.wash.push(name(el));
    if (ownText && el.matches('h1,h2,h3,h4,nav,nav *,button,[class*="hero"]') && SERIF.test(cs.fontFamily)) out.serif.push(name(el));
  }
  return out;
}

async function main() {
  const all = population(ROOT).filter((p) => !ONLY || ONLY.test(p));
  const scoped = all.filter((p) => !scopeReason(p));
  const skipped = all.filter((p) => scopeReason(p)).map((p) => ({ page: p, reason: scopeReason(p) }));
  if (flag('--list')) { console.log(`${scoped.length} in scope, ${skipped.length} out of scope`); for (const s of skipped) console.log(`  - ${s.page}: ${s.reason}`); return; }
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-audio-output'] });
  const rows = []; const errors = []; const deadToggles = new Set(); const singleTheme = new Set();
  for (const page of scoped) for (const theme of THEMES) for (const width of WIDTHS) {
    const p = await browser.newPage();
    try {
      await p.setViewport({ width, height: 900 });
      await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); localStorage.setItem('rz-theme', t); localStorage.setItem('cookieConsent', 'declined'); } catch (e) {} }, theme);
      await p.goto('file://' + join(ROOT, page), { waitUntil: 'load', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 500));
      const read = () => p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
      let got = await read();
      if (got !== theme) {
        /* storage did not reach this page's theme code: use the page's own control, as a reader would */
        const hasToggle = await p.evaluate(() => { const b = document.querySelector('#themeToggle, .theme-toggle'); if (!b) return false; b.click(); return true; });
        if (hasToggle) { await new Promise((r) => setTimeout(r, 300)); got = await read(); }
        if (got !== theme) {
          if (hasToggle) deadToggles.add(page); else singleTheme.add(`${page} (${got} only)`);
          await p.close(); continue;
        }
      }
      const r = await p.evaluate(probe);
      for (const kind of ['navy', 'neon', 'serif', 'wash']) if (r[kind].length) rows.push({ page, theme, width, kind, count: r[kind].length, sample: [...new Set(r[kind])].slice(0, 5) });
    } catch (e) { errors.push({ page, theme, width, error: String(e).slice(0, 120) }); }
    await p.close();
  }
  await browser.close();
  const total = (k) => rows.filter((r) => r.kind === k).reduce((a, r) => a + r.count, 0);
  const summary = { pages: scoped.length, loads: scoped.length * THEMES.length * WIDTHS.length, navy: total('navy'), neon: total('neon'), serif: total('serif'), wash: total('wash'), errors: errors.length, deadToggles: deadToggles.size, singleTheme: singleTheme.size, outOfScope: skipped.length };
  if (flag('--json')) console.log(JSON.stringify({ summary, rows, errors, deadToggles: [...deadToggles], singleTheme: [...singleTheme], skipped }, null, 1));
  else {
    for (const r of rows) console.log(`  ✗ ${r.kind.padEnd(5)} ${r.page} ${r.theme}@${r.width}: ${r.count} — ${r.sample.join(', ')}`);
    for (const e of errors) console.log(`  ! ${e.page} ${e.theme}@${e.width}: ${e.error}`);
    for (const d of deadToggles) console.log(`  ✗ dead theme toggle: ${d} — the button is there, the theme does not change`);
    console.log(`── ${summary.pages} pages × ${THEMES.length} themes × ${WIDTHS.length} widths = ${summary.loads} renders · navy ${summary.navy} · neon ${summary.neon} · serif ${summary.serif} · wash ${summary.wash} · errors ${summary.errors} · dead toggles ${summary.deadToggles} · single-theme ${summary.singleTheme} · out of scope ${summary.outOfScope}`);
  }
  if (flag('--strict') && (summary.navy || summary.neon || summary.serif || summary.wash || summary.errors || summary.deadToggles)) process.exit(1);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
