/*
 * fuel-sheet.js — FU-M-101, the diesel fuel storage, transfer and day-tank P&ID for
 * fuel-system.html, drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js
 * (ISO 10628-2 / ISA-5.1). Geometry only: every number and state comes from the page's read().
 *
 *   Tanker fill -> UST-01 bulk tank -> P-101 duty / P-102 lag (check valves) -> FT-101, PT-101
 *   -> transfer header -> XV-A/B/C -> DT-GEN-A/B/C day tanks -> GEN-A/B/C fuel inlet.
 *   UST-01 side-stream: FPU-01 pre-filter -> coalescer -> final filter -> back to UST-01.
 *   LD-101 interstitial leak (UST), LD-201 day-tank bund leak.
 */
(function (root) {
  'use strict';
  if (!root) return;

  var DT = [{ k: 'A', y: 170 }, { k: 'B', y: 330 }, { k: 'C', y: 490 }];
  var nodes = [
    { id: 'fill', tag: 'TANKER FILL', sym: 'offSheet', x: 50, y: 150, size: 22, rot: 180, cls: 'fuel', label: 'Tanker fill point', tagAt: 'above',
      values: [{ k: 'st', dx: -10, dy: 24, anchor: 'start', lod: 1 }] },
    { id: 'ust', tag: 'UST-01', sym: 'tankStorage', x: 220, y: 330, size: 120, cls: 'fuel', label: 'Bulk storage tank (underground)', tagAt: 'left',
      values: [{ k: 'pct', dx: -64, dy: 15, anchor: 'end', lod: 1 }, { k: 'use', dx: -64, dy: 27, anchor: 'end', lod: 1 }, { k: 'st', dx: -64, dy: 39, anchor: 'end', lod: 1 }] },
    { id: 'ld101', tag: 'LD-101', sym: 'leakSensor', x: 120, y: 470, size: 22, label: 'UST interstitial leak detection', tagAt: 'left',
      values: [{ k: 'st', dx: 0, dy: 26, lod: 1 }] },
    { id: 'jsuc', sym: 'junction', x: 360, y: 375 },
    { id: 'p101', tag: 'P-101', sym: 'pumpCentrifugal', x: 440, y: 330, size: 36, cls: 'fuel', label: 'Transfer pump (duty)', tagAt: 'above',
      values: [{ k: 'cmd', dx: 0, dy: -54, lod: 1 }, { k: 'st', dx: 0, dy: -42, lod: 1 }] },
    { id: 'p102', tag: 'P-102', sym: 'pumpCentrifugal', x: 440, y: 420, size: 36, cls: 'fuel', label: 'Transfer pump (lag)', tagAt: 'below',
      values: [{ k: 'cmd', dx: 0, dy: 40, lod: 1 }, { k: 'st', dx: 0, dy: 52, lod: 1 }] },
    { id: 'cv101', sym: 'valveCheck', x: 500, y: 330, size: 20 },
    { id: 'cv102', sym: 'valveCheck', x: 500, y: 420, size: 20 },
    { id: 'jhd', sym: 'junction', x: 560, y: 330 },
    { id: 'ft101', tag: 'FT-101', sym: 'flowMeter', x: 610, y: 330, size: 26, tagAt: 'below', values: [{ k: 'q', dx: 0, dy: 36, lod: 1 }] },
    { id: 'jpt', sym: 'junction', x: 660, y: 330, dot: false },
    { id: 'pt101', tag: 'PT-101', sym: 'instField', x: 660, y: 280, size: 28, inst: 'PT', tagAt: 'above',
      values: [{ k: 'p', dx: -18, dy: 4, anchor: 'end', lod: 1 }] },
    { id: 'fpu-pf', tag: 'FPU-01 PF', sym: 'filterCartridge', x: 250, y: 560, size: 30, cls: 'fuel', label: 'Polisher pre-filter', tagAt: 'below' },
    { id: 'fpu-cs', tag: 'CS', sym: 'filterCartridge', x: 320, y: 560, size: 30, cls: 'fuel', label: 'Polisher coalescer / water separator', tagAt: 'below',
      values: [{ k: 'st', dx: 0, dy: -24, lod: 1 }] },
    { id: 'fpu-ff', tag: 'FF', sym: 'filterCartridge', x: 390, y: 560, size: 30, cls: 'fuel', label: 'Polisher final filter', tagAt: 'below' },
    { id: 'jbus', sym: 'junction', x: 760, y: 330 },
    { id: 'ld201', tag: 'LD-201', sym: 'leakSensor', x: 870, y: 580, size: 22, label: 'Day-tank bund leak detection', tagAt: 'left',
      values: [{ k: 'st', dx: 16, dy: 4, anchor: 'start', lod: 1 }] }
  ];
  var edges = [
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
  ];

  DT.forEach(function (r, i) {
    var k = r.k, lk = k.toLowerCase(), y = r.y, fy = y - 60;
    nodes.push(
      { id: 'j' + lk, sym: 'junction', x: 760, y: fy },
      { id: 'xv' + lk, tag: 'XV-' + k, sym: 'valveSolenoid', x: 830, y: fy, size: 24, cls: 'fuel', label: 'Day-tank ' + k + ' fill valve', tagAt: 'above',
        values: [{ k: 'st', dx: 0, dy: 24, lod: 1 }] },
      { id: 'dt' + lk, tag: 'DT-GEN-' + k, sym: 'tankStorage', x: 930, y: y, size: 72, cls: 'fuel', label: 'Day tank ' + k, tagAt: 'right',
        values: [{ k: 'pct', dx: -42, dy: 4, anchor: 'end', lod: 1 }] },
      { id: 'gen' + lk, tag: 'GEN-' + k, sym: 'gensetDiesel', x: 1130, y: y, size: 60, cls: 'fuel', label: 'Diesel genset ' + k, tagAt: 'above',
        values: [{ k: 'st', dx: 0, dy: 44, lod: 1 }, { k: 'mw', dx: 0, dy: 56, lod: 1 }] }
    );
    edges.push(
      { id: 'fs-dt-' + lk + '-feed', from: 'j' + lk, to: 'xv' + lk + '.a', medium: 'fuel', flowOf: 'f' + lk },
      { id: 'fs-dt-' + lk + '-in', from: 'xv' + lk + '.b', to: 'dt' + lk + '.inlet', via: [[930, fy]], medium: 'fuel', flowOf: 'f' + lk },
      { id: 'fs-gen-' + lk + '-supply', from: 'dt' + lk + '.outlet', to: 'gen' + lk + '.fuelIn', via: [[1050, y + 27], [1050, y + 7.5]], medium: 'fuel', flowOf: 'g' + lk }
    );
  });
  edges.push(
    { id: 'fs-bus-b', from: 'jbus', to: 'jb', medium: 'fuel', flowOf: 'busB' },
    { id: 'fs-bus-a', from: 'jb', to: 'ja', medium: 'fuel', flowOf: 'busA' },
    { id: 'fs-bus-c', from: 'jbus', to: 'jc', medium: 'fuel', flowOf: 'busC' }
  );

  root.RZFuelSheets = {
    pid: {
      id: 'fu-m-101', no: 'FU-M-101', title: 'DIESEL FUEL · TRANSFER · DAY TANKS', rev: 'A', basis: 'ISA-5.1 · ISO 10628',
      svgId: 'fuel-svg', size: [1260, 640], nodes: nodes, edges: edges,
      areas: [
        { x: 16, y: 60, w: 690, h: 560, label: 'BULK · TRANSFER · CONDITIONING', kind: 'zone' },
        { x: 716, y: 60, w: 530, h: 560, label: 'DAY TANKS · GENSETS', kind: 'zone' }
      ],
      notes: []
    }
  };
})(typeof window !== 'undefined' ? window : null);
