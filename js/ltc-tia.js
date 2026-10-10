/* ============================================================================
 * ltc-tia.js — cabling & spaces workbench (TIA-942-B · TIA-568 · TIA-607)
 * ----------------------------------------------------------------------------
 * Fiber budget: TIA-568.3-D maximum component losses (0.75 dB per mated
 * connector pair, 0.3 dB per splice, 3.0 dB/km multimode at 850 nm, 0.5 dB/km
 * single-mode) against the IEEE 802.3 channel insertion-loss limit and reach
 * of the chosen application. Copper: the 90 m permanent link + 10 m cords
 * channel model. Bonding: TIA-607 backbone conductor size by length.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  var FIBER = { OM3: { atten: 3.0, mode: 'MM' }, OM4: { atten: 3.0, mode: 'MM' }, OS2: { atten: 0.5, mode: 'SM' } };
  var CONN = 0.75, SPLICE = 0.3;
  /* IEEE 802.3 channel insertion loss (dB) and reach (m) per fiber */
  var APPS = {
    '10GBASE-SR': { OM3: [300, 2.6], OM4: [400, 2.9] },
    '25GBASE-SR': { OM3: [70, 1.8], OM4: [100, 1.9] },
    '40GBASE-SR4': { OM3: [100, 1.9], OM4: [150, 1.5] },
    '100GBASE-SR4': { OM3: [70, 1.8], OM4: [100, 1.9] },
    '400GBASE-DR4': { OS2: [500, 3.0] },
    '10GBASE-LR': { OS2: [10000, 6.2] },
    '100GBASE-LR4': { OS2: [10000, 6.3] }
  };
  function fiberCalc(o) {
    var f = FIBER[o.fiber];
    var loss = o.len / 1000 * f.atten + o.pairs * CONN + o.splices * SPLICE;
    var app = APPS[o.app][o.fiber];
    if (!app) return { loss: loss, supported: false };
    return { loss: loss, supported: true, reach: app[0], budget: app[1], lossOk: loss <= app[1], reachOk: o.len <= app[0], margin: app[1] - loss,
             parts: [['Fiber', o.len / 1000 * f.atten], ['Connector pairs', o.pairs * CONN], ['Splices', o.splices * SPLICE]] };
  }

  /* copper: application → minimum category and channel length */
  var COPPER = {
    '1000BASE-T': { cats: ['5e', '6', '6A', '8'], len: { '5e': 100, '6': 100, '6A': 100, '8': 30 } },
    '10GBASE-T': { cats: ['6', '6A', '8'], len: { '6': 55, '6A': 100, '8': 30 } },
    '25GBASE-T / 40GBASE-T': { cats: ['8'], len: { '8': 30 } }
  };
  function copperCalc(o) {
    var a = COPPER[o.app];
    var chan = o.pl + o.cords;
    var supported = a.cats.indexOf(o.cat) !== -1;
    var max = supported ? a.len[o.cat] : 0;
    var isCat8 = o.cat === '8';
    var plMax = isCat8 ? 24 : 90, cordMax = isCat8 ? 6 : 10;
    return { chan: chan, supported: supported, max: max, plOk: o.pl <= plMax, cordOk: o.cords <= cordMax, chanOk: chan <= max, plMax: plMax, cordMax: cordMax };
  }

  /* TIA-607-B/C: TBB / BC size by length — 2 kcmil per linear foot, capped at
   * 3/0 AWG. (The 4/0 … 750 kcmil rows some references show come from the
   * superseded J-STD-607-A, which had no cap.) */
  var TBB = [[4, '6 AWG', 13.3], [6, '4 AWG', 21.2], [8, '3 AWG', 26.7], [10, '2 AWG', 33.6], [13, '1 AWG', 42.4],
             [16, '1/0 AWG', 53.5], [20, '2/0 AWG', 67.4], [Infinity, '3/0 AWG', 85.0]];
  function tbbSize(m) { for (var i = 0; i < TBB.length; i++) if (m < TBB[i][0]) return TBB[i]; return TBB[TBB.length - 1]; }

  /* ---- spaces figure ----------------------------------------------------- */
  var SPACES = {
    ap: { name: 'Access providers', sub: 'carrier services', sym: 'utility', body: 'Carrier and service-provider circuits. Higher ratings bring diverse providers in over diverse routes.' },
    er: { name: 'Entrance room', sub: 'ER · demarcation', sym: 'patchPanel', body: 'Where provider cabling meets the data-centre cabling. Higher-rated designs may add a second entrance room on a diverse route.' },
    mda: { name: 'Main distribution', sub: 'MDA · main cross-connect', sym: 'fabric', focal: true, body: 'The central point of the structured cabling: main cross-connect, core routers and switches. Every space is reached from here.' },
    hda: { name: 'Horizontal distribution', sub: 'HDA · horizontal cross-connect', sym: 'patchPanel', body: 'Serves a group of equipment rows with horizontal cabling; LAN/SAN aggregation sits here.' },
    zda: { name: 'Zone distribution', sub: 'ZDA · optional', sym: 'patchPanel', dashed: true, body: 'Optional consolidation point between HDA and EDA. No cross-connects or active equipment.' },
    eda: { name: 'Equipment distribution', sub: 'EDA · racks', sym: 'rack', body: 'The racks and cabinets: horizontal cabling ends at patch panels here.' },
    tr: { name: 'Telecom room', sub: 'TR · offices', sym: 'patchPanel', body: 'Serves areas outside the computer room — offices, operations centre, support spaces.' }
  };
  function spacesBuild(D, o) {
    var d = D.create({ slug: 'tia942', title: 'TIA-942 functional spaces', desc: 'Access providers to the entrance room, to the main distribution area, then backbone to horizontal distribution areas and horizontal cabling to the equipment, with an optional zone distribution area and a telecom room for support spaces.' });
    var box = {}, G = o.narrow ? 28 : 48;
    function N(id, x, y) {
      var s = SPACES[id];
      box[id] = d.node(x, y, { id: id, name: s.name, sublabel: s.sub, symbol: s.sym, interactive: true, dashed: !!s.dashed, focal: !!s.focal,
        fill: s.focal ? 'paper-2' : 'paper', tier: s.focal ? 1 : 2, legend: s.focal ? 'Core of the cabling' : s.dashed ? 'Optional space' : 'Functional space' });
      return box[id];
    }
    function E(a, b, dir, ex) {
      var A = box[a], B = box[b];
      d.edge(dir === 'v' ? { x: A.x + A.w / 2, y: A.y + A.h } : { x: A.x + A.w, y: A.y + A.h / 2 },
             dir === 'v' ? { x: B.x + B.w / 2, y: B.y } : { x: B.x, y: B.y + B.h / 2 }, Object.assign({ fromId: a, toId: b }, ex || {}));
    }
    if (!o.narrow) {
      /* two rows keep the figure under ~900 units, so the type stays above the legibility floor */
      N('ap', 16, 16); N('er', box.ap.x + box.ap.w + G, 16); N('mda', box.er.x + box.er.w + G, 16);
      N('hda', box.mda.x + box.mda.w + G, 16);
      var y2 = Math.max(box.mda.y + box.mda.h, box.hda.y + box.hda.h) + 64;
      N('tr', box.mda.x, y2); N('zda', box.hda.x, y2); N('eda', box.zda.x + box.zda.w + G, y2);
      E('ap', 'er', 'h', { stroke: 'link', pattern: 'dash-dot', legend: 'Provider cabling' }); E('er', 'mda', 'h', { tier: 1, stroke: 'ink', legend: 'Backbone' });
      E('mda', 'hda', 'h', { tier: 1, stroke: 'ink' }); E('hda', 'zda', 'v', { pattern: 'dashed', legend: 'Horizontal' }); E('zda', 'eda', 'h', { pattern: 'dashed' });
      E('mda', 'tr', 'v', { tier: 1, stroke: 'ink' });
    } else {
      var x = 16, y = 16;
      ['ap', 'er', 'mda', 'hda', 'zda', 'eda'].forEach(function (k, i) { N(k, x, y); y = box[k].y + box[k].h + G; });
      N('tr', box.mda.x + box.mda.w + 32, box.mda.y);
      E('ap', 'er', 'v', { stroke: 'link', pattern: 'dash-dot', legend: 'Provider cabling' }); E('er', 'mda', 'v', { tier: 1, stroke: 'ink', legend: 'Backbone' });
      E('mda', 'hda', 'v', { tier: 1, stroke: 'ink' }); E('hda', 'zda', 'v', { pattern: 'dashed', legend: 'Horizontal' }); E('zda', 'eda', 'v', { pattern: 'dashed' });
      E('mda', 'tr', 'h', { tier: 1, stroke: 'ink' });
    }
    d.legend();
    return d;
  }

  function val(id) { return parseFloat(document.getElementById(id).value); }
  function sval(id) { return document.getElementById(id).value; }
  function ro(k, v, u, s) { return '<div class="ltc-ro"' + (s ? ' data-state="' + s + '"' : '') + '><dt>' + k + '</dt><dd>' + v + (u ? '<small>' + u + '</small>' : '') + '</dd></div>'; }
  function verdict(state, word, text) { return '<div class="ltc-verdict" data-state="' + state + '"><b>' + word + '</b><span>' + text + '</span></div>'; }

  function runFiber() {
    var o = { fiber: sval('xFiber'), app: sval('xApp'), len: val('xLen'), pairs: Math.round(val('xPairs')), splices: Math.round(val('xSpl')) };
    var out = document.getElementById('xOut');
    if (![o.len, o.pairs, o.splices].every(isFinite) || o.len <= 0 || o.pairs < 0 || o.splices < 0) {
      out.innerHTML = verdict('fail', 'Input', 'Length above 0; connector pairs and splices as whole numbers, 0 or more.'); return;
    }
    var r = fiberCalc(o);
    if (!r.supported) { out.innerHTML = verdict('fail', 'Not supported', o.app + ' is not specified over ' + o.fiber + '.'); return; }
    var ok = r.lossOk && r.reachOk;
    out.innerHTML = verdict(ok ? 'ok' : 'fail', ok ? 'Link fits' : 'Link fails',
      (r.reachOk ? '' : 'Length ' + L.fmt(o.len, 0) + ' m exceeds the ' + L.fmt(r.reach, 0) + ' m reach. ') +
      (r.lossOk ? 'Loss ' + L.fmt(r.loss, 2) + ' dB is inside the ' + r.budget + ' dB channel budget (margin ' + L.fmt(r.margin, 2) + ' dB).'
                : 'Loss ' + L.fmt(r.loss, 2) + ' dB exceeds the ' + r.budget + ' dB channel budget by ' + L.fmt(-r.margin, 2) + ' dB — remove a connector pair or shorten the link.')) +
      '<dl class="ltc-readouts">' + ro('Total loss', L.fmt(r.loss, 2), 'dB', r.lossOk ? 'ok' : 'fail') + ro('Channel budget', L.fmt(r.budget, 1), 'dB') +
      ro('Margin', L.fmt(r.margin, 2), 'dB', r.margin >= 0 ? 'ok' : 'fail') + ro('Max reach', L.fmt(r.reach, 0), 'm', r.reachOk ? 'ok' : 'fail') + '</dl>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Loss term</th><th class="n">dB</th><th class="n">Share of budget</th></tr></thead><tbody>' +
      r.parts.map(function (p) { return '<tr><td>' + p[0] + '</td><td class="n">' + L.fmt(p[1], 2) + '</td><td class="n">' + L.fmt(100 * p[1] / r.budget, 0) + ' %</td></tr>'; }).join('') +
      '</tbody></table></div>' + lossProfile(o, r) + '<p class="ltc-src">TIA-568.3-D maximum losses: ' + FIBER[o.fiber].atten + ' dB/km · 0.75 dB per connector pair · 0.3 dB per splice. Budget and reach: IEEE 802.3 for ' + o.app + '. MPO connectors on short-reach parallel optics often need low-loss parts to fit two pairs.</p>';
  }
  /* Cumulative loss along the link: a connector pair at each end (extra pairs
   * spread along the run), splices in between, attenuation as a ramp. The budget
   * is the horizontal line the staircase must stay under. */
  function lossProfile(o, r) {
    var f = FIBER[o.fiber], Lm = Math.max(1, o.len);
    var ev = [];
    var pairs = o.pairs, sp = o.splices;
    for (var i = 0; i < pairs; i++) ev.push({ at: pairs === 1 ? 0 : Lm * i / (pairs - 1), dB: CONN, kind: 'c' });
    for (var j = 0; j < sp; j++) ev.push({ at: Lm * (j + 1) / (sp + 1), dB: SPLICE, kind: 's' });
    ev.sort(function (a, b) { return a.at - b.at; });
    var W = 640, H = 220, l = 48, rr = 16, t = 16, b = 36;
    var top = Math.max(r.budget || 0, r.loss) * 1.15;
    var X = function (m) { return l + m / Lm * (W - l - rr); }, Y = function (d) { return H - b - d / top * (H - t - b); };
    var pts = [[0, 0]], acc = 0, pos = 0;
    ev.forEach(function (e) {
      acc += (e.at - pos) / 1000 * f.atten; pos = e.at; pts.push([pos, acc]);
      acc += e.dB; pts.push([pos, acc]);
    });
    acc += (Lm - pos) / 1000 * f.atten; pts.push([Lm, acc]);
    var g = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="lp-t lp-d" style="width:100%;max-width:' + W + 'px;min-width:340px">',
      '<title id="lp-t">Cumulative insertion loss along the link</title><desc id="lp-d">Loss rises in steps at each connector pair and splice and as a ramp along the fiber, against the application channel budget.</desc>',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>'];
    for (var k = 0; k <= 4; k++) {
      var dv = top * k / 4;
      g.push('<line x1="' + l + '" y1="' + Y(dv) + '" x2="' + (W - rr) + '" y2="' + Y(dv) + '" stroke="var(--bd)" stroke-width="0.6"/>',
        '<text x="' + (l - 6) + '" y="' + (Y(dv) + 4) + '" fill="var(--t3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">' + dv.toFixed(1) + '</text>');
    }
    g.push('<text x="' + l + '" y="' + (H - 8) + '" fill="var(--t3)" font-size="11" font-family="JetBrains Mono, monospace">0 m</text>',
      '<text x="' + (W - rr) + '" y="' + (H - 8) + '" fill="var(--t3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">' + L.fmt(Lm, 0) + ' m</text>');
    if (r.budget) g.push('<line x1="' + l + '" y1="' + Y(r.budget) + '" x2="' + (W - rr) + '" y2="' + Y(r.budget) + '" stroke="var(--r)" stroke-width="1.2" stroke-dasharray="6 3"/>',
      '<text x="' + (W - rr) + '" y="' + (Y(r.budget) - 6) + '" fill="var(--r)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">budget ' + r.budget + ' dB</text>');
    g.push('<path d="M' + pts.map(function (q) { return X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); }).join(' L') + '" fill="none" stroke="var(' + (r.lossOk ? '--g' : '--r') + ')" stroke-width="1.8"/>');
    ev.forEach(function (e) {
      var x = X(e.at);
      g.push(e.kind === 'c' ? '<rect x="' + (x - 3.5) + '" y="' + (H - b + 6) + '" width="7" height="7" fill="var(--c)"/>'
                            : '<circle cx="' + x + '" cy="' + (H - b + 9.5) + '" r="3.5" fill="none" stroke="var(--o)" stroke-width="1.4"/>');
    });
    g.push('</svg>');
    return '<div class="ltc-canvas">' + g.join('') + '</div><p class="ltc-src">■ mated connector pair (0.75 dB) · ○ splice (0.3 dB) · ramp = ' + f.atten + ' dB/km</p>';
  }

  /* ---- port & panel count ------------------------------------------------- */
  function runPorts() {
    var racks = val('pRacks'), cu = val('pCu'), fx = val('pFx'), cuU = val('pCuU'), fxU = val('pFxU'), spare = val('pSpare') / 100;
    var mpo = +document.getElementById('pMpo').value;
    if (![racks, cu, fx, cuU, fxU, spare].every(isFinite) || cuU <= 0 || fxU <= 0) return;
    var cuPorts = Math.ceil(racks * cu * (1 + spare)), fxPorts = Math.ceil(racks * fx * (1 + spare));
    var strands = fxPorts * 2, perTrunk = mpo / 2;                   /* duplex LC per MPO trunk */
    var trunks = Math.ceil(fxPorts / perTrunk);
    var cuRU = Math.ceil(cuPorts / cuU), fxRU = Math.ceil(fxPorts / fxU);
    var perRackCuRU = Math.ceil(cu * (1 + spare) / cuU), perRackFxRU = Math.ceil(fx * (1 + spare) / fxU);
    document.getElementById('pOut').innerHTML = '<dl class="ltc-readouts">' +
      ro('Copper ports', L.fmt(cuPorts, 0), '') + ro('Fiber duplex ports', L.fmt(fxPorts, 0), '') + ro('Fiber strands', L.fmt(strands, 0), '') +
      ro('MPO-' + mpo + ' trunks', L.fmt(trunks, 0), '', 'ok') + ro('Panel RU at the HDA', L.fmt(cuRU + fxRU, 0), 'U') + ro('Panel RU per rack', L.fmt(perRackCuRU + perRackFxRU, 0), 'U') + '</dl>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>End</th><th class="n">Copper panels</th><th class="n">Fiber panels</th><th class="n">Rack units</th></tr></thead><tbody>' +
      '<tr><td>Each EDA rack</td><td class="n">' + perRackCuRU + '</td><td class="n">' + perRackFxRU + '</td><td class="n">' + (perRackCuRU + perRackFxRU) + ' U</td></tr>' +
      '<tr><td>HDA (all ' + racks + ' racks)</td><td class="n">' + cuRU + '</td><td class="n">' + fxRU + '</td><td class="n">' + (cuRU + fxRU) + ' U</td></tr></tbody></table></div>' +
      '<p class="ltc-note">Every horizontal link ends on a panel at both ends, so the HDA carries the sum of all racks. MPO-' + mpo + ' carries ' + perTrunk + ' duplex LC ports through a cassette. Spare capacity applies before rounding to whole panels.</p>';
  }

  function fillApps() {
    var f = sval('xFiber'), sel = document.getElementById('xApp'), cur = sel.value;
    sel.innerHTML = Object.keys(APPS).filter(function (a) { return APPS[a][f]; }).map(function (a) { return '<option' + (a === cur ? ' selected' : '') + '>' + a + '</option>'; }).join('');
  }
  function runCopper() {
    var o = { app: sval('cApp'), cat: sval('cCat'), pl: val('cPl'), cords: val('cCords') };
    var r = copperCalc(o);
    var ok = r.supported && r.plOk && r.cordOk && r.chanOk;
    var why = !r.supported ? 'Category ' + o.cat + ' is not specified for ' + o.app + '.' :
      !r.plOk ? 'Permanent link exceeds ' + r.plMax + ' m.' : !r.cordOk ? 'Cords exceed ' + r.cordMax + ' m in total.' :
      !r.chanOk ? 'Channel ' + L.fmt(r.chan, 1) + ' m exceeds ' + r.max + ' m for this category and application.' : 'Channel ' + L.fmt(r.chan, 1) + ' m of ' + r.max + ' m.';
    document.getElementById('cOut').innerHTML = verdict(ok ? 'ok' : 'fail', ok ? 'Channel fits' : 'Channel fails', why) +
      '<dl class="ltc-readouts">' + ro('Channel length', L.fmt(r.chan, 1), 'm', r.chanOk && r.supported ? 'ok' : 'fail') + ro('Max for Cat ' + o.cat, r.supported ? String(r.max) : '—', 'm') +
      ro('Permanent link limit', String(r.plMax), 'm') + ro('Cord limit', String(r.cordMax), 'm') + '</dl>' +
      '<p class="ltc-note">10GBASE-T on Category 6 is limited to 55 m and needs alien-crosstalk mitigation; Category 6A carries it 100 m. Category 8 is a 30 m, two-connector channel for top-of-rack and end-of-row links.</p>';
  }
  function runBond() {
    var m = val('bLen'), r = tbbSize(m);
    document.getElementById('bOut').innerHTML = '<dl class="ltc-readouts">' + ro('Conductor', r[1], '', 'ok') + ro('Copper area', L.fmt(r[2], 1), 'mm²') + ro('Run length', L.fmt(m, 1), 'm') + '</dl>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Run length</th><th>Minimum size</th><th class="n">Area</th></tr></thead><tbody>' +
      TBB.map(function (t, i) {
        var lo = i ? TBB[i - 1][0] : 0;
        return '<tr' + (t === r ? ' data-hit' : '') + '><td class="mono">' + (isFinite(t[0]) ? lo + ' – ' + t[0] + ' m' : '> ' + lo + ' m') + '</td><td class="mono">' + t[1] + '</td><td class="n">' + t[2] + ' mm²</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="ltc-note">Telecommunications bonding backbone (TBB) and bonding conductor sized by length, 6 AWG minimum. In TIA-607-C the busbars are the primary (PBB, formerly TMGB) and secondary (SBB, formerly TGB) bonding busbars. Equipment and rack bonding conductors run to the SBB; local electrical code may require larger sizes.</p>';
  }

  var fig = null;
  function boot() {
    L.init({ module: 'tia' });
    fig = L.draw(document.getElementById('sFig'), spacesBuild, function (id) {
      var s = SPACES[id];
      L.inspect({ sym: s.sym, eyebrow: 'TIA-942-B space', title: s.name, html: '<p>' + L.esc(s.body) + '</p>' });
      Object.keys(SPACES).forEach(function (k) { fig.mark(k, k === id ? 'selected' : null); });
    });
    document.getElementById('xFiber').addEventListener('change', function () { fillApps(); runFiber(); });
    document.getElementById('p-fiber').addEventListener('input', runFiber);
    document.getElementById('xApp').addEventListener('change', runFiber);
    document.getElementById('p-copper').addEventListener('input', runCopper);
    document.getElementById('p-copper').addEventListener('change', runCopper);
    document.getElementById('p-bonding').addEventListener('input', runBond);
    document.getElementById('p-ports').addEventListener('input', runPorts);
    document.getElementById('p-ports').addEventListener('change', runPorts);
    fillApps(); runFiber(); runCopper(); runBond(); runPorts();
    if (window.matchMedia('(min-width: 1280px)').matches) {
      L.inspect({ sym: SPACES.mda.sym, eyebrow: 'TIA-942-B space', title: SPACES.mda.name, html: '<p>' + L.esc(SPACES.mda.body) + '</p>' });
      fig.mark('mda', 'selected');
    }
    if (window.LTCPlantStrip) window.LTCPlantStrip.bind('pRacks', function (r) { return r.it.racksPerHall; }, 'Plant racks per hall = hall IT / rack kW', 0);
  }
  window.LTCTia = { fiberCalc: fiberCalc, copperCalc: copperCalc, tbbSize: tbbSize, APPS: APPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
