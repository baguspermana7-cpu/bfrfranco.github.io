/*
 * hmi-sheets.js — the datahallAI drawing sheets as data, built from the engine snapshot (R128 PRD §6–§7).
 * One builder per sheet; every count (CDUs, pumps duty+standby, transformers, UPS frames …) is read from the
 * DCAI snapshot, so no number is typed into a drawing. Output = sheet JSON v1 for js/rz-hmi-sheet.js.
 *
 *   RZDatahallAISheets.build('dh-m-103', snapshot)          // CDU line, DH-01
 *   RZDatahallAISheets.build('cdu', snapshot, {id: '07'})    // one CDU in full, with its neighbours (L3 modal)
 *   RZDatahallAISheets.build('dh-e-101', snapshot)          // DH-01 single-line diagram, feeds A and B
 *   RZDatahallAISheets.build('dh-r-101', snapshot)          // GB300 NVL72 rack, front + rear elevation
 *   RZDatahallAISheets.list()
 * UMD (browser global + module.exports) so tools/test-dh-sheets.mjs asserts the same geometry the page draws.
 */
(function (root) {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function get(o, path) { return path.split('.').reduce(function (a, k) { return a && a[k] != null ? a[k] : null; }, o); }
  function need(snap, path) {
    var v = get(snap, path);
    if (v == null) throw new Error('hmi-sheets: snapshot has no ' + path);
    return v;
  }
  function Sheet(meta) {
    var s = { id: meta.id, no: meta.no, title: meta.title, rev: 'A', sheet: meta.sheet || '1/1', basis: meta.basis || 'DCAI engine', size: meta.size,
      svgId: meta.svgId, nodes: [], edges: [], areas: [], notes: [] };
    s.n = function (o) { s.nodes.push(o); return o.id; };
    s.j = function (id, x, y, dot) { s.nodes.push({ id: id, sym: 'junction', x: x, y: y, dot: dot }); return id; };
    s.e = function (from, to, medium, o) { var e = { from: from, to: to, medium: medium }; for (var k in o || {}) e[k] = o[k]; s.edges.push(e); return e; };
    s.chain = function (refs, medium, o) { for (var i = 1; i < refs.length; i++) s.e(refs[i - 1], refs[i], medium, o); };
    return s;
  }
  function finish(s) { delete s.n; delete s.j; delete s.e; delete s.chain; return s; }

  /* ── one CDU drawn in full: primary (HTW) side, plate HX, secondary pumps duty+standby, TCS out/in ──────────── */
  function cduDetail(s, o) {
    var id = o.id, X = o.x, Y = o.y, pumps = o.pumps, t = function (k) { var m = /^([A-Z]+)(\d*)$/.exec(k); return m[1] + '-' + id + m[2]; };
    var P = 'cdu' + id + '.';
    var hx = s.n({ id: P + 'hx', tag: 'HX-' + id, sym: 'hxPlate', x: X + 220, y: Y + 270, size: 64, cls: 'cdu', eqId: id, label: 'CDU-' + id + ' plate heat exchanger',
      values: [{ k: 'duty', dx: 0, dy: 56, anchor: 'middle', lod: 1 }] });
    // primary supply: header tee -> isolation -> strainer -> flow element -> HX hot in
    var ps = s.n({ id: P + 'v1', tag: t('V1'), sym: 'valveBall', x: X + 80, y: Y + 60, size: 26, rot: 90, tagAt: 'left', lod: 3 });
    var st = s.n({ id: P + 'str1', tag: t('STR1'), sym: 'strainerY', x: X + 80, y: Y + 120, size: 28, rot: 90, tagAt: 'left', lod: 3 });
    var fe = s.n({ id: P + 'fe1', tag: t('FE1'), sym: 'flowMeter', x: X + 80, y: Y + 180, size: 26, rot: 90, tagAt: 'left', lod: 3 });
    s.e(o.hsIn, ps + '.a', 'htw', { w: 'branch' });
    s.chain([ps + '.b', st + '.inlet'], 'htw'); s.chain([st + '.outlet', fe + '.a'], 'htw');
    s.e(fe + '.b', hx + '.hotIn', 'htw', { vfirst: true, line: 'HTW-150-SS-' + id + '1' });
    // primary return: HX hot out -> control valve (TIC) -> balancing -> isolation -> header
    var tv = s.n({ id: P + 'tv1', tag: t('TV1'), sym: 'valveControlMotor', x: X + 80, y: Y + 360, size: 30, rot: 90, tagAt: 'left',
      values: [{ k: 'pos', dx: -20, dy: 14, anchor: 'end' }] });
    var bv = s.n({ id: P + 'bv1', tag: t('BV1'), sym: 'valveBalancing', x: X + 80, y: Y + 430, size: 26, rot: 90, tagAt: 'left', lod: 3 });
    var pr = s.n({ id: P + 'v2', tag: t('V2'), sym: 'valveBall', x: X + 80, y: Y + 490, size: 26, rot: 90, tagAt: 'left', lod: 3 });
    s.e(hx + '.hotOut', tv + '.a', 'htw', { line: 'HTW-150-SS-' + id + '2' });
    s.chain([tv + '.b', bv + '.a'], 'htw'); s.chain([bv + '.b', pr + '.a'], 'htw');
    s.e(pr + '.b', o.hrOut, 'htw', { w: 'branch' });
    // instruments on the primary side
    var tt1 = s.n({ id: P + 'tt1', tag: 'TT', sym: 'instField', x: X + 30, y: Y + 76, size: 26, tagAt: 'none', inst: 'TT', label: 'HTW supply temperature, ' + t('TT1') });
    s.e(tt1 + '.process', [X + 80, Y + 89], 'line', { w: 'inst' });
    var tt2 = s.n({ id: P + 'tt2', tag: 'TT', sym: 'instField', x: X + 30, y: Y + 394, size: 26, tagAt: 'none', inst: 'TT', label: 'HTW return temperature, ' + t('TT2') });
    s.e(tt2 + '.process', [X + 80, Y + 407], 'line', { w: 'inst' });
    // secondary: HX cold out -> suction header -> pumps (duty + standby) -> discharge header -> flow -> TCS supply out
    var hdrX = X + 330, disX = X + 570, py0 = Y + 210, pdy = 74, suc = [], dis = [];
    for (var i = 0; i < pumps; i++) {
      var py = py0 + i * pdy, n = i + 1;
      var js = s.j(P + 'js' + n, hdrX, py), jd = s.j(P + 'jd' + n, disX, py);
      suc.push(js); dis.push(jd);
      var vi = s.n({ id: P + 'v3' + n, tag: t('V3' + n), sym: 'valveBall', x: hdrX + 40, y: py, size: 22, tagAt: 'above', lod: 3 });
      var pp = s.n({ id: P + 'p' + n, tag: 'P-' + id + String.fromCharCode(64 + n), sym: 'pumpVfd', x: hdrX + 110, y: py - 5, size: 40, cls: 'cdu-pump', eqId: id + '-' + n,
        label: 'CDU-' + id + ' secondary pump ' + n, tagAt: 'below', values: [{ k: 'p' + n, dx: 0, dy: 44, anchor: 'middle' }] });
      var cv = s.n({ id: P + 'cv' + n, tag: t('CV' + n), sym: 'valveCheck', x: hdrX + 175, y: py, size: 22, tagAt: 'below', lod: 3 });
      var vo = s.n({ id: P + 'v4' + n, tag: t('V4' + n), sym: 'valveBall', x: hdrX + 210, y: py, size: 22, tagAt: 'above', lod: 3 });
      s.e(js, vi + '.a', 'tcs_s'); s.e(vi + '.b', pp + '.suction', 'tcs_s'); s.e(pp + '.discharge', cv + '.inlet', 'tcs_s', { flowOf: pp });
      s.e(cv + '.outlet', vo + '.a', 'tcs_s'); s.e(vo + '.b', jd, 'tcs_s');
    }
    var jsm = s.j(P + 'jsm', hdrX, Y + 254 > py0 ? py0 : Y + 254);
    s.e(hx + '.coldOut', suc[0], 'tcs_s', { line: 'TCS-200-SS-' + id + '1' });
    s.chain(suc, 'tcs_s', { w: 'main' });
    s.chain(dis, 'tcs_s', { w: 'main' });
    var fe2 = s.n({ id: P + 'fe2', tag: t('FE2'), sym: 'flowMeter', x: disX, y: py0 + pumps * pdy + 20, size: 26, rot: 90, tagAt: 'right',
      values: [{ k: 'flow', dx: 18, dy: 14, anchor: 'start' }] });
    s.e(dis[dis.length - 1], fe2 + '.a', 'tcs_s', { w: 'main' });
    s.e(fe2 + '.b', o.tcsOut, 'tcs_s', { w: 'main', vfirst: true, line: 'TCS-200-SS-' + id + '2' });
    var tt3 = s.n({ id: P + 'tt3', tag: 'TT', sym: 'instField', x: disX + 54, y: py0 + pumps * pdy + 50, size: 26, tagAt: 'none', inst: 'TT',
      label: 'TCS supply temperature (controlled), ' + t('TT3'), values: [{ k: 'tcsS', dx: 18, dy: 4, anchor: 'start' }] });
    s.e(tt3 + '.process', [disX, py0 + pumps * pdy + 63], 'line', { w: 'inst' });
    // TIC: TCS supply temperature -> primary control valve (ISA-5.1 electrical signal)
    var tic = s.n({ id: P + 'tic', tag: 'TIC', sym: 'instPanel', x: X + 200, y: Y + 400, size: 28, tagAt: 'none', inst: 'TIC', label: 'TCS supply temperature control, ' + t('TIC1') });
    s.e(tt3 + '.process', tic + '.process', 'line', { w: 'signal', via: [[disX + 54, Y + 444], [X + 200, Y + 444]] });
    s.e(tic + '.process', tv + '.signal', 'line', { w: 'signal', vfirst: true });
    // TCS return in -> expansion vessel tee + air vent -> HX cold in
    var jr = s.j(P + 'jr', X + 300, o.retY), jet = s.j(P + 'jet', X + 260, o.retY);
    var et = s.n({ id: P + 'et', tag: t('ET1'), sym: 'tankExpansion', x: X + 260, y: o.retY - 34, size: 30, tagAt: 'left', lod: 3 });
    var tt4 = s.n({ id: P + 'tt4', tag: 'TT', sym: 'instField', x: X + 360, y: o.retY - 30, size: 26, tagAt: 'none', inst: 'TT',
      label: 'TCS return temperature, ' + t('TT4'), values: [{ k: 'tcsR', dx: 18, dy: 4, anchor: 'start' }] });
    s.e(o.tcsIn, jr, 'tcs_r', { w: 'main', line: 'TCS-200-SS-' + id + '3' });
    s.e(tt4 + '.process', [X + 360, o.retY], 'line', { w: 'inst' });
    s.e(jr, jet, 'tcs_r', { w: 'main' });
    s.e(jet, et + '.port', 'tcs_r');
    s.e(jet, hx + '.coldIn', 'tcs_r', { w: 'main' });
    return { hx: hx, pumps: suc.length };
  }

  /* ── DH-M-103: the CDU line of one hall ───────────────────────────────────────────────────────────── */
  function dhM103(snap) {
    var installed = need(snap, 'equipment.cdu_installed_per_hall'), duty = need(snap, 'equipment.cdu_duty_per_hall');
    var W = 1240, H = 830, s = Sheet({ id: 'dh-m-103', no: 'DH-M-103', title: 'CDU line — Data hall DH-01', size: [W, H], svgId: 'coolSvg', sheet: '3/5' });
    var yS = 40, yR = 740;
    // HTW headers (from / to DH-M-102 pumping)
    var osS = s.n({ id: 'os-hs', tag: 'DH-M-102', sym: 'offSheet', x: 30, y: yS, size: 24, rot: 180, tagAt: 'below', label: 'HTW supply from heat rejection (sheet DH-M-102)' });
    var osR = s.n({ id: 'os-hr', tag: 'DH-M-102', sym: 'offSheet', x: 30, y: yR, size: 24, rot: 0, tagAt: 'above', label: 'HTW return to heat rejection (sheet DH-M-102)' });
    var hs1 = s.j('hs1', 120, yS), hsR = s.j('hs-riser', 706, yS, false);
    var hr1 = s.j('hr1', 120, yR), hrR = s.j('hr-riser', 1214, yR, false);
    s.e(osS + '.port', hs1, 'htw', { w: 'main', line: 'HTW-600-CS-001' }); s.e(hs1, hsR, 'htw', { w: 'main' });
    s.e(hrR, hr1, 'htw', { w: 'main', line: 'HTW-600-CS-002' }); s.e(hr1, osR + '.port', 'htw', { w: 'main' });
    // TCS off-sheet to / from the rack loop
    var osT = s.n({ id: 'os-ts', tag: 'DH-M-104', sym: 'offSheet', x: 640, y: 650, size: 24, tagAt: 'below', label: 'TCS supply to the rack rows (sheet DH-M-104)' });
    var osTr = s.n({ id: 'os-tr', tag: 'DH-M-104', sym: 'offSheet', x: 640, y: 694, size: 24, rot: 180, tagAt: 'below', label: 'TCS return from the rack rows (sheet DH-M-104)' });
    s.areas.push({ x: 18, y: 64, w: 650, h: 660, label: 'CDU-01 · duty · drawn in full', kind: 'box' });
    cduDetail(s, { id: '01', x: 40, y: 40, pumps: 3, hsIn: hs1, hrOut: hr1, tcsOut: osT + '.port', tcsIn: osTr + '.port', retY: 694 });
    // the rest of the line: compact instances on row sub-headers, every one its own item
    var rest = installed - 1, perRow = Math.ceil(rest / 3), x0 = 744, dx = 26, rows = [170, 360, 550];
    s.areas.push({ x: 722, y: 64, w: 508, h: 660, label: 'CDU-02 … CDU-' + pad(installed) + ' · ' + duty + ' duty + ' + (installed - duty) + ' standby', kind: 'box' });
    var k = 2, prevS = hsR;
    rows.forEach(function (ry, r) {
      var ys = ry - 44, yr = ry + 44, rs = s.j('rs' + r, 706, ys), rr = s.j('rr' + r, 1214, yr, false), prev = rs, prevR = null, retJs = [];
      s.e(prevS, rs, 'htw', { w: 'main' }); prevS = rs;
      for (var c = 0; c < perRow && k <= installed; c++, k++) {
        var cx = x0 + c * dx, id = pad(k), standby = k > duty;
        var js = s.j('cs' + id, cx - 9, ys), jr = s.j('cr' + id, cx - 9, yr);
        var hx = s.n({ id: 'cdu' + id, tag: 'CDU-' + id, sym: 'hxPlate', x: cx, y: ry, size: 22, cls: 'cdu', eqId: id, tagAt: 'belowV', lod: 2,
          label: 'CDU-' + id + (standby ? ' (standby)' : ''), standby: standby });
        s.e(prev, js, 'htw'); prev = js;
        s.e(js, hx + '.hotIn', 'htw'); s.e(hx + '.hotOut', jr, 'htw');
        retJs.push(jr);
      }
      for (var q = 0; q < retJs.length; q++) s.e(retJs[q], q + 1 < retJs.length ? retJs[q + 1] : rr, 'htw');
      s.e(rr, r < rows.length - 1 ? 'rr' + (r + 1) : hrR, 'htw', { w: 'main' });
    });
    s.notes.push({ x: 1214, y: 30, text: 'HTW 37 / 45 °C class', role: 'label', anchor: 'end', lod: 2 });
    return finish(s);
  }

  /* ── one CDU as an equipment sheet (L3 modal): itself in full + one hop each way ─────────────────────────── */
  function cduSheet(snap, o) {
    var id = (o && o.id) || '01', W = 720, H = 760;
    var s = Sheet({ id: 'cdu-' + id, no: 'DH-M-103.' + id, title: 'CDU-' + id + ' — coolant distribution unit', size: [W, H] });
    var osS = s.n({ id: 'os-hs', tag: 'HTW SUPPLY', sym: 'offSheet', x: 30, y: 40, size: 22, rot: 180, tagAt: 'below', label: 'HTW supply header (DH-M-103)' });
    var osR = s.n({ id: 'os-hr', tag: 'HTW RETURN', sym: 'offSheet', x: 30, y: 720, size: 22, tagAt: 'above', label: 'HTW return header (DH-M-103)' });
    var hs = s.j('hs', 120, 40), hr = s.j('hr', 120, 720);
    s.e(osS + '.port', hs, 'htw', { w: 'main' }); s.e(hr, osR + '.port', 'htw', { w: 'main' });
    var osT = s.n({ id: 'os-ts', tag: 'RACK ROW', sym: 'offSheet', x: 640, y: 650, size: 24, tagAt: 'below', label: 'TCS supply to the rack row this CDU serves (DH-M-104)' });
    var osTr = s.n({ id: 'os-tr', tag: 'RACK ROW', sym: 'offSheet', x: 640, y: 694, size: 24, rot: 180, tagAt: 'below', label: 'TCS return from the rack row (DH-M-104)' });
    cduDetail(s, { id: id, x: 40, y: 40, pumps: 3, hsIn: hs, hrOut: hr, tcsOut: osT + '.port', tcsIn: osTr + '.port', retY: 694 });
    s.titleblock = false;
    return finish(s);
  }

  /* ── DH-E-101: single-line diagram of one hall, feed A and feed B, unit substation 01 drawn in full ──────── */
  function compactGrid(s, o) {
    // o: {prefix, from, to, x, y, cols, dx, dy, sym, cls, label, medium} — one clickable small symbol per item
    var k = o.from, r = 0, c = 0;
    for (; k <= o.to; k++) {
      var id = o.prefix + pad(k);
      s.n({ id: id.toLowerCase(), tag: id, sym: o.sym, x: o.x + c * o.dx, y: o.y + r * o.dy, size: o.size || 14, cls: o.cls, eqId: id,
        tagAt: 'none', label: o.label + ' ' + id, standby: o.standbyFrom && k >= o.standbyFrom });
      if (++c >= o.cols) { c = 0; r++; }
    }
  }
  function feed(s, f, snap) {
    var A = f.side === 'A', X = f.x, med = A ? 'feed_a' : 'feed_b', L = f.side, tx = need(snap, 'equipment.unit_subs_per_feed_per_hall');
    var halls = 8, upsPerFeed = Math.ceil(need(snap, 'equipment.ups_frames_per_feed') / halls), mx = X + 70;
    var os = s.n({ id: 'os-mv' + L, tag: '20 kV BUS ' + L, sym: 'offSheet', x: mx, y: 26, size: 22, rot: 270, tagAt: 'right', label: '20 kV MV bus ' + L + ' (sheet DH-E-002)' });
    var cbMv = s.n({ id: 'cb-mv' + L, tag: 'Q-MV' + L + '01', sym: 'cbDrawout', x: mx, y: 84, size: 34, cls: 'sld-mv-sub', eqId: L + '01', tagAt: 'right', label: 'MV feeder breaker ' + L + '01' });
    var ct = s.n({ id: 'ct-mv' + L, tag: 'CT', sym: 'currentTransformer', x: mx, y: 128, size: 22, tagAt: 'none', lod: 3, label: 'Current transformer, MV feeder ' + L + '01' });
    var rl = s.n({ id: 'rl-mv' + L, tag: '50/51', sym: 'protectionRelay', x: mx + 46, y: 128, size: 24, tagAt: 'none', inst: '50/51', label: 'Overcurrent relay (IEEE C37.2 50/51), MV feeder ' + L + '01' });
    var t1 = s.n({ id: 'tx' + L + '01', tag: 'TX-' + L + '01', sym: 'transformer2w', x: mx, y: 186, size: 46, cls: 'sld-tx', eqId: L + '01', tagAt: 'right',
      label: 'Unit substation transformer ' + L + '01, 20 / 0.4 kV', values: [{ k: 'load', dx: 30, dy: 16, anchor: 'start' }] });
    var cbLv = s.n({ id: 'cb-lv' + L, tag: 'Q-LV' + L + '01', sym: 'cbDrawout', x: mx, y: 250, size: 32, tagAt: 'right', lod: 2, label: 'LV incomer ' + L + '01 (ACB)' });
    s.chain([os + '.port', cbMv + '.line'], med, { w: 'main' });
    s.e(cbMv + '.load', ct + '.line', med, { w: 'main' }); s.e(ct + '.load', t1 + '.hv', med, { w: 'main', line: 'MV-' + L + '01 3×240 mm² Cu' });
    s.e(ct + '.secondary', rl + '.input', 'line', { w: 'signal' });
    s.e(t1 + '.lv', cbLv + '.line', med, { w: 'main' });
    // MSB busbar
    var by = 300, bL = s.j('msb' + L + 'l', X + 10, by, false), bM = s.j('msb' + L + 'm', mx, by), bU = s.j('msb' + L + 'u', mx + 150, by), bR = s.j('msb' + L + 'r', X + 470, by, false);
    s.e(cbLv + '.load', bM, med, { w: 'main' });
    s.chain(A ? [bL, bM, bU, bR] : [bR, bU, bM, bL].reverse(), med, { w: 'bus' });
    s.notes.push({ x: X + 14, y: by - 6, text: 'MSB-' + L + '01', role: 'tag' });
    // ATS: normal from the MSB, emergency from the generator bus
    var osG = s.n({ id: 'os-gen' + L, tag: 'GEN BUS', sym: 'offSheet', x: mx + 240, y: 330, size: 20, rot: 270, tagAt: 'right', label: 'Standby generator bus (sheet DH-E-003)' });
    var ats = s.n({ id: 'ats' + L, tag: 'ATS-' + L + '01', sym: 'atsIec', x: mx + 162, y: 372, size: 36, cls: 'sld-msb', eqId: L + '01-ats', tagAt: 'right', label: 'Automatic transfer switch ' + L + '01 (CB-N + CB-E, interlocked)' });
    s.e(bU, ats + '.sourceA', med, { w: 'main' });
    s.e(osG + '.port', ats + '.sourceB', 'power', { w: 'main', vfirst: true });
    // UPS-01: input breaker, rectifier, DC link + battery, inverter, static bypass, maintenance bypass, output breaker
    var ux = mx + 150, jIn = s.j('ups' + L + 'in', ux, 420);
    s.e(ats + '.load', jIn, med, { w: 'main' });
    var qi = s.n({ id: 'qi' + L, tag: 'Q1', sym: 'cbIec', x: ux, y: 456, size: 26, tagAt: 'left', lod: 3, label: 'UPS input breaker' });
    var rec = s.n({ id: 'rec' + L, tag: 'REC', sym: 'rectifier', x: ux, y: 504, size: 34, cls: 'sld-ups-' + L.toLowerCase(), eqId: L + '01', tagAt: 'left', lod: 2, label: 'UPS-' + L + '01 rectifier' });
    var jdc = s.j('dc' + L, ux, 548);
    var inv = s.n({ id: 'inv' + L, tag: 'INV', sym: 'inverterIec', x: ux, y: 592, size: 34, cls: 'sld-ups-' + L.toLowerCase(), eqId: L + '01', tagAt: 'left', lod: 2, label: 'UPS-' + L + '01 inverter',
      values: [{ k: 'ups', dx: -24, dy: 4, anchor: 'end', lod: 1 }] });
    var bat = s.n({ id: 'bat' + L, tag: 'BAT-' + L + '01', sym: 'batteryIec', x: ux + 70, y: 590, size: 32, cls: 'battery-string', eqId: L + '01', tagAt: 'right', label: 'Battery string ' + L + '01' });
    var qb = s.n({ id: 'qb' + L, tag: 'QB', sym: 'cbIec', x: ux + 70, y: 548 - 0, size: 22, rot: 90, tagAt: 'above', lod: 3, label: 'Battery breaker' });
    s.e(jIn, qi + '.line', med); s.e(qi + '.load', rec + '.ac', med); s.e(rec + '.dc', jdc, 'dc'); s.e(jdc, inv + '.dc', 'dc');
    s.e(jdc, qb + '.line', 'dc'); s.e(qb + '.load', bat + '.pos', 'dc', { vfirst: false });
    var jOut = s.j('ups' + L + 'out', ux, 650);
    var qo = s.n({ id: 'qo' + L, tag: 'Q2', sym: 'cbIec', x: ux, y: 628, size: 22, tagAt: 'left', lod: 3, label: 'UPS output breaker' });
    s.e(inv + '.ac', qo + '.line', med); s.e(qo + '.load', jOut, med);
    var sbx = ux - 70, ss = s.n({ id: 'ss' + L, tag: 'SS', sym: 'staticSwitch', x: sbx, y: 540, size: 32, tagAt: 'left', lod: 2, label: 'UPS-' + L + '01 static bypass' });
    s.e(jIn, ss + '.line', med, { via: [[sbx, 420]] }); s.e(ss + '.load', jOut, med, { via: [[sbx, 650]] });
    var mbx = ux - 124, mb = s.n({ id: 'mb' + L, tag: 'Q3', sym: 'cbIec', x: mbx, y: 540, size: 26, tagAt: 'left', lod: 3, label: 'Maintenance bypass breaker (normally open)' });
    s.e(jIn, mb + '.line', med, { via: [[mbx, 420]] }); s.e(mb + '.load', jOut, med, { via: [[mbx, 650]] });
    s.areas.push({ x: mbx - 34, y: 404, w: 250, h: 262, label: 'UPS-' + L + '01 · 1 of ' + upsPerFeed, kind: 'box' });
    // UPS output bus -> busway trunk -> tap-off -> rack PSU (the rack is drawn once, between the feeds)
    var oy = 700, oL = s.j('ob' + L + 'l', X + 10, oy, false), oM = s.j('ob' + L + 'm', ux, oy), oR = s.j('ob' + L + 'r', X + 470, oy, false);
    s.e(jOut, oM, med, { w: 'main' }); s.chain(A ? [oL, oM, oR] : [oR, oM, oL].reverse(), med, { w: 'bus' });
    s.notes.push({ x: X + 14, y: oy - 6, text: 'UPS OUT ' + L, role: 'tag' });
    var qbw = s.n({ id: 'qbw' + L, tag: 'Q-BW' + L, sym: 'cbIec', x: ux, y: 736, size: 26, tagAt: 'right', lod: 2, label: 'Busway trunk breaker ' + L });
    var bw = s.j('bw' + L, ux, 790), tap = s.n({ id: 'tap' + L, tag: 'TAP-' + L + '07', sym: 'busTap', x: A ? ux + 120 : ux - 120, y: 822, size: 26, tagAt: 'right', lod: 2, label: 'Busway tap-off to rack R07, feed ' + L });
    s.e(oM, qbw + '.line', med, { w: 'main' }); s.e(qbw + '.load', bw, med, { w: 'bus', line: 'BUSWAY-' + L + ' 5,000 A' });
    var bwEnd = s.j('bwe' + L, A ? X + 470 : X + 10, 790, false), bwt = s.j('bwt' + L, A ? ux + 120 : ux - 120, 790);
    s.e(bw, bwt, med, { w: 'bus' }); s.e(bwt, bwEnd, med, { w: 'bus' }); s.e(bwt, tap + '.bus', med);
    compactGrid(s, { prefix: 'TX-' + L, from: 2, to: tx, x: X + 268, y: 120, cols: 16, dx: 13, dy: 26, sym: 'transformer2w', cls: 'sld-tx', label: 'Unit substation transformer' });
    s.notes.push({ x: X + 262, y: 100, text: 'TX-' + L + '02 … TX-' + L + pad(tx), role: 'label' });
    compactGrid(s, { prefix: 'UPS-' + L, from: 2, to: upsPerFeed, x: X + 290, y: 470, cols: 14, dx: 13, dy: 24, sym: 'inverterIec', cls: 'sld-ups-' + L.toLowerCase(), label: 'UPS frame' });
    s.notes.push({ x: X + 284, y: 450, text: 'UPS-' + L + '02 … UPS-' + L + pad(upsPerFeed), role: 'label' });
    return { tap: tap, busM: bM };
  }
  function dhE101(snap) {
    var W = 1240, H = 1000, s = Sheet({ id: 'dh-e-101', no: 'DH-E-101', title: 'Single-line diagram — Data hall DH-01, feeds A and B', size: [W, H], svgId: 'elecDH1Svg', sheet: '1/8' });
    var a = feed(s, { side: 'A', x: 20 }, snap), b = feed(s, { side: 'B', x: 740 }, snap);
    // bus tie (normally open) between MSB-A01 and MSB-B01
    var tie = s.n({ id: 'tie', tag: 'Q-TIE', sym: 'cbDrawout', x: 620, y: 300, size: 30, rot: 90, tagAt: 'above', label: 'Bus tie MSB-A01 / MSB-B01 (normally open)' });
    s.e('msbAr', tie + '.line', 'power', { w: 'main' }); s.e(tie + '.load', 'msbBl', 'power', { w: 'main' });
    // the rack: one dual-corded PSU shelf group fed by both taps
    var psu = s.n({ id: 'psu-r07', tag: 'R07 PSU', sym: 'psuAcDc', x: 620, y: 900, size: 52, cls: 'sld-rack-psu', eqId: 'R07', tagAt: 'below',
      label: 'Rack R07 power shelves, dual corded (feed A + feed B)', values: [{ k: 'rack', dx: 0, dy: 50, anchor: 'middle', lod: 1 }] });
    s.e(a.tap + '.load', psu + '.feedA', 'feed_a', { vfirst: true }); s.e(b.tap + '.load', psu + '.feedB', 'feed_b', { vfirst: true });
    return finish(s);
  }

  /* ── DH-R-101: GB300 NVL72 rack, front and rear elevation (true U scale) ─────────────────────────────── */
  function dhR101(snap) {
    var ct = need(snap, 'compute.gpu_per_rack') / 4, ns = need(snap, 'compute.nvswitch_per_rack') / 2, psu = need(snap, 'power.psu_per_rack'), shelves = psu / 6;
    var U = 13, W = 1000, H = 48 * U + 140, top = 60;
    var s = Sheet({ id: 'dh-r-101', no: 'DH-R-101', title: 'GB300 NVL72 rack — front and rear elevation', size: [W, H], svgId: 'rackSvg' });
    var layout = [];   // [kind, index, units]
    var half = shelves / 2, ctTop = 10;
    for (var i = 1; i <= half; i++) layout.push(['ps', i, 1]);
    for (i = 1; i <= ctTop; i++) layout.push(['ct', i, 1]);
    for (i = 1; i <= ns; i++) layout.push(['ns', i, 1]);
    for (i = ctTop + 1; i <= ct; i++) layout.push(['ct', i, 1]);
    for (i = half + 1; i <= shelves; i++) layout.push(['ps', i, 1]);
    var used = layout.length, spare = 48 - used;
    function elevation(x0, rear) {
      var fw = 240, y = top + Math.floor(spare / 2) * U;
      s.areas.push({ x: x0 - 8, y: top - 8, w: fw + 16, h: 48 * U + 16, label: rear ? 'Rear' : 'Front', kind: 'box' });
      layout.forEach(function (l) {
        var kind = l[0], k = l[1], id = (kind === 'ps' ? 'PS-' : kind === 'ct' ? 'CT-' : 'NS-') + pad(k);
        var cls = kind === 'ps' ? 'rack-psu' : kind === 'ct' ? 'rack-ct' : 'rack-ns', h = l[2] * U - 2;
        var marks = [];
        if (!rear) {
          if (kind === 'ps') for (var m = 0; m < 6; m++) marks.push([8 + m * 30, 3, 24, h - 6]);
          if (kind === 'ct') { marks.push([8, 3, 40, h - 6], [52, 3, 40, h - 6], [100, 3, 26, h - 6], [130, 3, 26, h - 6]); }
          if (kind === 'ns') { marks.push([30, 3, 70, h - 6], [120, 3, 70, h - 6]); }
        }
        s.n({ id: (rear ? 'r-' : 'f-') + id.toLowerCase(), tag: id, box: [fw, h], x: x0 + fw / 2, y: y + h / 2 + 1, cls: cls, eqId: 'R07-' + id, tagAt: 'none',
          text: rear ? '' : id, textRole: 'tag', boxSym: 'slot-' + kind, marks: marks,
          label: { ps: 'Power shelf ' + k + ' (6 PSU, 48 V DC)', ct: 'Compute tray ' + k + ' (4 × B300, 2 × Grace)', ns: 'NVLink switch tray ' + k + ' (2 × NVSwitch)' }[kind],
          standby: kind === 'ps' && k > shelves - 3 });
        y += l[2] * U;
      });
      return x0 + fw;
    }
    elevation(60, false);
    var rx = 480, right = elevation(rx, true);
    // rear: 48 V DC busbar (centre), liquid manifolds (sides), QD pairs per compute and switch tray
    var by0 = top + Math.floor(spare / 2) * U, by1 = by0 + used * U;
    var bb = s.n({ id: 'busbar', tag: 'BUSBAR 48 V', box: [10, used * U], x: rx + 120, y: (by0 + by1) / 2, cls: 'rack-busbar', eqId: 'R07', tagAt: 'none', boxSym: 'busbar', label: '48 V DC busbar, vertical, fused tap per tray' });
    var ms = s.j('man-s-top', rx + 24, top - 30), mr = s.j('man-r-top', rx + 216, top - 30);
    var osS = s.n({ id: 'os-tcs-s', tag: 'TCS SUPPLY', sym: 'offSheet', x: rx + 24, y: top - 46, size: 20, rot: 270, tagAt: 'left', label: 'TCS supply from the row header (DH-M-104)' });
    var osR = s.n({ id: 'os-tcs-r', tag: 'TCS RETURN', sym: 'offSheet', x: rx + 216, y: top - 46, size: 20, rot: 90, tagAt: 'right', label: 'TCS return to the row header (DH-M-104)' });
    s.e(osS + '.port', ms, 'tcs_s', { w: 'main' }); s.e(mr, osR + '.port', 'tcs_r', { w: 'main' });
    var prevS = ms, prevR = null, yy = by0, rows = [];
    layout.forEach(function (l) {
      var cy = yy + (l[2] * U) / 2; yy += l[2] * U;
      if (l[0] === 'ps') return;
      var id = (l[0] === 'ct' ? 'CT-' : 'NS-') + pad(l[1]);
      var js = s.j('qs-' + id, rx + 24, cy), jr = s.j('qr-' + id, rx + 216, cy);
      var qs = s.n({ id: 'qd-s-' + id, tag: 'QD', sym: 'quickDisconnect', x: rx + 52, y: cy, size: 14, tagAt: 'none', label: id + ' supply quick-disconnect' });
      var qr = s.n({ id: 'qd-r-' + id, tag: 'QD', sym: 'quickDisconnect', x: rx + 188, y: cy, size: 14, tagAt: 'none', label: id + ' return quick-disconnect' });
      s.e(prevS, js, 'tcs_s', { w: 'main' }); prevS = js;
      s.e(js, qs + '.a', 'tcs_s'); s.e(qr + '.b', jr, 'tcs_r');
      rows.push(jr);
    });
    for (var q = rows.length - 1; q > 0; q--) s.e(rows[q], rows[q - 1], 'tcs_r', { w: 'main' });
    s.e(rows[0], mr, 'tcs_r', { w: 'main' });
    var mf = s.n({ id: 'manifold', tag: 'MANIFOLD', box: [6, 6], x: rx + 24, y: by1 + 10, cls: 'rack-manifold', eqId: 'R07', tagAt: 'none', boxSym: 'manifold', label: 'Rack liquid manifold, supply + return, SS316L' });
    var lk = s.n({ id: 'leak', tag: 'LD-R07', sym: 'leakSensor', x: rx + 120, y: top + 48 * U + 24, size: 22, cls: 'rack-leak', eqId: 'R07', tagAt: 'right', label: 'Rack leak detection: drip tray rope + QD point sensors' });
    // feeds into the busbar from the power shelves are internal; the cords come from the SLD
    var osA = s.n({ id: 'os-fa', tag: 'FEED A', sym: 'offSheet', x: right + 60, y: by0 + 6, size: 20, rot: 180, tagAt: 'right', label: 'Feed A cord from busway tap TAP-A07 (DH-E-101)' });
    var osB = s.n({ id: 'os-fb', tag: 'FEED B', sym: 'offSheet', x: right + 60, y: by1 - 6, size: 20, rot: 180, tagAt: 'right', label: 'Feed B cord from busway tap TAP-B07 (DH-E-101)' });
    s.e(osA + '.port', [right, by0 + 6], 'feed_a'); s.e(osB + '.port', [right, by1 - 6], 'feed_b');
    s.notes.push({ x: 60, y: top + 48 * U + 34, text: used + ' U used of 48 · ' + ct + ' compute · ' + ns + ' switch · ' + shelves + ' power shelves', role: 'label' });
    return finish(s);
  }

  var BUILDERS = { 'dh-m-103': dhM103, cdu: cduSheet, 'dh-e-101': dhE101, 'dh-r-101': dhR101 };
  var API = {
    build: function (id, snap, o) { if (!BUILDERS[id]) throw new Error('hmi-sheets: no sheet ' + id); return BUILDERS[id](snap, o); },
    list: function () { return Object.keys(BUILDERS); },
    version: '1.0.0'
  };
  if (root) root.RZDatahallAISheets = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
