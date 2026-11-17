/*
 * tcc.js — window.RZConvTcc: time-current characteristics and coordination (PRD-CONV-LIVING-PLANT §8.2, phase P4).
 * Pure functions; Node-tested by tools/test-conv-tcc.mjs. Currents in amperes at the device's own voltage unless a
 * function says otherwise; times in seconds. null means "does not operate at this current".
 *
 *   IEC 60255-151 inverse-time:  t = TMS * k / ((I/Is)^alpha - 1)
 *       SI  standard inverse   k 0.14   alpha 0.02
 *       VI  very inverse       k 13.5   alpha 1
 *       EI  extremely inverse  k 80     alpha 2
 *       LTI long-time inverse  k 120    alpha 1
 *   relay(def, I)     def = { curve, Is, TMS, dt:{I,t}?, inst:{I,t}? }   the FASTEST enabled stage that has picked
 *                     up. The inverse stage picks up above 1.05 x Is (below it the formula has no meaning) and is
 *                     held flat above 20 x Is (the standard's upper limit of the characteristic).
 *   lsig(def, I)      LV electronic trip unit: def = { Ir, tr, Isd, tsd, i2t, Ii, ti }
 *                     long time  I^2 t = constant, tr seconds at 6 x Ir, picks up above 1.05 x Ir
 *                     short time definite tsd (or I^2 t ramp down to tsd when i2t is true, referred to 10 x Ir)
 *                     instantaneous ti (default 0.02 s) at and above Ii
 *   operate(dev, I)   dev = { kind: 'relay' | 'lsig', ... } -> seconds or null
 *   points(dev, Imin, Imax, n)  log-spaced [I, t] pairs for plotting (points where the device does not operate are skipped)
 *   refer(I, V, Vref) the same power at another voltage: I * V / Vref (plot every device on one current axis)
 *
 *   Equipment limits on the same axes
 *   txFla(kVA, V)                 full-load current, three-phase: kVA * 1000 / (sqrt(3) * V)
 *   txDamage(kVA, V, Zpct, I)     through-fault withstand, IEEE C57.109 form: thermal t = 1250 / (I/In)^2 between
 *                                 2 x In and the fault limit; mechanical t = 2 * (Imax/I)^2 with Imax = In / Zpu,
 *                                 applied above 50 % of Imax (frequent-fault curve, the conservative one);
 *                                 above Imax -> null (not reachable through the impedance)
 *   txInrush(kVA, V, mult, t)     the magnetising inrush point: { I: mult x FLA (default 12), t: default 0.1 s }
 *   cableWithstand(S, k, I)       adiabatic limit t = (k * S / I)^2; k 143 copper/XLPE, 94 aluminium/XLPE
 *
 *   margin(up, down, I)           t_up(I) - t_down(I), null when either does not operate
 *   coordinate(chain, Ifault, m)  chain = devices load-side first, each { id, dev, V }; currents referred to the
 *                                 voltage of the first device. Checks every adjacent pair at Ifault and at 3 lower
 *                                 currents down to the upstream pickup. Returns { ok, pairs:[{down, up, I, td, tu,
 *                                 margin, ok}] }. m = required grading margin in seconds (default 0.3).
 */
(function (root) {
  'use strict';
  var CURVES = { SI: { k: 0.14, a: 0.02 }, VI: { k: 13.5, a: 1 }, EI: { k: 80, a: 2 }, LTI: { k: 120, a: 1 } };
  var SQRT3 = Math.sqrt(3);
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function pos(n) { return isNum(n) && n > 0; }

  function inverse(curve, Is, TMS, I) {
    var c = CURVES[curve];
    if (!c || !pos(Is) || !pos(TMS) || !pos(I)) return null;
    var m = I / Is;
    if (m < 1.05) return null;
    if (m > 20) m = 20;
    return TMS * c.k / (Math.pow(m, c.a) - 1);
  }
  function fastest(list) {
    var t = null;
    list.forEach(function (x) { if (x !== null && (t === null || x < t)) t = x; });
    return t;
  }
  function relay(def, I) {
    if (!def || !pos(I)) return null;
    return fastest([
      inverse(def.curve, def.Is, def.TMS, I),
      def.dt && pos(def.dt.I) && I >= def.dt.I ? def.dt.t : null,
      def.inst && pos(def.inst.I) && I >= def.inst.I ? (isNum(def.inst.t) ? def.inst.t : 0.03) : null
    ]);
  }
  function lsig(def, I) {
    if (!def || !pos(I) || !pos(def.Ir)) return null;
    var long = (pos(def.tr) && I >= 1.05 * def.Ir) ? def.tr * Math.pow(6 * def.Ir / I, 2) : null;
    var short = null;
    if (pos(def.Isd) && I >= def.Isd && isNum(def.tsd)) {
      short = def.tsd;
      if (def.i2t) short = Math.max(def.tsd, def.tsd * Math.pow(10 * def.Ir / I, 2));
    }
    var inst = pos(def.Ii) && I >= def.Ii ? (isNum(def.ti) ? def.ti : 0.02) : null;
    return fastest([long, short, inst]);
  }
  function operate(dev, I) {
    if (!dev) return null;
    return dev.kind === 'lsig' ? lsig(dev, I) : relay(dev, I);
  }
  function points(dev, Imin, Imax, n) {
    var out = [], N = Math.max(2, n | 0 || 60);
    if (!pos(Imin) || !pos(Imax) || Imax <= Imin) return out;
    for (var i = 0; i < N; i++) {
      var I = Imin * Math.pow(Imax / Imin, i / (N - 1)), t = operate(dev, I);
      if (t !== null) out.push([I, t]);
    }
    return out;
  }
  function refer(I, V, Vref) { return pos(I) && pos(V) && pos(Vref) ? I * V / Vref : null; }

  function txFla(kVA, V) { return pos(kVA) && pos(V) ? kVA * 1000 / (SQRT3 * V) : null; }
  function txDamage(kVA, V, Zpct, I) {
    var In = txFla(kVA, V);
    if (In === null || !pos(Zpct) || !pos(I)) return null;
    var Imax = In / (Zpct / 100), m = I / In;
    if (m < 2 || I > Imax * 1.0001) return null;
    var thermal = 1250 / (m * m);
    if (I >= 0.5 * Imax) return Math.min(thermal, 2 * Math.pow(Imax / I, 2));
    return thermal;
  }
  function txInrush(kVA, V, mult, t) {
    var In = txFla(kVA, V);
    return In === null ? null : { I: In * (pos(mult) ? mult : 12), t: pos(t) ? t : 0.1 };
  }
  function cableWithstand(S, k, I) { return pos(S) && pos(k) && pos(I) ? Math.pow(k * S / I, 2) : null; }

  function margin(up, down, I) {
    var tu = operate(up, I), td = operate(down, I);
    return tu === null || td === null ? null : tu - td;
  }
  function pickup(dev) { return dev.kind === 'lsig' ? 1.05 * dev.Ir : 1.05 * dev.Is; }
  function coordinate(chain, Ifault, m) {
    var need = isNum(m) ? m : 0.3, pairs = [], ok = true;
    if (!chain || chain.length < 2 || !pos(Ifault)) return { ok: false, pairs: pairs, reason: 'need two devices and a fault current' };
    var Vref = chain[0].V;
    for (var i = 0; i + 1 < chain.length; i++) {
      var d = chain[i], u = chain[i + 1];
      /* test currents on the reference axis: the fault level and three points down to where the upstream picks up */
      var upPick = refer(pickup(u.dev), u.V, Vref), tests = [Ifault];
      if (upPick < Ifault) [0.75, 0.5, 0.25].forEach(function (f) { tests.push(upPick * Math.pow(Ifault / upPick, f)); });
      tests.forEach(function (Iref) {
        var td = operate(d.dev, refer(Iref, Vref, d.V)), tu = operate(u.dev, refer(Iref, Vref, u.V));
        if (td === null) return;                      /* the load-side device does not see it: nothing to grade */
        var mg = tu === null ? Infinity : tu - td, good = mg >= need - 1e-9;
        if (!good) ok = false;
        pairs.push({ down: d.id, up: u.id, I: Iref, td: td, tu: tu, margin: mg, ok: good });
      });
    }
    return { ok: ok, pairs: pairs, margin: need };
  }

  var API = { CURVES: CURVES, inverse: inverse, relay: relay, lsig: lsig, operate: operate, points: points, refer: refer,
    txFla: txFla, txDamage: txDamage, txInrush: txInrush, cableWithstand: cableWithstand, margin: margin, coordinate: coordinate, version: '1.0.0' };
  if (root) root.RZConvTcc = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
