# PRD — datahallAI.html: standard drawings, traceable equipment, operator shell (R128–R132)

Status: APPROVED scope (owner 2026-11-14: "yang terbaik, combine, walau ultra effort"), mock next · 2026-11-14 · owner requests R128, R129, R130, R131, R132
Page: `datahallAI.html` (AI Data Hall Operations, 1.37 MB, 10 tabs). Execution after verdict; mock first (§15).

## 0. What the owner asked (verbatim, Indonesian)

- R128: "ganti total gambar P&ID process pada datahallAI itu cooling & piping super jelek dan juga electrical SLD, fire and
  safety, network juga … ingat symbol, icon dan p&id tools dan skills library standard … tidak ai design slop … tidak
  gradien tapi bener2 gambar dan alur yang proper, hilangkan kata2 yang tidak jelas agar lebih focus pada flow schematic
  dan jika ada sidebar itu ada tombol autohide dan bisa stay show."
- R129: "room layout, rack architecture itu sangat2 kurang detail … terlalu banyak tulisan … datahall itu sudah ke arah
  yang saya mau, tapi … modal dari setiap equipment itu belum keluar p&id atau schematic alur yang sangat immersive."
- R130: "tiru style BMS2 UIUX … gradiennya sangat ai design slop, gpp jika itu harus solid … symbol standard bener2
  comprehensive, semua block/equipment item itu ada traceable dan ada modal literally semuanya. tooltip juga harus ada.
  tidak semua tulisan itu sama … cek di rz secondbrain semua engine2 itu."
- R131: "button PRD Manual itu keluar dari area navbar, navbarnya … tidak align dg theme RZ … tulisan 'SIMULATED · ENGINE
  BASIS' … terlalu banyak tulisan tidak perlu, keterangan bisa di tooltip."
- R132: "BMS2 = software BMS di website, misal EcoStruxure, ABB, dsb, yang UI/UX-nya bagus — cari top UI/UX BMS buat reference."

## 1. What is wrong today (measured 2026-11-14, local tree = v3.58.0 candidate, 1440 × 1000 dark)

Screenshots: taken with a local premium test session (`rz_premium_session` seam of `tools/test-datahall-ai-authority.mjs`); reproduce with Phase 0 gate.

| Drawing | SVG | Drawn at | Size on screen | Text nodes | Words in SVG | Gradient/filter | Main defect |
|---|---|---|---|---|---|---|---|
| Cooling & Piping P&ID | `#coolSvg` 960×980 | **2.8×** | 3460 × 3532 px (scroll to pan) | 509 | 1,056 | 2 grad + 1 filter | Equipment drawn as big rounded **cards with tables inside** (Dry cooler array, CDW/HTW pumps, chiller); pipes are stubs between cards; no line numbers, no valves on the main loop, no instrument loops; title text 30 px high |
| Electrical SLD overview | `#elecOvSvg` 1200×2190 | 2.3× | 2896 × 5285 px | 545 | **1,639** | 1 grad | Banner sentences ("150 kV INTAKE → 16× 100 MVA …") 24 px orange; diagram reads as text blocks; most of the sheet is off-screen |
| Electrical SLD DH-01 | `#elecDH1Svg` 1200×2740 | 2.6× | 3244 × **7407** px | 353 | 1,592 | 1 grad | Same; 7.4 m of scroll for one hall |
| Network fabric | `#netSvg` | 1.0× | 1300 × 650 | 159 | 398 | 1 grad + 1 filter | Three rows of identical boxes with "63 %" — a bar chart, not a topology; no links drawn between tiers (1 path element) |
| WAN / internet | `#wanSvg` | 1.0× | 1240 × 375 | 28 | 146 | 0 | Boxes in a line, no redundancy paths |
| Security network | `#secSvg` | 1.0× | 1240 × 723 | 57 | 225 | 0 | Coloured cards stacked vertically (red/amber/blue/cyan frames); not a zone-and-conduit drawing |
| Fire mimic | `#fireSvg` 960×580 | 1.8× | 2250 × 1359 | 209 | 395 | 1 grad | VESDA as 4 cards with 4 fake "ports"; no pipe network, no FACP loop, no agent manifold drawn |
| Fire zones | (HTML) | — | — | — | — | — | 12 text cards; not a floor map |
| Room Layout | `#floorSvg` | — | **0 × 0 px** (not rendered on open) | 0 | 0 | — | Tab shows no drawing in the test run |
| Rack Architecture | `#rackSvg` 960×690 | 1.3× | 1240 × 891 | 91 | 530 | 0 | Rows of text strips ("CT-01 · 4× B300 + 2× Grace" × 18); rail group and network rack are boxes with captions; no rear view, no manifold/busbar/cable cartridge drawing |
| Data Hall | `#hSvg` 1200×804 | 1.04× | 1252 × 840 | 126 | 388 | 2 grad | **Right direction** (owner R129). 588 tagged items, layers. Remaining: header KPI cards, sentences, 2 gradients |

Equipment modals (tier 2, double-click from Data Hall; `scratchpad/r128/el/t2-*.png`):

- `cdu` → CDU-01 HMI: best of the set (plate HX, pumps 2+1, strainer, valves, sensors) but drawn with gradient fills, glow
  frame, 6 KPI tiles on top, and small 7–8 px labels.
- `crah` → CRAH-01 HMI: decent; KPI tiles + boxes with gradient bar.
- `rack-manifold` → "DLC Manifold": two coloured header boxes + 9 tiles, strike-through text over lines; no rack.
- `leak`, `cable-tray`, `fws-piping` → open the **corridor HMI**, not their own item.
- `rack-psu`, `rack-ct`, `rack-ns`, `rack-busbar`, `rack-leak`, `rack-backplane` → one generic rack modal (64–130 SVG nodes).
- 55 equipment classes are tagged on the page (`data-rz-equipment`); about 12 have a dedicated HMI
  (`cduHmi`, `crahHmi`, `chHmi`, `ctHmiModal`, `irCduHmi`, `batHmi`, `corrHmi`, `rackModal`, `sldMimic`, `netModal`, `bmsModal`, `eqHmi`).
  **More than 40 classes have no schematic of their own.**

Shell (R131), seen at 1440 and 390:

- Header is two rows of 10 buttons in three styles (pill, ghost, amber); "PRD" and "Manual" sit as tall boxes outside
  the nav row; at 390 they push the title off screen ("SIMULATED · ENGINE BA…" cut).
- Text that should be a tooltip: "SIMULATED · ENGINE BASIS", "DATA MODE: SIMULATED", the legal notice line, "Primary read: …",
  "DRAWN AT 2.8× SO EVERY LABEL CLEARS THE 8.5 PX FLOOR — SCROLL TO PAN", every "Comprehensive P&ID: …" caption,
  "Buildability — Floor and air budget" block repeated on every tab.
- Sidebar has a collapse button (`#sideTog`) and reopen button (`#sideReopen`) but no **pin / auto-hide** mode; at 390 it sits
  at the bottom of the page as a 30 % sheet.

## 2. Reference set — "BMS2" (R132) and the standards

The owner's reference is commercial BMS / EPMS / DCIM software with a good UI. What each one contributes:

| Reference | What we copy | Source |
|---|---|---|
| **ANSI/ISA-101.01-2015 High-Performance HMI** | Grey, low-saturation process graphics; colour reserved for abnormal state and alarm; a four-level display hierarchy (L1 overview, L2 area/system, L3 equipment detail, L4 diagnostics); analog values with their normal band; no 3D, no gradients | [ISA blog](https://blog.isa.org/the-high-performance-hmi), [Control.com "Going Gray"](https://control.com/technical-articles/going-gray/), [Control Global, Nimmo](https://www.controlglobal.com/articles/2012/nimmo-best-practices-high-performance-hmi-design/) |
| **ANSI/ISA-18.2 / IEC 62682 alarm management** | Alarm colours never reused for anything else; priority shown by shape + colour + text (accessible) | [Tatsoft ISA-101 how-to](https://docs.tatsoft.com/display/FX/ISA-101+HMI+Compliance+How-to) |
| **Honeywell Experion (ASM Consortium L1/L2 work)** | L1 overview of the whole scope on one screen; L2 control displays per system; L3 detail from right-click / double-click | [Honeywell ASM white paper 2013](https://process.honeywell.com/content/dam/process/en/documents/document-lists/doc_asm-consortium/white-papers/June%2019%202013%20-Success%20and%20Challenges%20for%20Designing%20Effective%20L1%20and%20L2%20Displays.pdf) |
| **Siemens Desigo CC** | One symbol library, every symbol bound to an object type; editing a library symbol updates every graphic; graphics navigated from a logical/system tree | [Desigo CC: Symbol basics](https://mybuilding.siemens.com/D025938170736/Help/EngineeringHelp/en-US/14383775627.html), [Graphic components and types](https://mybuilding.siemens.com/D025938170736/Help/EngineeringHelp/en-US/14154745227.html), [Navigation concept](https://mybuilding.siemens.com/d025938170736/help/engineeringhelp/en-US/14115614219.html) |
| **Schneider EcoStruxure Building Operation / Power Monitoring Expert** | Vector graphics with in-graphic setpoint/enable controls; SLD colour animation that separates energized from de-energized sections | [EBO WorkStation spec](https://www.scribd.com/document/686743514/WorkStation-EcoStruxure-Building-Operation-Specification-Sheet), [PME SLD animation FAQ](https://www.se.com/us/en/faqs/FA335069/), [EcoStruxure Monitoring & Alarming](https://www.productinfo.schneider-electric.com/esxp_digital_apps_iec/edma/English/ESXP2GE001EN-05_ED_Monitoring_Alarming.pdf) |
| **Tridium Niagara 4 (Px / UxMedia)** | Responsive graphics; tag-based bindings (a symbol finds its points by tags, not by hand-typed ids) | [Niagara 4.10 features](https://pages1.tridium.com/rs/808-SGM-271/images/FeaturesOverview-4.10.pdf), [Design secrets for great graphics](https://www.tridium.com:443/content/dam/tridium/en/documents/events/AT3-Project%20Engineering%201-Design%20Secrets%20for%20Great%20Looking%20Graphics.pdf) |
| **JCI Metasys UI** | Location-based navigation (campus → building → floor → room → equipment), graphics linked to spaces and equipment | [Metasys UI](https://docs.johnsoncontrols.com/bas/r/Metasys/en-US/SNE-Commissioning-Guide/12.0/SNE-commissioning-overview/Metasys-UI) |
| **ABB Ability Data Center Automation** | BMS + EPMS + DCIM in one view; KPI overview that drills into a site | [ABB DCA monitoring and visualization](https://new.abb.com/industrial-software/datacenter-automation/monitoring-and-visualization) |
| **ISO 10628-2:2012** (P&ID symbols, ISO 14617 family) | Process equipment, valves, pumps, HX, tanks, lines | [ISO 10628 overview](https://WWW.wikipedia.org/wiki/ISO_10628) |
| **ANSI/ISA-5.1** | Instrument bubbles and tag letters (TT, PT, FT, DPT, LT, AT, FQ; TIC, PIC, FIC), signal lines | already parsed by `js/rz-pid-build.js` |
| **IEC 60617** | Electrical symbols: transformer, circuit breaker, withdrawable CB, disconnector, earthing switch, fuse, contactor, generator, battery, rectifier/inverter, busbar, CT/VT, meter | (IEC 60617 database; shapes drawn by us from the standard's descriptions) |
| **IEEE C37.2** | Protection device numbers on relays (50/51, 51N, 87T, 27/59, 81) | already on the current SLD |
| **NFPA 170** | Fire-safety symbols: smoke, heat, aspirating pipe with sampling holes, manual call point, sounder/strobe, FACP, releasing panel, agent cylinder, nozzle, door release | |
| **IEC 62443-3-2** | Zones and conduits as boundaries with named crossings | current Security tab content, redrawn |

Design rule taken from all of them: **the drawing is grey line work; colour appears only where state needs attention.**
Not copied: vendor clip-art (QA Graphics, TAC library) — licensed; we draw our own geometry from the standards.

## 3. Visual language (replaces gradients, glow, cards)

### 3.1 Palette (tokens in `css/rz-hmi.css`, new)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--hmi-bg` | `#16181b` | `#d9dadc` (≈ Munsell N8) | canvas |
| `--hmi-line` | `#8a8f96` | `#4a4e54` | process lines, symbol outlines (normal) |
| `--hmi-line-2` | `#5c6168` | `#7d8187` | secondary / instrument / dimension lines |
| `--hmi-fill-run` | `#3a3e44` | `#a7aaae` | solid body of a running item (ISA-101: filled = running) |
| `--hmi-fill-off` | none | none | stopped item = outline only |
| `--hmi-text` / `--hmi-text-2` | `#d6d8db` / `#9aa0a6` | `#1d1f22` / `#55595f` | values / tags & labels |
| `--hmi-alm-1` critical | `#e5484d` | `#c62a2f` | alarm priority 1 only |
| `--hmi-alm-2` high | `#f5a524` | `#b26a00` | priority 2 only |
| `--hmi-alm-3` low | `#e8d44d` | `#8a7a00` | priority 3 only |
| `--hmi-info` | `#4cc3ff` | `#006c9e` | selected / traced path (never an alarm) |
| `--feed-a` / `--feed-b` | `#5b8def` / `#3fb27f` | `#2a5cc0` / `#1f7a52` | SLD energized feed identity, 1.5 px stroke only, never fills |
| media hues (thin stroke only) | HTW `#c98a4b`, TCS supply `#5fb3c9`, TCS return `#c96f5f`, CHW `#6f9bd1`, fuel `#a08a5a`, agent `#9a7fc4` | darker twins | pipe medium identity on the stroke; legend per sheet |

Hard rules: no `linearGradient`, `radialGradient`, `filter`, `feGaussianBlur`, `box-shadow`, `drop-shadow` in any drawing
or modal; no element radius > 2 px inside a drawing; alarm colours used for nothing else (not for "hot", not for
headings, not for Feed A/B); a value is never coloured unless it is out of band.

### 3.2 Line weights (at 100 % zoom)

| Line | Weight | Style |
|---|---|---|
| Main process pipe / main bus | 2.0 px | solid |
| Branch pipe / feeder | 1.4 px | solid |
| Instrument process connection | 1.0 px | solid |
| Electrical signal (ISA-5.1) | 0.8 px | dashed 4-2 |
| Data / network link | 1.0 px | solid; fibre = solid, copper = dotted 1-2, wireless = zig |
| Zone / area boundary | 1.0 px | long dash 8-4 |
| Dimension / grid line | 0.6 px | solid, `--hmi-line-2` |

Flow: a small arrowhead every 120 px on running lines; motion (dash march, 2 s linear) only on running lines and only
when `prefers-reduced-motion: no-preference`; stopped line = no arrow, no motion.

### 3.3 Typography — "not all text the same" (R130)

| Role | Font | Size at 100 % | Case |
|---|---|---|---|
| Sheet title (one per drawing, top-left in the title block) | IBM Plex Sans 600 | 14 px | Sentence case |
| Equipment tag (CDU-01, P-HTW-01, TX-A1, VD-1) | JetBrains Mono 600 | 11 px | UPPER (tags are codes) |
| Live value + unit | JetBrains Mono 500, tabular | 11 px | as written |
| Label / description | IBM Plex Sans 400 | 10.5 px | Sentence case |
| Line number / cable id / rating | JetBrains Mono 400 | 9.5 px | UPPER |
| Floor | — | 9 px at fit-to-width; below it the label hides (LOD), it never shrinks further | |

No all-caps sentences. No coloured headings. No text inside a drawing longer than 6 words; anything longer is a tooltip.

### 3.4 Title block and legend

Every sheet carries a fixed title block bottom-right (ISO 7200 fields, compact): drawing no. (e.g. `DH-M-101`), title,
sheet n/m, revision, basis (engine version), scale "NTS", status "SIM" (tooltip explains simulated data). Legend =
a collapsible panel listing only the symbols used on that sheet, generated from the library.

## 4. Symbol library — extend `assets/engineering/` → `js/rz-eng-symbols.js` (one library, shared)

Not a new library: the site already has `assets/engineering/*.svg` + `manifest.json` (37 symbols, 0..48 box,
`currentColor`) built by `tools/build-engineering-symbols.mjs` into `js/rz-eng-symbols.js` and the DCMOC TypeScript twin.
Agreed with the peer session (2026-11-14, they redraw the Conventional family): this session owns the builder and API;
both add symbols. Manifest entries gain `standard`, `ports` (named, on a 6-unit grid, with medium), `states`, `tagPrefix`;
the API gains `ports(kind)`, `use(kind, {x, y, rot, scale, state, tag})`, `list(category)`; `svg()` stays byte-compatible.
Gate `tools/test-eng-symbols.mjs`: every manifest file exists, ports on grid, states declared, no gradient/filter.
`RZLineModel.MEDIUMS` keeps its keys and colours; each medium gains an `hmi` stroke (muted) so drawings never use the
saturated alarm hues for pipes or cables.

Every symbol: id, standard + clause note, SVG geometry on a 24-unit grid, ports (named connection points with medium),
states it can show, default tag prefix, tooltip text id (RZExplain). Draw once, use everywhere (Desigo CC model).

### 4.1 Mechanical / process (ISO 10628-2, ISO 14617)

pump-centrifugal · pump-vfd (with VFD box + SC tag) · fan (axial / EC fan) · fan-wall module · compressor ·
valve-gate · valve-globe · valve-ball · valve-butterfly · valve-check · valve-3way · valve-control (with actuator:
pneumatic diaphragm / electric motor) · valve-pressure-relief · valve-balancing (with test points) · valve-solenoid ·
strainer-y · filter-cartridge · filter-bag · heat-exchanger-plate · heat-exchanger-shell-tube · cooling-coil (air) ·
dry-cooler (V-bank, with fan row) · adiabatic pad (shown only when used) · chiller (evaporator + condenser +
compressor, water-cooled and air-cooled variants) · tank-expansion (diaphragm) · tank-buffer · tank-day (fuel) ·
dosing-pot / chemical dosing pump · air-separator · air-vent-auto · drain / vent · reducer · flexible-connector ·
quick-disconnect coupling (dripless) · cold plate · manifold (supply/return header with n taps) · flow-meter
(magnetic / ultrasonic) · BTU meter · sight-glass · spool / spectacle blind · line break / off-sheet connector
(arrow pentagon with target sheet + coordinate).

### 4.2 Instruments (ANSI/ISA-5.1)

Bubble: field-mounted (plain circle), panel/DCS (circle with bar), PLC/shared (square with circle) · letters parsed by
`rz-pid-build.js` (TT, TE, PT, PDT, FT, FE, LT, LS, AT, ME, XS, ZS, ZSC/ZSO, SC, HS, TIC, PIC, FIC, LIC, DPIC) · signal lines
(electrical dashed, software/data line with circles) · controller loop drawn from transmitter to final element.

### 4.3 Electrical (IEC 60617; IEEE C37.2 numbers as text)

transformer-2w · transformer-3w · circuit-breaker · circuit-breaker-withdrawable (racked in / out / test) ·
disconnector · switch-disconnector · earthing-switch · fuse · fuse-switch · contactor · ATS / STS (two sources, one
load, interlock bar) · generator (G in circle) · utility source · busbar (thick, with section labels) · bus-tie (N.O.) ·
busway / busduct with tap-off box · RMU (3-way, SF6/air) · UPS block (rectifier, DC link, inverter, static bypass,
maintenance bypass, battery) · battery string · PDU / RPP with branch breakers · rack PSU shelf (n PSU, 48 V DC out) ·
CT · VT · power meter · protection relay (device numbers) · surge arrester · earth / PE · cable (with id, size, length).
States from `js/rz-breaker-symbols.js`: closed · open · tripped · racked-out · earthed · locked-out (LOTO tag symbol).

### 4.4 Fire and life safety (NFPA 170, NFPA 2001/75/76/72 practice)

smoke detector (photo) · heat detector · multi-sensor · aspirating detector unit (VESDA class A/B/C) · sampling pipe with
holes · manual call point · abort switch · hold switch · sounder · strobe · sounder-strobe · FACP · releasing panel ·
agent cylinder (clean agent / inert) · pilot cylinder · manifold · selector valve · discharge pressure switch · nozzle
(360° / 180°) · door holder / release · damper (fire / smoke) with actuator · leak detection rope · leak point sensor ·
EPO station · interface module (monitor / control).

### 4.5 Network (neutral geometry; no vendor icons)

switch (L2 / L3) · router · firewall · load balancer / scrubbing · server / compute tray · DPU/NIC port · storage node ·
patch panel / ODF · OOB switch · console server · BMS controller / gateway · carrier / cloud edge · zone boundary ·
conduit (named crossing with protocol + direction arrow, IEC 62443). Link legend: 800G fibre, 400G fibre, 25G copper,
NVLink copper cartridge, management copper.

### 4.6 Architecture (room layout)

wall (with thickness) · door (swing) · double door · fire door (rating text) · column · structural grid bubble ·
raised floor / slab hatch · rack (top view, front marked) · containment (hot/cold aisle curtain or roof) · cable tray
(by layer: power / data / fibre) · busway run · pipe run (by medium) · fan-wall module (plan) · CDU (plan) · leak rope
path · fire zone boundary · egress route arrow · clearance zone hatch (front 1.2 m, rear 1.0 m) · dimension string ·
north arrow · scale bar.

Each symbol ships with: dark + light render, focus ring, hover outline, `<title>` + `aria-label`, and a red-first test
that its ports land on the grid.

## 5. Engines and data reused (R130 "cek semua engine")

Checked in the codebase index (`Apps/second brain`, `dcmoc/src/lib/engine-catalog.json`: 54 namespaces, 251 functions)
and `js/datahall-ai/*`. No new engine; drawings only bind to these.

| Need | Engine / module | Notes |
|---|---|---|
| Hall, rack, power, cooling quantities | `js/dcai-engine.js`, `js/dcai-model.js`, `js/dcai-parameters.js` (v1.6.0) | 440 racks, 55 CDU, 90 fan-wall, UPS frames, gensets |
| Live state per equipment | `js/datahall-ai/hmi-payloads.js` (55 classes), `sim-telemetry.js` (peer P05 — read only), `hmi-points.js` | modal values, alarms, quality |
| P&ID graph, ISA tag parse, path pulses, camera | `js/rz-pid-graph.js`, `js/rz-pid-build.js`, `js/rz-pid-render.js` (R116/R117, 2,192 lines) | **the drawing engine for every P&ID sheet**; already does tag explain and pulse along path |
| Layout without collisions | `js/rz-diagram-layout.js`, `js/rz-diagram-metrics.js` (DIAGRAM_ENGINE_STANDARD) | measured labels |
| Electrical topology & energized paths | `js/datahall-ai/electrical-topology.js` (945 lines), `electrical-live.js`, `electrical-visual-map.js`, `js/rz-line-model.js`, `js/rz-breaker-symbols.js` | SLD states, Feed A/B, scenarios (2N, loss of A …) |
| Fire | `fire-points.js` (160 points), `fire-cause-effect.js`, `fire-workstation.js`, `rz-engine` `fire` ns | zones, isolation, C&E |
| Alarms | `js/rz-alarm-state.js`, `alarm-query.js`, `rz-engine` `alarms` ns | ISA-18.2 priorities |
| Inspector / tooltip / explain | `js/rz-inspector.js`, `RZExplain` (`data/explain/*.json`), `js/rz-basis-drawer.js` (peer) | tooltip text lives in the DB, never in the page |
| Cooling physics | `rz-engine` `cooling`, `cdu`, `hvac`, `water`, `pue` ns | approach, ΔT, flow |
| Reliability | `rz-engine` `reliability`, `tier` | redundancy labels (2N, N+1) from the engine |
| Legibility | `js/rz-svg-legible.js` | replaces the "drawn at 2.8×" scaling with zoom LOD |

Data files (new): `data/hmi/drawings/<sheet>.json` per sheet — nodes (id, tag, symbol, grid x/y, rotation), edges
(from-port, to-port, medium, line number / cable id, size), bindings (engine path or payload point per displayed value).
**No number typed into a drawing.** A builder (`tools/build-hmi-drawings.mjs`) checks every edge connects two existing
ports, every node has a tag and an equipment class, every binding resolves.

## 6. The drawings, sheet by sheet

Each tab becomes a set of sheets (ISA-101 L2) with a sheet switcher; the active sheet opens **fit to width at 100 %**
(no forced 2.8×); zoom 50–400 % with label level-of-detail; minimap bottom-left; title block bottom-right.

### 6.1 Cooling & Piping (P&ID, ISO 10628-2 + ISA-5.1) — 5 sheets

| Sheet | Content (all symbols from §4.1/4.2, all values bound) |
|---|---|
| DH-M-101 Heat rejection | Roof dry-cooler banks (3 groups, bank count from engine 211/211/171), each bank: isolation valves, balancing valve, TT in/out; HTW header supply/return with line numbers (`HTW-300-CS-001` = medium-DN-material-seq); expansion tank, air separator, make-up with backflow preventer, chemical dosing pot, side-stream filter; OAT sensor; free-cooling regime shown as text only in the title block |
| DH-M-102 HTW pumping | Pumps P-HTW-01..03 (2+1) with VFD, suction strainer, check valve, isolation both sides, PDT across pump set, FT + BTU on header, DP control loop (PDIC → SC on VFD) drawn as ISA signal lines; decoupler/bypass |
| DH-M-103 CDU line | 55 CDUs as a repeated group: one CDU drawn in full (plate HX, secondary pumps 2+1, strainer, 3-way mixing valve with TIC, expansion, TT/PT/FT on both sides, leak sensor), the other 54 as compact instances in a bus row with live state only; HTW branch per CDU with isolation + balancing |
| DH-M-104 TCS rack loop | TCS supply/return headers along the rows, rack manifolds (supply/return, QD pairs per tray), cold plates, leak rope; one row in full, 19 rows as instances; rack ΔT per row |
| DH-M-105 Air path (CHW) | Chiller plant (36 run / 143 inst from engine, shown as 2 drawn + group count), primary/secondary CHW pumps, CHW header to 90 fan-wall coils (group symbol), 2-way control valves with TIC, CHW supply/return TT |

Removed: "Primary read …", the sentence captions, the KPI tables inside cards, the "DRY COOLER ARRAY" 30 px titles.

### 6.2 Electrical SLD (IEC 60617, IEEE C37.2) — facility + per hall

| Sheet | Content |
|---|---|
| DH-E-001 HV intake | 150 kV switchyard (4 line bays + 16 transformer bays), 16 × 100 MVA 150/20 kV TX with tap and Z %, 87T/51 relays, metering CT/VT |
| DH-E-002 MV distribution | 20 kV board(s) bus A / tie N.O. / bus B, 19 panels, RMUs, feeders to each hall (8) |
| DH-E-003 Generation | genset pool (171 × 4 MW N+2 from engine; 2 drawn + group), sync bus, fuel day tanks as off-sheet link to fire/fuel |
| DH-E-1xx per hall (×8, one template) | 33 × 2.5 MVA TX per feed, MSB-A/MSB-B, ATS interlock, UPS frames 68 × 1.25 MW per feed (2 drawn in full via the UPS block, rest as group), static/maintenance bypass, battery, busway A/B 5,000 A, RPP groups, rack dual-cord PSU (link to rack sheet) |
| DH-E-190 UPS detail | rectifier, DC link, inverter, static switch, battery breaker, bypass — the L3 modal reuses this sheet |

Energized animation (EcoStruxure PME style): energized conductors stroke in `--feed-a`/`--feed-b`, de-energized grey,
tripped breaker frame in alarm colour; scenario select (existing "Normal 2N", "Loss of Feed A", …) drives
`electrical-topology.js`; sequence of events stays as a compact list beside the sheet.

### 6.3 Network — 4 sheets

| Sheet | Content |
|---|---|
| DH-N-101 Compute fabric | Real fat-tree drawing: 4 representative rail groups with their links drawn (leaf ↔ spine ↔ core), every link line shown, port counts and oversubscription on the link groups; exact totals (110 core / 330 spine / 440 leaf) in the title block, not 30 boxes saying "63 %"; link utilisation is a value on the link, alarm colour only above threshold |
| DH-N-102 Front-end + storage | front-end Ethernet, storage fabric (NVMe-oF), BlueField DPUs |
| DH-N-103 OOB / BMS | OOB switches, console servers, BMS controllers/gateways (`bms-*` classes), BACnet/IP and Modbus segments |
| DH-N-104 WAN + security zones | Carriers A/B with diverse entry, scrubbing, border routers, NGFW pair, DMZ; IEC 62443 zones drawn as **boundaries around the devices above** with conduits as named crossings (C1–C7, protocol, direction, SL-T in tooltip) — replaces the stacked coloured cards |

### 6.4 Fire & Safety — 4 sheets + matrix

| Sheet | Content |
|---|---|
| DH-F-101 Detection | Addressable loops from FACP with every device (smoke, heat, MCP, sounder/strobe, interface modules), loop isolators; VESDA units VD-1..4 with the **sampling pipe drawn along the rack rows**, hole spacing, pipe end cap, transport time; zones as boundaries |
| DH-F-102 Suppression | Clean-agent bank: pilot + agent cylinders, manifold, check valves, selector valves per zone, discharge pressure switches, nozzles in each zone, abort/hold stations, releasing panel logic (cross-zoned: two detection means → release) |
| DH-F-103 Interlocks | HVAC shutdown, fire/smoke dampers, door release, EPO zones, leak detection rope + panel, gas-detection (Li-ion off-gas) if engine has it |
| DH-F-104 Zone map | The hall floor (same geometry as Room Layout) with the 12 zones as hatched areas and live state; replaces the 12 text cards |
| Cause & effect | Stays a table (it is a table in practice); cells link to the device on the sheets |

### 6.5 Room Layout — architectural plan to scale (R129)

Full plan of DH-01 at true proportion (62 × 31 m) with: structural grid (A–H × 1–12 bubbles), walls with thickness,
doors with swing and fire rating, columns, the 20 rows × 22 racks (rack id on zoom), hot/cold aisle containment,
CDU line, fan-wall galleries, service corridor, cable-tray layers, busway runs, pipe runs (HTW, TCS), leak rope,
fire zones, egress routes with travel distance, clearance hatches, dimension strings, north arrow, scale bar.
Layers panel (existing pattern from Data Hall): architecture · racks · containment · power · cooling · fire · network ·
egress · dimensions. Every rack/CDU/fan-wall is clickable (same modal as Data Hall). Fix: the sheet renders on first
open (today 0 × 0 px).

### 6.6 Rack Architecture — GB300 NVL72 (R129)

| View | Content |
|---|---|
| Front elevation (48U, true U scale) | 8 power shelves (5 duty + 3 spare from engine), 18 compute trays, 9 NVSwitch trays, each U slot drawn, tags on zoom |
| Rear elevation | 48 V DC busbar with tray taps and semiconductor fuses, liquid manifolds (supply/return) with QD pairs per tray, NVLink spine cable cartridges, leak tray + rope |
| Side section | airflow (residual), coolant path rack-manifold → tray → cold plates → return, busbar path |
| Compute tray detail (L3) | 4 × B300, 2 × Grace, cold-plate loop with QDs, NICs (ConnectX-8 × 4, BlueField-3), power input; ratings bound to engine |
| Power shelf detail | 6 PSU, AC in A/B, DC out, N+N |
| NVSwitch tray detail | 2 × NVSwitch, cartridge connectors |
| Rail group | 4 racks × rails → leaf switches, links drawn (not boxes) |
| Network rack | elevation with patch panels, leafs, OOB, ODF |

The existing text strips ("CT-01 · 4× B300 + 2× Grace" × 18) become drawn trays; the description moves to the tooltip.

### 6.7 Data Hall (keep direction; finish it)

Keep the plan, layers, thermal overlay, 588 tagged items. Remove the two gradients, the three KPI cards above the plan
(move into sidebar), the "FLOOR … CLOSES …" sentences (tooltip on the title). The real gap is §7: every item opens its
own schematic.

## 7. Equipment modal contract — literally every class (R129, R130)

Tier 1 = hover/focus/tap tooltip; tier 2 = single click → inspector (exists, `equipment-inspector.js`); tier 3 = double
click / Enter / "Open" → **full modal (ISA-101 L3)**. Every one of the 55 classes gets a tier-3 modal built from the same
library, in one layout:

```
┌ header: TAG · class name · state word · alarm count · [Trace ▸] [Pin] [×] ───────────────┐
│ schematic (left 2/3): the item's own P&ID / SLD, 1 hop upstream + downstream drawn,      │
│   off-sheet connectors that open the neighbour's modal                                  │
│ points (right 1/3): ISA tag · value · unit · normal band bar · quality · alarm           │
├ trend (24 h sim, 3 key points) ─────────────── alarms & events (last 10) ───────────────┤
└ spec & maintenance (collapsed): rating, standard, last PM, spares link ─────────────────┘
```

No KPI tiles, no gradient bars, no glow frame; band bars are 2 px grey with the value tick and the alarm limits marked.

| Class(es) | Schematic in the modal |
|---|---|
| `cdu` | plate HX, primary (HTW) side valves + TT/PT/FT, secondary pumps 2+1 with VFD, strainer + DPT, 3-way valve + TIC loop, expansion, make-up, leak sensor, rack-loop off-sheet |
| `crah` / fan-wall | coil with 2-way valve + TIC, filter bank + DPT, EC fan array (each fan its own state), supply/return TT/MT |
| `chiller` | evaporator, condenser, compressor(s), EXV, CHW and CDW connections with TT/FT, kW meter |
| `dry-cooler`, `roof-dry-cooler-bank` | V-bank coil, fan row with VFD, inlet/outlet TT, isolation + balancing valves |
| `cw-pump-station`, `fws-pump-station` | pump set n+1 with VFDs, strainer, check, isolation, PDT, FT, DP loop |
| `fws-piping`, `tcs-manifold` | the pipe run with line number, valves, instruments along it, connected items |
| `chem`, `stp` | dosing pot / pump, conductivity / pH (AT), side-stream filter |
| `leak` | rope path on the floor plan segment, panel, zone, interlock to valves it closes |
| `rack-unit` | rack front + rear elevation mini, its manifold QDs, busbar taps, dual-cord feeds A/B up to RPP |
| `rack-ct`, `rack-ns`, `rack-psu` | tray / shelf detail (§6.6) |
| `rack-manifold`, `rack-busbar`, `rack-leak`, `rack-backplane` | their own detail (no generic rack modal) |
| `sld-main-tx`, `sld-tx` | transformer with HV/LV breakers, relays 87T/51/51N, tap changer, temperature (WTI/OTI), CT/VT |
| `sld-mv-sub`, `sld-rmu`, `sld-msb` | the board: incomers, tie, feeders with breaker states and meters |
| `sld-ups-a`, `sld-ups-b`, `battery-*` | UPS block (§6.2 DH-E-190) with battery string and autonomy |
| `sld-busway`, `sld-rack-psu`, `sld-cooling` | busway with tap-offs / PSU shelf / mechanical load feeder |
| `site-genset-yard`, `site-fuel-farm` | genset with ATS, fuel day tank, transfer pump, level LT |
| `net-core`, `net-spine`, `net-leaf`, `net-domain`, `net-wan`, `net-zone` | the device with its ports and links 1 hop each side, utilisation per link, zone/conduit membership |
| `fire-zone`, `fire-vesda`, `fire-point`, `fire-mcp`, `fire-facp`, `fire-epo`, `fire-cylinder-bank` | the zone's devices, VESDA pipe with holes and alarm thresholds (Alert/Action/Fire1/Fire2), loop position, release chain, isolation state (existing iso dialog) |
| `bms-server`, `bms-network`, `bms-ldc`, `bms-gateway`, `bms-field`, `bms-controller`, `bms-app` | controller with I/O points, network segment, protocol |
| `cable-tray` | tray section with the cables it carries (power / data / fibre) and fill % |
| `room`, `site-gis`, `ahu` | plan segment / site plan / AHU P&ID (coil, fans, filters, dampers) |

**Trace** (Siemens/Metasys style navigation, `rz-pid-graph`): Trace ▸ upstream / downstream highlights the path in the
parent sheet in `--hmi-info`, across sheets through off-sheet connectors (e.g. rack R07 → busway A → RPP → UPS A3 → MSB-A →
TX-A12 → MV bus A → 150 kV). The same for liquid (rack → manifold → CDU-07 → HTW branch → pumps → dry cooler bank).

## 8. Tooltips (R130) and text budget (R128, R131)

Every symbol, line and value has a tooltip (hover, keyboard focus, tap-and-hold on touch): tag · description · live value
· normal band · state · symbol meaning (ISA letters, IEC symbol name) · "Open" hint. Content from `data/explain` +
payloads (no new prose in the page). Delay 300 ms in, 0 ms out; never covers the pointer; fits 390 px.

Text budget per sheet (outside tags, values, line numbers, title block): ≤ 25 words. Today: cooling 1,056, SLD 1,639.
Moved to tooltips: every "Primary read", caption, "DRAWN AT …", "SIMULATED · ENGINE BASIS", the legal line (one "i" in
the footer of the shell), "Buildability" block (becomes a sidebar section).

## 9. Shell (R131) and sidebar (R128)

- Header = the RZ hub nav (`css/rz-hub.css` `.hub-nav` tokens) in one row: brand · page title "AI Data Hall" ·
  hall selector · alarm summary (counts by priority) · status chip `SIM` (tooltip) · clock · theme · account.
  PRD, Manual, Basis of Design, FAQ, Replay, Generate Design, Ask → one "⋯" menu (or a second compact toolbar ≤ 6 icons with
  tooltips) — nothing outside the nav bar; no amber-filled buttons.
- Tabs row stays (10 tabs) but in sentence case, 13 px, scrollable at 390 with fade edge; active = 2 px underline.
- Sidebar: three modes, persisted per viewer (`localStorage`, try/catch): **Pinned** (stays shown), **Auto-hide**
  (collapsed to a 32 px rail; opens on hover/focus/tap, closes 400 ms after leave; never covers the active drawing's
  selection), **Hidden**. Button with icon + tooltip; keyboard `[` toggles; at 390 the sidebar is a left drawer
  (auto-hide only). The drawing area widens when the sidebar collapses (existing `#sideTog` behaviour kept).

## 10. Navigation hierarchy (ISA-101 levels)

L1 DC Dashboard (campus, 8 halls, alarm overview) → L2 tab sheets (§6) → L3 equipment modal (§7) → L4 point detail
(trend + alarm history of one point). Breadcrumb in the modal header; Back returns to the same zoom/pan.

## 11. Laws (each a gate; proved red on today's page before anything is built)

| Law | Check | Today (expected red) |
|---|---|---|
| H1 no gradient/filter/shadow in drawings and modals | DOM scan of every sheet + modal, both themes | red: hSvg 2, coolSvg 2+1, netSvg 1+1, modals many |
| H2 every drawn item comes from the library | every `<use>`/symbol group has `data-sym` in `symbols.json` | red: 0 |
| H3 every equipment item is tagged and opens its own L3 modal with ≥ 8 library symbols | click each class (55) → modal id = class, symbol count | red: > 40 classes generic/missing |
| H4 every symbol has a tooltip (title + explain id) and keyboard focus | scan | red |
| H5 text budget ≤ 25 words per sheet outside tags/values/title block | count | red: 1,056 / 1,639 / 1,592 |
| H6 opens fit-to-width at 100 %, no horizontal page scroll, label floor 9 px via LOD | measure at 390 and 1440 | red: 2.3–2.8× forced |
| H7 no overlaps (geometry survey G1/G5 = 0 on these sheets) | `tools/test-conv-geometry.mjs` scope | — |
| H8 engine binding: perturb an engine input → the bound value on the sheet changes; no literal numbers in `data/hmi/drawings` | perturb gate (pattern of `test-calc-registry`) | — |
| H9 trace: R07 → … → 150 kV and R07 → … → dry-cooler paths equal the topology engine's paths | graph compare | red: no trace |
| H10 colour discipline: alarm hues used only by alarm elements; Feed A/B only as strokes | computed-style scan | red |
| H11 shell: one nav row, no button outside it, ≤ 6 visible actions, no "SIMULATED · ENGINE BASIS" text | DOM + bbox | red |
| H12 sidebar pin / auto-hide / hidden persist across reload; keyboard reachable; 390 drawer | browser test | red: no pin/auto-hide |
| H13 Room Layout and Rack render on first open (non-zero bbox) | bbox | red: floorSvg 0×0 |
| H14 axe serious/critical = 0; reduced motion stops flow animation; 390 + 1440 × dark + light | existing audits | — |

Each law in `tools/test-dh-drawings.mjs` (new) + wiring in `tools/ship-gate.sh`; standard doc
`standarization/HMI_DRAWING_STANDARD.md` (new) in the same release (R089).

## 12. Mock first (owner verdict before any live change)

Mock page `dh-drawings-mock.html` (noindex, design-artefact exemption) with:
1. Cooling sheet DH-M-103 (one CDU in full + array) in the new language,
2. Electrical DH-E-101 (DH-01 hall SLD) energized, with Loss-of-Feed-A scenario,
3. CDU-07 L3 modal with trace,
4. Rack front + rear elevation,
5. Shell header + sidebar pin/auto-hide,
both themes, 1440 + 390 screenshots sent; **stop for verdict**. One revision round budgeted.

## 13. Phases (each its own release, red → green, screenshots 1440/390 sent)

| Phase | Scope | Exit |
|---|---|---|
| 0 | Laws H1–H14 written, red counts quoted | gate committed, red |
| 1 | Symbol library + `css/rz-hmi.css` + mock (§12) | owner verdict |
| 2 | Shell + sidebar (R131, §9) | H11, H12 green |
| 3 | Cooling sheets 101–105 + their modals (cdu, crah, chiller, dry-cooler, pumps, piping, chem) | H1–H10 on cooling |
| 4 | Electrical sheets + modals (TX, boards, UPS, busway, PSU, gensets) | same |
| 5 | Fire sheets + zone map + modals | same |
| 6 | Network sheets + modals | same |
| 7 | Room Layout + Rack Architecture (§6.5–6.6) + rack modals | H13 + all |
| 8 | Data Hall clean-up + remaining classes (bms-*, cable-tray, room, site-*) → 55/55 | H3 = 55/55 |

## 14. Risks and constraints

- Page size 1.37 MB: drawings move to `data/hmi/drawings/*.json` + one renderer; target page ≤ 1.0 MB.
- Peer-owned files not touched: `js/rz-ask.js`, `js/rz-basis-drawer.js`, `js/rz-handoff.js`, `sim-telemetry.js` P05 work,
  `css/rz-tool.css` (read and bind only).
- Standards are paywalled (ISO 10628-2, IEC 60617, ISA-5.1/101): symbol shapes drawn from public descriptions and
  common practice; no copied vendor clip-art.
- Existing gates on this page (electrical topology/live/visual map, fire C&E/points, authority, CDU basis, alarm query,
  geometry survey) must stay green; ids they bind are kept or migrated in the same commit.
- Thermal/lane: one full gate at a time.

## 15. Owner decisions (2026-11-14: "yang terbaik … combine … walau ultra effort")

1. **Mock = all five items of §12**, full quality, both themes, 1440 + 390, sent before any live change.
2. **Canvas, combined:** page chrome keeps the RZ theme (graphite dark / RZ paper light); the drawing frame itself uses
   the ISA-101 process grey in light (`#d9dadc`) and RZ graphite in dark, so drawings read as an HMI and the page still
   reads as RZ. Colour stays alarm-only in both.
3. **Header, combined:** one nav row in the RZ hub style. Frequent actions as icons with tooltips inside the bar
   (Ask, Replay, alarm summary, theme — ≤ 4); everything reference-type (PRD, Manual, Basis of Design, FAQ, Generate
   Design) in one "⋯ Docs" menu. Nothing outside the bar; "SIMULATED · ENGINE BASIS" becomes a `SIM` chip with tooltip.
4. **Repeated equipment, combined:** at fit-to-width, 1–2 items drawn in full + the rest as compact group instances with
   live state; zooming past 200 % expands the group so every one of the 55 CDUs / 440 racks / gensets is drawn in full
   (level of detail by zoom). Every instance is clickable at every zoom and opens its own L3 modal.

## 16. P09 folded in

The peer dropped P09 stage 1 on this page (R133 ownership). Lazy tab loading — the heavy tab builders move out of the
inline script into `js/datahall-ai/tab-*.js` loaded on first open — is done as part of Phase 2–7 here, one tab per
phase, with P09's acceptance criteria added to the gate.
