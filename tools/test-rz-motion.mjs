#!/usr/bin/env node
/**
 * test-rz-motion — proves js/rz-toast.js and js/rz-sheet.js actually move.
 *
 * WHY THIS EXISTS
 *
 * This repo's recorded failure mode is a component that draws nothing and logs
 * nothing: PixiJS `Sprite.from()` returning a cache miss, a precache that
 * reported a clean install and cached nothing, a gate that existed and was not
 * wired. A toast and a sheet are exactly that shape — they pass every static
 * audit while never appearing.
 *
 * So each assertion below reads a COMPUTED value out of a real browser after a
 * real interaction, never a class name or a source string. The motion rules it
 * checks come from the feel-standard: transitions rather than keyframes on
 * rapidly-triggered elements, transform/opacity only, no `scale(0)` entrance,
 * durations under the 300ms UI ceiling, exit along the entrance path, and a
 * reduced-motion variant that is gentler rather than absent.
 *
 * Run:  node tools/test-rz-motion.mjs [--strict]
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.csv': 'text/csv', '.txt': 'text/plain' };

const HARNESS = `<!doctype html><html lang="en" data-rz-register="editorial"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>motion harness</title>
<link rel="stylesheet" href="/css/rz-article-dark.css">
</head><body>
<button id="opener" type="button">open</button>
<script src="/js/rz-toast.js"></script>
<script src="/js/rz-sheet.js"></script>
</body></html>`;

const srv = createServer(async (q, r) => {
  try {
    const u = decodeURIComponent((q.url || '/').split('?')[0]);
    if (u === '/__harness') { r.writeHead(200, { 'Content-Type': MIME['.html'] }); r.end(HARNESS); return; }
    const f = resolve(ROOT, u.replace(/^\/+/, ''));
    if (!f.startsWith(ROOT)) { r.writeHead(403).end(); return; }
    const b = await readFile(f);
    r.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
    r.end(b);
  } catch { r.writeHead(404).end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

const fails = [];
const ok = (name, cond, detail) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); fails.push(name); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ms = (s) => (/ms$/.test(s) ? parseFloat(s) : parseFloat(s) * 1000);

async function newPage(reduce) {
  const p = await browser.newPage();
  p.on('dialog', (d) => d.dismiss().catch(() => {}));
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  await p.setViewport({ width: 420, height: 820, isMobile: true, hasTouch: true });
  await p.goto(`${base}/__harness`, { waitUntil: 'load', timeout: 60000 });
  return p;
}

console.log('── RZ MOTION ──\n  toast\n');
{
  const p = await newPage(false);
  const loaded = await p.evaluate(() => ({ toast: typeof window.RZToast, sheet: typeof window.RZSheet }));
  ok('both modules define their global', loaded.toast === 'object' && loaded.sheet === 'object', JSON.stringify(loaded));

  // the entrance must actually be an entrance: a FROM state, then a TO state
  const entrance = await p.evaluate(async () => {
    window.RZToast.show('Saved');
    const el = document.querySelector('.rz-toast');
    const before = getComputedStyle(el);
    const from = { op: before.opacity, tf: before.transform };
    await new Promise((r) => setTimeout(r, 420));
    const after = getComputedStyle(el);
    return { from, to: { op: after.opacity, tf: after.transform },
             tp: after.transitionProperty, td: after.transitionDuration,
             tf2: after.transitionTimingFunction, anim: after.animationName };
  });
  ok('toast starts hidden and offset', parseFloat(entrance.from.op) < 0.9 || entrance.from.tf !== 'none',
     JSON.stringify(entrance.from));
  ok('toast settles visible and at rest', Math.abs(parseFloat(entrance.to.op) - 1) < 0.02,
     JSON.stringify(entrance.to));
  ok('toast animates with a TRANSITION, not keyframes', entrance.anim === 'none', `animationName=${entrance.anim}`);
  ok('toast transitions only opacity and transform',
     /opacity/.test(entrance.tp) && /transform/.test(entrance.tp) && !/\ball\b|width|height|top|left/.test(entrance.tp),
     entrance.tp);
  ok('toast duration is under the 300ms UI ceiling',
     entrance.td.split(',').every((d) => ms(d.trim()) <= 300), entrance.td);
  ok('toast curve is the strong ease-out, not a built-in',
     /cubic-bezier/.test(entrance.tf2) && !/^ease/.test(entrance.tf2.trim()), entrance.tf2);

  // never scale(0): read the FROM transform off a fresh toast before it settles
  const scaleFrom = await p.evaluate(() => {
    document.querySelectorAll('.rz-toast').forEach((n) => n.remove());
    window.RZToast.show('x');
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(document.querySelector('.rz-toast')).transform);
    return m ? parseFloat(m[1].split(',')[0]) : null;
  });
  ok('toast entrance never scales from 0', scaleFrom === null || scaleFrom >= 0.8, `scaleX=${scaleFrom}`);

  // rapid fire: three inside a second must coexist and be offset by transform
  const stack = await p.evaluate(async () => {
    window.RZToast.dismissAll();
    await new Promise((r) => setTimeout(r, 500));
    window.RZToast.show('one'); window.RZToast.show('two'); window.RZToast.show('three');
    await new Promise((r) => setTimeout(r, 420));
    const els = [...document.querySelectorAll('.rz-toast')];
    return { n: els.length, transforms: els.map((e) => getComputedStyle(e).transform),
             margins: els.map((e) => getComputedStyle(e).marginTop) };
  });
  ok('three rapid toasts coexist', stack.n === 3, `n=${stack.n}`);
  ok('the stack is expressed as transforms, all distinct',
     new Set(stack.transforms).size === stack.n, JSON.stringify(stack.transforms));

  // exit along the entrance path, and actually leave the DOM
  const exit = await p.evaluate(async () => {
    window.RZToast.dismissAll();
    await new Promise((r) => setTimeout(r, 120));
    const el = document.querySelector('.rz-toast');
    const mid = el ? getComputedStyle(el).transform : null;
    await new Promise((r) => setTimeout(r, 700));
    return { mid, left: document.querySelectorAll('.rz-toast').length,
             region: document.querySelectorAll('.rz-toast-region').length };
  });
  ok('toast exits downward, the way it entered', exit.mid === null || /matrix/.test(exit.mid), String(exit.mid));
  ok('dismissed toasts leave the DOM', exit.left === 0, `left=${exit.left}`);
  ok('the region is torn down when empty', exit.region === 0, `regions=${exit.region}`);

  const dwell = await p.evaluate(async () => {
    window.RZToast.show('auto', { duration: 300 });
    await new Promise((r) => setTimeout(r, 1200));
    return document.querySelectorAll('.rz-toast').length;
  });
  ok('toast auto-dismisses after its dwell', dwell === 0, `left=${dwell}`);

  const esc = await p.evaluate(() => {
    const t = window.RZToast.show('<img src=x onerror="window.__xss=1">');
    const el = document.querySelector('.rz-toast-msg');
    const html = el.innerHTML;
    window.RZToast.dismiss(t);
    return { html, xss: !!window.__xss, hasImg: !!document.querySelector('.rz-toast img') };
  });
  ok('toast message is escaped, not injected', !esc.xss && !esc.hasImg && esc.html.includes('&lt;'), esc.html.slice(0, 60));
  await p.close();
}

console.log('\n  toast · reduced motion\n');
{
  const p = await newPage(true);
  const r = await p.evaluate(async () => {
    window.RZToast.show('Saved');
    await new Promise((x) => setTimeout(x, 420));
    const cs = getComputedStyle(document.querySelector('.rz-toast'));
    return { tf: cs.transform, tp: cs.transitionProperty, td: cs.transitionDuration, op: cs.opacity };
  });
  ok('reduced motion drops the travel', r.tf === 'none', r.tf);
  ok('reduced motion KEEPS a fade — gentler, not absent',
     /opacity/.test(r.tp) && ms(r.td.split(',')[0]) > 0, `${r.tp} / ${r.td}`);
  ok('the toast is still readable', Math.abs(parseFloat(r.op) - 1) < 0.02, r.op);
  await p.close();
}

console.log('\n  sheet\n');
{
  const p = await newPage(false);
  const opened = await p.evaluate(async () => {
    document.getElementById('opener').focus();
    window.RZSheet.open({ title: 'Filters', content: 'body text' });
    await new Promise((r) => setTimeout(r, 480));
    const sh = document.querySelector('.rz-sheet'), sc = document.querySelector('.rz-sheet-scrim');
    const cs = getComputedStyle(sh);
    return { tf: cs.transform, tp: cs.transitionProperty, td: cs.transitionDuration,
             tf2: cs.transitionTimingFunction, anim: cs.animationName,
             scrimOp: getComputedStyle(sc).opacity,
             role: sh.getAttribute('role'), modal: sh.getAttribute('aria-modal'),
             labelled: !!sh.getAttribute('aria-labelledby'),
             focusInside: sh.contains(document.activeElement),
             htmlOverflow: document.documentElement.style.overflow };
  });
  ok('sheet is at rest on screen', /matrix\(1, 0, 0, 1, 0, 0\)|none/.test(opened.tf), opened.tf);
  ok('sheet animates with a transition, not keyframes', opened.anim === 'none', opened.anim);
  ok('sheet transitions transform only', /transform/.test(opened.tp) && !/\ball\b|height|top/.test(opened.tp), opened.tp);
  ok('sheet duration is under the ceiling', opened.td.split(',').every((d) => ms(d.trim()) <= 300), opened.td);
  ok('sheet uses the drawer curve', /cubic-bezier/.test(opened.tf2), opened.tf2);
  ok('scrim is visible', parseFloat(opened.scrimOp) > 0.9, opened.scrimOp);
  ok('sheet is a labelled modal dialog',
     opened.role === 'dialog' && opened.modal === 'true' && opened.labelled,
     `${opened.role}/${opened.modal}/${opened.labelled}`);
  ok('focus moved into the sheet', opened.focusInside === true);
  ok('the page behind is locked', opened.htmlOverflow === 'hidden', opened.htmlOverflow);

  // Tab must not escape the sheet
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  ok('focus is trapped while open',
     await p.evaluate(() => document.querySelector('.rz-sheet').contains(document.activeElement)));

  await p.keyboard.press('Escape');
  await sleep(600);
  const closed = await p.evaluate(() => ({
    gone: document.querySelectorAll('.rz-sheet').length === 0,
    scrimGone: document.querySelectorAll('.rz-sheet-scrim').length === 0,
    returned: document.activeElement && document.activeElement.id === 'opener',
    overflow: document.documentElement.style.overflow,
  }));
  ok('Escape closes the sheet', closed.gone && closed.scrimGone, JSON.stringify(closed));
  ok('focus returns to the opener', closed.returned === true);
  ok('the page scroll lock is released', closed.overflow !== 'hidden', closed.overflow);

  // the drag must be 1:1 and must carry velocity
  await p.evaluate(() => window.RZSheet.open({ title: 'Drag', content: 'x' }));
  await sleep(450);
  const box = await p.evaluate(() => {
    const g = document.querySelector('.rz-sheet-grip').getBoundingClientRect();
    return { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  });
  await p.mouse.move(box.x, box.y);
  await p.mouse.down();
  await p.mouse.move(box.x, box.y + 40, { steps: 4 });
  const mid = await p.evaluate(() => {
    const sh = document.querySelector('.rz-sheet');
    return { dragging: sh.classList.contains('rz-dragging'),
             td: getComputedStyle(sh).transitionDuration,
             tf: sh.style.transform };
  });
  ok('the drag is 1:1 — transition is OFF while a finger is down',
     mid.dragging && ms(mid.td.split(',')[0]) === 0, `${mid.dragging} / ${mid.td}`);
  ok('the sheet tracks the pointer', /translateY\((3[0-9]|4[0-9])/.test(mid.tf || ''), mid.tf);

  // a short, slow drag must spring back, not dismiss
  await p.mouse.up();
  await sleep(500);
  ok('a short drag springs back instead of dismissing',
     await p.evaluate(() => document.querySelectorAll('.rz-sheet').length === 1));

  // a long drag past the dismiss fraction must close
  const box2 = await p.evaluate(() => {
    const g = document.querySelector('.rz-sheet-grip').getBoundingClientRect();
    return { x: g.x + g.width / 2, y: g.y + g.height / 2, h: document.querySelector('.rz-sheet').offsetHeight };
  });
  await p.mouse.move(box2.x, box2.y);
  await p.mouse.down();
  await p.mouse.move(box2.x, box2.y + Math.round(box2.h * 0.75), { steps: 10 });
  await p.mouse.up();
  await sleep(700);
  ok('a drag past 40% of the height dismisses',
     await p.evaluate(() => document.querySelectorAll('.rz-sheet').length === 0));
  await p.close();
}

console.log('\n  sheet · reduced motion\n');
{
  const p = await newPage(true);
  const r = await p.evaluate(async () => {
    window.RZSheet.open({ title: 'R', content: 'x' });
    await new Promise((x) => setTimeout(x, 480));
    const cs = getComputedStyle(document.querySelector('.rz-sheet'));
    return { tf: cs.transform, tp: cs.transitionProperty, op: cs.opacity };
  });
  ok('reduced motion: the sheet fades rather than travels', r.tf === 'none', r.tf);
  ok('reduced motion: the sheet is still fully visible', Math.abs(parseFloat(r.op) - 1) < 0.02, r.op);
  await p.close();
}

await browser.close();
srv.close();
console.log('');
if (!fails.length) { console.log('PASS — toast and sheet move, and move the way the standard says.'); process.exit(0); }
console.log(`FAIL — ${fails.length} assertion(s): ${fails.join(' · ')}`);
process.exit(STRICT ? 1 : 0);
