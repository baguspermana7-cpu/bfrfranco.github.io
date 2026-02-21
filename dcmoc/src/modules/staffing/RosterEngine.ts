
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
    startDate: Date = new Date(year, 0, 1)
): RosterShift[] => {
    const roster: RosterShift[] = [];
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;

    let cycleIndex = 0;

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

        // 2. Public Holiday Check (Simplified Fixed Dates)
        // In real app, load from CountryProfile
        const isPublicHoliday = false; // TODO: Implement specific dates

        // 3. Daily Cost (Placeholder simulation)
        // Assume avg daily cost of $200 for now, doubled on holidays
        let dailyCost = hours > 0 ? 200 : 0;
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
