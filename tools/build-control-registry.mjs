#!/usr/bin/env node
/**
 * build-control-registry.mjs — writes data/control-points.json, the ONE control registry of both cockpits
 * (PRD-SETPOINT-SIM B1). Gate: tools/test-control-registry.mjs (C7 freshness).
 *
 * Sources, in order: data/conv-parameters.json `limits` (conv point bands), js/datahall-ai/points.js (DC AI point
 * classes, their reference value and band on the engine snapshot), data/control-points.curated.json (the conv
 * setpoints held by an engine parameter, and the evidence of DC AI typed reference values).
 *
 * Accuracy rules this file enforces:
 *   - sp.role 'setpoint' only on the equipment whose controller holds the value (curated: dcaiPlaneController,
 *     dcaiTypedSetpoints, convSetpoints); the same plane read downstream is a 'reference' with heldBy naming the
 *     controller; nameplate, nominal, design head and normal winding temperature are references, never setpoints.
 *   - a conv band's `nominal` stays `nominal` on the limits; it never becomes a setpoint.
 *   - a value typed in points.js is ASSUMED unless the curated file states why it is a standard or design value.
 *
 *   node tools/build-control-registry.mjs           print the summary
 *   node tools/build-control-registry.mjs --apply   write the file
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const OUT = path.join(ROOT, 'data/control-points.json');
const LIMIT_KEYS = ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm', 'deadband', 'delay_s'];

function pick(o, keys) { const r = {}; keys.forEach((k) => { if (typeof o[k] === 'number') r[k] = o[k]; }); return Object.keys(r).length ? r : null; }
function evid(s) { return String(s || '').toUpperCase(); }

export function build() {
  const conv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-parameters.json'), 'utf8'));
  const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.curated.json'), 'utf8'));
  const PARAM = Object.fromEntries(conv.parameters.map((p) => [p.id, p]));
  const PTS = require(path.join(ROOT, 'js/datahall-ai/points.js'));
  const E = require(path.join(ROOT, 'js/dcai-engine.js'));
  const snap = typeof E.snapshot === 'function' ? E.snapshot() : E.snapshot;
  const rows = [];

  /* 1. conv point bands */
  conv.limits.forEach((l) => {
    const page = l.id.split('.')[0];
    rows.push({ id: 'conv.' + l.id, cockpit: 'conv', equipment: page, label: l.label, unit: l.unit || null,
      limits: Object.assign(pick(l, LIMIT_KEYS) || {}, { basis: l.basis || null, evidenceClass: evid(l.evidenceClass), source: l.source || null }),
      nominal: l.nominal || null });
  });

  /* 2. conv setpoints held by an engine parameter */
  cur.convSetpoints.forEach((c) => {
    const p = PARAM[c.param];
    if (!p) throw new Error('curated ' + c.id + ': ' + c.param + ' is not an engine parameter');
    if (c.loop) {   /* P4: the control loop that holds the setpoint (ISA-5.1 bubble on its sheet) */
      const L = c.loop, bad = (m) => { throw new Error('curated ' + c.id + ' loop: ' + m); };
      if (!L.tag || !L.mv || !L.mv.classKey || !L.pv || !L.pv.tag || !L.basis) bad('tag, pv.tag, mv.classKey and basis are required');
      if (!['PI', 'staging', 'reset', 'interlock'].includes(L.kind)) bad('kind ' + L.kind);
      if (!['direct', 'reverse'].includes(L.action)) bad('action ' + L.action);
      if (!L.sheet && !L.notDrawn) bad('a loop without a sheet says why (notDrawn)');
      if (!L.tuning && !L.tuningNote) bad('no tuning and no note');
      if (L.sheet && /^int-/.test(L.sheet) && !fs.existsSync(path.join(ROOT, 'js/conv/internals', L.sheet.slice(4).replace(/_/g, '-') + '.js'))) bad('sheet ' + L.sheet + ' names no js/conv/internals file');
      if (L.kind === 'reset' && (!L.slave || !cur.convSetpoints.some((o) => o.loop && o.loop.tag === L.slave))) bad('a reset names the loop it sets (slave): ' + L.slave);
    }
    rows.push({ id: c.id, cockpit: 'conv', equipment: c.equipment, label: c.label, unit: p.unit,
      sp: { value: p.value, role: c.role, param: c.param, pv: c.pv || null, classKey: c.classKey || null, kind: p.kind, from: 'engine parameter ' + c.param,
        evidenceClass: evid(p.evidenceClass), source: { ref: (p.source && p.source.ref) || 'js/conv-engine.js', asOf: (p.source && p.source.asOf) || null, method: (p.source && p.source.method) || null },
        control: c.control, drivers: c.drivers || null, adjustable: c.adjustable || null, adjustableNote: c.adjustableNote || null,
        whatIf: c.whatIf || null, whatIfNote: c.whatIfNote || null, loop: c.loop || null } });
  });

  /* 3. DC AI point classes */
  const VE = cur.dcaiValueEvidence || {}, PC = cur.dcaiPlaneController || {}, TS = cur.dcaiTypedSetpoints || {};
  PTS.records().forEach((r) => {
    const id = r.cls + '/' + r.point, v = PTS.setpoint(id, snap);
    let L = null; try { L = PTS.resolve(id, snap); } catch (e) { L = null; }
    const row = { id: 'dcai.' + id, cockpit: 'dcai', equipment: r.cls, label: r.label, unit: r.unit || null, source: { point: id } };
    if (r.sp && typeof v === 'number') {
      let role, ev, src, heldBy = null, control = null;
      if (r.sp.plane) { const pc = PC[r.sp.plane]; role = pc && pc.heldBy === r.cls ? 'setpoint' : 'reference'; ev = 'DESIGN';
        src = { ref: 'js/dcai-engine.js design.planes.' + r.sp.plane }; if (pc && role === 'reference') { heldBy = pc.heldBy; } if (pc) control = pc.why; }
      else if (r.sp.path) { role = 'reference'; ev = 'DESIGN'; src = { ref: 'js/dcai-engine.js ' + r.sp.path }; }
      else { role = TS[id] ? 'setpoint' : 'reference'; if (TS[id]) control = TS[id]; ev = VE[id] ? VE[id].evidenceClass : 'ASSUMED';
        src = { ref: 'js/datahall-ai/points.js ' + id, why: VE[id] ? VE[id].why : 'value typed in the point record; no source of its own' }; }
      row.sp = { value: v, role: role, from: r.sp.plane ? 'plane ' + r.sp.plane : r.sp.path ? 'path ' + r.sp.path : 'typed value', evidenceClass: ev, source: src, control: role === 'setpoint' ? control : null, heldBy: heldBy, adjustable: null };
    }
    if (L && r.kind !== 'none') row.limits = Object.assign(pick(L, LIMIT_KEYS) || {}, { basis: r.source || null, evidenceClass: evid(r.evidenceClass) });
    if (!row.sp && !row.limits) row.monitoredOnly = { reason: r.why || r.source || 'no setpoint and no defensible band' };
    rows.push(row);
  });

  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { generatedBy: 'tools/build-control-registry.mjs', note: 'PRD-SETPOINT-SIM B1. GENERATED — edit data/control-points.curated.json, the conv limits registry or js/datahall-ai/points.js, then rebuild.', rows };
}

/* the browser twin: window.RZControlPoints, a lookup by live point id (sp.pv) — no DOM, no fetch (PRD-SETPOINT-SIM P1) */
export function twin(reg) {
  const UNIT = { degC: '°C' };
  const byPv = {};
  reg.rows.filter((r) => r.cockpit === 'conv' && r.sp && r.sp.pv).forEach((r) => r.sp.pv.forEach((pv) => {
    byPv[pv] = { id: r.id, value: r.sp.value, unit: UNIT[r.unit] || r.unit || '', role: r.sp.role, label: r.label, ev: r.sp.evidenceClass,
      adjustable: r.sp.adjustable || null, control: r.sp.control || null };
  }));
  const byClass = {};
  reg.rows.filter((r) => r.cockpit === 'conv' && r.sp && r.sp.classKey).forEach((r) => {
    (byClass[r.sp.classKey] = byClass[r.sp.classKey] || []).push({ id: r.id, label: r.label, value: r.sp.value, unit: UNIT[r.unit] || r.unit || '', role: r.sp.role,
      ev: r.sp.evidenceClass, pv: r.sp.pv || [], control: r.sp.control || null, adjustable: r.sp.adjustable || null, note: r.sp.adjustableNote || null,
      param: r.sp.param || null, whatIf: r.sp.whatIf || null, whatIfNote: r.sp.whatIfNote || null, loop: r.sp.loop || null });
  });
  const loops = reg.rows.filter((r) => r.cockpit === 'conv' && r.sp && r.sp.loop).map((r) => Object.assign({ sp: r.id, label: r.label, value: r.sp.value, unit: UNIT[r.unit] || r.unit || '' }, r.sp.loop));
  return '/* GENERATED by tools/build-control-registry.mjs from data/control-points.json — do not edit (PRD-SETPOINT-SIM P1).\n' +
    ' *   RZControlPoints.spOf(pointId)          -> { value, label: "SP 19.4", unit, id } | null\n' +
    ' *   RZControlPoints.tipFor(pointId, unit)  -> "SP 19.4 °C · <setpoint name> · <evidence class>" | null\n' +
    ' *   RZControlPoints.rowOf(pointId)         -> the registry row summary | null\n' +
    ' *   RZControlPoints.forClass(classKey)     -> [{ id, label, value, unit, role, ev, pv, control, adjustable, note, param, whatIf, whatIfNote, loop }] (the equipment modal)\n' +
    ' *   RZControlPoints.loops(sheetId)         -> the control loops drawn on that sheet (ISA-5.1 bubbles, P4) */\n' +
    '(function (root) {\n  \'use strict\';\n  var BY_PV = ' + JSON.stringify(byPv, null, 1).replace(/\n\s*/g, ' ') + ';\n' +
    '  function fmt(v, u) { return u === \'°C\' || Math.round(v) !== v ? v.toFixed(1) : String(v); }\n' +
    '  var BY_CLASS = ' + JSON.stringify(byClass, null, 1).replace(/\n\s*/g, ' ') + ';\n' +
    '  var LOOPS = ' + JSON.stringify(loops, null, 1).replace(/\n\s*/g, ' ') + ';\n' +
    '  function loops(sheet) { return LOOPS.filter(function (l) { return l.sheet === sheet; }); }\n' +
    '  function forClass(k) { return Object.prototype.hasOwnProperty.call(BY_CLASS, k) ? BY_CLASS[k].slice() : []; }\n' +
    '  function rowOf(id) { return Object.prototype.hasOwnProperty.call(BY_PV, id) ? BY_PV[id] : null; }\n' +
    '  function spOf(id) { var r = rowOf(id); return r ? { value: r.value, label: (r.role === \'setpoint\' ? \'SP \' : \'Ref \') + fmt(r.value, r.unit), unit: r.unit, id: r.id } : null; }\n' +
    '  function tipFor(id) { var r = rowOf(id), s = spOf(id); return r ? s.label + (r.unit ? \' \' + r.unit : \'\') + \' · \' + r.label + \' · \' + r.ev : null; }\n' +
    '  root.RZControlPoints = { spOf: spOf, tipFor: tipFor, rowOf: rowOf, forClass: forClass, loops: loops, fmt: fmt, version: \'1.1.0\' };\n' +
    '})(typeof window !== \'undefined\' ? window : this);\n';
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const reg = build(), r = reg.rows;
  console.log(`${r.length} rows: ${r.filter((x) => x.sp && x.sp.role === 'setpoint').length} setpoints, ${r.filter((x) => x.sp && x.sp.role === 'reference').length} reference values, ${r.filter((x) => x.limits).length} with limits, ${r.filter((x) => x.monitoredOnly).length} monitored only`);
  if (process.argv.includes('--apply')) { fs.writeFileSync(OUT, JSON.stringify(reg, null, 2) + '\n'); console.log('wrote ' + path.relative(ROOT, OUT));
    fs.writeFileSync(path.join(ROOT, 'js/rz-control-points.js'), twin(reg)); console.log('wrote js/rz-control-points.js'); }
}
