'use client';

import React from 'react';
import type { DashboardData } from './useDashboardData';

const fmtUsd = (n: number | null) => n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 p-2.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
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
            <div className="grid grid-cols-4 gap-2 mb-2">
                <Tile label="IT Load" value={`${d.itLoadMw.toFixed(1)} MW`} sub={`${d.itLoadKw.toLocaleString()} kW`} />
                <Tile label="Facility Load" value={`${d.facilityLoadMw.toFixed(1)} MW`} sub={`PUE ${d.pue.toFixed(2)}`} />
                <Tile label="Rack Count" value={d.racks != null ? d.racks.toLocaleString() : '—'} sub="racks" />
                <Tile label="Rack Density" value={rackDensity != null ? `${rackDensity.toFixed(1)} kW` : '—'} sub="per rack" />
            </div>
            <div className="grid grid-cols-4 gap-2">
                <Tile label="Power Config" value={d.redundancy} sub="redundancy" />
                <Tile label="Cooling" value={coolingLabel[d.coolingType] || d.coolingType} />
                <Tile label="PUE Target" value={`≤ ${d.pue.toFixed(2)}`} sub="design" />
                <Tile label="Availability" value={d.availabilityPct != null ? `${d.availabilityPct}%` : '—'} sub={d.availabilityTarget ? `target ${d.availabilityTarget}%` : 'Tier'} />
            </div>
            <div className="mt-2 text-[10px] text-slate-500">CAPEX/kW {fmtUsd(d.perKw)} · build {d.timelineMonths ?? '—'} mo</div>
        </div>
    );
}

export default CapacityArchOverview;
