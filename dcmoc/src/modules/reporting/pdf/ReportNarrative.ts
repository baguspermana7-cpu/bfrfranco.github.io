/* ─── REPORT NARRATIVE ENGINE (BA round) ─────────────────────────────────────
 * The owner's min-standard PDF ends with an ALGORITHMIC executive conclusion:
 * a profile chip chosen by deterministic thresholds + a narrative built from
 * the page's real numbers + prioritized HIGH/MED/LOW actions (opex-calculator
 * reference, lines 4350-4495 — 4-tier cost-profile pattern). This module is
 * the ONE shared implementation for every DCMOC export: per-family threshold
 * rubrics (documented screening bands) → ReportAssessment + PillarAction[].
 * Deterministic only — no fabricated data; every number comes from the
 * caller's live adapter model.
 * ──────────────────────────────────────────────────────────────────────── */

import type { PillarAction } from './PillarPdf';
import type { ReportAssessment } from './PrintReport';

export type ReportFamily =
    | 'capex' | 'financial' | 'reliability' | 'sustainability' | 'capacity'
    | 'construction' | 'operations' | 'commissioning' | 'results' | 'site'
    | 'assets' | 'spares' | 'staffing' | 'requirements' | 'architecture' | 'cooling';

/* Profile colors follow the opex reference: green/blue/amber/red. */
const C = { good: '#059669', ok: '#0284c7', warn: '#d97706', bad: '#dc2626' } as const;

export interface AssessMetrics { [k: string]: number | string | null | undefined }

const num = (m: AssessMetrics, k: string, d = 0): number => {
    const v = m[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
};
const str = (m: AssessMetrics, k: string, d = ''): string => (typeof m[k] === 'string' ? (m[k] as string) : d);

const fmtM = (v: number): string =>
    Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`;

interface Profile { label: string; color: string }

/* ── per-family rubrics (screening thresholds, documented in the narrative) ── */

export function buildAssessment(family: ReportFamily, m: AssessMetrics): ReportAssessment {
    switch (family) {
        case 'capex': {
            const perKw = num(m, 'perKw');
            const p: Profile = perKw <= 8000 ? { label: 'Cost-Efficient', color: C.good }
                : perKw <= 12000 ? { label: 'Well-Optimized', color: C.ok }
                    : perKw <= 15000 ? { label: 'Above Average', color: C.warn }
                        : { label: 'Premium Build', color: C.bad };
            const p50 = num(m, 'p50'), p80 = num(m, 'p80'), cont = num(m, 'contingencyPct');
            return {
                label: p.label, color: p.color, valueLine: `$${perKw.toLocaleString()} / kW`,
                narrative: `At $${perKw.toLocaleString()} per kW of IT capacity the estimate lands in the ${p.label.toLowerCase()} band (screening bands: ≤$8K efficient · ≤$12K optimized · ≤$15K above-average · >$15K premium). ` +
                    `The P50 base of ${fmtM(p50)} carries a risk-adjusted P80 of ${fmtM(p80)} (+${p50 > 0 ? (((p80 - p50) / p50) * 100).toFixed(1) : '0'}%) under the AACE Class-4 accuracy band (−30%/+50%), with ${cont}% contingency bound to the design margin. ` +
                    `Budget commitments at this stage should reference the P80 figure; the P50 is the planning midpoint, not a commitment number.`,
            };
        }
        case 'financial': {
            /* npv null (pro-forma belum dihitung / ROI engine belum load) ≠ $0 — narasi jujur plan-mode */
            const hasNpv = typeof m['npv'] === 'number' && Number.isFinite(m['npv'] as number);
            const npv = num(m, 'npv'), irr = num(m, 'irrPct'), hurdle = num(m, 'hurdlePct', 10), payback = num(m, 'paybackYr');
            if (!hasNpv) {
                return {
                    label: 'Not Evaluated', color: C.warn, valueLine: 'NPV / IRR — (not yet computed)',
                    narrative: `The screening pro-forma has not been computed yet — the ROI engine has no result for this configuration. ` +
                        `NPV, IRR and payback appear once the engine evaluates the revenue and OPEX basis; no investment verdict is implied until then.`,
                };
            }
            const p: Profile = npv > 0 && irr >= hurdle + 5 ? { label: 'Strong Investment', color: C.good }
                : npv > 0 && irr >= hurdle ? { label: 'Viable', color: C.ok }
                    : npv > 0 ? { label: 'Marginal', color: C.warn }
                        : { label: 'Challenged', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `IRR ${irr.toFixed(1)}% vs ${hurdle.toFixed(0)}% hurdle`,
                narrative: `Project NPV of ${fmtM(npv)} at IRR ${irr.toFixed(1)}% against the ${hurdle.toFixed(0)}% hurdle rate places the case in the ${p.label.toLowerCase()} band` +
                    (payback > 0 ? `, with capital recovered in ≈${payback.toFixed(1)} years. ` : '. ') +
                    (npv > 0
                        ? `Returns clear the cost of capital${irr >= hurdle + 5 ? ' with comfortable margin — sensitivity to tariff and utilization remains the main watch item' : ' — thin margin means tariff, utilization ramp and opex escalation assumptions deserve stress-testing before commitment'}.`
                        : `The case does not clear the hurdle on current assumptions — revisit tariff basis, phasing, or capex scope before proceeding.`),
            };
        }
        case 'reliability': {
            const avail = num(m, 'availPct'), target = num(m, 'targetPct'), spof = num(m, 'spofCount');
            const met = avail >= target;
            const p: Profile = met && spof === 0 ? { label: 'On Target', color: C.good }
                : met ? { label: 'Target Met · SPOF', color: C.ok }
                    : avail >= target - 0.01 ? { label: 'Near Target', color: C.warn }
                        : { label: 'Below Target', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${avail.toFixed(4)}% vs ${target.toFixed(4)}%`,
                narrative: `Composed system availability of ${avail.toFixed(4)}% ${met ? 'meets' : 'falls short of'} the tier target of ${target.toFixed(4)}%` +
                    (spof > 0 ? `, and ${spof} single point${spof > 1 ? 's' : ''} of failure remain${spof === 1 ? 's' : ''} in the current topology — each one caps the achievable availability regardless of component quality. ` : ', with no single point of failure in the modeled topology. ') +
                    `Availability figures compose MTBF/MTTR chains with a common-cause β factor — treat them as design targets, not measured performance.`,
            };
        }
        case 'sustainability': {
            const pue = num(m, 'pue'), renew = num(m, 'renewablePct');
            const p: Profile = pue <= 1.2 ? { label: 'Best-in-Class', color: C.good }
                : pue <= 1.4 ? { label: 'Efficient', color: C.ok }
                    : pue <= 1.6 ? { label: 'Industry Average', color: C.warn }
                        : { label: 'High Overhead', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `PUE ${pue.toFixed(2)}`,
                narrative: `Design PUE of ${pue.toFixed(2)} sits in the ${p.label.toLowerCase()} band (≤1.2 best-in-class · ≤1.4 efficient · ≤1.6 average). ` +
                    `Every 0.1 of PUE overhead adds ≈${num(m, 'mwhPerPuePoint') > 0 ? Math.round(num(m, 'mwhPerPuePoint')).toLocaleString() + ' MWh/yr' : '8,760 MWh/yr per 10 MW IT'} of non-IT energy. ` +
                    (renew > 0 ? `A ${renew.toFixed(0)}% renewable share reduces Scope-2 intensity proportionally; the residual grid share carries the country grid-carbon factor.` : `No renewable share is configured — Scope-2 emissions follow the country grid-carbon factor in full.`),
            };
        }
        case 'capacity': {
            const stranded = num(m, 'strandedPct'), util = num(m, 'utilizationPct');
            const p: Profile = stranded <= 10 ? { label: 'Efficient Fit', color: C.good }
                : stranded <= 25 ? { label: 'Balanced', color: C.ok }
                    : stranded <= 40 ? { label: 'Headroom-Heavy', color: C.warn }
                        : { label: 'Stranded Capacity', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${stranded.toFixed(0)}% stranded`,
                narrative: `${stranded.toFixed(0)}% of provisioned capacity is stranded against the binding constraint at ${util.toFixed(0)}% peak utilization — the ${p.label.toLowerCase()} band. ` +
                    (stranded > 25
                        ? `Capital is parked in systems the binding constraint prevents from being used; phasing the build or re-balancing the constrained system releases it.`
                        : `Provisioned systems are well matched to the demand forecast; retain the current phasing plan and re-check at each growth gate.`),
            };
        }
        case 'construction': {
            const spi = num(m, 'spi', 1), cpi = num(m, 'cpi', 1);
            const worst = Math.min(spi, cpi);
            const p: Profile = worst >= 1 ? { label: 'On Track', color: C.good }
                : worst >= 0.9 ? { label: 'Minor Slippage', color: C.ok }
                    : worst >= 0.75 ? { label: 'At Risk', color: C.warn }
                        : { label: 'Critical', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `SPI ${spi.toFixed(2)} · CPI ${cpi.toFixed(2)}`,
                narrative: `Earned-value indices SPI ${spi.toFixed(2)} / CPI ${cpi.toFixed(2)} place delivery in the ${p.label.toLowerCase()} band. ` +
                    (spi < 1 ? `Schedule is running at ${(spi * 100).toFixed(0)}% of plan — the forecast completion stretches proportionally unless recovery actions land. ` : `Schedule performance is at or ahead of plan. `) +
                    (cpi < 1 ? `Cost efficiency below 1.0 means each planned dollar delivers ${(cpi * 100).toFixed(0)}¢ of earned work — the estimate-at-completion grows by the inverse.` : `Cost efficiency holds at or better than budget.`),
            };
        }
        case 'operations': {
            /* compliance null (belum ada PM tracking di log) ≠ 100% — narasi jujur plan-mode */
            const hasCompliance = typeof m['maintCompliancePct'] === 'number' && Number.isFinite(m['maintCompliancePct'] as number);
            const compliance = num(m, 'maintCompliancePct', 100), health = num(m, 'avgHealthPct', 100), alarms = num(m, 'activeAlarms');
            if (!hasCompliance) {
                return {
                    label: 'Plan Mode', color: C.warn, valueLine: `PM — (no tracking yet) · ${alarms} alarm${alarms === 1 ? '' : 's'}`,
                    narrative: `Maintenance compliance has no recorded tracking entries yet — the operations page is in plan mode. ` +
                        `Average asset health stands at ${health.toFixed(0)}% with ${alarms} active alarm${alarms === 1 ? '' : 's'}. ` +
                        `Log completed PM weeks in the operations log to begin measuring compliance against the maintenance schedule engine.`,
                };
            }
            const worst = Math.min(compliance, health);
            const p: Profile = worst >= 90 && alarms === 0 ? { label: 'Healthy', color: C.good }
                : worst >= 80 ? { label: 'Stable', color: C.ok }
                    : worst >= 60 ? { label: 'Watch', color: C.warn }
                        : { label: 'Degraded', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${compliance.toFixed(0)}% PM · ${alarms} alarm${alarms === 1 ? '' : 's'}`,
                narrative: `Maintenance compliance at ${compliance.toFixed(0)}% with average asset health ${health.toFixed(0)}% and ${alarms} active alarm${alarms === 1 ? '' : 's'} — the ${p.label.toLowerCase()} operating band. ` +
                    (compliance < 90 ? `PM backlog is the leading indicator of future corrective load; closing it is cheaper than the failures it predicts. ` : ``) +
                    `Figures derive from the maintenance schedule engine and the operations log — Plan-Mode values represent targets until tracking entries are recorded.`,
            };
        }
        case 'commissioning': {
            /* readiness null (belum ada progres checklist) ≠ 0% — narasi jujur plan-mode */
            const hasReady = typeof m['readinessPct'] === 'number' && Number.isFinite(m['readinessPct'] as number);
            const ready = num(m, 'readinessPct'), failed = num(m, 'testsFailed'), issues = num(m, 'openIssues');
            if (!hasReady) {
                return {
                    label: 'Not Started', color: C.warn, valueLine: 'readiness — (no progress yet)',
                    narrative: `Commissioning readiness has no recorded progress yet — the program is in plan mode. ` +
                        `Tick checklist items (L1–L5 / IST / SAT / FAT) or set level completion to begin tracking readiness.`,
                };
            }
            const p: Profile = ready >= 90 ? { label: 'Handover-Ready', color: C.good }
                : ready >= 70 ? { label: 'Advanced', color: C.ok }
                    : ready >= 40 ? { label: 'Mid-Program', color: C.warn }
                        : { label: 'Early Stage', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${ready.toFixed(0)}% readiness`,
                narrative: `Weighted commissioning readiness stands at ${ready.toFixed(0)}% (${p.label.toLowerCase()}), composed from the L1–L5 level completions with IST/SAT/FAT weighting. ` +
                    (failed > 0 ? `${failed} failed test${failed > 1 ? 's' : ''} and ` : '') + (issues > 0 ? `${issues} open issue${issues > 1 ? 's' : ''} gate the remaining levels — each must close or carry a documented waiver before handover. ` : issues === 0 && failed === 0 ? `No open issues or failed tests are currently logged. ` : ''),
            };
        }
        case 'results': {
            const score = num(m, 'score');
            const p: Profile = score >= 80 ? { label: 'Grade A', color: C.good }
                : score >= 65 ? { label: 'Grade B', color: C.ok }
                    : score >= 50 ? { label: 'Grade C', color: C.warn }
                        : { label: 'Grade D', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${score.toFixed(0)} / 100 composite`,
                narrative: `The weighted composite across all engine dimensions scores ${score.toFixed(0)}/100 — ${p.label}. ` +
                    `${str(m, 'strongest') ? `Strongest dimension: ${str(m, 'strongest')}; ` : ''}${str(m, 'weakest') ? `weakest: ${str(m, 'weakest')} — improvement effort lands there first. ` : ''}` +
                    `Dimension weights are owner-tunable on the Results page; the score is a planning composite, not an external benchmark.`,
            };
        }
        case 'site': {
            /* score null/undefined (analisis multi-site belum dijalankan) ≠ 0/100 — narasi jujur */
            const hasScore = typeof m['score'] === 'number' && Number.isFinite(m['score'] as number);
            const score = num(m, 'score');
            if (!hasScore) {
                return {
                    label: 'Not Analyzed', color: C.warn, valueLine: 'score — (not analyzed yet)',
                    narrative: `No site score has been computed for this candidate yet — run the multi-site analysis to score it across power cost, grid reliability, disaster exposure, tax regime, connectivity, water stress and climate factors. ` +
                        `No siting verdict is implied until the analysis runs.`,
                };
            }
            const p: Profile = score >= 80 ? { label: 'Prime Site', color: C.good }
                : score >= 65 ? { label: 'Strong', color: C.ok }
                    : score >= 50 ? { label: 'Workable', color: C.warn }
                        : { label: 'Challenged', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${score.toFixed(0)} / 100 site score`,
                narrative: `The engine site score of ${score.toFixed(0)}/100 rates this candidate ${p.label.toLowerCase()}, composed from power cost, grid reliability, disaster exposure, tax regime, connectivity, water stress and climate factors. ` +
                    `${str(m, 'keyRisk') ? `Leading risk factor: ${str(m, 'keyRisk')}. ` : ''}Site attributes override country defaults where entered — the score reflects the blended basis.`,
            };
        }
        case 'assets': {
            const health = num(m, 'avgHealthPct'), atRisk = num(m, 'atRiskCount');
            const p: Profile = health >= 85 && atRisk === 0 ? { label: 'Fleet Healthy', color: C.good }
                : health >= 70 ? { label: 'Stable', color: C.ok }
                    : health >= 50 ? { label: 'Aging', color: C.warn }
                        : { label: 'Renewal Due', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${health.toFixed(0)}% avg health`,
                narrative: `Average fleet health index ${health.toFixed(0)}% with ${atRisk} asset class${atRisk === 1 ? '' : 'es'} at elevated failure probability — ${p.label.toLowerCase()}. ` +
                    `Health composes Weibull age curves per class against installed base age; classes crossing the risk threshold should enter the capital-renewal plan ahead of failure-driven replacement.`,
            };
        }
        case 'spares': {
            const fill = num(m, 'fillRatePct'), atRisk = num(m, 'classesAtRisk');
            const p: Profile = fill >= 97 ? { label: 'Well-Stocked', color: C.good }
                : fill >= 92 ? { label: 'Adequate', color: C.ok }
                    : fill >= 85 ? { label: 'Thin', color: C.warn }
                        : { label: 'Exposed', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${fill.toFixed(1)}% weighted fill`,
                narrative: `Weighted spares fill rate of ${fill.toFixed(1)}% across the fleet (${p.label.toLowerCase()}), from per-class newsvendor optimization against MTBF-derived demand and country lead times. ` +
                    (atRisk > 0 ? `${atRisk} class${atRisk > 1 ? 'es' : ''} sit${atRisk === 1 ? 's' : ''} below target fill — stockout there converts directly into extended MTTR on the reliability chain.` : `All classes meet their criticality-based fill targets.`),
            };
        }
        case 'staffing': {
            const fte = num(m, 'fte'), costPerYr = num(m, 'annualCostUsd');
            const model = str(m, 'shiftModel', '—');
            return {
                label: 'Staffing Basis', color: C.ok, valueLine: `${fte} FTE · ${model}`,
                narrative: `The staffing model resolves to ${fte} FTE on the ${model} shift pattern at ${fmtM(costPerYr)} fully-loaded annual cost. ` +
                    `Headcount feeds the OPEX staffing line directly (single source) — changes here move the Financial and Operations pages in lockstep. ` +
                    `${num(m, 'fatigueFlag') > 0 ? 'The current pattern carries a fatigue-risk flag on consecutive-shift limits — review rotation before adopting.' : 'The rotation clears standard consecutive-shift fatigue screens.'}`,
            };
        }
        case 'requirements': {
            const comp = num(m, 'completenessPct'), flags = num(m, 'flagsCount');
            const p: Profile = comp >= 90 && flags === 0 ? { label: 'Complete', color: C.good }
                : comp >= 70 ? { label: 'Near-Complete', color: C.ok }
                    : comp >= 40 ? { label: 'In Progress', color: C.warn }
                        : { label: 'Early Intake', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${comp.toFixed(0)}% complete`,
                narrative: `Requirements intake is ${comp.toFixed(0)}% complete with ${flags} validation flag${flags === 1 ? '' : 's'} open — ${p.label.toLowerCase()}. ` +
                    `Every downstream engine (capacity, architecture, CAPEX, operations, financial) computes from these parameters — unresolved flags propagate as uncertainty through the whole chain.`,
            };
        }
        case 'architecture': {
            const passed = num(m, 'layersPassed'), total = num(m, 'layersTotal', 6);
            const ratio = total > 0 ? passed / total : 0;
            const p: Profile = ratio >= 1 ? { label: 'All Layers Pass', color: C.good }
                : ratio >= 0.8 ? { label: 'Minor Gaps', color: C.ok }
                    : ratio >= 0.5 ? { label: 'Design Gaps', color: C.warn }
                        : { label: 'Incomplete', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `${passed}/${total} layers validated`,
                narrative: `${passed} of ${total} architecture layers pass validation (${p.label.toLowerCase()}) at ${str(m, 'redundancy', '—')} redundancy, ${str(m, 'cooling', '—')} cooling, Tier ${str(m, 'tier', '—')} basis. ` +
                    `The system diagram, equipment counts and bus topology are computed live from the placed requirements — any layer failure names the parameter that drives it.`,
            };
        }
        case 'cooling': {
            const pue = num(m, 'pue'), liquid = num(m, 'liquidSharePct');
            const p: Profile = pue <= 1.2 ? { label: 'Chiller-less Class', color: C.good }
                : pue <= 1.35 ? { label: 'High Efficiency', color: C.ok }
                    : pue <= 1.55 ? { label: 'Conventional', color: C.warn }
                        : { label: 'Air-Legacy', color: C.bad };
            return {
                label: p.label, color: p.color, valueLine: `PUE ${pue.toFixed(2)}`,
                narrative: `The cooling architecture lands at design PUE ${pue.toFixed(2)} (${p.label.toLowerCase()})${liquid > 0 ? ` with ${liquid.toFixed(0)}% of the load on liquid loops` : ''}. ` +
                    `CDU sizing, loop hydraulics and refrigerant selection derive from the shared engine cooling models; deep-sea mode (when enabled in CAPEX assumptions) applies the poster-exact seawater basis.`,
            };
        }
    }
}

/* ── prioritized actions: rule-based per family, from the SAME metrics ── */

export function buildActions(family: ReportFamily, m: AssessMetrics): PillarAction[] {
    const out: PillarAction[] = [];
    const add = (priority: PillarAction['priority'], action: string) => out.push({ priority, action });
    switch (family) {
        case 'capex': {
            const perKw = num(m, 'perKw'), cont = num(m, 'contingencyPct');
            if (perKw > 15000) add('HIGH', 'Cost per kW exceeds the premium threshold — review cooling class, redundancy level and building scope for de-scoping options.');
            else if (perKw > 12000) add('MEDIUM', 'Cost per kW is above the optimized band — run the tornado drivers and test the top sensitivity for savings.');
            if (cont < 10) add('MEDIUM', `Contingency at ${cont}% is thin for an AACE Class-4 estimate — consider ≥10% until design maturity improves.`);
            add('LOW', 'Re-baseline the estimate when requirements change materially; the P80 figure is the budget-commitment basis.');
            break;
        }
        case 'financial': {
            /* npv null (belum dihitung) must NOT read as negative — no false HIGH */
            const hasNpv = typeof m['npv'] === 'number' && Number.isFinite(m['npv'] as number);
            const npv = num(m, 'npv'), irr = num(m, 'irrPct'), hurdle = num(m, 'hurdlePct', 10);
            if (!hasNpv) add('MEDIUM', 'The screening pro-forma has not been computed yet — evaluate NPV/IRR before drawing an investment conclusion.');
            else if (npv <= 0) add('HIGH', 'NPV is negative on current assumptions — revisit tariff basis, capex scope or phasing before commitment.');
            else if (irr < hurdle) add('HIGH', 'IRR is below the hurdle rate — the project destroys value at the current cost of capital.');
            else if (irr < hurdle + 5) add('MEDIUM', 'IRR margin over the hurdle is thin — stress-test utilization ramp and opex escalation.');
            add('LOW', 'Refresh the pro-forma when CAPEX P80 or the staffing model changes — both feed this page single-source.');
            break;
        }
        case 'reliability': {
            const spof = num(m, 'spofCount'), avail = num(m, 'availPct'), target = num(m, 'targetPct');
            if (avail < target) add('HIGH', 'Composed availability misses the tier target — add redundancy on the weakest chain or reduce MTTR via spares/contracts.');
            if (spof > 0) add('HIGH', `Eliminate the ${spof} identified single point${spof > 1 ? 's' : ''} of failure — each caps achievable availability.`);
            add('MEDIUM', 'Review the β common-cause factor assumption against the actual physical separation of redundant paths.');
            add('LOW', 'Log real failure events in the operations log — measured MTBF replaces screening values over time.');
            break;
        }
        case 'sustainability': {
            const pue = num(m, 'pue'), renew = num(m, 'renewablePct');
            if (pue > 1.5) add('HIGH', 'PUE above 1.5 — evaluate liquid cooling or economizer hours; the overhead energy is a permanent opex tax.');
            else if (pue > 1.3) add('MEDIUM', 'PUE has headroom — review chilled-water setpoints and partial-load staging.');
            if (renew <= 0) add('MEDIUM', 'No renewable share configured — a PPA or on-site solar/BESS option reduces Scope-2 intensity and hedges tariff.');
            add('LOW', 'Track WUE alongside PUE — water stress is a siting-level risk in most SEA markets.');
            break;
        }
        case 'capacity': {
            const stranded = num(m, 'strandedPct');
            if (stranded > 40) add('HIGH', 'Over 40% stranded capacity — re-phase the build or re-balance the binding constraint to release parked capital.');
            else if (stranded > 25) add('MEDIUM', 'Stranded capacity is elevated — check whether the binding system can be right-sized at the next phase gate.');
            add('LOW', 'Re-run the forecast at each growth checkpoint; committed phases should track the demand curve, not lead it by more than one phase.');
            break;
        }
        case 'construction': {
            const spi = num(m, 'spi', 1), cpi = num(m, 'cpi', 1);
            if (spi < 0.9) add('HIGH', 'Schedule performance below 0.9 — activate recovery: re-sequence critical path, add crews, or re-baseline with stakeholder sign-off.');
            if (cpi < 0.9) add('HIGH', 'Cost performance below 0.9 — the estimate-at-completion is growing; identify the bleeding work packages this week.');
            if (spi >= 0.9 && spi < 1) add('MEDIUM', 'Minor schedule slippage — watch the critical-path packages before it compounds.');
            add('LOW', 'Keep procurement long-lead dates synced to the power-on milestone — lead-time drift is the usual silent killer.');
            break;
        }
        case 'operations': {
            const compliance = num(m, 'maintCompliancePct', 100), alarms = num(m, 'activeAlarms');
            if (alarms > 0) add('HIGH', `Clear the ${alarms} active alarm${alarms === 1 ? '' : 's'} — every standing alarm masks the next real event.`);
            if (compliance < 80) add('HIGH', 'PM compliance below 80% — backlog converts to corrective failures; prioritize critical-class PMs first.');
            else if (compliance < 90) add('MEDIUM', 'PM compliance has slack — schedule the overdue routines within the month.');
            add('LOW', 'Record actual operational events in the log — the page upgrades from Plan-Mode targets to measured performance as data lands.');
            break;
        }
        case 'commissioning': {
            /* readiness null (no checklist progress yet) must NOT read as 0% —
             * the "below 70%" advisory only fires on a real number. */
            const hasReady = typeof m['readinessPct'] === 'number' && Number.isFinite(m['readinessPct'] as number);
            const ready = num(m, 'readinessPct'), failed = num(m, 'testsFailed'), issues = num(m, 'openIssues');
            if (failed > 0) add('HIGH', `Close or waiver the ${failed} failed test${failed > 1 ? 's' : ''} — failed tests block level sign-off.`);
            if (issues > 0) add('MEDIUM', `Work the ${issues} open issue${issues > 1 ? 's' : ''} on the punch list before IST windows.`);
            if (hasReady && ready < 70) add('MEDIUM', 'Readiness below 70% — verify the L1–L3 checklist items are being ticked as work completes, not batched at the end.');
            add('LOW', 'Schedule the IST scenarios against the tier requirement early — they are the long-pole witness events.');
            break;
        }
        case 'results': {
            const score = num(m, 'score');
            if (score < 50) add('HIGH', 'Composite below 50 — the weakest dimensions need structural changes, not tuning; review the dimension table.');
            else if (score < 65) add('MEDIUM', 'Composite in the C band — focused effort on the two weakest dimensions moves the grade fastest.');
            if (str(m, 'weakest')) add('MEDIUM', `Prioritize the weakest dimension: ${str(m, 'weakest')}.`);
            add('LOW', 'Save the current state as a scenario before changing assumptions — comparisons need the baseline.');
            break;
        }
        case 'site': {
            /* score null (analisis belum dijalankan) must NOT read as 0 — no false HIGH */
            const hasScore = typeof m['score'] === 'number' && Number.isFinite(m['score'] as number);
            const score = num(m, 'score');
            if (!hasScore) add('MEDIUM', 'Run the multi-site analysis to compute the site score — no siting verdict exists until it runs.');
            else if (score < 50) add('HIGH', 'Site score below 50 — the leading risk factors are structural; compare candidates before committing.');
            if (str(m, 'keyRisk')) add('MEDIUM', `Mitigation plan needed for the leading risk: ${str(m, 'keyRisk')}.`);
            add('LOW', 'Enter site-specific attributes to replace country-default factors — the score sharpens with real data.');
            break;
        }
        case 'assets': {
            const atRisk = num(m, 'atRiskCount');
            if (atRisk > 0) add('HIGH', `${atRisk} asset class${atRisk > 1 ? 'es' : ''} at elevated failure probability — enter${atRisk === 1 ? 's' : ''} the capital-renewal plan now.`);
            add('MEDIUM', 'Align the spares plan with the aging classes — fill-rate targets should rise as health declines.');
            add('LOW', 'Record condition assessments to replace age-based health with measured condition.');
            break;
        }
        case 'spares': {
            const atRisk = num(m, 'classesAtRisk');
            if (atRisk > 0) add('HIGH', `Raise stock on the ${atRisk} below-target class${atRisk > 1 ? 'es' : ''} — stockout there extends MTTR directly.`);
            add('MEDIUM', 'Verify country lead-time assumptions with actual vendor quotes — lead time drives the reorder point.');
            add('LOW', 'Review unit-cost overrides annually against procurement history.');
            break;
        }
        case 'staffing': {
            if (num(m, 'fatigueFlag') > 0) add('HIGH', 'The shift pattern carries a fatigue-risk flag — adjust rotation before adopting.');
            add('MEDIUM', 'Validate the salary basis against current local market data — the model uses country reference tables.');
            add('LOW', 'Revisit headcount at each capacity phase — staffing scales stepwise, not linearly.');
            break;
        }
        case 'requirements': {
            const flags = num(m, 'flagsCount'), comp = num(m, 'completenessPct');
            if (flags > 0) add('HIGH', `Resolve the ${flags} validation flag${flags > 1 ? 's' : ''} — they propagate as uncertainty through every downstream engine.`);
            if (comp < 70) add('MEDIUM', 'Complete the remaining intake sections — downstream engines fall back to defaults where inputs are missing.');
            add('LOW', 'Review the auto-applied use-case profile values — they are predefined starting points, adjustable per project.');
            break;
        }
        case 'architecture': {
            const passed = num(m, 'layersPassed'), total = num(m, 'layersTotal', 6);
            if (passed < total) add('HIGH', `${total - passed} architecture layer${total - passed > 1 ? 's' : ''} fail${total - passed === 1 ? 's' : ''} validation — each failure names the driving parameter to fix.`);
            add('MEDIUM', 'Verify the equipment counts against vendor unit sizes at the next design gate — engine counts are screening-scale.');
            add('LOW', 'Export the SLD view for the electrical consultant review pack.');
            break;
        }
        case 'cooling': {
            const pue = num(m, 'pue');
            if (pue > 1.4) add('MEDIUM', 'Cooling PUE has improvement headroom — evaluate liquid conversion for the high-density cells.');
            add('LOW', 'Check refrigerant GWP against the local F-gas regulation trajectory before equipment selection.');
            break;
        }
    }
    return out;
}
