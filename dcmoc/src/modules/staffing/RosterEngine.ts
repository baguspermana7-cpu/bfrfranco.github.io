
import { CountryProfile } from '@/constants/countries';

export interface RosterShift {
    date: Date;
    dayType: 'Work' | 'Off' | 'Leave' | 'Training';
    shiftType: 'Day' | 'Night' | 'None' | 'Morning' | 'Swing' | 'Afternoon';
    team: string;
    isPublicHoliday: boolean;
    hours: number;
    dailyCost: number;
}

/**
 * Generate a set of approximate public holiday dates for a given country and year.
 *
 * Rationale: Specific public holiday dates vary by country and year (some are
 * fixed calendar dates, others are lunar/observed). This implementation uses the
 * country's `labor.leaves.publicHolidays` count to distribute holidays across the
 * year on a representative basis (approximately evenly spaced with realistic
 * weightings toward months that most countries observe them). Exact per-country
 * holiday calendars would require a maintained database or external API — this
 * provides a numerically accurate approximation suitable for staffing cost
 * modelling while remaining dependency-free.
 *
 * For facilities requiring exact dates, pass an explicit `holidayDates` array to
 * `generateAnnualRoster`.
 */
export function approximateHolidayDates(year: number, count: number): Set<string> {
    if (count <= 0) return new Set();
    // Representative distribution of holidays across months (index 0 = Jan)
    // Weights approximate global averages: higher in Jan, Apr/May, Aug, Oct/Dec
    const monthWeights = [1.5, 0.5, 0.8, 1.2, 1.0, 0.5, 0.5, 1.0, 0.8, 0.8, 0.5, 2.0];
    const totalWeight = monthWeights.reduce((a, b) => a + b, 0);
    const holidaySet = new Set<string>();

    // Allocate holiday count proportionally across months, then pick representative day
    const allocated: number[] = monthWeights.map(w => Math.round((w / totalWeight) * count));
    // Adjust rounding errors
    let allocatedTotal = allocated.reduce((a, b) => a + b, 0);
    while (allocatedTotal < count) { allocated[11]++; allocatedTotal++; }
    while (allocatedTotal > count) {
        for (let m = 0; m < 12 && allocatedTotal > count; m++) {
            if (allocated[m] > 0) { allocated[m]--; allocatedTotal--; }
        }
    }

    const daysInMonth = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (let m = 0; m < 12; m++) {
        const n = allocated[m];
        if (n === 0) continue;
        const daysAvail = daysInMonth[m];
        // Space n holidays evenly within the month starting from day 1
        const step = Math.floor(daysAvail / (n + 1));
        for (let k = 1; k <= n; k++) {
            const day = Math.min(step * k, daysAvail);
            const d = new Date(year, m, day);
            holidaySet.add(d.toDateString());
        }
    }
    return holidaySet;
}

export interface TurnoverCost {
    recruitmentFees: number;
    trainingCost: number;
    productivityLoss: number; // Ramp up curve
    total: number;
}

export interface TrainingProgram {
    name: string;
    hours: number;
    frequency: 'Onboarding' | 'Annual' | 'Ad-hoc';
    costPerHead: number;
}

// Fixed Training Programs per Country/Reg
const TRAINING_PROGRAMS: TrainingProgram[] = [
    { name: 'Site Induction & EHS', hours: 8, frequency: 'Onboarding', costPerHead: 0 },
    { name: 'Electrical Safety (LOTO)', hours: 16, frequency: 'Annual', costPerHead: 500 },
    { name: 'First Aid / CPR', hours: 8, frequency: 'Annual', costPerHead: 150 },
    { name: 'Advanced DC Operations', hours: 40, frequency: 'Onboarding', costPerHead: 2000 },
];

export const generateAnnualRoster = (
    year: number,
    shiftPattern: '4on-4off' | '4on-3off' | '5on-2off' | '3shift-8h',
    startDate: Date = new Date(year, 0, 1),
    /** Optional: country profile to derive public holiday count. */
    country?: CountryProfile,
    /** Optional: explicit public holiday dates (overrides country-derived approximation). */
    holidayDates?: Date[]
): RosterShift[] => {
    const roster: RosterShift[] = [];
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;

    let cycleIndex = 0;

    // Build public holiday lookup set
    let holidaySet: Set<string>;
    if (holidayDates && holidayDates.length > 0) {
        // Explicit dates provided — use them directly
        holidaySet = new Set(holidayDates.map(d => d.toDateString()));
    } else if (country) {
        // Derive from country profile (approximate distribution by count)
        const count = country.labor.leaves.publicHolidays ?? 10;
        holidaySet = approximateHolidayDates(year, count);
    } else {
        // No country context — default to 10 holidays (global typical)
        holidaySet = approximateHolidayDates(year, 10);
    }

    for (let i = 0; i < daysInYear; i++) {
        const currentDate = new Date(year, 0, 1 + i);
        let dayType: 'Work' | 'Off' = 'Off';
        let shiftType: 'Day' | 'Night' | 'None' | 'Morning' | 'Afternoon' = 'None';
        let team = 'Team A';
        let hours = 0;

        // 1. Determine Shift Pattern
        if (shiftPattern === '4on-4off') {
            // 2 Day, 2 Night, 4 Off
            const cycleDay = cycleIndex % 8;
            if (cycleDay < 2) {
                dayType = 'Work';
                shiftType = 'Day';
                hours = 12;
            } else if (cycleDay < 4) {
                dayType = 'Work';
                shiftType = 'Night';
                hours = 12;
            } else {
                dayType = 'Off';
                hours = 0;
            }
            cycleIndex++;
        } else if (shiftPattern === '4on-3off') {
            // 4-on/3-off: 2 Day, 2 Night, 3 Off (7-day cycle)
            const cycleDay = cycleIndex % 7;
            if (cycleDay < 2) {
                dayType = 'Work';
                shiftType = 'Day';
                hours = 12;
            } else if (cycleDay < 4) {
                dayType = 'Work';
                shiftType = 'Night';
                hours = 12;
            } else {
                dayType = 'Off';
                hours = 0;
            }
            cycleIndex++;
        } else if (shiftPattern === '3shift-8h') {
            // "Continental" or 4-Team 3-Shift Pattern
            // To cover 24/7 with 8h shifts, you need 4 teams.
            // Pattern: 2 Morning -> 2 Afternoon -> 2 Night -> 2 Off (Cycle of 8 days)
            // Or simple weekly rotation. Let's use a standard fast-rotation 2-2-2-2.

            const cycleDay = cycleIndex % 8;

            if (cycleDay < 2) {
                dayType = 'Work';
                shiftType = 'Morning'; // 06:00 - 14:00
                hours = 8;
            } else if (cycleDay < 4) {
                dayType = 'Work';
                shiftType = 'Afternoon' as any; // Allow 'Afternoon' even if strict type complains (casted in UI)
                hours = 8;
            } else if (cycleDay < 6) {
                dayType = 'Work';
                shiftType = 'Night'; // 22:00 - 06:00
                hours = 8;
            } else {
                dayType = 'Off';
                shiftType = 'None';
                hours = 0;
            }
            cycleIndex++;
        }

        // 2. Public Holiday Check
        // Uses holidaySet derived from country profile or explicit dates.
        // See approximateHolidayDates() for methodology.
        const isPublicHoliday = holidaySet.has(currentDate.toDateString());

        // 3. Daily Cost (Placeholder simulation)
        // Base daily cost from country labor rate; doubled on public holidays per
        // typical overtime/holiday premium rules.
        // Default $200/day if no country provided; otherwise use laborRatePerHour * hours.
        const baseHourlyRate = country?.labor?.laborRatePerHour ?? 25;
        let dailyCost = hours > 0 ? baseHourlyRate * hours : 0;
        if (isPublicHoliday && hours > 0) dailyCost *= 2;

        roster.push({
            date: currentDate,
            dayType,
            shiftType: shiftType as any,
            team,
            isPublicHoliday,
            hours,
            dailyCost
        });
    }

    return roster;
};

export const calculateTurnoverImpact = (
    country: CountryProfile,
    roleSalary: number,
    turnoverRate: number, // e.g. 0.15
    headCount: number
): TurnoverCost => {
    // 1. Recruitment (Agency Fee ~ 15% of Annual Salary)
    const annualSalary = roleSalary * 13; // THR incl
    const recruitmentFees = (annualSalary * 0.15) * (headCount * turnoverRate);

    // 2. Training (Onboarding Programs)
    const onboardingCost = TRAINING_PROGRAMS
        .filter(t => t.frequency === 'Onboarding')
        .reduce((sum, t) => sum + t.costPerHead, 0);

    const trainingCost = onboardingCost * (headCount * turnoverRate);

    // 3. Productivity Loss (Ramp Up Curve)
    // Assume new hire is 50% effective first 3 months
    // Loss = 3 months * 50% salary * count
    const productivityLoss = (roleSalary * 3 * 0.5) * (headCount * turnoverRate);

    return {
        recruitmentFees,
        trainingCost,
        productivityLoss,
        total: recruitmentFees + trainingCost + productivityLoss
    };
};
