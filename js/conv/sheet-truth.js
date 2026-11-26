/*
 * sheet-truth.js — window.RZConvTruth: per-point value + data quality for the Conventional HMI sheets
 * (PRD-CONV-BMS-UIUX laws B1, B3, B6).
 *
 *   createStore(defs)  defs = { pointId: { unit, digits, label } }. set(id, { value, quality, t }) stores a NEW
 *                      frozen record (records are never edited in place); get(id) returns it.
 *                      quality is one of good | stale | bad | nodata.
 *   text(rec, def)     good -> value with def.digits + ' ' + unit (a valid zero prints 0, never a dash);
 *                      stale -> 'STALE' plus the last value in parentheses when there is one;
 *                      bad -> 'BAD'; nodata -> 'NO DATA'.
 *   flowState(rec)     good and > 0 -> 'running'; good and 0 -> 'stopped'; anything else -> 'unavailable'.
 *                      An edge animates only when its point is measured, good and > 0.
 *   seam(api, rerender) installs window.RZConvSim, ONLY when <body data-rz-data-mode="simulated">. A key the page
 *                      does not provide (setPump and tick exist only where the page models pumps and a scan tick)
 *                      throws when called.
 *
 * RZConvSim is a SIMULATION / TEST SEAM. It changes what the page believes it measured so a gate (or a person on the
 * simulated page) can force a stale point, a zero or a trip. It is never a write path to equipment: it has no network
 * call, no command channel, and it does not exist on a page in any other data mode.
 */
(function (root) {
  'use strict';
  if (!root) return;

  var QUALITIES = { good: 1, stale: 1, bad: 1, nodata: 1 };
  var SEAM_KEYS = ['points', 'edgesOf', 'setPoint', 'setPump', 'tick', 'trip', 'clearTrip', 'ack', 'snapshot'];

  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  function freeze(o) { return Object.freeze ? Object.freeze(o) : o; }

  function record(rec) {
    var r = rec || {};
    var q = r.quality || 'nodata';
    if (!QUALITIES[q]) throw new Error('RZConvTruth: unknown quality "' + q + '"');
    var v = isNum(r.value) ? r.value : null;
    /* a good point without a number is not evidence: it degrades to nodata, never to 0 */
    if (q === 'good' && v === null) q = 'nodata';
    return freeze({ value: v, quality: q, t: isNum(r.t) ? r.t : Date.now() });
  }

  function createStore(defs) {
    var d = defs || {}, recs = {};
    Object.keys(d).forEach(function (id) { recs[id] = record({ quality: 'nodata' }); });
    return {
      ids: function () { return Object.keys(d); },
      def: function (id) { return d[id] || null; },
      has: function (id) { return Object.prototype.hasOwnProperty.call(d, id); },
      set: function (id, rec) {
        if (!Object.prototype.hasOwnProperty.call(d, id)) throw new Error('RZConvTruth: unknown point "' + id + '"');
        recs[id] = record(rec);
        return recs[id];
      },
      get: function (id) { return recs[id] || null; }
    };
  }

  function num(v, def) {
    var digits = def && isNum(def.digits) ? def.digits : 1;
    var s = v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return s + (def && def.unit ? ' ' + def.unit : '');
  }

  function text(rec, def) {
    if (!rec) return 'NO DATA';
    switch (rec.quality) {
      case 'good': return isNum(rec.value) ? num(rec.value, def) : 'NO DATA';
      case 'stale': return isNum(rec.value) ? 'STALE (' + num(rec.value, def) + ')' : 'STALE';
      case 'bad': return 'BAD';
      default: return 'NO DATA';
    }
  }

  function flowState(rec) {
    if (!rec || rec.quality !== 'good' || !isNum(rec.value)) return 'unavailable';
    if (rec.value > 0) return 'running';
    if (rec.value === 0) return 'stopped';
    return 'unavailable';
  }

  function seam(api, rerender) {
    var body = root.document && root.document.body;
    if (!body || body.getAttribute('data-rz-data-mode') !== 'simulated') return null;
    var sim = {};
    SEAM_KEYS.forEach(function (k) {
      var fn = api && api[k];
      sim[k] = function () {
        if (typeof fn !== 'function') throw new Error('RZConvSim.' + k + ' is not provided by this page');
        var out = fn.apply(null, arguments);
        /* B4: the seam's acknowledge reaches the sheet marks; a cleared trip forgets its ack */
        if (k === 'ack' && out !== false) ACKED[arguments[0]] = true;
        if ((k === 'clearTrip' || k === 'trip') && out !== false) delete ACKED[arguments[0]];
        if (typeof rerender === 'function') rerender();
        return out;
      };
    });
    sim.simulated = true;
    root.RZConvSim = freeze(sim);
    return root.RZConvSim;
  }

  /* B5: one inspector payload for any sheet node, built only from what the sheet already knows — the node
     definition, the page's read(n) output and the point store. Nothing here invents a value: a row prints the
     sheet's own text, and a row backed by a point carries that point's quality. */
  var VALUE_LABEL = { st: 'State', cmd: 'Command', q: 'Flow', p: 'Pressure', lvl: 'Level', vol: 'Volume', dur: 'Autonomy',
    pct: 'Level', use: 'Usable', mw: 'Load' };
  function endNode(end) { return typeof end === 'string' ? end.split('.')[0] : null; }
  /* D-1 (CONV_EXECUTION_PLAN_2026-11-16 AD1): js/conv/payloads.js is the builder now; this keeps the old call shape.
     Without payloads.js loaded the legacy body below still answers, so no page breaks on a missing script. */
  function sheetsOf(edges) {
    var out = null;
    Object.keys(root).forEach(function (k) {
      if (out || !/^RZ[A-Za-z]+Sheets$/.test(k)) return;
      var S = root[k]; if (!S) return;
      Object.keys(S).forEach(function (sk) { if (!out && S[sk] && S[sk].edges === edges) out = S[sk]; });
    });
    return out;
  }
  function sheetPayload(o) {
    if (root.RZConvPayloads) {
      var sh = o.nodes ? null : sheetsOf(o.edges);
      var x = {}; Object.keys(o).forEach(function (k) { x[k] = o[k]; });
      x.page = o.page || o.classId; x.nodes = o.nodes || (sh ? sh.nodes : []);
      if (typeof x.tick !== 'number') x.tick = Math.floor(Date.now() / 4000);
      return root.RZConvPayloads.build(x);
    }
    return legacyPayload(o);
  }
  function legacyPayload(o) {
    var n = o.node, r = o.read || {}, values = r.values || {}, live = [], alarms = [];
    var tag = n.tag || n.id, quality = { good: 'measured', stale: 'stale', bad: 'bad', nodata: 'no data' };
    Object.keys(values).forEach(function (k) {
      var v = values[k] || {}, pid = n.id + ':' + k, rec = o.store && o.store.ids().indexOf(pid) >= 0 ? o.store.get(pid) : null;
      var row = { label: VALUE_LABEL[k] || k.toUpperCase(), text: v.text == null ? '—' : String(v.text), unit: '',
        quality: rec ? (rec.quality === 'good' ? 'simulated' : 'state') : 'simulated',
        declared: rec ? ('point ' + pid + ' · quality ' + (quality[rec.quality] || rec.quality) + ' · ' + o.declared) : o.declared };
      live.push(row);
      if (v.alarm) alarms.push({ severity: v.alarm === '1' ? 'CRITICAL' : 'WARNING', lifecycle: o.acked ? 'acknowledged' : 'active',
        tag: tag, point: pid, message: row.label + ' ' + row.text });
    });
    if (r.mismatch || (o.mismatch && o.mismatch(n.id))) alarms.push({ severity: 'WARNING', lifecycle: 'active', tag: tag, point: n.id + ':cmd',
      message: 'command and feedback disagree' });
    var up = [], down = [], seen = {};
    (o.edges || []).forEach(function (e) {
      var a = endNode(e.from), b = endNode(e.to);
      if (b === n.id && a && a !== n.id && !seen['u' + a]) { seen['u' + a] = 1; up.push({ id: a, label: a.toUpperCase() }); }
      if (a === n.id && b && b !== n.id && !seen['d' + b]) { seen['d' + b] = 1; down.push({ id: b, label: b.toUpperCase() }); }
    });
    var al = r.alarm || (alarms.length ? '2' : null);
    var chip = al === '1' ? { label: 'ALARM', state: 'alarm' } : (al ? { label: 'WARNING', state: 'warning' }
      : { label: String(r.state || 'normal').toUpperCase(), state: 'normal' });
    return {
      classId: o.classId, id: n.id, hall: null, title: tag + (n.label ? ' — ' + n.label : ''), kind: n.sym, label: o.scope || 'site-wide plant',
      statusChip: chip,
      tabs: { live: live, capacity: [], deps: { upstream: up, downstream: down, edges: [] }, alarms: alarms, trend: null, maint: [] },
      actions: { openHmi: null, related: [] },
      provenance: { engineVersion: o.engineVersion || '—', registryVersion: '—', scenarioId: o.scenario || 'simulated', coolingScenarioId: 'site', tick: o.tick || 0,
        counts: { derived: 0, published: 0, simulated: live.length, state: 0 } }
    };
  }
  /* open(n, api, el) handler for RZHmiSheet: inspector beside the sheet; focus returns to the symbol on close */
  /* AD5: "Open equipment HMI" in the inspector, or a double-click on the symbol, opens the deep modal
     (js/conv/equipment-modal.js) on the same payload, refreshed every 4 s while it is open. */
  /* more(n) (optional, E2): extra modal options for this item, e.g. { internal: {...} } for a machine whose inside is drawn
     (js/conv/internals.js); returning null leaves the modal exactly as before */
  function deep(build, n, trigger, sym, more) {
    if (!root.RZConvModal) return false;
    var p = build(n); if (!p) return false;
    var o = { trigger: trigger, symbol: sym, rebuild: function () { return build(n); } }, x = more ? more(n) : null;
    if (x) Object.keys(x).forEach(function (k) { o[k] = x[k]; });
    return root.RZConvModal.open(p, o);
  }
  var DBL = {};
  function opener(build, hostSel, more) {
    var last = {};
    if (!DBL[hostSel] && root.document) {
      DBL[hostSel] = 1;
      root.document.addEventListener('dblclick', function (e) {
        var g = e.target && e.target.closest ? e.target.closest(hostSel + ' .hmi-node[data-node]') : null;
        if (!g || !last.n || last.n.id !== g.getAttribute('data-node')) return;
        e.preventDefault(); deep(build, last.n, g, g, more);
      }, true);
    }
    return function (n, api, el) {
      last.n = n;
      /* R186 (PRD-CONV-EQUIPMENT-INSIDE I1): a machine whose inside is drawn opens on that drawing with ONE click (or
         Enter); the side inspector stays for what has no inside yet (lines, instruments, classes not drawn) */
      var x = more ? more(n) : null;
      if (x && x.internal && root.RZConvInternals && root.RZConvInternals.has(x.internal.classKey) &&
          deep(build, n, el, el, function () { return x; })) return;
      if (!root.RZInspector || typeof root.RZInspector.openPayload !== 'function') return;
      var payload = build(n); if (!payload) return;
      /* PRD-SETPOINT-SIM P9: a controller bubble (n.ctrl = the node it drives) keeps its own inspector; "Open equipment
         HMI" opens the machine it controls (PC-FP1 -> fire pump 1, LIC-A1 -> its day tank) */
      var target = n, tn = n.ctrl && api && api.sheet && api.sheet.nodes ? api.sheet.nodes.filter(function (x) { return x.id === n.ctrl; })[0] : null;
      if (tn) { target = tn; if (!(payload.actions && payload.actions.openHmi)) { var q = {}; Object.keys(payload).forEach(function (k) { q[k] = payload[k]; });
        q.actions = { openHmi: true, related: (payload.actions && payload.actions.related) || [] }; payload = q; }
        /* a controller bubble has no machine class: its Alarms are the limits of the process value it holds, read from the
           limits registry by the id the controlled unit prints (the day-tank level an LIC holds: fuel-system.DT.level_pct).
           Never the unit CLASS's alarms or trend: the day tank shares its class with the bulk tank (fuel.level_pct). */
        var pt = payload.tabs || {}, PS = root.RZPointStatus, al = [];
        if (!(pt.alarmPoints || []).length && PS && PS.limits) (tn.values || []).forEach(function (v) {
          var lid = v.limitsOf || v.point, L = lid ? PS.limits(lid) : null; if (!L || al.length) return;
          var u = L.unit || '', why = (L.evidenceClass ? L.evidenceClass + ' · ' : '') + 'limits registry ' + lid;
          [['lo_alarm', 'Low alarm'], ['lo_warn', 'Low warning'], ['hi_warn', 'High warning'], ['hi_alarm', 'High alarm']].forEach(function (b) {
            if (typeof L[b[0]] === 'number') al.push({ label: b[1] + ' · ' + (v.label || lid), text: String(L[b[0]]), unit: u, quality: 'declared', declared: why }); });
        });
        if (al.length) { var t2 = {}; Object.keys(pt).forEach(function (k) { t2[k] = pt[k]; }); t2.alarmPoints = al;
          var q2 = {}; Object.keys(payload).forEach(function (k) { q2[k] = payload[k]; }); q2.tabs = t2; payload = q2; } }
      root.RZInspector.openPayload(payload, { trigger: el,
        onOpenHmi: function (p, btn) { deep(build, target, btn, el, more); },
        onNavigate: function (id) {
          var t = document.querySelector(hostSel + ' .hmi-node[data-node="' + id + '"]');
          if (t && t.dispatchEvent) t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } });
    };
  }
  /* B4: alarm, acknowledged and selected stay distinguishable without colour. An asset in alarm carries a drawn
     mark at the top-right of its body: a filled triangle with "!" while unacknowledged, a hollow triangle with "ACK"
     once acknowledged (the alarm stays visible while its source is active). Selection is a dashed body outline
     (css/conv-hmi-depth.css). Marks are redrawn after every sheet update; they take no pointer events. */
  var ACKED = {};
  var NSV = 'http://www.w3.org/2000/svg';
  function marks(svg) {
    if (!svg) return;
    var layer = svg.querySelector('g.cv-marks');
    if (!layer) { layer = root.document.createElementNS(NSV, 'g'); layer.setAttribute('class', 'cv-marks'); layer.setAttribute('aria-hidden', 'true'); svg.appendChild(layer); }
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    var inv; try { inv = svg.getScreenCTM().inverse(); } catch (e) { return; }
    var pt = svg.createSVGPoint();
    svg.querySelectorAll('.hmi-node[data-alarm]').forEach(function (g) {
      var id = g.getAttribute('data-node'), b = g.querySelector('.b') || g, r = b.getBoundingClientRect();
      if (r.width < 1) return;
      pt.x = r.right; pt.y = r.top; var q = pt.matrixTransform(inv), x = q.x + 2, y = q.y - 2, acked = !!ACKED[id];
      var m = root.document.createElementNS(NSV, 'g');
      m.setAttribute('class', 'cv-mark' + (acked ? ' is-acked' : ''));
      m.setAttribute('data-for', id); m.setAttribute('data-ack', acked ? '1' : '0'); m.setAttribute('data-sev', g.getAttribute('data-alarm'));
      m.setAttribute('transform', 'translate(' + Math.round(x * 10) / 10 + ' ' + Math.round(y * 10) / 10 + ')');
      var tri = root.document.createElementNS(NSV, 'path'); tri.setAttribute('d', 'M0 -7 L6 4 L-6 4 Z'); tri.setAttribute('class', 'cv-mark-tri');
      var t = root.document.createElementNS(NSV, 'text'); t.setAttribute('class', 'cv-mark-txt'); t.setAttribute('text-anchor', acked ? 'start' : 'middle');
      t.setAttribute('x', acked ? '8' : '0'); t.setAttribute('y', acked ? '3.4' : '2.6'); t.textContent = acked ? 'ACK' : '!';
      m.appendChild(tri); m.appendChild(t); layer.appendChild(m);
    });
  }
  function acked() { return Object.keys(ACKED); }
  root.RZConvTruth = freeze({ createStore: createStore, text: text, flowState: flowState, seam: seam, sheetPayload: sheetPayload, opener: opener, marks: marks, acked: acked });
})(typeof window !== 'undefined' ? window : null);
