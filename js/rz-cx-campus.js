/* rz-cx-campus.js — the 3D plant of the Cx Analysis tab (PRD v1.1 §11): a representative campus drawn
 * procedurally from the declared site basis (hall 62 × 31 m, plant west, dry coolers north, gensets east,
 * 150 kV switchyard south), every piece of equipment tinted by the handbook 02.6 tag its SYSTEM carries at
 * the viewed month, and the service flows (150 kV · 20 kV · 400 V · FWS · TCS · CHW) as particle streams
 * labelled "design simulation". Click a building: neighbours dim, its roof lifts, the equipment inside shows,
 * the breadcrumb grows; click the floor or press 0 to come back. three.js r170 (js/vendor/three-r170.min.js,
 * global RZ3) loaded on approach. No WebGL → one sentence; the schematic stands alone. ES5.
 *   RZCxCampus.mount(host, opts)  opts.onSelect(systemId), opts.status() → RZCxPlan.statusAt row list
 *   host.__rzCampus.setStatus(status) / setPaused(bool) / focus(buildingId|null) / stats() */
(function (root) {
  'use strict';
  var REDUCE = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAG_HEX = { red: 0xef4444, yellow: 0xd49a2a, green: 0x22c55e, blue: 0x3b82f6, white: 0xe4e4e7, none: 0x50545c };
  var MED = { hv: 0xef4444, mv: 0xd49a2a, lv: 0x22c55e, supply: 0x22d3ee, ret: 0xd49a2a, chw: 0x22d3ee };
  /* Site basis — ADOPTED, metres, origin at the hall centre. Declared on the page as "Representative · Conceptual". */
  var SITE = {
    hall: { id: 'hall', name: 'Data hall', x: 0, z: 0, w: 62, d: 31, h: 12, systems: ['racks', 'cdu', 'crah', 'ups', 'lv_busway', 'unit_subs', 'bms', 'epms', 'fire', 'ot_network'] },
    plant: { id: 'plant', name: 'Chiller / FWS plant', x: -62, z: 0, w: 36, d: 24, h: 8, systems: ['chillers', 'fws'] },
    dry: { id: 'dry', name: 'Dry cooler yard', x: -10, z: -36, w: 70, d: 12, h: 0, systems: ['dry_coolers'] },
    gens: { id: 'gens', name: 'Generator yard', x: 56, z: 0, w: 28, d: 34, h: 0, systems: ['generators'] },
    sub: { id: 'sub', name: '150 kV switchyard', x: -8, z: 42, w: 54, d: 26, h: 0, systems: ['hv_intake', 'main_tx', 'mv_board'] }
  };
  var ORDER = { none: 0, red: 1, yellow: 2, green: 3, blue: 4, white: 5 };

  function worstLevel(status, ids) {
    var best = null, order = ['L1', 'L2', 'L3', 'L4', 'L5'];
    for (var i = 0; i < ids.length; i++) { var r = status.byId[ids[i]]; if (!r || !r.level) return null; if (best === null || order.indexOf(r.level) < order.indexOf(best)) best = r.level; }
    return best;
  }
  function worstTag(status, ids) {
    var w = 'white', seen = false;
    for (var i = 0; i < ids.length; i++) { var r = status && status.byId[ids[i]]; if (!r) continue; seen = true; var t = r.tag || 'none'; if (ORDER[t] < ORDER[w]) w = t; }
    return seen ? w : 'none';
  }
  function indexStatus(st) { var by = {}; if (st && st.systems) for (var i = 0; i < st.systems.length; i++) by[st.systems[i].id] = st.systems[i]; return { byId: by, month: st ? st.month : 0 }; }

  function mount(host, opts) {
    if (!host || host.__rzCampus) return host && host.__rzCampus;
    opts = opts || {};
    var T = root.RZ3; var stage = host.querySelector('.cx-3d-stage'), cv = host.querySelector('canvas'), crumb = host.querySelector('.cx-3d-crumb'), note = host.querySelector('.cx-3d-note');
    if (!T || !stage || !cv) return null;
    var gl; try { gl = cv.getContext('webgl2') || cv.getContext('webgl'); } catch (e) { gl = null; }
    if (!gl) { stage.innerHTML = '<p class="cx-3d-nogl">This browser has no WebGL. The schematic above carries the same systems, the same months and the same tags; nothing here is missing from it.</p>'; host.setAttribute('data-cx-3d', 'nogl'); return null; }
    var renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    var phone = root.innerWidth < 800, basePR = Math.min(root.devicePixelRatio || 1, phone ? 1 : 1.25), quality = 1; renderer.setPixelRatio(basePR);
    var scene = new T.Scene();
    var cam = new T.OrthographicCamera(-1, 1, 1, -1, -500, 1000); cam.zoom = 1;
    var ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.dampingFactor = 0.1; ctl.enablePan = true; ctl.autoRotate = false; ctl.minZoom = 0.5; ctl.maxZoom = 8;
    ctl.maxPolarAngle = Math.PI * 0.47; ctl.minPolarAngle = 0.2;
    scene.add(new T.HemisphereLight(0xe8edf5, 0x1a1c22, 1.05));
    var sun = new T.DirectionalLight(0xffffff, 0.9); sun.position.set(60, 120, 40); scene.add(sun);
    /* Palette = the tool register's own tokens (computed on the host), so the scene follows the theme like the rest of the page. */
    function isDark() { return (document.documentElement.getAttribute('data-theme') || 'dark') !== 'light'; }
    function tok(name, fallback) { var v = ''; try { v = getComputedStyle(host).getPropertyValue(name).trim(); } catch (e) { v = ''; } if (!v) return new T.Color(fallback); try { return new T.Color(v); } catch (e2) { return new T.Color(fallback); } }
    function palette() {
      var dark = isDark();
      return { dark: dark, ground: tok('--rzt-inset', dark ? 0x121316 : 0xe9ecf0), grid: tok('--rzt-line', dark ? 0x2a2d34 : 0xcfd4db), gridSoft: tok('--rzt-line-soft', dark ? 0x1d1f25 : 0xdfe3e8),
        wall: dark ? 0x363a43 : 0xd9dde3, roof: dark ? 0x474c56 : 0xc4c9d0, floor: dark ? 0x1f2227 : 0xf2f4f6, yard: dark ? 0x1b1d23 : 0xe2e5ea, fence: dark ? 0x4b505a : 0x9aa0aa, road: dark ? 0x1e2026 : 0xd3d7dd, none: dark ? 0x8b919c : 0x9aa0aa };
    }
    var pal = palette(), dark = pal.dark;
    var ground = new T.Mesh(new T.PlaneGeometry(600, 450), new T.MeshBasicMaterial({ color: pal.ground })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.position.set(-5, -0.05, 6); scene.add(ground);
    var grid = new T.GridHelper(200, 20, pal.gridSoft, pal.gridSoft); grid.position.set(-5, 0, 6); grid.material.transparent = true; grid.material.opacity = dark ? 0.35 : 0.4; scene.add(grid);

    /* ---- materials ---- */
    var mat = {
      wall: new T.MeshStandardMaterial({ color: pal.wall, transparent: true, opacity: 1 }),
      roof: new T.MeshStandardMaterial({ color: pal.roof, transparent: true, opacity: 1 }),
      floor: new T.MeshStandardMaterial({ color: pal.floor }),
      yard: new T.MeshStandardMaterial({ color: pal.yard }),
      fence: new T.LineBasicMaterial({ color: pal.fence }),
      road: new T.MeshStandardMaterial({ color: pal.road })
    };
    function retheme() {
      pal = palette(); dark = pal.dark; TAG_HEX.none = pal.none;
      ground.material.color.copy(pal.ground); grid.material.color.copy(pal.gridSoft); grid.material.opacity = dark ? 0.35 : 0.4;
      mat.wall.color.set(pal.wall); mat.roof.color.set(pal.roof); mat.floor.color.set(pal.floor); mat.yard.color.set(pal.yard); mat.fence.color.set(pal.fence); mat.road.color.set(pal.road);
      for (var k in buildings) if (buildings.hasOwnProperty(k)) { var b = buildings[k]; if (b.userData.walls) b.userData.walls.material.color.set(pal.wall); if (b.userData.roof) b.userData.roof.material.color.set(pal.roof); }
      applyStatus();
    }
    if ('MutationObserver' in root) new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    var buildings = {}, equipment = [], flows = [], focused = null, paused = false, status = indexStatus(opts.status && opts.status());

    function box(w, h, d, m) { var g = new T.Mesh(new T.BoxGeometry(w, h, d), m); return g; }
    function edges(w, h, d, color) { var e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, h, d)), new T.LineBasicMaterial({ color: color || 0x50545c })); return e; }
    /* one InstancedMesh per equipment family (one draw call), coloured per instance by its system tag. The shape
     * comes from RZCxAssets — merged, vertex-shaded primitives at the family footprint, y from the floor — and
     * falls back to a plain box when that module is absent, so the campus never fails for a missing asset. */
    var assets = root.RZCxAssets, shaped = 0;
    function family(systemId, count, w, h, d, place, meta) {
      var geo = assets && assets.build(T, systemId, w, h, d), isShape = !!(geo && geo.attributes.color);
      if (isShape) shaped++; else geo = new T.BoxGeometry(w, h, d).translate(0, h / 2, 0);
      var im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: isShape }), count); im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      var o = new T.Object3D();
      for (var i = 0; i < count; i++) { var p = place(i); o.position.set(p[0], p[3] || 0, p[2]); o.rotation.y = p[1] || 0; o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, new T.Color(TAG_HEX.none)); }
      im.userData = { system: systemId, label: meta && meta.label, building: meta && meta.building, shaped: isShape }; equipment.push(im); return im;
    }
    function tint(im) { var r = status.byId[im.userData.system], c = new T.Color(TAG_HEX[(r && r.tag) || 'none']); for (var i = 0; i < im.count; i++) im.setColorAt(i, c); im.instanceColor.needsUpdate = true; }

    function building(spec) {
      var g = new T.Group(); g.position.set(spec.x, 0, spec.z); g.userData = { building: spec.id, name: spec.name };
      var inner = new T.Group(); inner.visible = false; g.add(inner); g.userData.inner = inner;
      if (spec.h) {
        var walls = box(spec.w, spec.h, spec.d, mat.wall.clone()); walls.position.y = spec.h / 2; walls.userData.part = 'walls'; walls.userData.building = spec.id; g.add(walls);
        var roof = box(spec.w + 0.6, 0.5, spec.d + 0.6, mat.roof.clone()); roof.position.y = spec.h + 0.25; roof.userData.part = 'roof'; g.add(roof); g.userData.roof = roof; g.userData.walls = walls;
        var e = edges(spec.w, spec.h, spec.d); e.position.y = spec.h / 2; g.add(e); g.userData.edge = e;
        var floor = box(spec.w, 0.2, spec.d, mat.floor); floor.position.y = 0.1; floor.userData.building = spec.id; g.add(floor);
      } else {
        var yard = box(spec.w, 0.3, spec.d, mat.yard); yard.position.y = 0.15; yard.userData.building = spec.id; yard.userData.part = 'yard'; g.add(yard);
        var f = edges(spec.w, 2.2, spec.d); f.position.y = 1.1; g.add(f); g.userData.edge = f;
      }
      scene.add(g); buildings[spec.id] = g; return g;
    }
    var counts = opts.counts || {};
    function cnt(k, d) { return Math.max(1, Math.min(counts[k] || d, 40)); }

    /* ---- the hall: rack rows, CDUs at the row ends, CRAH along the long walls, LV/UPS room east, control room ---- */
    var hall = building(SITE.hall), hi = hall.userData.inner;
    var rows = 10, perRow = 22, pitch = 3.1;
    hi.add(family('racks', rows * perRow, 0.6, 2.2, 1.2, function (i) { var r = Math.floor(i / perRow), c = i % perRow; return [-24 + c * 0.9, 0, -14 + r * pitch + 0.2]; }, { building: 'hall', label: 'rack rows' }));
    hi.add(family('cdu', rows * 2, 1.2, 2.0, 1.0, function (i) { var r = Math.floor(i / 2), s = i % 2; return [s ? -3.2 + 0.9 * perRow - 24 + 1.6 : -26, 0, -14 + r * pitch + 0.2]; }, { building: 'hall', label: 'CDUs, end of row' }));
    hi.add(family('crah', 16, 2.4, 2.6, 1.0, function (i) { var side = i < 8 ? -1 : 1, k = i % 8; return [-26 + k * 7.2, 0, side * 14.6]; }, { building: 'hall', label: 'CRAH / fan walls' }));
    hi.add(family('ups', 8, 1.0, 2.2, 0.9, function (i) { return [22 + (i % 4) * 1.4, 0, -12 + Math.floor(i / 4) * 2.4]; }, { building: 'hall', label: 'UPS' }));
    hi.add(family('unit_subs', 4, 2.2, 2.4, 1.6, function (i) { return [22 + i * 2.6, 0, -4]; }, { building: 'hall', label: 'unit substations' }));
    hi.add(family('lv_busway', 4, 1.6, 2.2, 0.8, function (i) { return [22 + i * 2.6, 0, 0.5]; }, { building: 'hall', label: 'LV switchboards' }));
    hi.add(family('bms', 3, 0.8, 2.0, 0.8, function (i) { return [24 + i * 1.2, 0, 8]; }, { building: 'hall', label: 'BMS / EPMS / OT racks' }));
    hi.add(family('fire', 2, 1.6, 1.6, 0.8, function (i) { return [24 + i * 2.2, 0, 12]; }, { building: 'hall', label: 'fire panel + agent' }));
    /* plant: chillers, FWS pumps */
    var plant = building(SITE.plant), pi = plant.userData.inner;
    pi.add(family('chillers', cnt('chillers', 6), 5, 2.6, 2.4, function (i) { return [-14 + (i % 6) * 5.6, 0, -6 + Math.floor(i / 6) * 5]; }, { building: 'plant', label: 'chillers' }));
    pi.add(family('fws', cnt('pumps', 8), 1.4, 1.4, 2.4, function (i) { return [-14 + (i % 8) * 3.6, 0, 7]; }, { building: 'plant', label: 'FWS pumps' }));
    /* yards (no roof): equipment always visible */
    var dry = building(SITE.dry); dry.userData.inner.visible = true;
    dry.userData.inner.add(family('dry_coolers', cnt('coolers', 14), 4, 2.4, 2.4, function (i) { return [-32 + (i % 14) * 4.8, 0, -3 + Math.floor(i / 14) * 5]; }, { building: 'dry', label: 'dry coolers' }));
    var gens = building(SITE.gens); gens.userData.inner.visible = true;
    gens.userData.inner.add(family('generators', cnt('generators', 8), 3, 3.2, 12, function (i) { return [-10 + (i % 4) * 6, 0, -8 + Math.floor(i / 4) * 16]; }, { building: 'gens', label: 'generators' }));
    var sub = building(SITE.sub); sub.userData.inner.visible = true;
    sub.userData.inner.add(family('hv_intake', 4, 2, 7, 2, function (i) { return [-20 + i * 5, 0, 8]; }, { building: 'sub', label: '150 kV bays' }));
    sub.userData.inner.add(family('main_tx', cnt('transformers', 2), 6, 4.5, 4, function (i) { return [-14 + i * 10, 0, 0]; }, { building: 'sub', label: '150/20 kV transformers' }));
    sub.userData.inner.add(family('mv_board', 1, 20, 5, 8, function () { return [10, 0, -6]; }, { building: 'sub', label: '20 kV GIS hall' }));
    /* roads */
    [[0, 22, 200, 4], [-40, 0, 4, 60], [40, 0, 4, 60]].forEach(function (r) { var m = box(r[2], 0.12, r[3], mat.road); m.position.set(r[0], 0.06, r[1]); scene.add(m); });

    /* ---- flows: polylines with particle streams. Speed ∝ design flow; labelled "design simulation" ---- */
    var itKw = opts.itLoadKw || 2000, fwsLps = itKw / (4.18 * 10);   // ΔT 10 K on the FWS, water
    var speedScale = Math.min(2.5, Math.max(0.6, Math.sqrt(itKw / 10000)));
    function flow(id, color, pts, n, speed, lineOpts) {
      var v = pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); });
      var curve = new T.CatmullRomCurve3(v, false, 'catmullrom', 0.0);
      var line = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(40)), new T.LineBasicMaterial({ color: color, transparent: true, opacity: lineOpts && lineOpts.faint ? 0.35 : 0.8 })); scene.add(line);
      var pos = new Float32Array(n * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      var pm = new T.PointsMaterial({ color: color, size: phone ? 1.4 : 2.2, sizeAttenuation: false }); var pts3 = new T.Points(geo, pm); scene.add(pts3);
      var f = { id: id, curve: curve, n: n, pos: pos, geo: geo, speed: speed, t: 0, points: pts3, line: line }; flows.push(f); step(f, 0); return f;
    }
    function step(f, dt) { f.t = (f.t + dt * f.speed) % 1; for (var i = 0; i < f.n; i++) { var p = f.curve.getPointAt((f.t + i / f.n) % 1); f.pos[i * 3] = p.x; f.pos[i * 3 + 1] = p.y; f.pos[i * 3 + 2] = p.z; } f.geo.attributes.position.needsUpdate = true; }
    flow('hv', MED.hv, [[-30, 7, 70], [-30, 7, 50], [-28, 7, 50]], 10, 0.10);
    flow('mv', MED.mv, [[-8, 5, 36], [-8, 5, 24], [24, 3, 24], [24, 3, 16]], 14, 0.12);
    flow('lv', MED.lv, [[24, 2.5, 12], [24, 2.5, -6], [-20, 2.5, -6], [-20, 2.5, 12]], 20, 0.16);
    flow('fws_s', MED.supply, [[-46, 1.2, -4], [-32, 1.2, -4], [-32, 1.2, 12]], 16, 0.07 * speedScale);
    flow('fws_r', MED.ret, [[-32, 2.2, 12], [-32, 2.2, -8], [-46, 2.2, -8]], 16, 0.07 * speedScale);
    flow('dry_s', MED.supply, [[-50, 1.2, -12], [-50, 1.2, -32], [10, 1.2, -32]], 16, 0.06 * speedScale);
    flow('dry_r', MED.ret, [[10, 2.2, -34], [-52, 2.2, -34], [-52, 2.2, -12]], 16, 0.06 * speedScale);
    flow('tcs', MED.supply, [[-26, 1, -13], [26, 1, -13], [26, 1, 14], [-26, 1, 14]], 24, 0.09 * speedScale);
    flow('chw', MED.chw, [[-44, 1.2, 6], [-34, 1.2, 6], [-34, 1.2, 15.5], [26, 1.2, 15.5]], 12, 0.05 * speedScale, { faint: true });
    flow('gen', MED.mv, [[44, 3, 0], [34, 3, 0], [34, 3, 10]], 1, 0.0, { faint: true });   // ATS normally open: a line, no stream
    if (note) note.textContent = 'Design simulation · particle speed ∝ design flow · FWS ≈ ' + Math.round(fwsLps) + ' L/s at ΔT 10 K for ' + Math.round(itKw).toLocaleString('en-US') + ' kW IT · 150 kV red · 20 kV amber · 400 V green · supply cyan · return amber · Representative, conceptual site basis';

    /* ---- status tint ---- */
    function applyStatus() {
      for (var i = 0; i < equipment.length; i++) tint(equipment[i]);
      for (var k in buildings) if (buildings.hasOwnProperty(k)) { var b = buildings[k], w = worstTag(status, SITE[k].systems); b.userData.edge.material.color.set(TAG_HEX[w]); b.userData.tag = w; b.userData.level = worstLevel(status, SITE[k].systems); }
      placeLabels(); draw();
    }
    /* ---- focus: roof off, neighbours dim, interior on ---- */
    var anim = { roof: 0, target: 0 };
    function focus(id) {
      focused = id || null;
      for (var k in buildings) if (buildings.hasOwnProperty(k)) {
        var b = buildings[k], on = !focused || k === focused, dim = focused && k !== focused;
        if (b.userData.walls) { b.userData.walls.material.opacity = dim ? 0.18 : (k === focused ? 0.22 : 1); b.userData.walls.material.transparent = true; }
        if (b.userData.roof) { b.userData.roof.material.opacity = dim ? 0.12 : 1; }
        b.userData.inner.visible = SITE[k].h === 0 || k === focused;
        b.userData.edge.material.opacity = dim ? 0.3 : 1; b.userData.edge.material.transparent = true;
        if (b.userData.inner.visible && SITE[k].h) b.userData.inner.children.forEach(function (c) { c.visible = true; });
      }
      anim.target = focused && buildings[focused].userData.roof ? 1 : 0;
      if (crumb) crumb.innerHTML = '<button type="button" data-crumb="">Campus</button>' + (focused ? ' › <b>' + SITE[focused].name + '</b>' : '');
      host.setAttribute('data-cx-focus', focused || '');
      var sp = focused ? SITE[focused] : null; if (sp) { ctl.target.set(sp.x, 2, sp.z); cam.zoom = Math.max(2.4, Math.min(5, 3.2 * 62 / Math.max(sp.w, sp.d))); } else { ctl.target.set(BOUNDS.cx, 0, BOUNDS.cz); cam.zoom = 1; }
      cam.updateProjectionMatrix(); ctl.update(); placeLabels(); draw();
    }
    /* ---- camera presets ---- */
    function preset(k) {
      var d = 220, pos = { campus: [d, d * 0.9, d], plant: [-d, d * 0.8, d * 0.6], hall: [d * 0.8, d, d * 0.8], sub: [d * 0.4, d, d * 1.2] }[k] || [d, d * 0.9, d];
      cam.position.set(pos[0], pos[1], pos[2]); if (k === 'plant') focus('plant'); else if (k === 'hall') focus('hall'); else if (k === 'sub') focus('sub'); else focus(null);
    }
    /* ---- picking ---- */
    var ray = new T.Raycaster(), ndc = new T.Vector2(), down = null;
    cv.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', function (e) {
      if (!down || Math.abs(e.clientX - down[0]) > 4 || Math.abs(e.clientY - down[1]) > 4) { down = null; return; } down = null;
      var r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      var hits = ray.intersectObjects(scene.children, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        if (o.userData && o.userData.system) { if (opts.onSelect) opts.onSelect(o.userData.system); return; }
        var b = o.userData && o.userData.building; if (!b && o.parent && o.parent.userData && o.parent.userData.building) b = o.parent.userData.building;
        if (b) { if (focused === b) { if (o.userData.part === 'roof') return; } focus(b); return; }
        if (o === ground) { focus(null); return; }
      }
    });
    if (crumb) crumb.addEventListener('click', function (e) { var b = e.target.closest('[data-crumb]'); if (b) focus(b.getAttribute('data-crumb') || null); });
    cv.addEventListener('keydown', function (e) { if (e.key === '0') { preset('campus'); e.preventDefault(); } else if (e.key >= '1' && e.key <= '4') { preset(['campus', 'plant', 'hall', 'sub'][+e.key - 1]); e.preventDefault(); } else if (e.key === 'Escape' && focused) { focus(null); e.preventDefault(); } });
    Array.prototype.forEach.call(host.querySelectorAll('[data-cam]'), function (b) { b.addEventListener('click', function () { preset(b.getAttribute('data-cam')); }); });
    var pauseBtn = host.querySelector('[data-pause]'); if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!paused); });
    var roofBtn = host.querySelector('[data-roof]'); if (roofBtn) roofBtn.addEventListener('click', function () { focus(focused ? null : 'hall'); });
    function setPaused(v) { paused = !!v; if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.textContent = paused ? 'Resume flows' : 'Pause flows'; } draw(); }

    /* ---- loop: runs only in view, only while something moves ---- */
    var raf = null, last = 0, inView = true, frames = 0, fpsAcc = 0, fps = 0, lastFps = 0, lastDraw = 0, fastSecs = 0, busy = 0, interacting = false;
    /* Adaptive quality: a weak GPU (or software GL) gets fewer pixels and a 30 fps cap instead of a pegged main thread. */
    function adapt(msPerFrame) {
      if (msPerFrame > 40 && quality > 0.5) { quality = quality > 0.75 ? 0.75 : 0.5; fastSecs = 0; renderer.setPixelRatio(basePR * quality); resize(); }
      else if (msPerFrame < 14 && quality < 1 && ++fastSecs >= 3) { quality = quality < 0.75 ? 0.75 : 1; fastSecs = 0; renderer.setPixelRatio(basePR * quality); resize(); }
    }
    /* Frustum fits the whole site at zoom 1: half-width from the rotated footprint, half-height from its isometric projection. */
    var BOUNDS = (function () { var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (var k in SITE) if (SITE.hasOwnProperty(k)) { var s = SITE[k]; x0 = Math.min(x0, s.x - s.w / 2); x1 = Math.max(x1, s.x + s.w / 2); z0 = Math.min(z0, s.z - s.d / 2); z1 = Math.max(z1, s.z + s.d / 2); } return { spanX: x1 - x0, spanZ: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; })();
    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false);
      var a = w / h, halfW = (BOUNDS.spanX + BOUNDS.spanZ) * 0.5 * 0.74 * 1.08, halfH = (BOUNDS.spanX + BOUNDS.spanZ) * 0.5 * 0.5 * 1.15;
      var s = Math.max(halfW / a, halfH); cam.left = -s * a; cam.right = s * a; cam.top = s; cam.bottom = -s; cam.updateProjectionMatrix(); placeLabels();
    }
    /* Building labels: HTML, projected from each building's roof centre; the register's mono at 11 px, no pointer events. */
    var labelHost = document.createElement('div'); labelHost.className = 'cx-3d-labels'; labelHost.setAttribute('aria-hidden', 'true'); stage.appendChild(labelHost);
    var labels = {}; for (var lk in SITE) if (SITE.hasOwnProperty(lk)) { var el = document.createElement('span'); el.className = 'cx-3d-lbl'; el.setAttribute('data-building', lk); labelHost.appendChild(el); labels[lk] = el; }
    var _v = new T.Vector3();
    function labelText(k) { var b = buildings[k], tg = b && b.userData.tag, lv = b && b.userData.level; return SITE[k].name + (lv ? ' · ' + lv + ' ' + tg : ' · not started'); }
    function placeLabels() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      var rows = [];
      for (var k in labels) if (labels.hasOwnProperty(k)) {
        var s = SITE[k], el = labels[k], hide = focused && k !== focused;
        if (hide) { el.hidden = true; continue; }
        _v.set(s.x, (s.h || 2.2) + 1.5, s.z).project(cam);
        var txt = labelText(k), x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * h;
        rows.push({ el: el, k: k, x: x, y: y, wpx: txt.length * 6.7 + 30, txt: txt });
      }
      rows.sort(function (a, b) { return a.y - b.y; });
      var placed = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i]; r.x = Math.max(6, Math.min(w - r.wpx + 10, r.x)); var top = r.y - 28, bottom = top + 22, left = r.x - 4, right = left + r.wpx;
        for (var j = 0; j < placed.length; j++) { var q = placed[j]; if (left < q.right && right > q.left && top < q.bottom + 3 && bottom > q.top - 3) { var dy = q.bottom + 4 - top; top += dy; bottom += dy; r.y += dy; } }
        placed.push({ left: left, right: right, top: top, bottom: bottom });
        var hid = r.x < -40 || r.x > w + 40 || r.y < 0 || r.y > h, tr = 'translate(' + Math.round(r.x) + 'px,' + Math.round(r.y) + 'px)', tg = (buildings[r.k] && buildings[r.k].userData.tag) || 'none';
        if (r.el.hidden !== hid) r.el.hidden = hid; if (r.el.__tr !== tr) { r.el.__tr = tr; r.el.style.transform = tr; }
        if (r.el.__tg !== tg) { r.el.__tg = tg; r.el.setAttribute('data-tag', tg); } if (r.el.textContent !== r.txt) r.el.textContent = r.txt;
      }
    }
    function frame(now) {
      raf = null;
      /* Ambient flows run at 30 fps; the full rate is spent only while the pointer orbits. */
      if (!interacting && now - lastDraw < 30) { raf = requestAnimationFrame(frame); return; }
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; var t0 = now;
      if (!paused && !REDUCE) for (var i = 0; i < flows.length; i++) if (flows[i].speed) step(flows[i], dt);
      if (anim.roof !== anim.target) { anim.roof += (anim.target - anim.roof) * (REDUCE ? 1 : 0.18); if (Math.abs(anim.target - anim.roof) < 0.01) anim.roof = anim.target; }
      for (var k in buildings) if (buildings.hasOwnProperty(k)) { var b = buildings[k]; if (b.userData.roof) { var lift = (k === focused ? anim.roof : 0); b.userData.roof.position.y = SITE[k].h + 0.25 + lift * 9; b.userData.roof.material.opacity = Math.min(b.userData.roof.material.opacity, 1 - lift * 0.85); b.userData.roof.material.transparent = true; } }
      ctl.update(); renderer.render(scene, cam); placeLabels();
      lastDraw = now; frames++; fpsAcc += dt; busy += (root.performance ? root.performance.now() : now) - t0;
      if (fpsAcc >= 1) { fps = frames / fpsAcc; lastFps = fps; adapt(Math.max(busy / frames, 1000 / fps)); frames = 0; fpsAcc = 0; busy = 0; }
      if (inView && (!(paused || REDUCE) || anim.roof !== anim.target)) raf = requestAnimationFrame(frame);
    }
    function draw() { if (!raf) raf = requestAnimationFrame(frame); }
    ctl.addEventListener('change', draw); ctl.addEventListener('start', function () { interacting = true; }); ctl.addEventListener('end', function () { interacting = false; });
    if ('ResizeObserver' in root) new ResizeObserver(function () { resize(); draw(); }).observe(stage); else root.addEventListener('resize', function () { resize(); draw(); });
    if ('IntersectionObserver' in root) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) draw(); else if (raf) { cancelAnimationFrame(raf); raf = null; } }, { threshold: 0.05 }).observe(stage);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } } else if (inView) draw(); });
    resize(); preset('campus'); applyStatus();
    host.setAttribute('data-cx-3d', 'ready');
    var api = {
      setStatus: function (st) { status = indexStatus(st); applyStatus(); },
      setPaused: setPaused, focus: focus, preset: preset,
      stats: function () { return { fps: lastFps, quality: quality, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, equipment: equipment.length, shaped: shaped, flows: flows.length, focused: focused, paused: paused }; },
      select: function (systemId) { for (var k in SITE) if (SITE[k].systems.indexOf(systemId) !== -1) { focus(k); return k; } return null; }
    };
    host.__rzCampus = api; return api;
  }

  /* Load three.js on approach, then mount. */
  function boot(host, opts) {
    if (!host) return;
    function go() {
      if (root.RZ3) return mount(host, opts);
      var me = document.querySelector('script[src*="rz-cx-campus.js"]'), base = me ? me.src.replace(/rz-cx-campus\.js.*$/, '') : 'js/';
      var sc = document.createElement('script'); sc.src = base + 'vendor/three-r170.min.js?v=' + encodeURIComponent(root.RZ_VERSION || ''); sc.onload = function () { mount(host, opts); };
      sc.onerror = function () { var s = host.querySelector('.cx-3d-stage'); if (s) s.innerHTML = '<p class="cx-3d-nogl">The 3D view could not load; the schematic above stands on its own.</p>'; host.setAttribute('data-cx-3d', 'failed'); };
      document.head.appendChild(sc);
    }
    /* Never compete with the page's own load: observe only after load, in an idle slot. */
    function arm() {
      var idle = root.requestIdleCallback || function (f) { return setTimeout(f, 300); };
      idle(function () {
        if ('IntersectionObserver' in root) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '600px 0px' }); io.observe(host); } else go();
      }, { timeout: 2000 });
    }
    if (document.readyState === 'complete') arm(); else root.addEventListener('load', arm, { once: true });
  }
  root.RZCxCampus = { SITE: SITE, TAG_HEX: TAG_HEX, mount: mount, boot: boot, worstTag: worstTag, version: '3.26.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RZCxCampus;
})(typeof window !== 'undefined' ? window : this);
