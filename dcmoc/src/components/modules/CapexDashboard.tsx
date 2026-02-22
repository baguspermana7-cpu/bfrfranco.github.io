
import React, { useEffect, useState } from 'react';
import { useCapexStore } from '@/store/capex';
import { useSimulationStore } from '@/store/simulation';
import { COUNTRIES } from '@/constants/countries';
import {
    Calculator, Building, Zap, Server, BarChart3,
    Settings, Calendar, MapPin, DollarSign, Activity, TrendingUp,
    Flame, Fuel, Leaf, Shield, Cable, Layers, HardDrive, Lock, Globe2
} from 'lucide-react';
import GanttChart from '@/components/visualizations/GanttChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import { fmtMoney, fmt } from '@/lib/format';

// Group countries by region for hierarchy
const REGIONS = Object.values(COUNTRIES).reduce((acc, c) => {
    if (!acc[c.region]) acc[c.region] = [];
    acc[c.region].push(c);
    return acc;
}, {} as Record<string, typeof COUNTRIES[keyof typeof COUNTRIES][]>);

const REGION_LABELS: Record<string, string> = {
    'APAC': '🌏 Asia Pacific',
    'EMEA': '🌍 Europe, Middle East & Africa',
    'AMER': '🌎 Americas',
};

const CapexDashboard = () => {
    const { inputs, results, setInputs, runCalculation, narrative } = useCapexStore();
    const { selectedCountry, actions, inputs: simInputs } = useSimulationStore();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Sync country from simulation store
    useEffect(() => {
        if (selectedCountry) {
            setInputs({
                location: selectedCountry.id,
                country: selectedCountry
            });
        }
        setTimeout(runCalculation, 50);
    }, [selectedCountry]);

    // Sync CAPEX config changes → simulation store for consistency across modules
    useEffect(() => {
        const redundancyMap: Record<string, 'N+1' | '2N' | '2N+1'> = {
            'n': 'N+1', 'n1': 'N+1', '2n': '2N', '2n1': '2N+1'
        };
        const coolingTypeMap: Record<string, 'air' | 'inrow' | 'rdhx' | 'liquid'> = {
            'air': 'air', 'inrow': 'inrow', 'rdhx': 'rdhx', 'liquid': 'liquid'
        };
        const updates: Partial<typeof simInputs> = {};
        if (inputs.itLoad !== simInputs.itLoad) updates.itLoad = inputs.itLoad;
        const mappedRedundancy = redundancyMap[inputs.redundancy] ?? '2N';
        if (mappedRedundancy !== simInputs.powerRedundancy) updates.powerRedundancy = mappedRedundancy;
        const mappedCooling = coolingTypeMap[inputs.coolingType] ?? 'air';
        if (mappedCooling !== simInputs.coolingType) updates.coolingType = mappedCooling;
        if (Object.keys(updates).length > 0) {
            actions.setInputs(updates);
        }
    }, [inputs.itLoad, inputs.redundancy, inputs.coolingType]);

    const handleChange = (field: string, value: any) => {
        setInputs({ [field]: value });
    };

    if (!results) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Initializing CAPEX Engine...</div>;

    const { total, metrics, timeline, costs } = results;
    return (
        <div className="flex h-full gap-6 p-6 bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* LEFT PANEL: Inputs */}
            <div className="w-[420px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-20">
                {/* Header with PDF Export */}
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Settings className="w-5 h-5 text-indigo-600" />
                            Project Parameters
                        </CardTitle>
                        <ExportPDFButton
                            isGenerating={isExporting}
                            onExport={async () => {
                                if (!results || !selectedCountry) return;
                                setIsExporting(true);
                                try {
                                    const { generateCapexPDF } = await import('@/modules/reporting/PdfGenerator');
                                    await generateCapexPDF(selectedCountry, results, narrative, inputs);
                                } finally {
                                    setIsExporting(false);
                                }
                            }}
                            className="px-2 py-1 text-xs"
                            label="PDF"
                        />
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* ─── REGION & COUNTRY ─── */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                <Globe2 className="w-3 h-3" /> Region & Country
                                <Tooltip content="Syncs with Global Simulation Settings. Construction costs vary by region." />
                            </label>
                            <select
                                className="w-full p-2 border rounded-md text-sm text-slate-900 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                value={selectedCountry?.id || 'ID'}
                                onChange={(e) => actions.selectCountry(e.target.value)}
                            >
                                {Object.entries(REGIONS).sort().map(([region, countries]) => (
                                    <optgroup key={region} label={REGION_LABELS[region] || region}>
                                        {countries.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.id})
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                                Construction Index: <span className="font-mono text-slate-600 dark:text-slate-400">{selectedCountry?.constructionIndex?.toFixed(2) || '1.0'}x</span> (vs US Baseline)
                            </div>
                        </div>

                        {/* ─── IT CAPACITY ─── */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Zap className="w-3 h-3 mr-1" /> IT Capacity <Tooltip content="Total critical IT load in kW. Drives cooling, power, and rack sizing." />
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-md text-sm text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                    value={inputs.itLoad}
                                    onChange={(e) => handleChange('itLoad', Number(e.target.value))}
                                />
                                <span className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400">kW</span>
                            </div>
                        </div>

                        {/* ─── REDUNDANCY ─── */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                Redundancy Tier <Tooltip content="Uptime Institute Standard. N+1 = Tier III (Concurrently Maintainable), 2N = Tier IV (Fault Tolerant)." />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {['n', 'n1', '2n', '2n1'].map((tier) => (
                                    <button
                                        key={tier}
                                        onClick={() => handleChange('redundancy', tier)}
                                        className={`p-2 text-xs font-medium rounded-md border transition-all ${inputs.redundancy === tier
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-500'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        {tier === 'n' ? 'N (Basic)' : tier === 'n1' ? 'N+1 (Tier III)' : tier === '2n' ? '2N (Tier IV)' : '2N+1'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ─── COOLING ─── */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Activity className="w-3 h-3 mr-1" /> Cooling Strategy <Tooltip content="Determines cooling methodology and PUE target. Air-cooled is simplest. Direct Liquid Cooling achieves lowest PUE (~1.2)." />
                            </label>
                            <select className="w-full p-2 border rounded-md text-sm text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.coolingType}
                                onChange={(e) => handleChange('coolingType', e.target.value)}>
                                <option value="air">Air Cooled (CRAC/CRAH)</option>
                                <option value="inrow">In-Row Precision</option>
                                <option value="rdhx">Rear Door Heat Exchanger</option>
                                <option value="liquid">Direct Liquid Cooling</option>
                            </select>
                        </div>

                        {/* ─── BUILDING ─── */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Building className="w-3 h-3 mr-1" /> Building Type <Tooltip content="Construction type affects cost/m². Purpose-built is standard. Modular/prefab can reduce timeline by 40%." />
                            </label>
                            <select className="w-full p-2 border rounded-md text-sm text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.buildingType}
                                onChange={(e) => handleChange('buildingType', e.target.value)}>
                                <option value="purpose">Purpose Built (Standard)</option>
                                <option value="warehouse">Warehouse Conversion</option>
                                <option value="modular">Modular / Prefab</option>
                                <option value="highrise">Vertical High-Rise</option>
                            </select>
                        </div>

                        {/* ─── RACK TYPE ─── */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Server className="w-3 h-3 mr-1" /> Rack Density <Tooltip content="Power per rack determines rack count and floor space. Ultra-high density (75kW) requires liquid cooling." />
                            </label>
                            <select className="w-full p-2 border rounded-md text-sm text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.rackType}
                                onChange={(e) => handleChange('rackType', e.target.value)}>
                                <option value="standard">Standard (≤6kW/rack)</option>
                                <option value="medium">Medium (12.5kW/rack)</option>
                                <option value="high">High Density (25kW/rack)</option>
                                <option value="ultra">Ultra (75kW/rack)</option>
                            </select>
                        </div>

                        {/* ─── POWER BACKUP ─── */}
                        <div className="pt-3 border-t dark:border-slate-700 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Zap className="w-3 h-3 mr-1" /> Power Backup <Tooltip content="UPS provides instant battery backup. Generator provides extended runtime. Both are critical for Tier III+ facilities." />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">UPS System</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.upsType}
                                        onChange={(e) => handleChange('upsType', e.target.value)}>
                                        <option value="standalone">Standalone UPS</option>
                                        <option value="modular">Modular UPS</option>
                                        <option value="distributed">Distributed</option>
                                        <option value="rotary">Rotary/DRUPS</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Generator</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.genType}
                                        onChange={(e) => handleChange('genType', e.target.value)}>
                                        <option value="diesel">Diesel Gen</option>
                                        <option value="gas">Gas Engine</option>
                                        <option value="hvo">HVO/Renewable</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Fuel Storage: {inputs.fuelHours}h</div>
                                <input type="range" min={12} max={168} step={12} value={inputs.fuelHours}
                                    onChange={(e) => handleChange('fuelHours', Number(e.target.value))}
                                    className="w-full accent-indigo-500" />
                                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                                    <span>12h</span><span>72h</span><span>168h (7d)</span>
                                </div>
                            </div>
                        </div>

                        {/* ─── FIRE PROTECTION ─── */}
                        <div className="pt-3 border-t dark:border-slate-700 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Flame className="w-3 h-3 mr-1" /> Fire Protection <Tooltip content="Novec 1230 and FM-200 are clean-agent systems safe for electronics. Inert gas is greener but requires larger storage." />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Suppression</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.fireType}
                                        onChange={(e) => handleChange('fireType', e.target.value)}>
                                        <option value="novec">Novec 1230</option>
                                        <option value="fm200">FM-200</option>
                                        <option value="inert">Inert Gas (IG-541)</option>
                                        <option value="sprinkler">Wet Pipe Sprinkler</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Fire Alarm</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.alarmType}
                                        onChange={(e) => handleChange('alarmType', e.target.value)}>
                                        <option value="addressable">Addressable</option>
                                        <option value="vesda">VESDA (Aspirating)</option>
                                        <option value="beam">Beam Detection</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ─── SUSTAINABILITY ─── */}
                        <div className="pt-3 border-t dark:border-slate-700 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Leaf className="w-3 h-3 mr-1" /> Sustainability <Tooltip content="Green certifications add 2-8% to build cost but reduce operating costs and improve ESG scores for investors." />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Green Certification</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.greenCert}
                                        onChange={(e) => handleChange('greenCert', e.target.value)}>
                                        <option value="none">None</option>
                                        <option value="silver">LEED Silver (+2%)</option>
                                        <option value="gold">LEED Gold (+4%)</option>
                                        <option value="platinum">LEED Platinum (+8%)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Renewable Energy</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.renewableOption}
                                        onChange={(e) => handleChange('renewableOption', e.target.value)}>
                                        <option value="none">None</option>
                                        <option value="solar">Solar PV</option>
                                        <option value="solar_bess">Solar + BESS</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ─── SUBSTATION & GRID ─── */}
                        <div className="pt-3 border-t dark:border-slate-700 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Zap className="w-3 h-3 mr-1" /> Substation & Grid
                            </label>
                            <div className="flex items-center gap-2 mb-2">
                                <input type="checkbox" checked={inputs.includeFOM} onChange={() => handleChange('includeFOM', !inputs.includeFOM)} className="accent-indigo-500" />
                                <span className="text-xs text-slate-600 dark:text-slate-400">Include Front-of-Meter Infrastructure</span>
                            </div>
                            {inputs.includeFOM && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Substation</div>
                                        <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.substationType}
                                            onChange={(e) => handleChange('substationType', e.target.value)}>
                                            <option value="pad_mounted_11kv">Pad Mount 11kV</option>
                                            <option value="dedicated_33kv">Dedicated 33kV</option>
                                            <option value="dedicated_66kv">Dedicated 66kV</option>
                                            <option value="dedicated_132kv">Dedicated 132kV</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Utility Rate</div>
                                        <div className="flex items-center gap-1">
                                            <input type="number" className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.utilityRate}
                                                onChange={(e) => handleChange('utilityRate', Number(e.target.value))} />
                                            <span className="text-xs text-slate-400 dark:text-slate-500">%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ─── SOFT COSTS ─── */}
                        <div className="pt-3 border-t dark:border-slate-700 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Calculator className="w-3 h-3 mr-1" /> Soft Costs & Contingency <Tooltip content="Design fee covers A&E firms. PM fee covers construction oversight. Contingency is a buffer for unforeseen costs (industry standard 10-15%)." />
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Design Fee</div>
                                    <div className="flex items-center gap-1">
                                        <input type="number" className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.designFee}
                                            onChange={(e) => handleChange('designFee', Number(e.target.value))} min={0} max={20} />
                                        <span className="text-xs text-slate-400 dark:text-slate-500">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">PM Fee</div>
                                    <div className="flex items-center gap-1">
                                        <input type="number" className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.pmFee}
                                            onChange={(e) => handleChange('pmFee', Number(e.target.value))} min={0} max={15} />
                                        <span className="text-xs text-slate-400 dark:text-slate-500">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Contingency</div>
                                    <div className="flex items-center gap-1">
                                        <input type="number" className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.contingency}
                                            onChange={(e) => handleChange('contingency', Number(e.target.value))} min={0} max={30} />
                                        <span className="text-xs text-slate-400 dark:text-slate-500">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── PROJECT TIMELINE ─── */}
                        <div className="pt-3 border-t dark:border-slate-700 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                <Calendar className="w-3 h-3 mr-1" /> Project Year & Market
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Project Year</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.projYear}
                                        onChange={(e) => handleChange('projYear', e.target.value)}>
                                        <option value="2024">2024</option>
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                        <option value="2027">2027</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">City Market</div>
                                    <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.cityMarket}
                                        onChange={(e) => handleChange('cityMarket', e.target.value)}>
                                        <option value="none">Generic</option>
                                        <option value="silicon_valley">Silicon Valley</option>
                                        <option value="northern_virginia">Northern Virginia</option>
                                        <option value="tokyo">Tokyo</option>
                                        <option value="singapore">Singapore</option>
                                        <option value="london">London</option>
                                        <option value="frankfurt">Frankfurt</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ─── ADVANCED INFRASTRUCTURE ─── */}
                        <div className="pt-3 border-t dark:border-slate-700">
                            <button onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 p-2 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors flex items-center justify-center gap-1">
                                <Layers className="w-3 h-3" />
                                {showAdvanced ? 'Hide' : 'Show'} Advanced Infrastructure Options
                            </button>
                        </div>

                        {showAdvanced && (
                            <div className="space-y-3 animate-in slide-in-from-top-2">
                                {/* Power Distribution */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Power Distribution</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Distribution</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.powerDistribution || 'busway'}
                                                onChange={(e) => handleChange('powerDistribution', e.target.value)}>
                                                <option value="busway">Busway / Busbar</option>
                                                <option value="cable_tray">Cable Tray</option>
                                                <option value="overhead">Overhead</option>
                                                <option value="underfloor">Underfloor</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">PDU Type</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.pduType || 'monitored'}
                                                onChange={(e) => handleChange('pduType', e.target.value)}>
                                                <option value="basic">Basic</option>
                                                <option value="monitored">Monitored</option>
                                                <option value="switched">Switched</option>
                                                <option value="intelligent">Intelligent/Managed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Cabling & Floor */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Cabling & Floor</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Cabling</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.cablingType || 'cat6a'}
                                                onChange={(e) => handleChange('cablingType', e.target.value)}>
                                                <option value="cat6a">Cat 6A Copper</option>
                                                <option value="cat8">Cat 8</option>
                                                <option value="fiber_om4">Fiber OM4</option>
                                                <option value="fiber_sm">Fiber Single-Mode</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Floor Type</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.floorType || 'raised'}
                                                onChange={(e) => handleChange('floorType', e.target.value)}>
                                                <option value="raised">Raised Floor</option>
                                                <option value="slab">Slab / No Raised Floor</option>
                                                <option value="raised_600">Raised 600mm</option>
                                                <option value="raised_1000">Raised 1000mm</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Security & Connectivity */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Security & Connectivity</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Security Level</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.securityLevel || 'standard'}
                                                onChange={(e) => handleChange('securityLevel', e.target.value)}>
                                                <option value="basic">Basic (CCTV + Access)</option>
                                                <option value="standard">Standard (Biometric)</option>
                                                <option value="enhanced">Enhanced (Mantrap + IR)</option>
                                                <option value="military">Military Grade</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Fiber Entry</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.fiberEntry || 'single'}
                                                onChange={(e) => handleChange('fiberEntry', e.target.value)}>
                                                <option value="single">Single Entrance</option>
                                                <option value="dual">Dual Diverse</option>
                                                <option value="mmr">MMR / Meet-Me Room</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Site & Market */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Site & Market Conditions</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Site Condition</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.siteCondition || 'greenfield'}
                                                onChange={(e) => handleChange('siteCondition', e.target.value)}>
                                                <option value="greenfield">Greenfield</option>
                                                <option value="brownfield">Brownfield</option>
                                                <option value="retrofit">Retrofit / Existing</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Market Condition</div>
                                            <select className="w-full p-2 text-sm text-slate-700 border rounded bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" value={inputs.marketCondition || 'normal'}
                                                onChange={(e) => handleChange('marketCondition', e.target.value)}>
                                                <option value="favorable">Favorable (Low Labor)</option>
                                                <option value="normal">Normal</option>
                                                <option value="tight">Tight (Premium)</option>
                                                <option value="overheated">Overheated (+15%)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT PANEL: Results */}
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-20">
                {/* KPI Cards Row 1 */}
                <div className="grid grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-800 border-indigo-100 dark:border-indigo-800">
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">Total CAPEX <Tooltip content="Total project capital expenditure including building, MEP, IT infrastructure, and contingency." /></div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(total)}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">incl. {inputs.contingency}% contingency</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Cost per kW <Tooltip content="Capital cost normalized per kilowatt of IT capacity. Industry range: $8K-$25K/kW depending on tier and region." /></div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(metrics.perKw)}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                {metrics.perKw < 8000 ? '🟢 Low Cost' : metrics.perKw < 15000 ? '🟡 Standard' : '🔴 Premium'}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">PUE Target <Tooltip content="Projected Power Usage Effectiveness based on cooling type and climate. Drives energy cost projections." /></div>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{results.pue.toFixed(2)}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                {results.pue < 1.3 ? '⚡ Best-in-Class' : results.pue < 1.5 ? '✅ Good' : '⚠️ Standard'}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Timeline <Tooltip content="Estimated project duration from design phase through commissioning and handover." /></div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {timeline.totalMonths} <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">Months</span>
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Design to Commissioning</div>
                        </CardContent>
                    </Card>
                </div>

                {/* KPI Cards Row 2 */}
                <div className="grid grid-cols-4 gap-3">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Total Racks <Tooltip content="Number of server racks based on IT load and rack density selection." /></div>
                            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{metrics.racks}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{inputs.rackType} density</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Floor Space <Tooltip content="White space (data hall) area required based on rack count and spacing standards." /></div>
                            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{fmt(metrics.floorSpace)} m²</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">White space</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Annual Energy <Tooltip content="Projected annual electricity cost based on IT load, PUE, and local electricity rate." /></div>
                            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{fmtMoney(metrics.annualEnergy)}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">@ $0.10/kWh</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Soft Costs <Tooltip content="Design fees, project management, and other professional services as a percentage of hard costs." /></div>
                            <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                                {fmtMoney((results.softCosts.design || 0) + (results.softCosts.pm || 0))}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{inputs.designFee}% D + {inputs.pmFee}% PM</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Narrative */}
                <Card className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-800">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg h-fit">
                                <Activity className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">CAPEX Analysis</h4>
                                <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed markdown-prose">{narrative}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cost Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-x-6">
                            {Object.entries(costs)
                                .sort(([, a], [, b]) => b - a)
                                .map(([key, value]) => {
                                    const pct = (value / total) * 100;
                                    return (
                                        <div key={key} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                                <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <span className="text-sm font-medium text-slate-900 dark:text-white w-20 text-right">
                                                    ${(value / 1000).toFixed(0)}k
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            {/* Soft costs */}
                            {results.softCosts.design && (
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-sm text-slate-600 dark:text-slate-400">Design Fee ({inputs.designFee}%)</span></div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">${(results.softCosts.design / 1000).toFixed(0)}k</span>
                                </div>
                            )}
                            {results.softCosts.pm && (
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-sm text-slate-600 dark:text-slate-400">PM Fee ({inputs.pmFee}%)</span></div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">${(results.softCosts.pm / 1000).toFixed(0)}k</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400" /><span className="text-sm text-slate-600 dark:text-slate-400">Contingency ({inputs.contingency}%)</span></div>
                                <span className="text-sm font-medium text-slate-900 dark:text-white">${(results.contingency / 1000).toFixed(0)}k</span>
                            </div>
                            {results.fomTotal > 0 && (
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-400" /><span className="text-sm text-slate-600 dark:text-slate-400">Front-of-Meter</span></div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">${(results.fomTotal / 1000).toFixed(0)}k</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* L2 Gantt Chart - Project Timeline */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Project Timeline — L2 Schedule
                            <Tooltip content="Interactive Gantt chart showing L1 phase groups and L2 sub-activities. Click phase headers to expand/collapse. Bars are positioned by actual start month with overlapping activities shown accurately." />
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                            Click phase headers to expand/collapse L2 sub-phases. Hover bars for duration details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <GanttChart
                            phases={timeline.phases}
                            subPhases={timeline.subPhases || []}
                            totalMonths={timeline.totalMonths}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CapexDashboard;
