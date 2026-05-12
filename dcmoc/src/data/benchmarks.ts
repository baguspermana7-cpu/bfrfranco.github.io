// ─── INDUSTRY BENCHMARK DATABASE ─────────────────────────────
// Sources: Uptime Institute Global Survey 2025, ASHRAE TC 9.9, Gartner DC Ops,
// JLL Global DC Report 2025, S&P Global Platts, IEA Data Centers & Energy 2025,
// CBRE DC Investment Outlook 2025, 451 Research / S&P Global MI

export interface BenchmarkMetric {
    id: string;
    name: string;
    unit: string;
    category: BenchmarkCategory;
    description: string;
    source: string;
    // Percentile values — lower is better for cost metrics, context-dependent for others
    lowerIsBetter: boolean;
    p10: number;   // Top 10% (best performers)
    p25: number;
    median: number;
    p75: number;
    p90: number;   // Bottom 10%
    tierOverrides?: Partial<Record<2 | 3 | 4, { p10: number; p25: number; median: number; p75: number; p90: number }>>;
}

export type BenchmarkCategory = 'energy' | 'staffing' | 'financial' | 'availability' | 'carbon';

export const BENCHMARK_CATEGORIES: Record<BenchmarkCategory, { label: string; color: string; darkColor: string }> = {
    energy: { label: 'Energy Efficiency', color: '#10b981', darkColor: '#34d399' },
    staffing: { label: 'Staffing', color: '#3b82f6', darkColor: '#60a5fa' },
    financial: { label: 'Financial', color: '#f59e0b', darkColor: '#fbbf24' },
    availability: { label: 'Availability', color: '#8b5cf6', darkColor: '#a78bfa' },
    carbon: { label: 'Carbon & ESG', color: '#ef4444', darkColor: '#f87171' },
};

export const BENCHMARKS: BenchmarkMetric[] = [
    // ─── ENERGY ─────────────────────────────────────────
    {
        id: 'pue',
        name: 'Power Usage Effectiveness',
        unit: 'PUE',
        category: 'energy',
        // 2025: industry median crept to ~1.56 (Uptime 2025); AI/liquid-cooled best-in-class 1.08-1.12
        description: 'Ratio of total facility power to IT equipment power',
        source: 'Uptime Institute Global Survey 2025',
        lowerIsBetter: true,
        p10: 1.10,
        p25: 1.20,
        median: 1.50,
        p75: 1.65,
        p90: 1.90,
    },
    {
        id: 'wue',
        name: 'Water Usage Effectiveness',
        unit: 'L/kWh',
        category: 'energy',
        description: 'Water consumed per kWh of IT energy',
        source: 'ASHRAE TC 9.9 / The Green Grid 2025',
        lowerIsBetter: true,
        p10: 0.2,
        p25: 0.5,
        median: 1.1,
        p75: 1.7,
        p90: 2.4,
    },
    {
        id: 'energy_cost_per_kw',
        name: 'Energy Cost per kW',
        unit: '$/kW/yr',
        category: 'energy',
        // 2025: global electricity cost pressure; Europe/SEA markets elevated
        description: 'Annual electricity cost per kW of IT load',
        source: 'IEA Data Centres & Energy 2025',
        lowerIsBetter: true,
        p10: 850,
        p25: 1200,
        median: 1700,
        p75: 2400,
        p90: 3200,
    },

    // ─── STAFFING ───────────────────────────────────────
    {
        id: 'staff_per_mw',
        name: 'Staff per MW',
        unit: 'FTE/MW',
        category: 'staffing',
        description: 'Full-time equivalent staff per MW of IT load',
        source: 'Uptime Institute Staffing Benchmark 2025',
        lowerIsBetter: true,
        p10: 3.5,
        p25: 5.0,
        median: 7.0,
        p75: 10.0,
        p90: 14.0,
        tierOverrides: {
            2: { p10: 2.5, p25: 3.5, median: 5.0, p75: 7.0, p90: 10.0 },
            4: { p10: 5.0, p25: 7.0, median: 10.0, p75: 14.0, p90: 18.0 },
        },
    },
    {
        id: 'labor_cost_pct_opex',
        name: 'Labor Cost % of OPEX',
        unit: '%',
        category: 'staffing',
        description: 'Percentage of operating expenses attributable to labor',
        source: 'Gartner DC Operations Report 2025',
        lowerIsBetter: true,
        p10: 18,
        p25: 25,
        median: 35,
        p75: 45,
        p90: 55,
    },
    {
        id: 'turnover_rate',
        name: 'Annual Staff Turnover',
        unit: '%',
        category: 'staffing',
        // 2025: DC talent shortage keeps turnover elevated; median ~16% globally
        description: 'Percentage of staff leaving annually',
        source: 'Uptime Institute HR Survey 2025',
        lowerIsBetter: true,
        p10: 5,
        p25: 10,
        median: 16,
        p75: 23,
        p90: 32,
    },

    // ─── FINANCIAL ──────────────────────────────────────
    {
        id: 'capex_per_kw',
        name: 'CAPEX per kW',
        unit: '$/kW',
        category: 'financial',
        // 2025: construction inflation + switchgear/copper lead-time premiums pushed costs up 20-40% since 2022
        description: 'Total capital expenditure per kW of IT capacity',
        source: 'JLL Global DC Report 2025 / T&T 2025',
        lowerIsBetter: true,
        p10: 8000,
        p25: 11000,
        median: 14500,
        p75: 20000,
        p90: 28000,
        tierOverrides: {
            2: { p10: 6000, p25: 8500, median: 11000, p75: 15000, p90: 20000 },
            4: { p10: 14000, p25: 19000, median: 24000, p75: 31000, p90: 42000 },
        },
    },
    {
        id: 'opex_per_kw',
        name: 'OPEX per kW',
        unit: '$/kW/yr',
        category: 'financial',
        // 2025: energy cost increases push OPEX benchmarks higher especially in EMEA/APAC
        description: 'Annual operating expenditure per kW of IT load',
        source: 'S&P Global MI / 451 Research 2025',
        lowerIsBetter: true,
        p10: 1400,
        p25: 2000,
        median: 2800,
        p75: 4000,
        p90: 5800,
    },
    {
        id: 'irr',
        name: 'Internal Rate of Return',
        unit: '%',
        category: 'financial',
        // 2025: AI-driven demand keeps IRR elevated; hyperscaler pre-leasing drives premium returns
        description: 'Expected IRR for new DC builds',
        source: 'CBRE DC Investment Outlook 2025',
        lowerIsBetter: false,
        p10: 28,
        p25: 20,
        median: 14,
        p75: 9,
        p90: 4,
    },
    {
        id: 'payback_years',
        name: 'Payback Period',
        unit: 'years',
        category: 'financial',
        description: 'Years to recover initial capital investment',
        source: 'JLL / Cushman & Wakefield DC Analytics 2025',
        lowerIsBetter: true,
        p10: 3.0,
        p25: 4.5,
        median: 6.0,
        p75: 8.5,
        p90: 13.0,
    },

    // ─── AVAILABILITY ───────────────────────────────────
    {
        id: 'uptime_pct',
        name: 'Annual Uptime',
        unit: '%',
        category: 'availability',
        description: 'Percentage of time the facility is fully operational',
        source: 'Uptime Institute Annual Outage Analysis 2025',
        lowerIsBetter: false,
        p10: 99.999,
        p25: 99.995,
        median: 99.982,
        p75: 99.95,
        p90: 99.90,
        tierOverrides: {
            2: { p10: 99.99, p25: 99.98, median: 99.95, p75: 99.90, p90: 99.75 },
            4: { p10: 99.9999, p25: 99.999, median: 99.995, p75: 99.99, p90: 99.98 },
        },
    },
    {
        id: 'mttr_hours',
        name: 'Mean Time to Repair',
        unit: 'hours',
        category: 'availability',
        description: 'Average time to restore service after an incident',
        source: 'Uptime Institute / IEEE Std 493 2025',
        lowerIsBetter: true,
        p10: 0.5,
        p25: 1.5,
        median: 4.0,
        p75: 8.0,
        p90: 24.0,
    },

    // ─── CARBON ─────────────────────────────────────────
    {
        id: 'cue',
        name: 'Carbon Usage Effectiveness',
        unit: 'kgCO2/kWh',
        category: 'carbon',
        // 2025: AI GPU clusters driving higher CUE in non-renewable markets; renewable leaders at <0.03
        description: 'Carbon emissions per kWh of IT energy consumed',
        source: 'The Green Grid / GHG Protocol 2025',
        lowerIsBetter: true,
        p10: 0.04,
        p25: 0.12,
        median: 0.32,
        p75: 0.55,
        p90: 0.82,
    },
    {
        id: 'renewable_pct',
        name: 'Renewable Energy %',
        unit: '%',
        category: 'carbon',
        // 2025: RE100 signatories up; hyperscalers driving median higher; many regional operators still at 0%
        description: 'Percentage of energy sourced from renewables',
        source: 'RE100 / CDP Climate Disclosure 2025',
        lowerIsBetter: false,
        p10: 100,
        p25: 80,
        median: 45,
        p75: 15,
        p90: 0,
    },
    {
        id: 'scope2_per_mw',
        name: 'Scope 2 Emissions per MW',
        unit: 'tCO2/MW/yr',
        category: 'carbon',
        description: 'Annual Scope 2 greenhouse gas emissions per MW of IT',
        source: 'IEA / GHG Protocol 2025',
        lowerIsBetter: true,
        p10: 180,
        p25: 750,
        median: 1900,
        p75: 3400,
        p90: 5200,
    },
];

// ─── HELPERS ────────────────────────────────────────────────

export function getBenchmarkForTier(metric: BenchmarkMetric, tier: 2 | 3 | 4) {
    const override = metric.tierOverrides?.[tier];
    if (override) return override;
    return { p10: metric.p10, p25: metric.p25, median: metric.median, p75: metric.p75, p90: metric.p90 };
}

export function getPercentileRank(value: number, metric: BenchmarkMetric, tier: 2 | 3 | 4): number {
    const b = getBenchmarkForTier(metric, tier);
    const points = metric.lowerIsBetter
        ? [
            { pct: 10, val: b.p10 },
            { pct: 25, val: b.p25 },
            { pct: 50, val: b.median },
            { pct: 75, val: b.p75 },
            { pct: 90, val: b.p90 },
        ]
        : [
            // For "higher is better", p10 is the BEST value
            { pct: 10, val: b.p10 },
            { pct: 25, val: b.p25 },
            { pct: 50, val: b.median },
            { pct: 75, val: b.p75 },
            { pct: 90, val: b.p90 },
        ];

    // For lowerIsBetter: value < p10 → percentile < 10 (better)
    // For higherIsBetter: value > p10 → percentile < 10 (better)
    if (metric.lowerIsBetter) {
        if (value <= points[0].val) return 5;
        if (value >= points[4].val) return 95;
        for (let i = 0; i < points.length - 1; i++) {
            if (value <= points[i + 1].val) {
                const range = points[i + 1].val - points[i].val;
                const frac = range > 0 ? (value - points[i].val) / range : 0;
                return points[i].pct + frac * (points[i + 1].pct - points[i].pct);
            }
        }
    } else {
        // Higher is better: p10 is highest value
        if (value >= points[0].val) return 5;
        if (value <= points[4].val) return 95;
        for (let i = 0; i < points.length - 1; i++) {
            if (value >= points[i + 1].val) {
                const range = points[i].val - points[i + 1].val;
                const frac = range > 0 ? (points[i].val - value) / range : 0;
                return points[i].pct + frac * (points[i + 1].pct - points[i].pct);
            }
        }
    }
    return 50;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export function percentileToGrade(percentile: number): Grade {
    if (percentile <= 25) return 'A';
    if (percentile <= 50) return 'B';
    if (percentile <= 75) return 'C';
    if (percentile <= 90) return 'D';
    return 'F';
}

export const GRADE_COLORS: Record<Grade, { bg: string; text: string; darkBg: string; darkText: string }> = {
    A: { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
    B: { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
    C: { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-900/30', darkText: 'dark:text-yellow-400' },
    D: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
    F: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
};
