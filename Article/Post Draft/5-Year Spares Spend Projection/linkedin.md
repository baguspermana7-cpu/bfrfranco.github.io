Most DC spares budgets are built on Year 0 assumptions that will not hold for 5 years.

Fleet grows. Equipment ages. Parts get harder to source. Inflation compounds. What looks like a comfortable buffer in Year 1 becomes a crisis by Year 4.

Critical Spares Engine v1.18.14 adds a 5-Year Spend Projection tab to help you see that curve before you're living it.

How it works:
- Set your installed base (MW), fleet growth %, equipment age-related failure rate drift, and cost inflation
- Choose a forecast horizon (3, 5, 7, or 10 years) and a commodity mix profile (balanced / chiller-heavy / electrical-heavy / IT-heavy)
- The tab projects annual replacement and maintenance spend year by year across 8 commodity classes

The 8 classes — Chillers, Transformers / Switchgear, UPS Systems, PDU / Floor Distribution, Network, Mechanical, Sensors / Controls, and Consumables — use industry-calibrated failure rates and unit costs as defaults. All compounding is explicit: (1+growth)^Y for fleet size, (1+drift)^Y for failure rates, (1+inflation)^Y for costs.

Output: stacked area chart (Chart.js), year-by-year data table with cumulative column, and 4 KPI cards (total horizon spend, Year-N run-rate, growth vs Year 0, and largest commodity class by cumulative spend).

This completes the v1.17 analytical plan — all three remaining tabs from that plan are now live.

Try it at resistancezero.com/spares-readiness-calculator.html (Tab 11, Analytical group).
