/*
 * fire-sheet.js — FS-M-101, the Conventional fire-water / pre-action / detection P&ID as sheet data
 * (PRD-CONV-REDRAW W1). Drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js; this file
 * holds geometry only. Every value and state comes from fire-system.html through read()/flow().
 * Zones 1-5 = pre-action halls A-D + electrical; WAV-01..03 = wet-pipe support areas.
 */
(function (root) {
  'use strict';
  if (!root) return;
  var ZX = [978, 1062, 1146, 1230, 1314];          // pre-action zone columns (detector, PAV, heads)
  var ZNAME = ['Hall A', 'Hall B', 'Hall C', 'Hall D', 'Electrical'];
  var WX = [712, 784, 856];                          // wet-pipe alarm valve columns
  var PY = [470, 560, 650];                          // pump rows: FP-01, JP-01, FP-02
  var LOOP_Y = 128, HDR_Y = 260, VALVE_Y = 330, HEAD_Y = 440, N2_Y = 500;

  var nodes = [
    /* detection and control */
    { id: 'facp', tag: 'FACP-01', sym: 'facp', x: 90, y: 78, size: 36, cls: 'fire-facp', label: 'Addressable fire alarm control panel', values: [{ k: 'st', dx: 24, dy: 17, anchor: 'start', lod: 1 }], tagAt: 'right' },
    { id: 'vesda', tag: 'VESDA-01/02', sym: 'aspirating', x: 250, y: 78, size: 32, cls: 'fire-vesda', label: 'Aspirating smoke detection', values: [{ k: 'st', dx: 22, dy: 17, anchor: 'start', lod: 1 }], tagAt: 'right' },
    { id: 'rcp', tag: 'RCP-01', sym: 'releasePanel', x: 420, y: 78, size: 32, label: 'Pre-action release control', tagAt: 'right' },
    { id: 'mcp', tag: 'MCP-01', sym: 'manualStation', x: 540, y: 78, size: 28, label: 'Manual call point', tagAt: 'right' },
    { id: 'abt', tag: 'ABT-01', sym: 'abortSwitch', x: 640, y: 78, size: 28, label: 'Abort / hold switch', values: [{ k: 'st', dx: 18, dy: 17, anchor: 'start', lod: 1 }], tagAt: 'right' },
    /* make-up and reserve */
    { id: 'mains', tag: 'MAINS', sym: 'offSheet', x: 40, y: 250, size: 24, label: 'Town / landlord water make-up', tagAt: 'above' },
    { id: 'vmu', tag: 'V-MU', sym: 'valveGate', x: 110, y: 250, size: 24, tagAt: 'above' },
    { id: 'ftmu', tag: 'FT-MU', sym: 'flowMeter', x: 170, y: 250, size: 24, tagAt: 'above', values: [{ k: 'q', dx: 0, dy: 26, lod: 1, point: 'fire.FT-MU.flow_m3h', label: 'FT-MU town make-up flow', unit: 'm³/h' }] },
    { id: 'tank', tag: 'TK-FW-01', sym: 'tankStorage', x: 240, y: 380, size: 96, cls: 'fire-tank', label: 'Fire-water reserve tank', tagAt: 'left',
      values: [{ k: 'lvl', dx: -56, dy: 18, anchor: 'end', lod: 1, point: 'fire.level_pct', label: 'Fire-water tank level' }, { k: 'vol', dx: -56, dy: 30, anchor: 'end', lod: 1, point: 'fire.stored_m3', label: 'Fire-water stored volume', unit: 'm³' }, { k: 'dur', dx: -56, dy: 42, anchor: 'end', lod: 1, point: 'fire.duration_min', label: 'Fire-water duration at pump demand', unit: 'min' }] },
    { id: 'lt', tag: 'LT', sym: 'instField', x: 312, y: 350, size: 22, inst: 'LT', tagAt: 'none' },
    /* suction header junctions */
    { id: 'js0', sym: 'junction', x: 360, y: 416, dot: false },
    { id: 'js1', sym: 'junction', x: 360, y: PY[0] }, { id: 'js2', sym: 'junction', x: 360, y: PY[1] }, { id: 'js3', sym: 'junction', x: 360, y: PY[2], dot: false },
    /* discharge header junctions */
    { id: 'jd1', sym: 'junction', x: 650, y: PY[0] }, { id: 'jd2', sym: 'junction', x: 650, y: PY[1] }, { id: 'jd3', sym: 'junction', x: 650, y: PY[2] },
    { id: 'jtop', sym: 'junction', x: 650, y: HDR_Y }, { id: 'jpt', sym: 'junction', x: 650, y: 330 },
    { id: 'pt', tag: 'PT-01', sym: 'instField', x: 600, y: 330, size: 22, inst: 'PT', tagAt: 'left', values: [{ k: 'p', dx: -14, dy: 16, anchor: 'end', lod: 1, point: 'fire.static_pressure_bar', label: 'PT-01 fire main pressure' }] },
    { id: 'riser', tag: 'FH / HR RISER', sym: 'offSheet', x: 650, y: 190, size: 24, rot: 270, tagAt: 'left' },
    /* test header */
    { id: 'fe', tag: 'FE-01', sym: 'flowMeter', x: 590, y: 715, size: 24, rot: 180, tagAt: 'above', values: [{ k: 'q', dx: 0, dy: 26, lod: 1, point: 'fire.FE-01.flow_m3h', label: 'FE-01 fire pump discharge flow', unit: 'm³/h' }] },
    { id: 'vtest', tag: 'V-TEST', sym: 'valveGlobe', x: 520, y: 715, size: 24, tagAt: 'above' },
    { id: 'drain', tag: 'TEST · DRAIN', sym: 'drain', x: 460, y: 715, size: 22, tagAt: 'left' },
    /* N2 supervisory gas */
    { id: 'jn2h', sym: 'junction', x: 850, y: N2_Y, dot: false },
    { id: 'n2', tag: 'N2-GEN-01', sym: 'compressor', x: 800, y: 580, size: 36, cls: 'fire-n2', label: 'Nitrogen generator · pre-action supervisory gas', tagAt: 'left', values: [{ k: 'p', dx: -22, dy: 16, anchor: 'end', lod: 1, point: 'fire.N2-GEN-01.pressure_bar', label: 'N2-GEN-01 supervisory gas pressure', unit: 'bar' }] }
  ];
  var pumps = [
    { id: 'fp1', tag: 'FP-01', label: 'Main fire pump 1 · electric', size: 40 },
    { id: 'jp1', tag: 'JP-01', label: 'Jockey pump · pressure maintenance', size: 28 },
    { id: 'fp2', tag: 'FP-02', label: 'Main fire pump 2 · diesel', size: 40 }
  ];
  var edges = [
    { id: 'e-mu1', from: 'mains.port', to: 'vmu.a', medium: 'fw', flowOf: 'mu' },
    { id: 'e-mu2', from: 'vmu.b', to: 'ftmu.a', medium: 'fw', flowOf: 'mu' },
    { id: 'e-mu', from: 'ftmu.b', to: 'tank.inlet', medium: 'fw', flowOf: 'mu' },
    { id: 'e-lt', from: [288, 350], to: 'lt.process', w: 'inst', medium: 'line' },
    { id: 'e-suc', from: 'tank.outlet', to: 'js0', medium: 'fw', w: 'main', flowOf: 'fire', line: 'SUCTION HDR' },
    { id: 'e-suc1', from: 'js0', to: 'js1', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-suc2', from: 'js1', to: 'js2', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-suc3', from: 'js2', to: 'js3', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-d3', from: 'jd3', to: 'jd2', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-d2', from: 'jd2', to: 'jd1', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-d1', from: 'jd1', to: 'jpt', medium: 'fw', w: 'main', flowOf: 'fire', line: 'DISCHARGE HDR' },
    { id: 'e-d0', from: 'jpt', to: 'jtop', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-pt', from: 'jpt', to: 'pt.process', w: 'inst', medium: 'line' },
    { id: 'e-riser', from: 'jtop', to: 'riser.port', medium: 'fw', w: 'main', flowOf: 'fire' },
    { id: 'e-hdr', from: 'jtop', to: [ZX[4], HDR_Y], medium: 'fw', w: 'main', flowOf: 'fire', line: 'SPRINKLER DISTRIBUTION HDR' },
    { id: 'e-test', from: 'jd3', to: 'fe.a', via: [[650, 715]], medium: 'fw', flowOf: 'test' },
    { id: 'e-test2', from: 'fe.b', to: 'vtest.a', medium: 'fw', flowOf: 'test' },
    { id: 'e-test3', from: 'vtest.b', to: 'drain.port', medium: 'fw', flowOf: 'test' },
    { id: 'e-n2', from: 'n2.discharge', to: 'jn2h', medium: 'agent', flowOf: 'n2' },
    { id: 'e-n2h', from: 'jn2h', to: [ZX[4] - 26, N2_Y], medium: 'agent', flowOf: 'n2', line: 'N2 SUPERVISORY' },
    { id: 'e-loop', from: 'facp.loop', to: [ZX[4] + 40, LOOP_Y], via: [[90, LOOP_Y]], medium: 'line', w: 'signal', line: 'SLC LOOP' }
  ];
  pumps.forEach(function (p, i) {
    var y = PY[i];
    nodes.push({ id: 'vs' + i, sym: 'valveGate', x: 410, y: y, size: 24, tagAt: 'none' });
    nodes.push({ id: p.id, tag: p.tag, sym: 'pumpCentrifugal', x: 480, y: y, size: p.size, cls: 'fire-pump', label: p.label, tagAt: 'above',
      /* W4 B2: command and feedback are two values (CMD ON|OFF over RUN|STOP) */
      values: [{ k: 'cmd', dx: 0, dy: p.size / 2 + 12, lod: 1 }, { k: 'st', dx: 0, dy: p.size / 2 + 24, lod: 1 }] });
    nodes.push({ id: 'cv' + i, sym: 'valveCheck', x: 555, y: y, size: 24, tagAt: 'none' });
    nodes.push({ id: 'vd' + i, sym: 'valveGate', x: 605, y: y, size: 24, tagAt: 'none' });
    var flow = i === 1 ? 'jockey' : (i === 0 ? 'fp1' : 'fp2');
    edges.push({ id: 'e-s' + i, from: 'js' + (i + 1), to: 'vs' + i + '.a', medium: 'fw', flowOf: flow });
    edges.push({ id: 'e-p' + i, from: 'vs' + i + '.b', to: p.id + '.suction', medium: 'fw', flowOf: flow });
    edges.push({ id: 'e-c' + i, from: p.id + '.discharge', to: 'cv' + i + '.inlet', medium: 'fw', flowOf: flow });
    edges.push({ id: 'e-v' + i, from: 'cv' + i + '.outlet', to: 'vd' + i + '.a', medium: 'fw', flowOf: flow });
    edges.push({ id: 'e-h' + i, from: 'vd' + i + '.b', to: 'jd' + (i + 1), medium: 'fw', flowOf: flow });
  });
  /* PRD-SETPOINT-SIM P9 part 2: the pump controllers as ISA-5.1 panel bubbles, from the control registry
     (RZControlPoints.loops('fs-m-101'), on-off). NFPA 20: each controller senses the discharge through its own line,
     tapped between the pump's check valve (x 555) and its discharge valve (x 605); it starts its own pump. No tag or
     number is typed here: a registry loop names its pump (mv.node) and the page writes the cut-in / cut-out. */
  var C = root.RZControlPoints, LX = 580;
  (C && typeof C.loops === 'function' ? C.loops('fs-m-101') : []).forEach(function (L) {
    var i = -1; pumps.forEach(function (p, k) { if (p.id === L.mv.node) i = k; });
    if (i < 0) return;
    var y = PY[i], p = pumps[i], cy = y - 40, r = 15, id = 'lc-' + p.id, px = 480 + p.size / 2;
    nodes.push({ id: id, tag: L.tag, sym: 'instPanel', x: LX, y: cy, size: 2 * r, inst: 'PC', tagAt: 'right', loop: L.sp, ctrl: p.id,
      label: L.tag + ' — ' + p.tag + ' controller (' + L.action + ' acting ' + L.kind + ')',
      values: [{ k: 'sp', dx: 0, dy: -r - 8, anchor: 'middle', lod: 1, const: 'cut-in / cut-out from the control registry (' + L.sp + ')' }] });
    /* instPanel geometry (48-unit box): circle centre 4/48 of the size above the node centre, radius 14/48; the sensing line
       enters at the process port (bottom of the stem), the signal leaves the left of the circle */
    var ccy = cy - 4 * 2 * r / 48, cl = LX - 14 * 2 * r / 48;
    edges.push({ id: 'e-ls-' + p.id, from: [LX, y], to: id + '.process', w: 'inst', medium: 'line', loop: L.sp });
    edges.push({ id: 'e-lm-' + p.id, from: [cl, ccy], to: [px + 1, y - 10], via: [[515, ccy], [515, y - 10]], w: 'signal', medium: 'line', loop: L.sp });
    nodes.forEach(function (nd) { if (nd.id === p.id) nd.loop = L.sp; });
  });
  WX.forEach(function (x, i) {
    var n = i + 1;
    nodes.push({ id: 'jw' + n, sym: 'junction', x: x, y: HDR_Y });
    nodes.push({ id: 'wav' + n, tag: 'WAV-0' + n, sym: 'alarmValve', x: x, y: VALVE_Y, size: 24, rot: 90, cls: 'fire-wav', tagAt: 'right' });
    nodes.push({ id: 'wsp' + n, sym: 'sprinklerHead', x: x, y: HEAD_Y, size: 26, tagAt: 'none' });
    edges.push({ id: 'e-w' + n, from: 'jw' + n, to: 'wav' + n + '.inlet', medium: 'fw', flowOf: 'wet' });
    edges.push({ id: 'e-ws' + n, from: 'wav' + n + '.outlet', to: 'wsp' + n + '.inlet', medium: 'fw', flowOf: 'wet' });
  });
  ZX.forEach(function (x, i) {
    var n = i + 1;
    nodes.push({ id: 'zd' + n, tag: 'ZONE ' + n, sym: 'smokeDetector', x: x, y: 78, size: 28, cls: 'fire-zone', label: 'Detection zone ' + n + ' · ' + ZNAME[i] + ' (SD · HD · VESDA)',
      tagAt: 'above', values: [{ k: 'st', dx: 6, dy: 30, anchor: 'start', lod: 1 }] });   /* right of the loop drop (text-clear C1) */
    nodes.push({ id: 'jz' + n, sym: 'junction', x: x, y: HDR_Y, dot: n < 5 });
    nodes.push({ id: 'pav' + n, tag: 'PAV-0' + n, sym: 'preActionValve', x: x, y: VALVE_Y, size: 30, rot: 90, cls: 'fire-pav', label: 'Pre-action valve · zone ' + n + ' · ' + ZNAME[i], tagAt: 'left' });
    nodes.push({ id: 'jn' + n, sym: 'junction', x: x, y: 395 });
    nodes.push({ id: 'sp' + n, sym: 'sprinklerHead', x: x, y: HEAD_Y, size: 26, tagAt: 'none' });
    edges.push({ id: 'e-z' + n, from: 'jz' + n, to: 'pav' + n + '.a', medium: 'fw', flowOf: 'pre' });
    edges.push({ id: 'e-zp' + n, from: 'pav' + n + '.b', to: 'jn' + n, medium: 'fw', flowOf: 'pre' });
    edges.push({ id: 'e-zs' + n, from: 'jn' + n, to: 'sp' + n + '.inlet', medium: 'fw', flowOf: 'pre' });
    nodes.push({ id: 'jn2' + n, sym: 'junction', x: x - 26, y: N2_Y, dot: n < 5 });
    edges.push({ id: 'e-n2z' + n, from: 'jn2' + n, to: 'jn' + n, via: [[x - 26, 395]], medium: 'agent', flowOf: 'n2' });
    edges.push({ id: 'e-zd' + n, from: [x, LOOP_Y], to: [x, 94], medium: 'line', w: 'signal' });
    edges.push({ id: 'e-rel' + n, from: [x + 22, LOOP_Y], to: 'pav' + n + '.signal', vfirst: true, medium: 'line', w: 'signal' });
  });
  [['vesda', 250, 94], ['rcp', 420, 94], ['mcp', 540, 92], ['abt', 640, 92]].forEach(function (d) {
    edges.push({ id: 'e-l' + d[0], from: [d[1], LOOP_Y], to: [d[1], d[2]], medium: 'line', w: 'signal' });
  });

  root.RZFireSheets = {
    pid: {
      id: 'fs-m-101', no: 'FS-M-101', title: 'FIRE WATER · PRE-ACTION · DETECTION', rev: 'B', basis: 'NFPA 13 / 20 / 72',
      svgId: 'fire-svg', size: [1400, 770], nodes: nodes, edges: edges,
      areas: [
        { x: 20, y: 30, w: 1370, h: 110, label: 'DETECTION & RELEASE CONTROL', kind: 'zone' },
        { x: 20, y: 160, w: 670, h: 590, label: 'FIRE-WATER RESERVE & PUMP SET', kind: 'zone' },
        { x: 700, y: 160, w: 690, h: 470, label: 'SPRINKLER · WET ×3 · PRE-ACTION ×5', kind: 'zone' }
      ],
      notes: []
    },
    zones: ZNAME.slice()
  };
})(typeof window !== 'undefined' ? window : null);
