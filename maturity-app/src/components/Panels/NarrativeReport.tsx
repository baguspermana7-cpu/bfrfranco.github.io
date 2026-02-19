import React from 'react';
import { useMaturity } from '../../context/MaturityContext';

export const NarrativeReport: React.FC = () => {
    const { derived, state } = useMaturity();
    const { compositeScore, maturityLevel, gaps } = derived;

    // Logic driven from article-1.html
    const score = Math.round(compositeScore);
    const strongest = [...state.dimensions].sort((a, b) => b.value - a.value)[0];
    const weakest = [...state.dimensions].sort((a, b) => a.value - b.value)[0];

    // Benchmark positioning
    let benchRef = '';
    if (score >= 82) benchRef = 'exceeds the Tier IV industry benchmark (82), placing this facility among the top-performing organizations globally';
    else if (score >= 65) benchRef = 'meets or exceeds the Tier III benchmark (65), indicating solid operational discipline with room for further optimization';
    else if (score >= 45) benchRef = 'aligns with the Tier II benchmark range (45), representing developing operational capabilities with significant improvement potential';
    else if (score >= 25) benchRef = 'falls within the Tier I benchmark range (25), indicating foundational capabilities that require substantial development';
    else benchRef = 'falls below the Tier I baseline, indicating critical operational gaps that pose immediate risk to facility reliability';

    // Recommendations
    const recommendations = [];
    const criticalCount = state.dimensions.filter(d => d.value <= 2).length;

    if (criticalCount > 0) recommendations.push({ priority: 'CRITICAL', text: `${criticalCount} dimension(s) scored at Level 1-2 (Ad-hoc/Repeatable). These represent immediate operational risk. Focus on establishing minimum viable processes within 90 days.` });

    if (gaps.length > 0) {
        recommendations.push({ priority: 'HIGH', text: `Top priority improvement: ${gaps[0].dimension.label} (currently ${gaps[0].dimension.value}/5). This dimension has the highest weighted impact score.` });
    }

    // ISO 55001 Mapping
    let isoStage = '';
    let isoDesc = '';
    if (score < 40) {
        isoStage = 'Awareness';
        isoDesc = 'Establish context, identify stack-holders, and define asset management policy (ISO 55001:4.1-5.2)';
    } else if (score < 70) {
        isoStage = 'Managed';
        isoDesc = 'Implement risk management (6.1), objectives (6.2), and operational planning (8.1)';
    } else {
        isoStage = 'Optimization';
        isoDesc = 'Focus on performance evaluation (9.1), audit (9.2), and continual improvement (10.2)';
    }

    return (
        <div className="bg-slate-50 p-8 rounded-xl text-slate-900 font-serif leading-relaxed shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-primary-blue border-b-2 border-primary-blue pb-2 mb-6">Executive Assessment & Recommendations</h2>

            <div className="flex gap-6 mb-8">
                <div className={`p-4 rounded-lg text-white w-40 text-center flex flex-col justify-center shrink-0 ${score >= 80 ? 'bg-emerald-600' : score >= 60 ? 'bg-amber-600' : 'bg-red-600'
                    }`}>
                    <div className="text-[10px] opacity-80 uppercase tracking-widest font-sans">Risk Level</div>
                    <div className="text-2xl font-bold my-1 font-sans">{score >= 80 ? 'LOW' : score >= 60 ? 'MODERATE' : 'HIGH'}</div>
                    <div className="text-xs opacity-80 font-sans border-t border-white/20 pt-1 mt-1">
                        RMI: {derived.riskAnalysis.rmi.toFixed(1)}%
                    </div>
                </div>

                <div className="text-sm space-y-3 flex-1">
                    <p><strong>Overall Assessment:</strong> This facility achieves a composite maturity score of <strong style={{ color: maturityLevel.color }}>{score}/100</strong> (Level {maturityLevel.level} — {maturityLevel.label}), which {benchRef}.</p>

                    <p><strong>Risk Mitigation Index (RMI):</strong> The facility currently mitigates <strong>{derived.riskAnalysis.rmi.toFixed(1)}%</strong> of potential operational risk factors based on the weighted impact analysis of all 8 dimensions.</p>

                    <p><strong>Strengths:</strong> {strongest.label} leads at {strongest.value}/5.
                        {state.dimensions.filter(d => d.value === 5).length > 0 && ` ${state.dimensions.filter(d => d.value === 5).length} dimension(s) are at maximum maturity.`}</p>

                    <p><strong>Vulnerabilities:</strong> {weakest.label} is the weakest dimension at {weakest.value}/5. {criticalCount > 0 && <span className="text-red-600 font-bold">{criticalCount} dimension(s) are at critical levels.</span>}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                <div>
                    <h3 className="text-sm font-bold text-primary-blue mb-3 uppercase tracking-wider font-sans">Strategic Recommendations</h3>
                    <table className="w-full text-sm border-collapse">
                        <tbody>
                            {recommendations.map((rec, i) => (
                                <tr key={i} className="border-b border-slate-200/50">
                                    <td className="py-2 pl-0 pr-4 w-24 align-top">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white font-sans ${rec.priority === 'CRITICAL' ? 'bg-red-600' : 'bg-amber-600'
                                            }`}>{rec.priority}</span>
                                    </td>
                                    <td className="py-2 text-slate-700">{rec.text}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider font-sans flex items-center gap-2">
                        ISO 55001 Strategic Roadmap
                    </h3>
                    <div className="text-lg font-bold text-slate-800 mb-1">{isoStage} Stage</div>
                    <div className="text-sm text-slate-600 italic mb-3">
                        {isoDesc}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                            <div className={`w-2 h-2 rounded-full ${score >= 25 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            <span>Phase 1: Policy & Context</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                            <div className={`w-2 h-2 rounded-full ${score >= 50 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            <span>Phase 2: Risk & Planning</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                            <div className={`w-2 h-2 rounded-full ${score >= 75 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            <span>Phase 3: Performance & Imp.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
