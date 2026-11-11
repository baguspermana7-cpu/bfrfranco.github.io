// P13 part B — an RFS readiness gap becomes a Cx issue in one action, never twice, never automatically.
// U1 fromGap: title ≤ 114 (+ " (RFS)" = 120), severity hard→A soft→B info→C, discipline → pre-selected system, gate L3.
// U2 queue: send ok; same gap_id again → DUP; invalid (no system / external url) → INVALID; 101st → FULL;
//    items older than 7 days are dropped on load and counted.
// U3 intake with the real RZCxIssues store: one issue per item, title ends "(RFS)", source map holds the RFS url,
//    queue emptied; a refused item (bad system) stays queued with its code; an intaken gap cannot be queued again.
// U4 safeUrl accepts only "rfs-readiness-workbench.html#…".
// E1 RFS checklist: an open gap row has "→ Cx"; Send without a system is refused (nothing queued); with a system it
//    reads "Sent · Open Cx" and stays so after re-render.
// E2 Cx (?tab=analysis): banner "1 readiness gap waiting"; Add → one more issue, title "(RFS)", title links to the gap;
//    banner hidden. Dismiss empties the queue without adding.
// E3 both themes at 390 px: the send form and the banner fit, no horizontal overflow; no page errors.
// Run: node tools/test-handoff-cx.mjs [--base=http://127.0.0.1:PORT]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } };
if (!existsSync(join(ROOT, 'js/rz-handoff-cx.js'))) { console.error('FAIL test-handoff-cx — js/rz-handoff-cx.js missing'); process.exit(1); }
const X = require(join(ROOT, 'js/rz-handoff-cx.js'));
global.self = global; require(join(ROOT, 'js/rz-cx-plan.js')); require(join(ROOT, 'js/rz-cx-issues.js'));
const I = global.RZCxIssues || require(join(ROOT, 'js/rz-cx-issues.js'));
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; };

// ---- unit ----
const long = 'x'.repeat(200);
let g = X.fromGap({ unitId: 'unit_1', reqId: 'req_g4_001', title: long, discipline: 'mechanical', blockerClass: 'hard', evidenceIds: ['ev1'] });
ok('U1 title cut to 114', g.title.length === 114, g.title.length);
ok('U1 hard → A, mechanical → chillers, gate L3', g.severity === 'A' && g.system === 'chillers' && g.gate === 'L3', g);
ok('U1 soft → B, info → C, operations → no system', X.fromGap({ blockerClass: 'soft' }).severity === 'B' && X.fromGap({ blockerClass: 'info' }).severity === 'C' && X.fromGap({ discipline: 'operations' }).system === null);
ok('U4 safeUrl', X.safeUrl('rfs-readiness-workbench.html#gap-u:r') && !X.safeUrl('https://evil.example/rfs-readiness-workbench.html#x') && !X.safeUrl('javascript:alert(1)'));
let t = 1_000_000_000_000; const now = () => t;
let st = mem(), q = X.queue(st, now);
const item = (i, extra) => Object.assign(X.fromGap({ unitId: 'u', reqId: 'r' + i, title: 'Gap ' + i, discipline: 'electrical', blockerClass: 'soft' }), extra || {});
ok('U2 send ok', q.send(item(1)).ok === true);
ok('U2 same gap → DUP', q.send(item(1)).code === 'DUP');
ok('U2 no system → INVALID', q.send(item(2, { system: null })).code === 'INVALID');
ok('U2 external url → INVALID', q.send(item(3, { source_url: 'https://evil.example/' })).code === 'INVALID');
for (let i = 4; i < 103; i++) q.send(item(i));
ok('U2 cap 100 → FULL', q.load().items.length === 100 && q.send(item(500)).code === 'FULL', q.load().items.length);
t += 8 * 24 * 3600 * 1000;
ok('U2 7-day expiry drops and counts', (() => { const l = q.load(); return l.items.length === 0 && l.expired === 100; })());
st = mem(); q = X.queue(st, now);
const reg = I.store(st), src = X.sources(st);
q.send(item(1)); q.send(item(2, { system: 'chillers' }));
const raw = JSON.parse(st.getItem(X.KEY)); raw.items[1].system = 'not_a_system'; raw.items[1].title = 'Bad'; st.setItem(X.KEY, JSON.stringify(raw));
let r = X.intake(q, reg, src);
ok('U3 item the register rejects is refused with its code and kept', r.added.length === 1 && r.refused.length === 1 && r.refused[0].code === 'SYSTEM', r);
const issues = reg.load().items;
ok('U3 one issue, title ends (RFS)', issues.length === 1 && / \(RFS\)$/.test(issues[0].title) && issues[0].severity === 'B' && issues[0].system === 'lv_busway', issues);
ok('U3 source map holds the RFS url', (src.get(issues[0].id) || {}).url === 'rfs-readiness-workbench.html#gap-u:r1');
ok('U3 queue keeps only the refused item', q.load().items.length === 1 && q.load().items[0].gap_id === 'u:r2');
ok('U3 intaken gap cannot be queued again', q.send(item(1)).code === 'DUP');
const fakeReg = { add: (o) => (o.system === 'fire' ? { ok: false, code: 'SYSTEM' } : reg.add(o)) };
q.send(item(7, { system: 'fire' }));
r = X.intake(q, fakeReg, src);
ok('U3 refused items stay queued with their code', r.refused.length === 2 && r.refused.every((x) => x.code === 'SYSTEM') && q.load().items.length === 2, r);

// ---- headless ----
const puppeteer = require('puppeteer');
let base = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7), server = null;
if (!base) {
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((res) => setTimeout(res, 900));
}
{ const served = await fetch(base + '/js/rz-version.js').then((x) => x.text()).catch(() => '');
  if (served !== readFileSync(join(ROOT, 'js/rz-version.js'), 'utf8')) { console.error('FAIL — ' + base + ' does not serve this tree'); if (server) server.kill(); process.exit(1); } }
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 120000 });
const errors = [];
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
async function rfsWithGaps(theme, width) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width, height: 900 });
  p.on('pageerror', (e) => errors.push('rfs: ' + e.message));
  p.on('dialog', (d) => d.dismiss());
  await p.evaluateOnNewDocument((th) => { try { localStorage.setItem('theme', th); } catch (e) {} }, theme);
  await p.goto(base + '/rfs-readiness-workbench.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => {
    const id = RfsStore.createProject({ name: 'Gate test', region: 'SEA-SG', customerType: 'enterprise', phase: 'construction', itLoadMW: 10 });
    localStorage.setItem(RfsStore._key(id, 'units'), JSON.stringify([{ id: 'unit_t1', label: 'Hall 1', type: 'data_hall', owner: '', targetGate: 'G5', targetDate: '', createdAt: new Date().toISOString() }]));
  });
  await p.goto(base + '/rfs-readiness-workbench.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => { RfsUI.switchTab('gates'); RfsUI.renderGatesChecklist(); document.querySelectorAll('.rfs-cl-accordion').forEach((a) => a.classList.add('open')); });
  await wait(300);
  return { ctx, p };
}
try {
  let { ctx, p } = await rfsWithGaps('dark', 1440);
  const firstOf = (disc) => p.evaluate((d) => { const r = RfsLibrary.requirements.find((x) => x.discipline === d); return r ? r.id : null; }, disc);
  const mech = await firstOf('mechanical'), ops = await firstOf('operations');
  const cell = (req) => `.rfs-cl-cx[data-unit="unit_t1"][data-req="${req}"]`;
  ok('E1 open gap row has "→ Cx"', (await p.$eval(cell(mech) + ' button', (b) => b.textContent).catch(() => '')) === '→ Cx');
  await p.$eval(cell(ops) + ' button', (b) => b.click()); await wait(100);
  await p.$eval(cell(ops) + ' .rfs-cl-cx-sys', (s) => s.value === '');
  await p.$eval(cell(ops) + ' button', (b) => b.click()); await wait(150);
  ok('E1 send without a system queues nothing', (await p.evaluate(() => RZHandoffCx.queue(localStorage).load().items.length)) === 0);
  await p.$eval(cell(mech) + ' button', (b) => b.click()); await wait(100);
  ok('E1 mechanical gap pre-selects chillers', (await p.$eval(cell(mech) + ' .rfs-cl-cx-sys', (s) => s.value)) === 'chillers');
  await p.$eval(cell(mech) + ' button', (b) => b.click()); await wait(150);
  ok('E1 sent → "Sent · Open Cx"', (await p.$eval(cell(mech), (c) => c.textContent)) === 'Sent · Open Cx');
  await p.evaluate(() => RfsUI.renderGatesChecklist()); await wait(150);
  ok('E1 stays sent after re-render', (await p.$eval(cell(mech), (c) => c.textContent).catch(() => '')) === 'Sent · Open Cx');
  ok('E1 row carries the gap anchor', !!(await p.$('#gap-unit_t1\\:' + mech)));
  ok('E1 second send of the same gap refused (DUP)', (await p.evaluate((rq) => RZHandoffCx.queue(localStorage).send(RfsUI._cxGap('unit_t1', rq)).code, mech)) === 'DUP');

  // Cx in the same browser context (same localStorage)
  const cx = await ctx.newPage();
  await cx.setViewport({ width: 1440, height: 900 });
  cx.on('pageerror', (e) => errors.push('cx: ' + e.message));
  await cx.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
  await cx.waitForSelector('#cxIsIntake', { timeout: 20000 }).catch(() => null);
  const banner = () => cx.evaluate(() => { const b = document.getElementById('cxIsIntake'); return b ? { hidden: b.hidden, t: document.getElementById('cxIsIntakeText').textContent } : null; });
  ok('E2 banner "1 readiness gap waiting"', JSON.stringify(await banner()) === JSON.stringify({ hidden: false, t: '1 readiness gap waiting' }), await banner());
  const before = await cx.evaluate(() => RZCxIssues.store(localStorage).load().items.length);
  await cx.click('#cxIsIntakeAdd').catch(() => {}); await wait(300);
  const after = await cx.evaluate(() => RZCxIssues.store(localStorage).load().items);
  ok('E2 Add → one more issue, "(RFS)"', after.length === before + 1 && / \(RFS\)$/.test(after[after.length - 1].title), after);
  const link = await cx.$eval(`#cxIsList tr[data-is="${(after[after.length - 1] || {}).id}"] .cx-is-title a`, (a) => a.getAttribute('href')).catch(() => null);
  ok('E2 title links to the gap', link === 'rfs-readiness-workbench.html#gap-unit_t1:' + mech, link);
  ok('E2 banner hidden after Add', (await banner() || {}).hidden === true);
  await cx.evaluate((rq) => { const q = RZHandoffCx.queue(localStorage); q.send(RZHandoffCx.fromGap({ unitId: 'unit_t1', reqId: rq + 'x', title: 'Other', discipline: 'fire', blockerClass: 'info' })); }, mech);
  await cx.reload({ waitUntil: 'networkidle2' }); await cx.waitForSelector('#cxIsIntake', { timeout: 20000 }).catch(() => null);
  const n0 = await cx.evaluate(() => RZCxIssues.store(localStorage).load().items.length);
  await cx.click('#cxIsIntakeDismiss').catch(() => {}); await wait(200);
  ok('E2 Dismiss empties the queue, adds nothing', (await cx.evaluate(() => RZHandoffCx.queue(localStorage).load().items.length)) === 0 && (await cx.evaluate(() => RZCxIssues.store(localStorage).load().items.length)) === n0);
  await ctx.close();

  for (const theme of ['dark', 'light']) {
    ({ ctx, p } = await rfsWithGaps(theme, 390));
    const req = await p.evaluate(() => RfsLibrary.requirements.find((x) => x.discipline === 'electrical').id);
    await p.$eval(`.rfs-cl-cx[data-req="${req}"] button`, (b) => b.click()); await wait(150);
    const m = await p.evaluate((rq) => { const c = document.querySelector(`.rfs-cl-cx[data-req="${rq}"]`).getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, l: c.left, r: c.right }; }, req);
    ok(`E3 ${theme} 390 rfs send form fits`, m.sw <= m.cw && m.l >= 0 && m.r <= 390, m);
    await p.$eval(`.rfs-cl-cx[data-req="${req}"] button`, (b) => b.click()); await wait(150);
    const cx2 = await ctx.newPage(); await cx2.setViewport({ width: 390, height: 900 });
    cx2.on('pageerror', (e) => errors.push('cx: ' + e.message));
    await cx2.evaluateOnNewDocument((th) => { try { localStorage.setItem('theme', th); } catch (e) {} }, theme);
    await cx2.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
    await cx2.waitForSelector('#cxIsIntake', { timeout: 20000 }).catch(() => null);
    const b = await cx2.evaluate(() => { const e = document.getElementById('cxIsIntake'); const r = e && e.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, vis: !!e && !e.hidden, l: r && r.left, r: r && r.right }; });
    ok(`E3 ${theme} 390 cx banner visible and fits`, b.vis && b.sw <= b.cw && b.l >= 0 && b.r <= 390, b);
    await ctx.close();
  }
  ok('E3 no page errors', errors.length === 0, errors.slice(0, 5));
} finally {
  await browser.close();
  if (server) server.kill();
}
if (fail) { console.error(`FAIL test-handoff-cx — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`PASS test-handoff-cx — ${pass} checks: RFS gap → queue → Cx issue in one action, duplicates refused, 7-day expiry, refused items kept, back-link, 390 px both themes`);
