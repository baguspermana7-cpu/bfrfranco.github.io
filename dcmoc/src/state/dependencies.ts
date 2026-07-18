/* ─── DC-OS DATA DEPENDENCY MAP (Phase 0) ────────────────────────────────────
 * Explicit, auditable contract of "when param X changes, artifacts Y recompute".
 *
 * TRACKER DECISION (documented per the owner's STEP 1.3):
 * enforcement is by SELECTOR HOOKS, not an imperative event bus. Every derived
 * artifact is a pure function of registry params; components consume it via
 * useDerived(compute, deps). zustand guarantees any component subscribed to a
 * param re-renders when it changes, which re-runs the adapter — charts, the
 * Gantt, and the architecture diagram therefore update automatically and
 * synchronously. DEP_MAP makes that implicit graph explicit and testable:
 * the dev-time validator below warns on unknown ids, and each page's
 * useDerived deps are expected to match its DEP_MAP rows.
 *
 * This EXTENDS the existing engine-level DAG (src/lib/orchestrator/
 * dependencyGraph.ts DIGITAL_THREAD) one level down to named parameters —
 * it does not replace it.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { REGISTRY, type ParamId, getParam } from '@/state/registry';

/** Derived-artifact ids, namespaced `engine.artifact`. */
export type DerivedId =
    | 'req.summaryValidation'
    | 'site.scores'
    | 'arch.diagram' | 'arch.facilityLoadMw' | 'arch.pue' | 'arch.complexity'
    | 'arch.thermal' | 'arch.topology' | 'arch.equipCounts' | 'arch.validation'
    | 'arch.loadBreakdown' | 'arch.bom' | 'arch.summary'
    | 'cap.forecast' | 'cap.utilization' | 'cap.equipmentTable'
    | 'capex.results' | 'capex.riskBand' | 'capex.tornado'
    | 'constr.plannedSchedule' | 'constr.evm' | 'construction.gantt'
    | 'cx.program' | 'cx.readiness'
    | 'ops.derivedKpis' | 'ops.shiftOverview' | 'ops.assetHealth'
    | 'financial.budgetBaseline' | 'financial.cashFlowPlan' | 'financial.opexYtd' | 'financial.evm'
    | 'results.scorecard';

const DERIVED_IDS: ReadonlySet<string> = new Set<DerivedId>([
    'req.summaryValidation', 'site.scores',
    'arch.diagram', 'arch.facilityLoadMw', 'arch.pue', 'arch.complexity',
    'arch.thermal', 'arch.topology', 'arch.equipCounts', 'arch.validation',
    'arch.loadBreakdown', 'arch.bom', 'arch.summary',
    'cap.forecast', 'cap.utilization', 'cap.equipmentTable',
    'capex.results', 'capex.riskBand', 'capex.tornado',
    'constr.plannedSchedule', 'constr.evm', 'construction.gantt',
    'cx.program', 'cx.readiness',
    'ops.derivedKpis', 'ops.shiftOverview', 'ops.assetHealth',
    'financial.budgetBaseline', 'financial.cashFlowPlan', 'financial.opexYtd', 'financial.evm',
    'results.scorecard',
]);

/** Param → derived artifacts that must recompute when it changes. */
export const DEP_MAP: Partial<Record<ParamId, DerivedId[]>> = {
    'sim.itLoad': [
        'req.summaryValidation', 'arch.facilityLoadMw', 'arch.equipCounts', 'arch.diagram',
        'arch.bom', 'arch.loadBreakdown', 'cap.forecast', 'cap.utilization', 'cap.equipmentTable',
        'capex.results', 'capex.riskBand', 'constr.plannedSchedule', 'construction.gantt',
        'cx.program', 'ops.derivedKpis', 'financial.budgetBaseline', 'results.scorecard',
    ],
    'sim.tierLevel': [
        'req.summaryValidation', 'arch.pue', 'arch.topology', 'arch.complexity', 'arch.diagram',
        'arch.validation', 'cap.forecast', 'capex.results', 'cx.program',
        'ops.derivedKpis', 'results.scorecard',
    ],
    'sim.coolingType': [
        'req.summaryValidation', 'arch.pue', 'arch.facilityLoadMw', 'arch.thermal',
        'arch.complexity', 'arch.diagram', 'arch.validation', 'arch.bom',
        'cap.utilization', 'capex.results', 'capex.tornado', 'cx.program',
        'ops.derivedKpis', 'results.scorecard',
    ],
    'sim.powerRedundancy': [
        'arch.complexity', 'arch.diagram', 'arch.validation', 'arch.equipCounts',
        'cap.equipmentTable', 'cx.program', 'results.scorecard',
    ],
    'sim.buildingSize': ['cap.utilization'],
    'sim.baseYear': ['cap.forecast', 'ops.derivedKpis', 'ops.assetHealth', 'financial.opexYtd'],
    'sim.shiftModel': ['ops.shiftOverview'],
    'capex.redundancy': ['capex.results', 'capex.riskBand'],
    'capex.fuelHours': ['arch.diagram', 'capex.results'],
    'capex.contingency': ['capex.results', 'financial.budgetBaseline'],
    'capex.designFee': ['capex.results', 'financial.budgetBaseline'],
    'capex.pmFee': ['capex.results', 'financial.budgetBaseline'],
    'capex.projYear': ['capex.results', 'capex.riskBand'],
    'capex.rackType': ['capex.results', 'arch.equipCounts', 'cap.equipmentTable'],
    'req.gridVoltage': ['arch.diagram'],
    'req.useCase': ['req.summaryValidation', 'arch.summary', 'results.scorecard'],
    'req.avgRackDensityKw': ['req.summaryValidation', 'arch.equipCounts', 'arch.diagram', 'arch.bom', 'cap.equipmentTable'],
    /* Owner mandate: margin flows into cost + financial + downstream. */
    'req.designMarginPct': ['capex.results', 'arch.summary', 'financial.budgetBaseline', 'cap.forecast', 'results.scorecard'],
};

/**
 * Subscribe to exactly `deps` params, then memo-compute a derived artifact.
 * The compute fn receives the non-React `getParam` accessor so adapters stay
 * pure. Re-runs iff one of the subscribed param values changes.
 */
export function useDerived<T>(compute: (get: typeof getParam) => T, deps: ParamId[]): T {
    // Subscribe to each dep (hook order is stable as long as `deps` is stable
    // per call site — pass a literal array).
    const values = deps.map((id) => REGISTRY[id].useValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return React.useMemo(() => compute(getParam), values);
}

/* ── dev-time validation (STEP 3 integrity): unknown ids warn loudly ── */
if (process.env.NODE_ENV !== 'production') {
    for (const [pid, deps] of Object.entries(DEP_MAP)) {
        if (!(pid in REGISTRY)) {
            // eslint-disable-next-line no-console
            console.warn(`[DEP_MAP] unknown param id: ${pid}`);
        }
        (deps || []).forEach((d) => {
            if (!DERIVED_IDS.has(d)) {
                // eslint-disable-next-line no-console
                console.warn(`[DEP_MAP] unknown derived id: ${d} (from ${pid})`);
            }
        });
    }
}
