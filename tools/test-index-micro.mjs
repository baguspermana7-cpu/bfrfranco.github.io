#!/usr/bin/env node
/**
 * Homepage polish laws (owner 2026-11-10, R106 "Continue polish more, khususnya motion micro interaction juga, gradien dan
 * effect2 smooth"; R107 "Gak ada effect flip yg sangat bagus itu cardnya … gradien yg di versi awal yg gradien bawah jangn
 * dihilangkan" + "Design better"; answers: the old card-bottom glow, and the EMPLOYER card flip). Rendered page, both themes.
 * No cursor tracking (CLAUDE.md rejected pattern 4) and no :hover transform (slop "lift").
 *  G1 bottom glow is back: every result panel, case card, contact panel and employer card front carries a light rising
 *     from its bottom edge (an INSET box-shadow with a negative y offset, coloured blue-family or the accent); the case
 *     cards rotate colour (>= 2 distinct, one of them the orange accent).
 *  G2 hover answers with light, not movement: hovering a case card strengthens its bottom glow (the shadow changes) and
 *     its transform stays none; after the pointer leaves it settles back.
 *  G3 the glow keeps contrast measurable: a planted low-contrast line in an employer card front and in a case card is an
 *     axe colour-contrast VIOLATION (never "incomplete").
 *  F1 the employer flip is a physical turn: ~45 % through the turn the card is lifted toward the viewer (scale > 1.01),
 *     the turning face throws a shadow, and a glare band crosses it (a gradient on .emp-glare); at rest none of that
 *     paints (no glare background, no drop shadow).
 *  F2 the back arrives in order: shortly after the turn crosses 90°, the back's fact rows are still cascading in (the
 *     last row behind the first); 1.4 s after the click every row is fully shown.
 *  F3 reduced motion: the flip is an opacity swap — no lift, no glare, no cascade.
 *  M5 (superseded by R119, 2026-11-12: one page field, no per-section light layer; motion returns with R121) was: the light layer drifts with scroll (scroll-driven): .dp-light's translateY differs by >= 8 px between two scroll
 *     positions; with reduced motion it does not move.
 *  M6 copy feedback: clicking a .copy-btn shows a check icon (opacity > 0.9), hides the copy icon, and colours the
 *     button blue-family (no green).
 *  M8 result rows answer hover with a flat tint (no gradient) and no movement.
 * Env RZ_BASE (default http://127.0.0.1:8177).   node tools/test-index-micro.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.RZ_BASE || 'http://127.0.0.1:8177';
const URL = BASE + '/index.html';
const AXE = readFileSync(resolve(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer');
const GLOWED = '#metrics .res-panel, #case-studies .case-card, #contact .contact-info, #contact .contact-form, .emp-card .emp-front';
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// headless reports hover:none / pointer:none; a desktop has a fine pointer that hovers — without this every
// hover-gated rule is dead in the test and a hover law passes or fails for the wrong reason.
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output', '--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2'] });

const open = async (theme, { reduce = false } = {}) => {
  const p = await browser.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e).slice(0, 120)));
  await p.setViewport({ width: 1440, height: 900 });
  if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(BASE + '/robots.txt');
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); }, theme);
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  return p;
};
const scrollTo = async (p, sel) => { await p.evaluate((s) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 140); }, sel); await sleep(1900); };
// parse "rgba(r, g, b, a) 0px -90px 80px -60px inset" pieces of a computed box-shadow list
const SHADOWS = `(bs) => (bs === 'none' ? [] : bs.split(/,(?![^(]*\\))/).map((s) => { const c = (s.match(/rgba?\\(([^)]+)\\)/) || [, '0,0,0,0'])[1].split(',').map(Number);
  const n = s.replace(/rgba?\\([^)]+\\)/, '').match(/-?\\d+(\\.\\d+)?px/g) || []; return { c, inset: /inset/.test(s), y: parseFloat(n[1] || 0), blur: parseFloat(n[2] || 0), spread: parseFloat(n[3] || 0) }; }))`;

try {
  for (const theme of ['light', 'dark']) {
    const T = `[${theme}]`;
    const p = await open(theme);
    await p.evaluate(`window.__sh = ${SHADOWS}`);
    // G1
    const g = await p.evaluate((S) => [...document.querySelectorAll(S)].map((e) => {
      const bottom = window.__sh(getComputedStyle(e).boxShadow).filter((s) => s.inset && s.y < 0 && (s.c[3] ?? 1) > 0.05);
      const col = bottom[0] ? bottom[0].c : null;
      const blue = col && col[2] - Math.max(col[0], col[1]) >= 60, warm = col && col[0] - col[2] >= 120;
      return { cls: e.className.split(' ')[0], ok: !!col && (blue || warm), warm, key: col ? col.slice(0, 3).join(',') : 'none' }; }), GLOWED);
    const cases = g.filter((x) => x.cls === 'case-card');
    check(g.length >= 11 && g.every((x) => x.ok), `G1 ${T} ${g.filter((x) => x.ok).length}/${g.length} panels carry a bottom glow (${[...new Set(g.filter((x) => !x.ok).map((x) => x.cls))].join(',') || 'all'})`);
    check(cases.length >= 3 && new Set(cases.map((x) => x.key)).size === 1, `G1 ${T} case cards share one light colour (R119: blue as light, no rotation) (${cases.map((x) => x.key).join(' | ')})`);
    // G2
    await scrollTo(p, '#case-studies .case-card');
    const cc = await p.evaluate(() => { const e = document.querySelector('#case-studies .case-card'), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, bs: getComputedStyle(e).boxShadow }; });
    await p.mouse.move(cc.x, cc.y); await sleep(600);
    const ch = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('#case-studies .case-card')); return { bs: c.boxShadow, tf: c.transform }; });
    await p.mouse.move(cc.x, 5); await sleep(700);
    const cb = await p.evaluate(() => getComputedStyle(document.querySelector('#case-studies .case-card')).boxShadow);
    check(ch.bs !== cc.bs && ch.tf === 'none' && cb === cc.bs, `G2 ${T} hover strengthens the case-card glow (${ch.bs !== cc.bs ? 'changed' : 'unchanged'}), no movement (${ch.tf}), settles back (${cb === cc.bs})`);
    // M8
    await p.evaluate(() => document.querySelector('#metrics .res-row:nth-of-type(2)').scrollIntoView({ block: 'center' }));
    await sleep(1900);
    const row = await p.evaluate(() => { const e = document.querySelector('#metrics .res-row:nth-of-type(2)'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, bg0: getComputedStyle(e).backgroundColor }; });
    await p.mouse.move(row.x, row.y); await sleep(400);
    const row1 = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('#metrics .res-row:nth-of-type(2)')); return { bg: c.backgroundColor, img: c.backgroundImage, tf: c.transform }; });
    check(row1.bg !== row.bg0 && row1.img === 'none' && row1.tf === 'none', `M8 ${T} result row hover: flat tint ${row.bg0} → ${row1.bg}, no gradient, no movement (${row1.tf})`);
    await p.mouse.move(5, 5);
    // M5 (R119, owner approved 2026-11-12): the per-section light layer gives way to ONE page field; scroll motion
    // returns with R121 (Lenis + GSAP), not as a per-section drift.
    const lightShown = await p.evaluate(() => [...document.querySelectorAll('section > .dp-light')].filter((l) => getComputedStyle(l).display !== 'none').length);
    check(lightShown === 0, `M5 ${T} one page field: no per-section light layer is drawn (R119) — ${lightShown} shown`);
    // F1 + F2 on employer card 2
    await scrollTo(p, '.emp-card:nth-of-type(2)');
    const ec = await p.evaluate(() => { const r = document.querySelector('.emp-card:nth-of-type(2) .emp-front .emp-name').getBoundingClientRect(); return { x: r.left + 10, y: r.top + 5 }; });
    const t0 = Date.now();
    await p.mouse.click(ec.x, ec.y);
    await sleep(Math.max(0, 340 - (Date.now() - t0)));
    const mid = await p.evaluate(() => { const card = document.querySelector('.emp-card:nth-of-type(2)'); const m = getComputedStyle(card).transform; const sc = m === 'none' ? 1 : Math.hypot(...m.replace(/^matrix(3d)?\(|\)$/g, '').split(',').map(Number).slice(0, 2));
      const faces = [...card.querySelectorAll('.emp-face')]; const glare = [...card.querySelectorAll('.emp-glare')].map((e) => getComputedStyle(e).backgroundImage);
      return { sc, shadow: faces.some((f) => window.__sh(getComputedStyle(f).boxShadow).some((s) => !s.inset && s.blur >= 20)), glare: glare.some((b) => /gradient/.test(b)) }; });
    check(mid.sc > 1.01 && mid.shadow && mid.glare, `F1 ${T} mid-turn the card lifts (scale ${mid.sc.toFixed(3)}), the face throws a shadow (${mid.shadow}) and a glare crosses it (${mid.glare})`);
    await sleep(Math.max(0, 560 - (Date.now() - t0)));
    const cas = await p.evaluate(() => [...document.querySelectorAll('.emp-card:nth-of-type(2) .emp-back .emp-facts > div')].map((e) => +getComputedStyle(e).opacity));
    await sleep(Math.max(0, 1400 - (Date.now() - t0)));
    const done = await p.evaluate(() => { const card = document.querySelector('.emp-card:nth-of-type(2)');
      return { rows: [...card.querySelectorAll('.emp-back .emp-facts > div')].map((e) => +getComputedStyle(e).opacity), glare: [...card.querySelectorAll('.emp-glare')].every((e) => getComputedStyle(e).backgroundImage === 'none'),
        shadow: [...card.querySelectorAll('.emp-face')].some((f) => window.__sh(getComputedStyle(f).boxShadow).some((s) => !s.inset && s.blur >= 20)), tf: getComputedStyle(card).transform }; });
    check(cas.length >= 3 && cas[cas.length - 1] < cas[0] && cas[cas.length - 1] < 0.99, `F2 ${T} the back's facts cascade in (560 ms: ${cas.map((x) => x.toFixed(2)).join(' ')})`);
    check(done.rows.every((x) => x > 0.99) && done.glare && !done.shadow && done.tf === 'none', `F1/F2 ${T} at rest: all facts shown (${done.rows.map((x) => x.toFixed(2)).join(' ')}), no glare (${done.glare}), no drop shadow (${!done.shadow}), card unmoved (${done.tf})`);
    await p.evaluate(() => document.querySelectorAll('.emp-card.is-flipped .emp-close').forEach((b) => b.click())); await sleep(1200);
    check(await p.evaluate(() => !document.querySelector('.emp-card.is-flipped')), `F ${T} Back turns the card home (no card left flipped)`);
    // G3
    const planted = await p.evaluate((t) => { let n = 0; for (const e of document.querySelectorAll('.emp-card .emp-front, #case-studies .case-card')) {
      const q = document.createElement('p'); q.className = 'g3-plant'; q.textContent = 'planted low contrast line'; q.style.cssText = 'font-size:14px;margin:8px 0';
      q.style.setProperty('color', t === 'dark' ? '#33363c' : '#d8d8d8', 'important'); e.appendChild(q); n++; } return n; }, theme);
    for (const id of ['about', 'case-studies']) { await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await sleep(1900); }
    await p.addScriptTag({ content: AXE });
    const ax = await p.evaluate(async () => { const r = await axe.run(document, { runOnly: ['color-contrast'] }); const hit = (a) => a.flatMap((v) => v.nodes).filter((n) => n.html.includes('g3-plant'));
      return { v: hit(r.violations).length, inc: [...new Set(hit(r.incomplete).map((n) => (n.any[0] || {}).data?.messageKey || '?'))] }; });
    check(ax.v === planted && planted >= 8, `G3 ${T} ${ax.v}/${planted} planted low-contrast lines in glowing cards fail in axe${ax.inc.length ? ' — incomplete: ' + ax.inc.join(',') : ''}`);
    // M6
    const ctx = browser.defaultBrowserContext(); await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
    await scrollTo(p, '.copy-btn');
    await p.click('.copy-btn'); await sleep(350);
    const cp = await p.evaluate(() => { const e = document.querySelector('.copy-btn'), ck = e.querySelector('.ico-check'), co = e.querySelector('.ico-copy'); const col = getComputedStyle(e).color.match(/\d+/g).map(Number);
      return { copied: e.classList.contains('copied'), ck: ck ? +getComputedStyle(ck).opacity : -1, co: co ? +getComputedStyle(co).opacity : -1, col }; });
    const blue = cp.col[2] - Math.max(cp.col[0], cp.col[1]) >= 60, green = cp.col[1] > cp.col[0] + 40 && cp.col[1] > cp.col[2];
    check(cp.copied && cp.ck > 0.9 && cp.co < 0.1 && blue && !green, `M6 ${T} copy feedback: check icon ${cp.ck}, copy icon ${cp.co}, colour ${cp.col.join(',')} (blue ${blue}, green ${green})`);
    check(p.errors.length === 0, `${T} no page errors${p.errors.length ? ' — ' + p.errors[0] : ''}`);
    await p.close();
  }
  // F3 + M5 reduced motion
  const rm = await open('dark', { reduce: true });
  const rmt = await rm.evaluate(() => getComputedStyle(document.querySelector('#case-studies > .dp-light')).transform);
  check(rmt === 'none', `M5 reduced motion: the light does not move (${rmt})`);
  await scrollTo(rm, '.emp-card:nth-of-type(2)');
  const e2 = await rm.evaluate(() => { const r = document.querySelector('.emp-card:nth-of-type(2) .emp-name').getBoundingClientRect(); return { x: r.left + 10, y: r.top + 5 }; });
  await rm.mouse.click(e2.x, e2.y); await sleep(200);
  const rf = await rm.evaluate(() => { const card = document.querySelector('.emp-card:nth-of-type(2)'); return { tf: getComputedStyle(card).transform, glare: [...card.querySelectorAll('.emp-glare')].some((e) => getComputedStyle(e).backgroundImage !== 'none'), rows: [...card.querySelectorAll('.emp-back .emp-facts > div')].map((e) => getComputedStyle(e).transform) }; });
  check(rf.tf === 'none' && !rf.glare && rf.rows.every((t) => t === 'none'), `F3 reduced motion: no lift (${rf.tf}), no glare (${!rf.glare}), no cascade movement`);
  await rm.close();
} finally { await browser.close(); }
console.log(fail ? `FAIL — ${fail} law(s) broken` : 'PASS — cards glow from the bottom, the employer turn is physical, and everything stays measurable');
process.exit(fail ? 1 : 0);
