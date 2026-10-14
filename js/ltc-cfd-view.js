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
  var T_LO = 18, T_HI = 45, SP_MAX = 4, TI_MAX = 0.6, TRAIL_N = 2400, TRAIL_K = 14, TRAIL_DT = 0.07;

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

  root.LTCCFDView = { cellT: cellT, cellField: cellField, vel: vel, solidAt: solidAt, centred: centred, vorticity: vorticity, pct: pct, probe: probe, pack: pack,
    volume: volume, volumeFrame: volumeFrame, trails: trails, trailStep: trailStep, T_LO: T_LO, T_HI: T_HI, SP_MAX: SP_MAX, TI_MAX: TI_MAX, TRAIL_N: TRAIL_N, TRAIL_K: TRAIL_K };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LTCCFDView;
})(typeof window !== 'undefined' ? window : globalThis);
