'use client';

import React, { useMemo, useState } from 'react';
import { usePortfolioStore, SiteConfig } from '@/store/portfolio';
import { COUNTRIES } from '@/constants/countries';
import { calculatePortfolio, SiteResult } from '@/modules/analytics/PortfolioEngine';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Layers, Plus, Copy, Trash2, Download, MapPin, Award } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import clsx from 'clsx';
import { fmtMoney } from '@/lib/format';

const SITE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

type PortfolioTab = 'overview' | 'financial' | 'staffing' | 'risk' | 'carbon';

export default function PortfolioDashboard() {
    const store = usePortfolioStore();
    const [activeTab, setActiveTab] = useState<PortfolioTab>('overview');

    const result = useMemo(() => {
        if (store.sites.length < 2) return null;
        try {
            return calculatePortfolio(store.sites);
        } catch {
            return null;
        }
    }, [store.sites]);

    const countryOptions = Object.values(COUNTRIES).map(c => ({ id: c.id, name: c.name }));

    const tabs: { id: PortfolioTab; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'financial', label: 'Financial' },
        { id: 'staffing', label: 'Staffing' },
        { id: 'risk', label: 'Risk' },
        { id: 'carbon', label: 'Carbon' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                            <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        Multi-Site Portfolio
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Compare 2-5 data center locations side-by-side
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={store.importFromCurrentConfig}
                        disabled={store.sites.length >= 5}
                        className="px-3 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-400 text-white rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Import Current
                    </button>
                    <button
                        onClick={store.addSite}
                        disabled={store.sites.length >= 5}
                        className="px-3 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Site
                    </button>
                </div>
            </div>

            {/* Site Configuration Cards */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(store.sites.length || 1, 5)}, 1fr)` }}>
                {store.sites.map((site, i) => (
                    <SiteCard
                        key={site.id}
                        site={site}
                        index={i}
                        countryOptions={countryOptions}
                        onUpdate={(updates) => store.updateSite(site.id, updates)}
                        onDuplicate={() => store.duplicateSite(site.id)}
                        onRemove={() => store.removeSite(site.id)}
                        canRemove={store.sites.length > 0}
                        canDuplicate={store.sites.length < 5}
                        isBest={result ? (result.bestIrr === site.id || result.bestPue === site.id) : false}
                    />
                ))}
            </div>

            {store.sites.length < 2 && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
                    <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Add at least 2 sites to begin portfolio comparison</p>
                    <p className="text-xs mt-1">Use "Import Current" to add your active configuration, or "Add Site" for a blank template</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <>
                    {/* Portfolio Summary */}
                    <div className="grid grid-cols-6 gap-3">
                        <SummaryCard label="Total CAPEX" value={fmtMoney(result.totalCapex)} tooltip="Combined capital expenditure across all data center sites in the portfolio." />
                        <SummaryCard label="Annual OPEX" value={fmtMoney(result.totalAnnualOpex)} tooltip="Total annual operating expenditure across all portfolio sites including power, staffing, and maintenance." />
                        <SummaryCard label="Total Staff" value={String(result.totalStaff)} tooltip="Combined headcount across all data center sites in the portfolio." />
                        <SummaryCard label="Total IT Load" value={`${(result.totalItLoadKw / 1000).toFixed(1)} MW`} tooltip="Sum of IT power capacity across all portfolio sites in megawatts." />
                        <SummaryCard label="Wtd. PUE" value={result.weightedPue.toFixed(2)} tooltip="Power Usage Effectiveness weighted by each site's IT load contribution. Accounts for site size variation." />
                        <SummaryCard label="Portfolio NPV" value={fmtMoney(result.portfolioNpv)} highlight={result.portfolioNpv > 0} tooltip="Net Present Value of the combined portfolio, discounting future cash flows to present value. Positive means value creation." />
                    </div>

                    {/* Tab Nav */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all',
                                    activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && <OverviewTab result={result} />}
                    {activeTab === 'financial' && <FinancialTab result={result} />}
                    {activeTab === 'staffing' && <StaffingTab result={result} />}
                    {activeTab === 'risk' && <RiskTab result={result} />}
                    {activeTab === 'carbon' && <CarbonTab result={result} />}
                </>
            )}
        </div>
    );
}

// ─── SITE CARD ──────────────────────────────────────────────

function SiteCard({ site, index, countryOptions, onUpdate, onDuplicate, onRemove, canRemove, canDuplicate, isBest }: {
    site: SiteConfig;
    index: number;
    countryOptions: { id: string; name: string }[];
    onUpdate: (updates: Partial<SiteConfig>) => void;
    onDuplicate: () => void;
    onRemove: () => void;
    canRemove: boolean;
    canDuplicate: boolean;
    isBest: boolean;
}) {
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border-2 p-3 space-y-2" style={{ borderColor: SITE_COLORS[index] }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SITE_COLORS[index] }} />
                    <input
                        className="text-sm font-bold bg-transparent text-slate-900 dark:text-white border-none outline-none w-full"
                        value={site.label}
                        onChange={e => onUpdate({ label: e.target.value })}
                    />
                    {isBest && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </div>
                <div className="flex gap-1">
                    {canDuplicate && (
                        <button onClick={onDuplicate} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Duplicate">
                            <Copy className="w-3 h-3" />
                        </button>
                    )}
                    {canRemove && (
                        <button onClick={onRemove} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500 transition-colors" title="Remove">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-1.5 text-[10px]">
                <SelectField label="Country" value={site.countryId} options={countryOptions.map(c => ({ value: c.id, label: c.name }))} onChange={v => onUpdate({ countryId: v })} tooltip="Geographic location affects energy costs, labor rates, carbon grid intensity, and regulatory environment." />
                <SelectField label="Tier" value={String(site.tierLevel)} options={[{ value: '2', label: 'Tier 2' }, { value: '3', label: 'Tier 3' }, { value: '4', label: 'Tier 4' }]} onChange={v => onUpdate({ tierLevel: Number(v) as 2 | 3 | 4 })} tooltip="Uptime Institute tier classification. Higher tiers provide greater redundancy and availability (Tier 2: 99.749%, Tier 3: 99.982%, Tier 4: 99.995%)." />
                <NumberField label="IT Load (kW)" value={site.itLoad} onChange={v => onUpdate({ itLoad: v })} tooltip="Total IT power capacity for this site in kilowatts. Drives CAPEX, OPEX, staffing, and carbon calculations." />
                <SelectField label="Cooling" value={site.coolingType} options={[{ value: 'air', label: 'Air' }, { value: 'inrow', label: 'In-Row' }, { value: 'rdhx', label: 'RDHX' }, { value: 'liquid', label: 'Liquid' }]} onChange={v => onUpdate({ coolingType: v as SiteConfig['coolingType'] })} tooltip="Cooling infrastructure type. Affects PUE, CAPEX, and energy efficiency. Liquid cooling offers lowest PUE but highest upfront cost." />
                <SelectField label="Shift" value={site.shiftModel} options={[{ value: '8h', label: '8H Continental' }, { value: '12h', label: '12H 4on3off' }]} onChange={v => onUpdate({ shiftModel: v as '8h' | '12h' })} tooltip="Operator shift rotation model. 8H Continental uses 5 crews for 24/7 coverage; 12H 4on3off uses 4 crews with longer shifts." />
                <SelectField label="Staffing" value={site.staffingModel} options={[{ value: 'in-house', label: 'In-House' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'outsourced', label: 'Outsourced' }]} onChange={v => onUpdate({ staffingModel: v as SiteConfig['staffingModel'] })} tooltip="Staffing approach. In-house provides maximum control, outsourced reduces headcount, hybrid balances cost and oversight." />
            </div>
        </div>
    );
}

function SelectField({ label, value, options, onChange, tooltip }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; tooltip?: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">{label}{tooltip && <Tooltip content={tooltip} />}</span>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="px-1.5 py-0.5 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

function NumberField({ label, value, onChange, tooltip }: { label: string; value: number; onChange: (v: number) => void; tooltip?: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">{label}{tooltip && <Tooltip content={tooltip} />}</span>
            <input
                type="number"
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-20 px-1.5 py-0.5 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white text-right"
            />
        </div>
    );
}

function SummaryCard({ label, value, highlight, tooltip }: { label: string; value: string; highlight?: boolean; tooltip?: string }) {
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center justify-center gap-1">{label}{tooltip && <Tooltip content={tooltip} />}</div>
            <div className={clsx('text-lg font-bold mt-0.5', highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>{value}</div>
        </div>
    );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────

function OverviewTab({ result }: { result: ReturnType<typeof calculatePortfolio> }) {
    // Radar data: normalize each metric to 0-100 scale
    const maxCapexPerKw = Math.max(...result.sites.map(s => s.capexPerKw));
    const maxOpexPerKw = Math.max(...result.sites.map(s => s.opexPerKw));
    const maxStaffPerMw = Math.max(...result.sites.map(s => s.staffPerMw));
    const maxPue = Math.max(...result.sites.map(s => s.pue));
    const maxIrr = Math.max(...result.sites.map(s => s.financial.irr));
    const maxCO2 = Math.max(...result.sites.map(s => s.carbon.annualEmissionsTonCO2));

    const radarData = [
        { axis: 'CAPEX Efficiency', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, maxCapexPerKw > 0 ? (1 - s.capexPerKw / maxCapexPerKw) * 100 : 50])) },
        { axis: 'OPEX Efficiency', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, maxOpexPerKw > 0 ? (1 - s.opexPerKw / maxOpexPerKw) * 100 : 50])) },
        { axis: 'Staff Efficiency', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, maxStaffPerMw > 0 ? (1 - s.staffPerMw / maxStaffPerMw) * 100 : 50])) },
        { axis: 'PUE', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, maxPue > 0 ? (1 - s.pue / maxPue) * 100 : 50])) },
        { axis: 'IRR', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, maxIrr > 0 ? (s.financial.irr / maxIrr) * 100 : 50])) },
        { axis: 'Carbon', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, maxCO2 > 0 ? (1 - s.carbon.annualEmissionsTonCO2 / maxCO2) * 100 : 50])) },
    ];

    return (
        <div className="space-y-4">
            {/* Radar Chart */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-1">Site Comparison Radar<Tooltip content="Normalized radar chart comparing all sites across 6 key dimensions. Higher values (outer ring) indicate better performance relative to other sites." /></h3>
                <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={radarData}>
                        <PolarGrid stroke="#475569" opacity={0.3} />
                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <PolarRadiusAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={[0, 100]} />
                        {result.sites.map((_, i) => (
                            <Radar
                                key={i}
                                name={result.sites[i].site.label}
                                dataKey={`s${i}`}
                                stroke={SITE_COLORS[i]}
                                fill={SITE_COLORS[i]}
                                fillOpacity={0.1}
                                strokeWidth={2}
                            />
                        ))}
                        <Legend />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Rankings */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Best CAPEX/kW', siteId: result.bestCapexPerKw, tooltip: 'Site with the lowest capital expenditure per kilowatt of IT capacity, indicating the most cost-efficient build.' },
                    { label: 'Best PUE', siteId: result.bestPue, tooltip: 'Site with the lowest Power Usage Effectiveness, meaning the most energy-efficient facility. Closer to 1.0 is better.' },
                    { label: 'Best IRR', siteId: result.bestIrr, tooltip: 'Site with the highest Internal Rate of Return, indicating the strongest projected investment performance.' },
                    { label: 'Lowest Risk', siteId: result.lowestRisk, tooltip: 'Site with the lowest overall risk score based on tier level, redundancy, maintenance strategy, and geographic factors.' },
                ].map(r => {
                    const site = result.sites.find(s => s.site.id === r.siteId);
                    const idx = result.sites.findIndex(s => s.site.id === r.siteId);
                    return (
                        <div key={r.label} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">{r.label}<Tooltip content={r.tooltip} /></div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SITE_COLORS[idx] || '#94a3b8' }} />
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{site?.site.label || '—'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── FINANCIAL TAB ──────────────────────────────────────────

function FinancialTab({ result }: { result: ReturnType<typeof calculatePortfolio> }) {
    const data = [
        { metric: 'CAPEX ($M)', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, s.capex.total / 1_000_000])) },
        { metric: 'NPV ($M)', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, s.financial.npv / 1_000_000])) },
        { metric: 'Annual OPEX ($M)', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, s.annualOpex / 1_000_000])) },
    ];

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-1">Financial Comparison<Tooltip content="Side-by-side comparison of capital expenditure, net present value, and annual operating costs across all portfolio sites." /></h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${v}M`} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }} />
                        <Legend formatter={(v: string) => result.sites[parseInt(v.replace('s', ''))]?.site.label || v} />
                        {result.sites.map((_, i) => (
                            <Bar key={i} dataKey={`s${i}`} fill={SITE_COLORS[i]} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                            <th className="text-left px-4 py-2 font-medium text-slate-500">Metric</th>
                            {result.sites.map((s, i) => (
                                <th key={i} className="text-center px-3 py-2 font-medium" style={{ color: SITE_COLORS[i] }}>{s.site.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { label: 'CAPEX/kW', get: (s: SiteResult) => `$${Math.round(s.capexPerKw).toLocaleString()}`, tooltip: 'Capital expenditure per kilowatt of IT capacity. Lower values indicate more cost-efficient construction.' },
                            { label: 'OPEX/kW/yr', get: (s: SiteResult) => `$${Math.round(s.opexPerKw).toLocaleString()}`, tooltip: 'Annual operating cost per kilowatt of IT capacity. Includes energy, staffing, and maintenance.' },
                            { label: 'IRR', get: (s: SiteResult) => `${s.financial.irr.toFixed(1)}%`, tooltip: 'Internal Rate of Return — the discount rate at which the project NPV equals zero. Higher is better.' },
                            { label: 'NPV', get: (s: SiteResult) => fmtMoney(s.financial.npv), tooltip: 'Net Present Value — the present value of all future cash flows minus initial investment. Positive means value creation.' },
                            { label: 'Payback', get: (s: SiteResult) => `${s.financial.paybackPeriodYears.toFixed(1)} yr`, tooltip: 'Time in years to recover the initial capital investment from operating cash flows.' },
                            { label: 'ROI', get: (s: SiteResult) => `${s.financial.roiPercent.toFixed(1)}%`, tooltip: 'Return on Investment — total net profit as a percentage of initial capital expenditure over the project lifetime.' },
                        ].map(row => (
                            <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300"><span className="flex items-center gap-1">{row.label}<Tooltip content={row.tooltip} /></span></td>
                                {result.sites.map((s, i) => (
                                    <td key={i} className="text-center px-3 py-2 font-mono text-slate-900 dark:text-white">{row.get(s)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── STAFFING TAB ───────────────────────────────────────────

function StaffingTab({ result }: { result: ReturnType<typeof calculatePortfolio> }) {
    const data = [
        { metric: 'Total Staff', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, s.totalStaff])) },
        { metric: 'Staff/MW', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, parseFloat(s.staffPerMw.toFixed(1))])) },
    ];

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-1">Staffing Comparison<Tooltip content="Comparison of total headcount and staff density (per MW) across sites. Influenced by shift model, staffing approach, and local labor market." /></h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }} />
                        <Legend formatter={(v: string) => result.sites[parseInt(v.replace('s', ''))]?.site.label || v} />
                        {result.sites.map((_, i) => (
                            <Bar key={i} dataKey={`s${i}`} fill={SITE_COLORS[i]} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                            <th className="text-left px-4 py-2 font-medium text-slate-500">Metric</th>
                            {result.sites.map((s, i) => (
                                <th key={i} className="text-center px-3 py-2 font-medium" style={{ color: SITE_COLORS[i] }}>{s.site.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { label: 'Total Staff', get: (s: SiteResult) => String(s.totalStaff), tooltip: 'Total headcount required for 24/7 operations at this site, based on shift model and staffing approach.' },
                            { label: 'Staff/MW', get: (s: SiteResult) => s.staffPerMw.toFixed(1), tooltip: 'Staff density per megawatt of IT load. Lower values indicate more efficient operations staffing.' },
                            { label: 'Annual Staff Cost', get: (s: SiteResult) => `$${Math.round(s.annualStaffCost).toLocaleString()}`, tooltip: 'Total annual labor cost including salaries adjusted for country-specific labor rates.' },
                            { label: 'Country', get: (s: SiteResult) => s.countryName, tooltip: 'Site location which determines local labor rates, energy costs, and regulatory requirements.' },
                        ].map(row => (
                            <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300"><span className="flex items-center gap-1">{row.label}<Tooltip content={row.tooltip} /></span></td>
                                {result.sites.map((s, i) => (
                                    <td key={i} className="text-center px-3 py-2 font-mono text-slate-900 dark:text-white">{row.get(s)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── RISK TAB ───────────────────────────────────────────────

function RiskTab({ result }: { result: ReturnType<typeof calculatePortfolio> }) {
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">Risk Profile Comparison<Tooltip content="Comparison of risk-related design choices across sites including tier level, redundancy configuration, and maintenance strategy." /></h3>
            </div>
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left px-4 py-2 font-medium text-slate-500">Risk Factor</th>
                        {result.sites.map((s, i) => (
                            <th key={i} className="text-center px-3 py-2 font-medium" style={{ color: SITE_COLORS[i] }}>{s.site.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {[
                        { label: 'Tier Level', get: (s: SiteResult) => `Tier ${s.site.tierLevel}`, tooltip: 'Uptime Institute tier classification defining redundancy and fault tolerance (Tier 2: N+1, Tier 3: Concurrently Maintainable, Tier 4: Fault Tolerant).' },
                        { label: 'Power Redundancy', get: (s: SiteResult) => s.site.powerRedundancy, tooltip: 'Power distribution redundancy configuration (e.g., N+1, 2N). Higher redundancy reduces single-point-of-failure risk.' },
                        { label: 'Maint. Strategy', get: (s: SiteResult) => s.site.maintenanceStrategy, tooltip: 'Maintenance approach — reactive (break-fix), preventive (scheduled), or predictive (condition-based monitoring).' },
                        { label: 'Cooling Type', get: (s: SiteResult) => s.site.coolingType, tooltip: 'Cooling infrastructure design. Affects energy efficiency, water usage, and maximum rack density support.' },
                        { label: 'Expected Uptime', get: (s: SiteResult) => s.site.tierLevel === 4 ? '99.995%' : s.site.tierLevel === 3 ? '99.982%' : '99.749%', tooltip: 'Target availability based on tier level. Tier 4: 26 min/yr downtime, Tier 3: 1.6 hr/yr, Tier 2: 22 hr/yr.' },
                    ].map(row => (
                        <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300"><span className="flex items-center gap-1">{row.label}<Tooltip content={row.tooltip} /></span></td>
                            {result.sites.map((s, i) => (
                                <td key={i} className="text-center px-3 py-2 font-mono text-slate-900 dark:text-white">{row.get(s)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── CARBON TAB ─────────────────────────────────────────────

function CarbonTab({ result }: { result: ReturnType<typeof calculatePortfolio> }) {
    const data = [
        { metric: 'CO₂ (tCO₂/yr)', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, Math.round(s.carbon.annualEmissionsTonCO2)])) },
        { metric: 'PUE', ...Object.fromEntries(result.sites.map((s, i) => [`s${i}`, s.pue])) },
    ];

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-1">Carbon & Energy Comparison<Tooltip content="Comparison of annual CO2 emissions and PUE across sites. Lower values indicate more environmentally efficient operations." /></h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }} />
                        <Legend formatter={(v: string) => result.sites[parseInt(v.replace('s', ''))]?.site.label || v} />
                        {result.sites.map((_, i) => (
                            <Bar key={i} dataKey={`s${i}`} fill={SITE_COLORS[i]} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                            <th className="text-left px-4 py-2 font-medium text-slate-500">Metric</th>
                            {result.sites.map((s, i) => (
                                <th key={i} className="text-center px-3 py-2 font-medium" style={{ color: SITE_COLORS[i] }}>{s.site.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { label: 'Annual CO₂', get: (s: SiteResult) => `${Math.round(s.carbon.annualEmissionsTonCO2).toLocaleString()} tCO₂`, tooltip: 'Total annual carbon dioxide emissions in metric tons, based on energy consumption and local grid carbon intensity.' },
                            { label: 'PUE', get: (s: SiteResult) => s.pue.toFixed(2), tooltip: 'Power Usage Effectiveness — ratio of total facility power to IT equipment power. 1.0 is perfect; typical range is 1.2-1.8.' },
                            { label: 'Annual Energy', get: (s: SiteResult) => `${Math.round(s.carbon.annualEnergyMWh).toLocaleString()} MWh`, tooltip: 'Total annual energy consumption including IT load and all overhead (cooling, lighting, losses) in megawatt-hours.' },
                            { label: 'Grid Intensity', get: (s: SiteResult) => `${s.carbon.pueEfficiency.toFixed(2)} PUE`, tooltip: 'PUE efficiency factor reflecting how the local electricity grid carbon intensity affects overall emissions.' },
                            { label: 'Carbon Offset Cost', get: (s: SiteResult) => `$${Math.round(s.carbon.carbonOffsetCostUSD).toLocaleString()}`, tooltip: 'Estimated annual cost to offset carbon emissions through verified carbon credits at current market rates.' },
                        ].map(row => (
                            <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300"><span className="flex items-center gap-1">{row.label}<Tooltip content={row.tooltip} /></span></td>
                                {result.sites.map((s, i) => (
                                    <td key={i} className="text-center px-3 py-2 font-mono text-slate-900 dark:text-white">{row.get(s)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
