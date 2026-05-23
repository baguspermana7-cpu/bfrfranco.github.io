# Medium — BMS Cockpit cluster

**SEO title** (≤74): The Data-Center Cockpit Above the SCADA — An Industrial-Instrumentation Take

**Subtitle**: Eleven cockpit pages for power, cooling, fire, fuel, water, ICT, and carbon — with PDF Tech Specs and engine-cited cost annexes.

**Tags** (5): Data Center, BMS, DCIM, SCADA, Facilities Engineering

---

Most DCIM software is built by people who have never run a 3 am shift.

The dashboards are pretty. The chart libraries are modern. The data is
real. But the layer that's missing is the one engineers actually need:
the decision layer that sits above the SCADA — the place where you
look at the live kW, the trend, and the budget envelope, and you ask
"do I escalate this or do I let it ride."

The cockpit cluster we shipped this month on resistancezero.com is one
attempt at that layer. Eleven pages. Power, cooling, fire, fuel, water,
ICT, carbon, plus two AI / conventional datahall overviews and the
solutions landing.

[... continue with technical walkthrough ...]

The discipline that made the difference:

— Lines are tier-graded. 500 kV gets a 1.6 px stroke. 70 kV gets 0.7 px.
  A glance at the line topology tells you the voltage class before you
  read the label.

— Palette is industrial-instrumentation. Instrument-cyan for informational,
  signal-amber for advisory, oscilloscope-green for healthy operating
  state, fault-red for alarm. ISA-18.2 colour discipline. No
  Anthropic-purple anywhere, no glassmorphism, no neon-glow.

— Typography is IBM Plex Sans for labels and JetBrains Mono for numerics.
  Every numeric column is tabular-nums. Numbers align. Always.

— Tech Spec PDF is one click away on every cockpit page. The PDF
  expands the full discipline (electrical, cooling, fire, network, BMS,
  carbon, water, fuel) and closes with a Section 10 Cost Annex driven
  by the page's live facility kW.

— The Cost Annex cites JLL's 2024-2025 construction report, Cushman &
  Wakefield, IEA industrial tariffs, and Uptime Institute's MAINT
  benchmark. The numbers are public and the math is reproducible.

What we explicitly did NOT do:

— No SCADA-style setpoint control. The cockpit reads, does not write.
— No real-time alarm management. That layer is already crowded with
  serious-engineering products. We don't need to compete there.
— No vendor lock-in pivot. Every page is a public HTML file with cited
  methodology. If you want to take the math and put it into your own
  Power BI / Grafana — go ahead.

The hardest design call was the colour discipline. The temptation to
add gradients, glow, or animated particle effects is real and constant
— it makes screenshots look "modern." But every gradient you add
costs you a credibility step with the engineers you're trying to win.
We held the line. Thin strokes, flat fills, no decoration.

If you run a mission-critical estate and your current dashboard story
is three Niagara stations, two Schneider PME tabs, and a WhatsApp group —
the cockpit cluster is for you to evaluate.

---

(Run through humaniser pass before publishing.)
