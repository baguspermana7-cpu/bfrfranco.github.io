# SCADA/BMS Operator Cockpit — Design Basis

Status: implementation reference
Owner: ResistanceZero
Visual reference: `scada-bms-operator-cockpit-v1.png`

## Intent

Build a dense operator workspace that reads like a control-room HMI, not a SaaS dashboard. The generated visual is a composition reference only. Engineering values, states, symbols, and cause/effect behavior must come from governed code and tests.

## Non-negotiable visual contract

- IBM Plex Sans for labels; JetBrains Mono for tags, timestamps, and telemetry.
- Flat near-black/navy surfaces, 1 px tiered borders, restrained corner radii.
- Instrument cyan = measured flow/temperature or simulated provenance.
- Oscilloscope green = proven healthy/normal only.
- Signal amber = warning, selected planning study, or attention.
- Fault red = critical/trip/breach only.
- Gray = standby, unavailable, stale, or unproven authority.
- No gradients, glassmorphism, glow, dot-grid decoration, floating hero cards, or decorative motion.
- The main schematic/heatmap owns the visual hierarchy; rails support it and never overlap it.
- Feed identity and equipment state use separate visual channels: Feed A is red, Feed B green;
  energized/open/tripped is then communicated by motion/line pattern plus explicit text and symbols.
- `prefers-reduced-motion` stops flow, machinery and decorative effects while retaining every static
  command, feedback, permissive and alarm indication.

## Operator-shell hierarchy

1. Compact global header: identity, navigation, current mode, primary actions.
2. Persistent provenance instrument: `SIMULATED · ENGINE BASIS`; never claim live telemetry.
3. System status strip: alarm counts, communications, selected scope, last update.
4. Primary operator surface: heatmap/P&ID/topology.
5. Inspection and cause/effect rail.
6. Event log/history with filters.

At narrow widths, action rails may wrap or scroll horizontally. The primary schematic uses its own pan region; the document itself must not acquire horizontal overflow.

The following foreground and first-paint rules are also mandatory:

- Engine-owned KPIs are instruments, not decorative counters. They render the exact authority value
  immediately; no count-up or plausible intermediate value is allowed.
- A mobile telemetry spine starts compact and remains explicitly expandable through an unobscured
  operator control. Desktop and mobile preferences are stored independently.
- An open engineering drawer owns the foreground. Public header links yield until it closes, and every
  evidence table wraps long values/source identifiers without clipping.
- Localhost and `file:` previews must not depend on third-party geolocation requests.
- A local preview also discards any previously cached production-like geolocation before recording events.
- Each audit target exposes one route-specific `data-rz-cockpit-root`. Audit tooling removes only exact
  authentication overlays, preserves feature dialogs, and fails non-zero for wrong/missing roots or captures.
- Conventional phone alarm summaries use three balanced metric columns with full-width state/context rows;
  all telemetry numerics use tabular and slashed-zero figures.

## Page-specific decisions

### Conventional data hall

- Default view is rack-inlet temperature because the primary operator question is thermal state.
- 18–27 °C is the recommended rack-inlet band and renders normal green; below 18 °C is low/attention, above 27 °C is high, and above 30 °C is critical.
- Power-density mode remains available and uses utilization colors independently from temperature.
- Hall reconciliation is `UNAVAILABLE` because no governed hall EPMS submeter exists. The 30 MW divided by four halls figure is shown only as a neutral equal-share planning reference, never as measured reconciliation.

### Chiller plant

- Preserve the ISA-style P&ID and all diagnostic interactions.
- Use normal document scrolling so the complete P&ID and status strip remain reachable; never crop the process mimic to the viewport.
- Alarm envelopes derive from the current per-machine flow and CHWR design planes, not retired absolute limits.
- Hall A–D is view context only; the central plant telemetry basis does not change.

### Fire protection

- Authority is fail-closed: missing or legacy data cannot render `NORMAL`, online, healthy, or green pump status.
- The right rail exposes the staged cause/effect sequence and downstream feedback separately.
- Current 30 MW/site basis and the 40 MW planning study remain visibly separated.
- FACP panel health and fire-water reserve adequacy are separate instruments. A reserve-design
  deficit is amber and cannot silently promote a normal FACP into a fabricated supervisory alarm.
- Use recognized centrifugal-pump/process symbols and keep equipment labels clear of pipe centerlines.

### EPMS

- Source identity stays visible through every selected ATS-to-rack path, including aggregate rack
  groups; do not reinterpret a source color as a trip state.
- Context strips, toolbar, SLD viewport, inspector rail and bottom status bar own distinct geometry.
  Fit calculations use rendered chrome dimensions rather than fixed desktop constants.
- Aggregate symbols state their group scope and capacity; they never imply unavailable per-rack
  voltage, current, power factor or frequency telemetry.

### Site water treatment

- Municipal/treatment infrastructure is one site-wide shared plant; no Hall A–D selector.
- Current basis is 30 MW IT site-wide. A 40 MW study is read-only and cannot mutate live/current pumps, flow, or WUE.
- Per-hall allocation is `UNAVAILABLE` until validated submeter data exists.

### AI/HPC data hall

- Current GB200 cockpit remains independent from Conventional DC authority.
- The wide provenance banner becomes a compact cyan header instrument with a 44 px dismiss target.
- Header identity states `Simulated`, never `Live Telemetry`.
- Header, provenance, actions, and tabs must not overlap at desktop or mobile widths.
- Authentication and account chrome inherit the same flat industrial register; no purple gradient,
  glow, glass treatment or exaggerated radius may appear above the cockpit.

## Verification contract

- Browser assertions cover first-paint and runtime state, not only source strings.
- No visible `NaN`, `null`, `undefined`, stale 1.85 MW basis, or healthy fallback from unavailable authority.
- Puppeteer geometry checks cover desktop and mobile viewports.
- Dark/light coverage, keyboard focus, alarm historian, responsive layout, and engineering accuracy remain release-blocking.
