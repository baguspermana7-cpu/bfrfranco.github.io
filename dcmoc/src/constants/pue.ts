// ─── CANONICAL PUE VALUES ────────────────────────────────────
// Single source of truth for Power Usage Effectiveness by cooling type.
// Updated to 2026 values (Uptime Institute 2025 / ASHRAE TC 9.9 / industry benchmarks).
// Air-cooled median ~1.4-1.5; in-row ~1.25-1.3; RDHx ~1.15-1.2; liquid/immersion ~1.05-1.1
// AI/HPC liquid-cooled best-in-class facilities achieving 1.08-1.12 in 2025.

export const PUE_BY_COOLING: Record<string, number> = {
    air: 1.42,    // Typical CRAC/CRAH air-cooled, updated 2026 — median Tier III
    inrow: 1.27,  // In-row close-coupled cooling, hot/cold aisle containment
    rdhx: 1.18,   // Rear-door heat exchanger, passive/active
    liquid: 1.08, // Direct liquid cooling (DLC) / immersion; AI/HPC clusters
};

export const DEFAULT_PUE = 1.42;

export function getPUE(coolingType: string): number {
    return PUE_BY_COOLING[coolingType] ?? DEFAULT_PUE;
}
