
import { AssetCount } from '@/lib/AssetGenerator';
import { ASSETS, MaintenanceTask } from '@/constants/assets';

export interface MaintenanceEvent {
    units?: number;               // batch size (per-class aggregation, #327)
    id: string;
    assetId: string;
    assetName: string;
    task: MaintenanceTask;
    weekNumber: number; // 1-52
    durationHours: number;
    techniciansRequired: number;
    color: string;
}

export const generateMaintenanceSchedule = (
    assets: AssetCount[],
    year: number = new Date().getFullYear()
): MaintenanceEvent[] => {
    const schedule: MaintenanceEvent[] = [];
    const weeksInYear = 52;

    // Helper to distribute tasks
    // E.g. 4 quarterly tasks -> weeks 2, 15, 28, 41
    const getWeeks = (freq: string, offset: number): number[] => {
        switch (freq) {
            case 'Monthly':
                return Array.from({ length: 12 }, (_, i) => Math.min(52, Math.max(1, Math.round(i * 4.33) + offset)));
            case 'Quarterly':
                return [2 + offset, 15 + offset, 28 + offset, 41 + offset];
            case 'Bi-Annual':
                return [10 + offset, 36 + offset];
            case 'Annual':
                return [20 + offset]; // Default to mid-year for big tasks
            default:
                return [];
        }
    };

    // Process each active asset type
    assets.forEach((assetCount, typeIndex) => {
        const assetTemplate = ASSETS.find(a => a.id === assetCount.assetId);
        if (!assetTemplate) return;

        // Spread duplicate assets of same type across weeks to avoid concurrent downtime
        // e.g. Gen 1 in Week 2, Gen 2 in Week 3
        const spreadOffset = Math.ceil(weeksInYear / assetCount.count / 2); // Simple spacing logic

        /* #327 PERF — per-CLASS aggregation. Enumerating every UNIT exploded to
         * ~467k events at 500 MW (x600 gensets × tasks × weeks → 3-minute hang).
         * Units are BATCHED: each batch shares a week slot and carries `units`
         * (batch size); totals multiply by units. Content unchanged — every task
         * × frequency × stagger week still appears, capped at 26 batches/class
         * (staggering beyond 26 duplicate slots adds no information). */
        const batches = Math.min(assetCount.count, 26);
        const perBatch = assetCount.count / batches;
        for (let i = 0; i < batches; i++) {
            const unitsInBatch = Math.round(perBatch * (i + 1)) - Math.round(perBatch * i);
            const unitName = batches === assetCount.count
                ? `${assetTemplate.name} #${i + 1}`
                : `${assetTemplate.name} (batch ${i + 1} — ${unitsInBatch} units)`;
            const unitOffset = i * 2; // Offset each batch by 2 weeks if possible

            assetTemplate.maintenanceTasks.forEach((task) => {
                const baseWeeks = getWeeks(task.frequency, (typeIndex + unitOffset) % 4); // Stagger by type too

                baseWeeks.forEach(week => {
                    // Criticality Color Coding
                    let color = '#94a3b8'; // Slate (Default)
                    if (task.criticality === 'Statutory') color = '#ef4444'; // Red
                    if (task.criticality === 'Optimal') color = '#3b82f6'; // Blue

                    // Concurrent Check Rule:
                    // If Gen #1 has Annual maintenance in Week 20
                    // Gen #2 should NOT have it in Week 20.
                    // The unitOffset above handles this simply.
                    // Advanced logic would define specific block-out windows.

                    let finalWeek = (week + unitOffset) % 52;
                    if (finalWeek === 0) finalWeek = 52;

                    schedule.push({
                        id: `${assetCount.assetId}-${i}-${task.id}-${finalWeek}`,
                        assetId: assetCount.assetId,
                        assetName: unitName,
                        task: task,
                        weekNumber: finalWeek,
                        durationHours: task.standardHours * unitsInBatch,
                        units: unitsInBatch,
                        techniciansRequired: task.category === 'Specialist' ? 0 : 2, // Assume specialist is vendor
                        color: color
                    });
                });
            });
        }
    });

    return schedule.sort((a, b) => a.weekNumber - b.weekNumber);
};
