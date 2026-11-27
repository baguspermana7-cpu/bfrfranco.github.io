/*
 * chiller-sheet.js — CH-M-101 (chilled-water plant P&ID) and CH-M-102 (condenser water and cooling towers) for
 * chiller-plant.html, drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js (ISO 10628-2 / ISA-5.1).
 *
 * Geometry only, and the geometry follows the ENGINE's fleets (PRD-CONV-EQUIPMENT-TRUTH §6.1, phase E3): how many
 * trains, pumps, coil banks, tower cells and condenser pumps are drawn, and their tags, come from
 * CONV_CALC.getFleet(kind) and CONV_CALC.listHalls(). This file types no count. Every number on a sheet comes from the
 * page's read() (engine values, identities over them, or declared simulated machine state).
 *
 *   CH-M-101 primary: one train per chiller of getFleet('chiller') (CH-01 … CH-NN). Each: water-cooled chiller, CHW
 *     leaves the evaporator left through TT-n01 and an isolation valve into the CHWS header; CHWR enters from the CHWR
 *     header through TT-n02 and the train's primary pumps (getFleet('chw_primary_pump'), CHWP-nnA/B …, check valves)
 *     into the evaporator. Condenser-water stubs continue on CH-M-102.
 *   CH-M-101 distribution: decoupler between the headers; the secondary pump set (getFleet('chw_secondary_pump'));
 *     one typical CRAH coil bank per hall of listHalls() ("× N · M run" from getFleet('crah', hall)); return header,
 *     expansion vessel and air vents.
 *   CH-M-102: one induced-draft cell per getFleet('tower_cell') (CT-01 …) between the CDWR header (warm water from the
 *     condensers) and the CDWS header (cold basin water); one condenser-water pump per getFleet('cdw_pump') (CDWP-01 …)
 *     from the CDWS header to its chiller's condenser (off-sheet to CH-M-101).
 *
 *   RZChillerSheets.spec(CONV_CALC)    -> { chillers, primary, secondary, halls, cells, cdw } (fleet tags and states)
 *   RZChillerSheets.pid(spec) / cdw(spec) / unavailable(spec) -> RZHmiSheet sheet objects
 *   RZChillerSheets.fromEngine(CONV_CALC) -> { spec, pid, cdw, unavailable }  (also stored on RZChillerSheets.current)
 *
 * Points (PRD-CONV-POINT-STATUS-TREND T2): every value label that shows a number carries `point` (a registry id, or
 * chiller-plant.<tag>.<quantity> for a per-unit reading) and a short `label`; a per-unit reading of a limited quantity
 * names the registry row its limits come from in `limitsOf` (the page defines the per-unit point from that row, it never
 * types a limit). Status words (RUN / STBY / CMD) are not points.
 */
(function (root) {
  'use strict';
  if (!root) return;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  /* PRD-SETPOINT-SIM P4: the registry's control loops drawn on a sheet (js/rz-control-points.js); none without it */
  function loopsOf(sheet) { var C = root.RZControlPoints; return C && typeof C.loops === 'function' ? C.loops(sheet) : []; }
  function tagNo(tag, i) { var m = /(\d+)$/.exec(tag || ''); return m ? Number(m[1]) : i + 1; }

  /* the fleets the sheets draw, from the engine; a missing engine gives empty fleets (the page draws the
     fail-closed sheet then, never a typed count) */
  function spec(C) {
    var f = function (kind, hall) { try { return (C && typeof C.getFleet === 'function' ? C.getFleet(kind, hall) : null) || []; } catch (e) { return []; } };
    var halls = [];
    try { halls = (C && typeof C.listHalls === 'function' ? C.listHalls() : []) || []; } catch (e) { halls = []; }
    return {
      chillers: f('chiller'), primary: f('chw_primary_pump'), secondary: f('chw_secondary_pump'),
      cells: f('tower_cell'), cdw: f('cdw_pump'),
      halls: halls.map(function (h) { var crah = f('crah', String(h.code)); return { code: String(h.code), crah: crah }; })
    };
  }

  /* primary pumps of train t (by tag CHWP-<tt><letter>), in letter order */
  function trainPumps(primary, t) {
    return primary.filter(function (p) { var m = /^CHWP-(\d+)([A-Z])$/.exec(p.tag || ''); return m && Number(m[1]) === t; })
      .map(function (p) { return { tag: p.tag, letter: /([A-Z])$/.exec(p.tag)[1].toLowerCase(), unit: p }; });
  }

  /* ── CH-M-101 ──────────────────────────────────────────────────────────────────────────────────────── */
  var SX = 240, RX = 1000;                    // CHWS / CHWR header columns
  var Y0 = 210, PUMP_DY = 40;                 // first train row (chiller centre), primary pump spacing in a train
  /* stacked value lines sit 17 units apart: chiller-plant.html draws sheet text at 12 px and 1:1 or larger, and a 12 px
     mono line box is ~15.5 px tall, so the old 14-unit stack overlapped by 1.5 px (geometry gate G1) */

  function pid(sp, title) {
    sp = sp || spec(null);
    var chillers = sp.chillers.length ? sp.chillers : [{ tag: 'CH-01', n: 1 }];   // fail-closed sheet: one typical train
    var maxP = 2;
    chillers.forEach(function (c, i) { maxP = Math.max(maxP, trainPumps(sp.primary, tagNo(c.tag, i)).length); });
    var PITCH = 168 + PUMP_DY * (maxP - 2);
    var N = chillers.length, TY = [];
    for (var i = 0; i < N; i++) TY.push(Y0 + PITCH * i);
    var lastBottom = TY[N - 1] + 18 + PUMP_DY * (maxP - 1) + 44;
    var DEC_Y = lastBottom + 60, SEC_Y = DEC_Y + 74;
    var sec = sp.secondary.length ? sp.secondary : [{ tag: 'CHWP-S1', n: 1 }];
    var halls = sp.halls.length ? sp.halls : [{ code: 'A', crah: [] }];
    var COIL_Y = SEC_Y + 104;
    var stackBottom = SEC_Y + 56 * (sec.length - 1) + 24;
    var RET_Y = Math.max(COIL_Y + 66, stackBottom + 30);
    var H = RET_Y + 46;

    var nodes = [
      { id: 'avs', tag: 'AV', sym: 'airVent', x: SX, y: 112, size: 22, tagAt: 'none' },
      { id: 'jhs', sym: 'junction', x: SX, y: 150, dot: false },
      { id: 'tths', tag: 'TT-CHWS', sym: 'instField', x: 290, y: 124, size: 22, inst: 'TT', tagAt: 'right',
        values: [{ k: 't', dx: 14, dy: 18, anchor: 'start', lod: 1, point: 'cooling.chws_c', label: 'CHWS header' }] },
      { id: 'avr', tag: 'AV', sym: 'airVent', x: RX, y: 112, size: 22, tagAt: 'none' },
      { id: 'jhr', sym: 'junction', x: RX, y: 150, dot: false },
      { id: 'tthr', tag: 'TT-CHWR', sym: 'instField', x: 950, y: 124, size: 22, inst: 'TT', tagAt: 'left',
        values: [{ k: 't', dx: -14, dy: 18, anchor: 'end', lod: 1, point: 'cooling.chwr_c', label: 'CHWR header' }] },
      { id: 'jds', sym: 'junction', x: SX, y: DEC_Y }, { id: 'jdr', sym: 'junction', x: RX, y: DEC_Y },
      { id: 'vdec', tag: 'DECOUPLER', sym: 'valveBalancing', x: 620, y: DEC_Y, size: 24, tagAt: 'above' },
      { id: 'jsl', sym: 'junction', x: SX, y: SEC_Y, dot: false }, { id: 'jsl2', sym: 'junction', x: 280, y: SEC_Y },
      { id: 'jsr', sym: 'junction', x: 400, y: SEC_Y },
      { id: 'sref', tag: 'CHWS · SECONDARY', sym: 'offSheet', x: 430, y: SEC_Y - 46, size: 20, rot: 90, tagAt: 'right',
        values: [{ k: 'q', dx: 16, dy: 18, anchor: 'start', lod: 1, point: 'cooling.flow_lps', label: 'IT-reference CHW flow' }] },
      { id: 'jret', sym: 'junction', x: RX, y: RET_Y, dot: false },
      { id: 'jet', sym: 'junction', x: RX, y: RET_Y - 80 },
      { id: 'et', tag: 'ET-01', sym: 'tankExpansion', x: 1050, y: RET_Y - 110, size: 30, tagAt: 'right' }
    ];
    var edges = [
      { id: 'e-avs', from: 'avs.port', to: 'jhs', medium: 'chw', flowOf: 'still' },
      { id: 'e-avr', from: 'avr.port', to: 'jhr', medium: 'chw', flowOf: 'still' },
      { id: 'e-tths', from: [SX, 140], to: 'tths.process', via: [[290, 140]], w: 'inst', medium: 'line' },
      { id: 'e-tthr', from: [RX, 140], to: 'tthr.process', via: [[950, 140]], w: 'inst', medium: 'line' },
      { id: 'e-hs0', from: 'jhs', to: 'js1', medium: 'chw', w: 'main', flowOf: 'still' },
      { id: 'e-hr0', from: 'jr1', to: 'jhr', medium: 'chw', w: 'main', flowOf: 'still' }
    ];

    chillers.forEach(function (c, i) {
      var n = i + 1, y = TY[i], s = y + 18, t = tagNo(c.tag, i), ctag = c.tag || ('CH-' + pad2(t)), pt = 'chiller-plant.' + ctag + '.';
      var pumps = trainPumps(sp.primary, t);
      if (!pumps.length) pumps = [{ tag: 'CHWP-' + pad2(t) + 'A', letter: 'a' }, { tag: 'CHWP-' + pad2(t) + 'B', letter: 'b' }];
      /* chiller and its condenser-water stubs (they continue on CH-M-102) */
      nodes.push({ id: 'ch' + n, tag: c.tag || ('CH-' + pad2(t)), sym: 'chillerWater', x: 560, y: y, size: 72, cls: 'chw-train', label: 'Water-cooled centrifugal chiller · train ' + t, tagAt: 'above',
        values: [{ k: 'st', dx: -44, dy: 44, anchor: 'end', lod: 1 }, { k: 'kw', dx: -44, dy: 61, anchor: 'end', lod: 1, point: pt + 'comp_kw', label: ctag + ' compressor power' },
          { k: 'q', dx: -44, dy: 78, anchor: 'end', lod: 1, point: pt + 'branch_flow_lps', label: ctag + ' branch flow (calc ref)' }] });
      nodes.push({ id: 'cdr' + n, tag: 'CDWR', sym: 'offSheet', x: 474, y: y - 18, size: 20, rot: 180, tagAt: 'above', label: 'Condenser water return to the cooling towers (CH-M-102)',
        values: [{ k: 't', dx: -14, dy: 4, anchor: 'end', lod: 1, point: 'cooling.cdw_return_c', label: 'CDWR' }] });
      nodes.push({ id: 'cds' + n, tag: 'CDWS', sym: 'offSheet', x: 668, y: y - 18, size: 20, tagAt: 'above', label: 'Condenser water supply from the cooling towers (CH-M-102)',
        values: [{ k: 't', dx: 14, dy: 4, anchor: 'start', lod: 1, point: 'cooling.cdw_supply_c', label: 'CDWS' }] });
      edges.push({ id: 'e-cdr' + n, from: 'ch' + n + '.cwOut', to: 'cdr' + n + '.port', medium: 'cw', flowOf: 'cw' + n });
      edges.push({ id: 'e-cds' + n, from: 'cds' + n + '.port', to: 'ch' + n + '.cwIn', medium: 'cw', flowOf: 'cw' + n });
      /* supply leg: evaporator -> TT-n01 -> isolation valve -> CHWS header */
      nodes.push({ id: 'vs' + n, sym: 'valveButterfly', x: 456, y: s, size: 22, tagAt: 'none' });
      nodes.push({ id: 'jts' + n, sym: 'junction', x: 370, y: s, dot: false });
      nodes.push({ id: 'tts' + n, tag: 'TT-' + t + '01', sym: 'instField', x: 370, y: s - 34, size: 22, inst: 'TT', tagAt: 'above',
        values: [{ k: 't', dx: -14, dy: 4, anchor: 'end', lod: 1, point: pt + 'chws_c', label: 'TT-' + t + '01 CHWS ' + ctag, limitsOf: 'cooling.chws_c' }] });
      nodes.push({ id: 'js' + n, sym: 'junction', x: SX, y: s });
      edges.push({ id: 'e-s' + n + 'a', from: 'ch' + n + '.chwOut', to: 'vs' + n + '.b', medium: 'chw', flowOf: 't' + n });
      edges.push({ id: 'e-s' + n + 'b', from: 'vs' + n + '.a', to: 'jts' + n, medium: 'chw', flowOf: 't' + n });
      edges.push({ id: 'e-s' + n, from: 'jts' + n, to: 'js' + n, medium: 'chw', flowOf: 't' + n, line: n === 1 ? 'CHWS' : undefined });
      edges.push({ id: 'e-tts' + n, from: 'jts' + n, to: 'tts' + n + '.process', w: 'inst', medium: 'line' });
      /* return leg: CHWR header -> isolation valve -> TT-n02 -> the train's primary pumps -> evaporator */
      nodes.push({ id: 'jr' + n, sym: 'junction', x: RX, y: s });
      nodes.push({ id: 'vr' + n, sym: 'valveButterfly', x: 950, y: s, size: 22, tagAt: 'none' });
      nodes.push({ id: 'jtr' + n, sym: 'junction', x: 892, y: s, dot: false });
      nodes.push({ id: 'ttr' + n, tag: 'TT-' + t + '02', sym: 'instField', x: 892, y: s - 34, size: 22, inst: 'TT', tagAt: 'above',
        values: [{ k: 't', dx: 14, dy: 4, anchor: 'start', lod: 1, point: pt + 'chwr_c', label: 'TT-' + t + '02 CHWR ' + ctag, limitsOf: 'cooling.chwr_c' }] });
      nodes.push({ id: 'jpr' + n, sym: 'junction', x: 840, y: s });
      nodes.push({ id: 'jpl' + n, sym: 'junction', x: 640, y: s });
      edges.push({ id: 'e-r' + n, from: 'jr' + n, to: 'vr' + n + '.b', medium: 'chw', flowOf: 't' + n, line: n === 1 ? 'CHWR' : undefined });
      edges.push({ id: 'e-r' + n + 'a', from: 'vr' + n + '.a', to: 'jtr' + n, medium: 'chw', flowOf: 't' + n });
      edges.push({ id: 'e-r' + n + 'b', from: 'jtr' + n, to: 'jpr' + n, medium: 'chw', flowOf: 't' + n });
      edges.push({ id: 'e-ttr' + n, from: 'jtr' + n, to: 'ttr' + n + '.process', w: 'inst', medium: 'line' });
      pumps.forEach(function (p, j) {
        var py = s + PUMP_DY * j, id = 'p' + p.letter + n, ck = 'ck' + p.letter + n, first = j === 0;
        nodes.push({ id: id, tag: p.tag, sym: 'pumpCentrifugal', x: 770, y: py, size: 30, rot: 180, cls: 'chw-train', label: 'Primary chilled-water pump ' + p.tag.replace(/^CHWP-/, ''),
          tagAt: first ? 'above' : 'below',
          values: first ? [{ k: 'cmd', dx: 0, dy: -53, lod: 1 }, { k: 'st', dx: 0, dy: -36, lod: 1 }]
            : [{ k: 'cmd', dx: -4, dy: 40, anchor: 'end', lod: 1 }, { k: 'st', dx: 4, dy: 40, anchor: 'start', lod: 1 }] });
        nodes.push({ id: ck, sym: 'valveCheck', x: 700, y: py, size: 20, rot: 180, tagAt: 'none' });
        edges.push({ id: 'e-' + id + 's', from: 'jpr' + n, to: id + '.suction', via: first ? undefined : [[840, py]], medium: 'chw', flowOf: p.letter + n });
        edges.push({ id: 'e-' + id + 'd', from: id + '.discharge', to: ck + '.inlet', medium: 'chw', flowOf: p.letter + n });
        edges.push({ id: 'e-' + id + 'c', from: ck + '.outlet', to: 'jpl' + n, via: first ? undefined : [[640, py]], medium: 'chw', flowOf: p.letter + n });
      });
      edges.push({ id: 'e-ev' + n, from: 'jpl' + n, to: 'ch' + n + '.chwIn', medium: 'chw', flowOf: 't' + n });
      if (n < N) {
        edges.push({ id: 'e-hs' + n, from: 'js' + n, to: 'js' + (n + 1), medium: 'chw', w: 'main', flowOf: 'hdr' });
        edges.push({ id: 'e-hr' + n, from: 'jr' + (n + 1), to: 'jr' + n, medium: 'chw', w: 'main', flowOf: 'hdr' });
      }
    });

    edges.push(
      { id: 'e-hs' + N, from: 'js' + N, to: 'jds', medium: 'chw', w: 'main', flowOf: 'hdr' },
      { id: 'e-hr' + N, from: 'jdr', to: 'jr' + N, medium: 'chw', w: 'main', flowOf: 'hdr' },
      { id: 'e-dec1', from: 'jds', to: 'vdec.a', medium: 'chw', flowOf: 'dec' },
      { id: 'e-dec2', from: 'vdec.b', to: 'jdr', medium: 'chw', flowOf: 'dec' },
      { id: 'e-sec0', from: 'jds', to: 'jsl', medium: 'chw', w: 'main', flowOf: 'hdr' },
      { id: 'e-sec0b', from: 'jsl', to: 'jsl2', medium: 'chw', w: 'main', flowOf: 'hdr' },
      { id: 'e-sref', from: [430, SEC_Y], to: 'sref.port', medium: 'line', w: 'inst' },
      { id: 'e-et', from: 'jet', to: 'et.port', via: [[1050, RET_Y - 80]], medium: 'chw', flowOf: 'still' },
      { id: 'e-hrEt', from: 'jret', to: 'jet', medium: 'chw', w: 'main', flowOf: 'hdr' },
      { id: 'e-hrDec', from: 'jet', to: 'jdr', medium: 'chw', w: 'main', flowOf: 'hdr' }
    );
    /* secondary pump set: one pump per unit of the engine's secondary fleet, in parallel between the suction and
       discharge manifolds */
    sec.forEach(function (u, k) {
      var id = 'ps' + (k + 1), py = SEC_Y + 56 * k;
      nodes.push({ id: id, tag: u.tag, sym: 'pumpCentrifugal', x: 340, y: py, size: 30, cls: 'chw-sec', label: 'Secondary chilled-water pump ' + (k + 1), tagAt: 'above',
        values: [{ k: 'st', dx: 20, dy: 16, anchor: 'start', lod: 1 }] });
      edges.push({ id: 'e-s' + (k + 1) + 's', from: 'jsl2', to: id + '.suction', via: k ? [[280, py]] : undefined, medium: 'chw', flowOf: 's' + (k + 1) });
      edges.push({ id: 'e-s' + (k + 1) + 'd', from: id + '.discharge', to: 'jsr', via: k ? [[400, py]] : undefined, medium: 'chw', flowOf: 's' + (k + 1) });
    });

    /* one typical CRAH coil bank per hall, labelled with the hall's fleet (× installed · running) */
    var prevS = 'jsr', prevR = null;
    halls.forEach(function (hh, i) {
      var h = hh.code, x = 500 + 140 * i, hs = 'jhs' + h, hr = 'jhr' + h, last = i === halls.length - 1;
      nodes.push({ id: hs, sym: 'junction', x: x - 40, y: SEC_Y, dot: !last });
      nodes.push({ id: hr, sym: 'junction', x: x + 12, y: RET_Y, dot: i > 0 });
      nodes.push({ id: 'crah' + h, tag: 'CRAH-' + h, sym: 'coolingCoil', x: x, y: COIL_Y, size: 48, cls: 'chw-hall', label: 'Hall ' + h + ' CRAH bank · typical chilled-water coil of the hall fleet', tagAt: 'right',
        values: [{ k: 'n', dx: -30, dy: -66, anchor: 'start', lod: 1 }, { k: 'it', dx: -30, dy: -49, anchor: 'start', lod: 1, point: 'chiller-plant.hall-' + h + '.it_kw', label: 'Hall ' + h + ' IT load' },
          { k: 'air', dx: -30, dy: -32, anchor: 'start', lod: 1, point: 'chiller-plant.CRAH-' + h + '.supply_air_c', label: 'CRAH-' + h + ' supply air (supply / return)', limitsOf: 'cooling.crah_supply_air_c' }] });
      edges.push({ id: 'e-hs' + h, from: prevS, to: hs, medium: 'chw', w: 'main', flowOf: 'hdr', line: i === 0 ? 'CHWS · HALLS' : undefined });
      /* PRD-CONV-OPS-DEPTH 01 P3: the bank's pressure-independent control valve on its return leg; opening = coil flow share */
      nodes.push({ id: 'pv' + h, tag: 'PICV-' + h, sym: 'valveControlMotor', x: x + 12, y: COIL_Y + 50, size: 20, rot: 90, tagAt: 'right',   /* values render only with a tag (rz-hmi-sheet) */
        label: 'Hall ' + h + ' CRAH bank pressure-independent control valve',
        values: [{ k: 'op', dx: 14, dy: 20, anchor: 'start', lod: 1, point: 'cooling.crah_valve_open_pct', label: 'PICV-' + h + ' opening' }] });
      if (last) {
        /* MV-01: the minimum-flow bypass from the end of the supply header to the return header */
        nodes.push({ id: 'jbs', sym: 'junction', x: x - 40, y: COIL_Y + 40 });
        nodes.push({ id: 'mv01', tag: 'MV-01', sym: 'valveControlMotor', x: x - 40, y: COIL_Y + 100, size: 22, rot: 90, tagAt: 'left',
          label: 'Minimum-flow bypass valve: opens when the load flow falls below the running chillers\' minimum evaporator flow',
          values: [{ k: 'op', dx: -14, dy: 18, anchor: 'end', lod: 1, point: 'cooling.chw_bypass_open_pct', label: 'MV-01 opening' }] });
        nodes.push({ id: 'jbr', sym: 'junction', x: x - 40, y: RET_Y });
        edges.push({ id: 'e-c' + h + 's', from: hs, to: 'jbs', medium: 'chw', flowOf: 'hall' + h });
        edges.push({ id: 'e-c' + h + 's2', from: 'jbs', to: 'crah' + h + '.waterIn', via: [[x - 12, COIL_Y + 40]], medium: 'chw', flowOf: 'hall' + h });
        edges.push({ id: 'e-bp1', from: 'jbs', to: 'mv01.a', medium: 'chw', flowOf: 'bypass' });
        edges.push({ id: 'e-bp2', from: 'mv01.b', to: 'jbr', medium: 'chw', flowOf: 'bypass' });
      } else {
        edges.push({ id: 'e-c' + h + 's', from: hs, to: 'crah' + h + '.waterIn', via: [[x - 40, COIL_Y + 40], [x - 12, COIL_Y + 40]], medium: 'chw', flowOf: 'hall' + h });
      }
      edges.push({ id: 'e-c' + h + 'r', from: 'crah' + h + '.waterOut', to: 'pv' + h + '.a', medium: 'chw', flowOf: 'hall' + h });
      edges.push({ id: 'e-c' + h + 'r2', from: 'pv' + h + '.b', to: hr, medium: 'chw', flowOf: 'hall' + h });
      if (prevR && last) {
        edges.push({ id: 'e-hr' + h, from: prevR, to: 'jbr', medium: 'chw', w: 'main', flowOf: 'hdr' });
        edges.push({ id: 'e-hr' + h + 'b', from: 'jbr', to: hr, medium: 'chw', w: 'main', flowOf: 'hdr' });
      } else if (prevR) edges.push({ id: 'e-hr' + h, from: prevR, to: hr, medium: 'chw', w: 'main', flowOf: 'hdr' });
      prevS = hs; prevR = hr;
    });
    edges.push({ id: 'e-hrRet', from: prevR, to: 'jret', medium: 'chw', w: 'main', flowOf: 'hdr', line: 'CHWR · HALLS' });

    /* PRD-SETPOINT-SIM P4: the control loops of this sheet as ISA-5.1 bubbles, from the control registry
       (RZControlPoints.loops); a tag is never typed here, and a registry loop this sheet cannot place is not drawn
       (tools/test-setpoint-sim.mjs S8 fails on it). PDT-01 reads the CHWS-CHWR differential at the most remote CRAH
       bank (end of the supply header); PDIC-01 beside the secondary pump set drives every pump's VSD. */
    loopsOf('ch-m-101').forEach(function (L) {
      if (L.mv.classKey !== 'chw_secondary_pump' || !L.pv.draw) return;
      var lastH = halls[halls.length - 1].code, PX = 1060, PY = SEC_Y - 34, CX = 170, CY = SEC_Y + 28, BUS = SEC_Y - 64, TX = 228;
      nodes.push({ id: 'lpv-dp', tag: L.pv.tag, sym: 'instField', x: PX, y: PY, size: 40, inst: L.pv.tag.split('-')[0], tagAt: 'above', loop: L.sp,
        label: L.pv.what,
        values: [{ k: 'dp', dx: -14, dy: 22, anchor: 'end', lod: 1, point: 'chiller-plant.CHW.remote_dp', label: L.pv.tag + ' remote DP' }] });
      nodes.push({ id: 'lc-dp', tag: L.tag, sym: 'instPanel', x: CX, y: CY, size: 44, inst: L.tag.split('-')[0], tagAt: 'above', loop: L.sp,
        label: L.label + ' controller (' + L.action + ' acting ' + L.kind + ')',
        values: [{ k: 'sp', dx: 0, dy: 34, anchor: 'middle', lod: 1, const: 'setpoint from the control registry (' + L.sp + ')' },
          { k: 'out', dx: 0, dy: 51, anchor: 'middle', lod: 1, point: 'chiller-plant.CHW.sec_pump_speed', label: L.tag + ' output (secondary pump speed)', unit: '%' }] });
      edges.push({ id: 'e-lp-dps', from: 'jhs' + lastH, to: 'lpv-dp.process', via: [[PX, SEC_Y]], w: 'inst', medium: 'line', loop: L.sp });
      edges.push({ id: 'e-lp-dpr', from: [RX, SEC_Y + 22], to: [PX, SEC_Y + 22], w: 'inst', medium: 'line', loop: L.sp });
      edges.push({ id: 'e-lp-dpr2', from: [PX, SEC_Y + 22], to: [PX, SEC_Y], w: 'inst', medium: 'line', loop: L.sp });
      edges.push({ id: 'e-lp-pv', from: [PX - 12, PY - 3], to: [CX - 22, CY], via: [[PX - 34, PY - 3], [PX - 34, BUS], [CX - 40, BUS], [CX - 40, CY]], w: 'signal', medium: 'line', loop: L.sp });
      sec.forEach(function (u, k) {
        var py = SEC_Y + 56 * k;
        edges.push({ id: 'e-lp-mv' + (k + 1), from: [CX + 19, CY - 3], to: [340, py + 10], via: [[TX, CY - 3], [TX, py + 22], [340, py + 22]], w: 'signal', medium: 'line', loop: L.sp });
        nodes.forEach(function (nd) { if (nd.id === 'ps' + (k + 1)) nd.loop = L.sp; });
      });
    });

    /* the drawing starts at the left zone edge: shift everything DX left so the sheet fits a 1440 px panel at 1:1 */
    var DX = 100, sx = function (pt) { return Array.isArray(pt) ? [pt[0] - DX, pt[1]] : pt; };
    nodes.forEach(function (nd) { nd.x -= DX; });
    edges.forEach(function (e) { e.from = sx(e.from); e.to = sx(e.to); if (e.via) e.via = e.via.map(sx); });
    return {
      id: 'ch-m-101', no: 'CH-M-101', title: title || 'CHILLED WATER · PRIMARY · DISTRIBUTION', rev: 'B', basis: 'ISA-5.1 · ISO 10628',
      svgId: 'pidSvg', size: [1020, H], minScale: 1, nodes: nodes, edges: edges,
      areas: [
        { x: 6, y: 60, w: 1004, h: lastBottom + 14 - 60, label: 'PRIMARY · ' + N + ' TRAINS', kind: 'zone' },
        { x: 6, y: DEC_Y - 40, w: 1004, h: RET_Y + 30 - (DEC_Y - 40), label: 'DISTRIBUTION', kind: 'zone' }
      ],
      /* R144 dropped the in-drawing title block, so a fail-closed sheet says so inside the drawing itself */
      notes: title ? [{ text: title, x: 510, y: 40, anchor: 'middle', role: 'tag' }] : [],
      halls: halls.map(function (h) { return h.code; }), trains: N
    };
  }

  /* ── CH-M-102 ──────────────────────────────────────────────────────────────────────────────────────── */
  var X0 = 150, CP = 87;                      // first cell column, column pitch
  var HR = 136, TY2 = 236, HS = 336, PY = 410, OY = 478;   // CDWR header, tower row, CDWS header, pump row, off-sheet row

  function cdw(sp, title) {
    sp = sp || spec(null);
    var cells = sp.cells.length ? sp.cells : [{ tag: 'CT-01', n: 1 }];
    var pumps = sp.cdw.length ? sp.cdw : [{ tag: 'CDWP-01', n: 1 }];
    var cols = Math.max(cells.length, pumps.length), W = X0 + CP * (cols - 1) + 92;   /* 1025 for 10 columns: fits the 1440 panel at 1:1, nothing clipped */
    var lastX = X0 + CP * (cols - 1);
    var nodes = [
      { id: 'rin', tag: 'CDWR', sym: 'offSheet', x: 46, y: HR, size: 20, rot: 180, tagAt: 'above', label: 'Condenser water return from the chiller condensers (CH-M-101)',
        values: [{ k: 'r', dx: -30, dy: 26, anchor: 'start', lod: 1, point: 'cooling.tower_rejection_kw_th', label: 'Heat rejected Σ running cells' },
          { k: 'q', dx: -30, dy: 42, anchor: 'start', lod: 1, point: 'chiller-plant.CDW.flow_lps', label: 'CDW flow Σ running pumps' }] },
      { id: 'jrin', sym: 'junction', x: 100, y: HR, dot: false },
      { id: 'ttcr', tag: 'TT-CDWR', sym: 'instField', x: 100, y: HR - 50, size: 22, inst: 'TT', tagAt: 'right',
        values: [{ k: 't', dx: 15, dy: 20, anchor: 'start', lod: 1, point: 'cooling.cdw_return_c', label: 'TT-CDWR' }] },
      { id: 'jcs0', sym: 'junction', x: 124, y: HS, dot: false },
      { id: 'ttcs', tag: 'TT-CDWS', sym: 'instField', x: 124, y: HS + 52, size: 22, inst: 'TT', tagAt: 'left',
        values: [{ k: 't', dx: -15, dy: 20, anchor: 'end', lod: 1, point: 'cooling.cdw_supply_c', label: 'TT-CDWS' }] }
    ];
    var edges = [
      { id: 'e-rin', from: 'rin.port', to: 'jrin', medium: 'cw', w: 'main', flowOf: 'cdwr' },
      { id: 'e-ttcr', from: 'jrin', to: 'ttcr.process', w: 'inst', medium: 'line' },
      { id: 'e-ttcs', from: 'jcs0', to: 'ttcs.process', w: 'inst', medium: 'line' }
    ];
    var prevR = 'jrin', prevS = 'jcs0';
    for (var i = 0; i < cols; i++) {
      var x = X0 + CP * i, n = i + 1, c = cells[i], p = pumps[i];
      if (c) {
        /* cell: hot water from the CDWR header into the distribution at the top, cold water out of the basin */
        nodes.push({ id: 'jr' + n, sym: 'junction', x: x + 40, y: HR, dot: i < cells.length - 1 });
        nodes.push({ id: 'ct' + n, tag: c.tag, sym: 'coolingTowerCell', x: x, y: TY2, size: 52, cls: 'cdw-cell', label: 'Induced-draft cooling tower cell ' + c.tag, tagAt: 'above',
          values: [{ k: 'st', dx: -4, dy: 43, lod: 1, point: 'chiller-plant.' + c.tag + '.load_pct', label: c.tag + ' load' },
            { k: 'q', dx: -4, dy: 59, lod: 1, point: 'chiller-plant.' + c.tag + '.rejection_kw_th', label: c.tag + ' heat rejected' },
            { k: 'fan', dx: -4, dy: 75, lod: 1, point: 'chiller-plant.' + c.tag + '.fan_kw', label: c.tag + ' fan power' }] });
        nodes.push({ id: 'jb' + n, sym: 'junction', x: x + 40, y: HS });
        edges.push({ id: 'e-crh' + n, from: prevR, to: 'jr' + n, medium: 'cw', w: 'main', flowOf: 'cdwr', line: i === 0 ? 'CDWR' : undefined });
        edges.push({ id: 'e-ct' + n + 'i', from: 'jr' + n, to: 'ct' + n + '.hotIn', via: [[x + 40, TY2 - 13]], medium: 'cw', flowOf: 'ct' + n });
        edges.push({ id: 'e-ct' + n + 'o', from: 'ct' + n + '.basinOut', to: 'jb' + n, via: [[x + 40, TY2 + 19.5]], medium: 'cw', flowOf: 'ct' + n });
        prevR = 'jr' + n;
      }
      if (p) {
        /* condenser-water pump: CDWS header -> pump -> its chiller's condenser (off-sheet) */
        var ch = (sp.chillers[i] && sp.chillers[i].tag) || ('CH-' + pad2(i + 1));
        nodes.push({ id: 'jp' + n, sym: 'junction', x: x, y: HS });
        nodes.push({ id: 'cp' + n, tag: p.tag, sym: 'pumpCentrifugal', x: x, y: PY, size: 30, rot: 90, cls: 'cdw-pump', label: 'Condenser-water pump ' + p.tag + ' · serves ' + ch, tagAt: 'right',
          values: [{ k: 'st', dx: 16, dy: 20, anchor: 'start', lod: 1 }, { k: 'q', dx: 16, dy: 36, anchor: 'start', lod: 1, point: 'chiller-plant.' + p.tag + '.flow_lps', label: p.tag + ' flow' }] });
        nodes.push({ id: 'to' + n, tag: ch + ' COND', sym: 'offSheet', x: x, y: OY, size: 20, rot: 90, tagAt: 'below', label: 'Condenser water supply to ' + ch + ' (CH-M-101)' });
        edges.push({ id: 'e-cp' + n + 's', from: 'jp' + n, to: 'cp' + n + '.suction', medium: 'cw', flowOf: 'cp' + n });
        edges.push({ id: 'e-cp' + n + 'd', from: 'cp' + n + '.discharge', to: 'to' + n + '.port', medium: 'cw', flowOf: 'cp' + n });
        edges.push({ id: 'e-cs' + n + 'p', from: prevS, to: 'jp' + n, medium: 'cw', w: 'main', flowOf: 'cdws', line: i === 0 ? 'CDWS' : undefined });
        prevS = 'jp' + n;
      }
      if (c) { edges.push({ id: 'e-cs' + n + 'b', from: prevS, to: 'jb' + n, medium: 'cw', w: 'main', flowOf: 'cdws' }); prevS = 'jb' + n; }
    }
    /* PRD-CONV-OPS-DEPTH 01 P3: TV-01, the 3-way tower bypass at the end of the CDWR header. Port b (through) feeds
       the cells, port c sends water straight to the CDWS header so the entering condenser water stays above the
       chillers' minimum when the towers make it too cold (B share from the engine) */
    if (cells.length) {
      var tvx = lastX + 58;   /* tag centred above stays inside the tower zone's right border (lastX + 78) */
      nodes.push({ id: 'tv01', tag: 'TV-01', sym: 'valve3WayMotor', x: tvx, y: HR, size: 24, tagAt: 'above',
        label: 'Three-way tower bypass valve (A to the cells, B to the CDWS header)',
        values: [{ k: 'op', dx: -22, dy: -8, anchor: 'end', lod: 1, point: 'cooling.cdw_bypass_x_pct', label: 'TV-01 bypass (B port)' }] });   /* above the header, clear of CT-10's riser */
      nodes.push({ id: 'jtv', sym: 'junction', x: tvx, y: HS });
      edges.push({ id: 'e-tv0', from: prevR, to: 'tv01.a', medium: 'cw', w: 'main', flowOf: 'cdwr' });
      edges.push({ id: 'e-tvb', from: 'tv01.c', to: 'jtv', medium: 'cw', flowOf: 'tvb' });
      edges.push({ id: 'e-tvs', from: 'jtv', to: prevS, medium: 'cw', flowOf: 'tvb' });
    }
    /* PRD-SETPOINT-SIM P4: TIC-CDWS (registry loop) in the free left column: PV from TT-CDWS, output to every tower
       cell's fan drive over a signal bus above the cell tags */
    loopsOf('ch-m-102').forEach(function (L) {
      if (L.mv.classKey !== 'tower_cell' || L.pv.node !== 'ttcs') return;
      var CX = 52, CY = 236, BUS = 190;
      nodes.push({ id: 'lc-cdw', tag: L.tag, sym: 'instPanel', x: CX, y: CY, size: 44, inst: L.tag.split('-')[0], tagAt: 'above', loop: L.sp,
        label: L.label + ' controller (' + L.action + ' acting ' + L.kind + ')',
        values: [{ k: 'sp', dx: 0, dy: 34, anchor: 'middle', lod: 1, const: 'setpoint from the control registry (' + L.sp + ')' },
          { k: 'out', dx: 0, dy: 51, anchor: 'middle', lod: 1, point: 'chiller-plant.CDW.tower_fan_speed', label: L.tag + ' output (tower fan speed)', unit: '%' }] });
      nodes.forEach(function (nd) { if (nd.id === L.pv.node) nd.loop = L.sp; });
      edges.push({ id: 'e-lp-cpv', from: [131, 386], to: [CX - 13, CY - 3], via: [[138, 386], [138, 327], [14, 327], [14, CY - 3]], w: 'signal', medium: 'line', loop: L.sp });
      cells.forEach(function (c, i) {
        var x = X0 + CP * i;
        edges.push({ id: 'e-lp-cmv' + (i + 1), from: [CX + 13, CY - 3], to: [x - 19, TY2 - 10], via: [[90, CY - 3], [90, BUS], [x - 24, BUS], [x - 24, TY2 - 10]], w: 'signal', medium: 'line', loop: L.sp });
        nodes.forEach(function (nd) { if (nd.id === 'ct' + (i + 1)) nd.loop = L.sp; });
      });
    });
    var H = OY + 64;
    return {
      id: 'ch-m-102', no: 'CH-M-102', title: title || 'CONDENSER WATER AND COOLING TOWERS', rev: 'A', basis: 'ISA-5.1 · ISO 10628',
      svgId: 'cdwSvg', size: [W, H], minScale: 1, nodes: nodes, edges: edges,
      areas: [
        { x: 6, y: 40, w: lastX + 84 - 6, h: HS - 18 - 40, label: 'COOLING TOWER CELLS · ' + cells.length, kind: 'zone' },
        { x: 6, y: HS + 22, w: lastX + 84 - 6, h: H - 8 - (HS + 22), label: 'CDW PUMPS · ' + pumps.length, kind: 'zone' }
      ],
      notes: title ? [{ text: title, x: W / 2, y: 26, anchor: 'middle', role: 'tag' }] : [],
      cells: cells.length, pumps: pumps.length
    };
  }

  function fromEngine(C) {
    var sp = spec(C);
    var out = { spec: sp, pid: pid(sp), cdw: cdw(sp), unavailable: pid(sp, 'CHILLER PLANT AUTHORITY UNAVAILABLE'),
      cdwUnavailable: cdw(sp, 'CONDENSER PLANT AUTHORITY UNAVAILABLE') };
    API.current = out; API.pid = out.pid; API.cdw = out.cdw; API.unavailable = out.unavailable;
    return out;
  }

  var API = { spec: spec, build: pid, condenser: cdw, fromEngine: fromEngine, current: null };
  root.RZChillerSheets = API;
  fromEngine(root.CONV_CALC);
})(typeof window !== 'undefined' ? window : null);
