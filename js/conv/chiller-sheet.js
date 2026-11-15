/*
 * chiller-sheet.js — CH-M-101, the chilled-water plant P&ID for chiller-plant.html, drawn by
 * js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js (ISO 10628-2 / ISA-5.1).
 *
 * Geometry only. Every number on the sheet comes from the page's read() (engine values,
 * identities over them, or declared simulated machine state) — none is authored here.
 *
 *   Primary: 4 drawn trains (of the engine's running set). Each: water-cooled chiller CH-0n,
 *   CHW leaves the evaporator left through TT-n01 and an isolation valve into the CHWS header;
 *   CHWR enters from the CHWR header through TT-n02, a duty/standby pump pair CHWP-0nA/B with
 *   check valves, into the evaporator. Condenser water runs to / from the cooling towers
 *   (off-sheet, CT).
 *   Distribution: decoupler between the headers; secondary pumps CHWP-S1/S2; one CRAH coil
 *   bank per hall A-D on the secondary supply, return header back into the CHWR header;
 *   expansion vessel and air vents on the headers.
 */
(function (root) {
  'use strict';
  if (!root) return;

  var SX = 240, RX = 1000;                           // CHWS / CHWR header columns
  var TY = [190, 360, 530, 700];                     // train rows (chiller centre)
  var DEC_Y = 850, SEC_Y = 920, RET_Y = 1080;        // decoupler, secondary supply, hall return
  var HX = [500, 640, 780, 920];                     // hall CRAH coil columns
  var HALLS = ['A', 'B', 'C', 'D'];
  var COIL_Y = 1010;

  var nodes = [
    /* header tops: air vents and the header temperature transmitters */
    { id: 'avs', tag: 'AV', sym: 'airVent', x: SX, y: 112, size: 22, tagAt: 'none' },
    { id: 'jhs', sym: 'junction', x: SX, y: 150, dot: false },
    { id: 'tths', tag: 'TT-CHWS', sym: 'instField', x: 290, y: 128, size: 22, inst: 'TT', tagAt: 'right',
      values: [{ k: 't', dx: 14, dy: 17, anchor: 'start', lod: 1 }] },
    { id: 'avr', tag: 'AV', sym: 'airVent', x: RX, y: 112, size: 22, tagAt: 'none' },
    { id: 'jhr', sym: 'junction', x: RX, y: 150, dot: false },
    { id: 'tthr', tag: 'TT-CHWR', sym: 'instField', x: 950, y: 128, size: 22, inst: 'TT', tagAt: 'left',
      values: [{ k: 't', dx: -14, dy: 17, anchor: 'end', lod: 1 }] },
    /* decoupler */
    { id: 'jds', sym: 'junction', x: SX, y: DEC_Y }, { id: 'jdr', sym: 'junction', x: RX, y: DEC_Y },
    { id: 'vdec', tag: 'DECOUPLER', sym: 'valveBalancing', x: 620, y: DEC_Y, size: 24, tagAt: 'above' },
    /* secondary pump set */
    { id: 'jsl', sym: 'junction', x: SX, y: SEC_Y, dot: false }, { id: 'jsl2', sym: 'junction', x: 280, y: SEC_Y },
    { id: 'jsr', sym: 'junction', x: 400, y: SEC_Y },
    { id: 'ps1', tag: 'CHWP-S1', sym: 'pumpCentrifugal', x: 340, y: SEC_Y, size: 30, cls: 'chw-sec', label: 'Secondary chilled-water pump 1', tagAt: 'above',
      values: [{ k: 'st', dx: 0, dy: -34, lod: 1 }] },
    { id: 'ps2', tag: 'CHWP-S2', sym: 'pumpCentrifugal', x: 340, y: SEC_Y + 44, size: 30, cls: 'chw-sec', label: 'Secondary chilled-water pump 2', tagAt: 'below',
      values: [{ k: 'st', dx: 0, dy: 40, lod: 1 }] },
    { id: 'sref', tag: 'CHWS · SECONDARY', sym: 'offSheet', x: 430, y: SEC_Y - 44, size: 20, rot: 90, tagAt: 'right',
      values: [{ k: 'q', dx: 16, dy: 17, anchor: 'start', lod: 1 }] },
    /* return header: expansion vessel */
    { id: 'jret', sym: 'junction', x: RX, y: RET_Y, dot: false },
    { id: 'jet', sym: 'junction', x: RX, y: 1000 },
    { id: 'et', tag: 'ET-01', sym: 'tankExpansion', x: 1050, y: 970, size: 30, tagAt: 'right' }
  ];
  var edges = [
    { id: 'e-avs', from: 'avs.port', to: 'jhs', medium: 'chw', flowOf: 'still' },
    { id: 'e-avr', from: 'avr.port', to: 'jhr', medium: 'chw', flowOf: 'still' },
    { id: 'e-tths', from: [SX, 140], to: 'tths.process', via: [[290, 140]], w: 'inst', medium: 'line' },
    { id: 'e-tthr', from: [RX, 140], to: 'tthr.process', via: [[950, 140]], w: 'inst', medium: 'line' },
    { id: 'e-hs0', from: 'jhs', to: 'js1', medium: 'chw', w: 'main', flowOf: 'still' },
    { id: 'e-hr0', from: 'jr1', to: 'jhr', medium: 'chw', w: 'main', flowOf: 'still' }
  ];

  TY.forEach(function (y, i) {
    var n = i + 1, s = y + 18, b = y + 58;
    /* chiller and its condenser-water stubs */
    nodes.push({ id: 'ch' + n, tag: 'CH-0' + n, sym: 'chillerWater', x: 560, y: y, size: 72, cls: 'chw-train', label: 'Water-cooled centrifugal chiller · train ' + n, tagAt: 'above',
      values: [{ k: 'st', dx: -44, dy: 42, anchor: 'end', lod: 1 }, { k: 'kw', dx: -44, dy: 54, anchor: 'end', lod: 1 }, { k: 'q', dx: -44, dy: 66, anchor: 'end', lod: 1 }] });
    nodes.push({ id: 'cdr' + n, tag: 'CDWR', sym: 'offSheet', x: 474, y: y - 18, size: 20, rot: 180, tagAt: 'above', values: [{ k: 't', dx: -14, dy: 4, anchor: 'end', lod: 1 }] });
    nodes.push({ id: 'cds' + n, tag: 'CDWS', sym: 'offSheet', x: 668, y: y - 18, size: 20, tagAt: 'above', values: [{ k: 't', dx: 14, dy: 4, anchor: 'start', lod: 1 }] });
    edges.push({ id: 'e-cdr' + n, from: 'ch' + n + '.cwOut', to: 'cdr' + n + '.port', medium: 'cw', flowOf: 'cw' + n });
    edges.push({ id: 'e-cds' + n, from: 'cds' + n + '.port', to: 'ch' + n + '.cwIn', medium: 'cw', flowOf: 'cw' + n });
    /* supply leg: evaporator -> TT-n01 -> isolation valve -> CHWS header */
    nodes.push({ id: 'vs' + n, sym: 'valveButterfly', x: 456, y: s, size: 22, tagAt: 'none' });
    nodes.push({ id: 'jts' + n, sym: 'junction', x: 370, y: s, dot: false });
    nodes.push({ id: 'tts' + n, tag: 'TT-' + n + '01', sym: 'instField', x: 370, y: s - 34, size: 22, inst: 'TT', tagAt: 'above',
      values: [{ k: 't', dx: -14, dy: 4, anchor: 'end', lod: 1 }] });
    nodes.push({ id: 'js' + n, sym: 'junction', x: SX, y: s });
    edges.push({ id: 'e-s' + n + 'a', from: 'ch' + n + '.chwOut', to: 'vs' + n + '.b', medium: 'chw', flowOf: 't' + n });
    edges.push({ id: 'e-s' + n + 'b', from: 'vs' + n + '.a', to: 'jts' + n, medium: 'chw', flowOf: 't' + n });
    edges.push({ id: 'e-s' + n, from: 'jts' + n, to: 'js' + n, medium: 'chw', flowOf: 't' + n, line: n === 1 ? 'CHWS' : undefined });
    edges.push({ id: 'e-tts' + n, from: 'jts' + n, to: 'tts' + n + '.process', w: 'inst', medium: 'line' });
    /* return leg: CHWR header -> isolation valve -> TT-n02 -> pump pair -> evaporator */
    nodes.push({ id: 'jr' + n, sym: 'junction', x: RX, y: s });
    nodes.push({ id: 'vr' + n, sym: 'valveButterfly', x: 950, y: s, size: 22, tagAt: 'none' });
    nodes.push({ id: 'jtr' + n, sym: 'junction', x: 892, y: s, dot: false });
    nodes.push({ id: 'ttr' + n, tag: 'TT-' + n + '02', sym: 'instField', x: 892, y: s - 34, size: 22, inst: 'TT', tagAt: 'above',
      values: [{ k: 't', dx: 14, dy: 4, anchor: 'start', lod: 1 }] });
    nodes.push({ id: 'jpr' + n, sym: 'junction', x: 840, y: s });
    nodes.push({ id: 'jpl' + n, sym: 'junction', x: 640, y: s });
    nodes.push({ id: 'pa' + n, tag: 'CHWP-0' + n + 'A', sym: 'pumpCentrifugal', x: 770, y: s, size: 30, rot: 180, cls: 'chw-train', label: 'Primary chilled-water pump ' + n + 'A', tagAt: 'above',
      values: [{ k: 'cmd', dx: 0, dy: -46, lod: 1 }, { k: 'st', dx: 0, dy: -34, lod: 1 }] });
    nodes.push({ id: 'pb' + n, tag: 'CHWP-0' + n + 'B', sym: 'pumpCentrifugal', x: 770, y: b, size: 30, rot: 180, cls: 'chw-train', label: 'Primary chilled-water pump ' + n + 'B', tagAt: 'below',
      values: [{ k: 'cmd', dx: -4, dy: 38, anchor: 'end', lod: 1 }, { k: 'st', dx: 4, dy: 38, anchor: 'start', lod: 1 }] });
    nodes.push({ id: 'cka' + n, sym: 'valveCheck', x: 700, y: s, size: 20, rot: 180, tagAt: 'none' });
    nodes.push({ id: 'ckb' + n, sym: 'valveCheck', x: 700, y: b, size: 20, rot: 180, tagAt: 'none' });
    edges.push({ id: 'e-r' + n, from: 'jr' + n, to: 'vr' + n + '.b', medium: 'chw', flowOf: 't' + n, line: n === 1 ? 'CHWR' : undefined });
    edges.push({ id: 'e-r' + n + 'a', from: 'vr' + n + '.a', to: 'jtr' + n, medium: 'chw', flowOf: 't' + n });
    edges.push({ id: 'e-r' + n + 'b', from: 'jtr' + n, to: 'jpr' + n, medium: 'chw', flowOf: 't' + n });
    edges.push({ id: 'e-ttr' + n, from: 'jtr' + n, to: 'ttr' + n + '.process', w: 'inst', medium: 'line' });
    edges.push({ id: 'e-pa' + n + 's', from: 'jpr' + n, to: 'pa' + n + '.suction', medium: 'chw', flowOf: 'a' + n });
    edges.push({ id: 'e-pa' + n + 'd', from: 'pa' + n + '.discharge', to: 'cka' + n + '.inlet', medium: 'chw', flowOf: 'a' + n });
    edges.push({ id: 'e-pa' + n + 'c', from: 'cka' + n + '.outlet', to: 'jpl' + n, medium: 'chw', flowOf: 'a' + n });
    edges.push({ id: 'e-pb' + n + 's', from: 'jpr' + n, to: 'pb' + n + '.suction', via: [[840, b]], medium: 'chw', flowOf: 'b' + n });
    edges.push({ id: 'e-pb' + n + 'd', from: 'pb' + n + '.discharge', to: 'ckb' + n + '.inlet', medium: 'chw', flowOf: 'b' + n });
    edges.push({ id: 'e-pb' + n + 'c', from: 'ckb' + n + '.outlet', to: 'jpl' + n, via: [[640, b]], medium: 'chw', flowOf: 'b' + n });
    edges.push({ id: 'e-ev' + n, from: 'jpl' + n, to: 'ch' + n + '.chwIn', medium: 'chw', flowOf: 't' + n });
    /* headers between trains */
    if (n < 4) {
      edges.push({ id: 'e-hs' + n, from: 'js' + n, to: 'js' + (n + 1), medium: 'chw', w: 'main', flowOf: 'hdr' });
      edges.push({ id: 'e-hr' + n, from: 'jr' + (n + 1), to: 'jr' + n, medium: 'chw', w: 'main', flowOf: 'hdr' });
    }
  });

  edges.push(
    { id: 'e-hs4', from: 'js4', to: 'jds', medium: 'chw', w: 'main', flowOf: 'hdr' },
    { id: 'e-hr4', from: 'jdr', to: 'jr4', medium: 'chw', w: 'main', flowOf: 'hdr' },
    { id: 'e-dec1', from: 'jds', to: 'vdec.a', medium: 'chw', flowOf: 'dec' },
    { id: 'e-dec2', from: 'vdec.b', to: 'jdr', medium: 'chw', flowOf: 'dec' },
    { id: 'e-sec0', from: 'jds', to: 'jsl', medium: 'chw', w: 'main', flowOf: 'hdr' },
    { id: 'e-sec0b', from: 'jsl', to: 'jsl2', medium: 'chw', w: 'main', flowOf: 'hdr' },
    { id: 'e-s1s', from: 'jsl2', to: 'ps1.suction', medium: 'chw', flowOf: 's1' },
    { id: 'e-s1d', from: 'ps1.discharge', to: 'jsr', medium: 'chw', flowOf: 's1' },
    { id: 'e-s2s', from: 'jsl2', to: 'ps2.suction', via: [[280, SEC_Y + 44]], medium: 'chw', flowOf: 's2' },
    { id: 'e-s2d', from: 'ps2.discharge', to: 'jsr', via: [[400, SEC_Y + 44]], medium: 'chw', flowOf: 's2' },
    { id: 'e-sref', from: [430, SEC_Y], to: 'sref.port', medium: 'line', w: 'inst' },
    { id: 'e-et', from: 'jet', to: 'et.port', via: [[1050, 1000]], medium: 'chw', flowOf: 'still' },
    { id: 'e-hr5', from: 'jret', to: 'jet', medium: 'chw', w: 'main', flowOf: 'hdr' },
    { id: 'e-hr6', from: 'jet', to: 'jdr', medium: 'chw', w: 'main', flowOf: 'hdr' }
  );

  var prevS = 'jsr', prevR = null;
  HX.forEach(function (x, i) {
    var h = HALLS[i], hs = 'jhs' + h, hr = 'jhr' + h, last = i === HX.length - 1;
    nodes.push({ id: hs, sym: 'junction', x: x - 40, y: SEC_Y, dot: !last });
    nodes.push({ id: hr, sym: 'junction', x: x + 12, y: RET_Y, dot: i > 0 });
    nodes.push({ id: 'crah' + h, tag: 'CRAH-' + h, sym: 'coolingCoil', x: x, y: COIL_Y, size: 48, cls: 'chw-hall', label: 'Hall ' + h + ' CRAH bank · chilled-water coil', tagAt: 'right',
      values: [{ k: 'it', dx: -2, dy: -58, lod: 1 }, { k: 'n', dx: -2, dy: -46, lod: 1 }, { k: 'air', dx: -2, dy: -34, lod: 1 }] });
    edges.push({ id: 'e-hs' + h, from: prevS, to: hs, medium: 'chw', w: 'main', flowOf: 'hdr', line: i === 0 ? 'CHWS · HALLS' : undefined });
    edges.push({ id: 'e-c' + h + 's', from: hs, to: 'crah' + h + '.waterIn', via: [[x - 40, 1050], [x - 12, 1050]], medium: 'chw', flowOf: 'hall' + h });
    edges.push({ id: 'e-c' + h + 'r', from: 'crah' + h + '.waterOut', to: hr, medium: 'chw', flowOf: 'hall' + h });
    if (prevR) edges.push({ id: 'e-hr' + h, from: prevR, to: hr, medium: 'chw', w: 'main', flowOf: 'hdr' });
    prevS = hs; prevR = hr;
  });
  edges.push({ id: 'e-hrD2', from: prevR, to: 'jret', medium: 'chw', w: 'main', flowOf: 'hdr', line: 'CHWR · HALLS' });

  function sheet(title) {
    return {
      id: 'ch-m-101', no: 'CH-M-101', title: title || 'CHILLED WATER · PRIMARY · DISTRIBUTION', rev: 'A', basis: 'ISA-5.1 · ISO 10628',
      svgId: 'pidSvg', size: [1120, 1190], nodes: nodes, edges: edges,
      areas: [
        { x: 100, y: 60, w: 1000, h: 750, label: 'PRIMARY · TRAINS 1–4', kind: 'zone' },
        { x: 100, y: 820, w: 1000, h: 290, label: 'DISTRIBUTION · HALLS', kind: 'zone' }
      ],
      /* R144 dropped the in-drawing title block, so a fail-closed sheet says so inside the drawing itself */
      notes: title ? [{ text: title, x: 600, y: 40, anchor: 'middle', role: 'tag' }] : []
    };
  }

  root.RZChillerSheets = { pid: sheet(), unavailable: sheet('CHILLER PLANT AUTHORITY UNAVAILABLE'), halls: HALLS.slice() };
})(typeof window !== 'undefined' ? window : null);
