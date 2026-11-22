#!/usr/bin/env node
/* test-conv-motion.mjs — PRD-CONV-BMS-MOTION §5: motion that carries state on the eight Conventional BMS pages.
 *
 * Every law reads COMPUTED values or the Web Animations API out of a real browser after a real interaction, at 1440 dark,
 * in both motion preferences. Red on the v3.83.0 tree (dialog and colour changes in one frame, 0 press feedback).
 *
 *   MO1 trend dialog moves in and out when the POINTER opens/closes it (desktop modal): mid-enter opacity < 1, rest
 *       opacity 1 + transform none; after × still shown and fading, then hidden; focus back on the number; opened by
 *       Enter it is at rest in the first frame and Escape hides it at once (a keyboard action never animates)
 *   MO2 a point that worsens is marked (data-pt-arrive + a running animation, gone <= 1.2 s); improving is not;
 *       [data-point] crossfades its colour (transition on color, 160–300 ms)
 *   MO3 every visible enabled HTML button in the cockpit root scales on press and returns; rest transform untouched
 *   MO4 panels swap with a transition (data hall inspector, Plan -> Air path, tab panels)
 *   MO5 page arrival: the first screen's blocks animate (>= 1), all done <= 600 ms after the first starts; no new infinite animation
 *   MO6 reduced motion: the same moments move opacity/colour only (no transform mid-flight), no press scale
 *   MO7 rules: css/conv-motion.css durations <= 300 ms, token easing, no `transition: all`, no scale(0), no infinite
 *
 *   node tools/test-conv-motion.mjs [--page=datahall] [--only=MO1,MO3]
 */
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const ONLY = arg('only') ? arg('only').split(',') : null;
const PAGES = [['dc-conventional', 'dc-conventional'], ['datahall', 'datahall'], ['chiller-plant', 'chiller-plant'], ['fuel-system', 'fuel-system'],
  ['water-system', 'water-system'], ['fire-system', 'fire-system'], ['ict', 'ict'], ['EPMS_Telemetry', 'epms']]
  .filter(([f]) => !arg('page') || f === arg('page'));
const LOOPS_ALLOWED = new Set(['hmi-march', 'vfx-turn', 'fp-air', 'conv-live-flow', 'as-march']);   /* process-bound motion: js/conv/vfx.js (v3.83.0), data-hall air and ict traffic (PRD-CONV-BMS-LIVE, gated by test-conv-live LV4) */

const fails = []; let passes = 0;
const ok = (c, law, msg) => { if (ONLY && !ONLY.includes(law)) return; if (c) passes++; else fails.push(`${law} ${msg}`); };

/* MO7 — static rules over the module's stylesheet */
{
  const f = 'css/conv-motion.css';
  if (!existsSync(f)) ok(false, 'MO7', `${f} missing`);
  else {
    const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/transition\s*:\s*all\b/.test(css) && !/transition-property\s*:\s*all\b/.test(css), 'MO7', 'transition: all present');
    ok(!/scale\(\s*0\s*\)/.test(css), 'MO7', 'scale(0) present');
    ok(!/infinite/.test(css), 'MO7', 'infinite iteration present');
    const ms = [...css.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)(ms|s)\b/g)].map((m) => (m[2] === 's' ? +m[1] * 1000 : +m[1]));
    const over = ms.filter((v) => v > 300);
    ok(!over.length, 'MO7', `durations over 300 ms: ${over.join(',')}`);
    const eases = [...css.matchAll(/(?:transition|animation)(?:-timing-function)?\s*:[^;]*/g)].map((m) => m[0])
      .filter((d) => /\b(ease|ease-in|ease-out|ease-in-out|linear)\b|cubic-bezier/.test(d.replace(/var\(--rz-ease-[\w-]+(?:,\s*cubic-bezier\([^)]*\))?\)/g, '')));
    ok(!eases.length, 'MO7', `easing not from a --rz-ease token: ${eases.slice(0, 3).join(' | ')}`);
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = createServer(async (q, r) => {
  try { const p = resolve('.' + decodeURIComponent(q.url.split('?')[0])); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(await readFile(p)); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise((a) => server.listen(0, '127.0.0.1', a));
const O = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* records every finite CSS animation that starts in the first 3 s (MO5), from the first document frame */
const ARRIVAL_SPY = () => {
  const seen = new Map(); window.__moArrival = seen; const t0 = performance.now();
  const tick = () => {
    for (const a of document.getAnimations()) {
      const tm = a.effect && a.effect.getTiming(); if (!tm || tm.iterations === Infinity) continue;
      const tgt = a.effect.target; if (!tgt || seen.has(a)) continue;
      const tr = getComputedStyle(tgt).transform;
      seen.set(a, { name: a.animationName || a.id || a.transitionProperty || '', start: performance.now(), end: performance.now() + (tm.delay || 0) + (+tm.duration || 0), moved: tr && tr !== 'none', root: !!(tgt.closest && tgt.closest('[data-rz-cockpit-root]')), tag: tgt.tagName + (tgt.id ? '#' + tgt.id : '') });
    }
    if (performance.now() - t0 < 30000) requestAnimationFrame(tick);   /* the arrival plays when the sign-in gate clears */
  };
  requestAnimationFrame(tick);
};

async function load(file, id, reduce) {
  const pg = await browser.newPage(); pg.__errs = [];
  pg.on('pageerror', (e) => pg.__errs.push(String(e.message || e).slice(0, 160)));
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await pg.evaluateOnNewDocument(ARRIVAL_SPY);
  await pg.goto(`${O}/${file}.html`, { waitUntil: 'load', timeout: 60000 });
  await enterAuthorizedAuditState(pg, id);
  await sleep(3200);
  return pg;
}
const frames = (n = 2) => `await new Promise((r) => { let k = ${n}; const f = () => (--k ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });`;

for (const [file, id] of PAGES) {
  for (const reduce of [false, true]) {
    const T = `${file}${reduce ? ' (reduced)' : ''}`;
    const pg = await load(file, id, reduce);

    /* MO5 / MO6 arrival */
    const arr = await pg.evaluate(() => { const v = [...(window.__moArrival || new Map()).values()].filter((x) => x.root && /^cvm-/.test(x.name));
      const inf = [...new Set(document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).map((a) => a.animationName || '?'))];
      return { n: new Set(v.map((x) => x.tag)).size, span: v.length ? Math.max(...v.map((x) => x.end)) - Math.min(...v.map((x) => x.start)) : null, moved: v.filter((x) => x.moved).length, inf }; });
    ok(arr.n >= 1, 'MO5', `${T}: ${arr.n} blocks animate on arrival (want >= 1; the first screen's blocks, one on a one-frame page)`);
    ok(arr.span !== null && arr.span <= 650, 'MO5', `${T}: arrival takes ${arr.span && arr.span.toFixed(0)} ms (want <= 600 + 1 frame margin)`);
    ok(arr.inf.every((n) => LOOPS_ALLOWED.has(n)), 'MO5', `${T}: infinite animations outside the process set: ${arr.inf.join(',')}`);
    if (reduce) ok(arr.moved === 0, 'MO6', `${T}: ${arr.moved} arrival animations move (transform) under reduced motion`);

    /* MO2 colour crossfade on [data-point] */
    const tp = await pg.evaluate(() => { const p = [...document.querySelectorAll('[data-rz-cockpit-root] [data-point]')].find((e) => e.getClientRects().length); if (!p) return null; const c = getComputedStyle(p);
      const props = c.transitionProperty.split(',').map((s) => s.trim()), durs = c.transitionDuration.split(',').map((s) => parseFloat(s) * 1000);
      const i = props.indexOf('color'); return { props: c.transitionProperty, dur: i >= 0 ? durs[i % durs.length] : null }; });
    if (tp) ok(tp.dur !== null && tp.dur >= (reduce ? 80 : 160) && tp.dur <= 300, 'MO2', `${T}: [data-point] colour transition ${JSON.stringify(tp)}`);

    /* MO2 worsening is marked, improving is not (one HTML and one SVG point) */
    const mark = await pg.evaluate(async (FR) => {
      const S = window.RZPointStatus; if (!S) return { err: 'no RZPointStatus' };
      const pick = (svg) => [...document.querySelectorAll('[data-rz-cockpit-root] [data-point]')].find((e) => {
        if (!e.getClientRects().length || (svg ? !(e instanceof SVGElement) : e instanceof SVGElement)) return false;
        const L = S.limits(e.getAttribute('data-point')); return L && (typeof L.hi_alarm === 'number' || typeof L.lo_alarm === 'number'); });
      const out = [];
      for (const svg of [false, true]) {
        const e = pick(svg); if (!e) continue;
        const idp = e.getAttribute('data-point'), L = S.limits(idp);
        const bad = typeof L.hi_alarm === 'number' ? L.hi_alarm + Math.max(1, Math.abs(L.hi_alarm) * 0.5) : L.lo_alarm - Math.max(1, Math.abs(L.lo_alarm) * 0.5);
        const lo = typeof L.lo_warn === 'number' ? L.lo_warn : L.lo_alarm, hi = typeof L.hi_warn === 'number' ? L.hi_warn : L.hi_alarm;
        const good = typeof lo === 'number' && typeof hi === 'number' ? (lo + hi) / 2 : typeof hi === 'number' ? hi - Math.max(1, Math.abs(hi) * 0.5) : lo + Math.max(1, Math.abs(lo) * 0.5);
        /* from a known normal state, past any running settle (the page's own tick may have marked it a moment ago) */
        S.apply(e, idp, good); for (let w = 0; w < 30 && e.__rzPtArrive; w++) await new Promise((r) => setTimeout(r, 50));
        S.apply(e, idp, good); S.apply(e, idp, bad);
        const anims = e.getAnimations({ subtree: true }).length, arrive = e.hasAttribute('data-pt-arrive'), state = e.getAttribute('data-pt-state');
        await new Promise((r) => setTimeout(r, 1250));
        const gone = !e.hasAttribute('data-pt-arrive');
        S.apply(e, idp, good);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        out.push({ svg, idp, state, arrive, anims, gone, back: e.getAttribute('data-pt-state'), arriveOnImprove: e.hasAttribute('data-pt-arrive') });
      }
      return { out };
    }, frames);
    if (mark.err) ok(false, 'MO2', `${T}: ${mark.err}`);
    else {
      ok(mark.out.length > 0, 'MO2', `${T}: no point with an alarm limit is visible`);
      for (const m of mark.out) {
        const k = `${T} ${m.svg ? 'SVG' : 'HTML'} ${m.idp}`;
        ok(m.state === 'alarm' && m.arrive && m.anims > 0, 'MO2', `${k}: worsening not marked ${JSON.stringify(m)}`);
        ok(m.gone, 'MO2', `${k}: data-pt-arrive still set after 1.25 s`);
        ok(m.back === 'ok' && !m.arriveOnImprove, 'MO2', `${k}: improving was marked ${JSON.stringify(m)}`);
      }
    }

    /* MO1 / MO6 trend dialog */
    const tr = await pg.evaluate(async () => {
      const p = [...document.querySelectorAll('[data-rz-cockpit-root] [data-point][data-trend]')].find((e) => e.getClientRects().length && !(e instanceof SVGElement));
      if (!p) return { err: 'no HTML point with a trend' };
      p.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 120));
      const f2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const read = () => { const el = document.querySelector('.rz-trend'), pn = el && el.querySelector('.rz-trend-panel'); if (!el || el.hidden || !el.getClientRects().length) return { shown: false };
        const a = getComputedStyle(el), b = getComputedStyle(pn); return { shown: true, o: +a.opacity * +b.opacity, tf: b.transform }; };
      /* the running transitions themselves (a frame count says nothing in a headless tab under load) */
      const motion = () => { const el = document.querySelector('.rz-trend'); if (!el) return { props: [], dur: 0, list: [] };
        const list = el.getAnimations({ subtree: true }).filter((x) => x.playState === 'running' || x.playState === 'pending');
        return { props: [...new Set(list.map((x) => x.transitionProperty || x.animationName || x.id))].sort(), dur: Math.max(0, ...list.map((x) => +x.effect.getTiming().duration || 0)), list }; };
      const settle = (m) => Promise.race([Promise.all(m.list.map((x) => x.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]);
      /* a pointer click (detail 1, as a mouse gives it) animates; the × closes the way it came */
      p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      const mIn = motion(), mid = Object.assign(read(), { props: mIn.props, dur: mIn.dur });
      await settle(mIn); await f2(); const rest = read();
      const x = document.querySelector('.rz-trend [data-close]');
      x.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      const mOut = motion(), out = Object.assign(read(), { props: mOut.props, dur: mOut.dur });
      await settle(mOut); await new Promise((r) => setTimeout(r, 120)); const end = read(); const a0 = document.activeElement; const focus = a0 === p || (!p.isConnected && !!a0 && a0.getAttribute('data-trend') === p.getAttribute('data-trend'));
      /* keyboard stays instant (MOTION_STANDARD §1): Enter on the focused number opens at rest, Escape hides at once */
      const q = p.isConnected ? p : a0; q.focus(); q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await f2();
      const kin = Object.assign(read(), { props: motion().props });
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await f2(); const kout = read();
      /* Enter on a number inside a basis tile opened the trend AND the tile's basis drawer (v3.82.0): Escape closed the
         trend and left the drawer over the page. One key, one dialog. */
      const dr = document.getElementById('rz-basis-drawer'); kout.drawer = !!(dr && !dr.hidden && dr.getClientRects().length && getComputedStyle(dr).visibility !== 'hidden' && dr.getBoundingClientRect().width > 0 && dr.getAttribute('aria-hidden') !== 'true');
      return { mid, rest, out, end, focus, kin, kout };
    });
    if (tr.err) ok(file === 'ict' ? true : false, 'MO1', `${T}: ${tr.err}`);
    else {
      const want = reduce ? ['opacity'] : ['opacity', 'transform'];
      ok(tr.mid.shown && want.every((k) => tr.mid.props.includes(k)) && tr.mid.dur >= (reduce ? 80 : 160) && tr.mid.dur <= 300, 'MO1', `${T}: dialog does not move in ${JSON.stringify(tr.mid)}`);
      if (reduce) ok(!tr.mid.props.includes('transform') && tr.mid.tf === 'none', 'MO6', `${T}: dialog moves under reduced motion ${JSON.stringify(tr.mid)}`);
      ok(tr.rest.shown && tr.rest.o > 0.99 && tr.rest.tf === 'none', 'MO1', `${T}: dialog not at rest after its transition ${JSON.stringify(tr.rest)}`);
      ok(tr.out.shown && tr.out.props.includes('opacity') && tr.out.dur > 0 && tr.out.dur <= tr.mid.dur, 'MO1', `${T}: dialog does not move out (exit <= enter) ${JSON.stringify(tr.out)}`);
      ok(!tr.end.shown, 'MO1', `${T}: dialog still shown after its exit`);
      ok(tr.focus, 'MO1', `${T}: focus not returned to the number`);
      ok(tr.kin.shown && tr.kin.o > 0.99 && tr.kin.tf === 'none' && !tr.kin.props.length, 'MO1', `${T}: keyboard open is animated ${JSON.stringify(tr.kin)}`);
      ok(!tr.kout.shown, 'MO1', `${T}: Escape does not close at once ${JSON.stringify(tr.kout)}`);
      ok(!tr.kout.drawer, 'MO1', `${T}: Enter on a number also opened the basis drawer (still open after Escape closed the trend)`);
    }

    /* MO3 / MO6 press feedback */
    /* MO1 scrolled a point to the centre — of the window or of an inner scroller (fuel, water) */
    await pg.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }); await sleep(250);
    const btns = await pg.evaluate(() => [...document.querySelectorAll('[data-rz-cockpit-root] button, [data-rz-cockpit-root] [role="button"]')]
      .filter((b) => { if (b instanceof SVGElement || b.closest('svg') || b.hasAttribute('data-point') || b.closest('.cv-cta') || b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
        const r = b.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom < 60 || r.top > innerHeight - 4 || r.left < 0 || r.right > innerWidth) return false;
        const c = getComputedStyle(b); if (c.visibility === 'hidden' || +c.opacity === 0 || c.transform !== 'none' || c.pointerEvents === 'none') return false;
        /* the press lands on the control itself, never on a number inside it (a tile's number opens its trend instead) */
        b.__moAt = null;
        for (const [fx, fy] of [[.5, .5], [.2, .3], [.8, .3], [.2, .75], [.8, .75], [.5, .2], [.5, .85]]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy, hit = document.elementFromPoint(x, y);
          if (hit && (hit === b || b.contains(hit)) && !hit.closest('[data-point]')) { b.__moAt = { x, y }; break; }
        }
        return !!b.__moAt; })
      .slice(0, 24).map((b, i) => { b.setAttribute('data-mo-btn', String(i)); return { i, x: b.__moAt.x, y: b.__moAt.y, t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24) }; }));
    let pressed = 0, bad = [];
    for (const b of btns) {
      /* read after the element's own transitions finish (a fixed sleep reads mid-flight on a loaded lane) */
      const settled = (i) => pg.evaluate(async (k) => { const e = document.querySelector(`[data-mo-btn="${k}"]`); if (!e) return;
        await Promise.race([Promise.all(e.getAnimations().map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1500))]); }, i);
      /* the spot is found again right before the press: an earlier press can change the layout (a mode button) */
      const spot = await pg.evaluate((i) => { const e = document.querySelector(`[data-mo-btn="${i}"]`); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect();
        for (const [fx, fy] of [[.5, .5], [.2, .3], [.8, .3], [.2, .75], [.8, .75], [.5, .2], [.5, .85]]) { const x = r.x + r.width * fx, y = r.y + r.height * fy, h = document.elementFromPoint(x, y);
          if (h && (h === e || e.contains(h)) && !h.closest('[data-point]') && y > 50 && y < innerHeight - 2) return { x, y }; }
        return null; }, b.i);
      if (!spot) { console.log(`   ${T}: ${b.t || '#' + b.i} moved out of reach after an earlier press, not pressed`); continue; }
      b.x = spot.x; b.y = spot.y;
      await pg.mouse.move(b.x, b.y); await sleep(60);
      const top = await pg.evaluate((i, x, y) => { const e = document.querySelector(`[data-mo-btn="${i}"]`), h = document.elementFromPoint(x, y); return !!(e && h && (h === e || e.contains(h))); }, b.i, b.x, b.y);
      if (!top) { console.log(`   ${T}: ${b.t || '#' + b.i} covered on hover, not pressed`); continue; }
      await pg.mouse.down(); await sleep(40); await settled(b.i);
      const tf = await pg.evaluate((i) => { const c = getComputedStyle(document.querySelector(`[data-mo-btn="${i}"]`)); return { scale: c.scale, transform: c.transform }; }, b.i);
      await pg.mouse.move(2, 899); await pg.mouse.up(); await sleep(40); await settled(b.i);
      const rest = await pg.evaluate((i) => { const e = document.querySelector(`[data-mo-btn="${i}"]`); if (!e) return 'none'; const c = getComputedStyle(e); return c.scale !== 'none' && c.scale !== '1' ? 'scale ' + c.scale : c.transform; }, b.i);
      /* the press uses the individual `scale` property (composes with a control's own transform); a matrix counts too */
      const sc = /^matrix\(([-\d.]+)/.exec(tf.transform); const s = (tf.scale && tf.scale !== 'none' ? parseFloat(tf.scale) : 1) * (sc ? +sc[1] : 1);
      if (reduce ? s !== 1 : !(s > 0.95 && s < 0.99)) bad.push(`${b.t || '#' + b.i}=${s.toFixed(3)}`); else pressed++;
      if (rest !== 'none') bad.push(`${b.t || '#' + b.i} rest ${rest}`);
      await pg.keyboard.press('Escape').catch(() => {});
    }
    ok(btns.length > 0 && pressed >= Math.ceil(btns.length * 0.75), 'MO3', `${T}: pressed ${pressed} of ${btns.length} buttons (want >= 75 %)`);
    ok(!bad.length, reduce ? 'MO6' : 'MO3', `${T}: ${bad.length}/${btns.length} buttons wrong on press: ${bad.slice(0, 6).join(', ')}`);

    /* MO4 panel swaps */
    if (file === 'datahall') {
      await pg.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
      const ins = await pg.evaluate(async () => {
        const f2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const z = document.querySelector('.zone[data-z="2"] .zone-head') || document.querySelector('.zone[data-z="2"]'); if (!z) return { err: 'no zone' };
        z.dispatchEvent(new MouseEvent('click', { bubbles: true })); await f2();
        const body = document.querySelector('[data-inspector-body]') || document.querySelector('[data-inspector-state]');
        const a = body ? body.getAnimations({ subtree: true }).filter((x) => x.effect && x.effect.getTiming().iterations !== Infinity) : [];
        const moved = a.some((x) => getComputedStyle(x.effect.target).transform !== 'none');
        return { state: document.querySelector('[data-inspector-state]') && document.querySelector('[data-inspector-state]').getAttribute('data-inspector-state'), n: a.length, moved };
      });
      ok(!ins.err && ins.n > 0, 'MO4', `${T}: inspector swap has no transition ${JSON.stringify(ins)}`);
      if (reduce) ok(!ins.moved, 'MO6', `${T}: inspector swap moves under reduced motion`);
      await pg.keyboard.press('Escape'); await sleep(600);
      const air = await pg.evaluate(async () => {
        const f2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const b = document.querySelector('.view-btn[data-view="air"]'); if (!b) return { err: 'no air button' };
        b.click(); await f2(); const s = document.querySelector('#air-sec');
        const a = s ? s.getAnimations({ subtree: false }).concat(s.parentElement ? s.parentElement.getAnimations() : []) : [];
        const n = a.filter((x) => x.effect && x.effect.getTiming().iterations !== Infinity).length; document.querySelector('.view-btn[data-view="plan"]').click(); return { n };
      });
      ok(!air.err && air.n > 0, 'MO4', `${T}: Plan -> Air path has no transition ${JSON.stringify(air)}`);
    }
    const tab = await pg.evaluate(async () => {
      const tabs = [...document.querySelectorAll('[data-rz-cockpit-root] [role="tab"]')].filter((t) => t.getClientRects().length && t.getAttribute('aria-selected') !== 'true' && t.getAttribute('aria-controls'));
      const t = tabs[0]; if (!t) return null;
      t.click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const p = document.getElementById(t.getAttribute('aria-controls')); if (!p || !p.getClientRects().length) return { err: 'panel not shown', id: t.getAttribute('aria-controls') };
      return { id: p.id, n: p.getAnimations().filter((x) => x.effect && x.effect.getTiming().iterations !== Infinity).length };
    });
    if (tab) ok(!tab.err && tab.n > 0, 'MO4', `${T}: tab panel swap has no transition ${JSON.stringify(tab)}`);

    ok(!pg.__errs.length, 'MO0', `${T}: page errors ${pg.__errs.slice(0, 2).join(' | ')}`);
    await pg.close();
    console.log(`… ${T} done (${fails.length} findings so far)`);
  }
}
await browser.close(); server.close();
const laws = ['MO0', 'MO1', 'MO2', 'MO3', 'MO4', 'MO5', 'MO6', 'MO7'];
for (const l of laws) { const f = fails.filter((x) => x.startsWith(l + ' ')); if (ONLY && !ONLY.includes(l)) continue; console.log(`${l} ${f.length ? 'FAIL' : 'PASS'}  ${f.length ? f.length + ' finding(s); first: ' + f[0].slice(l.length + 1, 260) : ''}`); }
console.log(fails.length ? `CONV MOTION — FAIL (${fails.length} findings, ${passes} passes)` : `CONV MOTION — PASS (${passes} checks: trend dialog, state marks, press feedback, panel swaps, arrival, reduced motion, rules)`);
if (process.argv.includes('--all')) fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
