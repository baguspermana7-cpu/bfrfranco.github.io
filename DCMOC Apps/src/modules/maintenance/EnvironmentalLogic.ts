import { CountryProfile } from '@/constants/countries';

export interface EnvironmentalImpact {
    assetId: string;
    componentName: string;
    originalLifeMonths: number;
    adjustedLifeMonths: number;
    degradationFactor: number;
    reason: string;
}

/**
 * Calculates the adjusted lifespan of consummables based on environmental factors.
 * Primary driver: AQI (Air Quality Index) impact on air filters.
 */
export const calculateEnvironmentalDegradation = (
    assetId: string,
    consumableName: string,
    baseLifeMonths: number,
    country: CountryProfile,
    aqiOverride?: number | null
): EnvironmentalImpact => {
    const currentAQI = aqiOverride ?? country.environment.baselineAQI;
    const standardAQI = 50; // Reference "Clean" environment (ISO 14644 target ambient)

    let degradationFactor = 1.0;
    let reason = 'Standard operation';

    // Logic: Filters degrade faster in high AQI
    if (consumableName.toLowerCase().includes('filter')) {
        // Power Law Formula from OPEX Research:
        // Factor = (StandardAQI / CurrentAQI) ^ 1.5

        const safeAQI = Math.max(10, currentAQI); // Prevent div by zero

        if (safeAQI > standardAQI) {
            const ratio = standardAQI / safeAQI;
            degradationFactor = Math.pow(ratio, 1.5);

            // Cap minimum factor at 0.1 (10% life) to avoid absurdity
            degradationFactor = Math.max(0.1, degradationFactor);

            reason = `High AQI (${safeAQI}) triggers Power Law degradation (Factor: ${degradationFactor.toFixed(2)}x)`;
        }
    }

    // Logic: Humidity impact? (Todo V2)

    return {
        assetId,
        componentName: consumableName,
        originalLifeMonths: baseLifeMonths,
        adjustedLifeMonths: Number((baseLifeMonths * degradationFactor).toFixed(1)),
        degradationFactor,
        reason,
    };
};
