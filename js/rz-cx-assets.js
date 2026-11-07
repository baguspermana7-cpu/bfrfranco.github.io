/* rz-cx-assets.js — equipment shapes for the Cx campus (PRD v1.1 §11). One merged, vertex-coloured
 * BufferGeometry per equipment family, built from three.js primitives inside the family's declared footprint
 * (metres, y from the floor), so a unit reads as the machine it stands for: a screw chiller with its two shells
 * and compressors, an end-suction pump set, a V-bank dry cooler with its fans, a containerised genset with its
 * stack and silencer, a power transformer with radiator banks and bushings, a 150 kV bay with post insulators.
 * The campus keeps ONE InstancedMesh (one draw call) per family; vertex colours are grey factors (1 = body)
 * that the per-instance status tint multiplies, so the handbook tag stays the hue. Proportions are representative
 * (typical catalogue shapes), not a vendor drawing. ES5; runs in Node under a vm-loaded RZ3 for the gate.
 *   RZCxAssets.build(T, type, w, h, d) → BufferGeometry (position · normal · color · index)
 *   RZCxAssets.TYPES → the family ids the campus draws · RZCxAssets.version */
(function (root) {
  'use strict';
  var BODY = 1.0, LIGHT = 0.88, DETAIL = 0.72, GLASS = 0.6, FRAME = 0.42, DARK = 0.3, VENT = 0.25;
  var SEG = 14;

  function builder(T) {
    var parts = [];
    function mat(x, y, z, rx, ry, rz) { var o = new T.Object3D(); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); o.updateMatrix(); return o.matrix; }
    /* box of w × h × d centred at (x, y, z); y is the CENTRE height */
    function box(w, h, d, x, y, z, shade, ry) { parts.push({ geo: new T.BoxGeometry(w, h, d), m: mat(x, y, z, 0, ry || 0, 0), shade: shade }); }
    /* cylinder (rTop, rBottom, length) centred at (x, y, z) along axis 'y' (default), 'x' or 'z' */
    function cyl(rt, rb, len, x, y, z, shade, axis, seg) {
      var rx = axis === 'z' ? Math.PI / 2 : 0, rz = axis === 'x' ? Math.PI / 2 : 0;
      parts.push({ geo: new T.CylinderGeometry(rt, rb, len, seg || SEG), m: mat(x, y, z, rx, 0, rz), shade: shade });
    }
    function tilted(w, h, d, x, y, z, rx, shade) { parts.push({ geo: new T.BoxGeometry(w, h, d), m: mat(x, y, z, rx, 0, 0), shade: shade }); }
    function merge() {
      var pos = [], nor = [], col = [], idx = [], base = 0;
      for (var p = 0; p < parts.length; p++) {
        var g = parts[p].geo, sh = parts[p].shade; g.applyMatrix4(parts[p].m);
        var pa = g.attributes.position, na = g.attributes.normal, ia = g.index;
        for (var i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); nor.push(na.getX(i), na.getY(i), na.getZ(i)); col.push(sh, sh, sh); }
        if (ia) for (var j = 0; j < ia.count; j++) idx.push(ia.getX(j) + base); else for (var k = 0; k < pa.count; k++) idx.push(k + base);
        base += pa.count; g.dispose();
      }
      var out = new T.BufferGeometry();
      out.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      out.setAttribute('normal', new T.BufferAttribute(new Float32Array(nor), 3));
      out.setAttribute('color', new T.BufferAttribute(new Float32Array(col), 3));
      out.setIndex(idx); out.computeBoundingBox(); out.computeBoundingSphere(); return out;
    }
    return { box: box, cyl: cyl, tilted: tilted, merge: merge };
  }

  /* Cabinet idiom shared by the indoor families: plinth, body, a darker front panel. */
  function cabinet(B, w, h, d, panelShade, panelInset) {
    B.box(w, 0.1, d, 0, 0.05, 0, DARK);
    B.box(w, h - 0.1, d - 0.04, 0, 0.1 + (h - 0.1) / 2, -0.02, BODY);
    B.box(w - panelInset, h - 0.4, 0.04, 0, 0.1 + (h - 0.1) / 2, d / 2 - 0.02, panelShade);
  }

  var SHAPES = {
    /* IT rack: cabinet, perforated front door, top cap */
    racks: function (B, w, h, d) { cabinet(B, w, h, d, FRAME, 0.08); B.box(w, 0.04, d, 0, h - 0.02, 0, FRAME); },
    /* CDU: cabinet, display, two pipe stubs (supply / return) at the top rear */
    cdu: function (B, w, h, d) {
      cabinet(B, w, h, d, FRAME, 0.1); B.box(0.4, 0.22, 0.03, 0, h - 0.4, d / 2 + 0.005, VENT);
      B.cyl(0.08, 0.08, 0.4, -0.25, h - 0.05, -d / 4, DETAIL); B.cyl(0.08, 0.08, 0.4, 0.25, h - 0.05, -d / 4, DETAIL);
    },
    /* CRAH / fan wall: cabinet, top plenum, three fans in the face, a filter strip */
    crah: function (B, w, h, d) {
      cabinet(B, w, h, d, LIGHT, 0.1); B.box(w, 0.5, d, 0, h - 0.25, 0, DETAIL);
      for (var i = -1; i <= 1; i++) { B.cyl(0.32, 0.32, 0.08, i * (w / 3), h * 0.42, d / 2, DARK, 'z'); B.cyl(0.08, 0.08, 0.1, i * (w / 3), h * 0.42, d / 2 + 0.02, DETAIL, 'z', 8); }
      B.box(w - 0.2, 0.3, 0.03, 0, 0.35, d / 2 + 0.01, VENT);
    },
    /* UPS module: cabinet, two vent slots, status strip */
    ups: function (B, w, h, d) {
      cabinet(B, w, h, d, GLASS, 0.1); B.box(w - 0.3, 0.12, 0.03, 0, 0.5, d / 2 + 0.01, VENT); B.box(w - 0.3, 0.12, 0.03, 0, 0.8, d / 2 + 0.01, VENT);
      B.box(w - 0.4, 0.06, 0.02, 0, h - 0.3, d / 2 + 0.01, BODY);
    },
    /* cast-resin unit substation: enclosure on a plinth, louvres both long faces, three bushings on top */
    unit_subs: function (B, w, h, d) {
      B.box(w, 0.15, d, 0, 0.075, 0, DARK); B.box(w, h - 0.45, d, 0, 0.15 + (h - 0.45) / 2, 0, BODY);
      B.box(w - 0.4, 0.9, 0.03, 0, h * 0.45, d / 2 + 0.01, VENT); B.box(w - 0.4, 0.9, 0.03, 0, h * 0.45, -d / 2 - 0.01, VENT);
      for (var i = -1; i <= 1; i++) B.cyl(0.1, 0.12, 0.3, i * 0.6, h - 0.15, 0, DETAIL);
    },
    /* LV switchboard: two doors with handles, busbar trunking along the top rear */
    lv_busway: function (B, w, h, d) {
      B.box(w, 0.1, d, 0, 0.05, 0, DARK); B.box(w, h - 0.1, d - 0.04, 0, 0.1 + (h - 0.1) / 2, -0.02, BODY);
      B.box(w / 2 - 0.1, h - 0.5, 0.03, -w / 4, 0.1 + (h - 0.1) / 2, d / 2 - 0.005, GLASS); B.box(w / 2 - 0.1, h - 0.5, 0.03, w / 4, 0.1 + (h - 0.1) / 2, d / 2 - 0.005, GLASS);
      B.box(0.04, 0.2, 0.04, -0.06, h * 0.5, d / 2 + 0.02, VENT); B.box(0.04, 0.2, 0.04, 0.06, h * 0.5, d / 2 + 0.02, VENT);
      B.box(w, 0.3, 0.3, 0, h - 0.15, -d / 2 + 0.15, FRAME);
    },
    /* BMS / EPMS / OT rack: glass door */
    bms: function (B, w, h, d) { cabinet(B, w, h, d, GLASS, 0.1); B.box(w, 0.04, d, 0, h - 0.02, 0, FRAME); B.box(0.04, 0.3, 0.04, w / 2 - 0.1, h * 0.5, d / 2 + 0.02, VENT); },
    /* fire: wall panel on a post, two clean-agent cylinders with valves (agent not named — project selection pending) */
    fire: function (B, w, h, d) {
      B.box(0.12, h - 0.5, 0.12, -w / 2 + 0.3, (h - 0.5) / 2, 0, FRAME); B.box(0.55, 0.8, 0.22, -w / 2 + 0.3, h - 0.45, 0, BODY); B.box(0.3, 0.2, 0.02, -w / 2 + 0.3, h - 0.35, 0.12, VENT);
      B.cyl(0.18, 0.18, h - 0.35, w / 2 - 0.65, (h - 0.35) / 2, 0, DETAIL); B.cyl(0.18, 0.18, h - 0.35, w / 2 - 0.22, (h - 0.35) / 2, 0, DETAIL);
      B.cyl(0.07, 0.07, 0.18, w / 2 - 0.65, h - 0.26, 0, FRAME, 'y', 8); B.cyl(0.07, 0.07, 0.18, w / 2 - 0.22, h - 0.26, 0, FRAME, 'y', 8);
    },
    /* water-cooled screw chiller: skid, condenser + evaporator shells side by side, two compressors on top,
     * control panel at one end, four flanged nozzles */
    chillers: function (B, w, h, d) {
      var L = w * 0.84, r = Math.min(0.5, d * 0.22);
      B.box(w, 0.2, d, 0, 0.1, 0, DARK);
      B.cyl(r, r, L, 0, 0.2 + r + 0.05, -r - 0.08, BODY, 'x', 18); B.cyl(r, r, L, 0, 0.2 + r + 0.05, r + 0.08, BODY, 'x', 18);
      for (var s = -1; s <= 1; s += 2) { B.cyl(r + 0.03, r + 0.03, 0.12, s * (L / 2 - 0.1), 0.2 + r + 0.05, -r - 0.08, FRAME, 'x', 18); B.cyl(r + 0.03, r + 0.03, 0.12, s * (L / 2 - 0.1), 0.2 + r + 0.05, r + 0.08, FRAME, 'x', 18); }
      var yc = 0.2 + 2 * r + 0.4;
      B.box(w * 0.6, 0.25, 0.9, 0, yc - 0.32, 0, FRAME);
      B.cyl(0.3, 0.3, 1.5, -w * 0.22, yc, 0, DETAIL, 'x'); B.cyl(0.3, 0.3, 1.5, w * 0.22, yc, 0, DETAIL, 'x');
      B.cyl(0.22, 0.22, 0.6, -w * 0.22 - 1.0, yc, 0, FRAME, 'x'); B.cyl(0.22, 0.22, 0.6, w * 0.22 + 1.0, yc, 0, FRAME, 'x');
      B.box(0.45, 1.3, 0.9, -w / 2 + 0.25, 0.2 + 0.65, 0, FRAME);
      for (var i = 0; i < 4; i++) { var nx = (i < 2 ? -1 : 1) * (L / 2 - 0.45), nz = (i % 2 ? 1 : -1) * (r + 0.08); B.cyl(0.16, 0.16, 0.55, nx, 0.2 + 2 * r + 0.2, nz, DETAIL, 'y', 10); B.cyl(0.24, 0.24, 0.07, nx, 0.2 + 2 * r + 0.45, nz, FRAME, 'y', 10); }
    },
    /* end-suction pump set: baseplate, motor with fan cowl, coupling guard, volute, suction + discharge nozzles */
    fws: function (B, w, h, d) {
      var y = h * 0.42;
      B.box(w - 0.2, 0.12, d - 0.2, 0, 0.06, 0, DARK);
      B.box(0.5, y - 0.3, 0.3, 0, 0.12 + (y - 0.3) / 2, d * 0.2, FRAME); B.box(0.6, y - 0.4, 0.35, 0, 0.12 + (y - 0.4) / 2, -d * 0.25, FRAME);
      B.cyl(0.3, 0.3, d * 0.42, 0, y, d * 0.22, BODY, 'z'); B.cyl(0.33, 0.33, 0.14, 0, y, d * 0.46, FRAME, 'z');
      B.box(0.36, 0.36, 0.3, 0, y, -0.05, FRAME);
      B.cyl(0.4, 0.4, 0.32, 0, y, -d * 0.25, BODY, 'z'); B.cyl(0.28, 0.28, 0.1, 0, y, -d * 0.25 - 0.2, FRAME, 'z');
      B.cyl(0.15, 0.15, 0.5, 0, y, -d * 0.25 - 0.45, DETAIL, 'z', 10); B.cyl(0.21, 0.21, 0.06, 0, y, -d * 0.25 - 0.7, FRAME, 'z', 10);
      B.cyl(0.13, 0.13, 0.45, 0, y + 0.4 + 0.22, -d * 0.25, DETAIL, 'y', 10); B.cyl(0.19, 0.19, 0.06, 0, y + 0.4 + 0.45, -d * 0.25, FRAME, 'y', 10);
    },
    /* V-bank dry cooler: legs, two inclined coil panels, fan deck, three fans with hubs */
    dry_coolers: function (B, w, h, d) {
      var legH = 0.8, tilt = 28 * Math.PI / 180, ph = h - legH - 0.2, pz = 0.15 + (ph / 2) * Math.sin(tilt), py = legH + (ph / 2) * Math.cos(tilt);
      for (var i = 0; i < 4; i++) B.box(0.12, legH, 0.12, (i % 2 ? 1 : -1) * (w / 2 - 0.1), legH / 2, (i < 2 ? -1 : 1) * (d / 2 - 0.1), FRAME);
      B.box(w, 0.1, d, 0, legH, 0, FRAME);
      B.tilted(w - 0.2, ph, 0.12, 0, py, -pz, -tilt, DETAIL); B.tilted(w - 0.2, ph, 0.12, 0, py, pz, tilt, DETAIL);
      B.box(w - 0.2, 0.1, d - 0.1, 0, legH + ph * Math.cos(tilt) + 0.05, 0, FRAME);
      var fy = legH + ph * Math.cos(tilt) + 0.16, n = Math.max(2, Math.round(w / 1.3));
      for (var f = 0; f < n; f++) { var fx = -w / 2 + 0.1 + (f + 0.5) * ((w - 0.2) / n); B.cyl(0.5, 0.5, 0.12, fx, fy, 0, DARK, 'y', 18); B.cyl(0.12, 0.12, 0.2, fx, fy + 0.06, 0, DETAIL, 'y', 8); }
    },
    /* containerised genset: plinth, container, side louvres, roof silencer + exhaust stack, radiator discharge grille, end door */
    generators: function (B, w, h, d) {
      var L = d - 0.4, ch = h - 0.9;
      B.box(w, 0.2, L, 0, 0.1, 0, DARK); B.box(w, ch, L, 0, 0.2 + ch / 2, 0, BODY);
      for (var i = -1; i <= 1; i++) { B.box(0.03, ch * 0.55, L * 0.2, -w / 2 - 0.01, 0.2 + ch / 2, i * L * 0.3, VENT); B.box(0.03, ch * 0.55, L * 0.2, w / 2 + 0.01, 0.2 + ch / 2, i * L * 0.3, VENT); }
      B.box(w - 0.4, 0.14, L * 0.16, 0, 0.2 + ch + 0.07, L * 0.36, DARK);
      B.cyl(0.3, 0.3, L * 0.22, w * 0.2, 0.2 + ch + 0.3, -L * 0.22, FRAME, 'z');
      B.cyl(0.16, 0.16, 0.7, w * 0.2, 0.2 + ch + 0.65, -L * 0.36, FRAME, 'y', 10); B.cyl(0.26, 0.26, 0.06, w * 0.2, 0.2 + ch + 1.02, -L * 0.36, DARK, 'y', 10);
      B.box(w * 0.5, ch * 0.75, 0.04, 0, 0.2 + ch * 0.42, -L / 2 - 0.01, GLASS);
    },
    /* 150 kV AIS bay: portal, three phases of pedestal + post insulator + CT drum, a bus crossbar */
    hv_intake: function (B, w, h, d) {
      B.box(0.2, h - 0.2, 0.2, -w / 2 + 0.1, (h - 0.2) / 2, 0, FRAME); B.box(0.2, h - 0.2, 0.2, w / 2 - 0.1, (h - 0.2) / 2, 0, FRAME); B.box(w, 0.2, 0.2, 0, h - 0.1, 0, FRAME);
      for (var i = -1; i <= 1; i++) {
        var z = i * (d / 2 - 0.3);
        B.box(0.5, 1.6, 0.5, 0, 0.8, z, FRAME); B.cyl(0.14, 0.18, h * 0.45, 0, 1.6 + h * 0.225, z, LIGHT, 'y', 10);
        B.cyl(0.3, 0.3, 0.7, 0, 1.6 + h * 0.45 + 0.35, z, DETAIL, 'y', 12); B.cyl(0.1, 0.1, 0.35, 0, 1.6 + h * 0.45 + 0.85, z, FRAME, 'y', 8);
      }
    },
    /* power transformer: rails, tank, radiator banks both long sides with headers, conservator, HV + LV bushings */
    main_tx: function (B, w, h, d) {
      var tw = w * 0.56, th = h * 0.62, td = d * 0.6, y0 = 0.25;
      B.box(w * 0.9, 0.25, 0.3, 0, 0.125, -d * 0.3, DARK); B.box(w * 0.9, 0.25, 0.3, 0, 0.125, d * 0.3, DARK);
      B.box(tw, th, td, 0, y0 + th / 2, 0, BODY); B.box(tw + 0.1, 0.15, td + 0.1, 0, y0 + th + 0.075, 0, FRAME);
      var fins = 7, fw = tw - 0.4;
      for (var s = -1; s <= 1; s += 2) {
        for (var i = 0; i < fins; i++) B.box(0.06, th * 0.8, 0.85, -fw / 2 + i * (fw / (fins - 1)), y0 + th / 2, s * (td / 2 + 0.45), DETAIL);
        B.cyl(0.08, 0.08, fw + 0.2, 0, y0 + th * 0.88, s * (td / 2 + 0.8), FRAME, 'x', 8); B.cyl(0.08, 0.08, fw + 0.2, 0, y0 + th * 0.12, s * (td / 2 + 0.8), FRAME, 'x', 8);
      }
      B.cyl(0.42, 0.42, tw * 0.9, 0, y0 + th + 0.6, -td * 0.25, BODY, 'x', 16); B.box(0.2, 0.5, 0.2, -tw * 0.3, y0 + th + 0.25, -td * 0.25, FRAME); B.box(0.2, 0.5, 0.2, tw * 0.3, y0 + th + 0.25, -td * 0.25, FRAME);
      for (var p = -1; p <= 1; p++) {
        B.cyl(0.1, 0.17, h - y0 - th - 0.2, p * tw * 0.3, y0 + th + (h - y0 - th - 0.2) / 2, td * 0.28, LIGHT, 'y', 10); B.cyl(0.12, 0.12, 0.1, p * tw * 0.3, h - 0.15, td * 0.28, FRAME, 'y', 8);
        B.cyl(0.08, 0.12, 0.7, p * tw * 0.3, y0 + th + 0.5, td * 0.02, LIGHT, 'y', 8);
      }
    },
    /* 20 kV GIS hall: plinth, hall, roof slab with overhang, louvre strips, a door */
    mv_board: function (B, w, h, d) {
      B.box(w, 0.15, d, 0, 0.075, 0, DARK); B.box(w, h - 0.45, d, 0, 0.15 + (h - 0.45) / 2, 0, BODY); B.box(w + 0.4, 0.3, d + 0.4, 0, h - 0.15, 0, FRAME);
      for (var i = 0; i < 4; i++) B.box(w * 0.14, h * 0.35, 0.04, -w * 0.36 + i * w * 0.24, h * 0.55, d / 2 + 0.01, VENT);
      B.box(1.6, 2.4, 0.05, w * 0.38, 1.35, d / 2 + 0.01, GLASS);
    }
  };
  var TYPES = []; for (var k in SHAPES) if (SHAPES.hasOwnProperty(k)) TYPES.push(k);

  function build(T, type, w, h, d) {
    var make = SHAPES[type]; if (!make || !T) return null;
    var B = builder(T); make(B, w, h, d); return B.merge();
  }
  root.RZCxAssets = { build: build, TYPES: TYPES, version: '3.26.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RZCxAssets;
})(typeof window !== 'undefined' ? window : this);
