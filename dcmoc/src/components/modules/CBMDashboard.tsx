'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateCBM, CBMResult, SensorCategory, DCIMTier } from '@/modules/analytics/CBMEngine';
import { Activity, DollarSign, TrendingUp, Shield, Zap, BarChart3, ToggleLeft, ToggleRight, Clock } from 'lucide-react';
import clsx from 'clsx';
import { fmt, fmtMoney } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';

const SENSOR_COLORS: Record<SensorCategory, string> = {
    'temperature': 'bg-red-500',
    'humidity': 'bg-blue-500',
    'power-quality': 'bg-amber-500',
    'vibration': 'bg-orange-500',
    'fluid-leak': 'bg-cyan-500',
    'airflow': 'bg-green-500',
    'door-access': 'bg-purple-500',
};

const SENSOR_TOOLTIPS: Record<SensorCategory, string> = {
    'temperature': 'Monitors inlet/outlet air and equipment surface temperatures. Detects hot spots, cooling failures, and airflow short-circuits before thermal thresholds are breached.',
    'humidity': 'Tracks relative humidity levels across the data hall. Prevents condensation (too high) and electrostatic discharge (too low) — both leading causes of IT equipment failure.',
    'power-quality': 'Monitoring voltage, current, harmonics, and power factor. Detects issues that degrade UPS, PDU, and IT equipment lifespan.',
    'vibration': 'Continuous vibration monitoring on rotating equipment (generators, CRAC fans, pumps). Detects bearing wear, misalignment, and imbalance before catastrophic failure.',
    'fluid-leak': 'Detects water and refrigerant leaks under raised floors, around CRAH/CRAC units, and near chilled water piping. Early detection prevents floor flooding and equipment damage.',
    'airflow': 'Measures air velocity and differential pressure across equipment and containment. Identifies blanking panel gaps, containment breaches, and undersized cooling capacity.',
    'door-access': 'Monitors cabinet door open/close status and physical access events. Detects unauthorized access, doors left open (breaking containment), and correlates with thermal events.',
};

export default function CBMDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [enabledCategories, setEnabledCategories] = useState<SensorCategory[]>(
        ['temperature', 'humidity', 'power-quality', 'vibration', 'fluid-leak', 'airflow', 'door-access']
    );
    const [dcimTier, setDcimTier] = useState<DCIMTier>('standard');

    const result = useMemo<CBMResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateCBM({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            coolingTopology: inputs.coolingTopology,
            powerRedundancy: inputs.powerRedundancy,
            enabledCategories,
            dcimTier,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, inputs.coolingTopology, inputs.powerRedundancy, enabledCategories, dcimTier]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;


    const toggleCategory = (cat: SensorCategory) => {
        setEnabledCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-xl">
                        <Activity className="w-6 h-6 text-purple-500" />
                    </div>
                    Condition-Based Monitoring ROI
                </h2>
                <p className="text-sm text-slate-500 mt-1">Module 43 — BMS/DCIM sensor investment vs failure avoidance savings</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                    { label: 'Sensor Investment', value: fmtMoney(result.totalSensorInvestment), sub: `${result.totalSensorCount} sensors`, icon: DollarSign, color: 'cyan', tip: 'Total one-time capital expenditure for all enabled sensor hardware. Does not include installation labor or DCIM platform licensing.' },
                    { label: 'ROI', value: `${result.roiPercent}%`, sub: `Payback: ${result.paybackYears} yrs`, icon: TrendingUp, color: result.roiPercent > 100 ? 'emerald' : result.roiPercent > 50 ? 'amber' : 'red', tip: 'Return on Investment — annual net benefit divided by sensor investment. Above 100% means the system pays for itself within one year.' },
                    { label: 'Annual Benefit', value: fmtMoney(result.totalAnnualBenefit), sub: 'Downtime + Energy savings', icon: Shield, color: 'green', tip: 'Combined yearly value of avoided downtime costs and energy optimization savings from condition-based monitoring.' },
                    { label: 'Downtime Averted', value: fmtMoney(result.annualAvertedDowntimeCost), sub: 'Annual failure avoidance', icon: Zap, color: 'amber', tip: 'Annual cost avoidance from catching failures early vs reactive repair. Includes avoided downtime penalties and SLA credits.' },
                    { label: 'Energy Savings', value: fmtMoney(result.annualEnergySavings), sub: 'Annual energy optimization', icon: BarChart3, color: 'blue', tip: 'Yearly energy cost reduction from sensor-driven optimization — e.g., adjusting cooling setpoints, detecting airflow short-circuits, and load balancing.' },
                    { label: '5-Year NPV', value: fmtMoney(result.npv5Year), sub: `${result.sensorDensityPerRack} sensors/rack`, icon: Clock, color: result.npv5Year > 0 ? 'emerald' : 'red', tip: 'Net Present Value over 5 years — total discounted benefits minus sensor investment. Positive NPV confirms the project is financially viable at standard discount rates.' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                            <span className="text-xs text-slate-500 flex items-center gap-1">{kpi.label}<Tooltip content={kpi.tip} /></span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Sensor Category Toggles */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-1">Sensor Categories<Tooltip content="Toggle individual sensor types on/off to model different CBM deployment scopes. Each category targets specific failure modes and contributes to overall detection coverage." /></h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80">
                                <th className="text-left px-3 py-2 text-slate-500 font-medium"><span className="flex items-center gap-1">Category<Tooltip content="Sensor type grouped by physical measurement domain. Each category monitors a different failure mode vector." /></span></th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-1">Enable<Tooltip content="Toggle this sensor category on/off. Disabled categories are excluded from investment totals and benefit calculations." /></span></th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-1">Count<Tooltip content="Number of sensor points deployed, auto-calculated from facility size, rack count, and equipment inventory." /></span></th>
                                <th className="text-right px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-1">Unit $<Tooltip content="Cost per individual sensor point including the probe, transmitter, and commissioning. Excludes cabling and integration labor." /></span></th>
                                <th className="text-right px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-1">Total $<Tooltip content="Total hardware cost for this sensor category (unit cost multiplied by sensor count)." /></span></th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-1">Detection<Tooltip content="Failure detection rate — the percentage of equipment failures this sensor category can identify before they cause unplanned downtime." /></span></th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-1">Energy %<Tooltip content="Energy savings contribution — the percentage of total facility energy this sensor category can help optimize through better control and early anomaly detection." /></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.sensors.map(sensor => (
                                <tr key={sensor.category} className={clsx(
                                    "border-t border-slate-100 dark:border-slate-800 transition-opacity",
                                    !sensor.enabled && "opacity-40"
                                )}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${SENSOR_COLORS[sensor.category]}`} />
                                            <span className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1">{sensor.label}<Tooltip content={SENSOR_TOOLTIPS[sensor.category]} /></span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 ml-4">{sensor.countFormula}</p>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button onClick={() => toggleCategory(sensor.category)} className="text-slate-500 hover:text-cyan-500">
                                            {sensor.enabled ? <ToggleRight className="w-5 h-5 text-cyan-500" /> : <ToggleLeft className="w-5 h-5" />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">{sensor.count}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">${sensor.unitCost}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoney(sensor.totalCost)}</td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={clsx(
                                            "text-xs px-1.5 py-0.5 rounded font-medium",
                                            sensor.failureDetectionRate >= 0.4 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                            sensor.failureDetectionRate >= 0.2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                            "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                        )}>{(sensor.failureDetectionRate * 100).toFixed(0)}%</span>
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                                        {sensor.energySavingsPercent > 0 ? `${(sensor.energySavingsPercent * 100).toFixed(0)}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                <td className="px-3 py-2 text-slate-900 dark:text-white">Total (Enabled)</td>
                                <td></td>
                                <td className="px-3 py-2 text-center text-slate-900 dark:text-white">{result.totalSensorCount}</td>
                                <td></td>
                                <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{fmtMoney(result.totalSensorInvestment)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Cost vs Benefit */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-1">Investment vs Annual Benefit<Tooltip content="Side-by-side comparison of one-time sensor deployment cost against recurring annual savings from failure prevention and energy optimization." /></h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-xs text-slate-500 mb-2 flex items-center gap-1">Investment (One-Time)<Tooltip content="Capital expenditure for sensor hardware. This is a one-time cost that does not recur annually." /></h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Sensor Hardware<Tooltip content="Sum of all enabled sensor unit costs. Includes temperature probes, humidity sensors, vibration accelerometers, leak detection cables, and other monitoring devices." /></span>
                                <span className="font-mono font-medium text-slate-900 dark:text-white">{fmtMoney(result.totalSensorInvestment)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Total Investment<Tooltip content="Complete one-time capital outlay for the CBM sensor deployment. Does not include recurring DCIM licensing." /></span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtMoney(result.totalSensorInvestment)}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs text-slate-500 mb-2 flex items-center gap-1">Annual Benefits<Tooltip content="Recurring yearly savings from condition-based monitoring. Net of DCIM platform licensing costs." /></h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Downtime Averted<Tooltip content="Estimated annual savings from detecting failures before they cause unplanned outages. Based on sensor detection rates and regional downtime cost per hour." /></span>
                                <span className="font-mono font-medium text-green-600 dark:text-green-400">+{fmtMoney(result.annualAvertedDowntimeCost)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Energy Savings<Tooltip content="Annual energy cost reduction from sensor-driven optimization — e.g., dynamic cooling setpoint adjustment, containment breach detection, and load balancing." /></span>
                                <span className="font-mono font-medium text-green-600 dark:text-green-400">+{fmtMoney(result.annualEnergySavings)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Platform License<Tooltip content="Annual DCIM/BMS software license cost for the selected platform tier. Required to collect, analyze, and act on sensor data." /></span>
                                <span className="font-mono font-medium text-red-600 dark:text-red-400">-{fmtMoney(result.platformLicenseCostAnnual)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Net Annual Benefit<Tooltip content="Total annual benefit (downtime averted + energy savings) minus DCIM platform licensing. This is the recurring yearly value of the CBM program." /></span>
                                <span className="font-mono font-bold text-green-600 dark:text-green-400">+{fmtMoney(result.totalAnnualBenefit - result.platformLicenseCostAnnual)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DCIM Platform Tier Comparison */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-1">DCIM Platform Tier<Tooltip content="Select the DCIM/BMS platform tier to model. Higher tiers offer better sensor integration, predictive analytics, and automation — but at higher annual license costs." /></h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {result.dcimPlatforms.map(platform => (
                        <button
                            key={platform.tier}
                            onClick={() => setDcimTier(platform.tier)}
                            className={clsx(
                                "p-4 rounded-xl border text-left transition-all",
                                dcimTier === platform.tier
                                    ? "border-cyan-400 dark:border-cyan-600 ring-2 ring-cyan-400/20 bg-cyan-50/50 dark:bg-cyan-900/10"
                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{platform.label}</span>
                                {dcimTier === platform.tier && <div className="w-2 h-2 rounded-full bg-cyan-500" />}
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">{fmtMoney(platform.annualLicenseCost)}<span className="text-xs text-slate-500 font-normal">/yr</span></div>
                            <div className="space-y-1">
                                {platform.features.map((f, i) => (
                                    <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-slate-400" />
                                        {f}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">Sensor Integration: {(platform.sensorIntegration * 100).toFixed(0)}%<Tooltip content="Percentage of deployed sensors this platform can fully integrate. Lower tiers may not support all sensor protocols, reducing effective detection coverage." /></span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
