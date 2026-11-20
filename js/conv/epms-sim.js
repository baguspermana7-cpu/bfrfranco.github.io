/*
 * epms-sim.js — window.RZEpmsSim: the switching simulation behind E-S-101 (PRD-CONV-LIVING-PLANT §8.1, phase P5a).
 * Pure and deterministic (no clock, no random); Node-tested by tools/test-conv-epms-model.mjs. It never draws.
 *
 *   normalState(sheet)            { closed: { id: bool } } every switching device in its normal position
 *                                 (both lines in, coupler closed, both transformers in, bus tie open, feeders closed,
 *                                 generator breakers open, earth switches open) and gensets off
 *   basis(snapshot)               the engine values the simulation needs, or null when one is missing
 *   model(sheet, state, basis)    the js/conv/sld-topology.js model: every switching device and transformer is a
 *                                 branch between its two terminals; every drawn conductor (flowOf 'p') is a closed
 *                                 branch; sources: the PLN lines (always available) and the genset block (state.gen)
 *   solve(sheet, state, basis)    model + RZConvSld.solve, read back per drawn edge and per device:
 *                                 { edges: { id: { energised, kw } }, dev: { id: { energised, kw, a, pct } }, raw, model }
 *   operate(sheet, state, id, close, basis) -> { ok, reason, state }   the interlocks, a new state object
 *                                 (the old one is never changed); a refusal says which condition is unmet
 *   chain(basis), coordination(basis)   the protection chain of the typical unit (LV LSIG, 20 kV feeder, 20 kV
 *                                 incomer, 150 kV transformer feeder) from engine settings, and its grading check
 *
 *   1.1.0 (E-S-102, additive; E-S-101 unchanged): a load node may carry its engine kW (n.kw); a grid source its rating
 *   (n.ratingKw) and state.lost; a genset UNIT (n.unit) runs from state.run; a battery (src 'battery') from state.batt;
 *   state.blocked holds a two-terminal device open (a rectifier never back-feeds its dead input); rectifier, inverter and
 *   static switch are two-terminal devices; a typical transformer drawn for N in parallel (n.units) is loaded per unit.
 *
 *   kW are the engine's adopted hall facility loads split per stream (campus.halls[i].facility_load_kw / streams);
 *   the typical LV unit carries one stream's share divided by the units per stream. A = kW / (sqrt3 x kV x pf).
 *   Losses are not modelled (the topology solver's rule), so kW into every bus equals kW out.
 */
(function (root) {
  'use strict';
  var SQRT3 = Math.sqrt(3);
  var TWO = { cbIec: 1, cbDrawout: 1, disconnector: 1, currentTransformer: 1, transformer2w: 1, rectifier: 1, inverterIec: 1, staticSwitch: 1 };
  var A_PORT = { line: 1, hv: 1 }, B_PORT = { load: 1, lv: 1 };
  /* E-S-102: converters name their ports by what they carry; the input side is the a terminal */
  var SIDE = { rectifier: { ac: 'a', dc: 'b' }, inverterIec: { dc: 'a', ac: 'b' } };
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function Sld() {
    if (root && root.RZConvSld) return root.RZConvSld;
    if (typeof require === 'function') return require('./sld-topology.js');
    throw new Error('RZEpmsSim: js/conv/sld-topology.js is not loaded');
  }
  function Tcc() {
    if (root && root.RZConvTcc) return root.RZConvTcc;
    if (typeof require === 'function') return require('./tcc.js');
    throw new Error('RZEpmsSim: js/conv/tcc.js is not loaded');
  }
  function index(sheet) {
    if (sheet.__epmsIdx) return sheet.__epmsIdx;
    var by = {};
    sheet.nodes.forEach(function (n) { by[n.id] = n; });
    Object.defineProperty(sheet, '__epmsIdx', { value: by, enumerable: false });
    return by;
  }

  function normalState(sheet) {
    var closed = {};
    sheet.nodes.forEach(function (n) { if (n.sw) closed[n.id] = n.normal !== 'open'; });
    return { closed: closed, gen: false };
  }
  function copyMap(m) { var c = {}; Object.keys(m || {}).forEach(function (k) { c[k] = m[k]; }); return c; }
  /* lost / run / batt (E-S-102): sources out of service, gensets running, batteries discharging; copied when present */
  function copyState(s) {
    var o = { closed: copyMap(s.closed), gen: !!s.gen };
    ['lost', 'run', 'batt'].forEach(function (k) { if (s[k]) o[k] = copyMap(s[k]); });
    return o;
  }

  function basis(snap) {
    var e = snap && snap.electrical, halls = snap && snap.campus && snap.campus.halls;
    if (!e || !Array.isArray(halls) || !halls.length) return null;
    var keys = ['hv_voltage_kv', 'mv_voltage_kv', 'lv_voltage_v', 'power_factor_design', 'hv_tx_mva', 'dist_tx_kva', 'dist_tx_streams',
      'dist_tx_per_stream_per_hall', 'hv_source_mva', 'genset_count', 'genset_unit_kw', 'genset_max_loading'];
    for (var i = 0; i < keys.length; i++) if (!isNum(e[keys[i]])) return null;
    var hallKw = halls.map(function (h) { return h.facility_load_kw; });
    if (!hallKw.every(isNum)) return null;
    return { e: e, hallKw: hallKw, kv: { hv: e.hv_voltage_kv, mv: e.mv_voltage_kv, lv: e.lv_voltage_v / 1000 } };
  }
  /* kW a load node draws: the hall's stream share; the drawn typical unit takes one unit's part of it and the ring
     beside it the rest, so the feeder still carries exactly the stream share */
  function loadKw(n, b) {
    if (isNum(n.kw)) return n.kw;   /* E-S-102: the builder stamps the engine kW of this hall on the node */
    var stream = b.hallKw[n.hall] / b.e.dist_tx_streams, units = b.e.dist_tx_per_stream_per_hall;
    if (n.load === 'feeder') return stream;
    if (n.load === 'lvsb') return stream / units;
    if (n.load === 'ring') return stream * (units - 1) / units;
    return 0;
  }
  function amps(kw, kv, pf) { return isNum(kw) && kv > 0 && pf > 0 ? kw / (SQRT3 * kv * pf) : null; }

  function term(by, ref) {
    if (Array.isArray(ref)) return null;
    if (by[ref]) return TWO[by[ref].sym] ? null : ref;
    var i = ref.lastIndexOf('.'), id = ref.slice(0, i), port = ref.slice(i + 1), n = by[id];
    if (!n) return null;
    if (!TWO[n.sym]) return id;
    if (SIDE[n.sym]) return SIDE[n.sym][port] ? id + ':' + SIDE[n.sym][port] : null;
    return A_PORT[port] ? id + ':a' : (B_PORT[port] ? id + ':b' : null);
  }

  function model(sheet, state, b) {
    var by = index(sheet), nodes = [], branches = [], seen = {};
    function add(o) { if (!seen[o.id]) { seen[o.id] = 1; nodes.push(o); } }
    sheet.nodes.forEach(function (n) {
      if (TWO[n.sym]) {
        add({ id: n.id + ':a', kind: 'bus' }); add({ id: n.id + ':b', kind: 'bus' });
        branches.push({ id: 'dev:' + n.id, a: n.id + ':a', b: n.id + ':b', closed: n.sw ? !!state.closed[n.id] && !(state.blocked && state.blocked[n.id]) : !(state.blocked && state.blocked[n.id]) });
      } else if (n.src === 'grid') {
        add({ id: n.id, kind: 'source', ratingKw: isNum(n.ratingKw) ? n.ratingKw : b.e.hv_source_mva * 1000, available: !(state.lost && state.lost[n.id]) });
      } else if (n.src === 'gen' && n.unit) {
        add({ id: n.id, kind: 'source', ratingKw: n.ratingKw, available: !!(state.run && state.run[n.id]) });
      } else if (n.src === 'gen') {
        add({ id: n.id, kind: 'source', ratingKw: b.e.genset_count * b.e.genset_unit_kw * b.e.genset_max_loading, available: !!state.gen });
      } else if (n.src === 'battery') {
        add({ id: n.id, kind: 'source', ratingKw: n.ratingKw, available: !!(state.batt && state.batt[n.id]) });
      } else if (n.load) {
        add({ id: n.id, kind: 'load', kw: loadKw(n, b) });
      } else if (n.sym === 'junction' || n.sym === 'surgeArrester' || n.sym === 'voltageTransformer') {
        add({ id: n.id, kind: 'bus' });
      }
    });
    sheet.edges.forEach(function (e) {
      if (e.flowOf !== 'p') return;
      var a = term(by, e.from), z = term(by, e.to);
      if (!a || !z) throw new Error('RZEpmsSim: conductor ' + e.id + ' has an end the model cannot resolve');
      if (!seen[a] || !seen[z]) return;   /* an earth switch is not a conductor of the flow model */
      branches.push({ id: e.id, a: a, b: z, closed: true });
    });
    return { nodes: nodes, branches: branches };
  }

  function solve(sheet, state, b) {
    var by = index(sheet), m = model(sheet, state, b), r = Sld().solve(m), pf = b.e.power_factor_design;
    var out = { edges: {}, dev: {}, raw: r, model: m };
    sheet.edges.forEach(function (e) {
      var br = r.branches[e.id];
      if (br) out.edges[e.id] = { energised: br.energised, kw: br.kw };
    });
    sheet.nodes.forEach(function (n) {
      var kv = b.kv[n.kv] || null, d;
      if (TWO[n.sym]) {
        var br = r.branches['dev:' + n.id], na = r.nodes[n.id + ':a'], nb = r.nodes[n.id + ':b'];
        d = { energised: !!(na && na.energised) || !!(nb && nb.energised), lineLive: !!(na && na.energised), loadLive: !!(nb && nb.energised),
          kw: br && br.energised ? br.kw : 0 };
      } else if (r.nodes[n.id]) {
        var lk = n.load ? loadKw(n, b) : 0, live = r.nodes[n.id].energised;
        d = { energised: live, kw: n.load ? (live ? lk : 0) : (r.sources[n.id] ? r.sources[n.id].kw : 0) };
      } else if (n.sym === 'earthSwitch') {
        var at = null;
        sheet.edges.forEach(function (e) { if (e.to === n.id + '.line') at = term(by, e.from); });
        d = { energised: !!(at && r.nodes[at] && r.nodes[at].energised), kw: 0, at: at };
      } else return;
      d.a = amps(d.kw, kv, pf);
      if (n.tx === 'hv') d.pct = 100 * d.kw / (b.e.hv_tx_mva * 1000 * pf);
      if (n.tx === 'dist') d.pct = 100 * d.kw / ((n.units || 1) * b.e.dist_tx_kva * pf);   /* units: a typical drawn for N in parallel */
      out.dev[n.id] = d;
    });
    return out;
  }

  function tagOf(by, id) { return by[id] ? by[id].tag || id : id; }
  function operate(sheet, state, id, close, b) {
    var by = index(sheet), n = by[id], C = state.closed;
    function no(reason) { return { ok: false, reason: reason, state: state }; }
    if (!n || !n.sw) return no((n ? tagOf(by, id) : id) + ' is not a switching device');
    if (!!C[id] === !!close) return no(tagOf(by, id) + ' is already ' + (close ? 'closed' : 'open'));
    if (n.sw === 'ds') {
      if (C[n.cb]) return no(n.tag + ' can move only with its breaker ' + tagOf(by, n.cb) + ' open, and ' + tagOf(by, n.cb) + ' is closed');
      if (close) {
        var esOn = sheet.nodes.filter(function (m) { return m.sw === 'es' && C[m.id] && (m.ds || []).indexOf(id) >= 0; });
        if (esOn.length) return no(n.tag + ' cannot close while the earthing switch ' + esOn[0].tag + ' is closed');
      }
    }
    if (n.sw === 'es' && close) {
      var dsOn = (n.ds || []).filter(function (d) { return C[d]; });
      if (dsOn.length) return no(n.tag + ' can close only with its disconnectors open; ' + dsOn.map(function (d) { return tagOf(by, d); }).join(', ') + ' closed');
      var now = solve(sheet, state, b).dev[id];
      if (now && now.energised) return no(n.tag + ' can close only on a dead circuit, and the circuit is live');
    }
    if (n.sw === 'cb' && close) {
      var es = (n.es || []).filter(function (x) { return C[x]; });
      if (es.length) return no(n.tag + ' cannot close onto a circuit earthed by ' + es.map(function (x) { return tagOf(by, x); }).join(', '));
      if (n.role === 'tie' || n.role === 'incomer') {
        var inc = sheet.nodes.filter(function (m) { return m.role === 'incomer'; });
        var tie = sheet.nodes.filter(function (m) { return m.role === 'tie'; })[0];
        if (n.role === 'tie' && inc.every(function (m) { return C[m.id]; }))
          return no('2-out-of-3: ' + n.tag + ' closes only when one incomer is open; ' + inc.map(function (m) { return m.tag; }).join(' and ') + ' are both closed');
        if (n.role === 'incomer' && tie && C[tie.id] && inc.some(function (m) { return m.id !== id && C[m.id]; }))
          return no('2-out-of-3: ' + n.tag + ' cannot close while ' + tie.tag + ' and the other incomer are closed');
      }
      if ((n.role === 'gen' || n.role === 'genset') && !state.gen)
        return no(n.tag + ' closes only on a running generator bus inside the 25 sync-check window; the gensets are off in this simulation');
    }
    var next = copyState(state);
    next.closed[id] = !!close;
    return { ok: true, reason: tagOf(by, id) + (close ? ' closed' : ' opened'), state: next };
  }

  /* the typical unit's protection chain, load side first, from the engine's published settings. Imax = the largest
     current the device can see, at its own voltage: the LV main the LV maximum fault, every 20 kV device the 20 kV fault
     level, the 150 kV transformer relay that fault referred through the transformer. A curve is never drawn past it. */
  function chain(b) {
    var e = b.e, mvA = e.mv_fault_level_ka * 1000;
    var out = [
      { id: 'lsig', label: 'LV main LSIG', V: e.lv_voltage_v, dev: { kind: 'lsig', Ir: e.pro_lv_ir_a, tr: e.pro_lv_tr_s, Isd: e.pro_lv_isd_a, tsd: e.pro_lv_tsd_s, i2t: false } },
      { id: 'feeder', label: '20 kV feeder 50/51 (' + e.pro_feeder_curve + ')', V: e.mv_voltage_kv * 1000,
        dev: { kind: 'relay', curve: e.pro_feeder_curve, Is: e.pro_feeder_is_a, TMS: e.pro_feeder_tms, inst: { I: e.pro_feeder_inst_a, t: e.pro_feeder_inst_s } } },
      { id: 'incomer', label: '20 kV incomer 51 (' + e.pro_incomer_curve + ')', V: e.mv_voltage_kv * 1000,
        dev: { kind: 'relay', curve: e.pro_incomer_curve, Is: e.pro_incomer_is_a, TMS: e.pro_incomer_tms } },
      { id: 'hv', label: '150 kV transformer 51 (' + e.pro_hv_curve + ')', V: e.hv_voltage_kv * 1000,
        dev: { kind: 'relay', curve: e.pro_hv_curve, Is: e.pro_hv_is_a, TMS: e.pro_hv_tms } }
    ];
    var lim = { lsig: e.lv_fault_level_ka * 1000, feeder: mvA, incomer: mvA, hv: mvA * e.mv_voltage_kv / e.hv_voltage_kv };
    out.forEach(function (c) { c.Imax = lim[c.id]; });
    return out;
  }
  /* the grading check the engine's rule states: the whole chain at the LV maximum fault, each upstream pair at the
     20 kV fault. Currents are reported referred to 20 kV. */
  function coordination(b) {
    var T = Tcc(), e = b.e, ch = chain(b), gm = e.pro_grading_margin_s, mv = e.mv_voltage_kv * 1000;
    var runs = [
      { r: T.coordinate(ch, e.lv_fault_level_ka * 1000, gm), V: ch[0].V },
      { r: T.coordinate(ch.slice(1, 3), e.mv_fault_level_ka * 1000, gm), V: ch[1].V },
      { r: T.coordinate(ch.slice(2, 4), e.mv_fault_level_ka * 1000, gm), V: ch[2].V }
    ];
    var label = {}; ch.forEach(function (c) { label[c.id] = c.label; });
    var rows = [], ok = true;
    runs.forEach(function (x) {
      if (!x.r.ok) ok = false;
      x.r.pairs.forEach(function (p) {
        rows.push({ down: p.down, up: p.up, downLabel: label[p.down], upLabel: label[p.up], I: T.refer(p.I, x.V, mv),
          td: p.td, tu: p.tu, margin: p.margin, ok: p.ok });
      });
    });
    return { ok: ok, margin: gm, rows: rows };
  }

  var API = { normalState: normalState, basis: basis, model: model, solve: solve, operate: operate, chain: chain, coordination: coordination,
    loadKw: loadKw, amps: amps, version: '1.1.0' };
  if (root) root.RZEpmsSim = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
