#!/usr/bin/env node
/**
 * test-index-depth.mjs — owner 2026-11-09 "Indexnya terlalu flat design" (R098 / peer K32), run on the rendered page.
 * Depth from legitimate means only (the owner rejected glass, aurora, glow, shadow tiles, hover lift):
 *  D1 tiers: the results and case-study sections sit on a band one step off the page base, operations on the base,
 *     and every panel in them (results panel, operations table, case card) one more step, framed by a 1 px hairline.
 *  D2 figures: every result with a scale carries a measured bar — fill = value, reference tick = its stated reference.
 *  D3 the case-study figures read as results: amber, never struck through or greyed (they were class stat-before).
 *  D4 operations: one table panel; no coloured badge, icon tile or tag chips; no hue but amber in the section.
 *  D5 section heads 02–07 (owner "sync"): a numbered mono eyebrow over a left-aligned title in every section after the hero.
 *  D7 60/30/10 (owner K33): the three bands (results, cases, contact) are the 30 % colour (a saturated blue), together 22–40 % of the page's
 *     height at 1440; every text on a band reaches WCAG AA against it (4.5:1, 3:1 at 24 px+); the 10 % accent = --dp-amber.
 *  D8 sync: no element on the page still paints the old amber (any colour, fill or drawn border) — the accent is one hue.
 *  D9 align (owner "yang paling align"): in every section the content block starts on the eyebrow's left edge (±2 px).
 *  D10 every text node in the three band sections, inside panels too, reaches WCAG AA against what it sits on.
 *  D11 motion (owner "animasi"): each bar grows from 0 to its value once, as the results panel enters view (600 ms
 *     strong ease-out, 60 ms row stagger); with reduced motion the bars are full from the start; without JS, full.
 *  D12 rhythm (owner "sync", peer audit): blue / base / blue / base / tier / blue — About sits on the page base (≤2) and FAQ on a
 *     real neutral tier (≥8 off the base, no blue cast), in both themes; no painted box inside them is a fake step (1–4 off its parent).
 *  D13 palette: inside the three band sections every saturated colour (text, icon fill/stroke, background) is the band blue or the
 *     accent — no stray cyan/sky link or icon colour (dark contact panel painted 56,189,248 and 96,165,250).
 *  D6 phone 390 (both themes): no sideways scroll; every bar inside its panel; no description clipped to an ellipsis. No page errors anywhere.
 * Env RZ_BASE (default http://127.0.0.1:8177).   node tools/test-index-depth.mjs
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = (process.env.RZ_BASE || 'http://127.0.0.1:8177') + '/index.html';
const puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer');
const SECS = ['metrics', 'operational-excellence', 'case-studies', 'about', 'faq', 'contact'];
const BANDS = ['metrics', 'case-studies', 'contact'];
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const open = async (w, theme) => {
  const p = await browser.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e).slice(0, 120)));
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900 });
  await p.goto(URL.replace('/index.html', '/robots.txt'));
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); }, theme);
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  for (const id of SECS) { await p.evaluate((i) => { const s = document.getElementById(i); if (s) s.scrollIntoView(); }, id); await new Promise((r) => setTimeout(r, 500)); }
  await new Promise((r) => setTimeout(r, 900));
  return p;
};

// Runs in the page: effective background, colour helpers.
const probe = ([SECS, BANDS]) => {
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > 0.5) return c.slice(0, 3); } return [255, 255, 255]; };
  const step = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const hairline = (el) => { const cs = getComputedStyle(el); return ['Top', 'Right', 'Bottom', 'Left'].every((s) => Math.round(parseFloat(cs['border' + s + 'Width'])) === 1 && cs['border' + s + 'Style'] !== 'none'); };
  const out = { base: bg(document.body) };
  const sec = Object.fromEntries(SECS.map((id) => [id, document.getElementById(id)]));
  out.band = Object.fromEntries(SECS.map((id) => [id, sec[id] ? bg(sec[id]) : null]));
  const panels = [['metrics', '.res-panel'], ['operational-excellence', '.oe-grid'], ['case-studies', '.case-card'], ['contact', '.contact-info, .contact-form']];
  out.panels = panels.map(([id, sel]) => { const els = [...(sec[id] ? sec[id].querySelectorAll(sel) : [])];
    return { id, sel, n: els.length, step: els.length ? Math.min(...els.map((e) => step(bg(e), out.band[id]))) : 0, hair: els.length > 0 && els.every(hairline) }; });
  out.stepBand = { metrics: step(out.band.metrics, out.base), cases: step(out.band['case-studies'], out.base), ops: step(out.band['operational-excellence'], out.base) };
  // D2
  out.bars = [...document.querySelectorAll('#metrics .res-bar[data-v]')].map((b) => { const t = b.getBoundingClientRect(), f = b.querySelector('.res-fill'), r = b.querySelector('.res-ref');
    return { v: +b.dataset.v, ref: b.dataset.ref === undefined ? null : +b.dataset.ref, fill: f ? f.getBoundingClientRect().width / t.width : -1,
      at: r ? (r.getBoundingClientRect().left + r.getBoundingClientRect().width / 2 - t.left) / t.width : null, refLabel: r ? (b.querySelector('.res-ref-label') || {}).textContent || '' : '' }; });
  out.rows = document.querySelectorAll('#metrics .res-row').length;
  // D3
  out.cases = [...document.querySelectorAll('#case-studies .case-stat > *')].map((e) => { const cs = getComputedStyle(e); return { t: e.textContent.trim(), deco: cs.textDecorationLine, color: rgb(cs.color) }; });
  // D4
  const ops = sec['operational-excellence'];
  out.opsJunk = ops ? ops.querySelectorAll('.oe-badge, .oe-icon-wrapper, .oe-tag, .oe-tags').length : -1;
  out.opsRows = ops ? ops.querySelectorAll('.oe-card').length : 0;
  out.opsHues = ops ? [...ops.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => rgb(getComputedStyle(e).color)).filter((c) => Math.max(...c) - Math.min(...c) > 60).map((c) => c.join(',')) : [];
  // D5
  out.heads = SECS.map((id) => { const s = sec[id]; const eb = s && s.querySelector('.sec-eyebrow'), h = s && s.querySelector('h2');
    return { id, eb: eb ? eb.textContent.trim() : '', ebMono: eb ? /mono/i.test(getComputedStyle(eb).fontFamily) : false, align: h ? getComputedStyle(h).textAlign : '',
      dx: eb && h ? Math.abs(eb.getBoundingClientRect().left - h.getBoundingClientRect().left) : 99 }; });
  // D6
  out.sw = document.documentElement.scrollWidth; out.vw = innerWidth;
  out.barsOut = [...document.querySelectorAll('#metrics .res-bar')].filter((b) => { const r = b.getBoundingClientRect(), pr = b.closest('.res-panel').getBoundingClientRect(); return r.left < pr.left - 0.5 || r.right > pr.right + 0.5; }).length;
  out.clipped = [...document.querySelectorAll('#operational-excellence .oe-desc, #metrics .metric-comparison')].filter((e) => e.scrollHeight > e.clientHeight + 1).length;
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  out.accent = rgb(getComputedStyle(document.documentElement).getPropertyValue('--dp-amber').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)})`));
  out.bandH = BANDS.reduce((a, id) => a + (sec[id] ? sec[id].offsetHeight : 0), 0) / document.documentElement.scrollHeight;
  out.bandHue = BANDS.map((id) => { const c = out.band[id]; return c[2] - Math.max(c[0], c[1]); });
  out.lowContrast = BANDS.flatMap((id) => [...sec[id].querySelectorAll('.sec-head *, .btn-explore-articles')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => { const cs = getComputedStyle(e), r = ratio(rgb(cs.color), bg(e)), big = parseFloat(cs.fontSize) >= 24; return { t: e.textContent.trim().slice(0, 24), r: +r.toFixed(2), need: big ? 3 : 4.5 }; }).filter((x) => x.r < x.need));
  const CONTENT = { metrics: '.res-panel', 'operational-excellence': '.oe-grid', 'case-studies': '.case-card', faq: '.faq-list', contact: '.contact-content' };
  out.align = Object.entries(CONTENT).map(([id, q]) => { const eb = sec[id] && sec[id].querySelector('.sec-eyebrow'), c = sec[id] && sec[id].querySelector(q);
    return { id, dx: eb && c ? Math.round(Math.abs(eb.getBoundingClientRect().left - c.getBoundingClientRect().left)) : 99 }; });
  out.bandText = BANDS.flatMap((id) => [...sec[id].querySelectorAll('*')].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => { const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize), big = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
      return { t: e.textContent.trim().slice(0, 20), r: +ratio(rgb(cs.color).slice(0, 3), bg(e)).toFixed(2), need: big ? 3 : 4.5 }; }).filter((x) => x.r < x.need));
  const OLD = ['232,181,99', '146,64,14', '122,72,0', '245,158,11', '251,191,36', '255,170,0'];
  out.oldAmber = [...document.querySelectorAll('body *')].flatMap((e) => { const cs = getComputedStyle(e);
    return ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'outlineColor'].map((k) => [k, rgb(cs[k]).slice(0, 3).join(',')])
      .filter(([k, c]) => OLD.includes(c) && !(k !== 'color' && k !== 'backgroundColor' && parseFloat(cs[k.replace('Color', 'Width')] || '0') === 0))
      .map(([k]) => (e.id || e.className || e.tagName).toString().slice(0, 30) + ':' + k); });
  // D12
  const own = (e) => { const c = rgb(getComputedStyle(e).backgroundColor); return (c.length === 3 || c[3] > 0.5) ? c.slice(0, 3) : null; };
  out.tier = Object.fromEntries(['about', 'faq'].map((id) => { const c = sec[id] ? bg(sec[id]) : [0, 0, 0];
    return [id, { step: step(c, out.base), cast: c[2] - Math.max(c[0], c[1]) }]; }));
  out.fakeStep = ['operational-excellence', 'about', 'faq'].flatMap((id) => [...(sec[id] ? sec[id].querySelectorAll('*') : [])]
    .filter((e) => e.getClientRects().length && own(e)).map((e) => ({ k: (e.className || e.tagName).toString().slice(0, 24), d: step(own(e), bg(e.parentElement)) }))
    .filter((x) => x.d > 0 && x.d < 5).map((x) => `${id} ${x.k} Δ${x.d}`));
  // D13
  const blue = out.band.metrics;
  out.strayHue = [...new Set(BANDS.flatMap((id) => [...sec[id].querySelectorAll('*')].filter((e) => e.getClientRects().length).flatMap((e) => { const cs = getComputedStyle(e);
    return ['color', 'fill', 'stroke', 'backgroundColor'].map((k) => [k, rgb(cs[k] || '')]).filter(([, c]) => c.length >= 3 && (c.length === 3 || c[3] > 0.3))
      .map(([k, c]) => [k, c.slice(0, 3)]).filter(([, c]) => Math.max(...c) - Math.min(...c) > 60 && step(c, out.accent) > 6 && step(c, blue) > 6)
      .map(([k, c]) => `${id} ${(e.className && e.className.baseVal !== undefined ? e.tagName : e.className || e.tagName).toString().slice(0, 20)} ${k} ${c.join(',')}`); })))];
  return out;
};

try {
  for (const theme of ['dark', 'light']) {
    const p = await open(1440, theme);
    const o = await p.evaluate(probe, [SECS, BANDS]);
    const T = `[${theme} 1440]`;
    check(o.stepBand.metrics >= 5 && o.stepBand.cases >= 5 && o.stepBand.ops <= 2,
      `D1 ${T} results + case bands one step off the base (≥5), operations on the base (≤2) — read ${o.stepBand.metrics}/${o.stepBand.cases}/${o.stepBand.ops}`);
    for (const q of o.panels) check(q.n > 0 && q.step >= 5 && q.hair, `D1 ${T} ${q.sel} in #${q.id}: ${q.n} panel(s), one step off the band (≥5, read ${q.step}), 1 px hairline ${q.hair}`);
    check(o.rows === 4, `D2 ${T} four result rows — read ${o.rows}`);
    const badBars = o.bars.filter((b) => Math.abs(b.fill - b.v) > 0.01 || (b.ref !== null && (b.at === null || Math.abs(b.at - b.ref) > 0.012 || !b.refLabel)));
    check(o.bars.length === 3 && badBars.length === 0, `D2 ${T} 3 measured bars: fill = value, tick = reference — ${o.bars.map((b) => `${b.v}:${b.fill.toFixed(3)}${b.ref !== null ? `@${b.ref}:${b.at === null ? '-' : b.at.toFixed(3)}` : ''}`).join(' ')}`);
    const amber = o.accent;
    const badCase = o.cases.filter((c) => c.deco.includes('line-through') || Math.max(...c.color.map((v, i) => Math.abs(v - amber[i]))) > 6);
    check(o.cases.length === 3 && badCase.length === 0, `D3 ${T} case figures amber, not struck — ${o.cases.map((c) => `${c.t}:${c.deco}:${c.color.join(',')}`).join(' | ')}`);
    check(o.opsJunk === 0 && o.opsRows === 8, `D4 ${T} operations: 8 rows, no badge/icon tile/tag chip — read rows ${o.opsRows}, junk ${o.opsJunk}`);
    const offHue = [...new Set(o.opsHues)].filter((c) => Math.max(...c.split(',').map((v, i) => Math.abs(+v - amber[i]))) > 6);
    check(offHue.length === 0, `D4 ${T} no hue but amber in operations${offHue.length ? ' — ' + offHue.slice(0, 4).join(' / ') : ''}`);
    for (const h of o.heads) check(/^0\d\b/.test(h.eb) && h.ebMono && h.align !== 'center' && h.dx <= 2, `D5 ${T} #${h.id}: eyebrow "${h.eb}" mono ${h.ebMono}, title ${h.align}, aligned Δ${Math.round(h.dx)}`);
    check(o.bandHue.every((d) => d >= 120) && o.bandH >= 0.22 && o.bandH <= 0.40, `D7 ${T} bands are the 30 % blue (blue lead ${o.bandHue.join('/')}), ${(o.bandH * 100).toFixed(1)} % of the page height`);
    check(o.lowContrast.length === 0, `D7 ${T} text on the bands reaches AA${o.lowContrast.length ? ' — ' + o.lowContrast.map((x) => `${x.t} ${x.r}<${x.need}`).join(' | ') : ''}`);
    check(o.bandText.length === 0, `D10 ${T} every text in the band sections (panels included) reaches AA${o.bandText.length ? ' — ' + o.bandText.length + ': ' + o.bandText.slice(0, 5).map((x) => `${x.t} ${x.r}`).join(' | ') : ''}`);
    const mis = o.align.filter((a) => a.dx > 2);
    check(mis.length === 0, `D9 ${T} every section's content starts on its eyebrow's left edge${mis.length ? ' — ' + mis.map((a) => `#${a.id} Δ${a.dx}`).join(' ') : ''}`);
    check(o.oldAmber.length === 0, `D8 ${T} one accent across the page: no element still paints the old amber${o.oldAmber.length ? ' — ' + o.oldAmber.length + ': ' + o.oldAmber.slice(0, 5).join(' | ') : ''}`);
    check(o.tier.about.step <= 2 && o.tier.faq.step >= 8 && o.tier.faq.cast <= 8,
      `D12 ${T} About on the base (≤2, read ${o.tier.about.step}), FAQ on a real neutral tier (≥8, read ${o.tier.faq.step}, blue cast ${o.tier.faq.cast} ≤8)`);
    check(o.fakeStep.length === 0, `D12 ${T} no fake step (1–4) painted inside operations/About/FAQ${o.fakeStep.length ? ' — ' + o.fakeStep.slice(0, 5).join(' | ') : ''}`);
    check(o.strayHue.length === 0, `D13 ${T} band sections use only the band blue and the accent${o.strayHue.length ? ' — ' + o.strayHue.length + ': ' + o.strayHue.slice(0, 5).join(' | ') : ''}`);
    check(p.errors.length === 0, `D6 ${T} no page errors${p.errors.length ? ' — ' + p.errors[0] : ''}`);
    await p.close();
    const q = await open(390, theme);
    const m = await q.evaluate(probe, [SECS, BANDS]);
    check(m.sw <= m.vw && m.barsOut === 0 && m.clipped === 0, `D6 [${theme} 390] no sideways scroll (${m.sw}/${m.vw}), bars inside their panel (out ${m.barsOut}), no clipped text (${m.clipped})`);
    check(q.errors.length === 0, `D6 [${theme} 390] no page errors${q.errors.length ? ' — ' + q.errors[0] : ''}`);
    await q.close();
  }

  // D11 motion: a bar grows to its value once, as the results panel enters view; reduced motion shows it full at once.
  for (const reduce of [false, true]) {
    const p = await browser.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
    await p.setViewport({ width: 1440, height: 900 });
    if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.goto(URL.replace('/index.html', '/robots.txt')); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('rz_cookie_consent', 'declined'); });
    await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise((r) => setTimeout(r, 600));
    const fills = () => p.evaluate(() => [...document.querySelectorAll('#metrics .res-bar[data-v]')].map((b) => +(b.querySelector('.res-fill').getBoundingClientRect().width / b.getBoundingClientRect().width).toFixed(3)));
    const before = await fills();
    await p.evaluate(() => document.querySelector('#metrics .res-panel').scrollIntoView({ block: 'center' }));
    if (!reduce) await p.waitForFunction(() => document.querySelector('#metrics .res-panel.res-in'), { timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 140));
    const mid = await fills();
    await new Promise((r) => setTimeout(r, 1200));
    const after = await fills();
    const want = await p.evaluate(() => [...document.querySelectorAll('#metrics .res-bar[data-v]')].map((b) => +b.dataset.v));
    const atValue = after.every((f, i) => Math.abs(f - want[i]) <= 0.01);
    if (!reduce) check(before.every((f) => f <= 0.02) && mid.some((f, i) => f > 0.02 && f < want[i] - 0.01) && atValue,
      `D11 bars grow on entering view: before ${before.join('/')} · 140 ms after entry ${mid.join('/')} · after ${after.join('/')}`);
    else check(before.every((f, i) => Math.abs(f - want[i]) <= 0.01) && atValue, `D11 reduced motion: bars full from the start ${before.join('/')}`);
    await p.close();
  }
} finally { await browser.close(); }
console.log(fail ? `FAIL — ${fail} law(s) broken` : 'PASS — the homepage has depth by tier, hairline and measured figure, not by effect');
process.exit(fail ? 1 : 0);
