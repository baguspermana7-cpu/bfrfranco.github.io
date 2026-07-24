'use client';

import { useSimulationStore } from '@/store/simulation';
import ENGINE_CATALOG from '@/lib/engine-catalog.json';
import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, BookOpen, Target, TrendingUp, BarChart3, Lightbulb, Search, Library } from 'lucide-react';
import type { ExplainEntry } from '@/lib/explain';
import clsx from 'clsx';

interface FaqItem {
    q: string;
    a: string;
    category: string;
    /** Optional everyday-comparison explainer, rendered as an amber callout. */
    analogy?: string;
}

const FAQ_DATA: FaqItem[] = [
    // ── General ──────────────────────────────────────────────────
    { category: 'General', q: 'What is DC MOC?', a: 'Data Center Maintenance & Operations Calculator — a simulation engine for modeling staffing, shift patterns, CAPEX, OPEX, risk analysis, carbon/ESG, and financial projections for data center operations across 33 countries. Benchmarks are updated to 2026-Q1 (Uptime Institute 2025, JLL/CBRE 2025).' },
    { category: 'General', q: 'Who is DC MOC for?', a: 'Data center operations managers, facility engineers, C-level executives, and consultants who need to plan staffing, estimate costs, and compare operational scenarios for new or existing data center facilities.' },
    { category: 'General', q: 'How do I get access?', a: 'DC MOC is available to authorized users only. Contact us at admin@resistancezero.com to request access credentials and discuss your data center operations needs.' },
    { category: 'General', q: 'How do I export a PDF report?', a: 'Each module has an "Export Full Report (PDF)" button in the top toolbar. Click it to generate a comprehensive multi-page PDF covering all KPIs, charts, tables, and recommendations for the active module. Reports are branded, dated, and print-ready with a disclaimer footer.' },
    { category: 'General', q: 'Can I save and compare scenarios?', a: 'Yes — the Simulation module lets you save configurations as named scenarios. The Scenario Comparison tab displays saved scenarios side-by-side, comparing cost, headcount, PUE, and risk metrics across different countries and shift models.' },
    { category: 'General', q: 'What are the clickable numbers with a dotted underline (Trace Angka)?', a: 'Any figure with a dotted underline can be clicked to open a "Trace Angka" popover: the formula with live values rendered as colored pills (mint = your input, green = sourced engine constant, cyan = derived, amber = screening estimate). Click any pill to drill into its own formula — recursively down to the very last input or constant, with "Edit in menu" links and external source links at each leaf.' },

    // ── Financial ────────────────────────────────────────────────
    { category: 'Financial', q: 'What is EBITDA?', a: 'Earnings Before Interest, Taxes, Depreciation & Amortization — a key profitability metric that measures operating performance without the effects of financing and accounting decisions. Used in DC MOC\'s Financial module to evaluate data center profitability.', analogy: 'Judging a restaurant purely on its cooking and service, while ignoring its mortgage, tax bracket, and how old its ovens are. EBITDA strips out financing and accounting choices so you can compare the raw operating engine of two businesses fairly.' },
    { category: 'Financial', q: 'What is TCO (Total Cost of Ownership)?', a: 'The complete cost of owning and operating a data center over a defined period (typically 5 years). Includes staffing payroll, shift allowances, overtime, labor escalation, turnover impact, maintenance, energy, and operational overhead.', analogy: 'The sticker price of a printer is misleading — the ink cartridges over five years cost several times more than the printer. TCO adds up the printer AND all the ink: construction plus every year of staffing, energy, and maintenance, so you compare what you will actually spend, not just what you sign for on day one.' },
    { category: 'Financial', q: 'What is CAPEX vs OPEX?', a: 'CAPEX (Capital Expenditure) is upfront construction cost — building, electrical infrastructure, UPS, generators, cooling, fire suppression. OPEX (Operating Expenditure) is ongoing cost — staffing, energy, maintenance, insurance. DC MOC models both, with 2025-2026 benchmark costs sourced from JLL and CBRE market surveys.', analogy: 'Buying a car versus fueling and servicing it. CAPEX is the one-time showroom price; OPEX is the petrol, insurance, and oil changes you keep paying every month for as long as you drive. A cheap car with terrible fuel economy can cost more over ten years than an expensive efficient one — which is why the tool always models both together.' },
    { category: 'Financial', q: 'What is IRR (Internal Rate of Return)?', a: 'The discount rate that makes the Net Present Value (NPV) of an investment equal to zero. Used in the Investment module to evaluate whether a data center project meets the required return threshold.', analogy: 'The effective "interest rate" the project pays you, as if it were a savings account. A project with 15% IRR is like a deposit earning 15% a year on the money you lock in. Compare it against your hurdle rate exactly the way you would compare bank deposit rates.' },
    { category: 'Financial', q: 'What is NPV (Net Present Value)?', a: 'The present value of all future cash flows minus the initial investment, discounted at a specified rate. A positive NPV indicates the project creates value. Calculated in DC MOC\'s Investment module.', analogy: 'Money later is worth less than money now — a million rupiah next year buys less than a million today. NPV converts every future cash flow into "today\'s money" and subtracts what you invest. If the total is still positive, the project makes you richer than leaving the cash in the bank at your discount rate.' },
    { category: 'Financial', q: 'What is DSCR (Debt Service Coverage Ratio)?', a: 'Net Operating Income divided by total debt service (principal + interest). A DSCR above 1.25x is generally required by lenders for data center project finance. Below 1.0x means the project cannot cover its debt obligations.', analogy: 'A bank checking whether your salary covers your mortgage. DSCR 1.25x means the project earns Rp1.25 for every Rp1.00 of loan payment due — a 25% cushion for bad months. Below 1.0x you are borrowing from one pocket to pay the other.' },
    { category: 'Financial', q: 'What is WACC (Weighted Average Cost of Capital)?', a: 'The blended cost of all capital sources (debt and equity), weighted by their proportion in the capital structure. Used as the discount rate for NPV calculations. Typical data center WACC ranges from 6-10% depending on leverage and market conditions.', analogy: 'The blended price of everyone\'s money. If half your funding is a bank loan at 5% and half comes from investors expecting 12%, your average cost of money is about 8.5% — that is WACC. Any project earning less than that is like borrowing at 8.5% to earn 7%: you lose even while "making money".' },
    { category: 'Financial', q: 'How is terminal value calculated?', a: 'Terminal value represents the project\'s value beyond the explicit forecast period. DC MOC uses the exit multiple method: Terminal Value = Final Year EBITDA x Exit EV/EBITDA Multiple. This captures the residual value at the assumed exit year.', analogy: 'When you sell a house after renting it out for ten years, the sale price at the end is often worth more than all the rent combined. Terminal value is that final "sale price" of the data center — what the asset is still worth on the day the model stops counting yearly cash flows.' },
    { category: 'Financial', q: 'What is LCOE (Levelized Cost of Energy)?', a: 'The lifetime cost of an energy source (capital + fuel + O&M, discounted) divided by the lifetime energy it produces — a single $/kWh figure that makes different generation options comparable. Used when weighing grid power against on-site solar, BESS, or gas generation for a data center.', analogy: 'Comparing a Rp30jt solar roof against monthly PLN bills is apples-to-oranges until you divide each option\'s total lifetime cost by the total kWh it delivers. LCOE is the honest "price per kWh" of each option on equal footing — like comparing cars by cost per kilometer instead of sticker price.' },
    { category: 'Financial', q: 'What is IDC (Interest During Construction)?', a: 'The interest that accrues on borrowed capital during the construction period, before the facility earns any revenue. IDC is typically capitalized into the total project cost and can add 5-10% on a 18-24 month data center build.', analogy: 'The loan meter starts the day you borrow, but the building earns nothing for two years of construction — like paying a mortgage on a house you cannot live in yet. That "meter running while the house is empty" is IDC, and it is part of the real project price.' },
    { category: 'Financial', q: 'What is landed cost?', a: 'The full cost of imported equipment delivered to site: purchase price + freight + insurance + import duty + taxes + port handling and inland transport. DC MOC applies per-country landed-cost factors to the imported-equipment share of each CAPEX category.', analogy: 'An online purchase from abroad: the $100 gadget becomes $150 after shipping, import duty, and the courier\'s handling fee. Budgeting transformers and chillers at ex-factory price repeats exactly that surprise — at million-dollar scale.' },
    { category: 'Financial', q: 'What is bankability?', a: 'The degree to which lenders will finance a project against its own cash flows: creditworthy anchor tenants, proven technology, strong contracts (fixed-price EPC, long-term leases), and healthy coverage ratios (DSCR ≥ 1.25x). A technically excellent project that banks refuse to fund is not bankable.', analogy: 'A mortgage application for a project. Banks lend happily against a salaried job (a 15-year lease with a hyperscaler tenant) and reluctantly against a freelancer\'s optimistic forecast (merchant colocation demand). Bankability is everything that turns your project from freelancer into salaried employee in the lender\'s eyes.' },
    { category: 'Financial', q: 'What is the difference between colocation revenue and a PPA?', a: 'Colocation revenue is what the data center EARNS: monthly recurring charges per kW of contracted capacity from tenants, re-priced at market on renewal. A PPA (Power Purchase Agreement) is usually on the COST side: a long-term fixed-price contract for (often renewable) electricity that tames the largest OPEX line and supports RE100 claims.', analogy: 'Colo income is like renting out rooms to many tenants at market rates — your revenue. A PPA is like locking a 15-year fixed electricity tariff with the utility — your biggest bill made predictable. One sets your income, the other tames your largest cost; strong projects usually have both.' },

    // ── Infrastructure ───────────────────────────────────────────
    { category: 'Infrastructure', q: 'What is PUE (Power Usage Effectiveness)?', a: 'The ratio of total facility power to IT equipment power. A PUE of 1.0 is ideal. The global median is approximately 1.50 (Uptime Institute 2025 Global Data Center Survey). Hyperscaler AI/liquid-cooled facilities reach 1.08–1.12. PUE directly impacts energy cost and carbon footprint calculations across DC MOC.', analogy: 'A restaurant where for every $2 of food served, you also pay $1 for the lighting, AC, and refrigeration needed to serve it — that overhead ratio is a PUE of 1.5. A world-class kitchen gets the same meal out spending only 10-20 cents extra: PUE 1.1. The food (IT power) is what customers pay for; everything else is overhead you want to shrink.' },
    { category: 'Infrastructure', q: 'Why did the PUE benchmark median move to ~1.5?', a: 'Uptime Institute\'s 2025 annual survey (published late 2025) reported the global median PUE at approximately 1.50, down from ~1.58 in the 2022 survey, reflecting widespread adoption of free-cooling, variable-speed fans, and advanced DCIM. DC MOC updated all benchmark comparisons to reflect this figure in the 2026-Q1 data refresh.' },
    { category: 'Infrastructure', q: 'What is Redundancy Tier (N to 2N+1)?', a: 'Data center redundancy levels for critical infrastructure — N (no backup), N+1 (one spare unit), 2N (full duplicate system), 2N+1 (full duplicate plus one spare). Higher tiers significantly increase CAPEX but improve uptime SLA. DC MOC uses Uptime Institute Tier III at 99.982% (95 minutes max downtime/yr) and Tier IV at 99.99943% (~3 minutes/yr) based on the 2024 Uptime Tier Standards.', analogy: 'Spare tires. N is driving with no spare, N+1 carries one spare in the trunk, 2N tows an entire second car behind you, and 2N+1 tows a second car that also carries its own spare. Each step up costs real money — and makes a breakdown on the highway less and less likely to strand you.' },
    { category: 'Infrastructure', q: 'What\'s the difference between the Tier III and Tier IV availability the tool uses?', a: 'DC MOC uses Uptime Institute Tier Standard values: Tier III (Concurrently Maintainable) targets 99.982% uptime — up to 95 minutes of unplanned downtime per year. Tier IV (Fault Tolerant) targets 99.99943% — approximately 2.6 minutes per year. Tier IV requires fully redundant active subsystems (2N+1) and adds roughly 25-40% to CAPEX over Tier III.', analogy: 'Tier III is a hospital that can renovate one operating room while the others keep working — planned maintenance never forces a shutdown. Tier IV is a hospital where even a fire in one wing does not interrupt a single surgery, because every critical system exists twice and both run at once. That is why Tier IV is allowed ~3 minutes of downtime a year versus 95.' },
    { category: 'Infrastructure', q: 'What is WUE (Water Usage Effectiveness)?', a: 'The ratio of annual water usage to IT equipment energy consumption (liters/kWh). Measures how efficiently a data center uses water for cooling. Tracked in DC MOC\'s Carbon/ESG module alongside PUE and CUE.', analogy: 'Tracking how many liters of water your household consumes per hour of air conditioning. Two houses can be equally cool, but one evaporates thousands of liters through a cooling tower while the other runs a closed loop and uses almost none. WUE puts a number on that difference so water-stressed regions can compare designs honestly.' },
    { category: 'Infrastructure', q: 'What is CUE (Carbon Usage Effectiveness)?', a: 'The ratio of total CO₂ emissions to IT energy consumption (kgCO₂/kWh). Depends on the local grid emission factor and PUE. A lower CUE indicates greener operations. Modeled in the Carbon/ESG module.', analogy: 'Two identical electric cars have very different real footprints depending on whether they charge from a coal grid or a hydro grid. CUE captures the same idea for a data center: the exact same IT workload is "dirtier" or "cleaner" purely based on the local grid mix and how efficiently the facility uses power.' },
    { category: 'Infrastructure', q: 'What substation types are modeled?', a: 'DC MOC models four substation configurations: Outdoor (lowest cost, weather-exposed), Indoor (building-integrated, higher protection), GIS/Gas-Insulated (compact footprint for urban sites), and Prefabricated/Packaged (fastest deployment, modular). Each affects CAPEX, footprint, and maintenance requirements.' },
    { category: 'Infrastructure', q: 'What UPS topologies are available?', a: 'Five UPS types: Double Conversion Online (highest protection, 94-96% efficiency), Line Interactive (mid-tier, 97%), Rotary (mechanical flywheel, no battery), Modular/Scalable (pay-as-you-grow), and Flywheel-Hybrid (short-duration bridging). Selection affects CAPEX, efficiency losses, and maintenance cost.', analogy: 'Double-conversion is like drinking only bottled water — everything passes through purification, safest but you pay for every liter (efficiency loss). Line-interactive filters the tap water only when it tastes off. A flywheel is a bucket you keep topped up: only seconds of supply, but enough to bridge until the well pump (the generator) starts.' },
    { category: 'Infrastructure', q: 'How does cooling redundancy affect cost?', a: 'Cooling redundancy follows the same N/N+1/2N/2N+1 framework as power. Each additional redundancy level adds 30-80% to cooling CAPEX but reduces thermal failure risk. The CAPEX module calculates exact cost impact based on cooling type (air, in-row, rear-door, liquid) and redundancy level.', analogy: 'Same spare-tire logic as power — one spare AC unit (N+1) or an entire duplicate cooling plant (2N). The catch is thermal: when cooling fails, a dense hall can overheat in minutes, faster than any repair. So the spare cannot sit in a box; it must be installed, piped, and ready to spin up instantly.' },
    { category: 'Infrastructure', q: 'What is BESS (Battery Energy Storage System)?', a: 'Grid-scale battery installations (usually lithium iron phosphate) used for backup ride-through, peak shaving, frequency response, and firming on-site renewables. Increasingly paired with data centers to reduce generator runtime, earn grid-services revenue, and buffer AI load swings.', analogy: 'A giant power bank for the whole building. Charge it at night when electricity is cheap, spend it during expensive afternoon peaks, and let it double as bridge power for the seconds-to-minutes gap before generators take over — the same reason your phone power bank earns its place in your bag.' },
    { category: 'Infrastructure', q: 'What is wet-bulb temperature and why does cooling design care?', a: 'The temperature read by a thermometer wrapped in a wet wick with air blowing over it — the lowest temperature achievable by evaporative cooling. Design wet-bulb (not dry-bulb) sets how effective cooling towers and evaporative economizers can be at a site; humid tropical sites have high wet-bulb and little evaporative headroom.', analogy: 'Sweating only cools you when the sweat can evaporate — on a humid Jakarta afternoon it cannot, and fanning yourself barely helps, while dry desert heat feels manageable at the same thermometer reading. Wet-bulb tells engineers exactly how much "sweating" (evaporative cooling) the local air will allow.' },
    { category: 'Infrastructure', q: 'What is an economizer?', a: 'A cooling-system mode (air-side or water-side) that uses cool outside air or water directly for heat rejection when ambient conditions permit, letting compressors idle. Economizer hours are a major driver of low PUE in temperate and cold climates.', analogy: 'Opening the windows on a cool night instead of running the AC. The economizer is that window, automated: whenever outside air or water is cold enough to do the job, the expensive compressors rest — and every resting hour shows up directly on the power bill.' },
    { category: 'Infrastructure', q: 'What is free cooling?', a: 'The hours of the year when a facility can reject heat without running mechanical refrigeration — via economizers, cooling towers alone, or cold seawater/lake water. Oslo or Dublin can free-cool most of the year; Singapore almost never. Free-cooling hours largely explain why identical designs have different PUE by geography.', analogy: 'Oslo gets thousands of "open the window" hours a year; Singapore gets nearly zero. Same house, same AC unit — but one climate lets you switch it off for most of the year. That is why the same data center design can be a 1.2 PUE in the Nordics and 1.5 in the tropics.' },
    { category: 'Infrastructure', q: 'What is nominal vs peak kW per rack (and why do AI racks differ)?', a: 'Nominal kW/rack is the average sustained draw; peak is the synchronized maximum when all accelerators load simultaneously (GB200-class racks peak at ~1.3-1.6x nominal). Electrical infrastructure — breakers, busway, UPS — must be provisioned for peak, not average, which is why DC MOC applies architecture-specific peak provisioning factors to AI profiles.', analogy: 'A single kettle is easy — but AI training is 1,000 kettles all switching on at the same second for the same TV commercial break. The wires and breakers must survive that synchronized surge, not the day\'s comfortable average. Sizing for the average is how breakers trip on the first big training job.' },
    { category: 'Infrastructure', q: 'What is oversubscription?', a: 'Selling more contracted power capacity than is physically installed, relying on the statistical fact that tenants rarely all peak at once (diversity). Common in retail colocation at ratios of 1.2-1.5x; dangerous with AI tenants whose loads synchronize. SLA penalties are the cost of getting the statistics wrong.', analogy: 'Gyms sell 5,000 memberships for 300 treadmills because members never all show up at once — and it works, until New Year resolutions week. Colo oversubscription trades on the same statistics; AI workloads are the resolutions week that arrives without warning, because every GPU shows up to the gym simultaneously.' },
    { category: 'Infrastructure', q: 'What is load-bank testing?', a: 'Connecting large resistive/reactive dummy loads that mimic full IT load, to prove the entire power and cooling chain (generators, UPS, distribution, chillers) performs at rated capacity BEFORE real servers arrive. A standard step in Level 4-5 commissioning.', analogy: 'A dress rehearsal with sandbags standing in for the audience: you prove the stage floor holds the full weight before opening night. Discovering a weak generator with sandbags is an afternoon\'s fix; discovering it with a customer\'s servers running is a career event.' },
    { category: 'Infrastructure', q: 'What is a campus vs single-building topology?', a: 'A campus co-locates multiple data center buildings on one land parcel sharing a substation, security perimeter, fiber routes, and operations team — amortizing those fixed costs and enabling phased growth. A standalone building pays for all of it alone. Campus economics are a major reason hyperscale sites cluster.', analogy: 'A university campus versus a single rented schoolhouse: one gate, one power connection, one security office serving many faculties — and adding a new faculty does not mean buying new land across town. The shared backbone is what makes the fifth building far cheaper than the first.' },

    // ── Staffing & Shifts ────────────────────────────────────────
    { category: 'Staffing', q: 'What is the 4-on/3-off shift pattern?', a: 'A 12-hour shift rotation: 2 days on, 2 nights on, 3 days off — completing a 7-day cycle. Industry standard for 24/7 data center operations, requiring only 2 teams with zero scheduled overtime.', analogy: 'Two families sharing one shop that never closes: family A minds the counter through its days and nights, then rests three days while family B takes over. Two teams, 12-hour turns, the door never shuts — and nobody is scheduled a single hour of overtime.' },
    { category: 'Staffing', q: 'What is the Continental (3-shift 8h) pattern?', a: 'An 8-hour shift rotation: 2 mornings (06-14), 2 afternoons (14-22), 2 nights (22-06), 2 days off — completing an 8-day cycle. Requires 4 teams. Preferred in regions with strict maximum daily work hour regulations.', analogy: 'Rotating three meal-shifts among four roommates: everyone cycles through mornings, afternoons, and nights, then gets days off — so nobody is stuck permanently on the night shift. More teams and more handovers, but every workday stays a legal 8 hours.' },
    { category: 'Staffing', q: 'What is Shrinkage Factor?', a: 'The percentage of scheduled work hours lost to annual leave, training, sick days, and absenteeism — typically 15-20%. DC MOC factors this into headcount calculations to ensure adequate on-shift coverage at all times.', analogy: 'Schedule 10 staff and you will never actually have 10 on the floor — leave, training, and sick days quietly erase 15-20% of them. Like a bus that seats 50 but always has 8 seats broken or reserved: to actually move 50 people, you must order the bigger bus.' },
    { category: 'Staffing', q: 'What is the relief factor?', a: 'The multiplier converting posts-to-cover into people-to-hire: relief factor = total hours a post must be covered ÷ net productive hours one employee actually delivers (after shrinkage). Covering one 24/7 post at ~1,800 net hours/person-year needs 8,760 ÷ 1,800 ≈ 4.9 people — not 3.', analogy: 'One guard post, around the clock, is 8,760 hours a year — but one guard only truly delivers ~1,800 productive hours after leave, training, and sick days. So one chair needs almost five salaries. The relief factor is the honest arithmetic between "posts on the org chart" and "people on the payroll".' },
    { category: 'Staffing', q: 'What is Turnover Rate?', a: 'The annual percentage of employees who leave and need to be replaced. Typical DC industry turnover is 10-20%. Higher turnover increases recruitment fees, training costs, and productivity loss during ramp-up — all modeled in the Cost of Turnover analysis.', analogy: 'Every resignation is a leaking bucket: you do not just refill the water (recruit a replacement) — you pay for the leak itself: agency fees, months of training, and a new hire working at half speed while they learn the site. That is why "cheap" high-turnover staffing is usually the expensive option.' },
    { category: 'Staffing', q: 'How are shift allowances calculated?', a: 'Shift allowances are country-specific multipliers applied to base salary for non-standard hours. Night shift typically adds 15-30%, weekend shifts 25-50%, and public holidays up to 100-200%. DC MOC uses each country\'s labor law rates, validated against 2025 JLL/CBRE data, for accurate calculation.', analogy: 'Night and holiday hours are the "peak-hour taxi fare" of labor: same trip, higher price, because law and market both make unsociable hours cost more. A rota that leans hard on nights and weekends can cost far more than the headcount alone suggests.' },
    { category: 'Staffing', q: 'Where do the statutory labor rates come from?', a: 'Each of the 40 modeled countries carries researched statutory fields: social security / employer contribution rate (e.g. AU superannuation 12%, GB employer NIC 15%, SG CPF 17%, FR ~38%), benefits overhead, statutory night-shift premium (JP 25%, KR 30%, VN 30%, BR 20%), and effective working hours per month derived from national leave entitlements. The shift engine and payroll calculations consume these per-country values instead of a single global burden factor.' },
    { category: 'Staffing', q: 'What is the competency matrix?', a: 'A skills framework mapping each role (Engineer, Technician, Shift Lead) against required competencies (electrical, mechanical, HVAC, fire, BMS/DCIM). Used to identify training gaps and ensure adequate cross-functional coverage on every shift.' },

    // ── Analytics ─────────────────────────────────────────────────
    { category: 'Analytics', q: 'What is Monte Carlo simulation?', a: 'A probabilistic analysis that runs thousands of randomized scenarios to model risk and uncertainty in cost projections. Instead of a single-point estimate, it provides confidence intervals (P10/P50/P90) for CAPEX and OPEX planning.', analogy: 'Instead of guessing your commute takes "about 45 minutes", imagine replaying it 10,000 times with random traffic, weather, and red lights, then reading the spread: 90% of runs finished under 55 minutes. Monte Carlo does that for project cost — thousands of simulated futures instead of one hopeful estimate.' },
    { category: 'Analytics', q: 'What is Sensitivity Analysis?', a: 'An analysis that measures how changes in one input variable (e.g., headcount +/-20%) impact output metrics (e.g., monthly cost). Helps identify which variables have the greatest impact on total operational cost.', analogy: 'A studio mixing desk: push each fader up and down one at a time and listen to which one changes the song the most. Sensitivity analysis moves each input — headcount, energy price, salary — by ±20% and shows which knob actually moves your total cost, so you focus negotiation effort there.' },
    { category: 'Analytics', q: 'What is Scenario Comparison?', a: 'A side-by-side analysis of saved configurations — comparing different countries, shift models, staffing ratios, or maintenance strategies to determine the optimal operational setup for a data center.' },
    { category: 'Analytics', q: 'What are correlation coefficients in the analytics?', a: 'Pearson correlation values (-1 to +1) measuring the linear relationship between input variables and output costs. Values near +1 indicate strong positive correlation (e.g., headcount vs cost), while values near 0 suggest weak or no relationship.' },
    { category: 'Analytics', q: 'What are the "why?" panels on verdicts and status chips?', a: 'Verdicts (e.g. the Phased Financial GO/NO-GO) and status chips (Investment thresholds, Reliability availability gap, Site axis bands, Capacity utilization, Results dimension scores) can be clicked to open a reason panel: the live numbers behind the status plus measured levers — computed by bisection on the exact same model that renders the number (e.g. "Revenue +X% to $Y/kW/mo flips the verdict"). If no realistic lever reaches the target, the panel says so honestly instead of inventing one.' },
    { category: 'Analytics', q: 'What do P10/P50/P90 confidence intervals mean?', a: 'P10 means there is a 10% probability the actual value will be below this number (optimistic case). P50 is the median estimate. P90 means 90% probability the value will be below this (conservative case). The spread between P10 and P90 quantifies project uncertainty.', analogy: 'Weather-forecast thinking for budgets. P50 is "as likely over as under" — the median. P90 is the umbrella-in-the-bag number: 90% confident the actual cost lands below it. Projects get in trouble by budgeting at P50 while promising stakeholders P90 certainty.' },

    // ── Capacity Planning ────────────────────────────────────────
    { category: 'Capacity', q: 'How does phase planning work?', a: 'The Capacity module lets you define multiple build phases, each with its own IT load, start month, and construction duration. This models staged deployment — starting with Phase 1 (e.g., 2MW) and expanding to Phase 3+ as demand grows, avoiding overprovisioning.', analogy: 'Building a housing estate one cluster at a time: you sell cluster 1 before pouring concrete on cluster 3. Phasing a data center works the same way — it avoids paying today, in full, for capacity that has no paying customer until 2029.' },
    { category: 'Capacity', q: 'What is the demand utilization curve?', a: 'A time-series projection showing deployed capacity versus expected customer demand over the project timeline. The gap between capacity and demand represents available headroom — too much headroom wastes capital, too little risks SLA violations during demand spikes.' },
    { category: 'Capacity', q: 'How does the headroom analysis in Capacity Planning work?', a: 'The headroom analysis computes (Deployed Capacity − Projected Demand) at each point on the timeline. A green zone (10-30% headroom) is optimal: enough buffer to absorb demand spikes without excessive overprovisioning. Red zones flag over-capacity (capital waste) or under-capacity (SLA risk). The tool recommends the phase trigger point — the month at which utilization crosses 80% and the next phase should break ground.', analogy: 'Airline seat-planning in reverse: too many empty seats (over-capacity) wastes the aircraft; zero empty seats means one gate delay strands passengers (SLA risk). The 10-30% green zone is "a few seats free on every flight" — enough slack to absorb surprises without flying a half-empty plane.' },
    { category: 'Capacity', q: 'Why does Capacity Utilization show "At Risk" when current utilization looks low?', a: 'The OK/Watch/At-Risk chip is forecast-aware: it is computed from the PEAK of the growth forecast as a share of design capacity — not from today\'s utilization, which is structurally ≈ 1/(1 + design margin) right after commissioning. Each system row also gets an estimated exhaust year (e.g. "At Risk · ~2029"). Hover the percentage to see "now X% · forecast peak Y% · exhaust ~year". If no forecast is configured, the chip falls back to current utilization.' },
    { category: 'Capacity', q: 'How is scalability score calculated?', a: 'A composite metric (0-100) evaluating how efficiently the capacity plan scales: considers $/kW efficiency across phases, lead time between phases, PUE improvement trajectory, and revenue-to-CAPEX ratio. Higher scores indicate better capital efficiency.' },

    // ── Risk Management ──────────────────────────────────────────
    { category: 'Risk', q: 'How does the risk matrix work?', a: 'A 5x5 grid mapping likelihood (Rare to Certain) against impact (Negligible to Catastrophic). Each risk is plotted based on country-specific factors: seismic activity, grid reliability, political stability, flood/cyclone exposure, air quality, and wildfire risk. Red-zone risks require immediate mitigation plans.', analogy: 'How you already judge everyday risks: rain on your commute is likely but trivial (carry a jacket); a house fire is rare but catastrophic (buy insurance and smoke alarms). The 5×5 matrix simply makes that instinct explicit and comparable for seismic, flood, grid, and political risks.' },
    { category: 'Risk', q: 'How does the wildfire risk factor work?', a: 'Wildfire is modeled as the sixth DisasterRisk dimension (added in the 2026-Q1 data refresh). It uses country-level fire weather index data to score wildfire exposure from 1-10. High-risk scores (US West, Australia, Southern Europe, parts of Southeast Asia) raise the overall disaster risk rating and increase recommended insurance reserve budgets in the Risk module. Wildfire can disrupt air intakes, trigger emergency shutdowns, and damage outdoor switchgear.' },
    { category: 'Risk', q: 'What are MTBF and MTTR?', a: 'MTBF (Mean Time Between Failures) is the average operating time between equipment failures — higher is better. MTTR (Mean Time To Repair) is the average duration to restore equipment after failure — lower is better. Together they determine availability: MTBF / (MTBF + MTTR).', analogy: 'MTBF is how many months your motorbike runs between breakdowns; MTTR is how many days the workshop keeps it each time. Availability needs both: a bike that breaks yearly but is fixed in an hour beats one that breaks every three years but sits in the shop for a month.' },
    { category: 'Risk', q: 'How are SLA penalties calculated?', a: 'SLA penalties are modeled based on contracted uptime tiers (99.9% to 99.999%). Each minute of downtime beyond the allowed threshold incurs a penalty — typically 5-10% of monthly recurring charges per hour of unplanned outage. The Risk module calculates expected annual penalty exposure.', analogy: 'A pizza chain\'s "free if late" promise: the guarantee wins customers, but every late delivery comes straight off revenue. Uptime SLAs work identically — each minute beyond the allowance refunds a slice of the monthly bill, so penalty exposure is a real budget line, not fine print.' },
    { category: 'Risk', q: 'What is an RBD (Reliability Block Diagram)?', a: 'A diagram modeling a system as blocks in series (all must work) and parallel (any one suffices), from which system availability is computed from component MTBF/MTTR. DC MOC\'s Reliability module builds an RBD of the power and cooling chains to derive the achievable "nines".', analogy: 'Fairy lights: series wiring means one dead bulb kills the whole string; parallel wiring means a bulb can die and the string stays lit. An RBD maps which parts of your plant are wired "series" (fatal alone) and which are "parallel" (backed up) — and does the math on the whole string.' },
    { category: 'Risk', q: 'What is a SPOF (Single Point of Failure)?', a: 'Any single component whose failure alone takes down the whole service — one shared switchboard, one fiber duct, one cooling header. Redundancy audits exist to find and eliminate SPOFs, because a facility full of N+1 equipment can still be brought down by one overlooked shared element.', analogy: 'One shared key to a house where everything else is duplicated — two fridges, two TVs, two of everything. Lose that one key and nobody gets in anyway. SPOF hunting is asking of every item: if THIS alone fails, does everything stop?' },
    { category: 'Risk', q: 'What is the common-cause failure β factor?', a: 'The fraction of failures expected to hit "redundant" units simultaneously because they share a root cause — same firmware bug, same fuel batch, same flooded room, same maintenance error. A β of 5% means 1-in-20 failures defeats the redundancy entirely, which is why real-world availability is worse than naive parallel math predicts.', analogy: 'Two alarm clocks are excellent redundancy — unless both are plugged into the same power strip and it trips overnight. β measures how much your "independent" backups secretly share one throat to choke: the same room, the same fuel, the same technician\'s mistake.' },
    { category: 'Risk', q: 'What is FMEA (Failure Mode & Effects Analysis)?', a: 'A systematic walk through every component asking: how can it fail (mode), what happens (effect), how severe, how likely, and would we detect it in time? Each mode gets a criticality score (RPN) that ranks where engineering and maintenance attention should go first.', analogy: 'A disciplined pre-trip check of the car, thinking through each part: "if the brakes fade — how bad is it, how likely, would I notice before the mountain descent?" Scoring severity × likelihood × detectability for every part tells you to inspect the brakes before topping up wiper fluid.' },

    // ── ESG & Carbon ─────────────────────────────────────────────
    { category: 'ESG & Carbon', q: 'What are Scope 1, 2, and 3 emissions?', a: 'Scope 1: Direct emissions from owned sources (diesel generators, refrigerant leaks). Scope 2: Indirect emissions from purchased electricity (grid carbon intensity x consumption). Scope 3: Value chain emissions (construction materials, employee commuting, waste disposal). DC MOC calculates all three scopes.', analogy: 'Scope 1 is smoke from your own kitchen; Scope 2 is the power plant\'s smoke for electricity you buy; Scope 3 is everyone else\'s smoke on your behalf — the truck that delivered your groceries, the factory that made your stove. Most companies discover Scope 3 is the biggest and the hardest to count.' },
    { category: 'ESG & Carbon', q: 'How do carbon credits work in the model?', a: 'Carbon credits offset Scope 1 and 2 emissions at a configurable price per tonne CO₂e. The ESG module calculates annual offset cost based on total emissions and shows the net carbon position. Note: credits are supplementary — reducing actual emissions through renewable energy and efficiency improvements is prioritized.', analogy: 'Paying someone to clean up a beach across town because you littered on this one: genuinely useful for the world, but your beach is still dirty. Credits offset emissions on paper; efficiency and renewables are cleaning your own beach — which is why the model prices credits but prioritizes reduction.' },
    { category: 'ESG & Carbon', q: 'How are Environmental Costs (water, carbon, waste) calculated?', a: 'The Sustainability module prices all three automatically from the selected country: Water = engine WUE × an ASHRAE climate-zone multiplier × the local $/kgal rate for the water source (deep-sea cooling switches to a $0 seawater basis). Carbon = scope-2 emissions × the country\'s compliance carbon price (40-country table, e.g. Singapore ~$33/t, EU ETS ~$61/t, Sweden ~$120/t); countries without a scheme use a labeled voluntary $10/t. Waste uses screening bands (~2 t/MW-IT plus ~150 kg/MW e-waste, priced by developed/emerging market band). Changing the country updates every rate.' },
    { category: 'ESG & Carbon', q: 'What is RE100 and how does it apply?', a: 'RE100 is a global initiative committing companies to 100% renewable electricity. In DC MOC, enabling RE100 mode assumes all purchased electricity comes from renewable sources (via PPAs or RECs), reducing Scope 2 emissions to near-zero while showing the premium cost for green energy procurement.', analogy: 'Switching your home to a certified green-energy plan: the electrons arriving at your socket are physically the same, but your money contractually buys renewable generation somewhere on the grid. You pay a modest premium, and your Scope 2 footprint drops to near zero — auditable, not just claimed.' },
    { category: 'ESG & Carbon', q: 'What are EnPI and IPMVP?', a: 'EnPI (Energy Performance Indicator, ISO 50001) is a normalized metric for tracking energy performance over time — e.g. kWh per kW of IT load adjusted for weather and occupancy. IPMVP (International Performance Measurement & Verification Protocol) is the standard method for PROVING savings: compare actual consumption against an adjusted baseline of what consumption WOULD have been without the improvement.', analogy: 'A bathroom scale plus honest before/after photos taken in the same lighting. EnPI is the scale reading, normalized so a hot month or a fuller building does not masquerade as failure; IPMVP is the discipline of adjusting the "before" photo to identical conditions — the only way to know the diet, not the lighting, made the difference.' },
    { category: 'ESG & Carbon', q: 'What is ERF (Energy Reuse Factor)?', a: 'The fraction of total data center energy that is reused outside the facility — typically waste heat exported to district heating, greenhouses, or neighboring buildings. ERF 0 means all heat is rejected to atmosphere; higher values (common in Nordic sites) mean the same energy does double duty and can earn revenue or planning goodwill.', analogy: 'A bakery piping its oven heat next door to warm the café: same fuel burned once, used twice. ERF measures how much of your "oven heat" gets a second life heating homes instead of venting to the sky — Stockholm data centers literally heat apartments this way.' },
    { category: 'ESG & Carbon', q: 'What are grid services / demand response?', a: 'Revenue streams where a data center helps stabilize the grid: shedding non-critical load, shifting flexible compute, or discharging BESS/generators during system peaks, in exchange for capacity or availability payments from the grid operator. Turns backup assets that normally sit idle into earning assets.', analogy: 'A neighbor with a big generator whom the utility pays a monthly retainer just to be WILLING to switch off (or pitch in) during the evening peak. You are paid for flexibility, not energy — the generator earns money precisely by almost never being needed.' },
    { category: 'ESG & Carbon', q: 'What is curtailment?', a: 'Deliberately reducing generation or consumption because the grid cannot absorb or deliver it — solar/wind output "spilled" when transmission is congested, or data center load capped during grid stress. Curtailment risk matters when underwriting on-site renewables or cheap-but-congested grid connections.', analogy: 'A mango harvest bigger than your trucks can carry: the fruit left rotting in the field is curtailed — real product, zero revenue, because transport (the grid) is the bottleneck, not the orchard. Buying more trees (panels) does not help until you buy more trucks (transmission).' },
    { category: 'ESG & Carbon', q: 'What is BESS augmentation?', a: 'Planned addition or replacement of battery modules over a BESS\'s life to compensate for capacity fade (batteries lose 2-3% capacity/year). A system contracted to deliver 100 MWh in year 10 is either oversized on day one or augmented along the way — the augmentation schedule is a real CAPEX line, not an afterthought.', analogy: 'A flashlight battery pack where you replace the weakest cells every few years so the pack always meets its rated hours. You know on purchase day that cells will fade — so the honest budget includes the future top-ups from the start, rather than discovering them in year six.' },

    // ── Maintenance ──────────────────────────────────────────────
    { category: 'Maintenance', q: 'What is CBM vs TBM?', a: 'CBM (Condition-Based Maintenance) uses real-time sensor data — vibration, temperature, oil analysis — to predict failures and schedule maintenance only when needed. TBM (Time-Based Maintenance) follows fixed calendar intervals regardless of condition. CBM has higher sensor CAPEX but reduces unnecessary interventions by 25-40%.', analogy: 'TBM is changing your car\'s oil every 5,000 km no matter what; CBM is a sensor that analyzes the oil and tells you when it has actually degraded. CBM skips unnecessary garage visits and catches developing problems early — but you pay upfront for the sensors and the discipline to trust them.' },
    { category: 'Maintenance', q: 'How does the spares strategy work?', a: 'The Maintenance module uses ABC Pareto analysis: A-items (top 20% by value, ~80% of total cost) get tight inventory control and safety stock. B-items use standard reorder points. C-items use simplified min/max levels. Lead time, criticality, and holding cost drive the optimal stocking strategy.', analogy: 'A pharmacy does not manage insulin and cotton balls the same way. A-items (expensive, critical, hard to source) get counted daily and locked in the fridge; C-items get a simple "reorder when the bin looks low" rule. ABC applies pharmacy discipline to spare parts.' },
    { category: 'Maintenance', q: 'What is the newsvendor model for spares?', a: 'A classic inventory optimization: choose the stock level where the marginal cost of holding one more spare equals the expected cost of being one short (downtime, expediting, SLA penalties). Given failure rates, lead times, and stockout costs, it yields the optimal quantity per part class — used in DC MOC\'s critical-spares recommendation.', analogy: 'A newspaper seller at dawn: unsold papers are worthless by noon (overstock cost), but selling out early forfeits customers (stockout cost). The optimal print run balances those two regrets — the same dawn decision as stocking $80,000 UPS modules with 20-week lead times against the cost of a hall going dark.' },
    { category: 'Maintenance', q: 'Where do the O&M contract prices come from?', a: 'SLA contract costs are read from the shared engine\'s researched pricing table (DATA.omContracts): fixed-fee bands of roughly $30-60/kW-yr for Comprehensive, $20-40 for Preventive, and $10-20 for On-call coverage, synthesized from public 2024-2026 benchmarks (data-center cost guides and vendor maintenance-ROI studies — screening bands, sources cited in DATA.sources). The SLA tiers map NBD ≈ on-call, 4-hour ≈ preventive, 2-hour ≈ comprehensive × IT kW, with a ×0.65 third-party multiplier and ×1.5 aging-fleet multiplier. Spares unit costs likewise come from an 8-class researched price table (DATA.sparesPricing).' },
    { category: 'Maintenance', q: 'What is DCIM integration?', a: 'Data Center Infrastructure Management (DCIM) software provides real-time monitoring of power, cooling, and environmental conditions. In the Maintenance module, DCIM integration enables predictive maintenance by feeding sensor data into failure prediction models, reducing unplanned downtime by 30-50%.', analogy: 'A smartwatch for the whole building: continuous pulse, temperature, and sleep-quality tracking for every rack and chiller. Instead of an annual physical (the manual inspection round), you spot the arrhythmia weeks before the heart attack.' },
    { category: 'Maintenance', q: 'What is wrench time?', a: 'The fraction of a technician\'s paid shift spent actually working on equipment — typically only 25-35% in unmanaged operations, with the rest lost to travel, waiting for parts/permits, and paperwork. Raising wrench time via planning and kitting is usually cheaper than hiring, and it is a core lever in DC MOC\'s staffing efficiency assumptions.', analogy: 'A surgeon\'s day: 8 hours at the hospital but perhaps 3 in actual surgery — the rest is prep, notes, and walking between wards. Improving wrench time means fixing the walking and the waiting, not rushing the surgery: better planning, parts staged at the machine, permits ready before the shift starts.' },

    // ── Compliance ───────────────────────────────────────────────
    { category: 'Compliance', q: 'What regulatory requirements are covered?', a: 'DC MOC auto-generates compliance checklists per country across 6 categories: Fire Safety (NFPA, local fire codes), Electrical (IEC 62271, IEEE), Environmental (ISO 14001, local EPA), Building (structural codes), Data Protection (GDPR, local privacy laws), and Telecom (licensing requirements). Each item includes authority, standard reference, frequency, and estimated cost.' },
    { category: 'Compliance', q: 'What certification standards are modeled?', a: 'The Compliance module covers: Uptime Institute Tier Certification (design/constructed facility/operations), ISO 27001 (information security), SOC 2 Type II (service organization controls), PCI DSS (payment data), LEED/BREEAM (green building), and country-specific certifications. Initial and annual renewal costs are estimated for each.' },

    // ── Investment ───────────────────────────────────────────────
    { category: 'Investment', q: 'What is the IRR hurdle rate?', a: 'The minimum acceptable Internal Rate of Return for a data center investment to proceed. Typical hurdle rates: 12-15% for core markets, 18-25% for emerging markets. DC MOC flags projects below the hurdle rate as potentially unviable in the Investment module.', analogy: 'Your personal "not worth getting off the sofa" threshold. If a risk-free deposit already pays 6%, nobody sensibly accepts project risk for 7% — and emerging-market data centers must clear 18-25% before the extra risk is worth the trip. Below the hurdle, doing nothing is the better investment.' },
    { category: 'Investment', q: 'How is cap rate used in valuation?', a: 'Capitalization Rate = Net Operating Income / Property Value. For data centers, cap rates typically range 5-8% depending on market, tenant quality, and lease term. Lower cap rates indicate higher valuations. Used in the Investment module for asset valuation and exit pricing.', analogy: 'Judging a rental house by its yearly rent relative to its price: Rp2jt/month rent on a Rp300jt house is an 8% cap rate. When buyers accept a LOWER cap rate, they are accepting less yield because they consider the asset safe — which is exactly the same as bidding its price up.' },
    { category: 'Investment', q: 'What 2026 tax incentives does the Investment module model?', a: 'The Investment module reflects the IRA (Inflation Reduction Act) 2026 incentive schedule for US projects: the Section 48E Investment Tax Credit (ITC) remains available at 30% base (up to 50% with bonus credits for energy communities and domestic content). The 179D Energy-Efficient Commercial Buildings deduction applies to qualifying cooling/lighting upgrades. IRA incentives begin phasing down after 2032. Non-US profiles use country-specific green building subsidies and FIT schemes where available.' },
    { category: 'Investment', q: 'What is an equity waterfall?', a: 'A distribution hierarchy defining how cash flows are split between investors: first, preferred return (8-10% annually) to equity holders, then return of capital, then a promote/carry split (typically 80/20 or 70/30) on remaining profits. DC MOC models the full waterfall including GP promote calculations.', analogy: 'Splitting a catering business with an investor: first she receives her promised 8% return, then her capital back, and only then do you split the remaining profit 80/20. Like water filling stacked pools, each pool must fill completely before a drop spills into the next.' },
    { category: 'Investment', q: 'What is MoIC (Multiple on Invested Capital)?', a: 'Total cash returned divided by total cash invested — a 2.5x MoIC means every dollar in came back as $2.50. It deliberately ignores time: that is IRR\'s job. Investors read the pair together, because a high MoIC over 20 years can be a worse deal than a modest MoIC over 3.', analogy: 'Plant Rp100jt in a warung and walk away years later with Rp250jt — MoIC 2.5x. Achieved in 3 years, that is a triumph; achieved in 20, a savings account would have beaten it. MoIC tells you how big the harvest was; IRR tells you how long you waited for it.' },
    { category: 'Investment', q: 'What is the J-curve?', a: 'The typical shape of cumulative returns on a development project or fund: negative in early years (capital out, fees, construction, lease-up — no revenue) before climbing steeply once the asset stabilizes. Understanding the J-curve stops investors from misreading the planned early dip as failure.', analogy: 'Opening a restaurant: months of renovation, salaries, and marketing with zero revenue dig the dip; the climb only starts after opening night. Investors who panic at the bottom of the J sell at precisely the worst moment — the dip was in the business plan all along.' },
    { category: 'Investment', q: 'What is lease-up?', a: 'The period between a facility opening and reaching stabilized occupancy — typically 18-36 months for a colocation data hall. During lease-up the full cost base runs (debt service, staffing, power minimums) against partial revenue, which is why lease-up assumptions dominate early-year cash flow and DSCR in the model.', analogy: 'A new apartment tower does not fill the day it opens — there are 18-36 months of showings and move-ins while the mortgage runs at full rate. Underestimating lease-up is how "profitable" towers (and data halls) run out of cash while technically succeeding.' },

    // ── Portfolio ────────────────────────────────────────────────
    { category: 'Portfolio', q: 'How does multi-site comparison work?', a: 'The Portfolio module lets you configure up to 6 data center sites with different countries, tiers, IT loads, and cooling types. It generates side-by-side comparisons of CAPEX, OPEX, staffing cost, PUE, and risk scores — plus a radar chart for visual benchmarking across sites.' },
    { category: 'Portfolio', q: 'What is portfolio diversification scoring?', a: 'A metric measuring geographic and operational diversity across your data center portfolio. Higher diversification reduces concentration risk — spreading sites across multiple countries/regions protects against localized disruptions (natural disasters, political instability, grid failures).', analogy: 'Do not put all your eggs in one basket — literally. Six sites in one earthquake zone is still one basket; sites spread across countries and grids mean a typhoon, a blackout, or an election in one place cannot take down the whole portfolio at once.' },

    // ── Strategic Planning ───────────────────────────────────────
    { category: 'Strategic Planning', q: 'What is the Strategic Planning module?', a: 'A decision-support tool with three modes: Feasibility (land + grid to buildable IT load), Acquisition (site bid range and ROI horizon), and Expansion (multi-phase growth scheduling). Use it before committing to option agreements, during due diligence, or when planning capacity growth.' },
    { category: 'Strategic Planning', q: 'How does the Feasibility Mode work?', a: 'Input land area (m²), grid capacity (MW), climate zone, and target PUE. The engine computes: (1) buildable IT load from land (hall floor = 40% of land at 500W/m² IT density), (2) grid-constrained IT load (grid MW / effective PUE), (3) the binding constraint (land or grid), and (4) grid headroom remaining after full build-out. Climate zone applies a PUE penalty ranging from 0% (polar) to +12% (tropical).' },
    { category: 'Strategic Planning', q: 'How is buildable IT load calculated in Feasibility Mode?', a: 'Hall floor area = total land × 40% (remainder used for cooling yards, substation setback, access roads, green buffer). IT density assumption is 500W/m² (conservative mixed-use). Buildable IT kW = hall floor m² × 500W. Grid-constrained IT MW = grid MW / effective PUE. Final IT capacity is min(land-limited, grid-limited).' },
    { category: 'Strategic Planning', q: 'How do I model a land acquisition for a greenfield site?', a: 'Use Feasibility Mode first: enter the land parcel size and utility quote to confirm the site can deliver the target IT capacity. Then switch to Acquisition Mode: enter the seller ask price per MW and three recent market comparables to get a fair value range, bid floor, bid ceiling, and ROI horizon. If the ask is within the ceiling, proceed to due diligence.' },
    { category: 'Strategic Planning', q: 'How is the Acquisition bid range calculated?', a: 'Fair value = average of the three comparable transactions. Bid floor = 88% of fair value (aggressive). Ceiling = fair value × risk multiplier (1.0x–1.5x, reflecting site-specific risk: seismic zone, grid reliability, permitting risk). Cap rate = estimated annual NOI / total investment. Simple payback = total investment / annual NOI, assuming $150/kW-month colocation revenue at 5 MW.' },
    { category: 'Strategic Planning', q: 'What is the 80% utilization trigger in Expansion Mode?', a: 'Industry standard: when a facility reaches 80% of committed capacity, lead time to break ground on the next phase must begin immediately. Given typical construction timelines of 18-24 months and grid reservation requirements of 12-24 months ahead, the 80% trigger gives a 6-month buffer to avoid SLA violations. DC MOC calculates which year in the demand timeline crosses this threshold and flags it as the recommended action date.', analogy: 'When a family fills 80% of their house, they start hunting for a bigger one BEFORE the third child arrives — because moving takes a year. With 18-24-month construction and equally long grid queues, 80% utilization is the "start hunting now" alarm, not a comfortable margin.' },
    { category: 'Strategic Planning', q: 'How does grid reservation lead time affect expansion planning?', a: 'Most grid operators require formal capacity reservation 12-24 months before energization. The Expansion module subtracts this lead time from the phase start year to show when the grid application must be filed. Failing to reserve early risks delaying the phase by 1-2 years, which can cause SLA breaches if demand growth is faster than expected.', analogy: 'Booking a wedding venue: the popular hall is reserved 18 months out, and no amount of money conjures a free Saturday next month. Grid capacity works the same way — file the application when you break ground, or the finished building will sit dark waiting for its connection.' },
    { category: 'Strategic Planning', q: 'What CAPEX per MW should I use for expansion phases?', a: 'Default is pulled from your active CAPEX Config module. You can override it in Expansion Mode. Typical ranges (2025-2026): emerging markets $4-6M/MW, developed markets $7-10M/MW, AI-ready (liquid cooled, high density) $12-18M/MW. The CAPEX module provides a more granular estimate based on your specific configuration.' },
    { category: 'Strategic Planning', q: 'Can I use Strategic Planning for a power purchase agreement (PPA) assessment?', a: 'Yes. Use Feasibility Mode to confirm the site power envelope, then use the Acquisition Mode to assess the PPA rate per MW against market comparables. The ROI output reflects the cost of energy procurement relative to colocation revenue. For RE100 compliance modeling, use the Carbon/ESG module in combination.' },
    { category: 'Strategic Planning', q: 'How does climate zone affect PUE and what is the impact on operating cost?', a: 'PUE climate penalty: polar +0%, temperate +3%, continental +5%, arid +8%, tropical +12% above your target PUE. For example, a 1.40 target PUE in a tropical climate becomes 1.52 effective PUE. At 10MW IT load and $0.10/kWh, each 0.10 PUE increase adds ~$876K/year in energy cost. Climate zone is the single largest uncontrollable driver of long-term OPEX for data centers in Southeast Asia and the Middle East.', analogy: 'Cooling a data center in Jakarta versus Oslo is like keeping drinks iced on a beach versus in the snow — the identical job simply demands far more effort in the tropics. That +12% PUE penalty then compounds through every hour of every year straight into the power bill.' },

    // ── Delivery & PM ────────────────────────────────────────────
    { category: 'Delivery & PM', q: 'What are RFI, Submittal, ITP, and NCR?', a: 'The four core construction quality documents. RFI (Request for Information): a formal question when drawings and site reality conflict. Submittal: contractor\'s proposed materials/shop drawings sent for approval BEFORE installation. ITP (Inspection & Test Plan): the pre-agreed schedule of what gets inspected, by whom, at which hold points. NCR (Non-Conformance Report): the formal record when installed work fails spec, tracked until corrected and re-verified.', analogy: 'Classroom versions of each: an RFI is a student raising a hand ("the textbook says X but the board says Y — which?"); a submittal is showing your homework before it is graded; the ITP is the exam schedule agreed at the start of term; an NCR is the red mark that must be corrected and re-checked before the grade stands.' },
    { category: 'Delivery & PM', q: 'What is a punch list?', a: 'The list of remaining defects and incomplete items compiled at substantial completion — door misalignments, missing labels, one failed damper — that the contractor must clear before final acceptance and release of retention payment. A disciplined punch process is the difference between a clean handover and a year of warranty disputes.', analogy: 'The walkthrough of a new house before you accept the keys: scuffed paint, a sticking door, one dead power socket. Individually small — but the developer only receives final payment when the list reaches zero, which is precisely what makes the list get cleared.' },
    { category: 'Delivery & PM', q: 'What is a turnover dossier?', a: 'The complete documentation package handed from the construction project to the operations team: as-built drawings, O&M manuals, warranties, commissioning test records, setpoint schedules, spare parts lists, and training records. Facilities with poor turnover dossiers pay for it for a decade in slower troubleshooting and voided warranties.', analogy: 'Buying a used car with the full service book, both keys, and every manual in the glovebox — versus one with nothing. The machine is identical on day one; only one of them can be maintained, warrantied, and resold with confidence for the next ten years.' },
    { category: 'Delivery & PM', q: 'What is a look-ahead schedule?', a: 'A rolling 2-6 week detailed slice of the master schedule, reviewed weekly with all trades: exactly which crews, deliveries, permits, and shutdowns happen in the near window. Master schedules steer the project; look-aheads are where delays are actually caught and prevented, task by task.', analogy: 'On a road trip, the master schedule is the country map; the look-ahead is the next 50 km — the roadworks, the fuel stop, the lunch break. You steer with the 50-km view and consult the map only to confirm direction. Projects that steer by the map alone hit every pothole.' },
    { category: 'Delivery & PM', q: 'What is decision velocity?', a: 'How fast decisions travel through the project organization — from question raised to binding answer. Slow decision cycles (multi-week RFI turnarounds, committee approvals for minor changes) stall the critical path just as surely as late steel. Measured and managed teams answer routine questions in days, not weeks.', analogy: 'A restaurant kitchen where every single dish needs the owner\'s personal tasting before it leaves the pass: the food dies under the heat lamp. Projects starve the same way when every routine question waits two weeks for a signature — the crews stand idle exactly like the cooling plates.' },
    { category: 'Delivery & PM', q: 'What is a delegation of authority (DoA) matrix?', a: 'The written matrix defining who may approve what — by spend value, contract change, schedule impact, and risk class. A good DoA pushes routine approvals to site level and reserves genuinely material decisions for executives, which is the structural fix for slow decision velocity.', analogy: 'ATM limits: the teller can approve Rp5jt, the branch manager Rp500jt, the board Rp50M. Nobody emails the CEO to withdraw pocket money — and a site engineer should not need HQ sign-off for a $500 valve while the hall waits.' },
    { category: 'Delivery & PM', q: 'What is an AACE Class 4 estimate?', a: 'An early-stage cost estimate per AACE International\'s classification, produced at 1-15% engineering definition with an expected accuracy of roughly -30% to +50%. Class 4 numbers are for screening and concept selection; Classes 3 → 1 tighten as design matures. Quoting a Class 4 midpoint as a firm budget is a classic project failure mode.', analogy: 'A contractor glancing at an empty plot and saying "roughly 2 to 3 billion rupiah" — honest and useful as a range, dangerous the moment someone deletes the range and writes the midpoint into a contract. The class number is a warning label about how much design work stands behind the estimate.' },
    { category: 'Delivery & PM', q: 'What do P50 and P80 mean for schedules and budgets?', a: 'Confidence levels from probabilistic analysis: a P50 completion date is beaten half the time; a P80 date is met with 80% confidence. Owners typically fund at P50 and commit externally at P80 — the gap between them is the schedule/cost contingency, sized by the project\'s actual risk profile rather than a flat percentage.', analogy: 'You tell a friend you will arrive in 45 minutes (your median — P50), but you tell your boss 60 minutes (P80), because being late to the boss is expensive. Same trip, different promise for different audiences — and the 15-minute difference is your contingency, deliberately chosen, not padding.' },
    { category: 'Delivery & PM', q: 'What are EVM, SPI, and CPI?', a: 'Earned Value Management tracks a project on both time and money simultaneously. SPI (Schedule Performance Index) = value of work performed ÷ work planned to date; CPI (Cost Performance Index) = value of work performed ÷ actual cost spent. 1.0 is on-plan; below 1.0 is behind/over. EVM\'s power is catching projects that are spending on schedule while producing behind schedule.', analogy: 'Writing a 10-chapter book in 10 weeks: after 5 weeks you have 4 chapters done (SPI 0.8 — behind) and you have already consumed 6 weeks\' worth of budget (CPI 0.67 — over). A raw spend report would show "60% of budget used, roughly on track". EVM exposes the truth: busy, late, AND over budget.' },
    { category: 'Delivery & PM', q: 'What are commissioning levels L1-L5?', a: 'The staged verification ladder: L1 factory acceptance tests at the vendor, L2 site delivery inspection, L3 pre-functional checks (installed correctly, wired, labeled), L4 functional performance tests of each system alone, L5 integrated systems test — the whole facility exercised together, including pull-the-plug failure scenarios at full load bank.', analogy: 'Testing a wedding: taste the catering at the vendor (L1), check the deliveries at the venue (L2), test the mic and the lights individually (L3-L4), then run a full rehearsal with everyone in the room (L5). Skipping the rehearsal is where weddings — and data centers — fail in front of everyone.' },
    { category: 'Delivery & PM', q: 'What is contingency and how should it be managed?', a: 'A reserve for known-unknowns — risks you can name statistically but not specifically — sized to the estimate class (Class 4 might carry 20-30%; Class 2, 10-15%) and DRAWN DOWN formally as risks retire or materialize. Contingency spent silently on scope creep is the most common way projects arrive at the real surprise with an empty reserve.', analogy: 'The extra cash you carry when traveling: not allocated to the itinerary, but for the missed connection you cannot predict specifically yet statistically expect. Spend it on souvenirs (scope creep) and there is nothing left when the taxi actually breaks down at midnight.' },
];

const CATEGORIES = ['General', 'Financial', 'Infrastructure', 'Staffing', 'Analytics', 'Capacity', 'Risk', 'ESG & Carbon', 'Maintenance', 'Compliance', 'Investment', 'Portfolio', 'Strategic Planning', 'Delivery & PM'];

/* ── Auto glossary (window.RZ_EXPLAIN_DB) ─────────────────────────────────
 * Companion to the per-key bridge in src/lib/explain.ts (same SSR-guarded
 * window read, same ExplainEntry shape) — here we enumerate the whole DB to
 * render a searchable glossary. Null when the DB has not loaded (incl. SSR). */
interface GlossaryRow {
    key: string;
    t: string;
    d: string;
    u?: string;
    f?: string;
}

function readExplainGlossary(): GlossaryRow[] | null {
    if (typeof window === 'undefined') return null;
    const db = (window as unknown as { RZ_EXPLAIN_DB?: { entries?: Record<string, ExplainEntry | undefined> } }).RZ_EXPLAIN_DB;
    const entries = db?.entries;
    if (!entries) return null;
    const rows: GlossaryRow[] = [];
    for (const [key, e] of Object.entries(entries)) {
        if (!e || !e.t || !e.d) continue;
        rows.push({ key, t: e.t, d: e.d, u: e.u, f: e.f });
    }
    rows.sort((a, b) => a.t.localeCompare(b.t));
    return rows;
}

const GLOSSARY_PAGE_SIZE = 50;

export function FaqDashboard() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [glossary, setGlossary] = useState<GlossaryRow[] | null>(null);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    const [glossaryPage, setGlossaryPage] = useState(0);

    // Resolve the shared explain DB after mount (defer-loaded script); retry a
    // few times in case the script executes after this component mounts.
    useEffect(() => {
        let cancelled = false;
        let tries = 0;
        const attempt = () => {
            if (cancelled) return;
            const rows = readExplainGlossary();
            if (rows) { setGlossary(rows); return; }
            tries += 1;
            if (tries < 8) setTimeout(attempt, 750);
        };
        attempt();
        return () => { cancelled = true; };
    }, []);

    const q = search.trim().toLowerCase();
    useEffect(() => { setGlossaryPage(0); }, [q]);

    const matchesSearch = (item: FaqItem) =>
        !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        || (item.analogy ?? '').toLowerCase().includes(q) || item.category.toLowerCase().includes(q);

    const filtered = FAQ_DATA.filter(f => (activeCategory === 'all' || f.category === activeCategory) && matchesSearch(f));

    const glossaryFiltered = useMemo(() => {
        const rows = glossary ?? [];
        if (!q) return rows;
        return rows.filter(r => r.t.toLowerCase().includes(q) || r.d.toLowerCase().includes(q) || r.key.includes(q));
    }, [glossary, q]);

    const glossaryPageCount = Math.max(1, Math.ceil(glossaryFiltered.length / GLOSSARY_PAGE_SIZE));
    const safeGlossaryPage = Math.min(glossaryPage, glossaryPageCount - 1);
    const glossaryPageRows = glossaryFiltered.slice(safeGlossaryPage * GLOSSARY_PAGE_SIZE, (safeGlossaryPage + 1) * GLOSSARY_PAGE_SIZE);
    const showGlossaryList = glossaryOpen || q.length > 0;

    return (
        <div className="space-y-6">
            {/* AH2 — link to the Value Binding & Sync Manual */}
            <div className="rounded border border-rz-mint/30 bg-rz-mint/5 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Where does every number come from?</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Every KPI and computed value in DC-OS is documented in the <b>Value Binding &amp; Sync Manual</b>:
                    its source parameters, the exact formula or engine function, and every page that consumes it —
                    one origin per value, verified by the cross-page synergy probe.
                </p>
                <button onClick={() => useSimulationStore.getState().actions.setActiveTab('knowledge')}
                    className="mt-2 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/80">
                    Open the Value Binding Manual →
                </button>
            </div>
            {/* BF2 — AUTO-GENERATED engine & data reference (renders engine-catalog.json;
              * regenerated by tools/build-engine-catalog.mjs on every engine change,
              * staleness-gated — this section can never drift from the engine) */}
            <div className="rounded border border-emerald-500/30 bg-emerald-600/5 p-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Engine &amp; Data Reference</h3>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">auto-generated</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    DC-OS computes from the shared RZ Engine: <b>{ENGINE_CATALOG.modelCount} model namespaces</b> ·{' '}
                    <b>{ENGINE_CATALOG.functionCount} functions</b> · <b>{ENGINE_CATALOG.sourceCount} sourced data tables</b> (DATA v{ENGINE_CATALOG.dataVersion}).
                    Every function&apos;s parameters, provenance and real consumers (site calculators + DC-OS modules, auto-detected from usage)
                    are listed in the Knowledge Base — regenerated automatically whenever the engine changes, so this reference is always current.
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                    Engine-bound article calculators:{' '}
                    {[...new Set(ENGINE_CATALOG.namespaces.flatMap((n) => n.consumers.filter((c) => c.startsWith('article-'))))].sort().join(' · ') || '—'}
                </p>
                <button onClick={() => useSimulationStore.getState().actions.setActiveTab('knowledge')}
                    className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                    Open the Engine Catalog →
                </button>
            </div>
            {/* Header */}
            <div className="p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl backdrop-blur-sm shadow-sm dark:shadow-none">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                    FAQ &amp; Glossary
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                    Key terms and concepts used across DC MOC modules — many with an everyday analogy, plus the live engine glossary below
                </p>
            </div>

            {/* Quick-start guide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: <BookOpen className="w-4 h-4 text-cyan-500" />, title: 'Start Here', desc: 'Set country in CAPEX Config, then open Scenario Model to set IT load and shift pattern. All modules sync automatically.' },
                    { icon: <Target className="w-4 h-4 text-indigo-500" />, title: 'Investment Workflow', desc: 'CAPEX Config → Financial → Investment → Monte Carlo. Generates NPV, IRR, DSCR, and P10/P90 confidence intervals.' },
                    { icon: <TrendingUp className="w-4 h-4 text-rz-mint" />, title: 'Strategic Planning', desc: 'Use Strategic Planning module for land feasibility, site acquisition due diligence, or multi-phase expansion scheduling.' },
                    { icon: <BarChart3 className="w-4 h-4 text-emerald-500" />, title: 'Scenario Comparison', desc: 'Save configurations as named scenarios, then select 2+ to compare side-by-side in the Scenario Manager panel.' },
                ].map(item => (
                    <div key={item.title} className="p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">{item.icon}<span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.title}</span></div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            {/* Search — filters BOTH the curated FAQ and the auto glossary */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search FAQ, analogies & engine glossary…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                />
                {q && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                        {filtered.length} FAQ · {glossary === null ? '—' : glossaryFiltered.length} glossary
                    </span>
                )}
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
                {filtered.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-400">
                        No FAQ entries match &quot;{search}&quot; in this category — check the Engine Glossary results below.
                    </p>
                )}
                {filtered.map((item) => {
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
                                {item.analogy && (
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-500/70 shrink-0" aria-label="Has analogy" />
                                )}
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 shrink-0">
                                    {item.category}
                                </span>
                            </button>
                            {isOpen && (
                                <div className="px-5 pb-4 pl-12">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {item.a}
                                    </p>
                                    {item.analogy && (
                                        <div className="mt-3 flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
                                                <span className="font-semibold">Analoginya: </span>
                                                {item.analogy}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Engine Glossary (auto) — every entry from the shared explain DB */}
            <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setGlossaryOpen(o => !o)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                    {showGlossaryList
                        ? <ChevronDown className="w-4 h-4 text-cyan-500 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    }
                    <Library className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span className="text-sm font-semibold flex-1 text-slate-800 dark:text-slate-200">
                        Engine Glossary (auto)
                        {glossary !== null && (
                            <span className="ml-2 text-[11px] font-normal text-slate-400">{glossaryFiltered.length} terms</span>
                        )}
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500 shrink-0">auto-generated</span>
                </button>
                {showGlossaryList && (
                    <div className="border-t border-slate-100 dark:border-slate-800">
                        <p className="px-5 pt-3 pb-2 text-[10px] text-slate-400">
                            Single source: site glossary + curated engine terms (window.RZ_EXPLAIN_DB, built by tools/build-explain-db.py) — always current with the engine.
                        </p>
                        {glossary === null ? (
                            <p className="px-5 pb-4 text-xs text-slate-500 dark:text-slate-400">
                                The shared explain DB has not loaded (js/rz-explain-db.js). Open this page on the deployed site or hard-refresh —
                                the curated FAQ above is fully available meanwhile.
                            </p>
                        ) : glossaryFiltered.length === 0 ? (
                            <p className="px-5 pb-4 text-xs text-slate-400">No glossary terms match &quot;{search}&quot;.</p>
                        ) : (
                            <>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {glossaryPageRows.map(r => (
                                        <div key={r.key} className="px-5 py-2.5">
                                            <div className="flex flex-wrap items-baseline gap-2">
                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{r.t}</span>
                                                {r.u && <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400">{r.u}</span>}
                                            </div>
                                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{r.d}</p>
                                            {r.f && <p className="mt-0.5 font-mono text-[10px] text-slate-400">{r.f}</p>}
                                        </div>
                                    ))}
                                </div>
                                {glossaryPageCount > 1 && (
                                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                                        <button
                                            onClick={() => setGlossaryPage(p => Math.max(0, p - 1))}
                                            disabled={safeGlossaryPage === 0}
                                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400"
                                        >
                                            ← Prev
                                        </button>
                                        <span className="text-[10px] text-slate-400">
                                            Page {safeGlossaryPage + 1} of {glossaryPageCount} · {glossaryFiltered.length} terms
                                        </span>
                                        <button
                                            onClick={() => setGlossaryPage(p => Math.min(glossaryPageCount - 1, p + 1))}
                                            disabled={safeGlossaryPage >= glossaryPageCount - 1}
                                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
