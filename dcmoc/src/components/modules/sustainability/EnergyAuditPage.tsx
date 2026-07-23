'use client';

/* ─── Energy Audit & Management (Workstream J) ───────────────────────────────
 * EnPI / ISO 50001 + IPMVP Option C surface. OWNER MANDATE: an energy-
 * performance CLAIM is only testable when numerator, denominator, boundary,
 * climate normalization, time window, and exclusions are PINNED — this page
 * renders the pinning verbatim (engine DATA.energy.enpiSpec) and TESTS a
 * claim against the normalized measurement. Plus: annual-energy economics
 * (avoided cost), PUE·WUE·reliability vs annual energy, and the energy-
 * management strategy roles. Screening-grade; method strings shown.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { rzData, rzModels, useEngineReady } from '@/lib/rz-engine';
import { Tooltip } from '@/components/ui/Tooltip';
import { fmtMoney } from '@/lib/format';
import { Zap, Gauge, ClipboardCheck, Users2, ShieldQuestion } from 'lucide-react';

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 ${className}`}>{children}</div>
);
const H = ({ children, tip }: { children: React.ReactNode; tip?: string }) => (
    <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}{tip && <Tooltip content={tip} />}</h2>
);

export function EnergyAuditPage() {
    const { selectedCountry, inputs } = useSimulationStore();
    const engineReady = useEngineReady();
    const itMw = (inputs.itLoad || 2500) / 1000;
    const d = rzData();
    const designPue: number = d?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? 1.4;
    const itMwhYr = Math.round(itMw * 8760);
    // inputs (local, seeded from design)
    const [facMwh, setFacMwh] = React.useState(() => Math.round(itMwhYr * designPue));
    const [claimedPue, setClaimedPue] = React.useState(() => +designPue.toFixed(2));
    const [weatherFactor, setWeatherFactor] = React.useState(1.0);
    const [exclusions, setExclusions] = React.useState(0);
    React.useEffect(() => { setFacMwh(Math.round(itMwhYr * designPue)); setClaimedPue(+designPue.toFixed(2)); }, [itMwhYr, designPue]);

    const m = engineReady ? rzModels() : null;
    const enpi = React.useMemo(() => {
        try { return m?.energy?.enpi ? m.energy.enpi({ itMwhYr, facilityMwhYr: facMwh, claimedPue, weatherFactor, exclusionsMwh: exclusions }) : null; }
        catch { return null; }
    }, [m, itMwhYr, facMwh, claimedPue, weatherFactor, exclusions]);
    const scopes = React.useMemo(() => {
        try { return m?.carbon?.scopes ? m.carbon.scopes({ mw: itMw, pue: enpi?.rawPue ?? designPue, region: selectedCountry?.id, capexUsd: 0 }) : null; } catch { return null; }
    }, [m, itMw, enpi, designPue, selectedCountry]);
    const waterM3 = React.useMemo(() => {
        try { return m?.water?.annualM3 ? m.water.annualM3(itMw, inputs.coolingType) : null; } catch { return null; }
    }, [m, itMw, inputs.coolingType]);

    const elecRate = selectedCountry?.economy?.electricityRate ?? 0.10;
    const overheadMwh = Math.max(0, facMwh - itMwhYr);
    const overheadCost = overheadMwh * 1000 * elecRate;
    const spec = enpi?.spec ?? d?.energy?.enpiSpec;

    if (!engineReady || !enpi) {
        return <div className="p-8 text-center text-sm text-slate-500">Energy engine loading… (rz-engine models.energy)</div>;
    }

    const supported = enpi.claim?.verdict === 'SUPPORTED';

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Zap className="h-5 w-5 text-rz-signal" /> Energy Audit &amp; Management</h1>
                    <p className="text-xs text-slate-500">ISO 50001 EnPI + IPMVP Option C (whole facility) — claim testing with every term pinned · {selectedCountry?.name ?? '—'} · {itMw.toFixed(1)} MW IT</p>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card><H tip="Normalized Energy Performance Indicator = normalized facility kWh ÷ IT kWh. Equal to an annualized, weather- and exclusion-normalized PUE. This is the number a defensible efficiency claim must quote.">Normalized EnPI</H>
                    <div className="text-2xl font-bold text-rz-info tabular-nums">{enpi.enpi}</div>
                    <div className="text-[10px] text-slate-500">raw (unnormalized) {enpi.rawPue}</div></Card>
                <Card><H tip="Facility energy at the utility meter over the rolling window. The NUMERATOR of the EnPI — IT + cooling + power losses + lighting/aux, minus itemized exclusions.">Facility Energy</H>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{facMwh.toLocaleString()} <span className="text-xs">MWh/yr</span></div>
                    <div className="text-[10px] text-slate-500">exclusions −{exclusions.toLocaleString()} MWh</div></Card>
                <Card><H tip="IT energy at the rack/PDU output meter — the DENOMINATOR. Never nameplate, never provisioned capacity: measured consumption only.">IT Energy</H>
                    <div className="text-2xl font-bold text-rz-data tabular-nums">{itMwhYr.toLocaleString()} <span className="text-xs">MWh/yr</span></div>
                    <div className="text-[10px] text-slate-500">{itMw.toFixed(1)} MW × 8,760 h</div></Card>
                <Card><H tip="Cost of the non-IT overhead energy (facility − IT) at the country industrial tariff — the money efficiency work recovers. Every 0.01 of PUE at this scale is real money.">Overhead Cost</H>
                    <div className="text-2xl font-bold text-rz-signal tabular-nums">{fmtMoney(overheadCost)}<span className="text-xs">/yr</span></div>
                    <div className="text-[10px] text-slate-500">{overheadMwh.toLocaleString()} MWh @ ${elecRate.toFixed(3)}/kWh</div></Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {/* claim test */}
                <Card>
                    <H tip="IPMVP-style performance-claim test: the claimed PUE is compared against the NORMALIZED measurement with boundary, window, and exclusions stated. SUPPORTED only when normalized measured ≤ claimed (5 mPUE tolerance)."><ShieldQuestion className="mr-1 inline h-3.5 w-3.5" />Performance-Claim Test</H>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <label className="block"><span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">Measured facility MWh/yr <Tooltip content="Utility-meter energy over the rolling 12-month window. Sub-annual windows bias PUE by season — the spec requires the window stated." /></span>
                            <input type="number" value={facMwh} onChange={(e) => setFacMwh(Math.max(itMwhYr, +e.target.value || 0))} className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs" /></label>
                        <label className="block"><span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">Claimed PUE <Tooltip content="The efficiency claim under test — a marketing number, a design target, or a contractual commitment." /></span>
                            <input type="number" step="0.01" value={claimedPue} onChange={(e) => setClaimedPue(+e.target.value || 1)} className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs" /></label>
                        <label className="block"><span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">Weather factor {weatherFactor.toFixed(2)} <Tooltip content="CDD (or wet-bulb bin) normalization ratio vs the baseline climate year. >1 = the window was hotter than baseline, so the cooling overhead is normalized DOWN. This is the 'climate' term the owner demanded pinned." /></span>
                            <input type="range" min="0.8" max="1.2" step="0.01" value={weatherFactor} onChange={(e) => setWeatherFactor(+e.target.value)} className="mt-1 w-full accent-cyan-500" /></label>
                        <label className="block"><span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">Exclusions MWh <Tooltip content="Itemized non-operational energy removed from the numerator: commissioning/load-bank tests, construction power, metered tenant office space. Each exclusion must be listed with its kWh — unlisted exclusions invalidate the claim." /></span>
                            <input type="number" value={exclusions} onChange={(e) => setExclusions(Math.max(0, +e.target.value || 0))} className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs" /></label>
                    </div>
                    {enpi.claim && (
                        <div className={`rounded-lg border p-3 ${supported ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rz-alert/40 bg-rz-alert/5'}`}>
                            <div className={`text-xs font-bold ${supported ? 'text-rz-data' : 'text-rz-alert'}`}>{enpi.claim.verdict} — gap {enpi.claim.gap > 0 ? '+' : ''}{enpi.claim.gap}</div>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{enpi.claim.statement}</p>
                        </div>
                    )}
                    <p className="mt-2 text-[10px] text-slate-400">{enpi.method} · screening — a metered M&amp;V program supersedes</p>
                </Card>

                {/* EnPI definition — the pinning */}
                <Card>
                    <H tip="The definition IS the audit: a claim without these terms pinned is untestable. Rendered verbatim from the engine spec (DATA.energy.enpiSpec, ISO 50001 / IPMVP)."><ClipboardCheck className="mr-1 inline h-3.5 w-3.5" />EnPI Definition — every term pinned</H>
                    {spec && (
                        <table className="w-full text-[11px]">
                            <tbody>
                                {([['Numerator', spec.numerator], ['Denominator', spec.denominator], ['Boundary', spec.boundary], ['Climate normalization', spec.normalization], ['Time window', spec.timeWindow], ['Exclusions', spec.exclusions], ['Claim test', spec.claimTest], ['Standard', spec.standard]] as [string, string][]).map(([k, v]) => (
                                    <tr key={k} className="border-b border-slate-100 dark:border-slate-800 last:border-0 align-top">
                                        <td className="py-1.5 pr-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{k}</td>
                                        <td className="py-1.5 text-slate-500 dark:text-slate-400 leading-snug">{v}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {/* energy vs sustainability/reliability */}
                <Card>
                    <H tip="How the annual energy interacts with the other performance axes: carbon follows grid intensity × energy; water follows the cooling technology; availability work (redundant paths, concurrent maintenance) adds electrical overhead — efficiency and resilience trade against each other and the balance is economic, not ideological."><Gauge className="mr-1 inline h-3.5 w-3.5" />PUE · WUE · Reliability vs Annual Energy</H>
                    <table className="w-full text-[11px]">
                        <thead><tr className="text-left text-[10px] uppercase text-slate-500"><th className="py-1">Axis</th><th>Value</th><th>Energy coupling</th></tr></thead>
                        <tbody className="text-slate-600 dark:text-slate-300">
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">PUE (normalized)</td><td className="tabular-nums">{enpi.enpi}</td><td className="text-slate-500">each −0.01 ≈ {fmtMoney(itMwhYr * 10 * elecRate)}/yr at this tariff</td></tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">WUE (design)</td><td className="tabular-nums">{waterM3 != null ? `${Math.round(waterM3).toLocaleString()} m³/yr` : '—'}</td><td className="text-slate-500">evaporative economizers trade water for energy — site water stress decides</td></tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">Carbon (S2)</td><td className="tabular-nums">{scopes ? `${Math.round(scopes.scope2 / 1000).toLocaleString()}k tCO₂e/yr` : '—'}</td><td className="text-slate-500">grid intensity × facility MWh — efficiency cuts it linearly</td></tr>
                            <tr><td className="py-1.5 font-semibold">Reliability (Tier {inputs.tierLevel})</td><td className="tabular-nums">design {(d?.reliability?.tierAvailability?.[inputs.tierLevel] * 100 || 99.98).toFixed(3)}%</td><td className="text-slate-500">redundant paths idle at part-load → worse PUE; the tier is a business choice priced in energy</td></tr>
                        </tbody>
                    </table>
                </Card>

                {/* strategy roles */}
                <Card>
                    <H tip="ISO 50001 energy-management roles — accountability is what makes an energy program survive contact with operations."><Users2 className="mr-1 inline h-3.5 w-3.5" />Energy-Management Strategy Roles</H>
                    <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <div><b>Executive sponsor</b> — owns the EnPI target in the business plan; approves capex with energy consequences (cooling tech, containment, setpoints).</div>
                        <div><b>Energy manager (M&amp;V owner)</b> — owns the meter tree, the baseline, normalization factors, and every exclusion; publishes the rolling-12-month EnPI; defends claims with this page&apos;s definition table.</div>
                        <div><b>Operations shift role</b> — executes setpoint discipline (supply temp, economizer changeover), logs deviations; the gap between design and operated PUE lives here.</div>
                        <div><b>Maintenance interface</b> — filter/coil condition, VFD health, sensor calibration: degraded plant IS an energy leak; ties to the maintenance strategy mix.</div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">Consequence discipline: a missed EnPI quarter triggers a documented root-cause (weather? load? plant?) — never silent re-baselining.</p>
                </Card>
            </div>
        </div>
    );
}

export default EnergyAuditPage;
