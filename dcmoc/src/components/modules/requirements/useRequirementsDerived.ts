'use client';

/* ─── Derived model for the Requirements page (Phase A) ──────────────────────
 * Pure computations: engine validation, requirement score, deterministic
 * insights, per-section input quality, racks, CAGR, downtime budget.
 * Engine access is null-guarded (rzModels() may be {} during prerender).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { rzModels, rzData } from '@/lib/rz-engine';
import { USE_CASE_TO_ENGINE, monthsToCod, cagr5, effectiveTotalRacks } from '@/lib/requirementsMappings';

export interface SectionQuality { key: string; label: string; pct: number; missing: string[] }

export interface ReqDerived {
    validation: {
        completenessPct: number;
        have: string[]; missing: string[];
        flags: { severity: 'critical' | 'warn'; message: string; field?: string }[];
        rackCount: number | null;
        recommendedTierFloor: number | null;
    } | null;
    score: number;
    scoreBand: { label: string; sub: string };
    insights: string[];
    sectionQuality: SectionQuality[];
    totalRacks: number;
    cagrPct: number;
    tierTargetPct: number;      // e.g. 99.995
    downtimeMinYr: number;      // e.g. 26.3
    deadlineMonths: number;
    growthYearsMw: { label: string; mw: number; editable: boolean }[];
}

const MIN_PER_YEAR = 365.25 * 24 * 60;

export function useRequirementsDerived(): ReqDerived {
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const req = useRequirementsStore();

    return React.useMemo(() => {
        const m = rzModels();
        const d = rzData();
        const itLoadKw = inputs.itLoad;
        const y0Mw = itLoadKw / 1000;

        /* growth series: Y0 from sim; future years derived unless custom-edited (>0) */
        const g = req.growth.itLoadMwByYear;
        const derive = (n: number) => +(y0Mw * (1 + 0.10 * n)).toFixed(1); // linear 10%/yr default screening ramp
        const yr = (stored: number, n: number) => (req.growth.growthType === 'custom' && stored > 0 ? stored : (stored > 0 ? stored : derive(n)));
        const series = [
            { label: 'Y0 (COD)', mw: +y0Mw.toFixed(1), editable: false },
            { label: 'Y1', mw: yr(g.y1, 1), editable: req.growth.growthType === 'custom' },
            { label: 'Y2', mw: yr(g.y2, 2), editable: req.growth.growthType === 'custom' },
            { label: 'Y3', mw: yr(g.y3, 3), editable: req.growth.growthType === 'custom' },
            { label: 'Y4', mw: yr(g.y4, 4), editable: req.growth.growthType === 'custom' },
            { label: 'Y5', mw: yr(g.y5, 5), editable: req.growth.growthType === 'custom' },
            { label: 'Y10', mw: yr(g.y10, 10), editable: req.growth.growthType === 'custom' },
        ];
        const cagrPct = +(cagr5(series[0].mw, series[5].mw) * 100).toFixed(1);

        /* availability from engine tier target (FRACTION — trap: never pass percent) */
        const tierAvail: Record<number, number> = d?.reliability?.tierAvailability ?? { 2: 0.99741, 3: 0.99982, 4: 0.99995 };
        const frac = tierAvail[inputs.tierLevel] ?? 0.99982;
        const tierTargetPct = +(frac * 100).toFixed(4);
        const downtimeMinYr = +((1 - frac) * MIN_PER_YEAR).toFixed(1);

        const deadlineMonths = monthsToCod(req.overview.targetCod);
        const totalRacks = effectiveTotalRacks(itLoadKw, req.workload.avgRackDensityKw, req.workload.totalRacksOverride);

        /* engine validation (models.requirements.validate) */
        let validation: ReqDerived['validation'] = null;
        try {
            if (m?.requirements?.validate) {
                const intake = {
                    itLoadKw,
                    targetTier: inputs.tierLevel,
                    region: country?.id,
                    useCase: USE_CASE_TO_ENGINE[req.overview.useCase],
                    coolingType: inputs.coolingType,
                    rackKw: req.workload.avgRackDensityKw,
                    budgetUsd: req.business.budgetUsd ?? undefined,
                    deadlineMonths: deadlineMonths > 0 ? deadlineMonths : undefined,
                };
                const v = m.requirements.validate(intake);
                validation = {
                    completenessPct: v?.completeness?.pct ?? 0,
                    have: v?.completeness?.have ?? [],
                    missing: v?.completeness?.missing ?? [],
                    flags: (v?.flags ?? []).map((f: { level?: string; severity?: string; message?: string; field?: string } | string) =>
                        typeof f === 'string'
                            ? { severity: 'warn' as const, message: f }
                            : { severity: ((f.level ?? f.severity) === 'critical' ? 'critical' : 'warn') as 'critical' | 'warn', message: f.message ?? String(f), field: f.field }),
                    rackCount: v?.rackCount ?? null,
                    recommendedTierFloor: v?.recommendedTierFloor ?? null,
                };
            }
        } catch { validation = null; }

        /* per-section input quality */
        const o = req.overview; const w = req.workload;
        const mixSum = w.workloadMix.aiGpu + w.workloadMix.storage + w.workloadMix.general + w.workloadMix.network;
        const sq = (label: string, key: string, checks: [string, boolean][]): SectionQuality => {
            const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
            return { key, label, pct: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
        };
        const sectionQuality: SectionQuality[] = [
            sq('Project Overview', 'overview', [
                ['Project Name', o.projectName.trim().length > 0],
                ['Country', !!country],
                ['Use Case', !!o.useCase],
                ['Target COD', o.targetCod.year >= new Date().getFullYear()],
                ['Project Type', !!o.projectType],
            ]),
            sq('Workload Profile', 'workload', [
                ['IT Load', itLoadKw > 0],
                ['Rack Density', w.avgRackDensityKw > 0],
                ['Workload Mix = 100%', mixSum === 100],
                ['Cooling Approach', !!inputs.coolingType],
            ]),
            sq('Capacity & Growth', 'growth', [
                ['Growth plan set', series.slice(1).every((s) => s.mw > 0)],
            ]),
            sq('Reliability & SLA', 'availability', [
                ['Tier selected', inputs.tierLevel >= 2],
                ['SLA within tier', req.availability.slaTargetPct == null || req.availability.slaTargetPct <= tierTargetPct],
            ]),
            sq('Business & Financial', 'business', [
                ['Budget', req.business.budgetUsd != null && req.business.budgetUsd > 0],
                ['Design Margin', req.business.designMarginPct >= 0],
            ]),
        ];
        const missingCount = sectionQuality.reduce((s, x) => s + x.missing.length, 0);

        /* requirement score */
        const enginePct = validation?.completenessPct ?? 0;
        const meanSection = sectionQuality.reduce((s, x) => s + x.pct, 0) / sectionQuality.length;
        const crit = validation?.flags.filter((f) => f.severity === 'critical').length ?? 0;
        const warn = validation?.flags.filter((f) => f.severity === 'warn').length ?? 0;
        const score = Math.max(0, Math.min(100, Math.round(0.6 * enginePct + 0.4 * meanSection - 15 * crit - 5 * warn)));
        const scoreBand = score >= 85
            ? { label: 'Excellent', sub: 'All critical requirements are well defined.' }
            : score >= 60
                ? { label: 'Good', sub: 'Some fields need attention.' }
                : { label: 'Incomplete', sub: `Complete required fields (${missingCount}).` };

        /* deterministic insights — DEDUP rule: local rules and engine validation
         * flags cover the same facts (density vs cooling ceiling, SLA vs tier);
         * track which engine fields the local rules already covered and skip the
         * matching flags so the rail never shows the same insight twice. */
        const insights: string[] = [];
        const coveredFields = new Set<string>();
        if (w.workloadMix.aiGpu >= 50) insights.push(`Workload is AI-dominant (${w.workloadMix.aiGpu}%) with ${w.avgRackDensityKw} kW/rack density.`);
        const maxKw: Record<string, number> = d?.requirements?.coolingMaxRackKw ?? { air: 20, inrow: 30, rdhx: 50, liquid: 132, immersion: 200 };
        const ceil = maxKw[inputs.coolingType] ?? 20;
        if (w.avgRackDensityKw > ceil) { insights.push(`${w.avgRackDensityKw} kW/rack exceeds the ${inputs.coolingType} cooling ceiling (${ceil} kW) — liquid cooling required.`); coveredFields.add('coolingType'); }
        else if (inputs.coolingType === 'liquid' && w.avgRackDensityKw >= 40) insights.push('Liquid cooling (D2C) matches the high-density band — optimal for this workload.');
        const sla = req.availability.slaTargetPct ?? tierTargetPct;
        if (sla <= tierTargetPct) insights.push(`Tier ${inputs.tierLevel === 4 ? 'IV' : inputs.tierLevel === 3 ? 'III' : 'II'} design suits the ${sla}% availability target (${downtimeMinYr} min/yr budget).`);
        else insights.push(`SLA ${sla}% exceeds Tier ${inputs.tierLevel} design availability (${tierTargetPct}%) — raise the tier.`);
        coveredFields.add('slaUptimePct'); // both SLA branches emit a local insight
        const mw = itLoadKw / 1000;
        const recVolt = mw > 100 ? '132kV' : mw > 20 ? '33kV' : '11kV';
        if (o.gridVoltage !== recVolt && (recVolt === '132kV' || (recVolt === '33kV' && o.gridVoltage === '11kV')))
            insights.push(`Consider ${recVolt} utility intake for ${mw.toFixed(0)} MW — better scalability and losses.`);
        validation?.flags
            .filter((f) => !(f.field && coveredFields.has(f.field)) && !insights.includes(f.message))
            .slice(0, 2)
            .forEach((f) => insights.push(f.message));

        return {
            validation, score, scoreBand, insights: insights.slice(0, 5), sectionQuality,
            totalRacks, cagrPct, tierTargetPct, downtimeMinYr, deadlineMonths, growthYearsMw: series,
        };
    }, [inputs, country, req.overview, req.workload, req.growth, req.availability, req.business]);
}
