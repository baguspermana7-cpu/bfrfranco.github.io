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
        version: '2.1.0',
        lastUpdated: '2026-07-05',
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
            offsetPrice:   18       // $/tCO₂e voluntary offset
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

        /* ── A1: provenance sidecar. Keyed by DATA path → { source, asOf, unit?, method? }.
         * The provenance test asserts every economically-material leaf is registered here. */
        sources: {
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
            'hoursPerYear':           { source: 'Calendar constant (non-leap)', asOf: 'const', unit: 'h/yr' }
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
                       '<script src="rz-engine.min.js?v=2026-07-05-v21"><\/script>';
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
})(typeof window !== 'undefined' ? window : this);
