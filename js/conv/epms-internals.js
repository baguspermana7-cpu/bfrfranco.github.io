/*
 * epms-internals.js — window.RZEpmsInternals: the units the equipment modal draws on EPMS_Telemetry.html, read from the
 * page's OWN simulation (PRD-CONV-EQUIPMENT-INSIDE P4a, P4-ELECTRICAL.md §7). The modal never asks the engine fleet for a
 * transformer or a UPS: the drawing and the single-line read one solve, so one device shows one value (law TR1 / EL3).
 * Pure and deterministic (no clock, no random, no DOM); Node-tested by tools/test-conv-internals-p4.mjs.
 *
 *   classOf(node)                         'hv_tx' | 'dist_tx' | 'pdu' | 'ups' | null — the internals class a sheet node opens
 *   txUnits(sheet, state, res)            [{ id, tag, classKey, state, kw, a, pct, units, upA, up, down, upState, downState }]
 *                                         every transformer of the sheet in drawing order; up / down are the nearest
 *                                         switching devices on each side (through CTs and junctions)
 *   upsUnits(sheet, state, res)           [{ id, tag, state, mode, recKw, invKw, batKw, ssKw, lossKw, ratingKw, ci, cbb, co, ss,
 *                                         parts: { rec, inv, bat, ss } }] one per UPS of an E-S-102 sheet
 *   breakerUnits(sheet, state, res)       (1.1.0, P4b) [{ id, tag, kv, scope, state, pos, kw, a, up, down, relay, lsig, il }]
 *   unitOf(node, sheet, state, res)       { classKey, units, index, focus } for a clicked node, or null
 */
(function (root) {
  'use strict';
  var SWITCH = { cbIec: 1, cbDrawout: 1, disconnector: 1, staticSwitch: 1 };
  var UPS_PART = { rectifier: 'rec', inverterIec: 'inv', batteryIec: 'bat', staticSwitch: 'ss' };
  function byId(sheet) { var o = {}; sheet.nodes.forEach(function (n) { o[n.id] = n; }); return o; }
  function nodeOf(ref) { return typeof ref === 'string' ? ref.split('.')[0] : null; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function classOf(n) {
    if (!n) return null;
    if (n.sym === 'transformer2w') return n.tx === 'hv' ? 'hv_tx' : n.tx === 'pdu' ? 'pdu' : 'dist_tx';   /* E18: the floor PDU has its own class */
    /* the four symbols of one UPS: rectifier / inverter (n.ups), the battery on its DC bus, the static bypass */
    if (UPS_PART[n.sym] && (n.ups || n.dcBus || n.sw === 'ss')) return 'ups';
    if (n.sym === 'cbIec' || n.sym === 'cbDrawout') return 'breaker';
    if (n.sym === 'protectionRelay') return 'relay';
    return null;
  }
  /* the nearest switching device from one terminal of a node, walking conductors through CTs and junctions */
  function nearest(sheet, by, id, port) {
    var seen = {}, q = [];
    seen[id] = 1;
    sheet.edges.forEach(function (e) {
      if (e.from === id + '.' + port) q.push(nodeOf(e.to));
      if (e.to === id + '.' + port) q.push(nodeOf(e.from));
    });
    while (q.length) {
      var x = q.shift(); if (!x || seen[x]) continue; seen[x] = 1;
      var n = by[x]; if (!n) continue;
      if (SWITCH[n.sym]) return n;
      if (n.sym !== 'junction' && n.sym !== 'currentTransformer') continue;
      sheet.edges.forEach(function (e) {
        var a = nodeOf(e.from), b = nodeOf(e.to);
        if (a === x && !seen[b]) q.push(b);
        if (b === x && !seen[a]) q.push(a);
      });
    }
    return null;
  }
  /* the nearest drawn device of any kind from one terminal, along POWER conductors only (through junctions and CTs);
     a junction where three or more conductors meet is a bus: the breaker sits on it, so the answer is the bus itself */
  function nearestAny(sheet, by, id, port) {
    var pw = sheet.edges.filter(function (e) { var a = by[nodeOf(e.from)], b = by[nodeOf(e.to)];   /* an earthing branch is not a conductor of the bus */
      return e.medium === 'power' && !(a && a.sym === 'earthSwitch') && !(b && b.sym === 'earthSwitch'); });
    function deg(x) { return pw.filter(function (e) { return nodeOf(e.from) === x || nodeOf(e.to) === x; }).length; }
    var seen = {}, q = [], best = null, sw = null;
    seen[id] = 1;
    pw.forEach(function (e) {
      if (e.from === id + '.' + port) q.push({ x: nodeOf(e.to), d: 1, bus: false });
      if (e.to === id + '.' + port) q.push({ x: nodeOf(e.from), d: 1, bus: false });
    });
    /* breadth first: the nearest tagged device that is NOT a switch wins (a transformer, a source, a rectifier, a set);
       a switch reached across a bus junction means the breaker sits on that bus */
    while (q.length) {
      var it = q.shift(), x = it.x; if (!x || seen[x]) continue; seen[x] = 1;
      var n = by[x]; if (!n) continue;
      if (best && it.d > best.d) break;
      if (n.sym === 'earthSwitch') continue;   /* a branch to earth, never a source or a load */
      if (n.sym !== 'junction' && n.sym !== 'currentTransformer' && n.tag) {
        if (SWITCH[n.sym]) { if (!sw) sw = { n: n, bus: it.bus }; continue; }
        if (!best) best = { n: n, d: it.d };
        continue;
      }
      var bus = it.bus || (n.sym === 'junction' && deg(x) >= 3);
      pw.forEach(function (e) {
        var a = nodeOf(e.from), c = nodeOf(e.to);
        if (a === x && !seen[c]) q.push({ x: c, d: it.d + 1, bus: bus });
        if (c === x && !seen[a]) q.push({ x: a, d: it.d + 1, bus: bus });
      });
    }
    if (best) return best.n;
    if (sw) return sw.bus ? { tag: 'bus' } : sw.n;
    return null;
  }
  function isOpen(state, n) { return !state.closed[n.id]; }
  function pos(state, n) { return n ? (state.closed[n.id] ? 'CLOSED' : 'OPEN') : null; }
  function devState(d) { return d && d.energised ? (isNum(d.kw) && d.kw > 0 ? 'running' : 'standby') : 'stopped'; }

  function txUnits(sheet, state, res) {
    var by = byId(sheet);
    return sheet.nodes.filter(function (n) { return n.sym === 'transformer2w'; }).map(function (n) {
      var d = res.dev[n.id] || {}, up = nearest(sheet, by, n.id, 'hv'), dn = nearest(sheet, by, n.id, 'lv');
      var du = up ? res.dev[up.id] : null;
      return { id: n.id, tag: n.tag, classKey: classOf(n), state: devState(d), kw: d.kw, a: d.a, pct: d.pct, units: n.units || 1,
        loadPct: isNum(d.pct) ? d.pct : null,   /* the modal header and the fleet tiles read loadPct */
        upA: du && du.energised ? du.a : 0,   /* the upstream breaker's OWN current: on a ring it carries more than this unit */
        up: up ? up.tag : null, down: dn ? dn.tag : null, upState: pos(state, up), downState: pos(state, dn) };
    });
  }
  function upsUnits(sheet, state, res) {
    var by = byId(sheet), batt = res.batt || {};
    return sheet.nodes.filter(function (n) { return n.sym === 'batteryIec' && n.dcBus; }).map(function (b) {
      var u = b.id.replace(/bat$/, ''), rec = by[u + 'rec'], inv = by[u + 'inv'], ss = by[u + 'ss'];
      var kw = function (id) { var d = res.dev[id]; return d && d.energised && isNum(d.kw) ? d.kw : 0; };
      /* the sheet's own predicates (js/conv/epms-lv-view.js read()): on battery = res.batt and the inverter energised */
      var live = function (id) { var d = res.dev[id]; return !!(d && d.energised); };
      var mode = batt[b.id] && live(inv.id) ? 'BATTERY' : kw(ss.id) > 0 ? 'BYPASS' : live(inv.id) && live(rec.id) ? 'NORMAL' : 'OFF';
      return { id: u + 'ups', tag: 'UPS-' + String(rec.tag).replace(/^REC-/, ''), state: mode === 'OFF' ? 'stopped' : 'running', mode: mode,
        recKw: kw(rec.id), invKw: kw(inv.id), batKw: kw(b.id), ssKw: kw(ss.id), lossKw: (res.dev[inv.id] || {}).lossKw || 0, ratingKw: b.ratingKw,
        loadPct: b.ratingKw ? 100 * (kw(inv.id) + kw(ss.id)) / b.ratingKw : null,   /* output over rating, through the inverter or the bypass */
        ci: pos(state, by[u + 'ci']), cbb: pos(state, by[u + 'cbb']), co: pos(state, by[u + 'co']), ss: state.closed[ss.id] ? 'ON' : 'OFF',   /* the sheet's own words for a static switch */
        parts: { rec: rec.id, inv: inv.id, bat: b.id, ss: ss.id } };
    });
  }
  /* P4b: every circuit breaker of the sheet; scope = the strip it shares (same voltage class, and on E-S-102 the same stream) */
  function scopeOf(n) { var m = /-(?:[A-Z]+)([A-D])([AB])$/.exec(n.tag || ''); return n.kv + (n.hall !== undefined && m ? '-' + m[2] : ''); }
  function breakerUnits(sheet, state, res) {
    var by = byId(sheet);
    return sheet.nodes.filter(function (n) { return n.sym === 'cbIec' || n.sym === 'cbDrawout'; }).map(function (n) {
      var d = res.dev[n.id] || {}, up = nearestAny(sheet, by, n.id, 'line'), dn = nearestAny(sheet, by, n.id, 'load'), rl = n.relay ? by[n.relay] : null;
      var il = [];
      if (n.es && by[n.es]) il.push(by[n.es]);
      sheet.nodes.forEach(function (x) { if ((x.sw === 'ds' || x.sw === 'es') && x.cb === n.id && il.indexOf(x) < 0) il.push(x); });
      return { id: n.id, tag: n.tag, classKey: 'breaker', kv: n.kv, scope: scopeOf(n), state: devState(d), pos: pos(state, n),
        kw: d.energised && isNum(d.kw) ? d.kw : 0, a: d.energised && isNum(d.a) ? d.a : 0,
        loadPct: null, cell: String(n.tag).replace(/^CB-/, ''), readout: (isOpen(state, n) ? 'OPEN' : Math.round(d.energised && isNum(d.a) ? d.a : 0) + ' A'),
        up: up ? (up.tag === 'bus' ? String(n.kv).toUpperCase() + ' bus' : up.tag) : null, down: dn ? (dn.tag === 'bus' ? String(n.kv).toUpperCase() + ' bus' : dn.tag) : null, relay: rl ? rl.tag : null, lsig: !!(rl && rl.prot === 'lsig'),
        il: il.map(function (x) { return { tag: x.tag, pos: pos(state, x) }; }) };
    });
  }
  /* P4b: every protection relay; its ANSI functions come from its name (IEEE C37.2), its strip = the voltage class
     of the breaker it trips (a relay that trips none, e.g. 87B, joins the HV strip) */
  function relayUnits(sheet, state, res) {
    var by = byId(sheet);
    return sheet.nodes.filter(function (n) { return n.sym === 'protectionRelay'; }).map(function (n) {
      var cb = n.cb ? by[n.cb] : null, d = cb ? (res.dev[cb.id] || {}) : {};
      return { id: n.id, tag: n.tag, classKey: 'relay', name: n.name, fns: String(n.name || '').split(/\s*·\s*|\s+/).filter(Boolean),
        prot: n.prot || null, cb: cb ? cb.tag : null, cbPos: cb ? pos(state, cb) : null, scope: cb ? scopeOf(cb) : 'hv',
        state: cb ? devState(d) : 'normal', loadPct: null, cell: String(n.tag).replace(/^R-/, ''), readout: n.name };
    });
  }
  function unitOf(n, sheet, state, res) {
    var k = classOf(n); if (!k) return null;
    if (k === 'ups') {
      var us = upsUnits(sheet, state, res);
      for (var i = 0; i < us.length; i++) {
        var p = us[i].parts;
        for (var part in p) if (p[part] === n.id) return { classKey: 'ups', units: us, index: i, focus: part };
      }
      return null;
    }
    if (k === 'breaker') {
      var bs = breakerUnits(sheet, state, res), me = bs.filter(function (u) { return u.id === n.id; })[0];
      if (!me) return null;
      var strip = bs.filter(function (u) { return u.scope === me.scope; });
      return { classKey: 'breaker', units: strip, index: strip.indexOf(me), focus: null };
    }
    if (k === 'relay') {
      var rs = relayUnits(sheet, state, res), rm = rs.filter(function (u) { return u.id === n.id; })[0];
      var rstrip = rs.filter(function (u) { return u.scope === rm.scope; });
      return { classKey: 'relay', units: rstrip, index: rstrip.indexOf(rm), focus: null };
    }
    var all = txUnits(sheet, state, res).filter(function (u) { return u.classKey === k; });
    for (var j = 0; j < all.length; j++) if (all[j].id === n.id) return { classKey: k, units: all, index: j, focus: null };
    return null;
  }
  var API = { classOf: classOf, txUnits: txUnits, upsUnits: upsUnits, breakerUnits: breakerUnits, relayUnits: relayUnits, unitOf: unitOf, version: '1.1.0' };
  if (root) root.RZEpmsInternals = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
