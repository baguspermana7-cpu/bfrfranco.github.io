'use client';

/* ─── Architecture bottom cards + absorbed engine sections (Phase C) ─────────
 * Absorbs the old ArchitectureDashboard cards: complexity (Overview KPI),
 * thermalCheck (Cooling), topology (Power), disciplines + floorLoading +
 * designFee (BOM). Compliance card = HONEST engine-derived (screening chips
 * where no evaluable model exists — never fake 100% bars).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { rzModels } from '@/lib/rz-engine';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { computeCompliance, referenceDesignId, type ArchInputs, type EquipCounts } from '@/state/adapters/arch-adapter';
import { useScenarioStore } from '@/store/scenario';
import { ChevronRight } from 'lucide-react';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
            {children}
        </div>
    );
}

export function ThermalTopologyRow({ i }: { i: ArchInputs }) {
    const m = rzModels()?.architecture;
    let thermal: { class?: string; label?: string; supplyTempC?: number; deltaTK?: number; deltaTBand?: [number, number]; compliant?: boolean; flags?: string[] } | null = null;
    let topo: { powerPath?: string; coolingPath?: string; maintainability?: string; tiaRating?: string } | null = null;
    let floor: number | null = null;
    try { thermal = m?.thermalCheck ? m.thermalCheck({ coolingType: i.coolingType, supplyTempC: i.supplyTempC, deltaTK: i.deltaTK ?? undefined }) : null; } catch { /* */ }
    try { topo = m?.topology ? m.topology(i.tier) : null; } catch { /* */ }
    try { floor = m?.floorLoading ? m.floorLoading(i.coolingType) : null; } catch { /* */ }
    return (
        <div className="grid gap-3 md:grid-cols-2">
            <Card title="Cooling — ASHRAE Thermal Envelope (TC 9.9)">
                {thermal ? (
                    <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between"><span className="text-slate-500">Class</span><span className="font-medium text-slate-800 dark:text-slate-200">{thermal.label}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Supply Temp</span><span className="tabular-nums text-slate-800 dark:text-slate-200">{thermal.supplyTempC} °C</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">ΔT</span><span className="tabular-nums text-slate-800 dark:text-slate-200">{thermal.deltaTK} K (band {thermal.deltaTBand?.join('–')} K)</span></div>
                        <div className={`rounded px-2 py-1 text-center text-[10px] font-semibold ${thermal.compliant ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                            {thermal.compliant ? 'Compliant' : `${thermal.flags?.length ?? 0} flag(s)`}
                        </div>
                        {(thermal.flags ?? []).map((fl, idx) => <p key={idx} className="text-[10px] text-amber-500">⚠ {fl}</p>)}
                    </div>
                ) : <p className="text-[11px] text-slate-500">Engine loading…</p>}
            </Card>
            <Card title="Power — Redundancy Topology (Uptime / TIA-942-C)">
                {topo ? (
                    <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between gap-2"><span className="text-slate-500">Rating</span><span className="font-medium text-slate-800 dark:text-slate-200">{topo.tiaRating}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-slate-500">Power Path</span><span className="max-w-[60%] text-right text-slate-800 dark:text-slate-200">{topo.powerPath}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-slate-500">Cooling Path</span><span className="max-w-[60%] text-right text-slate-800 dark:text-slate-200">{topo.coolingPath}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-slate-500">Maintainability</span><span className="text-slate-800 dark:text-slate-200">{topo.maintainability}</span></div>
                        {floor != null && <div className="flex justify-between"><span className="text-slate-500">Floor Loading</span><span className="tabular-nums text-slate-800 dark:text-slate-200">{floor} kN/m²</span></div>}
                    </div>
                ) : <p className="text-[11px] text-slate-500">Engine loading…</p>}
            </Card>
        </div>
    );
}

export function BomSection({ i, eq }: { i: ArchInputs; eq: EquipCounts }) {
    const m = rzModels()?.architecture;
    const capexTotal = useCapexStore((s) => s.results?.total ?? 0);
    let disciplines: { key: string; label: string; driver: string }[] = [];
    let fee: { rate: number; feeUsd: number } | null = null;
    let band = '—';
    try {
        const c = m?.complexity ? m.complexity({ coolingType: i.coolingType, tier: i.tier, redundancy: i.redKey }) : null;
        band = c?.band ?? '—';
        disciplines = m?.disciplines ? m.disciplines({ coolingType: i.coolingType, tier: i.tier, redundancy: i.redKey }) ?? [] : [];
        fee = m?.designFee && capexTotal > 0 && band !== '—' ? m.designFee(capexTotal, band) : null;
    } catch { /* */ }
    const ROWS: [string, keyof EquipCounts][] = [
        ['MV Switchgear', 'switchgear'], ['Transformers', 'transformers'], ['Generators', 'generators'],
        ['UPS Modules', 'ups_modules'], ['STS', 'sts'], ['PDUs', 'pdus'], ['Chillers', 'chillers'],
        ['Pumps / CDU', 'pumps'], ['Cooling Units', 'cooling_units'], ['AHU', 'ahu'], ['Racks', 'racks'], ['Fire Zones', 'fireZones'],
    ];
    return (
        <div id="sec-bom" className="scroll-mt-24 grid gap-3 md:grid-cols-2">
            <Card title={`BOM Summary — equipment counts (engine equipScale · ${(i.itLoadKw / 1000).toFixed(0)} MW)`}>
                <div className="grid grid-cols-3 gap-1.5">
                    {ROWS.map(([label, k]) => (
                        <div key={label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-center">
                            <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{(eq[k] ?? 0).toLocaleString()}</div>
                            <div className="text-[8.5px] uppercase tracking-wide text-slate-500">{label}</div>
                        </div>
                    ))}
                </div>
                <p className="mt-1.5 text-[9px] text-slate-400">Screening counts from the Cx equipment-scaling model — not a QTO.</p>
            </Card>
            <Card title="Discipline Scope & Design Fee">
                <div className="space-y-0.5">
                    {disciplines.map((d) => (
                        <div key={d.key} className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
                            <span className="max-w-[55%] truncate text-right text-slate-400">{d.driver}</span>
                        </div>
                    ))}
                </div>
                {fee && (
                    <div className="mt-2 rounded-lg bg-violet-600/10 px-2 py-1.5 text-[11px]">
                        <span className="text-slate-500">Design fee ({band} complexity): </span>
                        <b className="text-violet-500">{(fee.rate * 100).toFixed(0)}% · ${(fee.feeUsd / 1e6).toFixed(1)}M</b>
                        <span className="text-[9px] text-slate-400"> of construction capex</span>
                    </div>
                )}
            </Card>
        </div>
    );
}

export function BottomCards({ i, targetTier }: { i: ArchInputs; targetTier: 3 | 4 }) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const scenarios = useScenarioStore((s) => s.scenarios);
    const compliance = computeCompliance(i, targetTier);
    const m = rzModels()?.architecture;
    let topoPath = '—';
    try { topoPath = m?.topology ? (m.topology(i.tier)?.powerPath ?? '—') : '—'; } catch { /* */ }
    const decisions: [string, string][] = [
        ['Power Topology', topoPath],
        ['Cooling Strategy', { liquid: 'D2C liquid cooling', rdhx: 'Rear-door HX', inrow: 'In-row cooling', air: 'CRAC/CRAH air' }[i.coolingType]],
        ['Rack Configuration', `${Math.ceil(i.itLoadKw / i.rackDensityKw).toLocaleString()} racks @ ${i.rackDensityKw} kW`],
        ['PDU Topology', `${i.redKey === '2n1' ? '3' : '2'}× lettered groups · ${i.redundancy}`],
    ];
    return (
        <div id="sec-reference" className="scroll-mt-24 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Key Design Decisions">
                <div className="space-y-1.5">
                    {decisions.map(([k, v]) => (
                        <div key={k} className="text-[11px]">
                            <div className="font-medium text-slate-800 dark:text-slate-200">{k}</div>
                            <div className="text-[10px] text-slate-500">{v}</div>
                        </div>
                    ))}
                </div>
            </Card>
            <Card title="Reference Design Selected">
                <div className="text-[11px] space-y-1">
                    <div className="font-mono font-semibold text-violet-500">{referenceDesignId(i)}</div>
                    <p className="text-slate-600 dark:text-slate-300">{i.useCase.toUpperCase()} data center with {i.coolingType === 'liquid' ? 'direct-to-chip liquid cooling' : `${i.coolingType} cooling`}, {i.redundancy} power & cooling.</p>
                    <p className="text-[10px] text-slate-500">Applicable load: {Math.round(i.itLoadKw / 2000)}–{Math.round(i.itLoadKw / 500)} MW</p>
                    <p className="text-[9px] text-slate-400">Pattern template (screening reference, not a certified design). Saved scenarios: {scenarios.length}.</p>
                </div>
            </Card>
            <Card title="Architecture Compliance">
                <div className="space-y-1.5">
                    {compliance.map((c) => (
                        <div key={c.standard} className="text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">{c.standard}</span>
                                {c.pct != null
                                    ? <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{c.pct}%</span>
                                    : <span className="rounded bg-slate-500/15 px-1 py-0.5 text-[8.5px] font-semibold text-slate-400">SCREENING</span>}
                            </div>
                            {c.pct != null && (
                                <div className="mt-0.5 h-1 rounded bg-slate-100 dark:bg-slate-800">
                                    <div className={`h-1 rounded ${c.pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${c.pct}%` }} />
                                </div>
                            )}
                            <div className="text-[9px] text-slate-400">{c.note}</div>
                        </div>
                    ))}
                </div>
            </Card>
            <Card title="Next Steps">
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <li>✓ Review architecture with stakeholders</li>
                    <li>✓ Proceed to Capacity Planning Engine</li>
                    <li>✓ Run advanced simulation (Power & Cooling)</li>
                    <li>✓ Export architecture package</li>
                </ul>
                <button onClick={() => setActiveTab('capacity')}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-500">
                    Next: Capacity Planning <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </Card>
        </div>
    );
}
