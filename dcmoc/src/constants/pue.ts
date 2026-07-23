// ─── CANONICAL PUE VALUES ────────────────────────────────────
// DELEGATED to shared RZEngine v2.3.0 (DATA.pueMatrix, Uptime Global PUE
// Survey 2026, tier x cooling): DCMOC reads the tier-3 column at calc time.
// Same-fact reconciliation: engine liquid tier3 = 1.15 (was 1.08 local).
// The local table below is a FALLBACK ONLY for when the engine is absent.

import { rzData } from '@/lib/rz-engine';

export const PUE_BY_COOLING: Record<string, number> = {
    air: 1.50,    // Typical CRAC/CRAH air-cooled — matches engine DATA.pueMatrix.air.tier3
    inrow: 1.27,  // In-row close-coupled cooling — matches engine DATA.pueMatrix.inrow.tier3
    rdhx: 1.18,   // Rear-door heat exchanger — matches engine DATA.pueMatrix.rdhx.tier3
    liquid: 1.15, // Direct liquid cooling — matches engine DATA.pueMatrix.liquid.tier3
};

export const DEFAULT_PUE = 1.50; // mirrors PUE_BY_COOLING.air (engine air tier3)

export function getPUE(coolingType: string): number {
    // Engine-owned tier-3 PUE (DATA.pueMatrix[type].tier3), local fallback.
    const enginePue = rzData().pueMatrix?.[coolingType]?.tier3;
    if (typeof enginePue === 'number') return enginePue;
    return PUE_BY_COOLING[coolingType] ?? DEFAULT_PUE;
}
