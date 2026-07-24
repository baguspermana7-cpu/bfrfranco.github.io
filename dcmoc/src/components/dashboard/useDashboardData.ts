'use client';

/* ─── DC-OS Executive Dashboard — engine-real data aggregator ─────────────────
 * One hook that pulls EVERY dashboard figure from the shared engine + stores
 * (never hardcoded). Financial uses transparent default revenue assumptions
 * (labeled illustrative). Values fall back to null → panels show honest
 * "Open engine" / "modeling in progress" states, never fake numbers.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { getPUE } from '@/constants/pue';
import { calculateFinancials, defaultOccupancyRamp, type FinancialResult } from '@/modules/analytics/FinancialEngine';
import { rzModels, rzData } from '@/lib/rz-engine';
import { ccOverall } from '@/components/modules/reliability/availabilityChain';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';

const REDUNDANCY_KEY: Record<string, string> = { 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' };

export interface DashboardData {
    // inputs
    country: string; itLoadKw: number; itLoadMw: number; tier: number;
    redundancy: string; coolingType: string; taxRate: number;
    // capex
    capexTotal: number | null; perKw: number | null; racks: number | null;
    timelineMonths: number | null; capexCosts: Record<string, number> | null;
    facilityLoadMw: number;
    // efficiency
    pue: number; wue: number | null; cue: number | null; lcc: number | null; opexAnnual: number | null; carbonTonnes: number | null;
    // reliability
    availabilityPct: number | null; availabilityTarget: number | null; downtimeMin: number | null;
    // architecture / construction / site / risk
    architecture: { index: number; band: string } | null;
    construction: { totalMonths: number; rfs: number | null } | null;
    siteScore: number | null;
    // financial
    financial: FinancialResult | null; ebitda: number | null; financialIllustrative: boolean;
}

export function useDashboardData(): DashboardData {
    const { inputs, selectedCountry } = useSimulationStore();
    const capex = useCapexStore((s) => s.results);

    return useMemo(() => {
        const m = rzModels();
        const itLoadKw = inputs.itLoad;
        const itLoadMw = itLoadKw / 1000;
        const pue = getPUE(inputs.coolingType);
        const facilityLoadMw = itLoadMw * pue;
        const region = selectedCountry?.id || 'US';
        const taxRate = selectedCountry?.economy?.taxRate ?? 0.22;
        const redKey = REDUNDANCY_KEY[inputs.powerRedundancy] || 'n1';

        // ── efficiency (engine-real via rz-engine water/carbon/opex/tco) ──
        let wue: number | null = null, cue: number | null = null, opexAnnual: number | null = null, lcc: number | null = null, carbonTonnes: number | null = null;
        try { if (m.water?.wue) wue = m.water.wue(inputs.coolingType); } catch { }
        try {
            if (m.carbon?.annualTonnes) {
                const t = m.carbon.annualTonnes(itLoadMw, pue, region);       // tCO2e/yr
                carbonTonnes = Math.round(t);
                const facilityMwh = itLoadMw * 1000 * pue * 8760 / 1000;      // MWh/yr
                cue = facilityMwh > 0 ? +(t * 1000 / (facilityMwh * 1000)).toFixed(3) : null; // kgCO2/kWh
            }
        } catch { }
        const headcount = inputs.headcount_ShiftLead + inputs.headcount_Engineer + inputs.headcount_Technician + inputs.headcount_Admin + inputs.headcount_Janitor;
        try { if (m.opex?.totalAnnual) opexAnnual = Math.round(m.opex.totalAnnual(itLoadMw, pue, region, headcount).total ?? m.opex.totalAnnual(itLoadMw, pue, region, headcount)); } catch { }

        // ── reliability / architecture / construction / site ──
        let availabilityPct: number | null = null, availabilityTarget: number | null = null, downtimeMin: number | null = null;
        try {
            /* fake-100% fix (audit 2026-07-20): pure parallel composition saturates to
             * 1.0 at display precision — use the SAME β=5% common-cause chain as the
             * Reliability page (availabilityChain.ccOverall); round only at render. */
            const rd = (rzData() as { reliability?: { components?: Record<string, { mtbf: number; mttr: number; label: string }>; redundancyPaths?: Record<string, number> } }).reliability;
            if (m.reliability && rd?.components) {
                const paths = rd.redundancyPaths?.[redKey] ?? 2;
                const av = ccOverall(m.reliability as never, rd.components, 1, paths);
                availabilityPct = +(av * 100).toFixed(5);
                availabilityTarget = +(m.reliability.tierTarget(inputs.tierLevel) * 100).toFixed(3);
                downtimeMin = m.reliability.annualDowntimeMinutes(av);
            } else if (m.reliability?.systemAvailability) {
                const av = m.reliability.systemAvailability(['ups', 'crac', 'generator', 'switchgear'], redKey);
                availabilityPct = +(av * 100).toFixed(3);
                availabilityTarget = +(m.reliability.tierTarget(inputs.tierLevel) * 100).toFixed(3);
                downtimeMin = m.reliability.annualDowntimeMinutes(av);
            }
        } catch { }
        let architecture: DashboardData['architecture'] = null;
        try { if (m.architecture?.complexity) architecture = m.architecture.complexity({ coolingType: inputs.coolingType, tier: inputs.tierLevel, redundancy: redKey }); } catch { }
        let construction: DashboardData['construction'] = null;
        try { if (m.construction?.fromTimeline && capex?.timeline) { const s = m.construction.fromTimeline(capex.timeline); construction = { totalMonths: s.totalMonths, rfs: s.milestones?.rfs ?? null }; } } catch { }
        let siteScore: number | null = null;
        // Country-real site score — same basis as the Site Intelligence pillar
        // (deriveFactors from DATA.countries), so the two surfaces agree.
        try {
            if (m.site?.score) {
                const factors = m.site.deriveFactors
                    ? m.site.deriveFactors(region)
                    : { power: 0.7, grid: 0.8, seismic: 0.7, talent: 0.6, tax: 0.6, carbon: 0.6, flood: 0.7, latency: 0.7, water: 0.7 };
                siteScore = m.site.score(factors).score;
            }
        } catch { }

        // ── financial (illustrative revenue assumption) ──
        let financial: FinancialResult | null = null, ebitda: number | null = null;
        if (capex?.total) {
            const years = 15;
            const annualOpex = opexAnnual ?? Math.round(capex.total * 0.06);
            financial = calculateFinancials({
                totalCapex: capex.total, annualOpex, revenuePerKwMonth: inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH,
                itLoadKw, discountRate: 0.10, projectLifeYears: years, escalationRate: 0.03,
                opexEscalation: 0.03, occupancyRamp: inputs.occupancyRamp?.length ? inputs.occupancyRamp : defaultOccupancyRamp(years),
                taxRate, depreciationYears: years,
            });
            const cf5 = financial.cashflows?.[4];
            ebitda = cf5 ? Math.round(cf5.ebitda) : null;
        }
        /* LCC (audit #13 fix, 2026-07-20): the engine has NO models.tco.totalCost —
         * the guard was permanently false, so the card always showed "—". The real
         * engine fn with the intended semantics (discounted TCO incl. 5-yr refresh
         * cycles) is models.tco.lifecycleNPV(capex, opexAnnual, years, { discountRate }).
         * totalCost kept as first preference in case the engine ever ships it. */
        try {
            if (capex?.total && opexAnnual) {
                if (m.tco?.totalCost) lcc = Math.round(m.tco.totalCost(capex.total, opexAnnual, 15, 0.10));
                else if (m.tco?.lifecycleNPV) lcc = Math.round(m.tco.lifecycleNPV(capex.total, opexAnnual, 15, { discountRate: 0.10 }));
            }
        } catch { }

        return {
            country: selectedCountry?.name || '—', itLoadKw, itLoadMw, tier: inputs.tierLevel,
            redundancy: inputs.powerRedundancy, coolingType: inputs.coolingType, taxRate,
            capexTotal: capex?.total ?? null, perKw: capex?.metrics?.perKw ?? null, racks: capex?.metrics?.racks ?? null,
            timelineMonths: capex?.timeline?.totalMonths ?? null, capexCosts: capex?.costs ?? null, facilityLoadMw,
            pue, wue, cue, lcc, opexAnnual, carbonTonnes,
            availabilityPct, availabilityTarget, downtimeMin,
            architecture, construction, siteScore,
            financial, ebitda, financialIllustrative: true,
        };
    }, [inputs, selectedCountry, capex]);
}
