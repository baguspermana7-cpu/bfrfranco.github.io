'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateStaffing, StaffingResult, ShiftPattern, SHIFT_PATTERNS, ROLE_LABELS, StaffRole } from '@/modules/staffing/ShiftEngine';
import { generateMaintenanceSchedule } from '@/modules/maintenance/ScheduleEngine';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { assignWorkOrders, buildPersonProfiles, PersonProfile, PersonalWorkOrder, generateStaffList } from '@/modules/staffing/WorkOrderEngine';
import {
    Users, Calendar, BarChart3, Clock, AlertTriangle, CheckCircle2, ChevronDown,
    Wrench, ArrowUpDown, Filter
} from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '@/components/ui/Tooltip';

export function WorkOrderView() {
    const { selectedCountry, inputs } = useSimulationStore();
    const { inputs: capexInputs } = useCapexStore();
    const [selectedPerson, setSelectedPerson] = useState<string>('all');
    const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = all weeks
    const [viewMode, setViewMode] = useState<'calendar' | 'load' | 'summary'>('summary');

    const data = useMemo(() => {
        if (!selectedCountry) return null;

        // Build staffing results for all roles
        const patternId: ShiftPattern = inputs.shiftModel === '12h' ? '4on4off' : 'continental-8h';
        const staffResults: StaffingResult[] = [
            calculateStaffing('shift-lead', inputs.headcount_ShiftLead, inputs.shiftModel, selectedCountry, true, patternId),
            calculateStaffing('engineer', inputs.headcount_Engineer, inputs.shiftModel, selectedCountry, true, patternId),
            calculateStaffing('technician', inputs.headcount_Technician, inputs.shiftModel, selectedCountry, false),
            calculateStaffing('supervisor', inputs.headcount_Admin, inputs.shiftModel, selectedCountry, false),
            calculateStaffing('janitor', inputs.headcount_Janitor, inputs.shiftModel, selectedCountry, false),
        ];

        // Generate maintenance events (use simulation store for consistency)
        const estBuildingArea = inputs.itLoad * 0.6;
        const coolingMap: 'air' | 'pumped' = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx' ? 'pumped' : 'air';
        const assets = generateAssetCounts(
            inputs.itLoad,
            inputs.tierLevel === 4 ? 4 : 3,
            coolingMap,
            Math.ceil(estBuildingArea),
            inputs.coolingTopology,
            inputs.powerRedundancy
        );
        const schedule = generateMaintenanceSchedule(assets);

        // Assign WOs to staff
        const assignments = assignWorkOrders(schedule, staffResults, patternId);
        const profiles = buildPersonProfiles(assignments);
        const staffList = generateStaffList(staffResults);

        return { assignments, profiles, staffList, schedule, staffResults };
    }, [selectedCountry, inputs, capexInputs]);

    if (!selectedCountry || !data) return <div className="text-slate-400 p-8">Select a country to view work orders.</div>;

    const { profiles, staffList, assignments, schedule } = data;

    // Filter profiles
    const filteredProfiles = selectedPerson === 'all'
        ? profiles
        : profiles.filter(p => p.personId === selectedPerson);

    // Get weekly data for selected person
    const getPersonWeekData = (personId: string, weekNum: number) => {
        return assignments.filter(a => a.personId === personId && a.weekNumber === weekNum);
    };

    // Load distribution data (hours per person across all weeks)
    const loadDistribution = profiles.map(p => ({
        personId: p.personId,
        personName: p.personName,
        role: p.role,
        team: p.team,
        totalHours: p.annualStats.totalWOHours,
        totalWOs: p.annualStats.totalWOCount,
        avgWeekly: p.annualStats.avgWeeklyWOHours,
        busiestWeek: p.annualStats.busiestWeek,
        workWeeks: p.annualStats.workWeeks,
    })).sort((a, b) => b.totalHours - a.totalHours);

    const maxTotalHours = Math.max(...loadDistribution.map(d => d.totalHours), 1);

    // B19: Calculate consecutive weeks with >80% utilization for overload alerts
    const overloadAlerts = useMemo(() => {
        const alerts: { personName: string; personId: string; consecutiveWeeks: number; startWeek: number }[] = [];
        for (const profile of profiles) {
            const personAssignments = assignments.filter(a => a.personId === profile.personId);
            // Build a map of week -> utilization
            const weekUtils: Record<number, number> = {};
            for (const a of personAssignments) {
                weekUtils[a.weekNumber] = a.utilizationPercent;
            }
            // Find max consecutive run of >80% utilization
            let maxRun = 0;
            let maxRunStart = 0;
            let currentRun = 0;
            let currentRunStart = 0;
            for (let w = 1; w <= 52; w++) {
                if ((weekUtils[w] || 0) > 80) {
                    if (currentRun === 0) currentRunStart = w;
                    currentRun++;
                    if (currentRun > maxRun) {
                        maxRun = currentRun;
                        maxRunStart = currentRunStart;
                    }
                } else {
                    currentRun = 0;
                }
            }
            if (maxRun >= 4) {
                alerts.push({
                    personName: profile.personName,
                    personId: profile.personId,
                    consecutiveWeeks: maxRun,
                    startWeek: maxRunStart,
                });
            }
        }
        return alerts.sort((a, b) => b.consecutiveWeeks - a.consecutiveWeeks);
    }, [profiles, assignments]);

    return (
        <div className="space-y-6">
            {/* B19: Overload Alert Banner */}
            {overloadAlerts.length > 0 && (
                <div className={clsx(
                    "border rounded-xl p-4",
                    overloadAlerts.some(a => a.consecutiveWeeks >= 8)
                        ? "bg-red-950/40 border-red-700/60"
                        : "bg-amber-950/40 border-amber-700/60"
                )}>
                    <div className="flex items-start gap-3">
                        <AlertTriangle className={clsx(
                            "w-5 h-5 flex-shrink-0 mt-0.5",
                            overloadAlerts.some(a => a.consecutiveWeeks >= 8) ? "text-red-400" : "text-amber-400"
                        )} />
                        <div className="flex-1">
                            <h4 className={clsx(
                                "text-sm font-bold uppercase tracking-wider mb-2",
                                overloadAlerts.some(a => a.consecutiveWeeks >= 8) ? "text-red-400" : "text-amber-400"
                            )}>
                                Workload Overload Alert<Tooltip content="Staff members with utilization exceeding 80% for 4+ consecutive weeks. Sustained overload increases error risk, safety incidents, and staff burnout." />
                            </h4>
                            <div className="space-y-1.5">
                                {overloadAlerts.map(alert => (
                                    <div
                                        key={alert.personId}
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2 transition-colors"
                                        onClick={() => { setSelectedPerson(alert.personId); setViewMode('calendar'); }}
                                    >
                                        <span className={clsx(
                                            "w-2 h-2 rounded-full flex-shrink-0",
                                            alert.consecutiveWeeks >= 8 ? "bg-red-500" : "bg-amber-500"
                                        )} />
                                        <span className="text-slate-300">
                                            <span className="text-white font-medium">{alert.personName}</span>
                                            {' '}&mdash; Utilization has exceeded 80% for{' '}
                                            <span className={clsx(
                                                "font-bold",
                                                alert.consecutiveWeeks >= 8 ? "text-red-400" : "text-amber-400"
                                            )}>
                                                {alert.consecutiveWeeks} consecutive weeks
                                            </span>
                                            {' '}(starting Week {alert.startWeek})
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Sustained high utilization increases error risk and staff burnout. Consider redistributing workload or adding headcount.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <Tooltip content="Filter work orders by staff member. Select a person to view their individual workload, calendar, and assigned tasks." />
                    <select
                        value={selectedPerson}
                        onChange={(e) => setSelectedPerson(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-2 focus:ring-cyan-500"
                    >
                        <option value="all">All Staff ({staffList.length} people)</option>
                        {staffList.map(s => (
                            <option key={s.personId} value={s.personId}>
                                {s.personName} ({s.team})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <Tooltip content="Filter by specific week number (1-52) to inspect work order distribution and utilization for that period." />
                    <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-2 focus:ring-cyan-500"
                    >
                        <option value={0}>All Weeks</option>
                        {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                            <option key={w} value={w}>Week {w}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden ml-auto">
                    {(['summary', 'load', 'calendar'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={clsx(
                                'px-3 py-2 text-xs font-medium capitalize transition-colors',
                                viewMode === mode
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            )}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase mb-1">Total WOs/Year<Tooltip content="Total number of scheduled and reactive work orders generated annually based on your asset inventory and maintenance intervals." /></div>
                    <div className="text-2xl font-bold text-white">{schedule.length}</div>
                    <div className="text-xs text-slate-400">{(schedule.length / 52).toFixed(1)}/week avg</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase mb-1">Total WO Hours<Tooltip content="Cumulative labor hours required to complete all work orders in a year. Includes diagnosis, execution, and close-out time per task." /></div>
                    <div className="text-2xl font-bold text-white">
                        {profiles.reduce((a, p) => a + p.annualStats.totalWOHours, 0).toFixed(0)}h
                    </div>
                    <div className="text-xs text-slate-400">maintenance labor</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase mb-1">Avg Load/Person<Tooltip content="Average weekly maintenance hours per staff member. Values above 20h/wk may indicate understaffing or uneven workload distribution." /></div>
                    <div className="text-2xl font-bold text-white">
                        {profiles.length > 0
                            ? (profiles.reduce((a, p) => a + p.annualStats.avgWeeklyWOHours, 0) / profiles.length).toFixed(1)
                            : 0}h/wk
                    </div>
                    <div className="text-xs text-slate-400">maintenance work</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase mb-1">Staff Count<Tooltip content="Total number of operations staff available for work order assignment across all roles and shift teams." /></div>
                    <div className="text-2xl font-bold text-white">{staffList.length}</div>
                    <div className="text-xs text-slate-400">{profiles.filter(p => p.annualStats.totalWOCount > 0).length} with WOs</div>
                </div>
            </div>

            {/* ─── SUMMARY VIEW ─────────────────────────── */}
            {viewMode === 'summary' && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800">
                        <h3 className="text-lg font-bold text-white">Person-Level Annual Summary<Tooltip content="Comprehensive breakdown of work order assignments per staff member for the full year. Click any row to drill into their weekly calendar." /></h3>
                        <p className="text-xs text-slate-400 mt-1">Work order load distribution per staff member</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-950/50">
                                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Person<Tooltip content="Staff member name. Click any row to view their detailed weekly calendar and work order breakdown." /></th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Role<Tooltip content="Operational role assigned to this staff member (e.g., Shift Lead, Engineer, Technician, Supervisor, Janitor)." /></th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Team<Tooltip content="Shift team assignment (e.g., Team A, Team B). Teams rotate based on the configured shift pattern." /></th>
                                    <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium">WOs/Year<Tooltip content="Total number of work orders assigned to this person annually. Includes preventive, corrective, and statutory tasks." /></th>
                                    <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium">Total Hours<Tooltip content="Cumulative maintenance labor hours for this person across the entire year. High values may indicate overloading." /></th>
                                    <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium">Avg hrs/wk<Tooltip content="Average weekly maintenance hours. Calculated as total annual hours divided by working weeks. Sustained values above 20h suggest redistribution needed." /></th>
                                    <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium">Busiest Week<Tooltip content="The week number with the highest work order load for this person. Useful for identifying scheduling peaks and potential conflicts." /></th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Load<Tooltip content="Visual bar showing relative workload compared to the busiest staff member. Red indicates over 80% of max load, amber over 50%." /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProfiles.map(profile => {
                                    const loadPct = maxTotalHours > 0 ? (profile.annualStats.totalWOHours / maxTotalHours) * 100 : 0;
                                    return (
                                        <tr key={profile.personId} className="border-t border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                                            onClick={() => { setSelectedPerson(profile.personId); setViewMode('calendar'); }}>
                                            <td className="px-4 py-3 text-white font-medium">{profile.personName}</td>
                                            <td className="px-4 py-3 text-slate-400 capitalize">{ROLE_LABELS[profile.role as StaffRole] || profile.role}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-300">{profile.team}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-cyan-400">{profile.annualStats.totalWOCount}</td>
                                            <td className="px-4 py-3 text-center font-mono text-white">{profile.annualStats.totalWOHours.toFixed(1)}</td>
                                            <td className="px-4 py-3 text-center font-mono text-slate-300">{profile.annualStats.avgWeeklyWOHours.toFixed(1)}</td>
                                            <td className="px-4 py-3 text-center font-mono text-amber-400">Wk {profile.annualStats.busiestWeek}</td>
                                            <td className="px-4 py-3 w-32">
                                                <div className="w-full bg-slate-800 rounded-full h-2">
                                                    <div
                                                        className={clsx(
                                                            'h-2 rounded-full transition-all',
                                                            loadPct > 80 ? 'bg-red-500' : loadPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                                        )}
                                                        style={{ width: `${Math.max(2, loadPct)}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── LOAD CHART VIEW ─────────────────────── */}
            {viewMode === 'load' && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Annual WO Hours Distribution<Tooltip content="Horizontal bar chart ranking all staff by total annual maintenance hours. Red bars indicate over 80% of max load, amber over 50%. Helps identify uneven workload distribution." /></h3>
                    <div className="space-y-2">
                        {loadDistribution.map(person => {
                            const barWidth = maxTotalHours > 0 ? (person.totalHours / maxTotalHours) * 100 : 0;
                            return (
                                <div key={person.personId} className="flex items-center gap-3">
                                    <div className="w-32 text-sm text-slate-300 truncate">{person.personName}</div>
                                    <div className="flex-1 bg-slate-800 rounded-full h-6 relative overflow-hidden">
                                        <div
                                            className={clsx(
                                                'h-6 rounded-full flex items-center justify-end px-2 transition-all',
                                                barWidth > 80 ? 'bg-gradient-to-r from-red-600 to-red-500' :
                                                    barWidth > 50 ? 'bg-gradient-to-r from-amber-600 to-amber-500' :
                                                        'bg-gradient-to-r from-emerald-600 to-cyan-500'
                                            )}
                                            style={{ width: `${Math.max(3, barWidth)}%` }}
                                        >
                                            <span className="text-xs text-white font-mono">{person.totalHours.toFixed(0)}h</span>
                                        </div>
                                    </div>
                                    <div className="w-20 text-xs text-slate-500 text-right">{person.totalWOs} WOs</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── CALENDAR VIEW (Per Person) ─────────── */}
            {viewMode === 'calendar' && selectedPerson !== 'all' && (
                <PersonCalendar
                    profile={filteredProfiles[0]}
                    assignments={assignments.filter(a => a.personId === selectedPerson)}
                    selectedWeek={selectedWeek}
                />
            )}

            {viewMode === 'calendar' && selectedPerson === 'all' && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400">Select a specific person to view their weekly calendar.</p>
                    <p className="text-xs text-slate-500 mt-1">Use the dropdown above or click a row in the Summary view.</p>
                </div>
            )}
        </div>
    );
}

// ─── Sub-component: Person Calendar ─────────────────────────
function PersonCalendar({
    profile,
    assignments,
    selectedWeek
}: {
    profile?: PersonProfile;
    assignments: PersonalWorkOrder[];
    selectedWeek: number;
}) {
    if (!profile) return null;

    const weeksToShow = selectedWeek > 0
        ? assignments.filter(a => a.weekNumber === selectedWeek)
        : assignments.filter(a => a.workOrders.length > 0).slice(0, 20); // Show top 20 busy weeks

    return (
        <div className="space-y-4">
            {/* Person Header */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">{profile.personName}</h3>
                    <p className="text-sm text-slate-400">{profile.team} · {ROLE_LABELS[profile.role as StaffRole] || profile.role} </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-xl font-bold text-cyan-400">{profile.annualStats.totalWOCount}</div>
                        <div className="text-xs text-slate-500">WOs/Year<Tooltip content="Total work orders assigned to this person for the year, including preventive, corrective, and statutory maintenance tasks." /></div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white">{profile.annualStats.totalWOHours.toFixed(0)}h</div>
                        <div className="text-xs text-slate-500">Total Hours<Tooltip content="Cumulative maintenance labor hours across all 52 weeks. Includes task execution, documentation, and close-out time." /></div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-amber-400">{profile.annualStats.avgWeeklyWOHours.toFixed(1)}h</div>
                        <div className="text-xs text-slate-500">Avg/Week<Tooltip content="Mean weekly maintenance hours for this person. Calculated as total hours divided by active working weeks in the shift pattern." /></div>
                    </div>
                </div>
            </div>

            {/* Week Cards */}
            {weeksToShow.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    {selectedWeek > 0
                        ? `No work orders assigned in Week ${selectedWeek}`
                        : 'No work orders assigned to this person'}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {weeksToShow.map(week => (
                        <div key={`${week.personId}-${week.weekNumber}`}
                            className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-cyan-400" />
                                    <span className="font-bold text-white">Week {week.weekNumber}</span>
                                </div>
                                <span className={clsx(
                                    'px-2 py-1 rounded text-xs font-medium',
                                    week.status === 'overloaded' ? 'bg-red-900/50 text-red-400' :
                                        week.status === 'normal' ? 'bg-emerald-900/50 text-emerald-400' :
                                            'bg-slate-800 text-slate-400'
                                )}>
                                    {week.totalWOHours.toFixed(1)}h / {week.shiftHoursAvailable.toFixed(0)}h
                                </span>
                            </div>
                            <div className="space-y-2">
                                {week.workOrders.map((wo, i) => (
                                    <div key={`${wo.id}-${i}`}
                                        className="flex items-center gap-3 p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                        <div
                                            className="w-2 h-8 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: wo.color }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium truncate">{wo.assetName}</div>
                                            <div className="text-xs text-slate-400 truncate">{wo.taskName}</div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-mono text-cyan-400">{wo.durationHours}h</div>
                                            <div className={clsx(
                                                'text-xs',
                                                wo.criticality === 'Statutory' ? 'text-red-400' :
                                                    wo.criticality === 'Optimal' ? 'text-blue-400' : 'text-slate-500'
                                            )}>
                                                {wo.criticality}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Utilization bar */}
                            <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                                    <div
                                        className={clsx(
                                            'h-1.5 rounded-full',
                                            week.utilizationPercent > 90 ? 'bg-red-500' :
                                                week.utilizationPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                        )}
                                        style={{ width: `${Math.min(100, Math.max(2, week.utilizationPercent))}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-500">{week.utilizationPercent.toFixed(0)}% util<Tooltip content="Weekly utilization: ratio of assigned WO hours to available shift hours. Above 90% is overloaded (red), 60-90% is moderate (amber)." /></span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
