/* ============================================================================
 * fire-model.js — LOCKED basis-of-design for the DC fire-safety calculation hub
 * ----------------------------------------------------------------------------
 * Single immutable source of truth: window.FIRE_MODEL.
 *
 * AUTHORITY (every numeric constant carries a `// source:` tag + basisTag):
 *   - NFPA 2001 (2022) Clean Agent Fire Extinguishing Systems — agent quantity
 *     equations, design concentrations, NOAEL/LOAEL, the s = k1 + k2*T coefficients.
 *   - NFPA 72 (detection), NFPA 75/76 (IT/telecom fire protection), NFPA 13
 *     (sprinkler), NFPA 855 (stationary energy storage), NFPA 70 (EPO/NEC).
 *   - UL 9540 / UL 9540A:2024 (ESS safety + thermal-runaway fire propagation test),
 *     IEC 62619 (Li-ion stationary safety).
 *   - Li-ion thermal-runaway onset: Nature Sci. Reports 2024 (via repo FMECA doc
 *     docs/research/2026-05-23-fmeca-kg-worldwide-asset-failure-data.md §5).
 *   - FM Global DS 5-32 ; ISO 14520 (gaseous suppression).
 *
 * basisTag legend (UI basis-chip + ACCURACY_VALIDATION rule 6):
 *   STANDARD / VENDOR / DERIVED / ILLUSTRATIVE  (amber chip for ILLUSTRATIVE).
 *
 * NO Math.random. NO back-solved constants. Deep-frozen. Zero-build, ES5-safe.
 * Browser <script src> + Node require()-interop shim (used by tools/test-fire-calc.mjs).
 * ==========================================================================*/
(function (root) {
  'use strict';

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
   * CLEAN AGENTS — NFPA 2001 design data.
   * type 'halocarbon' uses the mass equation W = (V/s)*(C/(100-C)), s=k1+k2*T.
   * type 'inert' uses the volume equation X = 2.303*log10(100/(100-C)) m3/m3.
   * designConcClassA = typical Class-A (surface) design concentration (%).
   * NOAEL/LOAEL = occupant-safety thresholds (%).  GWP = 100-yr.
   * ------------------------------------------------------------------------*/
  var AGENTS = {
    novec1230: {
      name: 'Novec 1230 (FK-5-1-12)', type: 'halocarbon',
      k1: 0.0664, k2: 0.0002741,        // source: NFPA 2001 Table (FK-5-1-12) ; STANDARD
      designConcClassA: 4.7,            // source: NFPA 2001 (min ext ~3.5-4.2, design w/ safety) ; STANDARD
      minExtinguishPct: 3.5,            // source: NFPA 2001 ; STANDARD
      noaelPct: 10.0, loaelPct: 10.0,   // source: NFPA 2001 A.1.5 ; STANDARD
      gwp100: 1, atmosphericLifeYr: 0.014, // source: 3M / IPCC ; STANDARD (5-day life)
      cylinderFillKgTypical: 100,       // source: typical 180 L cylinder fill ; ILLUSTRATIVE
      priceUsdPerKg: 60                 // ILLUSTRATIVE
    },
    fm200: {
      name: 'FM-200 (HFC-227ea)', type: 'halocarbon',
      k1: 0.1269, k2: 0.0005132,        // source: NFPA 2001 Table (HFC-227ea) ; STANDARD
      designConcClassA: 7.0,            // source: NFPA 2001 (min ext ~5.8, design ~6.25-7) ; STANDARD
      minExtinguishPct: 5.8,            // source: NFPA 2001 ; STANDARD
      noaelPct: 9.0, loaelPct: 10.5,    // source: NFPA 2001 A.1.5 ; STANDARD
      gwp100: 3220, atmosphericLifeYr: 36, // source: IPCC AR5/AR6 ; STANDARD
      cylinderFillKgTypical: 120,       // ILLUSTRATIVE
      priceUsdPerKg: 35                 // ILLUSTRATIVE
    },
    ig541: {
      name: 'IG-541 (Inergen: 52% N2 / 40% Ar / 8% CO2)', type: 'inert',
      designConcClassA: 37.5,           // source: NFPA 2001 (design ~37.5-43%) ; STANDARD
      minExtinguishPct: 34.2,           // source: NFPA 2001 ; STANDARD
      noaelPct: 43, loaelPct: 52,       // source: NFPA 2001 A.1.5 ; STANDARD
      o2AtDesignPct: 12.5,              // source: NFPA 2001 (residual O2 ~12.5%) ; STANDARD
      gwp100: 0, atmosphericLifeYr: 0,
      cylinderFillM3Typical: 22.3,      // source: typical 80 L @150 bar ~22 m3 NTP ; ILLUSTRATIVE
      priceUsdPerM3: 4                  // ILLUSTRATIVE
    }
  };

  /* --------------------------------------------------------------------------
   * LITHIUM-ION (and VRLA) BATTERY chemistry — thermal-runaway risk basis.
   * runawayOnsetC = self-heating onset / TR trigger temperature.
   * offGasLPerWh = representative vent-gas volume per Wh during runaway.
   * source: Nature Sci. Reports 2024 (via FMECA doc §5 F5.2/F5.4) ; UL 9540A.
   * ------------------------------------------------------------------------*/
  var BATTERY = {
    nmc:  { name: 'Li-ion NMC', runawayOnsetC: 150,   energyWhPerKg: 220, offGasLPerWh: 4.0, offGasSpecies: 'H2, CO, CO2, electrolyte vapour, hydrocarbons', basisTag: 'STANDARD' },
    lfp:  { name: 'Li-ion LFP', runawayOnsetC: 166.8, energyWhPerKg: 140, offGasLPerWh: 2.0, offGasSpecies: 'H2, CO, CO2, electrolyte vapour', basisTag: 'STANDARD' },
    lco:  { name: 'Li-ion LCO', runawayOnsetC: 150,   energyWhPerKg: 180, offGasLPerWh: 4.5, offGasSpecies: 'H2, CO, CO2, O2, electrolyte vapour', basisTag: 'ILLUSTRATIVE' },
    vrla: { name: 'VRLA lead-acid', runawayOnsetC: null, energyWhPerKg: 40, offGasLPerWh: 0, offGasSpecies: 'H2 (gassing on overcharge), no classic TR', basisTag: 'STANDARD' }
  };
  /* Vent gas flammability: H2 LFL 4% vol in air — the governing off-gas LFL.
   * source: NFPA 855 / UL 9540A gas-detection basis. */
  var OFFGAS = { h2LflPct: 4.0, coLflPct: 12.5, ventGasLflPct: 6.0, basisTag: 'STANDARD' };
  /* Thermal-runaway heat release ~ multiple of stored electrical energy (NMC).
   * source: ESS fire-test literature (FMECA doc) ; ILLUSTRATIVE band. */
  var TR_HEAT_FACTOR = { nmc: 2.5, lfp: 1.2, lco: 2.6, vrla: 0 };  // MJ released per MJ stored

  /* --------------------------------------------------------------------------
   * DETECTION + SUPPRESSION operating bands.  source: NFPA 72 / 2001 / 75.
   * ------------------------------------------------------------------------*/
  var BANDS = {
    dischargeTimeS:    { max: 10 },          // source: NFPA 2001 (halocarbon <=10 s) ; STANDARD
    holdTimeMin:       { min: 10 },          // source: NFPA 2001 (retention >=10 min) ; STANDARD
    safetyMarginPct:   { min: 0 },           // designConc must be <= NOAEL for normally-occupied
    spotDetectorAreaM2:{ max: 84 },          // source: NFPA 72 (spot smoke ~9.1 m spacing) ; STANDARD
    vesdaPreAlarmPctM: 0.005,                // source: aspirating very-early-warning ; STANDARD
    gasDetectAlarmPctLfl: { max: 25 },       // source: NFPA 855 (alarm at 25% LFL) ; STANDARD
    batteryRoomTempC:  { min: 15, max: 27 }  // source: thermal-management band ; ILLUSTRATIVE
  };

  /* Standards register (UI references + data/fire/standards-references.csv). */
  var STANDARDS = {
    nfpa2001: 'NFPA 2001 (2022) — Clean Agent Fire Extinguishing Systems',
    nfpa72: 'NFPA 72 — National Fire Alarm & Signaling Code (detection)',
    nfpa75: 'NFPA 75 — Fire Protection of IT Equipment',
    nfpa76: 'NFPA 76 — Fire Protection of Telecommunications Facilities',
    nfpa13: 'NFPA 13 — Installation of Sprinkler Systems',
    nfpa855: 'NFPA 855 — Installation of Stationary Energy Storage Systems',
    nfpa70: 'NFPA 70 (NEC) — Art. 645 IT rooms / EPO',
    ul9540: 'UL 9540 / UL 9540A:2024 — ESS safety + thermal-runaway propagation test',
    iec62619: 'IEC 62619 — Secondary Li cells/batteries for industrial use',
    fmGlobal: 'FM Global DS 5-32 — Data Centers & related facilities',
    iso14520: 'ISO 14520 — Gaseous fire-extinguishing systems'
  };

  var FIRE_MODEL = {
    specVersion: '1.0.0',
    authority: 'NFPA 2001/72/75/76/855 + UL 9540A + IEC 62619 + FMECA research doc',
    agents: AGENTS,
    battery: BATTERY,
    offGas: OFFGAS,
    trHeatFactor: TR_HEAT_FACTOR,
    bands: BANDS,
    phys: { airDensityKgM3_20C: 1.204, ntpTempC: 20 },
    standards: STANDARDS
  };

  deepFreeze(FIRE_MODEL);
  if (root) { root.FIRE_MODEL = FIRE_MODEL; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = FIRE_MODEL; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
