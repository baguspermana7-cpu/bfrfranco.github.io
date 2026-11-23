/* ============================================================================
 * conv-engine.js — Conventional BMS single scenario basis + pure calculations
 * ----------------------------------------------------------------------------
 * ONE engineering scenario basis for the whole Conventional BMS suite
 * (dc-conventional, EPMS, datahall, chiller-plant, fire-system, fuel-system,
 *  water-system, ict). Every derived number on every page MUST come from here
 * so the suite is internally consistent and engineering-defensible.
 *
 * Design rules (per /Documents/screenshot bms rz/conv/review/00-overview-audit.md):
 *   - Single capacity basis, every page reads the same scenario.
 *   - Derived values come from auditable formulas, never hardcoded/random.
 *   - No pseudo-random number generation anywhere (values stable on reload).
 *   - ES5-safe, zero-build, no imports, exposed on window + Node-interop shim.
 *   - Every constant cited to a source doc via a `// source:` comment.
 *
 * ============================================================================
 * v2 CAMPUS REBASELINE (this file's engine v2.0.0)
 * ----------------------------------------------------------------------------
 * The live basis moved from a single 1,850 kW hall to a FOUR-HALL, 4 x 10 MW
 * campus. The governed study that fixes the campus geometry already ships in
 * js/conv-design-basis.js (STUDY_INPUT): 4 halls A-D, 10,000 kW IT design per
 * hall, 500 racks per hall, 20 kW/rack design average, 30 kW/rack selected
 * peak, dPUE 1.45 at design load, resilience electrical 2N / cooling N+1.
 * Those are the ONLY authored capacity inputs; everything below derives.
 *
 * BACKWARD COMPATIBILITY CONTRACT (do not break):
 *   snapshot.site.* keeps its exact existing key names and meaning. It now
 *   carries the CAMPUS ROLL-UP — it_design_kw 40000, it_load_kw 30000, pue,
 *   facility_load_kw, non_it_load_kw (+ the *_exact twins). Every existing
 *   consumer (dc-conventional, EPMS_Telemetry, datahall, chiller-plant,
 *   water-system, fuel-system, fire-system, ict) keeps working unedited.
 *   snapshot.campus / snapshot.campus.halls and the hall selectors are ADDITIVE.
 *
 * EVIDENCE LABELLING (mandatory — nothing here is measured):
 *   - The adopted normal scenario (30,000 kW = 4 x 7,500 kW/hall) is a
 *     SIMULATED / ADOPTED project scenario, never measured telemetry.
 *   - Every re-derived equipment nameplate is ASSUMED (project design decision
 *     pending Basis-of-Design confirmation) and carries its duty, chosen unit
 *     capacity, arithmetic and redundancy rule in a source comment.
 *
 * CHW basis decision (resolves the 7.2/14.8 vs 19.1/22.6 conflict):
 *   The dashboard showed CHWS/CHWR 7.2/14.8 C while the chiller-plant page
 *   showed ~19.1/22.6 C. Per doc-00 §"Single Capacity Basis" (line 62) the
 *   resolution is EITHER conventional chilled-water 7/15 C CRAH OR relabel the
 *   warm loop. doc-09 "Proposed Site Basis" (line 15) and the doc-09 "Required
 *   Shared Data Engine" reference object (lines 174-191) both fix the canonical
 *   basis at chwSupplyC = 7.2 C, chwReturnC = 14.8 C (delta-T 7.6 C).
 *   DECISION: adopt the conventional chilled-water basis 7.2 / 14.8 C as the
 *   single canonical CHW loop. The chiller-plant ~19/23 C reading is a
 *   secondary/condenser-side loop and will be RELABELLED (not called CHWS) in a
 *   later per-page stage; it is out of scope for this Stage 1 binding.
 *   // source: 00-overview-audit.md line 62 ; 01-dashboard-review.md §4 ;
 *   //         09-engineering-basis-and-calculations.md lines 15, 81-84, 174-191
 * ==========================================================================*/
(function (root) {
    'use strict';

    /* ====================================================================
     * AUTHORED CAMPUS INPUTS
     * Cited to js/conv-design-basis.js STUDY_INPUT (governed four-hall study,
     * id 'conv-four-hall-air-study-2026-08-27'). These are duplicated as plain
     * ES5 literals ONLY because conv-engine.js must stay zero-import and load
     * standalone in the browser; tools/test-conv-campus-model.mjs asserts they
     * still match RZConvDesignBasis.STUDY, so a drift fails the ship gate.
     * ================================================================== */

    // source: conv-design-basis.js STUDY_INPUT.halls = ['A','B','C','D']
    var HALL_CODES = ['A', 'B', 'C', 'D'];
    // source: conv-design-basis.js STUDY_INPUT.capacity.itKwPerHall = 10000
    var IT_DESIGN_KW_PER_HALL = 10000;
    // source: conv-design-basis.js STUDY_INPUT.rack.countPerHall = 500
    var RACKS_PER_HALL = 500;
    // source: conv-design-basis.js STUDY_INPUT.rack.selectedAverageKw = 20
    //   check: 10,000 kW / 500 racks = 20.0 kW/rack design average
    var RACK_DESIGN_AVG_KW = 20;
    // source: conv-design-basis.js STUDY_INPUT.rack.selectedPeakKw = 30
    var RACK_SELECTED_PEAK_KW = 30;

    /* ADOPTED NORMAL SCENARIO — actual IT load per hall (kW).
     * source: Task-1 ledger section 5.1 "provisional normal scenario", ADOPTED
     *         2026-08-28 as the locked normal operating scenario.
     *   4 x 7,500 kW = 30,000 kW campus = 75% of the 40,000 kW design capacity.
     * EVIDENCE: SIMULATED / ADOPTED project scenario. This is NOT measured
     * telemetry and must never be labelled or displayed as measured.
     * This is the single authored literal that sets the live IT basis — the
     * snapshot-binding gate (tools/test-conv-snapshot-binding.mjs) perturbs
     * exactly this constant to prove the cockpits follow the engine.
     */
    var NORMAL_IT_KW_PER_HALL = 7500;

    /* Operating scenarios. `normal` is ACTIVE and is the locked basis every
     * page reads; the others are declared so the campus model exposes the
     * envelope it was sized against. All are SIMULATED / ADOPTED, never
     * measured. Per-hall kW x 4 halls = campus kW.
     * source: Task-1 ledger section 5.1 (normal, adopted) ; the remaining rows
     *         are the design envelope implied by STUDY_INPUT capacity.
     */
    var SCENARIOS = [
        // 4 x 1,125 = 4,500 kW — first-tenant day-one fit-out (11.25% of design)
        { id: 'day1-low', label: 'Day-1 low', it_kw_per_hall: 1125, evidence_class: 'SIMULATED' },
        // 4 x 7,500 = 30,000 kW — ADOPTED locked normal operating scenario (75% of design)
        { id: 'normal', label: 'Normal (adopted)', it_kw_per_hall: NORMAL_IT_KW_PER_HALL, evidence_class: 'SIMULATED/ADOPTED' },
        // 4 x 9,000 = 36,000 kW — sustained busy-season peak (90% of design)
        { id: 'peak', label: 'Sustained peak', it_kw_per_hall: 9000, evidence_class: 'SIMULATED' },
        // 4 x 10,000 = 40,000 kW — 100% capacity / integrated systems test
        { id: 'capacity-test-100', label: 'Capacity test (100%)', it_kw_per_hall: IT_DESIGN_KW_PER_HALL, evidence_class: 'SIMULATED' }
    ];
    var ACTIVE_SCENARIO_ID = 'normal';

    /* ==================================================================
     * THERMAL CHAIN — derived BACKWARDS from the adopted rack-inlet target
     * ==================================================================
     * The owner asked why the data hall still showed 15.2 C supply air after
     * 25.4 C was adopted. Both numbers were real, and that was the defect:
     * 25.4 C was applied at the RACK INLET plane while the supply plane was
     * still computed as `chws_c + 8.0` from a 7.2 / 14.8 C chilled-water
     * design belonging to the RETIRED 1.85 MW basis. A 15.2 C supply air
     * reaching a 25.4 C inlet implies ~10 K of bypass/recirculation, which
     * contradicts the containment the same page asserts (return-path mixing
     * adjustment = 0 K). Two sourced values, mutually inconsistent.
     *
     * The four-hall study is the LIVE basis and its rack-inlet target is
     * adopted, so the chilled-water design is re-derived from it instead of
     * being carried over:
     *
     *   rack inlet target        25.4 C   ADOPTED  (study cooling.rackInletTargetC)
     *   supply-path mixing       0.0 K    ADOPTED  (same containment assumption
     *                                     the return path already uses; applying
     *                                     it in one direction only was the bug)
     *   CRAH supply (discharge)  = inlet - mixing            = 25.4 C   DERIVED
     *   CHW coil approach        6.0 K    ASSUMED  (sensible-duty CHW coil; no
     *                                     vendor coil selection has been made)
     *   CHWS                     = supply - approach         = 19.4 C   DERIVED
     *   CHW delta-T              7.6 K    ADOPTED  (unchanged from the previous
     *                                     basis, so plant flow and duty keep
     *                                     their existing arithmetic)
     *   CHWR                     = CHWS + delta-T            = 27.0 C   DERIVED
     *
     * evidenceClass: ASSUMED for the coil approach and therefore for CHWS/CHWR.
     * This is a warm-water plant design decision that is pending Basis-of-Design
     * confirmation; it is NOT a measured or vendor-approved value. What it is
     * NOT any more is an orphaned constant: every plane below is reachable from
     * the adopted inlet target, so a change to that target moves the whole chain.
     */
    var RACK_INLET_TARGET_C = 25.4;      // study cooling.rackInletTargetC — ADOPTED
    var SUPPLY_PATH_MIXING_K = 0.0;      // contained cold aisle — ADOPTED
    /* v1.134.23 — the AIRSIDE rise across the rack was a page constant on datahall.html
       (DESIGN_AIRSIDE_DELTA_T_C = 11), which made the hot-aisle plane an orphan: the
       cockpit drew a hot-aisle temperature for every row and nothing in the registry
       could explain any of them. It belongs on the thermal chain with the planes either
       side of it. ADOPTED — a containment design figure, not a measurement. */
    var AIRSIDE_DELTA_T_K = 11.0;        // ADOPTED — design rack rise, contained aisle
    /* v1.134.23 — the CRAH fleet was sized entirely on datahall.html: one ASSUMED unit
       capacity and four arithmetic steps off it. Every figure the balance band shows for
       cooling (available kW, the N+1 availability, the unit counts) came out of that
       private block, so none of them could be traced. The assumption moves here and the
       arithmetic follows it; the page reads the results. */
    var CRAH_UNIT_SENSIBLE_KW = 130.0;   // ASSUMED — no vendor selection made
    /* v1.134.23 — 4.186 appeared as a bare literal in chwFlowLps() and again inside the
       formula datahall.html PRINTS to the operator. A physical constant is still a term of
       the calculation: named here so the formula on screen resolves to something, and so
       the engine has no economically-material literal inside a function body. */
    var WATER_CP_KJ_PER_KG_K = 4.186;    // STANDARD — specific heat of water
    /* v1.134.24 — the tower water balance was split on water-system.html: cycles of
       concentration and the drift allowance were authored there, so the evaporation and
       blowdown an operator reads had no parameter to trace to even though both follow
       from the engine's own makeup flow. The WUE TARGET was worse — a literal 1.30 typed
       in three places on that page, compared against a computed value, which is exactly
       the marketing-target-versus-derived-value confusion ACCURACY_VALIDATION Rule 4
       exists to stop. */
    var TOWER_CYCLES_OF_CONCENTRATION = 4.0;   // ADOPTED — typical open-tower operation
    var TOWER_DRIFT_FRACTION = 0.005;          // ADOPTED — 0.5% of makeup, drift eliminators
    var WUE_TARGET_L_PER_KWH = 1.30;           // ADOPTED — design target, NOT a derived value
    var RETURN_PATH_MIXING_K = 0.0;      // ADOPTED — contained hot aisle, no bypass
    var CHW_COIL_APPROACH_K = 6.0;       // ASSUMED — pending coil selection
    var CHW_DELTA_T_K = 7.6;             // ADOPTED — carried from the prior basis
    var CRAH_SUPPLY_AIR_C = RACK_INLET_TARGET_C - SUPPLY_PATH_MIXING_K;
    var CHWS_C = CRAH_SUPPLY_AIR_C - CHW_COIL_APPROACH_K;
    var CHWR_C = CHWS_C + CHW_DELTA_T_K;

    function findScenario(id) {
        for (var i = 0; i < SCENARIOS.length; i++) {
            if (SCENARIOS[i].id === id) return SCENARIOS[i];
        }
        return null;
    }

    var ACTIVE_SCENARIO = findScenario(ACTIVE_SCENARIO_ID);

    /* Halls are built from the authored per-hall inputs — no hall authors its
     * own capacity number, so a campus that does not add up is impossible. */
    function buildHalls() {
        var out = [];
        for (var i = 0; i < HALL_CODES.length; i++) {
            out.push({
                id: 'hall-' + HALL_CODES[i].toLowerCase(),
                code: HALL_CODES[i],
                it_design_kw: IT_DESIGN_KW_PER_HALL,
                it_load_kw: ACTIVE_SCENARIO.it_kw_per_hall,
                racks: RACKS_PER_HALL,
                rack_design_avg_kw: RACK_DESIGN_AVG_KW,
                rack_selected_peak_kw: RACK_SELECTED_PEAK_KW
            });
        }
        return out;
    }

    var HALLS = buildHalls();

    function sumHalls(key) {
        var total = 0;
        for (var i = 0; i < HALLS.length; i++) total += HALLS[i][key];
        return total;
    }

    /* Campus roll-up — DERIVED from the halls, authored nowhere.
     *   it_design_kw = 4 x 10,000 = 40,000 kW
     *   it_load_kw   = 4 x  7,500 = 30,000 kW  (adopted normal scenario)
     */
    var CAMPUS_IT_DESIGN_KW = sumHalls('it_design_kw');
    var CAMPUS_IT_LOAD_KW = sumHalls('it_load_kw');
    var CAMPUS_RACKS_TOTAL = sumHalls('racks');

    /* --- Equipment nameplate re-derivation ---------------------------------
     * The pre-v2 nameplates (chillers 2/3, UPS modules 2) were ABSOLUTE plant
     * counts sized for a 2.68 MW facility. They are wrong at 43.5 MW and must
     * never be multiplied through. Each is re-derived from the computed duty at
     * a STATED unit capacity plus the redundancy declared in
     * js/conv-design-basis.js STUDY_INPUT.resilience — nothing else.
     */

    // source: conv-design-basis.js STUDY_INPUT.resilience.subsystems.cooling = 'N+1'
    var COOLING_REDUNDANCY = 'N+1';
    // source: conv-design-basis.js STUDY_INPUT.resilience.subsystems.electrical = '2N'
    var ELECTRICAL_REDUNDANCY = '2N';

    /* CHILLER UNIT CAPACITY — ASSUMED (project design decision pending
     * Basis-of-Design confirmation). 5,000 kW_th water-cooled centrifugal
     * (~1,422 RT), a standard large-frame machine for a 40 MW campus.
     * evidenceClass: 'ASSUMED' — not measured, not vendor-approved.
     */
    var CHILLER_UNIT_KW_TH = 5000;

    /* UPS MODULE CAPACITY — ASSUMED (project design decision pending
     * Basis-of-Design confirmation). 1,250 kW module (1250 kVA at pf 1.0),
     * a standard modular-UPS building block.
     * evidenceClass: 'ASSUMED' — not measured, not vendor-approved.
     */
    var UPS_MODULE_KW_RATED = 1250;

    /* 150/20 kV POWER TRANSFORMER RATINGS (MVA) — the IEC 60076-1 preferred
     * ratings (R10 series) in the range this site can need. The engine picks the
     * smallest rating that covers the sizing demand (the larger of the full design
     * demand and the adopted demand plus growth margin); it never interpolates a
     * non-preferred size.
     * source: IEC 60076-1 preferred values of rated power (R10). evidenceClass: 'STANDARD'
     * Added engine 2.3.0 (PRD-CONV-LIVING-PLANT §8.1, P4a).
     */
    var HV_TX_STANDARD_MVA = [31.5, 40, 50, 63, 80, 100];
    /* IEC 60255-151 inverse-time constants t = TMS * k / ((I/Is)^alpha - 1).
     * source: IEC 60255-151:2009 Table 1. evidenceClass: 'STANDARD' */
    var IEC_CURVES = { SI: { k: 0.14, a: 0.02 }, VI: { k: 13.5, a: 1 }, EI: { k: 80, a: 2 }, LTI: { k: 120, a: 1 } };
    var SQRT3 = Math.sqrt(3);

    /* ====================================================================
     * PLANT INTERNALS — added engine 2.4.0 (PRD-CONV-EQUIPMENT-TRUTH §6.2-6.5, E1)
     * ==================================================================== */
    /* R-134a saturation pressure table, values as published in refrigerant property
     * tables (ASHRAE Fundamentals / NIST), rounded. Pressure in bar ABSOLUTE.
     * evidenceClass: 'STANDARD' (the table only). */
    var R134A_SAT_TABLE = [
        { t_c: -10, p_bar_abs: 2.006 }, { t_c: 0, p_bar_abs: 2.928 }, { t_c: 10, p_bar_abs: 4.146 },
        { t_c: 20, p_bar_abs: 5.717 }, { t_c: 30, p_bar_abs: 7.702 }, { t_c: 40, p_bar_abs: 10.166 },
        { t_c: 50, p_bar_abs: 13.18 }, { t_c: 60, p_bar_abs: 16.82 }
    ];
    /* Antoine form ln(P / kPa) = A - B / (T / K + C), FITTED to R134A_SAT_TABLE by least
     * squares on ln P for each trial C (C scanned in 0.01 K steps, the C with the smallest
     * maximum relative error kept), then rounded. Fit error against the table: max 0.08 %
     * over -10 ... 60 C (gate: <= 1 % over 0 ... 50 C, tools/test-conv-plant-internals.mjs).
     * evidenceClass: 'DERIVED' (a fit to the STANDARD table, not a published equation). */
    var R134A_ANTOINE = { A: 14.67309, B: 2236.949, C: -24.44 };
    var REFRIGERANT_ANTOINE = { 'R-134a': R134A_ANTOINE };
    // source: SI definition of 0 C. evidenceClass: 'STANDARD'
    var KELVIN_OFFSET = 273.15;
    // source: standard atmosphere, 101.325 kPa (gauge = absolute - this). evidenceClass: 'STANDARD'
    var ATM_KPA = 101.325;

    /* --- Pure derivation helpers -------------------------------------------- */

    function round1(n) { return Math.round(n * 10) / 10; }
    function round2(n) { return Math.round(n * 100) / 100; }

    /* Facility (total) load = IT load x PUE.
     * source: 00-overview-audit.md line 74 ; 09 lines 25-28 ; 01-dashboard-review.md lines 10-13
     *   check (campus normal): 30,000 x 1.45 = 43,500 kW
     */
    function facilityLoadKw(m) {
        return m.site.it_load_kw * m.site.pue;
    }

    /* Non-IT load = Facility load - IT load.
     * source: 00-overview-audit.md line 75 ; 09 lines 32-34
     *   check (campus normal): 43,500 - 30,000 = 13,500 kW
     */
    function nonItLoadKw(m) {
        return facilityLoadKw(m) - m.site.it_load_kw;
    }

    /* UPS losses at stated efficiency carrying the IT load.
     * loss = it_load * (1/eff - 1)  (input power above output by the inverse-eff factor)
     * source: 09-engineering-basis-and-calculations.md line 39 (efficiency 96%)
     *   check (campus normal): 30,000 * (1/0.96 - 1) = 1,250.0 kW
     */
    function upsLossKw(m) {
        return m.site.it_load_kw * (1 / m.electrical.ups_efficiency - 1);
    }

    /* CHW delta-T = CHWR - CHWS.
     * source: 00-overview-audit.md line 82 ; 09 line 83 ("DeltaT = 14.8 - 7.2 = 7.6 C")
     */
    /* CRAH units REQUIRED for one hall = ceil(hall sensible heat / unit sensible capacity).
       Sensible hall heat is taken as the hall IT load, which is the substitution this
       cockpit has always made and which doc-09 uses for the CHW flow term too. */
    function crahRequired(m) {
        var perHall = m.campus.halls.length ? (m.site.it_load_kw / m.campus.halls.length) : 0;
        return m.cooling.crah_unit_sensible_kw
            ? Math.ceil(perHall / m.cooling.crah_unit_sensible_kw) : 0;
    }

    function chwDeltaT(m) {
        return m.cooling.chw_delta_t_k;
    }

    /* THERMAL CHAIN, derived backwards from the adopted rack-inlet target. See the
       THERMAL CHAIN block above for the evidence class of each authored input. */
    function crahSupplyAirC(m) {
        return m.cooling.rack_inlet_target_c - m.cooling.supply_path_mixing_k;
    }
    function chwsC(m) {
        return crahSupplyAirC(m) - m.cooling.chw_coil_approach_k;
    }
    function chwrC(m) {
        return chwsC(m) + m.cooling.chw_delta_t_k;
    }

    /* Heat rejection ~= IT load + UPS losses.
     * source: 00-overview-audit.md line 81 ("cooling.heat_rejection_kw ~= it_load_kw + ups_losses_kw")
     *   check (campus normal): 30,000 + 1,250.0 = 31,250.0 kW
     */
    function heatRejectionKw(m) {
        return m.site.it_load_kw + upsLossKw(m);
    }

    /* CHW flow (L/s) = cooling kW / (4.186 * deltaT).
     * source: 00-overview-audit.md line 83 (contract) ; 09 lines 81-85.
     *   doc-09's worked example uses the IT load as the "cooling kW" term. That
     *   substitution is PRESERVED at the campus basis — the formula is unchanged,
     *   only the IT load it is evaluated at moved.
     *   4.186 = specific heat of water kJ/(kg.K).
     *   check (campus normal): 30,000 / (4.186 * 7.6) = 942.993 -> 943.0 L/s
     */
    function chwFlowLps(m) {
        return m.site.it_load_kw / (m.cooling.water_cp_kj_per_kg_k * chwDeltaT(m));
    }

    /* Chiller plant DUTY the total count is sized against = heat rejection at
     * the DESIGN IT capacity (not the adopted scenario): a plant sized only for
     * the 75% case is under-built at the 100% capacity test.
     *   Q_design = IT_design + UPS_loss(IT_design) = IT_design / eta
     *   check: 40,000 / 0.96 = 41,666.67 kW_th
     */
    function chillerDesignDutyKwTh(m) {
        return m.site.it_design_kw / m.electrical.ups_efficiency;
    }

    /* CHILLERS TOTAL — re-derived nameplate. evidenceClass: 'ASSUMED'
     *   duty            : 41,666.67 kW_th (heat rejection at 40,000 kW IT design)
     *   unit capacity   : 5,000 kW_th per chiller (ASSUMED, stated above)
     *   arithmetic      : N = ceil(41,666.67 / 5,000) = ceil(8.333) = 9
     *   redundancy rule : N+1 (STUDY_INPUT.resilience.subsystems.cooling) -> 9 + 1
     *   result          : 10 chillers installed
     * Project design decision pending Basis-of-Design confirmation. NOT measured,
     * NOT vendor-approved.
     */
    function chillersTotal(m) {
        return Math.ceil(chillerDesignDutyKwTh(m) / m.cooling.chiller_unit_kw_th) + 1;
    }

    /* CHILLERS RUNNING — re-derived nameplate. evidenceClass: 'ASSUMED'
     *   duty            : 31,250.0 kW_th (heat rejection at the adopted 30,000 kW scenario)
     *   unit capacity   : 5,000 kW_th per chiller (ASSUMED, stated above)
     *   arithmetic      : ceil(31,250 / 5,000) = ceil(6.25) = 7
     *   redundancy rule : the N+1 spare is NOT run — running counts duty units only
     *   result          : 7 chillers running of 10 installed
     * Project design decision pending Basis-of-Design confirmation.
     */
    function chillersRunning(m) {
        return Math.ceil(heatRejectionKw(m) / m.cooling.chiller_unit_kw_th);
    }

    /* EPMS total facility kW (= facility load; metering delta is a tolerance band,
     * not an applied offset — keep nominal so EPMS == dashboard within tolerance).
     * source: 00-overview-audit.md line 77 ; 12-qa-acceptance-criteria.md line 9 ("within 2%")
     */
    function epmsTotalKw(m) {
        return facilityLoadKw(m);
    }

    /* EPMS UPS output kW = IT load + critical mechanical share.
     * Conventional: UPS feeds IT + critical cooling controls; here we take the
     * IT load as the protected load (cooling on generator-backed non-UPS board).
     * source: 00-overview-audit.md line 78 ("epms.ups_output_kw = it_load_kw + critical_mech_kw")
     * Critical mech on UPS taken as 0 for this conventional basis (mechanical on
     * gen-backed switchboard, not UPS) — documented assumption.
     */
    function epmsUpsOutputKw(m) {
        return m.site.it_load_kw;
    }

    /* UPS MODULE COUNT — re-derived nameplate. evidenceClass: 'ASSUMED'
     *   duty            : 40,000 kW protected load (IT design capacity)
     *   unit capacity   : 1,250 kW per module (1250 kVA at pf 1.0) (ASSUMED, stated above)
     *   arithmetic      : N = ceil(40,000 / 1,250) = 32 modules per system
     *   redundancy rule : 2N (STUDY_INPUT.resilience.subsystems.electrical)
     *                     -> 2 independent systems (A + B) x 32 = 64 modules
     *   result          : 64 UPS modules installed campus-wide
     * Project design decision pending Basis-of-Design confirmation. NOT measured,
     * NOT vendor-approved.
     */
    function upsModulesPerSystem(m) {
        return Math.ceil(m.site.it_design_kw / m.electrical.ups_module_kw_rated);
    }
    function upsModuleCount(m) {
        return upsModulesPerSystem(m) * m.electrical.ups_system_count;
    }

    /* Rated capacity of ONE 2N system = modules per system x module rating.
     *   check: 32 x 1,250 = 40,000 kW per system (each system alone carries the
     *   full design load — that is what 2N means).
     */
    function upsSystemRatedKw(m) {
        return upsModulesPerSystem(m) * m.electrical.ups_module_kw_rated;
    }

    /* Per-2N-SYSTEM load under normal 50/50 sharing.
     * source: 01-dashboard-review.md §"Right-Side Stats Panel" (UPS A / UPS B).
     * This preserves the pre-v2 "UPS A / UPS B each carry ~50%" meaning exactly.
     *   check: 30,000 / 2 = 15,000 kW per system
     */
    function upsSystemKw(m) {
        return epmsUpsOutputKw(m) / m.electrical.ups_system_count;
    }

    /* Per-UPS-MODULE load (protected load shared across every installed module).
     * source: 01-dashboard-review.md §"Right-Side Stats Panel"
     *   check: 30,000 / 64 = 468.75 kW per module
     */
    function upsModuleKw(m) {
        return epmsUpsOutputKw(m) / upsModuleCount(m);
    }

    /* Generator fuel burn at the current facility load.
     * The sourced anchor is a PAIR: 956 L/hr AT 2,682.5 kW facility. Only the
     * RATE it implies survives a basis change — the nameplate 956 L/hr must
     * never be multiplied.
     *   specific consumption = 956 / 2,682.5 = 0.356384 L/kWh   (sourced rate)
     * source: 09-engineering-basis-and-calculations.md lines 144-147
     */
    function generatorConsumptionLph(m) {
        return facilityLoadKw(m) * m.fuel.specific_consumption_l_per_kwh;
    }

    /* Usable fuel litres = capacity * usable_fraction * level_fraction.
     * source: 09-engineering-basis-and-calculations.md lines 133-143
     *   check: 972,737 * 0.90 * 0.85 = 744,143.805 L
     */
    function fuelUsableL(m) {
        return m.fuel.tank_capacity_l * m.fuel.usable_fraction * (m.fuel.level_pct / 100);
    }

    /* Fuel autonomy (hr) = usable litres / generator consumption L/hr.
     * source: 00-overview-audit.md line 86 ; 09 lines 132-147
     *   The sourced 48 hr autonomy TARGET is preserved across the rebaseline;
     *   the tank was re-sized to hold it at the campus burn rate.
     *   check: 744,143.805 / 15,503 = 47.99999 -> 48.0 hr
     */
    function fuelAutonomyHr(m) {
        /* v1.134.1 — was `m.fuel.generator_consumption_lph`, the AUTHORED snapshot of the
           burn rate. Autonomy therefore did not move when the facility load moved. Use the
           computed burn so the whole fuel chain follows the basis. */
        return fuelUsableL(m) / generatorConsumptionLph(m);
    }

    /* Instant equivalent cooling-makeup water flow from WUE.
     * source: 09-engineering-basis-and-calculations.md lines 99-104, 189-190
     *   L/min = (WUE * IT load kW) / 60   check: (1.20 * 30,000) / 60 = 600.0 L/min
     */
    function waterFlowLpmForWue(m) {
        return (m.environment.wue_l_per_kwh * m.site.it_load_kw) / 60;
    }

    /* WUE recomputed from a water volume (for the water page contract).
     * source: 00-overview-audit.md line 85 ; 09 line 109
     *   wue = annual_water_l / annual_it_kwh ; instant: (Lpm*60)/IT_kW
     */
    function wueFromFlowLpm(m, flowLpm) {
        return (flowLpm * 60) / m.site.it_load_kw;
    }

    /* Hourly facility carbon emissions (kgCO2e/hr), facility-energy denominator.
     * source: 09-engineering-basis-and-calculations.md lines 155-158, 167
     *   check: 43,500 * 0.42 = 18,270.0 kgCO2/hr
     */
    function carbonKgPerHr(m) {
        return facilityLoadKw(m) * m.environment.carbon_kg_per_facility_kwh;
    }

    /* Active-rack estimate at a given density (kW/rack).
     * source: 09-engineering-basis-and-calculations.md lines 51-63
     *   check: 30,000 / 6 = 5,000 ; / 8 = 3,750 ; / 10 = 3,000
     */
    function activeRacks(m, kwPerRack) {
        return m.site.it_load_kw / kwPerRack;
    }

    /* --- Scenario basis (single source of truth) ----------------------------
     * site.it_design_kw / site.it_load_kw are the CAMPUS ROLL-UP, derived above
     * from the halls — they are not authored twice.
     */
    var MODEL = {
        site: {
            // DERIVED campus roll-up: 4 halls x 10,000 kW = 40,000 kW IT design
            // source: conv-design-basis.js STUDY_INPUT.capacity.itKwPerHall x halls
            it_design_kw: CAMPUS_IT_DESIGN_KW,
            // DERIVED campus roll-up: 4 halls x 7,500 kW = 30,000 kW actual IT load
            // ADOPTED normal scenario (75% of design). SIMULATED/ADOPTED, not measured.
            // source: Task-1 ledger section 5.1, adopted 2026-08-28
            it_load_kw: CAMPUS_IT_LOAD_KW,
            // source: 09-engineering-basis-and-calculations.md line 11 ("PUE 1.45") ;
            //         conv-design-basis.js STUDY_INPUT.pue.designPoint = 1.45 (dPUE at design load)
            pue: 1.45
        },
        campus: {
            halls: HALLS,
            hall_count: HALLS.length,
            racks_total: CAMPUS_RACKS_TOTAL,
            rack_design_avg_kw: RACK_DESIGN_AVG_KW,
            rack_selected_peak_kw: RACK_SELECTED_PEAK_KW,
            scenarios: SCENARIOS,
            active_scenario_id: ACTIVE_SCENARIO_ID,
            study_id: 'conv-four-hall-air-study-2026-08-27'
        },
        environment: {
            // source: 01-dashboard-review.md §3 (WUE benchmark plausible) ;
            //         09-engineering-basis-and-calculations.md line 13 ("WUE 1.20 L/kWh")
            wue_l_per_kwh: 1.20,
            // source: 09-engineering-basis-and-calculations.md line 14
            //         ("Carbon intensity 0.42 kgCO2/kWh"), denominator = facility kWh
            //         per 09 line 167 / 01-dashboard-review.md §3
            carbon_kg_per_facility_kwh: 0.42,
            // source: 01-dashboard-review.md §"Right-Side Stats Panel" (Avg Temp shown) —
            //         conventional cold-aisle setpoint band, ASHRAE TC9.9 recommended
            avg_temp_c: 22.4,
            // source: 09-/01- environment row (RH%) — ASHRAE recommended 40-60% band midpoint
            avg_rh_pct: 48
        },
        cooling: {
            /* v2.1.0 — DERIVED from the adopted rack-inlet target; see the THERMAL
             * CHAIN block above for the full derivation and evidence classes. The
             * previous 7.2 / 14.8 C pair came from 09-engineering-basis-and-
             * calculations.md line 15, which documents the RETIRED 1.85 MW basis.
             * Its delta-T (7.6 K) is retained, so plant flow and duty arithmetic
             * are unchanged — only the temperature level moves. */
            /* Only the AUTHORED inputs live on the model. crah_supply_air_c, chws_c and
               chwr_c are derived in compute() so the chain cannot be reopened by editing a
               downstream temperature here. */
            rack_inlet_target_c: RACK_INLET_TARGET_C,
            supply_path_mixing_k: SUPPLY_PATH_MIXING_K,
            airside_delta_t_k: AIRSIDE_DELTA_T_K,
            crah_unit_sensible_kw: CRAH_UNIT_SENSIBLE_KW,
            water_cp_kj_per_kg_k: WATER_CP_KJ_PER_KG_K,
            return_path_mixing_k: RETURN_PATH_MIXING_K,
            chw_coil_approach_k: CHW_COIL_APPROACH_K,
            chw_delta_t_k: CHW_DELTA_T_K,
            /* Chiller unit capacity — ASSUMED (project design decision pending
             * Basis-of-Design confirmation). 5,000 kW_th (~1,422 RT) water-cooled
             * centrifugal. chillers_running / chillers_total are DERIVED from this
             * plus the N+1 rule; see chillersTotal() / chillersRunning() above for
             * the duty, arithmetic and redundancy rule.
             * evidenceClass: 'ASSUMED' — never measured, never vendor-approved. */
            chiller_unit_kw_th: CHILLER_UNIT_KW_TH,
            chiller_redundancy: COOLING_REDUNDANCY,
            /* v1.134.8 — heat-rejection technology, ADOPTED. The governed study fixes
             * water.heatRejectionType = 'evaporative-cooling-tower', which means WATER-COOLED
             * machines. The chiller mimic had depicted air-cooled ones, and the two differ by
             * roughly 2x in specific power, so plant COP and kW/RT were reported UNAVAILABLE
             * rather than assumed. The owner has now adopted the study's basis, so the
             * technology is settled and the efficiency figures become derivable.
             * source: js/conv-design-basis.js STUDY_INPUT.water.heatRejectionType
             */
            chiller_type: 'water-cooled-centrifugal',
            /* RATED specific power, kW electrical per kW thermal, at the AHRI 550/590 standard
             * rating point (leaving CHW 6.7 C, entering CDW 29.4 C, 3.0 gpm/ton). 0.58 kW/RT is the
             * middle of the 0.55-0.62 band a water-cooled centrifugal is rated at; 1 RT = 3.517 kW_th,
             * so 0.58 / 3.517 = 0.16491 kW_e/kW_th (COP ~6.06 AT RATING).
             * 2.5.0 (PRD-CONV-EQUIPMENT-INSIDE §5.2): until 2.4.0 this rating figure was applied at the
             * plant's own warm-water lift (evap sat 17.9 C, cond sat 38.5 C, 20.6 K against ~31 K at
             * rating), which overstated chiller input. The engine now solves the R-134a cycle: the
             * isentropic efficiency that reproduces THIS rating is kept, and the plant's specific power
             * is the cycle's input at the plant saturations (chillerSpecificPower()).
             * evidenceClass: 'ASSUMED' — a rating figure for the adopted machine type, NOT a vendor
             * selection. A submittal replaces exactly this number and everything downstream re-derives.
             */
            chiller_rated_specific_power_kw_e_per_kw_th: 0.16491,
            /* CONDENSER WATER — the loop a water-cooled machine has and an air-cooled one does
             * not. The study's evaporative cooling tower rejects to wet-bulb; no site wet-bulb
             * design figure has been supplied, so the supply temperature and the tower range are
             * ASSUMED at values typical for a tropical design and carry that label. They are
             * authored inputs; the return temperature derives from them.
             * source: js/conv-design-basis.js STUDY_INPUT.water.heatRejectionType
             * evidenceClass: 'ASSUMED' — replace with the site wet-bulb basis when it exists.
             */
            cdw_supply_c: 32.0,
            cdw_range_k: 5.0,
            // (no authored chillers_running / chillers_total — both are derived)

            /* ==============================================================
             * PLANT INTERNALS BASIS — added engine 2.4.0
             * (PRD-CONV-EQUIPMENT-TRUTH §6.2-6.4, phase E1). Every value below
             * is a TRAINING DESIGN VALUE: evidenceClass 'ASSUMED' unless stated.
             * No chiller rating sheet, pump curve or tower selection exists for
             * this site; the cycle and fleet values derived from these are a
             * consistent simulation, not a vendor rating.
             * ============================================================== */
            // source: PRD-CONV-EQUIPMENT-TRUTH OD-1 default (common centrifugal fluid). evidenceClass: 'ADOPTED'
            chiller_refrigerant: 'R-134a',
            // source: ASSUMED flooded-evaporator approach, AHRI 550/590 rating context. evidenceClass: 'ASSUMED'
            chiller_evap_approach_k: 1.5,
            // source: ASSUMED shell-and-tube condenser approach, AHRI 550/590 rating context. evidenceClass: 'ASSUMED'
            chiller_cond_approach_k: 1.5,
            /* Refrigeration-cycle basis (engine 2.5.0, PRD-CONV-EQUIPMENT-INSIDE §5.2). */
            // source: AHRI 550/590 standard rating condition, leaving chilled water 44.0 F. evidenceClass: 'STANDARD'
            chiller_rating_chws_c: 6.7,
            // source: AHRI 550/590 standard rating condition, entering condenser water 85.0 F. evidenceClass: 'STANDARD'
            chiller_rating_cdw_supply_c: 29.4,
            // source: AHRI 550/590 standard rating condition, condenser water flow 3.0 gpm per ton. evidenceClass: 'STANDARD'
            chiller_rating_cdw_gpm_per_ton: 3.0,
            // source: ASSUMED suction superheat of a flooded evaporator (0.5-1.0 K typical). evidenceClass: 'ASSUMED'
            chiller_superheat_k: 0.8,
            // source: ASSUMED liquid subcooling leaving a shell-and-tube condenser (2-5 K typical). evidenceClass: 'ASSUMED'
            chiller_subcool_k: 3.0,
            // source: ASSUMED hermetic compressor motor efficiency (IEC 60034-30-1 IE3 band at this size). evidenceClass: 'ASSUMED'
            chiller_motor_efficiency: 0.96,
            // source: ASSUMED low-voltage VFD efficiency at full load (IEC 61800-9-2 IE2 band). evidenceClass: 'ASSUMED'
            chiller_vfd_efficiency: 0.97,
            // source: ASSUMED minimum compressor speed of a VSD centrifugal (surge/head limit). evidenceClass: 'ASSUMED'
            chiller_min_speed_pct: 60,
            // source: STANDARD water density used for hydraulic power (kg/m3). evidenceClass: 'STANDARD'
            water_density_kg_m3: 1000,
            /* Air properties for the CRAH airflow (engine 2.5.0, PRD-CONV-EQUIPMENT-INSIDE P3): dry air at 20 C, 101.325 kPa. */
            // source: STANDARD ASHRAE Fundamentals (2021) ch. 1, dry air density at 20 C and sea-level pressure (kg/m3). evidenceClass: 'STANDARD'
            air_density_kg_m3: 1.204,
            // source: STANDARD ASHRAE Fundamentals (2021) ch. 1, specific heat of dry air near room temperature (kJ/kg.K). evidenceClass: 'STANDARD'
            air_cp_kj_kg_k: 1.006,
            // source: standard gravity, 9.80665 m/s2 (CGPM 1901). evidenceClass: 'STANDARD'
            gravity_m_s2: 9.80665,
            // source: ASSUMED pump hydraulic efficiency at the duty point. evidenceClass: 'ASSUMED'
            pump_efficiency: 0.80,
            // source: ASSUMED pump motor efficiency (IE3 class, large motor). evidenceClass: 'ASSUMED'
            pump_motor_efficiency: 0.95,
            // source: ASSUMED VFD efficiency at full speed. evidenceClass: 'ASSUMED'
            pump_vfd_efficiency: 0.97,
            /* Pump speed at the duty point. The model has one operating point per pump and
             * it IS the design point, so speed is 100 %; no part-speed operation is modelled.
             * evidenceClass: 'ADOPTED' */
            pump_speed_pct: 100,
            /* 2.7.0 (PRD-CONV-OPS-DEPTH 01 P1): the OPERATING speed of each pump class follows from its pump curve
             * meeting its system curve; pump_speed_pct above stays the DESIGN speed (its 2.6.0 meaning).
             * source: IEC 60196 standard frequencies, 50 Hz the Indonesian grid (PLN). evidenceClass: 'ADOPTED' */
            motor_base_frequency_hz: 50,
            // source: ASSUMED shut-off head / design head of a centrifugal pump (Hydraulic Institute typical 1.1-1.3). evidenceClass: 'ASSUMED'
            pump_shutoff_head_ratio: 1.2,
            // source: ASSUMED minimum VFD speed of a pump motor (motor cooling, manufacturer typical 25-30 %). evidenceClass: 'ASSUMED'
            pump_min_speed_pct: 30,
            // source: ASSUMED static lift of the open cooling-tower circuit (basin to distributor), part of cdw_head_m. evidenceClass: 'ASSUMED'
            cdw_static_head_m: 4,
            // source: ASSUMED remote DP setpoint of the secondary loop = the chiller-plant page's default setpoint (60-140 kPa slider). evidenceClass: 'ASSUMED'
            chw_secondary_dp_setpoint_kpa: 90,
            /* 2.8.0 (PRD-CONV-OPS-DEPTH 01 P3): minimum-flow and condenser-water limits behind the bypass valves.
             * source: ASSUMED minimum evaporator flow of a centrifugal chiller, % of design (manufacturer data-sheet range 30-50 %). evidenceClass: 'ASSUMED' */
            chiller_min_evap_flow_pct: 40,
            // source: ASSUMED minimum entering condenser-water temperature of the chillers (manufacturer limit; AHRI 550/590 rates at 29.4 C and allows relief). evidenceClass: 'ASSUMED'
            chiller_min_ecwt_c: 15,
            // source: PRD OD-4 — one duty + one standby primary pump per chiller train. evidenceClass: 'ADOPTED'
            chw_primary_pumps_per_train: 2,
            // source: ASSUMED primary (evaporator) loop head, m. evidenceClass: 'ASSUMED'
            chw_primary_head_m: 15,
            // source: ASSUMED secondary (distribution) loop head, m. evidenceClass: 'ASSUMED'
            chw_secondary_head_m: 30,
            // source: ASSUMED condenser-water loop head incl. tower static lift, m. evidenceClass: 'ASSUMED'
            cdw_head_m: 25,
            // source: ASSUMED rated flow of one secondary CHW pump, L/s. evidenceClass: 'ASSUMED'
            chw_secondary_unit_flow_lps: 250,
            // source: PRD OD-4 — N+1 on the secondary header. evidenceClass: 'ASSUMED'
            pump_standby_per_header: 1,
            /* Design ambient wet-bulb for the tower. No site wet-bulb basis has been
             * supplied (the cdw_supply_c block above says so); 27 C is a tropical design
             * figure. evidenceClass: 'ASSUMED' */
            tower_design_wet_bulb_c: 27,
            // source: ASSUMED fan motor rating of one induced-draft cell, kW. evidenceClass: 'ASSUMED'
            tower_fan_motor_kw: 55,
            // source: task E1 basis — one cell per chiller, no extra standby cell. evidenceClass: 'ASSUMED'
            tower_standby_cells: 0
        },
        electrical: {
            // source: 09-engineering-basis-and-calculations.md line 39
            //         ("UPS losses @ 96% efficiency") -> efficiency = 0.96
            ups_efficiency: 0.96,
            /* UPS module rating — ASSUMED (project design decision pending
             * Basis-of-Design confirmation). 1,250 kW (1250 kVA at pf 1.0).
             * ups_module_count is DERIVED from this plus the 2N rule; see
             * upsModuleCount() above for duty, arithmetic and redundancy rule.
             * evidenceClass: 'ASSUMED' — never measured, never vendor-approved. */
            ups_module_kw_rated: UPS_MODULE_KW_RATED,
            /* 2N = two independent systems (UPS A + UPS B).
             * source: conv-design-basis.js STUDY_INPUT.resilience.subsystems.electrical = '2N' ;
             *         01-dashboard-review.md §"Right-Side Stats Panel" (UPS A / UPS B) */
            ups_system_count: 2,
            ups_redundancy: ELECTRICAL_REDUNDANCY,
            // source: 09-engineering-basis-and-calculations.md line 77
            //         metering tolerance for epms.total_kw (doc-00 line 77 "+/- metering_delta",
            //         doc-12 line 9 "within 2%")
            metering_tolerance_pct: 2,
            // (no authored ups_module_count — it is derived)

            /* ==============================================================
             * HV / MV / GENERATION / PROTECTION BASIS — added engine 2.3.0
             * (PRD-CONV-LIVING-PLANT §8.1 OD-4, P4a). Every value below is a
             * TRAINING DESIGN VALUE: evidenceClass 'ASSUMED' unless stated.
             * No utility letter, no transformer test certificate, no relay
             * study exists for this site. The protection settings are declared
             * training settings derived by a stated grading rule, NOT a relay
             * coordination study, and must never be used to set a real relay.
             * ============================================================== */
            // source: ASSUMED design power factor at the 20 kV metering point. evidenceClass: 'ASSUMED'
            power_factor_design: 0.95,
            // source: ASSUMED growth margin on transformer sizing. evidenceClass: 'ASSUMED'
            growth_margin: 0.20,
            // source: PLN transmission voltage level (150 kV). evidenceClass: 'ADOPTED'
            hv_voltage_kv: 150,
            // source: ASSUMED three-phase system fault level at the 150 kV bus (utility letter absent). evidenceClass: 'ASSUMED'
            hv_fault_level_ka: 25,
            // source: ASSUMED 150 kV GIS rated short-time current (40 kA class). evidenceClass: 'ASSUMED'
            hv_switchgear_rated_ka: 40,
            // source: PRD §8.1 — two PLN incoming lines. evidenceClass: 'ASSUMED'
            hv_line_bays: 2,
            // source: PRD §8.1 — two transformer bays. evidenceClass: 'ASSUMED'
            hv_tx_bays: 2,
            // source: PRD OD-3 — double busbar with coupler. evidenceClass: 'ASSUMED'
            hv_bus_count: 2,
            // source: PRD §8.1 — 2 units, N+1: each unit alone carries the site. evidenceClass: 'ASSUMED'
            hv_tx_count: 2,
            // source: ASSUMED 150/20 kV transformer impedance on its own rating. evidenceClass: 'ASSUMED'
            hv_tx_impedance_pct: 12.5,
            // source: ASSUMED 20 kV distribution voltage (PLN medium voltage). evidenceClass: 'ASSUMED'
            mv_voltage_kv: 20,
            // source: ASSUMED low-resistance neutral earthing resistor, cable network. evidenceClass: 'ASSUMED'
            mv_ngr_ohm: 12,
            // source: PRD §8.1 — two 20 kV bus sections + bus tie. evidenceClass: 'ASSUMED'
            mv_bus_sections: 2,
            // source: ASSUMED 20/0.4 kV distribution transformer unit rating (plan E-1). evidenceClass: 'ASSUMED'
            dist_tx_kva: 3150,
            // source: IEC 60076-5 minimum impedance for 2,501-6,300 kVA. evidenceClass: 'STANDARD'
            dist_tx_impedance_pct: 7,
            /* 2.6.0 (PRD-CONV-EQUIPMENT-INSIDE P4a): the distribution unit's losses. No vendor test report exists for
             * the assumed unit, so the regulatory MAXIMA are used and every loss derived from them is an upper bound.
             * source: ASSUMED indoor cast-resin unit (IEC 60076-11), with dist_tx_kva a plan E-1 assumption. evidenceClass: 'ASSUMED' */
            dist_tx_type: 'dry',
            // source: Regulation (EU) No 548/2014 Annex I Table I.2, 3 150 kVA, Tier 2 (1 July 2021), maximum no-load losses (data/sources/eu-548-2014). evidenceClass: 'STANDARD'
            dist_tx_p0_w: 3420,
            // source: Regulation (EU) No 548/2014 Annex I Table I.2, 3 150 kVA, Tier 2, maximum load losses (data/sources/eu-548-2014). evidenceClass: 'STANDARD'
            dist_tx_pk_w: 22000,
            // source: Regulation (EU) No 548/2014 Annex I Table I.7, liquid-immersed large power 63 MVA, Tier 2 minimum PEI 99,745 % (data/sources/eu-548-2014). evidenceClass: 'STANDARD'
            hv_tx_pei_min: 0.99745,
            // source: 2N electrical topology — A and B streams. evidenceClass: 'ASSUMED'
            dist_tx_streams: 2,
            // source: ASSUMED LV distribution voltage. evidenceClass: 'ASSUMED'
            lv_voltage_v: 400,
            // source: ASSUMED genset unit rating (plan E-1, 3 MW class). evidenceClass: 'ASSUMED'
            genset_unit_kw: 3000,
            // source: ASSUMED maximum continuous loading of one set (plan E-1). evidenceClass: 'ASSUMED'
            genset_max_loading: 0.8,
            // source: ASSUMED N+1 per hall block (plan E-1). evidenceClass: 'ASSUMED'
            genset_spare_per_hall: 1,
            /* 2.9.0 (PRD-ELECTRICAL-BMS E18, owner R191): LV below the distribution transformer — floor PDU per
             * stream per hall. No PDU submittal exists for this site. */
            // source: ASSUMED floor-standing PDU unit rating (no submittal). evidenceClass: 'ASSUMED'
            pdu_kva_rated: 300,
            // source: ASSUMED IT load power factor at the PDU output. evidenceClass: 'ASSUMED'
            pdu_power_factor: 0.95,
            // source: NFPA 70 §215.3 / §210.20(A) — a continuous load at most 80 % of the overcurrent device rating. evidenceClass: 'STANDARD'
            pdu_max_loading_pct: 80,
            // source: datahall.html authored floor layout, AUTHORED_RACKS_PER_ZONE = 20 cabinets per row. evidenceClass: 'ADOPTED'
            racks_per_row: 20,
            // source: PRD §8.2 OD-5 — numerical-relay grading margin. evidenceClass: 'ASSUMED'
            pro_grading_margin_s: 0.3,
            // source: ASSUMED training pickup multiples of the protected FLA. evidenceClass: 'ASSUMED'
            pro_feeder_pickup_x: 1.25,
            pro_incomer_pickup_x: 1.1,
            pro_hv_pickup_x: 1.2,
            // source: ASSUMED feeder instantaneous = this x the LV through-fault referred to 20 kV. evidenceClass: 'ASSUMED'
            pro_inst_x: 1.3,
            // source: ASSUMED feeder instantaneous operating time. evidenceClass: 'ASSUMED'
            pro_feeder_inst_s: 0.05,
            // source: ASSUMED LV main LSIG short-time pickup (x Ir) and delay. evidenceClass: 'ASSUMED'
            pro_lv_isd_x: 4,
            pro_lv_tsd_s: 0.2,
            // source: ASSUMED LV main LSIG long-time delay, seconds at 6 x Ir. evidenceClass: 'ASSUMED'
            pro_lv_tr_s: 4,
            // source: ASSUMED relay TMS setting step. evidenceClass: 'ASSUMED'
            pro_tms_step: 0.01,
            // source: ASSUMED top of the relay TMS setting range. evidenceClass: 'ASSUMED'
            pro_tms_max: 1.5,
            /* Relay curve families (IEC 60255-151). The 20 kV feeder is EXTREMELY
             * inverse: the LV main long-time band is I^2 t shaped, and only an EI
             * curve (also I^2-shaped) can stay above it from the long-time region
             * up to the LV short-time pickup. Incomer and 150 kV stay standard
             * inverse. ASSUMED training settings. evidenceClass: 'ASSUMED' */
            pro_feeder_curve: 'EI',
            pro_incomer_curve: 'SI',
            pro_hv_curve: 'SI',
            // source: PRD §8.2 — declared transformer inrush point, 12 x FLA at 0.1 s. evidenceClass: 'ASSUMED'
            pro_inrush_x: 12,
            pro_inrush_s: 0.1
        },
        fuel: {
            // source: 09-engineering-basis-and-calculations.md line 16, 126
            //         ("Fuel level 85%")
            level_pct: 85,
            // source: 09-engineering-basis-and-calculations.md line 141
            //         ("Usable fraction = 90%")
            usable_fraction: 0.90,
            /* SOURCED specific consumption, preserved across the rebaseline.
             * The doc's sourced pair is 956 L/hr AT 2,682.5 kW facility:
             *   956 / 2,682.5 = 0.356384 L/kWh
             * The RATE is what survives a basis change; the 956 L/hr nameplate
             * does not and is never multiplied.
             * source: 09-engineering-basis-and-calculations.md lines 144-147 */
            specific_consumption_l_per_kwh: 0.356384,
            /* v1.134.1 — the authored 15,503 L/hr is GONE. It was a frozen snapshot of
             *   facility_load_kw x specific_consumption_l_per_kwh
             * that the model republished instead of computing, so generator burn and
             * therefore autonomy did not follow a change of load. generatorConsumptionLph()
             * had existed and gone unused. Removing the literal makes the break impossible
             * rather than merely fixed. */
            /* Bulk fuel inventory re-sized to PRESERVE the sourced 48 hr autonomy
             * target at the campus burn rate — ASSUMED:
             *   usable litres needed = 15,503 L/hr x 48 hr = 744,144 L
             *   tank capacity        = 744,144 / (0.90 usable x 0.85 level)
             *                        = 972,737.25 -> 972,737 L
             *   verify: 972,737 x 0.90 x 0.85 / 15,503 = 48.0 hr
             * source: 09-engineering-basis-and-calculations.md lines 133-147
             *         (48 hr autonomy target preserved; inventory re-derived).
             * evidenceClass: 'ASSUMED' — project design decision pending
             * Basis-of-Design confirmation. NOT measured, NOT vendor-approved. */
            tank_capacity_l: 972737,
            /* Tank level alarm thresholds. ASSUMED — no overfill-prevention or level-alarm
             * specification has been supplied; these match the fuel mimic's own annotations. */
            level_overfill_pct: 95,
            level_low_pct: 60,
            level_low_low_pct: 30
        },
            /* ==================================================================
         * FIRE PROTECTION — added v1.134.8
         * ==================================================================
         * The fire mimic carried its whole basis as page constants: tank capacity,
         * pump demand, zone count, level and static pressure. None of it was
         * traceable, and the one figure that matters most — how long the reserve
         * actually lasts — was never computed anywhere. It is computed here, and
         * the answer does not meet the page's own stated requirement. That is
         * surfaced rather than smoothed: see fire.duration_shortfall_min.
         */
        fire: {
            /* Stored fire-water reserve. ASSUMED — no hydraulic calculation or
             * authority submission has been supplied for this site. */
            reserve_capacity_m3: 114,
            /* Operating level. SIMULATED deterministic state, not a live gauge. */
            level_pct: 92,
            /* Fire pump design demand. ASSUMED — a hazard classification and a
             * sprinkler density would fix it; neither has been supplied. */
            pump_demand_lpm: 2500,
            /* Required autonomy the page itself states on the drawing. ADOPTED. */
            required_duration_min: 60,
            /* Pre-action zones (PACV-01..05). ASSUMED, matches the mimic. */
            zone_count: 5,
            /* Static header pressure. SIMULATED. */
            static_pressure_bar: 12.5
        },
        water: {
            tower_cycles_of_concentration: TOWER_CYCLES_OF_CONCENTRATION,
            tower_drift_fraction: TOWER_DRIFT_FRACTION,
            wue_target_l_per_kwh: WUE_TARGET_L_PER_KWH,
            /* Domestic / process draw, EXCLUDED from WUE (WUE counts cooling makeup only).
             * ASSUMED — no metered domestic demand has been supplied. */
            domestic_lpm: 8.0,
            // source: 09-engineering-basis-and-calculations.md line 99-104
            //         (instant equivalent water flow derived from WUE * IT load)
            // (no authored constant — flow is derived from WUE and IT load)
            _placeholder: true
        },
        meta: {
            // source: 13-screenshot-annotation-and-redesign-brief.md line 35
            //         ("Scenario: Simulated") + doc-00 §"Data Quality Rule"
            scenario: 'Simulated',
            data_quality: 'GOOD',
            /* Nothing in this engine is measured. The operating scenario is an
             * ADOPTED project scenario; re-derived equipment nameplates are
             * ASSUMED pending Basis-of-Design confirmation. */
            evidence_class: 'SIMULATED/ADOPTED',
            nameplate_evidence_class: 'ASSUMED',
            basis: 'Adopted project scenario — simulated, not measured telemetry',
            basis_doc: 'conv/review/09-engineering-basis-and-calculations.md',
            study_doc: 'js/conv-design-basis.js STUDY_INPUT (conv-four-hall-air-study-2026-08-27)',
            version: '2.10.0'
        }
    };

    /* --- Computed convenience snapshot (frozen) ----------------------------- */

    /* --- HV / MV / generation / protection (engine 2.3.0) ------------------ */

    /* IEC 60255-151 inverse time: t = TMS x k / ((I/Is)^alpha - 1).
     * Same conventions as js/conv/tcc.js so the curve and the settings agree:
     * no operation below 1.05 x Is (the formula has no meaning there), and the
     * characteristic is held flat above 20 x Is (the standard's upper limit) —
     * without that hold an EI curve reads ~6 ms at 120 x Is, which no relay does. */
    function iecTime(curve, Is, tms, I) {
        var c = IEC_CURVES[curve];
        if (!c || !(Is > 0) || !(tms > 0) || !(I > 0)) return null;
        var mult = I / Is;
        if (mult < 1.05) return null;
        if (mult > 20) mult = 20;
        return tms * c.k / (Math.pow(mult, c.a) - 1);
    }
    /* Smallest multiple of the setting step whose time meets EVERY grading point
     * (points = [{ I, need }]). The 1e-9 guard keeps an exact multiple from
     * rounding up a whole step. */
    function gradeTms(curve, Is, points, step) {
        if (!(step > 0)) return null;
        var tms = 0;
        for (var i = 0; i < points.length; i++) {
            var perTms = iecTime(curve, Is, 1, points[i].I);
            if (perTms === null) return null;
            var t = Math.ceil(points[i].need / perTms / step - 1e-9) * step;
            if (t > tms) tms = t;
        }
        return Math.round(tms * 1e6) / 1e6;
    }
    /* LV LSIG trip unit without instantaneous: long time tr x (6 Ir / I)^2 above
     * 1.05 Ir, short time tsd at and above Isd. */
    function lsigTime(Ir, tr, Isd, tsd, I) {
        if (!(I > 0)) return null;
        if (I >= Isd) return tsd;
        return I >= 1.05 * Ir ? tr * Math.pow(6 * Ir / I, 2) : null;
    }
    function fastestOf(list) {
        var t = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i] !== null && (t === null || list[i] < t)) t = list[i];
        }
        return t;
    }

    /* Derivation chain (all from the authored electrical inputs above plus the
     * engine's own facility load, hall design capacity and PUE):
     *   demand_mva        = epms_total_kw / pf / 1000                     43,500 -> 45.789
     *   demand_design_mva = site it_design_kw x PUE / pf / 1000           58,000 -> 61.053
     *   hv_tx_sizing_mva  = max(design demand, demand x (1 + growth))      61.053
     *   hv_tx_mva         = smallest IEC R10 rating >= sizing demand       63
     *   hv_source_mva     = sqrt3 x 150 kV x 25 kA                         6,495.2
     *   mv fault (one tx, tie open, source included), per unit on the tx base:
     *     z = tx_mva / source_mva + Z%/100 ; I = tx_mva / (z sqrt3 kV)     13.50 kA
     *   hall design facility kW = hall it_design_kw x site PUE             14,500
     *   dist tx per stream per hall = ceil(hall kW / pf / kVA)             5
     *   LV fault at the board: z = kVA_base / (sqrt3 kV I_mv) + Z%/100     59.25 kA
     *   gensets per hall  = ceil(hall kW / (unit x max loading)) + spare   8
     * Protection grading rule: each relay TMS is the SMALLEST step that gives
     * (downstream operating time at the grading current + margin) at every
     * grading point, on that relay's IEC 60255-151 curve. The feeder (EI) is
     * graded at two points: just below the LV short-time pickup (4 x Ir referred
     * to 20 kV) over the LV long-time band, and at the LV maximum fault over the
     * LV short-time delay. TRAINING SETTINGS, not a relay study. */
    function electricalHvMv(m) {
        var e = m.electrical;
        var pf = e.power_factor_design;
        var demandMva = epmsTotalKw(m) / pf / 1000;
        var demandDesignMva = m.site.it_design_kw * m.site.pue / pf / 1000;
        var required = Math.max(demandDesignMva, demandMva * (1 + e.growth_margin));
        var txMva = null;
        for (var i = 0; i < HV_TX_STANDARD_MVA.length; i++) {
            if (HV_TX_STANDARD_MVA[i] >= required) { txMva = HV_TX_STANDARD_MVA[i]; break; }
        }
        var hvFla = txMva === null ? null : txMva * 1000 / (SQRT3 * e.hv_voltage_kv);
        var mvFla = txMva === null ? null : txMva * 1000 / (SQRT3 * e.mv_voltage_kv);
        var sourceMva = SQRT3 * e.hv_voltage_kv * e.hv_fault_level_ka;
        var zMv = txMva === null ? null : txMva / sourceMva + e.hv_tx_impedance_pct / 100;
        var mvFaultKa = zMv === null ? null : txMva / (zMv * SQRT3 * e.mv_voltage_kv);
        var earthFaultA = e.mv_voltage_kv * 1000 / SQRT3 / e.mv_ngr_ohm;

        /* Per-hall design facility load; counts are summed hall by hall. */
        var halls = m.campus.halls, hallKwMax = 0, distTotal = 0, gensetTotal = 0;
        var distPerStream = 0, gensetPerHall = 0;
        /* 2.9.0 (E18): 2N — each stream's PDUs carry the whole hall IT design load alone. */
        var pduKw = e.pdu_kva_rated * e.pdu_power_factor * e.pdu_max_loading_pct / 100;
        var itKwMax = 0, pduPerStream = 0, pduRacks = 0;
        var unitGenKw = e.genset_unit_kw * e.genset_max_loading;
        var n1MarginMin = null;
        for (var h = 0; h < halls.length; h++) {
            var hallKw = halls[h].it_design_kw * m.site.pue;
            var perStream = Math.ceil(hallKw / pf / e.dist_tx_kva);
            var gens = Math.ceil(hallKw / unitGenKw) + e.genset_spare_per_hall;
            var margin = ((gens - 1) * unitGenKw - hallKw) / hallKw * 100;
            distTotal += perStream * e.dist_tx_streams;
            gensetTotal += gens;
            if (hallKw > hallKwMax) { hallKwMax = hallKw; distPerStream = perStream; gensetPerHall = gens; }
            if (n1MarginMin === null || margin < n1MarginMin) n1MarginMin = margin;
            if (halls[h].it_design_kw > itKwMax) {
                itKwMax = halls[h].it_design_kw;
                pduPerStream = Math.ceil(itKwMax / pduKw);
                pduRacks = halls[h].racks;
            }
        }
        var rowsPerHall = pduRacks % e.racks_per_row === 0 ? pduRacks / e.racks_per_row : null;
        var hallKva = hallKwMax / pf;
        var distMvFla = e.dist_tx_kva / (SQRT3 * e.mv_voltage_kv);
        var distLvFla = e.dist_tx_kva * 1000 / (SQRT3 * e.lv_voltage_v);
        var lvKv = e.lv_voltage_v / 1000;
        var zLv = mvFaultKa === null ? null
            : (e.dist_tx_kva / 1000) / (SQRT3 * e.mv_voltage_kv * mvFaultKa) + e.dist_tx_impedance_pct / 100;
        var lvFaultKa = zLv === null ? null : (e.dist_tx_kva / 1000) / (zLv * SQRT3 * lvKv);
        var throughMvA = lvFaultKa === null ? null : lvFaultKa * 1000 * lvKv / e.mv_voltage_kv;

        /* Protection chain, load side first. */
        var step = e.pro_tms_step, gm = e.pro_grading_margin_s;
        var lvIr = distLvFla, lvIsd = e.pro_lv_isd_x * lvIr;
        var mvPerLv = lvKv / e.mv_voltage_kv;                /* LV amperes -> 20 kV amperes */
        var lvAt = function (Imv) { return lsigTime(lvIr, e.pro_lv_tr_s, lvIsd, e.pro_lv_tsd_s, Imv / mvPerLv); };
        var feederIs = e.pro_feeder_pickup_x * distMvFla;
        var feederInstA = throughMvA === null ? null : e.pro_inst_x * throughMvA;
        /* grading point (i): just below Isd the LV main is still on its long-time band */
        var gradeLtA = lvIsd * mvPerLv;
        var gradeLtNeed = e.pro_lv_tr_s * Math.pow(6 / e.pro_lv_isd_x, 2) + gm;
        var feederTms = throughMvA === null ? null : gradeTms(e.pro_feeder_curve, feederIs, [
            { I: gradeLtA, need: gradeLtNeed },
            { I: throughMvA, need: e.pro_lv_tsd_s + gm }
        ], step);
        var feederAt = function (I) {
            return fastestOf([iecTime(e.pro_feeder_curve, feederIs, feederTms, I),
                feederInstA !== null && I >= feederInstA ? e.pro_feeder_inst_s : null]);
        };
        var feederT = throughMvA === null ? null : feederAt(throughMvA);
        var feederLtT = feederTms === null ? null : feederAt(gradeLtA);
        var inrushA = e.pro_inrush_x * distMvFla;
        var inrushT = feederAt(inrushA);
        var inrushOk = inrushT === null || inrushT > e.pro_inrush_s;

        var mvFaultA = mvFaultKa === null ? null : mvFaultKa * 1000;
        var incomerIs = mvFla === null ? null : e.pro_incomer_pickup_x * mvFla;
        var feederAtMv = mvFaultA === null ? null : feederAt(mvFaultA);
        var incomerTms = feederAtMv === null ? null
            : gradeTms(e.pro_incomer_curve, incomerIs, [{ I: mvFaultA, need: feederAtMv + gm }], step);
        var incomerT = incomerTms === null ? null : iecTime(e.pro_incomer_curve, incomerIs, incomerTms, mvFaultA);

        var hvGradeA = mvFaultA === null ? null : mvFaultA * e.mv_voltage_kv / e.hv_voltage_kv;
        var hvIs = hvFla === null ? null : e.pro_hv_pickup_x * hvFla;
        var hvTms = incomerT === null ? null
            : gradeTms(e.pro_hv_curve, hvIs, [{ I: hvGradeA, need: incomerT + gm }], step);
        var hvT = hvTms === null ? null : iecTime(e.pro_hv_curve, hvIs, hvTms, hvGradeA);
        var lvLtT = lvAt(gradeLtA * (1 - 1e-9));

        var r1n = function (v) { return v === null ? null : round1(v); };
        var r2n = function (v) { return v === null ? null : round2(v); };
        var r3n = function (v) { return v === null ? null : Math.round(v * 1000) / 1000; };
        var distL = hallKva / (distPerStream * e.dist_tx_streams * e.dist_tx_kva);
        var distLossKw = (e.dist_tx_p0_w + e.dist_tx_pk_w * distL * distL) / 1000;
        var distOutKw = e.dist_tx_kva * distL * e.power_factor_design;
        var distEff = distOutKw / (distOutKw + distLossKw);
        return {
            demand_mva: r3n(demandMva),
            demand_design_mva: r3n(demandDesignMva),
            hv_tx_sizing_mva: r3n(required),
            hv_tx_mva: txMva,
            hv_tx_fla_a: r1n(hvFla),
            mv_tx_fla_a: r1n(mvFla),
            hv_tx_load_pct_normal: txMva === null ? null : round1(demandMva / (e.hv_tx_count * txMva) * 100),
            hv_tx_load_pct_n1: txMva === null || e.hv_tx_count < 2 ? null
                : round1(demandMva / ((e.hv_tx_count - 1) * txMva) * 100),
            hv_tx_load_pct_n1_design: txMva === null || e.hv_tx_count < 2 ? null
                : round1(demandDesignMva / ((e.hv_tx_count - 1) * txMva) * 100),
            hv_source_mva: round1(sourceMva),
            mv_fault_level_ka: r2n(mvFaultKa),
            mv_earth_fault_a: round1(earthFaultA),
            hall_facility_design_kw: round1(hallKwMax),
            dist_tx_per_stream_per_hall: distPerStream,
            dist_tx_count: distTotal,
            dist_tx_load_pct_normal: round1(hallKva / (distPerStream * e.dist_tx_streams * e.dist_tx_kva) * 100),
            dist_tx_load_pct_contingency: round1(hallKva / (distPerStream * e.dist_tx_kva) * 100),
            /* 2.6.0 (P4a, G6): the unit's loss and efficiency at the DESIGN load of dist_tx_load_pct_normal;
               loss = P0 + Pk L^2 (IEC 60076-1 split, load loss with the square of the load), an upper bound because
               P0 / Pk are EU Tier 2 maxima. A cockpit showing the present load applies P0 / Pk to its own L. */
            dist_tx_loss_kw_normal: Math.round(distLossKw * 1000) / 1000,
            dist_tx_eff_normal: Math.round(distEff * 100000) / 100000,
            dist_tx_fla_mv_a: round2(distMvFla),
            dist_tx_fla_lv_a: round1(distLvFla),
            lv_fault_level_ka: r2n(lvFaultKa),
            dist_tx_through_fault_mv_a: r1n(throughMvA),
            pdu_kw_usable: round1(pduKw),
            pdu_per_hall_per_stream: pduPerStream,
            pdu_load_pct_normal: round1(itKwMax / e.dist_tx_streams / (pduPerStream * e.pdu_kva_rated * e.pdu_power_factor) * 100),
            pdu_load_pct_contingency: round1(itKwMax / (pduPerStream * e.pdu_kva_rated * e.pdu_power_factor) * 100),
            rows_per_hall: rowsPerHall,
            racks_per_pdu: Math.ceil(pduRacks / pduPerStream),
            genset_per_hall: gensetPerHall,
            genset_count: gensetTotal,
            genset_n1_margin_pct: n1MarginMin === null ? null : round1(n1MarginMin),
            pro_lv_ir_a: round1(lvIr),
            pro_lv_isd_a: round1(lvIsd),
            pro_feeder_lt_grading_a: round1(gradeLtA),
            pro_lv_lt_t_s: lvLtT === null ? null : Math.round(lvLtT * 1000) / 1000,
            pro_feeder_lt_t_s: r3n(feederLtT),
            pro_feeder_is_a: round2(feederIs),
            pro_feeder_tms: feederTms,
            pro_feeder_inst_a: r1n(feederInstA),
            pro_feeder_t_s: r3n(feederT),
            pro_feeder_inrush_ok: inrushOk,
            pro_incomer_is_a: r1n(incomerIs),
            pro_incomer_tms: incomerTms,
            pro_incomer_t_s: r3n(incomerT),
            pro_hv_grading_a: r1n(hvGradeA),
            pro_hv_is_a: r2n(hvIs),
            pro_hv_tms: hvTms,
            pro_hv_t_s: r3n(hvT)
        };
    }

    /* ADDITIVE (2.3.0) — the authored HV/MV/generation/protection inputs are
     * republished unchanged (so a page and the registry can cite them) and the
     * derived family from electricalHvMv() is appended. No existing key is touched. */
    var HV_MV_AUTHORED_KEYS = [
        'power_factor_design', 'growth_margin',
        'hv_voltage_kv', 'hv_fault_level_ka', 'hv_switchgear_rated_ka', 'hv_line_bays', 'hv_tx_bays',
        'hv_bus_count', 'hv_tx_count', 'hv_tx_impedance_pct',
        'mv_voltage_kv', 'mv_ngr_ohm', 'mv_bus_sections',
        'dist_tx_kva', 'dist_tx_impedance_pct', 'dist_tx_streams', 'lv_voltage_v',
        'dist_tx_type', 'dist_tx_p0_w', 'dist_tx_pk_w', 'hv_tx_pei_min',
        'genset_unit_kw', 'genset_max_loading', 'genset_spare_per_hall',
        'pdu_kva_rated', 'pdu_power_factor', 'pdu_max_loading_pct', 'racks_per_row',
        'pro_grading_margin_s', 'pro_feeder_pickup_x', 'pro_incomer_pickup_x', 'pro_hv_pickup_x',
        'pro_inst_x', 'pro_feeder_inst_s', 'pro_lv_isd_x', 'pro_lv_tsd_s', 'pro_lv_tr_s', 'pro_tms_step',
        'pro_tms_max', 'pro_feeder_curve', 'pro_incomer_curve', 'pro_hv_curve',
        'pro_inrush_x', 'pro_inrush_s'
    ];
    function withHvMv(m, base) {
        var out = {}, key, i;
        for (key in base) { if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key]; }
        for (i = 0; i < HV_MV_AUTHORED_KEYS.length; i++) out[HV_MV_AUTHORED_KEYS[i]] = m.electrical[HV_MV_AUTHORED_KEYS[i]];
        var derived = electricalHvMv(m);
        for (key in derived) { if (Object.prototype.hasOwnProperty.call(derived, key)) out[key] = derived[key]; }
        return out;
    }

    /* --- Plant internals (engine 2.4.0, PRD-CONV-EQUIPMENT-TRUTH E1) ----------
     * Saturation pressure (kPa abs) of the named refrigerant at t C from the fitted
     * Antoine form above. null for an unknown refrigerant: never a guess. */
    function refrigerantSatKpa(refrigerant, tC) {
        var f = REFRIGERANT_ANTOINE[refrigerant];
        if (!f || typeof tC !== 'number' || !isFinite(tC)) return null;
        return Math.exp(f.A - f.B / (tC + KELVIN_OFFSET + f.C));
    }

    /* ====================================================================
     * REFRIGERATION CYCLE — added engine 2.5.0 (PRD-CONV-EQUIPMENT-INSIDE §5.2, owner R186)
     * Two-stage economised centrifugal, R-134a. Property rows are NIST WebBook (SRD 69) rows
     * copied by tools/build-conv-r134a.mjs; linear interpolation between rows, null outside
     * them (never extrapolated). evidenceClass: 'STANDARD' (the rows), 'DERIVED' (the cycle).
     * ==================================================================== */
    /* R134A-PROPS:BEGIN — generated by tools/build-conv-r134a.mjs from data/sources/nist-r134a (NIST WebBook SRD 69); do not edit */
    var R134A_SAT = [[-11.393,189.8,184.863,391.823,0.94369,1.73435],[-10.513,196.57,186.02,392.355,0.94809,1.73371],[-9.657,203.33,187.149,392.872,0.95236,1.73311],[-8.822,210.1,188.25,393.374,0.95651,1.73253],[-8.008,216.86,189.326,393.863,0.96056,1.73198],[-7.214,223.63,190.378,394.339,0.9645,1.73145],[-6.438,230.39,191.406,394.802,0.96834,1.73094],[-5.679,237.16,192.414,395.255,0.97209,1.73046],[-4.937,243.92,193.4,395.696,0.97576,1.72999],[-4.211,250.69,194.367,396.127,0.97934,1.72954],[-3.499,257.45,195.316,396.548,0.98284,1.72911],[-2.802,264.22,196.246,396.959,0.98627,1.72869],[-2.119,270.98,197.16,397.362,0.98962,1.72829],[-1.448,277.75,198.057,397.756,0.99291,1.7279],[-0.79,284.51,198.939,398.141,0.99613,1.72753],[-0.144,291.28,199.806,398.519,0.9993,1.72716],[0.49,298.04,200.659,398.889,1.0024,1.72681],[1.114,304.81,201.498,399.252,1.00544,1.72647],[1.727,311.57,202.324,399.608,1.00843,1.72614],[2.33,318.34,203.138,399.957,1.01137,1.72582],[2.923,325.1,203.939,400.299,1.01425,1.72551],[3.507,331.87,204.729,400.636,1.01709,1.72521],[4.082,338.63,205.507,400.966,1.01988,1.72492],[4.648,345.39,206.274,401.29,1.02263,1.72464],[5.205,352.16,207.031,401.609,1.02533,1.72436],[5.755,358.93,207.777,401.923,1.02799,1.72409],[6.296,365.69,208.514,402.231,1.03061,1.72383],[6.83,372.45,209.242,402.534,1.03319,1.72357],[7.357,379.22,209.96,402.832,1.03574,1.72332],[7.876,385.98,210.669,403.126,1.03824,1.72308],[8.389,392.75,211.37,403.415,1.04071,1.72284],[8.895,399.51,212.062,403.699,1.04315,1.72261],[9.394,406.28,212.746,403.979,1.04556,1.72238],[9.887,413.04,213.422,404.255,1.04793,1.72216],[10.374,419.81,214.091,404.526,1.05027,1.72194],[10.855,426.57,214.752,404.794,1.05258,1.72173],[11.33,433.34,215.406,405.058,1.05486,1.72152],[11.8,440.1,216.053,405.318,1.05712,1.72132],[12.264,446.87,216.693,405.574,1.05934,1.72112],[12.723,453.63,217.326,405.827,1.06154,1.72093],[13.176,460.4,217.953,406.077,1.06371,1.72074],[13.625,467.16,218.574,406.323,1.06586,1.72055],[14.068,473.93,219.188,406.565,1.06798,1.72037],[14.507,480.69,219.797,406.805,1.07008,1.72019],[14.941,487.46,220.399,407.041,1.07215,1.72001],[15.371,494.22,220.996,407.274,1.07421,1.71984],[15.796,500.99,221.588,407.504,1.07623,1.71966],[16.217,507.75,222.174,407.732,1.07824,1.7195],[16.634,514.52,222.754,407.956,1.08023,1.71933],[17.046,521.28,223.33,408.178,1.08219,1.71917],[17.455,528.04,223.9,408.397,1.08414,1.71901],[17.859,534.81,224.466,408.613,1.08607,1.71885],[18.26,541.58,225.026,408.827,1.08797,1.7187],[18.657,548.34,225.582,409.038,1.08986,1.71855],[19.05,555.11,226.134,409.246,1.09173,1.7184],[19.44,561.87,226.68,409.453,1.09358,1.71825],[19.826,568.63,227.223,409.656,1.09541,1.71811],[20.208,575.4,227.761,409.858,1.09723,1.71796],[20.588,582.16,228.295,410.057,1.09903,1.71782],[20.963,588.93,228.824,410.254,1.10081,1.71768],[21.336,595.69,229.35,410.448,1.10258,1.71754],[21.706,602.46,229.872,410.641,1.10433,1.71741],[22.072,609.22,230.389,410.831,1.10607,1.71727],[22.435,615.99,230.903,411.019,1.10779,1.71714],[22.795,622.75,231.413,411.205,1.10949,1.71701],[23.153,629.52,231.92,411.39,1.11119,1.71688],[23.507,636.28,232.423,411.572,1.11286,1.71676],[23.859,643.05,232.922,411.752,1.11453,1.71663],[24.208,649.81,233.418,411.93,1.11618,1.71651],[24.554,656.58,233.91,412.107,1.11781,1.71638],[24.897,663.34,234.399,412.281,1.11943,1.71626],[25.238,670.11,234.885,412.454,1.12104,1.71614],[25.576,676.87,235.367,412.625,1.12264,1.71602],[25.912,683.64,235.847,412.795,1.12423,1.7159],[26.245,690.4,236.323,412.962,1.1258,1.71579],[26.576,697.17,236.796,413.128,1.12736,1.71567],[26.904,703.93,237.266,413.292,1.12891,1.71556],[27.23,710.7,237.733,413.455,1.13045,1.71544],[27.553,717.46,238.198,413.616,1.13197,1.71533],[27.875,724.23,238.659,413.775,1.13349,1.71522],[28.194,730.99,239.118,413.933,1.13499,1.71511],[28.51,737.75,239.573,414.089,1.13648,1.715],[28.825,744.52,240.027,414.244,1.13797,1.71489],[29.137,751.28,240.477,414.397,1.13944,1.71479],[29.448,758.05,240.925,414.549,1.1409,1.71468],[29.756,764.81,241.37,414.7,1.14235,1.71457],[30.063,771.58,241.813,414.849,1.14379,1.71447],[30.367,778.34,242.253,414.996,1.14523,1.71437],[30.669,785.11,242.69,415.142,1.14665,1.71426],[30.969,791.87,243.126,415.287,1.14806,1.71416],[31.268,798.64,243.559,415.431,1.14947,1.71406],[31.564,805.4,243.989,415.573,1.15086,1.71396],[31.859,812.17,244.417,415.713,1.15225,1.71386],[32.152,818.93,244.843,415.853,1.15362,1.71376],[32.443,825.7,245.267,415.991,1.15499,1.71366],[32.732,832.46,245.688,416.128,1.15635,1.71356],[33.019,839.23,246.107,416.264,1.1577,1.71346],[33.305,845.99,246.524,416.399,1.15904,1.71336],[33.589,852.76,246.939,416.532,1.16038,1.71327],[33.871,859.52,247.352,416.664,1.1617,1.71317],[34.152,866.29,247.763,416.795,1.16302,1.71308],[34.431,873.05,248.171,416.925,1.16433,1.71298],[34.708,879.82,248.578,417.053,1.16564,1.71289],[34.984,886.58,248.983,417.181,1.16693,1.71279],[35.258,893.35,249.386,417.307,1.16822,1.7127],[35.531,900.11,249.786,417.433,1.1695,1.71261],[35.802,906.88,250.185,417.557,1.17077,1.71251],[36.071,913.64,250.582,417.68,1.17204,1.71242],[36.339,920.4,250.977,417.802,1.1733,1.71233],[36.606,927.17,251.371,417.923,1.17455,1.71224],[36.871,933.93,251.762,418.043,1.17579,1.71214],[37.135,940.7,252.152,418.162,1.17703,1.71205],[37.397,947.46,252.54,418.28,1.17826,1.71196],[37.658,954.23,252.926,418.396,1.17949,1.71187],[37.917,960.99,253.311,418.512,1.1807,1.71178],[38.176,967.76,253.694,418.627,1.18192,1.71169],[38.432,974.52,254.075,418.741,1.18312,1.7116],[38.688,981.29,254.454,418.854,1.18432,1.71152],[38.942,988.05,254.832,418.966,1.18551,1.71143],[39.195,994.82,255.209,419.077,1.1867,1.71134],[39.446,1001.58,255.583,419.187,1.18788,1.71125],[39.697,1008.35,255.957,419.296,1.18905,1.71116],[39.946,1015.11,256.328,419.405,1.19022,1.71107],[40.194,1021.88,256.698,419.512,1.19138,1.71099],[40.44,1028.64,257.067,419.619,1.19254,1.7109],[40.685,1035.41,257.434,419.724,1.19369,1.71081],[40.929,1042.17,257.799,419.829,1.19484,1.71072],[41.172,1048.94,258.163,419.933,1.19598,1.71064],[41.414,1055.7,258.526,420.036,1.19711,1.71055],[41.655,1062.47,258.887,420.138,1.19824,1.71046],[41.894,1069.23,259.247,420.239,1.19937,1.71038],[42.133,1076,259.606,420.339,1.20048,1.71029],[42.37,1082.76,259.963,420.439,1.2016,1.71021],[42.606,1089.53,260.318,420.538,1.20271,1.71012],[42.841,1096.29,260.673,420.636,1.20381,1.71003],[43.075,1103.05,261.026,420.733,1.20491,1.70995],[43.308,1109.82,261.378,420.829,1.206,1.70986],[43.539,1116.58,261.728,420.925,1.20709,1.70978],[43.77,1123.35,262.077,421.02,1.20817,1.70969],[44,1130.11,262.425,421.114,1.20925,1.70961],[44.229,1136.88,262.771,421.207,1.21032,1.70952],[44.456,1143.64,263.117,421.299,1.21139,1.70944],[44.683,1150.41,263.461,421.391,1.21245,1.70935],[44.909,1157.17,263.804,421.482,1.21351,1.70927],[45.133,1163.94,264.146,421.572,1.21457,1.70918],[45.357,1170.7,264.486,421.662,1.21562,1.7091],[45.58,1177.47,264.825,421.75,1.21667,1.70901],[45.801,1184.23,265.164,421.839,1.21771,1.70893],[46.022,1191,265.501,421.926,1.21875,1.70884],[46.242,1197.76,265.836,422.012,1.21978,1.70876],[46.461,1204.53,266.171,422.098,1.22081,1.70867],[46.679,1211.29,266.505,422.183,1.22183,1.70859],[46.896,1218.06,266.837,422.268,1.22285,1.7085],[47.112,1224.82,267.169,422.352,1.22387,1.70842],[47.328,1231.59,267.499,422.435,1.22488,1.70833],[47.542,1238.35,267.828,422.517,1.22589,1.70825],[47.756,1245.12,268.156,422.599,1.22689,1.70816],[47.968,1251.88,268.483,422.68,1.22789,1.70808],[48.18,1258.65,268.81,422.76,1.22889,1.70799],[48.391,1265.41,269.135,422.84,1.22988,1.70791],[48.601,1272.18,269.459,422.919,1.23087,1.70782],[48.81,1278.94,269.782,422.998,1.23185,1.70774],[49.019,1285.7,270.104,423.075,1.23283,1.70765],[49.227,1292.47,270.425,423.152,1.23381,1.70757],[49.433,1299.23,270.745,423.229,1.23479,1.70748],[49.639,1306,271.064,423.305,1.23576,1.7074],[49.845,1312.76,271.382,423.38,1.23672,1.70731],[50.049,1319.53,271.699,423.455,1.23768,1.70723],[50.253,1326.29,272.015,423.529,1.23864,1.70714],[50.456,1333.06,272.331,423.602,1.2396,1.70705],[50.658,1339.82,272.645,423.675,1.24055,1.70697],[50.859,1346.59,272.959,423.747,1.2415,1.70688],[51.059,1353.35,273.271,423.818,1.24245,1.7068],[51.259,1360.12,273.583,423.889,1.24339,1.70671],[51.458,1366.88,273.893,423.96,1.24433,1.70662],[51.657,1373.65,274.203,424.029,1.24526,1.70654],[51.854,1380.41,274.512,424.098,1.24619,1.70645],[52.051,1387.18,274.82,424.167,1.24712,1.70637],[52.247,1393.94,275.128,424.235,1.24805,1.70628],[52.443,1400.71,275.434,424.302,1.24897,1.70619],[52.638,1407.47,275.74,424.369,1.24989,1.7061],[52.832,1414.24,276.045,424.435,1.25081,1.70602],[53.025,1421,276.348,424.501,1.25172,1.70593],[53.218,1427.77,276.652,424.566,1.25263,1.70584],[53.41,1434.53,276.954,424.631,1.25353,1.70576],[53.601,1441.3,277.255,424.695,1.25444,1.70567],[53.791,1448.06,277.556,424.758,1.25534,1.70558],[53.981,1454.83,277.856,424.821,1.25624,1.70549],[54.171,1461.59,278.155,424.883,1.25713,1.7054],[54.359,1468.35,278.453,424.945,1.25802,1.70532],[54.547,1475.12,278.751,425.007,1.25891,1.70523],[54.734,1481.88,279.048,425.067,1.2598,1.70514],[54.921,1488.65,279.344,425.127,1.26068,1.70505],[55.107,1495.41,279.639,425.187,1.26156,1.70496],[55.293,1502.18,279.934,425.246,1.26244,1.70487],[55.477,1508.94,280.228,425.305,1.26332,1.70478],[55.662,1515.71,280.521,425.363,1.26419,1.70469],[55.845,1522.47,280.813,425.42,1.26506,1.7046],[56.028,1529.24,281.105,425.477,1.26593,1.70451],[56.21,1536,281.396,425.534,1.26679,1.70442],[56.392,1542.77,281.686,425.59,1.26765,1.70433],[56.573,1549.53,281.976,425.645,1.26851,1.70424],[56.754,1556.3,282.264,425.7,1.26937,1.70415],[56.934,1563.06,282.553,425.755,1.27022,1.70406],[57.113,1569.83,282.84,425.808,1.27108,1.70397],[57.292,1576.59,283.127,425.862,1.27192,1.70388],[57.47,1583.36,283.413,425.915,1.27277,1.70378],[57.648,1590.12,283.699,425.967,1.27362,1.70369],[57.825,1596.89,283.983,426.019,1.27446,1.7036],[58.001,1603.65,284.268,426.071,1.2753,1.70351],[58.177,1610.42,284.551,426.122,1.27613,1.70342],[58.352,1617.18,284.834,426.172,1.27697,1.70332],[58.527,1623.95,285.116,426.222,1.2778,1.70323],[58.702,1630.71,285.398,426.271,1.27863,1.70314],[58.875,1637.48,285.679,426.32,1.27946,1.70304],[59.048,1644.24,285.959,426.369,1.28028,1.70295],[59.221,1651.01,286.239,426.417,1.2811,1.70285],[59.393,1657.77,286.518,426.464,1.28192,1.70276],[59.565,1664.53,286.797,426.511,1.28274,1.70267],[59.736,1671.3,287.075,426.558,1.28356,1.70257],[59.907,1678.06,287.352,426.604,1.28437,1.70248],[60.077,1684.83,287.629,426.65,1.28518,1.70238],[60.246,1691.59,287.905,426.695,1.28599,1.70228],[60.415,1698.36,288.181,426.74,1.2868,1.70219],[60.584,1705.12,288.456,426.784,1.28761,1.70209],[60.752,1711.89,288.731,426.828,1.28841,1.702],[60.919,1718.65,289.005,426.871,1.28921,1.7019],[61.086,1725.42,289.278,426.914,1.29001,1.7018],[61.252,1732.18,289.551,426.956,1.29081,1.7017],[61.419,1738.95,289.823,426.998,1.2916,1.70161],[61.584,1745.71,290.095,427.04,1.29239,1.70151],[61.749,1752.48,290.366,427.081,1.29318,1.70141],[61.914,1759.24,290.637,427.121,1.29397,1.70131],[62.078,1766.01,290.907,427.161,1.29476,1.70121],[62.241,1772.77,291.176,427.201,1.29554,1.70111],[62.404,1779.54,291.445,427.24,1.29633,1.70101],[62.567,1786.3,291.714,427.279,1.29711,1.70091],[62.729,1793.07,291.982,427.317,1.29789,1.70081],[62.891,1799.83,292.249,427.355,1.29866,1.70071],[63.052,1806.6,292.516,427.393,1.29944,1.70061],[63.213,1813.36,292.783,427.43,1.30021,1.70051],[63.373,1820.13,293.049,427.466,1.30098,1.70041],[63.533,1826.89,293.315,427.502,1.30175,1.70031],[63.693,1833.66,293.58,427.538,1.30252,1.70021],[63.852,1840.42,293.844,427.573,1.30328,1.7001],[64.01,1847.18,294.108,427.608,1.30405,1.7],[64.169,1853.95,294.372,427.642,1.30481,1.6999],[64.326,1860.71,294.635,427.676,1.30557,1.6998],[64.484,1867.48,294.897,427.71,1.30633,1.69969],[64.641,1874.24,295.16,427.743,1.30709,1.69959],[64.797,1881.01,295.421,427.776,1.30784,1.69948],[64.953,1887.77,295.683,427.808,1.30859,1.69938],[65.109,1894.54,295.943,427.839,1.30935,1.69927],[65.264,1901.3,296.204,427.871,1.3101,1.69917],[65.418,1908.07,296.464,427.902,1.31084,1.69906],[65.573,1914.83,296.723,427.932,1.31159,1.69896],[65.727,1921.6,296.982,427.962,1.31234,1.69885],[65.88,1928.36,297.241,427.992,1.31308,1.69874],[66.033,1935.13,297.499,428.021,1.31382,1.69863],[66.186,1941.89,297.756,428.05,1.31456,1.69853],[66.338,1948.66,298.014,428.078,1.3153,1.69842],[66.49,1955.42,298.271,428.106,1.31604,1.69831],[66.641,1962.19,298.527,428.134,1.31677,1.6982],[66.793,1968.95,298.783,428.161,1.31751,1.69809],[66.943,1975.72,299.039,428.188,1.31824,1.69798],[67.093,1982.48,299.294,428.214,1.31897,1.69787],[67.243,1989.25,299.549,428.24,1.3197,1.69776],[67.393,1996.01,299.803,428.265,1.32043,1.69765],[67.542,2002.78,300.057,428.29,1.32115,1.69754],[67.691,2009.54,300.311,428.315,1.32188,1.69743],[67.839,2016.31,300.564,428.339,1.3226,1.69732],[67.987,2023.07,300.817,428.363,1.32332,1.6972],[68.135,2029.83,301.069,428.386,1.32404,1.69709],[68.282,2036.6,301.321,428.409,1.32476,1.69698],[68.429,2043.36,301.573,428.431,1.32548,1.69687],[68.575,2050.13,301.824,428.454,1.32619,1.69675],[68.721,2056.89,302.075,428.475,1.32691,1.69664],[68.867,2063.66,302.326,428.496,1.32762,1.69652],[69.013,2070.42,302.576,428.517,1.32833,1.69641],[69.157,2077.19,302.826,428.538,1.32904,1.69629],[69.302,2083.95,303.075,428.558,1.32975,1.69617],[69.447,2090.72,303.324,428.578,1.33046,1.69606],[69.59,2097.48,303.573,428.597,1.33116,1.69594],[69.734,2104.25,303.821,428.616,1.33187,1.69582],[69.877,2111.01,304.069,428.634,1.33257,1.69571],[70.02,2117.78,304.317,428.652,1.33327,1.69559],[70.163,2124.54,304.565,428.67,1.33398,1.69547],[70.305,2131.31,304.812,428.687,1.33468,1.69535],[70.447,2138.07,305.058,428.704,1.33537,1.69523],[70.588,2144.84,305.305,428.72,1.33607,1.69511],[70.729,2151.6,305.551,428.736,1.33677,1.69499],[70.87,2158.37,305.796,428.751,1.33746,1.69487],[71.011,2165.13,306.042,428.767,1.33815,1.69475],[71.151,2171.9,306.287,428.781,1.33885,1.69462],[71.291,2178.66,306.532,428.796,1.33954,1.6945],[71.43,2185.43,306.776,428.81,1.34023,1.69438],[71.569,2192.19,307.02,428.823,1.34092,1.69425],[71.708,2198.96,307.264,428.836,1.3416,1.69413],[71.847,2205.72,307.507,428.849,1.34229,1.69401],[71.985,2212.48,307.751,428.861,1.34297,1.69388]];
    var R134A_VAP = {"300":[[0.672,398.995,1.72671],[2,400.189,1.73106],[4,401.982,1.73756],[6,403.769,1.74398],[8,405.554,1.75035],[10,407.335,1.75667],[12,409.116,1.76293],[14,410.895,1.76915],[16,412.675,1.77533],[18,414.455,1.78146],[20,416.236,1.78756],[22,418.019,1.79362],[24,419.804,1.79965],[26,421.592,1.80564],[28,423.381,1.81161],[30,425.174,1.81754],[32,426.97,1.82345],[34,428.77,1.82932],[36,430.572,1.83517],[38,432.379,1.841],[40,434.19,1.8468],[42,436.004,1.85257],[44,437.823,1.85833],[46,439.646,1.86406],[48,441.473,1.86977],[50,443.305,1.87545],[52,445.141,1.88112],[54,446.982,1.88676],[56,448.828,1.89239],[58,450.679,1.89799],[60,452.534,1.90358],[62,454.395,1.90915],[64,456.26,1.91469],[66,458.13,1.92023],[68,460.006,1.92574],[70,461.887,1.93124],[72,463.773,1.93672],[74,465.664,1.94218],[76,467.56,1.94763],[78,469.462,1.95306],[80,471.369,1.95847],[82,473.281,1.96387],[84,475.199,1.96926],[86,477.122,1.97463],[88,479.051,1.97998],[90,480.985,1.98532],[92,482.925,1.99065],[94,484.87,1.99596],[96,486.821,2.00126],[98,488.778,2.00655],[100,490.739,2.01182]],"400":[[8.931,403.719,1.72259],[10,404.723,1.72614],[12,406.593,1.73272],[14,408.454,1.73923],[16,410.31,1.74567],[18,412.161,1.75205],[20,414.008,1.75837],[22,415.852,1.76464],[24,417.695,1.77086],[26,419.537,1.77704],[28,421.378,1.78318],[30,423.22,1.78927],[32,425.063,1.79533],[34,426.906,1.80135],[36,428.751,1.80734],[38,430.598,1.8133],[40,432.448,1.81922],[42,434.299,1.82511],[44,436.154,1.83098],[46,438.011,1.83682],[48,439.872,1.84263],[50,441.735,1.84841],[52,443.602,1.85417],[54,445.473,1.85991],[56,447.348,1.86562],[58,449.226,1.87131],[60,451.108,1.87698],[62,452.995,1.88262],[64,454.885,1.88825],[66,456.78,1.89385],[68,458.68,1.89944],[70,460.583,1.905],[72,462.492,1.91055],[74,464.405,1.91607],[76,466.322,1.92158],[78,468.244,1.92707],[80,470.171,1.93254],[82,472.103,1.938],[84,474.04,1.94343],[86,475.982,1.94886],[88,477.928,1.95426],[90,479.88,1.95965],[92,481.837,1.96502],[94,483.799,1.97038],[96,485.766,1.97572],[98,487.738,1.98105],[100,489.715,1.98637]],"500":[[15.735,407.471,1.71969],[16,407.73,1.72059],[18,409.674,1.72728],[20,411.606,1.7339],[22,413.528,1.74043],[24,415.443,1.7469],[26,417.352,1.7533],[28,419.256,1.75965],[30,421.157,1.76594],[32,423.054,1.77217],[34,424.95,1.77837],[36,426.844,1.78451],[38,428.737,1.79062],[40,430.631,1.79668],[42,432.525,1.80271],[44,434.419,1.80871],[46,436.315,1.81466],[48,438.212,1.82059],[50,440.111,1.82649],[52,442.012,1.83235],[54,443.916,1.83819],[56,445.822,1.84399],[58,447.73,1.84977],[60,449.642,1.85553],[62,451.556,1.86126],[64,453.474,1.86696],[66,455.395,1.87265],[68,457.32,1.87831],[70,459.249,1.88394],[72,461.181,1.88956],[74,463.117,1.89515],[76,465.057,1.90072],[78,467.001,1.90627],[80,468.949,1.9118],[82,470.901,1.91732],[84,472.858,1.92281],[86,474.819,1.92829],[88,476.785,1.93375],[90,478.755,1.93918],[92,480.729,1.94461],[94,482.709,1.95001],[96,484.693,1.9554],[98,486.681,1.96077],[100,488.675,1.96613]],"600":[[21.572,410.571,1.71746],[22,411.003,1.71892],[24,413.012,1.7257],[26,415.006,1.73239],[28,416.988,1.739],[30,418.96,1.74552],[32,420.924,1.75198],[34,422.882,1.75838],[36,424.834,1.76471],[38,426.782,1.77099],[40,428.727,1.77722],[42,430.669,1.78341],[44,432.61,1.78954],[46,434.549,1.79564],[48,436.488,1.8017],[50,438.426,1.80771],[52,440.365,1.81369],[54,442.305,1.81964],[56,444.245,1.82555],[58,446.187,1.83144],[60,448.13,1.83729],[62,450.076,1.84311],[64,452.023,1.8489],[66,453.973,1.85467],[68,455.925,1.86041],[70,457.88,1.86612],[72,459.837,1.87181],[74,461.798,1.87747],[76,463.762,1.88311],[78,465.729,1.88873],[80,467.7,1.89433],[82,469.674,1.8999],[84,471.652,1.90546],[86,473.634,1.91099],[88,475.619,1.9165],[90,477.609,1.922],[92,479.602,1.92747],[94,481.6,1.93293],[96,483.601,1.93836],[98,485.607,1.94378],[100,487.618,1.94918]],"700":[[26.713,413.197,1.71562],[28,414.535,1.72008],[30,416.598,1.7269],[32,418.646,1.73364],[34,420.68,1.74028],[36,422.702,1.74684],[38,424.716,1.75334],[40,426.721,1.75976],[42,428.72,1.76612],[44,430.714,1.77243],[46,432.703,1.77868],[48,434.689,1.78489],[50,436.672,1.79104],[52,438.654,1.79715],[54,440.634,1.80323],[56,442.612,1.80926],[58,444.591,1.81525],[60,446.569,1.8212],[62,448.548,1.82713],[64,450.528,1.83302],[66,452.508,1.83887],[68,454.49,1.8447],[70,456.474,1.8505],[72,458.459,1.85627],[74,460.447,1.86201],[76,462.436,1.86772],[78,464.428,1.87341],[80,466.423,1.87908],[82,468.42,1.88472],[84,470.421,1.89033],[86,472.424,1.89593],[88,474.43,1.9015],[90,476.44,1.90705],[92,478.454,1.91258],[94,480.47,1.91808],[96,482.491,1.92357],[98,484.515,1.92904],[100,486.543,1.93449]],"800":[[31.328,415.459,1.71404],[32,416.181,1.7164],[34,418.311,1.72336],[36,420.421,1.73021],[38,422.515,1.73696],[40,424.593,1.74362],[42,426.66,1.7502],[44,428.717,1.7567],[46,430.764,1.76314],[48,432.805,1.76951],[50,434.84,1.77583],[52,436.869,1.78209],[54,438.894,1.7883],[56,440.917,1.79446],[58,442.936,1.80058],[60,444.953,1.80665],[62,446.969,1.81269],[64,448.984,1.81868],[66,450.999,1.82464],[68,453.013,1.83056],[70,455.028,1.83645],[72,457.043,1.84231],[74,459.059,1.84813],[76,461.077,1.85392],[78,463.095,1.85969],[80,465.115,1.86543],[82,467.138,1.87114],[84,469.162,1.87682],[86,471.188,1.88248],[88,473.217,1.88811],[90,475.249,1.89372],[92,477.283,1.89931],[94,479.32,1.90487],[96,481.36,1.91041],[98,483.403,1.91593],[100,485.45,1.92143]],"900":[[35.526,417.431,1.71261],[36,417.954,1.7143],[38,420.148,1.72137],[40,422.317,1.72833],[42,424.467,1.73517],[44,426.599,1.74191],[46,428.716,1.74857],[48,430.821,1.75514],[50,432.915,1.76164],[52,435.001,1.76807],[54,437.078,1.77445],[56,439.149,1.78076],[58,441.215,1.78701],[60,443.276,1.79322],[62,445.333,1.79938],[64,447.388,1.80549],[66,449.44,1.81155],[68,451.49,1.81758],[70,453.538,1.82357],[72,455.586,1.82952],[74,457.633,1.83543],[76,459.68,1.84131],[78,461.728,1.84716],[80,463.775,1.85298],[82,465.824,1.85876],[84,467.874,1.86452],[86,469.925,1.87024],[88,471.978,1.87594],[90,474.032,1.88162],[92,476.089,1.88726],[94,478.147,1.89289],[96,480.208,1.89848],[98,482.272,1.90406],[100,484.338,1.90961]],"1000":[[39.388,419.162,1.71127],[40,419.857,1.71349],[42,422.11,1.72067],[44,424.335,1.7277],[46,426.537,1.73462],[48,428.719,1.74144],[50,430.884,1.74816],[52,433.035,1.7548],[54,435.173,1.76135],[56,437.3,1.76783],[58,439.419,1.77425],[60,441.529,1.78061],[62,443.633,1.7869],[64,445.731,1.79314],[66,447.825,1.79933],[68,449.914,1.80548],[70,452,1.81157],[72,454.084,1.81763],[74,456.165,1.82364],[76,458.244,1.82961],[78,460.323,1.83555],[80,462.4,1.84145],[82,464.478,1.84731],[84,466.555,1.85315],[86,468.632,1.85895],[88,470.71,1.86472],[90,472.789,1.87046],[92,474.869,1.87617],[94,476.951,1.88185],[96,479.034,1.88751],[98,481.118,1.89314],[100,483.205,1.89875]],"1100":[[42.969,420.689,1.70999],[44,421.892,1.71379],[46,424.199,1.72104],[48,426.475,1.72815],[50,428.726,1.73513],[52,430.954,1.74201],[54,433.164,1.74878],[56,435.357,1.75547],[58,437.537,1.76207],[60,439.704,1.76859],[62,441.861,1.77505],[64,444.008,1.78144],[66,446.148,1.78777],[68,448.282,1.79404],[70,450.409,1.80026],[72,452.532,1.80642],[74,454.65,1.81254],[76,456.765,1.81862],[78,458.877,1.82465],[80,460.987,1.83064],[82,463.095,1.83659],[84,465.202,1.84251],[86,467.308,1.84839],[88,469.413,1.85424],[90,471.518,1.86005],[92,473.623,1.86583],[94,475.729,1.87158],[96,477.835,1.8773],[98,479.942,1.88299],[100,482.05,1.88866]],"1200":[[46.315,422.041,1.70873],[48,424.057,1.71502],[50,426.413,1.72234],[52,428.737,1.72951],[54,431.032,1.73654],[56,433.304,1.74347],[58,435.555,1.75028],[60,437.788,1.75701],[62,440.005,1.76364],[64,442.209,1.7702],[66,444.402,1.77669],[68,446.585,1.7831],[70,448.759,1.78946],[72,450.925,1.79575],[74,453.085,1.80199],[76,455.239,1.80818],[78,457.388,1.81431],[80,459.533,1.82041],[82,461.674,1.82645],[84,463.813,1.83246],[86,465.949,1.83842],[88,468.084,1.84435],[90,470.217,1.85024],[92,472.349,1.85609],[94,474.48,1.86191],[96,476.611,1.8677],[98,478.742,1.87346],[100,480.874,1.87919]],"1300":[[49.457,423.238,1.70747],[50,423.909,1.70955],[52,426.352,1.71709],[54,428.753,1.72445],[56,431.119,1.73166],[58,433.455,1.73874],[60,435.766,1.74569],[62,438.054,1.75254],[64,440.324,1.75929],[66,442.577,1.76596],[68,444.816,1.77254],[70,447.042,1.77904],[72,449.257,1.78548],[74,451.462,1.79185],[76,453.66,1.79816],[78,455.85,1.80442],[80,458.033,1.81062],[82,460.211,1.81677],[84,462.385,1.82287],[86,464.554,1.82893],[88,466.72,1.83494],[90,468.883,1.84092],[92,471.044,1.84685],[94,473.203,1.85275],[96,475.36,1.85861],[98,477.517,1.86443],[100,479.672,1.87023]],"1400":[[52.422,424.295,1.7062],[54,426.29,1.71231],[56,428.774,1.71988],[58,431.215,1.72727],[60,433.619,1.73451],[62,435.992,1.74161],[64,438.338,1.74859],[66,440.661,1.75546],[68,442.964,1.76224],[70,445.25,1.76892],[72,447.52,1.77551],[74,449.777,1.78203],[76,452.023,1.78848],[78,454.258,1.79487],[80,456.484,1.80119],[82,458.702,1.80745],[84,460.914,1.81366],[86,463.119,1.81982],[88,465.319,1.82593],[90,467.515,1.83199],[92,469.707,1.83801],[94,471.895,1.84399],[96,474.081,1.84992],[98,476.264,1.85582],[100,478.446,1.86168]],"1500":[[55.233,425.227,1.7049],[56,426.23,1.70795],[58,428.801,1.71574],[60,431.321,1.72332],[62,433.796,1.73073],[64,436.234,1.73798],[66,438.64,1.7451],[68,441.018,1.75209],[70,443.372,1.75897],[72,445.706,1.76575],[74,448.021,1.77244],[76,450.321,1.77905],[78,452.607,1.78557],[80,454.88,1.79203],[82,457.143,1.79842],[84,459.396,1.80475],[86,461.64,1.81101],[88,463.878,1.81723],[90,466.109,1.82339],[92,468.334,1.8295],[94,470.554,1.83556],[96,472.77,1.84158],[98,474.983,1.84756],[100,477.192,1.85349]],"1600":[[57.906,426.043,1.70356],[58,426.17,1.70394],[60,428.836,1.71197],[62,431.438,1.71976],[64,433.988,1.72734],[66,436.493,1.73475],[68,438.961,1.742],[70,441.396,1.74912],[72,443.802,1.75611],[74,446.185,1.763],[76,448.546,1.76978],[78,450.889,1.77647],[80,453.215,1.78308],[82,455.527,1.7896],[84,457.826,1.79606],[86,460.114,1.80245],[88,462.392,1.80877],[90,464.662,1.81504],[92,466.923,1.82125],[94,469.178,1.82741],[96,471.427,1.83352],[98,473.671,1.83958],[100,475.91,1.8456]],"1700":[[60.456,426.751,1.70217],[62,428.879,1.70853],[64,431.569,1.71653],[66,434.197,1.7243],[68,436.772,1.73188],[70,439.303,1.73927],[72,441.796,1.74652],[74,444.256,1.75362],[76,446.688,1.76061],[78,449.096,1.76749],[80,451.482,1.77426],[82,453.849,1.78095],[84,456.2,1.78755],[86,458.536,1.79407],[88,460.859,1.80052],[90,463.17,1.8069],[92,465.472,1.81322],[94,467.764,1.81948],[96,470.048,1.82569],[98,472.325,1.83184],[100,474.596,1.83794]]};
    /* R134A-PROPS:END */
    var SAT_COL = { T: 0, P: 1, hf: 2, hg: 3, sf: 4, sg: 5 };
    /* saturation property `to` where saturation property `from` (T or P, both monotonic) = v */
    function r134aSat(from, v, to) {
        var a = SAT_COL[from], b = SAT_COL[to], t = R134A_SAT, i;
        if (typeof v !== 'number' || !isFinite(v)) return null;
        for (i = 0; i < t.length - 1; i++) {
            if ((t[i][a] - v) * (t[i + 1][a] - v) <= 0) {
                return t[i][a] === t[i + 1][a] ? t[i][b] : t[i][b] + (t[i + 1][b] - t[i][b]) * (v - t[i][a]) / (t[i + 1][a] - t[i][a]);
            }
        }
        return null;
    }
    var VAP_COL = { T: 0, h: 1, s: 2 };
    function vapIso(P, from, v, to) {
        var rows = R134A_VAP[P], a = VAP_COL[from], b = VAP_COL[to], i;
        if (!rows) return null;
        for (i = 0; i < rows.length - 1; i++) {
            if ((rows[i][a] - v) * (rows[i + 1][a] - v) <= 0) {
                return rows[i][b] + (rows[i + 1][b] - rows[i][b]) * (v - rows[i][a]) / (rows[i + 1][a] - rows[i][a]);
            }
        }
        return null;
    }
    var VAP_P = (function () { var k = [], p; for (p in R134A_VAP) { if (Object.prototype.hasOwnProperty.call(R134A_VAP, p)) k.push(Number(p)); } return k.sort(function (x, y) { return x - y; }); }());
    /* superheated-vapour property `to` at pressure P (kPa abs) where `from` (T, h or s) = v:
     * interpolated along the two bracketing isobars, then linearly in pressure. Temperatures
     * are carried as SUPERHEAT (T - Tsat of each isobar), so a point just above saturation at P
     * reads the same superheat on both neighbours instead of falling below the dome of one. */
    function r134aVap(P, from, v, to) {
        var i, p0, p1, y0, y1, ts, t0, t1;
        if (typeof P !== 'number' || typeof v !== 'number' || !isFinite(P) || !isFinite(v)) return null;
        ts = r134aSat('P', P, 'T');
        if (ts === null) return null;
        for (i = 0; i < VAP_P.length - 1; i++) {
            p0 = VAP_P[i]; p1 = VAP_P[i + 1];
            if (P >= p0 && P <= p1) {
                t0 = R134A_VAP[p0][0][0]; t1 = R134A_VAP[p1][0][0];   /* first vapour row = saturated vapour */
                y0 = vapIso(p0, from, from === 'T' ? t0 + (v - ts) : v, to);
                y1 = vapIso(p1, from, from === 'T' ? t1 + (v - ts) : v, to);
                if (y0 === null || y1 === null) return null;
                if (to === 'T') { y0 -= t0; y1 -= t1; }
                return y0 + (y1 - y0) * (P - p0) / (p1 - p0) + (to === 'T' ? ts : 0);
            }
        }
        return null;
    }
    /* One pass of the cycle at saturation temperatures (evapSat, condSat) and isentropic
     * efficiency eta (equal for both stages), per kW of evaporator duty.
     *   1 evaporator outlet   P_evap, T = Tsat + superheat
     *   2 stage-1 discharge   P_int = sqrt(P_evap x P_cond) (equal stage pressure ratio), h2 = h1 + (h2s - h1) / eta
     *   3 stage-2 suction     mix of 2 (1 - x_f) and saturated economiser vapour (x_f)
     *   4 stage-2 discharge   P_cond, h4 = h3 + (h4s - h3) / eta
     *   5 condenser outlet    saturated liquid at Tcond - subcooling (h of the compressed liquid ~ hf at its T)
     *   6 after EXV-1         P_int, h6 = h5, flash fraction x_f = (h5 - hf_int) / (hfg_int)
     *   7 economiser liquid   P_int, saturated liquid
     *   8 after EXV-2         P_evap, h8 = h7
     * Mass flows: m_e = 1 / (h1 - h8) per kW of duty, m_c = m_e / (1 - x_f). */
    function cycleAt(c, evapSat, condSat, eta) {
        var Pe = r134aSat('T', evapSat, 'P'), Pc = r134aSat('T', condSat, 'P');
        if (Pe === null || Pc === null || !(eta > 0)) return null;
        var Pi = Math.sqrt(Pe * Pc), Ti = r134aSat('P', Pi, 'T');
        var T1 = evapSat + c.chiller_superheat_k;
        var h1 = r134aVap(Pe, 'T', T1, 'h'), s1 = r134aVap(Pe, 'T', T1, 's');
        var h5 = r134aSat('T', condSat - c.chiller_subcool_k, 'hf');
        var hfi = r134aSat('P', Pi, 'hf'), hgi = r134aSat('P', Pi, 'hg'), sgi = r134aSat('P', Pi, 'sg');
        if ([h1, s1, h5, hfi, hgi, Ti].some(function (x) { return x === null; })) return null;
        var xf = (h5 - hfi) / (hgi - hfi), h7 = hfi, h8 = h7;
        var h2s = r134aVap(Pi, 's', s1, 'h');
        if (h2s === null) return null;
        var h2 = h1 + (h2s - h1) / eta, h3 = (1 - xf) * h2 + xf * hgi, s3 = r134aVap(Pi, 'h', h3, 's');
        var h4s = s3 === null ? null : r134aVap(Pc, 's', s3, 'h');
        if (h4s === null) return null;
        var h4 = h3 + (h4s - h3) / eta;
        var me = 1 / (h1 - h8), mc = me / (1 - xf);
        var w = me * (h2 - h1) + mc * (h4 - h3);
        var T2 = r134aVap(Pi, 'h', h2, 'T'), T3 = r134aVap(Pi, 'h', h3, 'T'), T4 = r134aVap(Pc, 'h', h4, 'T');
        var s2 = r134aVap(Pi, 'h', h2, 's'), s4 = r134aVap(Pc, 'h', h4, 's');
        var sf5 = r134aSat('T', condSat - c.chiller_subcool_k, 'sf'), sfi = r134aSat('P', Pi, 'sf');
        var sgI = sgi, s6 = sfi + xf * (sgI - sfi);
        var hfe = r134aSat('P', Pe, 'hf'), hge = r134aSat('P', Pe, 'hg'), sfe = r134aSat('P', Pe, 'sf'), sge = r134aSat('P', Pe, 'sg');
        var x8 = (h8 - hfe) / (hge - hfe), s8 = sfe + x8 * (sge - sfe);
        return {
            pEvap: Pe, pInt: Pi, pCond: Pc, tInt: Ti, xf: xf, x8: x8,
            mEvapPerKw: me, mCondPerKw: mc, shaftPerKw: w, condPerKw: mc * (h4 - h5), eta: eta,
            points: [
                { pt: 1, where: 'evaporator outlet', t: T1, p: Pe, h: h1, s: s1, x: null, phase: 'vapour' },
                { pt: 2, where: 'stage 1 discharge', t: T2, p: Pi, h: h2, s: s2, x: null, phase: 'vapour' },
                { pt: 3, where: 'stage 2 suction', t: T3, p: Pi, h: h3, s: s3, x: null, phase: 'vapour' },
                { pt: 4, where: 'stage 2 discharge', t: T4, p: Pc, h: h4, s: s4, x: null, phase: 'vapour' },
                { pt: 5, where: 'condenser outlet', t: condSat - c.chiller_subcool_k, p: Pc, h: h5, s: sf5, x: null, phase: 'liquid' },
                { pt: 6, where: 'after EXV-1', t: Ti, p: Pi, h: h5, s: s6, x: xf, phase: 'two-phase' },
                { pt: 7, where: 'economiser liquid', t: Ti, p: Pi, h: h7, s: sfi, x: 0, phase: 'liquid' },
                { pt: 8, where: 'after EXV-2', t: evapSat, p: Pe, h: h8, s: s8, x: x8, phase: 'two-phase' }
            ]
        };
    }
    function driveEff(c) { return c.chiller_motor_efficiency * c.chiller_vfd_efficiency; }
    /* AHRI 550/590 standard rating point of the SAME machine: leaving CHW 6.7 C, entering CDW 29.4 C,
     * CDW flow 3.0 gpm/ton -> range = 12,000 x (1 + rated specific power) / (500 x 3.0) F; the
     * engine's own approaches give the saturation temperatures. */
    function ratingSat(c) {
        var rangeK = 12000 * (1 + c.chiller_rated_specific_power_kw_e_per_kw_th) / (500 * c.chiller_rating_cdw_gpm_per_ton) * 5 / 9;
        return { evap: c.chiller_rating_chws_c - c.chiller_evap_approach_k,
            cond: c.chiller_rating_cdw_supply_c + rangeK + c.chiller_cond_approach_k, rangeK: rangeK };
    }
    /* eta_is that makes the cycle at the rating point use exactly the rated specific power
     * (bisection; shaft work falls as eta rises) */
    function ratedEta(c) {
        var rs = ratingSat(c), target = c.chiller_rated_specific_power_kw_e_per_kw_th * driveEff(c), lo = 0.3, hi = 1.0, i, mid, r;
        for (i = 0; i < 60; i++) {
            mid = (lo + hi) / 2; r = cycleAt(c, rs.evap, rs.cond, mid);
            if (!r) return null;
            if (r.shaftPerKw > target) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }
    /* the chiller at the plant's own saturation temperatures, with the rating-point eta */
    function chillerCycle(m) {
        var c = m.cooling, eta = ratedEta(c);
        var evapSat = chwsC(m) - c.chiller_evap_approach_k;
        var condSat = c.cdw_supply_c + c.cdw_range_k + c.chiller_cond_approach_k;
        var r = eta === null ? null : cycleAt(c, evapSat, condSat, eta);
        if (!r) return null;
        r.specificPower = r.shaftPerKw / driveEff(c);
        r.rating = ratingSat(c);
        return r;
    }
    /* specific power at the operating point (kW_e per kW_th); the rated value when the cycle
     * cannot be solved (outside the property rows) */
    function chillerSpecificPower(m) {
        var r = chillerCycle(m);
        return r ? r.specificPower : m.cooling.chiller_rated_specific_power_kw_e_per_kw_th;
    }

    /* Hydraulic power kW = rho g Q H / 1000, Q in m3/s (L/s / 1000). */
    function pumpHydraulicKw(c, flowLps, headM) {
        return c.water_density_kg_m3 * c.gravity_m_s2 * (flowLps / 1000) * headM / 1000;
    }
    /* Electrical input kW = hydraulic / pump eff / (motor eff x VFD eff). */
    /* 2.7.0 — operating speed of a variable-speed centrifugal pump (PRD-CONV-OPS-DEPTH 01 §6.1).
     * Pump curve  H(q, n) = n^2 H0 - b q^2,  H0 = r Hd,  b = (H0 - Hd) / qd^2  (n = 1 at the design point);
     * system     Hsys(Q) = Hsp + (Hd - Hsp) (Q / QD)^2.
     * Equal:      n = sqrt((Hsys + (H0 - Hd) xp^2) / H0),  xp = q / qd (this pump), xs = Q / QD (the system).
     * A dedicated branch with no setpoint (primary: Hsp = 0, xs = xp) gives n = xp exactly (homologous).
     * Never below the minimum VFD speed. Returns a fraction, or null for no flow. */
    function pumpSpeedFraction(c, xp, xs, headDesignM, headSetM) {
        if (xp === null || xs === null || !(xp > 0)) return null;
        var h0 = c.pump_shutoff_head_ratio * headDesignM;
        var hsys = headSetM + (headDesignM - headSetM) * xs * xs;
        var n = Math.sqrt((hsys + (h0 - headDesignM) * xp * xp) / h0);
        return Math.max(c.pump_min_speed_pct / 100, n);
    }
    /* 2.8.0 — tower bypass (3-way TV-01, B port to the condenser return): the mixed entering condenser temperature
     * T_ecw = x T_return + (1 - x) T_cold is held at or above chiller_min_ecwt_c, so
     * x = clamp((T_min - T_cold) / (T_return - T_cold), 0, 1). T_cold = wet-bulb + tower approach. */
    function towerBypass(c, wbC) {
        var approach = c.cdw_supply_c - c.tower_design_wet_bulb_c;
        var tCold = wbC + approach, tRet = tCold + c.cdw_range_k;
        var x = Math.min(1, Math.max(0, (c.chiller_min_ecwt_c - tCold) / (tRet - tCold)));
        return { x: x, tCold: tCold, tRet: tRet, tEcw: x * tRet + (1 - x) * tCold };
    }
    function kpaToHeadM(c, kpa) { return kpa * 1000 / (c.water_density_kg_m3 * c.gravity_m_s2); }
    /* 2.10.0 — the head a pump delivers at its operating point is the system curve at that flow (PRD-CONV-OPS-DEPTH 01
     * §6.1, Amendment E1): H_sys = H_sp + (H_d - H_sp) x_s^2. Primary branch H_sp = 0 (so H_d x^2), condenser H_sp = the
     * static lift, secondary H_sp = the remote DP setpoint. At design flow (x_s = 1) it is H_d, the 2.9.0 figure. */
    function pumpOperatingHeadM(headDesignM, headSetM, xs) {
        if (xs === null || !(xs >= 0)) return null;
        return headSetM + (headDesignM - headSetM) * xs * xs;
    }

    function pumpElectricalKw(c, flowLps, headM) {
        return pumpHydraulicKw(c, flowLps, headM) / c.pump_efficiency
            / (c.pump_motor_efficiency * c.pump_vfd_efficiency);
    }

    /* Unrounded plant-internals values. Everything here derives from the engine's own
     * published quantities (heat rejection, running counts, specific power, CDW range,
     * CHW delta-T, hall IT load) plus the authored internals basis on MODEL.cooling.
     * The chain, at the adopted scenario:
     *   unit duty          = 31,250 / 7                      = 4,464.3 kW_th
     *   unit input         = 31,250 x 0.16491 / 7            =   736.2 kW_e
     *   unit condenser     = duty + input                    = 5,200.5 kW_th  (x 7 = tower rejection)
     *   unit CHW flow      = plant duty flow / running       =   140.3 L/s
     *   unit CDW flow      = 5,200.5 / (4.186 x 5)           =   248.5 L/s
     *   evap sat           = CHWS 19.4 - 1.5                 =  17.9 C  -> 535.3 kPa abs
     *   cond sat           = CDW return 37.0 + 1.5           =  38.5 C  -> 977.1 kPa abs
     *   Carnot COP         = (17.9 + 273.15) / 20.6          =  14.13 ; plant COP 6.06 -> 0.429
     *   secondary pumps    = ceil(982.3 / 250) + 1           =   5 (4 duty)
     *   tower cell load    = 5,200.5 / (5,000 x 1.16491)     =  89.3 %  -> fan 55 x 0.893^3 kW
     *   CRAH unit duty     = 7,500 / 58                      =   129.3 kW */
    function plantInternals(m) {
        var c = m.cooling;
        var heatRej = heatRejectionKw(m);
        var running = chillersRunning(m), total = chillersTotal(m);
        var sp = chillerSpecificPower(m);   /* 2.5.0: operating point of the cycle, not the rating */
        var cp = c.water_cp_kj_per_kg_k;
        var dutyFlow = heatRej / (cp * chwDeltaT(m));
        var unitDuty = running ? heatRej / running : null;
        var unitInput = running ? heatRej * sp / running : null;
        var unitCond = unitDuty === null ? null : unitDuty + unitInput;
        var unitChwFlow = running ? dutyFlow / running : null;
        var unitCdwFlow = unitCond === null ? null : unitCond / (cp * c.cdw_range_k);

        var evapSat = chwsC(m) - c.chiller_evap_approach_k;
        var condSat = c.cdw_supply_c + c.cdw_range_k + c.chiller_cond_approach_k;
        var lift = condSat - evapSat;
        var pEvap = refrigerantSatKpa(c.chiller_refrigerant, evapSat);
        var pCond = refrigerantSatKpa(c.chiller_refrigerant, condSat);
        var carnot = lift > 0 ? (evapSat + KELVIN_OFFSET) / lift : null;
        var cop = 1 / sp;

        /* Hydronic fleet. Primary: chw_primary_pumps_per_train per chiller train, one
         * running per running chiller. Secondary: duty pumps share the plant duty flow
         * equally, + the header standby. Condenser: one per chiller. */
        var priCount = total * c.chw_primary_pumps_per_train;
        var secDuty = Math.ceil(dutyFlow / c.chw_secondary_unit_flow_lps);
        var secCount = secDuty + c.pump_standby_per_header;
        var secFlow = secDuty ? dutyFlow / secDuty : null;
        /* 2.7.0 — operating speeds. Design flow of one chiller branch = the chiller's rated duty at the design CHW
         * delta-T (primary) and its rated heat rejection at the CDW range (condenser). */
        var priDesignFlow = c.chiller_unit_kw_th / (cp * chwDeltaT(m));
        var cdwDesignFlow = c.chiller_unit_kw_th * (1 + sp) / (cp * c.cdw_range_k);
        var priX = unitChwFlow === null ? null : unitChwFlow / priDesignFlow;
        var cdwX = unitCdwFlow === null ? null : unitCdwFlow / cdwDesignFlow;
        var secXp = secFlow === null ? null : secFlow / c.chw_secondary_unit_flow_lps;
        var secXs = secDuty ? dutyFlow / (secDuty * c.chw_secondary_unit_flow_lps) : null;
        var priSpeed = pumpSpeedFraction(c, priX, priX, c.chw_primary_head_m, 0);
        var secSpeed = pumpSpeedFraction(c, secXp, secXs, c.chw_secondary_head_m, kpaToHeadM(c, c.chw_secondary_dp_setpoint_kpa));
        var cdwSpeed = pumpSpeedFraction(c, cdwX, cdwX, c.cdw_head_m, c.cdw_static_head_m);
        /* 2.10.0 — power at the operating head of each loop, not the design head (Amendment E1) */
        var priHeadOp = pumpOperatingHeadM(c.chw_primary_head_m, 0, priX);
        var secHeadOp = pumpOperatingHeadM(c.chw_secondary_head_m, kpaToHeadM(c, c.chw_secondary_dp_setpoint_kpa), secXs);
        var cdwHeadOp = pumpOperatingHeadM(c.cdw_head_m, c.cdw_static_head_m, cdwX);
        var priKw = unitChwFlow === null ? null : pumpElectricalKw(c, unitChwFlow, priHeadOp);
        var secKw = secFlow === null ? null : pumpElectricalKw(c, secFlow, secHeadOp);
        var cdwKw = unitCdwFlow === null ? null : pumpElectricalKw(c, unitCdwFlow, cdwHeadOp);
        var priFleet = priKw === null ? null : priKw * running;
        var secFleet = secKw === null ? null : secKw * secDuty;
        var cdwFleet = cdwKw === null ? null : cdwKw * running;
        var pumpFleet = (priFleet === null || secFleet === null || cdwFleet === null) ? null
            : priFleet + secFleet + cdwFleet;

        /* Heat rejection: one cell per chiller (+ declared standby cells); a cell is rated
         * for the condenser duty of one chiller at full capacity. Fan speed follows cell
         * load (declared rule), fan power the cube law. */
        var cellRated = c.chiller_unit_kw_th * (1 + sp);
        var cellLoad = unitCond === null ? null : unitCond / cellRated * 100;
        var fanKw = cellLoad === null ? null : c.tower_fan_motor_kw * Math.pow(cellLoad / 100, 3);
        var fanFleet = fanKw === null ? null : fanKw * running;

        /* CRAH per unit: hall sensible demand = hall IT load (the substitution crahRequired()
         * makes), shared by the running units. Fan speed = load % under constant air delta-T. */
        var hallDemand = m.campus.halls.length ? m.site.it_load_kw / m.campus.halls.length : 0;
        var crahRun = crahRequired(m);
        var crahDuty = crahRun ? hallDemand / crahRun : null;
        var crahLoad = crahDuty === null ? null : crahDuty / c.crah_unit_sensible_kw * 100;
        var crahChw = crahDuty === null ? null : crahDuty / (cp * chwDeltaT(m));

        var chillerInput = heatRej * sp;
        var mechInput = pumpFleet === null || fanFleet === null ? null : chillerInput + pumpFleet + fanFleet;
        var mechHeadroom = mechInput === null ? null : nonItLoadKw(m) - upsLossKw(m) - mechInput;

        return {
            unitDuty: unitDuty, unitInput: unitInput, unitCond: unitCond, unitChwFlow: unitChwFlow,
            unitCdwFlow: unitCdwFlow, evapSat: evapSat, condSat: condSat, lift: lift,
            pEvap: pEvap, pCond: pCond, carnot: carnot, cop: cop,
            priCount: priCount, priRunning: running, secDuty: secDuty, secCount: secCount,
            secFlow: secFlow, cdwCount: total, cdwRunning: running,
            priKw: priKw, secKw: secKw, cdwKw: cdwKw,
            priHeadOp: priHeadOp, secHeadOp: secHeadOp, cdwHeadOp: cdwHeadOp,
            unitChwFlowP: unitChwFlow, secFlowP: secFlow, unitCdwFlowP: unitCdwFlow,
            priFleet: priFleet, secFleet: secFleet, cdwFleet: cdwFleet, pumpFleet: pumpFleet,
            cellCount: total + c.tower_standby_cells, cellRunning: running, cellRated: cellRated,
            cellLoad: cellLoad, approach: c.cdw_supply_c - c.tower_design_wet_bulb_c,
            fanKw: fanKw, fanFleet: fanFleet,
            crahDuty: crahDuty, crahLoad: crahLoad, crahChw: crahChw,
            mechInput: mechInput, mechHeadroom: mechHeadroom,
            priSpeed: priSpeed, secSpeed: secSpeed, cdwSpeed: cdwSpeed, secXp: secXp, secXs: secXs,
            dutyFlow: dutyFlow, running: running, priDesignFlow: priDesignFlow, cdwDesignFlow: cdwDesignFlow
        };
    }

    /* ADDITIVE (2.4.0) — authored internals inputs republished unchanged, derived values
     * appended. No key published by 2.3.0 is touched (gate: flattened snapshot diff). */
    var INTERNALS_AUTHORED_KEYS = [
        'chiller_refrigerant', 'chiller_evap_approach_k', 'chiller_cond_approach_k',
        'water_density_kg_m3', 'gravity_m_s2', 'pump_efficiency', 'pump_motor_efficiency',
        'pump_vfd_efficiency', 'pump_speed_pct', 'chw_primary_pumps_per_train', 'chw_primary_head_m',
        'chw_secondary_head_m', 'cdw_head_m', 'chw_secondary_unit_flow_lps', 'pump_standby_per_header',
        'tower_design_wet_bulb_c', 'tower_fan_motor_kw', 'tower_standby_cells',
        /* 2.7.0 */ 'motor_base_frequency_hz', 'pump_shutoff_head_ratio', 'pump_min_speed_pct', 'cdw_static_head_m',
        'chw_secondary_dp_setpoint_kpa',
        /* 2.8.0 */ 'chiller_min_evap_flow_pct', 'chiller_min_ecwt_c'
    ];
    function withPlantInternals(m, base) {
        var out = {}, key, i;
        for (key in base) { if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key]; }
        for (i = 0; i < INTERNALS_AUTHORED_KEYS.length; i++) out[INTERNALS_AUTHORED_KEYS[i]] = m.cooling[INTERNALS_AUTHORED_KEYS[i]];
        var p = plantInternals(m);
        var r1n = function (v) { return v === null ? null : round1(v); };
        var r2n = function (v) { return v === null ? null : round2(v); };
        var r3n = function (v) { return v === null ? null : Math.round(v * 1000) / 1000; };
        var derived = {
            chiller_unit_duty_kw_th: r1n(p.unitDuty),
            chiller_unit_chw_flow_lps: r1n(p.unitChwFlow),
            chiller_unit_condenser_duty_kw_th: r1n(p.unitCond),
            chiller_unit_cdw_flow_lps: r1n(p.unitCdwFlow),
            chiller_evap_sat_c: round2(p.evapSat),
            chiller_cond_sat_c: round2(p.condSat),
            chiller_lift_k: round2(p.lift),
            chiller_evap_sat_kpa_abs: r1n(p.pEvap),
            chiller_evap_sat_kpa_g: p.pEvap === null ? null : round1(p.pEvap - ATM_KPA),
            chiller_cond_sat_kpa_abs: r1n(p.pCond),
            chiller_cond_sat_kpa_g: p.pCond === null ? null : round1(p.pCond - ATM_KPA),
            chiller_pressure_ratio: (p.pEvap && p.pCond) ? r3n(p.pCond / p.pEvap) : null,
            chiller_carnot_cop: r2n(p.carnot),
            chiller_carnot_fraction: p.carnot ? r3n(p.cop / p.carnot) : null,
            chw_primary_pump_count: p.priCount,
            chw_primary_pumps_running: p.priRunning,
            chw_primary_pump_flow_lps: r1n(p.unitChwFlow),
            chw_primary_pump_kw_e: r1n(p.priKw),
            chw_primary_fleet_kw_e: r1n(p.priFleet),
            chw_secondary_pump_count: p.secCount,
            chw_secondary_pumps_running: p.secDuty,
            chw_secondary_pump_flow_lps: r1n(p.secFlow),
            chw_secondary_pump_kw_e: r1n(p.secKw),
            chw_secondary_fleet_kw_e: r1n(p.secFleet),
            cdw_pump_count: p.cdwCount,
            cdw_pumps_running: p.cdwRunning,
            cdw_pump_flow_lps: r1n(p.unitCdwFlow),
            cdw_pump_kw_e: r1n(p.cdwKw),
            cdw_fleet_kw_e: r1n(p.cdwFleet),
            pump_fleet_input_kw: r1n(p.pumpFleet),
            tower_cell_count: p.cellCount,
            tower_cells_running: p.cellRunning,
            tower_cell_rejection_kw_th: r1n(p.unitCond),
            tower_cell_rated_kw_th: round1(p.cellRated),
            tower_cell_load_pct: r1n(p.cellLoad),
            tower_approach_k: round2(p.approach),
            tower_fan_speed_pct: r1n(p.cellLoad),
            tower_fan_kw: r2n(p.fanKw),
            tower_fan_fleet_kw: r1n(p.fanFleet),
            crah_unit_duty_kw: r2n(p.crahDuty),
            crah_unit_load_pct: r1n(p.crahLoad),
            crah_fan_speed_pct: r1n(p.crahLoad),
            crah_unit_chw_flow_lps: r2n(p.crahChw),
            mech_plant_input_kw: r1n(p.mechInput),
            mech_plant_headroom_kw: r1n(p.mechHeadroom)
        };
        /* ADDITIVE (2.5.0) — the refrigeration cycle of a running unit (PRD-CONV-EQUIPMENT-INSIDE §5.2) */
        var cy = chillerCycle(m), cc = m.cooling, ud = p.unitDuty;
        var rs = ratingSat(cc), liftRated = rs.cond - rs.evap;
        var loadFr = ud === null ? null : ud / cc.chiller_unit_kw_th;
        /* speed: a centrifugal's head goes with speed squared, so the lift needs sqrt(lift / rated lift);
         * the load needs speed in proportion (flow goes with speed). The drive runs at the larger of the
         * two (never below the minimum speed); the guide vanes trim the rest: IGV = load / speed. */
        var spd = loadFr === null ? null : Math.min(1, Math.max(cc.chiller_min_speed_pct / 100, Math.sqrt(p.lift / liftRated), loadFr));
        var igv = spd === null ? null : Math.min(1, Math.max(0.2, loadFr / spd));
        var cycleKeys = {
            chiller_rated_specific_power_kw_e_per_kw_th: cc.chiller_rated_specific_power_kw_e_per_kw_th,
            chiller_rating_chws_c: cc.chiller_rating_chws_c, chiller_rating_cdw_supply_c: cc.chiller_rating_cdw_supply_c,
            chiller_rating_cdw_gpm_per_ton: cc.chiller_rating_cdw_gpm_per_ton,
            chiller_superheat_k: cc.chiller_superheat_k, chiller_subcool_k: cc.chiller_subcool_k,
            chiller_motor_efficiency: cc.chiller_motor_efficiency, chiller_vfd_efficiency: cc.chiller_vfd_efficiency,
            chiller_min_speed_pct: cc.chiller_min_speed_pct,
            chiller_rating_evap_sat_c: round2(rs.evap), chiller_rating_cond_sat_c: round2(rs.cond), chiller_rating_lift_k: round2(liftRated),
            chiller_eta_is: cy ? r3n(cy.eta) : null,
            chiller_int_sat_kpa_abs: cy ? r1n(cy.pInt) : null,
            chiller_int_sat_c: cy ? round2(cy.tInt) : null,
            chiller_flash_fraction: cy ? r3n(cy.xf) : null,
            chiller_discharge_c: cy ? round2(cy.points[3].t) : null,
            chiller_unit_ref_flow_evap_kg_s: cy && ud !== null ? round2(cy.mEvapPerKw * ud) : null,
            chiller_unit_ref_flow_cond_kg_s: cy && ud !== null ? round2(cy.mCondPerKw * ud) : null,
            chiller_unit_shaft_kw: cy && ud !== null ? r1n(cy.shaftPerKw * ud) : null,
            chiller_cycle_condenser_kw_th: cy && ud !== null ? r1n(cy.condPerKw * ud) : null,
            chiller_speed_pct: spd === null ? null : r1n(spd * 100),
            chiller_igv_pct: igv === null ? null : r1n(igv * 100),
            chiller_cycle_points: cy ? cy.points.map(function (q) {
                return { pt: q.pt, where: q.where, phase: q.phase, t_c: q.t === null ? null : round2(q.t), p_kpa_abs: round1(q.p),
                    h_kj_kg: round2(q.h), s_kj_kg_k: q.s === null ? null : Math.round(q.s * 10000) / 10000, x: q.x === null ? null : r3n(q.x) };
            }) : null
        };
        for (key in cycleKeys) { if (Object.prototype.hasOwnProperty.call(cycleKeys, key)) derived[key] = cycleKeys[key]; }
        /* ADDITIVE (2.5.0) — inside the pumps and the CRAH (PRD-CONV-EQUIPMENT-INSIDE P3): hydraulic power rho g Q H,
         * shaft power = hydraulic / pump efficiency, differential pressure rho g H; CRAH airflow = duty / (rho cp dT_air) */
        var hyd = function (q, h) { return q === null || h === null ? null : pumpHydraulicKw(cc, q, h); };
        var dpk = function (h) { return cc.water_density_kg_m3 * cc.gravity_m_s2 * h / 1000; };
        var pumpKeys = {
            air_density_kg_m3: cc.air_density_kg_m3, air_cp_kj_kg_k: cc.air_cp_kj_kg_k,
            chw_primary_pump_hydraulic_kw: r2n(hyd(p.unitChwFlowP, p.priHeadOp)),
            chw_primary_pump_shaft_kw: r2n(hyd(p.unitChwFlowP, p.priHeadOp) === null ? null : hyd(p.unitChwFlowP, p.priHeadOp) / cc.pump_efficiency),
            chw_primary_pump_head_op_m: r2n(p.priHeadOp),
            chw_primary_pump_dp_kpa: round1(dpk(cc.chw_primary_head_m)),
            chw_secondary_pump_hydraulic_kw: r2n(hyd(p.secFlowP, p.secHeadOp)),
            chw_secondary_pump_shaft_kw: r2n(hyd(p.secFlowP, p.secHeadOp) === null ? null : hyd(p.secFlowP, p.secHeadOp) / cc.pump_efficiency),
            chw_secondary_pump_head_op_m: r2n(p.secHeadOp),
            chw_secondary_pump_dp_kpa: round1(dpk(cc.chw_secondary_head_m)),
            cdw_pump_hydraulic_kw: r2n(hyd(p.unitCdwFlowP, p.cdwHeadOp)),
            cdw_pump_shaft_kw: r2n(hyd(p.unitCdwFlowP, p.cdwHeadOp) === null ? null : hyd(p.unitCdwFlowP, p.cdwHeadOp) / cc.pump_efficiency),
            cdw_pump_head_op_m: r2n(p.cdwHeadOp),
            cdw_pump_dp_kpa: round1(dpk(cc.cdw_head_m)),
            crah_unit_airflow_m3_s: p.crahDuty === null ? null : r2n(p.crahDuty / (cc.air_density_kg_m3 * cc.air_cp_kj_kg_k * cc.airside_delta_t_k))
        };
        for (key in pumpKeys) { if (Object.prototype.hasOwnProperty.call(pumpKeys, key)) derived[key] = pumpKeys[key]; }
        /* ADDITIVE (2.7.0) — operating speed and drive frequency (PRD-CONV-OPS-DEPTH 01 P1): Hz = f_base x n */
        var fb = cc.motor_base_frequency_hz;
        var pct = function (n) { return n === null ? null : round1(n * 100); };
        var hz = function (n) { return n === null ? null : round2(fb * n); };
        var speedKeys = {
            chw_primary_pump_speed_pct: pct(p.priSpeed), chw_primary_pump_hz: hz(p.priSpeed),
            chw_secondary_pump_speed_pct: pct(p.secSpeed), chw_secondary_pump_hz: hz(p.secSpeed),
            cdw_pump_speed_pct: pct(p.cdwSpeed), cdw_pump_hz: hz(p.cdwSpeed),
            tower_fan_hz: p.cellLoad === null ? null : round2(fb * p.cellLoad / 100),
            crah_fan_hz: p.crahLoad === null ? null : round2(fb * p.crahLoad / 100)
        };
        for (key in speedKeys) { if (Object.prototype.hasOwnProperty.call(speedKeys, key)) derived[key] = speedKeys[key]; }
        /* ADDITIVE (2.8.0) — the plant's valves (PRD-CONV-OPS-DEPTH 01 P3, §6.2-6.3)
         * PICV on a CRAH coil: pressure-independent, flow proportional to opening, so opening = coil flow / design coil flow.
         * DP bypass MV-01: opens only when the load flow falls below the running chillers' minimum evaporator flow;
         *   Q_bp = max(0, Q_min - Q_load); the valve is sized to pass the whole minimum flow at zero load, so opening = Q_bp / Q_min.
         * Decoupler: sum primary - sum secondary (0 when both carry the duty flow).
         * TV-01 tower bypass and its balancing valve: Kv = Q [m3/h] x sqrt(1 / dP [bar]) (IEC 60534-2-1, rho_rel = 1),
         *   sized for the full condenser flow at the static lift it replaces. */
        var crahDesignFlow = cc.crah_unit_sensible_kw / (cc.water_cp_kj_per_kg_k * chwDeltaT(m));
        var qMin = p.running * cc.chiller_min_evap_flow_pct / 100 * p.priDesignFlow;
        var qBp = Math.max(0, qMin - p.dutyFlow), qBpCap = qMin;
        var tb = towerBypass(cc, cc.tower_design_wet_bulb_c);
        var qCdwDesign = p.running * p.cdwDesignFlow, dpLegBar = cc.water_density_kg_m3 * cc.gravity_m_s2 * cc.cdw_static_head_m / 1e5;
        var valveKeys = {
            crah_valve_open_pct: p.crahChw === null ? null : round1(p.crahChw / crahDesignFlow * 100),
            crah_design_coil_flow_lps: round2(crahDesignFlow),
            chw_min_plant_flow_lps: round1(qMin),
            chw_bypass_flow_lps: round1(qBp),
            chw_bypass_open_pct: round1(Math.min(100, qBp / qBpCap * 100)),
            chw_decoupler_flow_lps: p.unitChwFlow === null || p.secFlow === null ? null : round1(p.running * p.unitChwFlow - p.secDuty * p.secFlow),
            cdw_bypass_x_pct: round1(tb.x * 100),
            cdw_entering_c: round2(tb.tEcw),
            cdw_bypass_design_flow_lps: round1(qCdwDesign),
            cdw_balance_kv_set: dpLegBar > 0 ? round1(qCdwDesign * 3.6 * Math.sqrt(1 / dpLegBar)) : null
        };
        for (key in valveKeys) { if (Object.prototype.hasOwnProperty.call(valveKeys, key)) derived[key] = valveKeys[key]; }
        for (key in derived) { if (Object.prototype.hasOwnProperty.call(derived, key)) out[key] = derived[key]; }
        return out;
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    /* Fleet unit table — PURE over a model (default: the frozen model). Units 1...running
     * run, the rest stand by (deterministic lead order: lowest number leads). Unknown kind,
     * or a hall-scoped kind without a known hall, returns null. Values per unit are the
     * UNROUNDED internals rounded to 0.01, so Sigma running units = the plant value within
     * rounding. */
    var FLEET_KINDS = ['chiller', 'chw_primary_pump', 'chw_secondary_pump', 'cdw_pump', 'tower_cell', 'crah', 'genset'];
    function fleet(m, kind, hallCode) {
        var p = plantInternals(m), c = m.cooling, out = [], i, run;
        var r2 = round2;
        var hall = null;
        if (kind === 'crah' || kind === 'genset') {
            if (typeof hallCode !== 'string') return null;
            for (i = 0; i < m.campus.halls.length; i++) {
                if (String(m.campus.halls[i].code).toUpperCase() === hallCode.toUpperCase()) hall = m.campus.halls[i];
            }
            if (!hall) return null;
        }
        /* op = operating values (0 when standby); fixed = ratings that hold either way */
        var unit = function (n, tag, isRun, loadPct, op, fixed) {
            var u = { n: n, tag: tag, state: isRun ? 'running' : 'standby', loadPct: isRun ? loadPct : 0 }, k;
            for (k in op) { if (Object.prototype.hasOwnProperty.call(op, k)) u[k] = isRun ? op[k] : 0; }
            for (k in fixed) { if (Object.prototype.hasOwnProperty.call(fixed, k)) u[k] = fixed[k]; }
            return u;
        };
        var chLoad = p.unitDuty === null ? null : r2(p.unitDuty / c.chiller_unit_kw_th * 100);
        if (kind === 'chiller') {
            run = chillersRunning(m);
            for (i = 1; i <= chillersTotal(m); i++) {
                out.push(unit(i, 'CH-' + pad2(i), i <= run, chLoad, {
                    dutyKwTh: r2(p.unitDuty), inputKwE: r2(p.unitInput), condenserDutyKwTh: r2(p.unitCond),
                    chwFlowLps: r2(p.unitChwFlow), cdwFlowLps: r2(p.unitCdwFlow)
                }, { ratedKwTh: c.chiller_unit_kw_th }));
            }
        } else if (kind === 'chw_primary_pump') {
            /* two pumps per train, A = duty, B = standby; A of trains 1...running run */
            var perTrain = c.chw_primary_pumps_per_train, n = 0, t, j;
            run = chillersRunning(m);
            for (t = 1; t <= chillersTotal(m); t++) {
                for (j = 0; j < perTrain; j++) {
                    n += 1;
                    out.push(unit(n, 'CHWP-' + pad2(t) + String.fromCharCode(65 + j), j === 0 && t <= run, 100, {
                        flowLps: r2(p.unitChwFlow), kwE: r2(p.priKw), headOpM: r2(p.priHeadOp), speedPct: round1(p.priSpeed * 100), hz: round2(c.motor_base_frequency_hz * p.priSpeed)
                    }, { headM: c.chw_primary_head_m }));
                }
            }
        } else if (kind === 'chw_secondary_pump') {
            for (i = 1; i <= p.secCount; i++) {
                out.push(unit(i, 'CHWP-S' + i, i <= p.secDuty, r2(p.secFlow / c.chw_secondary_unit_flow_lps * 100), {
                    flowLps: r2(p.secFlow), kwE: r2(p.secKw), headOpM: r2(p.secHeadOp), speedPct: round1(p.secSpeed * 100), hz: round2(c.motor_base_frequency_hz * p.secSpeed)
                }, { headM: c.chw_secondary_head_m, ratedFlowLps: c.chw_secondary_unit_flow_lps }));
            }
        } else if (kind === 'cdw_pump') {
            run = chillersRunning(m);
            for (i = 1; i <= p.cdwCount; i++) {
                out.push(unit(i, 'CDWP-' + pad2(i), i <= run, 100, {
                    flowLps: r2(p.unitCdwFlow), kwE: r2(p.cdwKw), headOpM: r2(p.cdwHeadOp), speedPct: round1(p.cdwSpeed * 100), hz: round2(c.motor_base_frequency_hz * p.cdwSpeed)
                }, { headM: c.cdw_head_m }));
            }
        } else if (kind === 'tower_cell') {
            for (i = 1; i <= p.cellCount; i++) {
                out.push(unit(i, 'CT-' + pad2(i), i <= p.cellRunning, r2(p.cellLoad), {
                    rejectionKwTh: r2(p.unitCond), cdwFlowLps: r2(p.unitCdwFlow),
                    fanSpeedPct: r2(p.cellLoad), fanKw: r2(p.fanKw), hz: round2(c.motor_base_frequency_hz * p.cellLoad / 100)
                }, { ratedKwTh: round1(p.cellRated), fanMotorKw: c.tower_fan_motor_kw }));
            }
        } else if (kind === 'crah') {
            run = crahRequired(m);
            for (i = 1; i <= run + 1; i++) {
                out.push(unit(i, 'CRAH-' + hall.code + pad2(i), i <= run, r2(p.crahLoad), {
                    dutyKw: r2(p.crahDuty), chwFlowLps: r2(p.crahChw), fanSpeedPct: r2(p.crahLoad), hz: round2(c.motor_base_frequency_hz * p.crahLoad / 100)
                }, { sensibleKw: c.crah_unit_sensible_kw }));
            }
        } else if (kind === 'genset') {
            var gens = electricalHvMv(m).genset_per_hall;
            for (i = 1; i <= gens; i++) {
                out.push({ n: i, tag: 'GEN-' + hall.code + i, state: 'standby', loadPct: 0,
                    ratingKw: m.electrical.genset_unit_kw, outputKw: 0 });
            }
        } else {
            return null;
        }
        return out;
    }

    function computeHalls(m) {
        var out = [];
        var halls = m.campus.halls;
        for (var i = 0; i < halls.length; i++) {
            var h = halls[i];
            var hallFacility = h.it_load_kw * m.site.pue;
            out.push({
                id: h.id,
                code: h.code,
                it_design_kw: h.it_design_kw,
                it_load_kw: h.it_load_kw,
                utilisation_pct: round1((h.it_load_kw / h.it_design_kw) * 100),
                facility_load_kw: round1(hallFacility),
                racks: h.racks,
                rack_design_avg_kw: h.rack_design_avg_kw,
                rack_selected_peak_kw: h.rack_selected_peak_kw,
                rack_actual_avg_kw: round2(h.it_load_kw / h.racks),
                /* UNAVAILABLE — a central N+1 chiller plant is not divisible into
                 * hall shares without a hydronic-distribution design that does not
                 * exist. A fabricated fraction would be an invented fact. */
                chillers_allocated: null,
                chillers_allocated_reason: 'UNAVAILABLE — central N+1 plant; per-hall allocation requires a hydronic distribution design that has not been produced.'
            });
        }
        return out;
    }

    /* v1.134.1 — the campus roll-up used to be computed ONCE at module scope and stored on
     * the model as `site.it_design_kw` / `site.it_load_kw` / `campus.racks_total`. The
     * parameter registry measured the consequence: perturbing a hall's load did not move
     * the site totals, because the totals were authored inputs that merely LOOKED derived.
     * Deriving them here, at the top of every compute(), closes the loop — every downstream
     * function reads the derived values, so a change to any hall propagates through the
     * whole snapshot. The model is deep-frozen, so this returns a copy and mutates nothing.
     */
    function withDerivedRollup(m) {
        var halls = m.campus.halls;
        var itDesign = 0, itLoad = 0, racks = 0;
        for (var i = 0; i < halls.length; i++) {
            itDesign += halls[i].it_design_kw;
            itLoad += halls[i].it_load_kw;
            racks += halls[i].racks;
        }
        var site = {}, campus = {}, key;
        for (key in m.site) { if (Object.prototype.hasOwnProperty.call(m.site, key)) site[key] = m.site[key]; }
        for (key in m.campus) { if (Object.prototype.hasOwnProperty.call(m.campus, key)) campus[key] = m.campus[key]; }
        site.it_design_kw = itDesign;
        site.it_load_kw = itLoad;
        campus.racks_total = racks;
        campus.hall_count = halls.length;
        var out = {};
        for (key in m) { if (Object.prototype.hasOwnProperty.call(m, key)) out[key] = m[key]; }
        out.site = site;
        out.campus = campus;
        return out;
    }

    function compute(model) {
        var m = withDerivedRollup(model);
        var facility = facilityLoadKw(m);
        var nonIt = nonItLoadKw(m);
        var upsLoss = upsLossKw(m);
        var dT = chwDeltaT(m);
        var heatRej = heatRejectionKw(m);
        var flowLps = chwFlowLps(m);
        var fuelUsable = fuelUsableL(m);
        var autonomy = fuelAutonomyHr(m);
        var waterLpm = waterFlowLpmForWue(m);
        var scen = null;
        for (var i = 0; i < m.campus.scenarios.length; i++) {
            if (m.campus.scenarios[i].id === m.campus.active_scenario_id) scen = m.campus.scenarios[i];
        }

        return {
            /* CAMPUS ROLL-UP — key names and meaning unchanged from v1 so every
             * existing consumer keeps working without edits. */
            site: {
                it_design_kw: m.site.it_design_kw,
                it_load_kw: m.site.it_load_kw,
                pue: m.site.pue,
                facility_load_kw: round1(facility),
                facility_load_kw_exact: facility,
                non_it_load_kw: round1(nonIt),
                non_it_load_kw_exact: nonIt
            },
            /* ADDITIVE — campus / per-hall detail. */
            campus: {
                hall_count: m.campus.hall_count,
                it_design_kw: m.site.it_design_kw,
                it_load_kw: m.site.it_load_kw,
                utilisation_pct: round1((m.site.it_load_kw / m.site.it_design_kw) * 100),
                racks_total: m.campus.racks_total,
                rack_design_avg_kw: m.campus.rack_design_avg_kw,
                rack_selected_peak_kw: m.campus.rack_selected_peak_kw,
                scenario_id: m.campus.active_scenario_id,
                scenario_label: scen ? scen.label : null,
                scenario_evidence_class: scen ? scen.evidence_class : null,
                study_id: m.campus.study_id,
                halls: computeHalls(m)
            },
            electrical: withHvMv(m, {
                /* v1.134.10 — the UPS efficiency was an authored model input that the snapshot
                   never published, so ups_loss_kw could not be checked against its own formula.
                   Publishing it makes that arithmetic verifiable. */
                ups_efficiency: m.electrical.ups_efficiency,
                ups_loss_kw: round1(upsLoss),
                epms_total_kw: round1(epmsTotalKw(m)),
                epms_ups_output_kw: round1(epmsUpsOutputKw(m)),
                ups_module_kw: round1(upsModuleKw(m)),
                ups_module_count: upsModuleCount(m),
                ups_module_kw_rated: m.electrical.ups_module_kw_rated,
                ups_modules_per_system: upsModulesPerSystem(m),
                ups_system_count: m.electrical.ups_system_count,
                ups_system_kw: round1(upsSystemKw(m)),
                /* 2.6.0 (P4a): one system's input and loss by the same rule as upsLossKw() (output / eta), so the
                   UPS inside can close its balance P_in - P_out = loss; systems x loss = ups_loss_kw. */
                ups_system_in_kw: round1(upsSystemKw(m) / m.electrical.ups_efficiency),
                ups_system_loss_kw: round1(upsSystemKw(m) * (1 / m.electrical.ups_efficiency - 1)),
                ups_system_rated_kw: upsSystemRatedKw(m),
                /* v1.134.23 — the two UPS LOADING figures the cockpit stats panel shows.
                   They were computed on dc-conventional.html from published terms; an earlier form
                   there divided the CAMPUS load by a HALL-scale rating and rendered "750% nrm /
                   1500% fail" as though it were telemetry, which is the scope defect this
                   programme exists to remove. Published once, with the failover case stated: on a
                   2N transfer the surviving system carries the whole IT load. */
                ups_load_pct_normal: m.electrical.ups_system_count
                    ? round1((m.site.it_load_kw / m.electrical.ups_system_count)
                        / upsSystemRatedKw(m) * 100)
                    : null,
                ups_load_pct_on_failover: round1(m.site.it_load_kw / upsSystemRatedKw(m) * 100),
                ups_redundancy: m.electrical.ups_redundancy,
                nameplate_evidence_class: m.meta.nameplate_evidence_class,
                metering_tolerance_pct: m.electrical.metering_tolerance_pct
            }),
            cooling: withPlantInternals(m, {
                /* The whole air-to-water chain is published, not just the water
                   end, so a page can render any plane without re-deriving one
                   from another with a private constant (that is how the 15.2 C
                   supply air became an orphan). */
                /* v1.134.1 — the four AUTHORED inputs of the chain, then every dependent
                   plane DERIVED here at compute time. They used to be pre-computed into
                   module constants and stored on the model, which closed the chain once at
                   load and then reopened it: editing `chws_c` on the model would have
                   silently broken the derivation, and recompute() could not restore it.
                   The parameter registry measured exactly that — it reported chws_c and
                   crah_supply_air_c as authored inputs, not as derived values. */
                rack_inlet_target_c: m.cooling.rack_inlet_target_c,
                supply_path_mixing_k: m.cooling.supply_path_mixing_k,
                /* The two air planes DOWNSTREAM of the rack inlet, completing the chain
                   the thermal re-derivation started at the top: rack inlet -> hot aisle
                   -> CRAH return. Both were drawn on the data-hall cockpit from constants
                   it kept privately. */
                airside_delta_t_k: m.cooling.airside_delta_t_k,
                /* CRAH fleet, per hall. Sensible hall heat is the hall IT load; the +1 is a
                   standby that auto-starts on a trip, so the surviving capacity after the
                   worst single outage is (installed - 1) units, not (running - 1). */
                crah_unit_sensible_kw: m.cooling.crah_unit_sensible_kw,
                water_cp_kj_per_kg_k: m.cooling.water_cp_kj_per_kg_k,
                crah_required: crahRequired(m),
                crah_installed: crahRequired(m) + 1,
                crah_running: crahRequired(m),
                crah_available_kw: round1(crahRequired(m) * m.cooling.crah_unit_sensible_kw),
                crah_n1_available_kw: round1(crahRequired(m) * m.cooling.crah_unit_sensible_kw),
                return_path_mixing_k: m.cooling.return_path_mixing_k,
                hot_aisle_c: round2(m.cooling.rack_inlet_target_c + m.cooling.airside_delta_t_k),
                crah_return_air_c: round2(m.cooling.rack_inlet_target_c
                    + m.cooling.airside_delta_t_k + m.cooling.return_path_mixing_k),
                chw_coil_approach_k: m.cooling.chw_coil_approach_k,
                crah_supply_air_c: round2(crahSupplyAirC(m)),
                chws_c: round2(chwsC(m)),
                chwr_c: round2(chwrC(m)),
                chw_delta_t: round2(dT),
                heat_rejection_kw: round1(heatRej),
                flow_lps: round1(flowLps),
                chillers_running: chillersRunning(m),
                chillers_total: chillersTotal(m),
                chiller_unit_kw_th: m.cooling.chiller_unit_kw_th,
                chiller_design_duty_kw_th: round1(chillerDesignDutyKwTh(m)),
                chiller_redundancy: m.cooling.chiller_redundancy,
                /* v1.134.7 — plant capacity, its N+1 figure and the duty in refrigeration tons
                   were computed on the chiller page from engine terms but published nowhere, so
                   three of the most prominent numbers on that screen had no registry parameter
                   to trace to. They are arithmetic over values already here; publishing them
                   removes the page's private copy of the arithmetic. */
                chiller_type: m.cooling.chiller_type,
                chiller_specific_power_kw_e_per_kw_th: Math.round(chillerSpecificPower(m) * 100000) / 100000,
                chiller_rated_specific_power_kw_e_per_kw_th: m.cooling.chiller_rated_specific_power_kw_e_per_kw_th,
                /* Plant electrical input, and the two efficiency figures every chiller-plant
                   operator reads. Derived from the adopted machine type — never authored on a
                   page, which is where the impossible 0.11 kW/RT came from. */
                chiller_input_kw_e: round1(heatRej * chillerSpecificPower(m)),
                /* v1.134.23 — the P&ID prints the electrical input of ONE machine on every
                   chiller it draws, and that per-machine share was being computed on the page
                   from the plant total. It is the same private-arithmetic pattern the plant
                   capacity figures had in v1.134.7: the number an operator reads had no
                   registry parameter to trace to, so it counted as untraced. Published here,
                   the page reads it instead of dividing. */
                chiller_input_per_machine_kw_e: chillersRunning(m)
                    ? round1(heatRej * chillerSpecificPower(m) / chillersRunning(m))
                    : null,
                cdw_supply_c: m.cooling.cdw_supply_c,
                cdw_range_k: m.cooling.cdw_range_k,
                cdw_return_c: round2(m.cooling.cdw_supply_c + m.cooling.cdw_range_k),
                /* Tower heat rejection = chiller duty + the work the compressors put in. */
                tower_rejection_kw_th: round1(heatRej * (1 + chillerSpecificPower(m))),
                plant_cop: round2(1 / chillerSpecificPower(m)),
                plant_kw_per_rt: round2(chillerSpecificPower(m) * 3.517),
                /* Plant-average part load. Per-UNIT loading is not published — the mimic
                   simulates individual machines — so this is stated as an average and labelled
                   as one. It was derived on dc-conventional.html from these same terms. */
                chiller_part_load_pct: (chillersRunning(m) && m.cooling.chiller_unit_kw_th)
                    ? round1(heatRej / (chillersRunning(m) * m.cooling.chiller_unit_kw_th) * 100)
                    : null,
                chiller_capacity_kw_th: round1(chillersRunning(m) * m.cooling.chiller_unit_kw_th),
                chiller_n1_capacity_kw_th: round1((chillersTotal(m) - 1) * m.cooling.chiller_unit_kw_th),
                /* v1.134.23 — the N+1 MARGIN is the number the chiller cockpit colours red or
                   green, and it was being subtracted on the page. Same class of private
                   arithmetic as the per-machine input: an operator reads it, the registry could
                   not explain it. Published so the page reads instead of computing. */
                chiller_n1_margin_kw_th: round1((chillersTotal(m) - 1) * m.cooling.chiller_unit_kw_th - heatRej),
                /* The per-loop flow SETPOINT the plant runs each machine at. The mimic and the
                   setpoint card both showed it; both divided the header flow themselves. */
                flow_per_machine_lps: chillersRunning(m)
                    ? round1(chwFlowLps(m) / chillersRunning(m))
                    : null,
                /* v1.134.23 — the chiller cockpit's flow-reconciliation card compares the
                   IT-only reference flow against the flow the EVAPORATOR duty actually needs
                   (IT plus UPS loss), and states the uplift between them. Both were computed
                   on the page from engine terms, so the two figures an operator uses to judge
                   whether the header is sized for the real duty had nothing to trace to. */
                plant_duty_flow_lps: round1(heatRej / (m.cooling.water_cp_kj_per_kg_k * chwDeltaT(m))),
                plant_duty_flow_uplift_pct: chwFlowLps(m)
                    ? round1(((heatRej / (m.cooling.water_cp_kj_per_kg_k * chwDeltaT(m))) / chwFlowLps(m) - 1) * 100)
                    : null,
                duty_rt: round1(heatRej / 3.517),
                nameplate_evidence_class: m.meta.nameplate_evidence_class
            }),
            environment: {
                avg_temp_c: m.environment.avg_temp_c,
                avg_rh_pct: m.environment.avg_rh_pct,
                wue_l_per_kwh: m.environment.wue_l_per_kwh,
                carbon_kg_per_facility_kwh: m.environment.carbon_kg_per_facility_kwh,
                carbon_kg_per_hr: round1(carbonKgPerHr(m))
            },
            fuel: {
                level_pct: m.fuel.level_pct,
                tank_capacity_l: m.fuel.tank_capacity_l,
                usable_l: Math.round(fuelUsable),
                specific_consumption_l_per_kwh: m.fuel.specific_consumption_l_per_kwh,
                /* v1.134.9 — the usable fraction and the tank level thresholds were page
                   constants restated in three places on the fuel cockpit. */
                usable_fraction: m.fuel.usable_fraction,
                level_overfill_pct: m.fuel.level_overfill_pct,
                level_low_pct: m.fuel.level_low_pct,
                level_low_low_pct: m.fuel.level_low_low_pct,
                /* v1.134.1 — this republished an authored 15,503 L/hr while
                   generatorConsumptionLph() sat unused two hundred lines above. Fuel burn
                   therefore did NOT follow facility load: change the scenario and autonomy
                   stayed put. The registry caught it (the path depended only on itself). */
                generator_consumption_lph: Math.round(generatorConsumptionLph(m)),
                autonomy_hr: round1(autonomy),
                nameplate_evidence_class: m.meta.nameplate_evidence_class
            },
            fire: (function () {
                var storedL = m.fire.reserve_capacity_m3 * 1000;
                var usableL = storedL * (m.fire.level_pct / 100);
                var requiredL = m.fire.required_duration_min * m.fire.pump_demand_lpm;
                return {
                    reserve_capacity_m3: m.fire.reserve_capacity_m3,
                    level_pct: m.fire.level_pct,
                    stored_m3: round1(usableL / 1000),
                    pump_demand_lpm: m.fire.pump_demand_lpm,
                    required_duration_min: m.fire.required_duration_min,
                    duration_min: round1(usableL / m.fire.pump_demand_lpm),
                    duration_at_full_min: round1(storedL / m.fire.pump_demand_lpm),
                    required_capacity_m3: round1(requiredL / 1000),
                    capacity_shortfall_m3: round1((requiredL - storedL) / 1000),
                    zone_count: m.fire.zone_count,
                    static_pressure_bar: m.fire.static_pressure_bar
                };
            }()),
        water: {
                wue_l_per_kwh: m.environment.wue_l_per_kwh,
                flow_lpm_for_wue: round1(waterLpm),
                /* v1.134.8 — domestic/process draw was a page constant (DOMESTIC_LPM = 8.0) and
                   the treated total was computed on the page from it. Both belong here: the
                   treated total is what the treatment train is sized for. */
                domestic_lpm: m.water.domestic_lpm,
                total_treated_lpm: round1(waterLpm + m.water.domestic_lpm),
                /* v1.134.24 — the open-tower balance. Makeup replaces what leaves as drift,
                   evaporation and blowdown; at C cycles of concentration the blowdown is
                   (makeup - drift) / C and the evaporation is the rest. Both were split on
                   water-system.html from constants it kept privately. */
                tower_cycles_of_concentration: m.water.tower_cycles_of_concentration,
                tower_drift_fraction: m.water.tower_drift_fraction,
                drift_lpm: round2(waterLpm * m.water.tower_drift_fraction),
                blowdown_lpm: round1((waterLpm - waterLpm * m.water.tower_drift_fraction)
                    / m.water.tower_cycles_of_concentration),
                evaporation_lpm: round1((waterLpm - waterLpm * m.water.tower_drift_fraction)
                    * (m.water.tower_cycles_of_concentration - 1) / m.water.tower_cycles_of_concentration),
                /* The design TARGET, published as a target. It was a literal 1.30 typed three
                   times on the water cockpit and compared against a computed WUE — the exact
                   marketing-target-versus-derived-value confusion Rule 4 forbids. */
                wue_target_l_per_kwh: m.water.wue_target_l_per_kwh,
                /* WUE evaluated on the WHOLE treated flow rather than cooling makeup alone. The
                   cockpit shows it beside the reported WUE to make the exclusion visible. */
                wue_all_treated_l_per_kwh: m.site.it_load_kw
                    ? round2((waterLpm + m.water.domestic_lpm) * 60 / m.site.it_load_kw)
                    : null
            },
            racks: {
                at_6kw: Math.round(activeRacks(m, 6)),
                at_8kw: Math.round(activeRacks(m, 8)),
                at_10kw: Math.round(activeRacks(m, 10))
            },
            meta: {
                scenario: m.meta.scenario,
                data_quality: m.meta.data_quality,
                evidence_class: m.meta.evidence_class,
                nameplate_evidence_class: m.meta.nameplate_evidence_class,
                basis: m.meta.basis,
                basis_doc: m.meta.basis_doc,
                study_doc: m.meta.study_doc,
                version: m.meta.version
            }
        };
    }

    /* --- Deep freeze (immutable single basis) ------------------------------- */

    function deepFreeze(o) {
        if (o && typeof o === 'object' && !Object.isFrozen(o)) {
            Object.freeze(o);
            for (var k in o) {
                if (Object.prototype.hasOwnProperty.call(o, k)) {
                    deepFreeze(o[k]);
                }
            }
        }
        return o;
    }

    var CONV_MODEL = deepFreeze(MODEL);
    var SNAPSHOT = deepFreeze(compute(CONV_MODEL));

    /* Eager, cached hall index — selectors never rebuild or mutate. */
    var HALL_INDEX = {};
    (function buildIndex() {
        var list = SNAPSHOT.campus.halls;
        for (var i = 0; i < list.length; i++) {
            HALL_INDEX[list[i].id] = list[i];
            HALL_INDEX[String(list[i].code).toUpperCase()] = list[i];
        }
    }());

    var CONV_CALC = {
        // raw scenario (frozen)
        model: CONV_MODEL,
        // pure functions (m defaults to CONV_MODEL)
        facilityLoadKw: function (m) { return facilityLoadKw(m || CONV_MODEL); },
        nonItLoadKw: function (m) { return nonItLoadKw(m || CONV_MODEL); },
        upsLossKw: function (m) { return upsLossKw(m || CONV_MODEL); },
        chwDeltaT: function (m) { return chwDeltaT(m || CONV_MODEL); },
        heatRejectionKw: function (m) { return heatRejectionKw(m || CONV_MODEL); },
        chwFlowLps: function (m) { return chwFlowLps(m || CONV_MODEL); },
        epmsTotalKw: function (m) { return epmsTotalKw(m || CONV_MODEL); },
        epmsUpsOutputKw: function (m) { return epmsUpsOutputKw(m || CONV_MODEL); },
        upsModuleKw: function (m) { return upsModuleKw(m || CONV_MODEL); },
        upsModuleCount: function (m) { return upsModuleCount(m || CONV_MODEL); },
        upsSystemKw: function (m) { return upsSystemKw(m || CONV_MODEL); },
        upsSystemRatedKw: function (m) { return upsSystemRatedKw(m || CONV_MODEL); },
        chillersTotal: function (m) { return chillersTotal(m || CONV_MODEL); },
        chillersRunning: function (m) { return chillersRunning(m || CONV_MODEL); },
        chillerDesignDutyKwTh: function (m) { return chillerDesignDutyKwTh(m || CONV_MODEL); },
        generatorConsumptionLph: function (m) { return generatorConsumptionLph(m || CONV_MODEL); },
        fuelUsableL: function (m) { return fuelUsableL(m || CONV_MODEL); },
        fuelAutonomyHr: function (m) { return fuelAutonomyHr(m || CONV_MODEL); },
        waterFlowLpmForWue: function (m) { return waterFlowLpmForWue(m || CONV_MODEL); },
        wueFromFlowLpm: function (m, lpm) {
            if (typeof m === 'number' && typeof lpm === 'undefined') { lpm = m; m = null; }
            return wueFromFlowLpm(m || CONV_MODEL, lpm);
        },
        carbonKgPerHr: function (m) { return carbonKgPerHr(m || CONV_MODEL); },
        activeRacks: function (m, kw) {
            if (typeof m === 'number' && typeof kw === 'undefined') { kw = m; m = null; }
            return activeRacks(m || CONV_MODEL, kw);
        },
        round1: round1,
        round2: round2,
        /* Selectors over the frozen snapshot. An unknown id returns null — these
         * never throw, so a mistyped hall id surfaces as a visible '—' rather
         * than a blank page. */
        listHalls: function () { return SNAPSHOT.campus.halls; },
        listScenarios: function () { return CONV_MODEL.campus.scenarios; },
        getCampusSnapshot: function () { return SNAPSHOT.campus; },
        getHallSnapshot: function (idOrCode) {
            if (typeof idOrCode !== 'string' || !idOrCode) return null;
            var hit = HALL_INDEX[idOrCode] || HALL_INDEX[idOrCode.toUpperCase()];
            return hit || null;
        },
        // frozen computed snapshot
        snapshot: SNAPSHOT,
        recompute: function (m) { return compute(m || CONV_MODEL); },
        /* engine 2.4.0 — plant internals. getFleet(kind, hallCode?) returns a fresh unit
         * table (kinds in fleetKinds); 'crah' and 'genset' need a hall code. */
        fleetKinds: FLEET_KINDS,
        getFleet: function (kind, hallCode, m) { return fleet(m || CONV_MODEL, kind, hallCode); },
        refrigerantSatKpa: refrigerantSatKpa,
        /* engine 2.7.0 — the secondary pumps' operating speed at a remote DP setpoint (kPa), same duty flow and pump
         * count as the solve: the page's setpoint slider reads speed and Hz through this, never its own formula.
         * 2.10.0 adds the operating head and the pump / fleet kWe at that setpoint (Amendment E1). */
        secondaryPumpSpeedAt: function (dpKpa, m) {
            var mm = m || CONV_MODEL, c = mm.cooling, p = plantInternals(mm);
            if (!(dpKpa >= 0)) return null;
            var hsp = kpaToHeadM(c, dpKpa), n = pumpSpeedFraction(c, p.secXp, p.secXs, c.chw_secondary_head_m, hsp);
            if (n === null) return null;
            /* 2.10.0 (Amendment E1): the power at that setpoint, on the same system curve as the solve */
            var hOp = pumpOperatingHeadM(c.chw_secondary_head_m, hsp, p.secXs), kw = pumpElectricalKw(c, p.secFlow, hOp);
            return { speedPct: round1(n * 100), hz: round2(c.motor_base_frequency_hz * n), dpKpa: dpKpa,
                headOpM: round2(hOp), kwE: round1(kw), fleetKwE: round1(kw * p.secDuty) };
        },
        /* engine 2.8.0 — the tower bypass at any wet-bulb (the page's cold-weather drill): B-port share and the mixed ECWT */
        towerBypassAt: function (wbC, m) {
            if (typeof wbC !== 'number' || !isFinite(wbC)) return null;
            var t = towerBypass((m || CONV_MODEL).cooling, wbC);
            return { xPct: round1(t.x * 100), aPct: round1(100 - t.x * 100), tColdC: round2(t.tCold), tEcwC: round2(t.tEcw) };
        },
        /* engine 2.8.0 — the DP bypass at a fraction of today's load flow with today's chillers still running (the page's
         * low-load drill: the moment before the sequence stages a chiller off) */
        bypassAtLoad: function (loadFrac, m) {
            var mm = m || CONV_MODEL, c = mm.cooling, p = plantInternals(mm);
            if (!(loadFrac >= 0)) return null;
            var qMin = p.running * c.chiller_min_evap_flow_pct / 100 * p.priDesignFlow, qLoad = p.dutyFlow * loadFrac;
            var qBp = Math.max(0, qMin - qLoad);
            return { flowLps: round1(qBp), openPct: qMin > 0 ? round1(Math.min(100, qBp / qMin * 100)) : 0, qMinLps: round1(qMin), qLoadLps: round1(qLoad) };
        },
        /* engine 2.10.0 — the system curve: head at a flow fraction x_s of design for a loop with setpoint head H_sp */
        pumpOperatingHeadM: pumpOperatingHeadM,
        r134aSatTable: R134A_SAT_TABLE,
        /* engine 2.5.0 — R-134a properties (NIST rows) and the cycle at any saturation pair */
        r134a: { sat: r134aSat, vap: r134aVap,
            /* saturation dome rows [T C, P kPa abs, hf, hg kJ/kg] for drawing a P-h chart (copies; the table stays private) */
            dome: function () { return R134A_SAT.map(function (r) { return [r[0], r[1], r[2], r[3]]; }); },
            /* pressures of the vapour isobars the engine carries (the range a P-h chart can draw isotherms over) */
            isobars: function () { return VAP_P.slice(); } },
        chillerCycle: function (m) { return chillerCycle(m || CONV_MODEL); }
    };

    deepFreeze(CONV_CALC);

    /* --- Expose: browser window + Node-interop shim ------------------------- */
    root.CONV_MODEL = CONV_MODEL;
    root.CONV_CALC = CONV_CALC;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { CONV_MODEL: CONV_MODEL, CONV_CALC: CONV_CALC };
    }

}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
