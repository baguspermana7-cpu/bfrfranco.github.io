# Conventional DC Operations Standard

> Governing contract for the Conventional data-centre overview and its EPMS, Data Hall,
> Chiller, Fire, Fuel, Water and ICT operator surfaces. The UI is an engineering teaching
> cockpit with deterministic simulated telemetry; it is not a field control system.

## 1. Two independent truth domains

| Domain | Authority | Allowed use | Prohibited use |
|---|---|---|---|
| Current simulated operation | `CONV_MODEL` + `CONV_CALC.snapshot` in `js/conv-engine.js` | Current KPI, alarm, subsystem and worked-example values | Scaling it silently into a campus design |
| Governed capacity study | `RZConvDesignBasis.STUDY` in `js/conv-design-basis.js` | Design Studio `current-plus-study`, hall planning labels and discipline requirements | Presenting the study as installed, energized, commissioned or measured |

Changing a hall selector changes view context only. It MUST NOT mutate either frozen authority.
A missing or invalid authority fails closed with an explicit unavailable state.

The adopted normal operating scenario is 7,500 kW per hall: 30,000 kW campus IT and
43,500 kW facility input at PUE 1.45. This is simulated/adopted current operation, not measured
telemetry and not the 40,000 kW campus design point.

## 2. Governed four-hall study

- Four halls: A, B, C and D.
- IT design load: 10,000 kW per hall; 40,000 kW campus IT.
- Rack basis: 500 racks per hall at 20 kW average; selected rack peak 30 kW.
- Thermal contract: chilled-water CRAH / air cooling.
- Project rack-inlet target: 25.4 °C. This is a project target inside, not a replacement
  for, the ASHRAE recommended 18–27 °C envelope for the applicable equipment classes.
- Air reference: 25.4 °C dry bulb, 101.325 kPa, 50% RH, c_p 1.006 kJ/(kg·K);
  moist-air density is calculated, never assumed silently.
- Heat rejection: evaporative cooling tower. Water balance is unavailable for heat-rejection
  types that do not consume water.
- Efficiency: dPUE 1.45 at the declared 100% design point. Off-design facility power is
  unavailable until an approved monotonic load/PUE curve is supplied.
- Resilience intent: concurrently maintainable campus; 2N electrical distribution;
  N+1 generator, cooling and pumping capacity. This is design intent, not Tier certification.

The density gate is mandatory: 10 MW divided across 200 racks is 50 kW/rack and is blocked
for this air-cooling contract. Do not fix the warning by weakening the threshold; change the
approved cooling technology or the rack/capacity brief.

## 3. Operator information hierarchy

Each subsystem uses this order:

1. overall state, critical/warning count, maintenance/bypass, comms, stale, quality,
   scenario and update time;
2. current versus study context and Hall A–D selector;
3. primary process/topology schematic;
4. selected-object inspector with command, feedback, quality, timestamp and source;
5. capacity, efficiency, redundancy and consequence panels;
6. alarm/event history workspace;
7. technical Manual and master PRD routes.

Normal state is visually quiet. Fault red is reserved for an active alarm, trip, fire,
discharge or genuinely energized Feed-A/red path. Signal amber indicates warning or selected
attention. Instrument cyan indicates process/navigation, not health. Oscilloscope green means
proven healthy/running or Feed-B/green; text and state icons always supplement color.

The Data Hall opens on the rack-inlet thermal layer. For the adopted equipment envelope,
18–27 °C inclusive is normal green; values below 18 °C are an overcooling warning and values
above 27 °C escalate amber/orange/red by threshold. The 25.4 °C project setpoint is therefore
normal, not a warning. Power density remains a separate explicitly selected layer.

## 4. Schematic and motion contract

- Topology comes before decoration. A line can animate only from evaluated flow/energization.
- An open, tripped, isolated or unavailable path cannot retain a running animation downstream.
- Electrical source color follows the actual evaluated source through the final ATS-to-rack
  segment. Feed A is red, Feed B green; de-energized is quiet gray.
- Pumps expose command, run feedback, duty/standby role, local/remote, permissive, trip and
  availability. A rotating glyph alone is not a valid running indication.
- Labels cannot overlap symbols or paths at 390, 768, 1280 or 1920 px. Dense diagrams may use
  an internal scroll/fit viewport; the document itself must not overflow horizontally.
- `prefers-reduced-motion: reduce` stops decorative/process animations without hiding state.

## 5. Thermal terminology

- Rack inlet / cold aisle: air entering IT equipment.
- Rack outlet / hot aisle: air leaving IT equipment.
- CRAH supply / return: unit-side air streams; not interchangeable with rack inlet/outlet.
- CHWS / CHWR: chilled-water supply and return only.
- `cooling.flow_lps` is the IT sensible-load CHW reference (943.0 L/s), not measured
  header flow. The current evaporator-duty reference is 982.3 L/s at the same 7.6 K.
  Actual header/branch flow is `UNAVAILABLE` without meters.
- `cooling.heat_rejection_kw` is retained as an API key for compatibility but semantically
  means current evaporator duty (31,250 kW). Condenser/tower heat rejection is
  `cooling.tower_rejection_kw_th` (36,403.4 kW). UI and documents use the semantic labels,
  never the legacy key name as operator wording.
- Heat load is shown in kW thermal. Air removal uses Q = rho × Vdot × c_p × delta-T;
  water removal uses Q = m_dot × c_p × delta-T. Every displayed result names its basis.
- Relative humidity is paired with dew point when used for environmental risk. Do not label
  a 20–80% equipment envelope as a target operating band.

## 6. Subsystem minimums

### Data hall

Cabinet field reconciled by sum to the hall IT load, thermal chain read from the engine planes
(rack inlet → hot aisle → CRAH return), CRAH fleet and N+1 from the engine, hall selector that
re-scopes the field without moving the adopted totals, fail-closed everything.
  **v2.10.0 — continuous ramp + statistics.** The cabinet field paints a continuous severity ramp whose
  stops sit on the alarm thresholds (red only at breach); rack inlet is per cabinet (row cold aisle + a
  declared simulated aisle-end allowance); each row footer carries min–max / avg of its cabinets beside
  the reconciled row planes; the Environment panel carries hall-level rack, row and inlet ranges. The
  statistics are aggregates of the simulated field and are declared as such — the engine publishes hall
  totals and planes only.

### Chiller

CHWS/CHWR, delta-T, labeled reference/measured-flow state, plant load, available capacity, N+1 margin,
COP/kW-per-ton basis, DP, valve/pump states, lead-lag sequence, current/study separation,
Hall A–D selector and equipment diagnostics.
  **v2.5.0 — the drawing continues to the air side.** The primary CHWS/CHWR headers are drawn and continue
  into a distribution band with the secondary header, a secondary pump station and one CRAH bank per hall
  carrying the engine's air-side values (`cooling.crah_*`, supply/return air, air-side ΔT, coil approach, CHW
  ΔT), the hall snapshot's IT load, and the hall's CHW share as a declared identity. Per equipment: pump flow
  (branch reference) + DP, chiller condenser-water flow (identity) + evaporator DP. One chilled-water palette:
  supply cyan, return amber, condenser water violet (the line-model's); status colours from tokens only.
Every simulation branch uses the current engine-derived CHWS/CHWR/flow envelope. Initial paint
and the first timed update are separate acceptance states; a tick may not clamp values back to a
retired operating range.

### Fire

FACP and VESDA remain the authority. Show fire reserve, jockey/main pumps, pre-action and
agent paths, detector zones, first-out, inhibit/abort and a list-form cause/effect matrix.
Effects include lift recall, door/access release, AHU/fan stop, smoke/fire damper action,
EPO, building/BMS/DCIM notification and post-discharge lockout. Each effect shows commanded
and proven state separately.
If the current engine authority is absent, invalid or legacy, every dependent FACP/VESDA,
pump, tank, N₂, wet-pipe, pre-action, interlock and path annotation fails closed together.
No residual `NORMAL`, `STANDBY`, `CHARGED` or pressure-maintain label may survive on a path whose
authority is unavailable.
  **v2.6.0 — a readable P&ID.** Three layers on one sheet: detection & control (FACP, VESDA with sampling
  pulse, five zone chips with smoke/heat symbols, MCP/abort) driven by the same stage machine as the water
  train; fire water with isolation and check valves, PI/PSL/PSH/PT/PRV/FE instruments, a test header and
  the hydrant riser; pre-action with N2-supervised PACVs (SOL/PS/FS). Arrowheads on every pipe end, an idle
  pressure-maintenance flow at stage 0, pump labels that follow the pump. Instrument tags and setpoints are
  declared page basis — the engine publishes reserve, demand and duration only.

### Fuel

Bulk/day tank gross and usable inventory, consumption/autonomy basis, transfer duty/standby,
polishing state and differential pressure, water-in-fuel, delivery/fill state, leak/sump zones,
isolation and N+1 consequence. A fixed burn rate is a declared current assumption, never a
vendor-curve substitute for the 40 MW study.
  **v2.7.0 — the process picture exists.** `#fuel-svg` in the water-system idiom: fill point → UST-01 in its bund
  with interstitial and sump leak points → strainer → duty/standby transfer pumps with isolation + check valves →
  PT/FT → transfer header → solenoid-fed day tanks → gensets; FPU-01 side-stream (prefilter, coalescer, fine
  filter, DPT, WIF) returning on a header shared with the day-tank overflow. Fourteen tagged lines, fail-closed
  first paint, one `renderPid()` from the page's deterministic state; every drawn value is engine-traced or
  declared simulated — no pump schedule, day-tank sizing or instrument reading is invented.
  **Fuel truth (PRD-CONV-EQUIPMENT-TRUTH F2/F5, gate `tools/test-conv-fuel-truth.mjs`).** FU-M-101 is a PER-HALL
  view: the hall selector comes from `CONV_CALC.listHalls()`, the sheet draws one fill valve + day tank + genset per row
  of `CONV_CALC.getFleet('genset', hall)` with the fleet tags (GEN-A1 … GEN-A8, DT-GEN-A1, XV-A1), and the facts line
  states the hall count and the site total in words and numbers only; the engine keys it reads (`getFleet`,
  `electrical.genset_count`, `hall.facility_load_kw`) sit in its `data-source` / title, never in the visible text. The
  day-tank basis shows one line ("Day tank 4,277 L = 4 h at rated burn · fill 50→90 %") and an info button (native
  popover: click, tap, Enter) holding the explanation. No genset count or tag list is typed in the page
  or the sheet file. NORMAL = utility healthy, every set STANDBY at 0 kW, every XV closed, P-101 stopped, no alarm.
  UTILITY LOSS applies the engine sizing rule: the first (count − `electrical.genset_spare_per_hall`) sets run and share
  the hall's `facility_load_kw` equally (each ≤ its rating), the spare stays STANDBY; burn = output ×
  `fuel.specific_consumption_l_per_kwh`. Day tank per set (ASSUMED design basis, printed on the page): capacity = 4 h
  of that set's rated burn; fill opens on a running set below 50 % and closes at 90 %, so a running set keeps ≥ 1.8 h
  at rated burn (45 %); below 50 % with transfer unavailable (containment inhibit or P-101 fail) raises
  `LAL-DT-<set> LO` in the alarm list, below 25 % `LO-LO`. A genset or day-tank symbol opens the equipment modal on
  that set's inside (`js/conv/internals/genset.js`), navigator over the hall's sets. Open: the engine does not yet
  publish the run split (PRD §6.5) — the page states the rule it applies.

### Water

Raw/treated storage, duty/standby pumps, filtration differential pressure, dosing, UV,
conductivity/TDS, cooling makeup, evaporation, blowdown, drift, domestic split, drain/leak and
maintenance state. Current WUE-equivalent flow is not relabeled as a measured instantaneous flow.
Municipal/raw-water treatment is a site utility in this topology, not four duplicated hall plants.
It has no Hall A–D selector. A per-hall allocation remains `UNAVAILABLE` unless governed branch
metering exists; an equal division is not telemetry.
  **v2.8.0 — the make-up path is drawn to the tower.** `#water-svg` ends in CT-501 (cell, fan, basin) with the
  engine's evaporation / blowdown / drift / make-up balance on the drawing and the condenser-water loop to the
  chiller plant at the engine's CDW planes; a two-pump booster train with role (DUTY / STANDBY) and state
  (RUNNING / AVAILABLE) stated separately, isolation + check valves, PI/DP/PT/FM/FT/LIT instruments, one drain
  header. Engine values inside the SVG carry `data-basis-param` + an evidence mark (rz-svg-basis idiom); every
  equipment group opens the right-side inspector payload. Tank capacities are declared design selections.

### ICT / OT
  **v2.9.0 — the architecture canvas.** Each segment draws `svg.ict-arch`: four layer bands, zone frames (OT =
  segmented with controlled conduits, never "air-gapped"), nodes and edges built from the same authored
  inventory the link table states; edges bound to link rows both ways; node inspector with fault domain (live
  downstream set only); drawing-only scenarios with an impact note that says the alarm register is untouched.
  Nothing on the drawing is a new count.

Core/distribution/access/BMS-OT topology, installed/usable/N+1 capacity, traffic, utilization,
latency, loss, jitter, redundancy, gateway reachability, cyber boundary and point quality.
Study rack/port counts derive from the governed rack basis and an explicit oversubscription policy.

## 7. Alarm and event history

Every subsystem must support the same read-only query vocabulary:

- timestamp from/to, with invalid ranges rejected;
- system and point/tag selector or text search;
- severity and ISA lifecycle/state;
- value comparator and unit-aware value;
- quality/freshness and acknowledgement;
- deterministic sort, active-filter summary, empty state and reset;
- CSV export with timestamp, source, value/unit, state, quality and acknowledgement;
- formula-injection-safe exported cells.

Live KPI counts and historical query counts have separate owners. Filtering history must never
overwrite the live alarm strip or invent a first-out event.
The bundled deterministic records are a historian training snapshot: lifecycle means state at
capture time, not current page state. The UI and export provenance MUST identify the run and this
separation; a fixture `active` record cannot be presented as a live alarm.

## 8. Documentation and accessibility

- `prd/dc-conventional.html` is the master product contract, including subsystem anchors.
- Each subsystem keeps its dedicated `manual/<slug>.html` methodology page with a table of
  contents, formulas, worked example, limitations and official references.
- Page controls expose PRD and Manual links and retain the shared Generate Design behavior.
- Tooltips supplement visible labels; they cannot be the only way to discover a critical value.
- Keyboard reachability, visible focus, 44 px coarse-pointer targets, WCAG 2.2 AA contrast and
  text beyond color are mandatory.
- Non-live provenance uses a dedicated in-flow banner slot. A fixed badge cannot obscure the page
  identity, alarm launcher or any live control at supported widths.
- Provenance dismissal is at least 44 × 44 px with a visible signal-amber focus indicator. Decorative
  pulse and transitions stop for `prefers-reduced-motion`; state colors retain WCAG AA text contrast in
  both dark and light themes.
- Dense mobile control panels may become an accessible overlay drawer, but the process schematic
  remains visible at full viewport width when the drawer is closed.
- A responsive action rail must preserve the same DOM, visual and keyboard sequence. Every focused
  item scrolls fully into view; CSS `order` cannot rearrange interactive controls independently.
- If auth extracts public documentation links into an unrestricted layer, that layer precedes the
  protected header in DOM order so public and protected controls retain one coherent tab sequence.
- Historian tables expose a concise caption, `scope="col"` headers and tabular/slashed-zero numerics.

## 9. Machine-checkable gates

Before release:

1. `node --test tools/test-conv-design-basis.mjs`.
2. Subsystem operator regression tests for cooling/water, fire/fuel, datahall/ICT and EPMS.
3. Script-tag, JS syntax, version, mobile, dark, accessibility and interaction strict audits.
4. Browser screenshots at 390, 768, 1280 and 1920 px with zero non-asset console errors.
5. Run `node tools/probe-accuracy-validation.mjs`; browser probes must target the canonical
   `data-basis-param` / `#rz-basis-drawer` contract for registered parameters.
6. Reconcile like-for-like scope: selected-hall 7,500 kW × engine hall count 4 = campus
   30,000 kW current IT; keep the separate 40,000 kW / 58,000 kW design point explicit.
7. Assert labeled generated-document outputs and public PRD/Manual parity for the current
   30,000 kW / 43,500 kW / 943.0 L/s / 600.0 L/min / 744,144 L basis. Reject retired
   1,850 kW, 58.1/58.2 L/s, 37 L/min, 45,900 L and 99.98% claims. A global search hit is not evidence.
8. Gate every duplicated current-value KPI, callout and sidebar surface, including fallback markup.
   Missing evidence renders `UNAVAILABLE` in neutral/amber, never healthy green.
9. Use the shared Design Studio scope identifiers exactly: `current` and `current-plus-study`.
   The latter is a governed planning-study comparison, not an adopted current operating state.
10. Update `CHANGELOG.md`, BMS standard, Obsidian mirror and cross-CLI handoff.
11. A hall rack sum may reconcile only to a governed hall submeter. Campus EPMS divided by hall
    count is a neutral planning reference and must not produce a green zero-difference KPI.
12. Browser gates wait beyond the first simulation interval and prove the last content/control is
    reachable in its actual internal scrollport at 390, 768, 1440 and 1920 px.
13. Run `node tools/test-conv-document-parity.mjs`; generated documents, PRD and Manuals are
    independent current-value consumers and must agree with the governed snapshot.
14. The shared basis drawer defaults to unavailable. A host may opt in only after the governed
    current version and complete required schema pass. Missing, request-mismatch, matched-legacy
    and same-version-incomplete fixtures must stay neutral even through a forced API call.
15. Scenario and data-quality provenance fields must be non-empty after trimming. A blank field is
    unavailable authority, and no status timestamp may advance while authority is unavailable.
16. EPMS source colors identify Feed A/red and Feed B/green; a separate line pattern and state label
    communicate energized, open/standby and tripped. Red source identity alone is not an alarm.
17. Respect `prefers-reduced-motion` across shared banners, electrical flow, plant machinery and AI
    process effects. Static command/feedback/state semantics remain fully visible.
18. Run `node tools/test-conv-design-studio-browser.mjs` from the ship gate. It must select and export
    all three document types, prove distinct bodies/TOCs and preserve current-versus-study scope.
19. Fire rack-footprint context is never labelled protected volume. The 7,200 m³ site proxy is
    non-sizing; protected-enclosure volume requires surveyed zone geometry and qualified approval.
20. Water separates engine-derived site balance/WUE from authority-gated, deterministic page-authored
    treatment-process simulation. Documentation may not call the latter engine telemetry.
21. Every operator numeric surface uses JetBrains Mono with tabular and slashed-zero figures; desktop
    inspector rails and phone columns must remain bounded, internally reachable and unclipped.
22. Simulated process evolution is reproducible for a given scenario. Healthy duty/standby selection
    never changes by chance; automatic changeover requires an explicit modeled threshold or fault.
23. **Text budget (PRD-CONV-REDRAW, `tools/test-conv-text-budget.mjs`, ship gate).** Measured at
    1440 px, dark theme, authorized audit state, outside drawings/dialogs/tooltips/inspector:
    T1 no element whose own text is >= 10 words (a sentence on the page); T2 <= 400 words per
    cockpit; T3 the main drawing is not wider than the box that shows it at rest (scrolling does
    not count as fitting); T4 no `<text>` of >= 6 words inside a visible drawing. Explanations go
    to `conv-<page>-*` RZExplain entries, never back onto the page. Units are written once (field
    attribute, legend chip, column key), not on every cell. Chiller T4 was a ratchet at 28 until
    the W2 redraw (CH-M-101) took it to 0; the ratchet table is now empty. Proven red on v3.59.0 (6 of 6 fail).
23a. **First screen, said once (R185, PRD-CONV-BMS-DECLUTTER, `tools/test-conv-declutter.mjs`, ship gate).** First
    screen at 1440 × 900, words outside the drawing: chiller <= 200, fuel <= 160, water <= 200, fire <= 145, ICT <= 140,
    EPMS <= 180, datahall <= 310. A formula, qualifier or caption is marked `data-quiet` and read in its host's tooltip
    (`js/conv/quiet.js` keeps the tooltip current when a script rewrites it). The strip provenance sentence is quiet:
    it stays in the DOM for `aria-describedby` and PRD-Q06, and "Simulated" stays shown in the banner. A second copy
    of a reading on the same screen carries `data-dup="<id of the copy that stays>"`. Never delete a quiet element
    a script writes; mark it.
23b. **One click opens the machine (R186, PRD-CONV-EQUIPMENT-INSIDE, `tools/test-conv-equipment-inside.mjs` + `tools/test-conv-point-truth.mjs`, ship gate).** A machine whose inside is drawn (`RZConvInternals.has(class)`) opens the equipment modal on that drawing with one click or Enter; the side inspector serves only what has no inside. A reading the page simulates is shown with the page value in every view (tooltip, inspector, modal); a view never seeds its own value for it. A new class gets its inside through `js/conv/internals/<class>.js`, then the gate case.
23c. **The chiller runs its refrigeration cycle (R186 P2, conv-engine 2.5.0, `tools/test-conv-chiller-cycle.mjs` CY0-CY5, ship gate).** R-134a properties come only from the NIST WebBook rows in `data/sources/nist-r134a/`, copied into the engine by `tools/build-conv-r134a.mjs` (`--check` in the gate; linear interpolation, null outside the rows, superheat carried relative to each isobar's own saturation). The authored 0.58 kW/RT is the AHRI 550/590 RATING; the engine fits the isentropic efficiency that reproduces it at the rating saturations and re-solves the same machine at the plant's lift, so a submittal still replaces one number. Every reading in the chiller drawing is either an engine key with its basis or the text "not modelled" (oil, EXV position, relief, purge, hot-gas bypass: transient or vendor-specific). A new cycle reading needs: an engine key, its curated registry row, a CY assertion, then the drawing. A second solver (`tools/lib/r134a-cycle-check.mjs`, raw NIST files, no shared code) must agree. The chiller modal draws the running unit's cycle on a P-h chart (`js/conv/ph-chart.js`, `tools/test-conv-ph-chart.mjs`): log P, linear h, dome and isotherms from the engine's own rows, segments in the drawing's refrigerant tokens, a table view; a standby unit shows none.
23d. **Pumps, tower cells and CRAHs show their inside (R186 P3, `tools/test-conv-internals-p3.mjs` P3-1..P3-6, ship gate).** One click on a CDW pump, a secondary CHW pump, a tower cell or a CRAH opens its internal drawing (`js/conv/internals/pump.js`, `tower.js`, `crah.js`). Pump hydraulic power = ρ g Q H, shaft = hydraulic / pump η, ΔP = ρ g H (engine keys `cooling.<service>_pump_*`); shaft / (motor η × VFD η) must equal the published kW_e. CRAH airflow = duty / (ρ cp ΔT_air) with ASHRAE dry-air values. Tower evaporation, make-up and blowdown are not drawn per cell while the water balance is WUE-based. A reading the plant does not model says "not modelled" in the drawing AND in the modal's plant readings; a seeded wave never stands beside it.
24. **One reading, one place (W3 polish).** A KPI tile carries a number and at most a short qualifier; the
    explanation goes to its tooltip or basis drawer. A tile that repeats another tile's number is removed or
    replaced by a figure the operator does not already have: the fuel "N+1 scenario" tile printed the same
    autonomy as the autonomy tile (N+1 load sharing leaves the burn unchanged) and now shows the margin over
    the 24 h SLA. A strip that redraws what the P&ID already shows (fuel icon flow path, ICT box-list topology)
    is deleted, not restyled. The data-hall field fits 25 rows at 1440 px without side scroll: the row footer
    prints min, max and avg as three bare numbers whose order is written once in the legend key. Simulated
    timers run at their labelled rate: the fire suppression ABORT window is 30 real seconds (it ran 5 s per
    tick).
25. **Depth on the HMI sheets (W3, v3.62.0, `js/conv/hmi-depth.js` + `css/conv-hmi-depth.css`).** Opt-in per host with
    the class `hmi-depth` (water WT-M-101, fuel FU-M-101). `RZHmiDepth.apply(svg, {levels})` adds, from the sheet's own
    geometry: a body gradient and one clipped specular per equipment symbol, a dark casing under each pipe plus a
    sheen line (a tube, not a stroke), liquid level fills that deepen toward the bottom of a tank with a surface band,
    and ONE contact shadow filter on the whole node layer — never a filter per symbol (headless and phones stall on
    hundreds of filters). Colours are tokens (`--hd-s1..s3`, `--hd-case`, `--hd-shadow`, `--hd-surf`) per theme.
    Depth never moves geometry: tags, values and hit targets are the renderer's.
    Materials (v3.63): insulated chilled water is drawn as aluminium cladding (wider jacket, seam ring every 22 units),
    bare painted steel (fire water, fuel, condenser water) as a dark tube wall, and welded storage tanks show two
    shell-course seams clipped to the body.
26. **Sheet text is never struck (v3.62.0, `tools/test-conv-sheet-text-clear.mjs`, ship gate).** At 1440 px on fire,
    chiller, water and fuel: C1 no pipe/cable runs through a text box, C2 no zone/box border crosses one, C3 no foreign
    equipment body covers one. The text-vs-text geometry gate could not see these; W3 found them on screenshots.
    Proven red on the pre-fix tree (UST-01 tag × fill pipe, PT-101 value × divider, fire PAV-02..05 × release
    lines, FH / HR RISER × zone border) and by mutation (TK-402 values × divider). C3 measures the filled body
    (`.b`) box; C5 (v3.62.2) closes its blind spot: no stroked outline of a foreign symbol (tank shell, pump casing,
    instrument bubble, any path/line/circle/rect in another `.hmi-node`) passes through a text box, sampled every 1 user
    unit. Proven red with `RZ_TEXT_CLEAR_PLANT=1` (fire: FACP-01 tag on the VESDA pipe outline fails C5 while C3 passes). C4: the sheet page never scrolls sideways at 1280 / 1440 px (a grid item
    holding a sheet needs `min-width: 0`).


27. **The sheet tells the truth about flow, state and quality (W4, PRD-CONV-BMS-UIUX, `js/conv/sheet-truth.js`,
    gates `tools/test-conv-bms-truth.mjs` + `tools/test-conv-sheet-perf.mjs`).** On fire, chiller, water and fuel:
    every drawn flow is a point with a quality; an edge moves only when its point is good and > 0, a good 0 is
    `stopped` and prints `0 <unit>`, stale/bad/no-data are `unavailable` with the word on the value (`STALE (last)`,
    `BAD`, `NO DATA`) and never a number or motion (B1); pumps print `CMD ON|OFF` and `RUN|STOP` as two values, a
    mismatch marks the symbol (`data-mismatch`) and stills its branch (B2); one stale point changes only its own
    edges and an active alarm stays (B3); alarm = filled triangle `!`, acknowledged = hollow triangle `ACK`, selected =
    dashed body outline — readable in greyscale (B4); every symbol opens its detail beside the sheet and closing
    returns focus, selection, pan and zoom (B5); reduced motion animates nothing and keeps static arrows on running
    edges only (B6); an alarm reaches its mark in <= 250 ms and a sheet off screen runs no animation (B7). A chiller
    branch at a valid zero is not a disconnect. The test seam `window.RZConvSim` exists only in simulated data mode
    and never writes to equipment. **Not verified:** the brief's frame budgets (p95 <= 20 ms desktop, <= 34 ms
    phone) — headless Chrome rasterises SVG in software (one sheet repaint ~30 ms against a 16.7 ms blank-page
    control); the gate prints the numbers and leaves the budget for target hardware. Signed reverse flow and
    breaker/energised scenarios do not apply to these four mechanical sheets (no reversible path, no breaker feedback).

## 10. Change and lesson ledger

### 2026-11-20 — quantity truth on the chiller plant sheets (CH-M-101 + CH-M-102, PRD-CONV-EQUIPMENT-TRUTH E3)

- **The sheet holds no count.** `js/conv/chiller-sheet.js` builds both sheets from `CONV_CALC.getFleet()`
  (`RZChillerSheets.fromEngine(C)`): one train per `chiller` unit (tag and state from the fleet), its primary pumps from
  `chw_primary_pump` (pump A/B per train by tag), the secondary pumps from `chw_secondary_pump`, one CRAH coil bank per
  `listHalls()` hall. The page's simulated loops are seeded from the same fleet (`seedLoops()`): a standby train is drawn
  still (no flow, `STANDBY / 0/3 COMP / NO FLOW`), never animated. A count typed in the page is a defect.
- **CRAH banks.** One typical coil per hall, value `× N · M RUN` from `getFleet('crah', hall)`; the hall selector marks the
  hall's bank (`data-hall-selected`, dashed body). Double-click (≥ 800 px) or the inspector's "Open equipment HMI" opens
  `RZConvModal` 2.1.0 in **fleet-only** mode (`internal.fleetOnly`): navigator over the hall's units, fleet strip, unit
  rows from the fleet, and one line that the inside is not drawn yet (E4). Tower cells and CDW pumps use the same mode.
- **CH-M-102 — condenser water and cooling towers.** Reached by the sheet switch above the legend (`data-chw-sheet-btn`,
  `aria-pressed`, host `data-chw-sheet`). One column per `tower_cell` / `cdw_pump` unit: CDWR header → cell → basin
  header → pump → `<CH-nn> COND` off-sheet. TT-CDWS / TT-CDWR read `cooling.cdw_supply_c` / `cdw_return_c`; each
  running cell shows its `rejectionKwTh`, the CDWR inlet Σ of them — equal to `cooling.tower_rejection_kw_th` within 0.5 %.
  Payload classes `condenser:coolingTowerCell`, `condenser:pumpCentrifugal`, `condenser:instField`.
- **Readability.** Sheet text on the plant page is 12 units and both sheets are drawn at `minScale` 1, so no text is under
  11 px at 1440 or 390 (the panel scrolls at 390, the page never does). Node ids: CDW pumps `cp<n>`, secondary `ps<n>`,
  primary `p<letter><n>` (the letter class excludes `s`), so no regex on one family catches another.
- **Gate** `tools/test-conv-quantity-truth.mjs`: L1 trains/pumps = fleet (tags + states), L2 CRAH label + hall mark +
  modal, L3 CH-M-102 = fleet + Σ rejection, L4 every chiller opens its own unit and every tagged symbol's `<title>`
  starts with its ISA tag, L5 text ≥ 11 px / no overlap / no pipe or zone border through text / no sideways scroll /
  0 page errors — 1440 + 390, both themes; then again under a `getFleet` stub (8 chillers, 6 secondary pumps, 8 cells,
  30 CRAH). `RZ_QT_PLANT=font|unit|sum|ignore|perf` plants a defect each law must catch.
- **Integrator review (same day), now laws of the same gate:**
  - *Motion cost (PERF1/PERF2).* A CSS dash or rotor animation inside the SVG repaints and re-layerizes the whole
    drawing on every display frame: the 10-train sheet cost ~4 s of main thread per 5 s. The page now holds the sheet's
    animations paused and a 3 Hz clock (`chwMotionClock`) places each VISIBLE moving element by an inline negative
    `animation-delay` (per element — one inherited custom property restyled every node). Names, durations and flow
    rules are unchanged. `hmi-depth.js` keeps geometry layers (specular, flanges, plinths, tube sheen) across updates
    and only restamps the flow state. Measured as renderer main-thread CPU (`Performance.getMetrics` ThreadTime) over
    5 s idle at 1440, best of 2 interleaved runs against the base ref served from git in the same run: ≤ 1.5 s and
    ≤ base × 1.2; load-quiet (load + 500 ms without a request) ≤ base + 3 s.
  - *No flow, no loop temperature (Q2).* A standby train shows `—` on CDWR / CDWS / TT-x01 / TT-x02.
  - *One flow source (Q3).* A running train's CALC BRANCH REF is the engine's `getFleet('chiller')` `chwFlowLps`; the
    per-train spread is gone.
  - *NORMAL is quiet (Q4).* The NORMAL simulation reverts dp and loop temperatures to the engine plane with small noise
    and caps them below the warning limits; 50 scans (60 simulated s) give 0 WARNING / ALARM marks on both sheets.
  - *Clear and unclipped (Q1).* Labels keep 2 px of air from every pipe; CH-M-102 is 1025 units wide so it fits the
    1440 panel with no sideways scroll; at 1034 and 390 every text is inside the scroll range.

### 2026-11-21 — Trend design (PRD-CONV-TREND-DESIGN, `js/rz-trend.js` 3.0.0)

- **Ink pen, colour only where abnormal (ISA-101).** Pen 1 is drawn in page ink; the pieces above H/below L are cut at the
  limit (interpolated, so pieces meet on the line) and painted `--rz-pt-warn` / `--rz-pt-alarm`. The now dot wears the
  header state. A 4 px state ribbon under the plot repeats time-in-state.
- **One neutral band, hairline limits.** The normal range is one ink band at 5 %; HH/H/L/LL are solid hairlines with muted
  labels; a limit outside the axis is an edge marker (`HH 40.0 ↑`). No coloured washes, no dashed limits, no coloured text
  except the header value and state word.
- **Axis fits the data.** Data ± 10 %, nice ticks (1/2/2.5/5 × 10ⁿ), labels with the decimals the step needs; one axis per
  unit, a second unit gets its own panel below (never a dual axis). A gap > 2 steps is drawn dotted and muted.
- **Compare.** At most two compare pens, slots from `RZTrend.slots()` (dark `#74a6f0`, `#626266`; light `#1f5fae`,
  `#8a9099`), each ≥ 15 ΔE (OKLab × 100) from every state token and from each other; an end label carries identity.
- **Less text.** Source, limits basis and time zone sit in the ⓘ tooltip (opens on hover with a mouse, on tap otherwise);
  stats are one ink line; buttons are text (Compare · Table · CSV). Gate `test-conv-trend-ranges.mjs` D1–D13.

### 2026-11-20 — Point status and trend (PRD-CONV-POINT-STATUS-TREND T0/T1, shared files)

- **One source of limits (P-1).** Every operating limit is a row of `data/conv-limits.curated.json`
  (`{ id, label, unit, lo_alarm, lo_warn, hi_warn, hi_alarm, deadband, nominal, basis, evidenceClass, source{ref, asOf},
  migratedFrom }`, schema `data/conv-limits.schema.json`). `tools/build-conv-parameter-registry.mjs` copies the rows into
  `data/conv-parameters.json` / `js/conv-parameters.js` as `limits`. A page reads `RZPointStatus.limits(id)`; it never types
  a limit. Point ids are registry ids (`cooling.chws_c`) or, for a simulated tag, `<page>.<tag>.<quantity>`
  (`cdu-mini-bms.TT-01.supply_c`). Basis order: a standard read at its clause (the row names the table and the date read),
  else the engine design value ± a declared margin, else ASSUMED. A standard not read is ASSUMED.
- **State = classify(value, limits, previous state), nothing else (P-2).** `js/conv/point-status.js` (`RZPointStatus`):
  warn at `v > hi_warn`, alarm at `v > hi_alarm`; back to warn only below `hi_alarm − deadband`, to normal only below
  `hi_warn − deadband` (ISA-18.2); low side mirrored; null bounds never invent a state. `apply(el, id, v)` writes
  `data-pt-state` / `data-pt-dir` / `data-pt-value`, aria-label and tooltip only when they change.
- **Colour on the number only (OD-1), never the only cue (P-4).** Tokens `--rz-pt-ok/-warn/-alarm` live once in
  `css/conv-point.css` (dark `#3fb950 / #e8b563 / #ff6b5e`, light `#1a7f37 / #7a4800 / #b42318`, each ≥ 4.5:1). Warning
  ▲ (▼ low), alarm ◆ + 1 px outline, state word in aria-label and tooltip. Flat view (`rz-hmi-sheet` shade mode flat)
  keeps normal values in page ink.
- **The trend tells the page's story (P-5).** `RZTrend.open(id, { value, state })` pins the last sample to the page value
  and the header to the page state; bands and the H/HH/L/LL lines come from the registry row. Ranges 1H · 8H · 1D · 7D ·
  30D (`RZConvHistory.RANGES`, 30D at a 30-min step), default 1D, remembered per session, keys 1–5; old `r=5m/1h/24h/7d`
  links map to 1H/1H/1D/7D. Footer: min · max · mean · time in warning · time in alarm · excursions. ≤ 600 px: the house
  sheet (`js/rz-sheet.js`, `onClose`) at 88 % height, sticky range bar, 44 px targets.
- **A normal plant has a normal past (P-6).** A history def passes through `RZConvHistory.bounded(def, limits)`: amp is
  capped so the 30-day series stays inside the normal band; a base already outside is an engine breach, left alone.
- Gates: `test-conv-point-status-core.mjs` (Node), `test-conv-trend-ranges.mjs` (fixture
  `tools/fixtures/conv-point-trend/`), `test-conv-point-coverage.mjs` (ratchet, `tools/conv-point-coverage-baseline.json`).
  Pages adopt in T2 (sheets) and T3 (tiles, tables, modal rows).
- **The numbers live in the database, with a labelled fallback (§5b, T1b 2026-11-21).** Supabase `conv_points` holds the
  limits (all read, root write, every change in `audit_log`); `conv_point_samples` (5 min, 48 h) and `conv_point_rollup`
  (30 min, 35 d) hold the history, written inside the database by pg_cron (`conv_sample_tick`, the SQL port of
  `RZConvHistory.value`, equal to the digit). `RZPointStatus` reads `conv_points` after first paint (5-min sessionStorage
  cache, rows that break the order law ignored) and falls back to the shipped registry. `RZTrend` reads
  `conv_point_series` through `RZTrend.dbProvider` (header "Database (simulated, pg_cron)") and, when the database does not
  answer within 4 s, draws the local model for every pen with "Database unreachable — local SIM history" and the source
  "Local model (database unreachable)". One open never shows two sources. Pages outside the registry pass
  `RZTrend.register(points, { provider })` and `RZPointStatus.define(id, fromSimple({...}))`; precedence database row >
  `define()` > shipped registry (a database row never overrides a `define()` of a non-conv id). Limits are edited in rz-ops
  → Point limits (root). Seed = `tools/build-conv-points-seed.mjs` from the curated limits + `data/conv-points.json`
  (freshness gate). Gate `test-conv-points-sql.mjs` (local postgres:16). **Owner action:** run
  `supabase/migrations/2026-11-20-conv-points.sql` once in the Supabase SQL editor
  (`documentation/product-transformation/02-prds/PRD-CONV-POINT-STATUS-TREND/RUNBOOK-DB.md`); until then the fallback serves.

### 2026-11-21 — Data hall space (v3.83.0, PRD-CONV-DATAHALL-SPACE, R182)

- The data hall page gives the screen to the hall: one 44 px hall bar, the floor, one 320 px inspector
  (hall / rack / CRAH / row). No explanation prints at rest; it lives in the (i) panel, the Events drawer or a
  tooltip. Text budget 120 words (`test-conv-text-budget`).
- The floor fills its stage: `RZFloorPlan` lays rows out in 1–3 bands so cabinets stay readable (≥ 12×9 px at 1440;
  measured 33×45). A box larger than its drawing does not count (SP1 measures the drawn hall).
- A row strip prints one number (row kW). Inlet, hot aisle, ΔT and min / avg / max live in the row panel as points.
- A closing bottom sheet never eats the next tap (`js/rz-sheet.js`).
- Gate: `tools/test-conv-datahall-space.mjs` SP1–SP10 (floor share, 25 rows, floor top, words, sentences, numbers
  printed once, no inner scroll boxes, every reading id kept and reachable, selection, 0 errors).

### 2026-11-21 — Motion that carries state (PRD-CONV-BMS-MOTION, R183)

- Every Conventional cockpit loads `css/conv-motion.css` and `js/conv/motion.js` (after `point-status.js`). A new
  cockpit adds both; a page never hand-rolls its own enter, press or state animation.
- A point's state colour crossfades; a point that worsens is marked once (`data-pt-arrive`, 900 ms). A page that
  repaints its numbers on a tick does not mark the first paint (no previous state) and does not re-mark a flap.
- Dialogs animate only when the pointer opens or closes them; keyboard stays instant. A leaving dialog takes no clicks.
- Panels that swap content call `RZConvMotion.swap(el, { stagger: true })`; a view that replaces another in place calls
  `RZConvMotion.fade(el)`. Dialogs: `dialogIn` / `dialogOut` when `RZConvMotion.byPointer()`.
- A component that rebuilds its DOM (resize, relayout) keeps keyboard focus and cursor if it had them
  (`js/conv/floor-plan.js` `build()`; FX4 of `test-conv-floor-plan` forces the rebuild).
- Gate `tools/test-conv-motion.mjs` (MO1–MO7). Rules: `standarization/MOTION_STANDARD.md` "Conventional BMS pages".


### 2026-11-21 — The plant is seen running (PRD-CONV-BMS-LIVE, R184)

- Every Conventional cockpit links `css/conv-live.css` after `conv-motion.css`. A new sheet medium adds its slug rule
  (lifted toward the ink) and its State-view running tube rule (deepened toward the surface) there.
- Motion is a reading: only on a running line, unit, link or air path; speed from flow, speed, row heat or link load;
  still off screen and under reduced motion. A page never animates a stopped thing to look busy (fuel at utility
  normal is still, and that is correct).
- Data hall plan (`js/conv/floor-plan.js`): supply/exhaust air paths are part of the plan; `paint()` sets their speed and
  colour, never adds or removes them. ICT (`ict.html`): an `.edge-flow` per UP link with `data-load`.
- Gate `tools/test-conv-live.mjs` (LV0–LV8).
### 2026-11-21 — How a page marks its numbers (PRD-CONV-POINT-STATUS-TREND T2/T3 pilot: chiller-plant, cdu-mini-bms)

Every rendered number is exactly one of three things (P-3). A page says which with one attribute; it never types a limit
or a state colour.

- **Point** — `<span data-point="<id>" data-pt-label="TCS supply" [data-pt-unit] [data-pt-digits] [data-pt-cls="ENGINE"]>`.
  `RZPointStatus.bindAll(host)` after the host is painted registers its trend (base = the number shown, amp bounded per
  P-6), makes it a button (tabindex 0, role button, `data-trend`), and writes `data-pt-state` from the registry limits of
  `<id>`: with limits it is coloured (ok green, warn amber ▲/▼, alarm red ◆), without limits it is Informational (page ink).
  The value classified and pinned in the trend is the number AS SHOWN (`data-pt-value` = the text, P-5): call
  `apply(el, id)` without a value, or with the rounded one, never the raw float.
- **Constant** — `data-const` on the element or its card (a rating, a design value, an operator setpoint, a prose note
  that quotes a band). Page ink, no trend; where the card has `data-basis-param` a click opens the basis drawer. A number
  inside a basis card that IS a reading is a point: `rz-basis-drawer.js` stops its walk at `[data-trend]`, so the number
  opens the trend and the rest of the card opens the basis.
- **Sheet labels** (`js/rz-hmi-sheet.js`): a value item carries `point` and `label` (and `unit`) in the sheet model; the
  sheet writes `data-point` the first time the label shows a digit, rewrites only the text node on later scans (the glyph
  tspan stays) and calls `apply` only when the text changed — PERF1 holds. A per-unit reading of a limited quantity names
  the registry row it inherits in `limitsOf` (`TT-101 CHWS` → `cooling.chws_c`); the page maps it with
  `RZPointStatus.define(id, limits(row))` and again on `rz-point-limits` — a mapping, not a typed bound.
- **A panel that repaints every tick** keeps its point elements: repaint through a shape check (`ptPaint` on
  chiller-plant: when only the numbers changed, only their text nodes are written), or a rebuilt panel re-registers every
  trend and drops the keyboard focus each scan.
- **Specificity.** The state rules carry id weight (`:root:not(#rz-pt) [data-pt-state=…]`): a page value rule
  (`.tile .v`, `.kv .v`, `.hmi-svg [data-role="value"]`, `[data-alarm]`) must never repaint a state. A normal point with
  limits reserves its glyph's width (invisible `::after` / `tspan.rz-pt-g-off`), so nothing moves when it turns.
  Hover = a 1 px underline; no glow, no fill. A child point gets `title=""` so a parent's native title does not stack on
  the point tooltip.
- **Limits migrated in the pilot:** chiller `LOOP_T2_WARNING_MAX / LOOP_T2_ALARM_MAX` (CHWR + 0.8 / + 1.5 K) became the
  registry row `cooling.chwr_c`; cdu-mini-bms `TILES lo/hi` and `bandState()` are gone — the tile bar, its band text and
  its state come from the `cdu-mini-bms.*` rows (TCS supply warn 37 / alarm 40 °C, OD-3). The clogged-filter override of
  the loop-dP state is gone (P-2): the FILTER tile carries that alarm.
- Gate `tools/test-conv-point-coverage.mjs`, STRICT pages (chiller-plant, cdu-mini-bms) at 1440 dark and 390 light:
  PC1 unclassified = 0, PC2 state = classify(shown value, limits), PC3 painted in the token, PC4 glyph, PC5 the owner's
  example on the real controls (In-Rack + Hot facility water → TCS 39 °C: amber ▲, trend header "▲ Warning high"),
  PC6 a page has points. A page becomes STRICT when its T2/T3 migration lands.

### 2026-11-18 — equipment internals contract (modal v2 + chiller inside, PRD-CONV-EQUIPMENT-TRUTH E2)

- **The modal draws the INSIDE, never the outside.** `RZConvModal.open(payload, { internal })` (v2.0.0, same API) shows,
  when `RZConvInternals.has(class)`: header with tag, class, state chip and a unit navigator (`◂ 03 of 10 ▸`), a fleet
  strip (one cell per `getFleet` unit: state colour + pattern + load %), the internal drawing (RZHmiSheet, pan/zoom,
  View bar State / Thermal / Medium / Flat, media key), the block detail of the selected block (name, standard, state,
  two-line role, values with unit and basis dot), then the unit's plant-sheet sections (`payloadFor(i)`; a unit the plant
  sheet does not draw yet says so in one line). Classes without an internal sheet open the v1 modal unchanged. The page
  opts in per item: `T4.opener(build, host, more)` merges `more(n)` (e.g. `chwDeepOpts`) into the modal options.
- **Registry.** `js/conv/internals.js` (UMD, Node-tested) holds `register / has / get / model / read / detail / flow /
  temp / tempRange / ratio` and the ONE table of display formats. A class file (`js/conv/internals/<class>.js`) holds
  geometry, engine-key names and the block catalogue only: `tools/test-conv-internals-core.mjs` strips its GEOMETRY
  block, comments and `standard:` text and fails on any digit left (planted `var DESIGN_SUPERHEAT = 5;` → red).
- **Values.** Every drawn value is an engine key of the SELECTED unit (`CONV_CALC.getFleet(class)[n]`) or a plant key
  that holds for every running unit (`snapshot.cooling`); a derived one carries its formula (COP = duty ÷ input). A value
  the engine does not model is the text "not modelled" (superheat, subcooling, IGV position, oil pressure/temperature,
  discharge temperature, VFD speed, intermediate pressure, HGBV/EXV opening, relief set point, purge). A reading that
  exists only while the unit runs is "—" on a standby unit — no "standing" pressure is invented. A block-detail cell is
  traced to its registry id only when that id IS this unit's value; a fleet row of a non-running unit is declared.
- **Laws (gated).** Evaporator duty + compressor input = condenser duty within 0.1 % on the DISPLAYED numbers
  (4464.3 + 736.2 = 5200.5 kW); Σ running-unit duty = unit duty × running, Σ input = `chiller_input_kw_e`; a standby unit
  has no running line and no running-only number; the PRD §5.1 chiller catalogue (17 blocks) is on the drawing, tagged,
  with a role. `node --test tools/test-conv-internals-core.mjs` (7 laws, 4 planted defects red) and
  `node tools/test-conv-internals-render.mjs` (1440 + 390: not a clone, blocks select, values = model = engine, fleet
  10 / 7, 01 → 08 standby still, Thermal, reduced motion, text ≥ 11 px with no overlap / pipe / foreign body, Escape +
  focus return, no sideways scroll; `--plant=clone|nomodel|balance|overlap|motion` each red).
- **Line grammar inside a machine.** Media get their own classes and tokens (`m-ref_lpv`, `m-ref_hpv`, `m-ref_liq`,
  `m-ref_flash`, `m-oil`, light + dark in `css/conv-vfx.css`). Running unit: water and refrigerant `running`;
  standby: water `stopped` (isolated), refrigerant and oil `standby` (charged, at rest); hot-gas bypass and purge flow
  `unavailable` (not modelled). Thermal: water at its own temperature, refrigerant at the saturation temperature of its
  pressure level (range evaporator → condenser saturation); a line with no temperature stays neutral.
- **Readable in a modal.** The internal sheet never renders below 0.92 × its 740-unit width (scroller at 390 px) and its
  text is 12 units, so no label is under 11 px; the drawing takes the modal's theme (flat `--hmi-bg` ground).
- **Symbols added (additive, `tools/hmi-symbol-defs.py`):** `compressorCentrifugal` (suction, discharge, interstage
  economiser, shaft, oil ports), `guideVanes`, `motorIec`, `vfdDrive`, `flashTank`, `purgeUnit`, `pumpGear`, `oilSump`.
  `RZHmiSheet` gained `tagAt: 'at'` + `tagXY` (additive) for compact drawings.
- **Registry.** The conv parameter registry now reads the `js/conv/internals/*.js` files a page loads as part of that
  page; the 11 cycle keys the chiller drawing reads lost `display: internal`; the four per-unit plant figures keep it with
  a reason that names the fleet-row link.
- **Known, not changed here:** the plant sheet's own canvas takes the root (light) gradient while its labels carry a dark
  halo (the page sets `data-theme="dark"` on the sheet host only) — visible on CH-M-101 today; the plant sheet drew four of
  ten chillers until E3 (2026-11-20, see above).

### 2026-11-18 — plant internals basis (engine 2.4.0, PRD-CONV-EQUIPMENT-TRUTH E1)

- **Additive only.** Engine 2.3.0 → 2.4.0 adds 63 `cooling.*` keys (18 authored, 45 derived) and
  `CONV_CALC.getFleet(kind, hallCode?)`; a flattened snapshot diff against 2.3.0 shows 0 changed and 0 removed keys
  (only `meta.version`). Every new key is in `data/conv-parameters.curated.json` with `display: internal` until the
  equipment modal (E2+) draws it. Gate: `node --test tools/test-conv-plant-internals.mjs`.
- **Reuse before naming.** Unit load % is `cooling.chiller_part_load_pct`, cycle COP is `cooling.plant_cop`, tower
  range is `cooling.cdw_range_k`, unit compressor input is `cooling.chiller_input_per_machine_kw_e` — no second name.
- **Chiller.** Unit duty = `heat_rejection_kw` / running (4,464.3 kW_th); condenser = duty + input (5,200.5; × 7 =
  `tower_rejection_kw_th`); unit CHW flow = `plant_duty_flow_lps` / running (140.3 L/s); unit CDW flow = condenser /
  (cp × range) (248.5 L/s). Cycle: evaporator saturation = CHWS − 1.5 K (17.9 °C), condenser saturation = CDW return +
  1.5 K (38.5 °C), lift 20.6 K; R-134a pressures from an Antoine fit (A 14.67309, B 2236.949, C −24.44, kPa / K) to the
  published saturation table (STANDARD; the fit is DERIVED, max error 0.08 % over −10…60 °C, gate ≤ 1 % over 0…50 °C):
  535.3 / 977.1 kPa abs, ratio 1.825; Carnot COP 14.13, cycle fraction 0.429. Superheat, subcooling, IGV position,
  oil pressure and discharge temperature are NOT modelled and are not published.
- **Pumps.** Primary: 2 per train (20), one per running chiller (7) at the unit CHW flow, 15 m; secondary:
  ceil(982.3 / 250) = 4 duty + 1 standby, equal share 245.6 L/s, 30 m; condenser: one per chiller (10 / 7) at the unit
  CDW flow, 25 m. kW_e = ρ g Q H / η_pump / (η_motor × η_VFD) = 28.0 / 98.0 / 82.6 kW per pump; fleet 1,166.4 kW.
  Speed is 100 %: the model has one operating point and it is the design point (affinity laws not exercised).
- **Towers.** One cell per chiller, 0 standby (10 / 7); cell rated = 5,000 × (1 + specific power) = 5,514.0 kW_th (engine 2.5.0), load
  89.3 %, approach 32 − 27 = 5.0 K; fan speed = cell load, fan kW = 55 × speed³ = 39.15 kW, fleet 274.0 kW.
- **CRAH.** Unit duty = hall IT load / running = 7,500 / 58 = 129.31 kW (99.5 %), fan speed = load % (constant air
  ΔT), unit CHW flow 4.06 L/s. No valve position.
- **Mechanical check (engine 2.5.0).** Chillers 3,212.5 + pumps 1,135.6 + tower fans 274.0 = 4,622.1 kW_e against the
  PUE-implied non-IT load 13,500 − UPS loss 1,250 = 12,250 kW: headroom 7,627.9 kW (≥ 0, gated). CRAH fans, lighting and
  controls are not in the 4,622.1. Until 2.4.0 the chillers were 5,153.4 kW (the AHRI rating figure applied at this
  plant's smaller lift); see item 23c.
- **Two existing quantities disagree (reported, not changed — additive release).** `cooling.flow_per_machine_lps`
  (134.7 L/s) divides the IT-only `flow_lps` (943.0), while the machines carry `heat_rejection_kw` (IT + UPS loss) =
  `plant_duty_flow_lps` 982.3 L/s; the new unit evaporator flow uses the duty (140.3 L/s). The CRAH coils, sized on
  hall IT load, pass 943.0 L/s in total: 39.3 L/s (1,250 kW of UPS loss) of chiller duty has no coil in the model.
- **Fleet tables.** `getFleet` kinds `chiller`, `chw_primary_pump`, `chw_secondary_pump`, `cdw_pump`, `tower_cell`,
  `crah` (hall), `genset` (hall, all standby). Units 1…running run (primary: the A pump of trains 1…running), tags
  zero-padded (`CH-01`, `CHWP-01A/B`, `CHWP-S1`, `CDWP-01`, `CT-01`, `CRAH-A01`, `GEN-A1`); Σ running unit duty / flow =
  the plant value; identical on two calls.
- **Lesson kept.** Gates that typed the engine version (`'2.3.0'`, and three stale `'2.2.0'` / `?v=2.0.0` fixtures
  from earlier bumps that had silently become no-ops) now derive it from the engine or the generated registry.
### 2026-11-19 — one cockpit bar (PRD-CONV-EQUIPMENT-TRUTH E7a, PRD-APP-CLARITY §6)

- The nine Conventional pages carry ONE top bar (`js/conv/shell.js`, `css/conv-shell.css`): same slot order, same
  x per slot on every page, empty slots kept at width. Detail and laws: `SITE_CHROME_STANDARD.md` §9.
- A cockpit page never builds its own bar again: new header controls get a `data-cv` slot or go into the page's
  toolbar row.
- Gate: `tools/test-conv-shell.mjs` (in `tools/run-conv-release-gates.sh` through the family filter).

### 2026-11-20 — LV distribution contract (E-S-102, PRD-CONV-EQUIPMENT-TRUTH E5)

- **E-S-102 replaces the legacy LV drawing.** `js/conv/epms-lv.js` (`RZEpmsLv`) builds one sheet per hall through the
  same `RZHmiSheet` pipeline as E-S-101: hall 20 kV ring A and B (each from its E-S-101 feeder, CB-FAn / CB-FBn) →
  hall switchboard MVSB with a normally open bus tie → per stream a distribution transformer, LV main with LSIG trip
  unit, LV main switchboard → UPS (input, rectifier, DC bus with battery breaker and battery, inverter, output, static
  bypass) → rack PDU / RPP boards (A or B cord) and the mechanical + house board. `js/conv/epms-lv-view.js` draws it on
  `EPMS_Telemetry.html`; the old `#viewport` SVG, its zoom buttons, the GEN A/B/C controls and the FEED/STATE legend
  are removed, and `fitScreen()` / `toggleSource()` no longer exist.
- **Repeated items are drawn once with their count from the engine.** "× 5" transformers and LV main switchboards per
  stream (`dist_tx_per_stream_per_hall`, loading shown per unit), "× 500 racks" (`campus.halls[h].racks`), UPS modules
  per hall per stream = `ups_modules_per_system / halls` × `ups_module_kw_rated`. Nothing the engine does not model is
  drawn as a number: the PDU count and battery autonomy say "not modelled"; UPS losses sit in the mechanical load.
- **Gensets are drawn as the engine's topology implies.** Each hall has its own 20 kV generator bus with
  `getFleet('genset', hall)` sets (8 = 7 + 1 spare), one breaker per set and one generator incomer per switchboard
  section. A set's output is limited to `genset_unit_kw × genset_max_loading`. The site total (`genset_count`) and the
  supply chain (150 kV GIS → 20 kV on E-S-101 → hall rings → 400 V) are stated beside the hall selector.
- **Hall selector.** Halls A–D rebind every tag (`TX-<hall><stream>`, `CB-R<hall><stream>` …) and value; each hall keeps
  its own switching state. A ring of a hall is dead whenever its E-S-101 feeder is dead (event `rz-epms-change`).
- **Select before operate.** E-S-102 operates only in two steps in the inspector: Select (nothing moves) → Execute or
  Cancel. Execute without a selection, or after the item changed, is refused in words. Interlocks: the bus tie closes
  only when one section is dead (no paralleling of the rings); a generator incomer closes only onto a dead section with
  its ring incomer open and the generator bus live; a set's breaker closes only on a running set; a set stops only with
  its breaker open. A UPS whose input dies discharges its battery; the battery never back-feeds the rectifier.
- **One status for the page.** `window.RZEpmsStatus.paint` composes the alarm list from both sheets (all four halls of
  E-S-102 + the E-S-101 LV units): a dead ring, a dead board, a UPS on battery, a load not supplied or an overloaded
  source is an alarm; an item away from its normal position is ABNORMAL. A dead feed never shows NORMAL with 0 alarms.
  The bottom total load is the served kW from the solve.
- **Audit findings closed here.** F21: the strip shows "System rating" (modules × module rating, `ups_system_rated_kw`)
  and "System load" (`ups_system_kw`) separately. F23: the TCC from a 150 kV transformer bay plots TX-1 / TX-2
  (`hv_tx_mva`, `hv_tx_impedance_pct`, markers at `mv_tx_fla_a`), from a 20 kV feeder or LV main the distribution
  unit. F24: each view shows one legend (the sheet's own).
- **Inspector text.** E-S-102 payloads use the shared `epms:*` classes of `js/conv/payloads.js`; the five symbols those
  classes do not describe (switchboard, rectifier, inverter, battery, static bypass) get their name and role from the
  `KIND` table in `js/conv/epms-lv-view.js`, and the E-S-101 genset row "not started on this sheet" is replaced there.
  Move them into `payloads.js` when that file is next released (its token sits on every Conventional page).
- **Legibility.** E-S-102 opens at `minScale` 1.17 with the 9 px name / line / label roles set to 9.5 px for this sheet,
  so every rendered label is ≥ 11 px at 1440 and 390; the panel scrolls sideways instead of shrinking the text.
- **Gate.** `tools/test-conv-epms-lv.mjs` (E1–E5 at 1440 and 390, and three planted defects — a genset stubbed off the
  drawing, the status forced NORMAL after a trip, the device handler removed — each of which must turn its law red).
  `tools/test-epms-ats-rack-color.mjs` is retired with the drawing it tested.

### 2026-11-18 — single-line contract (E-S-101, v3.74.0, PRD-CONV-LIVING-PLANT P5a)

- **One governed sheet draws the electrical plant from 150 kV.** `js/conv/epms-sheet.js` (`RZEpmsSheets.sld`, E-S-101) is
  geometry only and is the DEFAULT view of `EPMS_Telemetry.html`; the hand-built LV one-line stays as the second view
  ("LV distribution"). The view buttons carry their own class (`.epms-view-btn`). The first `<svg>` under
  `#epms-sheet-host` is the sheet; the host is pinned `data-theme="dark"` and so is the document-level gradient `<defs>`
  (a dark-only cockpit otherwise shades a light canvas behind dark-theme text).
- **No number is typed in the sheet.** Ratings, voltages, fault levels, the NGR, LVSB and genset counts and the relay
  settings are `electrical.*` engine values written by the page's `read()`; only equipment tags and ANSI device numbers
  are authored. The sheet module carries no literal colour.
- **Positions are a simulation, flows are a solve.** Breaker and switch positions are a deterministic page state
  (`RZEpmsSim.normalState`: both lines in, coupler closed, both transformers in, 20 kV bus tie open, feeders closed,
  generator breakers open, earth switches open, gensets off). Every switching device and transformer is a branch of the
  `js/conv/sld-topology.js` model; loads are the engine's adopted hall facility loads per stream (the typical LV unit takes
  one unit's share). A = kW / (sqrt3 x kV x pf). kW in = kW out at every bus. A conductor with flow is running, an
  energised one without flow standby (via the `rest` argument of `RZConvVfx.bind`), a dead one stopped (grey, dashed).
  The drawn contact of a breaker or switch is its position (`data-pos`, `css/conv-vfx.css`).
- **Dash speed is not a quantity on this sheet.** Every conductor that carries power moves its dashes at the same
  speed; the state colour and dash pattern say whether power flows, and the kW / A / load % chips say how much. Do not
  read a faster or slower line as more or less power.
- **No contradicting chrome.** While the HV / MV view is shown, the legacy LV rail (utility sources, GEN A/B/C) and its
  breaker counters are hidden; the rail lists PLN LINE 1/2 and TX-1/2 with state and load from the solve, the genset
  fleet from the engine, and both breaker counters count E-S-101's own breakers. The LV view shows E-S-102 and its own
  rail (superseded 2026-11-20: the legacy LV chrome is gone, see the E-S-102 entry above).
- **Interlocks refuse in words.** A disconnector moves only with its breaker open; an earthing switch closes only with
  its disconnectors open and the circuit dead; a breaker never closes onto an earthed circuit; 2-out-of-3 on
  incomer-incomer-tie; the generator incomers close only on a running, synchronised generator bus (the gensets are off).
  Operations come only from the inspector's "SIMULATION · Open / Close" button and are re-solved at once.
- **Protection curves are drawn from the engine, never typed.** `js/conv/tcc-modal.js` plots the typical chain (LV main
  LSIG, 20 kV feeder, 20 kV incomer, 150 kV transformer bay) through `js/conv/tcc.js` from `electrical.pro_*`, with the
  3,150 kVA damage curve, the inrush point and the LV-fault / 20 kV-fault markers, each curve with its own dash. The
  coordination table is `tcc.coordinate()` run by the engine's grading rule. Each device curve stops at the largest
  current that device can see (LV main: the LV maximum fault; 20 kV devices: the 20 kV fault level; the 150 kV
  transformer relay: that fault referred through the transformer) and ends in a mark; `tcc.lsig()` keeps applying its
  long-time I²t law above the short-time pickup, so an unclipped LV curve showed a fictitious fall below the 0.2 s
  short-time delay above about 2.4 kA at 20 kV. A relay without an inverse-time stage in the
  engine basis (87L/21, 87B, 50BF, 51G) offers no curve rather than an invented one.
- **Symbol library.** `resistor` (IEC 60617-4, the NGR) was added to `tools/hmi-symbol-defs.py`; nothing existing moved.
- Gates: `node --test tools/test-conv-epms-model.mjs` (normal state, model builder, engine flows, bus balance, interlock
  truth table, N-1 transfer, coordinated chain) and `tools/test-conv-epms-sld.mjs` (browser, 1440 + 390, driven through the
  page's own UI). E-S-101 is in the lists of `test-conv-sheet-text-clear`, `test-conv-geometry`,
  `test-conv-equipment-modal` and `test-conv-payloads`.

### 2026-11-18 — network block contract (v3.72.0, PRD-CONV-LIVING-PLANT §8.3)

- **Every block of a network drawing opens.** Single click or Enter: inspector. Double-click or the inspector's
  "Open device detail": the modal of `RZNetModal` (`js/conv/net-modal.js`). `build()` is pure; a page passes its own
  model (node, adjacent edges with their link-register rows, fault domain, alarms) and never formats the modal itself.
- **Content by device class**: firewall (zones, policy ending in default deny, interfaces), core/access switch (port
  map + connections), gateway (protocol, port, link to its cockpit), router (circuits), all (dependencies, alarms).
- **What is not modelled is said, not drawn.** No session, CPU, hit-count, per-port or optical value appears unless
  the page holds a basis for it. A policy table is labelled design intent.
- **Service ports are the registered ones** (BACnet/IP UDP 47808, Modbus TCP 502, SNMP UDP 161, NTP UDP 123, syslog
  UDP 514, HTTPS TCP 443, SSH TCP 22, RTSP TCP 554, BGP TCP 179); an allow rule without a port fails the gate.
- **An SVG element is not clickable from script.** Keyboard handlers call the page function, never `element.click()`.
- Gates: `test-conv-net-modal.mjs`, `test-conv-ict-modal.mjs`.

### 2026-11-18 — electrical HV/MV, generation and protection basis (engine 2.3.0, v3.70.0)

- **What the family is.** `js/conv-engine.js` 2.3.0 adds flat `electrical.*` keys, additive only (no value that existed
  in 2.2.0 moved): 36 authored inputs (150 kV supply and fault level, 2 x N+1 150/20 kV transformers, 20 kV NGR and bus
  sections, 3,150 kVA 20/0.4 kV units in A/B streams, 3 MW gensets at 80 % loading N+1 per hall, relay pickups, curves,
  steps and range) and derived values: demand, transformer rating, FLA and loading, 20 kV and LV fault levels, NGR
  earth-fault current, distribution transformer and genset counts with their contingency loading and N-1 margin.
  Every authored value carries a source comment and an evidence class; they are ASSUMED training design values
  (150 kV ADOPTED, IEC 60076-5 impedance STANDARD). Curated metadata lives in `data/conv-parameters.curated.json`.
- **Transformer sizing basis.** The 150/20 kV units are sized on the LARGER of the full design demand
  (`electrical.demand_design_mva` = site IT design x PUE / pf = 61.05 MVA) and the adopted demand plus growth margin
  (54.95 MVA), published as `electrical.hv_tx_sizing_mva`, then rounded up to an IEC 60076-1 preferred (R10) rating
  (31.5 / 40 / 50 / 63 / 80 / 100 MVA): 2 x 63 MVA. Sizing on the adopted load alone gave 60 MVA, which would carry
  101.8 % with one unit lost at design load; `electrical.hv_tx_load_pct_n1_design` (96.9 %) is now gated <= 100 %.
- **Settings are training values, not a relay study.** The published LSIG, 20 kV feeder 51/50, 20 kV incomer 51 and
  150 kV transformer-feeder 51 settings exist so the SLD and TCC modal draw curves from engine parameters (PRD §8.2
  K3). They must never be used to set a real relay.
- **Grading rule.** IEC 60255-151 curves, with the conventions of `js/conv/tcc.js` (pickup above 1.05 x Is, flat
  above 20 x Is). Each TMS is the smallest multiple of `electrical.pro_tms_step` whose operating time meets EVERY
  grading point (downstream time there + `electrical.pro_grading_margin_s`, 0.3 s), and must not exceed
  `electrical.pro_tms_max` (1.5). Feeder: (i) just below the LV short-time pickup (4 x Ir referred to 20 kV) over the
  LV long-time band (`electrical.pro_lv_tr_s` 4 s at 6 x Ir, so 9 s there), (ii) at the LV through-fault over the
  0.2 s short-time delay; incomer over the feeder instantaneous at the 20 kV fault; 150 kV relay over the incomer at
  that fault referred to 150 kV. The feeder instantaneous sits at 1.3 x the LV through-fault, and the inrush point
  (12 x FLA, 0.1 s) must lie below the feeder curve.
- **Why the feeder is extremely inverse.** The LV main long-time band is I²t-shaped (t ∝ 1/I²). A standard-inverse
  relay is almost flat by comparison: graded at the LV fault, it crossed the long-time band near 2.3 x Ir with a
  negative margin for any long-time delay above about 0.25 s. Only an I²-shaped relay curve (EI, `pro_feeder_curve`)
  can stay above the band from the long-time region up to the short-time pickup, and it also stays below the
  transformer through-fault damage curve. Incomer and 150 kV relays stay standard inverse.
- Gate: `node --test tools/test-conv-electrical-hvmv.mjs` — expected values recomputed from the authored inputs,
  N-1 loading at adopted and design demand, LV fault <= 65 kA and 20 kV fault <= 25 kA, the smallest-step rule (one
  step lower fails a grading point) and TMS <= range, and an independent cross-check through `js/conv/tcc.js`: full
  chain WITH the long-time stage via `coordinate()`, a 16-point feeder-over-LV sweep, the damage curve, and planted
  defects (feeder back to SI, feeder TMS one step lower, a halved upstream TMS) that must be reported.

### 2026-11-18 — air section contract (v3.69.0, PRD-CONV-LIVING-PLANT P3 data hall)

- **One module draws an air path:** `RZAirSection` (`js/conv/air-section.js`). `model()` is pure: values in, periods
  and colours out. A page never animates air by hand.
- **Bindings.** Streamline period = `RZConvVfx.dashSeconds(airflow / design airflow)`; fan period =
  `rotorSeconds(fan %)`; colour = `thermal(temperature, 24, 40)` for air and `thermal(t, 16, 30)` for the
  chilled-water stubs (display ranges, declared on the page); rack tint = row heat / row rating. No airflow or no
  running CRAH means no motion, a still fan and dashed grey lines.
- **A section restates, it does not invent.** Each reading equals the value the plan shows for the selected row or an
  engine plane; the gate compares the section text with the plan footer for three rows.
- **A physical section is not a block diagram.** Its geometry is one authored cut inside the module; block diagrams
  still go through `RZDiagram`.
- **Row footers are labelled.** A key column names each footer line and its unit; a number without a name on the same
  line is a defect.
- **Stage views obey the authority rule:** the Plan / Air path buttons are disabled with the other controls when the
  engine snapshot is missing.
- Gates: `test-conv-air-section.mjs`, `test-conv-datahall-air.mjs`.

### 2026-11-18 — line state and motion contract (v3.67.0, PRD-CONV-LIVING-PLANT P1/P2)

- **A line is painted by its own state.** On a governed P&ID sheet the pipe body carries `data-vstate` from
  `RZConvVfx.apply()`: running, warning, alarm, standby, stopped, mismatch, unavailable. The state comes from the
  page's own flow function and the alarm or mismatch at the line's ends; a page never colours a line by hand.
- **Colour is never the only signal.** Every non-running state has its own dash pattern; standby is solid in the
  standby colour.
- **Motion is a measurement.** Dash period = `dashSeconds(flow / design)`; rotor period = `rotorSeconds(speed %)`.
  A stopped, standby or no-data line shows no moving dashes. `prefers-reduced-motion` removes the animation only.
- **Standby needs evidence.** A no-flow line reads standby only when the page states why it is held ready
  (fire: header pressure above the low alarm; N2: not released). Without that it is stopped.
- **A calculated flow reference is not a meter.** A line that follows a calculated branch reference also needs a
  proven mover: a chiller train with neither pump proven running is stopped.
- **Thermal view** is offered only on a sheet with temperature points, and only running lines take a temperature colour.
- **Trend.** A reading that has a trend definition opens `RZTrend`; the history is `RZConvHistory` (deterministic,
  labelled SIMULATED). A page loads `js/conv/history.js` + `js/rz-trend.js`; it does not build its own trend.
- **Lessons.** A probe placed on `<body>` read the wrong theme token because the sheet host pins its own theme;
  a download anchor clicked on `<body>` counted as an outside click and closed the inspector; removing a colour rule
  for no-flow lines exposed the medium colour underneath, so the neutral colour is set explicitly.
- Gates: `test-conv-vfx-core`, `test-conv-history`, `test-conv-vfx-trend`, `test-conv-vfx-sheets` (ship gate).

### 2026-11-17 — equipment inspection contract (v3.66.0, PRD-CONV-LIVING-PLANT P0)

- **Every tagged symbol opens.** A click (or Enter) on a tagged symbol of a governed sheet opens the right-side
  inspector; "Open equipment HMI" or a double-click opens the equipment modal. A pointer cursor without an action
  is a defect.
- **One builder, one modal.** Payloads come from `js/conv/payloads.js` (class table); pages do not hand-build
  inspector rows. A page with richer engine reads passes them through `RZConvPayloads.merge()`. The modal is
  `js/conv/equipment-modal.js`; no page adds its own.
- **Six tabs, none empty.** LIVE ≥ 4 rows; CAPACITY from the registry; DEPS from the drawing's own edges; ALARMS =
  active events plus the configured alarm points; TREND = 60 seeded ticks with a reference line; MAINT = task,
  interval, standard, and a last-test line labelled TRAINING RECORD.
- **Every row is traced.** `basis` (registry id, evidence mark, opens the basis drawer), or `sim: true` (visible SIM
  mark), or `declared` (≥ 40 characters). A basis id that does not resolve prints UNAVAILABLE and fails the gate.
- **A modal never repeats the sheet it was opened from.**
- **Lesson.** The audit-state harness strips `inert` through its auth-blocker observer, so a gate that reads `inert`
  reports the harness. The modal marks what it inerted with `data-rz-cvm-inert`; the gate reads that.
- **Lesson.** A panel that slides out still receives pointer events during the slide; the next tap lands on it.
  Closed panels get `pointer-events: none`.
- Gates: `test-conv-payloads.mjs`, `test-conv-equipment-modal.mjs`, `test-conv-depth.mjs` (ratchet,
  `tools/conv-depth-thresholds.json`: numbers only rise), `test-conv-modal-no-self-repeat.mjs`.

### 2026-08-30 — operator cockpit truth, scope and responsive reachability

| Symptom | Root cause | Decision / prevention | Reusable lesson |
|---|---|---|---|
| Rack inlets at 25.4 °C rendered amber even though they sat on the project setpoint and inside 18–27 °C. | The default field and legend inherited power-utilisation bands instead of thermal semantics. | Open on the rack-inlet layer and map 18–27 °C inclusive to normal green; retain explicit cold/hot escalation bands. | A color threshold belongs to the displayed quantity, not the cell component. |
| “Balance vs EPMS” showed −22.5 MW, then an attempted fix showed a circular green +0 kW. | A 30 MW campus UPS meter was compared to one 7.5 MW hall, then divided by four without a governed hall submeter. | Hall reconciliation is `UNAVAILABLE`; equal allocation is labeled planning reference only. | Normalize scope before arithmetic, and do not upgrade an estimate into evidence. |
| Chiller values were correct at first paint but collapsed to the retired temperature range after 1.2 seconds. | Only initialization used the engine-derived envelope; normal and forced simulation branches retained fixed clamps. | Use one current-basis flow/temperature envelope in every branch and wait through a tick in the gate. | First paint cannot prove a continuously updated operator surface. |
| Water treatment exposed Hall A–D selection and per-hall values despite being one municipal/site plant. | View-context controls were copied from hall-owned subsystems. | Keep the plant site-wide and fail closed on non-metered hall allocation. | A shared header pattern cannot override physical system ownership. |
| Fire authority loss removed some numbers but left healthy pump/path/N₂ semantics. | Fail-closed handling covered cards, not every duplicated SVG and path consumer. | Gate all 13 semantic paths plus banners, logs, tooltips and interlocks against the same authority. | Every duplicated visual consumer is an independent evidence surface. |
| The AI header looked correct at 1920 px but clipped cockpit content at 1440/390 px. | The content height assumed fixed 44+36 px chrome while the header wrapped. | Use a flex-column viewport with dedicated horizontally scrolling control rails and internal content scroll ownership. | Responsive acceptance proves reachability, not merely lack of horizontal overflow. |
| A same-version partial bundle passed a shallow existence check, then left old values in first paint, tooltips or hidden drawers. | Version equality was treated as schema completeness and duplicated consumers had separate fallbacks. | Pin the governed version, validate the complete page schema and default every visible, hidden and programmatic consumer to `UNAVAILABLE`. | Version, schema and consumer fan-out are three separate authority gates. |
| The 943.0 L/s IT reference, 31,250 kW evaporator duty and condenser heat rejection were described as one measured plant quantity. | A compatibility key named `heat_rejection_kw` and an IT-only flow formula leaked into operator labels. | Label 943.0 L/s as IT reference, 982.3 L/s as plant-duty reference, and 36,403.4 kW as condenser/tower rejection; measured flow remains unavailable. | API names are not permission to collapse distinct thermodynamic planes. |
| A calculated 943.0 L/s reference was labeled MFM/header flow and was reused to calculate plant COP. | The simulation had no governed flow-meter point, but presentation upgraded a formula result into measured telemetry. | Mark both flow values `CALCULATED · NOT METERED`, leave actual MFM/header flow `UNAVAILABLE`, and bind COP/kWRT only to governed engine efficiency fields. | A calculation may support a design reference; it cannot impersonate a field instrument or become an independent efficiency measurement. |
| The plant mimic advertised 5.25 MW per chiller, 52.5 MW capacity and 21.25 MW margin. | Equipment rating literals were added independently of the governed current capacity model. | Bind the operator surface to 35 MW running capacity, 45 MW N+1 capacity and 13.75 MW N+1 margin; omit any per-unit rating that the authority does not provide. | Capacity labels must share one authority and one redundancy state; plausible arithmetic is not evidence. |
| Shared basis drawers became unavailable even on healthy pages after fail-closed hardening. | The shared component default-denied correctly, but adopting hosts did not publish a validated opt-in signal. | Every host sets `data-rz-basis-authority=current` only after its own complete authority validator passes; browser gates cover healthy and hostile fixtures. | A fail-closed shared component needs an explicit, tested success handshake. |
| ICT and EPMS set an unavailable body flag while still painting GOOD/NORMAL/ONLINE, energized paths and invalid null/NaN telemetry. | Authority validation was cosmetic; initialization and scheduled render loops continued against partial state. | Begin neutral, validate the complete v2 schema, and withhold topology, process state, controls, exports, timers and hidden consumers until authority is current. | A body attribute is not fail-close unless it governs every renderer and interaction path. |
| The shared banner still said simulated telemetry was engine-derived after the governing engine failed. | Page data mode and authority state were evaluated independently. | Authority loss takes precedence over simulated mode and renders `COMMS LOST — AUTHORITY UNAVAILABLE`; AI and Conventional authority attributes are both recognized. | Provenance is a state hierarchy: unavailable authority outranks the source-mode label. |
| Same-version ICT, EPMS and Fuel fixtures with blank scenario or quality strings still painted healthy and advanced timestamps. | Schema checks verified property presence but not semantic content, while update timers were independent. | Trim and require both provenance fields; block all render/update timers until complete authority validates. | Present-but-empty metadata is unavailable evidence, not a valid string. |
| Water showed `Limit < 500` under filter differential pressure and `Backwash > 0.80` under treated TDS. | Two correct limits were bound to the wrong KPI captions. | Bind every threshold to its owning tag and assert first-paint plus runtime label/value pairs. | A correct number on the wrong instrument is still wrong telemetry. |
| EPMS used red for a healthy selected Feed A and also for trip, while context strips overlapped the SLD at some widths. | Source identity, equipment state and fixed-height layout assumptions were conflated. | Separate feed identity from energized/open/tripped encoding and derive the SLD viewport from measured chrome height. | Redundancy identity and alarm state require independent channels; dense HMI geometry must be measured, not guessed. |
| Fire showed a reserve deficit beside a normal FACP without explaining the distinction, and generic plus signs impersonated pump symbols. | Hydraulic design adequacy and fire-alarm panel health shared one visual state, while schematic symbols were placeholders. | Keep FACP normal explicit, show the independent reserve deficit in amber, use centrifugal-pump symbols and gate both from the same governed shortfall boolean. | A design shortfall is not permission to invent an active fire supervisory alarm. |
| A healthy Chiller loop opened with a false high-delta-T diagnostic. | The detail modal retained the retired 2.5–4.8 K envelope after the operating basis moved to 7.6 K. | Derive guidance from the governed design delta-T with a documented tolerance and browser-test the healthy modal. | Hidden diagnostics are current-value consumers and need the same rebaseline as headline KPIs. |
| PUE narrative called 1.45 measured or observed even though it is an adopted simulation input. | A design-point assumption was described with field-telemetry language. | Label it adopted simulated design-point PUE, keep the target separate and fail closed off-design without a governed curve. | Formula correctness cannot repair misleading evidence terminology. |
| Fuel and Data Hall mobile cards created implicit columns, and process effects kept moving for reduced-motion users. | Desktop grid spans and decorative animation rules survived the responsive/accessibility breakpoint. | Reset spans at phone widths and disable all nonessential/process animation under reduced motion while preserving static states. | Responsive and motion contracts must cover dynamically inserted elements as well as first paint. |
| Fire displayed a 7,200 m³ site rack-footprint estimate as “protected hall volume.” | A campus rack-count proxy was given an enclosure-safety label despite lacking surveyed geometry. | Label it a non-sizing site rack-footprint proxy and keep protected-volume sizing outside the cockpit authority. | A contextual estimate must not inherit a safety-critical measurement name. |
| The Fire jockey semantic line said 7.5 bar while the governed static state and displayed setpoints were 12.5 and 11.5/12.8 bar. | One SVG metadata literal bypassed the pressure state machine. | Generate the semantic-line value from the same governed pressure state as the gauge and alarm strip. | Tooltip and line metadata are telemetry consumers, not decorative copy. |
| The Water Manual said every process value came from the engine. | Site-balance authority and deterministic page-authored treatment simulation were collapsed into one provenance claim. | Name both authority classes explicitly and assert the boundary in document parity tests. | Documentation provenance must be at least as precise as runtime provenance. |
| Fuel content remained clipped on phones even though horizontal overflow read zero. | `overflow-x:hidden` concealed a grid child wider than the viewport, making a superficial overflow probe pass. | Bound every direct column and panel, then assert their rendered edges are inside the viewport. | Zero scroll overflow does not prove content is visible; test child geometry. |
| Design Studio browser coverage passed locally but was absent from the release workflow. | The dashboard authority gate checked enablement, not the three document bodies, TOCs and export path. | Add the full browser regression to `ship-gate.sh`. | A regression test protects releases only when the release gate actually invokes it. |
| The healthy Chiller modal intermittently reported elevated pump vibration. | A random 4% duty-pump swap could start the standby pump at minimum speed between render and inspection. | Use a reproducible simulation generator and permit duty changeover only when the modeled vibration threshold is crossed. | Alarm and first-out state may be simulated, but it must never depend on reload luck. |
| A visual audit could pass a generic `<main>` page and silently delete an unrelated feature modal. | Authorization setup used broad surface classes and the shared `.rz-modal-overlay` class instead of route identity and auth ownership. | Give every cockpit one unique `data-rz-cockpit-root`, remove only exact auth overlay IDs, preserve feature dialogs, and exit non-zero after saving error/missing-capture evidence. | An audit bypass is test infrastructure with a security boundary; broad selectors can manufacture false evidence. |
| Localhost avoided a new geo request but still recorded a stale production-like IP/city from session cache. | The cache was trusted before the local-runtime privacy branch. | Detect local/file runtime first, delete the stale cache, then install the blank deterministic fallback; seed hostile cache data in the browser regression. | “No network call” is not sufficient privacy proof when cached identity can leak into new events. |
| The Conventional landing header still looked like a glowing SaaS toolbar and its phone alarm strip consumed half-empty rows. | Blur, gradients, pill/pulse styling and flex percentage widths survived the cockpit standardization pass; numeric OpenType features were not inherited consistently. | Use flat solid controls, restrained radii, no idle motion, explicit tabular/slashed-zero numerics and a three-column phone alarm grid. | Industrial density requires measured information hierarchy, not decorative status chrome or wasted grid area. |

### 2026-08-29 — canonical drawer and scope-aware accuracy probes

| Symptom | Root cause | Decision / prevention | Reusable lesson |
|---|---|---|---|
| The release gate reported missing basis drawers after all registry coverage gates passed. | The browser probe still queried the retired `data-basis` selectors and page-local `#kpiBasisDrawer`, while engine-backed KPIs had moved to `data-basis-param` and `#rz-basis-drawer`. | Map each KPI to its owning drawer contract and assert the shared semantic fields: Formula where declared, Result, Source and Evidence. | A test selector is part of a component contract; migrate it with the component and do not restore duplicate legacy markup merely to satisfy a stale probe. |
| Cross-page IT reconciliation expected 30 MW on both the campus overview and a selected hall. | The test compared unlike scopes and froze a retired display literal. | Read campus IT, per-hall IT and hall count from `CONV_CALC.snapshot`; assert `campus = hall × hall_count`. | Cross-page equality is valid only after unit and scope normalization. |
| The runtime cockpit was correct while fallback HTML, Tech Spec, PRD and Manual still described the retired 1.85 MW scenario; the PDF gate remained green. | Generated-document assertions searched the entire HTML for old numbers, so stale narrative text satisfied them. Documentation parity was not part of the gate. | Verify labeled output rows against current engine values and gate both public documents for the same dependent-value set. | Runtime binding, fallback markup and generated/public documentation are separate consumers; every one needs a scope-aware parity assertion. |
| The generated WUE calculation returned 600.0 L/min but its source note still said it matched 37 L/min. | The result was engine-derived while the explanatory string survived from the retired scenario. | Assert the labeled WUE output and reject every retired dependent value in Manual/PRD parity checks. | Correct arithmetic is not sufficient when its provenance text describes another scope. |
| A browser-only surface assertion passed after `updateData()` even when raw HTML still carried a stale fallback. | The engine overwrote first-paint markup before the probe read it. | Parse raw HTML before script execution, then independently assert initialized runtime surfaces; include adversarial retirement fixtures for both 58.1 and 58.2 L/s rounding variants. | First paint and runtime are separate observable states and need separate gates. |
| Uptime correctly failed closed but its drawer output retained the healthy-green result style. | Evidence state and visual state were built independently. | Bind output treatment to evidence mode; `UNAVAILABLE` uses amber/neutral and cannot reuse success green. | Color is part of the evidence contract in an operator interface. |
| Documentation called the comparison scope `current-plus-design` while the shared controller accepted only `current-plus-study`. | Narrative terminology drifted from the executable enum. | Standardize code, PRD, Manual and generated document control on the shared identifier and describe it as a planning study. | A public scope name is an API contract and must be tested literally. |

### 2026-08-27 — four-hall study and subsystem operator hardening

| Symptom | Root cause | Decision / prevention | Reusable lesson |
|---|---|---|---|
| 10 MW hall was paired with 200 racks, implying 50 kW/rack while the page described conventional air cooling. | Capacity, rack density and cooling technology were independent literals. | Freeze one reconciled study; select 500 racks/hall at 20 kW average; block incompatible density through unit tests. | A capacity brief is incomplete until rack density and thermal contract reconcile. |
| 25.4 °C was being described as the universal standard. | A project target was conflated with an equipment envelope. | Label 25.4 °C as project target and retain the cited 18–27 °C recommended envelope. | Target, recommended envelope and allowable envelope are three different facts. |
| PUE could be multiplied at any study load. | One design ratio was treated as a part-load curve. | Restrict dPUE to the design point; fail closed off-design without an approved curve. | Never manufacture efficiency behavior by extending one point. |
| Dense SCADA pages exposed state through decorative color/animation and inconsistent layouts. | Page-specific literals had no shared operator contract. | Standardize hierarchy, evaluated motion, hall context, inspectors and responsive gates while preserving process logic. | Preserve topology, but derive presentation from semantic state. |
| Alarm panels lacked operational search by date, point, state and value. | Alarm summary and history were treated as the same widget. | Add a read-only historian query contract without mutating live KPI ownership. | Historical analysis and live alarming require separate, explicit state owners. |
| A blocked 200-rack air-cooled study could still return a design facility load. | `evaluateLoad()` reconciled the study but did not consume its readiness verdict. | Return `unavailable` before calculating any facility value; validate unique halls, integer racks, ordered thermal envelope, target, air specific heat and the exact resilience contract. | Validation is useful only when every downstream calculator consumes the verdict. |
| Historian fixture records used `active_*` lifecycle beside unrelated live strips. | Capture-time lifecycle and current alarm state were not distinguished in the UI. | Label lifecycle as “at capture,” identify the training run, preserve source provenance and call counts “active-at-capture.” | Historical event state must never masquerade as current operational state. |
| Mobile Alarm History exposed filters but hid results and export below an overflow-clipped dialog. | A desktop grid used `overflow:hidden` while the one-column phone form exceeded the viewport. | Make the phone dialog the vertical scroll owner, retain a horizontally scrollable results region, and browser-test that results/footer are reachable. | Responsive modal tests must prove the last action is reachable, not only that the outer rectangle fits. |
| Alarm launchers overlaid P&amp;IDs, disappeared with a hidden mobile header, or sat several viewports away in EPMS. | A selector list returned the first matching ancestor in document order; explicit slots did not receive priority and some pages fell back to a fixed button. | Query the explicit slot separately before legacy fallbacks, provide one in-flow slot on all eight pages and enforce a 44 px visible first-viewport target. | Selector-list order is not query priority; critical controls need an explicit mount contract and rendered geometry test. |
| The auth bootstrap inserted a login pill inside the historian title row. | The modal used a generic semantic `header` element that matched the legacy auth fallback. | Use a dialog-local `div` title row and assert no auth wrapper is a descendant of the modal. | Shared bootstrap selectors can cross component boundaries; use narrow mount points and adversarial DOM assertions. |
| A non-live telemetry banner covered top or bottom controls on phones. | Provenance was viewport-fixed, so moving it only changed which interaction plane it obscured. | Mount the dismissible banner in an explicit document-flow slot immediately after the page header and verify its rectangle clears that header. | Persistent provenance needs reserved layout space, not a different fixed edge. |
| EPMS mobile showed its 320 px control sidebar and left almost no usable SLD. | Fit math always subtracted a desktop constant and the sidebar had no mobile lifecycle. | Default the sidebar to a keyboard-accessible overlay drawer below 768 px; derive desktop fit from rendered sidebar width and reserve the full mobile viewport for the SLD. | Dense controls may overlay temporarily, but primary process truth must remain readable by default. |
| Conventional overview identity moved offscreen after adding Alarm History. | Five controls and the H1 shared one fixed-height, non-wrapping row. | Keep identity in the first mobile row and place actions in a separate 44 px horizontal rail. | Page identity is not an expendable responsive element. |
| Historian data was visually dense but lacked table semantics and RZ numeric/state discipline. | Generated headers had no scope, the table had no caption and severity colors bypassed shared tokens. | Add a visually hidden caption, scoped columns, tabular/slashed-zero numerics and RZ signal/alert tokens. | Operator density and accessibility must be designed together. |
| Provenance passed geometry checks but its close control was tiny, still pulsed under reduced-motion and became unreadable in the AI light theme. | The shared banner treated compact appearance as a substitute for interaction, motion and contrast contracts. | Enforce a 44 px dismiss target, signal-amber focus, reduced-motion overrides and theme-specific semantic foreground/background pairs in the runtime gate. | A non-overlapping component can still fail accessibility in three independent ways. |
| EPMS and overview controls looked prioritized on phones but Tab followed a different sequence; EPMS document links were also 66 px and clipped above the rail. | CSS `order` changed presentation without changing DOM order, and the auth bootstrap moved public links to a body-end layer. | Reorder source DOM, normalize every EPMS target to a contained 44 px, scroll focused rail items into view, and insert the unrestricted public-contract layer before the protected header. | Responsive priority is only valid when geometry, DOM order and actual keyboard traversal agree. |

## 11. Reference direction

- [ASHRAE Handbook, Data Centers and Telecommunication Facilities](https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch20/a23_ch20_si.aspx)
- [ISO/IEC 30134-2:2026 — PUE](https://www.iso.org/standard/30134-2?browse=ics)
- [Uptime Institute Tier Certification](https://connect.uptimeinstitute.com/tier-certification)
- ISA-5.1, ISA-18.2 / IEC 62682, NFPA 72/75/2001, ASHRAE 90.4 and the applicable
  electrical, fire, water and network authority documents.

References define terminology and design direction. This simulated cockpit does not claim
certification, code compliance or authority-having-jurisdiction approval.

### 2026-11-21 — fuel-system, water-system, fire-system carry points (PRD-CONV-POINT-STATUS-TREND T2/T3, second wave)

The marking rules above hold unchanged; what the three pages add:

- **A page's typed bounds became registry rows** (all ASSUMED, migrated from the page): water `evalThresholds()` and the
  sheet alarm marks read `RZPointStatus.limits('water.*')` (raw tank, domestic tank, filter DP, TDS, UV, WUE); fire
  `TANK_LOW_PCT / TANK_LL_PCT` read `fire.level_pct`; fuel PASS/FAIL of the 24 h SLA reads `fuel-system.sla_margin_hr`.
  A threshold LINE ("Backwash > 0.80 bar") is a constant: neutral, its number comes from the same row.
- **Per-set day tanks** (`fuel-system.DT-<set>.level_pct`) inherit `fuel-system.DT.level_pct` through `limitsOf` +
  `PS.define` (`ptDefineUnits`, re-run on `rz-point-limits`); tables and rows that the page rebuilds every scan go
  through `ptPaint` so the trends are registered once.
- **A threshold line or record is not a reading:** alarm-list messages, scope-card text, rating lines and setpoints
  (jockey / FP start pressures) are `data-const`. A number a page used to colour by its own band (`pf-*`, `.th.ok`,
  `.metric-val.warn` by value) lost that colour: the state is the point's.
- STRICT in `tools/test-conv-point-coverage.mjs`: chiller-plant, cdu-mini-bms, fuel-system, water-system, fire-system.
