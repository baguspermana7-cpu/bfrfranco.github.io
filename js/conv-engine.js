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

    /* --- Scenario basis (single source of truth) ----------------------------
     * These are the only authored inputs. Everything else is DERIVED below.
     */
    var MODEL = {
        site: {
            // source: 09-engineering-basis-and-calculations.md line 9 ("IT design capacity 2,000 kW")
            it_design_kw: 2000,
            // source: 09-engineering-basis-and-calculations.md line 10 ("Current IT load 1,850 kW")
            it_load_kw: 1850,
            // source: 09-engineering-basis-and-calculations.md line 11 ("PUE 1.45")
            pue: 1.45
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
            // source: 09-engineering-basis-and-calculations.md line 73-77
            //         ("Cooling load target = 1,850 to 1,950 kW"); heat rejection
            //         ~= IT load + UPS losses, computed below from it_load + ups_loss
            // (no authored constant — heat_rejection_kw is derived)
            chillers_running: 2,
            // source: 01-dashboard-review.md §2 / dashboard KPI "Chillers 2/3"
            chillers_total: 3
        },
        electrical: {
            // source: 09-engineering-basis-and-calculations.md line 39
            //         ("UPS losses @ 96% efficiency 77 kW") -> efficiency = 0.96
            ups_efficiency: 0.96,
            // source: 01-dashboard-review.md §"Right-Side Stats Panel" (UPS A / UPS B)
            //         2N topology — two independent UPS systems each carrying ~50%
            ups_module_count: 2,
            // source: 09-engineering-basis-and-calculations.md line 77
            //         metering tolerance for epms.total_kw (doc-00 line 77 "+/- metering_delta",
            //         doc-12 line 9 "within 2%")
            metering_tolerance_pct: 2
        },
        fuel: {
            // source: 09-engineering-basis-and-calculations.md line 16, 126
            //         ("Fuel level 85%")
            level_pct: 85,
            // source: 09-engineering-basis-and-calculations.md line 140
            //         ("Tank capacity = 60,000 L")
            tank_capacity_l: 60000,
            // source: 09-engineering-basis-and-calculations.md line 141
            //         ("Usable fraction = 90%")
            usable_fraction: 0.90,
            // source: 09-engineering-basis-and-calculations.md line 144-147
            //         (consumption ~956 L/hr at facility load ~2.7 MW gives 48 hr)
            generator_consumption_lph: 956
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
            basis_doc: 'conv/review/09-engineering-basis-and-calculations.md',
            version: '1.0.0'
        }
    };

    /* --- Pure derivation helpers -------------------------------------------- */

    function round1(n) { return Math.round(n * 10) / 10; }
    function round2(n) { return Math.round(n * 100) / 100; }

    /* Facility (total) load = IT load x PUE.
     * source: 00-overview-audit.md line 74 ; 09 lines 25-28 ; 01-dashboard-review.md lines 10-13
     */
    function facilityLoadKw(m) {
        return m.site.it_load_kw * m.site.pue;
    }

    /* Non-IT load = Facility load - IT load.
     * source: 00-overview-audit.md line 75 ; 09 lines 32-34
     */
    function nonItLoadKw(m) {
        return facilityLoadKw(m) - m.site.it_load_kw;
    }

    /* UPS losses at stated efficiency carrying the IT load.
     * loss = it_load * (1/eff - 1)  (input power above output by the inverse-eff factor)
     * source: 09-engineering-basis-and-calculations.md line 39 ("UPS losses @ 96% efficiency 77 kW")
     *   check: 1850 * (1/0.96 - 1) = 77.08 kW  -> ~77 kW (matches doc)
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
     * source: 00-overview-audit.md line 81 ("cooling.heat_rejection_kw ~= it_load_kw + ups_losses_kw") ;
     *         09 lines 73-77 (cooling load target 1,850-1,950 kW band)
     */
    function heatRejectionKw(m) {
        return m.site.it_load_kw + upsLossKw(m);
    }

    /* CHW flow (L/s) = cooling kW / (4.186 * deltaT).
     * source: 00-overview-audit.md line 83 (contract) ; 09 lines 81-85.
     *   doc-09's worked example uses the IT load (1,850 kW) as the "cooling kW"
     *   term: Flow = 1,850 / (4.186 * 7.6) = 58.1 L/s. We match that canonical
     *   number exactly (heatRejectionKw, IT+UPS, is still exposed for the
     *   1,850-1,950 kW cooling-band sanity check per 09 line 77).
     *   4.186 = specific heat of water kJ/(kg.K). check: 1850/(4.186*7.6) = 58.1 L/s
     */
    function chwFlowLps(m) {
        return m.site.it_load_kw / (4.186 * chwDeltaT(m));
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

    /* Per-UPS-module load (2N -> each module carries the full protected load /
     * module_count for the shared-load demo view).
     * source: 01-dashboard-review.md §"Right-Side Stats Panel" (UPS A / UPS B)
     */
    function upsModuleKw(m) {
        return epmsUpsOutputKw(m) / m.electrical.ups_module_count;
    }

    /* Usable fuel litres = capacity * usable_fraction * level_fraction.
     * source: 09-engineering-basis-and-calculations.md lines 133-143
     *   check: 60000 * 0.90 * 0.85 = 45,900 L
     */
    function fuelUsableL(m) {
        return m.fuel.tank_capacity_l * m.fuel.usable_fraction * (m.fuel.level_pct / 100);
    }

    /* Fuel autonomy (hr) = usable litres / generator consumption L/hr.
     * source: 00-overview-audit.md line 86 ; 09 lines 132-147
     *   check: 45,900 / 956 = 48.0 hr
     */
    function fuelAutonomyHr(m) {
        return fuelUsableL(m) / m.fuel.generator_consumption_lph;
    }

    /* Instant equivalent cooling-makeup water flow from WUE.
     * source: 09-engineering-basis-and-calculations.md lines 99-104, 189-190
     *   L/min = (WUE * IT load kW) / 60   check: (1.20*1850)/60 = 37.0 L/min
     */
    function waterFlowLpmForWue(m) {
        return (m.environment.wue_l_per_kwh * m.site.it_load_kw) / 60;
    }

    /* WUE recomputed from a measured water volume (for the water page contract).
     * source: 00-overview-audit.md line 85 ; 09 line 109
     *   wue = annual_water_l / annual_it_kwh ; instant: (Lpm*60)/IT_kW
     */
    function wueFromFlowLpm(m, flowLpm) {
        return (flowLpm * 60) / m.site.it_load_kw;
    }

    /* Hourly facility carbon emissions (kgCO2e/hr), facility-energy denominator.
     * source: 09-engineering-basis-and-calculations.md lines 155-158, 167
     *   check: 2683 * 0.42 = 1,127 kgCO2/hr
     */
    function carbonKgPerHr(m) {
        return facilityLoadKw(m) * m.environment.carbon_kg_per_facility_kwh;
    }

    /* Active-rack estimate at a given density (kW/rack).
     * source: 09-engineering-basis-and-calculations.md lines 51-63
     */
    function activeRacks(m, kwPerRack) {
        return m.site.it_load_kw / kwPerRack;
    }

    /* --- Computed convenience snapshot (frozen) ----------------------------- */

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

        return {
            site: {
                it_design_kw: m.site.it_design_kw,
                it_load_kw: m.site.it_load_kw,
                pue: m.site.pue,
                facility_load_kw: round1(facility),
                facility_load_kw_exact: facility,
                non_it_load_kw: round1(nonIt),
                non_it_load_kw_exact: nonIt
            },
            electrical: {
                ups_loss_kw: round1(upsLoss),
                epms_total_kw: round1(epmsTotalKw(m)),
                epms_ups_output_kw: round1(epmsUpsOutputKw(m)),
                ups_module_kw: round1(upsModuleKw(m)),
                metering_tolerance_pct: m.electrical.metering_tolerance_pct
            },
            cooling: {
                chws_c: m.cooling.chws_c,
                chwr_c: m.cooling.chwr_c,
                chw_delta_t: round2(dT),
                heat_rejection_kw: round1(heatRej),
                flow_lps: round1(flowLps),
                chillers_running: m.cooling.chillers_running,
                chillers_total: m.cooling.chillers_total
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
                generator_consumption_lph: m.fuel.generator_consumption_lph,
                autonomy_hr: round1(autonomy)
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
                basis_doc: m.meta.basis_doc,
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
        // frozen computed snapshot
        snapshot: deepFreeze(compute(CONV_MODEL)),
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
