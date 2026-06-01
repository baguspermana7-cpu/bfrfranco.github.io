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

## Adoption plan

| Step | Page(s) | Register | Status |
|---|---|---|---|
| Reference | `rz-style-lab.html` | both (switchable) | ✓ live |
| 1 | plan landings (`planb.html`) | editorial | owner's other session |
| 2 | cockpit dark mode (datahallAI etc.) | instrument | pending — apply after owner confirms register split |
| 3 | index / articles / hubs | editorial | pending |

Cockpit application (step 2) must preserve the engine + `#p-dash` byte-identical rule and pass the 75/75 accuracy probe — the dark-system tokens are presentation-only.

## Files

- `css/rz-dark.css` — the shared stylesheet (tokens + base + atmosphere + motion CSS).
- `rz-style-lab.html` — living reference + character picker.
- `documentation/design.md` — brand bible; this standard is the dark-mode chapter.

## Out of scope this standard

- Light-mode redesign (separate; current toggle untouched).
- Per-component library (buttons/forms/tables) — follows once a register is applied to a real page.
- Chart data binding to live engines (cockpit charts already engine-bound; the motion layer is additive).
