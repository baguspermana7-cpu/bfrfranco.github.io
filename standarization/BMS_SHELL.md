# BMS Shell — Shared Operations-Console Standard (v1.23.0+)

## Adoption status table (closing v1.23 → v1.24 phase, 2026-05-22)

| Page | Adoption ship | Shell library loaded | `body.rz-bms-shell` | Doc-14/24 fixes applied | Engine binding |
|---|---|---|---|---|---|
| (foundation) | v1.23.0 | — (library itself) | — | — | — |
| `chiller-plant.html` | v1.23.1 | ✅ | ❌ | Right inspector + mode toolbar (doc-14 §4) | `conv-engine.js` (preserved) |
| `dc-conventional.html` | v1.23.2 | ✅ | ❌ | Facility callouts 17→6 (doc-14 §1) | `conv-engine.js` (preserved) |
| `fuel-system.html` | v1.23.3 | ✅ | ❌ | Autonomy hero (doc-14 §6) | `conv-engine.js` (preserved) |
| `water-system.html` | v1.23.4 | ✅ | ❌ | WUE hero (doc-14 §7) | `conv-engine.js` (preserved) |
| `fire-system.html` | v1.23.5 | ✅ | ❌ | Fire-stages legend + active-chip color (doc-14 §5) | `conv-engine.js` (preserved) |
| `EPMS_Telemetry.html` | v1.24.0 | ✅ | ❌ | Engine status strip + line-status legend (doc-14 §2) | `conv-engine.js` (newly added) |
| `datahall.html` | v1.24.1 | ✅ | ❌ | Ops rollup + 5-mode selector (doc-14 §3) | `conv-engine.js` (preserved) |
| `ict.html` | v1.24.2 | ✅ | ❌ | ICT Ops strip + 5 OT-gateway chips (doc-14 §8) | `conv-engine.js` (preserved) |
| `datahallAI.html` | v1.24.3 + v1.24.4 | ✅ | ❌ | Data Mode chip in legal summary (doc-24 #1) | `datahall-model.js` + `datahall-calculations.js` (preserved); `#p-dash` byte-identical |

All 8 conv pages + 1 AI cockpit shipped onto the BMS Shell library
between v1.23.0 and v1.24.4 — 11 commits in total (`dbfec30`, `414d19c`,
`6a79479`, `9a033fc`, `7423bad`, `a9abfe1`, `e611707`, `e1980e1`,
`87090fe`, `5bed229`, `4217d20`). Every ship surgical and additive;
engine files + `#p-dash` byte-identical to HEAD throughout.

## Adoption rules of engagement (locked-in from this phase)

1. **Engine preservation is non-negotiable** — `js/conv-engine.js`,
   `js/datahall-model.js`, `js/datahall-calculations.js` byte-identical
   on every commit. 22/22 conv + 57/57 datahall tests must pass.
2. **Owner exclusions hold** — `#p-dash` panel + `updateDashKPI()` +
   `dcCallouts` array in `datahallAI.html` must stay byte-identical. If
   a doc-24 fix targets one of these, mark **DEFERRED-OWNER-EXCLUDED**.
3. **No global body-scope flip** unless explicitly approved per-page —
   the shell's `body.rz-bms-shell` rules would override existing
   typography + palette. So far no page has flipped; only individual
   component classes (`.rz-bms-inspector`, `.rz-bms-layer-toolbar`,
   `.rz-bms-chip`, etc.) are used standalone.
4. **Surgical and additive** — preserve existing alarm strips, KPI
   strips, P&ID diagrams, modal flows, sidebars, engine bindings.
   Insert above/below, not in place of.
5. **Every ship**: bump `js/rz-version.js` (PATCH or MINOR per
   VERSIONING_STANDARD.md), append `CHANGELOG.md` entry, run all 4
   strict audit gates, sync `sw.js`, rebuild `changelog.html`, push,
   IndexNow, update tracker, update this status table.

## Deferred work (queued for owner go-ahead before further ships)

These are larger redesign-grade fixes from doc-24/doc-14 that go beyond
surgical/additive scope:

- **doc-24 #2** — Reduce datahallAI left sidebar to operational summary
  by default; engineering basis collapsible.
- **doc-24 #4** — Quiet normal states across the cockpit (broad
  desaturation work).
- **doc-24 #5** — Convert all-green data-hall/network blocks into
  heatmap/outlier views (per-tab render-tree restructuring).
- **doc-24 #6** — Right object-inspector consistency across all 9 tabs
  (would mean adding shell inspector to each panel + click resolvers).
- **doc-24 #7** — Demote Seismic / Wind / Floor structural callouts
  from `dcCallouts` on `#p-dash`. **DEFERRED-OWNER-EXCLUDED**.
- **doc-24 #8** — Per-tab primary question hint in panel headers.
- **doc-24 #9** — Layer toggles on Room Layout / Cooling / Electrical
  SLD / Network / BMS diagrams.
- **doc-24 #10** — Make selected-object workflow consistent across all
  in-scope panels.
- **doc-14 §4 v1.23.2 deferred** — chiller-plant view-mode `body[data-bms-mode]`
  show/hide section rules (currently UI scaffold only).
- **doc-14 §7 v1.23.4 deferred** — water-system threshold bands on WUE
  + filter DP; consistent ISA tags TK-101 / FLT-201 etc.
- **doc-14 §1 deferred** — `dc-conventional.html` dark-operations theme
  flip (the doc's "dark everywhere" direction — owner approved, but
  requires comprehensive CSS rework over the existing light/dark token
  system).

## Status

**v1.23.0 (2026-05-22)** — Foundation only. Library files shipped, no
pages migrated yet.

**v1.23.1 (2026-05-22)** — `chiller-plant.html` adopted. Right-side
`.rz-bms-inspector` populated on every `[data-loop-id]` click via
`RZBMSShell.inspector.select()`; deep-detail modal preserved alongside.
View Mode toolbar (Overview/Performance/Maintenance) — UI scaffold;
section show/hide rules deferred. `body` has no `rz-bms-shell` class —
page palette intact.

**v1.23.2 (2026-05-22)** — `dc-conventional.html` adopted. Library
loaded (`css/rz-bms-shell.css` + `js/rz-bms-shell.js`) for cross-page
consistency. Doc-14 §1 fix #1 applied: facility-image callouts demoted
17 → 6 operational (PUE / IT / CHW / Temp / Fuel / RH outdoor); all
demoted items preserved in the right stats-panel (no data lost). Theme
flip + top-status-strip migration deferred.

**v1.23.3 (2026-05-22)** — `fuel-system.html` adopted. Library loaded.
Doc-14 §6 fix applied: Generator Autonomy KPI promoted to visual hero —
`.kpi-strip` grid `repeat(5, 1fr)` → `2fr 1fr 1fr 1fr 1fr` so the hero
spans 2 cols, hero value font-size `1.85rem` → `2.85rem` (~54% larger)
with amber-gold tint + inset border. Responsive: hero spans 3 cols on
≤1280 px. Engine binding (`window.CONV_CALC` → `kpi-autonomy` = 48 hr)
unchanged.

**v1.23.4 (2026-05-22)** — `water-system.html` adopted. Library loaded.
Doc-14 §7 fix applied: Instant WUE promoted to visual hero — `.kpi-grid`
`repeat(5, 1fr)` → `2fr 1fr 1fr 1fr 1fr`, hero value font 24 → 36 px
(+50%) with teal accent (`#2dd4bf` treated-water medium). Responsive:
hero spans 3 cols on ≤1280 px. Engine binding (`window.CONV_CALC` →
`#kWue` = 1.20 L/kWh) unchanged.

**v1.23.5 (2026-05-22)** — `fire-system.html` adopted. Library loaded.
Doc-14 §5 fix applied: fire-stages legend chip row (7 chips, 0 Normal
→ 6 Discharged/Lockout) inserted between top alarm strip and main grid.
`setFireStageChip()` hooks into `updateAlarmStrip()` to highlight the
active chip dynamically (green ≤0 / amber 1–2 / red 3–6 — calm normal,
loud abnormal, doc-14 §5: "Use red only during active alarm/discharge").
State-machine transitions (`state.stage`) unchanged.

**v1.24.0 (2026-05-22)** — `EPMS_Telemetry.html` adopted (exemplar
designation revoked by owner). `conv-engine.js` now loaded —
Facility/IT/PUE values match dashboard. Doc-14 §2 fixes: engineering
status strip ("EPMS NORMAL · Facility 2.68 MW · IT 1.85 MW · PUE 1.45 ·
Utility OK · UPS A/B Online · Gen Standby · Trips 0") + visible
line-status legend (Energized / Standby / Open / Alarm/Trip /
Maintenance Bypass) above the SVG. All existing one-line + topbar
content untouched.

**v1.24.1 (2026-05-22)** — `datahall.html` adopted. Library loaded.
Doc-14 §3 fixes: operations rollup (`#dh-ops-rollup`) right after the
alarm strip showing Hall NORMAL · Rack Load 1.85 MW · Cooling Margin
18% · PUE 1.45 · Power Density 9.3 kW/rack (engine-bound) + view-mode
selector (`#dh-mode-toolbar` via `RZBMSShell.layerToggle`) with 5 modes
(Power/Temperature/Cooling Margin/Space/Alarms) that sets
`body[data-dh-mode]`. Per-mode render rules deferred.

**v1.24.2 (2026-05-22)** — `ict.html` adopted. Library loaded. Doc-14
§8 fixes: ICT Ops summary strip (`#ict-ops-strip`: WAN OK · BMS Fabric
OK · Cameras OK · Access Control OK) + BMS/OT gateway health chip row
(`#ict-otgw`: EPMS · Chiller · Fire Panel · Access·CCTV · Historian —
all Online). Page now answers "can operations still see and control the
facility?" — doc-14 §8 primary question.

**v1.24.3 (2026-05-22)** — `datahallAI.html` shell library load (no
component adoption). 10k-line flagship cockpit page — incremental cockpit
fixes ship v1.24.4+. `body` has no `rz-bms-shell` class; engine files +
`#p-dash` owner-excluded panel byte-identical.

**v1.24.4 (2026-05-22)** — datahallAI cockpit fix #1: legal disclaimer
`<summary>` now carries a compact `Data Mode: Simulated` chip in-line
(cyan accent, BMS Shell `is-simulated` style). Doc-24 fix #7 (Seismic /
Wind / Floor structural callouts) deferred — those entries live inside
the owner-excluded `dcCallouts` array on `#p-dash`.

**v1.25.0 (2026-05-22)** — Phase-closing polish + documentation ship.
Adoption status table + rules of engagement + deferred-work queue
captured at the top of this spec. No code changes to any page; locks
in the v1.23 → v1.24 milestone for handoff.

**v1.25.1 (2026-05-22)** — datahallAI cockpit fix #8 (doc-24): each of
the 8 in-scope panels (`#p-over` / `#p-hall` / `#p-rack` / `#p-cool` /
`#p-elec` / `#p-net` / `#p-fire` / `#p-bms`) gained an italic single-line
"Primary read:" hint surfacing the operator's first-read question per
panel. `#p-dash` excluded; engine files + tests byte-identical.

**v1.25.2 (2026-05-22)** — chiller-plant view-mode show/hide rules
(finishes v1.23.1 deferred work per doc-14 §4). Radio-style toolbar +
CSS `body[data-bms-mode="X"] [data-bms-mode-hide~="X"]{display:none}`
pattern. Operator Controls hidden in Overview; Alarm History visible
only in Maintenance.

**v1.25.3 (2026-05-22)** — datahallAI mobile order fix per owner
report: `.mn { order:1 }` + `.side { order:2 }` inside
`@media(max-width:1024px)` so on mobile the main SCADA content
(alarm strip + KPI strip + tabs + facility image) leads, with the
left telemetry spine dropping below. Desktop layout unchanged.

**v1.25.4 (2026-05-22)** — Cockpit SVG mobile readability + EcoStruxure
solid panels + kill pump rotation animation. Per owner image: 
(1) `.pmp { animation:none }` — ISA pump triangle stays static, green fill
remains the ON indicator.
(2) Cooling P&ID block fills bumped `.03/.04 → .25`, header tints
`.06 → .35`, strokes `.20 → .55` for EcoStruxure-grade solid look.
(3) Responsive SVG wrappers: `.pn:not(#p-dash) .bx svg { min-width:720px }`
@≤1024px + `overflow-x:auto` on panel wrapper so diagrams keep design
width on mobile (pan-scroll instead of squish). `chiller-plant.html`
gets same treatment (`#pidSvg{min-width:1200px}` @≤1024, 960px @≤600).
Engineering-value audit shipped as `documentation/engineering-value-audit-v1.md`.

**v1.32.0 (2026-05-24)** — Critical accuracy fixes per team review docs
`Documents/screenshot bms rz/dc ai/review/26-accuracy-validation-and-correction-list.md`
+ `.../conv/review/16-accuracy-validation-and-correction-list.md`.
Owner exclusion on `#p-dash` / `updateDashKPI()` / `dcCallouts` LIFTED
for this work. Engine files remain byte-identical.

DC AI (datahallAI.html):
(1) **AI-ACC-01/02/03/07**: removed `Math.random()` from PUE / WUE /
CUE / IT / per-hall / totals. Dashboard now reads PUE 1.30, IT 14.26
MW, WUE 0.00 (dry-only), CUE_IT 0.90 (PLN Java grid 0.69 × PUE) —
all engine-derived, deterministic. Sensor-class jitter (TCS sensors,
outdoor weather, people count) retained per reviewer allowance.
(2) **AI-ACC-05**: CDU `96/96 N+1` → `36/48 fac · 9/12 hall` from
`DHE.cduRunning × halls`.
(3) **AI-ACC-06**: generator string `"5 running = 40MW for ~31.8MW"`
→ engine-bound `gensetFacN × gensetMW` (7 running = 19.25 MW for
18.55 MW facility, Scenario A locked).
(4) **AI-ACC-08**: PUE colour swapped from green (false-OK) to cyan
(informational neutral); target ≤1.12 listed as separate basis chip.

DC Conv (dc-conventional.html + chiller-plant.html):
(5) **CONV-ACC-01/08**: `CUE 0.42 kg/kWh` relabelled `Grid factor
0.42 kgCO₂/kWh facility`. New tile `CUE_IT 0.61 kgCO₂/kWh IT` (per
ISO/IEC 30134-8, grid × PUE).
(6) **CONV-ACC-02**: chiller-plant `CHWS SP 18.8C` → `Secondary loop
SP 18.8C`. Primary CHWS 7.2 °C label preserved upstream.
(7) **CONV-ACC-04**: fuel autonomy `48 hrs` → `48 hrs · bulk-tank @
site load` to disambiguate scope.
(8) **CONV-ACC-08 (Tech Spec)**: Appendix A.3, A.9, Section 9 in the
Tech Spec PDF rewritten to distinguish grid factor (facility-kWh
denominator) from CUE_IT (ISO/IEC 30134-8 IT-kWh denominator).
Section 1 headline table now lists both rows.

New standardisation: `standarization/ACCURACY_VALIDATION.md` codifies
the 6 rules + acceptance tests from this review.

**v1.29.3 (2026-05-23)** — Phase 1 mobile fixes (owner round of 3 screenshots).
(1) **datahall.html view-mode toolbar wired** — the top 5-button selector
(POWER / TEMPERATURE / COOLING MARGIN / SPACE / ALARMS) was visual-only in
v1.24.1. Now radio-style toggle delegates to `window.setMode()`, paints the
rack heatmap, syncs the centre `.mode-bar`. New `cooling-margin` mode tints
racks by ASHRAE A1 27 °C high-limit margin.
(2) **chiller-plant.html right-edge overflow fixed** — v1.25.4 set
`min-width:1200px` but Plant Capacity / Loop Summary / Drawing Info live at
viewBox x=1520–2280 (design 2300). Bumped to `min-width:2300px` @≤1280px
and split breakpoints. Status-strip chips wrap properly @≤1024.
(3) **water-system.html process-flow no longer overlaps** — same
EcoStruxure responsive pattern. viewBox 0 0 1180 460, `min-width:1180px`
@≤1024 + 768. `.eq` fill bumped from `#0f1a2e` thin to `#14213a` opaque
slate so equipment blocks read as discrete cells.

## Spec sources

- `Documents/screenshot bms rz/conv/review/14-uiux-re-review-2026-05-22-best-design.md` (651 lines, full doc spec for DC Conventional unification).
- `Documents/screenshot bms rz/dc ai/review/24-uiux-re-review-2026-05-22-best-design.md` (727 lines, full doc spec for DC AI cockpit pass).

## Owner direction

1. **Theme** — dark operations everywhere (DC Conv dashboard flips dark too; no light/dark jolt between dashboard and subsystems).
2. **EPMS_Telemetry** — exemplar designation revoked for this design pass. Apply the new doc-14 fixes alongside the other 7 conv pages.
3. **Order** — DC Conv unification first (v1.23.x), then datahallAI cockpit pass (v1.24.x).

## Files

- `css/rz-bms-shell.css` — design tokens + 10 shared components.
- `js/rz-bms-shell.js` — controller (status strip, layer toggle, inspector, alarm badge).

Page opts in by loading both files and adding `class="rz-bms-shell"` on `<body>`. The shell is OFF on pages that don't carry that class — zero side-effects on the rest of the site.

```html
<link rel="stylesheet" href="css/rz-bms-shell.css?v=YYYYMMDD">
<script src="js/rz-bms-shell.js?v=YYYYMMDD" defer></script>
<body class="rz-bms-shell">
  …
</body>
```

## Design principles (calm normal / loud abnormal)

- Normal state is quiet — low chroma, no glow.
- Warning / alarm states dominate the eye.
- Selected object uses one bright outline (no filled block).
- **Red is reserved for trip / fire / leak / EPO** — never decorative, never for "Feed A".
- Every numeric value gets `tabular-nums` + an explicit unit.
- Density inverts: more whitespace around primary status strips, less inside dense engineering tables.

## Token reference (dark operations palette)

| Token | Value | Use |
|---|---|---|
| `--rz-bms-bg`           | `#0b1118` | Page background |
| `--rz-bms-panel`        | `#121a24` | Cards / nav surface |
| `--rz-bms-panel-raised` | `#182232` | Status strip / KPI surface |
| `--rz-bms-border`       | `#293648` | Panel borders |
| `--rz-bms-text`         | `#e7edf5` | Primary text |
| `--rz-bms-text-dim`     | `#9aa8bb` | Secondary text |
| `--rz-bms-text-muted`   | `#66758a` | Labels, captions |
| `--rz-bms-normal`       | `#55b878` | OK state |
| `--rz-bms-warn`         | `#dca33a` | Warning state |
| `--rz-bms-critical`     | `#d94c4c` | Alarm/trip/fire/leak ONLY |
| `--rz-bms-selected`     | `#50c8ff` | Selected object outline |
| `--rz-bms-electrical`   | `#f0b84a` | Subsystem hue (NOT alarm) |
| `--rz-bms-cooling`      | `#4ca8c7` | Subsystem hue (NOT alarm) |
| `--rz-bms-fuel`         | `#c58a2a` | Subsystem hue |
| `--rz-bms-network`      | `#7aa2ff` | Subsystem hue |

Typography:
- Sans: `IBM Plex Sans` (loaded via Google Fonts on shell pages).
- Mono: `JetBrains Mono` for all numerics (tabular figures).
- Type scale `--rz-bms-fs-xs … --rz-bms-fs-2xl` (10 → 32 px).

## Components

### 1. `.rz-bms-status-strip` — top status, first read every page

Render via `RZBMSShell.init({state, critical, warning, dataQuality, updateAge, constraint, role, simulated})`. Mounts inside any host element marked `.rz-bms-status-strip`. Sticky at top.

```text
NORMAL · Critical 0 · Warning 0 · Data GOOD · Updated 2s · Constraint: None · User admin
```

State chip uses one of: `NORMAL`, `WARNING`, `CRITICAL`, `STALE`, `MAINTENANCE`. Numerics use mono tabular-nums and turn red/amber automatically when count > 0.

### 2. `.rz-bms-nav` — left subsystem nav with alarm badges

Render via authored HTML. Each `.rz-bms-nav-item` gets a `.rz-bms-dot` (status) and optional `.rz-bms-nav-badge` (alarm count). Badge with `is-normal` is hidden.

```html
<nav class="rz-bms-nav" aria-label="Subsystems">
  <a class="rz-bms-nav-item is-active" href="#">
    <span class="rz-bms-dot is-normal"></span>
    <span class="rz-bms-nav-label">Dashboard</span>
  </a>
  <a class="rz-bms-nav-item" href="EPMS_Telemetry.html">
    <span class="rz-bms-dot is-warn"></span>
    <span class="rz-bms-nav-label">EPMS</span>
    <span class="rz-bms-nav-badge">1</span>
  </a>
  …
</nav>
```

Update badges programmatically with `RZBMSShell.alarmBadge(navItem, count, severity)`.

### 3. `.rz-bms-inspector` — right object-inspector

Render via `RZBMSShell.inspector.select(host, payload)` where payload follows the schema in `js/rz-bms-shell.js` (title / statusChip / critical / thresholds / trend / alarms / interlocks / maintenance / source).

Click-to-inspect wiring: `RZBMSShell.attachClickToInspector(diagramEl, inspectorHost, resolverFn)`. The resolver gets the click target and returns a payload (or null). Handles keyboard activation (Enter/Space) for free.

### 4. `.rz-bms-kpi` — KPI card anatomy

```html
<div class="rz-bms-kpi">
  <div class="rz-bms-kpi-label">TCS Supply</div>
  <div class="rz-bms-kpi-source">Calculated · Sim</div>
  <div class="rz-bms-kpi-val">35.1<span class="rz-bms-kpi-unit">°C</span></div>
  <div class="rz-bms-kpi-target">Target 35.0 °C</div>
  <div class="rz-bms-kpi-trend is-up">+0.1 / 15m</div>
</div>
```

KPI gets `.is-warn` / `.is-critical` modifier border when threshold crossed.

### 5. `.rz-bms-alarm-row` — shared alarm row

```text
SEV | TIME | SOURCE | MESSAGE | STATE | ACK
```

7-column grid on desktop, collapses to 2-column with stacked metadata under 900 px. Acknowledge button is keyboard-focusable.

### 6. `.rz-bms-layer-toolbar` — diagram layer toggles

```js
RZBMSShell.layerToggle(toolbar, [
  {id:'power',    label:'Power',    pressed:true},
  {id:'cooling',  label:'Cooling',  pressed:true},
  {id:'network',  label:'Network'},
  {id:'safety',   label:'Safety'},
  {id:'access',   label:'Access'},
  {id:'structure',label:'Structure'}
], function(activeIds){ /* re-render the diagram with these layers */ });
```

`aria-pressed` toggles automatically; consumer just receives the active-ID list.

### 7. `.rz-bms-events` — bottom event/trend strip

Plain authored HTML container with `.rz-bms-events-title` label. Pages decide what trends/events to show; the shell only provides the surface.

### 8. `.rz-bms-chip` — pill chip (state, role, mode)

Modifier classes: `is-normal | is-warn | is-critical | is-trouble | is-stale | is-maint | is-simulated`. Uppercase + tracked letters by default.

### 9. `.rz-bms-dot` — status dot

`is-normal | is-warn | is-critical | is-stale`. Critical dot pulses (respects `prefers-reduced-motion`).

### 10. Utilities

- `.rz-bms-mono` — JetBrains Mono + tabular-nums.
- `.rz-bms-muted` / `.rz-bms-dim` — text-tone shorthands.
- `.rz-bms-divider` — horizontal rule between sections.
- `.rz-bms-sr-only` — screen-reader-only text.
- `.rz-bms-skip` — keyboard skip link (every shell page should carry one as the first `<body>` child).

## Responsive collapse

| Breakpoint | Behavior |
|---|---|
| ≤ 1180 px | Inspector unpins from the right and stacks below the main canvas (full width). |
| ≤ 900 px  | Left nav becomes a horizontal scroll bar across the top of the main canvas. Alarm row collapses to 2-col stacked metadata. |
| ≤ 390 px  | All shell components stack vertically; no horizontal overflow. |

## Engine preservation rule

The shell is **presentation only**. It does NOT touch any engine values. Pages remain responsible for feeding engine-derived values from `window.DATAHALL_CALC` / `window.CONV_CALC` into the shell APIs. The shell never reads or writes engine state, never adds `Math.random` into displayed engineering values, never changes the `pueBasis()` calc, etc. Per-ship engine test gates (`tools/test-datahall-calc.mjs` 57/57 + `tools/test-conv-calc.mjs` 22/22) must keep passing on every adoption ship.

## Migration order (per owner — DC Conv first, then DC AI)

| Ship | Page(s) | Notes |
|---|---|---|
| v1.23.0 | (foundation) | Library + spec doc. Zero page changes. |
| v1.23.1 | `chiller-plant.html` | Doc's visual benchmark — proves the components. |
| v1.23.2 | `dc-conventional.html` | Dashboard flips dark; static callouts demoted to Basis drawer. |
| v1.23.3 | `fuel-system.html`, `water-system.html`, `fire-system.html` | Process-dashboard family. |
| v1.24.0 | `EPMS_Telemetry.html`, `datahall.html`, `ict.html` | Bigger rework; doc-14 §2/3/8. |
| v1.24.x | `datahallAI.html` cockpit pass | doc-24 §1–§9 + 10 highest-priority fixes. |
| v1.25.0 | Polish + cross-page consistency audit + brand-token sweep + final UIUX audit re-run. |

## Owner exclusion note (lifted for this design pass)

EPMS_Telemetry.html was designated "byte-untouched exemplar" through v1.22.x. The owner has revoked that designation for the BMS Shell adoption pass (per the new doc-14 review). It now migrates onto the shared shell alongside the other 7 conv pages.

The DC Dashboard tab `#p-dash` inside `datahallAI.html` **remains** owner-excluded. Adoption ships must continue to leave that panel byte-identical to HEAD.

## v1.41.x cockpit refinement pass (2026-05-24)

Seven-ship sweep closing batched owner feedback on the cockpit family. All ships engine-locked (`datahall-model.js` + `datahall-calculations.js` + `conv-engine.js` byte-identical; 57/57 + 22/22 + 75/75 probe tests pass on every push):

| Ship | Version | Commit | Page(s) | Scope |
|---|---|---|---|---|
| 1 | v1.41.0 | (earlier) | `all-in-one-dashboard.html` (NEW) + `geopolitics.html` | All-In-One Dashboard catalogue page; geopolitics link fix |
| 2 | v1.41.1 | `1695ea0` | `datahallAI.html` | STP modal full process flow (drainage→sump→bio-septic→MBBR→clarifier→sand-filter→AC-filter→UV→reclaim→irrigation) + MMR/TELECOM room added to Room Layout |
| 3 | v1.41.2 | `732ea2f` | `datahallAI.html`, `dc-conventional.html` | Water-quality Tech Spec — DC AI dry-only (7 new §) + DC Conv cooling-tower (9 new §) |
| 4 | v1.41.3 | `4f598bd` | `datahallAI.html` | Chillers relocated from Roof to Ground Floor (CW Distribution Manifold replaces Chiller Plant on roof; Chiller Plant Hall added to GF replacing Workshop B); Cooling P&ID label clarity (prefix temp badges, separate pump-station pressure/flow labels) |
| 5 | v1.41.4 | `403560f` | `datahall.html` | CRAH popover replaces modal (no main-screen disable); inline SAT on CRAH cells; per-cell rack ID + per-mode value (kW/°C/margin/%/IT); cold-aisle normalised to 22.0±0.3°C; excursion simulator (random zone+CRAH 10-15s every 2min) |
| 6 | v1.41.5 | `7d5acb9` | `water-system.html` | UV-401 / DOS-302 label overlap fixed; TK-402 Z-shape pipe routing → straight drop; CT-MK retag to MK-501 "Make-up Water System" |
| 7 | v1.41.6 | `5e9c054` | `ict.html` | Security HMI widgets: CCTV 16-cell mosaic with rec dot + 24h availability sparkline; Access Doors list (12 doors with LOCKED/UNLOCKED pills); Intrusion Zones SVG donut + 10-zone list. SEGMENTS.sec data expanded (services 4→8, caps 4→8, links 3→9) |

Owner-excluded `#p-dash` + `updateDashKPI()` + `dcCallouts` remain byte-identical throughout the sweep. Parallel `ai-engineering-maintenance.html` work (separate session) was stashed before each push and popped after to avoid bundle contamination.
