/* ============================================================================
 * datahall-model.js — LOCKED basis-of-design for the AI Data Hall dashboard
 * ----------------------------------------------------------------------------
 * Stage 1 of the datahallAI.html major revision (Task #87 / v1.20.x).
 *
 * Single immutable source of truth: window.DATAHALL_MODEL.
 *
 * AUTHORITY (read in this order, all under
 *   /home/baguspermana7/Documents/screenshot bms rz/dc ai/review/):
 *   1. BASELINE-DECISION.md          — LOCKED basis-of-design (overrides all).
 *   2. 00-overview-audit.md          — Core Calculation Engine + Source Sanity.
 *   3. 21-calculation-worked-examples.md — Examples 1–10 = acceptance tests.
 *   4. 17-basis-of-design-correction-table.md — Scenario A / B value tables.
 *   5. 12-engineering-justification-deep-dive.md — derivations.
 *
 * Every numeric constant carries a `// source:` comment citing the spec doc
 * line or a Source-Sanity reference. NO Math.random. NO back-solved constants.
 * The chiller COP used downstream is the NAMEPLATE COP from doc-21 Example 9
 * (COP 6.8) — it is NOT calibrated to hit any target PUE.
 *
 * Zero-build, ES5-safe, no imports. Loads in the browser via <script src> and
 * in Node via the require()-interop shim at the bottom (used by the test).
 * Deep-frozen with Object.freeze so no tab can mutate the basis at runtime.
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* Deep-freeze helper (ES5-safe). Prevents any tab from mutating the basis. */
  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') { return obj; }
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v && typeof v === 'object' && !Object.isFrozen(v)) { deepFreeze(v); }
    }
    return Object.freeze(obj);
  }

  /* --------------------------------------------------------------------------
   * COMPUTE BASELINE
   * source: BASELINE-DECISION.md "LOCKED basis-of-design" table (lines 8-21)
   * source: 17-basis-of-design-correction-table.md "Scenario A" (lines 9-30)
   * ------------------------------------------------------------------------*/
  var FACILITY_HALLS = 4;          // source: BASELINE-DECISION.md "Facility | 4 data halls"
  var NVL72_PER_HALL = 27;         // source: BASELINE-DECISION.md "Per hall | 27 NVL72 domains"
  var GPU_PER_NVL72 = 72;          // source: BASELINE-DECISION.md "Per NVL72 | 72 Blackwell GPU"
  var CPU_PER_NVL72 = 36;          // source: BASELINE-DECISION.md "36 Grace CPU"
  var RACKS_PER_NVL72 = 2;         // source: 21-calculation-worked-examples.md Ex1 "1 NVL72 domain = 2 physical rack concept"
  var LIQUID_CAPTURE = 0.85;       // source: BASELINE-DECISION.md "Liquid capture | 85%"
  var TCS_SUPPLY_C = 35;           // source: BASELINE-DECISION.md "TCS supply/return | 35 / 45 °C"
  var TCS_RETURN_C = 45;           // source: BASELINE-DECISION.md "35 / 45 °C (ΔT 10 K)"
  var TCS_DELTA_T_K = 10;          // source: BASELINE-DECISION.md "(ΔT 10 K)"

  /* Scenario A (LOCKED / adopted): 132 kW per NVL72 pair → 66 kW/physical rack */
  var SCEN_A_KW_PER_NVL72 = 132;   // source: BASELINE-DECISION.md "Adopted load | 132 kW per NVL72 (NOT per rack)"
  /* Scenario B (variant, must be exposed so the UI can label which is shown):
   * 132 kW per PHYSICAL rack → 264 kW/NVL72 pair → 7,128 kW/hall.
   * source: 21-calculation-worked-examples.md Ex1 "power per physical rack = 132 kW"
   * source: 17-basis-of-design-correction-table.md "Scenario B" (lines 36-64) */
  var SCEN_B_KW_PER_RACK = 132;    // source: 17-correction-table.md Scenario B "Power per physical rack | 132 kW"

  var RACKS_PER_HALL = NVL72_PER_HALL * RACKS_PER_NVL72;            // 54
  var GPU_PER_HALL = NVL72_PER_HALL * GPU_PER_NVL72;                // 1944
  var GPU_PER_FACILITY = GPU_PER_HALL * FACILITY_HALLS;            // 7776

  /* --------------------------------------------------------------------------
   * WATER PROPERTIES (chilled / TCS water — Example 6 & deep-dive §6)
   * source: 21-calculation-worked-examples.md Ex6 "rho = 1.0 kg/L; Cp = 4.186 kJ/kgK"
   * ------------------------------------------------------------------------*/
  var WATER_RHO_KG_PER_L = 1.0;        // source: 21-worked-examples.md Ex6 "rho = 1.0 kg/L"
  var WATER_RHO_KG_PER_M3 = 1000;      // source: 21-worked-examples.md Ex8 "1000 ... 4.186 ... 5"
  var WATER_CP_KJ_PER_KGK = 4.186;     // source: 21-worked-examples.md Ex6 "Cp = 4.186 kJ/kgK"

  /* --------------------------------------------------------------------------
   * ELECTRICAL DISTRIBUTION
   * source: 21-calculation-worked-examples.md Ex3/Ex4 (V=400, PF=0.96)
   * source: 12-engineering-justification-deep-dive.md §2 (sqrt3 formula)
   * ------------------------------------------------------------------------*/
  var LV_VOLTAGE_LL = 400;             // source: 21-worked-examples.md Ex3 "V = 400"
  var POWER_FACTOR = 0.96;             // source: 21-worked-examples.md Ex3 "PF = 0.96"
  var SQRT3 = 1.7320508075688772;      // sqrt(3); spec uses 1.732 (see test tolerance)
  var SPEC_SQRT3 = 1.732;              // source: 21-worked-examples.md Ex3 "1.732 x 400 x 0.96"

  /* Real equipment families — corrected ratings, NO fictional 8 MW Cat 3516E.
   * source: 00-overview-audit.md "Source Sanity References" (lines 127-132)
   * source: 17-basis-of-design-correction-table.md "Values To Remove Or Replace" */
  var EQUIPMENT = {
    ups: {
      /* source: 17-correction-table.md Scenario A "UPS per feed | 4.5 MW plausible"
       * source: 21-worked-examples.md Ex2 "UPS feed = 4,500 kW" */
      model: 'Modular UPS, 2N A/B',
      ratingKW: 4500,
      topology: '2N'
    },
    transformer: {
      /* source: 17-correction-table.md Scenario A "Transformer per feed | 5 MVA plausible"
       * source: 21-worked-examples.md Ex4 "5MVA transformer" */
      model: 'Cast-resin distribution transformer',
      ratingMVA: 5,
      conservativeMVA: 10        // source: 17-correction-table.md "10 MVA conservative"
    },
    busway: {
      /* source: 21-worked-examples.md Ex3 "4000A busway is undersized ... 6300A is plausible"
       * source: 17-correction-table.md Scenario A "Busway needed per feed | around 5.35 kA" */
      undersizedRatingA: 4000,
      selectedRatingA: 6300
    },
    generator: {
      /* source: 00-overview-audit.md Source Sanity "Caterpillar 3516E: 2,500-2,750 ekW"
       * source: BASELINE-DECISION.md line 26 "Cat 3516E ≈ 2.5–2.75 MW, NOT 8 MW" */
      model: 'Caterpillar 3516E',
      ratingKW_low: 2500,
      ratingKW_high: 2750,
      ratingKW: 2750
    },
    cdu: {
      /* source: 21-worked-examples.md Ex7 "If CDU = 350 kW" (EoR CDU sizing basis)
       * Source-Sanity Vertiv CoolChip CDU 121 = 121 kW (per-rack class) is noted
       * but Ex7's running-count math uses the 350 kW EoR CDU. */
      model: '350 kW end-of-row CDU',
      ratingKW: 350,
      coolChipNoteKW: 121        // source: 00-overview-audit.md Source Sanity "Vertiv CoolChip CDU 121: 121 kW"
    },
    chiller: {
      /* source: 00-overview-audit.md Source Sanity "Carrier 19DV: 1,231-4,044 kW"
       * NAMEPLATE COP from doc-21 Ex9 ("COP = 6.8") — used as-is, NOT calibrated.
       * source: 21-worked-examples.md Ex9 "COP = 6.8" */
      model: 'Carrier 19DV water-cooled centrifugal',
      ratingKW_low: 1231,
      ratingKW_high: 4044,
      nameplateCOP: 6.8
    },
    crah: {
      /* source: 21-worked-examples.md Ex8 "active CRAH = 5" (residual-air sizing) */
      activeUnits: 5,
      chwDeltaT_K: 5             // source: 21-worked-examples.md Ex8 "Water flow at 5K"
    }
  };

  /* --------------------------------------------------------------------------
   * PUE BOTTOM-UP ANCILLARY ASSUMPTIONS
   * source: 21-calculation-worked-examples.md Example 9 (the ONLY fully-worked
   * PUE in the spec). Ex9 is stated for Scenario B (IT = 7,128 kW) with:
   *   chiller_input = coolingHeat / COP   (coolingHeat = full IT, COP = 6.8)
   *   pumps 200, fans 250, CDU pumps 120, CRAH fans 80,
   *   UPS/dist loss 300, aux 150  → non-IT = 2,148 → PUE = 1.30
   * These six ancillary figures are the Scenario-B REFERENCE point. The engine
   * scales the load-proportional ones by (IT / 7128) for Scenario A, using the
   * SAME methodology and the SAME nameplate COP. NOTHING is back-solved.
   * ------------------------------------------------------------------------*/
  var PUE_REF = {
    refScenario: 'B',
    refIT_kW: 7128,              // source: 21-worked-examples.md Ex9 "cooling heat = 7,128 kW"
    refCOP: 6.8,                 // source: 21-worked-examples.md Ex9 "COP = 6.8"
    refPumps_kW: 200,            // source: 21-worked-examples.md Ex9 "pumps = 200 kW"
    refFans_kW: 250,             // source: 21-worked-examples.md Ex9 "fans = 250 kW"
    refCduPumps_kW: 120,         // source: 21-worked-examples.md Ex9 "CDU pumps = 120 kW"
    refCrahFans_kW: 80,          // source: 21-worked-examples.md Ex9 "CRAH fans = 80 kW"
    refUpsDistLoss_kW: 300,      // source: 21-worked-examples.md Ex9 "UPS/distribution loss = 300 kW"
    refAux_kW: 150               // source: 21-worked-examples.md Ex9 "aux = 150 kW"
  };

  /* --------------------------------------------------------------------------
   * FIRE-PROTECTED DATA HALL VOLUME (Example 10)
   * source: 21-calculation-worked-examples.md Ex10 "length 32, width 20, height 4.2"
   * ------------------------------------------------------------------------*/
  var DATA_HALL_GEOMETRY = {
    lengthM: 32,                 // source: 21-worked-examples.md Ex10 "length = 32 m"
    widthM: 20,                  // source: 21-worked-examples.md Ex10 "width = 20 m"
    heightM: 4.2                 // source: 21-worked-examples.md Ex10 "height = 4.2 m"
  };

  /* --------------------------------------------------------------------------
   * SCENARIO DEFINITIONS
   * Scenario A is LOCKED/adopted. Scenario B is exposed so the UI can label
   * which interpretation (per-NVL72 vs per-rack) a number belongs to —
   * required by 21-worked-examples.md Ex1 "Review comment".
   * ------------------------------------------------------------------------*/
  var scenarioA = {
    id: 'A',
    label: '132 kW per NVL72 pair (adopted / locked)',
    kwPerNVL72: SCEN_A_KW_PER_NVL72,                       // 132
    kwPerRack: SCEN_A_KW_PER_NVL72 / RACKS_PER_NVL72,      // 66
    itPerHall_kW: NVL72_PER_HALL * SCEN_A_KW_PER_NVL72,    // 3564
    itPerFacility_kW: NVL72_PER_HALL * SCEN_A_KW_PER_NVL72 * FACILITY_HALLS, // 14256
    locked: true
  };
  var scenarioB = {
    id: 'B',
    label: '132 kW per physical rack (aggressive variant)',
    kwPerRack: SCEN_B_KW_PER_RACK,                          // 132
    kwPerNVL72: SCEN_B_KW_PER_RACK * RACKS_PER_NVL72,       // 264
    itPerHall_kW: RACKS_PER_HALL * SCEN_B_KW_PER_RACK,      // 7128
    itPerFacility_kW: RACKS_PER_HALL * SCEN_B_KW_PER_RACK * FACILITY_HALLS, // 28512
    locked: false
  };

  var MODEL = {
    specVersion: 'review-2026-05-17',
    authority: 'BASELINE-DECISION.md (locked 2026-05-17) — overrides all conflicts',

    facility: {
      halls: FACILITY_HALLS,
      nvl72PerHall: NVL72_PER_HALL,
      racksPerNVL72: RACKS_PER_NVL72,
      racksPerHall: RACKS_PER_HALL,
      gpuPerNVL72: GPU_PER_NVL72,
      cpuPerNVL72: CPU_PER_NVL72,
      gpuPerHall: GPU_PER_HALL,
      gpuPerFacility: GPU_PER_FACILITY
    },

    /* The adopted, locked operating case. */
    locked: scenarioA,
    scenarios: { A: scenarioA, B: scenarioB },

    cooling: {
      liquidCaptureRatio: LIQUID_CAPTURE,
      tcsSupplyC: TCS_SUPPLY_C,
      tcsReturnC: TCS_RETURN_C,
      tcsDeltaT_K: TCS_DELTA_T_K,
      water: {
        rhoKgPerL: WATER_RHO_KG_PER_L,
        rhoKgPerM3: WATER_RHO_KG_PER_M3,
        cpKjPerKgK: WATER_CP_KJ_PER_KGK
      }
    },

    electrical: {
      voltageLL: LV_VOLTAGE_LL,
      powerFactor: POWER_FACTOR,
      sqrt3: SQRT3,
      specSqrt3: SPEC_SQRT3
    },

    equipment: EQUIPMENT,
    pueRef: PUE_REF,
    geometry: DATA_HALL_GEOMETRY,

    /* PUE design band (a TARGET, not a derived guarantee). The engine reports
     * the honest bottom-up PUE even if it falls outside this band. */
    pueDesignBand: { min: 1.12, max: 1.25 }   // source: BASELINE-DECISION.md "PUE (design) | 1.12 – 1.25"
  };

  deepFreeze(MODEL);

  /* Browser global. */
  if (root) { root.DATAHALL_MODEL = MODEL; }

  /* Node-interop shim (used by tools/test-datahall-calc.mjs running in vm). */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MODEL;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
