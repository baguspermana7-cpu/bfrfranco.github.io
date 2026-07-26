import React from 'react';

/* Shared status/label chip — ONE family for every small badge across the app
 * (IST status/category/risk, alt-power maturity, selected pills, …). Uses the
 * rz-* semantic tokens (theme-aware, no dark: pairs needed) so "pass" is one
 * colour site-wide: data = confirmed/online, alert = risk, signal = caution/CTA,
 * info = derived/measured, neutral = slate. */
export type ChipTone = 'data' | 'signal' | 'alert' | 'info' | 'neutral';

const TONE: Record<ChipTone, string> = {
    data: 'bg-rz-data/10 text-rz-data',
    signal: 'bg-rz-signal/10 text-amber-600 dark:text-rz-signal',
    alert: 'bg-rz-alert/10 text-rz-alert',
    info: 'bg-rz-info/10 text-cyan-700 dark:text-rz-info',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
};

export function StatusChip({ tone = 'neutral', children, className = '' }: {
    tone?: ChipTone; children: React.ReactNode; className?: string;
}) {
    return (
        <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${TONE[tone]} ${className}`}>
            {children}
        </span>
    );
}
