# PRD-DCAI-HALL-DEPTH — the DC AI Data Hall reads like a hall BMS: it fits the screen, every unit shows its operating state, and the pipes and the power move at the rate they carry

Status: DRAFT for owner (2026-11-22). Page: `datahallAI.html`, tab **Data Hall** (`#p-hall`, button `#tabs [data-t="hall"]`).
Tree measured: `01c9aa43f` (v3.93.0, worktree `~/.cache/rz-prd`). Engine: `DCAI_CALC` 1.6.0 (`js/dcai-engine.js`, `window.DHE` is the page's flat read of it).
Sister PRDs (read, not duplicated):
- `PRD-CONV-OPS-DEPTH/02-DATAHALL.md` — the same air-side physics for the Conventional hall (4 stations per aisle, RCI/RTI, all-run CRAH, equal-percentage valve). This PRD **reuses its relations** (§6.1–6.4 there) and applies them to the DC AI hall, which adds a liquid side (CDU, TCS) that the Conventional hall does not have.
- `~/.cache/wt-elec/documentation/prd/PRD_ELECTRICAL_BMS.md` (peer) — owns the DC AI electrical SLD sheets `DH-E-*`, `js/rz-hmi-sheet.js` and the shared sheet **Fit** fix (its Amendment 2, A0/A1). This PRD only draws the **hall-floor view of power** and asks that the shared fit fix also cover the DH-A/DH-R/DH-M sheets (law HD-F7).
- `~/.cache/wt-elec/documentation/prd/PRD_SETPOINT_SIM.md` (peer) — owns every setpoint (SP), the SP line on trends, what-if and control sequences. This PRD shows **actual values** and leaves a slot for SP; it designs none of it (§4 non-goals).
- Earlier: `PRD-DATAHALL-BMS-ISO` (3D floor, `js/datahall-ai/hall-iso.js`), `PRD-CONV-BMS-LIVE` / `-MOTION` (motion rules), `PRD-DCAI-NUMBERS` (every number engine, sim or declared).

---

## 1. Owner request (2026-11-22, verbatim)

1. "danini bug yang page datahallai - datahall itu kok dia bergerak membesar kemudian mengecil kemudian hilang, cek semua banyakbug"
2. "masih jauh dari yang saya expect room layout-rack architecture, cooling piping, electrical semuanya, dan juga tambahan fitur fit to screen nggak bisa masuk seukuran itu"
3. From the shared brief: "yang datahall baik 3d dan plan, ini sangat kurang banyak parameter2 operation belum ada, misal temp di 4 titik per aisle/row, kemudian return air tempnya, animasi dari crah, dll. ... implement all" and "speed CRAH, opening control valve ya crah, banyak dah yang belum ada, ini masih kurang komprehensive".

What the owner means, in the page's own words: the tab bar reads `DC DASHBOARD · DATA HALL · ROOM LAYOUT · RACK ARCHITECTURE · COOLING & PIPING · ELECTRICAL SLD …`. "Room layout - rack architecture, cooling piping, electrical" are the **sibling tabs**, and "fit to screen" is a complaint about every drawing that "does not fit at that size". This PRD therefore (a) censuses the Data Hall tab in full, (b) censuses the four sibling drawings for fit and legibility only (§2.6), and (c) specifies the floor-level depth of layout, piping and power on the **Data Hall** tab, where the operator looks first. Open question Q2 asks whether the sibling tabs stay as reference sheets.

---

## 2. Measured state today — BUG CENSUS (real headless browser)

### 2.0 Method

- Probe: a throwaway puppeteer script in `tools/` (copied from the `tools/test-dcai-hall-iso.mjs` open/auth pattern: `signedInStorage` + `enterAuthorizedAuditState(pg,'dc-ai')` + click `#tabs [data-t="hall"]`), run under `rz-lane -l 1`, **deleted after the run** (`tools/_dcaiprobe*.tmp.mjs`, 4 passes; raw output kept in the author's scratchpad only).
- Matrix: **1440×900 and 390×844 (mobile emulation) × dark and light × 3D and Plan** = 8 states on the Data Hall tab, plus the four sibling tabs at 1440 dark/light and 390 dark.
- Measured per state: page errors and 4xx on same-origin requests; every `<text>` (size after the CTM scale, overlap with every other text, outside the svg, `NaN/undefined/—`, contrast against the stage colour); host and svg boxes sampled 12 times at 500 ms; position of every element 3.5 s apart; animation inventory (SMIL, CSS, distinct durations); `elementFromPoint` hit-test and real mouse clicks on 3 units per equipment class; `[data-point]` count; `window.DHE` keys; reduced-motion.
- **Probe artifacts excluded from the findings** (so they cannot be mistaken for bugs): 2 `net::ERR_FAILED` console lines are the probe's own abort of external requests; a click on `DH-n` re-renders the plan so later markers were "gone" in the plan census; my first 3D click census counted DOM mutations as "did something", which is meaningless while 3D rebuilds itself (see B1), so the 3D clicks were **re-measured with the shrink loop neutralised** (`#hIso{border:0}`, the same cause as the pending patch) and with the hit-test per unit.
- Engine facts used below come from `window.DHE`: 20 rows × 22 racks = 440 racks, 142 kW each (3,124 kW per row, 67,382 kW per hall, 6,248 kW per containment pair), 72 GPU per rack; liquid share 85 % = 53,108 kWth; air share 17,755 kWth; 55 CDU (54 duty + 1 standby, 1,000 kWth each, 983.5 kWth duty each, 1,483 L/min each); 90 fan-wall modules (89 duty + 1 standby, 200 kW each, 199 duty); TCS 40/50 °C, HTW 37/45 °C, CHW 19/27 °C, air 25/36 °C; hall 62 × 31 m; busway 5,000 A at 93.9 %.

### 2.1 What is on the tab today (counted)

| class | count on the floor | in 3D | on Plan | what is shown at rest | what a click opens |
|---|---:|---:|---:|---|---|
| rack (NVL72) | 440 | 440 `.rack` | 440 `.hp-rack` | green lamp; row-pair tag `R01/02 6248` (pair kW, no unit) in 3D; row tag `R01` in Plan; inlet in tooltip | rack HMI (DH-R-101) |
| CDU | 55 | 55 | 55 | glyph, duty or dashed standby; per pod "CDU 01–06" | CDU HMI (DH-M-103.nn) |
| fan-wall module (CRAH) | 90 | 90 | 90 | duty/standby; Plan: fan glyph rotating 1.6 s | CRAH HMI (FW-nnn) |
| aisle temperature sensor | 60 (30 cold + 30 hot) | tooltip | 60 boxed values | one °C number each | none |
| TCS / HTW / CHW headers | 1 + 1 + 2 lines | none | dashed lines | colour only | `fws-piping:dh01` (6 px tall target) |
| leak rope | 1 (24 zones) | none | one line | colour only | `leak:dh01` (6 px tall target) |
| cable tray / busway | 1 | none | 3 coloured lines | no value | `cable-tray:dh01` |
| KPI cards | 9 | 9 | 9 | PUE, IT, GPU %, NVLink, ΔT, DLC, Up, W/GPU, FP4 | basis drawer (4 of 9 open; GPU %, NVLink, Up, W/GPU, FP4 are simulated/published and open nothing) |
| header cards | 3 (IT, liquid, air) | shown | shown | kW, counts, supply/return °C | none |

Equipment references on the page: 588 `data-rz-equipment` in Plan, 585 in 3D (the plan's leak/cable/fws are not drawn in 3D).

### 2.2 Bug census — findings, each re-proved

Severity: CRITICAL blocks the owner's request; HIGH is wrong or unusable; MEDIUM degrades; LOW polish. "Fixed" = already fixed by the pending patch (listed, not re-fixed here).

| # | sev | finding | evidence (measured) | status |
|---|---|---|---|---|
| B1 | CRITICAL | **3D hall breathes and shrinks, then vanishes** ("membesar, mengecil, hilang") | 1440: `#hIso` width 1220 → 1160 in the 6 s sample window and 1220 → 930 across 4 resizes over ~15 s; **12 of 12** samples carry a different `viewBox` (rebuilt every 500 ms); 3,553 of 8,527 element positions moved in 3.5 s; 3D click markers lost in under 1 s (**9 of 9 3D targets "gone"**). 390: host 358 → 292 px in 6 s. Mechanism: `js/conv/floor-plan.js` sets `host.style.width = min(svgW, meas.clientWidth)`; the host has a 1 px border, so each rebuild is 2 px narrower and the `ResizeObserver` (floor-plan.js:746) rebuilds again. With `#hIso{border:0}` the same page is stable: 1 distinct `viewBox`, width 1252 → 1252. | **Fixed** by the pending patch (hall-iso measures its own bordered host). A regression law stays (HD-B1). |
| B2 | CRITICAL | **3D stage cannot show the hall on one screen (1440)** | host 1220×806 at y = 434 → bottom 1240 = **340 px below the fold** at 900 px; with B1 neutralised the stage is 1252×826, so at the same top (434) its bottom is 360 px below (computed). Cause: `height: Math.max(420, innerHeight − 40)` in `hall-iso.js` ignores that 434 px of chrome (alert strip, DH nav, KPI row, header cards, projection toggle) sits above the stage. | open → §7 |
| B3 | CRITICAL | **3D at 390: hall is wider than its stage and tiny** | `.fp-root[data-u=7.00]` (the floor of the unit), svg 482 px wide in a 358 px host, `.fp-scroll` scrollWidth 516 vs clientWidth 356 (145 % of the stage); rack front **6.1 px** wide; stage top at y = 644 so the stage ends 169 px below the fold of 844 px. | open |
| B4 | CRITICAL | **Plan cannot show the hall on one screen** | 1440: hSvg 1252×839, bottom 224 px below the fold. 390: hSvg 1240×831 inside a pan container (the legibility pass scales the plan 3.18× to clear its 8.5 px floor) → **31 % of the width visible**, CDU line and south fan wall off the first screen by 483 px. There is **no Fit button and no zoom or pan control** (0 found; a ctrl+wheel on the 3D svg changed nothing but the B1 rebuild). | open |
| B5 | HIGH | **Zero live operating parameters on the floor for CRAH, CDU, valves, pipes** | Plan text (128 `<text>`): `valve` 0, `rpm` 0, `speed` 0, `Hz` 0, `open` 0, `bypass` 0; 1 hit for `PDU/RPP/busway` (the words "BUSWAY FEEDERS"); 1 for `%`. `[data-point]` inside the tab: **0** — none of the 60 sensors, 90 CRAH, 55 CDU wear a state colour or open a trend. Of the 264 numeric keys in `DHE`, 28 are about flow/speed/approach and **none** is a fan speed, valve opening or pump speed. | open → §5 |
| B6 | HIGH | **Animation is not proportional to anything** | Plan SMIL: 54 flow dashes, **1 distinct duration** (3.00 s: 44, 3 s: 10) from one `flowDur` computed from one rack's flow; 89 CRAH rotors all `1.6 s` (duty count 89) whatever the fan speed; 3D: 31 `.fp-air` paths all `1.4 s`, and the 3D CRAH/CDU glyphs do not turn or flow at all. | open → §7 |
| B7 | HIGH | **Aisle temperatures: 3 per aisle, not 4; 1 cold value per pair; return air is one number** | 10 pairs × 3 points × (cold + hot) = 60 ids `C<p><s>t` / `H<p><s>t`; the west and east cold aisle of a pair share one value; return air = one text "HOT RETURN FROM THE CEILING PLENUM 36 °C"; values come from `RZ_SIM('hac…')` jitter (cold 25.5–26.5, hot 33.6–39.3 °C) around the engine planes 25 / 36 °C — correctly declared simulated, but a balanced hall (all ten pods identical, §6.4) has no physical cause for a 5.7 K spread of hot-aisle values. | open → §6.4 |
| B8 | HIGH | **The same quantity shows two different numbers** | CRAH inspector payload (`hmi-payloads.js:429`) "Fan speed 75 % design speed" (a literal with ±8 jitter) vs CRAH HMI sheet "Fan Speed 71 %, 1136 rpm, 55,325 m³/h" for CRAH-01; CDU HMI "3-Way Valve 73 %", "P1 80 %, P2 85 %", "Pump Speed 1,481 rpm" are page values, while the engine's own relation gives the 3-way valve **100 % to the heat exchanger** at design (TCS-out of the HX = HTW 37 + approach 3 = 40.0 °C = the TCS supply setpoint, zero bypass). The valve opening is an invented number today. | open → §6 |
| B9 | HIGH | **CDU-to-pod claim does not close** | The plan labels "CDU 01–06 … serving this containment pair" and each tooltip says "at the end of rows R01/R02". The drawing gives pods 0–4 six CDUs and pods 5–9 five (55 = 5 × 6 + 5 × 5). Pod liquid load = 44 racks × 142 kW × 85 % = **5,311 kWth**; five duty CDUs carry 5 × 983.5 = **4,917 kWth** (−7.4 %). Pods R11–R20 would be overloaded **if** a CDU served only its pod. The headers run the full 62 m, so the truth is "common header", but the text says otherwise. | open → §6.2 |
| B10 | MEDIUM | **Click targets under the WCAG 2.2 AA minimum (SC 2.5.8, 24×24 CSS px)** | Plan at 1440 and at 390 (same pixels): rack **20.8×9.6**, `leak:dh01` 1077×**6.3**, `fws-piping:dh01` 27×**6.3**, CDU 15.9×33.6, CRAH 20.9×21.3 (all 587 refs of the five sampled classes — 440 racks, 55 CDU, 90 CRAH, leak, fws-piping — are below 24 px in at least one axis; the cable tray was not sampled). 3D units are 32–40 px but only 27–35 % of a unit's box belongs to it (14×14 grid hit-test: R05-10 32 %, CDU-20 27 %, CRAH-01 35 %); a click at the box centre opens the neighbour in 5 of 6 sampled units (CRAH-01 → CRAH-02, CDU-01 → CDU-02, R01-22 → R02-21). No hover ring shows which unit the click will open. | open |
| B11 | MEDIUM | **Stale caption, two stacked sideways strips and a bottom bar over the stage at 390** | At 390 in 3D the plan's caption "DRAWN AT 3.3× SO EVERY LABEL CLEARS THE 8.5 PX FLOOR — SCROLL TO PAN" still shows above a 3D stage that is not drawn at 3.3×; the plan's header band stays a 1240 px pan strip (two sideways scrollers stacked: header 1240 px, stage 516 px). A fixed bottom bar "Datahall-1 · Floor 2 · North Wing" covers 60 px of the 390 stage. | open |
| B12 | MEDIUM | **Sibling drawings do not fit either (§2.6)** and one has a text collision | Room Layout `bldgSvg` 1860 px in a 1240 px pane (150 %); `DH-A-101` 1409 in 1238 (114 %); Rack sheet 946 px tall in 900; at 390 every sheet is forced to 0.9 scale (1116 px in a 360 px pane, 3.1×). `DH-M-101` COOLING OVERVIEW: label `PRESSURISATION` overlaps `DEGASSER` (**2 overlapping pairs**, both widths, both themes). Text under 8 px at 390: 5 on `DH-M-103`, 2 on the electrical overview (min 7.7 px). | open |
| B13 | MEDIUM | **Eight selectable halls, one hall** | `DH-1 … DH-8`: DH-8 prints "DATA HALL DH-08" with the same 440 racks, 67,382 kW, same sensors; no marker says the halls are identical engine slices. | open → Q3 |
| B14 | LOW | 3D row tag prints a bare number | `R01/02 6248` — kW with no unit; 3D runs one mode (`temp`) with no legend although `floor-plan.js` already implements `power`, `cooling-margin`, `alarms`, `space` (`paint(mode)`), unreachable from this page. | open |
| B15 | LOW | Layer / key mismatch | `hp-key` lists "Fan-wall module (spinning fan = duty)" — true in Plan only. | open |

**Measured clean (so the PRD does not chase them):** page errors 0 in all 8 states; same-origin 4xx 0; `NaN/undefined/[object]/—` in any visible text 0; text outside its svg 0 (Plan 128 texts, 3D 13); text-text overlap on the Data Hall tab 0; contrast below 4.5:1 for any svg text 0 in both themes (heuristic: fill against the stage background); every Plan equipment class opens its HMI (11 of 11 sampled refs); the five layer chips each change the drawing; `prefers-reduced-motion: reduce` stops the 32 CSS animations and pauses SMIL (`animationsPaused() === true`).

### 2.3 Parameters shown now vs what a hall operator expects (counted)

Today the floor prints per equipment **0 to 1** live numbers; the HMI sheets behind a click already carry more, but from page values (B8). Expected on a modern liquid-cooled hall BMS, per class:

| class (count) | shown on the floor now | in the HMI sheet now (source) | expected on the floor / one hover | missing on the floor |
|---|---|---|---|---:|
| CRAH / fan-wall module (90) | state only | supply 25.0, return 36 °C, fan 71 % / 1136 rpm, airflow 55,325 m³/h, filter ΔP 105 Pa, coil CHWS/CHWR (page values) | fan speed %, fan rpm, airflow, supply air, return air, CHW valve %, CHWS/CHWR, coil ΔP, state | 9 × 90 = **810** |
| CDU (55) | state; flow, rating in tooltip | secondary flow 1,483 L/min, pump rpm 1,481, P1 80 %, P2 85 %, P3 standby, 3-way valve 73 %, ΔP 1.68 bar, TCS 40/50, FWS 37/45, expansion tank 62 % | secondary flow, 3 pump states and speeds, primary valve %, 3-way valve %, TCS supply/return, HTW in/out, ΔP, approach, HX duty, tank level | 14 × 55 = **770** |
| row / TCS manifold (20 rows) | none | `ROW 02` tooltip: TCS 40/50, hall flow 80,103 L/min, per rack 182 L/min, manifold ΔP 0.87 bar | row flow, supply/return, ΔP, QD count | 5 × 20 = **100** |
| rack (440) | pair kW; inlet in tooltip | rack HMI: PSUs, trays, NVLink, manifold, QD pairs | inlet °C, liquid flow, ΔT, A/B state, kW | 5 × 440 = **2,200** |
| aisle (10 pods) | 3 points × (cold + hot) = 6 | none | 4 stations × (cold-W, cold-E, hot) = 12 per pod, return air per pod and per module | (120 − 60) = **60** |
| power path (20 rows) | none | `DH-E-1nn` sheets (peer) | busway A/B load, RPP A/B load, row kW, A/B state | 6 × 20 = **120** |
| valves | 1 glyph (HTW riser) | `TV-nnn`, `3-way` | opening % on every control valve | 90 + 55 + 55 = **200** |

Total operating values the floor does not yet carry: **≈ 4,260**, of which the 3D/Plan graphic needs ≤ 40 numbers at rest (the rest by hover, tap and the equipment modal; §7 LOD rule).

### 2.4 Defects in the engine feed, found while measuring

- `fan_pct` for a duty CRAH is a literal 75 with ±8 simulated jitter (`hmi-payloads.js:429`); the HMI sheet reads that point. Engine relation (below) gives 98.6 % all-run or 99.5 % with one standby.
- `valve_pct` (CRAH CHW valve) and the CDU `3-Way Valve` are page numbers; no engine key exists.
- `DHE` has no per-pod, per-row or per-module value; every hall slice is "hall total" or "per unit average".
- `RZPointStatus` limits exist for 53 DC AI records (`js/datahall-ai/points.js`) but the hall binds **0** points.

### 2.5 Existing gates and what they do not see

`tools/test-dcai-hall-iso.mjs` (D1–D7, 211 lines) proves 3D exists, counts, neutral colours, 30°, the toggle and a rack click — all of which pass while B1 breathes the stage. `test-datahall-ai-hall-plan.mjs` proves CDU/CRAH counts. **No gate measures that the stage is stable over time, that it fits the viewport, that a value is proportional to its drawing, or that a click lands on the unit it names.** That is the class of failure `feedback_gate_exists_but_unwired` and `feedback_check_every_ui_state` record.

### 2.6 Sibling drawings (fit and legibility only; measured the same way)

| tab / sheet | svg px at 1440 | pane | fits width | fits height 900 | at 390 | notes |
|---|---|---|:-:|:-:|---|---|
| Room Layout `bldgSvg` (building iso) | 1860×1318 | 1240 | no (150 %) | no | scroller 362 / content 1860 | scale 1.55 forced by the legibility pass |
| Room Layout `hmiFloorPlanSvg` (DH-A-101) | 1409×642 | 1238 | no (114 %) | yes | 360 / 1409 (3.9×) | the floor sheet is wider than its pane at 1440 |
| Rack Architecture `hmiRackSvg` (DH-R-101) | 1238×946 | 1238 | yes | **no** | 360 / 900 | 24 racks' parts, 0 `[data-point]` |
| Cooling `hmiCoolOverSvg` (DH-M-101) | 1238×559 | 1238 | yes | yes | 360 / 1116 | **overlap** PRESSURISATION × DEGASSER |
| Cooling `hmiCoolSvg` (DH-M-103 CDU line) | 1238×829 | 1238 | yes | yes | 360 / 1116, 5 labels < 8 px | the only sheet with `valve` and `rpm` words (2 + 2) |
| Cooling `hmiCoolPlantSvg` / `hmiCoolRowsSvg` | 1238×719 / 559 | 1238 | yes | yes | 360 / 1116 | `DH-M-104` TCS rows |
| Electrical `hmiElecOvSvg` | 1238×899 | 1238 | yes | borderline | 360 / 1116, 2 labels < 8 px | peer-owned |

Root cause shared with the peer PRD (A0): `--hmi-min-w = W × minScale` forces the svg wider than the stage on a phone and on the two wider sheets, and **Fit** only resets the viewBox. This PRD does not re-fix it; it states the law (HD-F7) and depends on the peer's fix.

---

## 3. Reference design — how a modern liquid-cooled AI hall is built, shown and run

| claim | source |
|---|---|
| Rack inlet temperature is measured at the equipment intake, several points along the aisle and at several heights; recommended envelope 18–27 °C, class A1 allowable 15–32 °C. This PRD uses **4 stations along each aisle** (both ends included, where recirculation is worst), the same choice as the Conventional PRD (it states it as a PRD choice; the exact clause is attached at Phase 2). | ASHRAE TC 9.9, *Thermal Guidelines for Data Processing Environments* |
| Direct-to-chip liquid takes ≈ 85 % of the rack heat on the TCS loop (40/50 °C here), the residual 15 % plus non-rack losses go to air. CDUs are liquid-to-liquid (plate HX) between the facility water (HTW 37/45 °C) and the TCS; the TCS loop is sealed, glycol-based, with pressurisation, air separation and filtration. | ASHRAE TC 9.9 *Liquid Cooling Resilience* / W- and S-class facility water; NVIDIA GB300 NVL72 reference design; vendor CDU data (CoolIT CHx1000, the engine's published approach 3 K) |
| Fan walls on two galleries blow into the cold aisles; the hot aisle is contained and returns through the ceiling plenum to the same walls. Running all installed fan-wall modules at a lower speed beats cold standby because fan power falls with the cube of speed. | ASHRAE 90.4; Guideline 36 (variable-speed supply fan, valve holds supply air); Uptime practice "N+1 concurrently running" |
| Affinity laws: flow ∝ n, head ∝ n², power ∝ n³. A VFD pump or fan reads its speed in % of rated (rpm or Hz). | Hydraulic Institute / ASHRAE Fundamentals |
| Heat balance: Q = ṁ·cp·ΔT, with air ρ·cp ≈ 1.2 kg/m³ × 1.006 kJ/kg·K; TCS (30 % PG) from the engine's own fluid constants. | ASHRAE Fundamentals |
| Control valves: equal-percentage inherent characteristic, flow ratio = R^(x−1) for opening x in 0..1, rangeability R = 50 declared; 3-way (mixing) valve on a CDU holds the TCS supply by splitting the return between the HX and the bypass. | IEC 60534-2-4; ISA-5.1 symbols; ASHRAE Guideline 36 |
| Quick-disconnect: every compute tray is a blind-mate supply/return pair on the rack manifold; a hall BMS shows rack flow and rack ΔT, not each coupling. | OCP / NVIDIA rack manifold practice |
| Power: dual-feed A/B, each busway (IEC 61439-6) feeds a row through tap-off units; RPPs (IEC 61439-2) split the A and B feeds per row group; a rack with two cords carries 50 / 50 normally and 100 % on the surviving cord. | IEC 61439-2 / -6; Uptime Tier III/IV 2N |
| Alarm state colours and deadband: running green, warning amber, alarm red, standby grey dashed; state is never decoration. | ISA-18.2; repo `css/conv-point.css` `--rz-pt-*` |
| A control that opens an object must be at least 24×24 CSS px or have 24 px of clearance. | WCAG 2.2 SC 2.5.8 |
| Hall air path quality indices: RCI (Herrlin 2005) and RTI = (T_ret − T_sup)/ΔT_equipment (Herrlin 2008); recirculation / bypass from supply vs demand airflow. | ASHRAE Transactions 111(2), 114(2) — as used in the Conventional PRD §6.4 |

---

## 4. Goals and non-goals

**Goals**
1. **The whole hall fits the stage, on both axes, at 1440×900 and 390×844, in 3D and Plan**, with a Fit button, wheel/pinch/keyboard zoom, drag/touch pan and a "focus the stage" mode (HD-F laws).
2. The floor is one **operator graphic with five lenses** — Layout, Thermal, Cooling, Power, Alarms — not five drawings: white space (this hall) against grey space (electrical wing, plant), row pods, containment, rack classes with kW, liquid vs air share.
3. **Every unit carries its operating state**: CRAH fan %, valve %, return and supply air; CDU pump speeds, primary and 3-way valve %, flow, TCS/HTW temperatures; row manifold flow; rack inlet; 4 temperatures per aisle; the A/B power path per row. Each value is an engine key, a named simulation function, or the words "not modelled" (§5).
4. **Animation is physical**: rotor period from fan speed, flow dashes from flow per branch, valve stem from opening; standby units still; reduced motion still with values intact.
5. Fix every open bug in §2.2 (B1 stays fixed and gated).

**Non-goals**
- Setpoints, SP lines, what-if sliders, control sequences → `PRD_SETPOINT_SIM.md`. This PRD leaves one `sp` slot per point (the record shape of `points.js` already has it).
- Electrical SLD sheets `DH-E-*` and `rz-hmi-sheet.js` fit mechanics → `PRD_ELECTRICAL_BMS.md`. This PRD draws only the hall-floor view of power.
- No CFD: per-rack inlet spread comes from the closed energy balance and declared allowances, not a flow solve ("not modelled": airflow field, pressure map).
- No second 3D renderer: the isometric floor stays `js/conv/floor-plan.js`, fed by `js/datahall-ai/hall-iso.js`.
- No decorative motion, glow or gradient (standing owner rule; `ANTI_VIBECODE_STANDARD`).
- The Conventional hall (`dc-conventional.html`) is `PRD-CONV-OPS-DEPTH/02`.

---

## 5. Parameter catalogue

Source classes: **ENG** existing engine leaf (name given), **ENG+** new engine key with its formula (§8), **SIM** a named page simulation function (declared, never a field reading), **NM** "not modelled" (printed as such). Limits follow `points.js` (`standard` / `design` / `assumed`, relative to the setpoint); a missing record is added there, never invented in a page.

### 5.1 Hall and pod (10 containment pods = row pairs R01/02 … R19/20)

| parameter | unit | source | shown | limits basis |
|---|---|---|---|---|
| racks, rows, racks per row, kW per rack, IT kW | – / kW | ENG `racksPerHall`, `rackRows`, `racksPerRow`, `kwPerRack`, `itHall` | hall strip, tooltip | – |
| pod IT kW (6,248) | kW | ENG+ `hall.pod.it_kw = racks_per_pod × kwPerRack` (44 × 142) | pod tag (with unit), tooltip | – |
| pod liquid / air heat (5,311 / 937 kWth rack share; air total incl. non-rack loss from `airHeat`) | kWth | ENG+ `hall.pod.liquid_kwth = pod.it_kw × liquidCapturePct/100`; `air_kwth = airHeat × pod.it_kw / itHall` | Cooling lens, tooltip | – |
| white-space area, rack field, corridor, CDU line, fan-wall, spare (m²) | m² | ENG `hallAreaM2`, `rackFieldM2`, `crossAisleM2`, `cduGalleryM2`, `airPlantM2`, `floorSpareM2` | Layout lens legend | – |
| grey space: electrical wing per hall, transformer rooms, UPS/battery, MMR, NOC | m² | ENG `elecHallM2` (`electrical_m2_per_hall`), `elecWingM`, site `T.*` keys on the Room Layout tab; MMR/NOC areas **NM** | Layout lens rail | – |
| rack class | – | ENG: 1 class (GB300 NVL72, `racksPerHall` all); network, storage, OOB racks: **NM as racks** — the engine counts 880 switches per hall (`switchesPerHall`) and a 2 % storage/mgmt kW allowance, not racks | Layout legend "NVL72 × 440; network/storage racks not modelled" | – |
| liquid vs air share | % | ENG `liquidCapturePct` (85) | Cooling lens | – |

### 5.2 Aisle temperatures — 4 stations (per pod: cold-W, cold-E, hot; 4 along the aisle)

| parameter | unit | source | shown | limits basis |
|---|---|---|---|---|
| `pod.<p>.station<k>.cold_w_c`, `…cold_e_c`, `…hot_c`, k = 1..4 (12 per pod, 120 per hall) | °C | ENG+ `getHallAir` (§6.4): T_in = T_sup + β·ΔT/(1−β) + a(k); T_hot = T_in + ΔT_IT; a(k) the aisle-end allowance A2 (default 0 K, ASSUMED, shared with the Conventional PRD) | 4 state dots per aisle line, numbers in Thermal lens and tooltip | ASHRAE TC 9.9 A1: recommended 18–27, allowable 15–32 (cold); hot aisle `design` vs `airReturnC` |
| supply air per module and plenum return | °C | ENG `airSupplyC` (25), `airReturnC` (36); per module ENG+ `module.<n>.return_c` §6.4 | CRAH tooltip, Thermal lens | `points.js` air records |
| ΔT_IT (11 K), RTI, RCI_HI / RCI_LO | K, % | ENG+ per §6.4 (Herrlin) | pod tooltip, hall chip | RCI ≥ 96 % good (Herrlin); stated, not coloured unless a record exists |
| station heights (bottom/middle/top) | °C | ENG+ vertical profile **NM** until A3 of the Conventional PRD is adopted (0 K offset); shown as "equal at adopted 0 K" | station inspector only | – |

### 5.3 Fan-wall module (CRAH-nn, 90)

| parameter | unit | source | shown |
|---|---|---|---|
| state RUN / STBY / TRIP | – | ENG+ `module.<n>.state`: all installed run by default (Q1), STBY only if the owner keeps cold standby | lamp + fan rotor |
| fan speed | % | ENG+ `module.fan_pct = clamp(duty/rating, min%, 100)`; all-run 17,755 / (90 × 200) = **98.6 %** (today 99.5 % on 89) | rotor period, tooltip, HMI |
| fan rpm | rpm | ENG+ `fan_pct × rated_rpm` — rated rpm **NM** in the engine (the HMI's 1,136 rpm = 71 % × 1,600 is a page literal) → show % only, rpm "not modelled" until a model value exists | HMI |
| airflow | m³/h | ENG+ `module.airflow = airFlowM3s / n_running × 3600` (`design.flows.air_flow_m3s_per_hall` 1,338) | tooltip, air-arrow rate |
| supply air / return air | °C | ENG+ `module.supply_c = airSupplyC − dev`; `return_c` §6.4 | tooltip |
| CHW valve opening | % | ENG+ `module.valve_pct = 100·(1 + ln q / ln R)`, q = duty/rating, R = 50 (IEC 60534-2-4) → q = 0.995 → **99.9 %**; saturation at 100 % flagged amber | valve stem, tooltip |
| CHWS / CHWR, coil ΔT | °C | ENG `chwSupplyC`, `chwReturnC` (19/27) | tooltip |
| coil / filter ΔP | Pa | filter ΔP **SIM** (`RZ_SIM`, declared) until a model value exists; coil ΔP **NM** | HMI |
| input power | kW | ENG `fan_power_kw = P_rated × (fan_pct/100)³` (affinity) — equals `design.…crah_fans_kwe` at 100 % | HMI |

### 5.4 CDU (CDU-nn, 55) and TCS

| parameter | unit | source | shown |
|---|---|---|---|
| state RUN / STBY | – | ENG `cduRunning` (54) / `cduInstalled` (55); all-run option as Q1 | lamp |
| secondary (TCS) flow | L/min | ENG `cduFlowPerUnitLpm` (1,483); ENG+ per unit `= tcsHallLpm / n_running` | tooltip, flow dash rate |
| duty | kWth | ENG `cduDutyPerUnit` (983.5), `cduRating` (1,000) | tooltip, load bar |
| TCS supply / return | °C | ENG `tcsSupply`, `tcsReturn` (40/50), ΔT `tcsDeltaT` 10 K | tooltip |
| HTW in / out | °C | ENG `htwSupplyC`, `htwReturnC` (37/45) | tooltip |
| approach | K | ENG `cduApproachK` (3, published CHx1000) | tooltip |
| pump P1/P2/P3 state and speed | %, – | ENG+ `cdu.pump.speed = q_unit / q_rated` (affinity, fixed system curve declared, flow ∝ n); P3 standby when 2+1; HMI rpm = % × 1,450 (nominal 4-pole 50 Hz, `hmi-v2.js` `NOMINAL`, declared) | tooltip, HMI |
| primary (HTW-side) control valve `TV-nn1` | % | ENG+ `valve_pct = 100·(1 + ln q/ln R)`, q = Q_unit/Q_rated | valve stem |
| 3-way (mixing) valve to the HX | % to HX | ENG+ `f = clamp((T_ret − T_sp)/(T_ret − T_hxout), 0, 1)`, T_hxout = HTW_in + approach = 40.0 °C = T_sp → f = **100 %** at design, bypass 0 % (replaces the literal 73 %) | valve stem, HMI |
| differential pressure, expansion tank level, strainer ΔP | bar, % | **SIM** (declared) or **NM**; the engine has none | HMI only |

### 5.5 Row manifold and rack (liquid)

| parameter | unit | source | shown |
|---|---|---|---|
| per-rack TCS flow | L/min | ENG `tcsFlowRackLpm` (182.05) | rack tooltip |
| row TCS flow (22 racks) | L/min | ENG+ `row.tcs_lpm = racksPerRow × tcsFlowRackLpm` (4,005); pod = 2 rows (8,010); hall 80,103 (ENG `tcs_hall_lpm`) | pipe dash rate, row tooltip |
| row supply / return | °C | ENG `tcsSupply`/`tcsReturn` | tooltip |
| manifold ΔP | bar | **SIM** (the row tooltip's 0.87 bar is a page literal) → **NM** until a model exists | tooltip |
| quick-disconnect pairs per rack | count | ENG model: compute trays per NVL72 (18 compute + 9 NVLink switch trays are the rack sheet's `CT-n`/`NS-n`); QD per coupling **NM** | rack HMI |
| rack inlet air | °C | ENG+ station value of the rack's pod (§5.2) | rack tooltip, 3D rack face tint |

### 5.6 Hall-floor power path (view only; electrical SLD sheets are the peer's)

| parameter | unit | source | shown |
|---|---|---|---|
| row kW (3,124) | kW | ENG `rowItKw` / `groupKw` | row tag |
| busway trunk rating / loading (5,000 A / 93.9 %) per row | A, % | ENG `buswayA`, `buswayLoadPct` | Power lens, pipe-style bar |
| RPP count per hall (40), RPP per row (2: A and B) | – | ENG `rppPerHall`, `rackGroups` (20) | Power lens |
| rack feed current (213 A), per cord | A | ENG `rackFeedA`, `rack_feed_current_per_cord_a` (engine.js:634) | rack tooltip |
| A and B normal share / failover | % | ENG+ `row.a_pct = 50`, `b_pct = 50` normal; 100 / 0 failover (same convention as the page's UPS "nrm / fail") | Power lens |
| feed A / feed B energised | state | existing inspector payload "Feed A ENERGIZED" | rack lamp pair |
| tap-off box per rack, PDU | – | **NM** (GB300 NVL72 uses in-rack power shelves PS-01..08 from the rack sheet; there is no hall PDU) — stated, not drawn | Layout legend |

---

## 6. Control and relations to model (steady state, deterministic — no `Math.random`, no fake dynamics)

### 6.1 State machines
- **Fan-wall module**: RUN (counts toward the fleet; speed §6.3), TRIP (scenario input: speed 0, lamp alarm, the others share its heat), STBY (only if Q1 keeps cold standby; grey dashed, speed 0), MAN (operator override, SP peer).
- **CDU**: RUN with pumps 2 + 1 (two duty, one standby per unit, as the HMI states); unit STBY only on Q1; TRIP (scenario).
- Scenario inputs are the page's existing ones (`hmi-payloads.js` `normal`, `cdu-pump-fail`, `chiller-trip`, `leak-z07`) plus two added here: **fan-wall module trip** and **CDU trip**; the Scenarios button list stays where it is.

### 6.2 Liquid side: CDU to pods
Heat per pod Q_pod = pod IT kW × 85 % = 5,311 kWth. The TCS supply/return headers are **common to the hall**: every CDU feeds the same header, so a CDU does not "serve" a pod. Required text: "CDU-nn · hall TCS header" and no per-pod "serving" claim; CDU position on the floor is **where it stands**, not a duty assignment. Per-unit duty = liquid kWth / n_running: 53,108 / 54 = 983.5 (today) or 53,108 / 55 = 965.6 kWth (all-run, 96.6 % of rating, Q1). A per-pod check is a **law**, not a claim: Σ(duty CDUs) ≥ Σ(pod loads) hall-wide (HD-N3), never per pod (B9 is the red-today proof).

### 6.3 Fan, pump, valve (affinity + equal-percentage)
- Fan speed = duty / rated × 100, saturated at 100 % (constant air ΔT, the engine's rule). All-run: n_running = installed.
- Pump speed = q_unit / q_rated × 100 (flow ∝ n); power ∝ n³.
- Valve flow ratio q = duty / rated (same ΔT); equal-percentage opening x = 1 + ln q / ln R, R = 50, clamped 0..1. 99.5 % load → 99.9 %; 50 % → 82 %; 25 % → 65 % (the same table as the Conventional PRD §6.3).
- Supply air against SP: valve < 100 % ⇒ supply = SP; at 100 % the coil is saturated: supply = T_ret − Q_cap/(V̇·ρ·cp) and the deviation is a positive number shown amber.
- 3-way valve to HX: f = clamp((T_ret − T_sp)/(T_ret − T_hxout), 0, 1). At design f = 1. With a colder HTW (say 33 °C, approach 3 K) T_hxout = 36 < 40 ⇒ f = 10/14 = 71 %: the **only** scenario in which a bypass appears; it comes from the HTW input, not from a literal.

### 6.4 Pod air balance (closed energy balance, identical to Conventional PRD §6.4)
For pod p: V̇_IT from the rack air heat, V̇_sup from the fan walls; R = max(0, V̇_IT − V̇_sup), B = max(0, V̇_sup − V̇_IT); β = R/V̇_IT, γ = B/V̇_sup.
T_in = T_sup + β·ΔT_IT/(1−β) + a(k); T_hot = T_in + ΔT_IT; T_ret = ((V̇_IT − R)·T_hot + B·T_sup)/V̇_sup; **check (a law)**: V̇_sup·ρ·cp·(T_ret − T_sup) = Q_air,pod. Per module j: T_ret,j = Σ_p w_jp · T_ret,p; duty_j = V̇_j·ρ·cp·(T_ret,j − T_sup).
**Today** all ten pods are identical (balanced, β = γ = 0): every station reads 25.0 cold and 36.0 hot and ΔT = 11 K. The ±1 K "spread" the page prints is simulation, not physics. Spread appears only from scenarios (module trip raises the nearest pods' inlet; CDU trip shifts liquid duty, not air).

### 6.5 What the scenario buttons must change
- module trip → speeds of the others, valve openings, pod inlet temperatures, RTI/RCI, 3D rack face colour of the affected pods;
- CDU trip → pump speeds and primary valve openings of the rest, TCS flow per unit, HX duty, standby start (Q1: none, already running);
- leak zone → the leak rope zone and the supply isolation valve of that row (a state, no new number).

---

## 7. Drawing and animation changes

### 7.1 One stage, fit on both axes (law family HD-F)
- **Stage-first layout.** The block above the stage today is 434 px at 1440×900 (alert strip, DH nav, KPI row, 3 header cards, toggle). The header cards collapse to one line (their numbers are already in the KPI row) and the 8 DH selector buttons become one select (see Q3) → stage top ≤ 260 px at 1440×900 and ≤ 330 px at 390×844. The 390 bottom bar (60 px) is subtracted from the stage.
- **Height is derived from the stage's own top**: `Hh = visualViewport.height − stage.top − bottomBar − 8` (replaces `innerHeight − 40`), recomputed on resize/orientation, throttled to one `requestAnimationFrame`, and **never read from the element it sizes** (B1 cause).
- **Fit** = `fitBox(content, stage, pad)` pure function: viewBox that contains the whole hall, centred, keeping aspect. Fit button, key `0`, double-click/double-tap on empty floor.
- **Zoom/pan** via the svg `viewBox` (no rebuild, no scroll container): wheel (ctrl/pinch), `+` `-`, drag/touch pan, clamp 1× … 8×; the `.fp-scroll` sideways scroll is disabled while the controller is active. Shared pure helpers `fitBox`, `zoomAt`, `panBy` in a new `js/conv/stage-zoom.js` (UMD, node-testable); the Conventional hall may adopt it later.
- **Level of detail** driven by the effective unit u (the drawing already computes it): LOD0 any u — pod tags, lamps, row kW; LOD1 u ≥ 7 px — CRAH rotors, 4 station dots per aisle; LOD2 u ≥ 12 px (3D at 1440) — valve stems on CRAH and CDU, pipe dashes, A/B bars; tooltip on hover/focus/tap for the full list. On a phone at Fit (u < 7) the hall reads as 10 pod blocks with tags and state colour; zoom reveals racks.
- **Focus mode** (key `F`, button): the stage takes the full viewport under the 48 px cockpit bar; Esc exits.
- Default projection: 3D at ≥ 600 px, Plan below (kept).

### 7.2 Layout lens (white space and grey space, pods, containment, racks)
White space is drawn as today (62 × 31 m: fan-wall galleries N and S, 20 rows, corridor, CDU line, service); **grey space** appears as a labelled rail along the hall walls with engine areas (electrical wing, UPS/battery, MMR, NOC; §5.1), each a link to its Room Layout zone. Pods: a 1 px hairline around each row pair with the contained-hot-aisle roof (kept), tag `R01/02 · 6,248 kW` **with unit**. Rack class legend: "NVL72 × 440 · 142 kW · 85 % liquid"; network/storage "not modelled as racks".

### 7.3 Lens bar (five lenses on one floor)
`Layout · Thermal · Cooling · Power · Alarms`. The renderer already implements `power`, `temp`, `cooling-margin`, `alarms`, `space` (`floor-plan.js paint(mode)`); the page exposes them as the five lenses (Layout = `space`, Cooling = `cooling-margin` + pipe overlay). One lens at a time on a phone; two on desktop (Thermal + Cooling). The plan's own layer chips (Thermal, Airflow, Liquid, Leak, Overhead) remain for Plan and map onto the same lenses.

### 7.3b Per symbol

| symbol | change | animation rule | state colour |
|---|---|---|---|
| CRAH fan | Plan and 3D: broken-ring rotor (the site's `css/conv-vfx.css .vfx-rotor`, period `RZConvVfx.rotorSeconds(fan_pct)`), turning in the module's face plane in 3D | duration from fan %, bucketed to 5 % steps; STBY/TRIP still; < 5 % still | running green / warning amber / alarm red / standby grey dashed |
| CRAH valve | ISA two-way valve glyph with a stem bar of length = valve % on the module side | none (position, not motion) | amber at saturation |
| CDU | two stacked pump glyphs (P1, P2, P3 stby) each with a speed % ring; primary and 3-way valve glyphs with stems; flow arrow | pump rotor period from pump %; flow dash from secondary flow | state tokens |
| TCS header and row manifold | dash rate `RZConvVfx.dashSeconds(q / q_design)` per **branch**: hall header = hall flow, row = 4,005 L/min | one distinct period per branch family (≥ 3 distinct periods on the floor, not 1) | cyan supply / orange return (the page's liquid palette, kept off state colour) |
| HTW and CHW risers | same rule with their own flows (`htwFlowHallM3h`, `chwFlowHallM3h`) | per flow | green / blue (kept) |
| Aisle stations | 4 dots per aisle line, state token per station; numbers in Thermal lens and tooltip | none | `--rz-pt-*` |
| Rack | inlet tint steps in Thermal lens (existing 3 steps from the pod value); A/B lamp pair | none | state |
| Busway / RPP | bar showing loading % per row (A above, B below), colour by `points.js` record | none (a static conductor; energised/de-energised is state, not motion) | state |
| Row tag | pod tag with unit; row tag letter + current-lens value | none | point state |
| Leak rope | thicker hit area (24 px) and zone dots | none | alarm red when wet |

### 7.4 Phone (390 px)
Plan is the default; the page does not scroll sideways (stage is exactly the column width); Fit shows the hall as 10 pods with tags; pinch zooms to rows and racks (LOD1/2); a long-press or tap opens a bottom sheet (`RZSheet`) with the unit's parameter list; hit areas ≥ 24 px (pod blocks and units) or clearance 24 px; the 60 px bottom bar is part of the stage budget; the stale 3.3× caption is removed.

### 7.5 1440 px
3D default; the five lenses, 4 station dots per aisle and valve stems draw; numbers at rest ≤ 40 (pod tags 10, hall chips ≤ 6, lens legend); the rest by hover and the right-hand panel; the HMI modal stays the click target.

### 7.6 Sibling sheets
Room Layout `DH-A-101`, Rack `DH-R-101`, Cooling `DH-M-101…104`: the shared Fit fix (peer) plus (i) the `PRESSURISATION`/`DEGASSER` label collision on DH-M-101 resolved by the diagram engine's label placement (`RZDiagram` warnings = failures), (ii) labels ≥ 8.5 px at the sheet's phone scale or a legible LOD. No new sheet is added.

---

## 8. Engine changes (`dcai-engine.js` 1.6.0 → 1.7.0 proposed, one minor)

| addition | content |
|---|---|
| `DCAI_CALC.getHallAir(scenario)` pure | pods p = 1..10, stations k = 1..4, modules j = 1..90: V̇_sup, V̇_IT, β, γ, T_in (cold-W, cold-E), T_hot, T_ret, ΔT_IT, RTI, RCI, per module return and duty; hall roll-ups; energy-balance residual |
| `getFleet('crah')` | `state`, `fan_pct`, `airflow_m3h`, `valve_pct`, `supply_c`, `return_c`, `fan_power_kw` (§5.3) |
| `getFleet('cdu')` | `state`, `flow_lpm`, `duty_kwth`, `pump[1..3].{state, pct}`, `primary_valve_pct`, `threeway_to_hx_pct`, `tcs_supply_c`, `tcs_return_c`, `htw_in_c`, `htw_out_c`, `approach_k` |
| `getHallRows()` | per row: `it_kw`, `tcs_lpm`, `busway_a`, `busway_loading_pct`, `a_pct`, `b_pct`, `rpp_a_load`, `rpp_b_load` |
| new `cooling.*` / `hall.*` keys | `crah_valve_rangeability` (50, declared, IEC 60534-2-4), `crah_running_mode` ('all-run', Q1), `aisle_end_allowance_k` (0, ASSUMED, shared with Conventional A2), `cdu_pump_nominal_rpm` (1,450 declared, 4-pole 50 Hz), `hall_pods` (10) |
| compatibility | `crahActive`, `cduRunning`, `cduInstalled`, `crahInstalled` keep their meaning; the page-literal `fan_pct` 75 and `3-Way Valve 73 %` are deleted (B8) |
| registry | `data/dcai-parameters` (`js/dcai-parameters.js`) rows for the new ids (per pod 12 + per module 6 + per CDU 12 + per row 6 ≈ 120 + 540 + 660 + 120 = ~1,440 ids, generated, not hand-typed); `points.js` records for every banded id |
| page | `renderHall()` and `hall-iso.js` read `getHallAir` / `getFleet`; the `RZ_SIM('hac…')` jitter for the 60 sensor ids is retained only as an explicit "SIM" overlay toggled off by default |

DOM / SVG budget: at rest the Data Hall tab adds ≤ 40 `[data-point]` nodes (pod and hall level); per-unit ids render on selection. SVG: station dots, rotors, valve glyphs and pipe dashes ≤ +600 nodes (3D 4,662 → ≤ 5,262; +13 %); build ≤ 1.3 × today's median (the controlled A/B method from `feedback_perf_ab_measurement_traps`).

---

## 9. Laws (each has a proof; "red today" is what the proof shows on tree `01c9aa43f`)

Gate files (new): `tools/test-dcai-hall-depth.mjs` (browser: signed in, 1440 and 390, both themes, 3D and Plan, own HTTP server, rz-lane) and `tools/test-dcai-hall-air-liquid.mjs` (node core: the relations of §6). Chrome measured in a state the owner sees, never the resting one.

| ID | claim | proof | red on today? |
|---|---|---|---|
| HD-B1 | the 3D stage is stable: over 20 s at 500 ms, host width and svg `viewBox` take **1 distinct value**, no element moves (> 0.6 px), `nodes` constant; also with a 1 px host border and after a resize | browser: sample host box, viewBox, element positions | **RED**: 12 distinct viewBoxes, width 1220 → 930, 3,553 of 8,527 moved; green after the pending patch. Mutation: set the border back on `#hIso` while `measure` = host. |
| HD-B2 | every click on a 3D equipment target opens the HMI of the unit **named by its own tooltip/label**; the selected unit shows a ring before the click | browser: for 5 samples per class click the centre of the largest **visible** (hit-tested) polygon; title equals ref | partly red: 5 of 6 box-centre clicks open the neighbour. Mutation: swap the paint order of two units. |
| HD-B3 | no text-text overlap and no text outside its svg on the Data Hall tab or on `DH-A/R/M` sheets, both themes, both widths | browser: pairwise text rects | **RED** for DH-M-101 (2 pairs). Mutation: shift `PRESSURISATION` x by 30 px. |
| HD-B4 | click target ≥ 24 px (or 24 px clearance) for every `[data-rz-equipment]` on the floor at the effective scale | browser: bbox (incl. invisible hit rect) | **RED**: all 587 sampled refs below 24 px in an axis. Mutation: shrink a hit rect to 10 px. |
| HD-F1 | at Fit, the **whole hall content box ⊂ stage rect on both axes (±1 px)** at 1440×900, 3D and Plan | browser: union of drawn element boxes vs stage rect | **RED**: bottom 340 px (3D) / 224 px (Plan) outside the fold |
| HD-F2 | same at 390×844, 3D and Plan, with the 60 px bottom bar excluded | browser | **RED**: 3D svg 482 in 358 (145 %); Plan 1240 in 390 (3.2×) |
| HD-F3 | stage bottom ≤ viewport bottom and stage height ≥ 60 % of viewport at 1440×900, ≥ 50 % at 390×844 | browser | **RED**: bottom +340 px; only 466 of 900 px (52 %) of the stage is visible below its top at 434 |
| HD-F4 | zoom/pan: a wheel (ctrl) and a pinch change the `viewBox` scale within 1×…8×; drag pans; Fit restores the same viewBox string; the 3D page never rebuilds (node count constant) | browser: synthetic wheel, touch, pointer | **RED**: 0 controls, no response |
| HD-F5 | page `scrollWidth ≤ viewport` and the stage has **no** inner sideways scroller (`scrollWidth ≤ clientWidth`) at Fit | browser | **RED** at 390: 516 vs 356 |
| HD-F6 | LOD rule: at u < 7 px no label is under 8.5 px (LOD0 draws tags only); at u ≥ 12 valve stems exist | browser: min effective font size, node counts per LOD | red at 390 (rack 6.1 px) |
| HD-F7 | the shared sheet Fit (peer) holds for DH-A-101, DH-R-101, DH-M-101…104 at 1440 and 390 | browser (reuses the peer's `test-electrical-bms.mjs` fit probe) | **RED**: 1860 / 1409 / 946 px; 1116 in 360 |
| HD-T1 | 4 stations per aisle: 12 station values per pod, 120 per hall, in Thermal lens and tooltip | browser: count `[data-st]` | **RED**: 60 |
| HD-T2 | energy closure: V̇_sup·ρ·cp·(T_ret − T_sup) = Q_air,pod (±0.5 kW) per pod and Σ pods = `airHeat` (±0.5 kW); T_hot − T_in = ΔT_IT | node core | n/a (no per-pod value exists; red = missing function) |
| HD-T3 | at the adopted design (balanced) every station reads the engine planes: cold 25.0, hot 36.0, ΔT 11 K; a module trip raises the nearest pod's inlet (T_in + β·ΔT_IT/(1−β)) | node core + browser scenario | **RED**: today's stations spread 25.5–26.5 / 33.6–39.3 (simulation) |
| HD-T4 | return air shown per module and per plenum; each equals ENG+ `return_c` | browser | **RED**: 1 plenum number |
| HD-C1 | CRAH fan % = duty/rating (all-run 98.6 %); valve % = 100·(1 + ln q/ln R) (99.9 % at q 0.995, 82 % at 0.5, 65 % at 0.25); airflow = `airFlowM3s`/n_run × 3600 | node core worked values | **RED**: payload literal 75 %, HMI 71 %, inspector vs HMI differ |
| HD-C2 | the inspector and the HMI sheet show the **same** fan %, valve %, airflow for a unit (one source) | browser: open inspector and HMI, compare | **RED**: 75 vs 71 |
| HD-C3 | CDU: pump % = q_unit/q_rated; primary valve %; 3-way % = clamp((T_ret − T_sp)/(T_ret − T_hxout),0,1) → 100 % at design, 71 % with HTW 33 °C | node core | **RED**: HMI 73 % literal |
| HD-C4 | the hall duty closes: Σ(duty CDU kWth) = `liquidHeat` (±0.5 kWth) and Σ(duty units) ≥ Σ(pod loads); no tooltip claims a unit "serves" a pod | node core + browser text scan | **RED** (text): "CDU 01–06 … serving this containment pair"; pods 5–9 have 5 CDUs = 4,917 < 5,311 kWth |
| HD-P1 | pipe dash period per branch is a function of its flow (`dashSeconds(q/q_design)`): ≥ 3 distinct periods on the floor; doubling a branch flow halves its period (±5 %); zero flow stops it | browser: SMIL/CSS durations; scenario CDU trip | **RED**: 1 distinct period (3.00 s) |
| HD-P2 | rotor period = `rotorSeconds(fan_pct)` bucketed; a STBY/TRIP unit does not turn; ≥ 4 distinct rotor periods after a module trip | browser | **RED**: 89 × 1.6 s, 0 in 3D |
| HD-P3 | valve stem length = opening % (±1 px per 1 %); a unit trip changes the neighbours' stems | browser: stem bbox | **RED**: 0 stems |
| HD-P4 | reduced motion: no moving element, every value still printed | browser, both preferences | green today for CSS and SMIL; must stay green with the new animations |
| HD-E1 | Power lens: per row busway A/B load, RPP A/B, row kW equal ENG (`buswayLoadPct`, `rowItKw`); A/B 50/50 normal, 100/0 on a feed loss | node core + browser | **RED**: 0 power values on the floor |
| HD-E2 | the Power lens agrees with the peer's SLD sheet (`DH-E-1nn`) for the same row: same load % and A/B state | browser: compare lens text and sheet text | n/a (blocked on the peer sheet) |
| HD-L1 | pod tag has a unit (`kW`); the Layout lens shows white space area (ENG `hallAreaM2` 1,922 m²) and the grey-space rail with engine areas; a "not modelled" string for network/storage racks | browser | **RED**: `R01/02 6248` unitless; no grey space |
| HD-L2 | lens bar: five lenses switch the drawing's mode; each changes `data-state`/fill of ≥ 1 element class | browser | **RED**: 3D has 1 mode, no control |
| HD-N1 | every new value has a source label in the registry (ENG / ENG+ / SIM / NM); no value without one; no `Math.random` in the hall path | node: registry scan, source grep | partly red (jitter on 60 ids) |
| HD-N2 | `DHE` / `DCAI_CALC` identity: pod it_kw × 10 = `itHall`; module Σ duty = `airHeat`; CDU Σ duty = `liquidHeat` | node core | n/a |
| HD-N3 | `[data-point]` on the hall: ≥ 30 pod and hall points bound to `RZPointStatus` with a `points.js` record each; a banded value turns amber/red at its limit | browser + node | **RED**: 0 |
| HD-U1 | a fixed bottom bar never covers the stage's last 24 px; the stale "3.3×" caption exists only while Plan is shown | browser | **RED** at 390 |

Mutations that must turn the gate red: re-add the border while measuring the host (HD-B1); swap a rotor duration for a constant (HD-P2); hard-code `fan_pct = 75` (HD-C1/C2); set all `dur` to one value (HD-P1); delete a station dot (HD-T1); shrink a hit rect (HD-B4); change `HD-T2` so Σ w ≠ 1; widen the stage by 1 px past the viewport (HD-F1).

Hard rules inherited: no `Math.random` on a basis value; state colours only from `--rz-pt-*`; no glow, no decorative motion; text ≤ 40 numbers at rest; every claim measured in a **rendered** state at 390 and 1440.

---

## 10. Phases (each shippable alone, ≤ one release of work)

| phase | content | laws it turns green |
|---|---|---|
| P0 patch (≤ 1 day) | land the shrink fix (pending) + regression law; derive `Hh` from the stage top; remove the stale 3.3× caption in 3D; pod tag unit; resolve the DH-M-101 label collision; "CDU serving" text → "CDU-nn · hall header"; clear the hit-test ambiguity with a hover ring | HD-B1, B3, L1 (unit), C4 (text), U1 |
| P1 fit and zoom | stage-first layout, `js/conv/stage-zoom.js`, Fit, wheel/pinch/keys, focus mode, LOD0/1 at phone | HD-F1…F6, B2, B4 |
| P2 engine depth | `getHallAir`, `getFleet` (CRAH, CDU), pods, 4 stations, return air, valve %, fan %, pump %, 3-way; delete the literals; unify inspector and HMI; registry rows and `points.js` records; Thermal and Cooling numbers in tooltips | HD-T1…T4, C1…C3, N1…N3 |
| P3 piping and motion | pipe overlay (TCS headers, row manifolds, HTW, CHW, valves), per-branch dash periods, rotors in Plan and 3D, valve stems, CDU/CRAH scenario trips | HD-P1…P4 |
| P4 layout and power lens | five-lens bar, white/grey space rail, pod and rack legend, Power lens (busway/RPP/A–B) agreed with the peer's SLD | HD-L1, L2, E1, E2 |
| P5 sheets | shared Fit applied to `DH-A/R/M`; sheet label and legibility fixes (needs the peer's A1 landed) | HD-F7, B3 |

Dependencies: P5 and HD-E2 wait on `PRD_ELECTRICAL_BMS` (shared fit, DH-E sheets). P2 shares the relations with `PRD-CONV-OPS-DEPTH/02` (propose one shared `hall-air` core to avoid two copies; each page keeps its own engine adapter).

### Risks
- **Gate parity**: a fit gate that measures a different box than the owner sees passed before (`feedback_desktop_window_is_not_a_phone`, `feedback_check_every_ui_state`): the gate runs mobile emulation with touch and the real stage top.
- **Headless**: a render loop during load blocks `networkidle2` (`feedback_webgl_headless_gate_traps`); the SMIL/CSS pipe motion stays off the critical path and is paused while the tab is hidden.
- **Perf**: +600 SVG nodes and per-branch animations; budget and A/B method in §8.
- **Two shared module copies** (Conventional and DC AI hall-air): one core, two adapters.
- **Fit mechanics** touch `floor-plan.js` (shared with the Conventional hall): changes behind an option, covered by `test-conv-datahall-space.mjs` (SP1–SP10) as a regression.
- **Peer collisions**: parallel sessions share the `rz-work` checkout; stage only this PRD's files.

### Open questions for the owner (max 3 — taste and scope only)

- **Q1 Standby-running.** For the 89 + 1 fan-wall modules and the 54 + 1 CDU, default **all installed units run at lower speed** (no cold standby), as you asked for the chiller plant (R188)? Result: CRAH 98.6 %, CDU 96.6 % load, no "standby" grey units unless you keep one. Or keep one cold standby per fleet as drawn today?
- **Q2 Sibling tabs.** Do `ROOM LAYOUT`, `RACK ARCHITECTURE` and `COOLING & PIPING` stay as separate reference sheets (this PRD adds the shared Fit and fixes their labels), or do you want them folded into the Data Hall lenses and removed from the tab bar?
- **Q3 DH-1 … DH-8.** The eight halls are identical engine slices. Keep eight buttons, show "identical to DH-1" on 2–8, or leave one hall until real per-hall differences exist?
