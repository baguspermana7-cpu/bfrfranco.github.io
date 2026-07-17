'use client';

import React from 'react';
import { Sparkline } from './Sparkline';

export interface KpiCardProps {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    accent?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'blue';
    series?: number[];
    onClick?: () => void;
}

const ACCENTS: Record<string, { text: string; glow: string; spark: string }> = {
    cyan: { text: 'text-cyan-400', glow: 'from-cyan-500/20', spark: '#22d3ee' },
    emerald: { text: 'text-emerald-400', glow: 'from-emerald-500/20', spark: '#34d399' },
    violet: { text: 'text-violet-400', glow: 'from-violet-500/20', spark: '#a78bfa' },
    amber: { text: 'text-amber-400', glow: 'from-amber-500/20', spark: '#fbbf24' },
    rose: { text: 'text-rose-400', glow: 'from-rose-500/20', spark: '#fb7185' },
    blue: { text: 'text-blue-400', glow: 'from-blue-500/20', spark: '#60a5fa' },
};

/** DC-OS KPI card: dark panel + accent-glow + icon + big value + sub + real sparkline. */
export function KpiCard({ label, value, sub, icon: Icon, accent = 'cyan', series, onClick }: KpiCardProps) {
    const a = ACCENTS[accent];
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={`relative overflow-hidden text-left rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-3.5 ${onClick ? 'hover:border-cyan-400/40 cursor-pointer' : 'cursor-default'} transition-colors`}
        >
            <div className={`pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-2xl`} aria-hidden="true" />
            <div className="relative flex items-start justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                <Icon className={`w-4 h-4 ${a.text}`} aria-hidden="true" />
            </div>
            <div className="relative text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{value}</div>
            {sub && <div className="relative text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sub}</div>}
            <div className="relative mt-1.5 -mb-1">
                <Sparkline data={series} color={a.spark} height={26} />
            </div>
        </button>
    );
}

export default KpiCard;
