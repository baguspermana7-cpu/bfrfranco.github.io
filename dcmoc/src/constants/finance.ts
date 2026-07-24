/* ─── Shared illustrative finance defaults ────────────────────────────────────
 * ONE source for the illustrative revenue assumption so every surface (Executive
 * Dashboard, Financial, Report, Scenario Comparison) computes the SAME IRR for
 * the same project. Previously each hardcoded its own ($280 / $150 / $120),
 * so the same project showed contradictory returns. Users set the real number
 * in the Financial engine; this is only the labeled illustrative default.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Illustrative colocation revenue — $/kW·month. MUST match the sim-store
 *  optimizer-tunable default (`store/simulation.ts inputs.revenuePerKwMonth`)
 *  — the store value is the live SSOT; this constant is only the fallback when
 *  the store field is absent. 150 = conservative wholesale colo rate; the
 *  optimizer / Financial module raise it explicitly (visible, never silent). */
export const DEFAULT_REVENUE_PER_KW_MONTH = 150;

/** Illustrative straight-line depreciation horizon — years. One convention for
 *  every DCF surface: blended facility M&E (MACRS-class equipment 7-15 yr,
 *  building shell far longer) → 15-yr screening blend. Surfaces previously
 *  diverged (7 in Benchmark/MC/Scenario/Portfolio, 20 in Report, 15 in
 *  Financial/Investment/trace) so the SAME project tax-shielded differently
 *  per page. Financial module lets users override. */
export const DEFAULT_DEPRECIATION_YEARS = 15;
