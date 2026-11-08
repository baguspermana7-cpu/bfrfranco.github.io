/* rz-cx-plan.js — the DOM-free core of the Cx Analysis tab on cx-calculator.html (v3.26.0,
 * WI-CX-SUPERAPP-001). Everything here is testable in Node; the page module draws from it.
 *
 *   RZCxPlan.LEVELS            L0–L6 meta + the handbook section each level cites
 *   RZCxPlan.SYSTEMS           the site systems the schematic and the 3D plant draw, with the
 *                              handbook 02.4.8 planning durations that ORDER them inside a level window
 *   RZCxPlan.sanitize(o)       clamp the owner's overrides (start / months / crew / shift)
 *   RZCxPlan.compute(input, o) RZEngine.models.commissioning.programPlan — the only arithmetic
 *   RZCxPlan.statusAt(plan, m) per-system Cx level at month m (tag colour per handbook 02.6)
 *   RZCxPlan.store(storage)    load / save the overrides (versioned payload, fails soft)
 *
 * Status rule (stated on the page): a level window comes from the plan; inside L2–L4 the systems
 * run electrical → mechanical → controls, each taking a share of the window proportional to its
 * handbook 02.4.8 planning days; L1 (FAT) and L5 (IST) are whole-window; a system's tag is the
 * LAST level whose gate date ≤ m (02.6 rule 1: the tag follows the signed gate record).
 * ES5, dual-target (window / module.exports). */
(function (root) {
  'use strict';

  var HB = 'cx-handbook/02-commissioning-process-levels-roles.html';
  var LEVELS = [
    { id: 'L0', key: 'l0', label: 'Design and planning review', primary: false, cite: HB + '#s02-4-1' },
    { id: 'L1', key: 'l1', label: 'Factory acceptance test', primary: true, cite: HB + '#s02-4-2', tag: 'red' },
    { id: 'L2', key: 'l2', label: 'Delivery and installation inspection', primary: true, cite: HB + '#s02-4-3', tag: 'yellow' },
    { id: 'L3', key: 'l3', label: 'Start-up and pre-functional checks', primary: true, cite: HB + '#s02-4-4', tag: 'green' },
    { id: 'L4', key: 'l4', label: 'Functional performance test', primary: true, cite: HB + '#s02-4-5', tag: 'blue' },
    { id: 'L5', key: 'l5', label: 'Integrated systems test', primary: true, cite: HB + '#s02-4-6', tag: 'white' },
    { id: 'L6', key: 'l6', label: 'Turnover and occupancy', primary: false, cite: HB + '#s02-4-7' }
  ];
  var CITES = {
    durations: HB + '#s02-4-8', tags: HB + '#s02-6', gates: HB + '#s02-5',
    ladders: { ups: HB + '#s02-7-1', chiller: HB + '#s02-7-2', crah: HB + '#s02-7-3', bms: HB + '#s02-7-4', epms: HB + '#s02-7-5', fire: HB + '#s02-7-6' },
    holdWitness: 'cx-handbook/07-itp-inspection-requests-hold-points.html',
    schedules: 'cx-handbook/11-meetings-reports-schedules.html',
    ist: 'cx-handbook/28-integrated-systems-testing.html',
    data: 'cx-handbook/30-commissioning-data-kpis.html'
  };
  /* Tag colours per handbook 02.6.1: the project scheme, semantic not decorative. */
  var TAGS = { red: 'L1', yellow: 'L2', green: 'L3', blue: 'L4', white: 'L5' };

  /* Planning days per level from handbook 02.4.8 (MSC-1 hall values; ranges at their midpoint,
   * per-unit rows taken per unit type). They ORDER systems inside a window; the window itself is
   * the plan's. block = which giant sheet draws the system. */
  var SYSTEMS = [
    { id: 'hv_intake', label: 'Utility 150 kV intake', block: 'electrical', ladder: null, days: { l2: 10, l3: 5, l4: 3 } },
    { id: 'main_tx', label: '150/20 kV main transformers', block: 'electrical', ladder: null, days: { l2: 10, l3: 5, l4: 3 } },
    { id: 'mv_board', label: '20 kV boards and feeders', block: 'electrical', ladder: null, days: { l2: 10, l3: 5, l4: 3 } },
    { id: 'generators', label: 'Generators and paralleling', block: 'electrical', ladder: null, days: { l2: 2, l3: 1, l4: 3 } },
    { id: 'unit_subs', label: '20/0.4 kV unit substations', block: 'electrical', ladder: null, days: { l2: 10, l3: 5, l4: 3 } },
    { id: 'ups', label: 'UPS and batteries', block: 'electrical', ladder: 'ups', days: { l2: 2, l3: 1, l4: 2 } },
    { id: 'lv_busway', label: 'LV switchboards, PDU and busway', block: 'electrical', ladder: null, days: { l2: 10, l3: 5, l4: 3 } },
    { id: 'chillers', label: 'Chillers', block: 'mechanical', ladder: 'chiller', days: { l2: 5, l3: 3, l4: 3 } },
    { id: 'dry_coolers', label: 'Dry coolers', block: 'mechanical', ladder: 'chiller', days: { l2: 5, l3: 3, l4: 3 } },
    { id: 'fws', label: 'FWS pumps, manifold and treatment', block: 'mechanical', ladder: 'chiller', days: { l2: 5, l3: 3, l4: 3 } },
    { id: 'cdu', label: 'CDUs', block: 'mechanical', ladder: null, days: { l2: 5, l3: 5, l4: 4 } },
    { id: 'crah', label: 'CRAH and fan walls', block: 'mechanical', ladder: 'crah', days: { l2: 5, l3: 5, l4: 3 } },
    { id: 'racks', label: 'Racks and TCS manifolds', block: 'mechanical', ladder: null, days: { l2: 5, l3: 5, l4: 4 } },
    { id: 'fire', label: 'Fire detection and suppression', block: 'controls', ladder: 'fire', days: { l2: 10, l3: 5, l4: 5 } },
    { id: 'bms', label: 'BMS', block: 'controls', ladder: 'bms', days: { l2: 7.5, l3: 12.5, l4: 12.5 } },
    { id: 'epms', label: 'EPMS / PME', block: 'controls', ladder: 'epms', days: { l2: 5, l3: 10, l4: 5 } },
    { id: 'ot_network', label: 'OT network and DCIM', block: 'controls', ladder: null, days: { l2: 5, l3: 10, l4: 5 } }
  ];
  var BLOCK_ORDER = ['electrical', 'mechanical', 'controls'];

  var LIMITS = { start: [0, 120], months: [0.1, 60], crew: [0.5, 200] };
  var SHIFTS = ['1x8', '2x12'];
  function num(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : undefined; }
  function sanitizeOne(o) {
    if (!o || typeof o !== 'object') return null;
    var out = {}, v;
    v = num(o.start, LIMITS.start[0], LIMITS.start[1]); if (v !== undefined) out.start = Math.round(v * 100) / 100;
    v = num(o.months, LIMITS.months[0], LIMITS.months[1]); if (v !== undefined) out.months = Math.round(v * 100) / 100;
    v = num(o.crew, LIMITS.crew[0], LIMITS.crew[1]); if (v !== undefined) out.crew = Math.round(v * 10) / 10;
    if (SHIFTS.indexOf(o.shift) !== -1) out.shift = o.shift;
    for (var k in out) if (Object.prototype.hasOwnProperty.call(out, k)) return out;
    return null;
  }
  function sanitize(o) {
    var out = {};
    if (!o || typeof o !== 'object') return out;
    for (var i = 0; i < LEVELS.length; i++) { var s = sanitizeOne(o[LEVELS[i].id]); if (s) out[LEVELS[i].id] = s; }
    return out;
  }

  function engine() { var E = root.RZEngine; return E && E.models && E.models.commissioning; }
  function compute(input, overrides) {
    var C = engine();
    if (!C || typeof C.programPlan !== 'function') return null;
    try { return C.programPlan(input, sanitize(overrides)); } catch (e) { return null; }
  }

  /* Gate month of system s at level L, from the plan's windows. */
  function gateMonths(plan) {
    var win = {}, i, l;
    for (i = 0; i < plan.levels.length; i++) { l = plan.levels[i]; win[l.id] = { start: l.start, end: l.end, months: l.months }; }
    var totals = { l2: 0, l3: 0, l4: 0 }, order = SYSTEMS.slice().sort(function (a, b) { return BLOCK_ORDER.indexOf(a.block) - BLOCK_ORDER.indexOf(b.block); });
    var k;
    for (i = 0; i < order.length; i++) for (k in totals) if (Object.prototype.hasOwnProperty.call(totals, k)) totals[k] += order[i].days[k];
    var cum = { l2: 0, l3: 0, l4: 0 }, out = {};
    for (i = 0; i < order.length; i++) {
      var s = order[i], g = {};
      g.L1 = win.L1 ? win.L1.end : null;                       // FAT: whole window
      for (k in cum) if (Object.prototype.hasOwnProperty.call(cum, k)) {
        var id = k.toUpperCase(), w = win[id];
        cum[k] += s.days[k];
        g[id] = w ? w.start + w.months * (cum[k] / totals[k]) : null;   // packed share of the window
      }
      g.L5 = win.L5 ? win.L5.end : null;                       // IST: everything passes at the end
      out[s.id] = g;
    }
    return out;
  }
  var LEVEL_SEQ = ['L1', 'L2', 'L3', 'L4', 'L5'];
  function statusAt(plan, month) {
    if (!plan || !plan.levels) return null;
    var gates = gateMonths(plan), rows = [], counts = { none: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 }, i, j;
    for (i = 0; i < SYSTEMS.length; i++) {
      var s = SYSTEMS[i], g = gates[s.id], level = null, next = null, changed = false, inTest = false;
      for (j = 0; j < LEVEL_SEQ.length; j++) {
        var L = LEVEL_SEQ[j], at = g[L];
        if (at !== null && at <= month) { level = L; if (at > month - 1) changed = true; }
        else if (next === null) { next = L; }
      }
      if (next !== null) {
        var w = null;
        for (j = 0; j < plan.levels.length; j++) if (plan.levels[j].id === next) w = plan.levels[j];
        inTest = !!w && month >= w.start && month < g[next];
      }
      var tag = null; for (var t in TAGS) if (Object.prototype.hasOwnProperty.call(TAGS, t) && TAGS[t] === level) tag = t;
      rows.push({ id: s.id, label: s.label, block: s.block, ladder: s.ladder ? CITES.ladders[s.ladder] : null,
                  level: level, tag: tag, next: next, inTest: inTest, changed: changed, gates: g });
      counts[level || 'none']++;
    }
    return { month: month, systems: rows, counts: counts, finishMonth: plan.finishMonth };
  }

  var KEY = 'rz-cx-plan';
  function store(storage) {
    storage = storage || (typeof root.localStorage !== 'undefined' ? root.localStorage : null);
    return {
      /* payload v2 (3.26.1) adds calendar { anchor ISO | null, slot bool } and extension lines[]; v1 still loads. */
      load: function () {
        var empty = { overrides: {}, siteCrewCap: null, calendar: { anchor: null, slot: false }, lines: [] };
        if (!storage) return empty;
        try {
          var raw = storage.getItem(KEY); if (!raw) return empty;
          var p = JSON.parse(raw); if (!p || (p.version !== 1 && p.version !== 2)) return empty;
          var cal = p.version === 2 && p.calendar && typeof p.calendar === 'object' ? p.calendar : {};
          var anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(cal.anchor || '')) ? cal.anchor : null;
          var lines = p.version === 2 && p.lines && typeof p.lines === 'object' && typeof p.lines.length === 'number' ? p.lines : [];
          if (root.RZCxIo && typeof root.RZCxIo.sanitizeLines === 'function') lines = root.RZCxIo.sanitizeLines(lines);
          return { overrides: sanitize(p.overrides), siteCrewCap: num(p.siteCrewCap, 1, 1000) === undefined ? null : p.siteCrewCap,
                   calendar: { anchor: anchor, slot: cal.slot === undefined ? !!anchor : cal.slot === true }, lines: lines };
        } catch (e) { return empty; }
      },
      save: function (overrides, siteCrewCap, extra) {
        if (!storage) return false;
        extra = extra || {};
        var cal = extra.calendar || {}, anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(cal.anchor || '')) ? cal.anchor : null;
        try { storage.setItem(KEY, JSON.stringify({ version: 2, overrides: sanitize(overrides), siteCrewCap: num(siteCrewCap, 1, 1000) === undefined ? null : siteCrewCap,
          calendar: { anchor: anchor, slot: cal.slot === true }, lines: extra.lines && typeof extra.lines.length === 'number' ? extra.lines : [] })); return true; } catch (e) { return false; }
      },
      clear: function () { if (!storage) return; try { storage.removeItem(KEY); } catch (e) { /* nothing to clear */ } }
    };
  }

  /* impact(plan, base, cap) — what a scenario changed against the approved baseline, for the workbench's impact
   * panel (PRD §22). Every number is a difference of two engine plans (programPlan with and without the
   * overrides); nothing is re-derived here. cause: 'edited' (the level carries an override), 'carried' (moved
   * because an earlier level moved — levels run in series), or null. */
  function r1(v) { return Math.round(v * 10) / 10; }
  function impact(plan, base, cap) {
    if (!plan || !base || !plan.levels || !base.levels) return null;
    var levels = [], reasons = [], warnings = [], lastMoved = null, i;
    for (i = 0; i < plan.levels.length; i++) {
      var L = plan.levels[i], B = base.levels[i] || L.baseline;
      var row = { id: L.id, dStart: r1(L.start - B.start), dEnd: r1(L.end - B.end), dMonths: r1(L.months - B.months),
                  dCrew: r1(L.crew - B.crew), dCost: L.cost - B.cost, dManHours: L.manHours - B.manHours, shift: L.shift, cause: null, from: null };
      if (L.edited) {
        row.cause = 'edited';
        var bits = [];
        if (row.dStart) bits.push('start ' + fmtMo(B.start) + ' → ' + fmtMo(L.start) + ' (' + (row.dStart > 0 ? '+' : '−') + Math.abs(row.dStart).toFixed(1) + ' mo)');
        if (row.dMonths) bits.push('duration ' + B.months.toFixed(1) + ' → ' + L.months.toFixed(1) + ' mo' + (row.dCrew ? '' : ', same effort'));
        if (row.dCrew) bits.push('crew ' + B.crew + ' → ' + L.crew + ' (labour cost follows crew)');
        if (L.shift !== '1x8') bits.push('shift ' + L.shift.replace('x', '×') + ' (engine shift table: rate and productivity)');
        if (L.id === 'L5' && row.dMonths) bits.push('witness days follow the L5 duration');
        reasons.push({ id: L.id, text: L.id + ' edited: ' + (bits.length ? bits.join('; ') : 'override equals the baseline') });
      } else if (row.dStart && lastMoved) {
        row.cause = 'carried'; row.from = lastMoved;
        reasons.push({ id: L.id, text: L.id + ' moves ' + (row.dStart > 0 ? '+' : '−') + Math.abs(row.dStart).toFixed(1) + ' mo — carried from ' + lastMoved + ' (levels run in series)' });
      }
      if (row.dEnd) lastMoved = row.cause === 'carried' ? row.from : L.id;
      if (i > 0) {
        var prev = plan.levels[i - 1], lap = r1(prev.end - L.start);
        if (lap > 0 && lap > r1(base.levels[i - 1].end - B.start)) warnings.push({ kind: 'overlap', id: L.id, months: [], text: L.id + ' starts ' + lap.toFixed(1) + ' mo before ' + prev.id + ' ends — the handbook gate sequence expects ' + prev.id + ' accepted first' });
      }
      levels.push(row);
    }
    var n = Math.max(plan.monthly.cost.length, base.monthly.cost.length), monthly = [], changed = 0, m;
    for (m = 0; m < n; m++) {
      var sc = plan.monthly.cost[m] || 0, bc = base.monthly.cost[m] || 0;
      monthly.push({ m: m, base: bc, scen: sc, d: sc - bc }); if (Math.abs(sc - bc) >= 1) changed++;
    }
    var peak = Math.max.apply(null, plan.monthly.crew.concat([0])), basePeak = Math.max.apply(null, base.monthly.crew.concat([0]));
    if (cap != null && isFinite(cap)) {
      var over = []; for (m = 0; m < plan.monthly.crew.length; m++) if (plan.monthly.crew[m] > cap) over.push(m);
      if (over.length) warnings.push({ kind: 'over-cap', id: null, months: over, text: over.length + ' month' + (over.length > 1 ? 's' : '') + ' above the site crew cap of ' + cap + ' (peak ' + peak.toFixed(1) + ' at M' + plan.monthly.crew.indexOf(peak) + ')' });
    }
    return { dFinish: r1(plan.finishMonth - base.finishMonth), dCost: plan.total - base.total, dManHours: plan.manHours - base.manHours,
             peakCrew: peak, basePeakCrew: basePeak, dPeakCrew: r1(peak - basePeak),
             levels: levels, reasons: reasons, warnings: warnings, monthly: monthly, changedMonths: changed };
  }

  /* scenarios(storage) — named copies of a plan state (PRD §22 "Save as", max 5, this browser only). */
  var SCEN_KEY = 'rz-cx-scenarios', SCEN_MAX = 5;
  function scenarios(storage) {
    function read() {
      if (!storage) return [];
      try {
        var p = JSON.parse(storage.getItem(SCEN_KEY) || 'null'); if (!p || p.version !== 1 || !p.items || typeof p.items.length !== 'number') return [];
        var out = [];
        for (var i = 0; i < p.items.length && out.length < SCEN_MAX; i++) { var it = p.items[i]; if (it && typeof it.name === 'string' && it.name.trim()) out.push(clean(it.name, it)); }
        return out;
      } catch (e) { return []; }
    }
    function clean(name, st) {
      st = st || {};
      var lines = st.lines && typeof st.lines.length === 'number' ? st.lines : [];
      if (root.RZCxIo && typeof root.RZCxIo.sanitizeLines === 'function') lines = root.RZCxIo.sanitizeLines(lines);
      return { name: String(name).trim(), overrides: sanitize(st.overrides), siteCrewCap: num(st.siteCrewCap, 1, 1000) === undefined ? null : st.siteCrewCap,
               lines: lines, savedAt: typeof st.savedAt === 'string' ? st.savedAt : null };
    }
    function write(items) { if (!storage) return false; try { storage.setItem(SCEN_KEY, JSON.stringify({ version: 1, items: items })); return true; } catch (e) { return false; } }
    function idx(items, name) { for (var i = 0; i < items.length; i++) if (items[i].name === name) return i; return -1; }
    return {
      list: read,
      get: function (name) { var items = read(), k = idx(items, String(name || '').trim()); return k < 0 ? null : items[k]; },
      save: function (name, st) {
        var nm = String(name == null ? '' : name).trim(); if (!nm || nm.length > 40) return { ok: false, code: 'NAME' };
        if (!storage) return { ok: false, code: 'STORAGE' };
        var items = read(), k = idx(items, nm), rec = clean(nm, st); var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; rec.savedAt = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());   // local time: the viewer's own clock
        if (k < 0 && items.length >= SCEN_MAX) return { ok: false, code: 'FULL' };
        if (k < 0) items.push(rec); else items[k] = rec;
        return write(items) ? { ok: true, code: k < 0 ? 'ADDED' : 'REPLACED' } : { ok: false, code: 'STORAGE' };
      },
      remove: function (name) { var items = read(), k = idx(items, String(name || '').trim()); if (k < 0) return false; items.splice(k, 1); return write(items); }
    };
  }

  function fmtUsd(v) { return v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : '$' + Math.round(v); }
  function fmtInt(v) { return Math.round(v).toLocaleString('en-US'); }
  function fmtMo(v) { return 'M' + (Math.round(v * 10) / 10).toFixed(1); }

  var API = { LEVELS: LEVELS, SYSTEMS: SYSTEMS, CITES: CITES, TAGS: TAGS, SHIFTS: SHIFTS, LIMITS: LIMITS, KEY: KEY,
              sanitize: sanitize, compute: compute, gateMonths: gateMonths, statusAt: statusAt, store: store, impact: impact, scenarios: scenarios, SCEN_KEY: SCEN_KEY, SCEN_MAX: SCEN_MAX,
              fmtUsd: fmtUsd, fmtInt: fmtInt, fmtMo: fmtMo };
  root.RZCxPlan = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);   /* CommonJS: `this` is the ORIGINAL exports object, replaced by module.exports = API below — root.RZEngine would be unreachable; globalThis is where Node consumers (dcmoc bridge, gates) put the engine */
