#!/usr/bin/env node
/**
 * test-index-depth.mjs — owner 2026-11-09 "Indexnya terlalu flat design" (R098 / peer K32), run on the rendered page.
 * Depth from legitimate means only (the owner rejected glass, aurora, glow, shadow tiles, hover lift):
 *  D1 tiers: the results and case-study sections sit on a band one step off the page base, operations on the base,
 *     and every panel in them (results panel, operations table, case card) one more step, framed by a 1 px hairline.
 *  D2 figures: every result with a scale carries a measured bar — fill = value, reference tick = its stated reference.
 *  D3 (R119, owner approved 2026-11-12, replaces the law below where they differ: one page field, ink figures, blue only as light/bars, accent as the 10 %) the case-study figures read as results: amber, never struck through or greyed (they were class stat-before).
 *  D4 operations: one table panel; no coloured badge, icon tile or tag chips; no hue but amber in the section.
 *  D5 section heads 02–07 (owner "sync"): a numbered mono eyebrow over a left-aligned title in every section after the hero.
 *  D7 (R119, owner approved 2026-11-12, replaces the law below where they differ: one page field, ink figures, blue only as light/bars, accent as the 10 %) 60/30/10, R101 (owner 2026-11-09 "aneh birunya kyk nggk nyambung dg theme"; "contoh2 kn sdah saya kasih"): as in the
 *     owner's echo reference, blue is LIGHT, never a flat band — the results, cases and contact sections sit on the page base
 *     (≤2), a blue radial halo layer sits behind each, every panel there carries a blue rim on its top edge, at least two
 *     result bars and one title word are blue; every text there reaches WCAG AA (4.5:1, 3:1 at 24 px+); the 10 % = --dp-amber.
 *  D8 sync: no element on the page still paints the old amber (any colour, fill or drawn border) — the accent is one hue.
 *  D9 align (owner "yang paling align"): in every section the content block starts on the eyebrow's left edge (±2 px).
 *  D10 every text node in the three band sections, inside panels too, reaches WCAG AA against what it sits on.
 *  D11 motion (owner "animasi"): each bar grows from 0 to its value once, as the results panel enters view (600 ms
 *     strong ease-out, 60 ms row stagger); with reduced motion the bars are full from the start; without JS, full.
 *  D12 (R119, owner approved 2026-11-12, replaces the law below where they differ: one page field, ink figures, blue only as light/bars, accent as the 10 %) rhythm (owner "sync", peer audit): blue / base / blue / base / tier / blue — About sits on the page base (≤2) and FAQ on a
 *     real neutral tier (≥8 off the base, no blue cast), in both themes; no painted box inside them is a fake step (1–4 off its parent).
 *  D13 palette: inside the three band sections every saturated colour (text, icon fill/stroke, background) is the blue
 *     family (hue 218–232°) or the accent — no stray cyan/sky link or icon colour (dark contact panel painted 56,189,248).
 *  D14 entrance (owner R103 "animasi motionnya sangat2 kurang payah"): every section that starts below the fold is armed;
 *     before it enters, its content is hidden; within 1.8 s of entering, every item is shown, the eyebrow rule is drawn
 *     and the blue light is on; the title passes through a blur (a sharpen-in, not a plain fade); reduced motion arms nothing.
 *  D15 contrast stays measurable (R105; axe gives up — "pseudoContent", filed incomplete, never failed — when any ancestor's
 *     ::before/::after covers > 25 % of a text box, and on a gradient behind the text): a planted low-contrast line in every
 *     lit panel (results, each case, contact info, contact form) is a color-contrast VIOLATION in axe, both themes.
 *  D16 (R119, owner approved 2026-11-12, replaces the law below where they differ: one page field, ink figures, blue only as light/bars, accent as the 10 %) the light is a scene (and the first result row keeps the accent figure and bar — a sheen first child once broke :first-child) (owner R105 "Mainkan gradien. Yg sangat cantik"): each band's light layer is a real element
 *     (.dp-light, aria-hidden) with >= 3 radial sources — a blue key, a second deep source and a warm orange counter-light —
 *     plus a grain layer; every lit panel catches it on a top-edge sheen (.dp-sheen) that is brightest toward the middle.
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
    return { id, sel, n: els.length, step: els.length ? Math.min(...els.map((e) => step(bg(e), out.band[id]))) : 0, hair: els.length > 0 && els.every(hairline),
      rim: els.length > 0 && els.every((e) => { const c = rgb(getComputedStyle(e).borderTopColor); return c[2] - Math.max(c[0], c[1]) >= 60; }) }; });
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
  out.halo = BANDS.map((id) => { const L = sec[id].querySelector(':scope > .dp-light'); const g = L ? getComputedStyle(L).backgroundImage : 'none'; const m = g.match(/rgba?\(([^)]+)\)/); const c = m ? m[1].split(',').map(Number) : [0, 0, 0];
    return /radial-gradient/.test(g) && c[2] - Math.max(c[0], c[1]) >= 120; });
  const isBlue = (c) => c[2] - Math.max(c[0], c[1]) >= 80;
  out.blueBars = [...document.querySelectorAll('#metrics .res-fill')].filter((f) => { const m = getComputedStyle(f).backgroundImage.match(/rgba?\(([^)]+)\)\)?$/) || getComputedStyle(f).backgroundImage.match(/rgba?\(([^)]+)\)/g);
    const all = (getComputedStyle(f).backgroundImage.match(/rgba?\([^)]+\)/g) || [getComputedStyle(f).backgroundColor]).map(rgb); return all.some(isBlue); }).length;
  out.blueWord = [...document.querySelectorAll('.dp-hl')].filter((e) => isBlue(rgb(getComputedStyle(e).color))).length;
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
  const hue = (c) => { const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round(((h * 60) + 360) % 360); };
  out.strayHue = [...new Set(BANDS.flatMap((id) => [...sec[id].querySelectorAll('*')].filter((e) => e.getClientRects().length).flatMap((e) => { const cs = getComputedStyle(e);
    return ['color', 'fill', 'stroke', 'backgroundColor'].map((k) => [k, rgb(cs[k] || '')]).filter(([, c]) => c.length >= 3 && (c.length === 3 || c[3] > 0.3))
      .map(([k, c]) => [k, c.slice(0, 3)]).filter(([, c]) => Math.max(...c) - Math.min(...c) > 60 && step(c, out.accent) > 6 && !(hue(c) >= 218 && hue(c) <= 232))
      .map(([k, c]) => `${id} ${(e.className && e.className.baseVal !== undefined ? e.tagName : e.className || e.tagName).toString().slice(0, 20)} ${k} ${c.join(',')}`); })))];
  return out;
};

try {
  for (const theme of ['dark', 'light']) {
    const p = await open(1440, theme);
    const o = await p.evaluate(probe, [SECS, BANDS]);
    const T = `[${theme} 1440]`;
    check(o.stepBand.metrics <= 2 && o.stepBand.cases <= 2 && o.stepBand.ops <= 2,
      `D1 ${T} results, cases and operations on the page base (≤2) — read ${o.stepBand.metrics}/${o.stepBand.cases}/${o.stepBand.ops}`);
    for (const q of o.panels) check(q.n > 0 && q.hair && (q.step >= 5 || q.rim), `D1 ${T} ${q.sel} in #${q.id}: ${q.n} panel(s), framed by a 1 px hairline and set off by a tier (${q.step}) or the blue rim (${q.rim})`);
    check(o.rows === 4, `D2 ${T} four result rows — read ${o.rows}`);
    const badBars = o.bars.filter((b) => Math.abs(b.fill - b.v) > 0.01 || (b.ref !== null && (b.at === null || Math.abs(b.at - b.ref) > 0.012 || !b.refLabel)));
    check(o.bars.length === 3 && badBars.length === 0, `D2 ${T} 3 measured bars: fill = value, tick = reference — ${o.bars.map((b) => `${b.v}:${b.fill.toFixed(3)}${b.ref !== null ? `@${b.ref}:${b.at === null ? '-' : b.at.toFixed(3)}` : ''}`).join(' ')}`);
    const amber = o.accent;
    /* R119 (owner approved 2026-11-12): the case figures read in ink; the accent is the 10 %, not every figure. */
    const badCase = o.cases.filter((c) => c.deco.includes('line-through') || Math.max(...c.color.map((v, i) => Math.abs(v - amber[i]))) <= 6);
    check(o.cases.length === 3 && badCase.length === 0, `D3 ${T} case figures in ink (R119: not the accent), not struck — ${o.cases.map((c) => `${c.t}:${c.deco}:${c.color.join(',')}`).join(' | ')}`);
    check(o.opsJunk === 0 && o.opsRows === 8, `D4 ${T} operations: 8 rows, no badge/icon tile/tag chip — read rows ${o.opsRows}, junk ${o.opsJunk}`);
    const offHue = [...new Set(o.opsHues)].filter((c) => Math.max(...c.split(',').map((v, i) => Math.abs(+v - amber[i]))) > 6);
    check(offHue.length === 0, `D4 ${T} no hue but amber in operations${offHue.length ? ' — ' + offHue.slice(0, 4).join(' / ') : ''}`);
    for (const h of o.heads) check(/^0\d\b/.test(h.eb) && h.ebMono && h.align !== 'center' && h.dx <= 2, `D5 ${T} #${h.id}: eyebrow "${h.eb}" mono ${h.ebMono}, title ${h.align}, aligned Δ${Math.round(h.dx)}`);
    check(o.bandHue.every((d) => d < 30) && o.halo.every(Boolean), `D7 ${T} blue is light, not a band: section grounds carry no blue (lead ${o.bandHue.join('/')}), a blue halo sits behind each (${o.halo.join('/')})`);
    check(o.blueBars >= 2 && o.blueWord === 0, `D7 ${T} blue on the data, never on a title word (R119: blue is light on objects): ${o.blueBars} blue bar(s), ${o.blueWord} blue word(s)`);
    check(o.lowContrast.length === 0, `D7 ${T} text on the bands reaches AA${o.lowContrast.length ? ' — ' + o.lowContrast.map((x) => `${x.t} ${x.r}<${x.need}`).join(' | ') : ''}`);
    check(o.bandText.length === 0, `D10 ${T} every text in the band sections (panels included) reaches AA${o.bandText.length ? ' — ' + o.bandText.length + ': ' + o.bandText.slice(0, 5).map((x) => `${x.t} ${x.r}`).join(' | ') : ''}`);
    const mis = o.align.filter((a) => a.dx > 2);
    check(mis.length === 0, `D9 ${T} every section's content starts on its eyebrow's left edge${mis.length ? ' — ' + mis.map((a) => `#${a.id} Δ${a.dx}`).join(' ') : ''}`);
    check(o.oldAmber.length === 0, `D8 ${T} one accent across the page: no element still paints the old amber${o.oldAmber.length ? ' — ' + o.oldAmber.length + ': ' + o.oldAmber.slice(0, 5).join(' | ') : ''}`);
    check(o.tier.about.step <= 2 && o.tier.faq.step <= 2,
      `D12 ${T} one page field (R119): About and FAQ paint no ground of their own (≤2, read ${o.tier.about.step} / ${o.tier.faq.step})`);
    check(o.fakeStep.length === 0, `D12 ${T} no fake step (1–4) painted inside operations/About/FAQ${o.fakeStep.length ? ' — ' + o.fakeStep.slice(0, 5).join(' | ') : ''}`);
    check(o.strayHue.length === 0, `D13 ${T} band sections use only the blue family and the accent${o.strayHue.length ? ' — ' + o.strayHue.length + ': ' + o.strayHue.slice(0, 5).join(' | ') : ''}`);
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
    // every frame for 900 ms (a fixed 140 ms sample flaked under a loaded gate): keep the most in-between frame
    const mid = await p.evaluate(() => new Promise((done) => { const bars = [...document.querySelectorAll('#metrics .res-bar[data-v]')], t0 = performance.now(); let best = bars.map(() => 0), score = -1;
      const tick = () => { const f = bars.map((b) => +(b.querySelector('.res-fill').getBoundingClientRect().width / b.getBoundingClientRect().width).toFixed(3));
        const sc = f.filter((x, i) => x > 0.02 && x < +bars[i].dataset.v - 0.01).length; if (sc > score) { score = sc; best = f; }
        if (performance.now() - t0 < 900) requestAnimationFrame(tick); else done(best); }; requestAnimationFrame(tick); }));
    await new Promise((r) => setTimeout(r, 1200));
    const after = await fills();
    const want = await p.evaluate(() => [...document.querySelectorAll('#metrics .res-bar[data-v]')].map((b) => +b.dataset.v));
    const atValue = after.every((f, i) => Math.abs(f - want[i]) <= 0.01);
    if (!reduce) check(before.every((f) => f <= 0.02) && mid.some((f, i) => f > 0.02 && f < want[i] - 0.01) && atValue,
      `D11 bars grow on entering view: before ${before.join('/')} · in flight ${mid.join('/')} · after ${after.join('/')}`);
    else check(before.every((f, i) => Math.abs(f - want[i]) <= 0.01) && atValue, `D11 reduced motion: bars full from the start ${before.join('/')}`);
    await p.close();
  }
  // D15 + D16 (R105): contrast stays measurable under the light; the light is a three-source scene.
  const AXE = (await import('node:fs')).readFileSync(resolve(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
  for (const theme of ['light', 'dark']) {
    const p = await open(1440, theme);
    const planted = await p.evaluate((t) => {
      let n = 0; for (const sel of document.querySelectorAll('#metrics .res-panel, #case-studies .case-card, #contact .contact-info, #contact .contact-form')) {
        const q = document.createElement('p'); q.className = 'd15-plant'; q.textContent = 'planted low contrast line'; q.style.cssText = 'font-size:14px;margin:8px 0'; q.style.setProperty('color', t === 'dark' ? '#33363c' : '#d8d8d8', 'important'); sel.appendChild(q); n++; }
      return n; }, theme);
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => { const res = await axe.run(document, { runOnly: ['color-contrast'] });
      const hit = (a) => a.flatMap((v) => v.nodes).filter((n) => n.html.includes('d15-plant'));
      return { v: hit(res.violations).length, inc: hit(res.incomplete).map((n) => (n.any[0] || {}).data?.messageKey || '?') }; });
    check(planted >= 4 && r.v === planted, `D15 ${theme}: ${r.v}/${planted} planted low-contrast lines fail in axe${r.inc.length ? ' — incomplete: ' + [...new Set(r.inc)].join(',') : ''}`);
    const head = await p.evaluate(() => { const r = document.querySelector('#metrics .res-row'), acc = getComputedStyle(document.documentElement).getPropertyValue('--dp-amber').trim();
      const hex = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)).join(', '); };
      return { acc: hex(acc), fig: getComputedStyle(r.querySelector('.metric-value')).color, bar: getComputedStyle(r.querySelector('.res-fill')).backgroundImage }; });
    check(!head.fig.includes(head.acc) && !head.bar.includes(head.acc), `D16 ${theme}: the headline result reads in ink with a blue bar (R119: the accent is the 10 %, not the result) — figure ${head.fig}, bar ${head.bar.includes(head.acc) ? 'accent' : 'not accent'} (accent ${head.acc})`);
    const sc = await p.evaluate((B) => B.map((id) => { const s = document.getElementById(id), L = s.querySelector(':scope > .dp-light');
      if (!L) return { id, src: 0, warm: false, grain: false, sheen: 0, panels: 0 };
      const g = getComputedStyle(L).backgroundImage, src = (g.match(/radial-gradient/g) || []).length;
      const cols = [...g.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1].split(',').map(Number));
      const warm = cols.some((c) => c[0] - c[2] >= 120 && c[3] > 0), grain = /url\(/.test(getComputedStyle(L, '::after').backgroundImage);
      const panels = [...s.querySelectorAll('.res-panel, .case-card, .contact-info, .contact-form')];
      const sheen = panels.filter((pn) => { const e = pn.querySelector(':scope > .dp-sheen'); if (!e) return false; const bi = getComputedStyle(e).backgroundImage; const st = [...bi.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => +((m[1].split(',')[3]) ?? 1));
        return /linear-gradient/.test(bi) && st.length >= 3 && Math.max(...st) === st[Math.floor(st.length / 2)] && st[0] < st[Math.floor(st.length / 2)]; }).length;
      return { id, src, warm, grain, sheen, panels: panels.length }; }), BANDS);
    for (const x of sc) check(x.src >= 3 && x.warm && x.grain && x.sheen === x.panels && x.panels > 0,
      `D16 ${theme} #${x.id}: light layer ${x.src} radial source(s), warm counter-light ${x.warm}, grain ${x.grain}, sheen on ${x.sheen}/${x.panels} panel(s)`);
    await p.close();
  }
  // D14 entrance choreography (R103): armed below the fold, hidden before entry, all shown within 1.8 s, title sharpens in.
  for (const reduce of [false, true]) {
    const p = await browser.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
    await p.setViewport({ width: 1440, height: 900 });
    if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.goto(URL.replace('/index.html', '/robots.txt')); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('rz_cookie_consent', 'declined'); });
    await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise((r) => setTimeout(r, 400));
    const armed = await p.evaluate((S) => S.filter((id) => document.getElementById(id).classList.contains('rv-armed')), SECS);
    if (reduce) { check(armed.length === 0, `D14 reduced motion: no section is armed (read ${armed.join(',') || 'none'})`); await p.close(); continue; }
    check(armed.length === SECS.length, `D14 every section below the fold is armed (${armed.length}/${SECS.length})`);
    for (const id of ['metrics', 'case-studies', 'contact']) {
      const pre = await p.evaluate((id) => { const items = [...document.getElementById(id).querySelectorAll('.rv')]; return { n: items.length, shown: items.filter((e) => +getComputedStyle(e).opacity > 0.05).length }; }, id);
      await p.evaluate((id) => { document.documentElement.style.scrollBehavior = 'auto'; const e = document.getElementById(id); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); }, id);
      await p.waitForFunction((id) => document.getElementById(id).classList.contains('rv-in'), { timeout: 4000 }, id).catch(() => {});
      await new Promise((r) => setTimeout(r, 120));
      const blur = await p.evaluate((id) => { const t = document.querySelector('#' + id + ' .rv-title'); return t ? getComputedStyle(t).filter : 'none'; }, id);
      await new Promise((r) => setTimeout(r, 1700));
      const post = await p.evaluate((id) => { const s = document.getElementById(id), items = [...s.querySelectorAll('.rv, .rv-title')];
        const eb = s.querySelector('.sec-eyebrow'); return { shown: items.filter((e) => +getComputedStyle(e).opacity > 0.99 && getComputedStyle(e).transform === 'none').length, n: items.length,
          rule: eb ? getComputedStyle(eb, '::after').transform : 'none', light: +getComputedStyle(s.querySelector(':scope > .dp-light') || s, s.querySelector(':scope > .dp-light') ? null : '::before').opacity }; }, id);
      check(pre.n >= 2 && pre.shown === 0 && /blur\(/.test(blur) && post.shown === post.n && post.rule === 'none' && post.light > 0.99,
        `D14 #${id}: hidden before entry (${pre.shown}/${pre.n} shown), title mid-sharpen 120 ms in (${blur}), all ${post.shown}/${post.n} shown after, rule drawn (${post.rule}), light on (${post.light})`);
    }
    check(p.errors.length === 0, `D14 no page errors${p.errors.length ? ' — ' + p.errors[0] : ''}`);
    await p.close();
  }
} finally { await browser.close(); }
console.log(fail ? `FAIL — ${fail} law(s) broken` : 'PASS — the homepage has depth by tier, hairline and measured figure, not by effect');
process.exit(fail ? 1 : 0);
