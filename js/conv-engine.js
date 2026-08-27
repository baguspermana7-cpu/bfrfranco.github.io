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
    function chwDeltaT(m) {
        return m.cooling.chwr_c - m.cooling.chws_c;
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
        return m.site.it_load_kw / (4.186 * chwDeltaT(m));
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
        return fuelUsableL(m) / m.fuel.generator_consumption_lph;
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
            // source: 09-engineering-basis-and-calculations.md line 15
            //         ("CHW supply/return 7.2 / 14.8 C") — see CHW basis decision above
            chws_c: 7.2,
            chwr_c: 14.8,
            /* Chiller unit capacity — ASSUMED (project design decision pending
             * Basis-of-Design confirmation). 5,000 kW_th (~1,422 RT) water-cooled
             * centrifugal. chillers_running / chillers_total are DERIVED from this
             * plus the N+1 rule; see chillersTotal() / chillersRunning() above for
             * the duty, arithmetic and redundancy rule.
             * evidenceClass: 'ASSUMED' — never measured, never vendor-approved. */
            chiller_unit_kw_th: CHILLER_UNIT_KW_TH,
            chiller_redundancy: COOLING_REDUNDANCY
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
            /* Generator burn at the campus facility load — re-derived, ASSUMED:
             *   43,500 kW x 0.356384 L/kWh = 15,502.70 -> 15,503 L/hr
             * evidenceClass: 'ASSUMED' (derived from the sourced rate). */
            generator_consumption_lph: 15503,
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
            tank_capacity_l: 972737
        },
        water: {
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
            version: '2.0.0'
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

    function compute(m) {
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
                ups_redundancy: m.electrical.ups_redundancy,
                nameplate_evidence_class: m.meta.nameplate_evidence_class,
                metering_tolerance_pct: m.electrical.metering_tolerance_pct
            },
            cooling: {
                chws_c: m.cooling.chws_c,
                chwr_c: m.cooling.chwr_c,
                chw_delta_t: round2(dT),
                heat_rejection_kw: round1(heatRej),
                flow_lps: round1(flowLps),
                chillers_running: chillersRunning(m),
                chillers_total: chillersTotal(m),
                chiller_unit_kw_th: m.cooling.chiller_unit_kw_th,
                chiller_design_duty_kw_th: round1(chillerDesignDutyKwTh(m)),
                chiller_redundancy: m.cooling.chiller_redundancy,
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
                generator_consumption_lph: m.fuel.generator_consumption_lph,
                autonomy_hr: round1(autonomy),
                nameplate_evidence_class: m.meta.nameplate_evidence_class
            },
            water: {
                wue_l_per_kwh: m.environment.wue_l_per_kwh,
                flow_lpm_for_wue: round1(waterLpm)
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
