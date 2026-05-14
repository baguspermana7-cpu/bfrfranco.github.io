# Two Inputs, One Heatmap: How Sensitivity Surfaces Answer "What Should I Fix First?"

(74-char title: "Two Inputs, One Heatmap: Sensitivity Surfaces for Spares Decisions")

When a data-center spares manager faces a stockout risk, the instinctive question is: which lever do I pull? Reduce lead time? Stock up? Qualify a second supplier? Switch to a lower-cost alternative?

The answer depends on the sensitivity surface — the shape of the output metric across the space of all possible input combinations.

The new Sensitivity Surfaces tab in Critical Spares Engine (v1.18.13) makes this tangible. Select any two inputs from eight candidates (failure rate, lead time, demand, severity, alternates, carrying cost, unit cost, under-stock cost). Select an output metric from six (fill rate, total cost, RPN, P(stockout), optimal Q*, expected backorders). Set the sweep range. The tab builds an N x N grid, computes the metric at each cell using the same formulas as the live Criticality, Stock, and MEIO modules, and renders a viridis heatmap.

The viridis colour ramp (dark purple = low, yellow-green = high) is perceptually uniform and colour-blind safe. Per-cell monospace labels give the exact value. The "Most Sensitive Variable" card identifies which axis drives more variation using a first-order one-at-a-time sensitivity index.

No new math is introduced. The value is in the visual: seeing the metric landscape across the full input range, not just at the current operating point.

Try it at resistancezero.com/spares-readiness-calculator.html
