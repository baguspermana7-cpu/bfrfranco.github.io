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
        turnoverRate: number | null; // Phase 5 Add
        // Phase 12 Add
        itLoad: number; // kW
        buildingSize: number; // m2
        coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid'; // Aligned with Capex
        coolingTopology: 'in-row' | 'perimeter' | 'dlc';
        powerRedundancy: 'N+1' | '2N' | '2N+1';

        maintenanceStrategy: 'reactive' | 'planned' | 'predictive';
        maintenanceModel: 'in-house' | 'vendor' | 'hybrid';
        hybridRatio: number; // 0.0 to 1.0 (In-house Portion)
        // Phase 13 Add
        headcount_ShiftLead: number;
        headcount_Engineer: number;
        headcount_Technician: number;
        headcount_Admin: number;
        headcount_Janitor: number;
        baseYear: number;
    };
    activeTab: 'sim' | 'staff' | 'maint' | 'risk' | 'report' | 'capex' | 'carbon' | 'finance';
    isLoading: boolean;
    actions: {
        setLoading: (loading: boolean) => void;
        selectCountry: (countryId: string) => void;
        setTierLevel: (tier: 2 | 3 | 4) => void;
        setShiftModel: (model: '8h' | '12h') => void;
        toggleLongShiftPermit: () => void;
        setAqiOverride: (aqi: number) => void;
        setTurnoverRate: (rate: number) => void;
        setInputs: (inputs: Partial<SimulationState['inputs']>) => void; // Bulk update
        setActiveTab: (tab: 'sim' | 'staff' | 'maint' | 'risk' | 'report' | 'capex' | 'carbon' | 'finance') => void;
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
        headcount_Janitor: 2,   // Day/evening coverage
        baseYear: 2025,
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
        setInputs: (newInputs) =>
            set((state) => ({
                inputs: { ...state.inputs, ...newInputs },
            })),
        setActiveTab: (tab) =>
            set(() => ({ activeTab: tab })),
    },
}));
