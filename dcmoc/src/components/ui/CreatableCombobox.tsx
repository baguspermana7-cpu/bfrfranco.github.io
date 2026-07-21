'use client';

/* ─── CreatableCombobox v2 — DROPDOWN-FIRST hybrid input ─────────────────────
 * OWNER CORRECTION (2026-07-19): the simple dropdown experience is PRESERVED
 * exactly — the control renders as a normal select-style button listing the
 * preset options. A "Custom value…" row at the bottom switches into typed-
 * entry mode (validated min/max; invalid → revert + hint; clear → fallback
 * default = caller receives null). Both modes always available.
 * No external library.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ChevronDown, X, Pencil, Check } from 'lucide-react';

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
    parse?: (raw: string) => T | null;
    allowText?: boolean;
    disabled?: boolean;
    className?: string;
}

export function CreatableCombobox<T extends string | number = number>({
    options, value, onChange, placeholder = 'Select…', unit, min, max, parse, allowText, disabled, className = '',
}: CreatableComboboxProps<T>) {
    const [open, setOpen] = React.useState(false);
    const [customMode, setCustomMode] = React.useState(false);
    const [text, setText] = React.useState('');
    const [hint, setHint] = React.useState<string | null>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const selectedOption = value != null && !value.isCustom ? options.find((o) => o.value === value.value) : null;
    const display = value == null ? '' : (selectedOption?.label ?? `${value.value}${unit ? ' ' + unit : ''}`);

    React.useEffect(() => {
        const onDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setCustomMode(false); }
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, []);

    React.useEffect(() => { if (customMode) inputRef.current?.focus(); }, [customMode]);

    const showHint = (msg: string) => {
        setHint(msg);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), 1800);
    };

    const doParse = parse ?? ((raw: string): T | null => {
        if (allowText) { const t2 = raw.trim(); return t2.length > 0 ? (t2 as T) : null; }
        const n = parseFloat(raw);
        if (!Number.isFinite(n)) return null;
        if (min != null && n < min) return null;
        if (max != null && n > max) return null;
        return n as T;
    });

    const commitCustom = () => {
        const parsed = doParse(text.trim());
        if (parsed == null) {
            showHint(min != null && max != null ? `Enter ${min}–${max}${unit ? ' ' + unit : ''}` : 'Invalid value');
            return;
        }
        onChange({ value: parsed, isCustom: true });
        setCustomMode(false); setOpen(false); setText('');
    };

    /* custom-entry mode: inline input replaces the button until commit/cancel */
    if (customMode) {
        return (
            <div ref={rootRef} className={`relative ${className}`}>
                <div className="flex items-center gap-1 rounded-lg border border-rz-mint bg-white dark:bg-slate-900/60 px-2">
                    <input ref={inputRef}
                        className="w-full bg-transparent py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
                        placeholder={min != null && max != null ? `${min}–${max}${unit ? ' ' + unit : ''}` : 'Custom value'}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitCustom(); }
                            else if (e.key === 'Escape') { setCustomMode(false); setText(''); }
                        }} />
                    {unit && <span className="text-[10px] text-slate-400 whitespace-nowrap">{unit}</span>}
                    <button type="button" onClick={commitCustom} className="text-rz-data"><Check className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => { setCustomMode(false); setText(''); }} className="text-slate-400"><X className="h-3.5 w-3.5" /></button>
                </div>
                {hint && <div className="absolute z-40 mt-0.5 text-[10px] text-amber-500">{hint}</div>}
            </div>
        );
    }

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            {/* select-style button — the familiar simple dropdown */}
            <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
                className={`flex w-full items-center gap-1 rounded-lg border bg-white dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-xs ${disabled ? 'opacity-50' : 'hover:border-rz-mint'}`}>
                <span className={`flex-1 truncate ${display ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>{display || placeholder}</span>
                {value?.isCustom && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-rz-mint/20 px-1 py-0.5 text-[9px] font-semibold text-rz-mint"
                        title="Custom value — click × to return to defaults"
                        onClick={(e) => { e.stopPropagation(); onChange(null); }}>
                        custom <X className="h-2.5 w-2.5" />
                    </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>
            {hint && <div className="absolute z-40 mt-0.5 text-[10px] text-amber-500">{hint}</div>}
            {open && (
                <ul role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl text-xs">
                    {options.map((o) => (
                        <li key={String(o.value)} role="option" aria-selected={value != null && !value.isCustom && value.value === o.value}
                            className={`cursor-pointer px-2 py-1.5 ${value != null && !value.isCustom && value.value === o.value ? 'bg-rz-mint/15 text-rz-mint' : 'text-slate-700 dark:text-slate-200 hover:bg-rz-mint/10'}`}
                            onPointerDown={(e) => { e.preventDefault(); onChange({ value: o.value, isCustom: false }); setOpen(false); }}>
                            {o.label}
                        </li>
                    ))}
                    {value != null && (
                        <li className="cursor-pointer border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 text-slate-400 hover:bg-slate-500/10"
                            onPointerDown={(e) => { e.preventDefault(); onChange(null); setOpen(false); }}>
                            Use default
                        </li>
                    )}
                    <li className="cursor-pointer border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 font-medium text-rz-mint hover:bg-rz-mint/10"
                        onPointerDown={(e) => { e.preventDefault(); setOpen(false); setCustomMode(true); setText(value?.isCustom ? String(value.value) : ''); }}>
                        <Pencil className="mr-1 inline h-3 w-3" /> Custom value…
                    </li>
                </ul>
            )}
        </div>
    );
}

export default CreatableCombobox;
