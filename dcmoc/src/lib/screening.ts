/* ─── SHARED SCREENING BASES (DF3 — audit: economically-material literals were
 * scattered/divergent: $150/kW/mo in Disaster+Tax, $120+rate×500 in Financial,
 * 280 in site ctx — with NO source). ONE home, ONE basis, labeled screening.
 * Colo blended revenue: retail colo lists ~$120-200/kW/mo (JLL/CBRE 2025
 * ranges); $150 = mid-band screening. Maintenance $50/kW/yr = planned-PM
 * screening share consistent with models.opex maintenance line order.
 * These are SCREENING numbers — every consumer must label them as such. */
/* single value with constants/finance DEFAULT_REVENUE_PER_KW_MONTH (the sim-store
 * tunable default) — re-exported so the two names can never drift apart. */
export { DEFAULT_REVENUE_PER_KW_MONTH as REVENUE_PER_KW_MONTH } from '@/constants/finance';
export const MAINT_PER_KW_YR = 50;         // $/kW/yr — maintenance screening share

/* Screening split of (PUE−1) overhead energy — ONE source (audit: capacity used
 * 62/24/8/6 while architecture used 60/30/5/5 → cross-page divergence).
 * Basis: cooling dominates DC overhead (~60%), electrical losses ~28%. */
export const OVERHEAD_SPLIT = { cooling: 0.60, power: 0.28, lighting: 0.06, other: 0.06 } as const;

/* ONE shared currency list (#337 — Settings & Requirements diverged; GBP/CNY
 * absent from Settings). Display conversion uses live gateway /fx with the
 * engine DATA.currency snapshot as offline fallback. */
export const CURRENCY_LIST = ['USD', 'EUR', 'GBP', 'SGD', 'JPY', 'IDR', 'AUD', 'INR', 'CNY'] as const;
