# DC Conventional family — execution plan (2026-11-16)

Closes every row of `CONV_TOTAL_AUDIT_2026-11-16.md`. Written to be executed by **Opus** (main
session or Opus subagent) or **Ark** (BytePlus `glm-5.2` subagent via claude-hybrid). Each work
package (WP) is self-contained: an executor reads the "Executor protocol", then its WP, and nothing
else is required.

## 0. Routing — who executes what

| class of work | executor | why |
|---|---|---|
| Bounded edits with a mechanical law (contrast tokens, null checks, provenance strings, literal → engine read, listener cleanup) | **Ark** | cheap, parallel; the law and the gate decide correctness, not judgement |
| Engine arithmetic, sizing rules, new model leaves, anything that changes a published number | **Opus** | needs engineering judgement and ripple tracing across 8 cockpits, registry, PDFs, manuals |
| Shared test tooling (`tools/lib/*`, gates walked by LTC) | **Opus** | a mistake blinds another session's gate |
| Review of every Ark diff, ship gate, version bump, push | **Opus main session** | Ark subagents cannot push; the ark-approver hook judges risky calls; one integrator owns the release |

Hard rule: an Ark result is a claim from another model family. Opus re-runs the WP's `verify:` lines
and looks at the screenshots before accepting it.

## 1. Executor protocol (every WP, every executor)

1. **Worktree.** Own worktree from fresh `origin/main` (`git worktree add ~/.cache/rz-wN origin/main`
   or reuse `~/.cache/rz-w5` after `git fetch && git checkout -B <wp-branch> origin/main`). Never edit
   `~/rz-work` or another session's worktree. Never `git add -A` on a shared tree.
2. **Scope fence.** Do not touch `datahallAI.html`, `js/datahall-ai/*`, `prd/datahallai.html`,
   `manual/datahallai.html` (LTC session) beyond mechanical `?v=` tokens.
3. **Browser jobs.** `export TMPDIR=$HOME/.cache/qa-tmp`; run every Puppeteer job as
   `timeout N rz-lane -l 1|2 -t N -- $(command -v node) tools/<gate>.mjs` (lane 3 belongs to LTC).
   Never `pkill -f`; never kill a chrome or server you did not start. A local server binds a free
   port (`python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])'`),
   never 8166/8081.
4. **Laws → proof.** Before editing, run the WP's RED check and keep its output. After editing, the
   same check is GREEN. A new gate must fail on the old tree first. Quote the decisive output line.
5. **Engine changes** (`js/conv-engine.js`): bump `version` and `js/rz-engine-versions.js` `conv`
   together, then `node tools/test-conv-engine-version-pins.mjs` — a pin mismatch blanks all 8
   cockpits with no console error (memory: engine-version-pin trap). Regenerate the registry only via
   `node tools/build-conv-parameter-registry.mjs`; never hand-edit `data/conv-parameters.json`.
6. **Scripted HTML edits**: Python with lambda replacement in `re.sub` (a `\00b7` replacement became a
   NUL byte once); afterwards `grep -caP "\x00" <file>` must print 0, and
   `python3 tools/audit-js-syntax.py --strict` must be CLEAN.
7. **Docs in the same release**: `standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md` (rule + gate
   number), the subsystem `manual/<slug>.html` when a formula or number changes, `CHANGELOG.md`, this
   plan's status column, and the audit ledger row → CLOSED with version + gate.
8. **Release** (Opus main session only): `js/rz-version.js` + `sw.js` + `changelog.html` regen +
   cache tokens, `bash tools/ship-gate.sh` (resume with `RZ_GATE_FROM=N`), push with plain
   `git push origin HEAD:main` (SSH deploy key; never a token), check the Pages deploy and the live
   `js/rz-version.js`. Commit trailer per session rules.
9. **Report**: per law, the command and its decisive output line; screenshots looked at; anything not
   proven said first.

## 2. Waves and releases

| wave | WPs | executor | release | depends on |
|---|---|---|---|---|
| W0 | G1 gate repair | Opus | v3.64.0 (with W1) | — |
| W1 | A2, A3, A4, U1, U2 | Ark ×2 in parallel (A2+A3 / A4+U1+U2), Opus review | v3.64.0 | W0 (so the geometry gate can see U2) |
| W2 | E1, E2, E3, E4, E5 | Opus (E1+E3 one agent, E2+E4 one agent, E5 Ark after E3 lands) | v3.65.0 MINOR — published counts change | W1 merged (same files) |
| W3 | R1, S1, G2 | Ark (R1), Opus (S1, G2) | v3.65.x | W2 |

Max two executors in flight at once (token budget rule); thermal limit: at most two browser lanes.

---

## W0 — gate health

### W0-G1 · `test-conv-geometry.mjs` must fail, never hang (audit G1) — Opus

- Laws:
  1. A page whose tab activation stalls ends that page's run within 90 s with `HUNG <page> <tab>` and
     exit 1 for a strict page / a MONITOR line for a monitor page; the run continues to the next page.
  2. The full run on today's tree finishes in < 25 min (it currently never finishes).
  3. Conv pages (`chiller-plant`, `fire-system`, `water-system`, `fuel-system`, `ict`, `index`) still
     report their existing PASS/FAIL unchanged.
- RED: `timeout 1500 rz-lane -l 2 -t 1500 -- node tools/test-conv-geometry.mjs` → killed by timeout
  with no summary line (record the last page printed).
- Fix: wrap each page (and each `activateTab` call) in a `Promise.race` against a per-page deadline;
  on deadline close that page's browser context, print `HUNG`, continue. Change only
  `tools/test-conv-geometry.mjs`; `tools/lib/cockpit-tabs.mjs` is shared with LTC — read it, do not
  edit it. Do not remove `datahallAI.html` from the run (it is LTC's monitor row); a hang there becomes
  a reported row, not a silent stall.
- Verify: rerun RED command → summary line printed, `HUNG datahallAI.html …` present, conv pages
  unchanged. Add a seam `RZ_GEOMETRY_PLANT_HANG=1` that makes one conv page's activation never resolve,
  proving law 1 RED→GREEN on demand.
- Docs: standard §9 (gate list) note "per-page deadline"; ledger G1 → CLOSED.

---

## W1 — truth, wiring and readability (bounded; Ark executes, Opus reviews)

### W1-A2 · shared module defects (C-A8, C-A9, C-A10, C-A11) — Ark

- Laws:
  1. `grep -n "DC AI engine\|datahall-ai/hmi-sheets" js/rz-hmi-sheet.js` → 0 lines in the conv path;
     the sheet basis string names `js/conv-engine.js` (pass the engine name in via the sheet spec, so
     the shared module stays engine-agnostic; datahallAI keeps its own string through its own spec).
  2. EPMS PDF export with `window.open` returning `null` shows an in-page message and throws nothing
     (`pageerror` count 0).
  3. Opening and closing the basis drawer 10× on `dc-conventional` and `datahall` leaves the document
     keydown listener count unchanged; both pages use the shared `js/rz-basis-drawer.js` and the inline
     copies (`dc-conventional.html:2806-2842`, `datahall.html:2338-2371`) are deleted.
  4. `RZHmiSheet.destroy()` removes every listener it added (count via a CDP
     `DOMDebugger.getEventListeners` probe before render / after destroy).
- RED: (1) the grep prints line 246; (2) a probe that stubs `window.open = () => null` and clicks the
  export → `TypeError`; (3)/(4) listener counts grow per cycle.
- Gates to stay green: `test-conv-basis-drawer.mjs`, `test-conv-sheet-text-clear.mjs`,
  `test-conv-sheet-perf.mjs`, `test-conv-coverage.mjs`, and LTC's
  `test-datahall-ai-inspector-runtime.mjs` (shared `rz-hmi-sheet.js` — run it, do not edit LTC files).
- New gate: extend `tools/test-conv-bms-truth.mjs` with the provenance-string check (law 1) and the
  listener-count check (laws 3–4).

### W1-A3 · page state honesty (C-A1…A6, C-A12) — Ark

- Laws:
  1. No displayed state on a conv cockpit is driven by `Math.random`: a static scan of the 8 pages for
     `Math.random` returns only lines inside a declared `simulated` jitter helper that the page's
     `data-rz-authored-basis` names; `datahall.html` no longer starts excursions on a timer — an
     excursion starts only from an explicit operator "Run scenario" control and is labelled SIMULATED.
  2. Fuel alarm thresholds read `snapshot.fuel.level_low_pct / level_low_low_pct /
     level_overfill_pct`; `grep -nE "< 30|< 60|> 95" fuel-system.html` in the alarm block → 0.
  3. The fuel UST trend axis spans the series' real range (0–100 %), so a value outside 80–90 % is
     drawn inside the plot (probe: set level 40 %, the last point's y is inside the plot box).
  4. FP-02 status text carries no authored live value (`fuel 88%`, `battery OK`) unless it is declared
     SIMULATED in the same element.
  5. Switching hall during an excursion clears the excursion banner and state.
  6. Fuel "updated Ns ago" increases monotonically between ticks (one owner of `lastUpdate`).
- RED: each law's grep/probe on the current tree. Pin the sim tick (`window.__rzSimTick`) in probes.
- Gates: `test-conv-fire-fuel-operator.mjs`, `test-conv-cooling-water-ui.mjs`,
  `test-conv-alarm-runtime.mjs`, `test-conv-snapshot-binding.mjs`, `test-conv-hall-scope.mjs`.
- Docs: standard §6 Fuel/Water/Data hall lines that describe the simulated parts.

### W1-A4 · labels that say the wrong thing (E-H4, E-H6, C-A13) — Ark

- Laws:
  1. The 22.4 °C value is captioned as what it is (`avg_temp_c`, room average) and never sits under a
     "setpoint" or "cold aisle" caption; the rack-inlet target shown anywhere = `cooling.rack_inlet_target_c`
     (25.4).
  2. Tech Spec "UPS module count" prints `electrical.ups_module_count` (64) as
     `2 systems × 32 modules`, and per-system output = `ups_system_kw`; no "2 (A + B feed)" string.
  3. No page labels 20–80 % RH as "recommended"; ASHRAE A1 recommended band is stated as a dew-point
     range (−9 °C to 15 °C dew point, with the RH ceiling of the cited edition) or the RH line is
     labelled "allowable".
- RED: `grep -n "UPS module count','2" dc-conventional.html`; grep for "recommended" next to "20-80".
- Gates: `test-conv-document-parity.mjs`, `test-conv-coverage.mjs --strict`, `test-conv-explain-wiring.mjs`.

### W1-U1 · contrast and the light theme (U1, U2, U3) — Ark

- Laws:
  1. `dc-conventional.html` light theme: the page background, the sign-in modal and the PRD/Manual
     buttons all follow the theme; axe `color-contrast` violations = 0 at 390/768/1440 in both themes.
  2. `ict.html` and every `rz-bms-shell` adopter: axe `color-contrast` violations = 0, both themes, 3 widths.
  3. Fix by token, not by literal: replace `#64748b` / `#66758a` secondary text on near-black with the
     existing secondary-text token that measures ≥ 4.5:1 on `#0a0b0d…#181a1e` (check
     `documentation/design.md` tokens); no new hex.
- RED: the render audit states 00421–00423, 00499–00504, 00319–00324 (FAIL). Re-run:
  `node tools/audit-site-render.mjs --base http://127.0.0.1:<port>/ --include '^(dc-conventional|ict|chiller-plant)\.html$' --axe --capture-all --out <new dir>`.
- Gates: `audit-a11y.mjs --strict`, `audit-dark-coverage.mjs`, `audit-legibility.mjs --strict`;
  look at the six screenshots per page.
- Note: the sign-in modal comes from `auth.js` — fix the token scoping in the auth modal CSS so it
  inherits the active theme; check `index.html` and one calculator still render it correctly.

### W1-U2 · drawings readable at every width (U4, U5) — Ark, Opus review

- Laws:
  1. `EPMS_Telemetry.html` at 390 and 768: every SLD equipment box shows its tag (MV-A, Tx-A, LVSB-A, …)
     at ≥ 8.5 rendered px, or the sheet opens in a fit/scroll viewport with tags legible after one
     "zoom to fit" — standard §4 ("labels cannot overlap… at 390, 768"); the bottom KPI strip shows
     every cell without truncation (wrap or 2-row grid).
  2. `chiller-plant.html` "Shade" (light) sheet: tag text halo stroke uses the sheet background colour,
     so text edges are clean; `test-conv-sheet-text-clear.mjs` C1–C5 stay green; screenshots in both
     sheet shades looked at.
- RED: render audit states 00439–00443 (`large-blank-gap`, `bodyTextLength` 738 at 390 vs 1,646 at
  1440); screenshot 00324 crop.
- Gates: `test-conv-geometry.mjs --page=EPMS_Telemetry.html` (needs W0), `audit-legibility.mjs --page=…`,
  `audit-responsive-layout.mjs --strict`.

**W1 release v3.64.0** — Opus integrates both Ark branches (merge-base squash, never
`reset --soft origin/main`), runs the full ship gate, pushes, verifies live.

---

## W2 — engineering truth (Opus)

Engine changes publish new numbers: bump `conv-engine` 2.2.0 → 2.3.0 with the pin (protocol §5).
Every new quantity is an engine leaf with a `// source:` comment and an evidence class
(ADOPTED / ASSUMED / DERIVED), then rendered or declared internal (registry R7/R8 strict).

### W2-E1 · electrical and fuel fleet (E-C1, E-C2, E-M4, E-M5, E-L3, E-L4, E-L5) — Opus

- Model (proposed defaults — the executor checks them against vendor-class data and records them ADOPTED):
  - `electrical.genset_unit_kw = 3000` (standby, 20-cyl high-speed diesel class), `genset_max_loading = 0.8`,
    `genset_redundancy = 'N+1 per hall block'`.
  - `gensets_per_hall = ceil(hall_design_kw × PUE_design / (unit × max_loading)) + 1`
    → hall 10,000 kW × 1.45 = 14,500 kW → ceil(14,500 / 2,400) = 7 → **8 per hall, 32 total**.
  - `transformer_unit_kva = 3150`, `pf = 0.95`; per hall per stream must carry the whole hall on
    contingency: `ceil(14,500 / 0.95 / 3,150) = 5` → 5 × 3,150 kVA per stream per hall (normal ≤ 50 %).
    LV board per transformer `I = 3,150 / (√3 × 0.4) = 4,547 A` → 5,000 A ACB / busbar.
  - Fuel: specific consumption from a declared load-dependent curve (≈ 0.27 L/kWh at 100 %,
    ≈ 0.30 at 50 %) instead of the flat 0.356; tank and autonomy recomputed at design AND adopted load;
    transfer pump capacity ≥ 1.25 × full-fleet burn (L/min).
  - UPS efficiency from a declared part-load curve (IEC 62040-3 class), not flat 96 %.
- Pages: EPMS SLD shows banks (`5 × 3,150 kVA / stream / hall`, `8 × 3.0 MW / hall`) bound to the
  engine; the A/B (+ C) topology matches the engine's 2N UPS with mechanical load NOT on UPS (or the
  engine adopts the catcher topology — pick one, write why, make the page and engine agree). Fuel page
  shows the running set count and per-set load (`facility_kw / running_sets`). Day-tank capacity one
  value everywhere.
- Laws (each a new identity in `tools/test-conv-calc.mjs` or a new `tools/test-conv-electrical-fleet.mjs`):
  1. `gensets_running × unit_kw × max_loading ≥ facility_kw` at design and adopted load, with one set lost.
  2. Every transformer's contingency loading ≤ 100 %; normal ≤ 50 %.
  3. No rendered current > the drawn board rating; `grep -n "3150KVA\|'2.5 MW'" EPMS_Telemetry.html` → 0 literals.
  4. Transfer pump L/min ≥ 1.25 × fleet burn L/min.
  5. Autonomy hours printed = usable litres / burn at the stated load, at both loads.
- RED: run the new identities against 2.2.0 — they fail with the C1/C2 numbers.
- Docs: standard §6 Fuel + new electrical fleet paragraph; `manual/epms-telemetry.html`,
  `manual/fuel-system.html` formulas and worked example; registry regen.

### W2-E2 · cooling and water thermodynamics (E-H1, E-M2, E-M3, E-M9, E-M10, E-L2) — Opus

- WUE becomes DERIVED: `evap_kg_s = tower_rejection_kw / h_fg` (h_fg 2,430 kJ/kg at ~30 °C),
  `blowdown = evap / (CoC − 1)` (CoC ADOPTED, e.g. 4), `drift = 0.0005 % × circulation` (CTI ATC-140
  class), `makeup = evap + blowdown + drift`, `WUE = makeup_L_per_h / IT_kW`. Expected ≈ 2.0–2.4 L/kWh.
  The old 1.20 input is retired (record it in the standard's lesson ledger).
- Per-chiller evaporator flow uses evaporator duty (982.3 L/s basis), not IT-only flow, so the printed
  ΔT equals the computed ΔT (7.6 K).
- "Plant COP / kW/RT" either includes pumps + tower fans or is relabelled "compressor COP"; both if room.
- Refrigerant pressures from R-1234ze(E) saturation at the printed evaporating/condensing temperatures
  (table from a named source, ADOPTED).
- Grid factor: adopt the published Java-Bali grid emission factor (MEMR/KESDM, cite year) — LABEL the
  old 0.42 as retired.
- Laws: energy balance `tower_rejection = evap_duty + compressor_input (± 2 %)`; latent of makeup
  evaporation = tower rejection (± 5 %); printed ΔT = Q / (ṁ c_p) (± 0.05 K); refrigerant P within
  ± 3 % of the saturation table. Each RED on 2.2.0.
- Docs: standard §5 + §6 Water/Chiller; `manual/water-system.html`, `manual/chiller-plant.html`.

### W2-E3 · air side, PUE and the heat balance (E-H2, E-H3, E-M1) — Opus

- `crah_installed` fixed by the design load (`ceil(hall_design_kw / crah_unit_sensible_kw) + 1` → 78 per
  hall at 10 MW), `crah_running` follows load; N+1 margin printed at both loads.
- PUE: a bottom-up stack (IT, UPS loss, distribution loss, chiller, pumps, tower fans, CRAH fans,
  lighting/aux) at design load; at part load either computed from the same terms or shown UNAVAILABLE
  (per `conv-design-basis.js`) — never the design value reused. The residual line "Cooling overhead"
  disappears because the stack closes.
- Laws: Σ non-IT terms = facility − IT (± 0.5 %); `crah_installed` constant across the 4 scenario loads;
  part-load PUE either derived or literally UNAVAILABLE on every page (`test-conv-design-basis.mjs`).

### W2-E4 · fire hydraulics (E-H5, E-M6, E-M7, E-M8, C-A7) — Opus

- Pumps sized from duty: `P_hyd = ρ g Q H`; motor ≥ P_hyd at 150 % flow / 65 % head point ÷ η_pump
  (NFPA 20 curve points) → main pump class ~110 kW at 227 m³/h, ~120 m; jockey ≥ 7.5 kW.
- Storage sized from the pump rated flow × duration (NFPA 13/20 duration ADOPTED), or the pump rating
  reduced to the 2,500 L/min demand — one basis.
- Static/working pressure ≤ 12.1 bar (175 psi) or components declared 300 psi class.
- One suppression agent statement everywhere; N₂ generator described as pre-action supervisory gas.
- Pressure setpoints (jockey/main start/stop) derived from the static pressure leaf.
- Laws: motor kW ≥ hydraulic kW / 0.75 at the rated point; storage L ≥ rated L/min × duration; a grep
  for the four agent wordings returns one.

### W2-E5 · ICT sizing and rack-equivalents (E-H7, E-L1) — Ark after E3, Opus review

- Access switches from rack count and ports per rack with an explicit oversubscription policy
  (standard §6 ICT); rack-equivalents never exceed physical positions (cap, or relabel as kW-equivalent).
- Laws: `access_switches × ports_per_switch ≥ racks × ports_per_rack`; no rack-equivalent > 2,000.

**W2 release v3.65.0 (MINOR)** — published counts change; full ship gate + probe; engine pins.

---

## W3 — hardening

### W3-R1 · split oversized builders (C-A14, C-A15) — Ark

- `buildTechSpecHtml` (768 lines, `dc-conventional.html:1846`) → `js/conv/tech-spec.js` sections ≤ 80
  lines each; the PDF output byte-identical before/after for a pinned snapshot (hash the HTML string).
- One engine-pin parse helper in `js/rz-engine-versions.js`, pages call it.
- Law: `sha256(buildTechSpecHtml(snapshot))` unchanged; `test-conv-document-parity.mjs` green.

### W3-S1 · gate coherence (C-B1, C-B2, C-B3) — Opus

- The pages are public static content, so this is consistency, not secrecy: one gate list in
  `js/rz-feature-flags.js` covering all 8 sub-cockpits (or a written decision that they are public),
  inline root/demo lists removed in favour of `auth.js`. State plainly in the standard that the client
  gate is not a security boundary.

### W3-G1 · render coverage the generic audit cannot reach (U6, U7, G2) — Opus

- Extend the conv render gate with the authorised audit state (`tools/lib/cockpit-audit-state.mjs`) and
  a pixel-sampled contrast probe for SVG text (the axe `incomplete` class), so the 9–114 undecided
  nodes per page get a verdict. RED: plant one `#66758a` label on a sheet.

---

## 3. Owner decisions (defaults chosen; the owner may override before W2 starts)

1. Genset unit class 3.0 MW standby, N+1 per hall block → 32 sets (E1).
2. Transformer 3,150 kVA, 5 per stream per hall, 2N (E1).
3. WUE becomes derived (~2.0–2.4 L/kWh); the dashboard's 1.20 retires (E2).
4. Grid factor moves to the published Java-Bali factor (E2).
5. EPMS topology: align the page to the engine's 2N with mechanical not on UPS (E1).

## 4. Status

| WP | rows | executor | status |
|---|---|---|---|
| W0-G1 | G1 | Opus | OPEN |
| W1-A2 | C-A8, A9, A10, A11 | Ark | OPEN |
| W1-A3 | C-A1…A6, A12 | Ark | OPEN |
| W1-A4 | E-H4, E-H6, C-A13 | Ark | OPEN |
| W1-U1 | U1, U2, U3 | Ark | OPEN |
| W1-U2 | U4, U5 | Ark | OPEN |
| W2-E1 | E-C1, C2, M4, M5, L3, L4, L5 | Opus | OPEN |
| W2-E2 | E-H1, M2, M3, M9, M10, L2 | Opus | OPEN |
| W2-E3 | E-H2, H3, M1 | Opus | OPEN |
| W2-E4 | E-H5, M6, M7, M8, C-A7 | Opus | OPEN |
| W2-E5 | E-H7, L1 | Ark | OPEN |
| W3-R1 | C-A14, A15 | Ark | OPEN |
| W3-S1 | C-B1, B2, B3 | Opus | OPEN |
| W3-G1 | U6, U7, G2 | Opus | OPEN |
