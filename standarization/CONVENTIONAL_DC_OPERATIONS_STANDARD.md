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

### Chiller

CHWS/CHWR, delta-T, labeled reference/measured-flow state, plant load, available capacity, N+1 margin,
COP/kW-per-ton basis, DP, valve/pump states, lead-lag sequence, current/study separation,
Hall A–D selector and equipment diagnostics.
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

### Fuel

Bulk/day tank gross and usable inventory, consumption/autonomy basis, transfer duty/standby,
polishing state and differential pressure, water-in-fuel, delivery/fill state, leak/sump zones,
isolation and N+1 consequence. A fixed burn rate is a declared current assumption, never a
vendor-curve substitute for the 40 MW study.

### Water

Raw/treated storage, duty/standby pumps, filtration differential pressure, dosing, UV,
conductivity/TDS, cooling makeup, evaporation, blowdown, drift, domestic split, drain/leak and
maintenance state. Current WUE-equivalent flow is not relabeled as a measured instantaneous flow.
Municipal/raw-water treatment is a site utility in this topology, not four duplicated hall plants.
It has no Hall A–D selector. A per-hall allocation remains `UNAVAILABLE` unless governed branch
metering exists; an equal division is not telemetry.

### ICT / OT

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

## 10. Change and lesson ledger

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
