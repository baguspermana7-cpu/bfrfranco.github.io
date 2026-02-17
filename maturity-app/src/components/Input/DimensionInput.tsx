import React from 'react';
import type { Dimension } from '../../utils/scoring';
import { useMaturity } from '../../context/MaturityContext';

interface Props {
    dimension: Dimension;
}

export const DimensionInput: React.FC<Props> = ({ dimension }) => {
    const { actions } = useMaturity();

    return (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-semibold text-slate-200">{dimension.label}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">Weight: {(dimension.weight * 100).toFixed(0)}%</div>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${dimension.value <= 2 ? 'bg-red-500/10 text-red-500' :
                    dimension.value === 3 ? 'bg-amber-500/10 text-amber-500' :
                        dimension.value === 4 ? 'bg-emerald-500/10 text-emerald-500' :
                            'bg-blue-500/10 text-blue-500'
                    }`}>
                    {dimension.value}/5
                </div>
            </div>

            <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={dimension.value}
                onChange={(e) => actions.updateDimensionValue(dimension.id, parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent-blue hover:accent-accent-blue-light transition-all"
            />

            <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                <span>Reactive</span>
                <span>Preventive</span>
                <span>Predictive</span>
                <span>Proactive</span>
                <span>Generative</span>
            </div>
        </div>
    );
};
