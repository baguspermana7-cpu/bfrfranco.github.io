/* ─── MODULE PROVENANCE (single source of truth) ─────────────────────────────
 * One map from a nav/module id to the shared engine that computes it. Rendered
 * as a tooltip on each nav item + dashboard card + PDF footer so the wiring is
 * VISIBLE — proving each module's numbers come FROM the shared engine, not from
 * hardcoded DCMOC constants. Single map ⇒ label + card badge + PDF all agree.
 *
 * `engine` = which browser global computes it (via src/lib/rz-engine.ts bridge).
 * `fn`     = the engine function(s) invoked.
 * `status` = 'engine'  → fully sourced from the engine
 *            'partial' → engine-sourced core + finer-grained DCMOC-local detail
 *            'local'   → not yet wired (still DCMOC-local; scheduled)
 * ──────────────────────────────────────────────────────────────────────────── */

export type NavId =
    | 'sim' | 'capex' | 'staff' | 'maint' | 'risk' | 'carbon' | 'finance'
    | 'invest' | 'benchmark' | 'montecarlo' | 'portfolio' | 'capacity'
    | 'phased-finance' | 'tax' | 'disaster' | 'grid' | 'talent' | 'compliance'
    | 'asset-lifecycle' | 'cbm' | 'fuel-gen' | 'strategic' | 'report' | 'faq';

export interface ModuleSource {
    engine: 'RZEngine' | 'FINEngine' | 'RZEngine+FINEngine' | null;
    fn: string;
    label: string;
    status: 'engine' | 'partial' | 'local';
}

export const MODULE_SOURCES: Record<NavId, ModuleSource> = {
    // ── engine-wired ──────────────────────────────────────────────────────────
    finance: {
        engine: 'RZEngine',
        fn: 'models.roi.irr / models.roi.npv',
        label: 'Financial — IRR & NPV computed by the shared RZEngine (models.roi), the same math the site-wide calculators use. Not hardcoded in DCMOC.',
        status: 'engine',
    },
    capex: {
        engine: 'RZEngine',
        fn: 'models.capex.detailed / data.capexDetail',
        label: 'CAPEX Config — cost factors, multipliers & PUE sourced from RZEngine.data.capexDetail (the capex-calculator engine). City table & country profiles stay local for finer granularity.',
        status: 'partial',
    },
    carbon: {
        engine: 'RZEngine',
        fn: 'data.refrigerants / data.carbon.offsetPrice',
        label: 'Carbon / ESG — refrigerant GWP table & carbon offset price sourced from RZEngine.data. Scope 1/2/3 roll-up computed locally (promotion to the engine scheduled).',
        status: 'partial',
    },

    // ── engine-sourced financial core (via the shared calculateIRR/calculateFinancials
    //    → RZEngine.models.roi) + domain-specific detail still local ──────────────
    invest: { engine: 'RZEngine', fn: 'models.roi.irr (levered)', label: 'Investment — levered equity IRR/NPV computed by the shared RZEngine (models.roi); debt schedule & exit-multiple logic local. Not investment advice.', status: 'partial' },
    montecarlo: { engine: 'RZEngine', fn: 'models.roi (per-trial NPV/IRR)', label: 'Monte Carlo — each trial’s NPV/IRR is computed by the shared RZEngine (models.roi via calculateFinancials); the stochastic sampler is local (promotion to models.sim.monteCarlo scheduled).', status: 'partial' },
    portfolio: { engine: 'RZEngine', fn: 'models.roi', label: 'Portfolio — aggregates engine-sourced (RZEngine.models.roi) per-project financials.', status: 'partial' },
    'phased-finance': { engine: 'RZEngine', fn: 'models.roi', label: 'Phased Finance — phased NPV/IRR computed by the shared RZEngine (models.roi).', status: 'partial' },
    benchmark: { engine: 'RZEngine', fn: 'models.roi / data.markets', label: 'Benchmarks — financial metrics via RZEngine.models.roi; market data via RZEngine.data.markets (fuller market wiring scheduled).', status: 'partial' },
    tax: { engine: 'RZEngine', fn: 'models.roi (after-tax cashflows)', label: 'Tax & Incentives — after-tax NPV/IRR via the shared RZEngine (models.roi); the incentive rule-set is local (promotion to models.tax scheduled).', status: 'partial' },

    // ── not yet wired (scheduled — see plan phases) ───────────────────────────
    sim: { engine: null, fn: '—', label: 'Staff Model Config — master inputs; staffing math scheduled to source from RZEngine.models.workforce.', status: 'local' },
    staff: { engine: null, fn: 'models.workforce.*', label: 'Staffing — scheduled to source from RZEngine.models.workforce (hiringPlan / attritionCost).', status: 'local' },
    maint: { engine: null, fn: 'models.maintenance.*', label: 'Maintenance — scheduled to source from a promoted RZEngine.models.maintenance.', status: 'local' },
    risk: { engine: null, fn: 'models.risk.geo', label: 'Risk Analysis — scheduled to source from a promoted RZEngine.models.risk (geo rules).', status: 'local' },
    capacity: { engine: null, fn: 'models.capacity.plan', label: 'Capacity Plan — scheduled to source from a promoted RZEngine.models.capacity.', status: 'local' },
    disaster: { engine: null, fn: 'models.risk.geo', label: 'Disaster Risk — scheduled to source from a promoted RZEngine.models.risk (geo/seismic/flood).', status: 'local' },
    grid: { engine: null, fn: 'models.grid.reliability', label: 'Grid Reliability — scheduled to source from a promoted RZEngine.models.grid.', status: 'local' },
    talent: { engine: null, fn: '—', label: 'Talent Index — scheduled to source from RZEngine.data (labor/talent factors).', status: 'local' },
    compliance: { engine: null, fn: 'models.compliance.frameworks', label: 'Compliance — scheduled to source from a promoted RZEngine.models.compliance (50+ country frameworks).', status: 'local' },
    'asset-lifecycle': { engine: null, fn: 'models.asset.lifecycle', label: 'Asset Lifecycle — scheduled to source from a promoted RZEngine.models.asset.', status: 'local' },
    cbm: { engine: null, fn: '—', label: 'CBM / DCIM — scheduled to source from a promoted RZEngine.models.asset (health index).', status: 'local' },
    'fuel-gen': { engine: null, fn: 'models.fuel.genSizing', label: 'Fuel & Generator — scheduled to source from a promoted RZEngine.models.fuel.', status: 'local' },
    strategic: { engine: null, fn: '—', label: 'Strategic Planning — scheduled to aggregate engine-sourced scenarios.', status: 'local' },

    // ── non-calculating ───────────────────────────────────────────────────────
    report: { engine: null, fn: '—', label: 'Reports — renders engine-sourced results to PDF; no independent math.', status: 'engine' },
    faq: { engine: null, fn: '—', label: 'FAQ / Manual — documentation.', status: 'engine' },
};

/** Convenience: the tooltip string for a nav id (empty if unknown). */
export function moduleSourceLabel(id: string): string {
    return (MODULE_SOURCES as Record<string, ModuleSource>)[id]?.label ?? '';
}
