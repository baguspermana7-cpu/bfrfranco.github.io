'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { useCapexStore } from '@/store/capex';
import type { DashboardData } from './useDashboardData';

/** Project Summary — a gradient "render" placeholder (never a fake photo) + the
 *  real project brief derived from inputs. */
export function ProjectSummary({ d }: { d: DashboardData }) {
    const heroImage = useCapexStore((s) => s.heroImage);
    const hero = heroImage || '/dcmoc/hero-default.webp';
    const rows: [string, string][] = [
        ['Location', d.country],
        ['IT Capacity', `${d.itLoadMw.toFixed(1)} MW`],
        ['Tier / Redundancy', `Tier ${d.tier} · ${d.redundancy}`],
        ['Cooling', d.coolingType],
        ['Site Score', d.siteScore != null ? `${d.siteScore}/100` : '—'],
        ['Status', 'Design & Planning'],
    ];
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Project Summary</h2>
            {/* hero render — uploaded (CAPEX) or the default DC-OS render */}
            <div className="relative h-32 rounded-lg overflow-hidden mb-3 border border-white/10 bg-slate-900">
                <img src={hero} alt={`${d.country} data center campus`} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5 text-[11px] font-medium text-white drop-shadow">
                    <MapPin className="w-3 h-3" /> {d.country} · {d.itLoadMw.toFixed(0)} MW campus
                </div>
            </div>
            <table className="w-full text-xs">
                <tbody>
                    {rows.map(([k, v]) => (
                        <tr key={k} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                            <td className="py-1.5 text-slate-500 dark:text-slate-400">{k}</td>
                            <td className="py-1.5 text-right font-medium text-slate-800 dark:text-slate-200">{v}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default ProjectSummary;
