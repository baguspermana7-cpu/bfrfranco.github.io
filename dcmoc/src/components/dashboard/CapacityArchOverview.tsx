'use client';

import React from 'react';
import { Explain } from '@/components/ui/Explain';
import type { DashboardData } from './useDashboardData';
import { TraceValue } from '@/components/ui/TraceValue';

const fmtUsd = (n: number | null) => n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

// value state → semantic color (instrument discipline: color MEANS something).
// good = data-green (metric meeting target), neutral = plain text. No decorative color.
const STATE_COLOR: Record<string, string> = {
    good: 'text-rz-data',
    neutral: 'text-slate-900 dark:text-white',
};

// `tip` = an RZ_EXPLAIN_DB glossary key (knowledge-DB sourced, NOT a hardcoded
// string). <Explain> renders nothing when the key is absent — safe to wire.
// Tile fills its grid cell (h-full) so every card is identical size; value is
// wrap-safe + capped so long values never spill the box.
function Tile({ label, value, sub, tip, state = 'neutral' }: { label: string; value: string; sub?: string; tip?: string; state?: 'good' | 'neutral' }) {
    return (
        <div className="group h-full flex flex-col overflow-hidden rounded bg-rz-elevated border border-rz-2 p-2.5 transition-colors hover:border-rz-info/60">
            <div className="flex items-center justify-between gap-1">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
                {tip && <span className="opacity-50 group-hover:opacity-100 transition-opacity"><Explain k={tip} /></span>}
            </div>
            <div className={`text-sm sm:text-[15px] font-bold tabular-nums leading-tight mt-0.5 min-w-0 break-words ${STATE_COLOR[state]}`}>{value}</div>
            {sub && <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{sub}</div>}
        </div>
    );
}

/** Capacity & Architecture Overview — engine-real facility metrics. */
export function CapacityArchOverview({ d }: { d: DashboardData }) {
    const rackDensity = d.racks && d.itLoadKw ? (d.itLoadKw / d.racks) : null;
    const coolingLabel: Record<string, string> = { air: 'Air (CRAC)', inrow: 'In-Row', rdhx: 'Rear-Door HX', liquid: 'Direct Liquid' };
    // availability meeting its target + an efficient PUE read as "good" (data-green).
    const availGood = d.availabilityPct != null && d.availabilityTarget != null && d.availabilityPct >= d.availabilityTarget;
    const pueGood = d.pue <= 1.3;
    return (
        <div className="rounded border border-rz-2 bg-rz-base/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Capacity &amp; Architecture Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 auto-rows-fr">
                <TraceValue traceId="sim.itLoad" className="block h-full w-full"><Tile label="IT Load" value={`${d.itLoadMw.toFixed(1)} MW`} sub={`${d.itLoadKw.toLocaleString()} kW`} tip="it-load" /></TraceValue>
                <TraceValue traceId="arch.facilityMw" className="block h-full w-full"><Tile label="Facility Load" value={`${d.facilityLoadMw.toFixed(1)} MW`} sub={`PUE ${d.pue.toFixed(2)}`} tip="dc-power" /></TraceValue>
                <TraceValue traceId="capex.racks" className="block h-full w-full"><Tile label="Rack Count" value={d.racks != null ? d.racks.toLocaleString() : '—'} sub="racks" tip="rack" /></TraceValue>
                <TraceValue traceId="capex.rackDensity" className="block h-full w-full"><Tile label="Rack Density" value={rackDensity != null ? `${rackDensity.toFixed(1)} kW` : '—'} sub="per rack" tip="rack-density" /></TraceValue>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 auto-rows-fr">
                <Tile label="Power Config" value={d.redundancy} sub="redundancy" tip="redundancy" />
                <Tile label="Cooling" value={coolingLabel[d.coolingType] || d.coolingType} tip="cooling-type" />
                <TraceValue traceId="engine.pueTier3" className="block h-full w-full"><Tile label="PUE Target" value={`≤ ${d.pue.toFixed(2)}`} sub="design" tip="pue" state={pueGood ? 'good' : 'neutral'} /></TraceValue>
                <TraceValue traceId="rel.systemAvailability" className="block h-full w-full"><Tile label="Availability" value={d.availabilityPct != null ? `${d.availabilityPct.toFixed(3)}%` : '—'} sub={d.availabilityTarget ? `target ${d.availabilityTarget}%` : 'Tier'} tip="availability" state={availGood ? 'good' : 'neutral'} /></TraceValue>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">CAPEX/kW {fmtUsd(d.perKw)} · build {d.timelineMonths ?? '—'} mo</div>
        </div>
    );
}

export default CapacityArchOverview;
