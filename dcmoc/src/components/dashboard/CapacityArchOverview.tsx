'use client';

import React from 'react';
import { Explain } from '@/components/ui/Explain';
import type { DashboardData } from './useDashboardData';
import { TraceValue } from '@/components/ui/TraceValue';

const fmtUsd = (n: number | null) => n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

// `tip` = an RZ_EXPLAIN_DB glossary key (knowledge-DB sourced, NOT a hardcoded
// string). <Explain> renders nothing when the key is absent — safe to wire.
function Tile({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
    return (
        <div className="group rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 p-2.5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-cyan-500/[0.06] hover:shadow-md hover:shadow-cyan-900/10">
            <div className="flex items-center justify-between gap-1">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
                {tip && <span className="opacity-50 group-hover:opacity-100 transition-opacity"><Explain k={tip} /></span>}
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5">{value}</div>
            {sub && <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{sub}</div>}
        </div>
    );
}

/** Capacity & Architecture Overview — engine-real facility metrics. */
export function CapacityArchOverview({ d }: { d: DashboardData }) {
    const rackDensity = d.racks && d.itLoadKw ? (d.itLoadKw / d.racks) : null;
    const coolingLabel: Record<string, string> = { air: 'Air (CRAC)', inrow: 'In-Row', rdhx: 'Rear-Door HX', liquid: 'Direct Liquid' };
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Capacity &amp; Architecture Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <TraceValue traceId="sim.itLoad"><Tile label="IT Load" value={`${d.itLoadMw.toFixed(1)} MW`} sub={`${d.itLoadKw.toLocaleString()} kW`} tip="it-load" /></TraceValue>
                <TraceValue traceId="arch.facilityMw"><Tile label="Facility Load" value={`${d.facilityLoadMw.toFixed(1)} MW`} sub={`PUE ${d.pue.toFixed(2)}`} tip="dc-power" /></TraceValue>
                <TraceValue traceId="capex.racks"><Tile label="Rack Count" value={d.racks != null ? d.racks.toLocaleString() : '—'} sub="racks" tip="rack" /></TraceValue>
                <TraceValue traceId="capex.rackDensity"><Tile label="Rack Density" value={rackDensity != null ? `${rackDensity.toFixed(1)} kW` : '—'} sub="per rack" tip="rack-density" /></TraceValue>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Tile label="Power Config" value={d.redundancy} sub="redundancy" tip="redundancy" />
                <Tile label="Cooling" value={coolingLabel[d.coolingType] || d.coolingType} tip="cooling-type" />
                <TraceValue traceId="engine.pueTier3"><Tile label="PUE Target" value={`≤ ${d.pue.toFixed(2)}`} sub="design" tip="pue" /></TraceValue>
                <TraceValue traceId="rel.systemAvailability"><Tile label="Availability" value={d.availabilityPct != null ? `${d.availabilityPct}%` : '—'} sub={d.availabilityTarget ? `target ${d.availabilityTarget}%` : 'Tier'} tip="availability" /></TraceValue>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">CAPEX/kW {fmtUsd(d.perKw)} · build {d.timelineMonths ?? '—'} mo</div>
        </div>
    );
}

export default CapacityArchOverview;
