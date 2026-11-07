/* rz-cx-schematic.js — the giant schematic of the Cx Analysis tab (PRD v1.1 §8–10): three RZDiagram sheets
 * (A electrical one-line · B mechanical / P&ID · C controls and life safety) whose nodes ARE the
 * RZCxPlan.SYSTEMS, coloured by the handbook 02.6 tag each system carries at the viewed month.
 * Pure string rendering (works in Node for the gate); the page module injects the SVG and binds clicks.
 *   RZCxSchematic.sheets(status)          → [{block, title, svg, warnings}] for a RZCxPlan.statusAt() result
 *   RZCxSchematic.trace(block, id, dir)   → ordered ids upstream/downstream along the sheet's edges
 * Colours are the page's tokens (var(--o/--c/--g/--r …)); the host sets them on .cx-an-sheet. ES5. */
(function (root) {
  'use strict';
  var D = root.RZDiagram, P = root.RZCxPlan;
  if (!D || !P) return;
  var L = D.layout;
  function mid(box, side) { return L.fanPoints(box, 1, side)[0]; }
  var EDGES = { electrical: [], mechanical: [], controls: [] };

  function sysLabel(id) { for (var i = 0; i < P.SYSTEMS.length; i++) if (P.SYSTEMS[i].id === id) return P.SYSTEMS[i].label; return id; }
  function rowOf(st, id) { if (!st) return null; for (var i = 0; i < st.systems.length; i++) if (st.systems[i].id === id) return st.systems[i]; return null; }
  function sub(st, id, fallback) {
    var r = rowOf(st, id); if (!r) return fallback || '';
    if (r.level === 'L5') return 'L5 · IST passed';
    if (r.inTest) return (r.level || '—') + ' · in test for ' + r.next;
    if (r.level) return r.level + ' · next ' + r.next + ' ' + P.fmtMo(r.gates[r.next]);
    return 'planned · ' + r.next + ' ' + P.fmtMo(r.gates[r.next]);
  }
  function node(ctx, block, x, y, st, o) {
    var r = rowOf(st, o.id);
    o.interactive = true; o.tier = o.tier || 2; o.sublabel = o.sublabel || sub(st, o.id, 'planned');
    o.state = r && r.tag ? r.tag : 'none'; if (!o.name) o.name = sysLabel(o.id).toUpperCase();
    var b = ctx.node(x, y, o); b.id = o.id; return b;
  }
  function edge(ctx, block, a, b, o) {
    o = o || {}; o.fromId = a.id; o.toId = b.id;
    var from = o.from || mid(a, o.fromSide || 'right'), to = o.to || mid(b, o.toSide || 'left');
    delete o.from; delete o.to; delete o.fromSide; delete o.toSide;
    ctx.edge({ x: from.x, y: from.y }, { x: to.x, y: to.y }, o);
    EDGES[block].push([a.id, b.id]);
  }

  /* A — electrical one-line: 150 kV → 20 kV → 400 V, gensets on the 20 kV board */
  function sheetElectrical(st) {
    var ctx = D.create({ width: 1400, height: 420, slug: 'cxsldA', title: 'A · Electrical one-line, 150 kV to the rack', desc: 'Utility 150 kV intake, main transformers, 20 kV boards and feeders, unit substations to 400 V, UPS, LV switchboards and busway to the IT load; generators on the 20 kV board. Node colour = Cx tag at the viewed month.' });
    EDGES.electrical = [];
    var Y = 170, H = 108, GAP = 64, x = 24, n = {};
    function step(o) { var b = node(ctx, 'electrical', x, Y, st, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    n.hv_intake = step({ id: 'hv_intake', tag: '150 kV', symbol: 'utility', legend: 'system (colour = Cx tag)' });
    n.main_tx = step({ id: 'main_tx', tag: '150/20 kV', symbol: 'transformer' });
    n.mv_board = step({ id: 'mv_board', tag: '20 kV', symbol: 'switchgear' });
    n.unit_subs = step({ id: 'unit_subs', tag: '20/0.4 kV', symbol: 'transformer' });
    n.ups = step({ id: 'ups', tag: '400 V', symbol: 'ups' });
    n.lv_busway = step({ id: 'lv_busway', tag: '400 V', symbol: 'pdu' });
    n.it_load = step({ id: 'it_load', tag: 'load', name: 'IT LOAD', symbol: 'itload', sublabel: 'racks · see sheet B', focal: true, tier: 1 });
    n.generators = node(ctx, 'electrical', n.mv_board.x + (n.mv_board.w - 228) / 2, Y - 150, st, { id: 'generators', tag: 'standby', name: 'GENERATORS', symbol: 'genset', w: 228, h: 108 });
    edge(ctx, 'electrical', n.hv_intake, n.main_tx, { stroke: 'alarm-fault', state: 'flow', tier: 1, label: '150 kV', legend: '150 kV' });
    edge(ctx, 'electrical', n.main_tx, n.mv_board, { stroke: 'accent', pattern: 'dashed', state: 'flow', tier: 1, label: '20 kV', legend: '20 kV, dashed' });
    edge(ctx, 'electrical', n.mv_board, n.unit_subs, { stroke: 'accent', pattern: 'dashed', state: 'flow', tier: 1 });
    edge(ctx, 'electrical', n.unit_subs, n.ups, { stroke: 'alarm-normal', pattern: 'dash-dot', state: 'flow', tier: 1, label: '400 V', legend: '400 V, dash-dot' });
    edge(ctx, 'electrical', n.ups, n.lv_busway, { stroke: 'alarm-normal', pattern: 'dash-dot', state: 'flow', tier: 1 });
    edge(ctx, 'electrical', n.lv_busway, n.it_load, { stroke: 'alarm-normal', pattern: 'dash-dot', state: 'flow', tier: 1, label: 'A + B' });
    edge(ctx, 'electrical', n.generators, n.mv_board, { from: { x: n.generators.x + n.generators.w / 2, y: n.generators.y + n.generators.h }, to: { x: n.mv_board.x + n.mv_board.w / 2, y: n.mv_board.y }, pattern: 'dotted', label: 'ATS · NO', tier: 2, legend: 'standby path (open), dotted' });
    ctx.zone(n.hv_intake.x - 12, Y - 26, (n.main_tx.x + n.main_tx.w + 12) - (n.hv_intake.x - 12), H + 52, { label: '150 kV switchyard', tier: 3 });
    ctx.zone(n.unit_subs.x - 12, Y - 26, (n.it_load.x + n.it_load.w + 12) - (n.unit_subs.x - 12), H + 52, { label: 'inside the building · 400 V', tier: 3 });
    ctx.legend({}); ctx.fit(20); return ctx;
  }

  /* B — mechanical / P&ID: two liquid loops meeting at the CDU, air path through CRAH to chillers */
  function sheetMechanical(st) {
    var ctx = D.create({ width: 1400, height: 520, slug: 'cxpidB', title: 'B · Mechanical P&ID, rack to ambient', desc: 'TCS loop between racks and CDUs, FWS loop between CDUs and the plant (pumps, dry coolers), air path from racks through CRAH to chillers. The two liquid loops never mix: they meet at the CDU heat exchanger.' });
    EDGES.mechanical = [];
    var Y = 60, H = 108, GAP = 120, x = 24, n = {};
    function step(o) { var b = node(ctx, 'mechanical', x, Y, st, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    n.racks = step({ id: 'racks', tag: 'TCS', symbol: 'rack', focal: true, tier: 1, legend: 'system (colour = Cx tag)' });
    n.cdu = step({ id: 'cdu', tag: 'HX', symbol: 'cdu' });
    n.fws = step({ id: 'fws', tag: 'FWS', symbol: 'pump' });
    n.dry_coolers = step({ id: 'dry_coolers', tag: 'reject', symbol: 'dryCooler' });
    n.crah = node(ctx, 'mechanical', n.racks.x, Y + H + 110, st, { id: 'crah', tag: 'air', symbol: 'crah', w: n.racks.w, h: H });
    n.chillers = node(ctx, 'mechanical', n.fws.x, Y + H + 110, st, { id: 'chillers', tag: 'CHW', symbol: 'chiller', w: n.fws.w, h: H });
    function pipes(a, b, supLabel, retLabel, legendS, legendR) {
      var ar = L.fanPoints(a, 2, 'right'), bl = L.fanPoints(b, 2, 'left');
      edge(ctx, 'mechanical', b, a, { from: bl[0], to: ar[0], stroke: 'link', label: supLabel, state: 'flow', tier: 2, legend: legendS });
      edge(ctx, 'mechanical', a, b, { from: ar[1], to: bl[1], stroke: 'accent', pattern: 'dashed', label: retLabel, state: 'flow', tier: 2, legend: legendR });
    }
    pipes(n.racks, n.cdu, 'TCS supply', 'TCS return', 'supply (cold)', 'return (warm), dashed');
    pipes(n.cdu, n.fws, 'FWS supply', 'FWS return');
    edge(ctx, 'mechanical', n.fws, n.dry_coolers, { stroke: 'link', state: 'flow', tier: 2, label: 'to rejection' });
    edge(ctx, 'mechanical', n.racks, n.crah, { from: { x: n.racks.x + n.racks.w / 2, y: n.racks.y + n.racks.h }, to: { x: n.crah.x + n.crah.w / 2, y: n.crah.y }, stroke: 'soft', pattern: 'dotted', label: 'hot aisle air', tier: 2, legend: 'air, dotted' });
    edge(ctx, 'mechanical', n.chillers, n.crah, { stroke: 'link', state: 'flow', tier: 2, label: 'CHW' , fromSide: 'left', toSide: 'right' });
    edge(ctx, 'mechanical', n.chillers, n.dry_coolers, { from: { x: n.chillers.x + n.chillers.w / 2, y: n.chillers.y }, to: { x: n.dry_coolers.x + n.dry_coolers.w / 2, y: n.dry_coolers.y + n.dry_coolers.h }, stroke: 'accent', pattern: 'dashed', label: 'CDW', tier: 2 });
    ctx.zone(n.racks.x - 12, Y - 26, (n.cdu.x + n.cdu.w + 12) - (n.racks.x - 12), H + 52, { label: 'TCS loop · white space', tier: 3 });
    ctx.zone(n.fws.x - 12, Y - 26, (n.dry_coolers.x + n.dry_coolers.w + 12) - (n.fws.x - 12), (n.chillers.y + n.chillers.h + 26) - (Y - 26), { label: 'FWS loop · plant', tier: 3 });
    ctx.legend({}); ctx.fit(20); return ctx;
  }

  /* C — controls and life safety: what watches the other two sheets */
  function sheetControls(st) {
    var ctx = D.create({ width: 1100, height: 330, slug: 'cxctlC', title: 'C · Controls and life safety', desc: 'Fire detection and suppression, BMS, EPMS/PME and the OT network that carries them. Dependency arrows show what each system supervises on sheets A and B.' });
    EDGES.controls = [];
    var Y = 60, H = 108, GAP = 96, x = 24, n = {};
    function step(o) { var b = node(ctx, 'controls', x, Y, st, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    n.fire = step({ id: 'fire', tag: 'life safety', symbol: 'aspirating', legend: 'system (colour = Cx tag)' });
    n.bms = step({ id: 'bms', tag: 'mechanical', symbol: 'bms' });
    n.epms = step({ id: 'epms', tag: 'electrical', symbol: 'meter' });
    n.ot_network = node(ctx, 'controls', n.bms.x, Y + H + 90, st, { id: 'ot_network', tag: 'OT', symbol: 'fabric', w: (n.epms.x + n.epms.w) - n.bms.x, h: 108 });
    edge(ctx, 'controls', n.ot_network, n.bms, { from: { x: n.bms.x + n.bms.w / 2, y: n.ot_network.y }, to: { x: n.bms.x + n.bms.w / 2, y: n.bms.y + n.bms.h }, pattern: 'dotted', tier: 2, label: 'BACnet/IP', legend: 'control / dependency, dotted' });
    edge(ctx, 'controls', n.ot_network, n.epms, { from: { x: n.epms.x + n.epms.w / 2, y: n.ot_network.y }, to: { x: n.epms.x + n.epms.w / 2, y: n.epms.y + n.epms.h }, pattern: 'dotted', tier: 2, label: 'Modbus/IEC 61850' });
    edge(ctx, 'controls', n.fire, n.bms, { pattern: 'dotted', tier: 2, label: 'C&E · shutdowns' });
    ctx.text('BMS supervises sheet B (chillers, dry coolers, FWS, CDU, CRAH) · EPMS supervises sheet A (150 kV to busway) · fire C&E trips both', 24, n.ot_network.y + n.ot_network.h + 40, { role: 'sublabel', fill: 'soft' });
    ctx.legend({}); ctx.fit(20); return ctx;
  }

  var BUILD = { electrical: sheetElectrical, mechanical: sheetMechanical, controls: sheetControls };
  var TITLES = { electrical: 'A · Electrical', mechanical: 'B · Mechanical / P&ID', controls: 'C · Controls & life safety' };
  function sheets(st) {
    return ['electrical', 'mechanical', 'controls'].map(function (block) {
      var ctx = BUILD[block](st);
      return { block: block, title: TITLES[block], svg: ctx.render(), warnings: ctx.warnings.slice(), width: ctx.width, height: ctx.height };
    });
  }
  /* Trace along drawn edges; the ATS path is open, so 'generators' never feeds downstream (PRD §9). */
  function trace(block, id, dir) {
    var E = EDGES[block] || [], out = [], seen = {}, q = [id]; seen[id] = 1;
    while (q.length) {
      var cur = q.shift();
      for (var i = 0; i < E.length; i++) {
        var a = E[i][0], b = E[i][1], next = null;
        if (dir === 'down' && a === cur && !(a === 'generators')) next = b;
        if (dir === 'up' && b === cur && !(a === 'generators')) next = a;
        if (next && !seen[next]) { seen[next] = 1; out.push(next); q.push(next); }
      }
    }
    return out;
  }
  var API = { sheets: sheets, trace: trace, EDGES: EDGES, version: '3.26.0' };
  root.RZCxSchematic = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
