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
            /* Specific power at the design point, kW electrical per kW thermal.
             * 0.58 kW/RT is the middle of the 0.55-0.62 band a water-cooled centrifugal holds
             * at design; 1 RT = 3.517 kW_th, so 0.58 / 3.517 = 0.16491 kW_e/kW_th (COP ~6.06).
             * evidenceClass: 'ASSUMED' — a design-point figure for the adopted machine type,
             * NOT a vendor selection. A submittal replaces exactly this number and everything
             * downstream re-derives.
             */
            chiller_specific_power_kw_e_per_kw_th: 0.16491,
            /* CONDENSER WATER — the loop a water-cooled machine has and an air-cooled one does
             * not. The study's evaporative cooling tower rejects to wet-bulb; no site wet-bulb
             * design figure has been supplied, so the supply temperature and the tower range are
             * ASSUMED at values typical for a tropical design and carry that label. They are
             * authored inputs; the return temperature derives from them.
             * source: js/conv-design-basis.js STUDY_INPUT.water.heatRejectionType
             * evidenceClass: 'ASSUMED' — replace with the site wet-bulb basis when it exists.
             */
            cdw_supply_c: 32.0,
            cdw_range_k: 5.0
            // (no authored chillers_running / chillers_total — both are derived)
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
            metering_tolerance_pct: 2
            // (no authored ups_module_count — it is derived)
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
            version: '2.1.0'
        }
    };

    /* --- Computed convenience snapshot (frozen) ----------------------------- */

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
            electrical: {
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
            },
            cooling: {
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
                chiller_specific_power_kw_e_per_kw_th: m.cooling.chiller_specific_power_kw_e_per_kw_th,
                /* Plant electrical input, and the two efficiency figures every chiller-plant
                   operator reads. Derived from the adopted machine type — never authored on a
                   page, which is where the impossible 0.11 kW/RT came from. */
                chiller_input_kw_e: round1(heatRej * m.cooling.chiller_specific_power_kw_e_per_kw_th),
                /* v1.134.23 — the P&ID prints the electrical input of ONE machine on every
                   chiller it draws, and that per-machine share was being computed on the page
                   from the plant total. It is the same private-arithmetic pattern the plant
                   capacity figures had in v1.134.7: the number an operator reads had no
                   registry parameter to trace to, so it counted as untraced. Published here,
                   the page reads it instead of dividing. */
                chiller_input_per_machine_kw_e: chillersRunning(m)
                    ? round1(heatRej * m.cooling.chiller_specific_power_kw_e_per_kw_th / chillersRunning(m))
                    : null,
                cdw_supply_c: m.cooling.cdw_supply_c,
                cdw_range_k: m.cooling.cdw_range_k,
                cdw_return_c: round2(m.cooling.cdw_supply_c + m.cooling.cdw_range_k),
                /* Tower heat rejection = chiller duty + the work the compressors put in. */
                tower_rejection_kw_th: round1(heatRej * (1 + m.cooling.chiller_specific_power_kw_e_per_kw_th)),
                plant_cop: round2(1 / m.cooling.chiller_specific_power_kw_e_per_kw_th),
                plant_kw_per_rt: round2(m.cooling.chiller_specific_power_kw_e_per_kw_th * 3.517),
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
            },
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
                total_treated_lpm: round1(waterLpm + m.water.domestic_lpm)
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
        recompute: function (m) { return compute(m || CONV_MODEL); }
    };

    deepFreeze(CONV_CALC);

    /* --- Expose: browser window + Node-interop shim ------------------------- */
    root.CONV_MODEL = CONV_MODEL;
    root.CONV_CALC = CONV_CALC;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { CONV_MODEL: CONV_MODEL, CONV_CALC: CONV_CALC };
    }

}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
