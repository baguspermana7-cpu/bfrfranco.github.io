# BMS Shell — Shared Operations-Console Standard (v1.23.0+)

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
