'use client';

import React from 'react';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import { Users, User, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

interface OrgChartProps {
    staffing: StaffingResult[];
    countryName: string;
}

interface NodeProps {
    role: string;
    count: number;
    color: string;
    children?: React.ReactNode;
    isLast?: boolean;
}

const OrgNode = ({ role, count, color, children, isLast }: NodeProps) => (
    <div className="flex flex-col items-center relative">
        {/* Connector Line Vertical (Top) */}
        <div className="h-6 w-px bg-slate-700"></div>

        {/* Card */}
        <div className={clsx("p-3 rounded-xl border w-48 transition-all hover:scale-105 hover:shadow-lg hover:shadow-cyan-900/20 z-10",
            `bg-${color}-950/30 border-${color}-800`
        )}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg bg-${color}-500/20 text-${color}-400`}>
                    <User className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    {role}
                </div>
            </div>
            <div className="text-xl font-bold text-white flex items-baseline gap-1">
                {count} <span className="text-xs text-slate-500 font-normal">FTEs</span>
            </div>
        </div>

        {/* Children Container */}
        {children && (
            <>
                <div className="h-6 w-px bg-slate-700"></div>

                {/* Connector Branch (Horizontal) */}
                <div className="flex gap-4 relative">
                    {/* Top Horizontal Bar logic would be here for perfect trees, keeping simple for now */}
                    <div className="flex gap-4 items-start">
                        {children}
                    </div>
                </div>
            </>
        )}
    </div>
);

export function OrgChart({ staffing, countryName }: OrgChartProps) {
    // Helper to find count
    const getCount = (role: string) => staffing.find(r => r.role === role)?.headcount || 0;

    const shiftLeads = getCount('shift-lead');
    const engineers = getCount('engineer');
    const technicians = getCount('technician');
    const admins = getCount('admin');
    const janitors = getCount('janitor');
    const security = (inputs: any) => 0; // Placeholder if we add security later

    return (
        <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
            <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Wait, who reports to whom? ({countryName})
            </h3>

            <div className="flex flex-col items-center min-w-[800px]">
                {/* Level 1: Site Manager (Implied/Single) or Admin */}
                <OrgNode role="Facility Manager" count={1} color="purple">
                    {/* Level 2: Shift Leads & Admin */}

                    {/* Admin Branch */}
                    <OrgNode role="Admin / Support" count={admins} color="slate" />

                    {/* Technical Branch */}
                    <OrgNode role="Shift Leads" count={shiftLeads} color="cyan">
                        {/* Level 3: Engineers */}
                        <OrgNode role="Duty Engineers" count={engineers} color="blue">
                            {/* Level 4: Technicians */}
                            <OrgNode role="Technicians" count={technicians} color="emerald">
                                {/* Level 5: Janitors (Often report to FM but structurally here for balance) */}
                                <OrgNode role="Caretakers" count={janitors} color="amber" />
                            </OrgNode>
                        </OrgNode>
                    </OrgNode>

                </OrgNode>
            </div>

            <p className="text-center text-xs text-slate-500 mt-8 max-w-2xl mx-auto">
                * Visual hierarchy assumes standard Tier III operational structure where Shift Leads manage 24/7 technical teams, while Admin/Support reports directly to Facility Management.
            </p>
        </div>
    );
}
