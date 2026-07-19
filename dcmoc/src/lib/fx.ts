/* ─── LIVE FX (#337 part 2) ──────────────────────────────────────────────────
 * Currency conversion for display: LIVE rates from the existing
 * rz-finance-gateway `/fx` endpoint (no new backend), 1h TTL cache in
 * localStorage; offline/CORS fallback = engine DATA.currency snapshot
 * (sourced) with an honest 'snapshot' source flag. USD is the app's base.
 * ──────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { rzData } from '@/lib/rz-engine';

const GATEWAY = 'https://rz-finance-gateway.resistancezero0us.workers.dev';
const KEY = 'dcmoc-fx-cache-v1';
const TTL_MS = 3600_000;

export interface FxState { rates: Record<string, number>; source: 'live' | 'snapshot'; asOf: string }

function snapshotRates(): FxState {
    const cur = (rzData() as { currency?: Record<string, { perUsd?: number; rate?: number }> }).currency ?? {};
    const rates: Record<string, number> = { USD: 1 };
    for (const [code, c] of Object.entries(cur)) {
        const r = c.perUsd ?? c.rate;
        if (typeof r === 'number' && r > 0) rates[code] = r;
    }
    return { rates, source: 'snapshot', asOf: 'engine DATA.currency (sourced snapshot)' };
}

let mem: FxState | null = null;
let fetching = false;
const listeners = new Set<() => void>();

async function refresh(): Promise<void> {
    if (fetching) return;
    fetching = true;
    try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
        if (cached) {
            const p = JSON.parse(cached) as { at: number; rates: Record<string, number> };
            if (Date.now() - p.at < TTL_MS) {
                mem = { rates: { USD: 1, ...p.rates }, source: 'live', asOf: new Date(p.at).toISOString().slice(0, 16) + ' (cached)' };
                listeners.forEach((l) => l());
                return;
            }
        }
        const res = await fetch(`${GATEWAY}/fx`, { signal: AbortSignal.timeout(8000) });
        const j = await res.json() as { ok?: boolean; data?: { rates?: Record<string, number> } };
        const rates = j?.data?.rates;
        if (rates && Object.keys(rates).length > 0) {
            mem = { rates: { USD: 1, ...rates }, source: 'live', asOf: new Date().toISOString().slice(0, 16) };
            try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rates })); } catch { /* quota */ }
        } else {
            mem = snapshotRates();
        }
    } catch {
        mem = snapshotRates();
    } finally {
        fetching = false;
        listeners.forEach((l) => l());
    }
}

/** Live FX state hook — kicks a (cached) refresh on first mount. */
export function useFx(): FxState {
    const [, force] = useState(0);
    useEffect(() => {
        const bump = () => force((x) => x + 1);
        listeners.add(bump);
        if (!mem) void refresh();
        return () => { listeners.delete(bump); };
    }, []);
    return mem ?? snapshotRates();
}

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', IDR: 'Rp', SGD: 'S$', AUD: 'A$', INR: '₹' };

/** Convert a USD amount for display in `cur`; returns formatted string. */
export function fmtInCurrency(usd: number, cur: string, fx: FxState): string {
    const rate = cur === 'USD' ? 1 : fx.rates[cur];
    const sym = SYMBOL[cur] ?? cur + ' ';
    if (!rate) return `$${usd.toLocaleString()}`;
    const v = usd * rate;
    const s = Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0);
    return `${sym}${s}`;
}
