#!/usr/bin/env node
// test-cx-analysis.mjs — laws for the Cx Analysis tab on cx-calculator.html (PRD v1.1 §35 T1–T6, T10, T12, T15).
// Usage: node tools/test-cx-analysis.mjs [--base=http://127.0.0.1:8123] [--shots=dir]
// Serves the site root itself on 127.0.0.1:8123 when --base is omitted. Exits 1 on any failed law.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SHOTS = arg('shots', ''); if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 300)); } };

/* ── Node laws (no browser) ── */
global.window = {}; require(resolve(ROOT, 'rz-engine.js'));
const P = require(resolve(ROOT, 'js', 'rz-cx-plan.js'));
{ // T10 every handbook link the tab emits points at an id that exists
  const anchors = new Set();
  P.LEVELS.forEach((l) => anchors.add(l.cite));
  Object.keys(P.CITES).forEach((k) => { const v = P.CITES[k]; if (typeof v === 'string') anchors.add(v); else Object.keys(v).forEach((j) => anchors.add(v[j])); });
  const bad = [];
  for (const a of anchors) {
    const [file, id] = a.split('#'); const p = resolve(ROOT, file);
    if (!existsSync(p)) { bad.push(a + ' (file)'); continue; }
    if (id && !new RegExp('id="' + id + '"').test(readFileSync(p, 'utf8'))) bad.push(a + ' (id)');
  }
  ok(`T10 ${anchors.size} handbook links resolve to a file and an id`, !bad.length, bad);
}

/* ── browser laws ── */
let server = null, base = arg('base', '');
if (!base) {
  const port = 8123; server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((r) => setTimeout(r, 900));
}
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });
try {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); const missing = []; page.on('response', (r) => { if (r.status() === 404) missing.push(r.url().replace(base, '')); }); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console ' + m.text()); });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });   // the consent banner is position:fixed and would swallow clicks near the bottom edge
  await page.goto(base + '/cx-calculator.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => window.RZCxAnalysis && window.RZEngine && document.getElementById('cxTabBtnAnalysis'), { timeout: 30000 });
  await page.evaluate(() => { try { localStorage.removeItem('rz-cx-plan'); } catch (e) {} });
  // the register's own T13 rule (tools/test-tool-register.mjs): every visible control counts, aria-pressed chips OUTSIDE a .seg collapse to one group, .seg buttons count one by one
  const barControls = await page.evaluate(() => { const bar = document.querySelector('.tool-bar'); const vis = (e) => e.offsetParent !== null; const ctl = [...bar.querySelectorAll('button, a[role=button], select, a.btn, a[class*="btn"]')].filter(vis); const pressed = ctl.filter((c) => c.hasAttribute('aria-pressed') && !c.closest('.seg')); return { elements: ctl.length, total: ctl.length - pressed.length + (pressed.length ? 1 : 0), tabsOutsideBar: !bar.contains(document.getElementById('cxTabBtnAnalysis')) && document.querySelector('.tool-tabs.cx-tabs[role=tablist]') !== null }; });
  ok('T13 .tool-bar still <= 6 controls by the register rule; the page tabs sit on their own .tool-tabs row', barControls.total <= 6 && barControls.tabsOutsideBar, barControls);
  // T1 the calculator tab's DOM is byte-identical across a tab round trip
  const calcBefore = await page.evaluate(() => document.getElementById('cxTabCalc').innerHTML);
  await page.click('#cxTabBtnAnalysis'); await page.waitForFunction(() => !document.getElementById('cxTabAnalysis').hidden && document.querySelectorAll('#cxAnPlanTable tbody tr').length === 7, { timeout: 15000 });
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'cx-analysis-1440-dark.png'), fullPage: true });
  await page.click('#cxTabBtnCalc'); await page.waitForFunction(() => document.getElementById('cxTabAnalysis').hidden);
  const calcAfter = await page.evaluate(() => document.getElementById('cxTabCalc').innerHTML);
  ok('T1 calculator tab DOM identical after a tab round trip', calcBefore === calcAfter, { before: calcBefore.length, after: calcAfter.length });
  ok('T1 url carries ?tab=analysis only while the analysis tab is shown', await page.evaluate(() => !location.search.includes('tab=analysis')));
  await page.click('#cxTabBtnAnalysis'); await page.waitForFunction(() => !document.getElementById('cxTabAnalysis').hidden);
  ok('T1 deep link written on switch', await page.evaluate(() => location.search.includes('tab=analysis')));
  // T2 engine == calculator (grand total)
  const parity = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; const r = window.cxLastResults; return { plan: p && p.grand, calc: r && r.grandTotal, total: p && p.total }; });
  ok('T2 plan.grand vs calculator grandTotal within 1 %', parity.plan && parity.calc && Math.abs(parity.plan - parity.calc) / parity.calc < 0.01, parity);
  // KPI strip: no decimals > 2, no bare "0" for empty data
  const txt = await page.evaluate(() => document.getElementById('cxTabAnalysis').innerText);
  const longDec = txt.match(/\d+\.\d{3,}/g) || [];
  ok('T15 no numeral with more than two decimals in the rendered tab', !longDec.length, longDec.slice(0, 5));
  ok('KPI strip renders six facts', (await page.$$eval('#cxAnKpis .cx-kpi-card', (n) => n.length)) === 6);
  // T3 move L3 +1 month: finish +1, total unchanged (±$1), >= 6 monthly bars differ, successors move
  const before = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; return { finish: p.finishMonth, total: p.total, monthly: p.monthly.cost.slice(), l4: p.levels[4].start, l6end: p.levels[6].end }; });
  await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = (parseFloat(i.value) + 1).toFixed(1); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction((f) => window.RZCxAnalysis.state.plan.finishMonth > f, {}, before.finish);
  const after = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; return { finish: p.finishMonth, total: p.total, monthly: p.monthly.cost.slice(), l4: p.levels[4].start, l6end: p.levels[6].end, edited: p.levels[3].edited, state: document.getElementById('cxAnState').textContent }; });
  const changedBars = after.monthly.filter((v, i) => Math.abs(v - (before.monthly[i] || 0)) > 1).length;
  ok('T3 L3 +1.0 mo → finish +1.0', Math.abs(after.finish - before.finish - 1) < 0.051, { before: before.finish, after: after.finish });
  ok('T3 total unchanged by a pure date shift (±$1)', Math.abs(after.total - before.total) <= 1, { before: before.total, after: after.total });
  ok('T3 >= 6 monthly cost buckets moved', changedBars >= 6, { changedBars });
  ok('T3 successors carried (L4 start +1, L6 end +1)', Math.abs(after.l4 - before.l4 - 1) < 0.051 && Math.abs(after.l6end - before.l6end - 1) < 0.051, { before, after });
  ok('T3 state reads Unsaved scenario and the L3 row is marked edited', after.edited && /Unsaved/.test(after.state), after.state);
  ok('T3 KPI finish shows the delta vs baseline', /\+1\.0 mo/.test(await page.$eval('#cxAnKpis', (n) => n.innerText)));
  // T4 save → reload keeps it; reset → baseline
  await page.click('#cxAnSave');
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RZCxAnalysis && window.RZCxAnalysis.state.plan && !document.getElementById('cxTabAnalysis').hidden, { timeout: 30000 });
  const kept = await page.evaluate(() => ({ finish: window.RZCxAnalysis.state.plan.finishMonth, state: document.getElementById('cxAnState').textContent }));
  ok('T4 reload keeps the saved scenario (finish still +1)', Math.abs(kept.finish - after.finish) < 0.051 && /Saved/.test(kept.state), kept);
  await page.click('#cxAnReset'); await page.waitForFunction((f) => Math.abs(window.RZCxAnalysis.state.plan.finishMonth - f) < 0.051, {}, before.finish);
  ok('T4 reset returns to the baseline and clears storage', await page.evaluate(() => localStorage.getItem('rz-cx-plan') === null && /baseline/i.test(document.getElementById('cxAnState').textContent)));
  // T5 / T6 status by month
  const mid = await page.evaluate(() => { const p = window.RZCxAnalysis.state.plan; const l3 = p.levels[3]; return Math.round((l3.start + l3.end) / 2); });
  await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = m; r.dispatchEvent(new Event('input', { bubbles: true })); }, mid);
  const st = await page.evaluate(() => { const rows = [...document.querySelectorAll('#cxAnStatusTable tbody tr')]; const tags = rows.map((r) => r.children[3].textContent.trim()); return { n: rows.length, green: tags.filter((t) => t.includes('green')).length, yellow: tags.filter((t) => t.includes('yellow')).length, none: tags.filter((t) => t === '—').length, out: document.getElementById('cxAnMonthOut').textContent }; });
  ok('T5 mid-L3: 17 systems listed, some green and some yellow', st.n === 17 && st.green > 0 && st.yellow > 0, st);
  await page.evaluate(() => { const r = document.getElementById('cxAnMonth'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const m0 = await page.$$eval('#cxAnStatusTable tbody tr', (rows) => rows.filter((r) => r.children[2].textContent.trim() === '—').length);
  ok('T6 M0: no system carries an accepted level', m0 === 17, { m0 });
  // schematic: three sheets, nodes coloured by the month, click → inspector, halo on the changed node
  const sch = await page.evaluate(() => { const figs = [...document.querySelectorAll('#cxAnSheets .cx-an-sheet')]; return { n: figs.length, shown: figs.filter((f) => !f.hidden).map((f) => f.getAttribute('data-block')), hits: document.querySelectorAll('#cxAnSheets [data-rzd-hit]').length, states: [...document.querySelectorAll('#cxAnSheets [data-rzd-node]')].map((r) => r.getAttribute('data-rzd-state')) }; });
  ok('schematic: three sheets, electrical shown, every system a hit target', sch.n === 3 && sch.shown.join() === 'electrical' && sch.hits >= 17, sch);
  ok('schematic at M0: no node coloured', sch.states.length >= 17 && sch.states.every((s) => s === 'none'), sch.states);
  await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = m; r.dispatchEvent(new Event('input', { bubbles: true })); }, mid);
  const schMid = await page.$$eval('#cxAnSheets [data-rzd-node]', (rs) => rs.map((r) => r.getAttribute('data-rzd-state')));
  ok('schematic mid-L3: green and yellow nodes present (T5)', schMid.includes('green') && schMid.includes('yellow'), schMid);
  const gateMonth = await page.evaluate(() => Math.ceil(window.RZCxAnalysis.state.plan.levels[3].end));
  await page.evaluate((m) => { const r = document.getElementById('cxAnMonth'); r.value = m; r.dispatchEvent(new Event('input', { bubbles: true })); }, gateMonth);
  ok('schematic at the L3 gate month: at least one node carries the changed halo', (await page.$$eval('#cxAnSheets [data-cx-changed]', (n) => n.length)) >= 1);
  await page.evaluate(() => document.querySelector('.cx-an-sheet-tabs [data-sheet="mechanical"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await new Promise((r) => setTimeout(r, 120));
  const tabInfo = await page.evaluate(() => { const t = document.querySelector('.cx-an-sheet-tabs [data-sheet="mechanical"]'); const r = t.getBoundingClientRect(); return { connected: t.isConnected, x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 80) }; });
  try { await page.click('.cx-an-sheet-tabs [data-sheet="mechanical"]'); } catch (e) { console.log('  sheet-tab click failed:', e.message, JSON.stringify(tabInfo)); throw e; }
  ok('sheet tab switches to B', await page.evaluate(() => [...document.querySelectorAll('#cxAnSheets .cx-an-sheet')].filter((f) => !f.hidden).map((f) => f.getAttribute('data-block')).join() === 'mechanical'));
  await page.click('#cxAnSheets [data-rzd-hit="cdu"]'); await page.waitForFunction(() => /^CDUs/.test(document.getElementById('cxAnInsTitle').textContent));
  ok('click on the CDU node opens its inspector and marks the node selected', await page.evaluate(() => !!document.querySelector('#cxAnSheets [data-rzd-node="cdu"][data-cx-selected]')));
  await page.evaluate(() => { const r = document.getElementById('cxAnMonth'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
  // 3D plant: mounts (or says why not), tints by month, roof-off focus, breadcrumb, budget
  await page.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center', behavior: 'instant' }));
  const c3 = await page.waitForFunction(() => ['ready', 'nogl', 'failed'].includes(document.getElementById('cxAnCampus').getAttribute('data-cx-3d')), { timeout: 30000 }).then(() => page.evaluate(() => document.getElementById('cxAnCampus').getAttribute('data-cx-3d'))).catch(() => 'timeout');
  ok('3D plant reaches ready or an explicit no-WebGL sentence', c3 === 'ready' || c3 === 'nogl', c3);
  if (c3 === 'ready') {
    await new Promise((r) => setTimeout(r, 1500));
    const st3 = await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.stats());
    ok('3D: equipment families and flows drawn within the draw-call budget (<= 300)', st3.equipment >= 12 && st3.flows >= 8 && st3.drawCalls > 0 && st3.drawCalls <= 300, st3);
    ok('3D: every equipment family is a shaped asset (RZCxAssets), not a box', st3.shaped === st3.equipment && st3.equipment === 15, { shaped: st3.shaped, equipment: st3.equipment });
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus('hall'));
    await new Promise((r) => setTimeout(r, 700));
    const f3 = await page.evaluate(() => ({ focus: document.getElementById('cxAnCampus').getAttribute('data-cx-focus'), crumb: document.querySelector('#cxAnCampus .cx-3d-crumb').textContent }));
    ok('3D: focusing the hall lifts the roof and grows the breadcrumb', f3.focus === 'hall' && /Campus.*Data hall/.test(f3.crumb), f3);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'cx-campus-hall-1440-dark.png'), clip: { x: 0, y: 0, width: 1440, height: 1000 } });
    await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus(null));
    const fpsSample = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n / 3); }; requestAnimationFrame(tick); }));
    ok('3D: page keeps >= 24 fps over 3 s while the flows run (headless software GL)', fpsSample >= 24, { fps: Math.round(fpsSample) });
    ok('3D: the note says design simulation and names the FWS flow basis', await page.evaluate(() => /design simulation/i.test(document.querySelector('#cxAnCampus .cx-3d-note').textContent) && /ΔT 10 K/.test(document.querySelector('#cxAnCampus .cx-3d-note').textContent)));
    const paused = await page.evaluate(() => { document.querySelector('#cxAnCampus [data-pause]').click(); return document.getElementById('cxAnCampus').__rzCampus.stats().paused; });
    ok('3D: pause flows control works', paused === true);
  }
  // inspector: a system row → gate table + handbook ladder link; a level row → systems by gate month
  await page.click('#cxAnStatusTable [data-sel="sys:ups"]'); await page.waitForFunction(() => /UPS and batteries/.test(document.getElementById('cxAnInsTitle').textContent));
  const ins = await page.evaluate(() => ({ rows: document.querySelectorAll('#cxAnInsBody table tbody tr').length, ladder: !!document.querySelector('#cxAnInsBody a[href$="#s02-7-1"]'), op: /not connected/.test(document.getElementById('cxAnInsBody').innerText) }));
  ok('inspector: UPS shows 5 gate rows, the UPS ladder link and "Operating state: not connected"', ins.rows === 5 && ins.ladder && ins.op, ins);
  await page.click('#cxAnPlanTable [data-sel="level:L3"]'); await page.waitForFunction(() => /^L3/.test(document.getElementById('cxAnInsTitle').textContent));
  ok('inspector: L3 lists 17 systems by gate month', (await page.$$eval('#cxAnInsBody table tbody tr', (n) => n.length)) === 17);
  // Tier 1.5 (3.26.1): calendar panel, extension lines, CSV, PDF sheet
  await page.click('#cxAnReset'); await new Promise((r) => setTimeout(r, 200));
  const ex0 = await page.evaluate(() => { const p = document.getElementById('cxExPanel'); return { there: !!p, after: !!p && p.previousElementSibling && p.previousElementSibling.id === 'cxAnPlanPanel', rel: document.getElementById('cxExRelease').textContent, rows: document.querySelectorAll('#cxExTable tbody tr').length, slotOff: document.getElementById('cxExSlot').disabled }; });
  ok('P5 calendar panel renders after the plan editor; without a start date it says months are relative', ex0.there && ex0.after && /No start date/.test(ex0.rel) && ex0.rows === 0 && ex0.slotOff, ex0);
  await page.evaluate(() => { const i = document.getElementById('cxExAnchor'); i.value = '2027-01-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelectorAll('#cxExTable tbody tr').length === 7);
  const ex1 = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); const rows = [...document.querySelectorAll('#cxExTable tbody tr')].map((r) => r.children[1].textContent); return { release: cp.release, rel: document.getElementById('cxExRelease').textContent, slot: document.getElementById('cxExSlot').checked, firstStart: rows[0], l4: cp.levels[4], dates: rows.every((d) => /^\d{1,2} [A-Z][a-z]{2} 20\d\d$/.test(d)), base: cp.release === cp.baselineRelease }; });
  ok('P5 start date set: seven dated windows, release printed, witness slot defaults on, release equals its baseline', ex1.dates && /Release/.test(ex1.rel) && ex1.slot && ex1.base && /^\d{4}-\d{2}-\d{2}$/.test(ex1.release), ex1);
  ok('P5 L4 (witness) starts on a Monday of a full week', ex1.l4 && ex1.l4.witness && new Date(ex1.l4.start + 'T00:00:00Z').getUTCDay() === 1, ex1.l4);
  // a slipped L3 moves L4 to a later Monday and the row explains the constraint
  const rel0 = ex1.release;
  await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = (parseFloat(i.value) + 0.5).toFixed(1); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelectorAll('#cxExTable tbody tr.is-edited').length >= 1);
  const ex2a = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); return { delta: cp.releaseDeltaDays, rel: document.getElementById('cxExRelease').textContent, l3: cp.levels[3].moved, l4: cp.levels[4].explain }; });
  ok('P5 L3 +0.5 mo (11 work days): L3 row moves, the L4 witness slot absorbs it, release holds on the baseline date', ex2a.l3 && ex2a.delta === 0 && /on the baseline date/.test(ex2a.rel) && /Witness slot/.test(ex2a.l4), ex2a);
  await page.evaluate(() => { const i = document.querySelector('.cx-an-in[data-level="L3"][data-field="start"]'); i.value = (parseFloat(i.value) + 1).toFixed(1); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction((r) => window.RZCxExt.compute(window.RZCxAnalysis.state.plan).release !== r, {}, rel0);
  const ex2 = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); return { delta: cp.releaseDeltaDays, rel: document.getElementById('cxExRelease').textContent, moved: cp.levels.filter((l) => l.moved).length, explain: [...document.querySelectorAll('#cxExTable tbody tr.is-edited .cx-ex-explain')].map((e) => e.textContent).filter(Boolean).length }; });
  ok('P5 L3 +1.5 mo crosses a month: release slips by whole weeks (delta printed), moved rows carry the constraint sentence', ex2.delta >= 28 && ex2.delta % 7 === 0 && /\+\d+ days/.test(ex2.rel) && ex2.moved >= 3 && ex2.explain >= 2, ex2);
  ok('P5 the edited L3 row says how many work days it moved vs its baseline start', await page.$eval('#cxExTable tbody tr:nth-child(4) .cx-ex-explain', (e) => /^\+33 work days vs baseline start/.test(e.textContent)), await page.$eval('#cxExTable tbody tr:nth-child(4) .cx-ex-explain', (e) => e.textContent));
  // extension lines: standby between the two releases prices the slip, lump on release adds once
  await page.click('#cxExAddStandby'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 1);
  await page.evaluate(() => { const i = document.querySelector('#cxExLines .cx-ex-in[data-field="perWorkDay"]'); i.value = '100'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('#cxExAddLump'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 2);
  await page.evaluate(() => { const i = document.querySelector('#cxExLines tr[data-line="lump1"] .cx-ex-in[data-field="amount"]'); i.value = '5000'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await new Promise((r) => setTimeout(r, 150));
  const ex3 = await page.evaluate(() => { const cp = window.RZCxExt.compute(window.RZCxAnalysis.state.plan); const sb = cp.lines[0], lp = cp.lines[1]; return { days: sb.days, sbAmt: sb.amount, lpAmt: lp.amount, ext: cp.extensionTotal, total: document.getElementById('cxExTotal').textContent, monthSum: cp.monthly.extension.reduce((a, b) => a + (b || 0), 0) }; });
  ok('P5 standby 100/work day over the slip + lump 5,000 on release = extension total, bucketed by month to the cent', ex3.days > 0 && ex3.sbAmt === ex3.days * 100 && ex3.lpAmt === 5000 && Math.abs(ex3.ext - (ex3.sbAmt + 5000)) < 0.01 && Math.abs(ex3.monthSum - ex3.ext) < 0.01 && /Extension total/.test(ex3.total), ex3);
  if (SHOTS) await (await page.$('#cxExPanel')).screenshot({ path: join(SHOTS, 'cx-p5-panel-1440-dark.png') });
  const ex3b = await page.evaluate(() => { const i = document.querySelector('#cxExLines tr[data-line="lump1"] .cx-ex-in[data-field="on"]'); i.value = 'tomorrow'; i.dispatchEvent(new Event('change', { bubbles: true })); return { err: document.getElementById('cxExErrors').textContent, kept: window.RZCxAnalysis.state.extra.lines[1].on }; });
  ok('P5 an invalid date on a line is refused with a sentence and the previous value kept', /not valid/.test(ex3b.err) && ex3b.kept === 'release', ex3b);
  // CSV import: one good row applies, bad rows are listed by row number; exports carry the header
  const imp = await page.evaluate(() => { const r = window.RZCxExt.importPlanText('level,start,months,crew,shift\nL2,3.0,1.5,8,2x12\nL9,1,1,1,1x8\nL1,abc,1,1,1x8\n'); return { accepted: r.accepted, errors: r.errors.map((e) => e.row), list: document.getElementById('cxExErrors').innerText, l2: window.RZCxAnalysis.state.plan.levels[2].start }; });
  ok('P5 plan CSV import: L2 row applied (start 3.0), rows 3 and 4 rejected with reasons', imp.accepted === 1 && imp.errors.join() === '3,4' && /Row 3/.test(imp.list) && /Row 4/.test(imp.list) && Math.abs(imp.l2 - 3) < 0.051, imp);
  const csv = await page.evaluate(() => { const got = {}; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { got.type = b.type; return 'blob:x'; }; const a = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { got.name = this.download; }; const out = {}; for (const k of ['plan', 'monthly', 'status', 'calendar', 'lines']) out[k] = window.RZCxExt.exportKind(k).split('\n')[0]; URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = a; return { out, got }; });
  ok('P5 five CSV exports download text/csv with their headers', csv.got.type.startsWith('text/csv') && /^level,/.test(csv.out.plan) && /^month,/i.test(csv.out.monthly) && /^system|^id/i.test(csv.out.status) && /^level,label,start,end,work_days/.test(csv.out.calendar) && /^id,label,kind/.test(csv.out.lines) && /\.csv$/.test(csv.got.name), csv);
  // PDF sheet: the page's export appends it, with the KPI, plan, monthly, status tables and the dated release
  const sheet = await page.evaluate(() => { const h = window.RZCxAnalysisSheet(); return { len: h.length, tables: (h.match(/<table/g) || []).length, title: /Cx Analysis — program plan/.test(h), release: /Release|Finish/.test(h) && /20\d\d/.test(h), svg: /<svg/.test(h), noScript: !/<script/.test(h), hooked: /RZCxAnalysisSheet\(\)/.test(document.documentElement.outerHTML) || typeof window.cxExportPDF === 'function' }; });
  ok('P5 PDF sheet: title, >= 4 tables, dated finish, schematic SVG snapshot, no script tags', sheet.title && sheet.tables >= 4 && sheet.release && sheet.svg && sheet.noScript, sheet);
  // save → reload keeps anchor, slot and lines (store v2)
  await page.click('#cxAnSave'); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RZCxExt && window.RZCxAnalysis.state.plan && document.querySelectorAll('#cxExLines tbody tr').length === 2, { timeout: 30000 });
  const kept2 = await page.evaluate(() => ({ anchor: document.getElementById('cxExAnchor').value, slot: document.getElementById('cxExSlot').checked, lines: window.RZCxAnalysis.state.extra.lines.map((l) => l.id).join(), per: window.RZCxAnalysis.state.extra.lines[0].perWorkDay }));
  ok('P5 reload keeps the start date, the slot rule and both lines', kept2.anchor === '2027-01-01' && kept2.slot && kept2.lines === 'standby1,lump1' && kept2.per === 100, kept2);
  // a cleared witness-slot box stays cleared when the date changes (slots default on only from a null date; reviewer MED 2026-11-07)
  await page.click('#cxExSlot'); await page.evaluate(() => { const i = document.getElementById('cxExAnchor'); i.value = '2027-02-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.getElementById('cxExAnchor').value === '2027-02-01' && window.RZCxAnalysis.state.extra.calendar.anchor === '2027-02-01');
  const slotKept = await page.evaluate(() => ({ slot: document.getElementById('cxExSlot').checked, st: window.RZCxAnalysis.state.extra.calendar.slot }));
  ok('P5 unchecking witness slots survives a later start-date change', slotKept.slot === false && slotKept.st === false, slotKept);
  await page.click('#cxExSlot'); await page.evaluate(() => { const i = document.getElementById('cxExAnchor'); i.value = '2027-01-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => window.RZCxAnalysis.state.extra.calendar.anchor === '2027-01-01' && window.RZCxAnalysis.state.extra.calendar.slot === true);
  await page.click('#cxExPanel [data-remove="standby1"]'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 1);
  ok('P5 remove line works', true);
  await page.click('#cxAnReset'); await page.waitForFunction(() => document.querySelectorAll('#cxExLines tbody tr').length === 0 && document.getElementById('cxExAnchor').value === '');
  ok('P5 reset clears calendar and lines', true);
  // charts: amber / grey only
  const series = await page.evaluate(() => { const out = []; for (const id of ['cxAnChartMonthly', 'cxAnChartCum', 'cxAnChartCrew']) { const c = window.Chart && window.Chart.getChart(document.getElementById(id)); if (!c) { out.push(id + ' missing'); continue; } c.data.datasets.forEach((d) => out.push(String(d.backgroundColor || d.borderColor))); } return out; });
  ok('T19 three charts drawn, series amber or neutral grey only', series.length === 6 && series.every((s) => /#D49A2A|#7D8794|#A0AEC0/i.test(s)), series);
  // light theme shot
  if (SHOTS) { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: join(SHOTS, 'cx-analysis-1440-light.png'), fullPage: true }); await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); }
  // T13 no WebGL → the sentence, and every other workflow still runs
  { const p2 = await browser.newPage(); await p2.setViewport({ width: 1440, height: 1000 });
    await p2.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k) { if (/webgl/.test(String(k))) return null; return orig.apply(this, arguments); }; });
    await p2.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
    await p2.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center', behavior: 'instant' }));
    const nogl = await p2.waitForFunction(() => document.getElementById('cxAnCampus').getAttribute('data-cx-3d') === 'nogl', { timeout: 30000 }).then(() => true).catch(() => false);
    const txt2 = await p2.evaluate(() => (document.querySelector('#cxAnCampus .cx-3d-nogl') || {}).textContent || '');
    ok('T13 no WebGL: the 3D panel states it in one sentence and the schematic remains', nogl && /no WebGL/.test(txt2) && await p2.evaluate(() => document.querySelectorAll('#cxAnSheets [data-rzd-hit]').length >= 17), txt2.slice(0, 80));
    await p2.close(); }
  // T12 phone
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: 'networkidle2' }); await page.waitForFunction(() => window.RZCxAnalysis && !document.getElementById('cxTabAnalysis').hidden, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sx: window.scrollX, wide: [...document.querySelectorAll('#cxTabAnalysis *')].filter((e) => e.getBoundingClientRect().right > 391 && !e.closest('.cx-an-tablewrap') && !e.closest('.cx-an-sheet')).map((e) => e.tagName + '.' + e.className).slice(0, 5), small: [...document.querySelectorAll('#cxTabAnalysis input, #cxTabAnalysis select')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length }));
  ok('T12 390 px: scrollWidth <= 390 and nothing outside the viewport (table wraps excepted)', phone.sw <= 390 && !phone.wide.length, phone);
  ok('T12 390 px: every field >= 16 px (no iOS zoom)', phone.small === 0, phone);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'cx-analysis-390-dark.png'), fullPage: true });
  ok('no page or console errors', !errs.length, errs.slice(0, 4));
  if (missing.length) console.log('  · 404 resources (fatal in the repo ship gate, informational here):', [...new Set(missing)].slice(0, 8).join(' '));
  ok('calculator-only sections hidden on the analysis tab', await page.evaluate(() => { const ex = window.RZCxAnalysis.state.extras || []; return ex.length >= 1 && ex.every((e) => e.hidden) && document.querySelector('.cx-below').closest('#cxTabCalc') !== null; }));
} finally { await browser.close(); if (server) server.kill(); }
console.log(`CX ANALYSIS — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
