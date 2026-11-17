/*
 * sld-topology.js — window.RZConvSld: what is energised, from where, and how much flows
 * (PRD-CONV-LIVING-PLANT §8.1 "Topology solver", phase P4). Pure; Node-tested by tools/test-conv-sld-topology.mjs.
 * This colours the single-line diagram and drives its power-flow motion, so it must never guess.
 *
 *   model = { nodes: [ { id, kind: 'source' | 'bus' | 'load', kw?, ratingKw?, available? } ],
 *             branches: [ { id, a, b, closed } ] }          a breaker, disconnector, cable or transformer
 *   solve(model) -> {
 *     nodes:    { id: { energised, island, sources: [ids] } }
 *     branches: { id: { energised, kw, from, to, loop } }    kw >= 0, flowing from -> to; loop = closed but outside
 *                                                            the radial tree (a closed ring's second path): its
 *                                                            share is not solved here and is reported as loop
 *     sources:  { id: { kw, loadPct, overload } }
 *     islands:  [ { id, energised, loadKw, sourceKw, ratingKw, nodes: [ids] } ]
 *   }
 *   Rules: an island (nodes joined by CLOSED branches) is energised when it holds at least one available source.
 *   Its sources share the island's load in proportion to their ratings (governor / transformer-impedance sharing
 *   on a common base). A load in a dead island draws 0. Losses are not modelled: kW in = kW out at every bus.
 *   Branch flows come from a breadth-first tree rooted at the island's first source, so a radial network is exact.
 */
(function (root) {
  'use strict';
  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  function solve(model) {
    var nodes = (model && model.nodes) || [], branches = (model && model.branches) || [];
    var N = {}, adj = {}, out = { nodes: {}, branches: {}, sources: {}, islands: [] };
    nodes.forEach(function (n) { N[n.id] = n; adj[n.id] = []; });
    branches.forEach(function (b) {
      if (!N[b.a] || !N[b.b]) throw new Error('RZConvSld: branch ' + b.id + ' joins an unknown node');
      out.branches[b.id] = { energised: false, kw: 0, from: null, to: null, loop: false };
      if (b.closed) { adj[b.a].push({ to: b.b, br: b }); adj[b.b].push({ to: b.a, br: b }); }
    });
    var seen = {}, k = 0;
    nodes.forEach(function (start) {
      if (seen[start.id]) return;
      /* collect the island */
      var ids = [], q = [start.id]; seen[start.id] = 1;
      while (q.length) { var u = q.shift(); ids.push(u); adj[u].forEach(function (e) { if (!seen[e.to]) { seen[e.to] = 1; q.push(e.to); } }); }
      var srcs = ids.filter(function (id) { return N[id].kind === 'source' && N[id].available !== false && isNum(N[id].ratingKw) && N[id].ratingKw > 0; });
      var live = srcs.length > 0, load = 0, rating = 0;
      ids.forEach(function (id) { if (live && N[id].kind === 'load' && isNum(N[id].kw)) load += N[id].kw; });
      srcs.forEach(function (id) { rating += N[id].ratingKw; });
      var inj = {};
      srcs.forEach(function (id) {
        var p = rating > 0 ? load * N[id].ratingKw / rating : 0;
        inj[id] = p;
        out.sources[id] = { kw: p, loadPct: 100 * p / N[id].ratingKw, overload: p > N[id].ratingKw + 1e-9 };
      });
      ids.forEach(function (id) {
        out.nodes[id] = { energised: live, island: k, sources: srcs.slice() };
        if (N[id].kind === 'source' && !out.sources[id]) out.sources[id] = { kw: 0, loadPct: 0, overload: false };
      });
      out.islands.push({ id: k, energised: live, loadKw: load, sourceKw: load, ratingKw: rating, nodes: ids });
      k++;
      if (!live) return;
      /* radial tree from the first source: parent links, then net demand bottom-up */
      var rootId = srcs[0], parent = {}, via = {}, order = [], inTree = {};
      parent[rootId] = null; var qq = [rootId], mark = {}; mark[rootId] = 1;
      while (qq.length) {
        var x = qq.shift(); order.push(x);
        adj[x].forEach(function (e) {
          if (mark[e.to]) { if (!inTree[e.br.id] && via[x] !== e.br) { out.branches[e.br.id].loop = true; out.branches[e.br.id].energised = true; } return; }
          mark[e.to] = 1; parent[e.to] = x; via[e.to] = e.br; inTree[e.br.id] = 1; qq.push(e.to);
        });
      }
      Object.keys(inTree).forEach(function (id) { out.branches[id].loop = false; });
      var need = {};
      ids.forEach(function (id) { need[id] = (N[id].kind === 'load' && isNum(N[id].kw) ? N[id].kw : 0) - (inj[id] || 0); });
      for (var i = order.length - 1; i > 0; i--) {
        var c = order[i], p = parent[c], br = via[c], f = need[c];
        need[p] += f;
        var o = out.branches[br.id];
        o.energised = true; o.kw = Math.abs(f); o.from = f >= 0 ? p : c; o.to = f >= 0 ? c : p;
      }
    });
    return out;
  }

  /* kW into a node minus kW out of it, branch flows only (loads and sources excluded): 0 at a bus */
  function busBalance(model, result, id) {
    var s = 0;
    (model.branches || []).forEach(function (b) {
      var r = result.branches[b.id]; if (!r || !r.kw) return;
      if (r.to === id) s += r.kw; if (r.from === id) s -= r.kw;
    });
    return s;
  }

  var API = { solve: solve, busBalance: busBalance, version: '1.0.0' };
  if (root) root.RZConvSld = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
