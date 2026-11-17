# DC Conventional family — execution plan (rev 2, 2026-11-17)

Closes every row of `CONV_TOTAL_AUDIT_2026-11-16.md` (§2–§5 and the §7 depth rows). Written for two
executors: **Opus** (main session or Opus subagent) and **Ark** (BytePlus `glm-5.2` subagent through
claude-hybrid). An executor reads §1 (protocol), then its own work package (WP). Nothing else is
needed.

Rev 2 puts **depth first**. The owner's complaint was modal, traceability and tooltip, and the
measurement agrees. Fire and fuel open an inspector on every symbol, but 38 of 40 open to a title
and one row. Chiller ignores 25 of 29 clicks. EPMS and cdu-mini-bms open nothing. Seven of nine pages
show a traceability mark on fewer than one number in five, and seven pages have tooltips on fewer
than one label in ten. The engine corrections (old W2) still ship, but after the depth layer, because
the payload builder is what carries their numbers to the operator.

---

## 0. The target — what the operator gets on every conventional cockpit

| layer | contract | measured by |
|---|---|---|
| **Click** | Every tagged item on every drawing (P&ID symbol, SLD device, ICT node, rack, CDU part) opens the right-side inspector. No pointer cursor without an action. | `test-conv-depth.mjs` M: opened = tagged |
| **Inspector** | Six tabs, all populated. LIVE: state, role, command/feedback, the item's process values with quality, timestamp and source (≥ 4 rows). CAPACITY: rating, load, % and redundancy margin from the engine. DEPS: upstream/downstream items, clickable. ALARMS: events for this asset with ISA lifecycle. TREND: 60-point series (engine plane as a reference line; simulated series declared). MAINT: declared test/inspection interval and last-test record, with the standard it comes from. | depth I: LIVE ≥ 4, ≥ 5/6 tabs |
| **Deep modal** | "Open HMI" in the inspector, or a double-click, opens the equipment modal: a mini-mimic of the item, every reading with a traceability mark, a trend, the operator guidance, and the design basis. One modal shell for all classes. | depth M + `test-conv-equipment-modal.mjs` (new) |
| **Traceability** | Every engine number carries `data-basis-param` and a visible evidence mark, and a click opens the basis drawer. Every simulated number carries a visible `SIM` mark. No bare numbers. This applies on the page, in the inspector and in the modal. | depth T + hook-aware `test-conv-coverage.mjs --strict` |
| **Tooltip** | Every KPI label, column header, equipment tag class, unit and abbreviation has an `rz-explain` entry. SVG symbols carry a `<title>`. Labels ≥ 95 %. | depth H |

---

## 1. Executor protocol (every WP, every executor)

1. **Worktree**: create your own from fresh `origin/main` with `git worktree add ~/.cache/rz-<wp> origin/main`. Name the branch `wp/<id>`. Never edit `~/rz-work` or another session's tree. Never `git add -A` on a shared tree; stage by path.
2. **Scope fence**: do not edit `datahallAI.html`, `js/datahall-ai/*`, `prd/datahallai.html` or `manual/datahallai.html` (LTC session), except for mechanical `?v=` tokens. `js/rz-inspector.js`, `js/rz-hmi-sheet.js` and `js/rz-svg-basis.js` are shared with datahallAI. Change them additively only, and run LTC's `test-datahall-ai-inspector-runtime.mjs` before you hand back.
3. **Browser jobs**: `export TMPDIR=$HOME/.cache/qa-tmp`. Run every Puppeteer job as `timeout N rz-lane -l 1|2 -t N -- $(command -v node) tools/<gate>.mjs`. Lane 3 belongs to LTC. Never `pkill -f`, and never kill a chrome or server you did not start. A local server binds a free port, never 8166 or 8081.
4. **Laws → proof**: run the WP's RED command first and keep the decisive line. After the change, run the same command GREEN. A new gate must fail on the old tree, or on a planted defect, before you trust it.
5. **Engine**: if you touch `js/conv-engine.js`, bump `version` and `js/rz-engine-versions.js` `conv` together, then run `node tools/test-conv-engine-version-pins.mjs`. A pin mismatch blanks all 8 cockpits silently. Regenerate the registry only with `node tools/build-conv-parameter-registry.mjs`.
6. **Explain DB**: never edit `js/rz-explain-db.js` (it is generated). Add entries to `tools/explain-conv.json` (new), register that file in `tools/build-explain-db.py`, then run `python3 tools/build-explain-db.py`.
7. **Scripted edits**: Python `re.sub` with a lambda replacement. Afterwards `grep -caP "\x00" <file>` must print 0 and `python3 tools/audit-js-syntax.py --strict` must say CLEAN.
8. **Look**: for every visual change, capture a screenshot at 390 and 1440 in both themes and look at it. A gate number is not enough.
9. **Hand-back (Ark)**: return the diff stat, each law with its RED line and GREEN line, and the paths of the screenshots you looked at. Do not commit to `main` and do not push.
10. **Release (Opus main session only)**: in one commit, update `js/rz-version.js`, `sw.js`, regenerate `changelog.html`, refresh cache tokens and update `CHANGELOG.md`. Run `bash tools/ship-gate.sh` (resume with `RZ_GATE_FROM=N`). Push with `git push origin HEAD:main` over the SSH deploy key, never with a token. Then verify the Pages deploy and the live `js/rz-version.js`. Standards docs change in the same release as the code.

---

## 2. Routing and order

| wave | WP | executor | output | release |
|---|---|---|---|---|
| W0 | G1 geometry gate fails instead of hanging | Opus | gate | v3.64.0 |
| W0 | GD depth + coverage gates made hook-aware | Opus | gates (MONITOR) | v3.64.0 |
| **W1** | **D-1 payload builder + inspector shell** | **Opus** | `js/conv/payloads.js`, Node test | v3.64.0 |
| **W1** | **D-2 chiller reference page** | **Opus** | the pattern every other page copies | v3.64.0 |
| **W2** | **D-3 replicate to fire, fuel, water, ICT, EPMS, datahall, cdu-mini, dc-conventional** | **Ark ×2 parallel, one page per brief** (§9 briefs) | per-page wiring | v3.65.0 |
| **W2** | **D-4 traceability sweep** (hook + mark every number) | Ark per page, Opus review | | v3.65.0 |
| **W2** | **D-5 tooltip corpus** (`tools/explain-conv.json`) | Ark drafts the entries, Opus checks the engineering | | v3.65.0 |
| W3 | F-1…F-5 page fixes (old W1: shared defects, state honesty, labels, contrast, readable drawings) | Ark | | v3.66.0 |
| W4 | E-1…E-5 engine truth (gensets, transformers, WUE, CRAH, PUE, fire hydraulics, ICT) | Opus | engine 2.3.0 | v3.67.0 MINOR |
| W5 | H-1…H-3 hardening (split builders, gate coherence, pixel contrast) | Ark / Opus | | v3.67.x |

Order rationale:
- D before E: payloads read the engine, so the corrected engine numbers reach every inspector and modal with no second pass.
- F after D: D rewrites the same click and label code, so fixing those pages first would mean editing them twice.

At most two executors run at once (token budget), and at most two browser lanes (thermal limit).

---

## 3. Architecture decisions (D-1 builds them; everyone else uses them)

- **AD1. One payload builder.** `js/conv/payloads.js` is a DOM-free dual-target IIFE (same idiom as `js/conv/sheet-truth.js`), and Node can test it. Its API is `payload(classId, id, ctx)`, where `ctx = {snapshot, truth, alarms, basis, tick, page, hall}`.
  - It replaces the `build()` in `sheet-truth.js:100-140` (which keeps a thin shim so callers do not break) and the inline builder in `water-system.html:900-930`.
  - It never returns an empty tab. A tab with nothing real states why: `{ unavailable: 'no governed meter — header flow UNAVAILABLE' }`.
- **AD2. A class table, not per-page code.** `CLASSES` maps a symbol class to its tab recipes. The symbol classes in the sheets today are: `chillerWater`, `pumpCentrifugal`, `instField`, `tankStorage`, `tankExpansion`, `valve*`, `coolingCoil`, `coolingTowerCell`, `hxShellTube`, `filterCartridge`, `uvSteriliser`, `dosingPot`, `facp`, `aspirating`, `releasePanel`, `manualStation`, `abortSwitch`, `preActionValve`, `alarmValve`, `sprinklerHead`, `smokeDetector`, `compressor`, `gensetDiesel`, `leakSensor`, `flowMeter`, `offSheet`.
  - D-3 adds the classes for SLD devices (`mvSwitchgear`, `rmu`, `transformer`, `lvBoard`, `ats`, `ups`, `pdu`), ICT nodes (`coreSwitch`, `distSwitch`, `accessSwitch`, `otGateway`, `firewall`), `rack`, and the CDU parts (`cdu`, `cduPump`, `plateHx`, `cduSensor`).
- **AD3. Every row is traced.** A payload row is `{label, value, text, unit, quality, basis? | declared?, sim?}`, with `basis` = registry id. The module enforces it: a row with `basis` must resolve in `data/conv-parameters.json` and must equal the engine value at the printed precision; any other row must carry `declared` (≥ 40 chars) or `sim: true`. No `NaN`; null prints "—".
- **AD4. Inspector rendering.** Use `RZInspector.openPayload` (payload mode already exists, 1.45.0+). Value cells get `data-basis-param` plus the evidence dot, or the `SIM` mark (`rz-evidence` vocabulary).
  - Docking: a page opts in with `<body data-rz-inspector-dock="1">`, so the inspector stops covering the header (D10).
  - Fix this additively in `rz-inspector.js` CSS for conv pages only.
- **AD5. One modal shell.** `js/conv/equipment-modal.js` (new) renders the deep modal from the same payload plus a class mini-mimic (`js/rz-eng-symbols.js` glyph at large scale with its live tags).
  - Modal sections: identity, readings (traced), trend, guidance (from the class table), design basis.
  - Lifecycle: focus trap, `Esc` closes, focus returns to the trigger, timers cleared on close, background inert.
  - Chiller's loop modal becomes the `chillerWater` instance of this shell. Its 18 rows move into the class recipe.
- **AD6. Trend.** Use a seeded deterministic series (`tick`, period, phase from the point id), anchored on the engine plane, with no `Math.random`. It is declared SIMULATED and drawn as an inline SVG sparkline with the engine plane as a dashed reference line.
- **AD7. Maintenance.** Each class carries a declared interval and the standard it comes from: NFPA 25 weekly churn for fire pumps; NFPA 110 monthly load test for gensets; ASHRAE 180 for chillers and towers; NFPA 72 annual for detectors; IEEE 450 for UPS batteries. A "last test" is a deterministic declared fixture. It is labelled TRAINING RECORD, never presented as live.
- **AD8. Tooltip corpus.** `tools/explain-conv.json` holds one entry per conv label, tag class, unit and abbreviation.
  - Each entry: short definition, formula or setpoint if any, standard reference, and why it matters to the operator.
  - Bind with `data-explain="conv-<key>"`. In the SVG tag layer, add `<title>` to the node. The text layer stays pointer-events none.

---

## 4. Gates (W0 — Opus)

### G1 · `test-conv-geometry.mjs` must fail, never hang (audit G1)

- **Laws**
  1. When a page stalls in `activateTab`, the gate prints `HUNG <page> <tab>` within 90 s and continues to the next page. The page counts as FAIL if it is strict, or as a MONITOR line otherwise.
  2. The full run on today's tree finishes in under 25 min.
  3. Conv page verdicts do not change.
- **RED**: `timeout 1500 rz-lane -l 2 -t 1500 -- node tools/test-conv-geometry.mjs` → exit 124 with no summary line. Measured: exit 124 at 603 s.
- **Fix**
  - Add a per-page `Promise.race` deadline. On deadline, close that page's browser context and go on to the next page.
  - Edit only `tools/test-conv-geometry.mjs`. Do not edit `tools/lib/cockpit-tabs.mjs` (LTC uses it).
  - Add a seam `RZ_GEOMETRY_PLANT_HANG=1` that makes one conv page's activation hang, for the RED→GREEN proof.

### GD · instruments that can see depth (audit D7)

- **`tools/test-conv-depth.mjs`**: already committed as a MONITOR (baseline in audit §7).
  - Add per-page thresholds read from `tools/conv-depth-thresholds.json`.
  - A page with no entry stays MONITOR. A page with an entry fails below its numbers.
  - D-2…D-5 raise the entries as pages land, as a ratchet that never lowers.
- **`tools/test-conv-coverage.mjs`**: add a hook-aware numerator, the same rule `test-dcai-coverage` uses.
  - A visible number counts as traced only when it has a `[data-basis-param]` ancestor whose id resolves and whose value matches at the printed precision, or a `[data-rz-authored-basis]` ancestor that is **visibly marked** (an evidence/SIM mark inside the same group).
  - Value-string membership alone no longer counts.
  - Enters as MONITOR with the per-page table. The flip condition is written into the standard.
  - **RED**: today the hook-aware table must report ≥ 600 untraced numbers across the 8 cockpits.
- **New `tools/test-conv-payloads.mjs`** (`node --test`). It must prove:
  - every class returns a frozen payload with 6 non-empty tabs;
  - every `basis` resolves and matches the engine;
  - every other row is declared or SIM;
  - same tick gives a `deepEqual` payload;
  - tick + 1 changes only SIM rows;
  - the module sources contain no `Math.random`.
- **New `tools/test-conv-equipment-modal.mjs`** (Puppeteer). On each sheet page, one item per class goes through: inspector → Open HMI → the modal opens.
  - Focus moves inside the modal and Tab wraps.
  - Background is inert.
  - `Esc` closes it, focus returns to the trigger, and the active timer count is 0.
  - Run at 390 and 1440 with no horizontal overflow.

---

## 5. W1 — the depth layer and the reference page (Opus)

### D-1 · payload builder, inspector shell, modal shell (D1, D10)

- **Files**
  - New: `js/conv/payloads.js`, `js/conv/equipment-modal.js`, `tools/test-conv-payloads.mjs`.
  - Changed: `js/conv/sheet-truth.js` (shim to `payloads.js`); additive changes to `js/rz-inspector.js`; `css/` inspector dock for conv pages.
- **Laws**
  1. `node --test tools/test-conv-payloads.mjs` passes for every class listed in AD2.
  2. On the fire page, opening FACP-01, VESDA-01, FP-01, TK-FW-01 and PAV-01 shows LIVE ≥ 4 rows and ≥ 5 of 6 tabs with content.
  3. The provenance footer shows the real engine version (2.2.0), not "—".
  4. At 1440 the inspector does not cover the page header or the toolbar.
- **RED**: `test-conv-depth.mjs --page=fire-system.html` → `LIVE <= 2 rows on 23`, `avg tabs 0.2/6`.
- **GREEN**: the same command → `LIVE <= 2 rows on 0`, `avg tabs ≥ 5.0/6`, `traceable cells > 0`.

### D-2 · chiller-plant as the reference page (D2, D9, and the chiller rows of D6/D8)

- **Wiring**
  - Every `.hmi-node` on `#pidSvg` opens the inspector through `payloads.js`. Remove the `chwLoopOf` early return in `chwOpen()`.
  - A double-click, or "Open HMI", opens the modal shell. CH-0n opens the chiller instance; CHWP opens the pump class (command/feedback, speed, amps, head, vibration, duty/standby, permissive, trip); TT opens the transmitter class (PV, range, quality, calibration due); ET-01 opens the expansion tank class (pre-charge, level).
- **Modal content (D9)**
  - Units use `°C`.
  - Simulated pump amps and vibration carry `SIM`.
  - Engine values carry their basis marks.
  - Secondary supply ≥ primary CHWS, through a decoupler/blend identity (`T_sec_sup = T_prim_sup + mixing_k`, mixing_k ≥ 0 declared). The 18.9 < 19.4 defect becomes impossible.
- **Traceability**: every number on the page is hooked with a mark, or declared with a visible SIM mark.
  - Target: 137 numerals → bare 0, hooked + marked ≥ 95 % of the engine-sourced ones.
- **Tooltips**: every label and tag class on the page. Target: 60 labels → ≥ 57 with a tooltip.
- **Laws**: the chiller row of `test-conv-depth.mjs` meets the §7 flip condition. Then enter it in `conv-depth-thresholds.json` and flip the chiller page to STRICT.
- **Look**: screenshots of the inspector on CH-01, CHWP-01A, TT-101 and the CHWP modal at 390 and 1440, both themes.
- **Docs**
  - `standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md`: a new §3a "Equipment inspection contract" (the §0 table of this plan), gate numbers, and the flip condition.
  - `manual/chiller-plant.html`: the modal and its basis.
  - Release **v3.64.0** = G1 + GD + D-1 + D-2.

---

## 6. W2 — replicate (Ark, one page per brief; Opus reviews and ships)

Each page copies the D-2 pattern. The table lists what each page needs beyond the shared builder.

| page | items to wire | inspector / modal classes to add or fill | numerals (bare / declared-only) | labels without tooltip | special |
|---|---|---|---|---|---|
| fire-system | 24 tagged + 25 junction/aux | fill all fire classes (FACP, VESDA, RCP, MCP, ABT, PAV, alarm valve, FP, JP, tank, sprinkler, N₂ compressor) | 35 / 40 | 52 | MAINT per NFPA 25/72; cause-and-effect rows link from the FACP inspector |
| fuel-system | 16 + 6 | UST, day tank, transfer pump, filter train, leak sensor, genset | 36 / 34 | 91 | genset CAPACITY reads the W4 fleet leaves when they land (until then states "fleet sizing under review — audit E-C1") |
| water-system | 17 (6 dead today) | tank, booster pump, filter, UV, dosing, HX, tower cell | 28 / 43 | 24 | tower CAPACITY shows the evaporation/blowdown balance |
| ict | 17 nodes | core / dist / access / OT gateway / firewall | 13 / 78 | 42 | keep `showNodeDetail` fault-domain logic, but render it as the DEPS tab |
| EPMS_Telemetry | 29 SLD devices | MV, RMU, Tx, LVSB, GEN, ATS, UPS, PDU | 34 / 2 | 69 | SLD labels at 390/768 (old U4) ride in this WP |
| datahall | 500 racks + CRAH + row PDUs | rack, CRAH, row | 21 / 318 | 79 | `selectRack` panel becomes the inspector; 318 declared-only cells get a visible SIM/derived mark via the `data-rz-distribution` group mark |
| cdu-mini-bms | 13 parts | CDU, pump, plate HX, sensors | **86 / 0** | 32 | page is a monitor page: hook to the CDU calculator engine or declare SIM per group |
| dc-conventional | subsystem tiles | none (tiles navigate) | 9 / 0 | 29 | finish tooltips and the 9 bare numbers only |

- **Per-page laws**: the page's row in `test-conv-depth.mjs` meets the §7 flip condition. Then enter the row in `conv-depth-thresholds.json`.
  - `test-conv-equipment-modal.mjs` passes for that page.
  - The hook-aware coverage row for the page shows 0 untraced.
  - All existing conv gates stay green.
- **D-4 (traceability) and D-5 (tooltips)** run inside each page brief, not as separate sweeps, so a page is finished once.
- **D-5 content rule**: Ark drafts each `explain-conv.json` entry. Opus checks every formula, unit and standard citation before merge. A tooltip that states a wrong standard is worse than none.
- **Release v3.65.0**: the 8 pages, 2 per review batch. The release does not ship until every page is STRICT in `test-conv-depth.mjs`.

---

## 7. W3 — page fixes (Ark), audit §3–§4 rows

| WP | rows | laws (each with a RED grep or probe on today's tree) |
|---|---|---|
| F-1 shared modules | C-A8, A9, A10, A11 | conv sheets no longer say "DC AI engine"; EPMS PDF with a blocked pop-up shows a message and throws nothing; basis drawer open/close ×10 leaves the keydown listener count unchanged (inline copies deleted); `RZHmiSheet.destroy()` removes its listeners |
| F-2 state honesty | C-A1…A6, A12 | no displayed state from `Math.random` outside a declared SIM helper; datahall excursions start only from a labelled "Run scenario" control; fuel alarm thresholds read the engine; fuel trend axis 0–100 %; FP-02 has no authored live values; hall switch clears the excursion; one `lastUpdate` owner |
| F-3 labels | E-H4, E-H6, C-A13 | 22.4 °C captioned as room average, never as a setpoint; UPS "2 systems × 32 modules = 64"; RH 20–80 % never "recommended" |
| F-4 contrast + light theme | U1, U2, U3 | axe `color-contrast` = 0 on dc-conventional, ict and every `rz-bms-shell` adopter, 3 widths × 2 themes; the sign-in modal follows the theme; token fix, no new hex |
| F-5 readable drawings | U5 (U4 moved to the EPMS brief) | chiller "Shade" sheet halo uses the sheet background colour; `test-conv-sheet-text-clear.mjs` C1–C5 green; screenshots in both shades |

Release v3.66.0.

---

## 8. W4 — engine truth (Opus), audit §2 rows

Engine 2.2.0 → 2.3.0, with the pin, the registry regenerated and the manuals updated. Payloads carry the new numbers to every inspector automatically, and the Node payload test catches any row that loses its basis.

### E-1 · electrical and fuel fleet (E-C1, C2, M4, M5, L3, L4, L5)

Proposed defaults below. The executor checks them against vendor-class data and records them as ADOPTED.

- **Gensets**: `genset_unit_kw 3000`, `genset_max_loading 0.8`, N+1 per hall block. Per hall: `ceil(10,000 × 1.45 / 2,400) + 1` = **8 per hall, 32 total**.
- **Transformers**: `transformer_unit_kva 3150`, PF 0.95. On contingency each stream carries the whole hall: `ceil(14,500 / 0.95 / 3,150)` = **5 per stream per hall**, normal loading ≤ 50 %. LV current per transformer is 4,547 A, so use 5,000 A boards.
- **Fuel**: load-dependent specific consumption (≈ 0.27 L/kWh at 100 % load, ≈ 0.30 at 50 %) replaces the flat 0.356. The transfer pump must deliver ≥ 1.25 × the fleet burn in L/min.
- **UPS efficiency**: a declared part-load curve.
- **Topology**: one day-tank value everywhere. The EPMS topology matches the engine: 2N, with mechanical load not on UPS.
- **Laws**
  - Fleet with one set lost ≥ facility kW, at design and at adopted load.
  - Transformer contingency loading ≤ 100 %.
  - No literal `3150KVA` or `'2.5 MW'` remains in the page.
  - Pump ≥ 1.25 × burn.
  - Autonomy = usable litres ÷ burn, at both loads.

### E-2 · cooling and water (E-H1, M2, M3, M9, M10, L2)

- **WUE becomes derived**:
  - evaporation = tower rejection / h_fg (2,430 kJ/kg);
  - blowdown = E / (CoC − 1);
  - drift = 0.0005 % of circulation;
  - WUE = make-up / IT, expected ≈ 2.0–2.4 L/kWh.
- **Chiller**: per-chiller flow on evaporator duty. COP is labelled compressor-only, or made plant-level.
- **Other**: R-1234ze(E) saturation table. Java-Bali grid factor (KESDM, cite the year).
- **Laws**
  - Tower = evaporator + compressor input (± 2 %).
  - Latent heat of the make-up = tower rejection (± 5 %).
  - Printed ΔT = Q / (ṁ c_p) (± 0.05 K).

### E-3 · air side and PUE (E-H2, H3, M1)

- `crah_installed` fixed by design load (78 per hall), while `crah_running` follows load.
- Bottom-up PUE stack. Part-load PUE is either derived or printed as UNAVAILABLE.
- **Laws**
  - Σ non-IT terms = facility − IT (± 0.5 %).
  - `crah_installed` is the same at all 4 scenario loads.

### E-4 · fire hydraulics (E-H5, M6, M7, M8, C-A7)

- Motor ≥ P_hyd at the NFPA 20 150 % point ÷ η. Main pump ≈ 110 kW class; jockey ≥ 7.5 kW.
- Storage = rated flow × duration.
- Pressure ≤ 12.1 bar, or the components are declared 300 psi class.
- One suppression-agent wording. Pump setpoints derived from the static pressure.

### E-5 · ICT sizing (E-H7, L1)

- Ark executes after E-3; Opus reviews.
- **Law 1**: access ports ≥ racks × ports per rack under a declared oversubscription.
- **Law 2**: rack-equivalents ≤ 2,000.

Release v3.67.0 (MINOR: published counts change).

---

## 9. Ready-to-paste Ark brief (one per page; fill the brackets)

```
You are executing WP D-3/<page> of standarization/Audit result/CONV_EXECUTION_PLAN_2026-11-16.md.
Read §1 (protocol), §0 (target), §3 (architecture) and the <page> row of §6 of that file first.
Reference implementation: chiller-plant.html after v3.64.0 + js/conv/payloads.js + js/conv/equipment-modal.js.
Work in your own worktree: git worktree add ~/.cache/rz-d3-<page> origin/main ; branch wp/d3-<page>.
Do NOT edit datahallAI.html or js/datahall-ai/*. Do NOT commit to main or push.

1. RED: run
   TMPDIR=$HOME/.cache/qa-tmp timeout 900 rz-lane -l <1|2> -t 900 -- node tools/test-conv-depth.mjs --page=<page>
   and copy its T/H/M/I lines.
2. Add the classes this page needs to CLASSES in js/conv/payloads.js (tab recipes from §0; every row
   basis= a registry id that resolves, or declared>=40 chars, or sim:true). Extend
   tools/test-conv-payloads.mjs for each new class; run node --test tools/test-conv-payloads.mjs.
3. Wire every tagged item on the page to the inspector (single click) and the modal shell (Open HMI /
   double-click). No pointer cursor without an action.
4. Hook and mark every number (data-basis-param + evidence mark, or a visible SIM mark). Bare = 0.
5. Add tools/explain-conv.json entries for every label, tag class, unit and abbreviation on the page,
   bind them with data-explain, add <title> to SVG nodes; python3 tools/build-explain-db.py.
6. GREEN: the same depth command must meet: bare 0; hooked+marked >= 95 % of engine numerals; tooltip on
   labels >= 95 %; every tagged item opens; LIVE >= 4 rows on every opened item; >= 5/6 tabs with content.
   Also green: node tools/test-conv-equipment-modal.mjs --page=<page>, node tools/test-conv-coverage.mjs,
   node tools/test-conv-bms-truth.mjs, python3 tools/audit-js-syntax.py --strict.
7. Screenshots 390 and 1440, dark and light: page, inspector on 3 items, one modal. Look at each.
8. Hand back: diff stat, RED and GREEN lines per law, screenshot paths, and every explain entry you were
   unsure of (Opus checks the engineering before merge).
```

---

## 10. Owner decisions (defaults stand unless the owner overrides)

1. **Modal shape**: inspector on click and deep modal on "Open HMI" / double-click, the same two-tier model datahallAI uses. The alternative is a modal on every click.
2. **Last test records**: shown as a TRAINING RECORD with the standard interval, not left blank.
3. **Engine defaults (W4)**: gensets 3.0 MW, N+1 per hall (32 sets); transformers 3,150 kVA, 5 per stream per hall; WUE derived (~2.0–2.4 L/kWh); Java-Bali grid factor; EPMS aligned to 2N with mechanical load not on UPS.

---

## 11. Status

| WP | audit rows | executor | status |
|---|---|---|---|
| G1 | G1 | Opus | OPEN |
| GD | D7 | Opus | OPEN (`test-conv-depth.mjs` MONITOR committed) |
| D-1 | D1, D10 | Opus | OPEN |
| D-2 | D2, D9, chiller part of D6/D8 | Opus | OPEN |
| D-3 fire / fuel / water / ict / EPMS / datahall / cdu-mini / dc-conv | D3, D4, D5, D6, D8, U4 | Ark | OPEN |
| F-1 | C-A8, A9, A10, A11 | Ark | OPEN |
| F-2 | C-A1…A6, A12 | Ark | OPEN |
| F-3 | E-H4, E-H6, C-A13 | Ark | OPEN |
| F-4 | U1, U2, U3 | Ark | OPEN |
| F-5 | U5 | Ark | OPEN |
| E-1 | E-C1, C2, M4, M5, L3, L4, L5 | Opus | OPEN |
| E-2 | E-H1, M2, M3, M9, M10, L2 | Opus | OPEN |
| E-3 | E-H2, H3, M1 | Opus | OPEN |
| E-4 | E-H5, M6, M7, M8, C-A7 | Opus | OPEN |
| E-5 | E-H7, L1 | Ark | OPEN |
| H-1 | C-A14, A15 | Ark | OPEN |
| H-2 | C-B1, B2, B3 | Opus | OPEN |
| H-3 | U6, U7, G2 | Opus | OPEN |
