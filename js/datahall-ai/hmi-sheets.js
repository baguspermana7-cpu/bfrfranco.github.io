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
  /* data halls on the campus: the engine publishes facility and per-hall installed counts, not the hall count itself */
  function hallsOf(snap) { return Math.round(need(snap, 'equipment.cdu_installed_facility') / need(snap, 'equipment.cdu_installed_per_hall')); }
  /* the fabric port class from the engine (compute.cx8_bandwidth_pbs over cx8_nics_facility = the published ConnectX-8 /
     Quantum-X800 port speed) — the network sheets printed a literal 400G against the modal's 800 Gb/s */
  function portG(snap) { return Math.round(need(snap, 'compute.cx8_bandwidth_pbs') * 1e6 / need(snap, 'compute.cx8_nics_facility')) + 'G'; }
  function finish(s) { delete s.n; delete s.j; delete s.e; delete s.chain; return s; }

  /* ── one CDU drawn in full: primary (HTW) side, plate HX, secondary pumps duty+standby, TCS out/in ──────────── */
  function cduDetail(s, o) {
    var id = o.id, X = o.x, Y = o.y, pumps = o.pumps, t = function (k) { var m = /^([A-Z]+)(\d*)$/.exec(k); return m[1] + '-' + id + m[2]; };
    var P = 'cdu' + id + '.';
    var hx = s.n({ id: P + 'hx', tag: 'HX-' + id, sym: 'hxPlate', name: 'PLATE HX', x: X + 220, y: Y + 270, size: 64, cls: 'cdu', eqId: String(Number(id)), label: 'CDU-' + id + ' plate heat exchanger',
      values: [{ k: 'duty', dx: 0, dy: 68, anchor: 'middle', lod: 1 }] });
    // primary supply: header tee -> isolation -> strainer -> flow element -> HX hot in
    var ps = s.n({ id: P + 'v1', tag: t('V1'), sym: 'valveBall', x: X + 80, y: Y + 60, size: 26, rot: 90, tagAt: 'left', lod: 3 });
    var st = s.n({ id: P + 'str1', tag: t('STR1'), name: 'STRAINER', sym: 'strainerY', x: X + 80, y: Y + 120, size: 28, rot: 90, tagAt: 'left', lod: 3 });
    var fe = s.n({ id: P + 'fe1', tag: t('FE1'), name: 'FWS FLOW', sym: 'flowMeter', x: X + 80, y: Y + 180, size: 26, rot: 90, tagAt: 'left', lod: 3 });
    s.e(o.hsIn, ps + '.a', 'htw', { w: 'branch' });
    s.chain([ps + '.b', st + '.inlet'], 'htw'); s.chain([st + '.outlet', fe + '.a'], 'htw');
    s.e(fe + '.b', hx + '.hotIn', 'htw', { vfirst: true, line: 'HTW-150-SS-' + id + '1' });
    // primary return: HX hot out -> control valve (TIC) -> balancing -> isolation -> header
    var tv = s.n({ id: P + 'tv1', tag: t('TV1'), name: 'FWS CONTROL VALVE', sym: 'valveControlMotor', x: X + 80, y: Y + 360, size: 30, rot: 90, tagAt: 'left',
      values: [{ k: 'pos', dx: -20, dy: 14, anchor: 'end' }] });
    var bv = s.n({ id: P + 'bv1', tag: t('BV1'), name: 'BALANCING VALVE', sym: 'valveBalancing', x: X + 80, y: Y + 430, size: 26, rot: 90, tagAt: 'left', lod: 3 });
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
      var pp = s.n({ id: P + 'p' + n, tag: 'P-' + id + String.fromCharCode(64 + n), name: 'TCS PUMP ' + n, sym: 'pumpVfd', x: hdrX + 110, y: py - 5, size: 40, cls: 'cdu', eqId: String(Number(id)), pump: n,
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
    var fe2 = s.n({ id: P + 'fe2', tag: t('FE2'), name: 'TCS FLOW', sym: 'flowMeter', x: disX, y: py0 + pumps * pdy + 20, size: 26, rot: 90, tagAt: 'right',
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
    var jr = s.j(P + 'jr', X + 300, o.retY), jet = s.j(P + 'jet', X + 280, o.retY);
    var et = s.n({ id: P + 'et', tag: t('PU1'), name: 'PRESSURISATION UNIT', sym: 'tankExpansion', x: X + 280, y: o.retY - 40, size: 30, tagAt: 'above', label: 'TCS pressurisation unit: expansion vessel, make-up pump, fill from treated water' });
    var dp = s.n({ id: P + 'dp', tag: t('DP1'), name: 'DOSING POT', sym: 'dosingPot', x: X + 440, y: o.retY - 40, size: 26, tagAt: 'above', label: 'TCS inhibitor dosing pot' });
    var as = s.n({ id: P + 'as', tag: t('AS1'), name: 'AIR / DIRT SEPARATOR', sym: 'airVent', x: X + 530, y: o.retY - 30, size: 26, tagAt: 'above', label: 'TCS air and dirt separator (removes residual air before the HX)' });
    var av = s.n({ id: P + 'av', tag: t('AV1'), name: 'AUTO AIR VENT', sym: 'airVent', x: X + 260, y: Y + 200, size: 22, tagAt: 'right', label: 'Automatic air vent at the HX high point' });
    s.e(av, [X + 220 + 0, Y + 238], 'tcs_r', { w: 'branch' });
    var tt4 = s.n({ id: P + 'tt4', tag: 'TT', sym: 'instField', x: X + 360, y: o.retY - 30, size: 26, tagAt: 'none', inst: 'TT',
      label: 'TCS return temperature, ' + t('TT4'), values: [{ k: 'tcsR', dx: 18, dy: 4, anchor: 'start' }] });
    var jas = s.j(P + 'jas', X + 530, o.retY, false), jdp = s.j(P + 'jdp', X + 440, o.retY, false);
    s.e(o.tcsIn, jas, 'tcs_r', { w: 'main', line: 'TCS-200-SS-' + id + '3' }); s.e(as, jas, 'tcs_r', { w: 'branch' }); s.e(jas, jdp, 'tcs_r', { w: 'main' }); s.e(jdp, jr, 'tcs_r', { w: 'main' });
    s.e(tt4 + '.process', [X + 360, o.retY], 'line', { w: 'inst' });
    s.e(jr, jet, 'tcs_r', { w: 'main' });
    s.e(jet, et + '.port', 'tcs_r'); s.e(dp, jdp, 'tcs_r', { w: 'branch' });
    s.e(jet, hx + '.coldIn', 'tcs_r', { w: 'main' });
    return { hx: hx, pumps: suc.length };
  }

  /* ── DH-M-103: the CDU line of one hall ───────────────────────────────────────────────────────────── */
  function dhM103(snap) {
    var installed = need(snap, 'equipment.cdu_installed_per_hall'), duty = need(snap, 'equipment.cdu_duty_per_hall');
    var W = 1240, H = 830, s = Sheet({ id: 'dh-m-103', no: 'DH-M-103', title: 'DH-01 CDU LINE', size: [W, H], svgId: 'coolSvg', sheet: '3/5' });
    s.legend = COOL_LEGEND; s.legendAt = [740, 30]; s.legendCols = 2;
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
    var halls = hallsOf(snap), upsPerFeed = Math.ceil(need(snap, 'equipment.ups_frames_per_feed') / halls), mx = X + 70;
    var D = function (k) { return need(snap, 'distribution.' + k); }, kva = need(snap, 'equipment.unit_sub_kva'), upsKw = need(snap, 'equipment.ups_frame_kw');
    var vLL = D('voltage_ll_v'), kv = D('mv_kv'), lvV = vLL >= 1000 ? (vLL / 1000) + ' kV' : vLL + ' V';
    var mva = function (k) { return k >= 1000 ? (Math.round(k / 100) / 10) + ' MVA' : Math.round(k) + ' kVA'; };
    var os = s.n({ id: 'os-mv' + L, tag: '20 kV BUS ' + L, sym: 'offSheet', x: mx, y: 26, size: 22, rot: 270, tagAt: 'right', label: '20 kV MV bus ' + L + ' (sheet DH-E-002)' });
    var cbMv = s.n({ id: 'cb-mv' + L, tag: 'Q-MV' + L + '01', name: 'MV FEEDER CB', rating: D('mv_feeder_rated_a') + ' A · ' + kv + ' kV', sym: 'cbDrawout', x: mx, y: 84, size: 34, cls: 'sld-mv-sub', eqId: L + '01', tagAt: 'right', label: 'MV feeder breaker ' + L + '01' });
    var ct = s.n({ id: 'ct-mv' + L, tag: 'CT', sym: 'currentTransformer', x: mx, y: 128, size: 22, tagAt: 'none', lod: 3, label: 'Current transformer, MV feeder ' + L + '01' });
    var rl = s.n({ id: 'rl-mv' + L, tag: '50/51', sym: 'protectionRelay', x: mx + 46, y: 128, size: 24, tagAt: 'none', inst: '50/51', label: 'Overcurrent relay (IEEE C37.2 50/51), MV feeder ' + L + '01' });
    var t1 = s.n({ id: 'tx' + L + '01', tag: 'TX-' + L + '01 … TX-' + L + pad(tx), name: 'UNIT SUBSTATION ×' + tx, rating: mva(kva) + ' · ' + kv + ' / ' + lvV, sym: 'transformer2w', x: mx, y: 186, size: 46, cls: 'sld-tx', eqId: L + '01', tagAt: 'right',
      label: 'Unit substation transformers ' + L + '01 … ' + L + pad(tx) + ' (one drawn, ' + tx + ' per feed per hall), ' + kv + ' kV / ' + lvV });
    var cbLv = s.n({ id: 'cb-lv' + L, tag: 'Q-LV' + L + '01', name: 'LV INCOMER ACB', sym: 'cbDrawout', x: mx, y: 250, size: 32, tagAt: 'right', label: 'LV incomer ' + L + '01 (ACB)' });
    s.chain([os + '.port', cbMv + '.line'], med, { w: 'main' });
    s.e(cbMv + '.load', ct + '.line', med, { w: 'main' }); s.e(ct + '.load', t1 + '.hv', med, { w: 'main', line: 'MV-' + L + '01 3×240 mm² Cu' });
    s.e(ct + '.secondary', rl + '.input', 'line', { w: 'signal' });
    s.e(t1 + '.lv', cbLv + '.line', med, { w: 'main' });
    // MSB busbar
    var by = 300, bL = s.j('msb' + L + 'l', X + 10, by, false), bM = s.j('msb' + L + 'm', mx, by), bU = s.j('msb' + L + 'u', mx + 150, by), bR = s.j('msb' + L + 'r', X + 470, by, false);
    s.e(cbLv + '.load', bM, med, { w: 'main' });
    s.chain(A ? [bL, bM, bU, bR] : [bR, bU, bM, bL].reverse(), med, { w: 'bus' });
    s.notes.push({ x: X + 14, y: by - 6, text: 'MSB-' + L + '01 · ' + lvV, role: 'tag' });
    // ATS: normal from the MSB, emergency from the generator bus
    var osG = s.n({ id: 'os-gen' + L, tag: 'GEN BUS', sym: 'offSheet', x: mx + 240, y: 330, size: 20, rot: 270, tagAt: 'right', label: 'Standby generator bus (sheet DH-E-003)' });
    var ats = s.n({ id: 'ats' + L, tag: 'ATS-' + L + '01', name: 'AUTO TRANSFER SW', sym: 'atsIec', x: mx + 162, y: 372, size: 36, cls: 'sld-msb', eqId: L + '01-ats', tagAt: 'right', label: 'Automatic transfer switch ' + L + '01 (CB-N + CB-E, interlocked)' });
    s.e(bU, ats + '.sourceA', med, { w: 'main' });
    s.e(osG + '.port', ats + '.sourceB', 'power', { w: 'main', vfirst: true });
    // UPS-01: input breaker, rectifier, DC link + battery, inverter, static bypass, maintenance bypass, output breaker
    var ux = mx + 150, jIn = s.j('ups' + L + 'in', ux, 420);
    s.e(ats + '.load', jIn, med, { w: 'main' });
    var qi = s.n({ id: 'qi' + L, tag: 'Q1', sym: 'cbIec', x: ux, y: 456, size: 26, tagAt: 'left', lod: 3, label: 'UPS input breaker' });
    var rec = s.n({ id: 'rec' + L, tag: 'REC', name: 'RECTIFIER', sym: 'rectifier', x: ux, y: 504, size: 34, cls: 'sld-ups-' + L.toLowerCase(), eqId: L + '01', tagAt: 'left', label: 'UPS-' + L + '01 rectifier' });
    var jdc = s.j('dc' + L, ux, 548);
    var inv = s.n({ id: 'inv' + L, tag: 'INV', name: 'INVERTER', sym: 'inverterIec', x: ux, y: 592, size: 34, cls: 'sld-ups-' + L.toLowerCase(), eqId: L + '01', tagAt: 'left', label: 'UPS-' + L + '01 inverter',
      values: [{ k: 'ups', dx: -24, dy: 30, anchor: 'end', lod: 1 }] });
    var bat = s.n({ id: 'bat' + L, tag: 'BAT-' + L + '01', name: 'BATTERY', sym: 'batteryIec', x: ux + 70, y: 590, size: 32, cls: 'battery-' + L.toLowerCase(), eqId: L + '01', tagAt: 'right', label: 'Battery string ' + L + '01' });
    var qb = s.n({ id: 'qb' + L, tag: 'QB', sym: 'cbIec', x: ux + 70, y: 548 - 0, size: 22, rot: 90, tagAt: 'above', lod: 3, label: 'Battery breaker' });
    s.e(jIn, qi + '.line', med); s.e(qi + '.load', rec + '.ac', med); s.e(rec + '.dc', jdc, 'dc'); s.e(jdc, inv + '.dc', 'dc');
    s.e(jdc, qb + '.line', 'dc'); s.e(qb + '.load', bat + '.pos', 'dc', { vfirst: false });
    var jOut = s.j('ups' + L + 'out', ux, 650);
    var qo = s.n({ id: 'qo' + L, tag: 'Q2', sym: 'cbIec', x: ux, y: 628, size: 22, tagAt: 'left', lod: 3, label: 'UPS output breaker' });
    s.e(inv + '.ac', qo + '.line', med); s.e(qo + '.load', jOut, med);
    var sbx = ux - 70, ss = s.n({ id: 'ss' + L, tag: 'SS', name: 'STATIC BYPASS', sym: 'staticSwitch', x: sbx, y: 540, size: 32, tagAt: 'left', label: 'UPS-' + L + '01 static bypass' });
    s.e(jIn, ss + '.line', med, { via: [[sbx, 420]] }); s.e(ss + '.load', jOut, med, { via: [[sbx, 650]] });
    var mbx = ux - 124, mb = s.n({ id: 'mb' + L, tag: 'Q3', sym: 'cbIec', x: mbx, y: 540, size: 26, tagAt: 'left', lod: 3, label: 'Maintenance bypass breaker (normally open)' });
    s.e(jIn, mb + '.line', med, { via: [[mbx, 420]] }); s.e(mb + '.load', jOut, med, { via: [[mbx, 650]] });
    s.areas.push({ x: mbx - 34, y: 404, w: 250, h: 262, label: 'UPS-' + L + '01 … UPS-' + L + pad(upsPerFeed) + ' · ' + upsKw + ' kW ×' + upsPerFeed, kind: 'box' });
    // UPS output bus -> busway trunk -> tap-off -> rack PSU (the rack is drawn once, between the feeds)
    var oy = 700, oL = s.j('ob' + L + 'l', X + 10, oy, false), oM = s.j('ob' + L + 'm', ux, oy), oR = s.j('ob' + L + 'r', X + 470, oy, false);
    s.e(jOut, oM, med, { w: 'main' }); s.chain(A ? [oL, oM, oR] : [oR, oM, oL].reverse(), med, { w: 'bus' });
    s.notes.push({ x: X + 14, y: oy - 6, text: 'UPS OUT ' + L + ' · ' + lvV, role: 'tag' });
    var qbw = s.n({ id: 'qbw' + L, tag: 'Q-BW' + L, name: 'BUSWAY CB', sym: 'cbIec', x: ux, y: 736, size: 26, tagAt: 'right', label: 'Busway trunk breaker ' + L });
    var bw = s.j('bw' + L, ux, 790), tap = s.n({ id: 'tap' + L, tag: 'TAP-' + L + '07', name: 'TAP-OFF R07', sym: 'busTap', x: A ? ux + 120 : ux - 120, y: 822, size: 26, tagAt: 'right', label: 'Busway tap-off to rack R07, feed ' + L });
    s.e(oM, qbw + '.line', med, { w: 'main' }); s.e(qbw + '.load', bw, med, { w: 'bus', line: 'BUSWAY-' + L + ' ' + D('busway_trunk_a').toLocaleString('en-US') + ' A' });
    var bwEnd = s.j('bwe' + L, A ? X + 470 : X + 10, 790, false), bwt = s.j('bwt' + L, A ? ux + 120 : ux - 120, 790);
    s.e(bw, bwt, med, { w: 'bus' }); s.e(bwt, bwEnd, med, { w: 'bus' }); s.e(bwt, tap + '.bus', med);
    // one unit drawn per type, multiplicity in its tag range and name (standard SLD practice) — no grids of icons
    return { tap: tap, busM: bM };
  }
  function dhE101(snap, o) {
    // one builder for every hall: the engine sizes each data hall identically, so DH-02 ... DH-08 differ only in name
    var hn = (o && o.hall) || 1, hp = pad(hn), halls = hallsOf(snap);
    if (hn < 1 || hn > halls) throw new Error('hmi-sheets: no data hall ' + hn);
    var W = 1240, H = 1000, s = Sheet({ id: 'dh-e-1' + hp, no: 'DH-E-1' + hp, title: 'DH-' + hp + ' SLD FEED A/B', size: [W, H], svgId: 'elecDH' + hn + 'Svg', sheet: hn + '/' + halls });
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
    var txN = need(snap, 'distribution.main_tx_total'), txMva = need(snap, 'distribution.main_tx_mva'), halls = hallsOf(snap), gens = need(snap, 'equipment.gensets_installed'), genDuty = need(snap, 'equipment.gensets_duty'), genKw = need(snap, 'equipment.generator_unit_kw');
    var feeders = need(snap, 'distribution.mv_feeders_per_hall_per_feed'), kaRated = need(snap, 'distribution.mv_board_ka_rating'), kaFault = need(snap, 'distribution.mv_fault_ka_per_section');
    // HV intake: every line bay drawn (4), duty count from the engine; double busbar at 150 kV
    var busY = 150, busA = s.j('hv-bus-l', 90, busY, false), busB = s.j('hv-bus-r', Math.max(90 + (lines - 1) * 150 + 60, 650 + (hallsOf(snap) - 2) * 78 + 20), busY, false);   // reaches the other halls' tee-offs
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
      var tx = s.n({ id: 'tx-main' + L, tag: 'TX-M' + L + '01', name: 'MAIN TRANSFORMER', rating: txMva + ' MVA · ' + hvKv + ' / ' + mvKv + ' kV', sym: 'transformer2w', x: x, y: 262, size: 48, cls: 'sld-main-tx', eqId: L + '01', tagAt: 'right', label: 'Main transformer ' + L + '01, ' + txMva + ' MVA, ' + hvKv + ' / ' + mvKv + ' kV, ONAN/ONAF', values: [{ k: 'load', dx: 32, dy: 16, anchor: 'start' }] });
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
    // the other halls: one main-transformer pair each (TX-M03 / M04 for DH-02 ...), drawn as off-sheets to their SLD
    var txPer = Math.round(txN / halls);
    for (var h = 2; h <= halls; h++) {
      var ox = 650 + (h - 2) * 78;
      s.n({ id: 'os-hall' + h, tag: 'DH-' + pad(h), name: 'TX-M' + pad((h - 1) * txPer + 1) + '/' + pad(h * txPer), sym: 'offSheet', x: ox, y: 330, size: 18, rot: 90, tagAt: 'below', label: 'Main transformers TX-M' + pad((h - 1) * txPer + 1) + ' … ' + pad(h * txPer) + ' (' + txMva + ' MVA) and the boards of DH-' + pad(h) + ' (sheet DH-E-1' + pad(h) + ')' });
      s.e([ox, busY], 'os-hall' + h + '.port', 'power', { w: 'branch' }); s.j('hv-h' + h, ox, busY, true);
    }
    // generation: paralleling switchgear at 20 kV, two sets drawn, the rest as a grid; gen bus to each board through a breaker
    var gY = 640, gbA = s.j('gen-bus-l', 120, gY, false), gbB = s.j('gen-bus-r', 1180, gY, false);
    s.e(gbA, gbB, 'power', { w: 'bus', line: 'GEN BUS ' + mvKv + ' kV · ' + genDuty + ' duty of ' + gens });
    for (var g = 1; g <= 2; g++) {   // one duty set and one standby set drawn; the tag range carries the whole yard
      var sb = g === 2, gTag = sb ? 'G-' + (genDuty + 1) + ' … G-' + gens : 'G-01 … G-' + genDuty;
      var gx = 160 + (g - 1) * 260, gen = s.n({ id: 'gen' + g, tag: gTag, name: (sb ? 'DIESEL GEN STANDBY ×' + (gens - genDuty) : 'DIESEL GEN DUTY ×' + genDuty), rating: genKw / 1000 + ' MW · ' + mvKv + ' kV', standby: sb, sym: 'generatorIec', x: gx, y: 760, size: 40, cls: 'site-genset-yard', eqId: 'G' + pad(sb ? genDuty + 1 : 1), tagAt: 'below', label: 'Diesel generators ' + gTag + ', ' + genKw / 1000 + ' MW, ' + mvKv + ' kV (' + need(snap, 'equipment.generator_redundancy') + ')' });
      var gcb = s.n({ id: 'cb-g' + g, tag: '52G', sym: 'cbIec', x: gx, y: 700, size: 22, tagAt: 'none', lod: 2, label: 'Generator breaker 52G-' + pad(g) + ' with synchronising check (25)' });
      s.e(gen + '.out', gcb + '.load', 'power', { w: 'main', vfirst: true }); s.e(gcb + '.line', [gx, gY], 'power', { w: 'main' }); s.j('gt' + g, gx, gY, true);
    }
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
      for (var k = 1; k <= o.drawn; k++) ids.push(s.n({ id: (o.prefix + pad(k)).toLowerCase(), tag: o.prefix + pad(k), sym: o.sym, x: x0 + (k - 1) * dx, y: o.y, size: 34, cls: o.cls, eqId: String(k), tagAt: 'below', label: o.label + ' ' + pad(k) + ' — ' + radix + ' × ' + portG(snap) + ' ports', values: [{ k: 'util', dx: 0, dy: -24, anchor: 'middle', lod: 2 }] }));
      // no icon grid: the tier's range and count print beside its last drawn member (owner R149: no odd boxes)
      s.notes.push({ x: x0 + (o.drawn - 1) * dx + 40, y: o.y + 4, text: '… ' + o.prefix + o.n, role: 'tag' });
      s.notes.push({ x: x0 + (o.drawn - 1) * dx + 40, y: o.y + 19, text: o.label.toUpperCase().replace(/ \(.*\)/, '') + ' ×' + o.n + ' · ' + radix + '×' + portG(snap), role: 'value' });
      return ids;
    };
    var C = tier({ prefix: 'CORE-', n: cores, drawn: 6, y: 130, cls: 'net-core', label: 'Core switch', sym: 'netSwitch' });
    var S = tier({ prefix: 'SPINE-', n: spines, drawn: 6, y: 340, cls: 'net-spine', label: 'Spine switch', sym: 'netSwitch' });
    var L = tier({ prefix: 'LEAF-', n: leaves, drawn: 6, y: 560, cls: 'net-leaf', label: 'Leaf switch (rail-aligned)', sym: 'netSwitch' });
    // full mesh between the drawn members of neighbouring tiers; the counts carry the whole hall
    // full mesh between tiers drawn as one mesh bus per tier gap (every member up / down to it); the link count is the value
    var mesh = function (lower, upper, y, links, lab) {
      var xs = lower.concat(upper).map(function (id) { return s.nodes.filter(function (n) { return n.id === id; })[0].x; });
      var l = s.j('mesh-' + y + '-l', Math.min.apply(null, xs) - 20, y, false), r = s.j('mesh-' + y + '-r', Math.max.apply(null, xs) + 20, y, false);
      s.e(l, r, 'data', { w: 'bus' });
      lower.forEach(function (id, k) { var x = xs[k]; s.e(id + '.up', [x, y], 'data', { w: 'branch' }); s.j('mesh-' + y + '-d' + k, x, y, true); });
      upper.forEach(function (id, k) { var x = xs[lower.length + k]; s.e([x, y], id + '.down', 'data', { w: 'branch' }); });
      s.notes.push({ x: Math.max.apply(null, xs) + 30, y: y + 4, text: links.toLocaleString('en-US') + ' ' + lab, role: 'value' });
    };
    mesh(S, C, 245, scLinks, 'SPINE–CORE LINKS · FULL MESH');
    mesh(L, S, 465, lsLinks, 'LEAF–SPINE LINKS · FULL MESH');
    // one rack's GPU rails on LEAF-01: the NIC rail of R07
    var rack = s.n({ id: 'rack-r07', tag: 'R07', box: [150, 44], x: 195, y: 730, cls: 'rack-ns', eqId: 'R07', tagAt: 'none', boxSym: 'rack', text: 'R07 · ' + gpuRack + ' × ' + portG(snap), textRole: 'tag', label: 'Rack R07 NIC rail: one ' + portG(snap) + ' rail per GPU to its leaf' });
    s.e(rack + '.top', L[0] + '.down', 'data', { w: 'main', line: gpuRack + ' × ' + portG(snap) });
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
    var s = Sheet({ id: 'dh-a-101', no: 'DH-A-101', title: 'DH-01 ROOM LAYOUT', size: [W, H], svgId: 'floorSvg', sheet: '1/3', basis: 'engine hall geometry' });
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

  /* ── DH-M-101 cooling overview: where every cooling plant item sits and which loop joins them (owner R149 "dimana
     crah, dimana chiller, dimana cdu ... bingung antara tcs dan fws"). Liquid path across the top, air path below, the
     condenser loop on the left; each block carries its tag range, name, installed / duty count and loop temperatures. */
  var COOL_LEGEND = [['htw', 'FWS — facility water (HTW)'], ['tcs_s', 'TCS supply — to racks'], ['tcs_r', 'TCS return'], ['chw', 'CHW — chilled water'], ['cw', 'CW — condenser water'], ['air', 'AIR — fan wall']];
  function dhM101(snap) {
    var E = function (k) { return need(snap, 'equipment.' + k); }, P = function (k) { return need(snap, 'design.planes.' + k); };
    var f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); }, halls = hallsOf(snap);
    var W = 1240, H = 560, s = Sheet({ id: 'dh-m-101', no: 'DH-M-101', title: 'COOLING OVERVIEW', size: [W, H], svgId: 'coolOverSvg', sheet: '1/5' });
    s.legend = COOL_LEGEND;
    var yL = 170, yA = 400;
    // liquid path: dry coolers -> FWS pumps -> CDU -> TCS -> racks
    var dc = s.n({ id: 'ov-dc', tag: 'DC-01 … DC-' + pad(E('dry_coolers_installed')), name: 'DRY COOLERS', rating: E('dry_coolers_running_design') + ' duty / ' + E('dry_coolers_installed'), sym: 'dryCoolerV', x: 150, y: yL, size: 56, cls: 'dry-cooler', eqId: '01', tagAt: 'below', label: 'Dry-cooler field on the roof (sheet DH-M-102)' });
    var pf = s.n({ id: 'ov-pfws', tag: 'P-FWS', name: 'FWS PUMP STATION', sym: 'pumpVfd', x: 380, y: yL, size: 44, cls: 'fws-pump-station', eqId: '1', tagAt: 'below', label: 'Facility water (FWS / HTW) pump station' });
    var cd = s.n({ id: 'ov-cdu', tag: 'CDU-01 … CDU-' + pad(E('cdu_installed_per_hall')), name: 'COOLANT DISTRIBUTION UNITS', rating: E('cdu_duty_per_hall') + ' duty / ' + E('cdu_installed_per_hall') + ' per hall × ' + halls, sym: 'cdu', x: 640, y: yL, size: 60, cls: 'cdu', eqId: '1', tagAt: 'below', label: 'Coolant distribution units on the CDU gallery of every hall (sheet DH-M-103)' });
    var rk = s.n({ id: 'ov-rack', tag: 'R01 … R' + need(snap, 'geometry.rack_rows') * need(snap, 'geometry.racks_per_row'), name: 'GB300 NVL72 RACKS', rating: need(snap, 'geometry.rack_rows') + ' rows × ' + need(snap, 'geometry.racks_per_row') + ' per hall', sym: 'rack', x: 1060, y: 285, size: 60, cls: 'rack-unit', eqId: 'R07', tagAt: 'below', label: 'Liquid-cooled racks: cold plates on the TCS, residual heat to the room air (sheet DH-M-104)' });
    s.e(dc, pf, 'htw', { w: 'main', line: 'FWS SUPPLY' }); s.e(pf, cd, 'htw', { w: 'main' });
    s.e(cd, dc, 'htw', { w: 'main', via: [[640, 90], [150, 90]], line: 'FWS RETURN' });
    s.notes.push({ x: 265, y: yL - 10, text: f1(P('p05_htw_supply_c')) + ' / ' + f1(P('p06_htw_return_c')) + ' °C', role: 'value', anchor: 'middle' });
    s.e(cd, rk, 'tcs_s', { w: 'main', via: [[880, yL], [880, 265]], line: 'TCS SUPPLY' });
    s.e(rk, cd, 'tcs_r', { w: 'main', via: [[1060, 110], [700, 110]], line: 'TCS RETURN' });
    s.notes.push({ x: 890, y: yL - 10, text: f1(P('p07_tcs_supply_c')) + ' / ' + f1(P('p08_tcs_return_c')) + ' °C', role: 'value' });
    // loop accessories that keep each closed loop full, pressurised and free of air
    var acc = function (id, tag, name, sym, x, y, med, to) { var n = s.n({ id: id, tag: tag, name: name, sym: sym, x: x, y: y, size: 26, tagAt: 'below', label: name.toLowerCase() + ' — ' + tag }); s.e(n, to, med, { w: 'branch' }); return n; };
    var jF = s.j('ov-jf', 470, yL, false), jT = s.j('ov-jt', 780, 110, false);
    acc('ov-pu-fws', 'PU-FWS', 'PRESSURISATION', 'tankExpansion', 470, 250, 'htw', jF);
    acc('ov-dg-fws', 'DG-FWS', 'DEGASSER', 'airVent', 530, 250, 'htw', [530, yL]);
    acc('ov-pu-tcs', 'PU-TCS', 'PRESSURISATION', 'tankExpansion', 780, 40, 'tcs_r', jT);
    acc('ov-dg-tcs', 'DG-TCS', 'DEGASSER', 'airVent', 840, 40, 'tcs_r', [840, 110]);
    // air path: chillers -> CHW -> fan walls -> air to the hall
    var ch = s.n({ id: 'ov-ch', tag: 'CH-01 … CH-' + pad(E('chillers_installed')), name: 'CHILLERS', rating: E('chillers_running_design') + ' run / ' + E('chillers_installed'), sym: 'chillerWater', x: 380, y: yA, size: 56, cls: 'chiller', eqId: '1', tagAt: 'below', label: 'Chiller plant (sheet DH-M-102)' });
    var fw = s.n({ id: 'ov-fw', tag: 'FW-01 … FW-' + pad(E('crah_installed_per_hall')), name: 'FAN WALL CRAH', rating: E('crah_duty_per_hall') + ' duty / ' + E('crah_installed_per_hall') + ' per hall', sym: 'crah', x: 760, y: yA, size: 56, cls: 'crah', eqId: '1', tagAt: 'below', label: 'Fan-wall CRAH galleries along both long walls (sheet DH-M-105)' });
    s.e(ch, fw, 'chw', { w: 'main', line: 'CHW' });
    s.notes.push({ x: 570, y: yA - 10, text: f1(P('p12_chw_supply_c')) + ' / ' + f1(P('p13_chw_return_c')) + ' °C', role: 'value', anchor: 'middle' });
    s.e(fw, rk, 'air', { w: 'main', via: [[1060, yA]], line: 'COLD AISLE' });
    s.notes.push({ x: 900, y: yA - 10, text: f1(P('p09_air_supply_c')) + ' / ' + f1(P('p11_air_return_c')) + ' °C', role: 'value' });
    acc('ov-pu-chw', 'PU-CHW', 'PRESSURISATION', 'tankExpansion', 570, 480, 'chw', [570, yA]);
    // condenser loop: chiller condensers reject to the same dry-cooler field
    var pc = s.n({ id: 'ov-pcw', tag: 'P-CW', name: 'CW PUMP STATION', sym: 'pumpVfd', x: 150, y: 330, size: 40, cls: 'cw-pump-station', eqId: '1', tagAt: 'right', label: 'Condenser water pump station' });
    s.e(ch, pc, 'cw', { w: 'branch', via: [[150, yA]], line: 'CW' }); s.e(pc, dc, 'cw', { w: 'branch' });
    s.notes.push({ x: 170, y: 365, text: f1(P('p15_cdw_supply_c')) + ' / ' + f1(P('p16_cdw_return_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 40, y: 34, text: 'AMB ' + f1(P('p00_ambient_db_c')) + ' °C', role: 'value' });
    return finish(s);
  }

  /* ── DH-M-102 heat rejection: the dry-cooler field rejects the HTW loop (free cooling to the CDU line, DH-M-103) and the
     chiller condensers (CW loop); chillers make CHW for the air path (CRAH, DH-M-105). Counts and temperatures from the
     engine snapshot; one clickable node per installed unit. ─────────────────────────────────────────────────────── */
  function dhM102(snap) {
    var dcN = need(snap, 'equipment.dry_coolers_installed'), dcRun = need(snap, 'equipment.dry_coolers_running_design');
    var chN = need(snap, 'equipment.chillers_installed'), chRun = need(snap, 'equipment.chillers_running_design');
    var P = function (k) { return need(snap, 'design.planes.' + k); }, f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
    var W = 1240, H = 720, s = Sheet({ id: 'dh-m-102', no: 'DH-M-102', title: 'HEAT REJECTION', size: [W, H], svgId: 'coolPlantSvg', sheet: '2/5' });
    s.legend = COOL_LEGEND;
    // dry-cooler field: two drawn in full, the rest one small clickable symbol each
    var dc1 = s.n({ id: 'dc01', tag: 'DC-01', name: 'DRY COOLER', sym: 'dryCoolerV', x: 110, y: 130, size: 46, cls: 'dry-cooler', eqId: '01', tagAt: 'below', label: 'Dry cooler DC-01, V-bank' });
    var dc2 = s.n({ id: 'dc02', tag: 'DC-02 … DC-' + pad(dcN), name: 'DRY COOLER ×' + dcN, rating: dcRun + ' duty', sym: 'dryCoolerV', x: 200, y: 130, size: 46, cls: 'dry-cooler', eqId: '02', tagAt: 'below', label: 'Dry cooler DC-02, V-bank' });
    s.notes.push({ x: 860, y: 30, text: 'AMB ' + f1(P('p00_ambient_db_c')) + ' °C', role: 'value', anchor: 'end' });
    // HTW loop: field -> pump station -> CDU line, and back
    var hS = s.j('htw-s', 110, 380, false), hR = s.j('htw-r', 200, 420, false);
    var pH = s.n({ id: 'p-htw', tag: 'P-FWS', name: 'FWS PUMP STATION', sym: 'pumpVfd', x: 520, y: 380, size: 34, cls: 'fws-pump-station', eqId: '1', tagAt: 'below', label: 'HTW pump station (facility water to the CDU line)' });
    var osS = s.n({ id: 'os-m103s', tag: 'DH-M-103', sym: 'offSheet', x: 1180, y: 380, size: 24, tagAt: 'below', label: 'HTW supply to the CDU line (sheet DH-M-103)' });
    var osR = s.n({ id: 'os-m103r', tag: 'DH-M-103', sym: 'offSheet', x: 1180, y: 420, size: 24, rot: 180, tagAt: 'below', label: 'HTW return from the CDU line (sheet DH-M-103)' });
    s.e(dc1, hS, 'htw', { w: 'main' }); s.e(hS, pH, 'htw', { w: 'main', line: 'HTW-600-CS-001' }); s.e(pH, osS + '.port', 'htw', { w: 'main' });
    s.e(osR + '.port', hR, 'htw', { w: 'main', line: 'HTW-600-CS-002' }); s.e(hR, dc2, 'htw', { w: 'main' });
    s.notes.push({ x: 760, y: 372, text: f1(P('p05_htw_supply_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 760, y: 436, text: f1(P('p06_htw_return_c')) + ' °C', role: 'value' });
    // FWS loop accessories on the return header: pressurisation (expansion vessel + make-up), vacuum degasser, dosing
    var fa = function (id, tag, name, sym, x) { var n = s.n({ id: id, tag: tag, name: name, sym: sym, x: x, y: 452, size: 24, tagAt: 'below', label: name.toLowerCase() + ' on the FWS return header' }); s.e(n, [x, 420], 'htw', { w: 'branch' }); return n; };
    fa('pu-fws', 'PU-FWS', 'PRESSURISATION', 'tankExpansion', 330); fa('dg-fws', 'DG-FWS', 'DEGASSER', 'airVent', 400); fa('dp-fws', 'DP-FWS', 'DOSING POT', 'dosingPot', 610);
    // chiller plant: condensers reject to the field over the CW loop; evaporators make CHW for the air path
    var ch1 = s.n({ id: 'ch01', tag: 'CH-01', name: 'CHILLER', sym: 'chillerWater', x: 110, y: 560, size: 46, cls: 'chiller', eqId: '1', tagAt: 'below', label: 'Chiller CH-01' });
    var ch2 = s.n({ id: 'ch02', tag: 'CH-02 … CH-' + pad(chN), name: 'CHILLER ×' + chN, rating: chRun + ' run at design', sym: 'chillerWater', x: 200, y: 560, size: 46, cls: 'chiller', eqId: '2', tagAt: 'below', label: 'Chiller CH-02' });
    var pC = s.n({ id: 'p-cw', tag: 'P-CW', name: 'CW PUMP STATION', sym: 'pumpVfd', x: 960, y: 250, size: 30, cls: 'cw-pump-station', eqId: '1', tagAt: 'right', label: 'Condenser water pump station (chiller condensers to the dry-cooler field)' });
    s.e(ch2, pC, 'cw', { w: 'branch', via: [[200, 495], [960, 495]], line: 'CW' }); s.e(pC, 'dc02', 'cw', { w: 'branch', via: [[960, 130]] });
    s.notes.push({ x: 972, y: 300, text: f1(P('p15_cdw_supply_c')) + ' / ' + f1(P('p16_cdw_return_c')) + ' °C', role: 'value' });
    var osA = s.n({ id: 'os-m105', tag: 'DH-M-105', sym: 'offSheet', x: 1180, y: 600, size: 24, tagAt: 'below', label: 'CHW to the air path, fan-wall CRAH units (sheet DH-M-105)' });
    s.e(ch1, osA + '.port', 'chw', { w: 'main', via: [[110, 640], [1100, 640], [1100, 600]], line: 'CHW' });
    var pch = s.n({ id: 'pu-chw', tag: 'PU-CHW', name: 'PRESSURISATION', sym: 'tankExpansion', x: 600, y: 610, size: 24, tagAt: 'above', label: 'CHW loop pressurisation' }); s.e(pch, [600, 640], 'chw', { w: 'branch' });
    var pcw = s.n({ id: 'pu-cw', tag: 'PU-CW', name: 'PRESSURISATION', sym: 'tankExpansion', x: 1040, y: 200, size: 24, tagAt: 'right', label: 'CW loop pressurisation' }); s.e(pcw, [960, 200], 'cw', { w: 'branch' });
    s.notes.push({ x: 1090, y: 660, text: f1(P('p12_chw_supply_c')) + ' / ' + f1(P('p13_chw_return_c')) + ' °C', role: 'value', anchor: 'end' });
    return finish(s);
  }

  /* ── DH-M-104 TCS to the rack rows: CDU line supply / return headers along the CDU gallery, one branch and manifold
     per rack row (rows × racks from the engine geometry), flow per rack as a value. ─────────────────────────────── */
  function dhM104(snap) {
    var rows = need(snap, 'geometry.rack_rows'), perRow = need(snap, 'geometry.racks_per_row');
    var lpm = need(snap, 'design.flows.tcs_rack_lpm'), P = function (k) { return need(snap, 'design.planes.' + k); };
    var W = 1240, H = 560, X0 = 110, DX = (W - 220) / (rows - 1), yS = 90, yR = 130;
    var s = Sheet({ id: 'dh-m-104', no: 'DH-M-104', title: 'DH-01 TCS ROWS', size: [W, H], svgId: 'coolRowsSvg', sheet: '4/5' });
    s.legend = COOL_LEGEND; s.legendAt = [640, 532]; s.legendCols = 3;
    var osS = s.n({ id: 'os-ts', tag: 'DH-M-103', sym: 'offSheet', x: 40, y: yS, size: 22, tagAt: 'below', label: 'TCS supply from the CDU line (sheet DH-M-103)' });
    var osR = s.n({ id: 'os-tr', tag: 'DH-M-103', sym: 'offSheet', x: 40, y: yR + 40, size: 22, rot: 180, tagAt: 'below', label: 'TCS return to the CDU line (sheet DH-M-103)' });
    var prevS = osS + '.port';
    for (var r = 1; r <= rows; r++) {
      var x = X0 + (r - 1) * DX, js = s.j('s' + r, x, yS, r < rows), jr = s.j('r' + r, x + 8, yR, r < rows);
      s.e(prevS, js, 'tcs_s', { w: 'main' }); prevS = js;                                   // supply header, CDU line -> row 20
      if (r === 1) s.e(jr, osR + '.port', 'tcs_r', { w: 'main', via: [[x + 8, yR + 40]] }); // return header, row 20 -> CDU line
      else s.e(jr, 'r' + (r - 1), 'tcs_r', { w: 'main' });
      var m = s.n({ id: 'row' + pad(r), tag: 'ROW ' + pad(r), box: [30, 300], x: x + 4, y: 330, cls: 'tcs-manifold', eqId: String(r), tagAt: 'none', boxSym: 'rack-row',
        text: pad(r), textRole: 'tag', textAt: 'top', marks: Array.apply(null, Array(perRow)).map(function (_, i) { return [4, 18 + i * (276 / perRow), 22, 276 / perRow - 3]; }),
        label: 'Rack row ' + pad(r) + ' — ' + perRow + ' racks on one supply / return manifold pair' });
      s.e(js, [x, 180], 'tcs_s', { w: 'branch' });          // supply branch into the row manifold (top of the row box)
      var bv = s.n({ id: 'bv' + pad(r), tag: 'BV-' + pad(r), sym: 'valveBalancing', x: x + 8, y: 155, size: 16, rot: 90, tagAt: 'none', lod: 2, label: 'Row ' + pad(r) + ' balancing valve (flow set per rack row)' });
      s.e([x + 8, 180], bv, 'tcs_r', { w: 'branch' }); s.e(bv, jr, 'tcs_r', { w: 'branch' });   // return branch through the row balancing valve
    }
    s.notes.push({ x: X0, y: 500, text: lpm.toFixed(0) + ' L/min/RACK', role: 'value' });
    var xe = X0 + (rows - 1) * DX;
    var av1 = s.n({ id: 'av-s', tag: 'AV-S', name: 'AIR VENT', sym: 'airVent', x: xe + 40, y: yS - 24, size: 18, tagAt: 'right', label: 'Automatic air vent at the end of the TCS supply header' }); s.e(av1, [xe + 40, yS], 'tcs_s', { w: 'branch' });
    var av2 = s.n({ id: 'av-r', tag: 'AV-R', name: 'AIR VENT', sym: 'airVent', x: xe + 48, y: yR + 24, size: 18, tagAt: 'right', label: 'Automatic air vent at the end of the TCS return header' }); s.e(av2, [xe + 48, yR], 'tcs_r', { w: 'branch' });
    s.e('s' + rows, [xe + 40, yS], 'tcs_s', { w: 'main' }); s.e([xe + 48, yR], 'r' + rows, 'tcs_r', { w: 'main' });
    s.notes.push({ x: X0, y: 60, text: P('p07_tcs_supply_c').toFixed(1) + ' / ' + P('p08_tcs_return_c').toFixed(1) + ' °C', role: 'value' });
    return finish(s);
  }

  /* ── L3 equipment sheets drawn inside the page's tier-2 modals (like CDU-nn): one unit in full, values from the
     engine design planes, every instrument clickable through the unit's own payload. ───────────────────────────── */
  function chillerL3(snap, o) {
    var id = pad((o && o.id) || 1), P = function (k) { return need(snap, 'design.planes.' + k); }, f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
    var kw = need(snap, 'equipment.chiller_unit_kwth'), cls = 'chiller', eq = String(Number(id));
    var s = Sheet({ id: 'chiller-' + id, no: 'CH-' + id, title: 'CHILLER CH-' + id, size: [900, 460], svgId: 'chL3Svg' });
    var ev = s.n({ id: 'evap', tag: 'EV-' + id, sym: 'hxShellTube', x: 250, y: 330, size: 70, cls: cls, eqId: eq, tagAt: 'below', label: 'Evaporator, CH-' + id + ' — ' + Math.round(kw) + ' kWth' });
    var cd = s.n({ id: 'cond', tag: 'CD-' + id, sym: 'hxShellTube', x: 250, y: 120, size: 70, cls: cls, eqId: eq, tagAt: 'above', label: 'Condenser, CH-' + id });
    var cp = s.n({ id: 'comp', tag: 'K-' + id, box: [70, 44], x: 470, y: 225, cls: cls, eqId: eq, tagAt: 'none', boxSym: 'compressor', text: 'K-' + id, textRole: 'tag', label: 'Compressor, CH-' + id });
    var xv = s.n({ id: 'xv', tag: 'XV-' + id, sym: 'valveControlMotor', x: 110, y: 225, size: 28, rot: 90, cls: cls, eqId: eq, tagAt: 'left', label: 'Electronic expansion valve, CH-' + id });
    // refrigerant circuit: evaporator -> compressor -> condenser -> expansion valve -> evaporator
    // refrigerant enters and leaves each shell on its top / bottom / left; water uses the right-hand nozzles
    s.e([250, 365], cp + '.bottom', 'agent', { w: 'branch', via: [[250, 400], [470, 400]], line: 'R-1234ze' });
    s.e(cp + '.top', [250, 85], 'agent', { w: 'branch', via: [[470, 50], [250, 50]] });
    s.e([215, 120], xv, 'agent', { w: 'branch', via: [[110, 120]] }); s.e(xv, [215, 330], 'agent', { w: 'branch', via: [[110, 330]] });
    // CHW through the evaporator, CW through the condenser, each with supply / return temperature transmitters
    var tt = function (nid, tag, x, y, med, lab) { return s.n({ id: nid, tag: tag, sym: 'tempSensor', x: x, y: y, size: 22, cls: cls, eqId: eq, tagAt: 'below', label: lab }); };
    var cIn = tt('tt-chwr', 'TT-' + id + '1', 760, 360, 'chw', 'CHW return temperature (into the evaporator)');
    var cOut = tt('tt-chws', 'TT-' + id + '2', 760, 300, 'chw', 'CHW supply temperature (out of the evaporator)');
    var wIn = tt('tt-cws', 'TT-' + id + '3', 760, 90, 'cw', 'CW supply temperature (into the condenser)');
    var wOut = tt('tt-cwr', 'TT-' + id + '4', 760, 150, 'cw', 'CW return temperature (out of the condenser)');
    s.e(cIn, [285, 345], 'chw', { w: 'main', via: [[640, 360], [640, 345]] }); s.e([285, 315], cOut, 'chw', { w: 'main', via: [[600, 315], [600, 300]] });
    s.e(wIn, [285, 105], 'cw', { w: 'main', via: [[640, 90], [640, 105]] }); s.e([285, 135], wOut, 'cw', { w: 'main', via: [[600, 135], [600, 150]] });
    s.notes.push({ x: 790, y: 364, text: f1(P('p13_chw_return_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 790, y: 304, text: f1(P('p12_chw_supply_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 790, y: 94, text: f1(P('p15_cdw_supply_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 790, y: 154, text: f1(P('p16_cdw_return_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 515, y: 229, text: 'TE ' + f1(P('p14_air_evap_refrig_c')) + ' · TC ' + f1(P('p17_cond_refrig_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 250, y: 440, text: Math.round(kw) + ' kWth', role: 'value', anchor: 'middle' });
    return finish(s);
  }
  function crahL3(snap, o) {
    var id = pad((o && o.id) || 1), P = function (k) { return need(snap, 'design.planes.' + k); }, f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
    var kw = need(snap, 'equipment.crah_unit_kwth'), duty = need(snap, 'equipment.crah_duty_per_unit_kwth'), cls = 'crah', eq = String(Number(id));
    var s = Sheet({ id: 'crah-' + id, no: 'FW-' + id, title: 'FAN WALL FW-' + id, size: [900, 440], svgId: 'crahL3Svg' });
    // air path left -> right: hot-aisle return, filter, CHW coil, fan array, cold-aisle supply
    var aIn = s.j('air-in', 40, 220, false), aOut = s.j('air-out', 860, 220, false);
    var flt = s.n({ id: 'flt', tag: 'F-' + id, sym: 'filterCartridge', x: 180, y: 220, size: 44, cls: cls, eqId: eq, tagAt: 'below', label: 'Filter bank, FW-' + id });
    var coil = s.n({ id: 'coil', tag: 'CC-' + id, sym: 'coolingCoil', x: 340, y: 220, size: 60, cls: cls, eqId: eq, tagAt: 'below', label: 'CHW cooling coil, FW-' + id + ' — ' + Math.round(kw) + ' kWth rated' });
    var fans = [0, 1, 2, 3].map(function (i) { return s.n({ id: 'fan' + i, tag: 'EF-' + id + (i + 1), sym: 'fanAxial', x: 540, y: 120 + i * 66, size: 40, cls: cls, eqId: eq, tagAt: 'right', label: 'EC fan ' + (i + 1) + ', FW-' + id }); });
    s.e(aIn, flt, 'air', { w: 'main', line: 'HOT AISLE' }); s.e(flt, coil, 'air', { w: 'main' });
    var fx = s.j('fan-in', 470, 220, false), fo = s.j('fan-out', 640, 220, false);
    s.e(coil, fx, 'air', { w: 'main' });
    fans.forEach(function (f, i) { var y = 120 + i * 66; s.e(fx, f, 'air', { w: 'branch', via: [[470, y]] }); s.e(f, fo, 'air', { w: 'branch', via: [[640, y]] }); });
    s.e(fo, aOut, 'air', { w: 'main', line: 'COLD AISLE' });
    // CHW to the coil through the control valve
    var tv = s.n({ id: 'tv', tag: 'TV-' + id, sym: 'valveControlMotor', x: 300, y: 380, size: 28, cls: cls, eqId: eq, tagAt: 'left', label: 'CHW control valve, FW-' + id });
    var chS = s.j('chw-s', 300, 425, false), chR = s.j('chw-r', 380, 425, false);
    s.e(chS, tv, 'chw', { w: 'branch', line: 'CHW' }); s.e(tv, coil, 'chw', { w: 'branch', via: [[300, 250]] }); s.e(coil, chR, 'chw', { w: 'branch', via: [[380, 250]] });
    var tr = s.n({ id: 'tt-ra', tag: 'TT-' + id + '1', sym: 'tempSensor', x: 100, y: 160, size: 22, cls: cls, eqId: eq, tagAt: 'above', label: 'Return air temperature' });
    var ts = s.n({ id: 'tt-sa', tag: 'TT-' + id + '2', sym: 'tempSensor', x: 760, y: 160, size: 22, cls: cls, eqId: eq, tagAt: 'above', label: 'Supply air temperature' });
    s.e(tr, [100, 220], 'signal', { w: 'signal' }); s.e(ts, [760, 220], 'signal', { w: 'signal' });
    s.notes.push({ x: 100, y: 128, text: f1(P('p11_air_return_c')) + ' °C', role: 'value', anchor: 'middle' });
    s.notes.push({ x: 760, y: 128, text: f1(P('p09_air_supply_c')) + ' °C', role: 'value', anchor: 'middle' });
    s.notes.push({ x: 400, y: 404, text: f1(P('p12_chw_supply_c')) + ' / ' + f1(P('p13_chw_return_c')) + ' °C', role: 'value' });
    s.notes.push({ x: 340, y: 306, text: Math.round(duty) + ' / ' + Math.round(kw) + ' kWth', role: 'value', anchor: 'middle' });
    return finish(s);
  }
  function batteryL3(snap, o) {
    var side = (o && o.side) || 'A', unit = pad((o && o.unit) || 1), cls = 'battery-' + side.toLowerCase();
    var frameKw = need(snap, 'equipment.ups_frame_kw'), frames = need(snap, 'equipment.ups_frames_total'), kwh = need(snap, 'equipment.battery_kwh');
    var perFrame = kwh / frames, strings = 4;
    var s = Sheet({ id: 'bat-' + side + unit, no: 'BAT-' + side + unit, title: 'BATTERY BAT-' + side + unit, size: [900, 420], svgId: 'batL3Svg' });
    var bus = s.j('dc-bus', 120, 80, false), busE = s.j('dc-bus-e', 760, 80, false);
    s.e(bus, busE, 'dc', { w: 'bus', line: 'DC BUS' });
    var inv = s.n({ id: 'inv', tag: 'UPS-' + side + unit, sym: 'inverterIec', x: 830, y: 80, size: 40, cls: 'sld-ups-' + side.toLowerCase(), eqId: side + unit, tagAt: 'below', label: 'UPS frame ' + side + unit + ' — ' + Math.round(frameKw) + ' kW' });
    s.e(busE, inv, 'dc', { w: 'main' });
    for (var i = 0; i < strings; i++) {
      var x = 180 + i * 160, cb = s.n({ id: 'cb' + i, tag: 'Q-B' + (i + 1), sym: 'cbIec', x: x, y: 150, size: 30, rot: 90, cls: cls, eqId: side + unit, tagAt: 'right', label: 'String breaker ' + (i + 1) });
      var fu = s.n({ id: 'fu' + i, tag: 'F-B' + (i + 1), sym: 'fuse', x: x, y: 210, size: 26, rot: 90, cls: cls, eqId: side + unit, tagAt: 'right', label: 'String fuse ' + (i + 1) });
      var bt = s.n({ id: 'bt' + i, tag: 'STR-' + (i + 1), sym: 'battery', x: x, y: 300, size: 46, rot: 90, cls: cls, eqId: side + unit, tagAt: 'below', label: 'Battery string ' + (i + 1) + ' of BAT-' + side + unit });
      s.e([x, 80], cb, 'dc', { w: 'branch' }); s.e(cb, fu, 'dc', { w: 'branch' }); s.e(fu, bt, 'dc', { w: 'branch' });
    }
    s.notes.push({ x: 120, y: 60, text: Math.round(perFrame) + ' kWh · ' + strings + ' STR', role: 'value' });
    return finish(s);
  }

  /* ── more L3 modal sheets (owner R149 "modalnya cuma tulisan"): pump station, rack-row manifold, chemical dosing, dry
     cooler. Where the engine publishes no count (pumps per station, fans per cooler) one typical unit is drawn and named
     "TYP." — never an invented number. ─────────────────────────────────────────────────────────────────────────── */
  function pumpStationL3(snap, o) {
    var cw = o && o.loop === 'cw', med = cw ? 'cw' : 'htw', T = cw ? 'CW' : 'FWS', P = function (k) { return need(snap, 'design.planes.' + k); };
    var tS = cw ? P('p15_cdw_supply_c') : P('p05_htw_supply_c'), tR = cw ? P('p16_cdw_return_c') : P('p06_htw_return_c');
    var s = Sheet({ id: 'ps-' + T.toLowerCase(), no: 'P-' + T, title: T + ' PUMP STATION', size: [900, 440], svgId: 'eqL3Svg' });
    s.legend = COOL_LEGEND.filter(function (l) { return l[0] === med; }); s.legendAt = [690, 14];
    var cls = cw ? 'cw-pump-station' : 'fws-pump-station', suc = [], dis = [];
    [['A', 'DUTY PUMP (TYP.)', false], ['B', 'STANDBY PUMP', true]].forEach(function (p, i) {
      var y = 150 + i * 150, js = s.j('js' + i, 160, y), jd = s.j('jd' + i, 720, y);
      var v1 = s.n({ id: 'v1' + i, tag: 'V-' + T + p[0] + '1', name: 'ISOLATION', sym: 'valveButterfly', x: 230, y: y, size: 24, tagAt: 'above' });
      var st = s.n({ id: 'st' + i, tag: 'STR-' + T + p[0], name: 'STRAINER', sym: 'strainerY', x: 300, y: y, size: 26, tagAt: 'above' });
      var pp = s.n({ id: 'p' + i, tag: 'P-' + T + p[0], name: p[1], rating: 'VFD', sym: 'pumpVfd', x: 420, y: y, size: 46, cls: cls, eqId: '1', standby: p[2], tagAt: 'below', label: T + ' pump ' + p[0] + (p[2] ? ' (standby)' : ' (duty)') });
      var cv = s.n({ id: 'cv' + i, tag: 'CV-' + T + p[0], name: 'CHECK VALVE', sym: 'valveCheck', x: 540, y: y, size: 24, tagAt: 'above' });
      var v2 = s.n({ id: 'v2' + i, tag: 'V-' + T + p[0] + '2', name: 'ISOLATION', sym: 'valveButterfly', x: 620, y: y, size: 24, tagAt: 'above' });
      s.chain([js, v1, st, pp, cv, v2, jd], med, { w: 'main' }); suc.push(js); dis.push(jd);
    });
    s.e(suc[0], suc[1], med, { w: 'main' }); s.e(dis[0], dis[1], med, { w: 'main' });
    var inS = s.j('in', 60, 150), out = s.j('out', 840, 150);
    s.e(inS, suc[0], med, { w: 'main', line: T + ' RETURN ' + tR.toFixed(1) + ' °C' }); s.e(dis[0], out, med, { w: 'main', line: T + ' SUPPLY ' + tS.toFixed(1) + ' °C' });
    var pt1 = s.n({ id: 'pt1', tag: 'PT-' + T + '1', name: 'SUCTION PRESS', sym: 'instField', inst: 'PT', x: 160, y: 80, size: 24, tagAt: 'right' }); s.e(pt1 + '.process', [160, 150], 'line', { w: 'inst' });
    var pt2 = s.n({ id: 'pt2', tag: 'PT-' + T + '2', name: 'DISCHARGE PRESS', sym: 'instField', inst: 'PT', x: 720, y: 80, size: 24, tagAt: 'right' }); s.e(pt2 + '.process', [720, 150], 'line', { w: 'inst' });
    var ft = s.n({ id: 'ft', tag: 'FT-' + T + '1', name: 'FLOW', sym: 'flowMeter', x: 780, y: 150, size: 24, tagAt: 'below' });
    var dp = s.n({ id: 'dpc', tag: 'DPIC-' + T, name: 'DIFF. PRESSURE CONTROL', sym: 'instPanel', inst: 'DPIC', x: 440, y: 50, size: 26, tagAt: 'right' });
    s.e(pt2 + '.process', dp + '.process', 'line', { w: 'signal', via: [[720, 50]] }); s.e(dp + '.process', 'p0', 'line', { w: 'signal' });
    return finish(s);
  }
  function tcsManifoldL3(snap) {
    var n = need(snap, 'geometry.racks_per_row'), lpm = need(snap, 'design.flows.tcs_rack_lpm'), P = function (k) { return need(snap, 'design.planes.' + k); };
    var W = 900, s = Sheet({ id: 'tcs-row', no: 'MAN-ROW', title: 'TCS ROW MANIFOLD', size: [W, 440], svgId: 'eqL3Svg' });
    s.legend = COOL_LEGEND.slice(1, 3); s.legendAt = [690, 14];
    var x0 = 120, dx = (W - 200) / (n - 1), yS = 120, yR = 160;
    var os = s.n({ id: 'in-s', tag: 'TCS-S', name: P('p07_tcs_supply_c').toFixed(1) + ' °C', sym: 'offSheet', x: 40, y: yS, size: 20, tagAt: 'below' });
    var orr = s.n({ id: 'in-r', tag: 'TCS-R', name: P('p08_tcs_return_c').toFixed(1) + ' °C', sym: 'offSheet', x: 40, y: yR + 60, size: 20, rot: 180, tagAt: 'below' });
    var bv = s.n({ id: 'bv', tag: 'BV-ROW', name: 'ROW BALANCING', sym: 'valveBalancing', x: 80, y: yR, size: 22, tagAt: 'left' });
    var prevS = os + '.port', prevR = bv;
    s.e([80, yR + 60], orr + '.port', 'tcs_r', { w: 'main' }); s.e(bv, [80, yR + 60], 'tcs_r', { w: 'main' });
    for (var r = 1; r <= n; r++) {
      var x = x0 + (r - 1) * dx, js = s.j('s' + r, x, yS, r < n), jr = s.j('r' + r, x + 6, yR, r < n);
      s.e(prevS, js, 'tcs_s', { w: 'main' }); prevS = js;
      s.e(jr, prevR, 'tcs_r', { w: 'main' }); prevR = jr;
      var q1 = s.n({ id: 'qd-s' + r, tag: 'QD', sym: 'quickDisconnect', x: x, y: 230, size: 14, rot: 90, tagAt: 'none', lod: 2, label: 'Quick disconnect, rack ' + pad(r) + ' supply' });
      var rk = s.n({ id: 'rk' + r, tag: 'R' + pad(r), sym: 'rack', x: x + 3, y: 320, size: 26, cls: 'rack-unit', eqId: 'R' + pad(r), tagAt: 'below', label: 'Rack ' + pad(r) + ' cold plates — ' + lpm.toFixed(0) + ' L/min' });
      s.e(js, q1, 'tcs_s', { w: 'branch' }); s.e(q1, rk, 'tcs_s', { w: 'branch' }); s.e(rk, jr, 'tcs_r', { w: 'branch', via: [[x + 6, 280]] });
    }
    var av = s.n({ id: 'av', tag: 'AV', name: 'AIR VENT', sym: 'airVent', x: x0 + (n - 1) * dx + 40, y: yS - 30, size: 18, tagAt: 'right' }); s.e(av, [x0 + (n - 1) * dx + 40, yS], 'tcs_s', { w: 'branch' }); s.e('s' + n, [x0 + (n - 1) * dx + 40, yS], 'tcs_s', { w: 'main' });
    s.notes.push({ x: x0, y: 400, text: n + ' RACKS · ' + lpm.toFixed(0) + ' L/min/RACK · ' + Math.round(n * lpm) + ' L/min/ROW', role: 'value' });
    return finish(s);
  }
  function chemDosingL3(snap) {
    var s = Sheet({ id: 'chem', no: 'CHEM', title: 'CHEMICAL DOSING', size: [900, 400], svgId: 'eqL3Svg' });
    s.legend = COOL_LEGEND.slice(0, 1); s.legendAt = [690, 14];
    var y = 260, a = s.j('a', 60, y), b = s.j('b', 840, y);
    var tk = s.n({ id: 'tk', tag: 'TK-CHEM', name: 'INHIBITOR TANK', sym: 'tankBuffer', x: 200, y: 110, size: 50, tagAt: 'below' });
    var dp = s.n({ id: 'dpm', tag: 'P-DOSE', name: 'DOSING PUMP', sym: 'pumpCentrifugal', x: 360, y: 110, size: 34, cls: 'chem', eqId: '1', tagAt: 'below' });
    var cv = s.n({ id: 'cv', tag: 'CV-DOSE', name: 'INJECTION CHECK', sym: 'valveCheck', x: 480, y: 180, size: 22, rot: 90, tagAt: 'right' });
    var pot = s.n({ id: 'pot', tag: 'DP-01', name: 'DOSING POT', sym: 'dosingPot', x: 620, y: 180, size: 30, tagAt: 'right' });
    var ce = s.n({ id: 'ce', tag: 'AE-COND', name: 'CONDUCTIVITY', sym: 'instField', inst: 'AE', x: 740, y: 190, size: 24, tagAt: 'right' });
    s.e(a, b, 'htw', { w: 'main', line: 'FWS RETURN' }); s.e(tk, dp, 'htw', { w: 'branch' }); s.e(dp, cv, 'htw', { w: 'branch', via: [[480, 110]] }); s.e(cv, [480, y], 'htw', { w: 'branch' });
    s.e(pot, [620, y], 'htw', { w: 'branch' }); s.e(ce + '.process', [740, y], 'line', { w: 'inst' });
    return finish(s);
  }
  function dryCoolerL3(snap, o) {
    var id = pad((o && o.id) || 1), P = function (k) { return need(snap, 'design.planes.' + k); }, kw = need(snap, 'equipment.dry_cooler_unit_kwth');
    var s = Sheet({ id: 'dc-' + id, no: 'DC-' + id, title: 'DRY COOLER DC-' + id, size: [900, 440], svgId: 'dcL3Svg' });
    s.legend = [['htw', 'FWS (HTW)'], ['air', 'AMBIENT AIR']]; s.legendAt = [690, 14];
    var coil = s.n({ id: 'coil', tag: 'CC-' + id, name: 'V-BANK COIL', rating: Math.round(kw) + ' kWth', sym: 'coolingCoil', x: 450, y: 250, size: 80, cls: 'dry-cooler', eqId: id, tagAt: 'below' });
    for (var i = 0; i < 4; i++) { s.n({ id: 'fan' + i, tag: 'EF-' + id + (i + 1), name: i === 0 ? 'EC FAN (TYP.)' : '', sym: 'fanAxial', x: 330 + i * 80, y: 110, size: 40, cls: 'dry-cooler', eqId: id, tagAt: 'above' }); s.e([330 + i * 80, 205], 'fan' + i, 'air', { w: 'branch' }); }   // air drawn up through the coil to each fan
    var inl = s.j('in', 80, 230), out = s.j('out', 820, 270);
    var v1 = s.n({ id: 'v1', tag: 'V-' + id + '1', name: 'ISOLATION', sym: 'valveButterfly', x: 180, y: 230, size: 24, tagAt: 'above' });
    var t1 = s.n({ id: 't1', tag: 'TT-' + id + '1', name: P('p06_htw_return_c').toFixed(1) + ' °C IN', sym: 'tempSensor', x: 260, y: 190, size: 20, tagAt: 'above' });
    var v3 = s.n({ id: 'v3', tag: 'TV-' + id, name: 'LOW-AMB BYPASS', sym: 'valve3WayMotor', x: 700, y: 270, size: 30, tagAt: 'below' });
    var t2 = s.n({ id: 't2', tag: 'TT-' + id + '2', name: P('p05_htw_supply_c').toFixed(1) + ' °C OUT', sym: 'tempSensor', x: 770, y: 310, size: 20, tagAt: 'below' });
    s.chain([inl, v1], 'htw', { w: 'main', line: 'FWS RETURN' }); s.e(v1, [410, 230], 'htw', { w: 'main' }); s.e([490, 270], v3, 'htw', { w: 'main' }); s.e(v3, out, 'htw', { w: 'main', line: 'FWS SUPPLY' });
    s.e(v1, v3, 'htw', { w: 'branch', via: [[230, 230], [230, 380], [700, 380]] });   // bypass leg around the coil
    s.e(t1, [260, 230], 'line', { w: 'inst' }); s.e(t2, [770, 270], 'line', { w: 'inst' });
    s.notes.push({ x: 80, y: 60, text: 'AMB ' + P('p00_ambient_db_c').toFixed(1) + ' °C · LEAVING ' + P('p02_dry_cooler_leaving_c').toFixed(1) + ' °C', role: 'value' });
    return finish(s);
  }

  /* ── L3 for a fabric switch (core / spine / leaf): the switch, its uplinks and downlinks with the per-switch counts the
     engine's hall link totals give, out-of-band management, dual power. Drawn above the network modal's text detail. */
  function switchL3(snap, o) {
    var kind = (o && o.kind) || 'leaf', id = pad((o && o.id) || 1), N = function (k) { return need(snap, 'network.' + k); };
    var cores = N('cores_per_hall'), spines = N('spines_per_hall'), leaves = N('leaves_per_hall'), radix = N('leaf_radix');
    var ls = N('leaf_spine_links_per_hall'), sc = N('spine_core_links_per_hall'), gpu = N('gpu_downlinks_per_hall');
    var T = { core: ['CORE', '', 'SPINE', Math.round(sc / cores)], spine: ['SPINE', 'CORE', 'LEAF', Math.round(ls / spines)], leaf: ['LEAF', 'SPINE', 'GPU NIC', Math.round(gpu / leaves)] }[kind] || ['LEAF', 'SPINE', 'GPU NIC', 0];
    var up = kind === 'core' ? 0 : kind === 'spine' ? Math.round(sc / spines) : Math.round(ls / leaves);
    var s = Sheet({ id: 'sw-' + kind + id, no: T[0] + '-' + id, title: T[0] + ' SWITCH ' + T[0] + '-' + id, size: [900, 380], svgId: 'swL3Svg' });
    s.legend = [['data', 'DATA ' + portG(snap)], ['feed_a', 'POWER A'], ['feed_b', 'POWER B']]; s.legendAt = [700, 14];
    var sw = s.n({ id: 'sw', tag: T[0] + '-' + id, name: T[0] + ' SWITCH', rating: radix + ' × ' + portG(snap) + ' PORTS', sym: 'netSwitch', x: 450, y: 190, size: 60, cls: 'net-' + kind, eqId: String(Number(id)), tagAt: 'right' });
    if (up) {
      var u = s.n({ id: 'up', tag: T[1] + ' TIER', name: up + ' UPLINKS', sym: 'offSheet', x: 450, y: 50, size: 24, rot: 270, tagAt: 'right' });
      s.e(sw, u + '.port', 'data', { w: 'main', line: up + ' × ' + portG(snap) });
    }
    var d = s.n({ id: 'down', tag: T[2] + (kind === 'leaf' ? 'S' : ' TIER'), name: T[3] + ' DOWNLINKS', sym: kind === 'leaf' ? 'rack' : 'offSheet', x: 450, y: 330, size: kind === 'leaf' ? 34 : 24, rot: kind === 'leaf' ? 0 : 90, tagAt: 'right' });
    s.e(sw, kind === 'leaf' ? d : d + '.port', 'data', { w: 'main', line: T[3] + ' × ' + portG(snap) });
    var oob = s.n({ id: 'oob', tag: 'OOB', name: 'MGMT 1G', sym: 'netRouter', x: 200, y: 190, size: 30, cls: 'net-oob', eqId: '1', tagAt: 'below' });
    s.e(sw, oob, 'data', { w: 'signal', line: 'MGMT' });
    var pa = s.n({ id: 'psa', tag: 'PSU-A', name: 'POWER A', sym: 'psuAcDc', x: 700, y: 140, size: 28, tagAt: 'right' }), pb = s.n({ id: 'psb', tag: 'PSU-B', name: 'POWER B', sym: 'psuAcDc', x: 700, y: 240, size: 28, tagAt: 'right' });
    s.e(pa, sw, 'feed_a', { w: 'branch' }); s.e(pb, sw, 'feed_b', { w: 'branch' });
    return finish(s);
  }

  /* ── L3 for a BMS controller: dual-homed on the supervisory ring (two ring switches), its field I/O, the supervisory
     servers; family, served system and point count from the page's BMS model. Monitor-only — no write path drawn. */
  function bmsCtlL3(snap, o) {
    var M = o && o.bms, id = String((o && o.id) || ''); if (!M || !M.plc) throw new Error('hmi-sheets: BMS controller sheet needs the page BMS model');
    var i = Math.max(0, M.plc.map(function (c) { return c.id; }).indexOf(id)), c = M.plc[i] || M.plc[0], R = M.ring || [];
    var s = Sheet({ id: 'bms-ctl-' + c.id.toLowerCase(), no: c.id, title: 'CONTROLLER ' + c.id, size: [900, 380], svgId: 'bmsL3Svg' });
    s.legend = [['data', 'BMS NETWORK (MONITOR ONLY)']]; s.legendAt = [640, 14];
    var ctl = s.n({ id: 'ctl', tag: c.id, name: c.fam.toUpperCase(), rating: 'SERVES ' + String(c.serves).toUpperCase(), sym: 'bmsController', x: 450, y: 200, size: 56, cls: 'bms-controller', eqId: c.id, tagAt: 'right' });
    var ra = R[i % (R.length || 1)], rb = R[(i + 1) % (R.length || 1)];
    if (ra) { var a = s.n({ id: 'ra', tag: ra.id, name: 'RING A · ' + String(ra.at).toUpperCase(), sym: 'netSwitch', x: 300, y: 70, size: 30, cls: 'bms-network', eqId: ra.id, tagAt: 'left' }); s.e(ctl, a, 'data', { w: 'main', via: [[420, 140], [300, 140]] }); }
    if (rb && rb !== ra) { var b = s.n({ id: 'rb', tag: rb.id, name: 'RING B · ' + String(rb.at).toUpperCase(), sym: 'netSwitch', x: 600, y: 70, size: 30, cls: 'bms-network', eqId: rb.id, tagAt: 'right' }); s.e(ctl, b, 'data', { w: 'main', via: [[480, 140], [600, 140]] }); }
    if (ra && rb && rb !== ra) s.e('ra', 'rb', 'data', { w: 'bus', line: 'SUPERVISORY RING' });
    var io = s.n({ id: 'io', tag: 'FIELD I/O', name: String(c.pts).replace('~', '≈') + ' POINTS', sym: 'offSheet', x: 450, y: 330, size: 24, rot: 90, tagAt: 'right', label: 'Field devices wired to ' + c.id + ' (sheet DH-B-101 L0)' });
    s.e(ctl, io + '.port', 'data', { w: 'branch', line: 'FIELD BUS' });
    var sv = s.n({ id: 'sv', tag: 'DH-B-101', name: 'SERVERS / SCADA', sym: 'offSheet', x: 120, y: 70, size: 22, rot: 180, tagAt: 'below', label: 'Supervisory servers and applications (sheet DH-B-101)' });
    if (ra) s.e('ra', sv + '.port', 'data', { w: 'branch' });
    return finish(s);
  }

  /* ── SLD mimic modal: the one feed (A or B) of the opened device, drawn by the DH-E-101 feed builder at full size —
     states from the electrical scenario engine like the hall sheet; the modal zooms to the device that was opened. ── */
  var MIMIC_FOCUS = { 'mv-sub': 'cb-mv', rmu: 'cb-mv', tx: 'tx', msb: 'cb-lv', 'ups-a': 'inv', 'ups-b': 'inv', busway: 'qbw', 'rack-psu': 'tap', cooling: 'cb-lv' };
  function sldMimicL3(snap, o) {
    var type = (o && o.type) || 'msb', L = type === 'ups-b' ? 'B' : (o && o.side) || 'A', hn = (o && o.hall) || 1;
    var s = Sheet({ id: 'dh-e-mimic', no: 'DH-E-1' + pad(hn) + ' ' + L, title: 'DH-' + pad(hn) + ' FEED ' + L, size: [560, 860], svgId: 'sldL3Svg' });
    s.legend = [[L === 'A' ? 'feed_a' : 'feed_b', 'FEED ' + L], ['power', 'GENERATOR'], ['dc', 'DC']]; s.legendAt = [420, 14];
    feed(s, { side: L, x: 20 }, snap);
    s.focusId = (MIMIC_FOCUS[type] || 'cb-lv') + L + (type === 'tx' ? '01' : '');
    return finish(s);
  }

  /* ── L3 for the rack power shelves: busway tap-offs A and B -> rack PDU cords -> every power shelf (duty / spare from
     the engine) -> 48 V DC busbar -> compute / switch trays. Counts and ratings from power.* in the engine snapshot. ── */
  function rackPowerL3(snap) {
    var P = function (k) { return need(snap, 'power.' + k); }, D = function (k) { return need(snap, 'distribution.' + k); };
    var n = P('shelves_duty') + P('shelves_spare'), duty = P('shelves_duty'), kw = P('shelf_kw'), psu = P('psu_per_rack');
    var W = 900, s = Sheet({ id: 'rack-power', no: 'R07 PWR', title: 'R07 POWER SHELVES', size: [W, 420], svgId: 'rackL3Svg' });
    s.legend = [['feed_a', 'FEED A'], ['feed_b', 'FEED B'], ['dc', '48 V DC']]; s.legendAt = [720, 14];
    var ta = s.n({ id: 'tap-a', tag: 'TAP-A07', name: 'BUSWAY A TAP-OFF', sym: 'busTap', x: 120, y: 60, size: 26, cls: 'sld-rack-psu', eqId: 'R07', tagAt: 'right' });
    var tb = s.n({ id: 'tap-b', tag: 'TAP-B07', name: 'BUSWAY B TAP-OFF', sym: 'busTap', x: 120, y: 130, size: 26, cls: 'sld-rack-psu', eqId: 'R07', tagAt: 'right' });
    var ya = 95, yb = 165, x0 = 280, dx = (W - 380) / Math.max(1, n - 1), yS = 260, yD = 350;
    s.e(ta, [x0 - 40, ya], 'feed_a', { w: 'main', via: [[120, ya]], line: Math.round(D('rack_feed_current_per_cord_a')) + ' A CORD A' });
    s.e(tb, [x0 - 40, yb], 'feed_b', { w: 'main', via: [[120, yb]], line: Math.round(D('rack_feed_current_per_cord_a')) + ' A CORD B' });
    s.e([x0 - 40, ya], [x0 + (n - 1) * dx, ya], 'feed_a', { w: 'bus' }); s.e([x0 - 40, yb], [x0 + (n - 1) * dx, yb], 'feed_b', { w: 'bus' });
    for (var i = 0; i < n; i++) {
      var x = x0 + i * dx, sp = i >= duty;
      s.n({ id: 'sh' + i, tag: 'PS-' + pad(i + 1), name: sp ? 'SPARE' : 'DUTY', rating: kw + ' kW', standby: sp, sym: 'psuAcDc', x: x, y: yS, size: 34, cls: 'rack-psu', eqId: 'R07', tagAt: 'below' });
      s.e([x, ya], 'sh' + i, 'feed_a', { w: 'branch', via: [[x - 6, ya], [x - 6, yS - 30], [x, yS - 30]] });
      s.e([x + 6, yb], [x + 6, yS - 30], 'feed_b', { w: 'branch' });
      s.e('sh' + i, [x, yD], 'dc', { w: 'branch' });
    }
    s.e([x0 - 20, yD], [x0 + (n - 1) * dx + 20, yD], 'dc', { w: 'bus', line: '48 V DC BUSBAR' });
    var tr = s.n({ id: 'trays', tag: 'TRAYS', name: 'COMPUTE + SWITCH TRAYS', sym: 'offSheet', x: x0 + (n - 1) * dx + 70, y: yD, size: 22, tagAt: 'below' });
    s.e([x0 + (n - 1) * dx + 20, yD], tr + '.port', 'dc', { w: 'main' });
    s.notes.push({ x: x0, y: 400, text: duty + ' DUTY + ' + (n - duty) + ' SPARE · ' + P('shelf_redundancy_label') + ' · ' + psu + ' PSU · ' + Math.round(P('shelf_installed_kw')) + ' kW INSTALLED', role: 'value' });
    return finish(s);
  }

  /* ── STP and AHU L3 sheets (authored plant on the page, no engine counts): process train, duty / standby movers with
     their state from the payload, instruments where the payload has a point. ─────────────────────────────────── */
  function stpL3() {
    var s = Sheet({ id: 'stp', no: 'STP', title: 'SEWAGE TREATMENT PLANT', size: [900, 380], svgId: 'eqL3Svg' });
    s.legend = [['cw', 'EFFLUENT'], ['air', 'AERATION AIR']]; s.legendAt = [700, 14];
    var y = 230, n = function (o) { o.cls = o.cls || 'stp'; o.eqId = '1'; o.tagAt = o.tagAt || 'below'; return s.n(o); };
    var inl = s.n({ id: 'in', tag: 'INLET', name: 'RAW EFFLUENT', sym: 'offSheet', x: 40, y: y, size: 22, tagAt: 'below' });
    var sc = n({ id: 'sc', tag: 'SC-01', name: 'BAR SCREEN', sym: 'strainerY', x: 150, y: y, size: 30 });
    var eq = n({ id: 'eq', tag: 'TK-EQ', name: 'EQUALISATION', sym: 'tankBuffer', x: 270, y: y, size: 48 });
    var pf = n({ id: 'pf', tag: 'P-FEED', name: 'FEED PUMP', sym: 'pumpCentrifugal', x: 380, y: y, size: 30 });
    var ae = n({ id: 'ae', tag: 'TK-AER', name: 'AERATION', sym: 'tankBuffer', x: 500, y: y, size: 56 });
    var cl = n({ id: 'cl', tag: 'TK-CLR', name: 'CLARIFIER', sym: 'tankBuffer', x: 630, y: y, size: 48 });
    var uv = n({ id: 'uv', tag: 'UV-01', name: 'DISINFECTION', sym: 'filterCartridge', x: 740, y: y, size: 30 });
    var out = s.n({ id: 'out', tag: 'TREATED', name: 'REUSE / DISCHARGE', sym: 'offSheet', x: 815, y: y, size: 22, tagAt: 'below' });
    s.chain([inl + '.port', sc, eq, pf, ae, cl, uv, out + '.port'], 'cw', { w: 'main' });
    [1, 2].forEach(function (k) {   // blowers: duty / standby from the payload's blower_k state row (cooling scenario sets the duty one)
      var b = n({ id: 'bl' + k, tag: 'BL-0' + k, name: 'AIR BLOWER ' + k, sym: 'fanAxial', x: 440 + (k - 1) * 120, y: 80, size: 34, pumpState: 'blower_' + k });
      s.e(b, [500, 205], 'air', { w: 'branch', via: [[440 + (k - 1) * 120, 130], [500, 130]] });
    });
    var ft = n({ id: 'ft', tag: 'FT-01', name: 'INLET FLOW', sym: 'flowMeter', x: 210, y: 300, size: 22 }); s.e(ft, [210, y], 'line', { w: 'inst' });
    var ph = n({ id: 'ph', tag: 'AE-PH', name: 'pH', sym: 'instField', inst: 'AE', x: 330, y: 300, size: 22 }); s.e(ph, [330, y + 24], 'line', { w: 'inst' });
    var dox = n({ id: 'do', tag: 'AE-DO', name: 'DISSOLVED O2', sym: 'instField', inst: 'AE', x: 560, y: 310, size: 22 }); s.e(dox, [520, y + 28], 'line', { w: 'inst' });
    return finish(s);
  }
  function ahuL3() {
    var s = Sheet({ id: 'ahu', no: 'AHU', title: 'MMR AIR HANDLING UNIT', size: [900, 360], svgId: 'eqL3Svg' });
    s.legend = [['air', 'AIR'], ['chw', 'CHW']]; s.legendAt = [740, 14];
    var y = 170, n = function (o) { o.cls = 'ahu'; o.eqId = '1'; o.tagAt = o.tagAt || 'below'; return s.n(o); };
    var ra = s.n({ id: 'ra', tag: 'RA', name: 'RETURN AIR', sym: 'offSheet', x: 40, y: y, size: 22, rot: 180, tagAt: 'below' });
    var dm = n({ id: 'dm', tag: 'DMP-01', name: 'MIXING DAMPER', sym: 'damperFire', x: 160, y: y, size: 30 });
    var fl = n({ id: 'fl', tag: 'F-01', name: 'FILTER', sym: 'filterCartridge', x: 270, y: y, size: 34 });
    var cc = n({ id: 'cc', tag: 'CC-01', name: 'CHW COIL', sym: 'coolingCoil', x: 400, y: y, size: 54 });
    var fn = n({ id: 'fn', tag: 'SF-01', name: 'SUPPLY FAN', sym: 'fanAxial', x: 550, y: y, size: 46 });
    var sa = s.n({ id: 'sa', tag: 'SA', name: 'SUPPLY TO MMR', sym: 'offSheet', x: 820, y: y, size: 22, tagAt: 'below' });
    s.chain([ra + '.port', dm, fl, cc, fn, sa + '.port'], 'air', { w: 'main' });
    var oa = s.n({ id: 'oa', tag: 'OA', name: 'FRESH AIR', sym: 'offSheet', x: 160, y: 60, size: 20, rot: 270, tagAt: 'right' }); s.e(oa + '.port', dm, 'air', { w: 'branch' });
    var tv = n({ id: 'tv', tag: 'TV-01', name: 'CHW VALVE', sym: 'valveControlMotor', x: 400, y: 290, size: 28 });
    s.e([360, 330], tv, 'chw', { w: 'branch', line: 'CHW' }); s.e(tv, cc, 'chw', { w: 'branch' });
    var t1 = n({ id: 't1', tag: 'TT-RA', name: 'RETURN TEMP', sym: 'tempSensor', x: 90, y: 90, size: 20 }); s.e(t1, [90, y], 'line', { w: 'inst' });
    var t2 = n({ id: 't2', tag: 'TT-SA', name: 'SUPPLY TEMP', sym: 'tempSensor', x: 720, y: 90, size: 20 }); s.e(t2, [720, y], 'line', { w: 'inst' });
    return finish(s);
  }

  /* ── GB300 compute tray (rack modal 'ct'): per-tray counts from the engine (compute.* over trays), the two Superchips
     (Grace CPU + B300 GPUs on NVLink-C2C), NVLink to the backplane, CX-8 NICs to the fabric, BF3 DPU, 48 V in, TCS cold
     plates. Replaces the legacy block that named the GPU B200 (the GB200 part). ──────────────────────────────────── */
  function trayL3(snap, o) {
    var C = function (k) { return need(snap, 'compute.' + k); }, id = pad((o && o.id) || 1);
    var trays = C('compute_trays_facility') / C('racks_facility'), gpu = C('gpu_per_rack') / trays, cpu = C('cpu_per_rack') / trays;
    var nic = C('cx8_nics_facility') / C('compute_trays_facility'), dpu = C('bf3_dpus_facility') / C('compute_trays_facility');
    var memGB = Math.round(C('gpu_memory_pb_facility') * 1e6 / C('gpu_facility')), nvl = C('nvlink_per_gpu_gbs');
    var s = Sheet({ id: 'tray-' + id, no: 'CT-' + id, title: 'COMPUTE TRAY CT-' + id + ' · GB300', size: [900, 440], svgId: 'trayL3Svg' });
    s.legend = [['data', 'NVLINK / NETWORK'], ['dc', '48 V DC'], ['tcs_s', 'TCS COLD PLATE']]; s.legendAt = [700, 14];
    var bp = s.j('bp-l', 60, 70, false), bpr = s.j('bp-r', 640, 70, false); s.e(bp, bpr, 'data', { w: 'bus' }); s.notes.push({ x: 60, y: 62, text: 'NVLINK BACKPLANE → NVSWITCH TRAYS', role: 'tag' });
    var gpus = [], perChip = gpu / cpu;
    for (var c = 0; c < cpu; c++) {
      var cx = 150 + c * 300, g = s.n({ id: 'cpu' + c, tag: 'GRACE-' + (c + 1), box: [120, 40], x: cx, y: 290, cls: 'rack-ct', eqId: String(Number(id)), tagAt: 'none', boxSym: 'chip', text: 'GRACE CPU ' + (c + 1), textRole: 'tag', label: 'Grace CPU ' + (c + 1) + ' of GB300 Superchip ' + (c + 1) });
      for (var k = 0; k < perChip; k++) {
        var gx = cx - 60 + k * 120, gi = c * perChip + k + 1;
        var b = s.n({ id: 'gpu' + gi, tag: 'GPU-' + gi, box: [100, 44], x: gx, y: 170, cls: 'rack-ct', eqId: String(Number(id)), tagAt: 'none', boxSym: 'chip', text: 'B300 GPU ' + gi, textRole: 'tag', label: 'B300 GPU ' + gi + ' — ' + memGB + ' GB HBM3e, ' + nvl + ' GB/s NVLink' });
        s.e(b + '.top', [gx, 70], 'data', { w: 'branch' }); s.j('bpt' + gi, gx, 70, true);
        s.e(b + '.bottom', [gx, 270], 'data', { w: 'signal' });
        gpus.push(b);
      }
      s.notes.push({ x: cx, y: 250, text: 'NVLINK-C2C', role: 'tag', anchor: 'middle' });
    }
    s.notes.push({ x: 60, y: 118, text: memGB + ' GB HBM3e · ' + nvl.toLocaleString('en-US') + ' GB/s PER GPU', role: 'value' });
    var nx = 740;
    // one ConnectX-8 per GPU (engine: cx8 per tray = GPUs per tray): each NIC on its own GPU's PCIe link, all up to the fabric
    var nb = s.j('nic-bus-t', 700, 70, false), nbb = s.j('nic-bus-b', 700, 130 + (nic - 1) * 40, false); s.e(nbb, nb, 'data', { w: 'main' });
    for (var n = 0; n < nic; n++) { s.n({ id: 'nic' + n, tag: 'CX8-' + (n + 1), name: n === 0 ? portG(snap) + ' · GPU ' + (n + 1) : 'GPU ' + (n + 1), sym: 'netSwitch', x: nx, y: 130 + n * 40, size: 22, cls: 'rack-ns', eqId: 'R07', tagAt: 'right', label: 'ConnectX-8 NIC ' + (n + 1) + ' for GPU ' + (n + 1) + ', ' + portG(snap) }); s.e('nic' + n, [700, 130 + n * 40], 'data', { w: 'branch' }); s.j('nb' + n, 700, 130 + n * 40, true); }
    s.e('gpu' + gpu, [700, 160], 'signal', { w: 'signal', via: [[640, 160]] });   // PCIe from the GPUs to their NICs (one drawn)
    var fab = s.n({ id: 'fab', tag: 'DH-N-101', name: 'COMPUTE FABRIC', sym: 'offSheet', x: 860, y: 70, size: 20, rot: 270, tagAt: 'left' });
    s.e(nb, fab + '.port', 'data', { w: 'main' });
    s.n({ id: 'dpu', tag: 'BF3', name: 'BLUEFIELD-3 DPU ×' + dpu, sym: 'netFirewall', x: 740, y: 330, size: 24, tagAt: 'right' });
    var p48 = s.j('p48-l', 60, 380, false), p48r = s.j('p48-r', 640, 380, false); s.e(p48, p48r, 'dc', { w: 'bus', line: '48 V DC FROM THE RACK BUSBAR' });
    for (var c2 = 0; c2 < cpu; c2++) { var x2 = 150 + c2 * 300; s.e([x2, 380], 'cpu' + c2 + '.bottom', 'dc', { w: 'branch' }); }
    var ts = s.n({ id: 'tcs', tag: 'TCS', name: 'COLD PLATES', sym: 'quickDisconnect', x: 50, y: 230, size: 20, tagAt: 'above' });
    s.e(ts, [620, 230], 'tcs_s', { w: 'branch' });
    return finish(s);
  }

  /* ── NVLink switch tray (rack modal 'ns'): switch chips per tray from the engine, every compute tray's GPUs on the
     NVLink spine, domain bandwidth; 48 V in. ───────────────────────────────────────────────────────────────────── */
  function nvswitchTrayL3(snap, o) {
    var C = function (k) { return need(snap, 'compute.' + k); }, id = pad((o && o.id) || 1);
    // 2 switch chips per NVLink switch tray (DGX GB300 RA, model gb300.nvswitchPerTray — the rack sheet DH-R-101 uses the same split)
    var racks = C('racks_facility'), perTray = 2, gpus = C('gpu_per_rack'), ctr = C('compute_trays_facility') / racks;
    var s = Sheet({ id: 'ns-' + id, no: 'NS-' + id, title: 'NVLINK SWITCH TRAY NS-' + id, size: [900, 380], svgId: 'nsL3Svg' });
    s.legend = [['data', 'NVLINK 5'], ['dc', '48 V DC']]; s.legendAt = [720, 14];
    var spl = s.j('sp-l', 60, 110, false), spr = s.j('sp-r', 840, 110, false); s.e(spl, spr, 'data', { w: 'bus' });
    s.notes.push({ x: 60, y: 100, text: 'NVLINK SPINE · ' + gpus + ' GPU DOMAIN · ' + C('nvlink_per_gpu_gbs').toLocaleString('en-US') + ' GB/s PER GPU', role: 'tag' });
    for (var k = 0; k < perTray; k++) {
      var x = 300 + k * 300, ch = s.n({ id: 'sw' + k, tag: 'NVSW-' + (k + 1), box: [140, 44], x: x, y: 210, cls: 'rack-ns', eqId: 'R07', tagAt: 'none', boxSym: 'chip', text: 'NVLINK SWITCH ' + (k + 1), textRole: 'tag', label: 'NVLink switch chip ' + (k + 1) + ' of tray NS-' + id });
      s.e(ch + '.top', [x, 110], 'data', { w: 'main' }); s.j('spt' + k, x, 110, true);
    }
    var ct = s.n({ id: 'ct', tag: 'CT-01 … CT-' + pad(ctr), name: 'COMPUTE TRAYS ×' + ctr, sym: 'offSheet', x: 450, y: 40, size: 22, rot: 270, tagAt: 'right' });
    s.e(ct + '.port', [450, 110], 'data', { w: 'main' }); s.j('ctt', 450, 110, true);
    var pb = s.j('p-l', 60, 320, false), pbr = s.j('p-r', 840, 320, false); s.e(pb, pbr, 'dc', { w: 'bus' });
    s.notes.push({ x: 60, y: 312, text: '48 V DC FROM THE RACK BUSBAR', role: 'tag' });
    for (var k2 = 0; k2 < perTray; k2++) s.e([300 + k2 * 300, 320], 'sw' + k2 + '.bottom', 'dc', { w: 'branch' });
    return finish(s);
  }

  /* ── DH-F-102 clean-agent release, DH-01: the agent cylinder bank (its release state from the workstation snapshot via
     the fire-cylinder-bank payload), the common manifold, one selector valve per release zone of the fire inventory
     (each a fire-zone item, so a zone alarm / impairment shows on its valve), discharge nozzles. ─────────────────── */
  function dhF102(snap, o) {
    var inv = o && o.fire; if (!inv) throw new Error('hmi-sheets: dh-f-102 needs the fire inventory');
    var zones = inv.zones.filter(function (z) { return z.hall === 1 && z.release; });
    var W = 1240, H = 520, s = Sheet({ id: 'dh-f-102', no: 'DH-F-102', title: 'DH-01 CLEAN AGENT RELEASE', size: [W, H], svgId: 'fireRelSvg', sheet: '2/4' });
    s.legend = [['agent', 'CLEAN AGENT'], ['signal', 'RELEASE SIGNAL']]; s.legendAt = [1040, 14];
    var bank = s.n({ id: 'bank', tag: 'CYL-BANK', name: 'AGENT CYLINDERS', sym: 'agentCylinder', x: 80, y: 240, size: 56, cls: 'fire-cylinder-bank', eqId: 'DH-01', tagAt: 'below', label: 'Clean-agent cylinder bank, DH-01' });
    var ps = s.n({ id: 'ps', tag: 'PS-1', name: 'BANK PRESSURE', sym: 'instField', inst: 'PT', x: 80, y: 130, size: 24, tagAt: 'right' }); s.e(ps + '.process', [80, 212], 'line', { w: 'inst' });
    var facp = s.n({ id: 'facp', tag: 'FACP-01', name: 'RELEASE PANEL', sym: 'releasePanel', x: 80, y: 420, size: 34, cls: 'fire-facp', eqId: 'DH-01-FACP', tagAt: 'right', label: 'Fire alarm / release control panel (sheet DH-F-101)' });
    var m0 = s.j('man-l', 160, 240, false), m1 = s.j('man-r', 160 + zones.length * 85, 240, false);
    s.e(bank, m0, 'agent', { w: 'main' }); s.e(m0, m1, 'agent', { w: 'bus' });
    s.notes.push({ x: 170, y: 230, text: 'COMMON MANIFOLD', role: 'tag' });
    zones.forEach(function (z, i) {
      var x = 220 + i * 85, sv = s.n({ id: 'sv' + z.n, tag: 'SV-' + pad(z.n), name: 'Z' + pad(z.n), sym: 'selectorValve', x: x, y: 320, size: 28, cls: 'fire-zone', eqId: z.id, tagAt: 'below', label: 'Selector valve to zone ' + z.id.slice(-3) + ' ' + z.name });
      var nz = s.n({ id: 'nz' + z.n, tag: 'N-' + pad(z.n), sym: 'nozzle', x: x, y: 450, size: 22, tagAt: 'none', label: 'Discharge nozzles, ' + z.name });
      s.j('mt' + z.n, x, 240, true); s.e([x, 240], sv, 'agent', { w: 'branch' }); s.e(sv, nz, 'agent', { w: 'branch' });
      s.e(facp, sv, 'signal', { w: 'signal', via: [[150, 420], [150, 380], [x - 18, 380]] });
    });
    return finish(s);
  }

  var BUILDERS = { 'dh-m-103': dhM103, cdu: cduSheet, 'dh-e-101': dhE101, 'dh-r-101': dhR101, 'dh-f-101': dhF101, 'dh-e-001': dhE001, 'dh-n-101': dhN101, 'dh-a-101': dhA101, 'dh-b-101': dhB101, 'dh-n-102': dhN102, 'dh-n-104': dhN104, 'dh-m-102': dhM102, 'dh-m-104': dhM104, 'dh-m-101': dhM101, chiller: chillerL3, crah: crahL3, battery: batteryL3, 'pump-station': pumpStationL3, 'tcs-manifold': tcsManifoldL3, 'chem-dosing': chemDosingL3, 'dry-cooler': dryCoolerL3, switch: switchL3, 'bms-controller': bmsCtlL3, 'sld-mimic': sldMimicL3, 'rack-power': rackPowerL3, stp: stpL3, ahu: ahuL3, tray: trayL3, 'nvswitch-tray': nvswitchTrayL3, 'dh-f-102': dhF102 };
  for (var hb = 2; hb <= 9; hb++) BUILDERS['dh-e-10' + hb] = dhE101;   // DH-E-102 ... : same builder, o.hall picks the hall (the builder refuses a hall the engine does not have)
  var API = {
    build: function (id, snap, o) { if (!BUILDERS[id]) throw new Error('hmi-sheets: no sheet ' + id); return BUILDERS[id](snap, o); },
    list: function () { return Object.keys(BUILDERS); },
    version: '1.0.0'
  };
  if (root) root.RZDatahallAISheets = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
