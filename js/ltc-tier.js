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

  /* units: n installed, need k. A node without units is a single component. */
  var TOPO = {
    1: { label: 'Tier I — basic capacity',
      nodes: [
        { id: 'util', name: 'Utility', sym: 'utility', sub: 'single feed' },
        { id: 'gen', name: 'Generators', sym: 'genset', units: 2, need: 2 },
        { id: 'msb', name: 'Main board', sym: 'switchgear', sub: 'ATS + MSB' },
        { id: 'ups', name: 'UPS', sym: 'ups', units: 2, need: 2 },
        { id: 'pdu', name: 'PDU', sym: 'pdu', sub: 'single path' },
        { id: 'rack', name: 'IT load', sym: 'rack', sub: 'single-corded', load: true }],
      paths: [{ id: 'A', active: true, stages: [['util', 'gen'], 'msb', 'ups', 'pdu'] }] },
    2: { label: 'Tier II — redundant capacity components',
      nodes: [
        { id: 'util', name: 'Utility', sym: 'utility', sub: 'single feed' },
        { id: 'gen', name: 'Generators', sym: 'genset', units: 3, need: 2 },
        { id: 'msb', name: 'Main board', sym: 'switchgear', sub: 'ATS + MSB' },
        { id: 'ups', name: 'UPS', sym: 'ups', units: 3, need: 2 },
        { id: 'pdu', name: 'PDU', sym: 'pdu', sub: 'single path' },
        { id: 'rack', name: 'IT load', sym: 'rack', sub: 'single-corded', load: true }],
      paths: [{ id: 'A', active: true, stages: [['util', 'gen'], 'msb', 'ups', 'pdu'] }] },
    3: { label: 'Tier III — concurrently maintainable',
      nodes: [
        { id: 'gen', name: 'Generator plant', sym: 'genset', units: 3, need: 2 },
        { id: 'swbA', name: 'Board A', sym: 'switchgear', sub: 'path A · active' },
        { id: 'swbB', name: 'Board B', sym: 'switchgear', sub: 'path B · alternate' },
        { id: 'upsA', name: 'UPS A', sym: 'ups', units: 3, need: 2 },
        { id: 'upsB', name: 'UPS B', sym: 'ups', units: 2, need: 2 },
        { id: 'pduA', name: 'PDU A', sym: 'pdu', sub: 'active' },
        { id: 'pduB', name: 'PDU B', sym: 'pdu', sub: 'alternate' },
        { id: 'rack', name: 'IT load', sym: 'rack', sub: 'dual-corded', load: true }],
      paths: [{ id: 'A', active: true, stages: ['gen', 'swbA', 'upsA', 'pduA'] },
              { id: 'B', active: false, stages: ['gen', 'swbB', 'upsB', 'pduB'] }] },
    4: { label: 'Tier IV — fault tolerant',
      nodes: [
        { id: 'genA', name: 'Generators A', sym: 'genset', units: 2, need: 2 },
        { id: 'genB', name: 'Generators B', sym: 'genset', units: 2, need: 2 },
        { id: 'swbA', name: 'Board A', sym: 'switchgear', sub: 'system A · active' },
        { id: 'swbB', name: 'Board B', sym: 'switchgear', sub: 'system B · active' },
        { id: 'upsA', name: 'UPS A', sym: 'ups', units: 3, need: 2 },
        { id: 'upsB', name: 'UPS B', sym: 'ups', units: 3, need: 2 },
        { id: 'pduA', name: 'PDU A', sym: 'pdu', sub: 'active' },
        { id: 'pduB', name: 'PDU B', sym: 'pdu', sub: 'active' },
        { id: 'rack', name: 'IT load', sym: 'rack', sub: 'dual-corded', load: true }],
      paths: [{ id: 'A', active: true, stages: ['genA', 'swbA', 'upsA', 'pduA'] },
              { id: 'B', active: true, stages: ['genB', 'swbB', 'upsB', 'pduB'] }] }
  };

  /* ---- the model (pure: topology + outage map in, verdict out) ----------- */
  function nodeOf(t, id) { return TOPO[t].nodes.filter(function (n) { return n.id === id; })[0]; }
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
  function powered(t, out, planned) {
    return TOPO[t].paths.some(function (p) { return (p.active || planned) && pathOk(t, p, out); });
  }
  /** Every removable element: single components, and each unit of a group. */
  function elements(t) {
    var list = [];
    TOPO[t].nodes.forEach(function (n) {
      if (n.load) return;
      if (n.units) for (var k = 1; k <= n.units; k++) list.push({ key: n.id + '#' + k, node: n, label: n.name + ' unit ' + k });
      else list.push({ key: n.id, node: n, label: n.name });
    });
    return list;
  }
  function sweep(t) {
    return elements(t).map(function (e) {
      var o = {}; o[e.key] = 1;
      return { e: e, maint: powered(t, o, true), fault: powered(t, o, false) };
    });
  }

  /* ---- state + figure ---------------------------------------------------- */
  var st = { tier: 3, out: {} };   /* out[key] = 'maint' | 'fail' */

  function nodeSub(n) {
    if (!n.units) return n.sub || '';
    var up = 0;
    for (var k = 1; k <= n.units; k++) if (!st.out[n.id + '#' + k]) up++;
    var red = n.units - n.need;
    return up + '/' + n.units + ' up · need ' + n.need + ' (' + (red ? 'N+' + red : 'N') + ')';
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

  function build(D, o) {
    var T = TOPO[st.tier];
    var d = D.create({ slug: 'tier' + st.tier, title: T.label + ' — power path',
      desc: 'Simplified power path for ' + T.label + '. Select a block to take it out for maintenance or fail it; the IT load shows whether it stays powered.' });
    var box = {};
    var G = o.narrow ? 24 : 40;
    function N(id, x, y, extra) {
      var n = nodeOf(st.tier, id);
      box[id] = d.node(x, y, Object.assign({ id: id, name: n.name, sublabel: nodeSub(n), symbol: n.sym, interactive: true,
        state: nodeState(n) || undefined, focal: !!n.load, fill: n.load ? 'paper-2' : 'paper', tier: n.load ? 1 : 2,
        legend: n.load ? 'IT load' : 'Power component' }, extra || {}));
      return box[id];
    }
    function link(a, b, dir, extra) {
      var A = box[a], B = box[b];
      var p1 = dir === 'v' ? { x: A.x + A.w / 2, y: A.y + A.h } : { x: A.x + A.w, y: A.y + A.h / 2 };
      var p2 = dir === 'v' ? { x: B.x + B.w / 2, y: B.y } : { x: B.x, y: B.y + B.h / 2 };
      d.edge(p1, p2, Object.assign({ fromId: a, toId: b, tier: 1, stroke: 'ink' }, extra || {}));
    }
    var dual = T.paths.length === 2;
    if (!dual) {
      var dir = o.narrow ? 'v' : 'h';
      var x = 16, y = 16;
      N('util', x, y);
      N('gen', o.narrow ? box.util.x + box.util.w + G : x, o.narrow ? y : y + box.util.h + G);
      var mx = o.narrow ? x : Math.max(box.util.x + box.util.w, box.gen.x + box.gen.w) + G;
      var my = o.narrow ? Math.max(box.util.h, box.gen.h) + y + G : y + (box.util.h + G) / 2;
      N('msb', mx, my);
      var seq = ['msb', 'ups', 'pdu', 'rack'];
      for (var i = 1; i < seq.length; i++) {
        var prev = box[seq[i - 1]];
        if (o.narrow) N(seq[i], x, prev.y + prev.h + G); else N(seq[i], prev.x + prev.w + G, my);
      }
      if (o.narrow) {
        var tp = d.ports(box.msb, 2, 'top', { id: 'msb' });
        d.edge({ x: tp[0].x, y: box.util.y + box.util.h }, tp[0], { fromId: 'util', toId: 'msb', tier: 1, stroke: 'ink', legend: 'Power' });
        d.edge({ x: box.gen.x + box.gen.w / 2, y: box.gen.y + box.gen.h }, tp[1], { fromId: 'gen', toId: 'msb', tier: 1, stroke: 'ink' });
      } else {
        var lp = d.ports(box.msb, 2, 'left', { id: 'msb' });
        d.edge({ x: box.util.x + box.util.w, y: box.util.y + box.util.h / 2 }, lp[0], { fromId: 'util', toId: 'msb', tier: 1, stroke: 'ink', legend: 'Power' });
        d.edge({ x: box.gen.x + box.gen.w, y: box.gen.y + box.gen.h / 2 }, lp[1], { fromId: 'gen', toId: 'msb', tier: 1, stroke: 'ink' });
      }
      for (var j = 1; j < seq.length; j++) link(seq[j - 1], seq[j], dir);
    } else {
      /* two paths: A on top, B below (wide) or A left, B right (narrow) */
      var shared = st.tier === 3;
      var cols = ['sw', 'ups', 'pdu'];
      if (!o.narrow) {
        var x0 = 16, yA = 16;
        if (shared) N('gen', x0, yA + 60); else { N('genA', x0, yA); N('genB', x0, yA + 150); }
        var gx = (shared ? box.gen : box.genA);
        var cx = gx.x + gx.w + G + 16;
        ['A', 'B'].forEach(function (P, pi) {
          var yy = yA + pi * 150;
          N('swb' + P, cx, yy); N('ups' + P, box['swb' + P].x + box['swb' + P].w + G, yy);
          N('pdu' + P, box['ups' + P].x + box['ups' + P].w + G, yy);
        });
        var rx = Math.max(box.pduA.x + box.pduA.w, box.pduB.x + box.pduB.w) + G + 8;
        N('rack', rx, yA + 20, { h: 150 + box.pduB.h - 40 });
        if (shared) {
          var gp = d.ports(box.gen, 2, 'right', { id: 'gen' });
          d.edge(gp[0], { x: box.swbA.x, y: box.swbA.y + box.swbA.h / 2 }, { fromId: 'gen', toId: 'swbA', tier: 1, stroke: 'ink', legend: 'Active path' });
          d.edge(gp[1], { x: box.swbB.x, y: box.swbB.y + box.swbB.h / 2 }, { fromId: 'gen', toId: 'swbB', tier: 2, stroke: 'muted', pattern: 'dashed', legend: 'Alternate path' });
        } else {
          link('genA', 'swbA', 'h', { legend: 'Active path' }); link('genB', 'swbB', 'h');
        }
        ['A', 'B'].forEach(function (P) {
          var alt = shared && P === 'B';
          var ex = alt ? { tier: 2, stroke: 'muted', pattern: 'dashed' } : {};
          link('swb' + P, 'ups' + P, 'h', ex); link('ups' + P, 'pdu' + P, 'h', ex);
        });
        var rp = d.ports(box.rack, 2, 'left', { id: 'rack' });
        d.edge({ x: box.pduA.x + box.pduA.w, y: rp[0].y }, rp[0], { fromId: 'pduA', toId: 'rack', tier: 1, stroke: 'ink' });
        d.edge({ x: box.pduB.x + box.pduB.w, y: rp[1].y }, rp[1], Object.assign({ fromId: 'pduB', toId: 'rack' }, shared ? { tier: 2, stroke: 'muted', pattern: 'dashed' } : { tier: 1, stroke: 'ink' }));
      } else {
        var xa = 16, xb;
        if (shared) N('gen', xa, 16, {}); else N('genA', xa, 16);
        if (!shared) N('genB', box.genA.x + box.genA.w + G, 16);
        var top = shared ? box.gen : box.genA;
        var y1 = top.y + top.h + G;
        N('swbA', xa, y1);
        xb = Math.max(box.swbA.x + box.swbA.w + G, shared ? 0 : box.genB.x);
        N('swbB', xb, y1);
        N('upsA', xa, box.swbA.y + box.swbA.h + G); N('upsB', xb, box.swbB.y + box.swbB.h + G);
        N('pduA', xa, box.upsA.y + box.upsA.h + G); N('pduB', xb, box.upsB.y + box.upsB.h + G);
        N('rack', xa, Math.max(box.pduA.y + box.pduA.h, box.pduB.y + box.pduB.h) + G,
          { w: box.pduB.x + box.pduB.w - xa });
        if (shared) {
          var bp = d.ports(box.gen, 2, 'bottom', { id: 'gen' });
          d.edge(bp[0], { x: box.swbA.x + box.swbA.w / 2, y: box.swbA.y }, { fromId: 'gen', toId: 'swbA', tier: 1, stroke: 'ink', legend: 'Active path' });
          d.edge(bp[1], { x: box.swbB.x + box.swbB.w / 2, y: box.swbB.y }, { fromId: 'gen', toId: 'swbB', tier: 2, stroke: 'muted', pattern: 'dashed', legend: 'Alternate path' });
        } else { link('genA', 'swbA', 'v', { legend: 'Active path' }); link('genB', 'swbB', 'v'); }
        ['A', 'B'].forEach(function (P) {
          var ex = shared && P === 'B' ? { tier: 2, stroke: 'muted', pattern: 'dashed' } : {};
          link('swb' + P, 'ups' + P, 'v', ex); link('ups' + P, 'pdu' + P, 'v', ex);
        });
        var tpp = d.ports(box.rack, 2, 'top', { id: 'rack' });
        d.edge({ x: tpp[0].x, y: box.pduA.y + box.pduA.h }, tpp[0], { fromId: 'pduA', toId: 'rack', tier: 1, stroke: 'ink' });
        d.edge({ x: box.pduB.x + box.pduB.w / 2, y: box.pduB.y + box.pduB.h }, tpp[1],
          Object.assign({ fromId: 'pduB', toId: 'rack' }, shared ? { tier: 2, stroke: 'muted', pattern: 'dashed' } : { tier: 1, stroke: 'ink' }));
      }
    }
    d.legend();
    return d;
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
      ? '<b>' + (n ? 'Load carried' : 'Normal') + '</b><span>' + (n ? n + ' element(s) out; the IT load stays powered.' : 'All components in service. Select a block to take part of it out.') + '</span>'
      : '<b>Load lost</b><span>' + (transferable ? 'The alternate path is healthy but not carrying load: the IT load drops until it is switched in.' : 'No path can carry the IT load.') + '</span>';
    var sw = sweep(st.tier);
    var cm = sw.every(function (r) { return r.maint; }), ft = sw.every(function (r) { return r.fault; });
    document.getElementById('tSummary').innerHTML = '<dl class="ltc-readouts">' +
      ro('Concurrently maintainable', cm ? 'yes' : 'no — ' + sw.filter(function (r) { return !r.maint; }).length + ' blockers', cm ? 'ok' : 'fail') +
      ro('Fault tolerant (single failure)', ft ? 'yes' : 'no — ' + sw.filter(function (r) { return !r.fault; }).length + ' SPOF', ft ? 'ok' : 'fail') +
      ro('Elements tested', String(sw.length)) + '</dl>';
    document.getElementById('tSweep').innerHTML = '<table class="ltc-table"><thead><tr><th>Element taken out</th><th>Planned maintenance</th><th>Unplanned failure</th></tr></thead><tbody>' +
      sw.map(function (r) {
        function c(ok) { return ok ? '<span style="color:var(--g)">load carried</span>' : '<b style="color:var(--r)">load lost</b>'; }
        return '<tr><td>' + L.esc(r.e.label) + '</td><td>' + c(r.maint) + '</td><td>' + c(r.fault) + '</td></tr>';
      }).join('') + '</tbody></table>';
    document.querySelectorAll('[data-tier]').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-tier') === st.tier ? 'true' : 'false'); });
  }

  /* inspector: per-unit controls for the selected block */
  function inspectNode(id) {
    var n = nodeOf(st.tier, id);
    if (!n) return;
    if (n.load) {
      L.inspect({ sym: n.sym, eyebrow: TOPO[st.tier].label, title: n.name, html:
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
    L.inspect({ sym: n.sym, eyebrow: TOPO[st.tier].label, title: n.name, html: html });
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
    L.init({ module: 'tier' });
    document.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () { st.tier = +b.getAttribute('data-tier'); st.out = {}; render(); L.closeInspector(); });
    });
    document.getElementById('tReset').addEventListener('click', function () { st.out = {}; render(); });
    fig = L.draw(document.getElementById('tFig'), build, inspectNode);
    render();
    availTable();
    document.getElementById('p-availability').addEventListener('input', availCalc);
    availCalc();
  }
  window.LTCTier = { TOPO: TOPO, powered: powered, sweep: sweep, kOfN: kOfN };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
