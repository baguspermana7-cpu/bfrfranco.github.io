/*!
 * rz-pid-graph.js — the P&ID model's public face (resistancezero.com, R116/R117): window.RZPid
 *
 * Depends on rz-pid-build.js (the graph builder ported from PID-to-Knowledge-Graph, MIT — its notice is in that
 * file). This file adds what is RZ: the three-part explanation (process flow, measurement, control loops), the
 * coolant-order rank, the heat balance and the RZExplain key of a tag. Works in Node (module.exports) and in the
 * browser (window.RZPid). Vanilla ES5, no build.
 */
(function (root) {
  'use strict';
  if (root.RZPid && root.RZPid.balance) { if (typeof module !== 'undefined' && module.exports) module.exports = root.RZPid; return; }
  var Bm = root.RZPidBuild || (typeof require === 'function' ? require('./rz-pid-build.js') : null);
  if (!Bm) throw new Error('rz-pid-graph.js: load rz-pid-build.js first');
  var U = Bm._, has = U.has, nearest = U.nearest, TERMINAL_TYPES = U.TERMINAL_TYPES;
  var decodeTag = Bm.decodeTag, parseIsaTag = Bm.parseIsaTag, LOCATION_WORD = Bm.LOCATION_WORD;
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

  var api = { buildGraph: Bm.buildGraph, explain: explain, normalizeTag: Bm.normalizeTag, normalizeLabel: Bm.normalizeLabel,
    parseIsaTag: parseIsaTag, decodeTag: decodeTag, loopVariable: Bm.loopVariable, LOW_CONFIDENCE: Bm.LOW_CONFIDENCE,
    LOCATION_WORD: LOCATION_WORD, flowRank: flowRank, balance: balance, balanceText: balanceText, explainKey: explainKey,
    BALANCE_TOLERANCE: BALANCE_TOLERANCE,
    _: { index: index, valueText: valueText, measuredWhere: measuredWhere } };
  if (root.RZPid && root.RZPid.render) api.render = root.RZPid.render;
  root.RZPid = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
