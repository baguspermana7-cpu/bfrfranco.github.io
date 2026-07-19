/* ─── SHARED RZEngine BRIDGE (engine DATA.version 2.5.0) ─────────────────────
 * DCMOC consumes site-wide constants from the shared engine (repo-root
 * `rz-engine.js`, loaded in the browser as `/rz-engine.min.js` via a defer
 * <script> in layout.tsx <head>, which executes BEFORE Next's deferred body
 * bundles — so `window.RZEngine` is present when store modules evaluate).
 *
 * During `next build` prerender (Node) the same engine is loaded through a
 * guarded eval('require') of `../rz-engine.js` (eval-wrapped so webpack does
 * NOT bundle it). Both environments therefore agree → no hydration mismatch.
 *
 * Every consumer keeps a LOCAL fallback: if the engine is absent for any
 * reason, `rzData()` / `rzModels()` return `{}` and callers fall back to the
 * DCMOC-local constants — the build and the app never break.
 * ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

let cached: any = null;
let nodeResolved = false;

function loadNodeEngine(): any {
    try {
        // eval so the bundler doesn't try to statically resolve/bundle the
        // CommonJS engine (it lives OUTSIDE the dcmoc/ package root).
        // eslint-disable-next-line no-eval
        const req = eval('require');
        const path = req('path');
        const fs = req('fs');
        // cwd is dcmoc/ under plain `next build`, but the repo root when the
        // bundler infers the workspace root — try both candidates.
        const candidates = [
            path.resolve(process.cwd(), '..', 'rz-engine.js'),
            path.resolve(process.cwd(), 'rz-engine.js'),
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) return req(p);
        }
        return null;
    } catch {
        return null;
    }
}

/** The shared engine object, or null when unavailable. */
export function getRZ(): any {
    if (typeof window !== 'undefined') {
        // Browser: injected by layout.tsx <script defer src="/rz-engine.min.js">.
        // Memoize only once found (never memoize a miss).
        if (!cached) cached = (window as any).RZEngine ?? null;
        return cached;
    }
    // Node / prerender
    if (!nodeResolved) {
        cached = loadNodeEngine();
        nodeResolved = true;
    }
    return cached;
}

/** `RZEngine.data` or `{}` — callers must keep local fallbacks. */
export function rzData(): any {
    return getRZ()?.data ?? {};
}

/** `RZEngine.models` or `{}` — callers must null-guard model functions. */
export function rzModels(): any {
    return getRZ()?.models ?? {};
}


/* ── DF2: engine-ready signal (audit: deferred rz-engine.min.js could finish
 * AFTER first render; useMemo captures of rzModels() never re-ran → stale
 * "engine missing" states like the CDU deep-sea "off" banner). getRZ callers
 * keep working; components that gate on the engine use useEngineReady(). ── */
let readyFired = false;
function fireReadyWhenPresent(): void {
    if (typeof window === 'undefined' || readyFired) return;
    if ((window as unknown as { RZEngine?: unknown }).RZEngine) {
        readyFired = true;
        window.dispatchEvent(new CustomEvent('rz-engine-ready'));
        return;
    }
    window.setTimeout(fireReadyWhenPresent, 150);
}
if (typeof window !== 'undefined') fireReadyWhenPresent();

import { useEffect, useState } from 'react';
export function useEngineReady(): boolean {
    const [ready, setReady] = useState<boolean>(() => typeof window !== 'undefined' && !!(window as unknown as { RZEngine?: unknown }).RZEngine);
    useEffect(() => {
        if (ready) return;
        const on = () => setReady(true);
        window.addEventListener('rz-engine-ready', on);
        return () => window.removeEventListener('rz-engine-ready', on);
    }, [ready]);
    return ready;
}
