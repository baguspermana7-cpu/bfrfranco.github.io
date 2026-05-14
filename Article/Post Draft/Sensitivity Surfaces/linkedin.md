One question every spares manager struggles to answer: "Which input should I fix first?"

Is it the 22-week lead time? The climbing failure rate? The single-source supplier situation? The unit cost doubling after a tariff round?

The answer depends on where you sit on the sensitivity surface.

Critical Spares Engine v1.18.13 adds a Sensitivity Surfaces tab to help you find out.

How it works:
- Pick any 2 inputs (failure rate, lead time, demand, severity, carrying cost, unit cost...)
- Choose an output metric (fill rate, total cost, RPN, P(stockout), optimal Q*, expected backorders)
- Set a sweep range (50% to 150% of current values by default)
- The tab sweeps an N x N grid (5x5, 7x7, or 9x9) and renders a viridis heatmap

The heatmap shows you at a glance which axis drives more variation. The "Most Sensitive Variable" card quantifies it using a first-order OAT sensitivity index. The "X/Y at Extremum" cards tell you the exact input combination that maximises your chosen metric.

No new math. Same formulas as the live Criticality, Stock, and MEIO modules — just swept across a grid so you can see the landscape.

Try it at resistancezero.com/spares-readiness-calculator.html (Tab 10, Analytical group).
