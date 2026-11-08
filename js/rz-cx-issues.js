/* rz-cx-issues.js — Cx Analysis Tier 1 issue register and gate readiness (K22; PRD v1.1 §14, §15–16, journey 2, T9).
 * DOM-free (Node + browser). Rules are the Cx Field Manual's, cited on every item:
 *   02.5.2  the contractor requests the next level in writing; the CxA checks every record named in the exit
 *           criteria is signed and filed in the CDE; any open critical issue blocks the gate.
 *   02.5.4  A (critical) blocks the gate; B (major) blocks unless the CxM and EoR record that the next level is not
 *           affected; C (minor) never blocks and is listed as a condition.
 *   02.7.1  UPS L4: load bank supplier present; witnessed by CxM, CxA, owner operations.   07.7 witness points.
 *   15.7    generator load bank test.
 * "Ready" is a gate-review readiness, not a permit to energise (handbook ch 10).
 *   RZCxIssues.store(storage)               → { load, add, setStatus, setWaiver, check, remove, persisted }
 *   RZCxIssues.readiness(plan, month, sysId, register) → { gate, items[], blockers[], conditions[], ready, reason, note }
 *   RZCxIssues.overlay(status, register)    → a COPY of RZCxPlan.statusAt() with blocked / blockers / conditions per system
 * ES5. */
(function (root) {
  'use strict';
  var P = root.RZCxPlan || (typeof require === 'function' ? (function () { try { return require('./rz-cx-plan.js'); } catch (e) { return null; } })() : null);
  var HB2 = 'cx-handbook/02-commissioning-process-levels-roles.html', HB7 = 'cx-handbook/07-itp-inspection-requests-hold-points.html';
  var HB15 = 'cx-handbook/15-generators-fuel-synchronising.html', HB28 = 'cx-handbook/28-integrated-systems-testing.html';
  var KEY = 'rz-cx-issues', GATES = ['L1', 'L2', 'L3', 'L4', 'L5'], SEV = ['A', 'B', 'C'], ROLES = ['CxM', 'CxA', 'GC', 'OEM', 'EoR', 'Owner'];
  var PREV_RECORD = { L1: 'L0 design review log', L2: 'L1 FAT report', L3: 'L2 delivery and installation checklist', L4: 'L3 start-up checklist', L5: 'L4 functional test records' };

  function sysIds() { var o = {}; if (P) for (var i = 0; i < P.SYSTEMS.length; i++) o[P.SYSTEMS[i].id] = 1; return o; }
  function isSys(id) { return !!sysIds()[id]; }
  function idx(a, v) { for (var i = 0; i < a.length; i++) if (a[i] === v) return i; return -1; }
  function txt(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }

  /* the items a gate review checks before level `gate` may start on system `sys` */
  function items(sys, gate) {
    var out = [
      { key: 'request', text: 'Gate request submitted in writing by the contractor', role: 'GC', cite: HB2 + '#s02-5-2' },
      { key: 'records', text: PREV_RECORD[gate] + ' signed and filed in the CDE', role: 'CxA', cite: HB2 + '#s02-5-3' }
    ];
    if (gate === 'L4') out.push({ key: 'oem', text: 'OEM start-up report filed', role: 'OEM', cite: HB2 + '#s02-5-3' });
    if (gate === 'L4' || gate === 'L5') out.push({ key: 'witness', text: 'Witness booked: CxM, CxA, owner operations', role: 'CxM', cite: HB7 + '#s07-7' });
    if (gate === 'L4' && sys === 'ups') out.push({ key: 'loadbank', text: 'Load bank and supplier on site', role: 'GC', cite: HB2 + '#s02-7-1' });
    if (gate === 'L4' && sys === 'generators') out.push({ key: 'loadbank', text: 'Load bank and supplier on site', role: 'GC', cite: HB15 + '#s15-7' });
    if (gate === 'L5') out.push({ key: 'ist', text: 'IST script approved', role: 'CxA', cite: HB28 + '#s28-1' });
    return out;
  }

  function cleanIssue(x) {
    if (!x || typeof x !== 'object' || !/^ISS-\d{2,4}$/.test(String(x.id))) return null;
    if (idx(SEV, x.severity) < 0 || !isSys(x.system) || idx(GATES, x.gate) < 0) return null;
    var t = txt(x.title, 120); if (!t) return null;
    var due = typeof x.due === 'number' && isFinite(x.due) && x.due >= 0 && x.due <= 120 ? Math.round(x.due * 10) / 10 : null;
    return { id: x.id, title: t, severity: x.severity, system: x.system, gate: x.gate, due: due,
             owner: idx(ROLES, x.owner) >= 0 ? x.owner : null, status: x.status === 'closed' ? 'closed' : 'open',
             waiver: x.severity === 'B' && x.waiver === true };
  }
  function empty() { return { seq: 0, items: [], checks: {} }; }
  function cleanChecks(c) {
    var out = {}; if (!c || typeof c !== 'object') return out;
    for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k) && c[k] === true) {
      var p = k.split(':'); if (p.length === 3 && isSys(p[0]) && idx(GATES, p[1]) >= 0 && /^[a-z]+$/.test(p[2])) out[k] = true;
    }
    return out;
  }

  function store(storage) {
    var mem = null, ok = !!storage;
    function read() {
      if (mem) return mem;
      var r = empty();
      if (storage) {
        try {
          var p = JSON.parse(storage.getItem(KEY) || 'null');
          if (p && p.version === 1 && p.items && typeof p.items.length === 'number') {
            for (var i = 0; i < p.items.length; i++) { var c = cleanIssue(p.items[i]); if (c) r.items.push(c); }
            r.checks = cleanChecks(p.checks);
            var top = 0; for (var j = 0; j < r.items.length; j++) top = Math.max(top, +r.items[j].id.slice(4));
            r.seq = Math.max(top, typeof p.seq === 'number' && isFinite(p.seq) ? Math.floor(p.seq) : 0);
          }
        } catch (e) { r = empty(); }
      }
      mem = r; return r;
    }
    function write() {
      if (!storage) { ok = false; return false; }
      try { storage.setItem(KEY, JSON.stringify({ version: 1, seq: mem.seq, items: mem.items, checks: mem.checks })); ok = true; return true; } catch (e) { ok = false; return false; }
    }
    function find(id) { var r = read(); for (var i = 0; i < r.items.length; i++) if (r.items[i].id === id) return r.items[i]; return null; }
    return {
      load: function () { var r = read(); return JSON.parse(JSON.stringify(r)); },
      add: function (o) {
        o = o || {};
        if (!txt(o.title, 120)) return { ok: false, code: 'TITLE' };
        if (idx(SEV, o.severity) < 0) return { ok: false, code: 'SEVERITY' };
        if (!isSys(o.system)) return { ok: false, code: 'SYSTEM' };
        if (idx(GATES, o.gate) < 0) return { ok: false, code: 'GATE' };
        var r = read(); r.seq++;
        var n = r.seq < 10 ? '0' + r.seq : String(r.seq);
        var it = cleanIssue({ id: 'ISS-' + n, title: o.title, severity: o.severity, system: o.system, gate: o.gate, due: o.due, owner: o.owner, status: 'open' });
        r.items.push(it); write();
        return { ok: true, issue: JSON.parse(JSON.stringify(it)) };
      },
      setStatus: function (id, s) { var it = find(id); if (!it || (s !== 'open' && s !== 'closed')) return false; it.status = s; write(); return true; },
      setWaiver: function (id, on) { var it = find(id); if (!it || it.severity !== 'B') return false; it.waiver = !!on; write(); return true; },
      check: function (sys, gate, key, on) {
        if (!isSys(sys) || idx(GATES, gate) < 0 || !/^[a-z]+$/.test(String(key))) return false;
        var r = read(), k = sys + ':' + gate + ':' + key; if (on) r.checks[k] = true; else delete r.checks[k]; write(); return true;
      },
      remove: function (id) { var r = read(); for (var i = 0; i < r.items.length; i++) if (r.items[i].id === id) { r.items.splice(i, 1); write(); return true; } return false; },
      persisted: function () { return ok; }
    };
  }

  function nextGate(plan, month, sys) {
    if (!P || !plan) return null;
    var st = P.statusAt(plan, month); if (!st) return null;
    for (var i = 0; i < st.systems.length; i++) if (st.systems[i].id === sys) return st.systems[i].next;
    return null;
  }
  function sevRank(s) { return s === 'A' ? 0 : s === 'B' ? 1 : 2; }
  function classify(reg, sys, gate) {
    var blockers = [], conditions = [], list = (reg && reg.items) || [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i]; if (x.system !== sys || x.gate !== gate || x.status !== 'open') continue;
      if (x.severity === 'A' || (x.severity === 'B' && !x.waiver)) blockers.push(x); else conditions.push(x);
    }
    blockers.sort(function (a, b) { return sevRank(a.severity) - sevRank(b.severity); });
    return { blockers: blockers, conditions: conditions };
  }

  function readiness(plan, month, sys, reg) {
    var note = 'Gate-review readiness only: not a permit to energise (handbook ch 10).';
    var gate = nextGate(plan, month, sys);
    if (!gate) return { gate: null, items: [], blockers: [], conditions: [], ready: false, reason: 'All five gates passed in the plan (L5).', note: note };
    var checks = (reg && reg.checks) || {}, its = items(sys, gate), open = [];
    for (var i = 0; i < its.length; i++) { its[i].done = checks[sys + ':' + gate + ':' + its[i].key] === true; if (!its[i].done) open.push(its[i]); }
    var c = classify(reg, sys, gate), parts = [];
    for (var j = 0; j < c.blockers.length; j++) parts.push(c.blockers[j].id + ' (' + c.blockers[j].severity + ') open');
    if (open.length) parts.push(open.length + ' of ' + its.length + ' items open: ' + open.map(function (x) { return x.text.split(':')[0]; }).join('; '));
    var ready = !c.blockers.length && !open.length;
    var reason = ready ? 'Ready for the ' + gate + ' gate' + (c.conditions.length ? ' with ' + c.conditions.length + ' condition' + (c.conditions.length > 1 ? 's' : '') + ' (' + c.conditions.map(function (x) { return x.id; }).join(', ') + ')' : '')
                       : 'Not ready for the ' + gate + ' gate: ' + parts.join('; ');
    return { gate: gate, items: its, blockers: c.blockers, conditions: c.conditions, ready: ready, reason: reason, note: note };
  }

  function overlay(status, reg) {
    if (!status) return null;
    var out = JSON.parse(JSON.stringify(status)); out.counts = out.counts || {}; out.counts.blocked = 0;
    for (var i = 0; i < out.systems.length; i++) {
      var r = out.systems[i], c = r.next ? classify(reg, r.id, r.next) : { blockers: [], conditions: [] };
      r.blocked = c.blockers.length > 0; r.blockers = c.blockers.map(function (x) { return x.id; }); r.conditions = c.conditions.map(function (x) { return x.id; });
      if (r.blocked) out.counts.blocked++;
    }
    return out;
  }

  var API = { KEY: KEY, GATES: GATES, SEVERITIES: SEV, ROLES: ROLES, items: items, store: store, readiness: readiness, overlay: overlay };
  root.RZCxIssues = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
