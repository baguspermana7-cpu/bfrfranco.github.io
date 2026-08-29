---
title: Conventional DC Operations Standard
type: standard-mirror
source: standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md
updated: 2026-08-29
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

Read the canonical standard for subsystem minimums, engineering formulas, UI/UX constraints,
machine-checkable gates, references and the durable change/lesson ledger.
