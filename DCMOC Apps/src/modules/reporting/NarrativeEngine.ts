
import { CountryProfile } from '@/constants/countries';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import { CapexResult } from '@/lib/CapexEngine';
import { ASSETS } from '@/constants/assets';
import { calculateEnvironmentalDegradation } from '@/modules/maintenance/EnvironmentalLogic';

export interface ReportInsight {
    category: 'Labor' | 'Environment' | 'Financial' | 'Operational' | 'Risk';
    severity: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    recommendation: string;
}

export const generateExecutiveSummary = (
    country: CountryProfile,
    shiftModel: '8h' | '12h',
    aqiOverride: number | null,
    staffingResults: { eng: StaffingResult; tech: StaffingResult },
    capexResult?: CapexResult
): ReportInsight[] => {
    const insights: ReportInsight[] = [];
    const currentAQI = aqiOverride ?? country.environment.baselineAQI;

    // 1. Labor Analysis
    const otHours = staffingResults.eng.metrics.overtimeHoursPerPerson;

    if (country.id === 'ID') {
        if (shiftModel === '12h' && otHours > 0) {
            insights.push({
                category: 'Labor',
                severity: 'high',
                title: 'High Overtime Risk (PP 35/2021)',
                description: `12-hour shifts in Indonesia trigger significant overtime liability (${otHours.toFixed(1)} hrs/week/person) under Omnibus Law.`,
                recommendation: 'Switch to 8-hour 3-Shift model or implement "Long Shift Permit" roster pattern (4-on-4-off).',
            });
        }
    }

    // 2. Environmental Analysis
    const highAQI = currentAQI > 100;
    if (highAQI) {
        const pacFilterImpact = calculateEnvironmentalDegradation('pac', 'G4 Pre-Filters', 3, country, currentAQI);
        const reduction = ((1 - pacFilterImpact.degradationFactor) * 100).toFixed(0);

        insights.push({
            category: 'Environment',
            severity: 'medium',
            title: 'Accelerated Asset Degradation',
            description: `High AQI (${currentAQI}) is reducing cooling consumable lifespan by ~${reduction}%.`,
            recommendation: 'Budget for increased filter stock (1.5x baseline) and schedule monthly coil cleanings.',
        });
    }

    // 3. CAPEX & TCO Analysis
    if (capexResult) {
        const { total, metrics, pue } = capexResult;
        insights.push({
            category: 'Financial',
            severity: pue < 1.4 ? 'low' : 'medium',
            title: 'Capital Efficiency',
            description: `Total CAPEX of $${(total / 1000000).toFixed(1)}M with PUE ${pue.toFixed(2)}. Construction timeline estimated at ${metrics.timelineMonths} months.`,
            recommendation: pue > 1.4 ? 'Consider Liquid Cooling to reduce PUE and long-term Opex.' : 'Design is highly efficient.',
        });
    }

    return insights;
};

export const generateStaffingNarrative = (
    country: CountryProfile,
    results: { eng: StaffingResult; tech: StaffingResult },
    shiftModel: string
): ReportInsight[] => {
    const insights: ReportInsight[] = [];
    const totalHeadcount = results.eng.headcount + results.tech.headcount;
    const monthlyCost = results.eng.monthlyCost + results.tech.monthlyCost;

    insights.push({
        category: 'Labor',
        severity: 'low',
        title: 'Headcount Summary',
        description: `Total operation requires ${totalHeadcount} FTEs (${results.eng.headcount} Engineers, ${results.tech.headcount} Technicians) under a ${shiftModel === '8h' ? '3-Shift' : '2-Shift'} model.`,
        recommendation: 'Review roster for adequate holiday coverage capability.',
    });

    if (results.eng.metrics.overtimeHoursPerPerson > 10) {
        insights.push({
            category: 'Risk',
            severity: 'high',
            title: 'Fatigue Management Warning',
            description: `Engineers are scheduled for ${results.eng.metrics.overtimeHoursPerPerson.toFixed(1)} hours of overtime weekly. This exceeds safe fatigue limits.`,
            recommendation: 'Add relief shift or "floater" staff to reduce burden.',
        });
    }

    return insights;
};

export const generateSimulationNarrative = (
    country: CountryProfile,
    aqi: number,
    risk: { tier: number, availability: number, expectedDowntimeMinutes: number },
    turnoverRate: number
): ReportInsight[] => {
    const insights: ReportInsight[] = [];

    // AQI Logic
    if (aqi > 150) {
        insights.push({
            category: 'Environment',
            severity: 'high',
            title: 'Critical Air Quality Impact',
            description: `AQI of ${aqi} requires specific Hazard Pay protocols and frequency doubling for intake filters.`,
            recommendation: 'Implement "Indoor Air Quality" positive pressure systems.',
        });
    }

    // Risk Logic
    insights.push({
        category: 'Risk',
        severity: risk.expectedDowntimeMinutes > 50 ? 'medium' : 'low',
        title: `Tier ${risk.tier} Reliability Projection`,
        description: `Expected availability is ${risk.availability}%. Anticipate ~${risk.expectedDowntimeMinutes} mins of downtown/year.`,
        recommendation: risk.tier < 3 ? 'Consider N+1 redundancy for critical paths.' : 'Maintain strict SOPs to preserve Tier rating.',
    });

    // Turnover
    if (turnoverRate > 0.15) {
        insights.push({
            category: 'Operational',
            severity: 'medium',
            title: 'High Turnover Risk',
            description: `Turnover rate of ${(turnoverRate * 100).toFixed(0)}% suggests systemic retention issues or aggressive market competition.`,
            recommendation: 'Review compensation packages against market benchmarks.',
        });
    }

    return insights;
};
