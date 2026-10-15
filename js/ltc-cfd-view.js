/* LTC — DH01 CFD view: what js/ltc-dh01-3d.js draws from each js/ltc-cfd.js frame.
 *
 *   volume   the whole field, ray-marched on the GPU through a 3D texture of the cells (one texel per
 *            cell, trilinear between them): heat (air colour by temperature, opacity rising above a
 *            threshold, the contained hot aisles and plenum kept faint so escaped hot air stands
 *            out), isotherms (the 27 and 32 °C surfaces, lit by the temperature gradient), speed,
 *            turbulence intensity, or vorticity |∇×u|. A ray stops at a rack or CDU (solid cells),
 *            so what is behind a rack stays hidden; the ceiling slab is see-through like its glass.
 *   trails   particles advected through the solved velocity (RK2), each carrying a tail of where it
 *            was over the last second, coloured by the temperature it passed through: the air is
 *            seen leaving a fan wall cold, crossing a rack and arriving at the plenum hot.
 *   probe    the field at a point: temperature (time-averaged), speed, turbulence intensity,
 *            vorticity — the numbers behind the colours.
 *
 * Every number is read from the frame the solver posted; nothing is re-solved or smoothed here
 * beyond the trilinear interpolation stated above. */
(function (root) {
  'use strict';
  var T_LO = 18, T_HI = 45, SP_MAX = 4, TI_MAX = 0.6, TRAIL_N = 2400, TRAIL_K = 14, TRAIL_DT = 0.07, SMOKE_N = 1800, PUFF_N = 600, SMOKE_D = 0.01;

  /* field sampling, trilinear on the staggered grid the solver uses */
  function stg(A, sx, sy, sz, ox, oy, oz, x, y, z, d) {
    var fx = Math.max(0, Math.min(sx - 1.001, x / d - ox)), fy = Math.max(0, Math.min(sy - 1.001, y / d - oy)), fz = Math.max(0, Math.min(sz - 1.001, z / d - oz));
    var i = fx | 0, j = fy | 0, k = fz | 0, a = fx - i, b = fy - j, c = fz - k, o = i + sx * (j + sy * k), s1 = sx, s2 = sx * sy;
    return ((A[o] * (1 - a) + A[o + 1] * a) * (1 - b) + (A[o + s1] * (1 - a) + A[o + s1 + 1] * a) * b) * (1 - c) + ((A[o + s2] * (1 - a) + A[o + s2 + 1] * a) * (1 - b) + (A[o + s2 + s1] * (1 - a) + A[o + s2 + s1 + 1] * a) * b) * c;
  }
  function cellField(F, A, x, y, z) { return stg(A, F.nx, F.ny, F.nz, 0.5, 0.5, 0.5, x, y, z, F.dx); }
  function cellT(F, x, y, z) { return cellField(F, F.Tm || F.T, x, y, z); }
  function vel(F, x, y, z, o) {
    o[0] = stg(F.u, F.nx + 1, F.ny, F.nz, 0, 0.5, 0.5, x, y, z, F.dx); o[1] = stg(F.v, F.nx, F.ny + 1, F.nz, 0.5, 0, 0.5, x, y, z, F.dx); o[2] = stg(F.w, F.nx, F.ny, F.nz + 1, 0.5, 0.5, 0, x, y, z, F.dx);
    return o;
  }
  function solidAt(F, S, x, y, z) {
    if (!S) return false;
    var i = Math.floor(x / F.dx), j = Math.floor(y / F.dx), k = Math.floor(z / F.dx);
    if (i < 0 || j < 0 || k < 0 || i >= F.nx || j >= F.ny || k >= F.nz) return true;
    return !!S[i + F.nx * (j + F.ny * k)];
  }

  /* cell-centred velocity, and vorticity magnitude by central differences (one-sided at walls) */
  function centred(F) {
    var nx = F.nx, ny = F.ny, nz = F.nz, N = nx * ny * nz, U = new Float32Array(N * 3);
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var c = i + nx * (j + ny * k);
      U[c * 3] = 0.5 * (F.u[i + (nx + 1) * (j + ny * k)] + F.u[i + 1 + (nx + 1) * (j + ny * k)]);
      U[c * 3 + 1] = 0.5 * (F.v[i + nx * (j + (ny + 1) * k)] + F.v[i + nx * (j + 1 + (ny + 1) * k)]);
      U[c * 3 + 2] = 0.5 * (F.w[c] + F.w[c + nx * ny]);
    }
    return U;
  }
  function vorticity(F, S) {
    var nx = F.nx, ny = F.ny, nz = F.nz, U = centred(F), out = new Float32Array(nx * ny * nz), d = F.dx;
    function g(c, comp, axis, i, j, k) {              // ∂(comp)/∂(axis) at cell c
      var n = [nx, ny, nz][axis], p = [i, j, k][axis], st = [1, nx, nx * ny][axis];
      var lo = p > 0 && !(S && S[c - st]) ? c - st : c, hi = p < n - 1 && !(S && S[c + st]) ? c + st : c;
      return lo === hi ? 0 : (U[hi * 3 + comp] - U[lo * 3 + comp]) / (d * ((hi - lo) / st));
    }
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var c = i + nx * (j + ny * k); if (S && S[c]) continue;
      var ox = g(c, 2, 1, i, j, k) - g(c, 1, 2, i, j, k), oy = g(c, 0, 2, i, j, k) - g(c, 2, 0, i, j, k), oz = g(c, 1, 0, i, j, k) - g(c, 0, 1, i, j, k);
      out[c] = Math.sqrt(ox * ox + oy * oy + oz * oz);
    }
    return out;
  }
  function pct(A, S, q) {                             // q-quantile over fluid cells
    var a = []; for (var c = 0; c < A.length; c++) if (!(S && S[c])) a.push(A[c]);
    a.sort(function (x, y) { return x - y; }); return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0;
  }

  /* the point probe: what the colours at (x, y, z) are made of */
  function probe(F, S, ti, vort, x, y, z) {
    var o = vel(F, x, y, z, [0, 0, 0]);
    return { x: x, y: y, z: z, solid: solidAt(F, S, x, y, z), T: cellT(F, x, y, z), Ti: cellField(F, F.T, x, y, z), sp: Math.sqrt(o[0] * o[0] + o[1] * o[1] + o[2] * o[2]), u: o,
             ti: ti ? cellField(F, ti, x, y, z) : null, vort: vort ? cellField(F, vort, x, y, z) : null };
  }

  /* ------------------------------------------------------------------ volume */
  var VS = 'uniform vec3 uCam; out vec3 vOrigin; out vec3 vDir;\n' +
    'void main(){ vOrigin = uCam; vDir = position - uCam; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var FS = 'precision highp float; precision highp sampler3D;\n' +
    'in vec3 vOrigin; in vec3 vDir; out vec4 outColor;\n' +
    'uniform sampler3D uVol; uniform sampler2D uRamp; uniform int uMode; uniform vec3 uSize; uniform vec3 uCells;\n' +
    'uniform float uThr, uSup, uCont, uDen, uIso1, uIso2, uGain;\n' +
    'vec2 hitBox(vec3 o, vec3 d){ vec3 inv = 1.0 / d; vec3 t0 = (vec3(-0.5) - o) * inv, t1 = (vec3(0.5) - o) * inv; vec3 a = min(t0, t1), b = max(t0, t1); return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z)); }\n' +
    'float tN(float t){ return (t - ' + T_LO.toFixed(1) + ') / ' + (T_HI - T_LO).toFixed(1) + '; }\n' +
    'vec3 heat(float s){ return texture(uRamp, vec2(clamp(s, 0.0, 1.0), 0.5)).rgb; }\n' +
    'vec3 cool(float s){ s = clamp(s, 0.0, 1.0); return mix(mix(vec3(0.05, 0.12, 0.45), vec3(0.0, 0.75, 0.95), smoothstep(0.0, 0.45, s)), vec3(1.0, 0.95, 0.75), smoothstep(0.55, 1.0, s)); }\n' +
    'vec3 grad(vec3 p){ vec3 e = 1.0 / uCells; return vec3(texture(uVol, p + vec3(e.x, 0, 0)).r - texture(uVol, p - vec3(e.x, 0, 0)).r, texture(uVol, p + vec3(0, e.y, 0)).r - texture(uVol, p - vec3(0, e.y, 0)).r, texture(uVol, p + vec3(0, 0, e.z)).r - texture(uVol, p - vec3(0, 0, e.z)).r) / (e * uSize); }\n' +
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' +
    'void main(){\n' +
    '  vec3 d = normalize(vDir); vec2 b = hitBox(vOrigin, d); if (b.x > b.y) discard; b.x = max(b.x, 0.0);\n' +
    '  float dl = 0.5 / max(uCells.x, max(uCells.y, uCells.z)), metres = length(d * uSize) * dl;\n' +
    '  vec4 acc = vec4(0.0); float t = b.x + dl * hash(gl_FragCoord.xy), prevT = -1.0; bool prevC = false;\n' +
    '  for (int n = 0; n < 900; n++) {\n' +
    '    if (t > b.y || acc.a > 0.97) break;\n' +
    '    vec3 p = vOrigin + d * t + 0.5; vec4 s = texture(uVol, p); t += dl;\n' +
    '    float flag = s.a; if (flag < 0.15) break;                   /* rack or CDU: the ray stops */\n' +
    '    if (flag < 0.4) { prevT = -1.0; continue; }                 /* ceiling slab: see-through */\n' +
    '    bool cont = flag < 0.8; float Tc = ' + T_LO.toFixed(1) + ' + s.r * ' + (T_HI - T_LO).toFixed(1) + '; vec4 c = vec4(0.0);\n' +
    '    if (uMode == 0) {\n' +
    '      float hot = smoothstep(uThr, uThr + 5.0, Tc) * (cont ? uCont : 1.0), cold = (1.0 - smoothstep(uSup + 0.3, uSup + 1.5, Tc)) * smoothstep(0.12, 0.45, s.g) * 0.3;\n' +
    '      float a = 1.0 - exp(-uDen * metres * (hot * 1.3 + cold)); c = vec4(hot > cold ? heat(tN(Tc)) * (1.0 + hot) : heat(tN(Tc)) * 0.8, a);\n' +
    '    } else if (uMode == 1) {\n' +
    '      if (prevT > 0.0 && !cont && !prevC) {\n' +
    '        float iso = (prevT - uIso1) * (Tc - uIso1) < 0.0 ? uIso1 : (prevT - uIso2) * (Tc - uIso2) < 0.0 ? uIso2 : -1.0;\n' +
    '        if (iso > 0.0) { vec3 nrm = normalize(grad(p) + 1e-6); float lam = 0.35 + 0.65 * abs(dot(nrm, normalize(vec3(-0.4, 0.8, 0.45)))) + 0.35 * pow(1.0 - abs(dot(nrm, d)), 2.0);\n' +
    '          c = vec4(heat(tN(iso)) * lam * 1.3, iso == uIso2 ? 0.62 : 0.4); }\n' +
    '      }\n' +
    '    } else {\n' +
    '      float v = uMode == 2 ? s.g : s.b, a = smoothstep(0.3, 0.95, v) * (cont ? 0.3 : 1.0);\n' +
    '      c = vec4(cool(v) * (0.6 + v), 1.0 - exp(-uDen * metres * a * 1.2));\n' +
    '    }\n' +
    '    prevT = Tc; prevC = cont;\n' +
    '    c.rgb *= c.a * uGain; acc += (1.0 - acc.a) * c;\n' +
    '  }\n' +
    '  outColor = linearToOutputTexel(acc);\n' +
    '}';
  var MODES = { heat: 0, iso: 1, speed: 2, ti: 3, vort: 3 };

  function rampTex(T, ramp) {
    var n = 256, d = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) { var c = ramp(T_LO + (T_HI - T_LO) * i / (n - 1)); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    var t = new T.DataTexture(d, n, 1, T.RGBAFormat); t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t;
  }
  /* flags in alpha: 0 solid (stops the ray), 0.25 ceiling slab, 0.6 contained air, 1 room air */
  /* the texels: R temperature (T_LO…T_HI), G speed (0…SP_MAX), B turbulence intensity (0…TI_MAX) or
     vorticity (0…its 99.5th percentile), A the cell kind */
  function pack(F, mode, S, contained, vort, slab, D) {
    var N = F.nx * F.ny * F.nz, A = F.Tm || F.T, ch = mode === 'vort' ? vort : F.ti, chMax = mode === 'vort' ? Math.max(0.5, pct(vort || [], S, 0.995)) : TI_MAX, U = centred(F);
    D = D || new Uint8Array(N * 4);
    for (var c = 0; c < N; c++) {
      var o = c * 4, sp = Math.sqrt(U[c * 3] * U[c * 3] + U[c * 3 + 1] * U[c * 3 + 1] + U[c * 3 + 2] * U[c * 3 + 2]);
      D[o] = Math.max(0, Math.min(255, Math.round((A[c] - T_LO) / (T_HI - T_LO) * 255)));
      D[o + 1] = Math.min(255, Math.round(sp / SP_MAX * 255));
      D[o + 2] = ch ? Math.min(255, Math.round(ch[c] / chMax * 255)) : 0;
      D[o + 3] = S && S[c] ? (slab && slab[c] ? 64 : 0) : contained && contained[c] ? 153 : 255;
    }
    return { data: D, chMax: chMax };
  }
  function volume(V, F, mode, contained, vort, slab) {
    var T = root.RZ3, nx = F.nx, ny = F.ny, nz = F.nz, N = nx * ny * nz, S = V.cfdSolid;
    if (!V.vol || V.vol.userData.n !== N) {
      if (V.vol) { V.dyn.remove(V.vol); V.vol.material.uniforms.uVol.value.dispose(); V.vol.geometry.dispose(); }
      var tex = new T.Data3DTexture(new Uint8Array(N * 4), nx, ny, nz); tex.format = T.RGBAFormat; tex.type = T.UnsignedByteType; tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter; tex.unpackAlignment = 1;
      var m = new T.ShaderMaterial({ glslVersion: T.GLSL3, vertexShader: VS, fragmentShader: FS, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, side: T.BackSide,
        uniforms: { uVol: { value: tex }, uRamp: { value: V.rampTex || (V.rampTex = rampTex(T, V.ramp)) }, uMode: { value: 0 }, uCam: { value: new T.Vector3() }, uSize: { value: new T.Vector3(nx * F.dx, ny * F.dx, nz * F.dx) },
          uCells: { value: new T.Vector3(nx, ny, nz) }, uThr: { value: 27 }, uSup: { value: 24 }, uCont: { value: 0.035 }, uDen: { value: 0.9 }, uIso1: { value: 27 }, uIso2: { value: 32 }, uGain: { value: 1 } } });
      V.vol = new T.Mesh(new T.BoxGeometry(1, 1, 1), m); V.vol.scale.set(nx * F.dx, ny * F.dx, nz * F.dx); V.vol.position.set(0, ny * F.dx / 2, 0);
      V.vol.renderOrder = 2; V.vol.frustumCulled = false; V.vol.userData.n = N; V.dyn.add(V.vol);
    }
    var u = V.vol.material.uniforms, pk = pack(F, mode, S, contained, vort, slab, u.uVol.value.image.data), chMax = pk.chMax;
    u.uVol.value.needsUpdate = true; u.uMode.value = MODES[mode]; u.uSup.value = V.s ? V.s.supply : 24;
    V.vol.userData.mode = mode; V.vol.userData.chMax = chMax;
    return V.vol;
  }
  function volumeFrame(V) {                           // per animation frame: the camera in the box's unit space
    if (!V.vol || !V.vol.visible) return;
    var p = V.vol.material.uniforms.uCam.value; p.copy(V.cam.position); V.vol.worldToLocal(p);
  }

  /* ------------------------------------------------------------------ trails */
  function trails(V) {
    var T = root.RZ3, segs = TRAIL_N * (TRAIL_K - 1);
    if (V.trail) { V.dyn.remove(V.trail); V.trail.geometry.dispose(); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(segs * 6), 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(segs * 8), 4).setUsage(T.DynamicDrawUsage));
    V.trail = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    V.trail.frustumCulled = false; V.trail.renderOrder = 3; V.dyn.add(V.trail);
    V.tp = [];
    for (var n = 0; n < TRAIL_N; n++) V.tp.push({ h: new Float32Array(TRAIL_K * 3), c: new Float32Array(TRAIL_K * 3), age: 1e9, life: 1, rec: 0, still: 0 });
    return V.trail;
  }
  /* where a particle is born: a running fan face (supply), a rack's rear face (exhaust) or any fluid cell */
  function spawn(V, q) {
    var F = V.cfd, S = V.cfdSolid, L = F.nx * F.dx, W = F.nz * F.dx, H = F.ny * F.dx, h = V.r.hall, p = V.r.input, x, y, z;
    for (var tries = 0; tries < 24; tries++) {
      var r = Math.random(), alive = h.crahs.filter(function (c) { return !(V.s.crahOut || {})[c.i]; });
      if (r < 0.42 && alive.length) {
        var c = alive[(Math.random() * alive.length) | 0], uw = W / Math.ceil(h.crahs.length / 2);
        x = c.wall === 'west' ? 0.05 + Math.random() * 0.4 : L - 0.05 - Math.random() * 0.4; y = 0.1 + Math.random() * 2.4; z = c.y + (Math.random() - 0.5) * uw;
      } else if (r < 0.74) {
        var k = h.racks[(Math.random() * h.racks.length) | 0], ai = h.aisles[k.aisle], rear = ai.y1 <= k.y + 1e-9 ? k.y + p.rackDepthM + 0.08 : k.y - 0.08;
        x = k.x + Math.random() * p.rackPitchM; y = 0.1 + Math.random() * 1.8; z = rear;
      } else { x = Math.random() * L; y = Math.random() * H; z = Math.random() * W; }
      if (!solidAt(F, S, x, y, z)) break;
    }
    var t = cellT(F, x, y, z), col = V.col(t);
    for (var i = 0; i < TRAIL_K; i++) { q.h[i * 3] = x; q.h[i * 3 + 1] = y; q.h[i * 3 + 2] = z; q.c[i * 3] = col.r; q.c[i * 3 + 1] = col.g; q.c[i * 3 + 2] = col.b; }
    q.age = 0; q.life = 7 + Math.random() * 9; q.rec = 0; q.still = 0;
  }
  var tA = [0, 0, 0], tB = [0, 0, 0];
  function trailStep(V, dt) {
    var F = V.cfd; if (!F || !V.trail || !V.trail.visible) return;
    var S = V.cfdSolid, P = V.trail.geometry.attributes.position.array, Cc = V.trail.geometry.attributes.color.array, X0 = F.nx * F.dx / 2, Z0 = F.nz * F.dx / 2, K = TRAIL_K;
    for (var n = 0; n < V.tp.length; n++) {
      var q = V.tp[n], H = q.h, Cl = q.c;
      if (q.age > q.life || q.still > 2) spawn(V, q);
      if (dt > 0) {
        var x = H[0], y = H[1], z = H[2];
        vel(F, x, y, z, tA); vel(F, x + 0.5 * dt * tA[0], y + 0.5 * dt * tA[1], z + 0.5 * dt * tA[2], tB);
        x += dt * tB[0]; y += dt * tB[1]; z += dt * tB[2]; q.age += dt; q.rec += dt;
        var sp = Math.sqrt(tB[0] * tB[0] + tB[1] * tB[1] + tB[2] * tB[2]); q.still = sp < 0.04 ? q.still + dt : 0;
        if (solidAt(F, S, x, y, z)) { q.age = 1e9; continue; }
        if (q.rec >= TRAIL_DT) { q.rec = 0; H.copyWithin(3, 0, (K - 1) * 3); Cl.copyWithin(3, 0, (K - 1) * 3); }
        var col = V.col(cellT(F, x, y, z)); H[0] = x; H[1] = y; H[2] = z; Cl[0] = col.r; Cl[1] = col.g; Cl[2] = col.b;
      }
      var fade = Math.max(0, Math.min(1, q.age * 1.5, (q.life - q.age) * 1.5));
      for (var s = 0; s < K - 1; s++) {
        var o = (n * (K - 1) + s) * 6, oc = (n * (K - 1) + s) * 8, a = s * 3, b = a + 3, wa = fade * (1 - s / (K - 1)), wb = fade * (1 - (s + 1) / (K - 1));
        P[o] = H[a] - X0; P[o + 1] = H[a + 1]; P[o + 2] = H[a + 2] - Z0; P[o + 3] = H[b] - X0; P[o + 4] = H[b + 1]; P[o + 5] = H[b + 2] - Z0;
        Cc[oc] = Cl[a]; Cc[oc + 1] = Cl[a + 1]; Cc[oc + 2] = Cl[a + 2]; Cc[oc + 3] = wa * 0.9; Cc[oc + 4] = Cl[b]; Cc[oc + 5] = Cl[b + 1]; Cc[oc + 6] = Cl[b + 2]; Cc[oc + 7] = wb * 0.9;
      }
    }
    V.trail.geometry.attributes.position.needsUpdate = true; V.trail.geometry.attributes.color.needsUpdate = true;
  }

  /* smoke: a puff released where the user clicks, carried by the solved velocity (RK2) plus a small
     random walk (eddy diffusivity SMOKE_D m²/s) for the eddies a coarse grid cannot carry; it grows and
     fades over its life and takes a tint of the air it is in. Three puffs live at once. */
  function gauss() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(6.283185307 * Math.random()); }
  function smokeInit(V) {
    var T = root.RZ3, g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(SMOKE_N * 3), 3));
    g.setAttribute('aLife', new T.BufferAttribute(new Float32Array(SMOKE_N), 1));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(SMOKE_N * 3), 3));
    var m = new T.ShaderMaterial({ uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aLife; attribute vec3 color; varying float vL; varying vec3 vC; uniform float uScale; void main(){ vL = aLife; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aLife <= 0.0 ? 0.0 : clamp(uScale * (0.2 + 0.8 * (1.0 - aLife)) / -mv.z, 1.5, 96.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vL; varying vec3 vC; void main(){ if (vL <= 0.0) discard; vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; float a = (1.0 - r * 4.0) * min(1.0, vL * 3.0) * min(1.0, (1.0 - vL) * 12.0) * 0.42; gl_FragColor = vec4(mix(vec3(0.88, 0.9, 0.93), vC, 0.35), a); }' });
    V.smoke = new T.Points(g, m); V.smoke.frustumCulled = false; V.smoke.renderOrder = 5; V.dyn.add(V.smoke);
    V.sp = []; for (var n = 0; n < SMOKE_N; n++) V.sp.push({ x: 0, y: 0, z: 0, age: 0, life: 0 }); V.spNext = 0;
  }
  function smoke(V, x, y, z) {                       // x, y, z: solver metres (origin at the hall corner)
    if (!V.smoke) smokeInit(V);
    for (var n = 0; n < PUFF_N; n++) {
      var q = V.sp[V.spNext]; V.spNext = (V.spNext + 1) % SMOKE_N;
      q.x = x + 0.08 * gauss(); q.y = Math.max(0.05, y + 0.08 * gauss()); q.z = z + 0.08 * gauss(); q.age = -n * 0.004; q.life = 24 + 8 * Math.random();
    }
  }
  function smokeStep(V, dt) {
    var F = V.cfd; if (!V.smoke || !F) return;
    // a particle's world size (0.2 m growing to 1 m) in pixels: drawing-buffer height over the view's height at 1 m
    V.smoke.material.uniforms.uScale.value = V.renderer.domElement.height / (2 * Math.tan(V.cam.fov * Math.PI / 360));
    var S = V.cfdSolid, P = V.smoke.geometry.attributes.position.array, Lf = V.smoke.geometry.attributes.aLife.array, Cc = V.smoke.geometry.attributes.color.array,
      X0 = F.nx * F.dx / 2, Z0 = F.nz * F.dx / 2, rw = Math.sqrt(2 * SMOKE_D * Math.max(dt, 0)), H = F.ny * F.dx, any = false;
    for (var n = 0; n < SMOKE_N; n++) {
      var q = V.sp[n];
      if (q.life <= 0 || q.age > q.life) { Lf[n] = 0; continue; }
      any = true; q.age += dt;
      if (q.age < 0) { Lf[n] = 0; continue; }               // a puff is released over a moment, not all at once
      if (dt > 0) {
        vel(F, q.x, q.y, q.z, tA); vel(F, q.x + 0.5 * dt * tA[0], q.y + 0.5 * dt * tA[1], q.z + 0.5 * dt * tA[2], tB);
        var x = q.x + dt * tB[0] + rw * gauss(), y = Math.max(0.02, Math.min(H - 0.02, q.y + dt * tB[1] + rw * gauss())), z = q.z + dt * tB[2] + rw * gauss();
        if (solidAt(F, S, x, y, z)) { q.age = q.life + 1; Lf[n] = 0; continue; }   // drawn into a rack or a coil: gone
        q.x = x; q.y = y; q.z = z;
      }
      P[n * 3] = q.x - X0; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z - Z0; Lf[n] = Math.max(1e-3, 1 - q.age / q.life);
      var c = V.col(cellT(F, q.x, q.y, q.z)); Cc[n * 3] = c.r; Cc[n * 3 + 1] = c.g; Cc[n * 3 + 2] = c.b;
    }
    var g = V.smoke.geometry; g.attributes.position.needsUpdate = true; g.attributes.aLife.needsUpdate = true; g.attributes.color.needsUpdate = true;
    V.smoke.visible = any;
  }

  /* charts under the stage, pure SVG strings (CSS colour tokens, so both themes) */
  var MONO = ' font-family="JetBrains Mono, monospace" font-size="10"';
  function svgOpen(W, H, label) { return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '" style="width:100%;max-width:' + W + 'px">'; }
  function poly(pts, X, Y) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(''); }
  /* the solve settling: hottest and mean rack inlet, CRAH return, against simulated time; the balance
     solve's hottest inlet and the 27 °C recommended limit as references */
  function historySvg(H, bal, width) {
    if (!H || H.length < 2) return '';
    var W = Math.round(Math.max(300, Math.min(560, width || 560))), Ht = 180, L = 40, Rm = 14, T = 12, B = 42, t0 = H[0].t, t1 = H[H.length - 1].t;
    var vals = [27]; H.forEach(function (h) { vals.push(h.max, h.mean, h.ret); }); if (bal != null) vals.push(bal);
    var lo = Math.floor(Math.min.apply(null, vals) - 0.5), hi = Math.ceil(Math.max.apply(null, vals) + 0.5);
    var X = function (t) { return L + (t - t0) / Math.max(1e-9, t1 - t0) * (W - L - Rm); }, Y = function (v) { return T + (hi - v) / (hi - lo) * (Ht - T - B); };
    var g = [svgOpen(W, Ht, 'CFD rack inlets and return temperature against simulated time'), '<rect width="100%" height="100%" fill="var(--bg1)"/>'];
    var stp = hi - lo > 16 ? 5 : 2;
    for (var v = Math.ceil(lo / stp) * stp; v <= hi; v += stp) g.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--bd)"/><text x="' + (L - 5) + '" y="' + (Y(v) + 3.5).toFixed(1) + '"' + MONO + ' fill="var(--t3)" text-anchor="end">' + v + '</text>');
    var ts = t1 - t0 > 150 ? 50 : t1 - t0 > 60 ? 20 : 10;
    for (var t = Math.ceil(t0 / ts) * ts; t <= t1; t += ts) g.push('<text x="' + X(t).toFixed(1) + '" y="' + (Ht - B + 13) + '"' + MONO + ' fill="var(--t3)" text-anchor="middle">' + t + '</text>');
    g.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(27).toFixed(1) + '" y2="' + Y(27).toFixed(1) + '" stroke="var(--o)" stroke-dasharray="2 3"/>');
    if (t0 < 0 && t1 > 0) g.push('<line x1="' + X(0).toFixed(1) + '" x2="' + X(0).toFixed(1) + '" y1="' + T + '" y2="' + (Ht - B) + '" stroke="var(--t2)"/><text x="' + (X(0) + 4).toFixed(1) + '" y="' + (T + 10) + '"' + MONO + ' fill="var(--t2)">fault</text>');
    if (bal != null) g.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(bal).toFixed(1) + '" y2="' + Y(bal).toFixed(1) + '" stroke="var(--r)" stroke-dasharray="5 3"/><text x="' + (W - Rm - 2) + '" y="' + (Y(bal) + 12).toFixed(1) + '"' + MONO + ' fill="var(--r)" text-anchor="end">balance solve, hottest ' + bal.toFixed(1) + '</text>');
    [['max', 'var(--r)', 1.6], ['mean', 'var(--c)', 1.4], ['ret', 'var(--t2)', 1.2]].forEach(function (k) {
      g.push('<path d="' + poly(H.map(function (h) { return [h.t, h[k[0]]]; }), X, Y) + '" fill="none" stroke="' + k[1] + '" stroke-width="' + k[2] + '"/>');
    });
    var e = H[H.length - 1];
    g.push('<text x="' + L + '" y="' + (Ht - 16) + '"' + MONO + ' fill="var(--t3)">' + (t0 < 0 ? 'seconds after the fault' : 'seconds simulated') + ' · 27 °C dotted</text>',
      '<text x="' + L + '" y="' + (Ht - 3) + '"' + MONO + ' fill="var(--t3)"><tspan fill="var(--r)">hottest inlet ' + e.max.toFixed(1) + '</tspan> · <tspan fill="var(--c)">mean ' + e.mean.toFixed(1) + '</tspan> · return ' + e.ret.toFixed(1) + ' °C</text></svg>');
    return g.join('');
  }
  /* rack by rack: the CFD inlet (time-averaged) against the balance solve's, 1 : 1 diagonal, the 27 °C
     limit on both axes; each dot carries its rack index for the shared tooltip */
  function scatterStats(cfd, bal) {
    var n = cfd.length, se = 0, hot = 0, both = 0, onlyC = 0, onlyB = 0;
    for (var i = 0; i < n; i++) { var d = cfd[i] - bal[i]; se += d * d; if (d > 0) hot++; var c = cfd[i] > 27, b = bal[i] > 27; if (c && b) both++; else if (c) onlyC++; else if (b) onlyB++; }
    return { rms: Math.sqrt(se / Math.max(1, n)), cfdHotter: hot, both: both, onlyCfd: onlyC, onlyBal: onlyB, n: n };
  }
  function scatterSvg(cfd, bal, ramp) {
    if (!cfd || !bal || !cfd.length) return '';
    var W = 330, H = 300, L = 40, Rm = 12, T = 12, B = 44, all = cfd.concat(bal, [27]);
    var lo = Math.floor(Math.min.apply(null, all) - 0.5), hi = Math.ceil(Math.max.apply(null, all) + 0.5);
    var X = function (v) { return L + (v - lo) / (hi - lo) * (W - L - Rm); }, Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); }, st = scatterStats(cfd, bal);
    var g = [svgOpen(W, H, 'Rack inlet, CFD against the balance solve'), '<rect width="100%" height="100%" fill="var(--bg1)"/>'], stp = hi - lo > 16 ? 5 : 2;
    for (var v = Math.ceil(lo / stp) * stp; v <= hi; v += stp) {
      g.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--bd)"/><text x="' + (L - 5) + '" y="' + (Y(v) + 3.5).toFixed(1) + '"' + MONO + ' fill="var(--t3)" text-anchor="end">' + v + '</text>');
      g.push('<text x="' + X(v).toFixed(1) + '" y="' + (H - B + 13) + '"' + MONO + ' fill="var(--t3)" text-anchor="middle">' + v + '</text>');
    }
    g.push('<line x1="' + X(lo) + '" y1="' + Y(lo) + '" x2="' + X(hi) + '" y2="' + Y(hi) + '" stroke="var(--t3)" stroke-dasharray="4 3"/>',
      '<line x1="' + X(27).toFixed(1) + '" x2="' + X(27).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--o)" stroke-dasharray="2 3"/>',
      '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(27).toFixed(1) + '" y2="' + Y(27).toFixed(1) + '" stroke="var(--o)" stroke-dasharray="2 3"/>');
    cfd.forEach(function (c, i) { var col = ramp(c); g.push('<circle data-rack="' + i + '" cx="' + X(bal[i]).toFixed(1) + '" cy="' + Y(c).toFixed(1) + '" r="3.4" fill="rgb(' + col.join(',') + ')" stroke="var(--bg1)" stroke-width="0.6"/>'); });
    g.push('<text x="' + L + '" y="' + (H - B + 27) + '"' + MONO + ' fill="var(--t3)">x balance solve · y CFD (°C) · RMS ' + st.rms.toFixed(1) + ' K</text>',
      '<text x="' + L + '" y="' + (H - 5) + '"' + MONO + ' fill="var(--t3)">&gt; 27 °C: both ' + st.both + ' · CFD only ' + st.onlyCfd + ' · balance only ' + st.onlyBal + '</text></svg>');
    return g.join('');
  }

  /* guided tour: camera keyframes (scene metres, hall centred) with captions read off this solve, and
     a smoke release at the hottest rack's top front. Pure: hall geometry, balance solve and CFD report in. */
  function tourPlan(r, s, rep, o) {
    var h = r.hall, p = r.input, L = h.lengthM, W = h.widthM, H = h.heightM, X0 = L / 2, Z0 = W / 2, dep = p.rackDepthM, pitch = p.rackPitchM, f1 = function (v) { return v.toFixed(1); };
    var inl = rep && rep.inletMean && rep.inletMean.length === h.racks.length ? rep.inletMean : s.racks.map(function (k) { return k.inlet; }), src = rep && rep.inletMean ? 'CFD' : 'balance solve';
    var hi = 0; inl.forEach(function (t, i) { if (t > inl[hi]) hi = i; });
    var k = h.racks[hi], ai = h.aisles[k.aisle], az = (ai.y0 + ai.y1) / 2, front = ai.y1 <= k.y + 1e-9 ? k.y : k.y + dep, toward = az < front ? -1 : 1, xc = k.x + pitch / 2;
    var row = h.rowsY[k.row], hz = row.hotY0 + p.hotAisleM / 2, inA = inl.filter(function (t, i) { return h.racks[i].aisle === k.aisle; });
    var prof = rep && rep.profile && rep.profile[hi], band = function (y) { if (!prof) return null; var f = y / rep.profDy - 0.5, j = Math.max(0, Math.min(prof.length - 1, Math.floor(f))), a = Math.max(0, Math.min(1, f - j)); return j + 1 < prof.length ? prof[j] * (1 - a) + prof[j + 1] * a : prof[j]; };
    var rowEx = s.racks.filter(function (q) { return h.rowsY[q.row].hotY0 === row.hotY0; }), exM = rowEx.reduce(function (a, q) { return a + q.exhaust; }, 0) / rowEx.length;
    var t27 = rep && rep.t27 ? rep.t27 : null, tc = t27 ? t27.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; }) : [], dead = s.crahOut ? Object.keys(s.crahOut).length : 0, X = function (x) { return x - X0; }, Z = function (z) { return z - Z0; }, idx = rep && rep.idx;
    var steps = [
      { p: [L * 0.62, Math.max(L, W) * 0.78, W * 0.95], t: [0, 0.8, 0], caption: (o && o.fault ? o.fault + ' · ' : '') + 'hottest rack inlet ' + f1(inl[hi]) + ' °C at rack ' + ((k.i != null ? k.i : hi) + 1) + ', row ' + (k.row + 1) + ' (' + src + ')' + (idx ? ' · RCI HI ' + idx.rciHi.toFixed(0) + ' % · RTI ' + idx.rti.toFixed(0) + ' %' : '') },
      { p: [X(0.8), 1.6, Z(az)], t: [X(L), 1.1, Z(az)], caption: 'Cold aisle ' + (k.aisle + 1) + ': supply enters from both fan walls; its rack inlets run ' + f1(Math.min.apply(null, inA)) + '–' + f1(Math.max.apply(null, inA)) + ' °C (' + src + ')' },
      { p: [X(xc + 5), 1.9, Z(az + toward * 0.3)], t: [X(xc), 1.6, Z(front)], smoke: [xc, Math.min(2.15, H - 0.2), front + toward * 0.25], caption: 'Rack ' + ((k.i != null ? k.i : hi) + 1) + ': inlet ' + f1(inl[hi]) + ' °C' + (prof ? ', bottom · middle · top ' + [1, 3, 5].map(function (q) { return f1(band(2 * q / 6)); }).join(' · ') + ' °C' : '') + (t27 && t27[hi] != null ? '; over 27 °C ' + f1(t27[hi]) + ' s after the fault' : '') + '. Smoke released at its top front: watch where it goes' },
      { p: [X(xc + 3), 3.6, Z(hz)], t: [X(xc - 4), 1.0, Z(hz)], caption: 'Hot aisle behind row ' + (k.row + 1) + ', contained up to the ceiling: exhaust averages ' + f1(exM) + ' °C on its way to the plenum' },
      { p: [X(-2), H - 0.3, Z(1)], t: [X(L), H - 0.6, Z(W)], caption: 'Ceiling plenum: return to the CRAH coils at ' + f1(rep && rep.ret != null ? rep.ret : s.returnC) + ' °C, supply ' + f1(rep && rep.supply != null ? rep.supply : s.supply) + ' °C' + (dead ? ' · ' + dead + ' CRAH' + (dead > 1 ? 's' : '') + ' out' : '') },
      { p: [L * 0.62, Math.max(L, W) * 0.78, W * 0.95], t: [0, 0.8, 0], caption: (rep && rep.over27 != null ? rep.over27 + ' racks over 27 °C in the CFD, ' : '') + s.over27 + ' in the balance solve' + (tc.length ? ' · after the fault the first rack crossed 27 °C at ' + f1(tc[0]) + ' s' + (tc.length > 3 ? ', half of the ' + tc.length + ' that crossed by ' + tc[tc.length >> 1].toFixed(0) + ' s' : '') : '') + ' · drag to explore, click to release smoke anywhere' }
    ];
    steps.forEach(function (q, i) { q.d = i ? 2600 : 1200; q.hold = q.smoke ? 7000 : 4200; });
    return { rack: hi, steps: steps };
  }

  root.LTCCFDView = { cellT: cellT, cellField: cellField, vel: vel, solidAt: solidAt, centred: centred, vorticity: vorticity, pct: pct, probe: probe, pack: pack,
    volume: volume, volumeFrame: volumeFrame, trails: trails, trailStep: trailStep, smoke: smoke, smokeStep: smokeStep, historySvg: historySvg, tourPlan: tourPlan, scatterSvg: scatterSvg, scatterStats: scatterStats, SMOKE_N: SMOKE_N, SMOKE_D: SMOKE_D, PUFF_N: PUFF_N, T_LO: T_LO, T_HI: T_HI, SP_MAX: SP_MAX, TI_MAX: TI_MAX, TRAIL_N: TRAIL_N, TRAIL_K: TRAIL_K };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LTCCFDView;
})(typeof window !== 'undefined' ? window : globalThis);
