#!/usr/bin/env node
/**
 * test-project-core.mjs — P01 Stage 1 core (js/rz-project.js), no browser.
 *  C1 validation ranges (PRD-P01 §10) accept the edges and refuse one step outside
 *  C2 create / update (rev+1) / remove / active; immutable reads (a returned project cannot change the store)
 *  C3 a damaged store is quarantined, not dropped; blocked storage = unavailable mode, every write refused
 *  C4 conversions for every registry field format and factor, round trip page -> canonical -> page, clamp reported
 *  C5 publish stamps the project revision; editing the project makes the result stale
 *  C6 overrides set/clear per calc; export/import round trip, wrong version refused, id collision gets a new id
 *  C7 the 256 KB cap refuses a write and leaves the store as it was
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const P = require('../js/rz-project.js');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
let t = 0; const now = () => new Date(Date.UTC(2026, 10, 11, 0, 0, t++)).toISOString();

/* C1 */
ok(P.validateInputs({ it_load_kw: 50, tier: 4, pue_design: 1.05, energy_price_usd_kwh: 0.5, horizon_years: 40, country: 'ID' }).length === 0, 'C1 edges refused');
for (const [k, v] of [['it_load_kw', 49], ['it_load_kw', 500001], ['tier', 5], ['tier', 2.5], ['pue_design', 1.04], ['energy_price_usd_kwh', 0.6], ['horizon_years', 4], ['country', 'id'], ['country', 'IDN'], ['it_load_kw', '20000'], ['bogus', 1]]) {
  ok(P.validateInputs({ [k]: v }).length === 1, `C1 ${k}=${JSON.stringify(v)} accepted`);
}
/* C2 */
const st = mem(); const S = P.createStore(st, now);
ok(S.mode() === 'ok' && S.list().length === 0 && S.active() === null, 'C2 empty store');
const c1 = S.create('Jakarta 20 MW', { it_load_kw: 20000, country: 'ID', tier: 3, pue_design: 1.35 });
ok(c1.ok && S.active().id === c1.id && S.active().rev === 1, 'C2 create sets active rev 1');
ok(!S.create('', {}).ok && !S.create('x'.repeat(81), {}).ok && !S.create('ok', { tier: 9 }).ok, 'C2 invalid create accepted');
const a = S.active(); a.name = 'mutated'; a.inputs.it_load_kw = 1;
ok(S.active().name === 'Jakarta 20 MW' && S.active().inputs.it_load_kw === 20000, 'C2 a returned project changed the store');
ok(S.update(c1.id, { inputs: { it_load_kw: 30000 } }).ok && S.active().rev === 2 && S.active().inputs.it_load_kw === 30000, 'C2 update rev+1');
ok(!S.update(c1.id, { inputs: { pue_design: 9 } }).ok && S.active().inputs.pue_design === 1.35, 'C2 invalid update applied');
ok(P.createStore(st, now).active().inputs.it_load_kw === 30000, 'C2 not persisted');
/* C3 */
const bad = mem(); bad.setItem(P.KEY, '{"v":1,"active":"x","projects":{}}');
const B = P.createStore(bad, now);
ok(B.list().length === 0 && bad.getItem(P.QUARANTINE) === '{"v":1,"active":"x","projects":{}}' && bad.getItem(P.KEY) === null && /set aside/.test(B.note()), 'C3 damaged store not quarantined');
const bad2 = mem(); bad2.setItem(P.KEY, 'not json'); P.createStore(bad2, now);
ok(bad2.getItem(P.QUARANTINE) === 'not json', 'C3 unparseable store not quarantined');
const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() {} };
const X = P.createStore(blocked, now);
ok(X.mode() === 'unavailable' && !X.create('a', {}).ok, 'C3 blocked storage not reported / write accepted');
/* C4 */
const reg = JSON.parse(readFileSync(new URL('../data/calculators.json', import.meta.url))).calculators;
const fieldsSeen = new Set();
for (const c of reg) for (const [key, spec] of Object.entries(c.fields || {})) {
  fieldsSeen.add(spec.format || 'factor');
  const canon = { it_load: 20000, pue: 1.35, country: 'ID', tier: 3 }[key];
  const pg = P.toPage(key, canon, spec);
  ok(pg && P.fromPage(key, pg.value, spec) === canon, `C4 ${c.calc}.${key} round trip ${canon} -> ${pg && pg.value} -> ${pg && P.fromPage(key, pg.value, spec)}`);
}
ok(['factor', 'iso2', 'iso2+region', 'digit', 'tier-n'].every((f) => fieldsSeen.has(f)), `C4 formats covered: ${[...fieldsSeen]}`);
ok(P.toPage('it_load', 20000, { factor: 1000 }).value === '20', 'C4 kW -> MW');
const cl = P.toPage('it_load', 200000, { factor: 1 }, { min: '50', max: '100000', step: '50' });
ok(cl.clamped && cl.value === '100000', `C4 clamp not reported: ${JSON.stringify(cl)}`);
ok(P.fromPage('country', 'US-VA', { format: 'iso2+region' }) === 'US' && P.fromPage('it_load', 'abc', { factor: 1 }) === null, 'C4 fromPage parse');
/* C5 */
ok(S.publish('capex', { total_capex_usd: { value: 1.6e8, unit: 'USD' }, junk: { value: NaN } }).ok, 'C5 publish refused');
let r = S.active().results.capex;
ok(r.total_capex_usd.rev === 2 && !('junk' in r) && !P.isStale(r.total_capex_usd, S.active()), 'C5 publish stamp');
S.update(c1.id, { inputs: { tier: 4 } });
ok(P.isStale(S.active().results.capex.total_capex_usd, S.active()), 'C5 edit did not make the result stale');
/* C6 */
ok(S.setOverride('tco', 'tcoPue', 1.3).ok && S.active().overrides.tco.tcoPue.value === '1.3', 'C6 override');
ok(S.clearOverride('tco', 'tcoPue').ok && !('tcoPue' in S.active().overrides.tco), 'C6 clear');
const ex = S.exportJson(c1.id);
const im = S.importJson(ex);
ok(im.ok && im.id !== c1.id && S.get(im.id).name === 'Jakarta 20 MW' && S.get(im.id).rev === 1, 'C6 import collision / round trip');
ok(!S.importJson('{"v":2,"project":{}}').ok && !S.importJson('nope').ok && !S.importJson(JSON.stringify({ v: 1, project: { name: 'x', inputs: { tier: 7 } } })).ok, 'C6 bad import accepted');
ok(S.remove(im.id).ok && S.get(im.id) === null, 'C6 remove');
/* C7 */
const before = st.getItem(P.KEY);
const big = S.create('big', {}); // fine
const huge = S.update(c1.id, { name: 'x' });
ok(big.ok && huge.ok, 'C7 setup');
const n0 = S.list().length;
let capHit = null;
for (let i = 0; i < 4000 && !capHit; i++) { const res = S.create('p' + i + 'x'.repeat(70), { it_load_kw: 1000 }); if (!res.ok) capHit = res.error; }
ok(capHit && /256 KB/.test(capHit), `C7 cap never hit (${capHit})`);
ok(P.createStore(st, now).list().length === S.list().length, 'C7 in-memory state diverged from storage after a refused write');
void before; void n0;

if (fails.length) { console.log(`FAIL test-project-core — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS test-project-core — ${checks} checks: ranges, CRUD + immutability, quarantine, blocked storage, every registry format, publish/stale, overrides, export/import, 256 KB cap`);
