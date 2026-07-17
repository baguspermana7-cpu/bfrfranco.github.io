/**
 * rz-engine.js — ResistanceZero Super Engine
 *
 * Single-source-of-truth library for static-HTML calculators.
 * See standarization/SUPER_ENGINE.md for full design.
 *
 * Load order: auth.js -> rz-engine.js -> article IIFE.
 * No build step. Vanilla ES5/ES6. No external dependencies.
 *
 * Phase: S0–S4 (skeleton + auth + workforce/roi/forecast + capex/opex/tco/pue)
 * Provides:
 *   - RZEngine.data           Single source of truth for site-wide constants.
 *   - RZEngine.auth.*         Login/session/event helpers (S1).
 *   - RZEngine.format.*       Currency / number / date formatters.
 *   - RZEngine.events.*       Custom-event bus.
 *   - RZEngine.models.*       Full calc math: workforce, roi, forecast, capex, opex, tco, pue (S2+S4).
 */
(function (root) {
    'use strict';

    if (root.RZEngine) {
        try { console.warn('[RZEngine] already loaded; skipping re-init'); } catch (e) {}
        return;
    }

    /* ====================================================================
     * I. DATA — single source of truth for site-wide constants
     *
     * Editing any value here updates EVERY calculator on the site that
     * consumes it. Bump `version` and add a CHANGELOG entry on any change.
     * ==================================================================== */
    var DATA = {
        version: '2.4.0',
        lastUpdated: '2026-07-15',
        asOf: '2026-07',

        // v2.0 schema metadata (A1). `version` above tracks DATA content; `meta.schemaVersion`
        // tracks the SHAPE. The single-source-of-truth rule: no calculator may hardcode a value
        // that lives here, and every leaf value is registered in DATA.sources with a citation.
        meta: {
            schemaVersion: '2.0.0',
            engineVersion: '2.1.0',
            asOf:          '2026-07',
            lastReviewed:  '2026-07-05',
            license:       'CC-BY-4.0 (data compilation) — see DATA.provenance for per-table sources'
        },

        // Target-Year selector — used by every forecasting calculator
        years: [2025, 2026, 2027, 2028, 2029, 2030],
        baselineYear: 2025,

        // Regional cost variance — single source for cross-calculator consistency.
        // Coarse macro-regions; country-level codes (ID/SG/JP/IN/MY) live in `regionsCountry` (A3).
        // powerKwh refreshed to 2026 DC-contract blended $/kWh (A2).
        regions: {
            US:    { salaryMult: 1.00, powerKwh: 0.090, label: 'United States',  currency: 'USD' },
            EU:    { salaryMult: 0.85, powerKwh: 0.235, label: 'Europe',         currency: 'EUR' },
            APAC:  { salaryMult: 0.45, powerKwh: 0.110, label: 'Asia-Pacific',   currency: 'USD' },
            LATAM: { salaryMult: 0.55, powerKwh: 0.130, label: 'Latin America',  currency: 'USD' }
        },

        // Static currency rates (USD = 1.0 baseline), refreshed 2026-04. Update annually.
        currency: { USD: 1.0, EUR: 0.92, IDR: 16250, SGD: 1.35, GBP: 0.79, JPY: 152, INR: 83.5, MYR: 4.45 },

        // Annual inflation rate per region (flat; year-by-year curve is optional via forecast useInflation)
        inflationAnnual: { US: 0.028, EU: 0.024, APAC: 0.030, LATAM: 0.040 },

        // DC workforce salary benchmarks (USD/yr base), refreshed 2026: Uptime 2026, AFCOM 2026, BLS 2025.
        salaryBenchmarks: {
            dcTechMid:             { US: 82000,  EU: 68000,  APAC: 38000, LATAM: 45000 },
            electricianJourneyman: { US: 128000, EU: 96000,  APAC: 42000, LATAM: 58000 },
            cdfomSenior:           { US: 168000, EU: 140000, APAC: 88000, LATAM: 105000 }
        },

        // Workforce attrition factors (Center for American Progress, DataX Connect 2024)
        attritionFactors: {
            replacementCostMult:   2.13,  // 213% of annual salary to replace specialised DC role
            voluntaryAttritionAvg: 0.25,  // 25% — DataX Connect 2024 industry baseline
            apprenticeRetention:   0.78   // 4-year DOL apprenticeship retention rate
        },

        // PUE defaults by cooling architecture, refreshed 2026 (Uptime Global PUE Survey 2026).
        // Legacy *Tier3 keys retained for backward-compat; full per-tier matrix in `pueMatrix` (A3).
        pueDefaults: {
            airCooledTier3:    1.50,   // modern efficient air (was 1.58)
            liquidCooledTier3: 1.15,
            immersionTier3:    1.04
        },
        pueMatrix: {
            /* inrow/rdhx rows added v2.3.0 so capex-calculator + DCMOC granularity is engine-owned */
            inrow:     { tier2: 1.34, tier3: 1.27, tier4: 1.22 },
            rdhx:      { tier2: 1.24, tier3: 1.18, tier4: 1.14 },
            air:       { tier2: 1.62, tier3: 1.50, tier4: 1.44 },
            liquid:    { tier2: 1.22, tier3: 1.15, tier4: 1.10 },
            immersion: { tier2: 1.07, tier3: 1.04, tier4: 1.03 }
        },

        // Capex per-MW build cost (USD, raw build excluding land/IT), refreshed 2026.
        // Sources: 451 Research 2026, JLL DC Cost 2026, Cushman & Wakefield 2026. Full tier x cooling matrix.
        capexPerMw: {
            airCooledTier2:    8000000,   // $8.0M/MW
            airCooledTier3:    11000000,  // $11.0M/MW (mainstream hyperscale)
            airCooledTier4:    14500000,  // $14.5M/MW
            liquidCooledTier2:  9500000,  // $9.5M/MW
            liquidCooledTier3: 13000000,  // $13.0M/MW
            liquidCooledTier4: 16500000,  // $16.5M/MW
            immersionTier2:    12000000,  // $12.0M/MW
            immersionTier3:    15500000,  // $15.5M/MW
            immersionTier4:    19000000   // $19.0M/MW (premium immersion infra)
        },

        // MEP percentage of total raw construction CAPEX (industry typical range 35-45%)
        mepPctOfCapex: { tier2: 0.36, tier3: 0.42, tier4: 0.48 },

        // Modular construction premium vs stick-built (negative = cheaper, positive = costlier)
        modularPremiumPct: { tier2: -0.05, tier3: 0.08, tier4: 0.15 },

        // Hours per year (constant, exposed for clarity in formulas)
        hoursPerYear: 8760,

        /* ── A4: constants surfaced out of function bodies (single-source-of-truth) ──
         * These previously lived as literals inside models.* — moving them here means a
         * calculator can override them and an auditor can see them. Values are UNCHANGED
         * from the inline versions (behavior-preserving). */

        // opex.coolingEfficiency — base efficiency by climate zone + per-°C design-ΔT bonus
        coolingClimate: {
            base: { cold: 0.85, temperate: 0.78, hot: 0.68, tropical: 0.62 },
            fallback: 0.75,
            deltaTRefC: 10,        // reference design ΔT
            perDegreeBonus: 0.03,  // efficiency gain per °C above the reference
            cap: 0.95              // physical ceiling
        },

        // opex.contractCostAnnual — outsourced O&M base $/yr by facility scope (pre-region mult)
        contractCostBase: { small: 30000, medium: 120000, large: 350000 },

        // opex.staffingCostAnnual — fully-loaded multiplier over base salary (benefits, tax, overhead)
        staffingLoadFactor: 1.30,

        // opex.totalAnnual defaults
        opexDefaults: { maintenancePct: 0.02, overheadPct: 0.08, contractScope: 'medium' },

        // capex.totalCost defaults
        capexDefaults: { contingencyPct: 0.10, itPctOfCapex: 0.40 },

        // tco lifecycle refresh policy (IT-gear replacement)
        refresh: { cycleYears: 5, refreshPct: 0.40 },

        // workforce model tuning params (strategy weighting + coverage floor)
        workforceParams: { coverageFloor: 0.30, strategyOnWeight: 1.0, strategyOffWeight: 0.2 },

        /* ── A3: EXPANSION TABLES (new capabilities the site needs) ── */

        // Country-level regions (first-class codes) for the site's PLN-Java / ASEAN focus.
        // powerKwh = 2026 industrial/DC blended $/kWh; salaryMult relative to US=1.00.
        regionsCountry: {
            ID: { salaryMult: 0.32, powerKwh: 0.075, label: 'Indonesia',  currency: 'IDR', parent: 'APAC' },
            SG: { salaryMult: 0.72, powerKwh: 0.180, label: 'Singapore',  currency: 'SGD', parent: 'APAC' },
            JP: { salaryMult: 0.78, powerKwh: 0.165, label: 'Japan',      currency: 'JPY', parent: 'APAC' },
            IN: { salaryMult: 0.28, powerKwh: 0.095, label: 'India',      currency: 'INR', parent: 'APAC' },
            MY: { salaryMult: 0.35, powerKwh: 0.070, label: 'Malaysia',   currency: 'MYR', parent: 'APAC' }
        },

        // Land + shell cost by region ($/MW of built capacity). Previously conflated into salaryMult.
        land: {
            US: 850000, EU: 1100000, APAC: 700000, LATAM: 600000,
            ID: 520000, SG: 2400000, JP: 1600000, IN: 480000, MY: 500000
        },

        // Construction / commissioning labor rates ($/hr), separate from operating salaries.
        laborRates: {
            US: 78, EU: 68, APAC: 32, LATAM: 40,
            ID: 22, SG: 55, JP: 60, IN: 18, MY: 26
        },

        // Grid carbon intensity (kgCO₂e/kWh) + carbon price ($/tCO₂e) by region (2026, IEA + Ember).
        carbon: {
            gridFactor: {
                US: 0.37, EU: 0.23, APAC: 0.55, LATAM: 0.20,
                ID: 0.68, SG: 0.41, JP: 0.47, IN: 0.63, MY: 0.55
            },
            carbonPrice: {   // $/tCO₂e — compliance/voluntary blended
                US: 40, EU: 85, APAC: 25, LATAM: 15,
                ID: 12, SG: 18, JP: 30, IN: 10, MY: 14
            },
            embodiedPerMw: 3200,   // tCO₂e embodied in construction per MW (concrete+steel+MEP)
            offsetPrice:   35       // $/tCO₂e voluntary market 2026 blend (was 18; DCMOC used 45 — reconciled v2.3.0)
        },

        // Water use efficiency baseline (L/kWh) by cooling type + water price ($/m³) by region.
        water: {
            wueByType: { air: 1.80, rearDoor: 1.10, directToChip: 0.50, immersion: 0.10 },
            priceM3:   { US: 2.5, EU: 3.2, APAC: 1.8, LATAM: 1.5,
                         ID: 0.9, SG: 2.1, JP: 2.4, IN: 0.7, MY: 0.8 }
        },

        // Rack power-density tiers + capex/PUE multipliers for high-density GPU/AI halls.
        aiDensity: {
            legacy: { kwPerRack: 12,  capexMult: 1.00, pueMult: 1.00 },   // 8–15 kW
            hpc:    { kwPerRack: 60,  capexMult: 1.18, pueMult: 0.98 },   // 40–80 kW
            ai:     { kwPerRack: 110, capexMult: 1.42, pueMult: 0.95 }    // 80–132+ kW (liquid-assisted)
        },

        // Canonical cooling types with PUE / capex / WUE deltas — cooling becomes data-driven, not string-keyed.
        coolingTypes: {
            air:          { label: 'Air-cooled',          capexKey: 'airCooled',    pueKey: 'air',       wueKey: 'air' },
            rearDoor:     { label: 'Rear-door heat exch.', capexKey: 'liquidCooled', pueKey: 'liquid',    wueKey: 'rearDoor' },
            directToChip: { label: 'Direct-to-chip liquid', capexKey: 'liquidCooled', pueKey: 'liquid',   wueKey: 'directToChip' },
            immersion:    { label: 'Immersion',           capexKey: 'immersion',    pueKey: 'immersion', wueKey: 'immersion' }
        },

        // Tier I–IV definitions + redundancy multipliers used across capex/tco.
        tiers: {
            1: { label: 'Tier I',   redundancy: 'N',    availability: 0.9967, capexMult: 0.82 },
            2: { label: 'Tier II',  redundancy: 'N+1',  availability: 0.9975, capexMult: 1.00 },
            3: { label: 'Tier III', redundancy: 'N+1 concurrently maintainable', availability: 0.9982, capexMult: 1.28 },
            4: { label: 'Tier IV',  redundancy: '2N/2N+1 fault tolerant',        availability: 0.9995, capexMult: 1.62 }
        },

        // Operating roles (expanded beyond the original 3). Keys align with salaryRoles below.
        roles: {
            dcTechMid:             { label: 'DC Technician (mid)' },
            electricianJourneyman: { label: 'Electrician (journeyman)' },
            cdfomSenior:           { label: 'Critical-Facility Ops Mgr (senior)' },
            gpuInfraTech:          { label: 'GPU / AI-infra Technician' },
            liquidCoolingTech:     { label: 'CDU / Liquid-cooling Technician' },
            commissioningEngineer: { label: 'Commissioning (Cx) Engineer' },
            nocOperator:           { label: 'NOC Operator' }
        },
        // Salary benchmarks for the NEW roles (USD/yr base, 2026). Legacy 3 stay in salaryBenchmarks.
        salaryRolesExt: {
            gpuInfraTech:          { US: 105000, EU: 88000,  APAC: 52000, LATAM: 60000 },
            liquidCoolingTech:     { US: 98000,  EU: 82000,  APAC: 46000, LATAM: 55000 },
            commissioningEngineer: { US: 142000, EU: 118000, APAC: 74000, LATAM: 90000 },
            nocOperator:           { US: 68000,  EU: 58000,  APAC: 30000, LATAM: 38000 }
        },

        // Default discount rate / WACC by region (roi/tco previously defaulted to 0).
        discountDefaults: { global: 0.09, US: 0.085, EU: 0.075, APAC: 0.11, LATAM: 0.13,
                            ID: 0.12, SG: 0.07, JP: 0.04, IN: 0.115, MY: 0.09 },


        /* ── Part F: shared DC MARKET intelligence (single source of truth for
         * dc-market-tracker + any DC-intelligence consumer — edit HERE, all re-flow).
         * Units: operational/construction/planned = MW · powerCost = $/kWh (market-level
         * industrial/DC rate — intentionally more granular than the macro blends in
         * DATA.regions[*].powerKwh, which stay the calculator defaults) · vacancy = % ·
         * coloPrice = $/kW/month retail colo · cagr = fraction (2025-2030). */
        markets: {
            'n-virginia': { name: 'Northern Virginia', lat: 38.9, lng: -77.4, operational: 4040, construction: 1100, planned: 5500, maturity: 'established', players: ['AWS', 'Microsoft', 'Google', 'Equinix', 'Digital Realty', 'QTS'], powerCost: 0.065, vacancy: 1.4, coloPrice: 215, cagr: 0.25, region: 'North America' },
            'dallas': { name: 'Dallas/Fort Worth', lat: 32.8, lng: -96.8, operational: 1200, construction: 600, planned: 2000, maturity: 'established', players: ['CyrusOne', 'DataBank', 'TierPoint', 'Flexential'], powerCost: 0.055, vacancy: 2.1, coloPrice: 160, cagr: 0.22, region: 'North America' },
            'phoenix': { name: 'Phoenix', lat: 33.4, lng: -112.0, operational: 800, construction: 500, planned: 1500, maturity: 'established', players: ['Microsoft', 'Google', 'CyrusOne', 'Stream'], powerCost: 0.058, vacancy: 3.5, coloPrice: 150, cagr: 0.20, region: 'North America' },
            'chicago': { name: 'Chicago', lat: 41.9, lng: -87.6, operational: 700, construction: 300, planned: 800, maturity: 'established', players: ['Equinix', 'Digital Realty', 'QTS'], powerCost: 0.072, vacancy: 2.8, coloPrice: 175, cagr: 0.15, region: 'North America' },
            'silicon-valley': { name: 'Silicon Valley', lat: 37.4, lng: -122.0, operational: 600, construction: 200, planned: 500, maturity: 'established', players: ['Equinix', 'CoreSite', 'Vantage'], powerCost: 0.095, vacancy: 1.8, coloPrice: 250, cagr: 0.08, region: 'North America' },
            'toronto': { name: 'Toronto', lat: 43.7, lng: -79.4, operational: 400, construction: 200, planned: 600, maturity: 'growing', players: ['Equinix', 'Allied REIT', 'Cologix'], powerCost: 0.085, vacancy: 4.2, coloPrice: 155, cagr: 0.18, region: 'North America' },
            'london': { name: 'London', lat: 51.5, lng: -0.1, operational: 1500, construction: 400, planned: 1200, maturity: 'established', players: ['Equinix', 'NTT', 'Virtus', 'Digital Realty'], powerCost: 0.170, vacancy: 2.5, coloPrice: 200, cagr: 0.10, region: 'Europe' },
            'frankfurt': { name: 'Frankfurt', lat: 50.1, lng: 8.7, operational: 900, construction: 300, planned: 800, maturity: 'established', players: ['Equinix', 'NTT', 'Interxion', 'e-shelter'], powerCost: 0.150, vacancy: 5.1, coloPrice: 195, cagr: 0.10, region: 'Europe' },
            'amsterdam': { name: 'Amsterdam', lat: 52.4, lng: 4.9, operational: 600, construction: 150, planned: 400, maturity: 'established', players: ['Equinix', 'Digital Realty', 'NorthC'], powerCost: 0.130, vacancy: 7.2, coloPrice: 180, cagr: 0.08, region: 'Europe' },
            'paris': { name: 'Paris', lat: 48.9, lng: 2.3, operational: 450, construction: 200, planned: 500, maturity: 'growing', players: ['Equinix', 'Data4', 'Interxion'], powerCost: 0.140, vacancy: 4.0, coloPrice: 190, cagr: 0.12, region: 'Europe' },
            'dublin': { name: 'Dublin', lat: 53.3, lng: -6.3, operational: 400, construction: 100, planned: 300, maturity: 'growing', players: ['Microsoft', 'AWS', 'Google', 'Echelon'], powerCost: 0.155, vacancy: 3.8, coloPrice: 185, cagr: 0.06, region: 'Europe' },
            'singapore': { name: 'Singapore', lat: 1.3, lng: 103.8, operational: 850, construction: 150, planned: 500, maturity: 'established', players: ['Equinix', 'Digital Realty', 'NTT', 'ST Telemedia'], powerCost: 0.180, vacancy: 0.8, coloPrice: 390, cagr: 0.12, region: 'Asia Pacific' },
            'tokyo': { name: 'Tokyo', lat: 35.7, lng: 139.7, operational: 1200, construction: 400, planned: 800, maturity: 'established', players: ['NTT', 'Equinix', 'KDDI', 'IIJ'], powerCost: 0.160, vacancy: 1.2, coloPrice: 270, cagr: 0.08, region: 'Asia Pacific' },
            'hong-kong': { name: 'Hong Kong', lat: 22.3, lng: 114.2, operational: 500, construction: 100, planned: 300, maturity: 'established', players: ['NTT', 'Equinix', 'SUNeVision', 'Digital Realty'], powerCost: 0.145, vacancy: 2.0, coloPrice: 280, cagr: 0.06, region: 'Asia Pacific' },
            'sydney': { name: 'Sydney', lat: -33.9, lng: 151.2, operational: 600, construction: 250, planned: 500, maturity: 'established', players: ['Equinix', 'NextDC', 'AirTrunk', 'Macquarie'], powerCost: 0.140, vacancy: 3.2, coloPrice: 180, cagr: 0.14, region: 'Asia Pacific' },
            'mumbai': { name: 'Mumbai', lat: 19.1, lng: 72.9, operational: 500, construction: 300, planned: 800, maturity: 'growing', players: ['NTT', 'STT GDC', 'Adani Connex', 'Yotta'], powerCost: 0.085, vacancy: 6.0, coloPrice: 125, cagr: 0.20, region: 'Asia Pacific' },
            'jakarta': { name: 'Jakarta', lat: -6.2, lng: 106.8, operational: 350, construction: 200, planned: 500, maturity: 'growing', players: ['NTT', 'DCI Indonesia', 'SpaceDC', 'Princeton Digital'], powerCost: 0.080, vacancy: 4.5, coloPrice: 160, cagr: 0.18, region: 'Asia Pacific' },
            'seoul': { name: 'Seoul', lat: 37.6, lng: 127.0, operational: 700, construction: 200, planned: 400, maturity: 'established', players: ['KT', 'Samsung SDS', 'Naver', 'LG'], powerCost: 0.095, vacancy: 2.5, coloPrice: 210, cagr: 0.10, region: 'Asia Pacific' },
            'kuala-lumpur': { name: 'Kuala Lumpur', lat: 3.1, lng: 101.7, operational: 250, construction: 150, planned: 400, maturity: 'growing', players: ['AIMS', 'YTL', 'Bridge DC', 'Keppel'], powerCost: 0.060, vacancy: 5.5, coloPrice: 140, cagr: 0.22, region: 'Asia Pacific' },
            'sao-paulo': { name: 'S\u00e3o Paulo', lat: -23.5, lng: -46.6, operational: 400, construction: 150, planned: 300, maturity: 'growing', players: ['Equinix', 'Ascenty', 'ODATA', 'Digital Realty'], powerCost: 0.100, vacancy: 5.0, coloPrice: 165, cagr: 0.16, region: 'Latin America' },
            'santiago': { name: 'Santiago', lat: -33.4, lng: -70.6, operational: 100, construction: 50, planned: 150, maturity: 'emerging', players: ['ODATA', 'Ascenty', 'GTD'], powerCost: 0.090, vacancy: 8.0, coloPrice: 145, cagr: 0.18, region: 'Latin America' },
            'dubai': { name: 'Dubai', lat: 25.2, lng: 55.3, operational: 200, construction: 100, planned: 400, maturity: 'growing', players: ['Khazna', 'Gulf Data Hub', 'Moro Hub'], powerCost: 0.065, vacancy: 3.0, coloPrice: 220, cagr: 0.25, region: 'Middle East & Africa' },
            'johannesburg': { name: 'Johannesburg', lat: -26.2, lng: 28.0, operational: 150, construction: 80, planned: 200, maturity: 'emerging', players: ['Teraco', 'Africa Data Centres', 'Vantage'], powerCost: 0.075, vacancy: 6.0, coloPrice: 170, cagr: 0.20, region: 'Middle East & Africa' },
            'nairobi': { name: 'Nairobi', lat: -1.3, lng: 36.8, operational: 50, construction: 30, planned: 100, maturity: 'emerging', players: ['PAIX', 'iColo', 'Africa Data Centres'], powerCost: 0.115, vacancy: 10.0, coloPrice: 200, cagr: 0.25, region: 'Middle East & Africa' },
            'queretaro': { name: 'Quer\u00e9taro', lat: 20.6, lng: -100.4, operational: 200, construction: 100, planned: 300, maturity: 'growing', players: ['Equinix', 'KIO Networks', 'Ascenty'], powerCost: 0.070, vacancy: 4.0, coloPrice: 135, cagr: 0.20, region: 'Latin America' }
        },

        /* Market-viz mapping — single source for the map/cards/charts across DC pages (maturity + region →
         * accent colour, CAGR thresholds). UI-layer constants live here so "edit once → re-flows everywhere". */
        marketViz: {
            maturityColors: { established: '#0d9488', growing: '#f59e0b', emerging: '#8b5cf6' },
            regionColors: {
                'North America': '#3b82f6', 'Europe': '#0d9488', 'Asia Pacific': '#f59e0b',
                'Latin America': '#10b981', 'Middle East & Africa': '#8b5cf6'
            },
            cagrHigh: 0.20, cagrMid: 0.10, fallback: '#64748b'
        },


        /* ══ v2.3.0 — DATA.capexDetail: the DETAILED capex model lifted from
         * capex-calculator.html (inline :2465-2557) so capex-calculator + DCMOC share ONE
         * source. Values keep the calculator's calibration lineage: the per-kW factors are
         * anchored to the sourced city $/W table below (locMult = perW/4.65). Golden-parity
         * fixtures (tools/fixtures/capex-golden.json) lock the migration. ══ */
        capexDetail: {
            /* $/kW IT by category */
            costFactors: {
                building: 800, seismic: 100, electrical: 1200, ups: 600, generator: 400,
                cooling: 700, fireSuppression: 150, fireAlarm: 80, bms: 120, network: 250,
                security: 80, commissioning: 120, testing: 90, permits: 60
            },
            redundancyMult: { n: 1.0, n1: 1.25, '2n': 1.85, '2n1': 2.1 },
            coolingMult: { air: 1.0, inrow: 1.2, rdhx: 1.35, liquid: 1.6 },
            rackMult: { standard: 1.0, medium: 1.1, high: 1.3, ai: 1.9 },
            rackKw: { standard: 6, medium: 12.5, high: 25, ai: 75 },
            buildingMult: { warehouse: 0.7, modular: 0.85, purpose: 1.0, highrise: 1.4 },
            seismicMult: { zone0: 0.2, zone1: 1.0, zone2: 2.5, zone3: 5.0, zone4: 8.0 },
            fireSuppressionMult: { fm200: 1.0, novec: 1.3, inergen: 1.2, n2: 1.8, water: 0.6 },
            fireAlarmMult: { conventional: 0.6, addressable: 1.0, vesda: 1.8, hybrid: 2.2 },
            upsMult: { standalone: 0.9, modular: 1.0, distributed: 1.2, rotary: 1.5 },
            genMult: { diesel: 1.0, gas: 1.15, dualfuel: 1.3, hvo: 1.2 },
            locationMult: { sea: 0.65, india: 0.55, china: 0.7, japan: 1.1, australia: 1.05, europe: 1.15, usa: 1.0, mena: 0.90 },
            regionGroupDefaults: {
                americas: { internalRegion: 'usa', multiplier: 1.00 },
                emea: { internalRegion: 'europe', multiplier: 1.15 },
                apac: { internalRegion: 'sea', multiplier: 0.85 },
                middle_east: { internalRegion: 'mena', multiplier: 0.90 }
            },
            cityAnchorPerW: 4.65,   /* locMult = city.perW / cityAnchorPerW */
            cityCapexPerW: {
                silicon_valley: { perW: 13.30, region: 'usa', label: 'Silicon Valley' },
                new_jersey: { perW: 12.90, region: 'usa', label: 'New Jersey / NYC' },
                virginia: { perW: 13.40, region: 'usa', label: 'Virginia / NOVA' },
                dallas: { perW: 14.30, region: 'usa', label: 'Dallas, TX' },
                phoenix: { perW: 13.40, region: 'usa', label: 'Phoenix, AZ' },
                chicago: { perW: 13.20, region: 'usa', label: 'Chicago, IL' },
                san_antonio: { perW: 9.30, region: 'usa', label: 'San Antonio, TX' },
                toronto: { perW: 11.80, region: 'usa', label: 'Toronto, Canada' },
                sao_paulo: { perW: 8.50, region: 'usa', label: 'São Paulo, Brazil' },
                queretaro: { perW: 8.00, region: 'usa', label: 'Querétaro, Mexico' },
                london: { perW: 12.00, region: 'europe', label: 'London, UK' },
                frankfurt: { perW: 11.60, region: 'europe', label: 'Frankfurt, Germany' },
                amsterdam: { perW: 11.80, region: 'europe', label: 'Amsterdam, Netherlands' },
                stockholm: { perW: 10.50, region: 'europe', label: 'Stockholm, Sweden' },
                lisbon: { perW: 10.80, region: 'europe', label: 'Lisbon, Portugal' },
                dublin: { perW: 11.50, region: 'europe', label: 'Dublin, Ireland' },
                paris: { perW: 12.20, region: 'europe', label: 'Paris, France' },
                madrid: { perW: 10.20, region: 'europe', label: 'Madrid, Spain' },
                milan: { perW: 11.00, region: 'europe', label: 'Milan, Italy' },
                warsaw: { perW: 9.00, region: 'europe', label: 'Warsaw, Poland' },
                zurich: { perW: 14.50, region: 'europe', label: 'Zurich, Switzerland' },
                oslo: { perW: 11.50, region: 'europe', label: 'Oslo, Norway' },
                brussels: { perW: 11.20, region: 'europe', label: 'Brussels, Belgium' },
                dubai: { perW: 10.50, region: 'mena', label: 'Dubai, UAE' },
                riyadh: { perW: 9.80, region: 'mena', label: 'Riyadh, Saudi Arabia' },
                doha: { perW: 11.00, region: 'mena', label: 'Doha, Qatar' },
                tokyo: { perW: 15.20, region: 'japan', label: 'Tokyo, Japan' },
                singapore: { perW: 14.53, region: 'sea', label: 'Singapore' },
                hong_kong: { perW: 13.80, region: 'china', label: 'Hong Kong' },
                seoul: { perW: 9.50, region: 'japan', label: 'Seoul, South Korea' },
                sydney: { perW: 12.30, region: 'australia', label: 'Sydney, Australia' },
                malaysia: { perW: 11.37, region: 'sea', label: 'Malaysia / Johor' },
                jakarta: { perW: 11.21, region: 'sea', label: 'Jakarta, Indonesia' },
                mumbai: { perW: 6.64, region: 'india', label: 'Mumbai, India' },
                chennai: { perW: 6.20, region: 'india', label: 'Chennai, India' },
                taipei: { perW: 10.00, region: 'china', label: 'Taipei, Taiwan' },
                bangkok: { perW: 8.50, region: 'sea', label: 'Bangkok, Thailand' }
            },
            yearEscalation: { 2025: 1.000, 2026: 1.060, 2027: 1.115, 2028: 1.165, 2029: 1.210, 2030: 1.250 },
            substationCosts: { shared: 1000000, dedicated_33kv: 4000000, dedicated_132kv: 7500000 },
            fom: { gridConnectionPerMw: 500000, switchgearPerMw: 300000,
                   transformerLeadMult: { standard: 1.0, extended: 1.15, emergency: 1.30 } },
            marketConditionMult: { buyer: 0.95, balanced: 1.0, seller: 1.10 },
            deliveryMethodMult: { dbb: 1.0, db: 0.97, modular: 0.92, epc: 1.05 },
            contractorAvailMult: { high: 1.0, normal: 1.03, tight: 1.08 },
            powerDistMult: { overhead: 0.92, busway: 1.0, underground: 1.15, mixed: 1.08 },
            transformerTypeMult: { oil: 0.90, dry: 1.0, cast_resin: 1.12 },
            pduCostPerRack: { basic: 800, intelligent: 1500, switched: 2500 },
            cablingCostPerRack: { copper: 600, hybrid: 1200, fiber: 2000 },
            floorTypeMult: { slab: 0.95, raised_600: 1.0, raised_900: 1.06, raised_1200: 1.12 },
            siteConditionMult: { greenfield: 1.06, brownfield: 1.0, retrofit: 1.15 },
            securityLevelMult: { standard: 1.0, enterprise: 1.5, high: 2.2 },
            fiberEntryCost: { single: 150000, dual: 350000, multi: 600000 },
            greenCertMult: { none: 1.0, silver: 1.02, gold: 1.04, platinum: 1.08 },
            renewableCostPerMw: { none: 0, solar: 1200000, solar_bess: 2500000 },
            permitRegionMult: {
                sea: { permits: 1.3, testing: 0.8 }, india: { permits: 1.4, testing: 0.7 },
                china: { permits: 1.5, testing: 0.9 }, japan: { permits: 1.8, testing: 1.5 },
                australia: { permits: 1.6, testing: 1.3 }, europe: { permits: 1.7, testing: 1.4 },
                usa: { permits: 1.0, testing: 1.0 }, mena: { permits: 1.2, testing: 0.9 }
            },
            testingRedundancyMult: { n: 0.7, n1: 1.0, '2n': 1.5, '2n1': 1.8 },
            fuelMultPerHourOver24: 0.008,
            softCostDefaults: { designPct: 8, pmPct: 5, contingencyPct: 10, simpleContingencyPct: 5 },
            pueByCoolingRack: {   /* design PUE matrix used by the detailed calculator */
                air:    { standard: 1.8, medium: 1.7, high: 1.6, ai: 1.5 },
                inrow:  { standard: 1.6, medium: 1.5, high: 1.45, ai: 1.4 },
                rdhx:   { standard: 1.45, medium: 1.4, high: 1.35, ai: 1.3 },
                liquid: { standard: 1.3, medium: 1.25, high: 1.2, ai: 1.15 }
            },
            wueByCooling: { air: 0.0, inrow: 1.8, rdhx: 0.3, liquid: 0.1 },
            energyRateByLocation: { sea: 0.08, india: 0.07, usa: 0.10, other: 0.12 },
            /* Rack-density → floor-space model (owner mandate 2026-07-15). Rules of thumb:
             * 600 mm racks at hot/cold-aisle pitch; higher density widens service aisles;
             * DLC/deep-sea rows add in-row CDU + manifold clearance; support space (UPS,
             * battery, switchgear, cooling galleries, corridors) scales with redundancy. */
            space: {
                rackFootprintM2: { standard: 2.5, medium: 2.8, high: 3.2, ai: 4.2 },
                liquidRowFactor: 1.08,          /* in-row CDU + manifolds for liquid/rdhx/deep-sea */
                supportRatioByRedundancy: { n: 0.55, n1: 0.75, '2n': 1.05, '2n1': 1.2 },
                adminFixedM2: 300, adminPerRackM2: 0.15,
                targetHallM2: 1500,             /* typical single data-hall white space */
                racksPerRow: 20
            },
            timelineBase: {
                n: { design: 4, permit: 3, civil: 8, mep: 6, commission: 2 },
                n1: { design: 5, permit: 3, civil: 10, mep: 8, commission: 3 },
                '2n': { design: 6, permit: 4, civil: 12, mep: 10, commission: 4 },
                '2n1': { design: 7, permit: 4, civil: 14, mep: 12, commission: 5 }
            },
            buildingTimeMult: { warehouse: 0.7, modular: 0.6, purpose: 1.0, highrise: 1.4 },
            coolingTimeMult: { air: 1.0, inrow: 1.05, rdhx: 1.15, liquid: 1.3, deepsea: 1.45 },
            permitTimeMult: { sea: 1.2, india: 1.4, china: 1.3, japan: 1.5, australia: 1.3, europe: 1.4, usa: 1.0, mena: 1.1 }
        },

        /* ══ v2.3.0 — DATA.deepSeaCooling: chiller-less deep-sea water cooling physics.
         * Design basis: the 150 MW AI DC reference architecture (owner poster, 2026) —
         * 3 separated loops (TCS rack CDU → FWS closed → seawater open), titanium Gr2 PHE,
         * intake 800-1000 m @ 4-6 °C, ΔT 5 °C, N+1 pumps/filters/HX, trim chillers backup.
         * Poster reproduces with mode:'poster' (cp 4.0, ρ 1000); default 'accurate' uses
         * seawater properties at S≈35, 5 °C. ══ */
        deepSeaCooling: {
            seawater: {
                rhoKgM3: 1025, cpJKgK: 3985,
                posterRhoKgM3: 1000, posterCpJKgK: 4000,
                designDeltaTC: 5, deltaTEnvMaxC: 5,
                /* NOAA WOA-grade typical deep-water temps (tropical/subtropical margins) */
                intakeTempByDepth: [
                    { minDepthM: 1100, tC: 4.0 }, { minDepthM: 900, tC: 5.0 },
                    { minDepthM: 700, tC: 6.0 }, { minDepthM: 500, tC: 8.0 },
                    { minDepthM: 300, tC: 11.0 }, { minDepthM: 0, tC: 16.0 }
                ]
            },
            hx: { approachC: 2.0, approachRangeC: [1.5, 2.5], designPressureBarFw: 10,
                  costPerMwth: 95000, material: 'Titanium Grade 2' },
            pump: { effPump: 0.87, effMotor: 0.96, effVfd: 0.97,
                    maxPerPumpM3s: 3.0, baseStaticHeadM: 15, frictionHeadMPerKm: 12,
                    fwLoopPowerFraction: 0.38, cduPowerFraction: 0.10,
                    /* reference-poster pump spec (mode:'poster' reproduces exactly):
                     * rated 2.9 m3/s @ 60 m, ~2,000 kW each, 4 duty + 1 standby (design
                     * margin beyond hydraulic minimum), combined efficiency 0.85 */
                    poster: { ratedPerPumpM3s: 2.9, headM: 60, effTotal: 0.85, dutyMargin: 1 } },
            pipeline: { costPerKmByFlow: [
                    { maxM3s: 3, usd: 2200000 }, { maxM3s: 6, usd: 3400000 },
                    { maxM3s: 10, usd: 4800000 }, { maxM3s: 20, usd: 7500000 }
                ], marineInstallMult: 3.0, lines: 2 /* intake + outfall */,
                diffuserCost: 1800000, intakeStructureCost: 4500000 },
            filtration: { costPerM3h: 260, stages: 'coarse 50mm → fine 5mm → traveling screen → disc 200µm → auto-backwash 50µm', redundancy: 'N+1' },
            trimChiller: { capacityFraction: 0.35, hoursPerYear: 300, costPerMwth: 260000 },
            controls: { costFixed: 2500000 /* BMS integration, AI optimization, 2N controllers */ },
            elecLossFraction: 0.05,   /* UPS/distribution losses share of IT for PUE build-up */
            opex: { marineMaintPctOfMarineCapex: 0.03, chlorinationPerM3hYr: 6.5,
                    rovInspectionYr: 350000, pumpLoadFactor: 0.85 },
            contingencyPct: 0.15,
            redundancy: { pumps: 'N+1', filters: 'N+1', hx: 'N+1 parallel', chillers: 'N+1', power: '2N', controls: '2N' }
        },

        /* ══ v2.3.0 — DATA.refrigerants: chiller/CRAC refrigerant database.
         * GWP100 = IPCC AR4 (matches values already published on this site: 2088/1430/675/7).
         * copIndex = relative cycle efficiency at water-cooled chiller conditions,
         * R-134a centrifugal = 1.00 baseline (AHRI/manufacturer typical — estimate-grade).
         * safety = ASHRAE 34. capexMult = flammability/toxicity mitigation premium. ══ */
        refrigerants: {
            R410A:   { label: 'R-410A',      gwp: 2088, safety: 'A1',  copIndex: 0.95, chargeKgPerKwth: 0.15, leakPctYr: 0.04, capexMult: 1.00, apps: ['crac', 'chiller'], note: 'US AIM Act restricts GWP>700 in new equipment from 2025; EU F-Gas phase-down' },
            R134a:   { label: 'R-134a',      gwp: 1430, safety: 'A1',  copIndex: 1.00, chargeKgPerKwth: 0.20, leakPctYr: 0.03, capexMult: 1.00, apps: ['chiller'], note: 'Kigali HFC phase-down; baseline centrifugal-chiller refrigerant' },
            R513A:   { label: 'R-513A',      gwp: 631,  safety: 'A1',  copIndex: 0.97, chargeKgPerKwth: 0.20, leakPctYr: 0.03, capexMult: 1.00, apps: ['chiller'], note: 'Lower-GWP drop-in for R-134a (~3% capacity/efficiency penalty)' },
            R32:     { label: 'R-32',        gwp: 675,  safety: 'A2L', copIndex: 1.02, chargeKgPerKwth: 0.12, leakPctYr: 0.03, capexMult: 1.03, apps: ['crac'], note: 'Mildly flammable (A2L) — ventilation/leak-detection mitigation' },
            R454B:   { label: 'R-454B',      gwp: 466,  safety: 'A2L', copIndex: 0.98, chargeKgPerKwth: 0.13, leakPctYr: 0.03, capexMult: 1.03, apps: ['crac', 'chiller'], note: 'Primary R-410A replacement in new DX equipment' },
            R1234ze: { label: 'R-1234ze(E)', gwp: 7,    safety: 'A2L', copIndex: 0.96, chargeKgPerKwth: 0.20, leakPctYr: 0.02, capexMult: 1.03, apps: ['chiller'], note: 'Ultra-low-GWP HFO; EU F-Gas-proof; centrifugal/screw chillers' },
            R1233zd: { label: 'R-1233zd(E)', gwp: 1,    safety: 'A1',  copIndex: 1.02, chargeKgPerKwth: 0.22, leakPctYr: 0.015, capexMult: 1.02, apps: ['chiller'], note: 'Low-pressure centrifugal; non-flammable ultra-low GWP' },
            R717:    { label: 'R-717 (ammonia)', gwp: 0, safety: 'B2L', copIndex: 1.04, chargeKgPerKwth: 0.10, leakPctYr: 0.02, capexMult: 1.07, apps: ['chiller'], note: 'Zero GWP, excellent efficiency; toxicity — machine-room isolation, occupied-space charge limits (IIAR/EN 378)' },
            R290:    { label: 'R-290 (propane)', gwp: 3, safety: 'A3', copIndex: 1.00, chargeKgPerKwth: 0.05, leakPctYr: 0.02, capexMult: 1.06, apps: ['chiller'], note: 'Highly flammable (A3) — strict charge limits; outdoor/rooftop packaged' }
        },
        refrigerantBaseline: 'R134a',
        refrigerantAutoByCooling: { air: 'R410A', inrow: 'R410A', rdhx: 'R134a', liquid: null, deepsea: 'R1234ze' },
        chillerBaseCopWaterCooled: 6.5,

        /* ══ v2.3.0 — DATA.energy: screening-grade on-site renewables + BESS module.
         * Answers 'BESS/solar/wind: engine ini atau terpisah?' → INSIDE RZEngine (one
         * provenance regime, same consumers). Screening-level economics — NOT an
         * interconnection or reliability study. ══ */
        energy: {
            solar: { capexPerMwp: { US: 950000, EU: 900000, APAC: 780000, LATAM: 850000, ID: 800000, SG: 1050000, JP: 1100000, IN: 650000, MY: 780000 },
                     cfByRegion: { US: 0.24, EU: 0.14, APAC: 0.17, LATAM: 0.22, ID: 0.17, SG: 0.15, JP: 0.15, IN: 0.20, MY: 0.16 },
                     opexPctYr: 0.015, lifeYears: 30, landHaPerMwp: 1.2 },
            windOnshore: { capexPerMw: 1500000, cfByRegion: { US: 0.36, EU: 0.30, APAC: 0.28, LATAM: 0.38, ID: 0.24, SG: 0.0, JP: 0.26, IN: 0.28, MY: 0.20 },
                           opexPctYr: 0.025, lifeYears: 25 },
            windOffshore: { capexPerMw: 3800000, cfByRegion: { US: 0.44, EU: 0.45, APAC: 0.40, LATAM: 0.45, ID: 0.35, SG: 0.0, JP: 0.38, IN: 0.35, MY: 0.30 },
                            opexPctYr: 0.035, lifeYears: 25 },
            bess: { capexPerKwh: 180, roundtripEff: 0.88, cycleLife: 6000, opexPctYr: 0.02, lifeYears: 15 },
            solarDaylightFraction: 0.42   /* fraction of 24h a tracking-adjusted array meaningfully produces */
        },
        /* ══ v2.4.0 — DATA.reliability: MTBF/MTTR by component + Uptime tier availability.
         * Screening-grade RAM inputs (IEEE 493 Gold Book typical figures + Uptime Tier
         * Standard availability). Powers models.reliability (Layer 10). NOT a certified
         * RAM/FMEA study. ══ */
        reliability: {
            /* Component MTBF (hours) + MTTR (hours) — IEEE 493 typical ranges. */
            components: {
                ups:        { mtbf: 250000, mttr: 8,  label: 'UPS module' },
                generator:  { mtbf: 150000, mttr: 24, label: 'Diesel generator' },
                crac:       { mtbf: 100000, mttr: 6,  label: 'CRAC/CRAH' },
                pdu:        { mtbf: 400000, mttr: 4,  label: 'PDU' },
                switchgear: { mtbf: 350000, mttr: 12, label: 'Switchgear' },
                chiller:    { mtbf: 120000, mttr: 12, label: 'Chiller' }
            },
            /* Uptime Institute Tier Standard availability targets. */
            tierAvailability: { 2: 0.99741, 3: 0.99982, 4: 0.99995 },
            /* Redundancy config → number of parallel paths for a component group. */
            redundancyPaths: { 'n': 1, 'n1': 2, '2n': 2, '2n1': 3 }
        },
        /* ══ v2.4.0 — DATA.site: Site Intelligence scoring (Layer 2). Weighted
         * site-selection factor model → 0-100 Site Score + grade. Weights are a
         * transparent DC site-selection heuristic (power + grid dominate). ══ */
        site: {
            /* Factor weights (sum = 1.0). Each factor is a 0-1 goodness score
             * (1 = best). power/grid dominate DC site selection. */
            weights: { power: 0.18, grid: 0.15, seismic: 0.12, talent: 0.12, tax: 0.10, carbon: 0.10, flood: 0.08, latency: 0.08, water: 0.07 },
            /* Score → letter grade bands. */
            gradeBands: [
                { min: 85, grade: 'A', label: 'Prime' },
                { min: 70, grade: 'B', label: 'Strong' },
                { min: 55, grade: 'C', label: 'Viable' },
                { min: 40, grade: 'D', label: 'Marginal' },
                { min: 0,  grade: 'E', label: 'Challenged' }
            ]
        },
        /* ══ v2.4.0 — DATA.commissioning: Operational Readiness Index (Layer 7).
         * Weighted commissioning-level completion → readiness %. Levels follow the
         * standard DC Cx sequence (L1 factory → L5 integrated systems test) + IST/
         * SAT/FAT + punchlist burndown. ══ */
        commissioning: {
            /* Cx category weights (sum = 1). Integrated system test (L5) + IST
             * dominate operational readiness. */
            weights: { L1: 0.05, L2: 0.08, L3: 0.12, L4: 0.15, L5: 0.22, ist: 0.18, sat: 0.08, fat: 0.07, punchlist: 0.05 },
            labels: { L1: 'L1 Factory', L2: 'L2 Component', L3: 'L3 System', L4: 'L4 Subsystem', L5: 'L5 Integrated Systems Test', ist: 'Integrated Systems Test', sat: 'Site Acceptance', fat: 'Factory Acceptance', punchlist: 'Punchlist burndown' },
            /* Readiness thresholds → status. */
            statusBands: [
                { min: 95, status: 'Ready', label: 'Operationally ready' },
                { min: 80, status: 'Conditional', label: 'Conditionally ready — open items' },
                { min: 0,  status: 'Not Ready', label: 'Not ready' }
            ]
        },
        /* ══ v2.4.0 — DATA.asset: Asset Intelligence (Layer 9). Design lives by asset
         * class + health-index weights + status bands. Powers the asset digital
         * passport / health index. ══ */
        asset: {
            /* Typical design life (years) by asset class — manufacturer/ASHRAE service life. */
            designLifeYears: { ups: 12, battery: 8, generator: 25, crac: 15, chiller: 20, pdu: 20, switchgear: 25, transformer: 30, bms: 10, fireSuppression: 15 },
            /* Health-index factor weights (sum = 1): remaining-life dominates, then
             * observed condition, then duty/criticality stress. */
            weights: { remainingLife: 0.5, condition: 0.35, duty: 0.15 },
            /* Health % → status band. */
            statusBands: [
                { min: 80, status: 'Healthy', label: 'Healthy' },
                { min: 60, status: 'Monitor', label: 'Monitor' },
                { min: 40, status: 'Plan', label: 'Plan replacement' },
                { min: 0,  status: 'Critical', label: 'Replace / high risk' }
            ]
        },
        /* ══ v2.4.0 — DATA.construction: Construction schedule (Layer 6). Canonical DC
         * build phase sequence + overlap (fast-track) factors + milestone anchors.
         * Turns per-phase durations (e.g. from models.capex timeline) into a Gantt-
         * ready schedule + critical path + milestone dates. ══ */
        construction: {
            /* Ordered build phases + the fraction each may overlap its predecessor
             * (0 = strictly sequential, 0.3 = 30% fast-track overlap). */
            phaseOrder: ['design', 'permit', 'procurement', 'civil', 'mep', 'commission'],
            phaseLabels: { design: 'Design', permit: 'Permitting', procurement: 'Procurement', civil: 'Civil & Structure', mep: 'MEP Fit-out', commission: 'Commissioning' },
            overlap: { design: 0, permit: 0.2, procurement: 0.5, civil: 0.1, mep: 0.3, commission: 0 },
            /* Milestone anchors → the phase whose END marks the milestone. */
            milestones: { permitApproved: 'permit', groundbreak: 'civil', topOut: 'civil', powerOn: 'mep', rfs: 'commission' }
        },
        /* ══ v2.4.0 — DATA.requirements: Requirements intake (Layer 1). Required-field
         * set for a fundable brief + use-case density/cooling profiles. Drives the
         * intake completeness score + sensible defaults per workload. ══ */
        requirements: {
            /* Fields a complete, fundable project brief must carry. */
            required: ['itLoadKw', 'targetTier', 'region', 'useCase', 'budgetUsd', 'deadlineMonths'],
            optional: ['customer', 'contractType', 'landAreaM2', 'codDate', 'utilityPartner'],
            /* Use-case profiles → typical rack density (kW/rack) + recommended cooling
             * + tier floor. AI/HPC push liquid cooling + higher tier. */
            useCaseProfiles: {
                ai:         { label: 'AI / GPU training', rackKw: 60, cooling: 'liquid', tierFloor: 3 },
                hpc:        { label: 'HPC', rackKw: 45, cooling: 'rdhx', tierFloor: 3 },
                cloud:      { label: 'Hyperscale cloud', rackKw: 20, cooling: 'inrow', tierFloor: 3 },
                colo:       { label: 'Colocation', rackKw: 12, cooling: 'inrow', tierFloor: 3 },
                enterprise: { label: 'Enterprise', rackKw: 8, cooling: 'air', tierFloor: 2 },
                edge:       { label: 'Edge', rackKw: 10, cooling: 'air', tierFloor: 2 }
            }
        },
        /* ══ v2.4.0 — DATA.architecture: Architecture disciplines + design-complexity
         * (Layer 3). Canonical discipline list + cooling/tier complexity multipliers
         * → a normalized design-complexity index. ══ */
        architecture: {
            disciplines: ['electrical', 'mechanical', 'cooling', 'fire', 'security', 'network', 'building', 'structural', 'bms'],
            disciplineLabels: { electrical: 'Electrical', mechanical: 'Mechanical', cooling: 'Cooling', fire: 'Fire & Life Safety', security: 'Security', network: 'Network', building: 'Building', structural: 'Structural', bms: 'BMS / DCIM' },
            /* Relative design complexity by cooling architecture + tier + redundancy. */
            coolingComplexity: { air: 1.0, inrow: 1.3, rdhx: 1.6, liquid: 2.0, immersion: 2.4 },
            tierComplexity: { 2: 1.0, 3: 1.4, 4: 1.9 },
            redundancyComplexity: { 'n': 1.0, 'n1': 1.2, '2n': 1.6, '2n1': 1.9 },
            /* Max product (immersion x T4 x 2N+1) used to normalize to 0-100. */
            complexityMax: 2.4 * 1.9 * 1.9,
            complexityBands: [
                { min: 75, band: 'Very High' }, { min: 55, band: 'High' },
                { min: 35, band: 'Moderate' }, { min: 0, band: 'Standard' }
            ]
        },
        /* ── A1: provenance sidecar. Keyed by DATA path → { source, asOf, unit?, method? }.
         * The provenance test asserts every economically-material leaf is registered here. */
        sources: {
            'capexDetail': { source: 'Turner & Townsend DCCI 2025 + Cushman & Wakefield DC Cost Guide 2025 (city $/W anchor table) + JLL 2026 escalation; category factors calibrated to the anchor (locMult = perW/4.65) — lineage: capex-calculator inline model, lifted v2.3.0', asOf: '2025', method: 'budgetary estimate-grade; NOT detailed engineering' },
            'capexDetail.costFactors.electrical': { source: 'calculator lineage 1200 $/kW (DCMOC A7 2025 used 1550 for a different model shape — NOT merged; engine detailed model is the shared source from v2.3.0)', asOf: '2025', unit: '$/kW IT' },
            'deepSeaCooling': { source: 'Design basis: 150 MW AI DC deep-sea cooling reference architecture (owner, 2026) — chiller-less primary + hybrid trim backup; seawater properties: TEOS-10/IOC tables at S=35, 5 °C; intake-temp bands: NOAA World Ocean Atlas typical tropical/subtropical profiles; SWAC cost scaling: Makai Ocean Engineering SWAC studies + Hawaii/InterContinental SWAC projects (public figures), HDPE marine pipeline install multipliers 2.5-4x onshore', asOf: '2026', method: 'poster mode reproduces the reference (cp 4.0, rho 1000): 172.5 MW / (4.0*5) = 8.625 m3/s = 31,050 m3/h, 4+1 pumps 2.9 m3/s @ 60 m ≈ 2.0 MW each; accurate mode uses rho 1025 / cp 3985' },
            'refrigerants': { source: 'GWP100 IPCC AR4 (consistent with sitewide published values); ASHRAE 34 safety classes; copIndex: AHRI/manufacturer typical relative cycle efficiency at water-cooled chiller conditions (R-134a=1.00) — estimate-grade; charge/leak: GHG Protocol + EPA GreenChill typical ranges', asOf: '2026', method: 'copIndex and charge/leak are screening estimates, not equipment selections' },
            'energy': { source: 'Lazard LCOE+ 2025 (solar/wind capex+CF ranges), IRENA Renewable Power Generation Costs 2024 (APAC/ID), BNEF BESS pack+BOS 2026 ~$180/kWh installed', asOf: '2026', method: 'screening-grade; not an interconnection/reliability study' },
            'carbon.offsetPrice': { source: 'Voluntary carbon market 2026 blend (nature-based + engineered mid-range); reconciles DCMOC $45 vs legacy $18', asOf: '2026', unit: '$/tCO2e' },
            'capexDetail.space': { source: 'Industry planning rules of thumb: 600mm racks at hot/cold-aisle pitch (Uptime/ASHRAE TC9.9 layout guidance); support-to-white-space ratios by redundancy from published DC space programs (white space typically 40-50% of gross); DLC rows +~8% for in-row CDU + manifolds', asOf: '2026', method: 'screening-grade space program, not an architectural layout' },
            'pueMatrix.inrow': { source: 'Uptime Institute Global Survey 2026 close-coupled cohort', asOf: '2026' },
            'pueMatrix.rdhx': { source: 'Uptime Institute Global Survey 2026 rear-door cohort', asOf: '2026' },
            'markets': { source: 'CBRE Global DC Market 2025 + JLL Outlook 2025 + Cushman & Wakefield 2025 + Synergy Research 2024 (capacity/vacancy/colo/pipeline per market); market-level powerCost from utility filings (PJM, ERCOT, Dominion, IMDA et al.)', asOf: '2026-04', method: 'per-market figures; NOT interchangeable with regions.*.powerKwh macro blends (different denominators)' },
            'regions.US.powerKwh':    { source: 'US EIA industrial electricity + DC PPA blend', asOf: '2026', unit: '$/kWh' },
            'regions.EU.powerKwh':    { source: 'Eurostat non-household electricity (normalized post-crisis)', asOf: '2026', unit: '$/kWh' },
            'regions.APAC.powerKwh':  { source: 'IEA/regional utility filings (blended)', asOf: '2026', unit: '$/kWh' },
            'regions.LATAM.powerKwh': { source: 'Regional utility filings (blended)', asOf: '2026', unit: '$/kWh' },
            'regionsCountry':         { source: 'PLN/EMA/TEPCO/CEA/TNB tariff filings + national statistics', asOf: '2026', unit: 'mixed (see fields)' },
            'currency':               { source: 'ECB / central-bank reference rates', asOf: '2026-04', method: 'spot, USD base' },
            'inflationAnnual':        { source: 'IMF WEO 2026 regional CPI', asOf: '2026', unit: 'fraction/yr' },
            'salaryBenchmarks':       { source: 'Uptime Institute 2026 + AFCOM 2026 + US BLS 2025', asOf: '2026', unit: 'USD/yr, base' },
            'salaryRolesExt':         { source: 'Uptime 2026 + Levels.fyi + AFCOM 2026 role survey', asOf: '2026', unit: 'USD/yr, base' },
            'attritionFactors':       { source: 'Center for American Progress + DataX Connect 2024', asOf: '2024' },
            'pueDefaults':            { source: 'Uptime Global PUE Survey 2026 by cooling architecture', asOf: '2026', unit: 'ratio' },
            'pueMatrix':              { source: 'Uptime Global PUE Survey 2026 (tier x cooling)', asOf: '2026', unit: 'ratio' },
            'capexPerMw':             { source: '451 Research 2026 + JLL DC Cost 2026 + Cushman & Wakefield 2026', asOf: '2026', unit: 'USD/MW raw build' },
            'land':                   { source: 'JLL / CBRE industrial land + shell 2026', asOf: '2026', unit: 'USD/MW' },
            'laborRates':             { source: 'RSMeans + regional construction wage surveys 2026', asOf: '2026', unit: 'USD/hr' },
            'carbon':                 { source: 'IEA 2026 + Ember grid intensity + ICAP carbon prices', asOf: '2026', unit: 'kgCO₂e/kWh, $/tCO₂e' },
            'water':                  { source: 'ASHRAE WUE + regional utility water tariffs 2026', asOf: '2026', unit: 'L/kWh, $/m³' },
            'aiDensity':              { source: 'Uptime + NVIDIA/OCP rack-density guidance 2026', asOf: '2026', unit: 'kW/rack + multipliers' },
            'coolingTypes':           { source: 'ASHRAE TC9.9 liquid-cooling taxonomy', asOf: '2026' },
            'tiers':                  { source: 'Uptime Institute Tier Standard (Topology)', asOf: '2026', unit: 'availability + capex mult' },
            'roles':                  { source: 'Engine role taxonomy', asOf: '2026' },
            'marketViz':              { source: 'Engine UI mapping — maturity/region accent colours + CAGR bands (single source for DC map/cards)', asOf: '2026', method: 'presentation constants; not economically-material' },
            'discountDefaults':       { source: 'Damodaran regional WACC + country risk 2026', asOf: '2026', unit: 'fraction' },
            'mepPctOfCapex':          { source: 'JLL / industry MEP cost share 2026', asOf: '2026', unit: 'fraction of raw capex' },
            'modularPremiumPct':      { source: 'Modular DC vendor bid analysis 2026', asOf: '2026', unit: 'fraction vs stick-built' },
            'coolingClimate':         { source: 'ASHRAE TC9.9 + engine internal model', asOf: '2026', method: 'climate-zone base + ΔT bonus' },
            'contractCostBase':       { source: 'DC O&M contract bid analysis 2026', asOf: '2026', unit: 'USD/yr by scope' },
            'staffingLoadFactor':     { source: 'Industry fully-loaded cost convention', asOf: '2026', unit: 'multiplier' },
            'opexDefaults':           { source: 'Engine model defaults (industry-typical ranges)', asOf: '2026' },
            'capexDefaults':          { source: 'Engine model defaults (industry-typical ranges)', asOf: '2026' },
            'refresh':                { source: 'Typical enterprise IT refresh cycle', asOf: '2026', unit: 'years / fraction' },
            'workforceParams':        { source: 'Engine model tuning', asOf: '2026' },
            'hoursPerYear':           { source: 'Calendar constant (non-leap)', asOf: 'const', unit: 'h/yr' },
            'reliability':            { source: 'IEEE 493 (Gold Book) typical component MTBF/MTTR + Uptime Institute Tier Standard availability targets', asOf: '2026', unit: 'hours (MTBF/MTTR) + availability fraction', method: 'screening-grade RAM inputs; NOT a certified reliability/FMEA study' },
            'site':                   { source: 'DC site-selection factor weighting (power + grid + seismic + talent + tax + carbon + flood + latency + water) — engine heuristic informed by 451/CBRE/Uptime site-selection criteria', asOf: '2026', unit: 'weights (fraction, sum=1) + grade bands', method: 'transparent weighted-factor screen; factor inputs are caller-supplied 0-1 goodness scores' },
            'commissioning':          { source: 'Standard DC commissioning sequence (ASHRAE Guideline 0 / BCxA + Uptime Cx) — L1–L5 levels + IST/SAT/FAT + punchlist; weights are an engine readiness heuristic', asOf: '2026', unit: 'weights (fraction, sum=1) + readiness %', method: 'weighted completion index; NOT a Cx authority sign-off' },
            'asset':                  { source: 'ASHRAE Equipment Life Expectancy + manufacturer service-life data (design lives); health-index weighting is an engine asset-management heuristic (remaining-life + condition + duty)', asOf: '2026', unit: 'years (design life) + weights (fraction, sum=1) + health %', method: 'screening health index; NOT a vibration/thermographic condition survey' },
            'construction':           { source: 'Canonical DC build phase sequence (design→permit→procurement→civil→MEP→commissioning) + typical fast-track overlap factors — engine scheduling heuristic', asOf: '2026', unit: 'months (durations) + overlap fractions', method: 'CPM-style forward pass with per-phase overlap; screening schedule, NOT a resource-loaded programme' },
            'requirements':           { source: 'DC project brief required-field set + workload density/cooling profiles (AI/HPC/cloud/colo/enterprise/edge) — engine intake heuristic informed by Uptime/OCP rack-density guidance', asOf: '2026', unit: 'field list + kW/rack + cooling/tier defaults', method: 'completeness + profile defaults; not a design basis' },
            'architecture':           { source: 'Canonical DC design disciplines (electrical/mechanical/cooling/fire/security/network/building/structural/BMS) + relative design-complexity multipliers by cooling/tier/redundancy — engine heuristic', asOf: '2026', unit: 'discipline list + complexity multipliers → 0-100 index', method: 'normalized complexity screen; NOT a design deliverable' }
        },

        // Human-readable citation list (org, year, url) each table draws from.
        provenance: [
            { org: 'Uptime Institute', year: 2024, topic: 'PUE + workforce', url: 'https://uptimeinstitute.com/resources' },
            { org: 'AFCOM State of the Data Center', year: 2024, topic: 'salaries + staffing', url: 'https://www.afcom.com' },
            { org: 'US Bureau of Labor Statistics', year: 2024, topic: 'occupational wages', url: 'https://www.bls.gov/oes/' },
            { org: 'US EIA', year: 2024, topic: 'electricity prices', url: 'https://www.eia.gov/electricity/' },
            { org: 'Eurostat', year: 2024, topic: 'EU electricity prices', url: 'https://ec.europa.eu/eurostat' },
            { org: '451 Research (S&P Global)', year: 2024, topic: 'capex per MW', url: 'https://www.spglobal.com/marketintelligence/' },
            { org: 'JLL Data Center Report', year: 2024, topic: 'capex + MEP share', url: 'https://www.jll.com/data-centers' },
            { org: 'Cushman & Wakefield', year: 2024, topic: 'global DC cost', url: 'https://www.cushmanwakefield.com' },
            { org: 'IMF World Economic Outlook', year: 2024, topic: 'inflation', url: 'https://www.imf.org/en/Publications/WEO' }
        ]
    };

    /* ====================================================================
     * II. AUTH — session management compatible with auth.js
     *
     * Session format (matches auth.js, see /home/baguspermana7/rz-work/auth.js:159):
     *   { email, tier, role, expires: ISOString }
     *
     * Listens for navbar login/logout via 'rz-auth-change' custom event.
     * ==================================================================== */
    var SESSION_KEY = 'rz_premium_session';
    var SESSION_DAYS = 30;

    // OFFLINE/DEMO fallback only. Real accounts authenticate via Supabase (auth.js) — their passwords
    // live in Supabase (migrated), NEVER in this repo. No real-account secret in source.
    var VALID_USERS = [
        { email: 'demo@resistancezero.com', password: 'demo2026', tier: 'pro', role: 'demo' }
    ];

    /**
     * Validate credentials against the hardcoded user list.
     * @param {string} email Case-insensitive
     * @param {string} pass
     * @returns {object|null} matched user (without password) or null
     */
    function validateLogin(email, pass) {
        if (!email || !pass) return null;
        var normalised = ('' + email).trim().toLowerCase();
        for (var i = 0; i < VALID_USERS.length; i++) {
            var u = VALID_USERS[i];
            if (u.email === normalised && u.password === pass) {
                return { email: u.email, tier: u.tier, role: u.role };
            }
        }
        return null;
    }

    /**
     * Read the active session from localStorage. Accepts both auth.js
     * format ({expires:ISOString}) and the legacy IIFE format ({exp:number}).
     * @returns {object|null} session or null if missing/expired
     */
    function getSession() {
        try {
            var raw = root.localStorage && root.localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            var s = JSON.parse(raw);
            if (!s) return null;
            var nowMs = Date.now();
            var expValid = false;
            if (s.expires) {
                expValid = new Date(s.expires).getTime() > nowMs;
            } else if (s.exp) {
                expValid = s.exp > nowMs;
            }
            if (!expValid) {
                try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {}
                return null;
            }
            return { email: s.email, tier: s.tier || 'pro', role: s.role || 'admin', expires: s.expires };
        } catch (e) { return null; }
    }

    /**
     * Write a session with 30-day expiry in auth.js-compatible format.
     * Does NOT dispatch rz-auth-change — caller decides via dispatchAuthChange.
     */
    function setSession(email, tier, role) {
        var expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
        var payload = { email: email, tier: tier || 'pro', role: role || 'admin', expires: expires };
        try { root.localStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (e) {}
        return payload;
    }

    /** Clear the session and emit a 'logout' rz-auth-change event. */
    function logout() {
        try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {}
        dispatchAuthChange('logout', {});
    }

    /** Emit a 'rz-auth-change' CustomEvent. */
    function dispatchAuthChange(action, detail) {
        try {
            detail = detail || {};
            detail.action = action;
            root.dispatchEvent(new root.CustomEvent('rz-auth-change', { detail: detail }));
        } catch (e) {}
    }

    /** Subscribe to 'rz-auth-change' events. Returns an unsubscribe function. */
    function onAuthChange(fn) {
        var handler = function (e) {
            if (!e || !e.detail) return;
            try { fn(e.detail.action, e.detail); } catch (err) {}
        };
        root.addEventListener('rz-auth-change', handler);
        return function () { root.removeEventListener('rz-auth-change', handler); };
    }

    /* ====================================================================
     * III. FORMAT — display formatters
     * ==================================================================== */
    var CURRENCY_SYMBOL = { USD: '$', EUR: '€', IDR: 'Rp', SGD: 'S$', GBP: '£' };

    function formatCurrency(n, region) {
        if (n == null || isNaN(n)) return '—';
        var rdata = (region && DATA.regions[region.toUpperCase()]) || DATA.regions.US;
        var sym = CURRENCY_SYMBOL[rdata.currency] || '$';
        var abs = Math.abs(n);
        if (abs >= 1e9) return sym + (n / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return sym + (n / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return sym + Math.round(n / 1e3) + 'K';
        return sym + Math.round(n);
    }

    function formatPercent(n, decimals) {
        if (n == null || isNaN(n)) return '—';
        return (n * 100).toFixed(decimals == null ? 1 : decimals) + '%';
    }

    function formatNumber(n) {
        if (n == null || isNaN(n)) return '—';
        return Math.round(n).toLocaleString('en-US');
    }

    function formatWeeks(n) {
        if (n == null || isNaN(n) || n <= 0) return '—';
        if (n < 1) return Math.round(n * 7) + ' d';
        if (n < 52) return Math.round(n) + ' wk';
        return (n / 52).toFixed(1) + ' yr';
    }

    function formatMonths(n) {
        if (n == null || isNaN(n) || n <= 0) return '—';
        if (n < 12) return Math.round(n) + ' mo';
        return (n / 12).toFixed(1) + ' yr';
    }

    function formatYmd(d) {
        if (!d) return '';
        var date = (d instanceof Date) ? d : new Date(d);
        if (isNaN(date.getTime())) return '';
        var pad = function (x) { return x < 10 ? '0' + x : '' + x; };
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    /* ====================================================================
     * IV. EVENTS — generic custom-event bus (auth events use 'rz-auth-change')
     * ==================================================================== */
    function dispatchEvent(action, detail) {
        try {
            root.dispatchEvent(new root.CustomEvent('rz-' + action, { detail: detail || {} }));
        } catch (e) {}
    }

    function onEvent(action, fn) {
        var handler = function (e) { try { fn(e && e.detail); } catch (err) {} };
        root.addEventListener('rz-' + action, handler);
        return function () { root.removeEventListener('rz-' + action, handler); };
    }

    function offEvent(action, fn) {
        // For symmetry; callers should prefer the unsubscribe function returned by onEvent().
        // This is a no-op for anonymous handlers; documented limitation.
    }

    /* ====================================================================
     * Engine assembly
     * ==================================================================== */
    var RZEngine = {
        data: DATA,

        auth: {
            VALID_USERS: VALID_USERS.map(function (u) { return { email: u.email, tier: u.tier, role: u.role }; }),
            validateLogin: validateLogin,
            getSession: getSession,
            setSession: setSession,
            logout: logout,
            dispatchAuthChange: dispatchAuthChange,
            onAuthChange: onAuthChange
        },

        format: {
            currency: formatCurrency,
            percent: formatPercent,
            number: formatNumber,
            weeks: formatWeeks,
            months: formatMonths,
            ymd: formatYmd
        },

        events: {
            dispatch: dispatchEvent,
            on: onEvent,
            off: offEvent
        },

        // Math models — domain-specific calculations sharing engine constants.
        // S2 ships workforce + roi + forecast. capex/opex/tco/pue follow in S4/S6.
        models: {
            /* ══ v2.3.0 — cooling physics: deep-sea water cooling + refrigerant impact ══ */
            cooling: {
                /** Intake temperature (°C) for a given depth from the sourced bands. */
                intakeTempForDepth: function (depthM) {
                    var bands = DATA.deepSeaCooling.seawater.intakeTempByDepth;
                    for (var i = 0; i < bands.length; i++) if (depthM >= bands[i].minDepthM) return bands[i].tC;
                    return bands[bands.length - 1].tC;
                },
                /**
                 * Chiller-less deep-sea water cooling design (3-loop: rack CDU → facility water →
                 * seawater via titanium PHE; hybrid trim-chiller backup). Design basis: the 150 MW
                 * reference architecture — mode 'poster' reproduces its numbers exactly (cp 4.0,
                 * ρ 1000); default 'accurate' uses real seawater properties. Budgetary
                 * estimate-grade, NOT detailed marine engineering.
                 * @param {object} a { itLoadMw, pueTarget=1.15, deltaTC=5, depthM=900, pipelineKm=3,
                 *   intakeTempC?, trimFraction?, region='US', mode='accurate' }
                 */
                deepSea: function (a) {
                    a = a || {};
                    var D = DATA.deepSeaCooling, SW = D.seawater;
                    var it = Math.max(0.1, a.itLoadMw || 10);
                    var pueTarget = a.pueTarget || 1.15;
                    var dT = a.deltaTC || SW.designDeltaTC;
                    var depth = a.depthM || 900;
                    var km = a.pipelineKm != null ? a.pipelineKm : 3;
                    var poster = a.mode === 'poster';
                    var rho = poster ? SW.posterRhoKgM3 : SW.rhoKgM3;
                    var cp = poster ? SW.posterCpJKgK : SW.cpJKgK;
                    var region = a.region || 'US';

                    var heatMw = it * pueTarget;                      // total heat rejected (poster convention)
                    var kgps = (heatMw * 1e6) / (cp * dT);
                    var m3s = kgps / rho;
                    var m3h = m3s * 3600;

                    var intakeT = a.intakeTempC != null ? a.intakeTempC : this.intakeTempForDepth(depth);
                    var returnT = intakeT + dT;

                    /* pumps: N+1; duty count from per-pump ceiling; head = static + friction·km.
                     * mode:'poster' reproduces the reference spec: rated 2.9 m3/s @ 60 m,
                     * duty = hydraulic minimum + 1 design-margin pump (4 for 150 MW). */
                    var P = D.pump;
                    var duty, perPumpM3s, headM, perPumpKw, swPumpMw;
                    if (poster) {
                        var PP = P.poster;
                        duty = Math.ceil(m3s / PP.ratedPerPumpM3s) + PP.dutyMargin;
                        perPumpM3s = PP.ratedPerPumpM3s;
                        headM = PP.headM;
                        perPumpKw = (rho * 9.81 * perPumpM3s * headM) / PP.effTotal / 1000;
                        /* facility power draw follows the hydraulic REQUIREMENT, not rated sum */
                        swPumpMw = ((rho * 9.81 * m3s * headM) / PP.effTotal) / 1e6;
                    } else {
                        duty = Math.max(2, Math.ceil(m3s / P.maxPerPumpM3s));
                        perPumpM3s = m3s / duty;
                        headM = P.baseStaticHeadM + P.frictionHeadMPerKm * km;
                        var eff = P.effPump * P.effMotor * P.effVfd;
                        perPumpKw = (rho * 9.81 * perPumpM3s * headM) / eff / 1000;
                        swPumpMw = (perPumpKw * duty) / 1000;
                    }
                    var fwPumpMw = swPumpMw * P.fwLoopPowerFraction;
                    var cduMw = it * P.cduPowerFraction * 0.1;        // CDU pumps ≈ 1% of IT
                    var coolingMw = swPumpMw + fwPumpMw + cduMw;
                    var pPUE = coolingMw / it;
                    var pue = 1 + pPUE + D.elecLossFraction;

                    /* capex */
                    var pipeBands = D.pipeline.costPerKmByFlow, perKmBase = pipeBands[pipeBands.length - 1].usd;
                    for (var i = 0; i < pipeBands.length; i++) if (m3s <= pipeBands[i].maxM3s) { perKmBase = pipeBands[i].usd; break; }
                    var pipeline = perKmBase * km * D.pipeline.lines * D.pipeline.marineInstallMult;
                    var intakeStructure = D.pipeline.intakeStructureCost + D.pipeline.diffuserCost;
                    var phe = heatMw * D.hx.costPerMwth * 2;          // N+1 parallel → ~2× duty bank
                    var pumpStation = duty * 1.25 * perPumpKw * 900;  // (duty+standby)·$/kW installed
                    var filtration = m3h * D.filtration.costPerM3h;
                    var trimFraction = a.trimFraction != null ? a.trimFraction : D.trimChiller.capacityFraction;
                    var trimChillers = heatMw * trimFraction * D.trimChiller.costPerMwth;
                    var controls = D.controls.costFixed;
                    var marineSub = pipeline + intakeStructure;
                    var sub = marineSub + phe + pumpStation + filtration + trimChillers + controls;
                    var contingency = sub * D.contingencyPct;
                    var capexTotal = sub + contingency;

                    /* baseline comparison: what the same MW of liquid-cooled heat rejection costs */
                    var baselinePerMw = (DATA.capexPerMw.liquidCooledTier3 || 13000000) * 0.22; // cooling share of build
                    var baselineCoolingCapex = it * baselinePerMw;

                    /* opex */
                    var lf = D.opex.pumpLoadFactor;
                    var pumpMwhYr = coolingMw * DATA.hoursPerYear * lf;
                    var powerPrice = (DATA.regions[region] && DATA.regions[region].powerKwh) ||
                                     (DATA.regionsCountry[region] && DATA.regionsCountry[region].powerKwh) || 0.09;
                    var pumpCostYr = pumpMwhYr * 1000 * powerPrice;
                    var maintenance = marineSub * D.opex.marineMaintPctOfMarineCapex;
                    var chlorination = m3h * D.opex.chlorinationPerM3hYr;
                    var trimMwhYr = heatMw * trimFraction / 4.5 * D.trimChiller.hoursPerYear; // COP≈4.5 trim duty
                    var opexYr = pumpCostYr + maintenance + chlorination + D.opex.rovInspectionYr + trimMwhYr * 1000 * powerPrice;

                    var warnings = [];
                    if (depth < 500) warnings.push('Intake shallower than 500 m: seawater too warm for fully chiller-less operation — expect heavy trim-chiller duty.');
                    if (km > 8) warnings.push('Pipeline over 8 km: marine capex and pumping head dominate — verify site bathymetry economics.');
                    if (it < 5) warnings.push('Below ~5 MW IT the fixed marine works make deep-sea cooling uneconomical vs conventional.');

                    return {
                        mode: poster ? 'poster' : 'accurate',
                        heatRejectedMw: Math.round(heatMw * 100) / 100,
                        flow: { kgps: Math.round(kgps), m3s: Math.round(m3s * 1000) / 1000, m3h: Math.round(m3h) },
                        intakeTempC: intakeT, returnTempC: returnT, deltaTC: dT, depthM: depth,
                        pumps: { duty: duty, standby: 1, perPumpM3s: Math.round(perPumpM3s * 100) / 100,
                                 headM: headM, perPumpKw: Math.round(perPumpKw), totalMw: Math.round(swPumpMw * 100) / 100 },
                        fwPumpMw: Math.round(fwPumpMw * 100) / 100, cduMw: Math.round(cduMw * 100) / 100,
                        coolingMw: Math.round(coolingMw * 100) / 100,
                        pPUE: Math.round(pPUE * 1000) / 1000,
                        pue: Math.round(pue * 1000) / 1000,
                        wue: 0,
                        capex: { pipeline: Math.round(pipeline), intakeStructure: Math.round(intakeStructure),
                                 phe: Math.round(phe), pumpStation: Math.round(pumpStation),
                                 filtration: Math.round(filtration), trimChillers: Math.round(trimChillers),
                                 controls: controls, contingency: Math.round(contingency),
                                 total: Math.round(capexTotal), perMw: Math.round(capexTotal / it),
                                 vsBaselineCooling: Math.round(capexTotal - baselineCoolingCapex) },
                        opex: { pumpMwhYr: Math.round(pumpMwhYr), pumpCostYr: Math.round(pumpCostYr),
                                maintenance: Math.round(maintenance), chlorination: Math.round(chlorination),
                                rovInspection: D.opex.rovInspectionYr, trimChillerMwhYr: Math.round(trimMwhYr),
                                totalYr: Math.round(opexYr) },
                        env: { deltaTCompliant: dT <= SW.deltaTEnvMaxC,
                               note: 'Low-entrainment intake + multiport diffuser outfall; controlled ΔT ≤ ' + SW.deltaTEnvMaxC + ' °C.' },
                        redundancy: D.redundancy,
                        warnings: warnings
                    };
                },
                /**
                 * Refrigerant impact for a chiller/CRAC application: efficiency vs the R-134a
                 * baseline, Scope-1 leakage carbon, safety class + mitigation capex.
                 * @param {string} key DATA.refrigerants key  @param {object} c { chillerMwth,
                 *   region='US', hoursPerYear?, loadFactor=0.5, baseCop? }
                 */
                refrigerant: function (key, c) {
                    c = c || {};
                    var R = DATA.refrigerants[key];
                    if (!R) return null;
                    var base = DATA.refrigerants[DATA.refrigerantBaseline];
                    var mwth = c.chillerMwth || 1;
                    var cop = (c.baseCop || DATA.chillerBaseCopWaterCooled) * R.copIndex;
                    var hrs = c.hoursPerYear || DATA.hoursPerYear;
                    var lf = c.loadFactor != null ? c.loadFactor : 0.5;
                    var mwhYr = (mwth * lf * hrs) / cop;
                    var mwhBaseline = (mwth * lf * hrs) / ((c.baseCop || DATA.chillerBaseCopWaterCooled) * base.copIndex);
                    var chargeKg = mwth * 1000 * R.chargeKgPerKwth;
                    var leakKgYr = chargeKg * R.leakPctYr;
                    var tco2eYr = (leakKgYr * R.gwp) / 1000;
                    var region = c.region || 'US';
                    var cprice = DATA.carbon.carbonPrice[region] != null ? DATA.carbon.carbonPrice[region] : DATA.carbon.carbonPrice.US;
                    var flags = [];
                    if (R.gwp > 700) flags.push('US AIM Act: GWP > 700 restricted in new equipment from 2025.');
                    if (R.gwp > 150) flags.push('EU F-Gas: GWP > 150 phased out for new chillers (2027-2032 schedule).');
                    if (R.safety === 'A2L') flags.push('A2L mildly flammable: leak detection + ventilation per ASHRAE 15 / ISO 5149.');
                    if (R.safety === 'B2L') flags.push('B2L toxic (ammonia): machine-room isolation, occupied-space charge limits (IIAR-2 / EN 378).');
                    if (R.safety === 'A3') flags.push('A3 highly flammable: strict charge limits; outdoor/rooftop packaged units.');
                    return {
                        key: key, label: R.label, gwp: R.gwp, safety: R.safety,
                        cop: Math.round(cop * 100) / 100, copIndex: R.copIndex,
                        annualMwh: Math.round(mwhYr),
                        energyDeltaVsBaselinePct: Math.round((mwhYr / mwhBaseline - 1) * 1000) / 10,
                        chargeKg: Math.round(chargeKg), leakKgYr: Math.round(leakKgYr * 10) / 10,
                        tco2eYr: Math.round(tco2eYr * 100) / 100,
                        carbonCostYr: Math.round(tco2eYr * cprice),
                        capexMult: R.capexMult, complianceFlags: flags, note: R.note
                    };
                }
            },

            /* ══ v2.3.0 — screening-grade on-site renewables + BESS ══ */
            energy: {
                /** Simple LCOE ($/MWh): (capex·CRF + opex) / annual MWh. Screening-grade. */
                lcoe: function (tech, region, opts) {
                    opts = opts || {};
                    var E = DATA.energy[tech];
                    if (!E) return null;
                    var capexPerMw = (E.capexPerMwp && (E.capexPerMwp[region] || E.capexPerMwp.US)) || E.capexPerMw;
                    var cf = (E.cfByRegion && (E.cfByRegion[region] != null ? E.cfByRegion[region] : E.cfByRegion.US)) || 0;
                    if (!cf) return null;
                    var r = opts.wacc != null ? opts.wacc : (DATA.discountDefaults[region] || DATA.discountDefaults.global);
                    var n = E.lifeYears;
                    var crf = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                    var mwhYr = 8760 * cf;
                    return Math.round(((capexPerMw * crf + capexPerMw * E.opexPctYr) / mwhYr) * 100) / 100;
                },
                /**
                 * Hybrid coverage screen for a DC: how much of the IT-load energy an on-site
                 * solar + wind + BESS mix covers. Deterministic day/night simplification —
                 * screening-level, NOT an interconnection or reliability study.
                 */
                hybridScreen: function (a) {
                    a = a || {};
                    var region = a.region || 'US';
                    var loadMwh = (a.itLoadMw || 1) * 8760;
                    var sCf = DATA.energy.solar.cfByRegion[region] != null ? DATA.energy.solar.cfByRegion[region] : DATA.energy.solar.cfByRegion.US;
                    var wCf = DATA.energy.windOnshore.cfByRegion[region] != null ? DATA.energy.windOnshore.cfByRegion[region] : DATA.energy.windOnshore.cfByRegion.US;
                    var solarMwh = (a.solarMwp || 0) * 8760 * sCf;
                    var windMwh = (a.windMw || 0) * 8760 * wCf;
                    var dayFrac = DATA.energy.solarDaylightFraction;
                    var solarDirect = Math.min(solarMwh, loadMwh * dayFrac);
                    var solarSurplus = Math.max(0, solarMwh - solarDirect);
                    var bessShift = Math.min(solarSurplus, (a.bessMwh || 0) * 300 * DATA.energy.bess.roundtripEff / 1000 * 1000);
                    var windDirect = Math.min(windMwh, Math.max(0, loadMwh - solarDirect - bessShift));
                    var covered = Math.min(loadMwh, solarDirect + bessShift + windDirect);
                    var gen = solarMwh + windMwh;
                    var lcoeS = this.lcoe('solar', region), lcoeW = this.lcoe('windOnshore', region);
                    var blended = gen > 0 ? Math.round((((solarMwh * (lcoeS || 0)) + (windMwh * (lcoeW || 0))) / gen) * 100) / 100 : null;
                    var gf = DATA.carbon.gridFactor[region] != null ? DATA.carbon.gridFactor[region] : DATA.carbon.gridFactor.US;
                    return {
                        coverageFraction: Math.round((covered / loadMwh) * 1000) / 1000,
                        coveredMwhYr: Math.round(covered), curtailedMwhYr: Math.round(Math.max(0, gen - covered)),
                        gridResidualMwhYr: Math.round(loadMwh - covered),
                        blendedLcoe: blended,
                        carbonOffsetTonnesYr: Math.round(covered * gf),
                        landHa: Math.round((a.solarMwp || 0) * DATA.energy.solar.landHaPerMwp * 10) / 10,
                        method: 'screening-level day/night simplification — not an interconnection or reliability study'
                    };
                }
            },
            /* ── Part F: DC market intelligence helpers over DATA.markets ── */
            market: {
                /** All distinct region labels in DATA.markets (sorted). */
                regions: function () {
                    var seen = {};
                    Object.keys(DATA.markets).forEach(function (k) { seen[DATA.markets[k].region] = 1; });
                    return Object.keys(seen).sort();
                },
                /**
                 * Capacity totals across DATA.markets, optionally one region.
                 * Returns { count, operational, construction, planned, pipelineRatio } —
                 * pipelineRatio = (construction + planned) / operational (growth pressure, dimensionless).
                 */
                summary: function (region) {
                    var out = { count: 0, operational: 0, construction: 0, planned: 0, pipelineRatio: null };
                    Object.keys(DATA.markets).forEach(function (k) {
                        var mkt = DATA.markets[k];
                        if (region && mkt.region !== region) return;
                        out.count += 1;
                        out.operational += mkt.operational;
                        out.construction += mkt.construction;
                        out.planned += mkt.planned;
                    });
                    if (out.operational > 0) out.pipelineRatio = (out.construction + out.planned) / out.operational;
                    return out;
                },
                /** Accent colour for a maturity label (established/growing/emerging) → DATA.marketViz. */
                colorByMaturity: function (maturity) {
                    var v = DATA.marketViz;
                    return (v.maturityColors && v.maturityColors[maturity]) || v.fallback;
                },
                /** Accent colour for a region label → DATA.marketViz. */
                colorByRegion: function (region) {
                    var v = DATA.marketViz;
                    return (v.regionColors && v.regionColors[region]) || v.fallback;
                },
                /** CAGR band label ('high' ≥20% / 'mid' ≥10% / 'low') for a fractional CAGR. */
                cagrBand: function (cagr) {
                    var v = DATA.marketViz;
                    if (!(typeof cagr === 'number')) return 'low';
                    return cagr >= v.cagrHigh ? 'high' : cagr >= v.cagrMid ? 'mid' : 'low';
                }
            },
            workforce: {
                /**
                 * Annual hires required to close the staffing gap by target year, including
                 * replacement of attrition losses.
                 * UNIT CONVENTION (A5-48): `attritionRate` is WHOLE-PERCENT (25 = 25%), matching every
                 * workforce fn here. When null/undefined it defaults to
                 * DATA.attritionFactors.voluntaryAttritionAvg (a FRACTION, ×100 here). Explicit 0 = no attrition.
                 */
                annualHiresRequired: function (currentStaff, targetStaff, attritionRate, yearsToTarget) {
                    var gap = Math.max(0, (targetStaff || 0) - (currentStaff || 0));
                    var years = Math.max(1, yearsToTarget || 1);
                    var pct = (attritionRate == null ? DATA.attritionFactors.voluntaryAttritionAvg * 100 : attritionRate);
                    var attrition = pct / 100;
                    var attritionLossPerYear = (currentStaff || 0) * attrition;
                    return Math.ceil((gap + attritionLossPerYear * years) / years);
                },

                /**
                 * Attrition-aware hiring plan on a GROWING base with an optional annual hiring ceiling and
                 * ramp (A6-68). Returns { perYear:[{year,base,leavers,hires,capped}], totalHires }.
                 * opts: { attritionRate (whole-%), ceiling (max hires/yr), ramp (0–1 first-year fraction) }
                 */
                hiringPlan: function (currentStaff, targetStaff, yearsToTarget, opts) {
                    opts = opts || {};
                    var years = Math.max(1, yearsToTarget || 1);
                    var pct = (opts.attritionRate == null ? DATA.attritionFactors.voluntaryAttritionAvg * 100 : opts.attritionRate) / 100;
                    var ceiling = opts.ceiling != null ? opts.ceiling : Infinity;
                    var base = currentStaff || 0;
                    var target = targetStaff || 0;
                    var perYear = [], totalHires = 0;
                    for (var y = 1; y <= years; y++) {
                        var leavers = base * pct;
                        var growthNeed = Math.max(0, (target - base) / (years - y + 1));
                        var want = leavers + growthNeed;
                        var rampFactor = (y === 1 && opts.ramp != null) ? opts.ramp : 1;
                        var hires = Math.min(ceiling, want) * rampFactor;
                        var capped = want > ceiling;
                        base = base + hires - leavers;
                        totalHires += hires;
                        perYear.push({ year: y, base: Math.round(base), leavers: Math.round(leavers), hires: Math.ceil(hires), capped: capped });
                    }
                    return { perYear: perYear, totalHires: Math.ceil(totalHires) };
                },

                /**
                 * Annual cost of attrition (replacing voluntary leavers).
                 * Uses RZEngine.data.attritionFactors.replacementCostMult by default (213%).
                 * `attritionRate` is WHOLE-PERCENT (A5-48).
                 */
                attritionCost: function (staff, attritionRate, avgSalary, replacementMult) {
                    var mult = replacementMult || DATA.attritionFactors.replacementCostMult;
                    return Math.round((staff || 0) * ((attritionRate || 0) / 100) * (avgSalary || 0) * mult);
                },

                /**
                 * Role-weighted attrition cost (A6-66): senior roles cost more to replace. (A5-48 whole-%.)
                 * roles: [{ count, salary, replacementMult? }]. Returns total $ across roles.
                 */
                attritionCostWeighted: function (attritionRate, roles) {
                    if (!Array.isArray(roles)) return 0;
                    var rate = (attritionRate || 0) / 100;
                    var def = DATA.attritionFactors.replacementCostMult;
                    return Math.round(roles.reduce(function (sum, r) {
                        var mult = r.replacementMult != null ? r.replacementMult : def;
                        return sum + (r.count || 0) * rate * (r.salary || 0) * mult;
                    }, 0));
                },

                /**
                 * 0.0–1.0 fit score for a strategy given workforce mix.
                 * `mix.phys` and `mix.noc` should sum to 1.0.
                 */
                strategyFitScore: function (strategy, mix) {
                    if (!strategy || !mix) return 0;
                    var wp = DATA.workforceParams;
                    var physScore = strategy.ph ? wp.strategyOnWeight : wp.strategyOffWeight;
                    var nocScore = strategy.nc ? wp.strategyOnWeight : wp.strategyOffWeight;
                    return Math.min(1.0, physScore * (mix.phys || 0.5) + nocScore * (mix.noc || 0.5));
                },

                /**
                 * Cumulative hires over a horizon, applying a retention factor.
                 * `retentionFactor` defaults to RZEngine.data.attritionFactors.apprenticeRetention.
                 */
                cumulativeHires: function (annualHires, years, retentionFactor) {
                    var retain = retentionFactor == null ? DATA.attritionFactors.apprenticeRetention : retentionFactor;
                    return Math.round((annualHires || 0) * (years || 0) * retain);
                },

                /**
                 * Per-cohort compounding retention (A6-67): each year's hire cohort decays by (1-attrition)
                 * for every subsequent year, so surviving headcount < flat retention estimate.
                 * `retentionPerYear` defaults to apprenticeRetention. Returns surviving headcount after `years`.
                 */
                cumulativeHiresCompounded: function (annualHires, years, retentionPerYear) {
                    var retain = retentionPerYear == null ? DATA.attritionFactors.apprenticeRetention : retentionPerYear;
                    var surviving = 0;
                    for (var cohort = 1; cohort <= (years || 0); cohort++) {
                        var yearsElapsed = (years || 0) - cohort;   // this cohort has been retained this long
                        surviving += (annualHires || 0) * Math.pow(retain, yearsElapsed);
                    }
                    return Math.round(surviving);
                },

                /** Years required to close gap at the projected effective hire rate. */
                yearsToCloseGap: function (staffGap, annualHires, strategyCoverage) {
                    var floor = DATA.workforceParams.coverageFloor;
                    var effective = (annualHires || 0) * Math.max(floor, strategyCoverage || floor);
                    if (!effective || !staffGap || staffGap <= 0) return 0;
                    return Math.ceil(staffGap / effective);
                }
            },

            roi: {
                /** Payback period in years. Returns Infinity if never recovered. */
                paybackPeriod: function (initialCost, annualBenefit, annualCost) {
                    var net = (annualBenefit || 0) - (annualCost || 0);
                    if (net <= 0) return Infinity;
                    return (initialCost || 0) / net;
                },

                /** Net present value of cashflows array (year 0 = first element). */
                npv: function (cashflows, discountRate) {
                    if (!Array.isArray(cashflows)) return 0;
                    var r = discountRate || 0;
                    return cashflows.reduce(function (acc, cf, t) {
                        return acc + cf / Math.pow(1 + r, t);
                    }, 0);
                },

                /** IRR via bisection. Returns null if no root in [-0.99, 10]. */
                irr: function (cashflows, guess) {
                    if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
                    var npv = function (r) {
                        return cashflows.reduce(function (a, cf, t) { return a + cf / Math.pow(1 + r, t); }, 0);
                    };
                    var dnpv = function (r) {
                        return cashflows.reduce(function (a, cf, t) { return a - t * cf / Math.pow(1 + r, t + 1); }, 0);
                    };
                    // A6-60: Newton from the caller's guess (honored), robust for multi-sign-change series.
                    var r = (guess != null ? guess : 0.1);
                    for (var k = 0; k < 40; k++) {
                        var f = npv(r), d = dnpv(r);
                        if (Math.abs(f) < 1e-7) return r;
                        if (!isFinite(d) || Math.abs(d) < 1e-12) break;
                        var step = f / d;
                        r = r - step;
                        if (r <= -0.999) { r = -0.999; }
                        if (Math.abs(step) < 1e-9) return (Math.abs(npv(r)) < 1e-4) ? r : bracket();
                    }
                    return bracket();
                    // Bisection fallback over [-0.99, 10] when Newton fails to converge.
                    function bracket() {
                        var lo = -0.99, hi = 10, fLo = npv(lo), fHi = npv(hi);
                        if (fLo * fHi > 0) return null;
                        for (var i = 0; i < 100; i++) {
                            var mid = (lo + hi) / 2, fMid = npv(mid);
                            if (Math.abs(fMid) < 1e-6) return mid;
                            if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
                        }
                        return (lo + hi) / 2;
                    }
                },

                /** NPV using the regional default WACC (A6-59). region → DATA.discountDefaults[region]. */
                npvAuto: function (cashflows, region) {
                    var code = (region || 'global').toUpperCase();
                    var rate = DATA.discountDefaults[code] != null ? DATA.discountDefaults[code]
                        : (DATA.discountDefaults[region] != null ? DATA.discountDefaults[region] : DATA.discountDefaults.global);
                    return RZEngine.models.roi.npv(cashflows, rate);
                },

                /**
                 * Discounted payback period in years (fractional). Returns Infinity if never recovered
                 * within the horizon. cashflows[0] is the initial outlay (negative). (A6-61)
                 */
                discountedPayback: function (cashflows, discountRate) {
                    if (!Array.isArray(cashflows) || cashflows.length < 2) return Infinity;
                    var r = discountRate || 0, cum = 0, prev = 0;
                    for (var t = 0; t < cashflows.length; t++) {
                        var disc = cashflows[t] / Math.pow(1 + r, t);
                        prev = cum; cum += disc;
                        if (cum >= 0 && t > 0) {
                            // linear-interpolate the fractional year within period t
                            var needed = -prev;
                            return (t - 1) + (disc !== 0 ? needed / disc : 0);
                        }
                    }
                    return Infinity;
                }
            },

            forecast: {
                /** Future value after `years` of compounding at `ratePct` (0.025 = 2.5%/yr). */
                compoundGrowth: function (base, ratePct, years) {
                    return (base || 0) * Math.pow(1 + (ratePct || 0), years || 0);
                },

                /**
                 * Simple linear regression on [{x, y}, ...] points.
                 * Returns {slope, intercept, predict(x)}.
                 */
                linearTrend: function (points) {
                    if (!Array.isArray(points) || points.length < 2) return { slope: 0, intercept: 0, r2: 0, stdErr: 0, predict: function () { return 0; } };
                    var n = points.length, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
                    for (var i = 0; i < n; i++) {
                        sx += points[i].x; sy += points[i].y;
                        sxy += points[i].x * points[i].y;
                        sxx += points[i].x * points[i].x;
                        syy += points[i].y * points[i].y;
                    }
                    var denom = (n * sxx - sx * sx);
                    var slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
                    var intercept = (sy - slope * sx) / n;
                    // A6-62: R² + residual standard error for a confidence band.
                    var ssTot = syy - (sy * sy) / n;
                    var ssRes = 0;
                    for (var j = 0; j < n; j++) { var e = points[j].y - (slope * points[j].x + intercept); ssRes += e * e; }
                    var r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : (ssRes === 0 ? 1 : 0);
                    var stdErr = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
                    return {
                        slope: slope,
                        intercept: intercept,
                        r2: r2,
                        stdErr: stdErr,
                        predict: function (x) { return slope * x + intercept; },
                        // ~95% band (±1.96σ) around the point prediction
                        band: function (x) { var y = slope * x + intercept; var m = 1.96 * stdErr; return { lo: y - m, mid: y, hi: y + m }; }
                    };
                },

                /**
                 * Project a value year-by-year. Returns array of {year, value} from startYear to endYear.
                 * A6-46: pass opts.useInflation + opts.region to compound the nominal (real+inflation) rate.
                 */
                projectByYear: function (startVal, ratePct, startYear, endYear, opts) {
                    opts = opts || {};
                    var infl = 0;
                    if (opts.useInflation) {
                        var code = (opts.region || 'US').toUpperCase();
                        infl = DATA.inflationAnnual[code] != null ? DATA.inflationAnnual[code] : DATA.inflationAnnual.US;
                    }
                    var effRate = (ratePct || 0) + infl;
                    var out = [];
                    var v = startVal || 0;
                    for (var y = startYear; y <= endYear; y++) {
                        out.push({ year: y, value: Math.round(v) });
                        v = v * (1 + effRate);
                    }
                    return out;
                },

                /**
                 * Low/base/high scenario bands (A6-63). rates: {low, base, high} annual fractions.
                 * Returns array of {year, low, base, high}.
                 */
                scenarioBands: function (startVal, rates, startYear, endYear) {
                    rates = rates || {};
                    var lo = rates.low != null ? rates.low : 0.0,
                        bs = rates.base != null ? rates.base : 0.05,
                        hi = rates.high != null ? rates.high : 0.12;
                    var out = [], vlo = startVal || 0, vbs = startVal || 0, vhi = startVal || 0;
                    for (var y = startYear; y <= endYear; y++) {
                        out.push({ year: y, low: Math.round(vlo), base: Math.round(vbs), high: Math.round(vhi) });
                        vlo *= (1 + lo); vbs *= (1 + bs); vhi *= (1 + hi);
                    }
                    return out;
                }
            },

            capex: {

                /**
                 * v2.3.0 — the DETAILED budgetary capex model (lineage: capex-calculator.html
                 * inline engine; golden-parity locked by tools/fixtures/capex-golden.json).
                 * All constants live in DATA.capexDetail. Exact math preserved — including the
                 * legacy energy-rate quirk (rate keyed on the DISPLAY region value, which never
                 * matches 'sea'/'india'/'usa', so it lands on the 0.12 fallback; documented,
                 * fix = deliberate future reconciliation).
                 * @param {object} inp mirrors the calculator's inputs (itLoadKw, rackType,
                 *   coolingType, redundancy, fuelHours, buildingType, seismicZone, fireType,
                 *   alarmType, upsType, genType, location, city, advanced:{...}|null,
                 *   deepSea:{...}|null, refrigerant?)
                 */
                detailed: function (inp) {
                    inp = inp || {};
                    var CD = DATA.capexDetail;
                    var itLoad = inp.itLoadKw || 1000;
                    var rackType = inp.rackType || 'standard';
                    var coolingType = inp.coolingType || 'air';
                    var redundancy = inp.redundancy || 'n1';
                    var fuelHours = inp.fuelHours || 48;
                    var buildingType = inp.buildingType || 'purpose';
                    var seismicZone = inp.seismicZone || 'zone2';   /* page DOM default */
                    var fireType = inp.fireType || 'novec';
                    var alarmType = inp.alarmType || 'addressable';
                    var upsType = inp.upsType || 'modular';
                    var genType = inp.genType || 'diesel';
                    var location = inp.location || 'americas';
                    var adv = inp.advanced || null;

                    var redMult = CD.redundancyMult[redundancy];
                    var coolMult = CD.coolingMult[coolingType] || 1.0;
                    var rackMult = CD.rackMult[rackType];
                    var buildMult = CD.buildingMult[buildingType];
                    var seismicMult = CD.seismicMult[seismicZone];
                    var fireSupMult = CD.fireSuppressionMult[fireType];
                    var alarmMult = CD.fireAlarmMult[alarmType];
                    var upsM = CD.upsMult[upsType];
                    var genM = CD.genMult[genType];
                    var regionDefault = CD.regionGroupDefaults[location] || CD.regionGroupDefaults.americas;
                    var locMult = regionDefault.multiplier;
                    var effectiveRegion = regionDefault.internalRegion;
                    var fuelMult = 1 + (fuelHours - 24) * CD.fuelMultPerHourOver24;

                    var cityLabel = '';
                    if (inp.city && inp.city !== 'none' && CD.cityCapexPerW[inp.city]) {
                        var city = CD.cityCapexPerW[inp.city];
                        cityLabel = city.label;
                        effectiveRegion = city.region;
                        locMult = city.perW / CD.cityAnchorPerW;
                    }

                    var yearMult = 1.0, yearLabel = '2025';
                    var marketMult = 1.0, deliveryMult = 1.0, contractorMult = 1.0;
                    var designPct = 0, pmPct = 0, contingencyPct = CD.softCostDefaults.simpleContingencyPct;
                    var fomTotal = 0, fomIncluded = false;
                    var powerDistM = 1.0, transformerM = 1.0, pduPerRack = 0, cablingPerRack = 0;
                    var floorM = 1.0, siteM = 1.0, securityM = 1.0, fiberCost = 0;
                    var greenM = 1.0, renewableCost = 0;

                    if (adv) {
                        yearLabel = String(adv.projYear || '2025');
                        yearMult = CD.yearEscalation[yearLabel] || 1.0;
                        marketMult = CD.marketConditionMult[adv.marketCondition || 'balanced'];
                        deliveryMult = CD.deliveryMethodMult[adv.deliveryMethod || 'dbb'];
                        contractorMult = CD.contractorAvailMult[adv.contractorAvail || 'normal'];
                        designPct = adv.designFee != null ? adv.designFee : 0;
                        pmPct = adv.pmFee != null ? adv.pmFee : 0;
                        contingencyPct = adv.contingency != null ? adv.contingency : CD.softCostDefaults.contingencyPct;
                        fomIncluded = !!adv.includeFOM;
                        if (fomIncluded) {
                            var subCost = CD.substationCosts[adv.substationType || 'shared'] *
                                          CD.fom.transformerLeadMult[adv.transformerLead || 'standard'];
                            var gridConnection = itLoad * 0.001 * CD.fom.gridConnectionPerMw;
                            var switchgear = itLoad * 0.001 * CD.fom.switchgearPerMw;
                            fomTotal = (subCost + gridConnection + switchgear) * (1 + (adv.utilityRate != null ? adv.utilityRate : 9) / 100);
                            fomTotal *= yearMult;
                        }
                        powerDistM = CD.powerDistMult[adv.powerDistribution] || 1.0;
                        transformerM = CD.transformerTypeMult[adv.transformerType] || 1.0;
                        pduPerRack = CD.pduCostPerRack[adv.pduType] || 1500;
                        cablingPerRack = CD.cablingCostPerRack[adv.cablingType] || 1200;
                        floorM = CD.floorTypeMult[adv.floorType] || 1.0;
                        siteM = CD.siteConditionMult[adv.siteCondition] || 1.0;
                        securityM = CD.securityLevelMult[adv.securityLevel] || 1.0;
                        fiberCost = CD.fiberEntryCost[adv.fiberEntry] || 350000;
                        greenM = CD.greenCertMult[adv.greenCert] || 1.0;
                        renewableCost = (CD.renewableCostPerMw[adv.renewableOption] || 0) * (itLoad / 1000);
                    }

                    var costs = {};
                    var total = 0;
                    var advGlobalMult = adv ? yearMult * marketMult * deliveryMult * contractorMult : 1.0;
                    var pr = CD.permitRegionMult[effectiveRegion] || CD.permitRegionMult.usa;

                    Object.keys(CD.costFactors).forEach(function (key) {
                        var multiplier = locMult;
                        if (key === 'building') multiplier *= buildMult * rackMult * floorM * siteM;
                        else if (key === 'seismic') multiplier *= seismicMult * buildMult;
                        else if (key === 'electrical') multiplier *= redMult * rackMult * powerDistM * transformerM;
                        else if (key === 'ups') multiplier *= redMult * rackMult * upsM;
                        else if (key === 'generator') multiplier *= redMult * fuelMult * genM;
                        else if (key === 'cooling') multiplier *= coolMult * rackMult;
                        else if (key === 'fireSuppression') multiplier *= fireSupMult;
                        else if (key === 'fireAlarm') multiplier *= alarmMult;
                        else if (key === 'security') multiplier *= securityM;
                        else if (key === 'commissioning') multiplier *= redMult;
                        else if (key === 'testing') multiplier *= pr.testing * (CD.testingRedundancyMult[redundancy] || 1.0);
                        else if (key === 'permits') multiplier *= pr.permits;
                        costs[key] = CD.costFactors[key] * itLoad * multiplier * advGlobalMult;
                        total += costs[key];
                    });

                    var racks = Math.ceil(itLoad / CD.rackKw[rackType]);
                    if (adv) {
                        var pduTotal = racks * pduPerRack * advGlobalMult * locMult;
                        costs.electrical += pduTotal; total += pduTotal;
                        var cablingTotal = racks * cablingPerRack * advGlobalMult * locMult;
                        costs.network += cablingTotal; total += cablingTotal;
                        if (fiberCost > 0) { costs.network += fiberCost * advGlobalMult; total += fiberCost * advGlobalMult; }
                    }

                    var softCosts = {};
                    if (adv) {
                        if (designPct > 0) softCosts.design = total * (designPct / 100);
                        if (pmPct > 0) softCosts.pm = total * (pmPct / 100);
                    }
                    var softTotal = 0;
                    Object.keys(softCosts).forEach(function (k) { softTotal += softCosts[k]; });
                    total += softTotal;

                    if (adv && greenM > 1.0) total += total * (greenM - 1.0);

                    var contingency = total * (contingencyPct / 100);
                    total += contingency;
                    if (fomIncluded) total += fomTotal;
                    if (adv && renewableCost > 0) total += renewableCost * advGlobalMult;

                    var pue = CD.pueByCoolingRack[coolingType] ? CD.pueByCoolingRack[coolingType][rackType] : 1.5;
                    var wue = CD.wueByCooling[coolingType] != null ? CD.wueByCooling[coolingType] : 0;
                    /* legacy quirk preserved (see JSDoc): rate keyed on DISPLAY region value */
                    var energyRate = location === 'sea' ? 0.08 : location === 'india' ? 0.07 : location === 'usa' ? 0.10 : CD.energyRateByLocation.other;
                    var annualEnergy = itLoad * pue * 8760 * energyRate;

                    /* deep-sea override: physics replaces the lookup PUE + adds its capex/opex */
                    var deepSea = null;
                    if (inp.deepSea) {
                        var dsIn = inp.deepSea === true ? {} : inp.deepSea;
                        deepSea = RZEngine.models.cooling.deepSea({
                            itLoadMw: itLoad / 1000, pueTarget: dsIn.pueTarget || 1.15,
                            deltaTC: dsIn.deltaTC, depthM: dsIn.depthM, pipelineKm: dsIn.pipelineKm,
                            intakeTempC: dsIn.intakeTempC, trimFraction: dsIn.trimFraction,
                            region: dsIn.region || 'US', mode: dsIn.mode
                        });
                        pue = deepSea.pue;
                        wue = 0;
                        annualEnergy = itLoad * pue * 8760 * energyRate;
                        costs.deepSeaCooling = deepSea.capex.total;
                        total += deepSea.capex.total;
                    }

                    /* refrigerant impact (chiller/CRAC path; auto-mapped when not user-selected) */
                    var refrigerant = null;
                    var refKey = inp.refrigerant && inp.refrigerant !== 'auto' ? inp.refrigerant
                               : DATA.refrigerantAutoByCooling[inp.deepSea ? 'deepsea' : coolingType];
                    if (refKey && DATA.refrigerants[refKey]) {
                        var chillerMwth = inp.deepSea
                            ? (itLoad / 1000) * (deepSea ? (inp.deepSea.trimFraction != null ? inp.deepSea.trimFraction : DATA.deepSeaCooling.trimChiller.capacityFraction) : 0.35) * 1.15
                            : (itLoad / 1000) * (pue - 1 + 0.85);
                        refrigerant = RZEngine.models.cooling.refrigerant(refKey, {
                            chillerMwth: Math.max(0.1, chillerMwth),
                            region: effectiveRegion === 'usa' ? 'US' : effectiveRegion === 'europe' ? 'EU' : 'APAC',
                            loadFactor: inp.deepSea ? 0.05 : 0.5
                        });
                        if (refrigerant && refrigerant.capexMult > 1 && costs.cooling) {
                            var refPremium = costs.cooling * (refrigerant.capexMult - 1);
                            costs.cooling += refPremium; total += refPremium;
                            refrigerant.capexPremium = Math.round(refPremium);
                        }
                    }

                    /* rack density + white space (all-inputs aware: density, cooling, redundancy) */
                    var SP = CD.space;
                    var fpBase = SP.rackFootprintM2[rackType] || 2.5;
                    var liquidRow = (inp.deepSea || coolingType === 'liquid' || coolingType === 'rdhx') ? SP.liquidRowFactor : 1.0;
                    var rackFootprint = fpBase * liquidRow;
                    var whiteSpaceM2 = Math.ceil(racks * rackFootprint);
                    var supportM2 = Math.ceil(whiteSpaceM2 * (SP.supportRatioByRedundancy[redundancy] || 0.75));
                    var adminM2 = Math.ceil(SP.adminFixedM2 + racks * SP.adminPerRackM2);
                    var grossM2 = whiteSpaceM2 + supportM2 + adminM2;
                    var space = {
                        racks: racks,
                        rackDensityKw: CD.rackKw[rackType],
                        rackFootprintM2: Math.round(rackFootprint * 100) / 100,
                        rackRows: Math.ceil(racks / SP.racksPerRow),
                        whiteSpaceM2: whiteSpaceM2,
                        whiteSpaceKwPerM2: Math.round((itLoad / whiteSpaceM2) * 10) / 10,
                        supportSpaceM2: supportM2,
                        adminM2: adminM2,
                        grossM2: grossM2,
                        grossSqft: Math.round(grossM2 * 10.7639),
                        whiteSpacePctOfGross: Math.round((whiteSpaceM2 / grossM2) * 1000) / 10,
                        suggestedHalls: Math.max(1, Math.ceil(whiteSpaceM2 / SP.targetHallM2))
                    };

                    return {
                        costs: costs, total: total, perKw: total / itLoad, space: space,
                        softCosts: softCosts, contingency: contingency, fomTotal: fomTotal,
                        racks: racks, pue: pue, wue: wue, annualEnergy: annualEnergy,
                        cityLabel: cityLabel, effectiveRegion: effectiveRegion, yearLabel: yearLabel,
                        deepSea: deepSea, refrigerant: refrigerant,
                        timeline: RZEngine.models.capex.timelineDetailed(redundancy, buildingType,
                            inp.deepSea ? 'deepsea' : coolingType, effectiveRegion, itLoad)
                    };
                },
                /** Timeline port of the calculator's computeTimeline() — parallel-phase model. */
                timelineDetailed: function (redundancy, buildingType, coolingType, effectiveRegion, itLoad) {
                    var CD = DATA.capexDetail;
                    var base = CD.timelineBase[redundancy] || CD.timelineBase.n1;
                    var bMult = CD.buildingTimeMult[buildingType] || 1.0;
                    var cMult = CD.coolingTimeMult[coolingType] || 1.0;
                    var pMult = CD.permitTimeMult[effectiveRegion] || 1.0;
                    var lMult = itLoad <= 1000 ? 0.55 : itLoad <= 2000 ? 0.65 : itLoad <= 5000 ? 0.8 :
                                itLoad <= 10000 ? 1.0 : itLoad <= 25000 ? 1.15 : itLoad <= 50000 ? 1.3 : 1.5;
                    var design = Math.max(2, Math.ceil(base.design * lMult));
                    var permit = Math.max(2, Math.ceil(base.permit * pMult));
                    var procurement = Math.max(2, Math.ceil(base.mep * 0.4 * cMult * lMult));
                    var civil = Math.max(2, Math.ceil(base.civil * bMult * lMult));
                    var mep = Math.max(2, Math.ceil(base.mep * cMult * lMult));
                    var commission = Math.max(1, Math.ceil(base.commission * cMult * Math.max(0.7, lMult)));
                    var permitStart = 1;
                    var designPermitEnd = Math.max(design, permitStart + permit);
                    var procStart = Math.max(1, design - Math.ceil(procurement * 0.3));
                    var procEnd = procStart + procurement;
                    var civilStart = designPermitEnd;
                    var civilEnd = civilStart + civil;
                    var mepStart = Math.max(procEnd, civilStart + Math.ceil(civil * 0.5));
                    var mepEnd = mepStart + mep;
                    var commStart = Math.max(mepEnd, civilEnd);
                    return { design: design, permit: permit, procurement: procurement, civil: civil,
                             mep: mep, commission: commission, totalMonths: commStart + commission };
                },
                /**
                 * Regional cost index (relative build-cost multiplier) built from land + construction
                 * labor + a materials constant, normalized to the US. Falls back to `salaryMult` when a
                 * region has no land/labor entry (backward-compat). (A6-50)
                 */
                regionCostIndex: function (region) {
                    var code = (region || 'US').toUpperCase();
                    var rdata = DATA.regions[code] || DATA.regionsCountry[code] || DATA.regions.US;
                    var land = DATA.land[code], labor = DATA.laborRates[code];
                    if (land == null || labor == null) return rdata.salaryMult; // legacy behavior
                    // 55% materials (globally-priced, index 1.0), 30% labor, 15% land — normalized to US.
                    var laborIdx = labor / DATA.laborRates.US;
                    var landIdx  = land / DATA.land.US;
                    return +(0.55 * 1.0 + 0.30 * laborIdx + 0.15 * landIdx).toFixed(4);
                },

                /**
                 * Per-MW raw build cost for a tier + cooling type, region-adjusted.
                 * cooling: 'air'|'rearDoor'|'directToChip'|'immersion' (default 'air' → backward-compat).
                 * Tier accepted: 2|3|4. Uses `salaryMult` (legacy) unless opts.useCostIndex.
                 */
                datacenterBuildCost: function (mw, tier, region, cooling, opts) {
                    opts = opts || {};
                    var t = tier || 3;
                    var ct = (cooling && DATA.coolingTypes[cooling]) ? DATA.coolingTypes[cooling] : DATA.coolingTypes.air;
                    var key = ct.capexKey + 'Tier' + t;
                    var perMw = (DATA.capexPerMw && DATA.capexPerMw[key]) || DATA.capexPerMw.airCooledTier3;
                    var mult = opts.useCostIndex
                        ? RZEngine.models.capex.regionCostIndex(region)
                        : ((region && DATA.regions[region.toUpperCase()]) || DATA.regions.US).salaryMult;
                    return Math.round((mw || 0) * perMw * mult);
                },

                /** Apply modular construction premium. `modularPct` 0.0–1.0 fraction modular. */
                modularPremium: function (baseCost, modularPct, tier) {
                    var key = 'tier' + (tier || 3);
                    var premium = (DATA.modularPremiumPct && DATA.modularPremiumPct[key]) || 0;
                    return Math.round((baseCost || 0) * (1 + premium * (modularPct || 0)));
                },

                /** MEP portion of a build-cost base (typically 35-45%). Returns dollars. */
                mepDistribution: function (baseCapex, tier) {
                    var key = 'tier' + (tier || 3);
                    var pct = (DATA.mepPctOfCapex && DATA.mepPctOfCapex[key]) || 0.42;
                    return Math.round((baseCapex || 0) * pct);
                },

                /**
                 * Single-call total CAPEX with full breakdown. Backward-compatible: `total` retains its
                 * prior magnitude (build × (1+contingency)); it/mep/civil are now split on the pre-contingency
                 * BASE so they no longer double-count the contingency (A6-49). New additive fields: land,
                 * commissioning, permitting, totalAllIn, cooling, aiDensityTier. (A6-51/52)
                 *
                 * opts: { modularPct, contingencyPct, itPctOfCapex, cooling, aiDensity:'legacy|hpc|ai',
                 *         useCostIndex, includeLand }
                 */
                totalCost: function (mw, tier, region, opts) {
                    opts = opts || {};
                    var t = tier || 3;
                    var cooling = opts.cooling || 'air';
                    var rawBase = RZEngine.models.capex.datacenterBuildCost(mw, t, region, cooling, opts);
                    // AI/GPU high-density capex scaling
                    var densTier = opts.aiDensity && DATA.aiDensity[opts.aiDensity] ? opts.aiDensity : null;
                    if (densTier) rawBase = Math.round(rawBase * DATA.aiDensity[densTier].capexMult);
                    var base = RZEngine.models.capex.modularPremium(rawBase, opts.modularPct || 0, t);

                    var contingencyPct = opts.contingencyPct != null ? opts.contingencyPct : DATA.capexDefaults.contingencyPct;
                    var itPct = opts.itPctOfCapex != null ? opts.itPctOfCapex : DATA.capexDefaults.itPctOfCapex;
                    var mep = RZEngine.models.capex.mepDistribution(base, t);
                    var it = Math.round(base * itPct);
                    var civil = Math.max(0, base - mep - it);
                    var contingency = Math.round(base * contingencyPct);
                    var total = base + contingency;                 // unchanged magnitude vs v1.2

                    // Additive line items (not folded into `total` unless includeLand)
                    var landCost = Math.round((DATA.land[(region || 'US').toUpperCase()] || DATA.land.US) * (mw || 0));
                    var commissioning = Math.round(base * 0.015);   // ~1.5% commissioning
                    var permitting = Math.round(base * 0.01);       // ~1% permitting/interconnect
                    var totalAllIn = total + landCost + commissioning + permitting;

                    return {
                        total: total,
                        base: base,
                        it: it,
                        mep: mep,
                        civil: civil,
                        contingency: contingency,
                        land: landCost,
                        commissioning: commissioning,
                        permitting: permitting,
                        totalAllIn: opts.includeLand ? totalAllIn : total,
                        cooling: cooling,
                        aiDensityTier: densTier,
                        perMwCost: (mw > 0) ? Math.round(total / mw) : 0
                    };
                }
            },

            opex: {
                /**
                 * Annual power cost. mw = total IT load, pue applied to get total facility load.
                 * regionPower defaults to RZEngine.data.regions[code].powerKwh.
                 */
                powerCostAnnual: function (mw, pue, regionPower, hoursPerYear, opts) {
                    opts = opts || {};
                    var hrs = hoursPerYear || DATA.hoursPerYear;
                    // PPA/TOU/demand: ppaRate overrides the grid price; touMultiplier scales the energy
                    // rate; demandChargeAnnual is a flat $/yr adder. All optional → flat rate by default.
                    var price = opts.ppaRate != null ? opts.ppaRate
                        : (regionPower != null ? regionPower : DATA.regions.US.powerKwh);
                    price = price * (opts.touMultiplier != null ? opts.touMultiplier : 1);
                    var pueVal = pue || DATA.pueDefaults.airCooledTier3;
                    var energy = Math.round((mw || 0) * 1000 * pueVal * hrs * price);
                    return energy + (opts.demandChargeAnnual || 0);
                },

                /**
                 * Cooling efficiency factor 0–1 based on climate zone and design delta-T.
                 * Higher = better. climate: 'cold'|'temperate'|'hot'|'tropical'.
                 */
                coolingEfficiency: function (climate, designDeltaT) {
                    var cc = DATA.coolingClimate;
                    var b = cc.base[climate] || cc.fallback;
                    // Higher design delta-T (e.g. 12C vs 8C) improves efficiency per degree above the reference
                    var delta = designDeltaT || cc.deltaTRefC;
                    return Math.min(cc.cap, b + (delta - cc.deltaTRefC) * cc.perDegreeBonus);
                },

                /**
                 * Annual staffing cost. role: 'dcTechMid'|'electricianJourneyman'|'cdfomSenior'.
                 * Pulls regional salary from RZEngine.data.salaryBenchmarks and applies fully-loaded mult of 1.30.
                 */
                staffingCostAnnual: function (headcount, region, role) {
                    var r = (region || 'US').toUpperCase();
                    var roleKey = role || 'dcTechMid';
                    var bench = DATA.salaryBenchmarks[roleKey];
                    var salary = (bench && bench[r]) || (bench && bench.US) || 75100;
                    return Math.round((headcount || 0) * salary * DATA.staffingLoadFactor);
                },

                /** Outsourced contract cost annual. scope: 'small'|'medium'|'large' (per facility). */
                contractCostAnnual: function (scope, region) {
                    var base = DATA.contractCostBase;
                    var b = base[scope] || base.medium;
                    var rdata = (region && DATA.regions[region.toUpperCase()]) || DATA.regions.US;
                    return Math.round(b * rdata.salaryMult);
                },

                /**
                 * Single-call total annual OPEX with breakdown. Backward-compatible: the default `total`
                 * remains power+staffing+contract+maintenance+overhead. New line items (water, carbon,
                 * insurance, connectivity) are always COMPUTED and returned, but only folded into `total`
                 * when opts.extendedOpex is set (else `totalExtended` carries the all-in figure). (A6-53/54)
                 *
                 * opts: { maintenancePct, overheadPct, contractScope, capex, cooling, climate, designDeltaT,
                 *         ppaRate, touMultiplier, demandChargeAnnual, insurancePct, connectivityPerMw,
                 *         extendedOpex, warn }
                 */
                totalAnnual: function (mw, pue, region, headcount, opts) {
                    opts = opts || {};
                    var code = (region || 'US').toUpperCase();
                    var rdata = DATA.regions[code] || DATA.regionsCountry[code] || DATA.regions.US;
                    var hrs = DATA.hoursPerYear;
                    var pueVal = pue || DATA.pueDefaults.airCooledTier3;

                    var power = RZEngine.models.opex.powerCostAnnual(mw, pue, rdata.powerKwh, hrs, {
                        ppaRate: opts.ppaRate, touMultiplier: opts.touMultiplier, demandChargeAnnual: opts.demandChargeAnnual
                    });
                    // A6-56: consume cooling efficiency — better climate/ΔT trims the cooling share of power.
                    // CONSTRAINT: pass opts.climate ONLY with an architecture-DEFAULT `pue` (not a measured/
                    // benchmarked value) — a calibrated pue already encodes cooling efficiency, so passing both
                    // double-counts it. No current caller passes opts.climate.
                    if (opts.climate) {
                        var eff = RZEngine.models.opex.coolingEfficiency(opts.climate, opts.designDeltaT);
                        power = Math.round(power * (DATA.coolingClimate.fallback / eff));
                    }
                    var staffing = RZEngine.models.opex.staffingCostAnnual(headcount || 0, region);
                    var contract = RZEngine.models.opex.contractCostAnnual(opts.contractScope || DATA.opexDefaults.contractScope, region);

                    // A6-53: capex-omission guard — maintenance is 0 without a capex basis; surface a warning.
                    var capexBase = opts.capex || 0;
                    var warning = null;
                    if (!capexBase && opts.warn) warning = 'maintenance=0: no opts.capex basis provided';
                    var maintenance = Math.round(capexBase * (opts.maintenancePct != null ? opts.maintenancePct : DATA.opexDefaults.maintenancePct));

                    // A6-54: new line items
                    var itKwh = (mw || 0) * 1000 * hrs;
                    var facilityKwh = itKwh * pueVal;
                    var wue = DATA.water.wueByType[opts.cooling] != null ? DATA.water.wueByType[opts.cooling] : DATA.water.wueByType.air;
                    var waterM3 = (wue * itKwh) / 1000;
                    var water = Math.round(waterM3 * (DATA.water.priceM3[code] || DATA.water.priceM3.US));
                    var carbonTonnes = (facilityKwh * (DATA.carbon.gridFactor[code] || DATA.carbon.gridFactor.US)) / 1000;
                    var carbon = Math.round(carbonTonnes * (DATA.carbon.carbonPrice[code] || DATA.carbon.carbonPrice.US));
                    var insurance = Math.round(capexBase * (opts.insurancePct != null ? opts.insurancePct : 0.005));
                    var connectivity = Math.round((mw || 0) * (opts.connectivityPerMw != null ? opts.connectivityPerMw : 80000));

                    var overheadPct = opts.overheadPct != null ? opts.overheadPct : DATA.opexDefaults.overheadPct;
                    var coreSubtotal = power + staffing + contract + maintenance;
                    var extraLines = opts.extendedOpex ? (water + carbon + insurance + connectivity) : 0;
                    var overhead = Math.round((coreSubtotal + extraLines) * overheadPct);
                    var total = coreSubtotal + extraLines + overhead;
                    var totalExtended = coreSubtotal + water + carbon + insurance + connectivity +
                        Math.round((coreSubtotal + water + carbon + insurance + connectivity) * overheadPct);

                    return {
                        total:        total,
                        totalExtended: totalExtended,
                        power:        power,
                        staffing:     staffing,
                        maintenance:  maintenance,
                        contract:     contract,
                        water:        water,
                        carbon:       carbon,
                        insurance:    insurance,
                        connectivity: connectivity,
                        overhead:     overhead,
                        warning:      warning
                    };
                }
            },

            tco: {
                /**
                 * Total cost of ownership. capex + opex×years + (refreshPct of capex per refresh cycle).
                 * Default 5-year refresh cycle.
                 */
                lifecycle: function (capex, opexAnnual, years, refreshPct) {
                    var rp = refreshPct == null ? DATA.refresh.refreshPct : refreshPct;
                    var refreshCycles = Math.floor((years || 0) / DATA.refresh.cycleYears);
                    return Math.round((capex || 0) + (opexAnnual || 0) * (years || 0) + (capex || 0) * rp * refreshCycles);
                },

                /** Number of replacement cycles within `totalYears` given asset life. */
                replacementCycles: function (assetLifeYears, totalYears) {
                    if (!assetLifeYears || assetLifeYears <= 0) return 0;
                    return Math.max(0, Math.floor((totalYears || 0) / assetLifeYears));
                },

                /**
                 * Generate year-by-year cashflow array suitable for NPV/IRR input.
                 * Year 0 = -capex (initial outlay). Years 1..n = -opexAnnual + annualRevenue.
                 * refreshPct of capex is charged at each 5-year refresh cycle.
                 */
                cashflows: function (capex, opexAnnual, years, annualRevenue, refreshPct) {
                    var rp = refreshPct == null ? DATA.refresh.refreshPct : refreshPct;
                    var cyc = DATA.refresh.cycleYears;
                    var flows = [-(capex || 0)];
                    for (var y = 1; y <= (years || 0); y++) {
                        var refresh = (y % cyc === 0) ? (capex || 0) * rp : 0;
                        flows.push((annualRevenue || 0) - (opexAnnual || 0) - refresh);
                    }
                    return flows;
                },

                /** Cost per MW per year — useful KPI for benchmarking. */
                costPerMwYear: function (totalTco, mw, years) {
                    if (!mw || mw <= 0 || !years || years <= 0) return 0;
                    return Math.round((totalTco || 0) / mw / years);
                },

                /**
                 * Discounted TCO — NPV of capex + opex + refresh charges, minus discounted salvage. (A6-64)
                 * opts: { discountRate (from DATA.discountDefaults if region given), region, salvagePct,
                 *         refreshPct, opexGrowth (inflation-linked, A6-65) }
                 */
                lifecycleNPV: function (capex, opexAnnual, years, opts) {
                    opts = opts || {};
                    var rate = opts.discountRate != null ? opts.discountRate
                        : (opts.region ? (DATA.discountDefaults[(opts.region || '').toUpperCase()] || DATA.discountDefaults.global) : DATA.discountDefaults.global);
                    var rp = opts.refreshPct != null ? opts.refreshPct : DATA.refresh.refreshPct;
                    var cyc = DATA.refresh.cycleYears;
                    var growth = opts.opexGrowth || 0;
                    var npv = (capex || 0); // year-0 outlay (undiscounted)
                    for (var y = 1; y <= (years || 0); y++) {
                        var opexY = (opexAnnual || 0) * Math.pow(1 + growth, y - 1);
                        var refresh = (y % cyc === 0) ? (capex || 0) * rp : 0;
                        npv += (opexY + refresh) / Math.pow(1 + rate, y);
                    }
                    // salvage recovered at end of horizon (positive → reduces TCO)
                    if (opts.salvagePct && years > 0) {
                        npv -= ((capex || 0) * opts.salvagePct) / Math.pow(1 + rate, years);
                    }
                    return Math.round(npv);
                }
            },

            pue: {
                /** Compute PUE from total facility load and IT load. */
                pueFromInputs: function (itLoad, totalLoad) {
                    if (!itLoad || itLoad <= 0) return 0;
                    return (totalLoad || 0) / itLoad;
                },

                /** Data Center Infrastructure Efficiency = 1/PUE expressed as fraction. */
                dcie: function (pue) {
                    if (!pue || pue <= 0) return 0;
                    return 1 / pue;
                },

                /**
                 * Cooling-aware default PUE (A5-45). cooling: 'air'|'rearDoor'|'directToChip'|'immersion',
                 * tier: 2|3|4. Reads DATA.pueMatrix so liquid/immersion defaults are actually reachable.
                 */
                defaultFor: function (cooling, tier) {
                    var ct = (cooling && DATA.coolingTypes[cooling]) ? DATA.coolingTypes[cooling] : DATA.coolingTypes.air;
                    var row = DATA.pueMatrix[ct.pueKey] || DATA.pueMatrix.air;
                    return row['tier' + (tier || 3)] || row.tier3;
                },

                /** Partial-load PUE curve (A6-58): PUE rises as IT load fraction drops (fixed overhead). */
                partialLoadPUE: function (designPUE, loadFraction) {
                    var lf = Math.max(0.05, Math.min(1, loadFraction || 1));
                    var overhead = (designPUE || 1.5) - 1;          // infrastructure overhead at full load
                    // fixed portion of overhead doesn't scale down with IT load → PUE degrades at low load
                    var fixedShare = 0.55;
                    return 1 + overhead * (fixedShare / lf + (1 - fixedShare));
                },

                /** Water Usage Effectiveness companion (A6-58). Returns L/kWh for a cooling type. */
                wue: function (cooling) {
                    return DATA.water.wueByType[cooling] != null ? DATA.water.wueByType[cooling] : DATA.water.wueByType.air;
                },

                /**
                 * Annual energy cost given IT load (kW), PUE, and $/kWh rate.
                 * A6-57: delegates to opex.powerCostAnnual (MW-based) so the two power-cost formulas
                 * are one implementation. itKw/1000 = MW.
                 */
                annualEnergyCost: function (itKw, pue, kwhRate, hoursPerYear) {
                    var rate = kwhRate != null ? kwhRate : DATA.regions.US.powerKwh;
                    return RZEngine.models.opex.powerCostAnnual((itKw || 0) / 1000, pue || 1, rate, hoursPerYear || DATA.hoursPerYear);
                }
            },

            /* ── A7: uncertainty / sensitivity drivers ── */
            sim: {
                /**
                 * Monte-Carlo driver. `fn(sample)` maps a {key:value} sample → number.
                 * `distributions` = { key: { dist:'normal'|'uniform'|'triangular'|'categorical', ...params } }.
                 *   - normal:      { mean, sd }
                 *   - uniform:     { min, max }
                 *   - triangular:  { min, mode, max }
                 *   - categorical: { choices: [{ value, weight }] }  → draws a value by weight
                 * Deterministic by default (seeded LCG) so results are reproducible across runs.
                 *
                 * opts (optional, backward-compatible): { correlations: [{ a, b, rho }] } imposes pairwise
                 * correlation between two NORMAL keys (Cholesky-style: z_b ← rho·z_a + √(1−rho²)·z_b).
                 * When opts is omitted the sampling path is byte-identical to the pre-2.1 driver.
                 * NOTE: correlations are applied in array order and z_b is mutated in place, so CHAINED
                 * pairs (e.g. [{a:'A',b:'B'},{a:'B',b:'C'}]) produce implicit transitive correlation —
                 * this is well-defined only for independent pairs. For >2 correlated variables use a
                 * disjoint pair set. (Current callers use a single pair — exact.)
                 *
                 * Returns { p10, p50, p90, mean, min, max, samples }.
                 */
                monteCarlo: function (fn, distributions, iterations, seed, opts) {
                    iterations = iterations || 2000;
                    var s = (seed == null ? 123456789 : seed) >>> 0;
                    function rnd() { s = (1103515245 * s + 12345) >>> 0; return s / 4294967296; }
                    function stdNormal() { var u = rnd(), u2 = rnd(); return Math.sqrt(-2 * Math.log(u || 1e-9)) * Math.cos(2 * Math.PI * u2); }
                    function draw(d) {
                        var u = rnd();
                        if (d.dist === 'uniform') return d.min + u * (d.max - d.min);
                        if (d.dist === 'triangular') {
                            var lo = d.min, hi = d.max, mo = d.mode == null ? (lo + hi) / 2 : d.mode;
                            var c = (mo - lo) / (hi - lo);
                            return u < c ? lo + Math.sqrt(u * (hi - lo) * (mo - lo))
                                         : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mo));
                        }
                        if (d.dist === 'categorical') {
                            var ch = d.choices || [];
                            var totalW = 0, m; for (m = 0; m < ch.length; m++) totalW += (ch[m].weight == null ? 1 : ch[m].weight);
                            var t = u * totalW, acc = 0;
                            for (m = 0; m < ch.length; m++) { acc += (ch[m].weight == null ? 1 : ch[m].weight); if (t <= acc) return ch[m].value; }
                            return ch.length ? ch[ch.length - 1].value : undefined;
                        }
                        // normal (Box–Muller)
                        var u2 = rnd();
                        var z = Math.sqrt(-2 * Math.log(u || 1e-9)) * Math.cos(2 * Math.PI * u2);
                        return (d.mean || 0) + (d.sd || 1) * z;
                    }
                    var keys = Object.keys(distributions || {});
                    var corr = (opts && opts.correlations && opts.correlations.length) ? opts.correlations : null;
                    var out = [];
                    var i, k, sample, v;
                    if (!corr) {
                        // Fast path — unchanged from the pre-2.1 driver (byte-identical RNG sequence).
                        for (i = 0; i < iterations; i++) {
                            sample = {};
                            for (k = 0; k < keys.length; k++) sample[keys[k]] = draw(distributions[keys[k]]);
                            v = fn(sample);
                            if (isFinite(v)) out.push(v);
                        }
                    } else {
                        // Correlated path — draw standard normals for normal keys, correlate, then scale.
                        for (i = 0; i < iterations; i++) {
                            sample = {};
                            var z = {};
                            for (k = 0; k < keys.length; k++) {
                                var d = distributions[keys[k]];
                                if (d.dist === 'normal' || d.dist == null) z[keys[k]] = stdNormal();
                                else sample[keys[k]] = draw(d);
                            }
                            for (var c = 0; c < corr.length; c++) {
                                var a = corr[c].a, bb = corr[c].b, rho = corr[c].rho;
                                if (z[a] != null && z[bb] != null) z[bb] = rho * z[a] + Math.sqrt(Math.max(0, 1 - rho * rho)) * z[bb];
                            }
                            for (var kk in z) { var dn = distributions[kk] || {}; sample[kk] = (dn.mean || 0) + (dn.sd || 1) * z[kk]; }
                            v = fn(sample);
                            if (isFinite(v)) out.push(v);
                        }
                    }
                    out.sort(function (a, b) { return a - b; });
                    var pct = function (p) { return out.length ? out[Math.min(out.length - 1, Math.floor(p * out.length))] : 0; };
                    var mean = out.reduce(function (a, b) { return a + b; }, 0) / (out.length || 1);
                    return { p10: pct(0.10), p50: pct(0.50), p90: pct(0.90), mean: mean,
                             min: out[0] || 0, max: out[out.length - 1] || 0, samples: out };
                },

                /**
                 * One-at-a-time tornado sensitivity. `ranges` = { key:{lo,hi} }. Holds others at base.
                 * Returns [{ key, low, high, base, swing }] sorted by |swing| desc.
                 */
                tornado: function (fn, baseInputs, ranges) {
                    var base = fn(baseInputs);
                    var rows = Object.keys(ranges || {}).map(function (key) {
                        var loIn = Object.assign({}, baseInputs); loIn[key] = ranges[key].lo;
                        var hiIn = Object.assign({}, baseInputs); hiIn[key] = ranges[key].hi;
                        var low = fn(loIn), high = fn(hiIn);
                        return { key: key, low: low, high: high, base: base, swing: Math.abs(high - low) };
                    });
                    rows.sort(function (a, b) { return b.swing - a.swing; });
                    return rows;
                },

                /**
                 * Two-variable sensitivity grid. Returns { x:[...], y:[...], z:[[...]] } where
                 * z[j][i] = fn with xVar=x[i], yVar=y[j] over the other base inputs.
                 */
                sensitivityGrid: function (fn, baseInputs, xVar, xRange, yVar, yRange, steps) {
                    steps = steps || 8;
                    var lin = function (r) { var a = []; for (var i = 0; i <= steps; i++) a.push(r.lo + (r.hi - r.lo) * i / steps); return a; };
                    var xs = lin(xRange), ys = lin(yRange), z = [];
                    for (var j = 0; j < ys.length; j++) {
                        var row = [];
                        for (var i = 0; i < xs.length; i++) {
                            var inp = Object.assign({}, baseInputs); inp[xVar] = xs[i]; inp[yVar] = ys[j];
                            row.push(fn(inp));
                        }
                        z.push(row);
                    }
                    return { x: xs, y: ys, z: z };
                }
            },

            /* ── A7: carbon model ── */
            carbon: {
                /** Grid emission factor (kgCO₂e/kWh) for a region code. */
                gridFactor: function (region) {
                    var c = (region || 'US').toUpperCase();
                    return DATA.carbon.gridFactor[c] != null ? DATA.carbon.gridFactor[c] : DATA.carbon.gridFactor.US;
                },
                /** Annual operational tCO₂e from facility energy. mw = IT load, pue applied. */
                annualTonnes: function (mw, pue, region, hoursPerYear) {
                    var hrs = hoursPerYear || DATA.hoursPerYear;
                    var facilityKwh = (mw || 0) * 1000 * (pue || DATA.pueDefaults.airCooledTier3) * hrs;
                    return +(facilityKwh * RZEngine.models.carbon.gridFactor(region) / 1000).toFixed(1);
                },
                /** Embodied (construction) tCO₂e for `mw` of built capacity. */
                embodiedTonnes: function (mw) { return Math.round((mw || 0) * DATA.carbon.embodiedPerMw); },
                /** Annual carbon cost ($) at the regional carbon price. */
                annualCost: function (mw, pue, region, hoursPerYear) {
                    var c = (region || 'US').toUpperCase();
                    var price = DATA.carbon.carbonPrice[c] != null ? DATA.carbon.carbonPrice[c] : DATA.carbon.carbonPrice.US;
                    return Math.round(RZEngine.models.carbon.annualTonnes(mw, pue, region, hoursPerYear) * price);
                },
                /** Cost to voluntarily offset a tonnage. */
                offsetCost: function (tonnes) { return Math.round((tonnes || 0) * DATA.carbon.offsetPrice); }
            },

            /* ── A7: water model ── */
            water: {
                /** WUE (L/kWh) for a cooling type. */
                wue: function (cooling) { return DATA.water.wueByType[cooling] != null ? DATA.water.wueByType[cooling] : DATA.water.wueByType.air; },
                /** Annual water use (m³) — WUE × IT energy. mw = IT load. */
                annualM3: function (mw, cooling, hoursPerYear) {
                    var hrs = hoursPerYear || DATA.hoursPerYear;
                    var itKwh = (mw || 0) * 1000 * hrs;
                    return Math.round(RZEngine.models.water.wue(cooling) * itKwh / 1000);
                },
                /** Annual water cost ($) at the regional water price. */
                annualCost: function (mw, cooling, region, hoursPerYear) {
                    var c = (region || 'US').toUpperCase();
                    var price = DATA.water.priceM3[c] != null ? DATA.water.priceM3[c] : DATA.water.priceM3.US;
                    return Math.round(RZEngine.models.water.annualM3(mw, cooling, hoursPerYear) * price);
                }
            },

            /* ── v2.4.0: reliability (RAM) model — Layer 10 ── */
            reliability: {
                /** Steady-state availability of a single item: MTBF/(MTBF+MTTR). */
                availability: function (mtbf, mttr) {
                    var a = (mtbf || 0) + (mttr || 0);
                    return a > 0 ? +(mtbf / a).toFixed(6) : 0;
                },
                /** MTBF (h) for a known component, else null. */
                mtbfFor: function (component) {
                    var c = DATA.reliability.components[component];
                    return c ? c.mtbf : null;
                },
                /** MTTR (h) for a known component, else null. */
                mttrFor: function (component) {
                    var c = DATA.reliability.components[component];
                    return c ? c.mttr : null;
                },
                /** Availability of `paths` identical items in active-parallel redundancy
                 *  (system up if ≥1 path up): 1 − (1−a)^paths. */
                parallelAvailability: function (a, paths) {
                    var p = Math.max(1, paths || 1);
                    return +(1 - Math.pow(1 - a, p)).toFixed(6);
                },
                /** Series availability of independent groups (all must be up): Π a_i. */
                seriesAvailability: function (avails) {
                    if (!avails || !avails.length) return 0;
                    var prod = 1;
                    for (var i = 0; i < avails.length; i++) prod *= avails[i];
                    return +prod.toFixed(6);
                },
                /** Annual downtime (minutes) for an availability fraction. */
                annualDowntimeMinutes: function (availability) {
                    return +((1 - (availability || 0)) * DATA.hoursPerYear * 60).toFixed(1);
                },
                /** Uptime Tier availability target for tier 2|3|4. */
                tierTarget: function (tier) {
                    return DATA.reliability.tierAvailability[tier] != null
                        ? DATA.reliability.tierAvailability[tier]
                        : DATA.reliability.tierAvailability[3];
                },
                /** System availability for a set of component groups under a redundancy
                 *  config: each group = its item availability in parallel over the config's
                 *  paths, then all groups in series. components = ['ups','crac',...]. */
                systemAvailability: function (components, redundancy) {
                    var paths = DATA.reliability.redundancyPaths[redundancy] != null
                        ? DATA.reliability.redundancyPaths[redundancy] : 1;
                    var self = RZEngine.models.reliability;
                    var groups = (components || []).map(function (name) {
                        var c = DATA.reliability.components[name];
                        if (!c) return 1;
                        return self.parallelAvailability(self.availability(c.mtbf, c.mttr), paths);
                    });
                    return self.seriesAvailability(groups);
                }
            },

            /* ── v2.4.0: site intelligence model — Layer 2 ── */
            site: {
                /** Letter grade for a 0-100 site score. */
                grade: function (score) {
                    var bands = DATA.site.gradeBands;
                    for (var i = 0; i < bands.length; i++) {
                        if (score >= bands[i].min) return { grade: bands[i].grade, label: bands[i].label };
                    }
                    return { grade: 'E', label: bands[bands.length - 1].label };
                },
                /** Weighted Site Score from 0-1 goodness factors (1 = best). Only the
                 *  supplied factors count; weights are renormalized over present
                 *  factors so a partial set still scores fairly. Returns score 0-100,
                 *  grade, per-factor breakdown, and the list of missing factors. */
                score: function (factors) {
                    factors = factors || {};
                    var W = DATA.site.weights;
                    var breakdown = [];
                    var present = 0, weighted = 0, missing = [];
                    for (var k in W) {
                        if (!W.hasOwnProperty(k)) continue;
                        var v = factors[k];
                        if (v == null || isNaN(v)) { missing.push(k); continue; }
                        var val = Math.max(0, Math.min(1, v));
                        present += W[k];
                        weighted += W[k] * val;
                        breakdown.push({ key: k, weight: W[k], value: +val.toFixed(3), contribution: +(W[k] * val).toFixed(4) });
                    }
                    var score = present > 0 ? +(100 * weighted / present).toFixed(1) : 0;
                    var g = RZEngine.models.site.grade(score);
                    return { score: score, grade: g.grade, label: g.label, breakdown: breakdown, missing: missing, coverage: +present.toFixed(3) };
                }
            },

            /* ── v2.4.0: commissioning readiness model — Layer 7 ── */
            commissioning: {
                /** Readiness status for a 0-100 index. */
                status: function (index) {
                    var bands = DATA.commissioning.statusBands;
                    for (var i = 0; i < bands.length; i++) {
                        if (index >= bands[i].min) return { status: bands[i].status, label: bands[i].label };
                    }
                    return { status: 'Not Ready', label: bands[bands.length - 1].label };
                },
                /** Operational Readiness Index from per-category completion (0-1 each,
                 *  1 = complete). Weights renormalize over supplied categories. Returns
                 *  index 0-100, status, per-category breakdown, and open categories. */
                readinessIndex: function (completion) {
                    completion = completion || {};
                    var W = DATA.commissioning.weights, L = DATA.commissioning.labels;
                    var breakdown = [], present = 0, weighted = 0, open = [];
                    for (var k in W) {
                        if (!W.hasOwnProperty(k)) continue;
                        var v = completion[k];
                        if (v == null || isNaN(v)) { open.push(k); continue; }
                        var val = Math.max(0, Math.min(1, v));
                        present += W[k]; weighted += W[k] * val;
                        if (val < 1) open.push(k);
                        breakdown.push({ key: k, label: L[k], weight: W[k], completion: +val.toFixed(3) });
                    }
                    var index = present > 0 ? +(100 * weighted / present).toFixed(1) : 0;
                    var s = RZEngine.models.commissioning.status(index);
                    return { index: index, status: s.status, label: s.label, breakdown: breakdown, open: open, coverage: +present.toFixed(3) };
                }
            },

            /* ── v2.4.0: asset intelligence (health index) model — Layer 9 ── */
            asset: {
                /** Design life (years) for an asset class, else null. */
                designLife: function (assetClass) {
                    var d = DATA.asset.designLifeYears[assetClass];
                    return d != null ? d : null;
                },
                /** Health status for a 0-100 health index. */
                status: function (health) {
                    var bands = DATA.asset.statusBands;
                    for (var i = 0; i < bands.length; i++) {
                        if (health >= bands[i].min) return { status: bands[i].status, label: bands[i].label };
                    }
                    return { status: 'Critical', label: bands[bands.length - 1].label };
                },
                /** Asset health index. Inputs: { assetClass|designLifeYears, ageYears,
                 *  condition (0-1, 1=as-new), duty (0-1 load/stress, 0=light) }. Remaining-
                 *  life fraction + condition + inverse-duty → 0-100 health + status +
                 *  remaining years. */
                healthIndex: function (inp) {
                    inp = inp || {};
                    var life = inp.designLifeYears != null ? inp.designLifeYears : RZEngine.models.asset.designLife(inp.assetClass);
                    if (life == null || life <= 0) life = 15;
                    var age = Math.max(0, inp.ageYears || 0);
                    var remainingFrac = Math.max(0, Math.min(1, (life - age) / life));
                    var condition = inp.condition != null ? Math.max(0, Math.min(1, inp.condition)) : remainingFrac;
                    var duty = inp.duty != null ? Math.max(0, Math.min(1, inp.duty)) : 0.5;
                    var W = DATA.asset.weights;
                    var health = +(100 * (W.remainingLife * remainingFrac + W.condition * condition + W.duty * (1 - duty))).toFixed(1);
                    var s = RZEngine.models.asset.status(health);
                    return {
                        health: health, status: s.status, label: s.label,
                        remainingYears: +(life - age).toFixed(1), designLifeYears: life,
                        remainingFraction: +remainingFrac.toFixed(3)
                    };
                }
            },

            /* ── v2.4.0: construction schedule model — Layer 6 ── */
            construction: {
                /** Build a Gantt-ready schedule from per-phase durations (months).
                 *  durations = { design, permit, ... } (missing → 0). Applies each
                 *  phase's overlap fraction against its predecessor (fast-track).
                 *  Returns rows [{key,label,startMonth,endMonth,months}], totalMonths,
                 *  and milestone month markers. */
                schedule: function (durations) {
                    durations = durations || {};
                    var order = DATA.construction.phaseOrder, ov = DATA.construction.overlap, L = DATA.construction.phaseLabels;
                    var rows = [], cursor = 0, prevEnd = 0, endByKey = {};
                    for (var i = 0; i < order.length; i++) {
                        var k = order[i];
                        var dur = +durations[k] || 0;
                        // start = predecessor end minus allowed overlap of THIS phase
                        var start = i === 0 ? 0 : Math.max(0, prevEnd - (ov[k] || 0) * dur);
                        var end = start + dur;
                        rows.push({ key: k, label: L[k], startMonth: +start.toFixed(1), endMonth: +end.toFixed(1), months: +dur.toFixed(1) });
                        endByKey[k] = end;
                        prevEnd = end; cursor = Math.max(cursor, end);
                    }
                    var milestones = {};
                    var ms = DATA.construction.milestones;
                    for (var m in ms) { if (ms.hasOwnProperty(m)) milestones[m] = endByKey[ms[m]] != null ? +endByKey[ms[m]].toFixed(1) : null; }
                    return { rows: rows, totalMonths: +cursor.toFixed(1), milestones: milestones };
                },
                /** Convenience: schedule directly from a models.capex timeline object. */
                fromTimeline: function (timeline) {
                    return RZEngine.models.construction.schedule(timeline || {});
                }
            },

            /* ── v2.4.0: requirements intake model — Layer 1 ── */
            requirements: {
                /** Use-case profile (density/cooling/tier defaults), or null. */
                profile: function (useCase) {
                    var p = DATA.requirements.useCaseProfiles[(useCase || '').toLowerCase()];
                    return p || null;
                },
                /** Intake completeness: fraction of required fields present + the
                 *  missing list + a ready flag. A value is "present" if non-null,
                 *  non-empty, and (for numbers) > 0. */
                completeness: function (intake) {
                    intake = intake || {};
                    var req = DATA.requirements.required, have = [], missing = [];
                    for (var i = 0; i < req.length; i++) {
                        var k = req[i], v = intake[k];
                        var present = v != null && v !== '' && !(typeof v === 'number' && !(v > 0));
                        if (present) have.push(k); else missing.push(k);
                    }
                    var pct = +(100 * have.length / req.length).toFixed(1);
                    return { pct: pct, have: have, missing: missing, ready: missing.length === 0 };
                },
                /** Validate a brief: completeness + a coarse tier-floor check for the
                 *  use case. Returns { completeness, flags:[...], recommendedTierFloor }. */
                validate: function (intake) {
                    intake = intake || {};
                    var comp = RZEngine.models.requirements.completeness(intake);
                    var prof = RZEngine.models.requirements.profile(intake.useCase);
                    var flags = [];
                    if (prof && intake.targetTier != null && intake.targetTier < prof.tierFloor) {
                        flags.push({ level: 'warn', field: 'targetTier', message: 'Target Tier ' + intake.targetTier + ' is below the ' + prof.label + ' recommended floor (Tier ' + prof.tierFloor + ')' });
                    }
                    return { completeness: comp, flags: flags, recommendedTierFloor: prof ? prof.tierFloor : null, profile: prof };
                }
            },

            /* ── v2.4.0: architecture disciplines + complexity model — Layer 3 ── */
            architecture: {
                /** Complexity band for a 0-100 index. */
                band: function (index) {
                    var b = DATA.architecture.complexityBands;
                    for (var i = 0; i < b.length; i++) { if (index >= b[i].min) return b[i].band; }
                    return 'Standard';
                },
                /** Normalized design-complexity index (0-100) from cooling x tier x
                 *  redundancy multipliers. */
                complexity: function (inp) {
                    inp = inp || {};
                    var A = DATA.architecture;
                    var c = A.coolingComplexity[inp.coolingType] || 1.0;
                    var t = A.tierComplexity[inp.tier] || 1.0;
                    var r = A.redundancyComplexity[inp.redundancy] || 1.0;
                    var index = +(100 * (c * t * r) / A.complexityMax).toFixed(1);
                    if (index > 100) index = 100;
                    return { index: index, band: RZEngine.models.architecture.band(index), drivers: { cooling: c, tier: t, redundancy: r } };
                },
                /** Discipline spec summary: each canonical discipline + its primary
                 *  driver for the given inputs. */
                disciplines: function (inp) {
                    inp = inp || {};
                    var A = DATA.architecture;
                    var drivers = {
                        electrical: 'Tier ' + (inp.tier || '?') + ' / ' + (inp.redundancy || 'N') + ' redundancy',
                        mechanical: (inp.coolingType || 'air') + ' cooling',
                        cooling: (inp.coolingType || 'air'),
                        fire: 'clean-agent + VESDA (Tier ' + (inp.tier || '?') + ')',
                        security: 'multi-layer (Tier ' + (inp.tier || '?') + ')',
                        network: 'redundant fabric',
                        building: 'purpose-built shell',
                        structural: (inp.coolingType === 'immersion' ? 'high floor loading (immersion)' : 'standard floor loading'),
                        bms: 'BMS + DCIM integration'
                    };
                    return A.disciplines.map(function (d) {
                        return { key: d, label: A.disciplineLabels[d], driver: drivers[d] || '' };
                    });
                }
            }
        },
        /**
         * Modal helper. Creates a singleton DOM element keyed by `id`, returns
         * { show, hide, destroy }. Reuses existing element on repeat calls.
         *
         * Usage:
         *   var m = RZEngine.modal.create({
         *       id: 'myLogin', title: 'Pro Analysis', accentColor: '#dc2626',
         *       bodyHTML: '<input id="email" placeholder="email">',
         *       onSubmit: function(box){ ... },
         *       submitLabel: 'Unlock', closeLabel: '×'
         *   });
         *   m.show();
         */
        modal: {
            create: function (opts) {
                opts = opts || {};
                var id = opts.id || 'rz-modal-' + Math.random().toString(36).slice(2, 8);
                var existing = root.document && root.document.getElementById(id);
                if (existing) {
                    return {
                        show: function () { existing.classList.add('open'); },
                        hide: function () { existing.classList.remove('open'); },
                        destroy: function () { if (existing.parentNode) existing.parentNode.removeChild(existing); }
                    };
                }
                if (!root.document) return { show: function () {}, hide: function () {}, destroy: function () {} };

                var accent = opts.accentColor || '#dc2626';
                var overlay = root.document.createElement('div');
                overlay.id = id;
                overlay.className = 'rz-modal-overlay';
                overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
                    'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
                    'z-index:9999;align-items:center;justify-content:center;';
                overlay.innerHTML =
                    '<div class="rz-modal-box" style="background:linear-gradient(145deg,#0f172a,#1e293b);' +
                        'border-radius:12px;padding:2rem;width:min(380px,92vw);position:relative;' +
                        'border:1px solid #334155;color:#f1f5f9;">' +
                        '<button class="rz-modal-close" aria-label="Close" style="position:absolute;top:0.75rem;' +
                            'right:0.75rem;background:none;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;">' +
                            (opts.closeLabel || '&times;') + '</button>' +
                        '<h3 style="color:#f1f5f9;font-size:1.1rem;margin:0 0 0.4rem;">' +
                            '<i class="fas fa-lock" style="color:' + accent + ';margin-right:0.4rem;"></i>' +
                            (opts.title || 'Sign in') + '</h3>' +
                        (opts.subtitle ? '<p style="color:#94a3b8;font-size:0.82rem;margin:0 0 1.25rem;">' + opts.subtitle + '</p>' : '') +
                        '<div class="rz-modal-body">' + (opts.bodyHTML || '') + '</div>' +
                        (opts.submitLabel ? '<button class="rz-modal-submit" style="width:100%;padding:0.7rem;' +
                            'background:' + accent + ';color:#fff;border:none;border-radius:7px;font-size:0.9rem;' +
                            'font-weight:700;cursor:pointer;margin-top:0.25rem;">' + opts.submitLabel + '</button>' : '') +
                    '</div>';
                (root.document.body || root.document.documentElement).appendChild(overlay);

                // Inject opacity-class style once
                if (!root.document.getElementById('rz-modal-css')) {
                    var s = root.document.createElement('style');
                    s.id = 'rz-modal-css';
                    s.textContent = '.rz-modal-overlay.open{display:flex !important;}';
                    root.document.head.appendChild(s);
                }

                overlay.querySelector('.rz-modal-close').addEventListener('click', function () {
                    overlay.classList.remove('open');
                });
                var submitBtn = overlay.querySelector('.rz-modal-submit');
                if (submitBtn && typeof opts.onSubmit === 'function') {
                    submitBtn.addEventListener('click', function () {
                        try { opts.onSubmit(overlay); } catch (e) {}
                    });
                }

                return {
                    show: function () { overlay.classList.add('open'); },
                    hide: function () { overlay.classList.remove('open'); },
                    destroy: function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
                };
            },
            show: function (id) {
                var el = root.document && root.document.getElementById(id);
                if (el) el.classList.add('open');
            },
            hide: function (id) {
                var el = root.document && root.document.getElementById(id);
                if (el) el.classList.remove('open');
            }
        },
        pdf: {
            exportPDF: null,        // S3 — full PDF export pipeline (TBD)
            generateTable: null,    // S3
            /**
             * Return the canonical <script src="auth.js"> + <script src="rz-engine.js">
             * pair pre-escaped for safe embedding inside ANY JS string / template literal.
             *
             * Always use this in PDF print-window templates instead of writing the
             * literal tags inline. See standarization/PDF_EXPORT_STANDARD.md
             * "Lesson learnt: 2026-05-09" for context.
             *
             * The escape `<\/script>` is a no-op JS string escape (interpreted as `</script>`
             * at runtime) but is opaque to the HTML tokenizer — so it does NOT prematurely
             * close the surrounding <script> block on the calling page.
             */
            scriptTagsHTML: function () {
                // On disk this source uses `<\/script>` — a no-op JS escape
                // that keeps the surrounding <script> block from closing on the
                // calling page. At runtime the returned string is the real
                // `</script>` characters which the print-window's HTML parser
                // will see (correctly) as a tag closer.
                return '<script src="auth.js?v=20260324b"><\/script>' +
                       '<script src="rz-engine.min.js?v=2026-07-15-dsc"><\/script>';
            }
        },
        /* ── A7: lightweight framework-free SVG chart builders. Each returns an SVG string
         *    (consistent with ui.* HTML-string helpers). No external chart lib needed. ── */
        charts: {
            _svg: function (w, h, inner) {
                return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" preserveAspectRatio="xMidYMid meet" ' +
                    'role="img" style="font-family:inherit;overflow:visible;">' + inner + '</svg>';
            },
            /** Histogram of Monte-Carlo samples with P10/P50/P90 markers. */
            histogram: function (samples, opts) {
                opts = opts || {}; var w = opts.width || 480, h = opts.height || 200, pad = 28, bins = opts.bins || 24;
                if (!samples || !samples.length) return RZEngine.charts._svg(w, h, '');
                var lo = samples[0], hi = samples[samples.length - 1], span = (hi - lo) || 1;
                var counts = new Array(bins).fill(0);
                samples.forEach(function (v) { var b = Math.min(bins - 1, Math.floor((v - lo) / span * bins)); counts[b]++; });
                var maxC = Math.max.apply(null, counts) || 1, bw = (w - 2 * pad) / bins, inner = '';
                var accent = opts.accent || '#dc2626';
                for (var i = 0; i < bins; i++) {
                    var bh = (counts[i] / maxC) * (h - 2 * pad);
                    inner += '<rect x="' + (pad + i * bw).toFixed(1) + '" y="' + (h - pad - bh).toFixed(1) +
                        '" width="' + (bw - 1).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + accent + '" opacity="0.75"/>';
                }
                var pct = function (p) { return samples[Math.min(samples.length - 1, Math.floor(p * samples.length))]; };
                [['P10', pct(0.10)], ['P50', pct(0.50)], ['P90', pct(0.90)]].forEach(function (m) {
                    var x = pad + (m[1] - lo) / span * (w - 2 * pad);
                    inner += '<line x1="' + x.toFixed(1) + '" y1="' + pad + '" x2="' + x.toFixed(1) + '" y2="' + (h - pad) +
                        '" stroke="#0891b2" stroke-width="1.5" stroke-dasharray="3 2"/>' +
                        '<text x="' + x.toFixed(1) + '" y="' + (pad - 6) + '" font-size="10" fill="#64748b" text-anchor="middle">' + m[0] + '</text>';
                });
                return RZEngine.charts._svg(w, h, inner);
            },
            /** Tornado bars from sim.tornado() rows. `row.key` is placed into an SVG <text> node
             *  (which does NOT execute HTML), but callers MUST pass trusted/hardcoded labels — do
             *  not feed unsanitised user input as a distribution key. */
            tornado: function (rows, opts) {
                opts = opts || {}; var w = opts.width || 480, pad = 90, rh = 26, gap = 8;
                if (!rows || !rows.length) return RZEngine.charts._svg(w, 40, '');
                var h = rows.length * (rh + gap) + 20;
                var base = rows[0].base, maxSwing = Math.max.apply(null, rows.map(function (r) { return Math.max(Math.abs(r.high - base), Math.abs(r.low - base)); })) || 1;
                var mid = (w + pad) / 2, half = (w - pad - 20) / 2, inner = '';
                rows.forEach(function (r, i) {
                    var y = 10 + i * (rh + gap);
                    var xl = (r.low - base) / maxSwing * half, xh = (r.high - base) / maxSwing * half;
                    var x0 = mid + Math.min(xl, xh), ww = Math.abs(xh - xl);
                    inner += '<text x="' + (pad - 6) + '" y="' + (y + rh / 2 + 3) + '" font-size="10" fill="#64748b" text-anchor="end">' + r.key + '</text>' +
                        '<rect x="' + x0.toFixed(1) + '" y="' + y + '" width="' + ww.toFixed(1) + '" height="' + rh + '" fill="' + (opts.accent || '#dc2626') + '" opacity="0.7" rx="2"/>';
                });
                inner += '<line x1="' + mid + '" y1="4" x2="' + mid + '" y2="' + (h - 6) + '" stroke="#94a3b8" stroke-width="1"/>';
                return RZEngine.charts._svg(w, h, inner);
            },
            /** Heatmap of sim.sensitivityGrid() output. */
            sensitivity: function (grid, opts) {
                opts = opts || {}; var w = opts.width || 320, h = opts.height || 320, pad = 30;
                if (!grid || !grid.z || !grid.z.length) return RZEngine.charts._svg(w, h, '');
                var flat = grid.z.reduce(function (a, r) { return a.concat(r); }, []);
                var lo = Math.min.apply(null, flat), hi = Math.max.apply(null, flat), span = (hi - lo) || 1;
                var cols = grid.x.length, rows = grid.y.length, cw = (w - 2 * pad) / cols, ch = (h - 2 * pad) / rows, inner = '';
                for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
                    var t = (grid.z[j][i] - lo) / span; var g = Math.round(220 - t * 180);
                    inner += '<rect x="' + (pad + i * cw).toFixed(1) + '" y="' + (pad + (rows - 1 - j) * ch).toFixed(1) +
                        '" width="' + Math.ceil(cw) + '" height="' + Math.ceil(ch) + '" fill="rgb(' + (60 + t * 160 | 0) + ',' + g + ',180)"/>';
                }
                return RZEngine.charts._svg(w, h, inner);
            },
            /** Simple line chart of [{x,y}] (or parallel arrays via opts). */
            roiLine: function (points, opts) {
                opts = opts || {}; var w = opts.width || 480, h = opts.height || 200, pad = 30;
                if (!points || !points.length) return RZEngine.charts._svg(w, h, '');
                var xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
                var xlo = Math.min.apply(null, xs), xhi = Math.max.apply(null, xs), ylo = Math.min.apply(null, ys), yhi = Math.max.apply(null, ys);
                var sx = function (x) { return pad + (x - xlo) / ((xhi - xlo) || 1) * (w - 2 * pad); };
                var sy = function (y) { return h - pad - (y - ylo) / ((yhi - ylo) || 1) * (h - 2 * pad); };
                var d = points.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join(' ');
                var zeroY = sy(0);
                var inner = (ylo < 0 && yhi > 0 ? '<line x1="' + pad + '" y1="' + zeroY.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + zeroY.toFixed(1) + '" stroke="#cbd5e1" stroke-dasharray="2 2"/>' : '') +
                    '<path d="' + d + '" fill="none" stroke="' + (opts.accent || '#dc2626') + '" stroke-width="2"/>';
                return RZEngine.charts._svg(w, h, inner);
            },
            /** Stacked bar of cost components per category. series=[{label, parts:[num...]}], legend=[str...]. */
            costStackedBar: function (series, legend, opts) {
                opts = opts || {}; var w = opts.width || 480, h = opts.height || 220, pad = 34;
                if (!series || !series.length) return RZEngine.charts._svg(w, h, '');
                var palette = opts.palette || ['#dc2626', '#0891b2', '#f59e0b', '#16a34a', '#8b5cf6', '#d946ef'];
                var totals = series.map(function (s) { return s.parts.reduce(function (a, b) { return a + b; }, 0); });
                var maxT = Math.max.apply(null, totals) || 1, bw = (w - 2 * pad) / series.length * 0.6, gap = (w - 2 * pad) / series.length, inner = '';
                series.forEach(function (s, i) {
                    var x = pad + i * gap + (gap - bw) / 2, yAcc = h - pad;
                    s.parts.forEach(function (p, k) {
                        var ph = p / maxT * (h - 2 * pad); yAcc -= ph;
                        inner += '<rect x="' + x.toFixed(1) + '" y="' + yAcc.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="' + palette[k % palette.length] + '"/>';
                    });
                    inner += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - pad + 12) + '" font-size="10" fill="#64748b" text-anchor="middle">' + (s.label || '') + '</text>';
                });
                return RZEngine.charts._svg(w, h, inner);
            },
            /** Cumulative hiring trajectory line from an array of {year, base} (hiringPlan output). */
            hiringTrajectory: function (perYear, opts) {
                var pts = (perYear || []).map(function (r) { return { x: r.year, y: r.base }; });
                return RZEngine.charts.roiLine(pts, Object.assign({ accent: '#0891b2' }, opts || {}));
            },
            radar: null
        },
        /**
         * UI primitives — pure DOM helpers that emit HTML strings or attach to existing elements.
         * Keep these lightweight; they are called from many calculator IIFEs.
         */
        ui: {
            /**
             * Render a gate overlay HTML string. Caller injects as innerHTML or appendChild.
             * Used to lock Pro panels behind login.
             */
            gateOverlay: function (message, ctaLabel, ctaHandlerName) {
                message = message || 'Pro analysis required';
                ctaLabel = ctaLabel || 'Unlock Pro';
                var onclickAttr = ctaHandlerName ? (' onclick="' + ctaHandlerName + '()"') : '';
                return '<div class="rz-gate" style="position:absolute;inset:0;display:flex;flex-direction:column;' +
                    'align-items:center;justify-content:center;gap:0.75rem;background:rgba(15,23,42,0.85);' +
                    'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:inherit;z-index:5;">' +
                    '<i class="fas fa-lock" style="font-size:1.5rem;color:#dc2626;"></i>' +
                    '<p style="color:#cbd5e1;font-size:0.85rem;margin:0;text-align:center;">' + message + '</p>' +
                    '<button' + onclickAttr + ' style="padding:0.5rem 1.25rem;background:#dc2626;color:#fff;' +
                        'border:none;border-radius:6px;font-size:0.82rem;font-weight:700;cursor:pointer;">' +
                        ctaLabel + '</button>' +
                    '</div>';
            },

            /**
             * KPI card HTML string. Caller appends to a grid container.
             * Use accentColor to match article theme.
             */
            kpiCard: function (label, value, subLabel, accentColor) {
                accentColor = accentColor || '#dc2626';
                return '<div class="rz-kpi-card" style="background:#fff;border:1px solid #e5e7eb;' +
                    'border-top:3px solid ' + accentColor + ';border-radius:10px;padding:0.875rem;">' +
                    '<div class="rz-kpi-label" style="font-size:0.72rem;font-weight:600;text-transform:uppercase;' +
                        'letter-spacing:0.05em;color:#6b7280;margin-bottom:0.4rem;">' + (label || '') + '</div>' +
                    '<div class="rz-kpi-value" style="font-size:1.4rem;font-weight:800;color:' + accentColor +
                        ';line-height:1.1;margin-bottom:0.3rem;">' + (value == null ? '—' : value) + '</div>' +
                    '<div class="rz-kpi-sub" style="font-size:0.72rem;color:#6b7280;line-height:1.4;">' +
                        (subLabel || '') + '</div>' +
                    '</div>';
            },

            /**
             * Inline badge HTML string. Variants map to standard CALCULATOR_PROMPT_STANDARD palette.
             * variant: 'create'|'sub'|'extend'|'fast'|'medium'|'slow'|'imm'|'cost1'|'cost2'|'cost3'|'cost4'
             */
            badge: function (text, variant) {
                var map = {
                    create:    { bg: '#dcfce7', fg: '#166534' },
                    sub:       { bg: '#dbeafe', fg: '#1d4ed8' },
                    extend:    { bg: '#fef3c7', fg: '#92400e' },
                    imm:       { bg: '#f0fdf4', fg: '#15803d' },
                    fast:      { bg: '#ecfdf5', fg: '#047857' },
                    medium:    { bg: '#fffbeb', fg: '#b45309' },
                    slow:      { bg: '#fff7ed', fg: '#c2410c' },
                    vslow:     { bg: '#fef2f2', fg: '#991b1b' },
                    cost1:     { bg: '#f0fdf4', fg: '#166534' },
                    cost2:     { bg: '#fffbeb', fg: '#713f12' },
                    cost3:     { bg: '#fff7ed', fg: '#9a3412' },
                    cost4:     { bg: '#fef2f2', fg: '#991b1b' }
                };
                var c = map[variant] || map.create;
                return '<span class="rz-badge" style="display:inline-block;font-size:0.7rem;font-weight:700;' +
                    'padding:0.2rem 0.55rem;border-radius:6px;letter-spacing:0.04em;background:' + c.bg +
                    ';color:' + c.fg + ';">' + (text || '') + '</span>';
            },

            /**
             * Build an <a> tag pointing to a glossary term anchor.
             * Returns HTML string. Use as `<p>... ' + RZEngine.ui.glossaryAnchor('AIOps','aiops') + ' ...</p>`
             */
            glossaryAnchor: function (term, slug) {
                if (!term || !slug) return term || '';
                return '<a href="glossary.html#term-' + slug + '" class="rz-glossary-link">' + term + '</a>';
            },

            /**
             * Attach a hover tooltip to an existing element.
             * `el` can be a DOM node or a selector string.
             * Falls back to native `title` attribute if document is unavailable.
             */
            tooltip: function (el, content) {
                if (!root.document) return;
                var node = (typeof el === 'string') ? root.document.querySelector(el) : el;
                if (!node) return;
                node.setAttribute('title', content || '');
                node.classList.add('rz-tooltip-target');
            }
        }
    };

    root.RZEngine = RZEngine;
    /* v2.3.0 — CommonJS export so Node consumers (DCMOC build, test harness) can require() */
    if (typeof module !== 'undefined' && module.exports) module.exports = RZEngine;
})(typeof window !== 'undefined' ? window : this);
