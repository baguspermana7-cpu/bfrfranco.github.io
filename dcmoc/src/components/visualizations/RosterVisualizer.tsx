'use client';

import React from 'react';
import { Calendar, Clock, Sun, Moon, BarChart3 } from 'lucide-react';
import { RosterShift } from '@/modules/staffing/RosterEngine';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import clsx from 'clsx';
import { Tooltip } from '@/components/ui/Tooltip';

interface RosterVisualizerProps {
    roster: RosterShift[];
    year: number;
    shiftModel: '8h' | '12h';
    staffingResults?: StaffingResult[];
}

export function RosterVisualizer({ roster, year, shiftModel, staffingResults }: RosterVisualizerProps) {
    const [selectedRole, setSelectedRole] = React.useState<string>('team-a');

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

    // Calculate Weekly Average (effective hours after break deduction)
    const weeklyAverage = React.useMemo(() => {
        const effectiveHours = roster.reduce((sum, day) => {
            if (day.hours === 12) return sum + 10;  // 12h - 2h break
            if (day.hours === 8) return sum + 7.5;  // 8h - 30min break
            return sum;
        }, 0);
        return (effectiveHours / 52).toFixed(1);
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
                        <option value="team-a">Team A</option>
                        <option value="team-b">Team B</option>
                        <option value="team-c">Team C</option>
                        <option value="team-d">Team D</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-4 mb-4 text-sm">
                {shiftModel === '8h' ? (
                    <>
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
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                            <span className="text-slate-300">Day (06-18)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-indigo-600 rounded"></div>
                            <span className="text-slate-300">Night (18-06)</span>
                        </div>
                    </>
                )}
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
                                {/* B8: Increased cell height from 8 to 12px min */}
                                <div className="flex gap-px h-12 bg-slate-950/50 rounded-md overflow-hidden border border-slate-800/50">
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
                Each team = 1 Team Leader + 1 Engineer (2 pax/shift).
                {shiftModel === '12h' ? ' 7' : ' 8'}-day cycle.
            </p>

            {/* ── Man-Hours Summary ── */}
            {staffingResults && (() => {
                // Shift staff (24/7): Team Leaders + Engineers
                const shiftTL = staffingResults.find(r => r.role === 'shift-lead')?.headcount || 0;
                const shiftEng = staffingResults.find(r => r.role === 'engineer')?.headcount || 0;
                const totalShiftStaff = shiftTL + shiftEng;
                const teamsRequired = staffingResults.find(r => r.is24x7)?.schedule.teamsRequired || 4;
                const paxPerTeam = Math.max(1, Math.ceil(totalShiftStaff / teamsRequired));

                // Effective hours per shift
                const effPerShift = shiftModel === '12h' ? 10 : 7.5;
                const schedPerShift = shiftModel === '12h' ? 12 : 8;
                const shiftsPerDay = shiftModel === '12h' ? 2 : 3;

                // Shift man-hours per day (24/7, every day)
                const shiftManHoursScheduled = paxPerTeam * shiftsPerDay * schedPerShift;
                const shiftManHoursEffective = paxPerTeam * shiftsPerDay * effPerShift;

                // Day shift staff (Mon-Fri only): Technicians + Supervisor + Facility
                const techs = staffingResults.find(r => r.role === 'technician')?.headcount || 0;
                const admins = staffingResults.find(r => r.role === 'admin')?.headcount || 0;
                const janitors = staffingResults.find(r => r.role === 'janitor')?.headcount || 0;
                const dayStaffCount = techs + admins + janitors;
                const dayStaffHoursScheduled = dayStaffCount * 8;
                const dayStaffHoursEffective = dayStaffCount * 7.5;

                // Daily totals
                const weekdayScheduled = shiftManHoursScheduled + dayStaffHoursScheduled;
                const weekdayEffective = shiftManHoursEffective + dayStaffHoursEffective;
                const weekendScheduled = shiftManHoursScheduled;
                const weekendEffective = shiftManHoursEffective;

                // Annual: count weekdays vs weekends
                const weekdays = 261; // typical working days
                const weekends = 104;
                const annualScheduled = (weekdayScheduled * weekdays) + (weekendScheduled * weekends);
                const annualEffective = (weekdayEffective * weekdays) + (weekendEffective * weekends);

                return (
                    <div className="mt-6 p-5 bg-slate-950/50 border border-slate-800 rounded-xl">
                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-cyan-400" />
                            Man-Hours Summary
                        </h4>

                        {/* Team composition note */}
                        <div className="text-xs text-slate-500 mb-4 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800/50">
                            <span className="text-cyan-400 font-medium">Shift (24/7):</span> {teamsRequired} teams × {paxPerTeam} pax (1 TL + 1 Eng) = {totalShiftStaff} FTE &nbsp;|&nbsp;
                            <span className="text-emerald-400 font-medium">Day (M-F):</span> {techs} Tech + {admins} Supervisor + {janitors} Facility = {dayStaffCount} FTE
                        </div>

                        {/* Daily breakdown */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Weekday (Mon-Fri)</div>
                                <div className="text-xl font-bold text-cyan-400 font-mono">{weekdayEffective.toFixed(1)}h</div>
                                <div className="text-[10px] text-slate-600">effective / day</div>
                                <div className="text-[10px] text-slate-600 mt-1">
                                    Shift: {shiftManHoursEffective}h + Day: {dayStaffHoursEffective}h
                                </div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Weekend (Sat-Sun)</div>
                                <div className="text-xl font-bold text-indigo-400 font-mono">{weekendEffective.toFixed(1)}h</div>
                                <div className="text-[10px] text-slate-600">effective / day</div>
                                <div className="text-[10px] text-slate-600 mt-1">
                                    Shift only: {shiftManHoursEffective}h (no day staff)
                                </div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Scheduled / Day</div>
                                <div className="text-xl font-bold text-amber-400 font-mono">{weekdayScheduled.toFixed(0)}h</div>
                                <div className="text-[10px] text-slate-600">weekday (before breaks)</div>
                                <div className="text-[10px] text-slate-600 mt-1">
                                    {weekendScheduled.toFixed(0)}h weekend
                                </div>
                            </div>
                            <div className="bg-cyan-950/30 rounded-lg p-3 border border-cyan-800/50">
                                <div className="text-[10px] text-cyan-500 uppercase font-bold">Annual Total</div>
                                <div className="text-xl font-bold text-white font-mono">{(annualEffective / 1000).toFixed(1)}K</div>
                                <div className="text-[10px] text-slate-600">effective man-hours / year</div>
                                <div className="text-[10px] text-slate-600 mt-1">
                                    {(annualScheduled / 1000).toFixed(1)}K scheduled
                                </div>
                            </div>
                        </div>

                        {/* Detailed annual breakdown */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-500 uppercase font-bold border-b border-slate-800">
                                        <th className="py-2 text-left">Component</th>
                                        <th className="py-2 text-center">Staff</th>
                                        <th className="py-2 text-right">Hours/Day</th>
                                        <th className="py-2 text-right">Days/Year</th>
                                        <th className="py-2 text-right">Man-Hours/Year</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    <tr>
                                        <td className="py-2 text-slate-300">Shift Staff (24/7)</td>
                                        <td className="py-2 text-center text-cyan-400 font-mono">{paxPerTeam * shiftsPerDay}</td>
                                        <td className="py-2 text-right font-mono text-slate-400">{shiftManHoursEffective.toFixed(1)}</td>
                                        <td className="py-2 text-right font-mono text-slate-400">365</td>
                                        <td className="py-2 text-right font-mono text-white font-bold">{(shiftManHoursEffective * 365).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 text-slate-300">Day Staff (Mon-Fri)</td>
                                        <td className="py-2 text-center text-emerald-400 font-mono">{dayStaffCount}</td>
                                        <td className="py-2 text-right font-mono text-slate-400">{dayStaffHoursEffective.toFixed(1)}</td>
                                        <td className="py-2 text-right font-mono text-slate-400">{weekdays}</td>
                                        <td className="py-2 text-right font-mono text-white font-bold">{(dayStaffHoursEffective * weekdays).toLocaleString()}</td>
                                    </tr>
                                    <tr className="border-t border-slate-700 font-bold">
                                        <td className="py-2 text-white">TOTAL</td>
                                        <td className="py-2 text-center text-cyan-400 font-mono">{totalShiftStaff + dayStaffCount}</td>
                                        <td className="py-2 text-right font-mono text-slate-400">—</td>
                                        <td className="py-2 text-right font-mono text-slate-400">—</td>
                                        <td className="py-2 text-right font-mono text-cyan-400">{annualEffective.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
