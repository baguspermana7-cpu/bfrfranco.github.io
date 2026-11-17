# PRD-CONV-LIVING-PLANT — the Conventional cockpits as a living plant

Status: **DRAFT for owner approval (2026-11-17). Nothing in this PRD is executed until the owner says go.**
Scope: the 9 DC Conventional pages (`dc-conventional`, `datahall`, `chiller-plant`, `water-system`, `fire-system`,
`fuel-system`, `ict`, `EPMS_Telemetry`, `cdu-mini-bms`). `datahallAI.html` and `js/datahall-ai/*` are out of scope.
Supersedes the order of work in `standarization/Audit result/CONV_EXECUTION_PLAN_2026-11-16.md` (its engine and
page-fix packages stay valid and are referenced here as W-E and W-F).

---

## 0. The owner's comments this PRD answers

Collected on 2026-11-17 from the owner's messages (the LTC session and this one). Wording kept.

| id | comment | answered in |
|---|---|---|
| C1 | "tooltip dan modal masih kurang, modal ini juga ada sld/schmatic dalamnya" | §6, §10 |
| C2 | "yang bagian datahall aneh di bawah rack ada banyak angka itu nggak jelas apa, animasi air mengalir, atau udara meniup dan angin panas dari HAC itu belum ada, banyak animasi2 yang belum ada" | §5.6, §9 |
| C3 | "kalau angka di klik itu bisa keluar modal trendlinenya dan bisa add data line juga utk compare, rancang system trendline dan multitrend" | §7 |
| C4 | "yang network ini kasih modal firewall dan lain2 modalnya yang block2 itu kasih" | §8.3 |
| C5 | "semua comment saya jangan langsung, rancang prdnya yang sangat comprehensive. plan mode, baru kalau ok selesai prd baru eksekusi" | this document; §14 |
| C6 | "yang epms ini sebenernya sudah ok, analisa dan cari gap dan improvement plannya, misal di sebelah equipment itu ada P, V, kW, Amp dll atau interlock protection, dan kalau equipment di click itu ada TCC curve muncul as modal dan bisa di compare dengan bawahnya" | §8.1, §8.2 |
| C7 | "rancang dengan sangat comprehensive vfx, animasi2 dengan sangat accurate … PRD yang sangat comprehensive dan detail dan major dan keren" | §3–§5 |
| C8 | "animasi saat running jangan abu2 semuanya, contoh di cooling & piping itu abu2 semua, kan bisa hijau atau orange atau merah tergantung kondisi, alur dan animasi2nya tampak hidup" | §4 |
| C9 | "electrical sld belum terlihat GIS 150KV nya dll, juga animasi dan proteksi banyak yang belum ada" | §8.1 |
| C10 | "bug: saat klik suatu block, contoh SCADA, yang muncul modalnya schematic itu sendiri dimunculkan lagi tapi di dalam modal — konyol" | §6.1 |

---

## 1. Where the pages are today (measured, not estimated)

| fact | evidence |
|---|---|
| Running pipes are drawn in the medium's line colour with one marching dash; state is not a colour. A stopped line is the same grey, dashed. | `css/rz-hmi.css:50-62,253-255` |
| Motion per page is almost nil: `@keyframes` count — dc-conventional 1, datahall 4, chiller 3, water 0, fire 4, fuel 2, ict 2, EPMS 2. No rotating impeller, fan, plume, air stream or power-flow particle exists. | `grep -c '@keyframes' <page>.html` |
| EPMS starts at 20 kV. The strings `150 kV` and `GIS` do not occur; no ANSI device number other than "50" occurs; no TCC; no interlock. | `grep -o` on `EPMS_Telemetry.html`: RMU 19, 20kV 6, "50" 14 |
| The engine publishes no HV/MV parameter: every `electrical.*` registry id is UPS or metering. | `data/conv-parameters.json` (16 `electrical.*` ids) |
| No shared trend module exists. Trends are per-page sparklines. A click on a number opens the basis drawer or nothing. | `ls js \| grep -i trend` → none |
| Under each rack the page prints `<span class="rk-id">` + `<span class="rk-val">` with no unit, legend or tooltip. | `datahall.html:1920` |
| Depth baseline before this week: chiller opened 4 of 29 symbols; fire/fuel inspectors had ≤ 2 rows on 38 of 40; EPMS 0 of 29; cdu-mini 0 of 13; label tooltips 2–10 % on seven pages. | `CONV_TOTAL_AUDIT_2026-11-16.md` §7 |
| Work already built, **not released** (local branch `conv-w6`, commit `ce8fa84d7`): one payload builder (51 classes), one equipment modal, inspector tabs filled. Measured on that branch: chiller 29/29, fire 24/24, fuel 16/16, water 16/17 symbols open; inspectors average 5.8–6.0 of 6 tabs. | `tools/test-conv-depth.mjs`, `tools/test-conv-payloads.mjs` 8/8, `tools/test-conv-equipment-modal.mjs` |

That unreleased work is phase P0 of this PRD (§13). It contains no animation, no trend system, no SLD and no TCC.

---

## 2. Product goal

An operator (or a trainee) looks at any Conventional cockpit and reads the plant **from its motion and colour
before reading a number**: what runs, which way it flows, how hard, how hot, what is in warning, what tripped
and why. Every number opens its history. Every item opens its own drawing. Every protective device shows its
curve against the devices above and below it.

Three laws stand above every feature:

- **L-A. Motion is a measurement.** Every animated property is a function of a named point: speed from flow or
  rpm, direction from the sign of flow, colour from the state machine, density from power. No decorative
  motion. An item with no valid point does not move and says why.
- **L-B. Colour is a state, never the only signal.** Each state also has a pattern, a glyph or a word, so the
  drawing reads in greyscale and for colour-blind operators.
- **L-C. Simulated stays labelled.** The plant is a deterministic training simulation on top of the engine.
  Engine values carry a basis mark; simulated values carry a visible `SIM` mark; nothing is random.

---

## 3. VFX principles (what "accurate" means here)

1. **One clock.** `RZConvVfx.tick` drives every sheet; all motion is `f(tick, point)`. Same tick → same frame
   (the screenshot gates depend on it). No `Math.random`, no wall-clock jitter.
2. **Physical scaling, declared.** Each effect has a scaling law with units and a clamp, written in the code
   and in the manual (table §5). Example: dash speed in px/s = `k · v`, `v = Q / A` in m/s, clamped to
   0.2–3.0 m/s on screen so a slow line still visibly moves and a fast one does not strobe.
3. **State first, then magnitude.** The state machine (§4) chooses colour and pattern; the magnitude chooses
   speed or density. A stopped pump never spins slowly "for life".
4. **Transitions are events.** Start, stop, trip, transfer and valve stroke are timed sequences with the real
   order of events (permissive → command → feedback → flow), each step visible for a readable time.
5. **Budget.** Transform and opacity only; one compositor layer per sheet, not per symbol; motion pauses when
   the sheet is off screen (`IntersectionObserver`) and when the tab is hidden; the level of detail drops under
   zoom-out (particles → dashes → static state colour).
6. **Reduced motion.** `prefers-reduced-motion` keeps colour, pattern, direction arrows and numbers, and
   replaces continuous motion with a static flow chevron every 40 px. No information is lost.
7. **Two shades.** Every effect is designed for dark and light themes and for the "flat" ISA shade the sheets
   already offer (§4.3).

---

## 4. Colour and state grammar (C8)

### 4.1 Equipment and line states

| state | meaning | colour (dark / light) | second signal |
|---|---|---|---|
| RUNNING | commanded on, feedback proven, process value in band | green `#3FB950` / `#1A7F37` | moving flow; solid body |
| STANDBY / READY | available, auto, not running | cyan-grey `#7FA6B8` / `#3F6475` | no motion; "STBY" |
| STOPPED | commanded off | neutral grey | no motion; dashed line |
| WARNING | running or ready, a value outside its warning band | amber `#E8B563` / `#7A4800` | amber pulse at 0.5 Hz on the affected item; "W" triangle |
| ALARM / TRIP | protection operated or a critical limit crossed | red `#F85149` / `#B42318` | red, solid until acknowledged, then hollow triangle + "ACK" |
| MISMATCH | command and feedback disagree | amber/grey hatch | hatch pattern; "CMD≠FB" |
| MAINTENANCE / ISOLATED | locked out | blue-grey + padlock glyph | padlock; lines to it drawn open |
| UNAVAILABLE / BAD | no valid data | grey hatch 45° | "NO DATA" / "BAD"; never animated |

The alarm colours follow the site register (amber/red already in use by `sheet-truth.js` marks); the numbers
above are proposals to be checked for WCAG AA on both sheet backgrounds in P1.

### 4.2 What a pipe shows

A running line carries three things at once:

- **Medium** — a thin centre stripe in the medium colour (CHW supply, CHW return, CDW, fire water, diesel,
  nitrogen, domestic) plus the line label. This is the identity and does not change with state.
- **State** — the pipe body colour from §4.1 (green running, amber warning, red alarm, grey stopped).
- **Flow** — moving chevrons whose direction is the flow direction and whose speed is the scaled velocity.

So "cooling & piping abu-abu semua" becomes: green bodies where water moves, an amber section where ΔT or
pressure is out of band, a red section behind a tripped pump, grey only where nothing flows.

### 4.3 View modes (one toolbar control per sheet)

| mode | pipe body colour means | use |
|---|---|---|
| **State** (default) | §4.1 state | operations |
| **Thermal** | temperature on a blue→red ramp between the engine CHWS and CHWR / CDW planes, with a legend in °C | understand the heat path |
| **Medium** | medium colour only (today's look, with motion) | P&ID reading |
| **Flat (ISA-101)** | grey; colour only on abnormal | strict high-performance HMI practice |

Owner decision OD-1 (§14): default mode. Recommended: **State**.

Note on ISA-101: the standard's high-performance guidance prefers grey for normal and colour only for
abnormal. The owner asked for a living, coloured plant; this PRD makes that the default and keeps the grey
practice one click away, so both readings are honest and available.

---

## 5. Effect catalogue (each row is one implementable effect with its accuracy law)

`P` = bound point(s). `Law` = what a gate measures.

### 5.1 Hydronic (chiller, water, fuel, fire water)

| effect | drawn as | bound to | law |
|---|---|---|---|
| Pipe flow | chevrons along the edge path | `P` flow (L/s) and pipe DN → `v = Q/A` | direction flips when the sign flips; speed ratio between two lines = ratio of their `v` (± 10 %); 0 flow = 0 motion |
| Pump | impeller rotating in the volute; discharge pressure arc | speed %, run feedback | angular speed ∝ speed %; stopped = static; MISMATCH = hatch, no rotation |
| Valve | disc / stem position; throttled flow narrows | position % | drawn angle = position ± 2 %; closed valve → downstream line STOPPED |
| Check valve | flap opens with forward flow, slams shut on reverse | flow sign | closed whenever flow ≤ 0 |
| Tank | liquid level, slow meniscus, inflow/outflow arrows | level %, in/out flow | liquid height = level ± 1 % of tank height; arrows only when flow ≠ 0 |
| Chiller | evaporator and condenser barrels with a thermal gradient end to end; compressor stage lamps; refrigerant path in the modal | CHWS/CHWR, CDWS/CDWR, stages, load % | gradient end colours = the two temperatures on the Thermal ramp; lamps = stages |
| Cooling tower | fan rotating; falling-film lines; plume whose opacity/height scales with evaporation; basin level | fan speed, `water.evaporation_lpm`, basin % | fan stopped → no plume; plume scale ∝ evaporation |
| Heat exchanger | two counter-flowing streams with gradients | both sides' in/out temperatures | hot side cools along its direction, cold side warms |
| Filter | differential-pressure bar filling; backwash sequence reverses flow through it | ΔP, backwash state | bar = ΔP / limit |
| Decoupler | bypass flow direction arrow (supply→return or reverse) | primary − secondary flow | direction = sign of the difference; reverse flow = WARNING |
| Expansion tank | diaphragm position | system pressure, pre-charge | position from the two pressures |

### 5.2 Air side (data hall, CRAH) — C2

| effect | drawn as | bound to | law |
|---|---|---|---|
| CRAH fan | rotating fan wheel | fan speed % | ∝ speed |
| Cold-aisle supply | blue streamlines from CRAH / floor grilles to rack inlets | airflow m³/s, supply air °C | streamline speed ∝ airflow; colour = supply temperature on the Thermal ramp |
| Rack heat | each rack tinted by its inlet→outlet ΔT; heat shimmer at the rear | rack kW, inlet °C | tint ∝ rack kW / design kW |
| Hot-aisle containment | orange/red streamlines rising from rack rears into the HAC and back to the CRAH return | return air °C, airflow | direction rear→ceiling→CRAH; colour = return temperature |
| Chilled-water coil | blue CHW in, warmer CHW out through the coil | valve %, CHW ΔT | same as §5.1 pipe flow |
| Containment door / leak | recirculation streamline from hot to cold aisle when a blanking fault is simulated | scenario flag | appears only in that scenario |

### 5.3 Fire

| effect | drawn as | bound to | law |
|---|---|---|---|
| Detection | detector pulse ring; VESDA obscuration bar | detector state, obscuration | pulse only in alarm |
| Sequence | stage strip: Alert → Pre-alarm → Release timer (countdown ring) → Valve trip → Flow | the page's stage machine | visible order = stage order; countdown = configured delay |
| Water front | water filling the dry pre-action pipe from the valve outward at the scaled velocity | stage ≥ flow | front position monotonic; reaches the heads after valve trip, never before |
| Sprinkler | spray cone on the operated head only | head state | no cone on closed heads |
| Fire pump | impeller + pressure rise; jockey short cycles | pump feedback, pressure | as §5.1 |
| Nitrogen | supervisory pressure gauge needle; decay on a head opening | N₂ pressure | needle = pressure |

### 5.4 Fuel and generation

| effect | drawn as | bound to | law |
|---|---|---|---|
| Transfer | diesel flow bulk tank → filter train → day tanks | transfer flow | as pipe flow |
| Day tank | level; fill valve open/close cycle between the low and high setpoints | level, valve | fill starts at low, stops at high |
| Genset | crank → run-up (rpm needle) → voltage build → breaker close → load ramp; alternator rotating; exhaust heat shimmer | start sequence state, rpm, kW | sequence order fixed; rotation only when running |
| Leak | sump liquid + sensor flash | leak sensor | only in the leak scenario |

### 5.5 Electrical (SLD) — C9

| effect | drawn as | bound to | law |
|---|---|---|---|
| Energised conductor | bus/cable body colour by state (energised green, de-energised grey, earthed blue-grey with earth glyph, faulted red) and a voltage-level stripe (150 kV, 20 kV, 0.4 kV) | bus voltage, breaker topology | a conductor downstream of an open device with no other source is de-energised (topology solver, §8.1) |
| Power flow | particles moving source→load; density ∝ kW, direction from the sign of P | P per feeder | density ratio = kW ratio (± 10 %); reverse power reverses the particles |
| Breaker / DS / ES | contact opens/closes with travel time; spring-charged flag; racked-out position | device state | drawn state = point state; an interlocked command is refused with the reason shown |
| Transformer | core hum glyph, tap position, winding temperature tint, cooling fans (ONAN/ONAF) starting at their stage | load %, winding °C, tap | fans only above the stage temperature |
| Fault | red flash at the fault point; fault current arrow from every source; relays pick up (lamp), time (ring), trip (flag); breaker opens; 86 lockout | scenario: fault location + level | relay operating time on screen = the TCC time at that current (± 5 %) — the animation and the curve agree |
| ATS / STS transfer | break-before-make sequence with the dead time visible; STS in ¼ cycle | source availability | order: source lost → timer → open → close |
| UPS | double conversion path lit; on-battery path lit with battery state-of-charge draining; static bypass path | UPS mode, SoC, load | exactly one path lit per mode |
| Genset sync | synchroscope needle; breaker closes only inside the 25 window | Δf, ΔV, Δφ | close refused outside the window |

### 5.6 Network (ICT)

| effect | drawn as | bound to | law |
|---|---|---|---|
| Link traffic | packets along the link, both directions; density ∝ utilisation % | link utilisation | density ratio = utilisation ratio |
| Link state | up green, degraded amber (errors/CRC), down red dashed, blocked (STP) grey with "BLK" | port state | as §4.1 |
| Firewall | allowed flow passes; denied flow stops at the firewall with a small deny mark and the counter increments | policy verdict | a deny never crosses |
| Failover | active → standby switchover of HA pairs / MLAG | HA state | one active per pair |

### 5.7 Ideas taken from OriginKit (owner reference, 2026-11-17)

Source: https://www.originkit.dev — 810 animated components (sitemap crawl of titles and descriptions, 2026-11-17):
299 backgrounds, 134 interactive elements, 103 animations, 91 text, 50 galleries, 43 image, 30 buttons, 30 loaders,
24 cursors. About 475 are WebGL/shader, 172 use three.js; they ship as React / Framer components.

How they can be used here:

- **Not as drop-ins.** This site is zero-build vanilla JS; the components are React/Framer and mostly three.js. Each
  idea below is re-written as a small SVG / canvas effect in `js/conv/vfx-effects/`, with no new dependency.
- **Licence** (their Licensing page, read 2026-11-17): use, modification and use inside an open-source application
  are allowed, no attribution required; redistributing the components as a library, template or kit is not. A
  re-implementation inside this site's own pages is within it. The catalogue itself is not copied into the repo.
- **Only where the motion is a measurement** (law L-A). The same visual idea is rejected as decoration.

| OriginKit idea | what it does there | use here (bound to) | phase |
|---|---|---|---|
| `chevron-duct` | chevron rings receding down a tunnel | airflow chevrons in the CRAH supply duct and the hot-aisle return; speed ∝ airflow m³/s, colour = air temperature | P3 |
| `flow-field` | noise-warped streamlines | data-hall section view: particles advected along a declared velocity field (cold aisle → rack → hot aisle → CRAH); density ∝ airflow | P3 |
| `risinglines` | line sparks and soft blobs rising | cooling-tower plume and hot-aisle heat rise; rate ∝ evaporation L/min / rack kW; absent when the fan or rack is off | P3 |
| `contour-loop`, `wireframe-terrain-noise` | travelling contour lines | data-hall plan: temperature contour lines interpolated from rack inlet temperatures (a Thermal-mode overlay), with the legend in °C | P3 |
| `pulse-grid` | circuit segments lighting up | SLD: a conductor segment lights when energised, pulse rate ∝ kW on that branch (from `sld-topology.js`); ICT: link pulses ∝ utilisation | P5, P6 |
| `plexus-chain-drift` | drifting linked chains | ICT topology traffic between nodes; packets ∝ utilisation, stop at a firewall deny | P6 |
| `scan-effect` | a light band sweeping through depth | aspirating detector: the sweep along the sampling pipe = one transport-time cycle; fire-zone scan in the stage strip | P3 |
| `dither-globe`, `globe-mesh` | interactive globes | index / market pages only if the dots are the real sites of the DC corpus; otherwise not built | later, separate PRD |
| `mask-text-reveal` | clip-path text reveal | index hero heading, once on first view (clip-path only, 240 ms, none under reduced motion) | separate index PRD |
| `link-preview` | page thumbnail on hover | index cards: the page's own OG card as a static preview on hover/focus (no cursor lean) | separate index PRD |

Rejected, with the rule that rejects them:

| idea | rule |
|---|---|
| cursor trails, magnetic buttons, tilt, cursor-reactive grids (`kineticgrid`, `interactive-grid`, 24 cursors) | CLAUDE.md rejected pattern 4 (cursor-tracking) |
| glow borders and neon buttons (`neon-border`, `orbit-border-button`, `scan-grid-button`, `slide-fill-button`) | UX law 14 and the register: hover is a border-colour change, no glow, no transform |
| shader / particle backgrounds as decoration (`flow-field` as a hero, `predictive-arc`, `wave-arcs`, `blinkingsquares`) | rejected patterns 1, 11, 15 (dot grids, aurora/mesh, decorative fixed canvases) |
| `typewriter`, `text-reveal-wall`, `flickertext`, scramble text | rejected pattern 14 (ticker) and MOTION_STANDARD: text that must be read does not animate |
| three.js for a cockpit effect | performance budget: one compositor layer per sheet; a headless repaint already costs ~30 ms |

---

## 6. Equipment modal with its own drawing (C1)

The modal built in P0 shows identity, readings, trend, design basis, guidance, alarm points and maintenance.
This PRD adds the **internal drawing** of the item as the modal's main panel, animated by the same rules.

| class | internal drawing |
|---|---|
| Chiller | refrigerant circuit: compressor → condenser → expansion valve → evaporator, with the P-h state points and water sides |
| Pump skid | suction valve, strainer, pump, check valve, discharge valve, VFD, pressure taps |
| Cooling tower | fill, fan, basin, make-up, blowdown, drift eliminator |
| CRAH | filter, coil, control valve, EC fans, condensate, supply/return air |
| Fire pump set | controller, pump, driver, relief, test header, jockey |
| Pre-action valve | clapper, priming chamber, solenoid, supervisory air, alarm line |
| Genset | engine, alternator, AVR, governor, day tank, breaker, protection block |
| UPS | internal single-line: rectifier, DC bus, battery + BMS, inverter, static bypass, maintenance bypass |
| MV / GIS bay | bay single-line: busbar DS, CB, line DS, ES, CT, VT, cable sealing end, relay block |
| Transformer | windings + vector group, tap changer, Buchholz, PRD, WTI/OTI, NGR |
| LV board | incomer, bus section, outgoing feeders with trip units |
| Firewall / switch | zone and port diagram (§8.3) |
| Rack | PDU A/B feeds, breaker, per-phase current, inlet/outlet temperatures |

### 6.1 A modal never repeats the drawing it was opened from (C10)

Reported defect: a click on a block (the owner's example: SCADA) opens a modal that shows the same schematic
again, inside the modal. **Not reproduced yet** — the string "SCADA" occurs on `dc-conventional.html`,
`datahall.html`, `chiller-plant.html` and `fuel-system.html`; the first step of P0 is to reproduce it on each,
record which click path does it, and fix the cause before anything else ships.

Rule for every page from now on:

- A block opens **its own** content: the internal drawing of that item (table above), or — for a block that
  is a system, like SCADA/BMS — its architecture one level down (servers, controllers, networks, the points it
  reads). Never the parent sheet.
- A block with nothing below it opens the inspector only; it shows no "Open equipment HMI" action.
- Gate (`test-conv-equipment-modal.mjs`, new law Q8): the set of node ids drawn inside a modal is not equal
  to, and not a superset of, the set drawn on the sheet behind it; for every clickable block on every page.

Rules: one modal shell for all classes (`js/conv/equipment-modal.js`); drawings come from one library
(`js/conv/schematics/*.js`) rendered by `RZHmiSheet`, so every part inside the modal is itself clickable,
tooltipped and traced. Focus trap, `Esc`, focus return and inert background are already gated.

---

## 7. Trend and multitrend system (C3)

New shared module `js/rz-trend.js` (`window.RZTrend`) + `css/rz-trend.css`.

**Entry points.** A click on any number that is a point (engine-hooked or simulated) opens a small menu:
*Trend* / *Basis*. Double-click or `T` opens the trend directly. Inspector and modal rows get the same action.

**Trend modal.**

| feature | specification |
|---|---|
| Pens | up to 8 series; *Add series* opens a searchable picker over all points of the page (tag, name, unit, equipment); recently used first |
| Compare | (a) another point; (b) the same point on a sibling item (CH-01 vs CH-02…); (c) the same point one period earlier (overlay, dashed) |
| Axes | series sharing a unit share an axis; up to 2 Y axes shown, further units normalised 0–100 % with their real range in the legend |
| Time | ranges 5 min / 1 h / 8 h / 24 h / 7 d; pan and zoom (wheel + drag, pinch on touch); live follow toggle |
| Cursor | crosshair with every pen's value and timestamp; second cursor for Δvalue and Δt |
| Limits | alarm and warning limits of the first pen drawn as lines; engine plane as a dashed reference line |
| Stats | min, max, mean, last, time above limit — per pen, for the visible window |
| Events | alarm and state-change markers on the time axis; a click jumps to the event |
| Output | CSV of the visible window (with the SIM/engine class of each series), PNG |
| State | pens + range in the URL hash, so a multitrend can be shared and restored |

**Multitrend workspace.** *Pin* keeps a trend as a tile; a page-level "Trends" drawer holds up to 6 tiles
(2×3 at 1440, stacked on a phone) with a shared time axis and a linked cursor. Layout stored per page in
`localStorage` (a convenience only; nothing else depends on it).

**Data.** `js/conv/history.js`: a ring buffer per point, 7 days at 1-minute resolution, generated
deterministically from the point's seeded model (daily load shape + the scenario events), continuing live from
the same clock. Every series is labelled SIMULATED in the legend and in the CSV; an engine-anchored series
shows the engine plane. No historian is claimed.

**Laws.** T1 a click on a number opens its trend with that point as pen 1. T2 adding a second series draws two
pens and the legend lists both with units. T3 the cursor readout equals the buffer value at that timestamp.
T4 same clock → identical buffer (determinism). T5 CSV row count = visible points × pens, and every header
carries the unit and SIM/ENGINE. T6 keyboard: open, add, remove, range, close without a pointer. T7 390 px: no
horizontal overflow; pinch zoom works.

---

## 8. Electrical, protection and network depth

### 8.1 SLD redraw from 150 kV (C9, C6)

A new governed sheet `js/conv/epms-sheet.js`, drawn by `RZHmiSheet` with IEC 60617 symbols, replacing the
hand-placed SLD. Levels, top to bottom:

1. **150 kV GIS substation** — two PLN incoming lines, double busbar or single sectionalised bus (OD-3), line
   bays, bus coupler, two transformer bays. Per bay: busbar disconnector(s), circuit breaker, line
   disconnector, earthing switches, CT, VT, surge arrester, cable sealing end. Gas compartments shown with SF₆
   density status.
2. **Power transformers 150/20 kV** — 2 units, each able to carry the facility (N+1). Rating to be derived in
   the engine from `electrical.epms_total_kw` (43,500 kW) with power factor and growth margin; a 2 × 60 MVA
   class is the expected result and must be confirmed by the engine work, not assumed here. OLTC, NGR on the
   20 kV neutral.
3. **20 kV main switchgear** — two bus sections + bus tie, incomers, feeders to the hall rings, genset bus
   incomer.
4. **20 kV rings / RMUs → 20/0.4 kV transformers → LV switchboards** (counts from engine package W-E E-1).
5. **Generation** — genset blocks on a 20 kV (or LV, per W-E) synchronising bus, with step-up where needed.
6. **Critical power** — LVSB → UPS systems A/B (2N) → PDUs → RPPs → racks; mechanical load on its own boards,
   not on UPS.

The engine gains an `electrical.hv.*` / `electrical.mv.*` parameter family (voltages, ratings, impedances,
fault levels, CT ratios, relay settings), each with a source. Without those, protection curves would be
invented — so **engine first, drawing second** (phase P4).

**Readouts beside every device (C6).** A compact chip: `V`, `I`, `P (kW)`, `Q (kvar)`, `PF`, `f`; transformers
add load %, tap, winding °C; UPS adds mode, SoC, autonomy; gensets add rpm, kW, fuel rate. Chips collapse to
`kW · A` under zoom-out. Every value is a point: tooltip, basis or SIM mark, click → trend.

**Topology solver.** `js/conv/sld-topology.js`: from device states it computes which conductors are energised
and from which source, and the power flow per branch (radial load flow from the engine loads; parallel
sources share by rating). This is what colours the SLD and drives the particles. Law: kW in = kW out + losses
at every bus (± 0.5 %).

**Protection (ANSI/IEC device numbers shown at each relay).**

| zone | functions |
|---|---|
| 150 kV line | 21 distance, 87L line differential, 67/67N directional, 79 auto-reclose (blocked for cable), 50BF |
| 150 kV busbar | 87B busbar differential, 50BF breaker failure |
| Power transformer | 87T differential, 50/51 + 50N/51N both sides, 51G (NGR), 49 thermal, 63 Buchholz, 63 PRD, 26 oil temperature, 24 over-excitation |
| 20 kV feeders / ring | 50/51, 50N/51N, 67/67N on the closed ring, 27/59, 81 |
| Generator | 87G, 51V, 32 reverse power, 40 loss of excitation, 46 negative sequence, 59N, 81, 25 sync-check |
| LV | LSIG electronic trip units (long, short, instantaneous, ground), 87/ZSI where used |
| Lockout | 86 for 87T / 87B / 87G / 50BF — reset by the operator only |

**Interlocks (shown as a logic strip in the inspector and enforced by the simulation).** Disconnector operates
only with its breaker open; earthing switch closes only with both disconnectors open and the line dead; bus
coupler rules for bus transfer; 2-out-of-3 rule on incomer-incomer-tie; transformer parallel only with matched
taps; generator breaker closes only inside the 25 window; mains–genset interlock per the transfer scheme. A
refused command states the unmet condition.

### 8.2 TCC modal with upstream/downstream comparison (C6)

New module `js/conv/tcc.js` (pure, Node-testable) + a modal view.

- **Plot.** Log-log time–current, current on a common base voltage (20 kV or 0.4 kV, selectable), 0.01–1,000 s.
- **Curves.**
  - Relays: IEC 60255-151 inverse-time `t = TMS · k / ((I/Is)^α − 1)` — standard inverse (k 0.14, α 0.02),
    very inverse (13.5, 1), extremely inverse (80, 2), long-time inverse (120, 1) — plus definite-time and
    instantaneous stages.
  - LV breakers: LSIG bands with tolerance (long-time pickup/delay, short-time pickup/delay with I²t on/off,
    instantaneous, ground).
  - Fuses: minimum-melt and total-clearing band.
- **Equipment limits on the same axes.** Transformer through-fault damage curve (IEEE C57.109), transformer
  inrush point (default 12 × FLA at 0.1 s, declared), cable short-circuit withstand (adiabatic `I²t = k²S²`),
  motor starting curve where a motor is the load, generator decrement curve.
- **Compare.** Opening a device adds its upstream and downstream devices automatically ("bandingkan dengan
  bawahnya"); any other device can be added or removed. Fault levels (max/min at the device's bus) are
  vertical markers.
- **Coordination check.** At the downstream maximum fault current the module computes the time margin between
  each pair and marks it: ≥ 0.3 s OK (default for numerical relays; the grading margin is a setting, OD-5),
  less = miscoordination, highlighted on the plot and listed in text.
- **Link to the animation.** In a fault scenario the relay's on-screen operating time is read from this
  module, so the SLD sequence and the curve cannot disagree (law in §5.5).
- **Laws.** K1 the four IEC curves return the published check values (e.g. standard inverse, TMS 1, I/Is = 10
  → 2.97 s; very inverse → 1.50 s; extremely inverse → 0.81 s). K2 a device's curve lies below its upstream
  curve at every current up to the downstream fault level, or the check reports it. K3 every setting on the
  plot is an engine parameter with a source. K4 the plot is readable at 390 px (pinch zoom, legend below).

### 8.3 Network blocks get their own modals (C4)

Every block on the ICT page opens the inspector and a deep modal:

| block | modal content |
|---|---|
| Firewall (perimeter, IDMZ, OT) | zone diagram (IT / IDMZ / OT, Purdue levels per IEC 62443 zones and conduits); policy summary table (source zone, destination zone, service, action, hit count); sessions, throughput, CPU, HA role + sync state; top denied flows; interface table |
| Core / distribution switch | port matrix (up/down/blocked/error), VLANs, uplinks + MLAG/stack state, spanning-tree role, optical levels, PSU/fan state |
| Access / ToR switch | racks served, port utilisation, PoE where relevant, uplink redundancy |
| OT gateway / BMS server | protocols (BACnet/IP, Modbus TCP, SNMP), device counts, poll rate, last-poll age, failed polls, redundancy |
| Router / WAN | circuits, BGP session state, latency/loss |
| Time, DNS, AAA | service state and dependants |

The existing fault-domain logic (`showNodeDetail`) becomes the DEPS tab. Sizing numbers come from engine
package W-E E-5 (ports ≥ racks × ports per rack under a declared oversubscription).

---

## 9. Data hall clarity (C2)

- **Numbers under the racks.** Each rack cell shows one chosen metric with its unit, and a legend states the
  metric: `kW` (default), inlet °C, ΔT, or % of design. A selector switches the metric for the whole hall. The
  rack id moves to the tooltip and the inspector at small sizes. No bare number remains.
- **Plan and section.** The plan view gains the air path of §5.2; a new **section view** (a cut through one
  cold aisle / rack / hot aisle / CRAH) shows supply air, rack heating, hot-aisle containment return and the
  chilled-water coil — the clearest place to see "angin panas dari HAC".
- **Rack inspector.** PDU A/B, per-phase current, breaker, inlet/outlet temperature, design vs actual kW;
  trend on every value.
- **Excursions** start only from a labelled scenario control (W-F F-2), never from a random draw.

---

## 10. Tooltips (C1)

- Corpus `tools/explain-conv.json` → `js/rz-explain-db.js` (generated): every label, tag class, unit,
  abbreviation, ANSI number, state word and colour of the legend. Entry = definition, formula or setpoint,
  standard, why it matters to the operator.
- Every SVG symbol has `<title>` and a rich tooltip: tag, name, state, the 2–3 key values, "click: details ·
  double-click: HMI · T: trend".
- Target ≥ 95 % of labels and 100 % of symbols, per page, gated by `test-conv-depth.mjs`.
- Engineering in a tooltip is reviewed before merge; a wrong standard is worse than none.

---

## 11. Architecture

| module | role | new / existing |
|---|---|---|
| `js/conv/payloads.js` | one inspector/modal payload builder, class table | built (P0, unreleased) |
| `js/conv/equipment-modal.js` | one modal shell | built (P0, unreleased) |
| `js/conv/vfx.js` (`RZConvVfx`) | the clock, the state→style mapping, the effect registry, LOD, pause/visibility, reduced motion | new |
| `js/conv/vfx-effects/*.js` | one file per effect family (flow, rotor, level, thermal, air, power, sequence, packets) | new |
| `css/conv-vfx.css` | state colours, patterns, view modes; tokens only | new |
| `js/rz-hmi-sheet.js` | additive: per-edge path sampling for chevrons, view-mode attribute, effect hooks | existing, shared with datahallAI → additive only + LTC's inspector gate |
| `js/rz-trend.js`, `css/rz-trend.css` | trend + multitrend | new, shared |
| `js/conv/history.js` | deterministic point history | new |
| `js/conv/epms-sheet.js` | the governed SLD from 150 kV | new |
| `js/conv/sld-topology.js` | energisation + power flow | new, Node-testable |
| `js/conv/protection.js`, `js/conv/tcc.js` | relay models, curves, coordination, interlocks | new, Node-testable |
| `js/conv/schematics/*.js` | internal drawings for the modal | new |
| `js/conv/ict-sheet.js` | governed network drawing | new |
| `js/conv-engine.js` | new `electrical.hv/mv/protection.*` and network sizing families; version bump + pin + registry | existing |

No new dependency. Zero-build. Shared files change additively; `datahallAI.html` and `js/datahall-ai/*` are
not edited.

---

## 12. Gates (each is red on today's tree, or on a planted defect, before it is trusted)

| gate | proves |
|---|---|
| `test-conv-vfx-binding.mjs` | for every effect: change the point through the simulation seam → the computed style changes accordingly (direction, speed ratio, colour, zero at zero). Planted defect: a pump that spins while stopped must fail. |
| `test-conv-vfx-state.mjs` | each §4.1 state renders its colour **and** its second signal; greyscale screenshot still distinguishes the states (pattern/glyph check) |
| `test-conv-vfx-perf.mjs` | motion stops off screen and in a hidden tab; reduced motion has no running animation and keeps direction marks; alarm-to-mark latency. Frame budgets are reported with a blank-page control and marked NOT VERIFIED on target hardware (headless repaints the whole SVG, ~30 ms) |
| `test-rz-trend.mjs` | T1–T7 (§7) |
| `test-conv-tcc.mjs` (Node) | K1–K3 (§8.2), interlock truth tables, 86 behaviour |
| `test-conv-sld-topology.mjs` (Node) | energisation for every switching state of the main scheme; power balance at each bus |
| `test-conv-sld-render.mjs` | the 150 kV level is on the sheet with every device tagged; readout chips present; a fault scenario plays in the order pickup → time → trip → lockout with the TCC time |
| `test-conv-equipment-modal.mjs` (exists) | extended: the internal drawing is present and its parts open |
| `test-conv-depth.mjs` (exists, ratchet) | open rate, inspector depth, bare numbers 0, tooltips ≥ 95 %, per page |
| existing conv gates + `ship-gate.sh` | no regression; text-clear and geometry gates on every new sheet |

Every visual change also gets screenshots at 390 and 1440, dark and light, in State and Flat modes, that are
actually looked at.

---

## 13. Phases and releases

| phase | content | executor | release |
|---|---|---|---|
| **P0** | reproduce and fix C10 (modal repeating its own sheet) on every page; the depth layer already built: payload builder, equipment modal, inspector tabs on chiller, fire, fuel, water; depth gate ratchet; chiller secondary-supply physics fix | Opus (done locally, needs ship gate) | v3.66.0 |
| **P1** | VFX core: clock, state grammar, view modes, flow chevrons, rotors, levels, thermal mode — on the **chiller plant** as the reference page | Opus | v3.67.0 |
| **P2** | Trend + multitrend + history, wired on all pages that have points | Opus core, Ark wiring per page | v3.68.0 |
| **P3** | VFX rolled out: water, fuel, fire (sequence + water front), cooling tower, data hall air (plan + section), rack metric legend | Ark per page, Opus review | v3.69.0 |
| **P4** | Electrical engine family (HV/MV/protection parameters) + W-E E-1 fleet corrections; topology solver; `tcc.js` + `protection.js` with Node gates | Opus | v3.70.0 (MINOR, engine) |
| **P5** | SLD from 150 kV GIS: sheet, readout chips, energisation + power-flow VFX, fault and transfer sequences, TCC modal, interlock strip | Opus | v3.71.0 |
| **P6** | Network: governed ICT sheet, block modals, traffic VFX; internal drawings for every modal class; tooltip corpus to ≥ 95 % | Ark, Opus review | v3.72.0 |
| **P7** | Remaining pages (EPMS legacy views, cdu-mini-bms, dc-conventional tiles), W-F page fixes, W-E E-2…E-5 engine corrections, manuals and standards docs | Ark / Opus | v3.73.x |

Each phase: laws → red → build → green → screenshots → standards docs in the same release → ship gate → push →
verify live. One phase live before the next starts. At most two executors and two browser lanes at once.

Documents updated per phase: `standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md` (state grammar, effect
table, inspection contract), `standarization/MOTION_STANDARD.md` (the cockpit exception: bound process
motion), `manual/*.html` of each page, this PRD's status table.

---

## 14. Owner decisions (defaults stand if not overridden)

| id | decision | default |
|---|---|---|
| OD-1 | Default view mode | **State** (green/amber/red), with Thermal, Medium and Flat one click away |
| OD-2 | Click model | single click = inspector; double-click or "Open equipment HMI" = modal; click on a number = Trend / Basis menu |
| OD-3 | 150 kV GIS scheme | double busbar with bus coupler, 2 line bays + 2 transformer bays |
| OD-4 | Protection depth | the function list of §8.1 with settings as engine parameters (declared training settings, not a relay study) |
| OD-5 | Grading margin shown as OK | ≥ 0.3 s |
| OD-6 | History depth | 7 days at 1 min, simulated, labelled |
| OD-7 | Order | P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 (chiller first as the visible proof, electrical after its engine work) |
| OD-8 | Release P0 now | yes — it is built and gated except for the full ship gate; it changes no engine number |

---

## 15. Risks and limits

- **Headless performance cannot prove a frame budget.** Any running SVG animation costs a full-sheet repaint
  (~30 ms measured in headless). Mitigation: transform/opacity only, LOD, off-screen pause; the budget is
  reported honestly and checked on a real phone before P3 ships.
- **Protection settings are training values.** They are consistent and coordinated by the gate, but they are
  not a site relay study and the pages say so.
- **The 150 kV level is a design the engine does not have yet.** P4 must add it with sources before P5 draws
  it; drawing first would publish invented ratings.
- **Shared modules** (`rz-hmi-sheet.js`, `rz-inspector.js`) are used by datahallAI. Changes stay additive and
  LTC's inspector runtime gate runs before every hand-back.
- **Colour load.** A fully coloured plant can hide an alarm. The grammar reserves red for alarm/trip only and
  amber for warning only; running green is a calmer, lower-chroma tone; the Flat mode remains available.
- **Scope.** This is 8 releases. Each is shippable alone; stopping after any phase leaves the pages coherent.

## 16. Status

| phase | status |
|---|---|
| P0 | BUILT, not released (`conv-w6` @ `ce8fa84d7`); awaiting OD-8 |
| P1–P7 | NOT STARTED — awaiting owner approval of this PRD |
