---
title: Conventional DC Operations Standard
type: standard-mirror
source: standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md
updated: 2026-08-27
---

# Conventional DC Operations

Canonical source: [[../../../../standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md|CONVENTIONAL_DC_OPERATIONS_STANDARD.md]].

## Locked decisions

- Current simulated operation remains the 1,850 kW `CONV_CALC.snapshot`.
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
- SCADA motion and color project evaluated state; they never create operational truth.

Read the canonical standard for subsystem minimums, engineering formulas, UI/UX constraints,
machine-checkable gates, references and the durable change/lesson ledger.
