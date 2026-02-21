// ─── BENCHMARK ANALYSIS ENGINE ───────────────────────────────
// Compares user's DC configuration against industry benchmarks

import {
    BENCHMARKS,
    BenchmarkMetric,
    BenchmarkCategory,
    getPercentileRank,
    percentileToGrade,
    Grade,
    getBenchmarkForTier,
} from '@/data/benchmarks';

export interface MetricScore {
    metric: BenchmarkMetric;
    userValue: number;
    percentile: number;
    grade: Grade;
    tierBenchmarks: { p10: number; p25: number; median: number; p75: number; p90: number };
}

export interface BenchmarkResult {
    overallScore: number;          // 0-100 (100 = best)
    overallGrade: Grade;
    categoryScores: Record<BenchmarkCategory, { score: number; grade: Grade; count: number }>;
    metrics: MetricScore[];
    strengths: { metric: string; grade: Grade; detail: string }[];
    improvements: { metric: string; grade: Grade; detail: string; recommendation: string }[];
}

interface BenchmarkInputs {
    itLoadKw: number;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    tierLevel: 2 | 3 | 4;
    totalStaff: number;
    turnoverRate: number;
    totalCapex: number;
    annualOpex: number;
    irr: number;
    paybackYears: number;
    pue: number;
    annualCO2: number;
    gridCarbonIntensity: number;
    renewablePct: number;
}

const PUE_MAP: Record<string, number> = { air: 1.35, inrow: 1.28, rdhx: 1.18, liquid: 1.08 };

export function calculateBenchmark(inputs: BenchmarkInputs): BenchmarkResult {
    const {
        itLoadKw, coolingType, tierLevel, totalStaff, turnoverRate,
        totalCapex, annualOpex, irr, paybackYears, pue,
        annualCO2, gridCarbonIntensity, renewablePct,
    } = inputs;

    const mw = itLoadKw / 1000;
    const effectivePue = pue || PUE_MAP[coolingType] || 1.35;
    const annualEnergyKwh = itLoadKw * effectivePue * 8760;
    const energyCostPerKw = annualOpex > 0 ? (annualOpex * 0.6) / itLoadKw : 1500; // ~60% of OPEX is energy

    // Map user values to benchmark metric IDs
    const userValues: Record<string, number> = {
        pue: effectivePue,
        wue: effectivePue <= 1.15 ? 0.3 : effectivePue <= 1.3 ? 1.0 : 1.5, // Estimate from cooling type
        energy_cost_per_kw: energyCostPerKw,
        staff_per_mw: mw > 0 ? totalStaff / mw : 7,
        labor_cost_pct_opex: annualOpex > 0 ? Math.min(55, Math.max(15, (totalStaff * 50000) / annualOpex * 100)) : 35,
        turnover_rate: (turnoverRate || 0.15) * 100,
        capex_per_kw: itLoadKw > 0 ? totalCapex / itLoadKw : 12000,
        opex_per_kw: itLoadKw > 0 ? annualOpex / itLoadKw : 2500,
        irr: irr || 13,
        payback_years: paybackYears || 6,
        uptime_pct: tierLevel === 4 ? 99.995 : tierLevel === 3 ? 99.982 : 99.95,
        mttr_hours: tierLevel === 4 ? 1.0 : tierLevel === 3 ? 4.0 : 8.0,
        cue: gridCarbonIntensity ? gridCarbonIntensity / 1000 : 0.35,
        renewable_pct: renewablePct || 0,
        scope2_per_mw: mw > 0 ? annualCO2 / mw : 2000,
    };

    // Score each metric
    const metrics: MetricScore[] = BENCHMARKS.map(bm => {
        const userValue = userValues[bm.id] ?? 0;
        const percentile = getPercentileRank(userValue, bm, tierLevel);
        const grade = percentileToGrade(percentile);
        const tierBenchmarks = getBenchmarkForTier(bm, tierLevel);
        return { metric: bm, userValue, percentile, grade, tierBenchmarks };
    });

    // Category scores
    const catScores: Record<BenchmarkCategory, { total: number; count: number }> = {
        energy: { total: 0, count: 0 },
        staffing: { total: 0, count: 0 },
        financial: { total: 0, count: 0 },
        availability: { total: 0, count: 0 },
        carbon: { total: 0, count: 0 },
    };
    for (const m of metrics) {
        catScores[m.metric.category].total += (100 - m.percentile);
        catScores[m.metric.category].count++;
    }

    const categoryScores = {} as Record<BenchmarkCategory, { score: number; grade: Grade; count: number }>;
    for (const [cat, data] of Object.entries(catScores)) {
        const score = data.count > 0 ? Math.round(data.total / data.count) : 50;
        categoryScores[cat as BenchmarkCategory] = {
            score,
            grade: percentileToGrade(100 - score),
            count: data.count,
        };
    }

    // Overall score
    const overallScore = Math.round(
        metrics.reduce((sum, m) => sum + (100 - m.percentile), 0) / metrics.length
    );
    const overallGrade = percentileToGrade(100 - overallScore);

    // Strengths (top 3 best grades)
    const sorted = [...metrics].sort((a, b) => a.percentile - b.percentile);
    const strengths = sorted.slice(0, 3).map(m => ({
        metric: m.metric.name,
        grade: m.grade,
        detail: `Your ${m.metric.name} (${formatValue(m.userValue, m.metric.unit)}) ranks in the top ${Math.round(m.percentile)}th percentile`,
    }));

    // Improvements (bottom 3)
    const improvements = sorted.slice(-3).reverse().map(m => ({
        metric: m.metric.name,
        grade: m.grade,
        detail: `Your ${m.metric.name} (${formatValue(m.userValue, m.metric.unit)}) is at the ${Math.round(m.percentile)}th percentile`,
        recommendation: getRecommendation(m.metric.id, m.grade),
    }));

    return { overallScore, overallGrade, categoryScores, metrics, strengths, improvements };
}

function formatValue(value: number, unit: string): string {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 'PUE') return value.toFixed(2);
    if (unit === '$/kW' || unit === '$/kW/yr') return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (unit === 'years') return `${value.toFixed(1)} yr`;
    if (unit === 'hours') return `${value.toFixed(1)} hr`;
    return `${value.toFixed(2)} ${unit}`;
}

function getRecommendation(metricId: string, grade: Grade): string {
    const recs: Record<string, string> = {
        pue: 'Consider upgrading to more efficient cooling (in-row or liquid). Hot/cold aisle containment can reduce PUE by 0.1-0.2.',
        wue: 'Evaluate air-cooled or closed-loop systems to reduce water consumption.',
        energy_cost_per_kw: 'Negotiate long-term power purchase agreements (PPAs) or explore on-site generation.',
        staff_per_mw: 'Implement predictive maintenance and automation to reduce manual staffing requirements.',
        labor_cost_pct_opex: 'Consider hybrid staffing model or automation to optimize labor costs.',
        turnover_rate: 'Improve retention through compressed shift schedules (4on3off), training programs, and competitive compensation.',
        capex_per_kw: 'Review construction costs, consider modular builds, and optimize redundancy levels for actual SLA requirements.',
        opex_per_kw: 'Focus on energy efficiency improvements and maintenance optimization to reduce per-kW operating costs.',
        irr: 'Improve revenue per kW through premium services, or reduce CAPEX/OPEX to improve returns.',
        payback_years: 'Accelerate occupancy ramp-up and optimize pricing strategy.',
        uptime_pct: 'Invest in redundancy, predictive maintenance, and incident response training.',
        mttr_hours: 'Pre-stage critical spares, improve monitoring, and conduct regular drill exercises.',
        cue: 'Increase renewable energy procurement and optimize PUE to reduce carbon intensity.',
        renewable_pct: 'Pursue renewable PPAs, on-site solar/wind, or RECs to increase clean energy percentage.',
        scope2_per_mw: 'Switch to low-carbon grid regions or invest in renewable energy procurement.',
    };
    return recs[metricId] || 'Review operational processes and industry best practices for improvement opportunities.';
}
