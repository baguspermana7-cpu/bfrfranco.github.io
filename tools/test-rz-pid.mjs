#!/usr/bin/env node
/*
 * test-rz-pid.mjs — gate for js/rz-pid.js (R116 P&ID mock).
 *
 * 1. Runs the graph builder on the reference's OWN fixture (tools/fixtures/pid-mini-plant, copied from
 *    github.com/ScottDuncanAI/PID-to-Knowledge-Graph tests/fixtures/mini_plant, MIT) and asserts what the
 *    reference's tests/test_build.py asserts, line for line.
 * 2. Validates both plants against the reference's extraction.schema.json (the subset of JSON Schema it uses).
 * 3. On data/pid/cdu-secondary-loop.json: every instrument is in a loop or explicitly standalone, every step's
 *    ids exist in the graph, the flow steps cover every equipment item exactly once, every value names a
 *    source that exists, every low-confidence item says why, and every route passes its line's path items.
 *
 * 4. R117: the module is split (graph model / renderer, each <= 800 lines) with the same public API; the heat
 *    balance closes or is CARRIED as a marked discrepancy (an unmarked mismatch > 3 % fails, proven on a mutated
 *    copy); loops are walked in coolant order; every tag's ISA-5.1 meaning is a DB entry equal to decodeTag().
 * 5. In a real browser (own server, lane-safe): tags go through RZExplain, the page shows the balance arithmetic,
 *    and at 390 px there is no sideways pan, every step's lit path is inside the drawing and no visible label
 *    renders under 11 px.
 *
 * Exit 1 on any failure. Usage: node tools/test-rz-pid.mjs [--no-browser]   (run the browser part through rz-lane)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const GRAPH = path.join(ROOT, 'js/rz-pid-graph.js');
const P = require(fs.existsSync(GRAPH) ? GRAPH : path.join(ROOT, 'js/rz-pid.js'));
const CDU = require(path.join(ROOT, 'js/cdu-engine.js'));
const NO_BROWSER = process.argv.includes('--no-browser');
const FIX = path.join(ROOT, 'tools/fixtures/pid-mini-plant');

let pass = 0;
const fails = [];
function check(name, ok, detail) {
  if (ok) pass++;
  else fails.push(name + (detail ? ' — ' + detail : ''));
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const edges = (g, t) => new Set(g.edges.filter((e) => e.type === t).map((e) => e.source + ' -> ' + e.target));
const node = (g, id) => g.byId[id];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- 1. reference fixture (test_build.py) */
const pages = ['page_01.json', 'page_02.json'].map((f) => readJson(path.join(FIX, f)));
const mini = P.buildGraph(pages, 'mini', 'Mini plant');

check('test_no_build_errors', !mini.issues.some((i) => i.severity === 'error'), JSON.stringify(mini.issues.filter((i) => i.severity === 'error')));

const feeds = edges(mini, 'FEEDS');
for (const f of ['TK-100 -> P-101', 'P-101 -> TK-200', 'P-101 -> TK-100', 'BOUNDARY:RAW WATER SUPPLY -> TK-100', 'TK-200 -> BOUNDARY:TO DISTRIBUTION'])
  check('test_equipment_level_flow: FEEDS ' + f, feeds.has(f));

const flows = edges(mini, 'FLOWS_TO');
check('test_off_page_connectors_paired: P01.OPC1 -> P02.OPC1', flows.has('P01.OPC1 -> P02.OPC1'));
check('test_off_page_connectors_paired: linked_to', node(mini, 'P01.OPC1') && node(mini, 'P01.OPC1').attributes.linked_to === 'P02.OPC1');

for (const f of ['P-101 -> P01.L2.1', 'P01.L2.2 -> FT-101', 'FV-101 -> P01.L2.4', 'P01.L2.2 -> P01.L3.1'])
  check('test_line_expansion_and_tee: FLOWS_TO ' + f, flows.has(f));

const meas = edges(mini, 'MEASURES');
for (const m of ['LT-200 -> TK-100', 'PI-102 -> P01.L2.2', 'FT-101 -> P01.L2.2']) check('test_measurements: MEASURES ' + m, meas.has(m));
check('test_measurements: FT-101 inline', node(mini, 'FT-101') && node(mini, 'FT-101').attributes.inline === true);

const ids = new Set(mini.nodes.map((n) => n.id));
check('test_tag_normalized_and_merged: FIC-101 present, "FIC 101" absent', ids.has('FIC-101') && !ids.has('FIC 101'));
check('test_tag_normalized_and_merged: one TK-100', mini.nodes.filter((n) => n.tag === 'TK-100').length === 1);

const f101 = node(mini, 'LOOP:F-101');
check('test_control_loop_with_relay: LOOP:F-101 exists', !!f101);
if (f101) {
  const a = f101.attributes;
  check('test_control_loop_with_relay: kind control', f101.kind === 'control', f101.kind);
  check('test_control_loop_with_relay: sensors [FT-101]', eq(a.sensors, ['FT-101']), JSON.stringify(a.sensors));
  check('test_control_loop_with_relay: controllers [FIC-101]', eq(a.controllers, ['FIC-101']), JSON.stringify(a.controllers));
  check('test_control_loop_with_relay: final_elements [FV-101]', eq(a.final_elements, ['FV-101']), JSON.stringify(a.final_elements));
  check('test_control_loop_with_relay: relays [FY-101]', eq(a.relays, ['FY-101']), JSON.stringify(a.relays));
  check('test_cascade: cascade_master LOOP:L-200', a.cascade_master === 'LOOP:L-200');
}
check('test_control_loop_with_relay: ACTUATES FIC-101 -> FV-101', edges(mini, 'ACTUATES').has('FIC-101 -> FV-101'));
check('test_cascade: CASCADES_TO LOOP:L-200 -> LOOP:F-101', edges(mini, 'CASCADES_TO').has('LOOP:L-200 -> LOOP:F-101'));

const l201 = node(mini, 'LOOP:L-201');
check('test_interlock_and_vfd: LOOP:L-201 interlock', !!l201 && l201.kind === 'interlock', l201 && l201.kind);
check('test_interlock_and_vfd: TRIPS LSLL-201 -> P-101', edges(mini, 'TRIPS').has('LSLL-201 -> P-101'));
const s101 = node(mini, 'LOOP:S-101');
check('test_interlock_and_vfd: LOOP:S-101 final [P-101]', !!s101 && eq(s101.attributes.final_elements, ['P-101']), s101 && JSON.stringify(s101.attributes.final_elements));
check('test_single_instruments_are_not_loops', !ids.has('LOOP:P-102') && !ids.has('LOOP:T-210'));

const unres = P.buildGraph([{ page: 1, equipment: [{ id: 'TK-1', tag: 'TK-1', kind: 'tank' }], lines: [{ id: 'L1', from: 'TK-1', to: 'P-999' }] }], 'x', 'x');
check('test_unresolved_reference_is_reported', eq(unres.issues.filter((i) => i.severity === 'error').map((i) => i.code), ['unresolved_reference']));
const impl = P.buildGraph([{ page: 1, instruments: [{ id: 'LT-1', tag: 'LT-1', measures: null }], signals: [{ from: 'LT-1', to: 'LIC-1' }] }], 'x', 'x');
check('test_signal_to_undeclared_bubble_creates_flagged_instrument: LIC-1 at 0.5', impl.nodes.some((n) => n.id === 'LIC-1' && n.confidence === 0.5));
check('test_signal_to_undeclared_bubble_creates_flagged_instrument: issue', impl.issues.some((i) => i.code === 'implicit_instrument'));

/* test_isa.py essentials */
check('isa: normalize "fit 0502" -> FIT-0502', P.normalizeTag('fit 0502') === 'FIT-0502');
check('isa: normalize "660 TK 004" -> 660-TK-004', P.normalizeTag('660 TK 004') === '660-TK-004');
check('isa: FIC decode', P.decodeTag('FIC-101').text === 'FIC = Flow, Indicating, Controller', P.decodeTag('FIC-101').text);
check('isa: PDT loop key P-02 (variable PD)', P.parseIsaTag('PDT-02').loopKey === 'P-02' && P.parseIsaTag('PDT-02').variable === 'differential pressure');

/* ---------------------------------------------------------------- 2. schema (reference's extraction.schema.json) */
const schema = readJson(path.join(FIX, 'extraction.schema.json'));
function validate(v, s, at, errs) {
  if (s.$ref) s = schema.$defs[s.$ref.split('/').pop()];
  if (s.anyOf) {
    const ok = s.anyOf.some((alt) => { const e = []; validate(v, alt, at, e); return !e.length; });
    if (!ok) errs.push(at + ': matches no anyOf branch');
    return;
  }
  const type = Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v;
  if (s.type && !(s.type === type || (s.type === 'number' && type === 'integer'))) { errs.push(at + ': ' + type + ' is not ' + s.type); return; }
  if (s.enum && !s.enum.includes(v)) errs.push(at + ': ' + JSON.stringify(v) + ' not in enum');
  if (s.minimum !== undefined && v < s.minimum) errs.push(at + ': below minimum');
  if (s.maximum !== undefined && v > s.maximum) errs.push(at + ': above maximum');
  if (type === 'array' && s.items) v.forEach((x, i) => validate(x, s.items, at + '[' + i + ']', errs));
  if (type === 'object') {
    for (const r of s.required || []) if (!(r in v)) errs.push(at + ': missing ' + r);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties && k in s.properties) validate(x, s.properties[k], at + '.' + k, errs);
      else if (s.additionalProperties === false) errs.push(at + ': extra property ' + k);
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') validate(x, s.additionalProperties, at + '.' + k, errs);
    }
  }
}
for (const [name, pg] of [['mini page 1', pages[0]], ['mini page 2', pages[1]]]) {
  const errs = []; validate(pg, schema, name, errs);
  check('schema: ' + name + ' validates', !errs.length, errs.slice(0, 3).join('; '));
}
const doc = readJson(path.join(ROOT, 'data/pid/cdu-secondary-loop.json'));
{
  const errs = []; doc.pages.forEach((pg, i) => validate(pg, schema, 'cdu page ' + (i + 1), errs));
  check('schema: CDU page validates against the reference extraction schema', !errs.length, errs.slice(0, 5).join('; '));
  const bad = { page: 1, equipment: [{ id: 'A', kind: 'tank', colour: 'red' }] }, e2 = [];
  validate(bad, schema, 'seeded', e2);
  check('schema: validator rejects a seeded extra property (it can fail)', e2.length > 0);
}

/* ---------------------------------------------------------------- 3. CDU plant */
const g = P.buildGraph(doc.pages, doc.plant.id, doc.plant.name);
const ex = P.explain(g);
check('cdu: no build errors or warnings', !g.issues.some((i) => i.severity !== 'info'), JSON.stringify(g.issues));

const loopsOf = {};
g.edges.filter((e) => e.type === 'MEMBER_OF').forEach((e) => { (loopsOf[e.source] = loopsOf[e.source] || []).push(e.target); });
for (const n of g.nodes.filter((n) => n.type === 'Instrument')) {
  check('cdu: ' + n.id + ' is in a loop or explicitly standalone', !!loopsOf[n.id] !== !!n.attributes.standalone,
    loopsOf[n.id] ? 'in ' + loopsOf[n.id] + ' AND marked standalone' : 'in no loop and not marked standalone');
}
const want = { 'LOOP:T-01': ['control', ['TT-01'], ['TIC-01'], ['TCV-01']], 'LOOP:PD-02': ['control', ['PDT-02'], ['PDIC-02'], ['P-01A', 'P-01B']], 'LOOP:LS-01': ['interlock', ['LSH-01'], undefined, ['P-01A', 'P-01B']] };
for (const [id, [kind, s, c, f]] of Object.entries(want)) {
  const L = g.byId[id];
  check('cdu: ' + id + ' ' + kind + ' ' + s + ' -> ' + c + ' -> ' + f, !!L && L.kind === kind && eq(L.attributes.sensors, s) && eq(L.attributes.controllers, c) &&
    eq((L.attributes.final_elements || []).slice().sort(), f), L && JSON.stringify(L.attributes));
}
check('cdu: loop T-01 acts on the facility-water side (TCV-01 on L-FWS)', g.edges.some((e) => e.type === 'FLOWS_TO' && e.source === 'P01.L-FWS.2' && e.target === 'TCV-01'));
check('cdu: PD-02 reaches the pumps through the VFD relays', eq((g.byId['LOOP:PD-02'] || { attributes: {} }).attributes.relays, ['SY-01A', 'SY-01B']));
check('cdu: TRIPS LSH-01 -> P-01A and P-01B', edges(g, 'TRIPS').has('LSH-01 -> P-01A') && edges(g, 'TRIPS').has('LSH-01 -> P-01B'));

const known = new Set(g.nodes.map((n) => n.id).concat(g.edges.map((e) => e.id)));
for (const s of ex.steps) {
  const missing = s.ids.filter((i) => !known.has(i));
  check('cdu: step ' + s.id + ' ids all exist', !missing.length && s.ids.length > 0, missing.join(', '));
  for (const st of s.pulse || []) for (const eid of st) check('cdu: step ' + s.id + ' pulse edge ' + eid + ' is a SIGNAL_TO', g.edges.some((e) => e.id === eid && e.type === 'SIGNAL_TO'));
}
const flowSteps = ex.steps.filter((s) => s.section === 'flow');
for (const n of g.nodes.filter((n) => n.type === 'Equipment')) {
  const subj = flowSteps.filter((s) => s.subject === n.id).length;
  check('cdu: equipment ' + n.id + ' is the subject of exactly one flow step', subj === 1, 'subject of ' + subj);
  check('cdu: equipment ' + n.id + ' is lit by some flow step', flowSteps.some((s) => s.ids.includes(n.id)));
}
const loopSteps = ex.steps.filter((s) => s.section === 'loop');
check('cdu: every loop has an overview step with a pulse', g.nodes.filter((n) => n.type === 'ControlLoop').every((L) => loopSteps.some((s) => s.loop === L.id && s.part === 'overview' && s.pulse && s.pulse.length)));

/* sources and confidence */
const items = [];
for (const pg of doc.pages) for (const grp of ['equipment', 'components', 'instruments', 'boundaries']) for (const it of pg[grp] || []) items.push([grp, it]);
for (const [grp, it] of items) {
  const a = it.attributes || {};
  if (a.value !== undefined || a.band !== undefined || a.setpoint !== undefined || grp !== 'boundaries')
    check('cdu: ' + it.id + ' names a source that exists', a.src ? !!doc.sources[a.src] : grp === 'boundaries', 'src=' + a.src);
  if ((it.confidence ?? 0.9) < P.LOW_CONFIDENCE) check('cdu: low-confidence ' + it.id + ' says why', !!(a.basis || it.notes));
}
for (const pg of doc.pages) for (const l of pg.lines) if ((l.confidence ?? 0.85) < P.LOW_CONFIDENCE) check('cdu: low-confidence line ' + l.id + ' says why', !!l.notes);

/* drawing data: every line has a route that passes its path items in order */
const anchorOf = (id) => {
  const a = doc.layout.anchors[id]; if (a) return a;
  const it = items.find(([, x]) => x.id === id)[1]; const [x0, y0, x1, y1] = it.bbox;
  return [(x0 + x1) / 2 * doc.layout.viewBox[0], (y0 + y1) / 2 * doc.layout.viewBox[1]];
};
for (const pg of doc.pages) for (const l of pg.lines) {
  const r = doc.layout.routes[l.id];
  let at = 0, ok = !!r;
  for (const ref of l.path || []) {
    if (!ok) break;
    const a = anchorOf(ref); const i = r.findIndex((p, k) => k >= at && Math.abs(p[0] - a[0]) < 0.6 && Math.abs(p[1] - a[1]) < 0.6);
    if (i < 0) ok = false; else at = i;
  }
  check('cdu: route ' + l.id + ' passes its path items in order', ok);
}

/* ---------------------------------------------------------------- 4. R117 */
/* 4a. split: graph model + renderer, each <= 800 lines, same public API (plus balance/flowRank/explainKey) */
const MODS = ['js/rz-pid-build.js', 'js/rz-pid-graph.js', 'js/rz-pid-render.js'];
for (const f of MODS) {
  const p = path.join(ROOT, f), n = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').length : -1;
  check('split: ' + f + ' exists and is <= 800 lines', n > 0 && n <= 800, n < 0 ? 'missing' : n + ' lines');
}
check('split: js/rz-pid.js is gone (no third copy of the model)', !fs.existsSync(path.join(ROOT, 'js/rz-pid.js')));
for (const k of ['buildGraph', 'explain', 'normalizeTag', 'normalizeLabel', 'parseIsaTag', 'decodeTag', 'loopVariable', 'LOW_CONFIDENCE', 'LOCATION_WORD', 'balance', 'flowRank', 'explainKey'])
  check('api: RZPid.' + k + ' exported in Node', P[k] !== undefined);
{
  const html = fs.readFileSync(path.join(ROOT, 'rz-pid-mock.html'), 'utf8');
  const order = ['js/cdu-model.js', 'js/cdu-engine.js', 'js/rz-pid-build.js', 'js/rz-pid-graph.js', 'js/rz-pid-render.js', 'js/rz-explain-db.js', 'js/rz-explain.js'].map((s) => html.indexOf('src="' + s));
  check('page: loads model, engine, the three pid modules and RZExplain in dependency order', order.every((i, k) => i > 0 && (!k || i > order[k - 1])), JSON.stringify(order));
  check('page: no page-own tooltip markup left', !/rzpid-tip/.test(html) && !/rzpid-tip/.test(fs.existsSync(path.join(ROOT, 'js/rz-pid-render.js')) ? fs.readFileSync(path.join(ROOT, 'js/rz-pid-render.js'), 'utf8') : 'rzpid-tip'));
}

/* 4b. heat balance. Hand computation (cdu-engine.js PG25 at the mean of 32 and 43 °C = 37.5 °C):
 *   water rho = 1000.6 - 0.0476*37.5 - 0.0034*37.5^2 = 994.034 kg/m3; PG25 x 1.024 = 1017.89 kg/m3 = 1.01789 kg/L
 *   cp = 4.186 x 0.905 = 3.78833 kJ/kgK
 *   Q = 390 x 1.01789 x 3.78833 x 11 / 60 = 275.71 kW;  300 kW needs 300 x 60 / (1.01789 x 3.78833 x 11) = 424.36 LPM = 1.4145 LPM/kW */
const balOf = (gr) => (typeof P.balance === 'function' ? P.balance(gr, CDU.fluidProps) : []);
const bal = balOf(g), hx = bal.find((r) => r.node === 'E-01');
check('balance: the CDU plant has a balance on E-01 (the check cannot pass vacuously)', !!hx, JSON.stringify(bal).slice(0, 200));
if (hx) {
  const near = (a, b) => Math.abs(a - b) / b < 0.005;
  check('balance: Q = 275.71 kW within 0.5 %', near(hx.q_kw, 275.71), String(hx.q_kw));
  check('balance: 300 kW needs 424.36 LPM within 0.5 %', near(hx.need_lpm, 424.36), String(hx.need_lpm));
  check('balance: 1.4145 LPM/kW within 0.5 %', near(hx.need_lpm_per_kw, 1.4145), String(hx.need_lpm_per_kw));
  check('balance: declared 300 kW, short by about 8 %', hx.declared_kw === 300 && Math.abs(hx.diff + 0.081) < 0.002, String(hx.diff));
  check('balance: outside the 3 % tolerance and therefore marked', !hx.within && hx.marked, JSON.stringify({ within: hx.within, marked: hx.marked }));
  const qs = (g.byId['E-01'].attributes.discrepancy || {}).quotes || [];
  check('balance: the mark quotes both figures, each with a source that exists', qs.length === 2 && qs.every((q) => q.text && doc.sources[q.src]), JSON.stringify(qs));
}
check('balance: no finding on the committed data', bal.length > 0 && bal.every((r) => !r.finding), JSON.stringify(bal.map((r) => r.finding)));
{
  /* mutated copies: the gate must be able to fail */
  const unmarked = JSON.parse(JSON.stringify(doc));
  delete unmarked.pages[0].equipment.find((e) => e.id === 'E-01').attributes.discrepancy;
  const ru = balOf(P.buildGraph(unmarked.pages, 'x', 'x'));
  check('balance: an UNMARKED 8 % mismatch is a finding (seeded copy)', ru.some((r) => r.finding && /unmarked/.test(r.finding)), JSON.stringify(ru.map((r) => r.finding)));
  const stale = JSON.parse(JSON.stringify(doc));
  stale.pages[0].instruments.find((i) => i.id === 'FT-01').attributes.flow_lpm = 424;
  const rs = balOf(P.buildGraph(stale.pages, 'x', 'x'));
  check('balance: a mark on a balance that closes is a finding too (seeded copy)', rs.some((r) => r.finding && /closes/.test(r.finding)), JSON.stringify(rs.map((r) => r.finding)));
  const blind = JSON.parse(JSON.stringify(doc));
  blind.pages[0].instruments.find((i) => i.id === 'TT-02').attributes.value = 'about 43';
  const rb = balOf(P.buildGraph(blind.pages, 'x', 'x'));
  check('balance: a value that is not a number is reported, never guessed (seeded copy)', rb.some((r) => r.finding && /not a number/.test(r.finding)), JSON.stringify(rb.map((r) => r.finding)));
}

/* 4c. loops in coolant order: rank = earliest flow position of a point a loop's sensors measure; off-path last */
{
  const got = ex.steps.filter((s) => s.section === 'loop' && s.part === 'overview').map((s) => s.loop);
  check('loop order follows the coolant: T-01 (supply temperature) -> PD-02 (loop dP) -> LS-01 (skid floor, off the flow path)',
    eq(got, ['LOOP:T-01', 'LOOP:PD-02', 'LOOP:LS-01']), JSON.stringify(got));
  if (typeof P.flowRank === 'function') {
    const r = P.flowRank(g);
    check('flowRank: TT-01 point is upstream of the PDT-02 point', r['P01.L-SUP.2'] < r['P01.L-SUP.3'], JSON.stringify([r['P01.L-SUP.2'], r['P01.L-SUP.3']]));
    check('flowRank: the skid floor is off the flow path', r['BOUNDARY:CDU SKID FLOOR · LEAK ROPE'] === undefined);
  }
}

/* 4d. ISA decode lives in the RZExplain DB, one entry per letter set, title = decodeTag() */
const dbSrc = fs.readFileSync(path.join(ROOT, 'js/rz-explain-db.js'), 'utf8');
const DB = JSON.parse(dbSrc.slice(dbSrc.indexOf('{', dbSrc.indexOf('RZ_EXPLAIN_DB')), dbSrc.lastIndexOf('}') + 1)).entries;
check('explain: generic isa-5-1-tag entry in the DB', !!DB['isa-5-1-tag']);
/* every instrument, every actuated/relief valve the builder read as ISA, and hand valves (H). MV-01 is not ISA:
   M would decode as "moisture", so it must get no key. */
const isaItems = g.nodes.filter((x) => x.tag && (x.type === 'Instrument' || (x.type === 'Component' && (x.attributes.isa_letters || /^H/.test(x.tag)))));
check('explain: 20 ISA-tagged items on the CDU page', isaItems.length === 20, String(isaItems.length));
check('explain: MV-01 gets no ISA key (M would read as moisture)', typeof P.explainKey === 'function' && P.explainKey(g.byId['MV-01']) === null);
for (const n of isaItems) {
  const key = typeof P.explainKey === 'function' ? P.explainKey(n) : null, d = P.decodeTag(n.tag);
  check('explain: ' + n.id + ' -> ' + key + ' in the DB, title = decodeTag()', !!key && !!DB[key] && DB[key].t === d.text, key && DB[key] ? DB[key].t + ' vs ' + d.text : 'no entry');
  if (key && DB[key]) check('explain: ' + key + ' links to isa-5-1-tag', (DB[key].rel || []).includes('isa-5-1-tag'));
}

/* ---------------------------------------------------------------- 5. browser */
if (!NO_BROWSER) await browserChecks();

async function browserChecks() {
  const http = await import('node:http');
  let puppeteer;
  try { puppeteer = (await import('puppeteer')).default; } catch (e) { check('browser: puppeteer available', false, e.message); return; }
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
  });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const url = 'http://127.0.0.1:' + srv.address().port + '/rz-pid-mock.html';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  async function open(width, reduce) {
    const p = await browser.newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', (q) => (q.url().startsWith('http://127.0.0.1') ? q.continue() : q.abort()));
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('theme', 'dark'); } catch (e) { /* none */ } });
    if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForFunction(() => document.querySelector('.rzpid') && document.querySelector('.rzpid').__rzpid, { timeout: 15000 });
    return { p, errs };
  }
  try {
    /* 1440: RZExplain wiring + the discrepancy panel */
    const { p, errs } = await open(1440, false);
    const w = await p.evaluate(() => {
      const api = document.querySelector('.rzpid').__rzpid, out = { bad: [], n: 0 };
      api.graph.nodes.forEach((n) => {
        if (!(RZPid.explainKey ? RZPid.explainKey(n) : (n.type === 'Instrument' || n.type === 'Component') && n.tag)) return;
        out.n++;
        const el = api.svg.querySelector('g.node[data-id="' + n.id + '"]');
        const key = el && el.getAttribute('data-explain');
        if (!el || !key || !(window.RZExplain && RZExplain.has(key)) || el.getAttribute('tabindex') !== '0' || !el.classList.contains('rzx-trigger')) out.bad.push(n.id + ':' + key);
      });
      out.tip = !!document.querySelector('.rzpid-tip');
      const tic = api.svg.querySelector('g.node[data-id="TIC-01"]');
      tic.focus();
      const panel = document.getElementById('rzExplainPanel');
      out.title = panel && panel.style.display === 'block' ? panel.querySelector('.rzx-title').textContent : null;
      out.low = document.getElementById('lowList').textContent;
      return out;
    });
    check('browser 1440: every ISA tag is an RZExplain trigger (data-explain key in the DB, tabindex 0)', w.n === 20 && !w.bad.length, w.n + ' tags; bad ' + w.bad.join(', '));
    check('browser 1440: no page-own tooltip element', !w.tip);
    check('browser 1440: focusing TIC-01 opens the RZExplain panel with the decode', w.title === P.decodeTag('TIC-01').text, String(w.title));
    for (const s of ['E-01', '390 LPM', '11 K', '275.7 kW', '300 kW', '8.1 %', '424 LPM', '1.41 LPM/kW'])
      check('browser 1440: the "marked, not guessed" panel shows the balance: ' + s, w.low.includes(s), w.low.slice(0, 300));
    check('browser 1440: no page errors', !errs.length, errs.join(' | '));
    await p.close();

    /* 390: one column, no sideways pan, every step's lit path inside the drawing, labels >= 11 px */
    const ph = await open(390, true);
    const r = await ph.p.evaluate(() => {
      const api = document.querySelector('.rzpid').__rzpid, svg = api.svg, frame = svg.closest('.rzpid-frame');
      const out = { sw: document.documentElement.scrollWidth, fw: frame.scrollWidth, fc: frame.clientWidth, outside: [], small: [], shown: 0, steps: api.explanation.steps.length };
      const fig = frame.getBoundingClientRect(), steps = document.getElementById('stepsHost').getBoundingClientRect();
      out.below = steps.top >= fig.bottom - 1;
      api.explanation.steps.forEach((s, i) => {
        api.select(i);
        const sb = svg.getBoundingClientRect(), fb = frame.getBoundingClientRect();   /* what the reader can see: the svg clipped by its frame */
        const box = { left: Math.max(sb.left, fb.left), right: Math.min(sb.right, fb.right), top: Math.max(sb.top, fb.top), bottom: Math.min(sb.bottom, fb.bottom) };
        svg.querySelectorAll('.is-lit').forEach((e) => {
          const b = e.getBoundingClientRect(); if (!b.width && !b.height) return;
          if (b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1)
            out.outside.push((i + 1) + ':' + (e.getAttribute('data-id') || e.getAttribute('data-edge')));
        });
        svg.querySelectorAll('text').forEach((t) => {
          const b = t.getBoundingClientRect();
          if (b.right < box.left || b.left > box.right || b.bottom < box.top || b.top > box.bottom) return;
          if (parseFloat(getComputedStyle(t).opacity) < 0.01) return;
          const m = t.getScreenCTM(), px = parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b);
          out.shown++;
          if (px < 10.95) out.small.push((i + 1) + ':' + t.textContent + '@' + px.toFixed(1));
        });
      });
      out.sw2 = document.documentElement.scrollWidth;
      return out;
    });
    check('browser 390: document scrollWidth <= 390', r.sw <= 390 && r.sw2 <= 390, r.sw + ' / ' + r.sw2);
    check('browser 390: the drawing does not pan sideways (frame scrollWidth <= clientWidth)', r.fw <= r.fc + 1, r.fw + ' > ' + r.fc);
    check('browser 390: the step list sits under the drawing', r.below);
    check('browser 390: every step\'s lit path is inside the visible drawing (' + r.steps + ' steps)', !r.outside.length, r.outside.length + ': ' + r.outside.slice(0, 8).join(', '));
    check('browser 390: no visible label renders under 11 px', r.shown > 0 && !r.small.length, r.shown + ' shown; ' + r.small.length + ' small: ' + r.small.slice(0, 6).join(', '));
    check('browser 390: no page errors', !ph.errs.length, ph.errs.join(' | '));
    await ph.p.close();

    /* 390, full motion: the camera moves by transform on the motion tokens, never transition:all */
    const mv = await open(390, false);
    const t = await mv.p.evaluate(() => {
      const cam = document.querySelector('.rzpid-cam'); if (!cam) return null;
      const cs = getComputedStyle(cam); return { prop: cs.transitionProperty, dur: cs.transitionDuration, ease: cs.transitionTimingFunction };
    });
    check('browser 390: camera transition is transform only, 280 ms, on the token ease', !!t && t.prop === 'transform' && t.dur === '0.28s' && /cubic-bezier\(0\.77, 0, 0\.175, 1\)/.test(t.ease), JSON.stringify(t));
    await mv.p.close();
  } catch (e) {
    check('browser: run completed', false, e.message);
  } finally {
    await browser.close();
    srv.close();
  }
}

const loops = (gr) => gr.nodes.filter((n) => n.type === 'ControlLoop').length;
console.log('mini plant: ' + mini.stats.nodes + ' nodes, ' + mini.stats.edges + ' edges, ' + loops(mini) + ' loops ' + JSON.stringify(mini.stats.loops_by_type));
console.log('cdu plant:  ' + g.stats.nodes + ' nodes, ' + g.stats.edges + ' edges, ' + loops(g) + ' loops ' + JSON.stringify(g.stats.loops_by_type) + ', ' + ex.steps.length + ' steps');
for (const f of fails) console.log('FAIL ' + f);
console.log((fails.length ? 'RED' : 'GREEN') + ': ' + pass + ' passed, ' + fails.length + ' failed');
process.exit(fails.length ? 1 : 0);
