// ─── INDUSTRY BENCHMARK DATABASE ─────────────────────────────
// Sources: Uptime Institute (2024), ASHRAE TC 9.9, Gartner DC Ops,
// JLL Global DC Report, S&P Global Platts, IEA Data Centers & Energy

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
        description: 'Ratio of total facility power to IT equipment power',
        source: 'Uptime Institute Global Survey 2024',
        lowerIsBetter: true,
        p10: 1.10,
        p25: 1.20,
        median: 1.35,
        p75: 1.55,
        p90: 1.80,
    },
    {
        id: 'wue',
        name: 'Water Usage Effectiveness',
        unit: 'L/kWh',
        category: 'energy',
        description: 'Water consumed per kWh of IT energy',
        source: 'ASHRAE TC 9.9 / The Green Grid',
        lowerIsBetter: true,
        p10: 0.2,
        p25: 0.6,
        median: 1.2,
        p75: 1.8,
        p90: 2.5,
    },
    {
        id: 'energy_cost_per_kw',
        name: 'Energy Cost per kW',
        unit: '$/kW/yr',
        category: 'energy',
        description: 'Annual electricity cost per kW of IT load',
        source: 'IEA Data Centres & Energy 2024',
        lowerIsBetter: true,
        p10: 800,
        p25: 1100,
        median: 1500,
        p75: 2000,
        p90: 2800,
    },

    // ─── STAFFING ───────────────────────────────────────
    {
        id: 'staff_per_mw',
        name: 'Staff per MW',
        unit: 'FTE/MW',
        category: 'staffing',
        description: 'Full-time equivalent staff per MW of IT load',
        source: 'Uptime Institute Staffing Benchmark 2024',
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
        source: 'Gartner DC Operations Report 2024',
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
        description: 'Percentage of staff leaving annually',
        source: 'Uptime Institute HR Survey 2024',
        lowerIsBetter: true,
        p10: 5,
        p25: 10,
        median: 15,
        p75: 22,
        p90: 30,
    },

    // ─── FINANCIAL ──────────────────────────────────────
    {
        id: 'capex_per_kw',
        name: 'CAPEX per kW',
        unit: '$/kW',
        category: 'financial',
        description: 'Total capital expenditure per kW of IT capacity',
        source: 'JLL Global DC Report 2024',
        lowerIsBetter: true,
        p10: 7000,
        p25: 9000,
        median: 12000,
        p75: 16000,
        p90: 22000,
        tierOverrides: {
            2: { p10: 5000, p25: 7000, median: 9000, p75: 12000, p90: 16000 },
            4: { p10: 12000, p25: 16000, median: 20000, p75: 26000, p90: 35000 },
        },
    },
    {
        id: 'opex_per_kw',
        name: 'OPEX per kW',
        unit: '$/kW/yr',
        category: 'financial',
        description: 'Annual operating expenditure per kW of IT load',
        source: 'S&P Global Platts / 451 Research',
        lowerIsBetter: true,
        p10: 1200,
        p25: 1800,
        median: 2500,
        p75: 3500,
        p90: 5000,
    },
    {
        id: 'irr',
        name: 'Internal Rate of Return',
        unit: '%',
        category: 'financial',
        description: 'Expected IRR for new DC builds',
        source: 'CBRE DC Investment Outlook 2024',
        lowerIsBetter: false,
        p10: 25,
        p25: 18,
        median: 13,
        p75: 8,
        p90: 4,
    },
    {
        id: 'payback_years',
        name: 'Payback Period',
        unit: 'years',
        category: 'financial',
        description: 'Years to recover initial capital investment',
        source: 'JLL / Cushman & Wakefield DC Analytics',
        lowerIsBetter: true,
        p10: 3.0,
        p25: 4.5,
        median: 6.0,
        p75: 8.0,
        p90: 12.0,
    },

    // ─── AVAILABILITY ───────────────────────────────────
    {
        id: 'uptime_pct',
        name: 'Annual Uptime',
        unit: '%',
        category: 'availability',
        description: 'Percentage of time the facility is fully operational',
        source: 'Uptime Institute Annual Outage Report 2024',
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
        source: 'Uptime Institute / IEEE',
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
        description: 'Carbon emissions per kWh of IT energy consumed',
        source: 'The Green Grid / GHG Protocol',
        lowerIsBetter: true,
        p10: 0.05,
        p25: 0.15,
        median: 0.35,
        p75: 0.55,
        p90: 0.80,
    },
    {
        id: 'renewable_pct',
        name: 'Renewable Energy %',
        unit: '%',
        category: 'carbon',
        description: 'Percentage of energy sourced from renewables',
        source: 'RE100 / CDP Climate Disclosure',
        lowerIsBetter: false,
        p10: 100,
        p25: 75,
        median: 40,
        p75: 15,
        p90: 0,
    },
    {
        id: 'scope2_per_mw',
        name: 'Scope 2 Emissions per MW',
        unit: 'tCO2/MW/yr',
        category: 'carbon',
        description: 'Annual Scope 2 greenhouse gas emissions per MW of IT',
        source: 'IEA / GHG Protocol',
        lowerIsBetter: true,
        p10: 200,
        p25: 800,
        median: 2000,
        p75: 3500,
        p90: 5000,
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
