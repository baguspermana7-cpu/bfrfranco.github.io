'use client';

import React from 'react';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import { DollarSign, TrendingUp, Users } from 'lucide-react';

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
        { label: 'Base Salary', value: totalBase, color: 'bg-rz-info', text: 'text-rz-info', desc: 'Core monthly salaries for all FTEs.' },
        { label: 'Overtime / Loading', value: totalOT, color: 'bg-amber-500', text: 'text-amber-400', desc: 'Variable costs from shift patterns & holidays.' },
        { label: 'Social Security', value: totalSocial, color: 'bg-rz-mint', text: 'text-rz-mint', desc: 'Pension, Healthcare, BPJS contributions.' },
        { label: 'Allowances', value: totalBenefits, color: 'bg-rz-data', text: 'text-rz-data', desc: 'Transport, Meal, Housing allowances.' },
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

    // Running cumulative share for the waterfall rows
    let running = 0;

    return (
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-rz-data" />
                    Cost Structure Decomposition
                </h3>
                <div className="flex items-center gap-3">
                    <div className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1">
                        <span className="text-slate-400">Per FTE: </span>
                        <span className="text-rz-data font-bold">{formatMoney(perFTE)}</span>
                    </div>
                    {perFTE > 0 && (
                        <div className={`text-xs px-2 py-1 rounded ${perFTE <= INDUSTRY_BENCHMARK_PER_FTE ? 'bg-rz-data/10 text-rz-data' : 'bg-amber-950/30 text-amber-400'}`}>
                            {perFTE <= INDUSTRY_BENCHMARK_PER_FTE ? '✅' : '⚠️'} vs ${INDUSTRY_BENCHMARK_PER_FTE.toLocaleString()} benchmark
                        </div>
                    )}
                </div>
            </div>

            {/* 100% composition bar */}
            <div className="mb-4">
                <div className="flex h-6 w-full overflow-hidden rounded-md border border-slate-700/60">
                    {categories.map((cat, idx) => (
                        <div
                            key={idx}
                            className={`${cat.color} transition-opacity hover:opacity-80`}
                            style={{ width: `${getPct(cat.value)}%` }}
                            title={`${cat.label}: ${formatMoney(cat.value)} (${getPct(cat.value).toFixed(1)}%)`}
                        />
                    ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>0%</span>
                    <span>Monthly total <span className="font-bold text-rz-data">{formatMoney(total)}</span></span>
                    <span>100%</span>
                </div>
            </div>

            {/* Cumulative build-up rows (waterfall) */}
            <div className="flex-1 space-y-2.5">
                {categories.map((cat, idx) => {
                    const start = running;
                    running += cat.value;
                    const startPct = getPct(start);
                    const widthPct = getPct(cat.value);
                    return (
                        <div key={idx} className="group" title={cat.desc}>
                            <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                <span className={`font-bold ${cat.text}`}>{cat.label}</span>
                                <span className="whitespace-nowrap font-mono text-white">
                                    {formatMoney(cat.value)}
                                    <span className="ml-2 text-slate-500">{widthPct.toFixed(1)}%</span>
                                </span>
                            </div>
                            <div className="relative mt-0.5 h-2.5 w-full rounded-sm bg-slate-800/70">
                                <div
                                    className={`absolute top-0 h-full rounded-sm ${cat.color} transition-opacity group-hover:opacity-80`}
                                    style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 0.75)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500">
                                <span className="truncate pr-2">{cat.desc}</span>
                                <span className="whitespace-nowrap font-mono text-slate-600">Σ {formatMoney(running)}</span>
                            </div>
                        </div>
                    );
                })}
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
