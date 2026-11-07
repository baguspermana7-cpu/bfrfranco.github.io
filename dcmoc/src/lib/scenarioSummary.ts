/* ─── Scenario summary — ONE source for the KPIs a saved scenario carries ────
 * v3.25.0. Before this, every save path wrote `monthlyOpex: 0` (Shell quick-save,
 * Architecture save), so the Scenarios table and Scenario Comparison compared
 * "$0" OPEX and normalised the cost score on it. Now every save (and the
 * presentation presets) computes the same engine figures the Dashboard shows:
 * CAPEX total (capex store), OPEX /mo = models.opex.fullBreakdown ÷ 12 (the
 * single-source call in value-trace), staff = effective headcount, PUE =
 * DATA.pueMatrix[cooling][tier], IRR/NPV = finScreening (results engine).
 * ──────────────────────────────────────────────────────────────────────── */

import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { rzModels, rzData } from '@/lib/rz-engine';
import { getPUE } from '@/constants/pue';
import { calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';
import { finScreening } from '@/components/modules/results/dimension-explain';
import type { SavedScenario } from '@/store/scenario';

export function effectiveHeadcounts(): [number, number, number, number, number] {
    const i = useSimulationStore.getState().inputs;
    if (!i.staffingAutoMode) return [i.headcount_ShiftLead, i.headcount_Engineer, i.headcount_Technician, i.headcount_Admin, i.headcount_Janitor];
    const a = calculateAutoHeadcount(i.itLoad, i.tierLevel, i.shiftModel,
        i.staffingModel === 'outsourced' ? 'outsourced' : i.staffingModel, i.maintenanceModel, i.maintenanceStrategy, i.hybridRatio ?? 0.5);
    return [a.headcounts['shift-lead'], a.headcounts['engineer'], a.headcounts['technician'], a.headcounts['admin'], a.headcounts['janitor']];
}

export function designPue(): number {
    const i = useSimulationStore.getState().inputs;
    const m = (rzData() as { pueMatrix?: Record<string, Record<string, number>> } | null)?.pueMatrix;
    return m?.[i.coolingType]?.['tier' + i.tierLevel] ?? getPUE(i.coolingType);
}

/** Annual OPEX, identical call to value-trace `dashOpexAnnual` (janitor excluded from in-house FTE). */
export function annualOpex(): number | null {
    try {
        const m = (rzModels() as { opex?: { fullBreakdown?: (i: Record<string, unknown>) => { total?: number } } } | null)?.opex;
        if (!m?.fullBreakdown) return null;
        const sim = useSimulationStore.getState();
        const i = sim.inputs;
        const hc = effectiveHeadcounts();
        const fb = m.fullBreakdown({
            itMw: i.itLoad / 1000, pue: designPue(), countryCode: sim.selectedCountry?.id || 'US',
            capex: useCapexStore.getState().results?.total ?? 0,
            cooling: i.coolingType, maintenanceStrategy: 'standard_annual_compliance', headcount: hc[0] + hc[1] + hc[2] + hc[3],
        });
        const v = fb?.total;
        return v != null && Number.isFinite(v) ? Math.round(v) : null;
    } catch { return null; }
}

export function buildScenarioSummary(): SavedScenario['summary'] {
    const sim = useSimulationStore.getState();
    const capexTotal = useCapexStore.getState().results?.total ?? 0;
    const hc = effectiveHeadcounts();
    const pue = designPue();
    const opexYr = annualOpex();
    let irr: number | undefined, npv: number | undefined;
    try {
        const fin = capexTotal > 0 ? finScreening(sim.inputs.itLoad, pue, sim.selectedCountry?.id ?? 'US', capexTotal) : null;
        if (fin) { irr = fin.irr ?? undefined; npv = fin.npv; }
    } catch { /* screening optional */ }
    return {
        monthlyOpex: opexYr != null ? Math.round(opexYr / 12) : 0,
        annualCapex: capexTotal,
        totalStaff: hc.reduce((s, x) => s + x, 0),
        pue,
        irr, npv,
    };
}
