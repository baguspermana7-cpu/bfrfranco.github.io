/* ─── Shared illustrative finance defaults ────────────────────────────────────
 * ONE source for the illustrative revenue assumption so every surface (Executive
 * Dashboard, Financial, Report, Scenario Comparison) computes the SAME IRR for
 * the same project. Previously each hardcoded its own ($280 / $150 / $120),
 * so the same project showed contradictory returns. Users set the real number
 * in the Financial engine; this is only the labeled illustrative default.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Illustrative colocation revenue — $/kW·month. Mid-market rate that keeps the
 *  default project cash-positive (Executive IRR ~17%). Labeled "illustrative"
 *  wherever shown; the Financial module lets users override it. */
export const DEFAULT_REVENUE_PER_KW_MONTH = 280;
