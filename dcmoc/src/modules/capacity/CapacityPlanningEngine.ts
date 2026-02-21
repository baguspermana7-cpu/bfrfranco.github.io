// ─── CAPACITY PLANNING ENGINE ───────────────────────────────
// Multi-phase data center build-out planning with interconnections

import { CountryProfile } from '@/constants/countries';
import { calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';

export interface CapacityPhase {
    id: string;
    label: string;
    itLoadKw: number;
    startMonth: number;
    buildMonths: number;
    occupancyRamp: number[];
}

export interface PhaseResult {
    id: string;
    label: string;
    itLoadKw: number;
    startMonth: number;
    buildMonths: number;
    operationalMonth: number;
    capex: number;
    capexPerKw: number;
    fte: number;
    pue: number;
}

export interface TimelineEvent {
    phaseId: string;
    label: string;
    type: 'build' | 'operational';
    startMonth: number;
    endMonth: number;
}

export interface CapacityPlanResult {
    phases: PhaseResult[];
    timeline: TimelineEvent[];
    cumulativeItLoad: number[];
    cumulativeCapex: number[];
    totalCapex: number;
    totalItLoadKw: number;
    scalabilityScore: number;
    phaseEfficiency: number;
    staffingRamp: { month: number; fte: number }[];
    pueEvolution: { month: number; pue: number }[];
    totalMonths: number;
}

export interface CapacityPlanInput {
    phases: CapacityPhase[];
    country: CountryProfile;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    tierLevel: 2 | 3 | 4;
    shiftModel: '8h' | '12h';
    maintenanceModel: 'in-house' | 'vendor' | 'hybrid';
    hybridRatio: number;
    baseCapexPerKw?: number;
}

// Default phase presets
export const CAPACITY_PRESETS = {
    small: [
        { id: 'p1', label: 'Phase 1', itLoadKw: 1000, startMonth: 0, buildMonths: 14, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        { id: 'p2', label: 'Phase 2', itLoadKw: 2000, startMonth: 18, buildMonths: 12, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        { id: 'p3', label: 'Phase 3', itLoadKw: 5000, startMonth: 36, buildMonths: 10, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
    ],
    medium: [
        { id: 'p1', label: 'Phase 1', itLoadKw: 2000, startMonth: 0, buildMonths: 18, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        { id: 'p2', label: 'Phase 2', itLoadKw: 10000, startMonth: 20, buildMonths: 14, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        { id: 'p3', label: 'Phase 3', itLoadKw: 20000, startMonth: 40, buildMonths: 12, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
    ],
    large: [
        { id: 'p1', label: 'Phase 1', itLoadKw: 5000, startMonth: 0, buildMonths: 22, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        { id: 'p2', label: 'Phase 2', itLoadKw: 20000, startMonth: 24, buildMonths: 16, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        { id: 'p3', label: 'Phase 3', itLoadKw: 50000, startMonth: 48, buildMonths: 14, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
    ],
};

export const calculateCapacityPlan = (input: CapacityPlanInput): CapacityPlanResult => {
    const { phases, country, coolingType, tierLevel, shiftModel, maintenanceModel, hybridRatio, baseCapexPerKw } = input;

    // Base CAPEX/kW based on tier and cooling
    const tierMult = tierLevel === 4 ? 1.35 : tierLevel === 3 ? 1.0 : 0.75;
    const coolMult = coolingType === 'liquid' ? 1.25 : coolingType === 'rdhx' ? 1.1 : coolingType === 'inrow' ? 1.0 : 0.85;
    const constructionIndex = country.constructionIndex ?? 1.0;
    const baseCpkw = baseCapexPerKw ?? 10000;
    const effectiveCpkw = baseCpkw * tierMult * coolMult * constructionIndex;

    // Base PUE
    const basePue = coolingType === 'liquid' ? 1.08 : coolingType === 'rdhx' ? 1.18 : coolingType === 'inrow' ? 1.28 : 1.35;

    // Calculate total timeline span
    const lastPhaseEnd = Math.max(...phases.map(p => p.startMonth + p.buildMonths + 48));
    const totalMonths = Math.min(lastPhaseEnd, 120); // Cap at 10 years

    // Phase results
    const phaseResults: PhaseResult[] = [];
    const timeline: TimelineEvent[] = [];
    const cumulativeItLoad: number[] = new Array(totalMonths).fill(0);
    const cumulativeCapex: number[] = new Array(totalMonths).fill(0);
    const staffingRamp: { month: number; fte: number }[] = [];
    const pueEvolution: { month: number; pue: number }[] = [];

    let runningCapex = 0;

    // Scale effect: larger total → slightly lower $/kW
    const totalPlannedKw = phases.reduce((s, p) => s + p.itLoadKw, 0);
    const scaleDiscount = Math.max(0.85, 1 - (totalPlannedKw / 100000) * 0.15);

    for (const phase of phases) {
        const operationalMonth = phase.startMonth + phase.buildMonths;

        // Economy of scale: later phases get slightly cheaper per kW
        const phaseIndex = phases.indexOf(phase);
        const phaseScaleDiscount = Math.max(0.9, 1 - phaseIndex * 0.03);
        const phaseCapexPerKw = Math.round(effectiveCpkw * scaleDiscount * phaseScaleDiscount);
        const phaseCapex = phaseCapexPerKw * phase.itLoadKw;

        // Staffing for cumulative load at this phase
        const cumulativeLoadAtPhase = phases
            .filter(p => p.startMonth + p.buildMonths <= operationalMonth)
            .reduce((s, p) => s + p.itLoadKw, 0) + phase.itLoadKw;

        const autoHc = calculateAutoHeadcount(
            cumulativeLoadAtPhase, tierLevel, shiftModel,
            'in-house', maintenanceModel, 'planned', hybridRatio
        );

        // PUE improves slightly with scale
        const pueImprovement = Math.min(0.08, phaseIndex * 0.02);
        const phasePue = Math.round((basePue - pueImprovement) * 100) / 100;

        phaseResults.push({
            id: phase.id,
            label: phase.label,
            itLoadKw: phase.itLoadKw,
            startMonth: phase.startMonth,
            buildMonths: phase.buildMonths,
            operationalMonth,
            capex: Math.round(phaseCapex),
            capexPerKw: phaseCapexPerKw,
            fte: autoHc.totalFTE,
            pue: phasePue,
        });

        // Timeline events
        timeline.push({
            phaseId: phase.id,
            label: `${phase.label} Build`,
            type: 'build',
            startMonth: phase.startMonth,
            endMonth: operationalMonth,
        });
        timeline.push({
            phaseId: phase.id,
            label: `${phase.label} Operational`,
            type: 'operational',
            startMonth: operationalMonth,
            endMonth: Math.min(operationalMonth + 48, totalMonths),
        });

        // Fill cumulative arrays
        // CAPEX is spent linearly during build
        for (let m = phase.startMonth; m < Math.min(operationalMonth, totalMonths); m++) {
            cumulativeCapex[m] += phaseCapex / phase.buildMonths;
        }
        // IT load comes online at operational month
        for (let m = operationalMonth; m < totalMonths; m++) {
            cumulativeItLoad[m] += phase.itLoadKw;
        }
    }

    // Running totals
    let capexRunning = 0;
    for (let m = 0; m < totalMonths; m++) {
        capexRunning += cumulativeCapex[m];
        cumulativeCapex[m] = Math.round(capexRunning);
    }

    // Staffing ramp (sample every 3 months)
    for (let m = 0; m < totalMonths; m += 3) {
        const loadAtMonth = cumulativeItLoad[m];
        if (loadAtMonth > 0) {
            const hc = calculateAutoHeadcount(loadAtMonth, tierLevel, shiftModel, 'in-house', maintenanceModel, 'planned', hybridRatio);
            staffingRamp.push({ month: m, fte: hc.totalFTE });
        } else {
            staffingRamp.push({ month: m, fte: 0 });
        }
    }

    // PUE evolution (sample every 6 months)
    for (let m = 0; m < totalMonths; m += 6) {
        const loadAtMonth = cumulativeItLoad[m];
        if (loadAtMonth > 0) {
            const scaleEffect = Math.min(0.08, (loadAtMonth / 50000) * 0.08);
            pueEvolution.push({ month: m, pue: Math.round((basePue - scaleEffect) * 100) / 100 });
        } else {
            pueEvolution.push({ month: m, pue: basePue });
        }
    }

    // Totals
    const totalCapex = phaseResults.reduce((s, p) => s + p.capex, 0);
    const totalItLoadKw = phaseResults.reduce((s, p) => s + p.itLoadKw, 0);

    // Scalability score
    const avgCapexPerKw = totalCapex / totalItLoadKw;
    const capexEfficiency = Math.max(0, 100 - (avgCapexPerKw / 200)); // Lower $/kW = better
    const phaseSpacing = phases.length > 1
        ? Math.min(100, (phases[phases.length - 1].startMonth - phases[0].startMonth) / (phases.length - 1) / 24 * 100)
        : 50;
    const scalabilityScore = Math.round(capexEfficiency * 0.5 + phaseSpacing * 0.3 + Math.min(100, phases.length * 25) * 0.2);

    // Phase efficiency (average utilization across operational phases)
    const phaseEfficiency = Math.round(
        phaseResults.reduce((s, p) => s + (p.itLoadKw / totalItLoadKw), 0) / phaseResults.length * 100
    );

    return {
        phases: phaseResults,
        timeline,
        cumulativeItLoad,
        cumulativeCapex,
        totalCapex,
        totalItLoadKw,
        scalabilityScore: Math.min(100, scalabilityScore),
        phaseEfficiency,
        staffingRamp,
        pueEvolution,
        totalMonths,
    };
};
