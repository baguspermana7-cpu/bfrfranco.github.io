/*!
 * rz-pid-graph.js — the P&ID model's public face (resistancezero.com, R116/R117): window.RZPid
 *
 * Depends on rz-pid-build.js (the graph builder ported from PID-to-Knowledge-Graph, MIT — its notice is in that
 * file). This file adds what is RZ: the three-part explanation (process flow, measurement, control loops), the
 * coolant-order rank, the heat balance and the RZExplain key of a tag. R120: the reference's per-sheet tag scoping
 * and QA report, and what it cannot do: trace, loopOf, impact (what a failure does) and live (model output by load).
 * Works in Node (module.exports) and in the browser (window.RZPid). Vanilla ES5, no build.
 */
(function (root) {
  'use strict';
  if (root.RZPid && root.RZPid.balance) { if (typeof module !== 'undefined' && module.exports) module.exports = root.RZPid; return; }
  var Bm = root.RZPidBuild || (typeof require === 'function' ? require('./rz-pid-build.js') : null);
  if (!Bm) throw new Error('rz-pid-graph.js: load rz-pid-build.js first');
  var U = Bm._, has = U.has, nearest = U.nearest, TERMINAL_TYPES = U.TERMINAL_TYPES;
  var parseIsaTag = Bm.parseIsaTag, N = Bm.normalizeTag;
  /* Reader-facing words for the decode ("FIC = Flow, Indicating, Controller"). */
  var FN_WORD = { A: 'Alarm', C: 'Controller', E: 'Element', G: 'Gauge', H: 'High', I: 'Indicating',
    K: 'Control station', L: 'Low', M: 'Middle', O: 'Orifice', P: 'Test point', Q: 'Totalizing',
    R: 'Recording', S: 'Switch', T: 'Transmitter', U: 'Multifunction', V: 'Valve', W: 'Well',
    X: 'Unclassified', Y: 'Relay / converter', Z: 'Driver' };
  var LOCATION_WORD = { field: 'field mounted', local_panel: 'local panel', main_panel: 'main control panel',
    behind_panel: 'behind the panel', dcs: 'DCS / shared display', plc: 'PLC', scada: 'SCADA',
    sis: 'safety system', computer: 'computer function', unknown: 'location not shown' };
  /* "FIC" -> "Flow, Indicating, Controller" */
  function decodeTag(tag) {
    var isa = parseIsaTag(tag);
    if (!isa) return null;
    var words = [];
    var v = U.ISA_MEASURED[isa.letters.charAt(0)];
    if (isa.modifiers.length) v = isa.modifiers[0] + ' ' + v;
    words.push(v.charAt(0).toUpperCase() + v.slice(1));
    if (isa.role === 'relief_device') words.push('Safety', 'Valve');
    else for (var i = 0; i < isa.fnLetters.length; i++) words.push(FN_WORD[isa.fnLetters.charAt(i)] || isa.fnLetters.charAt(i));
    return { letters: isa.letters, words: words, text: isa.letters + ' = ' + words.join(', ') };
  }

  /* A heat balance that misses its declared duty by more than this is a discrepancy the data must carry. */
  var BALANCE_TOLERANCE = 0.03;

  /* ------------------------------------------------------------ explanation (summary.py + RZ) */
  function index(g) {
    var out = {}, inn = {};
    g.edges.forEach(function (e) { (out[e.source] = out[e.source] || []).push(e); (inn[e.target] = inn[e.target] || []).push(e); });
    return { out: function (id, t) { return (out[id] || []).filter(function (e) { return !t || e.type === t; }); },
      inn: function (id, t) { return (inn[id] || []).filter(function (e) { return !t || e.type === t; }); } };
  }
  function flowOrder(g, ix) {
    function byLabel(a, b) { var la = g.byId[a].label, lb = g.byId[b].label; return la < lb ? -1 : la > lb ? 1 : 0; }
    var feedsIn = {};
    g.edges.forEach(function (e) { if (e.type === 'FEEDS') feedsIn[e.target] = (feedsIn[e.target] || 0) + 1; });
    var terminals = g.nodes.filter(function (n) { return n.type === 'Equipment' || n.type === 'Boundary'; }).map(function (n) { return n.id; });
    var starts = terminals.filter(function (t) { return !feedsIn[t]; });
    starts.sort(function (a, b) {
      var ka = (g.byId[a].type !== 'Boundary' ? 1 : 0), kb = (g.byId[b].type !== 'Boundary' ? 1 : 0);
      if (ka !== kb) return ka - kb;
      var sa = g.byId[a].sheets[0] || '', sb = g.byId[b].sheets[0] || '';
      if (sa !== sb) return sa < sb ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    var order = [], seen = {};
    starts.concat(terminals).forEach(function (s) {
      if (seen[s]) return;
      var queue = [s];
      while (queue.length) {
        var cur = queue.shift(); if (seen[cur]) continue; seen[cur] = true; order.push(cur);
        /* RZ: siblings in label order so a reader meets P-01A before P-01B */
        ix.out(cur, 'FEEDS').map(function (e) { return e.target; }).sort(byLabel).forEach(function (t) { queue.push(t); });
      }
    });
    return order;
  }
  /* Everything the flow passes between `start` and the next terminal(s). stopAt(node) decides terminals. */
  function walkDown(g, ix, start, stopAt) {
    var ids = [], seen = {}, stack = [start]; seen[start] = true;
    while (stack.length) {
      var cur = stack.pop();
      ix.out(cur, 'FLOWS_TO').forEach(function (e) {
        ids.push(e.id);
        var t = e.target;
        if (seen[t]) return; seen[t] = true; ids.push(t);
        if (!stopAt(g.byId[t])) stack.push(t);
      });
    }
    return ids;
  }
  function uniq(a) { var o = [], s = {}; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function joinAnd(list) { if (list.length < 2) return list.join(''); return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function nameOf(n) { return n.name && n.name !== n.label ? n.label + ' (' + n.name + ')' : n.label; }
  function serviceOf(g, ix, from, to) {
    // service of the first pipe segment leaving `from` on the way to `to`
    var segs = ix.out(from, 'FLOWS_TO').map(function (e) { return g.byId[e.target]; }).filter(function (n) { return n.type === 'PipeSegment'; });
    for (var i = 0; i < segs.length; i++) {
      var reach = walkDown(g, ix, segs[i].id, function (n) { return has(TERMINAL_TYPES, n.type); });
      if (reach.indexOf(to) >= 0) return segs[i].attributes.service || null;
    }
    return null;
  }
  function valueText(n) {
    var a = n.attributes || {}, parts = [];
    if (a.value !== undefined) parts.push(a.value + (a.unit ? ' ' + a.unit : ''));
    if (a.band) parts.push('normal band ' + a.band + (a.unit ? ' ' + a.unit : ''));
    return parts.join(', ');
  }
  function measuredWhere(g, ix, inst) {
    var n = g.byId[inst];
    if (n.attributes.inline) return 'in-line ' + lineWords(g, ix, inst);
    return ix.out(inst, 'MEASURES').map(function (e) { var t = g.byId[e.target]; return t.type === 'PipeSegment' ? 'on ' + lineWords(g, ix, t.id) : 'on ' + nameOf(t); }).join('; ');
  }
  function lineWords(g, ix, nid) {
    var n = g.byId[nid];
    var seg = n.type === 'PipeSegment' ? n : null;
    if (!seg) ix.inn(nid, 'FLOWS_TO').forEach(function (e) { if (!seg && g.byId[e.source].type === 'PipeSegment') seg = g.byId[e.source]; });
    var up = nearest(nid, g.byId, g.edges, true), down = nearest(nid, g.byId, g.edges, false);
    var svc = seg ? (seg.attributes.service || seg.attributes.line_number || 'the line') : 'the line';
    return svc + ' between ' + (up || '?') + ' and ' + (down || '?');
  }
  function explain(g, opts) {
    opts = opts || {};
    var ix = index(g), steps = [], sections = [];
    function add(section, s) { s.section = section; s.id = 's' + (steps.length + 1); s.ids = uniq(s.ids); steps.push(s); }
    function extra(n) { return n.attributes && n.attributes.explain ? ' ' + n.attributes.explain : ''; }

    /* 1. process flow — equipment-level FEEDS from the boundary in */
    sections.push({ id: 'flow', title: 'Process flow' });
    flowOrder(g, ix).forEach(function (nid) {
      var feeds = ix.out(nid, 'FEEDS'); if (!feeds.length) return;
      var n = g.byId[nid];
      var ids = [nid].concat(walkDown(g, ix, nid, function (x) { return has(TERMINAL_TYPES, x.type); }));
      var bySvc = {}, svcOrder = [];
      feeds.slice().sort(function (a, b) {
        var ta = g.byId[a.target], tb = g.byId[b.target], ka = ta.type === 'Equipment' ? 0 : 1, kb = tb.type === 'Equipment' ? 0 : 1;
        return ka - kb || (ta.label < tb.label ? -1 : ta.label > tb.label ? 1 : 0);
      }).forEach(function (e) {
        ids.push(e.id);
        var svc = serviceOf(g, ix, nid, e.target) || 'flow', via = (e.attributes.via_items || []).join('|');
        if (!bySvc[svc]) { bySvc[svc] = { groups: {}, order: [] }; svcOrder.push(svc); }
        var grp = bySvc[svc];
        if (!grp.groups[via]) { grp.groups[via] = { targets: [], via: e.attributes.via_items || [] }; grp.order.push(via); }
        grp.groups[via].targets.push(g.byId[e.target].label);
      });
      var clauses = svcOrder.map(function (s) {
        return s + ' ' + bySvc[s].order.map(function (v) {
          var b = bySvc[s].groups[v];
          return 'to ' + joinAnd(b.targets) + (b.via.length ? ' through ' + joinAnd(b.via) : '');
        }).join(', and ');
      });
      var verb = n.type === 'Boundary' ? 'enters as' : 'sends';
      add('flow', { kind: 'flow', flow: true, subject: nid, title: nameOf(n),
        text: nameOf(n) + ' ' + verb + ' ' + clauses.join('; and ') + '.' + extra(n), ids: ids });
    });

    /* 2. measurement — what each instrument senses, grouped by variable */
    sections.push({ id: 'measure', title: 'Measurement' });
    var groups = {}, gOrder = [];
    g.nodes.forEach(function (n) {
      if (n.type !== 'Instrument') return;
      var ms = ix.out(n.id, 'MEASURES'); if (!ms.length) return;
      var v = n.attributes.variable || 'other';
      if (!groups[v]) { groups[v] = []; gOrder.push(v); }
      groups[v].push(n.id);
    });
    var vRank = ['flow', 'temperature', 'pressure', 'differential pressure', 'level', 'analysis'];
    gOrder.sort(function (a, b) { var ra = vRank.indexOf(a), rb = vRank.indexOf(b); return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb); });
    gOrder.forEach(function (v) {
      var ids = [], lines = [];
      groups[v].forEach(function (iid) {
        var n = g.byId[iid], d = decodeTag(n.tag || n.label), val = valueText(n);
        ids.push(iid);
        ix.out(iid, 'MEASURES').forEach(function (e) { ids.push(e.id, e.target); });
        lines.push(n.label + (d ? ' (' + d.words.join(' ') + ')' : '') + ' reads ' + measuredWhere(g, ix, iid) + (val ? ': ' + val : '') + '.');
      });
      add('measure', { kind: 'measure', title: v.charAt(0).toUpperCase() + v.slice(1) + ' — ' + groups[v].map(function (i) { return g.byId[i].label; }).join(', '),
        text: lines.join(' '), ids: ids });
    });

    /* 3. control loops — sensor → controller → relay → final element → effect */
    sections.push({ id: 'loop', title: 'Control loops' });
    var loops = g.nodes.filter(function (n) { return n.type === 'ControlLoop'; });
    /* R117: walk the loops in coolant order — see loopRank() for the rule */
    var rank = flowRank(g, ix), lr = {};
    loops.forEach(function (L) { lr[L.id] = loopRank(g, ix, L, rank); });
    loops.sort(function (a, b) { return (lr[a.id] - lr[b.id]) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0); });
    loops.forEach(function (L) {
      var a = L.attributes, S = a.sensors || [], C = a.controllers || [], R = a.relays || [], F = (a.final_elements || []).slice().sort();
      var memberEdges = ix.inn(L.id, 'MEMBER_OF').map(function (e) { return e.id; });
      var sig = function (from, to) { var o = []; from.forEach(function (x) { ix.out(x, 'SIGNAL_TO').forEach(function (e) { if (to.indexOf(e.target) >= 0) o.push(e.id); }); }); return o; };
      var lab = function (ids) { return joinAnd(ids.map(function (i) { return g.byId[i].label; })); };
      var stages = [], s1, s2, s3;
      if (C.length) {
        s1 = sig(S, C); s2 = R.length ? sig(C, R) : []; s3 = R.length ? sig(R, F) : [];
        s3 = s3.concat(sig(C, F));
      } else {
        // interlock / no controller: sensor → (relays) → final
        var relaysOnPath = [];
        S.forEach(function (s) { ix.out(s, 'SIGNAL_TO').forEach(function (e) { var t = g.byId[e.target]; if (t.attributes.role === 'relay') relaysOnPath.push(t.id); }); });
        relaysOnPath = uniq(relaysOnPath);
        s1 = []; s2 = sig(S, relaysOnPath.length ? relaysOnPath : F); s3 = relaysOnPath.length ? sig(relaysOnPath, F) : [];
        R = relaysOnPath;
      }
      [s1, s2, s3].forEach(function (s) { if (s.length) stages.push(s); });
      var measIds = []; S.forEach(function (s) { ix.out(s, 'MEASURES').forEach(function (e) { measIds.push(e.id, e.target); }); });
      var tripIds = []; S.forEach(function (s) { ix.out(s, 'TRIPS').forEach(function (e) { tripIds.push(e.id); }); });
      var actIds = []; S.concat(C).forEach(function (s) { ix.out(s, 'ACTUATES').forEach(function (e) { actIds.push(e.id); }); });
      var allSig = s1.concat(s2, s3);
      var title = (L.kind === 'interlock' ? 'Interlock ' : 'Loop ') + L.label + ' — ' + (a.variable || 'process');
      var ctl = C.length ? g.byId[C[0]] : null;
      add('loop', { kind: 'loop', loop: L.id, part: 'overview', title: title,
        text: a.description + (ctl ? extra(ctl) : extra(g.byId[S[0]] || L)),
        ids: [L.id].concat(S, C, R, F, allSig, measIds, tripIds, actIds, memberEdges), pulse: stages });
      if (S.length) add('loop', { kind: 'loop', loop: L.id, part: 'sensor', title: L.label + ' · sensor ' + lab(S),
        text: S.map(function (s) { var n = g.byId[s], d = decodeTag(n.tag || n.label), v = valueText(n);
          return n.label + (d ? ' (' + d.words.join(' ') + ')' : '') + ' senses ' + (a.variable || 'the process') + ' ' + measuredWhere(g, ix, s) + (v ? ' — ' + v : '') + '.'; }).join(' '),
        ids: [L.id].concat(S, measIds) });
      if (C.length) add('loop', { kind: 'loop', loop: L.id, part: 'controller', title: L.label + ' · controller ' + lab(C),
        text: C.map(function (c) { var n = g.byId[c], d = decodeTag(n.tag || n.label);
          return n.label + (d ? ' (' + d.words.join(' ') + ', ' + (LOCATION_WORD[n.attributes.location] || n.attributes.location) + ')' : '') +
            ' takes the signal from ' + lab(S) + ' and compares it with its setpoint' + (n.attributes.setpoint ? ' (' + n.attributes.setpoint + ')' : '') + '.'; }).join(' '),
        ids: [L.id].concat(S, C, s1), pulse: s1.length ? [s1] : [] });
      if (R.length) add('loop', { kind: 'loop', loop: L.id, part: 'relay', title: L.label + ' · relay ' + lab(R),
        text: lab(R) + ' ' + (R.length > 1 ? 'convert' : 'converts') + ' the ' + (C.length ? 'controller output' : 'trip signal') + ' into the command the final element needs' +
          (R.every(function (r) { return g.byId[r].name; }) ? ' (' + R.map(function (r) { return g.byId[r].name; }).join('; ') + ')' : '') + '.',
        ids: [L.id].concat(C.length ? C : S, R, s2), pulse: s2.length ? [s2] : [] });
      if (F.length) {
        var finalSig = C.length ? s3 : (R.length ? s3 : s2);
        add('loop', { kind: 'loop', loop: L.id, part: 'final', title: L.label + ' · final element ' + lab(F),
          text: (L.kind === 'interlock' ? lab(S) + ' trips ' + lab(F) + (R.length ? ' through ' + lab(R) : '') + '.' :
            lab(F) + ' ' + (F.length > 1 ? 'are' : 'is') + ' what the loop moves' + (R.length ? ', through ' + lab(R) : '') + '.'),
          ids: [L.id].concat(R, F, finalSig, tripIds, actIds), pulse: finalSig.length ? [finalSig] : [] });
        var eff = [];
        F.forEach(function (f) {
          eff.push(f);
          eff = eff.concat(walkDown(g, ix, f, function (n) { return n.type === 'Boundary' || n.kind === 'heat_exchanger'; }));
        });
        var effTerms = uniq(eff.filter(function (i) { var n = g.byId[i]; return n && (n.type === 'Boundary' || n.type === 'Equipment') && F.indexOf(i) < 0; }).map(function (i) { return g.byId[i].label; }));
        var closes = S.length ? ' The change reaches ' + lab(S) + ', which closes the loop.' : '';
        add('loop', { kind: 'loop', loop: L.id, part: 'effect', flow: true, title: L.label + ' · effect on the process',
          text: (L.kind === 'interlock' ? 'Stopping ' + lab(F) + ' stops the flow ' : 'Moving ' + lab(F) + ' changes the flow ') +
            'downstream to ' + joinAnd(effTerms) + '.' + (L.kind === 'interlock' ? '' : closes) + (g.byId[F[0]].attributes.effect ? ' ' + g.byId[F[0]].attributes.effect : ''),
          ids: [L.id].concat(eff, S) });
      }
    });

    /* node → step a click on a symbol selects */
    var nodeStep = {};
    function claim(id, step) { if (!has(nodeStep, id)) nodeStep[id] = step.id; }
    steps.forEach(function (s) { if (s.kind === 'flow') claim(s.subject, s); });
    steps.forEach(function (s) { if (s.kind === 'loop' && s.part === 'overview') s.ids.forEach(function (i) { var n = g.byId[i]; if (n && n.type === 'Instrument') claim(i, s); }); });
    steps.forEach(function (s) { if (s.kind === 'measure') s.ids.forEach(function (i) { var n = g.byId[i]; if (n && n.type === 'Instrument') claim(i, s); }); });
    steps.forEach(function (s) { s.ids.forEach(function (i) { if (g.byId[i]) claim(i, s); }); });
    return { sections: sections, steps: steps, nodeStep: nodeStep };
  }

  /* ------------------------------------------------------------ coolant order (R117) */
  /* Breadth-first position of every node on the FLOWS_TO paths, walked from the terminals in flowOrder.
     A node with no FLOWS_TO edge (the skid floor the leak rope lies on) is off the flow path and gets no rank. */
  function flowRank(g, ix) {
    ix = ix || index(g);
    var rank = {}, n = 0;
    flowOrder(g, ix).forEach(function (s) {
      if (!ix.out(s, 'FLOWS_TO').length && !ix.inn(s, 'FLOWS_TO').length) return;
      var queue = [s];
      while (queue.length) {
        var cur = queue.shift(); if (has(rank, cur)) continue; rank[cur] = n++;
        ix.out(cur, 'FLOWS_TO').forEach(function (e) { queue.push(e.target); });
      }
    });
    return rank;
  }
  /* Rule: a loop sits where the coolant meets what it measures — the earliest rank of a point its sensors measure
     (an in-line sensor is its own point). A loop with no sensor sits at its final element. A loop whose sensors
     measure nothing on the flow path (LS-01: the leak rope on the skid floor) goes after every loop that does. */
  function loopRank(g, ix, L, rank) {
    var a = L.attributes, best = Infinity, pts = [];
    (a.sensors || []).forEach(function (s) {
      if (g.byId[s].attributes.inline) pts.push(s);
      ix.out(s, 'MEASURES').forEach(function (e) { pts.push(e.target); });
    });
    if (!(a.sensors || []).length) pts = a.final_elements || [];
    pts.forEach(function (p) { if (has(rank, p)) best = Math.min(best, rank[p]); });
    return best;
  }

  /* ------------------------------------------------------------ heat balance (R117) */
  function numeric(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v === null || v === undefined ? '' : v).trim();
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
  }
  /* Q[kW] = V[LPM] x rho[kg/L] x cp[kJ/kgK] x dT[K] / 60, on every node whose attributes.balance names its flow
     instrument (attributes.flow_lpm), supply and return temperature instruments (value in °C) and fluid; the node
     itself declares duty_kw. props(fluidKey, tC) -> { rho: kg/m3, cp: kJ/kgK } is CDU_ENGINE.fluidProps, taken at the
     mean of supply and return. A miss beyond the tolerance must be CARRIED as attributes.discrepancy (quote both,
     choose neither); `finding` is non-null when it is not, when a mark sits on a balance that closes, or when an
     input is missing or not a number — never guessed. */
  function balance(g, props, tolerance) {
    var tol = tolerance === undefined ? BALANCE_TOLERANCE : tolerance;
    return g.nodes.filter(function (n) { return n.attributes && n.attributes.balance; }).map(function (n) {
      var a = n.attributes, spec = a.balance, errs = [], r = { node: n.id, fluid: spec.fluid, tolerance: tol, finding: null };
      function pick(ref, key, unit) {
        var m = g.byId[ref];
        if (!m) { errs.push(ref + ' is not in the graph'); return null; }
        var v = numeric(m.attributes[key]);
        if (v === null) { errs.push(ref + ' ' + key + ' "' + m.attributes[key] + '" is not a number'); return null; }
        if (unit && m.attributes.unit !== unit) { errs.push(ref + ' is in "' + m.attributes.unit + '", not ' + unit); return null; }
        return v;
      }
      var flow = pick(spec.flow, 'flow_lpm'), ts = pick(spec.t_supply, 'value', '°C'), tr = pick(spec.t_return, 'value', '°C');
      var duty = numeric(a.duty_kw);
      if (duty === null || duty <= 0) errs.push(n.id + ' duty_kw "' + a.duty_kw + '" is not a positive number');
      if (typeof props !== 'function') errs.push('no fluid properties supplied');
      if (!errs.length && tr - ts <= 0) errs.push('return ' + tr + ' °C is not above supply ' + ts + ' °C');
      if (errs.length) { r.finding = 'cannot balance ' + n.id + ': ' + errs.join('; '); return r; }
      var fp = props(spec.fluid, (ts + tr) / 2), rho = fp.rho / 1000, cp = fp.cp, dT = tr - ts;
      r.flow_lpm = flow; r.t_supply = ts; r.t_return = tr; r.dT = dT; r.t_mean = (ts + tr) / 2; r.rho = rho; r.cp = cp;
      r.declared_kw = duty; r.q_kw = flow * rho * cp * dT / 60;
      r.need_lpm = duty * 60 / (rho * cp * dT); r.need_lpm_per_kw = r.need_lpm / duty;
      r.diff = (r.q_kw - duty) / duty; r.within = Math.abs(r.diff) <= tol; r.marked = !!a.discrepancy;
      r.discrepancy = a.discrepancy || null;
      if (!r.within && !r.marked) r.finding = 'unmarked mismatch on ' + n.id + ': ' + balanceText(r);
      else if (r.within && r.marked) r.finding = n.id + ' carries a discrepancy mark but the balance closes: ' + balanceText(r);
      return r;
    });
  }
  function fix(v, d) { return v.toFixed(d); }
  /* The arithmetic as a reader checks it. */
  function balanceText(r) {
    if (r.q_kw === undefined) return r.finding || '';
    var pct = r.diff * 100;
    return fix(r.flow_lpm, 0) + ' LPM × ' + fix(r.rho, 3) + ' kg/L × ' + fix(r.cp, 3) + ' kJ/kg·K × ' + fix(r.dT, 0) + ' K ÷ 60 = ' +
      fix(r.q_kw, 1) + ' kW against ' + fix(r.declared_kw, 0) + ' kW declared (' + (pct < 0 ? '−' : '+') + fix(Math.abs(pct), 1) +
      ' %, tolerance ' + fix(r.tolerance * 100, 0) + ' %). ' + fix(r.declared_kw, 0) + ' kW at ' + fix(r.dT, 0) + ' K needs ' +
      fix(r.need_lpm, 0) + ' LPM = ' + fix(r.need_lpm_per_kw, 2) + ' LPM/kW. Properties: ' + String(r.fluid).toUpperCase() + ' at ' +
      fix(r.t_mean, 1) + ' °C, the mean of ' + fix(r.t_supply, 0) + ' and ' + fix(r.t_return, 0) + ' °C.';
  }

  /* ------------------------------------------------------------ RZExplain key of a tag (R117) */
  /* One DB entry per ISA letter set ('isa-tic'); its title equals decodeTag().text (gated). Instruments always;
     valves only when the builder read them as ISA (actuated or relief) or the first letter is H (hand) — a plain
     'MV' make-up valve is not ISA, and M would read as "moisture". */
  function explainKey(n) {
    if (!n || !n.tag || (n.type !== 'Instrument' && n.type !== 'Component')) return null;
    if (n.type === 'Component' && !n.attributes.isa_letters && !/^H/.test(n.tag)) return null;
    var isa = parseIsaTag(n.tag);
    return isa && decodeTag(n.tag) ? 'isa-' + isa.letters.toLowerCase() : null;
  }

  /* ------------------------------------------------------------ per-sheet tag scoping (build.py tag_scopes, R120) */
  /* A tag reused for different items on different sheets (numbering restarted per unit) is scoped to its sheet:
     instruments when their loop group senses disjoint locations on two sheets; equipment when what it connects to is
     disjoint AND neither sheet points at the other. Returns {'page|TAG': sheet suffix}; buildGraph passes it in. */
  function tagScopes(pages) {
    var NL = Bm.normalizeLabel, sig = {}, mem = {}, suffix = {}, eqSig = {}, refs = {}, eqTags = {}, scopes = {};
    function slot(o, k, pg, list) { var a = o[k] || (o[k] = { order: [], v: {} }); if (!has(a.v, pg)) { a.v[pg] = list ? [] : {}; a.order.push(pg); } return a.v[pg]; }
    function addAll(set, list) { list.forEach(function (x) { if (x) set[x] = 1; }); }
    function located(pp) { return pp.order.filter(function (pg) { return Object.keys(pp.v[pg]).length; }); }
    function disjoint(a, b) { for (var k in a) if (has(b, k)) return false; return true; }
    pages.forEach(function (p) {
      var pg = p.page, tags = {}, lines = {};
      suffix[pg] = N(p.sheet && p.sheet.drawing_number) || 'P' + U.pad2(pg);
      ['equipment', 'components', 'instruments'].forEach(function (k) { (p[k] || []).forEach(function (i) { if (i.tag) tags[i.id] = N(i.tag); }); });
      (p.lines || []).forEach(function (l) { lines[l.id] = l; });
      var ends = function (l) { return [l.from, l.to].filter(function (ep) { return typeof ep === 'string' && has(tags, ep); }).map(function (ep) { return tags[ep]; }); };
      var where = function (localId, ref) {
        var f = {};
        if (ref && ref.item) addAll(f, [tags[ref.item] || N(ref.item)]);
        else if (ref && has(lines, ref.line)) addAll(f, ends(lines[ref.line]));
        (p.lines || []).forEach(function (l) { if ((l.path || []).indexOf(localId) >= 0) addAll(f, ends(l)); });
        return Object.keys(f);
      };
      (p.instruments || []).forEach(function (ins) {
        if (!ins.tag) return;
        var t = N(ins.tag), isa = parseIsaTag(t), key = N(ins.loop) || (isa ? isa.loopKey : t);
        slot(mem, key, pg, true).push(t); addAll(slot(sig, key, pg), where(ins.id, ins.measures));
      });
      (p.components || []).forEach(function (c) {
        var t = N(c.tag), isa = t ? parseIsaTag(t) : null;
        var act = has(U.ACTUATED_COMPONENT_KINDS, U.slug(c.kind)) || (c.actuator !== undefined && c.actuator !== null && ['manual', 'none', 'self'].indexOf(c.actuator) < 0);
        if (!isa || !act) return;
        var key = N(c.loop) || isa.loopKey;
        slot(mem, key, pg, true).push(t); addAll(slot(sig, key, pg), where(c.id, null));
      });
      /* equipment: what each tagged item reaches through pipes, stopping at terminals */
      eqTags[pg] = {}; (p.equipment || []).forEach(function (e) { if (e.tag) eqTags[pg][N(e.tag)] = 1; });
      refs[pg] = refs[pg] || {};
      if (p.sheet && p.sheet.drawing_type === 'pfd') return;
      var term = {}, adj = {};
      var link = function (a, b) { (adj[a] = adj[a] || {})[b] = 1; (adj[b] = adj[b] || {})[a] = 1; };
      (p.equipment || []).concat(p.boundaries || []).forEach(function (i) { term[i.id] = N(i.tag) || NL(i.name || i.id); });
      (p.off_page_connectors || []).forEach(function (o) { term[o.id] = N(o.other_item) || NL(o.name || o.id); if (o.other_drawing) refs[pg][N(o.other_drawing)] = 1; });
      (p.lines || []).forEach(function (l) {
        var e = [l.from, l.to].map(function (ep) { return typeof ep === 'string' ? ep : ep.item ? ep.item : 'line:' + ep.line; });
        var chain = [e[0]].concat(l.path || [], [e[1]]);
        for (var i = 1; i < chain.length; i++) link(chain[i - 1], chain[i]);
        chain.forEach(function (x) { link('line:' + l.id, x); });
      });
      (p.equipment || []).forEach(function (e) {
        var tag = N(e.tag); if (!tag) return;
        var seen = {}, stack = Object.keys(adj[e.id] || {}), s = slot(eqSig, tag, pg); seen[e.id] = 1;
        while (stack.length) {
          var x = stack.pop(); if (seen[x]) continue; seen[x] = 1;
          if (has(term, x)) { s[term[x]] = 1; continue; }
          stack = stack.concat(Object.keys(adj[x] || {}));
        }
      });
    });
    Object.keys(eqSig).forEach(function (tag) {
      var pp = eqSig[tag], loc = located(pp);
      loc.forEach(function (a) { loc.forEach(function (b) {
        if (a >= b) return;
        var A = {}, Bs = {}, k;
        for (k in pp.v[a]) if (!(eqTags[a][k] && eqTags[b][k])) A[k] = 1;
        for (k in pp.v[b]) if (!(eqTags[a][k] && eqTags[b][k])) Bs[k] = 1;
        if (!disjoint(A, Bs) || refs[a][suffix[b]] || refs[b][suffix[a]]) return;
        scopes[a + '|' + tag] = suffix[a]; scopes[b + '|' + tag] = suffix[b];
      }); });
    });
    Object.keys(sig).forEach(function (key) {
      var pp = sig[key], loc = located(pp), clash = {};
      loc.forEach(function (a) { loc.forEach(function (b) { if (a !== b && disjoint(pp.v[a], pp.v[b])) clash[a] = clash[b] = 1; }); });
      Object.keys(clash).forEach(function (pg) { ((mem[key] && mem[key].v[pg]) || []).forEach(function (t) { scopes[pg + '|' + t] = suffix[pg]; }); });
    });
    return scopes;
  }
  function buildGraph(pages, plantId, plantName) { return Bm.buildGraph(pages, plantId, plantName, { scopes: tagScopes(pages) }); }

  /* ------------------------------------------------------------ QA report (qa.py run_qa, R120) */
  /* The build's own issues plus the graph-level checks of the reference, one list sorted error -> warning -> info.
     Reference threshold for low_confidence is 0.6; a page may pass opts.lowConfidence. opts.props (fluid properties)
     adds the RZ heat-balance result: a finding is a warning, a marked discrepancy is carried as info with its quotes.
     Not ported: tiles_not_reviewed / possible_missed_tags (they read the PDF work directory's tiles and OCR hints). */
  var KINDS_EQ = ('agitated_tank agitator bin blower boiler box centrifugal_pump centrifuge clarifier column compressor conveyor cooler crusher ' +
    'cyclone dryer electrowinning_cell fan feeder filter filter_press flotation_cell furnace heat_exchanger heater hopper hydrocyclone ' +
    'ion_exchange kiln membrane_filter metering_pump mill mixer motor other package_unit pond positive_displacement_pump pressure_vessel ' +
    'pump reactor sampler screen scrubber separator silo slurry_pump static_mixer strainer_unit sump sump_pump tank thickener uv_unit vessel').split(' ');
  var KINDS_CO = ('backflow_preventer ball_valve blind butterfly_valve check_valve control_valve diaphragm_valve drain expansion_joint filter ' +
    'flame_arrestor flexible_hose gate_valve globe_valve knife_gate_valve manual_valve motor_operated_valve needle_valve on_off_valve other ' +
    'pinch_valve plug_valve pressure_regulator quick_connect reducer relief_valve rupture_disc sample_point sight_glass solenoid_valve ' +
    'spectacle_blind steam_trap strainer tee three_way_valve vacuum_breaker vent').split(' ');
  var SENSING_ROLES = { transmitter: 1, 'switch': 1, element: 1, gauge: 1 }, QA_LOW = 0.6, SEV = { error: 0, warning: 1, info: 2 };
  function qa(g, opts) {
    opts = opts || {};
    var low = opts.lowConfidence === undefined ? QA_LOW : opts.lowConfidence, out = [], flowDeg = {}, anyDeg = {}, measured = {};
    g.edges.forEach(function (e) {
      anyDeg[e.source] = (anyDeg[e.source] || 0) + 1; anyDeg[e.target] = (anyDeg[e.target] || 0) + 1;
      if (e.type === 'FLOWS_TO') { flowDeg[e.source] = 1; flowDeg[e.target] = 1; } else if (e.type === 'MEASURES') measured[e.source] = 1;
    });
    function add(sev, code, msg, nid, extra) {
      var n = nid ? g.byId[nid] : null, o = { severity: sev, code: code, message: msg, from: 'qa' };
      if (nid) o.node = nid; if (n && n.sheets && n.sheets.length) o.sheet = n.sheets[0];
      for (var k in (extra || {})) if (has(extra, k) && extra[k] !== null && extra[k] !== undefined) o[k] = extra[k];
      out.push(o);
    }
    g.nodes.forEach(function (n) {
      var a = n.attributes || {};
      if (n.type === 'Equipment' && !flowDeg[n.id] && !a.part_of) add('warning', 'equipment_not_connected', 'equipment ' + n.label + ' has no process connections', n.id);
      else if (n.type === 'Component' && !flowDeg[n.id]) add('warning', 'component_not_connected', 'component ' + n.label + " is not on any line (add it to a line 'path')", n.id);
      else if (n.type === 'Instrument') {
        var loc = a.location || 'unknown';
        if (SENSING_ROLES[a.role] && (loc === 'field' || loc === 'unknown') && !measured[n.id] && !a.inline)
          add('warning', 'instrument_not_located', n.label + ' (' + a.role + ") senses the process but has no 'measures' location", n.id);
        if (!anyDeg[n.id]) add('info', 'isolated_instrument', n.label + ' has no connections at all', n.id);
      }
      if (n.type !== 'Plant' && n.type !== 'Sheet' && n.confidence < low)
        add('info', 'low_confidence', n.label + ' was read with confidence ' + n.confidence.toFixed(2), n.id, { basis: a.basis || a.notes || null, line: a.line_id || null });
      /* build.py emits this one while adding items */
      if ((n.type === 'Equipment' && KINDS_EQ.indexOf(n.kind) < 0) || (n.type === 'Component' && KINDS_CO.indexOf(n.kind) < 0))
        add('info', 'unknown_kind', n.type.toLowerCase() + " kind '" + n.kind + "' not in vocabulary", n.id);
    });
    var padded = {};
    g.nodes.forEach(function (n) {
      if (!n.tag || n.type !== 'Equipment') return;
      var k = n.tag.split('@')[0].split('#')[0].replace(/(^|[^0-9])0+(?=[0-9])/g, '$1');
      (padded[k] = padded[k] || []).push(n.id);
    });
    Object.keys(padded).forEach(function (k) {
      var ids = padded[k], tags = uniq(ids.map(function (i) { return g.byId[i].tag; })).sort();
      if (tags.length > 1) add('warning', 'near_duplicate_tags', 'tags ' + tags.join(', ') + ' differ only in zero padding; probably one item drawn with inconsistent tags (check the sheets)', ids[0]);
    });
    var tagsOf = {};
    g.nodes.forEach(function (n) { if (n.tag && /^(Equipment|Instrument|Component)$/.test(n.type)) n.sheets.forEach(function (s) { (tagsOf[s] = tagsOf[s] || {})[n.tag] = 1; }); });
    var big = Object.keys(tagsOf).filter(function (s) { return Object.keys(tagsOf[s]).length >= 5; }).sort();
    big.forEach(function (a, i) { big.slice(i + 1).forEach(function (b) {
      var ka = Object.keys(tagsOf[a]), kb = Object.keys(tagsOf[b]), sh = ka.filter(function (t) { return tagsOf[b][t]; }).length, frac = sh / Math.min(ka.length, kb.length);
      if (frac >= 0.5) out.push({ severity: 'warning', code: 'possible_duplicate_revision', sheet: b, from: 'qa', message: a + ' and ' + b + ' share ' + sh + ' tags (' + Math.round(frac * 100) +
        '% of the smaller sheet); if they are two revisions of the same drawing, keep only the current one in this graph and ask the user what to do with the other' });
    }); });
    var inferred = g.edges.filter(function (e) { return e.type === 'FLOWS_TO' && e.attributes.flow_direction === 'inferred'; }).length;
    if (inferred) out.push({ severity: 'info', code: 'inferred_flow_direction', from: 'qa', message: inferred + ' flow edges have inferred (not drawn) direction' });
    if (opts.props) balance(g, opts.props).forEach(function (r) {
      if (r.finding) add('warning', 'heat_balance', r.finding, r.node);
      else if (r.marked) add('info', 'heat_balance_discrepancy', r.discrepancy.note || 'carried discrepancy', r.node, { calc: balanceText(r), quotes: r.discrepancy.quotes });
    });
    var all = g.issues.map(function (i) { var o = {}; for (var k in i) if (has(i, k)) o[k] = i[k]; o.from = 'build'; return o; }).concat(out);
    all = all.map(function (x, i) { return [x, i]; }).sort(function (a, b) {
      return (SEV[a[0].severity] - SEV[b[0].severity]) || (a[0].code < b[0].code ? -1 : a[0].code > b[0].code ? 1 : a[1] - b[1]);
    }).map(function (x) { return x[0]; });
    var counts = { error: 0, warning: 0, info: 0 }, by = {}, byCode = [];
    all.forEach(function (i) {
      counts[i.severity] = (counts[i.severity] || 0) + 1;
      var k = i.severity + ' ' + i.code; if (!by[k]) { by[k] = { severity: i.severity, code: i.code, count: 0 }; byCode.push(by[k]); } by[k].count++;
    });
    return { issues: all, counts: counts, byCode: byCode, lowConfidence: low };
  }

  /* ------------------------------------------------------------ queries: trace, loopOf, impact (R120, RZ) */
  /* Stream-aware flow net. A heat exchanger carries two streams that never mix: a FLOWS_TO into or out of it belongs to the
     stream named by the first word of its pipe's service ('TCS return' -> TCS) and a walk leaves by the stream it came in on.
     Without a service the item stays one node, as in the reference. */
  function isHx(n) { return !!n && n.type === 'Equipment' && /heat_exchanger|cooler|heater|condenser|evaporator/.test(n.kind || ''); }
  function isStore(n) { return !!n && n.type === 'Equipment' && /tank|vessel|sump|pond|silo|bin|hopper/.test(n.kind || ''); }
  function stream(g, sid) { var s = g.byId[sid]; return s && s.type === 'PipeSegment' ? String(s.attributes.service || '').split(' ')[0].toUpperCase() : ''; }
  function net(g) {
    var out = {}, inn = {}, ports = {};
    function port(id, other) { var p = isHx(g.byId[id]) ? id + '|' + stream(g, other) : id; ports[p] = id; return p; }
    g.edges.forEach(function (e) {
      if (e.type !== 'FLOWS_TO') return;
      var s = port(e.source, e.target), t = port(e.target, e.source);
      (out[s] = out[s] || []).push({ p: t, e: e }); (inn[t] = inn[t] || []).push({ p: s, e: e });
    });
    return { out: out, inn: inn, ports: ports, of: function (id) { return Object.keys(ports).filter(function (p) { return ports[p] === id; }); } };
  }
  function walk(nt, starts, up, stop) {
    var seen = {}, order = [], edges = [], q = starts.slice();
    starts.forEach(function (p) { seen[p] = 1; });
    while (q.length) {
      var cur = q.shift();
      ((up ? nt.inn : nt.out)[cur] || []).forEach(function (l) {
        edges.push(l.e.id);
        if (seen[l.p]) return; seen[l.p] = 1; order.push(l.p);
        if (!stop || !stop(l.p)) q.push(l.p);
      });
    }
    return { ports: order, edges: uniq(edges) };
  }
  /* The process path from id, downstream (default) or upstream, in walk order. */
  function trace(g, id, opts) {
    opts = opts || {}; var nt = net(g), up = opts.dir === 'up';
    var w = walk(nt, nt.of(id).filter(function (p) { return !opts.stream || p === id + '|' + opts.stream; }), up);
    var ids = uniq(w.ports.map(function (p) { return nt.ports[p]; })).filter(function (x) { return x !== id; });
    return { from: id, dir: up ? 'up' : 'down', ids: ids, edges: w.edges,
      items: ids.filter(function (x) { return g.byId[x].type !== 'PipeSegment'; }),
      equipment: ids.filter(function (x) { return has(TERMINAL_TYPES, g.byId[x].type); }) };
  }
  /* The loops an item belongs to (with its role), or that measure it. */
  function loopOf(g, id) {
    var out = [], seen = {};
    function push(l, role, by) { if (seen[l]) return; seen[l] = 1; out.push({ loop: l, kind: g.byId[l].kind, role: role, by: by || null }); }
    if (g.byId[id] && g.byId[id].type === 'ControlLoop') push(id, 'loop');
    g.edges.forEach(function (e) { if (e.type === 'MEMBER_OF' && e.source === id) push(e.target, e.attributes.role); });
    g.edges.forEach(function (e) {
      if (e.type === 'MEASURES' && e.target === id) g.edges.forEach(function (m) { if (m.type === 'MEMBER_OF' && m.source === e.source) push(m.target, 'measured', e.source); });
    });
    return out;
  }
  var MOVERS = /pump|compressor|fan|blower|motor|generator|agitator|mixer|conveyor|feeder/;
  /* The failure a click on an item asks about, by what the item is. */
  function failMode(n) {
    var a = n.attributes || {};
    if (n.type === 'Component') return n.kind === 'relief_valve' || n.kind === 'rupture_disc' ? 'fails shut' : n.kind === 'check_valve' ? 'sticks shut' : 'closed';
    if (n.type === 'Equipment') return isHx(n) ? 'fouled' : MOVERS.test(n.kind || '') ? 'trips' : /filter|strainer|screen/.test(n.kind || '') ? 'clogged' : isStore(n) ? 'leaks' : 'stops';
    if (n.type === 'Instrument') return a.role === 'controller' || a.role === 'relay' ? 'fails' : a.role === 'switch' ? 'trips falsely' : 'fails low';
    if (n.type === 'Boundary') return a.direction === 'source' ? 'supply lost' : a.direction === 'sink' ? 'blocked' : 'none';
    return n.type === 'PipeSegment' ? 'blocked' : 'none';
  }
  var STOPS = /closed|shut|trips$|stops|supply lost|blocked/;
  function heatSide(g, nt, hxPort) {   /* 'warm' = the stream the exchanger cools (enters on a return pipe) */
    var svc = (nt.inn[hxPort] || []).map(function (l) { return String((g.byId[l.e.source].attributes || {}).service || ''); }).join(' ');
    return /return|hot|warm/i.test(svc) ? 'warm' : /supply|cold|chilled/i.test(svc) ? 'cold' : null;
  }
  function flowing(g, nt, blocked) {
    var fwd = {}, bwd = {}, ok = function (p) { return !blocked[nt.ports[p]]; };
    var nd = function (p) { return g.byId[nt.ports[p]]; };
    function bfs(seed, mark, adj) {
      var q = Object.keys(nt.ports).filter(function (p) { return ok(p) && seed(nd(p), p); });
      q.forEach(function (p) { mark[p] = 1; });
      while (q.length) (adj[q.shift()] || []).forEach(function (l) { if (!mark[l.p] && ok(l.p)) { mark[l.p] = 1; q.push(l.p); } });
    }
    bfs(function (n, p) { return (n.type === 'Boundary' && n.attributes.direction === 'source') || isStore(n) || (n.type === 'Equipment' && !nt.inn[p]); }, fwd, nt.out);
    bfs(function (n, p) { return (n.type === 'Boundary' && n.attributes.direction === 'sink') || isStore(n) || (n.type === 'Equipment' && !nt.out[p]); }, bwd, nt.inn);
    var on = { ports: {}, nodes: {}, edges: {} };
    Object.keys(fwd).forEach(function (p) { if (bwd[p]) { on.ports[p] = 1; on.nodes[nt.ports[p]] = 1; } });
    Object.keys(on.ports).forEach(function (s) { (nt.out[s] || []).forEach(function (l) { if (on.ports[l.p]) on.edges[l.e.id] = 1; }); });
    return on;
  }
  /* What a failure of `id` does: the flow it stops, what takes over, which instruments then read abnormal, which loops and
     interlocks act (MEASURES -> MEMBER_OF -> ACTUATES / TRIPS) and what the operator sees. Every sentence is built from the
     graph; nothing is written per item. opts.mode overrides failMode(). */
  function impact(g, id, opts) {
    var n = g.byId[id]; if (!n) return null;
    opts = opts || {};
    var mode = opts.mode || failMode(n), a = n.attributes || {}, nt = net(g), ix = index(g);
    var lab = function (x) { return nameIn(g, x); }, rank = flowRank(g, ix), byRank = function (x, y) { return (has(rank, x) ? rank[x] : 1e9) - (has(rank, y) ? rank[y] : 1e9); };
    var base = {}, blocked, stopped = [], r = { id: id, mode: mode, lost: [], takeover: [], backflow: [], stores: [], readings: [], responses: [], chain: [], fault: [] };
    g.nodes.forEach(function (m) {
      var ma = m.attributes || {};
      if (m.type === 'Component' && (m.kind === 'relief_valve' || m.kind === 'rupture_disc' || ma.normal_position === 'closed')) base[m.id] = 'shut';
      if (m.type === 'Equipment' && ma.duty === 'standby') base[m.id] = 'standby';
    });
    var before = flowing(g, nt, base);
    blocked = {}; for (var k in base) blocked[k] = base[k];
    function sibs(sid) {
      var key = function (x) { return ix.inn(x, 'FEEDS').map(function (e) { return e.source; }).sort() + '>' + ix.out(x, 'FEEDS').map(function (e) { return e.target; }).sort(); };
      return g.nodes.filter(function (m) { return m.id !== sid && m.type === 'Equipment' && m.kind === g.byId[sid].kind && key(m.id) === key(sid); }).map(function (m) { return m.id; });
    }
    function stop(list, why) {
      list.forEach(function (s) { if (blocked[s] && blocked[s] !== 'standby') return; blocked[s] = why; stopped.push(s); });
      list.forEach(function (s) { sibs(s).forEach(function (o) { if (blocked[o] === 'standby' && list.indexOf(o) < 0) { delete blocked[o]; r.takeover.push({ failed: s, by: o }); } }); });
    }
    if (STOPS.test(mode) && n.type !== 'Equipment') blocked[id] = mode;
    if (STOPS.test(mode) && n.type === 'Equipment') stop([id], mode);
    if (n.type === 'Instrument' && a.role === 'relay' && mode === 'fails')
      stop(ix.out(id, 'SIGNAL_TO').map(function (e) { return e.target; }).filter(function (t) { return g.byId[t].type === 'Equipment'; }), 'stopped');
    var down = {}, upst = {};
    nt.of(id).forEach(function (p) { walk(nt, [p], false).ports.forEach(function (q) { down[nt.ports[q]] = 1; }); walk(nt, [p], true).ports.forEach(function (q) { upst[nt.ports[q]] = 1; }); });
    function points(s) { var sn = g.byId[s]; return sn.attributes.inline ? [s] : ix.out(s, 'MEASURES').map(function (e) { return e.target; }); }
    function settle() {
      var after = flowing(g, nt, blocked), read = {}, hot = {};
      var lost = function (p) { return before.nodes[p] && !after.nodes[p] && !isStore(g.byId[p]); };
      g.nodes.forEach(function (h) {   /* heat no longer exchanged, or exchanged worse */
        if (!isHx(h)) return;
        var ps = nt.of(h.id), gone = ps.filter(function (p) { return before.ports[p] && !after.ports[p]; });
        ps.forEach(function (p) {
          if (!after.ports[p]) return;
          var side = heatSide(g, nt, p), other = gone.map(function (q) { return heatSide(g, nt, q); });
          var dir = (h.id === id && mode === 'fouled') ? (side === 'warm' ? 'high' : side === 'cold' ? 'low' : null)
            : (side === 'warm' && other.indexOf('cold') >= 0) ? 'high' : (side === 'cold' && other.indexOf('warm') >= 0) ? 'low' : null;
          if (dir) walk(nt, [p], false, function (q) { var m = g.byId[nt.ports[q]]; return isHx(m) || isStore(m) || m.type === 'Boundary'; })
            .ports.forEach(function (q) { hot[nt.ports[q]] = { dir: dir, hx: h.id, stream: p.split('|')[1] }; });
        });
      });
      g.nodes.forEach(function (s) {
        var sa = s.attributes, v = sa.variable || '';
        if (s.type !== 'Instrument' || sa.role === 'controller' || sa.role === 'relay' || !v) return;
        var set = function (dir, why) { if (!read[s.id]) read[s.id] = { id: s.id, reads: dir, why: why }; };
        if (s.id === id && mode === 'fails low') set('low', 'the instrument itself failed');
        points(s.id).forEach(function (p) {
          var pn = g.byId[p];
          if (lost(p)) {
            if (/flow/.test(v)) set('low', 'no flow');
            else if (/differential/.test(v) && pn.type !== 'PipeSegment') set('low', 'no flow across ' + nameIn(g, p));
            else if (/pressure/.test(v)) set(upst[p] && !down[p] ? 'high' : 'low', down[p] ? 'downstream of ' + n.label : upst[p] ? 'dead-headed upstream of ' + n.label : 'no flow');
            else set('stale', 'no flow past it');
          } else if (mode === 'clogged' && (down[p] || p === id)) {
            if (p === id && /pressure/.test(v)) set('high', 'across ' + n.label);
            else if (/flow|pressure/.test(v)) set('low', 'less flow after ' + n.label);
          } else if (hot[p] && /temperature/.test(v)) set(hot[p].dir, (hot[p].hx === id ? n.label + ' fouled' : lab(hot[p].hx) + ' lost its other stream') + ', ' + hot[p].stream + ' stream');
          else if (isHx(pn) && p === id && mode === 'fouled' && /temperature/.test(v)) set('high', 'approach rises across ' + n.label);
          else if (isStore(pn) && /level/.test(v)) {
            var inEd = g.edges.filter(function (e) { return e.type === 'FLOWS_TO' && e.target === p; });
            var fed = inEd.some(function (e) { return after.edges[e.id]; }), was = inEd.some(function (e) { return before.edges[e.id]; });
            if ((was && !fed) || (p === id && mode === 'leaks')) set('low', p === id ? 'it leaks' : 'no longer filled');
          }
        });
      });
      return { after: after, read: read };
    }
    var st = settle(), acted = {};
    /* interlocks: a switch that operates (or trips falsely) acts on its final elements, then the flow settles again */
    for (var pass = 0; pass < 2; pass++) {
      var more = false;
      g.nodes.filter(function (L) { return L.type === 'ControlLoop' && L.kind === 'interlock' && !acted[L.id]; }).forEach(function (L) {
        var S = L.attributes.sensors || [], F = (L.attributes.final_elements || []).slice().sort();
        var hit = S.filter(function (s) {
          if (s === id && mode === 'trips falsely') return true;
          var rd = st.read[s], fn = (parseIsaTag(g.byId[s].tag || g.byId[s].label) || { fnLetters: '' }).fnLetters;
          return rd && rd.reads !== 'stale' && (/H/.test(fn) ? rd.reads === 'high' : /L/.test(fn) ? rd.reads === 'low' : true);
        });
        if (!hit.length) return;
        acted[L.id] = 1; more = true;
        var trip = hit.some(function (s) { return ix.out(s, 'SIGNAL_TO').some(function (e) { return e.attributes.purpose === 'trip'; }); });
        if (trip) stop(F, 'tripped by ' + L.label);
        else F.forEach(function (f) { if (blocked[f] === 'standby') delete blocked[f]; });
        r.responses.push({ loop: L.id, kind: 'interlock', action: trip ? 'stops' : 'commands', sensors: hit, finals: F,
          text: 'Interlock ' + L.label + ' (' + (L.attributes.variable || 'process') + '): ' + joinAnd(hit.map(lab)) + (hit.length > 1 ? ' operate' : ' operates') + ' and ' +
            (trip ? 'stops ' + joinAnd(F.map(lab)) : 'commands ' + joinAnd(F.map(lab)) + ' to run') + '.' });
      });
      if (!more) break;
      st = settle();
    }
    var after = st.after;
    r.lost = Object.keys(before.nodes).filter(function (x) { return !after.nodes[x] && !isStore(g.byId[x]); }).sort(byRank);
    r.lostStreams = Object.keys(before.ports).filter(function (p) { return p.indexOf('|') > 0 && !after.ports[p] && after.nodes[nt.ports[p]]; });
    r.readings = Object.keys(st.read).map(function (s) { return st.read[s]; }).sort(function (x, y) { return byRank(points(x.id)[0], points(y.id)[0]); });
    /* backflow: the check valves between a stopped item and the point where its stand-in's flow joins */
    r.takeover.forEach(function (t) {
      var w = walk(nt, nt.of(t.failed), false, function (p) { return after.ports[p]; }).ports.map(function (p) { return nt.ports[p]; });
      var cks = w.filter(function (x) { return g.byId[x].kind === 'check_valve'; });
      r.backflow.push({ failed: t.failed, by: t.by, valves: cks });
    });
    g.nodes.forEach(function (s) {
      if (!isStore(s)) return;
      var inEd = g.edges.filter(function (e) { return e.type === 'FLOWS_TO' && e.target === s.id; });
      if (inEd.some(function (e) { return before.edges[e.id]; }) && !inEd.some(function (e) { return after.edges[e.id]; })) r.stores.push(s.id);
    });
    /* control loops */
    var gone = function (f) { return !!blocked[f]; };
    g.nodes.filter(function (L) { return L.type === 'ControlLoop' && L.kind !== 'interlock'; }).forEach(function (L) {
      var la = L.attributes, S = la.sensors || [], C = la.controllers || [], F = la.final_elements || [], live = F.filter(function (f) { return !gone(f); });
      var head = 'Loop ' + L.label + ' (' + (la.variable || 'process') + '): ';
      if (C.indexOf(id) >= 0) {
        r.responses.push({ loop: L.id, action: 'lost', finals: F, text: head + 'loses its controller ' + n.label + '; ' + joinAnd(F.map(lab)) + ' ' + (F.length > 1 ? 'hold their' : 'holds its') + ' last position or ' +
          (F.map(function (f) { return g.byId[f].attributes.fail_position; }).filter(Boolean).join(', ') || 'a fail position the drawing does not show') + '.' });
        return;
      }
      var rd = S.map(function (s) { return st.read[s]; }).filter(Boolean)[0], via = function (f) {
        var e = C.length ? ix.out(C[0], 'ACTUATES').filter(function (x) { return x.target === f; })[0] : null;
        return e && e.attributes.via ? ' through ' + e.attributes.via.join(', ') : '';
      };
      var lostF = F.filter(gone).filter(function (f) { return stopped.indexOf(f) >= 0 || f === id; });
      if (rd && rd.reads === 'stale') { r.responses.push({ loop: L.id, action: 'blind', finals: F, text: head + lab(rd.id) + ' has ' + rd.why + '; ' + joinAnd(C.map(lab)) + ' acts on a reading that no longer represents the process.' }); return; }
      if (rd) {
        var raise = rd.reads === 'low', acts = live.map(function (f) { return { id: f, verb: verbFor(g, nt, f, rd.id, raise) }; });
        r.responses.push({ loop: L.id, action: raise ? 'raise' : 'lower', sensor: rd.id, finals: live, acts: acts,
          text: head + (C.length ? joinAnd(C.map(lab)) + ' sees ' : '') + lab(rd.id) + ' ' + rd.reads + ' and ' + (acts.length ? acts.map(function (x) { return x.verb + ' ' + lab(x.id) + via(x.id); }).join('; ') :
            'cannot act: ' + joinAnd(F.map(lab)) + ' ' + (F.length > 1 ? 'are' : 'is') + ' out of service') + '.' });
      } else if (lostF.length && live.length) r.responses.push({ loop: L.id, action: 'shift', finals: live, text: head + 'loses ' + joinAnd(lostF.map(lab)) + ' and now drives ' + joinAnd(live.map(function (f) { return lab(f) + via(f); })) + '.' });
    });
    r.stopped = stopped;
    buildChain(g, n, r, lab, nt, after);
    return r;
  }
  /* an untagged item reads as its drawing id and kind: 'CK-A (check valve)' */
  function nameIn(g, x) {
    var m = g.byId[x]; if (m.tag || m.type === 'Boundary' || m.type === 'ControlLoop' || m.type === 'PipeSegment') return m.label;
    return x.replace(/^P\d+\./, '') + (m.attributes.untagged ? ' (untagged ' + m.attributes.isa_letters + ')' : ' (' + m.label + ')');
  }
  function verbFor(g, nt, f, sensor, raise) {
    var fn = g.byId[f];
    if (fn.type === 'Equipment') return raise ? 'speeds up' : 'slows down';
    var cooling = /temperature/.test(g.byId[sensor].attributes.variable || '') && walk(nt, nt.of(f), false, function (p) { return isHx(g.byId[nt.ports[p]]); })
      .ports.some(function (p) { return isHx(g.byId[nt.ports[p]]) && heatSide(g, nt, p) === 'cold'; });
    return (raise !== cooling) ? 'opens' : 'closes';
  }
  function buildChain(g, n, r, lab, nt, after) {
    var c = r.chain, items = function (ids) { return ids.filter(function (x) { return g.byId[x].type !== 'PipeSegment'; }); };
    c.push({ kind: 'cause', ids: [n.id], text: n.label + ' (' + U.pretty(n.kind || n.attributes.role || n.type) + ') ' + r.mode + '.' });
    var li = items(r.lost).filter(function (x) { return x !== n.id; });
    if (li.length) c.push({ kind: 'effect', ids: r.lost, text: 'Flow stops through ' + joinAnd(li.map(lab)) + '.' });
    r.lostStreams.forEach(function (p) { c.push({ kind: 'effect', ids: [nt.ports[p]], text: 'The ' + p.split('|')[1] + ' stream through ' + lab(nt.ports[p]) + ' stops; its other stream still flows.' }); });
    if (r.mode === 'clogged') c.push({ kind: 'effect', ids: [n.id], text: 'Flow through ' + n.label + ' is restricted; less reaches what lies downstream.' });
    if (r.mode === 'fouled') c.push({ kind: 'effect', ids: [n.id], text: n.label + ' passes less heat: the stream it cools leaves warmer.' });
    if (/fails shut/.test(r.mode)) {
      var up = trace(g, n.id, { dir: 'up' }).equipment.filter(function (x) { return g.byId[x].type === 'Equipment'; })[0];
      c.push({ kind: 'effect', ids: [n.id], text: 'No flow changes, but ' + (up ? lab(up) : 'the system') + ' loses its overpressure protection.' });
    }
    r.takeover.forEach(function (t) { c.push({ kind: 'effect', ids: [t.by], text: lab(t.by) + ' (standby) takes over from ' + lab(t.failed) + '.' }); });
    r.backflow.forEach(function (b) { c.push({ kind: 'effect', ids: b.valves, text: b.valves.length ? joinAnd(b.valves.map(lab)) + ' stops ' + lab(b.by) + "'s flow running back through " + lab(b.failed) + '.' :
      'Nothing drawn between ' + lab(b.failed) + ' and the shared header stops backflow from ' + lab(b.by) + '.' }); });
    r.stores.forEach(function (s) { c.push({ kind: 'effect', ids: [s], text: lab(s) + ' is no longer filled; its level falls.' }); });
    if (c.length === 1) c.push({ kind: 'effect', ids: [], text: 'No flow path changes.' });
    r.responses.forEach(function (x) { c.push({ kind: 'response', ids: [x.loop].concat(x.finals || []), text: x.text }); });
    var seen = r.readings.map(function (x) {
      var sa = g.byId[x.id].attributes;
      return lab(x.id) + ' ' + (x.reads === 'stale' ? 'no longer represents the process' : 'reads ' + x.reads) + ' (' + x.why + (sa.band && x.reads !== 'stale' ? '; normal band ' + sa.band + (sa.unit ? ' ' + sa.unit : '') : '') + ')';
    });
    c.push({ kind: 'sees', ids: r.readings.map(function (x) { return x.id; }), text: seen.length ? 'The operator sees ' + seen.join('; ') + '.' : 'Nothing on this drawing reads abnormal: no instrument measures what changed.' });
    r.fault = uniq(r.lost.concat([r.id], r.stopped));
  }

  /* ------------------------------------------------------------ live values (R120, model output) */
  /* The declared duty scaled by IT load, through CDU_ENGINE. Flow is held at the flow that carries the declared duty at the
     declared rise (engine.flowLpmFromQ; = balance().need_lpm): PD-02 holds the loop dP, so the racks see a constant flow.
     Supply is held at its declared value by the temperature loop; the rise and the return follow the load (engine.hydronicQkW
     per kelvin, properties at the mean temperature, iterated). At load 1 every value equals balance(). */
  function live(g, props, engine, frac) {
    var r = balance(g, props).filter(function (b) { return b.q_kw !== undefined; })[0];
    if (!r || !engine || typeof engine.hydronicQkW !== 'function' || !(frac > 0)) return null;
    var fp = props(r.fluid, r.t_mean), flow = engine.flowLpmFromQ(r.declared_kw, fp.rho / 1000, fp.cp, r.dT), q = r.declared_kw * frac, dT = r.dT * frac;
    for (var i = 0; i < 12; i++) { fp = props(r.fluid, r.t_supply + dT / 2); dT = q / engine.hydronicQkW(flow, fp.rho / 1000, fp.cp, 1); }
    var spec = g.byId[r.node].attributes.balance;
    return { node: r.node, frac: frac, q_kw: q, declared_kw: r.declared_kw, flow_lpm: flow, flow_lpm_per_kw: flow / q, dT: dT, t_supply: r.t_supply,
      t_return: r.t_supply + dT, rho: fp.rho / 1000, cp: fp.cp, fluid: r.fluid, at: { flow: spec.flow, t_supply: spec.t_supply, t_return: spec.t_return } };
  }
  function liveText(v) {
    return fix(v.frac * 100, 0) + ' % of ' + fix(v.declared_kw, 0) + ' kW = ' + fix(v.q_kw, 1) + ' kW. Flow held at ' + fix(v.flow_lpm, 0) + ' LPM; ' + fix(v.q_kw, 1) + ' kW ÷ (' +
      fix(v.flow_lpm, 0) + ' LPM × ' + fix(v.rho, 3) + ' kg/L × ' + fix(v.cp, 3) + ' kJ/kg·K ÷ 60) = ' + fix(v.dT, 1) + ' K rise; return ' + fix(v.t_supply, 0) + ' + ' + fix(v.dT, 1) + ' = ' +
      fix(v.t_return, 1) + ' °C.';
  }

  var api = { buildGraph: buildGraph, tagScopes: tagScopes, qa: qa, trace: trace, loopOf: loopOf, impact: impact, failMode: failMode,
    live: live, liveText: liveText, explain: explain, normalizeTag: Bm.normalizeTag, normalizeLabel: Bm.normalizeLabel,
    parseIsaTag: parseIsaTag, decodeTag: decodeTag, loopVariable: Bm.loopVariable, LOW_CONFIDENCE: Bm.LOW_CONFIDENCE,
    LOCATION_WORD: LOCATION_WORD, flowRank: flowRank, balance: balance, balanceText: balanceText, explainKey: explainKey,
    BALANCE_TOLERANCE: BALANCE_TOLERANCE,
    _: { index: index, valueText: valueText, measuredWhere: measuredWhere } };
  if (root.RZPid && root.RZPid.render) api.render = root.RZPid.render;
  root.RZPid = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
