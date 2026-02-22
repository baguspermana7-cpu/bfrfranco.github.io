// ─── CANONICAL PUE VALUES ────────────────────────────────────
// Single source of truth for Power Usage Effectiveness by cooling type.
// Based on modern 2025 standards (Uptime Institute / industry benchmarks).

export const PUE_BY_COOLING: Record<string, number> = {
    air: 1.35,
    inrow: 1.28,
    rdhx: 1.18,
    liquid: 1.08,
};

export const DEFAULT_PUE = 1.35;

export function getPUE(coolingType: string): number {
    return PUE_BY_COOLING[coolingType] ?? DEFAULT_PUE;
}
