'use client';

import React from 'react';
import { Sparkline } from './Sparkline';
import { Tooltip } from '@/components/ui/Tooltip';

export interface KpiCardProps {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    accent?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'blue';
    series?: number[];
    onClick?: () => void;
    tip?: string;
    valueFormat?: (n: number) => string;
    seriesLabel?: string;
}

const ACCENTS: Record<string, { text: string; glow: string; spark: string }> = {
    cyan: { text: 'text-cyan-400', glow: 'from-cyan-500/20', spark: '#22d3ee' },
    emerald: { text: 'text-emerald-400', glow: 'from-emerald-500/20', spark: '#34d399' },
    violet: { text: 'text-violet-400', glow: 'from-violet-500/20', spark: '#a78bfa' },
    amber: { text: 'text-amber-400', glow: 'from-amber-500/20', spark: '#fbbf24' },
    rose: { text: 'text-rose-400', glow: 'from-rose-500/20', spark: '#fb7185' },
    blue: { text: 'text-blue-400', glow: 'from-blue-500/20', spark: '#60a5fa' },
};

/** DC-OS KPI card: dark panel + accent-glow + icon + big value + sub + real sparkline.
 *  Root is a <div role="button"> to allow nesting the ui/Tooltip (which contains a <button>). */
export function KpiCard({ label, value, sub, icon: Icon, accent = 'cyan', series, onClick, tip, valueFormat, seriesLabel }: KpiCardProps) {
    const a = ACCENTS[accent];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={`group relative overflow-hidden text-left rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-3.5 h-full min-h-[112px] flex flex-col ${onClick ? 'hover:border-cyan-400/40 cursor-pointer' : 'cursor-default'} transition-colors`}
        >
            <div className={`pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-2xl`} aria-hidden="true" />
            <div className="relative flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight pr-1">{label}</span>
                <div className="shrink-0 flex items-center gap-0.5">
                    {tip && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Tooltip content={tip} />
                        </div>
                    )}
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br ${a.glow} to-transparent`}>
                        <Icon className={`w-3.5 h-3.5 ${a.text}`} aria-hidden="true" />
                    </span>
                </div>
            </div>
            <div className="relative text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{value}</div>
            {sub && <div className="relative text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">{sub}</div>}
            <div className="relative mt-auto pt-1.5 -mb-1">
                <Sparkline data={series} color={a.spark} height={26} valueFormat={valueFormat} seriesLabel={seriesLabel} />
            </div>
        </div>
    );
}

export default KpiCard;
