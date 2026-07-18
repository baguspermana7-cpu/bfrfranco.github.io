/* ─── Site Intelligence types (Phase B) ──────────────────────────────────────
 * CandidateSite + per-site editable attributes. Every attribute is OPTIONAL —
 * an absent field means "use the country baseline" (the engine's own
 * deriveFactors path). ATTR_BOUNDS is the single home for sanitize bounds,
 * shared by the adapter and the CreatableCombobox editors.
 * ──────────────────────────────────────────────────────────────────────── */

export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

export interface LatencyEntry { market: string; ms: number }

export interface SiteAttributes {
    /* Power & Utilities */
    powerSource?: string;
    availableCapacityMw?: number;
    gridVoltageKv?: number;
    saidiMinYr?: number;               // preferred grid override
    powerReliabilityPct?: number;      // fallback grid override
    renewableSolarKwhPerKwpYr?: number;
    fuelAvailability?: 'good' | 'moderate' | 'limited';
    powerCostKwh?: number;             // power factor override
    /* Connectivity */
    submarineCableLandings?: number;
    distanceToCableLandingKm?: number;
    latencies?: LatencyEntry[];
    /* Environmental */
    avgAmbientC?: number;
    humidityPct?: number;
    coolingDegreeDays?: number;
    airQualityIndex?: number;
    waterSource?: string;
    waterQuality?: 'excellent' | 'good' | 'fair' | 'poor';
    waterStress0to5?: number;          // WRI Aqueduct override
    /* Natural Risks */
    earthquakeRisk?: RiskLevel;
    floodRisk?: RiskLevel;
    cycloneRisk?: RiskLevel;
    landslideRisk?: RiskLevel;
    coastalRisk?: RiskLevel;
    pgaPct2in50yr?: number;            // preferred seismic override
    /* Land & Infrastructure */
    totalAcres?: number;
    usableAcres?: number;
    topography?: 'flat' | 'gentle' | 'rolling' | 'steep';
    soil?: string;
    roadAccess?: 'excellent' | 'good' | 'fair' | 'poor';
    distHighwayKm?: number;
    distPortKm?: number;
    distAirportKm?: number;
    constructionLabor?: 'abundant' | 'moderate' | 'scarce';
    permitMonths?: number;
    /* Cost & Incentives */
    landCostPerM2?: number;
    waterCostPerM3?: number;
    constructionCostIndex?: number;
    taxIncentives?: string;
    customsExemption?: boolean;
    renewableIncentives?: string;
    govSupport?: 'strong' | 'moderate' | 'weak';
    effectiveTaxRate?: number;         // tax factor override
}

export interface CandidateSite {
    id: string;
    name: string;
    label: string;                     // 'A' | 'B' | 'C' …
    countryId: string;
    city: string;
    lat: number;                       // schematic map only
    lng: number;
    targetItLoadMw?: number;
    attributes: SiteAttributes;
    isExample?: boolean;
    createdAt: number;
    updatedAt: number;
}

export type FactorKey = 'power' | 'grid' | 'seismic' | 'talent' | 'tax' | 'carbon' | 'flood' | 'latency' | 'water' | 'climate';
export type AxisKey = 'powerAvailability' | 'connectivity' | 'waterCooling' | 'landInfra' | 'environmental' | 'naturalRisks' | 'costIncentives' | 'marketProximity';

export const AXIS_LABELS: Record<AxisKey, string> = {
    powerAvailability: 'Power Availability',
    connectivity: 'Connectivity',
    waterCooling: 'Water & Cooling',
    landInfra: 'Land & Infra',
    environmental: 'Environmental',
    naturalRisks: 'Natural Risks',
    costIncentives: 'Cost & Incentives',
    marketProximity: 'Market Proximity',
};

export interface SiteScoreResult {
    siteId: string;
    engine: {
        score: number; grade: string; label: string;
        breakdown: { key: FactorKey; weight: number; value: number; contribution: number }[];
        missing: string[]; coverage: number;
    };
    axes: Record<AxisKey, number>;     // 0–100 (radar + comparison; presentation layer)
    availabilityScore: number;
    connectivityScore: number;
    waterCoolingScore: number;
    riskScore: number;                 // 0–100, LOWER better (inverted axis)
    rank?: number;
}

/** Single home for attribute sanitize bounds (adapter + combobox editors). */
export const ATTR_BOUNDS: Partial<Record<keyof SiteAttributes, { min: number; max: number; unit?: string }>> = {
    availableCapacityMw: { min: 1, max: 2000, unit: 'MW' },
    gridVoltageKv: { min: 11, max: 500, unit: 'kV' },
    saidiMinYr: { min: 0, max: 2000, unit: 'min/yr' },
    powerReliabilityPct: { min: 90, max: 100, unit: '%' },
    renewableSolarKwhPerKwpYr: { min: 800, max: 2400, unit: 'kWh/kWp/yr' },
    powerCostKwh: { min: 0.01, max: 0.6, unit: '$/kWh' },
    submarineCableLandings: { min: 0, max: 30 },
    distanceToCableLandingKm: { min: 0, max: 1000, unit: 'km' },
    avgAmbientC: { min: -10, max: 50, unit: '°C' },
    humidityPct: { min: 0, max: 100, unit: '%RH' },
    coolingDegreeDays: { min: 0, max: 6500 },
    airQualityIndex: { min: 0, max: 500 },
    waterStress0to5: { min: 0, max: 5 },
    pgaPct2in50yr: { min: 0, max: 100, unit: '%g' },
    totalAcres: { min: 1, max: 5000, unit: 'acres' },
    usableAcres: { min: 1, max: 5000, unit: 'acres' },
    distHighwayKm: { min: 0, max: 500, unit: 'km' },
    distPortKm: { min: 0, max: 1000, unit: 'km' },
    distAirportKm: { min: 0, max: 1000, unit: 'km' },
    permitMonths: { min: 1, max: 48, unit: 'months' },
    landCostPerM2: { min: 1, max: 20000, unit: '$/m²' },
    waterCostPerM3: { min: 0.05, max: 20, unit: '$/m³' },
    constructionCostIndex: { min: 0.5, max: 2.0 },
    effectiveTaxRate: { min: 0, max: 0.5 },
};
