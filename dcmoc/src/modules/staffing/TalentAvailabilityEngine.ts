// ─── TALENT AVAILABILITY ENGINE ─────────────────────────────
// Evaluates talent pool and calculates staffing cost adjustments

import { CountryProfile } from '@/constants/countries';

export interface TalentAvailabilityInput {
    country: CountryProfile;
    totalFTE: number;
    annualStaffCost: number;
}

export interface TalentAvailabilityResult {
    talentScore: number;
    hiringDifficulty: 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult';
    adjustedSalaryMultiplier: number;
    recruitmentCostPerHire: number;
    totalRecruitmentCost: number;
    timeToFullStaff: number;
    adjustedTurnoverRate: number;
    annualTrainingCost: number;
    competitionIndex: number;
    annualTurnoverCost: number;
    adjustedAnnualStaffCost: number;
    talentBreakdown: { metric: string; value: string; impact: string }[];
    countryComparison: { country: string; score: number; salary: number }[];
}

export const calculateTalentAvailability = (input: TalentAvailabilityInput): TalentAvailabilityResult => {
    const { country, totalFTE, annualStaffCost } = input;
    const talent = country.talentPool;

    // Defaults
    const dcEngineerPool = talent?.dcEngineerPool ?? 'moderate';
    const universityPipeline = talent?.universityPipeline ?? 20;
    const hyperscalerPresence = talent?.hyperscalerPresence ?? 3;
    const avgHiringDays = talent?.avgHiringDays ?? 40;
    const salaryPremium = talent?.salaryPremium ?? 1.1;
    const baseTalentScore = talent?.talentScore ?? 50;
    const certifiedProfessionals = talent?.certifiedProfessionals ?? 200;

    // --- Score Calculation ---
    // Pool size (30%)
    const poolScore = dcEngineerPool === 'abundant' ? 100 : dcEngineerPool === 'moderate' ? 60 : dcEngineerPool === 'scarce' ? 30 : 10;

    // University pipeline (20%): normalized, >100K grads = 100
    const pipelineScore = Math.min(100, (universityPipeline / 100) * 100);

    // Hyperscaler competition (25%): more hyperscalers = better ecosystem BUT more competition
    // Sweet spot at 5-7, diminishing after that
    const competitionScore = hyperscalerPresence <= 3 ? hyperscalerPresence * 20
        : hyperscalerPresence <= 7 ? 60 + (hyperscalerPresence - 3) * 8
        : Math.max(50, 92 - (hyperscalerPresence - 7) * 5);

    // Hiring speed (15%): <20 days = 100, >90 days = 0
    const speedScore = Math.max(0, Math.min(100, (90 - avgHiringDays) / 0.7));

    // Certifications (10%)
    const certScore = Math.min(100, (certifiedProfessionals / 3000) * 100);

    const talentScore = Math.round(
        poolScore * 0.30 + pipelineScore * 0.20 + competitionScore * 0.25 + speedScore * 0.15 + certScore * 0.10
    );

    // --- Hiring Difficulty ---
    const hiringDifficulty: 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult' =
        talentScore >= 75 ? 'Easy' : talentScore >= 55 ? 'Moderate' : talentScore >= 35 ? 'Difficult' : 'Very Difficult';

    // --- Salary & Cost Adjustments ---
    const adjustedSalaryMultiplier = salaryPremium;

    // Recruitment cost: based on hiring days and difficulty
    const dailyRecruitmentCost = 150; // $/day (recruiter time, advertising, etc.)
    const recruitmentCostPerHire = Math.round(avgHiringDays * dailyRecruitmentCost * (salaryPremium));
    const totalRecruitmentCost = recruitmentCostPerHire * totalFTE;

    // Time to full staff (months)
    const hiresPerMonth = Math.max(1, Math.ceil(totalFTE / (avgHiringDays / 30 * 2))); // 2 parallel hires
    const timeToFullStaff = Math.round((totalFTE / hiresPerMonth) * 10) / 10;

    // Turnover adjustment
    const baseTurnover = 0.15; // 15% baseline
    const turnoverAdj = dcEngineerPool === 'very_scarce' ? 0.12 : dcEngineerPool === 'scarce' ? 0.08 : dcEngineerPool === 'moderate' ? 0.03 : 0;
    const competitionTurnoverAdj = hyperscalerPresence > 5 ? 0.04 : hyperscalerPresence > 3 ? 0.02 : 0;
    const adjustedTurnoverRate = Math.round((baseTurnover + turnoverAdj + competitionTurnoverAdj) * 100) / 100;

    // Training cost
    const certTrainingCost = 3500; // Per person for CDCP/CDCS
    const newHiresPerYear = Math.ceil(totalFTE * adjustedTurnoverRate);
    const annualTrainingCost = Math.round(newHiresPerYear * certTrainingCost * 1.5); // 1.5x for onboarding overhead

    // Competition index
    const competitionIndex = Math.round(hyperscalerPresence * (dcEngineerPool === 'scarce' || dcEngineerPool === 'very_scarce' ? 15 : 8));

    // Annual turnover cost
    const costPerTurnover = annualStaffCost / totalFTE * 0.5; // 50% of annual salary per turnover
    const annualTurnoverCost = Math.round(newHiresPerYear * costPerTurnover);

    // Adjusted annual staff cost
    const adjustedAnnualStaffCost = Math.round(annualStaffCost * adjustedSalaryMultiplier);

    // Talent breakdown
    const talentBreakdown = [
        { metric: 'DC Engineer Pool', value: dcEngineerPool.replace('_', ' '), impact: poolScore >= 60 ? 'Positive' : 'Negative' },
        { metric: 'University Pipeline', value: `${universityPipeline}K grads/yr`, impact: pipelineScore >= 50 ? 'Positive' : 'Neutral' },
        { metric: 'Hyperscaler Presence', value: `${hyperscalerPresence} operators`, impact: hyperscalerPresence > 5 ? 'High Competition' : 'Manageable' },
        { metric: 'Avg Hiring Time', value: `${avgHiringDays} days`, impact: avgHiringDays <= 35 ? 'Fast' : avgHiringDays <= 50 ? 'Average' : 'Slow' },
        { metric: 'Certified Professionals', value: `${certifiedProfessionals}`, impact: certifiedProfessionals >= 500 ? 'Strong' : 'Limited' },
        { metric: 'Salary Premium', value: `${((salaryPremium - 1) * 100).toFixed(0)}%`, impact: salaryPremium <= 1.05 ? 'Low' : salaryPremium <= 1.15 ? 'Moderate' : 'High' },
    ];

    return {
        talentScore,
        hiringDifficulty,
        adjustedSalaryMultiplier,
        recruitmentCostPerHire,
        totalRecruitmentCost,
        timeToFullStaff,
        adjustedTurnoverRate,
        annualTrainingCost,
        competitionIndex,
        annualTurnoverCost,
        adjustedAnnualStaffCost,
        talentBreakdown,
        countryComparison: [], // populated by dashboard
    };
};
