/* ============================================================================
 * fire-engine.js — pure calculation engine for the DC fire-safety hub
 * ----------------------------------------------------------------------------
 * window.FIRE_ENGINE — also module.exports for tools/test-fire-calc.mjs (vm).
 *
 * GUARANTEES: pure & deterministic (NO Math.random), never mutates inputs,
 * numeric guards on every division. Formulas anchored to NFPA 2001 / 72 / 855
 * + UL 9540A (see fire-model.js authority block).
 *   Halocarbon agent mass:  W = (V/s)*(C/(100-C)),  s = k1 + k2*T   [NFPA 2001]
 *   Inert agent volume:     X = ln(100/(100-C))  (m3 agent / m3 hazard)
 * Zero-build, ES5-safe. build(injectedModel) lets the test inject a model.
 * ==========================================================================*/
(function (root) {
  'use strict';

  function resolveModel(injected) {
    if (injected) { return injected; }
    if (root && root.FIRE_MODEL) { return root.FIRE_MODEL; }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./fire-model.js'); } catch (e) { /* fall through */ }
    }
    throw new Error('FIRE_MODEL not available');
  }
  function num(x) {
    var n = typeof x === 'number' ? x : parseFloat(x);
    if (!isFinite(n)) { throw new Error('Non-finite numeric input: ' + x); }
    return n;
  }
  function posDiv(a, b) { var na = num(a), nb = num(b); if (nb === 0) { throw new Error('Division by zero'); } return na / nb; }
  function round(x, dp) { var f = Math.pow(10, dp == null ? 3 : dp); return Math.round(num(x) * f) / f; }
  function bandState(v, band) {
    if (!band) { return 'ok'; }
    var x = num(v), lo = band.min, hi = band.max;
    if (lo != null && x < lo) { return (x < lo * 0.85) ? 'alarm' : 'warn'; }
    if (hi != null && x > hi) { return (x > hi * 1.15) ? 'alarm' : 'warn'; }
    return 'ok';
  }

  function build(injectedModel) {
    var M = resolveModel(injectedModel);

    /* ---- clean-agent quantity (NFPA 2001) -------------------------------- */
    function halocarbonAgentKg(volM3, concPct, tempC, k1, k2) {
      var s = num(k1) + num(k2) * num(tempC);          // specific vapour volume m3/kg
      var C = num(concPct);
      if (C >= 100) { throw new Error('Concentration must be < 100%'); }
      return posDiv(volM3, s) * (C / (100 - C));
    }
    function inertAgentM3(volM3, concPct) {
      var C = num(concPct);
      if (C >= 100) { throw new Error('Concentration must be < 100%'); }
      return num(volM3) * Math.log(100 / (100 - C));   // ln(100/(100-C)) m3/m3
    }
    /* Resolve the design quantity for a room + agent, with safety + cylinders. */
    function agentForRoom(agentKey, volM3, tempC, concOverride) {
      var a = M.agents[agentKey];
      if (!a) { throw new Error('Unknown agent: ' + agentKey); }
      var C = (concOverride == null) ? a.designConcClassA : num(concOverride);
      var out = { agent: a.name, type: a.type, concentrationPct: C };
      if (a.type === 'inert') {
        out.quantity = round(inertAgentM3(volM3, C), 1);
        out.unit = 'm3 (NTP)';
        out.cylinders = Math.ceil(posDiv(out.quantity, a.cylinderFillM3Typical));
        out.residualO2Pct = a.o2AtDesignPct;
      } else {
        out.quantity = round(halocarbonAgentKg(volM3, C, tempC, a.k1, a.k2), 1);
        out.unit = 'kg';
        out.cylinders = Math.ceil(posDiv(out.quantity, a.cylinderFillKgTypical));
        out.kgPerM3 = round(posDiv(out.quantity, volM3), 3);
        out.co2eTonnes = round(out.quantity * a.gwp100 / 1000, 2);
      }
      out.noaelPct = a.noaelPct; out.loaelPct = a.loaelPct;
      out.safetyMarginPct = round(a.noaelPct - C, 2);
      out.occupiableOk = C <= a.noaelPct;          // design conc must not exceed NOAEL
      return out;
    }
    function safetyMarginPct(concPct, noaelPct) { return num(noaelPct) - num(concPct); }
    function occupiableOk(concPct, noaelPct) { return num(concPct) <= num(noaelPct); }
    function cylinderCount(quantity, fill) { return Math.ceil(posDiv(quantity, fill)); }
    function co2eTonnes(agentKg, gwp) { return num(agentKg) * num(gwp) / 1000; }

    /* ---- detection coverage (NFPA 72) ----------------------------------- */
    function spotDetectorCount(roomAreaM2, perDetectorAreaM2) {
      var per = num(perDetectorAreaM2 == null ? M.bands.spotDetectorAreaM2.max : perDetectorAreaM2);
      return Math.ceil(posDiv(roomAreaM2, per));
    }

    /* ---- hold time band (NFPA 2001 retention) --------------------------- */
    function holdTimeOk(minutes) { return num(minutes) >= M.bands.holdTimeMin.min; }
    function dischargeTimeOk(seconds, agentKey) {
      var a = M.agents[agentKey];
      if (a && a.type === 'inert') { return num(seconds) <= 60; } // inert <=60 s (NFPA 2001)
      return num(seconds) <= M.bands.dischargeTimeS.max;          // halocarbon <=10 s
    }

    /* ---- Lithium-ion battery thermal-runaway risk ----------------------- */
    function liIonRunawayHeatMJ(packKWh, chemKey) {
      var c = M.battery[chemKey]; if (!c) { throw new Error('Unknown chemistry: ' + chemKey); }
      var f = M.trHeatFactor[chemKey] || 0;
      return num(packKWh) * 3.6 * f;                 // kWh -> MJ stored, x TR factor
    }
    function liIonOffGasM3(packKWh, chemKey) {
      var c = M.battery[chemKey]; if (!c) { throw new Error('Unknown chemistry: ' + chemKey); }
      return num(packKWh) * 1000 * c.offGasLPerWh / 1000;  // Wh * L/Wh -> L -> m3
    }
    /* If the full off-gas released into a room, the vol% reached (vs LFL). */
    function offGasRoomConcPct(packKWh, chemKey, roomM3) {
      var gas = liIonOffGasM3(packKWh, chemKey);
      return posDiv(gas, num(roomM3) + gas) * 100;
    }
    function offGasLflMarginOk(packKWh, chemKey, roomM3) {
      var conc = offGasRoomConcPct(packKWh, chemKey, roomM3);
      // alarm at 25% LFL of the governing vent-gas LFL
      var alarmPct = M.offGas.ventGasLflPct * (M.bands.gasDetectAlarmPctLfl.max / 100);
      return conc <= alarmPct;
    }
    function runawayOnsetC(chemKey) {
      var c = M.battery[chemKey]; if (!c) { throw new Error('Unknown chemistry: ' + chemKey); }
      return c.runawayOnsetC;
    }

    /* ---- composite room assessment (one source of truth) ---------------- */
    function roomState(opts) {
      var o = opts || {};
      var V = num(o.volM3 == null ? 100 : o.volM3);
      var T = num(o.tempC == null ? 20 : o.tempC);
      var area = num(o.areaM2 == null ? V / 3 : o.areaM2);   // assume ~3 m height if not given
      var ag = agentForRoom(o.agent || 'novec1230', V, T, o.concPct);
      var det = spotDetectorCount(area);
      function tile(value, band, tag) { return { value: value, band: band, basisTag: tag || 'DERIVED', state: bandState(value, band) }; }
      var res = {
        roomVolM3: V, roomAreaM2: round(area, 1), agent: ag,
        safetyMargin: tile(ag.safetyMarginPct, M.bands.safetyMarginPct),
        spotDetectors: det,
        occupiableOk: ag.occupiableOk
      };
      if (o.packKWh != null && o.chem) {
        var heat = liIonRunawayHeatMJ(o.packKWh, o.chem);
        var gas = liIonOffGasM3(o.packKWh, o.chem);
        var conc = offGasRoomConcPct(o.packKWh, o.chem, V);
        res.liIon = {
          chem: M.battery[o.chem].name, runawayOnsetC: runawayOnsetC(o.chem),
          runawayHeatMJ: round(heat, 0), offGasM3: round(gas, 0),
          roomOffGasConcPct: tile(round(conc, 2), { max: M.offGas.ventGasLflPct * 0.25 }),
          offGasLflOk: offGasLflMarginOk(o.packKWh, o.chem, V)
        };
      }
      return res;
    }

    return {
      version: '1.0.0', model: M,
      halocarbonAgentKg: halocarbonAgentKg, inertAgentM3: inertAgentM3,
      agentForRoom: agentForRoom, safetyMarginPct: safetyMarginPct, occupiableOk: occupiableOk,
      cylinderCount: cylinderCount, co2eTonnes: co2eTonnes,
      spotDetectorCount: spotDetectorCount, holdTimeOk: holdTimeOk, dischargeTimeOk: dischargeTimeOk,
      liIonRunawayHeatMJ: liIonRunawayHeatMJ, liIonOffGasM3: liIonOffGasM3,
      offGasRoomConcPct: offGasRoomConcPct, offGasLflMarginOk: offGasLflMarginOk,
      runawayOnsetC: runawayOnsetC, roomState: roomState, bandState: bandState
    };
  }

  var FIRE_ENGINE = build();
  if (root) { root.FIRE_ENGINE = FIRE_ENGINE; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = FIRE_ENGINE; module.exports.build = build; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
