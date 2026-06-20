# RZ Dark Mode Standard — "RZ Dark System v1"

Status: **adopted 2026-05-26**. Reference implementation: `rz-style-lab.html` (4 candidate characters, switchable). Shared stylesheet: `css/rz-dark.css`.

Origin: owner flagged the existing cockpit dark mode as "AI design slop" and asked for (1) animated-data-on-load, (2) distinctive type, (3) intuitive PC/mobile responsive — referencing the refinement of raihankalla.id. The Style Lab explored four on-brand characters; this standard codifies the two that ship.

> **Decision (LOCKED 2026-06-01, owner "proceed all"):** HYBRID register split — **Instrument** register for cockpits + SLD/P&ID labs, **Editorial** register for landing / articles / hubs / plans. First editorial adoption shipped on `plan-dark-mode-standard.html`. Cockpit instrument re-skin queued (must preserve semantic SLD/alarm colours — additive atmosphere/type only).

## Core principle — two registers, one token system

RZ has two page families. Each gets a **register** of the same system — identical structure + motion + semantics, different surface character. Swap a page between registers by changing one `data-rz-register` attribute.

| Register | `data-rz-register` | Character | Used on |
|---|---|---|---|
| **Instrument** | `instrument` | Oscilloscope — phosphor-green/cyan, graticule grid, scanlines, JetBrains Mono display, animated traces | cockpits (datahallAI, dc-conventional, chiller-plant, EPMS, water/fire/fuel/ict), SLD/P&ID labs, market monitors |
| **Editorial** | `editorial` | Refined report — Fraunces serif display, generous whitespace, quiet accents, eased data viz | index, articles, hubs, plan landings, calculators' marketing shells |

Both registers are dark-only here; the existing light-mode toggle is unaffected.

## Anti-slop checklist (every dark page MUST pass)

These are the patterns that made the old dark mode read as generic. Banned:

1. ❌ Flat panels with **static** numbers. → Headline data must animate on first paint (trace-in / count-up / grow / sweep).
2. ❌ Evenly-distributed timid palette. → One **dominant** surface + **sharp** signal accents.
3. ❌ Generic body font (Inter / Roboto / system stack as the *character* font). → IBM Plex Sans/Mono + JetBrains Mono; Fraunces for editorial display.
4. ❌ Tailwind-default greys, Anthropic-purple, generic blue→purple gradients.
5. ❌ Rounded-everything. Instrument register radius ≤ 3px; editorial ≤ 10px.
6. ❌ Glassmorphism / neumorphism / dot-grid noise / cursor-tracking 3D tilt.
7. ❌ Decorative motion with no meaning. Motion must encode data or state, or be a single orchestrated load reveal.

## Tokens (shared core)

Defined in `css/rz-dark.css` under `[data-rz-register]`. Base ramp + signal semantics are shared; surface + accent + type differ per register.

### Signal-colour semantics (shared, non-negotiable — matches ACCURACY + ALARM standards)

| Token | Meaning |
|---|---|
| `--rz-ok` (green) | normal / running / healthy |
| `--rz-warn` (amber) | warning / degraded / approaching limit |
| `--rz-fault` (red) | alarm / trip / fault |
| `--rz-info` (cyan) | information / cooling-water domain |
| status **always wins** over domain colour (see `ALARM_STATE.md` `resolveColor()`) |

### Instrument register
```
--rz-bg:#060A0D  --rz-bg2:#0A1014  --rz-panel:#0C141A
--rz-text:#C8E6D4  --rz-text-strong:#EAFBF0  --rz-muted:#5E8472
--rz-accent:#22F5A8 (phosphor green)  --rz-accent2:#2BE8FF (instrument cyan)
--rz-display:'JetBrains Mono'  --rz-sans:'IBM Plex Mono'  --rz-radius:3px
atmosphere: graticule grid + faint scanlines + radial glow
```

### Editorial register
```
--rz-bg:#0E0F12  --rz-bg2:#141519  --rz-panel:#16181D
--rz-text:#CFD3DA  --rz-text-strong:#F6F7F9  --rz-muted:#7E8590
--rz-accent:#E8B563 (warm signal-amber)  --rz-accent2:#6FBF9A (muted green)
--rz-display:'Fraunces' (serif)  --rz-sans:'IBM Plex Sans'  --rz-radius:10px
atmosphere: two calm radial washes, no grid
```

## Typography scale (shared)

| Role | Family | Size | Weight | Tracking |
|---|---|---|---|---|
| Display H1 | `--rz-display` | clamp(2.1rem,6vw,3.9rem) | 600 (700 instrument) | -0.02em |
| Section H2 | `--rz-display` | clamp(1.4rem,2.6vw,2rem) | 600 | -0.01em |
| Body | `--rz-sans` | 15px / 1.6 | 400 | 0 |
| Kicker / label | `--rz-mono` | 0.68rem | 600 | 0.18–0.2em, uppercase |
| KPI value | `--rz-display` | 1.7rem | 700 | tabular-nums |

## Motion primitives (shared) — the "animated on load" requirement

Implemented as vanilla JS helpers (no deps) — see `css/rz-dark.css` companion notes + `rz-style-lab.html` chart renderers. Every primitive honours `prefers-reduced-motion` (renders final state instantly).

| Primitive | Mechanism | Used for |
|---|---|---|
| **trace-in** | `stroke-dashoffset` L→0, cubic-ease, optional sweep dot | line / waveform charts |
| **plot-in** | path draw + area fade | schematic area charts |
| **grow** | bar height 0→full, staggered | bar readouts |
| **count-up** | `requestAnimationFrame` number interpolation | KPI values |
| **sweep** | donut `stroke-dasharray` arc | ratio / share charts |
| **stagger reveal** | `[data-enter]` + IntersectionObserver, `animation-delay` per child | section entrance |

Default ease: `cubic-bezier(.2,.7,.2,1)`; default load duration 1.3–1.5s.

## Responsive rules (shared)

- Switcher / nav → horizontal scroll strip < 760px.
- KPI strips 4-col → 2-col < 760px → 1-col < 420px.
- Charts stay full-bleed (`width:100%`, `viewBox` + `preserveAspectRatio`), never fixed-px.
- Touch targets ≥ 44px. Honours the site's mobile-responsive audit (≥7/10).

## Component library (canonical — instrument register)

Reference renders live in `rz-skin-gallery.html` (surfaces 01–12, before vs after). The four below
were re-specified 2026-06-01 after the owner flagged the first pass as still-slop. These are the
**canonical component specs**; every cockpit re-skin must reproduce this grammar, not a colour swap.

### Alarm summary — ISA-18.2 (surface 07)

The alarm surface is an **alarm summary list**, not a row of coloured pills. Grammar:

- **Priority** is a left-edge colour bar, 4 classes (ANSI/ISA-18.2 ordering):
  `P1 critical #ef4444 · P2 high #f59e0b · P3 medium #eab308 · P4 low #3b82f6`. A legend declares them.
- **State** column uses ISA-18.2 state names, never colour alone:
  `UNACK` (red, **blinking** `almblink 1.1s step-end` — the only sanctioned blink on the site,
  honours `prefers-reduced-motion`), `ACK` (amber, steady), `RTN` (green — returned-to-normal),
  `SHLV` (violet — shelved). Add `SUPP` / `OOS` as needed.
- Columns: `priority-bar · time(HH:MM:SS) · tag · description · state`. JetBrains Mono, tabular.
- Status **always wins** over domain colour (see `ALARM_STATE.md resolveColor()`).

### Data-quality + simulation (surface 08)

A value is never shown bare. The DQ card carries:

- a **SIM ribbon** (`.simrib`, violet, pulsing dot) whenever the source is simulated;
- the **value** + a quality **state chip** (`live` / `stale Ns` / `sim` / `uncertain`);
- a **DQ meter** (`.dqbar`, 0–100, amber→green gradient by score);
- a **provenance line** (`.dqmeta`): `DQ score · source tag · age vs threshold · fallback`.

### Controls — buttons (surface 11)

Instrument button set, 3px radius, JetBrains Mono, uppercase, `:active` depresses 1px:

- **primary** (`.btn`) phosphor-filled with glow · **secondary** (`.btn.sec`) phosphor outline ·
  **danger** (`.btn.danger`) red outline, guarded (used for TRIP / EPO) · **disabled** (`.btn.dis`).
- Editorial register variant: amber fill / amber outline, 8px radius, no glow.

### Data table (surface 12)

Instrument equipment table:

- JetBrains Mono; **hairline** rows (`rgba(43,232,255,.08)`); header mono-uppercase with cyan rule.
- Numeric columns **right-aligned** + `font-variant-numeric:tabular-nums` (`.num`).
- State rendered as a **chip** (`live` / `stale` / `unack`), not coloured text.
- **Alarm row** highlight: `tr.alarm` → red tint + 3px red left inset on first cell.

## Comprehensive rollout plan

Two register tracks, sequenced so the lowest-risk, highest-visibility work ships first. Each page
adoption is gated by the **per-page checklist** below.

### Track E — Editorial (content surfaces)

| Phase | Pages | Status |
|---|---|---|
| E0 reference | `plan-dark-mode-standard.html`, `planb.html`, plan pages | ✓ shipped |
| E1 article pilot | `article-26.html` (editorial register via `css/rz-article-dark.css`) | **APPROVED — build next** |
| E2 article batch | articles 1–25, batched 3–4 per ship, per-series accent override | queued |
| E3 index (dark) | `index.html` dark mode **polished** — kept the colourful bento character; layered surfaces + visible per-card accents + hover lift + staggered reveal; pure CSS, dark-only | **✓ shipped v1.43.14** |
| E3 index (light) | `index.html` light mode **polished** — day twin of the dark polish (layered surfaces + accent glow + hover lift; `bentoRise` reveal made theme-agnostic) | **✓ shipped v1.43.18** |
| E3b hubs | `articles.html`, `insights.html`, `datacenter-solutions.html` | queued |
| E4 calc shells | calculator marketing shells (chrome only; engine untouched) | queued |

> **Index direction note (2026-06-14):** owner rejected both dark *reskins* — editorial-serif read like an article, instrument-mono read colder/emptier than the live page. Locked direction = **POLISH the current bento, not reskin** (keep emerald + pastel + rounded + Inter; raise dark-mode quality only). Mock: `rz-index-polish.html`. The "instrument register on the homepage" idea is **not** applied to index — index stays editorial-leaning but *polished*; instrument register remains cockpit-only.

### Track I — Instrument (cockpit surfaces)

| Phase | Pages | Status |
|---|---|---|
| I0 primitive | `datahallAI.html #p-dash` count-up (v1.43.5, probe-safe) | ✓ shipped |
| I1 component lib | port surfaces 07/08/11/12 specs into the shared cockpit CSS | **next** |
| I2 first cockpit | one full cockpit (recommend `chiller-plant` or `datahallAI`) — tokens + atmosphere + alarm/DQ/table grammar | queued |
| I3 cockpit sweep | dc-conventional · water · fire · fuel · EPMS · ict | queued |
| I4 labs + monitors | SLD/P&ID labs · market monitors | queued |

### Per-page adoption checklist (every page MUST pass before ship)

1. ☐ `data-rz-register` declared; tokens inherited from `css/rz-dark.css` (no per-page colour redefs).
2. ☐ Headline data **animates on first paint** (trace/grow/count-up/sweep) + honours `prefers-reduced-motion`.
3. ☐ Type: instrument = Plex Mono + JetBrains Mono; editorial = Plex Sans + Fraunces display. No Inter-as-character.
4. ☐ Radius ≤ 3px (instrument) / ≤ 10px (editorial). No glassmorphism / dot-grid / neumorphism.
5. ☐ Signal semantics intact — status wins over domain; alarm states use the ISA-18.2 grammar above.
6. ☐ Components (alarm/DQ/button/table) match the canonical specs, not ad-hoc colour swaps.
7. ☐ Responsive: KPI 4→2→1 col; charts full-bleed; touch ≥44px; mobile audit ≥7/10.
8. ☐ **Cockpit only:** engine + `#p-dash` byte-identical; 75/75 accuracy probe green (tokens are presentation-only).
9. ☐ Version bump + CHANGELOG + the standard audit gate.

### Acceptance gate

A page is "RZ-Dark-adopted" only when all 9 checklist items pass AND it visually matches the
corresponding `rz-skin-gallery.html` "after" surface. The gallery is the spec; pages conform to it.

## Files

- `css/rz-dark.css` — shared stylesheet (tokens + base + atmosphere + motion).
- `css/rz-article-dark.css` — editorial article register (Track E).
- `rz-style-lab.html` — character picker (4 variants).
- `rz-skin-gallery.html` — **the 12-surface component spec** (before/after); canonical reference for I1.
- `rz-cockpit-mockup.html` · `rz-article-mockup.html` — register before/after mockups.
- `plan-dark-mode-standard.html` — the plan landing (PLAN 02 on the Plan B hub).
- `documentation/design.md` — brand bible; this standard is its dark-mode chapter.

## Out of scope this standard

- Light-mode redesign (separate plan; current toggle untouched).
- Chart data binding to live engines (cockpit charts already engine-bound; the motion layer is additive only).
