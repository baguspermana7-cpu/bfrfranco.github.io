import { CountryProfile } from '@/constants/countries';

export type ComplianceCategory = 'fire' | 'electrical' | 'environmental' | 'building' | 'data-protection' | 'telecom';

export interface ComplianceItem {
    id: string;
    category: ComplianceCategory;
    requirement: string;
    authority: string;
    standard: string;
    frequency: 'One-time' | 'Annual' | 'Bi-Annual' | 'Quarterly' | 'Monthly';
    mandatory: boolean;
    initialCost: number;
    annualCost: number;
    leadWeeks: number;
    notes: string;
}

export interface CategoryBreakdown {
    category: ComplianceCategory;
    label: string;
    count: number;
    mandatoryCount: number;
    initialCost: number;
    annualCost: number;
}

export interface ComplianceResult {
    items: ComplianceItem[];
    totalInitialCost: number;
    totalAnnualCost: number;
    mandatoryCount: number;
    totalCount: number;
    categoryBreakdown: CategoryBreakdown[];
    complianceScore: number;
    countryName: string;
}

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
    fire: 'Fire Safety',
    electrical: 'Electrical',
    environmental: 'Environmental',
    building: 'Building & Construction',
    'data-protection': 'Data Protection',
    telecom: 'Telecommunications',
};

interface CountryFramework {
    items: Omit<ComplianceItem, 'id'>[];
}

function getCountryFramework(countryId: string, itLoadKw: number): CountryFramework {
    const scaleFactor = Math.max(1, itLoadKw / 2500);

    const frameworks: Record<string, CountryFramework> = {
        ID: {
            items: [
                { category: 'fire', requirement: 'Fire Safety Certificate (SLF)', authority: 'Dinas Pemadam Kebakaran', standard: 'Permen PU 26/2008', frequency: 'Annual', mandatory: true, initialCost: 3500, annualCost: 2000, leadWeeks: 8, notes: 'Required before building occupancy' },
                { category: 'fire', requirement: 'Fire Suppression System Approval', authority: 'Dinas Pemadam Kebakaran', standard: 'SNI 03-3985-2000', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 6, notes: 'Gas suppression inspection' },
                { category: 'electrical', requirement: 'Electrical Worthiness Certificate (SLO)', authority: 'Kemenaker / KONSUIL', standard: 'PUIL 2011 / SNI 0225', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 4000, leadWeeks: 12, notes: 'Mandatory for all HV/LV installations' },
                { category: 'electrical', requirement: 'K3 Electrical Expert (Ahli K3 Listrik)', authority: 'Kemenaker', standard: 'Permen 12/2015', frequency: 'Annual', mandatory: true, initialCost: 2000, annualCost: 1500, leadWeeks: 4, notes: 'Certified electrical safety officer required' },
                { category: 'electrical', requirement: 'Generator Operating Permit', authority: 'PLN / Kemenaker', standard: 'PP 14/2012', frequency: 'Annual', mandatory: true, initialCost: 3000, annualCost: 1500, leadWeeks: 6, notes: 'For all diesel generator installations' },
                { category: 'environmental', requirement: 'Environmental Impact Assessment (AMDAL)', authority: 'KLHK / Dinas LH', standard: 'PP 22/2021', frequency: 'One-time', mandatory: true, initialCost: 15000 * scaleFactor, annualCost: 0, leadWeeks: 24, notes: 'Required for facilities >5MW' },
                { category: 'environmental', requirement: 'Environmental Management Plan (UKL-UPL)', authority: 'Dinas LH', standard: 'PP 22/2021', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 8, notes: 'Annual reporting required' },
                { category: 'environmental', requirement: 'Emission Permit (Genset Exhaust)', authority: 'KLHK', standard: 'Permen LH 05/2014', frequency: 'Annual', mandatory: true, initialCost: 2000, annualCost: 2000, leadWeeks: 4, notes: 'Diesel generator emission testing' },
                { category: 'building', requirement: 'Building Permit (PBG)', authority: 'PUPR / OSS-RBA', standard: 'PP 16/2021', frequency: 'One-time', mandatory: true, initialCost: 25000 * scaleFactor, annualCost: 0, leadWeeks: 16, notes: 'New OSS system since 2021' },
                { category: 'building', requirement: 'Building Worthiness Certificate (SLF)', authority: 'Dinas PUPR', standard: 'PP 16/2021', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 8, notes: 'Structural integrity verification' },
                { category: 'data-protection', requirement: 'PSE Registration', authority: 'Kominfo', standard: 'PP 71/2019 (GR 71)', frequency: 'Annual', mandatory: true, initialCost: 2000, annualCost: 1000, leadWeeks: 8, notes: 'Electronic System Operator registration' },
                { category: 'data-protection', requirement: 'Data Protection Compliance (PDP)', authority: 'Kominfo', standard: 'UU 27/2022', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 12, notes: 'Personal Data Protection law' },
                { category: 'telecom', requirement: 'Telecommunication License', authority: 'Kominfo', standard: 'PP 46/2021', frequency: 'Annual', mandatory: false, initialCost: 3000, annualCost: 2000, leadWeeks: 8, notes: 'If providing carrier services' },
            ],
        },
        SG: {
            items: [
                { category: 'fire', requirement: 'Fire Safety Certificate', authority: 'SCDF', standard: 'Fire Safety Act 1993', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 5000, leadWeeks: 6, notes: 'Singapore Civil Defence Force' },
                { category: 'fire', requirement: 'Fire Safety Manager Appointment', authority: 'SCDF', standard: 'Fire Safety Regulations', frequency: 'Annual', mandatory: true, initialCost: 3000, annualCost: 2000, leadWeeks: 4, notes: 'Certified FSM required' },
                { category: 'electrical', requirement: 'Electrical Installation License', authority: 'EMA', standard: 'Electricity Act', frequency: 'Annual', mandatory: true, initialCost: 10000, annualCost: 6000, leadWeeks: 8, notes: 'Energy Market Authority' },
                { category: 'electrical', requirement: 'Licensed Electrical Worker (LEW)', authority: 'EMA', standard: 'Electricity Act S49', frequency: 'Annual', mandatory: true, initialCost: 4000, annualCost: 2500, leadWeeks: 4, notes: 'On-site LEW mandatory' },
                { category: 'environmental', requirement: 'Environmental Protection (EP)', authority: 'NEA', standard: 'EPA (SG)', frequency: 'Annual', mandatory: true, initialCost: 6000, annualCost: 4000, leadWeeks: 8, notes: 'Noise, air, water discharge' },
                { category: 'environmental', requirement: 'Carbon Tax Compliance', authority: 'NEA', standard: 'Carbon Pricing Act', frequency: 'Annual', mandatory: true, initialCost: 2000, annualCost: 5000 * scaleFactor, leadWeeks: 4, notes: 'S$25/tCO2e (rising)' },
                { category: 'building', requirement: 'BCA Approval', authority: 'BCA', standard: 'Building Control Act', frequency: 'One-time', mandatory: true, initialCost: 15000, annualCost: 0, leadWeeks: 12, notes: 'Building & Construction Authority' },
                { category: 'building', requirement: 'Green Mark Certification', authority: 'BCA', standard: 'BCA Green Mark', frequency: 'Annual', mandatory: false, initialCost: 10000, annualCost: 3000, leadWeeks: 16, notes: 'Recommended for new builds' },
                { category: 'data-protection', requirement: 'PDPA Compliance', authority: 'PDPC', standard: 'PDPA 2012', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 4000, leadWeeks: 8, notes: 'Personal Data Protection Act' },
                { category: 'telecom', requirement: 'IMDA Facility License', authority: 'IMDA', standard: 'Telecom Act', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 6, notes: 'Info-communications Media Dev Authority' },
            ],
        },
        US: {
            items: [
                { category: 'fire', requirement: 'NFPA 75 / 76 Compliance', authority: 'AHJ / Fire Marshal', standard: 'NFPA 75 & 76', frequency: 'Annual', mandatory: true, initialCost: 12000, annualCost: 6000, leadWeeks: 8, notes: 'IT equipment & telecom facility protection' },
                { category: 'fire', requirement: 'Fire Suppression Inspection', authority: 'Fire Marshal', standard: 'NFPA 2001', frequency: 'Bi-Annual', mandatory: true, initialCost: 5000, annualCost: 8000, leadWeeks: 4, notes: 'Clean agent system testing' },
                { category: 'electrical', requirement: 'NEC Compliance', authority: 'AHJ', standard: 'NFPA 70 (NEC)', frequency: 'One-time', mandatory: true, initialCost: 15000, annualCost: 0, leadWeeks: 12, notes: 'National Electrical Code' },
                { category: 'electrical', requirement: 'Arc Flash Study', authority: 'OSHA', standard: 'NFPA 70E', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 5000, leadWeeks: 6, notes: 'Worker safety requirement' },
                { category: 'electrical', requirement: 'Generator Permit (Air Quality)', authority: 'EPA / State', standard: 'EPA Tier 4', frequency: 'Annual', mandatory: true, initialCost: 6000, annualCost: 3000, leadWeeks: 8, notes: 'Emission testing for diesel gensets' },
                { category: 'environmental', requirement: 'SPCC Plan (Fuel Storage)', authority: 'EPA', standard: '40 CFR 112', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 4000, leadWeeks: 6, notes: 'Spill Prevention, Control & Countermeasure' },
                { category: 'environmental', requirement: 'Stormwater Permit', authority: 'EPA / State', standard: 'CWA NPDES', frequency: 'Annual', mandatory: true, initialCost: 3000, annualCost: 2000, leadWeeks: 8, notes: 'Construction & operation runoff' },
                { category: 'building', requirement: 'Building Permit & COO', authority: 'Local AHJ', standard: 'IBC / Local Code', frequency: 'One-time', mandatory: true, initialCost: 20000 * scaleFactor, annualCost: 0, leadWeeks: 16, notes: 'Certificate of Occupancy' },
                { category: 'building', requirement: 'ADA Compliance', authority: 'DOJ', standard: 'ADA Standards', frequency: 'One-time', mandatory: true, initialCost: 5000, annualCost: 0, leadWeeks: 4, notes: 'Accessibility requirements' },
                { category: 'data-protection', requirement: 'SOC 2 Type II Audit', authority: 'AICPA', standard: 'SOC 2', frequency: 'Annual', mandatory: false, initialCost: 25000, annualCost: 20000, leadWeeks: 16, notes: 'Industry standard for data centers' },
                { category: 'data-protection', requirement: 'State Privacy Law Compliance', authority: 'State AG', standard: 'CCPA / State Laws', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 8, notes: 'Varies by state' },
                { category: 'telecom', requirement: 'FCC Authorization', authority: 'FCC', standard: 'FCC Part 15/68', frequency: 'One-time', mandatory: false, initialCost: 2000, annualCost: 500, leadWeeks: 4, notes: 'If operating telecom services' },
            ],
        },
        GB: {
            items: [
                { category: 'fire', requirement: 'Fire Risk Assessment', authority: 'Local Fire Authority', standard: 'BS 9999 / RRO 2005', frequency: 'Annual', mandatory: true, initialCost: 6000, annualCost: 4000, leadWeeks: 4, notes: 'Regulatory Reform (Fire Safety) Order' },
                { category: 'fire', requirement: 'Fire Suppression Certification', authority: 'LPCB / BRE', standard: 'BS EN 15004', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3500, leadWeeks: 4, notes: 'Clean agent systems' },
                { category: 'electrical', requirement: 'IET Wiring Regulations', authority: 'HSE', standard: 'BS 7671 (18th Ed)', frequency: 'Annual', mandatory: true, initialCost: 10000, annualCost: 5000, leadWeeks: 8, notes: 'EICR every 5 years, annual visual' },
                { category: 'electrical', requirement: 'HV Authorisation', authority: 'Ofgem / DNO', standard: 'Electricity at Work Act', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 4000, leadWeeks: 6, notes: 'High Voltage equipment authorization' },
                { category: 'environmental', requirement: 'Environmental Permit', authority: 'Environment Agency', standard: 'EPA 1990', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 4000, leadWeeks: 8, notes: 'Generator emissions & fuel storage' },
                { category: 'environmental', requirement: 'F-Gas Regulations', authority: 'Environment Agency', standard: 'EU 517/2014 (retained)', frequency: 'Annual', mandatory: true, initialCost: 3000, annualCost: 2500, leadWeeks: 4, notes: 'Refrigerant leak checks' },
                { category: 'building', requirement: 'Planning Permission & BRegs', authority: 'Local Council', standard: 'Building Regulations 2010', frequency: 'One-time', mandatory: true, initialCost: 18000, annualCost: 0, leadWeeks: 16, notes: 'Building control approval' },
                { category: 'data-protection', requirement: 'UK GDPR / DPA 2018', authority: 'ICO', standard: 'UK GDPR', frequency: 'Annual', mandatory: true, initialCost: 10000, annualCost: 6000, leadWeeks: 8, notes: 'Data protection registration & compliance' },
                { category: 'telecom', requirement: 'Ofcom License', authority: 'Ofcom', standard: 'Communications Act 2003', frequency: 'Annual', mandatory: false, initialCost: 3000, annualCost: 2000, leadWeeks: 6, notes: 'If providing telecom services' },
            ],
        },
        DE: {
            items: [
                { category: 'fire', requirement: 'Brandschutzkonzept', authority: 'Bauordnungsamt', standard: 'DIN 4102 / EN 13501', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 5000, leadWeeks: 8, notes: 'Fire protection concept' },
                { category: 'electrical', requirement: 'VDE Compliance', authority: 'Berufsgenossenschaft', standard: 'VDE 0100 / EN 50600', frequency: 'Annual', mandatory: true, initialCost: 12000, annualCost: 6000, leadWeeks: 8, notes: 'EN 50600 data center standard' },
                { category: 'electrical', requirement: 'DGUV V3 Electrical Safety', authority: 'BG ETEM', standard: 'DGUV Vorschrift 3', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 4000, leadWeeks: 4, notes: 'Employer liability insurance inspection' },
                { category: 'environmental', requirement: 'BImSchG Emission Permit', authority: 'Umweltamt', standard: 'BImSchG / TA Luft', frequency: 'Annual', mandatory: true, initialCost: 10000, annualCost: 5000, leadWeeks: 12, notes: 'Federal emission control for generators' },
                { category: 'environmental', requirement: 'WHG Water Protection', authority: 'Untere Wasserbehörde', standard: 'WHG / AwSV', frequency: 'Annual', mandatory: true, initialCost: 4000, annualCost: 3000, leadWeeks: 6, notes: 'Fuel storage water protection' },
                { category: 'building', requirement: 'Baugenehmigung', authority: 'Bauordnungsamt', standard: 'BauGB / LBO', frequency: 'One-time', mandatory: true, initialCost: 20000, annualCost: 0, leadWeeks: 20, notes: 'Building permit' },
                { category: 'data-protection', requirement: 'GDPR / BDSG Compliance', authority: 'LfDI / BfDI', standard: 'GDPR / BDSG', frequency: 'Annual', mandatory: true, initialCost: 12000, annualCost: 8000, leadWeeks: 8, notes: 'Data protection officer required' },
                { category: 'telecom', requirement: 'BNetzA Registration', authority: 'BNetzA', standard: 'TKG 2021', frequency: 'Annual', mandatory: false, initialCost: 3000, annualCost: 2000, leadWeeks: 6, notes: 'Federal Network Agency' },
            ],
        },
    };

    // Generic framework for countries without specific data
    const genericFramework: CountryFramework = {
        items: [
            { category: 'fire', requirement: 'Fire Safety Certificate', authority: 'Local Fire Authority', standard: 'Local Fire Code', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 6, notes: 'Fire safety inspection and certificate' },
            { category: 'fire', requirement: 'Fire Suppression System Inspection', authority: 'Fire Authority', standard: 'Local Standard', frequency: 'Annual', mandatory: true, initialCost: 4000, annualCost: 2500, leadWeeks: 4, notes: 'Annual inspection of suppression systems' },
            { category: 'electrical', requirement: 'Electrical Installation Certificate', authority: 'Energy Authority', standard: 'IEC 60364', frequency: 'Annual', mandatory: true, initialCost: 8000, annualCost: 4000, leadWeeks: 8, notes: 'Based on IEC standards' },
            { category: 'electrical', requirement: 'Generator Operating Permit', authority: 'Energy Authority', standard: 'Local Regulation', frequency: 'Annual', mandatory: true, initialCost: 4000, annualCost: 2000, leadWeeks: 6, notes: 'Diesel generator operation permit' },
            { category: 'environmental', requirement: 'Environmental Impact Assessment', authority: 'Environmental Agency', standard: 'Local EPA', frequency: 'One-time', mandatory: true, initialCost: 10000 * scaleFactor, annualCost: 0, leadWeeks: 16, notes: 'For major facilities' },
            { category: 'environmental', requirement: 'Emission Compliance', authority: 'Environmental Agency', standard: 'Local Standard', frequency: 'Annual', mandatory: true, initialCost: 3000, annualCost: 2500, leadWeeks: 4, notes: 'Generator and cooling emissions' },
            { category: 'building', requirement: 'Building Permit', authority: 'Planning Authority', standard: 'Local Building Code', frequency: 'One-time', mandatory: true, initialCost: 15000 * scaleFactor, annualCost: 0, leadWeeks: 12, notes: 'Construction and occupancy approval' },
            { category: 'data-protection', requirement: 'Data Protection Compliance', authority: 'Data Protection Authority', standard: 'Local DPA', frequency: 'Annual', mandatory: true, initialCost: 5000, annualCost: 3000, leadWeeks: 8, notes: 'National data protection law' },
            { category: 'telecom', requirement: 'Telecommunications License', authority: 'Telecom Regulator', standard: 'Local Telecom Act', frequency: 'Annual', mandatory: false, initialCost: 3000, annualCost: 2000, leadWeeks: 6, notes: 'If providing carrier services' },
        ],
    };

    // Region-based adjustments for non-specific countries
    const regionFrameworks: Record<string, Partial<CountryFramework>> = {
        APAC: { items: genericFramework.items },
        EMEA: {
            items: [
                ...genericFramework.items.filter(i => i.category !== 'data-protection'),
                { category: 'data-protection', requirement: 'GDPR Compliance', authority: 'National DPA', standard: 'EU GDPR', frequency: 'Annual', mandatory: true, initialCost: 10000, annualCost: 6000, leadWeeks: 8, notes: 'EU General Data Protection Regulation' },
                { category: 'environmental', requirement: 'F-Gas Regulation', authority: 'Environmental Agency', standard: 'EU 517/2014', frequency: 'Annual', mandatory: true, initialCost: 3000, annualCost: 2500, leadWeeks: 4, notes: 'Refrigerant management' },
            ],
        },
        MENA: {
            items: genericFramework.items.map(i => ({
                ...i,
                initialCost: Math.round(i.initialCost * 0.7),
                annualCost: Math.round(i.annualCost * 0.7),
            })),
        },
        AFR: {
            items: genericFramework.items.map(i => ({
                ...i,
                initialCost: Math.round(i.initialCost * 0.6),
                annualCost: Math.round(i.annualCost * 0.6),
                leadWeeks: i.leadWeeks + 4,
            })),
        },
        LATAM: {
            items: genericFramework.items.map(i => ({
                ...i,
                initialCost: Math.round(i.initialCost * 0.75),
                annualCost: Math.round(i.annualCost * 0.75),
            })),
        },
        AMER: { items: genericFramework.items },
    };

    if (frameworks[countryId]) {
        return frameworks[countryId];
    }

    // Use known country region for regional framework
    const regionMap: Record<string, string> = {
        MY: 'APAC', JP: 'APAC', AU: 'APAC', IN: 'APAC', CN: 'APAC', KR: 'APAC', TH: 'APAC', VN: 'APAC', PH: 'APAC', TW: 'APAC', NZ: 'APAC',
        AE: 'MENA', SA: 'MENA', QA: 'MENA',
        ZA: 'AFR', NG: 'AFR', KE: 'AFR',
        BR: 'LATAM', CL: 'LATAM', MX: 'LATAM', CO: 'LATAM',
        NL: 'EMEA', IE: 'EMEA', FR: 'EMEA', SE: 'EMEA', PL: 'EMEA',
    };

    const region = regionMap[countryId];
    if (region && regionFrameworks[region]) {
        return regionFrameworks[region] as CountryFramework;
    }

    return genericFramework;
}

export function calculateCompliance(country: CountryProfile, itLoadKw: number): ComplianceResult {
    const framework = getCountryFramework(country.id, itLoadKw);

    const items: ComplianceItem[] = framework.items.map((item, idx) => ({
        ...item,
        id: `${country.id}-${item.category}-${idx}`,
    }));

    const totalInitialCost = items.reduce((sum, i) => sum + i.initialCost, 0);
    const totalAnnualCost = items.reduce((sum, i) => sum + i.annualCost, 0);
    const mandatoryCount = items.filter(i => i.mandatory).length;

    const categories: ComplianceCategory[] = ['fire', 'electrical', 'environmental', 'building', 'data-protection', 'telecom'];
    const categoryBreakdown: CategoryBreakdown[] = categories.map(cat => {
        const catItems = items.filter(i => i.category === cat);
        return {
            category: cat,
            label: CATEGORY_LABELS[cat],
            count: catItems.length,
            mandatoryCount: catItems.filter(i => i.mandatory).length,
            initialCost: catItems.reduce((s, i) => s + i.initialCost, 0),
            annualCost: catItems.reduce((s, i) => s + i.annualCost, 0),
        };
    }).filter(c => c.count > 0);

    // Compliance score: based on how comprehensive the framework is
    const maxItems = 14;
    const coverageScore = Math.min(100, (items.length / maxItems) * 100);
    const mandatoryRatio = mandatoryCount / Math.max(1, items.length);
    const complianceScore = Math.round(coverageScore * 0.6 + mandatoryRatio * 40);

    return {
        items,
        totalInitialCost,
        totalAnnualCost,
        mandatoryCount,
        totalCount: items.length,
        categoryBreakdown,
        complianceScore: Math.min(100, complianceScore),
        countryName: country.name,
    };
}
