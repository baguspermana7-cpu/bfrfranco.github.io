# DataHall AI Dashboard Standard

> **Last reviewed: 2026-08-26** · Status: `ACTIVE` · Release: `v1.130.0`
>
> Canonical feature key remains `datahall-ai`; the implementation filename remains
> `datahallAI.html`. Access is root plus the explicit educator-role exception. A plain
> Pro session does not satisfy `page-access`.

> Patterns, conventions, and lessons learned for `datahallAI.html`

Last updated: 2026-08-26 (operator workflows and platform-study update)

---

## v1.130.0 Operator-workspace contract

This release adds evidence-oriented operator workspaces without replacing the established
P&IDs, SLD, rack diagrams, engineering model, or Scenario A calculations.

### Capacity boundaries (never merge these projects)

| Scope | Current/adopted basis | Study-only basis |
|---|---|---|
| DC AI/HPC | 4 halls × 3.564 MW IT; 27 logical GB200 NVL72 domains/hall in the project-specific split form; 2 physical positions/domain; 54 positions/hall; 66 kW/position; 14.256 MW facility IT | GB300 reference at 142 kW per integrated rack/domain: 27 racks/hall, 3.834 MW/hall, 15.336 MW/facility, 5.990625 kW/m² gross hall IT density. Never mutates Scenario A. |
| DC Conventional | `CONV_CALC` current snapshot: 1.850 MW IT and PUE 1.45 | Campus capacity plan: 4 halls × 10 MW IT = 40 MW. It is not current telemetry and requires Engineer-of-Record validation. |

Density means `IT load per hall / gross hall floor area`. The public field is
`hallItDensityKWPerM2`; the ambiguous `densityKWPerM2` name is retired.

### Alarm & Events workspace

- Source of truth: `js/datahall-ai/alarm-query.js`; presentation:
  `js/datahall-ai/operator-ui.js`.
- Composable filters: From/To, tag or point, system, severity, lifecycle, quality,
  analog comparator/value, previous/current discrete state, event, action, free text,
  plus validated nested AND/OR groups.
- Saved views and first-out are deterministic. First-out is grouped by stable incident
  identity, never by a collision-prone display string or a newly filtered subset. The UI
  intersects visible records with source `firstOutIds` provenance.
- Invalid filters clear stale rows, all local counters and stale detail, mark the form
  invalid, and disable export until a valid query succeeds. Query-result counters never
  write into the independently refreshed live BMS health KPIs.
- Export includes filter metadata, source first-out provenance, requested-by, and capture
  time. CSV output is a local browser download; it does not imply a historian connection.
  Formula-leading spreadsheet cells (`=`, `+`, `-`, `@`) are neutralized before download.
- Operational terminology follows the lifecycle direction of ISA-18.2 / IEC 62682.
  All shipped records are labelled simulated fixtures.

### Electrical semantic-state rule

- Source of truth: `js/datahall-ai/electrical-topology.js`; visual projection contract:
  `js/datahall-ai/electrical-visual-map.js`; four-second basis renderer:
  `js/datahall-ai/electrical-live.js`.
- Animation is a projection of evaluated edge state. CSS color or a legacy SVG class is
  never allowed to decide whether a conductor is energized.
- Every animated conductor binds to an exact topology edge or an explicit rack-edge prefix.
  Unknown conductors fail closed; known normally-open ties render `open`, not `energized`.
- Overview is a declared four-hall projection (216 physical positions). A DH tab is a
  one-hall projection (54 positions); hidden halls are `out-of-scope`, not silently painted.
- Each rendered segment exposes semantic state, evaluated source IDs, and topology edge IDs.
  Utility/generator transfer, busway trip, and rack-feed loss must be visibly traceable all
  the way through the selected hall to the rack-bank boundary.
- Scenarios must report rack service, redundancy (`2N`, `DEGRADED`, `LOST`, or
  `COMMON_SOURCE`) and a sequence-of-events timeline.
- De-energized conductors are quiet gray and non-animated. Feed A/B/generator colors are
  secondary cues; summary text and topology state remain authoritative.
- The live timer may jitter instrument readings such as voltage, current, SOC, temperature,
  or efficiency inside their stated simulation bands. It must never randomize IT/facility
  load, PUE, cooling/auxiliary basis, equipment count, or generator state. Those fields bind
  to `DHE` and the selected semantic scenario on initial render and every 4-second tick.
- Generator-pool state must be projected per unit, not copied from one aggregate flag. On a
  successful source-loss transfer the adopted N+1 basis is 7 RUNNING + 1 STANDBY; normal is
  0 RUNNING + 8 STANDBY, and a failed/unavailable pool fails closed at every installed unit.
  The reconciled heading must include the failed-unit count whenever it is non-zero.
- A live-render exception must invalidate every field owned by the renderer (hall IT/facility,
  auxiliary, cooling, generator units, pool summary and facility summary). Showing stale values
  beside only one error message is forbidden.

### CDU current-state rule

- Selected-hall current basis is **9 running / 12 installed**, 350 kW nameplate each,
  derived from `ceil(3,029.4 / 350) = 9`. Facility inventory is 48 installed across four halls.
- A current-state view must use `DHE.cduRunning`, `DHE.cduInstalled`, `DHE.liquidHeat`, and
  `DHE.tcsFlowTotal`; legacy 24-CDU / 22-pump labels are forbidden unless explicitly isolated
  and labelled as a separate study.
- Standby units remain visible and non-animated. A running CDU shows the engine-derived
  per-unit duty; plant-header flow cannot be multiplied into a selected-hall heat KPI.

### Fire cause-and-effect rule

- Source of truth: `js/datahall-ai/fire-cause-effect.js`.
- The FACP owns control authority. BMS/DCIM records and annunciates; it never becomes the
  releasing controller.
- Effects are zoned and can include notification, elevator recall, egress-door release,
  AHU/CRAH and smoke-control sequence, clean-agent preparation/release, zoned EPO, PA,
  fire-brigade/NOC notification, CCTV focus, and generator protection interactions.
- Clean-agent release fails closed: elapsed time alone is insufficient. Required proofs,
  permissives, abort/inhibit state, and reset authority are explicit data.
- A generic global building shutdown is forbidden; the engineered event/zone matrix decides.

### Shared Design Studio

- `js/rz-design-studio.js` and `css/rz-design-studio.css` provide one accessible modal
  contract for both DC types: labelled dialog, keyboard trap, Escape, overlay close, and
  focus return.
- Default scope is always the locked current design. Study appendices require an explicit
  operator selection.
- A generated document captures one immutable engine snapshot and records document type,
  scope, revision note, capture time, and provenance. Study data is appended; it cannot
  write into either calculation engine.

### Required regression gates

```text
node tools/test-datahall-ai-alarm-query.mjs
node tools/test-datahall-ai-rack-density.mjs
node tools/test-datahall-ai-cdu-basis.mjs
node tools/test-datahall-ai-electrical-topology.mjs
node tools/test-datahall-ai-electrical-live.mjs
node tools/test-datahall-ai-fire-cause-effect.mjs
node tools/test-datahall-ai-operator-ui.mjs
node tools/test-datahall-ai-operator-runtime.mjs
node tools/test-datahall-ai-electrical-visual-map.mjs
node tools/test-datahall-calc.mjs
```

Browser evidence must cover desktop, tablet, and 390 px; normal pointer navigation; modal
focus return; internal table scrolling; zero document overflow; and no uncaught page error.

### Lessons learned

1. A data-model field rename can silently render `NaN`; integration tests must assert the
   public property name and a real rendered number.
2. Monolithic SVG pages can contain duplicate DOM IDs across unrelated panels. New
   workspaces must reserve unique prefixes (`alarm*`, `electrical*`, `fireCauseEffect*`).
3. A sticky header can cover a non-sticky tab rail after the page scrolls. Desktop stacks
   header + rail; narrow layouts keep a bounded horizontally scrollable rail.
4. Hardware-generation comparisons are reference studies until the owner/EoR adopts a new
   baseline. Newer does not mean current.
5. A vendor-style `72×1` label cannot be attached to a project-specific two-position split
   baseline. Keep the adopted project basis and vendor reference studies visibly distinct.
6. Role-wide animation fallback can make dead conductors look live. Exact edge mapping plus
   scenario parity tests are required before a topology animation is accepted.
7. A visually correct initial SVG can regress four seconds later when an old telemetry timer
   rewrites engine values. Exercise the scheduled callback and assert the post-tick DOM, not
   only first paint.
8. Mixing facility plant inventory, selected-hall terminal equipment, and a discarded legacy
   design produced a false 24-CDU current state. Every equipment count must carry its scope and
   derive from one adopted basis.

## File Structure

- **Primary HTML shell**: `datahallAI.html` (legacy monolith; new pure data modules live in `js/datahall-ai/`)
- **3 script blocks**: 1 main (bulk), 1 auth/root-gate, 1 cookie/scroll
- All SVG rendering is done via IIFEs that build SVG string and assign to `el.innerHTML`
- Tab-based navigation includes dedicated `p-alarms` alongside the existing dashboard, hall, room, rack, cooling, electrical, network, fire and BMS panels.
- **Auth gating**: Root OR educator-role exception (body.locked + .root-gate overlay), shared auth/feature flags loaded externally
  - `page-access` is root-only; `role=educator` is admitted explicitly. Plain Pro, demo and free remain locked.
  - `ag()` called at 60ms, 550ms, 1600ms timeouts + on `rz-auth-change` event
  - Gate message must reflect the canonical root-or-educator policy.
- **Building tab sub-navigation**: Isometric 3D overview → click floor → 2D floor plan detail (back button)

## SVG Rendering Pattern (IIFE)

Every tab's SVG follows this pattern:

```javascript
$('tabSu').textContent = 'Summary text...';
(function(){
  const el = $('tabC'); if(!el) return;
  let s = '';
  // Build SVG string using helper functions
  s += bx(x,y,w,h,color);    // rect box
  s += tx(x,y,text,color,size,anchor,bold);  // text label
  s += fl(x1,y1,x2,y2,color,class,opacity,strokeWidth); // flow line
  s += symCB(cx,cy,color,closed);  // circuit breaker symbol
  s += symTX(cx,cy,color);         // transformer symbol
  s += symUPS(cx,cy,color);        // UPS symbol
  s += symGen(cx,cy,color);        // generator symbol
  s += symMeter(cx,cy,color,label); // metering symbol
  el.innerHTML = s;
  // Live update interval
  setInterval(()=>{ /* update live IDs */ }, 3000-4000);
})();
```

### Key Rules
1. **IIFE isolation**: Each tab SVG is a self-contained IIFE
2. **String concatenation**: Build entire SVG as string, assign once via `innerHTML`
3. **Helper functions** are defined globally (lines ~577-601), not inside IIFEs
4. **Live values**: Use `class="lv"` on text elements, unique `id` attributes, updated by `setInterval`
5. **Tooltips**: Use `data-tip="..."` attribute on `<g>` wrappers — tooltip system reads these on hover
6. **Animated flow**: CSS classes `fR` (flow right), `fL` (flow left), `fU` (flow up), `fD` (flow down)
7. **Color variables**: `var(--o)` orange, `var(--g)` green, `var(--r)` red, `var(--b)` blue, `var(--c)` cyan, `var(--p)` purple, `var(--pk)` pink

## SVG viewBox Sizes

| Tab | viewBox | Notes |
|-----|---------|-------|
| Building (hSvg) | 960 480 | Floor plan with clickable racks |
| Rack (rackSvg) | varies | Per-rack detail |
| Cooling (coolSvg) | 960 750 | Full P&ID |
| **Electrical (elecSvg)** | **960 3800** | Full facility SLD — very tall, scrollable |
| Network (netSvg) | 960 520 | Fat-tree topology |
| Fire (fireSvg) | 960 580 | Detection & suppression |
| BMS (bmsSvg) | 960 480 | BMS/DCIM architecture |

## CRITICAL: SVG Layout Anti-Overlap Rules

When building complex SVGs with multiple columns (like the 4-DH electrical SLD):

1. **Column spacing**: Minimum 150px between column centers. The SLD uses C=[170,320,470,620] (150px spacing). NEVER use <100px — causes text overlap
2. **Vertical section spacing**: Each level section needs 250-380px of vertical space. Use section Y constants (S1,S2,S3...) at the top of the IIFE for easy adjustment
3. **Font sizes**: Minimum 4px for any readable text. Use 5-6px for labels, 7-8px for section headers. Never use 2.8-3px — unreadable and overlaps
4. **Breaker labels**: A breaker with ID + rating + specs needs ~50px vertical space (y-16 to y+36). Account for this when spacing elements vertically
5. **Right panel clearance**: If using a right-side spec panel (x=725+), ensure the rightmost column (C[3]) elements don't extend past x=700
6. **Section headers**: Use full-width colored bars (`sH()` helper) to visually separate levels
7. **Equipment boxes**: Use `bx()` with minimum 100×55px for equipment with 3+ lines of text
8. **Bus bars**: Horizontal bus bars need 6-8px height + 6px label above + 16px live value below = 30px total vertical footprint
9. **MV section uses full width** (no right panel) since PLN A (left) and PLN B (right) need the space
10. **Right panel starts at Level 2** (TX section) where the layout narrows to 4 DH columns

## Electrical SLD Architecture (4 Data Halls) — v5

### Hierarchy (11 Levels, L0-L10)
1. **L0 MV Switchgear**: PLN 20kV dual feed → SM6 24kV 11-panel (2 Inc + 1 Tie + 8 Fdr) + GenSet APS
2. **L1 RMU**: Per-DH Schneider RM6 3-panel (Feed A VCB + Bus Tie + Feed B VCB)
3. **L2 Transformers**: 8× 5 MVA cast-resin dry Dyn11, 2 per DH
4. **L3 LV Distribution**: 8× MSB 6300A Form 4b + LV Tie N.O. + outgoing feeders
5. **L4 ATS**: CB-Normal (CLOSED) + CB-Emergency (OPEN/STANDBY) + Interlock
6. **L5 UPS & Battery**: 8× 4.5 MW modular UPS + 8× Li-Ion NMC 1,333 kWh (no STS, dual-corded)
7. **L6 Busway & RPP**: 8× Canalis KTA 6,300A Cu → 88× RPP 800A MCCB tap-off
8. **L7 Rack Power**: 4 halls × 54 physical rack positions / 27 logical NVL72 domains; dual-corded PSU 400V→50VDC η>97%
9. **L8 Mech/NC/Cooling**: ATS-backed non-critical + cooling loads
10. **L9 Protection**: SPD, earthing, arc flash, metering, standards
11. **L10 KPI Dashboard**: Per-DH live values, 4-sec refresh

### Color-Coded Flow System (v5)
| Path | Color | CSS Var | Animation | Usage |
|------|-------|---------|-----------|-------|
| Feed A | Blue | `var(--b)` | semantic `.rz-flow-active` only | All Source A power path elements; red remains alarm/trip only |
| Feed B | Green | `var(--g)` | semantic `.rz-flow-active` only | All Source B power path elements |
| Dead/Standby | Gray | `rgba(107,114,128,.35)` | NONE, dashed `4 3` | GenSet, open breakers, standby circuits |
| Bus Tie N.O. | Purple | `var(--p)` | NONE, dashed `6 4` | MV/RMU/LV tie breakers |
| ATS Mech | Orange | `var(--o)` | `.fD` downward | Mechanical load path via ATS |

### Side-Label Pattern (v5)
- Feed A elements at AX=300: labels to **RIGHT** of CB symbol (`'R'`)
- Feed B elements at BX=700: labels to **LEFT** of CB symbol (`'L'`)
- Saves ~30px per breaker vs below-label pattern (v4 used ~50px per CB)
- Center elements (Bus Tie, etc.) still use below-label pattern

### Continuous Connection Rule (v5)
- Every level transition uses `connector(x, yFrom, yTo, color, 'fD')`
- Includes animated flow line + arrowhead at bottom showing flow direction
- No gaps > 5px between connected elements
- Red connectors for Feed A path, green for Feed B path

### Compact ViewBox (v5)
- Per-DH SVG: `1200×2400` (was 1200×3800 in v4)
- ViewBox set dynamically: `svgEl.setAttribute('viewBox','0 0 '+W+' '+H)`
- Y-coordinates: L0=30, L1=200, L2=340, L3=480, L4=610, L5=740, L6=890, L7=1380, L8=1510, L9=1750, L10=1950

### Breaker Label Pattern
Side-label CB (v5 default for Feed A/B breakers):
```
[CB] ── CB-ID              (beside at x±14)
          rating | specs    (beside, 9px below)
```
Center-label CB (Bus Tie, etc.):
```
CB-ID [rating]
kW | V | A | PF
```

### Live Value ID Convention
| ID Pattern | Count | Description |
|------------|-------|-------------|
| `eMSB1..4` | 4 | MSB voltage/amps/PF per DH |
| `eBw1a..8b` | 8 | Busway voltage/amps/load% (a=Feed A, b=Feed B) |
| `eBat1a..8b` | 8 | Battery SOC% |
| `eOvGen1..8` | 8 | Per-unit facility generator state; selected scenario plus 7+1 N+1 basis |
| `eOvGenPoolTitle` | 1 | Reconciled running/standby count for the facility generator pool |
| `eNC1..4` | 4 | PUE auxiliary basis, 75 kW/hall |
| `eCool1..4` | 4 | PUE cooling basis, 849 kW/hall |
| `eLive` | 1 | Facility summary: 14.26 MW IT, 18.55 MW total, PUE 1.30 |

### Engine-bound per-hall power basis

| Basis component | Current value | Authority |
|---|---:|---|
| IT load | 3,564 kW | `DHE.itHall` |
| Chiller input | 524 kW | `DHE.pb_chiller` |
| Pumps, fans, CDU and CRAH | 325 kW | `DHE.pb_cooling - DHE.pb_chiller` |
| Cooling total | 849 kW | `DHE.pb_cooling` |
| UPS/distribution loss | 150 kW | `DHE.pb_upsDist` |
| Auxiliary | 75 kW | `DHE.pb_aux` |
| Non-IT total | 1,074 kW | `DHE.pb_nonIT` |
| Facility total | 4,638 kW | `DHE.pb_facility` |
| CDU pump connected / running | 12×5 / 9×5 kW | installed / active current basis |

## In-Rack CDU HMI (Vertiv CoolChip CDU 121)

### Temperature Ranges (Correct Values)
| Sensor | Circuit | Correct Range | Notes |
|--------|---------|---------------|-------|
| T1 | Primary Supply (from TCS loop) | 32-34°C (~33°C) | TCS warm water, NOT chilled water |
| T5 | Primary Return (back to TCS) | 42-44°C (~43°C) | After heat exchange with secondary |
| T2a | Secondary Supply (to cold plates) | 35-37°C (~37°C) | Warmed by ~3°C HX approach ΔT |
| T4 | Secondary Return (from cold plates) | 48-52°C (~48°C) | After GPU heat pickup |
| T2c | Room/Controller | 35.2-37.2°C | Ambient sensor |

### Critical Lesson: In-Rack CDU vs End-of-Row CDU
- **In-Rack CDU** (CoolChip CDU 121): Connects to **TCS loop** (warm building coolant ~33°C/43°C)
- **End-of-Row CDU**: Handles the **FWS↔TCS** heat exchange (chilled water ~12°C/20°C)
- An in-rack CDU's primary circuit should NEVER show chilled water temps (12°C) — that's an EoR CDU characteristic

### HMI Modal Rendering
- `renderInRackCduHmi(el, rackId)` builds complete P&ID schematic
- Auto-refreshes every 3 seconds when visible
- Components: T1, FM(6), Plate HX(4), T2a, PS2, Filter(11), VFD Pump(1), PS3 → Rack (supply)
- Return: Rack → Relief(8), T4, PS1 → HX → 3-Way Valve(7) → T5 → exit
- Fill system: Fill Pump(5), WLS(10), Drain(9), Tank(12)

## MC Card Pattern (elecCards)

Cards use the `mc()` function. Standard order for electrical tab:
1. MV Switchgear (orange)
2. Transformers (orange)
3. Generator System (red)
4. UPS System (green)
5. Non-Critical Loads (cyan)
6. Cooling Loads (blue)
7. Metering & SCADA (cyan)

## Helper Function Custom Extensions

For complex SLDs, define additional helpers **inside** the IIFE:
```javascript
// Breaker with full labels
function brk(x,y,id,rating,kw,v,a,pf,c) { ... }
// Equipment block with specs
function eqBlock(x,y,w,h,id,label,specs,c) { ... }
// Section header bar
function secHdr(y,label,c) { ... }
// Bus bar with optional live value
function busBar(x,y,w,label,c,liveId) { ... }
```
These supplement the global `bx`, `tx`, `fl`, `symCB`, `symTX`, `symUPS`, `symGen`, `symMeter`.

## Zoom & Pan System

SVG containers use CSS classes:
- `.svg-zw` — zoom wrapper
- `.svg-zi` — scrollable inner (cursor: grab)
- `.svg-zb` — sticky button bar (zoom +, -, reset, level display)
- Max height: `calc(100vh - 160px)`

The zoom system is initialized in the main script (line ~5920+) and applies to all SVG IDs.
