/* rz-hub-scene.js — one drawing, one camera (PLAN H1, 2026-10-15).
 *
 * The hub is a single dotted isometric scene — campus, substation, transmission,
 * the power/cooling chain, the standards stack — pinned beside the copy. Each
 * section moves the camera to its part of the drawing; nothing follows the
 * cursor. Dimensions and counts come from the DC AI engine (DCAI_MODEL +
 * DCAI_CALC.snapshot) when it is loaded; when it is not, the captions print
 * "—" rather than a typed number.
 */
(function () {
  'use strict';
  if (window.__rzHubScene) return; window.__rzHubScene = true;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVG = 'http://www.w3.org/2000/svg', W = 1200, H = 760;
  var C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);

  function el(tag, attrs, parent) { var n = document.createElementNS(SVG, tag); for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(parent, x, y, s, cls, anchor) { var t = el('text', { x: x, y: y, 'class': cls || 'ft', 'text-anchor': anchor || 'start' }, parent); t.textContent = s; return t; }
  function pts(l) { return l.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function iso(x, y, z, o) { return [o.x + (x - y) * C30, o.y + (x + y) * S30 - z]; }
  function box(g, x, y, w, d, h, o, cls) {
    var p = function (a, b, c) { return iso(a, b, c, o); };
    el('polygon', { points: pts([p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)]), 'class': cls || 'fl' }, g);
    el('polyline', { points: pts([p(x, y + d, h), p(x, y + d, 0), p(x + w, y + d, 0), p(x + w, y + d, h)]), 'class': cls || 'fl' }, g);
    el('polyline', { points: pts([p(x + w, y + d, 0), p(x + w, y, 0), p(x + w, y, h)]), 'class': cls || 'fl' }, g);
  }
  function flat(g, x, y, w, d, o, cls) { el('polygon', { points: pts([iso(x, y, 0, o), iso(x + w, y, 0, o), iso(x + w, y + d, 0, o), iso(x, y + d, 0, o)]), 'class': cls || 'fl t3' }, g); }
  function fmt(v, d) { return (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { maximumFractionDigits: d || 0 }) : '—'; }

  /* ---- engine read: every number on the drawing has an id here ---- */
  function engine() {
    var S = window.DCAI_CALC && window.DCAI_CALC.snapshot, M = window.DCAI_MODEL, g = function (o, k) { return o && typeof o[k] === 'number' ? o[k] : null; };
    var site = S && S.site, eq = S && S.equipment, dist = S && S.distribution, comp = S && S.compute, pw = S && S.power, pue = S && S.pue;
    return {
      ok: !!S, version: S && S.meta && S.meta.version,
      siteW: g(site, 'site_width_m'), siteD: g(site, 'site_depth_m'), siteA: g(site, 'site_area_m2'),
      plateL: g(site, 'plate_length_m'), plateW: g(site, 'plate_width_m'), genW: g(site, 'genset_yard_width_m'),
      north: g(site, 'north_band_depth_m'), south: g(site, 'south_band_depth_m'), road: g(site, 'road_m'), setback: g(site, 'setback_m'),
      halls: M && M.facility && M.facility.halls, racks: g(comp, 'racks_facility'), gpus: g(comp, 'gpu_facility'), itMw: g(pw, 'total_it_mw'),
      gensets: g(eq, 'gensets_installed'), chillers: g(eq, 'chillers_installed'), dry: g(eq, 'dry_coolers_installed'), cdu: g(eq, 'cdu_installed_facility'),
      pueDesign: g(pue, 'design_day'), hvKv: g(dist, 'hv_intake_kv'), mvKv: g(dist, 'mv_kv'), hvBays: g(dist, 'hv_line_bays'), mainTx: g(dist, 'main_tx_total')
    };
  }

  /* ---- the scene ---- */
  var CAM = {}; /* name -> [x, y, w, h] in scene units */
  function build(svg, E) {
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var cam = el('g', { id: 'cam' }, svg);
    var sc = 1.35, siteW = E.siteW || 412, siteD = E.siteD || 231, plateL = E.plateL || 163, plateW = E.plateW || 68;
    var genW = E.genW || 201, north = E.north || 21, south = E.south || 81, road = E.road || 12, setback = E.setback || 6;
    var o = { x: 560, y: 120 };
    var P = function (m) { return m * sc; };

    /* -- campus (centre) -- */
    var campus = el('g', { 'class': 'zone', 'data-zone': 'campus' }, cam);
    flat(campus, 0, 0, P(siteW), P(siteD), o, 'fl t3');                                   /* property line */
    flat(campus, P(setback), P(setback), P(siteW - 2 * setback), P(siteD - 2 * setback), o, 'fl t3');  /* fence */
    var inX = P(setback + road), inY = P(setback + road), inW = P(siteW - 2 * (setback + road)), inD = P(siteD - 2 * (setback + road));
    flat(campus, inX, inY, inW, inD, o, 'fl t3');                                            /* ring road inner edge */
    var yA = inY, yB = yA + P(north + road), yC = yB + P(plateW + road);
    /* north band: GIS · TX · STP · fuel */
    var nb = [['GIS', .22], ['TX', .3], ['STP', .08], ['FUEL', .4]], nx = inX;
    nb.forEach(function (b) { var w = (inW - P(road) * 3) * b[1]; box(campus, nx, yA, w, P(north), b[0] === 'TX' ? 10 : 6, o, 'fl'); var c = iso(nx + w / 2, yA + P(north) / 2, 14, o); txt(campus, c[0], c[1], b[0], 'ft lod-wide lod-building', 'middle'); nx += w + P(road); });
    /* building plate and genset yard */
    var bld = el('g', { 'class': 'node', 'data-node': 'building' }, campus);
    box(bld, inX, yB, P(plateL), P(plateW), 40, o, 'fl t1');
    box(bld, inX, yB, P(plateL), P(plateW), 20, o, 'fl t3');
    for (var i = 0; i < 4; i++) flat(bld, inX + 10 + i * (P(plateL) - 20) / 4, yB + 8, (P(plateL) - 20) / 4 - 6, P(plateW) - 16, { x: o.x, y: o.y - 40 }, 'fl t3');
    var bc = iso(inX + P(plateL) / 2, yB + P(plateW) / 2, 56, o);
    txt(bld, bc[0], bc[1], 'BUILDING · ' + fmt(E.halls) + ' HALLS', 'ft lod-wide lod-building', 'middle');
    var gy = el('g', { 'class': 'node', 'data-node': 'gensets' }, campus), gx0 = inX + P(plateL + road);
    for (var r = 0; r < 3; r++) for (var c2 = 0; c2 < 7; c2++) box(gy, gx0 + c2 * (P(genW) / 7), yB + r * (P(plateW) / 3), P(genW) / 7 - 5, P(plateW) / 3 - 5, 6, o, 'fl t3');
    var gc = iso(gx0 + P(genW) / 2, yB + P(plateW) / 2, 26, o); txt(gy, gc[0], gc[1], 'GENSETS · ' + fmt(E.gensets), 'ft lod-wide lod-building', 'middle');
    /* south band: chillers + dry coolers */
    var sb = el('g', { 'class': 'node', 'data-node': 'plant' }, campus);
    for (var k = 0; k < 12; k++) box(sb, inX + k * (inW * .5 / 12), yC, inW * .5 / 12 - 4, P(south) * .5, 8, o, 'fl t3');
    for (var k2 = 0; k2 < 18; k2++) box(sb, inX + inW * .52 + k2 * (inW * .48 / 18), yC + P(south) * .55, inW * .48 / 18 - 3, P(south) * .4, 5, o, 'fl t3');
    var pc = iso(inX + inW * .25, yC + P(south) * .25, 24, o); txt(sb, pc[0], pc[1], 'CHILLERS · ' + fmt(E.chillers), 'ft lod-wide lod-building', 'middle');
    var dc = iso(inX + inW * .76, yC + P(south) * .75, 20, o); txt(sb, dc[0], dc[1], 'DRY COOLERS · ' + fmt(E.dry), 'ft lod-wide lod-building', 'middle');
    /* site dimension */
    var d0 = iso(0, P(siteD) + 18, 0, o), d1 = iso(P(siteW), P(siteD) + 18, 0, o);
    el('line', { x1: d0[0], y1: d0[1], x2: d1[0], y2: d1[1], 'class': 'fl t3' }, campus);
    txt(campus, d1[0] + 10, d1[1] + 4, fmt(E.siteW, 0) + ' × ' + fmt(E.siteD, 0) + ' m · ' + fmt(E.siteA) + ' m²', 'ft lod-wide lod-building');
    var b0 = iso(0, 0, 0, o), b1 = iso(0, P(siteD), 0, o);
    CAM.hero = [0, 0, W, H];
    CAM.platforms = [bc[0] - 300, bc[1] - 150, 600, 330];

    /* -- transmission (left-top) feeding the GIS -- */
    var grid = el('g', { 'class': 'zone node', 'data-zone': 'grid', 'data-node': 'grid' }, cam);
    var tiers = [[E.hvKv ? '500 kV' : '—', 60, 't1'], ['275 kV', 110, ''], [fmt(E.hvKv) + ' kV', 160, 't3']];
    tiers.forEach(function (t, i) {
      el('line', { x1: 60, y1: t[1], x2: 330, y2: t[1], 'class': 'fl ' + t[2] }, grid); txt(grid, 54, t[1] + 4, t[0], 'ft lod-grid', 'end');
      for (var m = 0; m < 4 + i * 2; m++) { var x = 80 + m * (240 / (3 + i * 2)); el('rect', { x: x - 3, y: t[1] - 3, width: 6, height: 6, 'class': 'fl ' + t[2] }, grid); if (i < 2) el('line', { x1: x, y1: t[1] + 3, x2: x + 12, y2: tiers[i + 1][1] - 3, 'class': 'fx pwr' }, grid); }
    });
    var gis = iso(inX + 40, yA, 0, o);
    el('polyline', { points: pts([[330, 160], [420, 160], [420, gis[1] - 30], [gis[0], gis[1] - 30], gis]), 'class': 'fx pwr' }, grid);
    txt(grid, 190, 196, fmt(E.hvBays) + ' line bays · ' + fmt(E.mainTx) + ' main transformers ' + fmt(E.hvKv) + '/' + fmt(E.mvKv) + ' kV', 'fv lod-grid', 'middle');
    CAM.grid = [20, 20, 460, 260];

    /* -- the chain (right): exploded inspection panel -- */
    var chain = el('g', { 'class': 'zone', 'data-zone': 'chain', transform: 'translate(760,500)' }, cam);
    el('rect', { x: -14, y: -24, width: 432, height: 270, rx: 2, 'class': 'fl t3' }, chain);
    txt(chain, 0, -8, 'ONE HALL · UTILITY → IT LOAD', 'ft lod-chain');
    var row = function (y, nodes, cls) {
      var x = 8, prev = null;
      nodes.forEach(function (n) {
        var w = 62, node = el('g', { 'class': 'node', 'data-node': n.id }, chain);
        el('rect', { x: x, y: y, width: w, height: 34, rx: 2, 'class': 'fl' }, node);
        txt(node, x + w / 2, y + 15, n.l, 'ft lod-chain', 'middle'); txt(node, x + w / 2, y + 27, n.v, 'fv lod-chain', 'middle');
        if (prev !== null) { el('line', { x1: prev, y1: y + 17, x2: x, y2: y + 17, 'class': 'fx ' + cls }, chain); if (cls === 'pwr') el('rect', { x: prev + 6, y: y + 14, width: 6, height: 6, 'class': 'brk' }, chain); else el('polygon', { points: pts([[prev + 6, y + 14], [prev + 12, y + 20], [prev + 12, y + 14], [prev + 6, y + 20]]), 'class': 'brk' }, chain); }
        prev = x + w; x += w + 18;
      });
      return prev;
    };
    row(24, [{ id: 'grid', l: 'Grid', v: fmt(E.hvKv) + ' kV' }, { id: 'tx', l: 'TX', v: fmt(E.mvKv) + ' / 0.4' }, { id: 'ups', l: 'UPS', v: '2N' }, { id: 'rpp', l: 'RPP', v: '400 V' }, { id: 'rack', l: 'Rack', v: 'IT kW' }], 'pwr');
    el('line', { x1: 8, y1: 70, x2: 368, y2: 70, 'class': 'fl t1' }, chain); txt(chain, 374, 73, '400 V bus', 'ft lod-chain');
    row(120, [{ id: 'dry', l: 'Dry clr', v: 'ambient' }, { id: 'chiller', l: 'Chiller', v: 'COP' }, { id: 'cdu', l: 'CDU', v: 'TCS' }, { id: 'manifold', l: 'Manifold', v: 'L/min' }, { id: 'rack2', l: 'Rack', v: 'kW_th' }], 'cool');
    el('line', { x1: 8, y1: 166, x2: 368, y2: 166, 'class': 'fl t1' }, chain); txt(chain, 374, 169, 'TCS header', 'ft lod-chain');
    el('polyline', { points: pts([[359, 58], [359, 92], [390, 92], [390, 137]]), 'class': 'fx cool' }, chain);
    el('polyline', { points: pts([[390, 137], [390, 154], [368, 154]]), 'class': 'fx cool' }, chain); txt(chain, 394, 100, 'HEAT', 'ft lod-chain');
    txt(chain, 188, 200, fmt(E.racks) + ' racks · ' + fmt(E.gpus) + ' GPUs · ' + fmt(E.itMw, 1) + ' MW IT · PUE ' + fmt(E.pueDesign, 3), 'fv lod-chain', 'middle');
    txt(chain, 188, 220, 'every box is a calculator on this page', 'fv lod-chain', 'middle');
    /* leader from the building to the panel */
    el('polyline', { points: pts([[bc[0] + 120, bc[1] + 10], [720, bc[1] + 10], [720, 470], [746, 476]]), 'class': 'fl t3' }, cam);
    CAM.calculators = [730, 460, 470, 300];

    /* -- standards plates (left-bottom) -- */
    var plates = el('g', { 'class': 'zone', 'data-zone': 'plates' }, cam), po = { x: 200, y: 520 }, names = ['TIA-942', 'ASHRAE TC 9.9', 'ISO 50001', 'NFPA 75 / 76', 'UPTIME'];
    names.forEach(function (n, i) { var oo = { x: po.x, y: po.y + 90 - i * 20 }; box(plates, 0, 0, 100, 100, 5, oo, i === 4 ? 'fl' : 'fl t3'); var p = iso(100, 50, 2, oo); el('line', { x1: p[0], y1: p[1], x2: p[0] + 20, y2: p[1], 'class': 'fl t3' }, plates); txt(plates, p[0] + 24, p[1] + 3, n, 'ft lod-plates'); });
    var a = iso(50, 50, 5, { x: po.x, y: po.y + 90 }), b = iso(50, 50, 5, { x: po.x, y: po.y - 6 }); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'fx' }, plates);
    txt(plates, po.x, po.y + 150, 'the standards every design above has to satisfy', 'fv lod-plates');
    CAM.knowledge = [40, 420, 460, 300];
    CAM.about = [0, 0, W, H];
    return cam;
  }

  /* ---- camera ---- */
  function fit(rect) { var s = Math.min(W / rect[2], H / rect[3]) * 0.92, cx = rect[0] + rect[2] / 2, cy = rect[1] + rect[3] / 2; return 'translate(' + (W / 2 - cx * s) + 'px, ' + (H / 2 - cy * s) + 'px) scale(' + s + ')'; }
  function init() {
    var host = document.getElementById('hubScene'); if (!host) return;
    var E = engine();
    var svg = el('svg', { role: 'group', 'aria-label': 'One campus: site plan, transmission, the power and cooling chain, the standards stack', focusable: 'false' });
    var cam = build(svg, E); host.querySelector('.scene-body').appendChild(svg);
    var stamp = host.querySelector('[data-engine-stamp]'); if (stamp) stamp.textContent = E.ok ? 'numbers: DC AI engine v' + E.version : 'engine not loaded — no numbers drawn';
    var caps = {}; Array.prototype.forEach.call(host.querySelectorAll('[data-cap]'), function (c) { caps[c.getAttribute('data-cap')] = c; });
    var current = null;
    function go(name) {
      if (!CAM[name] || name === current) return; current = name;
      cam.style.transform = fit(CAM[name]); host.setAttribute('data-cam', name);
      host.classList.toggle('is-live', name === 'calculators' || name === 'platforms' || name === 'grid');
      for (var k in caps) caps[k].classList.toggle('is-on', k === name);
    }
    cam.style.transformOrigin = '0 0'; if (!REDUCE) cam.style.transition = 'transform 900ms cubic-bezier(.77,0,.175,1)';
    go('hero');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) go(e.target.getAttribute('data-cam-target')); }); }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      Array.prototype.forEach.call(document.querySelectorAll('[data-cam-target]'), function (s) { io.observe(s); });
    }
    if (!REDUCE) requestAnimationFrame(function () { host.classList.add('is-in'); }); else host.classList.add('is-in');
    window.__rzHubCam = go;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
