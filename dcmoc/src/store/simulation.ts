import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { COUNTRIES, CountryProfile } from '@/constants/countries';
import { rzData } from '@/lib/rz-engine';

export interface SimulationState {
    selectedCountry: CountryProfile | null;
    inputs: {
        tierLevel: 2 | 3 | 4;
        staffingModel: 'in-house' | 'outsourced' | 'hybrid';
        shiftModel: '8h' | '12h';
        includeLongShiftPermit: boolean;
        aqiOverride: number | null;
        turnoverRate: number | null;
        itLoad: number; // kW
        buildingSize: number; // m2
        coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
        coolingTopology: 'in-row' | 'perimeter' | 'dlc';
        powerRedundancy: 'N+1' | '2N' | '2N+1';
        /** Workstream A — power topology + fuel. Drives genset run-hours (standby
         *  vs continuous prime), grid substation CAPEX (0 for off-grid prime),
         *  genset CAPEX multiplier, and fuel CO₂/cost. Ireland off-grid case. */
        powerSource: 'utility-backup' | 'prime' | 'hybrid';
        fuelType: 'diesel' | 'hvo' | 'natural-gas' | 'solar-hybrid' | 'fuel-cell' | 'biogas';

        maintenanceStrategy: 'reactive' | 'planned' | 'predictive';
        /** Workstream 10 — planned-maintenance compliance regime. 'oem-full' = every
         *  OEM PM task at OEM interval (max manpower); 'standard-annual' = most tasks
         *  consolidated to annual, only 1-2 critical systems at OEM frequency (far
         *  fewer labor-hours, marginally higher failure exposure). */
        pmRegime: 'oem-full' | 'standard-annual';
        /** Workstream G — strategy as a % MIX (fractions summing 1). The legacy
         *  discrete `maintenanceStrategy` buttons act as pure-mix presets; the
         *  mix drives the engine's opsHeadcount + availabilityImpact models. */
        strategyMix?: { reactive: number; planned: number; predictive: number };
        /** Workstream G — selected vendor SLA response class (Maintenance SLA
         *  tab). Feeds models.maintenance.availabilityImpact effective MTTR. */
        slaKey?: '2hr' | '4hr' | 'nbd';
        maintenanceModel: 'in-house' | 'vendor' | 'hybrid';
        hybridRatio: number;
        /** Optimizer tunable (Workstream D): colo revenue price $/kW-mo — a commercial
         *  fine-tune the Auto-optimizer may move inside its band; default 150. */
        revenuePerKwMonth?: number;
        headcount_ShiftLead: number;
        headcount_Engineer: number;
        headcount_Technician: number;
        headcount_Admin: number;
        headcount_Janitor: number;
        baseYear: number;
        // A12: Configurable occupancy ramp (year-by-year %)
        occupancyRamp: number[];
        staffingAutoMode: boolean;
        // Capacity planning phases
        capacityPhases: { id: string; label: string; itLoadKw: number; startMonth: number; buildMonths: number; occupancyRamp: number[] }[];
        capacityPhasesCustomized: boolean;
    };
    activeTab: 'dashboard' | 'ops' | 'sim' | 'staff' | 'maint' | 'risk' | 'report' | 'capex' | 'carbon' | 'finance' | 'invest' | 'benchmark' | 'montecarlo' | 'portfolio' | 'faq' | 'capacity' | 'phased-finance' | 'tax' | 'disaster' | 'grid' | 'talent' | 'compliance' | 'asset-lifecycle' | 'cbm' | 'fuel-gen' | 'strategic' | 'reliability' | 'requirements' | 'site' | 'architecture' | 'construction' | 'commissioning' | 'asset-health' | 'projects' | 'templates' | 'data-library' | 'knowledge' | 'integrations' | 'settings' | 'audit' | 'users' | 'tier' | 'fire' | 'cdu' | 'spares' | 'scenarios' | 'scenario-compare' | 'diagnostics';
    isLoading: boolean;
    actions: {
        setLoading: (loading: boolean) => void;
        selectCountry: (countryId: string) => void;
        setTierLevel: (tier: 2 | 3 | 4) => void;
        setShiftModel: (model: '8h' | '12h') => void;
        toggleLongShiftPermit: () => void;
        setAqiOverride: (aqi: number) => void;
        setTurnoverRate: (rate: number) => void;
        toggleStaffingAutoMode: () => void;
        setInputs: (inputs: Partial<SimulationState['inputs']>) => void; // Bulk update
        setActiveTab: (tab: SimulationState['activeTab']) => void;
    };
}

/* ── Workstream G — strategy-mix helpers (pure + exported: Maintenance mix
 * editor, Staffing ops model and Risk availability model all reuse them). ── */
export type StrategyMix = { reactive: number; planned: number; predictive: number };

/** Pure-mix presets — clicking a discrete strategy button writes one of these. */
export const STRATEGY_MIX_PRESETS: Record<'reactive' | 'planned' | 'predictive', StrategyMix> = {
    reactive: { reactive: 1, planned: 0, predictive: 0 },
    planned: { reactive: 0, planned: 1, predictive: 0 },
    predictive: { reactive: 0, planned: 0, predictive: 1 },
};

/** Normalize a mix to fractions summing exactly 1 (empty/degenerate → pure planned). */
export function normalizeStrategyMix(mix: Partial<StrategyMix> | undefined): StrategyMix {
    const r = Math.max(0, mix?.reactive ?? 0);
    const p = Math.max(0, mix?.planned ?? 0);
    const d = Math.max(0, mix?.predictive ?? 0);
    const sum = r + p + d;
    if (sum <= 0) return { ...STRATEGY_MIX_PRESETS.planned };
    return { reactive: r / sum, planned: p / sum, predictive: d / sum };
}

/** Effective in-house share for the engine ops models: pure models pin 1/0,
 *  hybrid uses the hybridRatio slider (owner: hybridRatio IS the in-house %). */
export function effectiveInHouseFrac(inputs: Pick<SimulationState['inputs'], 'maintenanceModel' | 'hybridRatio'>): number {
    if (inputs.maintenanceModel === 'in-house') return 1;
    if (inputs.maintenanceModel === 'vendor') return 0;
    return Math.max(0, Math.min(1, inputs.hybridRatio ?? 0.5));
}

/** DA2 — screening 4-phase split of the IT load (25/25/25/25 staggered).
 *  Pure + exported: the Capacity page "Seed from IT Load" button reuses it. */
export function derivePhases(itLoadKw: number): { id: string; label: string; itLoadKw: number; startMonth: number; buildMonths: number; occupancyRamp: number[] }[] {
    const kw = Math.max(100, Math.round(itLoadKw));
    const share = Math.round(kw / 4);
    const ramp = [0.3, 0.6, 0.85, 0.95];
    return [
        { id: 'p1', label: 'Phase 1', itLoadKw: share, startMonth: 0, buildMonths: 18, occupancyRamp: ramp },
        { id: 'p2', label: 'Phase 2', itLoadKw: share, startMonth: 18, buildMonths: 14, occupancyRamp: ramp },
        { id: 'p3', label: 'Phase 3', itLoadKw: share, startMonth: 36, buildMonths: 12, occupancyRamp: ramp },
        { id: 'p4', label: 'Phase 4', itLoadKw: kw - share * 3, startMonth: 54, buildMonths: 12, occupancyRamp: ramp },
    ];
}

/* DF1 — inputs + country + activeTab PERSIST (audit-critical: reload wiped
 * tier/itLoad/cooling/phases while requirements persisted). selectedCountry
 * rehydrates as an id → re-resolved to the live COUNTRIES profile. */
export const useSimulationStore = create<SimulationState>()(persist((set) => ({
    selectedCountry: COUNTRIES['ID'],
    isLoading: false,
    inputs: {
        tierLevel: 3,
        staffingModel: 'in-house',
        shiftModel: '8h',
        includeLongShiftPermit: false,
        aqiOverride: null,
        // Default from engine DATA.attritionFactors.voluntaryAttritionAvg (0.25,
        // DataX Connect 2024 baseline) — same-fact reconciliation vs old 0.15
        // local; 0.15 remains the engine-absent fallback. Safe at module scope:
        // the head-defer engine script executes before Next's body bundles.
        turnoverRate: rzData().attritionFactors?.voluntaryAttritionAvg ?? 0.15,
        itLoad: 2500, // Default 2.5MW Data Hall
        buildingSize: 1500, // Default 1500m2 for 2.5MW
        coolingType: 'air', // Default CRAC
        coolingTopology: 'perimeter',
        powerRedundancy: '2N',
        powerSource: 'utility-backup',
        fuelType: 'diesel',
        maintenanceStrategy: 'planned',
        pmRegime: 'oem-full',
        strategyMix: { reactive: 0, planned: 1, predictive: 0 },
        slaKey: '4hr',
        // Phase 16 Add
        maintenanceModel: 'hybrid', // Default to Hybrid for demo
        hybridRatio: 0.3, // 30% In-house / 70% Vendor
        revenuePerKwMonth: 150,
        // Default Headcounts (Standard Site)
        headcount_ShiftLead: 4, // 4 Team Leaders on 4on/4off rotation
        headcount_Engineer: 5,  // 4 on shift + 1 floating/relief
        headcount_Technician: 2, // Day shift preventive maintenance
        headcount_Admin: 1,     // Supervisor (Day M-F)
        headcount_Janitor: 2,
        baseYear: 2025,
        // A12: Default occupancy ramp (editable per-year)
        occupancyRamp: [0.25, 0.50, 0.70, 0.85, 0.92, 0.95, 0.95, 0.95, 0.95, 0.95],
        staffingAutoMode: true,
        /* DA2 — phases are DERIVED from itLoad (owner-caught bug: hardcoded
         * 2/5/10 MW showed a 22 MW plan on a 500 MW project). Pristine phases
         * re-derive on every itLoad change; a manual edit sets
         * capacityPhasesCustomized and derivation stops (identity chip shows
         * divergence on the Capacity page instead). */
        capacityPhases: derivePhases(2500),
        capacityPhasesCustomized: false,
    },
    activeTab: 'dashboard', // DC-OS: Executive Overview is the landing surface
    actions: {
        setLoading: (loading) => set({ isLoading: loading }),
        selectCountry: (countryId) =>
            set((state) => ({
                selectedCountry: COUNTRIES[countryId] || state.selectedCountry,
            })),
        setTierLevel: (tier) =>
            set((state) => ({
                inputs: { ...state.inputs, tierLevel: tier },
            })),
        setShiftModel: (model) =>
            set((state) => ({
                inputs: { ...state.inputs, shiftModel: model },
            })),
        toggleLongShiftPermit: () =>
            set((state) => ({
                inputs: {
                    ...state.inputs,
                    includeLongShiftPermit: !state.inputs.includeLongShiftPermit,
                },
            })),
        setAqiOverride: (aqi) =>
            set((state) => ({
                inputs: { ...state.inputs, aqiOverride: aqi },
            })),
        setTurnoverRate: (rate) =>
            set((state) => ({
                inputs: { ...state.inputs, turnoverRate: rate },
            })),
        toggleStaffingAutoMode: () =>
            set((state) => ({
                inputs: { ...state.inputs, staffingAutoMode: !state.inputs.staffingAutoMode },
            })),
        // D1: Input validation with min/max clamping
        setInputs: (newInputs) =>
            set((state) => {
                const validated = { ...newInputs };
                if (validated.itLoad !== undefined) validated.itLoad = Math.max(100, Math.min(500000, validated.itLoad));
                /* revenue basis (app-wide SSOT tunable) — clamp to a sane band
                 * ($50-500/kW·mo spans retail→AI-premium; JLL 2026 wholesale
                 * $140-230) so a typo in the Financial field can't poison
                 * every DCF surface. */
                if (validated.revenuePerKwMonth !== undefined) validated.revenuePerKwMonth = Math.max(50, Math.min(500, validated.revenuePerKwMonth));
                /* Workstream G — discrete strategy buttons are PRESETS of the %
                 * mix: clicking one also writes the matching pure mix (unless a
                 * caller passed an explicit mix in the same update). */
                if (validated.maintenanceStrategy !== undefined && validated.strategyMix === undefined) {
                    validated.strategyMix = { ...STRATEGY_MIX_PRESETS[validated.maintenanceStrategy] };
                }
                if (validated.strategyMix !== undefined) {
                    validated.strategyMix = normalizeStrategyMix(validated.strategyMix);
                }
                /* DA2 — pristine phases FOLLOW itLoad; a manual phase edit flags
                 * customized and derivation stops (Capacity page shows the
                 * divergence chip + "Seed from IT Load" instead). */
                if (validated.capacityPhases !== undefined && newInputs.capacityPhasesCustomized === undefined) {
                    validated.capacityPhasesCustomized = true;
                }
                if (validated.itLoad !== undefined && validated.capacityPhases === undefined && !state.inputs.capacityPhasesCustomized) {
                    validated.capacityPhases = derivePhases(validated.itLoad);
                }
                if (validated.buildingSize !== undefined) validated.buildingSize = Math.max(100, Math.min(100000, validated.buildingSize));
                if (validated.headcount_ShiftLead !== undefined) validated.headcount_ShiftLead = Math.max(0, Math.min(50, validated.headcount_ShiftLead));
                if (validated.headcount_Engineer !== undefined) validated.headcount_Engineer = Math.max(0, Math.min(100, validated.headcount_Engineer));
                if (validated.headcount_Technician !== undefined) validated.headcount_Technician = Math.max(0, Math.min(100, validated.headcount_Technician));
                if (validated.headcount_Admin !== undefined) validated.headcount_Admin = Math.max(0, Math.min(20, validated.headcount_Admin));
                if (validated.headcount_Janitor !== undefined) validated.headcount_Janitor = Math.max(0, Math.min(20, validated.headcount_Janitor));
                if (validated.hybridRatio !== undefined) validated.hybridRatio = Math.max(0, Math.min(1, validated.hybridRatio));
                if (validated.turnoverRate !== undefined && validated.turnoverRate !== null) {
                    validated.turnoverRate = Math.max(0, Math.min(1, validated.turnoverRate));
                }
                return { inputs: { ...state.inputs, ...validated } };
            }),
        setActiveTab: (tab) =>
            set(() => ({ activeTab: tab })),
    },
}), {
    name: 'dcmoc-simulation',
    version: 1,
    partialize: (s) => ({ inputs: s.inputs, selectedCountry: s.selectedCountry ? ({ id: s.selectedCountry.id } as unknown as CountryProfile) : null }),
    merge: (persisted, current) => {
        const p = persisted as Partial<SimulationState> | undefined;
        const cid = (p?.selectedCountry as { id?: string } | null)?.id;
        return {
            ...current,
            ...(p ?? {}),
            inputs: { ...current.inputs, ...(p?.inputs ?? {}), capacityPhasesCustomized: p?.inputs?.capacityPhasesCustomized ?? false },
            selectedCountry: cid && COUNTRIES[cid] ? COUNTRIES[cid] : current.selectedCountry,
        };
    },
}));
