'use client';

import React from 'react';
import { Sparkline } from './Sparkline';
import { Tooltip } from '@/components/ui/Tooltip';
import { TraceValue } from '@/components/ui/TraceValue';

export interface KpiCardProps {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    accent?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'blue' | 'info' | 'data' | 'signal' | 'alert' | 'mint';
    series?: number[];
    onClick?: () => void;
    tip?: string;
    valueFormat?: (n: number) => string;
    seriesLabel?: string;
    /** value-trace id — wraps the value in the ƒx TraceValue popover */
    trace?: string;
}

// Accent = MEANING, not decoration (design.md §5). Each accent maps to a
// semantic instrument channel: signal-amber (cost/estimate/CTA), data-green
// (engine-sourced/good), info-cyan (derived/measured), alert-red (risk),
// mint (neutral user-facing). Legacy color names are aliased to meaning.
const ACCENTS: Record<string, { text: string; iconBg: string; spark: string }> = {
    info: { text: 'text-rz-info', iconBg: 'bg-rz-info/10', spark: '#00DDFF' },
    data: { text: 'text-rz-data', iconBg: 'bg-rz-data/10', spark: '#00FF88' },
    signal: { text: 'text-rz-signal', iconBg: 'bg-rz-signal/10', spark: '#FFAA00' },
    alert: { text: 'text-rz-alert', iconBg: 'bg-rz-alert/10', spark: '#FF3030' },
    mint: { text: 'text-rz-mint', iconBg: 'bg-rz-mint/10', spark: '#7DDDB4' },
    // legacy aliases → semantic
    cyan: { text: 'text-rz-info', iconBg: 'bg-rz-info/10', spark: '#00DDFF' },
    emerald: { text: 'text-rz-data', iconBg: 'bg-rz-data/10', spark: '#00FF88' },
    blue: { text: 'text-rz-info', iconBg: 'bg-rz-info/10', spark: '#00DDFF' },
    amber: { text: 'text-rz-signal', iconBg: 'bg-rz-signal/10', spark: '#FFAA00' },
    violet: { text: 'text-rz-mint', iconBg: 'bg-rz-mint/10', spark: '#7DDDB4' },
    rose: { text: 'text-rz-alert', iconBg: 'bg-rz-alert/10', spark: '#FF3030' },
};

/** DC-OS KPI card: dark panel + accent-glow + icon + big value + sub + real sparkline.
 *  Root is a <div role="button"> to allow nesting the ui/Tooltip (which contains a <button>). */
export function KpiCard({ label, value, sub, icon: Icon, accent = 'info', series, onClick, tip, valueFormat, seriesLabel, trace }: KpiCardProps) {
    const a = ACCENTS[accent] ?? ACCENTS.info;

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
            className={`group relative overflow-hidden text-left rounded border border-slate-200 dark:border-rz-2 bg-white dark:bg-rz-elevated p-3.5 h-full min-h-[112px] flex flex-col ${onClick ? 'hover:border-rz-info/40 cursor-pointer' : 'cursor-default'} transition-colors`}
        >
            <div className="relative flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight pr-1">{label}</span>
                <div className="shrink-0 flex items-center gap-0.5">
                    {tip && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Tooltip content={tip} />
                        </div>
                    )}
                    <span className={`w-6 h-6 rounded flex items-center justify-center ${a.iconBg}`}>
                        <Icon className={`w-3.5 h-3.5 ${a.text}`} aria-hidden="true" />
                    </span>
                </div>
            </div>
            {trace ? (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <TraceValue traceId={trace}>
                        <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{value}</div>
                    </TraceValue>
                </div>
            ) : (
                <div className="relative text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{value}</div>
            )}
            {sub && <div className="relative text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">{sub}</div>}
            <div className="relative mt-auto pt-1.5 -mb-1">
                <Sparkline data={series} color={a.spark} height={26} valueFormat={valueFormat} seriesLabel={seriesLabel} />
            </div>
        </div>
    );
}

export default KpiCard;
