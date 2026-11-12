/* rz-cx-workspace.js — PRD-P06 stage 1: a record workspace for a real project, kept in this browser.
 * DOM-free, ES5, dual-target (Node gate + browser). Depends on RZCxRecords (the laws are the authority).
 *
 *   RZCxWorkspace.store(storage, now)  -> { load(), save(ws), quarantined }        key rz_cx_records_v1
 *   RZCxWorkspace.emptyWorkspace()     -> { v:1, sets:{}, active:null }
 *   RZCxWorkspace.createSet(ws, {name, project_id, assets}) -> { ws, id }
 *   RZCxWorkspace.write(set, change)   -> { ok, set, findings, refused:[finding], flags:[finding] }
 *       every write: clone db -> change(db) -> validate -> refuse if it ADDS a refusal-law finding, else commit (rev+1)
 *   ops (each returns a change for write()): addAssets, addIssue, editIssue, closeIssue, decideGate, deleteAsset
 *   RZCxWorkspace.exportSet(set) / importSet(text) -> portable JSON; import lists findings, never auto-fixes
 *   RZCxWorkspace.findings(db)         -> validate() findings + R9 labels (asset without a model mapping)
 * Refusal laws R1 R2 R3 R4 R5 R6 R7 R11 block a write; flag laws R8 R9 R10 R13 annotate it (FR-P06-2).
 * Findings already present before a write (an imported invalid set) never refuse a later, unrelated write. */
(function (root) {
  'use strict';
  var KEY = 'rz_cx_records_v1', QKEY = 'rz_cx_records_v1_quarantine', FORMAT = 'rz-cx-records', CAP = 2097152, WARN = 1572864;
  var REFUSE = { R1: 1, R2: 1, R3: 1, R4: 1, R5: 1, R6: 1, R7: 1, R11: 1 }, FLAG = { R8: 1, R9: 1, R10: 1, R13: 1 };
  var TABLES = ['assets', 'ports', 'connections', 'mappings', 'gates', 'packs', 'attempts', 'steps', 'issues', 'approvals', 'cost_lines', 'allocations', 'observations', 'scenarios'];
  var SEVERITIES = ['critical', 'major', 'minor'], ISSUE_STATES = ['open', 'assigned', 'in_progress', 'ready_for_verification', 'reopened', 'closed'];
  function X() { return root.RZCxRecords || (typeof require === 'function' ? require('./rz-cx-records.js') : null); }
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function txt(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  function keyOf(f) { return f.law + '|' + f.id + '|' + f.message; }
  function emptyDb() { var d = { meta: { project_id: null } }; for (var i = 0; i < TABLES.length; i++) d[TABLES[i]] = []; return d; }
  function emptyWorkspace() { return { v: 1, sets: {}, active: null }; }

  function findings(db) {
    var v = X().validate(db), out = v.findings.slice(), maps = {}, i, a = arr(db && db.assets);
    for (i = 0; i < arr(db && db.mappings).length; i++) maps[db.mappings[i].asset_id] = 1;
    for (i = 0; i < a.length; i++) if (!maps[a[i].id]) out.push({ law: 'R9', id: a[i].id, message: 'Model not verified' });
    return { list: out, gates: v.gates, accepted: v.accepted };
  }

  /* the write pipeline (FR-P06-2) */
  function write(set, change) {
    var before = findings(set.db).list, had = {}, i;
    for (i = 0; i < before.length; i++) had[keyOf(before[i])] = 1;
    var db = clone(set.db), r;
    try { r = change(db); } catch (e) { return { ok: false, set: set, refused: [{ law: 'INPUT', id: '', message: String(e && e.message || e) }], flags: [], findings: before }; }
    if (r && r.refuse) return { ok: false, set: set, refused: [r.refuse], flags: [], findings: before };
    var after = findings(db).list, refused = [], flags = [];
    for (i = 0; i < after.length; i++) {
      if (had[keyOf(after[i])]) continue;
      if (REFUSE[after[i].law]) refused.push(after[i]); else if (FLAG[after[i].law]) flags.push(after[i]);
    }
    if (refused.length) return { ok: false, set: set, refused: refused, flags: flags, findings: before };
    var next = { name: set.name, project_id: set.project_id || null, db: db, rev: (set.rev || 0) + 1, updated_at: new Date().toISOString(), invalid: set.invalid ? after.filter(function (f) { return REFUSE[f.law]; }).length || 0 : 0 };
    return { ok: true, set: next, refused: [], flags: flags, findings: after };
  }

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function bump(rec) { rec.revision = (rec.revision || 1) + 1; return rec; }
  function gateId(assetId, level) { return 'G-' + assetId + '-' + level; }
  function hashOf(db, assetId, level) {
    var a = find(db.assets, assetId), g = find(db.gates, gateId(assetId, level));
    return 'h-' + fnv(JSON.stringify([a, g && g.revision || 0, level]));
  }
  function ensureGate(db, assetId, level) {
    var id = gateId(assetId, level), g = find(db.gates, id);
    if (!g) { g = { id: id, scope_id: assetId, level: level, workflow_state: 'open', result: null, constraint_state: 'clear', revision: 1 }; db.gates.push(g); }
    return g;
  }
  function syncConstraints(db) {
    var open = {}, i, j, ISSUE_OPEN = { open: 1, assigned: 1, in_progress: 1, ready_for_verification: 1, reopened: 1 };
    for (i = 0; i < db.issues.length; i++) if (ISSUE_OPEN[db.issues[i].state]) for (j = 0; j < arr(db.issues[i].blocking_gate_ids).length; j++) open[db.issues[i].blocking_gate_ids[j]] = 1;
    for (i = 0; i < db.gates.length; i++) { var want = open[db.gates[i].id] ? 'blocked' : 'clear'; if ((db.gates[i].constraint_state || 'clear') !== want) { db.gates[i].constraint_state = want; bump(db.gates[i]); } }
  }

  var ops = {
    addAssets: function (assets) {
      return function (db) { for (var i = 0; i < assets.length; i++) if (!find(db.assets, assets[i].id)) db.assets.push(clone(assets[i])); };
    },
    addIssue: function (f, now) {
      return function (db) {
        var title = txt(f.title, 120); if (!title) return { refuse: { law: 'INPUT', id: '', message: 'title is required' } };
        if (!find(db.assets, f.asset_id)) return { refuse: { law: 'INPUT', id: f.asset_id || '', message: 'asset not in this set' } };
        var sev = SEVERITIES.indexOf(f.severity) >= 0 ? f.severity : 'minor', n = db.issues.length + 1, id;
        do { id = 'ISS-' + ('000' + n).slice(-4); n++; } while (find(db.issues, id));
        var blocking = [];
        if (f.blocking) { var lvl = X().LEVELS.indexOf(f.level) >= 0 ? f.level : 'L3'; blocking.push(ensureGate(db, f.asset_id, lvl).id); }
        db.issues.push({ id: id, title: title, severity: sev, state: 'open', blocking_gate_ids: blocking, assets: [f.asset_id], owner: txt(f.owner, 60), raised_at: now || null, source: f.source || null, revision: 1 });
        syncConstraints(db);
      };
    },
    editIssue: function (id, f) {
      return function (db) {
        var is = find(db.issues, id); if (!is) return { refuse: { law: 'INPUT', id: id, message: 'issue not found' } };
        if (f.title !== undefined) { var t = txt(f.title, 120); if (!t) return { refuse: { law: 'INPUT', id: id, message: 'title is required' } }; is.title = t; }
        if (f.severity !== undefined && SEVERITIES.indexOf(f.severity) >= 0) is.severity = f.severity;
        if (f.owner !== undefined) is.owner = txt(f.owner, 60);
        if (f.state !== undefined && ISSUE_STATES.indexOf(f.state) >= 0) is.state = f.state;
        bump(is); syncConstraints(db);
      };
    },
    closeIssue: function (id) { return ops.editIssue(id, { state: 'closed' }); },
    /* accept or reject one gate level of one asset with the current revision hash (FR-P06-5) */
    decideGate: function (f, now) {
      return function (db) {
        if (!find(db.assets, f.asset_id)) return { refuse: { law: 'INPUT', id: f.asset_id || '', message: 'asset not in this set' } };
        if (X().LEVELS.indexOf(f.level) < 0 || (f.decision !== 'accept' && f.decision !== 'reject')) return { refuse: { law: 'INPUT', id: f.asset_id, message: 'level L1–L5 and accept/reject required' } };
        var signer = txt(f.signer, 60); if (!signer) return { refuse: { law: 'INPUT', id: f.asset_id, message: 'signer name is required' } };
        var g = ensureGate(db, f.asset_id, f.level);
        if (f.decision === 'accept' && g.constraint_state === 'blocked') {
          var by = ''; for (var i = 0; i < db.issues.length; i++) if (db.issues[i].state !== 'closed' && arr(db.issues[i].blocking_gate_ids).indexOf(g.id) >= 0) by = db.issues[i].id;
          return { refuse: { law: 'R8', id: g.id, message: 'open blocking issue ' + by + ' on ' + f.level + ' of ' + f.asset_id } };
        }
        var h = hashOf(db, f.asset_id, f.level);
        g.workflow_state = f.decision === 'accept' ? 'accepted' : 'rejected'; g.result = f.decision === 'accept' ? 'pass' : 'fail';
        g.revision_hash = h; g.accepted_at = f.decision === 'accept' ? now || null : null; bump(g);
        var n = 1, aid; do { aid = 'AD-' + g.id + '-' + n; n++; } while (find(db.approvals, aid));
        db.approvals.push({ id: aid, entity: 'gate', entity_id: g.id, decision: f.decision, signer: signer, self_declared: true, signed_at: now || null, revision_hash: h, revision: 1 });
      };
    },
    /* deleting an asset other records point to is refused with the references (PRD §17) */
    deleteAsset: function (assetId) {
      return function (db) {
        var refs = [], i;
        for (i = 0; i < db.ports.length; i++) if (db.ports[i].asset_id === assetId) refs.push(db.ports[i].id);
        for (i = 0; i < db.gates.length; i++) if (db.gates[i].scope_id === assetId) refs.push(db.gates[i].id);
        for (i = 0; i < db.mappings.length; i++) if (db.mappings[i].asset_id === assetId) refs.push(db.mappings[i].id);
        for (i = 0; i < db.issues.length; i++) if (arr(db.issues[i].assets).indexOf(assetId) >= 0) refs.push(db.issues[i].id);
        if (refs.length) return { refuse: { law: 'REF', id: assetId, message: 'referenced by ' + refs.join(', ') } };
        db.assets = db.assets.filter(function (a) { return a.id !== assetId; });
      };
    }
  };

  function newId(ws) { var n = 1, id; do { id = 'set-' + n; n++; } while (ws.sets[id]); return id; }
  function createSet(ws, f) {
    var next = clone(ws), id = newId(next), db = emptyDb();
    db.meta.project_id = f.project_id || null;
    db.assets = clone(arr(f.assets));
    next.sets[id] = { name: txt(f.name, 120) || 'Record set', project_id: f.project_id || null, db: db, rev: 1, updated_at: new Date().toISOString(), invalid: 0 };
    next.active = id;
    return { ws: next, id: id };
  }

  function exportSet(set) {
    return JSON.stringify({ format: FORMAT, v: 1, laws: Object.keys(X().LAWS), name: set.name, project_id: set.project_id || null, rev: set.rev, db: set.db }, null, 1);
  }
  /* parse + schema + laws; never auto-fixes. ok=false only for a file that is not a record set at all */
  function importSet(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return { ok: false, reason: 'not JSON' }; }
    if (!o || o.format !== FORMAT || o.v !== 1 || !o.db || typeof o.db !== 'object') return { ok: false, reason: 'not an rz-cx-records v1 file' };
    var db = emptyDb(), bad = [];
    db.meta = o.db.meta && typeof o.db.meta === 'object' ? o.db.meta : db.meta;
    for (var i = 0; i < TABLES.length; i++) { var t = o.db[TABLES[i]]; if (t === undefined) continue; if (Object.prototype.toString.call(t) !== '[object Array]') bad.push(TABLES[i]); else db[TABLES[i]] = t; }
    if (bad.length) return { ok: false, reason: 'not a list: ' + bad.join(', ') };
    var f = findings(db).list, lawsNow = Object.keys(X().LAWS).join(','), lawsFile = arr(o.laws).join(',');
    var refusals = f.filter(function (x) { return REFUSE[x.law]; }).length;
    return { ok: true, set: { name: txt(o.name, 120) || 'Imported set', project_id: o.project_id ? txt(o.project_id, 64) : null, db: db, rev: Math.max(1, Math.floor(+o.rev) || 1), updated_at: new Date().toISOString(), invalid: refusals }, findings: f, lawsDiffer: !!lawsFile && lawsFile !== lawsNow };
  }

  function store(storage) {
    var api = { quarantined: false, size: 0 };
    api.load = function () {
      var raw = null; try { raw = storage.getItem(KEY); } catch (e) { return emptyWorkspace(); }
      if (!raw) return emptyWorkspace();
      try {
        var o = JSON.parse(raw);
        if (!o || o.v !== 1 || !o.sets || typeof o.sets !== 'object') throw new Error('shape');
        for (var k in o.sets) if (Object.prototype.hasOwnProperty.call(o.sets, k) && (!o.sets[k] || !o.sets[k].db)) throw new Error('set ' + k);
        if (o.active && !o.sets[o.active]) o.active = null;
        api.size = raw.length; return o;
      } catch (e) {
        try { storage.setItem(QKEY, raw); storage.removeItem(KEY); } catch (e2) { /* storage gone: the in-memory empty set still works */ }
        api.quarantined = true; return emptyWorkspace();
      }
    };
    /* {ok, size, warn} — over the cap nothing is written and the caller offers Export */
    api.save = function (ws) {
      var s = JSON.stringify(ws);
      if (s.length > CAP) return { ok: false, code: 'CAP', size: s.length };
      try { storage.setItem(KEY, s); } catch (e) { return { ok: false, code: 'STORAGE', size: s.length }; }
      api.size = s.length; return { ok: true, size: s.length, warn: s.length > WARN };
    };
    return api;
  }

  var API = { KEY: KEY, QKEY: QKEY, CAP: CAP, WARN: WARN, REFUSE: REFUSE, FLAG: FLAG, TABLES: TABLES, SEVERITIES: SEVERITIES,
    emptyWorkspace: emptyWorkspace, emptyDb: emptyDb, createSet: createSet, write: write, ops: ops, findings: findings,
    exportSet: exportSet, importSet: importSet, store: store, gateId: gateId, hashOf: hashOf, version: '3.50.0' };
  root.RZCxWorkspace = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
