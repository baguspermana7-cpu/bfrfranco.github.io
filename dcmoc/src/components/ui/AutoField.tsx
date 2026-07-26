import React from 'react';
import { Tooltip } from '@/components/ui/Tooltip';

/* ─── AutoField — per-field AUTO/OVERRIDE wrapper (owner mandate) ─────────────
 * AUTO (default): read-only value + green AUTO chip whose tooltip names the real
 * source. Tick the lock → OVERRIDE: the value becomes an editable input (amber
 * chip). Un-tick → back to live AUTO. `display`/`parse` handle unit scaling
 * (e.g. percent fields store a fraction but show/edit whole %). Shared primitive
 * — used by the Financial page and (Workstream C) the CAPEX inputs. */
export function AutoField({ label, tip, override, value, source, onToggle, onChange, display, parse, suffix, min, max }: {
    label: string; tip?: string; auto?: boolean; override: boolean;
    value: number; source: string;
    onToggle: (on: boolean) => void; onChange: (v: number) => void;
    display?: (v: number) => string; parse?: (s: string) => number;
    suffix?: string; min?: number; max?: number;
}) {
    const inpCls = "w-full p-1.5 text-sm text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-cyan-500";
    const shown = display ? display(value) : String(value);
    return (
        <div className="space-y-1">
            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                {label}{suffix ? ` ${suffix}` : ''}
                {tip && <Tooltip content={tip} />}
                <span className="ml-auto flex items-center gap-1">
                    <span title={source} className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase cursor-help ${override ? 'bg-rz-signal/15 text-rz-signal' : 'bg-rz-data/15 text-rz-data'}`}>
                        {override ? 'override' : 'auto'}
                    </span>
                    <button type="button" onClick={() => onToggle(!override)}
                        title={override ? 'Return to AUTO' : 'Override manually'}
                        className={`rounded border px-1 py-0.5 text-[8px] font-semibold ${override ? 'border-rz-signal/40 text-rz-signal' : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                        {override ? '✓ manual' : 'tick to edit'}
                    </button>
                </span>
            </label>
            {override ? (
                <input type="number" className={inpCls} value={shown} min={min} max={max}
                    onChange={e => onChange(parse ? parse(e.target.value) : Number(e.target.value))} />
            ) : (
                <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {shown}
                </div>
            )}
        </div>
    );
}
