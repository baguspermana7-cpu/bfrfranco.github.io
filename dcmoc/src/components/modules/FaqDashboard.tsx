'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, BookOpen, Target, TrendingUp, BarChart3, FileText } from 'lucide-react';
import clsx from 'clsx';

interface FaqItem {
    q: string;
    a: string;
    category: string;
}

const FAQ_DATA: FaqItem[] = [
    // ── General ──────────────────────────────────────────────────
    { category: 'General', q: 'What is DC MOC?', a: 'Data Center Maintenance & Operations Calculator — a simulation engine for modeling staffing, shift patterns, CAPEX, OPEX, risk analysis, carbon/ESG, and financial projections for data center operations across 33 countries. Benchmarks are updated to 2026-Q1 (Uptime Institute 2025, JLL/CBRE 2025).' },
    { category: 'General', q: 'Who is DC MOC for?', a: 'Data center operations managers, facility engineers, C-level executives, and consultants who need to plan staffing, estimate costs, and compare operational scenarios for new or existing data center facilities.' },
    { category: 'General', q: 'How do I get access?', a: 'DC MOC is available to authorized users only. Contact us at admin@resistancezero.com to request access credentials and discuss your data center operations needs.' },
    { category: 'General', q: 'How do I export a PDF report?', a: 'Each module has an "Export Full Report (PDF)" button in the top toolbar. Click it to generate a comprehensive multi-page PDF covering all KPIs, charts, tables, and recommendations for the active module. Reports are branded, dated, and print-ready with a disclaimer footer.' },
    { category: 'General', q: 'Can I save and compare scenarios?', a: 'Yes — the Simulation module lets you save configurations as named scenarios. The Scenario Comparison tab displays saved scenarios side-by-side, comparing cost, headcount, PUE, and risk metrics across different countries and shift models.' },

    // ── Financial ────────────────────────────────────────────────
    { category: 'Financial', q: 'What is EBITDA?', a: 'Earnings Before Interest, Taxes, Depreciation & Amortization — a key profitability metric that measures operating performance without the effects of financing and accounting decisions. Used in DC MOC\'s Financial module to evaluate data center profitability.' },
    { category: 'Financial', q: 'What is TCO (Total Cost of Ownership)?', a: 'The complete cost of owning and operating a data center over a defined period (typically 5 years). Includes staffing payroll, shift allowances, overtime, labor escalation, turnover impact, maintenance, energy, and operational overhead.' },
    { category: 'Financial', q: 'What is CAPEX vs OPEX?', a: 'CAPEX (Capital Expenditure) is upfront construction cost — building, electrical infrastructure, UPS, generators, cooling, fire suppression. OPEX (Operating Expenditure) is ongoing cost — staffing, energy, maintenance, insurance. DC MOC models both, with 2025-2026 benchmark costs sourced from JLL and CBRE market surveys.' },
    { category: 'Financial', q: 'What is IRR (Internal Rate of Return)?', a: 'The discount rate that makes the Net Present Value (NPV) of an investment equal to zero. Used in the Investment module to evaluate whether a data center project meets the required return threshold.' },
    { category: 'Financial', q: 'What is NPV (Net Present Value)?', a: 'The present value of all future cash flows minus the initial investment, discounted at a specified rate. A positive NPV indicates the project creates value. Calculated in DC MOC\'s Investment module.' },
    { category: 'Financial', q: 'What is DSCR (Debt Service Coverage Ratio)?', a: 'Net Operating Income divided by total debt service (principal + interest). A DSCR above 1.25x is generally required by lenders for data center project finance. Below 1.0x means the project cannot cover its debt obligations.' },
    { category: 'Financial', q: 'What is WACC (Weighted Average Cost of Capital)?', a: 'The blended cost of all capital sources (debt and equity), weighted by their proportion in the capital structure. Used as the discount rate for NPV calculations. Typical data center WACC ranges from 6-10% depending on leverage and market conditions.' },
    { category: 'Financial', q: 'How is terminal value calculated?', a: 'Terminal value represents the project\'s value beyond the explicit forecast period. DC MOC uses the exit multiple method: Terminal Value = Final Year EBITDA x Exit EV/EBITDA Multiple. This captures the residual value at the assumed exit year.' },

    // ── Infrastructure ───────────────────────────────────────────
    { category: 'Infrastructure', q: 'What is PUE (Power Usage Effectiveness)?', a: 'The ratio of total facility power to IT equipment power. A PUE of 1.0 is ideal. The global median is approximately 1.50 (Uptime Institute 2025 Global Data Center Survey). Hyperscaler AI/liquid-cooled facilities reach 1.08–1.12. PUE directly impacts energy cost and carbon footprint calculations across DC MOC.' },
    { category: 'Infrastructure', q: 'Why did the PUE benchmark median move to ~1.5?', a: 'Uptime Institute\'s 2025 annual survey (published late 2025) reported the global median PUE at approximately 1.50, down from ~1.58 in the 2022 survey, reflecting widespread adoption of free-cooling, variable-speed fans, and advanced DCIM. DC MOC updated all benchmark comparisons to reflect this figure in the 2026-Q1 data refresh.' },
    { category: 'Infrastructure', q: 'What is Redundancy Tier (N to 2N+1)?', a: 'Data center redundancy levels for critical infrastructure — N (no backup), N+1 (one spare unit), 2N (full duplicate system), 2N+1 (full duplicate plus one spare). Higher tiers significantly increase CAPEX but improve uptime SLA. DC MOC uses Uptime Institute Tier III at 99.982% (95 minutes max downtime/yr) and Tier IV at 99.99943% (~3 minutes/yr) based on the 2024 Uptime Tier Standards.' },
    { category: 'Infrastructure', q: 'What\'s the difference between the Tier III and Tier IV availability the tool uses?', a: 'DC MOC uses Uptime Institute Tier Standard values: Tier III (Concurrently Maintainable) targets 99.982% uptime — up to 95 minutes of unplanned downtime per year. Tier IV (Fault Tolerant) targets 99.99943% — approximately 2.6 minutes per year. Tier IV requires fully redundant active subsystems (2N+1) and adds roughly 25-40% to CAPEX over Tier III.' },
    { category: 'Infrastructure', q: 'What is WUE (Water Usage Effectiveness)?', a: 'The ratio of annual water usage to IT equipment energy consumption (liters/kWh). Measures how efficiently a data center uses water for cooling. Tracked in DC MOC\'s Carbon/ESG module alongside PUE and CUE.' },
    { category: 'Infrastructure', q: 'What is CUE (Carbon Usage Effectiveness)?', a: 'The ratio of total CO₂ emissions to IT energy consumption (kgCO₂/kWh). Depends on the local grid emission factor and PUE. A lower CUE indicates greener operations. Modeled in the Carbon/ESG module.' },
    { category: 'Infrastructure', q: 'What substation types are modeled?', a: 'DC MOC models four substation configurations: Outdoor (lowest cost, weather-exposed), Indoor (building-integrated, higher protection), GIS/Gas-Insulated (compact footprint for urban sites), and Prefabricated/Packaged (fastest deployment, modular). Each affects CAPEX, footprint, and maintenance requirements.' },
    { category: 'Infrastructure', q: 'What UPS topologies are available?', a: 'Five UPS types: Double Conversion Online (highest protection, 94-96% efficiency), Line Interactive (mid-tier, 97%), Rotary (mechanical flywheel, no battery), Modular/Scalable (pay-as-you-grow), and Flywheel-Hybrid (short-duration bridging). Selection affects CAPEX, efficiency losses, and maintenance cost.' },
    { category: 'Infrastructure', q: 'How does cooling redundancy affect cost?', a: 'Cooling redundancy follows the same N/N+1/2N/2N+1 framework as power. Each additional redundancy level adds 30-80% to cooling CAPEX but reduces thermal failure risk. The CAPEX module calculates exact cost impact based on cooling type (air, in-row, rear-door, liquid) and redundancy level.' },

    // ── Staffing & Shifts ────────────────────────────────────────
    { category: 'Staffing', q: 'What is the 4-on/3-off shift pattern?', a: 'A 12-hour shift rotation: 2 days on, 2 nights on, 3 days off — completing a 7-day cycle. Industry standard for 24/7 data center operations, requiring only 2 teams with zero scheduled overtime.' },
    { category: 'Staffing', q: 'What is the Continental (3-shift 8h) pattern?', a: 'An 8-hour shift rotation: 2 mornings (06-14), 2 afternoons (14-22), 2 nights (22-06), 2 days off — completing an 8-day cycle. Requires 4 teams. Preferred in regions with strict maximum daily work hour regulations.' },
    { category: 'Staffing', q: 'What is Shrinkage Factor?', a: 'The percentage of scheduled work hours lost to annual leave, training, sick days, and absenteeism — typically 15-20%. DC MOC factors this into headcount calculations to ensure adequate on-shift coverage at all times.' },
    { category: 'Staffing', q: 'What is Turnover Rate?', a: 'The annual percentage of employees who leave and need to be replaced. Typical DC industry turnover is 10-20%. Higher turnover increases recruitment fees, training costs, and productivity loss during ramp-up — all modeled in the Cost of Turnover analysis.' },
    { category: 'Staffing', q: 'How are shift allowances calculated?', a: 'Shift allowances are country-specific multipliers applied to base salary for non-standard hours. Night shift typically adds 15-30%, weekend shifts 25-50%, and public holidays up to 100-200%. DC MOC uses each country\'s labor law rates, validated against 2025 JLL/CBRE data, for accurate calculation.' },
    { category: 'Staffing', q: 'What is the competency matrix?', a: 'A skills framework mapping each role (Engineer, Technician, Shift Lead) against required competencies (electrical, mechanical, HVAC, fire, BMS/DCIM). Used to identify training gaps and ensure adequate cross-functional coverage on every shift.' },

    // ── Analytics ─────────────────────────────────────────────────
    { category: 'Analytics', q: 'What is Monte Carlo simulation?', a: 'A probabilistic analysis that runs thousands of randomized scenarios to model risk and uncertainty in cost projections. Instead of a single-point estimate, it provides confidence intervals (P10/P50/P90) for CAPEX and OPEX planning.' },
    { category: 'Analytics', q: 'What is Sensitivity Analysis?', a: 'An analysis that measures how changes in one input variable (e.g., headcount +/-20%) impact output metrics (e.g., monthly cost). Helps identify which variables have the greatest impact on total operational cost.' },
    { category: 'Analytics', q: 'What is Scenario Comparison?', a: 'A side-by-side analysis of saved configurations — comparing different countries, shift models, staffing ratios, or maintenance strategies to determine the optimal operational setup for a data center.' },
    { category: 'Analytics', q: 'What are correlation coefficients in the analytics?', a: 'Pearson correlation values (-1 to +1) measuring the linear relationship between input variables and output costs. Values near +1 indicate strong positive correlation (e.g., headcount vs cost), while values near 0 suggest weak or no relationship.' },
    { category: 'Analytics', q: 'What do P10/P50/P90 confidence intervals mean?', a: 'P10 means there is a 10% probability the actual value will be below this number (optimistic case). P50 is the median estimate. P90 means 90% probability the value will be below this (conservative case). The spread between P10 and P90 quantifies project uncertainty.' },

    // ── Capacity Planning ────────────────────────────────────────
    { category: 'Capacity', q: 'How does phase planning work?', a: 'The Capacity module lets you define multiple build phases, each with its own IT load, start month, and construction duration. This models staged deployment — starting with Phase 1 (e.g., 2MW) and expanding to Phase 3+ as demand grows, avoiding overprovisioning.' },
    { category: 'Capacity', q: 'What is the demand utilization curve?', a: 'A time-series projection showing deployed capacity versus expected customer demand over the project timeline. The gap between capacity and demand represents available headroom — too much headroom wastes capital, too little risks SLA violations during demand spikes.' },
    { category: 'Capacity', q: 'How does the headroom analysis in Capacity Planning work?', a: 'The headroom analysis computes (Deployed Capacity − Projected Demand) at each point on the timeline. A green zone (10-30% headroom) is optimal: enough buffer to absorb demand spikes without excessive overprovisioning. Red zones flag over-capacity (capital waste) or under-capacity (SLA risk). The tool recommends the phase trigger point — the month at which utilization crosses 80% and the next phase should break ground.' },
    { category: 'Capacity', q: 'How is scalability score calculated?', a: 'A composite metric (0-100) evaluating how efficiently the capacity plan scales: considers $/kW efficiency across phases, lead time between phases, PUE improvement trajectory, and revenue-to-CAPEX ratio. Higher scores indicate better capital efficiency.' },

    // ── Risk Management ──────────────────────────────────────────
    { category: 'Risk', q: 'How does the risk matrix work?', a: 'A 5x5 grid mapping likelihood (Rare to Certain) against impact (Negligible to Catastrophic). Each risk is plotted based on country-specific factors: seismic activity, grid reliability, political stability, flood/cyclone exposure, air quality, and wildfire risk. Red-zone risks require immediate mitigation plans.' },
    { category: 'Risk', q: 'How does the wildfire risk factor work?', a: 'Wildfire is modeled as the sixth DisasterRisk dimension (added in the 2026-Q1 data refresh). It uses country-level fire weather index data to score wildfire exposure from 1-10. High-risk scores (US West, Australia, Southern Europe, parts of Southeast Asia) raise the overall disaster risk rating and increase recommended insurance reserve budgets in the Risk module. Wildfire can disrupt air intakes, trigger emergency shutdowns, and damage outdoor switchgear.' },
    { category: 'Risk', q: 'What are MTBF and MTTR?', a: 'MTBF (Mean Time Between Failures) is the average operating time between equipment failures — higher is better. MTTR (Mean Time To Repair) is the average duration to restore equipment after failure — lower is better. Together they determine availability: MTBF / (MTBF + MTTR).' },
    { category: 'Risk', q: 'How are SLA penalties calculated?', a: 'SLA penalties are modeled based on contracted uptime tiers (99.9% to 99.999%). Each minute of downtime beyond the allowed threshold incurs a penalty — typically 5-10% of monthly recurring charges per hour of unplanned outage. The Risk module calculates expected annual penalty exposure.' },

    // ── ESG & Carbon ─────────────────────────────────────────────
    { category: 'ESG & Carbon', q: 'What are Scope 1, 2, and 3 emissions?', a: 'Scope 1: Direct emissions from owned sources (diesel generators, refrigerant leaks). Scope 2: Indirect emissions from purchased electricity (grid carbon intensity x consumption). Scope 3: Value chain emissions (construction materials, employee commuting, waste disposal). DC MOC calculates all three scopes.' },
    { category: 'ESG & Carbon', q: 'How do carbon credits work in the model?', a: 'Carbon credits offset Scope 1 and 2 emissions at a configurable price per tonne CO₂e. The ESG module calculates annual offset cost based on total emissions and shows the net carbon position. Note: credits are supplementary — reducing actual emissions through renewable energy and efficiency improvements is prioritized.' },
    { category: 'ESG & Carbon', q: 'What is RE100 and how does it apply?', a: 'RE100 is a global initiative committing companies to 100% renewable electricity. In DC MOC, enabling RE100 mode assumes all purchased electricity comes from renewable sources (via PPAs or RECs), reducing Scope 2 emissions to near-zero while showing the premium cost for green energy procurement.' },

    // ── Maintenance ──────────────────────────────────────────────
    { category: 'Maintenance', q: 'What is CBM vs TBM?', a: 'CBM (Condition-Based Maintenance) uses real-time sensor data — vibration, temperature, oil analysis — to predict failures and schedule maintenance only when needed. TBM (Time-Based Maintenance) follows fixed calendar intervals regardless of condition. CBM has higher sensor CAPEX but reduces unnecessary interventions by 25-40%.' },
    { category: 'Maintenance', q: 'How does the spares strategy work?', a: 'The Maintenance module uses ABC Pareto analysis: A-items (top 20% by value, ~80% of total cost) get tight inventory control and safety stock. B-items use standard reorder points. C-items use simplified min/max levels. Lead time, criticality, and holding cost drive the optimal stocking strategy.' },
    { category: 'Maintenance', q: 'What is DCIM integration?', a: 'Data Center Infrastructure Management (DCIM) software provides real-time monitoring of power, cooling, and environmental conditions. In the Maintenance module, DCIM integration enables predictive maintenance by feeding sensor data into failure prediction models, reducing unplanned downtime by 30-50%.' },

    // ── Compliance ───────────────────────────────────────────────
    { category: 'Compliance', q: 'What regulatory requirements are covered?', a: 'DC MOC auto-generates compliance checklists per country across 6 categories: Fire Safety (NFPA, local fire codes), Electrical (IEC 62271, IEEE), Environmental (ISO 14001, local EPA), Building (structural codes), Data Protection (GDPR, local privacy laws), and Telecom (licensing requirements). Each item includes authority, standard reference, frequency, and estimated cost.' },
    { category: 'Compliance', q: 'What certification standards are modeled?', a: 'The Compliance module covers: Uptime Institute Tier Certification (design/constructed facility/operations), ISO 27001 (information security), SOC 2 Type II (service organization controls), PCI DSS (payment data), LEED/BREEAM (green building), and country-specific certifications. Initial and annual renewal costs are estimated for each.' },

    // ── Investment ───────────────────────────────────────────────
    { category: 'Investment', q: 'What is the IRR hurdle rate?', a: 'The minimum acceptable Internal Rate of Return for a data center investment to proceed. Typical hurdle rates: 12-15% for core markets, 18-25% for emerging markets. DC MOC flags projects below the hurdle rate as potentially unviable in the Investment module.' },
    { category: 'Investment', q: 'How is cap rate used in valuation?', a: 'Capitalization Rate = Net Operating Income / Property Value. For data centers, cap rates typically range 5-8% depending on market, tenant quality, and lease term. Lower cap rates indicate higher valuations. Used in the Investment module for asset valuation and exit pricing.' },
    { category: 'Investment', q: 'What 2026 tax incentives does the Investment module model?', a: 'The Investment module reflects the IRA (Inflation Reduction Act) 2026 incentive schedule for US projects: the Section 48E Investment Tax Credit (ITC) remains available at 30% base (up to 50% with bonus credits for energy communities and domestic content). The 179D Energy-Efficient Commercial Buildings deduction applies to qualifying cooling/lighting upgrades. IRA incentives begin phasing down after 2032. Non-US profiles use country-specific green building subsidies and FIT schemes where available.' },
    { category: 'Investment', q: 'What is an equity waterfall?', a: 'A distribution hierarchy defining how cash flows are split between investors: first, preferred return (8-10% annually) to equity holders, then return of capital, then a promote/carry split (typically 80/20 or 70/30) on remaining profits. DC MOC models the full waterfall including GP promote calculations.' },

    // ── Portfolio ────────────────────────────────────────────────
    { category: 'Portfolio', q: 'How does multi-site comparison work?', a: 'The Portfolio module lets you configure up to 6 data center sites with different countries, tiers, IT loads, and cooling types. It generates side-by-side comparisons of CAPEX, OPEX, staffing cost, PUE, and risk scores — plus a radar chart for visual benchmarking across sites.' },
    { category: 'Portfolio', q: 'What is portfolio diversification scoring?', a: 'A metric measuring geographic and operational diversity across your data center portfolio. Higher diversification reduces concentration risk — spreading sites across multiple countries/regions protects against localized disruptions (natural disasters, political instability, grid failures).' },

    // ── Strategic Planning ───────────────────────────────────────
    { category: 'Strategic Planning', q: 'What is the Strategic Planning module?', a: 'A decision-support tool with three modes: Feasibility (land + grid to buildable IT load), Acquisition (site bid range and ROI horizon), and Expansion (multi-phase growth scheduling). Use it before committing to option agreements, during due diligence, or when planning capacity growth.' },
    { category: 'Strategic Planning', q: 'How does the Feasibility Mode work?', a: 'Input land area (m²), grid capacity (MW), climate zone, and target PUE. The engine computes: (1) buildable IT load from land (hall floor = 40% of land at 500W/m² IT density), (2) grid-constrained IT load (grid MW / effective PUE), (3) the binding constraint (land or grid), and (4) grid headroom remaining after full build-out. Climate zone applies a PUE penalty ranging from 0% (polar) to +12% (tropical).' },
    { category: 'Strategic Planning', q: 'How is buildable IT load calculated in Feasibility Mode?', a: 'Hall floor area = total land × 40% (remainder used for cooling yards, substation setback, access roads, green buffer). IT density assumption is 500W/m² (conservative mixed-use). Buildable IT kW = hall floor m² × 500W. Grid-constrained IT MW = grid MW / effective PUE. Final IT capacity is min(land-limited, grid-limited).' },
    { category: 'Strategic Planning', q: 'How do I model a land acquisition for a greenfield site?', a: 'Use Feasibility Mode first: enter the land parcel size and utility quote to confirm the site can deliver the target IT capacity. Then switch to Acquisition Mode: enter the seller ask price per MW and three recent market comparables to get a fair value range, bid floor, bid ceiling, and ROI horizon. If the ask is within the ceiling, proceed to due diligence.' },
    { category: 'Strategic Planning', q: 'How is the Acquisition bid range calculated?', a: 'Fair value = average of the three comparable transactions. Bid floor = 88% of fair value (aggressive). Ceiling = fair value × risk multiplier (1.0x–1.5x, reflecting site-specific risk: seismic zone, grid reliability, permitting risk). Cap rate = estimated annual NOI / total investment. Simple payback = total investment / annual NOI, assuming $150/kW-month colocation revenue at 5 MW.' },
    { category: 'Strategic Planning', q: 'What is the 80% utilization trigger in Expansion Mode?', a: 'Industry standard: when a facility reaches 80% of committed capacity, lead time to break ground on the next phase must begin immediately. Given typical construction timelines of 18-24 months and grid reservation requirements of 12-24 months ahead, the 80% trigger gives a 6-month buffer to avoid SLA violations. DC MOC calculates which year in the demand timeline crosses this threshold and flags it as the recommended action date.' },
    { category: 'Strategic Planning', q: 'How does grid reservation lead time affect expansion planning?', a: 'Most grid operators require formal capacity reservation 12-24 months before energization. The Expansion module subtracts this lead time from the phase start year to show when the grid application must be filed. Failing to reserve early risks delaying the phase by 1-2 years, which can cause SLA breaches if demand growth is faster than expected.' },
    { category: 'Strategic Planning', q: 'What CAPEX per MW should I use for expansion phases?', a: 'Default is pulled from your active CAPEX Config module. You can override it in Expansion Mode. Typical ranges (2025-2026): emerging markets $4-6M/MW, developed markets $7-10M/MW, AI-ready (liquid cooled, high density) $12-18M/MW. The CAPEX module provides a more granular estimate based on your specific configuration.' },
    { category: 'Strategic Planning', q: 'Can I use Strategic Planning for a power purchase agreement (PPA) assessment?', a: 'Yes. Use Feasibility Mode to confirm the site power envelope, then use the Acquisition Mode to assess the PPA rate per MW against market comparables. The ROI output reflects the cost of energy procurement relative to colocation revenue. For RE100 compliance modeling, use the Carbon/ESG module in combination.' },
    { category: 'Strategic Planning', q: 'How does climate zone affect PUE and what is the impact on operating cost?', a: 'PUE climate penalty: polar +0%, temperate +3%, continental +5%, arid +8%, tropical +12% above your target PUE. For example, a 1.40 target PUE in a tropical climate becomes 1.52 effective PUE. At 10MW IT load and $0.10/kWh, each 0.10 PUE increase adds ~$876K/year in energy cost. Climate zone is the single largest uncontrollable driver of long-term OPEX for data centers in Southeast Asia and the Middle East.' },
];

const CATEGORIES = ['General', 'Financial', 'Infrastructure', 'Staffing', 'Analytics', 'Capacity', 'Risk', 'ESG & Carbon', 'Maintenance', 'Compliance', 'Investment', 'Portfolio', 'Strategic Planning'];

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

            {/* Quick-start guide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: <BookOpen className="w-4 h-4 text-cyan-500" />, title: 'Start Here', desc: 'Set country in CAPEX Config, then open Scenario Model to set IT load and shift pattern. All modules sync automatically.' },
                    { icon: <Target className="w-4 h-4 text-indigo-500" />, title: 'Investment Workflow', desc: 'CAPEX Config → Financial → Investment → Monte Carlo. Generates NPV, IRR, DSCR, and P10/P90 confidence intervals.' },
                    { icon: <TrendingUp className="w-4 h-4 text-violet-500" />, title: 'Strategic Planning', desc: 'Use Strategic Planning module for land feasibility, site acquisition due diligence, or multi-phase expansion scheduling.' },
                    { icon: <BarChart3 className="w-4 h-4 text-emerald-500" />, title: 'Scenario Comparison', desc: 'Save configurations as named scenarios, then select 2+ to compare side-by-side in the Scenario Manager panel.' },
                ].map(item => (
                    <div key={item.title} className="p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">{item.icon}<span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.title}</span></div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-1">
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
