# PRD-ELECTRICAL-BMS — the substation and the electrical sheets read like the BMS hall

Status: **APPROVED 2026-11-22 (R186); amendment 2 APPROVED 2026-11-22 (R190, R191).** Builder: me (owner pattern R185: "Kamu yg tentukan").

## 0. Context

Owner, 2026-11-22, right after the 3D data hall (R185, v3.89.0 / v3.90.0):
> "Sempurnakan juga yg substation/electricalnya"

Measured live (v3.89.0, signed in, 1440 and 390 px, dark; shots in `$S/el-before/`):

| # | page | gap | evidence |
|---|---|---|---|
| G1 | EPMS `EPMS_Telemetry.html`, HV / MV | The drawing fills about 2/3 of the stage width; the right third is empty. The sticky status bar covers the transformer row (TX-1, TX-2, NGR). | epms-sld-1440, epms-sld-svg |
| G2 | EPMS, HV / MV and LV | Equipment is line symbols only. A breaker's state is a word in 9 px grey (CLOSED). There is no boxed value tag; kW and A are loose text. | epms-sld-1440, epms-lv-1440 |
| G3 | DC AI Electrical SLD, overview | Feed colours are identity, not state: Feed A is blue, Feed B green, generator amber. An energized path and a healthy one look alike. Seven hall feeders (DH-02…08) are bare stubs. One symbol (DH-U-101) floats unconnected on the right. About 40 % of the 1200 × 2190 sheet is empty. | dcai-overview-tall |
| G4 | DC AI "Energized path & rack availability" | At 1440 × 900 the summary box collapsed to about 25 px wide, so its text is not readable. It fills only on a taller window. The training scenario select is `disabled`. | dcai-elec-1440 vs dcai-overview-tall |
| G5 | Both pages | The two cockpits draw the same physics in two visual languages: the EPMS green "Running" dash; DC AI uses blue / green / amber by feed. | both |
| G6 | Both pages | No 3D. The data hall now has a `3D \| Plan` switch and an isometric BMS floor; the substation, the switchrooms and the generator yard have no spatial view. | — |
| G7 | Phone (390) | The SLDs pan inside the stage, but most labels are drawn under 9 px. | epms-sld-390, dcai-elec-390 |

## 1. Decision

**One electrical language on both cockpits:**
- The same state rules as the BMS hall.
- The one-line stays the authority.
- A 3D equipment view sits one click away.

1. **Colour is state** (fixes G3 and G5).
   - An energized, healthy conductor is drawn in the running ink, green, with the flow dash moving at a speed bound to
     load.
   - De-energized or standby: grey, dashed.
   - Warn and alarm use only `--rz-pt-warn` / `--rz-pt-alarm`.
   - Feed identity (A / B, utility / generator) moves to the label and the bus tag, never the hue.
   - The DC AI legend becomes the EPMS legend.
2. **Equipment, not bare symbols** (fixes G2).
   - Every breaker draws its IEC 60617 state: a filled square when closed, hollow when open, a red diamond when tripped.
   - Each breaker has a status lamp and a boxed value tag (kW · A), in the same tag style as the hall row tags.
   - Transformers carry a load-percent tag.
   - The generator pool carries a "running / standby" count tag.
3. **The sheet fills the stage** (fixes G1 and G3).
   - Fit to width on open.
   - Nothing sits under the sticky status bar: the stage stops above it.
   - The DC AI overview draws every hall feeder to its hall block (DH-02…08 like DH-01, collapsed to one bay each).
   - The orphan symbol is wired or removed.
4. **The summary reads** (fixes G4).
   - The energized-path summary has a minimum width and wraps; it never collapses.
   - The scenario select is enabled where the engine evaluates the scenario, and hidden where it does not.
5. **3D equipment view** (fixes G6).
   - A `3D | One-line` switch, the same control as the data hall.
   - 3D is an isometric layout of the real equipment: the HV GIS bays and power transformers in the yard, the MV
     switchboard line-up, the LV switchboards and UPS rooms per hall, and the generator yard.
   - It uses the same rules as the hall: grey body, green lamp, state colour only on warn or alarm, one height per
     equipment class, 30° axes.
   - A click on a unit opens the same HMI as its symbol on the one-line.
   - **Default:** One-line on every width; the stored choice wins. The one-line is how power is read (ISA-101 level 2).
     3D answers "where is it".
6. **Phone** (fixes G7). Rendered labels are at least 11 px in the panned stage, the switch is 40 px tall, and nothing
   scrolls the page sideways.

## 2. Ownership

- EPMS files (`EPMS_Telemetry.html`, `js/conv/epms-*.js`, `js/conv/sld-topology.js`) belong to the Conventional session.
  `epms-lv-view.js` is marked peer read-only.
- Before E1 I message the peer sessions: the owner's words, this PRD, and the files I take.
- The DC AI files are mine.

## 3. Laws (gate `tools/test-electrical-bms.mjs`; rendered, signed in, 1440 and 390, both themes)

| law | claim | red today |
|---|---|---|
| E1 | The drawing's bounding box spans ≥ 90 % of the stage width at Fit; 0 equipment labels intersect the sticky status bar | EPMS 2/3, TX row covered |
| E2 | Every energized conductor is in the running ink; no conductor hue encodes identity (DC AI blue / green / amber = 0) | DC AI feeds |
| E3 | Every breaker has a state glyph, a lamp and a value tag with a number; a planted trip turns its glyph, lamp and tag alarm | words only |
| E4 | DC AI overview: 8 hall feeders reach a hall block; 0 unconnected symbols | 7 stubs, 1 orphan |
| E5 | Energized summary ≥ 240 px wide and its text visible at 1440 × 900 | 25 px |
| E6 | The 3D view draws equipment counts equal to the engine's (GIS bays, transformers, MV panels, gensets) with grey bodies (≥ 95 % neutral), green lamps, one front height per class, 30° axes; a click opens the one-line's HMI; the toggle works by keyboard and is stored | no 3D |
| E7 | 390: labels ≥ 11 px rendered, page scrollWidth = 390, 0 page errors | < 9 px |
| E8 | Guard: conv release gates, DC AI gates (`test-dcai-*`, `test-dh-*`), a11y, dark coverage, no ratchet re-recorded | — |
| E9 | Eye: before / after at 1440 and 390, dark and light, one-line and 3D, with a planted trip; looked at and sent | — |

## 4. Phases

| phase | content | proof |
|---|---|---|
| E0 | gate laws E1–E7, red on live | quoted fails |
| E1 | defects: fit, status-bar overlap, summary width, orphan, DC AI hall feeders | E1, E4, E5 |
| E2 | one state language, breaker glyph, lamp and value tag on both cockpits | E2, E3 |
| E3 | the 3D equipment view + switch (shared iso kit with the floor renderer) | E6 |
| E4 | phone | E7, then E8 |

E1–E2 ship as one release and E3–E4 as the next.

---

# Amendment 2 — fit to screen, SLD design and animation gaps (R190, R191)

## A0. Context

Owner, 2026-11-22: "yang telemetri epms tidak bisa fit to screen baik HV OR MV, dan sempurnakan systemnya sld find gap pada design dan animasinya rancang prd utk improve dan polish".

### Root cause of the fit failure (measured)

- The HV/MV sheet is `size [1740, 1390]` (`js/conv/epms-sheet.js:310`).
- `rz-hmi-sheet.js:252` sets `--hmi-min-w = W × minScale`. That gives 1566 px for HV/MV (default 0.9) and 1170 px for LV (`minScale 1.17`, `epms-lv.js:206`).
- The stage is about 1180 × 620 px at 1440 × 900. So the svg is forced wider than the stage, and the **Fit** button (`fit()` :298 resets the viewBox only) can never shrink it.
- Height is never fitted. The sheet is 1390 tall in a 620 px stage, and the bottom (TX row, NGR) sits under the absolute `.status-bar` (50 px).
- Gate measurement: HV/MV covers 125 % of the stage width; TX-1 and TX-2 are under the status bar.

### SLD gaps found (shots `$S/el-before/epms-*`, live v3.92.0)

| # | gap | kind |
|---|---|---|
| S1 | Fit cannot show the whole sheet (above) | layout |
| S2 | The status bar covers the bottom row; the stage does not stop above it | layout |
| S3 | Breaker state is a 9 px grey word (CLOSED). No glyph or lamp. The CB-CP value floats under its bay ("CLOSED 0 kW · 0 A") | design |
| S4 | Relays (R-L1, R-T1, R-BB …) are empty green squares. No function number on the symbol and no trip / healthy lamp | design |
| S5 | Power factor and frequency show "—" forever on the status strip. That is correct (the engine publishes neither), but there is no basis note and the tile is wasted | design / truth |
| S6 | LV: two unlabeled grey verticals between Stream A and B (the tie bus run) cross the drawing | design |
| S7 | Flow dash: `hmi-march 1.6s` is a constant on the overlay (`css/rz-hmi.css:62`). Whether EPMS passes `dashSeconds(ratio)` per edge is to be verified in E0. If the speed is constant, a feeder at 5 % load moves like one at 95 % | animation |
| S8 | No switching animation. Open, close and trip repaint instantly. Nothing shows de-energization propagating downstream from the operated breaker | animation |
| S9 | Transformers: load % is text only. There is no loading bar, and no hot colour at more than 100 % of rating | design |
| S10 | Bus bars carry no live kV / kA tag. The bus colour does not separate dead and live when the incomer opens (EPMS grey vs green only) | design |
| S11 | The DC AI elec sheets use another grammar (R186 G3/G5). In wt-elec E2 is still red | consistency |

## A1. Decisions

1. **Fit = whole sheet, both axes.**
   - Fit scales to `min(stageW / W, (stageH − statusBar) / H)`. At this scale `--hmi-min-w` is lifted.
   - A second control, **Fit width**, gives the reading scale and keeps the legibility floor (G5).
   - The sheet opens on Fit width on a phone and on Fit on a desktop. The choice is stored per sheet.
   - At Fit, labels under 8.5 px hide by LOD (already lod-1/lod-2). Tags of equipment and live values stay.
   - Implementation is in the shared renderer `fit()` plus a CSS class `is-fit-all` that removes the min-width. Both the DC AI and the EPMS sheets gain it.
2. **The stage ends above the status bar.**
   - `.epms-sld-view` gets `padding-bottom` or `bottom: var(--status-bar-h)`.
   - Law: no tag intersects `.status-bar`.
3. **Equipment grammar (R186 decision 2, now explicit for EPMS):**
   - **Breaker:** IEC glyph (filled = closed, hollow = open, diamond = tripped), a lamp, and a boxed tag `kW · A` beside the symbol. The orphan bay label is attached.
   - **Relay:** the ANSI number inside the box (87T, 50/51, 87B), and a lamp: healthy grey, picked-up amber, trip red.
   - **Transformer:** a load bar under the tag (0–100 %). The bar turns warn at more than 90 % and alarm at more than 100 %.
   - **Bus:** a live tag `20.0 kV` when energized and `0 kV DEAD` when not.
4. **Truth tiles.** PF and frequency tiles show "not modelled" with the basis in a tooltip (Rule 2: no invented numbers). The owner earlier rejected random walks, so these stay unfilled.
5. **Animation (MOTION_STANDARD tokens, transform/opacity/dashoffset only, reduced-motion = static):**
   - **A1:** flow dash speed is bound to load ratio per edge through `RZConvVfx.dashSeconds(ratio)` (the peer API, read-only use). 0 kW means no dash.
   - **A2:** switching. The breaker glyph morphs in 120 ms. De-energization then sweeps downstream at about 300 ms per hop, ordered by topology distance from `sld-topology.js`. Re-energization sweeps the same way. Keyboard-triggered sim = instant (MOTION frequency rule).
   - **A3:** a trip flashes the relay lamp three times and latches. The tripped breaker diamond holds until reset.
   - **A4:** transformer: no hum or decorative motion. Only the load bar eases to its new value in 200 ms.
6. **The LV tie verticals are labelled** ("TIE BUS A–B, normally open"), drawn as standby dashed, and routed in the gutter.

## A2. Laws (added to `tools/test-electrical-bms.mjs`)

| law | claim | red today |
|---|---|---|
| E1b | After a click on Fit, the drawing bbox is ≤ 100 % of the stage width AND ≤ 100 % of the stage height above the status bar, for HV/MV and LV at 1440 × 900 and 1280 × 720, both cockpits | HV/MV 125 % wide, height not fitted |
| E1c | Fit width shows smallest label ≥ 8.5 px (G5 unchanged) | — |
| E10 | Every relay shows its ANSI number and a lamp; a planted trip makes the lamp alarm and latch | empty boxes |
| E11 | The dash duration of a running edge varies with its load ratio (two edges at different ratios differ by ≥ 20 %); a 0 kW edge has no running dash | to measure |
| E12 | A planted `sim-open` of CB-T1: downstream edges change to stopped in topological order (time of each hop increasing), all within 2 s; reduced motion makes it instant | instant repaint |
| E13 | Bus tag reads live kV when energized and DEAD when not | no tag |
| E14 | 0 unlabeled conductors (every conductor with no `data-ends` node has a label) | LV tie |

## A3. Ownership

- EPMS files are the peer's (8a) until their v3.93.0 push. After that, `epms-sheet.js` and `sld-topology.js` are mine (agreed). `EPMS_Telemetry.html` is edited only outside their deepOpts/ACT block. `vfx.js` and `epms-lv-view.js` are peer read-only. If the S8 sweep needs a hook in `vfx.js`, I ask 8a for it.
- Shared renderer `rz-hmi-sheet.js` / `rz-hmi.css`: mine. Both cockpits run `test-dh-*` and conv gates.

## A4. Phases (one release v3.94.0 with R186 E1–E2, then v3.95+)

| phase | content | laws |
|---|---|---|
| A-E1 (with R186 E1) | Fit both axes, stage above the status bar, DC AI fit (in progress: E4, E5 green in wt-elec) | E1, E1b, E1c, E4, E5 |
| A-E2 (with R186 E2) | breaker / relay / transformer / bus grammar, DC AI state grammar | E2, E3, E10, E13, E14 |
| A-E3 | animation A1–A3 | E11, E12 |
| then | R186 E3/E4 (3D view, phone) | E6, E7 |

## A5. R191 — every item clickable, trapped-key interlocks, real UPS quantities, LV down to the rack

Owner, 2026-11-22: "dan pastikan itu misal ada DS1-CP itu clickable semua saat di klik itu keluar modalnya, dan juga tidak ada indikasi castell key untuk trapped key, dan juga misal ada ups paralel misal per stream itu ada banyak itu juga qty disesuaikan dan LV itu gambarannya sampai PDU/PDC kemudian ke Rack , sempurnakan".

Decisions:

7. **Every drawn item opens its modal.** Disconnectors (DS1-CP, DS2-T1 …), earth switches, VT/SA, CTs, relays, buses, NGRs and off-sheets carry a `cls` and a payload. A single click opens the inspector; a double-click opens the equipment modal. An item with no modelled values says "not modelled" in its modal, never nothing. Junction dots are the only exception.
8. **Trapped-key interlocks (Castell type) drawn and enforced.**
   - Key symbol (IEC 60617 mechanical interlock, a key glyph with its key number K1, K2 …) beside each interlocked device: earth switch ↔ its line disconnector and breaker, bus coupler ↔ incomers (no paralleling of two transformers on the LV unless allowed), MV tie ↔ incomers, generator ↔ utility on the ATS, UPS maintenance bypass ↔ the UPS output breaker.
   - A dashed mechanical-link line joins the devices that share one key.
   - The key state (trapped in which device, free) is shown on the symbol and in the modal.
   - The simulation enforces it: operating a device whose key is trapped elsewhere is refused with the reason ("K3 trapped in ES-L1"). The interlock map is data (sheet definition), not code per device.
9. **UPS quantities from the engine.**
   - Each stream draws its parallel UPS modules as a stack of N units (N = `ups_modules_per_system` share per stream from the engine), with N+1/2N redundancy shown on a tag (for example "4 × 500 kW, N+1"), the parallel output bus, the static bypass and the maintenance bypass.
   - At a narrow scale a stack collapses to one symbol with "× N", same rule as TX "× 5".
   - Counts on the sheet equal the engine (gate).
10. **LV continues to the rack.**
    - LV main switchboard → UPS → UPS output switchboard → PDU/PDC (power distribution cabinet / unit with its transformer where modelled) → RPP/busway → rack A and B feeds (one row drawn, the rest as "× rows").
    - The PDU/PDC count and kVA come from the engine, the rack count per row and kW per rack from the hall model.
    - Every level is clickable (decision 7), and a breaker trip at any level sweeps downstream to the racks (A2), so the operator sees which racks lost their A or B feed.

Laws:

| law | claim | red today |
|---|---|---|
| E15 | Every `.hmi-node` except junctions has `data-rz-equipment`; a click on each of 10 sampled kinds (DS, ES, VT, SA, CT, relay, bus, NGR, UPS, PDU) opens a modal with a title equal to its tag | DS1-CP opens nothing |
| E16 | Every interlock in the sheet's key map draws a key glyph on each member and a link line; operating a device whose key is trapped elsewhere is refused with the key name, and the state is unchanged | no keys |
| E17 | Per stream, UPS module count and rating on the sheet equal the engine (`ups_modules_per_system`, `ups_module_kw_rated`); the redundancy tag matches | to measure |
| E18 | The LV path from the LV main board reaches a rack node through UPS, PDU/PDC and RPP/busway on both A and B; PDU and rack counts equal the engine; a planted trip of one PDU breaker marks exactly its racks' feed as lost | stops at board |

Peers: DC AI hall SLD (session 02) adopts decisions 7, 8 and 10 on DH-E-101 through the shared renderer. Conventional (8a) owns the EPMS payloads for the new classes until their v3.93.0 push.


## A6. R192 — voltage parameters shown

Owner, 2026-11-22: "dan parameter2 tegangan juga tampilkan".

Decision 11. **Every voltage level shows its voltage.**
- **Where it shows:**
  - every bus tag (HV 150 kV, MV 20 kV, LV 400 V, UPS output, PDU output, rack feed);
  - the breaker and transformer tags, as `V · kW · A`;
  - the modal readings: L-L and L-N, regulation %, and the limits.
- **Value: derived, never random.**
  - Nominal comes from the engine: `hv_voltage_kv`, `mv_voltage_kv` and the LV voltage in `js/conv-engine.js`; for DC AI, `hvIntakeKv` / `mvKv`.
  - The voltage under load = nominal × (1 − loading × impedance × (cos φ·R/Z + sin φ·X/Z)), the transformer regulation approximation (IEC 60076-1 Annex). Inputs are the engine impedance (`hv_tx_impedance_pct`, `dist_tx_impedance_pct`, `mainTxImpedancePct`) and the engine loading.
  - It is labelled `derived` with its basis.
  - A dead bus reads `0 V DEAD`.
  - Where cos φ or X/R is not in the engine, the value is `ASSUMED` with the source named. The status-bar power factor tile stays "not modelled" until the engine publishes a PF.
- **Limits:** ±5 % warn and ±10 % alarm of nominal (IEC 60038 supply tolerance, EN 50160 for LV). They come through the point registry (`RZPointStatus` / PRD-SETPOINT-SIM), so the trend draws the nominal as the SP line and the limit hairlines.
- **Simulation:** a planted overload or a lost parallel transformer lowers the derived voltage, and the warn or alarm follows the limits.

Law E19: every bus and every transformer secondary shows a voltage with a unit. The value equals the regulation formula on the engine inputs (± 0.1 %). A dead bus reads DEAD. A planted 2N→N loss moves the downstream voltage in the predicted direction, and its point state follows the ±5/±10 % limits. Red today: no voltage on any bus tag.
