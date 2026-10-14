/* LTC — DH01 in 3D: the hall the DH01 solver computes, built in WebGL and orbitable, with every
 * stream it solves drawn as moving particles: supply air down the cold aisles, through the racks,
 * up the hot-aisle chimneys and back through the ceiling plenum; exhaust pulled back over the racks
 * where the supply runs out; the TCS loops from each CDU to its racks; facility water to the CDUs;
 * chilled water to the CRAHs.
 *
 * Nothing here is solved twice. flowModel() turns one solveHall() result into streams — each a
 * closed path with a flow (m³/s or L/s), a temperature at every waypoint and a speed on every leg —
 * and the particles are spread so that the number passing any point per second is proportional to
 * the stream's flow. tools/test-ltc-workbench.mjs (W12x) holds the streams to the solver: supply per
 * aisle mouth, recirculation, every rack's inlet and exhaust, the TCS flow per CDU.
 *
 * Drawn, not modelled (stated in the legend): rack height 2.0 m (42U), a 0.9 m ceiling plenum, hot
 * aisles contained to the ceiling (chimney), pipe routes, and 1.5 m/s pipe velocity at design flow.
 * A thermal approximation for training — not CFD. */
(function (root) {
  'use strict';
  var RACK_H = 2.0, DOOR_BANDS = 3, PLEN_D = 0.9, PIPE_V = 1.5, MIN_V = 0.15, COIL_V = 2.5;

  function lerp(a, b, u) { return a + (b - a) * u; }
  /* the marching the solver does, kept per wall: which share of each rack's supply came from which end */
  function wallShares(h, s, p) {
    var out = h.racks.map(function () { return { west: 0, east: 0 }; });
    s.aisles.forEach(function (a) {
      var byX = {};
      s.racks.forEach(function (k, i) { if (k.aisle === a.i) (byX[k.x.toFixed(3)] = byX[k.x.toFixed(3)] || { x: k.x, idx: [] }).idx.push(i); });
      var sl = Object.keys(byX).map(function (key) { return byX[key]; }).sort(function (u, v) { return u.x - v.x; });
      sl.forEach(function (x) { x.got = x.idx.reduce(function (t, i) { return t + s.racks[i].f * s.racks[i].dem; }, 0); x.left = x.got; });
      var w = a.west;                                                    // west air is used up first from the west end
      for (var i = 0; i < sl.length && w > 1e-12; i++) { var t = Math.min(w, sl[i].left); sl[i].w = t; sl[i].left -= t; w -= t; }
      sl.forEach(function (x) {
        var fw = x.got > 0 ? (x.w || 0) / x.got : 0;
        x.idx.forEach(function (i) { var g = s.racks[i].f * s.racks[i].dem; out[i] = { west: g * fw, east: g * (1 - fw) }; });
      });
    });
    return out;
  }

  /* streams: { kind, flow, unit, pts: [[x, y, z, T, ex, ey, ez]], v: [m/s per leg] } in plan metres
   * (x along the rows, z across, y up). A particle at time t sits on the leg its travel time reaches. */
  function flowModel(r, s, st) {
    var p = r.input, h = r.hall, L = h.lengthM, W = h.widthM, H = h.heightM, plenY = H - PLEN_D / 2;
    var pitch = p.rackPitchM, dep = p.rackDepthM, cold = p.coldAisleM, hot = p.hotAisleM;
    var streams = [], sh = wallShares(h, s, p);
    var hotSum = {}, hotN = {};
    s.racks.forEach(function (k) { var key = h.rowsY[k.row].hotY0; hotSum[key] = (hotSum[key] || 0) + k.dem; hotN[key] = (hotN[key] || 0) + 1; });
    var plenV = Math.max(MIN_V, s.airSupply / 2 / (W * PLEN_D));
    s.racks.forEach(function (k, i) {
      var ai = h.aisles[k.aisle], aZ = (ai.y0 + ai.y1) / 2, inZ = ai.y1 <= k.y + 1e-9 ? k.y : k.y + dep, outZ = ai.y1 <= k.y + 1e-9 ? k.y + dep : k.y;
      var hz = h.rowsY[k.row].hotY0, hotZ = hz + hot / 2, xc = k.x + pitch / 2, rackV = Math.max(MIN_V, k.dem / (pitch * RACK_H));
      var chimV = Math.max(MIN_V, hotSum[hz] / (hot * h.racksPerRow * pitch));
      ['west', 'east'].forEach(function (wall) {
        var q = sh[i][wall]; if (q <= 1e-9) return;
        var a = s.aisles[k.aisle], mouth = wall === 'west' ? a.west : a.east, aisleV = Math.max(MIN_V, mouth / (cold * RACK_H));
        var x0 = wall === 'west' ? 0.9 : L - 0.9, xr = wall === 'west' ? 0.5 : L - 0.5;
        streams.push({ kind: 'air', flow: q, unit: 'm³/s', rack: i, wall: wall, pts: [
          [x0, 1.0, aZ, s.supply, 0.05, 0.85, cold * 0.42],
          [xc, 1.0, aZ, s.supply, pitch * 0.42, 0.85, cold * 0.42],
          [xc, 1.0, inZ, k.inlet, pitch * 0.4, 0.85, 0.03],
          [xc, 1.0, outZ, k.exhaust, pitch * 0.4, 0.85, 0.03],
          [xc, RACK_H + 0.3, hotZ, k.exhaust, pitch * 0.42, 0.3, hot * 0.4],
          [xc, plenY, hotZ, k.exhaust, pitch * 0.42, 0.25, hot * 0.4],
          [x0, plenY, hotZ, s.returnC, 0.1, 0.25, 0.6],
          [xr, RACK_H + 0.6, aZ, s.returnC, 0.1, 0.2, cold * 0.4]
        ], v: [aisleV, aisleV, rackV, chimV, chimV, plenV, plenV, COIL_V] });
      });
      var rq = (1 - k.f) * k.dem;
      if (rq > 1e-9) {                                                   // exhaust pulled back over the rack to its own inlet
        var src = s.supply + (k.inlet - s.supply) / Math.max(1 - k.f, 1e-6), side = inZ < outZ ? -1 : 1;
        streams.push({ kind: 'recirc', flow: rq, unit: 'm³/s', rack: i, pts: [
          [xc, RACK_H - 0.25, outZ - side * hot * 0.3, src, pitch * 0.4, 0.15, hot * 0.15],
          [xc, RACK_H + 0.18, outZ, src, pitch * 0.4, 0.08, 0.05],
          [xc, RACK_H + 0.18, inZ + side * 0.3, src, pitch * 0.4, 0.08, 0.1],
          [xc, 1.2, inZ + side * 0.25, src, pitch * 0.4, 0.6, 0.1],
          [xc, 1.0, inZ, k.inlet, pitch * 0.4, 0.8, 0.03],
          [xc, 1.0, outZ, k.exhaust, pitch * 0.4, 0.8, 0.03]
        ], v: [rackV, rackV, rackV, rackV, rackV, rackV] });
      }
    });
    // TCS: each CDU's secondary loop to the racks it serves; per-CDU loops stop with their CDU,
    // a common header shares the flow of the CDUs still running across every rack
    var nC = h.cdus.length, perCdu = r.liquid.tcsLps / p.halls / r.liquid.cduPerHall, lost = s.lostCdu || {};
    var aliveC = h.cdus.filter(function (c) { return !lost[c.i]; }).length, commonF = nC ? aliveC / nC : 0;
    var ld = s.load || 1, tS = p.tcsSupplyC, tR = p.tcsSupplyC + (p.tcsReturnC - p.tcsSupplyC) * ld;
    if (st && st.fault === 'fws-pump' && s.series && s.series.analytic) { tR = s.series.analytic((st.minute || 0) * 60); tS = tR - (p.tcsReturnC - p.tcsSupplyC) * ld; }
    var perRack = {};
    h.racks.forEach(function (k) { perRack[k.cdu] = (perRack[k.cdu] || 0) + 1; });
    h.racks.forEach(function (k, i) {
      var c = h.cdus[k.cdu], f = st && st.header === 'per-cdu' ? (lost[c.i] ? 0 : 1) : commonF;
      var q = perCdu / perRack[k.cdu] * f; if (q <= 1e-9) return;
      var rz = k.y + dep / 2, xc = k.x + pitch / 2, hs = RACK_H + 0.45, hr = RACK_H + 0.65, v = Math.max(MIN_V, PIPE_V * f);
      var tOut = s.racks[i].liq != null ? lerp(tS, tR, s.racks[i].liq ? 1 : 0) : tR;
      streams.push({ kind: 'tcs', flow: q, unit: 'L/s', rack: i, cdu: c.i, pts: [
        [c.x, 1.9, c.y, tS, 0.04, 0.02, 0.04], [c.x, hs, c.y, tS, 0.04, 0.02, 0.04], [c.x, hs, rz - 0.12, tS, 0.04, 0.02, 0.04],
        [xc, hs, rz - 0.12, tS, 0.04, 0.02, 0.04], [xc, 1.2, rz - 0.12, tS, 0.04, 0.4, 0.04], [xc, 1.2, rz + 0.12, tOut, 0.04, 0.4, 0.04],
        [xc, hr, rz + 0.12, tOut, 0.04, 0.02, 0.04], [c.x, hr, rz + 0.12, tOut, 0.04, 0.02, 0.04], [c.x, hr, c.y + 0.15, tOut, 0.04, 0.02, 0.04], [c.x, 1.9, c.y + 0.15, tOut, 0.04, 0.02, 0.04]
      ], v: [v, v, v, v, v * 0.5, v, v, v, v, v] });
    });
    // FWS: each running CDU to its end wall and out to the heat rejection
    var fwsF = st && st.fault === 'fws-pump' ? 0 : 1, fwsPer = r.liquid.fwsLps / p.halls / r.liquid.cduPerHall;
    h.cdus.forEach(function (c) {
      if (lost[c.i] || !fwsF) return;
      var xw = c.x < L / 2 ? 0 : L;
      streams.push({ kind: 'fws', flow: fwsPer, unit: 'L/s', cdu: c.i, pts: [
        [xw, 0.25, c.y - 0.2, r.liquid.fwsSupplyC, 0.03, 0.03, 0.03], [c.x, 0.25, c.y - 0.2, r.liquid.fwsSupplyC, 0.03, 0.03, 0.03],
        [c.x, 0.25, c.y + 0.2, r.liquid.fwsReturnC, 0.03, 0.03, 0.03], [xw, 0.25, c.y + 0.2, r.liquid.fwsReturnC, 0.03, 0.03, 0.03]
      ], v: [PIPE_V, PIPE_V, PIPE_V, PIPE_V] });
    });
    // CHW: a header along each fan wall, a branch to every running CRAH
    // the coil valves carry the hall's air heat at the design CHW ΔT, shared by the CRAHs still running
    var out = s.crahOut || {}, aliveA = h.crahs.filter(function (c) { return !out[c.i]; }).length;
    var chwF = st && st.fault === 'chw' ? 0 : 1, chwPer = r.air.chwLps / p.halls * (s.qAirKw / r.air.hallLoadKw) / Math.max(1, aliveA);
    var chwRet = s.chw + (r.air.chwReturnC - r.air.chwSupplyC);
    h.crahs.forEach(function (c) {
      if (out[c.i] || !chwF) return;
      var xw = c.wall === 'west' ? 0.12 : L - 0.12, end = c.y < W / 2 ? 0 : W;
      streams.push({ kind: 'chw', flow: chwPer, unit: 'L/s', crah: c.i, pts: [
        [xw, 0.3, end, s.chw, 0.02, 0.02, 0.02], [xw, 0.3, c.y - 0.15, s.chw, 0.02, 0.02, 0.02], [c.x, 0.3, c.y - 0.15, s.chw, 0.02, 0.02, 0.02],
        [c.x, 0.3, c.y + 0.15, chwRet, 0.02, 0.02, 0.02], [xw, 0.45, c.y + 0.15, chwRet, 0.02, 0.02, 0.02], [xw, 0.45, end, chwRet, 0.02, 0.02, 0.02]
      ], v: [PIPE_V, PIPE_V, PIPE_V, PIPE_V, PIPE_V, PIPE_V] });
    });
    streams.forEach(function (sm) {                                      // travel time per leg, closing the loop
      var n = sm.pts.length, T = 0; sm.legT = [];
      for (var j = 0; j < n; j++) {
        var a = sm.pts[j], b = sm.pts[(j + 1) % n], d = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) + (b[2] - a[2]) * (b[2] - a[2]));
        var t = d / sm.v[j]; sm.legT.push(t); T += t;
      }
      sm.cycle = T;
    });
    return { streams: streams, shares: sh, plenY: plenY, rackH: RACK_H };
  }

  /* ------------------------------------------------------------------ view (needs RZ3 = three.js) */
  var view = null;
  function mount(host, hooks) {
    var T = root.RZ3; if (!T || view) return view;
    var D = root.LTCDH01, ramp = D.ramp;
    host.innerHTML = '<div class="ltc-3d-bar">' +
      '<div class="ltc-seg" role="group" aria-label="Layers"><button type="button" data-l="cfd" aria-pressed="true">CFD flow trails</button><button type="button" data-l="air" aria-pressed="false">Balance paths</button><button type="button" data-l="water" aria-pressed="true">Water</button><button type="button" data-l="shell" aria-pressed="true">Containment</button></div>' +
      '<div class="ltc-seg" role="group" aria-label="CFD volume"><button type="button" data-vol="heat" aria-pressed="true">Volume · heat</button><button type="button" data-vol="iso" aria-pressed="false">Isotherms 27 / 32 °C</button><button type="button" data-vol="speed" aria-pressed="false">Speed</button><button type="button" data-vol="ti" aria-pressed="false">Turbulence</button><button type="button" data-vol="vort" aria-pressed="false">Vortices</button><button type="button" data-vol="off" aria-pressed="false">No volume</button></div>' +
      '<div class="ltc-seg" role="group" aria-label="Slice plane"><button type="button" data-sl="h" aria-pressed="false">Slice · level</button><button type="button" data-sl="v" aria-pressed="false">Slice · cold aisle</button><button type="button" data-sl="off" aria-pressed="true">No slice</button></div>' +
      '<div class="ltc-seg" role="group" aria-label="Slice shows"><button type="button" data-sf="T" aria-pressed="true">Temperature</button><button type="button" data-sf="speed" aria-pressed="false">Speed</button><button type="button" data-sf="ti" aria-pressed="false">Turbulence</button><button type="button" data-sf="vort" aria-pressed="false">Vortices</button></div>' +
      '<label class="ltc-3d-at" hidden>Slice height <input type="range" min="0.15" max="4.85" step="0.15" value="1.2" data-at><output>1.2 m</output></label>' +
      '<div class="ltc-seg" role="group" aria-label="CFD grid"><button type="button" data-dx="0.6" aria-pressed="true">Grid 0.6 m · fast</button><button type="button" data-dx="0.3" aria-pressed="false">0.3 m · fine (minutes)</button></div>' +
      '<div class="ltc-seg" role="group" aria-label="Camera"><button type="button" data-cam="iso">Orbit</button><button type="button" data-cam="top">Top</button><button type="button" data-cam="cold">Cold aisle</button><button type="button" data-cam="hot">Hot aisle</button><button type="button" data-cam="plenum">Plenum</button><button type="button" data-tour aria-pressed="false">Auto-orbit</button></div>' +
      '<div class="ltc-seg" role="group" aria-label="Particle speed"><button type="button" data-sp="0.25">¼×</button><button type="button" data-sp="1" aria-pressed="true">Real time</button><button type="button" data-sp="3">3×</button></div></div>' +
      '<div class="ltc-3d-stage"><canvas class="ltc-3d-cv" tabindex="0" aria-label="DH01 in 3D: drag to orbit, scroll or pinch to zoom, hover a rack or unit for its numbers"></canvas><div class="ltc-3d-lbl"></div><div class="ltc-3d-hud" aria-live="polite"></div><div class="ltc-3d-probe" hidden></div><div class="ltc-3d-scale"></div>' +
      '<p class="ltc-3d-hint">Drag to orbit · right-drag or two fingers to pan · scroll / pinch to zoom · hover a slice to probe the field · click to release smoke</p></div>' +
      '<p class="ltc-3d-sum"></p><p class="ltc-note ltc-3d-key"></p>';
    var cv = host.querySelector('canvas'), stage = host.querySelector('.ltc-3d-stage'), lblHost = host.querySelector('.ltc-3d-lbl');
    var renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene(); scene.background = new T.Color(0x0a0e13);
    var cam = new T.PerspectiveCamera(42, 1, 0.05, 400);
    var ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI * 0.495;
    scene.add(new T.HemisphereLight(0xcfdcff, 0x2a2018, 1.25)); scene.add(new T.AmbientLight(0x404a58, 0.6));
    var sun = new T.DirectionalLight(0xffffff, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun); scene.add(sun.target);
    var hall = new T.Group(), dyn = new T.Group(); scene.add(hall); scene.add(dyn);
    var V = { renderer: renderer, scene: scene, cam: cam, ctl: ctl, sun: sun, hall: hall, dyn: dyn, host: host, cv: cv, layers: { cfd: true, air: false, water: true, slice: false, shell: true }, volMode: 'heat', dx: 0.6, slicePlane: 'off', sliceField: 'T', sliceAt: 1.2,
              speed: 1, key: '', t: 0, last: 0, hooks: hooks || {}, labels: [], visible: true, tween: null };
    view = V;
    function col(t) { var c = ramp(t); return new T.Color(c[0] / 255, c[1] / 255, c[2] / 255); }
    V.col = col; V.ramp = ramp;
    // particles: one Points cloud per family, soft round sprites, additive on the dark hall
    function cloud(size) {
      var g = new T.BufferGeometry(), m = new T.ShaderMaterial({
        uniforms: { uSize: { value: size * renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: 'attribute vec3 color; varying vec3 vC; uniform float uSize; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uSize * (55.0 / -mv.z), 1.5, 10.0); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(vC * 1.15, (0.25 - r) * 3.6); }'
      });
      var pts = new T.Points(g, m); pts.frustumCulled = false; dyn.add(pts); return pts;
    }
    V.air = cloud(2.0); V.water = cloud(1.3);
    // controls
    host.addEventListener('click', function (e) {
      var l = e.target.closest('[data-l]'); if (l) { var k = l.getAttribute('data-l'); V.layers[k] = !V.layers[k]; l.setAttribute('aria-pressed', String(V.layers[k])); applyLayers(); }
      if (e.target.closest('button')) probeOff();
      var c = e.target.closest('[data-cam]'); if (c) camTo(c.getAttribute('data-cam'));
      var sl = e.target.closest('[data-sl]'); if (sl) { V.slicePlane = sl.getAttribute('data-sl'); V.sliceAt = V.slicePlane === 'h' ? +host.querySelector('[data-at]').value : null; press('[data-sl]', sl); host.querySelector('.ltc-3d-at').hidden = V.slicePlane !== 'h'; cfdSlice(); }
      var sf = e.target.closest('[data-sf]'); if (sf) { V.sliceField = sf.getAttribute('data-sf'); press('[data-sf]', sf); cfdSlice(); }
      var gx = e.target.closest('[data-dx]'); if (gx) { V.dx = +gx.getAttribute('data-dx'); press('[data-dx]', gx); if (V.r) cfdStart(V.r, V.s, V.st); }
      var vo = e.target.closest('[data-vol]'); if (vo) { V.volMode = vo.getAttribute('data-vol'); press('[data-vol]', vo); cfdVolume(); applyLayers(); }
      var tr = e.target.closest('[data-tour]'); if (tr) { ctl.autoRotate = !ctl.autoRotate; ctl.autoRotateSpeed = 0.7; tr.setAttribute('aria-pressed', String(ctl.autoRotate)); }
      var sp = e.target.closest('[data-sp]'); if (sp) { V.speed = +sp.getAttribute('data-sp'); [].forEach.call(host.querySelectorAll('[data-sp]'), function (b) { b.setAttribute('aria-pressed', String(b === sp)); }); }
    });
    function ixShow(e) { var b = e.target.closest && e.target.closest('[data-ix]'), tp = b && ixTip(b.getAttribute('data-ix')); if (!tp || !root.LTCTrace) return; var rc = b.getBoundingClientRect(); root.LTCTrace.show(tp, e.clientX || rc.right, e.clientY || rc.bottom); }
    function ixHide(e) { if (e.target.closest && e.target.closest('[data-ix]') && root.LTCTrace) root.LTCTrace.hide(); }
    host.addEventListener('pointerover', ixShow); host.addEventListener('focusin', ixShow);
    host.addEventListener('pointerout', ixHide); host.addEventListener('focusout', ixHide);
    function press(sel, on) { [].forEach.call(host.querySelectorAll(sel), function (b) { b.setAttribute('aria-pressed', String(b === on)); }); }
    host.querySelector('[data-at]').addEventListener('input', function (e) { V.sliceAt = +e.target.value; e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2) + ' m'; cfdSlice(); });
    // hover: racks and units carry the same tooltip as the plan
    var ray = new T.Raycaster(), ndc = new T.Vector2();
    function pick(e) {
      var b = cv.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
      ray.setFromCamera(ndc, cam);
      var hits = ray.intersectObjects(V.pickables || [], false), sh = V.cslice && V.cslice.visible ? ray.intersectObject(V.cslice, false)[0] : null;
      if (!hits.length || sh && sh.distance < hits[0].distance) { if (V.hooks.hide) V.hooks.hide(); probeAt(e, sh); return; }
      probeOff();
      var o = hits[0].object;
      if (o.userData.rack && hits[0].instanceId != null && V.hooks.rack) V.hooks.rack(hits[0].instanceId, e.clientX, e.clientY);
      else if (o.userData.unit && V.hooks.unit) V.hooks.unit(o.userData.unit, e.clientX, e.clientY);
    }
    cv.addEventListener('pointermove', function (e) { if (e.buttons === 0) pick(e); });
    cv.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') pick(e); });
    // a click (not a drag) releases a puff of smoke where it lands: on the slice, a rack face or the floor
    var down = null;
    cv.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
    cv.addEventListener('pointerup', function (e) {
      if (!down || !V.cfd || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || e.timeStamp - down.t > 400) return;
      var b = cv.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(ndc, cam);
      var cand = ray.intersectObjects((V.pickables || []).concat(V.cslice && V.cslice.visible ? [V.cslice] : []), false)[0], p;
      if (cand) p = cand.point.clone().addScaledVector(ray.ray.direction, -0.15);
      else if (ray.ray.direction.y < -1e-3) p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, -ray.ray.origin.y / ray.ray.direction.y).setY(1.0);   // the floor, 1 m up
      if (!p) return;
      var F = V.cfd, x = p.x + F.nx * F.dx / 2, z = p.z + F.nz * F.dx / 2;
      if (x < 0 || z < 0 || x > F.nx * F.dx || z > F.nz * F.dx) return;
      root.LTCCFDView.smoke(V, x, Math.max(0.15, p.y), z);
    });
    cv.addEventListener('pointerleave', function () { if (V.hooks.hide) V.hooks.hide(); probeOff(); });
    /* probe: the field where the pointer meets the slice */
    function probeOff() { var pe = host.querySelector('.ltc-3d-probe'); if (pe) pe.hidden = true; if (V.pmark) V.pmark.visible = false; }
    function probeAt(e, hit) {
      var pe = host.querySelector('.ltc-3d-probe'), F = V.cfd, CV = root.LTCCFDView; if (!F || !hit) return probeOff();
      var X0 = F.nx * F.dx / 2, Z0 = F.nz * F.dx / 2, x = hit.point.x + X0, y = hit.point.y, z = hit.point.z + Z0, q = CV.probe(F, V.cfdSolid, F.ti, V.vort, x, y, z);
      if (!V.pmark) { V.pmark = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); V.dyn.add(V.pmark); }
      V.pmark.visible = true; V.pmark.scale.y = Math.max(0.05, y); V.pmark.position.set(hit.point.x, y / 2, hit.point.z);
      var env = q.T <= 27 ? 'within the ASHRAE recommended range' : q.T <= 32 ? 'above recommended, within A1 allowable' : 'above A1 allowable (32 °C)';
      pe.innerHTML = q.solid ? '<b>Solid</b> (rack, CDU or ceiling slab) at ' + x.toFixed(1) + ', ' + y.toFixed(1) + ', ' + z.toFixed(1) + ' m' :
        '<b>' + q.T.toFixed(1) + ' °C</b> time-averaged · now ' + q.Ti.toFixed(1) + ' °C<br>' + env +
        '<br>speed <b>' + q.sp.toFixed(2) + ' m/s</b> (u ' + q.u[0].toFixed(2) + ', v ' + q.u[1].toFixed(2) + ', w ' + q.u[2].toFixed(2) + ')' +
        '<br>turbulence intensity <b>' + (q.ti != null ? (q.ti * 100).toFixed(0) + ' %' : 'after 12 s') + '</b> · vorticity <b>' + (q.vort != null ? q.vort.toFixed(2) : '—') + ' s⁻¹</b>' +
        '<br><span>x ' + x.toFixed(1) + ' m · height ' + y.toFixed(2) + ' m · y ' + z.toFixed(1) + ' m · cell ' + F.dx + ' m, trilinear</span>';
      var b = stage.getBoundingClientRect(); pe.hidden = false;
      pe.style.transform = 'translate(' + Math.max(6, Math.min(b.width - pe.offsetWidth - 6, e.clientX - b.left + 14)).toFixed(0) + 'px,' + Math.max(6, Math.min(b.height - pe.offsetHeight - 6, e.clientY - b.top + 14)).toFixed(0) + 'px)';
    }
    function size() {
      var w = stage.clientWidth || 600, hh = w < 640 ? Math.max(320, Math.min(Math.round(w * 1.15), 520)) : Math.max(320, Math.min(Math.round(w * 0.58), 720));
      renderer.setSize(w, hh, false); cv.style.width = w + 'px'; cv.style.height = hh + 'px'; cam.aspect = w / hh; cam.updateProjectionMatrix();
    }
    V.size = size;
    if (root.ResizeObserver) new ResizeObserver(function () { if (stage.clientWidth) size(); }).observe(stage);
    if (root.IntersectionObserver) new IntersectionObserver(function (en) { V.visible = en[0].isIntersecting; }).observe(stage);
    size();
    requestAnimationFrame(loop);
    return V;
  }

  function applyLayers() {
    var V = view; if (!V) return;
    V.air.visible = V.layers.air; V.water.visible = V.layers.water;
    if (V.slice) V.slice.visible = false;
    if (V.trail) V.trail.visible = V.layers.cfd; if (V.cslice) V.cslice.visible = !!V.cfd && V.slicePlane !== 'off'; if (V.vol) V.vol.visible = !!V.cfd && V.volMode !== 'off';
    (V.shell || []).forEach(function (m) { m.visible = V.layers.shell; });
    (V.pipes || []).forEach(function (m) { m.visible = V.layers.water; });
  }

  /* the hall: built once per plant geometry */
  function buildHall(r) {
    var V = view, T = root.RZ3, h = r.hall, p = r.input, L = h.lengthM, W = h.widthM, H = h.heightM, X0 = L / 2, Z0 = W / 2;
    while (V.hall.children.length) { var c = V.hall.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var pitch = p.rackPitchM, dep = p.rackDepthM, hot = p.hotAisleM, plenY = H - PLEN_D;
    function box(w, hh, d, mat, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, hh, d), mat); m.position.set(x - X0, y, z - Z0); V.hall.add(m); return m; }
    // floor: raised-floor tiles 600 mm
    var floorMat = new T.MeshStandardMaterial({ color: 0x1a2027, roughness: 0.9, metalness: 0.05 });
    var fl = box(L + 0.4, 0.1, W + 0.4, floorMat, L / 2, -0.05, W / 2); fl.receiveShadow = true;
    var grid = new T.GridHelper(Math.max(L, W) + 0.4, Math.round((Math.max(L, W) + 0.4) / 0.6), 0x2b3540, 0x222a33); grid.position.set(0, 0.002, 0); grid.scale.set((L + 0.4) / (Math.max(L, W) + 0.4), 1, (W + 0.4) / (Math.max(L, W) + 0.4)); V.hall.add(grid);
    // walls: low glass so the hall reads as a room without hiding it
    var wallMat = new T.MeshStandardMaterial({ color: 0x5b6775, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false });
    box(L, H, 0.05, wallMat, L / 2, H / 2, 0); box(L, H, 0.05, wallMat, L / 2, H / 2, W);
    var edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(L, H, W)), new T.LineBasicMaterial({ color: 0x3d4a58 })); edges.position.set(0, H / 2, 0); V.hall.add(edges);
    // ceiling plenum underside
    var ceil = box(L, 0.03, W, new T.MeshStandardMaterial({ color: 0x8091a3, transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false }), L / 2, plenY, W / 2);
    // racks: dark bodies; front and rear doors carry the inlet and exhaust colour
    var n = h.racks.length, body = new T.InstancedMesh(new T.BoxGeometry(pitch * 0.96, RACK_H, dep * 0.96), new T.MeshStandardMaterial({ color: 0x20262e, roughness: 0.55, metalness: 0.4 }), n);
    // the front door in three bands (bottom, middle, top third), so the CFD's inlet by height shows
    var doorG = new T.BoxGeometry(pitch * 0.9, RACK_H * 0.94, 0.02), bandG = new T.BoxGeometry(pitch * 0.9, RACK_H * 0.94 / DOOR_BANDS - 0.004, 0.02),
      fronts = [], rear = new T.InstancedMesh(doorG, new T.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }), n);
    for (var b = 0; b < DOOR_BANDS; b++) fronts.push(new T.InstancedMesh(bandG, new T.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, emissive: 0x000000 }), n));
    var m4 = new T.Matrix4();
    h.racks.forEach(function (k, i) {
      var ai = h.aisles[k.aisle], inZ = ai.y1 <= k.y + 1e-9 ? k.y : k.y + dep, outZ = ai.y1 <= k.y + 1e-9 ? k.y + dep : k.y, xc = k.x + pitch / 2;
      m4.makeTranslation(xc - X0, RACK_H / 2, k.y + dep / 2 - Z0); body.setMatrixAt(i, m4);
      fronts.forEach(function (f, b) { m4.makeTranslation(xc - X0, RACK_H * 0.03 + RACK_H * 0.94 * (b + 0.5) / DOOR_BANDS, inZ - Z0 + (inZ < outZ ? -0.012 : 0.012)); f.setMatrixAt(i, m4); f.setColorAt(i, new T.Color(0x334455)); });
      m4.makeTranslation(xc - X0, RACK_H / 2, outZ - Z0 + (outZ < inZ ? -0.012 : 0.012)); rear.setMatrixAt(i, m4);
      rear.setColorAt(i, new T.Color(0x334455));
    });
    body.castShadow = true; body.receiveShadow = true; rear.userData.rack = true;
    V.hall.add(body); fronts.forEach(function (f) { f.userData.rack = true; V.hall.add(f); }); V.hall.add(rear); V.fronts = fronts; V.rear = rear;
    // hot-aisle chimneys: glass from the rack tops to the ceiling, doors at both ends
    var glass = new T.MeshStandardMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false, roughness: 0.1 });
    var x0 = h.racks.reduce(function (m, k) { return Math.min(m, k.x); }, 1e9), x1 = h.racks.reduce(function (m, k) { return Math.max(m, k.x + pitch); }, 0);
    V.shell = [ceil];
    var seen = {};
    h.rowsY.forEach(function (row) {
      var hz = row.hotY0; if (seen[hz]) return; seen[hz] = 1;
      V.shell.push(box(x1 - x0, plenY - RACK_H, 0.02, glass, (x0 + x1) / 2, (RACK_H + plenY) / 2, hz));
      V.shell.push(box(x1 - x0, plenY - RACK_H, 0.02, glass, (x0 + x1) / 2, (RACK_H + plenY) / 2, hz + hot));
      V.shell.push(box(0.02, plenY, hot, glass, x0, plenY / 2, hz + hot / 2));
      V.shell.push(box(0.02, plenY, hot, glass, x1, plenY / 2, hz + hot / 2));
    });
    // CRAH fan walls: units with fans that turn at the solved speed
    V.crahs = []; V.pickables = fronts.concat([rear]);
    var perWall = Math.ceil(h.crahs.length / 2);
    h.crahs.forEach(function (c) {
      var wN = c.wall === 'west' ? perWall : h.crahs.length - perWall, uw = W / wN * 0.86, g = new T.Group();
      var cab = new T.Mesh(new T.BoxGeometry(0.8, 2.6, uw), new T.MeshStandardMaterial({ color: 0x2c3946, roughness: 0.6, metalness: 0.3 }));
      cab.position.y = 1.3; cab.castShadow = true; cab.userData.unit = { kind: 'crah', c: c }; g.add(cab); V.pickables.push(cab);
      var fans = [];
      [0.75, 1.75].forEach(function (fy) {
        var f = new T.Group(); f.position.set(c.wall === 'west' ? 0.41 : -0.41, fy, 0); f.rotation.y = Math.PI / 2;
        var ring = new T.Mesh(new T.CircleGeometry(Math.min(0.42, uw * 0.42), 32), new T.MeshBasicMaterial({ color: 0x111820 })); f.add(ring);
        for (var b = 0; b < 5; b++) { var bl = new T.Mesh(new T.BoxGeometry(0.06, Math.min(0.38, uw * 0.38), 0.01), new T.MeshStandardMaterial({ color: 0x9fb3c8, metalness: 0.6, roughness: 0.3 })); bl.geometry.translate(0, Math.min(0.19, uw * 0.19), 0); bl.rotation.z = b * Math.PI * 2 / 5; f.add(bl); }
        g.add(f); fans.push(f);
      });
      g.position.set(c.x - X0, 0, c.y - Z0); V.hall.add(g); V.crahs.push({ c: c, g: g, cab: cab, fans: fans });
    });
    // CDUs
    V.cdus = [];
    h.cdus.forEach(function (c) {
      var m = box(0.9, 2.0, 1.0, new T.MeshStandardMaterial({ color: 0x1d3a44, roughness: 0.5, metalness: 0.35 }), c.x, 1.0, c.y);
      m.castShadow = true; m.userData.unit = { kind: 'cdu', c: c, racks: h.racks.filter(function (k) { return k.cdu === c.i; }).length };
      V.pickables.push(m); V.cdus.push({ c: c, m: m });
    });
    // heat slice at 1.2 m, painted per solve
    var sc = document.createElement('canvas'); sc.width = 512; sc.height = Math.max(64, Math.round(512 * W / L));
    var tex = new T.CanvasTexture(sc); tex.colorSpace = T.SRGBColorSpace;
    V.slice = new T.Mesh(new T.PlaneGeometry(L, W), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.62, depthWrite: false, side: T.DoubleSide }));
    V.slice.rotation.x = -Math.PI / 2; V.slice.position.set(0, 1.2, 0); V.slice.userData.cv = sc; V.hall.add(V.slice);
    // light from above the hall, shadows within it
    V.sun.position.set(-L * 0.3, H * 4, -W * 0.6); V.sun.target.position.set(0, 0, 0);
    var sc2 = Math.max(L, W) * 0.7, sh = V.sun.shadow.camera; sh.left = -sc2; sh.right = sc2; sh.top = sc2; sh.bottom = -sc2; sh.near = 1; sh.far = H * 10; sh.updateProjectionMatrix();
    V.dims = { L: L, W: W, H: H };
    // labels
    lbls(r);
    if (!V.placed) { camTo('iso', true); V.placed = true; }
  }

  function lbls(r) {
    var V = view, h = r.hall, L = h.lengthM, W = h.widthM, H = h.heightM, host = V.host.querySelector('.ltc-3d-lbl');
    V.labels = [['FAN WALL W', 0, 3.0, W / 2], ['FAN WALL E', L, 3.0, W / 2], ['CEILING PLENUM · RETURN', L / 2, H - 0.2, 0.4],
      ['FWS ↔ heat rejection', 0, 0.7, h.cdus.length ? h.cdus[0].y : W / 2], ['CHW ↔ chillers', L, 0.7, W * 0.9]].map(function (a) {
      var d = document.createElement('span'); d.textContent = a[0]; host.appendChild(d); return { el: d, p: [a[1] - L / 2, a[2], a[3] - W / 2] };
    });
    host.innerHTML = ''; V.labels.forEach(function (l) { host.appendChild(l.el); });
  }

  /* per solve: colours, fans, units, slice — and the particles when the streams change shape */
  function update(r, s, st) {
    var V = view, T = root.RZ3; if (!V) return;
    var gkey = JSON.stringify([r.hall.lengthM, r.hall.widthM, r.hall.racks.length, r.hall.cdus.length, r.hall.crahs.length]);
    if (gkey !== V.gkey) { buildHall(r); V.gkey = gkey; }
    var h = r.hall, p = r.input, X0 = h.lengthM / 2, Z0 = h.widthM / 2, col = V.col;
    if (!V.cfd) s.racks.forEach(function (k, i) {      // with the CFD on, its frames colour the doors
      var thr = k.liq != null && k.liq < 1 && st.phase !== 'running';
      var ci = thr ? new T.Color(0x3a3f46) : col(k.inlet); V.fronts.forEach(function (f) { f.setColorAt(i, ci); }); V.rear.setColorAt(i, thr ? new T.Color(0x3a3f46) : col(k.exhaust));
    });
    doorsDirty();
    V.crahs.forEach(function (u) { var dead = !!(s.crahOut || {})[u.c.i]; u.dead = dead; u.cab.material.color.set(dead ? 0x6b1d22 : 0x2c3946); u.cab.userData.unit.dead = dead; });
    V.cdus.forEach(function (u) { var dead = !!(s.lostCdu || {})[u.c.i]; u.m.material.color.set(dead ? 0x6b1d22 : 0x1d3a44); u.m.userData.unit.dead = dead; });
    V.fan = s.fanSpeed;
    paintSlice(r, s);
    var M = flowModel(r, s, st), skey = JSON.stringify([gkey, st.fault, st.header, st.phase, st.load, M.streams.length]);
    if (skey !== V.skey) { seed(M); V.skey = skey; }
    else { V.streams.forEach(function (sm, i) { var nw = M.streams[i]; sm.pts = nw.pts; sm.v = nw.v; sm.legT = nw.legT; sm.cycle = nw.cycle; }); recolor(); }
    V.model = M; V.r = r; V.s = s; V.st = st;
    cfdStart(r, s, st);
    var key = V.host.querySelector('.ltc-3d-key');
    var air = M.streams.filter(function (x) { return x.kind === 'air'; }).reduce(function (a, x) { return a + x.flow; }, 0), rec = M.streams.filter(function (x) { return x.kind === 'recirc'; }).reduce(function (a, x) { return a + x.flow; }, 0);
    var tcs = M.streams.filter(function (x) { return x.kind === 'tcs'; }).reduce(function (a, x) { return a + x.flow; }, 0);
    key.innerHTML = '<b>CFD</b> (default): an incompressible, buoyant airflow solve of DH01 (js/ltc-cfd.js, in a background worker) on this plant’s racks, fans and containment. <b>Volume</b>: the solved field ray-marched on the GPU, one texel per cell, trilinear between them — <i>heat</i> glows where room air is above 27 °C (the contained hot aisles and plenum kept faint, so escaped hot air stands out; fast supply air shows as a cool haze), <i>isotherms</i> are the 27 and 32 °C surfaces of the room air, <i>speed</i> |u|, <i>turbulence</i> intensity (velocity fluctuation ÷ mean, after the first air change) and <i>vortices</i> |∇×u| (shear layers and eddies the grid resolves). <b>Flow trails</b>: ' + root.LTCCFDView.TRAIL_N.toLocaleString('en-US') + ' particles carried by the solved velocity, born at the fan walls, the rack exhausts and anywhere in the room, each with a one-second tail coloured by the air it passed through. <b>Slice</b>: temperature, speed, turbulence or vorticity on a plane; hover it to probe the field. <b>Smoke</b>: click anywhere to release a puff of ' + root.LTCCFDView.PUFF_N + ' particles carried by the solved velocity, plus a small random walk (' + root.LTCCFDView.SMOKE_D + ' m²/s) standing in for the eddies the grid cannot carry; it vanishes into racks and coils. Rack front doors are banded, bottom, middle and top third, each coloured by the CFD inlet at that height; the rear door shows the exhaust. <b>Air management</b>: RCI (Herrlin), RTI and SHI (Sharma) from the CFD rack inlets — hover each for its formula and inputs. The panel compares the CFD with the balance solve. No turbulence model and a coarse grid: for training and comparison, not a design CFD. <b>Balance paths</b>: the streams of the balance solve, supply air to the racks ' + air.toFixed(1) + ' m³/s, exhaust pulled back ' + rec.toFixed(1) + ' m³/s, TCS ' + tcs.toFixed(0) + ' L/s, one particle per fixed volume: the stream density is the flow. Colour = temperature on the plan’s scale. Drawn, not modelled: 2.0 m racks, a 0.9 m ceiling plenum, hot aisles chimneyed to it, pipe routes and 1.5 m/s pipe velocity at design flow.';
    applyLayers();
  }

  function paintSlice(r, s) {
    var V = view, sc = V.slice.userData.cv, g = sc.getContext('2d'), h = r.hall, p = r.input, kx = sc.width / h.lengthM, ky = sc.height / h.widthM;
    var c = V.col(s.supply); g.fillStyle = 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')'; g.fillRect(0, 0, sc.width, sc.height);
    function fill(t, x, y, w, hh) { var cc = V.col(t); g.fillStyle = 'rgb(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ')'; g.fillRect(x * kx, y * ky, w * kx + 0.6, hh * ky + 0.6); }
    s.racks.forEach(function (k) {
      var ai = h.aisles[k.aisle], below = ai.y1 <= k.y + 1e-9;
      fill(k.inlet, k.x, below ? ai.y0 + (ai.y1 - ai.y0) / 2 : k.y + p.rackDepthM, p.rackPitchM, (ai.y1 - ai.y0) / 2);
      var gr = g.createLinearGradient(0, (below ? k.y : k.y + p.rackDepthM) * ky, 0, (below ? k.y + p.rackDepthM : k.y) * ky), a = V.col(k.inlet), b = V.col(k.exhaust);
      gr.addColorStop(0, 'rgb(' + [a.r, a.g, a.b].map(function (v) { return Math.round(v * 255); }) + ')'); gr.addColorStop(1, 'rgb(' + [b.r, b.g, b.b].map(function (v) { return Math.round(v * 255); }) + ')');
      g.fillStyle = gr; g.fillRect(k.x * kx, k.y * ky, p.rackPitchM * kx + 0.6, p.rackDepthM * ky + 0.6);
      fill(k.exhaust, k.x, below ? k.y + p.rackDepthM : k.y - p.hotAisleM / 2, p.rackPitchM, p.hotAisleM / 2);
    });
    V.slice.material.map.needsUpdate = true;
  }

  /* particles per stream ∝ flow × cycle time, so the count crossing any point per second ∝ flow */
  var AIR_N = 14000, WATER_N = 5000;
  function seed(M) {
    var V = view, T = root.RZ3;
    V.streams = M.streams;
    function alloc(kinds, N) {
      var list = M.streams.filter(function (s) { return kinds.indexOf(s.kind) >= 0; }), w = list.reduce(function (a, s) { return a + s.flow * s.cycle; }, 0), parts = [];
      list.forEach(function (s, si) {
        var x = w > 0 ? N * s.flow * s.cycle / w : 0, n = Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
        for (var j = 0; j < n; j++) parts.push({ s: s, ph: Math.random() * s.cycle, u: [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1] });
      });
      return parts;
    }
    function geo(pts, parts) {
      var g = pts.geometry; g.dispose();
      var ng = new T.BufferGeometry();
      ng.setAttribute('position', new T.BufferAttribute(new Float32Array(parts.length * 3), 3).setUsage(T.DynamicDrawUsage));
      ng.setAttribute('color', new T.BufferAttribute(new Float32Array(parts.length * 3), 3).setUsage(T.DynamicDrawUsage));
      pts.geometry = ng;
    }
    V.pa = alloc(['air', 'recirc'], AIR_N); V.pw = alloc(['tcs', 'fws', 'chw'], WATER_N);
    // the pipes themselves: every water route drawn once, supply legs blue-grey, return legs warm grey
    (V.pipes || []).forEach(function (m) { V.dyn.remove(m); m.geometry.dispose(); });
    var X0 = V.dims.L / 2, Z0 = V.dims.W / 2, seg = { sup: [], ret: [] }, seen = {};
    M.streams.forEach(function (sm) {
      if (sm.kind !== 'tcs' && sm.kind !== 'fws' && sm.kind !== 'chw') return;
      for (var j = 0; j < sm.pts.length - 1; j++) {
        var a = sm.pts[j], b = sm.pts[j + 1], k = [a[0], a[1], a[2], b[0], b[1], b[2]].map(function (v) { return v.toFixed(2); }).join(',');
        if (seen[k]) continue; seen[k] = 1;
        (b[3] > a[3] + 0.01 || a[3] > sm.pts[0][3] + 0.01 ? seg.ret : seg.sup).push(a[0] - X0, a[1], a[2] - Z0, b[0] - X0, b[1], b[2] - Z0);
      }
    });
    V.pipes = [['sup', 0x5f86a8], ['ret', 0xa8826a]].map(function (x) {
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(seg[x[0]]), 3));
      var m = new T.LineSegments(g, new T.LineBasicMaterial({ color: x[1], transparent: true, opacity: 0.55 })); V.dyn.add(m); return m;
    });
    geo(V.air, V.pa); geo(V.water, V.pw);
    step(0);
  }
  function recolor() { step(0); }

  /* place every particle at time t on its stream: leg by travel time, position and temperature
     interpolated, spread over the leg's cross-section */
  function place(parts, pts, dt) {
    var V = view, pos = pts.geometry.attributes.position, colA = pts.geometry.attributes.color, X0 = V.dims.L / 2, Z0 = V.dims.W / 2, P = pos.array, C = colA.array;
    for (var i = 0; i < parts.length; i++) {
      var q = parts[i], s = q.s; if (!s.cycle) continue;
      q.ph = (q.ph + dt) % s.cycle;
      var t = q.ph, j = 0, n = s.pts.length;
      while (j < n - 1 && t > s.legT[j]) { t -= s.legT[j]; j++; }
      var a = s.pts[j], b = s.pts[(j + 1) % n], u = s.legT[j] > 0 ? Math.min(1, t / s.legT[j]) : 0, us = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
      var ex = lerp(a[4], b[4], u), ey = lerp(a[5], b[5], u), ez = lerp(a[6], b[6], u);
      P[i * 3] = lerp(a[0], b[0], us) + q.u[0] * ex - X0; P[i * 3 + 1] = lerp(a[1], b[1], us) + q.u[1] * ey; P[i * 3 + 2] = lerp(a[2], b[2], us) + q.u[2] * ez - Z0;
      // above the racks the return is slow and dense: dimmed so it does not veil the hall below
      var c = V.col(lerp(a[3], b[3], u)), k = s.kind === 'recirc' ? 1.25 : 1, dim = s.kind === 'air' && P[i * 3 + 1] > RACK_H + 0.25 ? 0.42 : 1;
      C[i * 3] = Math.min(1, c.r * k) * dim; C[i * 3 + 1] = c.g * dim; C[i * 3 + 2] = c.b * dim;
    }
    pos.needsUpdate = true; colA.needsUpdate = true;
  }
  function step(dt) {
    var V = view; if (!V || !V.pa) return;
    place(V.pa, V.air, dt); place(V.pw, V.water, dt);
  }

  /* ------------------------------------------------------------------ CFD layer
   * js/ltc-cfd.js runs in a Web Worker on the same plant and the same DH01 solve; each frame it
   * posts the temperature and velocity fields. js/ltc-cfd-view.js turns them into the ray-marched
   * volume (heat, isotherms, speed, turbulence, vortices), the particle trails and the probe; here
   * they also colour the rack doors with the inlet the CFD computes, paint the slice and fill the
   * panel that compares the CFD with the balance solve. */
  var SPEED_MAX = 3;
  function cfdPayload(r, s) {
    var p = r.input, h = r.hall;
    return { r: { input: { rackPitchM: p.rackPitchM, rackDepthM: p.rackDepthM, hotAisleM: p.hotAisleM, supplyAirC: p.supplyAirC },
                  hall: { lengthM: h.lengthM, widthM: h.widthM, heightM: h.heightM, racks: h.racks, rowsY: h.rowsY, aisles: h.aisles, cdus: h.cdus, crahs: h.crahs } },
             s: { racks: s.racks.map(function (k) { return { dem: k.dem, q: k.q }; }), chw: s.chw, eps: s.eps, supply: s.supply, crahOut: s.crahOut, crahUnitM3s: s.crahUnitM3s } };
  }
  function cfdStart(r, s, st) {
    var V = view; if (!V || !root.Worker) return;
    var key = JSON.stringify([V.gkey, st.fault, st.header, st.phase, st.load, /^(chw|chiller)$/.test(st.fault) ? Math.round(st.minute) : 0, V.dx]);
    if (key === V.cfdKey) return;
    V.cfdKey = key;
    if (!V.worker) {
      var me = document.querySelector('script[src*="ltc-dh01-3d.js"]'), src = me ? me.src.replace('ltc-dh01-3d.js', 'ltc-cfd.js') : 'js/ltc-cfd.js';
      V.worker = new Worker(src);
      V.worker.onmessage = function (e) { if (e.data && e.data.cmd === 'frame' && e.data.key === V.cfdKey) cfdFrame(e.data); };
    }
    clearTimeout(V.cfdT);
    V.cfdT = setTimeout(function () {                 // the replay moves the minute fast: start once it settles
      var pl = cfdPayload(r, s); V.cfdBal = { max: s.maxInlet, over27: s.over27, ret: s.returnC };
      V.worker.postMessage({ cmd: 'start', key: key, r: pl.r, s: pl.s, opt: { dx: V.dx, batch: V.dx < 0.5 ? 1 : 3 } });
      V.cfd = null; hud('Solving the airflow on a ' + V.dx + ' m grid…');
    }, 250);
  }
  function hud(html) {                               // on a phone the panel keeps its first line; the rest sits under the stage
    var V = view; if (!V) return; var e = V.host.querySelector('.ltc-3d-hud'), m = V.host.querySelector('.ltc-3d-sum');
    if (e) e.innerHTML = html.split('<br>').map(function (l, i) { return '<span' + (i ? ' class="x"' : '') + '>' + l + '</span>'; }).join('');
    if (m) m.innerHTML = html.split('<br>').slice(1).join('<br>');
  }
  function ixb(k, v) { return '<b data-ix="' + k + '" tabindex="0">' + v + '</b>'; }
  /* the air-management indices, traced: formula, the inputs this solve fed it, and the rating */
  function ixTip(k) {
    var F = view && view.cfd; if (!F || !F.rep.idx) return null;
    var r = F.rep, x = r.idx, t = r.inletMean, n = t.length, over = 0, nOver = 0, under = 0, nUnder = 0, f1 = function (v) { return v.toFixed(1); };
    t.forEach(function (v) { if (v > 27) { over += v - 27; nOver++; } if (v < 18) { under += 18 - v; nUnder++; } });
    function rate(v) { return v >= 100 ? 'ideal' : v >= 96 ? 'good' : v >= 91 ? 'acceptable' : 'poor'; }
    var src = 'Rack inlets from the CFD (' + F.dx + ' m grid, ' + (r.averaged ? 'time-averaged' : 'instantaneous') + ').';
    if (k === 'rciHi') return { title: 'RCI HI · rack cooling index, hot side', formula: '(1 − Σ(T_in − 27) ÷ (n · (32 − 27))) × 100 %', rows: [['Σ over 27 °C', f1(over) + ' K across ' + nOver + ' racks'], ['n', n + ' racks'], ['RCI HI', f1(x.rciHi) + ' % · ' + rate(x.rciHi)]], note: 'Herrlin, on the ASHRAE A1 band: recommended max 27 °C, allowable max 32 °C. 100 % ideal, ≥ 96 % good, 91–95 % acceptable, ≤ 90 % poor. ' + src };
    if (k === 'rciLo') return { title: 'RCI LO · rack cooling index, cold side', formula: '(1 − Σ(18 − T_in) ÷ (n · (18 − 15))) × 100 %', rows: [['Σ under 18 °C', f1(under) + ' K across ' + nUnder + ' racks'], ['n', n + ' racks'], ['RCI LO', f1(x.rciLo) + ' % · ' + rate(x.rciLo)]], note: 'Over-cooling: inlets below the recommended 18 °C (allowable min 15 °C) waste chiller energy. ' + src };
    if (k === 'rti') return { title: 'RTI · return temperature index', formula: '(T_return − T_supply) ÷ ΔT_racks × 100 %', rows: [['T_return', f1(r.ret) + ' °C at the CRAH coils'], ['T_supply', f1(r.supply) + ' °C'], ['ΔT_racks', f1(x.dTeq) + ' K = Σ rack heat to air ÷ (ρ · cp · Σ rack airflow)'], ['RTI', x.rti.toFixed(0) + ' %']], note: '100 %: the CRAHs move exactly the racks\' air. Above 100 %: rack exhaust recirculates to inlets and the CRAHs see it twice. Below 100 %: supply air bypasses the racks straight back to the coils.' };
    if (k === 'shi') return { title: 'SHI · supply heat index', formula: 'Σ(T_in − T_supply) ÷ Σ(T_out − T_supply)', rows: [['RHI', (x.rhi).toFixed(2) + ' = 1 − SHI'], ['SHI', x.shi.toFixed(3)]], note: 'Sharma: the share of the heat air carries that it picked up before reaching a rack. 0 = every rack breathes pure supply air; commonly aimed below 0.2. T_out = inlet + rack heat ÷ (ρ · cp · airflow). ' + src };
    return null;
  }
  function doorsDirty() { view.fronts.forEach(function (f) { f.instanceColor.needsUpdate = true; }); view.rear.instanceColor.needsUpdate = true; }
  /* a rack's CFD inlet at a height: linear between the drawing face's cell centres */
  function profAt(p, dy, y) {
    var f = y / dy - 0.5, j = Math.max(0, Math.min(p.length - 1, Math.floor(f))), a = Math.max(0, Math.min(1, f - j));
    return j + 1 < p.length ? p[j] * (1 - a) + p[j + 1] * a : p[j];
  }
  /* what the CFD says about one rack, for the shared rack tooltip */
  function rackCfd(i) {
    var F = view && view.cfd; if (!F || !F.rep.profile || !F.rep.profile[i]) return null;
    var p = F.rep.profile[i];
    return { inlet: F.rep.inletMean[i], averaged: F.rep.averaged, dx: F.dx, bands: [0, 1, 2].map(function (b) { return profAt(p, F.rep.profDy, RACK_H * (b + 0.5) / 3); }), spread: Math.max.apply(null, p) - Math.min.apply(null, p) };
  }
  function cfdFrame(F) {
    var V = view, CV = root.LTCCFDView, first = !V.cfd || V.cfd.nx !== F.nx;
    if (F.solid) {
      V.cfdSolid = F.solid; V.contained = containedMask(F); V.slab = new Uint8Array(F.solid.length);
      for (var c = 0; c < F.solid.length; c++) if (F.solid[c] && (Math.floor(c / F.nx) % F.ny + 0.5) * F.dx > RACK_H) V.slab[c] = 1;
    }
    V.cfd = F; V.vort = CV.vorticity(F, V.cfdSolid);
    if (first) { CV.trails(V); applyLayers(); }
    // rack doors: the inlet the CFD computes, by height (bottom, middle, top third), and the exhaust
    F.rep.inletMean.forEach(function (t, i) {
      V.fronts.forEach(function (f, b) { f.setColorAt(i, V.col(profAt(F.rep.profile[i], F.rep.profDy, RACK_H * (b + 0.5) / DOOR_BANDS))); });
      V.rear.setColorAt(i, V.col(t + (V.s ? V.s.racks[i].exhaust - V.s.racks[i].inlet : 12)));
    });
    doorsDirty();
    cfdSlice(); cfdVolume();
    var rep = F.rep, bal = V.cfdBal || {}, err = rep.qRacksKw ? (rep.qCrahKw - rep.qRacksKw) / rep.qRacksKw * 100 : 0;
    var settled = Math.abs(err) < 1 && rep.t > 30, S = V.cfdSolid, tiRoom = null;
    if (F.ti) { var a = []; for (c = 0; c < F.ti.length; c++) if (!(S && S[c]) && !V.contained[c] && F.ti[c] > 0) a.push(F.ti[c]); a.sort(function (x, y) { return x - y; }); tiRoom = a.length ? a[Math.floor(a.length / 2)] : null; }
    var head = '<b>CFD</b> ' + F.dx + ' m · ' + (F.nx * F.ny * F.nz).toLocaleString('en-US') + ' cells · t = ' + rep.t.toFixed(0) + ' s' + (settled ? ' · <i class="ok">settled</i>' : ' · <i>converging</i>');
    hud(head +
      '<br>heat in <b>' + Math.round(rep.qRacksKw).toLocaleString('en-US') + '</b> kW · removed <b>' + Math.round(rep.qCrahKw).toLocaleString('en-US') + '</b> kW (' + (err >= 0 ? '+' : '') + err.toFixed(1) + ' %) · mass residual ' + rep.residual.toExponential(1) +
      '<br>hottest inlet <b>' + rep.maxInlet.toFixed(1) + ' °C</b> (balance ' + (bal.max != null ? bal.max.toFixed(1) : '—') + ') · racks &gt; 27 °C <b>' + rep.over27 + '</b> (balance ' + (bal.over27 != null ? bal.over27 : '—') + ') · return ' + rep.ret.toFixed(1) + ' °C' +
      '<br>air management, rack inlets ' + (rep.averaged ? 'time-averaged' : 'now') + ': RCI<sub>HI</sub> ' + ixb('rciHi', rep.idx.rciHi.toFixed(0) + ' %') + ' · RCI<sub>LO</sub> ' + ixb('rciLo', rep.idx.rciLo.toFixed(0) + ' %') +
      ' · RTI ' + ixb('rti', rep.idx.rti.toFixed(0) + ' %') + (rep.idx.rti > 105 ? ' recirculation' : rep.idx.rti < 95 ? ' bypass' : ' balanced') + ' · SHI ' + ixb('shi', rep.idx.shi.toFixed(2)) +
      '<br>turbulence: room median TI <b>' + (tiRoom != null ? (tiRoom * 100).toFixed(0) + ' %' : '—') + '</b> · vorticity p99 <b>' + CV.pct(V.vort, S, 0.99).toFixed(2) + ' s⁻¹</b>' + (F.dx > 0.45 ? ' · <i>0.6 m cells carry the mean flow; the 0.3 m grid resolves the eddies</i>' : ' · eddies resolved down to ' + (2 * F.dx).toFixed(1) + ' m'));
  }
  function cfdVolume() {
    var V = view; if (!V || !V.cfd) return;
    if (V.volMode === 'off') { if (V.vol) V.vol.visible = false; scale(); return; }
    root.LTCCFDView.volume(V, V.cfd, V.volMode, V.contained, V.vort, V.slab);
    V.vol.visible = true; scale();
  }
  /* the colour scale of what the volume shows */
  function scale() {
    var V = view, e = V.host.querySelector('.ltc-3d-scale'), CV = root.LTCCFDView, m = V.volMode; if (!e) return;
    if (m === 'off' || !V.cfd) { e.innerHTML = ''; return; }
    var stops = [], lab;
    if (m === 'heat' || m === 'iso') { for (var t = CV.T_LO; t <= CV.T_HI; t += 3) stops.push('rgb(' + V.ramp(t).join(',') + ')'); lab = [CV.T_LO + ' °C', m === 'iso' ? 'surfaces 27 · 32 °C' : 'room air > 27 °C glows', CV.T_HI + ' °C']; }
    else {
      for (var i = 0; i <= 8; i++) { var s = i / 8, c = s < 0.45 ? [13 + (0 - 13) * s / 0.45, 31 + (191 - 31) * s / 0.45, 115 + (242 - 115) * s / 0.45] : s < 0.55 ? [0, 191, 242] : [(s - 0.55) / 0.45 * 255, 191 + (242 - 191) * (s - 0.55) / 0.45, 242 - (242 - 191) * (s - 0.55) / 0.45]; stops.push('rgb(' + c.map(Math.round).join(',') + ')'); }
      var mx = m === 'speed' ? CV.SP_MAX + ' m/s' : m === 'ti' ? (CV.TI_MAX * 100) + ' %' : (V.vol ? V.vol.userData.chMax.toFixed(1) : '—') + ' s⁻¹';
      lab = ['0', m === 'speed' ? 'speed |u|' : m === 'ti' ? 'turbulence σ ÷ mean' : 'vorticity |∇×u|', mx];
    }
    e.innerHTML = '<i style="background:linear-gradient(90deg,' + stops.join(',') + ')"></i><span>' + lab[0] + '</span><span>' + lab[1] + '</span><span>' + lab[2] + '</span>';
  }
  /* slice: one canvas pixel per cell, interpolated on the GPU */
  function speedRamp(v) { var t = Math.max(0, Math.min(1, v / SPEED_MAX)); return [Math.round(20 + 230 * t), Math.round(40 + 180 * Math.sqrt(t)), Math.round(90 + 120 * (1 - t))]; }
  function cfdSlice() {
    var V = view, T = root.RZ3, F = V.cfd; if (!F) return;
    var mode = V.sliceField || 'T', plane = V.slicePlane || 'h';
    if (!V.cslice || V.cslice.userData.plane !== plane || V.cslice.userData.n !== F.nx * F.ny * F.nz) {
      if (V.cslice) { V.dyn.remove(V.cslice); V.cslice.geometry.dispose(); }
      var cv = document.createElement('canvas'); cv.width = F.nx; cv.height = plane === 'h' ? F.nz : F.ny;
      var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      var L = F.nx * F.dx, W = F.nz * F.dx, H = F.ny * F.dx;
      V.cslice = new T.Mesh(plane === 'h' ? new T.PlaneGeometry(L, W) : new T.PlaneGeometry(L, H), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
      if (plane === 'h') V.cslice.rotation.x = -Math.PI / 2;
      V.cslice.userData = { cv: cv, plane: plane, n: F.nx * F.ny * F.nz }; V.cslice.renderOrder = 4; V.dyn.add(V.cslice);
    }
    var cv2 = V.cslice.userData.cv, g = cv2.getContext('2d'), img = g.createImageData(cv2.width, cv2.height), D = img.data, S = V.cfdSolid, A = F.Tm || F.T, ti = F.ti, vo = V.vort, vmax = Math.max(0.5, root.LTCCFDView.pct(vo || [], S, 0.995));
    var at = V.sliceAt != null ? V.sliceAt : (plane === 'h' ? 1.2 : null), nx = F.nx, ny = F.ny, nz = F.nz;
    if (plane === 'v' && at == null) { var ai = V.r.hall.aisles[Math.min(1, V.r.hall.aisles.length - 1)]; at = (ai.y0 + ai.y1) / 2; }
    var fixed = plane === 'h' ? Math.max(0, Math.min(ny - 1, Math.floor(at / F.dx))) : Math.max(0, Math.min(nz - 1, Math.floor(at / F.dx)));
    for (var a = 0; a < cv2.width; a++) for (var b = 0; b < cv2.height; b++) {
      var i = a, j = plane === 'h' ? fixed : ny - 1 - b, k = plane === 'h' ? b : fixed, c = i + nx * (j + ny * k), o = (b * cv2.width + a) * 4, rgb;
      if (S && S[c]) { D[o] = 26; D[o + 1] = 30; D[o + 2] = 36; D[o + 3] = 235; continue; }
      if (mode === 'T') rgb = ramp(A[c]);
      else {
        var uc = 0.5 * (F.u[i + (nx + 1) * (j + ny * k)] + F.u[i + 1 + (nx + 1) * (j + ny * k)]), vc = 0.5 * (F.v[i + nx * (j + (ny + 1) * k)] + F.v[i + nx * (j + 1 + (ny + 1) * k)]), wc = 0.5 * (F.w[c] + F.w[c + nx * ny]);
        rgb = mode === 'speed' ? speedRamp(Math.sqrt(uc * uc + vc * vc + wc * wc)) : mode === 'vort' ? speedRamp(vo ? vo[c] / vmax * SPEED_MAX : 0) : speedRamp(ti ? ti[c] * SPEED_MAX / 0.6 : 0);
      }
      D[o] = rgb[0]; D[o + 1] = rgb[1]; D[o + 2] = rgb[2]; D[o + 3] = 215;
    }
    g.putImageData(img, 0, 0); V.cslice.material.map.needsUpdate = true;
    if (plane === 'h') V.cslice.position.set(0, (fixed + 0.5) * F.dx, 0); else V.cslice.position.set(0, F.ny * F.dx / 2, (fixed + 0.5) * F.dx - F.nz * F.dx / 2);
    V.cslice.visible = V.layers.cfd && V.slicePlane !== 'off';
  }
  function ramp(t) { return root.LTCDH01.ramp(t); }
  /* cells where hot air belongs: inside the contained hot aisles and the ceiling plenum */
  function containedMask(F) {
    var V = view, h = V.r.hall, p = V.r.input, m = new Uint8Array(F.nx * F.ny * F.nz), x0 = 1e9, x1 = 0, jP = Math.floor((h.heightM - PLEN_D) / F.dx);
    h.racks.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x + p.rackPitchM); });
    for (var k = 0; k < F.nz; k++) for (var j = 0; j < F.ny; j++) for (var i = 0; i < F.nx; i++) {
      var x = (i + 0.5) * F.dx, z = (k + 0.5) * F.dx, c = i + F.nx * (j + F.ny * k);
      if (j >= jP) { m[c] = 1; continue; }
      if (x > x0 && x < x1) h.rowsY.forEach(function (row) { if (z > row.hotY0 && z < row.hotY0 + p.hotAisleM) m[c] = 1; });
    }
    return m;
  }
  var CAMS = {
    iso: function (d) { return { p: [d.L * 0.62, Math.max(d.L, d.W) * 0.78, d.W * 0.95], t: [0, 0.8, 0] }; },
    top: function (d) { return { p: [0, Math.max(d.L, d.W) * 1.55, 0.01], t: [0, 0, 0] }; },
    cold: function (d, r) { var a = r.hall.aisles[Math.min(1, r.hall.aisles.length - 1)], z = (a.y0 + a.y1) / 2 - d.W / 2; return { p: [-d.L / 2 + 1.2, 1.6, z], t: [d.L / 2, 1.1, z] }; },
    hot: function (d, r) { var hz = r.hall.rowsY[0].hotY0 + r.input.hotAisleM / 2 - d.W / 2; return { p: [-d.L / 2 + 3.2, 3.4, hz], t: [d.L / 2, 1.2, hz] }; },
    plenum: function (d) { return { p: [-d.L / 2 - 2, d.H - 0.3, -d.W / 2 + 1], t: [d.L / 2, d.H - 0.6, d.W / 2] }; }
  };
  function camTo(k, now) {
    var V = view; if (!V || !V.dims || !V.r && !now) { V && (V.pendingCam = k); return; }
    var c = CAMS[k](V.dims, V.r || { hall: { aisles: [{ y0: 0, y1: 1 }], rowsY: [{ hotY0: 0 }] }, input: { hotAisleM: 1 } });
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (now || reduce) { V.cam.position.set(c.p[0], c.p[1], c.p[2]); V.ctl.target.set(c.t[0], c.t[1], c.t[2]); V.ctl.update(); return; }
    V.tween = { t0: performance.now(), d: 900, p0: V.cam.position.clone(), t0v: V.ctl.target.clone(), p1: c.p, t1: c.t };
    [].forEach.call(V.host.querySelectorAll('[data-cam]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cam') === k)); });
  }

  function loop(now) {
    var V = view; if (!V) return;
    requestAnimationFrame(loop);
    if (!V.visible || document.hidden || !V.cv.clientWidth) { V.last = now; return; }
    var dt = Math.min(0.05, (now - (V.last || now)) / 1000); V.last = now;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (V.tween) {
      var w = Math.min(1, (now - V.tween.t0) / V.tween.d), e = 1 - Math.pow(1 - w, 3);
      V.cam.position.set(lerp(V.tween.p0.x, V.tween.p1[0], e), lerp(V.tween.p0.y, V.tween.p1[1], e), lerp(V.tween.p0.z, V.tween.p1[2], e));
      V.ctl.target.set(lerp(V.tween.t0v.x, V.tween.t1[0], e), lerp(V.tween.t0v.y, V.tween.t1[1], e), lerp(V.tween.t0v.z, V.tween.t1[2], e));
      if (w >= 1) V.tween = null;
    }
    if (!reduce) {
      step(dt * V.speed); root.LTCCFDView.trailStep(V, dt * V.speed); root.LTCCFDView.smokeStep(V, dt * V.speed);
      (V.crahs || []).forEach(function (u) { if (!u.dead) u.fans.forEach(function (f) { f.rotation.z += dt * V.speed * 14 * (V.fan || 0); }); });
    }
    V.ctl.update(); root.LTCCFDView.volumeFrame(V);
    V.renderer.render(V.scene, V.cam);
    var b = V.cv.clientWidth, hh = V.cv.clientHeight, v = new root.RZ3.Vector3();
    V.labels.forEach(function (l) {
      v.set(l.p[0], l.p[1], l.p[2]).project(V.cam);
      var on = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.display = on ? '' : 'none';
      if (!on) return;                                  // kept inside the stage on a narrow screen
      var ow = l.el.offsetWidth, oh = l.el.offsetHeight, x = Math.max(4, Math.min(b - ow - 4, (v.x + 1) / 2 * b - ow / 2)), y = Math.max(4, Math.min(hh - oh - 4, (1 - v.y) / 2 * hh - oh / 2));
      l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
  }

  root.LTCDH013D = { isMounted: function () { return !!view; }, rackCfd: rackCfd, flowModel: flowModel, wallShares: wallShares, mount: mount, update: update, camTo: camTo, RACK_H: RACK_H, PLEN_D: PLEN_D, PIPE_V: PIPE_V };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LTCDH013D;
})(typeof window !== 'undefined' ? window : globalThis);
