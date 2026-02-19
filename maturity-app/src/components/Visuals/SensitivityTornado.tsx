import React, { useMemo } from 'react';
import { useMaturity } from '../../context/MaturityContext';
import { calculateCompositeScore } from '../../utils/scoring';

export const SensitivityTornado: React.FC = () => {
    const { state, derived } = useMaturity();

    const data = useMemo(() => {
        const baseScore = derived.compositeScore;
        const items = state.dimensions.map(d => {
            // Calculate Low (-1)
            const lowVals = state.dimensions.map(x => x.id === d.id ? Math.max(1, x.value - 1) : x.value);
            const lowScore = calculateCompositeScore(lowVals, state.dimensions.map(x => x.weight));

            // Calculate High (+1)
            const highVals = state.dimensions.map(x => x.id === d.id ? Math.min(5, x.value + 1) : x.value);
            const highScore = calculateCompositeScore(highVals, state.dimensions.map(x => x.weight));

            return {
                label: d.label,
                lowChange: lowScore - baseScore,
                highChange: highScore - baseScore,
                range: Math.abs(highScore - lowScore)
            };
        });

        return items.sort((a, b) => b.range - a.range);
    }, [state.dimensions, derived.compositeScore]);

    const maxRange = Math.max(...data.map(d => Math.max(Math.abs(d.lowChange), Math.abs(d.highChange))), 1);

    return (
        <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 px-2">Sensitivity Analysis (+/- 1 Level)</h3>
            <div className="space-y-3">
                {data.map(item => (
                    <div key={item.label} className="flex items-center gap-3 text-xs">
                        <div className="w-24 text-right text-slate-400 truncate" title={item.label}>{item.label}</div>
                        <div className="flex-1 h-5 bg-slate-700/30 rounded relative overflow-hidden">
                            {/* Center Line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500/50 z-10"></div>

                            {/* Negative Bar */}
                            <div
                                className="absolute top-0 bottom-0 bg-red-500/60 rounded-l"
                                style={{
                                    right: '50%',
                                    width: `${(Math.abs(item.lowChange) / maxRange) * 50}%`
                                }}
                            ></div>

                            {/* Positive Bar */}
                            <div
                                className="absolute top-0 bottom-0 bg-emerald-500/60 rounded-r"
                                style={{
                                    left: '50%',
                                    width: `${(Math.abs(item.highChange) / maxRange) * 50}%`
                                }}
                            ></div>
                        </div>
                        <div className="w-12 text-right font-mono text-slate-300">{item.range.toFixed(1)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
