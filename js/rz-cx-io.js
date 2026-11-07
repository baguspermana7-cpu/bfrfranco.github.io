/* rz-cx-io.js — DOM-free helpers of the Cx Analysis tab, Tier 1.5 (v3.26.1, WI-CX-SUPERAPP-001 P5):
 *   RZCxIo.calendarSpec(plan, cal, overrides)  programPlan → calendarPlan spec (dates from an anchor,
 *                                             work days = months × 22, L4/L5 witness, edited starts → dated overrides)
 *   RZCxIo.monthToDate(anchor, m)              month float → ISO date: whole months from the anchor month, then
 *                                             round(fraction × 22) work days from that month's first work day
 *   RZCxIo.sanitizeLines(arr)                  extension lines: standby (per work day, from → to) or lump (amount, on)
 *   RZCxIo.csv.parse / importPlan / importLines / exportPlan / exportMonthly / exportStatus / exportCalendar / exportLines
 * Every importer reports each rejected row with its line number and reason; nothing is clamped silently.
 * ES5, dual-target (window / module.exports). */
(function (root) {
  'use strict';
  var WITNESS = { L4: true, L5: true }, WORK_DAYS = 22, DAY = 86400000;
  var ISO = /^(\d{4})-(\d{2})-(\d{2})$/, ANCHORS = { baselineRelease: true, release: true };

  function parseIso(s) { var m = ISO.exec(String(s || '')); if (!m) return NaN; var t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return isNaN(t) ? NaN : t; }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function isWork(t) { var d = new Date(t).getUTCDay(); return d >= 1 && d <= 5; }
  function nextWork(t) { t += DAY; while (!isWork(t)) t += DAY; return t; }
  /* ISO date + n work days (Mon–Fri, UTC; n may be negative); a weekend start counts from the next work day */
  function addWorkDays(iso, n) {
    var t = parseIso(iso); if (isNaN(t)) return null;
    var step = n < 0 ? -DAY : DAY, left = Math.abs(n);
    while (left > 0) { t += step; var wd = new Date(t).getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
    return new Date(t).toISOString().slice(0, 10);
  }
  /* signed count of work days from ISO a to ISO b (b after a = positive; same day = 0) */
  function workDaysBetween(a, b) {
    var ta = parseIso(a), tb = parseIso(b); if (isNaN(ta) || isNaN(tb)) return null;
    var sign = tb >= ta ? 1 : -1, t = ta, n = 0;
    while (t !== tb) { t += sign * DAY; var wd = new Date(t).getUTCDay(); if (wd !== 0 && wd !== 6) n++; }
    return sign * n;
  }
  function monthToDate(anchor, m) {
    var a = parseIso(anchor); if (isNaN(a) || !(m >= 0)) return null;
    var d = new Date(a), whole = Math.floor(m), frac = m - whole;
    var t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + whole, 1); while (!isWork(t)) t += DAY;
    var steps = Math.round(frac * WORK_DAYS); for (var i = 0; i < steps; i++) t = nextWork(t);
    return iso(t);
  }

  function calendarSpec(plan, cal, overrides, baseCal) {
    cal = cal || {}; overrides = overrides || {};
    var levels = [], ov = null;
    for (var i = 0; plan && plan.levels && i < plan.levels.length; i++) {
      var L = plan.levels[i];
      var lv = { id: L.id, label: L.label, workDays: Math.max(1, Math.round(L.months * WORK_DAYS)), cost: L.cost, manHours: L.manHours, witness: !!WITNESS[L.id] };
      if (L.baseline) { /* the approved durations / costs: the engine lays its baseline on these, so a duration or cost edit shows as a slip and a delta */
        lv.baselineWorkDays = Math.max(1, Math.round(L.baseline.months * WORK_DAYS)); lv.baselineCost = L.baseline.cost; lv.baselineManHours = L.baseline.manHours; }
      levels.push(lv);
      var o = overrides[L.id], b = baseCal && baseCal[i] && baseCal[i].id === L.id ? baseCal[i] : null;
      if (o && o.start != null && cal.anchor) {
        /* with the engine's baseline calendar: the edit is a shift of (months × 22) work days from that level's
         * dated baseline start, so a +0.5 mo edit always lands 11 work days later; without it, an absolute date */
        var d = null;
        if (b && L.baseline && L.baseline.start != null) { var shift = Math.round((+o.start - L.baseline.start) * WORK_DAYS); if (shift) d = addWorkDays(b.start, shift); }
        else d = monthToDate(cal.anchor, +o.start);
        if (d) { ov = ov || {}; ov[L.id] = { start: d }; }
      }
    }
    var spec = { anchor: cal.anchor || null, levels: levels, slotRule: cal.slot ? 'first-full-week' : null };
    if (ov) spec.overrides = ov;
    return spec;
  }

  function num(v, min, max) { if (v === '' || v === null || v === undefined) return undefined; var n = +v; if (!isFinite(n) || n < min || n > max) return undefined; return n; }
  function dateOrAnchor(v) { v = String(v || '').trim(); if (ANCHORS[v]) return v; return isNaN(parseIso(v)) ? undefined : v; }
  function sanitizeLines(arr) {
    var out = [], seen = {};
    if (!arr || typeof arr !== 'object' || typeof arr.length !== 'number') return out;
    for (var i = 0; i < arr.length; i++) {
      var l = arr[i]; if (!l || typeof l !== 'object') continue;
      var id = String(l.id || '').trim(); if (!id || seen[id]) continue;
      var label = String(l.label || id).slice(0, 80);
      if (l.kind === 'standby') {
        var per = num(l.perWorkDay, 0, 1e12), from = dateOrAnchor(l.from == null ? 'baselineRelease' : l.from), to = dateOrAnchor(l.to == null ? 'release' : l.to);
        if (per === undefined || !from || !to) continue;
        out.push({ id: id, label: label, kind: 'standby', perWorkDay: per, from: from, to: to });
      } else if (l.kind === 'lump') {
        var amt = num(l.amount, 0, 1e15), on = dateOrAnchor(l.on == null ? 'release' : l.on);
        if (amt === undefined || !on) continue;
        out.push({ id: id, label: label, kind: 'lump', amount: amt, on: on });
      } else continue;
      seen[id] = true;
    }
    return out;
  }

  /* ── CSV ── */
  function parse(text) {
    var rows = [], row = [], field = '', q = false, s = String(text || '');
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (q) { if (c === '"') { if (s.charAt(i + 1) === '"') { field += '"'; i++; } else q = false; } else field += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s.charAt(i + 1) === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  }
  function cell(v) {
    v = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v; /* a leading = + - @ is a formula to a spreadsheet; plain numbers stay numbers */
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function line(arr) { var o = []; for (var i = 0; i < arr.length; i++) o.push(cell(arr[i])); return o.join(','); }
  function header(rows, want) {
    if (!rows.length) return null;
    var h = rows[0].map(function (x) { return String(x).trim().toLowerCase(); }), idx = {};
    for (var i = 0; i < want.length; i++) { var k = h.indexOf(want[i].toLowerCase()); if (k === -1) return null; idx[want[i]] = k; }
    return idx;
  }
  function importPlan(text, P) {
    var rows = parse(text), errors = [], overrides = {}, seen = {}, idx = header(rows, ['level', 'start', 'months', 'crew', 'shift']);
    if (!idx) return { overrides: {}, errors: [{ row: 1, reason: 'header must contain level,start,months,crew,shift' }], accepted: 0 };
    var LIM = P.LIMITS || { start: [0, 120], months: [0.1, 60], crew: [0.5, 200] }, SH = {}, shifts = P.SHIFTS || ['1x8', '2x12'];
    for (var sh = 0; sh < shifts.length; sh++) SH[shifts[sh]] = true;
    var known = {}; for (var l = 0; l < P.LEVELS.length; l++) known[P.LEVELS[l].id] = true;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r], n = r + 1, get = function (k) { var v = row[idx[k]]; return v == null ? '' : String(v).trim(); };
      var id = get('level').toUpperCase();
      if (!known[id]) { errors.push({ row: n, reason: 'unknown level "' + get('level') + '" (L0–L6)' }); continue; }
      if (seen[id]) { errors.push({ row: n, reason: 'duplicate level ' + id }); continue; }
      var o = {}, bad = null, fields = ['start', 'months', 'crew'];
      for (var f = 0; f < fields.length && !bad; f++) {
        var raw = get(fields[f]); if (raw === '') continue;
        var v = num(raw, LIM[fields[f]][0], LIM[fields[f]][1]);
        if (v === undefined) bad = fields[f] + ' "' + raw + '" outside ' + LIM[fields[f]][0] + '–' + LIM[fields[f]][1]; else o[fields[f]] = v;
      }
      if (!bad && get('shift') !== '') { if (SH[get('shift')]) o.shift = get('shift'); else bad = 'shift "' + get('shift') + '" is not 1x8 or 2x12'; }
      if (bad) { errors.push({ row: n, reason: bad }); continue; }
      var any = false; for (var k in o) if (o.hasOwnProperty(k)) any = true;
      if (!any) { errors.push({ row: n, reason: 'no value to apply (empty row)' }); continue; }
      overrides[id] = o; seen[id] = true;
    }
    var clean = typeof P.sanitize === 'function' ? P.sanitize(overrides) : overrides, accepted = 0; for (var a in clean) if (clean.hasOwnProperty(a)) accepted++;
    return { overrides: clean, errors: errors, accepted: accepted };
  }
  function importLines(text) {
    var rows = parse(text), errors = [], lines = [], seenId = {}, idx = header(rows, ['id', 'kind']);
    if (!idx) return { lines: [], errors: [{ row: 1, reason: 'header must contain id,kind (and label,perWorkDay,amount,from,to,on)' }] };
    var opt = header(rows, ['label', 'perworkday', 'amount', 'from', 'to', 'on']) || {};
    var all = rows[0].map(function (x) { return String(x).trim().toLowerCase(); });
    function col(row, name) { var k = all.indexOf(name.toLowerCase()); return k === -1 ? '' : (row[k] == null ? '' : String(row[k]).trim()); }
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r], cand = { id: col(row, 'id'), label: col(row, 'label'), kind: col(row, 'kind'), perWorkDay: col(row, 'perWorkDay'), amount: col(row, 'amount'), from: col(row, 'from') || undefined, to: col(row, 'to') || undefined, on: col(row, 'on') || undefined };
      var got = sanitizeLines([cand]);
      if (got.length && seenId[got[0].id]) { errors.push({ row: r + 1, reason: 'line "' + got[0].id + '" rejected: duplicate id' }); continue; }
      if (got.length) { seenId[got[0].id] = true; lines.push(got[0]); } else errors.push({ row: r + 1, reason: 'line "' + cand.id + '" rejected: ' + (cand.kind !== 'standby' && cand.kind !== 'lump' ? 'kind must be standby or lump' : cand.kind === 'lump' ? 'amount must be a number ≥ 0 and on a date / release' : 'perWorkDay must be a number ≥ 0 and from / to dates or baselineRelease / release') });
    }
    return { lines: sanitizeLines(lines), errors: errors };
  }
  function exportPlan(plan) {
    var out = ['level,label,start,end,months,crew,shift,crew_needed,man_hours,cost,cost_delta'];
    for (var i = 0; plan && i < plan.levels.length; i++) { var L = plan.levels[i]; out.push(line([L.id, L.label, L.start, L.end, L.months, L.crew, L.shift, L.crewNeeded, L.manHours, L.cost, L.costDelta])); }
    return out.join('\n') + '\n';
  }
  function exportMonthly(plan) {
    var out = ['month,baseline_cost,scenario_cost,man_hours,crew_on_site'];
    for (var i = 0; plan && i < plan.monthly.cost.length; i++) out.push(line(['M' + i, plan.monthly.baselineCost[i], plan.monthly.cost[i], plan.monthly.manHours[i], plan.monthly.crew[i]]));
    return out.join('\n') + '\n';
  }
  function exportStatus(st) {
    var out = ['system,label,block,level,tag,next_gate,in_test'];
    for (var i = 0; st && i < st.systems.length; i++) { var s = st.systems[i]; out.push(line([s.id, s.label, s.block, s.level || '', s.tag || '', s.next || '', s.inTest ? 'yes' : 'no'])); }
    return out.join('\n') + '\n';
  }
  function exportCalendar(cp) {
    var out = ['level,label,start,end,work_days,cost,man_hours,moved,explain'];
    for (var i = 0; cp && i < cp.levels.length; i++) { var L = cp.levels[i]; out.push(line([L.id, L.label, L.start, L.end, L.workDays, L.cost, L.manHours, L.moved ? 'yes' : 'no', L.explain || ''])); }
    if (cp) {
      out.push(line(['release', 'Release', cp.release || '', cp.release || '', '', cp.totalWithExtension, cp.manHours, cp.releaseDeltaDays ? 'yes' : 'no', cp.releaseDeltaDays ? cp.releaseDeltaDays + ' days vs baseline release (total includes extension lines)' : 'on the baseline release (total includes extension lines)']));
      out.push(line(['baseline_release', 'Baseline release', cp.baselineRelease || '', cp.baselineRelease || '', '', cp.baselineTotal, cp.baselineManHours, 'no', '']));
    }
    return out.join('\n') + '\n';
  }
  function exportLines(lines) {
    var out = ['id,label,kind,perWorkDay,amount,from,to,on'];
    for (var i = 0; lines && i < lines.length; i++) { var l = lines[i]; out.push(line([l.id, l.label, l.kind, l.perWorkDay != null ? l.perWorkDay : '', l.amount != null ? l.amount : '', l.from || '', l.to || '', l.on || ''])); }
    return out.join('\n') + '\n';
  }

  var API = { calendarSpec: calendarSpec, addWorkDays: addWorkDays, workDaysBetween: workDaysBetween, monthToDate: monthToDate, sanitizeLines: sanitizeLines, WITNESS: WITNESS, WORK_DAYS: WORK_DAYS,
    csv: { parse: parse, importPlan: importPlan, importLines: importLines, exportPlan: exportPlan, exportMonthly: exportMonthly, exportStatus: exportStatus, exportCalendar: exportCalendar, exportLines: exportLines }, version: '3.26.1' };
  root.RZCxIo = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
