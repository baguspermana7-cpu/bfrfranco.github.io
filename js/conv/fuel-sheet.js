/*
 * fuel-sheet.js — FU-M-101, the diesel fuel storage, transfer and day-tank P&ID for
 * fuel-system.html, drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js
 * (ISO 10628-2 / ISA-5.1). Geometry only: every number and state comes from the page's read().
 *
 *   Tanker fill -> UST-01 bulk tank -> P-101 duty / P-102 lag (check valves) -> FT-101, PT-101
 *   -> day-tank header of ONE data hall -> XV-<set> -> DT-GEN-<set> day tank -> GEN-<set> fuel inlet,
 *   one row per genset of that hall.
 *   UST-01 side-stream: FPU-01 pre-filter -> coalescer -> final filter -> back to UST-01.
 *   LD-101 interstitial leak (UST), LD-201 day-tank bund leak.
 *
 * PRD-CONV-EQUIPMENT-TRUTH F2: the sheet is a PER-HALL view. How many gensets it draws and what they are called come
 * from the engine fleet (CONV_CALC.getFleet('genset', hallCode)), never from this file: build(units, hall) draws one
 * row per unit it is given, and select() makes that the sheet the page shows. Node ids are positional (gen1, dt1, xv1
 * ...) so the page logic is the same on every hall; the ISA tags are the fleet tags (GEN-A1, DT-GEN-A1, XV-A1).
 *
 * Points (PRD-CONV-POINT-STATUS-TREND T2): every value label that shows a number carries `point` + `label`; a per-unit day-tank
 * level names the registry row its limits come from in `limitsOf` (the page maps the id onto the row, it never types a bound).
 */
(function (root) {
  'use strict';
  if (!root) return;

  var ROW0 = 150, PITCH = 96, BUS_X = 760, XV_X = 830, DT_X = 930, GEN_X = 1120, FEED_DY = -40, LIFT = 48;

  function base() {
    return {
      nodes: [
        { id: 'fill', tag: 'TANKER FILL', sym: 'offSheet', x: 66, y: 150, size: 22, rot: 180, cls: 'fuel', label: 'Tanker fill point', tagAt: 'above',
          values: [{ k: 'st', dx: -10, dy: 26, anchor: 'start', lod: 1 }, { k: 'q', dx: -10, dy: 40, anchor: 'start', lod: 1, point: 'fuel-system.fill.flow_lpm', label: 'Tanker fill rate', unit: 'L/min' }] },
        { id: 'ust', tag: 'UST-01', sym: 'tankStorage', x: 220, y: 330, size: 120, cls: 'fuel', label: 'Bulk storage tank (underground)', tagAt: 'left',
          values: [{ k: 'pct', dx: -64, dy: 20, anchor: 'end', lod: 1, point: 'fuel.level_pct', label: 'UST-01 level' }, { k: 'use', dx: -64, dy: 34, anchor: 'end', lod: 1, point: 'fuel-system.usable_l', label: 'UST-01 usable fuel', unit: 'L' }, { k: 'st', dx: -64, dy: 48, anchor: 'end', lod: 1 }] },
        { id: 'ld101', tag: 'LD-101', sym: 'leakSensor', x: 120, y: 470, size: 22, label: 'UST interstitial leak detection', tagAt: 'left',
          values: [{ k: 'st', dx: 0, dy: 28, lod: 1 }] },
        { id: 'jsuc', sym: 'junction', x: 360, y: 375 },
        { id: 'p101', tag: 'P-101', sym: 'pumpCentrifugal', x: 440, y: 330, size: 36, cls: 'fuel', label: 'Transfer pump (duty)', tagAt: 'above',
          values: [{ k: 'cmd', dx: 0, dy: -56, lod: 1 }, { k: 'st', dx: 0, dy: -42, lod: 1 }] },
        { id: 'p102', tag: 'P-102', sym: 'pumpCentrifugal', x: 440, y: 420, size: 36, cls: 'fuel', label: 'Transfer pump (lag)', tagAt: 'below',
          values: [{ k: 'cmd', dx: 0, dy: 42, lod: 1 }, { k: 'st', dx: 0, dy: 56, lod: 1 }] },
        { id: 'cv101', sym: 'valveCheck', x: 500, y: 330, size: 20 },
        { id: 'cv102', sym: 'valveCheck', x: 500, y: 420, size: 20 },
        { id: 'jhd', sym: 'junction', x: 560, y: 330 },
        { id: 'ft101', tag: 'FT-101', sym: 'flowMeter', x: 610, y: 330, size: 26, tagAt: 'below', values: [{ k: 'q', dx: 0, dy: 38, lod: 1, point: 'fuel-system.FT-101.flow_lpm', label: 'FT-101 transfer flow', unit: 'L/min' }] },
        { id: 'jpt', sym: 'junction', x: 660, y: 330, dot: false },
        { id: 'pt101', tag: 'PT-101', sym: 'instField', x: 660, y: 280, size: 28, inst: 'PT', tagAt: 'above',
          values: [{ k: 'p', dx: -18, dy: 4, anchor: 'end', lod: 1, point: 'fuel-system.PT-101.pressure_bar', label: 'PT-101 transfer pressure', unit: 'bar' }] },
        { id: 'fpu-pf', tag: 'FPU-01 PF', sym: 'filterCartridge', x: 250, y: 560, size: 30, cls: 'fuel', label: 'Polisher pre-filter', tagAt: 'below' },
        { id: 'fpu-cs', tag: 'CS', sym: 'filterCartridge', x: 320, y: 560, size: 30, cls: 'fuel', label: 'Polisher coalescer / water separator', tagAt: 'below',
          values: [{ k: 'st', dx: 0, dy: -24, lod: 1 }] },
        { id: 'fpu-ff', tag: 'FF', sym: 'filterCartridge', x: 390, y: 560, size: 30, cls: 'fuel', label: 'Polisher final filter', tagAt: 'below' },
        { id: 'jbus', sym: 'junction', x: BUS_X, y: 330 }
      ],
      edges: [
        { id: 'fs-fill', from: 'fill.port', to: 'ust.inlet', via: [[220, 150]], medium: 'fuel', flowOf: 'fill', line: 'FILL' },
        { id: 'fs-suction', from: 'ust.outlet', to: 'jsuc', medium: 'fuel', flowOf: 'run', line: 'SUCTION' },
        { id: 'fs-s1', from: 'jsuc', to: 'p101.suction', via: [[360, 330]], medium: 'fuel', flowOf: 'run' },
        { id: 'fs-s2', from: 'jsuc', to: 'p102.suction', via: [[360, 420]], medium: 'fuel', flowOf: 'lag' },
        { id: 'fs-p101-discharge', from: 'p101.discharge', to: 'cv101.inlet', medium: 'fuel', flowOf: 'run' },
        { id: 'fs-c1', from: 'cv101.outlet', to: 'jhd', medium: 'fuel', flowOf: 'run' },
        { id: 'fs-p102-discharge', from: 'p102.discharge', to: 'cv102.inlet', medium: 'fuel', flowOf: 'lag' },
        { id: 'fs-c2', from: 'cv102.outlet', to: 'jhd', via: [[560, 420]], medium: 'fuel', flowOf: 'lag' },
        { id: 'fs-transfer-header', from: 'jhd', to: 'ft101.a', medium: 'fuel', flowOf: 'run', line: 'TRANSFER' },
        { id: 'fs-h2', from: 'ft101.b', to: 'jpt', medium: 'fuel', flowOf: 'run' },
        { id: 'fs-pt', from: 'jpt', to: 'pt101.process', medium: 'line', w: 'inst' },
        { id: 'fs-h3', from: 'jpt', to: 'jbus', medium: 'fuel', flowOf: 'run' },
        { id: 'fs-polish-side', from: [180, 390], to: 'fpu-pf.inlet', via: [[180, 560]], medium: 'fuel', flowOf: 'pol', line: 'POLISHING' },
        { id: 'fs-pol1', from: 'fpu-pf.outlet', to: 'fpu-cs.inlet', medium: 'fuel', flowOf: 'pol' },
        { id: 'fs-pol2', from: 'fpu-cs.outlet', to: 'fpu-ff.inlet', medium: 'fuel', flowOf: 'pol' },
        { id: 'fs-polish-return', from: 'fpu-ff.outlet', to: [260, 390], via: [[440, 560], [440, 500], [260, 500]], medium: 'fuel', flowOf: 'pol' }
      ]
    };
  }

  /* rowY(i): centre line of the i-th genset row; fy = its feed branch, above the day tank */
  function rowY(i) { return ROW0 + i * PITCH; }

  /* build(units, hall): units = CONV_CALC.getFleet('genset', hall) rows ({ n, tag }), hall = the hall code */
  function build(units, hall) {
    var b = base(), nodes = b.nodes, edges = b.edges, list = Array.isArray(units) ? units : [];
    var n = list.length, last = n ? rowY(n - 1) : 330;
    var H = Math.max(660, last + 108);
    var C = root.RZControlPoints, LIC = C && typeof C.loops === 'function' ? C.loops('fu-m-101').filter(function (L) { return L.mv.node === 'xv'; }) : [];
    list.forEach(function (u, i) {
      var k = i + 1, y = rowY(i), fy = y + FEED_DY, set = String(u.tag || '').replace(/^GEN-/, '');
      nodes.push(
        { id: 'j' + k, sym: 'junction', x: BUS_X, y: fy },
        { id: 'xv' + k, tag: 'XV-' + set, sym: 'valveSolenoid', x: XV_X, y: fy, size: 22, cls: 'fuel', label: 'Day-tank fill valve of ' + u.tag, tagAt: 'above',
          values: [{ k: 'st', dx: 0, dy: 23, lod: 1 }] },
        { id: 'dt' + k, tag: 'DT-' + u.tag, sym: 'tankStorage', x: DT_X, y: y, size: 48, cls: 'fuel', label: 'Day tank of ' + u.tag, tagAt: 'left',
          values: [{ k: 'pct', dx: -30, dy: 18, anchor: 'end', lod: 1, point: 'fuel-system.DT-' + u.tag + '.level_pct', label: 'DT-' + u.tag + ' level', limitsOf: 'fuel-system.DT.level_pct' }] },
        { id: 'gen' + k, tag: u.tag, sym: 'gensetDiesel', x: GEN_X, y: y, size: 44, cls: 'fuel', label: 'Diesel genset ' + u.tag, tagAt: 'above',
          values: [{ k: 'st', dx: 30, dy: -6, anchor: 'start', lod: 1 }, { k: 'ld', dx: 30, dy: 8, anchor: 'start', lod: 1, point: 'fuel-system.' + u.tag + '.output_kw', label: u.tag + ' output', unit: 'kW' }, { k: 'q', dx: 30, dy: 22, anchor: 'start', lod: 1, point: 'fuel-system.' + u.tag + '.fuel_lph', label: u.tag + ' fuel burn', unit: 'L/h' }] }
      );
      edges.push(
        { id: 'fs-dt-' + k + '-feed', from: 'j' + k, to: 'xv' + k + '.a', medium: 'fuel', flowOf: 'f' + k },
        { id: 'fs-dt-' + k + '-in', from: 'xv' + k + '.b', to: 'dt' + k + '.inlet', via: [[DT_X, fy]], medium: 'fuel', flowOf: 'f' + k },
        { id: 'fs-gen-' + k + '-supply', from: 'dt' + k + '.outlet', to: 'gen' + k + '.fuelIn', via: [[1040, y + 18], [1040, y + 5.5]], medium: 'fuel', flowOf: 'g' + k }
      );
      /* PRD-SETPOINT-SIM P9 part 2: the day-tank level controller of this row as an ISA-5.1 panel bubble, from the control
         registry (RZControlPoints.loops('fu-m-101'), on-off): fed by the tank's level, signal to the fill valve's actuator.
         The tag's nn is the set (LIC-A1); the page writes the fill start / stop from the registry. */
      LIC.forEach(function (L) {
        var cx = 994, cy = y - 16, r = 20, id = 'lc' + k;
        nodes.push({ id: id, tag: L.tag.replace(/nn$/, set), sym: 'instPanel', x: cx, y: cy, size: 2 * r, inst: 'LIC', tagAt: 'right', loop: L.sp, ctrl: 'dt' + k,
          label: 'DT-' + u.tag + ' level controller (' + L.action + ' acting ' + L.kind + ')',
          values: [{ k: 'sp', dx: r + 3, dy: -12, anchor: 'start', lod: 1, const: 'fill start / stop from the control registry (' + L.sp + ')' }] });
        /* instPanel geometry (48-unit box): circle centre 4/48 of the size above the node centre, radius 14/48, process port
           at the bottom of its stem; the level comes in at the port, the signal leaves the top of the circle */
        var top = cy - 18 * 2 * r / 48;
        edges.push({ id: 'e-ll-' + k, from: [DT_X + 15, cy + r], to: id + '.process', w: 'inst', medium: 'line', loop: L.sp },
          { id: 'e-lm-' + k, from: [cx, top], to: [XV_X + 12, fy - 9], via: [[cx, fy - 9]], w: 'signal', medium: 'line', loop: L.sp });
        nodes.forEach(function (nd) { if (nd.id === L.mv.node + k || nd.id === 'dt' + k) nd.loop = L.sp; });
      });
    });
    /* the day-tank header: from the transfer header junction up to the first row and down to the last; segment s carries
       the flow of every row beyond it (busOf lists those rows, the page maps them to points) */
    var busOf = {}, above = [], below = [];
    list.forEach(function (u, i) { if (rowY(i) + FEED_DY < 330) above.push(i + 1); else below.push(i + 1); });
    above.reverse().forEach(function (k, j) {
      var id = 'fs-bus-' + k, from = j === 0 ? 'jbus' : 'j' + above[j - 1];
      edges.push({ id: id, from: from, to: 'j' + k, medium: 'fuel', flowOf: 'bus' + k });
      busOf[id] = above.slice(j);
    });
    below.forEach(function (k, j) {
      var id = 'fs-bus-' + k, from = j === 0 ? 'jbus' : 'j' + below[j - 1];
      edges.push({ id: id, from: from, to: 'j' + k, medium: 'fuel', flowOf: 'bus' + k });
      busOf[id] = below.slice(j);
    });
    nodes.push({ id: 'ld201', tag: 'LD-201', sym: 'leakSensor', x: 800, y: H - 40, size: 22, label: 'Day-tank bund leak detection', tagAt: 'left',
      values: [{ k: 'st', dx: 16, dy: 4, anchor: 'start', lod: 1 }] });
    return lift({
      id: 'fu-m-101', no: 'FU-M-101', title: 'DIESEL FUEL · TRANSFER · DAY TANKS' + (hall ? ' · HALL ' + hall : ''), rev: 'B', basis: 'ISA-5.1 · ISO 10628',
      svgId: 'fuel-svg', size: [1260, H], minScale: 1, nodes: nodes, edges: edges, hall: hall || null, sets: n, busOf: busOf,
      areas: [
        { x: 16, y: 60, w: 690, h: H - 80, label: 'BULK · TRANSFER · CONDITIONING', kind: 'zone' },
        { x: 716, y: 60, w: 530, h: H - 80, label: 'DAY TANKS' + (hall ? ' · HALL ' + hall + ' · ' + n + ' SETS' : ' · GENSETS'), kind: 'zone' }
      ],
      notes: []
    }, LIFT);
  }
  /* The geometry above is drawn with a 60-unit head band; the sheet frame already carries its own title and view bars,
     so the drawing is lifted to start under them (no empty band), and the sheet is that much shorter. */
  function lift(sh, dy) {
    var pt = function (p) { return Array.isArray(p) ? [p[0], p[1] - dy] : p; };
    sh.nodes.forEach(function (n) { n.y -= dy; });
    sh.edges.forEach(function (e) { e.from = pt(e.from); e.to = pt(e.to); if (e.via) e.via = e.via.map(pt); });
    sh.areas.forEach(function (a) { a.y -= dy; });
    sh.size = [sh.size[0], sh.size[1] - dy];
    return sh;
  }

  /* the sheet in force: the page selects the hall; before that, the first hall of the engine when it is loaded,
     otherwise the bulk and transfer plant only (no genset count is ever assumed) */
  var current = null;
  function fallback() {
    var C = root.CONV_CALC;
    if (C && typeof C.getFleet === 'function' && typeof C.listHalls === 'function') {
      var h = (C.listHalls() || [])[0];
      if (h) return build(C.getFleet('genset', h.code) || [], h.code);
    }
    return build([], null);
  }
  var api = {
    build: build,
    select: function (units, hall) { current = build(units, hall); return current; }
  };
  Object.defineProperty(api, 'pid', { enumerable: true, get: function () { return current || (current = fallback()); } });
  root.RZFuelSheets = api;
})(typeof window !== 'undefined' ? window : null);
