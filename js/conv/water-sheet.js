/*
 * water-sheet.js — WT-M-101, the site water treatment and cooling-tower make-up P&ID for
 * water-system.html, drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js
 * (ISO 10628-2 / ISA-5.1). Geometry only: every number comes from the page's read().
 *
 *   Mains -> FM-101 -> TK-101 raw tank -> FLT-201 media filter (backwash XV-202 to drain)
 *   -> P-301A/B booster pair -> PT-301 -> DOS-302 chlorine injection -> UV-401
 *   -> treated header: TK-402 domestic tank -> domestic/process service
 *                      FT-501 -> XV-501 -> CT-501 cooling tower basin (make-up)
 *   CT-501 <-> chiller-plant condensers (CDW loop); blowdown XV-502 -> drain.
 * Node ids equal the page's WATER_EQUIPMENT keys so the inspector payloads are reused.
 */
(function (root) {
  'use strict';
  if (!root) return;

  var Y_IN = 140, Y = 286, Y_DR = 560;

  var nodes = [
    { id: 'mains', tag: 'MAINS', sym: 'offSheet', x: 40, y: Y_IN, size: 22, rot: 180, tagAt: 'above' },
    { id: 'meter', tag: 'FM-101', sym: 'flowMeter', x: 120, y: Y_IN, size: 26, cls: 'water', label: 'Mains meter', tagAt: 'above',
      values: [{ k: 'q', dx: 0, dy: 28, lod: 1, point: 'water.total_treated_lpm', label: 'FM-101 treatment-train flow' }, { k: 'p', dx: 0, dy: 40, lod: 1, point: 'water.FM-101.pressure_bar', label: 'FM-101 mains pressure', unit: 'bar' }] },
    { id: 'rawtank', tag: 'TK-101', sym: 'tankStorage', x: 240, y: 250, size: 96, cls: 'water', label: 'Raw water tank', tagAt: 'left',
      values: [{ k: 'pct', dx: -56, dy: 18, anchor: 'end', lod: 1, point: 'water.raw_tank_pct', label: 'TK-101 raw tank level' }, { k: 'vol', dx: -56, dy: 30, anchor: 'end', lod: 1, point: 'water.TK-101.volume_m3', label: 'TK-101 raw tank volume', unit: 'm³' }, { k: 'aut', dx: -56, dy: 42, anchor: 'end', lod: 1, point: 'water.TK-101.autonomy_h', label: 'TK-101 autonomy at total treated flow', unit: 'h' }] },
    { id: 'lit', tag: 'LIT-101', sym: 'instField', x: 316, y: 214, size: 34, inst: 'LIT', tagAt: 'right' },
    { id: 'filter', tag: 'FLT-201', sym: 'filterCartridge', x: 370, y: Y, size: 36, cls: 'water', label: 'Media filter', tagAt: 'above',
      values: [{ k: 'dp', dx: 0, dy: 30, lod: 1, point: 'water.filter_dp_bar', label: 'FLT-201 differential pressure' }, { k: 'io', dx: 0, dy: 42, lod: 1, point: 'water.FLT-201.inlet_bar', label: 'FLT-201 inlet pressure (outlet = inlet minus DP)', unit: 'bar' }] },
    { id: 'jbw', sym: 'junction', x: 420, y: Y },
    { id: 'backwash', tag: 'XV-202', sym: 'valveSolenoid', x: 420, y: 380, size: 24, rot: 90, cls: 'water', label: 'Backwash valve', tagAt: 'right',
      values: [{ k: 'st', dx: 18, dy: 16, anchor: 'start', lod: 1 }] },
    { id: 'jpl', sym: 'junction', x: 460, y: Y }, { id: 'jpr', sym: 'junction', x: 580, y: Y },
    { id: 'pump-duty', tag: 'P-301A', sym: 'pumpCentrifugal', x: 520, y: Y, size: 30, cls: 'water', label: 'Booster pump (duty)', tagAt: 'above',
      values: [{ k: 'st', dx: 0, dy: -34, lod: 1, point: 'water.P-301A.power_kw', label: 'P-301A duty pump power', unit: 'kW' }] },
    { id: 'pump-standby', tag: 'P-301B', sym: 'pumpCentrifugal', x: 520, y: Y + 56, size: 30, cls: 'water', label: 'Booster pump (standby)', tagAt: 'below',
      values: [{ k: 'st', dx: 0, dy: 38, lod: 1 }] },
    { id: 'jpt', sym: 'junction', x: 620, y: Y, dot: false },
    { id: 'pt301', tag: 'PT-301', sym: 'instField', x: 620, y: 240, size: 28, inst: 'PT', tagAt: 'above',
      values: [{ k: 'p', dx: 18, dy: 4, anchor: 'start', lod: 1, point: 'water.PT-301.pressure_bar', label: 'PT-301 booster discharge pressure', unit: 'bar' }] },
    { id: 'dosing', tag: 'DOS-302', sym: 'dosingPot', x: 690, y: 198, size: 32, cls: 'water', label: 'Chlorine dosing', tagAt: 'above',
      values: [{ k: 'cl2', dx: 22, dy: 0, anchor: 'start', lod: 1, point: 'water.DOS-302.chlorine_dose_lph', label: 'DOS-302 chlorine dose', unit: 'L/h' }, { k: 'res', dx: 22, dy: 12, anchor: 'start', lod: 1, point: 'water.DOS-302.residual_ppm', label: 'DOS-302 chlorine residual', unit: 'ppm' }] },
    { id: 'jdose', sym: 'junction', x: 698, y: Y },
    { id: 'uv', tag: 'UV-401', sym: 'uvSteriliser', x: 770, y: Y, size: 36, cls: 'water', label: 'UV steriliser', tagAt: 'above',
      values: [{ k: 'int', dx: 0, dy: 30, lod: 1, point: 'water.uv_intensity_pct', label: 'UV-401 lamp intensity' }] },
    { id: 'jt', sym: 'junction', x: 840, y: Y },
    { id: 'domtank', tag: 'TK-402', sym: 'tankStorage', x: 930, y: 440, size: 72, cls: 'water', label: 'Domestic / treated tank', tagAt: 'below',
      values: [{ k: 'pct', dx: -44, dy: 14, anchor: 'end', lod: 1, point: 'water.dom_tank_pct', label: 'TK-402 domestic tank level' }, { k: 'vol', dx: -44, dy: 26, anchor: 'end', lod: 1, point: 'water.TK-402.volume_m3', label: 'TK-402 domestic tank volume', unit: 'm³' }, { k: 'aut', dx: -44, dy: 38, anchor: 'end', lod: 1, point: 'water.TK-402.autonomy_h', label: 'TK-402 autonomy at domestic draw', unit: 'h' }] },
    { id: 'service', tag: 'DOMESTIC · PROCESS', sym: 'offSheet', x: 1010, y: 467, size: 22, cls: 'water', label: 'Domestic / process service header', tagAt: 'below',
      values: [{ k: 'q', dx: 16, dy: 4, anchor: 'start', lod: 1, point: 'water.domestic_lpm', label: 'Domestic / process draw' }] },
    { id: 'fmk', tag: 'FT-501', sym: 'flowMeter', x: 900, y: Y, size: 26, tagAt: 'above', values: [{ k: 'q', dx: 0, dy: 28, lod: 1, point: 'water.flow_lpm_for_wue', label: 'FT-501 cooling-tower make-up' }] },
    { id: 'xvmk', tag: 'XV-501', sym: 'valveControlMotor', x: 975, y: Y, size: 24, tagAt: 'below' },
    { id: 'makeup', tag: 'CT-501', sym: 'coolingTowerCell', x: 1080, y: 268, size: 72, cls: 'water', label: 'Cooling tower cell + basin', tagAt: 'above',
      values: [{ k: 'basin', dx: -46, dy: 60, anchor: 'end', lod: 1, point: 'water.CT-501.basin_pct', label: 'CT-501 basin level', unit: '%' }, { k: 'ev', dx: -46, dy: 72, anchor: 'end', lod: 1, point: 'water.evaporation_lpm', label: 'CT-501 evaporation' }, { k: 'dr', dx: -46, dy: 84, anchor: 'end', lod: 1, point: 'water.drift_lpm', label: 'CT-501 drift' }, { k: 'coc', dx: -46, dy: 96, anchor: 'end', lod: 1, point: 'water.tower_cycles_of_concentration', label: 'CT-501 cycles of concentration', unit: 'COC' }] },
    { id: 'chplant', tag: 'CH-PLANT', sym: 'hxShellTube', x: 1196, y: 272, size: 40, cls: 'water', label: 'Chiller-plant condensers (CDW loop)', tagAt: 'above',
      values: [{ k: 'hr', dx: 0, dy: 34, lod: 1, point: 'cooling.heat_rejection_kw', label: 'CH-PLANT heat rejected' }, { k: 's', dx: 0, dy: 46, lod: 1, point: 'cooling.cdw_supply_c', label: 'CDWS' }, { k: 'r', dx: 0, dy: 58, lod: 1, point: 'cooling.cdw_return_c', label: 'CDWR' }] },
    { id: 'bd', tag: 'XV-502', sym: 'valveSolenoid', x: 1080, y: 420, size: 24, rot: 90, tagAt: 'right',
      values: [{ k: 'q', dx: 18, dy: 16, anchor: 'start', lod: 1, point: 'water.blowdown_lpm', label: 'XV-502 tower blowdown' }] },
    { id: 'jd1', sym: 'junction', x: 420, y: Y_DR },
    { id: 'drain', tag: 'DRAIN · SEWER', sym: 'offSheet', x: 60, y: Y_DR, size: 22, tagAt: 'above' }
  ];

  var edges = [
    { id: 'e-in', from: 'mains.port', to: 'meter.a', medium: 'pw', flowOf: 'run', line: 'MAINS' },
    { id: 'e-in2', from: 'meter.b', to: 'rawtank.inlet', via: [[240, Y_IN]], medium: 'pw', flowOf: 'run' },
    { id: 'e-lit', from: [282, 230], to: 'lit.process', via: [[316, 230]], medium: 'line', w: 'inst' },
    { id: 'e-raw', from: 'rawtank.outlet', to: 'filter.inlet', medium: 'pw', flowOf: 'run', line: 'RAW' },
    { id: 'e-flt', from: 'filter.outlet', to: 'jbw', medium: 'pw', flowOf: 'run' },
    { id: 'e-bw1', from: 'jbw', to: 'backwash.a', medium: 'dr', flowOf: 'bw' },
    { id: 'e-bw2', from: 'backwash.b', to: 'jd1', medium: 'dr', flowOf: 'bw' },
    { id: 'e-f2', from: 'jbw', to: 'jpl', medium: 'pw', flowOf: 'run' },
    { id: 'e-pa1', from: 'jpl', to: 'pump-duty.suction', medium: 'pw', flowOf: 'duty' },
    { id: 'e-pa2', from: 'pump-duty.discharge', to: 'jpr', medium: 'pw', flowOf: 'duty' },
    { id: 'e-pb1', from: 'jpl', to: 'pump-standby.suction', via: [[460, Y + 56]], medium: 'pw', flowOf: 'stby' },
    { id: 'e-pb2', from: 'pump-standby.discharge', to: 'jpr', via: [[580, Y + 56]], medium: 'pw', flowOf: 'stby' },
    { id: 'e-p3', from: 'jpr', to: 'jpt', medium: 'pw', flowOf: 'run' },
    { id: 'e-pt', from: 'jpt', to: 'pt301.process', medium: 'line', w: 'inst' },
    { id: 'e-p4', from: 'jpt', to: 'jdose', medium: 'pw', flowOf: 'run' },
    { id: 'e-dose', from: 'dosing.outlet', to: 'jdose', medium: 'agent', flowOf: 'run' },
    { id: 'e-p5', from: 'jdose', to: 'uv.inlet', medium: 'pw', flowOf: 'run' },
    { id: 'e-p6', from: 'uv.outlet', to: 'jt', medium: 'pw', flowOf: 'run', line: 'TREATED' },
    { id: 'e-dom', from: 'jt', to: 'domtank.inlet', via: [[840, 370], [930, 370]], medium: 'pw', flowOf: 'run' },
    { id: 'e-svc', from: 'domtank.outlet', to: 'service.port', medium: 'pw', flowOf: 'run' },
    { id: 'e-mk1', from: 'jt', to: 'fmk.a', medium: 'pw', flowOf: 'run', line: 'MAKE-UP' },
    { id: 'e-mk2', from: 'fmk.b', to: 'xvmk.a', medium: 'pw', flowOf: 'run' },
    { id: 'e-mk3', from: 'xvmk.b', to: 'makeup.makeup', medium: 'pw', flowOf: 'run' },
    { id: 'e-cdws', from: 'makeup.basinOut', to: 'chplant.tubeIn', via: [[1150, 295], [1150, 272]], medium: 'cw', flowOf: 'run' },
    { id: 'e-cdwr', from: 'chplant.tubeOut', to: 'makeup.hotIn', via: [[1236, 272], [1236, 214], [1140, 214], [1140, 250]], medium: 'cw', flowOf: 'run', line: 'CDW' },
    { id: 'e-bd1', from: 'makeup.blowdown', to: 'bd.a', medium: 'dr', flowOf: 'run' },
    { id: 'e-bd2', from: 'bd.b', to: [1080, Y_DR], medium: 'dr', flowOf: 'run' },
    { id: 'e-dr1', from: [1080, Y_DR], to: 'jd1', medium: 'dr', w: 'main', flowOf: 'run', line: 'BLOWDOWN · BACKWASH' },
    { id: 'e-dr2', from: 'jd1', to: 'drain.port', medium: 'dr', w: 'main', flowOf: 'run' }
  ];

  /* PRD-SETPOINT-SIM §C P9 (v3.115.2): the booster set's pressure controller PIC-301 as an ISA-5.1 panel bubble, from the
     control registry (RZControlPoints.loops('wt-m-101'), PI). PT-301 on the common discharge signals the controller; the
     controller trims the duty pump's speed. No tag or number is typed here: the registry loop names its transmitter
     (pv.node) and its pump (mv.node); the page writes the setpoint. instPanel geometry (48-unit box): circle centre 4/48
     of the size above the node centre, radius 14/48. */
  var C = root.RZControlPoints;
  (C && typeof C.loops === 'function' ? C.loops('wt-m-101') : []).forEach(function (L) {
    var pv = null, mv = null;
    nodes.forEach(function (nd) { if (nd.id === L.pv.node) pv = nd; if (nd.id === L.mv.node) mv = nd; });
    if (!pv || !mv) return;
    var id = 'pic301', x = 566, y = 182, sz = 46, ccy = y - 4 * sz / 48, r = 14 * sz / 48;
    nodes.push({ id: id, tag: L.tag, sym: 'instPanel', x: x, y: y, size: sz, inst: 'PIC', tagAt: 'left', loop: L.sp, ctrl: mv.id,
      label: mv.tag + ' pressure controller (' + L.action + ' acting ' + L.kind + ')',
      values: [{ k: 'sp', dx: 0, dy: -sz / 2 - 6, anchor: 'middle', lod: 1, const: 'booster discharge setpoint from the control registry (' + L.sp + ')' }] });
    /* transmitter -> controller: from PT-301's left edge, level with the controller circle */
    edges.push({ id: 'e-ps-' + id, from: [pv.x - 14 * pv.size / 48, pv.y - 4], to: [x + r, ccy], via: [[598, pv.y - 4], [598, ccy]], w: 'signal', medium: 'line', loop: L.sp });
    /* controller -> duty pump: down the right of the pump tag to the pump's upper right */
    edges.push({ id: 'e-pm-' + id, from: [x, ccy + r], to: [mv.x + mv.size / 2 - 2, mv.y - 8], via: [[x, mv.y - 8]], w: 'signal', medium: 'line', loop: L.sp });
    pv.loop = L.sp; mv.loop = L.sp;
  });

  root.RZWaterSheets = {
    pid: {
      id: 'wt-m-101', no: 'WT-M-101', title: 'SITE WATER · TREATMENT · TOWER MAKE-UP', rev: 'A', basis: 'ISA-5.1 · ISO 10628',
      svgId: 'water-svg', size: [1260, 640], nodes: nodes, edges: edges,
      areas: [
        { x: 16, y: 60, w: 800, h: 540, label: 'TREATMENT TRAIN', kind: 'zone' },
        { x: 826, y: 60, w: 420, h: 540, label: 'SERVICE · HEAT REJECTION', kind: 'zone' }
      ],
      notes: []
    }
  };
})(typeof window !== 'undefined' ? window : null);
