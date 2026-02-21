
import { ASSETS, AssetTemplate } from '@/constants/assets';

export interface AssetCount {
    assetId: string;
    count: number;
    isManual: boolean; // True if user overrode the auto-count
}

export const generateAssetCounts = (
    itLoadKw: number,
    tierLevel: 3 | 4,
    coolingType: 'air' | 'pumped',
    buildingAreaM2: number,
    // Phase 12 Updates
    coolingTopology: 'in-row' | 'perimeter' | 'dlc' = 'perimeter',
    powerRedundancy: 'N+1' | '2N' | '2N+1' = '2N'
): AssetCount[] => {
    const counts: AssetCount[] = [];

    // Helper for redundancy
    const applyRedundancy = (base: number, type: 'N+1' | '2N' | '2N+1') => {
        if (type === 'N+1') return base + 1;
        if (type === '2N') return base * 2;
        if (type === '2N+1') return (base * 2) + 1;
        return base + 1;
    };

    ASSETS.forEach((asset) => {
        let count = 0;

        switch (asset.id) {
            // --- CRITICAL POWER ---
            case 'gen-set':
                // 2.5MW gensets. 
                const requiredGenPower = itLoadKw * 1.5; // Safety factor + cooling + losses
                const genCap = 2500;
                const baseGen = Math.ceil(requiredGenPower / genCap);
                count = applyRedundancy(baseGen, powerRedundancy === '2N+1' ? 'N+1' : 'N+1'); // Gen usually N+1 unless explicitly 2N
                if (tierLevel === 4) count = applyRedundancy(baseGen, '2N'); // Tier 4 Gen usually 2N
                break;

            case 'ups-module':
                // 500kVA modules.
                const upsCap = 450; // kW (pf 0.9)
                const baseUps = Math.ceil(itLoadKw / upsCap);
                count = applyRedundancy(baseUps, powerRedundancy);
                break;

            case 'lv-switchgear':
                // 1 Main Switchboard per 2.5MW block approx
                count = Math.ceil(itLoadKw / 2500) * (powerRedundancy === 'N+1' ? 1 : 2);
                break;

            case 'transformer':
                // 2.5MVA Trafo
                const txCap = 2500;
                const baseTx = Math.ceil((itLoadKw * 1.3) / txCap);
                count = applyRedundancy(baseTx, powerRedundancy === 'N+1' ? 'N+1' : '2N');
                break;

            // --- COOLING ---
            case 'chiller-air':
                if (coolingType === 'air' && coolingTopology !== 'dlc') {
                    // 1000kW Chillers. N+1.
                    const coolingLoad = itLoadKw * 1.3; // PUE overhead roughly
                    const chilCap = 1000;
                    const baseChil = Math.ceil(coolingLoad / chilCap);
                    count = baseChil + 1;
                }
                break;

            case 'pac-unit':
                // Renamed logic based on topology
                // If In-Row, unit capacity is smaller (e.g. 40kW vs 100kW CRAC)
                if (coolingTopology === 'perimeter') {
                    const cracCap = 100;
                    const baseCrac = Math.ceil(itLoadKw / cracCap);
                    count = Math.ceil(baseCrac * 1.2); // N+20%
                } else if (coolingTopology === 'in-row') {
                    const inRowCap = 40; // Smaller capacity per unit
                    const baseInRow = Math.ceil(itLoadKw / inRowCap);
                    count = Math.ceil(baseInRow * 1.25); // N+25% for distribution
                } else {
                    count = 0; // DLC doesn't use CRACs
                }
                break;

            case 'fcu':
                // 1 per 50m2 of office space (Assuming 20% of building is office/corridor)
                const officeArea = buildingAreaM2 * 0.2;
                count = Math.ceil(officeArea / 50);
                break;

            // --- FIRE & SAFETY ---
            case 'fire-suppression':
                // 1 cylinder bank per Data Hall (Assume 1 hall per 1000kW or 500m2)
                count = Math.ceil(itLoadKw / 1000);
                break;

            case 'vesda':
                // 1 detector per 200m2 of white space
                const whiteSpace = buildingAreaM2 * 0.6; // 60% white space
                count = Math.ceil(whiteSpace / 200);
                break;

            case 'fire-panel':
                count = 1; // Main FIP
                if (buildingAreaM2 > 5000) count += 1; // Networked panel
                break;

            // --- FUEL ---
            case 'fuel-polisher':
                count = Math.ceil(itLoadKw / 5000); // 1 per 5MW block
                if (count < 1) count = 1;
                break;

            case 'bulk-tank':
                // 20,000L tanks. Depends on fuel hours (e.g. 48h).
                // Approx 0.25 L/kWh -> Load * 48 * 0.25
                const fuelNeeded = itLoadKw * 48 * 0.25;
                count = Math.ceil(fuelNeeded / 20000);
                break;

            // --- WATER ---
            case 'sand-filter':
                count = coolingType === 'air' ? 0 : 2; // Only for water cooled mostly, but maybe makeup water
                break;

            case 'dosing-pump':
                count = coolingType === 'air' ? 0 : 4;
                break;

            // --- IT & SECURITY ---
            case 'bms-server':
                count = 1; // Redundancy?
                if (tierLevel === 4) count = 2;
                break;

            case 'cctv':
                // 1 camera per 50m2 total area (perimeter + internal)
                count = Math.ceil(buildingAreaM2 / 50);
                break;

            case 'access-control':
                // 1 per 100m2
                count = Math.ceil(buildingAreaM2 / 100);
                break;

            case 'boom-gate':
                // 2 per site minimum (Entry/Exit) + turnstiles
                count = 2 + Math.ceil(buildingAreaM2 / 2000);
                break;

            // --- CIVIL & GENERAL ---
            case 'loading-dock':
                // 1 per 2.5MW block roughly (logistics volume)
                count = Math.ceil(itLoadKw / 2500);
                if (count < 1) count = 1;
                break;

            case 'mewp':
                // 1 per site, 2 if large
                count = buildingAreaM2 > 5000 ? 2 : 1;
                break;

            case 'vent-fan':
                // 1 per 200m2 (Plant rooms, toilets, battery rooms)
                count = Math.ceil(buildingAreaM2 / 200);
                break;

            // --- WATER ---
            case 'ro-unit':
                // Only if water cooled
                count = coolingType === 'air' ? 0 : 2;
                break;

            default:
                count = 0;
        }

        if (count > 0) {
            counts.push({
                assetId: asset.id,
                count: count,
                isManual: false
            });
        }
    });

    return counts;
};
