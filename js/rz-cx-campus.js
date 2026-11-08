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
  var TAG_HEX = { red: 0xef4444, yellow: 0xd49a2a, green: 0x22c55e, blue: 0x3b82f6, white: 0xe4e4e7, none: 0xd9e0e8 };   /* none = PRD v1.0 §38 "neutral plant objects": light grey, never a dark mass (K16) */
  var MED = { hv: 0xef4444, mv: 0xd49a2a, lv: 0x22c55e, supply: 0x22d3ee, ret: 0xd49a2a, chw: 0x22d3ee };
  /* Instrument palette (PRD v1.0 §24 "light engineering workspace", owner K16 2026-11-08 "jangan gelap"): the 3D canvas
   * is the light ground in BOTH page themes — schematic/3D ground #EEF2F6 on canvas #F4F6F8, lines #D9E0E8, text
   * #17212F, secondary #526174. Equipment is neutral mid-grey (none) until its system carries a tag. */
  var PAL = { canvas: 0xf4f6f8, ground: 0xeef2f6, plateSide: 0xc9d1da, outline: 0x7d8a99, grid: 0xd9e0e8, wall: 0xffffff, roof: 0xf4f6f8, edge: 0x526174,
    floor: 0xffffff, yard: 0xe6ebf0, fence: 0x8a97a6, road: 0xd4dbe3, detail: 0xb8c2cd, none: 0xd9e0e8 };
  /* What the drawn hall and yards can hold (metres above): the layout caps the engine's counts here and SAYS so. */
  var CAP = { rows: 10, perRow: 56, crahPerWall: 12, ups: 16, unit_subs: 6, lv_busway: 6, bms: 3, fire: 2, chillers: 12, fws: 8, dry_coolers: 14, generators: 8, hv_intake: 6, main_tx: 4, mv_board: 1 };
  /* layout(basis) — DOM-free and pure (tools/test-cx-campus-basis.mjs): the equipment the site basis implies.
   * basis = { itKw, rackKw, coolingType, es } where es = RZEngine.models.commissioning.equipScale(input) (counts per
   * engine rule: racks = kW ÷ rack kW, cooling units kW ÷ 200, UPS modules kW ÷ 500, chillers kW ÷ 500, pumps kW ÷ 300,
   * generators kW ÷ 2000, unit transformers kW ÷ 2500, LV boards kW ÷ 2000 + 1). Dry coolers (1 MW each, N+1) and the
   * 150/20 kV transformers (2N, 100 MVA class) have no engine rule and are declared here. Every family carries the
   * count the basis implies (all), the count drawn (count ≤ capacity) and a one-line basis for its callout. */
  function layout(basis) {
    basis = basis || {};
    var kw = +basis.itKw, rackKw = +basis.rackKw, es = basis.es || {}, cool = String(basis.coolingType || 'air');
    if (!isFinite(kw) || kw <= 0) kw = 2000; if (!isFinite(rackKw) || rackKw <= 0) rackKw = 6;
    var liquid = cool === 'dlc' || cool === 'immersion', share = cool === 'immersion' ? 0.95 : (liquid ? 0.85 : 0);
    function n(v, d) { v = +v; return isFinite(v) && v > 0 ? Math.ceil(v) : d; }
    function per(all) { return all > 0 ? Math.round(kw / all) : 0; }
    var racksAll = n(es.racks, Math.ceil(kw / rackKw)), hallCap = CAP.rows * CAP.perRow, halls = Math.max(1, Math.ceil(racksAll / hallCap)), racks = Math.min(racksAll, hallCap);
    var rows = Math.max(1, Math.min(CAP.rows, Math.ceil(racks / 20))), perRow = Math.ceil(racks / rows);
    var crahAll = n(es.cooling_units, Math.ceil(kw / 200)), crah = Math.min(crahAll, CAP.crahPerWall * 2);
    var cdu = liquid ? rows * 2 : 0;
    var upsAll = n(es.ups_modules, Math.ceil(kw / 500)), txAll = n(es.transformers, Math.ceil(kw / 2500)), lvAll = n(es.lvsb, Math.ceil(kw / 2000) + 1);
    var chAll = n(es.chillers, Math.ceil(kw / 500)), pAll = n(es.pumps, Math.ceil(kw / 300)), genAll = n(es.generators, Math.ceil(kw / 2000));
    var dcAll = Math.ceil(kw * 1.1 / 1000) + 1, mtxAll = Math.max(2, Math.ceil(kw / 100000) + 1), mtx = Math.min(mtxAll, CAP.main_tx);
    var fwsLps = liquid ? kw * share / (4.18 * 10) : 0, chwLps = kw * (1 - share) / (4.18 * 6);
    function fam(count, all, text) { return { count: Math.max(0, Math.round(count)), all: all, basis: text + (all > count ? ' · ' + count + ' of ' + all + ' drawn' : '') }; }
    return {
      kw: kw, rackKw: rackKw, coolingType: cool, liquid: liquid, liquidShare: share, halls: halls, rows: rows, perRow: perRow, crahPerWall: Math.ceil(crah / 2), fwsLps: fwsLps, chwLps: chwLps,
      families: {
        racks: fam(racks, racksAll, rackKw + ' kW per rack' + (halls > 1 ? ' · hall 1 of ' + halls : '')),
        cdu: fam(cdu, cdu, liquid ? '2 per row · ' + cool.toUpperCase() + ' ' + Math.round(share * 100) + ' % liquid' : 'none · air-cooled'),
        crah: fam(crah, crahAll, '≈ ' + per(crahAll) + ' kW each'),
        ups: fam(Math.min(upsAll, CAP.ups), upsAll, '≈ ' + per(upsAll) + ' kW modules'),
        unit_subs: fam(Math.min(txAll, CAP.unit_subs), txAll, '≈ ' + per(txAll) + ' kW each'),
        lv_busway: fam(Math.min(lvAll, CAP.lv_busway), lvAll, 'sections + 1 spare'),
        bms: fam(CAP.bms, CAP.bms, 'BMS · EPMS · OT'),
        fire: fam(CAP.fire, CAP.fire, 'panel + agent bank'),
        chillers: fam(Math.min(chAll, CAP.chillers), chAll, '≈ ' + per(chAll) + ' kW each'),
        fws: fam(Math.min(pAll, CAP.fws), pAll, '≈ ' + per(pAll) + ' kW duty each'),
        dry_coolers: fam(Math.min(dcAll, CAP.dry_coolers), dcAll, '1 MW each, N+1'),
        generators: fam(Math.min(genAll, CAP.generators), genAll, '≈ ' + per(genAll) + ' kW each'),
        hv_intake: fam(Math.min(mtx + 2, CAP.hv_intake), mtx + 2, mtx + ' tx bays + 2 line bays'),
        main_tx: fam(mtx, mtxAll, '150/20 kV · 2N'),
        mv_board: fam(1, 1, '20 kV GIS')
      }
    };
  }
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
    var phone = root.innerWidth < 800, dpr0 = root.devicePixelRatio || 1, basePR = Math.min(dpr0, phone ? 1 : (dpr0 >= 1.5 ? 1.25 : 1))   /* oversample only on HiDPI; a 1× desktop pays 56 % more pixels for nothing visible */, quality = 1; renderer.setPixelRatio(basePR);
    var scene = new T.Scene();
    var cam = new T.OrthographicCamera(-1, 1, 1, -1, -500, 1000); cam.zoom = 1;
    var ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.dampingFactor = 0.1; ctl.enablePan = true; ctl.autoRotate = false; ctl.minZoom = 0.5; ctl.maxZoom = 8;
    ctl.maxPolarAngle = Math.PI * 0.47; ctl.minPolarAngle = 0.2;
    /* High-key 3-tone isometric light (the K15 reference frame): an even hemisphere plus one key from the front-left so a
     * white wall renders ≈ top 1.0 · left 0.84 · front 0.75 · right 0.64 of its albedo, and a fill from the right so the
     * shaded face never goes black. Standard material, roughness 0.9: no specular highlights on a drawing. */
    scene.add(new T.HemisphereLight(0xffffff, 0xe6ebf0, 1.25));                        /* K16: bright sky term so no face reads dark; two lights, not three (software GL is fragment-bound) */
    var sun = new T.DirectionalLight(0xffffff, 0.45); sun.position.set(-90, 130, 70); scene.add(sun);
    var pal = PAL;
    renderer.setClearColor(PAL.canvas, 1);                                                                /* the canvas is the light workspace in both page themes (K16) */
    /* the site is a plate: a slab with a darker edge, the way an isometric figure sits on its base */
    var plateTop = new T.MeshBasicMaterial({ color: pal.ground }), plateSide = new T.MeshBasicMaterial({ color: pal.plateSide });   /* unlit: the slab is the biggest surface on screen and software GL pays per pixel for lights */
    var ground = new T.Mesh(new T.BoxGeometry(300, 6, 230), [plateSide, plateSide, plateTop, plateSide, plateSide, plateSide]); ground.position.set(-5, -3.05, 6); scene.add(ground);
    var outlineMat = new T.MeshBasicMaterial({ color: pal.outline, side: T.BackSide });                   /* inverted hull = the drawn outline of every machine */
    var grid = new T.GridHelper(200, 20, pal.grid, pal.grid); grid.position.set(-5, 0, 6); grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);

    /* ---- materials ---- */
    var mat = {
      wall: new T.MeshStandardMaterial({ color: pal.wall, roughness: 0.9, metalness: 0, transparent: true, opacity: 1 }),
      roof: new T.MeshStandardMaterial({ color: pal.roof, roughness: 0.9, metalness: 0, transparent: true, opacity: 1 }),
      floor: new T.MeshStandardMaterial({ color: pal.floor, roughness: 0.9, metalness: 0 }),
      yard: new T.MeshStandardMaterial({ color: pal.yard, roughness: 0.9, metalness: 0 }),
      fence: new T.LineBasicMaterial({ color: pal.fence }),
      road: new T.MeshStandardMaterial({ color: pal.road, roughness: 0.9, metalness: 0 }),
      detail: new T.MeshStandardMaterial({ color: pal.detail, roughness: 0.9, metalness: 0, transparent: true, opacity: 1 })   /* louvres, doors, parapets, roof plant */
    };
    var buildings = {}, equipment = [], flows = [], focused = null, paused = false, status = indexStatus(opts.status && opts.status());
    var L = layout(typeof opts.basis === 'function' ? opts.basis() : opts.basis);

    function box(w, h, d, m) { var g = new T.Mesh(new T.BoxGeometry(w, h, d), m); return g; }
    function edges(w, h, d, color) { var e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, h, d)), new T.LineBasicMaterial({ color: color || pal.edge })); return e; }
    /* one InstancedMesh per equipment family (one draw call), coloured per instance by its system tag. The shape
     * comes from RZCxAssets — merged, vertex-shaded primitives at the family footprint, y from the floor — and
     * falls back to a plain box when that module is absent, so the campus never fails for a missing asset. */
    var assets = root.RZCxAssets, shaped = 0;
    /* A family is allocated at its CAPACITY (the most the drawn room holds) and draws L.families[id].count of it, so a
     * changed IT load, rack density or cooling type re-lays the plant without rebuilding a mesh (setBasis). place(i, L)
     * returns [x, ry, z, y] for unit i under the current layout. */
    function family(systemId, cap, w, h, d, place, meta) {
      var geo = assets && assets.build(T, systemId, w, h, d), isShape = !!(geo && geo.attributes.color);
      if (isShape) shaped++; else geo = new T.BoxGeometry(w, h, d).translate(0, h / 2, 0);
      var im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: true, vertexColors: isShape }), cap); im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      var hull = new T.InstancedMesh(geo, outlineMat, cap);                                              /* same geometry, back faces, 4 % larger: a dark line around each unit */
      hull.visible = false; im.add(hull);                                                              /* outlines are sub-pixel at campus scale; focus() shows them for the focused building only */
      im.userData = { system: systemId, label: meta && meta.label, building: meta && meta.building, shaped: isShape ? 'primitives' : 'box', hull: hull, place: place, cap: cap, geoLo: geo, geoHi: null, size: [w, h, d] };
      equipment.push(im); layoutFamily(im); return im;
    }
    var _o = new T.Object3D();
    function layoutFamily(im) {
      var f = L.families[im.userData.system], count = Math.min(im.userData.cap, f ? f.count : im.userData.cap), hull = im.userData.hull;
      for (var i = 0; i < count; i++) {
        var p = im.userData.place(i, L); _o.position.set(p[0], p[3] || 0, p[2]); _o.rotation.y = p[1] || 0; _o.scale.set(1, 1, 1); _o.updateMatrix(); im.setMatrixAt(i, _o.matrix); im.setColorAt(i, new T.Color(TAG_HEX.none));
        _o.scale.set(1.04, 1.04, 1.04); _o.updateMatrix(); hull.setMatrixAt(i, _o.matrix);
      }
      im.count = count; hull.count = count; im.userData.drawn = count; im.userData.all = f ? f.all : count; im.userData.basis = f ? f.basis : '';
      im.visible = count > 0; im.instanceMatrix.needsUpdate = true; hull.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
    function tint(im) { var r = status.byId[im.userData.system], c = new T.Color(TAG_HEX[(r && r.tag) || 'none']); for (var i = 0; i < im.count; i++) im.setColorAt(i, c); if (im.instanceColor) im.instanceColor.needsUpdate = true; }

    function building(spec) {
      var g = new T.Group(); g.position.set(spec.x, 0, spec.z); g.userData = { building: spec.id, name: spec.name };
      var inner = new T.Group(); inner.visible = false; g.add(inner); g.userData.inner = inner;
      if (spec.h) {
        var walls = box(spec.w, spec.h, spec.d, mat.wall.clone()); walls.position.y = spec.h / 2; walls.userData.part = 'walls'; walls.userData.building = spec.id; g.add(walls);
        var roof = box(spec.w + 0.6, 0.5, spec.d + 0.6, mat.roof.clone()); roof.position.y = spec.h + 0.25; roof.userData.part = 'roof'; g.add(roof); g.userData.roof = roof; g.userData.walls = walls;
        /* architecture, so a building is not a lidded box: parapet and roof plant ride on the roof (they lift with it), louvre bands and a door sit on the walls */
        var det = mat.detail.clone(); g.userData.detail = det;
        var W = spec.w + 0.6, D = spec.d + 0.6, par = [[W, 0.35, 0, -D / 2 + 0.175], [W, 0.35, 0, D / 2 - 0.175], [0.35, D, -W / 2 + 0.175, 0], [0.35, D, W / 2 - 0.175, 0]];
        for (var pi = 0; pi < 4; pi++) { var pr = box(par[pi][0], 0.7, par[pi][1], det); pr.position.set(par[pi][2], 0.6, par[pi][3]); pr.userData.part = 'roof'; roof.add(pr); }
        var units = Math.max(2, Math.min(6, Math.round(spec.w / 11)));
        for (var u = 0; u < units; u++) {
          var ux = -spec.w / 2 + spec.w * (u + 0.5) / units, ru = box(2.6, 1.5, 2.0, roof.material); ru.position.set(ux, 1.0, -spec.d * 0.22); ru.userData.part = 'roof'; roof.add(ru);
          var rf = box(2.8, 0.25, 2.2, det); rf.position.set(ux, 1.85, -spec.d * 0.22); rf.userData.part = 'roof'; roof.add(rf);
        }
        for (var s = -1; s <= 1; s += 2) for (var L = 0; L < 2; L++) { var lv = box(spec.w * 0.72, 0.5, 0.1, det); lv.position.set(0, spec.h * (0.38 + L * 0.3), s * (spec.d / 2 + 0.05)); lv.userData.building = spec.id; g.add(lv); }
        var door = box(2.6, 2.9, 0.12, det); door.position.set(-spec.w * 0.36, 1.45, spec.d / 2 + 0.06); door.userData.building = spec.id; g.add(door);
        var e = edges(spec.w, spec.h, spec.d); e.position.y = spec.h / 2; g.add(e); g.userData.edge = e;
        var floor = box(spec.w, 0.2, spec.d, mat.floor); floor.position.y = 0.1; floor.userData.building = spec.id; g.add(floor);
      } else {
        var yard = box(spec.w, 0.3, spec.d, mat.yard); yard.position.y = 0.15; yard.userData.building = spec.id; yard.userData.part = 'yard'; g.add(yard);
        var f = edges(spec.w, 2.2, spec.d); f.position.y = 1.1; g.add(f); g.userData.edge = f;
      }
      scene.add(g); buildings[spec.id] = g; return g;
    }
    /* ---- the hall: rack rows (pitch 3.1 m, racks 0.9 m), CDUs at the row ends, CRAH along the long walls, electrical room east ---- */
    var hall = building(SITE.hall), hi = hall.userData.inner, pitch = 3.1;
    function rowX0(l) { return -(l.perRow - 1) * 0.9 / 2; }
    function rowZ(l, r) { return -(l.rows - 1) * pitch / 2 + r * pitch; }
    hi.add(family('racks', CAP.rows * CAP.perRow, 0.6, 2.2, 1.2, function (i, l) { var r = Math.floor(i / l.perRow), c = i % l.perRow; return [rowX0(l) + c * 0.9, 0, rowZ(l, r)]; }, { building: 'hall', label: 'rack rows' }));
    hi.add(family('cdu', CAP.rows * 2, 1.2, 2.0, 1.0, function (i, l) { var r = Math.floor(i / 2), s = i % 2; return [s ? rowX0(l) + (l.perRow - 1) * 0.9 + 1.7 : rowX0(l) - 1.7, 0, rowZ(l, r)]; }, { building: 'hall', label: 'CDUs, end of row' }));
    hi.add(family('crah', CAP.crahPerWall * 2, 2.4, 2.6, 1.0, function (i, l) { var n = Math.max(1, l.crahPerWall), side = i < n ? -1 : 1, k = i % n, sp = Math.min(7.2, 52 / n); return [-26 + sp / 2 + k * sp, 0, side * 14.6]; }, { building: 'hall', label: 'CRAH / fan walls' }));
    hi.add(family('ups', CAP.ups, 1.0, 2.2, 0.9, function (i) { return [21.5 + (i % 8) * 1.1, 0, -13 + Math.floor(i / 8) * 2.4]; }, { building: 'hall', label: 'UPS' }));
    hi.add(family('unit_subs', CAP.unit_subs, 2.2, 2.4, 1.6, function (i) { return [22 + (i % 3) * 2.8, 0, -6.5 + Math.floor(i / 3) * 2.4]; }, { building: 'hall', label: 'unit substations' }));
    hi.add(family('lv_busway', CAP.lv_busway, 1.6, 2.2, 0.8, function (i) { return [22 + (i % 3) * 2.8, 0, 0.5 + Math.floor(i / 3) * 1.6]; }, { building: 'hall', label: 'LV switchboards' }));
    hi.add(family('bms', CAP.bms, 0.8, 2.0, 0.8, function (i) { return [24 + i * 1.2, 0, 8]; }, { building: 'hall', label: 'BMS / EPMS / OT racks' }));
    hi.add(family('fire', CAP.fire, 1.6, 1.6, 0.8, function (i) { return [24 + i * 2.2, 0, 12]; }, { building: 'hall', label: 'fire panel + agent' }));
    /* plant: chillers, FWS pumps */
    var plant = building(SITE.plant), pi = plant.userData.inner;
    pi.add(family('chillers', CAP.chillers, 5, 2.6, 2.4, function (i) { return [-14 + (i % 6) * 5.6, 0, -6 + Math.floor(i / 6) * 5]; }, { building: 'plant', label: 'chillers' }));
    pi.add(family('fws', CAP.fws, 1.4, 1.4, 2.4, function (i) { return [-14 + (i % 8) * 3.6, 0, 7]; }, { building: 'plant', label: 'FWS pumps' }));
    /* yards (no roof): equipment always visible */
    var dry = building(SITE.dry); dry.userData.inner.visible = true;
    dry.userData.inner.add(family('dry_coolers', CAP.dry_coolers, 4, 2.4, 2.4, function (i) { return [-32 + (i % 14) * 4.8, 0, -3]; }, { building: 'dry', label: 'dry coolers' }));
    var gens = building(SITE.gens); gens.userData.inner.visible = true;
    gens.userData.inner.add(family('generators', CAP.generators, 3, 3.2, 12, function (i) { return [-10 + (i % 4) * 6, 0, -8 + Math.floor(i / 4) * 16]; }, { building: 'gens', label: 'generators' }));
    var sub = building(SITE.sub); sub.userData.inner.visible = true;
    sub.userData.inner.add(family('hv_intake', CAP.hv_intake, 2, 7, 2, function (i) { return [-22 + i * 5, 0, 9]; }, { building: 'sub', label: '150 kV bays' }));
    sub.userData.inner.add(family('main_tx', CAP.main_tx, 6, 4.5, 4, function (i) { return [-18 + i * 9, 0, 2]; }, { building: 'sub', label: '150/20 kV transformers' }));
    sub.userData.inner.add(family('mv_board', CAP.mv_board, 20, 5, 8, function () { return [10, 0, -8]; }, { building: 'sub', label: '20 kV GIS hall' }));
    /* roads */
    [[0, 22, 200, 4], [-40, 0, 4, 60], [40, 0, 4, 60]].forEach(function (r) { var m = box(r[2], 0.12, r[3], mat.road); m.position.set(r[0], 0.06, r[1]); scene.add(m); });

    /* ---- flows: polylines with particle streams. Speed ∝ design flow; labelled "design simulation" ---- */
    /* Speeds scale with the basis: electrical with √(kW), the liquid loops with the FWS share, the air path with the CHW share.
     * A loop the basis does not have (FWS/TCS on an air-cooled hall) stays a faint line with no stream. */
    function speeds(l) {
      var s = Math.min(2.5, Math.max(0.6, Math.sqrt(l.kw / 10000))), liq = l.liquid ? s : 0, air = l.liquidShare < 1 ? s * Math.max(0.4, 1 - l.liquidShare) : 0;
      return { hv: 0.10, mv: 0.12, lv: 0.16, fws_s: 0.07 * liq, fws_r: 0.07 * liq, dry_s: 0.06 * s, dry_r: 0.06 * s, tcs: 0.09 * liq, chw: 0.05 * air, gen: 0 };
    }
    function flow(id, color, pts, n, lineOpts) {
      var v = pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); });
      var curve = new T.CatmullRomCurve3(v, false, 'catmullrom', 0.0);
      var line = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(40)), new T.LineBasicMaterial({ color: color, transparent: true, opacity: lineOpts && lineOpts.faint ? 0.35 : 0.8 })); scene.add(line);
      var pos = new Float32Array(n * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      var pm = new T.PointsMaterial({ color: color, size: phone ? 1.4 : 2.2, sizeAttenuation: false }); var pts3 = new T.Points(geo, pm); scene.add(pts3);
      var f = { id: id, curve: curve, n: n, pos: pos, geo: geo, speed: 0, t: 0, points: pts3, line: line, faint: !!(lineOpts && lineOpts.faint) }; flows.push(f); return f;
    }
    function step(f, dt) { f.t = (((f.t + dt * f.speed) % 1) + 1) % 1; for (var i = 0; i < f.n; i++) { var p = f.curve.getPointAt((f.t + i / f.n) % 1); f.pos[i * 3] = p.x; f.pos[i * 3 + 1] = p.y; f.pos[i * 3 + 2] = p.z; } f.geo.attributes.position.needsUpdate = true; }
    flow('hv', MED.hv, [[-30, 7, 70], [-30, 7, 50], [-28, 7, 50]], 10);
    flow('mv', MED.mv, [[-8, 5, 36], [-8, 5, 24], [24, 3, 24], [24, 3, 16]], 14);
    flow('lv', MED.lv, [[24, 2.5, 12], [24, 2.5, -6], [-20, 2.5, -6], [-20, 2.5, 12]], 20);
    flow('fws_s', MED.supply, [[-46, 1.2, -4], [-32, 1.2, -4], [-32, 1.2, 12]], 16);
    flow('fws_r', MED.ret, [[-32, 2.2, 12], [-32, 2.2, -8], [-46, 2.2, -8]], 16);
    flow('dry_s', MED.supply, [[-50, 1.2, -12], [-50, 1.2, -32], [10, 1.2, -32]], 16);
    flow('dry_r', MED.ret, [[10, 2.2, -34], [-52, 2.2, -34], [-52, 2.2, -12]], 16);
    flow('tcs', MED.supply, [[-26, 1, -13], [26, 1, -13], [26, 1, 14], [-26, 1, 14]], 24);
    flow('chw', MED.chw, [[-44, 1.2, 6], [-34, 1.2, 6], [-34, 1.2, 15.5], [26, 1.2, 15.5]], 12, { faint: true });
    flow('gen', MED.mv, [[44, 3, 0], [34, 3, 0], [34, 3, 10]], 1, { faint: true });   // ATS normally open: a line, no stream
    function applyBasis() {
      var sp = speeds(L);
      for (var i = 0; i < flows.length; i++) { var f = flows[i]; f.speed = sp[f.id] || 0; f.points.visible = f.speed > 0; f.line.material.opacity = f.speed > 0 && !f.faint ? 0.8 : 0.35; step(f, 0); }
      for (var q = 0; q < equipment.length; q++) layoutFamily(equipment[q]);
      if (note) note.textContent = 'Design simulation · particle speed ∝ design flow · ' + Math.round(L.kw).toLocaleString('en-US') + ' kW IT at ' + L.rackKw + ' kW per rack' +
        (L.liquid ? ' · ' + Math.round(L.liquidShare * 100) + ' % liquid (' + L.coolingType.toUpperCase() + '): FWS ≈ ' + Math.round(L.fwsLps) + ' L/s at ΔT 10 K' : ' · air-cooled: FWS 0 L/s at ΔT 10 K') +
        ' · CHW ≈ ' + Math.round(L.chwLps) + ' L/s at ΔT 6 K' + (L.halls > 1 ? ' · hall 1 of ' + L.halls + ' drawn' : '') +
        ' · 150 kV red · 20 kV amber · 400 V green · supply cyan · return amber · Representative, conceptual site basis';
    }
    applyBasis();

    /* ---- status tint ---- */
    function applyStatus() {
      for (var i = 0; i < equipment.length; i++) tint(equipment[i]);
      for (var k in buildings) if (buildings.hasOwnProperty(k)) { var b = buildings[k], w = worstTag(status, SITE[k].systems); b.userData.edge.material.color.set(TAG_HEX[w]); b.userData.tag = w; b.userData.level = worstLevel(status, SITE[k].systems); }
      placeLabels(); draw();
    }
    /* ---- focus: roof off, neighbours dim, interior on ---- */
    var anim = { roof: 0, target: 0, explode: 0, exTarget: 0, cam: null, camMs: 0 };
    /* K27: neighbours fade over FADE_MS instead of blinking (Video B: the building is pulled forward, the rest recede) */
    var FADE_MS = 360, fades = [];
    function fadeTo(m, to) {
      m.transparent = true; if (REDUCE) { m.opacity = to; return; }
      for (var i = 0; i < fades.length; i++) if (fades[i].m === m) { fades.splice(i, 1); break; }
      if (Math.abs(m.opacity - to) > 0.001) fades.push({ m: m, from: m.opacity, to: to, t0: null });
    }
    function stepFades(now) {
      for (var i = fades.length - 1; i >= 0; i--) { var f = fades[i]; if (f.t0 === null) f.t0 = now; var x = Math.max(0, Math.min(1, (now - f.t0) / FADE_MS)); f.m.opacity = f.from + (f.to - f.from) * ease(x); if (x >= 1) fades.splice(i, 1); }
    }
    /* K27: one picked equipment family in the focused building is lit; the rest of that building recede */
    var picked = null, PICK_HEX = 0x2563eb;
    function pick(sys) {
      picked = sys || null;
      for (var i = 0; i < equipment.length; i++) {
        var im = equipment[i], mine = !!focused && im.userData.building === focused, on = mine && im.userData.system === picked;
        im.material.emissive.setHex(on ? PICK_HEX : 0x000000); im.material.emissiveIntensity = on ? 0.9 : 1;
        fadeTo(im.material, mine && picked && !on ? 0.3 : 1);
      }
      paintCrumb(); host.setAttribute('data-cx-pick', picked || ''); draw();
    }
    function famLabel(sys) { for (var i = 0; i < equipment.length; i++) if (equipment[i].userData.system === sys) return equipment[i].userData.label || sys; return sys; }
    function paintCrumb() {
      if (crumb) crumb.innerHTML = '<button type="button" data-crumb="">Campus</button>' + (focused ? ' › ' + (picked ? '<button type="button" data-crumb="' + focused + '">' + SITE[focused].name + '</button> › <b>' + famLabel(picked) + '</b>' : '<b>' + SITE[focused].name + '</b>') : '');
    }
    function focus(id) {
      focused = id || null; if (picked) pick(null);
      for (var k in buildings) if (buildings.hasOwnProperty(k)) {
        var b = buildings[k], on = !focused || k === focused, dim = focused && k !== focused;
        if (b.userData.walls) { fadeTo(b.userData.walls.material, dim ? 0.18 : (k === focused ? 0.22 : 1)); }
        if (b.userData.roof) { fadeTo(b.userData.roof.material, dim ? 0.12 : 1); }
        if (b.userData.detail) { fadeTo(b.userData.detail, dim ? 0.15 : (k === focused ? 0.22 : 1)); }
        b.userData.inner.visible = SITE[k].h === 0 || k === focused;
        b.userData.edge.material.opacity = dim ? 0.3 : 1; b.userData.edge.material.transparent = true;
        if (b.userData.inner.visible && SITE[k].h) b.userData.inner.children.forEach(function (c) { c.visible = true; });
      }
      for (var q = 0; q < equipment.length; q++) {
        var eq = equipment[q], hq = eq.userData.hull, near = !!focused && eq.userData.building === focused;
        if (hq) hq.visible = near && eq.count < 100;                                            /* K16: no outline hull on a dense family (racks) — 334 outlines at 0.9 m pitch read as one grey mass */
        /* LOD: the focused building draws the high-detail twin of each family (K17); everything else the low one */
        var want = near && eq.userData.geoHi ? eq.userData.geoHi : eq.userData.geoLo;
        if (eq.geometry !== want) { eq.geometry = want; if (hq) hq.geometry = want; eq.userData.lod = near && eq.userData.geoHi ? 'hi' : 'lo'; eq.computeBoundingSphere(); }
      }
      anim.target = focused && buildings[focused].userData.roof ? 1 : 0;
      paintCrumb();
      host.setAttribute('data-cx-focus', focused || '');
      if (fitSelBtn) fitSelBtn.disabled = !focused;
      if (!focused && exploded) setExplode(false);
      fit(focused ? 'sel' : 'site', presetPos);
    }
    /* ---- K22: Fit site / Fit selection keep the selection and only move the camera ---- */
    /* K27: ONE eased camera move (CAM_MS, ease-out, PRD §26 350-500 ms) carries target, zoom and orbit position together;
     * reduced motion: the camera cuts. */
    var CAM_MS = 450, booted = false;
    function fit(k, pos) {
      var sp = k === 'sel' && focused ? SITE[focused] : null, to = sp ? { x: sp.x, y: 2, z: sp.z, zoom: Math.max(2.0, Math.min(4, 2.5 * 62 / Math.max(sp.w, sp.d))) }   /* K27: the building fills the middle of the stage, the callout columns get the margins instead of covering the equipment they name */ : { x: BOUNDS.cx, y: 0, z: BOUNDS.cz, zoom: 1.3 };
      var off = pos ? new T.Vector3(pos[0], pos[1], pos[2]) : cam.position.clone().sub(ctl.target);
      if (REDUCE || !booted || !inView || document.hidden) {   /* nobody is watching: cut, an ease off-screen would stall with the paused loop */ ctl.target.set(to.x, to.y, to.z); cam.position.copy(ctl.target).add(off); cam.zoom = to.zoom; anim.cam = null; cam.updateProjectionMatrix(); ctl.update(); placeLabels(); draw(); return; }
      var mv = anim.cam = { t0: null, fromT: ctl.target.clone(), toT: new T.Vector3(to.x, to.y, to.z), fromOff: cam.position.clone().sub(ctl.target), toOff: off, fromZ: cam.zoom, toZ: to.zoom };
      /* rAF can be throttled or stopped (background tab, off-screen, a busy main thread): the camera must still land */
      root.setTimeout(function () { if (anim.cam === mv) { ctl.target.copy(mv.toT); cam.position.copy(mv.toT).add(mv.toOff); cam.zoom = mv.toZ; cam.updateProjectionMatrix(); anim.camMs = CAM_MS * 2; anim.cam = null; ctl.update(); placeLabels(); draw(); } }, CAM_MS * 2);
      draw();
    }
    function stepCam(now) {
      var c = anim.cam; if (!c) return; if (c.t0 === null) c.t0 = now;   /* the clock starts on the first drawn frame: a heavy first frame (LOD swap) must not eat the ease */
      var x = Math.max(0, Math.min(1, (now - c.t0) / CAM_MS)), e = ease(x);
      ctl.target.lerpVectors(c.fromT, c.toT, e); _off.lerpVectors(c.fromOff, c.toOff, e); cam.position.copy(ctl.target).add(_off); cam.zoom = c.fromZ + (c.toZ - c.fromZ) * e; cam.updateProjectionMatrix();
      if (x >= 1) { anim.camMs = now - c.t0; anim.cam = null; }
    }
    var _off = new T.Vector3();
    /* ---- K22: explode = the focused building's families each lifted onto its own layer (4 m apart), roof clear above;
     * callouts read matrixWorld, so they stay on their unit. Reduced motion: instant. ---- */
    var exploded = false, EX_STEP = 4, EX_MS = 520, EX_STAGGER = 0.22, presetPos = null;
    function setExplode(on) {
      exploded = !!on; if (exploded && !focused) focus('hall');
      anim.exTarget = exploded ? 1 : 0; anim.exLast = null;   /* the clock starts on the next drawn frame (rAF time), never on performance.now() */ if (REDUCE) anim.explode = anim.exTarget;
      var exT = anim.exTarget; root.setTimeout(function () { if (anim.exTarget === exT && anim.explode !== exT) { anim.explode = exT; draw(); } }, EX_MS * 2);   /* lands even when rAF is throttled */
      if (exBtn) exBtn.setAttribute('aria-pressed', String(exploded));
      host.setAttribute('data-cx-explode', exploded ? '1' : '0'); draw();
    }
    function layerOf() { var out = [], n = 0; for (var i = 0; i < equipment.length; i++) { var im = equipment[i]; if (im.userData.building === focused && im.visible) out.push({ im: im, n: ++n }); } return out; }
    function ease(x) { return 1 - Math.pow(1 - x, 3); }
    function applyExplode() {
      var lay = layerOf(), set = {}, N = lay.length, span = 1 + Math.max(0, N - 1) * EX_STAGGER;
      /* K27: the layers fan out one after another (bottom first), each on its own ease-out — not one rigid lift */
      for (var i = 0; i < N; i++) { var li = Math.max(0, Math.min(1, anim.explode * span - (lay[i].n - 1) * EX_STAGGER)); lay[i].im.position.y = ease(li) * EX_STEP * lay[i].n; set[lay[i].im.uuid] = 1; }
      for (var j = 0; j < equipment.length; j++) if (!set[equipment[j].uuid] && equipment[j].position.y) equipment[j].position.y = 0;
      return lay.length;
    }
    /* ---- camera presets ---- */
    function preset(k) {
      var d = 220, pos = { campus: [d, d, d], plant: [-d, d * 0.8, d * 0.6], hall: [d * 0.8, d, d * 0.8], sub: [d * 0.4, d, d * 1.2] }[k] || [d, d * 0.9, d];
      presetPos = pos; if (k === 'plant') focus('plant'); else if (k === 'hall') focus('hall'); else if (k === 'sub') focus('sub'); else focus(null); presetPos = null;
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
        if (o.userData && o.userData.system) { if (focused && o.userData.building === focused) pick(picked === o.userData.system ? null : o.userData.system); if (opts.onSelect) opts.onSelect(o.userData.system); return; }
        var b = o.userData && o.userData.building; if (!b && o.parent && o.parent.userData && o.parent.userData.building) b = o.parent.userData.building;
        if (b) { if (focused === b) { if (o.userData.part === 'roof') return; } focus(b); return; }
        if (o === ground) { focus(null); return; }
      }
    });
    if (crumb) crumb.addEventListener('click', function (e) { var b = e.target.closest('[data-crumb]'); if (b) focus(b.getAttribute('data-crumb') || null); });
    cv.addEventListener('keydown', function (e) { if (e.key === '0') { preset('campus'); e.preventDefault(); } else if (e.key >= '1' && e.key <= '4') { preset(['campus', 'plant', 'hall', 'sub'][+e.key - 1]); e.preventDefault(); } else if (e.key === 'Escape' && picked) { pick(null); e.preventDefault(); } else if (e.key === 'Escape' && focused) { focus(null); e.preventDefault(); } });
    Array.prototype.forEach.call(host.querySelectorAll('[data-cam]'), function (b) { b.addEventListener('click', function () { preset(b.getAttribute('data-cam')); }); });
    var pauseBtn = host.querySelector('[data-pause]'); if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!paused); });
    var exBtn = host.querySelector('[data-explode]'), fitSelBtn = host.querySelector('[data-fit="sel"]');
    if (exBtn) exBtn.addEventListener('click', function () { setExplode(!exploded); });
    Array.prototype.forEach.call(host.querySelectorAll('[data-fit]'), function (b) { b.addEventListener('click', function () { fit(b.getAttribute('data-fit')); }); });
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
    /* ---- callouts: one per equipment family of the focused building, stacked at the stage margin, a dashed leader to the unit ---- */
    var NS = 'http://www.w3.org/2000/svg', coHost = document.createElement('div'); coHost.className = 'cx-3d-callouts'; coHost.setAttribute('aria-hidden', 'true'); stage.appendChild(coHost);
    var coSvg = document.createElementNS(NS, 'svg'); coHost.appendChild(coSvg); var coEls = [], _m = new T.Matrix4(), _p = new T.Vector3();
    var coRects = [];                                                                          /* callout boxes of the last placement, read by placeLabels() */
    function calloutTargets() {
      var out = []; if (!focused) return out;
      for (var i = 0; i < equipment.length; i++) {
        var im = equipment[i]; if (im.userData.building !== focused || !im.visible || !im.parent || !im.parent.visible) continue;
        im.getMatrixAt(0, _m); _p.setFromMatrixPosition(_m); var top = im.geometry.boundingBox ? im.geometry.boundingBox.max.y : 2; _p.y += top; _p.applyMatrix4(im.matrixWorld);
        var r = status.byId[im.userData.system];
        /* K18: the callout carries the count the basis implies, its one-line basis, and the system's state at the viewed month */
        var state = r && r.level ? r.level + (r.inTest && r.next ? ' → ' + r.next + ' in test' : '') : (r && r.inTest && r.next ? r.next + ' in test' : 'not started');
        out.push({ im: im, world: _p.clone(), short: (im.userData.label || im.userData.system) + ' · ' + (im.userData.all || im.count), text: (im.userData.label || im.userData.system) + ' · ' + (im.userData.all || im.count) + (im.userData.basis ? ' · ' + im.userData.basis : '') + ' · ' + state, tag: (r && r.tag) || 'none' });
      }
      return out;
    }
    function placeCallouts() {
      var w = stage.clientWidth, h = stage.clientHeight, list = calloutTargets();
      while (coEls.length < list.length) { var el = document.createElement('span'); el.className = 'cx-3d-co'; coHost.appendChild(el); var ln = document.createElementNS(NS, 'line'), dt = document.createElementNS(NS, 'circle'); dt.setAttribute('r', '2.5'); coSvg.appendChild(ln); coSvg.appendChild(dt); coEls.push({ el: el, ln: ln, dt: dt }); }
      /* K27: a narrow stage (phone) cannot hold two columns of full callouts: one column, label · count only, clamped
       * inside the stage (the full sentence stays in the building panel and the schematic) */
      var narrow = w < 640, cw = narrow ? 6.2 : 7;
      for (var i = 0; i < list.length; i++) { var a = list[i]; if (narrow) a.text = a.short; _v.copy(a.world).project(cam); a.ax = (_v.x * 0.5 + 0.5) * w; a.ay = (-_v.y * 0.5 + 0.5) * h; a.wpx = Math.min(w - 20, a.text.length * cw + 26); }
      var left = list.filter(function (a) { return narrow || a.ax < w / 2; }).sort(function (a, b) { return a.ay - b.ay; }), right = narrow ? [] : list.filter(function (a) { return a.ax >= w / 2; }).sort(function (a, b) { return a.ay - b.ay; });
      var pitch = narrow ? 22 : 26;
      /* K27: a column never sits on the equipment it names — try it near its anchors, stacked at the top and at the
       * bottom, and keep the placement that covers the fewest anchor points (ties keep "near") */
      function lay(col, side, mode) { var y = 8, room = h - 8 - col.length * pitch; for (var i = 0; i < col.length; i++) { var a = col[i]; a.ly = mode === 'top' ? 8 + i * pitch : mode === 'bottom' ? 8 + room + i * pitch : Math.max(y, Math.min(8 + room + i * pitch, a.ay - 40)); y = a.ly + pitch; a.lx = side < 0 ? 10 : w - 10 - a.wpx; } }
      function covered(col) { var n = 0; for (var i = 0; i < col.length; i++) { var c = col[i]; for (var j = 0; j < list.length; j++) { var a = list[j]; if (a.ax > c.lx - 4 && a.ax < c.lx + c.wpx + 4 && a.ay > c.ly - 4 && a.ay < c.ly + pitch) n++; } } return n; }
      function column(col, side) { var best = null, bn = 1e9; ['near', 'top', 'bottom'].forEach(function (m) { lay(col, side, m); var n = covered(col); if (n < bn) { bn = n; best = m; } }); lay(col, side, best); }
      column(left, -1); column(right, 1);
      coRects = list.map(function (a) { return { left: a.lx - 4, right: a.lx + a.wpx + 4, top: a.ly - 2, bottom: a.ly + pitch - 2 }; });
      for (var k = 0; k < coEls.length; k++) {
        var c = coEls[k], a = list[k];
        if (!a) { if (!c.el.hidden) { c.el.hidden = true; c.ln.setAttribute('visibility', 'hidden'); c.dt.setAttribute('visibility', 'hidden'); } continue; }
        var onLeft = a.ax < w / 2, ex = onLeft ? a.lx + a.wpx + 2 : a.lx - 2, ey = a.ly + 10, tr = 'translate(' + Math.round(a.lx) + 'px,' + Math.round(a.ly) + 'px)';
        if (c.el.hidden) { c.el.hidden = false; c.ln.setAttribute('visibility', 'visible'); c.dt.setAttribute('visibility', 'visible'); }
        if (c.el.textContent !== a.text) c.el.textContent = a.text; var mw = Math.round(a.wpx) + 'px'; if (c.el.style.maxWidth !== mw) c.el.style.maxWidth = mw; if (c.el.__tr !== tr) { c.el.__tr = tr; c.el.style.transform = tr; } if (c.el.__tg !== a.tag) { c.el.__tg = a.tag; c.el.setAttribute('data-tag', a.tag); } var pk = a.im.userData.system === picked ? '1' : ''; if (c.el.__pk !== pk) { c.el.__pk = pk; if (pk) c.el.setAttribute('data-picked', '1'); else c.el.removeAttribute('data-picked'); }
        c.ln.setAttribute('x1', ex.toFixed(1)); c.ln.setAttribute('y1', ey.toFixed(1)); c.ln.setAttribute('x2', a.ax.toFixed(1)); c.ln.setAttribute('y2', a.ay.toFixed(1)); c.dt.setAttribute('cx', a.ax.toFixed(1)); c.dt.setAttribute('cy', a.ay.toFixed(1));
      }
    }
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
      var placed = coRects.slice();                                                           /* building labels yield to the callout stack (previous frame's boxes) */
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
      if (lastDraw > now) lastDraw = now - 1000; if (last > now) last = now; if (anim.exLast > now) anim.exLast = now;   /* a clock ahead of rAF time (the step() seam) must not stall the loop */
      /* Ambient flows run at 30 fps; the full rate is spent only while the pointer orbits. */
      if (!interacting && !anim.cam && now - lastDraw < 30) { raf = requestAnimationFrame(frame); return; }
      var dt = Math.max(0, Math.min(0.05, (now - (last || now)) / 1000)); last = now; var t0 = now;
      if (!paused && !REDUCE) for (var i = 0; i < flows.length; i++) if (flows[i].speed) step(flows[i], dt);
      /* time-based (240 ms, ease-out applied in applyExplode) so a slow frame rate never stalls it mid-way */
      if (anim.explode !== anim.exTarget) { var exd = REDUCE ? 1 : Math.min(0.25, Math.max(0, now - (anim.exLast || now)) / 1000) / (EX_MS / 1000) || 0.05; anim.explode = anim.exTarget > anim.explode ? Math.min(anim.exTarget, anim.explode + exd) : Math.max(anim.exTarget, anim.explode - exd); }
      anim.exLast = now;
      stepCam(now); stepFades(now);
      var exLayers = applyExplode();
      if (anim.roof !== anim.target) { anim.roof += (anim.target - anim.roof) * (REDUCE ? 1 : 0.18); if (Math.abs(anim.target - anim.roof) < 0.01) anim.roof = anim.target; }
      for (var k in buildings) if (buildings.hasOwnProperty(k)) { var b = buildings[k]; if (b.userData.roof) { var lift = (k === focused ? anim.roof : 0); b.userData.roof.position.y = SITE[k].h + 0.25 + lift * 9 + (k === focused ? ease(anim.explode) * EX_STEP * (exLayers + 1) : 0); b.userData.roof.material.opacity = Math.min(b.userData.roof.material.opacity, 1 - lift * 0.85); b.userData.roof.material.transparent = true; } }
      ctl.update(); renderer.render(scene, cam); placeLabels(); placeCallouts();
      lastDraw = now; frames++; fpsAcc += dt; busy += (root.performance ? root.performance.now() : now) - t0;
      if (fpsAcc >= 1) { fps = frames / fpsAcc; lastFps = fps; adapt(Math.max(busy / frames, 1000 / fps)); frames = 0; fpsAcc = 0; busy = 0; }
      if (inView && (!(paused || REDUCE) || anim.roof !== anim.target || anim.explode !== anim.exTarget || anim.cam || fades.length)) raf = requestAnimationFrame(frame);
    }
    function draw() { if (!raf) raf = requestAnimationFrame(frame); }
    ctl.addEventListener('change', draw); ctl.addEventListener('start', function () { interacting = true; }); ctl.addEventListener('end', function () { interacting = false; });
    if ('ResizeObserver' in root) new ResizeObserver(function () { resize(); draw(); }).observe(stage); else root.addEventListener('resize', function () { resize(); draw(); });
    if ('IntersectionObserver' in root) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) draw(); else if (raf) { cancelAnimationFrame(raf); raf = null; } }, { threshold: 0.05 }).observe(stage);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } } else if (inView) draw(); });
    resize(); preset('campus'); applyStatus();
    booted = true;
    host.setAttribute('data-cx-3d', 'ready');
    /* the Blender library replaces the primitive shapes when it arrives; until then (or without it) the primitives stand */
    host.setAttribute('data-cx-assets', 'primitives');
    if (assets && typeof assets.loadLibrary === 'function') {
      var libUrl = (opts.assetsUrl || ((opts.base || 'js/') + '../assets/cx/campus-equipment.glb')) + '?v=' + encodeURIComponent(root.RZ_VERSION || '');
      assets.loadLibrary(T, libUrl, function (lib) {
        if (!lib) { host.setAttribute('data-cx-assets', 'primitives'); return; }
        var n = 0, nHi = 0;
        for (var i = 0; i < equipment.length; i++) {
          var im = equipment[i], g = lib[im.userData.system], gh = lib[im.userData.system + '_hi']; if (!g) continue;
          var old = im.geometry; im.userData.geoLo = g; im.userData.geoHi = gh || null; if (gh) nHi++;
          var near = !!focused && im.userData.building === focused, want = near && gh ? gh : g;
          im.geometry = want; im.userData.hull.geometry = want; im.userData.lod = want === gh ? 'hi' : 'lo'; im.material.vertexColors = true; im.material.needsUpdate = true; im.userData.shaped = 'glb'; if (old !== g && old !== gh) old.dispose(); im.computeBoundingSphere(); n++;
        }
        host.setAttribute('data-cx-assets', n ? 'glb' : 'primitives'); host.setAttribute('data-cx-assets-count', String(n)); host.setAttribute('data-cx-assets-hi', String(nHi)); draw();
      });
    }
    /* probe(): what the viewer sees — renders one frame and reads five pixels (centre + quarter points) back from the GL
     * buffer; the gate asserts the canvas is light in BOTH page themes (K16) from the render, not from the source. */
    function probe() {
      renderer.render(scene, cam);
      var g = renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(4), out = [], pts = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
      for (var i = 0; i < pts.length; i++) { g.readPixels(Math.floor(w * pts[i][0]), Math.floor(h * pts[i][1]), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); out.push((0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255); }
      var min = Math.min.apply(null, out), avg = out.reduce(function (a, b) { return a + b; }, 0) / out.length;
      return { lum: out, min: min, avg: avg };
    }
    var api = {
      setStatus: function (st) { status = indexStatus(st); applyStatus(); },
      setBasis: function (b) { L = layout(typeof b === 'function' ? b() : b); applyBasis(); applyStatus(); },
      setPaused: setPaused, focus: focus, pick: pick, preset: preset, probe: probe, explode: setExplode, fit: fit,
      exploded: function () { return { factor: anim.explode, layers: layerOf().map(function (l) { return { system: l.im.userData.system, y: l.im.position.y }; }) }; },
      view: function () { var sp = focused ? SITE[focused] : null; return { zoom: cam.zoom, target: [ctl.target.x, ctl.target.z], atSite: Math.abs(ctl.target.x - BOUNDS.cx) < 0.01 && Math.abs(ctl.target.z - BOUNDS.cz) < 0.01, atFocus: !!sp && Math.abs(ctl.target.x - sp.x) < 0.01 && Math.abs(ctl.target.z - sp.z) < 0.01 }; },
      layout: function () { return L; },
      /* test seam: draw one frame at a given timestamp, so a gate can read an ease frame by frame on any GPU */
      step: function (t) { frame(t); return { zoom: cam.zoom, explode: anim.explode }; },
      motion: function () { return { camMoving: !!anim.cam, lastCamMs: Math.round(anim.camMs), camMs: CAM_MS, fadeMs: FADE_MS, fading: fades.length, exMs: EX_MS, stagger: EX_STAGGER, picked: picked, reduce: !!REDUCE }; },
      stats: function () { return { fps: lastFps, quality: quality, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, equipment: equipment.length, shaped: shaped, assets: host.getAttribute('data-cx-assets') || 'primitives', glb: equipment.filter(function (e) { return e.userData.shaped === 'glb'; }).length, hi: equipment.filter(function (e) { return e.userData.lod === 'hi'; }).length, callouts: coEls.filter(function (c) { return !c.el.hidden; }).length, hulls: equipment.filter(function (e) { return e.userData.hull && e.userData.hull.visible; }).length, flows: flows.length, streams: flows.filter(function (f) { return f.speed > 0; }).length, drawn: equipment.map(function (e) { return [e.userData.system, e.count]; }), focused: focused, paused: paused, canvas: PAL.canvas }; },
      select: function (systemId) { for (var k in SITE) if (SITE[k].systems.indexOf(systemId) !== -1) { focus(k); return k; } return null; }
    };
    host.__rzCampus = api; return api;
  }

  /* Load three.js on approach, then mount. */
  function boot(host, opts) {
    if (!host) return;
    function go() {
      var me = document.querySelector('script[src*="rz-cx-campus.js"]'), base = me ? me.src.replace(/rz-cx-campus\.js.*$/, '') : 'js/';
      opts = opts || {}; opts.base = base;
      if (root.RZ3) return mount(host, opts);
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
  root.RZCxCampus = { SITE: SITE, TAG_HEX: TAG_HEX, PAL: PAL, CAP: CAP, layout: layout, mount: mount, boot: boot, worstTag: worstTag, version: '3.29.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RZCxCampus;
})(typeof window !== 'undefined' ? window : this);
