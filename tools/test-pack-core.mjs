#!/usr/bin/env node
/**
 * test-pack-core.mjs — P04 project pack, the DOM-free half (js/rz-pack.js), in Node.
 *
 *  K1 planInputs: a project value goes to the page field in the page's format and the register says "project"
 *  K2 a value outside the page field's limits is clamped and the register says so
 *  K3 a per-page override wins over the project and the register says "override on this page"
 *  K4 a field the project does not set keeps the page value and reads "page default"
 *  K5 a select that does not offer the project value keeps the page value and names the refused value
 *  K6 a mapped field missing from the page is listed, not dropped and not thrown on
 *  K7 consumes: a CAPEX result reaches ROI scaled by its factor, "from CAPEX Calculator"; an older revision says "out of date";
 *     no result reads "page default (... not run)"
 *  K8 statusOf: not run / out of date / current
 *  K9 registerHtml escapes every cell (a project name or value can never inject markup)
 *  K10 numerals keeps the printed form of every number (thousands separators, decimals)
 *  K11 planInputs never mutates the project
 *
 * Run: node tools/test-pack-core.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../js/rz-project.js');
const K = require('../js/rz-pack.js');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

const field = (id, value, extra = {}) => ({ id, tagName: 'INPUT', type: 'number', value: String(value), min: '', max: '', ...extra });
const select = (id, value, options) => ({ id, tagName: 'SELECT', value, options: options.map((v) => ({ value: v })) });
const dom = (els) => (id) => els.find((e) => e.id === id) || null;

const project = {
  id: 'p1', name: 'Jakarta <b>A</b>', rev: 3, inputs: { it_load_kw: 2000, pue_design: 1.35, country: 'ID', tier: 3, energy_price_usd_kwh: null },
  results: { capex: { capex_total: { value: 23610000, rev: 3, at: '2026-11-11T00:00:00Z' } } },
  overrides: { opex: { opPue: { value: '1.5', at: '2026-11-11T00:00:00Z' } } },
};
const frozen = JSON.stringify(project);

/* K1, K2, K4 — capex-shaped entry */
{
  const entry = { calc: 'capex', fields: {
    it_load: { id: 'itLoad', unit: 'kW' }, pue: { id: 'pue', unit: '' }, energy_price: { id: 'price', unit: 'USD/kWh' } } };
  const els = [field('itLoad', 1000, { max: '1500' }), field('pue', 1.4), field('price', 0.1)];
  const r = K.planInputs(entry, project, P, dom(els));
  const row = (id) => r.rows.find((x) => x.id === id);
  ok(r.inputs.pue && r.inputs.pue.v === '1.35' && r.inputs.pue.t === 'number', `K1 pue input ${JSON.stringify(r.inputs.pue)}`);
  ok(row('pue').source === 'project', `K1 pue source "${row('pue').source}"`);
  ok(r.inputs.itLoad && r.inputs.itLoad.v === '1500', `K2 it load not clamped to the field max: ${JSON.stringify(r.inputs.itLoad)}`);
  ok(/clamped/.test(row('itLoad').source), `K2 clamp not said: "${row('itLoad').source}"`);
  ok(!r.inputs.price && row('price').source === 'page default' && row('price').value === '0.1', `K4 unset field: ${JSON.stringify(row('price'))}`);
}
/* K3 — override wins */
{
  const entry = { calc: 'opex', fields: { pue: { id: 'opPue' } } };
  const r = K.planInputs(entry, project, P, dom([field('opPue', 1.2)]));
  ok(r.inputs.opPue && r.inputs.opPue.v === '1.5', `K3 override not used: ${JSON.stringify(r.inputs.opPue)}`);
  ok(r.rows[0].source === 'override on this page', `K3 source "${r.rows[0].source}"`);
}
/* K5, K6 — select without the value; missing field */
{
  const entry = { calc: 'tier', fields: { tier: { id: 'tierSel', format: 'tier-n' }, country: { id: 'nowhere' } } };
  const r = K.planInputs(entry, project, P, dom([select('tierSel', 'tier-2', ['tier-1', 'tier-2'])]));
  const t = r.rows.find((x) => x.id === 'tierSel');
  ok(!r.inputs.tierSel && /not offered/.test(t.source) && t.value === 'tier-2', `K5 select: ${JSON.stringify(t)}`);
  const m = r.rows.find((x) => x.id === 'nowhere');
  ok(m && m.source === 'field not on the page', `K6 missing field: ${JSON.stringify(m)}`);
  const r2 = K.planInputs(entry, project, P, dom([select('tierSel', 'tier-1', ['tier-1', 'tier-2', 'tier-3'])]));
  ok(r2.inputs.tierSel && r2.inputs.tierSel.v === 'tier-3' && r2.inputs.tierSel.t === 'select', `K5 offered select: ${JSON.stringify(r2.inputs.tierSel)}`);
}
/* K7 — consumes */
{
  const entry = { calc: 'roi', fields: {}, consumes: { totalCapex: { from: 'capex.capex_total', factor: 1000000, label: 'CAPEX Calculator' } } };
  const r = K.planInputs(entry, project, P, dom([field('totalCapex', 5000000)]));
  ok(r.inputs.totalCapex && r.inputs.totalCapex.v === '23.61', `K7 consumed value ${JSON.stringify(r.inputs.totalCapex)}`);
  ok(r.rows[0].source === 'from CAPEX Calculator', `K7 source "${r.rows[0].source}"`);
  const old = { ...project, rev: 4 };
  ok(/out of date/.test(K.planInputs(entry, old, P, dom([field('totalCapex', 1)])).rows[0].source), 'K7 stale consumed result not said');
  const none = { ...project, results: {} };
  const rn = K.planInputs(entry, none, P, dom([field('totalCapex', 7)]));
  ok(!rn.inputs.totalCapex && rn.rows[0].source === 'page default (CAPEX Calculator not run)' && rn.rows[0].value === '7', `K7 not run: ${JSON.stringify(rn.rows[0])}`);
}
/* K8 */
ok(K.statusOf(project, 'capex', P) === 'current', 'K8 current');
ok(K.statusOf({ ...project, rev: 4 }, 'capex', P) === 'out of date', 'K8 out of date');
ok(K.statusOf(project, 'opex', P) === 'not run', 'K8 not run');
/* K9 */
{
  const h = K.registerHtml([{ title: 'A<script>', rows: [{ key: 'k', label: '<img src=x onerror=1>', value: '"><b>', unit: '&', source: "o'k" }] }]);
  ok(!/<script>|<img|<b>/.test(h), 'K9 register cell not escaped: ' + h);
  ok(/&lt;img src=x onerror=1&gt;/.test(h) && /&amp;/.test(h) && /o&#39;k/.test(h), 'K9 escaped text missing');
}
/* K10 */
ok(JSON.stringify(K.numerals('$23.61M · 1,000 kW · 99.741 % · Tier 3')) === '["23.61","1,000","99.741","3"]', 'K10 numerals ' + JSON.stringify(K.numerals('$23.61M · 1,000 kW · 99.741 % · Tier 3')));
/* K11 */
ok(JSON.stringify(project) === frozen, 'K11 planInputs mutated the project');

if (fails.length) { console.error('FAIL test-pack-core — ' + fails.length + ' of ' + checks + ':\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('PASS test-pack-core — ' + checks + ' checks: project/clamp/override/default/select/missing field, consumes + stale, status, escaping, numerals, no mutation');
