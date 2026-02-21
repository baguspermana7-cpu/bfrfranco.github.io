import { create } from 'zustand';
import { COUNTRIES, CountryProfile } from '@/constants/countries';

interface SimulationState {
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

        maintenanceStrategy: 'reactive' | 'planned' | 'predictive';
        maintenanceModel: 'in-house' | 'vendor' | 'hybrid';
        hybridRatio: number;
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
    };
    activeTab: 'sim' | 'staff' | 'maint' | 'risk' | 'report' | 'capex' | 'carbon' | 'finance' | 'invest' | 'benchmark' | 'montecarlo' | 'portfolio' | 'faq' | 'capacity' | 'phased-finance' | 'tax' | 'disaster' | 'grid' | 'talent' | 'compliance' | 'asset-lifecycle' | 'cbm' | 'fuel-gen';
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

export const useSimulationStore = create<SimulationState>((set) => ({
    selectedCountry: COUNTRIES['ID'],
    isLoading: false,
    inputs: {
        tierLevel: 3,
        staffingModel: 'in-house',
        shiftModel: '8h',
        includeLongShiftPermit: false,
        aqiOverride: null,
        turnoverRate: 0.15, // Default 15%
        itLoad: 2500, // Default 2.5MW Data Hall
        buildingSize: 1500, // Default 1500m2 for 2.5MW
        coolingType: 'air', // Default CRAC
        coolingTopology: 'perimeter',
        powerRedundancy: '2N',
        maintenanceStrategy: 'planned',
        // Phase 16 Add
        maintenanceModel: 'hybrid', // Default to Hybrid for demo
        hybridRatio: 0.3, // 30% In-house / 70% Vendor
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
        capacityPhases: [
            { id: 'p1', label: 'Phase 1', itLoadKw: 2000, startMonth: 0, buildMonths: 18, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
            { id: 'p2', label: 'Phase 2', itLoadKw: 5000, startMonth: 18, buildMonths: 14, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
            { id: 'p3', label: 'Phase 3', itLoadKw: 10000, startMonth: 36, buildMonths: 12, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
        ],
    },
    activeTab: 'sim', // Change default to SIM for "Super App" feel
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
}));
