/* ============================================================================
 * ltc-tier.js — Tier topology simulator + availability calculator
 * ----------------------------------------------------------------------------
 * The Tier Standard: Topology defines Tiers by OBJECTIVE, not by percentage:
 *   I   basic capacity
 *   II  redundant capacity components
 *   III concurrently maintainable — any component or path can be removed for
 *       planned work without affecting the IT load
 *   IV  fault tolerant — any single failure is tolerated (plus
 *       compartmentalisation and continuous cooling, not modelled here)
 * This tool tests those objectives on a simplified POWER path by taking each
 * component out, one at a time, under two modes:
 *   maintenance — planned: an alternate path may be switched in first
 *   fault       — unplanned: only paths already carrying load count
 * Utility is drawn only for Tier I/II: for III/IV the Standard treats on-site
 * generation as the primary source and the utility as an economic choice.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  /* ---- topology, generated from the shared plant (js/ltc-plant.js) ---------------------
   * Unit counts are DH01's: the hall's share of generators, transformers and UPS modules, and
   * the hall's own CDUs and CRAHs; the central chiller plant and liquid coolers at campus size.
   * The Tier sets the redundancy and the paths, the plant sets N:
   *   I   N everywhere, one path            II  N+1 capacity, one path
   *   III N+1, a second (alternate) path    IV  N+N generators, two active paths
   * A load survives only if EVERY group it needs has a working path: the IT power path AND the
   * mechanical power path (no power to the pumps is an IT outage a few seconds later); in the
   * cooling view the liquid heat sink AND the air heat sink. Each view stays within the diagram
   * engine's nine blocks: LV boards ride with their transformers, towers with their chillers. */
  function plantN() {
    var S = window.LTCPlantStrip, r = S ? S.get().result : null;
    if (!r) return { gen: 9, tx: 9, ups: 17, mcc: 1, cdu: 9, cooler: 41, crah: 16, chiller: 6, fwsPump: 4, chwPump: 3, hall: 'DH01', r: null };
    var halls = r.input.halls, d = r.design;
    return {
      gen: Math.ceil(d.facility / halls / r.input.genUnitKw), tx: Math.ceil((d.upsIn + d.distLoss + d.mcc) / halls / r.input.txUnitKw),
      ups: Math.ceil(d.upsOut / halls / r.input.upsModuleKw), cdu: r.liquid.cduDutyN, crah: r.air.crahDutyN,
      cooler: r.liquid.coolerUnits, chiller: r.air.chillersN, fwsPump: Math.max(1, Math.ceil(r.liquid.fwsLps / halls / 400)),
      chwPump: Math.max(1, Math.ceil(r.air.chwLps / 300)), hall: 'DH01', r: r
    };
  }
  function U(n, extra) { return { units: n + extra, need: n }; }
  function makeTopo() {
    var N = plantN(), T = {}, C = {};
    [1, 2, 3, 4].forEach(function (t) {
      var x = t === 1 ? 0 : 1;                                   // spare units from Tier II up
      var gen = t === 4 ? { units: 2 * N.gen, need: N.gen } : U(N.gen, x);
      var dual = t >= 3, active2 = t === 4;
      var nodes = [];
      if (t <= 2) nodes.push({ id: 'util', name: 'Utility', sym: 'utility', sub: 'MV service' });
      nodes.push(Object.assign({ id: 'gen', name: t === 4 ? 'Generators N+N' : 'Generators', sym: 'genset', unitKw: N.r && N.r.input.genUnitKw }, gen));
      if (!dual) {
        nodes.push(Object.assign({ id: 'tx', name: 'TX + LV board', sym: 'transformer', path: true, unitKw: N.r && N.r.input.txUnitKw }, U(N.tx, x)));
        nodes.push(Object.assign({ id: 'ups', name: 'UPS modules', sym: 'ups', path: true, unitKw: N.r && N.r.input.upsModuleKw }, U(N.ups, x)));
        nodes.push({ id: 'pdu', name: 'PDU', sym: 'pdu', sub: 'single path' });
        nodes.push({ id: 'mcc', name: 'MCC', sym: 'breaker', sub: 'mechanical, single' });
        nodes.push({ id: 'rack', name: 'IT load', sym: 'rack', sub: 'single-corded', load: true });
        var src = t <= 2 ? [['util', 'gen']] : ['gen'];
        T[t] = { label: ['', 'Tier I — basic capacity', 'Tier II — redundant capacity components'][t], nodes: nodes,
          paths: [{ id: 'A', active: true, stages: src.concat(['tx', 'ups', 'pdu']) }],
          groups: [{ id: 'mech', name: 'mechanical power', paths: [{ id: 'M', active: true, stages: src.concat(['tx', 'mcc']) }] }] };
      } else {
        ['A', 'B'].forEach(function (P) {
          nodes.push(Object.assign({ id: 'tx' + P, name: 'TX + LV ' + P, sym: 'transformer', path: true, unitKw: N.r && N.r.input.txUnitKw }, U(N.tx, 1)));
        });
        ['A', 'B'].forEach(function (P) {
          nodes.push(Object.assign({ id: 'ups' + P, name: 'UPS ' + P, sym: 'ups', path: true, unitKw: N.r && N.r.input.upsModuleKw }, U(N.ups, 1)));
        });
        nodes.push({ id: 'pduA', name: 'PDU A', sym: 'pdu', sub: 'active' });
        nodes.push({ id: 'pduB', name: 'PDU B', sym: 'pdu', sub: active2 ? 'active' : 'alternate' });
        nodes.push({ id: 'mcc', name: 'MCC A / B', sym: 'breaker', units: 2, need: 1, sub: 'dual-fed mechanical' });
        nodes.push({ id: 'rack', name: 'IT load', sym: 'rack', sub: 'dual-corded', load: true });
        T[t] = { label: t === 3 ? 'Tier III — concurrently maintainable' : 'Tier IV — fault tolerant', nodes: nodes,
          paths: [{ id: 'A', active: true, stages: ['gen', 'txA', 'upsA', 'pduA'] }, { id: 'B', active: active2, stages: ['gen', 'txB', 'upsB', 'pduB'] }],
          groups: [{ id: 'mech', name: 'mechanical power', paths: [{ id: 'M', active: true, stages: ['gen', ['txA', 'txB'], 'mcc'] }] }] };
      }
      /* cooling: two heat sinks, both needed */
      var cn = [];
      cn.push(Object.assign({ id: 'cdu', name: 'CDUs', sym: 'cdu', unitKw: N.r && N.r.input.cduUnitKw }, U(N.cdu, x)));
      if (!dual) cn.push(Object.assign({ id: 'fws', name: 'FWS pumps + loop', sym: 'pump', path: true }, U(N.fwsPump, x)));
      else { cn.push(Object.assign({ id: 'fwsA', name: 'FWS loop A', sym: 'pump', sub: 'active', path: true }, U(N.fwsPump, 1)));
             cn.push(Object.assign({ id: 'fwsB', name: 'FWS loop B', sym: 'pump', sub: active2 ? 'active' : 'alternate, valved', path: true }, U(N.fwsPump, 1))); }
      cn.push(Object.assign({ id: 'cooler', name: 'Liquid coolers', sym: 'dryCooler' }, U(N.cooler, x)));
      cn.push(Object.assign({ id: 'crah', name: 'CRAHs', sym: 'crah', unitKw: N.r && N.r.input.crahUnitKw }, U(N.crah, x)));
      if (!dual) cn.push(Object.assign({ id: 'chw', name: 'CHW pumps + loop', sym: 'pump', path: true }, U(N.chwPump, x)));
      else { cn.push(Object.assign({ id: 'chwA', name: 'CHW loop A', sym: 'pump', sub: 'active', path: true }, U(N.chwPump, 1)));
             cn.push(Object.assign({ id: 'chwB', name: 'CHW loop B', sym: 'pump', sub: active2 ? 'active' : 'alternate, valved', path: true }, U(N.chwPump, 1))); }
      cn.push(Object.assign({ id: 'chiller', name: 'Chiller plant', sym: 'chiller', sub: 'with its towers', unitKw: N.r && N.r.input.chillerUnitKw },
        t === 4 ? { units: 2 * N.chiller, need: N.chiller } : U(N.chiller, x)));
      cn.push({ id: 'rack', name: 'IT heat load', sym: 'rack', sub: 'liquid + air', load: true });
      var lp = dual ? [{ id: 'A', active: true, stages: ['cdu', 'fwsA', 'cooler'] }, { id: 'B', active: active2, stages: ['cdu', 'fwsB', 'cooler'] }]
                    : [{ id: 'A', active: true, stages: ['cdu', 'fws', 'cooler'] }];
      var ap = dual ? [{ id: 'A', active: true, stages: ['crah', 'chwA', 'chiller'] }, { id: 'B', active: active2, stages: ['crah', 'chwB', 'chiller'] }]
                    : [{ id: 'A', active: true, stages: ['crah', 'chw', 'chiller'] }];
      C[t] = { label: T[t].label, nodes: cn, paths: lp, groups: [{ id: 'air', name: 'air heat sink', paths: ap }] };
    });
    return { power: T, cooling: C, N: N };
  }
  var GEN = makeTopo(), TOPO = GEN.power, COOL = GEN.cooling;
  var SYS = { power: TOPO, cooling: COOL };
  var sysName = 'power';
  function T_(t) { return SYS[sysName][t]; }

  /* ---- the model (pure: topology + outage map in, verdict out) ----------- */
  function nodeOf(t, id) { return T_(t).nodes.filter(function (n) { return n.id === id; })[0]; }
  /** out: { 'ups#2': 'maint', 'swbA': 'fail' } — unit keys are id#k (1-based). */
  function available(t, id, out) {
    var n = nodeOf(t, id);
    if (n.units) {
      var up = 0;
      for (var k = 1; k <= n.units; k++) if (!out[id + '#' + k]) up++;
      return !out[id] && up >= n.need;
    }
    return !out[id];
  }
  function pathOk(t, p, out) {
    return p.stages.every(function (s) {
      return Array.isArray(s) ? s.some(function (x) { return available(t, x, out); }) : available(t, s, out);
    });
  }
  /** Is the IT load powered? `planned` lets an alternate path be switched in first. */
  function groupsOf(t) { var T = T_(t); return [{ id: 'main', paths: T.paths }].concat(T.groups || []); }
  function groupOk(t, g, out, planned) { return g.paths.some(function (p) { return (p.active || planned) && pathOk(t, p, out); }); }
  /** Is the load carried? Every group it needs must have a working path (IT power AND mechanical
   *  power; liquid sink AND air sink). `planned` lets an alternate path be switched in first. */
  function powered(t, out, planned) {
    return groupsOf(t).every(function (g) { return groupOk(t, g, out, planned); });
  }
  /** Which groups failed — the consequence column of the sweep. */
  function lostGroups(t, out, planned) {
    return groupsOf(t).filter(function (g) { return !groupOk(t, g, out, planned); }).map(function (g) { return g.id; });
  }
  /** Every removable element: single components, and each unit of a group. */
  function elements(t) {
    var list = [];
    T_(t).nodes.forEach(function (n) {
      if (n.load) return;
      // identical units are symmetric: one unit out stands for any one of them
      if (n.units) list.push({ key: n.id + '#1', node: n, label: n.name + ' — any 1 of ' + n.units });
      else list.push({ key: n.id, node: n, label: n.name });
      // a bus, a UPS output board, a pipe loop is ONE component however many units hang on it
      if (n.units && n.path) list.push({ key: n.id, node: n, label: n.name + ' — the whole ' + (/loop/i.test(n.name) ? 'loop' : 'board') });
    });
    return list;
  }
  function sweep(t) {
    return elements(t).map(function (e) {
      var o = {}; o[e.key] = 1;
      return { e: e, maint: powered(t, o, true), fault: powered(t, o, false), lost: lostGroups(t, o, false) };
    });
  }

  /* ---- state + figure ---------------------------------------------------- */
  var st = { tier: 3, out: {} };   /* out[key] = 'maint' | 'fail' */

  // one redundancy label for the diagram and the inspector: twice the need or more is 2N, not "N+9"
  function redLabel(units, need) { return units >= 2 * need && need > 0 ? '2N' : units > need ? 'N+' + (units - need) : 'N'; }
  function nodeSub(n, short) {
    if (!n.units) return n.sub || '';
    var up = 0;
    for (var k = 1; k <= n.units; k++) if (!st.out[n.id + '#' + k]) up++;
    return up + '/' + n.units + (short ? '' : ' up') + ' · need ' + n.need + ' (' + redLabel(n.units, n.need) + ')';
  }
  function nodeState(n) {
    if (n.load) return powered(st.tier, outMap(), plannedOnly()) ? 'live' : 'dead';
    if (st.out[n.id]) return st.out[n.id] === 'fail' ? 'fail' : 'maint';
    if (n.units) {
      for (var k = 1; k <= n.units; k++) if (st.out[n.id + '#' + k]) return available(st.tier, n.id, outMap()) ? 'maint' : 'fail';
    }
    return null;
  }
  function outMap() { var o = {}; for (var k in st.out) o[k] = 1; return o; }
  function plannedOnly() { for (var k in st.out) if (st.out[k] === 'fail') return false; return true; }

  /* Which nodes are carrying the load right now: every available node on each
   * path that counts (active paths; or, with only planned outages, an alternate
   * that has been switched in). Connectors between two live nodes animate. */
  function liveSet() {
    var t = st.tier, out = outMap(), T = T_(t), live = {};
    var counting = [];
    groupsOf(t).forEach(function (g) {
      var c = g.paths.filter(function (p) { return p.active && pathOk(t, p, out); });
      if (!c.length && plannedOnly()) c = g.paths.filter(function (p) { return pathOk(t, p, out); }).slice(0, 1);
      counting = counting.concat(c);
    });
    counting.forEach(function (p) {
      p.stages.forEach(function (sg) {
        (Array.isArray(sg) ? sg : [sg]).forEach(function (id) { if (available(t, id, out)) live[id] = 1; });
      });
    });
    if (counting.length) T.nodes.forEach(function (n) { if (n.load) live[n.id] = 1; });
    return live;
  }
  function withFlow(d) {
    var live = liveSet(), edge0 = d.edge;
    d.edge = function (a, b, o) {
      o = o || {};
      if (!o.state && live[o.fromId] && live[o.toId]) o.state = 'flow';
      return edge0(a, b, o);
    };
    return d;
  }

  /* ---- figure: one grid spec per (system, single/dual path) ---------------------------
   * [id, col, row, {rows: span}] and edges [from, side, to, side, style]. Sides l r t b, or
   * l1/l2, b1/b2 … for two connectors sharing an edge (fanned at thirds). Narrow panes use NLAY below. */
  var LAY = {
    power1: { nodes: [['util', 0, 0], ['gen', 0, 1], ['tx', 1, 0], ['ups', 2, 0], ['pdu', 3, 0], ['rack', 4, 0, { rows: 2 }], ['mcc', 2, 1]],
      edges: [['util', 'r', 'tx', 'l', 'P'], ['gen', 'r', 'tx', 'b1', 'P'], ['tx', 'r', 'ups', 'l', 'P'], ['ups', 'r', 'pdu', 'l', 'P'],
              ['pdu', 'r', 'rack', 'l', 'P'], ['tx', 'b2', 'mcc', 'l', 'P'], ['mcc', 'r', 'rack', 'l', 'M']] },
    power2: { nodes: [['gen', 0, 1], ['txA', 1, 0], ['upsA', 2, 0], ['pduA', 3, 0], ['mcc', 2, 1], ['txB', 1, 2], ['upsB', 2, 2], ['pduB', 3, 2], ['rack', 4, 0, { rows: 3 }]],
      edges: [['gen', 't', 'txA', 'l', 'P'], ['gen', 'b', 'txB', 'l', 'B'], ['txA', 'r', 'upsA', 'l', 'P'], ['upsA', 'r', 'pduA', 'l', 'P'], ['pduA', 'r', 'rack', 'l', 'P'],
              ['txB', 'r', 'upsB', 'l', 'B'], ['upsB', 'r', 'pduB', 'l', 'B'], ['pduB', 'r', 'rack', 'l', 'B'],
              ['txA', 'b', 'mcc', 'l1', 'P'], ['txB', 't', 'mcc', 'l2', 'B'], ['mcc', 'r', 'rack', 'l', 'M']] },
    cool1: { nodes: [['rack', 0, 0, { rows: 2 }], ['cdu', 1, 0], ['fws', 2, 0], ['cooler', 3, 0], ['crah', 1, 1], ['chw', 2, 1], ['chiller', 3, 1]],
      edges: [['rack', 'r', 'cdu', 'l', 'Q'], ['cdu', 'r', 'fws', 'l', 'Q'], ['fws', 'r', 'cooler', 'l', 'Q'],
              ['rack', 'r', 'crah', 'l', 'A'], ['crah', 'r', 'chw', 'l', 'A'], ['chw', 'r', 'chiller', 'l', 'A']] },
    cool2: { nodes: [['rack', 0, 0, { rows: 4 }], ['cdu', 1, 0], ['fwsA', 2, 0], ['fwsB', 2, 1], ['cooler', 3, 0], ['crah', 1, 2], ['chwA', 2, 2], ['chwB', 2, 3], ['chiller', 3, 2]],
      edges: [['rack', 'r', 'cdu', 'l', 'Q'], ['cdu', 'r', 'fwsA', 'l', 'Q'], ['cdu', 'b', 'fwsB', 'l', 'QB'], ['fwsA', 'r', 'cooler', 'l', 'Q'], ['fwsB', 'r', 'cooler', 'b', 'QB'],
              ['rack', 'r', 'crah', 'l', 'A'], ['crah', 'r', 'chwA', 'l', 'A'], ['crah', 'b', 'chwB', 'l', 'AB'], ['chwA', 'r', 'chiller', 'l', 'A'], ['chwB', 'r', 'chiller', 'b', 'AB']] }
  };
  /* Narrow panes (phones): two lanes instead of one stacked column, so connectors run straight down
   * or as one L. Power: path A left, path B right, generators and IT span both, the MCC sits between
   * them. Cooling: liquid sink left, air sink right. Nodes [id, lane, row]: lane 0 | 1 | 'full' |
   * 'mid'. Edges [from, side, to, side, x | stub]: a b→t pair runs straight down at x; an l/r pair
   * takes a side channel `stub` wide; an L gives its vertical x and its horizontal y fraction. */
  var NX = { 0: [24, 140], 1: [196, 140], full: [24, 312], mid: [112, 136] };
  var NLAY = {
    power1: { nodes: [['util', 0, 0], ['gen', 1, 0], ['tx', 0, 1], ['ups', 0, 2], ['mcc', 1, 2], ['pdu', 0, 3], ['rack', 'full', 4]],
      edges: [['util', 'b', 'tx', 't', 94], ['gen', 'b', 'tx', 'r', 301, 1 / 3], ['tx', 'b', 'ups', 't', 94], ['tx', 'r', 'mcc', 't', 222, 2 / 3],
              ['ups', 'b', 'pdu', 't', 94], ['pdu', 'b', 'rack', 't', 94], ['mcc', 'b', 'rack', 't', 266]] },
    power2: { nodes: [['gen', 'full', 0], ['txA', 0, 1], ['txB', 1, 1], ['mcc', 'mid', 2], ['upsA', 0, 3], ['upsB', 1, 3], ['pduA', 0, 4], ['pduB', 1, 4], ['rack', 'full', 5]],
      edges: [['gen', 'b', 'txA', 't', 94], ['gen', 'b', 'txB', 't', 266], ['txA', 'b', 'upsA', 't', 59], ['txB', 'b', 'upsB', 't', 301],
              ['txA', 'b', 'mcc', 't', 138], ['txB', 'b', 'mcc', 't', 222], ['upsA', 'b', 'pduA', 't', 94], ['upsB', 'b', 'pduB', 't', 266],
              ['pduA', 'b', 'rack', 't', 94], ['pduB', 'b', 'rack', 't', 266], ['mcc', 'b', 'rack', 't', 180]] },
    cool1: { nodes: [['rack', 'full', 0], ['cdu', 0, 1], ['crah', 1, 1], ['fws', 0, 2], ['chw', 1, 2], ['cooler', 0, 3], ['chiller', 1, 3]],
      edges: [['rack', 'b', 'cdu', 't', 94], ['rack', 'b', 'crah', 't', 266], ['cdu', 'b', 'fws', 't', 94], ['crah', 'b', 'chw', 't', 266],
              ['fws', 'b', 'cooler', 't', 94], ['chw', 'b', 'chiller', 't', 266]] },
    cool2: { nodes: [['rack', 'full', 0], ['cdu', 0, 1], ['crah', 1, 1], ['fwsA', 0, 2], ['chwA', 1, 2], ['fwsB', 0, 3], ['chwB', 1, 3], ['cooler', 0, 4], ['chiller', 1, 4]],
      edges: [['rack', 'b', 'cdu', 't', 94], ['rack', 'b', 'crah', 't', 266], ['cdu', 'b', 'fwsA', 't', 94], ['crah', 'b', 'chwA', 't', 266],
              ['cdu', 'l', 'fwsB', 'l', { stub: 12 }], ['fwsA', 'r', 'cooler', 'r', { stub: 12 }], ['fwsB', 'b', 'cooler', 't', 94],
              ['crah', 'l', 'chwB', 'l', { stub: 12 }], ['chwA', 'r', 'chiller', 'r', { stub: 12 }], ['chwB', 'b', 'chiller', 't', 266]] }
  };
  function build(D, o) {
    var T = T_(st.tier), cool = sysName === 'cooling', dual = T.paths.length === 2, altActive = dual && T.paths[1].active;
    var spec = LAY[(cool ? 'cool' : 'power') + (dual ? 2 : 1)];
    var d = withFlow(D.create({ slug: (cool ? 'cool' : 'tier') + st.tier, title: T.label + (cool ? ' — liquid and air heat sinks' : ' — IT and mechanical power'),
      desc: (cool ? 'DH01 cooling for ' + T.label + ': the liquid sink (CDUs, facility water, liquid coolers) and the air sink (CRAHs, chilled water, chiller plant); the IT heat load needs both.'
                  : 'DH01 power for ' + T.label + ': generators, transformers with their LV boards, UPS and PDUs to the IT load, and the MCC that keeps the cooling running.') +
            ' Select a block to take it out.' }));
    var NW = 156, NH = 88, CG = 20, RG = 40, box = {};
    var nspec = NLAY[(cool ? 'cool' : 'power') + (dual ? 2 : 1)];
    (o.narrow ? nspec : spec).nodes.forEach(function (sp) {
      var n = nodeOf(st.tier, sp[0]), ex = sp[3] || {};
      if (!n) return;
      var x = o.narrow ? NX[sp[1]][0] : 24 + sp[1] * (NW + CG), y = o.narrow ? 16 + sp[2] * (NH + 36) : 24 + sp[2] * (NH + RG);
      var h = !o.narrow && ex.rows ? NH + (ex.rows - 1) * (NH + RG) : NH;
      box[sp[0]] = d.node(x, y, { id: n.id, name: n.name, sublabel: nodeSub(n, o.narrow), symbol: n.sym, interactive: true,
        state: nodeState(n) || undefined, focal: !!n.load, fill: n.load ? 'paper-2' : 'paper', tier: n.load ? 1 : 2, w: o.narrow ? NX[sp[1]][1] : NW, h: h,
        legend: n.load ? (cool ? 'IT heat load' : 'IT load') : (cool ? 'Cooling component' : 'Power component') });
    });
    var STY = { P: { tier: 1, stroke: 'ink', legend: 'Active path' }, B: altActive ? { tier: 1, stroke: 'ink' } : { tier: 2, stroke: 'muted', pattern: 'dashed', legend: 'Alternate path' },
                M: { tier: 2, stroke: 'soft', pattern: 'dotted', legend: 'Keeps the cooling running' },
                Q: { tier: 1, stroke: 'link', pattern: 'dashed', legend: 'Liquid heat sink' }, QB: altActive ? { tier: 1, stroke: 'link', pattern: 'dashed' } : { tier: 2, stroke: 'muted', pattern: 'dotted', legend: 'Alternate loop' },
                A: { tier: 1, stroke: 'accent', pattern: 'dash-dot', legend: 'Air heat sink' }, AB: altActive ? { tier: 1, stroke: 'accent', pattern: 'dash-dot' } : { tier: 2, stroke: 'muted', pattern: 'dotted', legend: 'Alternate loop' } };
    function at(bx, side) {
      var k = side.charAt(1) ? +side.charAt(1) : 0, f = k ? k / 3 : 0.5, s0 = side.charAt(0);
      return s0 === 'l' ? { x: bx.x, y: bx.y + bx.h * f } : s0 === 'r' ? { x: bx.x + bx.w, y: bx.y + bx.h * f }
           : s0 === 't' ? { x: bx.x + bx.w * f, y: bx.y } : { x: bx.x + bx.w * f, y: bx.y + bx.h };
    }
    if (o.narrow) {
      var styleOf = {};
      spec.edges.forEach(function (e) { styleOf[e[0] + '>' + e[2]] = e[4]; });
      nspec.edges.forEach(function (e) {
        var A = box[e[0]], B = box[e[2]]; if (!A || !B) return;
        var s1 = e[1], s2 = e[3], g = e[4], f = e[5], p1, p2, stub;
        function side(bx, sd, xv, yf) {
          return sd === 'b' ? { x: xv, y: bx.y + bx.h } : sd === 't' ? { x: xv, y: bx.y }
               : { x: sd === 'l' ? bx.x : bx.x + bx.w, y: bx.y + bx.h * (yf || 0.5) };
        }
        if (typeof g === 'object') { stub = g.stub; p1 = side(A, s1); p2 = side(B, s2); }
        else { p1 = side(A, s1, s1 === 'b' || s1 === 't' ? g : null, f); p2 = side(B, s2, s2 === 'b' || s2 === 't' ? g : null, f); }
        d.edge(p1, p2, Object.assign({ fromId: e[0], toId: e[2], id: e[0] + '>' + e[2], fromSide: s1, toSide: s2, stub: stub }, STY[styleOf[e[0] + '>' + e[2]]]));
      });
      d.legend();
      return d;
    }
    spec.edges.forEach(function (e) {
      var A = box[e[0]], B = box[e[2]]; if (!A || !B) return;
      var p1 = at(A, e[1]), p2 = at(B, e[3]);
      // a connector into or out of a tall block stays level with its other end
      if (B.h > NH && e[3].charAt(0) === 'l') p2 = { x: B.x, y: p1.y };
      if (A.h > NH && e[1].charAt(0) === 'r') p1 = { x: A.x + A.w, y: p2.y };
      d.edge(p1, p2, Object.assign({ fromId: e[0], toId: e[2], id: e[0] + '>' + e[2], fromSide: e[1].charAt(0), toSide: e[3].charAt(0) }, STY[e[4]]));
    });
    d.legend();
    return d;
  }

  /* live numbers for the hover tooltip: units, unit size, capacity against the hall's need */
  function tierTips() {
    var t = {}, N = plantN(), r = N.r;
    T_(st.tier).nodes.forEach(function (n) {
      var rows = [];
      if (n.units) {
        rows.push(['Installed', String(n.units)], ['Needed (N)', String(n.need)], ['Redundancy', n.units > n.need ? redLabel(n.units, n.need) : 'none']);
        if (n.unitKw) rows.push(['Unit size', L.fmt(n.unitKw, 0) + ' kW'], ['Capacity at N', L.fmt(n.need * n.unitKw / 1000, 1) + ' MW']);
      } else if (!n.load) rows.push(['Component', n.sub || 'single']);
      if (n.load && r) rows.push(['Hall IT', L.fmt(r.it.hallKw / 1000, 1) + ' MW'], ['Liquid / air', L.fmt(r.liquid.dutyKw / r.input.halls / 1000, 1) + ' / ' + L.fmt(r.air.hallLoadKw / 1000, 1) + ' MW']);
      t[n.id] = { title: n.name, rows: rows, formula: n.units ? 'N = ceil(DH01 load / unit size); spares by Tier' : '' };
    });
    return t;
  }

  /* ---- verdicts ---------------------------------------------------------- */
  function ro(k, v, s) { return '<div class="ltc-ro"' + (s ? ' data-state="' + s + '"' : '') + '><dt>' + k + '</dt><dd style="font-size:15px">' + v + '</dd></div>'; }
  function render() {
    fig.redraw();
    var live = powered(st.tier, outMap(), plannedOnly());
    var anyFail = !plannedOnly();
    var n = Object.keys(st.out).length;
    var transferable = anyFail && !live && powered(st.tier, outMap(), true);
    var v = document.getElementById('tVerdict');
    v.setAttribute('data-state', live ? (n ? 'warn' : 'ok') : 'fail');
    v.innerHTML = live
      ? '<b>' + (n ? 'Load carried' : 'Normal') + '</b><span>' + (n ? n + ' element(s) out; the IT load stays ' + (sysName === 'cooling' ? 'cooled.' : 'powered.') : 'All components in service. Select a block to take part of it out.') + '</span>'
      : '<b>Load lost</b><span>' + (transferable ? 'The alternate path is healthy but not carrying load: the IT load drops until it is switched in.' : (sysName === 'cooling' ? 'No path can remove the IT heat.' : 'No path can carry the IT load.')) + '</span>';
    var sw = sweep(st.tier);
    var cm = sw.every(function (r) { return r.maint; }), ft = sw.every(function (r) { return r.fault; });
    document.getElementById('tSummary').innerHTML = '<dl class="ltc-readouts">' +
      ro('Concurrently maintainable', cm ? 'yes' : 'no — ' + sw.filter(function (r) { return !r.maint; }).length + ' blockers', cm ? 'ok' : 'fail') +
      ro('Fault tolerant (single failure)', ft ? 'yes' : 'no — ' + sw.filter(function (r) { return !r.fault; }).length + ' SPOF', ft ? 'ok' : 'fail') +
      ro('Elements tested', String(sw.length)) + '</dl>' +
      '<p class="ltc-note">Counts are DH01’s, from the shared plant (edit it in the strip above). See what each cooling fault does to the hall on the <a href="standards-ltc-lab.html#thermal">DH01 thermal map →</a></p>';
    document.getElementById('tSweep').innerHTML = '<table class="ltc-table"><thead><tr><th>Element taken out</th><th>Planned maintenance</th><th>Unplanned failure</th><th>What fails</th></tr></thead><tbody>' +
      sw.map(function (r) {
        function c(ok) { return ok ? '<span style="color:var(--g)">load carried</span>' : '<b style="color:var(--r)">load lost</b>'; }
        return '<tr><td>' + L.esc(r.e.label) + '</td><td>' + c(r.maint) + '</td><td>' + c(r.fault) + '</td><td>' + consequence(r) + '</td></tr>';
      }).join('') + '</tbody></table>';
    document.querySelectorAll('[data-tier]').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-tier') === st.tier ? 'true' : 'false'); });
  }

  /* What an unplanned loss of this element takes down, in the plant's own numbers. */
  function consequence(r) {
    if (!r.lost.length) return '<span style="color:var(--t3)">—</span>';
    var N = plantN(), x = N.r, hall = x ? x.it.hallKw / 1000 : 0, mw = function (v) { return L.fmt(v, 1) + ' MW'; };
    return r.lost.map(function (g) {
      if (g === 'main' && sysName === 'power') return 'IT power: ' + mw(hall) + ' of IT drops';
      if (g === 'mech') return 'Mechanical power: pumps and fans stop; cold plates throttle in seconds';
      if (g === 'main') return 'Liquid sink: ' + (x ? mw(x.liquid.dutyKw / x.input.halls / 1000) : '') + ' with nowhere to go; TCS reaches ' + (x ? x.input.throttleC : 60) + ' °C in ≈' + (x ? Math.round(window.LTCPlant.transient(x, 'fws-pump').secondsToLimit / 60 * 10) / 10 : '') + ' min';
      if (g === 'air') return 'Air sink: ' + (x ? mw(x.air.hallLoadKw / 1000) : '') + ' of air heat unremoved; CHW warms past the coil limit in ≈' + (x ? Math.round((window.LTCPlant.transient(x, 'chw').secondsToLimit || 0) / 60 * 10) / 10 : '') + ' min';
      return g;
    }).join('; ');
  }

  /* inspector: per-unit controls for the selected block */
  function inspectNode(id) {
    var n = nodeOf(st.tier, id);
    if (!n) return;
    if (n.load) {
      L.inspect({ sym: n.sym, eyebrow: T_(st.tier).label, title: n.name, html:
        '<p>' + (powered(st.tier, outMap(), plannedOnly()) ? 'Powered.' : 'Not powered.') + ' ' + (n.sub === 'dual-corded'
          ? 'Dual-corded: either cord can carry the load, which is what lets a path be removed.'
          : 'Single-corded: the single path is the load’s only supply.') + '</p>' });
      return;
    }
    var keys = n.units ? Array.from({ length: n.units }, function (_, k) { return [n.id + '#' + (k + 1), 'Unit ' + (k + 1)]; }) : [[n.id, n.name]];
    var html = '<p>' + (n.units ? n.units + ' installed, ' + n.need + ' needed for the load.' : 'Single component in its path.') + '</p>' +
      keys.map(function (kv) {
        var cur = st.out[kv[0]] || 'in';
        return '<div style="margin-top:10px"><div class="ltc-eyebrow" style="margin-bottom:6px">' + kv[1] + '</div><div class="ltc-seg" role="group" aria-label="' + kv[1] + ' state">' +
          [['in', 'In service'], ['maint', 'Maintenance'], ['fail', 'Failed']].map(function (s) {
            return '<button type="button" data-k="' + kv[0] + '" data-s="' + s[0] + '" aria-pressed="' + (cur === s[0]) + '">' + s[1] + '</button>';
          }).join('') + '</div></div>';
      }).join('');
    L.inspect({ sym: n.sym, eyebrow: T_(st.tier).label, title: n.name, html: html });
    document.querySelector('#ltcInsp .ltc-insp-b').onclick = function (e) {
      var b = e.target.closest('[data-k]');
      if (!b) return;
      var k = b.getAttribute('data-k'), s = b.getAttribute('data-s');
      if (s === 'in') delete st.out[k]; else st.out[k] = s;
      render(); inspectNode(id);
      /* the rebuild destroyed the pressed button: put focus back on its twin */
      var again = document.querySelector('#ltcInsp [data-k="' + k + '"][data-s="' + s + '"]');
      if (again) again.focus();
    };
  }

  /* ---- availability calculator ------------------------------------------ */
  var BLOCKS = [
    { name: 'Generator plant', mtbf: 15000, mttr: 8, n: 3, k: 2 },
    { name: 'Switchboard', mtbf: 500000, mttr: 4, n: 1, k: 1 },
    { name: 'UPS modules', mtbf: 150000, mttr: 4, n: 3, k: 2 },
    { name: 'PDU', mtbf: 300000, mttr: 8, n: 1, k: 1 }
  ];
  function comb(n, r) { var c = 1; for (var i = 1; i <= r; i++) c = c * (n - r + i) / i; return c; }
  function kOfN(a, n, k) { var s = 0; for (var i = k; i <= n; i++) s += comb(n, i) * Math.pow(a, i) * Math.pow(1 - a, n - i); return s; }
  function availCalc() {
    var paths = +document.getElementById('avPaths').value;
    var rows = BLOCKS.map(function (b, i) {
      var g = function (f) { return +document.getElementById('av' + f + i).value; };
      var a = g('Mtbf') / (g('Mtbf') + g('Mttr'));
      var n = Math.max(1, Math.round(g('N'))), k = Math.min(n, Math.max(1, Math.round(g('K'))));
      return { a1: a, ag: kOfN(a, n, k) };
    });
    var path = rows.reduce(function (p, r) { return p * r.ag; }, 1);
    var sys = 1 - Math.pow(1 - path, paths);
    var hrs = (1 - sys) * 8760;
    var out = document.getElementById('avOut');
    rows.forEach(function (r, i) { document.getElementById('avA' + i).textContent = (r.ag * 100).toFixed(6) + ' %'; });
    out.innerHTML = '<dl class="ltc-readouts">' +
      '<div class="ltc-ro"><dt>One path</dt><dd>' + (path * 100).toFixed(5) + '<small>%</small></dd></div>' +
      '<div class="ltc-ro"><dt>System (' + paths + ' path' + (paths > 1 ? 's' : '') + ')</dt><dd>' + (sys * 100).toFixed(7) + '<small>%</small></dd></div>' +
      '<div class="ltc-ro"><dt>Expected downtime</dt><dd>' + (hrs >= 1 ? L.fmt(hrs, 2) + '<small>h/yr</small>' : L.fmt(hrs * 60, 2) + '<small>min/yr</small>') + '</dd></div></dl>' +
      '<p class="ltc-note">Steady-state A = MTBF / (MTBF + MTTR); k-of-n by the binomial sum; blocks in series multiply; parallel paths combine as 1 − Π(1 − A). <b>Independent failures only</b> — common-cause events (a shared fuel system, a control fault, a fire) dominate real outages and are not in this arithmetic. Default MTBF/MTTR values are placeholders to edit, not reliability data.</p>';
  }
  function availTable() {
    var h = '<table class="ltc-table"><thead><tr><th>Block in each path</th><th class="n">MTBF h</th><th class="n">MTTR h</th><th class="n">Installed n</th><th class="n">Needed k</th><th class="n">Block A</th></tr></thead><tbody>';
    BLOCKS.forEach(function (b, i) {
      function f(id, v) { return '<td class="n"><input class="ltc-input" style="width:92px" type="number" inputmode="decimal" id="av' + id + i + '" value="' + v + '"></td>'; }
      h += '<tr><td>' + b.name + '</td>' + f('Mtbf', b.mtbf) + f('Mttr', b.mttr) + f('N', b.n) + f('K', b.k) + '<td class="n" id="avA' + i + '"></td></tr>';
    });
    document.getElementById('avTable').innerHTML = h + '</tbody></table>';
  }

  var fig = null;
  function boot() {
    if (!document.getElementById('tFig')) return;   // loaded elsewhere (the report) for the model only
    L.init({ module: 'tier' });
    document.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () { st.tier = +b.getAttribute('data-tier'); st.out = {}; render(); L.closeInspector(); });
    });
    document.getElementById('tReset').addEventListener('click', function () { st.out = {}; render(); });
    document.querySelectorAll('[data-sys]').forEach(function (b) {
      b.addEventListener('click', function () {
        sysName = b.getAttribute('data-sys'); st.out = {};
        document.querySelectorAll('[data-sys]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        render(); L.closeInspector();
      });
    });
    fig = L.draw(document.getElementById('tFig'), build, inspectNode);
    if (window.LTCTrace) LTCTrace.attach(document.getElementById('tFig'), tierTips);
    /* the plant changes N: regenerate the four Tiers from it */
    if (window.LTCPlantStrip) window.LTCPlantStrip.onChange(function () {
      GEN = makeTopo(); TOPO = GEN.power; COOL = GEN.cooling; SYS = { power: TOPO, cooling: COOL }; st.out = {}; render(); paintFit();
    });
    render(); paintFit();
    availTable();
    document.getElementById('p-availability').addEventListener('input', availCalc);
    availCalc();
  }
  /* ---- this plant against the Tier objectives --------------------------------------------
   * The sweep above builds each Tier's own topology on this plant's N. This asks the other
   * question: what does the plant AS CONFIGURED on the strip reach? Each requirement is
   *   met    — the plant inputs satisfy it (failures read from the engine's own fault model),
   *   gap    — they do not, with the number that shows it,
   *   verify — the plant model does not describe it (pump redundancy, a second cooling loop,
   *            compartments); it never lowers the Tier reached, but it is listed against it.
   * Reached = the highest Tier with no gap at or below it. A screening, not a certification. */
  function fit(r, D) {
    var P = window.LTCPlant, p = r.input, l = r.liquid, a = r.air, w = r.power, rows = [];
    function n0(v) { return Math.round(v).toLocaleString('en-US'); }
    function red(tot, need) { return tot > need ? 'N+' + (tot - need) : 'N'; }
    function add(t, area, req, ok, val, why) { rows.push({ tier: t, area: area, req: req, status: ok === null ? 'verify' : ok ? 'met' : 'gap', value: val, why: why || '' }); }
    function ov(kind) { return P.compute(p, { kind: kind }).fault; }
    var feeder = ov('cdu-feeder'), one = ov('cdu'), ch = ov('chiller'), hallLiq = l.dutyKw / p.halls;
    add(2, 'power', 'Generators N+1', w.genTotal > w.genN, w.genTotal + ' × ' + n0(w.genUnitKw) + ' kW for ' + w.genN + ' needed (' + red(w.genTotal, w.genN) + ')');
    add(2, 'power', 'Transformers N+1', w.txTotal > w.txN, w.txTotal + ' for ' + w.txN + ' needed (' + red(w.txTotal, w.txN) + ')');
    add(2, 'power', 'UPS modules N+1', w.upsTotal > w.upsN, w.upsTotal + ' × ' + n0(w.upsModuleKw) + ' kW for ' + w.upsN + ' needed (' + w.upsTopology + ')');
    add(2, 'cooling', 'CDUs N+1 per hall', l.cduPerHall > l.cduDutyN, l.cduPerHall + ' for ' + l.cduDutyN + ' needed (' + red(l.cduPerHall, l.cduDutyN) + ')');
    add(2, 'cooling', 'Liquid coolers N+1', l.coolerUnitsTotal > l.coolerUnits, l.coolerUnitsTotal + ' for ' + l.coolerUnits + ' needed');
    add(2, 'cooling', 'CRAHs N+1 per hall', a.crahPerHall > a.crahDutyN, a.crahPerHall + ' for ' + a.crahDutyN + ' needed (' + red(a.crahPerHall, a.crahDutyN) + ')');
    add(2, 'cooling', 'Chillers N+1', a.chillersTotal > a.chillersN, a.chillersTotal + ' for ' + a.chillersN + ' needed (' + red(a.chillersTotal, a.chillersN) + ')');
    add(2, 'cooling', 'Pumps N+1 (FWS, CHW, condenser)', null, 'not a plant input', 'Count the pumps against their duty in the design.');
    add(3, 'power', 'Second distribution path to the racks', p.upsTopology === '2N' ? true : null, p.upsTopology === '2N' ? 'two UPS systems, A and B' : 'one UPS system (N+1)',
      p.upsTopology === '2N' ? '' : 'Tier III needs an alternate path to the dual-corded racks; the plant inputs do not describe one.');
    add(3, 'power', 'CDU power maintainable (one feeder off)', !feeder.liquidShortKw, p.cduFeed === 'dual' ? 'dual-fed through ATS' : feeder.note + ' ' + n0(feeder.liquidShortKw) + ' kW of ' + n0(hallLiq) + ' kW liquid duty uncovered',
      p.cduFeed === 'dual' ? '' : 'Maintaining feeder A takes every CDU on it; feed each CDU from A and B (ATS), or add CDUs so either half carries the hall.');
    add(3, 'power', 'MCC A / B each carry the mechanical load', null, 'MCC A and B ' + n0(w.mccAKw) + ' kW each', 'Each side must carry ' + n0(w.mccAKw + w.mccBKw) + ' kW while the other is maintained.');
    add(3, 'cooling', 'Second FWS and CHW path (valved)', null, 'not a plant input', 'Every pipe section, valve and header must be isolable with the load carried on the other path.');
    add(4, 'power', 'Two active power paths', p.upsTopology === '2N', p.upsTopology === '2N' ? 'UPS A and B both carrying load' : 'one UPS system (N+1)', p.upsTopology === '2N' ? '' : 'A fault on the single UPS output path drops the racks.');
    add(4, 'power', 'CDU feeder fault tolerated', !feeder.liquidShortKw, p.cduFeed === 'dual' ? 'dual-fed through ATS' : n0(feeder.liquidShortKw) + ' kW liquid duty uncovered');
    add(4, 'cooling', 'One CDU fails', !one.liquidShortKw, one.note);
    var c1 = D && D.solveHall ? D.solveHall(r, 'crah1', 'common', 5, 'throttled') : null;
    add(4, 'cooling', 'One CRAH fails', c1 ? !c1.over27 : a.crahPerHall > a.crahDutyN, c1 ? 'max rack inlet ' + c1.maxInlet.toFixed(1) + ' °C (DH01)' : red(a.crahPerHall, a.crahDutyN));
    add(4, 'cooling', 'One chiller trips', (a.chillersTotal - 1) * p.chillerUnitKw >= a.chillerEvapKw, ch.note);
    add(4, 'cooling', 'Continuous cooling (CDU pumps on UPS)', !!p.cduOnUps, p.cduOnUps ? 'CDU pumps on UPS' : 'CDU pumps on the MCC', p.cduOnUps ? '' : 'Cold plates lose flow for the generator transfer: seconds to throttle.');
    add(4, 'both', 'Compartmentalisation of A and B', null, 'not modelled', 'Fire and physical separation of the two paths.');
    var reached = 1;
    [2, 3, 4].forEach(function (t) { if (reached === t - 1 && !rows.some(function (x) { return x.tier <= t && x.status === 'gap'; })) reached = t; });
    var next = reached < 4 ? rows.filter(function (x) { return x.tier === reached + 1 && x.status === 'gap'; }) : [];
    return { reached: reached, rows: rows, blockers: next, verify: rows.filter(function (x) { return x.tier <= reached && x.status === 'verify'; }) };
  }
  function fitHtml(F) {
    var R = ['', 'I', 'II', 'III', 'IV'];
    return '<p class="ltc-fit-v' + (F.reached >= 3 ? ' ok' : '') + '" aria-live="polite">This plant, as configured, reaches <b>Tier ' + R[F.reached] + '</b>' +
      (F.blockers.length ? '. Tier ' + R[F.reached + 1] + ' is blocked by: ' + F.blockers.map(function (x) { return L.esc(x.req); }).join('; ') + '.' : '.') +
      (F.verify.length ? ' ' + F.verify.length + ' item' + (F.verify.length > 1 ? 's' : '') + ' to verify in the design.' : '') + '</p>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Tier</th><th>Requirement</th><th>This plant</th><th>Status</th></tr></thead><tbody>' +
      F.rows.map(function (x) {
        return '<tr><td class="mono">' + R[x.tier] + '</td><td>' + L.esc(x.req) + (x.why ? '<br><small class="ltc-note">' + L.esc(x.why) + '</small>' : '') + '</td><td>' + L.esc(x.value) + '</td><td><span class="ltc-fit ' + x.status + '">' + x.status + '</span></td></tr>';
      }).join('') + '</tbody></table></div><p class="ltc-note">Read from the plant on the strip and the engine’s own fault model. A screening against the Tier objectives, not a Tier Certification (issued by Uptime Institute only).</p>';
  }
  function paintFit() {
    var host = document.getElementById('tFit'), S = window.LTCPlantStrip;
    if (host && S) host.innerHTML = fitHtml(fit(S.get().result, window.LTCDH01));
  }
  window.LTCTier = { get TOPO() { return TOPO; }, get COOL() { return COOL; }, powered: powered, sweep: sweep, fit: fit, kOfN: kOfN, lostGroups: lostGroups, redLabel: redLabel, system: function (n) { var was = sysName; if (n) sysName = n; return was; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
