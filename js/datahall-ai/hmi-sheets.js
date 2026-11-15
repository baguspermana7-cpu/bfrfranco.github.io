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
    var hx = s.n({ id: P + 'hx', tag: 'HX-' + id, sym: 'hxPlate', x: X + 220, y: Y + 270, size: 64, cls: 'cdu', eqId: String(Number(id)), label: 'CDU-' + id + ' plate heat exchanger',
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
      var pp = s.n({ id: P + 'p' + n, tag: 'P-' + id + String.fromCharCode(64 + n), sym: 'pumpVfd', x: hdrX + 110, y: py - 5, size: 40, cls: 'cdu-pump', eqId: String(Number(id)) + '-' + n,
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
    var W = 1240, H = 830, s = Sheet({ id: 'dh-m-103', no: 'DH-M-103', title: 'DH-01 CDU LINE', size: [W, H], svgId: 'coolSvg', sheet: '3/5' });
    var yS = 40, yR = 740;
    // HTW headers (from / to DH-M-102 pumping)
    var osS = s.n({ id: 'os-hs', tag: 'DH-M-102', sym: 'offSheet', x: 30, y: yS, size: 24, rot: 180, tagAt: 'below', label: 'HTW supply from heat rejection (sheet DH-M-102)' });
    var osR = s.n({ id: 'os-hr', tag: 'DH-M-102', sym: 'offSheet', x: 30, y: yR, size: 24, rot: 0, tagAt: 'above', label: 'HTW return to heat rejection (sheet DH-M-102)' });
    // the chiller plant on DH-M-102 that closes the HTW loop — one clickable node for the plant (CH-01 opens its HMI)
    var chN = need(snap, 'equipment.chillers_installed'), chRun = need(snap, 'equipment.chillers_running_design');
    var ch = s.n({ id: 'ch-plant', tag: 'CH-01 … CH-' + pad(chN), sym: 'chiller', x: 30, y: yR + 52, size: 30, cls: 'chiller', eqId: '1', tagAt: 'right',
      label: 'Chiller plant on DH-M-102 — ' + chRun + ' of ' + chN + ' running at design; CH-01 shown' });
    s.e(osR + '.port', ch, 'htw', { w: 'branch' });
    var hs1 = s.j('hs1', 120, yS), hsR = s.j('hs-riser', 706, yS, false);
    var hr1 = s.j('hr1', 120, yR), hrR = s.j('hr-riser', 1214, yR, false);
    s.e(osS + '.port', hs1, 'htw', { w: 'main', line: 'HTW-600-CS-001' }); s.e(hs1, hsR, 'htw', { w: 'main' });
    s.e(hrR, hr1, 'htw', { w: 'main', line: 'HTW-600-CS-002' }); s.e(hr1, osR + '.port', 'htw', { w: 'main' });
    // TCS off-sheet to / from the rack loop
    var osT = s.n({ id: 'os-ts', tag: 'DH-M-104', sym: 'offSheet', x: 640, y: 650, size: 24, tagAt: 'below', label: 'TCS supply to the rack rows (sheet DH-M-104)' });
    var osTr = s.n({ id: 'os-tr', tag: 'DH-M-104', sym: 'offSheet', x: 640, y: 694, size: 24, rot: 180, tagAt: 'below', label: 'TCS return from the rack rows (sheet DH-M-104)' });
    s.areas.push({ x: 18, y: 64, w: 650, h: 660, label: 'CDU-01', kind: 'box' });
    cduDetail(s, { id: '01', x: 40, y: 40, pumps: 3, hsIn: hs1, hrOut: hr1, tcsOut: osT + '.port', tcsIn: osTr + '.port', retY: 694 });
    // the rest of the line: compact instances on row sub-headers, every one its own item
    var rest = installed - 1, perRow = Math.ceil(rest / 3), x0 = 744, dx = 26, rows = [170, 360, 550];
    s.areas.push({ x: 722, y: 64, w: 508, h: 660, label: 'CDU-02 … CDU-' + pad(installed), kind: 'box' });
    var k = 2, prevS = hsR;
    rows.forEach(function (ry, r) {
      var ys = ry - 44, yr = ry + 44, rs = s.j('rs' + r, 706, ys), rr = s.j('rr' + r, 1214, yr, false), prev = rs, prevR = null, retJs = [];
      s.e(prevS, rs, 'htw', { w: 'main' }); prevS = rs;
      for (var c = 0; c < perRow && k <= installed; c++, k++) {
        var cx = x0 + c * dx, id = pad(k), standby = k > duty;
        var js = s.j('cs' + id, cx - 9, ys), jr = s.j('cr' + id, cx - 9, yr);
        var hx = s.n({ id: 'cdu' + id, tag: 'CDU-' + id, sym: 'hxPlate', x: cx, y: ry, size: 22, cls: 'cdu', eqId: String(k), tagAt: 'belowV', lod: 2,
          label: 'CDU-' + id + (standby ? ' (standby)' : ''), standby: standby });
        s.e(prev, js, 'htw'); prev = js;
        s.e(js, hx + '.hotIn', 'htw'); s.e(hx + '.hotOut', jr, 'htw');
        retJs.push(jr);
      }
      for (var q = 0; q < retJs.length; q++) s.e(retJs[q], q + 1 < retJs.length ? retJs[q + 1] : rr, 'htw');
      s.e(rr, r < rows.length - 1 ? 'rr' + (r + 1) : hrR, 'htw', { w: 'main' });
    });
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
    s.areas.push({ x: mbx - 34, y: 404, w: 250, h: 262, label: 'UPS-' + L + '01', kind: 'box' });
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
    s.notes.push({ x: X + 262, y: 100, text: 'TX-' + L + '02 … TX-' + L + pad(tx), role: 'tag' });
    compactGrid(s, { prefix: 'UPS-' + L, from: 2, to: upsPerFeed, x: X + 290, y: 470, cols: 14, dx: 13, dy: 24, sym: 'inverterIec', cls: 'sld-ups-' + L.toLowerCase(), label: 'UPS frame' });
    s.notes.push({ x: X + 284, y: 450, text: 'UPS-' + L + '02 … UPS-' + L + pad(upsPerFeed), role: 'tag' });
    return { tap: tap, busM: bM };
  }
  function dhE101(snap) {
    var W = 1240, H = 1000, s = Sheet({ id: 'dh-e-101', no: 'DH-E-101', title: 'DH-01 SLD FEED A/B', size: [W, H], svgId: 'elecDH1Svg', sheet: '1/8' });
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
    var s = Sheet({ id: 'dh-r-101', no: 'DH-R-101', title: 'GB300 NVL72 RACK', size: [W, H], svgId: 'rackSvg' });
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
    return finish(s);
  }

  /* ── DH-F-101: detection of one hall — FACP, three addressable loops, 12 zones, aspirating sampling pipes ─────── */
  function dhF101(snap, o) {
    var inv = o && o.fire; if (!inv || !inv.zones) throw new Error('hmi-sheets: dh-f-101 needs the fire inventory (RZDatahallAIFirePoints.buildInventory)');
    var hp = 'DH-01', zones = inv.zones.filter(function (z) { return z.hall === 1; });
    var W = 1240, H = 950, s = Sheet({ id: 'dh-f-101', no: 'DH-F-101', title: 'Fire detection — ' + hp + ', loops 1–3', size: [W, H], svgId: 'fireSvg', sheet: '1/2', basis: 'NFPA 72 × hall geometry' });
    var PX = 90, DX = 130, TX = { L1: 160, L2: 172, L3: 184 }, TEE = { L1: 86, L2: 78, L3: 70 }, FX = 204, ZW = 246, ZG = 10, ZH = 266, RG = 14, Y0 = 56, COLS = 4, BOT = H - 36;
    var short = function (id) { return id.replace(hp + '-', ''); };
    // panel column: FACP, NAC 1-2, monitor link, off-sheets
    var facp = s.n({ id: 'facp', tag: 'FACP-01', sym: 'facp', x: PX, y: 40, size: 40, cls: 'fire-facp', eqId: hp, tagAt: 'right', label: 'Fire alarm control panel, hall ' + hp + ' — addressable, 3 SLC loops class A, 2 NAC' });
    var bus = [facp + '.loop'];
    ['L3', 'L2', 'L1'].forEach(function (L) {
      var tee = s.j('tee-' + L, PX, TEE[L], true), top = s.j('top-' + L, TX[L], TEE[L], false), bot = s.j('bot-' + L, TX[L], BOT, false);
      bus.push(tee); s.e(tee, top, 'signal', { w: 'signal' }); s.e(top, bot, 'signal', { w: 'signal' });
      s.notes.push({ x: TX[L] + 3, y: BOT + 10, text: L, role: 'tag', lod: 2 });
    });
    [['nac1', 'NAC-1', 'sounder', 130, hp + '-FACP-NAC-1', 'Notification appliance circuit 1 — sounders'],
     ['nac2', 'NAC-2', 'strobe', 180, hp + '-FACP-NAC-2', 'Notification appliance circuit 2 — visual alarms'],
     ['comms', 'NET', 'interfaceModule', 230, hp + '-FACP-COMMS', 'Supervising-station and BMS monitor link (monitor only)']].forEach(function (d) {
      var id = s.n({ id: d[0], tag: d[1], sym: d[2], x: DX, y: d[3], size: 26, rot: 90, cls: 'fire-point', eqId: d[4], tagAt: 'below', label: d[5] });
      var tee = s.j('tee-' + d[0], PX, d[3], true); bus.push(tee); s.e(tee, id + '.loop', 'signal', { w: 'signal' });
    });
    [['os-bms', 'DH-N-101', 280, 'data', 'BMS / EPMS network — sheet DH-N-101'],
     ['os-rel', 'DH-F-102', 340, 'signal', 'Releasing panel, agent bank, abort and pre-action per zone — sheet DH-F-102']].forEach(function (d) {
      var id = s.n({ id: d[0], tag: d[1], sym: 'offSheet', x: DX, y: d[2], size: 22, tagAt: 'below', label: d[4] });
      var tee = s.j('tee-' + d[0], PX, d[2], d[0] !== 'os-rel'); bus.push(tee); s.e(tee, id + '.port', d[3], { w: 'signal' });
    });
    var cyl = inv.points.filter(function (p) { return p.hall === 1 && p.type === 'agent_pressure'; })[0];
    if (cyl) {
      var cy = s.n({ id: cyl.id.toLowerCase(), tag: 'PS-1', sym: 'agentCylinder', x: DX, y: 410, size: 28, cls: 'fire-point', eqId: cyl.id, tagAt: 'below', label: cyl.label + ' · ' + cyl.address });
      var ct = s.j('tee-cyl', PX, 410, true); bus.push(ct); s.e(ct, cy, 'signal', { w: 'signal' });
    }
    s.chain(bus, 'signal', { w: 'signal' });
    // zones: 3 rows × 4 columns; each loop is a series line through the zone's devices; one sampling pipe per zone
    var SYM = { smoke_spot: 'smokeDetector', heat_spot: 'heatDetector', beam: 'smokeDetector', lhd: 'heatDetector', mcp: 'manualStation' };
    var prev = { L1: {}, L2: {}, L3: {} }, unitAt = {};
    function portsFor(areaM2) { return Math.max(1, Math.ceil(areaM2 / (inv.spacing.vesdaPortM * inv.spacing.vesdaPortM))); }
    zones.forEach(function (z, k) {
      var r = Math.floor(k / COLS), c = k % COLS, x0 = FX + c * (ZW + ZG), y0 = Y0 + r * (ZH + RG), zl = z.id.toLowerCase();
      var yL = { L1: y0 + 54, L2: y0 + 104, L3: y0 + 154 }, yPipe = y0 + 204;
      s.areas.push({ x: x0, y: y0, w: ZW, h: ZH, kind: 'zone' });
      s.n({ id: 'zh-' + zl, tag: short(z.id), box: [ZW - 12, 16], x: x0 + ZW / 2, y: y0 + 13, cls: 'fire-zone', eqId: z.id, tagAt: 'none', boxSym: 'zone-head',
        text: short(z.id) + ' · ' + Math.round(z.areaM2) + ' m²', textRole: 'tag',
        label: z.name + ' — ' + z.means.length + ' independent detection means, ' + (z.release ? 'clean-agent release zone' : 'detection only') + (z.epo ? ', zoned EPO' : '') });
      ['L1', 'L2', 'L3'].forEach(function (L) {
        if (!prev[L][r]) prev[L][r] = s.j('row-' + L + '-' + r, TX[L], yL[L], true);
        var zp = inv.points.filter(function (p) { return p.zoneId === z.id && p.loop === L && SYM[p.type]; });
        if (zp.length) {   // a short-circuit isolator module where the loop enters the zone (NFPA 72 §23.6.1 — a fault in one zone must not take the loop)
          var iso = s.n({ id: 'iso-' + zl + '-' + L.toLowerCase(), tag: 'ISO', sym: 'interfaceModule', x: x0 + 8, y: yL[L], size: 12, tagAt: 'none', lod: 2, label: 'Loop ' + L + ' short-circuit isolator at the ' + short(z.id) + ' boundary' });
          s.e(prev[L][r], iso, 'signal', { w: 'signal' }); prev[L][r] = iso;
        }
        zp.forEach(function (p, i) {
          var id = s.n({ id: p.id.toLowerCase(), tag: short(p.id).replace(short(z.id) + '-', ''), sym: SYM[p.type], x: x0 + 32 + i * 34, y: yL[L], size: 20,
            cls: p.type === 'mcp' ? 'fire-mcp' : 'fire-point', eqId: p.id, tagAt: 'none', label: p.label + ' · ' + p.address });
          s.e(prev[L][r], id, 'signal', { w: 'signal' }); prev[L][r] = id;
        });
      });
      inv.points.filter(function (p) { return p.zoneId === z.id && p.type === 'epo'; }).forEach(function (p) {
        s.n({ id: p.id.toLowerCase(), tag: 'EPO', sym: 'epo', x: x0 + ZW - 26, y: yL.L3, size: 22, cls: 'fire-epo', eqId: p.id, tagAt: 'none', label: p.label + ' · ' + p.address });
      });
      var unit = inv.points.filter(function (p) { return p.type === 'vesda' && p.zoneIds.indexOf(z.id) >= 0; })[0];
      if (unit) {
        var a = s.j('pa-' + zl, x0 + 12, yPipe, false), b = s.j('pb-' + zl, x0 + ZW - 62, yPipe, false), holes = portsFor(z.areaM2);
        s.n({ id: 'cap-' + zl, tag: 'CAP', box: [2.5, 9], x: x0 + 12, y: yPipe, tagAt: 'none', boxSym: 'endcap', label: 'Sampling pipe end cap (capped, with end sampling hole)' });
        s.e(a, b, 'air', { w: 'branch', line: short(unit.id) + ' · ' + holes + ' ports' });
        for (var h = 1; h <= holes; h++) s.j('port-' + zl + '-' + h, x0 + 12 + h * ((ZW - 74) / (holes + 1)), yPipe, true);
        if (!unitAt[unit.id]) {
          unitAt[unit.id] = s.n({ id: unit.id.toLowerCase(), tag: short(unit.id), sym: 'aspirating', x: x0 + ZW - 34, y: yPipe, size: 26, cls: 'fire-vesda', eqId: unit.id, tagAt: 'below',
            label: unit.label + ' — ' + unit.ports + ' sampling ports over ' + unit.zoneIds.map(short).join(', ') });
          s.e(b, unitAt[unit.id], 'air', { w: 'branch' });
        } else {
          s.e(b, [x0 + ZW - 14, yPipe], 'air', { w: 'branch' });
        }
      }
      // clean-agent zones: abort station, release circuit, pre-action solenoid on the release line; the agent bank is on DH-F-102
      var rel = inv.points.filter(function (p) { return p.zoneId === z.id && /^(abort|release|preaction_solenoid)$/.test(p.type); });
      if (rel.length) {
        var yR = y0 + 238, RS = { abort: 'abortSwitch', release: 'valveSolenoid', preaction_solenoid: 'valveSolenoid' }, RT = { abort: 'ABT', release: 'REL', preaction_solenoid: 'PAV' };
        var ra = s.j('ra-' + zl, x0 + 12, yR, false), last = ra;
        rel.sort(function (p, q) { return ['abort', 'release', 'preaction_solenoid'].indexOf(p.type) - ['abort', 'release', 'preaction_solenoid'].indexOf(q.type); }).forEach(function (p, i) {
          var id = s.n({ id: p.id.toLowerCase(), tag: RT[p.type], sym: RS[p.type], x: x0 + 40 + i * 52, y: yR, size: 20, cls: 'fire-point', eqId: p.id, tagAt: 'none', label: p.label + ' · ' + p.address });
          s.e(last, p.type === 'abort' ? id : id + '.a', 'agent', { w: 'branch' }); last = p.type === 'abort' ? id : id + '.b';
        });
        var osz = s.n({ id: 'os-' + zl, tag: 'F-102', sym: 'offSheet', x: x0 + ZW - 24, y: yR, size: 16, tagAt: 'none', lod: 2, label: 'Agent bank and selector valve for ' + short(z.id) + ' — sheet DH-F-102' });
        s.e(last, osz + '.port', 'agent', { w: 'branch', line: 'AG-' + short(z.id) });
      }
    });
    return finish(s);
  }

  /* ── DH-E-001: facility single-line — 150 kV intake, main transformers, 20 kV boards per hall and feed, generator plant ── */
  function dhE001(snap) {
    var W = 1240, H = 900, s = Sheet({ id: 'dh-e-001', no: 'DH-E-001', title: 'SITE SLD', size: [W, H], svgId: 'elecOvSvg', sheet: '1/8' });
    var hvKv = need(snap, 'distribution.hv_intake_kv'), mvKv = need(snap, 'distribution.mv_kv'), lines = need(snap, 'distribution.hv_circuits_installed'), linesDuty = need(snap, 'distribution.hv_circuits_duty');
    var txN = need(snap, 'distribution.main_tx_total'), txMva = need(snap, 'distribution.main_tx_mva'), halls = need(snap, 'site.hall_levels'), gens = need(snap, 'equipment.gensets_installed'), genDuty = need(snap, 'equipment.gensets_duty'), genKw = need(snap, 'equipment.generator_unit_kw');
    var feeders = need(snap, 'distribution.mv_feeders_per_hall_per_feed'), kaRated = need(snap, 'distribution.mv_board_ka_rating'), kaFault = need(snap, 'distribution.mv_fault_ka_per_section');
    // HV intake: every line bay drawn (4), duty count from the engine; double busbar at 150 kV
    var busY = 150, busA = s.j('hv-bus-l', 90, busY, false), busB = s.j('hv-bus-r', 90 + (lines - 1) * 150 + 60, busY, false);
    s.e(busA, busB, 'power', { w: 'bus', line: hvKv + ' kV BUS' });
    for (var l = 1; l <= lines; l++) {
      var x = 120 + (l - 1) * 150, duty = l <= linesDuty;
      var u = s.n({ id: 'grid' + l, tag: 'LINE ' + l, sym: 'utilitySource', x: x, y: 40, size: 34, cls: 'sld-main-tx', eqId: 'L' + l, tagAt: 'right', standby: !duty, label: hvKv + ' kV incoming line ' + l + (duty ? ' (duty)' : ' (standby)') });
      var ds = s.n({ id: 'ds-hv' + l, tag: 'Q' + l, sym: 'disconnector', x: x, y: 86, size: 22, tagAt: 'none', lod: 2, label: 'Line disconnector, bay ' + l });
      var cb = s.n({ id: 'cb-hv' + l, tag: 'CB' + l, sym: 'cbIec', x: x, y: 118, size: 24, tagAt: 'none', lod: 2, label: hvKv + ' kV line breaker, bay ' + l + ' (SF6-free GIS bay)' });
      s.e(u + '.out', ds + '.line', 'power', { w: 'main' }); s.e(ds + '.load', cb + '.line', 'power', { w: 'main' }); s.e(cb + '.load', [x, busY], 'power', { w: 'main' });
      s.j('hv-t' + l, x, busY, true);
    }
    s.n({ id: 'vt-hv', tag: 'VT', sym: 'voltageTransformer', x: 90 + (lines - 1) * 150 + 30, y: 190, size: 20, tagAt: 'none', lod: 2, label: hvKv + ' kV bus voltage transformer (metering, synchronising)' });
    s.e([90 + (lines - 1) * 150 + 30, busY], 'vt-hv.line', 'power', { w: 'branch' });
    // main transformers: two drawn in full (one per feed of DH-01), the rest as a compact grid
    var txX = { A: 180, B: 420 }, mvY = 420;
    ['A', 'B'].forEach(function (L, i) {
      var x = txX[L], med = L === 'A' ? 'feed_a' : 'feed_b';
      var cb1 = s.n({ id: 'cb-tx' + L, tag: 'CB-T' + L, sym: 'cbIec', x: x, y: 200, size: 24, tagAt: 'none', lod: 2, label: 'Transformer HV breaker ' + L });
      var tx = s.n({ id: 'tx-main' + L, tag: 'TX-M' + L + '01', sym: 'transformer2w', x: x, y: 262, size: 48, cls: 'sld-main-tx', eqId: L + '01', tagAt: 'right', label: 'Main transformer ' + L + '01, ' + txMva + ' MVA, ' + hvKv + ' / ' + mvKv + ' kV, ONAN/ONAF', values: [{ k: 'load', dx: 32, dy: 16, anchor: 'start' }] });
      var cb2 = s.n({ id: 'cb-mv' + L, tag: 'Q-IN' + L, sym: 'cbDrawout', x: x, y: 330, size: 30, cls: 'sld-mv-sub', eqId: L + '00', tagAt: 'left', label: mvKv + ' kV incomer breaker, board ' + L + ' of DH-01' });
      s.e([x, busY], cb1 + '.line', 'power', { w: 'main' }); s.e(cb1 + '.load', tx + '.hv', 'power', { w: 'main' }); s.e(tx + '.lv', cb2 + '.line', med, { w: 'main', line: mvKv + ' kV' });
      s.j('hv-tx' + L, x, busY, true);
      var bl = s.j('mv-' + L + '-l', x - 60, mvY, false), br = s.j('mv-' + L + '-r', x + 60, mvY, false);
      s.e(bl, br, med, { w: 'bus', line: 'MVB-' + L + '01 · ' + kaRated + ' kA' }); s.e(cb2 + '.load', [x, mvY], med, { w: 'main' }); s.j('mv-' + L + '-t', x, mvY, true);
      s.n({ id: 'pr-' + L, tag: '50/51', sym: 'protectionRelay', x: x + 40, y: 330, size: 18, tagAt: 'none', lod: 2, inst: '51', label: 'Incomer protection relay 50/51/87T, board ' + L });
      // feeders to the hall: one per MV feeder from the engine, each an off-sheet to DH-E-101
      for (var f = 1; f <= feeders; f++) {
        var fx = x - 48 + (f - 1) * 24, fcb = s.n({ id: 'cb-f' + L + f, tag: 'F' + f, sym: 'cbDrawout', x: fx, y: mvY + 40, size: 16, cls: 'sld-mv-sub', eqId: L + pad(f), tagAt: 'none', lod: 2, label: mvKv + ' kV feeder ' + L + pad(f) + ' to the unit substations (sheet DH-E-101)' });
        s.e([fx, mvY], fcb + '.line', med, { w: 'branch' }); s.j('mvt-' + L + f, fx, mvY, true);
        s.e(fcb + '.load', [fx, mvY + 70], med, { w: 'branch' });
      }
      s.n({ id: 'os-e101' + L, tag: 'DH-E-101 ' + L, sym: 'offSheet', x: x, y: mvY + 92, size: 20, rot: 90, tagAt: 'below', label: 'Unit substations and UPS of DH-01, feed ' + L + ' (sheet DH-E-101)' });
    });
    var tie = s.n({ id: 'mv-tie', tag: 'Q-TIE', sym: 'cbDrawout', x: 300, y: mvY, size: 26, rot: 90, tagAt: 'above', label: mvKv + ' kV bus tie A / B of DH-01 (normally open)' });
    s.e('mv-A-r', tie + '.line', 'power', { w: 'main' }); s.e(tie + '.load', 'mv-B-l', 'power', { w: 'main' });
    s.areas.push({ x: 100, y: 180, w: 400, h: 350, label: 'DH-01 ' + mvKv + ' kV', kind: 'box' });
    s.notes.push({ x: 494, y: 192, text: 'Ik ' + (Math.round(kaFault * 10) / 10) + ' / ' + kaRated + ' kA', role: 'value', anchor: 'end' });
    // the other halls' transformer pairs as a grid, every one clickable
    compactGrid(s, { prefix: 'TX-M', from: 3, to: txN, x: 560, y: 220, cols: 7, dx: 26, dy: 30, size: 18, sym: 'transformer2w', cls: 'sld-main-tx', label: 'Main transformer ' + txMva + ' MVA' });
    s.notes.push({ x: 560, y: 204, text: 'TX-M03 … TX-M' + pad(txN) + ' · DH-02 … DH-' + pad(halls), role: 'tag' });
    s.areas.push({ x: 540, y: 190, w: 220, h: 100, kind: 'box' });
    for (var h = 2; h <= halls; h++) { s.n({ id: 'os-hall' + h, tag: 'DH-' + pad(h), sym: 'offSheet', x: 580 + (h - 2) * 80, y: 330, size: 18, rot: 90, tagAt: 'below', label: 'Boards and unit substations of DH-' + pad(h) + ' (sheet DH-' + pad(h) + '-E-101)' }); s.e([580 + (h - 2) * 80, 290], 'os-hall' + h + '.port', 'power', { w: 'branch' }); }
    // generation: paralleling switchgear at 20 kV, two sets drawn, the rest as a grid; gen bus to each board through a breaker
    var gY = 640, gbA = s.j('gen-bus-l', 120, gY, false), gbB = s.j('gen-bus-r', 1180, gY, false);
    s.e(gbA, gbB, 'power', { w: 'bus', line: 'GEN BUS ' + mvKv + ' kV · ' + genDuty + ' duty of ' + gens });
    for (var g = 1; g <= 2; g++) {
      var gx = 160 + (g - 1) * 120, gen = s.n({ id: 'gen' + g, tag: 'G-' + pad(g), sym: 'generatorIec', x: gx, y: 760, size: 40, cls: 'site-genset-yard', eqId: 'G' + pad(g), tagAt: 'below', label: 'Diesel generator ' + pad(g) + ', ' + genKw / 1000 + ' MW, ' + mvKv + ' kV (' + need(snap, 'equipment.generator_redundancy') + ')' });
      var gcb = s.n({ id: 'cb-g' + g, tag: '52G', sym: 'cbIec', x: gx, y: 700, size: 22, tagAt: 'none', lod: 2, label: 'Generator breaker 52G-' + pad(g) + ' with synchronising check (25)' });
      s.e(gen + '.out', gcb + '.load', 'power', { w: 'main', vfirst: true }); s.e(gcb + '.line', [gx, gY], 'power', { w: 'main' }); s.j('gt' + g, gx, gY, true);
    }
    compactGrid(s, { prefix: 'G-', from: 3, to: gens, x: 330, y: 690, cols: 34, dx: 24, dy: 28, size: 16, sym: 'generatorIec', cls: 'site-genset-yard', label: 'Diesel generator ' + genKw / 1000 + ' MW', standbyFrom: genDuty + 1 });
    s.areas.push({ x: 316, y: 672, w: 34 * 24 + 4, h: Math.ceil((gens - 2) / 34) * 28 + 20, label: 'G-03 … G-' + gens, kind: 'box' });
    ['A', 'B'].forEach(function (L) { var x = txX[L] + 40, c = s.n({ id: 'cb-gen' + L, tag: '52GB', sym: 'cbDrawout', x: x, y: 560, size: 22, tagAt: 'none', lod: 2, label: 'Generator bus incomer to board ' + L + ' (closed on utility loss, ATS logic on DH-E-101)' }); s.e([x, mvY], c + '.line', 'power', { w: 'main' }); s.e(c + '.load', [x, gY], 'power', { w: 'main' }); s.j('gbt' + L, x, gY, true); s.j('mvg' + L, x, mvY, true); });
    s.n({ id: 'os-fuel', tag: 'DH-U-101', sym: 'offSheet', x: 1180, y: 760, size: 20, tagAt: 'below', label: 'Fuel farm, ' + need(snap, 'site.fuel_autonomy_h') + ' h autonomy (sheet DH-U-101)' });
    return finish(s);
  }

  /* ── DH-N-101: compute fabric of one hall — cores, spines, leaves, one rack's rails; counts from the engine ─────────── */
  function dhN101(snap) {
    var W = 1240, H = 820, s = Sheet({ id: 'dh-n-101', no: 'DH-N-101', title: 'DH-01 COMPUTE FABRIC', size: [W, H], svgId: 'netSvg', sheet: '1/4' });
    var cores = need(snap, 'network.cores_per_hall'), spines = need(snap, 'network.spines_per_hall'), leaves = need(snap, 'network.leaves_per_hall'), radix = need(snap, 'network.leaf_radix');
    var lsLinks = need(snap, 'network.leaf_spine_links_per_hall'), scLinks = need(snap, 'network.spine_core_links_per_hall'), gpuLinks = need(snap, 'network.gpu_downlinks_per_hall'), gpuRack = need(snap, 'compute.gpu_per_rack');
    var tier = function (o) {   // o: {prefix, n, drawn, y, cls, label, sym}
      var ids = [], dx = 86, x0 = 120;
      for (var k = 1; k <= o.drawn; k++) ids.push(s.n({ id: (o.prefix + pad(k)).toLowerCase(), tag: o.prefix + pad(k), sym: o.sym, x: x0 + (k - 1) * dx, y: o.y, size: 34, cls: o.cls, eqId: String(k), tagAt: 'below', label: o.label + ' ' + pad(k) + ' — ' + radix + ' × 400G ports', values: [{ k: 'util', dx: 0, dy: -24, anchor: 'middle', lod: 2 }] }));
      var cols = 40, gp = 14, rows = Math.ceil((o.n - o.drawn) / cols);
      compactGrid(s, { prefix: o.prefix, from: o.drawn + 1, to: o.n, x: x0 + o.drawn * dx + 24, y: o.y - 50, cols: cols, dx: gp, dy: gp, size: 10, sym: o.sym, cls: o.cls, label: o.label });
      s.areas.push({ x: x0 + o.drawn * dx + 12, y: o.y - 72, w: cols * gp + 10, h: rows * gp + 30, label: o.prefix + pad(o.drawn + 1) + ' … ' + o.prefix + o.n, kind: 'box' });
      return ids;
    };
    var C = tier({ prefix: 'CORE-', n: cores, drawn: 6, y: 130, cls: 'net-core', label: 'Core switch', sym: 'netSwitch' });
    var S = tier({ prefix: 'SPINE-', n: spines, drawn: 6, y: 340, cls: 'net-spine', label: 'Spine switch', sym: 'netSwitch' });
    var L = tier({ prefix: 'LEAF-', n: leaves, drawn: 6, y: 560, cls: 'net-leaf', label: 'Leaf switch (rail-aligned)', sym: 'netSwitch' });
    // full mesh between the drawn members of neighbouring tiers; the counts carry the whole hall
    C.forEach(function (c, i) { S.forEach(function (sp, j) { s.e(sp + '.up', c + '.down', 'data', { w: 'branch', via: [[120 + j * 86, 235 + i * 6], [120 + i * 86, 235 + i * 6]], line: i === 0 && j === 0 ? scLinks.toLocaleString('en-US') + ' spine–core links' : undefined }); }); });
    S.forEach(function (sp, i) { L.forEach(function (lf, j) { s.e(lf + '.up', sp + '.down', 'data', { w: 'branch', via: [[120 + j * 86, 455 + i * 6], [120 + i * 86, 455 + i * 6]], line: i === 0 && j === 0 ? lsLinks.toLocaleString('en-US') + ' leaf–spine links' : undefined }); }); });
    // one rack's GPU rails on LEAF-01: the NIC rail of R07
    var rack = s.n({ id: 'rack-r07', tag: 'R07', box: [150, 44], x: 195, y: 730, cls: 'rack-ns', eqId: 'R07', tagAt: 'none', boxSym: 'rack', text: 'R07 · ' + gpuRack + ' × 400G', textRole: 'tag', label: 'Rack R07 NIC rail: one 400G rail per GPU to its leaf' });
    s.e(rack + '.top', L[0] + '.down', 'data', { w: 'main', line: gpuRack + ' × 400G' });
    s.notes.push({ x: 320, y: 734, text: 'GPU DL ' + gpuLinks.toLocaleString('en-US'), role: 'value' });
    ['DH-N-102 WAN', 'DH-N-103 OOB/BMS', 'DH-N-104 Security'].forEach(function (t, i) { var id = s.n({ id: 'os-n' + i, tag: t.split(' ')[0].replace('DH-', ''), sym: 'offSheet', x: 1000 + i * 80, y: 730, size: 20, rot: 90, tagAt: 'below', label: t.replace(/^DH-N-\d+ /, '') + ' network (sheet ' + t.split(' ')[0] + ')' }); s.e(C[5] + '.down', id + '.port', 'data', { w: 'branch', via: [[550, 700], [1000 + i * 80, 700]] }); });
    return finish(s);
  }

  /* ── DH-A-101: room layout of one hall to scale — rack rows, aisles, CDU gallery, fan walls, fire zones, doors ───────── */
  function dhA101(snap, o) {
    var Lm = need(snap, 'geometry.hall_length_m'), Wm = need(snap, 'geometry.hall_width_m'), rows = need(snap, 'geometry.rack_rows'), perRow = need(snap, 'geometry.racks_per_row');
    var pitch = need(snap, 'geometry.rack_pitch_m'), depth = need(snap, 'geometry.rack_depth_m'), cold = need(snap, 'geometry.cold_aisle_m'), hot = need(snap, 'geometry.hot_aisle_m'), rowPitch = need(snap, 'geometry.row_pitch_m');
    var cross = need(snap, 'geometry.cross_aisle_m'), cduDepth = need(snap, 'geometry.cdu_line_depth_m'), rowLen = need(snap, 'geometry.row_length_m'), galleries = need(snap, 'geometry.fan_wall_galleries'), fwMods = need(snap, 'geometry.fan_wall_modules_per_gallery');
    var cdus = need(snap, 'equipment.cdu_installed_per_hall'), crahs = need(snap, 'equipment.crah_installed_per_hall');
    var SC = 17.5, M = 40, W = Math.round(Lm * SC + 2 * M + 400), H = Math.round(Wm * SC + 2 * M + 90);
    var s = Sheet({ id: 'dh-a-101', no: 'DH-A-101', title: 'DH-01 ROOM LAYOUT 1:100', size: [W, H], svgId: 'floorSvg', sheet: '1/3', basis: 'engine hall geometry' });
    var X = function (m) { return M + m * SC; }, Y = function (m) { return M + 50 + m * SC; };
    // hall shell (walls 0.3 m), fan-wall galleries along both long walls, rack field, cross aisle, CDU gallery
    var fw = (Wm - rowLen - cross - cduDepth) / galleries;
    s.areas.push({ x: X(0) - 5, y: Y(0) - 5, w: Lm * SC + 10, h: Wm * SC + 10, kind: 'box' });
    var bands = [['fan wall A', fw], ['rack field', rowLen], ['cross aisle', cross], ['CDU gallery', cduDepth], ['fan wall B', fw]], yb = 0;
    bands.forEach(function (b) { s.areas.push({ x: X(0), y: Y(yb), w: Lm * SC, h: b[1] * SC, kind: 'zone' }); b.y = yb; yb += b[1]; });
    // fire zones of the hall from the inventory: Z05–Z08 rack-row quarters, Z01–Z04 CDU-line quarters
    var inv = o && o.fire, zones = inv ? inv.zones.filter(function (z) { return z.hall === 1 && z.n <= 8; }) : [];
    zones.forEach(function (z) {
      var q = (z.n - 1) % 4, isRack = z.n >= 5, zx = X(q * Lm / 4) + 2, zw = Lm / 4 * SC - 4;
      var zy = isRack ? Y(bands[1].y) + 2 : Y(bands[3].y) + 2, zh = (isRack ? rowLen : cduDepth) * SC - 4;
      // the zone tag sits in the cross aisle beside its zone (racks and CDUs fill the zone itself)
      s.notes.push({ x: zx + 4, y: isRack ? Y(bands[2].y) + 11 : Y(bands[3].y) - 4, text: 'Z' + pad(z.n), role: 'tag' });
      s.n({ id: 'zone-' + z.id.toLowerCase(), tag: 'Z' + pad(z.n), box: [zw, zh], x: zx + zw / 2, y: zy + zh / 2, cls: 'fire-zone', eqId: z.id, tagAt: 'none', boxSym: 'fire-zone', lod: 1, label: 'Fire zone ' + z.id.slice(-3) + ' ' + z.name + ' — ' + Math.round(z.areaM2) + ' m², ' + z.means.length + ' detection means' + (z.release ? ', clean-agent release' : '') });
    });
    // fan-wall modules (CRAH units) along the two galleries, every one clickable
    var fwPitch = Lm / fwMods, k = 1;
    [bands[0], bands[4]].forEach(function (g, gi) {
      for (var i = 0; i < fwMods && k <= crahs; i++, k++) {
        var cx = X((i + 0.5) * fwPitch), cy = Y(g.y + fw / 2);
        s.n({ id: 'crah' + pad(k), tag: 'FW-' + pad(k), box: [fwPitch * SC - 2, fw * SC - 6], x: cx, y: cy, cls: 'crah', eqId: String(k), tagAt: 'none', boxSym: 'fanwall', label: 'Fan-wall module ' + pad(k) + ' (CRAH), gallery ' + (gi ? 'B' : 'A') });
      }
    });
    // rack rows: each row runs across the rack field; racks are boxes to scale, cold aisle toward gallery A
    var fieldY = bands[1].y, yCold = fieldY, gi = 0;
    for (var r = 1; r <= rows; r++) {
      var rx = (r - 1) * rowPitch + cold;          // rack face after the cold aisle of this row pitch
      for (var p = 1; p <= perRow; p++) {
        var id = 'R' + pad(r) + '-' + pad(p), ym = fieldY + (p - 0.5) * pitch;
        s.n({ id: id.toLowerCase(), tag: id, box: [depth * SC - 1.5, pitch * SC - 1.5], x: X(rx + depth / 2), y: Y(ym), cls: 'rack-unit', eqId: id, tagAt: 'none', boxSym: 'rack-plan', label: 'Rack ' + id + ' — row ' + r + ', position ' + p + ' (GB300 NVL72)' });
      }
      if (r % 5 === 1) s.notes.push({ x: X(rx + depth / 2) - 6, y: Y(fieldY) - 6, text: 'ROW ' + pad(r), role: 'tag', lod: 2 });
      // aisle hatch: cold (before the rack) and hot (after) as thin zones
      s.areas.push({ x: X(rx - cold), y: Y(fieldY), w: cold * SC, h: rowLen * SC, kind: 'zone' });
    }
    // CDU line in the gallery: every installed CDU as a box to scale (1.2 × 0.8 m class), standby last
    var cduPitch = Lm / cdus;
    for (var c = 1; c <= cdus; c++) s.n({ id: 'cdu' + pad(c), tag: 'CDU-' + pad(c), box: [Math.min(1.2, cduPitch - 0.1) * SC, 0.8 * SC], x: X((c - 0.5) * cduPitch), y: Y(bands[3].y + cduDepth / 2), cls: 'cdu', eqId: String(c), tagAt: 'none', boxSym: 'cdu-plan', label: 'CDU-' + pad(c) + (c > need(snap, 'equipment.cdu_duty_per_hall') ? ' (standby)' : '') });
    // doors (double, 1.8 m) on the short walls, egress routes along the cross aisle
    [[0, 'W'], [Lm, 'E']].forEach(function (d) { s.n({ id: 'door-' + d[1].toLowerCase(), tag: 'DOOR ' + d[1], box: [6, 1.8 * SC], x: X(d[0]), y: Y(bands[2].y + cross / 2), tagAt: 'none', boxSym: 'door', label: 'Double fire door, ' + d[1] + ' wall, 1.8 m, 90 min (EI 90)' }); });
    s.e([X(0) + 6, Y(bands[2].y + cross / 2)], [X(Lm) - 6, Y(bands[2].y + cross / 2)], 'signal', { w: 'signal', line: 'EGRESS ' + Lm + ' m' });
    // ancillary rooms beside the hall (fire zones Z09–Z12), drawn as a strip to the right, to scale by area
    var rooms = inv ? inv.zones.filter(function (z) { return z.hall === 1 && z.n >= 9; }) : [], ry = [0, 0];
    rooms.forEach(function (z, i) {
      var col = i % 2, rw = 9, rh = z.areaM2 / rw;   // two columns of 9 m deep rooms, to scale by area
      s.n({ id: 'room-' + z.id.toLowerCase(), tag: 'Z' + pad(z.n), box: [rw * SC - 4, rh * SC - 4], x: X(Lm) + 120 + col * (rw * SC + 6) + rw * SC / 2, y: Y(ry[col] + rh / 2), cls: 'fire-zone', eqId: z.id, tagAt: 'none', boxSym: 'room', text: 'Z' + pad(z.n) + ' · ' + z.name, textRole: 'tag', textAt: 'top', label: z.name + ', ' + z.areaM2 + ' m² — zone ' + z.id.slice(-3) + (z.epo ? ', zoned EPO' : '') });
      ry[col] += rh;
    });
    s.areas.push({ x: X(Lm) + 112, y: Y(0) - 20, w: 2 * (9 * SC + 6) + 10, h: Math.max(ry[0], ry[1]) * SC + 25, label: 'L2 SUPPORT', kind: 'box' });
    // scale bar and north arrow
    s.e([X(0), H - 22], [X(10), H - 22], 'signal', { w: 'main', line: '10 m' });
    s.notes.push({ x: X(Lm) + 8, y: Y(0) - 10, text: 'N ↑', role: 'tag' });
    return finish(s);
  }

  /* ── DH-B-101: BMS / DCIM architecture — L3 servers and applications, L2 redundant ring and LDCs, L1 controllers and gateways, L0 field groups ── */
  function dhB101(snap, o) {
    var M = o && o.bms; if (!M || !M.field) throw new Error('hmi-sheets: dh-b-101 needs the page BMS model (window.BMS_MODEL)');
    var W = 1240, H = 800, s = Sheet({ id: 'dh-b-101', no: 'DH-B-101', title: 'BMS ARCHITECTURE', size: [W, H], svgId: 'bmsSvg', sheet: '1/2', basis: 'BMS model + engine' });
    var lvl = function (y, h, label) { s.areas.push({ x: 20, y: y, w: W - 40, h: h, label: label, kind: 'box' }); };
    lvl(40, 150, 'L3 OPS'); lvl(205, 160, 'L2 RING'); lvl(380, 200, 'L1 CTRL'); lvl(595, 150, 'L0 FIELD');
    // L3: servers (primary / standby) and applications on a server LAN
    var lanY = 150, lanL = s.j('lan-l', 60, lanY, false), lanR = s.j('lan-r', W - 60, lanY, false); s.e(lanL, lanR, 'data', { w: 'bus', line: 'SERVER LAN · redundant' });
    (M.server || []).forEach(function (sv, i) {
      var x = 120 + i * 140, id = s.n({ id: 'srv-' + sv.id.toLowerCase(), tag: sv.id, sym: 'netServer', x: x, y: 90, size: 36, cls: 'bms-server', eqId: sv.id, tagAt: 'right', standby: /standby/i.test(sv.role), label: sv.role + ' supervisory server at ' + sv.at });
      s.e(id + '.nic', [x, lanY], 'data', { w: 'branch', vfirst: true }); s.j('lan-s' + i, x, lanY, true);
    });
    (M.app || []).forEach(function (ap, i) {
      var x = 460 + i * 180, id = s.n({ id: 'app-' + ap.id.toLowerCase(), tag: ap.id, box: [150, 30], x: x, y: 90, cls: 'bms-app', eqId: ap.id, tagAt: 'none', boxSym: 'app', text: ap.id, textRole: 'tag', label: ap.id + ' — ' + ap.fn + ' (source: ' + ap.src + ')' });
      s.e(id + '.bottom', [x, lanY], 'data', { w: 'branch' }); s.j('lan-a' + i, x, lanY, true);
    });
    // L2: the fibre ring — switches on a closed loop, LDCs hanging off their nearest switch
    var ring = M.ring || [], rx0 = 110, rdx = (W - 220) / Math.max(1, ring.length - 1), ringY = 250, sw = [];
    ring.forEach(function (r, i) { sw.push(s.n({ id: 'sw-' + r.id.toLowerCase(), tag: r.id, sym: 'netSwitch', x: rx0 + i * rdx, y: ringY, size: 30, cls: 'bms-network', eqId: r.id, tagAt: 'below', label: (r.id === 'CORE' ? 'Ring core switch' : 'Ring switch') + ' at ' + r.at + ' — 10G fibre, RSTP < 50 ms' })); });
    for (var i = 1; i < sw.length; i++) s.e(sw[i - 1] + '.down', sw[i] + '.down', 'data', { w: 'main', via: [[rx0 + (i - 1) * rdx, ringY + 34], [rx0 + i * rdx, ringY + 34]], line: i === 1 ? 'FIBRE RING A' : undefined });
    s.e(sw[sw.length - 1] + '.up', sw[0] + '.up', 'data', { w: 'main', via: [[rx0 + (sw.length - 1) * rdx, ringY - 34], [rx0, ringY - 34]], line: 'FIBRE RING B' });
    var core = sw[Math.max(0, ring.map(function (r) { return r.id; }).indexOf('CORE'))];
    s.e(core + '.up', [rx0 + ring.map(function (r) { return r.id; }).indexOf('CORE') * rdx, lanY], 'data', { w: 'main' });
    (M.ldc || []).forEach(function (d, i) {
      var x = 140 + i * 230, id = s.n({ id: 'ldc-' + d.id.toLowerCase(), tag: d.id, sym: 'instPanel', x: x, y: 330, size: 26, cls: 'bms-ldc', eqId: d.id, tagAt: 'right', inst: 'HMI', label: d.id + ' local display at ' + d.at + ' — ' + d.panel + ' (IEC 62443 L2)' });
      var near = sw[Math.min(sw.length - 1, Math.round((x - rx0) / rdx))];
      s.e(near + '.down', id, 'data', { w: 'branch' });
    });
    // L1: controllers under their ring switch, gateways as interface modules on a fieldbus trunk
    var ctlY = 440, plc = M.plc || [];
    plc.forEach(function (c, i) {
      var x = 90 + i * 150, id = s.n({ id: 'ctl-' + c.id.toLowerCase(), tag: c.id, sym: 'bmsController', x: x, y: ctlY, size: 32, cls: 'bms-controller', eqId: c.id, tagAt: 'right', label: c.id + ' — ' + c.fam + ' controller for ' + c.serves + ', ' + c.pts + ' points', values: [{ k: 'pts', dx: 22, dy: 14, anchor: 'start', lod: 2 }] });
      var near = sw[Math.min(sw.length - 1, Math.round((x - rx0) / rdx))];
      s.e(near + '.down', id + '.net', 'data', { w: 'branch', vfirst: true });
    });
    var gwY = 530, gw = M.gateway || [];
    gw.forEach(function (g, i) {
      var x = 110 + i * 165, id = s.n({ id: 'gw-' + String(g.id).toLowerCase().replace(/[^a-z0-9]+/g, '-'), tag: g.tag, sym: 'interfaceModule', x: x, y: gwY, size: 24, cls: 'bms-gateway', eqId: g.id, tagAt: 'right', label: g.id + ' gateway ' + g.tag + ': ' + g.from + ' → ' + g.to + ' on ' + g.port + ', polled ' + g.poll });
      var ctl = plc.length ? 'ctl-' + plc[Math.min(plc.length - 1, i)].id.toLowerCase() : null;
      if (ctl) s.e(ctl + '.io1', id + '.out', 'signal', { w: 'signal' });
    });
    // L0: field groups as boxes with the device count — the CDU group follows the engine (cdu_installed_facility)
    var fy = 690, fw = (W - 60) / Math.max(1, M.field.length);
    M.field.forEach(function (f, i) {
      var x = 30 + (i + 0.5) * fw, n = f.engine && isFinite(need(snap, 'equipment.cdu_installed_facility')) ? need(snap, 'equipment.cdu_installed_facility') : f.n;
      var id = s.n({ id: 'fld-' + String(f.id).toLowerCase().replace(/[^a-z0-9]+/g, '-'), tag: f.id, box: [fw - 10, 44], x: x, y: fy, cls: 'bms-field', eqId: f.id, tagAt: 'none', boxSym: 'field-group', text: f.id + ' × ' + (n == null ? '—' : n), textRole: 'tag', textAt: 'top', label: f.d + ' — ' + (n == null ? '—' : n) + ' devices on ' + f.bus + ', polled ' + f.poll + '; ' + f.use + (f.engine ? ' (count from the engine)' : '') });
      var bus = String(f.bus), key = /REST/.test(bus) ? 'REST API' : /MS\/TP/.test(bus) ? 'BACnet MS/TP' : /BACnet/.test(bus) ? 'BACnet/IP' : /Modbus RTU/.test(bus) ? 'Modbus RTU' : /Modbus TCP/.test(bus) ? 'Modbus TCP' : /SNMP/.test(bus) ? 'SNMP v3' : null;
      var gi = gw.map(function (g) { return g.id; }).indexOf(key), gwId = gi >= 0 ? 'gw-' + String(gw[gi].id).toLowerCase().replace(/[^a-z0-9]+/g, '-') : null;
      if (gwId) s.e(id + '.top', gwId + '.loop', 'signal', { w: 'signal', vfirst: true });
      else if (plc.length) s.e(id + '.top', 'ctl-' + plc[Math.min(plc.length - 1, 6)].id.toLowerCase() + '.io2', 'signal', { w: 'signal', vfirst: true });   // dry contacts land on the fire / safety interface controller
      s.notes.push({ x: x - fw / 2 + 2, y: fy + 30, text: f.bus, role: 'line', lod: 2 });
    });
    return finish(s);
  }

  /* ── DH-N-102 corporate + DC internet edge: two carriers, carrier-side scrubbing, border router pair, NGFW pair,
     campus core → fabric (sheet DH-N-101). Data: the page-authored WAN architecture (o.wan = WAN_NODES). ─────────── */
  function dhN102(snap, o) {
    var wan = o && o.wan;
    if (!wan || !wan['1'] || !wan['6']) throw new Error('hmi-sheets: DH-N-102 needs the page WAN architecture');
    var W = 1240, H = 520, s = Sheet({ id: 'dh-n-102', no: 'DH-N-102', title: 'WAN EDGE', size: [W, H], svgId: 'wanSvg', sheet: '2/4', basis: 'page WAN architecture' });
    var lab = function (k) { var n = wan[k]; return n.tag + ' — ' + n.name + ' (' + n.mode + ')'; };
    var rows = [{ y: 170, f: 'A', isp: '1', sb: false }, { y: 350, f: 'B', isp: '2', sb: true }], ends = [];
    rows.forEach(function (r) {
      var isp = s.n({ id: 'isp' + r.isp, tag: 'ISP-' + r.isp, sym: 'netCarrier', x: 110, y: r.y, size: 40, cls: 'net-wan', eqId: r.isp, tagAt: 'below', standby: r.sb, label: lab(r.isp) });
      var sc = s.n({ id: 'scrub-' + r.f.toLowerCase(), tag: 'SCRUB-' + r.f, sym: 'netFirewall', x: 330, y: r.y, size: 32, cls: 'net-wan', eqId: '3', tagAt: 'below', label: lab('3') + ', carrier ' + r.f });
      var rt = s.n({ id: 'rtr-' + r.f.toLowerCase(), tag: 'RTR-' + r.f, sym: 'netRouter', x: 550, y: r.y, size: 34, cls: 'net-wan', eqId: '4', tagAt: 'below', label: lab('4') + ', chassis ' + r.f });
      var fw = s.n({ id: 'ngfw-' + r.f.toLowerCase(), tag: 'NGFW-' + r.f, sym: 'netFirewall', x: 770, y: r.y, size: 34, cls: 'net-wan', eqId: '5', tagAt: 'below', standby: r.sb, label: lab('5') + ', unit ' + r.f });
      s.e(isp, sc, 'data', { w: 'main', line: '800G · CIR 400G' });
      s.e(sc, rt, 'data', { w: 'main', line: 'eBGP' });
      s.e(rt, fw, 'data', { w: 'main' });
      ends.push(fw);
    });
    // pair links: iBGP between the routers, state sync between the firewalls
    s.e('rtr-a', 'rtr-b', 'data', { w: 'signal', line: 'iBGP · BFD' });
    s.e('ngfw-a', 'ngfw-b', 'data', { w: 'signal', line: 'SYNC' });
    var core = s.n({ id: 'core', tag: 'CORE', sym: 'netSwitch', x: 990, y: 260, size: 38, cls: 'net-wan', eqId: '6', tagAt: 'below', label: lab('6') });
    ends.forEach(function (f, i) { s.e(f, core, 'data', { w: 'main', via: [[880, i ? 350 : 170], [880, 260]] }); });
    var os = s.n({ id: 'os-n101', tag: 'DH-N-101', sym: 'offSheet', x: 1170, y: 260, size: 24, tagAt: 'below', label: 'To the compute fabric core tier (sheet DH-N-101)' });
    s.e(core, os + '.port', 'data', { w: 'main' });
    s.notes.push({ x: 990, y: 214, text: 'PK 576G · 72 % CIR', role: 'value', anchor: 'middle' });
    return finish(s);
  }

  /* ── DH-N-104 security zones and conduits (IEC 62443): eight zones from the Internet edge to life safety, each
     crossing a named conduit with its enforcement point. Data: page-authored zoning (o.zones = ZONES). ──────────── */
  function dhN104(snap, o) {
    var Z = o && o.zones, order = ['Z-EXT', 'Z4', 'Z3', 'ZF', 'ZM', 'Z2', 'Z1', 'Z0'];
    if (!Z || order.some(function (k) { return !Z[k]; })) throw new Error('hmi-sheets: DH-N-104 needs the page zoning');
    var ZH = 48, GAP = 44, X0 = 160, ZW = 820, H = 40 + order.length * (ZH + GAP), W = 1240;
    var s = Sheet({ id: 'dh-n-104', no: 'DH-N-104', title: 'SECURITY ZONES IEC 62443', size: [W, H], svgId: 'secSvg', sheet: '4/4', basis: 'page IEC 62443 zoning' });
    var CX = X0 + 140;
    var REF = { 'Z-EXT': 'DH-N-102', ZF: 'DH-N-101', Z2: 'DH-B-101', Z1: 'DH-B-101', Z0: 'DH-F-101' };   // the sheet that draws each zone's contents
    order.forEach(function (k, i) {
      var z = Z[k], y = 30 + i * (ZH + GAP);
      if (REF[k]) { var r = s.n({ id: 'os-' + k.toLowerCase(), tag: REF[k], sym: 'offSheet', x: X0 + ZW - 70, y: y + ZH / 2, size: 22, tagAt: 'right', label: k + ' contents on sheet ' + REF[k] }); }
      s.n({ id: 'zone-' + k.toLowerCase(), tag: k, box: [ZW, ZH], x: X0 + ZW / 2, y: y + ZH / 2, cls: 'net-zone', eqId: k, tagAt: 'none', boxSym: 'sec-zone',
        text: k + ' · ' + z.slt, textRole: 'tag', label: k + ' ' + z.name + ' — target ' + z.slt + '; enforcement: ' + z.enf + '; never: ' + z.never });
      if (i === order.length - 1) return;
      var m = /^(C\d+)\s*·\s*([^·]+)/.exec(z.outb || ''), cid = m ? m[1] : 'C' + (i + 1), proto = m ? m[2].trim() : '';
      var a = s.j('c' + i + 'a', CX, y + ZH, false), b = s.j('c' + i + 'b', CX, y + ZH + GAP, false);
      var ep = s.n({ id: 'ep-' + cid.toLowerCase(), tag: cid, sym: 'netFirewall', x: CX, y: y + ZH + GAP / 2, size: 22, tagAt: 'right',
        label: cid + ' ' + z.outb + ' — enforced by: ' + (Z[order[i + 1]].enf || '') });
      var monitor = /monitor/i.test(z.outb);
      s.e(a, ep, 'data', { w: monitor ? 'signal' : 'branch' });
      s.e(ep, b, 'data', { w: monitor ? 'signal' : 'branch', line: proto.toUpperCase().replace(/\s+/g, ' ').slice(0, 22) });
    });
    return finish(s);
  }

  var BUILDERS = { 'dh-m-103': dhM103, cdu: cduSheet, 'dh-e-101': dhE101, 'dh-r-101': dhR101, 'dh-f-101': dhF101, 'dh-e-001': dhE001, 'dh-n-101': dhN101, 'dh-a-101': dhA101, 'dh-b-101': dhB101, 'dh-n-102': dhN102, 'dh-n-104': dhN104 };
  var API = {
    build: function (id, snap, o) { if (!BUILDERS[id]) throw new Error('hmi-sheets: no sheet ' + id); return BUILDERS[id](snap, o); },
    list: function () { return Object.keys(BUILDERS); },
    version: '1.0.0'
  };
  if (root) root.RZDatahallAISheets = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
