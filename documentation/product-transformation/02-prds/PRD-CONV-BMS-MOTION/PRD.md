# PRD-CONV-BMS-MOTION: motion that carries state on the eight Conventional BMS pages

Status: BUILT v3.84.0 (2026-11-21) · Owner comment R183 · Standard: `standarization/MOTION_STANDARD.md` (binding).
Companion of PRD-CONV-LIVING-PLANT (process motion on the sheets: `js/conv/vfx.js`, not touched here).

## 0. The owner's words

> "Continue, polish more effect2 animasi semuanya"

Read as: every BMS page should feel finished when something happens on it — a click, a dialog, a state change, the
page arriving. Read together with standing rules that stay binding:
- PRD-CONV-DATAHALL-FLOOR §3.7: no pulse, no blink, no glow; mode changes recolour instantly.
- MOTION_STANDARD §1: data the reader acts on never moves for style; a keyboard shortcut never animates.
- Rejected patterns (CLAUDE.md): no hover lift on cards, no `transition: all`, no decorative loops.

So "more animation" means: **every interaction and every state change gets its motion; nothing decorative is added.**

## 1. Measured state (fp2 tree = v3.83.0 candidate, 1440 × 900 dark, real browser, 2.5 s settle)

Survey script: one pass per page, computed styles + Web Animations API + a real click on the first visible point.

| Page | Points | Point colour on state change | Trend dialog (desktop) enter / exit | Buttons with press feedback (`:active` transform rules) | Running loops |
|---|---|---|---|---|---|
| dc-conventional | 22 | instant (`transition 0s`) | instant / instant | 0 | 0 |
| datahall | 86 | instant | instant / instant | 0 | 0 |
| chiller-plant | 132 | instant | instant / instant | 0 | 129 (`hmi-march`, `vfx-turn`: flow + rotors, process-bound) |
| fuel-system | 82 | instant | instant / instant | 0 | 4 (`hmi-march`) |
| water-system | 49 | instant | instant / instant | 0 | 23 (`hmi-march`) |
| fire-system | 13 | instant | instant / instant | 0 | 0 |
| ict | 27 | instant | (no point in the first screen) | 0 | 0 |
| EPMS | 52 | instant | instant / instant | 0 | 80 (`hmi-march`) |

### 1a. Gaps

1. **A point that goes into alarm changes colour in one frame** and nothing marks the moment. On a 132-point sheet
   the change is easy to miss; the alarm list is the only cue.
2. **The trend dialog appears and disappears in one frame** on desktop (on a phone it is an `RZSheet`, which already
   moves). Every number on every page opens it, so it is the most used dialog in the family.
3. **No button acknowledges a press.** 0 of 8 pages has any press feedback.
4. **Panels swap content without a transition** (data hall inspector hall → row → rack; Plan ↔ Air path; page tabs).
5. **The page arrives all at once** after the auth gate clears.
6. What already moves is process-bound and stays: pipe flow (`hmi-march`) and rotors (`vfx-turn`) from `vfx.js`.

## 2. Principles

- P1 **Purpose first** (MOTION_STANDARD §2). Every item below names one: feedback, state indication, spatial
  consistency, preventing a jarring change. Nothing is "delight".
- P2 **Tokens only**: `--rz-ease-out`, `--rz-ease-drawer`, `--rz-dur-press` 120, `--rz-dur-tip` 160,
  `--rz-dur-menu` 200, `--rz-dur-panel` 280. UI motion ≤ 300 ms.
- P3 **transform + opacity** (colour transitions for state colour; `outline-offset` for the alarm settle, one element).
- P4 **No loop, pulse, blink or glow is added.** The count of infinite animations per page may not rise.
- P5 **Data does not move for style**: no count-up, no number roll, no bar grow on refresh, no chart line draw-in.
  A value that changes inside its state changes in place, instantly.
- P6 **Keyboard is instant**: arrow-key cursor on the floor plan, shortcuts, mode switch (temp / power) stay unanimated.
- P7 **Reduced motion ships with it**: opacity and colour only, shorter; never zero for a dialog.
- P8 **Exit the way it entered** and faster (exit ≤ enter).
- P9 **One shared module**, no per-page copies: `css/conv-motion.css` + `js/conv/motion.js` on all eight pages.

## 3. Design

### M1 · A point changes state (state indication)
- Colour crossfade: `[data-point]` gets `transition: color, fill 240ms var(--rz-ease-out)`.
- When the state WORSENS (ok → warn, ok/warn → alarm), `RZPointStatus.apply()` sets `data-pt-arrive` for 900 ms.
  HTML number: the alarm outline settles from `outline-offset: 5px` and transparent to its rest (1 px, currentColor)
  over 280 ms; a warning number gets the same settle with a 0-width outline replaced by its glyph fading in
  (opacity 0 → 1, 200 ms). SVG text: `fill` crossfade only (SVG has no outline), plus the glyph tspan fading in.
- Improving (alarm → ok) has no settle: colour crossfade only. A return to normal is not news.
- Never twice in a row: a point that flaps inside 900 ms keeps the one running settle (deadband already limits it).
- Reduced motion: colour crossfade 120 ms, no outline travel.

### M2 · The trend dialog opens and closes (spatial consistency)
- Only when the POINTER opens or closes it. Enter / t / a `#trend=` link open it instantly and Escape closes it
  instantly (MOTION_STANDARD §1: a keyboard action never animates; `rz-trend.js` already said so for the modal).
- Desktop / tablet modal (`js/rz-trend.js` mode `modal`): scrim opacity 0 → 1, panel opacity 0 → 1 and
  `scale(.97) → 1`, 200 ms `--rz-ease-out`, origin centre (modals are exempt from trigger origin).
- Close (×, Escape, scrim): the reverse in 160 ms, then `hidden`. Focus returns to the number at close start.
- Reopening while closing retargets (a transition, not keyframes).
- Phone: unchanged (`RZSheet` already moves, gate `test-rz-motion.mjs`).
- Range buttons (1H … 30D) and pen add/remove: the plot crossfades opacity .6 → 1 in 120 ms; the line does not
  draw itself in (P5).
- Reduced motion: opacity only, 120 ms.

### M3 · A button is pressed (feedback)
- Every enabled `button` and `[role="button"]` HTML control inside the cockpit root: `:active` → `scale(.97)`,
  transition `transform 120ms var(--rz-ease-out)`.
- Excluded: SVG elements, numbers (`[data-point]`, they open a dialog that is its own feedback), any control whose
  rest `transform` is not `none` (it would jump), the shell CTA (owner exception already defines its press).
- Reduced motion: no scale.

### M4 · A panel swaps its content (preventing a jarring change)
- Data hall inspector (hall / row / rack / CRAH): the new content enters opacity 0 → 1 + `translateY(4px) → 0`,
  200 ms; its first 6 blocks stagger 30 ms.
- Data hall Plan ↔ Air path, and page-level tab panels (`[role="tabpanel"]` on the eight pages): the incoming panel
  fades in, opacity 0 → 1, 160 ms, no translate (the panel occupies the same place).
- Equipment modal (`RZConvModal`): same enter / exit as M2.
- Reduced motion: opacity only, 120 ms.

### M5 · The page arrives (spatial consistency, once per load)
- After the auth gate clears, the top-level blocks of the cockpit root (shell bar excluded, at most 8 blocks)
  enter opacity 0 → 1 + `translateY(6px) → 0`, 240 ms, stagger 40 ms. All done ≤ 600 ms after the first block starts.
- Not on bfcache restore, not on a theme toggle, not on a resize.
- Reduced motion: opacity only, 160 ms, no stagger.

### M6 · Floor-plan selection (state indication)
- The amber selection outline on a cabinet / CRAH fades in (stroke-opacity 0 → 1, 160 ms). Hover: nothing (P6, and
  tens-per-day tier). Keyboard cursor: instant (P6).

## 4. Scope

In: `dc-conventional.html`, `datahall.html`, `chiller-plant.html`, `fuel-system.html`, `water-system.html`,
`fire-system.html`, `ict.html`, `EPMS_Telemetry.html`; `js/rz-trend.js` (M2), `js/conv/point-status.js` (M1 attribute),
`js/conv/floor-plan.js` (M6), `js/conv/equipment-modal.js` (M4), new `css/conv-motion.css` + `js/conv/motion.js`.
Out: `js/conv/vfx.js`, `css/conv-vfx.css` (process motion, another session), `datahallAI.html` (DC AI session),
the site bar, phone sheets (already animated).

## 5. Laws (gate `tools/test-conv-motion.mjs`, real browser, every law red on the v3.83.0 tree)

| Law | Claim | Proof |
|---|---|---|
| MO1 | Trend dialog moves in and out on the pointer, instant on the keyboard, one key = one dialog | 7 pages with a point: a pointer click starts opacity + transform transitions of 160–300 ms (opacity only, reduced); after them opacity 1, transform none; × starts an exit no longer than the entry, then hidden; focus back on the number; Enter opens at rest with no transition, Escape hides at once, and no basis drawer is left open |
| MO2 | State change is marked | `RZPointStatus.apply()` driven past the alarm limit on one HTML and one SVG point per page: `data-pt-arrive` present, ≥ 1 running animation/transition on the element, gone ≤ 1.2 s; driving it back to normal sets no `data-pt-arrive` |
| MO3 | Press feedback | every visible enabled HTML button in the cockpit root (minus §M3 exclusions): pointer down → computed transform scale ≈ .97 within 200 ms; pointer up → none; rest transform unchanged |
| MO4 | Panels swap with a transition | data hall: open a row → inspector content has a running animation; Plan → Air path → incoming panel animates; reduced: opacity only |
| MO5 | Page arrival | the first screen's blocks animate after the sign-in gate clears (≥ 1: fire-system's first screen is one HMI frame); all finished ≤ 600 ms after the first one starts; 0 infinite animations added (name set equal to the v3.83.0 set: `hmi-march`, `vfx-turn`) |
| MO6 | Reduced motion | `prefers-reduced-motion: reduce`: MO1/MO2/MO4/MO5 still move opacity/colour, 0 computed transforms ≠ none mid-animation from this module, MO3 no scale |
| MO7 | Rules | every duration from this module ≤ 300 ms, easing = a token, no `transition: all`, no `scale(0)`, no infinite iteration (static scan of `css/conv-motion.css` + computed check) |
| MO8 | No regression | `test-rz-motion.mjs --strict`, `test-conv-floor-plan.mjs` (keyboard instant), `test-conv-datahall-space.mjs`, `test-conv-shell.mjs`, `audit-a11y.mjs` stay green |

Red proof before build: MO1–MO5 must fail on the v3.83.0 tree; MO7 must fail on a seeded `transition: all 500ms`.

## 6. Phases

1. Gate first (red on v3.83.0).
2. M1 + M2 + M3 (shared module, trend, point status).
3. M4 + M5 + M6.
4. Docs: MOTION_STANDARD "Conventional BMS" section, CONVENTIONAL_DC_OPERATIONS_STANDARD, UIUX ledger R183,
   CLAUDE.md gate row, ship-gate line, CHANGELOG.

## 7. Risks

- An axe contrast sample taken mid-fade (memory: a11y flake from entrance animation). Mitigation: M5 ends ≤ 600 ms;
  gates settle ≥ 1.5 s; MO8 runs `audit-a11y`.
- A gate reading opacity or a rect during M5. Same mitigation; the arrival runs once.
- A button that already carries a transform jumps on press. Mitigation: MO3 rest-transform exclusion, measured.

## 8. Built (v3.84.0, 2026-11-21)

- `css/conv-motion.css`, `js/conv/motion.js` on the eight pages; `js/rz-trend.js` (M2 + one-key-one-dialog fix),
  `js/conv/point-status.js` (`data-pt-arrive`), `js/conv/equipment-modal.js` (dialogIn/Out), `js/conv/floor-plan.js`
  (selection ring), `datahall.html` (inspector swap, Plan ↔ Air fade).
- Gate `tools/test-conv-motion.mjs`: red on v3.83.0 (129 findings), green after (360 checks), MO7 red on a seed.
- Found on the way: Enter on a number in a basis tile opened the trend AND the basis drawer; Escape left the drawer.
- MO5 relaxed from ≥ 2 to ≥ 1 block: fire-system's whole first screen is one HMI frame.
- Frozen mid-flight screenshots looked at: alarm ring at 90 ms, trend dialog at 70 ms, row panel swap at 90 ms.
