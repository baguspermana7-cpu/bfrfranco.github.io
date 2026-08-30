---
title: Conventional DC Operations Standard
type: standard-mirror
source: standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md
updated: 2026-08-30
---

# Conventional DC Operations

Canonical source: [[../../../../standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md|CONVENTIONAL_DC_OPERATIONS_STANDARD.md]].

## Locked decisions

- Current simulated operation is the adopted 4 × 7,500 kW scenario: 30,000 kW campus IT,
  43,500 kW facility input at PUE 1.45. It remains simulated/adopted, never measured.
- Capacity study is independent: four 10 MW IT halls, 500 racks/hall, 20 kW/rack average.
- Cooling contract is chilled-water CRAH / air cooling with 25.4 °C as a project rack-inlet
  target inside the ASHRAE recommended 18–27 °C envelope.
- dPUE 1.45 is a design-point value only; off-design facility load fails closed without an
  approved monotonic curve.
- Study heat rejection is evaporative cooling tower; water balance is conditional on that choice.
- Hall A–D selection changes context, never the frozen current model or study authority.
- A study that fails rack, thermal, resilience or efficiency checks cannot emit facility-load values.
- Alarm history supports time, point, severity, lifecycle/state, quality and value filters while
  retaining separate ownership from live alarm KPI counts.
- Bundled alarm records are a historian training snapshot; lifecycle is state at capture time,
  never evidence of the current page alarm state.
- Alarm History mounts only in explicit in-flow header slots, remains at least 44 px on phones,
  and the mobile dialog must scroll through filters, results and export footer.
- Auth controls cannot mount inside the historian title row; non-live provenance banners mount in
  dedicated in-flow slots and cannot cover page identity or operator controls. Banner dismissal is
  44 px, focus-visible, reduced-motion safe and contrast-safe in light/dark themes.
- EPMS mobile defaults its control sidebar to an accessible overlay drawer so the SLD retains full
  fitted width/height between control bars; the overview keeps identity through tablet widths above
  a scrollable rail that retains Alarm History, Generate Design, FAQ, PRD and Manual.
- Mobile action rails keep DOM, visual and Tab order identical; focused controls scroll fully into view
  and every EPMS action is a contained 44 px target. Public PRD/Manual auth links precede protected
  header controls in DOM order.
- Historian tables require a caption, scoped column headers, RZ severity tokens and
  tabular/slashed-zero numerics.
- Accuracy probes follow the canonical `data-basis-param` / `#rz-basis-drawer` component contract;
  page-local operational drawers remain only where explicitly documented.
- Cross-page calculations compare equal engineering scopes: selected-hall IT multiplied by the
  engine hall count must reconcile to the campus roll-up.
- Generated Tech Spec checks target labeled output rows, and public PRD/Manual pages must carry the
  same 30,000 kW / 43,500 kW / 943.0 L/s / 600.0 L/min / 744,144 L current basis. Retired
  1,850 kW, 58.1/58.2 L/s, 37 L/min, 45,900 L and 99.98% claims are release blockers; arbitrary global
  string hits cannot satisfy an accuracy gate.
- All duplicated KPI, callout, sidebar and fallback surfaces are gated against the current snapshot.
  Missing evidence is UNAVAILABLE in neutral/amber, never healthy green.
- Raw first-paint markup is validated before scripts run, then initialized runtime surfaces are
  validated separately; a post-engine DOM check cannot prove that fallbacks are current.
- Design Studio scope identifiers are `current` and `current-plus-study`; the latter is a governed
  planning-study comparison, not the adopted current operating state.
- SCADA motion and color project evaluated state; they never create operational truth.
- The Data Hall opens on rack-inlet temperature: 18–27 °C inclusive is normal green and
  25.4 °C is the adopted setpoint. Power density is a separate selected layer.
- A selected hall has no EPMS reconciliation until a governed hall submeter exists. Equal
  campus allocation is planning reference only and stays neutral.
- Chiller runtime gates wait through a simulation tick; every branch retains current 19.4/27.0 °C
  and engine-derived flow envelopes rather than retired fixed clamps.
- The governed Conventional engine is pinned to v2.0.0 and every cockpit validates its complete
  required schema. Missing, request-mismatch, matched-legacy and same-version-incomplete bundles
  fail closed across first paint, runtime values, controls, tooltips and shared basis drawers.
- CHW quantities remain on distinct planes: 943.0 L/s is the IT sensible-load reference,
  982.3 L/s is the evaporator-duty reference, measured header flow is unavailable, 31,250 kW is
  evaporator duty and 36,403.4 kW is condenser/tower rejection.
- Calculated flow never impersonates an MFM/header measurement or supplies an independent COP;
  governed plant efficiency is 6.06 COP / 0.58 kW/RT. Chiller capacity is 35 MW running, 45 MW
  N+1 and 13.75 MW N+1 margin; no per-unit rating is displayed without governed authority.
- Shared provenance drawers default-deny and require a validated host opt-in. Linked generated
  documents, PRD and Manuals are independently parity-gated against the governed snapshot.
- ICT and EPMS also start neutral and withhold topology, flow, commands, exports and scheduled
  updates until the complete v2 authority validates. Shared provenance renders `COMMS LOST —
  AUTHORITY UNAVAILABLE` whenever Conventional or AI authority is unavailable; simulated mode
  alone cannot overrule failed authority.
- Municipal water treatment is site-wide, not cloned by Hall A–D. Fire authority loss fails
  closed across all cards, interlocks and 13 process-path consumers.
- Dense AI cockpit chrome uses dedicated horizontal rails and an internally scrolling remaining
  viewport, verified at 390/768/1440/1920 without overlap or unreachable content.
- Required scenario and data-quality provenance must be non-empty; blank same-version metadata fails
  closed and cannot advance a status timestamp.
- EPMS separates Feed A/red and Feed B/green identity from energized/open/tripped state, derives its
  viewport from rendered chrome, and labels final rack symbols as aggregate groups rather than
  individual rack meters.
- Fire keeps FACP health independent from hydraulic reserve adequacy: a reserve design deficit is
  amber, uses governed shortfall logic and never fabricates an active supervisory alarm.
- Water threshold captions remain attached to their owning instruments; Chiller diagnostics use the
  governed 7.6 K delta-T plane; PUE 1.45 is adopted simulated design-point input, not measured PUE.
- Phone grids reset desktop spans, and shared/process/AI motion stops under reduced-motion without
  hiding static command, feedback, permissive or alarm state.
- Fire's 7,200 m³ site rack-footprint value is a non-sizing proxy, never protected-enclosure volume;
  jockey pressure metadata follows the governed simulated header state.
- Water site balance/WUE is engine-derived, while treatment-train equipment state is deterministic
  page-authored simulation because the engine has no treatment telemetry authority.
- All operator numerics use JetBrains Mono tabular/slashed-zero figures. Phone child geometry and
  bounded desktop inspector scrollports are asserted directly, not inferred from page overflow.
- The release workflow runs the full three-document Design Studio browser selection/export gate.
- Chiller scenario evolution is reproducible; healthy duty pumps do not swap randomly, so diagnostics
  and first-out state cannot change merely because the page was reloaded at a different instant.
- Authorized visual audits require the exact route-owned `data-rz-cockpit-root`, remove only exact auth
  overlay IDs, preserve feature dialogs, and fail non-zero after saving any error/missing-capture evidence.
- Local cockpit previews never call external geolocation and discard stale session geo first. Shared
  authentication and selection chrome uses flat surfaces, standard instrument cyan and no purple gradient,
  glow or neon fill.
- The Conventional landing header is flat and motionless; its phone alarm summary uses three balanced
  metric columns, and all operator numerics use tabular/slashed-zero figures.

Read the canonical standard for subsystem minimums, engineering formulas, UI/UX constraints,
machine-checkable gates, references and the durable change/lesson ledger.
