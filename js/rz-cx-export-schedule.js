/* rz-cx-export-schedule.js — PRD-P12: the Cx plan as MS Project XML (MSPDI) and as a calendar (ICS, RFC 5545).
 * DOM-free, ES5, dual-target. One-way export: the plan stores no links, so the links written here restate its rules.
 *
 *   RZCxExport.tasks(cp, systems)   -> { tasks:[{uid, id, name, level, outline, start, finish, days, milestone, summary,
 *                                       preds:[{uid, lag}] }], errors:[] }
 *        cp      = RZEngine.models.commissioning.calendarPlan(...) — the dated plan the calendar panel shows
 *                  (levels[{id, label, start, end (inclusive), workDays}])
 *        systems = RZCxPlan.SYSTEMS (order electrical -> mechanical -> controls, planning days per l2/l3/l4)
 *   RZCxExport.mspdi(cp, systems, meta) -> MSPDI XML string        RZCxExport.ics(cp, systems, nowIso) -> ICS string
 * Mapping (PRD-P12 §5): each level = a task at outline 1 (L2–L4 are summary tasks); each system inside L2–L4 = a
 * subtask whose work days are the level's work days split by its planning-day share (cumulative, rounded, so the
 * subtasks sum exactly to the level); FS links L(n) -> L(n+1) and system -> next system, with the lag that keeps the
 * plan's own dates (the witness slot rule leaves gaps); each level gate = a milestone at the level's last work day.
 * Work week Mon–Fri, 8 h days (08:00–12:00, 13:00–17:00). */
(function (root) {
  'use strict';
  var DAY = 86400000, NS = 'http://schemas.microsoft.com/project', SPLIT = { L2: 'l2', L3: 'l3', L4: 'l4' };
  function parseIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function isWork(t) { var d = new Date(t).getUTCDay(); return d >= 1 && d <= 5; }
  function addWork(s, n) { var t = parseIso(s); while (!isWork(t)) t += DAY; while (n > 0) { t += DAY; if (isWork(t)) n--; } return iso(t); }
  /* work days from a to b, both inclusive, a <= b */
  function span(a, b) { var t = parseIso(a), e = parseIso(b), n = 0; if (isNaN(t) || isNaN(e) || e < t) return 0; for (; t <= e; t += DAY) if (isWork(t)) n++; return n; }
  /* work days strictly between the end of a and the start of b (the FS lag) */
  function gap(endA, startB) { var t = parseIso(endA) + DAY, e = parseIso(startB), n = 0; for (; t < e; t += DAY) if (isWork(t)) n++; return n; }

  function tasks(cp, systems) {
    var out = [], errors = [], uid = 0, i, j;
    if (!cp || !cp.levels || !cp.levels.length) return { tasks: [], errors: ['The plan has no dated levels — set a project start date.'] };
    var prevLevel = null;
    for (i = 0; i < cp.levels.length; i++) {
      var L = cp.levels[i];
      if (isNaN(parseIso(L.start)) || isNaN(parseIso(L.end)) || parseIso(L.end) < parseIso(L.start)) { errors.push(L.id + ': start ' + L.start + ' / end ' + L.end + ' is not a dated window'); continue; }
      var days = span(L.start, L.end), key = SPLIT[L.id];
      var lt = { uid: ++uid, name: L.id + ' ' + L.label, level: L.id, outline: 1, start: L.start, finish: L.end, days: days, milestone: false, summary: !!key, preds: [] };
      if (prevLevel) lt.preds.push({ uid: prevLevel.uid, lag: gap(prevLevel.finish, lt.start) });
      out.push(lt);
      if (key) {
        var total = 0, cum = 0, at = 0, prevSys = null;
        for (j = 0; j < systems.length; j++) total += +systems[j].days[key] || 0;
        for (j = 0; j < systems.length; j++) {
          cum += +systems[j].days[key] || 0;
          var to = total ? Math.round(days * cum / total) : 0, d = to - at;
          var st = addWork(L.start, at), fin = d > 0 ? addWork(L.start, to - 1) : st;
          var t = { uid: ++uid, name: systems[j].label, level: L.id, system: systems[j].id, outline: 2, start: st, finish: fin, days: d, milestone: false, summary: false, preds: [] };
          if (prevSys) t.preds.push({ uid: prevSys.uid, lag: 0 });
          out.push(t); prevSys = t; at = to;
        }
      }
      var g = { uid: ++uid, name: L.id + ' gate', level: L.id, outline: 1, start: L.end, finish: L.end, days: 0, milestone: true, summary: false, gate: true, preds: [{ uid: lt.uid, lag: 0 }] };
      out.push(g);
      prevLevel = lt;
    }
    for (i = 0; i < out.length; i++) out[i].id = i + 1;
    return { tasks: out, errors: errors };
  }

  function xml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  /* text inside <!-- --> is not entity-decoded and may not contain "--" */
  function comment(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/-{2,}/g, '-').replace(/-$/, ''); }
  function el(n, v) { return '<' + n + '>' + v + '</' + n + '>'; }
  function hours(days) { return 'PT' + (days * 8) + 'H0M0S'; }
  function weekDay(type, working) {
    var s = '<WeekDay>' + el('DayType', type) + el('DayWorking', working ? 1 : 0);
    if (working) s += '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>';
    return s + '</WeekDay>';
  }
  function mspdi(cp, systems, meta) {
    meta = meta || {};
    var r = tasks(cp, systems); if (r.errors.length) throw new Error(r.errors.join('; '));
    var T = r.tasks, first = T[0], last = T[T.length - 1], out = [], i, j, outline = [0, 0];
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    out.push('<!-- resistancezero.com Cx plan export (PRD-P12). One-way: the links restate the plan\'s ordering rule. Work week Mon-Fri, 8 h days; dates are the calendar panel\'s dates (' + comment(meta.basis || 'calendarPlan') + '). -->');
    out.push('<Project xmlns="' + NS + '">');
    out.push(el('SaveVersion', 14) + el('Name', xml(meta.name || 'cx-plan.xml')) + el('Title', xml(meta.title || 'Commissioning plan L0–L6')));
    out.push(el('ScheduleFromStart', 1) + el('StartDate', first.start + 'T08:00:00') + el('FinishDate', last.finish + 'T17:00:00'));
    out.push(el('CalendarUID', 1) + el('DefaultStartTime', '08:00:00') + el('DefaultFinishTime', '17:00:00') + el('MinutesPerDay', 480) + el('MinutesPerWeek', 2400) + el('DaysPerMonth', 22));
    out.push('<Calendars><Calendar>' + el('UID', 1) + el('Name', 'Standard') + el('IsBaseCalendar', 1) + '<WeekDays>' + weekDay(1, false) + weekDay(2, true) + weekDay(3, true) + weekDay(4, true) + weekDay(5, true) + weekDay(6, true) + weekDay(7, false) + '</WeekDays></Calendar></Calendars>');
    out.push('<Tasks>');
    for (i = 0; i < T.length; i++) {
      var t = T[i];
      if (t.outline === 1) { outline[0]++; outline[1] = 0; } else outline[1]++;
      var num = t.outline === 1 ? String(outline[0]) : outline[0] + '.' + outline[1];
      var s = '<Task>' + el('UID', t.uid) + el('ID', t.id) + el('Name', xml(t.name)) + el('Type', 1) + el('IsNull', 0) + el('WBS', num) + el('OutlineNumber', num) + el('OutlineLevel', t.outline) +
        el('Start', t.start + 'T08:00:00') + el('Finish', t.finish + (t.days > 0 ? 'T17:00:00' : 'T08:00:00')) + el('Duration', hours(t.days)) + el('DurationFormat', 7) +
        el('Milestone', t.milestone ? 1 : 0) + el('Summary', t.summary ? 1 : 0);
      for (j = 0; j < t.preds.length; j++) s += '<PredecessorLink>' + el('PredecessorUID', t.preds[j].uid) + el('Type', 1) + el('LinkLag', t.preds[j].lag * 4800) + el('LagFormat', 7) + '</PredecessorLink>';
      out.push(s + '</Task>');
    }
    out.push('</Tasks></Project>');
    return out.join('\n') + '\n';
  }

  /* RFC 5545: TEXT escaping, lines folded at 75 octets (UTF-8), CRLF */
  function icsText(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function utf8len(ch) { var c = ch.charCodeAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xd800 && c <= 0xdbff) ? 4 : 3; }
  function fold(line) {
    var out = [], cur = '', n = 0, limit = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i), c = line.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < line.length) { ch += line.charAt(++i); }
      var w = utf8len(ch);
      if (n + w > limit) { out.push(cur); cur = ' '; n = 1; limit = 75; }
      cur += ch; n += w;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function ymd(isoDate) { return isoDate.replace(/-/g, ''); }
  function ics(cp, systems, nowIso) {
    var r = tasks(cp, systems); if (r.errors.length) throw new Error(r.errors.join('; '));
    var stamp = (nowIso || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//resistancezero.com//Cx plan export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsText('Cx plan L0–L6')];
    for (var i = 0; i < r.tasks.length; i++) {
      var t = r.tasks[i]; if (!t.milestone) continue;
      L.push('BEGIN:VEVENT', 'UID:' + t.uid + '@resistancezero.com', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(t.start), 'DTEND;VALUE=DATE:' + ymd(iso(parseIso(t.start) + DAY)),
        'SUMMARY:' + icsText(t.name), 'DESCRIPTION:' + icsText('Cx ' + t.level + ' gate — last work day of the ' + t.level + ' window in the exported plan.'), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    L.push('END:VCALENDAR');
    var out = []; for (i = 0; i < L.length; i++) out.push(fold(L[i]));
    return out.join('\r\n') + '\r\n';
  }

  var API = { tasks: tasks, mspdi: mspdi, ics: ics, fold: fold, icsText: icsText, xml: xml, span: span, NS: NS, version: '3.51.0' };
  root.RZCxExport = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
