// ─── CAPACITY PLANNING ENGINE ───────────────────────────────
// Multi-phase data center build-out planning with interconnections

import { CountryProfile } from '@/constants/countries';
import { getPUE } from '@/constants/pue';
import { calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';
import { fmtMoney, fmtKw } from '@/lib/format';

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

export interface PhaseDetail {
    id: string;
    label: string;
    description: string;
    infrastructureScope: string[];
    riskFactors: string[];
    revenueEstimate: number;
    roiYears: number;
    riskScore: number; // 0-100
}

export interface AssumptionItem {
    category: string;
    assumption: string;
    value: string;
}

export interface UtilizationPoint {
    month: number;
    capacityKw: number;
    demandKw: number;
    utilization: number;
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
    narrative: string;
    phaseDetails: PhaseDetail[];
    assumptions: AssumptionItem[];
    utilizationCurve: UtilizationPoint[];
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

    // Base PUE from shared constants
    const basePue = getPUE(coolingType);

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

    // ─── Utilization curve (monthly capacity vs simulated demand) ───
    const utilizationCurve: UtilizationPoint[] = [];
    for (let m = 0; m < totalMonths; m += 3) {
        const capacityKw = cumulativeItLoad[m] ?? 0;
        // Demand ramps up using occupancy ramp per phase
        let demandKw = 0;
        for (const phase of phases) {
            const opMonth = phase.startMonth + phase.buildMonths;
            if (m >= opMonth) {
                const monthsSinceOp = m - opMonth;
                const quarterIndex = Math.min(Math.floor(monthsSinceOp / 12), phase.occupancyRamp.length - 1);
                demandKw += phase.itLoadKw * (phase.occupancyRamp[quarterIndex] ?? 0.95);
            }
        }
        utilizationCurve.push({
            month: m,
            capacityKw,
            demandKw: Math.round(demandKw),
            utilization: capacityKw > 0 ? Math.round((demandKw / capacityKw) * 100) : 0,
        });
    }

    // ─── Phase details (per-phase context) ───
    const phaseDetails: PhaseDetail[] = phaseResults.map((pr, idx) => {
        const phase = phases[idx];
        const rackCount = Math.ceil(pr.itLoadKw / 8); // ~8 kW per rack avg
        const coolingLabel = coolingType === 'liquid' ? 'Liquid cooling' : coolingType === 'rdhx' ? 'Rear-door heat exchangers' : coolingType === 'inrow' ? 'In-row cooling' : 'Raised-floor air cooling';
        const monthlyRevenue = pr.itLoadKw * 0.95 * 120; // ~$120/kW/mo at 95% occupancy
        const annualRevenue = monthlyRevenue * 12;
        const roiYears = Math.round((pr.capex / annualRevenue) * 10) / 10;

        // Risk factors based on phase characteristics
        const risks: string[] = [];
        if (pr.itLoadKw >= 20000) risks.push('Large-scale commissioning complexity');
        if (pr.buildMonths > 18) risks.push('Extended construction timeline');
        if (idx > 0 && phase.startMonth < phases[idx - 1].startMonth + phases[idx - 1].buildMonths)
            risks.push('Overlapping construction with prior phase');
        if (coolingType === 'liquid') risks.push('Liquid cooling supply chain lead times');
        if (tierLevel === 4) risks.push('Tier IV concurrent maintainability requirements');
        if (risks.length === 0) risks.push('Standard construction risk profile');

        const riskScore = Math.min(100, Math.round(
            (pr.itLoadKw >= 20000 ? 25 : 10) +
            (pr.buildMonths > 18 ? 20 : 5) +
            (idx > 0 ? 15 : 0) +
            (coolingType === 'liquid' ? 15 : 0) +
            (tierLevel === 4 ? 15 : 5)
        ));

        return {
            id: pr.id,
            label: pr.label,
            description: `${pr.label} deploys ${fmtKw(pr.itLoadKw)} IT capacity over ${pr.buildMonths} months with ${coolingLabel.toLowerCase()}, becoming operational at month ${pr.operationalMonth}.`,
            infrastructureScope: [
                `${rackCount} racks (~8 kW avg density)`,
                `${coolingLabel}`,
                `Tier ${tierLevel} redundancy`,
                `${Math.ceil(pr.itLoadKw / 1000)} × 1 MW power modules`,
                `${pr.fte} operations FTE at full capacity`,
            ],
            riskFactors: risks,
            revenueEstimate: Math.round(annualRevenue),
            roiYears,
            riskScore,
        };
    });

    // ─── Key assumptions ───
    const assumptions: AssumptionItem[] = [
        { category: 'CAPEX', assumption: 'Base cost per kW', value: `$${baseCpkw.toLocaleString()}/kW` },
        { category: 'CAPEX', assumption: 'Tier multiplier', value: `${tierMult}x (Tier ${tierLevel})` },
        { category: 'CAPEX', assumption: 'Cooling multiplier', value: `${coolMult}x (${coolingType})` },
        { category: 'CAPEX', assumption: 'Construction index', value: `${constructionIndex}x (${country.name})` },
        { category: 'CAPEX', assumption: 'Scale discount', value: `${Math.round(scaleDiscount * 100)}% of base at ${fmtKw(totalPlannedKw)} total` },
        { category: 'Operations', assumption: 'Shift model', value: shiftModel === '12h' ? '12-hour shifts (2 crew)' : '8-hour shifts (3 crew)' },
        { category: 'Operations', assumption: 'Maintenance model', value: `${maintenanceModel}${maintenanceModel === 'hybrid' ? ` (${Math.round(hybridRatio * 100)}% in-house)` : ''}` },
        { category: 'Operations', assumption: 'Base PUE', value: `${basePue} (${coolingType} cooling)` },
        { category: 'Revenue', assumption: 'Avg revenue per kW', value: '$120/kW/month at 95% occupancy' },
        { category: 'Revenue', assumption: 'Occupancy ramp', value: '30% → 60% → 85% → 95% (annual steps)' },
    ];

    // ─── Narrative summary ───
    const avgCpkw = Math.round(totalCapex / totalItLoadKw);
    const lastPhase = phaseResults[phaseResults.length - 1];
    const peakFte = lastPhase?.fte ?? 0;
    const finalPue = pueEvolution[pueEvolution.length - 1]?.pue ?? basePue;
    const narrative = `This ${phases.length}-phase capacity plan deploys ${fmtKw(totalItLoadKw)} of IT load across ${country.name} ` +
        `over ${totalMonths} months with a total CAPEX of ${fmtMoney(totalCapex)} (avg $${avgCpkw.toLocaleString()}/kW). ` +
        `Phase 1 (${fmtKw(phaseResults[0].itLoadKw)}) establishes the initial footprint at month ${phaseResults[0].operationalMonth}, ` +
        `while ${phases.length > 2 ? 'subsequent phases scale' : 'Phase 2 scales'} capacity through economies of scale, ` +
        `reducing per-kW costs by ${Math.round((1 - (lastPhase.capexPerKw / phaseResults[0].capexPerKw)) * 100)}% by the final phase. ` +
        `The Tier ${tierLevel} design with ${coolingType} cooling achieves a PUE of ${finalPue} at full scale. ` +
        `Peak staffing reaches ${peakFte} FTE under the ${maintenanceModel} maintenance model.`;

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
        narrative,
        phaseDetails,
        assumptions,
        utilizationCurve,
    };
};
