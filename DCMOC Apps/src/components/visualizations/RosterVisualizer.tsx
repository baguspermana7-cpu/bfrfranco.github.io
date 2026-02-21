'use client';

import React from 'react';
import { Calendar, Clock, Sun, Moon } from 'lucide-react';
import { RosterShift } from '@/modules/staffing/RosterEngine';
import clsx from 'clsx';
import { Tooltip } from '@/components/ui/Tooltip';

interface RosterVisualizerProps {
    roster: RosterShift[];
    year: number;
}

export function RosterVisualizer({ roster, year }: RosterVisualizerProps) {
    const [selectedRole, setSelectedRole] = React.useState<'team-a' | 'team-b' | 'team-c' | 'team-d'>('team-a');

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Simulate different starting offsets for teams
    const getShiftForRole = (date: Date, role: string) => {
        // Logic to shift pattern based on role
        // This is a visual simulation, so we just offset the roster implementation
        // Real app would have distinct rosters per person
        // Team A: No offset
        // Team B: Offset by 2 days
        // Team C: Offset by 4 days
        // Team D: Offset by 6 days
        let offset = 0;
        if (role === 'team-b') offset = 2;
        if (role === 'team-c') offset = 4;
        if (role === 'team-d') offset = 6;

        // Find the shift from the base roster with offset
        // Simple hack: We just look at roster[index + offset] (wrapping around)
        const dayOfYear = Math.floor((date.getTime() - new Date(year, 0, 0).getTime()) / 1000 / 60 / 60 / 24) - 1;
        const targetIndex = (dayOfYear + offset) % roster.length;
        return roster[targetIndex] || roster[dayOfYear]; // Fallback
    };

    // Calculate Weekly Average
    const weeklyAverage = React.useMemo(() => {
        const totalHours = roster.reduce((sum, day) => sum + (day.hours || 0), 0);
        return (totalHours / 52).toFixed(1);
    }, [roster]);

    // Helper to get color for shift type
    const getShiftColor = (type: string) => {
        switch (type) {
            case 'Morning': return 'bg-cyan-500/80 hover:bg-cyan-400';
            case 'Day': return 'bg-cyan-500/80 hover:bg-cyan-400'; // Added Day alias
            case 'Afternoon': return 'bg-blue-600/80 hover:bg-blue-500'; // Added Afternoon
            case 'Night': return 'bg-indigo-600/80 hover:bg-indigo-500';
            case 'Swing': return 'bg-amber-500/80 hover:bg-amber-400';
            case 'None': return 'bg-slate-800/50 hover:bg-slate-800'; // OFF
            default: return 'bg-slate-800/50';
        }
    };

    return (
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    Annual Shift Pattern ({year})
                </h3>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-400 text-sm">Avg:</span>
                        <span className="text-white font-mono font-bold">{weeklyAverage}h / week</span>
                    </div>

                    <select
                        className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as any)}
                    >
                        <option value="team-a">Team A (Shift Lead)</option>
                        <option value="team-b">Team B (Engineer)</option>
                        <option value="team-c">Team C (Tech 1)</option>
                        <option value="team-d">Team D (Tech 2)</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                    <span className="text-slate-300">Morning (06-14)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded"></div>
                    <span className="text-slate-300">Afternoon (14-22)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-600 rounded"></div>
                    <span className="text-slate-300">Night (22-06)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-800 border border-slate-700 rounded"></div>
                    <span className="text-slate-500">Off Duty</span>
                </div>
            </div>

            <div className="overflow-x-auto pb-4">
                <div className="min-w-[1200px] grid grid-rows-12 gap-1">
                    {months.map((month, monthIdx) => {
                        // Filter days for this month for pure calendar rendering
                        // But looking up shift from the 'selectedRole' logic
                        const daysInMonthBase = roster.filter(r => r.date.getMonth() === monthIdx);

                        return (
                            <div key={month} className="grid grid-cols-[60px_1fr] gap-2 items-center">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-right pr-2">
                                    {month}
                                </div>
                                <div className="flex gap-px h-8 bg-slate-950/50 rounded-md overflow-hidden border border-slate-800/50">
                                    {daysInMonthBase.map((dayBase, dayIdx) => {
                                        const actualShift = getShiftForRole(dayBase.date, selectedRole);

                                        return (
                                            <div
                                                key={dayIdx}
                                                className={clsx(
                                                    "flex-1 relative group transition-colors",
                                                    getShiftColor(actualShift.shiftType)
                                                )}
                                            >
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-xs p-2 rounded border border-slate-700 whitespace-nowrap hidden group-hover:block z-50 shadow-xl">
                                                    <div className="font-bold text-white">{actualShift.date.toDateString()}</div>
                                                    <div className="text-cyan-400">{actualShift.shiftType === 'None' ? 'OFF' : actualShift.shiftType + ' Shift'}</div>
                                                    <div className="text-slate-500 pt-1 border-t border-slate-800 mt-1">
                                                        Hours: {actualShift.hours} | Cost: ${actualShift.dailyCost?.toFixed(0)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className="text-xs text-slate-500 mt-2 text-center">
                Visualizing schedule for <span className="text-white font-medium">{selectedRole.toUpperCase().replace('-', ' ')}</span>.
                Pattern rotates every 28 days.
            </p>
        </div>
    );
}
