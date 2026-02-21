import { useMemo } from 'react';
import { useSimulationStore } from './simulation';
import { calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';

/**
 * Returns simulation inputs with headcounts auto-resolved when staffingAutoMode is true.
 * Use this hook in any dashboard that depends on headcount values for consistent results.
 */
export function useEffectiveInputs() {
    const { inputs, selectedCountry } = useSimulationStore();

    return useMemo(() => {
        if (!inputs.staffingAutoMode) return inputs;

        const auto = calculateAutoHeadcount(
            inputs.itLoad,
            inputs.tierLevel,
            inputs.shiftModel,
            inputs.staffingModel === 'outsourced' ? 'outsourced' : inputs.staffingModel,
            inputs.maintenanceModel,
            inputs.maintenanceStrategy,
            inputs.hybridRatio ?? 0.5
        );

        return {
            ...inputs,
            headcount_ShiftLead: auto.headcounts['shift-lead'],
            headcount_Engineer: auto.headcounts['engineer'],
            headcount_Technician: auto.headcounts['technician'],
            headcount_Admin: auto.headcounts['admin'],
            headcount_Janitor: auto.headcounts['janitor'],
        };
    }, [inputs, selectedCountry]);
}
