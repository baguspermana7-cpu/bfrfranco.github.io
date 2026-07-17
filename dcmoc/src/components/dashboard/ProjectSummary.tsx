'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import type { DashboardData } from './useDashboardData';

/** Project Summary — a gradient "render" placeholder (never a fake photo) + the
 *  real project brief derived from inputs. */
export function ProjectSummary({ d }: { d: DashboardData }) {
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
            {/* gradient render placeholder */}
            <div className="relative h-28 rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-slate-800 via-cyan-900/40 to-blue-900/60 border border-white/10">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(34,211,238,0.4), transparent 45%), radial-gradient(circle at 70% 70%, rgba(167,139,250,0.3), transparent 40%)' }} />
                <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5 text-[10px] text-white/80">
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
