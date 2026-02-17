import { calculateCompositeScore } from './scoring';

export interface ConfidenceResult {
    p5: number;
    p95: number;
    mean: number;
    median: number;
    width: number;
}

export function runMonteCarloSimulation(values: number[], weights: number[], iterations: number = 10000): ConfidenceResult {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
        // Add noise: +/- 0.5 to each value, clamped between 1 and 5
        const noisyValues = values.map(v => Math.max(1, Math.min(5, v + (Math.random() - 0.5))));
        results.push(calculateCompositeScore(noisyValues, weights));
    }

    results.sort((a, b) => a - b);

    const p5 = results[Math.floor(results.length * 0.05)];
    const p95 = results[Math.floor(results.length * 0.95)];
    const mean = results.reduce((s, v) => s + v, 0) / results.length;
    const median = results[Math.floor(results.length * 0.5)];

    return {
        p5,
        p95,
        mean,
        median,
        width: p95 - p5
    };
}
