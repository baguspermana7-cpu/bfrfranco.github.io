#!/usr/bin/env node
// PRD-P09 FR-P09-2 — tab-loader: ensureTab(id) loads a tab's modules once, in order, and announces it.
// T1 ensureTab resolves after every module of the tab loaded, in the declared order, and dispatches rz:tab-ready {id}.
// T2 single flight: two concurrent calls share one load (each url fetched once) and the same promise.
// T3 a loaded tab resolves at once on later calls with no new fetch.
// T4 a failed module rejects, dispatches rz:tab-error {id, url}, and the NEXT call retries (the failure is not cached).
// T5 an unknown tab id rejects with a clear message and fetches nothing.
// T6 isReady(id) is false before, true after; tabs() lists the registry.
// B1 browser: real <script> injection runs the modules once and in order; rz:tab-ready reaches document listeners.
// B2 browser: a missing module fires rz:tab-error with its url and leaves no dead <script> behind; a shared module is not re-run.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOD = resolve(ROOT, 'js/datahall-ai/tab-loader.js');
if (!existsSync(MOD)) { console.error('FAIL test-datahall-tab-loader — js/datahall-ai/tab-loader.js missing'); process.exit(1); }
const TL = require(MOD);
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } };
function harness(failing) {
  const fetched = [], events = [], bad = new Set(failing || []);
  const loader = TL.create({ hall: ['js/a.js', 'js/b.js'], cooling: ['js/c.js'] }, {
    load: (url) => new Promise((res, rej) => { fetched.push(url); setTimeout(() => (bad.has(url) ? rej(new Error('404 ' + url)) : res()), 5); }),
    dispatch: (name, detail) => events.push([name, detail])
  });
  return { loader, fetched, events, bad };
}
let h = harness();
await h.loader.ensureTab('hall');
ok('T1 modules loaded in order', JSON.stringify(h.fetched) === JSON.stringify(['js/a.js', 'js/b.js']), h.fetched);
ok('T1 rz:tab-ready dispatched once with the id', JSON.stringify(h.events) === JSON.stringify([['rz:tab-ready', { id: 'hall' }]]), h.events);
h = harness();
const p1 = h.loader.ensureTab('cooling'), p2 = h.loader.ensureTab('cooling');
await Promise.all([p1, p2]);
ok('T2 single flight: same promise, one fetch', p1 === p2 && h.fetched.length === 1, h.fetched);
await h.loader.ensureTab('cooling');
ok('T3 loaded tab: no new fetch', h.fetched.length === 1);
h = harness(['js/b.js']);
let err = null; try { await h.loader.ensureTab('hall'); } catch (e) { err = e; }
ok('T4 failure rejects', !!err && /js\/b\.js/.test(err.message), err && err.message);
ok('T4 rz:tab-error carries id and url', h.events.some((e) => e[0] === 'rz:tab-error' && e[1].id === 'hall' && e[1].url === 'js/b.js'), h.events);
h.bad.clear();
await h.loader.ensureTab('hall');
ok('T4 next call retries and succeeds (failed url fetched again, loaded url not)', h.fetched.join() === 'js/a.js,js/b.js,js/b.js' && h.loader.isReady('hall'), h.fetched);
h = harness();
err = null; try { await h.loader.ensureTab('nope'); } catch (e) { err = e; }
ok('T5 unknown tab rejects, nothing fetched', !!err && /unknown tab "nope"/.test(err.message) && h.fetched.length === 0, err && err.message);
ok('T6 isReady before/after, tabs()', !h.loader.isReady('cooling') && JSON.stringify(h.loader.tabs()) === JSON.stringify(['hall', 'cooling']));
// ---- browser ----
{
  const { spawn } = await import('node:child_process'); const net = await import('node:net');
  const puppeteer = require('puppeteer');
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
  try {
    const p = await browser.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${port}/tools/fixtures/tab-loader/index.html`, { waitUntil: 'load' });
    const b1 = await p.evaluate(async () => { await Promise.all([__loader.ensureTab('ok'), __loader.ensureTab('ok')]); return { order: window.__order, ev: window.__events, ready: __loader.isReady('ok') }; });
    ok('B1 modules ran once, in order; rz:tab-ready on document', JSON.stringify(b1.order) === '["one","two"]' && JSON.stringify(b1.ev) === '[["rz:tab-ready",{"id":"ok"}]]' && b1.ready, b1);
    const b2 = await p.evaluate(async () => { let m = ''; try { await __loader.ensureTab('bad'); } catch (e) { m = e.message; }
      return { m, ev: window.__events.slice(1), order: window.__order, dead: document.querySelectorAll('script[src$="missing.js"]').length }; });
    ok('B2 missing module: rz:tab-error with url, no dead script, shared module not re-run', /missing\.js/.test(b2.m) && b2.ev.length === 1 && b2.ev[0][0] === 'rz:tab-error' && b2.ev[0][1].url === 'missing.js' && b2.dead === 0 && b2.order.length === 2, b2);
    ok('B no page errors', errs.length === 0, errs);
  } finally { await browser.close(); server.kill(); }
}
if (fail) { console.error(`FAIL test-datahall-tab-loader — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`PASS test-datahall-tab-loader — ${pass} checks: ordered load, single flight, cached success, retried failure, events`);
