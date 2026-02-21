'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface FaqItem {
    q: string;
    a: string;
    category: string;
}

const FAQ_DATA: FaqItem[] = [
    // General
    { category: 'General', q: 'What is DC MOC?', a: 'Data Center Maintenance & Operations Calculator — a simulation engine for modeling staffing, shift patterns, CAPEX, OPEX, risk analysis, carbon/ESG, and financial projections for data center operations across 30+ countries.' },
    { category: 'General', q: 'Who is DC MOC for?', a: 'Data center operations managers, facility engineers, C-level executives, and consultants who need to plan staffing, estimate costs, and compare operational scenarios for new or existing data center facilities.' },
    { category: 'General', q: 'Is there a demo account?', a: 'Yes — use demo@resistancezero.com / demo2026 to explore all Pro features including scenario modeling, PDF reports, and advanced analytics.' },

    // Financial Terms
    { category: 'Financial', q: 'What is EBITDA?', a: 'Earnings Before Interest, Taxes, Depreciation & Amortization — a key profitability metric that measures operating performance without the effects of financing and accounting decisions. Used in DC MOC\'s Financial module to evaluate data center profitability.' },
    { category: 'Financial', q: 'What is TCO (Total Cost of Ownership)?', a: 'The complete cost of owning and operating a data center over a defined period (typically 5 years). Includes staffing payroll, shift allowances, overtime, labor escalation, turnover impact, maintenance, energy, and operational overhead.' },
    { category: 'Financial', q: 'What is CAPEX vs OPEX?', a: 'CAPEX (Capital Expenditure) is upfront construction cost — building, electrical infrastructure, UPS, generators, cooling, fire suppression. OPEX (Operating Expenditure) is ongoing cost — staffing, energy, maintenance, insurance. DC MOC models both.' },
    { category: 'Financial', q: 'What is IRR (Internal Rate of Return)?', a: 'The discount rate that makes the Net Present Value (NPV) of an investment equal to zero. Used in the Investment module to evaluate whether a data center project meets the required return threshold.' },
    { category: 'Financial', q: 'What is NPV (Net Present Value)?', a: 'The present value of all future cash flows minus the initial investment, discounted at a specified rate. A positive NPV indicates the project creates value. Calculated in DC MOC\'s Investment module.' },

    // Infrastructure
    { category: 'Infrastructure', q: 'What is PUE (Power Usage Effectiveness)?', a: 'The ratio of total facility power to IT equipment power. A PUE of 1.0 is ideal; typical values range from 1.2 (liquid-cooled) to 1.6+ (air-cooled). PUE directly impacts energy cost and carbon footprint calculations across DC MOC.' },
    { category: 'Infrastructure', q: 'What is Redundancy Tier (N to 2N+1)?', a: 'Data center redundancy levels for critical infrastructure — N (no backup), N+1 (one spare unit), 2N (full duplicate system), 2N+1 (full duplicate plus one spare). Higher tiers significantly increase CAPEX but improve uptime SLA from 99.67% to 99.995%.' },
    { category: 'Infrastructure', q: 'What is WUE (Water Usage Effectiveness)?', a: 'The ratio of annual water usage to IT equipment energy consumption (liters/kWh). Measures how efficiently a data center uses water for cooling. Tracked in DC MOC\'s Carbon/ESG module alongside PUE and CUE.' },
    { category: 'Infrastructure', q: 'What is CUE (Carbon Usage Effectiveness)?', a: 'The ratio of total CO₂ emissions to IT energy consumption (kgCO₂/kWh). Depends on the local grid emission factor and PUE. A lower CUE indicates greener operations. Modeled in the Carbon/ESG module.' },

    // Staffing & Shifts
    { category: 'Staffing', q: 'What is the 4-on/3-off shift pattern?', a: 'A 12-hour shift rotation: 2 days on, 2 nights on, 3 days off — completing a 7-day cycle. Industry standard for 24/7 data center operations, requiring only 2 teams with zero scheduled overtime.' },
    { category: 'Staffing', q: 'What is the Continental (3-shift 8h) pattern?', a: 'An 8-hour shift rotation: 2 mornings (06-14), 2 afternoons (14-22), 2 nights (22-06), 2 days off — completing an 8-day cycle. Requires 4 teams. Preferred in regions with strict maximum daily work hour regulations.' },
    { category: 'Staffing', q: 'What is Shrinkage Factor?', a: 'The percentage of scheduled work hours lost to annual leave, training, sick days, and absenteeism — typically 15-20%. DC MOC factors this into headcount calculations to ensure adequate on-shift coverage at all times.' },
    { category: 'Staffing', q: 'What is Turnover Rate?', a: 'The annual percentage of employees who leave and need to be replaced. Typical DC industry turnover is 10-20%. Higher turnover increases recruitment fees, training costs, and productivity loss during ramp-up — all modeled in the Cost of Turnover analysis.' },

    // Analytics
    { category: 'Analytics', q: 'What is Monte Carlo simulation?', a: 'A probabilistic analysis that runs thousands of randomized scenarios to model risk and uncertainty in cost projections. Instead of a single-point estimate, it provides confidence intervals (P10/P50/P90) for CAPEX and OPEX planning.' },
    { category: 'Analytics', q: 'What is Sensitivity Analysis?', a: 'An analysis that measures how changes in one input variable (e.g., headcount +/-20%) impact output metrics (e.g., monthly cost). Helps identify which variables have the greatest impact on total operational cost.' },
    { category: 'Analytics', q: 'What is Scenario Comparison?', a: 'A side-by-side analysis of saved configurations — comparing different countries, shift models, staffing ratios, or maintenance strategies to determine the optimal operational setup for a data center.' },
];

const CATEGORIES = ['General', 'Financial', 'Infrastructure', 'Staffing', 'Analytics'];

export function FaqDashboard() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const filtered = activeCategory === 'all' ? FAQ_DATA : FAQ_DATA.filter(f => f.category === activeCategory);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl backdrop-blur-sm shadow-sm dark:shadow-none">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                    Frequently Asked Questions
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                    Key terms and concepts used across DC MOC modules
                </p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => setActiveCategory('all')}
                    className={clsx(
                        "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                        activeCategory === 'all'
                            ? "bg-cyan-600 border-cyan-600 text-white"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-cyan-500/50"
                    )}
                >
                    All ({FAQ_DATA.length})
                </button>
                {CATEGORIES.map(cat => {
                    const count = FAQ_DATA.filter(f => f.category === cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={clsx(
                                "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                                activeCategory === cat
                                    ? "bg-cyan-600 border-cyan-600 text-white"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-cyan-500/50"
                            )}
                        >
                            {cat} ({count})
                        </button>
                    );
                })}
            </div>

            {/* FAQ Items */}
            <div className="space-y-2">
                {filtered.map((item, i) => {
                    const globalIndex = FAQ_DATA.indexOf(item);
                    const isOpen = openIndex === globalIndex;
                    return (
                        <div
                            key={globalIndex}
                            className={clsx(
                                "border rounded-xl overflow-hidden transition-all",
                                isOpen
                                    ? "bg-white dark:bg-slate-800/80 border-cyan-500/30 dark:border-cyan-700/50 shadow-sm"
                                    : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            )}
                        >
                            <button
                                onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                                className="w-full flex items-center gap-3 px-5 py-4 text-left"
                            >
                                {isOpen
                                    ? <ChevronDown className="w-4 h-4 text-cyan-500 shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                }
                                <span className={clsx(
                                    "text-sm font-semibold flex-1",
                                    isOpen ? "text-cyan-700 dark:text-cyan-400" : "text-slate-800 dark:text-slate-200"
                                )}>
                                    {item.q}
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 shrink-0">
                                    {item.category}
                                </span>
                            </button>
                            {isOpen && (
                                <div className="px-5 pb-4 pl-12">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {item.a}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
