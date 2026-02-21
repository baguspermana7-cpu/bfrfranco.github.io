import { CountryProfile } from '@/constants/countries';

export interface TurnoverCostResult {
    separationCost: number;
    replacementCost: number;
    trainingCost: number;
    productivityLoss: number;
    totalCostPerHire: number;
    totalAnnualCost: number;
}

/**
 * Calculates the total Cost of Turnover (CoT) including the hidden "Ramp-up Curve" productivity loss.
 * Based on OPEX Research Part 5, Section 2.1 & 2.2.
 */
export const calculateTurnoverCost = (
    role: 'Chief Engineer' | 'Duty Engineer' | 'Technician',
    salary: number,
    country: CountryProfile,
    turnoverRate: number, // e.g., 0.15 for 15%
    headcount: number
): TurnoverCostResult => {
    // 1. Separation Cost (Severance + Admin)
    // Indonesia (PP 35/2021) requires severance payments. 
    // Estimating ~1.5 months salary avg for separation (PMK, Uang Pisah).
    const severanceMonths = country.id === 'ID' ? 1.5 : 0.5; // Lower for US/others
    const separationCost = salary * severanceMonths;

    // 2. Replacement Cost (Agency Fees + Interview Time)
    // Standard agency fee is ~15-20% of Annual Salary.
    const agencyRate = 0.15;
    const annualSalary = salary * 12; // 13 months for ID (THR) handled in Salary input usually, but let's stick to base 12 for agency fee basis

    // Fixed Admin Overhead (normalized to USD approx)
    // ID: 5,000,000 IDR ~ $330 USD
    const adminOverhead = country.currency === 'USD' ? 330 : 5000000;

    const replacementCost = (annualSalary * agencyRate) + adminOverhead;

    // 3. Training Cost (Certification + Trainer Time)
    // CDFOM / K3 Listrik certification costs.
    // ID: 15,000,000 IDR ~ $1000 USD
    // US: $2500
    const certCost = country.id === 'ID'
        ? (country.currency === 'USD' ? 1000 : 15000000)
        : 2500;

    const trainingCost = certCost + (salary * 0.5); // Trainer time approx 0.5 month salary

    // 4. Productivity Loss (The "Ramp-up Curve")
    // Formula: Integral of lost utility over time.
    // Month 1: 100% Loss (Orientation)
    // Month 2-3: 75% Loss (Basic Tasks)
    // Month 4-6: 25% Loss (Limited Independence)
    // Month 6+: 0% Loss (Full Competence)

    const rampUpLoss = (
        (1.0 * salary * 1) +   // Month 1
        (0.75 * salary * 2) +  // Month 2-3 (2 months)
        (0.25 * salary * 3)    // Month 4-6 (3 months)
    );

    const totalCostPerHire = separationCost + replacementCost + trainingCost + rampUpLoss;

    // Annualized Impact
    const expectedTurnoverEvents = Math.ceil(headcount * turnoverRate);
    const totalAnnualCost = totalCostPerHire * expectedTurnoverEvents;

    return {
        separationCost,
        replacementCost,
        trainingCost,
        productivityLoss: rampUpLoss,
        totalCostPerHire,
        totalAnnualCost
    };
};
