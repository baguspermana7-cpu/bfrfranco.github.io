'use client';

import React from 'react';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import { DollarSign, TrendingUp, Users } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface CostWaterfallProps {
    staffing: StaffingResult[];
    currency: string;
    trainingCostMonthly?: number;
    turnoverCostMonthly?: number;
    vendorCostMonthly?: number;
}

const INDUSTRY_BENCHMARK_PER_FTE = 8500; // USD/month benchmark

export function CostWaterfall({ staffing, currency, trainingCostMonthly = 0, turnoverCostMonthly = 0, vendorCostMonthly = 0 }: CostWaterfallProps) {
    const totalBase = staffing.reduce((acc, r) => acc + r.breakdown.baseSalaries, 0);
    const totalOT = staffing.reduce((acc, r) => acc + r.breakdown.overtime, 0);
    const totalSocial = staffing.reduce((acc, r) => acc + r.breakdown.socialSecurity, 0);
    const totalBenefits = staffing.reduce((acc, r) => acc + r.breakdown.allowances, 0);
    const totalHeadcount = staffing.reduce((acc, r) => acc + r.headcount, 0);

    // Derived costs
    const shiftAllowance = totalOT * 0.15; // Shift differential ~ 15% of OT
    const training = trainingCostMonthly || totalBase * 0.03; // 3% of base if not provided
    const turnover = turnoverCostMonthly || totalBase * 0.05; // 5% of base if not provided
    const vendor = vendorCostMonthly;

    const categories = [
        { label: 'Base Salary', value: totalBase, color: 'bg-blue-500', text: 'text-blue-400', desc: 'Core monthly salaries for all FTEs.' },
        { label: 'Overtime / Loading', value: totalOT, color: 'bg-amber-500', text: 'text-amber-400', desc: 'Variable costs from shift patterns & holidays.' },
        { label: 'Social Security', value: totalSocial, color: 'bg-purple-500', text: 'text-purple-400', desc: 'Pension, Healthcare, BPJS contributions.' },
        { label: 'Allowances', value: totalBenefits, color: 'bg-emerald-500', text: 'text-emerald-400', desc: 'Transport, Meal, Housing allowances.' },
        { label: 'Shift Differential', value: shiftAllowance, color: 'bg-cyan-500', text: 'text-cyan-400', desc: 'Night/weekend shift premium (est. 15% of OT).' },
        { label: 'Training', value: training, color: 'bg-teal-500', text: 'text-teal-400', desc: 'Ongoing certification & skills development.' },
        { label: 'Turnover Cost', value: turnover, color: 'bg-rose-500', text: 'text-rose-400', desc: 'Recruitment, onboarding & lost productivity.' },
        { label: 'Vendor / Outsource', value: vendor, color: 'bg-orange-500', text: 'text-orange-400', desc: 'External contractor & managed service fees.' },
    ].filter(c => c.value > 0);

    const total = categories.reduce((acc, c) => acc + c.value, 0);
    const perFTE = totalHeadcount > 0 ? total / totalHeadcount : 0;

    const getPct = (val: number) => total > 0 ? (val / total) * 100 : 0;

    const formatMoney = (val: number) => new Intl.NumberFormat('en-US', {
        style: 'currency', currency, maximumFractionDigits: 0
    }).format(val);

    // Running cumulative totals
    let cumulative = 0;

    return (
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    Cost Structure Decomposition
                </h3>
                <div className="flex items-center gap-3">
                    <div className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1">
                        <span className="text-slate-400">Per FTE: </span>
                        <span className="text-emerald-400 font-bold">{formatMoney(perFTE)}</span>
                    </div>
                    {perFTE > 0 && (
                        <div className={`text-xs px-2 py-1 rounded ${perFTE <= INDUSTRY_BENCHMARK_PER_FTE ? 'bg-emerald-950/30 text-emerald-400' : 'bg-amber-950/30 text-amber-400'}`}>
                            {perFTE <= INDUSTRY_BENCHMARK_PER_FTE ? '✅' : '⚠️'} vs ${INDUSTRY_BENCHMARK_PER_FTE.toLocaleString()} benchmark
                        </div>
                    )}
                </div>
            </div>

            {/* Waterfall Chart */}
            <div className="flex-1 flex gap-1 items-end min-h-[280px] border-b border-slate-700 pb-0 relative">
                {/* Grid Lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between text-xs text-slate-600">
                    <div className="border-t border-slate-800/50 w-full pt-1">100%</div>
                    <div className="border-t border-slate-800/50 w-full pt-1">75%</div>
                    <div className="border-t border-slate-800/50 w-full pt-1">50%</div>
                    <div className="border-t border-slate-800/50 w-full pt-1">25%</div>
                    <div className="border-t border-slate-800/50 w-full pt-1">0%</div>
                </div>

                {/* Stacked Total Bar */}
                <div className="w-16 mx-1 relative z-20 flex flex-col justify-end h-full">
                    {categories.map((cat, idx) => (
                        <div
                            key={idx}
                            className={`w-full ${cat.color} hover:opacity-80 transition-opacity relative group`}
                            style={{ height: `${getPct(cat.value)}%` }}
                        >
                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 p-2 rounded z-50 hidden group-hover:block w-36">
                                <div className="text-xs text-slate-400">{cat.label}</div>
                                <div className="font-bold text-white">{formatMoney(cat.value)}</div>
                            </div>
                        </div>
                    ))}
                    <div className="text-center mt-2 text-[10px] font-bold text-white leading-tight">
                        Total<br />
                        <span className="text-emerald-400 text-xs">{formatMoney(total)}</span>
                    </div>
                </div>

                {/* Individual Waterfall Bars */}
                {/* B14: Refactored to use flexbox instead of absolute positioning */}
                {categories.map((cat, idx) => {
                    const prevCumulative = cumulative;
                    cumulative += cat.value;
                    const barHeight = getPct(cat.value);
                    const spacerHeight = getPct(prevCumulative);
                    return (
                        <div key={idx} className="flex-1 flex flex-col h-full z-10 group">
                            {/* Spacer pushes bar down (flex-grow fills top) */}
                            <div className="flex-1" />
                            {/* B1: Permanent value label */}
                            <div className="whitespace-nowrap text-[10px] font-bold w-full text-center text-white mb-1">
                                {formatMoney(cat.value)}
                            </div>
                            {/* Bar raised by cumulative spacer */}
                            <div
                                className={`w-full ${cat.color} rounded-t-sm relative`}
                                style={{ height: `${barHeight}%` }}
                            />
                            {/* Cumulative spacer below bar */}
                            {spacerHeight > 0 && (
                                <div style={{ height: `${spacerHeight}%` }} className="relative">
                                    {/* Connector line */}
                                    <div className="absolute top-0 left-0 w-full border-t border-dashed border-slate-600/50" />
                                </div>
                            )}
                            <div className="text-[10px] text-center text-slate-400 h-10 flex items-center justify-center leading-tight px-0.5">
                                {cat.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {categories.map((cat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${cat.color} mt-1 flex-shrink-0`} />
                        <div>
                            <div className={`text-xs font-bold ${cat.text}`}>{cat.label}</div>
                            <div className="text-[10px] text-slate-500">{cat.desc}</div>
                            <div className="text-[10px] text-slate-600 font-mono">{getPct(cat.value).toFixed(1)}%</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* FTE Summary Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Users className="w-3 h-3" />
                    <span>{totalHeadcount} FTEs</span>
                    <span className="text-slate-600">•</span>
                    <span>{formatMoney(perFTE)} per person/month</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <TrendingUp className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-500">Annual: </span>
                    <span className="text-white font-bold">{formatMoney(total * 12)}</span>
                </div>
            </div>
        </div>
    );
}
