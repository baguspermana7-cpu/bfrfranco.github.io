/* rz-cx-records-ui.js — the Records panel of the Cx Analysis tab (Tier 3, TIER3_DISCOVERY.md §4; PRD-P06 stage 1).
 * Workspace: Demo (data/cx/demo-records.json, read-only) or one of My records (local sets in localStorage
 * rz_cx_records_v1 through RZCxWorkspace). Every write goes clone → change → RZCxRecords.validate → commit or refuse
 * (refusal laws R1–R7, R11; flag laws R8–R10, R13). The overlay shows the ACTUAL accepted level per system over the
 * Tier 1 plan status at the viewed month. Text from a set is written with textContent. ES5. */
(function (root, doc) {
  'use strict';
  var A, P, X, Wk, S, DEMO = null, LOADED = false, IMPORT = null, WS = null, ST = null, UNDO = null, DLG = null;
  var MODE = 'demo';                                         /* 'demo' | <set id> */
  function $(id) { return doc.getElementById(id); }
  function el(tag, attrs, text) { var e = doc.createElement(tag); for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function list(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function setNow() { return MODE !== 'demo' && WS && WS.sets[MODE] ? WS.sets[MODE] : null; }
  function db() { var s = setNow(); return s ? s.db : DEMO; }
  function say(msg, tone) { var n = $('cxRecStatus'); if (!n) return; n.textContent = msg || ''; n.setAttribute('data-tone', tone || ''); }
  function build() {
    var statusTable = $('cxAnStatusTable'); if (!statusTable || $('cxRecPanel')) return false;
    var after = statusTable; while (after && after.parentNode && !(after.className && /\bcx-an-panel\b/.test(after.className))) after = after.parentNode;
    if (!after || !after.parentNode) return false;
    var panel = doc.createElement('div'); panel.className = 'cx-an-panel'; panel.id = 'cxRecPanel';
    panel.innerHTML =
      '<div class="cx-an-panel-head"><h3>Records</h3><span class="cx-an-sub" title="Actual accepted levels come from gate records with a signed approval (PRD v1.0 §13, §28, §40), laid over the planned status. Source: Cx handbook 02.6.">actual vs planned · <a href="cx-handbook/02-commissioning-process-levels-roles.html#s02-6">handbook 02.6</a></span></div>' +
      '<div class="cx-rec-ws" id="cxRecWs">' +
        '<div class="cx-rec-seg" role="group" aria-label="Record workspace">' +
          '<button type="button" class="tool-btn" id="cxRecDemo" aria-pressed="true" title="Demo records: one hall, 10 CRAH. Not a project.">Demo</button>' +
          '<select id="cxRecSet" aria-label="My record sets" title="Record sets kept in this browser"></select>' +
          '<label class="tool-btn" for="cxRecFile" title="Import a record set exported from this page (.json)">Import file</label><input type="file" id="cxRecFile" accept=".json,application/json" hidden>' +
        '</div>' +
        '<span class="cx-rec-chip" id="cxRecChip"></span>' +
        '<button type="button" class="tool-btn" id="cxRecStart" title="Demo is read-only · start your own set">Start your own set</button>' +
      '</div>' +
      '<div class="cx-an-actions" id="cxRecTools" hidden>' +
        '<button type="button" class="tool-btn" id="cxRecNewIssue">New issue</button>' +
        '<button type="button" class="tool-btn" id="cxRecGate" title="Accept or reject one gate level with the current revision hash">Gate decision</button>' +
        '<button type="button" class="tool-btn" id="cxRecExport" title="Download this set as JSON — the only backup: the set is kept in this browser">Export</button>' +
        '<button type="button" class="tool-btn" id="cxRecUndo" disabled title="Undo the last write">Undo</button>' +
        '<button type="button" class="tool-btn" id="cxRecDelSet" title="Remove this set from this browser">Delete set</button>' +
      '</div>' +
      '<p class="cx-an-sub cx-rec-status" id="cxRecStatus" role="status" aria-live="polite"></p>' +
      '<div class="cx-an-counts" id="cxRecCounts" aria-live="polite"></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table cx-an-status" id="cxRecTable"><thead><tr><th>System</th><th>Planned (Tier 1)</th><th>Actual (records)</th><th>Denominator</th><th>Blocked</th><th>Model</th></tr></thead><tbody></tbody></table></div>' +
      '<div id="cxRecIssueWrap" hidden><div class="cx-an-panel-head"><h3 style="font-size:13px">Issues</h3></div>' +
        '<div class="cx-an-tablewrap"><table class="cx-an-table" id="cxRecIssues"><thead><tr><th>ID</th><th>Title</th><th>Asset</th><th>Severity</th><th>State</th><th>Blocks</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody></tbody></table></div></div>' +
      '<div class="cx-an-panel-head"><h3 style="font-size:13px">Invariant findings</h3><span class="cx-an-sub" id="cxRecFindSub"></span></div><div class="cx-rec-lawcounts" id="cxRecLawCounts"></div><ul class="cx-an-sub" id="cxRecFindings" style="margin:0;padding-left:18px"></ul>' +
      '<div class="cx-an-panel-head"><h3 style="font-size:13px">Import asset register (CSV)</h3><span class="cx-an-sub" title="Every rejected row is listed with its reason (PRD v1.0 §30); a partial import is explicit."><code>tag,class,system_id,location_id,rating</code></span></div>' +
      '<textarea id="cxRecCsv" class="cx-an-csv" rows="4" aria-label="Asset register CSV" placeholder="tag,class,system_id,location_id,rating\nCRAH-11,crah,crah,HALL-1,200 kW" style="width:100%;font:16px var(--rzt-mono);min-height:84px"></textarea>' +
      '<div class="cx-an-actions"><button type="button" class="tool-btn" id="cxRecImport">Validate rows</button><button type="button" class="tool-btn" id="cxRecApply" disabled>Start a set with these rows</button><span class="cx-an-sub" id="cxRecImportSub"></span></div>' +
      '<ul class="cx-an-sub" id="cxRecRejected" style="margin:0;padding-left:18px"></ul>';
    after.parentNode.insertBefore(panel, after.nextSibling);
    DLG = el('dialog', { 'class': 'cx-dt cx-rec-dlg', id: 'cxRecDlg', 'aria-labelledby': 'cxRecDlgTitle' });
    doc.body.appendChild(DLG);
    return true;
  }
  function load() {
    if (LOADED || !root.fetch) return;
    LOADED = true;
    root.fetch('data/cx/demo-records.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { DEMO = j; render(S.plan); }).catch(function () { DEMO = null; render(S.plan); });
  }

  /* ── workspace chrome ── */
  function renderWs() {
    var sel = $('cxRecSet'), ids = WS ? Object.keys(WS.sets) : [], i;
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '' }, ids.length ? 'My records…' : 'My records'));
    for (i = 0; i < ids.length; i++) sel.appendChild(el('option', { value: ids[i] }, WS.sets[ids[i]].name));
    sel.appendChild(el('option', { value: '__new' }, '+ New set'));
    sel.value = MODE === 'demo' ? '' : MODE;
    $('cxRecDemo').setAttribute('aria-pressed', MODE === 'demo' ? 'true' : 'false');
    var s = setNow(), chip = $('cxRecChip');
    $('cxRecTools').hidden = !s; $('cxRecStart').hidden = !!s; $('cxRecIssueWrap').hidden = !s;
    $('cxRecUndo').disabled = !(UNDO && UNDO.id === MODE);
    $('cxRecApply').textContent = s ? 'Add accepted rows to this set' : 'Start a set with these rows';
    if (!s) { chip.textContent = 'read-only'; chip.title = 'Demo is read-only · start your own set'; chip.removeAttribute('data-tone'); }
    else if (s.invalid) { chip.textContent = 'invalid · ' + s.invalid; chip.title = 'Imported with ' + s.invalid + ' refusal-law finding(s). New writes are still checked; existing findings stay listed below.'; chip.setAttribute('data-tone', 'fault'); }
    else { chip.textContent = 'local · rev ' + s.rev; chip.title = 'Kept in this browser only — Export to back it up or move it. Revision ' + s.rev + (s.project_id ? ' · linked to project ' + s.project_id : ''); chip.removeAttribute('data-tone'); }
  }
  function persist(next, prevSet) {
    var copy = JSON.parse(JSON.stringify(WS)); copy.sets[MODE] = next; copy.active = MODE;
    var r = ST.save(copy);
    if (!r.ok) { say(r.code === 'CAP' ? 'Over the 2 MB limit — nothing saved. Export the set.' : 'Browser storage full — nothing saved. Export the set.', 'fault'); return false; }
    UNDO = prevSet ? { id: MODE, set: prevSet } : null; WS = copy;
    if (r.warn) say('Set is over 1.5 MB — export a backup.', 'warn');
    return true;
  }
  /* the only write path: RZCxWorkspace.write → persist; a refusal carries the law id and text */
  function commit(change, okMsg) {
    var s = setNow(); if (!s) return { ok: false };
    var r = Wk.write(s, change);
    if (!r.ok) return r;
    if (!persist(r.set, s)) return { ok: false, refused: [{ law: 'STORAGE', message: 'not saved' }] };
    var fl = r.flags.length ? ' · flagged ' + r.flags.map(function (f) { return f.law; }).join(', ') : '';
    say((okMsg || 'Saved') + ' · rev ' + r.set.rev + fl, r.flags.length ? 'warn' : '');
    renderWs(); render(S.plan);
    return r;
  }
  function refusalText(f) { return f.law + ': ' + f.message + (X.LAWS[f.law] ? ' — ' + X.LAWS[f.law] : ''); }
  function select(id) {
    MODE = id && WS.sets[id] ? id : 'demo';
    if (MODE !== 'demo') { WS.active = MODE; ST.save(WS); }
    say(''); renderWs(); render(S.plan);
  }
  function linkedProject() {
    try { var o = JSON.parse(root.localStorage.getItem('rz_projects_v1') || 'null'); if (o && o.active && o.projects && o.projects[o.active]) return { id: o.active, name: o.projects[o.active].name }; } catch (e) { /* no project store */ }
    return null;
  }
  function createSet(name, assets, projectId) {
    var c = Wk.createSet(WS, { name: name, project_id: projectId || null, assets: assets || [] }), r = ST.save(c.ws);
    if (!r.ok) { say('Browser storage full — set not created.', 'fault'); return null; }
    WS = c.ws; UNDO = null; select(c.id); return c.id;
  }

  /* ── dialogs (native <dialog>: focus trapped, Escape closes, focus returns to the opener) ── */
  function field(form, label, input, hint) {
    var id = 'cxRecF' + form.querySelectorAll('.cx-rec-field').length, wrap = el('div', { 'class': 'cx-rec-field' });
    input.id = id; var l = el('label', { 'for': id }, label); if (input.required) l.appendChild(el('span', { 'class': 'cx-rec-req', 'aria-hidden': 'true' }, ' *'));
    wrap.appendChild(l); wrap.appendChild(input); if (hint) { input.title = hint; } form.appendChild(wrap); return input;
  }
  function selectOf(opts, value) { var s = el('select'); for (var i = 0; i < opts.length; i++) { var o = el('option', { value: opts[i][0] }, opts[i][1]); s.appendChild(o); } if (value !== undefined) s.value = value; return s; }
  function openDlg(title, build, submit, label) {
    var opener = doc.activeElement;
    DLG.innerHTML = '';
    var head = el('div', { 'class': 'cx-dt-head' }); head.appendChild(el('h2', { id: 'cxRecDlgTitle' }, title));
    var x = el('button', { type: 'button', 'class': 'cx-dt-close', 'aria-label': 'Close' }, '×'); head.appendChild(x); DLG.appendChild(head);
    var form = el('form', { method: 'dialog', 'class': 'cx-rec-form', novalidate: '' }); DLG.appendChild(form);
    build(form);
    var err = el('p', { 'class': 'cx-rec-err', role: 'alert', id: 'cxRecDlgErr' }); form.appendChild(err);
    var act = el('div', { 'class': 'cx-an-actions' }), ok = el('button', { type: 'submit', 'class': 'tool-btn is-primary', id: 'cxRecDlgOk' }, label || 'Save'), cancel = el('button', { type: 'button', 'class': 'tool-btn' }, 'Cancel');
    act.appendChild(ok); act.appendChild(cancel); form.appendChild(act);
    function close() { if (DLG.open) DLG.close(); }
    x.onclick = close; cancel.onclick = close;
    DLG.onclose = function () { if (opener && opener.focus) opener.focus(); };
    form.onsubmit = function (e) {
      e.preventDefault(); err.textContent = '';
      var req = form.querySelectorAll('[required]');
      for (var i = 0; i < req.length; i++) if (!String(req[i].value).trim()) { err.textContent = req[i].labels && req[i].labels[0] ? req[i].labels[0].textContent.replace(' *', '') + ' is required' : 'Required field missing'; req[i].focus(); return; }
      var r = submit(form);
      if (r && r.ok === false) { err.textContent = r.refused && r.refused.length ? refusalText(r.refused[0]) : (r.message || 'Not saved'); return; }
      close();
    };
    if (DLG.showModal) DLG.showModal(); else DLG.setAttribute('open', '');
    var first = form.querySelector('input, select, textarea'); if (first) first.focus();
  }
  function assetOpts(d) { var o = [], a = list(d.assets); for (var i = 0; i < a.length; i++) if (a[i] && typeof a[i].id === 'string') o.push([a[i].id, String(a[i].tag || a[i].id)]); return o; }
  function issueDlg(issue) {
    var d = db(); if (!d || !(d.assets || []).length) { say('Import an asset register first — an issue needs an asset.', 'warn'); return; }
    var f = {};
    openDlg(issue ? 'Edit ' + issue.id : 'New issue', function (form) {
      f.title = field(form, 'Title', el('input', { type: 'text', maxlength: '120', required: '' })); if (issue) f.title.value = issue.title;
      if (!issue) f.asset = field(form, 'Asset', selectOf(assetOpts(d)));
      f.sev = field(form, 'Severity', selectOf([['critical', 'Critical'], ['major', 'Major'], ['minor', 'Minor']], issue ? issue.severity : 'major'));
      if (!issue) {
        var row = el('div', { 'class': 'cx-rec-field cx-rec-inline' }); f.block = el('input', { type: 'checkbox', id: 'cxRecFBlock' });
        var bl = el('label', { 'for': 'cxRecFBlock', title: 'R8: an open blocking issue sets that gate\'s constraint to blocked' }, 'Blocks gate'); row.appendChild(f.block); row.appendChild(bl);
        f.level = selectOf([['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3'], ['L4', 'L4'], ['L5', 'L5']], 'L3'); f.level.id = 'cxRecFLevel'; f.level.setAttribute('aria-label', 'Blocked gate level'); row.appendChild(f.level); form.appendChild(row);
      } else f.state = field(form, 'State', selectOf([['open', 'Open'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['ready_for_verification', 'Ready for verification'], ['reopened', 'Reopened'], ['closed', 'Closed']], issue.state));
      f.owner = field(form, 'Owner', el('input', { type: 'text', maxlength: '60' }), 'Free text — not an authenticated identity'); if (issue) f.owner.value = issue.owner || '';
    }, function () {
      if (issue) return commit(Wk.ops.editIssue(issue.id, { title: f.title.value, severity: f.sev.value, owner: f.owner.value, state: f.state.value }), 'Issue ' + issue.id + ' saved');
      return commit(Wk.ops.addIssue({ title: f.title.value, asset_id: f.asset.value, severity: f.sev.value, blocking: f.block.checked, level: f.level.value, owner: f.owner.value }, new Date().toISOString()), 'Issue added');
    }, issue ? 'Save' : 'Add issue');
  }
  function gateDlg() {
    var d = db(); if (!d || !(d.assets || []).length) { say('Import an asset register first — a gate belongs to an asset.', 'warn'); return; }
    var f = {};
    openDlg('Gate decision', function (form) {
      f.asset = field(form, 'Asset', selectOf(assetOpts(d)));
      f.level = field(form, 'Level', selectOf([['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3'], ['L4', 'L4'], ['L5', 'L5']], 'L1'));
      f.dec = field(form, 'Decision', selectOf([['accept', 'Accept'], ['reject', 'Reject']], 'accept'));
      f.signer = field(form, 'Signer', el('input', { type: 'text', maxlength: '60', required: '' }), 'Self-declared name — not an authenticated identity');
      f.hash = field(form, 'Revision hash', el('input', { type: 'text', readonly: '' }), 'The decision is bound to this hash (R3): a later change to the asset or gate makes it stale');
      function upd() { f.hash.value = Wk.hashOf(setNow().db, f.asset.value, f.level.value); }
      f.asset.onchange = upd; f.level.onchange = upd; upd();
    }, function () {
      return commit(Wk.ops.decideGate({ asset_id: f.asset.value, level: f.level.value, decision: f.dec.value, signer: f.signer.value }, new Date().toISOString()), f.level.value + ' ' + (f.dec.value === 'accept' ? 'accepted' : 'rejected'));
    }, 'Record decision');
  }
  function newSetDlg(seedAssets) {
    var f = {}, proj = linkedProject();
    openDlg('New record set', function (form) {
      f.name = field(form, 'Name', el('input', { type: 'text', maxlength: '120', required: '' }));
      if (proj) { var row = el('div', { 'class': 'cx-rec-field cx-rec-inline' }); f.link = el('input', { type: 'checkbox', id: 'cxRecFLink', checked: '' }); row.appendChild(f.link); row.appendChild(el('label', { 'for': 'cxRecFLink' }, 'Link project ' + proj.name)); form.appendChild(row); }
      if (seedAssets) form.appendChild(el('p', { 'class': 'cx-an-sub' }, seedAssets.length + ' asset(s) from the register'));
    }, function () {
      var id = createSet(f.name.value, seedAssets || [], proj && f.link && f.link.checked ? proj.id : null);
      if (!id) return { ok: false, message: 'Browser storage full' };
      say('Set created' + (seedAssets ? ' with ' + seedAssets.length + ' asset(s)' : '') + ' · kept in this browser');
      return { ok: true };
    }, 'Create');
  }

  /* ── render ── */
  function render(plan) {
    var tb = $('cxRecTable') && $('cxRecTable').getElementsByTagName('tbody')[0]; if (!tb) return;
    tb.innerHTML = '';
    var d = db();
    if (!plan) { $('cxRecCounts').textContent = ''; return; }
    if (!d) { $('cxRecCounts').textContent = LOADED || MODE !== 'demo' ? 'record set not loaded — the planned status stands alone' : 'loading record set…'; $('cxRecFindings').innerHTML = ''; return; }
    var st = P.statusAt(plan, S.month), ov = X.overlay(st, d); if (!ov) return;
    var withReg = ov.systems.filter(function (s) { return s.assets > 0; });
    $('cxRecCounts').innerHTML = '<span class="cx-an-count">systems with a register <b>' + withReg.length + ' of ' + ov.systems.length + '</b></span><span class="cx-an-count">assets <b>' + withReg.reduce(function (a, s) { return a + s.assets; }, 0) + '</b></span><span class="cx-an-count">blocked <b>' + withReg.reduce(function (a, s) { return a + s.blocked; }, 0) + '</b></span><span class="cx-an-count">month <b>M' + S.month + '</b></span>';
    for (var i = 0; i < ov.systems.length; i++) {
      var s = ov.systems[i], tr = doc.createElement('tr'); tr.setAttribute('data-cx-rec', s.id); if (!s.assets) tr.className = 'is-muted';
      tr.innerHTML = '<th scope="row">' + esc(s.label) + '</th><td>' + (s.planned || '—') + (s.inTest ? ' · ' + s.next + ' in test' : '') + '</td><td>' + (s.assets ? (s.actual || 'untagged') : '—') + '</td><td>' + esc(s.denominator) + '</td><td>' + (s.assets ? s.blocked : '—') + '</td><td>' + (s.modelNote ? esc(s.modelNote) : (s.assets ? 'mapped' : '—')) + '</td>';
      tb.appendChild(tr);
    }
    renderIssues(d);
    var f = ov.findings, ul = $('cxRecFindings'), lc = $('cxRecLawCounts'), per = {}, k; ul.innerHTML = ''; lc.innerHTML = '';
    $('cxRecFindSub').textContent = f.length ? f.length + ' finding(s)' : '0 findings — every record in the set satisfies the ' + Object.keys(X.LAWS).length + ' invariants';
    $('cxRecFindSub').title = f.length ? 'Each finding names the law and the record' : '';
    for (k = 0; k < f.length; k++) {
      per[f[k].law] = (per[f[k].law] || 0) + 1;
      var li = doc.createElement('li'), target = $('cxRecIss-' + f[k].id);
      if (target) { var a = el('a', { href: '#cxRecIss-' + f[k].id }, f[k].id); li.appendChild(doc.createTextNode(f[k].law + ' · ')); li.appendChild(a); li.appendChild(doc.createTextNode(' · ' + f[k].message)); }
      else li.textContent = f[k].law + ' · ' + f[k].id + ' · ' + f[k].message;
      li.title = X.LAWS[f[k].law] || ''; ul.appendChild(li);
    }
    for (k in per) if (Object.prototype.hasOwnProperty.call(per, k)) lc.appendChild(el('span', { 'class': 'cx-an-count', title: X.LAWS[k] || '' }, k + ' ' + per[k]));
  }
  function renderIssues(d) {
    var tb = $('cxRecIssues').getElementsByTagName('tbody')[0]; tb.innerHTML = '';
    if (MODE === 'demo') return;
    var is = d.issues || [], tags = {}, i; for (i = 0; i < (d.assets || []).length; i++) tags[d.assets[i].id] = d.assets[i].tag;
    if (!is.length) { var tr0 = el('tr'); var td0 = el('td', { colspan: '7', 'class': 'cx-an-sub' }, 'No issues'); tr0.appendChild(td0); tb.appendChild(tr0); return; }
    for (i = 0; i < is.length; i++) {
      var x = is[i] || {}, tr = el('tr', { id: 'cxRecIss-' + x.id, 'data-state': String(x.state) });
      tr.appendChild(el('th', { scope: 'row' }, String(x.id))); tr.appendChild(el('td', {}, String(x.title == null ? '' : x.title)));
      tr.appendChild(el('td', {}, list(x.assets).map(function (a) { return tags[a] || String(a); }).join(', ')));
      tr.appendChild(el('td', {}, String(x.severity || '—'))); tr.appendChild(el('td', {}, String(x.state).replace(/_/g, ' ')));
      tr.appendChild(el('td', {}, list(x.blocking_gate_ids).map(function (g) { return String(g).replace(/^G-A?-?/, ''); }).join(', ') || '—'));
      var act = el('td', { 'class': 'cx-rec-rowact' });
      var eb = el('button', { type: 'button', 'class': 'tool-btn', 'data-act': 'edit', 'data-id': x.id, 'aria-label': 'Edit ' + x.id }, 'Edit'); act.appendChild(eb);
      if (x.state !== 'closed') act.appendChild(el('button', { type: 'button', 'class': 'tool-btn', 'data-act': 'close', 'data-id': x.id, 'aria-label': 'Close ' + x.id }, 'Close'));
      tr.appendChild(act); tb.appendChild(tr);
    }
  }

  /* ── CSV register ── */
  function validateCsv() {
    IMPORT = X.importRegister($('cxRecCsv').value, P.SYSTEMS);
    var ul = $('cxRecRejected'); ul.innerHTML = '';
    for (var i = 0; i < IMPORT.rejected.length; i++) { var li = doc.createElement('li'); li.textContent = 'line ' + IMPORT.rejected[i].line + ' — ' + IMPORT.rejected[i].reason; ul.appendChild(li); }
    $('cxRecImportSub').textContent = IMPORT.assets.length + ' row(s) accepted · ' + IMPORT.rejected.length + ' rejected';
    $('cxRecApply').disabled = !IMPORT.assets.length;
  }
  function applyCsv() {
    if (!IMPORT || !IMPORT.assets.length) return;
    var rows = IMPORT.assets, s = setNow();
    if (!s) { newSetDlg(rows); IMPORT = null; $('cxRecApply').disabled = true; return; }
    var have = {}, i, add = []; for (i = 0; i < s.db.assets.length; i++) have[s.db.assets[i].tag] = 1;
    for (i = 0; i < rows.length; i++) if (!have[rows[i].tag]) add.push(rows[i]);
    var r = commit(Wk.ops.addAssets(add), add.length + ' added' + (rows.length - add.length ? ' · ' + (rows.length - add.length) + ' already present' : ''));
    $('cxRecImportSub').textContent = r.ok ? add.length + ' added to ' + s.name : refusalText(r.refused[0]);
    $('cxRecApply').disabled = true; IMPORT = null;
  }

  /* ── file import / export ── */
  function exportSet() {
    var s = setNow(); if (!s) return;
    var blob = new Blob([Wk.exportSet(s)], { type: 'application/json' }), a = el('a', { href: URL.createObjectURL(blob), download: s.name.replace(/[^\w.-]+/g, '-').slice(0, 60) + '.cx-records.json' });
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    say('Exported rev ' + s.rev);
  }
  function importText(text) {
    var r = Wk.importSet(text);
    if (!r.ok) { say('Not imported — ' + r.reason, 'fault'); return; }
    var c = Wk.createSet(WS, { name: r.set.name, project_id: r.set.project_id });
    c.ws.sets[c.id] = r.set;
    var sv = ST.save(c.ws); if (!sv.ok) { say('Browser storage full — not imported.', 'fault'); return; }
    WS = c.ws; UNDO = null; select(c.id);
    var n = r.findings.filter(function (f) { return Wk.REFUSE[f.law]; }).length;
    say(n ? 'Imported as invalid set (' + n + ' finding' + (n > 1 ? 's' : '') + ')' + (r.lawsDiffer ? ' · different law version' : '') : 'Imported · ' + r.findings.length + ' flag(s)' + (r.lawsDiffer ? ' · different law version' : ''), n ? 'fault' : '');
  }
  function onFile() {
    var file = $('cxRecFile').files && $('cxRecFile').files[0]; if (!file) return;
    if (file.size > Wk.CAP) { say('File over 2 MB — not imported.', 'fault'); $('cxRecFile').value = ''; return; }
    var fr = new FileReader(); fr.onload = function () { importText(String(fr.result)); $('cxRecFile').value = ''; }; fr.readAsText(file);
  }

  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; X = root.RZCxRecords; Wk = root.RZCxWorkspace;
    if (!A || !P || !X || !Wk || !A.state) return;
    S = A.state;
    if (!build()) return;
    var storage = null; try { storage = root.localStorage; } catch (e) { storage = null; }
    ST = Wk.store(storage || { getItem: function () { return null; }, setItem: function () { throw new Error('no storage'); }, removeItem: function () {} });
    WS = ST.load();
    if (WS.active && WS.sets[WS.active]) MODE = WS.active;
    $('cxRecImport').addEventListener('click', validateCsv);
    $('cxRecApply').addEventListener('click', applyCsv);
    $('cxRecDemo').addEventListener('click', function () { MODE = 'demo'; WS.active = null; ST.save(WS); say(''); renderWs(); render(S.plan); });
    $('cxRecSet').addEventListener('change', function () { var v = this.value; if (v === '__new') { this.value = MODE === 'demo' ? '' : MODE; newSetDlg(null); } else if (v) select(v); });
    $('cxRecStart').addEventListener('click', function () { newSetDlg(null); });
    $('cxRecFile').addEventListener('change', onFile);
    $('cxRecNewIssue').addEventListener('click', function () { issueDlg(null); });
    $('cxRecGate').addEventListener('click', gateDlg);
    $('cxRecExport').addEventListener('click', exportSet);
    $('cxRecUndo').addEventListener('click', function () {
      if (!UNDO || UNDO.id !== MODE) return;
      var prev = UNDO.set; UNDO = null;
      var copy = JSON.parse(JSON.stringify(WS)); copy.sets[MODE] = prev;
      if (ST.save(copy).ok) { WS = copy; say('Undone · rev ' + prev.rev); renderWs(); render(S.plan); }
    });
    $('cxRecDelSet').addEventListener('click', function () {
      var s = setNow(); if (!s) return;
      var b = this; if (b.getAttribute('data-confirm') !== '1') { b.setAttribute('data-confirm', '1'); b.textContent = 'Delete ' + s.name + '?'; setTimeout(function () { b.removeAttribute('data-confirm'); b.textContent = 'Delete set'; }, 4000); return; }
      b.removeAttribute('data-confirm'); b.textContent = 'Delete set';
      var copy = JSON.parse(JSON.stringify(WS)); delete copy.sets[MODE]; copy.active = null;
      if (ST.save(copy).ok) { WS = copy; UNDO = null; MODE = 'demo'; say('Set deleted'); renderWs(); render(S.plan); }
    });
    $('cxRecIssues').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null; if (!b) return;
      var s = setNow(); if (!s) return; var id = b.getAttribute('data-id'), is = null;
      for (var i = 0; i < s.db.issues.length; i++) if (s.db.issues[i].id === id) is = s.db.issues[i];
      if (!is) return;
      if (b.getAttribute('data-act') === 'edit') issueDlg(is);
      else { var r = commit(Wk.ops.closeIssue(id), id + ' closed'); if (!r.ok && r.refused) say(refusalText(r.refused[0]), 'fault'); }
    });
    /* two tabs: the other tab's write reloads this one with a notice (PRD §17) */
    root.addEventListener('storage', function (e) {
      if (e.key !== Wk.KEY) return;
      WS = ST.load(); UNDO = null;
      if (MODE !== 'demo' && !WS.sets[MODE]) MODE = 'demo';
      say('Updated in another tab', 'warn'); renderWs(); render(S.plan);
    });
    S.hooks.push(function (plan) { if (!LOADED) load(); render(plan); });
    root.RZCxRecordsUi = { render: render, db: function () { return db(); }, mode: function () { return MODE; }, workspace: function () { return WS; },
      setDb: function (d) { DEMO = d; LOADED = true; render(S.plan); }, importText: importText, version: '3.50.0' };
    renderWs();
    if (ST.quarantined) say('A damaged local record store was set aside (rz_cx_records_v1_quarantine). Started empty.', 'fault');
    if (S.plan) { load(); render(S.plan); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
