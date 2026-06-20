# Cockpit Instrument Re-skin — Detailed Plan (v1.43.18 → v1.43.2x)

> Owner approved the cockpit instrument re-skin (2026-06-14). Owner mandate:
> "ensure you create plan detail and no mistake its huge task." This is that plan.
> Status: PLANNING. Reference CSS already drafted (`css/rz-cockpit-instrument.css`)
> but NOT yet attached to any page — zero risk until a page opts in.

## 0. Why this is high-risk (the "no mistake" constraints)

Cockpit pages are NOT content pages. Three hard invariants must hold on EVERY ship:

1. **SVG semantic colours are load-bearing.** Feed-A blue / Feed-B green / trip-red
   / cooling-cyan / alarm states encode operational meaning (see ACCURACY_VALIDATION
   + ALARM_STATE). The re-skin MUST NOT touch any SVG `stroke` / `fill`.
2. **Engine values must stay byte-identical.** `#p-dash` KPIs, telemetry, and all
   engine-bound text are gated by `probe-accuracy-validation.mjs` (75/75) +
   `test-datahall-calc.mjs` (57/57) + `test-conv-calc.mjs` (22/22). The re-skin is
   presentation-only; these must stay green every ship.
3. **Light mode must stay untouched.** Several pages have a light theme
   (datahallAI 99 rules, dc-conventional 36). The instrument skin is dark-only,
   gated `:not([data-theme="light"])`.

## 1. Strategy — additive + scoped, chrome-only

A single shared stylesheet `css/rz-cockpit-instrument.css`, activated per-page by
`<html data-rz-register="instrument">`, gated `:not([data-theme="light"])`.

It styles ONLY page chrome:
- page atmosphere (graticule + faint scanlines via `body::before/::after`, z-index 0)
- heading/display type → JetBrains Mono (`.hdr h1`, `.bx h3`, `.cd h4`, `.sb h4`)
- panel borders → cyan hairline + 3px radius (`.bx`, `.cd`, `.k`)

It NEVER selects: `svg`, `path`, `line`, `rect[stroke]`, `[id^=dk]`, `.tele`, `#p-dash *`,
`.flow`, `.energized-*`, or any data-value element. No `stroke`/`fill` declarations exist
in the file (grep-verifiable gate).

## 2. Page inventory + per-page treatment

| Page | Body font now | Light rules | Engine | Treatment | Risk |
|---|---|---|---|---|---|
| datahallAI.html | Space Grotesk | 99 | yes (#p-dash) | full chrome skin | HIGH (light + engine) |
| dc-conventional.html | mixed | 36 | yes (CONV) | full chrome skin | HIGH (light + engine) |
| chiller-plant.html | mixed | 0 (dark-only) | yes | chrome skin | MED |
| water-system.html | mixed | 0 | yes | chrome skin | MED |
| fuel-system.html | mixed | 0 | yes | chrome skin | MED |
| fire-system.html | JetBrains Mono | 0 | yes | atmosphere only (already mono) | LOW |
| ict.html | JetBrains Mono | 0 | yes | atmosphere only | LOW |
| EPMS_Telemetry.html | JetBrains Mono | 0 | yes | atmosphere only | LOW |
| datahall.html | JetBrains Mono | 0 | yes | atmosphere only | LOW |

Note: fire/ict/EPMS/datahall already use JetBrains Mono — they only need the
graticule atmosphere, not a font swap. So the skin's font rules are no-ops there.

## 3. Ship sequence (one page per ship, verify before next)

- **v1.43.18 — datahallAI.html pilot** (highest risk first, most scrutiny).
  Attach `data-rz-register="instrument"` + the CSS link. Gates:
  75/75 accuracy probe + 57/57 datahall + line-model probe + audits + dark/light
  screenshot before/after. If ANY engine value or SVG colour shifts → revert.
- **v1.43.19 — dc-conventional.html** (second light-mode page). Same gates +
  22/22 conv.
- **v1.43.20 — chiller + water + fuel** (dark-only, MED risk; can batch 3).
- **v1.43.21 — fire + ict + EPMS + datahall** (atmosphere-only, LOW risk; batch 4).

## 4. Per-ship verification checklist (MANDATORY, in order)

1. `grep -E 'stroke|fill|#p-dash|dkPue|\.flow|energized' css/rz-cockpit-instrument.css`
   → MUST return nothing (proves chrome-only).
2. `python3 tools/audit-script-tags.py --strict` + `audit-js-syntax --strict`
   + `audit-version-stamp --strict`.
3. `node tools/probe-accuracy-validation.mjs` → 75/75 (engine values unchanged).
4. `node tools/test-datahall-calc.mjs` → 57/57 ; `test-conv-calc.mjs` → 22/22.
5. `node tools/probe-line-model.mjs` → line/breaker tags intact.
6. Headless screenshot: DARK = atmosphere + mono headings present; sample 3 SVG
   stroke colours (feed-A blue, trip-red, cooling-cyan) UNCHANGED vs before.
7. Headless: LIGHT mode → body font + panels UNCHANGED (skin inert).
8. Engine spot-check: dkPue/dkIt/dkGpu text identical to pre-skin values.
9. Before/after screenshot sent to owner (visual mandate).

## 5. Rollback plan

The skin is two lines per page (`data-rz-register` attr + one `<link>`). If a ship
fails any gate, remove those two lines → page reverts byte-identical. No SVG/engine/
inline-CSS was ever edited, so revert is trivial and total.

## 6. Out of scope (explicitly NOT in this plan)

- Any change to SVG rendering, breaker symbols, line colours, or alarm states.
- Any change to engine files (datahall-model/calculations, conv-engine) — byte-identical.
- Any change to `#p-dash` displayed values.
- Animated-on-load for cockpit charts beyond the existing v1.43.5 #p-dash count-up
  (charts already animate via the line-model trace; not re-touched here).
- Light mode.

## 7. Coordination

Parallel session owns the landing/index + planb track. This cockpit track touches
ONLY cockpit pages + the new `css/rz-cockpit-instrument.css` — no overlap. Stash
their in-flight files before each commit (ai-engineering-maintenance, planb,
plan-ecc-adoption, plan-dark-mode-standard, rz-skin-gallery, DARK_MODE_STANDARD,
plan-live-data-edge) as established.
