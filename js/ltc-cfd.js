/* LTC — DH01 CFD: an incompressible, buoyant airflow solve of the hall on a uniform grid, set up
 * from the same plant and the same DH01 balance solve every other view reads.
 *
 *   grid      staggered (MAC): pressure and temperature at cell centres, each velocity component on
 *             its own faces; default 0.3 m cells, so the 0.6 m rack pitch, 1.2 m rack depth and the
 *             1.2 / 1.8 m aisles land on cell boundaries
 *   momentum  semi-Lagrangian advection (back-traced, trilinear) of each component, Boussinesq
 *             buoyancy g·β·(T − T_supply), then a pressure projection (red-black SOR) that removes
 *             the divergence the advection left: mass is conserved in every fluid cell
 *   energy    finite-volume, first-order upwind, conservative: what leaves one cell enters the next,
 *             so the hall's heat balance closes to the projection residual
 *   racks     black boxes, as DC CFD codes model IT: the front face draws the rack's airflow out of the
 *             cold aisle, the rear face returns it at the drawn air's mean temperature + q / (ρ·cp·V)
 *   CRAHs     fan walls: supply faces below 2.6 m at the solved unit flow, return faces in the ceiling
 *             plenum at the same flow; supply temperature from the coil effectiveness the balance
 *             solve fitted at design, T_s = max(set-point, T_r − ε·(T_r − T_chw))
 *   geometry  racks, CDUs, the ceiling, hot-aisle chimneys and their end doors are solid (a short row is
 *             blanked); walls, floor and ceiling are free-slip; containment leaks through a 5 cm slot
 *             between the rack tops and the chimney panels, spread as openings along each row (assumed)
 *
 * No turbulence model: eddies the grid can resolve are resolved, smaller ones are lost to numerical
 * diffusion (an implicit large-eddy approach). It is a coarse-grid CFD for training and comparison
 * with the balance solve — not a validated design CFD. Runs synchronously in node (gates) and as a
 * Web Worker in the browser (postMessage protocol at the end). */
(function (root) {
  'use strict';
  var RHO = 1.2, CP = 1.006, G = 9.81, RACK_H = 2.0, PLEN_D = 0.9, CRAH_SUP_H = 2.6, RET_W = 1.2, LEAK_GAP = 0.05;

  function setup(r, s, opt) {
    var o = opt || {}, dx = o.dx || 0.3, p = r.input, h = r.hall, L = h.lengthM, W = h.widthM, H = h.heightM;
    var nx = Math.max(4, Math.round(L / dx)), ny = Math.max(4, Math.round(H / dx)), nz = Math.max(4, Math.round(W / dx));
    var N = nx * ny * nz, nu = (nx + 1) * ny * nz, nv = nx * (ny + 1) * nz, nw = nx * ny * (nz + 1);
    var C = { dx: dx, nx: nx, ny: ny, nz: nz, L: L, W: W, H: H, t: 0, steps: 0,
      solid: new Uint8Array(N), T: new Float32Array(N), Tn: new Float32Array(N), phi: new Float32Array(N), div: new Float32Array(N),
      u: new Float32Array(nu), v: new Float32Array(nv), w: new Float32Array(nw), u0: new Float32Array(nu), v0: new Float32Array(nv), w0: new Float32Array(nw),
      fu: new Uint8Array(nu), fv: new Uint8Array(nv), fw: new Uint8Array(nw),        // 1 = fixed face
      bu: new Float32Array(nu), bv: new Float32Array(nv), bw: new Float32Array(nw),  // prescribed velocity on fixed faces
      tu: new Int32Array(nu).fill(-1), tv: new Int32Array(nv).fill(-1), tw: new Int32Array(nw).fill(-1), // inflow source id (−1: none)
      hot: new Uint8Array(N), leaks: 0, jC: 0, src: [], racks: [], crah: [], sp: p.supplyAirC, chw: s.chw, eps: s.eps, Tref: s.supply,
      mean: null, avgN: 0 };
    function ci(i, j, k) { return i + nx * (j + ny * k); }
    function I(x) { return Math.max(0, Math.min(nx, Math.round(x / dx))); }
    function J(y) { return Math.max(0, Math.min(ny, Math.round(y / dx))); }
    function K(z) { return Math.max(0, Math.min(nz, Math.round(z / dx))); }
    C.ci = ci;
    function block(x0, x1, y0, y1, z0, z1) {
      for (var k = K(z0); k < K(z1); k++) for (var j = J(y0); j < J(y1); j++) for (var i = I(x0); i < I(x1); i++) C.solid[ci(i, j, k)] = 1;
    }
    // domain boundary faces: fixed at zero (free-slip walls, floor, roof)
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) { C.fu[0 + (nx + 1) * (j + ny * k)] = 1; C.fu[nx + (nx + 1) * (j + ny * k)] = 1; }
    for (k = 0; k < nz; k++) for (var i = 0; i < nx; i++) { C.fv[i + nx * (0 + (ny + 1) * k)] = 1; C.fv[i + nx * (ny + (ny + 1) * k)] = 1; }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { C.fw[i + nx * (j + ny * 0)] = 1; C.fw[i + nx * (j + ny * nz)] = 1; }
    var pitch = p.rackPitchM, dep = p.rackDepthM, hot = p.hotAisleM, jR = Math.max(1, J(RACK_H)), jC = Math.min(ny - 2, J(H - PLEN_D));
    // ceiling slab: one cell, open over the hot aisles (the chimneys)
    C.jC = jC;
    for (k = 0; k < nz; k++) for (i = 0; i < nx; i++) C.solid[ci(i, jC, k)] = 1;
    var x0 = 1e9, x1 = 0;
    h.racks.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x + pitch); });
    var hots = {};
    h.rowsY.forEach(function (row) { hots[row.hotY0.toFixed(3)] = row.hotY0; });
    Object.keys(hots).forEach(function (key) {
      var hz = hots[key], k0 = K(hz), k1 = K(hz + hot);
      for (var kk = k0; kk < k1; kk++) for (var ii = I(x0); ii < I(x1); ii++) C.solid[ci(ii, jC, kk)] = 0;
      // chimney walls from the rack tops to the ceiling, end doors from the floor
      // leakage: a LEAK_GAP slot between the rack tops and the panels, as openings spread along the row
      var every = Math.max(1, Math.round(dx / LEAK_GAP));
      for (var hk = k0; hk < k1; hk++) for (var hj = 0; hj <= jC; hj++) for (var hi = I(x0); hi < I(x1); hi++) C.hot[ci(hi, hj, hk)] = 1;
      for (var jj = jR; jj < jC; jj++) for (ii = I(x0); ii < I(x1); ii++) {
        var open = jj === jR && (ii - I(x0)) % every === Math.floor(every / 2);
        if (!open) { C.fw[ii + nx * (jj + ny * k0)] = 1; C.fw[ii + nx * (jj + ny * k1)] = 1; } else C.leaks += 2;
      }
      for (jj = 0; jj < jC; jj++) for (kk = k0; kk < k1; kk++) { C.fu[I(x0) + (nx + 1) * (jj + ny * kk)] = 1; C.fu[I(x1) + (nx + 1) * (jj + ny * kk)] = 1; }
    });
    h.cdus.forEach(function (c) { block(c.x - 0.45, c.x + 0.45, 0, 2.0, c.y - 0.5, c.y + 0.5); });
    // a row shorter than the others is closed with blanking panels: the containment stays whole
    h.rowsY.forEach(function (row) { block(x0, x1, 0, RACK_H, row.y, row.y + dep); });
    // racks: solid, with a drawing front face and a returning rear face
    h.racks.forEach(function (q, n) {
      var sr = s.racks[n], i0 = I(q.x), i1 = Math.max(i0 + 1, I(q.x + pitch)), k0 = K(q.y), k1 = Math.max(k0 + 1, K(q.y + dep));
      block(q.x, q.x + pitch, 0, RACK_H, q.y, q.y + dep);
      var ai = h.aisles[q.aisle], frontLow = ai.y1 <= q.y + 1e-9, area = (i1 - i0) * jR * dx * dx, vel = sr.dem / area;
      var R = { n: n, dem: sr.dem, q: sr.q, fk: frontLow ? k0 : k1, rk: frontLow ? k1 : k0, sgn: frontLow ? 1 : -1, i0: i0, i1: i1, faces: [], tin: s.supply, tout: s.supply + sr.q / (RHO * CP * Math.max(sr.dem, 1e-9)) };
      var id = C.src.length; C.src.push(R.tout);
      R.src = id;
      for (var jj = 0; jj < jR; jj++) for (var ii = i0; ii < i1; ii++) {
        var f = ii + nx * (jj + ny * R.fk), b = ii + nx * (jj + ny * R.rk);
        C.fw[f] = 1; C.bw[f] = R.sgn * vel; C.fw[b] = 1; C.bw[b] = R.sgn * vel; C.tw[b] = id;
        R.faces.push([f, ci(ii, jj, frontLow ? k0 - 1 : k1)]);
      }
      C.racks.push(R);
    });
    // CRAH fan walls: supply below 2.6 m, return from the plenum, at the solved flow per unit
    var out = s.crahOut || {}, perWall = { west: 0, east: 0 };
    h.crahs.forEach(function (c) { perWall[c.wall]++; });
    var supId = C.src.length; C.src.push(s.supply); C.supId = supId;
    var jS = Math.min(jC, J(CRAH_SUP_H));
    h.crahs.forEach(function (c) {
      var uw = W / perWall[c.wall], k0 = K(c.y - uw / 2), k1 = Math.max(k0 + 1, K(c.y + uw / 2)), iF = c.wall === 'west' ? 0 : nx, sg = c.wall === 'west' ? 1 : -1;
      var U = { c: c, dead: !!out[c.i], ret: [], k0: k0, k1: k1, wall: c.wall };
      if (!U.dead) {
        // the return is drawn through the plenum's end wall AND its roof over the unit (the return
        // grille), so no face runs faster than a real plenum return
        var q = s.crahUnitM3s, aS = (k1 - k0) * jS * dx * dx, nRoof = Math.max(1, I(RET_W)), aR = (k1 - k0) * ((ny - jC - 1) + nRoof) * dx * dx;
        for (var kk = k0; kk < k1; kk++) {
          for (var jj = 0; jj < jS; jj++) { var f = iF + (nx + 1) * (jj + ny * kk); C.bu[f] = sg * q / aS; C.tu[f] = supId; }
          for (jj = jC + 1; jj < ny; jj++) { f = iF + (nx + 1) * (jj + ny * kk); C.bu[f] = -sg * q / aR; U.ret.push(['u', f, ci(c.wall === 'west' ? 0 : nx - 1, jj, kk)]); }
          for (var ii = 0; ii < nRoof; ii++) { var ic = c.wall === 'west' ? ii : nx - 1 - ii; f = ic + nx * (ny + (ny + 1) * kk); C.fv[f] = 1; C.bv[f] = q / aR; U.ret.push(['v', f, ci(ic, ny - 1, kk)]); }
        }
        U.q = q;
      }
      C.crah.push(U);
    });
    // faces touching a solid cell are fixed (zero unless prescribed above)
    for (k = 0; k < nz; k++) for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (C.solid[ci(i, j, k)]) {
      C.fu[i + (nx + 1) * (j + ny * k)] = 1; C.fu[i + 1 + (nx + 1) * (j + ny * k)] = 1;
      C.fv[i + nx * (j + (ny + 1) * k)] = 1; C.fv[i + nx * (j + 1 + (ny + 1) * k)] = 1;
      C.fw[i + nx * (j + ny * k)] = 1; C.fw[i + nx * (j + ny * (k + 1))] = 1;
    }
    C.T.fill(s.supply);
    applyFixed(C);
    C.qRacks = C.racks.reduce(function (a, R) { return a + R.q; }, 0);
    return C;
  }

  function applyFixed(C) {
    var a = [[C.u, C.fu, C.bu], [C.v, C.fv, C.bv], [C.w, C.fw, C.bw]];
    for (var m = 0; m < 3; m++) { var V = a[m][0], F = a[m][1], B = a[m][2]; for (var i = 0; i < V.length; i++) if (F[i]) V[i] = B[i]; }
  }

  /* trilinear sample of a staggered component at a point (metres); ox/oy/oz: its grid offset in cells */
  function sample(A, sx, sy, sz, ox, oy, oz, x, y, z, dx) {
    var fx = x / dx - ox, fy = y / dx - oy, fz = z / dx - oz;
    fx = fx < 0 ? 0 : fx > sx - 1.001 ? sx - 1.001 : fx; fy = fy < 0 ? 0 : fy > sy - 1.001 ? sy - 1.001 : fy; fz = fz < 0 ? 0 : fz > sz - 1.001 ? sz - 1.001 : fz;
    var i = fx | 0, j = fy | 0, k = fz | 0, a = fx - i, b = fy - j, c = fz - k, s1 = sx, s2 = sx * sy, o = i + s1 * j + s2 * k;
    return ((A[o] * (1 - a) + A[o + 1] * a) * (1 - b) + (A[o + s1] * (1 - a) + A[o + s1 + 1] * a) * b) * (1 - c) +
           ((A[o + s2] * (1 - a) + A[o + s2 + 1] * a) * (1 - b) + (A[o + s2 + s1] * (1 - a) + A[o + s2 + s1 + 1] * a) * b) * c;
  }
  function vel(C, x, y, z, out) {
    var nx = C.nx, ny = C.ny, nz = C.nz, dx = C.dx;
    out[0] = sample(C.u0, nx + 1, ny, nz, 0, 0.5, 0.5, x, y, z, dx);
    out[1] = sample(C.v0, nx, ny + 1, nz, 0.5, 0, 0.5, x, y, z, dx);
    out[2] = sample(C.w0, nx, ny, nz + 1, 0.5, 0.5, 0, x, y, z, dx);
    return out;
  }

  function advect(C, dt) {
    var nx = C.nx, ny = C.ny, nz = C.nz, dx = C.dx, q = [0, 0, 0], i, j, k, x, y, z, f;
    C.u0.set(C.u); C.v0.set(C.v); C.w0.set(C.w);
    for (k = 0; k < nz; k++) for (j = 0; j < ny; j++) for (i = 0; i <= nx; i++) {
      f = i + (nx + 1) * (j + ny * k); if (C.fu[f]) continue;
      x = i * dx; y = (j + 0.5) * dx; z = (k + 0.5) * dx; vel(C, x, y, z, q);
      C.u[f] = sample(C.u0, nx + 1, ny, nz, 0, 0.5, 0.5, x - dt * q[0], y - dt * q[1], z - dt * q[2], dx);
    }
    for (k = 0; k < nz; k++) for (j = 0; j <= ny; j++) for (i = 0; i < nx; i++) {
      f = i + nx * (j + (ny + 1) * k); if (C.fv[f]) continue;
      x = (i + 0.5) * dx; y = j * dx; z = (k + 0.5) * dx; vel(C, x, y, z, q);
      C.v[f] = sample(C.v0, nx, ny + 1, nz, 0.5, 0, 0.5, x - dt * q[0], y - dt * q[1], z - dt * q[2], dx);
    }
    for (k = 0; k <= nz; k++) for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      f = i + nx * (j + ny * k); if (C.fw[f]) continue;
      x = (i + 0.5) * dx; y = (j + 0.5) * dx; z = k * dx; vel(C, x, y, z, q);
      C.w[f] = sample(C.w0, nx, ny, nz + 1, 0.5, 0.5, 0, x - dt * q[0], y - dt * q[1], z - dt * q[2], dx);
    }
  }

  function buoyancy(C, dt) {
    var nx = C.nx, ny = C.ny, nz = C.nz, Tr = C.Tref, beta = 1 / (Tr + 273.15);
    for (var k = 0; k < nz; k++) for (var j = 1; j < ny; j++) for (var i = 0; i < nx; i++) {
      var f = i + nx * (j + (ny + 1) * k); if (C.fv[f]) continue;
      var Tm = 0.5 * (C.T[i + nx * (j - 1 + ny * k)] + C.T[i + nx * (j + ny * k)]);
      C.v[f] += dt * G * beta * (Tm - Tr);
    }
  }

  function divergence(C) {
    var nx = C.nx, ny = C.ny, nz = C.nz, m = 0;
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var c = i + nx * (j + ny * k); if (C.solid[c]) { C.div[c] = 0; continue; }
      var d = C.u[i + 1 + (nx + 1) * (j + ny * k)] - C.u[i + (nx + 1) * (j + ny * k)] + C.v[i + nx * (j + 1 + (ny + 1) * k)] - C.v[i + nx * (j + (ny + 1) * k)]
        + C.w[i + nx * (j + ny * (k + 1))] - C.w[i + nx * (j + ny * k)];
      C.div[c] = d; if (Math.abs(d) > m) m = Math.abs(d);
    }
    return m;
  }

  /* projection: φ_c = (Σ φ_nb − div) / n over the free faces, red-black SOR; then u −= ∇φ on free faces */
  /* projection: solve A·φ = −div, A·φ = Σ k_f·(φ_c − φ_nb) over the free faces (k_f = 1), with a
     geometric multigrid V-cycle — each coarser level merges 2×2×2 cells and carries a face
     conductance k = Σ of its four child faces (Galerkin with piecewise-constant transfer), so obstacles and openings survive coarsening.
     Then u −= ∇φ on every free face: the divergence left is the solver residual, reported. */
  function mgLevel(nx, ny, nz) {
    var N = nx * ny * nz;
    return { nx: nx, ny: ny, nz: nz, kx: new Float32Array((nx + 1) * ny * nz), ky: new Float32Array(nx * (ny + 1) * nz), kz: new Float32Array(nx * ny * (nz + 1)),
             d: new Float32Array(N), x: new Float32Array(N), b: new Float32Array(N), r: new Float32Array(N) };
  }
  function mgDiag(l) {
    var nx = l.nx, ny = l.ny, nz = l.nz;
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var fx = i + (nx + 1) * (j + ny * k), fy = i + nx * (j + (ny + 1) * k), fz = i + nx * (j + ny * k);
      l.d[i + nx * (j + ny * k)] = l.kx[fx] + l.kx[fx + 1] + l.ky[fy] + l.ky[fy + nx] + l.kz[fz] + l.kz[fz + nx * ny];
    }
  }
  function mgBuild(C) {
    var nx = C.nx, ny = C.ny, nz = C.nz, L = [mgLevel(nx, ny, nz)], f = L[0], i;
    for (i = 0; i < f.kx.length; i++) f.kx[i] = C.fu[i] ? 0 : 1;
    for (i = 0; i < f.ky.length; i++) f.ky[i] = C.fv[i] ? 0 : 1;
    for (i = 0; i < f.kz.length; i++) f.kz[i] = C.fw[i] ? 0 : 1;
    mgDiag(f);
    while (f.nx > 3 && f.ny > 3 && f.nz > 3 && L.length < 6) {
      var cx = Math.ceil(f.nx / 2), cy = Math.ceil(f.ny / 2), cz = Math.ceil(f.nz / 2), c = mgLevel(cx, cy, cz), I, J, K, a, b2;
      for (K = 0; K < cz; K++) for (J = 0; J < cy; J++) for (I = 0; I <= cx; I++) {
        var s = 0; if (2 * I <= f.nx) for (b2 = 0; b2 < 2; b2++) for (a = 0; a < 2; a++) { var j = 2 * J + a, k = 2 * K + b2; if (j < f.ny && k < f.nz) s += f.kx[2 * I + (f.nx + 1) * (j + f.ny * k)]; }
        c.kx[I + (cx + 1) * (J + cy * K)] = I > 0 && I < cx ? s : 0;
      }
      for (K = 0; K < cz; K++) for (J = 0; J <= cy; J++) for (I = 0; I < cx; I++) {
        s = 0; if (2 * J <= f.ny) for (b2 = 0; b2 < 2; b2++) for (a = 0; a < 2; a++) { var ii = 2 * I + a, kk = 2 * K + b2; if (ii < f.nx && kk < f.nz) s += f.ky[ii + f.nx * (2 * J + (f.ny + 1) * kk)]; }
        c.ky[I + cx * (J + (cy + 1) * K)] = J > 0 && J < cy ? s : 0;
      }
      for (K = 0; K <= cz; K++) for (J = 0; J < cy; J++) for (I = 0; I < cx; I++) {
        s = 0; if (2 * K <= f.nz) for (b2 = 0; b2 < 2; b2++) for (a = 0; a < 2; a++) { ii = 2 * I + a; j = 2 * J + b2; if (ii < f.nx && j < f.ny) s += f.kz[ii + f.nx * (j + f.ny * 2 * K)]; }
        c.kz[I + cx * (J + cy * K)] = K > 0 && K < cz ? s : 0;
      }
      mgDiag(c); L.push(c); f = c;
    }
    return L;
  }
  function mgSmooth(l, sweeps, rev) {
    var nx = l.nx, ny = l.ny, nz = l.nz, X = l.x, B = l.b, D = l.d, KX = l.kx, KY = l.ky, KZ = l.kz, sxy = nx * ny;
    for (var sw = 0; sw < sweeps; sw++) for (var cc = 0; cc < 2; cc++) for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) {
      var col = rev ? 1 - cc : cc, row = nx * (j + ny * k), fxr = (nx + 1) * (j + ny * k), fyr = nx * (j + (ny + 1) * k);
      for (var i = (j + k + col) & 1; i < nx; i += 2) {
        var c = row + i, d = D[c]; if (!d) continue;
        var fx = fxr + i, fy = fyr + i, fz = c, s = B[c];
        var a0 = KX[fx], a1 = KX[fx + 1], a2 = KY[fy], a3 = KY[fy + nx], a4 = KZ[fz], a5 = KZ[fz + sxy];
        if (a0) s += a0 * X[c - 1]; if (a1) s += a1 * X[c + 1]; if (a2) s += a2 * X[c - nx]; if (a3) s += a3 * X[c + nx]; if (a4) s += a4 * X[c - sxy]; if (a5) s += a5 * X[c + sxy];
        X[c] = s / d;
      }
    }
  }
  function mgResidual(l) {
    var nx = l.nx, ny = l.ny, nz = l.nz, X = l.x, sxy = nx * ny;
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var c = i + nx * (j + ny * k); if (!l.d[c]) { l.r[c] = 0; continue; }
      var fx = i + (nx + 1) * (j + ny * k), fy = i + nx * (j + (ny + 1) * k), s = l.b[c] - l.d[c] * X[c];
      if (l.kx[fx]) s += l.kx[fx] * X[c - 1]; if (l.kx[fx + 1]) s += l.kx[fx + 1] * X[c + 1]; if (l.ky[fy]) s += l.ky[fy] * X[c - nx];
      if (l.ky[fy + nx]) s += l.ky[fy + nx] * X[c + nx]; if (l.kz[c]) s += l.kz[c] * X[c - sxy]; if (l.kz[c + sxy]) s += l.kz[c + sxy] * X[c + sxy];
      l.r[c] = s;
    }
  }
  function vcycle(L, n) {
    var f = L[n];
    if (n === L.length - 1) { mgSmooth(f, 20); mgSmooth(f, 20, true); return; }
    mgSmooth(f, 2); mgResidual(f);
    var c = L[n + 1], i, j, k;
    c.b.fill(0); c.x.fill(0);
    for (k = 0; k < f.nz; k++) for (j = 0; j < f.ny; j++) for (i = 0; i < f.nx; i++) c.b[(i >> 1) + c.nx * ((j >> 1) + c.ny * (k >> 1))] += f.r[i + f.nx * (j + f.ny * k)];
    vcycle(L, n + 1);
    for (k = 0; k < f.nz; k++) for (j = 0; j < f.ny; j++) for (i = 0; i < f.nx; i++) { var cc = i + f.nx * (j + f.ny * k); if (f.d[cc]) f.x[cc] += 1.6 * c.x[(i >> 1) + c.nx * ((j >> 1) + c.ny * (k >> 1))]; }
    mgSmooth(f, 2, true);
  }
  function project(C, cycles) {
    var nx = C.nx, ny = C.ny, nz = C.nz, i, j, k, c, f, sxy = nx * ny;
    if (!C.mg) C.mg = mgBuild(C);
    var L0 = C.mg[0], N = L0.b.length, D0 = L0.d;
    divergence(C);
    if (!C.pcg) C.pcg = { x: new Float32Array(N), r: new Float64Array(N), z: new Float64Array(N), p: new Float64Array(N), q: new Float64Array(N) };
    var X = C.pcg.x, R = C.pcg.r, Z = C.pcg.z, Pd = C.pcg.p, Q = C.pcg.q, nf = 0, mean = 0;
    // warm start: last step's correction is a close guess for this one
    for (c = 0; c < N; c++) if (D0[c]) { R[c] = -C.div[c]; mean += R[c]; nf++; } else R[c] = 0;
    mean /= nf || 1; for (c = 0; c < N; c++) if (D0[c]) R[c] -= mean;      // Neumann: the right side must sum to zero
    function amul0(V, O) { amul(V, O); }
    amul0(X, Q); for (c = 0; c < N; c++) R[c] -= Q[c];
    function precond() { L0.b.set(R); L0.x.fill(0); vcycle(C.mg, 0); for (var e = 0; e < N; e++) Z[e] = L0.x[e]; }
    function amul(V, O) {                                    // O = A·V on the fine level
      for (var kk = 0; kk < nz; kk++) for (var jj = 0; jj < ny; jj++) for (var ii = 0; ii < nx; ii++) {
        var e = ii + nx * (jj + ny * kk); if (!D0[e]) { O[e] = 0; continue; }
        var fx = ii + (nx + 1) * (jj + ny * kk), fy = ii + nx * (jj + (ny + 1) * kk), t = D0[e] * V[e];
        if (L0.kx[fx]) t -= V[e - 1]; if (L0.kx[fx + 1]) t -= V[e + 1]; if (L0.ky[fy]) t -= V[e - nx]; if (L0.ky[fy + nx]) t -= V[e + nx];
        if (L0.kz[e]) t -= V[e - sxy]; if (L0.kz[e + sxy]) t -= V[e + sxy];
        O[e] = t;
      }
    }
    precond(); Pd.set(Z);
    var rz = 0, e2; for (e2 = 0; e2 < N; e2++) rz += R[e2] * Z[e2];
    C.pcgIters = 0;
    for (var it = 0; it < (cycles || 12); it++) {
      amul(Pd, Q); var pq = 0; for (e2 = 0; e2 < N; e2++) pq += Pd[e2] * Q[e2];
      if (!(pq > 0)) break;
      var al = rz / pq, rmax = 0;
      for (e2 = 0; e2 < N; e2++) { X[e2] += al * Pd[e2]; R[e2] -= al * Q[e2]; var ar = R[e2] < 0 ? -R[e2] : R[e2]; if (ar > rmax) rmax = ar; }
      C.pcgIters = it + 1; if (C.log) C.log.push(rmax);
      if (rmax < (C.tol || 2e-3)) break;
      precond(); var rz2 = 0; for (e2 = 0; e2 < N; e2++) rz2 += R[e2] * Z[e2];
      var be = rz2 / rz; rz = rz2; for (e2 = 0; e2 < N; e2++) Pd[e2] = Z[e2] + be * Pd[e2];
    }
    var P = X, U = C.u, V = C.v, Wv = C.w, FU = C.fu, FV = C.fv, FW = C.fw;
    for (k = 0; k < nz; k++) for (j = 0; j < ny; j++) for (i = 1; i < nx; i++) { f = i + (nx + 1) * (j + ny * k); if (!FU[f]) { c = i + nx * (j + ny * k); U[f] -= P[c] - P[c - 1]; } }
    for (k = 0; k < nz; k++) for (j = 1; j < ny; j++) for (i = 0; i < nx; i++) { f = i + nx * (j + (ny + 1) * k); if (!FV[f]) { c = i + nx * (j + ny * k); V[f] -= P[c] - P[c - nx]; } }
    for (k = 1; k < nz; k++) for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { f = i + nx * (j + ny * k); if (!FW[f]) { c = i + nx * (j + ny * k); Wv[f] -= P[c] - P[c - sxy]; } }
    return divergence(C);
  }

  /* energy: conservative first-order upwind; inflow faces bring their source's temperature */
  function energy(C, dt) {
    var nx = C.nx, ny = C.ny, nz = C.nz, dx = C.dx, T = C.T, Tn = C.Tn, omax = 0, i, j, k;
    // upwind stays bounded while the outflow of every cell in one sub-step is below its volume
    for (k = 0; k < nz; k++) for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      var fu = i + (nx + 1) * (j + ny * k), fv = i + nx * (j + (ny + 1) * k), fw = i + nx * (j + ny * k);
      var o = Math.max(0, C.u[fu + 1]) + Math.max(0, -C.u[fu]) + Math.max(0, C.v[fv + nx]) + Math.max(0, -C.v[fv]) + Math.max(0, C.w[fw + nx * ny]) + Math.max(0, -C.w[fw]);
      if (o > omax) omax = o;
    }
    var nsub = Math.max(1, Math.ceil(dt * omax / (0.9 * dx))), h = dt / nsub / dx, S = C.solid, Uu = C.u, Vv = C.v, Ww = C.w, TU = C.tu, TW = C.tw, SRC = C.src, DV = C.div;
    function face(vel, srcId, cl, cr) {          // flux (m/s·K) through a face, positive towards cr
      if (vel > 0) return vel * (cl >= 0 ? T[cl] : SRC[srcId]);
      return vel * (cr >= 0 ? T[cr] : SRC[srcId]);
    }
    for (var sub = 0; sub < nsub; sub++) {
      Tn.set(T);
      for (k = 0; k < nz; k++) for (j = 0; j < ny; j++) for (i = 0; i <= nx; i++) {
        var f = i + (nx + 1) * (j + ny * k), U = Uu[f]; if (!U) continue;
        var cl = i > 0 ? i - 1 + nx * (j + ny * k) : -1, cr = i < nx ? i + nx * (j + ny * k) : -1;
        if (cl >= 0 && S[cl]) cl = -1; if (cr >= 0 && S[cr]) cr = -1;
        if (cl < 0 && cr < 0) continue;
        if ((U > 0 && cl < 0 || U < 0 && cr < 0) && TU[f] < 0) continue;  // no source: nothing enters
        var F = face(U, TU[f], cl, cr) * h;
        if (cl >= 0) Tn[cl] -= F; if (cr >= 0) Tn[cr] += F;
      }
      for (k = 0; k < nz; k++) for (j = 0; j <= ny; j++) for (i = 0; i < nx; i++) {
        f = i + nx * (j + (ny + 1) * k); U = Vv[f]; if (!U) continue;
        cl = j > 0 ? i + nx * (j - 1 + ny * k) : -1; cr = j < ny ? i + nx * (j + ny * k) : -1;
        if (cl >= 0 && S[cl]) cl = -1; if (cr >= 0 && S[cr]) cr = -1;
        if (cl < 0 && cr < 0) continue;
        if (U > 0 && cl < 0 || U < 0 && cr < 0) continue;                // only outflow leaves through the roof
        F = face(U, -1, cl, cr) * h; if (cl >= 0) Tn[cl] -= F; if (cr >= 0) Tn[cr] += F;
      }
      for (k = 0; k <= nz; k++) for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
        f = i + nx * (j + ny * k); U = Ww[f]; if (!U) continue;
        cl = k > 0 ? i + nx * (j + ny * (k - 1)) : -1; cr = k < nz ? i + nx * (j + ny * k) : -1;
        if (cl >= 0 && S[cl]) cl = -1; if (cr >= 0 && S[cr]) cr = -1;
        if (cl < 0 && cr < 0) continue;
        if ((U > 0 && cl < 0 || U < 0 && cr < 0) && TW[f] < 0) continue;
        F = face(U, TW[f], cl, cr) * h;
        if (cl >= 0) Tn[cl] -= F; if (cr >= 0) Tn[cr] += F;
      }
      // the divergence left by the projection would create or destroy heat: remove it (T·div term)
      for (var c = 0; c < Tn.length; c++) if (!S[c]) Tn[c] += T[c] * DV[c] * h;
      T.set(Tn);
    }
  }

  /* racks and CRAHs read the field: rack exhaust = mean drawn temperature + its heat; coil on the return */
  function boundaries(C) {
    C.racks.forEach(function (R) {
      var s = 0; R.faces.forEach(function (f) { s += C.T[f[1]]; });
      R.tin = s / R.faces.length; R.tout = R.tin + R.q / (RHO * CP * Math.max(R.dem, 1e-9)); C.src[R.src] = R.tout;
    });
    var tr = 0, qn = 0;
    C.crah.forEach(function (U) { if (U.dead) return; U.ret.forEach(function (f) { tr += C.T[f[2]]; qn++; }); });
    C.tret = qn ? tr / qn : C.Tref;
    C.tsup = Math.max(C.sp, C.tret - C.eps * (C.tret - C.chw));
    C.src[C.supId] = C.tsup;
  }

  function step(C, dt, iters) {
    dt = dt || 0.1;
    boundaries(C);
    advect(C, dt); buoyancy(C, dt); applyFixed(C);
    C.res = project(C, iters || 12);
    energy(C, dt);
    C.t += dt; C.steps++;
    accumulate(C);
    return C;
  }

  /* running time-average after the first air change: mean temperature, mean speed and the resolved
     velocity fluctuation (turbulence intensity the grid can see) */
  function accumulate(C) {
    var nx = C.nx, ny = C.ny, nz = C.nz, N = nx * ny * nz;
    if (C.t < (C.warm || 12)) return;
    if (!C.mean) C.mean = { T: new Float32Array(N), s: new Float32Array(N), s2: new Float32Array(N), n: 0 };
    var M = C.mean, a = 1 / (M.n + 1);
    for (var k = 0; k < nz; k++) for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var c = i + nx * (j + ny * k);
      var uc = 0.5 * (C.u[i + (nx + 1) * (j + ny * k)] + C.u[i + 1 + (nx + 1) * (j + ny * k)]), vc = 0.5 * (C.v[i + nx * (j + (ny + 1) * k)] + C.v[i + nx * (j + 1 + (ny + 1) * k)]),
        wc = 0.5 * (C.w[i + nx * (j + ny * k)] + C.w[i + nx * (j + ny * (k + 1))]), sp = Math.sqrt(uc * uc + vc * vc + wc * wc);
      M.T[c] += (C.T[c] - M.T[c]) * a; M.s[c] += (sp - M.s[c]) * a; M.s2[c] += (sp * sp - M.s2[c]) * a;
    }
    M.n++;
  }

  /* what the solve says: per-rack inlet, energy and mass balance, against the balance solve */
  function report(C) {
    var inl = C.racks.map(function (R) { return R.tin; }), qAir = 0;
    C.crah.forEach(function (U) { if (!U.dead) qAir += RHO * CP * U.q * (C.tret - C.tsup); });
    var bnd = 0;                                            // heat leaving minus entering through the fan walls, per face
    C.crah.forEach(function (U) { if (U.dead) return; U.ret.forEach(function (f) { bnd += RHO * CP * Math.abs(C[f[0]][f[1]]) * C.dx * C.dx * C.T[f[2]]; }); });
    var supQ = 0; C.crah.forEach(function (U) { if (!U.dead) supQ += RHO * CP * U.q * C.tsup; });
    return { t: C.t, steps: C.steps, inlet: inl, maxInlet: Math.max.apply(null, inl), over27: inl.filter(function (t) { return t > 27; }).length, over32: inl.filter(function (t) { return t > 32; }).length,
             supply: C.tsup, ret: C.tret, qRacksKw: C.qRacks, qCrahKw: bnd - supQ, residual: C.res };
  }

  function run(r, s, opt) {
    var o = opt || {}, C = setup(r, s, o), n = o.steps || 300;
    for (var i = 0; i < n; i++) step(C, o.dt || 0.2, o.iters || 12);
    return C;
  }

  var api = { setup: setup, step: step, run: run, report: report, vel: vel, RACK_H: RACK_H, PLEN_D: PLEN_D };
  root.LTCCFD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* Web Worker: {cmd:'start', r, s, opt} → posts {cmd:'frame', T, u, v, w, mean, rep} every few steps */
  if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    var C = null, timer = null, gen = 0;
    root.onmessage = function (e) {
      var m = e.data;
      if (m.cmd === 'stop') { gen++; return; }
      if (m.cmd !== 'start') return;
      var my = ++gen; C = setup(m.r, m.s, m.opt);
      (function loop() {
        if (my !== gen) return;
        for (var i = 0; i < (m.opt && m.opt.batch || 2); i++) step(C, 0.2, 12);
        var cellsT = C.mean && C.mean.n > 20 ? C.mean.T : C.T;
        root.postMessage({ cmd: 'frame', key: m.key, nx: C.nx, ny: C.ny, nz: C.nz, dx: C.dx, T: new Float32Array(C.T), Tm: new Float32Array(cellsT),
          u: new Float32Array(C.u), v: new Float32Array(C.v), w: new Float32Array(C.w),
          ti: C.mean ? tiField(C) : null, solid: C.steps <= 4 ? new Uint8Array(C.solid) : null, rep: report(C) });
        setTimeout(loop, 0);
      })();
    };
  }
  function tiField(C) {
    var M = C.mean, out = new Float32Array(M.s.length);
    for (var c = 0; c < out.length; c++) { var vr = Math.max(0, M.s2[c] - M.s[c] * M.s[c]); out[c] = M.s[c] > 0.05 ? Math.sqrt(vr) / M.s[c] : 0; }
    return out;
  }
  api.tiField = tiField;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
