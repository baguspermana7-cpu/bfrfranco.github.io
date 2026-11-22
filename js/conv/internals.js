/*
 * internals.js — window.RZConvInternals: the registry of equipment INTERNAL drawings for the Conventional pages
 * (PRD-CONV-EQUIPMENT-TRUTH §4–§5, phase E2). One class file per machine (js/conv/internals/<class>.js) registers
 *
 *   { title, sheet(unit) -> RZHmiSheet sheet object (geometry only),
 *     model(unit, snapshot) -> the numbers the drawing shows (engine keys, or derived from engine keys),
 *     blocks: [{ id, node, name, role: [line 1, line 2], standard, values: [{ label, key, fmt, basis }] }],
 *     nodeValues: { nodeId: [{ k, key, fmt, prefix }] },   edges carry flowOf = a medium key the class maps to a flow }
 *
 * This file is the only place where numbers are formatted or a ratio is taken, so a class file holds geometry and
 * engine-key names, never a number of its own.
 *
 *   PURE (Node-tested, tools/test-conv-internals-core.mjs)
 *   has(classKey) · get(classKey) · model(classKey, unit, snapshot)
 *   read(classKey, unit, snapshot)  -> { nodeId: { state, values: { k: { text } }, rows } } for RZHmiSheet
 *   detail(classKey, blockId, unit, snapshot) -> { name, role, standard, state, rows: [{ label, text, basis, nm }] }
 *   flow(classKey, unit, edge) -> running | standby | stopped | unavailable (the RZConvVfx grammar)
 *   temp(classKey, unit, snapshot, edge) -> °C or null (Thermal view)
 *   text(value, fmt) -> the displayed string; NOT_MODELLED, DASH
 *
 * A value the engine does not model is the text "not modelled", never a number. A value that exists only while the
 * machine runs is "—" on a unit that does not run. No clock, no random.
 */
(function (root) {
  'use strict';

  var NOT_MODELLED = 'not modelled', DASH = '—';
  var REG = {};

  /* display formats: digits and unit per kind (the one place a display precision is chosen) */
  var FMT = {
    kwth: { d: 1, u: 'kWth' }, kwe: { d: 1, u: 'kWe' }, temp: { d: 1, u: '°C' }, flow: { d: 1, u: 'L/s' },
    kpa: { d: 0, u: 'kPa(a)' }, kpag: { d: 0, u: 'kPa(g)' }, k: { d: 1, u: 'K' }, pct: { d: 1, u: '%' },
    ratio: { d: 3, u: '' }, cop: { d: 2, u: '' }, frac: { d: 3, u: '' }, kgs: { d: 1, u: 'kg/s' }, text: { d: null, u: '' }
  };
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function text(v, fmt) {
    if (v === NOT_MODELLED) return NOT_MODELLED;
    var f = FMT[fmt] || FMT.text;
    if (f.d == null) return v == null || v === '' ? DASH : String(v);
    if (!isNum(v)) return DASH;
    return v.toFixed(f.d) + (f.u ? ' ' + f.u : '');
  }

  function register(classKey, def) { if (classKey && def) REG[classKey] = def; return def; }
  function has(classKey) { return !!REG[classKey]; }
  function get(classKey) { return REG[classKey] || null; }
  function model(classKey, unit, snap) { var d = REG[classKey]; return d ? d.model(unit || {}, snap || {}) : null; }

  /* read: per node of the class sheet, the state and the value texts RZHmiSheet prints */
  function read(classKey, unit, snap) {
    var d = REG[classKey]; if (!d) return {};
    var m = d.model(unit || {}, snap || {}), out = {};
    var nodeState = d.nodeState || function () { return m.state; };
    Object.keys(d.nodeValues || {}).forEach(function (id) { out[id] = { state: nodeState(id, m), values: {}, rows: [] }; });
    (d.blocks || []).forEach(function (b) { if (!out[b.node]) out[b.node] = { state: nodeState(b.node, m), values: {}, rows: [] }; });
    Object.keys(d.nodeValues || {}).forEach(function (id) {
      d.nodeValues[id].forEach(function (v) {
        out[id].values[v.k] = { text: (v.prefix ? v.prefix + ' ' : '') + text(m[v.key], v.fmt) };
      });
    });
    (d.blocks || []).forEach(function (b) {
      out[b.node].rows = (b.values || []).map(function (v) { return [v.label, text(m[v.key], v.fmt)]; });
    });
    return out;
  }

  function detail(classKey, blockId, unit, snap) {
    var d = REG[classKey]; if (!d) return null;
    var b = (d.blocks || []).filter(function (x) { return x.id === blockId || x.node === blockId; })[0]; if (!b) return null;
    var m = d.model(unit || {}, snap || {});
    var nodeState = d.nodeState || function () { return m.state; };
    return { id: b.id, node: b.node, name: b.name, role: b.role.slice(), standard: b.standard, state: nodeState(b.node, m),
      rows: (b.values || []).map(function (v) {
        var raw = m[v.key], t = text(raw, v.fmt), nm = raw === NOT_MODELLED, idle = v.fleet && !m.running;
        /* a value is traced to its engine parameter only when that parameter IS this unit's value: a fleet-row number of a
           unit that does not run, a running-only reading shown as a dash and a value the engine does not model are declared */
        var basis = nm || idle || t === DASH ? null : (v.basis || null);
        var declared = nm ? 'not modelled by conv-engine ' + ((snap && snap.meta && snap.meta.version) || '') + ': no parameter exists for this reading'
          : idle ? 'CONV_CALC.getFleet(\'' + classKey + '\') row of ' + (m.tag || 'this unit') + ' (' + m.state + ')'
          : t === DASH ? 'this reading exists only while the unit runs' : null;
        return { label: v.label, key: v.key, text: t, basis: basis, nm: nm, declared: declared };
      }) };
  }

  /* line state of one edge of the class sheet for the unit (flowOf = the medium key the class declares) */
  function flow(classKey, unit, e) {
    var d = REG[classKey]; if (!d || !e || !e.flowOf) return null;
    return d.flow ? d.flow(unit || {}, e.flowOf) : null;
  }
  function temp(classKey, unit, snap, e) {
    var d = REG[classKey]; if (!d || !e || !e.flowOf || !d.tempKey) return null;
    var m = d.model(unit || {}, snap || {}), k = d.tempKey[e.flowOf];
    return k && isNum(m[k]) ? m[k] : null;
  }
  /* Thermal range: the class names the two model keys that bound its temperatures; null when either is not a number */
  function tempRange(classKey, unit, snap) {
    var d = REG[classKey]; if (!d || !d.tempRange) return null;
    var m = d.model(unit || {}, snap || {}), lo = m[d.tempRange[0]], hi = m[d.tempRange[1]];
    return isNum(lo) && isNum(hi) && hi > lo ? [lo, hi] : null;
  }
  /* dash speed of a running line: the unit's load as a fraction of its rating (load % / 100) */
  function ratio(unit) { return unit && isNum(unit.loadPct) && unit.loadPct > 0 ? unit.loadPct / 100 : null; }

  var API = { register: register, has: has, get: get, model: model, read: read, detail: detail, flow: flow, temp: temp, tempRange: tempRange,
    ratio: ratio, text: text, FMT: FMT, NOT_MODELLED: NOT_MODELLED, DASH: DASH, version: '1.0.0' };
  if (root) root.RZConvInternals = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
