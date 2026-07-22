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
        version: '2.5.1',
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
        currency: { USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 152, INR: 83.5, MYR: 4.45, IDR: 16250, SGD: 1.35, AUD: 1.52, BRL: 5.05, CLP: 950, CNY: 7.15, COP: 4100, KES: 129, KRW: 1360, MXN: 18.5, NZD: 1.65, PHP: 58, PLN: 4.0, QAR: 3.64, SAR: 3.75, SEK: 10.6, THB: 36, TWD: 32, VND: 25400, ZAR: 18.5, OMR: 0.385, CAD: 1.40, NOK: 10.5, DKK: 6.54, CHF: 0.81 }, // +5 for the 40-country expansion (gateway /fx-verified 2026-07)

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
            /* inrow/rdhx rows added v2.3.0 so capex-calculator + DCMOC granularity is engine-owned.
             * v2.5.2 (Ship-B cooling ladder): immersion split into 1φ/2φ + microfluidic EMERGING.
             * `immersion` kept as backward-compat alias (≈ immersion_1p). Monotonic ladder:
             * air > inrow > rdhx > liquid > immersion_1p > immersion_2p; microfluidic (EMERGING,
             * in-chip) sits ~immersion_2p — no production PUE published, modelled at DLC+free-cool. */
            inrow:        { tier2: 1.34, tier3: 1.27, tier4: 1.22 },
            rdhx:         { tier2: 1.24, tier3: 1.18, tier4: 1.14 },
            air:          { tier2: 1.62, tier3: 1.50, tier4: 1.44 },
            liquid:       { tier2: 1.22, tier3: 1.15, tier4: 1.10 },
            immersion:    { tier2: 1.07, tier3: 1.04, tier4: 1.03 },
            immersion_1p: { tier2: 1.07, tier3: 1.04, tier4: 1.03 },
            immersion_2p: { tier2: 1.05, tier3: 1.03, tier4: 1.02 },
            microfluidic: { tier2: 1.06, tier3: 1.03, tier4: 1.02 }
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
        opex: {
            /* v2.5.1 — shared OPEX basis presets (Phase Q): both DCMOC and
             * opex-calculator.html call totalAnnual with an explicit preset so the
             * documented divergence (retail-rate 70%-util screening vs DC-contract
             * 100%-util) is PARAMETERIZED, not forked. */
            basisPresets: {
                dcContract:      { utilization: 1.0,  label: 'DC-contract rate · 100% utilization' },
                retailScreening: { utilization: 0.7,  label: 'Retail tariff screening · 70% utilization' }
            }
        },
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

        // ── Canonical country reference — THE single source of truth for region /
        //    country economics (electricity rate, tax, grid carbon, labor, disaster,
        //    grid, talent, fuel, incentives, constructionIndex). GENERATED from
        //    dcmoc/src/constants/countries.ts by tools/build-countries-data.mjs.
        //    DO NOT hand-edit between the markers — edit countries.ts and rebuild.
        /* @@COUNTRIES_START */
        countries: {
            "ID": {
                "id": "ID",
                "region": "APAC",
                "name": "Indonesia",
                "currency": "USD",
                "currencySymbol": "$",
                "economy": {
                    "inflationRate": 0.032,
                    "laborEscalation": 0.065,
                    "taxRate": 0.22,
                    "electricityRate": 0.09
                },
                "constructionIndex": 0.65,
                "labor": {
                    "minimumWage": 350,
                    "baseSalary_ShiftLead": 1500,
                    "baseSalary_Engineer": 1000,
                    "baseSalary_Technician": 550,
                    "baseSalary_Admin": 450,
                    "baseSalary_Janitor": 350,
                    "laborRatePerHour": 10,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 3,
                            "tenthHourPlus": 4
                        },
                        "maxOvertimeHoursPerWeek": 18
                    },
                    "shrinkageFactor": 0.2,
                    "leaves": {
                        "annual": 12,
                        "publicHolidays": 15,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.104,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.08,
                    "workingHoursPerMonth": 152
                },
                "compliance": {
                    "certifications": [
                        "Sertifikat Laik Operasi (SLO)",
                        "Ahli K3 Listrik",
                        "AMDAL",
                        "PP 35/2021"
                    ],
                    "annualComplianceCost": 6500,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 120,
                    "gridCarbonIntensity": 0.7,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 300,
                    "pgaPct2in50yr": 60
                },
                "risk": {
                    "downtimeCostPerMin": 1500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.35,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Batam FTZ",
                        "Nusantara Capital (IKN)",
                        "Cikarang SEZ"
                    ],
                    "taxHolidayYears": 10,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "Tax Holiday PP 40/2021",
                        "Super Deduction R&D",
                        "IKN Capital Incentive"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 3,
                    "floodRisk": "high",
                    "typhoonRisk": "none",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 68,
                    "insuranceMultiplier": 1.6,
                    "structuralReinforcement": 0.12
                },
                "gridReliability": {
                    "gridUptime": 99.5,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 18,
                    "averageOutageDuration": 45,
                    "gridTier": 2,
                    "backupFuelPremium": 0.15,
                    "recommendedGenHours": 72,
                    "renewableReadiness": 55
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 45,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 45,
                    "salaryPremium": 1.1,
                    "talentScore": 55,
                    "certifiedProfessionals": 320
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.95,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.05,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "SG": {
                "id": "SG",
                "region": "APAC",
                "name": "Singapore",
                "currency": "SGD",
                "currencySymbol": "S$",
                "economy": {
                    "inflationRate": 0.022,
                    "laborEscalation": 0.04,
                    "taxRate": 0.17,
                    "electricityRate": 0.22
                },
                "constructionIndex": 1.1,
                "labor": {
                    "minimumWage": 1400,
                    "baseSalary_ShiftLead": 5500,
                    "baseSalary_Engineer": 4500,
                    "baseSalary_Technician": 3200,
                    "baseSalary_Admin": 2800,
                    "baseSalary_Janitor": 1800,
                    "laborRatePerHour": 35,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 14,
                        "publicHolidays": 11,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.17,
                    "benefitsOverheadRate": 0.2,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 154
                },
                "compliance": {
                    "certifications": [
                        "SS 564",
                        "BCA Green Mark"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 45,
                    "gridCarbonIntensity": 0.4,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 15,
                    "pgaPct2in50yr": 2
                },
                "risk": {
                    "downtimeCostPerMin": 4500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "fta",
                    "gpuExportTier": 2,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Jurong Island",
                        "Changi Business Park"
                    ],
                    "taxHolidayYears": 5,
                    "taxHolidayRate": 0.05,
                    "incentivePrograms": [
                        "Pioneer Certificate",
                        "Development & Expansion Incentive",
                        "Green DC Incentive"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.05
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 12,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.999,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 1,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 40
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 8,
                    "hyperscalerPresence": 8,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.15,
                    "talentScore": 72,
                    "certifiedProfessionals": 850
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.55,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.8,
                    "fuelTaxRate": 0.1,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 30000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "MY": {
                "id": "MY",
                "region": "APAC",
                "name": "Malaysia",
                "currency": "MYR",
                "currencySymbol": "RM",
                "economy": {
                    "inflationRate": 0.03,
                    "laborEscalation": 0.045,
                    "taxRate": 0.24,
                    "electricityRate": 0.09
                },
                "constructionIndex": 0.7,
                "labor": {
                    "minimumWage": 340,
                    "baseSalary_ShiftLead": 1800,
                    "baseSalary_Engineer": 1200,
                    "baseSalary_Technician": 700,
                    "baseSalary_Admin": 500,
                    "baseSalary_Janitor": 350,
                    "laborRatePerHour": 8,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 3,
                            "tenthHourPlus": 3
                        }
                    },
                    "shrinkageFactor": 0.18,
                    "leaves": {
                        "annual": 12,
                        "publicHolidays": 16,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.15,
                    "benefitsOverheadRate": 0.22,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "Suruhanjaya Tenaga",
                        "GBI"
                    ],
                    "annualComplianceCost": 5000,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 90,
                    "gridCarbonIntensity": 0.6,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 50,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 1200
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.1,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Iskandar Malaysia",
                        "Cyberjaya",
                        "Kulim Hi-Tech Park"
                    ],
                    "taxHolidayYears": 10,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "MSC Malaysia Status",
                        "Pioneer Status",
                        "Green Technology Tax Allowance"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "high",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 28,
                    "insuranceMultiplier": 1.15,
                    "structuralReinforcement": 0.02
                },
                "gridReliability": {
                    "gridUptime": 99.9,
                    "voltageStability": "stable",
                    "brownoutFrequency": 4,
                    "averageOutageDuration": 20,
                    "gridTier": 1,
                    "backupFuelPremium": 0.05,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 60
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 25,
                    "hyperscalerPresence": 5,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.1,
                    "talentScore": 60,
                    "certifiedProfessionals": 420
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.55,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "US": {
                "id": "US",
                "region": "AMER",
                "name": "United States",
                "currency": "USD",
                "currencySymbol": "$",
                "economy": {
                    "inflationRate": 0.027,
                    "laborEscalation": 0.04,
                    "taxRate": 0.21,
                    "electricityRate": 0.13
                },
                "constructionIndex": 1,
                "labor": {
                    "minimumWage": 2000,
                    "baseSalary_ShiftLead": 10500,
                    "baseSalary_Engineer": 8500,
                    "baseSalary_Technician": 5500,
                    "baseSalary_Admin": 4000,
                    "baseSalary_Janitor": 3000,
                    "laborRatePerHour": 45,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 1.5,
                            "ninthHour": 1.5,
                            "tenthHourPlus": 1.5
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 10,
                        "publicHolidays": 10,
                        "sickAverage": 3
                    },
                    "socialSecurityRate": 0.0765,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 158
                },
                "compliance": {
                    "certifications": [
                        "OSHA",
                        "NFPA 70E"
                    ],
                    "annualComplianceCost": 15000,
                    "environmentalPermitCostPerYear": 8000
                },
                "environment": {
                    "baselineAQI": 35,
                    "gridCarbonIntensity": 0.4,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "4A",
                    "saidiMinYr": 90,
                    "pgaPct2in50yr": 15
                },
                "risk": {
                    "downtimeCostPerMin": 5000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Foreign Trade Zones (250+)"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.21,
                    "incentivePrograms": [
                        "ITC for Energy Property",
                        "Opportunity Zones",
                        "State-level DC Sales Tax Exemptions"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.21
                },
                "naturalDisaster": {
                    "seismicZone": 2,
                    "floodRisk": "moderate",
                    "typhoonRisk": "moderate",
                    "volcanoRisk": "low",
                    "tsunamiRisk": "low",
                    "compositeScore": 38,
                    "insuranceMultiplier": 1.2,
                    "structuralReinforcement": 0.05
                },
                "gridReliability": {
                    "gridUptime": 99.97,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 10,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 70
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 120,
                    "hyperscalerPresence": 10,
                    "avgHiringDays": 30,
                    "salaryPremium": 1,
                    "talentScore": 90,
                    "certifiedProfessionals": 8500
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.05,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.2,
                    "fuelTaxRate": 0.06,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 100000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "JP": {
                "id": "JP",
                "region": "APAC",
                "name": "Japan",
                "currency": "JPY",
                "currencySymbol": "¥",
                "economy": {
                    "inflationRate": 0.028,
                    "laborEscalation": 0.03,
                    "taxRate": 0.2304,
                    "electricityRate": 0.2
                },
                "constructionIndex": 1.15,
                "labor": {
                    "minimumWage": 1200,
                    "baseSalary_ShiftLead": 4500,
                    "baseSalary_Engineer": 3500,
                    "baseSalary_Technician": 2800,
                    "baseSalary_Admin": 2200,
                    "baseSalary_Janitor": 1800,
                    "laborRatePerHour": 30,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.25
                        },
                        "holiday": {
                            "first8Hours": 1.35,
                            "ninthHour": 1.35,
                            "tenthHourPlus": 1.35
                        }
                    },
                    "shrinkageFactor": 0.08,
                    "leaves": {
                        "annual": 10,
                        "publicHolidays": 16,
                        "sickAverage": 2
                    },
                    "socialSecurityRate": 0.155,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.25,
                    "workingHoursPerMonth": 155
                },
                "compliance": {
                    "certifications": [
                        "First Class Electrician",
                        "Energy Manager"
                    ],
                    "annualComplianceCost": 8000,
                    "environmentalPermitCostPerYear": 15000
                },
                "environment": {
                    "baselineAQI": 30,
                    "gridCarbonIntensity": 0.5,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "3A",
                    "saidiMinYr": 20,
                    "pgaPct2in50yr": 80
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Okinawa FTZ",
                        "Narita FTZ"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.2304,
                    "incentivePrograms": [
                        "J-Credits Scheme",
                        "Green Innovation Fund",
                        "Regional Revitalization Tax"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.2304
                },
                "naturalDisaster": {
                    "seismicZone": 4,
                    "floodRisk": "moderate",
                    "typhoonRisk": "high",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "high",
                    "compositeScore": 82,
                    "insuranceMultiplier": 1.8,
                    "structuralReinforcement": 0.18
                },
                "gridReliability": {
                    "gridUptime": 99.99,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 5,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 55
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 50,
                    "hyperscalerPresence": 7,
                    "avgHiringDays": 60,
                    "salaryPremium": 1.1,
                    "talentScore": 70,
                    "certifiedProfessionals": 1800
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.35,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.5,
                    "fuelTaxRate": 0.08,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "AU": {
                "id": "AU",
                "region": "APAC",
                "name": "Australia",
                "currency": "AUD",
                "currencySymbol": "A$",
                "economy": {
                    "inflationRate": 0.03,
                    "laborEscalation": 0.035,
                    "taxRate": 0.3,
                    "electricityRate": 0.18
                },
                "constructionIndex": 1.05,
                "labor": {
                    "minimumWage": 3000,
                    "baseSalary_ShiftLead": 9500,
                    "baseSalary_Engineer": 8000,
                    "baseSalary_Technician": 6000,
                    "baseSalary_Admin": 5000,
                    "baseSalary_Janitor": 4000,
                    "laborRatePerHour": 40,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2.5,
                            "ninthHour": 2.5,
                            "tenthHourPlus": 2.5
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 20,
                        "publicHolidays": 10,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.12,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.15,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "WHS",
                        "Austel"
                    ],
                    "annualComplianceCost": 10000,
                    "environmentalPermitCostPerYear": 7000
                },
                "environment": {
                    "baselineAQI": 20,
                    "gridCarbonIntensity": 0.6,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "3B",
                    "saidiMinYr": 100,
                    "pgaPct2in50yr": 8
                },
                "risk": {
                    "downtimeCostPerMin": 4500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.2,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Sydney Olympic Park"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.3,
                    "incentivePrograms": [
                        "R&D Tax Incentive",
                        "Clean Energy Finance Corp",
                        "NSW Digital Economy"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.3
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "moderate",
                    "typhoonRisk": "low",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 22,
                    "insuranceMultiplier": 1.1,
                    "structuralReinforcement": 0.02
                },
                "gridReliability": {
                    "gridUptime": 99.98,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 8,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 80
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 18,
                    "hyperscalerPresence": 6,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.05,
                    "talentScore": 75,
                    "certifiedProfessionals": 1200
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.3,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.4,
                    "fuelTaxRate": 0.1,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 80000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "AE": {
                "id": "AE",
                "region": "MENA",
                "name": "UAE",
                "currency": "USD",
                "currencySymbol": "$",
                "economy": {
                    "inflationRate": 0.025,
                    "laborEscalation": 0.035,
                    "taxRate": 0.09,
                    "electricityRate": 0.09
                },
                "constructionIndex": 0.85,
                "labor": {
                    "minimumWage": 800,
                    "baseSalary_ShiftLead": 5000,
                    "baseSalary_Engineer": 4000,
                    "baseSalary_Technician": 2500,
                    "baseSalary_Admin": 2000,
                    "baseSalary_Janitor": 1200,
                    "laborRatePerHour": 25,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 1.5,
                            "ninthHour": 1.5,
                            "tenthHourPlus": 1.5
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 30,
                        "publicHolidays": 10,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.03,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "DCDA",
                        "Estidama",
                        "Civil Defence"
                    ],
                    "annualComplianceCost": 15000,
                    "environmentalPermitCostPerYear": 3000
                },
                "environment": {
                    "baselineAQI": 100,
                    "gridCarbonIntensity": 0.45,
                    "aqueductStressScore": 5,
                    "ashraeClimateZone": "1B",
                    "saidiMinYr": 30,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 3500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "fta",
                    "gpuExportTier": 2,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "JAFZA",
                        "DAFZA",
                        "Masdar City",
                        "ADGM"
                    ],
                    "taxHolidayYears": 50,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "Free Zone 0% Corp Tax (qualifying income)",
                        "Dubai D33 Digital Economy",
                        "ADIO DC incentive scheme 2025"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 8,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.98,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 5,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 75
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 6,
                    "hyperscalerPresence": 6,
                    "avgHiringDays": 30,
                    "salaryPremium": 1.15,
                    "talentScore": 65,
                    "certifiedProfessionals": 600
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.65,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": false,
                    "storageLimitLiters": 100000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "SA": {
                "id": "SA",
                "region": "MENA",
                "name": "Saudi Arabia",
                "currency": "SAR",
                "currencySymbol": "﷼",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.035,
                    "taxRate": 0.2,
                    "electricityRate": 0.05
                },
                "constructionIndex": 0.8,
                "labor": {
                    "minimumWage": 1100,
                    "baseSalary_ShiftLead": 4500,
                    "baseSalary_Engineer": 3800,
                    "baseSalary_Technician": 2200,
                    "baseSalary_Admin": 1800,
                    "baseSalary_Janitor": 1000,
                    "laborRatePerHour": 22,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 21,
                        "publicHolidays": 9,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.06,
                    "benefitsOverheadRate": 0.32,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "Saudi CDC",
                        "SASO",
                        "NEOM Standards"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 110,
                    "gridCarbonIntensity": 0.55,
                    "aqueductStressScore": 5,
                    "ashraeClimateZone": "1B",
                    "saidiMinYr": 80,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 3000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "KAEC",
                        "NEOM",
                        "Jazan Economic City"
                    ],
                    "taxHolidayYears": 10,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "Vision 2030 DC Initiative",
                        "SAGIA Investment License",
                        "NEOM Tech Incentive"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "low",
                    "tsunamiRisk": "none",
                    "compositeScore": 10,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0.01
                },
                "gridReliability": {
                    "gridUptime": 99.95,
                    "voltageStability": "stable",
                    "brownoutFrequency": 2,
                    "averageOutageDuration": 10,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 80
                },
                "talentPool": {
                    "dcEngineerPool": "scarce",
                    "universityPipeline": 8,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 50,
                    "salaryPremium": 1.2,
                    "talentScore": 45,
                    "certifiedProfessionals": 280
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.2,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": false,
                    "storageLimitLiters": 100000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "QA": {
                "id": "QA",
                "region": "MENA",
                "name": "Qatar",
                "currency": "QAR",
                "currencySymbol": "QR",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.03,
                    "taxRate": 0.1,
                    "electricityRate": 0.04
                },
                "constructionIndex": 0.85,
                "labor": {
                    "minimumWage": 1000,
                    "baseSalary_ShiftLead": 5200,
                    "baseSalary_Engineer": 4200,
                    "baseSalary_Technician": 2600,
                    "baseSalary_Admin": 2100,
                    "baseSalary_Janitor": 1300,
                    "laborRatePerHour": 24,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 1.5,
                            "ninthHour": 1.5,
                            "tenthHourPlus": 1.5
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 21,
                        "publicHolidays": 9,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.03,
                    "benefitsOverheadRate": 0.32,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "Kahramaa",
                        "QCS 2014"
                    ],
                    "annualComplianceCost": 14000,
                    "environmentalPermitCostPerYear": 3000
                },
                "environment": {
                    "baselineAQI": 95,
                    "gridCarbonIntensity": 0.48,
                    "aqueductStressScore": 5,
                    "ashraeClimateZone": "1B",
                    "saidiMinYr": 25,
                    "pgaPct2in50yr": 4
                },
                "risk": {
                    "downtimeCostPerMin": 3500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Qatar Free Zones (QFZ)",
                        "Manateq Logistics Park"
                    ],
                    "taxHolidayYears": 20,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "QFZ 0% Tax",
                        "Qatar Investment Authority Support",
                        "Smart Qatar Programme"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 5,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.97,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 8,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 70
                },
                "talentPool": {
                    "dcEngineerPool": "scarce",
                    "universityPipeline": 3,
                    "hyperscalerPresence": 2,
                    "avgHiringDays": 55,
                    "salaryPremium": 1.25,
                    "talentScore": 38,
                    "certifiedProfessionals": 120
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.3,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": false,
                    "storageLimitLiters": 80000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "ZA": {
                "id": "ZA",
                "region": "AFR",
                "name": "South Africa",
                "currency": "ZAR",
                "currencySymbol": "R",
                "economy": {
                    "inflationRate": 0.05,
                    "laborEscalation": 0.06,
                    "taxRate": 0.27,
                    "electricityRate": 0.1
                },
                "constructionIndex": 0.55,
                "labor": {
                    "minimumWage": 250,
                    "baseSalary_ShiftLead": 2200,
                    "baseSalary_Engineer": 1800,
                    "baseSalary_Technician": 1100,
                    "baseSalary_Admin": 800,
                    "baseSalary_Janitor": 400,
                    "laborRatePerHour": 12,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.22,
                    "leaves": {
                        "annual": 15,
                        "publicHolidays": 12,
                        "sickAverage": 6
                    },
                    "socialSecurityRate": 0.03,
                    "benefitsOverheadRate": 0.22,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "SABS",
                        "ECSA",
                        "OHS Act"
                    ],
                    "annualComplianceCost": 5000,
                    "environmentalPermitCostPerYear": 3000
                },
                "environment": {
                    "baselineAQI": 50,
                    "gridCarbonIntensity": 0.9,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "3A",
                    "saidiMinYr": 500,
                    "pgaPct2in50yr": 8
                },
                "risk": {
                    "downtimeCostPerMin": 1500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.3,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Coega IDZ",
                        "Dube TradePort",
                        "Richards Bay IDZ"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.27,
                    "incentivePrograms": [
                        "Section 12L Energy Efficiency",
                        "SEZ Tax Incentive (15%)",
                        "Renewable Energy Tax Deduction"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.15
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 15,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0.01
                },
                "gridReliability": {
                    "gridUptime": 95,
                    "voltageStability": "unstable",
                    "brownoutFrequency": 200,
                    "averageOutageDuration": 120,
                    "gridTier": 3,
                    "backupFuelPremium": 0.4,
                    "recommendedGenHours": 168,
                    "renewableReadiness": 75
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 15,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.05,
                    "talentScore": 60,
                    "certifiedProfessionals": 450
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.15,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.07,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "NG": {
                "id": "NG",
                "region": "AFR",
                "name": "Nigeria",
                "currency": "USD",
                "currencySymbol": "$",
                "economy": {
                    "inflationRate": 0.14,
                    "laborEscalation": 0.08,
                    "taxRate": 0.3,
                    "electricityRate": 0.12
                },
                "constructionIndex": 0.75,
                "labor": {
                    "minimumWage": 80,
                    "baseSalary_ShiftLead": 1200,
                    "baseSalary_Engineer": 900,
                    "baseSalary_Technician": 500,
                    "baseSalary_Admin": 350,
                    "baseSalary_Janitor": 150,
                    "laborRatePerHour": 6,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.25,
                    "leaves": {
                        "annual": 12,
                        "publicHolidays": 11,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.12,
                    "benefitsOverheadRate": 0.18,
                    "nightShiftPremiumRate": 0.05,
                    "workingHoursPerMonth": 155
                },
                "compliance": {
                    "certifications": [
                        "NCC",
                        "SON",
                        "NESREA"
                    ],
                    "annualComplianceCost": 3000,
                    "environmentalPermitCostPerYear": 2000
                },
                "environment": {
                    "baselineAQI": 140,
                    "gridCarbonIntensity": 0.45,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 800,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 800
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.6,
                    "importDutyBand": "high",
                    "gpuExportTier": 2,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Lekki Free Zone",
                        "Calabar FTZ",
                        "Kano FTZ"
                    ],
                    "taxHolidayYears": 5,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "Pioneer Status Tax Holiday",
                        "Export Expansion Grant",
                        "Infrastructure Tax Relief"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "high",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 20,
                    "insuranceMultiplier": 1.15,
                    "structuralReinforcement": 0.01
                },
                "gridReliability": {
                    "gridUptime": 50,
                    "voltageStability": "unstable",
                    "brownoutFrequency": 500,
                    "averageOutageDuration": 180,
                    "gridTier": 3,
                    "backupFuelPremium": 0.8,
                    "recommendedGenHours": 336,
                    "renewableReadiness": 65
                },
                "talentPool": {
                    "dcEngineerPool": "very_scarce",
                    "universityPipeline": 10,
                    "hyperscalerPresence": 2,
                    "avgHiringDays": 75,
                    "salaryPremium": 1.3,
                    "talentScore": 25,
                    "certifiedProfessionals": 60
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.9,
                    "dieselAvailability": "scarce",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.02,
                    "deliveryLeadDays": 7,
                    "environmentalPermitRequired": false,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "low"
                },
                "lastUpdated": "2026-Q1"
            },
            "KE": {
                "id": "KE",
                "region": "AFR",
                "name": "Kenya",
                "currency": "KES",
                "currencySymbol": "KSh",
                "economy": {
                    "inflationRate": 0.07,
                    "laborEscalation": 0.06,
                    "taxRate": 0.3,
                    "electricityRate": 0.15
                },
                "constructionIndex": 0.6,
                "labor": {
                    "minimumWage": 150,
                    "baseSalary_ShiftLead": 1400,
                    "baseSalary_Engineer": 1000,
                    "baseSalary_Technician": 600,
                    "baseSalary_Admin": 400,
                    "baseSalary_Janitor": 200,
                    "laborRatePerHour": 7,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.2,
                    "leaves": {
                        "annual": 21,
                        "publicHolidays": 10,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.075,
                    "benefitsOverheadRate": 0.18,
                    "nightShiftPremiumRate": 0.05,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "KEBS",
                        "ERC License"
                    ],
                    "annualComplianceCost": 3500,
                    "environmentalPermitCostPerYear": 2000
                },
                "environment": {
                    "baselineAQI": 60,
                    "gridCarbonIntensity": 0.3,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "2A",
                    "saidiMinYr": 400,
                    "pgaPct2in50yr": 15
                },
                "risk": {
                    "downtimeCostPerMin": 700
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.5,
                    "importDutyBand": "high",
                    "gpuExportTier": 2,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Nairobi SEZ",
                        "Konza Technopolis"
                    ],
                    "taxHolidayYears": 10,
                    "taxHolidayRate": 0.1,
                    "incentivePrograms": [
                        "SEZ Corporate Tax 10%",
                        "Konza Silicon Savannah",
                        "Digital Economy Blueprint"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.1
                },
                "naturalDisaster": {
                    "seismicZone": 2,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "low",
                    "tsunamiRisk": "low",
                    "compositeScore": 25,
                    "insuranceMultiplier": 1.1,
                    "structuralReinforcement": 0.03
                },
                "gridReliability": {
                    "gridUptime": 85,
                    "voltageStability": "unstable",
                    "brownoutFrequency": 120,
                    "averageOutageDuration": 90,
                    "gridTier": 3,
                    "backupFuelPremium": 0.5,
                    "recommendedGenHours": 168,
                    "renewableReadiness": 80
                },
                "talentPool": {
                    "dcEngineerPool": "very_scarce",
                    "universityPipeline": 5,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 60,
                    "salaryPremium": 1.2,
                    "talentScore": 30,
                    "certifiedProfessionals": 80
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.25,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.08,
                    "deliveryLeadDays": 5,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "BR": {
                "id": "BR",
                "region": "LATAM",
                "name": "Brazil",
                "currency": "BRL",
                "currencySymbol": "R$",
                "economy": {
                    "inflationRate": 0.045,
                    "laborEscalation": 0.05,
                    "taxRate": 0.34,
                    "electricityRate": 0.1
                },
                "constructionIndex": 0.6,
                "labor": {
                    "minimumWage": 300,
                    "baseSalary_ShiftLead": 2000,
                    "baseSalary_Engineer": 1500,
                    "baseSalary_Technician": 900,
                    "baseSalary_Admin": 700,
                    "baseSalary_Janitor": 350,
                    "laborRatePerHour": 12,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.22,
                    "leaves": {
                        "annual": 30,
                        "publicHolidays": 12,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.28,
                    "benefitsOverheadRate": 0.4,
                    "nightShiftPremiumRate": 0.2,
                    "workingHoursPerMonth": 156
                },
                "compliance": {
                    "certifications": [
                        "INMETRO",
                        "NR-10",
                        "ANATEL"
                    ],
                    "annualComplianceCost": 6000,
                    "environmentalPermitCostPerYear": 3500
                },
                "environment": {
                    "baselineAQI": 50,
                    "gridCarbonIntensity": 0.15,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 200,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 1800
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.4,
                    "importDutyBand": "high",
                    "gpuExportTier": 2,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Manaus Free Zone",
                        "ZPE Export Processing Zones"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.34,
                    "incentivePrograms": [
                        "SUDENE/SUDAM Regional Incentive",
                        "Lei do Bem R&D",
                        "Manaus Digital Hub"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.34
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "high",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 18,
                    "insuranceMultiplier": 1.1,
                    "structuralReinforcement": 0.01
                },
                "gridReliability": {
                    "gridUptime": 99.8,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 8,
                    "averageOutageDuration": 30,
                    "gridTier": 2,
                    "backupFuelPremium": 0.08,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 85
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 40,
                    "hyperscalerPresence": 5,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.05,
                    "talentScore": 58,
                    "certifiedProfessionals": 350
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.1,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.12,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "CL": {
                "id": "CL",
                "region": "LATAM",
                "name": "Chile",
                "currency": "CLP",
                "currencySymbol": "CL$",
                "economy": {
                    "inflationRate": 0.04,
                    "laborEscalation": 0.04,
                    "taxRate": 0.27,
                    "electricityRate": 0.12
                },
                "constructionIndex": 0.65,
                "labor": {
                    "minimumWage": 500,
                    "baseSalary_ShiftLead": 2300,
                    "baseSalary_Engineer": 1800,
                    "baseSalary_Technician": 1100,
                    "baseSalary_Admin": 800,
                    "baseSalary_Janitor": 500,
                    "laborRatePerHour": 14,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.15,
                    "leaves": {
                        "annual": 15,
                        "publicHolidays": 15,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.05,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "SEC",
                        "INN Chile"
                    ],
                    "annualComplianceCost": 5000,
                    "environmentalPermitCostPerYear": 3000
                },
                "environment": {
                    "baselineAQI": 40,
                    "gridCarbonIntensity": 0.35,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "3C",
                    "saidiMinYr": 200,
                    "pgaPct2in50yr": 60
                },
                "risk": {
                    "downtimeCostPerMin": 1500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.3,
                    "importDutyBand": "fta",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Iquique FTZ",
                        "Arica FTZ"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.27,
                    "incentivePrograms": [
                        "CORFO Technology Fund",
                        "Chile Green Hydrogen",
                        "Extreme Zone Tax Benefits"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.27
                },
                "naturalDisaster": {
                    "seismicZone": 4,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "high",
                    "compositeScore": 72,
                    "insuranceMultiplier": 1.7,
                    "structuralReinforcement": 0.15
                },
                "gridReliability": {
                    "gridUptime": 99.9,
                    "voltageStability": "stable",
                    "brownoutFrequency": 3,
                    "averageOutageDuration": 15,
                    "gridTier": 1,
                    "backupFuelPremium": 0.03,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 90
                },
                "talentPool": {
                    "dcEngineerPool": "scarce",
                    "universityPipeline": 8,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 45,
                    "salaryPremium": 1.15,
                    "talentScore": 48,
                    "certifiedProfessionals": 180
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.2,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.06,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "MX": {
                "id": "MX",
                "region": "LATAM",
                "name": "Mexico",
                "currency": "MXN",
                "currencySymbol": "MX$",
                "economy": {
                    "inflationRate": 0.04,
                    "laborEscalation": 0.05,
                    "taxRate": 0.3,
                    "electricityRate": 0.09
                },
                "constructionIndex": 0.6,
                "labor": {
                    "minimumWage": 350,
                    "baseSalary_ShiftLead": 1800,
                    "baseSalary_Engineer": 1400,
                    "baseSalary_Technician": 850,
                    "baseSalary_Admin": 600,
                    "baseSalary_Janitor": 350,
                    "laborRatePerHour": 10,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 2,
                            "subsequent": 3
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 3,
                            "tenthHourPlus": 3
                        }
                    },
                    "shrinkageFactor": 0.18,
                    "leaves": {
                        "annual": 12,
                        "publicHolidays": 7,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.3,
                    "benefitsOverheadRate": 0.32,
                    "nightShiftPremiumRate": 0.14,
                    "workingHoursPerMonth": 158
                },
                "compliance": {
                    "certifications": [
                        "NOM",
                        "SENER"
                    ],
                    "annualComplianceCost": 5000,
                    "environmentalPermitCostPerYear": 3000
                },
                "environment": {
                    "baselineAQI": 80,
                    "gridCarbonIntensity": 0.45,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "2A",
                    "saidiMinYr": 120,
                    "pgaPct2in50yr": 40
                },
                "risk": {
                    "downtimeCostPerMin": 1200
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.15,
                    "importDutyBand": "low",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Queretaro SEZ",
                        "Bajio Industrial Corridor"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.3,
                    "incentivePrograms": [
                        "Nearshoring Tax Incentive",
                        "IMMEX Maquiladora",
                        "CONACYT R&D Support"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.3
                },
                "naturalDisaster": {
                    "seismicZone": 3,
                    "floodRisk": "moderate",
                    "typhoonRisk": "moderate",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 62,
                    "insuranceMultiplier": 1.5,
                    "structuralReinforcement": 0.1
                },
                "gridReliability": {
                    "gridUptime": 99.7,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 12,
                    "averageOutageDuration": 35,
                    "gridTier": 2,
                    "backupFuelPremium": 0.1,
                    "recommendedGenHours": 72,
                    "renewableReadiness": 70
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 35,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.05,
                    "talentScore": 55,
                    "certifiedProfessionals": 300
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.05,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.08,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "CO": {
                "id": "CO",
                "region": "LATAM",
                "name": "Colombia",
                "currency": "COP",
                "currencySymbol": "CO$",
                "economy": {
                    "inflationRate": 0.06,
                    "laborEscalation": 0.055,
                    "taxRate": 0.35,
                    "electricityRate": 0.1
                },
                "constructionIndex": 0.55,
                "labor": {
                    "minimumWage": 280,
                    "baseSalary_ShiftLead": 1600,
                    "baseSalary_Engineer": 1200,
                    "baseSalary_Technician": 700,
                    "baseSalary_Admin": 500,
                    "baseSalary_Janitor": 300,
                    "laborRatePerHour": 8,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.75
                        },
                        "holiday": {
                            "first8Hours": 1.75,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.2,
                    "leaves": {
                        "annual": 15,
                        "publicHolidays": 18,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.21,
                    "benefitsOverheadRate": 0.35,
                    "nightShiftPremiumRate": 0.35,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "RETIE",
                        "SIC"
                    ],
                    "annualComplianceCost": 4000,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 55,
                    "gridCarbonIntensity": 0.2,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 300,
                    "pgaPct2in50yr": 40
                },
                "risk": {
                    "downtimeCostPerMin": 1000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.35,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Zona Franca Bogota",
                        "Zona Franca del Pacifico"
                    ],
                    "taxHolidayYears": 5,
                    "taxHolidayRate": 0.2,
                    "incentivePrograms": [
                        "Free Zone 20% Rate",
                        "Orange Economy Tax Benefits",
                        "Mega-Investment Incentive"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.2
                },
                "naturalDisaster": {
                    "seismicZone": 3,
                    "floodRisk": "high",
                    "typhoonRisk": "none",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "low",
                    "compositeScore": 52,
                    "insuranceMultiplier": 1.4,
                    "structuralReinforcement": 0.08
                },
                "gridReliability": {
                    "gridUptime": 99.5,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 15,
                    "averageOutageDuration": 40,
                    "gridTier": 2,
                    "backupFuelPremium": 0.12,
                    "recommendedGenHours": 72,
                    "renewableReadiness": 60
                },
                "talentPool": {
                    "dcEngineerPool": "scarce",
                    "universityPipeline": 12,
                    "hyperscalerPresence": 2,
                    "avgHiringDays": 50,
                    "salaryPremium": 1.15,
                    "talentScore": 40,
                    "certifiedProfessionals": 120
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.85,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.05,
                    "deliveryLeadDays": 4,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "IN": {
                "id": "IN",
                "region": "APAC",
                "name": "India",
                "currency": "INR",
                "currencySymbol": "₹",
                "economy": {
                    "inflationRate": 0.05,
                    "laborEscalation": 0.07,
                    "taxRate": 0.2517,
                    "electricityRate": 0.07
                },
                "constructionIndex": 0.55,
                "labor": {
                    "minimumWage": 200,
                    "baseSalary_ShiftLead": 1200,
                    "baseSalary_Engineer": 900,
                    "baseSalary_Technician": 500,
                    "baseSalary_Admin": 400,
                    "baseSalary_Janitor": 200,
                    "laborRatePerHour": 8,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 2,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.2,
                    "leaves": {
                        "annual": 12,
                        "publicHolidays": 16,
                        "sickAverage": 6
                    },
                    "socialSecurityRate": 0.13,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "BIS",
                        "CEA Regulations",
                        "LEED India"
                    ],
                    "annualComplianceCost": 4000,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 150,
                    "gridCarbonIntensity": 0.72,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "2A",
                    "saidiMinYr": 600,
                    "pgaPct2in50yr": 30
                },
                "risk": {
                    "downtimeCostPerMin": 1200
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.2,
                    "importDutyBand": "high",
                    "gpuExportTier": 2,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "SEEPZ Mumbai",
                        "Mahindra World City",
                        "GIFT City Gujarat"
                    ],
                    "taxHolidayYears": 10,
                    "taxHolidayRate": 0.15,
                    "incentivePrograms": [
                        "IT/ITES SEZ Tax Holiday",
                        "GIFT City IFSC Benefits",
                        "PLI Scheme for IT Hardware"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.15
                },
                "naturalDisaster": {
                    "seismicZone": 3,
                    "floodRisk": "extreme",
                    "typhoonRisk": "moderate",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 58,
                    "insuranceMultiplier": 1.45,
                    "structuralReinforcement": 0.08
                },
                "gridReliability": {
                    "gridUptime": 99,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 30,
                    "averageOutageDuration": 60,
                    "gridTier": 2,
                    "backupFuelPremium": 0.2,
                    "recommendedGenHours": 96,
                    "renewableReadiness": 75
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 200,
                    "hyperscalerPresence": 6,
                    "avgHiringDays": 25,
                    "salaryPremium": 1,
                    "talentScore": 78,
                    "certifiedProfessionals": 2500
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.12,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "CN": {
                "id": "CN",
                "region": "APAC",
                "name": "China",
                "currency": "CNY",
                "currencySymbol": "¥",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.06,
                    "taxRate": 0.25,
                    "electricityRate": 0.06
                },
                "constructionIndex": 0.7,
                "labor": {
                    "minimumWage": 400,
                    "baseSalary_ShiftLead": 2000,
                    "baseSalary_Engineer": 1500,
                    "baseSalary_Technician": 900,
                    "baseSalary_Admin": 700,
                    "baseSalary_Janitor": 450,
                    "laborRatePerHour": 12,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 3,
                            "ninthHour": 3,
                            "tenthHourPlus": 3
                        }
                    },
                    "shrinkageFactor": 0.15,
                    "leaves": {
                        "annual": 5,
                        "publicHolidays": 11,
                        "sickAverage": 3
                    },
                    "socialSecurityRate": 0.27,
                    "benefitsOverheadRate": 0.28,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 161
                },
                "compliance": {
                    "certifications": [
                        "GB Standards",
                        "MIIT License",
                        "Green DC Rating"
                    ],
                    "annualComplianceCost": 8000,
                    "environmentalPermitCostPerYear": 4000
                },
                "environment": {
                    "baselineAQI": 130,
                    "gridCarbonIntensity": 0.58,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "3A",
                    "saidiMinYr": 100,
                    "pgaPct2in50yr": 30
                },
                "risk": {
                    "downtimeCostPerMin": 2500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.1,
                    "importDutyBand": "punitive",
                    "gpuExportTier": 3,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Shanghai FTZ",
                        "Hainan FTP",
                        "Shenzhen Qianhai"
                    ],
                    "taxHolidayYears": 5,
                    "taxHolidayRate": 0.15,
                    "incentivePrograms": [
                        "HNTE 15% Tax Rate",
                        "Western Development Strategy",
                        "New Infrastructure Initiative"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.15
                },
                "naturalDisaster": {
                    "seismicZone": 2,
                    "floodRisk": "high",
                    "typhoonRisk": "moderate",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 42,
                    "insuranceMultiplier": 1.3,
                    "structuralReinforcement": 0.06
                },
                "gridReliability": {
                    "gridUptime": 99.95,
                    "voltageStability": "stable",
                    "brownoutFrequency": 2,
                    "averageOutageDuration": 12,
                    "gridTier": 1,
                    "backupFuelPremium": 0.02,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 60
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 300,
                    "hyperscalerPresence": 8,
                    "avgHiringDays": 20,
                    "salaryPremium": 1,
                    "talentScore": 85,
                    "certifiedProfessionals": 5000
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.1,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.05,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 80000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "KR": {
                "id": "KR",
                "region": "APAC",
                "name": "South Korea",
                "currency": "KRW",
                "currencySymbol": "₩",
                "economy": {
                    "inflationRate": 0.025,
                    "laborEscalation": 0.04,
                    "taxRate": 0.22,
                    "electricityRate": 0.135
                },
                "constructionIndex": 0.95,
                "labor": {
                    "minimumWage": 1500,
                    "baseSalary_ShiftLead": 4000,
                    "baseSalary_Engineer": 3200,
                    "baseSalary_Technician": 2400,
                    "baseSalary_Admin": 2000,
                    "baseSalary_Janitor": 1500,
                    "laborRatePerHour": 28,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 15,
                        "publicHolidays": 15,
                        "sickAverage": 3
                    },
                    "socialSecurityRate": 0.11,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.3,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "KS Standards",
                        "KISA DC Cert"
                    ],
                    "annualComplianceCost": 9000,
                    "environmentalPermitCostPerYear": 7000
                },
                "environment": {
                    "baselineAQI": 55,
                    "gridCarbonIntensity": 0.42,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "4A",
                    "saidiMinYr": 15,
                    "pgaPct2in50yr": 25
                },
                "risk": {
                    "downtimeCostPerMin": 3500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Incheon FEZ",
                        "Busan-Jinhae FEZ",
                        "Sejong Smart City"
                    ],
                    "taxHolidayYears": 5,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "FEZ Tax Exemption",
                        "Digital New Deal",
                        "K-Cloud Initiative"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "moderate",
                    "typhoonRisk": "moderate",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 30,
                    "insuranceMultiplier": 1.15,
                    "structuralReinforcement": 0.03
                },
                "gridReliability": {
                    "gridUptime": 99.99,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 3,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 50
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 35,
                    "hyperscalerPresence": 5,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.1,
                    "talentScore": 68,
                    "certifiedProfessionals": 900
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.3,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.5,
                    "fuelTaxRate": 0.1,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "TH": {
                "id": "TH",
                "region": "APAC",
                "name": "Thailand",
                "currency": "THB",
                "currencySymbol": "฿",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.04,
                    "taxRate": 0.2,
                    "electricityRate": 0.1
                },
                "constructionIndex": 0.6,
                "labor": {
                    "minimumWage": 300,
                    "baseSalary_ShiftLead": 1400,
                    "baseSalary_Engineer": 1000,
                    "baseSalary_Technician": 600,
                    "baseSalary_Admin": 450,
                    "baseSalary_Janitor": 300,
                    "laborRatePerHour": 8,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 3,
                            "tenthHourPlus": 3
                        }
                    },
                    "shrinkageFactor": 0.18,
                    "leaves": {
                        "annual": 6,
                        "publicHolidays": 16,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.052,
                    "benefitsOverheadRate": 0.2,
                    "nightShiftPremiumRate": 0.08,
                    "workingHoursPerMonth": 155
                },
                "compliance": {
                    "certifications": [
                        "TIS Standards",
                        "PEA License"
                    ],
                    "annualComplianceCost": 4500,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 80,
                    "gridCarbonIntensity": 0.5,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 100,
                    "pgaPct2in50yr": 8
                },
                "risk": {
                    "downtimeCostPerMin": 1000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.15,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Eastern Seaboard (EEC)",
                        "Amata City",
                        "Hemaraj Industrial"
                    ],
                    "taxHolidayYears": 8,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "BOI DC Investment Promotion",
                        "EEC Digital Park",
                        "Thailand 4.0 Smart Electronics"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "extreme",
                    "typhoonRisk": "low",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 40,
                    "insuranceMultiplier": 1.3,
                    "structuralReinforcement": 0.03
                },
                "gridReliability": {
                    "gridUptime": 99.8,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 8,
                    "averageOutageDuration": 25,
                    "gridTier": 2,
                    "backupFuelPremium": 0.08,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 65
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 20,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.05,
                    "talentScore": 55,
                    "certifiedProfessionals": 280
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.85,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.05,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "VN": {
                "id": "VN",
                "region": "APAC",
                "name": "Vietnam",
                "currency": "VND",
                "currencySymbol": "₫",
                "economy": {
                    "inflationRate": 0.035,
                    "laborEscalation": 0.07,
                    "taxRate": 0.2,
                    "electricityRate": 0.09
                },
                "constructionIndex": 0.55,
                "labor": {
                    "minimumWage": 200,
                    "baseSalary_ShiftLead": 1100,
                    "baseSalary_Engineer": 800,
                    "baseSalary_Technician": 450,
                    "baseSalary_Admin": 350,
                    "baseSalary_Janitor": 200,
                    "laborRatePerHour": 6,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 3,
                            "ninthHour": 3,
                            "tenthHourPlus": 3
                        }
                    },
                    "shrinkageFactor": 0.22,
                    "leaves": {
                        "annual": 12,
                        "publicHolidays": 10,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.215,
                    "benefitsOverheadRate": 0.22,
                    "nightShiftPremiumRate": 0.3,
                    "workingHoursPerMonth": 155
                },
                "compliance": {
                    "certifications": [
                        "TCVN",
                        "MOIT License"
                    ],
                    "annualComplianceCost": 3500,
                    "environmentalPermitCostPerYear": 2000
                },
                "environment": {
                    "baselineAQI": 100,
                    "gridCarbonIntensity": 0.55,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 200,
                    "pgaPct2in50yr": 10
                },
                "risk": {
                    "downtimeCostPerMin": 800
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.3,
                    "importDutyBand": "med",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Saigon Hi-Tech Park",
                        "Da Nang IT Park",
                        "VSIP Binh Duong"
                    ],
                    "taxHolidayYears": 4,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "CIT Preferential Rate 10%",
                        "Hi-Tech Enterprise Incentive",
                        "Digital Infrastructure Investment"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "extreme",
                    "typhoonRisk": "high",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 48,
                    "insuranceMultiplier": 1.35,
                    "structuralReinforcement": 0.05
                },
                "gridReliability": {
                    "gridUptime": 99.2,
                    "voltageStability": "moderate",
                    "brownoutFrequency": 20,
                    "averageOutageDuration": 50,
                    "gridTier": 2,
                    "backupFuelPremium": 0.18,
                    "recommendedGenHours": 72,
                    "renewableReadiness": 55
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 30,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.05,
                    "talentScore": 50,
                    "certifiedProfessionals": 200
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.9,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.07,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "PH": {
                "id": "PH",
                "region": "APAC",
                "name": "Philippines",
                "currency": "PHP",
                "currencySymbol": "₱",
                "economy": {
                    "inflationRate": 0.05,
                    "laborEscalation": 0.05,
                    "taxRate": 0.25,
                    "electricityRate": 0.13
                },
                "constructionIndex": 0.6,
                "labor": {
                    "minimumWage": 250,
                    "baseSalary_ShiftLead": 1300,
                    "baseSalary_Engineer": 1000,
                    "baseSalary_Technician": 550,
                    "baseSalary_Admin": 400,
                    "baseSalary_Janitor": 250,
                    "laborRatePerHour": 7,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.3
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2.6
                        }
                    },
                    "shrinkageFactor": 0.22,
                    "leaves": {
                        "annual": 5,
                        "publicHolidays": 18,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.12,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 155
                },
                "compliance": {
                    "certifications": [
                        "PNS Standards",
                        "DOE License"
                    ],
                    "annualComplianceCost": 3500,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 70,
                    "gridCarbonIntensity": 0.6,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "1A",
                    "saidiMinYr": 400,
                    "pgaPct2in50yr": 50
                },
                "risk": {
                    "downtimeCostPerMin": 900
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.35,
                    "importDutyBand": "high",
                    "gpuExportTier": 2,
                    "customsLeadBand": "slow"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "PEZA Zones (400+)",
                        "Clark Freeport",
                        "Subic Bay Freeport"
                    ],
                    "taxHolidayYears": 7,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "CREATE MORE Act",
                        "PEZA IT Enterprise",
                        "Green Lane for DC Equipment"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 3,
                    "floodRisk": "extreme",
                    "typhoonRisk": "high",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 78,
                    "insuranceMultiplier": 1.75,
                    "structuralReinforcement": 0.14
                },
                "gridReliability": {
                    "gridUptime": 98,
                    "voltageStability": "unstable",
                    "brownoutFrequency": 40,
                    "averageOutageDuration": 60,
                    "gridTier": 3,
                    "backupFuelPremium": 0.25,
                    "recommendedGenHours": 96,
                    "renewableReadiness": 60
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 22,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 30,
                    "salaryPremium": 1.05,
                    "talentScore": 55,
                    "certifiedProfessionals": 250
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.06,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "moderate"
                },
                "lastUpdated": "2026-Q1"
            },
            "TW": {
                "id": "TW",
                "region": "APAC",
                "name": "Taiwan",
                "currency": "TWD",
                "currencySymbol": "NT$",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.03,
                    "taxRate": 0.2,
                    "electricityRate": 0.12
                },
                "constructionIndex": 0.8,
                "labor": {
                    "minimumWage": 900,
                    "baseSalary_ShiftLead": 2800,
                    "baseSalary_Engineer": 2200,
                    "baseSalary_Technician": 1600,
                    "baseSalary_Admin": 1200,
                    "baseSalary_Janitor": 900,
                    "laborRatePerHour": 20,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.34,
                            "subsequent": 1.67
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 7,
                        "publicHolidays": 12,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.17,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 158
                },
                "compliance": {
                    "certifications": [
                        "CNS Standards",
                        "Taipower License"
                    ],
                    "annualComplianceCost": 7000,
                    "environmentalPermitCostPerYear": 5000
                },
                "environment": {
                    "baselineAQI": 60,
                    "gridCarbonIntensity": 0.5,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "2A",
                    "saidiMinYr": 20,
                    "pgaPct2in50yr": 70
                },
                "risk": {
                    "downtimeCostPerMin": 3000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Hsinchu Science Park",
                        "Kaohsiung Software Park"
                    ],
                    "taxHolidayYears": 5,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "Smart Machinery Tax Credit",
                        "Industrial Innovation Act",
                        "Asia Silicon Valley Plan"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 4,
                    "floodRisk": "moderate",
                    "typhoonRisk": "high",
                    "volcanoRisk": "low",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 75,
                    "insuranceMultiplier": 1.7,
                    "structuralReinforcement": 0.16
                },
                "gridReliability": {
                    "gridUptime": 99.9,
                    "voltageStability": "stable",
                    "brownoutFrequency": 3,
                    "averageOutageDuration": 15,
                    "gridTier": 1,
                    "backupFuelPremium": 0.03,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 50
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 18,
                    "hyperscalerPresence": 5,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.1,
                    "talentScore": 65,
                    "certifiedProfessionals": 650
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.05,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.05,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "NZ": {
                "id": "NZ",
                "region": "APAC",
                "name": "New Zealand",
                "currency": "NZD",
                "currencySymbol": "NZ$",
                "economy": {
                    "inflationRate": 0.03,
                    "laborEscalation": 0.035,
                    "taxRate": 0.28,
                    "electricityRate": 0.16
                },
                "constructionIndex": 1.1,
                "labor": {
                    "minimumWage": 2500,
                    "baseSalary_ShiftLead": 7500,
                    "baseSalary_Engineer": 6000,
                    "baseSalary_Technician": 4500,
                    "baseSalary_Admin": 3800,
                    "baseSalary_Janitor": 3000,
                    "laborRatePerHour": 38,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 20,
                        "publicHolidays": 11,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.04,
                    "benefitsOverheadRate": 0.2,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "AS/NZS Standards",
                        "WorkSafe"
                    ],
                    "annualComplianceCost": 8000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 15,
                    "gridCarbonIntensity": 0.1,
                    "aqueductStressScore": 1,
                    "ashraeClimateZone": "4C",
                    "saidiMinYr": 100,
                    "pgaPct2in50yr": 50
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.25,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.28,
                    "incentivePrograms": [
                        "Callaghan Innovation R&D Grant",
                        "NZ Green Investment Fund"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.28
                },
                "naturalDisaster": {
                    "seismicZone": 4,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "moderate",
                    "tsunamiRisk": "moderate",
                    "compositeScore": 65,
                    "insuranceMultiplier": 1.6,
                    "structuralReinforcement": 0.14
                },
                "gridReliability": {
                    "gridUptime": 99.98,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 5,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 90
                },
                "talentPool": {
                    "dcEngineerPool": "scarce",
                    "universityPipeline": 3,
                    "hyperscalerPresence": 2,
                    "avgHiringDays": 50,
                    "salaryPremium": 1.2,
                    "talentScore": 42,
                    "certifiedProfessionals": 150
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.4,
                    "dieselAvailability": "moderate",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.6,
                    "fuelTaxRate": 0.08,
                    "deliveryLeadDays": 3,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "GB": {
                "id": "GB",
                "region": "EMEA",
                "name": "United Kingdom",
                "currency": "GBP",
                "currencySymbol": "£",
                "economy": {
                    "inflationRate": 0.027,
                    "laborEscalation": 0.035,
                    "taxRate": 0.25,
                    "electricityRate": 0.22
                },
                "constructionIndex": 1.15,
                "labor": {
                    "minimumWage": 2200,
                    "baseSalary_ShiftLead": 8000,
                    "baseSalary_Engineer": 6500,
                    "baseSalary_Technician": 4500,
                    "baseSalary_Admin": 3500,
                    "baseSalary_Janitor": 2500,
                    "laborRatePerHour": 38,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 28,
                        "publicHolidays": 8,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.15,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "BS EN Standards",
                        "IET Wiring Regs",
                        "BREEAM"
                    ],
                    "annualComplianceCost": 14000,
                    "environmentalPermitCostPerYear": 6500
                },
                "environment": {
                    "baselineAQI": 25,
                    "gridCarbonIntensity": 0.23,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "4C",
                    "saidiMinYr": 40,
                    "pgaPct2in50yr": 3
                },
                "risk": {
                    "downtimeCostPerMin": 4500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "London Docklands Enterprise Zone"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.25,
                    "incentivePrograms": [
                        "R&D Tax Credit (RDEC)",
                        "Capital Allowances Super Deduction",
                        "Enterprise Zones"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.25
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 10,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.99,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 3,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 65
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 30,
                    "hyperscalerPresence": 7,
                    "avgHiringDays": 30,
                    "salaryPremium": 1,
                    "talentScore": 82,
                    "certifiedProfessionals": 3500
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.7,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.8,
                    "fuelTaxRate": 0.15,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "DE": {
                "id": "DE",
                "region": "EMEA",
                "name": "Germany",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.023,
                    "laborEscalation": 0.03,
                    "taxRate": 0.2975,
                    "electricityRate": 0.26
                },
                "constructionIndex": 1.05,
                "labor": {
                    "minimumWage": 2400,
                    "baseSalary_ShiftLead": 8500,
                    "baseSalary_Engineer": 7000,
                    "baseSalary_Technician": 5000,
                    "baseSalary_Admin": 4000,
                    "baseSalary_Janitor": 2800,
                    "laborRatePerHour": 42,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 24,
                        "publicHolidays": 10,
                        "sickAverage": 8
                    },
                    "socialSecurityRate": 0.21,
                    "benefitsOverheadRate": 0.28,
                    "nightShiftPremiumRate": 0.25,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "VDE",
                        "TÜV",
                        "EnEfG"
                    ],
                    "annualComplianceCost": 16000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 20,
                    "gridCarbonIntensity": 0.35,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "4A",
                    "saidiMinYr": 12,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 5000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.2975,
                    "incentivePrograms": [
                        "R&D Tax Allowance (Forschungszulage)",
                        "EnEfG Compliance Credits",
                        "Investment Grants (GRW)"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.2975
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 12,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0.01
                },
                "gridReliability": {
                    "gridUptime": 99.998,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 2,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 70
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 40,
                    "hyperscalerPresence": 6,
                    "avgHiringDays": 35,
                    "salaryPremium": 1,
                    "talentScore": 80,
                    "certifiedProfessionals": 2800
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.8,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 3,
                    "fuelTaxRate": 0.15,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "NL": {
                "id": "NL",
                "region": "EMEA",
                "name": "Netherlands",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.023,
                    "laborEscalation": 0.03,
                    "taxRate": 0.2575,
                    "electricityRate": 0.2
                },
                "constructionIndex": 1.1,
                "labor": {
                    "minimumWage": 2200,
                    "baseSalary_ShiftLead": 7500,
                    "baseSalary_Engineer": 6000,
                    "baseSalary_Technician": 4500,
                    "baseSalary_Admin": 3500,
                    "baseSalary_Janitor": 2500,
                    "laborRatePerHour": 38,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.3,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 25,
                        "publicHolidays": 8,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.18,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.15,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "NEN Standards",
                        "BREEAM-NL"
                    ],
                    "annualComplianceCost": 13000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 20,
                    "gridCarbonIntensity": 0.33,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "4A",
                    "saidiMinYr": 20,
                    "pgaPct2in50yr": 3
                },
                "risk": {
                    "downtimeCostPerMin": 4500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Amsterdam Schiphol Logistics Park"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.2575,
                    "incentivePrograms": [
                        "Innovation Box (9% rate)",
                        "WBSO R&D Tax Credit",
                        "EIA Energy Investment Allowance"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.2575
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 15,
                    "insuranceMultiplier": 1.1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.998,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 2,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 60
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 12,
                    "hyperscalerPresence": 8,
                    "avgHiringDays": 30,
                    "salaryPremium": 1.05,
                    "talentScore": 85,
                    "certifiedProfessionals": 2200
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.75,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.9,
                    "fuelTaxRate": 0.15,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "IE": {
                "id": "IE",
                "region": "EMEA",
                "name": "Ireland",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.024,
                    "laborEscalation": 0.04,
                    "taxRate": 0.15,
                    "electricityRate": 0.24
                },
                "constructionIndex": 1.1,
                "labor": {
                    "minimumWage": 2400,
                    "baseSalary_ShiftLead": 7800,
                    "baseSalary_Engineer": 6500,
                    "baseSalary_Technician": 4800,
                    "baseSalary_Admin": 3800,
                    "baseSalary_Janitor": 2800,
                    "laborRatePerHour": 36,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 20,
                        "publicHolidays": 9,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.1115,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "IS EN Standards",
                        "SEAI BER"
                    ],
                    "annualComplianceCost": 14000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 15,
                    "gridCarbonIntensity": 0.3,
                    "aqueductStressScore": 1,
                    "ashraeClimateZone": "5C",
                    "saidiMinYr": 60,
                    "pgaPct2in50yr": 3
                },
                "risk": {
                    "downtimeCostPerMin": 4500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Shannon Free Zone",
                        "IDA Technology Parks"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.125,
                    "incentivePrograms": [
                        "12.5% Corporate Rate",
                        "IDA Ireland Grants",
                        "R&D Tax Credit 25%",
                        "Knowledge Development Box 6.25%"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.125
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 8,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.97,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 5,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 65
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 8,
                    "hyperscalerPresence": 8,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.15,
                    "talentScore": 70,
                    "certifiedProfessionals": 1200
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.65,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.7,
                    "fuelTaxRate": 0.12,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "FR": {
                "id": "FR",
                "region": "EMEA",
                "name": "France",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.025,
                    "laborEscalation": 0.03,
                    "taxRate": 0.25,
                    "electricityRate": 0.15
                },
                "constructionIndex": 1.05,
                "labor": {
                    "minimumWage": 2100,
                    "baseSalary_ShiftLead": 7000,
                    "baseSalary_Engineer": 5500,
                    "baseSalary_Technician": 4000,
                    "baseSalary_Admin": 3200,
                    "baseSalary_Janitor": 2300,
                    "laborRatePerHour": 35,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.15,
                    "leaves": {
                        "annual": 25,
                        "publicHolidays": 11,
                        "sickAverage": 6
                    },
                    "socialSecurityRate": 0.38,
                    "benefitsOverheadRate": 0.35,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "NF C 15-100",
                        "AFNOR"
                    ],
                    "annualComplianceCost": 15000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 25,
                    "gridCarbonIntensity": 0.06,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "4A",
                    "saidiMinYr": 50,
                    "pgaPct2in50yr": 8
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.25,
                    "incentivePrograms": [
                        "CIR R&D Tax Credit 30%",
                        "France 2030 Digital Infrastructure",
                        "Reduced Energy Tax for DCs"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.25
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 12,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0.01
                },
                "gridReliability": {
                    "gridUptime": 99.99,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 3,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 55
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 25,
                    "hyperscalerPresence": 5,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.05,
                    "talentScore": 68,
                    "certifiedProfessionals": 1800
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.75,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.9,
                    "fuelTaxRate": 0.15,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 60000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "SE": {
                "id": "SE",
                "region": "EMEA",
                "name": "Sweden",
                "currency": "SEK",
                "currencySymbol": "kr",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.025,
                    "taxRate": 0.206,
                    "electricityRate": 0.08
                },
                "constructionIndex": 1.1,
                "labor": {
                    "minimumWage": 2500,
                    "baseSalary_ShiftLead": 7200,
                    "baseSalary_Engineer": 6000,
                    "baseSalary_Technician": 4500,
                    "baseSalary_Admin": 3500,
                    "baseSalary_Janitor": 2800,
                    "laborRatePerHour": 36,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 25,
                        "publicHolidays": 13,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.3142,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.2,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "SS Standards",
                        "Energimyndigheten"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 10,
                    "gridCarbonIntensity": 0.04,
                    "aqueductStressScore": 1,
                    "ashraeClimateZone": "6A",
                    "saidiMinYr": 45,
                    "pgaPct2in50yr": 3
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Lulea Data Center Hub"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.206,
                    "incentivePrograms": [
                        "Reduced Energy Tax for DCs",
                        "Vinnova Innovation Grants",
                        "Northern Sweden Regional Aid"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.206
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 5,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.999,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 1,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 95
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 10,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 45,
                    "salaryPremium": 1.1,
                    "talentScore": 62,
                    "certifiedProfessionals": 600
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.85,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.8,
                    "fuelTaxRate": 0.18,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "PL": {
                "id": "PL",
                "region": "EMEA",
                "name": "Poland",
                "currency": "PLN",
                "currencySymbol": "zł",
                "economy": {
                    "inflationRate": 0.04,
                    "laborEscalation": 0.05,
                    "taxRate": 0.19,
                    "electricityRate": 0.12
                },
                "constructionIndex": 0.75,
                "labor": {
                    "minimumWage": 1000,
                    "baseSalary_ShiftLead": 3500,
                    "baseSalary_Engineer": 2800,
                    "baseSalary_Technician": 2000,
                    "baseSalary_Admin": 1500,
                    "baseSalary_Janitor": 1000,
                    "laborRatePerHour": 15,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.15,
                    "leaves": {
                        "annual": 20,
                        "publicHolidays": 13,
                        "sickAverage": 6
                    },
                    "socialSecurityRate": 0.21,
                    "benefitsOverheadRate": 0.22,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "PN-EN Standards",
                        "URE License"
                    ],
                    "annualComplianceCost": 7000,
                    "environmentalPermitCostPerYear": 4500
                },
                "environment": {
                    "baselineAQI": 40,
                    "gridCarbonIntensity": 0.65,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "5A",
                    "saidiMinYr": 150,
                    "pgaPct2in50yr": 3
                },
                "risk": {
                    "downtimeCostPerMin": 2000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Polish SEZ (14 zones)",
                        "Lodz SEZ",
                        "Katowice SEZ"
                    ],
                    "taxHolidayYears": 15,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "SEZ Tax Exemption",
                        "Polish Investment Zone",
                        "EU Structural Funds Co-financing"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 10,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.95,
                    "voltageStability": "stable",
                    "brownoutFrequency": 2,
                    "averageOutageDuration": 10,
                    "gridTier": 1,
                    "backupFuelPremium": 0.02,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 55
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 20,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.05,
                    "talentScore": 65,
                    "certifiedProfessionals": 800
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.45,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0.1,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "PT": {
                "id": "PT",
                "region": "EMEA",
                "name": "Portugal",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.023,
                    "laborEscalation": 0.035,
                    "taxRate": 0.2,
                    "electricityRate": 0.15
                },
                "constructionIndex": 0.85,
                "labor": {
                    "minimumWage": 920,
                    "baseSalary_ShiftLead": 3800,
                    "baseSalary_Engineer": 2900,
                    "baseSalary_Technician": 2200,
                    "baseSalary_Admin": 1600,
                    "baseSalary_Janitor": 1050,
                    "laborRatePerHour": 18,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.16,
                    "leaves": {
                        "annual": 22,
                        "publicHolidays": 13,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.2375,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.25,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "ITED",
                        "ITUR",
                        "RGSPIE",
                        "DL 95/91"
                    ],
                    "annualComplianceCost": 14000,
                    "environmentalPermitCostPerYear": 5000
                },
                "environment": {
                    "baselineAQI": 20,
                    "gridCarbonIntensity": 0.08,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "3C",
                    "saidiMinYr": 60,
                    "pgaPct2in50yr": 20
                },
                "risk": {
                    "downtimeCostPerMin": 3500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Madeira Free Trade Zone",
                        "Sines Industrial Zone"
                    ],
                    "taxHolidayYears": 10,
                    "taxHolidayRate": 0.05,
                    "incentivePrograms": [
                        "Portugal 2030 Program",
                        "SIFIDE R&D Tax Credit",
                        "Golden Visa Investment"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.05
                },
                "naturalDisaster": {
                    "seismicZone": 2,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 25,
                    "insuranceMultiplier": 1.15,
                    "structuralReinforcement": 0.03
                },
                "gridReliability": {
                    "gridUptime": 99.97,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 8,
                    "gridTier": 1,
                    "backupFuelPremium": 0.02,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 68
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 15,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 40,
                    "salaryPremium": 1,
                    "talentScore": 55,
                    "certifiedProfessionals": 500
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.59,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.1,
                    "fuelTaxRate": 0.12,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q1"
            },
            "OM": {
                "id": "OM",
                "region": "MENA",
                "name": "Oman",
                "currency": "OMR",
                "currencySymbol": "ر.ع.",
                "economy": {
                    "inflationRate": 0.015,
                    "laborEscalation": 0.03,
                    "taxRate": 0.15,
                    "electricityRate": 0.07
                },
                "constructionIndex": 0.8,
                "labor": {
                    "minimumWage": 850,
                    "baseSalary_ShiftLead": 4200,
                    "baseSalary_Engineer": 3400,
                    "baseSalary_Technician": 2000,
                    "baseSalary_Admin": 1600,
                    "baseSalary_Janitor": 900,
                    "laborRatePerHour": 20,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 1.5,
                            "ninthHour": 1.5,
                            "tenthHourPlus": 1.5
                        }
                    },
                    "shrinkageFactor": 0.12,
                    "leaves": {
                        "annual": 30,
                        "publicHolidays": 9,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.06,
                    "benefitsOverheadRate": 0.28,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "Oman Civil Defence",
                        "MTCIT License",
                        "OPWP Grid Code"
                    ],
                    "annualComplianceCost": 10000,
                    "environmentalPermitCostPerYear": 2500
                },
                "environment": {
                    "baselineAQI": 90,
                    "gridCarbonIntensity": 0.48,
                    "aqueductStressScore": 5,
                    "ashraeClimateZone": "1B",
                    "saidiMinYr": 60,
                    "pgaPct2in50yr": 10
                },
                "risk": {
                    "downtimeCostPerMin": 2000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 2,
                    "customsLeadBand": "normal"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Duqm SEZ",
                        "Salalah Free Zone",
                        "Sohar Free Zone"
                    ],
                    "taxHolidayYears": 30,
                    "taxHolidayRate": 0,
                    "incentivePrograms": [
                        "Duqm SEZ 30yr tax holiday",
                        "Salalah FZ 0% CIT",
                        "Vision 2040 digital infrastructure"
                    ],
                    "importDutyExemption": true,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "low",
                    "typhoonRisk": "low",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "low",
                    "compositeScore": 12,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.95,
                    "voltageStability": "stable",
                    "brownoutFrequency": 2,
                    "averageOutageDuration": 10,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 40
                },
                "talentPool": {
                    "dcEngineerPool": "scarce",
                    "universityPipeline": 4,
                    "hyperscalerPresence": 1,
                    "avgHiringDays": 45,
                    "salaryPremium": 1.1,
                    "talentScore": 45,
                    "certifiedProfessionals": 150
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 0.6,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": false,
                    "hvoPricePerLiter": 0,
                    "fuelTaxRate": 0,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": false,
                    "storageLimitLiters": 100000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "FI": {
                "id": "FI",
                "region": "EMEA",
                "name": "Finland",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.018,
                    "laborEscalation": 0.025,
                    "taxRate": 0.2,
                    "electricityRate": 0.09
                },
                "constructionIndex": 1.05,
                "labor": {
                    "minimumWage": 2400,
                    "baseSalary_ShiftLead": 7000,
                    "baseSalary_Engineer": 5800,
                    "baseSalary_Technician": 4300,
                    "baseSalary_Admin": 3400,
                    "baseSalary_Janitor": 2700,
                    "laborRatePerHour": 35,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 25,
                        "publicHolidays": 13,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.2,
                    "benefitsOverheadRate": 0.28,
                    "nightShiftPremiumRate": 0.15,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "SFS Standards",
                        "Tukes",
                        "Energiavirasto"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 8,
                    "gridCarbonIntensity": 0.08,
                    "aqueductStressScore": 1,
                    "ashraeClimateZone": "6A",
                    "saidiMinYr": 30,
                    "pgaPct2in50yr": 2
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Hamina DC Hub"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.2,
                    "incentivePrograms": [
                        "Reduced electricity tax class II for DCs",
                        "Business Finland RDI grants",
                        "District-heat reuse credits"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.2
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 4,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.999,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 2,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 90
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 9,
                    "hyperscalerPresence": 3,
                    "avgHiringDays": 45,
                    "salaryPremium": 1.1,
                    "talentScore": 60,
                    "certifiedProfessionals": 500
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.9,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.6,
                    "fuelTaxRate": 0.2,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "ES": {
                "id": "ES",
                "region": "EMEA",
                "name": "Spain",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.025,
                    "laborEscalation": 0.035,
                    "taxRate": 0.25,
                    "electricityRate": 0.13
                },
                "constructionIndex": 0.9,
                "labor": {
                    "minimumWage": 1250,
                    "baseSalary_ShiftLead": 4200,
                    "baseSalary_Engineer": 3300,
                    "baseSalary_Technician": 2500,
                    "baseSalary_Admin": 1900,
                    "baseSalary_Janitor": 1300,
                    "laborRatePerHour": 20,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.14,
                    "leaves": {
                        "annual": 22,
                        "publicHolidays": 14,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.3,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.25,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "UNE Standards",
                        "REBT",
                        "CNMC Grid Access"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 5500
                },
                "environment": {
                    "baselineAQI": 25,
                    "gridCarbonIntensity": 0.15,
                    "aqueductStressScore": 4,
                    "ashraeClimateZone": "3B",
                    "saidiMinYr": 50,
                    "pgaPct2in50yr": 6
                },
                "risk": {
                    "downtimeCostPerMin": 3500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Zona Franca Barcelona",
                        "Aragón DC corridor",
                        "Canary Islands ZEC"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.25,
                    "incentivePrograms": [
                        "Aragón hyperscale land+grid incentives",
                        "PERTE digitalization funds",
                        "Canary ZEC 4% CIT"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": true,
                    "effectiveTaxRate": 0.25
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 12,
                    "insuranceMultiplier": 1.05,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.96,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 8,
                    "gridTier": 1,
                    "backupFuelPremium": 0.02,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 70
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 18,
                    "hyperscalerPresence": 5,
                    "avgHiringDays": 38,
                    "salaryPremium": 1.05,
                    "talentScore": 62,
                    "certifiedProfessionals": 700
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.55,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.05,
                    "fuelTaxRate": 0.12,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "CA": {
                "id": "CA",
                "region": "AMER",
                "name": "Canada",
                "currency": "CAD",
                "currencySymbol": "C$",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.03,
                    "taxRate": 0.265,
                    "electricityRate": 0.08
                },
                "constructionIndex": 1,
                "labor": {
                    "minimumWage": 2300,
                    "baseSalary_ShiftLead": 6500,
                    "baseSalary_Engineer": 5400,
                    "baseSalary_Technician": 4000,
                    "baseSalary_Admin": 3200,
                    "baseSalary_Janitor": 2500,
                    "laborRatePerHour": 32,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 1.5,
                            "ninthHour": 1.5,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 15,
                        "publicHolidays": 11,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.12,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.08,
                    "workingHoursPerMonth": 153
                },
                "compliance": {
                    "certifications": [
                        "CSA Standards",
                        "ESA/RBQ Electrical",
                        "Provincial Permits"
                    ],
                    "annualComplianceCost": 13000,
                    "environmentalPermitCostPerYear": 7000
                },
                "environment": {
                    "baselineAQI": 15,
                    "gridCarbonIntensity": 0.13,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "6A",
                    "saidiMinYr": 180,
                    "pgaPct2in50yr": 15
                },
                "risk": {
                    "downtimeCostPerMin": 4500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Montréal hydro corridor",
                        "Alberta DC zone"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.265,
                    "incentivePrograms": [
                        "Hydro-Québec industrial rate",
                        "SR&ED tax credits",
                        "Provincial DC incentives (QC/AB)"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.265
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 8,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.97,
                    "voltageStability": "stable",
                    "brownoutFrequency": 1,
                    "averageOutageDuration": 15,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 82
                },
                "talentPool": {
                    "dcEngineerPool": "abundant",
                    "universityPipeline": 25,
                    "hyperscalerPresence": 6,
                    "avgHiringDays": 35,
                    "salaryPremium": 1.1,
                    "talentScore": 72,
                    "certifiedProfessionals": 1200
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.2,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 1.8,
                    "fuelTaxRate": 0.1,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 100000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "IT": {
                "id": "IT",
                "region": "EMEA",
                "name": "Italy",
                "currency": "EUR",
                "currencySymbol": "€",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.03,
                    "taxRate": 0.279,
                    "electricityRate": 0.18
                },
                "constructionIndex": 0.95,
                "labor": {
                    "minimumWage": 1250,
                    "baseSalary_ShiftLead": 4500,
                    "baseSalary_Engineer": 3600,
                    "baseSalary_Technician": 2700,
                    "baseSalary_Admin": 2100,
                    "baseSalary_Janitor": 1400,
                    "laborRatePerHour": 22,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.5
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.15,
                    "leaves": {
                        "annual": 22,
                        "publicHolidays": 12,
                        "sickAverage": 6
                    },
                    "socialSecurityRate": 0.3,
                    "benefitsOverheadRate": 0.35,
                    "nightShiftPremiumRate": 0.2,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "CEI Standards",
                        "VVF Fire Cert",
                        "ARERA Grid Access"
                    ],
                    "annualComplianceCost": 14000,
                    "environmentalPermitCostPerYear": 5500
                },
                "environment": {
                    "baselineAQI": 35,
                    "gridCarbonIntensity": 0.25,
                    "aqueductStressScore": 3,
                    "ashraeClimateZone": "4A",
                    "saidiMinYr": 45,
                    "pgaPct2in50yr": 20
                },
                "risk": {
                    "downtimeCostPerMin": 3500
                },
                "supplyChain": {
                    "importDifficultyFactor": 1.05,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Trieste Free Port",
                        "ZES Unica (South)"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.279,
                    "incentivePrograms": [
                        "Transizione 5.0 credits",
                        "ZES Unica South incentives",
                        "Industria 4.0 hyper-depreciation"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.279
                },
                "naturalDisaster": {
                    "seismicZone": 2,
                    "floodRisk": "moderate",
                    "typhoonRisk": "none",
                    "volcanoRisk": "low",
                    "tsunamiRisk": "none",
                    "compositeScore": 25,
                    "insuranceMultiplier": 1.15,
                    "structuralReinforcement": 0.03
                },
                "gridReliability": {
                    "gridUptime": 99.95,
                    "voltageStability": "stable",
                    "brownoutFrequency": 2,
                    "averageOutageDuration": 10,
                    "gridTier": 1,
                    "backupFuelPremium": 0.02,
                    "recommendedGenHours": 48,
                    "renewableReadiness": 55
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 20,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.05,
                    "talentScore": 58,
                    "certifiedProfessionals": 600
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.75,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.2,
                    "fuelTaxRate": 0.15,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "NO": {
                "id": "NO",
                "region": "EMEA",
                "name": "Norway",
                "currency": "NOK",
                "currencySymbol": "kr",
                "economy": {
                    "inflationRate": 0.02,
                    "laborEscalation": 0.03,
                    "taxRate": 0.22,
                    "electricityRate": 0.07
                },
                "constructionIndex": 1.2,
                "labor": {
                    "minimumWage": 2800,
                    "baseSalary_ShiftLead": 7500,
                    "baseSalary_Engineer": 6300,
                    "baseSalary_Technician": 4700,
                    "baseSalary_Admin": 3700,
                    "baseSalary_Janitor": 3000,
                    "laborRatePerHour": 38,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.4,
                            "subsequent": 1.4
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 25,
                        "publicHolidays": 12,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.16,
                    "benefitsOverheadRate": 0.3,
                    "nightShiftPremiumRate": 0.2,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "NEK Standards",
                        "DSB",
                        "NVE Grid License"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 6500
                },
                "environment": {
                    "baselineAQI": 8,
                    "gridCarbonIntensity": 0.03,
                    "aqueductStressScore": 1,
                    "ashraeClimateZone": "6A",
                    "saidiMinYr": 90,
                    "pgaPct2in50yr": 5
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Norwegian DC power regions (Rjukan, Stavanger)"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.22,
                    "incentivePrograms": [
                        "Reduced el-tax for DCs",
                        "Enova energy-efficiency grants",
                        "Statkraft green PPAs"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.22
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 5,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.999,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 2,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 98
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 8,
                    "hyperscalerPresence": 2,
                    "avgHiringDays": 50,
                    "salaryPremium": 1.15,
                    "talentScore": 55,
                    "certifiedProfessionals": 350
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.95,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.7,
                    "fuelTaxRate": 0.2,
                    "deliveryLeadDays": 2,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "DK": {
                "id": "DK",
                "region": "EMEA",
                "name": "Denmark",
                "currency": "DKK",
                "currencySymbol": "kr",
                "economy": {
                    "inflationRate": 0.018,
                    "laborEscalation": 0.025,
                    "taxRate": 0.22,
                    "electricityRate": 0.12
                },
                "constructionIndex": 1.15,
                "labor": {
                    "minimumWage": 2700,
                    "baseSalary_ShiftLead": 7300,
                    "baseSalary_Engineer": 6100,
                    "baseSalary_Technician": 4600,
                    "baseSalary_Admin": 3600,
                    "baseSalary_Janitor": 2900,
                    "laborRatePerHour": 37,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.5,
                            "subsequent": 2
                        },
                        "holiday": {
                            "first8Hours": 2,
                            "ninthHour": 2,
                            "tenthHourPlus": 2
                        }
                    },
                    "shrinkageFactor": 0.1,
                    "leaves": {
                        "annual": 25,
                        "publicHolidays": 11,
                        "sickAverage": 5
                    },
                    "socialSecurityRate": 0.03,
                    "benefitsOverheadRate": 0.35,
                    "nightShiftPremiumRate": 0.2,
                    "workingHoursPerMonth": 150
                },
                "compliance": {
                    "certifications": [
                        "DS Standards",
                        "Sikkerhedsstyrelsen",
                        "Energinet Grid Code"
                    ],
                    "annualComplianceCost": 12000,
                    "environmentalPermitCostPerYear": 6000
                },
                "environment": {
                    "baselineAQI": 10,
                    "gridCarbonIntensity": 0.12,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "5A",
                    "saidiMinYr": 12,
                    "pgaPct2in50yr": 2
                },
                "risk": {
                    "downtimeCostPerMin": 4000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Copenhagen/Odense DC corridor"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.22,
                    "incentivePrograms": [
                        "Reduced electricity tax for DCs",
                        "Danish green power PPAs",
                        "District-heat reuse credits"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.22
                },
                "naturalDisaster": {
                    "seismicZone": 0,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 4,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.998,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 2,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 90
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 8,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 42,
                    "salaryPremium": 1.1,
                    "talentScore": 60,
                    "certifiedProfessionals": 450
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.85,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.6,
                    "fuelTaxRate": 0.18,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 50000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            },
            "CH": {
                "id": "CH",
                "region": "EMEA",
                "name": "Switzerland",
                "currency": "CHF",
                "currencySymbol": "CHF",
                "economy": {
                    "inflationRate": 0.01,
                    "laborEscalation": 0.02,
                    "taxRate": 0.149,
                    "electricityRate": 0.14
                },
                "constructionIndex": 1.3,
                "labor": {
                    "minimumWage": 4000,
                    "baseSalary_ShiftLead": 9500,
                    "baseSalary_Engineer": 8200,
                    "baseSalary_Technician": 6200,
                    "baseSalary_Admin": 5000,
                    "baseSalary_Janitor": 4000,
                    "laborRatePerHour": 55,
                    "overtimeRules": {
                        "workday": {
                            "firstHour": 1.25,
                            "subsequent": 1.25
                        },
                        "holiday": {
                            "first8Hours": 1.5,
                            "ninthHour": 1.5,
                            "tenthHourPlus": 1.5
                        }
                    },
                    "shrinkageFactor": 0.08,
                    "leaves": {
                        "annual": 20,
                        "publicHolidays": 9,
                        "sickAverage": 4
                    },
                    "socialSecurityRate": 0.13,
                    "benefitsOverheadRate": 0.25,
                    "nightShiftPremiumRate": 0.1,
                    "workingHoursPerMonth": 151
                },
                "compliance": {
                    "certifications": [
                        "SEV/Electrosuisse",
                        "ESTI",
                        "Cantonal Fire Police"
                    ],
                    "annualComplianceCost": 16000,
                    "environmentalPermitCostPerYear": 7500
                },
                "environment": {
                    "baselineAQI": 10,
                    "gridCarbonIntensity": 0.04,
                    "aqueductStressScore": 2,
                    "ashraeClimateZone": "5A",
                    "saidiMinYr": 15,
                    "pgaPct2in50yr": 10
                },
                "risk": {
                    "downtimeCostPerMin": 5000
                },
                "supplyChain": {
                    "importDifficultyFactor": 1,
                    "importDutyBand": "low",
                    "gpuExportTier": 1,
                    "customsLeadBand": "fast"
                },
                "taxIncentives": {
                    "freeTradeZones": [
                        "Zug/Lucerne cantonal low-tax"
                    ],
                    "taxHolidayYears": 0,
                    "taxHolidayRate": 0.149,
                    "incentivePrograms": [
                        "Cantonal tax rulings",
                        "Patent box regime",
                        "Grid-adjacent heat-reuse credits"
                    ],
                    "importDutyExemption": false,
                    "landSubsidy": false,
                    "effectiveTaxRate": 0.149
                },
                "naturalDisaster": {
                    "seismicZone": 1,
                    "floodRisk": "low",
                    "typhoonRisk": "none",
                    "volcanoRisk": "none",
                    "tsunamiRisk": "none",
                    "compositeScore": 6,
                    "insuranceMultiplier": 1,
                    "structuralReinforcement": 0
                },
                "gridReliability": {
                    "gridUptime": 99.998,
                    "voltageStability": "stable",
                    "brownoutFrequency": 0,
                    "averageOutageDuration": 2,
                    "gridTier": 1,
                    "backupFuelPremium": 0,
                    "recommendedGenHours": 24,
                    "renewableReadiness": 75
                },
                "talentPool": {
                    "dcEngineerPool": "moderate",
                    "universityPipeline": 12,
                    "hyperscalerPresence": 4,
                    "avgHiringDays": 40,
                    "salaryPremium": 1.25,
                    "talentScore": 68,
                    "certifiedProfessionals": 500
                },
                "fuelDiesel": {
                    "dieselPricePerLiter": 1.95,
                    "dieselAvailability": "abundant",
                    "hvoAvailable": true,
                    "hvoPricePerLiter": 2.75,
                    "fuelTaxRate": 0.2,
                    "deliveryLeadDays": 1,
                    "environmentalPermitRequired": true,
                    "storageLimitLiters": 40000,
                    "fuelQualityRating": "high"
                },
                "lastUpdated": "2026-Q3"
            }
        },
        /* @@COUNTRIES_END */

        // Shared enums so every calculator/module labels tier/redundancy/cooling
        // identically (no more 2n vs 2N vs "Tier III" divergence).
        tierCodes: { n: 'Tier I', n1: 'Tier II', '2n': 'Tier III', '2n1': 'Tier IV' },
        redundancyLevels: { n: 'N', n1: 'N+1', '2n': '2N', '2n1': '2N+1' },
        // NOTE: canonical cooling taxonomy already lives in DATA.coolingTypes below
        // (label + capex/pue/wue key mapping, model-consumed) — do not duplicate here.

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
            /* v2.5.0 research pass — GHG Protocol scope 1/3 factors. Scope 1 =
             * on-site generator diesel combustion (EPA 2.68 kgCO₂/L) at test/outage
             * hours + refrigerant leakage. Scope 3 = embodied construction amortized. */
            dieselKgCo2PerL: 2.68, genTestHoursPerYear: 52, refrigerantLeakTco2ePerMwYr: 8,
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
            coolingMult: { air: 1.0, inrow: 1.2, rdhx: 1.35, liquid: 1.6, immersion_1p: 1.8, immersion_2p: 2.0, microfluidic: 2.2 },
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
                bangkok: { perW: 8.50, region: 'sea', label: 'Bangkok, Thailand' },
                /* ── v2.4.0 city DB expansion (accuracy — owner-flagged sparse regions;
                 * MENA had only 3; Oman >2GW green DC was missing) ── */
                muscat: { perW: 9.20, region: 'mena', label: 'Muscat, Oman' },
                kuwait_city: { perW: 9.50, region: 'mena', label: 'Kuwait City, Kuwait' },
                manama: { perW: 9.40, region: 'mena', label: 'Manama, Bahrain' },
                cairo: { perW: 7.20, region: 'mena', label: 'Cairo, Egypt' },
                tel_aviv: { perW: 11.20, region: 'mena', label: 'Tel Aviv, Israel' },
                istanbul: { perW: 8.40, region: 'mena', label: 'Istanbul, Türkiye' },
                beijing: { perW: 11.50, region: 'china', label: 'Beijing, China' },
                shanghai: { perW: 12.00, region: 'china', label: 'Shanghai, China' },
                shenzhen: { perW: 11.60, region: 'china', label: 'Shenzhen, China' },
                melbourne: { perW: 11.90, region: 'australia', label: 'Melbourne, Australia' },
                perth: { perW: 11.40, region: 'australia', label: 'Perth, Australia' },
                osaka: { perW: 14.40, region: 'japan', label: 'Osaka, Japan' },
                manila: { perW: 9.10, region: 'sea', label: 'Manila, Philippines' },
                ho_chi_minh: { perW: 8.30, region: 'sea', label: 'Ho Chi Minh City, Vietnam' },
                batam: { perW: 10.60, region: 'sea', label: 'Batam, Indonesia' },
                hyderabad: { perW: 6.50, region: 'india', label: 'Hyderabad, India' },
                bengaluru: { perW: 6.90, region: 'india', label: 'Bengaluru, India' },
                delhi_noida: { perW: 6.80, region: 'india', label: 'Delhi / Noida, India' },
                pune: { perW: 6.40, region: 'india', label: 'Pune, India' },
                atlanta: { perW: 12.10, region: 'usa', label: 'Atlanta, GA' },
                columbus: { perW: 12.40, region: 'usa', label: 'Columbus, OH' },
                reno: { perW: 11.90, region: 'usa', label: 'Reno, NV' },
                santiago: { perW: 8.20, region: 'usa', label: 'Santiago, Chile' },
                bogota: { perW: 7.80, region: 'usa', label: 'Bogotá, Colombia' },
                berlin: { perW: 11.20, region: 'europe', label: 'Berlin, Germany' },
                copenhagen: { perW: 11.30, region: 'europe', label: 'Copenhagen, Denmark' },
                vienna: { perW: 11.10, region: 'europe', label: 'Vienna, Austria' },
                bucharest: { perW: 8.60, region: 'europe', label: 'Bucharest, Romania' }
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

        /* ══ v2.5.3 (BOQ Ship-1) — DATA.boq: screening-grade Bill-of-Quantities takeoff
         * ratios + unit rates + commercial basis. Feeds models.boq, which DECOMPOSES a
         * computed CapexResult.costs map into a hierarchical BOQ and RECONCILES each
         * discipline's bottom-up sum to the parametric category $ (single source of truth
         * = the CAPEX total; BOQ is never a divergent second number). AACE Class-4
         * (−30%/+50%). Confidence per line: 'high' carry near face value, 'med' usable
         * with range, 'low' rule-of-thumb (fold into the AACE band, footnote unsourced).
         * The T&T/C&W benchmark $/kW that build the CAPEX total are OWNER-DELIVERED costs
         * that already EMBED contractor margin — so margin here is DISCLOSED (backed out of
         * the subtotal), never added on top. Sourced in DATA.sources['boq.*']. ══ */
        boq: {
            gfaM2PerMw: 900,   /* gross floor area m² per MW IT (T&T ~10-11.4k sqft/MW; Silverback WPSF) — med */
            /* discipline → which CapexResult.costs categories it decomposes (reconcile target) */
            disciplines: [
                { key: 'civil_structural', label: 'Civil & Structural', categories: ['building', 'seismic'] },
                { key: 'electrical',        label: 'Electrical (MV/LV, UPS, Genset)', categories: ['electrical', 'ups', 'generator'] },
                { key: 'mechanical_cooling',label: 'Mechanical & Cooling',  categories: ['cooling'] },
                { key: 'fire',              label: 'Fire Protection & Detection', categories: ['fireSuppression', 'fireAlarm'] },
                { key: 'elv_ict',           label: 'ELV / ICT / BMS-DCIM', categories: ['network', 'bms'] },
                { key: 'security',          label: 'Security Systems',     categories: ['security'] },
                { key: 'testing_cx',        label: 'Testing & Commissioning', categories: ['commissioning', 'testing'] },
                { key: 'permits',           label: 'Permits & Approvals',  categories: ['permits'] }
            ],
            /* ── v2.5.5 (BOQ deepen) — 3-LEVEL takeoff: discipline → subsystem → component
             * leaves. Each discipline is an ordered map of subsystemKey → { label, lines }.
             * Every leaf keeps the flat shape { desc, spec, unit, driver, ratio, rateKey,
             * laborPct, confidence, source }. driver ∈ the extended driver set returned by
             * models.boq.drivers (gfaM2|itKw|racks|mw|protectedM3|coolingKw|floorSpaceM2|lump
             * PLUS the param-conditional drivers rebarKgFactor/fuelTankM3/cleanAgentM3/
             * upsPaths/genPaths/chillerPaths/feederPaths/cduUnits/crahUnits/pduCount/…).
             * ratio × driver = qty; qty × unitRates[rateKey]×locMult = material; +laborPct
             * labor. Confidence per line: high=near face value, med=range, low=rule-of-thumb.
             * models.boq.generate reconciles Σ(all subsystem lines in a discipline) to the
             * parametric category $ (SSOT) via ONE reconcileFactor per discipline. */
            takeoff: {
                civil_structural: {
                    substructure: { label: 'Substructure & Foundations', lines: [
                        { desc: 'Site clearance + bulk earthworks', spec: 'cut/fill, compaction', unit: 'm²', driver: 'gfaM2', ratio: 1.2, rateKey: 'earthworks_m2', laborPct: 0.55, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Piling / ground improvement', spec: 'bored/CFA pile equiv', unit: 'm', driver: 'gfaM2', ratio: 0.35, rateKey: 'piling_m', laborPct: 0.45, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Foundation & ground-slab concrete', spec: 'C32/40 in-place', unit: 'm³', driver: 'gfaM2', ratio: 0.14, rateKey: 'concrete_m3', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Foundation reinforcement (seismic-scaled)', spec: 'rebar, zone-factored', unit: 't', driver: 'rebarKgFactor', ratio: 0.14 * 0.130, rateKey: 'rebar_t', laborPct: 0.30, confidence: 'med', source: 'boq.takeoff' }
                    ] },
                    superstructure: { label: 'Superstructure & Frame', lines: [
                        { desc: 'Suspended slab / core concrete', spec: 'C32/40', unit: 'm³', driver: 'gfaM2', ratio: 0.16, rateKey: 'concrete_m3', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Superstructure reinforcement (seismic-scaled)', spec: 'rebar ~130 kg/m³, zone-factored', unit: 't', driver: 'rebarKgFactor', ratio: 0.16 * 0.130, rateKey: 'rebar_t', laborPct: 0.30, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Structural steel frame + platforms', spec: 'fabricated + erected', unit: 't', driver: 'gfaM2', ratio: 0.040, rateKey: 'steel_t', laborPct: 0.35, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Seismic bracing / dampers', spec: 'lateral system, zone-factored', unit: 't', driver: 'seismicBraceT', ratio: 0.010, rateKey: 'steel_t', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    envelope: { label: 'Building Envelope', lines: [
                        { desc: 'External wall / cladding system', spec: 'insulated metal panel', unit: 'm²', driver: 'gfaM2', ratio: 0.55, rateKey: 'cladding_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Roofing + waterproofing', spec: 'single-ply membrane', unit: 'm²', driver: 'gfaM2', ratio: 0.42, rateKey: 'roofing_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'External doors, louvres, dampers', spec: 'weather + fire-rated', unit: 'm²', driver: 'gfaM2', ratio: 0.02, rateKey: 'doorLouvre_m2', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    internal_fitout: { label: 'Internal Fit-out', lines: [
                        { desc: 'Raised access floor', spec: 'heavy-duty, ~4.6 m²/rack', unit: 'm²', driver: 'racks', ratio: 4.6, rateKey: 'raisedFloor_m2', laborPct: 0.25, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Partitions, fire-rated walls, doors', spec: '2-hr rated', unit: 'm²', driver: 'gfaM2', ratio: 0.35, rateKey: 'partition_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Ceilings, finishes, sealing', spec: 'white-space grade', unit: 'm²', driver: 'gfaM2', ratio: 0.60, rateKey: 'finishes_m2', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    external_works: { label: 'External Works', lines: [
                        { desc: 'Roads, hardstanding, parking', spec: 'flexible pavement', unit: 'm²', driver: 'gfaM2', ratio: 0.45, rateKey: 'paving_m2', laborPct: 0.45, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Perimeter fencing + gates', spec: 'security-grade', unit: 'm', driver: 'gfaM2', ratio: 0.06, rateKey: 'fencing_m', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Site drainage + attenuation', spec: 'SuDS/stormwater', unit: 'm', driver: 'gfaM2', ratio: 0.10, rateKey: 'drainage_m', laborPct: 0.45, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    plinths: { label: 'Equipment Plinths & Bunds', lines: [
                        { desc: 'Genset / transformer plinths', spec: 'reinforced pad', unit: 'm³', driver: 'mw', ratio: 1.4, rateKey: 'concrete_m3', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Fuel tank bund / containment', spec: '110% secondary containment', unit: 'm³', driver: 'fuelTankM3', ratio: 1.1, rateKey: 'concrete_m3', laborPct: 0.40, confidence: 'med', source: 'boq.takeoff' }
                    ] }
                },
                electrical: {
                    utility_mv: { label: 'Utility Intake & MV', lines: [
                        { desc: 'MV switchgear (incomer, RMU)', spec: '≤36 kV metal-clad', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'mvSwgr_perMw', laborPct: 0.20, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'MV/LV transformers', spec: 'cast-resin/oil, path-scaled', unit: 'MVA', driver: 'txMva', ratio: 1, rateKey: 'transformer_mva', laborPct: 0.15, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'MV cable', spec: '15 kV Cu 500 kcmil', unit: 'm', driver: 'mw', ratio: 600, rateKey: 'mvCable_m', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    lv_distribution: { label: 'LV Distribution', lines: [
                        { desc: 'LV switchboards / panelboards', spec: '415/480 V, path-scaled', unit: 'MW', driver: 'feederPaths', ratio: 1, rateKey: 'lvSwbd_perMw', laborPct: 0.25, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Busway / busduct risers', spec: 'sandwich busway', unit: 'm', driver: 'mw', ratio: 120, rateKey: 'busway_m', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'PDU / RPP units', spec: '300 kW, rack-scaled', unit: 'ea', driver: 'pduCount', ratio: 1, rateKey: 'pdu_ea', laborPct: 0.25, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    ups_system: { label: 'UPS & Energy Storage', lines: [
                        { desc: 'UPS modules', spec: '500 kW modular, path-scaled', unit: 'ea', driver: 'upsPaths', ratio: 1, rateKey: 'upsModule_ea', laborPct: 0.15, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Battery strings (Li-ion/VRLA)', spec: 'per UPS module, tech-scaled', unit: 'ea', driver: 'upsBatt', ratio: 1, rateKey: 'battString_ea', laborPct: 0.15, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Static transfer switches', spec: 'STS per path', unit: 'ea', driver: 'stsCount', ratio: 1, rateKey: 'sts_ea', laborPct: 0.20, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    standby_gen: { label: 'Standby Generation & Fuel', lines: [
                        { desc: 'Standby gensets', spec: '2.5 MW, path-scaled', unit: 'ea', driver: 'genPaths', ratio: 1, rateKey: 'genset_ea', laborPct: 0.20, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Fuel storage tanks + polishing', spec: 'bulk tank, hours-scaled', unit: 'm³', driver: 'fuelTankM3', ratio: 1, rateKey: 'fuelTank_m3', laborPct: 0.25, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Exhaust, silencers, acoustic', spec: 'per genset', unit: 'ea', driver: 'genPaths', ratio: 1, rateKey: 'genExhaust_ea', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    epms: { label: 'EPMS / Power Monitoring', lines: [
                        { desc: 'EPMS meters + head-end', spec: 'per MW monitored', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'epms_perMw', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    earthing_lps: { label: 'Earthing & Lightning Protection', lines: [
                        { desc: 'Earthing / grounding conductor', spec: 'Cu, IEEE 80/142 ring', unit: 't', driver: 'mw', ratio: 0.35, rateKey: 'groundingCu_t', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Lightning protection + SPD', spec: 'air terminals + down-conductors', unit: 'm²', driver: 'gfaM2', ratio: 0.05, rateKey: 'lps_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    containment: { label: 'Power Cable Containment', lines: [
                        { desc: 'Cable tray / ladder (power)', spec: 'GI, ≤40% fill', unit: 'm', driver: 'itKw', ratio: 0.15, rateKey: 'cableTray_m', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    cabling: { label: 'Power Cabling', lines: [
                        { desc: 'LV power cable', spec: 'Cu XLPE ~500 kcmil equiv', unit: 'm', driver: 'itKw', ratio: 8, rateKey: 'lvCable_m', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    small_power_lighting: { label: 'Small Power & Lighting', lines: [
                        { desc: 'Lighting + emergency luminaires', spec: 'LED, per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'lighting_m2', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Small power / general services', spec: 'per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'smallPower_m2', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                },
                mechanical_cooling: {
                    heat_rejection: { label: 'Heat Rejection', lines: [
                        { desc: 'Chillers / dry-coolers', spec: '1.4 MW, path-scaled', unit: 'ea', driver: 'chillerPaths', ratio: 1, rateKey: 'chiller_ea', laborPct: 0.20, confidence: 'med', source: 'boq.takeoff' },
                        { desc: 'Cooling towers / adiabatic', spec: 'per MW rejected', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'coolTower_perMw', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    cdu_dlc: { label: 'CDU / Direct Liquid Cooling', lines: [
                        { desc: 'Coolant Distribution Units', spec: '700 kW DLC, split by cooling type', unit: 'ea', driver: 'cduUnits', ratio: 1, rateKey: 'cdu_ea', laborPct: 0.25, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'In-rack manifolds + quick-disconnects', spec: 'per DLC rack', unit: 'rack', driver: 'dlcRacks', ratio: 1, rateKey: 'manifold_rack', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    air_handling: { label: 'Air Handling', lines: [
                        { desc: 'CRAH / CRAC units', spec: '150 kW, split by cooling type', unit: 'ea', driver: 'crahUnits', ratio: 1, rateKey: 'crah_ea', laborPct: 0.25, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Ductwork (sheet metal)', spec: 'galv. 24ga ~5 kg/m²', unit: 't', driver: 'mw', ratio: 3.0, rateKey: 'ductwork_t', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    pumps: { label: 'Pumps & Prime Movers', lines: [
                        { desc: 'CW/CHW circulation pumps', spec: 'end-suction, N+1', unit: 'ea', driver: 'chillerPaths', ratio: 2, rateKey: 'pump_ea', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    pipework: { label: 'Pipework', lines: [
                        { desc: 'Chilled / condenser-water pipe', spec: 'welded steel', unit: 'm', driver: 'mw', ratio: 40, rateKey: 'cwPipe_m', laborPct: 0.45, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Coolant / glycol charge', spec: 'closed-loop (~8 L/kW cooling)', unit: 'L', driver: 'coolingKw', ratio: 8, rateKey: 'glycol_L', laborPct: 0.05, confidence: 'med', source: 'boq.takeoff' }
                    ] },
                    valves: { label: 'Valves & Specialties', lines: [
                        { desc: 'Isolation / control valves + BFVs', spec: 'per m of pipe', unit: 'ea', driver: 'mw', ratio: 6, rateKey: 'valve_ea', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    water_treatment: { label: 'Water Treatment', lines: [
                        { desc: 'Filtration / dosing / side-stream', spec: 'per MW cooling', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'waterTreat_perMw', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    humidity: { label: 'Humidity Control', lines: [
                        { desc: 'Humidifiers / dehumidification', spec: 'per m² white space', unit: 'm²', driver: 'floorSpaceM2', ratio: 1, rateKey: 'humidity_m2', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    bms_field: { label: 'BMS Field Devices', lines: [
                        { desc: 'BMS sensors, actuators, field panels', spec: 'per MW controlled', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'bmsField_perMw', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    insulation: { label: 'Thermal Insulation', lines: [
                        { desc: 'Pipe + duct insulation', spec: 'closed-cell, per m of pipe', unit: 'm', driver: 'mw', ratio: 40, rateKey: 'insulation_m', laborPct: 0.45, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                },
                fire: {
                    detection: { label: 'Detection & Aspiration', lines: [
                        { desc: 'VESDA / aspirating smoke detection', spec: 'per protected volume', unit: 'm³', driver: 'protectedM3', ratio: 1.0, rateKey: 'fireDetect_m3', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'Addressable smoke/heat + FACP', spec: 'per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'fireDetPoint_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    clean_agent: { label: 'Clean-Agent Suppression', lines: [
                        { desc: 'Clean-agent charge', spec: 'Novec/FM-200, fireType-scaled', unit: 'kg', driver: 'cleanAgentKg', ratio: 1, rateKey: 'cleanAgent_kg', laborPct: 0.20, confidence: 'high', source: 'boq.takeoff' },
                        { desc: 'Cylinders, nozzles, discharge pipe', spec: 'per protected volume', unit: 'm³', driver: 'cleanAgentM3', ratio: 1, rateKey: 'cleanAgentKit_m3', laborPct: 0.35, confidence: 'med', source: 'boq.takeoff' }
                    ] },
                    sprinkler_preaction: { label: 'Sprinkler / Pre-action', lines: [
                        { desc: 'Pre-action sprinkler pipe + heads', spec: 'double-interlock, fireType-scaled', unit: 'm²', driver: 'sprinklerM2', ratio: 1, rateKey: 'sprinkler_m2', laborPct: 0.40, confidence: 'med', source: 'boq.takeoff' }
                    ] },
                    fire_pumps: { label: 'Fire Pumps & Water', lines: [
                        { desc: 'Fire pump + jockey + tank', spec: 'NFPA 20, per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'firePump_m2', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    alarm: { label: 'Alarm & C&E', lines: [
                        { desc: 'Alarm devices + cause-and-effect', spec: 'per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'fireAlarm_m2', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    passive: { label: 'Passive Fire Protection', lines: [
                        { desc: 'Fire-stopping, dampers, intumescent', spec: 'per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'passiveFire_m2', laborPct: 0.45, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                },
                elv_ict: {
                    structured_cabling: { label: 'Structured Cabling', lines: [
                        { desc: 'Structured cabling + patching', spec: 'OM4/Cat6A backbone', unit: 'rack', driver: 'racks', ratio: 1, rateKey: 'ictPerRack', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    dcim: { label: 'DCIM', lines: [
                        { desc: 'DCIM software + gateways', spec: 'per MW monitored', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'dcim_perMw', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' },
                        { desc: 'BMS / DCIM head-end integration', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'bmsPerMw', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    network_oob: { label: 'Out-of-Band Network', lines: [
                        { desc: 'OOB switches + console servers', spec: 'per rack', unit: 'rack', driver: 'racks', ratio: 1, rateKey: 'oobPerRack', laborPct: 0.30, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    mmr_carrier: { label: 'MMR & Carrier Entry', lines: [
                        { desc: 'Meet-me-room + carrier fibre entry', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'mmr_perMw', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    av_pa: { label: 'AV & PA', lines: [
                        { desc: 'Public-address + AV / signage', spec: 'per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'avpa_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    containment: { label: 'ELV Containment', lines: [
                        { desc: 'ELV cable tray / basket', spec: 'segregated from power', unit: 'm', driver: 'itKw', ratio: 0.10, rateKey: 'elvTray_m', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                },
                security: {
                    access_control: { label: 'Access Control', lines: [
                        { desc: 'ACS readers, controllers, doors', spec: 'multi-factor, per rack + perimeter', unit: 'rack', driver: 'racks', ratio: 1, rateKey: 'acs_perRack', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    cctv: { label: 'CCTV / VMS', lines: [
                        { desc: 'IP cameras + VMS + storage', spec: 'per rack + perimeter', unit: 'rack', driver: 'racks', ratio: 1, rateKey: 'cctv_perRack', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    intrusion: { label: 'Intrusion Detection', lines: [
                        { desc: 'Intrusion sensors + monitoring', spec: 'per m² GFA', unit: 'm²', driver: 'gfaM2', ratio: 1, rateKey: 'intrusion_m2', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    perimeter: { label: 'Perimeter Security', lines: [
                        { desc: 'Fence detection, barriers, bollards', spec: 'per m perimeter', unit: 'm', driver: 'gfaM2', ratio: 0.06, rateKey: 'perimeterSec_m', laborPct: 0.40, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    soc: { label: 'Security Operations Centre', lines: [
                        { desc: 'SOC / PSIM integration + workstations', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'soc_perMw', laborPct: 0.35, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                },
                testing_cx: {
                    l1_fwt: { label: 'L1 — Factory Witness Test', lines: [
                        { desc: 'FWT / FAT witnessing', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'cxL1_perMw', laborPct: 0.90, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    l2_prefunc: { label: 'L2 — Pre-functional', lines: [
                        { desc: 'Component verification / pre-functional', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'cxL2_perMw', laborPct: 0.90, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    l3_functional: { label: 'L3 — Functional', lines: [
                        { desc: 'Functional performance testing', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'cxL3_perMw', laborPct: 0.90, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    l4_ist: { label: 'L4 — Integrated Systems Test', lines: [
                        { desc: 'IST / black-building / failover', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'cxL4_perMw', laborPct: 0.90, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    l5_loadbank: { label: 'L5 — Load-bank & Thermal', lines: [
                        { desc: 'Load-bank hire + thermal/IST run', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'cxL5_perMw', laborPct: 0.80, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    cxa: { label: 'CxA & Documentation', lines: [
                        { desc: 'Commissioning authority + docs', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'cxa_perMw', laborPct: 0.95, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                },
                permits: {
                    design_fees: { label: 'Design & Engineering Fees', lines: [
                        { desc: 'A&E design fees', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'designFee_perMw', laborPct: 0.95, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    pm: { label: 'Project / Programme Management', lines: [
                        { desc: 'PM + cost management', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'pm_perMw', laborPct: 0.95, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    prelims: { label: 'Preliminaries & Site Setup', lines: [
                        { desc: 'Site establishment, welfare, plant', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'prelims_perMw', laborPct: 0.55, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    insurance: { label: 'Insurance & Bonds', lines: [
                        { desc: 'CAR / bonds / warranties', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'insurance_perMw', laborPct: 0.05, confidence: 'low', source: 'boq.takeoff' }
                    ] },
                    permit_fees: { label: 'Permit & Authority Fees', lines: [
                        { desc: 'Building/env/fire/utility permit fees', spec: 'per MW', unit: 'MW', driver: 'mw', ratio: 1, rateKey: 'permitFee_perMw', laborPct: 0.10, confidence: 'low', source: 'boq.takeoff' }
                    ] }
                }
            },
            /* Small sourced multiplier tables the param-conditional drivers read. Screening. */
            paramFactors: {
                seismicRebarMult: { zone0: 0.85, zone1: 1.0, zone2: 1.15, zone3: 1.35, zone4: 1.6 },  /* extra rebar/bracing by seismic zone (ASCE 7-22 Sds bands) */
                seismicBraceMult: { zone0: 0.4, zone1: 1.0, zone2: 1.5, zone3: 2.2, zone4: 3.0 },       /* lateral bracing tonnage scale by zone */
                fuelTankM3PerMwHour: 0.28,   /* diesel bulk-store m³ per MW-hour of runtime (≈235 g/kWh × ~0.85 kg/L, +ullage) */
                cleanAgentKgPerM3: { novec: 0.55, fm200: 0.36, inergen: 0.30, n2: 0.30, water: 0 },     /* agent design conc. by type (NFPA 2001 / 3M/Chemours TDS) */
                cleanAgentKitM3Frac: { novec: 1.0, fm200: 1.0, inergen: 1.0, n2: 1.0, water: 0 },       /* hardware present only for gaseous systems */
                sprinklerFrac: { novec: 0, fm200: 0, inergen: 0, n2: 0, water: 1 },                     /* pre-action sprinkler present when fireType=water */
                redundancyPathMult: { n: 1.0, n1: 1.15, '2n': 2.0, '2n1': 2.15 },                        /* parallel-path multiplier for UPS/genset/chiller/feeder (Uptime Tier) */
                upsBattPerModule: { standalone: 1, modular: 1, distributed: 1, rotary: 0 },              /* battery strings per UPS module (rotary/flywheel carries none) */
                cduFrac: { air: 0, inrow: 0, rdhx: 0.4, liquid: 1.0, immersion_1p: 1.0, immersion_2p: 1.0, microfluidic: 1.0, dlc: 1.0, immersion: 1.0 },  /* CDU vs CRAH split by cooling type */
                pduPerRackType: { standard: 0.08, medium: 0.10, high: 0.14, ai: 0.20 }                  /* PDU/RPP count per rack by rack density (higher density = more feeds) */
            },
            /* US 2025 baseline material+install $/unit; regionalize via locMult. Placeholder
             * unitRates for aggregate line items (ict/bms/security/cx/permits/fireDetect) are
             * anchors the reconcileFactor scales to the category $ — their absolute value is
             * indicative, the category total is authoritative. */
            unitRates: {
                /* ── civil_structural ── */
                earthworks_m2:  { usd: 45,   confidence: 'low',  source: 'boq.unitRates' },
                piling_m:       { usd: 130,  confidence: 'low',  source: 'boq.unitRates' },
                concrete_m3:    { usd: 320,  confidence: 'med',  source: 'boq.unitRates' },
                rebar_t:        { usd: 2100, confidence: 'med',  source: 'boq.unitRates' },
                steel_t:        { usd: 3300, confidence: 'med',  source: 'boq.unitRates' },
                cladding_m2:    { usd: 220,  confidence: 'low',  source: 'boq.unitRates' },
                roofing_m2:     { usd: 130,  confidence: 'low',  source: 'boq.unitRates' },
                doorLouvre_m2:  { usd: 900,  confidence: 'low',  source: 'boq.unitRates' },
                raisedFloor_m2: { usd: 270,  confidence: 'med',  source: 'boq.unitRates' },
                partition_m2:   { usd: 110,  confidence: 'low',  source: 'boq.unitRates' },
                finishes_m2:    { usd: 85,   confidence: 'low',  source: 'boq.unitRates' },
                paving_m2:      { usd: 70,   confidence: 'low',  source: 'boq.unitRates' },
                fencing_m:      { usd: 320,  confidence: 'low',  source: 'boq.unitRates' },
                drainage_m:     { usd: 180,  confidence: 'low',  source: 'boq.unitRates' },
                /* ── electrical ── */
                mvSwgr_perMw:   { usd: 120000,confidence: 'med', source: 'boq.unitRates' },
                transformer_mva:{ usd: 55000, confidence: 'med', source: 'boq.unitRates' },
                mvCable_m:      { usd: 140,  confidence: 'low',  source: 'boq.unitRates' },
                lvSwbd_perMw:   { usd: 90000, confidence: 'low', source: 'boq.unitRates' },
                busway_m:       { usd: 600,  confidence: 'low',  source: 'boq.unitRates' },
                pdu_ea:         { usd: 42000, confidence: 'low', source: 'boq.unitRates' },
                upsModule_ea:   { usd: 180000,confidence: 'med', source: 'boq.unitRates' },
                battString_ea:  { usd: 55000, confidence: 'med', source: 'boq.unitRates' },
                sts_ea:         { usd: 28000, confidence: 'low', source: 'boq.unitRates' },
                genset_ea:      { usd: 850000,confidence: 'med', source: 'boq.unitRates' },
                fuelTank_m3:    { usd: 2600, confidence: 'med',  source: 'boq.unitRates' },
                genExhaust_ea:  { usd: 45000, confidence: 'low', source: 'boq.unitRates' },
                epms_perMw:     { usd: 45000, confidence: 'low', source: 'boq.unitRates' },
                groundingCu_t:  { usd: 15000,confidence: 'low',  source: 'boq.unitRates' },
                lps_m2:         { usd: 950,  confidence: 'low',  source: 'boq.unitRates' },
                cableTray_m:    { usd: 65,   confidence: 'low',  source: 'boq.unitRates' },
                lvCable_m:      { usd: 45,   confidence: 'low',  source: 'boq.unitRates' },
                lighting_m2:    { usd: 42,   confidence: 'low',  source: 'boq.unitRates' },
                smallPower_m2:  { usd: 30,   confidence: 'low',  source: 'boq.unitRates' },
                /* ── mechanical_cooling ── */
                chiller_ea:     { usd: 420000,confidence: 'med', source: 'boq.unitRates' },
                coolTower_perMw:{ usd: 55000, confidence: 'low', source: 'boq.unitRates' },
                cdu_ea:         { usd: 130000,confidence: 'med', source: 'boq.unitRates' },
                manifold_rack:  { usd: 6500, confidence: 'low',  source: 'boq.unitRates' },
                crah_ea:        { usd: 45000, confidence: 'low', source: 'boq.unitRates' },
                ductwork_t:     { usd: 6000, confidence: 'low',  source: 'boq.unitRates' },
                pump_ea:        { usd: 32000, confidence: 'low', source: 'boq.unitRates' },
                cwPipe_m:       { usd: 40,   confidence: 'low',  source: 'boq.unitRates' },
                glycol_L:       { usd: 6,    confidence: 'low',  source: 'boq.unitRates' },
                valve_ea:       { usd: 2200, confidence: 'low',  source: 'boq.unitRates' },
                waterTreat_perMw:{ usd: 35000,confidence: 'low', source: 'boq.unitRates' },
                humidity_m2:    { usd: 55,   confidence: 'low',  source: 'boq.unitRates' },
                bmsField_perMw: { usd: 90000, confidence: 'low', source: 'boq.unitRates' },
                insulation_m:   { usd: 55,   confidence: 'low',  source: 'boq.unitRates' },
                /* ── fire ── */
                fireDetect_m3:  { usd: 25,   confidence: 'low',  source: 'boq.unitRates' },
                fireDetPoint_m2:{ usd: 38,   confidence: 'low',  source: 'boq.unitRates' },
                cleanAgent_kg:  { usd: 55,   confidence: 'med',  source: 'boq.unitRates' },
                cleanAgentKit_m3:{ usd: 22,  confidence: 'med',  source: 'boq.unitRates' },
                sprinkler_m2:   { usd: 45,   confidence: 'med',  source: 'boq.unitRates' },
                firePump_m2:    { usd: 28,   confidence: 'low',  source: 'boq.unitRates' },
                fireAlarm_m2:   { usd: 24,   confidence: 'low',  source: 'boq.unitRates' },
                passiveFire_m2: { usd: 30,   confidence: 'low',  source: 'boq.unitRates' },
                /* ── elv_ict ── */
                ictPerRack:     { usd: 4500, confidence: 'low',  source: 'boq.unitRates' },
                dcim_perMw:     { usd: 70000, confidence: 'low', source: 'boq.unitRates' },
                bmsPerMw:       { usd: 160000,confidence: 'low', source: 'boq.unitRates' },
                oobPerRack:     { usd: 2200, confidence: 'low',  source: 'boq.unitRates' },
                mmr_perMw:      { usd: 40000, confidence: 'low', source: 'boq.unitRates' },
                avpa_m2:        { usd: 22,   confidence: 'low',  source: 'boq.unitRates' },
                elvTray_m:      { usd: 55,   confidence: 'low',  source: 'boq.unitRates' },
                /* ── security ── */
                acs_perRack:    { usd: 900,  confidence: 'low',  source: 'boq.unitRates' },
                cctv_perRack:   { usd: 1100, confidence: 'low',  source: 'boq.unitRates' },
                intrusion_m2:   { usd: 14,   confidence: 'low',  source: 'boq.unitRates' },
                perimeterSec_m: { usd: 480,  confidence: 'low',  source: 'boq.unitRates' },
                soc_perMw:      { usd: 45000, confidence: 'low', source: 'boq.unitRates' },
                /* ── testing_cx (per-MW anchors, scaled to category $) ── */
                cxL1_perMw:     { usd: 40000, confidence: 'low', source: 'boq.unitRates' },
                cxL2_perMw:     { usd: 45000, confidence: 'low', source: 'boq.unitRates' },
                cxL3_perMw:     { usd: 55000, confidence: 'low', source: 'boq.unitRates' },
                cxL4_perMw:     { usd: 60000, confidence: 'low', source: 'boq.unitRates' },
                cxL5_perMw:     { usd: 45000, confidence: 'low', source: 'boq.unitRates' },
                cxa_perMw:      { usd: 65000, confidence: 'low', source: 'boq.unitRates' },
                /* ── permits / soft (per-MW anchors) ── */
                designFee_perMw:{ usd: 180000,confidence: 'low', source: 'boq.unitRates' },
                pm_perMw:       { usd: 140000,confidence: 'low', source: 'boq.unitRates' },
                prelims_perMw:  { usd: 120000,confidence: 'low', source: 'boq.unitRates' },
                insurance_perMw:{ usd: 60000, confidence: 'low', source: 'boq.unitRates' },
                permitFee_perMw:{ usd: 80000, confidence: 'low', source: 'boq.unitRates' }
            },
            /* bare BLS national-mean trade wages ($/hr) — informational (labor is folded as
             * laborPct of material in screening mode; burden +35-60% for a real bid). */
            laborRates: {
                electrician:  { usdHr: 34.4, confidence: 'high', source: 'boq.unitRates' },
                pipefitter:   { usdHr: 34.7, confidence: 'high', source: 'boq.unitRates' },
                ironworker:   { usdHr: 31.0, confidence: 'med',  source: 'boq.unitRates' },
                laborer:      { usdHr: 25.0, confidence: 'high', source: 'boq.unitRates' }
            },
            commercialBasis: {
                epcMarginPctGross: 10,       /* gross margin (profit÷price) on LSTK mission-critical EPC */
                marginBandGross: [8, 12],
                netRealizedPct: [2, 6],       /* DC-specific net realized margin (tightest sourced) */
                contingencyRuleOfThumbPct: [20, 30],  /* AACE sets by risk; screening rule-of-thumb */
                aaceClass: 4,
                aaceBand: '−30% / +50%',
                marginNote: 'Benchmark $/kW are owner-delivered costs that ALREADY embed contractor margin; the margin shown is DISCLOSED (backed out of the subtotal via m/(1+m)), not added on top. 10% margin = 11.1% markup on cost.',
                safetyFactors: {
                    electricalContinuous: 1.25,   /* NEC 210.20(A)/215.3 continuous-load 125% */
                    structuralLRFD: '1.2D + 1.6L', /* ASCE 7-22 §2.3 */
                    cableAmpacityDerate: 0.75,     /* NEC 310.15 grouping×ambient (0.5-0.8) */
                    coolingRedundancy: 'N+1',      /* Uptime Tier-3 concurrently maintainable */
                    seismic: 'per zone factor (DATA.capexDetail.seismicMult)'
                },
                disclaimer: 'SCREENING-GRADE (AACE Class-4, −30%/+50%) — engine-computed decomposition of the parametric CAPEX total; NOT a quotation, tender, or detailed quantity survey. Quantities from sourced per-MW/per-rack ratios (many low-confidence rule-of-thumb, folded into the accuracy band), reconciled to the CAPEX category totals. Validate against RSMeans/Spon’s + a full engineering design before procurement.'
            },
            /* BOQ Ship-2 — nominal unit capacities for equipment-count sizing (N + redundancy).
             * Screening ratings; real selection depends on the design. Lead times are the
             * long-lead reality (MV transformer/switchgear dominate at ~120 wk, 2026). */
            equipmentSizing: {
                upsModuleKw: 500, gensetKw: 2500, transformerMva: 2.5, transformerPf: 0.9,
                crahKw: 150, cduKw: 700, chillerKw: 1400, pduKw: 300,
                leadTimeWk: { transformer: 120, mvSwitchgear: 120, ups: 26, generator: 40, chiller: 32, crah: 20, cdu: 30, pdu: 18 }
            },
            laborBurdenPct: 45,   /* add to bare BLS wages for a bid (35-60%); informational */
            /* BOQ Ship-2 — standard DC EPC procurement packages. Each maps to disciplines
             * whose CapexResult category $ give the package est value. leadTimeWk = order-to-
             * site; FAT/SAT + warranty per mission-critical norms. */
            procurement: [
                { pkgNo: 'P01', name: 'Enabling & Civil Works',       scope: 'earthworks, foundations, structure, envelope, raised floor', disciplines: ['civil_structural'], tenderMethod: 'lump-sum design-build', leadTimeWk: 8,   fatSat: 'N/A',            warrantyYr: 1, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P02', name: 'MV Switchgear & Transformers',  scope: 'incomer, RMU, MV switchgear, dry/oil transformers', disciplines: ['electrical'], tenderMethod: 'nominated supply+install', leadTimeWk: 120, fatSat: 'FAT + SAT',       warrantyYr: 2, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P03', name: 'LV Distribution & Busway',      scope: 'LV switchboards, busway, PDUs, cabling', disciplines: ['electrical'], tenderMethod: 'supply+install', leadTimeWk: 30, fatSat: 'FAT + SAT',       warrantyYr: 2, confidence: 'low', source: 'boq.procurement' },
                { pkgNo: 'P04', name: 'UPS & Battery Energy Storage',  scope: 'modular UPS, Li-ion/VRLA strings, STS', disciplines: ['electrical'], tenderMethod: 'nominated OEM', leadTimeWk: 26, fatSat: 'FAT + witness SAT', warrantyYr: 2, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P05', name: 'Standby Generators & Fuel',     scope: 'gensets, day/bulk tanks, exhaust, acoustic', disciplines: ['electrical'], tenderMethod: 'nominated OEM', leadTimeWk: 40, fatSat: 'FAT + load-bank SAT', warrantyYr: 2, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P06', name: 'Cooling Plant',                 scope: 'chillers, CRAH/CRAC, CDU/DLC, cooling towers, pumps', disciplines: ['mechanical_cooling'], tenderMethod: 'nominated OEM+install', leadTimeWk: 32, fatSat: 'FAT + SAT', warrantyYr: 2, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P07', name: 'Mechanical Piping & BMS',       scope: 'CW/CHW piping, valves, insulation, leak-detect, BMS', disciplines: ['mechanical_cooling', 'elv_ict'], tenderMethod: 'supply+install', leadTimeWk: 22, fatSat: 'SAT', warrantyYr: 2, confidence: 'low', source: 'boq.procurement' },
                { pkgNo: 'P08', name: 'Fire Detection & Suppression',  scope: 'VESDA, clean-agent, sprinkler, fire pumps, C&E', disciplines: ['fire'], tenderMethod: 'specialist supply+install', leadTimeWk: 20, fatSat: 'SAT + discharge test', warrantyYr: 2, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P09', name: 'ELV / ICT / DCIM',             scope: 'structured cabling, DCIM, network, MMR', disciplines: ['elv_ict'], tenderMethod: 'supply+install', leadTimeWk: 18, fatSat: 'SAT', warrantyYr: 3, confidence: 'low', source: 'boq.procurement' },
                { pkgNo: 'P10', name: 'Security Systems',              scope: 'CCTV, ACS, intrusion, SOC/PSIM, barriers', disciplines: ['security'], tenderMethod: 'supply+install', leadTimeWk: 16, fatSat: 'SAT', warrantyYr: 3, confidence: 'low', source: 'boq.procurement' },
                { pkgNo: 'P11', name: 'Integrated Commissioning (CxA)', scope: 'L1-L5 Cx: IST, IFC, load-bank, IST, black-building', disciplines: ['testing_cx'], tenderMethod: 'appointed CxA', leadTimeWk: 0, fatSat: 'IST/IFC/Level-5', warrantyYr: 0, confidence: 'med', source: 'boq.procurement' },
                { pkgNo: 'P12', name: 'Permits & Authority Approvals', scope: 'building/env/fire/utility permits, occupancy', disciplines: ['permits'], tenderMethod: 'owner + consultant', leadTimeWk: 0, fatSat: 'authority inspection', warrantyYr: 0, confidence: 'low', source: 'boq.procurement' }
            ]
        },

        /* ══ v2.5.4 (BOQ Ship-3) — DATA.dossier: the EPC Technical Project Dossier
         * scaffold that wraps the BOQ. Standard mission-critical DC content (permitting
         * matrix, design basis, risk register, document register, ops-readiness) —
         * STANDARD-PRACTICE tags (Uptime/TIA-942/BICSI/NFPA convention), NOT a
         * project-specific submission. models.dossier.sections() composes these with
         * live engine outputs (electrical/reliability/commissioning/spares/tier) into a
         * section list. Screening/reference — validate against the AHJ + a full design. ══ */
        dossier: {
            permittingMatrix: [
                { permit: 'Building / Construction Permit', authority: 'Local building authority / AHJ', durationWk: 12, dependency: 'Approved design + zoning', risk: 'high', standard: 'local building code' },
                { permit: 'Environmental Permit / EIA', authority: 'Environmental agency', durationWk: 20, dependency: 'Environmental impact study', risk: 'high', standard: 'local EIA regulation' },
                { permit: 'Fire Department Approval', authority: 'Fire authority', durationWk: 8, dependency: 'Fire strategy + C&E matrix', risk: 'med', standard: 'NFPA 75/76 / local' },
                { permit: 'Grid Interconnection / Utility Approval', authority: 'Electric utility / TSO', durationWk: 52, dependency: 'Load study + connection agreement', risk: 'high', standard: 'utility connection code' },
                { permit: 'MV/HV Energization Approval', authority: 'Utility / electrical inspectorate', durationWk: 16, dependency: 'SLD + protection settings', risk: 'high', standard: 'IEC/IEEE + local' },
                { permit: 'Water Supply & Wastewater', authority: 'Water utility / municipality', durationWk: 12, dependency: 'Water balance + discharge plan', risk: 'med', standard: 'local utility' },
                { permit: 'Fuel Storage Permit', authority: 'Fire authority / environmental', durationWk: 10, dependency: 'Tank design + secondary containment', risk: 'med', standard: 'NFPA 30 / local' },
                { permit: 'Telecommunications / Carrier Entry', authority: 'Telecom regulator / carriers', durationWk: 12, dependency: 'Route survey + carrier agreements', risk: 'low', standard: 'local telecom' },
                { permit: 'Occupancy Permit', authority: 'Building authority', durationWk: 6, dependency: 'Final inspection + as-builts', risk: 'med', standard: 'local building code' },
                { permit: 'Operational License', authority: 'Business/data authority', durationWk: 8, dependency: 'Occupancy + compliance certs', risk: 'med', standard: 'local jurisdiction' }
            ],
            designBasis: [
                { discipline: 'Electrical', basis: 'Utility supply, MV/LV topology, UPS + genset backup, redundancy per tier', standard: 'IEC 60364 / NEC / IEEE 3006', engineRef: 'models.requirements + capexDetail' },
                { discipline: 'Mechanical / Cooling', basis: 'Cooling architecture, ASHRAE thermal envelope, redundancy, PUE target', standard: 'ASHRAE TC9.9 / TIA-942', engineRef: 'DATA.pueMatrix, DATA.architecture.ashraeClasses' },
                { discipline: 'Structural', basis: 'Floor loading, seismic zone, wind, equipment foundations', standard: 'ASCE 7 / IBC', engineRef: 'DATA.architecture.floorLoadingKnM2' },
                { discipline: 'Fire & Life Safety', basis: 'Detection (VESDA), clean-agent suppression, compartmentation, egress', standard: 'NFPA 75/76/2001', engineRef: 'models.fire' },
                { discipline: 'Availability / Tier', basis: 'Uptime tier topology + availability target', standard: 'Uptime Tier / TIA-942', engineRef: 'models.tier, models.reliability' }
            ],
            /* Quantified risk register (BOQ Ship-D). Each row carries order-of-magnitude
             * screening fields for AACE Class-4 planning: costImpactPctBand = the $-impact
             * as a %-of-CAPEX BAND (rendered ×CAPEX to a $ order-of-magnitude, NOT a
             * quotation); scheduleSlipWk = schedule slip if unmitigated; residual = the
             * post-mitigation risk band (low/med/high); earlyWarning = the leading
             * indicator to watch. Bands are STANDARD-PRACTICE mission-critical DC
             * screening — validate against a project-specific risk workshop. */
            riskRegister: [
                { id: 'R01', category: 'Procurement', risk: 'Long-lead equipment (MV transformer ~120 wk) slips schedule', probability: 'high', impact: 'high', mitigation: 'Early procurement, pre-order, buffer float, alt vendors', owner: 'PMC', costImpactPctBand: [0.01, 0.03], scheduleSlipWk: 16, residual: 'med', earlyWarning: 'Transformer PO not placed by design-freeze +4 wk' },
                { id: 'R02', category: 'Authority', risk: 'Permit / grid-connection delay', probability: 'med', impact: 'high', mitigation: 'Early submission, utility engagement, parallel tracks', owner: 'Owner Eng', costImpactPctBand: [0.005, 0.02], scheduleSlipWk: 12, residual: 'med', earlyWarning: 'Utility connection agreement unsigned by RFS −52 wk' },
                { id: 'R03', category: 'Technical', risk: 'Cooling under-performance at high density', probability: 'med', impact: 'high', mitigation: 'CFD, IST/load-bank, N+1 margin', owner: 'CxA', costImpactPctBand: [0.005, 0.015], scheduleSlipWk: 6, residual: 'low', earlyWarning: 'CFD hotspot > ASHRAE allowable at design review' },
                { id: 'R04', category: 'Cost', risk: 'Escalation / FX on imported equipment', probability: 'high', impact: 'med', mitigation: 'Fixed-price packages, hedging, contingency', owner: 'QS', costImpactPctBand: [0.01, 0.04], scheduleSlipWk: 0, residual: 'med', earlyWarning: 'FX drift > 5% vs tender basis; index escalation > contingency draw-rate' },
                { id: 'R05', category: 'Construction', risk: 'Interface / integration gaps between packages', probability: 'med', impact: 'med', mitigation: 'Integration matrix, single Cx authority', owner: 'EPC', costImpactPctBand: [0.003, 0.01], scheduleSlipWk: 4, residual: 'low', earlyWarning: 'Open interface-matrix items > 10% at 60% construction' },
                { id: 'R06', category: 'Safety', risk: 'Working-at-height / confined-space / hot-work incidents', probability: 'med', impact: 'high', mitigation: 'Permit-to-work, method statements, HSE plan', owner: 'EPC HSE', costImpactPctBand: [0.002, 0.01], scheduleSlipWk: 3, residual: 'low', earlyWarning: 'Near-miss rate rising; permit-to-work compliance audit < 95%' },
                { id: 'R07', category: 'Supply Chain', risk: 'Single-source dependency (GPU/UPS/genset)', probability: 'med', impact: 'high', mitigation: 'Dual-source, framework agreements', owner: 'Procurement', costImpactPctBand: [0.005, 0.02], scheduleSlipWk: 10, residual: 'med', earlyWarning: 'OEM lead-time quote extends > 10% vs tender; no qualified alternate' },
                { id: 'R08', category: 'Commissioning', risk: 'Failure at integrated systems / black-building test', probability: 'low', impact: 'high', mitigation: 'Level 1-5 Cx, scripted scenarios, witness tests', owner: 'CxA', costImpactPctBand: [0.002, 0.008], scheduleSlipWk: 4, residual: 'low', earlyWarning: 'L4 sub-system Cx defects unclosed entering IST' }
            ],
            documentRegister: [
                'Design Drawings & Specifications', 'Engineering Calculations', 'Single-Line Diagrams', 'Method Statements', 'Inspection & Test Plans (ITP)', 'Factory Acceptance Test Reports', 'Site Acceptance Test Reports', 'Cable/Panel/Equipment Schedules', 'Shop & As-Built Drawings', 'Commissioning Report (L1-L5)', 'Asset Register / CMMS Data', 'O&M Manuals', 'Training Records', 'Warranty Documents', 'Closeout / Handover Package', 'BIM Model / Digital Twin'
            ],
            /* Document delivery schedule (BOQ Ship-D) — each key deliverable mapped to the
             * project PHASE it is issued in and the APPROVER role that accepts it. Approvers:
             * Owner Eng = owner's engineer, CxA = commissioning authority, AHJ = authority
             * having jurisdiction, EPC = the contractor. STANDARD-PRACTICE EPC document-
             * control convention (ISO 19650 / Uptime), NOT a project submission list. */
            documentSchedule: [
                { deliverable: 'Basis of Design (BoD) / Owner Project Requirements', phase: 'design', approver: 'Owner Eng' },
                { deliverable: 'Design Drawings & Specifications (IFC set)', phase: 'design', approver: 'Owner Eng' },
                { deliverable: 'Engineering Calculations & Single-Line Diagrams', phase: 'design', approver: 'Owner Eng' },
                { deliverable: 'Permit / Authority Submission Package', phase: 'design', approver: 'AHJ' },
                { deliverable: 'Procurement Specs & Vendor Data Sheets', phase: 'procurement', approver: 'Owner Eng' },
                { deliverable: 'Factory Acceptance Test (FAT) Reports', phase: 'procurement', approver: 'CxA' },
                { deliverable: 'Method Statements & Inspection/Test Plans (ITP)', phase: 'construction', approver: 'EPC' },
                { deliverable: 'Shop & Coordinated Drawings', phase: 'construction', approver: 'Owner Eng' },
                { deliverable: 'Site Acceptance Test (SAT) Reports', phase: 'construction', approver: 'CxA' },
                { deliverable: 'Integrated Systems Test (L4-L5) / Cx Report', phase: 'commissioning', approver: 'CxA' },
                { deliverable: 'Occupancy / Energization Approvals', phase: 'commissioning', approver: 'AHJ' },
                { deliverable: 'As-Built Drawings & Asset Register / CMMS', phase: 'handover', approver: 'Owner Eng' },
                { deliverable: 'O&M Manuals, Warranties & Training Records', phase: 'handover', approver: 'Owner Eng' },
                { deliverable: 'Closeout / Handover Package + BIM / Digital Twin', phase: 'handover', approver: 'Owner Eng' }
            ],
            /* Version-control convention applied to every deliverable above. */
            documentControlNote: 'All deliverables issued under a controlled revision scheme (P-series for preliminary, C-series for construction/IFC, AB for as-built) via a CDE (Common Data Environment, ISO 19650); superseded revisions retained; approver sign-off recorded per revision.',
            opsReadiness: [
                { item: 'Asset register + CMMS load', owner: 'FM', gate: 'pre-handover' },
                { item: 'Critical spares stocked (newsvendor)', owner: 'Ops', gate: 'pre-go-live', engineRef: 'models.spares' },
                { item: 'PM schedule + MOP/SOP/EOP', owner: 'FM', gate: 'pre-go-live', engineRef: 'models.maintenance' },
                { item: 'O&M contracts in place', owner: 'Procurement', gate: 'handover', engineRef: 'DATA.omContracts' },
                { item: 'Staff trained + emergency drills', owner: 'Ops', gate: 'pre-go-live' },
                { item: 'Warranty matrix + vendor contacts', owner: 'FM', gate: 'handover' }
            ],
            /* engineering calcs surfaced from existing engine models — each references
             * the model/data that computes it (traceability, not re-derivation). */
            engineeringCalcs: [
                { calc: 'Electrical load & UPS/genset sizing', engineRef: 'models.boq.equipmentSchedule + capexDetail', standard: 'NEC 220 / IEEE 3006' },
                { calc: 'Cooling / heat load', engineRef: 'models.boq.drivers.coolingKw + DATA.pueMatrix', standard: 'ASHRAE TC9.9' },
                { calc: 'Reliability / availability (tier)', engineRef: 'models.reliability + models.tier', standard: 'Uptime / IEEE 493' },
                { calc: 'Structural floor loading', engineRef: 'DATA.architecture.floorLoadingKnM2', standard: 'ASCE 7' },
                { calc: 'Fire water / clean-agent demand', engineRef: 'models.fire + DATA.boq.takeoff.fire', standard: 'NFPA 2001/750' },
                { calc: 'Water consumption / WUE', engineRef: 'DATA.waterFootprint', standard: 'ASHRAE / Uptime WUE' }
            ]
        },

        /* ══ v2.5.5 (Ship-C) — DATA.supplyChain: per-country landed-cost + export-control
         * + customs lead-time SHARED logic. Duty applies to the IMPORTED-EQUIPMENT
         * fraction of each cost category ONLY (labor/civil discount is already in the
         * country constructionIndex — split-rule; imported equipment stays ~1.0 USD +
         * duty). Export-control tiers are a Fed-Register PROXY — the AI Diffusion Rule
         * was RESCINDED, so this is advisory, NOT statutory/legal advice. Per-country
         * band assignment lives in CountryProfile.supplyChain (countries.ts). ══ */
        supplyChain: {
            /* import-exposed (equipment) fraction per CapexResult cost category — duty
             * only bites this portion (BOM split, screening). Labor-heavy ≈ 0. */
            equipmentShareByCategory: { electrical: 0.40, ups: 0.70, generator: 0.75, cooling: 0.55, network: 0.80, bms: 0.60, security: 0.60, fireSuppression: 0.50, fireAlarm: 0.50, building: 0.05, seismic: 0.05, commissioning: 0.0, testing: 0.0, permits: 0.0, coolingKit: 0.90 },
            /* effective duty rate on imported equipment by band (band midpoints). */
            importDutyBands: { fta: 0.0, low: 0.03, med: 0.075, high: 0.17, punitive: 0.30 },
            /* GPU export-control tiers — PROXY (AI Diffusion Rule RESCINDED). */
            exportTiers: {
                1: { label: 'Tier 1 (allied)',        note: 'no frontier-GPU restriction (US + close allies) — Fed-Register proxy, AI Diffusion Rule RESCINDED, not statutory' },
                2: { label: 'Tier 2 (intermediate)',  note: 'no hard cap in force (AI Diffusion Rule RESCINDED); case-by-case licensing possible — proxy, not statutory' },
                3: { label: 'Tier 3 (restricted)',    note: 'frontier GPU export-restricted (China graded / arms-embargo) — PROXY assessment; AI Diffusion Rule RESCINDED so the specific tier caps are not in force, but China/embargo controls persist under separate rules. Policy fluid, NOT legal advice' }
            },
            /* archProfiles that are frontier GPUs (trigger the export-control advisory). */
            frontierArchKeys: ['gb200_nvl72', 'gb300_nvl72', 'rubin_vr200'],
            /* customs clearance + inland logistics adder (weeks) on imported long-lead. */
            customsLeadWk: { fast: 2, normal: 6, slow: 12 }
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
            /* Poster-floor reference spec (owner baseline 2026-07-19): the 150 MW
             * poster fields the engine must never present LESS than. Additive —
             * surfaced verbatim on deepSea() output as `spec`. */
            spec: {
                intakeDepthM: [800, 1000], intakeTempC: [4, 6], returnTempC: [9, 11],
                loops: ['TCS — rack CDU to chip (treated water, closed)', 'FWS — facility water (closed)', 'Seawater heat rejection (open, raw)'],
                phe: { material: 'Titanium Grade 2', approachC: [1.5, 2.5], designPressureBar: 10 },
                filtrationStages: ['Coarse screen 50 mm', 'Fine screen 5 mm', 'Disc filter 200 \u00b5m', 'Automatic backwash 50 \u00b5m'],
                materials: { heatExchanger: 'Titanium Grade 2', seawaterPipeline: 'HDPE / GRP', pumps: 'Super Duplex / Bronze', fasteners: 'Super Duplex / Bronze', valves: 'Super Duplex / Titanium' },
                redundancyMap: { seawaterPumps: 'N+1', filters: 'N+1', heatExchangers: 'N+1 (parallel)', facilityWaterPumps: 'N+1', chillersBackup: 'N+1', powerSupply: '2N', controlSystem: '2N' },
                facilitySupplyC: [20, 21], facilityReturnC: [28, 32],
                trimChiller: 'N+1 chillers, VFD pumps, economizer mode — high-seawater-temp / maintenance backup only'
            },
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

        /* ══ v2.5.2 (Ship-B) — DATA.coolingTech: advanced/emerging cooling vendor +
         * technology-readiness database. Honesty regime: confidence 'commercial'
         * = TRL 8-9, shipping in production DCs today; 'emerging' = TRL 5-7,
         * pilot/lab/research — NEVER surfaced as a deployable datasheet, and
         * microfluidic in-chip is NOT encoded as any NVIDIA architecture fact
         * (official Rubin roadmap = warm-water DLC + 800 VDC). rackKwClaim = the
         * per-rack heat-rejection the tech can serve (screening). No public per-
         * rack CAPEX exists for microfluidic → capex multiplier is SCREENING-only
         * (capexDetail.coolingMult.microfluidic). ══ */
        coolingTech: {
            dlc_coldplate:  { vendor: 'CoolIT Systems',   tech: 'Direct-to-chip cold plate (DLC)',        family: 'dlc',        trl: 9, rackKwClaim: 120, coolant: 'water/PG (single-phase)',   wueBasis: 'facility water at CDU, low direct', confidence: 'commercial', ref: 'Coldplate + row/rack CDU manifolds; shipping in GB200 NVL72 deployments', source: 'coolingTech' },
            dlc_microconv:  { vendor: 'JetCool (Flex)',    tech: 'Microconvective direct-to-chip (SmartPlate/SmartRack)', family: 'dlc', trl: 8, rackKwClaim: 100, coolant: 'water/PG (single-phase)', wueBasis: 'closed-loop, low', confidence: 'commercial', ref: 'Targeted microjet impingement on die; commercial modules', source: 'coolingTech' },
            dlc_2p_waterless:{ vendor: 'ZutaCore',         tech: 'Two-phase waterless direct-to-chip (HyperCool)', family: 'dlc_2p', trl: 8, rackKwClaim: 100, coolant: 'dielectric (2-phase)',   wueBasis: 'waterless loop, ~0 direct WUE', confidence: 'commercial', ref: 'Evaporative dielectric on cold plate; no facility water at rack', source: 'coolingTech' },
            immersion_1p:   { vendor: 'GRC / Submer',      tech: 'Single-phase immersion (ElectroSafe / SmartPod)', family: 'immersion_1p', trl: 9, rackKwClaim: 200, coolant: 'dielectric oil (single-phase)', wueBasis: 'waterless tank, near-zero WUE', confidence: 'commercial', ref: 'Tank immersion, production at scale (GRC, Submer, Iceotope chassis)', source: 'coolingTech' },
            immersion_2p:   { vendor: 'LiquidStack',       tech: 'Two-phase immersion (DataTank)',          family: 'immersion_2p', trl: 7, rackKwClaim: 200, coolant: 'fluorocarbon dielectric (2-phase)', wueBasis: 'waterless, near-zero WUE', confidence: 'emerging',   ref: 'Best-in-class PUE but PFAS/F-gas regulatory pressure on 2φ fluids has slowed rollout', source: 'coolingTech' },
            microfluidic:   { vendor: 'Corintis / TSMC / IMEC / IBM', tech: 'In-chip microfluidic (silicon microchannels / impinging jet)', family: 'microfluidic', trl: 6, rackKwClaim: 250, coolant: 'water/dielectric in-die microchannels', wueBasis: 'research — no production basis', confidence: 'emerging', ref: 'PILOT/RESEARCH TRL~6-7: Corintis (EPFL, Microsoft-validated in-chip), TSMC DSLC silicon microchannels, IMEC impinging-jet >600 W/cm², IBM pioneer. Enabler for >200kW→1MW racks (~2027-28). NO public per-rack price. NOT an NVIDIA architecture fact.', source: 'coolingTech' }
        },

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
             * (1 = best). power/grid dominate DC site selection. v2.5.0: +climate
             * (free-cooling hours) factor per CBRE/JLL site-selection frameworks. */
            weights: { power: 0.17, grid: 0.14, seismic: 0.10, talent: 0.11, tax: 0.09, carbon: 0.09, flood: 0.07, latency: 0.07, water: 0.08, climate: 0.08 },
            /* v2.5.0 site research pass — ASHRAE 169-2021 climate zone → annual
             * economizer (free-cooling) hours; USGS PGA %g → IBC/ASCE-7 SDC score;
             * WRI Aqueduct 0-5 water-stress → 0-1; IEEE-1366 SAIDI reference. */
            climateFreeHours: { '1': 800, '2': 1400, '3': 2200, '4': 3500, '5': 4200, '6': 5000, '7': 5500, '8': 5800 },
            saidiRefMin: 500,
            pgaToScore: [ { maxPga: 5, s: 1.0 }, { maxPga: 15, s: 0.8 }, { maxPga: 30, s: 0.6 }, { maxPga: 60, s: 0.35 }, { maxPga: 9999, s: 0.1 } ],
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
            ],
            /* Cx PROGRAM cost + schedule model (promoted from cx-calculator.html so
             * DCMOC + the calculator share one source). base = $/kW per discipline;
             * levels L0-L6 with cost share + schedule-weight; discipline split of
             * total; multipliers by cooling/redundancy. Region day-rate scaling
             * uses DATA.countries[id].constructionIndex. */
            cx: {
                base: { electrical: 72, mechanical_air: 35, mechanical_dlc: 50, fire: 12, security: 6, it: 11, controls: 14, building: 5 }, /* $/kW IT */
                levels: {
                    L0: { costShare: 0.03, schedWeight: 0.06, label: 'L0 Design & Cx Prep' },
                    L1: { costShare: 0.04, schedWeight: 0.08, label: 'L1 Factory Witness' },
                    L2: { costShare: 0.10, schedWeight: 0.12, label: 'L2 Standalone Functional' },
                    L3: { costShare: 0.22, schedWeight: 0.20, label: 'L3 System Functional' },
                    L4: { costShare: 0.20, schedWeight: 0.18, label: 'L4 Subsystem Integration' },
                    L5: { costShare: 0.32, schedWeight: 0.27, label: 'L5 Integrated Systems Test' },
                    L6: { costShare: 0.09, schedWeight: 0.09, label: 'L6 Closeout & Turnover' }
                },
                disciplineSplit: { electrical: 0.40, mechanical: 0.24, fire: 0.09, controls: 0.08, it: 0.07, security: 0.04, building: 0.04, management: 0.04 },
                coolingMult: { air: 1.0, inrow: 1.05, rdhx: 1.12, liquid: 1.22, immersion: 1.30 },
                redundancyMult: { n: 0.9, n1: 1.0, '2n': 1.18, '2n1': 1.28 },
                contingency: 0.15,
                /* schedule anchor: base months at 1 MW + growth per MW (log-damped). */
                schedBaseMonths: 4.5, schedPerMw: 0.45, schedMaxMonths: 20,
                /* ── RICH cx program engine (v2.5.0) — faithful port of the DC-Hub
                 *  cx-calculator.html model so DCMOC + the calculator share ONE brain.
                 *  Equipment-count-driven L0-L6 staffed durations + regional day-rates,
                 *  gm-normalized base blend, Monte-Carlo band + sensitivity tornado.
                 *  Consumed by models.commissioning.programRich/monteCarlo/sensitivity. ── */
                rich: {
                    /* 30 regional day-rate cards ($/day + per-diem + diesel $/L + cost mult vs US). */
                    rates: {
                        us_virginia:{name:'Northern Virginia',cxDay:1200,fieldDay:850,oemDay:2000,witnessDay:3500,perDiem:300,diesel:1.10,mult:1.00},
                        us_texas:{name:'Dallas-Fort Worth',cxDay:1100,fieldDay:800,oemDay:1800,witnessDay:3500,perDiem:250,diesel:0.95,mult:0.92},
                        us_oregon:{name:'Oregon',cxDay:1150,fieldDay:825,oemDay:1900,witnessDay:3500,perDiem:280,diesel:1.15,mult:0.96},
                        us_phoenix:{name:'Phoenix',cxDay:1050,fieldDay:750,oemDay:1800,witnessDay:3500,perDiem:240,diesel:1.05,mult:0.88},
                        canada_toronto:{name:'Toronto',cxDay:1050,fieldDay:780,oemDay:1700,witnessDay:3200,perDiem:260,diesel:1.45,mult:0.88},
                        uk_london:{name:'London',cxDay:875,fieldDay:650,oemDay:1500,witnessDay:3000,perDiem:280,diesel:1.75,mult:0.73},
                        netherlands_amsterdam:{name:'Amsterdam',cxDay:950,fieldDay:700,oemDay:1600,witnessDay:3200,perDiem:270,diesel:1.85,mult:0.79},
                        germany_frankfurt:{name:'Frankfurt',cxDay:1000,fieldDay:750,oemDay:1650,witnessDay:3200,perDiem:260,diesel:1.80,mult:0.83},
                        ireland_dublin:{name:'Dublin',cxDay:900,fieldDay:680,oemDay:1550,witnessDay:3000,perDiem:280,diesel:1.70,mult:0.75},
                        france_paris:{name:'Paris',cxDay:920,fieldDay:680,oemDay:1500,witnessDay:3000,perDiem:270,diesel:1.90,mult:0.77},
                        nordics_stockholm:{name:'Stockholm',cxDay:1050,fieldDay:780,oemDay:1700,witnessDay:3200,perDiem:290,diesel:1.95,mult:0.88},
                        spain_madrid:{name:'Madrid',cxDay:750,fieldDay:550,oemDay:1300,witnessDay:2800,perDiem:200,diesel:1.60,mult:0.63},
                        singapore:{name:'Singapore',cxDay:850,fieldDay:620,oemDay:1500,witnessDay:3000,perDiem:280,diesel:1.60,mult:0.71},
                        japan_tokyo:{name:'Tokyo',cxDay:1000,fieldDay:750,oemDay:1800,witnessDay:3500,perDiem:300,diesel:1.30,mult:0.83},
                        australia_sydney:{name:'Sydney',cxDay:950,fieldDay:700,oemDay:1600,witnessDay:3200,perDiem:260,diesel:1.50,mult:0.79},
                        india_mumbai:{name:'Mumbai',cxDay:400,fieldDay:250,oemDay:800,witnessDay:2000,perDiem:120,diesel:1.10,mult:0.33},
                        china_shanghai:{name:'Shanghai',cxDay:550,fieldDay:350,oemDay:1000,witnessDay:2500,perDiem:150,diesel:1.20,mult:0.46},
                        korea_seoul:{name:'Seoul',cxDay:750,fieldDay:550,oemDay:1300,witnessDay:2800,perDiem:200,diesel:1.35,mult:0.63},
                        hk:{name:'Hong Kong',cxDay:900,fieldDay:650,oemDay:1500,witnessDay:3000,perDiem:300,diesel:1.80,mult:0.75},
                        indonesia_jakarta:{name:'Jakarta',cxDay:350,fieldDay:200,oemDay:700,witnessDay:1800,perDiem:100,diesel:1.05,mult:0.29},
                        malaysia_kl:{name:'Kuala Lumpur',cxDay:400,fieldDay:280,oemDay:750,witnessDay:2000,perDiem:110,diesel:0.85,mult:0.33},
                        uae_dubai:{name:'Dubai',cxDay:800,fieldDay:550,oemDay:1400,witnessDay:3000,perDiem:250,diesel:0.75,mult:0.67},
                        saudi_riyadh:{name:'Riyadh',cxDay:850,fieldDay:600,oemDay:1500,witnessDay:3000,perDiem:250,diesel:0.60,mult:0.71},
                        south_africa_jhb:{name:'Johannesburg',cxDay:500,fieldDay:350,oemDay:900,witnessDay:2200,perDiem:150,diesel:1.40,mult:0.42},
                        nigeria_lagos:{name:'Lagos',cxDay:400,fieldDay:250,oemDay:800,witnessDay:2000,perDiem:180,diesel:0.95,mult:0.33},
                        kenya_nairobi:{name:'Nairobi',cxDay:350,fieldDay:220,oemDay:700,witnessDay:1800,perDiem:150,diesel:1.30,mult:0.29},
                        brazil_saopaulo:{name:'São Paulo',cxDay:500,fieldDay:350,oemDay:900,witnessDay:2200,perDiem:150,diesel:1.25,mult:0.42},
                        chile_santiago:{name:'Santiago',cxDay:550,fieldDay:380,oemDay:950,witnessDay:2400,perDiem:160,diesel:1.20,mult:0.46},
                        mexico_queretaro:{name:'Querétaro',cxDay:480,fieldDay:320,oemDay:850,witnessDay:2200,perDiem:140,diesel:1.15,mult:0.40}
                    },
                    cooling: {air:{cost:1.00,dur:1.00},inrow:{cost:1.12,dur:1.08},rdhx:{cost:1.25,dur:1.18},dlc:{cost:1.45,dur:1.35},immersion:{cost:1.55,dur:1.40}},
                    redundancy: {
                        'N':   {cost:1.00,dur:1.00,tier:'Tier I',avail:'99.671%',scenarios:3,istHrs:14},
                        'N+1': {cost:1.35,dur:1.30,tier:'Tier II/III',avail:'99.982%',scenarios:6,istHrs:16},
                        '2N':  {cost:2.00,dur:1.75,tier:'Tier IV',avail:'99.995%',scenarios:10,istHrs:110},
                        '2N+1':{cost:2.25,dur:1.90,tier:'Tier IV+',avail:'99.9995%',scenarios:10,istHrs:120}
                    },
                    building: {warehouse:{cost:0.80,dur:0.85},modular:{cost:0.75,dur:0.70},purpose:{cost:1.00,dur:1.00},highrise:{cost:1.30,dur:1.25}},
                    seismic: {'0':{cost:1.00,dur:1.00},'1':{cost:1.05,dur:1.03},'2':{cost:1.12,dur:1.08},'3':{cost:1.22,dur:1.15},'4':{cost:1.35,dur:1.25}},
                    substation: {utility_fed:{cost:0.70,dur:0.75},single_sub:{cost:1.00,dur:1.00},dual_sub:{cost:1.85,dur:1.60},ring_bus:{cost:2.10,dur:1.80}},
                    bms: {basic:{cost:0.60,dur:0.50,pts:200},standard:{cost:1.00,dur:1.00,pts:500},advanced:{cost:1.60,dur:1.45,pts:1200},ai_driven:{cost:2.00,dur:1.70,pts:2000}},
                    delivery: {traditional:{cost:1.00,dur:1.00},design_build:{cost:0.90,dur:0.85},epc:{cost:0.85,dur:0.80},modular_pod:{cost:0.70,dur:0.60}},
                    scope: {new_build:{cost:1.00,dur:1.00},retrofit:{cost:0.75,dur:0.70},recommission:{cost:0.55,dur:0.50},continuous:{cost:0.30,dur:0.25}},
                    fire: {fm200:1.00,novec:1.05,inergen:1.10,n2:1.08,water:0.85,water_mist:1.15},
                    ups: {standalone:1.00,modular:1.25,distributed:1.15,rotary:1.40},
                    gen: {diesel:1.00,gas:1.10,dualfuel:1.25,hvo:1.08},
                    density: {standard:{kw:6,cool:1.0,pow:1.0},medium:{kw:12,cool:1.15,pow:1.05},high:{kw:25,cool:1.35,pow:1.15},ai_hpc:{kw:75,cool:1.60,pow:1.30}},
                    baseKw: {electrical:72,mechanical_air:35,mechanical_dlc:50,fire:12,security:6,it:11,controls:14,building:5},
                    /* Fixed display proportions (grand-total split — realistic cost weights). */
                    levelProportions: {l0:0.03,l1:0.04,l2:0.10,l3:0.22,l4:0.20,l5:0.32,l6:0.09},
                    levelLabels: {l0:'L0 Design & Cx Prep',l1:'L1 Factory Witness',l2:'L2 Standalone Functional',l3:'L3 System Functional',l4:'L4 Subsystem Integration',l5:'L5 Integrated Systems Test',l6:'L6 Closeout & Turnover'},
                    disciplineShare: {electrical:0.40,mechanical:0.24,fire:0.09,security:0.04,it:0.07,controls:0.08,building:0.04,management:0.04},
                    capexPerKw: {standard:10500,high:13000,ai_hpc:16000},
                    normExp: 0.45, contingency: 0.15,
                    /* ISO-2 country → CX region key (nearest labor/cost peer where no exact card). */
                    iso2Region: {US:'us_virginia',CA:'canada_toronto',GB:'uk_london',NL:'netherlands_amsterdam',DE:'germany_frankfurt',IE:'ireland_dublin',FR:'france_paris',SE:'nordics_stockholm',ES:'spain_madrid',SG:'singapore',JP:'japan_tokyo',AU:'australia_sydney',IN:'india_mumbai',CN:'china_shanghai',KR:'korea_seoul',HK:'hk',ID:'indonesia_jakarta',MY:'malaysia_kl',AE:'uae_dubai',SA:'saudi_riyadh',QA:'uae_dubai',ZA:'south_africa_jhb',NG:'nigeria_lagos',KE:'kenya_nairobi',BR:'brazil_saopaulo',CL:'chile_santiago',MX:'mexico_queretaro',CO:'mexico_queretaro',TH:'malaysia_kl',VN:'indonesia_jakarta',PH:'malaysia_kl',TW:'korea_seoul',NZ:'australia_sydney',PL:'germany_frankfurt',PT:'spain_madrid'},
                    /* DCMOC coolingType enum → CX cooling key. */
                    coolingMap: {air:'air',inrow:'inrow',rdhx:'rdhx',liquid:'dlc',dlc:'dlc',immersion:'immersion'},
                    /* Scenario presets (parity with cx-calculator.html CX_SCENARIOS). */
                    scenarios: {
                        enterprise_2mw:{itLoad:2000,coolingType:'air',redundancy:'N+1',rackDensity:'standard',buildingType:'purpose',fireSuppression:'novec',upsType:'modular',region:'us_virginia',generatorType:'diesel',seismicZone:'1',cxScope:'new_build',substationConfig:'single_sub',bmsComplexity:'standard',deliveryMethod:'traditional'},
                        colo_10mw:{itLoad:10000,coolingType:'inrow',redundancy:'2N',rackDensity:'medium',buildingType:'purpose',fireSuppression:'novec',upsType:'modular',region:'us_virginia',generatorType:'diesel',seismicZone:'2',cxScope:'new_build',substationConfig:'dual_sub',bmsComplexity:'advanced',deliveryMethod:'design_build'},
                        hyperscale_50mw:{itLoad:50000,coolingType:'dlc',redundancy:'2N+1',rackDensity:'ai_hpc',buildingType:'purpose',fireSuppression:'novec',upsType:'modular',region:'us_virginia',generatorType:'diesel',seismicZone:'1',cxScope:'new_build',substationConfig:'ring_bus',bmsComplexity:'ai_driven',deliveryMethod:'epc'},
                        edge_500kw:{itLoad:500,coolingType:'air',redundancy:'N+1',rackDensity:'standard',buildingType:'warehouse',fireSuppression:'fm200',upsType:'standalone',region:'us_texas',generatorType:'diesel',seismicZone:'0',cxScope:'new_build',substationConfig:'utility_fed',bmsComplexity:'basic',deliveryMethod:'traditional'},
                        modular_5mw:{itLoad:5000,coolingType:'rdhx',redundancy:'N+1',rackDensity:'high',buildingType:'modular',fireSuppression:'water_mist',upsType:'modular',region:'nordics_stockholm',generatorType:'hvo',seismicZone:'0',cxScope:'new_build',substationConfig:'single_sub',bmsComplexity:'standard',deliveryMethod:'modular_pod'},
                        recommission:{itLoad:3000,coolingType:'air',redundancy:'N+1',rackDensity:'standard',buildingType:'purpose',fireSuppression:'fm200',upsType:'standalone',region:'uk_london',generatorType:'diesel',seismicZone:'0',cxScope:'recommission',substationConfig:'single_sub',bmsComplexity:'standard',deliveryMethod:'traditional'},
                        ai_factory_100mw:{itLoad:100000,coolingType:'dlc',redundancy:'2N+1',rackDensity:'ai_hpc',buildingType:'purpose',fireSuppression:'novec',upsType:'distributed',region:'us_texas',generatorType:'dualfuel',seismicZone:'1',cxScope:'new_build',substationConfig:'ring_bus',bmsComplexity:'ai_driven',deliveryMethod:'epc'},
                        fast_track:{itLoad:10000,coolingType:'inrow',redundancy:'N+1',rackDensity:'medium',buildingType:'warehouse',fireSuppression:'water',upsType:'modular',region:'us_virginia',generatorType:'diesel',seismicZone:'1',cxScope:'new_build',substationConfig:'single_sub',bmsComplexity:'standard',deliveryMethod:'design_build'}
                    },
                    /* Default cx input for fields DCMOC does not carry (budgetary assumptions). */
                    defaults: {rackDensity:'standard',buildingType:'purpose',fireSuppression:'novec',upsType:'modular',generatorType:'diesel',seismicZone:'1',cxScope:'new_build',substationConfig:'single_sub',bmsComplexity:'standard',deliveryMethod:'traditional',region:'us_virginia'}
                }
            }
        },
        /* ══ DC-OS shared pillar engines (v1.63.0): tier classification, fire
         * suppression sizing, CDU/liquid-cooling sizing, spares (EOQ), and the
         * Layer-13 decision benchmarks — consolidated so DCMOC + the standalone
         * tools share one source. ══ */
        tier: {
            /* Uptime-style tier from a 0-100 weighted infrastructure score. */
            weights: { power: 0.34, cooling: 0.26, network: 0.16, physical: 0.14, monitoring: 0.10 },
            bands: [ { min: 90, tier: 4, label: 'Tier IV — Fault Tolerant' }, { min: 75, tier: 3, label: 'Tier III — Concurrently Maintainable' }, { min: 55, tier: 2, label: 'Tier II — Redundant Components' }, { min: 0, tier: 1, label: 'Tier I — Basic Capacity' } ],
            /* Redundancy floor — a tier can't exceed what its redundancy supports. */
            redundancyCap: { n: 1, n1: 3, '2n': 4, '2n1': 4 },
            /* 6-band advisor (tier-advisor.html) weights — separate from classify() weights above. */
            adviseWeights: { power: 0.35, cooling: 0.20, network: 0.15, physical: 0.10, monitoring: 0.05, regional: 0.15 },
            /* Component score maps (tier-advisor.html SCORE_MAPS). */
            scoreMaps: {
                utilityFeeds:     { single: 10, dual_same: 40, dual_diverse: 80, onsite: 60 },
                genConfig:        { none: 0, n: 30, n1: 60, '2n': 85, '2n1': 100 },
                upsConfig:        { none: 0, n: 20, n1: 50, '2n': 80, '2n1': 100, distributed: 90 },
                upsTopo:          { standby: 20, line_interactive: 40, double_conversion: 90, rotary: 80 },
                atsConfig:        { none: 0, single: 40, dual: 75, sts: 100 },
                pduRedundancy:    { single: 20, dual: 70, triple: 100 },
                coolRedundancy:   { n: 15, n1: 50, n2: 70, '2n': 90, '2n1': 100 },
                coolDistribution: { single: 20, dual: 70, n1_piping: 100 },
                coolType:         { dx: 55, chilled_water: 65, free_cooling: 75, rdhx: 80, dlc: 90, immersion: 100 },
                netEntry:         { single: 15, dual_same: 40, dual_diverse: 80, three_plus: 100 },
                carrierDiv:       { single: 20, two: 60, three_plus: 100 },
                meetMeRoom:       { none: 0, single: 50, redundant: 100 },
                fireSuppression:  { none: 0, wet: 50, preaction: 65, clean: 85, vesda_clean: 100 },
                accessControl:    { key: 15, card: 40, biometric: 75, mfa_mantrap: 100 },
                monitoring:       { none: 0, basic: 30, bms: 65, full_dcim: 100 }
            },
            /* 6-band grade → label map (composite score thresholds). */
            gradeBands: [
                { min: 90, label: 'Tier IV',  grade: 'A+', tierNum: 4, desc: 'Fault Tolerant' },
                { min: 75, label: 'Tier III', grade: 'A',  tierNum: 3, desc: 'Concurrently Maintainable' },
                { min: 60, label: 'Tier II+', grade: 'B',  tierNum: 2, desc: 'Redundant Components+' },
                { min: 45, label: 'Tier II',  grade: 'C',  tierNum: 2, desc: 'Redundant Components' },
                { min: 25, label: 'Tier I+',  grade: 'D',  tierNum: 1, desc: 'Basic Capacity+' },
                { min: 0,  label: 'Tier I',   grade: 'F',  tierNum: 1, desc: 'Basic Capacity' }
            ]
        },
        fire: {
            /* Clean-agent properties for NFPA-2001 quantity sizing. s = specific
             * vapour volume k1 + k2*T (m3/kg); designC = typical design conc (%).
             * designConcClassA / noaelPct / loaelPct / gwp100 from fire-model.js (NFPA 2001). */
            agents: {
                novec1230: { type: 'halocarbon', k1: 0.0664, k2: 0.0002741, designC: 4.5, label: 'Novec 1230',
                             designConcClassA: 4.7, noaelPct: 10.0, loaelPct: 10.0, gwp100: 1, cylinderFillKgTypical: 100 },
                fm200:     { type: 'halocarbon', k1: 0.1269, k2: 0.0005140, designC: 7.0, label: 'FM-200 (HFC-227ea)',
                             designConcClassA: 7.0, noaelPct: 9.0, loaelPct: 10.5, gwp100: 3220, cylinderFillKgTypical: 120 },
                ig541:     { type: 'inert', designC: 37.5, label: 'Inert Gas IG-541',
                             designConcClassA: 37.5, noaelPct: 43, loaelPct: 52, gwp100: 0, cylinderFillM3Typical: 22.3 }
            },
            /* Li-ion / VRLA battery chemistry for thermal-runaway risk (fire-model.js). */
            battery: {
                nmc:  { name: 'Li-ion NMC', runawayOnsetC: 150,   offGasLPerWh: 4.0 },
                lfp:  { name: 'Li-ion LFP', runawayOnsetC: 166.8, offGasLPerWh: 2.0 },
                lco:  { name: 'Li-ion LCO', runawayOnsetC: 150,   offGasLPerWh: 4.5 },
                vrla: { name: 'VRLA lead-acid', runawayOnsetC: null, offGasLPerWh: 0 }
            },
            /* Off-gas flammability limits (NFPA 855). */
            offGas: { ventGasLflPct: 6.0 },
            /* TR heat release factor MJ-released / MJ-stored (fire-model.js). */
            trHeatFactor: { nmc: 2.5, lfp: 1.2, lco: 2.6, vrla: 0 },
            /* NFPA 72 / 2001 / 855 operating bands. */
            bands: {
                dischargeTimeS:       { max: 10 },
                holdTimeMin:          { min: 10 },
                safetyMarginPct:      { min: 0 },
                spotDetectorAreaM2:   { max: 84 },
                gasDetectAlarmPctLfl: { max: 25 }
            }
        },
        /* ── A18: AI-factory readiness screening (article-18 promoted). ── */
        aiFactory: {
            opex: { coolMaintPerMwYr: { air: 120000, dtc: 320000, immersion: 480000 },
                    staffingPerMwYr: 450000, staffingMinYr: 350000,
                    networkMaintPerMwYr: 160000, insurancePerMwYr: 70000 },
            weights: { cooling: 0.35, structural: 0.25, density: 0.20, pue: 0.10, age: 0.10 },
            /* A23: GPU-campus build screening (article-23 Colossus benchmark). */
            gpuBuild: { colossusBenchmarkDays: 122, infraCostPerMw: 8000000, tcoYears: 5 }
        },

        /* ── A20b: per-query AI water footprint (article-20 wfc/avh tabs). ── */
        aiWater: {
            /* mL of water per query, direct datacenter use (Li et al. 2023 scaling +
             * published env. reports; estimate-grade per-model attribution). */
            models: {
                gpt54:    { name: 'GPT-5.4',           water: 0.70, company: 'OpenAI',     type: 'text' },
                gpt4o:    { name: 'GPT-4o',            water: 0.50, company: 'OpenAI',     type: 'text' },
                gpt4turbo:{ name: 'GPT-4 Turbo',       water: 0.55, company: 'OpenAI',     type: 'text' },
                o3:       { name: 'o3 (Reasoning)',    water: 2.50, company: 'OpenAI',     type: 'reasoning' },
                o4mini:   { name: 'o4-mini',           water: 0.75, company: 'OpenAI',     type: 'reasoning' },
                opus46:   { name: 'Claude Opus 4.6',   water: 0.60, company: 'Anthropic',  type: 'text' },
                sonnet46: { name: 'Claude Sonnet 4.6', water: 0.40, company: 'Anthropic',  type: 'text' },
                haiku45:  { name: 'Claude Haiku 4.5',  water: 0.20, company: 'Anthropic',  type: 'text' },
                gemini25pro:  { name: 'Gemini 2.5 Pro',   water: 0.45, company: 'Google', type: 'text' },
                gemini25flash:{ name: 'Gemini 2.5 Flash', water: 0.22, company: 'Google', type: 'text' },
                llama4mav:   { name: 'Llama 4 Maverick', water: 0.42, company: 'Meta',       type: 'text' },
                llama4scout: { name: 'Llama 4 Scout',    water: 0.30, company: 'Meta',       type: 'text' },
                grok3:     { name: 'Grok 3',            water: 0.55, company: 'xAI',        type: 'text' },
                copilot:   { name: 'GitHub Copilot',    water: 0.35, company: 'Microsoft',  type: 'text' },
                deepseek3: { name: 'DeepSeek-V3',       water: 0.38, company: 'DeepSeek',   type: 'text' },
                midjourney:{ name: 'Midjourney v7',     water: 5.00, company: 'Midjourney', type: 'image' },
                dalle4:    { name: 'DALL-E 4',          water: 4.50, company: 'OpenAI',     type: 'image' },
                sd3:       { name: 'Stable Diff. 3',    water: 3.50, company: 'Stability',  type: 'image' },
                sora:      { name: 'Sora (Video)',      water: 50.0, company: 'OpenAI',     type: 'video' }
            },
            complexityMult: { simple: 0.6, medium: 1.0, complex: 3.0, image: 10.0, video: 50.0 },
            coolingMult: { evaporative: 1.0, hybrid: 0.6, aircooled: 0.15, closedloop: 0.05 },
            regionMult: { arid: 1.3, temperate: 1.0, cool: 0.7, tropical: 1.1 },
            upstreamFactor: 3.0,               // upstream power-generation water multiplier (screening)
            scaleMultipliers: { personal: 1, team: 50, company: 1000, city: 100000, global: 10000000000 },
            equivalences: { bottleL: 0.5, showerL: 65, drinkLPerDay: 2, co2KgPerL: 0.0005, waterCostUsdPerL: 0.006, glassL: 0.25, householdLPerDay: 1135 }
        },

        /* ── A4: MTTR vendor-vs-inhouse response model (article-4). ── */
        mttrResponse: {
            categoryBase: {
                Electrical:        { detect: 0.25, diagnose: 0.5,  repair: 1.5, verify: 0.5 },
                Mechanical:        { detect: 0.5,  diagnose: 0.75, repair: 2.0, verify: 0.5 },
                Controls:          { detect: 0.15, diagnose: 1.0,  repair: 1.0, verify: 0.75 },
                'Fire Protection': { detect: 0.1,  diagnose: 0.5,  repair: 1.5, verify: 1.0 }
            },
            skillFactors: { 1: 1.5, 2: 1.2, 3: 1.0, 4: 0.75, 5: 0.55 },   // in-house skill level multiplier
            coverageMobilizeHr: { '24_7': 0.25, '16_7': 0.80, '12_5': 2.10 },
            durationCv: { low: 0.20, medium: 0.35, high: 0.50 },
            spareGapFactor: 0.5,              // repair inflation when spares coverage < 100%
            retainerRecovery: 0.55,           // share of vendor retainer recoverable in-house
            nonCriticalCostFactor: 0.3        // downtime cost weight for non-critical load
        },

        /* ── A5: technical-debt operational-risk model (article-5). ── */
        techDebt: {
            weights: { critical: 10, major: 5, minor: 1 },
            weibull: { beta: 2.5, etaMonths: 60, betaAgePerYr: 0.05, betaCap: 4.0, etaDecayPerYr: 1.5, etaFloorMonths: 30, facAgeBetaFromYr: 10, facAgeEtaFromYr: 15 },
            facilityAgeDivisor: 20,           // facility multiplier = 1 + facAgeYears/20
            riskGrowthPerYr: 0.15,
            discountRate: 0.08,
            ageCost: { factor: 0.5, baseMonths: 24 },   // escalation = 1 + (age/24)*0.5
            inactionFactor: 0.3,
            revenueAtRiskFactor: 0.1,
            slaPenaltyFactor: 0.001,
            insuranceBands: [ { min: 75, f: 0.08 }, { min: 50, f: 0.05 }, { min: 25, f: 0.03 }, { min: 0, f: 0.01 } ],
            remediation: { critDays: 5, majDays: 3, minDays: 1.5, avgDays: 3, workDaysPerMonth: 22, fte: 3 }
        },

        /* ── A6: RCA program effectiveness score (article-6). ── */
        rcaScore: {
            weights: { completion: 0.20, implementation: 0.25, recurrence: 0.20, time: 0.15, designAuthority: 0.10, verification: 0.10 },
            timeTargetDays: 90
        },

/* @@CORPUS_START — GENERATED by tools/dc-corpus/aggregate.mjs from dc-facts.json
 * (public multi-source corpus; every underlying fact carries source_url + verbatim
 * quote, gate-enforced). Do NOT hand-edit — rerun the corpus pipeline. */
        benchmarksCorpus: {
                "capacity_mw": {
                        "finance": {
                                "n": 135,
                                "unit": "MW",
                                "p10": 20,
                                "p25": 50,
                                "p50": 120,
                                "p75": 433,
                                "p90": 635,
                                "companies": [
                                        "DLR 10-K FY25",
                                        "DLR 1Q26 Release",
                                        "DigitalCore REIT Dec25",
                                        "Equinix 10-K FY25",
                                        "Equinix Q2-25 Deck",
                                        "IronMountain 10-K FY25",
                                        "IronMountain Q2-25 Deck",
                                        "KeppelDC AR2024",
                                        "NEXTDC FY24",
                                        "NTT IR Nov25",
                                        "YTL Power AR2024"
                                ],
                                "sources": 11
                        },
                        "hyperscale": {
                                "n": 29,
                                "unit": "MW",
                                "p10": 25,
                                "p25": 50,
                                "p50": 80,
                                "p75": 250,
                                "p90": 500,
                                "companies": [
                                        "Google",
                                        "Google Report 2024",
                                        "Google Report 2025",
                                        "Microsoft"
                                ],
                                "sources": 4
                        },
                        "pm": {
                                "n": 53,
                                "unit": "MW",
                                "p10": 30,
                                "p25": 58,
                                "p50": 314,
                                "p75": 624,
                                "p90": 835,
                                "companies": [
                                        "Dominion 2024 IRP",
                                        "EIAR CyrusOne Grid",
                                        "EIAR Google Dublin DC3",
                                        "EIAR Vantage DUB11",
                                        "NeutraDC Batam"
                                ],
                                "sources": 5
                        },
                        "research": {
                                "n": 67,
                                "unit": "MW",
                                "p10": 42,
                                "p25": 115,
                                "p50": 320,
                                "p75": 600,
                                "p90": 800,
                                "companies": [
                                        "DOE Powering AI",
                                        "IEA Electricity 2025",
                                        "IEA Energy AI 2025",
                                        "IMDA Green DC Roadmap",
                                        "LBNL DC 2016",
                                        "LBNL DC Water 2021"
                                ],
                                "sources": 6
                        }
                },
                "construction_months": {
                        "pm": {
                                "n": 3,
                                "unit": "months",
                                "p10": 27,
                                "p25": 27,
                                "p50": 30,
                                "p75": 60,
                                "p90": 60,
                                "companies": [
                                        "EIAR Google Dublin DC3",
                                        "EIAR Vantage DUB11"
                                ],
                                "sources": 2
                        }
                },
                "energy_gwh": {
                        "finance": {
                                "n": 4,
                                "unit": "GWh",
                                "p10": 17,
                                "p25": 1240,
                                "p50": 7530,
                                "p75": 10644,
                                "p90": 10644,
                                "companies": [
                                        "DLR 10-K FY25",
                                        "YTL Power AR2024"
                                ],
                                "sources": 2
                        },
                        "pm": {
                                "n": 3,
                                "unit": "GWh",
                                "p10": 1306,
                                "p25": 1306,
                                "p50": 2500,
                                "p75": 3000,
                                "p90": 3000,
                                "companies": [
                                        "Dominion 2024 IRP"
                                ],
                                "sources": 1
                        },
                        "research": {
                                "n": 17,
                                "unit": "GWh",
                                "p10": 20,
                                "p25": 140,
                                "p50": 250,
                                "p75": 440,
                                "p90": 750,
                                "companies": [
                                        "IEA Electricity 2025",
                                        "IEA Energy AI 2025"
                                ],
                                "sources": 2
                        }
                },
                "investment_busd": {
                        "finance": {
                                "n": 122,
                                "unit": "$B",
                                "p10": 1.1,
                                "p25": 1.6,
                                "p50": 3.1,
                                "p75": 6.9,
                                "p90": 23.6,
                                "companies": [
                                        "DLR 10-K FY25",
                                        "DLR 1Q26 Release",
                                        "DigitalCore REIT Dec25",
                                        "Equinix 10-K FY25",
                                        "Equinix Q2-25 Deck",
                                        "IronMountain 10-K FY25",
                                        "IronMountain Q2-25 Deck",
                                        "KeppelDC AR2024",
                                        "NEXTDC FY24"
                                ],
                                "sources": 9
                        },
                        "hyperscale": {
                                "n": 3,
                                "unit": "$B",
                                "p10": 1,
                                "p25": 1,
                                "p50": 3.7,
                                "p75": 16,
                                "p90": 16,
                                "companies": [
                                        "Google Report 2024",
                                        "Google Report 2025"
                                ],
                                "sources": 2
                        },
                        "pm": {
                                "n": 6,
                                "unit": "$B",
                                "p10": 1.5,
                                "p25": 2.5,
                                "p50": 5,
                                "p75": 6.5,
                                "p90": 7,
                                "companies": [
                                        "Dominion 2024 IRP",
                                        "WHEDA Colo RFP"
                                ],
                                "sources": 2
                        },
                        "research": {
                                "n": 3,
                                "unit": "$B",
                                "p10": 2,
                                "p25": 2,
                                "p50": 4.5,
                                "p75": 16,
                                "p90": 16,
                                "companies": [
                                        "IEA Energy AI 2025",
                                        "LBNL DC 2024"
                                ],
                                "sources": 2
                        }
                },
                "pue": {
                        "hyperscale": {
                                "n": 30,
                                "unit": "ratio",
                                "p10": 1.07,
                                "p25": 1.09,
                                "p50": 1.12,
                                "p75": 1.16,
                                "p90": 2,
                                "companies": [
                                        "Google Report 2024",
                                        "Google Report 2025"
                                ],
                                "sources": 2
                        },
                        "research": {
                                "n": 17,
                                "unit": "ratio",
                                "p10": 1.034,
                                "p25": 1.1,
                                "p50": 1.15,
                                "p75": 1.5,
                                "p90": 1.56,
                                "companies": [
                                        "IEA Electricity 2025",
                                        "IEA Energy AI 2025",
                                        "IMDA Green DC Roadmap",
                                        "LBNL DC 2024",
                                        "LBNL DC Water 2021",
                                        "NREL Thermosyphon",
                                        "Uptime Survey 2024"
                                ],
                                "sources": 7
                        },
                        "spec": {
                                "n": 22,
                                "unit": "ratio",
                                "p10": 1.05,
                                "p25": 1.13,
                                "p50": 1.95,
                                "p75": 2.25,
                                "p90": 2.43,
                                "companies": [
                                        "ASHRAE Liquid 2021",
                                        "GreenGrid PUE WP49",
                                        "GreenGrid WUE WP35"
                                ],
                                "sources": 3
                        }
                },
                "rack_density_kw": {
                        "research": {
                                "n": 6,
                                "unit": "kW/rack",
                                "p10": 7,
                                "p25": 8.4,
                                "p50": 20,
                                "p75": 50,
                                "p90": 100,
                                "companies": [
                                        "IMDA Green DC Roadmap",
                                        "Uptime Survey 2024"
                                ],
                                "sources": 2
                        }
                },
                "rack_power_kw": {
                        "research": {
                                "n": 3,
                                "unit": "kW/rack",
                                "p10": 20,
                                "p25": 20,
                                "p50": 50,
                                "p75": 100,
                                "p90": 100,
                                "companies": [
                                        "IMDA Green DC Roadmap",
                                        "Uptime Survey 2024"
                                ],
                                "sources": 2
                        }
                },
                "renewable_share": {
                        "finance": {
                                "n": 4,
                                "unit": "%",
                                "p10": 91,
                                "p25": 100,
                                "p50": 100,
                                "p75": 100,
                                "p90": 100,
                                "companies": [
                                        "DigitalCore REIT Dec25",
                                        "Equinix 10-K FY25",
                                        "IronMountain 10-K FY25"
                                ],
                                "sources": 3
                        },
                        "hyperscale": {
                                "n": 19,
                                "unit": "%",
                                "p10": 34,
                                "p25": 50,
                                "p50": 100,
                                "p75": 100,
                                "p90": 100,
                                "companies": [
                                        "AWS",
                                        "Google",
                                        "Google Report 2024",
                                        "Google Report 2025",
                                        "Microsoft"
                                ],
                                "sources": 5
                        },
                        "pm": {
                                "n": 6,
                                "unit": "%",
                                "p10": 15,
                                "p25": 27,
                                "p50": 70,
                                "p75": 80,
                                "p90": 100,
                                "companies": [
                                        "EIAR CyrusOne Grid",
                                        "EIAR Google Dublin DC3"
                                ],
                                "sources": 2
                        },
                        "research": {
                                "n": 73,
                                "unit": "%",
                                "p10": 6,
                                "p25": 14,
                                "p50": 36,
                                "p75": 60,
                                "p90": 96,
                                "companies": [
                                        "IEA Electricity 2025",
                                        "IEA Energy AI 2025",
                                        "Uptime Institute"
                                ],
                                "sources": 3
                        }
                },
                "water_million_gal": {
                        "hyperscale": {
                                "n": 5,
                                "unit": "Mgal",
                                "p10": 1.3,
                                "p25": 2,
                                "p50": 19,
                                "p75": 150,
                                "p90": 150,
                                "companies": [
                                        "Google Report 2024",
                                        "Google Report 2025"
                                ],
                                "sources": 2
                        }
                },
                "wue": {
                        "research": {
                                "n": 13,
                                "unit": "L/kWh",
                                "p10": 0.2,
                                "p25": 0.36,
                                "p50": 0.45,
                                "p75": 2,
                                "p90": 4.5,
                                "companies": [
                                        "IEA Energy AI 2025",
                                        "IMDA Green DC Roadmap",
                                        "LBNL DC 2024",
                                        "NREL Thermosyphon"
                                ],
                                "sources": 4
                        }
                }
        },
        /* @@CORPUS_END */

        /* @@CALIB_START — MODEL CALIBRATION SPEC (Arc-1, 2026-07-20).
         * Single source for BOTH the DCMOC "Model Calibration" section and the
         * tools/test-model-calibration.mjs gate. Bands reference LIVE corpus
         * percentiles (resolved at read time), never frozen numbers — corpus
         * regen shifts the band, drift becomes a REPORTED finding, bands are
         * never silently loosened. Honest scope: AGGREGATE validation only;
         * per-project calibration is NOT possible (corpus facts are not stored
         * as per-document pairs). */
        calibrationSpec: {
            mappings: [
                {
                    id: 'pue.design.vs.fleet',
                    severity: 'fail',
                    engineRef: 'DATA.pueMatrix (design-basis, Uptime Survey 2026)',
                    corpusMetric: 'pue',
                    /* Guard band: each cooling-class tier-3 design PUE must sit inside
                     * [p10 of pooled hyperscale∪research fleet, p90 of pooled ∪ spec].
                     * Sharp rule: best design (liquid tier4) must be ≤ hyperscale fleet
                     * MEDIAN (best-in-class fleet cannot be beaten by a screening design). */
                    rule: { kind: 'pueBand', pooledLow: ['hyperscale', 'research'], pooledHigh: ['hyperscale', 'research', 'spec'], bestDesign: { cooling: 'liquid', tier: 'tier4', mustBeAtOrBelow: { segment: 'hyperscale', pctile: 'p50' } } },
                    basisNote: 'Design-basis vs fleet-trailing: gap 5-15% EXPECTED (design margin); band = fleet distribution guard, bukan klaim akurasi titik.',
                    limitation: 'Corpus PUE campuran fleet/design; ~40-50 dari 69 fakta ber-tag cooling; hyperscale segment didominasi fleet Google (best-in-class).'
                },
                {
                    id: 'capex.aggregate.ratio',
                    severity: 'fail',
                    engineRef: 'DATA.capexPerMw.liquidCooledTier3 (raw-build, T&T/JLL/C&W 2026)',
                    corpusMetric: 'investment_busd',
                    /* corpus_p50($/MW total-project) / engine raw-build $/MW must be in
                     * [1.0, 4.0] per segment with n>=5 investment facts (total project =
                     * land + IT + contingency + build ≈ 1-4x raw build). */
                    rule: { kind: 'capexRatio', segments: ['finance', 'pm'], nFloor: 5, ratioLow: 1.0, ratioHigh: 4.0, engineKey: 'liquidCooledTier3' },
                    basisNote: 'AACE Class-4 ±30% adalah band estimasi engine — DI SINI hanya catatan basis, bukan kriteria; kriteria = rasio scope total-project/raw-build.',
                    limitation: 'Fakta investment & capacity TIDAK berpasangan per dokumen — rasio dihitung dari p50 masing-masing (agregat, bukan per-proyek).'
                },
                {
                    id: 'wue.binned',
                    severity: 'warn',
                    engineRef: 'DATA.waterFootprint.wueBase (ASHRAE screening)',
                    corpusMetric: 'wue',
                    /* n kecil (12) → indicative only: evaporative engine (1.8) harus di
                     * [p50, p90] corpus; low-water types (<=0.1) harus <= p25. */
                    rule: { kind: 'wueBins', highType: 'evaporative', highBand: ['p50', 'p90'], lowTypes: ['aircooled', 'dlc', 'immersion'], lowCeilPctile: 'p25', segment: 'research' },
                    basisNote: 'Binned high(>1.0 L/kWh) vs low(<0.2) — order-of-magnitude sanity, bukan kalibrasi per tipe.',
                    limitation: 'n=12, mayoritas tanpa tag cooling; iklim tidak terstratifikasi.'
                },
                {
                    id: 'energy.capacity.coherence',
                    severity: 'warn',
                    engineRef: 'implied capacity factor = energy_gwh / (capacity_mw × 8.76)',
                    corpusMetric: 'energy_gwh',
                    /* Downgrade jujur dari rencana "fleet-PUE inferens": tanpa energi IT
                     * per dokumen, PUE tidak dapat diinferensikan sahih. Yang bisa: sanity
                     * capacity factor tersirat per segment ∈ (2%, 100%). */
                    rule: { kind: 'capacityFactor', segments: ['research'], cfLow: 0.02, cfHigh: 1.0 },
                    basisNote: 'Disclosure mencampur kapasitas pipeline vs energi operasi — CF rendah wajar.',
                    limitation: 'Fakta energi & kapasitas dari dokumen berbeda; murni koherensi orde besaran.'
                }
            ],
            notMappable: [
                { metric: 'renewable_share', reason: 'Scope beda: corpus mencampur PPA off-site vs on-site; engine screening on-site only.' },
                { metric: 'staffing', reason: 'Tidak ada fakta korpus FTE/labor cost.' },
                { metric: 'availability/uptime', reason: 'Tidak ada fakta empiris downtime; tierAvailability = definisi standar Uptime, bukan pengukuran.' },
                { metric: 'capex per-project', reason: 'Fakta investment & MW tidak berpasangan per dokumen — hanya validasi agregat yang jujur.' }
            ]
        },

        /* ── A1: operations-maturity assessment (promoted from article-1). ── */
        opsMaturity: {
            dimensions: [
                { id: 'doc',        label: 'Documentation', weight: 0.10, impact: 1.0 },
                { id: 'train',      label: 'Training',      weight: 0.15, impact: 1.2 },
                { id: 'change',     label: 'Change Mgmt',   weight: 0.15, impact: 1.3 },
                { id: 'monitor',    label: 'Monitoring',    weight: 0.15, impact: 1.1 },
                { id: 'maint',      label: 'Maintenance',   weight: 0.15, impact: 1.2 },
                { id: 'emergency',  label: 'Emergency',     weight: 0.10, impact: 1.4 },
                { id: 'improve',    label: 'Improvement',   weight: 0.10, impact: 1.0 },
                { id: 'leadership', label: 'Leadership',    weight: 0.10, impact: 1.5 }
            ],
            levels: [
                { max: 20,  label: 'Reactive',   level: 1 },
                { max: 40,  label: 'Preventive', level: 2 },
                { max: 60,  label: 'Predictive', level: 3 },
                { max: 80,  label: 'Proactive',  level: 4 },
                { max: 100, label: 'Generative', level: 5 }
            ],
            risk: { baseOutagesPerYr: 2.5, avgOutageCostUsd: 200000, maturityDivisor: 120, minFactor: 0.05 }
        },

        /* ── A2: alarm-management (ISA-18.2 / EEMUA-191) screening (article-2). ── */
        alarmMgmt: {
            isaTargetPer10Min: 1.0,            // ISA-18.2 target avg alarm rate
            floodThresholdPer10Min: 10,        // ISA flood definition ≥10 alarms/10 min
            windowsPerHour: 6,
            cognitiveKneeUtil: 0.7,            // degradation onset (utilization)
            cognitiveDecayK: 3,
            scoreWeights: { rate: 0.5, flood: 0.3, actionable: 0.2 },
            complianceBands: {
                rate:       [ { max: 1, pts: 25 }, { max: 2, pts: 15 }, { max: 5, pts: 5 } ],
                actionable: [ { min: 0.85, pts: 25 }, { min: 0.6, pts: 15 } ],
                critical:   [ { max: 0.05, pts: 25 }, { max: 0.1, pts: 15 }, { max: 0.2, pts: 5 } ],
                standing:   [ { max: 0.1, pts: 25 }, { max: 0.3, pts: 15 } ]
            }
        },

        /* ── A3: maintenance-compliance capacity model (article-3). ── */
        maintCompliance: {
            frictionFactor: { High: 0.55, Medium: 0.70, Low: 0.85 },       // productive-time share by ops friction
            cmmsMult: { 1: 0.70, 2: 0.80, 3: 0.90, 4: 0.97, 5: 1.0 },     // CMMS maturity multiplier
            evidenceMult: { Unclear: 0.85, Adequate: 0.92, Excellent: 0.98 },
            durationCv: { Low: 0.10, Medium: 0.20, High: 0.35 },
            backlogWeight: { base: 0.3, perMonthAge: 0.02, cap: 0.5 }
        },

        /* ── A7: reliability-vs-resilience assessment (article-7). ── */
        resilience: {
            reliabilityMap: { 'N': 35, 'N+1': 55, '2N': 75, '2N+1': 95 },   // design-redundancy score
            maps: {
                drill:    { 'Never': 0, 'Annual': 40, 'Quarterly': 70, 'Monthly': 100 },
                recovery: { 'None': 0, 'Documented': 30, 'Tested Annually': 60, 'Tested Quarterly': 100 },
                doc:      { 'Outdated >2yr': 0, 'Outdated 1-2yr': 30, 'Current <1yr': 70, 'Real-time updated': 100 },
                comm:     { 'None': 0, 'Basic': 30, 'Detailed': 60, 'Tested & Drilled': 100 },
                lessons:  { 'None': 0, 'Ad-hoc': 25, 'Structured': 65, 'Integrated into design': 100 }
            },
            /* drill / response / recovery / cross-train / doc / comm / lessons */
            weights: [0.15, 0.20, 0.15, 0.10, 0.15, 0.10, 0.15],
            responseTargetMin: 60,                                          // response score = (1 - min/60)
            gapBands: { critical: 30, warning: 15 }
        },

        /* ── A8: safety-culture health index (article-8). ── */
        safetyCulture: {
            /* near-miss / weak-signals / audit / training / walkarounds / hazard / meetings */
            weights: [0.15, 0.15, 0.10, 0.15, 0.10, 0.20, 0.15],
            norms: { nearMissPerMonth: 10, weakSignalsPerMonth: 15, auditFindingsMax: 30, trainingHrsPerQuarter: 20, walksPerMonth: 8 },
            meetingMap: { 'None': 0, 'Monthly': 40, 'Bi-weekly': 70, 'Weekly': 100 },
            drift: { shortDays: 180, shortScore: 50, longDays: 365, longScore: 70, cap: 0.99 }
        },

        /* ── A9: HVAC cooling-architecture TCO (article-9). ── */
        hvacCooling: {
            simplePue: { traditional: 1.67, hybrid: 1.35, dlc: 1.15 },      // quick PUE-cost comparison
            regions: {
                indonesia: { pueTraditional: 1.75, pueHybrid: 1.45, pueDLC: 1.25, co2Factor: 0.78, waterFactor: 1.15, freeHours: 600,  label: 'Indonesia (Tropical)' },
                singapore: { pueTraditional: 1.72, pueHybrid: 1.42, pueDLC: 1.22, co2Factor: 0.41, waterFactor: 1.10, freeHours: 500,  label: 'Singapore (Tropical)' },
                india:     { pueTraditional: 1.70, pueHybrid: 1.38, pueDLC: 1.20, co2Factor: 0.82, waterFactor: 1.30, freeHours: 2200, label: 'India (Mixed)' },
                uae:       { pueTraditional: 1.80, pueHybrid: 1.50, pueDLC: 1.30, co2Factor: 0.58, waterFactor: 1.60, freeHours: 800,  label: 'UAE (Hot-Arid)' },
                virginia:  { pueTraditional: 1.55, pueHybrid: 1.28, pueDLC: 1.12, co2Factor: 0.39, waterFactor: 0.85, freeHours: 5500, label: 'Virginia, USA' },
                frankfurt: { pueTraditional: 1.50, pueHybrid: 1.25, pueDLC: 1.10, co2Factor: 0.35, waterFactor: 0.75, freeHours: 6200, label: 'Frankfurt, Germany' },
                stockholm: { pueTraditional: 1.35, pueHybrid: 1.15, pueDLC: 1.05, co2Factor: 0.01, waterFactor: 0.60, freeHours: 7800, label: 'Stockholm, Sweden' },
                ireland:   { pueTraditional: 1.40, pueHybrid: 1.20, pueDLC: 1.08, co2Factor: 0.30, waterFactor: 0.70, freeHours: 7000, label: 'Ireland (Maritime)' }
            },
            configs: {
                traditional: { capexPerMW: 800000,  opexFactor: 1.0,  maintenancePerMW: 50000, pueKey: 'pueTraditional' },
                hybrid:      { capexPerMW: 1100000, opexFactor: 0.75, maintenancePerMW: 65000, pueKey: 'pueHybrid' },
                dlc:         { capexPerMW: 1400000, opexFactor: 0.55, maintenancePerMW: 80000, pueKey: 'pueDLC' }
            },
            discountRate: 0.08, tcoYears: 10,
            coolingEnergyFactor: { dlc: 0.55, hybrid: 0.75 },               // residual cooling kWh share
            waterGalPerKwh: { evaporative: 1.8, dlc: 0.2 },
            retrainPerMwUsd: 25000, phasedOverheadPct: 0.12,
            downtimeHrPerMw: { phased: 4.5, full: 12 },
            irrApproxFactor: 0.85
        },

        /* ── A10: SEA water-stress cost model (article-10). ── */
        waterStress: {
            regions: {
                jakarta:     { name: 'Jakarta/Bekasi', stressScore: 4.8, waterPrice: 1.20, riskScore: 92, aquiferDrop: 25, regSeverity: 88, altSource: 15, climateProjection: 5.2, communityIdx: 85, rainfall: 1800 },
                singapore:   { name: 'Singapore',      stressScore: 3.8, waterPrice: 2.80, riskScore: 65, aquiferDrop: 0,  regSeverity: 72, altSource: 70, climateProjection: 4.2, communityIdx: 30, rainfall: 2340 },
                johor:       { name: 'Johor Bahru',    stressScore: 1.5, waterPrice: 0.80, riskScore: 25, aquiferDrop: 3,  regSeverity: 25, altSource: 65, climateProjection: 1.8, communityIdx: 20, rainfall: 2200 },
                hanoi:       { name: 'Hanoi',          stressScore: 2.2, waterPrice: 0.55, riskScore: 40, aquiferDrop: 8,  regSeverity: 35, altSource: 55, climateProjection: 2.8, communityIdx: 35, rainfall: 1680 },
                danang:      { name: 'Da Nang',        stressScore: 1.0, waterPrice: 0.45, riskScore: 18, aquiferDrop: 2,  regSeverity: 18, altSource: 72, climateProjection: 1.4, communityIdx: 15, rainfall: 2500 },
                bangkok:     { name: 'Bangkok',        stressScore: 2.8, waterPrice: 0.90, riskScore: 55, aquiferDrop: 12, regSeverity: 52, altSource: 40, climateProjection: 3.5, communityIdx: 45, rainfall: 1500 },
                manila:      { name: 'Manila',         stressScore: 3.5, waterPrice: 1.10, riskScore: 72, aquiferDrop: 18, regSeverity: 65, altSource: 28, climateProjection: 4.0, communityIdx: 68, rainfall: 1800 },
                kualalumpur: { name: 'Kuala Lumpur',   stressScore: 2.0, waterPrice: 0.70, riskScore: 35, aquiferDrop: 5,  regSeverity: 30, altSource: 58, climateProjection: 2.3, communityIdx: 25, rainfall: 2400 }
            },
            escalation: 0.03, discountRate: 0.08, tcoYears: 10,
            industryAvgWue: 1.1, targetWue: 0.5,
            dlcWueFactor: 0.13, hybridWueFactor: 0.565,                     // WUE retained vs evaporative
            riskPremiumBands: [ { min: 80, pct: 22 }, { min: 60, pct: 14 }, { min: 40, pct: 8 }, { min: 0, pct: 3 } ],
            recycle: { capexPerMw: 450000, savingFraction: 0.4 },
            nexus: { baseKwhPerMl: 650, perStressScore: 80 }
        },

        /* ── A12: DC economic/community value model (article-12). ── */
        dcValue: {
            countries: {
                indonesia:      { name: 'Indonesia',        electricityRate: 0.072, carbonIntensity: 610, capexMultiplier: 0.85, jobMultiplier: 1.3,  taxRate: 0.12,  ppaPrice: 380000, gridCapacityGW: 70 },
                malaysia:       { name: 'Malaysia',         electricityRate: 0.097, carbonIntensity: 580, capexMultiplier: 0.9,  jobMultiplier: 1.2,  taxRate: 0.15,  ppaPrice: 400000, gridCapacityGW: 35 },
                singapore:      { name: 'Singapore',        electricityRate: 0.18,  carbonIntensity: 400, capexMultiplier: 1.3,  jobMultiplier: 0.8,  taxRate: 0.17,  ppaPrice: 550000, gridCapacityGW: 14 },
                thailand:       { name: 'Thailand',         electricityRate: 0.11,  carbonIntensity: 500, capexMultiplier: 0.88, jobMultiplier: 1.15, taxRate: 0.13,  ppaPrice: 390000, gridCapacityGW: 50 },
                vietnam:        { name: 'Vietnam',          electricityRate: 0.084, carbonIntensity: 550, capexMultiplier: 0.82, jobMultiplier: 1.4,  taxRate: 0.10,  ppaPrice: 360000, gridCapacityGW: 80 },
                philippines:    { name: 'Philippines',      electricityRate: 0.18,  carbonIntensity: 620, capexMultiplier: 0.95, jobMultiplier: 1.25, taxRate: 0.14,  ppaPrice: 420000, gridCapacityGW: 25 },
                us_virginia:    { name: 'US - Virginia',    electricityRate: 0.065, carbonIntensity: 350, capexMultiplier: 1.0,  jobMultiplier: 1.0,  taxRate: 0.21,  ppaPrice: 450000, gridCapacityGW: 180 },
                us_texas:       { name: 'US - Texas',       electricityRate: 0.055, carbonIntensity: 420, capexMultiplier: 0.95, jobMultiplier: 1.05, taxRate: 0.18,  ppaPrice: 400000, gridCapacityGW: 85 },
                eu_ireland:     { name: 'EU - Ireland',     electricityRate: 0.22,  carbonIntensity: 320, capexMultiplier: 1.15, jobMultiplier: 0.9,  taxRate: 0.125, ppaPrice: 500000, gridCapacityGW: 11 },
                eu_netherlands: { name: 'EU - Netherlands', electricityRate: 0.20,  carbonIntensity: 380, capexMultiplier: 1.2,  jobMultiplier: 0.85, taxRate: 0.25,  ppaPrice: 520000, gridCapacityGW: 31 }
            },
            dcTypes: {
                hyperscale: { capexPerMW: 12000000, jobsPerMW: 1.5, pueRange: [1.1, 1.25] },
                colocation: { capexPerMW: 10000000, jobsPerMW: 2.0, pueRange: [1.3, 1.5] },
                enterprise: { capexPerMW: 15000000, jobsPerMW: 2.5, pueRange: [1.5, 1.8] },
                ai_hpc:     { capexPerMW: 18000000, jobsPerMW: 1.8, pueRange: [1.15, 1.3] }
            },
            opexPctOfCapex: 0.07, indirectJobsMult: 4.3,                    // IMPLAN multiplier
            indirectImpactMult: 1.5, inducedImpactMult: 0.75,
            overbuild: { cfe247: 1.5, annual: 1.2 }, ppaYears: 20,
            gridSurplusPerMwYr: 33500,                                      // E3 methodology
            drValuePerMwYr: 50000, drCapacityPct: { full: 0.15, partial: 0.075, none: 0 },
            residentialLoadFactor: 0.35, loadFactorValuePerMwh: 0.003,
            industryAvgPUE: 1.56, treeKgCo2PerYr: 22
        },

        /* ── A14: community cost/benefit impact model (article-14). ── */
        communityImpact: {
            regions: {
                virginia:  { name: 'Virginia, USA',    eRate: 0.12, waterStress: 1.0, taxRate: 0.048, carbonKg: 350, avgBill: 145, gridGW: 90, capexM: 1.0,  jobM: 1.0,  householdWaterL: 450 },
                georgia:   { name: 'Georgia, USA',     eRate: 0.11, waterStress: 0.8, taxRate: 0.040, carbonKg: 400, avgBill: 130, gridGW: 50, capexM: 0.9,  jobM: 0.95, householdWaterL: 500 },
                texas:     { name: 'Texas, USA',       eRate: 0.10, waterStress: 1.3, taxRate: 0.035, carbonKg: 380, avgBill: 140, gridGW: 85, capexM: 0.85, jobM: 0.9,  householdWaterL: 550 },
                ireland:   { name: 'Ireland, EU',      eRate: 0.22, waterStress: 0.3, taxRate: 0.050, carbonKg: 300, avgBill: 180, gridGW: 12, capexM: 1.3,  jobM: 1.1,  householdWaterL: 400 },
                malaysia:  { name: 'Malaysia (Johor)', eRate: 0.08, waterStress: 1.8, taxRate: 0.025, carbonKg: 550, avgBill: 45,  gridGW: 35, capexM: 0.75, jobM: 0.8,  householdWaterL: 350 },
                indonesia: { name: 'Indonesia',        eRate: 0.07, waterStress: 1.2, taxRate: 0.020, carbonKg: 650, avgBill: 35,  gridGW: 70, capexM: 0.70, jobM: 0.75, householdWaterL: 300 },
                thailand:  { name: 'Thailand',         eRate: 0.09, waterStress: 0.9, taxRate: 0.030, carbonKg: 450, avgBill: 50,  gridGW: 50, capexM: 0.80, jobM: 0.85, householdWaterL: 380 },
                singapore: { name: 'Singapore',        eRate: 0.18, waterStress: 2.0, taxRate: 0.060, carbonKg: 400, avgBill: 120, gridGW: 14, capexM: 1.50, jobM: 1.2,  householdWaterL: 370 }
            },
            coolingWaterMlPerMwYr: { evaporative: 26, hybrid: 13, aircooled: 0.5, liquid: 3 },
            coolingNoiseDb: { evaporative: 65, hybrid: 58, aircooled: 60, liquid: 50 },
            genNoxKgPerHr: { battery: 0, hvo: 0.5, diesel: 4.5, diesel_heavy: 12 },   // per 2 MW generator (EPA AP-42)
            genHoursYear: { battery: 0, hvo: 50, diesel: 100, diesel_heavy: 500 },
            taxRetain: { none: 1.0, moderate: 0.6, aggressive: 0.3, extreme: 0.05 },
            rateProtect: { full: 0.05, gs5: 0.25, standard: 0.65, none: 1.0 },
            waterStrategy: { netpositive: 0.1, recycled: 0.4, standard: 1.0, none: 1.2 },
            wasteHeatValPerMw: { district: 85000, industrial: 45000, partial: 20000, none: 0 },
            cbaFactor: { comprehensive: 30, basic: 10, none: -25 },
            noiseMitigationDb: { comprehensive: 10, basic: 4, none: 0 },
            constJobsPerMW: 35, permJobsPerMW: 1.2, healthCostPerTonNox: 15385,
            capexPerMwUsd: 12000000, utilization: 0.85, jobsMultiplier: 2.5,
            renewOverbuild: 1.3, renewCapFactor: 0.30, gdpPerMwUsd: 800000, genUnitMw: 2
        },

        /* ── A15: ops budget + staffing resilience model (article-15). ── */
        opsBudget: {
            countries: {
                'Indonesia':      { laborRate: 18000, energyRate: 0.085, fxToUSD: 0.000063, tropFactor: 1.12, laborIdx: 0.35 },
                'Singapore':      { laborRate: 72000, energyRate: 0.168, fxToUSD: 0.74,     tropFactor: 1.10, laborIdx: 1.05 },
                'Malaysia':       { laborRate: 48000, energyRate: 0.082, fxToUSD: 0.22,     tropFactor: 1.11, laborIdx: 0.45 },
                'Thailand':       { laborRate: 36000, energyRate: 0.098, fxToUSD: 0.028,    tropFactor: 1.10, laborIdx: 0.42 },
                'Vietnam':        { laborRate: 15000, energyRate: 0.078, fxToUSD: 0.000040, tropFactor: 1.13, laborIdx: 0.30 },
                'Philippines':    { laborRate: 22000, energyRate: 0.142, fxToUSD: 0.018,    tropFactor: 1.14, laborIdx: 0.38 },
                'India':          { laborRate: 24000, energyRate: 0.075, fxToUSD: 0.012,    tropFactor: 1.08, laborIdx: 0.32 },
                'Japan':          { laborRate: 82000, energyRate: 0.210, fxToUSD: 0.0067,   tropFactor: 1.00, laborIdx: 1.10 },
                'Australia':      { laborRate: 88000, energyRate: 0.185, fxToUSD: 0.65,     tropFactor: 1.05, laborIdx: 1.15 },
                'US-Virginia':    { laborRate: 95000, energyRate: 0.068, fxToUSD: 1.00,     tropFactor: 1.00, laborIdx: 1.00 },
                'US-Texas':       { laborRate: 88000, energyRate: 0.058, fxToUSD: 1.00,     tropFactor: 1.06, laborIdx: 0.95 },
                'US-Oregon':      { laborRate: 90000, energyRate: 0.042, fxToUSD: 1.00,     tropFactor: 1.00, laborIdx: 0.98 },
                'EU-Germany':     { laborRate: 78000, energyRate: 0.235, fxToUSD: 1.08,     tropFactor: 1.00, laborIdx: 1.12 },
                'EU-Netherlands': { laborRate: 75000, energyRate: 0.195, fxToUSD: 1.08,     tropFactor: 1.00, laborIdx: 1.08 },
                'EU-Ireland':     { laborRate: 70000, energyRate: 0.178, fxToUSD: 1.08,     tropFactor: 0.95, laborIdx: 1.02 },
                'UK':             { laborRate: 72000, energyRate: 0.215, fxToUSD: 1.26,     tropFactor: 0.96, laborIdx: 1.06 },
                'UAE':            { laborRate: 65000, energyRate: 0.082, fxToUSD: 0.27,     tropFactor: 1.15, laborIdx: 0.75 },
                'Saudi-Arabia':   { laborRate: 60000, energyRate: 0.048, fxToUSD: 0.27,     tropFactor: 1.18, laborIdx: 0.70 },
                'Brazil':         { laborRate: 32000, energyRate: 0.110, fxToUSD: 0.18,     tropFactor: 1.09, laborIdx: 0.40 },
                'Chile':          { laborRate: 28000, energyRate: 0.095, fxToUSD: 0.0011,   tropFactor: 1.00, laborIdx: 0.42 }
            },
            staffModels: {
                inhouse:    { label: 'Full In-House',  costMult: 1.00, qualityMult: 1.00, retentionMod: 0,   ftePerMW: 4.2 },
                hybrid70:   { label: 'Hybrid 70/30',   costMult: 0.88, qualityMult: 0.95, retentionMod: -3,  ftePerMW: 3.8 },
                hybrid50:   { label: 'Hybrid 50/50',   costMult: 0.78, qualityMult: 0.88, retentionMod: -6,  ftePerMW: 3.5 },
                outsourced: { label: 'Full Outsourced', costMult: 0.65, qualityMult: 0.80, retentionMod: -12, ftePerMW: 3.0 }
            },
            shiftMult: 4.2, laborBurden: 1.35, maintPerMwUsd: 180000,
            pmSavingsSlope: 0.30, pmBaseline: 0.50, maintCapexShare: 0.15, ffoFactor: 0.12,
            cashVariance: { basePct: 3.5, reductionSlope: 4.0, floorPct: 0.5 },
            utilization: { base: 78, perLoadMw: 0.12, min: 55, max: 98 },
            burnout: { k: 0.12, midUtil: 88 },
            outsourcedCostFactor: 0.65, mgmtOverheadPerFteUsd: 25000,
            replacementCostFactor: 1.5, spof: { base: 8, perHeadcount: 0.08, retentionDiv: 40 },
            sriWeights: { retention: 0.35, burnout: 0.25, pm: 0.20, quality: 0.20, spofPenalty: 3 },
            hepBase: 0.003
        },

        /* ── A16/A17: SEA DC market screening — bubble risk + opportunity (articles 16, 17). ── */
        dcMarket: {
            bubbleMarkets: {
                johor:       { op: 487,  pipe: 5800, pop: 3.8, absorb: 200, precommit: 0.40, spec: 0.35, growth: 0.19, cost: 9,   rev: 2.0, opex: 0.58, wacc: 0.10 },
                indonesia:   { op: 1717, pipe: 4145, pop: 280, absorb: 300, precommit: 0.55, spec: 0.25, growth: 0.15, cost: 8,   rev: 1.8, opex: 0.60, wacc: 0.10 },
                singapore:   { op: 780,  pipe: 900,  pop: 5.9, absorb: 150, precommit: 0.70, spec: 0.15, growth: 0.12, cost: 14,  rev: 3.0, opex: 0.55, wacc: 0.08 },
                thailand:    { op: 200,  pipe: 1092, pop: 72,  absorb: 120, precommit: 0.50, spec: 0.30, growth: 0.14, cost: 8.5, rev: 1.9, opex: 0.62, wacc: 0.11 },
                vietnam:     { op: 150,  pipe: 560,  pop: 100, absorb: 80,  precommit: 0.45, spec: 0.30, growth: 0.18, cost: 7,   rev: 1.6, opex: 0.65, wacc: 0.12 },
                philippines: { op: 100,  pipe: 500,  pop: 115, absorb: 50,  precommit: 0.35, spec: 0.40, growth: 0.12, cost: 9,   rev: 2.1, opex: 0.63, wacc: 0.12 }
            },
            opportunityMarkets: {
                indonesia:   { op: 1717, pipe: 4145, pop: 280, digi: 0.15, sov: 500, inf: 0.35, ent: 0.30, cost: 8,   rev: 1.8, opex: 0.60, wacc: 0.10 },
                johor:       { op: 487,  pipe: 5800, pop: 3.8, digi: 0.19, sov: 200, inf: 0.35, ent: 0.25, cost: 9,   rev: 2.0, opex: 0.58, wacc: 0.10 },
                singapore:   { op: 780,  pipe: 900,  pop: 5.9, digi: 0.12, sov: 150, inf: 0.30, ent: 0.40, cost: 14,  rev: 3.0, opex: 0.55, wacc: 0.08 },
                thailand:    { op: 200,  pipe: 1092, pop: 72,  digi: 0.14, sov: 400, inf: 0.35, ent: 0.25, cost: 8.5, rev: 1.9, opex: 0.62, wacc: 0.11 },
                vietnam:     { op: 150,  pipe: 560,  pop: 100, digi: 0.18, sov: 300, inf: 0.35, ent: 0.20, cost: 7,   rev: 1.6, opex: 0.65, wacc: 0.12 },
                philippines: { op: 100,  pipe: 500,  pop: 115, digi: 0.12, sov: 100, inf: 0.30, ent: 0.20, cost: 9,   rev: 2.1, opex: 0.63, wacc: 0.12 }
            },
            bubble: {
                supplyYears: 5, absorbWindowYears: 3, rampYears: 3, rampStartOcc: 0.30,
                vacancyShare: 0.6, vacancyScale: 50, vacancyMin: 5, vacancyMax: 60,
                occBase: 95, occSlope: 15, occMin: 40, breakevenSpecSlope: 15, npvYears: 10,
                riskCaps: { sd: 30, spec: 25, precommit: 20, absorb: 15, payback: 10 },
                riskSlopes: { sd: 15, spec: 50, precommit: 40, absorbYears: 3, absorbSlope: 3, paybackYears: 6, paybackSlope: 2 }
            },
            opportunity: {
                horizonYears: 4, digiCapture: 0.8, entCapture: 0.5, infBaseShare: 0.15,
                utilizationCap: 150, occFactor: 0.7, occMin: 0.50, occMax: 0.98,
                rampYears: 3, rampStartOcc: 0.40, npvYears: 10,
                facilityMw: 50, jobsConstructPerFacility: 1500, jobsPermPerFacility: 65, jobsEcoMult: 4, taxRevFactor: 0.025,
                scoreCaps: { util: 25, digi: 20, sov: 20, inf: 20, ent: 15 },
                scoreSlopes: { util: 0.2, digi: 100, sov: 50, inf: 40, ent: 30 }
            }
        },

        /* ── A22: AI interconnect physics/TCO — copper vs pluggable vs CPO (article-22). ── */
        interconnect: {
            speedFactor: { 200: 1, 400: 2.1, 800: 4.5, 1600: 9.5 },         // power scaling vs 200G
            copper:    { reachM: { 200: 3, 400: 2, 800: 1, 1600: 0 }, wattsBase: 0.5, latencyNsAtReach: 5, latencyUnviableNs: 999 },
            pluggable: { reachM: { 200: 2000, 400: 500, 800: 100, 1600: 2000 }, wattsBase: 3.5, efficiency: 0.65, latencyBaseNs: 50, latencyPerMNs: 0.005 },
            cpo:       { reachM: 100, wattsBase: 1.0, efficiency: 0.55, latencyBaseNs: 10, latencyPerMNs: 0.005 }
        },

        /* ── A25: grid reserve-margin adequacy screening (article-25, PJM basis). ── */
        gridReserve: {
            renewableShareOfNew: 0.70,                                      // new-gen mix assumption
            auctionCurve: [
                { minMargin: 20, base: 28,  pivot: 20, slope: 0 },
                { minMargin: 15, base: 28,  pivot: 20, slope: 10 },
                { minMargin: 10, base: 78,  pivot: 15, slope: 30 },
                { minMargin: 5,  base: 228, pivot: 10, slope: 50 },
                { minMargin: -Infinity, base: 478, pivot: 5, slope: 100 }
            ],
            baseline: { priceMwDay: 28, capacityGW: 180 },
            risk: { marginSlope: 8, deficitSlope: 5, retireCap: 30, wMargin: 0.5, wDeficit: 0.3, wRetire: 0.2 }
        },

        /* ── A20: facility water-footprint screening (promoted from the
         * article-20 Data-Center-Water calculator). ── */
        waterFootprint: {
            wueBase: { evaporative: 1.8, hybrid: 0.8, aircooled: 0.1, dlc: 0.05, immersion: 0.02 },   // L/kWh at temperate
            climateMult: { hotdry: 1.4, hothumid: 1.2, temperate: 1.0, cold: 0.6 },
            waterCostPerKgal: { municipal: 6.0, reclaimed: 3.5, river: 2.0, groundwell: 1.5 },        // $/1000 gal
            upstreamPowerLPerKwhFactor: 1.5,   // extra upstream water per non-renewable kWh (screening)
            householdLPerDay: 1135, cityHouseholds: 50000, olympicPoolL: 2500000, lPerGal: 3.785,
            benchmarksPerMwYr: [
                { name: 'Google (Avg)',    perMW: 690000000 / 900,  wue: 0.50 },
                { name: 'Microsoft (Avg)', perMW: 780000000 / 1100, wue: 0.70 },
                { name: 'Meta (Avg)',      perMW: 350000000 / 700,  wue: 0.40 },
                { name: 'AWS (Est.)',      perMW: 500000000 / 1000, wue: 0.60 },
                { name: 'Industry Avg',    perMW: 800000,           wue: 1.20 }
            ]
        },

        /* ── A11: residential grid/bill impact screening (promoted from
         * article-11 inline calculator — SEA citizen-bill model). ── */
        gridImpact: {
            baseYear: 2026,
            capacityFactor: 0.90,          // DC average utilization assumption
            annualGrowth: 0.15,            // IEA data-centre electricity growth
            passThroughShare: 0.40,        // infrastructure cost share allocated to residential (screening)
            countries: {
                indonesia:   { name: 'Indonesia',   currency: 'IDR', symbol: 'Rp', residentialTariff: 1153,   usdRate: 16000, avgHouseholdKwh: 111, nationalGridGW: 70, dcCapacity2024: 300,  growthMultiplier: 1.2 },
                malaysia:    { name: 'Malaysia',    currency: 'MYR', symbol: 'RM', residentialTariff: 0.3996, usdRate: 4.7,   avgHouseholdKwh: 648, nationalGridGW: 35, dcCapacity2024: 505,  growthMultiplier: 1.3 },
                singapore:   { name: 'Singapore',   currency: 'SGD', symbol: 'S$', residentialTariff: 0.33,   usdRate: 1.35,  avgHouseholdKwh: 400, nationalGridGW: 14, dcCapacity2024: 1000, growthMultiplier: 1.1 },
                thailand:    { name: 'Thailand',    currency: 'THB', symbol: '\u0e3f', residentialTariff: 3.99, usdRate: 36,  avgHouseholdKwh: 300, nationalGridGW: 50, dcCapacity2024: 250,  growthMultiplier: 1.25 },
                vietnam:     { name: 'Vietnam',     currency: 'VND', symbol: '\u20ab', residentialTariff: 2204, usdRate: 25000, avgHouseholdKwh: 150, nationalGridGW: 80, dcCapacity2024: 150, growthMultiplier: 1.4 },
                philippines: { name: 'Philippines', currency: 'PHP', symbol: '\u20b1', residentialTariff: 13.01, usdRate: 57, avgHouseholdKwh: 200, nationalGridGW: 25, dcCapacity2024: 120,  growthMultiplier: 1.2 }
            }
        },

        cdu: {
            /* Water thermophysical constants for coolant-flow sizing. */
            waterRho: 997, waterCp: 4.18, /* kg/m3, kJ/kg·K */
            cduUnitKw: 300, /* nominal rejected-heat per CDU rack unit */
            /* Operational bands from cdu-model.js (OCP / ASHRAE TC9.9). */
            bands: {
                supplyC:      { min: 17, max: 45 },
                deltaTK:      { min: 8,  max: 12 },
                flowLpmPerKw: { min: 1.0, max: 1.5 },
                dpBar:        { min: 0.5, max: 3.0 },
                dewMarginK:   { min: 2 },
                pipeVelMs:    { min: 1.5, max: 3.0 }
            },
            /* Pump sizing parameters (cdu-model.js). */
            pump: { pumpEff: 0.70, motorEff: 0.92, perPumpLpmDefault: 600 },
            /* Physical constants (cdu-model.js / Alduchov-Eskridge 2006). */
            phys: { absRoughnessMm: 0.045, barToPa: 100000, dewMagnusA: 17.625, dewMagnusB: 243.04 }
        },
        spares: {
            /* BSM rational approximation coefficients for inverse normal CDF.
             * Source: Beasley-Springer-Moro (1977). Used in newsvendor Q* calculation. */
            /* Acklam (2003) rational approximation to the inverse normal CDF —
             * |relative error| < 1.15e-9 over (0,1). Replaces the BSM (1977)
             * set (|e|<4.5e-4) in the M2b precision upgrade. */
            acklamA: [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
                       1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00],
            acklamB: [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
                       6.680131188771972e+01, -1.328068155288572e+01],
            acklamC: [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
                      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00],
            acklamD: [ 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
                       3.754408661907416e+00],
            acklamPLow: 0.02425,
            poissonThresholdMuLt: 5
        },
        /* v2.5.2 O&M pricing research (owner: "biaya kontrak per tier + harga spares
         * riil, no placeholder") — SCREENING bands from public 2024-2026 sources;
         * every band sourced in DATA.sources. USD. */
        /* v2.5.2 DG environmental costs (owner: "biaya air, waste management, carbon —
         * rate spesifik per negara"). Carbon = COMPLIANCE price per country where a
         * scheme exists (World Bank Carbon Pricing Dashboard / OECD ECR 2025 / national
         * sources, USD/tCO2e, screening snapshot 2025-26); countries without a scheme
         * fall back to a VOLUNTARY offset basis (labeled). Waste = screening bands. */
        envCosts: {
            carbonPriceUsdPerT: {
                /* EU ETS members (fixed-price trajectory ≈ USD 61 in 2025-26) */
                DE: 61, NL: 61, IE: 61, FR: 61, ES: 61, IT: 61, PT: 61, PL: 61, FI: 61, DK: 61,
                SE: 120,   /* national carbon tax above ETS */
                NO: 100, CH: 130, GB: 50,
                SG: 33,    /* S$45/tCO2e from 2026 (NCCS) */
                JP: 2, KR: 6.3, ID: 1.8 /* postponed scheme — indicative */, CN: 14, TW: 9.5,
                CA: 70 /* industrial OBPS */, NZ: 35, AU: 23 /* Safeguard credit basis */,
                MX: 3.5, CL: 5, CO: 5, ZA: 9,
                US: 0, IN: 0, TH: 0, VN: 0, PH: 0, MY: 0, AE: 0, SA: 0, QA: 0, OM: 0, BR: 0, NG: 0, KE: 0
            },
            voluntaryOffsetUsdPerT: 10,   /* screening basis where no compliance price */
            wasteMgmt: {
                generalUsdPerTonne: { developed: 120, emerging: 60 },   /* non-hazardous industrial disposal band */
                eWasteUsdPerKg: 1.0,                                     /* certified ITAD/recycling net cost */
                generalTonnesPerMwItYr: 2.0,                             /* packaging+consumables screening */
                eWasteKgPerMwItYr: 150                                   /* filters/PSU/board attrition, colo basis (IT refresh excluded) */
            },
            developedMarkets: ['US','CA','GB','DE','NL','IE','FR','SE','FI','DK','NO','CH','ES','IT','PT','PL','AU','NZ','JP','SG','KR','TW']
        },
        omContracts: {
            /* $/kW IT per YEAR, fixed-fee basis. Bands: low/mid/high. */
            tiers: {
                comprehensive: { low: 30, mid: 45, high: 60, scope: 'Full parts+labor+emergency response, OEM-grade SLA (all critical systems)' },
                preventive:    { low: 20, mid: 30, high: 40, scope: 'Scheduled PM visits + consumables; corrective billed separately' },
                onCall:        { low: 10, mid: 15, high: 20, scope: 'Time & materials on failure; no scheduled PM commitment' }
            },
            thirdPartyMultiplier: 0.65,   // third-party vs OEM contract (OEM typically 40-60% higher)
            agingFacilityMultiplier: 1.5, // facilities >10yr — parts + corrective escalation
            basis: 'Preventive $200-400K/yr per 10MW facility; OEM premium 40-60% over third-party'
        },
        sparesPricing: {
            /* Unit list-price bands per spare class (USD, screening — public list/retrofit prices). */
            classes: {
                ups_module_50kw:      { low: 25000, mid: 40000,  high: 60000,  unit: 'per 50kW power module' },
                ups_battery_string:   { low: 8000,  mid: 10000,  high: 15000,  unit: 'per VRLA string' },
                genset_pm_kit:        { low: 5000,  mid: 9000,   high: 15000,  unit: 'per 2-3MW unit annual parts kit' },
                genset_top_overhaul:  { low: 60000, mid: 100000, high: 150000, unit: 'per 2-3MW unit top-end overhaul' },
                chiller_compressor:   { low: 80000, mid: 150000, high: 250000, unit: 'per centrifugal compressor' },
                crah_ec_fan_kit:      { low: 8000,  mid: 15000,  high: 20000,  unit: 'per EC/VFD fan retrofit kit installed' },
                pdu_breaker_mccb:     { low: 1000,  mid: 2500,   high: 5000,   unit: 'per DC-grade MCCB breaker' },
                air_filter_set_g4:    { low: 1500,  mid: 2500,   high: 4000,   unit: 'per CRAH/PAC filter set-year' }
            }
        },
        decision: {
            /* Layer-13 planning benchmarks (descriptive, not advice). */
            tierAvailability: { 2: 99.741, 3: 99.982, 4: 99.995 },
            perKwBand: { 2: { lean: 7000, premium: 10000 }, 3: { lean: 10000, premium: 15000 }, 4: { lean: 15000, premium: 22000 } },
            pueTarget: { air: 1.5, inrow: 1.4, rdhx: 1.35, liquid: 1.2, immersion: 1.1 },
            disclaimer: 'Engineering feasibility guidance from a deterministic rule engine — not investment, legal, or professional advice. Validate against a full design review.'
        },
        /* v2.5.0 research pass — AACE International 18R-97 cost-estimate classes:
         * maturity (% project definition) → typical accuracy range. The engine's
         * detailed budgetary capex is a Class 4 estimate. */
        aace: {
            classes: {
                '5': { defLow: 0, defHigh: 2, low: -0.50, high: 1.00, label: 'Class 5 — Concept screening', method: 'capacity-factored / parametric' },
                '4': { defLow: 1, defHigh: 15, low: -0.30, high: 0.50, label: 'Class 4 — Study / feasibility', method: 'parametric / assembly' },
                '3': { defLow: 10, defHigh: 40, low: -0.20, high: 0.30, label: 'Class 3 — Budget authorization', method: 'semi-detailed / take-off' },
                '2': { defLow: 30, defHigh: 70, low: -0.15, high: 0.20, label: 'Class 2 — Control', method: 'detailed unit-cost' },
                '1': { defLow: 70, defHigh: 100, low: -0.10, high: 0.15, label: 'Class 1 — Check estimate / bid', method: 'detailed / firm quotes' }
            },
            engineClass: '4'
        },
        /* ══ v2.4.0 — DATA.asset: Asset Intelligence (Layer 9). Design lives by asset
         * class + health-index weights + status bands. Powers the asset digital
         * passport / health index. ══ */
        asset: {
            /* Typical design life (years) by asset class — manufacturer/ASHRAE service life. */
            designLifeYears: { ups: 12, battery: 8, generator: 25, crac: 15, chiller: 20, pdu: 20, switchgear: 25, transformer: 30, bms: 10, fireSuppression: 15 },
            /* v2.5.0 research pass — Weibull wear-out parameters by asset class:
             * shape β>1 = increasing hazard (wear-out); scale η ≈ characteristic
             * life (yr). F(t)=1-exp(-(t/η)^β). (Reliability engineering / IEEE 493
             * component-life distributions, manufacturer MTBF.) */
            weibull: {
                battery:    { shape: 2.5, scaleYears: 6 },
                ups:        { shape: 2.0, scaleYears: 13 },
                generator:  { shape: 1.8, scaleYears: 27 },
                crac:       { shape: 2.0, scaleYears: 16 },
                chiller:    { shape: 2.0, scaleYears: 22 },
                pdu:        { shape: 1.8, scaleYears: 22 },
                switchgear: { shape: 2.2, scaleYears: 28 },
                transformer:{ shape: 3.0, scaleYears: 35 },
                bms:        { shape: 1.6, scaleYears: 11 }
            },
            /* Health-index factor weights (sum = 1): remaining-life dominates, then
             * observed condition, then duty/criticality stress. */
            weights: { remainingLife: 0.5, condition: 0.35, duty: 0.15 },
            /* Health % → status band. */
            statusBands: [
                { min: 80, status: 'Healthy', label: 'Healthy' },
                { min: 60, status: 'Monitor', label: 'Monitor' },
                { min: 40, status: 'Plan', label: 'Plan replacement' },
                { min: 0,  status: 'Critical', label: 'Replace / high risk' }
            ],
            /* Lifecycle replacement: interval (years) + unit cost ($/kW IT) by
             * component (Group-2 promotion from DCMOC CapexEngine lifecycle). */
            lifecycle: {
                upsVrla:    { years: 5,  costPerKw: 120, label: 'UPS battery (VRLA)' },
                upsLiIon:   { years: 10, costPerKw: 180, label: 'UPS battery (Li-Ion)' },
                generator:  { years: 15, costPerKw: 350, label: 'Diesel generator' },
                crac:       { years: 12, costPerKw: 200, label: 'CRAC/CRAH' },
                fire:       { years: 10, costPerKw: 30,  label: 'Fire suppression' },
                pdu:        { years: 15, costPerKw: 80,  label: 'PDU/RPP' },
                bms:        { years: 7,  costPerKw: 40,  label: 'BMS/DCIM' }
            }
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
            milestones: { permitApproved: 'permit', groundbreak: 'civil', topOut: 'civil', powerOn: 'mep', rfs: 'commission' },
            /* v2.5.0 research pass — critical long-lead equipment procurement times
             * (weeks), 2024-26 market. These, not construction, are the dominant
             * schedule driver for AI-era builds. [typical, stressed] weeks. */
            longLeadWeeks: {
                transformer:     [60, 120], /* MV/HV power transformers — worst 2024-26 */
                switchgear:      [50, 80],  /* MV switchgear */
                generator:       [40, 70],  /* diesel/gas gensets */
                ups:             [30, 52],  /* modular UPS */
                chiller:         [30, 50],  /* water-cooled chillers */
                cdu:             [20, 40],  /* coolant distribution units */
                genset_paralleling: [40, 60]
            }
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
            },
            /* v2.5.0 research pass — max sustainable rack density by cooling type.
             * Air is physically limited ~20-25 kW/rack (ASHRAE TC9.9 5th ed. 2021);
             * liquid unlocks GB200-class 120-132 kW; immersion higher still. */
            coolingMaxRackKw: { air: 20, inrow: 30, rdhx: 50, liquid: 132, immersion: 200, immersion_1p: 200, immersion_2p: 200, microfluidic: 250 },
            densityBands: [
                { minKw: 80, band: 'Extreme', coolingMandatory: 'liquid' },
                { minKw: 40, band: 'High', coolingRecommended: 'liquid' },
                { minKw: 20, band: 'Medium', coolingRecommended: 'rdhx' },
                { minKw: 0,  band: 'Standard', coolingRecommended: 'air' }
            ],
            /* ══ AI ARCHITECTURE PROFILES (Ship-A 2026-07-21) — explicit reference
             * architectures with sourced per-rack power. rackKwNominal = vendor
             * nominal/TDP; rackKwPeak = EDPp provisioning target (~1.5× nominal —
             * power plant sized to peak). confidence: 'official' (NVIDIA RA / OCP
             * spec) vs 'analyst' (Rubin — NVIDIA has NOT published rack-kW; only
             * NVLink6 / 45°C warm-water DLC / 800 VDC are official). Microfluidic is
             * NOT encoded as any NVIDIA arch fact (rumor; official roadmap = warm-
             * water DLC + 800 VDC). GPU/IT hardware cost stays EXCLUDED from capex. */
            peakProvisionFactor: 1.5,
            /* Conventional-DC peak/nominal headroom ALREADY embedded in the
             * T&T/C&W/JLL 2025 base $/kW power-chain costs (electrical/UPS/gen
             * benchmarked on CPU-era facilities where sustained peak ≈ 1.2×
             * design/nominal IT). The AI-rack power-provisioning uplift is
             * therefore MARGINAL — (arch peak/nominal) ÷ baselinePeakRatio —
             * never the raw ratio, else the ~1.2× already priced into the base
             * is double-counted. Floored at 1.0 (an uplift, never a discount). */
            baselinePeakRatio: 1.2,
            archProfiles: {
                h100_pod:    { label: 'NVIDIA H100 SuperPOD', rackKwNominal: 30, rackKwPeak: 45, gpuCount: 32, cooling: 'air', tierFloor: 3, confidence: 'official', ref: 'DGX H100 10.2kW/8U system, ~2-4/rack air; SU=32 nodes' },
                gb200_nvl72: { label: 'NVIDIA GB200 NVL72', rackKwNominal: 120, rackKwPeak: 192, gpuCount: 72, cooling: 'liquid', tierFloor: 3, confidence: 'official', ref: '72 Blackwell + 36 Grace, 120kW nominal / 132kW TDP (both OFFICIAL) / 192kW peak = EDPp ANALYST est ~1.5×TDP (SemiAnalysis/HPE, not NVIDIA-published), DLC+CDU' },
                gb300_nvl72: { label: 'NVIDIA GB300 NVL72', rackKwNominal: 140, rackKwPeak: 192, gpuCount: 72, cooling: 'liquid', tierFloor: 3, confidence: 'official', coolingKitUsdPerRack: 50000, ref: 'Blackwell Ultra, 142kW ref-arch cap (OFFICIAL); 192kW peak = EDPp ANALYST est; cooling kit ~$50k/rack = Morgan Stanley BOM ANALYST ($49,860), not NVIDIA list' },
                rubin_vr200: { label: 'NVIDIA Vera Rubin VR200 NVL72', rackKwNominal: 200, rackKwPeak: 300, gpuCount: 144, cooling: 'liquid', tierFloor: 4, confidence: 'analyst', ref: 'ANALYST est 190-230kW — NVIDIA has NOT published rack-kW; official: NVLink6 260TB/s, 45C warm-water DLC, 800VDC' },
                ocp_hpr:     { label: 'OCP ORV3 High-Power Rack', rackKwNominal: 120, rackKwPeak: 140, cooling: 'liquid', tierFloor: 3, confidence: 'official', roadmapKw: 750, ref: 'Open Rack v3 HPR 92-140kW; liquid busbar roadmap to 750kW then 1MW (Mount Diablo)' }
            },
            interconnect: {
                infiniband: { usdPerGpu: 4900, label: 'InfiniBand NDR/Quantum-2', confidence: 'analyst', ref: 'SemiAnalysis 512-GPU cluster $2.5M / 512 ~ $4900/GPU' },
                ethernet:   { usdPerGpu: 2600, label: 'Ethernet 400/800G (Spectrum-X)', confidence: 'analyst', ref: 'SemiAnalysis $1.3M / 512 ~ $2600/GPU' }
            }
        },
        /* ══ v2.4.0 — DATA.architecture: Architecture disciplines + design-complexity
         * (Layer 3). Canonical discipline list + cooling/tier complexity multipliers
         * → a normalized design-complexity index. ══ */
        architecture: {
            disciplines: ['electrical', 'mechanical', 'cooling', 'fire', 'security', 'network', 'building', 'structural', 'bms'],
            disciplineLabels: { electrical: 'Electrical', mechanical: 'Mechanical', cooling: 'Cooling', fire: 'Fire & Life Safety', security: 'Security', network: 'Network', building: 'Building', structural: 'Structural', bms: 'BMS / DCIM' },
            /* v2.5.0 research pass — ASHRAE TC9.9 5th ed. 2021 thermal envelopes
             * (supply-temp range + max ΔT), cooling ΔT bands, Uptime/TIA-942-C
             * tier topology, structural floor loading, design-fee by complexity. */
            ashraeClasses: {
                A1: { minSupplyC: 15, maxSupplyC: 32, maxDeltaTK: 15, label: 'Class A1 (air, recommended)' },
                A2: { minSupplyC: 10, maxSupplyC: 35, maxDeltaTK: 17, label: 'Class A2 (air)' },
                A3: { minSupplyC: 5,  maxSupplyC: 40, maxDeltaTK: 20, label: 'Class A3 (air, allowable)' },
                A4: { minSupplyC: 5,  maxSupplyC: 45, maxDeltaTK: 20, label: 'Class A4 (air, allowable)' },
                H1: { minSupplyC: 17, maxSupplyC: 45, maxDeltaTK: 12, label: 'Class H1 (liquid)' }
            },
            coolingDeltaT: { air: [10, 15], inrow: [12, 18], rdhx: [10, 20], liquid: [8, 12], immersion: [5, 10] },
            tierTopology: {
                1: { powerPath: 'N, single non-redundant path', coolingPath: 'N, single path', maintainability: 'shutdown required (no redundancy)', tiaRating: 'Rated-1' },
                2: { powerPath: 'N+1 components, single active path', coolingPath: 'N+1 components', maintainability: 'shutdown required', tiaRating: 'Rated-2' },
                3: { powerPath: 'N+1, dual-bus (one path maintained)', coolingPath: 'N+1 concurrently maintainable', maintainability: 'concurrently maintainable', tiaRating: 'Rated-3' },
                4: { powerPath: '2N/2N+1, all paths simultaneously active', coolingPath: '2N fault tolerant', maintainability: 'fault tolerant', tiaRating: 'Rated-4' }
            },
            floorLoadingKnM2: { air: 7.2, inrow: 8.0, rdhx: 9.0, liquid: 10.0, immersion: 13.0 },
            designFeePct: { Standard: 0.07, Moderate: 0.09, High: 0.12, 'Very High': 0.16 },
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
        /* ══ v2.4.0 — DATA.maintenance: maintenance-strategy economics (Group-2 promotion
         * from DCMOC MaintenanceStrategyEngine). Single source for the reactive/planned/
         * predictive cost drivers + model (in-house/hybrid/vendor) blend. ══ */
        maintenance: {
            vendorPremium: 1.35,                 /* vendor labor costs 35% more */
            modelInternalPortion: { 'in-house': 1.0, 'hybrid': 0.6, 'vendor': 0.10 },
            reactiveFailureMult: 3.5,            /* reactive failures vs planned baseline */
            predictiveTaskReduction: 0.25,       /* CBM cuts 25% of planned tasks */
            predictiveFailureReduction: 0.70,    /* CBM avoids 70% of unplanned failures */
            downtime: { plannedMinAvg: 45, reactiveMinAvg: 90, plannedProb: 0.01, reactiveProb: 0.03 },
            expectedFailuresPerYear: { tier4: 1.2, default: 2.5 },
            reactiveEmergencyPartUsd: 2500,      /* avg emergency part */
            reactiveFixHours: 6,                 /* avg emergency fix labor */
            /* v2.5.0 research pass — Uptime Institute critical-facilities staffing
             * benchmark. 24/7 coverage = ~4.2 FTE per manned position (shifts +
             * relief/PTO); positions scale with tier; plus per-MW technicians. */
            staffing: { ftePerPosition: 4.2, positionsByTier: { 2: 3, 3: 5, 4: 7 }, techFtePerMw: 0.35, minFte: 6 }
        },
        /* ══ v2.4.0 — DATA.fuelGen: backup generator + diesel economics (Group-2
         * promotion from DCMOC FuelGenEngine). Sizing + fuel storage/consumption. ══ */
        fuelGen: {
            genEfficiencyLPerKwh: 0.27,          /* EPA Tier 4 Final diesel @ 75% load */
            loadFactor: 0.75,
            fuelStorageHoursByTier: { 2: 48, 3: 72, 4: 96 },   /* Uptime backup autonomy */
            dieselPriceDefaultPerLiter: 1.05,
            fuelTaxRateDefault: 0.05,
            storageLimitLitersDefault: 50000,
            test: { monthlyTestHours: 2, annualFullLoadTestHours: 4 }
        },
        /* ══ v2.4.0 — DATA.capacity: multi-phase build-out presets (Group-2 promotion
         * from DCMOC CapacityPlanningEngine). Occupancy ramp + phase templates. ══ */
        capacity: {
            defaultRamp: [0.3, 0.6, 0.85, 0.95],   /* per-year occupancy fill */
            steadyOccupancy: 0.95,
            /* v2.5.0 research pass — logistic S-curve lease-up by market type
             * (CBRE H1 2025: hyperscale ~84% pre-leased; Uptime 2024: 1-in-4 DCs
             * <40% utilized = stranded; JLL 2025: ~12% phase-build premium). */
            rampProfiles: {
                hyperscale: { L: 0.98, k: 2.0, tMid: 0.5, label: 'Hyperscale (pre-leased)' },
                wholesale:  { L: 0.95, k: 1.0, tMid: 1.5, label: 'Wholesale colocation' },
                retail:     { L: 0.92, k: 0.7, tMid: 2.5, label: 'Retail colocation' },
                enterprise: { L: 0.85, k: 0.5, tMid: 3.0, label: 'Enterprise / build-to-suit' }
            },
            strandedThreshold: 0.40,
            phaseBuildPremiumPct: 0.12,
            rackFootprintM2: 0.72,
            presets: {
                small: [
                    { id: 'p1', label: 'Phase 1', itLoadKw: 1000, startMonth: 0, buildMonths: 14 },
                    { id: 'p2', label: 'Phase 2', itLoadKw: 2000, startMonth: 18, buildMonths: 12 },
                    { id: 'p3', label: 'Phase 3', itLoadKw: 5000, startMonth: 36, buildMonths: 10 }
                ],
                medium: [
                    { id: 'p1', label: 'Phase 1', itLoadKw: 2000, startMonth: 0, buildMonths: 18 },
                    { id: 'p2', label: 'Phase 2', itLoadKw: 10000, startMonth: 20, buildMonths: 14 },
                    { id: 'p3', label: 'Phase 3', itLoadKw: 20000, startMonth: 40, buildMonths: 12 }
                ],
                large: [
                    { id: 'p1', label: 'Phase 1', itLoadKw: 5000, startMonth: 0, buildMonths: 22 },
                    { id: 'p2', label: 'Phase 2', itLoadKw: 20000, startMonth: 24, buildMonths: 16 },
                    { id: 'p3', label: 'Phase 3', itLoadKw: 50000, startMonth: 44, buildMonths: 14 }
                ]
            }
        },
        /* ══ v2.4.0 — DATA.gridReliability: utility-grid reliability bands (Group-2
         * promotion from DCMOC GridReliabilityEngine). Uptime → outage hours + a
         * 0-1 grid score that feeds Site Intelligence (Layer 2). ══ */
        gridReliability: {
            /* Uptime% → qualitative band (SAIDI-informed). */
            bands: [
                { minUptime: 99.99, label: 'Excellent' },
                { minUptime: 99.9,  label: 'Strong' },
                { minUptime: 99.5,  label: 'Fair' },
                { minUptime: 98.0,  label: 'Weak' },
                { minUptime: 0,     label: 'Poor' }
            ],
            /* Reference uptime% mapped to a 0-1 grid goodness score (99.99%→1, 98%→0). */
            scoreFloorUptime: 98.0,
            scoreCeilUptime: 99.99
        },
        /* ══ v2.4.0 — DATA.tax: tax incentives (Group-2 promotion from DCMOC
         * TaxIncentiveEngine). US federal (bonus depreciation, IRA ITC) + state DC
         * sales-tax exemptions + representative import duty. Per-country corporate
         * tax stays in the country profiles. ══ */
        tax: {
            usBonusDepreciation2026: 0.20,       /* 20% bonus depreciation (TCJA phase-down) */
            iraSolarItc: 0.30,                   /* IRA §48 base ITC through 2032 */
            iraDomesticContentBonus: 0.10,       /* +10% domestic-content adder */
            /* v2.5.0 research pass — MACRS (US IRS Pub 946) accelerated depreciation
             * percentages by recovery class (half-year convention). DC IT/servers =
             * 5-yr; MEP/gensets often 7-yr; buildings 39-yr straight-line. */
            macrs: {
                '5':  [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
                '7':  [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
                '15': [0.05, 0.095, 0.0855, 0.077, 0.0693, 0.0623, 0.059, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591, 0.0295]
            },
            macrsBuildingSlYears: 39,
            stateIncentives: {
                'US-VA': { name: 'Virginia Data Center sales-tax exemption', value: 0.06, type: 'sales_tax_exemption' },
                'US-TX': { name: 'Texas DC equipment sales-tax exemption', value: 0.0825, type: 'sales_tax_exemption' },
                'US-NV': { name: 'Nevada sales/use tax abatement (partial)', value: 0.04, type: 'sales_tax_exemption' },
                'US-OH': { name: 'Ohio IT equipment sales-tax exemption', value: 0.0575, type: 'sales_tax_exemption' },
                'US-AZ': { name: 'Arizona TPT exemption', value: 0.056, type: 'sales_tax_exemption' }
            },
            importDutyByCountry: { ID: 0.075, IN: 0.075, US: 0.03 }   /* representative; full set in country profiles */
        },
        /* ══ v2.4.0 — DATA.geoRisk: natural-hazard risk scoring (Group-2 promotion from
         * DCMOC RiskEngine/DisasterRiskEngine). Hazard weights → 0-100 composite geo
         * risk + insurance multiplier. Per-country hazard levels stay in profiles. ══ */
        geoRisk: {
            /* Hazard weights (sum = 1): seismic + flood dominate DC siting risk. */
            weights: { seismic: 0.30, flood: 0.25, typhoon: 0.15, volcano: 0.10, tsunami: 0.10, wildfire: 0.10 },
            /* Composite risk % → insurance premium multiplier (vs a low-risk base). */
            insuranceBands: [
                { min: 70, mult: 1.8, label: 'Very High' },
                { min: 50, mult: 1.45, label: 'High' },
                { min: 30, mult: 1.2, label: 'Moderate' },
                { min: 0, mult: 1.0, label: 'Low' }
            ]
        },
        /* ══ v2.4.0 — DATA.compliance: regulatory compliance cost model (Group-2
         * promotion from DCMOC ComplianceEngine). Amortization + typical cost bands.
         * The per-country framework matrix stays in the DCMOC country profiles. ══ */
        compliance: {
            amortizeOneTimeYears: 10,   /* one-time permit/cert cost spread over 10y */
            /* Typical annual cost bands by category ($/yr) — screening defaults. */
            categoryAnnualUsd: { fireSafety: 2500, electrical: 4000, environmental: 6000, dataProtection: 3000, buildingCert: 2000, security: 3500 }
        },
        /* ── A1: provenance sidecar. Keyed by DATA path → { source, asOf, unit?, method? }.
         * The provenance test asserts every economically-material leaf is registered here. */
        sources: {
            'capexDetail': { source: 'Turner & Townsend DCCI 2025 + Cushman & Wakefield DC Cost Guide 2025 (city $/W anchor table) + JLL 2026 escalation; category factors calibrated to the anchor (locMult = perW/4.65) — lineage: capex-calculator inline model, lifted v2.3.0', asOf: '2025', method: 'budgetary estimate-grade; NOT detailed engineering' },
            'capexDetail.costFactors.electrical': { source: 'calculator lineage 1200 $/kW (DCMOC A7 2025 used 1550 for a different model shape — NOT merged; engine detailed model is the shared source from v2.3.0)', asOf: '2025', unit: '$/kW IT' },
            'deepSeaCooling': { source: 'Design basis: 150 MW AI DC deep-sea cooling reference architecture (owner, 2026) — chiller-less primary + hybrid trim backup; seawater properties: TEOS-10/IOC tables at S=35, 5 °C; intake-temp bands: NOAA World Ocean Atlas typical tropical/subtropical profiles; SWAC cost scaling: Makai Ocean Engineering SWAC studies + Hawaii/InterContinental SWAC projects (public figures), HDPE marine pipeline install multipliers 2.5-4x onshore', asOf: '2026', method: 'poster mode reproduces the reference (cp 4.0, rho 1000): 172.5 MW / (4.0*5) = 8.625 m3/s = 31,050 m3/h, 4+1 pumps 2.9 m3/s @ 60 m ≈ 2.0 MW each; accurate mode uses rho 1025 / cp 3985' },
            'boq.gfaM2PerMw':    { source: 'Turner & Townsend DC Cost Index 2025-26 (~10-11.4k sqft/MW gross) + Silverback WPSF series — screening; 900 m²/MW mid-band', asOf: '2025', unit: 'm² GFA per MW IT', method: 'SCREENING rule-of-thumb' },
            'boq.takeoff':       { source: 'SCREENING 3-LEVEL quantity takeoff (discipline → subsystem → ~100 component leaves across civil/electrical/mechanical/fire/ELV/security/Cx/permits). Anchor ratios: rebar ~130 kg/m³ (One Click LCA), structural steel ~40 kg/m² (CalcTree), raised floor ~4.6 m²/rack (dgtlinfra), clean-agent Novec 1230 ~0.55 kg/m³ per NFPA 2001/3M TDS (HIGH), CW coolant ~8 L/kW (B&V Water). Equipment counts (UPS/genset/transformer/chiller/CDU/CRAH) mirror boq.equipmentSizing and are path-scaled by redundancy (boq.paramFactors). Per-kW cable/tray/pipe-per-MW and per-m² fit-out ratios = rule-of-thumb LOW confidence (Spon’s/RSMeans price installed length/area not per-kW) — folded into AACE −30/+50 band; each leaf carries its own confidence tag. ONE reconcileFactor per discipline scales Σ(all subsystem lines) to the parametric CAPEX category $ so absolute ratio error does not move the total.', asOf: '2026', unit: 'material/labor qty per driver', method: 'AACE Class-4 screening; 3-level, reconciled to parametric CAPEX' },
            'boq.unitRates':     { source: 'US-2025 installed material+install $/unit, ~90 keys spanning all subsystems. Anchors: concrete ~$320/m³ + rebar ~$2100/t (Gordian/HomeGuide), structural steel ~$3300/t (SteelFlo 2026), raised floor ~$270/m² (datacenterfloortiles), LV/MV cable + tray + CW pipe (1xTechnologies/DistributorWire/RSMeans/MEP Academy — LOW), major equipment (UPS module/genset/chiller/CDU/transformer/PDU) at screening OEM installed price, envelope/fit-out/external-works per-m² (Spon’s/RSMeans), bare BLS trade wages (electrician/pipefitter/ironworker/laborer). Regionalized via locMult; +5.5%/yr escalation (T&T). Aggregate per-MW line rates (dcim/bms/security/Cx-L1..L5/design/PM/permits) are anchors scaled by reconcileFactor to the category $.', asOf: '2025', unit: 'USD per material/labor unit', method: 'SCREENING; add ~35-60% labor burden for a bid' },
            'boq.paramFactors':  { source: 'SCREENING multiplier tables the param-conditional BOQ drivers read: seismic rebar/bracing scale by ASCE 7-22 Sds zone band (zone0..zone4); diesel bulk-fuel ~0.28 m³ per MW-hour of runtime (~235 g/kWh at ~0.85 kg/L + ullage); clean-agent design concentration by agent (Novec 1230 ~0.55, FM-200 ~0.36 kg/m³ per NFPA 2001/3M/Chemours TDS); redundancy parallel-path multiplier by Uptime Tier topology (N/N+1/2N/2N+1); UPS battery strings per module (rotary carries none); CDU-vs-CRAH split by cooling type; PDU/RPP count per rack by density band. Each factor tunes a quantity base, not the reconciled category $.', asOf: '2026', unit: 'dimensionless multipliers + per-unit factors', method: 'SCREENING — code-band anchored (ASCE/NFPA/Uptime), fold into AACE Class-4' },
            'supplyChain': { source: 'PROXY/SCREENING per-country landed-cost + export-control. Import-duty bands (equipment): FTA 0 / low ~3% / med ~7.5% / high ~17% (IN ~15, BR ~16) / punitive ~30% (China↔US), applied to the imported-EQUIPMENT fraction per category (BOM split: ups ~70/gen ~75/network ~80/cooling ~55/electrical ~40%, labor-heavy ~0) — WTO/national tariff schedules, screening. Export-control tiers = US BIS Fed-Register PROXY; AI Diffusion Rule RESCINDED 2025 so caps are NOT in force — advisory only, NOT statutory/legal advice. Customs lead +2-12 wk by jurisdiction. Per-country band assignment in CountryProfile.supplyChain.', asOf: '2026', unit: 'duty rate + export tier + customs weeks', method: 'PROXY/SCREENING — duty on equipment fraction only; export-control advisory, policy fluid' },
            'dossier': { source: 'STANDARD-PRACTICE EPC Technical Dossier scaffold — permitting matrix (typical AHJ permits + indicative durations), design basis (IEC/NEC/ASHRAE TC9.9/ASCE 7/NFPA/Uptime references), risk register (typical mission-critical DC risks) QUANTIFIED with screening cost-impact %-of-CAPEX bands + schedule-slip weeks + post-mitigation residual band + early-warning indicators, document register + document delivery schedule (deliverable × phase × approver, ISO 19650 / Uptime CDE convention), ops-readiness gates. Reference convention (Uptime/TIA-942/BICSI/NFPA), NOT a project-specific submission; durations/risks/bands indicative. models.dossier.sections composes these with live engine outputs.', asOf: '2026', unit: 'permit/risk/document/readiness scaffold + quantified risk bands + doc-schedule + calc→model references', method: 'STANDARD-PRACTICE reference — validate against the AHJ + full design + a project risk workshop' },
            'dossier.countryRisks': { source: 'SCREENING location-risk supplement DERIVED LIVE from the selected DATA.countries[id] hazard/grid/talent fields (naturalDisaster.{seismicZone,floodRisk,typhoon/volcano/tsunami,compositeScore,insuranceMultiplier}, gridReliability.{gridUptime,brownoutFrequency,gridTier,recommendedGenHours}, talentPool.{dcEngineerPool,avgHiringDays,talentScore}) — seismic (ASCE 7), flood/natural-disaster (FM Global/local), grid reliability (NFPA 110/Uptime), talent depth. Severity is a screening band off the source metric; no new economic literals (reads countries.ts single-source).', asOf: '2026', unit: 'location hazard + screening severity + mitigation per country', method: 'SCREENING — a project-specific site-risk study supersedes' },
            'dossier.engineeringCalcs': { source: 'AACE Class-4 SCREENING worked engineering calculations DERIVED LIVE from the requirement input + CAPEX result + existing engine models/data (equipmentSizing, reliability, waterFootprint, pueMatrix, paramFactors, architecture.floorLoadingKnM2) — electrical continuous load (NEC 210.19/215.2), transformer/UPS/genset/cooling sizing (IEEE 3006/3007, NFPA 110, ASHRAE TC9.9), fuel storage (NFPA 30/110), clean-agent + fire-water (NFPA 2001/13), structural floor load (ASCE 7), cable derate (NEC 310.15), system availability (IEEE 493 / Uptime). No new economic literals — each sheet references the model/table that computes it, each carries a standard + confidence tag.', asOf: '2026', unit: 'formula + inputs + steps + result per discipline (screening worked calcs)', method: 'AACE Class-4 screening; live from inputs + engine models — validate against a full design' },
            'boq.equipmentSizing': { source: 'SCREENING nominal unit ratings for equipment-count sizing (UPS 500kW module, genset 2.5MW, transformer 2.5MVA, CRAH 150kW, CDU 700kW, chiller 1.4MW) + redundancy addend by topology. Lead times reflect the 2026 long-lead reality — MV transformer/switchgear ~120 wk dominant (industry supply-chain reporting); UPS ~26, genset ~40, chiller ~32 wk.', asOf: '2026', unit: 'kW/MVA per unit + weeks lead time', method: 'SCREENING — real selection depends on the design' },
            'boq.procurement':      { source: 'Standard mission-critical DC EPC procurement packaging (12 packages P01-P12) with tender method, lead time, FAT/SAT, warranty — industry norm (Uptime/BICSI procurement practice). Package value = Σ mapped CapexResult category $.', asOf: '2026', unit: 'package scope + lead-time + FAT/SAT + warranty', method: 'SCREENING packaging convention' },
            'boq.criticalSpares':   { source: 'SCREENING critical-spares stock — installed-population failure demand from DATA.reliability.components MTBF (IEEE 493 Gold Book) × equipmentSchedule population, priced from DATA.sparesPricing list-price bands, run through models.spares.newsvendor (critical-fractile, Acklam Φ⁻¹ / exact Poisson) to a service level. Understock (downtime-per-event) consequence costs are screening assumptions folded into the critical-fractile — NOT vendor quotes.', asOf: '2026-07', unit: 'recommended stock qty + holding $ + annual replacement $', method: 'AACE Class-4 screening; newsvendor over MTBF-driven demand — validate against OEM RCM data' },
            'boq.pmSchedule':       { source: 'SCREENING preventive-maintenance schedule — PM intervals + task lists are STANDARD-PRACTICE (OEM / NFPA 110 genset / ASHRAE chiller convention); annual labor-hours = installed population (equipmentSchedule sizing) × PM visits/yr × hr/visit; annual PM cost allocated from the DATA.omContracts preventive $/kW-yr band by per-system weight.', asOf: '2026-07', unit: 'PM interval + annual labor-hr + annual PM $', method: 'AACE Class-4 screening; standard-practice PM tasking — validate against OEM RCM + vendor SLA' },
            'boq.commercialBasis': { source: 'EPC margin 8-12% gross / 2-6% net realized on LSTK mission-critical (XYZ Reality) — DISCLOSED, embedded in benchmark not added. Safety factors: NEC 210.20/215.3 continuous 1.25 (HIGH), ASCE 7-22 LRFD 1.2D+1.6L (HIGH), NEC 310.15 ampacity derate ~0.75 (HIGH), Uptime Tier-3 N+1 (HIGH). AACE 18R-97/17R-97 Class-4 −30%/+50% (HIGH); contingency set by risk, screening rule-of-thumb 20-30%.', asOf: '2026', unit: 'margin % + design safety factors', method: 'code-mandated factors HIGH; margin band screening' },
            'coolingTech': { source: 'Vendor datasheets + OCP/press for COMMERCIAL (CoolIT/JetCool/ZutaCore/GRC/Submer/Iceotope — TRL 8-9, shipping); research disclosures for EMERGING (Corintis EPFL+Microsoft in-chip validation 2024-25, TSMC DSLC, IMEC impinging-jet >600 W/cm², IBM microfluidic — TRL 5-7 pilot/lab). rackKwClaim + PUE ladder = screening; NO public per-rack CAPEX for microfluidic (multiplier SCREENING-only). Microfluidic is NOT an NVIDIA architecture fact.', asOf: '2026-07', unit: 'per-tech TRL + rack-kW capability + coolant/WUE basis', method: 'technology-readiness classification; commercial=deployable, emerging=pilot/research' },
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
            'countries':              { source: 'DCMOC country reference 2026-Q1 (per-country economy/labor/environment/gridReliability/naturalDisaster/talentPool/fuelDiesel/taxIncentives/compliance/constructionIndex); PLN/EMA/TEPCO/national tariff filings + IMF WEO + Ember grid-intensity + national labor statistics. GENERATED from dcmoc/src/constants/countries.ts — single source of truth for the site + DCMOC.', asOf: '2026-Q1', unit: 'mixed (see per-country fields)' },
            'opex.basisPresets':      { source: 'Phase-Q shared-engine alignment: utilization presets parameterize the documented opex-calculator (retail 0.7 util) vs DCMOC (DC-contract 1.0 util) basis divergence', asOf: '2026', method: 'multiplier on energy-driven lines (power/water/carbon); default 1.0 = legacy-identical' },
            'commissioning.cx':       { source: 'Commissioning program cost/schedule methodology promoted from cx-calculator.html. RICH engine (cx.rich): equipment quantities scaled from IT load + rack density → per-level (L0-L6) staffed durations at 30 regional day-rate cards ($/day cxDay/fieldDay/oemDay/witnessDay + per-diem + diesel $/L + cost mult), gm-normalized (^0.45) base blend vs level-sum, Monte-Carlo (N=10000) band + 7-param sensitivity tornado. Base rates + multipliers calibrated to DC Cx budgetary practice (ASHRAE Guideline 0 / BCxA / NETA ECS scope, Uptime IST scenario counts). Compact cx.* kept for back-compat.', asOf: '2026', method: 'budgetary estimate-grade Cx program model; NOT a detailed Cx plan' },
            'requirements.baselinePeakRatio': { source: 'ANALYST — CPU-era enterprise DC power-chain design headroom (sustained peak ≈ 1.2× nominal/design IT) already embedded in the T&T/C&W/JLL 2025 base $/kW; used to make the AI-rack power-provisioning uplift MARGINAL (peak÷nominal ÷ this), preventing double-count.', asOf: '2026-07', unit: 'ratio (peak/nominal already in base cost)' },
            'requirements.archProfiles':      { source: 'OFFICIAL where confidence=official (NVIDIA GB200/GB300 NVL72 reference architectures + DGX H100 SuperPOD RA + OCP ORV3 HPR spec) — rackKw nominal/TDP/peak(EDPp ~1.5x); ANALYST for rubin_vr200 (NVIDIA has NOT published Rubin rack-kW; only NVLink6/45C warm-water DLC/800VDC are official — kW is analyst 190-230 est). IT/GPU hardware cost EXCLUDED from capex.', asOf: '2026-07', unit: 'kW/rack per architecture' },
            'requirements.interconnect':      { source: 'ANALYST — SemiAnalysis 512-GPU cluster: InfiniBand NDR ~$2.5M vs 400/800G Ethernet ~$1.3M; per-GPU derived (÷512). Not vendor list price; optional labeled capex line, off by default.', asOf: '2025', unit: 'USD/GPU' },
            'requirements.coolingMaxRackKw': { source: 'ASHRAE TC9.9 5th Ed. 2021 (air ~20-25 kW/rack limit; H1-H3 liquid envelopes); NVIDIA GB200 NVL72 132 kW observed; OCP High Power Rack 92 kW+ (Meta/Rittal OCP Summit 2024); IEA 4E Liquid Cooling in Data Centres 2026', asOf: '2025', unit: 'kW/rack per cooling type' },
            'architecture.ashraeClasses': { source: 'ASHRAE TC9.9 5th Ed. 2021 "Thermal Guidelines for Data Processing Environments" — A1/A2/A3/A4 air + H1 liquid supply-temp envelopes + ΔT limits', asOf: '2021', unit: '°C supply range + °C ΔT max' },
            'architecture.tierTopology': { source: 'Uptime Institute Tier Standard: Topology 2022 (T1-T4 redundancy paths); ANSI/TIA-942-C 2024 Rated-1..Rated-4', asOf: '2024', unit: 'topology description + TIA rating' },
            'architecture.designFeePct': { source: 'ASHRAE Guideline 0-2019 + industry A&E engineering-fee benchmarks (ARUP/Syska/Jacobs DC practice) by complexity band', asOf: '2024', unit: 'fraction of construction capex' },
            'capacity.rampProfiles':  { source: 'Logistic lease-up S-curve calibrated to CBRE North America DC Trends H1 2025 (hyperscale ~84% pre-lease, 3% vacancy); Uptime Institute Global Survey 2024 (1-in-4 DCs <40% utilized = stranded); JLL DC Construction Cost 2025 (~12% phase premium)', asOf: '2025', unit: 'occupancy fraction (0-1) + % premium', method: 'occupancy(t)=L/(1+e^-k(t-tMid)) per market type' },
            'construction.longLeadWeeks': { source: 'Critical long-lead electrical/mechanical equipment procurement lead times, 2024-26 supply-constrained market (MV/HV transformers 60-120 wk, MV switchgear 50-80 wk, gensets 40-70 wk, UPS 30-52 wk, chillers 30-50 wk) — EPRI/industry procurement trackers + OEM quotes', asOf: '2025', unit: 'weeks [typical, stressed]' },
            'maintenance.staffing':   { source: 'Uptime Institute critical-facilities staffing benchmark: 24/7 manned position needs ~4.2 FTE (shifts + relief/PTO); positions scale with tier; plus per-MW technicians', asOf: '2024', unit: 'FTE' },
            'asset.weibull':          { source: 'Weibull wear-out life distributions by asset class (shape β>1 = increasing hazard; scale η = characteristic life yr) — reliability engineering practice + IEEE 493 (Gold Book) component data + manufacturer MTBF', asOf: '2024', unit: 'β (shape), η (years)' },
            'site.climateFreeHours':  { source: 'ASHRAE 169-2021 climate zones → annual economizer (free-cooling) hours (DOE/NREL psychrometric bin analysis); site-selection factor weights per CBRE/JLL DC Site Selection frameworks 2025; per-country water-stress WRI Aqueduct 4.0 (2023); grid reliability IEEE 1366 SAIDI; seismic USGS PGA → IBC/ASCE 7-22 SDC', asOf: '2025', unit: 'hr/yr free-cooling; 0-1 factor scores' },
            'carbon.dieselKgCo2PerL': { source: 'GHG Protocol Corporate Standard scope 1/2/3 boundaries; EPA Emission Factors 2024 diesel 2.68 kgCO₂/L; refrigerant leakage per GHG Protocol + EPA GreenChill; embodied construction carbon amortized (RICS/LETI DC embodied-carbon studies)', asOf: '2024', unit: 'kgCO₂/L, tCO₂e/MW·yr' },
            'tax.macrs':              { source: 'US IRS Publication 946 (How To Depreciate Property) — MACRS GDS percentage tables, half-year convention (5-yr IT, 7-yr MEP, 15-yr land improvements, 39-yr non-residential building SL)', asOf: '2025', unit: 'depreciation fraction per recovery year' },
            'aace':                   { source: 'AACE International Recommended Practice 18R-97 "Cost Estimate Classification System" — Class 1-5 by project definition maturity → accuracy ranges (Class 5 -50/+100% … Class 1 -10/+15%). Engine detailed capex is a Class 4 budgetary estimate', asOf: '2020', unit: '% accuracy range by estimate class' },
            'decision':               { source: 'Layer-13 planning benchmarks: Uptime Institute Tier Standard availability targets (99.741/99.982/99.995); cost/kW bands by tier from CBRE/JLL/Cushman & Wakefield DC Cost 2025; PUE best-practice bands ASHRAE TC9.9. Descriptive engineering guidance — not advice.', asOf: '2026', unit: '% availability, $/kW bands, PUE targets' },
            'currency':               { source: 'ECB / central-bank reference rates', asOf: '2026-04', method: 'spot, USD base' },
            'inflationAnnual':        { source: 'IMF WEO 2026 regional CPI', asOf: '2026', unit: 'fraction/yr' },
            'salaryBenchmarks':       { source: 'Uptime Institute 2026 + AFCOM 2026 + US BLS 2025', asOf: '2026', unit: 'USD/yr, base' },
            'salaryRolesExt':         { source: 'Uptime 2026 + Levels.fyi + AFCOM 2026 role survey', asOf: '2026', unit: 'USD/yr, base' },
            'attritionFactors':       { source: 'Center for American Progress + DataX Connect 2024', asOf: '2024' },
            'envCosts':               { source: 'Carbon: World Bank Carbon Pricing Dashboard + OECD Effective Carbon Rates 2025 + NCCS Singapore (S$45/t from 2026) + national schemes — compliance snapshot 2025-26; Waste: industrial disposal + certified e-waste/ITAD screening bands', asOf: '2026-07', method: 'per-country compliance price, voluntary-offset fallback labeled; waste screening' },
            'calibrationSpec':        { source: 'Arc-1 model-calibration spec — band mereferensikan persentil korpus LIVE (benchmarksCorpus); metodologi & justifikasi di standarization/MODEL_CALIBRATION_STANDARD.md', asOf: '2026-07-20', method: 'aggregate-only validation; per-project calibration dinyatakan tidak feasible' },
            'omContracts':            { source: 'SCREENING bands — datacentres.com cost guide 2026 (preventive $200-400K/yr per 10MW; OEM +40-60% vs third-party), Schneider Electric maintenance-ROI blog 2024, TechTarget/thenetworkinstallers OPEX guides 2026', asOf: '2026-07', method: 'public benchmark synthesis, fixed-fee $/kW-yr bands' },
            'sparesPricing':          { source: 'SCREENING list-price bands — Schneider/APC Galaxy VS 50kW module class, criticalpowerbatterysolutions.com VRLA string TCO 2026 (~$10K/string), Schneider CRAH VFD retrofit kit ~$15K installed, OnPoint/secondwatt genset maintenance guides 2026, industrial MCCB distributor ranges', asOf: '2026-07', method: 'public list/retrofit price synthesis per class' },
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
            'asset':                  { source: 'ASHRAE Equipment Life Expectancy + manufacturer service-life data (design lives); health-index weighting is an engine asset-management heuristic; lifecycle replacement intervals + $/kW lifted from DCMOC CapexEngine (UPS/gen/CRAC/PDU/BMS/fire)', asOf: '2026', unit: 'years + weights (sum=1) + health % + $/kW replacement', method: 'screening health + lifecycle model; NOT a condition survey' },
            'construction':           { source: 'Canonical DC build phase sequence (design→permit→procurement→civil→MEP→commissioning) + typical fast-track overlap factors — engine scheduling heuristic', asOf: '2026', unit: 'months (durations) + overlap fractions', method: 'CPM-style forward pass with per-phase overlap; screening schedule, NOT a resource-loaded programme' },
            'requirements':           { source: 'DC project brief required-field set + workload density/cooling profiles (AI/HPC/cloud/colo/enterprise/edge) — engine intake heuristic informed by Uptime/OCP rack-density guidance', asOf: '2026', unit: 'field list + kW/rack + cooling/tier defaults', method: 'completeness + profile defaults; not a design basis' },
            'architecture':           { source: 'Canonical DC design disciplines (electrical/mechanical/cooling/fire/security/network/building/structural/BMS) + relative design-complexity multipliers by cooling/tier/redundancy — engine heuristic', asOf: '2026', unit: 'discipline list + complexity multipliers → 0-100 index', method: 'normalized complexity screen; NOT a design deliverable' },
            'maintenance':            { source: 'DC O&M strategy economics — reactive/planned/predictive failure + downtime multipliers + in-house/hybrid/vendor labor blend; lifted from DCMOC MaintenanceStrategyEngine (RCM/CBM industry conventions)', asOf: '2026', unit: 'multipliers + minutes + $/part', method: 'screening O&M cost model; NOT a vendor quote' },
            'fuelGen':                { source: 'EPA Tier 4 Final diesel genset fuel rate (~0.27 L/kWh @ 75%) + Uptime backup-autonomy hours by tier (48/72/96h); lifted from DCMOC FuelGenEngine', asOf: '2026', unit: 'L/kWh + hours + $/L', method: 'screening sizing; NOT a genset selection' },
            'capacity':               { source: 'Multi-phase DC build-out templates (small/medium/large) + occupancy ramp; lifted from DCMOC CapacityPlanningEngine', asOf: '2026', unit: 'kW per phase + months + occupancy fraction', method: 'planning templates; adjust per project' },
            'gridReliability':        { source: 'Utility grid reliability bands (SAIDI-informed uptime tiers) + 0-1 grid score mapping; lifted from DCMOC GridReliabilityEngine — per-country uptime stays in the country profiles', asOf: '2026', unit: 'uptime % + outage hours + 0-1 score', method: 'screening; NOT a utility interconnection study' },
            'tax':                    { source: 'US TCJA bonus depreciation (20% 2026 phase-down) + IRA §48 solar ITC (30% + 10% domestic-content) + state DC sales-tax exemptions (VA/TX/NV/OH/AZ) + representative import duty; lifted from DCMOC TaxIncentiveEngine', asOf: '2026', unit: 'fractions (rates)', method: 'US-federal + state incentives; NOT tax advice; per-country corporate tax in country profiles' },
            'geoRisk':                { source: 'Natural-hazard weighting (seismic/flood/typhoon/volcano/tsunami/wildfire) + insurance-multiplier bands; lifted from DCMOC RiskEngine/DisasterRiskEngine — per-country hazard levels stay in the country profiles', asOf: '2026', unit: 'weights (sum=1) + 0-100 risk + premium multiplier', method: 'screening geo-risk; NOT a certified hazard/insurance assessment' },
            'compliance':             { source: 'DC regulatory compliance cost categories (fire/electrical/environmental/data-protection/building/security) + one-time amortization; lifted from DCMOC ComplianceEngine — per-country framework matrix stays in country profiles', asOf: '2026', unit: '$/yr + amortization years', method: 'screening compliance cost; NOT a legal/permitting determination' },
            'tier.scoreMaps':         { source: 'tier-advisor.html SCORE_MAPS + WEIGHTS — 15 component maps for 6-band Uptime-style advisor; lifted v2.5.0', asOf: '2026', method: 'engineering heuristic; NOT a certified Uptime Institute assessment' },
            'fire.battery':           { source: 'fire-model.js BATTERY / TR_HEAT_FACTOR — Li-ion/VRLA thermal-runaway onset temperatures + off-gas volumes; NFPA 855 / UL 9540A', asOf: '2026', unit: '°C onset + L/Wh off-gas + MJ/MJ TR heat', method: 'screening; NOT a certified TR test result' },
            'fire.bands':             { source: 'fire-model.js BANDS — NFPA 2001/72/855 operating limits (discharge time, hold time, spot-detector area, gas-alarm LFL)', asOf: '2026', unit: 'seconds / minutes / m² / %LFL', method: 'STANDARD per NFPA' },
            'cdu.bands':              { source: 'cdu-model.js BANDS — OCP cold-plate + ASHRAE TC9.9 CDU operational bounds (supply temp, ΔT, flow, dP, dew margin, pipe velocity)', asOf: '2026', unit: '°C / K / Lpm/kW / bar / m/s' },
            'cdu.pump':               { source: 'cdu-model.js PUMP — typical seal-less CDU pump (η=0.70) + IE3 motor (η=0.92) + 600 Lpm duty pump; ILLUSTRATIVE', asOf: '2026', unit: 'efficiency fraction + Lpm' },
            'cdu.phys':               { source: 'cdu-model.js PHYS — commercial-steel absolute roughness (Moody/Colebrook), barToPa, Magnus dew-point coefficients (Alduchov-Eskridge 2006)', asOf: '2026', unit: 'mm / Pa/bar / dimensionless' },
            'mttrResponse':           { source: 'Article-4 vendor-vs-inhouse MTTR model: per-category phase durations (Electrical/Mechanical/Controls/Fire — field screening), skill multipliers 1.5..0.55, coverage mobilization hours (24x7 0.25h / 16x7 0.8h / 12x5 2.1h), 55% retainer recovery, 30% non-critical downtime cost weight', asOf: '2026', method: 'phase-sum MTTR + annual downtime-delta economics; deterministic (page Monte Carlo stays page-side)' },
            'techDebt':               { source: 'Article-5 technical-debt risk model: criticality weights 10/5/1, Weibull screening (beta 2.5 base, eta 60 months, facility-age adjustments), 15%/yr risk growth, 8% discount, escalation 1+(age/24)x0.5, inaction 30% factor, SLA 0.1% revenue factor, insurance bands 1-8% by risk score', asOf: '2026', method: 'hazard-weighted composite scaled to 100; Lanczos gamma for MTTF; screening-grade' },
            'rcaScore':               { source: 'Article-6 RCA program effectiveness rubric: completion 20% + implementation 25% + recurrence 20% + time-to-close 15% (90-day target) + design-authority involvement 10% + verification 10%', asOf: '2026', method: 'weighted 6-component composite 0-100' },
            'benchmarksCorpus':       { source: 'DC public-data corpus (tools/dc-corpus): operator/hyperscaler sustainability & annual reports + research bodies — every fact carries source_url + verbatim quote; distributions p10-p90 per metric x segment', asOf: '2026-07-19', method: 'markitdown ingestion + heuristic extraction + percentile aggregation; regenerate via the corpus pipeline (append-only)' },
            'opsMaturity':            { source: 'Article-1 ops-maturity assessment: 8 weighted dimensions (weights sum 1.0, expert screening), 5 maturity levels (Reactive..Generative); risk translation basis Uptime Institute 2024 Annual Outage Analysis (>55% outages ops/human factors, ~$200K median outage cost, 2.5 outages/yr low-maturity screening base)', asOf: '2026', method: 'weighted 1-5 composite scaled 0-100; risk factor max(0.05, 1-score/120) — screening-grade' },
            'alarmMgmt':              { source: 'ISA-18.2 / EEMUA-191 alarm-management targets: avg rate <=1 alarm/10 min per operator, flood >=10 alarms/10 min, actionable >=85%; cognitive-load knee at 70% utilization (human-factors literature); Erlang-C standard queueing formula', asOf: '2026', method: 'Poisson flood probability via the shared Acklam/Poisson kernel (models.spares.poissonCdf); composite = rate 50% + flood 30% + actionable 20% (article-2 rubric)' },
            'maintCompliance':        { source: 'Article-3 maintenance-compliance capacity model: friction factors (High .55/Med .70/Low .85 productive-time share), CMMS maturity multipliers (.70-.100), evidence multipliers (.85-.98), backlog aging weight (0.3 + 0.02/month, cap 0.5) — industry screening estimates', asOf: '2026', method: 'compliance = min(100, capacity/demand*100) x cmms x evidence; deterministic (page-side Monte Carlo stays page-side)' },
            'aiFactory':              { source: 'Article-18 AI-factory readiness rubric: cooling limits (air ~30 kW ceiling, DTC ~200 kW, immersion ~400 kW — vendor specs/OCP), floor loading bands (1500/2500/3500 kg per m2 by rack class), PUE bands (AI-native 1.10-1.25 vs industry avg 1.58 Uptime 2024), OPEX $/MW rates = screening estimates', asOf: '2026', method: 'banded scoring rubric, screening-grade; annualEnergy \u00d71000 unit bug in the source article CORRECTED at promotion (MWh\u21d2kWh \u00d71e3, not \u00d71e6)' },
            'aiWater':                { source: 'Article-20 per-query AI water model: Li, P. et al. 2023 (Making AI Less Thirsty, Joule) per-query scaling; company env. reports 2024 (Microsoft/Google); per-model attribution = estimate-grade; upstream 3\u00d7 = power-generation water (Macknick/NREL screening)', asOf: '2026', method: 'estimate-grade per-model attribution, not vendor-published telemetry' },
            'waterFootprint':         { source: 'Article-20 DC water model: WUE bases per cooling (Li et al. 2023 Joule; Uptime Institute 2024; ASHRAE TC9.9), company benchmarks (Google/Microsoft/Meta env. reports 2024, AWS est.), water $/kgal typical municipal/reclaimed/surface/well ranges; upstream-power water factor 1.5 L/kWh non-renewable = screening (Macknick et al. NREL ranges)', asOf: '2026', method: 'screening-grade footprint, not a site water balance' },
            'gridImpact':             { source: 'Article-11 SEA citizen-bill model: residential tariffs (PLN/TNB/EMA/MEA/EVN/Meralco published 2025-2026 rates), national grid capacity (national utility/EIA country notes), avg household kWh (national statistics), IEA data-centre electricity growth ~15%/yr; 40% residential pass-through = screening assumption', asOf: '2026', method: 'screening-grade allocation model, not a tariff filing analysis' },
            'resilience':             { source: 'Article-7 reliability-vs-resilience rubric: design-redundancy score bands (N/N+1/2N/2N+1 per Uptime tier topology), 7 operational-resilience dimensions weighted (drill 15 / response 20 / recovery 15 / cross-train 10 / documentation 15 / communication 10 / lessons 15 — expert screening weights); gap bands 30/15 pts', asOf: '2026', method: 'weighted 0-100 composite; screening-grade self-assessment, not a certified resilience audit' },
            'safetyCulture':          { source: 'Article-8 Safety Health Index: 7 leading-indicator dimensions with screening norms (10 near-miss/mo, 15 weak signals/mo, 30 open findings cap, 20 training hr/qtr, 8 walkarounds/mo — HSE/HRO literature targets); drift-to-failure logic per Rasmussen (1997) boundary-migration model; culture stages per Hudson/Parker HSE ladder', asOf: '2026', method: 'weighted 0-100 leading-indicator composite + heuristic drift probability; screening-grade, not an audited safety-culture survey' },
            'hvacCooling':            { source: 'Article-9 HVAC cooling TCO model: regional PUE by architecture (traditional/hybrid/DLC, tropical vs temperate — Uptime Global Survey bands + tropical-climate screening), capex $0.8/1.1/1.4M per MW, maintenance $50/65/80K per MW·yr, grid CO2 factors (kg/kWh, national grid data), evaporative 1.8 gal/kWh vs DLC 0.2 gal/kWh (NREL/Macknick ranges); 8% discount, 10-yr NPV', asOf: '2026', method: 'screening-grade cooling-architecture TCO; NOT an engineered cooling design or vendor quote' },
            'waterStress':            { source: 'Article-10 SEA water-stress model: per-city stress scores + water tariffs (WRI Aqueduct 4.0 stress classes; PAM Jaya/PUB/Ranhill/city-utility published tariffs $/m3), aquifer subsidence (Jakarta ~25 cm/yr, BRIN/JICA), DLC ~87% water reduction (vendor/Uptime screening), recycling capex ~$450K/MW at 40% saving, water-energy nexus 650-1000 kWh/ML (SEA pumping+treatment)', asOf: '2026', method: 'screening-grade water cost/risk model with 3% escalation + 8% discount; not a site water balance or utility filing' },
            'dcValue':                { source: 'Article-12 DC economic-value model: country industrial tariffs + grid carbon intensity (national utility/Ember), capex $/MW by DC type (hyperscale 12M / colo 10M / enterprise 15M / AI-HPC 18M — CBRE/Turner&Townsend bands), IMPLAN 4.3x indirect-jobs multiplier, E3 grid-surplus $33.5K/MW·yr, DR $50K/MW·yr, 24/7 CFE 1.5x overbuild (Google CFE methodology), 22 kg CO2/tree·yr (EPA)', asOf: '2026', method: 'screening-grade economic/environmental impact model, not an economic-impact study' },
            'communityImpact':        { source: 'Article-14 community cost/benefit model: cooling water 26/13/0.5/3 ML per MW·yr (Dgtl Infra/Equinix WUE benchmarks), noise at 400ft (Prince William County/WUSA9 measurements), NOx per 2MW genset (EPA AP-42), health cost $15,385/ton NOx (UCR/Caltech), bill impact per Carnegie Mellon grid-load model, construction 35 jobs/MW + permanent 1.2 jobs/MW (BLS/DCK consensus), BEA RIMS II 2.5x, GDP ~$800K/MW·yr (Fortune/Harvard)', asOf: '2026', method: 'screening-grade community net-score (-100..+100); not an environmental-impact assessment' },
            'opsBudget':              { source: 'Article-15 ops budget + staffing model: country labor rates + industrial energy tariffs (national statistics/utility filings), 4.2 FTE/MW in-house staffing at 4.2x shift multiplier (Uptime critical-facilities staffing benchmark), 35% labor burden, $180K/MW·yr comprehensive maintenance base, PM-ratio savings up to 15%, burnout logistic (k=0.12, mid 88% utilization — occupational-health literature), 150% replacement cost (SHRM)', asOf: '2026', method: 'screening-grade OPEX + staffing-resilience model; deterministic core (page Monte Carlo stays page-side)' },
            'dcMarket':               { source: 'Articles 16-17 SEA market screening: per-market operational/pipeline MW + absorption (Cushman & Wakefield/DC Byte/Knight Frank SEA 2025-26 reports; Johor 487 op/5800 pipe, Indonesia 1717 op), build cost $7-14M/MW, revenue $1.6-3.0M/MW·yr, opex ratios 55-65%, WACC 8-12%; demand-side: digital-economy growth (e-Conomy SEA), sovereign-AI programs, inference CAGR, enterprise migration shares', asOf: '2026', method: 'screening-grade supply/demand + NPV/IRR (Newton-Raphson) + heuristic 0-100 risk/opportunity scores; not investment advice' },
            'interconnect':           { source: 'Article-22 AI interconnect model: power per link by speed class (200G-1.6T; pluggable ~3.5W base scaled, CPO ~45% lower per Broadcom/NVIDIA CPO disclosures 2024-25), copper DAC reach limits 3/2/1/0 m by speed (IEEE 802.3 + SerDes reach practice), latency floors (copper ~5ns, CPO ~10ns, pluggable ~50ns with DSP), $/kWh electricity user input', asOf: '2026', method: 'screening-grade per-link power/latency/annual-cost comparison; not a network design' },
            'gridReserve':            { source: 'Article-25 PJM reserve-margin model: PJM 2026-27 BRA context (capacity ~180 GW, peak ~150 GW screening defaults), ELCC-derated renewable share of new-build 70% (PJM ELCC method), piecewise capacity-auction price curve calibrated to PJM BRA clearing history ($28 to $478+/MW-day), blackout-risk composite (margin 50% / deficit 30% / retirements 20%)', asOf: '2026', method: 'screening-grade adequacy model; not an RTO planning study' },
            'pue.partialLoad':        { source: 'Screening model: fixed infrastructure-overhead share 0.55 at partial IT load (industry rule-of-thumb band 0.4-0.7; Green Grid partial-load PUE guidance)', asOf: '2026', method: 'PUE(l) = 1 + overhead*(0.55/l + 0.45) — screening estimate, labeled' },
            'spares.acklam':          { source: 'P. J. Acklam (2003) rational approximation to the inverse normal CDF', asOf: '2026', method: 'numerical approximation; |relative error| < 1.15e-9 (upgraded from BSM 1977, |e|<4.5e-4, in the M2b precision pass)' }
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
                        spec: D.spec, /* poster-floor reference block (owner baseline) */
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
            /* ── A18: AI-factory infrastructure readiness (article-18 promoted;
             * rubric preserved EXACTLY — banded scoring, weighted composite,
             * $-rates in DATA.aiFactory). input {density,racks,cooling(air|dtc|
             * immersion),pue,elecRate($/kWh? NOTE: article uses $/kWh in MILLIONS
             * scaling below — kept verbatim),age,floorLoad,lcInfra(none|partial|full)}. */
            aiFactory: {
                readiness: function (inp) {
    var itLoadKW = inp.density * inp.racks;
    var itLoadMW = itLoadKW / 1000;
    var facPowerMW = itLoadMW * inp.pue;
    var annualEnergy = facPowerMW * 8760 * 1000 * inp.elecRate; // MW×h×1000 = kWh × $/kWh (A18 UNIT FIX: the article multiplied by 1e6 — a ×1000 overstatement, corrected here + on the page)

    // === 1. COOLING READINESS (35%) ===
    // Benchmark: AI racks need 40kW minimum, 130kW state-of-art (GB300 NVL72)
    var coolingMaxKW = inp.cooling === 'immersion' ? 400 : inp.cooling === 'dtc' ? 200 : 30;
    var coolScore;
    if (inp.cooling === 'air') {
        // Air cooling: hard limit ~30kW. Cannot serve AI racks above that.
        if (inp.density <= 10) coolScore = 18;
        else if (inp.density <= 20) coolScore = 14;
        else if (inp.density <= 30) coolScore = 10;
        else coolScore = 3; // physically impossible above 30kW
        // Partial/full LC infrastructure shows transition readiness
        if (inp.lcInfra === 'full') coolScore += 8;
        else if (inp.lcInfra === 'partial') coolScore += 4;
    } else if (inp.cooling === 'dtc') {
        // DTC: up to ~200kW. The 2025-2026 standard for AI deployments.
        if (inp.density <= coolingMaxKW) {
            var headroom = 1 - (inp.density / coolingMaxKW);
            coolScore = 62 + headroom * 20; // 62-82 based on headroom
        } else {
            coolScore = 30; // over-capacity
        }
        if (inp.lcInfra === 'full') coolScore = Math.min(100, coolScore + 12);
        else if (inp.lcInfra === 'partial') coolScore = Math.min(100, coolScore + 6);
        else coolScore = Math.max(0, coolScore - 18); // DTC without LC infrastructure
    } else { // immersion
        if (inp.density <= coolingMaxKW) {
            coolScore = 78 + Math.min(17, ((coolingMaxKW - inp.density) / coolingMaxKW) * 17);
        } else {
            coolScore = 40;
        }
        if (inp.lcInfra === 'full') coolScore = Math.min(100, coolScore + 8);
        else if (inp.lcInfra === 'partial') coolScore = Math.min(100, coolScore + 4);
        else coolScore = Math.max(0, coolScore - 22);
    }
    coolScore = Math.round(Math.max(0, Math.min(100, coolScore)));

    // === 2. STRUCTURAL READINESS (25%) ===
    // AI racks: 40kW class = ~1500 kg/m², 130kW class = ~2500 kg/m², 300kW+ = ~3500 kg/m²
    var structScore;
    var aiMinFloor = 1500, aiTargetFloor = 2500;
    if (inp.floorLoad >= aiTargetFloor) {
        structScore = 82 + Math.min(18, ((inp.floorLoad - aiTargetFloor) / 2500) * 18);
    } else if (inp.floorLoad >= aiMinFloor) {
        structScore = 38 + ((inp.floorLoad - aiMinFloor) / (aiTargetFloor - aiMinFloor)) * 44;
    } else if (inp.floorLoad >= 800) {
        structScore = 8 + ((inp.floorLoad - 800) / (aiMinFloor - 800)) * 30;
    } else {
        structScore = (inp.floorLoad / 800) * 8;
    }
    structScore = Math.round(Math.max(0, Math.min(100, structScore)));

    // === 3. POWER DENSITY READINESS (20%) ===
    // Below 15kW = traditional. 15-40kW = transition. 40-130kW = AI-capable. 130+ = cutting edge.
    var densityScore;
    if (inp.density >= 130) {
        densityScore = 88 + Math.min(12, (inp.density - 130) / 470 * 12);
    } else if (inp.density >= 40) {
        densityScore = 42 + ((inp.density - 40) / 90) * 46;
    } else if (inp.density >= 15) {
        densityScore = 8 + ((inp.density - 15) / 25) * 34;
    } else {
        densityScore = (inp.density / 15) * 8;
    }
    densityScore = Math.round(Math.max(0, Math.min(100, densityScore)));

    // === 4. PUE EFFICIENCY (10%) ===
    // AI-native target: PUE 1.10-1.25. Industry avg 1.58. Air-cooled legacy: 1.6-2.0
    var pueScore;
    if (inp.pue <= 1.08) pueScore = 100;
    else if (inp.pue <= 1.15) pueScore = 82 + ((1.15 - inp.pue) / 0.07) * 18;
    else if (inp.pue <= 1.30) pueScore = 55 + ((1.30 - inp.pue) / 0.15) * 27;
    else if (inp.pue <= 1.50) pueScore = 22 + ((1.50 - inp.pue) / 0.20) * 33;
    else if (inp.pue <= 1.80) pueScore = 5 + ((1.80 - inp.pue) / 0.30) * 17;
    else pueScore = Math.max(0, 5 - (inp.pue - 1.80) * 8);
    pueScore = Math.round(Math.max(0, Math.min(100, pueScore)));

    // === 5. AGE & ADAPTABILITY (10%) ===
    var ageScore;
    if (inp.age <= 1) ageScore = 95;
    else if (inp.age <= 3) ageScore = 78 + ((3 - inp.age) / 2) * 17;
    else if (inp.age <= 7) ageScore = 45 + ((7 - inp.age) / 4) * 33;
    else if (inp.age <= 15) ageScore = 12 + ((15 - inp.age) / 8) * 33;
    else if (inp.age <= 25) ageScore = ((25 - inp.age) / 10) * 12;
    else ageScore = 0;
    ageScore = Math.round(Math.max(0, Math.min(100, ageScore)));

    // === WEIGHTED COMPOSITE ===
    var W = DATA.aiFactory.weights;
    var overall = Math.round(coolScore * W.cooling + structScore * W.structural + densityScore * W.density + pueScore * W.pue + ageScore * W.age);
    overall = Math.max(0, Math.min(100, overall));

    var grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 50 ? 'C' : overall >= 30 ? 'D' : 'F';

    // OPEX estimate (annual)
    var OP = DATA.aiFactory.opex;
    var coolMaint = itLoadMW * (OP.coolMaintPerMwYr[inp.cooling] || OP.coolMaintPerMwYr.immersion);
    var staffing = Math.max(OP.staffingMinYr, itLoadMW * OP.staffingPerMwYr);
    var networkMaint = itLoadMW * OP.networkMaintPerMwYr;
    var insurance = itLoadMW * OP.insurancePerMwYr;
    var totalOPEX = annualEnergy + coolMaint + staffing + networkMaint + insurance;

    // Recommendation
    var recommend;
    if (overall >= 80) recommend = 'AI-Ready';
    else if (overall >= 62) recommend = 'Targeted Retrofit';
    else if (overall >= 42) recommend = 'Major Retrofit';
    else if (overall >= 22 && inp.age <= 15) recommend = 'Extensive Retrofit or New Build';
    else recommend = 'New Build Required';

    return {
        itLoadMW: itLoadMW, facPowerMW: facPowerMW, annualEnergy: annualEnergy,
        coolScore: coolScore, structScore: structScore, densityScore: densityScore,
        pueScore: pueScore, ageScore: ageScore, overall: overall, grade: grade,
        totalOPEX: totalOPEX, recommend: recommend
    };
},
                /** A23: GPU-campus build screening (article-23 promoted; math verbatim).
                 *  input {gpuCount, powerMw, buildDays, costPerGpu, powerCostKwh, pue}. */
                gpuBuild: function (inp) {
                    inp = inp || {};
                    var G = DATA.aiFactory.gpuBuild;
                    var gpuCount = inp.gpuCount || 100000, powerMw = inp.powerMw || 150;
                    var buildDays = inp.buildDays || G.colossusBenchmarkDays;
                    var costPerGpu = inp.costPerGpu || 30000;
                    var rate = inp.powerCostKwh != null ? inp.powerCostKwh : 0.08;
                    var pue = inp.pue || 1.3;
                    var gpuCost = gpuCount * costPerGpu;
                    var annualPower = powerMw * 1000 * rate * 8760;
                    var infraCost = powerMw * G.infraCostPerMw;
                    return {
                        gpuCapexUsd: gpuCost,
                        annualPowerUsd: annualPower,
                        speedVsColossusPct: (G.colossusBenchmarkDays / buildDays) * 100,
                        powerPerGpuKw: (powerMw * 1000) / gpuCount,
                        itPowerMw: powerMw / pue,
                        infraCostUsd: infraCost,
                        tco5yrUsd: gpuCost + annualPower * G.tcoYears + infraCost,
                        method: 'screening: infra $' + (G.infraCostPerMw / 1e6) + 'M/MW, ' + G.tcoYears + '-yr power, Colossus ' + G.colossusBenchmarkDays + '-day benchmark'
                    };
                },
            },
            /* ── A4: MTTR vendor-vs-inhouse (article-4 promoted). input p {category,
             * skillLevel(1-5), coverage('24_7'|'16_7'|'12_5'), spares(0-100 %),
             * vendorSLA(h), incidents/yr, callout($), retainer($/yr), training($),
             * costHour($), criticalPct(0-100)}. ── */
            mttr: {
                phases: function (p) {
                    var T = DATA.mttrResponse;
                    var base = T.categoryBase[p.category] || T.categoryBase.Electrical;
                    var sf = T.skillFactors[p.skillLevel] || 1.0;
                    var mob = T.coverageMobilizeHr[p.coverage] || 0.25;
                    var spareFactor = 1 + (100 - (p.spares == null ? 100 : p.spares)) / 100 * T.spareGapFactor;
                    return {
                        vendor:  { detect: base.detect, diagnose: base.diagnose, mobilize: p.vendorSLA, repair: base.repair, verify: base.verify },
                        inhouse: { detect: base.detect, diagnose: base.diagnose * sf, mobilize: mob, repair: base.repair * sf * spareFactor, verify: base.verify }
                    };
                },
                /** Full comparison + annual economics (deterministic core of the calculator). */
                compare: function (p) {
                    var T = DATA.mttrResponse;
                    var ph = RZEngine.models.mttr.phases(p);
                    var sum = function (x) { return x.detect + x.diagnose + x.mobilize + x.repair + x.verify; };
                    var vendorMTTR = sum(ph.vendor), inhouseMTTR = sum(ph.inhouse);
                    var vDown = vendorMTTR * p.incidents, iDown = inhouseMTTR * p.incidents;
                    var critW = (p.criticalPct == null ? 100 : p.criticalPct) / 100;
                    var effCostHour = p.costHour * critW + p.costHour * T.nonCriticalCostFactor * (1 - critW);
                    var downtimeSavings = (vDown - iDown) * effCostHour;
                    var vendorCosts = p.incidents * (p.callout || 0);
                    var retainerSavings = (p.retainer || 0) * T.retainerRecovery;
                    var netSavings = downtimeSavings + vendorCosts + retainerSavings - (p.training || 0);
                    var roiPct = p.training > 0 ? (netSavings / p.training) * 100 : 0;
                    var monthlyBenefit = (downtimeSavings + vendorCosts + retainerSavings) / 12;
                    return {
                        phases: ph, vendorMTTR: vendorMTTR, inhouseMTTR: inhouseMTTR,
                        vendorDowntimeHr: vDown, inhouseDowntimeHr: iDown,
                        effCostHour: effCostHour, netSavingsUsd: netSavings, roiPct: roiPct,
                        breakevenMonths: monthlyBenefit > 0 ? (p.training || 0) / monthlyBenefit : 99
                    };
                },
            },
            /* ── A5: technical-debt operational risk (article-5 promoted). ── */
            techDebt: {
                weibullHazard: function (t, beta, eta) { return t <= 0 ? 0 : (beta / eta) * Math.pow(t / eta, beta - 1); },
                /** Risk score 0-100 + 1/3/5-yr projections. input {items, avgAgeMonths,
                 * facilityAgeYears, criticalPct, majorPct}. */
                riskScore: function (inp) {
                    var T = DATA.techDebt;
                    var minorPct = Math.max(0, 100 - inp.criticalPct - inp.majorPct);
                    var cI = inp.items * inp.criticalPct / 100, mI = inp.items * inp.majorPct / 100;
                    var nI = inp.items - cI - mI;
                    var hazard = RZEngine.models.techDebt.weibullHazard(inp.avgAgeMonths, T.weibull.beta, T.weibull.etaMonths);
                    var baseRisk = (cI * T.weights.critical + mI * T.weights.major + nI * T.weights.minor) * hazard;
                    var facMult = 1 + inp.facilityAgeYears / T.facilityAgeDivisor;
                    var current = Math.min(100, baseRisk * facMult);
                    var g = 1 + T.riskGrowthPerYr;
                    return {
                        currentRisk: current, minorPct: minorPct, hazardRate: hazard, facilityMultiplier: facMult,
                        projected1: Math.min(100, current * g),
                        projected3: Math.min(100, current * Math.pow(g, 3)),
                        projected5: Math.min(100, current * Math.pow(g, 5))
                    };
                },
                /** Deferred-cost escalation + budget guidance. */
                escalation: function (items, avgCostUsd, avgAgeMonths) {
                    var A = DATA.techDebt.ageCost;
                    var factor = 1 + (avgAgeMonths / A.baseMonths) * A.factor;
                    var escalated = items * avgCostUsd * factor;
                    return { originalCostUsd: items * avgCostUsd, escalatedCostUsd: escalated, escalationPct: (factor - 1) * 100, recommendedBudgetUsd: escalated / 3 };
                },
                /** NPV of 5-yr deferral, inaction cost, break-even, 3-yr ROI, SLA + insurance deltas. */
                costRoi: function (items, avgCostUsd, annualRevenueUsd, riskScore) {
                    var T = DATA.techDebt;
                    var totalCost = items * avgCostUsd;
                    var npv = 0;
                    for (var y = 1; y <= 5; y++) npv += totalCost * Math.pow(1 + T.riskGrowthPerYr, y) / Math.pow(1 + T.discountRate, y);
                    var inactionCost = totalCost * (riskScore / 100) * T.inactionFactor;
                    var cumRisk = 0, breakEvenMonths = 60;
                    for (var m = 1; m <= 60; m++) { cumRisk += inactionCost / 12; if (cumRisk >= totalCost) { breakEvenMonths = m; break; } }
                    var band = T.insuranceBands.filter(function (b) { return riskScore >= b.min; })[0] || T.insuranceBands[T.insuranceBands.length - 1];
                    return {
                        npvUsd: npv, inactionCostUsd: inactionCost, breakEvenMonths: breakEvenMonths,
                        roi3yrPct: totalCost > 0 ? ((inactionCost * 3 - totalCost) / totalCost) * 100 : 0,
                        slaPenaltyUsd: annualRevenueUsd * T.slaPenaltyFactor * riskScore / 100,
                        insuranceDeltaUsd: totalCost * band.f
                    };
                },
                /** Age-adjusted Weibull parameter set (screening). */
                weibullParams: function (ageMonths, facAgeYears) {
                    var W = DATA.techDebt.weibull;
                    var beta = Math.min(W.betaCap, W.beta + (facAgeYears > W.facAgeBetaFromYr ? (facAgeYears - W.facAgeBetaFromYr) * W.betaAgePerYr : 0));
                    var eta = Math.max(W.etaFloorMonths, W.etaMonths - (facAgeYears > W.facAgeEtaFromYr ? (facAgeYears - W.facAgeEtaFromYr) * W.etaDecayPerYr : 0));
                    /* Lanczos gamma (g=7, n=9) — standard coefficients */
                    var gamma = function (z) {
                        var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
                        if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
                        z -= 1;
                        var x = c[0];
                        for (var i = 1; i < 9; i++) x += c[i] / (z + i);
                        var t = z + 7.5;
                        return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
                    };
                    return {
                        beta: beta, eta: eta, mttfMonths: eta * gamma(1 + 1 / beta),
                        reliability: Math.exp(-Math.pow(ageMonths / eta, beta)),
                        hazardTrend: beta > 1 ? 'Increasing' : beta === 1 ? 'Constant' : 'Decreasing',
                        b10Months: eta * Math.pow(-Math.log(0.9), 1 / beta)
                    };
                },
                /** Remediation-capacity screening (crew-months, phasing quarters). */
                capacity: function (items, criticalPct, majorPct) {
                    var R = DATA.techDebt.remediation;
                    var cI = items * criticalPct / 100, mI = items * majorPct / 100, nI = items - cI - mI;
                    var totalDays = cI * R.critDays + mI * R.majDays + nI * R.minDays;
                    var throughputPerQuarter = Math.floor(R.fte * R.workDaysPerMonth * 3 / R.avgDays);
                    return { crewMonths: totalDays / R.workDaysPerMonth, throughputPerQuarter: throughputPerQuarter, optPhasingQuarters: Math.ceil(items / Math.max(1, throughputPerQuarter)) };
                },
            },
            /* ── A6: RCA program effectiveness (article-6 promoted). input {incidents,
             * rcas, implRate(0-100), recurRate(0-100), days, daInvolve(0-100),
             * verifyRate(0-100)}. ── */
            rca: {
                effectivenessScore: function (inp) {
                    var W = DATA.rcaScore.weights;
                    var completion = Math.min((inp.rcas / Math.max(1, inp.incidents)) * 100, 100) * W.completion;
                    var implementation = inp.implRate * W.implementation;
                    var recurrence = (100 - inp.recurRate) * W.recurrence;
                    var time = Math.max(0, 1 - inp.days / DATA.rcaScore.timeTargetDays) * 100 * W.time;
                    var da = inp.daInvolve * W.designAuthority;
                    var verify = inp.verifyRate * W.verification;
                    return completion + implementation + recurrence + time + da + verify;
                },
            },
            /* ── A1: operations-maturity assessment (article-1 promoted). ── */
            opsMaturity: {
                /** vals = 1-5 per dimension (DATA order); weights optional override. */
                score: function (vals, weights) {
                    var dims = DATA.opsMaturity.dimensions;
                    var w = weights || dims.map(function (d) { return d.weight; });
                    var ws = 0;
                    for (var i = 0; i < vals.length; i++) ws += vals[i] * w[i];
                    return ((ws - 1) / 4) * 100;
                },
                label: function (score) {
                    var L = DATA.opsMaturity.levels;
                    for (var i = 0; i < L.length; i++) if (score <= L[i].max) return L[i];
                    return L[L.length - 1];
                },
                /** Deterministic risk translation (Uptime 2024 basis — screening). */
                riskExposure: function (score) {
                    var R = DATA.opsMaturity.risk;
                    var factor = Math.max(R.minFactor, 1 - score / R.maturityDivisor);
                    var outages = R.baseOutagesPerYr * factor;
                    var exposure = outages * R.avgOutageCostUsd;
                    var improvedFactor = Math.max(R.minFactor, 1 - (score + 10) / R.maturityDivisor);
                    return {
                        estOutagesPerYear: outages,
                        annualExposureUsd: exposure,
                        preventionValueUsd: exposure - R.baseOutagesPerYr * improvedFactor * R.avgOutageCostUsd,
                        riskLevel: score >= 80 ? 'LOW' : score >= 60 ? 'MODERATE' : score >= 40 ? 'ELEVATED' : 'HIGH'
                    };
                },
            },
            /* ── A2: ISA-18.2 alarm-management screening (article-2 promoted;
             * Poisson kernel reuses models.spares.poissonCdf — one implementation). ── */
            alarms: {
                /** Avg alarms per operator per 10-minute window. */
                ratePer10Min: function (totalDaily, operators, shiftHours) {
                    var shiftsPerDay = 24 / shiftHours;
                    var alarmsPerShift = totalDaily / shiftsPerDay;
                    return alarmsPerShift / (operators * shiftHours * DATA.alarmMgmt.windowsPerHour);
                },
                /** Operator utilization + performance degradation past the 70% knee. */
                cognitiveLoad: function (alarmsPerHour, responseTimeSec) {
                    var A = DATA.alarmMgmt;
                    var utilization = Math.min((alarmsPerHour * responseTimeSec) / 3600, 1.0);
                    var degradation = utilization > A.cognitiveKneeUtil ? 1 - Math.exp(-A.cognitiveDecayK * (utilization - A.cognitiveKneeUtil)) : 0;
                    return { utilizationPct: utilization * 100, degradationPct: degradation * 100, effectivePct: (1 - degradation) * 100 };
                },
                /** P(≥1 flood window per shift), Poisson arrivals (shared kernel). */
                floodProbability: function (avgDailyRate, threshold, windowMin, shiftHours) {
                    var lambda = avgDailyRate * (windowMin / 1440);
                    var pFloodPerWindow = 1 - RZEngine.models.spares.poissonCdf(threshold - 1, lambda);
                    var windowsPerShift = (shiftHours * 60) / windowMin;
                    return Math.min((1 - Math.pow(1 - pFloodPerWindow, windowsPerShift)) * 100, 100);
                },
                /** ISA-18.2 4-band compliance detail (25 pts each). */
                isaCompliance: function (rate, actionableRatio, criticalPct, standingPct) {
                    var rateScore = rate <= 1 ? 25 : rate <= 2 ? 15 : rate <= 5 ? 5 : 0;
                    var actScore = actionableRatio >= 0.85 ? 25 : actionableRatio >= 0.6 ? 15 : 5;
                    var critScore = criticalPct <= 0.05 ? 25 : criticalPct <= 0.1 ? 15 : criticalPct <= 0.2 ? 5 : 0;
                    var standScore = standingPct <= 0.1 ? 25 : standingPct <= 0.3 ? 15 : 5;
                    return { rate: rateScore, actionable: actScore, critical: critScore, standing: standScore, total: rateScore + actScore + critScore + standScore };
                },
                /** Erlang-C: probability an alarm waits (c operators, λ arrivals, μ service). */
                erlangC: function (lambda, mu, c) {
                    var rho = lambda / (c * mu);
                    if (rho >= 1) return 1;
                    var a = lambda / mu;
                    var sum = 0, fact = 1;
                    for (var k = 0; k < c; k++) { if (k > 0) fact *= k; sum += Math.pow(a, k) / fact; }
                    fact *= c;
                    var last = Math.pow(a, c) / fact * (1 / (1 - rho));
                    return last / (sum + last);
                },
                /** Composite ISA score (rate 50% + flood 30% + est. actionable 20%). */
                isaScore: function (dailyAlarms, operators, shiftHours) {
                    var windows = shiftHours * DATA.alarmMgmt.windowsPerHour;
                    var rate10 = dailyAlarms / (operators * 144);
                    var rateScore = rate10 <= 1.0 ? 100 : Math.max(0, 100 - (rate10 - 1.0) * 20);
                    var pFlood = Math.max(0, 1 - Math.pow(RZEngine.models.spares.poissonCdf(DATA.alarmMgmt.floodThresholdPer10Min - 1, rate10), windows));
                    var floodScore = pFlood <= 0.1 ? 100 : Math.max(0, 100 - (pFlood - 0.1) * 120);
                    var actionableEstimate = rate10 <= 1 ? 90 : Math.max(20, 90 - (rate10 - 1) * 15);
                    var actionableScore = actionableEstimate >= 85 ? 100 : (actionableEstimate / 85) * 100;
                    var W = DATA.alarmMgmt.scoreWeights;
                    var composite = rateScore * W.rate + floodScore * W.flood + actionableScore * W.actionable;
                    return { isa: Math.max(0, Math.min(100, composite)), flood: pFlood, rate: rate10 };
                },
            },
            /* ── A3: maintenance-compliance capacity model (article-3 promoted).
             * input p {tasks, techs, backlog, duration(h), hrsPerMonth, cmms(1-5),
             * friction(Low|Medium|High), evidence(Unclear|Adequate|Excellent),
             * wrenchPct(0-1)?, overheadPct(0-1)?, backlogAge(months)?, pro?}. ── */
            maintCompliance: {
                effectiveCapacity: function (p) {
                    var M = DATA.maintCompliance;
                    var raw = p.techs * p.hrsPerMonth;
                    var ff = M.frictionFactor[p.friction] || 0.70;
                    if (p.pro) return raw * ff * (p.wrenchPct || 0.35) * (1 - (p.overheadPct || 0.25));
                    return raw * ff;
                },
                demand: function (p) {
                    var B = DATA.maintCompliance.backlogWeight;
                    var backlogWeight = Math.min(B.cap, B.base + (p.backlogAge || 0) * B.perMonthAge);
                    return (p.tasks * p.duration) + ((p.backlog || 0) * p.duration * backlogWeight);
                },
                compliance: function (p) {
                    var M = DATA.maintCompliance;
                    var cap = RZEngine.models.maintCompliance.effectiveCapacity(p);
                    var dem = RZEngine.models.maintCompliance.demand(p);
                    var raw = Math.min(100, (cap / Math.max(1, dem)) * 100);
                    return Math.min(100, raw * (M.cmmsMult[p.cmms] || 0.80) * (M.evidenceMult[p.evidence] || 0.92));
                },
                /** Smallest tech headcount hitting target compliance (0-1). */
                techsForTarget: function (p, target) {
                    for (var t = 1; t <= 100; t++) {
                        var pp = Object.assign({}, p, { techs: t });
                        if (RZEngine.models.maintCompliance.compliance(pp) >= target * 100) return t;
                    }
                    return null;
                },
            },
            /* ── A7: reliability-vs-resilience assessment (article-7 promoted).
             * input p {redundancy('N'|'N+1'|'2N'|'2N+1'), drillFreq, responseTimeMin,
             * recovery, crossTrainPct(0-100), docCurrency, commPlan, lessons}. ── */
            resilience: {
                reliabilityScore: function (redundancy) {
                    var m = DATA.resilience.reliabilityMap;
                    return m[redundancy] != null ? m[redundancy] : m['N+1'];
                },
                /** Raw 0-100 dimension scores in DATA.resilience.weights order. */
                rawScores: function (p) {
                    var M = DATA.resilience.maps;
                    return [
                        M.drill[p.drillFreq] || 0,
                        Math.max(0, 1 - p.responseTimeMin / DATA.resilience.responseTargetMin) * 100,
                        M.recovery[p.recovery] || 0,
                        p.crossTrainPct || 0,
                        M.doc[p.docCurrency] || 0,
                        M.comm[p.commPlan] || 0,
                        M.lessons[p.lessons] || 0
                    ];
                },
                /** Weighted resilience score (rounded 0-100) from raw dimension scores. */
                score: function (rawScores) {
                    var w = DATA.resilience.weights, s = 0;
                    for (var i = 0; i < rawScores.length; i++) s += rawScores[i] * w[i];
                    return Math.round(s);
                },
                /** Full assessment: design reliability vs operational resilience + gap. */
                assess: function (p) {
                    var R = RZEngine.models.resilience;
                    var rel = R.reliabilityScore(p.redundancy);
                    var raw = R.rawScores(p);
                    var res = R.score(raw);
                    var gap = Math.abs(rel - res);
                    var B = DATA.resilience.gapBands;
                    return {
                        reliabilityScore: rel, rawScores: raw, resilienceScore: res, gap: gap,
                        gapClass: gap > B.critical ? 'critical' : gap >= B.warning ? 'warning' : 'balanced',
                        relTier: rel < 45 ? 'Tier I Equivalent' : rel < 65 ? 'Tier II Equivalent' : rel < 85 ? 'Tier III Equivalent' : 'Tier IV Equivalent',
                        resTier: res < 20 ? 'Stage 1: Reactive' : res < 40 ? 'Stage 2: Aware' : res < 65 ? 'Stage 3: Proactive' : res < 85 ? 'Stage 4: Adaptive' : 'Stage 5: Generative'
                    };
                },
            },
            /* ── A8: safety-culture health index (article-8 promoted). input v
             * {nearMiss(/mo), weakSignals(/mo), audit(open findings), training(hr/qtr),
             * walks(/mo), hazard(close %), meeting(freq label)}. ── */
            safetyCulture: {
                healthIndex: function (v) {
                    var S = DATA.safetyCulture, N = S.norms;
                    var dims = [
                        Math.min(100, (v.nearMiss / N.nearMissPerMonth) * 100),
                        Math.min(100, (v.weakSignals / N.weakSignalsPerMonth) * 100),
                        Math.max(0, (1 - v.audit / N.auditFindingsMax) * 100),
                        Math.min(100, (v.training / N.trainingHrsPerQuarter) * 100),
                        Math.min(100, (v.walks / N.walksPerMonth) * 100),
                        v.hazard,
                        S.meetingMap[v.meeting] || 0
                    ];
                    var total = 0;
                    for (var i = 0; i < dims.length; i++) total += dims[i] * S.weights[i];
                    return { dims: dims, total: total };
                },
                /** Rasmussen drift-to-failure probability (0-0.99) from incident-free days + SHI. */
                driftProbability: function (days, total) {
                    var Dr = DATA.safetyCulture.drift, drift;
                    if (days > Dr.shortDays && total < Dr.shortScore) drift = 0.6 + (days / 1000) * 0.3;
                    else if (days > Dr.longDays && total < Dr.longScore) drift = 0.3 + (days / 2000) * 0.3;
                    else drift = Math.max(0.05, 0.4 - total / 250);
                    return Math.min(drift, Dr.cap);
                },
                cultureLabel: function (total) {
                    return total >= 80 ? 'Generative' : total >= 55 ? 'Bureaucratic' : 'Pathological';
                },
            },
            /* ── A9: HVAC cooling-architecture TCO (article-9 promoted). ── */
            hvac: {
                /** Quick full-power PUE cost comparison (article free calculator). */
                simplePueCost: function (itLoadMw, rateUsdPerKwh) {
                    var P = DATA.hvacCooling.simplePue, hours = DATA.hoursPerYear;
                    var t = itLoadMw * 1000 * P.traditional * hours * rateUsdPerKwh;
                    var h = itLoadMw * 1000 * P.hybrid * hours * rateUsdPerKwh;
                    var d = itLoadMw * 1000 * P.dlc * hours * rateUsdPerKwh;
                    return {
                        traditional: t, hybrid: h, dlc: d,
                        savingsHybrid: t - h, savingsDLC: t - d,
                        co2ReductionPct: Math.round((1 - P.dlc / P.traditional) * 100)
                    };
                },
                /** Regional 10-yr TCO: traditional vs hybrid vs DLC (article pro model).
                 *  input {load(MW IT), rate($/kWh), regionKey}. Math preserved EXACTLY. */
                tco: function (input) {
                    var H = DATA.hvacCooling;
                    var region = H.regions[input.regionKey] || H.regions.indonesia;
                    var load = input.load, rate = input.rate;
                    var results = {};
                    ['traditional', 'hybrid', 'dlc'].forEach(function (arch) {
                        var cfg = H.configs[arch];
                        var pue = region[cfg.pueKey];
                        var capex = cfg.capexPerMW * load;
                        var annualEnergy = load * 1000 * (pue - 1) * 8760 * rate * cfg.opexFactor;
                        var annualMaint = cfg.maintenancePerMW * load;
                        var annualOpex = annualEnergy + annualMaint;
                        var npv = capex;
                        for (var y = 1; y <= H.tcoYears; y++) npv += annualOpex / Math.pow(1 + H.discountRate, y);
                        results[arch] = { capex: capex, annualEnergy: annualEnergy, annualMaint: annualMaint, annualOpex: annualOpex, npv10yr: npv, pue: pue };
                    });
                    var capexPremiumDLC = results.dlc.capex - results.traditional.capex;
                    var annualSavingsDLC = results.traditional.annualOpex - results.dlc.annualOpex;
                    results.paybackDLC = annualSavingsDLC > 0 ? capexPremiumDLC / annualSavingsDLC : 99;
                    var capexPremiumHybrid = results.hybrid.capex - results.traditional.capex;
                    var annualSavingsHybrid = results.traditional.annualOpex - results.hybrid.annualOpex;
                    results.paybackHybrid = annualSavingsHybrid > 0 ? capexPremiumHybrid / annualSavingsHybrid : 99;
                    results.irrDLC = annualSavingsDLC > 0 ? (annualSavingsDLC / capexPremiumDLC) * H.irrApproxFactor : 0;
                    results.savingsDLC10yr = results.traditional.npv10yr - results.dlc.npv10yr;
                    results.savingsHybrid10yr = results.traditional.npv10yr - results.hybrid.npv10yr;
                    var tradCoolingKWh = load * 1000 * (region.pueTraditional - 1) * 8760;
                    var dlcCoolingKWh = load * 1000 * (region.pueDLC - 1) * 8760 * H.coolingEnergyFactor.dlc;
                    var hybridCoolingKWh = load * 1000 * (region.pueHybrid - 1) * 8760 * H.coolingEnergyFactor.hybrid;
                    results.energySavingsDLC_kWh = tradCoolingKWh - dlcCoolingKWh;
                    results.energySavingsHybrid_kWh = tradCoolingKWh - hybridCoolingKWh;
                    results.carbonOffsetDLC = (results.energySavingsDLC_kWh / 1000) * region.co2Factor;
                    results.carbonOffsetHybrid = (results.energySavingsHybrid_kWh / 1000) * region.co2Factor;
                    var tradWaterGal = tradCoolingKWh * H.waterGalPerKwh.evaporative * region.waterFactor;
                    var dlcWaterGal = dlcCoolingKWh * H.waterGalPerKwh.dlc;
                    results.waterSavingsDLC = tradWaterGal - dlcWaterGal;
                    results.tradWaterGal = tradWaterGal; results.dlcWaterGal = dlcWaterGal;
                    var coolingCapacityKW = load * 1000 * (region.pueTraditional - 1);
                    results.lifecycleCostPerKW_trad = results.traditional.npv10yr / coolingCapacityKW;
                    results.lifecycleCostPerKW_dlc = results.dlc.npv10yr / coolingCapacityKW;
                    results.lifecycleCostPerKW_hybrid = results.hybrid.npv10yr / coolingCapacityKW;
                    results.coolingCapacityKW = coolingCapacityKW;
                    results.annualEnergySavingsDLC = results.traditional.annualEnergy - results.dlc.annualEnergy;
                    results.annualEnergySavingsHybrid = results.traditional.annualEnergy - results.hybrid.annualEnergy;
                    results.phasedDeploymentCost = results.dlc.capex * (1 + H.phasedOverheadPct);
                    results.fullDeploymentCost = results.dlc.capex;
                    results.phasedOverhead = results.dlc.capex * H.phasedOverheadPct;
                    results.retrainingCost = load * H.retrainPerMwUsd;
                    results.downtimeHoursPhased = Math.round(load * H.downtimeHrPerMw.phased);
                    results.downtimeHoursFull = Math.round(load * H.downtimeHrPerMw.full);
                    return results;
                },
            },
            /* ── A12: DC economic/community value model (article-12 promoted).
             * input {countryKey, capacityMw, dcType, renewableTarget('100'|'100_annual'|
             * '80'|'50'|'0'), pue, capacityFactor(0-1), projectYears, demandResponse}. ── */
            dcValue: {
                economicImpact: function (inp) {
                    var V = DATA.dcValue;
                    var cd = V.countries[inp.countryKey] || V.countries.indonesia;
                    var dt = V.dcTypes[inp.dcType] || V.dcTypes.hyperscale;
                    var renewablePct = inp.renewableTarget === '100' || inp.renewableTarget === '100_annual' ? 1.0
                        : inp.renewableTarget === '80' ? 0.8 : inp.renewableTarget === '50' ? 0.5 : 0;
                    var mw = inp.capacityMw, pue = inp.pue, cf = inp.capacityFactor, years = inp.projectYears;
                    var totalPowerMW = mw * pue;
                    var annualMWh = totalPowerMW * 8760 * cf;
                    var capex = mw * dt.capexPerMW * cd.capexMultiplier;
                    var annualOpex = capex * V.opexPctOfCapex;
                    var annualEnergyCost = annualMWh * cd.electricityRate;
                    var taxRevenue = (annualOpex + annualEnergyCost) * cd.taxRate;
                    var directJobs = Math.round(mw * dt.jobsPerMW * cd.jobMultiplier);
                    var indirectJobs = Math.round(directJobs * V.indirectJobsMult);
                    var directImpact = capex, indirectImpact = capex * V.indirectImpactMult, inducedImpact = capex * V.inducedImpactMult;
                    var totalEconomicImpact = (directImpact + indirectImpact + inducedImpact) + (annualOpex + annualEnergyCost) * years;
                    var overbuildFactor = inp.renewableTarget === '100' ? V.overbuild.cfe247 : V.overbuild.annual;
                    var ppaCapacityMW = Math.round(mw * overbuildFactor * renewablePct);
                    var ppaInvestmentValue = ppaCapacityMW * cd.ppaPrice * V.ppaYears / 1000000;
                    var gridSurplusAnnual = mw * V.gridSurplusPerMwYr;
                    var drCapacityPct = V.drCapacityPct[inp.demandResponse] || 0;
                    var drValueAnnual = mw * drCapacityPct * V.drValuePerMwYr;
                    var loadFactorBenefit = mw * 8760 * (cf - V.residentialLoadFactor) * V.loadFactorValuePerMwh;
                    var gridReliabilityImprovement = (mw / cd.gridCapacityGW / 1000) * 0.5;
                    var baselineEmissions = annualMWh * cd.carbonIntensity / 1000000;   // million tons
                    var actualEmissions = baselineEmissions * (1 - renewablePct);
                    var co2Avoided = baselineEmissions * renewablePct;
                    var treesEquivalent = co2Avoided * 1000000 / V.treeKgCo2PerYr;
                    var pueEfficiencyGain = ((V.industryAvgPUE - pue) / V.industryAvgPUE) * 100;
                    return {
                        renewablePct: renewablePct, totalPowerMW: totalPowerMW, annualMWh: annualMWh,
                        capex: capex, annualOpex: annualOpex, annualEnergyCost: annualEnergyCost, taxRevenue: taxRevenue,
                        directJobs: directJobs, indirectJobs: indirectJobs,
                        directImpact: directImpact, indirectImpact: indirectImpact, inducedImpact: inducedImpact,
                        totalEconomicImpact: totalEconomicImpact,
                        ppaCapacityMW: ppaCapacityMW, ppaInvestmentValue: ppaInvestmentValue,
                        gridSurplusAnnual: gridSurplusAnnual, drCapacityMW: mw * drCapacityPct, drValueAnnual: drValueAnnual,
                        loadFactorBenefit: loadFactorBenefit, gridReliabilityImprovement: gridReliabilityImprovement,
                        baselineEmissions: baselineEmissions, actualEmissions: actualEmissions,
                        co2Avoided: co2Avoided, treesEquivalent: treesEquivalent, pueEfficiencyGain: pueEfficiencyGain,
                        method: 'screening-grade economic/environmental impact (article-12 model)'
                    };
                },
            },
            /* ── A14: community cost/benefit impact (article-14 promoted). input
             * {mw, regionKey, cooling, pue, renewPct(0-1), taxLevel, engagement,
             * genType, wasteHeat, rateProt, waterStrat, constYears}. ── */
            communityImpact: {
                assess: function (inp) {
                    var C = DATA.communityImpact;
                    var rd = C.regions[inp.regionKey] || C.regions.virginia;
                    var mw = Math.max(1, inp.mw), pue = inp.pue, renewPct = inp.renewPct;
                    var totalPowerMW = mw * pue;
                    var annualMWh = totalPowerMW * 8760 * C.utilization;
                    var annualEnergyCost = annualMWh * rd.eRate;
                    var capex = mw * C.capexPerMwUsd * rd.capexM;
                    var gridLoadPct = (totalPowerMW / (rd.gridGW * 1000)) * 100;
                    var billIncrease = (gridLoadPct / 100) * rd.avgBill * (1 - renewPct * 0.3) * (C.rateProtect[inp.rateProt] != null ? C.rateProtect[inp.rateProt] : 1.0);
                    var waterML = mw * (C.coolingWaterMlPerMwYr[inp.cooling] || 0) * (C.waterStrategy[inp.waterStrat] != null ? C.waterStrategy[inp.waterStrat] : 1.0);
                    var waterHouseholds = Math.round((waterML * 1000000) / (rd.householdWaterL * 365));
                    var numGenerators = Math.ceil(totalPowerMW / C.genUnitMw);
                    var annualNoxTons = (numGenerators * (C.genNoxKgPerHr[inp.genType] || 0) * (C.genHoursYear[inp.genType] || 0)) / 1000;
                    var healthCostAnnual = annualNoxTons * C.healthCostPerTonNox * rd.waterStress;
                    var noiseMitigation = C.noiseMitigationDb[inp.engagement] || 0;
                    var noise = Math.max(35, (C.coolingNoiseDb[inp.cooling] || 60) - noiseMitigation);
                    var taxRetainF = C.taxRetain[inp.taxLevel] != null ? C.taxRetain[inp.taxLevel] : 1.0;
                    var foregoneTax = capex * rd.taxRate * (1 - taxRetainF);
                    var actualTaxRev = capex * rd.taxRate * taxRetainF + (annualEnergyCost * 0.05);
                    var constJobsTotal = Math.round(mw * C.constJobsPerMW * rd.jobM / inp.constYears);
                    var directJobs = Math.round(mw * C.permJobsPerMW * rd.jobM);
                    var totalJobs = Math.round(directJobs * C.jobsMultiplier) + Math.round(constJobsTotal * 0.3);
                    var reCapacity = Math.round(mw * renewPct * C.renewOverbuild);
                    var co2Avoided = Math.round(reCapacity * 8760 * C.renewCapFactor * rd.carbonKg / 1000);
                    var wasteHeatAnnual = mw * (C.wasteHeatValPerMw[inp.wasteHeat] || 0) * (pue - 1) / 0.4;
                    var gdpContrib = mw * C.gdpPerMwUsd * rd.capexM;
                    var costScore = 0;
                    costScore -= Math.min(billIncrease * 5, 20);
                    costScore -= Math.min(waterML * rd.waterStress * 0.02, 15);
                    costScore -= Math.min(annualNoxTons * 0.3, 15);
                    costScore -= (noise > 55 ? 12 : noise > 50 ? 6 : noise > 45 ? 2 : 0);
                    costScore -= Math.min(foregoneTax / 10000000, 12);
                    costScore -= Math.min(gridLoadPct * 2, 10);
                    costScore -= (inp.rateProt === 'none' ? 8 : inp.rateProt === 'standard' ? 4 : 0);
                    var benefitScore = 0;
                    benefitScore += Math.min(actualTaxRev / 5000000, 20);
                    benefitScore += Math.min(directJobs * 0.12, 10);
                    benefitScore += Math.min(constJobsTotal * 0.005, 8);
                    benefitScore += Math.min(reCapacity * 0.04, 12);
                    benefitScore += Math.min(co2Avoided * 0.00005, 8);
                    benefitScore += Math.min(wasteHeatAnnual / 2000000, 10);
                    benefitScore += Math.min(gdpContrib / 50000000, 12);
                    benefitScore += (C.cbaFactor[inp.engagement] || 0);
                    var netScore = Math.max(-100, Math.min(100, Math.round(costScore + benefitScore)));
                    return {
                        billIncrease: billIncrease, waterML: waterML, waterHouseholds: waterHouseholds,
                        annualNoxTons: annualNoxTons, healthCostAnnual: healthCostAnnual, noiseDb: noise,
                        gridLoadPct: gridLoadPct, foregoneTax: foregoneTax,
                        actualTaxRev: actualTaxRev, constJobsTotal: constJobsTotal, directJobs: directJobs,
                        totalJobs: totalJobs, reCapacityMW: reCapacity, co2AvoidedTons: co2Avoided,
                        wasteHeatAnnual: wasteHeatAnnual, gdpContrib: gdpContrib,
                        costScore: costScore, benefitScore: benefitScore, netScore: netScore,
                        method: 'screening-grade community net-score (article-14 model)'
                    };
                },
            },
            /* ── A15: ops budget + staffing resilience (article-15 promoted). input
             * {countryKey, loadMW, pue, staffModelKey, retention(0-100), pmRatio(0-100)}. ── */
            opsBudget: {
                opex: function (inp) {
                    var O = DATA.opsBudget;
                    var r = O.countries[inp.countryKey] || O.countries['US-Virginia'];
                    var sm = O.staffModels[inp.staffModelKey] || O.staffModels.inhouse;
                    var loadKW = inp.loadMW * 1000;
                    var energyCostUSD = loadKW * inp.pue * r.energyRate * 8760 * r.fxToUSD;
                    var baseFTE = Math.ceil(inp.loadMW * sm.ftePerMW);
                    var shiftFTE = Math.ceil(baseFTE * O.shiftMult);
                    var laborRateUSD = r.laborRate * r.fxToUSD;
                    var burdenedRate = laborRateUSD * O.laborBurden;
                    var laborBudget = shiftFTE * burdenedRate * sm.costMult;
                    var maintBudget = inp.loadMW * O.maintPerMwUsd * r.tropFactor;
                    var pmEfficiency = 1.0 - (inp.pmRatio / 100 - O.pmBaseline) * O.pmSavingsSlope;
                    maintBudget = maintBudget * pmEfficiency;
                    var totalOpex = energyCostUSD + laborBudget + maintBudget;
                    var CV = O.cashVariance;
                    var cashVariance = Math.max(CV.floorPct, CV.basePct - (inp.pmRatio / 100 - O.pmBaseline) * CV.reductionSlope);
                    var maintCapex = maintBudget * O.maintCapexShare;
                    var ffo = totalOpex * O.ffoFactor;
                    return {
                        energyCost: energyCostUSD, laborBudget: laborBudget, maintBudget: maintBudget,
                        totalOpex: totalOpex, opexPerMW: totalOpex / inp.loadMW, costPerKW: totalOpex / (loadKW * 12),
                        cashVariance: cashVariance, affo: ffo - maintCapex,
                        baseFTE: baseFTE, shiftFTE: shiftFTE, laborRateUSD: laborRateUSD,
                        burdenedRate: burdenedRate, maintCapex: maintCapex
                    };
                },
                staffing: function (inp, opex) {
                    var O = DATA.opsBudget;
                    var sm = O.staffModels[inp.staffModelKey] || O.staffModels.inhouse;
                    var U = O.utilization, headcount = opex.shiftFTE;
                    var baseUtil = U.base + (inp.loadMW / 100) * (U.perLoadMw * 100);
                    var utilization = Math.max(U.min, Math.min(U.max, baseUtil * sm.qualityMult));
                    var burnoutProb = 1.0 / (1.0 + Math.exp(-O.burnout.k * (utilization - O.burnout.midUtil))) * 100;
                    var inhouseCost = opex.burdenedRate * O.shiftMult;
                    var outsourcedCost = opex.burdenedRate * O.shiftMult * O.outsourcedCostFactor;
                    var breakevenFTE = Math.max(1, Math.round(O.mgmtOverheadPerFteUsd / (inhouseCost - outsourcedCost)));
                    var turnoverRate = (100 - inp.retention) / 100;
                    var retentionCost = Math.round(headcount * turnoverRate * (opex.laborRateUSD * O.replacementCostFactor));
                    var spof = Math.max(0, Math.round(Math.max(0, O.spof.base - headcount * O.spof.perHeadcount) + (100 - inp.retention) / O.spof.retentionDiv));
                    var W = O.sriWeights;
                    var sri = Math.max(0, Math.min(100,
                        (inp.retention * W.retention) + ((100 - burnoutProb) * W.burnout) +
                        (inp.pmRatio * W.pm) + (sm.qualityMult * 100 * W.quality) - (spof * W.spofPenalty)));
                    var hep = O.hepBase * (1 + (burnoutProb / 100) * 0.5) * (1 + turnoverRate * 0.3) * (2.0 - sm.qualityMult);
                    return {
                        headcount: headcount, utilization: utilization, burnoutProb: burnoutProb,
                        breakevenFTE: breakevenFTE, retentionCost: retentionCost, spof: spof,
                        resilienceIdx: Math.round(sri), hep: hep
                    };
                },
            },
            /* ── A16/A17: SEA DC market screening (articles 16+17 promoted). ── */
            dcMarket: {
                /** Bubble-risk model (article-16). input {op,pipe,pop,absorb,
                 *  precommit(0-1),spec(0-1),demandGrowth(0-1),costMW($M),revMW($M/yr),
                 *  opexRatio(0-1),wacc(0-1)}. Math preserved EXACTLY. */
                bubbleRisk: function (i) {
                    var B = DATA.dcMarket.bubble;
                    var newCapacity = i.pipe - i.op;
                    var sdRatio = (newCapacity > 0) ? i.pipe / (i.absorb * B.supplyYears) : 1;
                    var yearsAbsorb = newCapacity / Math.max(1, i.absorb);
                    var threeYrAbsorb = i.absorb * B.absorbWindowYears;
                    var actualVacancy = Math.max(B.vacancyMin, Math.min(B.vacancyMax, (1 - (threeYrAbsorb / Math.max(1, newCapacity * B.vacancyShare))) * B.vacancyScale));
                    var specMW = newCapacity * i.spec;
                    var capitalRisk = specMW * i.costMW;
                    var totalCapex = newCapacity * i.costMW;
                    var breakeven = i.opexRatio * 100 + (i.spec * B.breakevenSpecSlope);
                    var avgOccupancy = Math.max(B.occMin, B.occBase - (sdRatio * B.occSlope)) / 100;
                    var annualRev = i.revMW * i.pipe * avgOccupancy;
                    var annualEBITDA = annualRev * (1 - i.opexRatio);
                    var paybackYears = annualEBITDA > 0 ? totalCapex / annualEBITDA : 99;
                    var npv = -totalCapex;
                    for (var yr = 1; yr <= B.npvYears; yr++) {
                        var occYear = yr <= B.rampYears ? (B.rampStartOcc + (avgOccupancy - B.rampStartOcc) * (yr / B.rampYears)) : avgOccupancy;
                        npv += i.revMW * i.pipe * occYear * (1 - i.opexRatio) / Math.pow(1 + i.wacc, yr);
                    }
                    var RC = B.riskCaps, RS = B.riskSlopes;
                    var riskScore = 0;
                    riskScore += Math.min(RC.sd, sdRatio * RS.sd);
                    riskScore += Math.min(RC.spec, i.spec * RS.spec);
                    riskScore += Math.min(RC.precommit, (1 - i.precommit) * RS.precommit);
                    riskScore += Math.min(RC.absorb, Math.max(0, yearsAbsorb - RS.absorbYears) * RS.absorbSlope);
                    riskScore += Math.min(RC.payback, Math.max(0, paybackYears - RS.paybackYears) * RS.paybackSlope);
                    riskScore = Math.min(100, Math.max(0, riskScore));
                    return {
                        sdRatio: sdRatio, yearsAbsorb: yearsAbsorb, actualVacancy: actualVacancy,
                        specMW: specMW, capitalRisk: capitalRisk, totalCapex: totalCapex,
                        breakeven: breakeven, avgOccupancy: avgOccupancy, annualRev: annualRev,
                        annualEBITDA: annualEBITDA, paybackYears: paybackYears,
                        pipePerPop: i.pop > 0 ? i.pipe / i.pop : 0, npv: npv, riskScore: riskScore,
                        newCapacity: newCapacity, threeYrAbsorb: threeYrAbsorb
                    };
                },
                /** Opportunity model (article-17). input {op,pipe,pop,digiGrowth(0-1),
                 *  sovDemand(MW),infCAGR(0-1),entMigration(0-1),buildCost($M/MW),
                 *  revMW($M/yr),opexRatio(0-1),wacc(0-1)}. Math preserved EXACTLY
                 *  (incl. Newton-Raphson IRR). */
                opportunity: function (i) {
                    var Op = DATA.dcMarket.opportunity, yr, occYear, cf;
                    var baselineDemand = i.op;
                    var digiDemandGrowth = i.op * (Math.pow(1 + i.digiGrowth, Op.horizonYears) - 1) * Op.digiCapture;
                    var entDemand = i.pipe * i.entMigration * Op.entCapture;
                    var infDemand = i.op * Op.infBaseShare * Math.pow(1 + i.infCAGR, Op.horizonYears);
                    var totalDemand = baselineDemand + digiDemandGrowth + entDemand + infDemand + i.sovDemand;
                    var uncounted = entDemand + infDemand + i.sovDemand;
                    var utilization = Math.min(Op.utilizationCap, (totalDemand / i.pipe) * 100);
                    var deficit = totalDemand - i.pipe;
                    var wattsPerCapita = ((i.op + i.pipe) * 1000000) / (i.pop * 1000000);
                    var yearsToFill = i.pipe > 0 ? (i.pipe - i.op) / ((totalDemand - i.op) / Op.horizonYears) : 0;
                    var totalCapex = i.pipe * i.buildCost;
                    var stabilizedOcc = Math.min(Op.occMax, Math.max(Op.occMin, (totalDemand / i.pipe) * Op.occFactor));
                    var annualRevStabilized = i.revMW * i.pipe * stabilizedOcc;
                    var annualEBITDA = annualRevStabilized * (1 - i.opexRatio);
                    var npv = -totalCapex;
                    for (yr = 1; yr <= Op.npvYears; yr++) {
                        occYear = yr <= Op.rampYears ? (Op.rampStartOcc + (stabilizedOcc - Op.rampStartOcc) * (yr / Op.rampYears)) : stabilizedOcc;
                        npv += i.revMW * i.pipe * occYear * (1 - i.opexRatio) / Math.pow(1 + i.wacc, yr);
                    }
                    var irr = 0.10;
                    for (var iter = 0; iter < 50; iter++) {
                        var npvTest = -totalCapex, dnpv = 0;
                        for (yr = 1; yr <= Op.npvYears; yr++) {
                            occYear = yr <= Op.rampYears ? (Op.rampStartOcc + (stabilizedOcc - Op.rampStartOcc) * (yr / Op.rampYears)) : stabilizedOcc;
                            cf = i.revMW * i.pipe * occYear * (1 - i.opexRatio);
                            npvTest += cf / Math.pow(1 + irr, yr);
                            dnpv -= yr * cf / Math.pow(1 + irr, yr + 1);
                        }
                        if (Math.abs(dnpv) < 0.001) break;
                        irr = irr - npvTest / dnpv;
                        if (irr < -0.5) { irr = -0.5; break; }
                        if (irr > 2) { irr = 2; break; }
                    }
                    var cumulCF = -totalCapex, payback = 10;
                    for (yr = 1; yr <= 15; yr++) {
                        occYear = yr <= Op.rampYears ? (Op.rampStartOcc + (stabilizedOcc - Op.rampStartOcc) * (yr / Op.rampYears)) : stabilizedOcc;
                        cf = i.revMW * i.pipe * occYear * (1 - i.opexRatio);
                        cumulCF += cf;
                        if (cumulCF >= 0) { payback = yr - (cumulCF / cf); break; }
                    }
                    var numFacilities = i.pipe / Op.facilityMw;
                    var jobsConstruct = Math.round(numFacilities * Op.jobsConstructPerFacility);
                    var jobsPerm = Math.round(numFacilities * Op.jobsPermPerFacility);
                    var SC = Op.scoreCaps, SS = Op.scoreSlopes;
                    var oppScore = 0;
                    oppScore += Math.min(SC.util, utilization * SS.util);
                    oppScore += Math.min(SC.digi, i.digiGrowth * SS.digi);
                    oppScore += Math.min(SC.sov, (i.sovDemand / Math.max(1, i.pipe)) * SS.sov);
                    oppScore += Math.min(SC.inf, i.infCAGR * SS.inf);
                    oppScore += Math.min(SC.ent, i.entMigration * SS.ent);
                    oppScore = Math.min(100, Math.max(0, oppScore));
                    return {
                        totalDemand: totalDemand, uncounted: uncounted, utilization: utilization, deficit: deficit,
                        baselineDemand: baselineDemand, digiDemandGrowth: digiDemandGrowth, entDemand: entDemand,
                        infDemand: infDemand, sovTotal: i.sovDemand,
                        wattsPerCapita: wattsPerCapita, yearsToFill: yearsToFill,
                        totalCapex: totalCapex, annualRevStabilized: annualRevStabilized, annualEBITDA: annualEBITDA,
                        npv: npv, irr: irr, payback: payback, stabilizedOcc: stabilizedOcc,
                        jobsConstruct: jobsConstruct, jobsPerm: jobsPerm, jobsEco: Math.round(jobsPerm * Op.jobsEcoMult),
                        taxRevenue: annualRevStabilized * Op.taxRevFactor, oppScore: oppScore
                    };
                },
            },
            /* ── A22: AI interconnect comparison (article-22 promoted). input
             * {gpuCount, gpuPerRack, portSpeedG(200|400|800|1600), linkDistM,
             * elecCostKwh}. Math preserved EXACTLY. ── */
            interconnect: {
                compare: function (inp) {
                    var I = DATA.interconnect;
                    var links = inp.gpuCount;
                    var racks = Math.ceil(inp.gpuCount / inp.gpuPerRack);
                    var sf = I.speedFactor[inp.portSpeedG] || I.speedFactor[800];
                    var copperMaxReach = I.copper.reachM[inp.portSpeedG] != null ? I.copper.reachM[inp.portSpeedG] : 1;
                    var copperPowerPerLink = I.copper.wattsBase * sf;
                    var copperViable = inp.linkDistM <= copperMaxReach;
                    var copperLatencyNs = copperViable ? I.copper.latencyNsAtReach * (inp.linkDistM / copperMaxReach) : I.copper.latencyUnviableNs;
                    var plugMaxReach = I.pluggable.reachM[inp.portSpeedG] != null ? I.pluggable.reachM[inp.portSpeedG] : 100;
                    var plugPowerPerLink = I.pluggable.wattsBase * sf * I.pluggable.efficiency;
                    var plugViable = inp.linkDistM <= plugMaxReach;
                    var plugLatencyNs = I.pluggable.latencyBaseNs + (inp.linkDistM * I.pluggable.latencyPerMNs);
                    var cpoPowerPerLink = I.cpo.wattsBase * sf * I.cpo.efficiency;
                    var cpoViable = inp.linkDistM <= I.cpo.reachM;
                    var cpoLatencyNs = I.cpo.latencyBaseNs + (inp.linkDistM * I.cpo.latencyPerMNs);
                    var kwhFactor = 8760 * inp.elecCostKwh / 1000;
                    return {
                        links: links, racks: racks, speedFactor: sf,
                        copper: { powerPerLinkW: copperPowerPerLink, maxReachM: copperMaxReach, viable: copperViable, latencyNs: copperLatencyNs, annualCostUsd: copperViable ? links * copperPowerPerLink * kwhFactor : 0 },
                        pluggable: { powerPerLinkW: plugPowerPerLink, maxReachM: plugMaxReach, viable: plugViable, latencyNs: plugLatencyNs, annualCostUsd: plugViable ? links * plugPowerPerLink * kwhFactor : 0 },
                        cpo: { powerPerLinkW: cpoPowerPerLink, maxReachM: I.cpo.reachM, viable: cpoViable, latencyNs: cpoLatencyNs, annualCostUsd: cpoViable ? links * cpoPowerPerLink * kwhFactor : 0 },
                        method: 'screening-grade per-link power/latency/cost (article-22 model)'
                    };
                },
            },
            /* ── A25: grid reserve-margin adequacy (article-25 promoted). input
             * {capacity(GW), peakDemand(GW), retirements(GW), newGen(GW), dcGrowth(GW),
             * otherGrowth(GW), reserveTarget(%), elcc(%)}. Math preserved EXACTLY. ── */
            gridReserve: {
                adequacy: function (inp) {
                    var G = DATA.gridReserve;
                    var elcc = inp.elcc / 100;
                    var dispatchableNew = inp.newGen * (1 - G.renewableShareOfNew);
                    var renewableNew = inp.newGen * G.renewableShareOfNew * elcc;
                    var effectiveNewGen = dispatchableNew + renewableNew;
                    var netAvailable = inp.capacity - inp.retirements + effectiveNewGen;
                    var peakDemand = inp.peakDemand + inp.dcGrowth + inp.otherGrowth;
                    var reserveMargin = ((netAvailable - peakDemand) / peakDemand) * 100;
                    var requiredCapacity = peakDemand * (1 + inp.reserveTarget / 100);
                    var surplusDeficit = netAvailable - requiredCapacity;
                    var R = G.risk;
                    var marginGap = inp.reserveTarget - reserveMargin;
                    var riskFromMargin = Math.min(100, Math.max(0, marginGap * R.marginSlope));
                    var riskFromDeficit = surplusDeficit < 0 ? Math.min(100, Math.abs(surplusDeficit) * R.deficitSlope) : 0;
                    var riskFromRetirements = Math.min(R.retireCap, (inp.retirements / inp.capacity) * 100);
                    var blackoutRisk = Math.min(100, Math.round(riskFromMargin * R.wMargin + riskFromDeficit * R.wDeficit + riskFromRetirements * R.wRetire));
                    var auctionPrice = null;
                    for (var c = 0; c < G.auctionCurve.length; c++) {
                        var band = G.auctionCurve[c];
                        if (reserveMargin >= band.minMargin) { auctionPrice = band.base + (band.pivot - reserveMargin) * band.slope; break; }
                    }
                    if (auctionPrice == null) { var last = G.auctionCurve[G.auctionCurve.length - 1]; auctionPrice = last.base + (last.pivot - reserveMargin) * last.slope; }
                    var annualCost = (auctionPrice * netAvailable * 1000 * 365) / 1e9;
                    var baselineCost = (G.baseline.priceMwDay * G.baseline.capacityGW * 1000 * 365) / 1e9;
                    return {
                        netAvailable: netAvailable, peakDemand: peakDemand,
                        reserveMargin: reserveMargin, surplusDeficit: surplusDeficit,
                        blackoutRisk: blackoutRisk, dcShare: (inp.dcGrowth / peakDemand) * 100,
                        auctionPrice: auctionPrice, costImpact: annualCost - baselineCost,
                        annualCost: annualCost, effectiveNewGen: effectiveNewGen,
                        effectiveRetirements: inp.retirements,
                        method: 'screening-grade reserve-margin adequacy (article-25 model)'
                    };
                },
            },
            /* ── A11: residential bill-impact screening (article-11 promoted) ── */
            gridImpact: {
                /** Screening model: what one DC campus does to a citizen's power bill.
                 *  input {countryKey, targetYear?, householdMonthlyKwh?, dcCapacityMw?}.
                 *  Math preserved EXACTLY from the article calculator (screening-grade:
                 *  40% infra-cost pass-through to residential, IEA 15%/yr growth). */
                residentialBillImpact: function (input) {
                    input = input || {};
                    var G = DATA.gridImpact;
                    var c = G.countries[input.countryKey] || G.countries.indonesia;
                    var year = input.targetYear != null ? input.targetYear : G.baseYear;
                    var hhKwh = input.householdMonthlyKwh != null ? input.householdMonthlyKwh : 200;
                    var mw = input.dcCapacityMw != null ? input.dcCapacityMw : 500;
                    var yearsFromNow = year - G.baseYear;
                    var cf = G.capacityFactor;
                    var dcAnnualGWh = (mw * cf * DATA.hoursPerYear) / 1000;
                    var householdsEquiv = Math.round((mw * 1000 * cf * 730) / c.avgHouseholdKwh); // monthly basis
                    var growthFactor = Math.pow(1 + G.annualGrowth, yearsFromNow) * c.growthMultiplier;
                    var baseIncreasePct = (mw / (c.nationalGridGW * 1000)) * 100 * G.passThroughShare;
                    var projectedIncreasePct = baseIncreasePct * growthFactor;
                    var currentMonthlyBillLocal = hhKwh * c.residentialTariff;
                    var monthlyImpactLocal = currentMonthlyBillLocal * (projectedIncreasePct / 100);
                    var monthlyImpactUsd = monthlyImpactLocal / c.usdRate;
                    var gridLoadIncreasePct = (mw / (c.nationalGridGW * 1000)) * 100;
                    return {
                        country: c.name, currency: c.currency,
                        dcAnnualGWh: dcAnnualGWh,
                        householdsEquiv: householdsEquiv,
                        projectedIncreasePct: projectedIncreasePct,
                        monthlyImpactLocal: monthlyImpactLocal,
                        monthlyImpactUsd: monthlyImpactUsd,
                        annualImpactUsd: monthlyImpactUsd * 12,
                        gridLoadIncreasePct: gridLoadIncreasePct,
                        method: 'screening: ' + Math.round(G.passThroughShare * 100) + '% infra pass-through to residential, IEA ' + Math.round(G.annualGrowth * 100) + '%/yr DC growth'
                    };
                }
            },
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
                    /* M2c: convergence thresholds SCALE with cashflow magnitude so a
                     * $B-scale series converges as precisely as a $K-scale one. */
                    var scale = 0;
                    for (var s0 = 0; s0 < cashflows.length; s0++) scale = Math.max(scale, Math.abs(cashflows[s0] || 0));
                    if (!scale) return null;
                    var fTol = 1e-12 * scale;
                    var r = (guess != null ? guess : 0.1);
                    for (var k = 0; k < 60; k++) {
                        var f = npv(r), d = dnpv(r);
                        if (Math.abs(f) < fTol) return r;
                        if (!isFinite(d) || Math.abs(d) < 1e-300) break;
                        var step = f / d;
                        r = r - step;
                        if (r <= -0.999) { r = -0.999; }
                        if (Math.abs(step) < 1e-12) return (Math.abs(npv(r)) < 1e-9 * scale) ? r : bracket();
                    }
                    return bracket();
                    // Bisection fallback over [-0.99, 10] when Newton fails to converge.
                    function bracket() {
                        var lo = -0.99, hi = 10, fLo = npv(lo), fHi = npv(hi);
                        if (fLo * fHi > 0) return null;
                        for (var i = 0; i < 200; i++) {
                            var mid = (lo + hi) / 2, fMid = npv(mid);
                            if (Math.abs(fMid) < fTol || (hi - lo) < 1e-12) return mid;
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

                /** AACE 18R-97 estimate class → accuracy range + a $ low/high band
                 *  for a point estimate. Defaults to the engine's Class-4 budgetary
                 *  maturity. (v2.5.0) */
                accuracyRange: function (pointEstimate, estimateClass) {
                    var cls = DATA.aace.classes[String(estimateClass || DATA.aace.engineClass)] || DATA.aace.classes['4'];
                    var p = pointEstimate || 0;
                    return { class: cls.label, method: cls.method, lowPct: cls.low, highPct: cls.high, low: Math.round(p * (1 + cls.low)), point: Math.round(p), high: Math.round(p * (1 + cls.high)) };
                },

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
                    /* v2.5.1 basis presets (Phase Q alignment): utilization scales the
                     * ENERGY-driven lines (power/water/carbon). Default 1.0 keeps every
                     * existing caller bit-identical. basisPreset: 'dcContract'|'retailScreening'. */
                    var basisPreset = opts.basisPreset && DATA.opex.basisPresets && DATA.opex.basisPresets[opts.basisPreset];
                    var util = opts.utilization != null ? Math.max(0.05, Math.min(1, opts.utilization))
                             : (basisPreset ? basisPreset.utilization : 1.0);
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
                    if (util !== 1.0) power = Math.round(power * util);
                    var staffing = RZEngine.models.opex.staffingCostAnnual(headcount || 0, region);
                    var contract = RZEngine.models.opex.contractCostAnnual(opts.contractScope || DATA.opexDefaults.contractScope, region);

                    // A6-53: capex-omission guard — maintenance is 0 without a capex basis; surface a warning.
                    var capexBase = opts.capex || 0;
                    var warning = null;
                    if (!capexBase && opts.warn) warning = 'maintenance=0: no opts.capex basis provided';
                    var maintenance = Math.round(capexBase * (opts.maintenancePct != null ? opts.maintenancePct : DATA.opexDefaults.maintenancePct));

                    // A6-54: new line items
                    var itKwh = (mw || 0) * 1000 * hrs * util;
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
                offsetCost: function (tonnes) { return Math.round((tonnes || 0) * DATA.carbon.offsetPrice); },
                /** GHG-Protocol scope 1/2/3 annual breakdown (tCO₂e). Scope 1 =
                 *  generator diesel combustion at test/outage hours + refrigerant
                 *  leak; scope 2 = grid electricity; scope 3 = embodied construction
                 *  amortized over life. input {mw, pue, region, tier?, lifeYears?}. */
                scopes: function (input) {
                    input = input || {};
                    var C = DATA.carbon, mw = input.mw || 0, life = input.lifeYears || 15;
                    // scope 1 — genset test hours at load factor × diesel efficiency × EPA factor
                    var testHrs = input.genTestHours != null ? input.genTestHours : C.genTestHoursPerYear;
                    var facKw = mw * 1000 * (DATA.fuelGen.loadFactor || 0.75);
                    var dieselL = testHrs * facKw * (DATA.fuelGen.genEfficiencyLPerKwh || 0.27);
                    var scope1 = +((dieselL * C.dieselKgCo2PerL) / 1000 + mw * C.refrigerantLeakTco2ePerMwYr).toFixed(1);
                    // scope 2 — grid electricity (operational)
                    var scope2 = RZEngine.models.carbon.annualTonnes(mw, input.pue, input.region);
                    // scope 3 — embodied construction, amortized annual
                    var scope3 = +(RZEngine.models.carbon.embodiedTonnes(mw) / life).toFixed(1);
                    var total = +(scope1 + scope2 + scope3).toFixed(1);
                    return { scope1: scope1, scope2: scope2, scope3Annual: scope3, totalAnnual: total, scope2Pct: total > 0 ? Math.round(100 * scope2 / total) : 0 };
                }
            },

            /* ── A7: water model ── */
            water: {
                /** WUE (L/kWh) for a cooling type. */
                wue: function (cooling) { return DATA.water.wueByType[cooling] != null ? DATA.water.wueByType[cooling] : DATA.water.wueByType.air; },
                /** A10: SEA water-stress cost model (article-10 promoted). input
                 *  {powerMw, wue(L/kWh), regionKey}. Math preserved EXACTLY. */
                stressCost: function (inp) {
                    var W = DATA.waterStress;
                    var region = W.regions[inp.regionKey] || W.regions.jakarta;
                    var annualKwh = inp.powerMw * 1000 * 8760;
                    var annualLiters = annualKwh * inp.wue;
                    var annualM3 = annualLiters / 1000;
                    var annualML = annualLiters / 1e6;
                    var annualCost = annualM3 * region.waterPrice;
                    var tco10 = 0, tco10Nominal = 0;
                    for (var y = 0; y < W.tcoYears; y++) {
                        var yearCost = annualCost * Math.pow(1 + W.escalation, y);
                        tco10Nominal += yearCost;
                        tco10 += yearCost / Math.pow(1 + W.discountRate, y);
                    }
                    var dlcWue = Math.max(inp.wue * W.dlcWueFactor, 0);
                    var dlcM3 = inp.powerMw * 1000 * 8760 * dlcWue / 1000;
                    var dlcCost = dlcM3 * region.waterPrice;
                    var hybridWue = inp.wue * W.hybridWueFactor;
                    var hybridM3 = inp.powerMw * 1000 * 8760 * hybridWue / 1000;
                    var hybridCost = hybridM3 * region.waterPrice;
                    var evapCost = annualCost;
                    var dlcSaving = evapCost > 0 ? ((evapCost - dlcCost) / evapCost * 100) : 0;
                    var riskPremiumPct = W.riskPremiumBands[W.riskPremiumBands.length - 1].pct;
                    for (var b = 0; b < W.riskPremiumBands.length; b++) {
                        if (region.riskScore >= W.riskPremiumBands[b].min) { riskPremiumPct = W.riskPremiumBands[b].pct; break; }
                    }
                    var recycleCapex = inp.powerMw * W.recycle.capexPerMw;
                    var recycleSaving = annualCost * W.recycle.savingFraction;
                    return {
                        annualKwh: annualKwh, annualM3: annualM3, annualML: annualML,
                        annualCost: annualCost, costPerMW: annualCost / Math.max(inp.powerMw, 1),
                        tco10: tco10, tco10Nominal: tco10Nominal,
                        evapCost: evapCost, dlcCost: dlcCost, hybridCost: hybridCost, airCost: 0, dlcSaving: dlcSaving,
                        costPerML_evap: annualML > 0 ? (evapCost / annualML) : 0,
                        costPerML_dlc: (dlcM3 / 1000) > 0 ? (dlcCost / (dlcM3 / 1000)) : 0,
                        costPerML_hybrid: (hybridM3 / 1000) > 0 ? (hybridCost / (hybridM3 / 1000)) : 0,
                        riskPremiumPct: riskPremiumPct, riskPremium: annualCost * riskPremiumPct / 100,
                        recycleCapex: recycleCapex, recycleSaving: recycleSaving,
                        recyclePayback: recycleSaving > 0 ? recycleCapex / recycleSaving : 99,
                        waterEnergyNexus: W.nexus.baseKwhPerMl + region.stressScore * W.nexus.perStressScore,
                        dlcM3: dlcM3, hybridM3: hybridM3,
                        method: 'screening-grade water cost/risk (article-10 model)'
                    };
                },
                /** Annual water use (m³) — WUE × IT energy. mw = IT load. */
                /** A20b: per-query AI water footprint (article-20 wfc/avh tabs).
                 *  input {modelKey, complexity?, cooling?, region?, includeUpstream?,
                 *  queriesPerDay?, users?, hoursPerDay?, scale?}. Math preserved EXACTLY. */
                aiQueryFootprint: function (input) {
                    input = input || {};
                    var A = DATA.aiWater;
                    var m = A.models[input.modelKey] || { name: input.modelKey || 'model', water: 0.5, type: 'text' };
                    var perQueryML = m.water
                        * (A.complexityMult[input.complexity] || 1.0)
                        * (A.coolingMult[input.cooling] || 1.0)
                        * (A.regionMult[input.region] || 1.0);
                    if (input.includeUpstream !== false) perQueryML *= (1 + A.upstreamFactor);
                    var q = input.queriesPerDay != null ? input.queriesPerDay : 50;
                    var users = input.users != null ? input.users : 1;
                    var hours = input.hoursPerDay != null ? input.hoursPerDay : 8;
                    var scaleMult = input.scale != null ? (A.scaleMultipliers[input.scale] || 1) : 1;
                    var totalQueries = q * users * (hours / 8) * scaleMult;
                    var dailyML = perQueryML * totalQueries;
                    var dailyL = dailyML / 1000;
                    var annualL = dailyL * 365;
                    var E = A.equivalences;
                    return {
                        model: m.name, perQueryML: perQueryML, totalQueriesPerDay: totalQueries,
                        dailyML: dailyML, dailyL: dailyL, monthlyL: dailyL * 30, annualL: annualL,
                        bottles: Math.round(annualL / E.bottleL),
                        showers: annualL / E.showerL,
                        drinkDays: annualL / E.drinkLPerDay,
                        co2Kg: annualL * E.co2KgPerL,
                        costUsd: annualL * E.waterCostUsdPerL,
                        method: 'per-model mL/query \u00d7 complexity \u00d7 cooling \u00d7 region' + (input.includeUpstream !== false ? ' \u00d7 (1+' + A.upstreamFactor + ' upstream)' : ' (direct only)') + ' — estimate-grade attribution'
                    };
                },
                /** A20: full facility water-footprint screening (article-20 promoted).
                 *  input {itLoadMw, pue, cooling(evaporative|hybrid|aircooled|dlc|immersion),
                 *  climate, hours?, sourceType?, aiSharePct?, rackDensityKw?, renewablePct?}.
                 *  Math preserved EXACTLY from the article calculator. */
                facilityFootprint: function (input) {
                    input = input || {};
                    var W = DATA.waterFootprint;
                    var load = input.itLoadMw != null ? input.itLoadMw : 10;
                    var pue = input.pue != null ? input.pue : 1.4;
                    var hours = input.hours != null ? input.hours : DATA.hoursPerYear;
                    var renewable = input.renewablePct != null ? input.renewablePct : 30;
                    var aiPct = input.aiSharePct != null ? input.aiSharePct : 50;
                    var rackDensity = input.rackDensityKw != null ? input.rackDensityKw : 40;
                    var facilityMW = load * pue;
                    var totalKWh = facilityMW * 1000 * hours;
                    var wue = (W.wueBase[input.cooling] || W.wueBase.evaporative) * (W.climateMult[input.climate] || 1.0);
                    var annualL = totalKWh * wue;
                    var upstreamFactor = 1 + ((100 - renewable) / 100) * W.upstreamPowerLPerKwhFactor;
                    var annualLFull = annualL * upstreamFactor;
                    var annualGal = annualLFull / W.lPerGal;
                    var dailyL = annualLFull / 365;
                    return {
                        wue: wue, annualDirectL: annualL, annualL: annualLFull, annualGal: annualGal,
                        dailyL: dailyL, dailyGal: annualGal / 365,
                        householdsEquiv: Math.round(dailyL / W.householdLPerDay),
                        cityPct: (dailyL / (W.cityHouseholds * W.householdLPerDay)) * 100,
                        annualCostUsd: (annualGal / 1000) * (W.waterCostPerKgal[input.sourceType] || W.waterCostPerKgal.municipal),
                        olympicPools: annualLFull / W.olympicPoolL,
                        aiShareL: annualLFull * (aiPct / 100),
                        rackCount: Math.round((load * 1000) / rackDensity),
                        perMwYrL: load > 0 ? annualLFull / load : 0,
                        benchmarks: W.benchmarksPerMwYr,
                        method: 'screening: WUE base \u00d7 climate + upstream-power water factor ' + W.upstreamPowerLPerKwhFactor + ' \u00d7 non-renewable share'
                    };
                },
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
                    /* M2a: FULL precision — in-chain rounding saturated composed
                     * availability to exactly 1.0 (fake 100.0000%). Display rounds. */
                    var a = (mtbf || 0) + (mttr || 0);
                    return a > 0 ? (mtbf / a) : 0;
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
                    return 1 - Math.pow(1 - a, p); /* M2a: full precision */
                },
                /** Series availability of independent groups (all must be up): Π a_i. */
                seriesAvailability: function (avails) {
                    if (!avails || !avails.length) return 0;
                    var prod = 1;
                    for (var i = 0; i < avails.length; i++) prod *= avails[i];
                    return prod; /* M2a: full precision */
                },
                /** Annual downtime (minutes) for an availability fraction. */
                annualDowntimeMinutes: function (availability) {
                    /* M2a: full precision — 1dp rounding erased sub-minute downtime
                     * (0.0024 min/yr → 0.0) for high-availability chains. */
                    return (1 - (availability || 0)) * DATA.hoursPerYear * 60;
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
                },
                /** k-of-n availability: system up if at least k of n identical units
                 *  (each availability a) are up = Σ_{i=k..n} C(n,i) a^i (1-a)^(n-i).
                 *  (v2.5.0 — exact redundancy math beyond simple 1-of-n parallel.) */
                kOutOfN: function (a, k, n) {
                    a = Math.max(0, Math.min(1, a || 0)); n = Math.max(1, n || 1); k = Math.max(1, Math.min(n, k || 1));
                    var C = function (nn, rr) { if (rr < 0 || rr > nn) return 0; rr = Math.min(rr, nn - rr); var num = 1; for (var i = 0; i < rr; i++) num = num * (nn - i) / (i + 1); return num; };
                    var p = 0;
                    for (var i = k; i <= n; i++) p += C(n, i) * Math.pow(a, i) * Math.pow(1 - a, n - i);
                    return Math.min(1, p); /* M2a: full precision (min guards fp-sum noise only) */
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
                /** Derive the 0-1 site factor vector from a country's reference
                 *  profile (DATA.countries) — 1 = best. Missing fields fall back to
                 *  a neutral 0.6; `overrides` pins any factor. So
                 *  score(deriveFactors('SG')) is a REAL, country-varying site score
                 *  (no hardcoded factor vectors). */
                deriveFactors: function (countryId, overrides) {
                    var c = (DATA.countries && DATA.countries[countryId]) || null;
                    var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
                    var f;
                    if (!c) {
                        f = { power: 0.6, grid: 0.6, seismic: 0.6, talent: 0.6, tax: 0.6, carbon: 0.6, flood: 0.6, latency: 0.6, water: 0.6, climate: 0.6 };
                    } else {
                        var floodMap = { low: 1, moderate: 0.66, high: 0.33, extreme: 0 };
                        var er = c.economy && c.economy.electricityRate;              // $/kWh (lower better)
                        var gc = c.environment && c.environment.gridCarbonIntensity;  // kgCO2/kWh (lower better)
                        var tax = c.economy && c.economy.taxRate;                     // fraction (lower better)
                        var env = c.environment || {};
                        var S = DATA.site;
                        // grid: prefer IEEE-1366 SAIDI when available, else uptime%
                        var gridScore;
                        if (env.saidiMinYr != null) gridScore = clamp(1 - env.saidiMinYr / S.saidiRefMin);
                        else if (c.gridReliability) gridScore = clamp(((c.gridReliability.gridUptime > 1 ? c.gridReliability.gridUptime : c.gridReliability.gridUptime * 100) - 95) / 5);
                        else gridScore = 0.6;
                        // seismic: prefer USGS PGA→SDC when available, else zone 0-4
                        var seismicScore;
                        if (env.pgaPct2in50yr != null) { var pg = env.pgaPct2in50yr; var bnd = S.pgaToScore.find(function (b) { return pg < b.maxPga; }); seismicScore = bnd ? bnd.s : 0.1; }
                        else if (c.naturalDisaster) seismicScore = clamp(1 - c.naturalDisaster.seismicZone / 4);
                        else seismicScore = 0.6;
                        // water: WRI Aqueduct 0-5 water-stress (was hardcoded 0.65)
                        var waterScore = env.aqueductStressScore != null ? clamp(1 - env.aqueductStressScore / 5) : 0.65;
                        // climate: ASHRAE zone → free-cooling hours → 0-1
                        var climateScore = 0.6;
                        if (env.ashraeClimateZone) { var z = String(env.ashraeClimateZone).charAt(0); var hrs = S.climateFreeHours[z]; if (hrs != null) climateScore = clamp(hrs / 5800); }
                        f = {
                            power:   er != null ? clamp(1 - (er - 0.05) / 0.30) : 0.6,
                            grid:    gridScore,
                            seismic: seismicScore,
                            talent:  c.talentPool ? clamp(c.talentPool.talentScore / 100) : 0.6,
                            tax:     tax != null ? clamp(1 - tax / 0.35) : 0.6,
                            carbon:  gc != null ? clamp(1 - gc / 0.90) : 0.6,
                            flood:   (c.naturalDisaster && floodMap[c.naturalDisaster.floodRisk] != null) ? floodMap[c.naturalDisaster.floodRisk] : 0.6,
                            latency: (c.talentPool && c.talentPool.hyperscalerPresence != null) ? clamp(c.talentPool.hyperscalerPresence / 10) : 0.65,
                            water:   waterScore,
                            climate: climateScore
                        };
                    }
                    if (overrides) { for (var k in overrides) { if (overrides.hasOwnProperty(k)) f[k] = overrides[k]; } }
                    return f;
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
                },
                /** Commissioning PROGRAM cost ($) for a build — the L0-L6 Cx program,
                 *  promoted from cx-calculator.html so DCMOC + the calculator share one
                 *  source. input: {itLoadKw, cooling, redundancy, countryId}. Returns
                 *  {total, contingency, subtotal, perKw, byLevel, byDiscipline}. */
                programCost: function (input) {
                    input = input || {};
                    var cx = DATA.commissioning.cx;
                    var kw = Math.max(0, +input.itLoadKw || 0);
                    var cooling = (input.cooling || 'air').toLowerCase();
                    var red = (input.redundancy || 'n1').toLowerCase().replace(/\s+/g, '');
                    var mech = (cooling === 'liquid' || cooling === 'immersion' || cooling === 'rdhx') ? cx.base.mechanical_dlc : cx.base.mechanical_air;
                    var basePerKw = cx.base.electrical + mech + cx.base.fire + cx.base.security + cx.base.it + cx.base.controls + cx.base.building;
                    var cMult = cx.coolingMult[cooling] != null ? cx.coolingMult[cooling] : 1.0;
                    var rMult = cx.redundancyMult[red] != null ? cx.redundancyMult[red] : 1.0;
                    var country = DATA.countries && DATA.countries[input.countryId];
                    var regionMult = country && country.constructionIndex ? country.constructionIndex : 1.0;
                    var subtotal = kw * basePerKw * cMult * rMult * regionMult;
                    var contingency = subtotal * cx.contingency;
                    var total = subtotal + contingency;
                    var byLevel = {}, byDiscipline = {};
                    for (var lk in cx.levels) { if (cx.levels.hasOwnProperty(lk)) byLevel[lk] = { label: cx.levels[lk].label, cost: Math.round(total * cx.levels[lk].costShare) }; }
                    for (var dk in cx.disciplineSplit) { if (cx.disciplineSplit.hasOwnProperty(dk)) byDiscipline[dk] = Math.round(total * cx.disciplineSplit[dk]); }
                    return { total: Math.round(total), subtotal: Math.round(subtotal), contingency: Math.round(contingency), perKw: kw > 0 ? +(total / kw).toFixed(1) : 0, byLevel: byLevel, byDiscipline: byDiscipline };
                },
                /** Commissioning PROGRAM schedule (months) for a build. input:
                 *  {itLoadKw, cooling, redundancy}. Returns {totalMonths, byLevel:[{level,label,months,start,end}]}. */
                programSchedule: function (input) {
                    input = input || {};
                    var cx = DATA.commissioning.cx;
                    var mw = Math.max(0, (+input.itLoadKw || 0) / 1000);
                    var cooling = (input.cooling || 'air').toLowerCase();
                    var red = (input.redundancy || 'n1').toLowerCase().replace(/\s+/g, '');
                    var cMult = cx.coolingMult[cooling] != null ? cx.coolingMult[cooling] : 1.0;
                    var rMult = cx.redundancyMult[red] != null ? cx.redundancyMult[red] : 1.0;
                    // log-damped growth so a 100 MW build isn't 45 months of Cx
                    var raw = cx.schedBaseMonths + cx.schedPerMw * (mw > 0 ? Math.log(1 + mw) / Math.log(2) : 0) * 4;
                    var totalMonths = Math.min(cx.schedMaxMonths, +(raw * cMult * rMult).toFixed(1));
                    var order = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
                    var byLevel = [], cursor = 0;
                    for (var i = 0; i < order.length; i++) {
                        var lv = cx.levels[order[i]];
                        var m = +(totalMonths * lv.schedWeight).toFixed(1);
                        byLevel.push({ level: order[i], label: lv.label, months: m, start: +cursor.toFixed(1), end: +(cursor + m).toFixed(1) });
                        cursor += m;
                    }
                    return { totalMonths: totalMonths, byLevel: byLevel };
                },

                /* ══ RICH Cx program engine (v2.5.0) — faithful port of the DC-Hub
                 *  cx-calculator.html model. Equipment-count-driven, regional day-rates,
                 *  per-level staffed L0-L6 duration+cost, gm-normalized base blend,
                 *  Monte-Carlo band + sensitivity tornado. DCMOC + the calculator now
                 *  share this ONE brain. See DATA.commissioning.cx.rich. ══ */
                _rich: function () { return DATA.commissioning.cx.rich; },
                _rate: function (region) { var R = DATA.commissioning.cx.rich; return R.rates[region] || R.rates.us_virginia; },

                /** Equipment quantities scaled from IT load (kW) + rack density. */
                equipScale: function (inp) {
                    var R = DATA.commissioning.cx.rich, kw = inp.itLoad;
                    var den = R.density[inp.rackDensity] || R.density.standard;
                    return {
                        switchgear: Math.ceil(kw / 5000) + 1, transformers: Math.ceil(kw / 2500), generators: Math.ceil(kw / 2000),
                        ups_modules: Math.ceil(kw / 500), cooling_units: Math.ceil(kw / 200), pdus: Math.ceil(kw / 100),
                        sts: Math.ceil(kw / 1000), chillers: Math.ceil(kw / 500), pumps: Math.ceil(kw / 300),
                        racks: Math.ceil(kw / den.kw), fireZones: Math.ceil(kw / 200),
                        lvsb: Math.ceil(kw / 2000) + 1, db: Math.ceil(kw / 500), mcc: Math.ceil(kw / 3000) + 1,
                        vfd: Math.ceil(kw / 300), busway: Math.ceil(kw / 2000) + 1, firePumps: Math.max(2, Math.ceil(kw / 25000) + 1),
                        ahu: Math.ceil(kw / 5000) + 1, accessDoors: Math.ceil(kw / 500) + 10, cameras: Math.ceil(kw / 200) + 20,
                        lightZones: Math.ceil(kw / 1000) + 4, emergLights: Math.ceil(kw / 500) + 20, sumpPumps: Math.ceil(kw / 5000) + 2,
                        ats: Math.ceil(kw / 2000), rpp: Math.ceil(kw / 200)
                    };
                },

                /** Per-level working-day durations {l0..l6,total}. */
                levelDurations: function (inp, eq) {
                    var R = DATA.commissioning.cx.rich;
                    eq = eq || RZEngine.models.commissioning.equipScale(inp);
                    var liquid = (inp.coolingType === 'dlc' || inp.coolingType === 'immersion');
                    var scopeDur = (R.scope[inp.cxScope] || R.scope.new_build).dur;
                    var redDur = (R.redundancy[inp.redundancy] || R.redundancy['N+1']).dur;
                    var bldDur = (R.building[inp.buildingType] || R.building.purpose).dur;
                    var coolDur = (R.cooling[inp.coolingType] || R.cooling.air).dur;
                    // L0
                    var l0 = 15;
                    if (inp.itLoad > 5000) l0 += 5; if (inp.itLoad > 20000) l0 += 10; if (inp.itLoad > 50000) l0 += 15;
                    if (liquid) l0 += 5;
                    if (inp.substationConfig === 'dual_sub' || inp.substationConfig === 'ring_bus') l0 += 5;
                    if (inp.bmsComplexity === 'advanced' || inp.bmsComplexity === 'ai_driven') l0 += 3;
                    l0 *= scopeDur; if (inp.cxScope === 'recommission') l0 = Math.max(5, l0); l0 = Math.max(5, Math.ceil(l0));
                    // L1
                    var l1 = eq.switchgear * 2 + eq.transformers * 3 + eq.generators * 2 + 2 + eq.chillers * 0.5 + 1 + eq.lvsb * 0.5 + eq.mcc * 0.5 + eq.pdus * 0.3 + eq.busway * 0.3 + eq.ats * 0.3;
                    if (liquid) l1 += 2; if (inp.deliveryMethod === 'modular_pod') l1 *= 1.5; l1 = Math.ceil(l1 * scopeDur);
                    // L2
                    var l2elec = eq.switchgear * 1.5 + eq.transformers + eq.generators + Math.ceil(eq.ups_modules / 4) * 0.5 + eq.pdus * 0.25 + eq.sts * 0.5 + 2;
                    var l2mech = 3 + eq.chillers * 0.5 + eq.pumps * 0.5 + eq.cooling_units * 0.5; if (liquid) l2mech += 3;
                    var l2 = Math.max(l2elec, l2mech) + eq.fireZones * 0.75 + (eq.fireZones * 0.25 + Math.ceil(inp.itLoad / 1000) * 2 + 1);
                    l2 = Math.max(1, Math.ceil(l2 * redDur * bldDur * scopeDur));
                    // L3
                    var l3elec = eq.switchgear * 2 + eq.transformers * 1.5 + eq.generators * 2 + 1.5 + eq.sts * 0.5;
                    var l3mech = eq.chillers * 2 + eq.cooling_units * 0.5 + eq.pumps * 0.5 + Math.ceil(inp.itLoad / 2000); if (liquid) l3mech += Math.ceil(inp.itLoad / 500) * 2;
                    var l3fire = eq.fireZones * 1.5;
                    var l3bms = Math.ceil((R.bms[inp.bmsComplexity] || R.bms.standard).pts * (inp.itLoad / 1000) / 100);
                    var l3 = l3elec + Math.max(l3mech, l3fire) + l3bms;
                    l3 = Math.max(1, Math.ceil(l3 * coolDur * redDur * scopeDur));
                    // L4
                    var l4elec = 3; if (inp.redundancy === '2N' || inp.redundancy === '2N+1') l4elec += 3; l4elec += 2;
                    var l4mech = 4 + 3; if (liquid) l4mech += 3;
                    var l4 = l4elec + Math.max(l4mech, 3);
                    var sf = 1.0; if (inp.itLoad > 5000) sf = 1.15; if (inp.itLoad > 10000) sf = 1.30; if (inp.itLoad > 25000) sf = 1.50; if (inp.itLoad > 50000) sf = 1.75;
                    l4 = Math.max(1, Math.ceil(l4 * sf * redDur * scopeDur));
                    // L5
                    var rd = R.redundancy[inp.redundancy] || R.redundancy['N+1'];
                    var hrs = rd.istHrs + rd.scenarios * 3; var l5 = Math.ceil(hrs / 10);
                    var sf5 = 1.0; if (inp.itLoad > 5000) sf5 = 1.2; if (inp.itLoad > 10000) sf5 = 1.4; if (inp.itLoad > 50000) sf5 = 1.8;
                    l5 = Math.max(1, Math.ceil(l5 * sf5 * coolDur * scopeDur));
                    // L6
                    var l6 = 10; if (inp.itLoad > 5000) l6 += 3; if (inp.itLoad > 20000) l6 += 5; if (inp.itLoad > 50000) l6 += 8;
                    if (inp.redundancy === '2N' || inp.redundancy === '2N+1') l6 += 5; if (liquid) l6 += 3;
                    if (inp.bmsComplexity === 'advanced' || inp.bmsComplexity === 'ai_driven') l6 += 3;
                    l6 = Math.max(3, Math.ceil(l6 * scopeDur));
                    return { l0: l0, l1: l1, l2: l2, l3: l3, l4: l4, l5: l5, l6: l6, total: l0 + l1 + l2 + l3 + l4 + l5 + l6 };
                },

                /** Raw per-level costs {l0..l6} BEFORE regional mult on L1-L5 (L0/L6 include
                 *  r.mult internally, per the cx model). */
                levelCosts: function (inp, dur, eq) {
                    var C = RZEngine.models.commissioning;
                    eq = eq || C.equipScale(inp); dur = dur || C.levelDurations(inp, eq);
                    var r = C._rate(inp.region);
                    var l0 = (dur.l0 * r.cxDay * 2.5 + inp.itLoad * 2) * r.mult;
                    var l1 = dur.l1 * r.cxDay * 2 + dur.l1 * r.perDiem;
                    var l2 = dur.l2 * r.cxDay * 3 + dur.l2 * 350 + inp.itLoad * 0.5;
                    var l3 = dur.l3 * r.cxDay * 4 + (eq.generators * 12 + 8) * 350 + dur.l3 * 500 + (eq.generators * 2 + eq.chillers * 2) * r.oemDay;
                    var lbHrs = 24; if (inp.redundancy === '2N' || inp.redundancy === '2N+1') lbHrs *= 2;
                    var l4 = dur.l4 * r.cxDay * 5 + lbHrs * 350 + dur.l4 * 200 * 4 + dur.l4 * 600;
                    var mw = inp.itLoad / 1000;
                    var lbDays = (inp.redundancy === '2N' || inp.redundancy === '2N+1') ? 5 : (inp.redundancy === 'N+1' ? 2 : 1);
                    var l5 = dur.l5 * r.cxDay * 8 + mw * 8000 * lbDays + 20 * inp.itLoad * 0.3 * r.diesel + dur.l5 * r.witnessDay;
                    var l6 = (dur.l6 * r.cxDay * 3 + Math.ceil(inp.itLoad / 2000) * r.cxDay * 2 + inp.itLoad * 3 + inp.itLoad * 1.5) * r.mult;
                    return { l0: l0, l1: l1, l2: l2, l3: l3, l4: l4, l5: l5, l6: l6 };
                },

                /** FULL Cx program (faithful cxCalcTotalCost port). input schema:
                 *  {itLoad(kW), coolingType, redundancy, rackDensity, buildingType,
                 *   fireSuppression, upsType, region, generatorType, seismicZone,
                 *   cxScope, substationConfig, bmsComplexity, deliveryMethod}. Use
                 *   mapInput() to build it from the DCMOC store. Returns rich result. */
                programRich: function (input) {
                    var R = DATA.commissioning.cx.rich, C = RZEngine.models.commissioning;
                    var inp = C.mapInput(input);
                    var eq = C.equipScale(inp);
                    var dur = C.levelDurations(inp, eq);
                    var lc = C.levelCosts(inp, dur, eq);
                    // Global cost multiplier (11 tables) → normalized.
                    var gm = R.cooling[inp.coolingType].cost * R.redundancy[inp.redundancy].cost * R.building[inp.buildingType].cost;
                    gm *= R.seismic[inp.seismicZone].cost * R.substation[inp.substationConfig].cost;
                    gm *= R.bms[inp.bmsComplexity].cost * R.delivery[inp.deliveryMethod].cost;
                    gm *= R.fire[inp.fireSuppression] * R.ups[inp.upsType] * R.gen[inp.generatorType];
                    gm *= R.density[inp.rackDensity].cool;
                    var normFactor = Math.pow(gm, R.normExp);
                    var baseCostKw = (inp.coolingType === 'dlc' || inp.coolingType === 'immersion') ? R.baseKw.mechanical_dlc : R.baseKw.mechanical_air;
                    var totalBase = (R.baseKw.electrical + baseCostKw + R.baseKw.fire + R.baseKw.security + R.baseKw.it + R.baseKw.controls + R.baseKw.building) * inp.itLoad;
                    totalBase *= normFactor;
                    var rm = C._rate(inp.region).mult;
                    var levelTotal = lc.l0 + lc.l1 * rm + lc.l2 * rm + lc.l3 * rm + lc.l4 * rm + lc.l5 * rm + lc.l6;
                    var subtotal = Math.max(totalBase, levelTotal);
                    var docCost = inp.itLoad * 5;
                    var travelCost = dur.total * C._rate(inp.region).perDiem * 3;
                    subtotal += docCost + travelCost;
                    subtotal *= rm;
                    if (inp.itLoad >= 50000) subtotal *= 1.08;
                    if (inp.itLoad >= 100000) subtotal *= 1.05;
                    var contingency = subtotal * R.contingency;
                    var grand = subtotal + contingency;
                    // Fixed display proportions.
                    var lp = R.levelProportions, ll = R.levelLabels, order = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
                    var levels = [];
                    for (var i = 0; i < order.length; i++) {
                        var k = order[i];
                        levels.push({ id: k.toUpperCase(), label: ll[k], cost: Math.round(grand * lp[k]), pct: +(lp[k] * 100).toFixed(1), days: dur[k] });
                    }
                    var ds = R.disciplineShare, disciplines = [];
                    for (var d in ds) { if (ds.hasOwnProperty(d)) disciplines.push({ name: d, cost: Math.round(grand * ds[d]), pct: +(ds[d] * 100).toFixed(1) }); }
                    var capexPerKw = R.capexPerKw.standard;
                    if (inp.rackDensity === 'ai_hpc') capexPerKw = R.capexPerKw.ai_hpc; else if (inp.rackDensity === 'high') capexPerKw = R.capexPerKw.high;
                    var estCapex = inp.itLoad * capexPerKw;
                    var rd = R.redundancy[inp.redundancy], rate = C._rate(inp.region);
                    return {
                        grand: Math.round(grand), subtotal: Math.round(subtotal), contingency: Math.round(contingency),
                        perKw: +(grand / inp.itLoad).toFixed(1), pctCapex: +((grand / estCapex) * 100).toFixed(2), capexPerKw: capexPerKw,
                        durationDays: dur.total, durationWeeks: Math.ceil(dur.total / 5), durationMonths: Math.ceil(dur.total / 22),
                        levels: levels, disciplines: disciplines, equip: eq,
                        region: { key: inp.region, name: rate.name, mult: rate.mult },
                        tierInfo: { tier: rd.tier, avail: rd.avail, scenarios: rd.scenarios, istHrs: rd.istHrs },
                        input: inp
                    };
                },

                /** Normal deviate (Box-Muller). rng defaults to Math.random; pass a
                 *  seeded rng for a deterministic path (tests). */
                _randNorm: function (mu, sigma, rng) {
                    rng = rng || Math.random;
                    var u1 = rng(), u2 = rng();
                    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                },

                /** Monte-Carlo cost band (itLoad ±7.5% Normal, cost noise ±5% clamped).
                 *  opts: {n=10000, rng}. Returns {p5,p25,p50,p75,p95,mean,stdDev,cvar95,min,max}. */
                monteCarlo: function (input, opts) {
                    opts = opts || {}; var C = RZEngine.models.commissioning;
                    var base = C.mapInput(input);
                    var N = opts.n || 10000, rng = opts.rng || Math.random, results = [];
                    for (var i = 0; i < N; i++) {
                        var vi = {}; for (var kk in base) { if (base.hasOwnProperty(kk)) vi[kk] = base[kk]; }
                        vi.itLoad = Math.max(100, Math.round(base.itLoad * (1 + C._randNorm(0, 0.075, rng))));
                        var g = C.programRich(vi).grand;
                        var costNoise = 1 + C._randNorm(0, 0.05, rng);
                        results.push(g * Math.max(0.85, Math.min(1.15, costNoise)));
                    }
                    results.sort(function (a, b) { return a - b; });
                    var mean = results.reduce(function (a, b) { return a + b; }, 0) / N;
                    var variance = results.reduce(function (a, b) { return a + Math.pow(b - mean, 2); }, 0) / N;
                    var p95idx = Math.ceil(0.95 * N) - 1, tail = results.slice(p95idx);
                    var cvar95 = tail.reduce(function (a, b) { return a + b; }, 0) / tail.length;
                    return {
                        p5: results[Math.ceil(0.05 * N) - 1], p25: results[Math.ceil(0.25 * N) - 1], p50: results[Math.ceil(0.50 * N) - 1],
                        p75: results[Math.ceil(0.75 * N) - 1], p95: results[p95idx], mean: mean, stdDev: Math.sqrt(variance),
                        cvar95: cvar95, min: results[0], max: results[N - 1]
                    };
                },

                /** Sensitivity tornado — 7-param swing (each {name,low,high,range,lowD,highD}),
                 *  sorted by range desc. baseCost optional (defaults to programRich().grand). */
                sensitivity: function (input, baseCost) {
                    var C = RZEngine.models.commissioning;
                    var inp = C.mapInput(input);
                    if (baseCost == null) baseCost = C.programRich(inp).grand;
                    var tests = [
                        { name: 'IT Load', key: 'itLoad', isNum: true },
                        { name: 'Cooling Type', key: 'coolingType', low: 'air', high: 'dlc' },
                        { name: 'Redundancy', key: 'redundancy', low: 'N', high: '2N+1' },
                        { name: 'Building Type', key: 'buildingType', low: 'warehouse', high: 'highrise' },
                        { name: 'Seismic Zone', key: 'seismicZone', low: '0', high: '4' },
                        { name: 'Substation', key: 'substationConfig', low: 'utility_fed', high: 'ring_bus' },
                        { name: 'BMS/DCIM', key: 'bmsComplexity', low: 'basic', high: 'ai_driven' }
                    ];
                    var results = [];
                    for (var i = 0; i < tests.length; i++) {
                        var t = tests[i], lo = {}, hi = {};
                        for (var kk in inp) { if (inp.hasOwnProperty(kk)) { lo[kk] = inp[kk]; hi[kk] = inp[kk]; } }
                        if (t.isNum) { lo[t.key] = Math.round(inp[t.key] * 0.8); hi[t.key] = Math.round(inp[t.key] * 1.2); }
                        else { lo[t.key] = t.low; hi[t.key] = t.high; }
                        var lc = C.programRich(lo).grand, hc = C.programRich(hi).grand;
                        results.push({ name: t.name, low: lc, high: hc, range: Math.abs(hc - lc), lowD: lc - baseCost, highD: hc - baseCost });
                    }
                    results.sort(function (a, b) { return b.range - a.range; });
                    return results;
                },

                /** Map a DCMOC store slice (or a partial rich input, or a preset name)
                 *  → the full rich input schema. Fills missing fields with budgetary
                 *  defaults. Accepts: {itLoad|itLoadKw, coolingType, redundancy|powerRedundancy,
                 *  countryId|region, rackDensity, ...} or a preset key string. */
                mapInput: function (src) {
                    var R = DATA.commissioning.cx.rich, def = R.defaults;
                    if (typeof src === 'string') { var p = R.scenarios[src]; if (p) src = p; else src = {}; }
                    src = src || {};
                    // If it already looks like a full rich input (has region + coolingType in CX form), pass through with defaults.
                    var out = {};
                    for (var dk in def) { if (def.hasOwnProperty(dk)) out[dk] = def[dk]; }
                    // itLoad (kW)
                    var kw = src.itLoad != null ? src.itLoad : (src.itLoadKw != null ? src.itLoadKw : 2000);
                    out.itLoad = Math.max(100, Math.round(+kw || 2000));
                    // cooling
                    var cool = src.coolingType || src.cooling || 'air';
                    out.coolingType = R.coolingMap[cool] || (R.cooling[cool] ? cool : 'air');
                    // redundancy — accept CX form ('N+1'/'2N'/'2N+1'/'N') or DCMOC form (same) or compact ('n1'/'2n'/'2n1')
                    var red = src.redundancy || src.powerRedundancy || 'N+1';
                    var redMap = { n: 'N', n1: 'N+1', '2n': '2N', '2n1': '2N+1' };
                    if (redMap[red]) red = redMap[red];
                    out.redundancy = R.redundancy[red] ? red : 'N+1';
                    // region — accept CX region key, else ISO-2 countryId, else nearest by mult
                    var region = src.region;
                    if (!region || !R.rates[region]) {
                        var iso = src.countryId || (src.country && src.country.id) || src.iso2;
                        if (iso && R.iso2Region[iso]) region = R.iso2Region[iso];
                    }
                    out.region = (region && R.rates[region]) ? region : def.region;
                    // pass-through rich fields when supplied and valid
                    if (src.rackDensity && R.density[src.rackDensity]) out.rackDensity = src.rackDensity;
                    if (src.buildingType && R.building[src.buildingType]) out.buildingType = src.buildingType;
                    if (src.fireSuppression && R.fire[src.fireSuppression] != null) out.fireSuppression = src.fireSuppression;
                    if (src.upsType && R.ups[src.upsType] != null) out.upsType = src.upsType;
                    if (src.generatorType && R.gen[src.generatorType] != null) out.generatorType = src.generatorType;
                    if (src.seismicZone != null && R.seismic[String(src.seismicZone)]) out.seismicZone = String(src.seismicZone);
                    if (src.cxScope && R.scope[src.cxScope]) out.cxScope = src.cxScope;
                    if (src.substationConfig && R.substation[src.substationConfig]) out.substationConfig = src.substationConfig;
                    if (src.bmsComplexity && R.bms[src.bmsComplexity]) out.bmsComplexity = src.bmsComplexity;
                    if (src.deliveryMethod && R.delivery[src.deliveryMethod]) out.deliveryMethod = src.deliveryMethod;
                    // density heuristic from cooling when not supplied: liquid ⇒ ai_hpc-ish density default stays 'standard'
                    // (keep budgetary default; DCMOC has no rack-density input)
                    return out;
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
                },
                /** Weibull cumulative failure probability by age: F(t)=1-e^(-(t/η)^β),
                 *  plus the annual hazard. Uses DATA.asset.weibull[class] (wear-out
                 *  β>1). Returns {failureProb, hazardRate, characteristicLife}. (v2.5.0) */
                failureProbability: function (assetClass, ageYears) {
                    var w = DATA.asset.weibull[assetClass];
                    if (!w) { var dl = RZEngine.models.asset.designLife(assetClass) || 15; w = { shape: 2.0, scaleYears: dl }; }
                    var t = Math.max(0, ageYears || 0), b = w.shape, eta = w.scaleYears;
                    var F = 1 - Math.exp(-Math.pow(t / eta, b));
                    var hazard = t > 0 ? (b / eta) * Math.pow(t / eta, b - 1) : 0; /* per year */
                    return { failureProb: +F.toFixed(4), annualHazard: +hazard.toFixed(4), characteristicLifeYears: eta, shape: b };
                },
                /** Lifecycle replacement schedule for a component over a horizon.
                 *  Returns replacement years + per-event cost ($ = costPerKw × itLoadKw)
                 *  + total nominal cost. component keys: see DATA.asset.lifecycle. */
                replacementSchedule: function (component, itLoadKw, horizonYears) {
                    var L = DATA.asset.lifecycle[component];
                    if (!L) return null;
                    var kw = itLoadKw || 0, horizon = horizonYears || 15;
                    var eventCost = Math.round(L.costPerKw * kw);
                    var years = [];
                    for (var y = L.years; y <= horizon; y += L.years) years.push(y);
                    return {
                        component: component, label: L.label, intervalYears: L.years,
                        costPerKw: L.costPerKw, eventCostUsd: eventCost,
                        replacementYears: years, events: years.length,
                        totalNominalUsd: eventCost * years.length
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
                },
                /** Long-lead procurement risk: which critical items can't arrive
                 *  before power-on, given the schedule. input {powerOnMonth, stressed?}.
                 *  Returns per-item lead (months) + whether it's on the critical path.
                 *  (v2.5.0 — long-lead gear is the dominant AI-era schedule driver.) */
                longLeadRisk: function (input) {
                    input = input || {};
                    var LL = DATA.construction.longLeadWeeks;
                    var idx = input.stressed ? 1 : 0;
                    var powerOn = input.powerOnMonth != null ? input.powerOnMonth : 24;
                    var items = [], critical = [];
                    for (var k in LL) {
                        if (!LL.hasOwnProperty(k)) continue;
                        var months = +(LL[k][idx] / 4.345).toFixed(1);
                        var late = months > powerOn;
                        items.push({ item: k, leadMonths: months, critical: late });
                        if (late) critical.push(k);
                    }
                    items.sort(function (a, b) { return b.leadMonths - a.leadMonths; });
                    return { items: items, criticalItems: critical, maxLeadMonths: items.length ? items[0].leadMonths : 0, recommendEarlyOrder: critical.length > 0 };
                }
            },

            /* ── v2.4.0: requirements intake model — Layer 1 ── */
            requirements: {
                /** Use-case profile (density/cooling/tier defaults), or null. */
                profile: function (useCase) {
                    var p = DATA.requirements.useCaseProfiles[(useCase || '').toLowerCase()];
                    return p || null;
                },
                /** AI reference-architecture profile (h100_pod, gb200_nvl72,
                 *  gb300_nvl72, rubin_vr200, ocp_hpr), or null. (Ship-A) */
                archProfile: function (key) {
                    var a = DATA.requirements.archProfiles[(key || '').toLowerCase()];
                    return a || null;
                },
                /** Provisioned (peak/EDPp) rack kW for an arch key — power plant is
                 *  sized to peak, not nominal. Falls back to nominal × peakProvisionFactor. */
                provisionedRackKw: function (key) {
                    var a = RZEngine.models.requirements.archProfile(key);
                    if (!a) return null;
                    return a.rackKwPeak != null ? a.rackKwPeak : Math.round(a.rackKwNominal * DATA.requirements.peakProvisionFactor);
                },
                /** Marginal power-chain provisioning uplift for an arch key —
                 *  (peak/nominal) ÷ baselinePeakRatio, floored at 1.0. Applied to
                 *  electrical/UPS/generator base $/kW ONLY (the CPU-era base already
                 *  prices ~1.2× headroom; raw peak/nominal would double-count it).
                 *  Returns 1.0 for unknown/null arch (no-op) and for archs whose
                 *  peak/nominal ≤ baseline (e.g. OCP-HPR 140/120). */
                powerProvisionUplift: function (key) {
                    var a = RZEngine.models.requirements.archProfile(key);
                    if (!a || !a.rackKwNominal) return 1.0;
                    var prov = RZEngine.models.requirements.provisionedRackKw(key);
                    var ratio = prov / a.rackKwNominal;
                    var uplift = ratio / DATA.requirements.baselinePeakRatio;
                    return uplift > 1.0 ? uplift : 1.0;
                },
                /** Interconnect fabric cost for a GPU count (analyst estimate). */
                interconnectCost: function (fabric, gpuCount) {
                    var f = DATA.requirements.interconnect[(fabric || '').toLowerCase()];
                    return f && gpuCount ? Math.round(f.usdPerGpu * gpuCount) : 0;
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
                /** Implied rack count = ceil(itLoadKw / rackKw) at the use-case
                 *  typical density (or an explicit rackKw). (v2.5.0 research pass) */
                rackCount: function (itLoadKw, rackKw) {
                    var kw = rackKw || 12;
                    return kw > 0 ? Math.ceil((itLoadKw || 0) / kw) : 0;
                },
                /** Density band + the cooling it needs. (ASHRAE TC9.9 5th ed.:
                 *  air is physically limited ~20 kW/rack.) */
                densityBand: function (rackKw) {
                    var bands = DATA.requirements.densityBands;
                    for (var i = 0; i < bands.length; i++) if ((rackKw || 0) >= bands[i].minKw) return bands[i];
                    return bands[bands.length - 1];
                },
                /** Validate a brief: completeness + tier-floor + density-to-cooling
                 *  compatibility (a rack density above the cooling ceiling is a
                 *  CRITICAL physics flag) + SLA-vs-tier. */
                validate: function (intake) {
                    intake = intake || {};
                    var comp = RZEngine.models.requirements.completeness(intake);
                    var prof = RZEngine.models.requirements.profile(intake.useCase);
                    var flags = [];
                    if (prof && intake.targetTier != null && intake.targetTier < prof.tierFloor) {
                        flags.push({ level: 'warn', field: 'targetTier', message: 'Target Tier ' + intake.targetTier + ' is below the ' + prof.label + ' recommended floor (Tier ' + prof.tierFloor + ')' });
                    }
                    // density-to-cooling compatibility (ASHRAE TC9.9): flag if the
                    // requested rack density exceeds the selected cooling ceiling.
                    var rackKw = intake.rackKw != null ? intake.rackKw : (prof && prof.rackKw);
                    var cool = (intake.coolingType || (prof && prof.cooling) || 'air').toLowerCase();
                    var ceil = DATA.requirements.coolingMaxRackKw[cool];
                    if (rackKw != null && ceil != null && rackKw > ceil) {
                        var band = RZEngine.models.requirements.densityBand(rackKw);
                        flags.push({ level: 'critical', field: 'coolingType', message: 'Requested ' + rackKw + ' kW/rack exceeds the ' + cool + ' ceiling (~' + ceil + ' kW/rack, ASHRAE TC9.9) — ' + band.band + ' density needs ' + (band.coolingMandatory || band.coolingRecommended || 'liquid') + ' cooling' });
                    }
                    // SLA vs tier availability
                    if (intake.slaUptimePct != null && intake.targetTier != null) {
                        var tgt = DATA.reliability && DATA.reliability.tierAvailability ? DATA.reliability.tierAvailability[intake.targetTier] : null;
                        if (tgt != null && intake.slaUptimePct > tgt) flags.push({ level: 'warn', field: 'slaUptimePct', message: 'SLA ' + intake.slaUptimePct + '% exceeds Tier ' + intake.targetTier + ' design availability ' + tgt + '% — raise tier' });
                    }
                    return { completeness: comp, flags: flags, recommendedTierFloor: prof ? prof.tierFloor : null, profile: prof, rackCount: rackKw ? RZEngine.models.requirements.rackCount(intake.itLoadKw, rackKw) : null };
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
                },
                /** ASHRAE TC9.9 thermal-envelope check. input {supplyTempC, deltaTK,
                 *  coolingType, class?}. Flags supply-temp/ΔT outside the class. (v2.5.0) */
                thermalCheck: function (inp) {
                    inp = inp || {};
                    var A = DATA.architecture;
                    var cls = inp.class || ((inp.coolingType === 'liquid' || inp.coolingType === 'immersion' || inp.coolingType === 'rdhx') ? 'H1' : 'A1');
                    var spec = A.ashraeClasses[cls] || A.ashraeClasses.A1;
                    var supply = inp.supplyTempC != null ? inp.supplyTempC : 22;
                    var band = A.coolingDeltaT[inp.coolingType] || [10, 15];
                    var dT = inp.deltaTK != null ? inp.deltaTK : band[1];
                    var flags = [];
                    if (supply < spec.minSupplyC || supply > spec.maxSupplyC) flags.push('Supply ' + supply + '°C outside ' + spec.label + ' (' + spec.minSupplyC + '-' + spec.maxSupplyC + '°C)');
                    if (dT > spec.maxDeltaTK) flags.push('ΔT ' + dT + 'K exceeds ' + spec.label + ' max ' + spec.maxDeltaTK + 'K (hotspot risk)');
                    if (dT < band[0] || dT > band[1]) flags.push('ΔT ' + dT + 'K outside typical ' + inp.coolingType + ' band ' + band[0] + '-' + band[1] + 'K');
                    return { class: cls, label: spec.label, supplyTempC: supply, deltaTK: dT, deltaTBand: band, compliant: flags.length === 0, flags: flags };
                },
                /** Uptime/TIA-942-C redundancy topology for a tier. (v2.5.0) */
                topology: function (tier) { return DATA.architecture.tierTopology[tier] || DATA.architecture.tierTopology[3]; },
                /** Structural floor loading (kN/m²) for a cooling type. */
                floorLoading: function (coolingType) { return DATA.architecture.floorLoadingKnM2[coolingType] != null ? DATA.architecture.floorLoadingKnM2[coolingType] : 7.2; },
                /** Engineering design fee = constructionCapex × rate(complexity band). */
                designFee: function (constructionCapex, band) {
                    var rate = DATA.architecture.designFeePct[band] != null ? DATA.architecture.designFeePct[band] : 0.09;
                    return { rate: rate, feeUsd: Math.round((constructionCapex || 0) * rate) };
                }
            },

            /* ── v2.4.0: maintenance strategy model — Layer 8 (Group-2 promotion) ── */
            maintenance: {
                /** Blended labor cost multiplier for a maintenance delivery model:
                 *  internalPortion at 1.0 + vendorPortion at the vendor premium. */
                modelMult: function (maintenanceModel) {
                    var M = DATA.maintenance;
                    var internal = M.modelInternalPortion[maintenanceModel];
                    if (internal == null) internal = M.modelInternalPortion['in-house'];
                    return +(internal + (1 - internal) * M.vendorPremium).toFixed(4);
                },
                /** Expected unplanned failures/year for a tier (T4 rides lower). */
                expectedFailures: function (tier) {
                    return tier === 4 ? DATA.maintenance.expectedFailuresPerYear.tier4
                                      : DATA.maintenance.expectedFailuresPerYear.default;
                },
                /** Reactive failures = planned baseline × reactiveFailureMult. */
                reactiveFailures: function (plannedFailures) {
                    return +((plannedFailures || 0) * DATA.maintenance.reactiveFailureMult).toFixed(3);
                },
                /** Predictive residual failures after CBM failure-reduction. */
                predictiveFailures: function (plannedFailures) {
                    return +((plannedFailures || 0) * (1 - DATA.maintenance.predictiveFailureReduction)).toFixed(3);
                },
                /** Annual downtime cost for a strategy. costPerMinute = $/min of outage. */
                downtimeCost: function (strategy, failures, costPerMinute) {
                    var d = DATA.maintenance.downtime;
                    var minAvg = strategy === 'reactive' ? d.reactiveMinAvg : d.plannedMinAvg;
                    var prob = strategy === 'reactive' ? d.reactiveProb : d.plannedProb;
                    return Math.round((failures || 0) * minAvg * (costPerMinute || 0) * prob);
                },
                /** Critical-facilities staffing benchmark (FTE) — Uptime Institute.
                 *  24/7 manned positions (× ~4.2 FTE for shifts+relief) scaled by
                 *  tier, plus per-MW technicians. (v2.5.0) */
                staffingBenchmark: function (mw, tier) {
                    var s = DATA.maintenance.staffing;
                    var positions = s.positionsByTier[tier] != null ? s.positionsByTier[tier] : s.positionsByTier[3];
                    var shiftFte = positions * s.ftePerPosition;
                    var techFte = (mw || 0) * s.techFtePerMw;
                    var total = Math.max(s.minFte, Math.round(shiftFte + techFte));
                    return { totalFte: total, shiftFte: Math.round(shiftFte), techFte: Math.round(techFte), ftePerMw: mw > 0 ? +(total / mw).toFixed(2) : null };
                }
            },

            /* ── v2.4.0: fuel & generator model — Group-2 promotion ── */
            fuel: {
                /** Diesel consumption (L/h) for a drawn load (kW). */
                consumptionLPerHour: function (loadKw) {
                    return +((loadKw || 0) * DATA.fuelGen.genEfficiencyLPerKwh).toFixed(2);
                },
                /** Backup autonomy hours for a tier. */
                storageHours: function (tier) {
                    return DATA.fuelGen.fuelStorageHoursByTier[tier] != null
                        ? DATA.fuelGen.fuelStorageHoursByTier[tier]
                        : DATA.fuelGen.fuelStorageHoursByTier[3];
                },
                /** Required on-site fuel storage (L) = autonomy hours × full-load L/h. */
                storageLiters: function (loadKw, tier) {
                    return Math.round(RZEngine.models.fuel.storageHours(tier) * RZEngine.models.fuel.consumptionLPerHour(loadKw));
                },
                /** Annual maintenance-test fuel (L): monthly + annual full-load tests. */
                annualTestFuelLiters: function (loadKw) {
                    var t = DATA.fuelGen.test;
                    var hrs = t.monthlyTestHours * 12 + t.annualFullLoadTestHours;
                    return Math.round(hrs * RZEngine.models.fuel.consumptionLPerHour(loadKw));
                },
                /** Annual fuel cost ($) for a runtime-hours scenario at a $/L price. */
                annualFuelCost: function (loadKw, runtimeHours, pricePerLiter) {
                    var price = pricePerLiter != null ? pricePerLiter : DATA.fuelGen.dieselPriceDefaultPerLiter;
                    return Math.round(RZEngine.models.fuel.consumptionLPerHour(loadKw) * (runtimeHours || 0) * price);
                }
            },

            /* ── v2.4.0: capacity planning model — Group-2 promotion ── */
            capacity: {
                /** Phase preset (small|medium|large) with the default ramp attached. */
                preset: function (size) {
                    var p = DATA.capacity.presets[size];
                    if (!p) return null;
                    return p.map(function (ph) {
                        var out = {}; for (var k in ph) out[k] = ph[k];
                        out.occupancyRamp = DATA.capacity.defaultRamp.slice();
                        return out;
                    });
                },
                /** Total ultimate IT capacity (MW) across phases. */
                totalMw: function (phases) {
                    var kw = 0; (phases || []).forEach(function (p) { kw += (p.itLoadKw || 0); });
                    return +(kw / 1000).toFixed(2);
                },
                /** Occupancy fraction at a given year of a ramp (holds steady after). */
                occupancyAt: function (ramp, year) {
                    var r = ramp && ramp.length ? ramp : DATA.capacity.defaultRamp;
                    if (year < 0) return 0;
                    return year < r.length ? r[year] : r[r.length - 1];
                },
                /** PUE-adjusted facility (at-the-meter) load. (v2.5.0) */
                facilityLoad: function (itLoadKw, coolingType, tier) {
                    var pue = 1.5;
                    try { var pm = DATA.pueMatrix[(coolingType || 'air').toLowerCase()]; if (pm) pue = pm['tier' + (tier || 3)] || pm.tier3 || 1.5; } catch (e) { }
                    var fKw = (itLoadKw || 0) * pue;
                    return { facilityLoadKw: Math.round(fKw), facilityLoadMw: +(fKw / 1000).toFixed(2), pueUsed: pue };
                },
                /** Logistic S-curve occupancy at year t for a market type:
                 *  L / (1 + e^(-k(t - tMid))). (CBRE/Uptime-calibrated) */
                occupancyScurve: function (year, marketType) {
                    var p = DATA.capacity.rampProfiles[marketType] || DATA.capacity.rampProfiles.wholesale;
                    if (year < 0) return 0;
                    return +(p.L / (1 + Math.exp(-p.k * (year - p.tMid)))).toFixed(3);
                },
                /** Stranded (committed-but-unoccupied) capacity. (Uptime 2024) */
                strandedCapacity: function (committedKw, occupancy) {
                    var strandedKw = Math.max(0, (committedKw || 0) * (1 - Math.max(0, Math.min(1, occupancy || 0))));
                    var frac = committedKw > 0 ? +(strandedKw / committedKw).toFixed(3) : 0;
                    return { strandedKw: Math.round(strandedKw), strandedFraction: frac, isStranded: frac > DATA.capacity.strandedThreshold };
                },
                /** Which bites first — power or white-space. (v2.5.0) */
                bindingConstraint: function (committedKw, rackKw, whiteFloorM2) {
                    var byPower = (committedKw || 0) / (rackKw || 12);
                    var bySpace = (whiteFloorM2 || 0) / DATA.capacity.rackFootprintM2;
                    var binding = byPower <= bySpace ? 'power' : 'space';
                    return { binding: binding, maxRacksByPower: Math.floor(byPower), maxRacksBySpace: Math.floor(bySpace), racks: Math.floor(Math.min(byPower, bySpace)) };
                }
            },

            /* ── v2.4.0: grid reliability model — Group-2 promotion ── */
            grid: {
                /** Qualitative band label for a grid uptime %. */
                band: function (uptimePct) {
                    var b = DATA.gridReliability.bands;
                    for (var i = 0; i < b.length; i++) { if (uptimePct >= b[i].minUptime) return b[i].label; }
                    return 'Poor';
                },
                /** Annual grid-outage hours from uptime % (the backup-runtime demand). */
                annualOutageHours: function (uptimePct) {
                    var u = Math.max(0, Math.min(100, uptimePct || 0));
                    return +((1 - u / 100) * DATA.hoursPerYear).toFixed(1);
                },
                /** 0-1 grid goodness score (for models.site.score grid factor). Linear
                 *  between the floor (98%→0) and ceiling (99.99%→1) uptime. */
                score: function (uptimePct) {
                    var G = DATA.gridReliability;
                    var s = (uptimePct - G.scoreFloorUptime) / (G.scoreCeilUptime - G.scoreFloorUptime);
                    return +Math.max(0, Math.min(1, s)).toFixed(3);
                }
            },

            /* ── v2.4.0: tax incentives model — Group-2 promotion ── */
            tax: {
                /** Year-1 tax shield ($) from US bonus depreciation on a CAPEX base. */
                bonusDepreciationShield: function (capex, taxRate) {
                    return Math.round((capex || 0) * DATA.tax.usBonusDepreciation2026 * (taxRate || 0));
                },
                /** IRA solar ITC credit ($) on on-site solar CAPEX; +domestic-content
                 *  adder when domesticContent is true. */
                solarItc: function (solarCapex, domesticContent) {
                    var rate = DATA.tax.iraSolarItc + (domesticContent ? DATA.tax.iraDomesticContentBonus : 0);
                    return Math.round((solarCapex || 0) * rate);
                },
                /** State sales-tax saving ($) on equipment for a US state code. */
                stateSalesTaxSaving: function (equipmentCost, stateCode) {
                    var inc = DATA.tax.stateIncentives[stateCode];
                    return inc ? Math.round((equipmentCost || 0) * inc.value) : 0;
                },
                /** Import duty ($) for a representative country (else 0). */
                importDuty: function (equipmentCost, country) {
                    var r = DATA.tax.importDutyByCountry[(country || '').toUpperCase()];
                    return r != null ? Math.round((equipmentCost || 0) * r) : 0;
                },
                /** MACRS accelerated depreciation schedule (US IRS Pub 946) for a
                 *  CAPEX base + recovery class ('5'|'7'|'15'). Returns per-year
                 *  depreciation $, cumulative, and per-year tax shield at taxRate +
                 *  the NPV of the shield at a discount rate. (v2.5.0) */
                macrsDepreciation: function (capex, recoveryClass, taxRate, discountRate) {
                    var sched = DATA.tax.macrs[String(recoveryClass || '5')] || DATA.tax.macrs['5'];
                    var base = capex || 0, tr = taxRate || 0, dr = discountRate != null ? discountRate : 0.10;
                    var rows = [], cum = 0, shieldNpv = 0;
                    for (var y = 0; y < sched.length; y++) {
                        var dep = Math.round(base * sched[y]);
                        var shield = Math.round(dep * tr);
                        cum += dep;
                        shieldNpv += shield / Math.pow(1 + dr, y + 1);
                        rows.push({ year: y + 1, pct: sched[y], depreciation: dep, taxShield: shield, cumulative: cum });
                    }
                    return { recoveryClass: String(recoveryClass || '5'), rows: rows, totalDepreciation: cum, totalShield: Math.round(rows.reduce(function (s, r) { return s + r.taxShield; }, 0)), shieldNpv: Math.round(shieldNpv) };
                }
            },

            /* ── v2.4.0: geo-risk model — Group-2 promotion ── */
            risk: {
                /** Composite natural-hazard risk (0-100) from 0-1 hazard levels
                 *  (1 = worst). Weights renormalize over supplied hazards. */
                geo: function (hazards) {
                    hazards = hazards || {};
                    var W = DATA.geoRisk.weights, present = 0, weighted = 0, breakdown = [], missing = [];
                    for (var k in W) {
                        if (!W.hasOwnProperty(k)) continue;
                        var v = hazards[k];
                        if (v == null || isNaN(v)) { missing.push(k); continue; }
                        var val = Math.max(0, Math.min(1, v));
                        present += W[k]; weighted += W[k] * val;
                        breakdown.push({ key: k, weight: W[k], level: +val.toFixed(3) });
                    }
                    var risk = present > 0 ? +(100 * weighted / present).toFixed(1) : 0;
                    var ins = RZEngine.models.risk.insuranceMultiplier(risk);
                    return { risk: risk, insuranceMultiplier: ins.mult, band: ins.label, breakdown: breakdown, missing: missing, coverage: +present.toFixed(3) };
                },
                /** Insurance premium multiplier + band for a 0-100 geo-risk score. */
                insuranceMultiplier: function (risk) {
                    var b = DATA.geoRisk.insuranceBands;
                    for (var i = 0; i < b.length; i++) { if (risk >= b[i].min) return { mult: b[i].mult, label: b[i].label }; }
                    return { mult: 1.0, label: 'Low' };
                },
                /** Site goodness score (0-1) from geo risk — for models.site.score
                 *  seismic/flood factors (1 = safest). */
                siteScore: function (risk) { return +(1 - Math.max(0, Math.min(100, risk)) / 100).toFixed(3); }
            },

            /* ── v2.4.0: compliance cost model — Group-2 promotion ── */
            compliance: {
                /** Annualized compliance cost from items [{cost, type:'annual'|'one-time'}].
                 *  One-time costs are amortized over DATA.compliance.amortizeOneTimeYears. */
                annualCost: function (items) {
                    var amort = DATA.compliance.amortizeOneTimeYears || 10, total = 0;
                    (items || []).forEach(function (it) {
                        var c = it.cost || 0;
                        total += it.type === 'one-time' ? c / amort : c;
                    });
                    return Math.round(total);
                },
                /** Typical annual cost ($) for a compliance category, else 0. */
                categoryCost: function (category) {
                    var c = DATA.compliance.categoryAnnualUsd[category];
                    return c != null ? c : 0;
                },
                /** Sum of typical annual costs for a set of category keys. */
                baselineAnnual: function (categories) {
                    var self = RZEngine.models.compliance, total = 0;
                    (categories || []).forEach(function (k) { total += self.categoryCost(k); });
                    return total;
                }
            },

            /* ── DC-OS Layer: Tier classification (Uptime-style) ── */
            tier: {
                /** Classify from 0-100 sub-scores + redundancy. Returns {tier,label,score,capped}. */
                classify: function (s) {
                    s = s || {};
                    var W = DATA.tier.weights;
                    var score = (s.power || 0) * W.power + (s.cooling || 0) * W.cooling + (s.network || 0) * W.network + (s.physical || 0) * W.physical + (s.monitoring || 0) * W.monitoring;
                    score = Math.max(0, Math.min(100, +score.toFixed(1)));
                    var band = DATA.tier.bands.find(function (b) { return score >= b.min; }) || DATA.tier.bands[DATA.tier.bands.length - 1];
                    var t = band.tier, label = band.label, capped = false;
                    var red = (s.redundancy || '').toLowerCase().replace(/\s+/g, '');
                    var cap = DATA.tier.redundancyCap[red];
                    if (cap != null && t > cap) { t = cap; label = (DATA.tier.bands.find(function (b) { return b.tier === cap; }) || band).label; capped = true; }
                    return { tier: t, label: label, score: score, capped: capped };
                },
                /** Full 6-band tier advisor (tier-advisor.html). input = component key-value map.
                 *  Returns {composite, tier, grade, tierNum, desc, scores, canT3, canT4, floorApplied}. */
                advise: function (input) {
                    input = input || {};
                    var SM = DATA.tier.scoreMaps;
                    function gs(key) { var m = SM[key]; return (m && input[key] != null) ? (m[input[key]] || 0) : 0; }
                    function fuelScore(h) {
                        h = +h || 0;
                        if (h <= 8)  { return (h / 8) * 30; }
                        if (h <= 24) { return 30 + ((h - 8) / 16) * 30; }
                        if (h <= 72) { return 60 + ((h - 24) / 48) * 25; }
                        return Math.min(100, 85 + ((h - 72) / 648) * 15);
                    }
                    var powerScore    = gs('utilityFeeds') * 0.20 + gs('genConfig') * 0.25 + gs('upsConfig') * 0.20 + gs('upsTopo') * 0.10 + gs('atsConfig') * 0.10 + gs('pduRedundancy') * 0.10 + fuelScore(input.fuelAutonomyHrs) * 0.05;
                    var coolingScore  = gs('coolRedundancy') * 0.50 + gs('coolDistribution') * 0.30 + gs('coolType') * 0.20;
                    var networkScore  = gs('netEntry') * 0.45 + gs('carrierDiv') * 0.30 + gs('meetMeRoom') * 0.25;
                    var physicalScore = gs('fireSuppression') * 0.35 + gs('accessControl') * 0.35 + gs('monitoring') * 0.30;
                    var monitorScore  = gs('monitoring');
                    var regionalScore = input.regionalScore != null ? +input.regionalScore : 50;
                    var W = DATA.tier.adviseWeights;
                    var compositeRaw  = powerScore * W.power + coolingScore * W.cooling + networkScore * W.network + physicalScore * W.physical + monitorScore * W.monitoring + regionalScore * W.regional;
                    var uF = input.utilityFeeds || '', gC = input.genConfig || '', uC = input.upsConfig || '';
                    var pR = input.pduRedundancy || '', cR = input.coolRedundancy || '', nE = input.netEntry || '';
                    var cD = input.coolDistribution || '';
                    var canT3 = (uF === 'dual_same' || uF === 'dual_diverse' || uF === 'onsite') && (gC === 'n1' || gC === '2n' || gC === '2n1') && (uC === 'n1' || uC === '2n' || uC === '2n1' || uC === 'distributed') && cD !== 'single';
                    var canT4 = uF === 'dual_diverse' && (gC === '2n' || gC === '2n1') && (uC === '2n' || uC === '2n1') && (pR === 'dual' || pR === 'triple') && (cR === '2n' || cR === '2n1') && (nE === 'dual_diverse' || nE === 'three_plus');
                    var floorApplied = false;
                    if (compositeRaw >= 75 && !canT3) { compositeRaw = Math.min(compositeRaw, 74); floorApplied = true; }
                    if (compositeRaw >= 90 && !canT4) { compositeRaw = Math.min(compositeRaw, 89); floorApplied = true; }
                    var composite = Math.round(compositeRaw);
                    var gb = DATA.tier.gradeBands;
                    var band = gb.find(function (b) { return composite >= b.min; }) || gb[gb.length - 1];
                    return {
                        composite: composite, tier: band.label, grade: band.grade, tierNum: band.tierNum, desc: band.desc,
                        scores: { power: +powerScore.toFixed(1), cooling: +coolingScore.toFixed(1), network: +networkScore.toFixed(1), physical: +physicalScore.toFixed(1), monitoring: +monitorScore.toFixed(1), regional: +regionalScore.toFixed(1) },
                        canT3: canT3, canT4: canT4, floorApplied: floorApplied
                    };
                }
            },

            /* ── DC-OS Layer: Fire suppression sizing (NFPA 2001) ── */
            fire: {
                /** Clean-agent quantity (kg) for a room. input {volumeM3, agent, tempC, concentration?}.
                 *  Halocarbon: W = V/s · C/(100−C), s = k1+k2·T. Inert: V_agent = V·ln(100/(100−C)). */
                agentQuantity: function (input) {
                    input = input || {};
                    var a = DATA.fire.agents[(input.agent || 'novec1230').toLowerCase()] || DATA.fire.agents.novec1230;
                    var V = Math.max(0, input.volumeM3 || 0);
                    var T = input.tempC != null ? input.tempC : 20;
                    var C = input.concentration != null ? input.concentration : a.designC;
                    if (a.type === 'inert') {
                        var volAgent = V * Math.log(100 / (100 - C)); // m3 of agent at design conc
                        return { agent: a.label, type: 'inert', agentVolumeM3: +volAgent.toFixed(2), designConcentration: C };
                    }
                    var s = a.k1 + a.k2 * T;
                    var kg = (V / s) * (C / (100 - C));
                    return { agent: a.label, type: 'halocarbon', massKg: +kg.toFixed(1), specificVolume: +s.toFixed(4), designConcentration: C };
                },
                /** Rich NFPA 2001/72/855 fire assessment (fire-engine.js + fire-model.js).
                 *  input {volumeM3, agent, tempC?, areaM2?, packKWh?, batteryChem?}.
                 *  Returns mass/volume + NOAEL safety + CO2e + detector count + Li-ion TR section. */
                assess: function (input) {
                    input = input || {};
                    var agentKey = (input.agent || 'novec1230').toLowerCase();
                    var a = DATA.fire.agents[agentKey] || DATA.fire.agents.novec1230;
                    var V = Math.max(0, input.volumeM3 || 0);
                    var T = input.tempC != null ? input.tempC : 20;
                    var C = a.designConcClassA != null ? a.designConcClassA : a.designC;
                    var out = { agent: a.label, type: a.type, designConcPct: C };
                    if (a.type === 'inert') {
                        out.agentVolumeM3 = +(V * Math.log(100 / (100 - C))).toFixed(2);
                        if (a.cylinderFillM3Typical) { out.cylinders = Math.ceil(out.agentVolumeM3 / a.cylinderFillM3Typical); }
                    } else {
                        var s = a.k1 + a.k2 * T;
                        out.massKg = +(V / s * (C / (100 - C))).toFixed(1);
                        out.specificVolume = +s.toFixed(4);
                        if (a.cylinderFillKgTypical) { out.cylinders = Math.ceil(out.massKg / a.cylinderFillKgTypical); }
                        if (a.gwp100 != null) { out.co2eTonnes = +(out.massKg * a.gwp100 / 1000).toFixed(2); }
                    }
                    out.noaelPct = a.noaelPct; out.loaelPct = a.loaelPct;
                    out.safetyMarginPct = a.noaelPct != null ? +(a.noaelPct - C).toFixed(2) : null;
                    out.occupiableOk = a.noaelPct != null ? C <= a.noaelPct : null;
                    var area = input.areaM2 || 0;
                    out.spotDetectors = area > 0 ? Math.ceil(area / DATA.fire.bands.spotDetectorAreaM2.max) : null;
                    if (input.packKWh && input.packKWh > 0) {
                        var chemKey = (input.batteryChem || 'nmc').toLowerCase();
                        var bat = DATA.fire.battery[chemKey] || DATA.fire.battery.nmc;
                        var trFactor = DATA.fire.trHeatFactor[chemKey] != null ? DATA.fire.trHeatFactor[chemKey] : DATA.fire.trHeatFactor.nmc;
                        var heatMJ = +(input.packKWh * 3.6 * trFactor).toFixed(0);
                        var gasM3  = +(input.packKWh * 1000 * bat.offGasLPerWh / 1000).toFixed(1);
                        var gasConc = V > 0 ? +(gasM3 / V * 100).toFixed(2) : null;
                        out.liIon = { chem: bat.name, runawayHeatMJ: heatMJ, offGasM3: gasM3, roomOffGasConcPct: gasConc, offGasLflOk: gasConc != null ? gasConc < DATA.fire.offGas.ventGasLflPct * (DATA.fire.bands.gasDetectAlarmPctLfl.max / 100) : null };
                    }
                    return out;
                }
            },

            /* ── DC-OS Layer: CDU / liquid-cooling sizing ── */
            cdu: {
                /** Coolant flow + CDU count for a liquid-cooled load. input {itKw, deltaT}.
                 *  flow(m3/s) = Q(kW) / (ρ·cp·ΔT); returns L/min + N+1 CDU units. */
                size: function (input) {
                    input = input || {};
                    var kw = Math.max(0, input.itKw || 0);
                    var dT = input.deltaT || 10; // K
                    var flowM3s = kw / (DATA.cdu.waterRho * DATA.cdu.waterCp * dT);
                    var flowLpm = flowM3s * 60000;
                    var units = Math.max(1, Math.ceil(kw / DATA.cdu.cduUnitKw));
                    return { flowLpm: +flowLpm.toFixed(1), flowM3h: +(flowM3s * 3600).toFixed(2), cduUnits: units, cduUnitsRedundant: units + 1, deltaT: dT };
                },
                /** Thermohydraulic analysis (cdu-engine.js). Darcy-Weisbach/Haaland dP + pump power + dew point.
                 *  input {itKw, deltaTK?, supplyC?, pipeDiamMm?, pipeLengthM?, rhPct?, tAirC?, hxEffectiveness?, facilitySupplyC?}.
                 *  Returns flow + velocity + Re + f + dP + pumpKw + HX approach + dew point + dew safety flag. */
                hydraulics: function (input) {
                    input = input || {};
                    var kw = Math.max(0, input.itKw || 0);
                    var dT = input.deltaTK || 10;
                    var supplyC = input.supplyC != null ? input.supplyC : 20;
                    var returnC = supplyC + dT;
                    var Tavg = (supplyC + returnC) / 2;
                    var rho = 1000.6 - 0.0476 * Tavg - 0.0034 * Tavg * Tavg;
                    var mu  = 2.414e-5 * Math.pow(10, 247.8 / (Tavg + 133.0));
                    var rhoKgL = rho / 1000;
                    var flowLpm = kw * 60 / (rhoKgL * 4.186 * dT);
                    var D = input.pipeDiamMm || 100;
                    var L = input.pipeLengthM || 50;
                    var Dm = D / 1000;
                    var area = Math.PI * (Dm / 2) * (Dm / 2);
                    var qm3s = flowLpm / 1000 / 60;
                    var velMs = qm3s / area;
                    var Re = rho * velMs * Dm / mu;
                    var rel = DATA.cdu.phys.absRoughnessMm / D;
                    var f;
                    if (Re < 2300) {
                        f = 64 / Re;
                    } else {
                        var t = Math.pow(rel / 3.7, 1.11) + 6.9 / Re;
                        var inv = -1.8 * (Math.log(t) / Math.LN10);
                        f = 1 / (inv * inv);
                    }
                    var dPa  = f * (L / Dm) * (rho * velMs * velMs / 2);
                    var dpBar = +(dPa / DATA.cdu.phys.barToPa).toFixed(3);
                    var hydrKw = flowLpm * dpBar / 600;
                    var pumpKw = +(hydrKw / DATA.cdu.pump.pumpEff / DATA.cdu.pump.motorEff).toFixed(2);
                    var nPumps = Math.ceil(flowLpm / DATA.cdu.pump.perPumpLpmDefault) + 1;
                    var eps = input.hxEffectiveness || 0.85;
                    var fSupply = input.facilitySupplyC != null ? input.facilitySupplyC : supplyC - 3;
                    var approachK = +((1 - eps) * (returnC - fSupply)).toFixed(1);
                    var rhPct = input.rhPct != null ? input.rhPct : 50;
                    var tAir  = input.tAirC  != null ? input.tAirC  : 25;
                    var mA = DATA.cdu.phys.dewMagnusA, mB = DATA.cdu.phys.dewMagnusB;
                    var gamma = Math.log(rhPct / 100) + (mA * tAir) / (mB + tAir);
                    var dewC = +(mB * gamma / (mA - gamma)).toFixed(1);
                    var dewMarginK = +(supplyC - dewC).toFixed(1);
                    var dewSafeOk = dewMarginK >= DATA.cdu.bands.dewMarginK.min;
                    return {
                        flowLpm: +flowLpm.toFixed(1), velocityMs: +velMs.toFixed(2),
                        reynolds: Math.round(Re), frictionFactor: +f.toFixed(5),
                        dpBar: dpBar, pumpKw: pumpKw, pumpsNplus1: nPumps,
                        hxApproachK: approachK, dewPointC: dewC, dewMarginK: dewMarginK, dewSafeOk: dewSafeOk
                    };
                }
            },

            /* ── DC-OS Layer: Spares (EOQ / reorder) ── */
            spares: {
                /** Economic order quantity: √(2·D·S / H). */
                /* ── M2b shared statistical kernels (exposed + upgraded) ── */
                /** Inverse normal CDF Phi^-1(p) — Acklam (2003) rational approx,
                 *  |relative error| < 1.15e-9 (was BSM 1977, |e|<4.5e-4). */
                normInv: function (p) {
                    if (!(p > 0)) { return -Infinity; } if (!(p < 1)) { return Infinity; }
                    var S = DATA.spares, a = S.acklamA, b = S.acklamB, c = S.acklamC, d = S.acklamD, pl = S.acklamPLow, ph = 1 - pl;
                    var q, r, x;
                    if (p < pl) {
                        q = Math.sqrt(-2 * Math.log(p));
                        x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
                    } else if (p <= ph) {
                        q = p - 0.5; r = q * q;
                        x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
                            (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
                    } else {
                        q = Math.sqrt(-2 * Math.log(1 - p));
                        x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
                    }
                    return x;
                },
                /** Normal CDF Phi(x) — Abramowitz-Stegun 26.2.17 rational, |e| <= 7.5e-8. */
                normCdf: function (x) {
                    var t = 1 / (1 + 0.2316419 * Math.abs(x));
                    var poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
                    var phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) * poly;
                    return x >= 0 ? phi : 1 - phi;
                },
                /** Poisson CDF P(X<=k; lambda) — exact partial sum; normal approx
                 *  (continuity-corrected) only when lambda > 200. */
                poissonCdf: function (k, lambda) {
                    if (lambda <= 0) { return (k >= 0) ? 1 : 0; }
                    if (lambda > 200) { return RZEngine.models.spares.normCdf((k + 0.5 - lambda) / Math.sqrt(lambda)); }
                    var sum = 0, term = Math.exp(-lambda);
                    if (!isFinite(term)) { return RZEngine.models.spares.normCdf((k + 0.5 - lambda) / Math.sqrt(lambda)); }
                    for (var i = 0; i <= k; i++) { sum += term; term *= lambda / (i + 1); if (!isFinite(term)) { break; } }
                    return Math.min(1, sum);
                },
                eoq: function (input) {
                    input = input || {};
                    var D = Math.max(0, input.annualDemand || 0), S = input.orderCost || 0, H = input.holdingCostPerUnit || 0;
                    if (H <= 0 || D <= 0) return { eoq: 0, orders: 0 };
                    var q = Math.sqrt((2 * D * S) / H);
                    return { eoq: Math.ceil(q), orders: +(D / q).toFixed(1), annualHolding: Math.round((q / 2) * H), annualOrdering: Math.round((D / q) * S) };
                },
                /** Reorder point = demand/day · leadDays + safety stock. */
                reorderPoint: function (input) {
                    input = input || {};
                    var dpd = input.demandPerDay || 0, lead = input.leadDays || 0, safety = input.safetyStock || 0;
                    return Math.ceil(dpd * lead + safety);
                },
                /** Newsvendor critical-fractile model (spares-readiness-calculator.html calcStock()).
                 *  CR = Cu/(Cu+Co); Q* via Φ⁻¹(CR) Normal or Poisson for low-demand movers.
                 *  input {unitCost, understockCostPerEvent, carryRatePct, partLifeYrs,
                 *         muAnnual, sigmaAnnual, ltWeeks, ltSigmaWeeks, fillRatePct, poissonMode?}.
                 *  Returns {cr, qStar, safetyStock, rop, fillAchieved, annualCost, muLT, sigLT, usedPoissonMode}. */
                newsvendor: function (input) {
                    input = input || {};
                    var unitCost  = Math.max(1, input.unitCost || 4500);
                    var cu        = Math.max(1, input.understockCostPerEvent || 85000);
                    var carryRate = Math.max(0.01, Math.min(1, (input.carryRatePct || 25) / 100));
                    var partLife  = Math.max(1, input.partLifeYrs || 8);
                    var muA       = Math.max(0.01, input.muAnnual || 1.0);
                    var sigA      = Math.max(0, input.sigmaAnnual != null ? input.sigmaAnnual : muA * 0.6);
                    var ltWeeks   = Math.max(1, input.ltWeeks || 16);
                    var ltSigma   = Math.max(0, input.ltSigmaWeeks != null ? input.ltSigmaWeeks : 4);
                    var fillRate  = Math.max(0.5, Math.min(0.9999, (input.fillRatePct || 99) / 100));
                    /* M2b: delegate to the shared exposed kernels (Acklam Phi^-1,
                     * A&S Phi, exact Poisson) — one implementation, gate-verified. */
                    var normInv = RZEngine.models.spares.normInv;
                    var normCDF = RZEngine.models.spares.normCdf;
                    var poissonCDF = RZEngine.models.spares.poissonCdf;
                    var L       = ltWeeks / 52;
                    var sigL    = ltSigma / 52;
                    var muLT    = muA * L;
                    var sigLT   = Math.sqrt(L * sigA * sigA + muA * muA * sigL * sigL);
                    var co      = carryRate * unitCost * partLife;
                    var cr      = Math.max(0.001, Math.min(0.999, cu / (cu + co)));
                    var usePoisson = input.poissonMode === false ? false : (!!input.poissonMode || muLT < DATA.spares.poissonThresholdMuLt);
                    var qStar;
                    if (usePoisson) {
                        qStar = 0;
                        while (poissonCDF(qStar, muLT) < cr && qStar < 1000) { qStar++; }
                    } else {
                        qStar = Math.max(0, Math.ceil(muLT + normInv(cr) * sigLT));
                    }
                    var zFR = normInv(fillRate);
                    var ss  = Math.max(0, Math.ceil(zFR * sigLT));
                    var rop = Math.max(0, Math.ceil(muLT + ss));
                    var fillAchieved = usePoisson ? poissonCDF(qStar, muLT) : normCDF((qStar - muLT) / Math.max(sigLT, 1e-9));
                    var annualCost = (co / partLife) * Math.max(0, qStar - muLT) + cu * muA * (1 - fillAchieved);
                    return {
                        cr: +cr.toFixed(4), qStar: qStar, safetyStock: ss, rop: rop,
                        fillAchieved: +fillAchieved.toFixed(4), annualCost: Math.round(annualCost),
                        muLT: +muLT.toFixed(3), sigLT: +sigLT.toFixed(3), usedPoissonMode: usePoisson
                    };
                }
            },

            /* ── DC-OS Layer 13: deterministic decision engine (shared brain) ──
             * Always-on: reads an engine-output snapshot + optional constraints/
             * objectives → explainable, never-empty recommendations. Mirrors the
             * DCMOC deterministic provider so the static site + DCMOC share it. */
            decision: {
                recommend: function (ctx, constraints, objectives) {
                    ctx = ctx || {}; constraints = constraints || {}; if (!Array.isArray(objectives)) objectives = [];
                    var D2 = DATA.decision, recs = [], rationale = [];
                    var inp = ctx.inputs || {}, tier = inp.tier || 3;
                    var itKw = inp.itLoadKw || 0, mw = itKw / 1000, cooling = (inp.coolingType || 'air').toLowerCase();
                    var clamp01 = function (x) { return Math.max(0, Math.min(1, x)); };
                    var add = function (title, detail, conf, tags, engine, obs, rule, concl, sev) {
                        recs.push({ title: title, detail: detail, confidence: conf, tags: tags, _sev: sev === 'critical' ? 3 : sev === 'warn' ? 2 : 1 });
                        rationale.push({ engine: engine, observation: obs, rule: rule, conclusion: concl, severity: sev });
                    };
                    // perKw vs band
                    var perKw = ctx.capex && ctx.capex.perKw;
                    if (perKw) { var band = D2.perKwBand[tier]; if (perKw > band.premium) add('Cost/kW above tier benchmark', '$' + Math.round(perKw).toLocaleString() + '/kW exceeds the Tier ' + tier + ' premium band (~$' + (band.premium / 1000).toFixed(0) + 'k) — value-engineer cooling/redundancy scope.', 0.7, ['capex', 'cost'], 'capex', 'perKw ' + Math.round(perKw) + ' > premium ' + band.premium, 'perKw>band', 'flag cost premium', 'warn'); }
                    // PUE vs target
                    var pue = ctx.carbon && ctx.carbon.pue, pueT = constraints.maxPue || D2.pueTarget[cooling] || 1.5;
                    if (pue && pue > pueT + 0.03) add('Improve PUE toward ≤ ' + pueT.toFixed(2), 'Modelled PUE ' + pue.toFixed(2) + ' exceeds the ' + pueT.toFixed(2) + ' target for ' + cooling + ' — liquid/rear-door cooling, higher chilled-water temps, economisation.', 0.72, ['pue', 'cooling'], 'sustainability', 'PUE ' + pue.toFixed(2) + ' > ' + pueT.toFixed(2), 'pue>target', 'flag PUE gap', 'warn');
                    // availability vs tier
                    var av = ctx.reliability && ctx.reliability.availabilityPct, avT = constraints.minAvailabilityPct || D2.tierAvailability[tier];
                    if (av != null && av < avT - 0.002) add('Raise redundancy to hit tier availability', 'Availability ' + av.toFixed(3) + '% below the Tier ' + tier + ' target ' + avT.toFixed(3) + '% — add UPS/gen/distribution paths.', 0.75, ['reliability', 'redundancy'], 'reliability', 'avail ' + av + ' < ' + avT, 'avail<target', 'raise redundancy', 'warn');
                    // financial
                    var pay = ctx.financial && ctx.financial.paybackYears, irr = ctx.financial && ctx.financial.irrPct;
                    if (pay != null && isFinite(pay)) { var good = pay <= 7 && (irr == null || irr >= 12); add(good ? 'Return profile is attractive' : 'Strengthen the return profile', 'Payback ≈ ' + pay.toFixed(1) + ' yr' + (irr != null ? ', IRR ' + irr.toFixed(1) + '%' : '') + (good ? ' — clears a typical hurdle.' : ' — raise $/kW revenue, phase CAPEX, or cut OPEX via PUE.'), good ? 0.6 : 0.64, ['financial', 'roi'], 'financial', 'payback ' + pay.toFixed(1) + 'yr', 'payback vs 7yr', good ? 'attractive' : 'needs work', good ? 'info' : 'warn'); }
                    // density → cooling
                    if ((cooling === 'air') && mw >= 10) add('Adopt direct liquid cooling', 'At ' + mw.toFixed(1) + ' MW the thermal density favours liquid/immersion — lower PUE + footprint, de-risks AI/HPC density.', 0.75, ['cooling', 'architecture'], 'architecture', mw.toFixed(1) + ' MW on air', 'high density', 'recommend liquid', 'info');
                    // schedule
                    var months = ctx.capex && ctx.capex.timelineMonths;
                    if (months && (constraints.deadlineMonths ? months > constraints.deadlineMonths : months > 30)) add('Consider modular / phased delivery', months + ' mo build — modular/phasing pulls in first-power and de-risks long-lead gear.', 0.6, ['schedule', 'construction'], 'construction', 'timeline ' + months + ' mo', 'long timeline', 'phasing', 'info');
                    // site
                    var site = ctx.site && ctx.site.score;
                    if (site != null && site < 60) add('Mitigate site weaknesses', 'Composite site score ' + site + '/100 below the comfortable band — revisit power/grid/water/hazard or weigh an alternative site.', 0.62, ['site', 'risk'], 'site', 'site ' + site + ' < 60', 'low site', 'flag site', 'warn');
                    // objective ranking
                    var OBJ = { maxRoi: ['roi', 'financial', 'cost', 'capex'], minCost: ['cost', 'capex'], minCarbon: ['carbon', 'pue'], maxReliability: ['reliability', 'redundancy'], fastestDelivery: ['schedule', 'construction'] };
                    var objTags = {}; objectives.forEach(function (o) { (OBJ[o] || []).forEach(function (t) { objTags[t] = 1; }); });
                    recs.sort(function (a, b) { var sa = a._sev * 10 + a.confidence * 5 + (a.tags.some(function (t) { return objTags[t]; }) ? 4 : 0); var sb = b._sev * 10 + b.confidence * 5 + (b.tags.some(function (t) { return objTags[t]; }) ? 4 : 0); return sb - sa; });
                    var flags = rationale.filter(function (r) { return r.severity !== 'info'; }).length;
                    var out = recs.slice(0, 6).map(function (r) { return { title: r.title, detail: r.detail, confidence: r.confidence, tags: r.tags }; });
                    if (!out.length) out.push({ title: 'Design is balanced — no material flags', detail: 'Tier ' + tier + ' · ' + mw.toFixed(1) + ' MW' + (pue ? ' · PUE ' + pue.toFixed(2) : '') + (pay != null ? ' · payback ~' + pay.toFixed(1) + ' yr' : '') + '. Cost, efficiency, reliability, schedule within best-practice bands.', confidence: clamp01(0.5 + 0.1 * rationale.length), tags: ['balanced'] });
                    var summary = 'Tier ' + tier + ' · ' + (mw ? mw.toFixed(0) + ' MW' : 'capacity TBD') + (pue ? ' · PUE ' + pue.toFixed(2) : '') + (pay != null ? ' · payback ~' + pay.toFixed(1) + ' yr' : '') + ' — ' + (flags > 0 ? flags + ' optimization' + (flags > 1 ? 's' : '') + ' identified' : 'balanced within best-practice bands') + '.';
                    return { summary: summary, recommendations: out, rationale: rationale, metrics: { feasible: true, confidence: clamp01(0.4 + 0.1 * rationale.length) }, provider: 'deterministic', disclaimer: D2.disclaimer };
                },
                /** TOPSIS multi-criteria ranking of options (site/design alternatives).
                 *  options=[{name, values:{crit:number}}]; criteria=[{key, weight,
                 *  benefit:true|false}]. Returns options + closeness score (0-1, higher
                 *  = closer to the ideal) ranked best→worst. (v2.5.0 AHP/TOPSIS.) */
                rankOptions: function (options, criteria) {
                    options = options || []; criteria = criteria || [];
                    if (!options.length || !criteria.length) return [];
                    // vector-normalize each criterion column, then weight
                    var norm = {};
                    criteria.forEach(function (c) {
                        var ss = 0; options.forEach(function (o) { var v = (o.values && o.values[c.key]) || 0; ss += v * v; });
                        norm[c.key] = Math.sqrt(ss) || 1;
                    });
                    var wsum = criteria.reduce(function (s, c) { return s + (c.weight || 1); }, 0) || 1;
                    // weighted normalized matrix + ideal best/worst
                    var best = {}, worst = {};
                    criteria.forEach(function (c) {
                        var w = (c.weight || 1) / wsum;
                        var vals = options.map(function (o) { return ((o.values && o.values[c.key]) || 0) / norm[c.key] * w; });
                        var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
                        best[c.key] = c.benefit === false ? mn : mx;
                        worst[c.key] = c.benefit === false ? mx : mn;
                    });
                    var scored = options.map(function (o) {
                        var dB = 0, dW = 0;
                        criteria.forEach(function (c) {
                            var w = (c.weight || 1) / wsum;
                            var v = ((o.values && o.values[c.key]) || 0) / norm[c.key] * w;
                            dB += Math.pow(v - best[c.key], 2); dW += Math.pow(v - worst[c.key], 2);
                        });
                        dB = Math.sqrt(dB); dW = Math.sqrt(dW);
                        var closeness = (dB + dW) > 0 ? +(dW / (dB + dW)).toFixed(4) : 0;
                        return { name: o.name, closeness: closeness, values: o.values };
                    });
                    scored.sort(function (a, b) { return b.closeness - a.closeness; });
                    scored.forEach(function (s, i) { s.rank = i + 1; });
                    return scored;
                }
            },

            /* ── BOQ Ship-1: Bill-of-Quantities decomposition (Layer, reconciled) ──
             * Decomposes a computed CapexResult.costs map into a hierarchical BOQ whose
             * discipline sums RECONCILE to the parametric category $ (single source of
             * truth). Pure function of DATA.boq + the passed costs/metrics — no economic
             * literal in the body. */
            boq: {
                /* driver values from CapexResult.metrics + input. Includes the base drivers
                 * AND param-conditional drivers auto-wired to input.* (seismicZone, fireType,
                 * upsType, genType, fuelHours, redundancy, coolingType, buildingType, rackType).
                 * Each conditional driver already folds in the small paramFactors multiplier so
                 * a leaf just references it via `driver`. */
                drivers: function (costs, metrics, input) {
                    var B = DATA.boq, PF = B.paramFactors, E = B.equipmentSizing;
                    input = input || {};
                    var mw = (input.itLoad != null ? input.itLoad : 0) / 1000;
                    var itKw = (input.itLoad != null ? input.itLoad : 0);
                    var racks = metrics && metrics.racks ? metrics.racks : 0;
                    var floorSpaceM2 = metrics && metrics.floorSpace ? metrics.floorSpace : 0;
                    var gfaM2 = mw * B.gfaM2PerMw;
                    var pue = (metrics && metrics.pue) || 1.4;
                    /* Cooling DUTY = heat to reject ≈ IT load: essentially 100% of IT
                     * power becomes heat removed by the cooling plant. The (PUE−1)
                     * overhead is the cooling plant's OWN power (fans/pumps/chillers),
                     * NOT extra heat in the white space — so CRAH/CDU count + coolant
                     * charge size to IT kW, not IT×PUE (fixed: was overcounting ×PUE). */
                    var coolingKw = itKw;
                    var protectedM3 = mw * 1500;                           /* ~1500 m³/MW protected (2kW/m² × ~5m) */

                    /* ── param-conditional inputs (with page-DOM defaults) ── */
                    var seismicZone = input.seismicZone || 'zone2';   /* zone2 default — matches CapexEngine cost basis (consistency) */
                    var fireType    = input.fireType || 'novec';
                    var upsType     = input.upsType || 'modular';
                    var genType     = input.genType || 'diesel';   /* informational — fuel volume is diesel-store screening */
                    var fuelHours   = input.fuelHours != null ? input.fuelHours : 48;
                    var red         = (input.redundancy || 'n1').toLowerCase().replace(/\s+/g, '');
                    var coolingType = input.coolingType || 'air';
                    var rackType    = input.rackType || 'standard';

                    var pathMult    = PF.redundancyPathMult[red] != null ? PF.redundancyPathMult[red] : 1.0;
                    var seismicReb  = PF.seismicRebarMult[seismicZone] != null ? PF.seismicRebarMult[seismicZone] : 1.0;
                    var seismicBr   = PF.seismicBraceMult[seismicZone] != null ? PF.seismicBraceMult[seismicZone] : 1.0;

                    /* equipment N counts (mirror equipmentSchedule sizing) */
                    var upsN     = itKw > 0 ? Math.ceil(itKw / E.upsModuleKw) : 0;
                    var genN     = itKw > 0 ? Math.ceil((itKw * pue) / E.gensetKw) : 0;
                    var txN      = itKw > 0 ? Math.ceil((itKw * pue) / (E.transformerMva * 1000 * E.transformerPf)) : 0;
                    var chillerN = itKw > 0 ? Math.ceil(itKw / E.chillerKw) : 0;
                    var cduTotal = itKw > 0 ? Math.ceil(itKw / E.cduKw) : 0;
                    var crahTotal= itKw > 0 ? Math.ceil(itKw / E.crahKw) : 0;

                    var cduFrac  = PF.cduFrac[coolingType] != null ? PF.cduFrac[coolingType] : 0;
                    var pduPer   = PF.pduPerRackType[rackType] != null ? PF.pduPerRackType[rackType] : 0.08;
                    var cleanKgM3= PF.cleanAgentKgPerM3[fireType] != null ? PF.cleanAgentKgPerM3[fireType] : 0;

                    return {
                        mw: mw, itKw: itKw, racks: racks, floorSpaceM2: floorSpaceM2, gfaM2: gfaM2,
                        coolingKw: coolingKw, protectedM3: protectedM3, lump: 1,
                        /* structural — seismic-scaled rebar/bracing quantity bases */
                        rebarKgFactor: gfaM2 * seismicReb,
                        seismicBraceT: gfaM2 * seismicBr,
                        /* electrical — redundancy path-scaled equipment counts */
                        txMva: txN * E.transformerMva * pathMult,
                        feederPaths: mw * pathMult,
                        upsPaths: upsN * pathMult,
                        upsBatt: upsN * pathMult * (PF.upsBattPerModule[upsType] != null ? PF.upsBattPerModule[upsType] : 1),
                        stsCount: upsN * pathMult,
                        genPaths: genN * pathMult,
                        pduCount: racks * pduPer,
                        /* fuel — tank m³ from fuelHours × MW (genType informational) */
                        fuelTankM3: mw * fuelHours * PF.fuelTankM3PerMwHour,
                        /* cooling — CDU vs CRAH split by cooling type, path-scaled chillers */
                        chillerPaths: chillerN * pathMult,
                        cduUnits: cduTotal * cduFrac,
                        crahUnits: crahTotal * (1 - cduFrac),
                        dlcRacks: racks * cduFrac,
                        /* fire — fireType-driven agent charge / kit / sprinkler */
                        cleanAgentKg: protectedM3 * cleanKgM3,
                        cleanAgentM3: protectedM3 * (PF.cleanAgentKitM3Frac[fireType] != null ? PF.cleanAgentKitM3Frac[fireType] : 0),
                        sprinklerM2: floorSpaceM2 * (PF.sprinklerFrac[fireType] != null ? PF.sprinklerFrac[fireType] : 0)
                    };
                },
                /* Build reconciled discipline BOQ from costs{} + drivers. locMult scales
                 * material rates back toward the region (default 1 = US baseline). */
                generate: function (costs, metrics, input, opts) {
                    opts = opts || {};
                    var B = DATA.boq;
                    var loc = opts.locMult != null ? opts.locMult : 1.0;
                    var drivers = RZEngine.models.boq.drivers(costs, metrics, input);
                    var disciplines = [];
                    B.disciplines.forEach(function (d) {
                        var catTotal = 0;
                        d.categories.forEach(function (c) { catTotal += (costs && costs[c] ? costs[c] : 0); });
                        if (!(catTotal > 0)) return;
                        /* build every subsystem's raw lines (3-level: discipline → subsystem → line) */
                        var subMap = B.takeoff[d.key] || {};
                        var subKeys = Object.keys(subMap);
                        var buildLine = function (t) {
                            var qty = (drivers[t.driver] != null ? drivers[t.driver] : 0) * t.ratio;
                            var rate = (B.unitRates[t.rateKey] && B.unitRates[t.rateKey].usd) || 0;
                            rate = rate * loc;
                            var mat = qty * rate;
                            var labor = mat * (t.laborPct != null ? t.laborPct : 0);
                            return { desc: t.desc, spec: t.spec, unit: t.unit, subsystem: t.__sub, driver: t.driver, qty: qty, unitRate: rate, matCost: mat, laborCost: labor, total: mat + labor, confidence: t.confidence, source: t.source };
                        };
                        var subsystems = subKeys.map(function (sk) {
                            var sub = subMap[sk];
                            var lines = (sub.lines || []).map(function (t) { var tt = {}; for (var k in t) tt[k] = t[k]; tt.__sub = sk; return buildLine(tt); });
                            return { key: sk, label: sub.label, lines: lines };
                        });
                        /* flat union of ALL subsystem lines (backward-compat consumers read .lines) */
                        var flat = [];
                        subsystems.forEach(function (s) { s.lines.forEach(function (l) { flat.push(l); }); });
                        /* ONE reconcileFactor per DISCIPLINE = categoryTotal / Σ(ALL subsystem line
                         * totals) — scale every line in every subsystem so the discipline's line
                         * sum ≡ categoryTotal exactly (SSOT invariant preserved across the deepen). */
                        var bottomUp = flat.reduce(function (s, l) { return s + l.total; }, 0);
                        var reconcileFactor = bottomUp > 0 ? catTotal / bottomUp : 1;
                        if (bottomUp > 0) {
                            flat.forEach(function (l) { l.matCost *= reconcileFactor; l.laborCost *= reconcileFactor; l.total *= reconcileFactor; l.unitRate = l.qty > 0 ? l.total / l.qty : l.unitRate; });
                        } else if (subsystems.length) {
                            /* zero bottom-up but nonzero category $ (all drivers 0) — add a
                             * dedicated, coherent lump line (qty 1) rather than hijacking a real
                             * component row, so Σ lines === categoryTotal and the tree reads cleanly. */
                            var lump = { desc: 'Lump sum — quantity not derivable at zero load', spec: 'discipline allowance', unit: 'ls', qty: 1, unitRate: catTotal, matCost: catTotal, laborCost: 0, total: catTotal, confidence: 'low', source: 'boq.takeoff' };
                            subsystems[0].lines.push(lump); flat.push(lump);
                        }
                        /* subsystem subtotals (post-reconcile; lines are shared references) */
                        subsystems.forEach(function (s) { s.subtotal = s.lines.reduce(function (a, l) { return a + l.total; }, 0); });
                        disciplines.push({ key: d.key, label: d.label, categories: d.categories, categoryTotal: catTotal, subsystems: subsystems, lines: flat, reconcileFactor: +reconcileFactor.toFixed(3), bottomUpRaw: +bottomUp.toFixed(0) });
                    });
                    return { disciplines: disciplines, drivers: drivers, hardTotal: disciplines.reduce(function (s, d) { return s + d.categoryTotal; }, 0) };
                },
                /* Commercial roll-up: discloses embedded EPC margin (backed out of the
                 * hard subtotal, m/(1+m)) + safety factors; grandTotal ties to capexTotal. */
                summary: function (costs, softCosts, contingency, fomTotal, capexTotal, opts) {
                    opts = opts || {};
                    var cb = DATA.boq.commercialBasis;
                    var m = (opts.epcMarginPct != null ? opts.epcMarginPct : cb.epcMarginPctGross) / 100;
                    var hard = 0; for (var k in costs) { if (Object.prototype.hasOwnProperty.call(costs, k)) hard += (costs[k] || 0); }
                    var soft = ((softCosts && softCosts.design) || 0) + ((softCosts && softCosts.pm) || 0);
                    var embeddedMargin = hard * (m / (1 + m));
                    var directCost = hard - embeddedMargin;
                    var grandTotal = capexTotal;
                    var accounted = hard + soft + (contingency || 0) + (fomTotal || 0);
                    return {
                        directCost: directCost,
                        embeddedMargin: embeddedMargin,
                        marginPctGross: +(m * 100).toFixed(1),   /* reflects opts.epcMarginPct override, not just the constant */
                        marginMarkupOnCost: +((m / (1 - m)) * 100).toFixed(1),
                        hardSubtotal: hard,
                        softCosts: soft,
                        contingency: contingency || 0,
                        fom: fomTotal || 0,
                        grandTotal: grandTotal,
                        /* hard+soft+contingency+fom should ≈ capexTotal; residual = greenCert
                         * premium + renewables (disclosed as unaccounted, not hidden). */
                        reconciles: capexTotal > 0 && Math.abs(accounted - capexTotal) / capexTotal < 0.12,
                        unaccounted: +(capexTotal - accounted).toFixed(0),
                        safetyFactors: cb.safetyFactors,
                        aaceClass: cb.aaceClass, aaceBand: cb.aaceBand,
                        disclaimer: cb.disclaimer, marginNote: cb.marginNote
                    };
                },
                /* BOQ Ship-2 — major equipment schedule: qty (N + redundancy), unit
                 * capacity, lead time. INFORMATIONAL (not reconciled to $ — the BOQ line
                 * items already carry the cost); indicative only. */
                equipmentSchedule: function (costs, metrics, input) {
                    var E = DATA.boq.equipmentSizing;
                    var itKw = (input && input.itLoad) || 0;
                    var pue = (metrics && metrics.pue) || 1.4;
                    var red = (input && input.redundancy) || 'n1';
                    var install = function (base) { if (red === 'n1' || red === '2n1') { return red === '2n1' ? base * 2 + 1 : base + 1; } if (red === '2n') return base * 2; return base; };
                    var lt = E.leadTimeWk;
                    var upsN = Math.ceil(itKw / E.upsModuleKw);
                    var genN = Math.ceil((itKw * pue) / E.gensetKw);
                    var txN = Math.ceil((itKw * pue) / (E.transformerMva * 1000 * E.transformerPf));
                    var coolKw = itKw;   /* cooling DUTY ≈ IT heat load (not IT×PUE; gensets/transformers below DO use IT×PUE — they power the whole facility incl. cooling) */
                    var crahN = Math.ceil(coolKw / E.crahKw);
                    var cduN = Math.ceil(itKw / E.cduKw);
                    var pduN = Math.ceil(itKw / E.pduKw);
                    return [
                        { discipline: 'electrical', equipment: 'UPS module', spec: E.upsModuleKw + ' kW modular', unit: 'ea', capacityKw: E.upsModuleKw, qtyN: upsN, qtyInstalled: install(upsN), redundancy: red, leadTimeWk: lt.ups, category: 'ups', confidence: 'med' },
                        { discipline: 'electrical', equipment: 'Standby generator', spec: (E.gensetKw / 1000) + ' MW diesel', unit: 'ea', capacityKw: E.gensetKw, qtyN: genN, qtyInstalled: install(genN), redundancy: red, leadTimeWk: lt.generator, category: 'generator', confidence: 'med' },
                        { discipline: 'electrical', equipment: 'MV transformer', spec: E.transformerMva + ' MVA', unit: 'ea', capacityKw: E.transformerMva * 1000, qtyN: txN, qtyInstalled: install(txN), redundancy: red, leadTimeWk: lt.transformer, category: 'electrical', confidence: 'med' },
                        { discipline: 'electrical', equipment: 'PDU / RPP', spec: E.pduKw + ' kW', unit: 'ea', capacityKw: E.pduKw, qtyN: pduN, qtyInstalled: install(pduN), redundancy: red, leadTimeWk: lt.pdu, category: 'electrical', confidence: 'low' },
                        { discipline: 'mechanical_cooling', equipment: 'CRAH / CRAC', spec: E.crahKw + ' kW', unit: 'ea', capacityKw: E.crahKw, qtyN: crahN, qtyInstalled: install(crahN), redundancy: red, leadTimeWk: lt.crah, category: 'cooling', confidence: 'low' },
                        { discipline: 'mechanical_cooling', equipment: 'Coolant Distribution Unit (CDU)', spec: E.cduKw + ' kW DLC', unit: 'ea', capacityKw: E.cduKw, qtyN: cduN, qtyInstalled: install(cduN), redundancy: red, leadTimeWk: lt.cdu, category: 'cooling', confidence: 'low' }
                    ];
                },
                /* BOQ Ship-2 — procurement packages with est value = Σ mapped category $. */
                procurementPackages: function (costs) {
                    return DATA.boq.procurement.map(function (p) {
                        var est = p.disciplines.reduce(function (s, dk) {
                            var d = DATA.boq.disciplines.filter(function (x) { return x.key === dk; })[0];
                            if (!d) return s;
                            return s + d.categories.reduce(function (ss, c) { return ss + ((costs && costs[c]) || 0); }, 0);
                        }, 0);
                        return { pkgNo: p.pkgNo, name: p.name, scope: p.scope, disciplines: p.disciplines, tenderMethod: p.tenderMethod, leadTimeWk: p.leadTimeWk, fatSat: p.fatSat, warrantyYr: p.warrantyYr, estValue: est, confidence: p.confidence, source: p.source };
                    });
                },
                /* ── BOQ Phase-C: indicative per-unit equipment cost — maps each
                 * equipmentSchedule category to its DATA.boq.unitRates rateKey so the
                 * deepened Equipment Schedule can surface an indicative unit cost
                 * without a new economic literal. Returns { rateKey, unitUsd, confidence }
                 * per equipment key (ups/generator/transformer/pdu/crah/cdu); null when
                 * no rate exists. SCREENING — same rates the take-off uses. */
                equipmentUnitCost: function (equipKey) {
                    var map = {
                        ups: 'upsModule_ea', generator: 'genset_ea', transformer: 'transformer_mva',
                        pdu: 'pdu_ea', crah: 'crah_ea', cdu: 'cdu_ea'
                    };
                    var rk = map[equipKey];
                    var r = rk && DATA.boq.unitRates ? DATA.boq.unitRates[rk] : null;
                    if (!r) return null;
                    return { rateKey: rk, unitUsd: r.usd, confidence: r.confidence || 'low', unit: (rk === 'transformer_mva') ? 'per MVA' : 'per unit' };
                },
                /* ── BOQ Phase-C: critical spares stock model. For each critical
                 * component, derives the annual failure demand from
                 * DATA.reliability.components[*].mtbf (installed qty × 8760 / MTBF),
                 * prices it from DATA.sparesPricing, and runs models.spares.newsvendor
                 * to a service level → recommended stock qty + holding + annual
                 * replacement cost. AACE Class-4 SCREENING — real MTBF + list-price
                 * bands; validate against OEM RCM data. input {itLoad, redundancy, tier};
                 * metrics {pue}. serviceLevelPct default 99. */
                criticalSpares: function (input, metrics, serviceLevelPct) {
                    input = input || {}; metrics = metrics || {};
                    var itKw = input.itLoad || 0;
                    var pue = metrics.pue || 1.4;
                    var red = (input.redundancy || 'n1');
                    var tier = input.tier || 3;
                    var fill = Math.max(50, Math.min(99.9, serviceLevelPct || 99));
                    var E = DATA.boq.equipmentSizing, C = DATA.reliability.components, SP = DATA.sparesPricing.classes;
                    var lt = E.leadTimeWk, nv = RZEngine.models.spares.newsvendor;
                    var install = function (base) { if (red === 'n1' || red === '2n1') { return red === '2n1' ? base * 2 + 1 : base + 1; } if (red === '2n') return base * 2; return base; };
                    /* installed populations that drive spares demand (units in service). */
                    var upsInst  = install(Math.ceil(itKw / E.upsModuleKw));
                    var genInst  = install(Math.ceil((itKw * pue) / E.gensetKw));
                    var crahInst = install(Math.ceil(itKw / E.crahKw));
                    var cduInst  = install(Math.ceil(itKw / E.cduKw));
                    var pduInst  = install(Math.ceil(itKw / E.pduKw));
                    /* per-spec: component MTBF, installed population, price class, LT, part life. */
                    var band = function (cls, key) { var c = SP[cls]; return c ? c[key] : 0; };
                    var specs = [
                        { key: 'ups_module',  label: 'UPS power module',   comp: 'ups',       pop: upsInst,  cls: 'ups_module_50kw',     lt: lt.ups,       partLife: 12, cu: 200000 },
                        { key: 'ups_battery', label: 'UPS battery string', comp: 'ups',       pop: upsInst,  cls: 'ups_battery_string',  lt: lt.ups,       partLife: 6,  cu: 120000 },
                        { key: 'genset',      label: 'Genset PM/overhaul', comp: 'generator', pop: genInst,  cls: 'genset_pm_kit',       lt: lt.generator, partLife: 3,  cu: 250000 },
                        { key: 'chiller',     label: 'Chiller compressor',  comp: 'chiller',  pop: cduInst,  cls: 'chiller_compressor',  lt: lt.cdu,       partLife: 15, cu: 300000 },
                        { key: 'crah',        label: 'CRAH EC/VFD fan kit', comp: 'crac',     pop: crahInst, cls: 'crah_ec_fan_kit',     lt: lt.crah,      partLife: 8,  cu: 60000 },
                        { key: 'pdu',         label: 'PDU MCCB breaker',    comp: 'pdu',      pop: pduInst,  cls: 'pdu_breaker_mccb',    lt: lt.pdu,       partLife: 15, cu: 45000 }
                    ];
                    return specs.map(function (s) {
                        var comp = C[s.comp] || { mtbf: 200000, mttr: 8, label: s.label };
                        var mtbf = comp.mtbf;
                        var failRatePerUnit = mtbf > 0 ? 8760 / mtbf : 0;               /* λ per unit-year */
                        var muAnnual = failRatePerUnit * Math.max(1, s.pop);            /* population failures/yr */
                        var unitCost = band(s.cls, 'mid') || 4500;
                        var carryRatePct = 25;
                        var nvOut = nv({
                            unitCost: unitCost, understockCostPerEvent: s.cu, carryRatePct: carryRatePct,
                            partLifeYrs: s.partLife, muAnnual: muAnnual, sigmaAnnual: Math.sqrt(muAnnual),
                            ltWeeks: s.lt || 16, ltSigmaWeeks: Math.max(2, (s.lt || 16) * 0.25),
                            fillRatePct: fill
                        });
                        var stockQty = Math.max(nvOut.qStar, 1);                        /* carry ≥1 critical spare */
                        var failRate = +muAnnual.toFixed(3);
                        var holdingCost = Math.round(carryRatePct / 100 * unitCost * stockQty);  /* annual carry */
                        var annualReplacement = Math.round(failRate * unitCost);        /* expected consumption $/yr */
                        return {
                            key: s.key, label: s.label,
                            component: s.comp, mtbfHours: mtbf, installedQty: s.pop,
                            failRatePerYr: failRate, recommendedStockQty: stockQty,
                            unitCost: unitCost, holdingCost: holdingCost, annualReplacementCost: annualReplacement,
                            serviceLevelPct: fill, priceClass: s.cls, confidence: 'low',
                            source: 'DATA.reliability + DATA.sparesPricing + models.spares.newsvendor'
                        };
                    });
                },
                /* ── BOQ Phase-C: preventive-maintenance schedule per major system.
                 * PM intervals + task lists are STANDARD-PRACTICE (OEM/NFPA-110/ASHRAE
                 * convention). Annual labor-hours scale with the installed population
                 * (models.boq.equipmentSchedule sizing) × PM visits/yr × hr/visit; annual
                 * PM cost from the DATA.omContracts preventive $/kW-yr band allocated by
                 * each system's share. SCREENING — validate against OEM RCM + vendor SLA.
                 * input {itLoad, redundancy, tier}; metrics {pue}. */
                pmSchedule: function (input, metrics) {
                    input = input || {}; metrics = metrics || {};
                    var itKw = input.itLoad || 0, mw = itKw / 1000;
                    var pue = metrics.pue || 1.4;
                    var red = (input.redundancy || 'n1');
                    var E = DATA.boq.equipmentSizing;
                    var install = function (base) { if (red === 'n1' || red === '2n1') { return red === '2n1' ? base * 2 + 1 : base + 1; } if (red === '2n') return base * 2; return base; };
                    var pdurate = DATA.omContracts.tiers.preventive;                    /* $/kW-yr band */
                    var pmBudgetYr = pdurate.mid * itKw;                                /* total preventive PM $/yr */
                    /* per-system PM template: visits/yr, hr per visit, PM budget weight. */
                    var systems = [
                        { key: 'generator', label: 'Standby generators',      pop: install(Math.ceil((itKw * pue) / E.gensetKw)), interval: 'Monthly load-test + annual major', tasks: 'Oil/filter, coolant, load-bank, ATS, fuel polishing (NFPA 110)', visitsYr: 12, hrPerVisit: 4, weight: 0.22 },
                        { key: 'ups',       label: 'UPS + battery strings',   pop: install(Math.ceil(itKw / E.upsModuleKw)),      interval: 'Quarterly + annual cap/batt', tasks: 'Capacitor/fan check, battery impedance, calibration, thermal scan', visitsYr: 4,  hrPerVisit: 3, weight: 0.20 },
                        { key: 'chiller',   label: 'Chillers / CDU',          pop: install(Math.ceil(itKw / E.cduKw)),            interval: 'Quarterly + annual overhaul', tasks: 'Compressor, refrigerant, tube-clean, VFD, water treatment (ASHRAE)', visitsYr: 4,  hrPerVisit: 5, weight: 0.24 },
                        { key: 'crah',      label: 'CRAH / CRAC units',       pop: install(Math.ceil(itKw / E.crahKw)),           interval: 'Quarterly filter + belt', tasks: 'Filter change, EC-fan, condensate, coil clean, humidity cal', visitsYr: 4,  hrPerVisit: 2, weight: 0.18 },
                        { key: 'pumps',     label: 'CW pumps / valves',       pop: Math.max(2, Math.ceil(mw)),                    interval: 'Semi-annual', tasks: 'Seal/bearing, alignment, valve actuation, vibration analysis', visitsYr: 2,  hrPerVisit: 3, weight: 0.16 }
                    ];
                    return systems.map(function (s) {
                        var laborHrYr = Math.round(Math.max(1, s.pop) * s.visitsYr * s.hrPerVisit);
                        var annualPmCost = Math.round(pmBudgetYr * s.weight);
                        return {
                            key: s.key, system: s.label, installedQty: s.pop,
                            pmInterval: s.interval, tasks: s.tasks,
                            annualLaborHr: laborHrYr, annualPmCost: annualPmCost,
                            confidence: 'low', source: 'DATA.omContracts + models.boq.equipmentSchedule sizing'
                        };
                    });
                }
            },

            /* ── BOQ Ship-3: EPC Technical Dossier assembler ──
             * Composes the full multi-section dossier manifest + an executive summary
             * from live inputs. Static content lives in DATA.dossier; per-section live
             * data is pulled by the renderer from the existing models. STANDARD-PRACTICE
             * reference — screening, validate against the AHJ + a full design. */
            dossier: {
                /* executive summary derived from the requirement inputs + CAPEX result. */
                executiveSummary: function (input, result) {
                    var itKw = (input && input.itLoad) || 0;
                    var mw = itKw / 1000;
                    var red = (input && input.redundancy) || 'n1';
                    var redLabel = (DATA.redundancyLevels && DATA.redundancyLevels[red]) || red;
                    var cooling = (input && input.coolingType) || 'liquid';
                    var total = (result && result.total) || 0;
                    var perKw = (result && result.metrics && result.metrics.perKw) || (itKw ? total / itKw : 0);
                    var months = (result && result.metrics && result.metrics.timelineMonths) || (result && result.timeline && result.timeline.totalMonths) || 0;
                    var pue = (result && result.pue) || (result && result.metrics && result.metrics.pue) || 0;
                    return {
                        capacityMw: +mw.toFixed(2),
                        redundancy: redLabel,
                        cooling: cooling,
                        pue: pue,
                        totalCapex: total,
                        perKw: perKw,
                        timelineMonths: months,
                        racks: (result && result.metrics && result.metrics.racks) || 0
                    };
                },
                /* ── BOQ Ship-D: country-specific location risk supplement ──
                 * Reads the SELECTED country's hazard/grid/talent fields
                 * (DATA.countries[id].naturalDisaster / .gridReliability / .talentPool,
                 * single-sourced from countries.ts) and returns a small array of
                 * location risks, each with a screening SEVERITY (low/med/high) +
                 * mitigation. Tolerates a null country (returns []). Screening — a
                 * project-specific site risk study supersedes. */
                countryRisks: function (country) {
                    if (!country) return [];
                    var out = [];
                    var band = function (n, lo, hi) { return n >= hi ? 'high' : (n >= lo ? 'med' : 'low'); };
                    var wordSev = function (w, map) { return map[(w || '').toLowerCase()] || 'low'; };
                    var floodMap = { extreme: 'high', high: 'high', 'severe': 'high', moderate: 'med', low: 'low', minimal: 'low', none: 'low' };

                    var nd = country.naturalDisaster || {};
                    /* Seismic — zone 0-4 (higher = worse); zone ≥3 high, 2 med. */
                    if (nd.seismicZone != null) {
                        var sz = nd.seismicZone;
                        out.push({ hazard: 'Seismic', metric: 'Seismic zone ' + sz + (nd.structuralReinforcement ? ' · +' + Math.round(nd.structuralReinforcement * 100) + '% structural' : ''),
                            severity: band(sz, 2, 3), mitigation: 'Seismic-qualified anchoring, base isolation where zone ≥ 3, ASCE 7 design', standard: 'ASCE 7 / IBC seismic' });
                    }
                    /* Flood / natural-disaster composite. */
                    if (nd.floodRisk != null || nd.compositeScore != null) {
                        var floodSev = nd.floodRisk != null ? wordSev(nd.floodRisk, floodMap) : band(nd.compositeScore || 0, 50, 70);
                        var disasters = [];
                        if (nd.floodRisk && nd.floodRisk !== 'none') disasters.push('flood ' + nd.floodRisk);
                        if (nd.typhoonRisk && nd.typhoonRisk !== 'none') disasters.push('typhoon ' + nd.typhoonRisk);
                        if (nd.volcanoRisk && nd.volcanoRisk !== 'none') disasters.push('volcano ' + nd.volcanoRisk);
                        if (nd.tsunamiRisk && nd.tsunamiRisk !== 'none') disasters.push('tsunami ' + nd.tsunamiRisk);
                        out.push({ hazard: 'Flood / Natural Disaster', metric: (disasters.length ? disasters.join(', ') : 'composite ' + (nd.compositeScore || 0)) + (nd.insuranceMultiplier ? ' · ins ×' + nd.insuranceMultiplier : ''),
                            severity: floodSev, mitigation: 'Elevated critical plant, flood barriers, site drainage, insurance cover', standard: 'FM Global / local flood code' });
                    }
                    /* Grid reliability — brownout frequency + outage duration drive genset reliance. */
                    var gr = country.gridReliability || {};
                    if (gr.gridUptime != null || gr.brownoutFrequency != null) {
                        var brown = gr.brownoutFrequency != null ? gr.brownoutFrequency : 0;
                        out.push({ hazard: 'Grid Reliability', metric: (gr.gridUptime != null ? gr.gridUptime + '% uptime' : '') + (brown ? ' · ' + brown + ' brownouts/yr' : '') + (gr.gridTier != null ? ' · grid-tier ' + gr.gridTier : ''),
                            severity: band(brown, 6, 15), mitigation: 'N+1 generation, extended fuel autonomy (' + (gr.recommendedGenHours || 72) + ' h), voltage stabilization', standard: 'NFPA 110 / Uptime Tier' });
                    }
                    /* Talent pool — hiring lead-time + depth drive staffing / Cx risk. */
                    var tp = country.talentPool || {};
                    if (tp.talentScore != null || tp.avgHiringDays != null) {
                        var ts = tp.talentScore != null ? tp.talentScore : 50;
                        out.push({ hazard: 'Talent Pool', metric: (tp.dcEngineerPool ? tp.dcEngineerPool + ' pool' : '') + (tp.avgHiringDays ? ' · ' + tp.avgHiringDays + 'd hire' : '') + (ts != null ? ' · score ' + ts : ''),
                            severity: ts >= 65 ? 'low' : (ts >= 45 ? 'med' : 'high'), mitigation: 'Early recruitment, OEM secondment, training pipeline, managed-services O&M', standard: 'STANDARD-PRACTICE staffing' });
                    }
                    return out;
                },
                /* ── BOQ Ship-3 (deepened): REAL worked engineering calculations ──
                 * Returns an ARRAY of worked-calc sheets computed LIVE from the
                 * requirement input + CAPEX result + existing engine models/data.
                 * Each sheet = { id, title, discipline, standard, confidence,
                 * formula, inputs:[{label,value,unit}], steps:[{label,expr,value,
                 * unit}], result:{label,value,unit} }. AACE Class-4 SCREENING — real
                 * engine values, never fabricated; each carries a standard reference
                 * + [high|med|low] confidence. Undefined inputs → safe defaults so
                 * every result.value is finite. Mirrors models.boq.drivers /
                 * .equipmentSchedule sizing + models.reliability + DATA.pueMatrix /
                 * DATA.boq.paramFactors / DATA.architecture.floorLoadingKnM2 /
                 * DATA.waterFootprint (single source, no re-derivation drift). */
                engineeringCalcs: function (input, result) {
                    input = input || {};
                    result = result || {};
                    var E = DATA.boq.equipmentSizing;
                    var PF = DATA.boq.paramFactors;
                    var r2 = function (x, d) { var f = Math.pow(10, d == null ? 2 : d); var v = Math.round((x || 0) * f) / f; return Number.isFinite(v) ? v : 0; };

                    /* ── live drivers (safe defaults; guard undefined) ── */
                    var itKw = input.itLoad != null && Number.isFinite(input.itLoad) ? input.itLoad : 0;
                    var mw = itKw / 1000;
                    var metrics = result.metrics || {};
                    var pue = (result.pue != null && result.pue > 0) ? result.pue :
                              (metrics.pue != null && metrics.pue > 0 ? metrics.pue : 1.4);
                    var racks = Number.isFinite(metrics.racks) ? metrics.racks : 0;
                    var floorSpaceM2 = Number.isFinite(metrics.floorSpace) ? metrics.floorSpace : 0;
                    var facilityKw = itKw * pue;
                    var red = (input.redundancy || 'n1').toLowerCase().replace(/\s+/g, '');
                    var coolingType = (input.coolingType || 'air').toLowerCase();
                    var fireType = (input.fireType || 'novec').toLowerCase();
                    var fuelHours = input.fuelHours != null && Number.isFinite(input.fuelHours) ? input.fuelHours : 48;
                    var tier = input.tier || (metrics.tier) || 3;
                    var V = 400, pf = E.transformerPf;                 /* LV design voltage / power factor */
                    var protectedM3 = mw * 1500;                        /* ~1500 m³/MW protected volume (mirrors boq.drivers) */

                    var calcs = [];

                    /* 1 — Electrical continuous load (NEC 210.19/215.2 — 125% continuous) */
                    (function () {
                        var contKw = itKw * 1.25;
                        var kva = pf > 0 ? contKw / pf : 0;
                        var amps = (V * Math.sqrt(3)) > 0 ? (contKw * 1000) / (Math.sqrt(3) * V * pf) : 0;
                        calcs.push({
                            id: 'elecContinuous', title: 'Electrical Continuous Load', discipline: 'Electrical',
                            standard: 'NEC 210.19 / 215.2 (125% continuous)', confidence: 'high',
                            formula: 'I_design = 1.25 × IT_kW × 1000 / (√3 × V × pf)',
                            inputs: [
                                { label: 'IT load', value: r2(itKw, 0), unit: 'kW' },
                                { label: 'Continuous factor', value: 1.25, unit: '×' },
                                { label: 'Design voltage', value: V, unit: 'V' },
                                { label: 'Power factor', value: pf, unit: '' }
                            ],
                            steps: [
                                { label: 'Continuous load', expr: '1.25 × ' + r2(itKw, 0), value: r2(contKw, 0), unit: 'kW' },
                                { label: 'Apparent power', expr: r2(contKw, 0) + ' / ' + pf, value: r2(kva, 0), unit: 'kVA' },
                                { label: 'Design current', expr: r2(contKw, 0) + '·1000 / (√3·' + V + '·' + pf + ')', value: r2(amps, 0), unit: 'A' }
                            ],
                            result: { label: 'Design service current', value: r2(amps, 0), unit: 'A' }
                        });
                    })();

                    /* 2 — Transformer sizing (facility kW / (√3·V·pf) → MVA + N) */
                    (function () {
                        var perTxMva = E.transformerMva;
                        var facMva = pf > 0 ? (facilityKw / 1000) / pf : 0;
                        var txN = itKw > 0 ? Math.ceil(facilityKw / (perTxMva * 1000 * pf)) : 0;
                        calcs.push({
                            id: 'transformer', title: 'MV Transformer Sizing', discipline: 'Electrical',
                            standard: 'IEEE C57.12 / NEC 450', confidence: 'med',
                            formula: 'N_tx = ⌈ (IT_kW × PUE) / (MVA_unit × 1000 × pf) ⌉',
                            inputs: [
                                { label: 'Facility load', value: r2(facilityKw, 0), unit: 'kW' },
                                { label: 'PUE', value: r2(pue, 3), unit: '' },
                                { label: 'Unit rating', value: perTxMva, unit: 'MVA' },
                                { label: 'Power factor', value: pf, unit: '' }
                            ],
                            steps: [
                                { label: 'Facility apparent power', expr: r2(facilityKw / 1000, 2) + ' / ' + pf, value: r2(facMva, 2), unit: 'MVA' },
                                { label: 'Per-unit capacity', expr: perTxMva + ' × ' + pf, value: r2(perTxMva * pf, 2), unit: 'MW' },
                                { label: 'Transformer count (N)', expr: '⌈' + r2(facMva, 2) + ' MVA / ' + perTxMva + ' MVA⌉', value: txN, unit: 'ea' }
                            ],
                            result: { label: 'Transformers required (N)', value: txN, unit: 'ea' }
                        });
                    })();

                    /* 3 — UPS sizing + battery autonomy (IT / module → N; kWh for autonomy) */
                    (function () {
                        var moduleKw = E.upsModuleKw;
                        var upsN = itKw > 0 ? Math.ceil(itKw / moduleKw) : 0;
                        var autonomyMin = 10;                               /* typical Li-ion ride-through to genset start */
                        var battKwh = itKw * (autonomyMin / 60);
                        calcs.push({
                            id: 'upsBattery', title: 'UPS Sizing & Battery Autonomy', discipline: 'Electrical',
                            standard: 'IEEE 3007 / IEEE 485 (battery sizing)', confidence: 'med',
                            formula: 'N_ups = ⌈ IT_kW / module_kW ⌉ ;  E_batt = IT_kW × (t_min / 60)',
                            inputs: [
                                { label: 'IT load', value: r2(itKw, 0), unit: 'kW' },
                                { label: 'UPS module', value: moduleKw, unit: 'kW' },
                                { label: 'Autonomy', value: autonomyMin + ' (screening default — validate vs project UPS spec)', unit: 'min' }
                            ],
                            steps: [
                                { label: 'UPS modules (N)', expr: '⌈' + r2(itKw, 0) + ' / ' + moduleKw + '⌉', value: upsN, unit: 'ea' },
                                { label: 'Battery energy', expr: r2(itKw, 0) + ' × (' + autonomyMin + '/60)', value: r2(battKwh, 0), unit: 'kWh' }
                            ],
                            result: { label: 'Battery energy for autonomy', value: r2(battKwh, 0), unit: 'kWh' }
                        });
                    })();

                    /* 4 — Standby generator sizing (facility kW / genset kW → N + redundancy) */
                    (function () {
                        var gensetKw = E.gensetKw;
                        var genN = itKw > 0 ? Math.ceil(facilityKw / gensetKw) : 0;
                        var installed = (red === 'n1' || red === '2n1') ? (red === '2n1' ? genN * 2 + 1 : genN + 1) : (red === '2n' ? genN * 2 : genN);
                        calcs.push({
                            id: 'generator', title: 'Standby Generator Sizing', discipline: 'Electrical',
                            standard: 'NFPA 110 / ISO 8528', confidence: 'med',
                            formula: 'N_gen = ⌈ (IT_kW × PUE) / genset_kW ⌉ ; installed per redundancy',
                            inputs: [
                                { label: 'Facility load', value: r2(facilityKw, 0), unit: 'kW' },
                                { label: 'Genset rating', value: gensetKw, unit: 'kW' },
                                { label: 'Redundancy', value: red.toUpperCase(), unit: '' }
                            ],
                            steps: [
                                { label: 'Gensets (N)', expr: '⌈' + r2(facilityKw, 0) + ' / ' + gensetKw + '⌉', value: genN, unit: 'ea' },
                                { label: 'Installed (w/ redundancy)', expr: red.toUpperCase() + ' on N=' + genN, value: installed, unit: 'ea' }
                            ],
                            result: { label: 'Gensets installed', value: installed, unit: 'ea' }
                        });
                    })();

                    /* 5 — Cooling / heat load (IT heat + cooling-plant overhead → rejection kW + N) */
                    (function () {
                        var itHeatKw = itKw;                                /* ≈100% IT power → heat */
                        var overheadKw = (pue - 1) * itKw;                  /* cooling-plant own power */
                        var rejectKw = itHeatKw + overheadKw;               /* = facility kW */
                        var crahN = itKw > 0 ? Math.ceil(itKw / E.crahKw) : 0;
                        var cduN = itKw > 0 ? Math.ceil(itKw / E.cduKw) : 0;
                        var chillerN = itKw > 0 ? Math.ceil(itKw / E.chillerKw) : 0;
                        calcs.push({
                            id: 'coolingLoad', title: 'Cooling / Heat Rejection Load', discipline: 'Mechanical / Cooling',
                            standard: 'ASHRAE TC9.9 / TIA-942', confidence: 'high',
                            formula: 'Q_reject = IT_kW + (PUE − 1) × IT_kW',
                            inputs: [
                                { label: 'IT heat load', value: r2(itHeatKw, 0), unit: 'kW' },
                                { label: 'PUE', value: r2(pue, 3), unit: '' },
                                { label: 'CRAH unit', value: E.crahKw, unit: 'kW' },
                                { label: 'CDU unit', value: E.cduKw, unit: 'kW' }
                            ],
                            steps: [
                                { label: 'Plant overhead', expr: '(' + r2(pue, 3) + ' − 1) × ' + r2(itKw, 0), value: r2(overheadKw, 0), unit: 'kW' },
                                { label: 'Total rejection', expr: r2(itHeatKw, 0) + ' + ' + r2(overheadKw, 0), value: r2(rejectKw, 0), unit: 'kW' },
                                { label: 'CRAH count', expr: '⌈' + r2(itKw, 0) + ' / ' + E.crahKw + '⌉', value: crahN, unit: 'ea' },
                                { label: 'CDU count', expr: '⌈' + r2(itKw, 0) + ' / ' + E.cduKw + '⌉', value: cduN, unit: 'ea' },
                                { label: 'Chiller count', expr: '⌈' + r2(itKw, 0) + ' / ' + E.chillerKw + '⌉', value: chillerN, unit: 'ea' }
                            ],
                            result: { label: 'Total heat rejection', value: r2(rejectKw, 0), unit: 'kW' }
                        });
                    })();

                    /* 6 — Fuel storage (genset kW × fuelHours × burn-rate → tank m³) */
                    (function () {
                        var perMwHr = PF.fuelTankM3PerMwHour;
                        var facMw = facilityKw / 1000;
                        var tankM3 = facMw * fuelHours * perMwHr;
                        calcs.push({
                            id: 'fuelStorage', title: 'Diesel Fuel Storage', discipline: 'Mechanical / Fuel',
                            standard: 'NFPA 30 / NFPA 110', confidence: 'med',
                            formula: 'V_tank = MW_facility × t_hours × k  (k = ' + perMwHr + ' m³/MW·h)',
                            inputs: [
                                { label: 'Facility load', value: r2(facMw, 2), unit: 'MW' },
                                { label: 'Runtime', value: fuelHours, unit: 'h' },
                                { label: 'Burn factor', value: perMwHr, unit: 'm³/MW·h' }
                            ],
                            steps: [
                                { label: 'Bulk volume', expr: r2(facMw, 2) + ' × ' + fuelHours + ' × ' + perMwHr, value: r2(tankM3, 1), unit: 'm³' }
                            ],
                            result: { label: 'Bulk fuel storage', value: r2(tankM3, 1), unit: 'm³' }
                        });
                    })();

                    /* 7 — Fire clean-agent (protected m³ × agent density → kg agent) */
                    (function () {
                        var density = PF.cleanAgentKgPerM3[fireType] != null ? PF.cleanAgentKgPerM3[fireType] : 0;
                        var agentKg = protectedM3 * density;
                        calcs.push({
                            id: 'cleanAgent', title: 'Fire Clean-Agent Charge', discipline: 'Fire & Life Safety',
                            standard: 'NFPA 2001 (clean-agent design)', confidence: 'high',
                            formula: 'm_agent = V_protected × ρ_design  (ρ per agent type)',
                            inputs: [
                                { label: 'Protected volume', value: r2(protectedM3, 0), unit: 'm³' },
                                { label: 'Agent (' + fireType + ')', value: density, unit: 'kg/m³' }
                            ],
                            steps: [
                                { label: 'Agent charge', expr: r2(protectedM3, 0) + ' × ' + density, value: r2(agentKg, 0), unit: 'kg' }
                            ],
                            result: { label: 'Clean-agent charge', value: r2(agentKg, 0), unit: 'kg' }
                        });
                    })();

                    /* 8 — Fire-water demand (sprinkler systems only — density × area → L/min + tank) */
                    (function () {
                        var isSprinkler = (PF.sprinklerFrac[fireType] != null ? PF.sprinklerFrac[fireType] : 0) > 0;
                        var area = isSprinkler ? floorSpaceM2 : 0;
                        var densLpmM2 = 8.15;                               /* NFPA 13 Ordinary Hazard Grp 2 = 0.20 gpm/ft² = 8.15 L/min·m² (1 mm/min = 1 L/min·m²) */
                        var demandLpm = area * densLpmM2;
                        var durationMin = 90;                               /* OH-2 water supply duration */
                        var tankM3 = demandLpm * durationMin / 1000;
                        calcs.push({
                            id: 'fireWater', title: 'Fire-Water Sprinkler Demand', discipline: 'Fire & Life Safety',
                            standard: 'NFPA 13 (OH-2 density)', confidence: isSprinkler ? 'med' : 'low',
                            formula: 'Q = A_design × density ;  V_tank = Q × t_supply',
                            inputs: [
                                { label: 'Sprinkler system', value: isSprinkler ? 'yes' : 'no (gaseous)', unit: '' },
                                { label: 'Protected area', value: r2(area, 0), unit: 'm²' },
                                { label: 'Density', value: densLpmM2, unit: 'L/min·m²' },
                                { label: 'Duration', value: durationMin, unit: 'min' }
                            ],
                            steps: [
                                { label: 'Water demand', expr: r2(area, 0) + ' × ' + densLpmM2, value: r2(demandLpm, 0), unit: 'L/min' },
                                { label: 'Storage tank', expr: r2(demandLpm, 0) + ' × ' + durationMin + ' / 1000', value: r2(tankM3, 1), unit: 'm³' }
                            ],
                            result: { label: 'Fire-water storage', value: r2(tankM3, 1), unit: 'm³' }
                        });
                    })();

                    /* 9 — Structural floor loading (DATA.architecture.floorLoadingKnM2[coolingType]) */
                    (function () {
                        var floorMap = DATA.architecture.floorLoadingKnM2;
                        var load = floorMap[coolingType] != null ? floorMap[coolingType] : floorMap.air;
                        var totalKn = load * floorSpaceM2;
                        calcs.push({
                            id: 'floorLoading', title: 'Structural Floor Loading', discipline: 'Structural',
                            standard: 'ASCE 7 / IBC (live load)', confidence: 'med',
                            formula: 'w_design = floor-loading[cooling] ;  W = w × A_floor',
                            inputs: [
                                { label: 'Cooling type', value: coolingType, unit: '' },
                                { label: 'Design load', value: load, unit: 'kN/m²' },
                                { label: 'White-space area', value: r2(floorSpaceM2, 0), unit: 'm²' }
                            ],
                            steps: [
                                { label: 'Total floor reaction', expr: load + ' × ' + r2(floorSpaceM2, 0), value: r2(totalKn, 0), unit: 'kN' }
                            ],
                            result: { label: 'Design floor loading', value: load, unit: 'kN/m²' }
                        });
                    })();

                    /* 10 — Cable ampacity derate (base ampacity × 0.75 grouping/ambient) */
                    (function () {
                        var derate = 0.75;
                        var baseAmp = itKw > 0 ? (itKw * 1.25 * 1000) / (Math.sqrt(3) * V * pf) : 0;
                        var deratedAmp = baseAmp / derate;                  /* uprate conductor to carry the load after derate */
                        calcs.push({
                            id: 'cableAmpacity', title: 'Cable Ampacity Derate', discipline: 'Electrical',
                            standard: 'NEC 310.15 (grouping × ambient)', confidence: 'high',
                            formula: 'I_conductor = I_design / 0.75  (grouping × ambient derate)',
                            inputs: [
                                { label: 'Design current', value: r2(baseAmp, 0), unit: 'A' },
                                { label: 'Derate factor', value: derate, unit: '' }
                            ],
                            steps: [
                                { label: 'Conductor ampacity', expr: r2(baseAmp, 0) + ' / ' + derate, value: r2(deratedAmp, 0), unit: 'A' }
                            ],
                            result: { label: 'Required conductor ampacity', value: r2(deratedAmp, 0), unit: 'A' }
                        });
                    })();

                    /* 11 — System availability (models.reliability — matches its output exactly) */
                    (function () {
                        var Rel = RZEngine.models.reliability;
                        var components = ['ups', 'crac', 'chiller'];
                        var paths = DATA.reliability.redundancyPaths[red] != null ? DATA.reliability.redundancyPaths[red] : 1;
                        var avail = Rel.systemAvailability(components, red);
                        var downMin = Rel.annualDowntimeMinutes(avail);
                        var groupSteps = components.map(function (name) {
                            var c = DATA.reliability.components[name];
                            var a = Rel.availability(c.mtbf, c.mttr);
                            var pa = Rel.parallelAvailability(a, paths);
                            return { label: (c.label || name) + ' (×' + paths + ')', expr: '1−(1−' + r2(a, 6) + ')^' + paths, value: r2(pa * 100, 4), unit: '%' };
                        });
                        groupSteps.push({ label: 'Series availability', expr: 'Π group availabilities', value: r2(avail * 100, 5), unit: '%' });
                        calcs.push({
                            id: 'availability', title: 'System Availability (RAM)', discipline: 'Availability / Reliability',
                            standard: 'IEEE 493 (Gold Book) / Uptime Tier', confidence: 'med',
                            formula: 'A_sys = Π [ 1 − (1 − MTBF/(MTBF+MTTR))^paths ]',
                            inputs: [
                                { label: 'Redundancy', value: red.toUpperCase(), unit: '' },
                                { label: 'Parallel paths', value: paths, unit: '' },
                                { label: 'Model scope', value: 'ups/crac/chiller series (3-group screening; full chain per IEEE 493 RAM study)', unit: '' }
                            ],
                            steps: groupSteps.concat([
                                { label: 'Annual downtime', expr: '(1 − A) × 8760 × 60', value: r2(downMin, 2), unit: 'min/yr' }
                            ]),
                            /* clamp to 99.9999 (4-nines display) — a redundant chain rounds to
                             * 7+ nines; the renderer caps at 4 decimals so an unclamped value
                             * would re-round to an unqualified "100%" (impossible + erodes trust).
                             * The Annual-downtime step above carries the real per-topology figure. */
                            result: { label: 'System availability', value: Math.min(99.9999, +(avail * 100).toFixed(4)), unit: '%' },
                            /* raw (unrounded) availability for the test to match models.reliability exactly */
                            _availRaw: avail
                        });
                    })();

                    /* 12 — Water / WUE (DATA.waterFootprint via models.water.annualM3) */
                    (function () {
                        /* map the cooling architecture → a DATA.water.wueByType class (air|rearDoor|directToChip|immersion) */
                        var coolMap = { air: 'air', inrow: 'air', rdhx: 'rearDoor', liquid: 'directToChip', dlc: 'directToChip', microfluidic: 'directToChip', immersion: 'immersion', immersion_1p: 'immersion', immersion_2p: 'immersion' };
                        var wKey = coolMap[coolingType] || 'air';
                        var wue = RZEngine.models.water.wue(wKey);
                        var annualM3 = RZEngine.models.water.annualM3(mw, wKey);
                        var facKwh = facilityKw * DATA.hoursPerYear;
                        calcs.push({
                            id: 'waterWue', title: 'Water Consumption / WUE', discipline: 'Mechanical / Water',
                            standard: 'ASHRAE / Uptime WUE', confidence: 'low',
                            formula: 'V_annual = WUE × IT_kWh / 1000  (WUE by cooling class)',
                            inputs: [
                                { label: 'IT capacity', value: r2(mw, 2), unit: 'MW' },
                                { label: 'Cooling class', value: wKey, unit: '' },
                                { label: 'WUE', value: r2(wue, 3), unit: 'L/kWh' }
                            ],
                            steps: [
                                { label: 'Annual IT energy', expr: r2(mw, 2) + ' MW × 8760 h × 1000', value: r2(mw * DATA.hoursPerYear * 1000, 0), unit: 'kWh' },
                                { label: 'Annual water', expr: r2(wue, 3) + ' L/kWh × ' + r2(mw * DATA.hoursPerYear * 1000, 0) + ' kWh ÷ 1000', value: r2(annualM3, 0), unit: 'm³' }
                            ],
                            result: { label: 'Annual water consumption', value: r2(annualM3, 0), unit: 'm³' }
                        });
                    })();

                    return calcs;
                },
                /* ordered section manifest for the dossier table-of-contents; `data`
                 * names the engine source the renderer pulls each section from. */
                sections: function () {
                    return [
                        { key: 'exec',        title: 'Executive Summary',            data: 'models.dossier.executiveSummary' },
                        { key: 'permitting',  title: 'Regulatory & Permitting Matrix', data: 'DATA.dossier.permittingMatrix' },
                        { key: 'designBasis', title: 'Design Basis',                 data: 'DATA.dossier.designBasis' },
                        { key: 'engCalcs',    title: 'Engineering Calculations',     data: 'models.dossier.engineeringCalcs' },
                        { key: 'equipment',   title: 'Equipment Schedule',           data: 'models.boq.equipmentSchedule' },
                        { key: 'boq',         title: 'Bill of Quantities',           data: 'models.boq.generate' },
                        { key: 'procurement', title: 'Procurement Packages',         data: 'models.boq.procurementPackages' },
                        { key: 'supplyChain', title: 'Supply Chain & Import',         data: 'models.supplyChain + DATA.supplyChain' },
                        { key: 'risk',        title: 'Risk Register',                data: 'DATA.dossier.riskRegister + models.dossier.countryRisks' },
                        { key: 'opsReady',    title: 'Operations Readiness',         data: 'DATA.dossier.opsReadiness' },
                        { key: 'docRegister', title: 'Document Register',            data: 'DATA.dossier.documentRegister + DATA.dossier.documentSchedule' }
                    ];
                }
            },

            /* ── Ship-C: per-country supply-chain (landed cost / export-control / lead-time) ──
             * All fns tolerate a null country (return the no-op identity). country =
             * a CountryProfile with .supplyChain.{importDutyBand, gpuExportTier,
             * customsLeadBand}. Duty on equipment fraction only; export-control PROXY. */
            supplyChain: {
                dutyRate: function (country) {
                    var band = country && country.supplyChain && country.supplyChain.importDutyBand;
                    var r = DATA.supplyChain.importDutyBands[band];
                    return r != null ? r : 0.0;
                },
                /* landed-cost multiplier for a cost category: 1 + duty × equipment-share.
                 * Floored at 1.0 (an uplift on imports, never a discount). */
                landedFactor: function (country, category) {
                    var share = DATA.supplyChain.equipmentShareByCategory[category];
                    if (share == null || !(share > 0)) return 1.0;
                    var duty = RZEngine.models.supplyChain.dutyRate(country);
                    var f = 1 + duty * share;
                    return f > 1.0 ? f : 1.0;
                },
                exportTier: function (country) {
                    var t = country && country.supplyChain && country.supplyChain.gpuExportTier;
                    return t || 1;
                },
                /* export-control advisory: frontier GPU + Tier-3 → restricted. PROXY. */
                exportControl: function (country, archKey) {
                    var tier = RZEngine.models.supplyChain.exportTier(country);
                    var info = DATA.supplyChain.exportTiers[tier] || DATA.supplyChain.exportTiers[1];
                    var frontier = DATA.supplyChain.frontierArchKeys.indexOf((archKey || '').toLowerCase()) >= 0;
                    return { tier: tier, label: info.label, note: info.note, frontier: frontier, restricted: frontier && tier === 3 };
                },
                /* customs + inland logistics weeks added to imported long-lead equipment. */
                leadTimeCustomsWk: function (country) {
                    var band = (country && country.supplyChain && country.supplyChain.customsLeadBand) || 'normal';
                    var w = DATA.supplyChain.customsLeadWk[band];
                    return w != null ? w : DATA.supplyChain.customsLeadWk.normal;
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
                       '<script src="rz-engine.min.js?v=2026-07-19-c40"><\/script>';
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
