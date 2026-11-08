/* rz-cx-records.js — Tier 3 vertical slice of WI-CX-SUPERAPP-001 (TIER3_DISCOVERY.md §4): the RECORD layer that
 * Tier 1 (RZCxPlan.statusAt, a forecast) does not have — assets, gates, approvals, test packs/attempts/steps,
 * issues, cost allocations, observations, model mappings — validated against the owner PRD v1.0 invariants
 * (§13 four-field status, §15 FR-TST-01..03, §28/§40 invariants, §30 import rules) and overlaid on the plan.
 * DOM-free, ES5, dual-target. Nothing here computes a schedule: records are facts, the plan stays the engine's.
 *
 *   RZCxRecords.validate(db)            → { ok, findings:[{law, id, message}], gates:{<gate_id>: {valid, constraint}} }
 *   RZCxRecords.overlay(status, db)     → status rows with actual accepted levels (Tier 3 wins; Tier 1 = planned)
 *   RZCxRecords.importRegister(csv)     → { assets:[], rejected:[{line, reason}] } per PRD v1.0 §30
 *   RZCxRecords.LAWS                    → the law ids the gate and the panel print */
(function (root) {
  'use strict';
  var LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'];
  var DOMAINS = ['mv_150kv', 'mv_20kv', 'lv_400v', 'dc_48v', 'chw', 'fws', 'tcs', 'air', 'data'];
  var ISSUE_OPEN = { open: 1, assigned: 1, in_progress: 1, ready_for_verification: 1, reopened: 1 };
  var LAWS = {
    R1: 'every record has a unique id and revision ≥ 1',
    R2: 'a connection joins two ports of the same domain',
    R3: 'an accepted gate has an accept decision with the same revision hash',
    R4: 'L(n) accepted implies L(n−1) accepted for the same asset',
    R5: 'a pack with an empty mandatory step cannot be accepted (FR-TST-01)',
    R6: 'result pass does not make a pack accepted (FR-TST-02)',
    R7: 'the operator of an attempt is not its approver when segregation is on (FR-TST-03)',
    R8: 'an open blocking issue sets the gate constraint to blocked',
    R9: 'an asset without a model mapping keeps its status and says Model not verified',
    R10: 'a scenario never moves an actual date',
    R11: 'cost allocations of one line sum to 100 %',
    R13: 'an observation carries source_time and received_time; Cx status is never read from it'
  };
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function byId(list) { var m = {}; for (var i = 0; i < list.length; i++) if (list[i] && list[i].id !== undefined) m[list[i].id] = list[i]; return m; }
  function idx(level) { return LEVELS.indexOf(level); }

  function validate(db) {
    db = db || {};
    var f = [], seen = {}, i, j, k;
    var tables = ['assets', 'ports', 'connections', 'mappings', 'gates', 'packs', 'attempts', 'steps', 'issues', 'approvals', 'cost_lines', 'allocations', 'observations', 'scenarios'];
    for (i = 0; i < tables.length; i++) {
      var rows = arr(db[tables[i]]);
      for (j = 0; j < rows.length; j++) {
        var r = rows[j], id = r && r.id;
        if (typeof id !== 'string' || !id) { f.push({ law: 'R1', id: tables[i] + '[' + j + ']', message: 'missing id' }); continue; }
        if (seen[tables[i] + ':' + id]) f.push({ law: 'R1', id: id, message: 'duplicate id in ' + tables[i] });
        seen[tables[i] + ':' + id] = 1;
        if (!(typeof r.revision === 'number' && r.revision >= 1)) f.push({ law: 'R1', id: id, message: 'revision must be ≥ 1' });
      }
    }
    var ports = byId(arr(db.ports)), conns = arr(db.connections);
    for (i = 0; i < conns.length; i++) {
      var c = conns[i], a = ports[c.from_port_id], b = ports[c.to_port_id];
      if (!a || !b) { f.push({ law: 'R2', id: c.id, message: 'port not found' }); continue; }
      if (DOMAINS.indexOf(a.domain) === -1 || a.domain !== b.domain) f.push({ law: 'R2', id: c.id, message: a.domain + ' → ' + b.domain });
    }
    var approvals = arr(db.approvals), gates = arr(db.gates), gateOut = {}, accepted = {};
    for (i = 0; i < gates.length; i++) {
      var g = gates[i], valid = true;
      if (g.workflow_state === 'accepted') {
        var dec = null;
        for (j = 0; j < approvals.length; j++) { var d = approvals[j]; if (d.entity === 'gate' && d.entity_id === g.id && d.decision === 'accept') dec = d; }
        if (!dec) { valid = false; f.push({ law: 'R3', id: g.id, message: 'accepted without an accept decision' }); }
        else if (dec.revision_hash !== g.revision_hash) { valid = false; f.push({ law: 'R3', id: g.id, message: 'decision hash ' + dec.revision_hash + ' ≠ gate ' + g.revision_hash }); }
        if (valid) { accepted[g.scope_id] = accepted[g.scope_id] || {}; accepted[g.scope_id][g.level] = g; }
      }
      gateOut[g.id] = { valid: valid, constraint: g.constraint_state || 'clear', level: g.level, scope_id: g.scope_id };
    }
    for (k in accepted) if (Object.prototype.hasOwnProperty.call(accepted, k)) for (var L in accepted[k]) if (Object.prototype.hasOwnProperty.call(accepted[k], L)) {
      var n = idx(L); if (n > 0 && !accepted[k][LEVELS[n - 1]]) { f.push({ law: 'R4', id: accepted[k][L].id, message: L + ' accepted on ' + k + ' without ' + LEVELS[n - 1] }); gateOut[accepted[k][L].id].valid = false; }
    }
    var steps = arr(db.steps), attempts = byId(arr(db.attempts)), packs = arr(db.packs);
    for (i = 0; i < packs.length; i++) {
      var p = packs[i];
      if (p.workflow_state !== 'accepted') { if (p.result === 'pass' && p.workflow_state !== 'submitted' && p.workflow_state !== 'under_review' && p.workflow_state !== 'accepted') f.push({ law: 'R6', id: p.id, message: 'pass with state ' + p.workflow_state }); continue; }
      var hasAccept = false;
      for (j = 0; j < approvals.length; j++) if (approvals[j].entity === 'pack' && approvals[j].entity_id === p.id && approvals[j].decision === 'accept') hasAccept = true;
      if (!hasAccept) f.push({ law: 'R6', id: p.id, message: 'accepted pack without an accept decision — a pass result is not acceptance' });
      for (j = 0; j < steps.length; j++) {
        var s = steps[j], at = attempts[s.attempt_id];
        if (!at || at.pack_id !== p.id) continue;
        if (s.mandatory && (s.measured_value === null || s.measured_value === undefined || s.measured_value === '')) f.push({ law: 'R5', id: p.id, message: 'mandatory step ' + s.id + ' empty' });
      }
      if (p.segregation !== false) for (j = 0; j < approvals.length; j++) {
        var ap = approvals[j]; if (ap.entity !== 'pack' || ap.entity_id !== p.id || ap.decision !== 'accept') continue;
        for (k in attempts) if (Object.prototype.hasOwnProperty.call(attempts, k) && attempts[k].pack_id === p.id && attempts[k].operator && attempts[k].operator === ap.signer) f.push({ law: 'R7', id: p.id, message: 'operator ' + ap.signer + ' approved their own attempt' });
      }
    }
    var issues = arr(db.issues);
    for (i = 0; i < gates.length; i++) {
      var blockedBy = null;
      for (j = 0; j < issues.length; j++) { var is = issues[j]; if (ISSUE_OPEN[is.state] && arr(is.blocking_gate_ids).indexOf(gates[i].id) !== -1) blockedBy = is.id; }
      if (blockedBy && gateOut[gates[i].id].constraint !== 'blocked') { f.push({ law: 'R8', id: gates[i].id, message: 'open blocking issue ' + blockedBy + ' but constraint ' + gateOut[gates[i].id].constraint }); gateOut[gates[i].id].constraint = 'blocked'; gateOut[gates[i].id].blocked_by = blockedBy; }
      else if (blockedBy) gateOut[gates[i].id].blocked_by = blockedBy;
    }
    var scen = arr(db.scenarios);
    for (i = 0; i < scen.length; i++) { var diff = scen[i].inputs_diff || {}; for (k in diff) if (Object.prototype.hasOwnProperty.call(diff, k) && /^actual_/.test(k)) f.push({ law: 'R10', id: scen[i].id, message: 'scenario changes ' + k }); }
    var alloc = arr(db.allocations), sums = {};
    for (i = 0; i < alloc.length; i++) sums[alloc[i].cost_line_id] = (sums[alloc[i].cost_line_id] || 0) + (+alloc[i].share_pct || 0);
    for (k in sums) if (Object.prototype.hasOwnProperty.call(sums, k) && Math.abs(sums[k] - 100) > 0.01) f.push({ law: 'R11', id: k, message: 'allocations sum to ' + sums[k] + ' %' });
    var obs = arr(db.observations);
    for (i = 0; i < obs.length; i++) { var o = obs[i]; if (!o.source_time || !o.received_time) f.push({ law: 'R13', id: o.id, message: 'missing source_time or received_time' }); if (o.cx_level !== undefined || o.level !== undefined) f.push({ law: 'R13', id: o.id, message: 'an observation carries a Cx level' }); }
    return { ok: f.length === 0, findings: f, gates: gateOut, accepted: accepted };
  }

  /* Tier 3 over Tier 1: per system, the actual accepted level (highest valid chain) over the planned one. */
  function overlay(status, db) {
    if (!status || !status.systems) return null;
    var v = validate(db), assets = arr(db && db.assets), maps = arr(db && db.mappings), mapped = {}, i, j;
    for (i = 0; i < maps.length; i++) mapped[maps[i].asset_id] = true;
    var rows = [];
    for (i = 0; i < status.systems.length; i++) {
      var s = status.systems[i], mine = [], counts = { none: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 }, blocked = 0, unmapped = 0;
      for (j = 0; j < assets.length; j++) if (assets[j].system_id === s.id) mine.push(assets[j]);
      for (j = 0; j < mine.length; j++) {
        var acc = v.accepted[mine[j].id] || {}, lvl = null;
        for (var n = 0; n < LEVELS.length; n++) { if (acc[LEVELS[n]] && v.gates[acc[LEVELS[n]].id].valid) lvl = LEVELS[n]; else break; }
        counts[lvl || 'none']++;
        if (!mapped[mine[j].id]) unmapped++;
        for (var gid in v.gates) if (Object.prototype.hasOwnProperty.call(v.gates, gid) && v.gates[gid].scope_id === mine[j].id && v.gates[gid].constraint === 'blocked') { blocked++; break; }
      }
      var actual = null; for (n = LEVELS.length - 1; n >= 0; n--) if (counts[LEVELS[n]] > 0) { actual = LEVELS[n]; break; }
      rows.push({ id: s.id, label: s.label, block: s.block, planned: s.level, tag: s.tag, next: s.next, inTest: s.inTest,
        assets: mine.length, actual: actual, counts: counts, blocked: blocked, unmapped: unmapped,
        modelNote: mine.length && unmapped ? 'Model not verified (' + unmapped + ' of ' + mine.length + ')' : null,
        denominator: mine.length ? counts[actual || 'none'] + ' of ' + mine.length + (actual ? ' ' + actual : ' untagged') : 'no register' });
    }
    return { month: status.month, systems: rows, findings: v.findings, ok: v.ok };
  }

  /* Asset register import (PRD v1.0 §30): header tag,class,system_id,location_id,rating; every rejected row carries its reason. */
  function importRegister(csv, systems) {
    var lines = String(csv || '').split(/\r?\n/), out = [], rejected = [], tags = {}, i;
    var ids = {}; for (i = 0; i < arr(systems).length; i++) ids[systems[i].id || systems[i]] = 1;
    if (!lines.length || lines[0].replace(/\s/g, '') !== 'tag,class,system_id,location_id,rating') return { assets: [], rejected: [{ line: 1, reason: 'header must be tag,class,system_id,location_id,rating' }] };
    for (i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var c = lines[i].split(','); if (c.length !== 5) { rejected.push({ line: i + 1, reason: 'expected 5 columns, got ' + c.length }); continue; }
      var tag = c[0].trim(), cls = c[1].trim(), sys = c[2].trim(), loc = c[3].trim(), rating = c[4].trim();
      if (!tag) { rejected.push({ line: i + 1, reason: 'empty tag' }); continue; }
      if (tags[tag]) { rejected.push({ line: i + 1, reason: 'duplicate tag ' + tag }); continue; }
      if (!ids[sys]) { rejected.push({ line: i + 1, reason: 'unknown system_id ' + sys }); continue; }
      if (!loc) { rejected.push({ line: i + 1, reason: 'missing location_id (parent)' }); continue; }
      tags[tag] = 1;
      out.push({ id: 'A-' + tag, tag: tag, class: cls, system_id: sys, location_id: loc, rating: rating, lifecycle: 'installed', revision: 1, source: { system: 'csv', line: i + 1 } });
    }
    return { assets: out, rejected: rejected };
  }

  var API = { LAWS: LAWS, LEVELS: LEVELS, DOMAINS: DOMAINS, validate: validate, overlay: overlay, importRegister: importRegister, version: '3.29.0' };
  root.RZCxRecords = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
