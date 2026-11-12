/* rz-cx-ext.js — Cx Analysis Tier 1.5 (v3.26.1, WI-CX-SUPERAPP-001 P5): the calendar panel (anchor date,
 * witness slots on the first full Mon–Fri week, dated level windows, release date, the constraint that moved a
 * level), extension lines (standby per work day, lump sums), CSV import / export, and the Cx Analysis sheet the
 * page's PDF export appends. Numbers: RZEngine commissioning.calendarPlan through RZCxIo; this file only draws.
 * Hooks into RZCxAnalysis (state, render hooks, store). ES5. */
(function (root, doc) {
  'use strict';
  if (!doc) return;
  var A, S, P, IO, E;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { return A.fmt.money(v); }
  function cal() { return S.extra.calendar || (S.extra.calendar = { anchor: null, slot: false }); }
  function lines() { return S.extra.lines || (S.extra.lines = []); }
  function engine() { return root.RZEngine && root.RZEngine.models && root.RZEngine.models.commissioning && typeof root.RZEngine.models.commissioning.calendarPlan === 'function' ? root.RZEngine.models.commissioning : null; }
  function pretty(iso) { if (!iso) return '—'; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? (+m[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + m[1] : iso; }

  var lastError = null;
  function localIso(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  /* the calendar result for the current plan, or null (no anchor / no engine) */
  function compute(plan) {
    var c = cal(), eng = engine(); if (!plan || !eng || !c.anchor) return null;
    try {
      var base = eng.calendarPlan(IO.calendarSpec(plan, c, {})), spec = IO.calendarSpec(plan, c, S.overrides, base.levels);
      spec.lines = lines(); lastError = null; return eng.calendarPlan(spec);
    } catch (e) { lastError = String(e && e.message || e); return null; }
  }

  function build() {
    var after = $('cxAnPlanPanel'); if (!after || $('cxExPanel')) return false;
    var panel = doc.createElement('div'); panel.className = 'cx-an-panel cx-ex'; panel.id = 'cxExPanel';
    panel.innerHTML =
      '<div class="cx-an-panel-head"><h3>Calendar, witness slots and extension lines</h3><span class="cx-an-sub">Tier 1.5 · set a start date and the plan is laid on work days (Mon–Fri, no holiday calendar): L4 and L5 take the first full Mon–Fri week of a month on or after the previous gate, so a slipped gate can cost a month, and the panel says which constraint did it. Extension lines are non-labour: standby per work day from the baseline release to the new one, lump sums on a date. Numbers: RZEngine commissioning.calendarPlan.</span></div>' +
      '<div class="cx-ex-controls"><label>Project start <input type="date" id="cxExAnchor" class="input-field" aria-label="Project start date"></label>' +
      '<label class="cx-ex-check"><input type="checkbox" id="cxExSlot"> Witness slots: first full week</label>' +
      '<span class="spacer"></span><span class="cx-ex-release" id="cxExRelease" aria-live="polite"></span></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table cx-ex-table" id="cxExTable"><thead><tr><th>Level</th><th>Start</th><th>End</th><th class="num">Work days</th><th class="num">Cost</th><th>Constraint</th></tr></thead><tbody></tbody></table></div>' +
      '<div class="cx-an-panel-head cx-ex-sub"><h3>Extension lines</h3><span class="cx-an-sub">standby: amount per work day between two dates (or the two releases) · lump: an amount on a date (or the release)</span></div>' +
      '<div class="cx-an-tablewrap"><table class="cx-an-table cx-ex-lines" id="cxExLines"><thead><tr><th>Line</th><th>Kind</th><th>Per work day / amount</th><th>From / on</th><th>To</th><th class="num">Days</th><th class="num">Amount</th><th></th></tr></thead><tbody></tbody></table></div>' +
      '<div class="cx-an-actions"><button type="button" class="tool-btn" id="cxExAddStandby">Add standby</button><button type="button" class="tool-btn" id="cxExAddLump">Add lump sum</button>' +
      '<span class="spacer"></span><span class="cx-ex-total" id="cxExTotal" aria-live="polite"></span></div>' +
      '<div class="cx-an-panel-head cx-ex-sub"><h3>CSV</h3><span class="cx-an-sub">import: plan overrides (level,start,months,crew,shift) or lines (id,label,kind,perWorkDay,amount,from,to,on); rejected rows are listed with their reason · export: plan, monthly, status at the viewed month, calendar, lines</span></div>' +
      '<div class="cx-an-actions cx-ex-csv"><label class="tool-btn cx-ex-file">Import plan CSV<input type="file" id="cxExImportPlan" accept=".csv,text/csv" hidden></label>' +
      '<label class="tool-btn cx-ex-file">Import lines CSV<input type="file" id="cxExImportLines" accept=".csv,text/csv" hidden></label>' +
      '<span class="spacer"></span>' +
      '<button type="button" class="tool-btn" data-export="plan">Plan CSV</button><button type="button" class="tool-btn" data-export="monthly">Monthly CSV</button><button type="button" class="tool-btn" data-export="status">Status CSV</button><button type="button" class="tool-btn" data-export="calendar">Calendar CSV</button><button type="button" class="tool-btn" data-export="lines">Lines CSV</button><button type="button" class="tool-btn" data-export="mspdi" title="MS Project XML (MSPDI, also imported by Primavera P6): levels, systems inside L2–L4, gates as milestones, FS links. One-way: link edits in Project do not come back.">MS Project XML</button><button type="button" class="tool-btn" data-export="ics" title="One all-day event per level gate (RFC 5545)">Calendar (.ics)</button></div>' +
      '<ul class="cx-ex-errors" id="cxExErrors" aria-live="polite"></ul>';
    after.parentNode.insertBefore(panel, after.nextSibling);
    return true;
  }

  function render(plan) {
    var c = cal(), anchor = $('cxExAnchor'), slot = $('cxExSlot');
    if (doc.activeElement !== anchor) anchor.value = c.anchor || '';
    slot.checked = !!c.slot; slot.disabled = !c.anchor;
    var cp = compute(plan), tb = $('cxExTable').getElementsByTagName('tbody')[0], rel = $('cxExRelease'), i;
    /* dated exports need dates: disabled with the reason on the button itself (PRD-P12 FR-4) */
    var dated = $('cxExPanel').querySelectorAll('[data-export="mspdi"], [data-export="ics"]');
    for (i = 0; i < dated.length; i++) {
      var b = dated[i]; if (!b.hasAttribute('data-title')) b.setAttribute('data-title', b.title);
      b.disabled = !cp || !root.RZCxExport;
      b.title = b.disabled ? 'Set a project start date first — these files carry dates' : b.getAttribute('data-title');
    }
    tb.innerHTML = '';
    if (!cp) { rel.textContent = !c.anchor ? 'No start date set — months are relative (M0 = project start).' : lastError ? 'calendarPlan failed: ' + lastError : 'Engine without calendarPlan — dates unavailable.'; }
    else {
      for (i = 0; i < cp.levels.length; i++) {
        var L = cp.levels[i], B = cp.baseline && cp.baseline.levels[i], tr = doc.createElement('tr'); tr.className = L.moved ? 'is-edited' : '';
        var why = L.explain || '';
        if (L.moved && B) { var wd = IO.workDaysBetween(B.start, L.start); if (wd) why = (wd > 0 ? '+' : '') + wd + ' work days vs baseline start ' + pretty(B.start) + (why ? '. ' + why : '.'); }
        tr.innerHTML = '<th scope="row"><span class="cx-an-lv">' + L.id + '</span> ' + esc(L.label) + '</th><td>' + pretty(L.start) + '</td><td>' + pretty(L.end) + '</td><td class="num">' + L.workDays + '</td><td class="num">' + money(L.cost) + '</td><td class="cx-ex-explain">' + esc(why) + '</td>';
        tb.appendChild(tr);
      }
      rel.innerHTML = 'Release <b>' + pretty(cp.release) + '</b>' + (cp.releaseDeltaDays ? ' · <b>' + (cp.releaseDeltaDays > 0 ? '+' : '') + cp.releaseDeltaDays + ' days</b> vs baseline ' + pretty(cp.baselineRelease) : ' · on the baseline date') + (cp.extensionTotal ? ' · extension ' + money(cp.extensionTotal) : '');
    }
    // lines
    var lb = $('cxExLines').getElementsByTagName('tbody')[0], ls = lines(); lb.innerHTML = '';
    for (i = 0; i < ls.length; i++) {
      var l = ls[i], got = cp ? cp.lines[i] : null, tr2 = doc.createElement('tr'); tr2.setAttribute('data-line', l.id);
      tr2.innerHTML = '<td><input type="text" class="input-field cx-ex-in" data-line="' + esc(l.id) + '" data-field="label" value="' + esc(l.label) + '" aria-label="line label"></td>' +
        '<td>' + l.kind + '</td>' +
        '<td><input type="number" class="input-field cx-ex-in" data-line="' + esc(l.id) + '" data-field="' + (l.kind === 'standby' ? 'perWorkDay' : 'amount') + '" min="0" step="1" value="' + (l.kind === 'standby' ? l.perWorkDay : l.amount) + '" aria-label="' + (l.kind === 'standby' ? 'per work day' : 'amount') + '"></td>' +
        '<td><input type="text" class="input-field cx-ex-in" data-line="' + esc(l.id) + '" data-field="' + (l.kind === 'standby' ? 'from' : 'on') + '" value="' + esc(l.kind === 'standby' ? l.from : l.on) + '" placeholder="YYYY-MM-DD, release, baselineRelease" aria-label="from or on"></td>' +
        '<td>' + (l.kind === 'standby' ? '<input type="text" class="input-field cx-ex-in" data-line="' + esc(l.id) + '" data-field="to" value="' + esc(l.to) + '" placeholder="YYYY-MM-DD or release" aria-label="to">' : '—') + '</td>' +
        '<td class="num">' + (got && l.kind === 'standby' ? got.days : '—') + '</td><td class="num">' + (got ? money(got.amount) : '—') + '</td>' +
        '<td><button type="button" class="tool-btn" data-remove="' + esc(l.id) + '" aria-label="remove line ' + esc(l.label) + '">×</button></td>';
      lb.appendChild(tr2);
    }
    $('cxExTotal').textContent = cp ? 'Extension total ' + money(cp.extensionTotal) + ' · plan with extension ' + money(cp.totalWithExtension) + (cp.eac ? ' · EAC ' + money(cp.eac.eac) : '') : (ls.length ? 'Set a project start date to price the lines.' : '');
  }

  function errors(list) { var u = $('cxExErrors'); u.innerHTML = ''; for (var i = 0; i < list.length; i++) { var li = doc.createElement('li'); li.textContent = list[i]; u.appendChild(li); } }
  function dirty() { S.dirty = true; A.render(); }
  function download(name, text, type) {
    var blob = new root.Blob([text], { type: type || 'text/csv;charset=utf-8' }), url = root.URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = name; doc.body.appendChild(a); a.click(); doc.body.removeChild(a); root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
    return text;
  }
  function exportKind(kind) {
    var plan = S.plan; if (!plan) return '';
    if (kind === 'plan') return download('cx-plan.csv', IO.csv.exportPlan(plan));
    if (kind === 'monthly') return download('cx-monthly.csv', IO.csv.exportMonthly(plan));
    if (kind === 'status') return download('cx-status-M' + S.month + '.csv', IO.csv.exportStatus(P.statusAt(plan, S.month)));
    if (kind === 'calendar') { var cp = compute(plan); if (!cp) { errors(['Calendar CSV needs a project start date.']); return ''; } return download('cx-calendar.csv', IO.csv.exportCalendar(cp)); }
    if (kind === 'lines') return download('cx-lines.csv', IO.csv.exportLines(lines()));
    if (kind === 'mspdi' || kind === 'ics') {
      var X = root.RZCxExport, c2 = compute(plan); if (!X || !c2) { errors(['Set a project start date to export dated files.']); return ''; }
      var stamp = cal().anchor, text;
      try { text = kind === 'mspdi' ? X.mspdi(c2, P.SYSTEMS, { name: 'cx-plan-' + stamp + '.xml', basis: c2.basis || 'calendarPlan' }) : X.ics(c2, P.SYSTEMS); }
      catch (e) { errors([String(e && e.message || e)]); return ''; }
      if (root.rzScenario && root.rzScenario.track) root.rzScenario.track('pdf_exported', 'calculator', 'cx', { calc: 'cx', format: kind });
      return kind === 'mspdi' ? download('cx-plan-' + stamp + '.xml', text, 'application/xml;charset=utf-8') : download('cx-plan-' + stamp + '.ics', text, 'text/calendar;charset=utf-8');
    }
    return '';
  }
  function readFile(input, fn) { var f = input.files && input.files[0]; if (!f) return; var r = new root.FileReader(); r.onload = function () { fn(String(r.result || '')); input.value = ''; }; r.readAsText(f); }
  function importPlanText(text) {
    var res = IO.csv.importPlan(text, P), msgs = [];
    for (var i = 0; i < res.errors.length; i++) msgs.push('Row ' + res.errors[i].row + ': ' + res.errors[i].reason);
    if (res.accepted) { var next = {}; for (var k in S.overrides) if (S.overrides.hasOwnProperty(k)) next[k] = S.overrides[k]; for (var j in res.overrides) if (res.overrides.hasOwnProperty(j)) next[j] = res.overrides[j]; S.overrides = P.sanitize(next); }
    msgs.unshift(res.accepted + ' level override' + (res.accepted === 1 ? '' : 's') + ' applied' + (res.errors.length ? ', ' + res.errors.length + ' row' + (res.errors.length === 1 ? '' : 's') + ' rejected' : '') + '.');
    errors(msgs); if (res.accepted) dirty(); return res;
  }
  function importLinesText(text) {
    var res = IO.csv.importLines(text), msgs = [];
    for (var i = 0; i < res.errors.length; i++) msgs.push('Row ' + res.errors[i].row + ': ' + res.errors[i].reason);
    if (res.lines.length) { var merged = lines().slice(); for (var j = 0; j < res.lines.length; j++) { var hit = -1; for (var q = 0; q < merged.length; q++) if (merged[q].id === res.lines[j].id) hit = q; if (hit >= 0) merged[hit] = res.lines[j]; else merged.push(res.lines[j]); } S.extra.lines = IO.sanitizeLines(merged); }
    msgs.unshift(res.lines.length + ' line' + (res.lines.length === 1 ? '' : 's') + ' applied' + (res.errors.length ? ', ' + res.errors.length + ' rejected' : '') + '.');
    errors(msgs); if (res.lines.length) dirty(); return res;
  }
  function addLine(kind) {
    var ls = lines().slice(), n = 1; while (ls.some(function (l) { return l.id === kind + n; })) n++;
    ls.push(kind === 'standby' ? { id: 'standby' + n, label: 'Retained test-equipment standby', kind: 'standby', perWorkDay: 0, from: 'baselineRelease', to: 'release' } : { id: 'lump' + n, label: 'Remobilisation', kind: 'lump', amount: 0, on: 'release' });
    S.extra.lines = IO.sanitizeLines(ls); dirty();
  }
  function bind() {
    $('cxExAnchor').addEventListener('change', function () { var v = this.value, had = !!cal().anchor; cal().anchor = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; if (cal().anchor && !had) cal().slot = true; /* slots default on the FIRST date only; a cleared box stays cleared */ dirty(); });
    $('cxExSlot').addEventListener('change', function () { cal().slot = this.checked; dirty(); });
    $('cxExAddStandby').addEventListener('click', function () { addLine('standby'); });
    $('cxExAddLump').addEventListener('click', function () { addLine('lump'); });
    $('cxExLines').addEventListener('change', function (e) {
      var t = e.target, id = t.getAttribute && t.getAttribute('data-line'), f = t.getAttribute && t.getAttribute('data-field'); if (!id || !f) return;
      var ls = lines().map(function (l) { var o = {}; for (var k in l) if (l.hasOwnProperty(k)) o[k] = l[k]; if (o.id === id) o[f] = t.value; return o; });
      var clean = IO.sanitizeLines(ls); if (clean.length !== ls.length) errors(['Line "' + id + '": "' + t.value + '" is not valid for ' + f + ' — kept the previous value.']); else { S.extra.lines = clean; errors([]); }
      dirty();
    });
    $('cxExPanel').addEventListener('click', function (e) {
      var rm = e.target.closest ? e.target.closest('[data-remove]') : null; if (rm) { var id = rm.getAttribute('data-remove'); S.extra.lines = lines().filter(function (l) { return l.id !== id; }); dirty(); return; }
      var ex = e.target.closest ? e.target.closest('[data-export]') : null; if (ex) exportKind(ex.getAttribute('data-export'));
    });
    $('cxExImportPlan').addEventListener('change', function () { readFile(this, importPlanText); });
    $('cxExImportLines').addEventListener('change', function () { readFile(this, importLinesText); });
  }

  /* the Cx Analysis sheet for the page's PDF export (cxExportPDF appends it) */
  function sheet() {
    var plan = S.plan; if (!plan) return '';
    var cp = compute(plan), i, h = '<div class="page-break"></div><div class="sect"><h1>Cx Analysis — program plan</h1>';
    h += '<p>As of ' + esc(localIso(new Date())) + ' · ' + (S.dirty ? 'unsaved scenario' : (Object.keys(S.overrides).length ? 'saved scenario' : 'approved baseline')) + ' · status month M' + S.month + (cp ? ' · project start ' + pretty(cal().anchor) + (cal().slot ? ' · witness slots on the first full week' : '') : ' · months relative to the project start') + ' · source: Cx Field Manual ch 02 · numbers: RZEngine commissioning.programPlan' + (cp ? ' / calendarPlan' : '') + '</p>';
    h += '<table><thead><tr><th>KPI</th><th>Scenario</th><th>Baseline</th></tr></thead><tbody>' +
      '<tr><td>Finish</td><td>' + P.fmtMo(plan.finishMonth) + (cp ? ' · ' + pretty(cp.release) : '') + '</td><td>' + P.fmtMo(plan.baselineFinish) + (cp ? ' · ' + pretty(cp.baselineRelease) : '') + '</td></tr>' +
      '<tr><td>Total Cx cost</td><td>' + money(plan.total) + (cp && cp.extensionTotal ? ' + extension ' + money(cp.extensionTotal) : '') + '</td><td>' + money(plan.baselineTotal) + '</td></tr>' +
      '<tr><td>Man-hours</td><td>' + P.fmtInt(plan.manHours) + '</td><td>' + P.fmtInt(plan.baselineManHours) + '</td></tr>' +
      '<tr><td>Peak month</td><td>' + P.fmtMo(plan.peak.month) + ' · ' + money(plan.peak.cost) + '</td><td>—</td></tr></tbody></table>';
    h += '<h2>Plan</h2><table><thead><tr><th>Level</th><th>Start</th><th>Months</th><th>Crew</th><th>Shift</th><th>Man-hours</th><th>Cost</th><th>Δ</th>' + (cp ? '<th>Dates</th><th>Constraint</th>' : '') + '</tr></thead><tbody>';
    for (i = 0; i < plan.levels.length; i++) { var L = plan.levels[i], C = cp ? cp.levels[i] : null; h += '<tr><td>' + L.id + ' ' + esc(L.label) + '</td><td>' + P.fmtMo(L.start) + '</td><td>' + A.fmt.one(L.months) + '</td><td>' + L.crew + '</td><td>' + L.shift + '</td><td>' + P.fmtInt(L.manHours) + '</td><td>' + money(L.cost) + '</td><td>' + A.fmt.delta(L.costDelta, money) + '</td>' + (C ? '<td>' + pretty(C.start) + ' – ' + pretty(C.end) + '</td><td>' + esc(C.explain || '') + '</td>' : '') + '</tr>'; }
    h += '</tbody></table>';
    h += '<h2>Monthly cost profile (incurrence)</h2><table><thead><tr><th>Month</th><th>Baseline</th><th>Scenario</th>' + (cp ? '<th>Extension</th>' : '') + '<th>Man-hours</th><th>Crew on site</th></tr></thead><tbody>';
    for (i = 0; i < plan.monthly.cost.length; i++) h += '<tr><td>M' + i + '</td><td>' + money(plan.monthly.baselineCost[i]) + '</td><td>' + money(plan.monthly.cost[i]) + '</td>' + (cp ? '<td>' + (cp.monthly.extension[i] != null ? money(cp.monthly.extension[i]) : '—') + '</td>' : '') + '<td>' + P.fmtInt(plan.monthly.manHours[i]) + '</td><td>' + A.fmt.one(plan.monthly.crew[i]) + '</td></tr>';
    h += '</tbody></table>';
    var st = P.statusAt(plan, S.month);
    h += '<h2>Status by system at M' + S.month + '</h2><table><thead><tr><th>System</th><th>Block</th><th>Level</th><th>Tag</th><th>Next gate</th></tr></thead><tbody>';
    for (i = 0; i < st.systems.length; i++) h += '<tr><td>' + esc(st.systems[i].label) + '</td><td>' + st.systems[i].block + '</td><td>' + (st.systems[i].level || '—') + '</td><td>' + (st.systems[i].tag || '—') + '</td><td>' + (st.systems[i].next || '—') + '</td></tr>';
    h += '</tbody></table>';
    var sheets = $('cxAnSheets'), svg = sheets ? sheets.querySelector('.cx-an-sheet[aria-hidden="false"] svg, .cx-an-sheet:not([hidden]) svg, svg') : null;
    if (svg) h += '<h2>Schematic at M' + S.month + '</h2><div class="cx-sheet-snap">' + svg.outerHTML.replace(/<script[\s\S]*?<\/script>/g, '') + '</div>';
    h += '<p>Representative, conceptual site basis. Gate months are planned dates derived from the level windows; no acceptance record is held (Tier 1). Cost profile is incurrence, uniform inside each level window.</p></div>';
    return h;
  }

  function init() {
    A = root.RZCxAnalysis; P = root.RZCxPlan; IO = root.RZCxIo;
    if (!A || !P || !IO || !A.state) return;
    S = A.state;
    if (!build()) return;
    bind(); S.hooks.push(render);
    root.RZCxAnalysisSheet = sheet;
    root.RZCxExt = { render: render, compute: compute, exportKind: exportKind, importPlanText: importPlanText, importLinesText: importLinesText, addLine: addLine, sheet: sheet, version: '3.26.1' };
    if (S.plan) render(S.plan);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
