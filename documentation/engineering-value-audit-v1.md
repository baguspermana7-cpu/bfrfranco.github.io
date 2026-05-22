# Engineering Value Audit v1 — Cockpit pages

Date: 2026-05-22 · Owner ask: "Review engineering value dan penempatannya semuanya."

Scope: every displayed numeric value across the datahallAI cockpit + the 7 conv suite pages should either (a) read from the locked engine (`window.DATAHALL_CALC` / `window.CONV_CALC.snapshot`) or (b) be a clearly labelled design-point / static reference, never an unbacked literal.

## Status legend

- **engine-bound** — value reads from a frozen engine snapshot. Survives reload identically. PASS.
- **design-point** — static reference value tied to a documented spec line. PASS *if labelled*.
- **hardcoded literal** — value lives only in markup, no source. FIX needed.
- **Math.random jitter** — value bounces between bounds at each tick. Cosmetic on chips; never on alarm STATE. PASS only if isolated to non-engineering surfaces.

## datahallAI.html (10 in-scope panels)

| Panel | Value | State | File:Line | Notes / Fix queue |
|---|---|---|---|---|
| `#p-cool` Cooling P&ID header | `OAT 24.6 °C / WBT 22 °C` | **hardcoded literal** | datahallAI.html ~5803 | Should bind to a deterministic outdoor source (Jakarta 28–32 °C summer baseline; 22 °C WBT is plausible for a humid tropic but not engine-derived). Either bind or relabel "design point". Queued v1.25.5+. |
| `#p-cool` THERMO SUMMARY (v1.22.8 fix) | Total PUE / PUE(cooling) | engine-bound | datahallAI.html line 6475 | `DH.pue` / `DH.pb_cooling/DH.itHall`. PASS. |
| `#p-cool` floating PUE badge (v1.22.8 fix) | PUE | engine-bound | datahallAI.html lines 6586–6592 | `DATAHALL_CALC.pueBasis().pue`. PASS. |
| `#p-cool` pump speeds | `RI(72,85)` % | Math.random jitter | datahallAI.html (cooling IIFE) | Cosmetic chip; acceptable per CLAUDE.md (jitter on value, never on alarm). PASS. |
| `#p-cool` CW pressure | `R(4.2,4.8)` bar | Math.random jitter | datahallAI.html (cooling IIFE) | Same. PASS. |
| `#p-hall` KPI strip | PUE / IT / DLC / W/GPU | engine-bound | datahallAI.html lines 799–808 | `DHE.pue` / `DH.itHall` / etc. PASS. |
| `#p-elec` per-DH SLD UPS (v1.22.8 fix) | UPS A/B load | engine-bound | datahallAI.html lines 3464, 3486 | `DHE.itHallFmt + DHE.upsLoadPct`. PASS. |
| `#p-elec` MSB-SLD Total Load A (v1.22.8 fix) | `msb-kw` | engine-bound | datahallAI.html line 5005 | `DHE.itHallFmt`. PASS. |
| `#p-bms` BMS Service Health (v1.22.8 fix) | gateways / historian / notif | static deterministic | datahallAI.html ~870 | 16/16 / Online — deterministic. PASS. |
| `#p-dash` | All values | **OWNER-EXCLUDED** | datahallAI.html lines 744–793, 7321, 7347–7368 | Frozen byte-identical. Not audited per owner instruction. |

## Conv suite

| Page | Value | State | File:Line | Notes / Fix queue |
|---|---|---|---|---|
| `dc-conventional.html` | KPI strip + alarm strip | engine-bound | lines 1001–1042 + 953–989 | `kpiPue / kpiWue / kpiCarbon / kpiIt / kpiTemp / kpiAlarms`. PASS. |
| `dc-conventional.html` | Facility callouts (6 ops, v1.23.2) | engine-bound | lines 1049–1124 | PUE/IT/CHW/Temp/Fuel/RH — all bound. PASS. |
| `EPMS_Telemetry.html` | top status strip (v1.24.0 fix) | engine-bound | lines ~370 | `CONV_CALC.snapshot` Facility/IT/PUE. PASS. |
| `datahall.html` | ops rollup (v1.24.1 fix) | engine-bound | lines ~456 | Rack Load / Cooling Margin / PUE / Power Density. PASS. |
| `datahall.html` | DAHU air-handler row (A01–A20) | **partial — needs detail** | datahall.html (rack-row rendering) | Owner ask 2026-05-22: each DAHU should show SAT + ON indicator inline, and click → modal P&ID DAHU. Queued v1.25.5. |
| `chiller-plant.html` | CHW header + per-loop | engine-bound | lines 510–517 + loop renderer | `CHW.chws/.chwr/.dt/.flow` + `st.loops[i]`. PASS. |
| `fire-system.html` | alarm strip + tank + pressure | engine-bound + design-point | lines ~275 | Tank 92% deterministic; static pressure 12.5 bar design-point. PASS. |
| `fuel-system.html` | autonomy / consumption / gen load | engine-bound (v1.23.3 hero) | KPI strip | `CONV_CALC` autonomy 48 hr. PASS. |
| `water-system.html` | WUE / makeup / treatment | engine-bound (v1.23.4 hero) | KPI grid | `#kWue` from CONV_CALC. PASS. |
| `ict.html` | OT-gateway chips (v1.24.2) | static deterministic | lines ~470 | 5 gateways "Online". PASS. |

## Queued fixes (v1.25.5+)

1. **datahallAI line 5803 OAT/WBT** — bind to deterministic outdoor source, or relabel "design point Jakarta annual avg".
2. **datahall.html DAHU spec** (owner ask 2026-05-22) — each A01–A20 cell needs inline SAT + ON indicator; click → modal P&ID DAHU detail with SAT/RAT/fan speed/etc.

## Out of scope

- `#p-dash` panel (owner exclusion — byte-identical).
- Cosmetic Math.random jitter on chips / pump speeds / pressure / temps where the engineering baseline is preserved per CLAUDE.md.
- Engine files (`js/datahall-model.js`, `js/datahall-calculations.js`, `js/conv-engine.js`) — locked.
