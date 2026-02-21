'use client';

import React from 'react';
import { SensitivityResult } from '@/modules/analytics/SensitivityEngine';

interface TornadoChartProps {
    data: SensitivityResult[];
    maxItems?: number;
}

const TornadoChart: React.FC<TornadoChartProps> = ({ data, maxItems = 8 }) => {
    const items = data.slice(0, maxItems);
    if (items.length === 0) return null;

    const maxDelta = Math.max(...items.map(d => Math.max(Math.abs(d.deltaLow), Math.abs(d.deltaHigh))));
    const scale = maxDelta > 0 ? 100 / maxDelta : 1;

    const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
    const fmtVal = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
        return `$${n.toFixed(0)}`;
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">Sensitivity Analysis — Tornado Chart</h3>
                <span className="text-xs text-slate-600 dark:text-slate-500">±20% perturbation on base TCO of {fmtVal(items[0]?.baseTCO || 0)}/yr</span>
            </div>

            {/* Header */}
            <div className="flex items-center text-[10px] text-slate-600 dark:text-slate-500 uppercase mb-2 px-2">
                <div className="w-36 text-right pr-3">−20% Impact</div>
                <div className="flex-1 text-center">Parameter</div>
                <div className="w-36 pl-3">+20% Impact</div>
            </div>

            {/* Bars */}
            <div className="space-y-1.5">
                {items.map((item, i) => {
                    const lowWidth = Math.abs(item.deltaLow) * scale;
                    const highWidth = Math.abs(item.deltaHigh) * scale;

                    return (
                        <div key={item.parameter} className="flex items-center group hover:bg-slate-100 dark:hover:bg-slate-800/30 rounded px-2 py-1 transition-colors">
                            {/* Left bar (low / decrease) — B5: permanent labels */}
                            <div className="w-36 flex justify-end items-center">
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mr-2">
                                    {fmtPct(item.deltaLow)}
                                </span>
                                <div
                                    className="h-6 rounded-l transition-all duration-500 ease-out"
                                    style={{
                                        width: `${lowWidth}%`,
                                        backgroundColor: item.deltaLow < 0 ? '#10b981' : '#ef4444',
                                        opacity: 0.8 + (i === 0 ? 0.2 : 0),
                                    }}
                                />
                            </div>

                            {/* Center label */}
                            <div className="flex-1 text-center px-2">
                                <span className="text-xs font-medium text-slate-900 dark:text-slate-300">{item.label}</span>
                            </div>

                            {/* Right bar (high / increase) */}
                            <div className="w-36 flex items-center">
                                <div
                                    className="h-6 rounded-r transition-all duration-500 ease-out"
                                    style={{
                                        width: `${highWidth}%`,
                                        backgroundColor: item.deltaHigh > 0 ? '#ef4444' : '#10b981',
                                        opacity: 0.8 + (i === 0 ? 0.2 : 0),
                                    }}
                                />
                                <span className="text-[10px] text-red-600 dark:text-red-400 ml-2">
                                    {fmtPct(item.deltaHigh)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-600 dark:text-slate-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500/80" />
                    <span>Cost Decrease</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500/80" />
                    <span>Cost Increase</span>
                </div>
            </div>
        </div>
    );
};

export default TornadoChart;
