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
 * Exit 1 on any failure. Usage: node tools/test-rz-pid.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const P = require(path.join(ROOT, 'js/rz-pid.js'));
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

const loops = (gr) => gr.nodes.filter((n) => n.type === 'ControlLoop').length;
console.log('mini plant: ' + mini.stats.nodes + ' nodes, ' + mini.stats.edges + ' edges, ' + loops(mini) + ' loops ' + JSON.stringify(mini.stats.loops_by_type));
console.log('cdu plant:  ' + g.stats.nodes + ' nodes, ' + g.stats.edges + ' edges, ' + loops(g) + ' loops ' + JSON.stringify(g.stats.loops_by_type) + ', ' + ex.steps.length + ' steps');
for (const f of fails) console.log('FAIL ' + f);
console.log((fails.length ? 'RED' : 'GREEN') + ': ' + pass + ' passed, ' + fails.length + ' failed');
process.exit(fails.length ? 1 : 0);
