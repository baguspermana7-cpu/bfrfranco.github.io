import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
    type Dimension,
    initialDimensions,
    weightPresets,
    calculateCompositeScore,
    calculateWeightedSum,
    getMaturityLabel,
    type MaturityLevel
} from '../utils/scoring';

interface MaturityState {
    dimensions: Dimension[];
    activePreset: string;
    maturityMode: 'free' | 'pro';
    facilityMeta: {
        name: string;
        location: string;
        date: string;
        assessor: string;
    };
}

interface DerivedState {
    compositeScore: number;
    weightedSum: number;
    maturityLevel: MaturityLevel;
    gaps: { dimension: Dimension; gap: number; priority: number }[];
    riskAnalysis: {
        rmi: number; // Risk Mitigation Index %
        currentRisk: number;
        maxRisk: number;
    };
}

interface MaturityContextType {
    state: MaturityState;
    derived: DerivedState;
    actions: {
        updateDimensionValue: (id: string, value: number) => void;
        updateDimensionWeight: (id: string, weight: number) => void;
        setPreset: (presetKey: string) => void;
        setMaturityMode: (mode: 'free' | 'pro') => void;
        updateFacilityMeta: (field: keyof MaturityState['facilityMeta'], value: string) => void;
        reset: () => void;
    };
}

const MaturityContext = createContext<MaturityContextType | undefined>(undefined);

export const MaturityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<MaturityState>({
        dimensions: initialDimensions,
        activePreset: 'default',
        maturityMode: 'free',
        facilityMeta: {
            name: '',
            location: '',
            date: new Date().toISOString().split('T')[0],
            assessor: ''
        }
    });

    const [derived, setDerived] = useState<DerivedState>({
        compositeScore: 0,
        weightedSum: 0,
        maturityLevel: getMaturityLabel(0),
        gaps: [],
        riskAnalysis: { rmi: 0, currentRisk: 0, maxRisk: 0 }
    });

    useEffect(() => {
        const values = state.dimensions.map(d => d.value);
        const weights = state.dimensions.map(d => d.weight);

        const weightedSum = calculateWeightedSum(values, weights);
        const compositeScore = calculateCompositeScore(values, weights);
        const maturityLevel = getMaturityLabel(compositeScore);

        const gaps = state.dimensions.map(d => ({
            dimension: d,
            gap: 5 - d.value,
            priority: (5 - d.value) * d.weight * d.impact
        })).sort((a, b) => b.priority - a.priority);

        // RMI Logic: Risk = Gap * Weight * Impact
        // Max Risk = (5 - 1) * Weight * Impact (Assuming 1 is min score)
        const currentRisk = gaps.reduce((sum, g) => sum + g.priority, 0);
        const maxRisk = state.dimensions.reduce((sum, d) => sum + (4 * d.weight * d.impact), 0);
        const rmi = maxRisk > 0 ? ((maxRisk - currentRisk) / maxRisk) * 100 : 0;

        setDerived({
            compositeScore,
            weightedSum,
            maturityLevel,
            gaps,
            riskAnalysis: { rmi, currentRisk, maxRisk }
        });
    }, [state.dimensions]);

    const actions = {
        updateDimensionValue: (id: string, value: number) => {
            setState(prev => ({
                ...prev,
                dimensions: prev.dimensions.map(d =>
                    d.id === id ? { ...d, value } : d
                )
            }));
        },
        updateDimensionWeight: (id: string, weight: number) => {
            setState(prev => ({
                ...prev,
                dimensions: prev.dimensions.map(d =>
                    d.id === id ? { ...d, weight } : d
                )
            }));
        },
        setPreset: (presetKey: string) => {
            const preset = weightPresets[presetKey];
            if (!preset) return;

            setState(prev => ({
                ...prev,
                activePreset: presetKey,
                dimensions: prev.dimensions.map((d, i) => ({
                    ...d,
                    weight: preset.weights[i]
                }))
            }));
        },
        setMaturityMode: (mode: 'free' | 'pro') => {
            setState(prev => ({ ...prev, maturityMode: mode }));
        },
        updateFacilityMeta: (field: keyof MaturityState['facilityMeta'], value: string) => {
            setState(prev => ({
                ...prev,
                facilityMeta: {
                    ...prev.facilityMeta,
                    [field]: value
                }
            }));
        },
        reset: () => {
            setState({
                dimensions: initialDimensions,
                activePreset: 'default',
                maturityMode: 'free',
                facilityMeta: {
                    name: '',
                    location: '',
                    date: new Date().toISOString().split('T')[0],
                    assessor: ''
                }
            });
        }
    };

    return (
        <MaturityContext.Provider value={{ state, derived, actions }}>
            {children}
        </MaturityContext.Provider>
    );
};

export const useMaturity = () => {
    const context = useContext(MaturityContext);
    if (context === undefined) {
        throw new Error('useMaturity must be used within a MaturityProvider');
    }
    return context;
};
