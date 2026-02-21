import { CountryProfile } from '@/constants/countries';

export type StaffRole = 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor' | 'supervisor';
export type ShiftPattern = '4on4off' | '4on3off' | 'continental-8h';

// Centralized role display labels — single source of truth
export const ROLE_LABELS: Record<StaffRole, string> = {
    'shift-lead': 'Team Leaders',
    'engineer': 'Engineers',
    'technician': 'Technicians',
    'admin': 'Supervisor',
    'supervisor': 'Supervisor',
    'janitor': 'Facility Staff',
};

// ─── SHIFT PATTERN CONFIGURATIONS ───────────────────────────
export interface ShiftPatternConfig {
    id: ShiftPattern;
    label: string;
    shortLabel: string;
    shiftHours: number;        // Scheduled hours per shift
    breakMinutes: number;      // Mandatory break per shift
    effectiveHours: number;    // shiftHours - break
    cycleDays: number;         // Total days in one full rotation cycle
    workDays: number;          // Work days per cycle
    offDays: number;           // Off days per cycle
    teamsRequired: number;     // Minimum teams for 24/7 coverage
    avgWeeklyScheduled: number; // (workDays × shiftHours / cycleDays) × 7
    avgWeeklyEffective: number; // (workDays × effectiveHours / cycleDays) × 7
    overtimeHours: number;      // Weekly OT generated
    description: string;
}

export const SHIFT_PATTERNS: Record<ShiftPattern, ShiftPatternConfig> = {
    '4on4off': {
        id: '4on4off',
        label: '4-on / 4-off (12h)',
        shortLabel: '4on/4off',
        shiftHours: 12,
        breakMinutes: 60,    // 1 hour unpaid break per 12h shift
        effectiveHours: 11,  // 12 - 1
        cycleDays: 8,
        workDays: 4,
        offDays: 4,
        teamsRequired: 2,
        avgWeeklyScheduled: (4 * 12 / 8) * 7,  // = 42h
        avgWeeklyEffective: (4 * 11 / 8) * 7,   // = 38.5h
        overtimeHours: 0,
        description: '2-team compressed schedule. 4 consecutive 12h shifts then 4 days off. Zero overtime. Best work-life balance. Effective weekly hours ~38.5h (<40h).',
    },
    '4on3off': {
        id: '4on3off',
        label: '4-on / 3-off (12h)',
        shortLabel: '4on/3off',
        shiftHours: 12,
        breakMinutes: 120,          // 2 hours of breaks (meal + rest)
        effectiveHours: 10,         // 12 - 2h breaks
        cycleDays: 7,
        workDays: 4,
        offDays: 3,
        teamsRequired: 2,
        avgWeeklyScheduled: (4 * 12 / 7) * 7,   // = 48h scheduled
        avgWeeklyEffective: (4 * 10 / 7) * 7,    // = 40h effective — exactly 40h
        overtimeHours: 0,
        description: '2-team compressed schedule. 4 consecutive 12h shifts (2h mandatory breaks) then 3 days off. Exactly 40h effective/week. Optimal work-life balance with full productivity.',
    },
    'continental-8h': {
        id: 'continental-8h',
        label: 'Continental 3-Shift (8h)',
        shortLabel: 'Continental',
        shiftHours: 8,
        breakMinutes: 30,
        effectiveHours: 7.5,
        cycleDays: 8,
        workDays: 6,
        offDays: 2,
        teamsRequired: 4,
        avgWeeklyScheduled: (6 * 8 / 8) * 7,     // = 42h
        avgWeeklyEffective: (6 * 7.5 / 8) * 7,    // = 39.4h
        overtimeHours: 1.5,  // Handover overlap
        description: '4-team rotation: 2 Morning → 2 Afternoon → 2 Night → 2 Off. Standard 8-day cycle. Minor handover OT. Traditional DC model.',
    },
};

// ─── AQI COST MULTIPLIER ────────────────────────────────────
// Higher AQI = more frequent filter changes, environmental premiums
// AQI ≤ 50:  1.00x (clean air, no premium)
// AQI 100:   1.03x (+3% maintenance overhead)
// AQI 200:   1.08x (+8% filter/HVAC burden)
// AQI 300:   1.15x (+15% extreme environmental premium)
export const aqiCostMultiplier = (aqi: number | null): number => {
    if (!aqi || aqi <= 50) return 1.0;
    // Linear interpolation: 50→300 maps to 1.0→1.15
    const clamped = Math.min(aqi, 300);
    return 1.0 + ((clamped - 50) / 250) * 0.15;
};

// Returns descriptive impact level
export const aqiImpactLabel = (aqi: number | null): { label: string; color: string; delta: string } => {
    const mult = aqiCostMultiplier(aqi);
    if (mult <= 1.0) return { label: 'Standard operation', color: 'text-emerald-400', delta: '—' };
    const pct = ((mult - 1) * 100).toFixed(1);
    if (mult < 1.05) return { label: 'Minor AQI impact', color: 'text-yellow-400', delta: `+${pct}%` };
    if (mult < 1.10) return { label: 'Moderate AQI impact', color: 'text-amber-400', delta: `+${pct}%` };
    return { label: 'Severe AQI impact', color: 'text-red-400', delta: `+${pct}%` };
};

export interface StaffingResult {
    role: StaffRole;
    headcount: number;
    onShiftCount: number;
    monthlyCost: number;
    breakdown: {
        baseSalaries: number;
        overtime: number;
        allowances: number;
        socialSecurity: number;
        shiftAllowance: number;
    };
    metrics: {
        weeklyHoursScheduled: number;   // Raw shift hours per week
        weeklyHoursEffective: number;   // After break deduction
        overtimeHoursPerPerson: number;
        shrinkageHeads: number;
        utilizationRate: number;
        costPerFTE: number;             // Monthly cost per head
    };
    is24x7: boolean; // Add is24x7 property
    schedule: {
        pattern: string;
        patternId: ShiftPattern;
        cycleLength: number;
        workDaysPerCycle: number;
        hoursPerShift: number;
        effectiveHoursPerShift: number;
        breakMinutes: number;
        teamsRequired: number;
    };
    operatingModel: 'in-house' | 'hybrid' | 'vendor';
}

export interface YearProjection {
    year: number;
    totalHeadcount: number;
    totalAnnualCost: number;
    roles: Record<StaffRole, { count: number; cost: number }>;
}

// ─── SALARY LOOKUP ──────────────────────────────────────────
export const getBaseSalary = (role: StaffRole, country: CountryProfile): number => {
    switch (role) {
        case 'supervisor': return Math.max(country.labor.baseSalary_ShiftLead * 1.3, country.labor.minimumWage);
        case 'shift-lead': return Math.max(country.labor.baseSalary_ShiftLead, country.labor.minimumWage);
        case 'engineer': return Math.max(country.labor.baseSalary_Engineer, country.labor.minimumWage);
        case 'technician': return Math.max(country.labor.baseSalary_Technician, country.labor.minimumWage);
        case 'admin': return Math.max(country.labor.baseSalary_Admin, country.labor.minimumWage);
        case 'janitor': return Math.max(country.labor.baseSalary_Janitor, country.labor.minimumWage);
        default: return country.labor.minimumWage;
    }
};

// ─── CORE SHIFT ENGINE ──────────────────────────────────────
export const calculateStaffing = (
    role: StaffRole,
    quantity: number,
    shiftModel: '8h' | '12h',
    country: CountryProfile,
    is24x7: boolean = true,
    patternOverride?: ShiftPattern,
    aqiOverride?: number | null,
    operatingModel: 'in-house' | 'hybrid' | 'vendor' = 'in-house'
): StaffingResult => {
    const baseSalary = getBaseSalary(role, country);
    const hourlyRate = baseSalary / 173;
    const aqiMult = aqiCostMultiplier(aqiOverride ?? country.environment.baselineAQI);

    // Operating Model Multipliers (How much headcount is retained internally vs outsourced to vendors)
    // In-House: 1.0 (keep everyone)
    // Hybrid: 0.5 (keep half internal, rest is vendor OPEX which would be calculated elsewhere, but reduces headcount here)
    // Vendor: 0.1 (only keep a skeleton oversight crew)
    const opModelMult = operatingModel === 'in-house' ? 1.0 : operatingModel === 'hybrid' ? 0.5 : 0.1;

    // Resolve pattern — 12H defaults to 4on3off (Day/Night only, 40h effective/week)
    const patternId: ShiftPattern = patternOverride
        || (shiftModel === '12h' ? '4on3off' : 'continental-8h');
    const pattern = SHIFT_PATTERNS[patternId];

    // ─── NON-SHIFT STAFF (Admin, Janitor, Supervisor) ───
    if (!is24x7) {
        const headcount = Math.ceil(quantity * opModelMult);
        const totalBase = headcount * baseSalary;
        const socialSecurity = totalBase * (country.id === 'ID' ? 0.04 : 0.06);
        const allowances = totalBase * 0.05 * aqiMult; // AQI affects allowances

        return {
            role,
            headcount,
            onShiftCount: headcount,
            monthlyCost: totalBase + socialSecurity + allowances,
            breakdown: {
                baseSalaries: totalBase,
                overtime: 0,
                allowances,
                socialSecurity,
                shiftAllowance: 0,
            },
            metrics: {
                weeklyHoursScheduled: 40,
                weeklyHoursEffective: 37.5,
                overtimeHoursPerPerson: 0,
                shrinkageHeads: 0,
                utilizationRate: 0.85,
                costPerFTE: totalBase / headcount + socialSecurity / headcount + allowances / headcount,
            },
            is24x7: false,
            schedule: {
                pattern: 'Mon-Fri 08:00-17:00',
                patternId: patternId,
                cycleLength: 7,
                workDaysPerCycle: 5,
                hoursPerShift: 8,
                effectiveHoursPerShift: 7.5,
                breakMinutes: 30,
                teamsRequired: 1,
            },
            operatingModel,
        };
    }

    // ─── SHIFT STAFF (24/7) ─────────────────────────────
    // `quantity` = desired persons PER SHIFT position.
    // Total raw heads = quantity × teamsRequired (each team needs `quantity` people)
    //   8H Continental → 4 teams → rawHeads = quantity × 4
    //   12H 4on4off    → 2 teams → rawHeads = quantity × 2
    // This naturally produces more headcount for 8H than 12H.
    const teamsNeeded = pattern.teamsRequired;
    const rawHeads = quantity * teamsNeeded;

    // On-shift at any moment = quantity (one team on duty)
    const onShiftAtAnyTime = Math.ceil(quantity * opModelMult);

    const shrinkageMult = patternId === '4on4off' ? 0.5 : patternId === '4on3off' ? 0.6 : 1.0;
    const shrinkageFactor = country.labor.shrinkageFactor * shrinkageMult;
    const shrinkageHeads = Math.ceil(rawHeads * shrinkageFactor * opModelMult);
    const totalHeads = Math.ceil(rawHeads * opModelMult) + shrinkageHeads;

    const weeklyScheduled = pattern.avgWeeklyScheduled;
    const weeklyEffective = pattern.avgWeeklyEffective;
    const overtimeHours = pattern.overtimeHours;

    const totalBase = totalHeads * baseSalary;

    let nightPremiumRate: number;
    if (patternId === 'continental-8h') {
        nightPremiumRate = 0.07;
    } else {
        nightPremiumRate = 0.10;
    }
    const nightShiftPremium = totalBase * nightPremiumRate;

    const socialSecurity = totalBase * (country.id === 'ID' ? 0.04 : 0.06);
    const allowances = totalBase * (patternId === 'continental-8h' ? 0.06 : 0.08) * aqiMult; // AQI multiplier

    const weeklyOTCost = overtimeHours * 1.5 * hourlyRate;
    const monthlyOTTotal = overtimeHours > 0 ? weeklyOTCost * 4.33 * totalHeads : 0;

    const monthlyCost = totalBase + nightShiftPremium + socialSecurity + allowances + monthlyOTTotal;

    return {
        role,
        headcount: totalHeads,
        onShiftCount: onShiftAtAnyTime,
        monthlyCost,
        breakdown: {
            baseSalaries: totalBase,
            overtime: monthlyOTTotal,
            allowances,
            socialSecurity,
            shiftAllowance: nightShiftPremium,
        },
        metrics: {
            weeklyHoursScheduled: weeklyScheduled,
            weeklyHoursEffective: weeklyEffective,
            overtimeHoursPerPerson: overtimeHours,
            shrinkageHeads,
            utilizationRate: pattern.workDays / pattern.cycleDays,
            costPerFTE: monthlyCost / totalHeads,
        },
        is24x7: true,
        schedule: {
            pattern: pattern.label,
            patternId,
            cycleLength: pattern.cycleDays,
            workDaysPerCycle: pattern.workDays,
            hoursPerShift: pattern.shiftHours,
            effectiveHoursPerShift: pattern.effectiveHours,
            breakMinutes: pattern.breakMinutes,
            teamsRequired: teamsNeeded,
        },
        operatingModel,
    };
};

// ─── SHIFT MODEL COMPARISON (All 3 patterns) ───────────────
export interface ShiftComparison {
    model8h: StaffingResult;
    model12h_4on4off: StaffingResult;
    model12h_4on3off: StaffingResult;
    cheapest: ShiftPattern;
    recommendation: string;
}

export const compareAllShiftModels = (
    role: StaffRole,
    quantity: number,
    country: CountryProfile,
    is24x7: boolean = true,
    operatingModel: 'in-house' | 'hybrid' | 'vendor' = 'in-house'
): ShiftComparison => {
    const model8h = calculateStaffing(role, quantity, '8h', country, is24x7, 'continental-8h', null, operatingModel);
    const model12h_4on4off = calculateStaffing(role, quantity, '12h', country, is24x7, '4on4off', null, operatingModel);
    const model12h_4on3off = calculateStaffing(role, quantity, '12h', country, is24x7, '4on3off', null, operatingModel);

    const costs = [
        { id: '4on4off' as ShiftPattern, cost: model12h_4on4off.monthlyCost },
        { id: '4on3off' as ShiftPattern, cost: model12h_4on3off.monthlyCost },
        { id: 'continental-8h' as ShiftPattern, cost: model8h.monthlyCost },
    ];
    const cheapest = costs.sort((a, b) => a.cost - b.cost)[0].id;

    let recommendation = '';
    if (cheapest === '4on4off') {
        recommendation = '4on/4off delivers lowest cost with zero overtime and best work-life balance (4 consecutive days off). Effective hours ~38.5h/week. Ideal for sites prioritizing retention and fatigue management.';
    } else if (cheapest === '4on3off') {
        recommendation = '4on/3off meets the ≥40h/week effective target while maintaining 12h compressed benefits. Good balance between productivity and employee wellbeing.';
    } else {
        recommendation = 'Continental 8h is most cost-effective. Traditional model with shorter shifts. Consider for regulatory environments that restrict 12h shifts.';
    }

    return { model8h, model12h_4on4off, model12h_4on3off, cheapest, recommendation };
};

// Legacy compat
export const compareShiftModels = (
    role: StaffRole,
    quantity: number,
    country: CountryProfile,
    is24x7: boolean = true,
    operatingModel: 'in-house' | 'hybrid' | 'vendor' = 'in-house'
) => {
    const full = compareAllShiftModels(role, quantity, country, is24x7, operatingModel);
    return {
        model8h: full.model8h,
        model12h: full.model12h_4on4off,
        savingsMonthly: full.model8h.monthlyCost - full.model12h_4on4off.monthlyCost,
        savingsPercent: full.model8h.monthlyCost > 0 ? ((full.model8h.monthlyCost - full.model12h_4on4off.monthlyCost) / full.model8h.monthlyCost) * 100 : 0,
        headcountDiff: full.model8h.headcount - full.model12h_4on4off.headcount,
        weeklyHoursDiff: full.model8h.metrics.weeklyHoursEffective - full.model12h_4on4off.metrics.weeklyHoursEffective,
        recommendation: full.recommendation,
    };
};

// ─── 5-YEAR PROJECTION ─────────────────────────────────────
export const generate5YearProjection = (
    baseResults: StaffingResult[],
    inflationRate: number = 0.04
): YearProjection[] => {
    const projections: YearProjection[] = [];
    let currentResults = JSON.parse(JSON.stringify(baseResults)) as StaffingResult[];

    for (let i = 0; i <= 5; i++) {
        const year = 2025 + i;
        const totalAnnualCost = currentResults.reduce((acc, r) => acc + (r.monthlyCost * 12), 0);
        const totalHeadcount = currentResults.reduce((acc, r) => acc + r.headcount, 0);

        const rolesMap: Record<string, { count: number; cost: number }> = {};
        currentResults.forEach(r => {
            rolesMap[r.role] = { count: r.headcount, cost: r.monthlyCost * 12 };
        });

        projections.push({ year, totalHeadcount, totalAnnualCost, roles: rolesMap as any });

        currentResults = currentResults.map(r => ({
            ...r,
            monthlyCost: r.monthlyCost * (1 + inflationRate)
        }));
    }

    return projections;
};

// ─── REFERENCE MODEL ────────────────────────────────────────
export const REFERENCE_STAFFING_10MW = {
    description: '10MW Data Center, 80% In-House Model',
    shiftModel: '12h' as const,
    pattern: '4on/4off',
    weeklyHoursEffective: 38.5,
    weeklyHoursScheduled: 42,
    roles: [
        { role: 'supervisor' as StaffRole, qty: 1, is24x7: false, note: 'Day shift M-F, overall ops management' },
        { role: 'shift-lead' as StaffRole, qty: 4, is24x7: true, note: '4 Team Leaders on shift rotation' },
        { role: 'engineer' as StaffRole, qty: 5, is24x7: true, note: '4 on shift + 1 floating/relief' },
        { role: 'technician' as StaffRole, qty: 2, is24x7: false, note: 'Day shift M-F, preventive maintenance' },
        { role: 'janitor' as StaffRole, qty: 2, is24x7: false, note: 'Day/evening coverage' },
    ],
    totalHeadcount: 14,
};

// ─── AUTO HEADCOUNT CALCULATION ────────────────────────────
export interface AutoHeadcountResult {
    headcounts: Record<'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor', number>;
    rationale: Record<'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor', string>;
    totalFTE: number;
}

export function calculateAutoHeadcount(
    itLoadKw: number,
    tierLevel: 2 | 3 | 4,
    shiftModel: '8h' | '12h',
    staffingModel: 'in-house' | 'outsourced' | 'hybrid',
    maintenanceModel: 'in-house' | 'hybrid' | 'vendor',
    maintenanceStrategy: 'reactive' | 'planned' | 'predictive'
): AutoHeadcountResult {
    const mw = itLoadKw / 1000;

    // Base ratios per MW (from REFERENCE_STAFFING_10MW: 14 FTE / 10MW)
    const baseRatios = {
        'shift-lead': 0.4,
        'engineer': 0.5,
        'technician': 0.2,
        'admin': 0.1,
        'janitor': 0.2,
    };

    // Tier multiplier for shift roles
    const tierMult = tierLevel === 4 ? 1.2 : tierLevel === 3 ? 1.0 : 0.85;

    // Staffing model multiplier
    const staffMult = staffingModel === 'in-house' ? 1.0 : staffingModel === 'hybrid' ? 0.6 : 0.3;

    // Maintenance model affects technicians
    const maintModelMult = maintenanceModel === 'in-house' ? 1.0 : maintenanceModel === 'hybrid' ? 0.5 : 0.2;

    // Maintenance strategy affects engineers
    const strategyMult = maintenanceStrategy === 'predictive' ? 1.15 : maintenanceStrategy === 'planned' ? 1.0 : 0.9;

    // 8h shift needs more people (4 teams vs 2)
    const shiftMult = shiftModel === '8h' ? 1.1 : 1.0;

    const headcounts = {} as Record<'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor', number>;
    const rationale = {} as Record<'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor', string>;

    for (const [role, baseRatio] of Object.entries(baseRatios) as [keyof typeof baseRatios, number][]) {
        let count = baseRatio * mw;
        const parts: string[] = [`${baseRatio}/MW x ${mw.toFixed(1)}MW = ${count.toFixed(1)}`];

        // Apply shift multiplier to shift roles
        if (role === 'shift-lead' || role === 'engineer') {
            count *= shiftMult;
            if (shiftMult !== 1.0) parts.push(`x${shiftMult} (${shiftModel} shift)`);
            count *= tierMult;
            if (tierMult !== 1.0) parts.push(`x${tierMult} (T${tierLevel})`);
        }

        // Staffing model
        count *= staffMult;
        if (staffMult !== 1.0) parts.push(`x${staffMult} (${staffingModel})`);

        // Maintenance model for technicians
        if (role === 'technician') {
            count *= maintModelMult;
            if (maintModelMult !== 1.0) parts.push(`x${maintModelMult} (maint: ${maintenanceModel})`);
        }

        // Maintenance strategy for engineers
        if (role === 'engineer') {
            count *= strategyMult;
            if (strategyMult !== 1.0) parts.push(`x${strategyMult} (${maintenanceStrategy})`);
        }

        headcounts[role] = Math.max(1, Math.round(count));
        rationale[role] = parts.join(' → ') + ` → ${headcounts[role]}`;
    }

    const totalFTE = Object.values(headcounts).reduce((a, b) => a + b, 0);
    return { headcounts, rationale, totalFTE };
}
