// ─── MONTE CARLO RISK SIMULATION ENGINE ──────────────────────
// Stochastic simulation with reproducible PRNG for financial risk analysis

import { calculateFinancials, FinancialInputs } from './FinancialEngine';

// ─── PRNG (xoshiro128**) ────────────────────────────────────
class PRNG {
    private s: Uint32Array;

    constructor(seed: number) {
        this.s = new Uint32Array(4);
        // Splitmix64 to seed xoshiro
        let z = seed >>> 0;
        for (let i = 0; i < 4; i++) {
            z = (z + 0x9e3779b9) >>> 0;
            let t = z ^ (z >>> 16);
            t = Math.imul(t, 0x85ebca6b);
            t ^= t >>> 13;
            t = Math.imul(t, 0xc2b2ae35);
            t ^= t >>> 16;
            this.s[i] = t >>> 0;
        }
    }

    next(): number {
        const s = this.s;
        const result = Math.imul(s[1] * 5, 1 << 7 | 1 >>> 25);
        const t = s[1] << 9;
        s[2] ^= s[0];
        s[3] ^= s[1];
        s[1] ^= s[2];
        s[0] ^= s[3];
        s[2] ^= t;
        s[3] = (s[3] << 11) | (s[3] >>> 21);
        return (result >>> 0) / 4294967296;
    }

    // Box-Muller transform for normal distribution
    normal(mean: number, stdDev: number): number {
        const u1 = this.next();
        const u2 = this.next();
        const z = Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
        return mean + z * stdDev;
    }

    // Triangular distribution
    triangular(min: number, mode: number, max: number): number {
        const u = this.next();
        const fc = (mode - min) / (max - min);
        if (u < fc) {
            return min + Math.sqrt(u * (max - min) * (mode - min));
        }
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }

    // Uniform distribution
    uniform(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
}

// ─── STOCHASTIC VARIABLES ───────────────────────────────────

export interface StochasticVariable {
    id: string;
    name: string;
    distribution: 'normal' | 'triangular' | 'uniform';
    enabled: boolean;
    // Distribution parameters (interpret based on distribution type)
    mean: number;       // For normal: center; For triangular: mode; For uniform: center
    spread: number;     // For normal: stdDev; For triangular: half-range; For uniform: half-range
    unit: string;
    description: string;
}

export const DEFAULT_STOCHASTIC_VARIABLES: StochasticVariable[] = [
    { id: 'powerCost', name: 'Power Cost', distribution: 'normal', enabled: true, mean: 1.0, spread: 0.15, unit: '±%', description: 'Electricity rate variation (±15%)' },
    { id: 'pue', name: 'PUE Variance', distribution: 'triangular', enabled: true, mean: 1.0, spread: 0.10, unit: '±%', description: 'Power usage effectiveness fluctuation' },
    { id: 'occupancy', name: 'Occupancy Ramp', distribution: 'uniform', enabled: true, mean: 1.0, spread: 0.20, unit: '±%', description: 'Demand uncertainty (±20%)' },
    { id: 'capex', name: 'CAPEX Variance', distribution: 'normal', enabled: true, mean: 1.0, spread: 0.10, unit: '±%', description: 'Construction cost overrun/underrun (±10%)' },
    { id: 'revenue', name: 'Revenue/kW', distribution: 'normal', enabled: true, mean: 1.0, spread: 0.12, unit: '±%', description: 'Pricing pressure/premium (±12%)' },
    { id: 'opexEscalation', name: 'OPEX Escalation', distribution: 'uniform', enabled: true, mean: 0, spread: 0.015, unit: '±abs', description: 'Annual OPEX growth rate variance (±1.5%)' },
    { id: 'taxRate', name: 'Tax Rate', distribution: 'uniform', enabled: true, mean: 0, spread: 0.03, unit: '±abs', description: 'Effective tax rate variance (±3%)' },
    { id: 'discountRate', name: 'Discount Rate', distribution: 'normal', enabled: true, mean: 0, spread: 0.01, unit: '±abs', description: 'WACC / hurdle rate variance (±1%)' },
];

// ─── DISTRIBUTION STATS ─────────────────────────────────────

export interface DistributionStats {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    p5: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    p95: number;
    values: number[];
}

export interface HistogramBin {
    binStart: number;
    binEnd: number;
    count: number;
    frequency: number;
}

export interface MonteCarloResult {
    iterations: number;
    seed: number;
    npvStats: DistributionStats;
    irrStats: DistributionStats;
    paybackStats: DistributionStats;
    npvHistogram: HistogramBin[];
    irrHistogram: HistogramBin[];
    paybackHistogram: HistogramBin[];
    // Risk metrics
    varNpv5: number;          // Value at Risk (5th percentile NPV)
    varNpv1: number;          // VaR at 1st percentile
    probNpvNegative: number;  // P(NPV < 0)
    probIrrBelow10: number;   // P(IRR < 10%)
    probPaybackOver7: number; // P(Payback > 7 years)
    // Convergence
    convergenceHistory: { iteration: number; meanNpv: number }[];
    // Sensitivity (correlation of each variable with NPV)
    sensitivity: { variable: string; correlation: number }[];
    durationMs: number;
}

// ─── HELPERS ────────────────────────────────────────────────

function computeStats(values: number[]): DistributionStats {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;

    const pctile = (p: number) => {
        const idx = (p / 100) * (n - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        const frac = idx - lo;
        return sorted[lo] * (1 - frac) + sorted[hi] * frac;
    };

    return {
        mean,
        median: pctile(50),
        stdDev: Math.sqrt(variance),
        min: sorted[0],
        max: sorted[n - 1],
        p5: pctile(5),
        p10: pctile(10),
        p25: pctile(25),
        p75: pctile(75),
        p90: pctile(90),
        p95: pctile(95),
        values: sorted,
    };
}

function buildHistogram(values: number[], bins: number = 40): HistogramBin[] {
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min || 1;
    const binWidth = range / bins;
    const histogram: HistogramBin[] = [];

    for (let i = 0; i < bins; i++) {
        histogram.push({
            binStart: min + i * binWidth,
            binEnd: min + (i + 1) * binWidth,
            count: 0,
            frequency: 0,
        });
    }

    for (const v of values) {
        const idx = Math.min(bins - 1, Math.floor((v - min) / binWidth));
        histogram[idx].count++;
    }

    const n = values.length;
    for (const bin of histogram) {
        bin.frequency = bin.count / n;
    }

    return histogram;
}

function pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den > 0 ? num / den : 0;
}

// ─── MAIN SIMULATION ───────────────────────────────────────

export function runMonteCarlo(
    baseInputs: FinancialInputs,
    variables: StochasticVariable[],
    iterations: number = 10000,
    seed: number = 42,
): MonteCarloResult {
    const t0 = performance.now();
    const rng = new PRNG(seed);

    const npvResults: number[] = [];
    const irrResults: number[] = [];
    const paybackResults: number[] = [];
    const variableSamples: Record<string, number[]> = {};

    // Initialize sample arrays for enabled variables
    const enabled = variables.filter(v => v.enabled);
    for (const v of enabled) {
        variableSamples[v.id] = [];
    }

    const convergenceHistory: { iteration: number; meanNpv: number }[] = [];
    let npvSum = 0;
    const convergenceStep = Math.max(1, Math.floor(iterations / 100));

    for (let i = 0; i < iterations; i++) {
        // Sample stochastic variables
        const samples: Record<string, number> = {};
        for (const v of enabled) {
            let sample: number;
            if (v.distribution === 'normal') {
                sample = rng.normal(v.mean, v.spread);
            } else if (v.distribution === 'triangular') {
                sample = rng.triangular(v.mean - v.spread, v.mean, v.mean + v.spread);
            } else {
                sample = rng.uniform(v.mean - v.spread, v.mean + v.spread);
            }
            samples[v.id] = sample;
            variableSamples[v.id].push(sample);
        }

        // Apply perturbations to financial inputs
        const perturbed: FinancialInputs = { ...baseInputs };

        // Multiplicative variables (applied as multiplier)
        if (samples.powerCost) {
            perturbed.annualOpex = baseInputs.annualOpex * samples.powerCost;
        }
        if (samples.capex) {
            perturbed.totalCapex = baseInputs.totalCapex * samples.capex;
        }
        if (samples.revenue) {
            perturbed.revenuePerKwMonth = baseInputs.revenuePerKwMonth * samples.revenue;
        }
        if (samples.occupancy) {
            perturbed.occupancyRamp = baseInputs.occupancyRamp.map(o => Math.min(1, Math.max(0, o * samples.occupancy)));
        }

        // Additive variables
        if (samples.opexEscalation !== undefined) {
            perturbed.opexEscalation = Math.max(0, baseInputs.opexEscalation + samples.opexEscalation);
        }
        if (samples.taxRate !== undefined) {
            perturbed.taxRate = Math.max(0, Math.min(0.5, baseInputs.taxRate + samples.taxRate));
        }
        if (samples.discountRate !== undefined) {
            perturbed.discountRate = Math.max(0.01, baseInputs.discountRate + samples.discountRate);
        }

        // PUE affects OPEX (energy component ~60% of OPEX)
        if (samples.pue) {
            const energyFraction = 0.6;
            const pueMultiplier = samples.pue;
            perturbed.annualOpex = perturbed.annualOpex * (1 - energyFraction + energyFraction * pueMultiplier);
        }

        const result = calculateFinancials(perturbed);
        npvResults.push(result.npv);
        irrResults.push(result.irr);
        paybackResults.push(result.paybackPeriodYears);

        npvSum += result.npv;
        if ((i + 1) % convergenceStep === 0 || i === iterations - 1) {
            convergenceHistory.push({ iteration: i + 1, meanNpv: npvSum / (i + 1) });
        }
    }

    // Compute stats
    const npvStats = computeStats(npvResults);
    const irrStats = computeStats(irrResults);
    const paybackStats = computeStats(paybackResults);

    // Histograms
    const npvHistogram = buildHistogram(npvResults);
    const irrHistogram = buildHistogram(irrResults);
    const paybackHistogram = buildHistogram(paybackResults);

    // Risk metrics
    const varNpv5 = npvStats.p5;
    const varNpv1 = computeStats(npvResults).values[Math.floor(iterations * 0.01)];
    const probNpvNegative = npvResults.filter(v => v < 0).length / iterations;
    const probIrrBelow10 = irrResults.filter(v => v < 10).length / iterations;
    const probPaybackOver7 = paybackResults.filter(v => v > 7).length / iterations;

    // Sensitivity analysis — correlation of each variable with NPV
    const sensitivity = enabled.map(v => ({
        variable: v.name,
        correlation: pearsonCorrelation(variableSamples[v.id], npvResults),
    })).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    const durationMs = performance.now() - t0;

    return {
        iterations,
        seed,
        npvStats,
        irrStats,
        paybackStats,
        npvHistogram,
        irrHistogram,
        paybackHistogram,
        varNpv5,
        varNpv1,
        probNpvNegative,
        probIrrBelow10,
        probPaybackOver7,
        convergenceHistory,
        sensitivity,
        durationMs,
    };
}
