#!/usr/bin/env node
// test-cx-issues.mjs — laws for js/rz-cx-issues.js (DOM-free): the Tier 1 issue register and gate readiness
// (PRD v1.1 §14, §15–16, journey 2, T9). Rules from the Cx Field Manual 02.5.2 / 02.5.4: an open A blocks the gate;
// an open B blocks unless the CxM and EoR record that the next level is not affected; C never blocks (a condition).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${JSON.stringify(d).slice(0, 300)}`); } };
global.window = {}; require(resolve(ROOT, 'rz-engine.js')); const P = require(resolve(ROOT, 'js', 'rz-cx-plan.js'));
let I = null; try { I = require(resolve(ROOT, 'js', 'rz-cx-issues.js')); } catch (e) { I = null; }
ok('module loads (RZCxIssues)', !!I && typeof I.store === 'function' && typeof I.readiness === 'function' && typeof I.overlay === 'function');
if (I) {
  const mem = () => { let m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
  const st = mem(), R = I.store(st);
  ok('empty register', R.load().items.length === 0 && Object.keys(R.load().checks).length === 0);
  const a = R.add({ title: 'UPS-A1 bypass breaker fails to close', severity: 'A', system: 'ups', gate: 'L4', due: 9, owner: 'GC' });
  ok('add A → ISS-01, open', a.ok && a.issue.id === 'ISS-01' && a.issue.status === 'open', a);
  ok('ids count up', R.add({ title: 'Label missing on PDU-3', severity: 'C', system: 'ups', gate: 'L4' }).issue.id === 'ISS-02');
  ok('bad input refused with a code', R.add({ title: '', severity: 'A', system: 'ups', gate: 'L4' }).code === 'TITLE' && R.add({ title: 'x', severity: 'D', system: 'ups', gate: 'L4' }).code === 'SEVERITY' && R.add({ title: 'x', severity: 'A', system: 'nope', gate: 'L4' }).code === 'SYSTEM' && R.add({ title: 'x', severity: 'A', system: 'ups', gate: 'L7' }).code === 'GATE');
  ok('title is stored as text, trimmed, capped at 120', R.add({ title: '  <b>x</b>' + 'y'.repeat(200), severity: 'C', system: 'bms', gate: 'L3' }).issue.title.length === 120);
  const plan = P.compute({ itLoadKw: 40000, coolingType: 'liquid', powerRedundancy: '2N', countryId: 'ID', rackDensity: 'ai_hpc' }, {});
  const g = P.gateMonths(plan), m = Math.floor(g.ups.L3) + 0.0001 < g.ups.L4 ? Math.ceil(g.ups.L3) : Math.floor(g.ups.L3);   // a month when ups has L3 and L4 is next
  const status0 = P.statusAt(plan, m), upsRow = status0.systems.find((x) => x.id === 'ups');
  ok('fixture month: ups has L3, next L4', upsRow.level === 'L3' && upsRow.next === 'L4', { m, level: upsRow.level, next: upsRow.next });
  let reg = R.load(), rd = I.readiness(plan, m, 'ups', reg);
  ok('readiness targets the next gate', rd.gate === 'L4');
  ok('open A on that gate blocks: not ready, reason names ISS-01 (A)', rd.ready === false && rd.blockers.some((b) => b.id === 'ISS-01') && /ISS-01 \(A\) open/.test(rd.reason), rd.reason);
  ok('open C is a condition, never a blocker', rd.conditions.some((c) => c.id === 'ISS-02') && !rd.blockers.some((b) => b.id === 'ISS-02'));
  ok('L4 items: gate request, L3 records, OEM start-up report, witness booked, load bank (UPS)', ['request', 'records', 'oem', 'witness', 'loadbank'].every((k) => rd.items.some((x) => x.key === k)), rd.items.map((x) => x.key));
  ok('every item cites the handbook', rd.items.every((x) => /^cx-handbook\/.+\.html#s\d/.test(x.cite)), rd.items.map((x) => x.cite));
  ok('chiller L4 has no load-bank item', !I.readiness(plan, m, 'chillers', reg).items.some((x) => x.key === 'loadbank'));
  const ov0 = I.overlay(status0, reg);
  ok('overlay marks ups blocked with ISS-01, others not', ov0.systems.find((x) => x.id === 'ups').blocked === true && ov0.systems.find((x) => x.id === 'ups').blockers.join() === 'ISS-01' && ov0.systems.filter((x) => x.blocked).length === 1);
  ok('overlay does not mutate the status it was given', status0.systems.find((x) => x.id === 'ups').blocked === undefined);
  ok('overlay counts blocked', ov0.counts.blocked === 1);
  ok('close ISS-01 → no blocker', R.setStatus('ISS-01', 'closed') && I.readiness(plan, m, 'ups', R.load()).blockers.length === 0 && I.overlay(status0, R.load()).counts.blocked === 0);
  R.setStatus('ISS-01', 'open');
  const b = R.add({ title: 'UPS-A1 efficiency 0.4 % low at 25 %', severity: 'B', system: 'ups', gate: 'L4' }).issue;
  R.setStatus('ISS-01', 'closed');
  ok('open B blocks', I.readiness(plan, m, 'ups', R.load()).blockers.some((x) => x.id === b.id));
  ok('B with the CxM + EoR "not affected" record does not block', R.setWaiver(b.id, true) && !I.readiness(plan, m, 'ups', R.load()).blockers.some((x) => x.id === b.id) && I.readiness(plan, m, 'ups', R.load()).conditions.some((x) => x.id === b.id));
  ok('waiver only on B', R.setWaiver('ISS-02', true) === false);
  const keys = I.readiness(plan, m, 'ups', R.load()).items.map((x) => x.key);
  keys.forEach((k) => R.check('ups', 'L4', k, true));
  const done = I.readiness(plan, m, 'ups', R.load());
  ok('all items ticked, no blocker → ready, and the verdict says ready ≠ energisation', done.ready === true && /Ready for the L4 gate/.test(done.reason) && /not a permit to energise/.test(done.note), done);
  R.check('ups', 'L4', 'witness', false);
  ok('one item unticked → not ready, reason names it', /1 of 5 items open: Witness/.test(I.readiness(plan, m, 'ups', R.load()).reason), I.readiness(plan, m, 'ups', R.load()).reason);
  ok('an issue on another gate does not block this one', R.add({ title: 'IST script draft', severity: 'A', system: 'ups', gate: 'L5' }).ok && !I.readiness(plan, m, 'ups', R.load()).blockers.some((x) => x.gate === 'L5'));
  ok('L5 reached → readiness has no next gate', I.readiness(plan, plan.finishMonth + 1, 'ups', R.load()).gate === null);
  ok('remove', R.remove('ISS-02') && !R.load().items.some((x) => x.id === 'ISS-02'));
  ok('persists across instances', I.store(st).load().items.length === R.load().items.length);
  st.setItem(I.KEY, '{"version":3}'); ok('foreign version → empty', I.store(st).load().items.length === 0);
  st.setItem(I.KEY, 'x{'); ok('malformed → empty', I.store(st).load().items.length === 0);
  st.setItem(I.KEY, JSON.stringify({ version: 1, seq: 4, items: [{ id: 'ISS-04', title: 'ok', severity: 'A', system: 'ups', gate: 'L4', status: 'open' }, { id: 'X', title: 'junk', severity: 'Q' }], checks: { 'ups:L4:request': true, 'bad key': true } }));
  const cleaned = I.store(st).load();
  ok('load drops junk rows and junk check keys', cleaned.items.length === 1 && Object.keys(cleaned.checks).join() === 'ups:L4:request', cleaned);
  const nul = I.store(null);
  ok('no storage: add works in memory, save reports false', nul.add({ title: 't', severity: 'A', system: 'ups', gate: 'L4' }).ok === true && nul.persisted() === false && nul.load().items.length === 1);
}
console.log(`CX ISSUES — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
