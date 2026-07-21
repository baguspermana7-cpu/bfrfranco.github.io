'use client';

/* ─── DC-OS · RELIABILITY (Layer 10) ──────────────────────────────────────────
 * Dedicated pillar dashboard ("RAM Detail" tab of the Reliability Engine page).
 * Consumes RZEngine.models.reliability (RAM) with the current tier + redundancy:
 * system availability, Uptime tier target, annual downtime, and a per-component
 * MTBF/MTTR/availability table. All values are REAL engine outputs.
 * Headline availability uses the SAME β=5% common-cause-adjusted chain as the
 * "Availability & SPOF" tab (shared availabilityChain.ts) with nines-aware
 * formatting — a pure parallel-series composition saturated to a fake
 * "100.000% · 0 min" under display rounding (never round mid-chain).
 * "Generate Report" reuses the dashboard PDF pipe.
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { rzModels, rzData } from '@/lib/rz-engine';
import { ShieldCheck, Activity, Clock, Target, FileDown } from 'lucide-react';
import {
    initDoc, savePdf, drawCoverPage, drawModernHeader, drawFooter,
    drawSectionTitle, drawKpiCard, today, PDF_COLORS,
} from '@/modules/reporting/PdfUtils';
import {
    ccOverall, ninesOf, fmtAvail, fmtDowntime, MIN_PER_YEAR,
    type RelComponent,
} from '@/components/modules/reliability/availabilityChain';

const REDUNDANCY_KEY: Record<string, string> = { 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' };
const CORE_COMPONENTS = ['ups', 'generator', 'crac', 'pdu', 'switchgear', 'chiller'];

interface CompRow { key: string; label: string; mtbf: number; mttr: number; availability: number; }

export function ReliabilityDashboard() {
    const { inputs } = useSimulationStore();
    const redKey = REDUNDANCY_KEY[inputs.powerRedundancy] || 'n1';

    const model = React.useMemo(() => {
        const m = rzModels().reliability;
        const d = rzData().reliability;
        if (!m || !d) return null;
        const comps: CompRow[] = CORE_COMPONENTS.map((k) => {
            const c = d.components?.[k];
            return c ? { key: k, label: c.label, mtbf: c.mtbf, mttr: c.mttr, availability: m.availability(c.mtbf, c.mttr) } : null;
        }).filter(Boolean) as CompRow[];
        /* SAME composed chain as the "Availability & SPOF" tab: per-system
         * parallel-series + β=5% common-cause screening. The old pure
         * parallel-series systemAvailability() saturated (0.99999996 → shown as
         * a fake "100.000% / 0 min" after display rounding). */
        const paths: number = d.redundancyPaths?.[redKey] ?? 2;
        const sysAv = ccOverall(m, d.components as Record<string, RelComponent>, 1, paths);
        const target = m.tierTarget(inputs.tierLevel);
        return {
            comps,
            paths,
            systemAvailability: sysAv,
            target,
            downtimeMin: (1 - sysAv) * MIN_PER_YEAR,
            targetDowntimeMin: (1 - target) * MIN_PER_YEAR,
            meetsTarget: sysAv >= target,
        };
    }, [inputs.tierLevel, redKey]);

    const handleExport = async () => {
        if (!model) return;
        const { doc } = await initDoc();
        drawCoverPage(doc, 'Reliability (RAM)', 'DC-OS · Layer 10', { date: today(), version: 'DC-OS', confidential: true });
        doc.addPage();
        drawModernHeader(doc, 'Reliability Analysis', `Tier ${inputs.tierLevel} · ${inputs.powerRedundancy}`);
        let y = 40;
        y = drawSectionTitle(doc, y, 'System Availability', '1');
        const w = 58;
        drawKpiCard(doc, 14, y, w, 22, 'System availability', fmtAvail(model.systemAvailability), `Tier ${inputs.tierLevel} target ${fmtAvail(model.target)} · β=5% CC`, PDF_COLORS.secondary);
        drawKpiCard(doc, 14 + w + 4, y, w, 22, 'Annual downtime', fmtDowntime(model.downtimeMin), `target ${fmtDowntime(model.targetDowntimeMin)}`, PDF_COLORS.warning);
        drawKpiCard(doc, 14 + 2 * (w + 4), y, w, 22, 'Meets tier target', model.meetsTarget ? 'YES' : 'NO', inputs.powerRedundancy, model.meetsTarget ? PDF_COLORS.success : PDF_COLORS.danger);
        drawFooter(doc, 1);
        savePdf(doc, `DC-OS_Reliability_Tier${inputs.tierLevel}.pdf`);
    };

    if (!model) {
        return <div className="text-sm text-slate-500 p-8 text-center">Reliability engine loading…</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded bg-rz-data/10 border border-rz-data/30 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-rz-data" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reliability (RAM)</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">DC-OS Layer 10 · RZEngine.models.reliability · Tier {inputs.tierLevel} · {inputs.powerRedundancy}</p>
                    </div>
                </div>
                <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-cyan-700 text-white text-xs font-medium transition-colors">
                    <FileDown className="w-3.5 h-3.5" /> Generate Report
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Metric icon={Activity} label="System Availability" value={`${fmtAvail(model.systemAvailability)} — ${ninesOf(model.systemAvailability)}+ nines`} sub={`composed chain · β=5% common-cause · ${inputs.powerRedundancy} = ${model.paths} path(s)`} tone={model.meetsTarget ? 'good' : 'warn'} />
                <Metric icon={Target} label="Tier Target" value={fmtAvail(model.target)} sub={`Uptime Tier ${inputs.tierLevel}`} />
                <Metric icon={Clock} label="Annual Downtime" value={fmtDowntime(model.downtimeMin)} sub={`target ≤ ${fmtDowntime(model.targetDowntimeMin)} · unplanned`} tone={model.meetsTarget ? 'good' : 'warn'} />
            </div>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Component Reliability (IEEE 493)</h2>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[11px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="text-left font-medium px-4 py-2">Component</th>
                            <th className="text-right font-medium px-4 py-2">MTBF (h)</th>
                            <th className="text-right font-medium px-4 py-2">MTTR (h)</th>
                            <th className="text-right font-medium px-4 py-2">Availability</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.comps.map((c) => (
                            <tr key={c.key} className="border-b border-slate-100 dark:border-slate-800/50">
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{c.label}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{c.mtbf.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{c.mttr}</td>
                                <td className="px-4 py-2 text-right tabular-nums font-medium text-rz-data">{fmtAvail(c.availability)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-[11px] text-slate-400">
                Availability = MTBF/(MTBF+MTTR); system = documented per-system chains at {inputs.powerRedundancy} ({model.paths} path{model.paths > 1 ? 's' : ''}), in series, blended with a β=5% common-cause screening factor (assumption) — same chain as the Availability &amp; SPOF tab, so redundant chains never display a fake 100%. Unplanned-outage screening RAM — not a certified reliability study. Source: RZEngine.data.sources[&apos;reliability&apos;] (IEEE 493 + Uptime Tier).
            </p>
        </div>
    );
}

function Metric({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
    const color = tone === 'good' ? 'text-rz-data' : tone === 'warn' ? 'text-rz-signal' : 'text-rz-info';
    return (
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>
            {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
        </div>
    );
}

export default ReliabilityDashboard;
