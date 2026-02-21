'use client';

import React, { useState } from 'react';
import { StaffingResult, ROLE_LABELS, StaffRole } from '@/modules/staffing/ShiftEngine';
import { Users, User, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

interface OrgChartProps {
    staffing: StaffingResult[];
    countryName: string;
}

interface NodeProps {
    role: string;
    count: number;
    color: string;
    salary?: number;
    turnoverRate?: number;
    utilization?: number;
    children?: React.ReactNode;
}

// Static color map — avoids dynamic Tailwind class generation issues
const COLOR_MAP: Record<string, { card: string; icon: string }> = {
    purple:  { card: 'bg-purple-950/30 border-purple-800',   icon: 'bg-purple-500/20 text-purple-400' },
    slate:   { card: 'bg-slate-800/30 border-slate-700',     icon: 'bg-slate-500/20 text-slate-400' },
    cyan:    { card: 'bg-cyan-950/30 border-cyan-800',       icon: 'bg-cyan-500/20 text-cyan-400' },
    blue:    { card: 'bg-blue-950/30 border-blue-800',       icon: 'bg-blue-500/20 text-blue-400' },
    emerald: { card: 'bg-emerald-950/30 border-emerald-800', icon: 'bg-emerald-500/20 text-emerald-400' },
    amber:   { card: 'bg-amber-950/30 border-amber-800',     icon: 'bg-amber-500/20 text-amber-400' },
};

// B2: Interactive OrgNode with click-to-expand detail
const OrgNode = ({ role, count, color, salary, turnoverRate, utilization, children }: NodeProps) => {
    const [expanded, setExpanded] = useState(false);

    const formatMoney = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

    return (
        <div className="flex flex-col items-center relative">
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700"></div>

            <div
                className={clsx(
                    "p-3 rounded-xl border w-52 transition-all hover:scale-105 hover:shadow-lg hover:shadow-cyan-900/20 z-10 cursor-pointer",
                    COLOR_MAP[color]?.card
                )}
                onClick={() => setExpanded(!expanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${COLOR_MAP[color]?.icon}`}>
                            <User className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                            {role}
                        </div>
                    </div>
                    {(salary || turnoverRate) && (
                        expanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    )}
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                    {count} <span className="text-xs text-slate-500 font-normal">FTEs</span>
                </div>

                {/* B2: Expanded detail panel */}
                {expanded && (salary || turnoverRate || utilization) && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50 space-y-1 text-xs">
                        {salary !== undefined && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Avg Salary</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-mono">{formatMoney(salary)}/mo</span>
                            </div>
                        )}
                        {turnoverRate !== undefined && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Turnover</span>
                                <span className={clsx("font-mono", turnoverRate > 0.20 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300")}>
                                    {(turnoverRate * 100).toFixed(0)}%
                                </span>
                            </div>
                        )}
                        {utilization !== undefined && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Utilization</span>
                                <span className="text-cyan-600 dark:text-cyan-400 font-mono">{(utilization * 100).toFixed(0)}%</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {children && (
                <>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="relative">
                        {/* Horizontal bar connecting siblings */}
                        {React.Children.count(children) > 1 && (
                            <div
                                className="absolute top-0 h-px bg-slate-700"
                                style={{ left: '104px', right: '104px' }}
                            />
                        )}
                        <div className="flex gap-8 items-start">
                            {children}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export function OrgChart({ staffing, countryName }: OrgChartProps) {
    const getCount = (role: string) => staffing.find(r => r.role === role)?.headcount || 0;
    const getSalary = (role: string) => staffing.find(r => r.role === role)?.monthlyCost
        ? (staffing.find(r => r.role === role)!.monthlyCost / Math.max(1, staffing.find(r => r.role === role)!.headcount))
        : undefined;

    const shiftLeads = getCount('shift-lead');
    const engineers = getCount('engineer');
    const technicians = getCount('technician');
    const admins = getCount('admin');
    const janitors = getCount('janitor');

    return (
        <div className="p-8 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Organization Structure ({countryName})
            </h3>

            <div className="flex flex-col items-center min-w-[800px]">
                <OrgNode role="Facility Manager" count={1} color="purple" salary={getSalary('shift-lead') ? (getSalary('shift-lead')! * 1.5) : undefined} utilization={0.95}>
                    <OrgNode role={ROLE_LABELS['admin']} count={admins} color="slate" salary={getSalary('admin')} utilization={0.80}>
                        <OrgNode role={ROLE_LABELS['shift-lead']} count={shiftLeads} color="cyan" salary={getSalary('shift-lead')} turnoverRate={0.10} utilization={0.90}>
                            <OrgNode role={ROLE_LABELS['engineer']} count={engineers} color="blue" salary={getSalary('engineer')} turnoverRate={0.15} utilization={0.85} />
                        </OrgNode>
                        <OrgNode role={ROLE_LABELS['technician']} count={technicians} color="emerald" salary={getSalary('technician')} turnoverRate={0.20} utilization={0.80} />
                        <OrgNode role={ROLE_LABELS['janitor']} count={janitors} color="amber" salary={getSalary('janitor')} turnoverRate={0.25} utilization={0.70} />
                    </OrgNode>
                </OrgNode>
            </div>

            <p className="text-center text-xs text-slate-500 mt-8 max-w-2xl mx-auto">
                Click any node to see detailed salary, turnover, and utilization data. Hierarchy assumes standard Tier III operational structure.
            </p>
        </div>
    );
}
