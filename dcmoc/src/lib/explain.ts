/* ─── SHARED RZExplain KNOWLEDGE-DB BRIDGE ──────────────────────────────────
 * The repo-root `js/rz-explain-db.js` (loaded via a defer <script> in
 * layout.tsx <head>, absolute path so basePath does NOT rewrite it) sets
 * `window.RZ_EXPLAIN_DB = { version, counts, entries }` — 481 curated +
 * glossary entries keyed by slug (e.g. 'dscr', 'tab-invest').
 *
 * Same wrapper pattern as src/lib/rz-engine.ts: SSR-guarded, null/'' when the
 * DB or key is absent — consumers (e.g. <Explain/>) render nothing and the
 * build never breaks.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ExplainEntry {
    /** Term title */
    t: string;
    /** Definition */
    d: string;
    /** Formula (optional) */
    f?: string;
    /** Unit / typical range (optional) */
    u?: string;
    /** Source (optional) */
    s?: string;
}

interface ExplainDB {
    version?: string;
    counts?: { total?: number };
    entries?: Record<string, ExplainEntry | undefined>;
}

/** The DB entry for `key`, or null when the DB or key is absent (incl. SSR). */
export function explain(key: string): ExplainEntry | null {
    if (typeof window === 'undefined') return null;
    const db = (window as unknown as { RZ_EXPLAIN_DB?: ExplainDB }).RZ_EXPLAIN_DB;
    const entry = db?.entries?.[key];
    return entry ?? null;
}

/** The definition text (`d`) for `key`, or '' when unavailable. */
export function explainText(key: string): string {
    return explain(key)?.d ?? '';
}
