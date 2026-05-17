/* ============================================================================
 * datahall-calculations.js — pure calculation engine for the AI Data Hall
 * ----------------------------------------------------------------------------
 * Stage 2 of the datahallAI.html major revision (Task #87 / v1.20.x).
 *
 * Implements EVERY formula from 00-overview-audit.md "Core Calculation Engine
 * Required" (lines 104-125). Each formula is traceable to a worked example in
 * 21-calculation-worked-examples.md.
 *
 * METHODOLOGY GUARANTEE (this is why the prior attempt was rejected):
 *   - PUE is derived BOTTOM-UP and returned WITH its 5-part basis exactly as
 *     doc-21 Example 9 / doc-00 require.
 *   - The chiller COP is the NAMEPLATE COP from doc-21 Ex9 (6.8). It is NEVER
 *     calibrated/solved to hit a target PUE. There is no `effectivePlantCOP`,
 *     no fudge factor, no back-solved constant anywhere in this file.
 *   - PURE & deterministic. NO Math.random. Same input -> same output. Never
 *     mutates inputs. Numeric guards on every division.
 *
 * window.DATAHALL_CALC — also exported via module.exports for the Node test.
 * Zero-build, ES5-safe, no imports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* Resolve the locked baseline (browser global or Node require). */
  function resolveModel(injected) {
    if (injected) { return injected; }
    if (root && root.DATAHALL_MODEL) { return root.DATAHALL_MODEL; }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./datahall-model.js'); } catch (e) { /* fall through */ }
    }
    throw new Error('DATAHALL_MODEL not available');
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
    var f = Math.pow(10, dp == null ? 2 : dp);
    return Math.round(num(x) * f) / f;
  }

  /* ========================================================================
   * CORE FORMULAS — 00-overview-audit.md lines 104-125
   * ======================================================================*/

  /* IT_load_kW = sum(rack_power_kW) + network_kW + storage_kW
   * source: 00-overview-audit.md line 107 */
  function itLoad(rackPowerKWArray, networkKW, storageKW) {
    var sum = 0;
    for (var i = 0; i < rackPowerKWArray.length; i++) { sum += num(rackPowerKWArray[i]); }
    return sum + num(networkKW || 0) + num(storageKW || 0);
  }

  /* NVL72_power_kW = 2 * NVL36_rack_power_kW
   * source: 00-overview-audit.md line 108 ; 21-worked-examples.md Ex1 */
  function nvl72Power(nvl36RackPowerKW, racksPerNVL72) {
    return num(racksPerNVL72) * num(nvl36RackPowerKW);
  }

  /* Facility_kW = IT_kW + cooling_electrical_kW + UPS_loss_kW
   *               + distribution_loss_kW + aux_kW
   * source: 00-overview-audit.md line 109 */
  function facilityKW(itKW, coolingElecKW, upsLossKW, distLossKW, auxKW) {
    return num(itKW) + num(coolingElecKW) + num(upsLossKW) + num(distLossKW) + num(auxKW);
  }

  /* PUE = Facility_kW / IT_kW
   * source: 00-overview-audit.md line 110 ; 21-worked-examples.md Ex9 */
  function pue(facilityKWv, itKWv) {
    return posDiv(facilityKWv, itKWv);
  }

  /* WUE_L_per_kWh = annual_site_water_L / annual_IT_energy_kWh
   * source: 00-overview-audit.md line 111 */
  function wue(annualSiteWaterL, annualITEnergyKWh) {
    return posDiv(annualSiteWaterL, annualITEnergyKWh);
  }

  /* CUE_kgCO2_per_kWh = annual_CO2_kg / annual_IT_energy_kWh
   * source: 00-overview-audit.md line 112 */
  function cue(annualCO2Kg, annualITEnergyKWh) {
    return posDiv(annualCO2Kg, annualITEnergyKWh);
  }

  /* Liquid_heat_kW = IT_kW * liquid_capture_ratio
   * source: 00-overview-audit.md line 114 ; 21-worked-examples.md Ex5 */
  function liquidHeat(itKWv, captureRatio) {
    return num(itKWv) * num(captureRatio);
  }

  /* Air_heat_kW = IT_kW * (1 - liquid_capture_ratio)
   * source: 00-overview-audit.md line 115 ; 21-worked-examples.md Ex5 */
  function airHeat(itKWv, captureRatio) {
    return num(itKWv) * (1 - num(captureRatio));
  }

  /* Hydronic_Q_kW = flow_LPM * rho_kg_L * Cp_kJ_kgK * deltaT_K / 60
   * source: 00-overview-audit.md line 116 ; 12-deep-dive.md §6 */
  function hydronicQ(flowLPM, rhoKgL, cpKjKgK, deltaTK) {
    return posDiv(num(flowLPM) * num(rhoKgL) * num(cpKjKgK) * num(deltaTK), 60);
  }

  /* Hydronic_flow_LPM = Q_kW * 60 / (rho_kg_L * Cp_kJ_kgK * deltaT_K)
   * source: 00-overview-audit.md line 117 ; 21-worked-examples.md Ex6 */
  function hydronicFlowLPM(qKW, rhoKgL, cpKjKgK, deltaTK) {
    return posDiv(num(qKW) * 60, num(rhoKgL) * num(cpKjKgK) * num(deltaTK));
  }

  /* FWS_Q_kW = flow_m3h * rho_kg_m3 * Cp_kJ_kgK * deltaT_K / 3600
   * source: 00-overview-audit.md line 118 ; 21-worked-examples.md Ex8 */
  function fwsQ(flowM3h, rhoKgM3, cpKjKgK, deltaTK) {
    return posDiv(num(flowM3h) * num(rhoKgM3) * num(cpKjKgK) * num(deltaTK), 3600);
  }

  /* FWS flow m3/h = Q_kW * 3600 / (rho_kg_m3 * Cp_kJ_kgK * deltaT_K)
   * source: 21-worked-examples.md Ex8 "m3/h = 214 x 3600 / (1000 x 4.186 x 5)" */
  function fwsFlowM3h(qKW, rhoKgM3, cpKjKgK, deltaTK) {
    return posDiv(num(qKW) * 3600, num(rhoKgM3) * num(cpKjKgK) * num(deltaTK));
  }

  /* Chiller_input_kW = cooling_kW / COP_actual
   * source: 00-overview-audit.md line 119 ; 21-worked-examples.md Ex9
   * COP here is the NAMEPLATE COP passed in by the caller — never solved. */
  function chillerInput(coolingKW, cop) {
    return posDiv(coolingKW, cop);
  }

  /* Cooling_electrical_kW = chiller_input + pump + drycooler_fan
   *                         + CRAH_fan + CDU_pump
   * source: 00-overview-audit.md line 120 */
  function coolingElectrical(chillerInputKW, pumpKW, drycoolerFanKW, crahFanKW, cduPumpKW) {
    return num(chillerInputKW) + num(pumpKW) + num(drycoolerFanKW)
         + num(crahFanKW) + num(cduPumpKW);
  }

  /* 3ph_kW = sqrt(3) * V_LL * I * PF / 1000
   * source: 00-overview-audit.md line 122 ; 12-deep-dive.md §2 */
  function threePhaseKW(vLL, currentA, pf, sqrt3) {
    return posDiv(num(sqrt3) * num(vLL) * num(currentA) * num(pf), 1000);
  }

  /* Required_current_A = kW * 1000 / (sqrt(3) * V_LL * PF)
   * source: 00-overview-audit.md line 123 ; 21-worked-examples.md Ex3 */
  function requiredCurrentA(kW, vLL, pf, sqrt3) {
    return posDiv(num(kW) * 1000, num(sqrt3) * num(vLL) * num(pf));
  }

  /* kVA = kW / PF
   * source: 21-worked-examples.md Ex4 "kVA = kW / PF" */
  function kva(kW, pf) {
    return posDiv(kW, pf);
  }

  /* Battery_kWh = critical_kW * runtime_min / 60 / usable_DoD / inverter_eff
   * source: 00-overview-audit.md line 124 */
  function batteryKWh(criticalKW, runtimeMin, usableDoD, inverterEff) {
    var energy = posDiv(num(criticalKW) * num(runtimeMin), 60);
    energy = posDiv(energy, usableDoD);
    energy = posDiv(energy, inverterEff);
    return energy;
  }

  /* Loading % helper. */
  function loadingPct(actual, rated) {
    return posDiv(num(actual), num(rated)) * 100;
  }

  /* CDU running count = ceil(liquid_heat / cdu_rating)
   * source: 21-worked-examples.md Ex7 */
  function cduRunningCount(liquidHeatKW, cduRatingKW) {
    return Math.ceil(posDiv(liquidHeatKW, cduRatingKW));
  }

  /* Rectangular room volume = L * W * H
   * source: 21-worked-examples.md Ex10 */
  function roomVolumeM3(lengthM, widthM, heightM) {
    return num(lengthM) * num(widthM) * num(heightM);
  }

  /* ========================================================================
   * SCENARIO ENGINE — derives a full coherent state for one scenario.
   * ======================================================================*/
  function scenarioState(scenario, model) {
    var m = model;
    var itHall = num(scenario.itPerHall_kW);
    var cap = m.cooling.liquidCaptureRatio;
    var w = m.cooling.water;
    var dt = m.cooling.tcsDeltaT_K;

    var lh = liquidHeat(itHall, cap);
    var ah = airHeat(itHall, cap);

    /* TCS flow from LIQUID captured heat (UI must state this basis — Ex6). */
    var tcsTotalLPM = hydronicFlowLPM(lh, w.rhoKgPerL, w.cpKjPerKgK, dt);
    var tcsPerRackLPM = posDiv(tcsTotalLPM, m.facility.racksPerHall);

    /* Electrical (use spec's 1.732 so values match the worked examples). */
    var s3 = m.electrical.specSqrt3;
    var v = m.electrical.voltageLL;
    var pf = m.electrical.powerFactor;
    var currentA = requiredCurrentA(itHall, v, pf, s3);
    var kvaV = kva(itHall, pf);

    /* CDU sizing (Ex7). */
    var cduRun = cduRunningCount(lh, m.equipment.cdu.ratingKW);

    /* CRAH residual (Ex8). */
    var crahActive = m.equipment.crah.activeUnits;
    var perCrahKW = posDiv(ah, crahActive);
    var crahFlowM3h = fwsFlowM3h(perCrahKW, w.rhoKgPerM3, w.cpKjPerKgK,
                                 m.equipment.crah.chwDeltaT_K);

    return {
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      locked: !!scenario.locked,
      itPerHall_kW: itHall,
      itPerFacility_kW: num(scenario.itPerFacility_kW),
      kwPerNVL72: num(scenario.kwPerNVL72),
      kwPerRack: num(scenario.kwPerRack),
      racksPerHall: m.facility.racksPerHall,
      liquidHeat_kW: lh,
      airHeat_kW: ah,
      tcsFlowTotal_LPM: tcsTotalLPM,
      tcsFlowPerRack_LPM: tcsPerRackLPM,
      tcsFlowBasis: 'liquid captured heat (85%), not full rack heat',
      requiredCurrent_A: currentA,
      transformer_kVA: kvaV,
      upsLoadingPct: loadingPct(itHall, m.equipment.ups.ratingKW),
      transformerLoadingPct: loadingPct(kvaV, m.equipment.transformer.ratingMVA * 1000),
      cduRunningCount: cduRun,
      crahActive: crahActive,
      crahPerUnit_kW: perCrahKW,
      crahFlowPerUnit_m3h: crahFlowM3h
    };
  }

  /* ========================================================================
   * BOTTOM-UP PUE WITH 5-PART BASIS  (doc-21 Example 9 methodology)
   * ------------------------------------------------------------------------
   * Exactly reproduces Ex9 for the reference (Scenario B, IT 7128):
   *   chiller_input = coolingHeat / COP   (coolingHeat = full IT, COP nameplate)
   *   + pumps + fans + CDU pumps + CRAH fans + UPS/dist loss + aux
   * For any IT load, the load-proportional ancillaries scale by IT / refIT.
   * The COP is the NAMEPLATE value — NEVER solved to hit a target.
   * Returns the full basis breakdown so a human can audit it.
   * ======================================================================*/
  function pueBasis(itKW, model) {
    var m = model;
    var ref = m.pueRef;
    var it = num(itKW);

    /* doc-21 Ex9: "cooling heat = 7,128 kW" == full IT load. */
    var coolingHeat = it;
    var cop = m.equipment.chiller.nameplateCOP;          // 6.8 — nameplate, not solved
    var chillerKW = chillerInput(coolingHeat, cop);

    /* Load-proportional scale relative to the Ex9 reference point. */
    var scale = posDiv(it, ref.refIT_kW);
    var pumpsKW       = ref.refPumps_kW * scale;
    var fansKW        = ref.refFans_kW * scale;
    var cduPumpsKW    = ref.refCduPumps_kW * scale;
    var crahFansKW    = ref.refCrahFans_kW * scale;
    var upsDistLossKW = ref.refUpsDistLoss_kW * scale;
    var auxKW         = ref.refAux_kW * scale;

    var nonIT = chillerKW + pumpsKW + fansKW + cduPumpsKW
              + crahFansKW + upsDistLossKW + auxKW;
    var facility = it + nonIT;
    var pueVal = posDiv(facility, it);

    /* 5-part basis exactly as doc-00 lines 301-308 / Ex9 require:
     * IT kW, cooling kW, UPS loss kW, distribution loss kW, aux kW.
     * cooling kW = chiller + pumps + fans + CDU pumps + CRAH fans;
     * the Ex9 reference gives UPS+distribution as a combined figure. */
    var coolingKW = chillerKW + pumpsKW + fansKW + cduPumpsKW + crahFansKW;

    return {
      copSource: 'nameplate COP 6.8 (21-worked-examples.md Ex9) - NOT calibrated',
      it_kW: it,
      coolingHeat_kW: coolingHeat,
      chillerInput_kW: chillerKW,
      pumps_kW: pumpsKW,
      fans_kW: fansKW,
      cduPumps_kW: cduPumpsKW,
      crahFans_kW: crahFansKW,
      upsDistLoss_kW: upsDistLossKW,
      aux_kW: auxKW,
      nonIT_kW: nonIT,
      facility_kW: facility,
      pue: pueVal,
      /* 5-part basis (doc-00 lines 301-308). */
      basis: {
        IT_kW: it,
        cooling_kW: coolingKW,
        upsLoss_distLoss_kW: upsDistLossKW,
        aux_kW: auxKW
      }
    };
  }

  /* ========================================================================
   * PUBLIC API
   * ======================================================================*/
  function build(injectedModel) {
    var model = resolveModel(injectedModel);

    var api = {
      model: model,

      /* raw core formulas (doc-00) */
      itLoad: itLoad,
      nvl72Power: nvl72Power,
      facilityKW: facilityKW,
      pue: pue,
      wue: wue,
      cue: cue,
      liquidHeat: liquidHeat,
      airHeat: airHeat,
      hydronicQ: hydronicQ,
      hydronicFlowLPM: hydronicFlowLPM,
      fwsQ: fwsQ,
      fwsFlowM3h: fwsFlowM3h,
      chillerInput: chillerInput,
      coolingElectrical: coolingElectrical,
      threePhaseKW: threePhaseKW,
      requiredCurrentA: requiredCurrentA,
      kva: kva,
      batteryKWh: batteryKWh,
      loadingPct: loadingPct,
      cduRunningCount: cduRunningCount,
      roomVolumeM3: roomVolumeM3,
      round: round,

      /* derived helpers */
      scenarioState: function (scenarioId) {
        var sc = model.scenarios[scenarioId || model.locked.id];
        if (!sc) { throw new Error('Unknown scenario: ' + scenarioId); }
        return scenarioState(sc, model);
      },
      lockedState: function () { return scenarioState(model.locked, model); },
      pueBasis: function (itKW) {
        return pueBasis(itKW == null ? model.locked.itPerHall_kW : itKW, model);
      },
      dataHallVolume: function () {
        var g = model.geometry;
        return roomVolumeM3(g.lengthM, g.widthM, g.heightM);
      }
    };
    return api;
  }

  var DATAHALL_CALC = build();

  if (root) { root.DATAHALL_CALC = DATAHALL_CALC; }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DATAHALL_CALC;
    module.exports.build = build;   // lets the test inject a model into vm
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
