# Chiller Mimic Professionalization Plan (50-Point Matrix)

## Scope
This document translates the 50 improvement ideas into an implementation matrix for design, frontend, and control-logic handoff.

Legend:
- `DONE` = implemented in `chiller-plant.html`
- `NEXT` = planned next batch
- `LATER` = deeper process/control workflow work

## Visual / HMI Baseline
1. Reduce global glow and visual noise - `DONE`
2. Shift to neutral dark industrial background - `DONE`
3. Reserve bright colors for abnormal states - `DONE`
4. Apply fixed status palette (normal/warn/alarm) - `DONE`
5. Use cleaner engineering typography + tabular numerics - `DONE`
6. Increase prominence of key numeric values - `DONE`
7. Enforce tighter spacing rhythm and card consistency - `DONE`
8. Strengthen text hierarchy for scan speed - `DONE`
9. Remove decorative double borders - `DONE`
10. Improve small-text contrast - `DONE`

## P&ID / Process Readability
11. Standardize pipe hierarchy by role - `DONE`
12. Keep flow direction cues consistent - `DONE`
13. Keep dominant flow orientation consistent - `DONE`
14. Align branch routing to grid - `DONE`
15. Separate CHWS and CHWR lanes more clearly - `DONE`
16. Reduce excessive dash animation - `DONE`
17. Use consistent equipment symbol language - `DONE`
18. Strengthen subsystem boundaries - `DONE`
19. Increase spacing between process trains - `DONE`
20. Add mini overview/navigation map - `NEXT`

## KPI and Context
21. Show PV/SP/mode together on critical loops - `NEXT`
22. De-duplicate unit labels across repeated fields - `NEXT`
23. Standardize decimal precision policy - `NEXT`
24. Add delta-T and delta-P per chiller visibility - `NEXT`
25. Add load percentage vs design capacity per train - `NEXT`
26. Add 15-60 min sparkline for critical KPIs - `DONE`
27. Make timestamp freshness explicit - `DONE`
28. Add signal quality by sensor/tag - `NEXT`
29. Expand cryptic tag abbreviations with quick definitions - `NEXT`
30. Show top deviation board vs baseline/setpoint - `DONE`

## Alarm and Operations
31. Keep alarm summary always visible at top-level - `DONE`
32. Use priority classes P1/P2/P3 - `DONE`
33. Differentiate warning vs alarm by shape + wording (not color only) - `DONE`
34. Add acknowledgment workflow from main screen - `DONE`
35. Group alarms by likely root cause category - `NEXT`
36. Add first-out alarm indicator (latched) - `DONE`
37. Add deadband + delay for nuisance alarm suppression - `LATER`
38. Add concise probable cause text on alarms - `DONE`
39. Separate operator vs engineering controls more clearly - `NEXT`
40. Add view presets per role (operator/engineering/executive) - `DONE`

## Interaction and Architecture
41. Click equipment opens focused detail panel - `DONE`
42. Confirm destructive/critical commands - `NEXT`
43. Add keyboard shortcuts for fast operations - `DONE`
44. Keep drilldown hierarchy (overview -> unit -> loop) - `DONE`
45. Add compare mode between chillers - `NEXT`
46. Formalize design tokens (color/spacing/type/radius) - `DONE`
47. Promote reusable UI blocks/components - `DONE`
48. Enforce strict tag naming conventions - `NEXT`
49. Run task-based usability benchmark (time-to-diagnose/error rate) - `LATER`
50. Run ISA-101 / EEMUA-191 checklist every release - `LATER`

## Design Tokens (Current Direction)
- Typography: `Space Grotesk` (UI), `JetBrains Mono` (telemetry)
- Status colors:
  - Normal: green accent
  - Warning: amber
  - Alarm: red
- Surfaces:
  - shell `#0b1019`
  - panel `#111827`
  - border `#2b354a`
- Numeric behavior:
  - tabular numbers for KPI/readout/alarm rows

## Next Execution Batch
1. Build root-cause grouped alarm table + quick filters.
2. Add per-sensor quality/state (`GOOD/STABLE/STALE/BAD`) and stale timers.
3. Add compare mode for CH-01..CH-04 with aligned KPIs.
4. Add confirmation dialog for fault injection and baseline reset.
5. Add ISA-101 checklist gate in release QA notes.
