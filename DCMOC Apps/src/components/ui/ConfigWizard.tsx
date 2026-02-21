
'use client';

import React, { useState } from 'react';
import { Globe, Server, Wrench, ArrowRight, Check, Zap, Fan } from 'lucide-react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex'; // Import Capex Store
import clsx from 'clsx';

type WizardStep = 'region' | 'topology' | 'systems' | 'strategy' | 'complete';

export function ConfigWizard({ onComplete }: { onComplete: () => void }) {
    const { actions, inputs } = useSimulationStore();
    const { setInputs: setCapexInputs, runCalculation: runCapex } = useCapexStore(); // Config Capex
    const [step, setStep] = useState<WizardStep>('region');

    const handleRegionSelect = (region: 'APAC' | 'EMEA' | 'AMER') => {
        // Auto-select first country in region for now
        let countryId = 'ID';
        if (region === 'APAC') countryId = 'ID'; // Default Indonesia
        if (region === 'AMER') countryId = 'US';
        if (region === 'EMEA') countryId = 'US'; // Fallback for now

        actions.selectCountry(countryId);
        setCapexInputs({ location: region === 'AMER' ? 'usa' : region === 'APAC' ? 'sea' : 'europe' }); // Sync Location
        setStep('topology');
    };

    const handleTopologySelect = (tier: 2 | 3 | 4) => {
        actions.setTierLevel(tier);
        setCapexInputs({ redundancy: tier === 4 ? '2n' : tier === 3 ? 'n1' : 'n' }); // Sync Redundancy
        setStep('systems');
    };

    const handleSystemsSelect = (cooling: 'in-row' | 'perimeter' | 'dlc', power: 'N+1' | '2N' | '2N+1') => {
        actions.setInputs({
            coolingTopology: cooling,
            powerRedundancy: power
        });
        setCapexInputs({ coolingType: cooling === 'perimeter' ? 'air' : cooling === 'in-row' ? 'inrow' : 'liquid' }); // Sync Cooling
        setStep('strategy');
    };

    const handleStrategySelect = (strategy: 'reactive' | 'planned' | 'predictive') => {
        actions.setInputs({ maintenanceStrategy: strategy });
        runCapex(); // Final Calc
        onComplete();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full flex overflow-hidden min-h-[500px]">

                {/* Sidebar Progress */}
                <div className="w-1/3 bg-slate-950 p-6 border-r border-slate-800 hidden md:block">
                    <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-cyan-600 flex items-center justify-center">
                            <Wrench className="w-4 h-4 text-white" />
                        </div>
                        Setup
                    </h2>
                    <div className="space-y-6">
                        <StepItem
                            active={step === 'region'}
                            completed={step !== 'region'}
                            label="Region & Location"
                            icon={Globe}
                        />
                        <StepItem
                            active={step === 'topology'}
                            completed={step === 'systems' || step === 'strategy' || step === 'complete'}
                            label="Reliability Tier"
                            icon={Server}
                        />
                        <StepItem
                            active={step === 'systems'}
                            completed={step === 'strategy' || step === 'complete'}
                            label="Technical Systems"
                            icon={Zap}
                        />
                        <StepItem
                            active={step === 'strategy'}
                            completed={step === 'complete'}
                            label="Maint. Strategy"
                            icon={Wrench}
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto">
                    {step === 'region' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-bold text-white mb-2">Select Region</h3>
                            <p className="text-slate-400 mb-6">Where is this facility located? This determines labor laws, climate data, and cost baselines.</p>

                            <div className="grid grid-cols-1 gap-3">
                                {['APAC', 'AMER', 'EMEA'].map((region) => (
                                    <button
                                        key={region}
                                        onClick={() => handleRegionSelect(region as any)}
                                        className="flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-cyan-500 transition-all group text-left"
                                    >
                                        <div>
                                            <div className="font-bold text-white">{region}</div>
                                            <div className="text-xs text-slate-500">
                                                {region === 'APAC' ? 'Asia Pacific (Indonesia, Singapore...)' :
                                                    region === 'AMER' ? 'Americas (USA, Brazil...)' : 'Europe, Middle East, Africa'}
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'topology' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-bold text-white mb-2">Reliability Tier</h3>
                            <p className="text-slate-400 mb-6">Define the criticality level. This sets the baseline for redundancy and risk.</p>

                            <div className="grid grid-cols-1 gap-3">
                                <TopologyOption
                                    tier={2}
                                    label="Tier II / Rated-2"
                                    desc="Redundant Components (N+1). Single Path. ~99.7% Availability."
                                    onClick={() => handleTopologySelect(2)}
                                />
                                <TopologyOption
                                    tier={3}
                                    label="Tier III / Rated-3"
                                    desc="Concurrent Maintainability. Dual Path. ~99.98% Availability."
                                    onClick={() => handleTopologySelect(3)}
                                />
                                <TopologyOption
                                    tier={4}
                                    label="Tier IV / Rated-4"
                                    desc="Fault Tolerant. 2N+1. ~99.99% Availability."
                                    onClick={() => handleTopologySelect(4)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 'systems' && (
                        <SystemsStep onSelect={handleSystemsSelect} tier={inputs.tierLevel} />
                    )}

                    {step === 'strategy' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-bold text-white mb-2">Maintenance Strategy</h3>
                            <p className="text-slate-400 mb-6">How aggressively do you maintain the facility?</p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleStrategySelect('reactive')}
                                    className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-red-500 transition-all text-left"
                                >
                                    <div className="font-bold text-white">Statutory / Reactive</div>
                                    <div className="text-xs text-slate-500">Min. compliance only. Lowest Cost. Higher Risk.</div>
                                </button>
                                <button
                                    onClick={() => handleStrategySelect('planned')}
                                    className="w-full p-4 rounded-xl border border-cyan-500 bg-cyan-950/20 transition-all text-left ring-1 ring-cyan-500"
                                >
                                    <div className="font-bold text-white">Standard / Planned</div>
                                    <div className="text-xs text-cyan-200">Industry Best Practice (SFG20). Balanced Risk/Cost.</div>
                                </button>
                                <button
                                    onClick={() => handleStrategySelect('predictive')}
                                    className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-purple-500 transition-all text-left"
                                >
                                    <div className="font-bold text-white">Ultimate / Predictive</div>
                                    <div className="text-xs text-slate-500">Vendor Premium Support. Zero Downtime Goal. Highest Cost.</div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SystemsStep({ onSelect, tier }: { onSelect: (c: any, p: any) => void, tier: number }) {
    const [cooling, setCooling] = useState<'in-row' | 'perimeter' | 'dlc'>('perimeter');
    const [power, setPower] = useState<'N+1' | '2N' | '2N+1'>(tier === 4 ? '2N+1' : tier === 3 ? '2N' : 'N+1');

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-2xl font-bold text-white mb-2">Technical Systems</h3>
            <p className="text-slate-400 mb-6">Configure specific topology choices.</p>

            <div className="mb-6">
                <label className="text-xs font-semibold text-slate-500 uppercase mb-3 block">Cooling Topology</label>
                <div className="grid grid-cols-3 gap-2">
                    {['perimeter', 'in-row', 'dlc'].map((c) => (
                        <button
                            key={c}
                            onClick={() => setCooling(c as any)}
                            className={clsx(
                                "flex flex-col items-center p-3 rounded-lg border transition-all",
                                cooling === c ? "bg-cyan-950/50 border-cyan-500 text-cyan-200" : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500"
                            )}
                        >
                            <Fan className="w-5 h-5 mb-2" />
                            <span className="text-xs font-bold capitalize">{c === 'dlc' ? 'DLC' : c.replace('-', ' ')}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-8">
                <label className="text-xs font-semibold text-slate-500 uppercase mb-3 block">Power Redundancy</label>
                <div className="grid grid-cols-3 gap-2">
                    {['N+1', '2N', '2N+1'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPower(p as any)}
                            className={clsx(
                                "flex flex-col items-center p-3 rounded-lg border transition-all",
                                power === p ? "bg-cyan-950/50 border-cyan-500 text-cyan-200" : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500"
                            )}
                        >
                            <Zap className="w-5 h-5 mb-2" />
                            <span className="text-xs font-bold">{p}</span>
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={() => onSelect(cooling, power)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-900/50 flex items-center justify-center gap-2"
            >
                Confirm Systems <ArrowRight className="w-5 h-5" />
            </button>
        </div>
    );
}

function StepItem({ active, completed, label, icon: Icon }: any) {
    return (
        <div className={clsx("flex items-center gap-3", active ? "text-cyan-400" : completed ? "text-emerald-500" : "text-slate-500")}>
            <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center border",
                active ? "border-cyan-400 bg-cyan-950/50" : completed ? "border-emerald-500 bg-emerald-950/50" : "border-slate-700 bg-slate-900"
            )}>
                {completed ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </div>
    );
}

function TopologyOption({ tier, label, desc, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-cyan-500 transition-all group text-left"
        >
            <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">{label}</div>
            <div className="text-xs text-slate-500">{desc}</div>
        </button>
    );
}
