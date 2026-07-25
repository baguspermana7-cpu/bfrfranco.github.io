'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import type { FinancialResult } from '@/modules/analytics/FinancialEngine';

const fmtUsd = (n: number) => Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${(n / 1e3).toFixed(0)}K`;

/** Cash Flow & ROI — cumulative cashflow curve + payback marker (engine-real). */
export function CashFlowRoi({ financial }: { financial: FinancialResult | null }) {
    if (!financial?.cashflows?.length) {
        return <Panel><p className="text-xs text-slate-500">Open the Financial engine for the cash-flow curve.</p></Panel>;
    }
    const data = [{ year: 0, cum: -(financial.cashflows[0].cumulativeCashflow - financial.cashflows[0].freeCashflow) }].concat(
        financial.cashflows.map((c) => ({ year: c.year, cum: c.cumulativeCashflow }))
    );
    const payback = financial.paybackPeriodYears;
    return (
        <Panel>
            <div className="flex items-center justify-between mb-1 gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cash Flow &amp; ROI</h2>
                {/* audit #5: explicit IRR basis label — each surface computes IRR on a
                  * DIFFERENT (legitimate) basis; label + tooltip reconcile them. */}
                <span className="text-right text-[10px] text-emerald-500"
                    title={'Basis IRR Dashboard: project IRR unlevered after-tax — revenue ilustratif $/kW·bln × ramp okupansi, eskalasi 3%, 15 tahun, pajak negara (calculateFinancials).\nHalaman lain memakai basis BERBEDA dan sah (angka tidak harus sama):\n· Financial Pro-Forma — aproksimasi model pro-forma sendiri (arus kas bersih/CAPEX)\n· Results "screening" — unlevered 15 thn flat, okupansi penuh, tanpa ramp/pajak\n· Site w/ incentives — screening + insentif pajak lokasi'}>
                    IRR {financial.irr.toFixed(1)}%
                    <span className="block text-[8.5px] font-normal normal-case text-slate-500">unlevered after-tax · ramp okupansi · 15 thn ⓘ</span>
                </span>
            </div>
            <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -8 }}>
                        <defs>
                            <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUsd(v)} width={40} />
                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                        {/* payback marker only when actually reached — a marker at year 15
                          * on a curve that never crosses zero would fabricate a payback */}
                        {financial.paybackReached && isFinite(payback) && payback > 0 && <ReferenceLine x={Math.round(payback)} stroke="#22d3ee" strokeDasharray="3 3" label={{ value: `Payback ${payback.toFixed(1)}y`, fontSize: 9, fill: '#22d3ee', position: 'insideTopRight' }} />}
                        <Tooltip formatter={((v: number) => [fmtUsd(v), 'Cumulative']) as never} labelFormatter={(l) => `Year ${l}`}
                            contentStyle={{ background: '#0f1424', border: '1px solid rgba(255,255,255,0.15)', fontSize: 11, borderRadius: 8 }}
                            labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} itemStyle={{ color: '#34d399' }} cursor={{ stroke: '#22d3ee', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="cum" stroke="#34d399" strokeWidth={2} fill="url(#cf)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Panel>
    );
}

function Panel({ children }: { children: React.ReactNode }) {
    return <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">{children}</div>;
}

export default CashFlowRoi;
