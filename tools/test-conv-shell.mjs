#!/usr/bin/env node
/**
 * test-conv-shell.mjs — one cockpit top bar on the nine Conventional BMS pages (PRD-CONV-EQUIPMENT-TRUTH E7a;
 * standard: standarization/SITE_CHROME_STANDARD.md §9; component: js/conv/shell.js + css/conv-shell.css).
 *
 * Owner, 2026-11-18: "This button combo is looking a bit flat. [...] lose the outline [on Login]. [...] the main CTA
 * needs to have some more lift [...] add some indent shadow. On hover, give it a subtle glow with a conic gradient
 * stroke [...] rotating. [...] swap the text of the main CTA to something that feels like a win. [...] make sure on ALL
 * pages of this BMS the buttons are in the same position." Second message: "on hovering, change the text to
 * something that feels like a win, and animate the send icon in a loop transition where the plane flies away and
 * repeats".
 *
 * Every page is RENDERED (1440 x 900 and 390 x 844, hover emulated as hover: hover / pointer: fine) and measured:
 *   C1 the bar is 48 px, computed sticky, at top 0 (also after a scroll); slots in the order
 *      back · portfolio · title · prd · manual · alarm · cta · login · theme · clock (· more)
 *   C2 same position: at 1440 each slot's left edge is equal across the nine pages (± 1 px) — empty slots included;
 *      the right group (prd … clock) measured from the right edge; and again WHILE the CTA is hovered
 *   C3 Login is bare at rest (no border, transparent background, no background image), hit height >= 44, a visible
 *      focus ring when reached by Tab
 *   C4 exactly one primary CTA (cdu-mini-bms: none — it has no Ask; the slot stays empty), its accessible name the
 *      rest label in both states; rest = an outer AND an inset shadow; real hover = the ring pseudo-element has a
 *      conic-gradient and a RUNNING animation, the bloom is blurred <= 12 px at opacity <= .55, the win label is the
 *      visible one, the send icon runs its loop, the button box (x, width, height) and every other slot unchanged;
 *      pressed = no outer shadow, no ring; reduced motion = no running animation on the button, win label still shown;
 *      away from it = nothing running
 *   C5 the CTA still acts (Ask panel opens; dc-conventional: the Design Studio opens); Alarm history opens its
 *      workspace; Back / Portfolio hrefs are the ones the old bars had
 *   C6 390: no sideways scroll, nothing of the bar outside the viewport, Back + title + CTA + Login visible, More
 *      lists every secondary action the page has and each works, every bar / menu target >= 44 px high
 *   C7 every bar label >= 4.5 : 1 against what is painted behind it, at rest and hovered (transitions off)
 *   C8 no page error; Tab order through the bar = visual order
 *
 * Red proof: RZ_CONV_SHELL_PLANT_CSS='<css>' injects a defect into every page (README in the standard §9).
 * Run: TMPDIR=$HOME/.cache/qa-tmp rz-lane -l 2 -t 1500 -- node tools/test-conv-shell.mjs [--page=a.html,b.html] [--shots=<dir>]
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { isSupabaseModule, signedInSupabaseBody, signedInStorage, signedOutSupabaseBody } from './lib/signed-in-supabase.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const SHOTS = arg('shots') || '';
const PLANT = process.env.RZ_CONV_SHELL_PLANT_CSS || '';
const SLOTS = ['back', 'portfolio', 'title', 'prd', 'manual', 'alarm', 'cta', 'login', 'theme', 'clock', 'more'];
const LEFT = ['back', 'portfolio', 'title'], RIGHT = ['prd', 'manual', 'alarm', 'cta', 'login', 'theme', 'clock'];
const MENU = ['portfolio', 'prd', 'manual', 'alarm'];
const ASK = { rest: 'Get the answer', win: 'Answer in seconds' }, DESIGN = { rest: 'Get my design', win: 'Design ready in one click' };
/* expected per page: CTA labels (null = no primary action exists), and the Back / Portfolio hrefs the old bars had */
const PAGES = {
  'dc-conventional.html': { cta: DESIGN, back: 'datacenter-solutions.html', portfolio: 'index.html' },
  'datahall.html': { cta: ASK, back: 'dc-conventional.html', portfolio: 'index.html' },
  'chiller-plant.html': { cta: ASK, back: 'dc-conventional.html', portfolio: 'index.html' },
  'water-system.html': { cta: ASK, back: 'dc-conventional.html', portfolio: 'index.html' },
  'fire-system.html': { cta: ASK, back: 'dc-conventional.html', portfolio: 'index.html' },
  'fuel-system.html': { cta: ASK, back: 'dc-conventional.html', portfolio: null },
  'ict.html': { cta: ASK, back: 'dc-conventional.html', portfolio: 'index.html' },
  'EPMS_Telemetry.html': { cta: ASK, back: 'dc-conventional.html', portfolio: 'index.html' },
  'cdu-mini-bms.html': { cta: null, back: null, portfolio: 'index.html' },
};
const ONLY = arg('page') ? arg('page').split(',') : null;
const pages = Object.keys(PAGES).filter((p) => !ONLY || ONLY.includes(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

const fails = [];
let passes = 0;
const ok = (cond, law, msg) => { if (cond) passes++; else fails.push(`${law} ${msg}`); };

const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2'] });

async function open(file, { width, signedIn, reduce = false, theme = 'dark' }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 160)));
  await page.setRequestInterception(true);
  page.on('request', (q) => {
    const u = q.url();
    if (isSupabaseModule(u)) return q.respond({ status: 200, contentType: 'text/javascript', body: signedIn ? signedInSupabaseBody({ email: 'gate.user@resistancezero.com', tier: 'pro' }) : signedOutSupabaseBody() });
    if (u.startsWith(O) || u.startsWith('data:')) return q.continue();
    if (u.startsWith('https://ipapi.co/')) return q.respond({ status: 200, contentType: 'application/json', body: '{}' });
    return q.respond({ status: 204, contentType: 'text/plain', body: '' });
  });
  if (signedIn) await page.evaluateOnNewDocument((entries) => entries.forEach(([k, v]) => localStorage.setItem(k, v)), signedInStorage({ tier: 'pro' }));
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  if (PLANT) await page.evaluateOnNewDocument((css) => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.id = 'rz-plant'; s.textContent = css; document.head.appendChild(s); }), PLANT);
  await page.setViewport({ width, height: width > 800 ? 900 : 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);   /* hover/pointer come from the launch flags (puppeteer cannot emulate them) */
  await page.goto(O + file, { waitUntil: 'load', timeout: 60000 });
  if (!(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches))) throw new Error('hover / pointer emulation failed: the hover laws would measure nothing');
  /* the cockpits are tier-gated: clear the gate the way every cockpit gate does (tools/lib/cockpit-audit-state.mjs) */
  try { await enterAuthorizedAuditState(page, file.replace(/\.html$/, '')); } catch (e) { /* not a gated identity (EPMS_Telemetry) */ }
  /* auth.js, rz-ask.js and conv-alarm-workspace.js fill their slots after load */
  await page.waitForFunction((hasCta) => {
    const s = document.querySelector('.cv-bar'); if (!s) return false;
    return !hasCta || !!document.querySelector('[data-cv-primary]');
  }, { timeout: 20000 }, !!PAGES[file].cta).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  return { page, errors };
}

const geom = () => {
  const bar = document.querySelector('.cv-bar');
  if (!bar) return null;
  const r = bar.getBoundingClientRect(), cs = getComputedStyle(bar);
  const slots = {};
  bar.querySelectorAll('[data-cv-slot]').forEach((s) => {
    const q = s.getBoundingClientRect(), shown = getComputedStyle(s).display !== 'none';
    slots[s.dataset.cvSlot] = { l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width), shown, filled: s.children.length > 0 };
  });
  const btn = document.querySelector('[data-cv-primary]'), b = btn ? btn.getBoundingClientRect() : null;
  return { pos: cs.position, top: Math.round(r.top), h: Math.round(r.height), order: [...bar.querySelectorAll('[data-cv-slot]')].map((s) => s.dataset.cvSlot), slots, iw: innerWidth,
    btn: b ? { x: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) } : null };
};

/* ---------------------------------------------------------------- 1440: C1 C2 C3 C7(rest) C8 (signed out) */
const at1440 = {};
for (const file of pages) {
  const { page, errors } = await open(file, { width: 1440, signedIn: false });
  const g = await page.evaluate(geom);
  ok(!!g, 'C1', `${file}: no .cv-bar`);
  if (!g) { await page.close(); continue; }
  at1440[file] = g;
  ok(g.pos === 'sticky' && g.top === 0 && Math.abs(g.h - 48) <= 1, 'C1', `${file}: bar ${g.pos} top ${g.top} height ${g.h} (want sticky, 0, 48)`);
  ok(g.order.join(',') === SLOTS.join(','), 'C1', `${file}: slot order ${g.order.join(',')}`);
  const shownX = SLOTS.filter((s) => g.slots[s] && g.slots[s].shown).map((s) => g.slots[s].l);
  ok(shownX.every((x, i) => i === 0 || x >= shownX[i - 1]), 'C1', `${file}: slots not left-to-right ${shownX.join(',')}`);
  const stuck = await page.evaluate(async () => {
    const se = document.scrollingElement; if (se.scrollHeight <= innerHeight + 4) return null;
    window.scrollTo(0, 300); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t = Math.round(document.querySelector('.cv-bar').getBoundingClientRect().top); window.scrollTo(0, 0); return t;
  });
  ok(stuck === null || stuck === 0, 'C1', `${file}: after a 300 px scroll the bar sits at ${stuck}`);

  /* C3 Login */
  const login = await page.evaluate(() => {
    const b = document.querySelector('.cv-slot--login #rzLoginBtn');
    if (!b) return null;
    const c = getComputedStyle(b), r = b.getBoundingClientRect();
    return { bw: c.borderTopWidth + c.borderRightWidth + c.borderBottomWidth + c.borderLeftWidth, bs: c.borderTopStyle, bg: c.backgroundColor, bi: c.backgroundImage, h: r.height, deco: c.textDecorationLine };
  });
  if (file === 'EPMS_Telemetry.html') ok(login === null, 'C3', `${file}: the page loads no auth.js, its Login slot must stay empty`);
  else {
    ok(!!login, 'C3', `${file}: no Login in the login slot`);
    if (login) {
      ok((login.bs === 'none' || login.bw === '0px0px0px0px') && /rgba\(0, 0, 0, 0\)|transparent/.test(login.bg) && login.bi === 'none', 'C3', `${file}: Login not bare at rest (border ${login.bs} ${login.bw}, bg ${login.bg}, image ${login.bi})`);
      ok(login.h >= 44, 'C3', `${file}: Login hit height ${login.h}`);
      ok(!/underline/.test(login.deco), 'C3', `${file}: Login underlined at rest`);
    }
  }

  /* C8 Tab order through the bar = visual order; C3 focus ring on the way */
  /* shell.js re-places its slots on load and 600 ms later; a focused control moved then loses focus */
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  const tab = await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  void tab;
  await page.mouse.click(2, 300).catch(() => {});
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '#'; a.id = 'cv-gate-start'; document.body.insertBefore(a, document.body.firstChild); a.focus(); });
  const seq = [];
  let ring = null;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => {
      const a = document.activeElement, bar = document.querySelector('.cv-bar');
      if (!a || !bar.contains(a)) return { inBar: false };
      const r = a.getBoundingClientRect(), c = getComputedStyle(a);
      return { inBar: true, x: Math.round(r.left), id: a.id || a.className, login: a.id === 'rzLoginBtn', ring: c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2 };
    });
    if (s.inBar) { seq.push(s); if (s.login) ring = s.ring; } else if (seq.length) break;
  }
  ok(seq.length >= 2, 'C8', `${file}: Tab reached ${seq.length} bar controls`);
  ok(seq.every((s, i) => i === 0 || s.x >= seq[i - 1].x), 'C8', `${file}: Tab order is not the visual order: ${seq.map((s) => s.id + '@' + s.x).join(' ')}`);
  if (login) ok(ring === true, 'C3', `${file}: Login shows no focus ring when reached by Tab (${ring}; Tab went ${seq.map((s) => s.id).join(' > ')})`);

  /* C7 rest contrast */
  const low = await page.evaluate(contrastScan);
  ok(!low.length, 'C7', `${file}: bar labels under 4.5:1 at rest: ${low.join(' | ')}`);
  ok(!errors.length, 'C8', `${file}: page errors: ${errors.join(' | ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e7a-1440-${file.replace('.html', '')}.png`, clip: { x: 0, y: 0, width: 1440, height: 60 } });
  await page.close();
}

/* C2 — same x per slot across the nine pages */
const files = Object.keys(at1440);
if (files.length > 1) {
  for (const s of [...LEFT, ...RIGHT]) {
    const xs = files.map((f) => (LEFT.includes(s) ? at1440[f].slots[s].l : at1440[f].iw - at1440[f].slots[s].l));
    ok(Math.max(...xs) - Math.min(...xs) <= 1, 'C2', `slot ${s}: ${LEFT.includes(s) ? 'left x' : 'distance from the right edge'} differs across pages: ${files.map((f, i) => f.replace('.html', '') + '=' + xs[i]).join(' ')}`);
  }
}

/* ---------------------------------------------------------------- 1440: C4 C5 C7(hover) (signed in) */
for (const file of pages) {
  const want = PAGES[file];
  const { page, errors } = await open(file, { width: 1440, signedIn: true });
  const prim = await page.evaluate(() => [...document.querySelectorAll('[data-cv-primary]')].filter((b) => b.getBoundingClientRect().width > 0).length);
  if (!want.cta) { ok(prim === 0, 'C4', `${file}: ${prim} primary CTA(s) — the page has no Ask and no generator, the slot must stay empty`); }
  else {
    ok(prim === 1, 'C4', `${file}: ${prim} primary CTAs (want 1)`);
    if (file === 'dc-conventional.html') await page.waitForFunction(() => !document.getElementById('genDesignTrigConv').disabled, { timeout: 30000 }).catch(() => {});
    const read = () => {
      const b = document.querySelector('[data-cv-primary]'), f = b.querySelector('.cv-cta__face');
      const be = getComputedStyle(b, '::before'), af = getComputedStyle(b, '::after');
      const op = (sel) => parseFloat(getComputedStyle(b.querySelector(sel)).opacity);
      const runs = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && (a.effect.target === b || b.contains(a.effect.target)));
      const bar = document.querySelector('.cv-bar'), r = b.getBoundingClientRect();
      return { name: b.getAttribute('aria-label'), winHidden: b.querySelector('.cv-cta__win').getAttribute('aria-hidden'), shadow: getComputedStyle(f).boxShadow,
        ringBg: be.backgroundImage, ringOp: parseFloat(be.opacity), bloomFilter: af.filter, bloomOp: parseFloat(af.opacity),
        rest: op('.cv-cta__rest'), win: op('.cv-cta__win'),
        anims: runs.map((a) => a.animationName + (a.effect.pseudoElement || '')),
        box: { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
        slots: [...bar.querySelectorAll('[data-cv-slot]')].map((s) => Math.round(s.getBoundingClientRect().left)).join(','), disabled: b.disabled };
    };
    const rest = await page.evaluate(read);
    ok(rest.name === want.cta.rest, 'C4', `${file}: accessible name "${rest.name}" (want "${want.cta.rest}")`);
    ok(rest.winHidden === 'true', 'C4', `${file}: the win label is not aria-hidden`);
    const parts = rest.shadow.split(/,(?![^(]*\))/);
    ok(parts.some((p) => /inset/.test(p)) && parts.some((p) => !/inset/.test(p) && !/^\s*none/.test(p)), 'C4', `${file}: rest shadow lacks an outer + inset pair: ${rest.shadow}`);
    ok(!rest.anims.length, 'C4', `${file}: animations running at rest: ${rest.anims.join(',')}`);
    ok(!rest.disabled, 'C4', `${file}: the CTA is still disabled (hover cannot be measured)`);
    const box = await page.$eval('[data-cv-primary]', (b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(box.x, box.y, { steps: 4 });
    await new Promise((r) => setTimeout(r, 600));
    const hov = await page.evaluate(read);
    ok(/conic-gradient/.test(hov.ringBg) && hov.ringOp > 0.5, 'C4', `${file}: no conic ring on hover (${hov.ringBg.slice(0, 40)}, opacity ${hov.ringOp})`);
    ok(hov.anims.some((a) => /cv-ring-spin::before/.test(a)), 'C4', `${file}: the ring does not rotate on hover (${hov.anims.join(',')})`);
    ok(hov.anims.some((a) => /cv-plane$/.test(a)), 'C4', `${file}: the send icon does not loop on hover (${hov.anims.join(',')})`);
    const blur = parseFloat((hov.bloomFilter.match(/blur\(([\d.]+)px\)/) || [])[1] || 0);
    ok(blur > 0 && blur <= 12 && hov.bloomOp > 0 && hov.bloomOp <= 0.55, 'C4', `${file}: bloom blur ${blur}px opacity ${hov.bloomOp} (want 0 < blur <= 12, 0 < opacity <= .55)`);
    ok(hov.win > 0.95 && hov.rest < 0.05, 'C4', `${file}: hover shows rest ${hov.rest} / win ${hov.win} (want the win label)`);
    ok(hov.name === want.cta.rest, 'C4', `${file}: accessible name on hover "${hov.name}"`);
    ok(JSON.stringify(hov.box) === JSON.stringify(rest.box), 'C4', `${file}: the button box moved on hover ${JSON.stringify(rest.box)} -> ${JSON.stringify(hov.box)}`);
    ok(hov.slots === rest.slots, 'C2', `${file}: slots moved while the CTA is hovered (${rest.slots} -> ${hov.slots})`);
    /* C7 on hover */
    const lowH = await page.evaluate(contrastScan);
    ok(!lowH.length, 'C7', `${file}: bar labels under 4.5:1 with the CTA hovered: ${lowH.join(' | ')}`);
    if (SHOTS && file === 'datahall.html') await shotCta(page, 'hover');
    if (SHOTS && file === 'dc-conventional.html') await shotCta(page, 'hover-design');
    /* pressed */
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 250));
    const prs = await page.evaluate(read);
    const pparts = prs.shadow.split(/,(?![^(]*\))/);
    ok(!pparts.some((p) => !/inset/.test(p) && !/^\s*none/.test(p)) && prs.ringOp === 0, 'C4', `${file}: pressed keeps elevation or glow (${prs.shadow}; ring ${prs.ringOp})`);
    if (SHOTS && file === 'datahall.html') await shotCta(page, 'pressed');
    await page.mouse.move(5, 500); await page.mouse.up();
    await new Promise((r) => setTimeout(r, 500));
    const away = await page.evaluate(read);
    ok(!away.anims.length, 'C4', `${file}: animations still running after the pointer left: ${away.anims.join(',')}`);
    if (SHOTS && file === 'datahall.html') await shotCta(page, 'rest');
    /* C5 the action */
    await page.click('[data-cv-primary]');
    const acted = await page.waitForFunction((dc) => dc ? !!document.querySelector('#rzDesignStudio[data-open="true"]') : (document.getElementById('rz-ask-panel') && !document.getElementById('rz-ask-panel').hidden), { timeout: 8000 }, file === 'dc-conventional.html').then(() => true).catch(() => false);
    ok(acted, 'C5', `${file}: the CTA did not ${file === 'dc-conventional.html' ? 'open the Design Studio' : 'open the Ask panel'}`);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  }
  /* C5 alarm history + hrefs */
  const hasAlarm = await page.$('.cv-slot--alarm #rzConvAlarmLaunch');
  if (file !== 'cdu-mini-bms.html') {
    ok(!!hasAlarm, 'C5', `${file}: Alarm history is not in its slot`);
    if (hasAlarm) {
      const cls = await page.$eval('#rzConvAlarmLaunch', (b) => getComputedStyle(b).backgroundColor);
      await page.evaluate(() => document.getElementById('rzConvAlarmLaunch').click());
      const open1 = await page.waitForFunction(() => { const s = document.getElementById('rzConvAlarmScrim'); return s && !s.hidden; }, { timeout: 8000 }).then(() => true).catch(() => false);
      ok(open1, 'C5', `${file}: Alarm history did not open its workspace`);
      ok(!/245, 158, 11|232, 181, 99/.test(cls), 'C5', `${file}: Alarm history is still painted amber (${cls}) — amber is for abnormal state`);
      await page.evaluate(() => { const c = document.getElementById('rzConvAlarmClose'); if (c) c.click(); });
    }
  }
  const hrefs = await page.evaluate(() => ({ back: (document.querySelector('.cv-slot--back a') || {}).getAttribute?.('href') || null, portfolio: (document.querySelector('.cv-slot--portfolio a') || {}).getAttribute?.('href') || null }));
  ok(hrefs.back === want.back && hrefs.portfolio === want.portfolio, 'C5', `${file}: Back ${hrefs.back} / Portfolio ${hrefs.portfolio} (want ${want.back} / ${want.portfolio})`);
  ok(!errors.length, 'C8', `${file}: page errors (signed in): ${errors.join(' | ')}`);
  await page.close();

  /* reduced motion */
  if (want.cta) {
    const { page: rp } = await open(file, { width: 1440, signedIn: true, reduce: true });
    if (file === 'dc-conventional.html') await rp.waitForFunction(() => !document.getElementById('genDesignTrigConv').disabled, { timeout: 30000 }).catch(() => {});
    const c = await rp.$eval('[data-cv-primary]', (b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await rp.mouse.move(c.x, c.y, { steps: 3 });
    await new Promise((r) => setTimeout(r, 500));
    const rm = await rp.evaluate(() => {
      const b = document.querySelector('[data-cv-primary]');
      const runs = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && (a.effect.target === b || b.contains(a.effect.target)));
      return { anims: runs.map((a) => a.animationName), win: parseFloat(getComputedStyle(b.querySelector('.cv-cta__win')).opacity), name: b.getAttribute('aria-label'), ring: parseFloat(getComputedStyle(b, '::before').opacity) };
    });
    ok(!rm.anims.length, 'C4', `${file}: reduced motion still runs ${rm.anims.join(',')}`);
    ok(rm.win > 0.95 && rm.name === want.cta.rest, 'C4', `${file}: reduced motion hover label ${rm.win} / name ${rm.name}`);
    ok(rm.ring > 0, 'C4', `${file}: reduced motion shows no static ring`);
    await rp.close();
  }
}

/* ---------------------------------------------------------------- 1440 light: C7 (signed out)
   since v3.77.0: the light theme read Login at 1.2:1 because a page register (rz-cockpit-instrument.css) outranked
   the bar's own colour; every bar label must hold 4.5:1 in the light theme too */
for (const file of pages) {
  const { page } = await open(file, { width: 1440, signedIn: false, theme: 'light' });
  const lowLight = await page.evaluate(contrastScan);
  ok(!lowLight.length, 'C7', `${file}: light theme bar labels under 4.5:1: ${lowLight.join(' | ')}`);
  await page.close();
}

/* ---------------------------------------------------------------- 390: C6 (signed in) */
for (const file of pages) {
  const want = PAGES[file];
  const { page, errors } = await open(file, { width: 390, signedIn: true });
  const m = await page.evaluate(() => {
    const bar = document.querySelector('.cv-bar');
    const vis = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const ctrls = [...bar.querySelectorAll('a, button')].filter(vis);
    const out = [...bar.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map((e) => e.className || e.tagName);
    const shown = (s) => { const n = bar.querySelector('.cv-slot--' + s); return !!(n && vis(n) && n.children.length && [...n.querySelectorAll('*')].some(vis)); };
    return { ovf: document.documentElement.scrollWidth - innerWidth, h: Math.round(bar.getBoundingClientRect().height), out: [...new Set(out)].slice(0, 6), small: ctrls.filter((e) => e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5).map((e) => (e.id || e.className) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)),
      back: shown('back'), title: shown('title'), cta: shown('cta'), login: shown('login'), more: shown('more') };
  });
  ok(m.ovf <= 1, 'C6', `${file}: page scrolls sideways by ${m.ovf}px at 390`);
  ok(Math.abs(m.h - 48) <= 1, 'C6', `${file}: bar is ${m.h}px at 390`);
  ok(!m.out.length, 'C6', `${file}: bar parts outside the viewport: ${m.out.join(',')}`);
  ok(!m.small.length, 'C6', `${file}: bar targets under 44 px: ${m.small.join(' ')}`);
  /* a title cut by the bar must say so: a flex box clips its text with no ellipsis ("Conve") */
  const t = await page.evaluate(() => {
    const n = document.querySelector('.cv-bar .cv-title'); if (!n) return null;
    const c = getComputedStyle(n);
    return { cut: n.scrollWidth > n.clientWidth + 1, display: c.display, overflow: c.overflow, to: c.textOverflow };
  });
  ok(!t || !t.cut || (!/flex|grid/.test(t.display) && t.to === 'ellipsis' && t.overflow !== 'visible'), 'C6', `${file}: at 390 the title is cut without an ellipsis (${JSON.stringify(t)})`);
  ok((m.back || !want.back) && m.title && (m.cta || !want.cta) && (m.login || file === 'EPMS_Telemetry.html') && m.more, 'C6', `${file}: at 390 Back ${m.back} title ${m.title} CTA ${m.cta} Login ${m.login} More ${m.more}`);
  /* More lists every secondary action the page has, each works */
  await page.click('.cv-more__btn');
  await new Promise((r) => setTimeout(r, 300));
  const menu = await page.evaluate((expect) => {
    const p = document.getElementById('cvMorePanel');
    const items = [...p.querySelectorAll('a, button')].filter((e) => e.getBoundingClientRect().height > 0);
    const r = p.getBoundingClientRect();
    return { open: !p.hidden, homes: [...p.children].map((c) => c.getAttribute('data-cv-home')), hrefs: items.filter((e) => e.tagName === 'A').map((e) => e.getAttribute('href')),
      small: items.filter((e) => e.getBoundingClientRect().height < 43.5).length, inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, focusIn: p.contains(document.activeElement), expect };
  }, MENU);
  const hasLaunch = !!(await page.$('#rzConvAlarmLaunch'));
  const filled = MENU.filter((s) => (s !== 'alarm' || hasLaunch) && (at1440[file] ? at1440[file].slots[s].filled : true));
  ok(menu.open && menu.inView && menu.focusIn, 'C6', `${file}: More did not open in view with focus inside (${JSON.stringify({ open: menu.open, inView: menu.inView, focusIn: menu.focusIn })})`);
  ok(filled.every((s) => menu.homes.includes(s)), 'C6', `${file}: More lists ${menu.homes.join(',')} (want ${filled.join(',')})`);
  ok(!menu.small, 'C6', `${file}: ${menu.small} More items under 44 px`);
  /* every item in the open More panel starts its text on one line, including links auth.js lifts over it */
  const starts = await page.evaluate(() => {
    const p = document.getElementById('cvMorePanel'), pr = p.getBoundingClientRect();
    const inside = (r) => r.height > 0 && r.left >= pr.left - 1 && r.right <= pr.right + 1 && r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1;
    const els = [...p.querySelectorAll('a, button'), ...document.querySelectorAll('.rz-public-contract-layer a')].filter((e) => inside(e.getBoundingClientRect()));
    return els.map((e) => {
      const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let tn;
      while ((tn = w.nextNode())) if (tn.textContent.trim()) break;
      if (!tn) return null;
      const rg = document.createRange(); rg.selectNodeContents(tn);
      const left = e.querySelector('svg') ? e.querySelector('svg').getBoundingClientRect().left : rg.getBoundingClientRect().left;
      return { t: e.textContent.trim().slice(0, 16), x: Math.round(left - e.getBoundingClientRect().left) };
    }).filter(Boolean);
  });
  const xs = starts.map((s) => s.x);
  ok(!xs.length || Math.max(...xs) - Math.min(...xs) <= 4, 'C6', `${file}: More items do not line up: ${starts.map((s) => s.t + '@' + s.x).join(' ')}`);
  ok(menu.hrefs.every((h) => h && fs.existsSync(path.join(ROOT, h.split('#')[0]))), 'C6', `${file}: More link targets missing: ${menu.hrefs.join(',')}`);
  if (SHOTS && ['datahall.html', 'fuel-system.html', 'dc-conventional.html'].includes(file)) await page.screenshot({ path: `${SHOTS}/e7a-390-more-${file.replace('.html', '')}.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
  if (filled.includes('alarm')) {
    const where = await page.evaluate(() => { const l = document.getElementById('rzConvAlarmLaunch'); return l ? (l.closest('#cvMorePanel') ? 'more' : (l.closest('.cv-bar') ? 'bar' : 'elsewhere:' + (l.parentElement && l.parentElement.className))) : 'none'; });
    ok(where === 'more', 'C6', `${file}: at 390 Alarm history is not in More (${where})`);
    if (where !== 'none') await page.evaluate(() => document.getElementById('rzConvAlarmLaunch').click());
    const opened = await page.waitForFunction(() => { const s = document.getElementById('rzConvAlarmScrim'); return s && !s.hidden; }, { timeout: 8000 }).then(() => true).catch(() => false);
    ok(opened, 'C6', `${file}: Alarm history from More did not open its workspace`);
  }
  await page.keyboard.press('Escape');
  ok(!errors.length, 'C8', `${file}: page errors at 390: ${errors.join(' | ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e7a-390-${file.replace('.html', '')}.png`, clip: { x: 0, y: 0, width: 390, height: 60 } });
  await page.close();
}

async function shotCta(page, tag) {
  const r = await page.$eval('[data-cv-primary]', (b) => { const q = b.getBoundingClientRect(); return { x: q.left - 24, y: Math.max(0, q.top - 8), width: q.width + 48, height: q.height + 16 }; });
  await page.screenshot({ path: `${SHOTS}/e7a-cta-${tag}.png`, clip: r });
}

/* WCAG contrast of every visible text node in the bar against the first opaque background behind it */
function contrastScan() {
  const st = document.getElementById('cv-gate-notrans') || Object.assign(document.createElement('style'), { id: 'cv-gate-notrans', textContent: '*,*::before,*::after{transition:none!important}' });
  document.head.appendChild(st);
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return { L: 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), a: m.length > 3 ? m[3] : 1 }; };
  const bgOf = (e) => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (lum(c).a > 0.5) return c; } return 'rgb(255,255,255)'; };
  const bar = document.querySelector('.cv-bar'), bad = [];
  const w = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) {
    if (!t.textContent.trim()) continue;
    const e = t.parentElement, cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (!r.width || !r.height || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) continue;
    let hidden = false; for (let n = e; n && n !== bar; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || parseFloat(c.opacity) < 0.5) { hidden = true; break; } }
    if (hidden) continue;
    if (e.closest('[disabled]')) continue;   /* WCAG 1.4.3 exempts inactive controls */
    const a = lum(cs.color).L, b = lum(bgOf(e)).L, ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) bad.push(`"${t.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
  }
  return bad;
}

await browser.close();
srv.close();
console.log(`test-conv-shell: ${passes} passed, ${fails.length} failed (${pages.length} pages, 1440 + 390)`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
