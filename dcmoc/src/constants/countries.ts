export interface OvertimeRules {
    workday: {
        firstHour: number;
        subsequent: number;
    };
    holiday: {
        first8Hours: number;
        ninthHour: number;
        tenthHourPlus: number;
    };
    maxOvertimeHoursPerWeek?: number;
}

export interface TaxProgram {
    name: string;
    /** regulation / legal citation, e.g. "PMK 130/PMK.010/2020", "IRC §48 (P.L. 117-169)" */
    cite: string;
    url?: string;
    /** what the program actually gives */
    benefit: string;
    eligibility?: string;
    note?: string;
}

export interface CountryProfile {
    id: string;
    region: 'APAC' | 'EMEA' | 'AMER' | 'MENA' | 'AFR' | 'LATAM';
    name: string;
    currency: string;
    currencySymbol: string;
    economy: {
        inflationRate: number; // General CPI (Parts/Consumables)
        laborEscalation: number; // Annual Wage Growth
        taxRate: number; // Corporate tax rate (decimal, e.g. 0.22 for 22%)
        electricityRate: number; // $/kWh grid electricity cost
    };
    constructionIndex?: number; // Relative to US (1.0) for CAPEX
    labor: {
        minimumWage: number;
        baseSalary_ShiftLead: number;
        baseSalary_Engineer: number;
        baseSalary_Technician: number;
        baseSalary_Admin: number;
        baseSalary_Janitor: number;
        laborRatePerHour: number; // Internal technician $/hr for maintenance
        overtimeRules: OvertimeRules;
        shrinkageFactor: number;
        leaves: {
            annual: number;
            publicHolidays: number;
            sickAverage: number;
        };
        /* ── DM audit phase 1-2: country-specific labor economics (optional, filled 40/40) ──
         * socialSecurityRate — EMPLOYER statutory contribution as decimal of base wage.
         *   Sources (2024-2026 public statutory data): SG CPF Board (17% age<=55); US IRS FICA
         *   (7.65%); ID BPJS Ketenagakerjaan+Kesehatan (~10.4%); AU ATO Super Guarantee (12%
         *   from 1 Jul 2025); GB HMRC employer NIC (15% from Apr 2025); PH SSS 2025 schedule
         *   (10% employer of MSC); VN SI Law 2024 (21.5%); SE Skatteverket (31.42%); FR URSSAF
         *   band mid; expat-dominated Gulf states blended (screening). Per-country note inline.
         * benefitsOverheadRate — total benefits+overhead ABOVE base salary (13th/14th salary,
         *   THR/aguinaldo/prima, health/pension top-ups, meals, training, HR overhead),
         *   screening band 0.15-0.40 vs BLS ECEC / country payroll guides. Consumed by
         *   site-adapter staff-cost burden (was flat x1.3).
         * nightShiftPremiumRate — statutory night-work premium where codified (JP LSA Art.37
         *   25%; KR LSA 50% on night hours -> ~30% blended; BR CLT Art.73 20%; VN Art.98 30%;
         *   PH LC Art.86 10%; CO CST Art.168 35%; PT CdT Art.266 25%; DE EStG s3b 25% tax-free
         *   custom; CH ArG Art.17b 10%), else market/CLA screening 0.05-0.20.
         * workingHoursPerMonth — effective paid hours/month after annual leave + public
         *   holidays + avg sick days (derived from this profile's `leaves` on a 40h week;
         *   BR on 44h), clamped 150-176. Replaces the global /173 divisor in ShiftEngine. */
        socialSecurityRate?: number;
        benefitsOverheadRate?: number;
        nightShiftPremiumRate?: number;
        workingHoursPerMonth?: number;
    };
    compliance: {
        certifications: string[];
        annualComplianceCost: number;
        /* Annual environmental permitting cost for backup-gen operation (air-quality /
         * emissions permit renewals, stack-testing admin). Screening band 2024-2026:
         * US ~$8k (EPA Title V minor-source range), JP ~$15k (strict local air ordinances),
         * EU ~$4.5-6.5k (IED/local permits), emerging markets $2-3.5k. Consumed by
         * FuelGenEngine (fallback: legacy flat $5,000 site fee). */
        environmentalPermitCostPerYear?: number;
    };
    environment: {
        baselineAQI: number;
        gridCarbonIntensity: number;
        /* v2.5.0 site research pass (optional, augmented for major markets) */
        aqueductStressScore?: number;   // WRI Aqueduct 4.0 baseline water stress 0-5
        ashraeClimateZone?: string;     // ASHRAE 169-2021 climate zone (e.g. '3A')
        saidiMinYr?: number;            // IEEE 1366 SAIDI (min/customer/yr)
        pgaPct2in50yr?: number;         // USGS PGA %g (2% in 50yr) → seismic design cat
    };
    risk: {
        downtimeCostPerMin: number; // $/min downtime cost (country-adjusted)
    };
    supplyChain: {
        importDifficultyFactor: number;
        importDutyBand: 'fta' | 'low' | 'med' | 'high' | 'punitive';
        gpuExportTier: 1 | 2 | 3;
        customsLeadBand: 'fast' | 'normal' | 'slow';
    };
    taxIncentives?: {
        freeTradeZones: string[];
        taxHolidayYears: number;
        taxHolidayRate: number;
        incentivePrograms: string[];
        importDutyExemption: boolean;
        landSubsidy: boolean;
        effectiveTaxRate: number;
        /* Workstream O — regulation-cited incentive programs (owner: "harus ada
         * nomor regulasinya"). cite = the legal instrument; benefit = what it
         * actually gives; SCREENING reference — counsel verifies eligibility. */
        programs?: TaxProgram[];
    };
    naturalDisaster?: {
        seismicZone: 0 | 1 | 2 | 3 | 4;
        floodRisk: 'low' | 'moderate' | 'high' | 'extreme';
        typhoonRisk: 'none' | 'low' | 'moderate' | 'high';
        volcanoRisk: 'none' | 'low' | 'moderate';
        tsunamiRisk: 'none' | 'low' | 'moderate' | 'high';
        compositeScore: number;
        insuranceMultiplier: number;
        structuralReinforcement: number;
    };
    gridReliability?: {
        gridUptime: number;
        voltageStability: 'stable' | 'moderate' | 'unstable';
        brownoutFrequency: number;
        averageOutageDuration: number;
        gridTier: 1 | 2 | 3;
        backupFuelPremium: number;
        recommendedGenHours: number;
        renewableReadiness: number;
    };
    talentPool?: {
        dcEngineerPool: 'abundant' | 'moderate' | 'scarce' | 'very_scarce';
        universityPipeline: number;
        hyperscalerPresence: number;
        avgHiringDays: number;
        salaryPremium: number;
        talentScore: number;
        certifiedProfessionals: number;
    };
    fuelDiesel?: {
        dieselPricePerLiter: number;
        dieselAvailability: 'abundant' | 'moderate' | 'scarce';
        hvoAvailable: boolean;
        hvoPricePerLiter: number;
        fuelTaxRate: number;
        deliveryLeadDays: number;
        environmentalPermitRequired: boolean;
        storageLimitLiters: number;
        fuelQualityRating: 'high' | 'moderate' | 'low';
    };
    lastUpdated: string; // Data freshness indicator e.g. '2025-Q1'
}

export const COUNTRIES: Record<string, CountryProfile> = {
    ID: {
        id: 'ID',
        region: 'APAC',
        name: 'Indonesia',
        currency: 'USD',
        currencySymbol: '$',
        economy: {
            // 2026: BPS CPI ~3.2%; minimum wage (UMP) +6.5% 2026; PLN tariff stable at ~Rp1400-1600/kWh (~$0.085-0.10)
            inflationRate: 0.032,
            laborEscalation: 0.065,
            taxRate: 0.22,
            electricityRate: 0.09,
        },
        constructionIndex: 0.65, // ID rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 350,
            baseSalary_ShiftLead: 1500,
            baseSalary_Engineer: 1000,
            baseSalary_Technician: 550,
            baseSalary_Admin: 450,
            baseSalary_Janitor: 350,
            laborRatePerHour: 10,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 2.0 },
                holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 4.0 },
                maxOvertimeHoursPerWeek: 18,
            },
            shrinkageFactor: 0.20,
            leaves: { annual: 12, publicHolidays: 15, sickAverage: 5 },
            // ID labor add-ons (2024-2026 statutory/screening): BPJS employer ~10.2-11.7% (JHT 3.7+JP 2+JKK 0.24-1.74+JKM 0.3+Kes 4); no statutory night premium (UU 13/2003 silent) — market screening 8%
            socialSecurityRate: 0.104, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.08, workingHoursPerMonth: 152,
        },
        compliance: {
            certifications: ['Sertifikat Laik Operasi (SLO)', 'Ahli K3 Listrik', 'AMDAL', 'PP 35/2021'],
            annualComplianceCost: 6500, environmentalPermitCostPerYear: 2500,
        },
        environment: {
            baselineAQI: 120,
            gridCarbonIntensity: 0.7,
        },
        risk: {
            downtimeCostPerMin: 1500,
        },
        supplyChain: {
            importDifficultyFactor: 1.35,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Batam FTZ', 'Nusantara Capital (IKN)', 'Cikarang SEZ'],
            taxHolidayYears: 10,
            taxHolidayRate: 0.0,
            incentivePrograms: ['Tax Holiday PP 40/2021', 'Super Deduction R&D', 'IKN Capital Incentive'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
            programs: [
                { name: 'Tax Holiday (pioneer industries)', cite: 'PMK 130/PMK.010/2020', benefit: '100% CIT reduction 5–20 yrs (investment ≥ IDR 500bn; DC infrastructure qualifies as pioneer)', eligibility: 'New capital investment in pioneer sectors', note: 'Successor to PMK 150/2018; apply via OSS before commercial operation' },
                { name: 'Tax Allowance', cite: 'PP 78/2019', benefit: '30% net-income deduction over 6 yrs + accelerated depreciation + 10% WHT on dividends', eligibility: 'Listed business fields/regions outside tax-holiday scope' },
                { name: 'IKN Nusantara package', cite: 'PP 12/2023', benefit: 'Up to 30-yr tax holiday + super deductions for IKN investments', note: 'Strongest package; location-bound to the new capital' },
                { name: 'Vocational/R&D super deduction', cite: 'PMK 128/2019 · PMK 153/2020', benefit: 'Up to 200% (vocational) / 300% (R&D) deduction' },
            ],
        },
        naturalDisaster: {
            seismicZone: 3,
            floodRisk: 'high',
            typhoonRisk: 'none',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'moderate',
            compositeScore: 68,
            insuranceMultiplier: 1.6,
            structuralReinforcement: 0.12,
        },
        gridReliability: {
            gridUptime: 99.5,
            voltageStability: 'moderate',
            brownoutFrequency: 18,
            averageOutageDuration: 45,
            gridTier: 2,
            backupFuelPremium: 0.15,
            recommendedGenHours: 72,
            renewableReadiness: 55,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 45,
            hyperscalerPresence: 4,
            avgHiringDays: 45,
            salaryPremium: 1.1,
            talentScore: 55,
            certifiedProfessionals: 320,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.95,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.05,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    SG: {
        id: 'SG',
        region: 'APAC',
        name: 'Singapore',
        currency: 'SGD',
        currencySymbol: 'S$',
        economy: {
            // 2026: EMA regulated tariff ~S$0.35/kWh (~US$0.26/kWh); corporate tax held at 17%
            inflationRate: 0.022,
            laborEscalation: 0.04,
            taxRate: 0.17,
            electricityRate: 0.22, // Significant increase 2023-2026 post-gas price normalisation
        },
        constructionIndex: 1.1, // SG rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 1400,
            baseSalary_ShiftLead: 5500,
            baseSalary_Engineer: 4500,
            baseSalary_Technician: 3200,
            baseSalary_Admin: 2800,
            baseSalary_Janitor: 1800,
            laborRatePerHour: 35,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 1.5 },
                holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 },
            },
            shrinkageFactor: 0.12,
            leaves: { annual: 14, publicHolidays: 11, sickAverage: 4 },
            // SG labor add-ons (2024-2026 statutory/screening): CPF employer 17% (age<=55, CPF Board 2025); night premium not statutory — market screening 10%
            socialSecurityRate: 0.17, benefitsOverheadRate: 0.2, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 154,
        },
        compliance: {
            certifications: ['SS 564', 'BCA Green Mark'],
            annualComplianceCost: 12000, environmentalPermitCostPerYear: 6000,
        },
        environment: {
            baselineAQI: 45,
            gridCarbonIntensity: 0.4,
        },
        risk: {
            downtimeCostPerMin: 4500,
        },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'fta',
            gpuExportTier: 2,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Jurong Island', 'Changi Business Park'],
            taxHolidayYears: 5,
            taxHolidayRate: 0.05,
            incentivePrograms: ['Pioneer Certificate', 'Development & Expansion Incentive', 'Green DC Incentive'],
            importDutyExemption: true,
            landSubsidy: false,
            effectiveTaxRate: 0.05,
            programs: [
                { name: 'Pioneer Certificate / DEI', cite: 'Income Tax Act 1947 (EDB-administered)', benefit: 'CIT exemption or concessionary 5–10% on qualifying activities 5–10 yrs', eligibility: 'Substantive economic commitments (headcount, spend)' },
                { name: 'DC Call-for-Application (capacity award)', cite: 'IMDA/EDB DC-CFA 2023', benefit: 'Access to new DC capacity allocation (power) with green conditions (PUE ≤ 1.3)', note: 'Capacity permission, not a tax break — the binding constraint in SG' },
                { name: 'Investment Allowance', cite: 'Economic Expansion Incentives Act', benefit: 'Allowance % of qualifying fixed capital expenditure' },
            ],
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 12,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.999,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 1,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 40,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 8,
            hyperscalerPresence: 8,
            avgHiringDays: 35,
            salaryPremium: 1.15,
            talentScore: 72,
            certifiedProfessionals: 850,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.55,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.80,
            fuelTaxRate: 0.10,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 30000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    MY: {
        id: 'MY',
        region: 'APAC',
        name: 'Malaysia',
        currency: 'MYR',
        currencySymbol: 'RM',
        economy: {
            inflationRate: 0.03, // 3%
            laborEscalation: 0.045, // 4.5%
            taxRate: 0.24,
            // 2026: Tenaga Nasional ICPT surcharges + tariff review 2024; industrial ~MYR 0.38-0.42/kWh = ~$0.08-0.09 USD
            electricityRate: 0.09,
        },
        constructionIndex: 0.7, // MY rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 340,
            baseSalary_ShiftLead: 1800,
            baseSalary_Engineer: 1200,
            baseSalary_Technician: 700,
            baseSalary_Admin: 500,
            baseSalary_Janitor: 350,
            laborRatePerHour: 8,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 1.5 },
                holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 3.0 },
            },
            shrinkageFactor: 0.18,
            leaves: { annual: 12, publicHolidays: 16, sickAverage: 5 },
            // MY labor add-ons (2024-2026 statutory/screening): EPF employer 13% (wage<=RM5k) + SOCSO 1.75% + EIS 0.2%; night premium not statutory — screening 10%
            socialSecurityRate: 0.15, benefitsOverheadRate: 0.22, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: {
            certifications: ['Suruhanjaya Tenaga', 'GBI'],
            annualComplianceCost: 5000, environmentalPermitCostPerYear: 2500,
        },
        environment: {
            baselineAQI: 90,
            gridCarbonIntensity: 0.6,
        },
        risk: {
            downtimeCostPerMin: 1200,
        },
        supplyChain: {
            importDifficultyFactor: 1.1,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Iskandar Malaysia', 'Cyberjaya', 'Kulim Hi-Tech Park'],
            taxHolidayYears: 10,
            taxHolidayRate: 0.0,
            incentivePrograms: ['MSC Malaysia Status', 'Pioneer Status', 'Green Technology Tax Allowance'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
            programs: [
                { name: 'Pioneer Status / Investment Tax Allowance', cite: 'Promotion of Investments Act 1986', benefit: 'PS: 70–100% statutory-income exemption 5–10 yrs · ITA: 60–100% allowance on qualifying capex', eligibility: 'Promoted activities incl. DC/cloud services' },
                { name: 'Malaysia Digital (MD) status', cite: 'MDEC MD Bill of Guarantees (2022, ex-MSC)', benefit: 'Income-tax exemption or ITA + foreign-ownership/knowledge-worker guarantees', note: 'Applies to qualifying digital activities incl. DCs' },
                { name: 'Green Investment Tax Allowance', cite: 'GITA (MyHIJAU, Budget provisions)', benefit: '100% allowance on green capex (efficient cooling qualifies) offset vs 70% statutory income' },
            ],
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'high',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 28,
            insuranceMultiplier: 1.15,
            structuralReinforcement: 0.02,
        },
        gridReliability: {
            gridUptime: 99.9,
            voltageStability: 'stable',
            brownoutFrequency: 4,
            averageOutageDuration: 20,
            gridTier: 1,
            backupFuelPremium: 0.05,
            recommendedGenHours: 48,
            renewableReadiness: 60,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 25,
            hyperscalerPresence: 5,
            avgHiringDays: 40,
            salaryPremium: 1.1,
            talentScore: 60,
            certifiedProfessionals: 420,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.55,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.0,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    US: {
        id: 'US',
        region: 'AMER',
        name: 'United States',
        currency: 'USD',
        currencySymbol: '$',
        economy: {
            // 2026: CPI trending ~2.5-3%; C&I electricity ~$0.13-0.14/kWh (EIA 2026); CHIPS Act driving DC labor premium
            inflationRate: 0.027,
            laborEscalation: 0.04, // DC/tech wage growth elevated by AI boom
            taxRate: 0.21,
            electricityRate: 0.13,
        },
        constructionIndex: 1.0, // US rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2000,
            baseSalary_ShiftLead: 10500,
            baseSalary_Engineer: 8500,
            baseSalary_Technician: 5500,
            baseSalary_Admin: 4000,
            baseSalary_Janitor: 3000,
            laborRatePerHour: 45,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 1.5 },
                holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 },
            },
            shrinkageFactor: 0.10,
            leaves: { annual: 10, publicHolidays: 10, sickAverage: 3 },
            // US labor add-ons (2024-2026 statutory/screening): FICA employer 7.65% (6.2 OASDI + 1.45 Medicare); no federal night differential — BLS common shift diff ~10% (screening)
            socialSecurityRate: 0.0765, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 158,
        },
        compliance: {
            certifications: ['OSHA', 'NFPA 70E'],
            annualComplianceCost: 15000, environmentalPermitCostPerYear: 8000,
        },
        environment: {
            baselineAQI: 35,
            gridCarbonIntensity: 0.4,
        },
        risk: {
            downtimeCostPerMin: 5000,
        },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Foreign Trade Zones (250+)'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.21,
            incentivePrograms: ['ITC for Energy Property', 'Opportunity Zones', 'State-level DC Sales Tax Exemptions'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.21,
            programs: [
                { name: 'Clean-energy ITC (on-site solar/BESS)', cite: 'IRC §48 — IRA 2022 (P.L. 117-169)', benefit: '30% investment tax credit + 10% domestic content + 10% energy community adders', eligibility: 'On-site solar/storage at the DC' },
                { name: 'Bonus depreciation', cite: 'IRC §168(k) — TCJA (P.L. 115-97)', benefit: 'Accelerated first-year depreciation (phase-down: 20% in 2026)', note: 'Congressional restoration proposals pending — verify current-year %' },
                { name: 'Virginia DC sales-tax exemption', cite: 'Va. Code §58.1-609.3(18)', benefit: 'Sales/use-tax exemption on DC equipment (the flagship state program)', eligibility: '$150M investment + 50 jobs (reduced in distressed localities)' },
                { name: 'Texas DC exemption', cite: 'Tex. Tax Code §151.359', benefit: '100% sales-tax exemption on qualifying DC equipment 10–15 yrs', eligibility: '$200M investment, 20 jobs, 100k sqft' },
            ],
        },
        naturalDisaster: {
            seismicZone: 2,
            floodRisk: 'moderate',
            typhoonRisk: 'moderate',
            volcanoRisk: 'low',
            tsunamiRisk: 'low',
            compositeScore: 38,
            insuranceMultiplier: 1.2,
            structuralReinforcement: 0.05,
        },
        gridReliability: {
            gridUptime: 99.97,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 10,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 48,
            renewableReadiness: 70,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 120,
            hyperscalerPresence: 10,
            avgHiringDays: 30,
            salaryPremium: 1.0,
            talentScore: 90,
            certifiedProfessionals: 8500,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.05,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.20,
            fuelTaxRate: 0.06,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 100000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    JP: {
        id: 'JP',
        region: 'APAC',
        name: 'Japan',
        currency: 'JPY',
        currencySymbol: '¥',
        economy: {
            inflationRate: 0.028, // 2.8% (BOJ structural shift 2024-2025)
            laborEscalation: 0.03, // 3%
            taxRate: 0.2304,
            electricityRate: 0.20,
        },
        constructionIndex: 1.15, // JP rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 1200,
            baseSalary_ShiftLead: 4500,
            baseSalary_Engineer: 3500,
            baseSalary_Technician: 2800,
            baseSalary_Admin: 2200,
            baseSalary_Janitor: 1800,
            laborRatePerHour: 30,
            overtimeRules: {
                workday: { firstHour: 1.25, subsequent: 1.25 },
                holiday: { first8Hours: 1.35, ninthHour: 1.35, tenthHourPlus: 1.35 },
            },
            shrinkageFactor: 0.08,
            leaves: { annual: 10, publicHolidays: 16, sickAverage: 2 },
            // JP labor add-ons (2024-2026 statutory/screening): employer ~15.5% (pension 9.15 + health ~5 + employment 0.95 + workers comp ~0.3); night 22:00-05:00 statutory +25% (LSA Art.37)
            socialSecurityRate: 0.155, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.25, workingHoursPerMonth: 155,
        },
        compliance: {
            certifications: ['First Class Electrician', 'Energy Manager'],
            annualComplianceCost: 8000, environmentalPermitCostPerYear: 15000,
        },
        environment: {
            baselineAQI: 30,
            gridCarbonIntensity: 0.5,
        },
        risk: {
            downtimeCostPerMin: 4000,
        },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Okinawa FTZ', 'Narita FTZ'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.2304,
            incentivePrograms: ['J-Credits Scheme', 'Green Innovation Fund', 'Regional Revitalization Tax'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.2304,
            programs: [
                { name: 'GX transition support', cite: 'GX Promotion Act (2023)', benefit: 'Green-transformation subsidies applicable to efficient DC builds (screening)', note: 'Japan has no blanket DC tax holiday — support is subsidy/grant-based' },
                { name: 'Regional DC promotion', cite: 'METI regional DC subsidy program (2021–)', benefit: 'Capex subsidies for DCs sited outside Tokyo/Osaka (grid + resilience policy)' },
            ],
        },
        naturalDisaster: {
            seismicZone: 4,
            floodRisk: 'moderate',
            typhoonRisk: 'high',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'high',
            compositeScore: 82,
            insuranceMultiplier: 1.8,
            structuralReinforcement: 0.18,
        },
        gridReliability: {
            gridUptime: 99.99,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 5,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 48,
            renewableReadiness: 55,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 50,
            hyperscalerPresence: 7,
            avgHiringDays: 60,
            salaryPremium: 1.1,
            talentScore: 70,
            certifiedProfessionals: 1800,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.35,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.50,
            fuelTaxRate: 0.08,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    AU: {
        id: 'AU',
        region: 'APAC',
        name: 'Australia',
        currency: 'AUD',
        currencySymbol: 'A$',
        economy: {
            inflationRate: 0.03, // 3%
            laborEscalation: 0.035, // 3.5%
            taxRate: 0.30,
            electricityRate: 0.18,
        },
        constructionIndex: 1.05, // AU rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 3000,
            baseSalary_ShiftLead: 9500,
            baseSalary_Engineer: 8000,
            baseSalary_Technician: 6000,
            baseSalary_Admin: 5000,
            baseSalary_Janitor: 4000,
            laborRatePerHour: 40,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 2.0 },
                holiday: { first8Hours: 2.5, ninthHour: 2.5, tenthHourPlus: 2.5 },
            },
            shrinkageFactor: 0.12,
            leaves: { annual: 20, publicHolidays: 10, sickAverage: 5 },
            // AU labor add-ons (2024-2026 statutory/screening): Superannuation Guarantee 12% (ATO, from 1 Jul 2025); night loading award-based ~15% (screening)
            socialSecurityRate: 0.12, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.15, workingHoursPerMonth: 150,
        },
        compliance: {
            certifications: ['WHS', 'Austel'],
            annualComplianceCost: 10000, environmentalPermitCostPerYear: 7000,
        },
        environment: {
            baselineAQI: 20,
            gridCarbonIntensity: 0.6,
        },
        risk: {
            downtimeCostPerMin: 4500,
        },
        supplyChain: {
            importDifficultyFactor: 1.2,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Sydney Olympic Park'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.30,
            incentivePrograms: ['R&D Tax Incentive', 'Clean Energy Finance Corp', 'NSW Digital Economy'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.30,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'moderate',
            typhoonRisk: 'low',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 22,
            insuranceMultiplier: 1.1,
            structuralReinforcement: 0.02,
        },
        gridReliability: {
            gridUptime: 99.98,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 8,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 48,
            renewableReadiness: 80,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 18,
            hyperscalerPresence: 6,
            avgHiringDays: 35,
            salaryPremium: 1.05,
            talentScore: 75,
            certifiedProfessionals: 1200,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.30,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.40,
            fuelTaxRate: 0.10,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 80000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    // ─── MENA ───────────────────────────────────────────────
    AE: {
        id: 'AE', region: 'MENA', name: 'UAE', currency: 'USD', currencySymbol: '$',
        // 2026: UAE Corp Tax 9% (since Jun 2023, free zones still 0% qualifying income)
        // Electricity: ~$0.09/kWh for industrial (DEWA tariff band E 2025)
        economy: { inflationRate: 0.025, laborEscalation: 0.035, taxRate: 0.09, electricityRate: 0.09 },
        constructionIndex: 0.85, // AE rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 800, baseSalary_ShiftLead: 5000, baseSalary_Engineer: 4000,
            baseSalary_Technician: 2500, baseSalary_Admin: 2000, baseSalary_Janitor: 1200,
            laborRatePerHour: 25,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 } },
            shrinkageFactor: 0.10, leaves: { annual: 30, publicHolidays: 10, sickAverage: 5 },
            // AE labor add-ons (2024-2026 statutory/screening): GPSSA 12.5% Emiratis only; expat-dominated DC workforce -> blended ~3% (screening); no statutory night premium — screening 10%
            socialSecurityRate: 0.03, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['DCDA', 'Estidama', 'Civil Defence'], annualComplianceCost: 15000, environmentalPermitCostPerYear: 3000 },
        environment: { baselineAQI: 100, gridCarbonIntensity: 0.45 },
        risk: { downtimeCostPerMin: 3500 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'fta',
            gpuExportTier: 2,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['JAFZA', 'DAFZA', 'Masdar City', 'ADGM'],
            taxHolidayYears: 50,
            taxHolidayRate: 0.0, // Free zone qualifying income still 0%
            incentivePrograms: ['Free Zone 0% Corp Tax (qualifying income)', 'Dubai D33 Digital Economy', 'ADIO DC incentive scheme 2025'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0, // Free zone effective rate 0% for DC qualifying income
            programs: [
                { name: 'Free-zone 0% (QFZP)', cite: 'Federal Decree-Law 47/2022 + Cabinet Decision 100/2023', benefit: '0% CIT on qualifying free-zone income (9% mainland/non-qualifying)', eligibility: 'Qualifying Free Zone Person with substance in-zone' },
                { name: 'Dubai D33 / DEZ incentives', cite: 'Dubai D33 Agenda (2023)', benefit: 'Digital-economy programs, land + power facilitation for DC/AI campuses' },
                { name: 'ADIO innovation incentives', cite: 'ADIO DC scheme (2025)', benefit: 'Abu Dhabi grants/cost rebates for qualifying tech infrastructure' },
            ],
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 8,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.98,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 5,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 75,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 6,
            hyperscalerPresence: 6,
            avgHiringDays: 30,
            salaryPremium: 1.15,
            talentScore: 65,
            certifiedProfessionals: 600,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.65,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.0,
            deliveryLeadDays: 1,
            environmentalPermitRequired: false,
            storageLimitLiters: 100000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    SA: {
        id: 'SA', region: 'MENA', name: 'Saudi Arabia', currency: 'SAR', currencySymbol: '﷼',
        economy: { inflationRate: 0.02, laborEscalation: 0.035, taxRate: 0.20, electricityRate: 0.05 },
        constructionIndex: 0.8, // SA rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 1100, baseSalary_ShiftLead: 4500, baseSalary_Engineer: 3800,
            baseSalary_Technician: 2200, baseSalary_Admin: 1800, baseSalary_Janitor: 1000,
            laborRatePerHour: 22,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 21, publicHolidays: 9, sickAverage: 4 },
            // SA labor add-ons (2024-2026 statutory/screening): GOSI employer 11.75% Saudis / 2% expats -> mixed-workforce blend ~6% (screening); no statutory night premium — screening 10%
            socialSecurityRate: 0.06, benefitsOverheadRate: 0.32, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['Saudi CDC', 'SASO', 'NEOM Standards'], annualComplianceCost: 12000, environmentalPermitCostPerYear: 2500 },
        environment: { baselineAQI: 110, gridCarbonIntensity: 0.55 },
        risk: { downtimeCostPerMin: 3000 },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['KAEC', 'NEOM', 'Jazan Economic City'],
            taxHolidayYears: 10,
            taxHolidayRate: 0.0,
            incentivePrograms: ['Vision 2030 DC Initiative', 'SAGIA Investment License', 'NEOM Tech Incentive'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
            programs: [
                { name: 'Regional HQ (RHQ) package', cite: 'MISA RHQ Program (2024) + ZATCA rules', benefit: '30-yr 0% CIT + 0% WHT on RHQ activities', eligibility: 'Regional headquarters entities' },
                { name: 'Special Economic Zones', cite: 'ECZA SEZ framework (2023)', benefit: '5% CIT up to 20 yrs + 0% customs in-zone + expat levy relief', note: 'Cloud Computing SEZ (KACST) explicitly targets DC/cloud' },
            ],
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'low',
            tsunamiRisk: 'none',
            compositeScore: 10,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.01,
        },
        gridReliability: {
            gridUptime: 99.95,
            voltageStability: 'stable',
            brownoutFrequency: 2,
            averageOutageDuration: 10,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 80,
        },
        talentPool: {
            dcEngineerPool: 'scarce',
            universityPipeline: 8,
            hyperscalerPresence: 3,
            avgHiringDays: 50,
            salaryPremium: 1.2,
            talentScore: 45,
            certifiedProfessionals: 280,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.20,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.0,
            deliveryLeadDays: 1,
            environmentalPermitRequired: false,
            storageLimitLiters: 100000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    QA: {
        id: 'QA', region: 'MENA', name: 'Qatar', currency: 'QAR', currencySymbol: 'QR',
        economy: { inflationRate: 0.02, laborEscalation: 0.03, taxRate: 0.10, electricityRate: 0.04 },
        constructionIndex: 0.85, // QA rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 1000, baseSalary_ShiftLead: 5200, baseSalary_Engineer: 4200,
            baseSalary_Technician: 2600, baseSalary_Admin: 2100, baseSalary_Janitor: 1300,
            laborRatePerHour: 24,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 } },
            shrinkageFactor: 0.10, leaves: { annual: 21, publicHolidays: 9, sickAverage: 4 },
            // QA labor add-ons (2024-2026 statutory/screening): pension 14% Qataris only (Law 1/2022); expat-dominated -> blended ~3% (screening); no statutory night premium — screening 10%
            socialSecurityRate: 0.03, benefitsOverheadRate: 0.32, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['Kahramaa', 'QCS 2014'], annualComplianceCost: 14000, environmentalPermitCostPerYear: 3000 },
        environment: { baselineAQI: 95, gridCarbonIntensity: 0.48 },
        risk: { downtimeCostPerMin: 3500 },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Qatar Free Zones (QFZ)', 'Manateq Logistics Park'],
            taxHolidayYears: 20,
            taxHolidayRate: 0.0,
            incentivePrograms: ['QFZ 0% Tax', 'Qatar Investment Authority Support', 'Smart Qatar Programme'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
            programs: [
                { name: 'Qatar Free Zones', cite: 'Law No. 34 of 2005 (QFZA)', benefit: '20-yr renewable tax holiday + 0% customs + 100% foreign ownership', eligibility: 'Ras Bufontas / Umm Alhoul free-zone entities' },
                { name: 'Qatar Financial Centre', cite: 'QFC Law No. 7 of 2005', benefit: '10% CIT on local-source profits + full repatriation' },
            ],
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 5,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.97,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 8,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 70,
        },
        talentPool: {
            dcEngineerPool: 'scarce',
            universityPipeline: 3,
            hyperscalerPresence: 2,
            avgHiringDays: 55,
            salaryPremium: 1.25,
            talentScore: 38,
            certifiedProfessionals: 120,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.30,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.0,
            deliveryLeadDays: 1,
            environmentalPermitRequired: false,
            storageLimitLiters: 80000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    // ─── AFRICA ─────────────────────────────────────────────
    ZA: {
        id: 'ZA', region: 'AFR', name: 'South Africa', currency: 'ZAR', currencySymbol: 'R',
        economy: { inflationRate: 0.05, laborEscalation: 0.06, taxRate: 0.27, electricityRate: 0.10 },
        constructionIndex: 0.55, // ZA rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 250, baseSalary_ShiftLead: 2200, baseSalary_Engineer: 1800,
            baseSalary_Technician: 1100, baseSalary_Admin: 800, baseSalary_Janitor: 400,
            laborRatePerHour: 12,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.22, leaves: { annual: 15, publicHolidays: 12, sickAverage: 6 },
            // ZA labor add-ons (2024-2026 statutory/screening): UIF 1% + SDL 1% + COIDA ~1% (no mandatory pension); BCEA s17 requires night allowance, amount by agreement — screening 10%
            socialSecurityRate: 0.03, benefitsOverheadRate: 0.22, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['SABS', 'ECSA', 'OHS Act'], annualComplianceCost: 5000, environmentalPermitCostPerYear: 3000 },
        environment: { baselineAQI: 50, gridCarbonIntensity: 0.9 },
        risk: { downtimeCostPerMin: 1500 },
        supplyChain: {
            importDifficultyFactor: 1.3,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['Coega IDZ', 'Dube TradePort', 'Richards Bay IDZ'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.27,
            incentivePrograms: ['Section 12L Energy Efficiency', 'SEZ Tax Incentive (15%)', 'Renewable Energy Tax Deduction'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.15,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 15,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.01,
        },
        gridReliability: {
            gridUptime: 95.0,
            voltageStability: 'unstable',
            brownoutFrequency: 200,
            averageOutageDuration: 120,
            gridTier: 3,
            backupFuelPremium: 0.40,
            recommendedGenHours: 168,
            renewableReadiness: 75,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 15,
            hyperscalerPresence: 4,
            avgHiringDays: 35,
            salaryPremium: 1.05,
            talentScore: 60,
            certifiedProfessionals: 450,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.15,
            dieselAvailability: 'moderate',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.07,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    NG: {
        id: 'NG', region: 'AFR', name: 'Nigeria', currency: 'USD', currencySymbol: '$',
        economy: { inflationRate: 0.14, laborEscalation: 0.08, taxRate: 0.30, electricityRate: 0.12 },
        constructionIndex: 0.75, // NG rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 80, baseSalary_ShiftLead: 1200, baseSalary_Engineer: 900,
            baseSalary_Technician: 500, baseSalary_Admin: 350, baseSalary_Janitor: 150,
            laborRatePerHour: 6,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.25, leaves: { annual: 12, publicHolidays: 11, sickAverage: 5 },
            // NG labor add-ons (2024-2026 statutory/screening): PenCom pension employer 10% + NSITF 1% + ITF 1%; no statutory night premium — screening 5%
            socialSecurityRate: 0.12, benefitsOverheadRate: 0.18, nightShiftPremiumRate: 0.05, workingHoursPerMonth: 155,
        },
        compliance: { certifications: ['NCC', 'SON', 'NESREA'], annualComplianceCost: 3000, environmentalPermitCostPerYear: 2000 },
        environment: { baselineAQI: 140, gridCarbonIntensity: 0.45 },
        risk: { downtimeCostPerMin: 800 },
        supplyChain: {
            importDifficultyFactor: 1.6,
            importDutyBand: 'high',
            gpuExportTier: 2,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['Lekki Free Zone', 'Calabar FTZ', 'Kano FTZ'],
            taxHolidayYears: 5,
            taxHolidayRate: 0.0,
            incentivePrograms: ['Pioneer Status Tax Holiday', 'Export Expansion Grant', 'Infrastructure Tax Relief'],
            importDutyExemption: true,
            landSubsidy: false,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'high',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 20,
            insuranceMultiplier: 1.15,
            structuralReinforcement: 0.01,
        },
        gridReliability: {
            gridUptime: 50.0,
            voltageStability: 'unstable',
            brownoutFrequency: 500,
            averageOutageDuration: 180,
            gridTier: 3,
            backupFuelPremium: 0.80,
            recommendedGenHours: 336,
            renewableReadiness: 65,
        },
        talentPool: {
            dcEngineerPool: 'very_scarce',
            universityPipeline: 10,
            hyperscalerPresence: 2,
            avgHiringDays: 75,
            salaryPremium: 1.3,
            talentScore: 25,
            certifiedProfessionals: 60,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.90,
            dieselAvailability: 'scarce',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.02,
            deliveryLeadDays: 7,
            environmentalPermitRequired: false,
            storageLimitLiters: 40000,
            fuelQualityRating: 'low',
        },
        lastUpdated: '2026-Q1',
    },
    KE: {
        id: 'KE', region: 'AFR', name: 'Kenya', currency: 'KES', currencySymbol: 'KSh',
        economy: { inflationRate: 0.07, laborEscalation: 0.06, taxRate: 0.30, electricityRate: 0.15 },
        constructionIndex: 0.6, // KE rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 150, baseSalary_ShiftLead: 1400, baseSalary_Engineer: 1000,
            baseSalary_Technician: 600, baseSalary_Admin: 400, baseSalary_Janitor: 200,
            laborRatePerHour: 7,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.20, leaves: { annual: 21, publicHolidays: 10, sickAverage: 5 },
            // KE labor add-ons (2024-2026 statutory/screening): NSSF employer 6% (Act 2013 tiers) + housing levy 1.5%; no statutory night premium — screening 5%
            socialSecurityRate: 0.075, benefitsOverheadRate: 0.18, nightShiftPremiumRate: 0.05, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['KEBS', 'ERC License'], annualComplianceCost: 3500, environmentalPermitCostPerYear: 2000 },
        environment: { baselineAQI: 60, gridCarbonIntensity: 0.3 },
        risk: { downtimeCostPerMin: 700 },
        supplyChain: {
            importDifficultyFactor: 1.5,
            importDutyBand: 'high',
            gpuExportTier: 2,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['Nairobi SEZ', 'Konza Technopolis'],
            taxHolidayYears: 10,
            taxHolidayRate: 0.10,
            incentivePrograms: ['SEZ Corporate Tax 10%', 'Konza Silicon Savannah', 'Digital Economy Blueprint'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.10,
        },
        naturalDisaster: {
            seismicZone: 2,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'low',
            tsunamiRisk: 'low',
            compositeScore: 25,
            insuranceMultiplier: 1.1,
            structuralReinforcement: 0.03,
        },
        gridReliability: {
            gridUptime: 85.0,
            voltageStability: 'unstable',
            brownoutFrequency: 120,
            averageOutageDuration: 90,
            gridTier: 3,
            backupFuelPremium: 0.50,
            recommendedGenHours: 168,
            renewableReadiness: 80,
        },
        talentPool: {
            dcEngineerPool: 'very_scarce',
            universityPipeline: 5,
            hyperscalerPresence: 3,
            avgHiringDays: 60,
            salaryPremium: 1.2,
            talentScore: 30,
            certifiedProfessionals: 80,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.25,
            dieselAvailability: 'moderate',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.08,
            deliveryLeadDays: 5,
            environmentalPermitRequired: true,
            storageLimitLiters: 40000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    // ─── LATIN AMERICA ──────────────────────────────────────
    BR: {
        id: 'BR', region: 'LATAM', name: 'Brazil', currency: 'BRL', currencySymbol: 'R$',
        economy: { inflationRate: 0.045, laborEscalation: 0.05, taxRate: 0.34, electricityRate: 0.10 },
        constructionIndex: 0.6, // BR rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 300, baseSalary_ShiftLead: 2000, baseSalary_Engineer: 1500,
            baseSalary_Technician: 900, baseSalary_Admin: 700, baseSalary_Janitor: 350,
            laborRatePerHour: 12,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.22, leaves: { annual: 30, publicHolidays: 12, sickAverage: 5 },
            // BR labor add-ons (2024-2026 statutory/screening): INSS patronal 20% + RAT ~2% + Sistema S ~5.8%; adicional noturno statutory +20% urban 22:00-05:00 (CLT Art.73); hrs on 44h wk
            socialSecurityRate: 0.28, benefitsOverheadRate: 0.4, nightShiftPremiumRate: 0.2, workingHoursPerMonth: 156,
        },
        compliance: { certifications: ['INMETRO', 'NR-10', 'ANATEL'], annualComplianceCost: 6000, environmentalPermitCostPerYear: 3500 },
        environment: { baselineAQI: 50, gridCarbonIntensity: 0.15 },
        risk: { downtimeCostPerMin: 1800 },
        supplyChain: {
            importDifficultyFactor: 1.4,
            importDutyBand: 'high',
            gpuExportTier: 2,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['Manaus Free Zone', 'ZPE Export Processing Zones'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.34,
            incentivePrograms: ['SUDENE/SUDAM Regional Incentive', 'Lei do Bem R&D', 'Manaus Digital Hub'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.34,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'high',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 18,
            insuranceMultiplier: 1.1,
            structuralReinforcement: 0.01,
        },
        gridReliability: {
            gridUptime: 99.8,
            voltageStability: 'moderate',
            brownoutFrequency: 8,
            averageOutageDuration: 30,
            gridTier: 2,
            backupFuelPremium: 0.08,
            recommendedGenHours: 48,
            renewableReadiness: 85,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 40,
            hyperscalerPresence: 5,
            avgHiringDays: 40,
            salaryPremium: 1.05,
            talentScore: 58,
            certifiedProfessionals: 350,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.10,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.12,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    CL: {
        id: 'CL', region: 'LATAM', name: 'Chile', currency: 'CLP', currencySymbol: 'CL$',
        economy: { inflationRate: 0.04, laborEscalation: 0.04, taxRate: 0.27, electricityRate: 0.12 },
        constructionIndex: 0.65, // CL rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 500, baseSalary_ShiftLead: 2300, baseSalary_Engineer: 1800,
            baseSalary_Technician: 1100, baseSalary_Admin: 800, baseSalary_Janitor: 500,
            laborRatePerHour: 14,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 15, publicHolidays: 15, sickAverage: 4 },
            // CL labor add-ons (2024-2026 statutory/screening): employer SIS ~1.5% + seguro cesantia 2.4% + mutual ~1% (worker pays AFP); no general statutory night premium — screening 10%
            socialSecurityRate: 0.05, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['SEC', 'INN Chile'], annualComplianceCost: 5000, environmentalPermitCostPerYear: 3000 },
        environment: { baselineAQI: 40, gridCarbonIntensity: 0.35 },
        risk: { downtimeCostPerMin: 1500 },
        supplyChain: {
            importDifficultyFactor: 1.3,
            importDutyBand: 'fta',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Iquique FTZ', 'Arica FTZ'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.27,
            incentivePrograms: ['CORFO Technology Fund', 'Chile Green Hydrogen', 'Extreme Zone Tax Benefits'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.27,
        },
        naturalDisaster: {
            seismicZone: 4,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'high',
            compositeScore: 72,
            insuranceMultiplier: 1.7,
            structuralReinforcement: 0.15,
        },
        gridReliability: {
            gridUptime: 99.9,
            voltageStability: 'stable',
            brownoutFrequency: 3,
            averageOutageDuration: 15,
            gridTier: 1,
            backupFuelPremium: 0.03,
            recommendedGenHours: 48,
            renewableReadiness: 90,
        },
        talentPool: {
            dcEngineerPool: 'scarce',
            universityPipeline: 8,
            hyperscalerPresence: 3,
            avgHiringDays: 45,
            salaryPremium: 1.15,
            talentScore: 48,
            certifiedProfessionals: 180,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.20,
            dieselAvailability: 'moderate',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.06,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    MX: {
        id: 'MX', region: 'LATAM', name: 'Mexico', currency: 'MXN', currencySymbol: 'MX$',
        economy: { inflationRate: 0.04, laborEscalation: 0.05, taxRate: 0.30, electricityRate: 0.09 },
        constructionIndex: 0.6, // MX rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 350, baseSalary_ShiftLead: 1800, baseSalary_Engineer: 1400,
            baseSalary_Technician: 850, baseSalary_Admin: 600, baseSalary_Janitor: 350,
            laborRatePerHour: 10,
            overtimeRules: { workday: { firstHour: 2.0, subsequent: 3.0 }, holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.18, leaves: { annual: 12, publicHolidays: 7, sickAverage: 4 },
            // MX labor add-ons (2024-2026 statutory/screening): IMSS employer ~20-25% + INFONAVIT 5% + SAR 2% + state payroll ~3% -> ~30% (screening); LFT night shift = 7h for 8h pay ~ +14% effective
            socialSecurityRate: 0.3, benefitsOverheadRate: 0.32, nightShiftPremiumRate: 0.14, workingHoursPerMonth: 158,
        },
        compliance: { certifications: ['NOM', 'SENER'], annualComplianceCost: 5000, environmentalPermitCostPerYear: 3000 },
        environment: { baselineAQI: 80, gridCarbonIntensity: 0.45 },
        risk: { downtimeCostPerMin: 1200 },
        supplyChain: {
            importDifficultyFactor: 1.15,
            importDutyBand: 'low',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Queretaro SEZ', 'Bajio Industrial Corridor'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.30,
            incentivePrograms: ['Nearshoring Tax Incentive', 'IMMEX Maquiladora', 'CONACYT R&D Support'],
            importDutyExemption: true,
            landSubsidy: false,
            effectiveTaxRate: 0.30,
        },
        naturalDisaster: {
            seismicZone: 3,
            floodRisk: 'moderate',
            typhoonRisk: 'moderate',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'moderate',
            compositeScore: 62,
            insuranceMultiplier: 1.5,
            structuralReinforcement: 0.10,
        },
        gridReliability: {
            gridUptime: 99.7,
            voltageStability: 'moderate',
            brownoutFrequency: 12,
            averageOutageDuration: 35,
            gridTier: 2,
            backupFuelPremium: 0.10,
            recommendedGenHours: 72,
            renewableReadiness: 70,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 35,
            hyperscalerPresence: 4,
            avgHiringDays: 35,
            salaryPremium: 1.05,
            talentScore: 55,
            certifiedProfessionals: 300,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.05,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.08,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    CO: {
        id: 'CO', region: 'LATAM', name: 'Colombia', currency: 'COP', currencySymbol: 'CO$',
        // 2026: Colombia C&I electricity ~COP 700-900/kWh; currency depreciation pushes USD equivalent ~$0.09-0.11
        economy: { inflationRate: 0.06, laborEscalation: 0.055, taxRate: 0.35, electricityRate: 0.10 },
        constructionIndex: 0.55, // CO rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 280, baseSalary_ShiftLead: 1600, baseSalary_Engineer: 1200,
            baseSalary_Technician: 700, baseSalary_Admin: 500, baseSalary_Janitor: 300,
            laborRatePerHour: 8,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.75 }, holiday: { first8Hours: 1.75, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.20, leaves: { annual: 15, publicHolidays: 18, sickAverage: 4 },
            // CO labor add-ons (2024-2026 statutory/screening): pension 12% + ARL ~2% + caja 4% + health 8.5% (Ley 1607 exoneration partial) -> ~21% screening; recargo nocturno statutory +35% (CST Art.168, window 19:00- per 2025 reform)
            socialSecurityRate: 0.21, benefitsOverheadRate: 0.35, nightShiftPremiumRate: 0.35, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['RETIE', 'SIC'], annualComplianceCost: 4000, environmentalPermitCostPerYear: 2500 },
        environment: { baselineAQI: 55, gridCarbonIntensity: 0.2 },
        risk: { downtimeCostPerMin: 1000 },
        supplyChain: {
            importDifficultyFactor: 1.35,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Zona Franca Bogota', 'Zona Franca del Pacifico'],
            taxHolidayYears: 5,
            taxHolidayRate: 0.20,
            incentivePrograms: ['Free Zone 20% Rate', 'Orange Economy Tax Benefits', 'Mega-Investment Incentive'],
            importDutyExemption: true,
            landSubsidy: false,
            effectiveTaxRate: 0.20,
        },
        naturalDisaster: {
            seismicZone: 3,
            floodRisk: 'high',
            typhoonRisk: 'none',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'low',
            compositeScore: 52,
            insuranceMultiplier: 1.4,
            structuralReinforcement: 0.08,
        },
        gridReliability: {
            gridUptime: 99.5,
            voltageStability: 'moderate',
            brownoutFrequency: 15,
            averageOutageDuration: 40,
            gridTier: 2,
            backupFuelPremium: 0.12,
            recommendedGenHours: 72,
            renewableReadiness: 60,
        },
        talentPool: {
            dcEngineerPool: 'scarce',
            universityPipeline: 12,
            hyperscalerPresence: 2,
            avgHiringDays: 50,
            salaryPremium: 1.15,
            talentScore: 40,
            certifiedProfessionals: 120,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.85,
            dieselAvailability: 'moderate',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.05,
            deliveryLeadDays: 4,
            environmentalPermitRequired: true,
            storageLimitLiters: 40000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    // ─── EXPANDED APAC ──────────────────────────────────────
    IN: {
        id: 'IN', region: 'APAC', name: 'India', currency: 'INR', currencySymbol: '₹',
        economy: { inflationRate: 0.05, laborEscalation: 0.07, taxRate: 0.2517, electricityRate: 0.07 },
        constructionIndex: 0.55, // IN rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 200, baseSalary_ShiftLead: 1200, baseSalary_Engineer: 900,
            baseSalary_Technician: 500, baseSalary_Admin: 400, baseSalary_Janitor: 200,
            laborRatePerHour: 8,
            overtimeRules: { workday: { firstHour: 2.0, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.20, leaves: { annual: 12, publicHolidays: 16, sickAverage: 6 },
            // IN labor add-ons (2024-2026 statutory/screening): EPF employer 12% + EDLI/admin ~1%; no national statutory night premium — screening 10%
            socialSecurityRate: 0.13, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['BIS', 'CEA Regulations', 'LEED India'], annualComplianceCost: 4000, environmentalPermitCostPerYear: 2500 },
        environment: { baselineAQI: 150, gridCarbonIntensity: 0.72 },
        risk: { downtimeCostPerMin: 1200 },
        supplyChain: {
            importDifficultyFactor: 1.2,
            importDutyBand: 'high',
            gpuExportTier: 2,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['SEEPZ Mumbai', 'Mahindra World City', 'GIFT City Gujarat'],
            taxHolidayYears: 10,
            taxHolidayRate: 0.15,
            incentivePrograms: ['IT/ITES SEZ Tax Holiday', 'GIFT City IFSC Benefits', 'PLI Scheme for IT Hardware'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.15,
            programs: [
                { name: 'DC infrastructure status', cite: 'Harmonized Master List (DEA notification 2022)', benefit: 'Infrastructure lending status — cheaper long-tenor debt (not a tax break)' },
                { name: 'State DC policies', cite: 'UP Data Centre Policy 2021 · Maharashtra IT/ITES Policy 2023', benefit: 'Land/stamp-duty/electricity-duty exemptions + capex subsidies (state-level)' },
                { name: 'SEZ regime (legacy)', cite: 'SEZ Act 2005 §10AA', benefit: 'Phased income-tax holiday — SUNSET for new units (post-2020); relevant to existing zones only', note: 'DESH bill (replacement) pending — verify status' },
            ],
        },
        naturalDisaster: {
            seismicZone: 3,
            floodRisk: 'extreme',
            typhoonRisk: 'moderate',
            volcanoRisk: 'none',
            tsunamiRisk: 'moderate',
            compositeScore: 58,
            insuranceMultiplier: 1.45,
            structuralReinforcement: 0.08,
        },
        gridReliability: {
            gridUptime: 99.0,
            voltageStability: 'moderate',
            brownoutFrequency: 30,
            averageOutageDuration: 60,
            gridTier: 2,
            backupFuelPremium: 0.20,
            recommendedGenHours: 96,
            renewableReadiness: 75,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 200,
            hyperscalerPresence: 6,
            avgHiringDays: 25,
            salaryPremium: 1.0,
            talentScore: 78,
            certifiedProfessionals: 2500,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.00,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.12,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    CN: {
        id: 'CN', region: 'APAC', name: 'China', currency: 'CNY', currencySymbol: '¥',
        economy: { inflationRate: 0.02, laborEscalation: 0.06, taxRate: 0.25, electricityRate: 0.06 },
        constructionIndex: 0.7, // CN rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 400, baseSalary_ShiftLead: 2000, baseSalary_Engineer: 1500,
            baseSalary_Technician: 900, baseSalary_Admin: 700, baseSalary_Janitor: 450,
            laborRatePerHour: 12,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 3.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 5, publicHolidays: 11, sickAverage: 3 },
            // CN labor add-ons (2024-2026 statutory/screening): employer ~27% ex-housing-fund (pension 16 + medical ~8 + unemp ~0.7 + injury ~0.4, city-varying); night premium local/company practice — screening 10%
            socialSecurityRate: 0.27, benefitsOverheadRate: 0.28, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 161,
        },
        compliance: { certifications: ['GB Standards', 'MIIT License', 'Green DC Rating'], annualComplianceCost: 8000, environmentalPermitCostPerYear: 4000 },
        environment: { baselineAQI: 130, gridCarbonIntensity: 0.58 },
        risk: { downtimeCostPerMin: 2500 },
        supplyChain: {
            importDifficultyFactor: 1.1,
            /* punitive: AI-DC frontier equipment is predominantly US-origin →
             * Section-301 / retaliatory tariffs (~25-30%) dominate; matches the
             * DATA.sources 'punitive ~30% China↔US' intent. Tier-3 export-restricted. */
            importDutyBand: 'punitive',
            gpuExportTier: 3,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['Shanghai FTZ', 'Hainan FTP', 'Shenzhen Qianhai'],
            taxHolidayYears: 5,
            taxHolidayRate: 0.15,
            incentivePrograms: ['HNTE 15% Tax Rate', 'Western Development Strategy', 'New Infrastructure Initiative'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.15,
        },
        naturalDisaster: {
            seismicZone: 2,
            floodRisk: 'high',
            typhoonRisk: 'moderate',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 42,
            insuranceMultiplier: 1.3,
            structuralReinforcement: 0.06,
        },
        gridReliability: {
            gridUptime: 99.95,
            voltageStability: 'stable',
            brownoutFrequency: 2,
            averageOutageDuration: 12,
            gridTier: 1,
            backupFuelPremium: 0.02,
            recommendedGenHours: 48,
            renewableReadiness: 60,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 300,
            hyperscalerPresence: 8,
            avgHiringDays: 20,
            salaryPremium: 1.0,
            talentScore: 85,
            certifiedProfessionals: 5000,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.10,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.05,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 80000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    KR: {
        id: 'KR', region: 'APAC', name: 'South Korea', currency: 'KRW', currencySymbol: '₩',
        // 2026: KEPCO industrial tariff raised 2023-2024; now ~$0.13-0.14/kWh large industrial
        economy: { inflationRate: 0.025, laborEscalation: 0.04, taxRate: 0.22, electricityRate: 0.135 },
        constructionIndex: 0.95, // KR rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 1500, baseSalary_ShiftLead: 4000, baseSalary_Engineer: 3200,
            baseSalary_Technician: 2400, baseSalary_Admin: 2000, baseSalary_Janitor: 1500,
            laborRatePerHour: 28,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 15, publicHolidays: 15, sickAverage: 3 },
            // KR labor add-ons (2024-2026 statutory/screening): NPS 4.5% + NHI 3.55% + LTC ~0.46% + EI 1.15% + comp ~1%; statutory +50% on 22:00-06:00 hours (LSA Art.56) -> ~30% applied blended over rotation
            socialSecurityRate: 0.11, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.3, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['KS Standards', 'KISA DC Cert'], annualComplianceCost: 9000, environmentalPermitCostPerYear: 7000 },
        environment: { baselineAQI: 55, gridCarbonIntensity: 0.42 },
        risk: { downtimeCostPerMin: 3500 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Incheon FEZ', 'Busan-Jinhae FEZ', 'Sejong Smart City'],
            taxHolidayYears: 5,
            taxHolidayRate: 0.0,
            incentivePrograms: ['FEZ Tax Exemption', 'Digital New Deal', 'K-Cloud Initiative'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'moderate',
            typhoonRisk: 'moderate',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 30,
            insuranceMultiplier: 1.15,
            structuralReinforcement: 0.03,
        },
        gridReliability: {
            gridUptime: 99.99,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 3,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 50,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 35,
            hyperscalerPresence: 5,
            avgHiringDays: 40,
            salaryPremium: 1.1,
            talentScore: 68,
            certifiedProfessionals: 900,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.30,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.50,
            fuelTaxRate: 0.10,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    TH: {
        id: 'TH', region: 'APAC', name: 'Thailand', currency: 'THB', currencySymbol: '฿',
        // 2026: EGAT + MEA raised rates 2023-2024; industrial C&I ~THB 3.5-4.0/kWh = ~$0.09-0.11 USD
        economy: { inflationRate: 0.02, laborEscalation: 0.04, taxRate: 0.20, electricityRate: 0.10 },
        constructionIndex: 0.6, // TH rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 300, baseSalary_ShiftLead: 1400, baseSalary_Engineer: 1000,
            baseSalary_Technician: 600, baseSalary_Admin: 450, baseSalary_Janitor: 300,
            laborRatePerHour: 8,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.18, leaves: { annual: 6, publicHolidays: 16, sickAverage: 5 },
            // TH labor add-ons (2024-2026 statutory/screening): SSF employer 5% (capped B750/mo) + workmen comp 0.2-1%; no statutory night premium — screening 8%
            socialSecurityRate: 0.052, benefitsOverheadRate: 0.2, nightShiftPremiumRate: 0.08, workingHoursPerMonth: 155,
        },
        compliance: { certifications: ['TIS Standards', 'PEA License'], annualComplianceCost: 4500, environmentalPermitCostPerYear: 2500 },
        environment: { baselineAQI: 80, gridCarbonIntensity: 0.5 },
        risk: { downtimeCostPerMin: 1000 },
        supplyChain: {
            importDifficultyFactor: 1.15,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Eastern Seaboard (EEC)', 'Amata City', 'Hemaraj Industrial'],
            taxHolidayYears: 8,
            taxHolidayRate: 0.0,
            incentivePrograms: ['BOI DC Investment Promotion', 'EEC Digital Park', 'Thailand 4.0 Smart Electronics'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'extreme',
            typhoonRisk: 'low',
            volcanoRisk: 'none',
            tsunamiRisk: 'moderate',
            compositeScore: 40,
            insuranceMultiplier: 1.3,
            structuralReinforcement: 0.03,
        },
        gridReliability: {
            gridUptime: 99.8,
            voltageStability: 'moderate',
            brownoutFrequency: 8,
            averageOutageDuration: 25,
            gridTier: 2,
            backupFuelPremium: 0.08,
            recommendedGenHours: 48,
            renewableReadiness: 65,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 20,
            hyperscalerPresence: 4,
            avgHiringDays: 35,
            salaryPremium: 1.05,
            talentScore: 55,
            certifiedProfessionals: 280,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.85,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.05,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    VN: {
        id: 'VN', region: 'APAC', name: 'Vietnam', currency: 'VND', currencySymbol: '₫',
        // 2026: EVN raised industrial tariffs ~20% in 2023; current C&I ~VND 2,000-2,400/kWh = ~$0.08-0.10
        economy: { inflationRate: 0.035, laborEscalation: 0.07, taxRate: 0.20, electricityRate: 0.09 },
        constructionIndex: 0.55, // VN rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 200, baseSalary_ShiftLead: 1100, baseSalary_Engineer: 800,
            baseSalary_Technician: 450, baseSalary_Admin: 350, baseSalary_Janitor: 200,
            laborRatePerHour: 6,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 3.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.22, leaves: { annual: 12, publicHolidays: 10, sickAverage: 5 },
            // VN labor add-ons (2024-2026 statutory/screening): employer 21.5% (SI 17.5 + HI 3 + UI 1, capped; SI Law 2024 eff. 7/2025); night statutory +30% (Labor Code 2019 Art.98)
            socialSecurityRate: 0.215, benefitsOverheadRate: 0.22, nightShiftPremiumRate: 0.3, workingHoursPerMonth: 155,
        },
        compliance: { certifications: ['TCVN', 'MOIT License'], annualComplianceCost: 3500, environmentalPermitCostPerYear: 2000 },
        environment: { baselineAQI: 100, gridCarbonIntensity: 0.55 },
        risk: { downtimeCostPerMin: 800 },
        supplyChain: {
            importDifficultyFactor: 1.3,
            importDutyBand: 'med',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Saigon Hi-Tech Park', 'Da Nang IT Park', 'VSIP Binh Duong'],
            taxHolidayYears: 4,
            taxHolidayRate: 0.0,
            incentivePrograms: ['CIT Preferential Rate 10%', 'Hi-Tech Enterprise Incentive', 'Digital Infrastructure Investment'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'extreme',
            typhoonRisk: 'high',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 48,
            insuranceMultiplier: 1.35,
            structuralReinforcement: 0.05,
        },
        gridReliability: {
            gridUptime: 99.2,
            voltageStability: 'moderate',
            brownoutFrequency: 20,
            averageOutageDuration: 50,
            gridTier: 2,
            backupFuelPremium: 0.18,
            recommendedGenHours: 72,
            renewableReadiness: 55,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 30,
            hyperscalerPresence: 3,
            avgHiringDays: 35,
            salaryPremium: 1.05,
            talentScore: 50,
            certifiedProfessionals: 200,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.90,
            dieselAvailability: 'moderate',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.07,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 40000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    PH: {
        id: 'PH', region: 'APAC', name: 'Philippines', currency: 'PHP', currencySymbol: '₱',
        // 2026: Philippines has among highest C&I electricity in SEA; Meralco commercial ~PHP 7.0-8.5/kWh = ~$0.12-0.15
        economy: { inflationRate: 0.05, laborEscalation: 0.05, taxRate: 0.25, electricityRate: 0.13 },
        constructionIndex: 0.6, // PH rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 250, baseSalary_ShiftLead: 1300, baseSalary_Engineer: 1000,
            baseSalary_Technician: 550, baseSalary_Admin: 400, baseSalary_Janitor: 250,
            laborRatePerHour: 7,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.3 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.6 } },
            shrinkageFactor: 0.22, leaves: { annual: 5, publicHolidays: 18, sickAverage: 5 },
            // PH labor add-ons (2024-2026 statutory/screening): SSS employer 10% of MSC (2025, cap P35k) + PhilHealth 2.5% + Pag-IBIG 2% -> ~12% effective w/ caps; night shift differential statutory +10% 22:00-06:00 (LC Art.86)
            socialSecurityRate: 0.12, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 155,
        },
        compliance: { certifications: ['PNS Standards', 'DOE License'], annualComplianceCost: 3500, environmentalPermitCostPerYear: 2500 },
        environment: { baselineAQI: 70, gridCarbonIntensity: 0.6 },
        risk: { downtimeCostPerMin: 900 },
        supplyChain: {
            importDifficultyFactor: 1.35,
            importDutyBand: 'high',
            gpuExportTier: 2,
            customsLeadBand: 'slow',
        },
        taxIncentives: {
            freeTradeZones: ['PEZA Zones (400+)', 'Clark Freeport', 'Subic Bay Freeport'],
            taxHolidayYears: 7,
            taxHolidayRate: 0.0,
            incentivePrograms: ['CREATE MORE Act', 'PEZA IT Enterprise', 'Green Lane for DC Equipment'],
            importDutyExemption: true,
            landSubsidy: false,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 3,
            floodRisk: 'extreme',
            typhoonRisk: 'high',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'moderate',
            compositeScore: 78,
            insuranceMultiplier: 1.75,
            structuralReinforcement: 0.14,
        },
        gridReliability: {
            gridUptime: 98.0,
            voltageStability: 'unstable',
            brownoutFrequency: 40,
            averageOutageDuration: 60,
            gridTier: 3,
            backupFuelPremium: 0.25,
            recommendedGenHours: 96,
            renewableReadiness: 60,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 22,
            hyperscalerPresence: 3,
            avgHiringDays: 30,
            salaryPremium: 1.05,
            talentScore: 55,
            certifiedProfessionals: 250,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.00,
            dieselAvailability: 'moderate',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.06,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 40000,
            fuelQualityRating: 'moderate',
        },
        lastUpdated: '2026-Q1',
    },
    TW: {
        id: 'TW', region: 'APAC', name: 'Taiwan', currency: 'TWD', currencySymbol: 'NT$',
        // 2026: Taipower raised industrial rates 2023-2024; ~TWD 3.5-4.0/kWh = ~$0.11-0.13 USD
        economy: { inflationRate: 0.02, laborEscalation: 0.03, taxRate: 0.20, electricityRate: 0.12 },
        constructionIndex: 0.8, // TW rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 900, baseSalary_ShiftLead: 2800, baseSalary_Engineer: 2200,
            baseSalary_Technician: 1600, baseSalary_Admin: 1200, baseSalary_Janitor: 900,
            laborRatePerHour: 20,
            overtimeRules: { workday: { firstHour: 1.34, subsequent: 1.67 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 7, publicHolidays: 12, sickAverage: 4 },
            // TW labor add-ons (2024-2026 statutory/screening): Labor Insurance ~12%x70% + NHI 5.17%x60% + Labor Pension 6% -> ~17%; no statutory night premium — screening 10%
            socialSecurityRate: 0.17, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 158,
        },
        compliance: { certifications: ['CNS Standards', 'Taipower License'], annualComplianceCost: 7000, environmentalPermitCostPerYear: 5000 },
        environment: { baselineAQI: 60, gridCarbonIntensity: 0.5 },
        risk: { downtimeCostPerMin: 3000 },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Hsinchu Science Park', 'Kaohsiung Software Park'],
            taxHolidayYears: 5,
            taxHolidayRate: 0.0,
            incentivePrograms: ['Smart Machinery Tax Credit', 'Industrial Innovation Act', 'Asia Silicon Valley Plan'],
            importDutyExemption: true,
            landSubsidy: false,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 4,
            floodRisk: 'moderate',
            typhoonRisk: 'high',
            volcanoRisk: 'low',
            tsunamiRisk: 'moderate',
            compositeScore: 75,
            insuranceMultiplier: 1.7,
            structuralReinforcement: 0.16,
        },
        gridReliability: {
            gridUptime: 99.9,
            voltageStability: 'stable',
            brownoutFrequency: 3,
            averageOutageDuration: 15,
            gridTier: 1,
            backupFuelPremium: 0.03,
            recommendedGenHours: 48,
            renewableReadiness: 50,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 18,
            hyperscalerPresence: 5,
            avgHiringDays: 40,
            salaryPremium: 1.1,
            talentScore: 65,
            certifiedProfessionals: 650,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.05,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.05,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    NZ: {
        id: 'NZ', region: 'APAC', name: 'New Zealand', currency: 'NZD', currencySymbol: 'NZ$',
        economy: { inflationRate: 0.03, laborEscalation: 0.035, taxRate: 0.28, electricityRate: 0.16 },
        constructionIndex: 1.1, // NZ rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2500, baseSalary_ShiftLead: 7500, baseSalary_Engineer: 6000,
            baseSalary_Technician: 4500, baseSalary_Admin: 3800, baseSalary_Janitor: 3000,
            laborRatePerHour: 38,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 20, publicHolidays: 11, sickAverage: 5 },
            // NZ labor add-ons (2024-2026 statutory/screening): KiwiSaver employer 3% + ACC levy ~1%; no statutory night premium — screening 10%
            socialSecurityRate: 0.04, benefitsOverheadRate: 0.2, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['AS/NZS Standards', 'WorkSafe'], annualComplianceCost: 8000, environmentalPermitCostPerYear: 6000 },
        environment: { baselineAQI: 15, gridCarbonIntensity: 0.1 },
        risk: { downtimeCostPerMin: 4000 },
        supplyChain: {
            importDifficultyFactor: 1.25,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: [],
            taxHolidayYears: 0,
            taxHolidayRate: 0.28,
            incentivePrograms: ['Callaghan Innovation R&D Grant', 'NZ Green Investment Fund'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.28,
        },
        naturalDisaster: {
            seismicZone: 4,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'moderate',
            tsunamiRisk: 'moderate',
            compositeScore: 65,
            insuranceMultiplier: 1.6,
            structuralReinforcement: 0.14,
        },
        gridReliability: {
            gridUptime: 99.98,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 5,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 48,
            renewableReadiness: 90,
        },
        talentPool: {
            dcEngineerPool: 'scarce',
            universityPipeline: 3,
            hyperscalerPresence: 2,
            avgHiringDays: 50,
            salaryPremium: 1.2,
            talentScore: 42,
            certifiedProfessionals: 150,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.40,
            dieselAvailability: 'moderate',
            hvoAvailable: true,
            hvoPricePerLiter: 2.60,
            fuelTaxRate: 0.08,
            deliveryLeadDays: 3,
            environmentalPermitRequired: true,
            storageLimitLiters: 40000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    // ─── EXPANDED EMEA ──────────────────────────────────────
    GB: {
        id: 'GB', region: 'EMEA', name: 'United Kingdom', currency: 'GBP', currencySymbol: '£',
        // 2026: UK C&I electricity ~£0.18-0.22/kWh; corp tax held at 25%; wage growth moderating
        economy: { inflationRate: 0.027, laborEscalation: 0.035, taxRate: 0.25, electricityRate: 0.22 },
        constructionIndex: 1.15, // GB rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2200, baseSalary_ShiftLead: 8000, baseSalary_Engineer: 6500,
            baseSalary_Technician: 4500, baseSalary_Admin: 3500, baseSalary_Janitor: 2500,
            laborRatePerHour: 38,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 28, publicHolidays: 8, sickAverage: 5 },
            // GB labor add-ons (2024-2026 statutory/screening): employer NIC 15% above GBP5k threshold (HMRC, from Apr 2025); no statutory night premium (NMW only) — screening 10%
            socialSecurityRate: 0.15, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['BS EN Standards', 'IET Wiring Regs', 'BREEAM'], annualComplianceCost: 14000, environmentalPermitCostPerYear: 6500 },
        environment: { baselineAQI: 25, gridCarbonIntensity: 0.23 },
        risk: { downtimeCostPerMin: 4500 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['London Docklands Enterprise Zone'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.25,
            incentivePrograms: ['R&D Tax Credit (RDEC)', 'Capital Allowances Super Deduction', 'Enterprise Zones'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.25,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 10,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.99,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 3,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 65,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 30,
            hyperscalerPresence: 7,
            avgHiringDays: 30,
            salaryPremium: 1.0,
            talentScore: 82,
            certifiedProfessionals: 3500,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.70,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.80,
            fuelTaxRate: 0.15,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    DE: {
        id: 'DE', region: 'EMEA', name: 'Germany', currency: 'EUR', currencySymbol: '€',
        // 2026: German C&I electricity still ~€0.22-0.28/kWh; slight moderation from 2022 peak
        economy: { inflationRate: 0.023, laborEscalation: 0.03, taxRate: 0.2975, electricityRate: 0.26 },
        constructionIndex: 1.05, // DE rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2400, baseSalary_ShiftLead: 8500, baseSalary_Engineer: 7000,
            baseSalary_Technician: 5000, baseSalary_Admin: 4000, baseSalary_Janitor: 2800,
            laborRatePerHour: 42,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 24, publicHolidays: 10, sickAverage: 8 },
            // DE labor add-ons (2024-2026 statutory/screening): employer ~21% (RV 9.3 + KV ~8.1 + AV 1.3 + PV ~1.8); night 25% tax-free custom (EStG s3b cap) — common practice 25%
            socialSecurityRate: 0.21, benefitsOverheadRate: 0.28, nightShiftPremiumRate: 0.25, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['VDE', 'TÜV', 'EnEfG'], annualComplianceCost: 16000, environmentalPermitCostPerYear: 6000 },
        environment: { baselineAQI: 20, gridCarbonIntensity: 0.35 },
        risk: { downtimeCostPerMin: 5000 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: [],
            taxHolidayYears: 0,
            taxHolidayRate: 0.2975,
            incentivePrograms: ['R&D Tax Allowance (Forschungszulage)', 'EnEfG Compliance Credits', 'Investment Grants (GRW)'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.2975,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 12,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.01,
        },
        gridReliability: {
            gridUptime: 99.998,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 2,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 70,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 40,
            hyperscalerPresence: 6,
            avgHiringDays: 35,
            salaryPremium: 1.0,
            talentScore: 80,
            certifiedProfessionals: 2800,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.80,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 3.00,
            fuelTaxRate: 0.15,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    NL: {
        id: 'NL', region: 'EMEA', name: 'Netherlands', currency: 'EUR', currencySymbol: '€',
        // 2026: Dutch electricity C&I ~€0.18-0.22/kWh; AMS land moratorium easing slightly
        economy: { inflationRate: 0.023, laborEscalation: 0.03, taxRate: 0.2575, electricityRate: 0.20 },
        constructionIndex: 1.1, // NL rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2200, baseSalary_ShiftLead: 7500, baseSalary_Engineer: 6000,
            baseSalary_Technician: 4500, baseSalary_Admin: 3500, baseSalary_Janitor: 2500,
            laborRatePerHour: 38,
            overtimeRules: { workday: { firstHour: 1.3, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 8, sickAverage: 5 },
            // NL labor add-ons (2024-2026 statutory/screening): employer ~18% (AOF/WW/WIA ~12% + ZVW 6.5%); night via CLA ~10-40% -> screening 15%
            socialSecurityRate: 0.18, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.15, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['NEN Standards', 'BREEAM-NL'], annualComplianceCost: 13000, environmentalPermitCostPerYear: 6000 },
        environment: { baselineAQI: 20, gridCarbonIntensity: 0.33 },
        risk: { downtimeCostPerMin: 4500 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Amsterdam Schiphol Logistics Park'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.2575,
            incentivePrograms: ['Innovation Box (9% rate)', 'WBSO R&D Tax Credit', 'EIA Energy Investment Allowance'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.2575,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 15,
            insuranceMultiplier: 1.1,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.998,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 2,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 60,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 12,
            hyperscalerPresence: 8,
            avgHiringDays: 30,
            salaryPremium: 1.05,
            talentScore: 85,
            certifiedProfessionals: 2200,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.75,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.90,
            fuelTaxRate: 0.15,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    IE: {
        id: 'IE', region: 'EMEA', name: 'Ireland', currency: 'EUR', currencySymbol: '€',
        // 2026: Ireland electricity among highest in EU; large DC density straining grid; corporate tax 15% (pillar-2 compliant)
        economy: { inflationRate: 0.024, laborEscalation: 0.04, taxRate: 0.15, electricityRate: 0.24 },
        constructionIndex: 1.1, // IE rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2400, baseSalary_ShiftLead: 7800, baseSalary_Engineer: 6500,
            baseSalary_Technician: 4800, baseSalary_Admin: 3800, baseSalary_Janitor: 2800,
            laborRatePerHour: 36,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 20, publicHolidays: 9, sickAverage: 5 },
            // IE labor add-ons (2024-2026 statutory/screening): employer PRSI 11.15% (Class A, from Oct 2024); no statutory night premium — screening 10%
            socialSecurityRate: 0.1115, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['IS EN Standards', 'SEAI BER'], annualComplianceCost: 14000, environmentalPermitCostPerYear: 6000 },
        environment: { baselineAQI: 15, gridCarbonIntensity: 0.3 },
        risk: { downtimeCostPerMin: 4500 },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Shannon Free Zone', 'IDA Technology Parks'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.125,
            incentivePrograms: ['12.5% Corporate Rate', 'IDA Ireland Grants', 'R&D Tax Credit 25%', 'Knowledge Development Box 6.25%'],
            importDutyExemption: false,
            landSubsidy: true,
            effectiveTaxRate: 0.125,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 8,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.97,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 5,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 65,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 8,
            hyperscalerPresence: 8,
            avgHiringDays: 40,
            salaryPremium: 1.15,
            talentScore: 70,
            certifiedProfessionals: 1200,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.65,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.70,
            fuelTaxRate: 0.12,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    FR: {
        id: 'FR', region: 'EMEA', name: 'France', currency: 'EUR', currencySymbol: '€',
        // 2026: EDF tariff bouclier ended 2024; regulated industrial tariff ~€0.14-0.17/kWh post-normalisation
        economy: { inflationRate: 0.025, laborEscalation: 0.03, taxRate: 0.25, electricityRate: 0.15 },
        constructionIndex: 1.05, // FR rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2100, baseSalary_ShiftLead: 7000, baseSalary_Engineer: 5500,
            baseSalary_Technician: 4000, baseSalary_Admin: 3200, baseSalary_Janitor: 2300,
            laborRatePerHour: 35,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 25, publicHolidays: 11, sickAverage: 6 },
            // FR labor add-ons (2024-2026 statutory/screening): employer charges sociales ~30-45% band (URSSAF, reductions at low wage) -> mid 38%; night premium branch-CLA typical 10%
            socialSecurityRate: 0.38, benefitsOverheadRate: 0.35, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['NF C 15-100', 'AFNOR'], annualComplianceCost: 15000, environmentalPermitCostPerYear: 6000 },
        environment: { baselineAQI: 25, gridCarbonIntensity: 0.06 },
        risk: { downtimeCostPerMin: 4000 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: [],
            taxHolidayYears: 0,
            taxHolidayRate: 0.25,
            incentivePrograms: ['CIR R&D Tax Credit 30%', 'France 2030 Digital Infrastructure', 'Reduced Energy Tax for DCs'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.25,
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 12,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.01,
        },
        gridReliability: {
            gridUptime: 99.99,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 3,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 55,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 25,
            hyperscalerPresence: 5,
            avgHiringDays: 40,
            salaryPremium: 1.05,
            talentScore: 68,
            certifiedProfessionals: 1800,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.75,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.90,
            fuelTaxRate: 0.15,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 60000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    SE: {
        id: 'SE', region: 'EMEA', name: 'Sweden', currency: 'SEK', currencySymbol: 'kr',
        economy: { inflationRate: 0.02, laborEscalation: 0.025, taxRate: 0.206, electricityRate: 0.08 },
        constructionIndex: 1.1, // SE rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 2500, baseSalary_ShiftLead: 7200, baseSalary_Engineer: 6000,
            baseSalary_Technician: 4500, baseSalary_Admin: 3500, baseSalary_Janitor: 2800,
            laborRatePerHour: 36,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 13, sickAverage: 5 },
            // SE labor add-ons (2024-2026 statutory/screening): arbetsgivaravgifter 31.42% (Skatteverket); OB-tillagg night via CLA -> blended screening 20%
            socialSecurityRate: 0.3142, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.2, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['SS Standards', 'Energimyndigheten'], annualComplianceCost: 12000, environmentalPermitCostPerYear: 6000 },
        environment: { baselineAQI: 10, gridCarbonIntensity: 0.04 },
        risk: { downtimeCostPerMin: 4000 },
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Lulea Data Center Hub'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.206,
            incentivePrograms: ['Reduced Energy Tax for DCs', 'Vinnova Innovation Grants', 'Northern Sweden Regional Aid'],
            importDutyExemption: false,
            landSubsidy: true,
            effectiveTaxRate: 0.206,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 5,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.999,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 1,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 95,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 10,
            hyperscalerPresence: 3,
            avgHiringDays: 45,
            salaryPremium: 1.1,
            talentScore: 62,
            certifiedProfessionals: 600,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.85,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.80,
            fuelTaxRate: 0.18,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },
    PL: {
        id: 'PL', region: 'EMEA', name: 'Poland', currency: 'PLN', currencySymbol: 'zł',
        economy: { inflationRate: 0.04, laborEscalation: 0.05, taxRate: 0.19, electricityRate: 0.12 },
        constructionIndex: 0.75, // PL rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 1000, baseSalary_ShiftLead: 3500, baseSalary_Engineer: 2800,
            baseSalary_Technician: 2000, baseSalary_Admin: 1500, baseSalary_Janitor: 1000,
            laborRatePerHour: 15,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 20, publicHolidays: 13, sickAverage: 6 },
            // PL labor add-ons (2024-2026 statutory/screening): employer ZUS ~20.5% (emerytalne 9.76 + rentowe 6.5 + wypadkowe ~1.7 + FP 2.45 + FGSP 0.1); night statutory 20% of MIN-WAGE hourly -> ~10% on tech base
            socialSecurityRate: 0.21, benefitsOverheadRate: 0.22, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['PN-EN Standards', 'URE License'], annualComplianceCost: 7000, environmentalPermitCostPerYear: 4500 },
        environment: { baselineAQI: 40, gridCarbonIntensity: 0.65 },
        risk: { downtimeCostPerMin: 2000 },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Polish SEZ (14 zones)', 'Lodz SEZ', 'Katowice SEZ'],
            taxHolidayYears: 15,
            taxHolidayRate: 0.0,
            incentivePrograms: ['SEZ Tax Exemption', 'Polish Investment Zone', 'EU Structural Funds Co-financing'],
            importDutyExemption: false,
            landSubsidy: true,
            effectiveTaxRate: 0.0,
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 10,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.95,
            voltageStability: 'stable',
            brownoutFrequency: 2,
            averageOutageDuration: 10,
            gridTier: 1,
            backupFuelPremium: 0.02,
            recommendedGenHours: 48,
            renewableReadiness: 55,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 20,
            hyperscalerPresence: 4,
            avgHiringDays: 35,
            salaryPremium: 1.05,
            talentScore: 65,
            certifiedProfessionals: 800,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.45,
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.10,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },

    PT: {
        id: 'PT', region: 'EMEA', name: 'Portugal', currency: 'EUR', currencySymbol: '€',
        economy: { inflationRate: 0.023, laborEscalation: 0.035, taxRate: 0.20, electricityRate: 0.15 },
        constructionIndex: 0.85, // PT rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            minimumWage: 920, baseSalary_ShiftLead: 3800, baseSalary_Engineer: 2900,
            baseSalary_Technician: 2200, baseSalary_Admin: 1600, baseSalary_Janitor: 1050,
            laborRatePerHour: 18,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.16, leaves: { annual: 22, publicHolidays: 13, sickAverage: 5 },
            // PT labor add-ons (2024-2026 statutory/screening): TSU employer 23.75% (Seg. Social); night statutory +25% 22:00-07:00 (Codigo do Trabalho Art.266)
            socialSecurityRate: 0.2375, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.25, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['ITED', 'ITUR', 'RGSPIE', 'DL 95/91'], annualComplianceCost: 14000, environmentalPermitCostPerYear: 5000 },
        environment: { baselineAQI: 20, gridCarbonIntensity: 0.08 },
        risk: { downtimeCostPerMin: 3500 },
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Madeira Free Trade Zone', 'Sines Industrial Zone'],
            taxHolidayYears: 10,
            taxHolidayRate: 0.05,
            incentivePrograms: ['Portugal 2030 Program', 'SIFIDE R&D Tax Credit', 'Golden Visa Investment'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.05,
        },
        naturalDisaster: {
            seismicZone: 2,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 25,
            insuranceMultiplier: 1.15,
            structuralReinforcement: 0.03,
        },
        gridReliability: {
            gridUptime: 99.97,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 8,
            gridTier: 1,
            backupFuelPremium: 0.02,
            recommendedGenHours: 48,
            renewableReadiness: 68,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 15,
            hyperscalerPresence: 3,
            avgHiringDays: 40,
            salaryPremium: 1.0,
            talentScore: 55,
            certifiedProfessionals: 500,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.59,
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.10,
            fuelTaxRate: 0.12,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q1',
    },

    OM: {
        id: 'OM', region: 'MENA', name: 'Oman', currency: 'OMR', currencySymbol: 'ر.ع.',
        // 2026: Oman CIT 15% standard; Duqm SEZ / Salalah / Sohar free zones offer long holidays
        // Electricity: ~$0.07/kWh industrial (subsidized CRT tariff) // screening est. 2026
        economy: { inflationRate: 0.015, laborEscalation: 0.03, taxRate: 0.15, electricityRate: 0.07 }, // screening est. 2026
        constructionIndex: 0.8, // OM rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents (OMR pegged 1 OMR = $2.60) // screening est. 2026
            minimumWage: 850, baseSalary_ShiftLead: 4200, baseSalary_Engineer: 3400,
            baseSalary_Technician: 2000, baseSalary_Admin: 1600, baseSalary_Janitor: 900,
            laborRatePerHour: 20, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 } },
            shrinkageFactor: 0.12, leaves: { annual: 30, publicHolidays: 9, sickAverage: 5 },
            // OM labor add-ons (2024-2026 statutory/screening): Social Protection Fund ~12.5% Omanis only; expat-dominated -> blended ~6% (screening); no statutory night premium — screening 10%
            socialSecurityRate: 0.06, benefitsOverheadRate: 0.28, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['Oman Civil Defence', 'MTCIT License', 'OPWP Grid Code'], annualComplianceCost: 10000, environmentalPermitCostPerYear: 2500 }, // screening est. 2026
        environment: { baselineAQI: 90, gridCarbonIntensity: 0.48 }, // gas-dominated grid // screening est. 2026
        risk: { downtimeCostPerMin: 2000 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 2,
            customsLeadBand: 'normal',
        },
        taxIncentives: {
            freeTradeZones: ['Duqm SEZ', 'Salalah Free Zone', 'Sohar Free Zone'],
            taxHolidayYears: 30, // Duqm SEZ up to 30yr // screening est. 2026
            taxHolidayRate: 0.0,
            incentivePrograms: ['Duqm SEZ 30yr tax holiday', 'Salalah FZ 0% CIT', 'Vision 2040 digital infrastructure'],
            importDutyExemption: true,
            landSubsidy: true,
            effectiveTaxRate: 0.0, // free zone effective rate // screening est. 2026
            programs: [
                { name: 'Duqm SEZ (SEZAD)', cite: 'Royal Decree 119/2011', benefit: 'Up to 30-yr income-tax exemption + 0% customs + 100% foreign ownership', eligibility: 'Entities operating in the Duqm zone' },
                { name: 'Free zones (Salalah/Sohar)', cite: 'Free Zones Law — Royal Decree 56/2002', benefit: '10–25 yr tax exemptions + duty-free + low Omanisation floors' },
                { name: 'Standard CIT baseline', cite: 'Income Tax Law — RD 28/2009 (as amended RD 9/2017)', benefit: '15% standard CIT outside zones (reference rate)' },
            ],
        },
        naturalDisaster: {
            seismicZone: 1, // low seismic
            floodRisk: 'low',
            typhoonRisk: 'low', // occasional cyclones (Salalah coast)
            volcanoRisk: 'none',
            tsunamiRisk: 'low',
            compositeScore: 12,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.95,
            voltageStability: 'stable',
            brownoutFrequency: 2,
            averageOutageDuration: 10,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 48,
            renewableReadiness: 40,
        },
        talentPool: {
            dcEngineerPool: 'scarce',
            universityPipeline: 4,
            hyperscalerPresence: 1,
            avgHiringDays: 45,
            salaryPremium: 1.1,
            talentScore: 45,
            certifiedProfessionals: 150,
        },
        fuelDiesel: {
            dieselPricePerLiter: 0.60, // subsidized // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: false,
            hvoPricePerLiter: 0,
            fuelTaxRate: 0.0,
            deliveryLeadDays: 1,
            environmentalPermitRequired: false,
            storageLimitLiters: 100000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    FI: {
        id: 'FI', region: 'EMEA', name: 'Finland', currency: 'EUR', currencySymbol: '€',
        // 2026: Finland CIT 20%; Hamina/Helsinki DC market; cool climate = strong free cooling
        // Electricity: ~$0.09/kWh industrial; grid ~0.08 kgCO2/kWh (nuclear+hydro+wind) // screening est. 2026
        economy: { inflationRate: 0.018, laborEscalation: 0.025, taxRate: 0.20, electricityRate: 0.09 }, // screening est. 2026
        constructionIndex: 1.05, // FI rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents; no statutory minimum wage — collective agreements // screening est. 2026
            minimumWage: 2400, baseSalary_ShiftLead: 7000, baseSalary_Engineer: 5800,
            baseSalary_Technician: 4300, baseSalary_Admin: 3400, baseSalary_Janitor: 2700,
            laborRatePerHour: 35, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 13, sickAverage: 5 },
            // FI labor add-ons (2024-2026 statutory/screening): employer ~20% (TyEL avg 17.4 + health 1.3 + unemployment ~0.6); night via CLA ~15% (screening)
            socialSecurityRate: 0.2, benefitsOverheadRate: 0.28, nightShiftPremiumRate: 0.15, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['SFS Standards', 'Tukes', 'Energiavirasto'], annualComplianceCost: 12000, environmentalPermitCostPerYear: 6000 }, // screening est. 2026
        environment: { baselineAQI: 8, gridCarbonIntensity: 0.08 }, // screening est. 2026
        risk: { downtimeCostPerMin: 4000 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Hamina DC Hub'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.20,
            incentivePrograms: ['Reduced electricity tax class II for DCs', 'Business Finland RDI grants', 'District-heat reuse credits'],
            importDutyExemption: false,
            landSubsidy: true,
            effectiveTaxRate: 0.20, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 4,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.999,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 2,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 90,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 9,
            hyperscalerPresence: 3, // Google Hamina, Microsoft Espoo/Kirkkonummi
            avgHiringDays: 45,
            salaryPremium: 1.1,
            talentScore: 60,
            certifiedProfessionals: 500,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.90, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true, // Neste HVO home market
            hvoPricePerLiter: 2.60,
            fuelTaxRate: 0.20,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    ES: {
        id: 'ES', region: 'EMEA', name: 'Spain', currency: 'EUR', currencySymbol: '€',
        // 2026: Spain CIT 25%; Madrid/Barcelona/Aragón hyperscale boom (AWS, Microsoft, Meta)
        // Electricity: ~$0.13/kWh industrial // screening est. 2026
        economy: { inflationRate: 0.025, laborEscalation: 0.035, taxRate: 0.25, electricityRate: 0.13 }, // screening est. 2026
        constructionIndex: 0.9, // ES rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents // screening est. 2026
            minimumWage: 1250, baseSalary_ShiftLead: 4200, baseSalary_Engineer: 3300,
            baseSalary_Technician: 2500, baseSalary_Admin: 1900, baseSalary_Janitor: 1300,
            laborRatePerHour: 20, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.14, leaves: { annual: 22, publicHolidays: 14, sickAverage: 5 },
            // ES labor add-ons (2024-2026 statutory/screening): employer Seg. Social ~30% (common contingencies 23.6 + unemp 5.5 + FOGASA/MEI); night premium CBA-common ~25% (ET Art.36 mandates plus, amount by CBA)
            socialSecurityRate: 0.3, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.25, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['UNE Standards', 'REBT', 'CNMC Grid Access'], annualComplianceCost: 12000, environmentalPermitCostPerYear: 5500 }, // screening est. 2026
        environment: { baselineAQI: 25, gridCarbonIntensity: 0.15 }, // screening est. 2026
        risk: { downtimeCostPerMin: 3500 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Zona Franca Barcelona', 'Aragón DC corridor', 'Canary Islands ZEC'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.25,
            incentivePrograms: ['Aragón hyperscale land+grid incentives', 'PERTE digitalization funds', 'Canary ZEC 4% CIT'],
            importDutyExemption: false,
            landSubsidy: true,
            effectiveTaxRate: 0.25, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 12,
            insuranceMultiplier: 1.05,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.96,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 8,
            gridTier: 1,
            backupFuelPremium: 0.02,
            recommendedGenHours: 48,
            renewableReadiness: 70,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 18,
            hyperscalerPresence: 5, // AWS Aragón, Microsoft Madrid, Meta Talavera
            avgHiringDays: 38,
            salaryPremium: 1.05,
            talentScore: 62,
            certifiedProfessionals: 700,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.55, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.05,
            fuelTaxRate: 0.12,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    // ─── AMER (addl) ────────────────────────────────────────
    CA: {
        id: 'CA', region: 'AMER', name: 'Canada', currency: 'CAD', currencySymbol: 'C$',
        // 2026: combined federal+provincial CIT ~26.5% (ON); Toronto/Montreal hubs
        // Electricity: ~$0.08/kWh industrial; grid ~0.13 kgCO2/kWh national (Québec hydro ~0.03) // screening est. 2026
        economy: { inflationRate: 0.02, laborEscalation: 0.03, taxRate: 0.265, electricityRate: 0.08 }, // screening est. 2026
        constructionIndex: 1.0, // CA rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents // screening est. 2026
            minimumWage: 2300, baseSalary_ShiftLead: 6500, baseSalary_Engineer: 5400,
            baseSalary_Technician: 4000, baseSalary_Admin: 3200, baseSalary_Janitor: 2500,
            laborRatePerHour: 32, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 15, publicHolidays: 11, sickAverage: 5 },
            // CA labor add-ons (2024-2026 statutory/screening): CPP 5.95% (+CPP2) + EI 2.28% + workers comp ~1.5% + prov. payroll tax ~2% -> ~12% (screening); no statutory night premium — screening 8%
            socialSecurityRate: 0.12, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.08, workingHoursPerMonth: 153,
        },
        compliance: { certifications: ['CSA Standards', 'ESA/RBQ Electrical', 'Provincial Permits'], annualComplianceCost: 13000, environmentalPermitCostPerYear: 7000 }, // screening est. 2026
        environment: { baselineAQI: 15, gridCarbonIntensity: 0.13 }, // Québec hydro ~0.03 // screening est. 2026
        risk: { downtimeCostPerMin: 4500 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Montréal hydro corridor', 'Alberta DC zone'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.265,
            incentivePrograms: ['Hydro-Québec industrial rate', 'SR&ED tax credits', 'Provincial DC incentives (QC/AB)'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.265, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 1,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 8,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.97,
            voltageStability: 'stable',
            brownoutFrequency: 1,
            averageOutageDuration: 15, // winter-storm driven
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 48,
            renewableReadiness: 82,
        },
        talentPool: {
            dcEngineerPool: 'abundant',
            universityPipeline: 25,
            hyperscalerPresence: 6,
            avgHiringDays: 35,
            salaryPremium: 1.1,
            talentScore: 72,
            certifiedProfessionals: 1200,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.20, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 1.80,
            fuelTaxRate: 0.10,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 100000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    IT: {
        id: 'IT', region: 'EMEA', name: 'Italy', currency: 'EUR', currencySymbol: '€',
        // 2026: IRES 24% + IRAP ~3.9% ≈ 27.9% combined; Milan is the FLAP-D+ hub
        // Electricity: ~$0.18/kWh industrial (among highest in EU) // screening est. 2026
        economy: { inflationRate: 0.02, laborEscalation: 0.03, taxRate: 0.279, electricityRate: 0.18 }, // screening est. 2026
        constructionIndex: 0.95, // IT rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents; no statutory minimum wage — CCNL sector agreements // screening est. 2026
            minimumWage: 1250, baseSalary_ShiftLead: 4500, baseSalary_Engineer: 3600,
            baseSalary_Technician: 2700, baseSalary_Admin: 2100, baseSalary_Janitor: 1400,
            laborRatePerHour: 22, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 22, publicHolidays: 12, sickAverage: 6 },
            // IT labor add-ons (2024-2026 statutory/screening): INPS employer ~30%; night via CCNL ~15-30% -> screening 20%
            socialSecurityRate: 0.3, benefitsOverheadRate: 0.35, nightShiftPremiumRate: 0.2, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['CEI Standards', 'VVF Fire Cert', 'ARERA Grid Access'], annualComplianceCost: 14000, environmentalPermitCostPerYear: 5500 }, // screening est. 2026
        environment: { baselineAQI: 35, gridCarbonIntensity: 0.25 }, // Po valley air // screening est. 2026
        risk: { downtimeCostPerMin: 3500 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.05,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Trieste Free Port', 'ZES Unica (South)'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.279,
            incentivePrograms: ['Transizione 5.0 credits', 'ZES Unica South incentives', 'Industria 4.0 hyper-depreciation'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.279, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 2, // moderate seismic (Milan hub itself lower)
            floodRisk: 'moderate',
            typhoonRisk: 'none',
            volcanoRisk: 'low',
            tsunamiRisk: 'none',
            compositeScore: 25,
            insuranceMultiplier: 1.15,
            structuralReinforcement: 0.03,
        },
        gridReliability: {
            gridUptime: 99.95,
            voltageStability: 'stable',
            brownoutFrequency: 2,
            averageOutageDuration: 10,
            gridTier: 1,
            backupFuelPremium: 0.02,
            recommendedGenHours: 48,
            renewableReadiness: 55,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 20,
            hyperscalerPresence: 4,
            avgHiringDays: 40,
            salaryPremium: 1.05,
            talentScore: 58,
            certifiedProfessionals: 600,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.75, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true, // Eni HVO
            hvoPricePerLiter: 2.20,
            fuelTaxRate: 0.15,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    NO: {
        id: 'NO', region: 'EMEA', name: 'Norway', currency: 'NOK', currencySymbol: 'kr',
        // 2026: Norway CIT 22%; ~98% hydro grid — lowest carbon in the set; cool climate free cooling
        // Electricity: ~$0.07/kWh industrial; grid ~0.03 kgCO2/kWh // screening est. 2026
        economy: { inflationRate: 0.02, laborEscalation: 0.03, taxRate: 0.22, electricityRate: 0.07 }, // screening est. 2026
        constructionIndex: 1.2, // NO rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents; sector collective agreements set floors // screening est. 2026
            minimumWage: 2800, baseSalary_ShiftLead: 7500, baseSalary_Engineer: 6300,
            baseSalary_Technician: 4700, baseSalary_Admin: 3700, baseSalary_Janitor: 3000,
            laborRatePerHour: 38, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.4, subsequent: 1.4 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 12, sickAverage: 5 },
            // NO labor add-ons (2024-2026 statutory/screening): arbeidsgiveravgift 14.1% + OTP pension min 2%; night/shift supplements via CLA ~20% (screening)
            socialSecurityRate: 0.16, benefitsOverheadRate: 0.3, nightShiftPremiumRate: 0.2, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['NEK Standards', 'DSB', 'NVE Grid License'], annualComplianceCost: 12000, environmentalPermitCostPerYear: 6500 }, // screening est. 2026
        environment: { baselineAQI: 8, gridCarbonIntensity: 0.03 }, // hydro // screening est. 2026
        risk: { downtimeCostPerMin: 4000 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Norwegian DC power regions (Rjukan, Stavanger)'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.22,
            incentivePrograms: ['Reduced el-tax for DCs', 'Enova energy-efficiency grants', 'Statkraft green PPAs'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.22, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 5,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.999,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 2,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 98,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 8,
            hyperscalerPresence: 2,
            avgHiringDays: 50,
            salaryPremium: 1.15,
            talentScore: 55,
            certifiedProfessionals: 350,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.95, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.70,
            fuelTaxRate: 0.20,
            deliveryLeadDays: 2,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    DK: {
        id: 'DK', region: 'EMEA', name: 'Denmark', currency: 'DKK', currencySymbol: 'kr',
        // 2026: Denmark CIT 22%; Copenhagen/Odense hyperscale market (Meta, Google, Apple)
        // Electricity: ~$0.12/kWh industrial; grid ~0.12 kgCO2/kWh (wind-heavy) // screening est. 2026
        economy: { inflationRate: 0.018, laborEscalation: 0.025, taxRate: 0.22, electricityRate: 0.12 }, // screening est. 2026
        constructionIndex: 1.15, // DK rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents; collective agreements set floors // screening est. 2026
            minimumWage: 2700, baseSalary_ShiftLead: 7300, baseSalary_Engineer: 6100,
            baseSalary_Technician: 4600, baseSalary_Admin: 3600, baseSalary_Janitor: 2900,
            laborRatePerHour: 37, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 11, sickAverage: 5 },
            // DK labor add-ons (2024-2026 statutory/screening): statutory low ~2-3% (ATP + AUB flat DKK); pension via CLA sits in benefits; night via CLA ~20% (screening)
            socialSecurityRate: 0.03, benefitsOverheadRate: 0.35, nightShiftPremiumRate: 0.2, workingHoursPerMonth: 150,
        },
        compliance: { certifications: ['DS Standards', 'Sikkerhedsstyrelsen', 'Energinet Grid Code'], annualComplianceCost: 12000, environmentalPermitCostPerYear: 6000 }, // screening est. 2026
        environment: { baselineAQI: 10, gridCarbonIntensity: 0.12 }, // wind-heavy // screening est. 2026
        risk: { downtimeCostPerMin: 4000 }, // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Copenhagen/Odense DC corridor'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.22,
            incentivePrograms: ['Reduced electricity tax for DCs', 'Danish green power PPAs', 'District-heat reuse credits'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.22, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 0,
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 4,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.998, // SAIDI ~12 min/yr — among Europe's best
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 2,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 90,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 8,
            hyperscalerPresence: 4, // Meta Odense, Google Fredericia, Apple Viborg
            avgHiringDays: 42,
            salaryPremium: 1.1,
            talentScore: 60,
            certifiedProfessionals: 450,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.85, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.60,
            fuelTaxRate: 0.18,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 50000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },

    CH: {
        id: 'CH', region: 'EMEA', name: 'Switzerland', currency: 'CHF', currencySymbol: 'CHF',
        // 2026: combined effective CIT ~14.9% (federal+cantonal avg); Zurich colocation hub
        // Electricity: ~$0.14/kWh industrial; grid ~0.04 kgCO2/kWh (hydro+nuclear) // screening est. 2026
        economy: { inflationRate: 0.01, laborEscalation: 0.02, taxRate: 0.149, electricityRate: 0.14 }, // screening est. 2026
        constructionIndex: 1.3, // CH rel. US=1.0 — Turner&Townsend ICMS/RLB 2024-25 construction cost screening
        labor: {
            // USD/month equivalents — highest salaries in the set // screening est. 2026
            minimumWage: 4000, baseSalary_ShiftLead: 9500, baseSalary_Engineer: 8200,
            baseSalary_Technician: 6200, baseSalary_Admin: 5000, baseSalary_Janitor: 4000,
            laborRatePerHour: 55, // screening est. 2026
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.25 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 } },
            shrinkageFactor: 0.08, leaves: { annual: 20, publicHolidays: 9, sickAverage: 4 },
            // CH labor add-ons (2024-2026 statutory/screening): AHV/IV/EO 5.3% + ALV 1.1% + BVG ~4-6% + UVG/FAK ~2% -> ~13%; regular night work statutory +10% time compensation (ArG Art.17b)
            socialSecurityRate: 0.13, benefitsOverheadRate: 0.25, nightShiftPremiumRate: 0.1, workingHoursPerMonth: 151,
        },
        compliance: { certifications: ['SEV/Electrosuisse', 'ESTI', 'Cantonal Fire Police'], annualComplianceCost: 16000, environmentalPermitCostPerYear: 7500 }, // screening est. 2026
        environment: { baselineAQI: 10, gridCarbonIntensity: 0.04 }, // hydro+nuclear // screening est. 2026
        risk: { downtimeCostPerMin: 5000 }, // finance-sector density // screening est. 2026
        supplyChain: {
            importDifficultyFactor: 1.0,
            importDutyBand: 'low',
            gpuExportTier: 1,
            customsLeadBand: 'fast',
        },
        taxIncentives: {
            freeTradeZones: ['Zug/Lucerne cantonal low-tax'],
            taxHolidayYears: 0,
            taxHolidayRate: 0.149,
            incentivePrograms: ['Cantonal tax rulings', 'Patent box regime', 'Grid-adjacent heat-reuse credits'],
            importDutyExemption: false,
            landSubsidy: false,
            effectiveTaxRate: 0.149, // screening est. 2026
        },
        naturalDisaster: {
            seismicZone: 1, // very low overall risk
            floodRisk: 'low',
            typhoonRisk: 'none',
            volcanoRisk: 'none',
            tsunamiRisk: 'none',
            compositeScore: 6,
            insuranceMultiplier: 1.0,
            structuralReinforcement: 0.0,
        },
        gridReliability: {
            gridUptime: 99.998,
            voltageStability: 'stable',
            brownoutFrequency: 0,
            averageOutageDuration: 2,
            gridTier: 1,
            backupFuelPremium: 0.0,
            recommendedGenHours: 24,
            renewableReadiness: 75,
        },
        talentPool: {
            dcEngineerPool: 'moderate',
            universityPipeline: 12,
            hyperscalerPresence: 4,
            avgHiringDays: 40,
            salaryPremium: 1.25,
            talentScore: 68,
            certifiedProfessionals: 500,
        },
        fuelDiesel: {
            dieselPricePerLiter: 1.95, // screening est. 2026
            dieselAvailability: 'abundant',
            hvoAvailable: true,
            hvoPricePerLiter: 2.75,
            fuelTaxRate: 0.20,
            deliveryLeadDays: 1,
            environmentalPermitRequired: true,
            storageLimitLiters: 40000,
            fuelQualityRating: 'high',
        },
        lastUpdated: '2026-Q3',
    },
};

/* ─── v2.5.0 site research augmentation (Pillar 2) ────────────────────────────
 * Per-country site factors for the major DC markets, from published frameworks:
 * WRI Aqueduct 4.0 baseline water stress (0-5), ASHRAE 169-2021 climate zone,
 * IEEE 1366 SAIDI (min/customer/yr), USGS PGA %g (2% in 50yr). Applied to
 * COUNTRIES so the engine's models.site.deriveFactors uses real values (water
 * was previously hardcoded). Countries not listed keep the neutral fallback.
 * ──────────────────────────────────────────────────────────────────────────── */
const SITE_AUGMENT: Record<string, { aqueductStressScore: number; ashraeClimateZone: string; saidiMinYr: number; pgaPct2in50yr: number }> = {
    US: { aqueductStressScore: 3, ashraeClimateZone: '4A', saidiMinYr: 90, pgaPct2in50yr: 15 },
    SG: { aqueductStressScore: 4, ashraeClimateZone: '1A', saidiMinYr: 15, pgaPct2in50yr: 2 },
    ID: { aqueductStressScore: 3, ashraeClimateZone: '1A', saidiMinYr: 300, pgaPct2in50yr: 60 },
    MY: { aqueductStressScore: 2, ashraeClimateZone: '1A', saidiMinYr: 50, pgaPct2in50yr: 5 },
    JP: { aqueductStressScore: 2, ashraeClimateZone: '3A', saidiMinYr: 20, pgaPct2in50yr: 80 },
    IN: { aqueductStressScore: 4, ashraeClimateZone: '2A', saidiMinYr: 600, pgaPct2in50yr: 30 },
    CN: { aqueductStressScore: 4, ashraeClimateZone: '3A', saidiMinYr: 100, pgaPct2in50yr: 30 },
    KR: { aqueductStressScore: 3, ashraeClimateZone: '4A', saidiMinYr: 15, pgaPct2in50yr: 25 },
    DE: { aqueductStressScore: 3, ashraeClimateZone: '4A', saidiMinYr: 12, pgaPct2in50yr: 5 },
    GB: { aqueductStressScore: 2, ashraeClimateZone: '4C', saidiMinYr: 40, pgaPct2in50yr: 3 },
    NL: { aqueductStressScore: 3, ashraeClimateZone: '4A', saidiMinYr: 20, pgaPct2in50yr: 3 },
    FR: { aqueductStressScore: 3, ashraeClimateZone: '4A', saidiMinYr: 50, pgaPct2in50yr: 8 },
    IE: { aqueductStressScore: 1, ashraeClimateZone: '5C', saidiMinYr: 60, pgaPct2in50yr: 3 },
    SE: { aqueductStressScore: 1, ashraeClimateZone: '6A', saidiMinYr: 45, pgaPct2in50yr: 3 },
    AU: { aqueductStressScore: 3, ashraeClimateZone: '3B', saidiMinYr: 100, pgaPct2in50yr: 8 },
    SA: { aqueductStressScore: 5, ashraeClimateZone: '1B', saidiMinYr: 80, pgaPct2in50yr: 5 },
    AE: { aqueductStressScore: 5, ashraeClimateZone: '1B', saidiMinYr: 30, pgaPct2in50yr: 5 },
    QA: { aqueductStressScore: 5, ashraeClimateZone: '1B', saidiMinYr: 25, pgaPct2in50yr: 4 },
    BR: { aqueductStressScore: 2, ashraeClimateZone: '1A', saidiMinYr: 200, pgaPct2in50yr: 5 },
    ZA: { aqueductStressScore: 4, ashraeClimateZone: '3A', saidiMinYr: 500, pgaPct2in50yr: 8 },
    MX: { aqueductStressScore: 4, ashraeClimateZone: '2A', saidiMinYr: 120, pgaPct2in50yr: 40 },
    TW: { aqueductStressScore: 3, ashraeClimateZone: '2A', saidiMinYr: 20, pgaPct2in50yr: 70 },
    TH: { aqueductStressScore: 3, ashraeClimateZone: '1A', saidiMinYr: 100, pgaPct2in50yr: 8 },
    VN: { aqueductStressScore: 3, ashraeClimateZone: '1A', saidiMinYr: 200, pgaPct2in50yr: 10 },
    PH: { aqueductStressScore: 3, ashraeClimateZone: '1A', saidiMinYr: 400, pgaPct2in50yr: 50 },
    CL: { aqueductStressScore: 4, ashraeClimateZone: '3C', saidiMinYr: 200, pgaPct2in50yr: 60 },
    CO: { aqueductStressScore: 2, ashraeClimateZone: '1A', saidiMinYr: 300, pgaPct2in50yr: 40 },
    KE: { aqueductStressScore: 3, ashraeClimateZone: '2A', saidiMinYr: 400, pgaPct2in50yr: 15 },
    NG: { aqueductStressScore: 3, ashraeClimateZone: '1A', saidiMinYr: 800, pgaPct2in50yr: 5 },
    NZ: { aqueductStressScore: 1, ashraeClimateZone: '4C', saidiMinYr: 100, pgaPct2in50yr: 50 },
    PL: { aqueductStressScore: 3, ashraeClimateZone: '5A', saidiMinYr: 150, pgaPct2in50yr: 3 },
    PT: { aqueductStressScore: 3, ashraeClimateZone: '3C', saidiMinYr: 60, pgaPct2in50yr: 20 },
    OM: { aqueductStressScore: 5, ashraeClimateZone: '1B', saidiMinYr: 60, pgaPct2in50yr: 10 },
    FI: { aqueductStressScore: 1, ashraeClimateZone: '6A', saidiMinYr: 30, pgaPct2in50yr: 2 },
    ES: { aqueductStressScore: 4, ashraeClimateZone: '3B', saidiMinYr: 50, pgaPct2in50yr: 6 },
    CA: { aqueductStressScore: 2, ashraeClimateZone: '6A', saidiMinYr: 180, pgaPct2in50yr: 15 },
    IT: { aqueductStressScore: 3, ashraeClimateZone: '4A', saidiMinYr: 45, pgaPct2in50yr: 20 },
    NO: { aqueductStressScore: 1, ashraeClimateZone: '6A', saidiMinYr: 90, pgaPct2in50yr: 5 },
    DK: { aqueductStressScore: 2, ashraeClimateZone: '5A', saidiMinYr: 12, pgaPct2in50yr: 2 },
    CH: { aqueductStressScore: 2, ashraeClimateZone: '5A', saidiMinYr: 15, pgaPct2in50yr: 10 },
};
for (const id of Object.keys(SITE_AUGMENT)) {
    if (COUNTRIES[id]) Object.assign(COUNTRIES[id].environment, SITE_AUGMENT[id]);
}
