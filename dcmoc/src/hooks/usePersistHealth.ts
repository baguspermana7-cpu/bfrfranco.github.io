'use client';

/* ─── PERSIST HEALTH HOOK (Ship-3a) ─────────────────────────────────────────
 * Aggregates the session-local `persistFailed` flag from the 5 tracking
 * stores that write to localStorage manually (quota / private-mode failures
 * flip the flag; a later successful write clears it). The Shell header
 * renders ONE amber chip off `anyFailed`, with the failing store names in
 * the tooltip. Subscriptions are per-field zustand selectors, so the chip
 * re-renders only when a flag actually flips.
 * ──────────────────────────────────────────────────────────────────────── */

import { useOpsLog } from '@/store/opsLog';
import { useCxTracking } from '@/store/cxTracking';
import { useFinancialTracking } from '@/store/financialTracking';
import { useConstructionTracking } from '@/store/constructionTracking';
import { useSustainability } from '@/store/sustainability';

export interface PersistHealth {
    /** true when at least one tracking store failed to persist this session */
    anyFailed: boolean;
    /** Human-readable names of the failing stores (for the chip tooltip) */
    failedStores: string[];
}

export function usePersistHealth(): PersistHealth {
    const ops = useOpsLog((s) => s.persistFailed);
    const cx = useCxTracking((s) => s.persistFailed);
    const fin = useFinancialTracking((s) => s.persistFailed);
    const con = useConstructionTracking((s) => s.persistFailed);
    const sus = useSustainability((s) => s.persistFailed);

    const failedStores = [
        ops ? 'Ops Log' : null,
        cx ? 'Commissioning' : null,
        fin ? 'Financial' : null,
        con ? 'Construction' : null,
        sus ? 'Sustainability' : null,
    ].filter((name): name is string => name !== null);

    return { anyFailed: failedStores.length > 0, failedStores };
}
