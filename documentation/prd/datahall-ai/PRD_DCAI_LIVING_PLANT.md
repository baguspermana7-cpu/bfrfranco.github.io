# PRD-DCAI-LIVING-PLANT — the DC AI cockpit as a living plant (datahallAI.html)

Status: **DRAFT rev 2 for owner approval, 2026-11-17 (independent review folded in). Nothing here is executed until
the owner says go.**
On approval this file is committed as `documentation/prd/datahall-ai/PRD_DCAI_LIVING_PLANT.md`, the neighbouring
session is told (§12), and work starts at phase A0.

Counterpart of `documentation/product-transformation/02-prds/PRD-CONV-LIVING-PLANT/PRD.md` (the Conventional
session's draft, commit `9d1590a91`), which covers the 9 Conventional pages and leaves `datahallAI.html` and
`js/datahall-ai/*` out of scope. Same owner comments, same grammar, same shared modules, one owner per file (§12).

## 0. Context — the comments this answers

All from the owner on 2026-11-17, wording kept. C1–C6 were sent to this session; C7–C10 reached me through the
Conventional session's PRD and are about screens this session owns (Cooling & Piping, the BMS/SCADA modal, the
Electrical SLD) — **approving this plan confirms they apply here too.**

| id | comment | answered in |
|---|---|---|
| C1 | "tooltip dan modal masih kurang, modal ini juga ada sld/schematic dalamnya" | §5, §6 |
| C2 | "bagian datahall aneh, di bawah rack ada banyak angka itu nggak jelas apa; animasi air mengalir, udara meniup, angin panas dari HAC belum ada, banyak animasi2 yang belum ada" | §4, §7 |
| C3 | "kalau angka di klik bisa keluar modal trendline-nya dan bisa add data line juga untuk compare; rancang system trendline dan multitrend" + "kasih tahu sesi sebelah" | §8, §12 |
| C4 | "yang network ini kasih modal firewall dan lain-lain, modalnya yang block-block itu kasih" | §5.3 |
| C5 | "semua comment saya jangan langsung, rancang PRD-nya yang sangat comprehensive, plan mode, baru kalau ok baru eksekusi" | this document |
| C6 | EPMS: "analisa dan cari gap dan improvement plan; di sebelah equipment ada P, V, kW, Amp dll atau interlock protection; equipment di-click → TCC curve as modal, bisa di-compare dengan bawahnya" | §9 (DC AI SLD), §13 (EPMS gap list handed to the Conventional PRD) |
| C7 | "VFX, animasi dengan sangat accurate … comprehensive, detail, major, keren" | §3, §4 |
| C8 | "animasi saat running jangan abu-abu semua; contoh di cooling & piping abu-abu semua, kan bisa hijau, orange atau merah tergantung kondisi; alur dan animasinya tampak hidup" | §3 |
| C9 | "electrical SLD belum terlihat GIS 150 kV-nya dll, animasi dan proteksi banyak yang belum ada" | §9 |
| C10 | "klik suatu block, contoh SCADA, yang muncul modalnya schematic itu sendiri dimunculkan lagi di dalam modal — konyol" | §5.1 |

C10 is my own change: v3.65.0 made the WAN node, security zone, BMS application and field group — and v3.65.2 the
cylinder bank — open the sheet they sit on. It is withdrawn here.

## 1. Where the page is today (measured on v3.65.3, not estimated)

| fact | evidence |
|---|---|
| 45 equipment classes. 4 open only the inspector (fire point, aspirating detector, call point, EPO). 9 schematics have fewer than 8 symbols (rack-ns 3, bms-ldc 3, bms-server 4, bms-gateway 4, bms-controller 5, net-core 5, net-spine 6, net-leaf 6, bms-network 7). 5 repeat the sheet they were opened from (net-wan, net-zone, bms-app, bms-field, fire-cylinder-bank). | depth probe, 1440 px, every class clicked |
| No modal has a trend, tabs, or an alarm history. Trend exists only as a 30-tick (2-minute) sparkline in the inspector; 47 payload builders publish one. | probe: `trend 0`, `tabs 0` on all 45; `js/rz-inspector.js:450-483` |
| 5 classes show no tooltip on the Data Hall tab (cdu, crah, fws-piping, leak, rack-unit): that tab's handler is mouse-only, has no focus or touch path, and a rack shows its row's tip. Sheet tooltips are capped at 6 rows and `opts.explain` is never supplied. | `datahallAI.html:12084-12168`; `hmi-v2.js` rows `slice(0,6)`; `rz-hmi-sheet.js:326` |
| A number on a sheet cannot be clicked: it is `<text data-role="value" data-val="node:k">` outside its node, and `readNow` keeps only the text — the point id is dropped. | `rz-hmi-sheet.js:211,354`; `hmi-v2.js:283-296` |
| Cooling & Piping: 544 edges, 512 marked flowing. A running line already carries one fixed-speed dash march (1.6 s) and arrowheads; its speed, colour and state are bound to nothing, and every line is the medium's colour — so the sheet reads grey and uniform. (My first probe read "0 animated": it looked at the base line, not the flow overlay.) | `css/rz-hmi.css:60-64`, `rz-hmi-sheet.js:169-170,408-413` |
| There is no flow magnitude per pipe and no load flow per conductor: a pipe's flow is an on/off derived from its mover's state; the electrical scenario gives energised / not, and kW only per rack group. | `hmi-v2.js:318-336`; `electrical-topology.js:311,714-731,794` |
| Data Hall plan (`hSvg`, legacy): 54 dash animations (40 row manifolds, 2 TCS headers, 2 HTW, 10 hot-aisle plumes on a fixed 3 s) and 89 fan rotations. Not animated: HTW return, CHW, cold-air arrows (static lines), air from the contained aisle to the ceiling (no element). Nothing depends on equipment state except the fans. | `renderHall()` `datahallAI.html:3364-3586` |
| Under and beside the racks: 60 aisle temperatures drawn as rotated text with no name, no legend entry, no tooltip (`hp-sens`), 20 row tags, 10 CDU ranges. The temperatures are simulated (`RZ_SIM`), the humidity ids are computed and never drawn. | same; `:3571-3573`, `:3622-3700` |
| Network: 7 conduit firewalls `ep-c1…c7` have no class (no tooltip payload, no click). `net-oob` has no opener. The conduit facts exist only inside `ZONES[k].outb/inb/enf/never`. | `hmi-sheets.js:730`; `datahallAI.html:8397-8421` |
| Electrical: the 150 kV level is drawn on DH-E-001 (4 line bays, breakers, double bus, main transformers) but named "SITE SLD" with no GIS bay detail; the only protection on any sheet is one `50/51` relay symbol per incomer. No TCC, no interlock, no ANSI list. The engine does publish `distribution.*`: HV and MV voltage, transformer MVA and impedance, fault level per section, board rating. | `hmi-sheets.js:466-528`; `hmi-payloads.js:632-656` |

## 2. Product goal and the three laws

A trainee reads the plant from motion and colour before reading a number; every number opens its history; every
item opens **its own** drawing; every protective device shows its curve against the device below it.

Shared with the Conventional PRD, word for word in intent:
- **L-A Motion is a measurement.** Speed, direction, colour and density are functions of a named point. No point,
  no motion — and the item says why. (Today's rule "flow only with evidence", brief O3, stays.)
- **L-B Colour is a state, never the only signal.** Each state also has a pattern, glyph or word.
- **L-C Simulated stays labelled.** Engine values carry a basis mark, simulated values a `SIM` mark, nothing random.

This replaces the page's current ISA-101 "grey when normal" rule as the **default view**; the grey view stays one
click away as *Flat* (§3.2). That is a deliberate reversal of `HMI_DRAWING_STANDARD.md` §2, by the owner's C8.

## 3. State and colour grammar (C8) — one grammar for both cockpits

### 3.1 States (item and line)
**The table is the Conventional PRD's §4.1 — eight states, its hex values, its second signals — adopted as is** (it
adds MISMATCH: command and feedback disagree, and MAINTENANCE / ISOLATED, which this draft's first version lacked).
Published once as `--hmi-st-*` tokens in `css/rz-hmi.css`; both PRDs cite that one table; the existing
`--hmi-alm-1/2/3` and `--hmi-fill-run` are mapped onto it, not duplicated. Red is alarm / trip and nothing else;
running green is low-chroma. In State mode a pipe keeps a thin centre stripe in its medium's colour (their §4.2),
so "which loop is this" is never lost.

### 3.2 View modes (one control on every sheet bar)
**State** (default) · **Medium** (today's colours: FWS, TCS supply/return, CHW, air, feed A/B) · **Thermal** (a
line or aisle coloured by its temperature on one declared scale) · **Flat** (ISA-101 grey, alarms only).

## 4. Effect catalogue for DC AI (C2, C7) — each row is one effect with its binding and its law

| # | where | effect | bound to (L-A) | at zero / no data |
|---|---|---|---|---|
| E1 | every pipe (cooling sheets, CDU, hall) | chevrons along the path — **replaces** today's fixed dash march, it does not add a second motion | direction from the drawn flow direction; speed from the driving mover's flow or speed row ÷ its design value (clamped 0.2–1.5). A branch with no mover row runs at one fixed speed and its tooltip says "speed not measured" | no chevrons, dashed |
| E2 | pumps, fans, fan-wall modules, dry-cooler fans | rotor turns | rpm or VFD % | still |
| E3 | plate HX, cold plates, coils | hot side and cold side tinted by their two temperatures | the two payload rows | neutral |
| E4 | Data Hall plan: cold aisle | streamlines from each **duty** fan-wall module into the aisle | module state; speed ∝ face velocity (engine 2.5 m/s design) | none for a standby module |
| E5 | Data Hall plan: contained hot aisle | plume rising along the aisle to the plenum, tint by aisle temperature | row heat (engine `rowItKw` × air share) and the aisle sensor | none |
| E6 | Data Hall **section view** (new, small, beside the plan) | the loop the plan cannot show: fan wall → cold aisle → through the racks → hot aisle containment → ceiling plenum → back to the fan wall | same points as E4/E5 | static arrows |
| E7 | rack row manifolds | supply cool-to-warm gradient along the row | TCS supply/return of that row's CDU | flat |
| E8 | leak rope | a wet zone pulses its badge; the rope beside it turns red | the zone's own state row | grey rope |
| E9 | SLD | power-flow chevrons on energised conductors; density in three steps from the **design** kW of that level (HV / MV / LV / rack group); a dead section greys and stops. No live load flow is claimed until the load-flow family of A6b exists | scenario engine edge state; engine design kW | still, dashed |
| E10 | SLD sequences | utility loss, ATS transfer, generator start, trip: played in the scenario engine's order with its times | `electrical-topology.js` timeline | — |
| E11 | fire | detection → alarm → pre-discharge countdown → release front along the pipe → lockout | `fire-cause-effect.js` stages | idle |
| E12 | network | packets on a link, rate ∝ utilisation; a failed link breaks | payload utilisation rows | still |

Rules for all: an effect element exists only where the line or item is `data-flow="running"` (brief O3 stays the
gate); transform / opacity / stroke-dashoffset only; one clock (`RZHmiFx`), paused when the tab or the
sheet is hidden and off screen; level of detail by zoom; `prefers-reduced-motion` → direction marks stay, nothing
moves; count-up of numbers stays prohibited (ACCURACY_VALIDATION).

## 5. Every item opens its own drawing (C1, C4, C10)

### 5.1 The rule (fixes C10)
A modal never draws the sheet it was opened from. An item whose model only places it in an architecture gets an
**internal drawing** of the item itself; until that drawing exists the click opens the **inspector** (same fallback
as the Conventional PRD §6.1) — never a copy of the parent. Law M10 (§10).

### 5.2 Internal drawings to build (replacing the five repeats, deepening the nine thin ones)
| class | internal drawing | source of every item |
|---|---|---|
| net-wan carrier / scrubbing / border router / NGFW / core | the pair as two units with their own ports: handoff, uplinks, downlinks, pair link, each link's protocol and committed rate | `WAN_NODES` rows, `WAN_DEMAND` |
| net-zone | the zone's contents and its two conduits (in, out) with enforcement point, protocol, direction, "never" rule | `ZONES` |
| **conduit firewall C1–C7 (new class `net-conduit`)** | source zone → enforcement point → destination zone, allowed protocol, direction, what is refused | `ZONES[k].outb/inb/enf/never` |
| net-core / spine / leaf | every uplink and downlink as its own port group with count and speed, both supplies, management port | engine `network.*` |
| net-oob | management network: what it reaches, read-only paths | payload |
| bms-server / network / gateway / ldc / controller / app / field | the block's inside: redundancy pair, ports, protocols, the points it carries, who consumes it | `BMS_MODEL` |
| rack-ns | the NVSwitch tray: switch chips, backplane lanes, cold plates | engine `compute.*` |
| fire point, VESDA, call point, EPO | device on its loop position: neighbours, isolator, the zone and the outputs it drives — **inside the inspector**, above the isolation workflow (the click contract stays) | fire inventory + C&E rows |
| cylinder bank | bank internals: cylinders, pilot, manifold, pressure switch (not DH-F-102 again) | payload |
Nothing is drawn that the model does not state; a row with no source is not added (the v3.63 rule stands).

**The sources above do not yet hold most of these items** (review): `WAN_NODES` is prose rows with no ports;
`network.*` is counts and radix, no port speeds, supplies or management port; `compute.*` has no switch chips or
backplane lanes; `BMS_MODEL` has protocol and port per gateway but no redundancy pairs or consumers per block. So
each drawing batch **starts with an authored-model step**: the new rows (each with its source or the word
"authored") are written, shown to the owner as a table, and only then drawn. Without it these drawings would be
near-empty or invented.

### 5.3 Network sheet: every block clickable
All 92 nodes on the three network sheets either carry a class with a payload and a modal, or are off-sheet
references that navigate. Count of unclassed drawn nodes today: 21 (the conduits ×3 sub-views). Target 0.

### 5.4 One modal shell
`openSheetModal` (v3.65.1) becomes the only equipment modal: header (tag, name, state), tabs **Overview** (internal
drawing + key points) · **Points** (all rows, each clickable to trend) · **Trend** · **Alarms** · **Protection**
(electrical items) · **Basis**. The eleven legacy modals move onto it one family per release; their drawings are
kept until their replacement is accepted.

## 6. Tooltips (C1)
One tooltip for the whole page (the sheet tooltip), also on the Data Hall tab; opens on hover, focus and tap.
Content: tag and name · state with its reason · up to 8 points with unit and SIM/engine mark · the active alarm ·
"what this is" one line (`RZExplain` key — the explanation engine of the Conventional pages; **not loaded on this
page today**, so A2a adds `js/rz-explain.js` + its generated DB as a new dependency of the page) · the two actions
(click, Shift+click). Rack shows the rack, not its row. Every drawn number has a name: target 100 % of drawn
values and items answer a hover; today 5 classes and all 60 aisle temperatures do not.

## 7. Data Hall tab clarity (C2)
- Each aisle temperature becomes a named sensor chip `TT-CA-03-2 25.6 °C` (cold aisle 3, position 2) with tooltip
  (what, where, simulated, design band) and a click to its trend; humidity (already computed) joins it. Each chip
  carries its trace mark (ACCURACY_VALIDATION rule 6).
- A legend row for the numbers themselves: "row tag · rack count · row kW", "aisle supply / return temperature",
  "CDU range"; the row tag opens the row inspector.
- The colour scale gets its unit and the two design points (supply, return) marked.
- The plan keeps its direction (owner R129); the section view (E6) is added beside it.

## 8. Trend and multitrend (C3) — shared module, one contract
Module `js/rz-trend.js` + `css/rz-trend.css` is specified in the Conventional PRD §7 (8 pens, picker, shared axis
per unit, ranges 5 min–7 d, cursor, limits, stats, events, CSV/PNG, URL state, pinned multitrend tiles). This PRD
adds what the DC AI side must supply and one thing the contract needs:
- **Provider contract** (proposed to the Conventional session, §12): `RZTrend.register(pageId, { list(), series(pointId, fromTick, toTick, step), meta(pointId) })`.
  `pointId = class:id:hall/point` (e.g. `cdu:07:1/tcs_supply_c` — the hall is part of the simulation key,
  `hmi-payloads.js:133`; the Conventional PRD defines no grammar yet, so this is the proposal for both). `meta` returns label, unit, band, engine anchor, class
  `SIM` or `ENGINE`.
- **DC AI provider** `js/datahall-ai/trend-provider.js`. History is **not** `sim-telemetry.point()` sampled per
  minute: its period is 60 s, so a one-minute sample lands on the same phase and the week would be a flat line
  with noise. History = a declared daily load shape + the logged scenario events, the same model as the
  Conventional `history.js` (one shared generator, two anchors); `point()` supplies only the live tail; a loaded
  replay file overrides both. 7 days at 1 minute.
- **Point identity on a sheet:** `readNow` keeps the payload row's `point` for each value; the value text gets
  `data-rz-point`. A click on a number opens a two-item menu **Trend · Basis** (a hooked number keeps its basis
  record — today's click); `T` opens the trend directly. Same on modal and inspector rows.
- Laws T1–T7 of the Conventional PRD apply; added here: T8 the trend's last value equals the number that was
  clicked (same tick); T9 with a replay file loaded the pen reads the file and is marked REPLAY.

## 9. Electrical: 150 kV GIS, readouts, protection, TCC (C6, C9) — DC AI side
- **DH-E-000 "150 kV GIS"** (new sheet, first in the Electrical tab): every bay drawn as a bay — line bays,
  transformer bays, bus coupler; disconnectors, earthing switches, CT/VT, breaker — on the double busbar the engine
  already sizes (`distribution.hv_circuits_installed/duty`, `main_tx_total`, `main_tx_mva`). DH-E-001 keeps the
  site overview and links into it.
- **Readout chip beside every device** on the SLD sheets. What the engine can give today (`js/dcai-engine.js:592-615`
  `distribution.*`): the three level voltages; design currents (HV, transformer primary / secondary, MV board and
  feeder, group, rack feed, busway); transformer kVA; group and UPS-frame kW; loading % of main transformer, unit
  substation, UPS and busway; breaker state from the scenario. These are shown and **marked DESIGN**. What it
  cannot give: per-device live A / kW / kVA under a scenario (there is no load flow), a measured power factor
  (one design constant exists — shown once as the basis, not per device), frequency. Those wait for the load-flow
  family of A6b and are not drawn before it. Each chip carries its trace mark. G1 counts the bays from
  `hv_line_bays`, `hv_transformer_bays`, `hv_switchyard_bays`.
- **Protection**: absent from the engine today (no relay setting, no breaker rating beyond the MV board and
  feeder, no HV or LV fault level, no unit-transformer impedance). Per device the ANSI functions it carries and
  their settings arrive as **new engine parameters with
  sources** (`protection.*`, declared training settings, not a relay study). Interlocks (tie normally open, ATS,
  generator bus incomers, earthing switch) as a truth table the scenario engine obeys and the sheet shows.
- **TCC modal**: the shared curve module of the Conventional PRD §8.2 (IEC 60255-151 curves, LSIG, fuse bands,
  transformer damage and inrush, cable withstand, coordination margin). A click on a device opens its curve with
  the device **below** it added automatically, fault levels from `distribution.mv_fault_ka_per_section` as
  markers, more devices addable. It must be one shared file (`js/rz-tcc.js`), not `js/conv/tcc.js` — §12.
- Order inside the phase: engine parameters first, then the sheet, then the curves; drawing first would publish
  invented ratings.

## 10. Laws and gates (each red on today's tree or on a planted defect before it is trusted)
| law | claim | red on |
|---|---|---|
| M10 | no modal contains the sheet the click came from — compared by the **set of drawn node ids**, not the sheet id (a renamed copy must still fail; the Conventional Q8 rule) | v3.65.3: 5 classes |
| M11 | every class has an internal drawing with ≥ 1 item that is not on its parent sheet, reached from the modal — or from the inspector for the four isolable fire points; a class without one is **listed by name** in the gate output and the list may only shrink (ratchet) | today's list: 9 classes |
| N1 | 0 drawn network nodes without a class or a navigation target | 21 |
| P1 | every drawn value and item answers hover, focus and tap with ≥ name, unit, source mark | 5 classes, 60 temperatures |
| V1 (binding) | per effect: change the point through the simulation seam → direction, speed ratio and colour change; an effect element exists only on `data-flow="running"`; a stopped pump that still spins fails | planted defect |
| V2 (state) | each §3.1 state has its colour **and** its second signal; a greyscale screenshot still separates them | today: one colour |
| V3 (perf) | motion stops off screen and in a hidden tab; reduced motion = 0 entries in `document.getAnimations()` **and** no attribute change on any effect element across 2 s, direction marks kept; frame budget measured with `--perf-strict` on a **static sheet with its effects running** (20 ms at 1440, 34 ms at 390 ×4 CPU), beside a blank-page control. Today's O8 and O11 cannot see the new effects (O8 counts one CSS class, O11 hides the flow layer while the view moves and does not block): they are extended, not relied on | a sheet animating while hidden; an effect driven by a script clock under reduced motion |
| T1–T9 | trend (§8) | no trend module |
| K1–K4 | TCC (Conventional PRD §8.2) + K5 the device below is on the plot when the modal opens | no TCC |
| G1 | DH-E-000 shows every bay the engine counts, each device tagged | sheet absent |
| existing | H1–H16, M1–M9, L1–L9, U1–U8, coverage (untraced 0), O1–O11, ship gate | — |
Every visual change: screenshots at 1440 and 390, dark and light, State and Flat, looked at and sent.

## 11. Phases (one phase live before the next; versions take the next free number at ship time)
| phase | content | executor |
|---|---|---|
| **A0** | C10 fix: the five repeats stop drawing their parent and open the inspector until their own drawing lands; law M10. Conduit class `net-conduit` with its payload from `ZONES` (C4, law N1) | Opus |
| **A0.5** | One agreed table with the Conventional session before any shared file is touched: the eight states and tokens, view modes, click model, point-id grammar, module names and paths (§12). Output: a short shared standard both PRDs cite. No code | both sessions |
| **A1** | State tokens + view modes in `rz-hmi.css` / renderer; the effect clock; E1 + E2 + E3 on **Cooling & Piping** as the reference page; laws V1–V3 | Opus |
| **A2a** | Modal shell with tabs; one tooltip everywhere incl. the Data Hall tab (law P1); `RZExplain` loaded | Opus |
| **A2b** | Network: authored-model step (rows for WAN pairs, zones, conduits, switches, OOB shown to the owner), then their internal drawings | Opus spec, Ark drafts, Opus review |
| **A3** | Data Hall: named sensors, number legend, E4–E8, section view E6 | Opus |
| **A4** | Trend: shared history generator, DC AI provider, point identity, click menu, modal Trend tab. Needs `rz-trend.js`; if the Conventional P2 is not live when A3 ships, this session builds the module to the agreed contract and they adopt it | Opus provider, Ark wiring |
| **A5** | Authored-model step, then internal drawings batch 2: BMS blocks, rack-ns, fire devices in the inspector, cylinder bank | Ark drafts, Opus review |
| **A6a** | Engine: `protection.*` parameters with sources; the engine chain (version, registry, catalog, gates) | Opus |
| **A6b** | Engine: a load-flow family (per-device A / kW / kVA under each scenario), Node-tested | Opus |
| **A6c** | DH-E-000 150 kV GIS sheet; readout chips (DESIGN first, live after A6b) | Opus |
| **A6d** | E9 + E10: energisation, power flow, transfer and trip sequences | Opus |
| **A7a** | TCC modal on the DC AI SLD (shared curve module) | Opus |
| **A7b** | Fire and network effects E11, E12 | Opus / Ark |
| **A7c** | The eleven legacy modals onto the shell, one family per release | Ark, Opus review |
Fifteen releases, not eight. Each phase: laws → red → build → green → screenshots → standards in the same release →
ship gate → push → live check from the real site with real clicks → the owner sees pictures, not instructions.

## 12. Working with the neighbouring session (owner: "kasih tahu sesi sebelah")
On approval one message goes to the Conventional session with this file's path and these proposals:
| shared thing | proposal |
|---|---|
| `js/rz-trend.js`, `css/rz-trend.css` | they build (their P2); the provider contract of §8 is agreed first; I supply the DC AI provider |
| curve module | their draft names `js/conv/tcc.js`; proposal: one shared file `js/rz-tcc.js` (pure, Node-tested); whoever reaches protection first builds it, the other adopts |
| state grammar tokens in `css/rz-hmi.css`, renderer hooks in `js/rz-hmi-sheet.js` | additive only; one of us edits per release, the other's gates run before the push (their inspector gate, my `test-dh-drawings`) |
| effect clock | theirs is `js/conv/vfx.js` (`RZConvVfx`); proposal: one page-neutral core `js/rz-hmi-fx.js`, their effect families and mine as plug-ins |
| state table | theirs (§4.1, eight states) is the single table; published as `--hmi-st-*` in `css/rz-hmi.css`, not as hex literals in `css/conv-vfx.css` |
| history | one shared deterministic generator (daily shape + scenario events); their ring buffer and my on-demand series are the same function |
| C10 fallback | the inspector, on both cockpits |
| click model | theirs: click = inspector, double-click = modal. DC AI today: click = modal, Shift+click = inspector. **One model for both cockpits** — default proposed: theirs (owner decision OD-B) |

## 13. EPMS gap list (C6) — measured by this session, for the Conventional PRD §8
EPMS is theirs to build; these are the gaps I measured that their §8 should carry:
84 devices and 98 breakers, an explicit edge list (`WIRES`) — a good base. No device has a click or hover (only
breakers toggle). Values appear only on wires and only when zoomed ("zoom in for values"); voltage is a typed
literal; current is computed with a hidden power factor 0.9; power factor and frequency tiles show "—"; loading %
is published by the engine and not drawn. Ratings exist only as typed text (`DYN5, 3150KVA`, `2.5 MW`). No breaker
rating, impedance, fault level, relay setting, interlock table or curve anywhere. Shift+click sets a breaker to
"trip" while the page states "protective trips are not modelled". `rz-bms-shell.js` is loaded and never called.

## 13b. Standards this PRD changes — each needs the owner's yes, and is written into the standard in its phase
| standard | today | change asked |
|---|---|---|
| `HMI_DRAWING_STANDARD.md` §2 | line work grey when normal | State view is the default; grey becomes the Flat view (C8) |
| same, law H5 | ≤ 8 words per sheet outside tags and values | state words (STBY, TRIP), readout chips and sensor chips count as values, not prose |
| `MOTION_STANDARD.md` | transform / opacity only; reduced motion "gentler, not absent"; no infinite decorative motion | a cockpit exception: **bound process motion** (dash offset allowed, runs while its point says so), and under reduced motion nothing moves but direction marks stay. The Conventional PRD plans the same exception |
| `CLAUDE.md` rejected patterns 12 and 15 (second accent hue, decorative motion) | one accent in chrome; no decorative motion | unchanged for chrome; process-state colour on a cockpit sheet is not chrome, and motion is bound and gated (V1) |
| `ACCURACY_VALIDATION.md` rule 6 | basis mark on every critical value | extended to every chip and sensor chip this PRD adds |

## 14. Owner decisions (defaults stand if not changed at approval)
| id | decision | default |
|---|---|---|
| OD-A | Default view | **State** colours; Flat (grey) one click away |
| OD-B | Click model, both cockpits | click = inspector, double-click or "Open" = modal, click on a number = Trend / Basis |
| OD-C | Data Hall | keep the plan, add the section view |
| OD-D | Protection depth | function list + declared training settings as engine parameters; not a site relay study, and the page says so |
| OD-E | History | 7 days at 1 minute, simulated, labelled; replay file overrides |
| OD-F | Order | A0 → A7 as §11 (C10 and the firewall modals first: smallest, most visible) |
| OD-G | The pending list in `PRD_PENDING_2026_11_17.md` (tier from the server, page weight, commissioning scenarios) | paused behind A0–A3; P1 (Pro tier) resumes after A3 |

## 15. Risks and limits
- Colour load: a fully coloured plant can hide an alarm — running green is low-chroma, red is alarm only, Flat stays.
- Performance: every running SVG animation repaints its sheet; the frame budget is measured with a blank-page
  control and reported honestly; a phone check precedes A3.
- Protection values are training values, coordinated by the gate, labelled as such.
- Two sessions edit shared files: §12, one editor per release.
- This reverses two things I shipped this week (grey-normal default, modal showing its parent sheet).
- Fifteen releases; each ships alone and leaves the page coherent. At about one release per half day of gate time
  this is two to three weeks of work, not days.

## 16. Verification
Per phase: its laws quoted red then green; `tools/test-dh-drawings.mjs`, `test-dh-operator.mjs`,
`test-dcai-coverage.mjs --strict --modals`, the sharded ship gate; live check by loading resistancezero.com,
clicking each new item and sending the screenshots (as done for v3.65.3).
