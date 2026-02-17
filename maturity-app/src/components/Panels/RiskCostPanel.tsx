import React from 'react';
import { useMaturity } from '../../context/MaturityContext';
import { TriangleAlert, Activity } from 'lucide-react';

export const RiskCostPanel: React.FC = () => {
    const { derived } = useMaturity();
    const { compositeScore } = derived;

    // Risk Model logic from article-1.html
    const baseOutageRate = 2.5;
    const maturityFactor = Math.max(0.05, 1 - (compositeScore / 120));
    const estOutages = baseOutageRate * maturityFactor;
    const avgOutageCost = 200000;
    const annualExposure = estOutages * avgOutageCost;

    const improvedFactor = Math.max(0.05, 1 - ((compositeScore + 10) / 120));
    const improvedExposure = baseOutageRate * improvedFactor * avgOutageCost;
    const preventionValue = annualExposure - improvedExposure;

    const riskColor = compositeScore >= 80 ? 'text-emerald-500' : compositeScore >= 60 ? 'text-amber-500' : 'text-red-500';

    return (
        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50 mt-6">
            <h3 className="text-slate-200 font-bold mb-4 flex items-center gap-2">
                <Activity size={18} className="text-slate-400" />
                Risk & Financial Impact Model
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-center">
                    <div className={`text-xl font-mono font-bold ${riskColor}`}>
                        {compositeScore >= 80 ? 'LOW' : compositeScore >= 60 ? 'MOD' : 'HIGH'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Risk Level</div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-center">
                    <div className="text-xl font-mono font-bold text-red-400">
                        ${(annualExposure / 1000).toFixed(0)}k
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Annual Exposure</div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-center">
                    <div className="text-xl font-mono font-bold text-amber-400">
                        {estOutages.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Est. Incidents/Yr</div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-center">
                    <div className="text-xl font-mono font-bold text-emerald-400">
                        +${(preventionValue / 1000).toFixed(0)}k
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Value of +10pts</div>
                </div>
            </div>

            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-xs text-amber-200/80">
                <TriangleAlert size={16} className="shrink-0 mt-0.5" />
                <p>
                    <strong>Model Assumption:</strong> Based on Uptime Institute 2024 data correlating operational maturity with outage frequency. Lower maturity scores exponentially increase the probability of human error-induced downtime.
                </p>
            </div>
        </div>
    );
};
