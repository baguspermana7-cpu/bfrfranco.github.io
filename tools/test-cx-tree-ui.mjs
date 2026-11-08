#!/usr/bin/env node
// test-cx-tree-ui.mjs — K28 laws: the L0–L6 plan editor opens into the commissioning program five deep
// (level → system → subsystem → equipment → activity) as a keyboard treegrid; every number on a row is the engine's
// (RZCxTree.programTree on the same input and plan), setting only a level moves everything under it, a weight or an
// exclusion on a node re-shares its siblings while the parent total holds, the overrides persist, and it fits 390 px.
// Usage: node tools/test-cx-tree-ui.mjs [--base=http://…] [--root=dir]   (exit 1 on any failed law)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const m = process.argv.find((a) => a.startsWith('--' + k + '=')); return m ? m.split('=').slice(1).join('=') : d; };
const ROOT = resolve(arg('root', resolve(here, '..')));
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 400)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null, base = arg('base', '');
if (!base) { const port = 8000 + Math.floor(Math.random() * 900) + 100; server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); base = 'http://127.0.0.1:' + port; await sleep(900); }
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });

async function open(w, keep) {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.setViewport({ width: w, height: 900 });
  if (!keep) await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('k28')) { localStorage.removeItem('rz-cx-plan'); localStorage.removeItem('rz-cx-tree'); sessionStorage.setItem('k28', '1'); } localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });
  await page.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#cxTrGrid tbody tr'), { timeout: 20000 }).catch(() => {});
  return { page, errs };
}
// what the engine says for every row the grid shows (same input, same plan overrides, same node overrides)
const AUDIT = () => {
  const A = window.RZCxAnalysis, T = window.RZCxTree, U = window.RZCxTreeUI;
  const tree = T.programTree(window.cxReadInputs(), { plan: A.state.overrides, nodes: U ? U.nodes() : {} });
  const rows = [...document.querySelectorAll('#cxTrGrid tbody tr')], bad = [];
  for (const r of rows) {
    const n = T.find(tree, r.getAttribute('data-path'));
    if (r.hasAttribute('data-ghost')) { if (n || +r.getAttribute('data-cost') !== 0 || +r.getAttribute('data-mh') !== 0) bad.push({ path: r.getAttribute('data-path'), why: 'ghost row the engine still carries, or not zero' }); continue; }
    if (!n) { bad.push({ path: r.getAttribute('data-path'), why: 'no node' }); continue; }
    const cost = +r.getAttribute('data-cost'), mh = +r.getAttribute('data-mh');
    const txt = r.querySelector('[data-col="mh"]').textContent.replace(/[^0-9]/g, '');
    if (cost !== n.cost || mh !== n.manHours || +txt !== n.manHours) bad.push({ path: n.path, cost, eng: n.cost, mh, engMh: n.manHours, txt });
  }
  return { rows: rows.length, bad: bad.slice(0, 5), nBad: bad.length };
};
const ROW = (path) => (p) => { const r = document.querySelector('#cxTrGrid tbody tr[data-path="' + p + '"]'); return r ? { cost: +r.getAttribute('data-cost'), mh: +r.getAttribute('data-mh'), exp: r.getAttribute('aria-expanded'), lvl: r.getAttribute('aria-level'), finish: +r.getAttribute('data-finish') } : null; };

try {
  const { page, errs } = await open(1440);
  const t1 = await page.evaluate(() => { const g = document.getElementById('cxTrGrid'); if (!g) return null; const rs = [...g.querySelectorAll('tbody tr')]; return { role: g.getAttribute('role'), rows: rs.length, lv1: rs.filter((r) => r.getAttribute('aria-level') === '1').length, ids: rs.map((r) => r.getAttribute('data-path')).join(','), after: g.closest('.cx-an-panel') && g.closest('.cx-an-panel').previousElementSibling && g.closest('.cx-an-panel').previousElementSibling.id }; });
  ok('K1 a treegrid sits under the plan editor and its calendar, with the seven levels L0–L6 as its top rows', t1 && t1.role === 'treegrid' && t1.lv1 === 7 && t1.ids === 'L0,L1,L2,L3,L4,L5,L6' && t1.after === 'cxExPanel', t1);
  if (t1) {
    ok('K2 every shown row carries the engine numbers (cost, man-hours) of its node', await page.evaluate(AUDIT).then((a) => (a.nBad === 0 && a.rows === 7) || a), await page.evaluate(AUDIT));
    // depth: expand to activities shows every node of the engine tree, five levels of aria-level
    const d = await page.evaluate(() => { document.querySelector('#cxTrPanel [data-depth="5"]').click(); const rs = [...document.querySelectorAll('#cxTrGrid tbody tr')]; let n = 0; window.RZCxTree.walk(window.RZCxTree.programTree(window.cxReadInputs(), { plan: window.RZCxAnalysis.state.overrides, nodes: window.RZCxTreeUI.nodes() }).levels, () => { n++; }); return { rows: rs.length, eng: n, levels: [...new Set(rs.map((r) => r.getAttribute('aria-level')))].sort().join(','), kinds: [...new Set(rs.map((r) => r.getAttribute('data-kind')))].join(',') }; });
    ok('K3 "expand to activity" shows the whole program five deep (row count = engine node count)', d.rows === d.eng && d.levels === '1,2,3,4,5' && d.kinds === 'level,system,subsystem,equipment,activity', d);
    const a3 = await page.evaluate(AUDIT);
    ok('K2 expanded, all rows still equal the engine', a3.nBad === 0 && a3.rows > 1000, a3);
    // parent sums: every expanded parent's cost equals the sum of its children's shown costs
    const sums = await page.evaluate(() => { const rs = [...document.querySelectorAll('#cxTrGrid tbody tr')], by = {}, bad = []; for (const r of rs) by[r.getAttribute('data-path')] = r; for (const r of rs) { const p = r.getAttribute('data-path'), kids = rs.filter((k) => k.getAttribute('data-parent') === p); if (!kids.length) continue; const s = kids.reduce((a, k) => a + +k.getAttribute('data-cost'), 0); if (s !== +r.getAttribute('data-cost')) bad.push({ p, s, c: +r.getAttribute('data-cost') }); } return bad.slice(0, 3); });
    ok('K2 each parent row = the sum of its child rows (cost, exact)', sums.length === 0, sums);
    await page.evaluate(() => document.querySelector('#cxTrPanel [data-depth="1"]').click());
    // keyboard: → expands, ↓ to first child, ← back to parent, ← collapses
    const kb = [];
    await page.focus('#cxTrGrid tbody tr[data-path="L3"]');
    await page.keyboard.press('ArrowRight'); kb.push(await page.evaluate(ROW('L3'), 'L3'));
    await page.keyboard.press('ArrowDown'); kb.push(await page.evaluate(() => document.activeElement.getAttribute('data-path')));
    await page.keyboard.press('ArrowLeft'); kb.push(await page.evaluate(() => document.activeElement.getAttribute('data-path')));
    await page.keyboard.press('ArrowLeft'); kb.push(await page.evaluate(ROW('L3'), 'L3'));
    kb.push(await page.evaluate(() => document.querySelectorAll('#cxTrGrid tbody tr[data-parent="L3"]').length));
    ok('K4 keyboard: → opens L3, ↓ lands on its first system, ← returns to L3, ← closes it', kb[0] && kb[0].exp === 'true' && /^L3\/[a-z_0-9]+$/.test(kb[1]) && kb[2] === 'L3' && kb[3].exp === 'false' && kb[4] === 0, kb);
    // set only the parent: a longer L3 in the plan editor moves every L3 descendant with it
    await page.evaluate(() => { document.querySelector('#cxTrPanel [data-depth="2"]').click(); });
    const before = await page.evaluate(ROW('L3'), 'L3');
    await page.evaluate(() => { const i = document.querySelector('#cxAnPlanTable .cx-an-in[data-level="L3"][data-field="months"]'); i.value = String(+i.value + 2); i.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(200);
    const after = await page.evaluate(ROW('L3'), 'L3');
    const kids = await page.evaluate(() => [...document.querySelectorAll('#cxTrGrid tbody tr[data-parent="L3"]')].map((r) => +r.getAttribute('data-finish')));
    const a4 = await page.evaluate(AUDIT);
    ok('K5 editing only the L3 level stretches L3 and every system under it follows (no system finishes after L3; rows = engine)', after && before && after.finish > before.finish + 1.5 && kids.length > 5 && Math.max(...kids) <= after.finish + 1e-9 && Math.abs(Math.max(...kids) - after.finish) < 0.05 && a4.nBad === 0, { before, after, kmax: Math.max(...kids), a4 });
    // weight 0 on one system: it drops to 0, its siblings take the share, L3 holds
    const sib = await page.evaluate(() => [...document.querySelectorAll('#cxTrGrid tbody tr[data-parent="L3"]')].map((r) => r.getAttribute('data-path')));
    const w0 = await page.evaluate(ROW(sib[0]), sib[0]), w1 = await page.evaluate(ROW(sib[1]), sib[1]);
    await page.evaluate((p) => { const i = document.querySelector('#cxTrGrid tbody tr[data-path="' + p + '"] input[data-field="weight"]'); i.focus(); i.value = '0'; i.dispatchEvent(new Event('change', { bubbles: true })); }, sib[0]);
    await sleep(150);
    const v0 = await page.evaluate(ROW(sib[0]), sib[0]), v1 = await page.evaluate(ROW(sib[1]), sib[1]), vL = await page.evaluate(ROW('L3'), 'L3');
    const a5 = await page.evaluate(AUDIT);
    ok('K6 weight 0 on a system: it goes to 0, its sibling grows, the L3 total holds, every row = engine', v0.cost === 0 && v1.cost > w1.cost && vL.cost === after.cost && a5.nBad === 0, { w0, v0, w1, v1, vL, after, a5 });
    const tabs = await page.evaluate((p) => { const ae = document.activeElement, g = document.getElementById('cxTrGrid'); return { focusField: ae && ae.getAttribute('data-field'), focusRow: ae && ae.closest('tr') && ae.closest('tr').getAttribute('data-path'), stops: [...g.querySelectorAll('tbody tr, tbody input')].filter((el) => el.tabIndex >= 0 && !el.disabled).length, rowStops: [...g.querySelectorAll('tbody tr[tabindex="0"]')].length, p }; }, sib[0]);
    ok('K11 after a weight edit focus stays in that weight box, and the grid keeps one row as its only tab stop (the row and its own boxes)', tabs.focusField === 'weight' && tabs.focusRow === sib[0] && tabs.rowStops === 1 && tabs.stops <= 3, tabs);
    const undo = await page.evaluate((p) => { const r = document.querySelector('#cxTrGrid tbody tr[data-path="' + p + '"]'), i = r && r.querySelector('input[data-field="weight"]'); return r ? { ghost: r.getAttribute('data-ghost'), w: i && i.value, dis: i && i.disabled } : null; }, sib[0]);
    ok('K6 the zeroed system stays in its row (ghost, weight box live) so the edit can be undone where it was made', undo && undo.ghost === '1' && undo.w === '0' && undo.dis === false, undo);
    // exclude a different system through its include box
    await page.evaluate((p) => { const i = document.querySelector('#cxTrGrid tbody tr[data-path="' + p + '"] input[data-field="include"]'); i.click(); }, sib[2]);
    await sleep(150);
    const x2 = await page.evaluate(ROW(sib[2]), sib[2]), xL = await page.evaluate(ROW('L3'), 'L3');
    ok('K6 un-ticking "include" on a system zeroes it and the L3 total still holds', x2.cost === 0 && xL.cost === after.cost && (await page.evaluate(AUDIT)).nBad === 0, { x2, xL });
    const levelLocked = await page.evaluate(() => !document.querySelector('#cxTrGrid tbody tr[data-path="L3"] input[data-field="weight"]'));
    ok('K6 a level row has no weight box (levels are set in the plan editor above)', levelLocked);
    // persistence: reload keeps both node overrides; Reset breakdown clears them
    const stored = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('rz-cx-tree')); } catch (e) { return null; } });
    ok('K7 the node overrides are stored (rz-cx-tree, version 1)', stored && stored.version === 1 && stored.nodes && stored.nodes[sib[0]] && stored.nodes[sib[0]].weight === 0 && stored.nodes[sib[2]] && stored.nodes[sib[2]].exclude === true, stored);
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.querySelector('#cxTrGrid tbody tr'), { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('#cxTrPanel [data-depth="2"]').click());
    const r0 = await page.evaluate(ROW(sib[0]), sib[0]);
    ok('K7 after a reload the weighted system is still 0 and the grid still equals the engine', r0 && r0.cost === 0 && (await page.evaluate(AUDIT)).nBad === 0, r0);
    await page.evaluate(() => document.getElementById('cxTrReset').click()); await sleep(150);
    const r1 = await page.evaluate(ROW(sib[0]), sib[0]);
    ok('K7 "Reset breakdown" clears every node override (system back above 0, store empty)', r1 && r1.cost > 0 && await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('rz-cx-tree') || 'null'); return !s || !Object.keys(s.nodes || {}).length; } catch (e) { return false; } }), r1);
    // filter
    const f = await page.evaluate(() => { const i = document.getElementById('cxTrFind'); i.value = 'chiller'; i.dispatchEvent(new Event('input', { bubbles: true })); const rs = [...document.querySelectorAll('#cxTrGrid tbody tr')]; return { n: rs.length, hits: rs.filter((r) => /chiller/i.test(r.querySelector('[data-col="name"]').textContent)).length, lv: rs.filter((r) => r.getAttribute('aria-level') === '1').length }; });
    ok('K8 find "chiller" keeps the matching rows and the path to them (levels stay as context)', f.hits > 0 && f.n >= f.hits && f.lv >= 1, f);
    const fit = await page.evaluate((() => { const g = document.getElementById('cxTrGrid'), fi = document.getElementById('cxTrFind'); fi.value = ''; fi.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#cxTrPanel [data-depth="5"]').click(); const wr = g.parentElement, inc = g.querySelector('tbody tr input[data-field="include"]'), wb = wr.getBoundingClientRect(), ib = inc && inc.getBoundingClientRect(); return { table: g.scrollWidth, wrap: wr.clientWidth, incRight: ib ? Math.round(ib.right) : null, wrapRight: Math.round(wb.right), vw: innerWidth }; }));
    ok('K10 1440 px: the whole grid fits its panel (no sideways scroll inside it), the include box of a deep row is on screen', fit.table <= fit.wrap + 1 && fit.incRight != null && fit.incRight <= fit.wrapRight && fit.incRight <= fit.vw, fit);
    const fk = await page.evaluate(() => { const fi = document.getElementById('cxTrFind'); fi.value = 'chiller'; fi.dispatchEvent(new Event('input', { bubbles: true })); const r = document.querySelector('#cxTrGrid tbody tr[aria-expanded="true"]'); r.focus(); return r.getAttribute('data-path'); });
    const trail = [await page.evaluate(() => (document.activeElement.tagName + ':' + document.activeElement.getAttribute('data-path')))];
    for (const k of ['Enter', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']) { await page.keyboard.press(k); trail.push(k + '>' + await page.evaluate(() => (document.activeElement.tagName + ':' + document.activeElement.getAttribute('data-path')))); }
    const fk2 = await page.evaluate((p) => { const r = [...document.querySelectorAll('#cxTrGrid tbody tr')].find((x) => x.getAttribute('data-path') === p); return { exp: r && r.getAttribute('aria-expanded'), at: document.activeElement && document.activeElement.getAttribute('data-path') }; }, fk);
    ok('K12 with Find on, Enter/← on a parent leave it open and arrow keys walk without error', fk2.exp === 'true' && !!fk2.at, { fk, fk2, trail });
    ok('no page errors (1440)', errs.length === 0, errs);
  }
  // 390 px
  const m = await open(390, true);
  const mob = await m.page.evaluate(() => { const g = document.getElementById('cxTrGrid'); if (!g) return null; document.querySelector('#cxTrPanel [data-depth="5"]').click(); const p = document.getElementById('cxTrPanel').getBoundingClientRect(), name = g.querySelector('tbody tr [data-col="name"]').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw: innerWidth, pr: Math.round(p.right), nl: Math.round(name.left), nw: Math.round(name.width) }; });
  ok('K9 390 px: no sideways page scroll, the panel inside the screen, the name column visible and readable', mob && mob.sw <= mob.vw && mob.pr <= mob.vw && mob.nl >= 0 && mob.nw >= 140, mob);
  const fitm = await m.page.evaluate((() => { const g = document.getElementById('cxTrGrid'), fi = document.getElementById('cxTrFind'); fi.value = ''; fi.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#cxTrPanel [data-depth="5"]').click(); const wr = g.parentElement, inc = g.querySelector('tbody tr input[data-field="include"]'), wb = wr.getBoundingClientRect(), ib = inc && inc.getBoundingClientRect(); return { table: g.scrollWidth, wrap: wr.clientWidth, incRight: ib ? Math.round(ib.right) : null, wrapRight: Math.round(wb.right), vw: innerWidth }; }));
  ok('K10 390 px: the whole grid fits its panel, cost and the edit boxes visible without scrolling the grid', fitm.table <= fitm.wrap + 1 && fitm.incRight != null && fitm.incRight <= fitm.wrapRight && fitm.incRight <= fitm.vw, fitm);
  ok('no page errors (390)', m.errs.length === 0, m.errs);
} finally {
  await browser.close(); if (server) server.kill();
}
console.log(`CX TREE UI — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
