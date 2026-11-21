#!/usr/bin/env node
/* test-dcai-points.mjs — STRICT, Node only. PRD-DCAI-NUMBERS phase B1 (owner N1: "parameter angka yg normal kasih
   warna hijau … kuning … merah"): js/datahall-ai/points.js is the one registry of DC AI point limits, relative to the
   engine setpoint, every limit with a source.
   P1 every record names its class + point, unit, kind (high | low | window | none) and a source; a banded record says
      whether its limits are a published standard, an engine design figure or ASSUMED (evidenceClass)
   P2 every banded record's point exists as a live row of that class in js/datahall-ai/hmi-payloads.js
   P3 a setpoint read from an engine plane / path exists in the engine snapshot; a setpoint typed as a value equals the
      value the payload authors for that row (no drift between the two files)
   P4 resolve() gives absolute limits in the order lo_alarm <= lo_warn < hi_warn <= hi_alarm (the shape of
      RZPointStatus.define), and moves with the engine: a design TCS supply of 35 °C moves the TCS supply limits by -5 K
   P5 the design point is NORMAL: the setpoint ± the simulator's noise amplitude never reaches a warning limit — the
      owner's "35 green / 37 yellow" example on a 40 °C design would have painted the healthy plant red
   P6 classify() agrees with the bands: just past warn -> warning, just past alarm -> alarm, inside -> normal; kind none
      -> none
   P7 table() lists every record for the owner (id, setpoint, warn, alarm, source, evidence)
   Usage: node tools/test-dcai-points.mjs [--table] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const done = () => {
  if (fails.length) { console.log(`test-dcai-points: ${fails.length} FAIL of ${checks}`); fails.slice(0, 40).forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log(`test-dcai-points: ${checks} checks, 0 fail`);
};

let PTS = null;
try { PTS = require(path.join(ROOT, 'js/datahall-ai/points.js')); } catch (e) { ok(false, 'P0 js/datahall-ai/points.js does not load: ' + e.message); done(); }
const E = require(path.join(ROOT, 'js/dcai-engine.js'));
const snap = typeof E.snapshot === 'function' ? E.snapshot() : E.snapshot;
const SRC = fs.readFileSync(path.join(ROOT, 'js/datahall-ai/hmi-payloads.js'), 'utf8');

/* live rows per class, parsed from the payload source: { cls: { point: { kind, valueAnchor, band } } } */
const LIVE = {}; let cls = null;
for (const line of SRC.split('\n')) {
  const d = /def\('([a-z0-9-]+)'/.exec(line); if (d) cls = d[1];
  const re = /b\.([SEPD])\('live', '([a-z0-9_]+)', '[^']*', ([^;]*)/g; let m;
  while ((m = re.exec(line))) {
    const va = /^\{ value: (-?[\d.]+)/.exec(m[3]), bd = /^\{[^}]*\}, ([\d.]+)/.exec(m[3]);
    ((LIVE[cls] = LIVE[cls] || {})[m[2]] = { k: m[1], value: va ? Number(va[1]) : null, band: bd ? Number(bd[1]) : 0 });
  }
}

const recs = PTS.records();
ok(Array.isArray(recs) && recs.length >= 40, `P1 registry has ${recs && recs.length} records, want >= 40`);
const KINDS = { high: 1, low: 1, window: 1, none: 1 }, EV = { standard: 1, design: 1, assumed: 1 };
const seen = {};
for (const r of recs) {
  const id = r.cls + '/' + r.point;
  ok(!seen[id], `P1 ${id}: duplicate`); seen[id] = 1;
  ok(r.label && r.unit != null && KINDS[r.kind], `P1 ${id}: label / unit / kind`);
  ok(typeof r.source === 'string' && r.source.length >= 8, `P1 ${id}: no source`);
  if (r.kind !== 'none') ok(EV[r.evidenceClass], `P1 ${id}: evidenceClass ${r.evidenceClass}`);
  const row = LIVE[r.cls] && LIVE[r.cls][r.point];
  /* a page KPI (page: true) is drawn by the page, not a payload row; it must then read its setpoint from the engine */
  if (r.page) ok(r.sp && r.sp.path && !row, `P2 ${id}: a page KPI must take its setpoint from an engine path`);
  else ok(!!row, `P2 ${id}: no live row '${r.point}' in class '${r.cls}'`);
  if (r.kind === 'none') { ok(PTS.classify(id, 1e9, snap) === 'none', `P6 ${id}: kind none must classify none`); continue; }
  /* P3 setpoint */
  const sp = PTS.setpoint(id, snap);
  ok(typeof sp === 'number' && isFinite(sp), `P3 ${id}: setpoint ${sp} not a number`);
  if (r.sp && r.sp.value != null && row) ok(row.value === r.sp.value, `P3 ${id}: setpoint ${r.sp.value} but the payload authors ${row.value}`);
  /* P4 order */
  let L = null; try { L = PTS.resolve(id, snap); } catch (e) { ok(false, `P4 ${id}: resolve threw ${e.message}`); continue; }
  const b = [L.lo_alarm, L.lo_warn, L.hi_warn, L.hi_alarm];
  ok(b.some((x) => x != null), `P4 ${id}: no bound`);
  const lo = [L.lo_alarm, L.lo_warn].filter((x) => x != null), hi = [L.hi_warn, L.hi_alarm].filter((x) => x != null);
  ok((L.lo_alarm == null || L.lo_warn == null || L.lo_alarm <= L.lo_warn) && (L.hi_warn == null || L.hi_alarm == null || L.hi_warn <= L.hi_alarm)
    && (!lo.length || !hi.length || Math.max(...lo) < Math.min(...hi)), `P4 ${id}: bound order ${JSON.stringify(b)}`);
  ok(L.source && L.source.ref && L.evidenceClass, `P4 ${id}: resolved limits carry no source / evidenceClass`);
  /* P5 design point normal, simulator noise included */
  const amp = row ? row.band : 0;
  for (const v of [sp - amp, sp, sp + amp]) ok(PTS.classify(id, v, snap) === 'normal', `P5 ${id}: design ${sp} ± noise ${amp} -> ${v} classifies ${PTS.classify(id, v, snap)} (limits ${JSON.stringify(b)})`);
  /* P6 just past the limits */
  const eps = Math.max(1e-6, Math.abs(sp) * 1e-4);
  if (L.hi_warn != null) ok(PTS.classify(id, L.hi_warn + eps, snap) === 'warning' || (L.hi_alarm != null && L.hi_alarm <= L.hi_warn + eps), `P6 ${id}: just above hi_warn is not warning`);
  if (L.hi_alarm != null) ok(PTS.classify(id, L.hi_alarm + eps, snap) === 'alarm', `P6 ${id}: just above hi_alarm is not alarm`);
  if (L.lo_warn != null) ok(PTS.classify(id, L.lo_warn - eps, snap) === 'warning' || (L.lo_alarm != null && L.lo_alarm >= L.lo_warn - eps), `P6 ${id}: just below lo_warn is not warning`);
  if (L.lo_alarm != null) ok(PTS.classify(id, L.lo_alarm - eps, snap) === 'alarm', `P6 ${id}: just below lo_alarm is not alarm`);
}
/* P4b the limits move with the engine */
{
  const s2 = JSON.parse(JSON.stringify(snap)); s2.design.planes.p07_tcs_supply_c -= 5;
  const a = PTS.resolve('cdu/tcs_supply_c', snap), b = PTS.resolve('cdu/tcs_supply_c', s2);
  ok(a && b && Math.abs((a.hi_warn - b.hi_warn) - 5) < 1e-9, `P4b TCS supply warn did not follow the setpoint (${a && a.hi_warn} -> ${b && b.hi_warn})`);
}
/* core points the owner named must be banded */
for (const id of ['cdu/tcs_supply_c', 'cdu/tcs_return_c', 'cdu/htw_supply_c', 'rack-unit/inlet_air_c', 'cw-pump-station/vib_mms'])
  ok(recs.some((r) => r.cls + '/' + r.point === id && r.kind !== 'none'), `P1 ${id}: must be banded`);
/* P7 the owner's table */
const T = PTS.table(snap);
ok(Array.isArray(T) && T.length === recs.length && T.every((t) => 'id' in t && 'setpoint' in t && 'source' in t), 'P7 table() incomplete');
if (process.argv.includes('--table')) {
  console.log('| point | unit | setpoint | warning | alarm | evidence | source |\n|---|---|---|---|---|---|---|');
  for (const t of T) console.log(`| ${t.label} (\`${t.id}\`) | ${t.unit} | ${t.setpoint ?? '—'} | ${t.warn} | ${t.alarm} | ${t.evidence} | ${t.source} |`);
}
done();
