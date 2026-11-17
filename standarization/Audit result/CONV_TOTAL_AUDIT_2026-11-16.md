# DC Conventional family — total audit ledger (2026-11-16, site v3.63.1)

**A ledger, not a report.** Every row has an ID, a severity, evidence and the work package (WP) that
closes it in `CONV_EXECUTION_PLAN_2026-11-16.md`. A row is CLOSED only with the version that closed
it AND the gate that keeps it closed. Re-measure before trusting a row.

- Scope: `dc-conventional.html`, `datahall.html`, `chiller-plant.html`, `water-system.html`,
  `fire-system.html`, `fuel-system.html`, `ict.html`, `EPMS_Telemetry.html`, `cdu-mini-bms.html`, the
  shared `js/conv-*`, `js/conv/*`, `js/rz-hmi-sheet.js`, `js/rz-bms-shell.js`, `js/rz-basis-drawer.js`.
- Out of scope: `datahallAI.html` and `js/datahall-ai/*` (LTC session).
- Tree: `origin/main` e22231516 (v3.63.1), worktree `~/.cache/rz-w5`.

## 1. How it was measured

| dimension | instrument | result |
|---|---|---|
| SEO | `python3 tools/audit-seo.py --json` | 0 errors; 3 title-length warnings (see S1) |
| Anti-vibecode | `node tools/audit-vibecode.mjs --json` | 0 findings in scope |
| UX laws | `node tools/audit-ux-laws.mjs --json` | 0 findings site-wide |
| Mobile scorer | `python3 tools/audit-mobile-responsive.py --json` | 215 pass / 0 fail |
| JS syntax, script tags, onclick exports | `audit-js-syntax.py`, `audit-script-tags.py`, `audit-onclick-handlers.py` | clean |
| Render (54 states: 9 pages × 390/768/1440 × light/dark, axe contrast, screenshots) | `node tools/audit-site-render.mjs --include … --axe --capture-all` | 16 FAIL, 38 UNVERIFIED (see U-rows) |
| Conv gate suite (23 `tools/test-conv-*.mjs`) | serial in `rz-lane -l 2` | 22 of 23 exit 0; `test-conv-geometry.mjs` killed by its 600 s timeout (exit 124, G1) |
| Code + client security | `code-reviewer` subagent, read-only, 18 findings (9 MEDIUM / 9 LOW) | top rows re-verified by the main session against source (column V) |
| Engineering accuracy | subagent, engine run in a node sandbox at 4 loads, 24 findings | CRITICAL/HIGH rows re-verified by arithmetic (column V) |

Column **V**: `Y` = re-proven by the main session from source or arithmetic; `P` = partly (the
defect exists, the stated size is not yet re-measured); `N` = subagent claim only, the executor must
prove it RED before changing anything. Severity follows the user-visible consequence, not the size
of the fix.

**Static gates are clean; the defects live in the render, the engine arithmetic and the drawings.**
Same shape as PLAN B4: the instruments cover what they were built to see.

## 2. Engineering accuracy (engine + drawings)

| ID | sev | V | finding | evidence | WP |
|---|---|---|---|---|---|
| E-C1 | CRITICAL | Y | Generator fleet is ~1/6 of the load it carries; "N+1" cannot hold. EPMS draws GEN-A/B 2.5 MW each for a 43.5 MW facility (58 MW at design); the fuel page shows one running genset carrying all 43.5 MW (`fmt1(FACILITY_MW)` per running set); 180 L/min transfer pump vs ~258 L/min burn | `EPMS_Telemetry.html:841` `spec:'2.5 MW'`; `fuel-system.html:1137`; `fuel-system.html:800,1774` | W2-E1 |
| E-C2 | CRITICAL | Y | EPMS SLD puts 21.75 MW per stream through one 3,150 kVA transformer (~770 % loading) and prints a 34,882 A running current on a 400 V board | `EPMS_Telemetry.html:839` `spec:'DYN5, 3150KVA'` | W2-E1 |
| E-H1 | HIGH | Y | WUE 1.20 L/kWh is an INPUT; evaporation derived from it (447.8 L/min ≈ 18 MW latent at 2.43 MJ/kg) carries half the engine's own 36,403 kW tower rejection. Physical WUE at this rejection ≈ 2.0–2.4 L/kWh | `js/conv-engine.js:462,519` | W2-E2 |
| E-H2 | HIGH | P | "Installed" CRAH count follows the operating scenario (10 → 78 units/hall); at design the hall is ~24.6 % short of air-side capacity, N+1 margin 40 kW at adopted load | engine run at 1,125/7,500/9,000/10,000 kW/hall; main session: snapshot `crah_required 58` / `crah_installed 59` at 7,500 kW (installed = required + 1) | W2-E3 |
| E-H3 | HIGH | N | Design-point PUE 1.45 applied at 75 % and 11 % load; `conv-design-basis.js` and the registry declare part-load PUE UNAVAILABLE | engine + `js/conv-design-basis.js` | W2-E3 |
| E-H4 | MEDIUM (was HIGH) | P | `environment.avg_temp_c` 22.4 °C printed where the reader expects the 25.4 °C rack-inlet setpoint — re-check the caption; the value itself is an engine leaf, not a mislabelled setpoint | `dc-conventional.html:1600` | W1-A4 |
| E-H5 | HIGH | Y | Fire-pump motors smaller than their hydraulic duty: 227 m³/h × ~120 m = 74.2 kW hydraulic on a 75 kW motor (η≈1); jockey 18 m³/h × ~130 m ≈ 6.4–6.9 kW on 5.5 kW. NFPA 20 needs motor ≥ shutoff/150 % point power | `fire-system.html:821,825,1391,1402` | W2-E4 |
| E-H6 | HIGH | P | Tech Spec prints "UPS module count 2 (A + B feed)" bound to `MODEL.electrical.ups_module_count`; the engine computes modules = per-system × system count (64) | `dc-conventional.html:2374`, `js/conv-engine.js:393-397` | W1-A4 |
| E-H7 | HIGH | N | ICT access layer sized for ~20 racks, not 2,000 | `ict.html` inventory | W2-E5 |
| E-M1 | MEDIUM | N | Heat balance and PUE not reconciled bottom-up; PUE residual labelled "Cooling overhead" | engine | W2-E3 |
| E-M2 | MEDIUM | N | Per-chiller flow setpoint uses IT-only flow → evaporator ΔT 7.92 K, page prints 7.6 K | engine | W2-E2 |
| E-M3 | MEDIUM | N | "Plant COP"/"plant kW/RT" are compressor-only | engine | W2-E2 |
| E-M4 | MEDIUM | N | Fuel specific consumption 30–40 % above full-load diesel data; 48 h target holds only at 75 % load | engine + `fuel-system.html` | W2-E1 |
| E-M5 | MEDIUM | N | EPMS topology (A/B + catcher C, mechanical on UPS) contradicts the engine's 2N with mechanical not on UPS | `EPMS_Telemetry.html` DEVICES | W2-E1 |
| E-M6 | MEDIUM | N | Fire-main static pressure exceeds the 175 psi (12.1 bar) standard component rating | `fire-system.html:688-690` | W2-E4 |
| E-M7 | MEDIUM | N | Suppression agent stated four different ways; N₂ generator presented as the agent | `fire-system.html` | W2-E4 |
| E-M8 | MEDIUM | N | Fire storage sized on 2,500 L/min; pumps rated 3,783 L/min | engine + page | W2-E4 |
| E-M9 | MEDIUM | N | Refrigerant pressures disagree with R-1234ze(E) saturation at the printed temperatures | `js/conv/chiller-sheet.js` / page | W2-E2 |
| E-M10 | MEDIUM | N | Grid factor 0.42 kgCO₂/kWh ≈ half the Java-Bali factor for a Bekasi site | `js/conv-engine.js:475,521` | W2-E2 |
| E-L1 | LOW | N | Rack-equivalents at 6/8/10 kW (5,000/3,750/3,000) exceed 2,000 physical positions | engine | W2-E5 |
| E-L2 | LOW | N | Tower blowdown/drift non-standard formula; basis 100× off the Tech Spec | engine | W2-E2 |
| E-L3 | LOW | N | UPS efficiency flat 96 % at 37.5 % load | engine | W2-E1 |
| E-L4 | LOW | N | Day-tank capacity differs between pages | fuel / dc-conventional | W2-E1 |
| E-L5 | LOW | N | Tank ASSUMED but back-solved from the 48 h target; ICT hard-codes PUE | registry + `ict.html` | W2-E1 |

Full arithmetic per row: `conv-2026-11-16/raw-engineering.md`; code snippets, fixes and `verify:`
lines per row: `conv-2026-11-16/raw-code-security.md`. Both are subagent output (another model
family): rows marked V=N are unproven claims until the executor shows them RED. Not checkable from what is printed: pipe
velocities, UPS battery runtime, NFPA 72 spacing, clean-agent quantities, tower approach to wet bulb.

## 3. Code correctness and client security

| ID | sev | V | finding | evidence | WP |
|---|---|---|---|---|---|
| C-A1 | MEDIUM | P | Fuel alarm list repeats the engine's 30/60/95 % thresholds as literals | `fuel-system.html:1178-1179,1186` vs `js/conv-engine.js:639-641` | W1-A3 |
| C-A2 | MEDIUM | N | Fuel UST trend axis pinned to 80–90 % while the simulation runs 0–98 % | `fuel-system.html:1659-1660` | W1-A3 |
| C-A3 | MEDIUM | N | Water simulation adds `Math.random` noise to the engine make-up series | `water-system.html:1358-1360` | W1-A3 |
| C-A4 | MEDIUM | Y | Datahall starts random temperature excursions itself (30 s, then every 120 s), changing alarm counts — Rule 2 (no die roll for state) | `datahall.html:2077,2127` | W1-A3 |
| C-A5 | LOW | N | Hall switch during an excursion leaves a stale banner | `datahall.html:2191-2196` | W1-A3 |
| C-A6 | MEDIUM | N | FP-02 shows authored "fuel 88 %, battery OK, last test" as live state | `fire-system.html:829,1399` | W1-A3 |
| C-A7 | LOW | N | Fire pump pressure setpoints are literals, not tied to engine static pressure | `fire-system.html:688-690` | W2-E4 |
| C-A8 | MEDIUM | N | Two drifted inline basis drawers beside the shared `rz-basis-drawer.js`; keydown listener leaks per open | `dc-conventional.html:2806,2842`, `datahall.html:2338,2371` | W1-A2 |
| C-A9 | MEDIUM | N | EPMS PDF export throws when the pop-up is blocked (`window.open` not null-checked) | `EPMS_Telemetry.html:1887-1888` | W1-A2 |
| C-A10 | LOW | N | `RZHmiSheet` binds listeners per render; `destroy()` never removes them | `js/rz-hmi-sheet.js:312,318` | W1-A2 |
| C-A11 | MEDIUM | Y | Every conv HMI sheet SVG declares its basis as "the DC AI engine … js/datahall-ai/hmi-sheets.js" — wrong engine, wrong file, on 4 cockpits | `js/rz-hmi-sheet.js:246` | W1-A2 |
| C-A12 | LOW | N | Fuel "updated Ns ago" fought over by two 1 s intervals | `fuel-system.html:1674,1679-1687` | W1-A3 |
| C-A13 | LOW | N | RH 20–80 % labelled "ASHRAE A1 recommended" (it is the allowable envelope) — standard §5 forbids this | `dc-conventional.html:1517-1518` | W1-A4 |
| C-A14 | MEDIUM | N | Oversized functions: `buildTechSpecHtml` 768 lines | `dc-conventional.html:1846` | W3-R1 |
| C-A15 | LOW | N | Engine version pin parse logic copied per page | `js/rz-engine-versions.js:5` + pages | W3-R1 |
| C-B1 | LOW | N | Forged localStorage session with `role:"root"` passes the client tier gate (content is public static; no data exposure) | `auth.js:267-270` | W3-S1 |
| C-B2 | LOW | N | 8 sub-cockpits carry no gate; a direct URL skips the dc-conventional gate | `js/rz-feature-flags.js:248` | W3-S1 |
| C-B3 | LOW | N | Inline gate fallback duplicates auth.js root/demo lists | `dc-conventional.html:1751-1752` | W3-S1 |

Checked clean: 117 `innerHTML` sinks with no user-controlled input; the revision note is escaped;
Chart.js carries SRI; no `postMessage`; every `localStorage` `JSON.parse` sits in try/catch.

## 4. Render, UI and accessibility (main session, screenshots looked at)

| ID | sev | V | finding | evidence | WP |
|---|---|---|---|---|---|
| U1 | HIGH | Y | `dc-conventional.html` in LIGHT theme: the page stays black and the sign-in modal keeps dark-theme text tokens — title `#1e293b` on `#121316` = **1.26:1**, field labels 2.45:1, sub 3.9:1; PRD/Manual buttons render white-on-black | axe, states 00421–00423; screenshot 00423 | W1-U1 |
| U2 | MEDIUM | Y | `ict.html` secondary text `#64748b` on near-black: ops strip 4.10, OT gateway 4.13, `.nav-title` 3.8, explain chip 3.8 (all < 4.5:1), both themes, all widths | axe 00499–00504 | W1-U1 |
| U3 | MEDIUM | Y | `chiller-plant.html` `.rz-bms-inspector-empty` `#66758a` on `#181a1e` = 3.71:1 (shared `rz-bms-shell` style → likely every adopter) | axe 00319–00324 | W1-U1 |
| U4 | HIGH | Y | `EPMS_Telemetry.html` at 390 and 768: the SLD draws ~40 equipment boxes with **no tag or label**, 520–574 px of unlabelled drawing, bottom KPI strip truncated (`BREAK 91 / 98` cut at the right edge). Standard §4: labels must stay readable at 390/768 | render 00439–00443; screenshot 00439 | W1-U2 |
| U5 | MEDIUM | P | `chiller-plant.html` P&ID tag text on the light "Shade" sheet renders with a dark halo stroke sized for the dark sheet — tags read smeared/bold at 1440 | screenshot 00324 (crop) | W1-U2 |
| U6 | INFO | Y | 9–114 axe `incomplete` contrast nodes per page (SVG text over gradients/patterns) — axe cannot decide; needs the page's own pixel probe | render JSON `contrast.incomplete` | W3-G1 |
| U7 | INFO | Y | `theme-not-confirmed` on 42 states: the generic render audit cannot confirm the cockpit theme toggle (tool limitation, not a page defect) | render JSON | W3-G1 |
| S1 | INFO | Y | 3 titles 61–75 chars (`dc-conventional`, `chiller-plant`, `EPMS_Telemetry`); subject survives truncation, so per the SEO ledger rule this is cosmetic | `audit-seo.py` | — (no action) |

## 5. Gate health

| ID | sev | V | finding | evidence | WP |
|---|---|---|---|---|---|
| G1 | HIGH | Y | `tools/test-conv-geometry.mjs` hangs in `activateTab` on `datahallAI.html` (3rd time: v3.62.2 gate [63], solo rerun, this audit). It is the only conv gate that also walks an LTC page, so a hang there blinds the conv geometry check | process idle at 0 % CPU for > 400 s | W0-G1 |
| G2 | MEDIUM | Y | The generic render audit cannot see the authorised cockpit state (no auth bypass), so `dc-conventional` was measured locked; conv render coverage relies on the conv-specific gates | render states 00421–00426 | W3-G1 |

## 6. Totals

| | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|---|
| engineering | 2 | 6 | 11 | 5 | — |
| code / security | — | — | 9 | 9 | — |
| render / UI | — | 2 | 3 | — | 3 |
| gates | — | 1 | 1 | — | — |
| **all** | **2** | **9** | **24** | **14** | **3** |

## 7. Depth: modal, inspector, traceability, tooltip (added after owner review)

Owner, 2026-11-16: *"Gak mungkin gak ada hasilnya, masih jelek. Modal, traceability, tooltip banyak yang
belum."* Correct, and the first pass could not have seen it. `test-conv-coverage.mjs` traces a number
by **value-string membership** in the registry, so a number with no hook and no visible mark passes;
no gate clicked equipment; no gate counted tooltips. `tools/test-conv-depth.mjs` (MONITOR) now
measures all three in the authorised audit state at 1440 px, dark theme.

Probe soundness: it clicks the `.hmi-node` symbol body (a click on the separate text layer counted 0
on chiller, a false negative found and fixed); CH-01…04 open the loop modal and are counted, so a
real open is detected.

### Baseline (2026-11-16, v3.63.1)

| page | numerals | hooked + visible mark | declared only (no mark) | bare | tooltip on labels | tagged equipment → opens | inspector LIVE ≤ 2 rows | tabs with content (of 6) |
|---|---|---|---|---|---|---|---|---|
| dc-conventional | 41 | 32 (78 %) | 0 | 9 | 29/58 (50 %) | no equipment drawing | — | — |
| datahall | 362 | 23 (6 %) | 318 | 21 | 6/85 (7 %) | 500 racks → in-page panel only, no modal | — | — |
| chiller-plant | 137 | 8 (6 %) | 94 | 35 | 2/60 (3 %) | 29 → **4** (CH-01…04 loop modal; pumps, TT, ET dead) | inspector never opens | — |
| water-system | 88 | 17 (19 %) | 43 | 28 | 2/26 (8 %) | 17 → 11 | 1 of 11 | 1.9 |
| fire-system | 79 | 4 (5 %) | 40 | 35 | 6/58 (10 %) | 24 → 24 | **23 of 24** | **0.2** |
| fuel-system | 76 | 6 (8 %) | 34 | 36 | 5/96 (5 %) | 16 → 16 | **15 of 16** | **0.4** |
| ict | 92 | 1 (1 %) | 78 | 13 | 1/43 (2 %) | 17 nodes → in-page detail only | — | — |
| EPMS_Telemetry | 43 | 7 (16 %) | 2 | 34 | 5/74 (7 %) | 29 SLD devices → **0** | — | — |
| cdu-mini-bms | 86 | **0** | 0 | **86** | **0/32** | 13 → **0** | — | — |

### Findings

| ID | sev | V | finding | evidence | WP |
|---|---|---|---|---|---|
| D1 | CRITICAL | Y | The shared payload builder ships empty tabs: `capacity: []`, `trend: null`, `maint: []`, `openHmi: null`, `engineVersion` "—", `counts.derived 0`. Every fire/fuel inspector opens to a title and one state row; the hover tooltip carries more than the inspector | `js/conv/sheet-truth.js:134-138`; fire 23/24 and fuel 15/16 LIVE ≤ 2 rows; screenshot `conv-2026-11-16/fire-modal.webp` | D-1 |
| D2 | HIGH | Y | Chiller: 25 of 29 tagged items show a pointer cursor and do nothing on click (pumps CHWP-*, TT-*, ET-01, headers). Only chillers open, and only the loop modal | `chwOpen()` returns unless the node belongs to a loop, `chiller-plant.html:1566-1571` | D-2 |
| D3 | HIGH | Y | EPMS SLD: 29 devices (MV, RMU, Tx, LVSB, GEN, ATS, UPS …) — no click, no inspector, no modal, no tooltip on the device | probe; `EPMS_Telemetry.html` DEVICES | D-3 |
| D4 | HIGH | Y | cdu-mini-bms: 86 numerals with no hook, no declaration, no mark; 0 tooltips; 13 tagged items inert | probe | D-3 |
| D5 | HIGH | Y | Datahall (500 racks) and ICT (17 nodes) have an in-page detail panel only: no six-tab inspector, no deep modal, no traceability inside the panel | `datahall.html:1970` `selectRack`; `ict.html:1585` `showNodeDetail` | D-3 |
| D6 | HIGH | Y | Traceability is invisible on 8 of 9 pages: 1–19 % of numerals carry a hook and a mark; 629 numerals carry only a `data-rz-authored-basis` the operator cannot see or click; 297 are bare | baseline table | D-4 |
| D7 | HIGH | Y | `test-conv-coverage.mjs` passes these pages because it counts a number as traced when its string appears in the registry — the same blind spot `test-dcai-coverage` closed for datahallAI in A3 | `tools/test-conv-coverage.mjs:47-72,357` | D-4 |
| D8 | HIGH | Y | Tooltips cover 2–10 % of labels on 7 pages; `rz-explain-db.js` has 42 `conv-*` entries for ~600 labels, tags and abbreviations | probe; `grep -o '"conv-' js/rz-explain-db.js` | D-5 |
| D9 | MEDIUM | Y | Chiller loop modal: values without units' degree sign (`8.3 C`), simulated pump amps/vibration not marked SIMULATED, no traceability marks, no trend; secondary supply 18.9 °C below primary CHWS 19.4 °C (secondary cannot be colder than primary without a source) | screenshot `conv-2026-11-16/chiller-modal.webp` | D-2 |
| D10 | MEDIUM | Y | The inspector opens over the page header and covers the `FULL` / toolbar controls at 1440 (no docking on cockpit pages) | screenshot `conv-2026-11-16/fire-modal.webp` | D-1 |

### Flip condition for `test-conv-depth.mjs`

MONITOR until D-1…D-5 land; then STRICT per page when its row reaches: hooked + marked ≥ 95 % of
engine numerals and every simulated numeral visibly marked SIM; bare = 0; tooltip on labels ≥ 95 %;
every tagged item opens; LIVE ≥ 4 rows on every opened item; ≥ 5 of 6 tabs with content.

### Totals with §7

| | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|---|
| §2–§5 | 2 | 9 | 24 | 14 | 3 |
| §7 depth | 1 | 7 | 2 | — | — |
| **all** | **3** | **16** | **26** | **14** | **3** |
