
import { useMaturity } from '../../context/MaturityContext';
import { dimensionDetails } from '../../data/dimensionDetails';
import { Info } from 'lucide-react';

export function InputPanel() {
    const { state, actions } = useMaturity();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Maturity Inputs</h2>
                <div className="text-xs text-slate-400">Rate each dimension 1-5</div>
            </div>

            <div className="space-y-4">
                {state.dimensions.map((dim) => {
                    const detail = dimensionDetails[dim.id];
                    const currentLevel = detail?.levels.find(l => l.value === dim.value);

                    return (
                        <div key={dim.id} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="text-sm font-semibold text-white">{dim.label}</label>
                                        <div className="group relative">
                                            <Info size={14} className="text-slate-500 hover:text-blue-400 cursor-help" />
                                            <div className="absolute left-0 bottom-full mb-2 w-64 bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50 hidden group-hover:block">
                                                <div className="text-xs font-bold text-blue-400 mb-1">{detail?.label} (Weight: {detail?.weight})</div>
                                                <div className="text-xs text-slate-300 leading-relaxed">{detail?.summary}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">{dim.value} - {currentLevel?.label}</div>
                                </div>
                                <div className="text-2xl font-bold text-accent-blue">{dim.value}</div>
                            </div>

                            {/* Description of current level */}
                            <div className="mb-3 text-xs text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-800/50 min-h-[40px] flex items-center">
                                {currentLevel?.description}
                            </div>

                            {/* Selector */}
                            <div className="grid grid-cols-5 gap-1">
                                {[1, 2, 3, 4, 5].map((val) => {
                                    const level = detail?.levels.find(l => l.value === val);
                                    return (
                                        <button
                                            key={val}
                                            onClick={() => actions.updateDimensionValue(dim.id, val)}
                                            title={`${val} - ${level?.label}: ${level?.description}`}
                                            className={`
                        h-8 rounded text-xs font-medium transition-all
                        ${dim.value === val
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}
                      `}
                                        >
                                            {val}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
