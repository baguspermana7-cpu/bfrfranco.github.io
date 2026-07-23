'use client';

/* ─── Renewable & Storage Economics (Workstream J) ───────────────────────────
 * GATED on the CAPEX renewable selection. Full project economics over the
 * engine: hybridScreen coverage → CAPEX/OPEX → avoided cost (energy + carbon
 * + grid services) → NPV @ regional WACC / IRR / payback → BANKABILITY with
 * the technology-economics stance: when the numbers fail, the page says
 * GRID-ONLY WINS HERE — never renewable enthusiasm. Storage: degradation,
 * augmentation, availability, dispatch constraint, regulator notes.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { rzModels, useEngineReady } from '@/lib/rz-engine';
import { Tooltip } from '@/components/ui/Tooltip';
import { fmtMoney } from '@/lib/format';
import { Sun, BatteryCharging, Landmark, Scale } from 'lucide-react';

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 ${className}`}>{children}</div>
);
const H = ({ children, tip }: { children: React.ReactNode; tip?: string }) => (
    <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}{tip && <Tooltip content={tip} />}</h2>
);

/** map a country id to the engine's energy region keys */
const ENGINE_REGIONS = ['US', 'EU', 'APAC', 'LATAM', 'ID', 'SG', 'JP', 'IN', 'MY'];
const EU_IDS = ['DE', 'FR', 'NL', 'IE', 'UK', 'GB', 'SE', 'FI', 'NO', 'DK', 'ES', 'IT', 'PL', 'AT', 'BE', 'CH'];
function engineRegion(id?: string): string {
    if (!id) return 'US';
    if (ENGINE_REGIONS.includes(id)) return id;
    if (EU_IDS.includes(id)) return 'EU';
    if (['AU', 'NZ', 'KR', 'TW', 'HK', 'TH', 'VN', 'PH'].includes(id)) return 'APAC';
    if (['BR', 'MX', 'CL', 'AR', 'CO'].includes(id)) return 'LATAM';
    return 'US';
}

export function RenewableEconomicsPage() {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const capexInputs = useCapexStore((s) => s.inputs);
    const engineReady = useEngineReady();

    const renewOn = (capexInputs.renewableOption ?? 'none') !== 'none';
    const solarMwp = capexInputs.renewSolarMwp ?? 0;
    const bessMwh = capexInputs.renewBessMwh ?? 0;
    const region = engineRegion(selectedCountry?.id);
    const elecRate = selectedCountry?.economy?.electricityRate ?? 0.10;
    const itLoadMw = (inputs.itLoad || 2500) / 1000;

    const m = engineReady ? rzModels() : null;
    const run = React.useCallback((mods: { rate?: number; solar?: number } = {}) => {
        try {
            return m?.energy?.renewableProject ? m.energy.renewableProject({
                region, itLoadMw, solarMwp: mods.solar ?? solarMwp, bessMwh,
                elecRateUsdKwh: mods.rate ?? elecRate,
            }) : null;
        } catch { return null; }
    }, [m, region, itLoadMw, solarMwp, bessMwh, elecRate]);
    const r = React.useMemo(() => run(), [run]);
    const sens = React.useMemo(() => {
        if (!r) return [];
        return [
            { label: `Tariff −30% ($${(elecRate * 0.7).toFixed(3)})`, p: run({ rate: elecRate * 0.7 }) },
            { label: `Tariff +30% ($${(elecRate * 1.3).toFixed(3)})`, p: run({ rate: elecRate * 1.3 }) },
            { label: `Solar −50% (${(solarMwp * 0.5).toFixed(1)} MWp)`, p: run({ solar: solarMwp * 0.5 }) },
            { label: `Solar +50% (${(solarMwp * 1.5).toFixed(1)} MWp)`, p: run({ solar: solarMwp * 1.5 }) },
        ].filter((x) => x.p);
    }, [r, run, elecRate, solarMwp]);

    if (!renewOn) {
        return (
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center text-sm text-slate-500">
                <Sun className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                No renewable selected in the CAPEX questionnaire — select <b>Solar</b> or <b>Solar + BESS</b> to unlock the project economics.
                <div className="mt-3"><button onClick={() => actions.setActiveTab('capex')} className="rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base">Open CAPEX Engine</button></div>
            </div>
        );
    }
    if (!engineReady || !r) {
        return <div className="p-8 text-center text-sm text-slate-500">Energy engine loading… (rz-engine models.energy.renewableProject)</div>;
    }

    const bankable = r.bankability.verdict.includes('BANKABLE') && !r.bankability.verdict.includes('NOT');
    const st = r.storage;

    return (
        <div className="space-y-4">
            <div>
                <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Sun className="h-5 w-5 text-rz-signal" /> Renewable &amp; Storage Economics</h1>
                <p className="text-xs text-slate-500">{selectedCountry?.name ?? '—'} (engine region {region}) · {solarMwp} MWp PV{bessMwh > 0 ? ` + ${bessMwh} MWh BESS` : ''} · tariff ${elecRate.toFixed(3)}/kWh · screening project finance</p>
            </div>

            {/* bankability banner — technology-economics balance */}
            <div className={`rounded-lg border p-3 ${bankable ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rz-signal/50 bg-rz-signal/5'}`}>
                <div className={`flex items-center gap-2 text-sm font-bold ${bankable ? 'text-rz-data' : 'text-amber-600 dark:text-rz-signal'}`}>
                    <Scale className="h-4 w-4" /> {r.bankability.verdict}
                    <Tooltip content="Screening bankability gate: NPV > 0 AND IRR > regional WACC. Lender diligence adds DSCR ≥ ~1.25, contracted-revenue quality, and counterparty/country risk. The verdict is economics-first: this page will recommend AGAINST the renewable when the grid wins." />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{r.bankability.note}</p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <Card><H tip="Total installed cost: regional $/MWp for PV + $/kWh for BESS. Interconnection and land works excluded at screening.">CAPEX</H><div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmtMoney(r.capexUsd)}</div></Card>
                <Card><H tip="Fraction of the DC's annual energy the renewable actually covers after the day/night simplification — solar direct + BESS-shifted + wind. Small vs a 24/7 DC load is NORMAL and is the honest number.">Coverage</H><div className="text-lg font-bold tabular-nums text-rz-info">{(r.coverage.coverageFraction * 100).toFixed(1)}%</div><div className="text-[10px] text-slate-500">{r.coverage.coveredMwhYr.toLocaleString()} MWh/yr</div></Card>
                <Card><H tip="Levelized cost of the renewable energy vs the delivered grid tariff — the comparison currency. Renewable wins when its LCOE (plus firming) beats the tariff.">LCOE vs Grid</H><div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{r.coverage.blendedLcoe != null ? `$${r.coverage.blendedLcoe}` : '—'}<span className="text-xs">/MWh</span></div><div className="text-[10px] text-slate-500">grid ${Math.round(elecRate * 1000)}/MWh</div></Card>
                <Card><H tip="NPV of the project cash flows (avoided energy + carbon + grid services − OPEX − augmentation) at the regional WACC. The decision number.">NPV</H><div className={`text-lg font-bold tabular-nums ${r.npvUsd >= 0 ? 'text-rz-data' : 'text-rz-alert'}`}>{fmtMoney(r.npvUsd)}</div></Card>
                <Card><H tip="Project IRR vs the regional weighted-average cost of capital. IRR > WACC is the bankability hurdle.">IRR vs WACC</H><div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{r.irrPct ?? '—'}% <span className="text-xs text-slate-500">/ {r.waccPct}%</span></div></Card>
                <Card><H tip="Simple payback — screening liquidity metric; NPV/IRR decide.">Payback</H><div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{r.paybackYears ?? '—'} <span className="text-xs">yr</span></div></Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {/* avoided cost */}
                <Card>
                    <H tip="What the renewable is worth per year: covered MWh at the grid tariff (avoided purchase), carbon offset at the regional carbon price (avoided liability), and the ancillary-market mid-band for the BESS."><Landmark className="mr-1 inline h-3.5 w-3.5" />Avoided Cost &amp; Revenue</H>
                    <table className="w-full text-[11px]">
                        <tbody className="text-slate-600 dark:text-slate-300">
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5">Avoided grid energy</td><td className="text-right tabular-nums font-semibold">{fmtMoney(r.avoided.energyUsdYr)}/yr</td></tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5">Avoided carbon liability</td><td className="text-right tabular-nums font-semibold">{fmtMoney(r.avoided.carbonUsdYr)}/yr</td></tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5">Grid services (mid-band)</td><td className="text-right tabular-nums font-semibold">{fmtMoney(r.avoided.gridServicesUsdYr)}/yr</td></tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5">OPEX</td><td className="text-right tabular-nums font-semibold text-rz-alert">−{fmtMoney(r.opexUsdYr)}/yr</td></tr>
                            <tr><td className="py-1.5 font-bold">Net annual benefit</td><td className="text-right tabular-nums font-bold text-rz-data">{fmtMoney(r.avoided.totalUsdYr - r.opexUsdYr)}/yr</td></tr>
                        </tbody>
                    </table>
                    <p className="mt-2 text-[10px] text-slate-400">Curtailed {r.coverage.curtailedMwhYr.toLocaleString()} MWh/yr (generated but unusable — honesty line) · land {r.coverage.landHa} ha · grid residual {r.coverage.gridResidualMwhYr.toLocaleString()} MWh/yr stays on tariff.</p>
                </Card>

                {/* sensitivity */}
                <Card>
                    <H tip="Deterministic re-runs of the same project model at tariff ±30% and solar sizing ±50% — which side of bankable the case sits on under realistic movement. Scenario conditions, not point estimates.">Sensitivity — scenario conditions</H>
                    <table className="w-full text-[11px]">
                        <thead><tr className="text-left text-[10px] uppercase text-slate-500"><th className="py-1">Case</th><th className="text-right">NPV</th><th className="text-right">IRR</th><th className="text-right">Verdict</th></tr></thead>
                        <tbody className="text-slate-600 dark:text-slate-300">
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"><td className="py-1.5 font-semibold">Base</td><td className="text-right tabular-nums">{fmtMoney(r.npvUsd)}</td><td className="text-right tabular-nums">{r.irrPct ?? '—'}%</td><td className={`text-right font-semibold ${bankable ? 'text-rz-data' : 'text-rz-signal'}`}>{bankable ? 'BANKABLE' : 'GRID WINS'}</td></tr>
                            {sens.map((sx) => {
                                const ok2 = sx.p!.bankability.verdict.includes('BANKABLE') && !sx.p!.bankability.verdict.includes('NOT');
                                return (
                                    <tr key={sx.label} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <td className="py-1.5">{sx.label}</td>
                                        <td className={`text-right tabular-nums ${sx.p!.npvUsd >= 0 ? '' : 'text-rz-alert'}`}>{fmtMoney(sx.p!.npvUsd)}</td>
                                        <td className="text-right tabular-nums">{sx.p!.irrPct ?? '—'}%</td>
                                        <td className={`text-right font-semibold ${ok2 ? 'text-rz-data' : 'text-rz-signal'}`}>{ok2 ? 'BANKABLE' : 'GRID WINS'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            </div>

            {bessMwh > 0 && st && (
                <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <H tip="Usable capacity fades with cycling (20% budget across the cycle life) + calendar aging; when usable drops below 80% of contracted, cells are topped up (augmentation) priced at the then-current declining $/kWh."><BatteryCharging className="mr-1 inline h-3.5 w-3.5" />BESS Degradation &amp; Augmentation</H>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={st.degradationCurve} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                                    <YAxis domain={[0.6, 1]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                                    <RTooltip formatter={(v) => `${((v as number) * 100).toFixed(1)}% usable`} labelFormatter={(l) => `Year ${l}`} />
                                    <Line type="monotone" dataKey="usableFrac" stroke="#00DDFF" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">Augmentation years: {st.augmentation.years.join(', ') || 'none in horizon'} · top-up capex {fmtMoney(st.augmentation.capexUsd)} · {st.augmentation.rule}</p>
                    </Card>
                    <Card>
                        <H tip="Operating envelope: what the battery can actually do each day, its fleet availability, the ancillary-revenue band, and the jurisdiction's export/grid-services rules — dispatch is a CONSTRAINT, not a free lunch.">Dispatch · Availability · Regulator</H>
                        <table className="w-full text-[11px]">
                            <tbody className="text-slate-600 dark:text-slate-300">
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">Daily shiftable energy</td><td className="text-right tabular-nums">{st.dispatch.dailyMwh} MWh</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">Dispatch constraint</td><td className="text-right text-slate-500">{st.dispatch.constraint}</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">Fleet availability</td><td className="text-right tabular-nums">{st.availabilityPct}% (incl. PCS)</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">Grid-services band</td><td className="text-right tabular-nums">{fmtMoney(st.gridServices.usdYrBand[0])}–{fmtMoney(st.gridServices.usdYrBand[1])}/yr</td></tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 font-semibold">Export rule ({region})</td><td className="text-right text-slate-500">{st.regulatory.export}</td></tr>
                                <tr><td className="py-1.5 font-semibold">Ancillary access</td><td className="text-right text-slate-500">{st.regulatory.gridServices}</td></tr>
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            <p className="text-[10px] text-slate-400">{r.method}. Storage: {st?.method ?? '—'}.</p>
        </div>
    );
}

export default RenewableEconomicsPage;
