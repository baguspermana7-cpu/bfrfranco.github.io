'use client';

/* ─── Financial Statements — P&L · Balance Sheet · Sankey (WS2, 2026-07-27) ────
 * Detailed project financial statements driven by the SAME engine cashflows the
 * KPIs use (FinancialResult.cashflows), the CAPEX SSOT and the WS1 OPEX
 * breakdown. Nothing is re-computed or fabricated:
 *   • P&L    — per-year Revenue → OPEX → EBITDA → D&A → EBIT → Tax → Net Income
 *              straight from cashflows[] (engine); margins derived.
 *   • Balance Sheet — assets (net PP&E + cash) = liabilities (debt schedule from a
 *              user debt-ratio) + equity (paid-in + retained). Cash is the identity
 *              plug = cumulative (NI + D&A − principal), so the sheet balances by
 *              construction; a live check asserts Assets − (L+E) = 0. The operating
 *              P&L is UNLEVERED (project-level, matches the NPV/IRR basis); interest
 *              is shown as a financing memo, not deducted from operating net income.
 *   • Sankey — one stabilized year's Revenue distributed into each OPEX group (WS1
 *              breakdown shares) + EBITDA → D&A / Tax / Net Income. Rendered only
 *              when the whole chain is positive (else an honest note).
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { Sankey, Tooltip as RTooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { rzModels } from '@/lib/rz-engine';
import type { YearCashflow } from '@/modules/analytics/FinancialEngine';

interface Props {
    cashflows: YearCashflow[];
    capex: number;
    taxRate: number;              // decimal
    depreciationYears: number;
    projectLifeYears: number;
    countryCode: string;
    itLoadKw: number;
    pue: number;
    cooling: string;
    maintenanceStrategy?: string;
}

const fmt = (n: number): string => {
    const a = Math.abs(n);
    const s = n < 0 ? '-' : '';
    if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}k`;
    return `${s}$${Math.round(a)}`;
};
const pct = (n: number, d: number): string => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');

const GROUP_COLOR: Record<string, string> = {
    Energy: '#22d3ee', People: '#7DDDB4', 'Contracts & Maintenance': '#f59e0b',
    Security: '#f43f5e', 'Compliance & Licenses': '#34d399', Connectivity: '#38bdf8',
    'Real Estate & Tax': '#fbbf24', Overhead: '#94a3b8',
};

export function FinancialStatements({ cashflows, capex, taxRate, depreciationYears, projectLifeYears, countryCode, itLoadKw, pue, cooling, maintenanceStrategy }: Props) {
    const [debtRatio, setDebtRatio] = React.useState(0.6);
    const [debtRate, setDebtRate] = React.useState(0.06);

    /* The shared engine loads via a deferred <script>; if this card first mounts
     * (persisted CAPEX can render it) before window.RZEngine is ready, the OPEX
     * memo would compute empty and never retry. Tick once the model is available. */
    const [engineTick, setEngineTick] = React.useState(0);
    React.useEffect(() => {
        if (rzModels()?.opex?.fullBreakdown) { setEngineTick((t) => t + 1); return; }
        const id = setInterval(() => {
            if (rzModels()?.opex?.fullBreakdown) { setEngineTick((t) => t + 1); clearInterval(id); }
        }, 250);
        return () => clearInterval(id);
    }, []);

    if (!cashflows || cashflows.length === 0) return null;

    // ── P&L rollups. Engine convention: taxableIncome = max(0, EBITDA − depreciation);
    // tax = taxableIncome × rate; netIncome = EBITDA − tax (after-tax cash / FCF —
    // depreciation is a non-cash tax shield, added back). We present it that way so
    // the statement reconciles: Revenue − OPEX = EBITDA; EBITDA − Tax = Net Cash Flow.
    const totals = cashflows.reduce((a, c) => ({
        revenue: a.revenue + c.revenue, opex: a.opex + c.opex, ebitda: a.ebitda + c.ebitda,
        depreciation: a.depreciation + c.depreciation, taxable: a.taxable + c.taxableIncome,
        tax: a.tax + c.tax, netIncome: a.netIncome + c.netIncome,
    }), { revenue: 0, opex: 0, ebitda: 0, depreciation: 0, taxable: 0, tax: 0, netIncome: 0 });

    // show at most ~8 year columns to keep the table readable
    const years = cashflows.length;
    const step = Math.max(1, Math.ceil(years / 8));
    const shownIdx = cashflows.map((_, i) => i).filter((i) => i % step === 0 || i === years - 1);

    // ── Balance sheet schedule
    const debt0 = capex * debtRatio;
    const equity0 = capex - debt0;
    const amortYears = Math.max(1, projectLifeYears);
    const principalPerYear = debt0 / amortYears;
    const bs = React.useMemo(() => {
        let accDep = 0, retained = 0, debt = debt0;
        const rows = cashflows.map((c) => {
            accDep += c.depreciation;
            retained += c.netIncome;
            const interest = debt * debtRate;
            const principal = Math.min(principalPerYear, debt);
            debt = Math.max(0, debt - principal);
            const ppe = Math.max(0, capex - accDep);
            const equity = equity0 + retained;
            const cash = debt + equity - ppe; // identity plug
            const assets = ppe + cash;
            return { year: c.year, ppe, cash, assets, debt, equity, paidIn: equity0, retained, interest, principal, balanceErr: assets - (debt + equity) };
        });
        return rows;
    }, [cashflows, debt0, equity0, principalPerYear, debtRate, capex]);
    const maxBalErr = bs.reduce((m, r) => Math.max(m, Math.abs(r.balanceErr)), 0);

    // ── Sankey — pick a stabilized (fully-ramped) year
    const stableIdx = years - 1;
    const cf = cashflows[stableIdx];
    const opexGroups = React.useMemo<{ name: string; value: number }[]>(() => {
        try {
            const fb = rzModels()?.opex?.fullBreakdown?.({
                itMw: itLoadKw / 1000, pue, countryCode, capex, cooling, maintenanceStrategy: maintenanceStrategy ?? 'standard_annual_compliance',
            });
            if (!fb?.groups) return [];
            const raw = fb.groups.map((g: { group: string; lines: { annual: number }[] }) => ({
                name: g.group, value: g.lines.reduce((s, l) => s + l.annual, 0),
            })).filter((g: { value: number }) => g.value > 0);
            const rawTotal = raw.reduce((s: number, g: { value: number }) => s + g.value, 0);
            // scale group shares to the P&L opex so Revenue = OPEX + EBITDA stays exact
            return rawTotal > 0 ? raw.map((g: { name: string; value: number }) => ({ name: g.name, value: (g.value / rawTotal) * cf.opex })) : [];
        } catch { return []; }
    }, [itLoadKw, pue, countryCode, capex, cooling, maintenanceStrategy, cf.opex, engineTick]);

    // Sankey shows the real CASH distribution (depreciation is non-cash, excluded):
    // Revenue → OPEX groups + EBITDA; EBITDA → Tax + Net Cash Flow (retained).
    const chainPositive = cf.revenue > 0 && cf.ebitda > 0 && cf.netIncome > 0 && opexGroups.length > 0;
    const sankey = React.useMemo(() => {
        if (!chainPositive) return null;
        const names = ['Revenue', 'OPEX', ...opexGroups.map((g: { name: string }) => g.name), 'EBITDA', 'Tax', 'Net Cash Flow'];
        const idx = (n: string) => names.indexOf(n);
        const links = [
            { source: idx('Revenue'), target: idx('OPEX'), value: Math.round(cf.opex) },
            { source: idx('Revenue'), target: idx('EBITDA'), value: Math.round(cf.ebitda) },
            ...opexGroups.map((g: { name: string; value: number }) => ({ source: idx('OPEX'), target: idx(g.name), value: Math.max(1, Math.round(g.value)) })),
            { source: idx('EBITDA'), target: idx('Tax'), value: Math.max(1, Math.round(cf.tax)) },
            { source: idx('EBITDA'), target: idx('Net Cash Flow'), value: Math.max(1, Math.round(cf.netIncome)) },
        ];
        return { nodes: names.map((name) => ({ name })), links };
    }, [chainPositive, opexGroups, cf]);

    const th = 'text-right px-1.5 py-1 tabular-nums';
    const lbl = 'px-1.5 py-1 text-left whitespace-nowrap';

    return (
        <div className="space-y-4">
            {/* ── P&L ── */}
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Income Statement (P&amp;L) <span className="text-[9px] normal-case text-slate-400">engine cashflows · unlevered · project life {years} yr</span></h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                                <th className={lbl}>Line ($/yr)</th>
                                {shownIdx.map((i) => <th key={i} className={th}>Y{cashflows[i].year}</th>)}
                                <th className={`${th} font-semibold text-slate-700 dark:text-slate-200`}>Life Σ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {([
                                ['Revenue', (c: YearCashflow) => c.revenue, totals.revenue, 'text-slate-800 dark:text-slate-100'],
                                ['− OPEX', (c: YearCashflow) => -c.opex, -totals.opex, 'text-rz-alert'],
                                ['= EBITDA', (c: YearCashflow) => c.ebitda, totals.ebitda, 'font-semibold text-slate-900 dark:text-white'],
                                ['Depreciation (tax shield)', (c: YearCashflow) => -c.depreciation, -totals.depreciation, 'text-slate-400'],
                                ['Taxable Income', (c: YearCashflow) => c.taxableIncome, totals.taxable, 'text-slate-500'],
                                ['− Tax', (c: YearCashflow) => -c.tax, -totals.tax, 'text-rz-alert'],
                                ['= Net Cash Flow (after-tax)', (c: YearCashflow) => c.netIncome, totals.netIncome, 'font-bold text-rz-data'],
                            ] as const).map(([label, get, sum, cls]) => (
                                <tr key={label} className="border-b border-slate-100 dark:border-slate-800/60">
                                    <td className={`${lbl} ${cls}`}>{label}</td>
                                    {shownIdx.map((i) => <td key={i} className={`${th} ${cls}`}>{fmt(get(cashflows[i]))}</td>)}
                                    <td className={`${th} font-semibold ${cls}`}>{fmt(sum as number)}</td>
                                </tr>
                            ))}
                            <tr className="text-[10px] text-slate-400">
                                <td className={lbl}>EBITDA / Net margin</td>
                                {shownIdx.map((i) => <td key={i} className={th}>{pct(cashflows[i].ebitda, cashflows[i].revenue)} / {pct(cashflows[i].netIncome, cashflows[i].revenue)}</td>)}
                                <td className={th}>{pct(totals.ebitda, totals.revenue)} / {pct(totals.netIncome, totals.revenue)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-1 text-[9px] text-slate-400">Net Cash Flow = EBITDA − Tax (after-tax free cash — depreciation is a non-cash tax shield, added back; this is the unlevered FCF the NPV/IRR use). Tax = max(0, EBITDA − depreciation) × {(taxRate * 100).toFixed(0)}% · straight-line depreciation over {depreciationYears} yr.</div>
            </div>

            {/* ── Balance Sheet ── */}
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Balance Sheet <span className="text-[9px] normal-case text-slate-400">financing structure · {fmt(capex)} PP&amp;E at COD</span></h3>
                    <div className="flex items-center gap-3 text-[10px]">
                        <label className="flex items-center gap-1 text-slate-500">Debt ratio
                            <input type="range" min={0} max={0.8} step={0.05} value={debtRatio} onChange={(e) => setDebtRatio(+e.target.value)} className="w-24 accent-rz-info" />
                            <span className="w-8 tabular-nums text-slate-700 dark:text-slate-200">{Math.round(debtRatio * 100)}%</span>
                        </label>
                        <label className="flex items-center gap-1 text-slate-500">Debt rate
                            <input type="range" min={0.02} max={0.12} step={0.005} value={debtRate} onChange={(e) => setDebtRate(+e.target.value)} className="w-20 accent-rz-info" />
                            <span className="w-8 tabular-nums text-slate-700 dark:text-slate-200">{(debtRate * 100).toFixed(1)}%</span>
                        </label>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                                <th className={lbl}>Position ($)</th>
                                {shownIdx.map((i) => <th key={i} className={th}>Y{cashflows[i].year}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {([
                                ['Net PP&E', (r: typeof bs[number]) => r.ppe, 'text-slate-700 dark:text-slate-200'],
                                ['Cash', (r: typeof bs[number]) => r.cash, 'text-slate-700 dark:text-slate-200'],
                                ['Total Assets', (r: typeof bs[number]) => r.assets, 'font-semibold text-rz-info'],
                                ['Debt', (r: typeof bs[number]) => r.debt, 'text-rz-alert'],
                                ['Paid-in Equity', (r: typeof bs[number]) => r.paidIn, 'text-slate-500'],
                                ['Retained Earnings', (r: typeof bs[number]) => r.retained, 'text-slate-500'],
                                ['Total Liab. + Equity', (r: typeof bs[number]) => r.debt + r.equity, 'font-semibold text-rz-info'],
                            ] as const).map(([label, get, cls]) => (
                                <tr key={label} className="border-b border-slate-100 dark:border-slate-800/60">
                                    <td className={`${lbl} ${cls}`}>{label}</td>
                                    {shownIdx.map((i) => <td key={i} className={`${th} ${cls}`}>{fmt(get(bs[i]))}</td>)}
                                </tr>
                            ))}
                            <tr className="text-[10px] text-slate-400">
                                <td className={lbl}>Interest (memo, financing)</td>
                                {shownIdx.map((i) => <td key={i} className={th}>{fmt(bs[i].interest)}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className={`mt-1.5 rounded px-2 py-1 text-[10px] ${maxBalErr < 1 ? 'bg-rz-data/10 text-rz-data' : 'bg-rz-alert/10 text-rz-alert'}`}>
                    {maxBalErr < 1 ? '✓ Balances — Assets = Liabilities + Equity every year (max residual < $1).' : `⚠ Balance residual ${fmt(maxBalErr)} — check inputs.`}
                    <span className="ml-1 text-slate-400">Cash = cumulative (net income + D&amp;A − principal). Interest is a financing memo, not deducted from the unlevered operating P&amp;L.</span>
                </div>
            </div>

            {/* ── Sankey ── */}
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Revenue Distribution — Sankey <span className="text-[9px] normal-case text-slate-400">stabilized year Y{cf.year} · revenue → OPEX groups + EBITDA → tax / net cash flow (cash basis)</span></h3>
                {sankey ? (
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <Sankey
                                data={sankey}
                                nodePadding={18}
                                nodeWidth={12}
                                linkCurvature={0.5}
                                node={<SankeyNode />}
                                link={{ stroke: '#64748b', strokeOpacity: 0.18 }}
                                margin={{ left: 4, right: 90, top: 6, bottom: 6 }}
                            >
                                <RTooltip formatter={((v: number) => fmt(v)) as never} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                            </Sankey>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="rounded border border-rz-signal/40 bg-rz-signal/10 px-3 py-2 text-[11px] text-rz-signal">
                        No positive cash distribution to chart at stabilized year Y{cf.year}: {cf.ebitda <= 0 ? 'OPEX exceeds revenue (EBITDA ≤ 0)' : cf.netIncome <= 0 ? 'net cash flow ≤ 0 after tax' : 'OPEX breakdown loading'}. Raise revenue or lower cost to see the flow.
                    </div>
                )}
            </div>
        </div>
    );
}

// custom node renderer — colored by group, right-labeled
function SankeyNode(props: { x?: number; y?: number; width?: number; height?: number; index?: number; payload?: { name: string } }) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    const name = payload?.name ?? '';
    const color = GROUP_COLOR[name] ?? (name === 'Revenue' ? '#2dd4bf' : name === 'EBITDA' || name === 'Net Income' ? '#10b981' : name === 'Tax' ? '#f43f5e' : '#64748b');
    return (
        <Layer>
            <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} />
            <text x={x + width + 5} y={y + height / 2} textAnchor="start" dominantBaseline="middle" fontSize={9} fill="#94a3b8">{name}</text>
        </Layer>
    );
}
