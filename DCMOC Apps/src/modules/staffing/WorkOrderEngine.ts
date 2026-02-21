import { MaintenanceEvent } from '@/modules/maintenance/ScheduleEngine';
import { StaffingResult, StaffRole, SHIFT_PATTERNS, ShiftPattern } from '@/modules/staffing/ShiftEngine';
import { RosterShift } from '@/modules/staffing/RosterEngine';

// ═══════════════════════════════════════════════════════════════
// WORK ORDER ENGINE — Per-Person Assignment
// ═══════════════════════════════════════════════════════════════

export interface WorkOrder {
    id: string;
    assetName: string;
    taskName: string;
    taskId: string;
    category: string;
    criticality: string;
    durationHours: number;
    techsRequired: number;
    weekNumber: number;
    color: string;
}

export interface PersonalWorkOrder {
    personId: string;        // e.g., "TL-1", "ENG-3"
    personName: string;      // e.g., "Team Leader 1", "Engineer 3"
    role: StaffRole;
    team: string;            // e.g., "Team A", "Team B"
    weekNumber: number;
    workOrders: WorkOrder[];
    totalWOHours: number;
    shiftHoursAvailable: number;  // How many hours on-shift this week
    utilizationPercent: number;   // WO hours / available hours
    status: 'underloaded' | 'normal' | 'overloaded';
}

export interface PersonProfile {
    personId: string;
    personName: string;
    role: StaffRole;
    team: string;
    weeklySchedule: {
        weekNumber: number;
        isOnDuty: boolean;
        shiftType: string;
        workOrders: WorkOrder[];
        totalWOHours: number;
        availableHours: number;
    }[];
    annualStats: {
        totalWOCount: number;
        totalWOHours: number;
        avgWeeklyWOHours: number;
        busiestWeek: number;
        busiestWeekHours: number;
        workWeeks: number;
    };
}

// ─── GENERATE NAMED STAFF LIST ──────────────────────────────
export const generateStaffList = (
    staffingResults: StaffingResult[]
): { personId: string; personName: string; role: StaffRole; team: string; is24x7: boolean }[] => {
    const staff: { personId: string; personName: string; role: StaffRole; team: string; is24x7: boolean }[] = [];

    const roleLabels: Record<StaffRole, string> = {
        'supervisor': 'Supervisor',
        'shift-lead': 'Team Leader',
        'engineer': 'Engineer',
        'technician': 'Technician',
        'admin': 'Admin',
        'janitor': 'Facility Staff',
    };

    staffingResults.forEach(result => {
        const label = roleLabels[result.role] || result.role;
        const is24x7 = result.schedule.teamsRequired > 1;
        const teams = result.schedule.teamsRequired;

        for (let i = 0; i < result.headcount; i++) {
            const teamIdx = i % teams;
            const teamName = teams > 1 ? `Team ${String.fromCharCode(65 + teamIdx)}` : 'Day Shift';
            const rolePrefix = result.role === 'shift-lead' ? 'TL' :
                result.role === 'engineer' ? 'ENG' :
                    result.role === 'technician' ? 'TECH' :
                        result.role === 'supervisor' ? 'SUP' :
                            result.role === 'janitor' ? 'FAC' : 'ADM';

            staff.push({
                personId: `${rolePrefix}-${i + 1}`,
                personName: `${label} ${i + 1}`,
                role: result.role,
                team: teamName,
                is24x7,
            });
        }
    });

    return staff;
};

// ─── DETERMINE ON-DUTY WEEKS ────────────────────────────────
const getOnDutyWeeks = (
    team: string,
    patternId: ShiftPattern,
    totalWeeks: number = 52
): Set<number> => {
    const onDutyWeeks = new Set<number>();
    const pattern = SHIFT_PATTERNS[patternId];

    if (patternId === 'continental-8h') {
        // 4 teams, 3 on + 1 off. Each team gets ~75% of weeks
        const teamIdx = team.charCodeAt(team.length - 1) - 65; // A=0, B=1, C=2, D=3
        for (let w = 1; w <= totalWeeks; w++) {
            // Team is OFF every 4th group of 2 days → simplified: off 1 week in 4
            if ((w + teamIdx) % 4 !== 0) {
                onDutyWeeks.add(w);
            }
        }
    } else {
        // 2 teams alternating: Team A on odd cycle-groups, Team B on even
        const isTeamA = team.includes('A') || team === 'Day Shift';
        for (let w = 1; w <= totalWeeks; w++) {
            // 4on/4off: each team works ~50% of weeks
            // Simplified: Team A on weeks 1-2, off 3-4, on 5-6, etc.
            const cyclePos = Math.floor((w - 1) / 2) % 2;
            if (isTeamA ? cyclePos === 0 : cyclePos === 1) {
                onDutyWeeks.add(w);
            }
        }
    }

    return onDutyWeeks;
};

// ─── ASSIGN WORK ORDERS TO PEOPLE ───────────────────────────
export const assignWorkOrders = (
    maintenanceEvents: MaintenanceEvent[],
    staffingResults: StaffingResult[],
    patternId: ShiftPattern = '4on4off'
): PersonalWorkOrder[] => {
    const staff = generateStaffList(staffingResults);
    const pattern = SHIFT_PATTERNS[patternId];
    const assignments: PersonalWorkOrder[] = [];

    // Pre-compute on-duty weeks for each person
    const dutyMap = new Map<string, Set<number>>();
    staff.forEach(person => {
        if (person.is24x7) {
            dutyMap.set(person.personId, getOnDutyWeeks(person.team, patternId));
        } else {
            // Day shift staff → on duty every week
            const allWeeks = new Set<number>();
            for (let w = 1; w <= 52; w++) allWeeks.add(w);
            dutyMap.set(person.personId, allWeeks);
        }
    });

    // Track load per person per week
    const loadTracker = new Map<string, Map<number, number>>(); // personId → weekNum → hours
    staff.forEach(p => loadTracker.set(p.personId, new Map()));

    // Convert MaintenanceEvents to WorkOrders
    const workOrders: WorkOrder[] = maintenanceEvents.map(event => ({
        id: event.id,
        assetName: event.assetName,
        taskName: event.task.name,
        taskId: event.task.id,
        category: event.task.category,
        criticality: event.task.criticality,
        durationHours: event.durationHours,
        techsRequired: event.techniciansRequired,
        weekNumber: event.weekNumber,
        color: event.color,
    }));

    // Assign each WO to eligible on-duty staff
    workOrders.forEach(wo => {
        if (wo.techsRequired === 0) return; // Vendor-only task

        // Find eligible staff for this WO
        const eligibleRoles: StaffRole[] = wo.category === 'Specialist'
            ? ['engineer', 'shift-lead']
            : ['technician', 'engineer', 'shift-lead'];

        const eligible = staff.filter(p =>
            eligibleRoles.includes(p.role) &&
            dutyMap.get(p.personId)?.has(wo.weekNumber)
        );

        if (eligible.length === 0) return;

        // Sort by load (least loaded first) for fair distribution
        eligible.sort((a, b) => {
            const loadA = loadTracker.get(a.personId)?.get(wo.weekNumber) || 0;
            const loadB = loadTracker.get(b.personId)?.get(wo.weekNumber) || 0;
            return loadA - loadB;
        });

        // Assign to top N techs required
        const assignees = eligible.slice(0, Math.min(wo.techsRequired, eligible.length));
        const hoursEach = wo.durationHours / assignees.length;

        assignees.forEach(person => {
            const weekLoad = loadTracker.get(person.personId)!;
            weekLoad.set(wo.weekNumber, (weekLoad.get(wo.weekNumber) || 0) + hoursEach);
        });
    });

    // Build PersonalWorkOrder output for each person × week
    staff.forEach(person => {
        const onDutyWeeks = dutyMap.get(person.personId)!;
        const weekLoads = loadTracker.get(person.personId)!;

        // Weekly available hours
        const weeklyAvailable = person.is24x7
            ? pattern.workDays * pattern.effectiveHours / pattern.cycleDays * 7
            : 37.5; // Day-shift 5 × 7.5h

        onDutyWeeks.forEach(weekNum => {
            const totalHours = weekLoads.get(weekNum) || 0;

            // Find WOs assigned to this person this week
            const assignedWOs = workOrders.filter(wo => {
                if (wo.weekNumber !== weekNum || wo.techsRequired === 0) return false;
                const eligibleRoles: StaffRole[] = wo.category === 'Specialist'
                    ? ['engineer', 'shift-lead']
                    : ['technician', 'engineer', 'shift-lead'];
                return eligibleRoles.includes(person.role);
            });

            // Only include weeks with WOs for compactness (but show empty weeks too for top-level)
            const util = weeklyAvailable > 0 ? (totalHours / weeklyAvailable) * 100 : 0;

            assignments.push({
                personId: person.personId,
                personName: person.personName,
                role: person.role,
                team: person.team,
                weekNumber: weekNum,
                workOrders: assignedWOs,
                totalWOHours: totalHours,
                shiftHoursAvailable: weeklyAvailable,
                utilizationPercent: util,
                status: util > 90 ? 'overloaded' : util > 40 ? 'normal' : 'underloaded',
            });
        });
    });

    return assignments.sort((a, b) => a.weekNumber - b.weekNumber || a.personId.localeCompare(b.personId));
};

// ─── BUILD PERSON PROFILES ─────────────────────────────────
export const buildPersonProfiles = (
    assignments: PersonalWorkOrder[]
): PersonProfile[] => {
    const profileMap = new Map<string, PersonProfile>();

    assignments.forEach(a => {
        if (!profileMap.has(a.personId)) {
            profileMap.set(a.personId, {
                personId: a.personId,
                personName: a.personName,
                role: a.role,
                team: a.team,
                weeklySchedule: [],
                annualStats: {
                    totalWOCount: 0,
                    totalWOHours: 0,
                    avgWeeklyWOHours: 0,
                    busiestWeek: 0,
                    busiestWeekHours: 0,
                    workWeeks: 0,
                },
            });
        }

        const profile = profileMap.get(a.personId)!;
        profile.weeklySchedule.push({
            weekNumber: a.weekNumber,
            isOnDuty: true,
            shiftType: a.team,
            workOrders: a.workOrders,
            totalWOHours: a.totalWOHours,
            availableHours: a.shiftHoursAvailable,
        });
    });

    // Compute annual stats
    profileMap.forEach(profile => {
        const schedule = profile.weeklySchedule;
        const totalWOs = schedule.reduce((a, w) => a + w.workOrders.length, 0);
        const totalHours = schedule.reduce((a, w) => a + w.totalWOHours, 0);
        const busiestWeek = schedule.reduce((max, w) => w.totalWOHours > max.totalWOHours ? w : max, schedule[0] || { weekNumber: 0, totalWOHours: 0 });

        profile.annualStats = {
            totalWOCount: totalWOs,
            totalWOHours: totalHours,
            avgWeeklyWOHours: schedule.length > 0 ? totalHours / schedule.length : 0,
            busiestWeek: busiestWeek?.weekNumber || 0,
            busiestWeekHours: busiestWeek?.totalWOHours || 0,
            workWeeks: schedule.length,
        };
    });

    return Array.from(profileMap.values());
};
