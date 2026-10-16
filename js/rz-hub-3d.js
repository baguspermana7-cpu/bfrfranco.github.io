/* rz-hub-3d.js — the GB300 NVL72 rack, its compute tray and its NVLink switch tray in WebGL,
 * orbitable, exploded on demand, with the coolant loop running through the cold plates
 * (PLAN H3, 2026-10-16).
 *
 * Built procedurally from the dimension table below, not from a model file, so every length is
 * declared. PUBLISHED counts come from DCAI_MODEL.gb300 (DGX GB300 reference architecture,
 * nvidia.com): 18 compute trays, 9 NVLink switch trays, 8 power shelves of 6 × 5.5 kW, 2 superchips
 * per tray (1 Grace + 2 B300 each), 4 ConnectX-8 + 1 BlueField-3 per tray, 2 switch ASICs per
 * switch tray, 72 GPUs a rack. ADOPTED (NVIDIA photographs, Open Rack v3 class): the 48 OU frame,
 * 1 OU per tray, the stacking order, the placement of parts inside a tray, front fans for the
 * air-cooled share, busbar and manifold at the rear. The coolant temperatures are the engine's
 * TCS planes (p07 supply, p08 return). Every part carries its evidence in PARTS[].src and the page
 * prints it. No vendor CAD exists in public; this is the published architecture drawn at a declared
 * size, and says so. Needs RZ3 (js/vendor/three-r170.min.js), loaded on approach. ES5.
 */
(function (root) {
  'use strict';
  var M = root.DCAI_MODEL && root.DCAI_MODEL.gb300 || {};
  var S = root.DCAI_CALC && root.DCAI_CALC.snapshot;
  var REDUCE = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function n(v, d) { return typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: d || 0 }) : '—'; }
  function get(p) { var o = S; if (!o) return null; p = p.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return null; o = o[p[i]]; } return typeof o === 'number' ? o : null; }
  var TCS_S = get('design.planes.p07_tcs_supply_c'), TCS_R = get('design.planes.p08_tcs_return_c');

  /* ---- the dimension table (metres) --------------------------------------------------- */
  var G = {
    OU: 0.048,                                   // Open Rack OU pitch — ADOPTED (ORv3 class)
    rackW: 0.600, rackD: 1.200, rackOU: 48,      // 600 × 1200 mm class (site basis) · 48 OU — ADOPTED
    post: 0.040, trayW: 0.538, trayD: 0.860, trayH: 0.042,
    shelfD: 0.700, psuW: 0.082, fanD: 0.040,
    stack: [['oob', 1], ['ps', 4], ['ct', 9], ['sw', 9], ['ct', 9], ['ps', 4], ['oob', 1]]   // top → bottom — ADOPTED order
  };
  var CT = M.computeTrays || 18, SW = M.nvswitchTrays || 9, PS = M.powerShelves || 8, PSU = M.psuPerShelf || 6, NIC = M.cx8PerTray || 4, FANS = 4;
  var PARTS = {
    ct:   { name: 'Compute tray', count: CT, unit: 'per rack', src: 'PUBLISHED', note: 'Two GB300 superchips — ' + (M.gpuPerTray || 4) + ' B300 GPUs and ' + (M.cpuPerTray || 2) + ' Grace CPUs — liquid-cooled, 1 OU. Open the Compute tray view to see inside.' },
    sw:   { name: 'NVLink switch tray', count: SW, unit: 'per rack', src: 'PUBLISHED', note: (M.nvswitchPerTray || 2) + ' NVLink switch ASICs each; the ' + n(M.nvlinkDomainTBs || 130) + ' TB/s domain is wired through the rear cartridges.' },
    ps:   { name: 'Power shelf', count: PS, unit: 'per rack', src: 'PUBLISHED', note: PSU + ' × ' + n(M.psuKw || 5.5, 1) + ' kW PSU, ' + n(M.shelfKw || 33) + ' kW a shelf: ' + n((M.shelfKw || 33) * PS) + ' kW installed against ' + n(get('power.rack_it_kw') || 142) + ' kW rack IT, so 5 shelves carry it and 3 are spare.' },
    oob:  { name: 'Management switch', count: 2, unit: 'per rack', src: 'ASSUMED', note: 'Out-of-band switch class, one per half rack. The RA names SN2201 OOB per rack without a count.' },
    bus:  { name: 'DC busbar', count: 1, unit: 'rear, vertical', src: 'ADOPTED', note: 'The Open Rack idiom: every shelf feeds it, every tray clips onto it. Rating not published; drawn, not rated.' },
    man:  { name: 'Coolant manifold', count: 2, unit: 'supply + return', src: 'ADOPTED', note: 'Rear vertical manifolds feeding every tray by blind-mate quick disconnects. Supply ' + n(TCS_S) + ' °C up, return ' + n(TCS_R) + ' °C down — the engine’s TCS planes.' },
    cart: { name: 'NVLink cable cartridge', count: 1, unit: 'spine', src: 'ADOPTED', note: 'Copper NVLink spine behind the switch trays joining all 18 compute trays into one domain.' },
    gpu:  { name: 'B300 GPU', count: M.gpuPerTray || 4, unit: 'per tray', src: 'PUBLISHED', note: n(get('compute.gpu_per_rack') || 72) + ' a rack; ' + n(M.nvlinkPerGpuGBs || 1800) + ' GB/s NVLink each; HBM3e stacks around the die; ' + n(M.gpuMemoryTbPerRack || 20) + ' TB a rack. The hottest part — the plate above it is where the heat leaves.' },
    cpu:  { name: 'Grace CPU', count: M.cpuPerTray || 2, unit: 'per tray', src: 'PUBLISHED', note: 'One per superchip, LPDDR5X soldered around it, under its own cold plate.' },
    cold: { name: 'Cold plates', count: 6, unit: 'per tray', src: 'ADOPTED', note: 'Copper, one per GPU and per CPU, serpentine channel milled inside, fin field underneath. GPUs and CPUs are liquid-cooled, the rest air-cooled (RA).' },
    loop: { name: 'Coolant loop', count: 2, unit: 'per tray, in parallel', src: 'ADOPTED', note: 'Supply ' + n(TCS_S) + ' °C (blue) enters at the rear, runs the CPU plate then both GPU plates in series, and returns at ' + n(TCS_R) + ' °C (amber). The dots are the water, coloured by how much heat they have picked up.' },
    fan:  { name: 'Front fans', count: FANS, unit: 'per tray', src: 'ADOPTED', note: 'For the air-cooled share — NICs, memory, VRM. The RA says the rest of the tray is air-cooled; the count is drawn.' },
    nic:  { name: 'ConnectX-8 SuperNIC', count: NIC, unit: 'per tray', src: 'PUBLISHED', note: n(M.cx8Gbps || 800) + ' Gb/s each, front OSFP cages.' },
    dpu:  { name: 'BlueField-3 DPU', count: M.bf3PerTray || 1, unit: 'per tray', src: 'PUBLISHED', note: '2 × 400 Gb/s, front cage.' },
    qd:   { name: 'Quick disconnects', count: 2, unit: 'per tray', src: 'ADOPTED', note: 'Rear blind-mate couplings to the manifold, supply and return.' },
    nvl:  { name: 'NVLink connectors', count: 1, unit: 'rear block', src: 'ADOPTED', note: 'Rear connectors into the cable cartridge — 18 NVL5 links a GPU.' },
    clip: { name: 'Busbar clip', count: 1, unit: 'per tray', src: 'ADOPTED', note: 'Rear power pick-off from the vertical busbar.' },
    asic: { name: 'NVLink switch ASIC', count: M.nvswitchPerTray || 2, unit: 'per tray', src: 'PUBLISHED', note: n(get('compute.nvswitch_per_rack') || 18) + ' a rack, each under its own cold plate.' },
    lid:  { name: 'Tray lid', count: 1, unit: 'per tray', src: 'ADOPTED', note: 'Drawn translucent so the inside stays visible.' }
  };
  var VIEWS = {
    rack: { title: 'GB300 NVL72 rack', parts: ['ct', 'sw', 'ps', 'oob', 'bus', 'man', 'cart'] },
    tray: { title: 'Compute tray', parts: ['gpu', 'cpu', 'cold', 'loop', 'fan', 'nic', 'dpu', 'qd', 'nvl', 'clip', 'lid'] },
    switch: { title: 'NVLink switch tray', parts: ['asic', 'cold', 'loop', 'fan', 'nvl', 'clip', 'lid'] }
  };

  /* ---- builders ----------------------------------------------------------------------- */
  function cssColor(host, name, fallback) { var v = getComputedStyle(host).getPropertyValue(name).trim(); return v || fallback; }
  function build(T, host) {
    var mat = {
      frame: new T.MeshStandardMaterial({ color: 0x5a5f66, metalness: 0.7, roughness: 0.45 }),
      alu: new T.MeshStandardMaterial({ color: 0xc3c7cc, metalness: 0.85, roughness: 0.32 }),
      face: new T.MeshStandardMaterial({ color: 0x8a9097, metalness: 0.7, roughness: 0.42 }),
      dark: new T.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.4, roughness: 0.6 }),
      psu: new T.MeshStandardMaterial({ color: 0xc2c7cc, metalness: 0.7, roughness: 0.35 }),
      copper: new T.MeshStandardMaterial({ color: 0xd08a44, metalness: 1.0, roughness: 0.22 }),
      pcb: new T.MeshStandardMaterial({ color: 0x1d5a3a, metalness: 0.15, roughness: 0.85 }),
      chip: new T.MeshStandardMaterial({ color: 0x15171b, metalness: 0.5, roughness: 0.35 }),
      lid: new T.MeshStandardMaterial({ color: 0xdfe3e7, metalness: 0.95, roughness: 0.15 }),
      hbm: new T.MeshStandardMaterial({ color: 0x33363b, metalness: 0.4, roughness: 0.5 }),
      vrm: new T.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.3, roughness: 0.7 }),
      steel: new T.MeshStandardMaterial({ color: 0xb3b9bf, metalness: 1.0, roughness: 0.18 }),
      supply: new T.MeshStandardMaterial({ color: 0x3f8df5, metalness: 0.3, roughness: 0.4 }),
      ret: new T.MeshStandardMaterial({ color: 0xf0a030, metalness: 0.3, roughness: 0.4 }),
      cart: new T.MeshStandardMaterial({ color: 0x3b3e44, metalness: 0.3, roughness: 0.7 }),
      glass: new T.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.35 }),
      edge: new T.LineBasicMaterial({ color: 0x0f1114, transparent: true, opacity: 0.35 }),
      groove: new T.LineBasicMaterial({ color: 0x4a2c10, transparent: true, opacity: 0.9 })
    };
    var accent = new T.Color(cssColor(host, '--rz-accent-signal', '#FFAA00'));
    function box(w, h, d, m, part, edges) {
      var g = new T.BoxGeometry(w, h, d), mesh = new T.Mesh(g, m.clone()); mesh.userData.part = part; mesh.castShadow = true; mesh.receiveShadow = true;
      if (edges) mesh.add(new T.LineSegments(new T.EdgesGeometry(g), mat.edge));
      return mesh;
    }
    function cyl(r, len, m, part, axis, seg) {
      var mesh = new T.Mesh(new T.CylinderGeometry(r, r, len, seg || 16), m.clone()); mesh.userData.part = part; mesh.castShadow = true; mesh.receiveShadow = true;
      if (axis === 'z') mesh.rotation.x = Math.PI / 2; if (axis === 'x') mesh.rotation.z = Math.PI / 2;
      return mesh;
    }
    function at(o, x, y, z, ex) { o.position.set(x, y, z); if (ex) o.userData.ex = ex; return o; }
    /* a copper cold plate: block, serpentine groove on top, fin field underneath */
    function plate(w, d, part) {
      var g = new T.Group(), th = 0.012;
      g.add(at(box(w, th, d, mat.copper, part, true), 0, th / 2, 0));
      var pts = [], lanes = 6, x0 = -w / 2 + 0.006, x1 = w / 2 - 0.006, zs = -d / 2 + 0.006, pitch = (d - 0.012) / (lanes - 1), y = th + 0.0005;
      for (var i = 0; i < lanes; i++) { var z = zs + i * pitch, a = i % 2 ? x1 : x0, b = i % 2 ? x0 : x1; pts.push(a, y, z, b, y, z); if (i < lanes - 1) pts.push(b, y, z, b, y, z + pitch); }
      var gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(new Float32Array(pts), 3));
      var groove = new T.LineSegments(gg, mat.groove); groove.userData.part = part; g.add(groove);
      for (var f = 0; f < 9; f++) g.add(at(box(w - 0.012, 0.006, 0.0012, mat.copper, part), 0, -0.003, -d / 2 + 0.008 + f * (d - 0.016) / 8));
      return g;
    }
    /* a printed label: a tiny canvas texture on a plane, so every tray reads its slot */
    function labelPlate(text, w, h) {
      var cv = document.createElement('canvas'); cv.width = 256; cv.height = 34; var c = cv.getContext('2d');
      c.fillStyle = '#e9ecef'; c.fillRect(0, 0, 256, 34); c.fillStyle = '#1b1d21'; c.font = '600 22px IBM Plex Mono, Menlo, monospace'; c.textBaseline = 'middle'; c.fillText(text, 10, 17);
      c.fillStyle = '#1b1d21'; c.fillRect(200, 8, 44, 18); c.fillStyle = '#e9ecef'; c.font = '600 12px IBM Plex Mono, Menlo, monospace'; c.fillText('NVL72', 203, 17);
      var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.6 })); m.userData.part = 'label'; return m;
    }
    function fan(part) {
      var g = new T.Group(), s = G.fanD;
      g.add(at(box(s, s, 0.025, mat.dark, part, true), 0, 0, 0));
      var hub = at(cyl(0.006, 0.027, mat.alu, part, 'z'), 0, 0, 0); g.add(hub);
      var blades = new T.Group(); for (var i = 0; i < 7; i++) { var b = box(0.016, 0.004, 0.012, mat.alu, part); b.position.set(0.012, 0, 0); var h = new T.Group(); h.rotation.z = i * Math.PI * 2 / 7; h.add(b); blades.add(h); }
      blades.position.z = 0.013; blades.userData.spin = true; g.add(blades);
      var ring = at(new T.Mesh(new T.CylinderGeometry(s / 2 - 0.002, s / 2 - 0.002, 0.004, 24), mat.dark.clone()), 0, 0, 0.0135); ring.rotation.x = Math.PI / 2; ring.userData.part = part; ring.material.transparent = true; ring.material.opacity = 0.15; g.add(ring);
      return g;
    }
    function cage(w, part) { var g = new T.Group(); g.add(at(box(w, 0.020, 0.10, mat.steel, part, true), 0, 0, 0)); g.add(at(box(w - 0.006, 0.012, 0.004, mat.chip, part), 0, 0, 0.052)); return g; }
    /* the loop as a polyline in tray coordinates; returns { tube, curve } */
    function loopPath(points, m, part) {
      var cp = new T.CurvePath();
      for (var i = 0; i < points.length - 1; i++) cp.add(new T.LineCurve3(new T.Vector3(points[i][0], points[i][1], points[i][2]), new T.Vector3(points[i + 1][0], points[i + 1][1], points[i + 1][2])));
      var tube = new T.Mesh(new T.TubeGeometry(cp, Math.max(8, points.length * 4), 0.0045, 10, false), m.clone()); tube.userData.part = part;
      return { tube: tube, curve: cp };
    }
    function particles(curve, count, part, heatAt, size) {
      var pos = new Float32Array(count * 3), col = new Float32Array(count * 3), geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      var pm = new T.PointsMaterial({ size: size || 0.028, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending });
      var pts = new T.Points(geo, pm); pts.userData = { part: part, curve: curve, count: count, phase: Math.random(), heatAt: heatAt, flow: true };
      pts.frustumCulled = false; return pts;
    }
    var cold = new T.Color(0x3f8df5), warm = new T.Color(0xf0a030), tmp = new T.Color();
    function stepParticles(pts, t) {
      var u = pts.userData, p = u.curve, pos = pts.geometry.attributes.position.array, col = pts.geometry.attributes.color.array, v3 = new T.Vector3();
      for (var i = 0; i < u.count; i++) {
        var f = ((i / u.count) + (REDUCE ? 0 : t * 0.0001) + u.phase) % 1;
        p.getPointAt(f, v3); pos[i * 3] = v3.x; pos[i * 3 + 1] = v3.y; pos[i * 3 + 2] = v3.z;
        var heat = 0; for (var k = 0; k < u.heatAt.length; k++) if (f > u.heatAt[k][0]) heat = u.heatAt[k][1];
        tmp.copy(cold).lerp(warm, heat); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true;
    }
    /* ---- the compute tray, origin at its rear-bottom centre, +z to the front ---- */
    function computeTray(detail, label) {
      var g = new T.Group(), W = G.trayW, D = G.trayD, H = G.trayH;
      g.add(at(box(W, 0.004, D, mat.alu, 'ct', true), 0, 0.002, D / 2));
      g.add(at(box(0.006, H, D, mat.alu, 'ct'), -W / 2 + 0.003, H / 2, D / 2));
      g.add(at(box(0.006, H, D, mat.alu, 'ct'), W / 2 - 0.003, H / 2, D / 2));
      var face = at(box(W, H, 0.010, mat.face, 'ct', true), 0, H / 2, D - 0.005); g.add(face);
      /* faceplate detail on every tray: fan grilles left, cages right, a status LED */
      for (var fi = 0; fi < FANS; fi++) { var grille = at(cyl(0.017, 0.004, mat.dark, 'ct', 'z', 20), -W / 2 + 0.03 + fi * 0.046, H / 2, D + 0.002); g.add(grille); }
      for (var ci = 0; ci < NIC + 1; ci++) { g.add(at(box(0.034, 0.016, 0.004, mat.chip, ci < NIC ? 'nic' : 'dpu'), W / 2 - 0.035 - ci * 0.044, H / 2, D + 0.002)); }
      var led = at(box(0.004, 0.004, 0.003, mat.supply, 'ct'), -W / 2 + 0.012, H - 0.008, D + 0.002); g.add(led);
      [-1, 1].forEach(function (sx) { g.add(at(box(0.012, H, 0.004, mat.alu, 'ct'), sx * (W / 2 + 0.006), H / 2, D - 0.003)); g.add(at(cyl(0.004, 0.006, mat.steel, 'ct', 'z', 12), sx * (W / 2 + 0.006), H / 2, D + 0.002)); });
      if (label) g.add(at(labelPlate(label, 0.09, 0.012), W / 2 - 0.26, H - 0.009, D + 0.0015));
      if (!detail) { g.add(at(box(W, 0.004, D, mat.alu, 'ct'), 0, H - 0.002, D / 2)); return g; }
      /* the front bay: four fans and the five cages behind the faceplate */
      for (var f = 0; f < FANS; f++) g.add(at(fan('fan'), -W / 2 + 0.03 + f * 0.046, H / 2, D - 0.03, [0, 0, 0.12]));
      for (var c = 0; c < NIC; c++) g.add(at(cage(0.040, 'nic'), W / 2 - 0.035 - c * 0.044, 0.016, D - 0.07, [0, 0, 0.14]));
      g.add(at(cage(0.040, 'dpu'), W / 2 - 0.035 - NIC * 0.044, 0.016, D - 0.07, [0, 0, 0.14]));
      /* two superchip boards side by side */
      var loops = [];
      [-1, 1].forEach(function (sx) {
        var bx = sx * 0.135, zc = 0.50, zg = 0.31;
        g.add(at(box(0.23, 0.0025, 0.40, mat.pcb, 'ct', true), bx, 0.006, 0.42));
        /* Grace: package with a silver lid, LPDDR5X around it */
        g.add(at(box(0.07, 0.004, 0.07, mat.chip, 'cpu'), bx, 0.009, zc, [0, 0.015, 0]));
        g.add(at(box(0.05, 0.002, 0.05, mat.lid, 'cpu'), bx, 0.012, zc, [0, 0.015, 0]));
        for (var m = 0; m < 8; m++) { var mx = bx + (m < 4 ? -0.055 : 0.055), mz = zc - 0.03 + (m % 4) * 0.02; g.add(at(box(0.012, 0.002, 0.016, mat.hbm, 'cpu'), mx, 0.008, mz)); }
        /* two B300: die under a lid, eight HBM stacks around each */
        [-1, 1].forEach(function (gx) {
          var x = bx + gx * 0.056;
          g.add(at(box(0.075, 0.004, 0.075, mat.chip, 'gpu'), x, 0.009, zg, [0, 0.015, 0]));
          var die = at(box(0.028, 0.002, 0.028, mat.lid, 'gpu'), x, 0.012, zg, [0, 0.015, 0]); die.userData.heat = true; g.add(die);
          for (var h = 0; h < 8; h++) { var a = h * Math.PI / 4, hx = x + Math.cos(a) * 0.026, hz = zg + Math.sin(a) * 0.026; g.add(at(box(0.011, 0.002, 0.011, mat.hbm, 'gpu'), hx, 0.012, hz, [0, 0.015, 0])); }
        });
        /* VRM rows along the outer edge */
        for (var v = 0; v < 10; v++) g.add(at(box(0.008, 0.006, 0.008, mat.vrm, 'ct'), bx + sx * 0.105, 0.010, 0.25 + v * 0.032));
        /* cold plates: one on the CPU, one on each GPU, lifted together when exploded */
        g.add(at(plate(0.075, 0.075, 'cold'), bx, 0.015, zc, [0, 0.08, 0]));
        g.add(at(plate(0.080, 0.080, 'cold'), bx - 0.056, 0.015, zg, [0, 0.08, 0]));
        g.add(at(plate(0.080, 0.080, 'cold'), bx + 0.056, 0.015, zg, [0, 0.08, 0]));
        /* the loop: supply trunk → CPU plate → GPU plate → GPU plate → return trunk, at plate height */
        var y = 0.030, sIn = sx < 0 ? -0.215 : -0.21, rOut = sx < 0 ? 0.21 : 0.215;
        var pts = [[sIn, y, 0.03], [sIn, y, 0.60], [bx - 0.045, y, 0.60], [bx - 0.045, y, zc + 0.02], [bx + 0.03, y, zc + 0.02], [bx + 0.03, y, zc - 0.02], [bx - 0.03, y, zc - 0.02],
                   [bx - 0.03, y, zg + 0.03], [bx - 0.056, y, zg + 0.03], [bx - 0.056, y, zg - 0.03], [bx, y, zg - 0.03], [bx + 0.056, y, zg - 0.03], [bx + 0.056, y, zg + 0.03],
                   [bx + 0.095, y, zg + 0.03], [bx + 0.095, y, 0.20], [rOut, y, 0.20], [rOut, y, 0.03]];
        var tubeS = loopPath(pts.slice(0, 5), mat.supply, 'loop'), tubeM = loopPath(pts.slice(4, 14), mat.steel, 'loop'), tubeR = loopPath(pts.slice(13), mat.ret, 'loop');
        [tubeS.tube, tubeM.tube, tubeR.tube].forEach(function (t) { t.userData.ex = [0, 0.08, 0]; g.add(t); });
        var full = loopPath(pts, mat.steel, 'loop'); var cpuU = 0.30, g1 = 0.52, g2 = 0.66;
        var pt = particles(full.curve, 90, 'loop', [[cpuU, 0.3], [g1, 0.65], [g2, 1]]); pt.userData.ex = [0, 0.08, 0]; g.add(pt); loops.push(pt);
      });
      /* rear: quick disconnects with coloured collars, NVLink block, busbar clip */
      [[-0.21, mat.supply, 'qd'], [0.21, mat.ret, 'qd']].forEach(function (q) {
        g.add(at(cyl(0.012, 0.05, mat.steel, 'qd', 'z'), q[0], 0.030, 0.025, [0, 0, -0.08]));
        g.add(at(cyl(0.014, 0.012, q[1], 'qd', 'z'), q[0], 0.030, 0.012, [0, 0, -0.08]));
      });
      var nvl = at(box(0.26, 0.030, 0.030, mat.cart, 'nvl', true), 0, 0.020, 0.016, [0, 0, -0.08]); g.add(nvl);
      for (var s2 = 0; s2 < 18; s2++) g.add(at(box(0.009, 0.014, 0.004, mat.chip, 'nvl'), -0.12 + s2 * 0.0141, 0.020, 0.0, [0, 0, -0.08]));
      g.add(at(box(0.040, 0.030, 0.025, mat.copper, 'clip'), 0.17, 0.020, 0.013, [0, 0, -0.06]));
      g.add(at(box(W, 0.004, D - 0.02, mat.glass, 'lid', true), 0, H - 0.002, D / 2 - 0.01, [0, 0.17, 0]));
      g.userData.loops = loops;
      return g;
    }
    function switchTray(detail, label) {
      var g = new T.Group(), W = G.trayW, D = G.trayD, H = G.trayH;
      g.add(at(box(W, 0.004, D, mat.alu, 'sw', true), 0, 0.002, D / 2));
      g.add(at(box(0.006, H, D, mat.alu, 'sw'), -W / 2 + 0.003, H / 2, D / 2)); g.add(at(box(0.006, H, D, mat.alu, 'sw'), W / 2 - 0.003, H / 2, D / 2));
      g.add(at(box(W, H, 0.010, mat.dark, 'sw', true), 0, H / 2, D - 0.005));
      for (var fi = 0; fi < 2; fi++) g.add(at(cyl(0.017, 0.004, mat.face, 'sw', 'z', 20), -W / 2 + 0.03 + fi * 0.046, H / 2, D + 0.002));
      for (var pi = 0; pi < 4; pi++) g.add(at(box(0.020, 0.012, 0.004, mat.steel, 'sw'), W / 2 - 0.03 - pi * 0.028, H / 2, D + 0.002));
      [-1, 1].forEach(function (sx) { g.add(at(box(0.012, H, 0.004, mat.alu, 'sw'), sx * (W / 2 + 0.006), H / 2, D - 0.003)); g.add(at(cyl(0.004, 0.006, mat.steel, 'sw', 'z', 12), sx * (W / 2 + 0.006), H / 2, D + 0.002)); });
      if (label) g.add(at(labelPlate(label, 0.09, 0.012), 0, H - 0.009, D + 0.0015));
      if (!detail) { g.add(at(box(W, 0.004, D, mat.alu, 'sw'), 0, H - 0.002, D / 2)); return g; }
      for (var f = 0; f < 2; f++) g.add(at(fan('fan'), -W / 2 + 0.03 + f * 0.046, H / 2, D - 0.03, [0, 0, 0.12]));
      g.add(at(box(0.46, 0.0025, 0.42, mat.pcb, 'sw', true), 0, 0.006, 0.40));
      var loops = [];
      [-1, 1].forEach(function (sx) {
        var x = sx * 0.11, z = 0.40;
        g.add(at(box(0.09, 0.004, 0.09, mat.chip, 'asic'), x, 0.009, z, [0, 0.015, 0]));
        var die = at(box(0.04, 0.002, 0.04, mat.lid, 'asic'), x, 0.012, z, [0, 0.015, 0]); die.userData.heat = true; g.add(die);
        for (var v = 0; v < 6; v++) g.add(at(box(0.008, 0.006, 0.008, mat.vrm, 'sw'), x + sx * 0.08, 0.010, 0.30 + v * 0.04));
        g.add(at(plate(0.10, 0.10, 'cold'), x, 0.015, z, [0, 0.08, 0]));
      });
      var y = 0.030, pts = [[-0.21, y, 0.03], [-0.21, y, 0.52], [-0.14, y, 0.52], [-0.14, y, 0.44], [-0.08, y, 0.44], [-0.08, y, 0.36], [0.08, y, 0.36], [0.08, y, 0.44], [0.14, y, 0.44], [0.14, y, 0.28], [0.21, y, 0.28], [0.21, y, 0.03]];
      var tS = loopPath(pts.slice(0, 3), mat.supply, 'loop'), tM = loopPath(pts.slice(2, 10), mat.steel, 'loop'), tR = loopPath(pts.slice(9), mat.ret, 'loop');
      [tS.tube, tM.tube, tR.tube].forEach(function (t) { t.userData.ex = [0, 0.08, 0]; g.add(t); });
      var full = loopPath(pts, mat.steel, 'loop'), pt = particles(full.curve, 70, 'loop', [[0.40, 0.5], [0.62, 1]]); pt.userData.ex = [0, 0.08, 0]; g.add(pt); loops.push(pt);
      [[-0.21, mat.supply], [0.21, mat.ret]].forEach(function (q) { g.add(at(cyl(0.012, 0.05, mat.steel, 'qd', 'z'), q[0], 0.030, 0.025, [0, 0, -0.08])); g.add(at(cyl(0.014, 0.012, q[1], 'qd', 'z'), q[0], 0.030, 0.012, [0, 0, -0.08])); });
      g.add(at(box(0.42, 0.030, 0.030, mat.cart, 'nvl', true), 0, 0.020, 0.016, [0, 0, -0.08]));
      for (var s2 = 0; s2 < 36; s2++) g.add(at(box(0.008, 0.014, 0.004, mat.chip, 'nvl'), -0.20 + s2 * 0.0114, 0.020, 0.0, [0, 0, -0.08]));
      g.add(at(box(0.040, 0.030, 0.025, mat.copper, 'clip'), 0.24, 0.020, 0.013, [0, 0, -0.06]));
      g.add(at(box(W, 0.004, D - 0.02, mat.glass, 'lid', true), 0, H - 0.002, D / 2 - 0.01, [0, 0.17, 0]));
      g.userData.loops = loops;
      return g;
    }
    function powerShelf(label) {
      var g = new T.Group(), W = G.trayW, D = G.shelfD, H = G.trayH;
      g.add(at(box(W, H, D, mat.face, 'ps', true), 0, H / 2, D / 2));
      if (label) g.add(at(labelPlate(label, 0.09, 0.012), -W / 2 + 0.06, H - 0.006, D + 0.031));
      for (var i = 0; i < PSU; i++) { var x = -W / 2 + 0.03 + G.psuW / 2 + i * (G.psuW + 0.006); g.add(at(box(G.psuW, H - 0.008, 0.02, mat.psu, 'ps', true), x, H / 2, D + 0.01)); g.add(at(box(0.03, 0.004, 0.006, mat.dark, 'ps'), x, H / 2 + 0.010, D + 0.022)); g.add(at(box(0.004, 0.004, 0.003, mat.supply, 'ps'), x - 0.03, H / 2 - 0.010, D + 0.021)); }
      return g;
    }
    function oobSwitch() { var g = new T.Group(); g.add(at(box(G.trayW, G.trayH, 0.45, mat.dark, 'oob', true), 0, G.trayH / 2, 0.225)); for (var i = 0; i < 24; i++) g.add(at(box(0.012, 0.010, 0.004, mat.steel, 'oob'), -0.22 + i * 0.016, G.trayH / 2, 0.452)); return g; }
    function rack() {
      var g = new T.Group(), H = G.rackOU * G.OU + 0.08, W = G.rackW, D = G.rackD;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.add(at(box(G.post, H, G.post, mat.frame, 'frame'), c[0] * (W / 2 - G.post / 2), H / 2, c[1] * (D / 2 - G.post / 2))); });
      [0, H].forEach(function (y) { [-1, 1].forEach(function (s) { var yy = y + (y ? -G.post / 2 : G.post / 2); g.add(at(box(W, G.post, G.post, mat.frame, 'frame'), 0, yy, s * (D / 2 - G.post / 2))); g.add(at(box(G.post, G.post, D, mat.frame, 'frame'), s * (W / 2 - G.post / 2), yy, 0)); }); });
      g.add(at(box(W, 0.02, D, mat.dark, 'frame'), 0, H - 0.01, 0));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.add(at(cyl(0.035, 0.03, mat.dark, 'frame', 'x', 16), c[0] * (W / 2 - 0.06), -0.035, c[1] * (D / 2 - 0.08))); });
      [-1, 1].forEach(function (sx) { var sp = box(0.004, H - 0.1, D - 0.1, mat.glass, 'frame'); sp.material.opacity = 0.12; sp.castShadow = false; at(sp, sx * (W / 2 - 0.002), H / 2, 0); g.add(sp); });
      [-0.03, 0.03].forEach(function (x) { g.add(at(box(0.02, H - 0.2, 0.012, mat.copper, 'bus'), x, H / 2, -D / 2 + 0.05, [0, 0, -0.25])); });
      var manS = at(cyl(0.018, H - 0.2, mat.supply, 'man', 'y'), -0.24, H / 2, -D / 2 + 0.07, [0, 0, -0.3]); g.add(manS);
      var manR = at(cyl(0.018, H - 0.2, mat.ret, 'man', 'y'), 0.24, H / 2, -D / 2 + 0.07, [0, 0, -0.3]); g.add(manR);
      var y = H - 0.06 - G.OU * 5, slots = [], swTop = null, swBot = null, counts = {};
      G.stack.forEach(function (s) { for (var i = 0; i < s[1]; i++) { slots.push({ kind: s[0], y: y }); y -= G.OU; } });
      slots.forEach(function (s, i) {
        var nk = (counts[s.kind] = (counts[s.kind] || 0) + 1), lab = (s.kind === 'ct' ? 'CT ' : s.kind === 'sw' ? 'NVSW ' : s.kind === 'ps' ? 'PS ' : 'OOB ') + (nk < 10 ? '0' : '') + nk;
        var t = s.kind === 'ct' ? computeTray(false, lab) : s.kind === 'sw' ? switchTray(false, lab) : s.kind === 'ps' ? powerShelf(lab) : oobSwitch();
        t.position.set(0, s.y, -G.trayD / 2 + 0.05); t.userData.ex = [0, 0, s.kind === 'ct' ? 0.42 : s.kind === 'sw' ? 0.58 : s.kind === 'ps' ? 0.30 : 0.26]; g.add(t);
        if (s.kind === 'ct' || s.kind === 'sw') { [[-0.24, mat.supply], [0.24, mat.ret]].forEach(function (q) { g.add(at(cyl(0.008, 0.05, mat.steel, 'man', 'z'), q[0], s.y + 0.03, -D / 2 + 0.10, [0, 0, -0.3])); }); }
        if (s.kind === 'sw') { if (swTop === null) swTop = s.y; swBot = s.y; }
      });
      if (swTop !== null) g.add(at(box(0.50, (swTop - swBot) + G.OU * 1.5, 0.12, mat.cart, 'cart', true), 0, (swTop + swBot) / 2 + G.OU / 2, -D / 2 + 0.16, [0, 0, -0.45]));
      /* the manifold water: supply rises, return falls */
      var up = new T.CurvePath(); up.add(new T.LineCurve3(new T.Vector3(-0.24, 0.1, -D / 2 + 0.07), new T.Vector3(-0.24, H - 0.1, -D / 2 + 0.07)));
      var dn = new T.CurvePath(); dn.add(new T.LineCurve3(new T.Vector3(0.24, H - 0.1, -D / 2 + 0.07), new T.Vector3(0.24, 0.1, -D / 2 + 0.07)));
      var pu = particles(up, 60, 'man', [], 0.06), pd = particles(dn, 60, 'man', [[0, 1]], 0.06); pu.userData.ex = pd.userData.ex = [0, 0, -0.3]; g.add(pu); g.add(pd);
      g.userData.loops = [pu, pd];
      return g;
    }
    return { rack: rack, tray: function () { return computeTray(true); }, switch: function () { return switchTray(true); }, accent: accent, step: stepParticles };
  }

  /* ---- the component ------------------------------------------------------------------ */
  function mount(host) {
    if (!host || host.__rzHub3d) return; host.__rzHub3d = true;
    var cv = host.querySelector('canvas'), stage = host.querySelector('.h3-stage'), labels = host.querySelector('.h3-labels'), list = host.querySelector('.h3-parts'), read = host.querySelector('.h3-read');
    var tabs = Array.prototype.slice.call(host.querySelectorAll('[data-view]')), explodeBtn = host.querySelector('[data-explode]'), resetBtn = host.querySelector('[data-reset]');
    var T = root.RZ3; if (!T) return;
    var gl; try { gl = cv.getContext('webgl2') || cv.getContext('webgl'); } catch (e) { gl = null; }
    if (!gl) { stage.innerHTML = '<p class="h3-nogl">This browser has no WebGL; the counts above are the same ones the drawing would show.</p>'; return; }
    var renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    var scene = new T.Scene();
    /* a studio environment painted on a canvas — three soft light bands over a dark floor — so the
     * aluminium, copper and steel have something to reflect; the renderer builds the PMREM from it */
    try {
      var ec = document.createElement('canvas'); ec.width = 512; ec.height = 256; var e2 = ec.getContext('2d');
      var grad = e2.createLinearGradient(0, 0, 0, 256); grad.addColorStop(0, '#6f7c8c'); grad.addColorStop(0.42, '#2c3238'); grad.addColorStop(0.55, '#1e2227'); grad.addColorStop(1, '#0b0c0e'); e2.fillStyle = grad; e2.fillRect(0, 0, 512, 256);
      [[40, 30, 120, 26], [220, 20, 160, 22], [400, 36, 90, 20]].forEach(function (b) { e2.fillStyle = 'rgba(255,250,240,0.55)'; e2.fillRect(b[0], b[1], b[2], b[3]); });
      var envTex = new T.CanvasTexture(ec); envTex.mapping = 303; envTex.colorSpace = T.SRGBColorSpace; scene.environment = envTex;
    } catch (e) { /* no environment: the lights alone carry it */ }
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var cam = new T.PerspectiveCamera(34, 1, 0.01, 50);
    var ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.enablePan = false; ctl.autoRotate = !REDUCE; ctl.autoRotateSpeed = 0.5;
    scene.add(new T.HemisphereLight(0xe8eef6, 0x2a2d33, 1.5)); scene.add(new T.AmbientLight(0x6a717a, 0.6));
    var key = new T.DirectionalLight(0xffffff, 2.0); key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.camera.left = key.shadow.camera.bottom = -2.2; key.shadow.camera.right = key.shadow.camera.top = 2.2; key.shadow.camera.near = 0.5; key.shadow.camera.far = 12; scene.add(key);
    var fill = new T.DirectionalLight(0xbfc8d6, 0.9); fill.position.set(-3, 2, -2); scene.add(fill);
    var rim = new T.DirectionalLight(0xffffff, 0.6); rim.position.set(0, 1, -4); scene.add(rim);
    var gridCol = new T.Color(cssColor(host, '--rz-line-tier-2', '#2a2d31'));
    var grid = new T.GridHelper(4, 40, gridCol, gridCol); grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
    var floor = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshStandardMaterial({ color: 0x101216, metalness: 0.2, roughness: 0.78 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.004; floor.receiveShadow = true; scene.add(floor);
    var B = build(T, host), world = new T.Group(); scene.add(world);
    var view = 'rack', model = null, explode = 0, explodeTarget = 0, hot = null, pinned = null, active = -1, raf = null, raycaster = new T.Raycaster(), ptr = new T.Vector2(-9, -9), meshes = [], spinners = [], heats = [];

    function fit(name) {
      if (name === 'rack') { grid.position.y = 0; floor.position.y = -0.004; cam.position.set(3.1, 2.3, 3.9); ctl.target.set(0, 1.25, 0); ctl.minDistance = 1.2; ctl.maxDistance = 8; }
      else { grid.position.y = -0.02; floor.position.y = -0.024; cam.position.set(0.95, 0.78, 1.60); ctl.target.set(0, 0.04, 0.40); ctl.minDistance = 0.25; ctl.maxDistance = 3; }
      ctl.update();
    }
    function show(name) {
      view = name; if (model) world.remove(model);
      model = B[name](); world.add(model); meshes = []; spinners = []; heats = [];
      model.traverse(function (o) {
        if (o.userData && o.userData.ex) o.userData.p0 = o.position.clone();
        if (o.isMesh && o.userData.part && o.userData.part !== 'frame' && o.userData.part !== 'label') meshes.push(o);
        if (o.userData && o.userData.spin) spinners.push(o);
        if (o.userData && o.userData.heat) heats.push(o);
      });
      tabs.forEach(function (t) { var on = t.getAttribute('data-view') === name; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      host.setAttribute('data-view-on', name); pinned = null; active = -1; hot = null;
      explode = explodeTarget = 0; explodeBtn.setAttribute('aria-pressed', 'false');
      fit(name); renderList(); readout(null); applyExplode(); draw();
    }
    function applyExplode() {
      model.traverse(function (o) { var ex = o.userData.ex; if (!ex || !o.userData.p0) return; o.position.set(o.userData.p0.x + ex[0] * explode, o.userData.p0.y + ex[1] * explode, o.userData.p0.z + ex[2] * explode); });
    }
    function renderList() {
      var V = VIEWS[view];
      list.innerHTML = V.parts.map(function (id, i) { var p = PARTS[id]; return '<li data-part="' + id + '"><b>' + (i + 1) + '</b><span>' + p.name + '</span><i>' + (p.count > 1 ? '×' + n(p.count) + ' ' : '') + p.src.toLowerCase() + '</i></li>'; }).join('');
      labels.innerHTML = V.parts.map(function (id, i) { return '<span class="h3-tag" data-part="' + id + '"><b>' + (i + 1) + '</b></span>'; }).join('');
    }
    function readout(id) {
      var V = VIEWS[view];
      if (!id) { read.innerHTML = '<b>' + V.title + '</b><span>' + (view === 'rack' ? n(CT) + ' compute trays · ' + n(SW) + ' switch trays · ' + n(PS) + ' power shelves · ' + n(get('compute.gpu_per_rack') || 72) + ' GPUs · ' + n(get('power.rack_it_kw') || 142) + ' kW' : view === 'tray' ? n(M.gpuPerTray || 4) + ' B300 · ' + n(M.cpuPerTray || 2) + ' Grace · ' + n(NIC) + ' CX-8 · 1 BF-3 · TCS ' + n(TCS_S) + ' → ' + n(TCS_R) + ' °C' : n(M.nvswitchPerTray || 2) + ' NVLink switch ASICs · TCS ' + n(TCS_S) + ' → ' + n(TCS_R) + ' °C') + '</span><p>Hover or tap a part, or step through the list. <em>Counts published; placements adopted.</em></p>'; return; }
      var p = PARTS[id], i = V.parts.indexOf(id);
      read.innerHTML = '<b>' + (i + 1) + ' · ' + p.name + '</b><span>' + (p.count > 1 ? '× ' + n(p.count) + ' ' + p.unit : p.unit) + ' · <em data-src="' + p.src + '">' + p.src + '</em></span><p>' + p.note + '</p>';
    }
    function light(id) {
      hot = id;
      meshes.forEach(function (m) { var on = id && m.userData.part === id; if (!m.material.emissive) return; m.material.emissive.setHex(on ? B.accent.getHex() : 0x000000); m.material.emissiveIntensity = on ? 0.5 : 0; });
      Array.prototype.forEach.call(list.children, function (li) { li.classList.toggle('is-hot', li.getAttribute('data-part') === id); });
      Array.prototype.forEach.call(labels.children, function (t) { t.classList.toggle('is-hot', t.getAttribute('data-part') === id); });
      readout(id || null); draw();
    }
    function anchorOf(id) { for (var i = 0; i < meshes.length; i++) if (meshes[i].userData.part === id) return meshes[i]; return null; }
    var v3 = new T.Vector3();
    function placeLabels() {
      var w = cv.clientWidth, h = cv.clientHeight;
      Array.prototype.forEach.call(labels.children, function (t) {
        var m = anchorOf(t.getAttribute('data-part')); if (!m) { t.style.display = 'none'; return; }
        m.getWorldPosition(v3); v3.project(cam);
        if (v3.z > 1) { t.style.display = 'none'; return; }
        t.style.display = ''; t.style.transform = 'translate(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px)';
      });
    }
    function resize() { var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    function draw() { if (raf) return; raf = requestAnimationFrame(frame); }
    var lastInput = 0, inView = true;
    function frame(t) {
      raf = null;
      var exploding = Math.abs(explodeTarget - explode) > 0.001;
      if (exploding) { explode += (explodeTarget - explode) * (REDUCE ? 1 : 0.14); if (Math.abs(explodeTarget - explode) <= 0.001) explode = explodeTarget; applyExplode(); }
      var loops = model.userData.loops || [];
      for (var i = 0; i < loops.length; i++) B.step(loops[i], t);
      for (var s = 0; s < spinners.length; s++) spinners[s].rotation.z += REDUCE ? 0 : 0.25;
      var pulse = REDUCE ? 0.7 : 0.7 + 0.3 * Math.sin(t / 600);
      for (var h = 0; h < heats.length; h++) { heats[h].material.emissive.setHex(0xff7a1a); heats[h].material.emissiveIntensity = pulse; }
      ctl.update();
      try { renderer.render(scene, cam); } catch (e) { if (scene.environment) { scene.environment = null; renderer.render(scene, cam); } else throw e; }
      placeLabels();
      var moving = ctl.autoRotate || exploding || (t - lastInput) < 1400 || (!REDUCE && (loops.length || spinners.length));
      if (moving && inView) raf = requestAnimationFrame(frame);
    }
    function pick(ev) {
      var r = cv.getBoundingClientRect(); ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ptr, cam); var hits = raycaster.intersectObjects(meshes, false);
      return hits.length ? hits[0].object.userData.part : null;
    }
    function touched() { ctl.autoRotate = false; lastInput = performance.now(); draw(); }
    cv.addEventListener('pointermove', function (ev) { if (pinned) return; var id = pick(ev); if (id !== hot) light(id); });
    cv.addEventListener('pointerleave', function () { if (!pinned) light(null); });
    cv.addEventListener('pointerdown', touched, { passive: true });
    cv.addEventListener('wheel', touched, { passive: true });
    cv.addEventListener('click', function (ev) { var id = pick(ev); pinned = id; light(id); });
    list.addEventListener('pointerover', function (e) { var li = e.target.closest('[data-part]'); if (li) { pinned = li.getAttribute('data-part'); light(pinned); } });
    list.addEventListener('click', function (e) { var li = e.target.closest('[data-part]'); if (li) { pinned = li.getAttribute('data-part'); active = VIEWS[view].parts.indexOf(pinned); light(pinned); } });
    labels.addEventListener('click', function (e) { var t = e.target.closest('[data-part]'); if (t) { pinned = t.getAttribute('data-part'); light(pinned); } });
    host.querySelector('[data-prev]').addEventListener('click', function () { var P = VIEWS[view].parts; active = (active - 1 + P.length) % P.length; pinned = P[active]; light(pinned); touched(); });
    host.querySelector('[data-next]').addEventListener('click', function () { var P = VIEWS[view].parts; active = (active + 1) % P.length; pinned = P[active]; light(pinned); touched(); });
    explodeBtn.addEventListener('click', function () { explodeTarget = explodeTarget ? 0 : 1; explodeBtn.setAttribute('aria-pressed', explodeTarget ? 'true' : 'false'); touched(); });
    resetBtn.addEventListener('click', function () { fit(view); explodeTarget = 0; explodeBtn.setAttribute('aria-pressed', 'false'); pinned = null; light(null); ctl.autoRotate = !REDUCE; draw(); });
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-view')); }); });
    ctl.addEventListener('change', function () { lastInput = performance.now(); draw(); });
    host.__rz3d = { ctl: ctl, setExplode: function (v) { explodeTarget = v; explode = v; applyExplode(); draw(); }, show: show };
    if ('ResizeObserver' in root) new ResizeObserver(function () { resize(); draw(); }).observe(stage); else root.addEventListener('resize', function () { resize(); draw(); });
    /* off-screen the loop stops; back on-screen it resumes where it was */
    if ('IntersectionObserver' in root) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) draw(); else if (raf) { cancelAnimationFrame(raf); raf = null; } }, { threshold: 0.05 }).observe(host);
    /* the published spec row under the figure, each with its registry id */
    var specHost = host.querySelector('.h3-spec');
    if (specHost) specHost.innerHTML = [
      ['GPUs a rack', n(get('compute.gpu_per_rack') || 72), 'compute.gpu_per_rack'], ['NVLink domain', n(M.nvlinkDomainTBs || 130) + ' TB/s', 'gb300.nvlinkDomainTBs'], ['NVLink a GPU', n(M.nvlinkPerGpuGBs || 1800) + ' GB/s', 'gb300.nvlinkPerGpuGBs'],
      ['GPU memory a rack', n(M.gpuMemoryTbPerRack || 20) + ' TB', 'gb300.gpuMemoryTbPerRack'], ['Rack IT', n(get('power.rack_it_kw') || 142) + ' kW', 'power.rack_it_kw'], ['Power installed', n((M.shelfKw || 33) * PS) + ' kW', 'gb300.powerShelves × shelfKw'],
      ['Feed current a rack', n(get('distribution.rack_feed_current_a')) + ' A', 'distribution.rack_feed_current_a'], ['TCS supply / return', n(TCS_S) + ' / ' + n(TCS_R) + ' °C', 'design.planes.p07 · p08']
    ].map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b><code>' + r[2] + '</code></div>'; }).join('');
    resize(); show('rack');
  }

  /* Load three.js on approach, then mount. */
  function boot() {
    var host = document.getElementById('hw3d'); if (!host) return;
    function go() {
      if (root.RZ3) return mount(host);
      var me = document.querySelector('script[src*="rz-hub-3d.js"]'), base = me ? me.src.replace(/rz-hub-3d\.js.*$/, '') : 'js/';
      var sc = document.createElement('script'); sc.src = base + 'vendor/three-r170.min.js?v=' + encodeURIComponent(root.RZ_VERSION || ''); sc.onload = function () { mount(host); };
      sc.onerror = function () { host.querySelector('.h3-stage').innerHTML = '<p class="h3-nogl">The 3D view could not load; the counts above stand on their own.</p>'; };
      document.head.appendChild(sc);
    }
    if ('IntersectionObserver' in root) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '600px 0px' }); io.observe(host); } else go();
  }
  root.RZHub3D = { PARTS: PARTS, GEOM: G, VIEWS: VIEWS, mount: mount };
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
})(typeof window !== 'undefined' ? window : this);
