import { CountryProfile } from '@/constants/countries';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { rzModels } from '@/lib/rz-engine';

export type SensorCategory = 'temperature' | 'humidity' | 'power-quality' | 'vibration' | 'fluid-leak' | 'airflow' | 'door-access';

export interface SensorSpec {
    category: SensorCategory;
    label: string;
    countFormula: string;
    count: number;
    unitCost: number;
    totalCost: number;
    failureDetectionRate: number;
    energySavingsPercent: number;
    enabled: boolean;
}

export type DCIMTier = 'basic' | 'standard' | 'enterprise';

export interface DCIMPlatform {
    tier: DCIMTier;
    label: string;
    annualLicenseCost: number;
    features: string[];
    sensorIntegration: number;
}

export interface CBMInput {
    country: CountryProfile;
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: string;
    coolingTopology?: 'in-row' | 'perimeter' | 'dlc';
    powerRedundancy?: 'N+1' | '2N' | '2N+1';
    enabledCategories?: SensorCategory[];
    dcimTier?: DCIMTier;
}

export interface CBMResult {
    sensors: SensorSpec[];
    totalSensorInvestment: number;
    totalSensorCount: number;
    annualAvertedDowntimeCost: number;
    annualEnergySavings: number;
    totalAnnualBenefit: number;
    roiPercent: number;
    paybackYears: number;
    npv5Year: number;
    sensorDensityPerRack: number;
    platformLicenseCostAnnual: number;
    dcimPlatforms: DCIMPlatform[];
    selectedTier: DCIMTier;
}

// 2026 DCIM platform pricing (Vertiv/Schneider/nlyte/Sunbird market survey):
// Basic BMS: $15K-$25K/yr; Standard DCIM: $40K-$65K/yr; Enterprise AI DCIM: $90K-$150K/yr
// Prices scale with monitored kW; AI-enabled platforms seeing +15% YoY
const DCIM_PLATFORMS: DCIMPlatform[] = [
    {
        tier: 'basic',
        label: 'Basic BMS',
        annualLicenseCost: 18000,      // 2026: +$3K vs 2024
        features: ['Temperature monitoring', 'Basic alerts', 'Manual reporting', 'Energy metering'],
        sensorIntegration: 0.6,
    },
    {
        tier: 'standard',
        label: 'Standard DCIM',
        annualLicenseCost: 52000,      // 2026: ~$52K/yr (Sunbird/Nlyte mid-tier)
        features: ['Real-time dashboards', 'Capacity planning', 'Automated alerts', 'Power monitoring', 'Trend analysis', 'Asset lifecycle tracking'],
        sensorIntegration: 0.85,
    },
    {
        tier: 'enterprise',
        label: 'Enterprise DCIM (AI)',
        annualLicenseCost: 110000,     // 2026: AI-enabled platforms (Vertiv, Schneider EcoStruxure)
        features: ['AI/ML predictive analytics', 'Digital twin', 'CFD modeling', 'Automated workflows', 'API integrations', 'Multi-site federation', 'Anomaly detection', 'Carbon tracking'],
        sensorIntegration: 1.0,
    },
];

export function calculateCBM(input: CBMInput): CBMResult {
    const { country, itLoadKw, tierLevel, coolingType, coolingTopology, powerRedundancy, enabledCategories, dcimTier } = input;
    const selectedTier = dcimTier ?? 'standard';

    // Estimate rack count
    const avgKwPerRack = 8;
    const rackCount = Math.ceil(itLoadKw / avgKwPerRack);

    // Estimate asset counts for sizing (AssetGenerator expects tier 3|4)
    const effectiveTier: 3 | 4 = tierLevel === 2 ? 3 : tierLevel as 3 | 4;
    const coolingMap: 'air' | 'pumped' = coolingType === 'liquid' || coolingType === 'rdhx' ? 'pumped' : 'air';
    const effectiveCoolingTopology = coolingTopology ?? 'perimeter';
    const effectivePowerRedundancy = powerRedundancy ?? '2N';
    const assetCounts = generateAssetCounts(itLoadKw, effectiveTier, coolingMap, Math.ceil(itLoadKw * 0.6), effectiveCoolingTopology, effectivePowerRedundancy);
    const genCount = assetCounts.find(a => a.assetId === 'gen-set')?.count ?? 2;
    const upsCount = assetCounts.find(a => a.assetId === 'ups-module')?.count ?? 2;
    const cracCount = assetCounts.find(a => a.assetId === 'pac-unit')?.count ?? 4;
    const chillerCount = assetCounts.find(a => a.assetId === 'chiller-air')?.count ?? 2;

    const allCategories: SensorCategory[] = ['temperature', 'humidity', 'power-quality', 'vibration', 'fluid-leak', 'airflow', 'door-access'];
    const enabled = enabledCategories ?? allCategories;

    // Define sensor specifications
    const sensorDefs: Omit<SensorSpec, 'enabled'>[] = [
        {
            category: 'temperature',
            label: 'Temperature Sensors',
            countFormula: '3 per rack + 2 per CRAC + 4 per chiller',
            count: rackCount * 3 + cracCount * 2 + chillerCount * 4,
            unitCost: 85,
            totalCost: 0,
            failureDetectionRate: 0.35,
            energySavingsPercent: 0.08,
        },
        {
            category: 'humidity',
            label: 'Humidity Sensors',
            countFormula: '1 per 4 racks + 1 per CRAC',
            count: Math.ceil(rackCount / 4) + cracCount,
            unitCost: 120,
            totalCost: 0,
            failureDetectionRate: 0.15,
            energySavingsPercent: 0.03,
        },
        {
            category: 'power-quality',
            label: 'Power Quality Meters',
            countFormula: '1 per UPS + 1 per PDU bus + 1 per gen',
            count: upsCount + Math.ceil(rackCount / 20) + genCount,
            unitCost: 650,
            totalCost: 0,
            failureDetectionRate: 0.40,
            energySavingsPercent: 0.05,
        },
        {
            category: 'vibration',
            label: 'Vibration Sensors',
            countFormula: '2 per gen + 1 per chiller + 1 per CRAC motor',
            count: genCount * 2 + chillerCount + cracCount,
            unitCost: 280,
            totalCost: 0,
            failureDetectionRate: 0.45,
            energySavingsPercent: 0.02,
        },
        {
            category: 'fluid-leak',
            label: 'Fluid Leak Detection',
            countFormula: '1 per 6 racks + 2 per chiller + 1 per CRAC',
            count: Math.ceil(rackCount / 6) + chillerCount * 2 + cracCount,
            unitCost: 180,
            totalCost: 0,
            failureDetectionRate: 0.50,
            energySavingsPercent: 0.01,
        },
        {
            category: 'airflow',
            label: 'Airflow Sensors',
            countFormula: '1 per 3 racks (hot/cold aisle)',
            count: Math.ceil(rackCount / 3),
            unitCost: 200,
            totalCost: 0,
            failureDetectionRate: 0.20,
            energySavingsPercent: 0.06,
        },
        {
            category: 'door-access',
            label: 'Door / Access Sensors',
            countFormula: '2 per room + 1 per cabinet row',
            count: Math.ceil(rackCount / 40) * 2 + Math.ceil(rackCount / 20),
            unitCost: 95,
            totalCost: 0,
            failureDetectionRate: 0.05,
            energySavingsPercent: 0.0,
        },
    ];

    const sensors: SensorSpec[] = sensorDefs.map(s => ({
        ...s,
        totalCost: s.count * s.unitCost,
        enabled: enabled.includes(s.category),
    }));

    // Calculations based on enabled sensors only
    const activeSensors = sensors.filter(s => s.enabled);
    const totalSensorInvestment = activeSensors.reduce((sum, s) => sum + s.totalCost, 0);
    const totalSensorCount = activeSensors.reduce((sum, s) => sum + s.count, 0);

    // Downtime cost avoidance
    const downtimeCostPerMin = Math.max(100, country.risk.downtimeCostPerMin || 5000);
    // 2026 Uptime Institute Tier Standard: Tier IV 26 min/yr, Tier III 95 min/yr, Tier II 1361 min/yr
    const expectedDowntimeMinPerYear = tierLevel === 4 ? 26 : tierLevel === 3 ? 95 : 1361;
    const avgDetectionRate = activeSensors.length > 0
        ? activeSensors.reduce((sum, s) => sum + s.failureDetectionRate, 0) / activeSensors.length
        : 0;
    const avertedDowntimeMin = expectedDowntimeMinPerYear * avgDetectionRate;
    const annualAvertedDowntimeCost = avertedDowntimeMin * downtimeCostPerMin;

    // Energy savings
    const annualElectricityCost = itLoadKw * 8760 * country.economy.electricityRate;
    const totalEnergySavingsPercent = activeSensors.reduce((sum, s) => sum + s.energySavingsPercent, 0);
    const cappedEnergySavings = Math.min(0.20, totalEnergySavingsPercent); // Cap at 20%
    const annualEnergySavings = annualElectricityCost * cappedEnergySavings;

    const totalAnnualBenefit = annualAvertedDowntimeCost + annualEnergySavings;

    // DCIM platform cost
    const platform = DCIM_PLATFORMS.find(p => p.tier === selectedTier)!;
    const platformScaledCost = Math.round(platform.annualLicenseCost * Math.max(1, itLoadKw / 5000));

    // ROI and payback
    const totalInvestment = totalSensorInvestment + platformScaledCost; // Year 1 total
    const netAnnualBenefit = totalAnnualBenefit - platformScaledCost;
    const roiPercent = totalSensorInvestment > 0 ? (netAnnualBenefit / totalSensorInvestment) * 100 : 0;
    const paybackYears = netAnnualBenefit > 0 ? totalSensorInvestment / netAnnualBenefit : 99;

    // Engine design life cross-reference for sensor replacement (field-sensor assetClass)
    const assetModel = rzModels().asset;
    const sensorDesignLife = assetModel && typeof assetModel.designLife === 'function'
        ? assetModel.designLife('field-sensor')
        : null;
    // sensorDesignLife is informational — used for CBM ROI horizon if present (local 5yr fallback)
    const sensorLifeYears = (sensorDesignLife != null ? sensorDesignLife : 5) as number;

    // NPV over sensorLifeYears (8% discount rate)
    const discountRate = 0.08;
    let npv5Year = -totalSensorInvestment;
    for (let y = 1; y <= sensorLifeYears; y++) {
        npv5Year += netAnnualBenefit / Math.pow(1 + discountRate, y);
    }

    // Guard against rackCount = 0
    const sensorDensityPerRack = rackCount > 0 ? Math.round((totalSensorCount / rackCount) * 10) / 10 : 0;

    return {
        sensors,
        totalSensorInvestment: Math.round(totalSensorInvestment),
        totalSensorCount,
        annualAvertedDowntimeCost: Math.round(annualAvertedDowntimeCost),
        annualEnergySavings: Math.round(annualEnergySavings),
        totalAnnualBenefit: Math.round(totalAnnualBenefit),
        roiPercent: Math.round(roiPercent),
        paybackYears: Math.round(paybackYears * 10) / 10,
        npv5Year: Math.round(npv5Year),
        sensorDensityPerRack,
        platformLicenseCostAnnual: platformScaledCost,
        dcimPlatforms: DCIM_PLATFORMS.map(p => ({
            ...p,
            annualLicenseCost: Math.round(p.annualLicenseCost * Math.max(1, itLoadKw / 5000)),
        })),
        selectedTier,
    };
}
