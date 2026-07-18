'use client';

/* ─── CreatableCombobox (Phase 0 shared primitive) ───────────────────────────
 * Hybrid input per the DC-OS program spec (owner STEP 2.3): the user can pick
 * a predefined option (legacy dropdown behavior) OR type a specific custom
 * value. Numeric custom values are validated against min/max; invalid input
 * reverts to the previous value with a short hint; clearing falls back to the
 * default (STEP 3 gentle degradation — the caller receives `null`).
 * No external library — Tailwind + native input + popover list.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface ComboValue<T extends string | number = number> {
    value: T;
    isCustom: boolean;
}

export interface CreatableComboboxProps<T extends string | number = number> {
    options: { value: T; label: string }[];
    /** null = "using default" (caller renders its fallback). */
    value: ComboValue<T> | null;
    onChange: (v: ComboValue<T> | null) => void;
    placeholder?: string;
    unit?: string;
    min?: number;
    max?: number;
    /** Parse typed text → value; return null to reject. Default: numeric parse + bounds. */
    parse?: (raw: string) => T | null;
    /** Free-text mode (vendor names etc) — skips numeric parsing. */
    allowText?: boolean;
    disabled?: boolean;
    className?: string;
}

export function CreatableCombobox<T extends string | number = number>({
    options, value, onChange, placeholder = 'Select or type…', unit, min, max, parse, allowText, disabled, className = '',
}: CreatableComboboxProps<T>) {
    const [open, setOpen] = React.useState(false);
    const [text, setText] = React.useState('');
    const [hint, setHint] = React.useState<string | null>(null);
    const [active, setActive] = React.useState(0);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const display = value == null ? '' : String(value.value);

    React.useEffect(() => { setText(display); }, [display]);

    React.useEffect(() => {
        const onDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setText(display); }
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [display]);

    const showHint = (msg: string) => {
        setHint(msg);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 1800);
    };

    const defaultParse = (raw: string): T | null => {
        if (allowText) {
            const t = raw.trim();
            return t.length > 0 ? (t as T) : null;
        }
        const n = parseFloat(raw);
        if (!Number.isFinite(n)) return null;
        if (min != null && n < min) return null;
        if (max != null && n > max) return null;
        return n as T;
    };
    const doParse = parse ?? defaultParse;

    const filtered = text.trim().length === 0
        ? options
        : options.filter((o) => o.label.toLowerCase().includes(text.trim().toLowerCase()) || String(o.value).includes(text.trim()));

    const customCandidate = (() => {
        const t = text.trim();
        if (!t) return null;
        if (options.some((o) => String(o.value) === t)) return null;
        return doParse(t);
    })();

    const commitOption = (o: { value: T; label: string }) => {
        onChange({ value: o.value, isCustom: false });
        setOpen(false);
    };
    const commitCustom = () => {
        const parsed = doParse(text.trim());
        if (parsed == null) {
            showHint(min != null && max != null ? `Enter ${min}–${max}${unit ? ' ' + unit : ''}` : 'Invalid value');
            setText(display); // revert (STEP 3)
            return;
        }
        onChange({ value: parsed, isCustom: true });
        setOpen(false);
    };
    const commitBlurOrEnter = () => {
        const t = text.trim();
        if (!t) { onChange(null); setOpen(false); return; } // cleared → fallback default
        const exact = options.find((o) => String(o.value) === t || o.label === t);
        if (exact) { commitOption(exact); return; }
        commitCustom();
    };

    const rows: Array<{ kind: 'option'; o: { value: T; label: string } } | { kind: 'custom' }> = [
        ...filtered.map((o) => ({ kind: 'option' as const, o })),
        ...(customCandidate != null ? [{ kind: 'custom' as const }] : []),
    ];

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            const r = rows[active];
            if (r?.kind === 'option') commitOption(r.o);
            else if (r?.kind === 'custom') commitCustom();
            else commitBlurOrEnter();
        } else if (e.key === 'Escape') { setOpen(false); setText(display); }
    };

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <div className={`flex items-center gap-1 rounded-lg border bg-white dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 focus-within:border-violet-500 px-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    disabled={disabled}
                    className="w-full bg-transparent py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => { /* commit on blur unless an option row is being clicked (pointerdown handler closes) */ }}
                    onKeyDown={onKeyDown}
                />
                {unit && <span className="text-[10px] text-slate-400 whitespace-nowrap">{unit}</span>}
                {value?.isCustom && (
                    <button type="button" title="Clear custom value (use default)" onClick={() => onChange(null)}
                        className="inline-flex items-center gap-0.5 rounded bg-violet-600/20 text-violet-500 dark:text-violet-300 px-1 py-0.5 text-[9px] font-semibold">
                        custom <X className="w-2.5 h-2.5" />
                    </button>
                )}
                <button type="button" tabIndex={-1} onClick={() => setOpen((o) => !o)} className="text-slate-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                </button>
            </div>
            {hint && <div className="absolute z-40 mt-0.5 text-[10px] text-amber-500">{hint}</div>}
            {open && rows.length > 0 && (
                <ul role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl text-xs">
                    {rows.map((r, i) => r.kind === 'option' ? (
                        <li key={`o-${String(r.o.value)}`} role="option" aria-selected={i === active}
                            className={`cursor-pointer px-2 py-1.5 ${i === active ? 'bg-violet-600/15 text-violet-600 dark:text-violet-300' : 'text-slate-700 dark:text-slate-200'}`}
                            onPointerDown={(e) => { e.preventDefault(); commitOption(r.o); }}
                            onMouseEnter={() => setActive(i)}>
                            {r.o.label}
                        </li>
                    ) : (
                        <li key="custom" role="option" aria-selected={i === active}
                            className={`cursor-pointer border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 font-medium ${i === active ? 'bg-violet-600/15 text-violet-600 dark:text-violet-300' : 'text-violet-500'}`}
                            onPointerDown={(e) => { e.preventDefault(); commitCustom(); }}
                            onMouseEnter={() => setActive(i)}>
                            Use “{text.trim()}”{unit ? ` ${unit}` : ''}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default CreatableCombobox;
