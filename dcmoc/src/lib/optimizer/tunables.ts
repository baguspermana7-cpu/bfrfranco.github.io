/* ─── Optimizer tunables registry (Workstream D) ─────────────────────────────
 * OWNER MANDATE: Auto-optimize may move ONLY fine-tune parameters ("margin
 * atau sejenisnya") — NEVER requirement base data. This file is the reviewable
 * allowlist: every tunable declares its store, band, and what it affects.
 * The solver refuses anything not listed here; LOCKED names are asserted.
 * ──────────────────────────────────────────────────────────────────────── */

export interface TunableSpec {
    key: string;
    label: string;
    store: 'simulation' | 'capex' | 'requirements-business';
    path: string;              // store field
    min: number;
    max: number;
    step: number;
    unit: string;
    affects: string[];         // metrics this lever moves
    note?: string;
}

/** The allowlist — Auto may move ONLY these, inside their bands. */
export const TUNABLES: TunableSpec[] = [
    {
        key: 'revenuePerKwMonth', label: 'Revenue price', store: 'simulation', path: 'revenuePerKwMonth',
        min: 100, max: 300, step: 1, unit: '$/kW·mo',
        affects: ['blendedIrr', 'npv', 'pi', 'payback'],
        note: 'Colo market pricing band — a commercial fine-tune, not a design change.',
    },
    {
        key: 'contingencyPct', label: 'CAPEX contingency', store: 'capex', path: 'contingency',
        min: 5, max: 15, step: 0.5, unit: '%',
        affects: ['totalCapex', 'npv', 'irr'],
        note: 'AACE Class-4 contingency band; below 5% is dishonest, above 15% is padding.',
    },
    {
        key: 'designMarginPct', label: 'Design margin', store: 'requirements-business', path: 'designMarginPct',
        min: 5, max: 30, step: 1, unit: '%',
        affects: ['utilization', 'capacity headroom', 'capex'],
        note: 'Owner-allowed "margin" fine-tune — moves utilization bands + facility sizing.',
    },
    {
        key: 'hybridRatio', label: 'Maintenance in-house share', store: 'simulation', path: 'hybridRatio',
        min: 0, max: 1, step: 0.05, unit: 'fraction',
        affects: ['maintenance cost', 'headcount', 'MTTR'],
    },
];

/** Requirement BASE DATA the optimizer must NEVER touch (asserted before Apply). */
export const LOCKED_FIELDS = [
    'itLoad', 'tierLevel', 'coolingType', 'powerRedundancy', 'country', 'selectedCountry',
    'useCase', 'workloadMix', 'growth', 'capacityPhases', 'rackDensity', 'gridVoltage',
] as const;

export function isTunable(key: string): boolean {
    return TUNABLES.some((t) => t.key === key);
}

export function assertNotLocked(patch: Record<string, unknown>): void {
    for (const k of Object.keys(patch)) {
        if ((LOCKED_FIELDS as readonly string[]).includes(k)) {
            throw new Error(`Optimizer guard: "${k}" is requirement base data — LOCKED.`);
        }
    }
}
