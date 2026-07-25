'use client';

/* ─── Financial Engine — page (Phase H) ──────────────────────────────────────
 * Budget baseline engine-real (capex.total + approved revisions); committed/
 * paid from the tracking ledger (fraction-scaled EXAMPLE seeds, Plan Mode);
 * CPI/SPI = PASSTHROUGH from the Construction EVM (single source — never
 * recomputed here); OPEX YTD via models.opex.totalAnnual with the Phase-Q
 * 'dcContract' basis preset (labeled). Legacy FinancialDashboard + Investment
 * survive by composition/deep-link — nothing lost.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useFinancialTracking } from '@/store/financialTracking';
import { useConstructionTracking } from '@/store/constructionTracking';
import { plannedSchedule, evm, pvCurve } from '@/state/adapters/construction-adapter';
import { rzModels, rzData } from '@/lib/rz-engine';
import { resolveMarketKey } from '@/lib/market-key';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
import FinancialDashboard from '@/components/modules/FinancialDashboard';
import MonteCarloDashboard from '@/components/modules/MonteCarloDashboard';
import { fmtMoney } from '@/lib/format';
import { TraceValue } from '@/components/ui/TraceValue';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { RedValue, type Diagnosis } from '@/components/ui/RedValue';
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { TrendingUp, ChevronRight, FileDown } from 'lucide-react';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

const OPEX_COLORS = ['#f59e0b', '#00FF88', '#3b82f6', '#7DDDB4', '#64748b', '#14b8a6'];

export function FinancialPage({ initialTab }: { initialTab?: 'overview' | 'ledger' | 'proforma' | 'montecarlo' } = {}) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const results = useCapexStore((s) => s.results);
    const runCalculation = useCapexStore((s) => s.runCalculation);
    const cityMarket = useCapexStore((s) => s.inputs.cityMarket);
    const fin = useFinancialTracking();
    const ct = useConstructionTracking();
    const [tab, setTab] = React.useState<'overview' | 'ledger' | 'proforma' | 'montecarlo'>(initialTab ?? 'overview');
    /* deep-link fix: 'montecarlo' router case re-renders an already-mounted page —
     * useState won't re-read the prop, so sync tab when initialTab changes */
    React.useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => { if (!results) runCalculation(); }, [results, runCalculation]);

    const model = React.useMemo(() => {
        if (!results) return null;
        const baseline = results.total;
        const approvedRev = fin.revisions.filter((r) => r.approved).reduce((s, r) => s + r.amountFrac * baseline, 0);
        const revised = baseline + approvedRev;
        const committed = fin.transactions.filter((t) => ['committed', 'approved', 'paid'].includes(t.status)).reduce((s, t) => s + t.amountFrac * baseline, 0);
        const paid = fin.transactions.filter((t) => t.status === 'paid').reduce((s, t) => s + t.amountFrac * baseline, 0);
        // EVM passthrough — single source (Construction tracking)
        const sched = plannedSchedule(results.timeline);
        const e = sched ? evm(sched, revised, ct.statusMonth, ct.phaseActualPct, ct.acSpentUsd) : null;
        const cpi = e?.cpi ?? 1, spi = e?.spi ?? 1;
        const fac = e && !e.planMode ? Math.round(e.acUsd + (revised - e.evUsd) / Math.max(0.5, cpi)) : revised;
        const curve = sched ? pvCurve(sched, revised) : [];
        // OPEX (engine, dcContract preset) — annual + YTD proxy at status month
        let opex: Record<string, number> | null = null;
        try {
            const m = rzModels();
            if (m?.opex?.totalAnnual) {
                opex = m.opex.totalAnnual(inputs.itLoad / 1000, undefined, country?.id ?? 'US',
                    (inputs.headcount_ShiftLead ?? 0) + (inputs.headcount_Engineer ?? 0) + (inputs.headcount_Technician ?? 0) + (inputs.headcount_Admin ?? 0),
                    { capex: baseline, extendedOpex: true, basisPreset: 'dcContract' });
            }
        } catch { /* */ }
        const opexDonut = opex ? [
            { name: 'Utilities (power)', v: opex.power }, { name: 'Maintenance', v: opex.maintenance },
            { name: 'Labor', v: opex.staffing }, { name: 'Services (contract)', v: opex.contract },
            { name: 'Insurance', v: opex.insurance }, { name: 'Others', v: (opex.overhead ?? 0) + (opex.water ?? 0) + (opex.carbon ?? 0) + (opex.connectivity ?? 0) },
        ].filter((x) => x.v > 0) : [];
        // health composite (documented): 0.3 budget-variance + 0.35 cpi + 0.35 spi
        const bv = revised > 0 ? Math.max(0, 1 - Math.abs(fac - revised) / revised * 5) : 1;
        const health = Math.round(100 * (0.3 * bv + 0.35 * Math.min(1, cpi) + 0.35 * Math.min(1, spi)));
        const grade = health >= 85 ? 'A' : health >= 70 ? 'B' : health >= 55 ? 'C' : health >= 40 ? 'D' : 'E';
        return { baseline, approvedRev, revised, committed, paid, cpi, spi, fac, curve, opex, opexDonut, health, grade, planMode: e?.planMode ?? true };
    }, [results, fin.transactions, fin.revisions, ct.statusMonth, ct.phaseActualPct, ct.acSpentUsd, inputs, country]);

    /* ── Workstream H · WACC build-up + scenario NPV + break-even occupancy +
     * TCO $/kW·mo — SAME cashflow construction as this page's PDF pro-forma
     * (engine reference revenue × IT kW vs the dcContract OPEX, 15-yr flat),
     * re-run through engine roi.npv/irr under scenario conditions. WACC basis
     * = engine DATA.discountDefaults (Damodaran regional + country risk). ── */
    const proforma = React.useMemo(() => {
        if (!model) return null;
        const m = rzModels();
        if (!m?.roi?.npv || !m?.roi?.irr) return null;
        const D = rzData();
        const YEARS = 15;
        const cid = (country?.id ?? '').toUpperCase();
        const countryWacc: number | undefined = D?.discountDefaults?.[cid];
        const wacc: number = countryWacc ?? D?.discountDefaults?.global ?? 0.09;
        /* revenue reference: engine market coloPrice ($/kW·mo) when a city
         * market is selected; else the page's screening default (the engine
         * has no global revenue key — labeled honestly, never called engine) */
        const marketKey = resolveMarketKey(cityMarket);
        const marketColo: number | undefined = marketKey !== 'none' ? D?.markets?.[marketKey]?.coloPrice : undefined;
        /* fallback = the LIVE app-wide basis (sim tunable), never a divergent
         * literal — this page's Pro Forma runs on the same number */
        const revRef: number = marketColo ?? inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH;
        const revSrc = marketColo != null ? `engine market coloPrice · ${marketKey}` : `live revenue basis $${inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH}/kW·mo (no market selected)`;
        const revenueYr = revRef * inputs.itLoad * 12;
        const opexYr: number = model.opex ? (model.opex.totalExtended ?? model.opex.total) : revenueYr * 0.4;
        const npvAt = (capex: number, rev: number, rate: number): number =>
            m.roi.npv(Array.from({ length: YEARS }, () => rev - opexYr), rate) - capex;
        const irrAt = (capex: number, rev: number): number | null => {
            try {
                const r = m.roi.irr([-capex, ...Array.from({ length: YEARS }, () => rev - opexYr)]);
                return Number.isFinite(r) ? r : null;
            } catch { return null; }
        };
        const baseIrr = irrAt(model.baseline, revenueYr);
        const scenarios = [
            { label: 'Base', npv: npvAt(model.baseline, revenueYr, wacc), irr: baseIrr, note: `WACC ${(wacc * 100).toFixed(1)}%` },
            { label: 'Rate +200 bp', npv: npvAt(model.baseline, revenueYr, wacc + 0.02), irr: baseIrr, note: `discount ${((wacc + 0.02) * 100).toFixed(1)}% — IRR unchanged by definition` },
            { label: 'Revenue −15%', npv: npvAt(model.baseline, revenueYr * 0.85, wacc), irr: irrAt(model.baseline, revenueYr * 0.85), note: 'occupancy / pricing stress' },
            { label: 'CAPEX +10%', npv: npvAt(model.baseline * 1.1, revenueYr, wacc), irr: irrAt(model.baseline * 1.1, revenueYr), note: 'overrun stress' },
        ];
        /* break-even occupancy — bisection on the SAME cashflow fn (revenue
         * scales with occupancy, OPEX held constant = conservative screening) */
        const f = (occ: number): number => npvAt(model.baseline, revenueYr * occ, wacc);
        let breakEven: number | null = null;
        const reachable = f(1) > 0;
        if (reachable && f(0) < 0) {
            let lo = 0, hi = 1;
            for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
            breakEven = (lo + hi) / 2;
        }
        const tcoPerKwMo = inputs.itLoad > 0 ? (model.baseline / YEARS + opexYr) / (inputs.itLoad * 12) : 0;
        const stressedNegative = scenarios.filter((sc) => sc.npv < 0).length;
        return { wacc, countryWacc, cid, revRef, revSrc, revenueYr, opexYr, years: YEARS, scenarios, breakEven, reachable, tcoPerKwMo, stressedNegative };
    }, [model, country, inputs.itLoad, cityMarket]);

    if (!results || !model) return <div className="p-8 text-center text-sm text-slate-500">Calculating…</div>;

    /* ── Owner-mandate red-value diagnostics (shared RedValue modal) ─────────
     * CPI/SPI here are a PASSTHROUGH from the Construction EVM (single source)
     * and the health grade is the documented 0.3/0.35/0.35 composite — the
     * diagnosis restates exactly those formulas with the live numbers. */
    const bvScore = model.revised > 0 ? Math.max(0, 1 - Math.abs(model.fac - model.revised) / model.revised * 5) : 1;
    const evmLevers: Diagnosis['levers'] = [
        {
            label: 'Fix at source — construction tracking',
            detail: `CPI ${model.cpi} / SPI ${model.spi} derive from the per-phase actuals + AC entered on the Construction Engine (single source — never recomputed here); recovery (crew-up, re-sequencing, procurement) happens there.`,
            tab: 'construction',
        },
        {
            label: 'Revisions ledger (re-baseline)',
            detail: `If the variance is scope, approve a budget revision: ${fmtMoney(model.approvedRev)} already approved on baseline ${fmtMoney(model.baseline)} → revised ${fmtMoney(model.revised)} — an approved change moves the baseline instead of dragging CPI.`,
            tab: 'finance',
        },
    ];
    const evmDiag: Diagnosis | null = !model.planMode && (model.cpi < 1 || model.spi < 1) ? {
        title: 'CPI / SPI (Construction EVM passthrough)',
        reason: `${model.cpi < 1 ? `CPI ${model.cpi} < 1.00 — over budget: each dollar spent earns only ${Math.round(model.cpi * 100)}¢ of planned work. ` : ''}${model.spi < 1 ? `SPI ${model.spi} < 1.00 — behind schedule. ` : ''}Against the revised budget ${fmtMoney(model.revised)} this drives FAC ${fmtMoney(model.fac)} (variance ${fmtMoney(model.fac - model.revised)}; FAC = AC + (revised − EV) ÷ CPI).`,
        actual: `${model.cpi} / ${model.spi}`, threshold: '≥ 1.00 / ≥ 1.00',
        levers: evmLevers,
        tab: 'construction',
        note: 'Passthrough from the Construction EVM tracking store — this page never recomputes the indices.',
    } : null;
    const gradeDiag: Diagnosis | null = model.grade === 'D' || model.grade === 'E' ? {
        title: 'Financial Health Grade',
        reason: `Health ${model.health}/100 = 0.3 × budget-variance score (${bvScore.toFixed(2)}) + 0.35 × CPI (${model.cpi}) + 0.35 × SPI (${model.spi}). FAC ${fmtMoney(model.fac)} vs revised budget ${fmtMoney(model.revised)} = ${((model.fac - model.revised) / model.revised * 100).toFixed(1)}% variance. Grade bands: A ≥ 85 · B ≥ 70 · C ≥ 55 · D ≥ 40 · else E.`,
        actual: `${model.grade} (${model.health}/100)`, threshold: '≥ C (55/100)',
        gap: `${model.health - 55} pts`,
        levers: evmLevers,
        tab: 'finance',
        note: 'Documented composite — same formula as the on-card caption (0.3 budget-var + 0.35 CPI + 0.35 SPI).',
    } : null;

    const insights = [
        `Budget baseline ${fmtMoney(model.baseline)} + approved changes ${fmtMoney(model.approvedRev)} → revised ${fmtMoney(model.revised)}.`,
        model.planMode ? 'Plan Mode — FAC ≡ revised budget (no construction actuals yet).' : `FAC ${fmtMoney(model.fac)} at CPI ${model.cpi} (from Construction tracking — single source).`,
        model.opex ? `Annual OPEX ${fmtMoney(model.opex.totalExtended ?? model.opex.total)} on the DC-contract 100%-util basis (engine preset).` : 'OPEX engine loading…',
        `Committed ${Math.round((model.committed / model.revised) * 100)}% · paid ${Math.round((model.paid / model.revised) * 100)}% of revised budget${fin.touched ? '' : ' (EXAMPLE ledger)'}.`,
    ];

    const exportPdf = async () => {
        setBusy(true);
        try {
            const overdue = fin.invoices.filter((iv) => iv.status === 'overdue');
            // Screening pro-forma (same engine basis as the Results page): reference
            // revenue × IT load vs the page's dcContract OPEX — roi model, no new data.
            const m = rzModels();
            const revenueYr = (rzData()?.decision?.revenuePerKwMonth ?? 280) * inputs.itLoad * 12;
            const opexYr = model.opex ? (model.opex.totalExtended ?? model.opex.total) : revenueYr * 0.4;
            const flows = Array.from({ length: 15 }, () => revenueYr - opexYr);
            const npv = m?.roi?.npv ? m.roi.npv(flows, 0.1) - model.baseline : 0;
            const irrFrac = m?.roi?.irr ? m.roi.irr([-model.baseline, ...flows]) : null;
            const payback = m?.roi?.paybackPeriod ? m.roi.paybackPeriod(model.baseline, revenueYr, opexYr) : Infinity;
            const narrativeMetrics = { npv, irrPct: (irrFrac ?? 0) * 100, paybackYr: Number.isFinite(payback) ? payback : 0, hurdlePct: 10 };
            await generatePillarPDF({
                title: 'Financial', layer: 'Financial Engine', project: '—',
                kpis: [
                    { label: 'Total Budget (Baseline)', value: fmtMoney(model.baseline), sub: 'engine capex P50' },
                    { label: 'Revised Budget', value: fmtMoney(model.revised), sub: `+${fmtMoney(model.approvedRev)} approved changes` },
                    { label: 'Total Committed', value: fmtMoney(model.committed), sub: `${Math.round((model.committed / model.revised) * 100)}% of revised` },
                    { label: 'Total Actual (Paid)', value: fmtMoney(model.paid), sub: `${Math.round((model.paid / model.revised) * 100)}% of revised` },
                    { label: 'Forecast at Completion', value: fmtMoney(model.fac), sub: model.planMode ? 'Plan Mode ≡ revised' : `variance ${fmtMoney(model.fac - model.revised)}` },
                    { label: 'CPI / SPI', value: `${model.cpi} / ${model.spi}`, sub: 'from Construction EVM (single source)' },
                ],
                sections: [
                    {
                        title: 'Budget Summary', head: ['Item', 'Value'], rows: [
                            ['Baseline (engine capex P50)', fmtMoney(model.baseline)],
                            ['Approved Changes', fmtMoney(model.approvedRev)],
                            ['Revised Budget', fmtMoney(model.revised)],
                            ['Committed', `${fmtMoney(model.committed)} (${Math.round((model.committed / model.revised) * 100)}%)`],
                            ['Paid', `${fmtMoney(model.paid)} (${Math.round((model.paid / model.revised) * 100)}%)`],
                            ['Forecast at Completion', fmtMoney(model.fac)],
                            ['Variance (FAC − revised)', fmtMoney(model.fac - model.revised)],
                        ],
                    },
                    ...(model.opex ? [{
                        title: 'Annual OPEX by Type (DC-contract basis)', head: ['Type', 'Annual'], rows: [
                            ...model.opexDonut.map((r) => [r.name, fmtMoney(r.v)]),
                            ['Total', fmtMoney(model.opex.totalExtended ?? model.opex.total)],
                        ],
                    }] : []),
                ],
                callouts: insights.map((s, idx) => ({ title: `Key Insight ${idx + 1}`, body: s, tone: 'info' as const })),
                assessment: buildAssessment('financial', narrativeMetrics),
                actions: [
                    ...buildActions('financial', narrativeMetrics),
                    ...(model.grade !== 'A' ? [{ priority: 'MEDIUM' as const, action: `Financial health grade ${model.grade} (${model.health}/100) — review budget variance, CPI and SPI drivers.` }] : []),
                    ...overdue.map((iv) => ({ priority: 'HIGH' as const, action: `Overdue invoice ${iv.invoiceNo} — ${iv.vendor} (${iv.direction}) ${fmtMoney(iv.amountFrac * model.baseline)}.` })),
                ],
                summaryBand: [
                    { label: 'Baseline', value: fmtMoney(model.baseline) },
                    { label: 'Revised', value: fmtMoney(model.revised) },
                    { label: 'Committed', value: fmtMoney(model.committed) },
                    { label: 'Paid', value: fmtMoney(model.paid) },
                    { label: 'FAC', value: fmtMoney(model.fac) },
                    { label: 'Health', value: `${model.grade} · ${model.health}` },
                ],
                note: 'Budget baseline = engine capex P50 + approved revisions; CPI/SPI passthrough from the Construction EVM (single source — never recomputed here); annual OPEX via the engine dcContract basis preset.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-rz-2 bg-rz-elevated"><TrendingUp className="h-6 w-6 text-rz-info" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Financial performance & analytics across the project lifecycle</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Overview'], ['ledger', 'Transactions & AR/AP'], ['montecarlo', 'Monte Carlo Risk'], ['proforma', 'Pro Forma (Full)']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-signal text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={() => setActiveTab('invest')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint">Investment & Capitalization</button>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('report')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/90">Next: Results <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'proforma' ? (
                <div className="space-y-4">
                    {/* ── Workstream H · WACC build-up + scenario NPV (screening) ── */}
                    {!proforma ? (
                        <p className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-[11px] text-slate-500">Engine roi model unavailable — scenario NPV / break-even screening hidden (full pro-forma below unaffected).</p>
                    ) : (
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                WACC Basis & Scenario NPV <InfoTip content="Screening scenario layer over the same cashflow construction as this page's PDF pro-forma: reference revenue ($/kW·mo × IT kW × 12; engine market coloPrice when a city market is selected) minus the engine dcContract annual OPEX, 15 years flat, discounted through engine roi.npv/irr. The discount basis is the engine's regional WACC table (Damodaran regional cost of capital + country risk) — country-specific where the table has the selected country, else the global default. Scenario conditions replace point estimates: a project that only clears its hurdle in the Base row is not robust — if mild stress (rate +200 bp, revenue −15%, CAPEX +10%) flips NPV negative, the smaller/simpler build or a later phase-in wins. The detailed year-by-year pro-forma below remains the full model; this card is the stress screen." />
                                <span className="ml-1 text-[9px] normal-case text-slate-400">engine roi.npv/irr · same cashflow as the PDF pro-forma · screening</span>
                            </h2>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">WACC (discount basis) <InfoTip content={`Weighted average cost of capital used as the discount rate: ${proforma.countryWacc != null ? `country-specific rate for ${country?.name ?? proforma.cid} from the engine regional WACC table` : `no country-specific entry for ${country?.name ?? 'the selected country'} in the engine table — global default applied`} (Damodaran regional WACC + country risk, 2026). Band: developed markets ~7-9%, emerging ~11-13%. A higher-WACC country needs proportionally stronger cashflows for the same NPV — the same design can be bankable in one country and not in another.`} /></div>
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{(proforma.wacc * 100).toFixed(1)}%</div>
                                    <div className="truncate text-[10px] text-slate-500">{proforma.countryWacc != null ? `country rate · ${proforma.cid}` : 'global default (no country entry)'}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">TCO $/kW·mo <InfoTip content={`Total cost of ownership per kW of IT per month: (CAPEX amortized straight-line over ${proforma.years} yr + annual OPEX) ÷ (IT kW × 12). Benchmark against the reference revenue of $${proforma.revRef}/kW·mo (${proforma.revSrc}): TCO at or above the revenue line is structurally loss-making before financing costs; healthy colo/wholesale economics usually want TCO comfortably below ~70-80% of achievable revenue. Screening amortization — no cost of capital inside this KPI (that's what the NPV rows are for).`} /></div>
                                    <div className={`text-lg font-bold tabular-nums ${proforma.tcoPerKwMo < proforma.revRef ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>${proforma.tcoPerKwMo.toFixed(0)}</div>
                                    <div className="truncate text-[10px] text-slate-500">vs revenue ref ${proforma.revRef}/kW·mo</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Break-even Occupancy <InfoTip content="Occupancy at which NPV = 0, solved by deterministic bisection (≤40 iterations) on the same cashflow function — revenue scales with occupancy while OPEX is held constant, which is conservative (real OPEX falls somewhat at low occupancy). Band: a break-even below ~60% leaves healthy leasing headroom; 60-80% is normal; above ~85% means the business case only works nearly full — one anchor-tenant delay breaches it. 'Not reachable' means NPV stays negative even at 100% occupancy: the problem is cost or rate, not leasing." /></div>
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{proforma.breakEven != null ? `${(proforma.breakEven * 100).toFixed(0)}%` : proforma.reachable ? '<1%' : 'not reachable'}</div>
                                    <div className="truncate text-[10px] text-slate-500">{proforma.reachable ? (proforma.breakEven != null && proforma.breakEven > 0.85 ? 'thin — breach on one tenant delay' : 'NPV=0 · revenue-scaling, OPEX held') : 'NPV < 0 even at 100% — cost/rate problem'}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Annual Cashflow (base) <InfoTip content={`Reference revenue ${fmtMoney(proforma.revenueYr)} ($${proforma.revRef}/kW·mo × IT kW × 12 — ${proforma.revSrc}) minus annual OPEX ${fmtMoney(proforma.opexYr)} (engine dcContract basis) = the flat annual net cashflow the NPV/IRR rows discount over ${proforma.years} years. Flat-line screening — no escalation, no ramp; the full pro-forma below models the year-by-year detail.`} /></div>
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmtMoney(proforma.revenueYr - proforma.opexYr)}</div>
                                    <div className="truncate text-[10px] text-slate-500">rev {fmtMoney(proforma.revenueYr)} − opex {fmtMoney(proforma.opexYr)}</div>
                                </div>
                            </div>
                            <table className="mt-3 w-full text-[11px]">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Scenario</th><th className="text-right">NPV</th><th className="text-right">IRR</th><th className="text-left pl-4">Condition</th></tr></thead>
                                <tbody>
                                    {proforma.scenarios.map((sc) => (
                                        <tr key={sc.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td className="py-1 text-slate-700 dark:text-slate-200">{sc.label}</td>
                                            <td className={`text-right tabular-nums font-semibold ${sc.npv >= 0 ? 'text-rz-data' : 'text-rose-500'}`}>{fmtMoney(sc.npv)}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{sc.irr != null ? `${(sc.irr * 100).toFixed(1)}%` : '—'}</td>
                                            <td className="pl-4 text-[9px] text-slate-400">{sc.note}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {proforma.stressedNegative >= 2 && (
                                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10.5px] text-slate-600 dark:text-slate-300">
                                    <span className="mr-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-600 dark:text-amber-400">NOT ROBUST</span>
                                    {proforma.stressedNegative} of 4 scenarios go NPV-negative — the case depends on everything going right. The simpler option (smaller first phase, less speculative capacity, or waiting for an anchor tenant) likely wins over building the full design now.
                                </p>
                            )}
                            <p className="mt-1.5 text-[9px] text-slate-400">Screening: flat {proforma.years}-yr cashflow at 100% utilization reference revenue — no escalation, ramp, debt structure or tax. The pro-forma below is the detailed model; this card only stress-tests its headline.</p>
                        </div>
                    )}
                    <FinancialDashboard />
                </div>
            ) : tab === 'montecarlo' ? <MonteCarloDashboard /> : tab === 'ledger' ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent Financial Transactions {fin.touched ? '' : <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">EXAMPLE LEDGER</span>}</h2>
                        <div className="space-y-1">
                            {fin.transactions.map((t) => (
                                <div key={t.id} className="flex items-center gap-2 text-[11px]">
                                    <span className={`rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase ${t.type === 'po' ? 'bg-rz-mint/15 text-rz-mint' : t.type === 'invoice' ? 'bg-cyan-500/15 text-cyan-500' : 'bg-rz-data/15 text-rz-data'}`}>{t.type}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-slate-700 dark:text-slate-200">{t.description}</span>
                                        <span className="block truncate text-[9px] text-slate-400">{t.vendor}</span>
                                    </span>
                                    <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmtMoney(t.amountFrac * model.baseline)}</span>
                                    <select className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                        value={t.status} onChange={(ev) => fin.actions.setTxnStatus(t.id, ev.target.value as typeof t.status)}>
                                        {['pending', 'committed', 'approved', 'paid'].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => fin.actions.addTxn({ date: 'now', type: 'invoice', vendor: 'New vendor', description: 'New transaction', amountFrac: 0.001, status: 'pending' })}
                            className="mt-2 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-rz-mint">＋ New Financial Entry</button>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outstanding Invoices (AR/AP)</h2>
                            <div className="space-y-1">
                                {fin.invoices.map((iv) => (
                                    <div key={iv.id} className="flex items-center gap-2 text-[11px]">
                                        <span className={`rounded px-1 py-0.5 text-[8.5px] font-bold ${iv.direction === 'AP' ? 'bg-rose-500/15 text-rose-500' : 'bg-rz-data/15 text-rz-data'}`}>{iv.direction}</span>
                                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{iv.vendor} <span className="text-[9px] text-slate-400">{iv.invoiceNo} · {iv.dueLabel}</span></span>
                                        <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmtMoney(iv.amountFrac * model.baseline)}</span>
                                        <select className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                            value={iv.status} onChange={(ev) => fin.actions.setInvoiceStatus(iv.id, ev.target.value as typeof iv.status)}>
                                            {['outstanding', 'overdue', 'paid'].map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget Revisions (change orders)</h2>
                            {fin.revisions.map((r) => (
                                <label key={r.id} className="flex items-center gap-2 py-0.5 text-[11px]">
                                    <input type="checkbox" checked={r.approved} onChange={() => fin.actions.toggleRevision(r.id)} className="accent-rz-mint" />
                                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{r.description}</span>
                                    <span className="tabular-nums text-slate-500">{fmtMoney(r.amountFrac * model.baseline)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Total Budget (Baseline)', value: fmtMoney(model.baseline), sub: 'engine capex P50', trace: 'capex.total' },
                            { label: 'Revised Budget', value: fmtMoney(model.revised), sub: `+${fmtMoney(model.approvedRev)} approved changes`, trace: 'fin.revisedBudget' },
                            { label: 'Total Committed', value: fmtMoney(model.committed), sub: `${Math.round((model.committed / model.revised) * 100)}% of revised`, trace: 'fin.committed' },
                            { label: 'Total Actual (Paid)', value: fmtMoney(model.paid), sub: `${Math.round((model.paid / model.revised) * 100)}% of revised`, trace: 'fin.paid' },
                            { label: 'Forecast at Completion', value: fmtMoney(model.fac), sub: model.planMode ? 'Plan Mode ≡ revised' : `variance ${fmtMoney(model.fac - model.revised)}`, trace: 'fin.fac' },
                            { label: 'CPI / SPI', value: `${model.cpi} / ${model.spi}`, sub: 'from Construction EVM (single source)', trace: 'constr.cpi', red: evmDiag },
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                {(k as { trace?: string }).trace ? (
                                    <TraceValue traceId={(k as { trace?: string }).trace!}>
                                        {(k as { red?: Diagnosis | null }).red ? (
                                            <RedValue className="text-lg font-bold tabular-nums" diagnosis={(k as { red?: Diagnosis | null }).red!}>{k.value}</RedValue>
                                        ) : (
                                            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                        )}
                                    </TraceValue>
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                        <div className="min-w-0 space-y-4">
                            {/* budget curve */}
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget vs Plan Over Time <span className="text-[9px] normal-case text-slate-400">PV from the engine CPM schedule</span></h2>
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={model.curve}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                            <XAxis dataKey="month" tick={{ fontSize: 9 }} unit="mo" />
                                            <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                                            <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                            <Area dataKey="pvUsd" name="Planned Value (cumulative)" stroke="#7DDDB4" fill="#7DDDB4" fillOpacity={0.15} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* OPEX */}
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Annual OPEX by Type <span className="text-[9px] normal-case text-slate-400">engine models.opex · DC-contract basis (Phase-Q preset)</span></h2>
                                {model.opex ? (
                                    <div className="flex items-center gap-3">
                                        <div className="h-36 w-36 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={model.opexDonut} dataKey="v" nameKey="name" innerRadius={34} outerRadius={54} paddingAngle={2}>
                                                        {model.opexDonut.map((_, idx) => <Cell key={idx} fill={OPEX_COLORS[idx]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            {model.opexDonut.map((r, idx) => (
                                                <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="h-2 w-2 rounded-sm" style={{ background: OPEX_COLORS[idx] }} />
                                                    <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                    <span className="ml-auto tabular-nums text-slate-500">{fmtMoney(r.v)}</span>
                                                </div>
                                            ))}
                                            <TraceValue traceId="opex.totalAnnual">
                                                <div className="border-t border-slate-200 dark:border-slate-800 pt-0.5 text-[11px] font-bold text-slate-900 dark:text-white">
                                                    {fmtMoney(model.opex.totalExtended ?? model.opex.total)} <span className="font-normal text-slate-400">/ year</span>
                                                </div>
                                            </TraceValue>
                                        </div>
                                    </div>
                                ) : <p className="text-xs text-slate-500">Engine loading…</p>}
                            </div>
                        </div>

                        {/* rail */}
                        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-center">
                                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Financial Health</h3>
                                {gradeDiag ? (
                                    <TraceValue traceId="fin.healthScore">
                                        <RedValue className="text-4xl font-bold" diagnosis={gradeDiag}>{model.grade}</RedValue>
                                    </TraceValue>
                                ) : (
                                    /* Workstream M — ScoreValue: gradient color + ƒx trace + explain on the non-red path */
                                    <ScoreValue value={model.health} direction="higher" traceId="fin.healthScore" explainKey="financial-health-score"
                                        display={<>{model.grade}{model.planMode && <span className="text-base font-semibold text-slate-400"> (baseline)</span>}</>}
                                        className="text-4xl" />
                                )}
                                <div className="text-[10px] text-slate-500">{model.health}/100 · 0.3 budget-var + 0.35 CPI + 0.35 SPI</div>
                                {/* audit #8: in Plan Mode the composite is DEFINITIONAL (CPI/SPI≡1, FAC≡revised
                                  * → budget-var 0) — grey chip keeps the perfect grade honest. Math unchanged. */}
                                {model.planMode && (
                                    <span className="mt-1 inline-block rounded bg-slate-400/15 px-1 py-0.5 text-[8px] font-semibold text-slate-500">Plan Mode — baseline (belum ada actuals)</span>
                                )}
                                <div className="mt-1.5 space-y-0.5 text-left text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-500">Budget Variance</span><span className={`tabular-nums ${Math.abs(model.fac - model.revised) / model.revised < 0.02 ? 'text-rz-data' : 'text-amber-500'}`}>{((model.fac - model.revised) / model.revised * 100).toFixed(1)}%</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">CPI</span><span className="tabular-nums text-slate-700 dark:text-slate-200">{model.cpi}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">SPI</span><span className="tabular-nums text-slate-700 dark:text-slate-200">{model.spi}</span></div>
                                </div>
                            </div>
                            <div className="rounded border border-rz-mint/30 bg-rz-mint/5 p-3">
                                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rz-mint">Key Insights</h3>
                                <ul className="space-y-0.5">
                                    {insights.map((s, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-rz-mint">✓</span>{s}</li>)}
                                </ul>
                            </div>
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deep Dives</h3>
                                <div className="space-y-1 text-[11px]">
                                    {([['invest', 'Investment & Capitalization'], ['montecarlo', 'Monte Carlo'], ['portfolio', 'Portfolio'], ['benchmark', 'Benchmarks'], ['strategic', 'Strategic Planning']] as const).map(([id, l]) => (
                                        <button key={id} onClick={() => setActiveTab(id)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-rz-mint">{l} →</button>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            )}
        </div>
    );
}
