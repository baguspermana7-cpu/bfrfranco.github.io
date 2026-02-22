import { CountryProfile } from '@/constants/countries';
import { ASSETS } from '@/constants/assets';
import { generateAssetCounts, AssetCount } from '@/lib/AssetGenerator';
import { fmtMoney } from '@/lib/format';

export type DepreciationMethod = 'straight-line' | 'declining-balance' | 'sum-of-years';

export interface AssetLifecycleInput {
    country: CountryProfile;
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: string;
    coolingTopology?: 'in-row' | 'perimeter' | 'dlc';
    powerRedundancy?: 'N+1' | '2N' | '2N+1';
    depreciationMethod: DepreciationMethod;
    projectionYears?: number;
}

interface AssetUsefulLife {
    assetId: string;
    name: string;
    category: string;
    usefulLifeYears: number;
    unitReplacementCost: number;
}

const USEFUL_LIVES: Record<string, { years: number; replacementCostPerUnit: number }> = {
    'gen-set': { years: 15, replacementCostPerUnit: 350000 },
    'ups-module': { years: 12, replacementCostPerUnit: 180000 },
    'lv-switchgear': { years: 25, replacementCostPerUnit: 85000 },
    'transformer': { years: 25, replacementCostPerUnit: 120000 },
    'chiller-air': { years: 15, replacementCostPerUnit: 250000 },
    'pac-unit': { years: 15, replacementCostPerUnit: 35000 },
    'fcu': { years: 12, replacementCostPerUnit: 8000 },
    'fire-suppression': { years: 10, replacementCostPerUnit: 15000 },
    'vesda': { years: 10, replacementCostPerUnit: 5000 },
    'fire-panel': { years: 15, replacementCostPerUnit: 12000 },
    'fuel-polisher': { years: 12, replacementCostPerUnit: 8000 },
    'bulk-tank': { years: 20, replacementCostPerUnit: 25000 },
    'sand-filter': { years: 15, replacementCostPerUnit: 6000 },
    'dosing-pump': { years: 10, replacementCostPerUnit: 3000 },
    'bms-server': { years: 8, replacementCostPerUnit: 15000 },
    'plc-hmi': { years: 10, replacementCostPerUnit: 12000 },
    'field-sensor': { years: 8, replacementCostPerUnit: 500 },
    'cctv': { years: 8, replacementCostPerUnit: 2000 },
    'access-control': { years: 8, replacementCostPerUnit: 3000 },
    'boom-gate': { years: 15, replacementCostPerUnit: 8000 },
    'loading-dock': { years: 20, replacementCostPerUnit: 15000 },
    'mewp': { years: 10, replacementCostPerUnit: 25000 },
    'vent-fan': { years: 12, replacementCostPerUnit: 5000 },
    'ro-unit': { years: 12, replacementCostPerUnit: 35000 },
};

export interface LifecycleAsset {
    assetId: string;
    name: string;
    category: string;
    count: number;
    usefulLifeYears: number;
    unitCost: number;
    totalAcquisitionCost: number;
    annualDepreciation: number;
    replacementYear: number;
    replacementCost: number;
}

export interface YearDepreciation {
    year: number;
    byCategory: Record<string, number>;
    total: number;
    cumulativeDepreciation: number;
    bookValue: number;
}

export interface ReplacementEvent {
    year: number;
    assetName: string;
    category: string;
    count: number;
    cost: number;
}

export interface AssetHealthScore {
    assetId: string;
    name: string;
    category: string;
    healthPct: number;       // 100 = new, 0 = end of life
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    failureProbability: number;  // 0-1
    remainingLife: number;       // years
}

export interface AssetLifecycleResult {
    assets: LifecycleAsset[];
    totalAcquisitionCost: number;
    annualDepreciationSchedule: YearDepreciation[];
    replacementTimeline: ReplacementEvent[];
    totalLifecycleCost25yr: number;
    annualCapexRefresh: number;
    npvOfReplacements: number;
    depreciationMethod: DepreciationMethod;
    projectionYears: number;
    healthScores: AssetHealthScore[];
    financialImpact: {
        earlyReplacementNpv: number;
        deferredReplacementNpv: number;
        maintenanceCostOfAging: number;
        savingsFromEarly: number;
    };
    bookValueCurve: { year: number; bookValue: number; cumulativeReplacement: number }[];
    riskEvents: { year: number; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }[];
    portfolioSummary: {
        avgAssetAge: number;
        oldestAsset: string;
        nextReplacement: { name: string; year: number; cost: number };
        peakSpendYear: number;
        peakSpendAmount: number;
    };
}

function calcDepreciation(
    cost: number,
    usefulLife: number,
    year: number,
    method: DepreciationMethod,
    remainingValue?: number
): number {
    if (year > usefulLife) return 0;

    switch (method) {
        case 'straight-line':
            return cost / usefulLife;

        case 'declining-balance': {
            const rate = 2 / usefulLife; // Double declining
            const rv = remainingValue ?? cost;
            const dep = rv * rate;
            const salvage = cost * 0.05;
            return Math.max(0, Math.min(dep, rv - salvage));
        }

        case 'sum-of-years': {
            const sumDigits = (usefulLife * (usefulLife + 1)) / 2;
            const remaining = usefulLife - year + 1;
            return (remaining / sumDigits) * (cost * 0.95); // 5% salvage
        }

        default:
            return cost / usefulLife;
    }
}

export function calculateAssetLifecycle(input: AssetLifecycleInput): AssetLifecycleResult {
    const { country, itLoadKw, tierLevel, coolingType, coolingTopology, powerRedundancy, depreciationMethod, projectionYears: projYears } = input;
    const projectionYears = projYears ?? 25;
    const inflationRate = country.economy.inflationRate;

    // Generate asset counts (AssetGenerator expects tier 3|4, map tier 2 to 3)
    const effectiveTier: 3 | 4 = tierLevel === 2 ? 3 : tierLevel as 3 | 4;
    const coolingMap: 'air' | 'pumped' = coolingType === 'liquid' || coolingType === 'rdhx' ? 'pumped' : 'air';
    const assetCounts = generateAssetCounts(itLoadKw, effectiveTier, coolingMap, Math.ceil(itLoadKw * 0.6), coolingTopology ?? 'perimeter', powerRedundancy ?? '2N');

    // Build lifecycle assets
    const assets: LifecycleAsset[] = [];
    for (const ac of assetCounts) {
        const lifecycle = USEFUL_LIVES[ac.assetId];
        if (!lifecycle) continue;
        const asset = ASSETS.find(a => a.id === ac.assetId);
        if (!asset) continue;

        const usefulLife = lifecycle.years;
        const unitCost = lifecycle.replacementCostPerUnit;
        const totalCost = unitCost * ac.count;
        const annualDep = calcDepreciation(totalCost, usefulLife, 1, depreciationMethod, totalCost);
        const replacementCost = totalCost * Math.pow(1 + inflationRate, usefulLife);

        assets.push({
            assetId: ac.assetId,
            name: asset.name,
            category: asset.category,
            count: ac.count,
            usefulLifeYears: usefulLife,
            unitCost,
            totalAcquisitionCost: totalCost,
            annualDepreciation: Math.round(annualDep),
            replacementYear: usefulLife,
            replacementCost: Math.round(replacementCost),
        });
    }

    const totalAcquisitionCost = assets.reduce((s, a) => s + a.totalAcquisitionCost, 0);

    // Build depreciation schedule
    const categories = [...new Set(assets.map(a => a.category))];
    const schedule: YearDepreciation[] = [];
    let cumulativeDep = 0;

    // Track remaining book values for declining balance
    const bookValues: Record<string, number> = {};
    assets.forEach(a => { bookValues[a.assetId] = a.totalAcquisitionCost; });

    for (let y = 1; y <= projectionYears; y++) {
        const byCategory: Record<string, number> = {};
        let yearTotal = 0;

        for (const cat of categories) {
            const catAssets = assets.filter(a => a.category === cat);
            let catDep = 0;

            for (const a of catAssets) {
                // Handle replacement cycles
                const effectiveYear = ((y - 1) % a.usefulLifeYears) + 1;
                const dep = calcDepreciation(
                    a.totalAcquisitionCost,
                    a.usefulLifeYears,
                    effectiveYear,
                    depreciationMethod,
                    bookValues[a.assetId]
                );
                catDep += dep;

                if (depreciationMethod === 'declining-balance') {
                    bookValues[a.assetId] = Math.max(a.totalAcquisitionCost * 0.05, (bookValues[a.assetId] ?? a.totalAcquisitionCost) - dep);
                    // Reset on replacement
                    if (y % a.usefulLifeYears === 0) {
                        bookValues[a.assetId] = a.totalAcquisitionCost;
                    }
                }
            }

            byCategory[cat] = Math.round(catDep);
            yearTotal += catDep;
        }

        cumulativeDep += yearTotal;

        schedule.push({
            year: y,
            byCategory,
            total: Math.round(yearTotal),
            cumulativeDepreciation: Math.round(cumulativeDep),
            bookValue: Math.round(Math.max(0, totalAcquisitionCost - cumulativeDep)),
        });
    }

    // Build replacement timeline
    const replacements: ReplacementEvent[] = [];
    for (const a of assets) {
        for (let y = a.usefulLifeYears; y <= projectionYears; y += a.usefulLifeYears) {
            const inflationAdj = Math.pow(1 + inflationRate, y);
            replacements.push({
                year: y,
                assetName: a.name,
                category: a.category,
                count: a.count,
                cost: Math.round(a.totalAcquisitionCost * inflationAdj),
            });
        }
    }
    replacements.sort((a, b) => a.year - b.year);

    // Total lifecycle cost
    const totalReplacementCost = replacements.reduce((s, r) => s + r.cost, 0);
    const totalLifecycleCost25yr = totalAcquisitionCost + totalReplacementCost;

    // Annual average CAPEX refresh
    const annualCapexRefresh = totalReplacementCost / projectionYears;

    // NPV of replacements at 8% discount rate
    const discountRate = 0.08;
    const npvOfReplacements = replacements.reduce((npv, r) => {
        return npv + r.cost / Math.pow(1 + discountRate, r.year);
    }, 0);

    // --- Health Scores ---
    const assumedAvgAge = 5; // assume assets are ~5 years old on average
    const healthScores: AssetHealthScore[] = assets.map(a => {
        const remainingLife = Math.max(0, a.usefulLifeYears - assumedAvgAge);
        const healthPct = Math.round((remainingLife / a.usefulLifeYears) * 100);
        const ageRatio = Math.min(1, assumedAvgAge / a.usefulLifeYears);
        const failureProbability = Math.min(0.95, 0.02 * Math.exp(0.3 * ageRatio * 5));
        const riskLevel: AssetHealthScore['riskLevel'] =
            healthPct > 75 ? 'low' : healthPct > 50 ? 'medium' : healthPct > 25 ? 'high' : 'critical';
        return {
            assetId: a.assetId,
            name: a.name,
            category: a.category,
            healthPct,
            riskLevel,
            failureProbability: Math.round(failureProbability * 1000) / 1000,
            remainingLife,
        };
    });

    // --- Book Value Curve ---
    const bookValueCurve: { year: number; bookValue: number; cumulativeReplacement: number }[] = [];
    let cumReplacement = 0;
    for (let y = 0; y <= projectionYears; y++) {
        const bv = y === 0 ? totalAcquisitionCost : (schedule[y - 1]?.bookValue ?? 0);
        const yearReplacements = replacements.filter(r => r.year === y);
        cumReplacement += yearReplacements.reduce((s, r) => s + r.cost, 0);
        bookValueCurve.push({
            year: y,
            bookValue: Math.round(bv),
            cumulativeReplacement: Math.round(cumReplacement),
        });
    }

    // --- Financial Impact ---
    // Early replacement: shift 2 years earlier
    const earlyReplacementNpv = assets.reduce((npv, a) => {
        for (let y = Math.max(1, a.usefulLifeYears - 2); y <= projectionYears; y += a.usefulLifeYears) {
            const inflationAdj = Math.pow(1 + inflationRate, y);
            npv += (a.totalAcquisitionCost * inflationAdj) / Math.pow(1 + discountRate, y);
        }
        return npv;
    }, 0);

    // Deferred replacement: shift 2 years later with 15% penalty per year of deferral
    const deferredReplacementNpv = assets.reduce((npv, a) => {
        for (let y = a.usefulLifeYears + 2; y <= projectionYears + 2; y += a.usefulLifeYears) {
            if (y > projectionYears) break;
            const inflationAdj = Math.pow(1 + inflationRate, y);
            const penaltyFactor = 1 + 0.15 * 2; // 15% penalty per year of deferral, 2 years
            npv += (a.totalAcquisitionCost * inflationAdj * penaltyFactor) / Math.pow(1 + discountRate, y);
        }
        return npv;
    }, 0);

    // Maintenance cost of aging: 2% of acquisition * (age/life)^2 per year, sum at year 5
    const maintenanceCostOfAging = assets.reduce((total, a) => {
        const ageRatio = Math.min(1, assumedAvgAge / a.usefulLifeYears);
        return total + 0.02 * a.totalAcquisitionCost * ageRatio * ageRatio;
    }, 0);

    const savingsFromEarly = deferredReplacementNpv - earlyReplacementNpv;

    const financialImpact = {
        earlyReplacementNpv: Math.round(earlyReplacementNpv),
        deferredReplacementNpv: Math.round(deferredReplacementNpv),
        maintenanceCostOfAging: Math.round(maintenanceCostOfAging),
        savingsFromEarly: Math.round(savingsFromEarly),
    };

    // --- Risk Events ---
    const riskEvents: { year: number; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }[] = [];

    // Group replacements by year to find multi-replacement years
    const replByYear: Record<number, typeof replacements> = {};
    replacements.forEach(r => {
        if (!replByYear[r.year]) replByYear[r.year] = [];
        replByYear[r.year].push(r);
    });

    // Find peak spend year
    let peakSpendYear = 0;
    let peakSpendAmount = 0;
    for (const [yr, items] of Object.entries(replByYear)) {
        const total = items.reduce((s, r) => s + r.cost, 0);
        if (total > peakSpendAmount) {
            peakSpendAmount = total;
            peakSpendYear = Number(yr);
        }
    }

    // Generate risk events
    for (const [yr, items] of Object.entries(replByYear)) {
        const y = Number(yr);
        const total = items.reduce((s, r) => s + r.cost, 0);
        const hasCriticalPower = items.some(r => r.category === 'Critical Power');
        const hasCooling = items.some(r => r.category === 'Cooling');

        if (hasCriticalPower && items.length >= 2) {
            riskEvents.push({
                year: y,
                description: `Multiple critical power replacements (${items.filter(r => r.category === 'Critical Power').map(r => r.assetName).join(', ')}) — high outage risk`,
                severity: 'critical',
            });
        } else if (hasCriticalPower) {
            riskEvents.push({
                year: y,
                description: `${items.filter(r => r.category === 'Critical Power').map(r => `${r.count}x ${r.assetName}`).join(', ')} replacement due`,
                severity: 'high',
            });
        }

        if (hasCooling && items.filter(r => r.category === 'Cooling').length >= 2) {
            riskEvents.push({
                year: y,
                description: `Multiple cooling asset replacements — thermal management risk`,
                severity: 'high',
            });
        }

        if (y === peakSpendYear) {
            riskEvents.push({
                year: y,
                description: `Peak CAPEX year — ${fmtMoney(peakSpendAmount)} replacement spend`,
                severity: 'medium',
            });
        }

        if (items.length >= 4) {
            riskEvents.push({
                year: y,
                description: `${items.length} concurrent asset replacements — logistical & procurement risk`,
                severity: 'medium',
            });
        }
    }

    // Add early warning events
    for (const a of assets) {
        if (a.usefulLifeYears <= 10) {
            riskEvents.push({
                year: a.usefulLifeYears - 1,
                description: `${a.name} approaching end-of-life — begin procurement planning`,
                severity: 'low',
            });
        }
    }

    riskEvents.sort((a, b) => a.year - b.year || (a.severity === 'critical' ? -1 : 1));

    // --- Portfolio Summary ---
    // Weighted average age (assume all assets at year 5 of their life)
    const totalUnits = assets.reduce((s, a) => s + a.count, 0);
    const weightedAge = assets.reduce((s, a) => s + (assumedAvgAge * a.count), 0);
    const avgAssetAge = totalUnits > 0 ? Math.round((weightedAge / totalUnits) * 10) / 10 : 0;

    // Oldest asset = one with shortest remaining useful life
    const sortedByRemaining = [...assets].sort((a, b) => (a.usefulLifeYears - assumedAvgAge) - (b.usefulLifeYears - assumedAvgAge));
    const oldestAsset = sortedByRemaining.length > 0 ? sortedByRemaining[0].name : 'N/A';

    // Next replacement
    const nextRepl = replacements.length > 0 ? replacements[0] : null;
    const nextReplacement = nextRepl
        ? { name: nextRepl.assetName, year: nextRepl.year, cost: nextRepl.cost }
        : { name: 'N/A', year: 0, cost: 0 };

    const portfolioSummary = {
        avgAssetAge,
        oldestAsset,
        nextReplacement,
        peakSpendYear,
        peakSpendAmount: Math.round(peakSpendAmount),
    };

    return {
        assets,
        totalAcquisitionCost,
        annualDepreciationSchedule: schedule,
        replacementTimeline: replacements,
        totalLifecycleCost25yr: Math.round(totalLifecycleCost25yr),
        annualCapexRefresh: Math.round(annualCapexRefresh),
        npvOfReplacements: Math.round(npvOfReplacements),
        depreciationMethod,
        projectionYears,
        healthScores,
        financialImpact,
        bookValueCurve,
        riskEvents,
        portfolioSummary,
    };
}
