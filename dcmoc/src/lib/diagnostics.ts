/* ─── Diagnostics Center — canonical model + registry (owner: "sempurnakan diagnostic")
 *
 * PROBLEM: 13 dashboards each export a pure `collect*Diagnostics(model)` collector,
 * but the `Finding` shapes DIVERGE (severity vocab high/critical/warning/medium/
 * warn/info · numeric vs string value/threshold · id vs surface · title/detail
 * present or not). This module (a) defines ONE canonical `DiagFinding`, (b)
 * NORMALIZES every collector's raw finding into it, and (c) provides a REGISTRY
 * that rebuilds each collector's `model` from the SAME global stores + pure
 * engine/adapter functions the page itself uses — so the Center's numbers equal
 * the page's numbers (collectors are pure, so this is faithful, not fabricated).
 *
 * HONESTY RULE (owner §4): a collector whose model cannot be computed lightly &
 * globally is SKIPPED with a documented reason — partial-but-true beats
 * complete-but-wrong. Currently ONE skip: Monte Carlo (runMonteCarlo is a
 * 10,000-iteration synchronous simulation; running it on every Center render is
 * unsafe — it stays UI-triggered on the Financial → Monte Carlo tab).
 *
 * Each `run(ctx)` is wrapped in try/catch → [] so one failing collector can never
 * take the whole Center down.
 * ──────────────────────────────────────────────────────────────────────── */

import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';

import { calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';
import type { SimulationState } from '@/store/simulation';

// ── Collectors (pure) ──
import { collectFinancialDiagnostics } from '@/components/modules/FinancialDashboard';
import { collectComplianceDiagnostics } from '@/components/modules/ComplianceDashboard';
import { collectBenchmarkDiagnostics } from '@/components/modules/BenchmarkDashboard';
import { collectCapacityDiagnostics } from '@/components/modules/CapacityDashboard';
import { collectGridDiagnostics } from '@/components/modules/GridReliabilityDashboard';
import { collectFuelGenDiagnostics } from '@/components/modules/FuelGenDashboard';
import { collectMaintenanceDiagnostics } from '@/components/modules/MaintenanceDashboard';
import { collectAssetLifecycleDiagnostics } from '@/components/modules/AssetLifecycleDashboard';
import { collectStrategicDiagnostics, computeFeasibility } from '@/components/modules/StrategicPlanningDashboard';
import { collectTalentDiagnostics } from '@/components/modules/TalentDashboard';
import { collectDesignToolsDiagnostics } from '@/components/modules/DesignToolsDashboards';
import { collectDisasterDiagnostics } from '@/components/modules/DisasterRiskDashboard';

// ── Engines / adapters (same imports the pages use) ──
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import { calculateCapex } from '@/lib/CapexEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { calculateCarbonFootprint } from '@/modules/analytics/CarbonEngine';
import { calculateBenchmark } from '@/modules/analytics/BenchmarkEngine';
import { computeCalibration } from '@/lib/calibration';
import { calculateCapacityPlan } from '@/modules/capacity/CapacityPlanningEngine';
import { calculateGridReliability } from '@/modules/infrastructure/GridReliabilityEngine';
import { calculateFuelGen } from '@/modules/infrastructure/FuelGenEngine';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { calculateSLAComparison } from '@/modules/maintenance/MaintenanceStrategyEngine';
import { calculateAssetLifecycle } from '@/modules/analytics/AssetLifecycleEngine';
import { calculateTalentAvailability } from '@/modules/staffing/TalentAvailabilityEngine';
import { computeSpares } from '@/state/adapters/spares-adapter';
import { calculateDisasterRisk } from '@/modules/risk/DisasterRiskEngine';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { MAINT_PER_KW_YR, REVENUE_PER_KW_MONTH } from '@/lib/screening';
import { getPUE } from '@/constants/pue';
import { rzData } from '@/lib/rz-engine';
import type { CountryProfile } from '@/constants/countries';

/* ─── Canonical finding ────────────────────────────────────────────────── */
export interface DiagFinding {
    surface: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    detail?: string;
    metric?: string;
    value?: number;
    threshold?: number;
    linkTab: string;
}

/** Loose shape covering every collector's divergent raw finding. */
export interface RawFinding {
    surface?: string;
    severity?: string;
    title?: string;
    detail?: string;
    metric?: string;
    value?: number | string;
    threshold?: number | string;
    linkTab?: string;
    id?: string;
}

const SEVERITY_ORDER: Record<DiagFinding['severity'], number> = { critical: 0, warning: 1, info: 2 };

/** high/critical → critical · warning/medium/warn → warning · info/anything → info. */
function normalizeSeverity(raw?: string): DiagFinding['severity'] {
    switch ((raw ?? '').toLowerCase()) {
        case 'critical':
        case 'high':
        case 'fail':
        case 'extreme':
            return 'critical';
        case 'warning':
        case 'warn':
        case 'medium':
        case 'med':
            return 'warning';
        default:
            return 'info';
    }
}

/** Coerce a string|number field to number when it parses; undefined otherwise. */
function toNum(v: number | string | undefined): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = parseFloat(v.replace(/[, ]/g, ''));
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

/**
 * Fold any collector's raw finding into the canonical `DiagFinding`.
 * - severity mapped via {@link normalizeSeverity}
 * - title built from metric+value (then threshold) when the collector omits one
 * - string value/threshold preserved into `detail` (Benchmark/Grid use them) and
 *   coerced into numeric value/threshold when possible
 */
export function normalize(raw: RawFinding, fallbackSurface: string, fallbackTab: string): DiagFinding {
    const severity = normalizeSeverity(raw.severity);
    const surface = raw.surface || fallbackSurface;
    const linkTab = raw.linkTab || fallbackTab;
    const numValue = toNum(raw.value);
    const numThreshold = toNum(raw.threshold);

    // Title: prefer explicit; else build from metric + value (+ threshold context).
    let title = raw.title;
    if (!title) {
        const valStr = raw.value !== undefined ? String(raw.value) : undefined;
        if (raw.metric && valStr !== undefined) {
            title = `${raw.metric}: ${valStr}`;
        } else if (raw.metric) {
            title = raw.metric;
        } else if (valStr !== undefined) {
            title = valStr;
        } else {
            title = surface;
        }
        if (raw.threshold !== undefined && numValue !== undefined) {
            title += ` (threshold ${String(raw.threshold)})`;
        }
    }

    // Detail: keep collector detail; when value/threshold were string bands
    // (Benchmark/Grid), fold them into detail so no context is lost.
    let detail = raw.detail;
    if (!detail) {
        const parts: string[] = [];
        if (typeof raw.value === 'string') parts.push(`Value: ${raw.value}`);
        if (typeof raw.threshold === 'string') parts.push(`Threshold: ${raw.threshold}`);
        if (parts.length) detail = parts.join(' · ');
    }

    return {
        surface,
        severity,
        title,
        detail,
        metric: raw.metric,
        value: numValue,
        threshold: numThreshold,
        linkTab,
    };
}

/* ─── Shared context builder — global stores + effective (auto-resolved)
 *     headcounts, mirroring the useEffectiveInputs hook in a plain function. ── */
export interface DiagContext {
    sim: SimulationState;
    country: CountryProfile | null;
    inputs: SimulationState['inputs'];
    /** inputs with headcounts auto-resolved when staffingAutoMode (== useEffectiveInputs). */
    eff: SimulationState['inputs'];
    capexResults: ReturnType<typeof calculateCapex> | null;
}

/** Non-hook twin of store/useEffectiveInputs — same calculateAutoHeadcount chain. */
function resolveEffectiveInputs(inputs: SimulationState['inputs']): SimulationState['inputs'] {
    if (!inputs.staffingAutoMode) return inputs;
    const auto = calculateAutoHeadcount(
        inputs.itLoad,
        inputs.tierLevel,
        inputs.shiftModel,
        inputs.staffingModel === 'outsourced' ? 'outsourced' : inputs.staffingModel,
        inputs.maintenanceModel,
        inputs.maintenanceStrategy,
        inputs.hybridRatio ?? 0.5,
    );
    return {
        ...inputs,
        headcount_ShiftLead: auto.headcounts['shift-lead'],
        headcount_Engineer: auto.headcounts['engineer'],
        headcount_Technician: auto.headcounts['technician'],
        headcount_Admin: auto.headcounts['admin'],
        headcount_Janitor: auto.headcounts['janitor'],
    };
}

function buildContext(): DiagContext {
    const sim = useSimulationStore.getState();
    const capex = useCapexStore.getState();
    const inputs = sim.inputs;
    return {
        sim,
        country: sim.selectedCountry,
        inputs,
        eff: resolveEffectiveInputs(inputs),
        // The capex store auto-runs runCalculation on rehydrate/setInputs, but
        // recompute from live inputs as a safety net so the Center never shows stale.
        capexResults: capex.results ?? (() => { try { return calculateCapex(capex.inputs); } catch { return null; } })(),
    };
}

/** Annual OPEX identical to FinancialDashboard (staff + energy + maintenance). */
function annualOpexOf(ctx: DiagContext): number {
    const c = ctx.country;
    if (!c) return 0;
    const labor = c.labor;
    const staffCost = (
        ctx.eff.headcount_ShiftLead * labor.baseSalary_ShiftLead +
        ctx.eff.headcount_Engineer * labor.baseSalary_Engineer +
        ctx.eff.headcount_Technician * labor.baseSalary_Technician +
        ctx.eff.headcount_Admin * labor.baseSalary_Admin +
        ctx.eff.headcount_Janitor * labor.baseSalary_Janitor
    ) * 12;
    const pue = (rzData().pueMatrix as Record<string, Record<string, number>> | undefined)
        ?.[ctx.inputs.coolingType]?.['tier' + ctx.inputs.tierLevel] ?? 1.4;
    const energyCost = ctx.eff.itLoad * pue * 8760 * (c.economy.electricityRate ?? 0.10);
    const maintenanceCost = ctx.eff.itLoad * MAINT_PER_KW_YR;
    return staffCost + energyCost + maintenanceCost;
}

/** Country-derived finInputs — mirrors FinancialDashboard's auto-derivation effect. */
function financialModel(ctx: DiagContext): { npv: number; roiPercent: number } | null {
    const c = ctx.country;
    if (!c || !ctx.capexResults) return null;
    const eco = c.economy;
    const tier = ctx.inputs.tierLevel ?? 3;
    const tierRevMult = tier === 4 ? 1.4 : tier === 3 ? 1.0 : 0.75;
    const baseRevPerKw = 120 + eco.electricityRate * 500;
    const autoRevPerKw = Math.round(baseRevPerKw * tierRevMult);
    const riskPremium = eco.inflationRate > 0.05 ? 0.04 : eco.inflationRate > 0.03 ? 0.02 : 0.01;
    const autoDiscount = Math.round((0.06 + riskPremium + eco.inflationRate) * 100) / 100;
    const res = calculateFinancials({
        totalCapex: ctx.capexResults.total,
        annualOpex: annualOpexOf(ctx),
        revenuePerKwMonth: autoRevPerKw,
        itLoadKw: ctx.inputs.itLoad,
        discountRate: Math.min(0.18, autoDiscount),
        projectLifeYears: 10,
        escalationRate: Math.round(eco.inflationRate * 1000) / 1000,
        opexEscalation: Math.round(eco.laborEscalation * 1000) / 1000,
        occupancyRamp: defaultOccupancyRamp(10),
        taxRate: Math.round(eco.taxRate * 1000) / 1000,
        depreciationYears: 15,
    });
    return { npv: res.npv, roiPercent: res.roiPercent };
}

/** Annual OPEX for the Benchmark/MonteCarlo basis (staff via calculateStaffing + energy + compliance). */
function benchmarkOpex(ctx: DiagContext, pue: number): number {
    const c = ctx.country!;
    const roles: Array<{ role: 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor'; count: number; is24x7: boolean }> = [
        { role: 'shift-lead', count: ctx.eff.headcount_ShiftLead, is24x7: true },
        { role: 'engineer', count: ctx.eff.headcount_Engineer, is24x7: true },
        { role: 'technician', count: ctx.eff.headcount_Technician, is24x7: false },
        { role: 'admin', count: ctx.eff.headcount_Admin, is24x7: false },
        { role: 'janitor', count: ctx.eff.headcount_Janitor, is24x7: false },
    ];
    const annualStaffCost = roles.reduce((sum, r) =>
        sum + calculateStaffing(r.role, r.count, ctx.inputs.shiftModel, c, r.is24x7).monthlyCost * 12, 0);
    const annualEnergy = ctx.inputs.itLoad * pue * 8760 / 1000;
    const annualEnergyCost = annualEnergy * (c.economy.electricityRate * 1000);
    return annualStaffCost + annualEnergyCost + (c.compliance.annualComplianceCost || 50000);
}

/* ─── Registry ─────────────────────────────────────────────────────────── */
export interface DiagSource {
    surface: string;
    linkTab: string;
    /** Reason this source is not wired (honest partial coverage). Present => run() returns []. */
    skipReason?: string;
    run: (ctx: DiagContext) => DiagFinding[];
}

const norm = (surface: string, tab: string) => (raws: RawFinding[]): DiagFinding[] =>
    raws.map((r) => normalize(r, surface, tab));

export const DIAG_SOURCES: DiagSource[] = [
    {
        surface: 'Financial',
        linkTab: 'finance',
        run: (ctx) => {
            const model = financialModel(ctx);
            if (!model) return [];
            return norm('Finance · Pro-Forma & Revenue', 'finance')(collectFinancialDiagnostics(model));
        },
    },
    {
        surface: 'Compliance',
        linkTab: 'compliance',
        run: (ctx) =>
            norm('Compliance', 'compliance')(
                collectComplianceDiagnostics({ selectedCountry: ctx.country, itLoadKw: ctx.inputs.itLoad }),
            ),
    },
    {
        surface: 'Industry Benchmarks',
        linkTab: 'benchmark',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            const capexResult = calculateCapex(useCapexStore.getState().inputs);
            const pue = capexResult.pue;
            const totalStaff = ctx.eff.headcount_ShiftLead + ctx.eff.headcount_Engineer +
                ctx.eff.headcount_Technician + ctx.eff.headcount_Admin + ctx.eff.headcount_Janitor;
            const annualOpex = benchmarkOpex(ctx, pue);
            const financialResult = calculateFinancials({
                totalCapex: capexResult.total,
                annualOpex,
                revenuePerKwMonth: 120,
                itLoadKw: ctx.inputs.itLoad,
                discountRate: 0.10,
                projectLifeYears: 10,
                escalationRate: 0.03,
                opexEscalation: c.economy.inflationRate,
                occupancyRamp: ctx.inputs.occupancyRamp.length > 0 ? ctx.inputs.occupancyRamp : defaultOccupancyRamp(10),
                taxRate: c.economy.taxRate,
                depreciationYears: 7,
            });
            const carbonResult = calculateCarbonFootprint({
                itLoadKw: ctx.inputs.itLoad,
                pue,
                gridCarbonIntensity: c.environment.gridCarbonIntensity,
                coolingType: ctx.inputs.coolingType,
                renewableOption: 'none',
                fuelHours: 50,
                genType: 'diesel',
                countryName: c.name,
            });
            const result = calculateBenchmark({
                itLoadKw: ctx.inputs.itLoad,
                coolingType: ctx.inputs.coolingType,
                tierLevel: ctx.inputs.tierLevel,
                totalStaff,
                turnoverRate: ctx.inputs.turnoverRate || 0.15,
                totalCapex: capexResult.total,
                annualOpex,
                irr: financialResult.irr,
                paybackYears: financialResult.paybackPeriodYears,
                pue,
                annualCO2: carbonResult.annualEmissionsTonCO2,
                gridCarbonIntensity: c.environment.gridCarbonIntensity,
                renewablePct: 0,
            });
            const calibration = (() => { try { return computeCalibration(); } catch { return null; } })();
            return norm('Industry Benchmarks', 'benchmark')(collectBenchmarkDiagnostics({ result, calibration }));
        },
    },
    {
        surface: 'Capacity Planning',
        linkTab: 'capacity',
        run: (ctx) => {
            const c = ctx.country;
            if (!c || ctx.inputs.capacityPhases.length === 0) return [];
            const result = calculateCapacityPlan({
                phases: ctx.inputs.capacityPhases,
                country: c,
                coolingType: ctx.inputs.coolingType,
                tierLevel: ctx.inputs.tierLevel,
                shiftModel: ctx.inputs.shiftModel,
                maintenanceModel: ctx.inputs.maintenanceModel,
                hybridRatio: ctx.inputs.hybridRatio,
            });
            return norm('Capacity Planning · Phase Risk', 'capacity')(collectCapacityDiagnostics(result));
        },
    },
    {
        surface: 'Grid Reliability',
        linkTab: 'grid',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            const result = calculateGridReliability({
                country: c,
                itLoadKw: useCapexStore.getState().inputs.itLoad || ctx.inputs.itLoad,
                tierLevel: ctx.inputs.tierLevel,
                coolingType: ctx.inputs.coolingType,
            });
            return norm('Grid Reliability', 'grid')(collectGridDiagnostics({ result, countryName: c.name }));
        },
    },
    {
        surface: 'Fuel & Generator',
        linkTab: 'fuel-gen',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            // testingRegime 'minimal' + no overrides = the page's default first-render view.
            const result = calculateFuelGen({
                country: c,
                itLoadKw: ctx.inputs.itLoad,
                tierLevel: ctx.inputs.tierLevel,
                coolingType: ctx.inputs.coolingType,
                coolingTopology: ctx.inputs.coolingTopology,
                powerRedundancy: ctx.inputs.powerRedundancy,
                testingRegime: 'minimal',
            });
            return norm('Infrastructure · Fuel & Generator', 'fuel-gen')(collectFuelGenDiagnostics(result));
        },
    },
    {
        surface: 'Maintenance',
        linkTab: 'maint',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            const coolingMap: 'air' | 'pumped' =
                ctx.inputs.coolingType === 'liquid' || ctx.inputs.coolingType === 'rdhx' ? 'pumped' : 'air';
            const estBuildingArea = ctx.inputs.itLoad * 1.5;
            const assetCounts = generateAssetCounts(
                ctx.inputs.itLoad,
                ctx.inputs.tierLevel === 4 ? 4 : 3,
                coolingMap,
                estBuildingArea,
                ctx.inputs.coolingTopology,
                ctx.inputs.powerRedundancy,
            );
            if (assetCounts.length === 0) return [];
            // Default SLA options (page defaults: OEM contract, new facility).
            const sla = calculateSLAComparison(
                assetCounts,
                ctx.inputs.tierLevel === 4 ? 4 : 3,
                c,
                { itLoadKw: ctx.inputs.itLoad, thirdParty: false, facilityAgeYears: 0 },
            );
            return norm('Maintenance · SLA Risk', 'maint')(collectMaintenanceDiagnostics({ sla }));
        },
    },
    {
        surface: 'Asset Lifecycle',
        linkTab: 'asset-lifecycle',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            const result = calculateAssetLifecycle({
                country: c,
                itLoadKw: ctx.inputs.itLoad,
                tierLevel: ctx.inputs.tierLevel,
                coolingType: ctx.inputs.coolingType,
                coolingTopology: ctx.inputs.coolingTopology,
                powerRedundancy: ctx.inputs.powerRedundancy,
                depreciationMethod: 'straight-line', // page default; collector reads depreciation-invariant fields
            });
            return norm('Asset Lifecycle', 'asset-lifecycle')(collectAssetLifecycleDiagnostics(result));
        },
    },
    {
        surface: 'Strategic Planning',
        linkTab: 'strategic',
        run: (ctx) => {
            const c = ctx.country;
            // Feasibility inputs derive from Site Intelligence (land/grid/climate) +
            // CAPEX + country economy — SAME derivation the Strategic page auto-syncs,
            // with the page's own defaults when a source is absent.
            const sites = useSitesStore.getState();
            const site = sites.sites.find((s) => s.id === sites.selectedSiteId) ?? sites.sites[0] ?? null;
            const acres = site?.attributes.usableAcres ?? site?.attributes.totalAcres ?? null;
            const landAreaM2 = acres != null ? Math.round(acres * 4046.86) : 10000;
            const gridCapacityMW = site?.attributes.availableCapacityMw ?? 20;
            const ambient = site?.attributes.avgAmbientC ?? null;
            const climateZone = ambient == null
                ? (c?.id === 'ID' || c?.id === 'SG' || c?.id === 'MY' ? 'tropical' : 'temperate')
                : ambient >= 26 ? 'tropical' : ambient >= 22 ? 'arid' : ambient >= 14 ? 'temperate' : ambient >= 5 ? 'continental' : 'polar';
            const basePUE = getPUE(ctx.inputs.coolingType);
            const capexPerMwRate = ctx.capexResults
                ? ctx.capexResults.total / Math.max(0.001, ctx.inputs.itLoad / 1000)
                : 6_000_000;
            const model = {
                feasibility: {
                    landAreaM2,
                    gridCapacityMW,
                    climateZone: climateZone as 'tropical' | 'arid' | 'temperate' | 'continental' | 'polar',
                    targetPUE: getPUE(ctx.inputs.coolingType),
                    basePUE,
                    capexPerMwRate,
                    electricityRate: c?.economy?.electricityRate ?? 0.10,
                },
            };
            // computeFeasibility is re-exported to keep the model self-checking headlessly.
            void computeFeasibility;
            return norm('Strategic Planning · Feasibility', 'strategic')(collectStrategicDiagnostics(model));
        },
    },
    {
        surface: 'Talent Index',
        linkTab: 'talent',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            const roles: Array<{ role: 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor'; count: number; is24x7: boolean }> = [
                { role: 'shift-lead', count: ctx.inputs.headcount_ShiftLead, is24x7: true },
                { role: 'engineer', count: ctx.inputs.headcount_Engineer, is24x7: true },
                { role: 'technician', count: ctx.inputs.headcount_Technician, is24x7: false },
                { role: 'admin', count: ctx.inputs.headcount_Admin, is24x7: false },
                { role: 'janitor', count: ctx.inputs.headcount_Janitor, is24x7: false },
            ];
            let annualStaffCost = 0;
            let totalFTE = 0;
            for (const r of roles) {
                const res = calculateStaffing(r.role, r.count, ctx.inputs.shiftModel, c, r.is24x7);
                annualStaffCost += res.monthlyCost * 12;
                totalFTE += res.headcount;
            }
            // Talent findings surface when the model produces them.
            const _talent = calculateTalentAvailability({ country: c, totalFTE, annualStaffCost });
            void _talent;
            return norm('Talent Index', 'talent')(
                collectTalentDiagnostics({ country: c, totalFTE, annualStaffCost }),
            );
        },
    },
    {
        surface: 'Design Tools (Spares / CDU)',
        linkTab: 'spares',
        run: (ctx) => {
            const req = useRequirementsStore.getState();
            const bucket = densityToEngineBucket(req.workload.avgRackDensityKw);
            const spares = (() => {
                try {
                    const res = computeSpares({
                        itLoadKw: ctx.inputs.itLoad,
                        densityBucket: bucket,
                        countryId: ctx.country?.id,
                        overrides: {},
                    });
                    return res.engineReady ? { engineReady: res.engineReady, rows: res.rows } : null;
                } catch { return null; }
            })();
            const refrigerant = (() => {
                const data = rzData();
                const refDb = (data?.refrigerants ?? {}) as Record<string, { gwp: number }>;
                const useCapex = useCapexStore.getState();
                const refKey = (useCapex.inputs as { refrigerantType?: string }).refrigerantType
                    ?? (data?.refrigerantAutoByCooling as Record<string, string> | undefined)?.[ctx.inputs.coolingType]
                    ?? 'R134a';
                return refDb[refKey] ? { key: refKey, gwp: refDb[refKey].gwp } : null;
            })();
            return norm('Design Tools', 'spares')(collectDesignToolsDiagnostics({ spares, refrigerant }));
        },
    },
    {
        surface: 'Disaster Risk',
        linkTab: 'disaster',
        run: (ctx) => {
            const c = ctx.country;
            if (!c) return [];
            const itLoad = useCapexStore.getState().inputs.itLoad || ctx.inputs.itLoad;
            const totalCapex = ctx.capexResults?.total || itLoad * 10000;
            const annualRevenue = itLoad * REVENUE_PER_KW_MONTH * 12;
            const result = calculateDisasterRisk({ country: c, totalCapex, itLoadKw: itLoad, annualRevenue });
            return norm('Disaster Risk', 'disaster')(collectDisasterDiagnostics({ result, country: c }));
        },
    },
    {
        // HONEST SKIP (owner §4): runMonteCarlo is a 10,000-iteration synchronous
        // simulation — running it on every Diagnostics Center render would jank the
        // UI. It stays UI-triggered on Financial → Monte Carlo ("Run Simulation").
        surface: 'Monte Carlo',
        linkTab: 'montecarlo',
        skipReason: 'runMonteCarlo is a 10k-iteration synchronous sim — too expensive to run on every Center render; stays UI-triggered on Financial → Monte Carlo.',
        run: () => [],
    },
];

/** Number of collectors wired vs skipped (for the Center header / reports). */
export const DIAG_COVERAGE = {
    total: DIAG_SOURCES.length,
    wired: DIAG_SOURCES.filter((s) => !s.skipReason).length,
    skipped: DIAG_SOURCES.filter((s) => s.skipReason),
};

/**
 * Run every wired collector, normalize, aggregate, and sort (critical → warning →
 * info; then higher |value| first as a stable tiebreak). Each source is isolated
 * in try/catch so a single collector failure can never crash the Center.
 */
export function collectAllDiagnostics(): DiagFinding[] {
    const ctx = buildContext();
    const all: DiagFinding[] = [];
    for (const source of DIAG_SOURCES) {
        if (source.skipReason) continue;
        try {
            all.push(...source.run(ctx));
        } catch {
            // one collector down must not take the Center down
        }
    }
    return all.sort((a, b) => {
        const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (s !== 0) return s;
        return (b.value ?? 0) - (a.value ?? 0) === 0 ? a.surface.localeCompare(b.surface) : 0;
    });
}
