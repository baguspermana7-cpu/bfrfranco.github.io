import { CountryProfile } from '@/constants/countries';
import { ASSETS } from '@/constants/assets';
import { generateAssetCounts, AssetCount } from '@/lib/AssetGenerator';

export type DepreciationMethod = 'straight-line' | 'declining-balance' | 'sum-of-years';

export interface AssetLifecycleInput {
    country: CountryProfile;
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: string;
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
    const { country, itLoadKw, tierLevel, coolingType, depreciationMethod, projectionYears: projYears } = input;
    const projectionYears = projYears ?? 25;
    const inflationRate = country.economy.inflationRate;

    // Generate asset counts (AssetGenerator expects tier 3|4, map tier 2 to 3)
    const effectiveTier: 3 | 4 = tierLevel === 2 ? 3 : tierLevel as 3 | 4;
    const coolingMap: 'air' | 'pumped' = coolingType === 'liquid' || coolingType === 'rdhx' ? 'pumped' : 'air';
    const assetCounts = generateAssetCounts(itLoadKw, effectiveTier, coolingMap, Math.ceil(itLoadKw * 0.6));

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
    };
}
