/* ============================================================================
 * cdu-engine.js — pure thermohydraulic calculation engine for the CDU hub
 * ----------------------------------------------------------------------------
 * window.CDU_ENGINE — also exported via module.exports for the Node test
 * (tools/test-cdu-calc.mjs) which loads it in a vm sandbox.
 *
 * GUARANTEES:
 *   - PURE & deterministic. NO Math.random. Same input -> same output.
 *   - Never mutates inputs. Numeric guards on every division.
 *   - Every formula anchored to a standard (see cdu-model.js authority block).
 *     Heat<->flow: Q = m_dot * cp * dT. HX: epsilon-NTU. dP: Darcy-Weisbach
 *     (Haaland explicit friction). NPSH: Hydraulic Institute. Dew: Magnus.
 *
 * Zero-build, ES5-safe, no imports. build(injectedModel) lets the test inject.
 * ==========================================================================*/
(function (root) {
  'use strict';

  function resolveModel(injected) {
    if (injected) { return injected; }
    if (root && root.CDU_MODEL) { return root.CDU_MODEL; }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./cdu-model.js'); } catch (e) { /* fall through */ }
    }
    throw new Error('CDU_MODEL not available');
  }

  /* ---- numeric guards ---------------------------------------------------- */
  function num(x) {
    var n = typeof x === 'number' ? x : parseFloat(x);
    if (!isFinite(n)) { throw new Error('Non-finite numeric input: ' + x); }
    return n;
  }
  function posDiv(a, b) {
    var na = num(a), nb = num(b);
    if (nb === 0) { throw new Error('Division by zero'); }
    return na / nb;
  }
  function round(x, dp) {
    var f = Math.pow(10, dp == null ? 3 : dp);
    return Math.round(num(x) * f) / f;
  }
  /* band state helper: returns 'ok' | 'warn' | 'alarm' */
  function bandState(v, band) {
    if (!band) { return 'ok'; }
    var x = num(v);
    var lo = band.min, hi = band.max;
    if (lo != null && x < lo) { return (x < lo * 0.85) ? 'alarm' : 'warn'; }
    if (hi != null && x > hi) { return (x > hi * 1.15) ? 'alarm' : 'warn'; }
    return 'ok';
  }

  function build(injectedModel) {
    var M = resolveModel(injectedModel);

    /* ======================================================================
     * (b) FLUID PROPERTIES — f(temperature, glycol%)
     * Water: empirical fits valid ~5-60 C. PG-25: water scaled by 25%-glycol
     * correction factors interpolated linearly in glycol fraction.
     * ====================================================================*/
    function waterProps(tC) {
      var T = num(tC);
      var rho = 1000.6 - 0.0476 * T - 0.0034 * T * T;          // kg/m3
      var cp = 4.186;                                          // kJ/kgK (~const 5-60 C)
      var mu = 2.414e-5 * Math.pow(10, 247.8 / (T + 133.0));   // Pa.s (Vogel form, T in C)
      var k = 0.569 + 0.00181 * T - 6.9e-6 * T * T;            // W/mK
      return { rho: rho, cp: cp, mu: mu, k: k, basisTag: 'STANDARD' };
    }
    function pg25Props(tC, glycolPct) {
      var g = num(glycolPct == null ? 25 : glycolPct);
      var frac = g / 25;                  // 0 = water, 1 = PG25
      var w = waterProps(tC);
      // 25%-glycol correction factors (vs water) — ASHRAE HoF 2021 ch.31
      var fRho = 1 + frac * (1.024 - 1);
      var fCp = 1 + frac * (0.905 - 1);
      var fMu = 1 + frac * (2.02 - 1);
      var fK = 1 + frac * (0.647 - 1);
      return {
        rho: w.rho * fRho, cp: w.cp * fCp, mu: w.mu * fMu, k: w.k * fK,
        basisTag: 'ILLUSTRATIVE'
      };
    }
    function fluidProps(fluidKey, tC, glycolPct) {
      return (fluidKey === 'pg25') ? pg25Props(tC, glycolPct) : waterProps(tC);
    }

    /* ======================================================================
     * (a) HEAT <-> FLOW  — Q = m_dot * cp * dT
     * flowLpm in L/min, rho in kg/L, cp in kJ/kgK, dT in K, Q in kW.
     * ====================================================================*/
    function hydronicQkW(flowLpm, rhoKgPerL, cpKjKgK, dTK) {
      return num(flowLpm) * num(rhoKgPerL) * num(cpKjKgK) * num(dTK) / 60;
    }
    function flowLpmFromQ(qKW, rhoKgPerL, cpKjKgK, dTK) {
      return num(qKW) * 60 / (num(rhoKgPerL) * num(cpKjKgK) * num(dTK));
    }
    function flowLpmPerKw(flowLpm, qKW) { return posDiv(flowLpm, qKW); }

    /* ======================================================================
     * (c) HEAT EXCHANGER — epsilon-NTU + LMTD + approach
     * ====================================================================*/
    function epsilonNTU(NTU, Cr, arrangement) {
      var n = num(NTU), cr = num(Cr);
      if (arrangement === 'parallel') {
        return (1 - Math.exp(-n * (1 + cr))) / (1 + cr);
      }
      // counterflow (default)
      if (Math.abs(cr - 1) < 1e-6) { return n / (1 + n); }
      var e = Math.exp(-n * (1 - cr));
      return (1 - e) / (1 - cr * e);
    }
    function lmtd(dT1, dT2) {
      var a = num(dT1), b = num(dT2);
      if (Math.abs(a - b) < 1e-9) { return a; }
      if (a <= 0 || b <= 0) { throw new Error('LMTD requires positive end differences'); }
      return (a - b) / Math.log(a / b);
    }
    /* Approach = residual closest temperature difference of a counterflow HX
     * with cold-side (or balanced) effectiveness eps:
     *   approach = (1 - eps) * (hotIn - coldIn). */
    function approachTempC(hotInC, coldInC, eps) {
      return (1 - num(eps)) * (num(hotInC) - num(coldInC));
    }
    function effectivenessForApproach(hotInC, coldInC, approachC) {
      var span = num(hotInC) - num(coldInC);
      if (span === 0) { return 1; }
      return 1 - num(approachC) / span;
    }

    /* ======================================================================
     * (d) PRESSURE DROP — Darcy-Weisbach with Haaland explicit friction
     * ====================================================================*/
    function velocityMs(flowLpm, Dmm) {
      var d = num(Dmm) / 1000;                 // m
      var area = Math.PI * (d / 2) * (d / 2);  // m2
      var qm3s = num(flowLpm) / 1000 / 60;     // m3/s
      return qm3s / area;
    }
    function reynolds(rho, velMs, Dmm, muPas) {
      return num(rho) * num(velMs) * (num(Dmm) / 1000) / num(muPas);
    }
    function frictionFactor(Re, relRoughness) {
      var re = num(Re);
      if (re < 2300) { return 64 / re; }       // laminar
      // Haaland (1983) explicit approximation to Colebrook
      var t = Math.pow(num(relRoughness) / 3.7, 1.11) + 6.9 / re;
      var inv = -1.8 * (Math.log(t) / Math.LN10);
      return 1 / (inv * inv);
    }
    function darcyDpBar(f, lengthM, Dmm, rho, velMs) {
      var dPa = num(f) * (num(lengthM) / (num(Dmm) / 1000)) * (num(rho) * num(velMs) * num(velMs) / 2);
      return dPa / M.phys.barToPa;
    }
    function fittingsDpBar(sumK, rho, velMs) {
      var dPa = num(sumK) * (num(rho) * num(velMs) * num(velMs) / 2);
      return dPa / M.phys.barToPa;
    }
    /* Convenience: full straight-pipe + fittings dP for a leg. */
    function legDpBar(flowLpm, Dmm, lengthM, sumK, fluidKey, tC, glycolPct) {
      var fp = fluidProps(fluidKey, tC, glycolPct);
      var v = velocityMs(flowLpm, Dmm);
      var Re = reynolds(fp.rho, v, Dmm, fp.mu);
      var rel = M.phys.absRoughnessMm / num(Dmm);
      var f = frictionFactor(Re, rel);
      var dpFric = darcyDpBar(f, lengthM, Dmm, fp.rho, v);
      var dpFit = fittingsDpBar(sumK || 0, fp.rho, v);
      return {
        velocityMs: v, reynolds: Re, frictionFactor: f,
        dpFrictionBar: dpFric, dpFittingsBar: dpFit, dpTotalBar: dpFric + dpFit,
        velBand: M.bands.pipeVelMs, velState: bandState(v, M.bands.pipeVelMs)
      };
    }

    /* ======================================================================
     * (e) NPSH — available vs required + cavitation margin
     * ====================================================================*/
    function vaporPressureBar(tC) {
      // Tetens (over water): p_sat[kPa] = 0.61078 * exp(17.27*T/(T+237.3))
      var T = num(tC);
      var kpa = 0.61078 * Math.exp(17.27 * T / (T + 237.3));
      return kpa / 100;                        // kPa -> bar
    }
    function npshAvailableM(pAtmBar, pVaporBar, staticHeadM, frictionHeadM, rho) {
      var g = M.phys.gravityMs2;
      var pressHeadM = (num(pAtmBar) - num(pVaporBar)) * M.phys.barToPa / (num(rho) * g);
      return pressHeadM + num(staticHeadM) - num(frictionHeadM);
    }
    function cavitationMarginPct(npshA, npshR) {
      return (num(npshA) - num(npshR)) / num(npshR) * 100;
    }

    /* ======================================================================
     * (f) DEW-POINT RESET — supply >= dewpoint + margin (Magnus)
     * ====================================================================*/
    function dewPointC(tAirC, rhPct) {
      var a = M.phys.dewMagnusA, b = M.phys.dewMagnusB;
      var T = num(tAirC), rh = num(rhPct);
      var gamma = Math.log(rh / 100) + (a * T) / (b + T);
      return b * gamma / (a - gamma);
    }
    function minSupplyForNoCondensationC(dewC, marginK) {
      return num(dewC) + num(marginK == null ? M.bands.dewMarginK.min : marginK);
    }
    function dewSafetyOk(supplyC, dewC, marginK) {
      return num(supplyC) >= minSupplyForNoCondensationC(dewC, marginK);
    }

    /* ======================================================================
     * (g) PUMP POWER + N+1
     * ====================================================================*/
    function pumpHydraulicKW(flowLpm, dpBar) {
      return num(flowLpm) * num(dpBar) / 600;   // P[kW] = dP[bar]*Q[LPM]/600
    }
    function pumpShaftKW(hydraulicKW, pumpEff) {
      return posDiv(hydraulicKW, pumpEff == null ? M.pump.pumpEff : pumpEff);
    }
    function pumpElectricalKW(shaftKW, motorEff) {
      return posDiv(shaftKW, motorEff == null ? M.pump.motorEff : motorEff);
    }
    function pumpCountNplus1(totalFlowLpm, perPumpLpm) {
      var per = num(perPumpLpm == null ? M.pump.perPumpLpmDefault : perPumpLpm);
      return Math.ceil(num(totalFlowLpm) / per) + 1;
    }

    /* ======================================================================
     * (h) WATER CHEMISTRY — inhibitor reserve, glycol + make-up volume
     * ====================================================================*/
    function inhibitorReserveOk(measuredPpm) {
      return num(measuredPpm) >= M.bands.azolePpm.min;
    }
    function glycolTopUpL(systemVolumeL, currentPct, targetPct) {
      var cur = num(currentPct), tgt = num(targetPct), V = num(systemVolumeL);
      if (tgt <= cur) { return 0; }
      // add pure glycol Vg so (cur/100*V + Vg)/(V + Vg) = tgt/100
      return V * (tgt - cur) / (100 - tgt);
    }
    function makeUpVolumeL(systemVolumeL, lossPct) {
      return num(systemVolumeL) * num(lossPct) / 100;
    }

    /* ======================================================================
     * (i) TCO / ROI — per-type (modelled on roi-calculator.html)
     * ====================================================================*/
    function capexUsd(typeKey, totalKw) {
      var perKw = M.tco.capexUsdPerKw[typeKey];
      if (perKw == null) { throw new Error('Unknown CDU type for capex: ' + typeKey); }
      return perKw * num(totalKw);
    }
    function annualEnergyKWh(pumpElecKW, hours) {
      return num(pumpElecKW) * num(hours == null ? M.tco.hoursPerYear : hours);
    }
    function annualOpexUsd(typeKey, capex, energyKWh, elecUsdPerKwh) {
      var maintPct = M.tco.annualMaintPctOfCapex[typeKey];
      var elec = num(elecUsdPerKwh == null ? M.tco.electricityUsdPerKwh : elecUsdPerKwh);
      return num(capex) * maintPct / 100 + num(energyKWh) * elec;
    }
    function npv(cashflows, ratePct) {
      var r = num(ratePct) / 100, acc = 0;
      for (var t = 0; t < cashflows.length; t++) {
        acc += num(cashflows[t]) / Math.pow(1 + r, t);
      }
      return acc;
    }
    function paybackYears(capex, annualSaving) {
      return posDiv(capex, annualSaving);
    }

    /* ======================================================================
     * COMPOSITE RESOLVER — the single state object consumed by the calculator,
     * the mini-BMS and the PDF (ACCURACY_VALIDATION rule 1: one source of truth).
     * Derived basis values only; sensor jitter is a DISPLAY concern (mini-BMS).
     * ====================================================================*/
    function cduState(typeKey, faultKey, overrides) {
      var base = M.types[typeKey];
      if (!base) { throw new Error('Unknown CDU type: ' + typeKey); }
      var d = M.faultDeltas[faultKey || 'normal'] || {};
      var o = overrides || {};

      var cap = num(o.cap == null ? base.cap : o.cap);
      var supply = num(base.supply) + num(d.supply || 0);
      var dT = num(base.dT) + num(d.dT || 0);
      var flowPerKw = num(base.flow) + num(d.flow || 0);
      var dP = num(base.dP) + num(d.dP || 0);
      var sysP = num(base.sysP);
      var atd = 4 + num(d.atd || 0);                 // nominal mid-band approach + fault delta
      var leak = num(d.leak || 0);
      var filterClog = num(d.filter || 0);
      var pumpARunning = (d.pumpA === 0) ? 0 : 1;

      var fluidKey = 'pg25';
      var fp = fluidProps(fluidKey, supply, o.glycolPct);
      var rhoKgL = fp.rho / 1000;
      var flowTot = cap * flowPerKw;                 // LPM
      var qCheck = hydronicQkW(flowTot, rhoKgL, fp.cp, dT);

      var perKw = flowLpmPerKw(flowTot, cap);
      var pumpHyd = pumpHydraulicKW(flowTot, dP);
      var pumpShaft = pumpShaftKW(pumpHyd);
      var pumpElec = pumpElectricalKW(pumpShaft);
      var npumps = pumpCountNplus1(flowTot, M.pump.perPumpLpmDefault);

      function tile(value, band, tag) {
        return { value: value, band: band, basisTag: tag || 'DERIVED', state: bandState(value, band) };
      }

      return {
        type: typeKey, typeName: base.name, arch: base.arch, fault: faultKey || 'normal',
        capacityKw: cap,
        supplyC:    tile(round(supply, 1), M.bands.supplyC),
        deltaTK:    tile(round(dT, 1), M.bands.deltaTK),
        flowLpmPerKw: tile(round(perKw, 2), M.bands.flowLpmPerKw),
        flowTotLpm: tile(round(flowTot, 0), null),
        dpBar:      tile(round(dP, 2), M.bands.dpBar),
        sysPBar:    tile(round(sysP, 1), M.bands.sysPBar),
        approachC:  tile(round(atd, 1), M.bands.atdK),
        pumpElectricalKW: tile(round(pumpElec, 2), null),
        pumpCountNplus1: npumps,
        qCheckKw:   round(qCheck, 1),
        fluid: fluidKey, fluidBasis: fp.basisTag,
        leak: leak, filterClog: filterClog, pumpARunning: pumpARunning
      };
    }

    return {
      version: '1.0.0',
      model: M,
      // fluids
      waterProps: waterProps, pg25Props: pg25Props, fluidProps: fluidProps,
      // heat<->flow
      hydronicQkW: hydronicQkW, flowLpmFromQ: flowLpmFromQ, flowLpmPerKw: flowLpmPerKw,
      // HX
      epsilonNTU: epsilonNTU, lmtd: lmtd, approachTempC: approachTempC,
      effectivenessForApproach: effectivenessForApproach,
      // pressure drop
      velocityMs: velocityMs, reynolds: reynolds, frictionFactor: frictionFactor,
      darcyDpBar: darcyDpBar, fittingsDpBar: fittingsDpBar, legDpBar: legDpBar,
      // NPSH
      vaporPressureBar: vaporPressureBar, npshAvailableM: npshAvailableM,
      cavitationMarginPct: cavitationMarginPct,
      // dew point
      dewPointC: dewPointC, minSupplyForNoCondensationC: minSupplyForNoCondensationC,
      dewSafetyOk: dewSafetyOk,
      // pump
      pumpHydraulicKW: pumpHydraulicKW, pumpShaftKW: pumpShaftKW,
      pumpElectricalKW: pumpElectricalKW, pumpCountNplus1: pumpCountNplus1,
      // chemistry
      inhibitorReserveOk: inhibitorReserveOk, glycolTopUpL: glycolTopUpL,
      makeUpVolumeL: makeUpVolumeL,
      // TCO
      capexUsd: capexUsd, annualEnergyKWh: annualEnergyKWh, annualOpexUsd: annualOpexUsd,
      npv: npv, paybackYears: paybackYears,
      // composite
      cduState: cduState,
      // helpers exposed for UI band chips
      bandState: bandState
    };
  }

  var CDU_ENGINE = build();

  if (root) { root.CDU_ENGINE = CDU_ENGINE; }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CDU_ENGINE;
    module.exports.build = build;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
