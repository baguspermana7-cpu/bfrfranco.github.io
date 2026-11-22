/* RZElecVoltage — bus voltage under load (PRD-ELECTRICAL-BMS §A6, decision 11, law E19).
 *
 * V = Vn × (1 − loading × Z% × (cos φ · R/Z + sin φ · X/Z) / 100)
 * the transformer regulation approximation (IEC 60076-1 Annex). Inputs come from the engines; where an engine does
 * not publish a quantity the caller passes the ASSUMED value below and the label says so. State bands: ±5 % warn,
 * ±10 % alarm of nominal (IEC 60038 supply tolerance, EN 50160 for LV). A dead bus is 0 V, state "dead".
 * Shared by both cockpits; UMD so the Node gate (tools/test-elec-voltage.mjs) runs the same code.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RZElecVoltage = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = Object.freeze({ warnPct: 5, alarmPct: 10, source: 'IEC 60038 supply tolerance ±10 %; EN 50160 LV ±10 %, warn at half the band' });

  /* used only where the engine publishes no value; every one names where it comes from */
  var ASSUMED = Object.freeze({
    pf: Object.freeze({ value: 0.95, source: 'assumed design power factor of a UPS-fed IT load (active-PFC rectifiers, vendor datasheets typically state input PF ≥ 0.95); same value and basis as conv-engine electrical.power_factor_design (ASSUMED)' }),
    xrMainTx: Object.freeze({ value: 30, source: 'assumed X/R of a ~100 MVA power transformer; IEEE C37.010 typical curves put large units in the 25-40 range (value not read off the figure: verify against the nameplate)' }),
    xrUnitSub: Object.freeze({ value: 6, source: 'assumed X/R of a 2.5 MVA distribution transformer; IEEE C37.010 typical curves put 2-3 MVA units near 5-8 (value not read off the figure: verify against the nameplate)' }),
    zUnitSubPct: Object.freeze({ value: 6, source: 'minimum short-circuit impedance of a 1 251-2 500 kVA transformer, IEC 60076-5 Table 1 (6.0 %); the DC AI engine publishes no unit-sub impedance' })
  });

  function num(o, k, lo, hi) {
    var v = o[k];
    if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) throw new Error('RZElecVoltage: ' + k + ' = ' + v + ' outside ' + lo + '…' + hi);
    return v;
  }

  function underLoad(o) {
    var nominal = num(o, 'nominal', 1, 1e6), loading = num(o, 'loading', 0, 5), z = num(o, 'zPct', 0, 30);
    var pf = num(o, 'pf', 0.01, 1), xr = num(o, 'xr', 0, 100);
    if (o.live === false) return { v: 0, nominal: nominal, regPct: 0, devPct: -100, state: 'dead' };
    var k = Math.sqrt(1 + xr * xr), sin = Math.sqrt(1 - pf * pf);
    var regPct = loading * z * (pf / k + sin * xr / k);
    var v = nominal * (1 - regPct / 100), dev = Math.abs(regPct);
    return { v: v, nominal: nominal, regPct: regPct, devPct: -regPct,
      state: dev > LIMITS.alarmPct ? 'alarm' : dev > LIMITS.warnPct ? 'warn' : 'normal' };
  }

  /* "388 V", "18.08 kV", "150.0 kV", "0 V DEAD" */
  function label(r) {
    if (r.state === 'dead') return '0 V DEAD';
    if (r.nominal < 1000) return Math.round(r.v) + ' V';
    var kv = r.v / 1000;
    return (kv >= 100 ? kv.toFixed(1) : kv.toFixed(2)) + ' kV';
  }

  return { underLoad: underLoad, label: label, LIMITS: LIMITS, ASSUMED: ASSUMED, version: '1.0.0' };
}));
