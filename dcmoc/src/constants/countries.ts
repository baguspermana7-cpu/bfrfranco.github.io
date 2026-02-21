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

export interface CountryProfile {
    id: string;
    region: 'APAC' | 'EMEA' | 'AMER' | 'MENA' | 'AFR' | 'LATAM';
    name: string;
    currency: string;
    currencySymbol: string;
    economy: {
        inflationRate: number; // General CPI (Parts/Consumables)
        laborEscalation: number; // Annual Wage Growth
    };
    constructionIndex?: number; // Relative to US (1.0) for CAPEX
    labor: {
        minimumWage: number;
        baseSalary_ShiftLead: number;
        baseSalary_Engineer: number;
        baseSalary_Technician: number;
        baseSalary_Admin: number;
        baseSalary_Janitor: number;
        overtimeRules: OvertimeRules;
        shrinkageFactor: number;
        leaves: {
            annual: number;
            publicHolidays: number;
            sickAverage: number;
        };
    };
    compliance: {
        certifications: string[];
        annualComplianceCost: number;
    };
    environment: {
        baselineAQI: number;
        gridCarbonIntensity: number;
    };
    supplyChain: {
        importDifficultyFactor: number;
    };
}

export const COUNTRIES: Record<string, CountryProfile> = {
    ID: {
        id: 'ID',
        region: 'APAC',
        name: 'Indonesia',
        currency: 'USD',
        currencySymbol: '$',
        economy: {
            inflationRate: 0.035, // 3.5%
            laborEscalation: 0.05, // 5% strong wage growth
        },
        labor: {
            minimumWage: 350,
            baseSalary_ShiftLead: 1500,
            baseSalary_Engineer: 1000,
            baseSalary_Technician: 550,
            baseSalary_Admin: 450,
            baseSalary_Janitor: 350,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 2.0 },
                holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 4.0 },
                maxOvertimeHoursPerWeek: 18,
            },
            shrinkageFactor: 0.20,
            leaves: { annual: 12, publicHolidays: 15, sickAverage: 5 },
        },
        compliance: {
            certifications: ['Sertifikat Laik Operasi (SLO)', 'Ahli K3 Listrik', 'AMDAL'],
            annualComplianceCost: 6500,
        },
        environment: {
            baselineAQI: 120,
            gridCarbonIntensity: 0.7,
        },
        supplyChain: {
            importDifficultyFactor: 1.35,
        },
    },
    SG: {
        id: 'SG',
        region: 'APAC',
        name: 'Singapore',
        currency: 'SGD',
        currencySymbol: 'S$',
        economy: {
            inflationRate: 0.025, // 2.5%
            laborEscalation: 0.04, // 4%
        },
        labor: {
            minimumWage: 1400,
            baseSalary_ShiftLead: 5500,
            baseSalary_Engineer: 4500,
            baseSalary_Technician: 3200,
            baseSalary_Admin: 2800,
            baseSalary_Janitor: 1800,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 1.5 },
                holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 },
            },
            shrinkageFactor: 0.12,
            leaves: { annual: 14, publicHolidays: 11, sickAverage: 4 },
        },
        compliance: {
            certifications: ['SS 564', 'BCA Green Mark'],
            annualComplianceCost: 12000,
        },
        environment: {
            baselineAQI: 45,
            gridCarbonIntensity: 0.4,
        },
        supplyChain: { importDifficultyFactor: 1.0 },
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
        },
        labor: {
            minimumWage: 340,
            baseSalary_ShiftLead: 1800,
            baseSalary_Engineer: 1200,
            baseSalary_Technician: 700,
            baseSalary_Admin: 500,
            baseSalary_Janitor: 350,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 1.5 },
                holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 3.0 },
            },
            shrinkageFactor: 0.18,
            leaves: { annual: 12, publicHolidays: 16, sickAverage: 5 },
        },
        compliance: {
            certifications: ['Suruhanjaya Tenaga', 'GBI'],
            annualComplianceCost: 5000,
        },
        environment: {
            baselineAQI: 90,
            gridCarbonIntensity: 0.6,
        },
        supplyChain: { importDifficultyFactor: 1.1 },
    },
    US: {
        id: 'US',
        region: 'AMER',
        name: 'United States',
        currency: 'USD',
        currencySymbol: '$',
        economy: {
            inflationRate: 0.03, // 3%
            laborEscalation: 0.035, // 3.5%
        },
        labor: {
            minimumWage: 2000,
            baseSalary_ShiftLead: 10500,
            baseSalary_Engineer: 8500,
            baseSalary_Technician: 5500,
            baseSalary_Admin: 4000,
            baseSalary_Janitor: 3000,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 1.5 },
                holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 },
            },
            shrinkageFactor: 0.10,
            leaves: { annual: 10, publicHolidays: 10, sickAverage: 3 },
        },
        compliance: {
            certifications: ['OSHA', 'NFPA 70E'],
            annualComplianceCost: 15000,
        },
        environment: {
            baselineAQI: 35,
            gridCarbonIntensity: 0.4,
        },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    JP: {
        id: 'JP',
        region: 'APAC',
        name: 'Japan',
        currency: 'JPY',
        currencySymbol: '¥',
        economy: {
            inflationRate: 0.01, // 1%
            laborEscalation: 0.02, // 2%
        },
        labor: {
            minimumWage: 1200,
            baseSalary_ShiftLead: 4500,
            baseSalary_Engineer: 3500,
            baseSalary_Technician: 2800,
            baseSalary_Admin: 2200,
            baseSalary_Janitor: 1800,
            overtimeRules: {
                workday: { firstHour: 1.25, subsequent: 1.25 },
                holiday: { first8Hours: 1.35, ninthHour: 1.35, tenthHourPlus: 1.35 },
            },
            shrinkageFactor: 0.08,
            leaves: { annual: 10, publicHolidays: 16, sickAverage: 2 },
        },
        compliance: {
            certifications: ['First Class Electrician', 'Energy Manager'],
            annualComplianceCost: 8000,
        },
        environment: {
            baselineAQI: 30,
            gridCarbonIntensity: 0.5,
        },
        supplyChain: { importDifficultyFactor: 1.05 },
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
        },
        labor: {
            minimumWage: 3000,
            baseSalary_ShiftLead: 9500,
            baseSalary_Engineer: 8000,
            baseSalary_Technician: 6000,
            baseSalary_Admin: 5000,
            baseSalary_Janitor: 4000,
            overtimeRules: {
                workday: { firstHour: 1.5, subsequent: 2.0 },
                holiday: { first8Hours: 2.5, ninthHour: 2.5, tenthHourPlus: 2.5 },
            },
            shrinkageFactor: 0.12,
            leaves: { annual: 20, publicHolidays: 10, sickAverage: 5 },
        },
        compliance: {
            certifications: ['WHS', 'Austel'],
            annualComplianceCost: 10000,
        },
        environment: {
            baselineAQI: 20,
            gridCarbonIntensity: 0.6,
        },
        supplyChain: { importDifficultyFactor: 1.2 },
    },
    // ─── MENA ───────────────────────────────────────────────
    AE: {
        id: 'AE', region: 'MENA', name: 'UAE', currency: 'USD', currencySymbol: '$',
        economy: { inflationRate: 0.025, laborEscalation: 0.03 },
        labor: {
            minimumWage: 800, baseSalary_ShiftLead: 5000, baseSalary_Engineer: 4000,
            baseSalary_Technician: 2500, baseSalary_Admin: 2000, baseSalary_Janitor: 1200,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 } },
            shrinkageFactor: 0.10, leaves: { annual: 30, publicHolidays: 10, sickAverage: 5 },
        },
        compliance: { certifications: ['DCDA', 'Estidama', 'Civil Defence'], annualComplianceCost: 15000 },
        environment: { baselineAQI: 100, gridCarbonIntensity: 0.45 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    SA: {
        id: 'SA', region: 'MENA', name: 'Saudi Arabia', currency: 'SAR', currencySymbol: '﷼',
        economy: { inflationRate: 0.02, laborEscalation: 0.035 },
        labor: {
            minimumWage: 1100, baseSalary_ShiftLead: 4500, baseSalary_Engineer: 3800,
            baseSalary_Technician: 2200, baseSalary_Admin: 1800, baseSalary_Janitor: 1000,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 21, publicHolidays: 9, sickAverage: 4 },
        },
        compliance: { certifications: ['Saudi CDC', 'SASO', 'NEOM Standards'], annualComplianceCost: 12000 },
        environment: { baselineAQI: 110, gridCarbonIntensity: 0.55 },
        supplyChain: { importDifficultyFactor: 1.05 },
    },
    QA: {
        id: 'QA', region: 'MENA', name: 'Qatar', currency: 'QAR', currencySymbol: 'QR',
        economy: { inflationRate: 0.02, laborEscalation: 0.03 },
        labor: {
            minimumWage: 1000, baseSalary_ShiftLead: 5200, baseSalary_Engineer: 4200,
            baseSalary_Technician: 2600, baseSalary_Admin: 2100, baseSalary_Janitor: 1300,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 1.5, ninthHour: 1.5, tenthHourPlus: 1.5 } },
            shrinkageFactor: 0.10, leaves: { annual: 21, publicHolidays: 9, sickAverage: 4 },
        },
        compliance: { certifications: ['Kahramaa', 'QCS 2014'], annualComplianceCost: 14000 },
        environment: { baselineAQI: 95, gridCarbonIntensity: 0.48 },
        supplyChain: { importDifficultyFactor: 1.05 },
    },
    // ─── AFRICA ─────────────────────────────────────────────
    ZA: {
        id: 'ZA', region: 'AFR', name: 'South Africa', currency: 'ZAR', currencySymbol: 'R',
        economy: { inflationRate: 0.05, laborEscalation: 0.06 },
        labor: {
            minimumWage: 250, baseSalary_ShiftLead: 2200, baseSalary_Engineer: 1800,
            baseSalary_Technician: 1100, baseSalary_Admin: 800, baseSalary_Janitor: 400,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.22, leaves: { annual: 15, publicHolidays: 12, sickAverage: 6 },
        },
        compliance: { certifications: ['SABS', 'ECSA', 'OHS Act'], annualComplianceCost: 5000 },
        environment: { baselineAQI: 50, gridCarbonIntensity: 0.9 },
        supplyChain: { importDifficultyFactor: 1.3 },
    },
    NG: {
        id: 'NG', region: 'AFR', name: 'Nigeria', currency: 'USD', currencySymbol: '$',
        economy: { inflationRate: 0.14, laborEscalation: 0.08 },
        labor: {
            minimumWage: 80, baseSalary_ShiftLead: 1200, baseSalary_Engineer: 900,
            baseSalary_Technician: 500, baseSalary_Admin: 350, baseSalary_Janitor: 150,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.25, leaves: { annual: 12, publicHolidays: 11, sickAverage: 5 },
        },
        compliance: { certifications: ['NCC', 'SON', 'NESREA'], annualComplianceCost: 3000 },
        environment: { baselineAQI: 140, gridCarbonIntensity: 0.45 },
        supplyChain: { importDifficultyFactor: 1.6 },
    },
    KE: {
        id: 'KE', region: 'AFR', name: 'Kenya', currency: 'KES', currencySymbol: 'KSh',
        economy: { inflationRate: 0.07, laborEscalation: 0.06 },
        labor: {
            minimumWage: 150, baseSalary_ShiftLead: 1400, baseSalary_Engineer: 1000,
            baseSalary_Technician: 600, baseSalary_Admin: 400, baseSalary_Janitor: 200,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.20, leaves: { annual: 21, publicHolidays: 10, sickAverage: 5 },
        },
        compliance: { certifications: ['KEBS', 'ERC License'], annualComplianceCost: 3500 },
        environment: { baselineAQI: 60, gridCarbonIntensity: 0.3 },
        supplyChain: { importDifficultyFactor: 1.5 },
    },
    // ─── LATIN AMERICA ──────────────────────────────────────
    BR: {
        id: 'BR', region: 'LATAM', name: 'Brazil', currency: 'BRL', currencySymbol: 'R$',
        economy: { inflationRate: 0.045, laborEscalation: 0.05 },
        labor: {
            minimumWage: 300, baseSalary_ShiftLead: 2000, baseSalary_Engineer: 1500,
            baseSalary_Technician: 900, baseSalary_Admin: 700, baseSalary_Janitor: 350,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.22, leaves: { annual: 30, publicHolidays: 12, sickAverage: 5 },
        },
        compliance: { certifications: ['INMETRO', 'NR-10', 'ANATEL'], annualComplianceCost: 6000 },
        environment: { baselineAQI: 50, gridCarbonIntensity: 0.15 },
        supplyChain: { importDifficultyFactor: 1.4 },
    },
    CL: {
        id: 'CL', region: 'LATAM', name: 'Chile', currency: 'CLP', currencySymbol: 'CL$',
        economy: { inflationRate: 0.04, laborEscalation: 0.04 },
        labor: {
            minimumWage: 500, baseSalary_ShiftLead: 2300, baseSalary_Engineer: 1800,
            baseSalary_Technician: 1100, baseSalary_Admin: 800, baseSalary_Janitor: 500,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 15, publicHolidays: 15, sickAverage: 4 },
        },
        compliance: { certifications: ['SEC', 'INN Chile'], annualComplianceCost: 5000 },
        environment: { baselineAQI: 40, gridCarbonIntensity: 0.35 },
        supplyChain: { importDifficultyFactor: 1.3 },
    },
    MX: {
        id: 'MX', region: 'LATAM', name: 'Mexico', currency: 'MXN', currencySymbol: 'MX$',
        economy: { inflationRate: 0.04, laborEscalation: 0.05 },
        labor: {
            minimumWage: 350, baseSalary_ShiftLead: 1800, baseSalary_Engineer: 1400,
            baseSalary_Technician: 850, baseSalary_Admin: 600, baseSalary_Janitor: 350,
            overtimeRules: { workday: { firstHour: 2.0, subsequent: 3.0 }, holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.18, leaves: { annual: 12, publicHolidays: 7, sickAverage: 4 },
        },
        compliance: { certifications: ['NOM', 'SENER'], annualComplianceCost: 5000 },
        environment: { baselineAQI: 80, gridCarbonIntensity: 0.45 },
        supplyChain: { importDifficultyFactor: 1.15 },
    },
    CO: {
        id: 'CO', region: 'LATAM', name: 'Colombia', currency: 'COP', currencySymbol: 'CO$',
        economy: { inflationRate: 0.06, laborEscalation: 0.055 },
        labor: {
            minimumWage: 280, baseSalary_ShiftLead: 1600, baseSalary_Engineer: 1200,
            baseSalary_Technician: 700, baseSalary_Admin: 500, baseSalary_Janitor: 300,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.75 }, holiday: { first8Hours: 1.75, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.20, leaves: { annual: 15, publicHolidays: 18, sickAverage: 4 },
        },
        compliance: { certifications: ['RETIE', 'SIC'], annualComplianceCost: 4000 },
        environment: { baselineAQI: 55, gridCarbonIntensity: 0.2 },
        supplyChain: { importDifficultyFactor: 1.35 },
    },
    // ─── EXPANDED APAC ──────────────────────────────────────
    IN: {
        id: 'IN', region: 'APAC', name: 'India', currency: 'INR', currencySymbol: '₹',
        economy: { inflationRate: 0.05, laborEscalation: 0.07 },
        labor: {
            minimumWage: 200, baseSalary_ShiftLead: 1200, baseSalary_Engineer: 900,
            baseSalary_Technician: 500, baseSalary_Admin: 400, baseSalary_Janitor: 200,
            overtimeRules: { workday: { firstHour: 2.0, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.20, leaves: { annual: 12, publicHolidays: 16, sickAverage: 6 },
        },
        compliance: { certifications: ['BIS', 'CEA Regulations', 'LEED India'], annualComplianceCost: 4000 },
        environment: { baselineAQI: 150, gridCarbonIntensity: 0.72 },
        supplyChain: { importDifficultyFactor: 1.2 },
    },
    CN: {
        id: 'CN', region: 'APAC', name: 'China', currency: 'CNY', currencySymbol: '¥',
        economy: { inflationRate: 0.02, laborEscalation: 0.06 },
        labor: {
            minimumWage: 400, baseSalary_ShiftLead: 2000, baseSalary_Engineer: 1500,
            baseSalary_Technician: 900, baseSalary_Admin: 700, baseSalary_Janitor: 450,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 3.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 5, publicHolidays: 11, sickAverage: 3 },
        },
        compliance: { certifications: ['GB Standards', 'MIIT License', 'Green DC Rating'], annualComplianceCost: 8000 },
        environment: { baselineAQI: 130, gridCarbonIntensity: 0.58 },
        supplyChain: { importDifficultyFactor: 1.1 },
    },
    KR: {
        id: 'KR', region: 'APAC', name: 'South Korea', currency: 'KRW', currencySymbol: '₩',
        economy: { inflationRate: 0.025, laborEscalation: 0.035 },
        labor: {
            minimumWage: 1500, baseSalary_ShiftLead: 4000, baseSalary_Engineer: 3200,
            baseSalary_Technician: 2400, baseSalary_Admin: 2000, baseSalary_Janitor: 1500,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 15, publicHolidays: 15, sickAverage: 3 },
        },
        compliance: { certifications: ['KS Standards', 'KISA DC Cert'], annualComplianceCost: 9000 },
        environment: { baselineAQI: 55, gridCarbonIntensity: 0.42 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    TH: {
        id: 'TH', region: 'APAC', name: 'Thailand', currency: 'THB', currencySymbol: '฿',
        economy: { inflationRate: 0.02, laborEscalation: 0.04 },
        labor: {
            minimumWage: 300, baseSalary_ShiftLead: 1400, baseSalary_Engineer: 1000,
            baseSalary_Technician: 600, baseSalary_Admin: 450, baseSalary_Janitor: 300,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.18, leaves: { annual: 6, publicHolidays: 16, sickAverage: 5 },
        },
        compliance: { certifications: ['TIS Standards', 'PEA License'], annualComplianceCost: 4500 },
        environment: { baselineAQI: 80, gridCarbonIntensity: 0.5 },
        supplyChain: { importDifficultyFactor: 1.15 },
    },
    VN: {
        id: 'VN', region: 'APAC', name: 'Vietnam', currency: 'VND', currencySymbol: '₫',
        economy: { inflationRate: 0.035, laborEscalation: 0.07 },
        labor: {
            minimumWage: 200, baseSalary_ShiftLead: 1100, baseSalary_Engineer: 800,
            baseSalary_Technician: 450, baseSalary_Admin: 350, baseSalary_Janitor: 200,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 3.0, ninthHour: 3.0, tenthHourPlus: 3.0 } },
            shrinkageFactor: 0.22, leaves: { annual: 12, publicHolidays: 10, sickAverage: 5 },
        },
        compliance: { certifications: ['TCVN', 'MOIT License'], annualComplianceCost: 3500 },
        environment: { baselineAQI: 100, gridCarbonIntensity: 0.55 },
        supplyChain: { importDifficultyFactor: 1.3 },
    },
    PH: {
        id: 'PH', region: 'APAC', name: 'Philippines', currency: 'PHP', currencySymbol: '₱',
        economy: { inflationRate: 0.05, laborEscalation: 0.05 },
        labor: {
            minimumWage: 250, baseSalary_ShiftLead: 1300, baseSalary_Engineer: 1000,
            baseSalary_Technician: 550, baseSalary_Admin: 400, baseSalary_Janitor: 250,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.3 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.6 } },
            shrinkageFactor: 0.22, leaves: { annual: 5, publicHolidays: 18, sickAverage: 5 },
        },
        compliance: { certifications: ['PNS Standards', 'DOE License'], annualComplianceCost: 3500 },
        environment: { baselineAQI: 70, gridCarbonIntensity: 0.6 },
        supplyChain: { importDifficultyFactor: 1.35 },
    },
    TW: {
        id: 'TW', region: 'APAC', name: 'Taiwan', currency: 'TWD', currencySymbol: 'NT$',
        economy: { inflationRate: 0.02, laborEscalation: 0.03 },
        labor: {
            minimumWage: 900, baseSalary_ShiftLead: 2800, baseSalary_Engineer: 2200,
            baseSalary_Technician: 1600, baseSalary_Admin: 1200, baseSalary_Janitor: 900,
            overtimeRules: { workday: { firstHour: 1.34, subsequent: 1.67 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 7, publicHolidays: 12, sickAverage: 4 },
        },
        compliance: { certifications: ['CNS Standards', 'Taipower License'], annualComplianceCost: 7000 },
        environment: { baselineAQI: 60, gridCarbonIntensity: 0.5 },
        supplyChain: { importDifficultyFactor: 1.05 },
    },
    NZ: {
        id: 'NZ', region: 'APAC', name: 'New Zealand', currency: 'NZD', currencySymbol: 'NZ$',
        economy: { inflationRate: 0.03, laborEscalation: 0.035 },
        labor: {
            minimumWage: 2500, baseSalary_ShiftLead: 7500, baseSalary_Engineer: 6000,
            baseSalary_Technician: 4500, baseSalary_Admin: 3800, baseSalary_Janitor: 3000,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 20, publicHolidays: 11, sickAverage: 5 },
        },
        compliance: { certifications: ['AS/NZS Standards', 'WorkSafe'], annualComplianceCost: 8000 },
        environment: { baselineAQI: 15, gridCarbonIntensity: 0.1 },
        supplyChain: { importDifficultyFactor: 1.25 },
    },
    // ─── EXPANDED EMEA ──────────────────────────────────────
    GB: {
        id: 'GB', region: 'EMEA', name: 'United Kingdom', currency: 'GBP', currencySymbol: '£',
        economy: { inflationRate: 0.03, laborEscalation: 0.035 },
        labor: {
            minimumWage: 2200, baseSalary_ShiftLead: 8000, baseSalary_Engineer: 6500,
            baseSalary_Technician: 4500, baseSalary_Admin: 3500, baseSalary_Janitor: 2500,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 28, publicHolidays: 8, sickAverage: 5 },
        },
        compliance: { certifications: ['BS EN Standards', 'IET Wiring Regs', 'BREEAM'], annualComplianceCost: 14000 },
        environment: { baselineAQI: 25, gridCarbonIntensity: 0.23 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    DE: {
        id: 'DE', region: 'EMEA', name: 'Germany', currency: 'EUR', currencySymbol: '€',
        economy: { inflationRate: 0.025, laborEscalation: 0.03 },
        labor: {
            minimumWage: 2400, baseSalary_ShiftLead: 8500, baseSalary_Engineer: 7000,
            baseSalary_Technician: 5000, baseSalary_Admin: 4000, baseSalary_Janitor: 2800,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 24, publicHolidays: 10, sickAverage: 8 },
        },
        compliance: { certifications: ['VDE', 'TÜV', 'EnEfG'], annualComplianceCost: 16000 },
        environment: { baselineAQI: 20, gridCarbonIntensity: 0.35 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    NL: {
        id: 'NL', region: 'EMEA', name: 'Netherlands', currency: 'EUR', currencySymbol: '€',
        economy: { inflationRate: 0.025, laborEscalation: 0.03 },
        labor: {
            minimumWage: 2200, baseSalary_ShiftLead: 7500, baseSalary_Engineer: 6000,
            baseSalary_Technician: 4500, baseSalary_Admin: 3500, baseSalary_Janitor: 2500,
            overtimeRules: { workday: { firstHour: 1.3, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 8, sickAverage: 5 },
        },
        compliance: { certifications: ['NEN Standards', 'BREEAM-NL'], annualComplianceCost: 13000 },
        environment: { baselineAQI: 20, gridCarbonIntensity: 0.33 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    IE: {
        id: 'IE', region: 'EMEA', name: 'Ireland', currency: 'EUR', currencySymbol: '€',
        economy: { inflationRate: 0.025, laborEscalation: 0.035 },
        labor: {
            minimumWage: 2400, baseSalary_ShiftLead: 7800, baseSalary_Engineer: 6500,
            baseSalary_Technician: 4800, baseSalary_Admin: 3800, baseSalary_Janitor: 2800,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.12, leaves: { annual: 20, publicHolidays: 9, sickAverage: 5 },
        },
        compliance: { certifications: ['IS EN Standards', 'SEAI BER'], annualComplianceCost: 14000 },
        environment: { baselineAQI: 15, gridCarbonIntensity: 0.3 },
        supplyChain: { importDifficultyFactor: 1.05 },
    },
    FR: {
        id: 'FR', region: 'EMEA', name: 'France', currency: 'EUR', currencySymbol: '€',
        economy: { inflationRate: 0.025, laborEscalation: 0.03 },
        labor: {
            minimumWage: 2100, baseSalary_ShiftLead: 7000, baseSalary_Engineer: 5500,
            baseSalary_Technician: 4000, baseSalary_Admin: 3200, baseSalary_Janitor: 2300,
            overtimeRules: { workday: { firstHour: 1.25, subsequent: 1.5 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 25, publicHolidays: 11, sickAverage: 6 },
        },
        compliance: { certifications: ['NF C 15-100', 'AFNOR'], annualComplianceCost: 15000 },
        environment: { baselineAQI: 25, gridCarbonIntensity: 0.06 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    SE: {
        id: 'SE', region: 'EMEA', name: 'Sweden', currency: 'SEK', currencySymbol: 'kr',
        economy: { inflationRate: 0.02, laborEscalation: 0.025 },
        labor: {
            minimumWage: 2500, baseSalary_ShiftLead: 7200, baseSalary_Engineer: 6000,
            baseSalary_Technician: 4500, baseSalary_Admin: 3500, baseSalary_Janitor: 2800,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.10, leaves: { annual: 25, publicHolidays: 13, sickAverage: 5 },
        },
        compliance: { certifications: ['SS Standards', 'Energimyndigheten'], annualComplianceCost: 12000 },
        environment: { baselineAQI: 10, gridCarbonIntensity: 0.04 },
        supplyChain: { importDifficultyFactor: 1.0 },
    },
    PL: {
        id: 'PL', region: 'EMEA', name: 'Poland', currency: 'PLN', currencySymbol: 'zł',
        economy: { inflationRate: 0.04, laborEscalation: 0.05 },
        labor: {
            minimumWage: 1000, baseSalary_ShiftLead: 3500, baseSalary_Engineer: 2800,
            baseSalary_Technician: 2000, baseSalary_Admin: 1500, baseSalary_Janitor: 1000,
            overtimeRules: { workday: { firstHour: 1.5, subsequent: 2.0 }, holiday: { first8Hours: 2.0, ninthHour: 2.0, tenthHourPlus: 2.0 } },
            shrinkageFactor: 0.15, leaves: { annual: 20, publicHolidays: 13, sickAverage: 6 },
        },
        compliance: { certifications: ['PN-EN Standards', 'URE License'], annualComplianceCost: 7000 },
        environment: { baselineAQI: 40, gridCarbonIntensity: 0.65 },
        supplyChain: { importDifficultyFactor: 1.05 },
    },
};
