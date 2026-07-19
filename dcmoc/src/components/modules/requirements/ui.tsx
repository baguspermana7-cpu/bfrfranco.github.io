'use client';

/* ─── Requirements page UI primitives (Phase A) ──────────────────────────────
 * SectionCard / Field / Segmented / ChipRow / RadioList / QuarterPicker /
 * SliderRow — dual-theme Tailwind, violet accent per the DC-OS reference.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { Explain } from '@/components/ui/Explain';

export function SectionCard({ num, title, caption, id, children }: {
    num: string; title: string; caption?: string; id: string; children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <div className="mb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    <span className="text-violet-500 mr-1.5">{num}</span>{title}
                </h2>
                {caption && <p className="text-[11px] text-slate-500 mt-0.5">{caption}</p>}
            </div>
            {children}
        </section>
    );
}

export function Field({ label, required, children, hint, explainKey }: {
    label: string; required?: boolean; children: React.ReactNode; hint?: string;
    /** CC — RZExplain DB key; when set, an ⓘ tooltip renders beside the label. */
    explainKey?: string;
}) {
    /* OWNER UX CONVENTION: editable INPUT areas carry a violet left-accent on the
     * label — GENERATED values never do (they render as tinted read-only panels).
     * CC cascade: EVERY Field label is hoverable — explainKey → RZExplain panel;
     * else the hint doubles as the hover title; else a generated fallback. */
    return (
        <label className="block" title={hint ?? `${label} — parameter input`}>
            <span className="mb-1 flex items-center gap-1 border-l-2 border-violet-500 pl-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 cursor-help">
                {label}{required && <span className="text-violet-500 ml-0.5">*</span>}
                {explainKey && <Explain k={explainKey} />}
            </span>
            {children}
            {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
        </label>
    );
}

export function TextInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <input
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500 placeholder:text-slate-400"
            value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function Select<T extends string>({ value, onChange, options }: {
    value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
    return (
        <select
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500"
            value={value} onChange={(e) => onChange(e.target.value as T)}
        >
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

export function Segmented<T extends string | number>({ value, onChange, options }: {
    value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
    return (
        <div className="inline-flex flex-wrap rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
            {options.map((o) => (
                <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
                    className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${o.value === value
                        ? 'bg-violet-600 text-white'
                        : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-violet-600/10'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function ChipRow<T extends string>({ value, onChange, options }: {
    value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((o) => (
                <button key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${o.value === value
                        ? 'border-violet-500 bg-violet-600/15 text-violet-600 dark:text-violet-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function RadioList<T extends string>({ value, onChange, options }: {
    value: T; onChange: (v: T) => void; options: { value: T; label: string; sub?: string }[];
}) {
    return (
        <div className="space-y-1">
            {options.map((o) => (
                <button key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${o.value === value
                        ? 'border-violet-500 bg-violet-600/10'
                        : 'border-slate-200 dark:border-slate-800 hover:border-violet-400/60'}`}>
                    <span className={`h-3 w-3 rounded-full border-2 ${o.value === value ? 'border-violet-500 bg-violet-500' : 'border-slate-400'}`} />
                    <span className="text-slate-800 dark:text-slate-200">{o.label}</span>
                    {o.sub && <span className="ml-auto text-[10px] text-slate-400">{o.sub}</span>}
                </button>
            ))}
        </div>
    );
}

export function QuarterPicker({ value, onChange }: {
    value: { quarter: 1 | 2 | 3 | 4; year: number };
    onChange: (v: { quarter: 1 | 2 | 3 | 4; year: number }) => void;
}) {
    const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i);
    return (
        <div className="flex gap-1.5">
            <select className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100"
                value={value.quarter} onChange={(e) => onChange({ ...value, quarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
            <select className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100"
                value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );
}

export function SliderRow({ label, value, onChange, min = 0, max = 100, unit = '%' }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string;
}) {
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-32 text-slate-600 dark:text-slate-300">{label}</span>
            <input type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 accent-violet-500" />
            <span className="w-12 text-right tabular-nums text-slate-500">{value}{unit}</span>
        </div>
    );
}

export function NumInput({ value, onChange, min, max, placeholder, unit }: {
    value: number | null; onChange: (v: number | null) => void;
    min?: number; max?: number; placeholder?: string; unit?: string;
}) {
    return (
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 focus-within:border-violet-500">
            <input
                type="number" min={min} max={max}
                className="w-full bg-transparent py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
                value={value ?? ''} placeholder={placeholder}
                onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { onChange(null); return; }
                    const n = parseFloat(raw);
                    onChange(Number.isFinite(n) ? n : null);
                }}
            />
            {unit && <span className="text-[10px] text-slate-400 whitespace-nowrap">{unit}</span>}
        </div>
    );
}
