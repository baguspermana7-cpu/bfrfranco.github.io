/* ============================================================================
 * cdu-model.js — LOCKED basis-of-design for the CDU calculation hub
 * ----------------------------------------------------------------------------
 * Single immutable source of truth: window.CDU_MODEL.
 *
 * AUTHORITY (every numeric constant carries a `// source:` tag):
 *   - cdu-checklist.html  §01 operational bands, §02 water quality, §03 commissioning
 *   - cdu-selection-guide.html  vendor rows (verified datasheets) + sizing primer
 *   - cdu-mini-bms.html  per-type presets (TYPES) + fault deltas (SCEN)
 *   - ASHRAE TC 9.9 (2021) Liquid Cooling — W-classes W17..W45
 *   - OCP cold-plate fluids spec — 1.25..2.0 LPM/kW @ <=10 C rise; UQD/UQDB; Deschutes
 *   - DMTF Redfish DSP2064 v1.1.0 (CoolingUnit) ; ASME B31.3 ; ISO 4406 / NAS 1638
 *   - ASHRAE Handbook of Fundamentals 2021 ch.31 (secondary-coolant property tables)
 *   - Crane TP-410 (fitting K-values) ; Colebrook/Haaland (friction)
 *
 * basisTag legend (consumed by the UI basis-chip + ACCURACY_VALIDATION rule 6):
 *   STANDARD     — anchored to a published standard/code (ASHRAE/OCP/ASME/ISO)
 *   VENDOR       — transcribed from a manufacturer datasheet (verify_with_vendor)
 *   DERIVED      — computed downstream from STANDARD/VENDOR inputs (engine only)
 *   ILLUSTRATIVE — representative engineering value (handbook-class) where a
 *                  primary figure is not transcribable; UI shows amber chip.
 *
 * NO Math.random. NO back-solved constants. Deep-frozen. Zero-build, ES5-safe.
 * Loads in the browser via <script src> and in Node via the require()-interop
 * shim at the bottom (used by tools/test-cdu-calc.mjs in a vm sandbox).
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
   * FLUID PROPERTIES
   * Water: anchored to the cp/rho used in the datahall engine (Ex6) + IAPWS.
   * PG-25: 25 vol% propylene glycol, the OCP de-facto direct-to-chip grade.
   * Property polynomials live in the engine; these are the reference anchors
   * at a representative loop temperature (35 C) for sanity + UI display.
   * ------------------------------------------------------------------------*/
  var FLUIDS = {
    water: {
      name: 'Water (treated, ASTM D1193 Type II make-up)',
      rhoKgPerL_15C: 0.9991,   // source: IAPWS-IF97 @15 C ; basisTag STANDARD
      rhoKgPerL_35C: 0.9941,   // source: IAPWS-IF97 @35 C ; basisTag STANDARD
      cpKjPerKgK: 4.186,       // source: datahall-model.js Ex6 (CHW) ; basisTag STANDARD
      muMpas_35C: 0.7195,      // source: IAPWS @35 C (mPa.s) ; basisTag STANDARD
      kWmK_35C: 0.6225,        // source: IAPWS @35 C ; basisTag STANDARD
      basisTag: 'STANDARD'
    },
    pg25: {
      name: 'PG-25 (25 vol% propylene glycol) — OCP DTC grade',
      glycolPctVol: 25,        // source: OCP cold-plate fluids spec ; basisTag STANDARD
      rhoKgPerL_35C: 1.018,    // source: ASHRAE HoF 2021 ch.31 (PG25 ~35 C) ; basisTag ILLUSTRATIVE
      cpKjPerKgK_35C: 3.79,    // source: ASHRAE HoF 2021 ch.31 ; basisTag ILLUSTRATIVE
      muMpas_35C: 1.45,        // source: ASHRAE HoF 2021 ch.31 ; basisTag ILLUSTRATIVE
      kWmK_35C: 0.404,         // source: ASHRAE HoF 2021 ch.31 ; basisTag ILLUSTRATIVE
      freezeC: -10,            // source: OCP/PG supplier (PG25 freeze ~-10 C) ; basisTag STANDARD
      bandPctVol: { min: 20, max: 35 },   // source: cdu-checklist §03 glycol band
      basisTag: 'ILLUSTRATIVE'
    }
  };

  /* --------------------------------------------------------------------------
   * OPERATIONAL BANDS — one row each, source: cdu-checklist.html §01
   * These are the acceptance windows every derived KPI is checked against.
   * ------------------------------------------------------------------------*/
  var BANDS = {
    supplyC:        { min: 17,  max: 45  },   // source: checklist §01 (ASHRAE W-classes)
    deltaTK:        { min: 8,   max: 12  },   // source: checklist §01 "delta-T 8-12 C"
    flowLpmPerKw:   { min: 1.0, max: 1.5 },   // source: checklist §01 (OCP guidance)
    dpBar:          { min: 0.5, max: 3.0 },   // source: checklist §01 (cold-plate window)
    sysPBar:        { min: 2,   max: 6   },   // source: checklist §01 (expansion control)
    atdK:           { min: 3,   max: 5   },   // source: checklist §01 (L2L approach)
    dewMarginK:     { min: 2,   max: 3   },   // source: checklist §01 (supply >= dewpoint + 2-3 C)
    pipeVelMs:      { min: 1.5, max: 3.0 },   // source: checklist §01 (sizing criterion)
    npshMarginPct:  { min: 10,  max: 20  },   // source: checklist §01 (cavitation prevention)
    azolePpm:       { min: 100             }, // source: checklist §02 (>100 ppm azole inhibitor)
    filtrationMicron: 50                      // source: checklist §01 (integrated 50 um)
  };

  /* ASHRAE TC 9.9 water classes — max facility supply temp in C.
   * source: cdu-checklist.html §02 W-class table */
  var ASHRAE_W = [
    { id: 'W17', maxSupplyC: 17 },
    { id: 'W27', maxSupplyC: 27 },
    { id: 'W32', maxSupplyC: 32 },
    { id: 'W40', maxSupplyC: 40 },
    { id: 'W45', maxSupplyC: 45 }
  ];

  /* OCP cold-plate + Deschutes reference points.
   * source: cdu-selection-guide.html + cdu-comparison.html (OCP / Deschutes) */
  var OCP = {
    flowLpmPerKwLow: 1.25,    // source: OCP cold-plate fluids spec
    flowLpmPerKwHigh: 2.0,    // source: OCP cold-plate fluids spec
    flowLpmPerKwTyp: 1.5,     // source: OCP "1.5 typical @ <=10 C rise"
    riseAtTypFlowC: 10,       // source: OCP "<=10 C rise"
    deschutesApproachC: 3,    // source: OCP Project Deschutes (Google 2 MW DTC)
    pumpRedundancy: 'N+1',    // source: OCP Deschutes (N+1 seal-less pumps)
    uqdWorkingPsi: 100,       // source: OCP UQD/UQDB
    uqdBurstPsi: 300,         // source: OCP UQD/UQDB
    uqdMatingCycles: 5000     // source: OCP UQD/UQDB
  };

  /* Per-type presets — lifted verbatim from cdu-mini-bms.html TYPES (the SINGLE
   * source now). cap = nominal kW ; supply C ; dT K ; flow LPM/kW ; dP bar ;
   * sysP bar ; fac = facility interface (CDW liquid / AIR).
   * source: cdu-mini-bms.html TYPES object */
  var TYPES = {
    inrack:  { name: 'In-Rack',         cap: 80,   arch: 'L2L', supply: 30, dT: 10, flow: 1.30, dP: 1.2, sysP: 3.5, fac: 'CDW' },
    inrow:   { name: 'In-Row',          cap: 300,  arch: 'L2L', supply: 32, dT: 11, flow: 1.30, dP: 1.6, sysP: 4.0, fac: 'CDW' },
    sidecar: { name: 'Sidecar',         cap: 120,  arch: 'L2L', supply: 30, dT: 9,  flow: 1.20, dP: 1.1, sysP: 3.2, fac: 'CDW' },
    l2l:     { name: 'L2L · End-of-Row', cap: 1200, arch: 'L2L', supply: 34, dT: 12, flow: 1.25, dP: 2.2, sysP: 4.5, fac: 'CDW' },
    l2a:     { name: 'L2A · Air-cooled', cap: 60,   arch: 'L2A', supply: 33, dT: 9,  flow: 1.20, dP: 1.0, sysP: 3.0, fac: 'AIR' }
  };

  /* Fault-scenario deltas — lifted from cdu-mini-bms.html SCEN.
   * source: cdu-mini-bms.html SCEN object */
  var FAULT_DELTAS = {
    normal:   {},
    leak:     { leak: 1 },
    pumpfail: { pumpA: 0 },
    clog:     { dP: 2.4, filter: 1 },
    hotfws:   { supply: 9, dT: -2, atd: 4 },
    lowflow:  { flow: -0.6, dT: 5, dP: -0.5 }
  };

  /* Pipe fitting loss coefficients (K) — Crane TP-410 typical values.
   * basisTag ILLUSTRATIVE (handbook-class; confirm against project fittings). */
  var PIPE_K = {
    elbow90: 0.9,      // source: Crane TP-410 ; ILLUSTRATIVE
    elbow45: 0.4,      // source: Crane TP-410 ; ILLUSTRATIVE
    tee: 1.8,          // source: Crane TP-410 (flow through branch) ; ILLUSTRATIVE
    gateValve: 0.2,    // source: Crane TP-410 ; ILLUSTRATIVE
    ballValve: 0.05,   // source: Crane TP-410 ; ILLUSTRATIVE
    checkValve: 2.0,   // source: Crane TP-410 (swing) ; ILLUSTRATIVE
    strainer: 2.5,     // source: typical Y-strainer clean ; ILLUSTRATIVE
    qdCoupler: 1.5     // source: typical UQD pair ; ILLUSTRATIVE
  };

  /* Pipe internal diameters (mm) for common DN sizes (Sch40 steel ID).
   * source: ASME B36.10 nominal IDs ; basisTag STANDARD */
  var PIPE_ID_MM = {
    DN25: 26.6, DN32: 35.1, DN40: 40.9, DN50: 52.5,
    DN65: 62.7, DN80: 77.9, DN100: 102.3, DN125: 128.2, DN150: 154.1
  };

  /* Physical + sizing constants. */
  var PHYS = {
    gravityMs2: 9.81,            // standard gravity
    absRoughnessMm: 0.045,       // commercial steel ; source: Moody/Colebrook standard ; STANDARD
    atmPressureBar: 1.013,       // sea-level standard atmosphere ; STANDARD
    barToPa: 100000,
    dewMagnusA: 17.625,          // Alduchov-Eskridge (2006) Magnus coefficients
    dewMagnusB: 243.04           // source: Alduchov & Eskridge 2006 ; STANDARD
  };

  /* Default pump + motor efficiencies (illustrative; user-overridable). */
  var PUMP = {
    pumpEff: 0.70,               // source: typical seal-less CDU pump BEP ; ILLUSTRATIVE
    motorEff: 0.92,              // source: IE3-class motor ; ILLUSTRATIVE
    perPumpLpmDefault: 600,      // source: typical CDU duty pump ; ILLUSTRATIVE
    npshRequiredMDefault: 6      // source: typical CDU pump NPSHr ; ILLUSTRATIVE
  };

  /* TCO / ROI defaults — ALL illustrative/target. source: roi-calculator.html
   * conventions ; verify per project. basisTag ILLUSTRATIVE. */
  var TCO = {
    discountRatePct: 8,                 // ILLUSTRATIVE
    electricityUsdPerKwh: 0.12,         // ILLUSTRATIVE
    horizonYears: 10,                   // ILLUSTRATIVE
    hoursPerYear: 8760,
    capexUsdPerKw: { inrack: 280, inrow: 230, sidecar: 260, l2l: 200, l2a: 240 }, // ILLUSTRATIVE
    annualMaintPctOfCapex: { inrack: 7, inrow: 5, sidecar: 6, l2l: 5, l2a: 6 }    // ILLUSTRATIVE
  };

  /* Standards register (for UI references + data/cdu/standards-references.csv). */
  var STANDARDS = {
    ashrae: 'ASHRAE TC9.9 Liquid Cooling (2021) — W17..W45',
    ocpFlow: 'OCP cold-plate fluids — 1.25-2.0 LPM/kW @ <=10 C rise',
    ocpDeschutes: 'OCP Project Deschutes — N+1 pumps, 3 C approach',
    ocpUqd: 'OCP UQD/UQDB — 100 psi working / 300 psi burst / 5000 cycles',
    redfish: 'DMTF Redfish CoolingUnit — DSP2064 v1.1.0 (Dec 2024)',
    hydrostatic: 'ASME B31.3 — hydrostatic test 1.5x design pressure',
    cleanliness: 'ISO 4406 / NAS 1638 — flushing cleanliness',
    makeupWater: 'ASTM D1193 Type II — DI make-up water'
  };

  /* --------------------------------------------------------------------------
   * Vendor models — transcribed from cdu-selection-guide.html verified rows.
   * basisTag VENDOR ; verify_with_vendor true. Capacity / flow / dP / approach.
   * ------------------------------------------------------------------------*/
  var VENDOR_MODELS = [
    { vendor: 'Vertiv',  model: 'Liebert XDU1350', type: 'l2l',  kw: 1368, secLpm: 1200, dpBar: 2.44, approachC: 4, fluid: 'PG25', ashrae: 'W3' },
    { vendor: 'Vertiv',  model: 'CoolChip CDU 2300', type: 'l2l', kw: 2300, secLpm: 2125, dpBar: 2.40, approachC: 5, fluid: 'PG25', ashrae: 'W45' },
    { vendor: 'CoolIT',  model: 'CHx2000',        type: 'l2l',  kw: 2000, secLpm: 2125, dpBar: 2.40, approachC: 5, fluid: 'PG25', ashrae: 'W32' },
    { vendor: 'Boyd',    model: 'ROL4000 (Deschutes)', type: 'l2l', kw: 4000, secLpm: 3000, dpBar: 2.20, approachC: 3, fluid: 'PG25', ashrae: 'W32' },
    { vendor: 'Motivair', model: 'MCDU-60',       type: 'inrow', kw: 600,  secLpm: 700,  dpBar: 2.00, approachC: 4, fluid: 'PG25', ashrae: 'W32' },
    { vendor: 'ZutaCore', model: 'Waterless EoR', type: 'l2l',  kw: 1000, secLpm: 0,    dpBar: 0,    approachC: 0, fluid: 'R1233zd', ashrae: 'W27' }
  ];

  /* ---- assemble + freeze --------------------------------------------------- */
  var CDU_MODEL = {
    specVersion: '1.0.0',
    authority: 'cdu-checklist §01-03 + cdu-selection-guide vendor rows + ASHRAE TC9.9 + OCP cold-plate + Deschutes',
    fluids: FLUIDS,
    bands: BANDS,
    ashraeWClasses: ASHRAE_W,
    ocp: OCP,
    types: TYPES,
    faultDeltas: FAULT_DELTAS,
    pipeK: PIPE_K,
    pipeIdMm: PIPE_ID_MM,
    phys: PHYS,
    pump: PUMP,
    tco: TCO,
    standards: STANDARDS,
    vendorModels: VENDOR_MODELS
  };

  deepFreeze(CDU_MODEL);

  if (root) { root.CDU_MODEL = CDU_MODEL; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = CDU_MODEL; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
