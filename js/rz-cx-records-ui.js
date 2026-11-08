/* rz-cx-records-ui.js — the Records panel of the Cx Analysis tab (Tier 3 vertical slice, TIER3_DISCOVERY.md §4):
 * loads a record set (default: data/cx/demo-records.json — demo records, not a project), validates it with
 * RZCxRecords against the owner PRD v1.0 invariants, overlays the ACTUAL accepted level per system on the Tier 1
 * plan status at the viewed month, and imports an asset register CSV with per-row reasons. Extension of
 * RZCxAnalysis (state + render hooks), like rz-cx-ext.js. ES5. */
(function (root, doc) {
  'use strict';
  var A, P, X, S, DB = null, LOADED = false, IMPORT = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function build() {
    var statusTable = $('cxAnStatusTable'); if (!statusTable || $('cxRecPanel')) return false;
    var after = statusTable; while (after && after.parentNode && !(after.className && /\bcx-an-panel\b/.test(after.className))) after = after.parentNode;
    if (!after || !after.parentNode) return false;
    var panel = doc.createElement('div'); panel.className = 'cx-an-panel'; panel.id = 'cxRecPanel';
    panel.innerHTML =
      '<div class="cx-an-panel-head"><h3>Records</h3><span class="cx-an-sub">Tier 3 slice · actual accepted levels from gate records with a signed approval (PRD v1.0 §13, §28, §40) laid over the planned status · <b>demo record set</b> (one hall, 10 CRAH), not a project · source: <a href="cx-handbook/02-commissioning-process-levels-roles.html#s02-6">handbook 02.6</a></span></div>' +
      '<div class="cx-an-counts" id="cxRecCounts" aria-live="polite"></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table cx-an-status" id="cxRecTable"><thead><tr><th>System</th><th>Planned (Tier 1)</th><th>Actual (records)</th><th>Denominator</th><th>Blocked</th><th>Model</th></tr></thead><tbody></tbody></table></div>' +
      '<div class="cx-an-panel-head"><h3 style="font-size:13px">Invariant findings</h3><span class="cx-an-sub" id="cxRecFindSub"></span></div><ul class="cx-an-sub" id="cxRecFindings" style="margin:0;padding-left:18px"></ul>' +
      '<div class="cx-an-panel-head"><h3 style="font-size:13px">Import asset register (CSV)</h3><span class="cx-an-sub">header <code>tag,class,system_id,location_id,rating</code> · every rejected row is listed with its reason (PRD v1.0 §30) · partial import is explicit</span></div>' +
      '<textarea id="cxRecCsv" class="cx-an-csv" rows="4" aria-label="Asset register CSV" placeholder="tag,class,system_id,location_id,rating\nCRAH-11,crah,crah,HALL-1,200 kW" style="width:100%;font:13px var(--rzt-mono);min-height:84px"></textarea>' +
      '<div class="cx-an-actions"><button type="button" class="tool-btn" id="cxRecImport">Validate rows</button><button type="button" class="tool-btn" id="cxRecApply" disabled>Add accepted rows to the demo set</button><span class="cx-an-sub" id="cxRecImportSub"></span></div>' +
      '<ul class="cx-an-sub" id="cxRecRejected" style="margin:0;padding-left:18px"></ul>';
    after.parentNode.insertBefore(panel, after.nextSibling);
    return true;
  }
  function load() {
    if (LOADED || !root.fetch) return;
    LOADED = true;
    root.fetch('data/cx/demo-records.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { DB = j; render(S.plan); }).catch(function () { DB = null; render(S.plan); });
  }
  function render(plan) {
    var tb = $('cxRecTable') && $('cxRecTable').getElementsByTagName('tbody')[0]; if (!tb) return;
    tb.innerHTML = '';
    if (!plan) { $('cxRecCounts').textContent = ''; return; }
    if (!DB) { $('cxRecCounts').textContent = LOADED ? 'record set not loaded — the planned status stands alone' : 'loading record set…'; $('cxRecFindings').innerHTML = ''; return; }
    var st = P.statusAt(plan, S.month), ov = X.overlay(st, DB); if (!ov) return;
    var withReg = ov.systems.filter(function (s) { return s.assets > 0; });
    $('cxRecCounts').innerHTML = '<span class="cx-an-count">systems with a register <b>' + withReg.length + ' of ' + ov.systems.length + '</b></span><span class="cx-an-count">assets <b>' + withReg.reduce(function (a, s) { return a + s.assets; }, 0) + '</b></span><span class="cx-an-count">blocked <b>' + withReg.reduce(function (a, s) { return a + s.blocked; }, 0) + '</b></span><span class="cx-an-count">month <b>M' + S.month + '</b></span>';
    for (var i = 0; i < ov.systems.length; i++) {
      var s = ov.systems[i], tr = doc.createElement('tr'); tr.setAttribute('data-cx-rec', s.id); if (!s.assets) tr.className = 'is-muted';
      tr.innerHTML = '<th scope="row">' + esc(s.label) + '</th><td>' + (s.planned || '—') + (s.inTest ? ' · ' + s.next + ' in test' : '') + '</td><td>' + (s.assets ? (s.actual || 'untagged') : '—') + '</td><td>' + esc(s.denominator) + '</td><td>' + (s.assets ? s.blocked : '—') + '</td><td>' + (s.modelNote ? esc(s.modelNote) : (s.assets ? 'mapped' : '—')) + '</td>';
      tb.appendChild(tr);
    }
    var f = ov.findings, ul = $('cxRecFindings'); ul.innerHTML = '';
    $('cxRecFindSub').textContent = f.length ? f.length + ' finding(s) — each names the law and the record' : '0 findings — every record in the set satisfies the ' + Object.keys(X.LAWS).length + ' invariants';
    for (var k = 0; k < f.length; k++) { var li = doc.createElement('li'); li.textContent = f[k].law + ' · ' + f[k].id + ' · ' + f[k].message + ' — ' + (X.LAWS[f[k].law] || ''); ul.appendChild(li); }
  }
  function validateCsv() {
    IMPORT = X.importRegister($('cxRecCsv').value, P.SYSTEMS);
    var ul = $('cxRecRejected'); ul.innerHTML = '';
    for (var i = 0; i < IMPORT.rejected.length; i++) { var li = doc.createElement('li'); li.textContent = 'line ' + IMPORT.rejected[i].line + ' — ' + IMPORT.rejected[i].reason; ul.appendChild(li); }
    $('cxRecImportSub').textContent = IMPORT.assets.length + ' row(s) accepted · ' + IMPORT.rejected.length + ' rejected';
    $('cxRecApply').disabled = !IMPORT.assets.length || !DB;
  }
  function applyCsv() {
    if (!IMPORT || !IMPORT.assets.length || !DB) return;
    var have = {}, i; for (i = 0; i < DB.assets.length; i++) have[DB.assets[i].tag] = 1;
    var added = 0, dup = 0, next = DB.assets.slice();
    for (i = 0; i < IMPORT.assets.length; i++) { if (have[IMPORT.assets[i].tag]) { dup++; continue; } next.push(IMPORT.assets[i]); added++; }
    DB = Object.assign({}, DB, { assets: next });                 /* a new set, the loaded one is not mutated */
    $('cxRecImportSub').textContent = added + ' added to the demo set (in this page only)' + (dup ? ' · ' + dup + ' already present' : '');
    $('cxRecApply').disabled = true; IMPORT = null;
    render(S.plan);
  }
  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; X = root.RZCxRecords;
    if (!A || !P || !X || !A.state) return;
    S = A.state;
    if (!build()) return;
    $('cxRecImport').addEventListener('click', validateCsv);
    $('cxRecApply').addEventListener('click', applyCsv);
    S.hooks.push(function (plan) { if (!LOADED) load(); render(plan); });
    root.RZCxRecordsUi = { render: render, db: function () { return DB; }, setDb: function (d) { DB = d; LOADED = true; render(S.plan); }, version: '3.29.0' };
    if (S.plan) { load(); render(S.plan); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
