'use client';

/* ─── Capacity Planning Engine — page shell (Phase D) ────────────────────────
 * Reference sections: KPI row · IT-load forecast & growth chart · capacity
 * breakdown donut · utilization bars · system detail tabs (engine equipment
 * table) · recommendations row · rail (growth strategy + insights).
 * The FULL legacy phase planner (editor + Gantt + economics, engine-real) is
 * absorbed BY COMPOSITION as the "Phase Plan & Economics" tab — nothing lost.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { TraceValue } from '@/components/ui/TraceValue';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { Explain } from '@/components/ui/Explain';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useArchitectureStore } from '@/store/architecture';
import CapacityDashboardMod from '@/components/modules/CapacityDashboard';
import {
    sanitizeCap, facilitySnapshot, overheadDonut, forecastSeries, utilization, utilBands, autoWhiteSpaceM2,
    equipmentTable, capRecommendations, capKeyInsights, type CapInputs, type UtilRow,
    coolingEquipmentTable, rackSpaceTable, networkTable, type ComponentRow,
} from '@/state/adapters/capacity-adapter';
import { explainThresholdMetric, type ThresholdLeverSpec, type ThresholdMetricExplain } from '@/lib/decision-explain';
import { Layers, ChevronRight, Zap, Snowflake, Boxes, Network, FileDown } from 'lucide-react';
import { DiagnosticModal } from '@/components/ui/RedValue';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

const DONUT_COLORS = ['#7DDDB4', '#14b8a6', '#3b82f6', '#f59e0b', '#64748b'];

/* util-row key → value-trace id (KPI wrap; network row = assumption, no trace) */
const UTIL_TRACE: Record<string, string | undefined> = {
    power: 'cap.powerCapacityMva', cooling: 'cap.coolingCapacityMw', rack: 'cap.rackCapacity',
};

/* util-row key → KPI tooltip (owner mandate: every KPI label explains itself) */
const UTIL_TIPS: Record<string, string> = {
    power: 'Design electrical capacity vs. what the current IT load consumes. Capacity derives from the engine facility sizing (IT load × PUE plus the Requirements design margin). Sustained utilization above ~85% leaves no headroom for growth or concurrent maintenance — trigger the next build phase before reaching it.',
    cooling: 'Installed heat-rejection capacity vs. the current IT heat load, sized from the IT load and the selected cooling technology. High utilization means the N+1 unit is effectively carrying base load — verify redundancy still holds during a maintenance window before adding load.',
    rack: 'Rack positions used vs. available, computed from white-space area and the avg rack density (kW/rack) set in Requirements. Raising density shrinks the rack count needed but can force liquid cooling; watch for stranded space when power runs out before rack positions do.',
    network: 'Network port/uplink utilization — a screening assumption only (the engine has no network model). Treat it as directional and validate against the actual fabric design before making decisions on it.',
};

/* ─── System-detail table header tooltips (owner mandate: every header/metric
 * explains itself) — one set per system tab, rendered by DetailTable. ─────── */
type HeadTips = { component: string; capacity: string; utilization: string; status: string };
const DETAIL_HEAD_TIPS: Record<'cooling' | 'rack' | 'network', HeadTips> = {
    cooling: {
        component: 'Cooling-plant component class (primary loop, air side, hydronics, heat rejection). Counts come from the engine equipScale divisors where available — screening quantities, not a selected equipment schedule.',
        capacity: 'Installed units × unit rating (MW of thermal duty per unit). Ratings are the engine scaling divisors, i.e. the load slice each unit serves — a screening convention, not vendor nameplate data.',
        utilization: 'Thermal duty ÷ (units × rating). Duty basis = IT heat (kW of electronics heat), NOT IT × PUE — the PUE overhead is parasitic fan/pump power, not heat the loop must reject. High utilization means the N+1 unit is carrying base load.',
        status: 'OK < 70%, Watch 70-85%, At Risk ≥ 85% — the same banding as the Power table. Non-OK rows list quantified escalation levers (add units, raise rating, or shed load via the phase plan) beneath the table.',
    },
    rack: {
        component: 'Space-domain constraint: rack positions, average density vs. the cooling technology ceiling, white-space area incl. gross-up, and the power-vs-space binding constraint from the engine bindingConstraint model.',
        capacity: 'Used vs. available for each constraint — positions from IT kW ÷ kW/rack against what the floor can hold; area from rack footprint grossed up ÷ 0.35 for aisles, containment and clearances (screening convention).',
        utilization: 'Used ÷ available per constraint. The Avg Rack Density row is different: it is design density ÷ the practical ceiling of the selected cooling technology — nearing 100% there means a cooling step-up (RDHx → DLC → immersion), not more floor.',
        status: 'OK < 70%, Watch 70-85%, At Risk ≥ 85%. The Binding Constraint row carries the max of the rack/space utilizations and its escalation text says which lever actually helps (area vs. power) — adding the wrong one strands capacity.',
    },
    network: {
        component: 'Spine-leaf fabric element estimated from rack count — SCREENING ASSUMPTION ONLY (the engine has no network model). Ratios: ~1 leaf per 16 racks, ~1 spine per 8 leaves (min 2), 4× 100G uplinks per leaf.',
        capacity: 'Estimated element count and the ratio behind it. These are directional placeholders for budgeting — real counts depend on switch radix, dual-homing, oversubscription target and failure-domain design.',
        utilization: 'All rows carry the single screening fabric utilization (racks × 1.5 Gbps/rack vs. design capacity incl. margin) — the same ASSUMPTION basis as the Network bar above. There is no per-element measurement behind it.',
        status: 'OK < 70%, Watch 70-85%, At Risk ≥ 85% on the screening utilization. Treat any non-OK here as a prompt to commission the actual fabric design, not as an engineering finding.',
    },
};

/* ─── Watch/At-Risk remediation (owner mandate: no naked bad status chips) ───
 * Each non-OK utilization row gets a computed reason + levers whose magnitudes
 * are SOLVED by explainThresholdMetric bisection over the page's OWN adapter
 * chain (sanitizeCap → facilitySnapshot → utilization) — never re-implemented.
 * Target = back to OK (<70% utilization). Lever targetTab tokens:
 * 'phases-local' = in-page Phase Plan tab · 'requirements' / 'sim' = shell tabs. */
const OK_UTIL_PCT = 70;
const UTIL_LEVERS: Record<string, ('margin' | 'itload' | 'space')[]> = {
    power: ['margin', 'itload'], cooling: ['margin', 'itload'],
    rack: ['space', 'itload'], space: ['space', 'itload'], network: ['margin', 'itload'],
};

function explainUtilRow(i: CapInputs, u: UtilRow): ThresholdMetricExplain {
    const pctAt = (mods: Partial<CapInputs>): number => {
        const ii = sanitizeCap({ ...i, ...mods });
        const s2 = facilitySnapshot(ii);
        return utilization(ii, s2.facilityMw).rows.find((r) => r.key === u.key)?.pct ?? 0;
    };
    /* Band-aware target: At Risk (≥85) solves for exiting the band (<85);
     * Watch solves back to OK (<70). NOTE: current power/cooling utilization is
     * structurally ≈ 1/(1+margin) in the adapter, so <70% is often unreachable
     * in-bounds — the honest quantified note renders instead. */
    const bands = utilBands(i);
    const atRisk = u.pct >= bands.watchMax;
    const target = atRisk ? bands.watchMax - 1 : bands.okMax;
    const targetLabel = atRisk ? `<${bands.watchMax}% keluar At Risk` : `≤${bands.okMax}% OK (margin-aware band)`;
    const specs: ThresholdLeverSpec[] = (UTIL_LEVERS[u.key] ?? []).map((kind): ThresholdLeverSpec => {
        if (kind === 'margin') return {
            lo: i.designMarginPct, hi: 30,
            metricAt: (m) => pctAt({ designMarginPct: m }),
            render: (x, achieved) => ({
                label: `Design margin ${i.designMarginPct}% → ${x.toFixed(0)}%`,
                detail: `Raise design margin ${i.designMarginPct}% → ${x.toFixed(1)}% so ${u.label} utilization drops to ${Math.round(achieved)}% (${targetLabel}) — parameter in Requirements → Business (design margin).`,
            }),
            unreachable: (atHi) => ({
                label: 'Margin moves the floor, not the distance',
                detail: `Without a committed phase plan, capacity scales WITH the load, so utilization sits at the structural floor ≈ 100/(1+margin): margin 30% ⇒ ~77% by construction — that is NOT "margin kurang". Even 30% margin reads ${Math.round(atHi)}%. The real lever is PHASING: commit build phases larger than today's load and utilization drops genuinely.`,
            }),
            targetTab: 'requirements',
        };
        if (kind === 'space') {
            const autoM2 = autoWhiteSpaceM2(i);
            return {
                lo: Math.max(i.whiteFloorM2, autoM2), hi: Math.min(200_000, Math.max(i.whiteFloorM2, autoM2) * 3),
                metricAt: (x) => pctAt({ whiteFloorM2: x }),
                render: (x, achieved) => ({
                    label: `Reserve area → ${Math.ceil(x).toLocaleString()} m²`,
                    detail: `White space is AUTO-derived from the design rack count (racks × 0.72 m² ÷ 35% gross-up ≈ ${autoM2.toLocaleString()} m²) — you don't invent it. To reach ${u.label} ${Math.round(achieved)}% (${targetLabel}), reserve ≈${Math.ceil(x).toLocaleString()} m² in the building program via the phase plan (or lower density in Requirements).`,
                }),
                unreachable: (atHi) => ({
                    label: 'Area alone not enough',
                    detail: `Even ×3 area only reaches ${Math.round(atHi)}% — another constraint binds (check the binding-constraint row / rack density).`,
                }),
                targetTab: 'phases-local',
            };
        }
        return {  // 'itload' — defer/shift phases
            lo: i.itLoadKw, hi: i.itLoadKw * 0.4,
            metricAt: (x) => pctAt({ itLoadKw: x }),
            render: (x, achieved) => ({
                label: `IT load ${(i.itLoadKw / 1000).toFixed(1)} → ${(x / 1000).toFixed(1)} MW`,
                detail: `OR hold current IT load at ≤${(x / 1000).toFixed(1)} MW (defer −${((i.itLoadKw - x) / 1000).toFixed(1)} MW to a later phase) → ${u.label} utilization ${Math.round(achieved)}% (${targetLabel}) — set in Phase Plan & Economics.`,
            }),
            unreachable: (atHi) => ({
                label: 'Defer −60% load not enough',
                detail: `Bahkan IT load −60% hanya mencapai ${Math.round(atHi)}% — kapasitas desain perlu dinaikkan, bukan sekadar defer.`,
            }),
            targetTab: 'phases-local',
        };
    });
    return explainThresholdMetric({
        metricLabel: `${u.label} utilization`,
        value: u.pct,
        threshold: target,  // band-aware: At Risk solves to <85, Watch to <70 (matching the adapter bands)
        direction: 'atMost',
        fmtValue: (v) => `${Math.round(v)}%`,
        because: `${u.used.toLocaleString()}/${u.capacity.toLocaleString()} ${u.unit} terpakai (basis ${u.basis})`,
        levers: specs,
    });
}

export function CapacityPlanningPage() {
    const simInputs = useSimulationStore((s) => s.inputs);
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const req = useRequirementsStore();
    const futureExpansionMw = useArchitectureStore((s) => s.futureExpansionMw); // Architecture reserve (was a dead control) → shown as reserved headroom
    const [tab, setTab] = React.useState<'overview' | 'phases'>('overview');
    const [sysTab, setSysTab] = React.useState<'power' | 'cooling' | 'rack' | 'network'>('power');

    const i: CapInputs = React.useMemo(() => sanitizeCap({
        itLoadKw: simInputs.itLoad, tier: simInputs.tierLevel, coolingType: simInputs.coolingType,
        rackKw: req.workload.avgRackDensityKw, whiteFloorM2: simInputs.buildingSize, baseYear: simInputs.baseYear,
        marketType: 'wholesale', phases: simInputs.capacityPhases,
        designMarginPct: req.business.designMarginPct,
        growthMwByYear: [
            { label: 'Y0 (COD)', mw: simInputs.itLoad / 1000 },
            { label: 'Y1', mw: req.growth.itLoadMwByYear.y1 }, { label: 'Y2', mw: req.growth.itLoadMwByYear.y2 },
            { label: 'Y3', mw: req.growth.itLoadMwByYear.y3 }, { label: 'Y4', mw: req.growth.itLoadMwByYear.y4 },
            { label: 'Y5', mw: req.growth.itLoadMwByYear.y5 }, { label: 'Y10', mw: req.growth.itLoadMwByYear.y10 },
        ],
    }), [simInputs, req.workload.avgRackDensityKw, req.business.designMarginPct, req.growth.itLoadMwByYear]);

    const snap = React.useMemo(() => facilitySnapshot(i), [i]);
    const util = React.useMemo(() => utilization(i, snap.facilityMw), [i, snap.facilityMw]);
    const bands = React.useMemo(() => utilBands(i), [i]);
    const designPowerMw = (util.rows.find((r) => r.key === 'power')?.capacity ?? 0) * 0.9;
    const forecast = React.useMemo(() => forecastSeries(i, +designPowerMw.toFixed(0)), [i, designPowerMw]);
    const donut = React.useMemo(() => overheadDonut(i, snap.facilityMw), [i, snap.facilityMw]);
    const equip = React.useMemo(() => equipmentTable(i), [i]);
    const coolEquip = React.useMemo(() => coolingEquipmentTable(i), [i]);
    const rackSpace = React.useMemo(() => rackSpaceTable(i, util.rows, util.binding), [i, util.rows, util.binding]);
    const netFabric = React.useMemo(() => networkTable(i, util.rows), [i, util.rows]);
    const recs = React.useMemo(() => capRecommendations(i, util.rows, forecast), [i, util.rows, forecast]);
    const insights = React.useMemo(() => capKeyInsights(util.rows, forecast, i.baseYear), [util.rows, forecast, i.baseYear]);

    const peak = Math.max(...forecast.map((f) => f.forecastMw));
    const rackRow = util.rows.find((r) => r.key === 'rack');
    const [busy, setBusy] = React.useState(false);

    /* De-dup (owner): the 5-card strip + Key Insights used to repeat identically on
     * every system tab. Full strip stays on Power ONLY; other tabs get their own
     * relevant card(s) + a tab-specific insight (filter over the same adapter data). */
    const TAB_REC_TONES: Record<string, string[]> = { cooling: ['cooling'], rack: ['space'], network: ['network'] };
    const activeRecs = sysTab === 'power' ? recs : recs.filter((r) => (TAB_REC_TONES[sysTab] ?? []).includes(r.tone));
    const TAB_INSIGHT_RE: Record<string, RegExp> = { cooling: /cooling/i, rack: /rack|space|binding/i, network: /network/i };
    const coolRow = util.rows.find((r) => r.key === 'cooling');
    const tabExtraInsight = sysTab === 'cooling'
        ? `Cooling duty basis = IT heat (${(i.itLoadKw / 1000).toFixed(1)} MW), not IT × PUE — utilization ${coolRow?.pct ?? '—'}% of ${coolRow?.capacity ?? '—'} MW design; free-cooling hours cut compressor OPEX, not installed capacity.`
        : sysTab === 'rack'
        ? `Binding constraint: ${(util.binding ?? 'power').toUpperCase()} — ${util.binding === 'space' ? 'rack positions exhaust before electrical capacity; reserve area or raise density (cooling-technology ceiling applies)' : 'electrical capacity exhausts before rack positions; extra white space would strand — escalate power (margin/phases) instead'}.`
        : sysTab === 'network'
        ? 'Network rows are a screening spine-leaf estimate (no engine network model) — replace with the fabric design before committing.'
        : null;
    const activeInsights = sysTab === 'power'
        ? insights
        : [...insights.filter((s) => TAB_INSIGHT_RE[sysTab]?.test(s)), ...(tabExtraInsight ? [tabExtraInsight] : [])];

    /* Watch/At-Risk chip → solved remediation panel (explainThresholdMetric over the adapter) */
    const [utilExplain, setUtilExplain] = React.useState<string | null>(null);
    /* Power component-table At-Risk chip → shared DiagnosticModal (owner: every red value clickable) */
    const [powerRow, setPowerRow] = React.useState<string | null>(null);
    const powerActive = equip.rows.find((r) => r.label === powerRow && r.status !== 'OK');
    const utilEx = React.useMemo(() => {
        if (!utilExplain) return null;
        const u = util.rows.find((r) => r.key === utilExplain);
        return u ? { row: u, ex: explainUtilRow(i, u) } : null;
    }, [utilExplain, util.rows, i]);
    const exportPdf = async () => {
        setBusy(true);
        try {
            const firstUtil = util.rows[0];
            const narrativeMetrics = {
                strandedPct: (util.stranded?.fraction ?? 0) * 100,
                utilizationPct: Math.max(0, ...util.rows.map((u) => u.pct)),
            };
            await generatePillarPDF({
                title: 'Capacity Planning', layer: 'Capacity Planning Engine', project: '—',
                kpis: [
                    { label: 'IT Load (Total)', value: `${(i.itLoadKw / 1000).toFixed(1)} MW`, sub: 'current' },
                    { label: 'Peak Forecast', value: `${peak.toFixed(0)} MW`, sub: 'growth plan' },
                    { label: 'Total Facility Load', value: `${snap.facilityMw} MW`, sub: `PUE ${snap.pue} (${snap.source})` },
                    ...(firstUtil ? [{ label: firstUtil.label, value: `${firstUtil.capacity.toLocaleString()} ${firstUtil.unit}`, sub: `${firstUtil.pct}% utilized` }] : []),
                ],
                config: [
                    ['Tier', `Tier ${i.tier}`],
                    ['Cooling', i.coolingType],
                    ['Rack Density', `${i.rackKw} kW/rack`],
                    ['White Space', `${i.whiteFloorM2.toLocaleString()} m²`],
                    ['Design Margin', `${i.designMarginPct}%`],
                    ['Market Type', i.marketType],
                    ['Base Year', String(i.baseYear)],
                ],
                sections: [
                    { title: 'IT Load Forecast & Growth', head: ['Year', 'Committed (MW)', 'Forecast (MW)', 'Design (MW)'], rows: forecast.map((f) => [String(f.year), String(f.committedMw), String(f.forecastMw), String(f.designMw)]) },
                    { title: 'Capacity Utilization (Current)', head: ['System', 'Used', 'Capacity', 'Util %', 'Basis'], rows: util.rows.map((u) => [u.label, `${u.used.toLocaleString()} ${u.unit}`, `${u.capacity.toLocaleString()} ${u.unit}`, `${u.pct}%`, u.basis]) },
                ],
                callouts: [
                    ...insights.map((s, idx) => ({ title: `Key Insight ${idx + 1}`, body: s, tone: 'info' as const })),
                    ...(util.stranded?.isStranded ? [{
                        title: 'Stranded-Capacity Risk',
                        body: `${(util.stranded.fraction * 100).toFixed(0)}% idle at Y1 occupancy (Uptime 40% threshold).`,
                        tone: 'warn' as const,
                    }] : []),
                ],
                assessment: buildAssessment('capacity', narrativeMetrics),
                actions: [
                    ...buildActions('capacity', narrativeMetrics),
                    ...recs.map((r) => ({ priority: 'MEDIUM' as const, action: `${r.title}: ${r.body}` })),
                ],
                summaryBand: [
                    { label: 'IT Load', value: `${(i.itLoadKw / 1000).toFixed(1)} MW` },
                    { label: 'Peak', value: `${peak.toFixed(0)} MW` },
                    { label: 'Facility', value: `${snap.facilityMw} MW` },
                    { label: 'PUE', value: String(snap.pue) },
                    { label: 'Racks', value: String(rackRow?.used ?? '—') },
                    { label: 'Binding', value: util.binding ?? '—' },
                ],
                note: 'Engine-derived capacity analysis — committed = cumulative build phases, forecast = Requirements growth plan, design capacity incl. design margin. Network row is a screening assumption (no engine network model).',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-rz-2 bg-rz-elevated"><Layers className="h-6 w-6 text-rz-info" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capacity Planning Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Calculate and optimize total capacity requirements across Power, Cooling, Space and Network from the IT load profile and growth strategy</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {(['overview', 'phases'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs font-medium ${tab === t ? 'bg-rz-signal text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>
                                {t === 'overview' ? 'Capacity Overview' : 'Phase Plan & Economics'}
                            </button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('capex')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/90">Next: CAPEX Engine <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'phases' ? (
                <CapacityDashboardMod />
            ) : (
                <div className="space-y-4">
                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'IT Load (Total)', value: `${(i.itLoadKw / 1000).toFixed(1)} MW`, sub: 'current', trace: 'sim.itLoad', explain: 'it-load', tip: 'Current total critical IT load — the demand basis every engine sizes against, set in Requirements/Simulation. Y0 of the growth plan equals this value. Increasing it re-sizes power, cooling, space and CAPEX downstream; the utilization bars below show how much headroom is left.' },
                            { label: 'Peak Forecast', value: `${peak.toFixed(0)} MW`, sub: 'growth plan', trace: 'cap.peakForecastMw', tip: 'Highest forecast IT load across the Requirements growth plan (Y0→Y10). Compare it against the design-capacity line in the forecast chart — if peak approaches design, plan the next build phase or slow the commit ramp. Driven entirely by the per-year MW entries in Requirements.' },
                            { label: 'Total Facility Load', value: `${snap.facilityMw} MW`, sub: `PUE ${snap.pue} (${snap.source})`, trace: 'arch.facilityMw', tip: 'Total facility power draw = IT load × PUE (engine pueMatrix for the selected cooling and tier). This is what the utility connection and substation must supply — not just the IT load. Improving PUE via the cooling choice reduces it without giving up IT capacity.' },
                            ...util.rows.slice(0, 3).map((u) => ({ label: u.label, value: `${u.capacity.toLocaleString()} ${u.unit}`, sub: `${u.pct}% utilized${u.basis === 'assumption' ? ' · assumption' : ''}`, trace: UTIL_TRACE[u.key], tip: UTIL_TIPS[u.key] ?? `Installed ${u.label.toLowerCase()} capacity vs. current usage (${u.pct}% utilized), computed by the capacity adapter from the IT load profile.` })),
                            ...(futureExpansionMw && futureExpansionMw > 0 ? [{ label: 'Expansion Reserve', value: `${futureExpansionMw} MW`, sub: `≈${(futureExpansionMw * snap.pue).toFixed(1)} MW facility headroom`, tip: 'Future expansion capacity reserved beyond the committed phase plan, set in the Architecture rail. Reserve this much additional IT MW (≈ that × PUE of facility power, plus the land/substation to match) so the site can grow without re-permitting — size the utility feed and footprint for it now.' }] : []),
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { tip?: string }).tip && <InfoTip content={(k as { tip?: string }).tip!} />}{(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                                {(k as { trace?: string }).trace ? (
                                    <TraceValue traceId={(k as { trace?: string }).trace!}>
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    </TraceValue>
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                        {/* forecast chart */}
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">IT Load Forecast & Growth <InfoTip content="Committed load (cumulative build phases) vs. forecast demand (Requirements growth plan) vs. design capacity incl. design margin. Where forecast crosses committed you need the next phase live; where it approaches design you need a new build." /></h2>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={forecast}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                                        <YAxis tick={{ fontSize: 9 }} unit=" MW" />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>} />
                                        <Area dataKey="committedMw" name="Committed (phases)" fill="#22d3ee" stroke="#22d3ee" fillOpacity={0.15} />
                                        <Line dataKey="forecastMw" name="Forecast (growth plan)" stroke="#7DDDB4" strokeWidth={2} dot={{ r: 2 }} />
                                        <Line dataKey="designMw" name="Design Capacity" stroke="#f59e0b" strokeDasharray="6 4" dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="mt-1 text-[9px] text-slate-400">Committed = cumulative build phases · Forecast = Requirements growth plan · Design = power capacity incl. {i.designMarginPct}% margin.</p>
                        </div>

                        {/* breakdown + utilization */}
                        <div className="space-y-4">
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capacity Breakdown (Current) <InfoTip content="How the total facility load splits between IT load and infrastructure overhead (cooling, power losses, ancillary) at the current PUE. The overhead slice is what PUE improvements shrink — the IT slice is revenue-earning capacity." /></h2>
                                <div className="flex items-center gap-2">
                                    <div className="h-32 w-32">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={donut} dataKey="mw" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                                                    {donut.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx]} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => `${v} MW`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        {donut.map((r, idx) => (
                                            <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                <span className="h-2 w-2 rounded-sm" style={{ background: DONUT_COLORS[idx] }} />
                                                <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                <span className="ml-auto tabular-nums text-slate-500">{r.pct}%</span>
                                            </div>
                                        ))}
                                        <p className="pt-0.5 text-[9px] text-slate-400">PUE {snap.pue} · overhead split = screening decomposition</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capacity Utilization (Current) <InfoTip content="Per-system utilization computed by the capacity adapter (used ÷ installed capacity). OK < 70%, Watch 70-85%, At Risk ≥ 85% — click a Watch/At-Risk chip for a solved remediation plan with concrete levers." /></h2>
                                <p className="mb-1.5 text-[10px] text-slate-500" title="Power/cooling capacity is designed = IT load + design margin, so current utilization is structurally ≈ 1/(1+margin). What moves over time is the FORECAST (Forecast & Growth tab) — the exhaustion year per system is in Key Insights.">
                                    Basis: design capacity = IT + margin (current util ≈ 1/(1+margin) by construction) — the STATUS band uses the FORECAST growth peak + estimated exhaustion year per system. ⓘ
                                </p>
                                <div className="space-y-1.5">
                                    {util.rows.map((u) => (
                                        <React.Fragment key={u.key}>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="w-24 sm:w-28 truncate text-slate-600 dark:text-slate-300">{u.label}{u.basis === 'assumption' && <span className="ml-1 rounded bg-amber-500/15 px-1 text-[8px] text-amber-500">ASSUMPTION</span>}</span>
                                                <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                                    <div className={`h-2 rounded ${u.pct >= 85 ? 'bg-rose-500' : u.pct >= 70 ? 'bg-amber-500' : 'bg-rz-data'}`} style={{ width: `${Math.min(100, u.pct)}%` }} />
                                                </div>
                                                <span className="w-24 text-right tabular-nums text-slate-500">{u.used.toLocaleString()}/{u.capacity.toLocaleString()} {u.unit}</span>
                                                {/* Workstream M — ScoreValue: utilization is LOWER-better (low util = headroom = green) */}
                                                <span className="w-9 text-right tabular-nums font-semibold"
                                                    title={u.forecastPct != null ? `Now ${u.pct}% · forecast peak ${u.forecastPct}%${u.exhaustYear ? ` · exhaust ~${u.exhaustYear}` : ''}` : undefined}><ScoreValue value={u.pct} direction="lower" max={100} display={`${u.pct}%`} /></span>
                                                {(() => {
                                                    /* Banding forecast-aware + MARGIN-AWARE (Workstream R): without a phase
                                                     * plan utilization sits at the 1/(1+margin) structural floor, so OK
                                                     * starts just above it — margin 30% no longer reads "Watch forever". */
                                                    const bandPct = u.forecastPct ?? u.pct;
                                                    const chipTitle = `Band from FORECAST peak ${bandPct}% (now ${u.pct}%) · OK ≤${bands.okMax}%${bands.hasPhasePlan ? '' : ` (margin floor ≈${bands.floorPct}%)`}${u.exhaustYear ? ` — capacity exhausted ~${u.exhaustYear} without new phases` : ''} · click for quantified levers`;
                                                    return bandPct > bands.okMax ? (
                                                        <button onClick={() => setUtilExplain(utilExplain === u.key ? null : u.key)}
                                                            title={chipTitle}
                                                            className={`w-auto min-w-14 shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${bandPct >= bands.watchMax ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'} ${utilExplain === u.key ? 'ring-1 ring-amber-400' : ''}`}>
                                                            {bandPct >= bands.watchMax ? 'At Risk' : 'Watch'}{u.exhaustYear ? ` ·~${u.exhaustYear}` : ''} ⓘ
                                                        </button>
                                                    ) : <span title={chipTitle} className="w-14 shrink-0 cursor-help rounded px-1 py-0.5 text-center text-[9px] font-semibold bg-rz-data/15 text-rz-data">OK</span>;
                                                })()}
                                            </div>
                                            {utilEx && utilEx.row.key === u.key && (
                                                <DiagnosticModal
                                                    onClose={() => setUtilExplain(null)}
                                                    diagnosis={{
                                                        title: `${utilEx.row.label} utilization`,
                                                        reason: utilEx.ex.reason,
                                                        actual: `${(u.forecastPct ?? u.pct)}% (forecast peak)`,
                                                        threshold: (u.forecastPct ?? u.pct) >= 85 ? '<85% exits At-Risk' : '<70% OK band',
                                                        levers: utilEx.ex.levers.map((l) => ({
                                                            label: l.label,
                                                            detail: `${l.detail}${l.priority !== 'HIGH' ? ' (note — quantified bound, not a direct lever)' : ''}`,
                                                            tab: l.targetTab === 'phases-local' ? undefined : l.targetTab,
                                                        })),
                                                        note: 'Lever magnitudes are SOLVED by bisection over the live capacity adapter chain — not static estimates. Phase-plan levers: use the Phase Plan tab on this page.',
                                                    }}
                                                />
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                                {util.stranded?.isStranded && <p className="mt-1.5 text-[10px] text-amber-500">⚠ Stranded-capacity risk: {(util.stranded.fraction * 100).toFixed(0)}% idle at Y1 occupancy (Uptime 40% threshold).</p>}
                            </div>
                        </div>
                    </div>

                    {/* system detail tabs */}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <div className="mb-2 flex gap-1">
                            {([['power', 'Power Capacity', Zap], ['cooling', 'Cooling Capacity', Snowflake], ['rack', 'Rack & Space', Boxes], ['network', 'Network', Network]] as const).map(([k, label, Icon]) => (
                                <button key={k} onClick={() => setSysTab(k)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${sysTab === k ? 'bg-rz-signal text-rz-base' : 'text-slate-600 dark:text-slate-300 hover:bg-rz-signal/10'}`}>
                                    <Icon className="h-3 w-3" />{label}
                                </button>
                            ))}
                        </div>
                        {sysTab === 'power' && (
                            <div>
                                <table className="w-full text-xs">
                                    <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400"><th className="py-1 text-left">Component</th><th className="text-right">Capacity</th><th className="text-right">Utilization</th><th className="text-right">Status</th></tr></thead>
                                    <tbody>
                                        {equip.rows.map((r) => (
                                            <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                                <td className="py-1.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.config}</td>
                                                <td className="text-right"><ScoreValue value={r.utilPct} direction="lower" max={100} display={`${r.utilPct}%`} /></td>
                                                <td className="text-right">{r.status === 'OK'
                                                    ? <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-rz-data/15 text-rz-data">OK</span>
                                                    : <button onClick={() => setPowerRow(r.label)} title="Click for the diagnosis" className={`rounded px-1.5 py-0.5 text-[9px] font-semibold cursor-pointer hover:brightness-110 ${r.status === 'Watch' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>{r.status} ⓘ</button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {powerActive && (
                                    <DiagnosticModal
                                        diagnosis={{
                                            title: `${powerActive.label} — utilization ${powerActive.utilPct}%`,
                                            reason: powerActive.remediation ?? `Utilization ${powerActive.utilPct}% exceeds the ${powerActive.status === 'At Risk' ? '85% At-Risk' : '70% Watch'} threshold — little headroom for growth or concurrent maintenance.`,
                                            actual: `${powerActive.utilPct}%`,
                                            threshold: '≤ 85% (OK ≤ 70%)',
                                            gap: powerActive.utilPct > 85 ? `+${powerActive.utilPct - 85} pp over` : `${85 - powerActive.utilPct} pp to At-Risk`,
                                            levers: [
                                                { label: 'Defer load / re-phase', detail: 'Lower the load or move capacity to a later phase in the Phase Plan.', tab: 'capacity' },
                                                { label: 'Raise the design basis', detail: 'Adjust IT load / density / redundancy in Requirements — the unit count re-derives.', tab: 'requirements' },
                                            ],
                                            tab: 'requirements',
                                            note: equip.source,
                                        }}
                                        onClose={() => setPowerRow(null)}
                                    />
                                )}
                                        {equip.rows.some((r) => r.remediation) && (
                                            <div className="mt-2 space-y-1">
                                                {equip.rows.filter((r) => r.remediation).map((r) => (
                                                    <div key={r.label} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                                                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold text-white ${r.status === 'At Risk' ? 'bg-rose-600' : 'bg-amber-600'}`}>{r.label}</span>
                                                        <span>{r.remediation}
                                                            {/* klik-navigasi ke parameter: beban/fase di Phase Plan, rating/unit basis di Requirements */}
                                                            <button onClick={() => setTab('phases')} className="ml-1.5 font-medium text-rz-mint hover:text-rz-mint/80">Phase Plan →</button>
                                                            <button onClick={() => setActiveTab('requirements')} className="ml-1.5 font-medium text-rz-mint hover:text-rz-mint/80">Requirements →</button>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                <p className="mt-1 text-[9px] text-slate-400">{equip.source}</p>
                            </div>
                        )}
                        {sysTab === 'cooling' && (
                            <DetailTable table={coolEquip} headTips={DETAIL_HEAD_TIPS.cooling}
                                onPhase={() => setTab('phases')} onReq={() => setActiveTab('requirements')}
                                footnote={<>Cooling duty basis = <b>IT heat</b> ({(i.itLoadKw / 1000).toFixed(1)} MW), NOT IT × PUE — the PUE overhead ({(snap.facilityMw - i.itLoadKw / 1000).toFixed(1)} MW at PUE {snap.pue}, {i.coolingType}) is parasitic fan/pump power, not rejected-heat duty. Design capacity {util.rows[1].capacity} MW incl. {i.designMarginPct}% margin — utilization {util.rows[1].pct}%. · {coolEquip.source}</>} />
                        )}
                        {sysTab === 'rack' && (
                            <DetailTable table={rackSpace} headTips={DETAIL_HEAD_TIPS.rack}
                                onPhase={() => setTab('phases')} onReq={() => setActiveTab('requirements')}
                                footnote={<>{rackRow?.used.toLocaleString()} racks @ {i.rackKw} kW · white space {i.whiteFloorM2.toLocaleString()} m² · binding constraint <b>{util.binding ?? '—'}</b> · {rackSpace.source}</>} />
                        )}
                        {sysTab === 'network' && (
                            <DetailTable table={netFabric} headTips={DETAIL_HEAD_TIPS.network}
                                onPhase={() => setTab('phases')} onReq={() => setActiveTab('requirements')}
                                footnote={<><span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-500">SCREENING ASSUMPTION — no engine network model; validate with network design.</span> Spine-leaf estimate from rack count · {util.rows[4].used}/{util.rows[4].capacity} Tbps.</>} />
                        )}
                    </div>

                    {/* recommendations — de-duplicated per active system tab (owner: the 5-card
                      * strip + insights repeated identically on every tab). Full strip ONLY on
                      * Power; other tabs show their own card(s) + a tab-specific insight. */}
                    <div className={`grid gap-3 md:grid-cols-2 ${activeRecs.length >= 5 ? 'xl:grid-cols-5' : ''}`}>
                        {activeRecs.map((r) => (
                            <div key={r.title} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-rz-mint">{r.title}</div>
                                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{r.body}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded border border-rz-mint/30 bg-rz-mint/5 p-3">
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rz-mint">Key Insights{sysTab !== 'power' && <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">— {sysTab === 'cooling' ? 'Cooling' : sysTab === 'rack' ? 'Rack & Space' : 'Network'}</span>}</h3>
                        <ul className="space-y-0.5">
                            {activeInsights.map((s, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-rz-mint">✓</span>{s}</li>)}
                        </ul>
                        <button onClick={() => setActiveTab('requirements')} className="mt-1.5 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">Edit Growth Plan (Requirements) →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Shared system-detail table (cooling / rack & space / network) ──────────
 * Same markup + classes as the Power tab's equipment table so all four system
 * tabs render consistently: component · capacity · utilization · status chip,
 * plus the per-row escalation-lever block with Phase Plan / Requirements links.
 * No native title= — remediation renders in the lever block; every header and
 * row carries an InfoTip instead. */
function DetailTable({ table, headTips, footnote, onPhase, onReq }: {
    table: { rows: ComponentRow[]; source: string };
    headTips: HeadTips;
    footnote?: React.ReactNode;
    onPhase: () => void;
    onReq: () => void;
}) {
    /* Owner mandate — every red value is clickable → diagnosis modal (not just the
     * Power table). The remediation is already computed per row; open it in the
     * shared DiagnosticModal with quantified levers. */
    const [openRow, setOpenRow] = React.useState<string | null>(null);
    const active = table.rows.find((r) => r.label === openRow && r.status !== 'OK');
    return (
        <div>
            <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400"><th className="py-1 text-left">Component <InfoTip content={headTips.component} /></th><th className="text-right">Capacity <InfoTip content={headTips.capacity} /></th><th className="text-right">Utilization <InfoTip content={headTips.utilization} /></th><th className="text-right">Status <InfoTip content={headTips.status} /></th></tr></thead>
                <tbody>
                    {table.rows.map((r) => (
                        <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                            <td className="py-1.5 text-slate-700 dark:text-slate-200">{r.label}{r.tip && <InfoTip content={r.tip} />}</td>
                            <td className="text-right tabular-nums text-slate-500">{r.config}</td>
                            <td className="text-right"><ScoreValue value={r.utilPct} direction="lower" max={100} display={`${r.utilPct}%`} /></td>
                            <td className="text-right">{r.status === 'OK'
                                ? <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-rz-data/15 text-rz-data">OK</span>
                                : <button onClick={() => setOpenRow(r.label)} title="Click for the diagnosis" className={`rounded px-1.5 py-0.5 text-[9px] font-semibold cursor-pointer hover:brightness-110 ${r.status === 'Watch' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>{r.status} ⓘ</button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {active && (
                <DiagnosticModal
                    diagnosis={{
                        title: `${active.label} — utilization ${active.utilPct}%`,
                        reason: active.remediation ?? `Utilization ${active.utilPct}% exceeds the ${active.status === 'At Risk' ? '85% At-Risk' : '70% Watch'} threshold — the installed ${active.label.toLowerCase()} capacity has little headroom for growth or concurrent maintenance.`,
                        actual: `${active.utilPct}%`,
                        threshold: '≤ 85% (OK ≤ 70%)',
                        gap: active.utilPct > 85 ? `+${active.utilPct - 85} pp over` : `${85 - active.utilPct} pp to At-Risk`,
                        levers: [
                            { label: 'Defer load / re-phase', detail: 'Lower this component\'s load or move capacity to a later phase in the Phase Plan.', tab: 'capacity' },
                            { label: 'Raise the design basis', detail: 'Adjust IT load, rack density, cooling or redundancy in Requirements — the unit count re-derives.', tab: 'requirements' },
                        ],
                        tab: 'requirements',
                        note: `${table.source}`,
                    }}
                    onClose={() => setOpenRow(null)}
                />
            )}
            {table.rows.some((r) => r.remediation) && (
                <div className="mt-2 space-y-1">
                    {table.rows.filter((r) => r.remediation).map((r) => (
                        <div key={r.label} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold text-white ${r.status === 'At Risk' ? 'bg-rose-600' : 'bg-amber-600'}`}>{r.label}</span>
                            <span>{r.remediation}
                                {/* klik-navigasi ke parameter: beban/fase di Phase Plan, rating/unit basis di Requirements */}
                                <button onClick={onPhase} className="ml-1.5 font-medium text-rz-mint hover:text-rz-mint/80">Phase Plan →</button>
                                <button onClick={onReq} className="ml-1.5 font-medium text-rz-mint hover:text-rz-mint/80">Requirements →</button>
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <p className="mt-1 text-[9px] text-slate-400">{footnote ?? table.source}</p>
        </div>
    );
}
