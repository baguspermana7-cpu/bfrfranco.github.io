# DataHall AI Dashboard Standard
> Patterns, conventions, and lessons learned for `datahallAI.html`

Last updated: 2026-03-01 (Phase 5/6 update)

---

## File Structure

- **Single HTML file**: `datahallAI.html` (~6800+ lines)
- **3 script blocks**: 1 main (bulk), 1 auth/root-gate, 1 cookie/scroll
- All SVG rendering is done via IIFEs that build SVG string and assign to `el.innerHTML`
- Tab-based navigation: `p-bldg`, `p-hvac`, `p-rack`, `p-cool`, `p-elec`, `p-net`, `p-fire`, `p-bms`
- **Auth gating**: Root OR Pro access (body.locked + .root-gate overlay), auth.js loaded externally
  - Gate checks `s.role === 'root' || s.role === 'pro'` — demo account (pro role) CAN access
  - `ag()` called at 60ms, 550ms, 1600ms timeouts + on `rz-auth-change` event
  - Gate message must reflect "root or pro" not "root only"
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
3. **L2 Transformers**: 8× ABB RESIBLOC 10MVA cast-resin dry Dyn11, 2 per DH
4. **L3 LV Distribution**: 8× MSB 6300A Form 4b + LV Tie N.O. + outgoing feeders
5. **L4 ATS**: CB-Normal (CLOSED) + CB-Emergency (OPEN/STANDBY) + Interlock
6. **L5 UPS & Battery**: 8× Vertiv EXL S1 8MW + 8× Li-Ion NMC 1,333 kWh (no STS, dual-corded)
7. **L6 Busway & RPP**: 8× Canalis KTA 12,000A Cu → 88× RPP 800A MCCB tap-off
8. **L7 Rack Power**: 22 racks dual-corded PSU 400V→50VDC η>97%
9. **L8 Mech/NC/Cooling**: ATS-backed non-critical + cooling loads
10. **L9 Protection**: SPD, earthing, arc flash, metering, standards
11. **L10 KPI Dashboard**: Per-DH live values, 4-sec refresh

### Color-Coded Flow System (v5)
| Path | Color | CSS Var | Animation | Usage |
|------|-------|---------|-----------|-------|
| Feed A | Red | `var(--r)` | `.fD` 4s downward | All Source A power path elements |
| Feed B | Green | `var(--g)` | `.fD` 4s downward | All Source B power path elements |
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
| `eGen1..4` | 4 | GenSet status (RUN/STBY) |
| `eNC` | 1 | Non-critical total kW |
| `eCool` | 1 | Cooling total kW |
| `eLive` | 1 | Facility summary (IT MW, Total MW, PUE, Grid A) |

### Non-Critical Loads (DB-NC: 695 kW)
| Load | Rating | CB | Amps | PF |
|------|--------|-----|------|-----|
| AHU 1+2 | 2×150kW | 400A | 220A | 0.85 |
| VRV | 4×25kW | 200A | 145A | 0.92 |
| Lighting | 80kW | 200A | 116A | 0.95 |
| Fire | 30kW | 100A | 44A | 0.90 |
| Security | 20kW | 63A | 29A | 0.95 |
| BMS/EPMS | 40kW | 100A | 58A | 0.95 |
| Elevators | 60kW | 100A | 87A | 0.85 |
| WTP | 50kW | 160A | 72A | 0.92 |

### Cooling Loads (DB-COOL: 2,170 kW)
| Load | Rating | CB | Amps | PF |
|------|--------|-----|------|-----|
| Chillers | 4×350kW | 800A | 507A | 0.90 |
| CW Pumps | 4×75kW | 200A | 109A | 0.92 |
| DC Fans | 8×45kW | 100A | 65A | 0.85 |
| CDU Pumps | 22×5kW/hall | From UPS | Per rack | 0.95 |

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
