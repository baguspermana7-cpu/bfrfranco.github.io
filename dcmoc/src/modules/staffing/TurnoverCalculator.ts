import { CountryProfile } from '@/constants/countries';

export interface TurnoverResult {
    totalCostPerHire: number;
    breakdown: {
        separation: number;
        vacancy: number;
        recruitment: number;
        training: number;
        productivityLoss: number;
    };
}

export const calculateTurnoverCost = (
    baseSalary: number,
    timeToFillDays: number,
    rampUpMonths: number,
    country: CountryProfile
): TurnoverResult => {
    // 1. Separation Costs
    // Admin time + detailed severance (simplified here as 1 month salary for >1 year)
    // ID Law: Severance is complex (roughly 1.75x - 2x per year of service for long term)
    // We'll assume average case of 1 month logic for calculator baseline
    const separation = baseSalary * 0.5; // Admin + accrued leave payout etc.

    // 2. Vacancy Costs
    // Existing staff detailed OT to cover.
    // Assume 50% of vacancy period is covered by OT at 1.5x cost
    const dailyRate = baseSalary / 22;
    const coveredDays = timeToFillDays * 0.5;
    const vacancy = coveredDays * dailyRate * 1.5;

    // 3. Recruitment Costs
    // Agency fee (15-20% annual salary usually) or internal time.
    // We'll use internal time + ads flat fee estimate
    const recruitment = baseSalary * 1.2; // ~10% annual or 1.2 months salary equiv

    // 4. Training / Onboarding
    // 1 week of dedicated trainer time + materials
    const training = baseSalary * 0.25;

    // 5. Productivity Loss
    // New hire operates at 50% efficiency for rampUpMonths
    // Cost = (100% Salary - 50% Value) * Months
    const productivityLoss = (baseSalary * 0.5) * rampUpMonths;

    return {
        totalCostPerHire: separation + vacancy + recruitment + training + productivityLoss,
        breakdown: {
            separation,
            vacancy,
            recruitment,
            training,
            productivityLoss,
        },
    };
};
