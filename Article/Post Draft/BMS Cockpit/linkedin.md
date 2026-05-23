# LinkedIn — BMS Cockpit cluster (v1.29.x)

**Format**: long-form, instrument-grade tone.
**Char target**: ~1,700.
**Tags**: #DataCenter #BMS #DCIM #SCADA #FacilitiesEngineering

---

We just shipped a Building Management System cockpit cluster on
resistancezero.com. Eleven pages covering every discipline a DC operator
touches on the night shift.

EPMS telemetry. Chiller plant. Fire system. Fuel system. Water system.
ICT load. Carbon footprint. Datahall AI. Datahall conventional. The
overall datacenter solutions landing.

The design brief was simple. Build the dashboard you wish your last
client had instead of three Niagara stations, two Schneider PME tabs,
and a WhatsApp group.

The execution discipline was: thin instrumentation lines (0.6 to 1.4 px,
tier-graded — high-voltage gets a heavier stroke); industrial palette
(instrument-cyan, signal-amber, oscilloscope-green, fault-red — no
Anthropic-purple, no glassmorphism, no neon glow); IBM Plex Sans labels
and JetBrains Mono numerics; every numeric tile tabular-nums so columns
align under live data.

What lands different from a typical DCIM:

- Tech Spec PDF on every cockpit page. Click-to-export, full discipline
  expansion, includes a Section 10 Cost Annex with CAPEX, OPEX, and
  10-year TCO using the page's live facility kW.
- Engine-derived. CAPEX uses AI-factory bands ($10-14 M / MW IT) for
  DC AI; enterprise bands ($7-11 M / MW IT) for DC Conventional. Cited
  to JLL, Cushman & Wakefield, IEA tariffs, Uptime MAINT benchmarks.
- Sensitivity grid baked in: tariff sweep at $0.06 / $0.09 / $0.12 per kWh.
- All eleven pages share `rz-engine.min.js` so the math is consistent
  across cockpits.

What it is not:

It is not a SCADA replacement. The cockpit cluster is a thinking and
decision-making layer, not a control layer. Real-time setpoint changes
still belong in your DCS.

It is not a sales document. The pages are PRO tier on the site but the
methodology is openly cited. Critique welcome.

Closest comparable: Vertiv Trellis, Schneider EcoStruxure Power Monitoring,
Niagara dashboards. We are at fraction of the cost — and openly,
we are at fraction of the scope. The cockpit is for the engineer who
needs the numbers to make a budget pitch on Tuesday, not for the operator
who needs to bypass a breaker on Friday night.

Worth a look if your team is wrestling with how to industrialise the
facility decision layer above the SCADA.

#DataCenter #BMS #DCIM #SCADA #FacilitiesEngineering
