# PRD-APP-CLARITY — app-grade hierarchy, less visible text, one quick-action entry, one site bar

Status: **APPROVED TO EXECUTE 2026-11-19** — the owner asked for the design moves, a total audit of where they apply
("web apps dan mobile juga … khususnya text info terlalu banyak, perlu di-hierarchy atau disembunyikan") and then
"kamu yang lakukan, autonomous … jangan tanya saya" and "sempurnakan PRD-nya … kemudian execute, commit and push".
Defaults of §11 stand. Integrator: the Conventional-cockpit session. Peer: the DC AI / site-chrome session (§12).
Companion PRDs: `PRD-CONV-EQUIPMENT-TRUTH` (cockpit equipment, quantity truth, phase E7 = cockpit shell) and the
site-chrome standard `standarization/SITE_CHROME_STANDARD.md` (N-phases, owned by the peer until its N4a push).

---

## 0. The owner's words this PRD answers

| id | words (kept) | answered in |
|---|---|---|
| A1 | "Create better hierarchy and group the elements by relationship" | §4.1 |
| A2 | "take the main primary CTA button and on hovering, change the text to something that feels like a win, and animate the send icon in a loop transition where the plane flies away and repeats" | §4.2 (shipped in the cockpit bar first, E7a) |
| A3 | "frosted glass effect so that we can see some of the background seep through subtly. Also make the other layered on panels frosted too" | §4.3 |
| A4 | "fold unimportant content into accordions, and base the whole hierarchy on the order of operations" | §4.4 |
| A5 | "The left nav is looking too overwhelming … folding related menu items into a single area … labels for the menu item groups … an icon for better scannability" | §4.5 |
| A6 | "That search bar at the top is overbearing. Tuck it to the top nav in a small search widget with a Command K shortcut label … show a quick actions modal" | §4.6 |
| A7 | "Mksd saya ini web apps dan mobile juga … khususnya text2 info terlalu banyak" | §3, §4.7, every law at 390 px |
| N1 | "Make it a floating navbar, rounded corner container, eight pixel padding … translucent effect with background blur … mega menu, flush to the width of the entire nav … the fourth column a visual supporter … setelah selesai audit pastikan proper" (site pages, NOT the BMS pages) | §5 |
| B1 | "button combo is looking a bit flat … lose the outline [on Login] … main CTA more lift, indent shadow … conic gradient stroke … bloom … rotating … text that feels like a win … pastikan semua page di BMS button location sama posisi" | §6 (E7a) |

---

## 1. Principles (each one a law with a gate)

- **P1 Order of operations is the page order.** A calculator reads scope → inputs → result → what drives it →
  export → method; a cockpit reads state and alarms → drawing → selected item → trend → basis. Whatever a user
  needs only after a step sits after that step.
- **P2 One idea visible, the rest one action away.** At rest a screen shows values, units, states and the controls
  of the current step. Explanations live in a tooltip (`data-explain`, RZExplain), a "details" disclosure, or the
  manual. Safety, legal and data-provenance text that must be read before acting stays visible (§4.7 list).
- **P3 Group by relationship, separate by space and one hairline**, never by colour washes or rails (rejected
  patterns 7, 14 stay rejected).
- **P4 Delight is earned and bounded**: motion only on the one primary action per screen, only while hovered or
  focused, transform/opacity only, `prefers-reduced-motion` honoured, never on a keyboard shortcut.
- **P5 Translucency where it helps orientation, never over data**: frosted surfaces only for chrome that floats over
  scrolling content (the site bar, modal scrims and their panels, the More / quick-action sheets). Never behind a
  number, a P&ID, a chart or a form field. One backdrop-filter element visible at a time, blur 12–16 px, text
  ≥ 4.5 : 1 against the composited worst case, opaque fallback when unsupported or when the reader asks for less
  transparency.
- **P6 Phone first for density**: every law holds at 390 px; a phone hides more text than a desktop, never less.

These supersede, for the named scope only, the site rules "no glass", "no glow", "radius ≤ 4 px" (owner
exceptions, dated, recorded in `ANTI_VIBECODE_STANDARD.md` §B and `MOTION_STANDARD.md`).

---

## 2. Scope

| family | pages | what applies |
|---|---|---|
| BMS — Conventional | dc-conventional, datahall, chiller-plant, water-system, fire-system, fuel-system, ict, EPMS_Telemetry, cdu-mini-bms | §6 bar (E7a), §4.1, §4.4, §4.5 (left rails), §4.6, §4.7 |
| BMS — DC AI | datahallAI | the peer applies §6 and §4 with the same components; no variant |
| Calculators and tools | every page in `data/calculators.json`, cx-calculator, compare, tools, datacenter-solutions | §4.1, §4.2 (their primary action), §4.4, §4.6, §4.7, §5 |
| Hubs, journal, articles, incidents, labs, account | index, articles, series, article-*, FF-*, geopolitics-*, dc-incidents + incident-*, ltc-*, glossary, account | §5 (site bar + mega menu), §4.7 on hubs and labs only (articles keep their reading layout) |

---

## 3. Measured baseline (2026-11-18/19)

From the cockpit audit (`~/.cache/qa-tmp/audit-ux/findings.md`, 43 findings, 173 screenshots) and this session's
probes:
- 9 cockpit top bars, 8 button classes, heights 28–52 px; Login framed on most; Alarm history amber at rest.
- Text under 11 px on every cockpit (datahall 195 nodes, chiller 195, fuel 135, ict 123, fire 115).
- `dc-conventional` at 390 px: two bar buttons overlap by 9 px and three sit off screen.
- Light theme works on 2 of 9 cockpits.
- `js/rz-command-palette.js` (Ctrl / ⌘ K) exists site-wide; no page shows a ⌘K hint; several pages keep an in-page
  search box beside it.
- `tools/test-conv-text-budget.mjs` already holds 6 cockpits to "no prose at rest" — the pattern this PRD extends.
The app-pattern audit of the non-BMS families (text load per page, prose blocks ≥ 25 words, order mismatches)
is phase C0; its numbers are written into §3.1 when it runs.

### 3.1 Text-density baseline (static count, 2026-11-19)

Method: every app page's HTML with `<script>`, `<style>`, `<svg>`, `<nav>`, `<header>`, `<footer>` and existing
`<details>` removed; a "prose block" is one `p / li / div / span / small / td` holding ≥ 25 words. This is the
SOURCE count; C0 adds the rendered first-viewport count at 1440 and 390. Glossary is a reading page and keeps its
text. Full table: `~/.cache/qa-tmp/text-density.md`.

| page | prose blocks ≥ 25 w | words in them | `<details>` today | `data-explain` today | C2/C3 action |
|---|---|---|---|---|---|
| `carbon-footprint.html` | 61 | 2,166 | 0 | 0 | method + factor notes → one "Method" accordion; per-input hints → tooltips; keep the scope 1/2/3 result legend |
| `roi-calculator.html` | 34 | 1,167 | 0 | 0 | assumptions and formula prose → "Method"; per-field help → tooltips |
| `pue-calculator.html` | 27 | 1,010 | 0 | 0 | Green Grid category explanations → tooltips on the category selector; method → accordion |
| `spares-readiness-calculator.html` | 22 | 795 | 29 | 0 | already folded 29 blocks; move the remaining 22 into the existing folds |
| `index.html` | 11 | 407 | 0 | 0 | homepage keeps its copy (owner taste rules); only duplicated intro lines removed |
| `datahallAI.html` | 8 | 316 | 16 | 0 | peer session (same rule) |
| `ltc-system-modelling-lab.html` | 6 | 210 | 0 | 0 | lab brief → collapsible "About this lab"; step text stays at the step |
| `all-in-one-dashboard.html` | 5 | 189 | 0 | 0 | basis notes → tooltips on the tiles |
| `articles.html` | 6 | 176 | 0 | 0 | generated hub (`tools/build-journal.py`): shorten the series blurbs in the generator |
| `opex-calculator.html` | 5 | 156 | 0 | 0 | method → accordion |
| `ltc-*` labs (5 pages) | 3–4 each | 81–167 | 0 | 0 | "About" → accordion; standard clauses → tooltips |
| `datacenter-solutions.html`, `tools.html` | 4 | 115–150 | 0–4 | 0 | card descriptions to one line; the rest in the mega menu preview |
| BMS cockpits | 0–2 | ≤ 105 | ≤ 1 | 0 | held by `test-conv-text-budget.mjs`; cdu-mini-bms joins it |

Finding: **no calculator outside cx and capex uses `data-explain` at all** — the tooltip engine exists site-wide but
the calculators explain in visible paragraphs. C2 moves field help into the RZExplain DB (`tools/explain-extra.json`,
generated `js/rz-explain-db.js`), never into page-local tooltip code.

---

## 4. Design moves

### 4.1 Hierarchy and grouping (A1)
- Each screen gets ≤ 3 visual levels: page scope (title + scope chip), section (group label 12–13 px muted, one
  hairline), item. Group labels name the relationship ("Inputs — site", "Result", "What drives it").
- Related controls share one panel; unrelated ones never share a border.
- Numbers are right-aligned with their unit in the same cell; labels left.

### 4.2 Primary action delight (A2)
- One primary action per screen (calculators: Calculate / Export; cockpits: the Ask / design action).
- Rest: filled signal amber, lift (outer shadow y 1–2 px) + inset top highlight and inset bottom shade.
- Hover / focus: a rotating conic-gradient ring with a blurred copy as bloom (opacity ≤ 0.55, blur ≤ 12 px), the
  label swaps to a win line, a paper-plane icon flies out up-right and returns in a 1.4 s loop, clipped to its box.
- Width fixed to the wider label: nothing in the bar moves. Accessible name = the rest label.
- Reduced motion: no loop, no rotation, instant label swap. Touch: rest label only.

### 4.3 Frosted layers (A3, P5)
- Frosted: site bar (§5), modal panels over a scrim (equipment modal, network modal, TCC, trend, quick actions),
  the More sheet. Not frosted: inspectors docked beside a drawing, tables, cards, anything over a P&ID.
- Tokens: `--rz-glass-bg` (surface at 0.80 alpha), `--rz-glass-blur: 14px`, `--rz-glass-line`; one CSS file
  `css/rz-glass.css` used by every frosted layer; opaque fallback rules in the same file.
- Mobile: frosted only for the site bar; sheets and modals are opaque at ≤ 768 px (frame cost; measured in C0 at
  CPU 4× before any rollout beyond the bar).

### 4.4 Accordions by order of operations (A4)
- Secondary content folds into `<details>` (native, keyboard and screen-reader correct): method notes, basis
  paragraphs, assumptions, long tables beyond the first rows, change logs, "about this tool".
- Order on calculators: Scope · Inputs (grouped) · Result · What drives this result · Compare / Project / Export ·
  Method (folded) · Manual link. On cockpits: status strip · drawing · selected item · trend · basis (folded).
- An accordion opened by the user stays open on reload (sessionStorage), never by default.

### 4.5 Left navigation (A5)
- Pages with a left rail (ict segments, datahall hall list, LTC labs, account, rz-ops): items grouped under a label
  (12 px muted), each kept item has an icon from the site's existing icon set (Font Awesome where the page already
  loads it; inline SVG otherwise — no new icon library), ≤ 7 visible items per group, the rest under "More".
- Collapsed rail (icons only) below 1280 px; a drawer at 390 px.

### 4.6 Search → small widget + quick actions (A6)
- Every page: the bar shows a compact search widget (icon + "Search" + a `⌘K` / `Ctrl K` chip — the chip only on a
  pointer device) that opens `js/rz-command-palette.js`.
- The palette gains a "Quick actions" group from the page's real actions (export PDF/CSV, compare, save to
  project, switch hall, open manual, open alarm history, toggle theme) registered by the page through
  `RZPalette.registerActions([...])` — no action the page does not have.
- In-page search boxes that duplicate the palette are removed; filters that are not search (journal topic filter)
  stay.

### 4.7 Less visible text (A7, P2)
- Budget per page at rest: ≤ 1 prose block ≥ 25 words in the first viewport at 1440 and none at 390, except the
  "must stay visible" list: safety warnings, legal/disclaimer lines (FIN Engine disclaimer), the "Simulated"
  provenance strip on cockpits (one line), and an error message.
- Each moved text keeps its words: into `data-explain` (RZExplain DB entry, generated), a `<details>`, or the
  manual (with a "Manual →" link). Nothing is deleted unless it duplicates another visible text (listed per page
  in C0).
- Gate: `tools/test-text-budget.mjs` (generalises `test-conv-text-budget.mjs` to every app page; ratchet: counts
  may fall, a rise fails).

---

## 5. Site bar: floating, frosted, mega menu (N1) — site pages only

- Floating container: top offset 10 px, side margin so it never touches an edge, radius 12 px (this element and its
  panel only), padding 8 px, 1 px hairline, soft shadow; sticky through the scroll; first heading and in-page
  anchors land below it (`scroll-padding-top`).
- Frosted (§4.3 rules): one backdrop-filter element, blur 14 px, worst-case contrast ≥ 4.5 : 1 over white and over
  black content, opaque fallback.
- Mega menu: one panel exactly as wide as the bar, four columns — three link groups with labels and one-line
  descriptions, and a preview column showing the highlighted item's Open Graph card, title, line and "open".
  Content generated from `data/calculators.json`, `data/journal.json` and the hubs into `data/nav-menu.json`
  (`tools/build-nav-menu.mjs`, `--check` in the freshness gate). Hover intent 120 ms, grace 200 ms, full keyboard
  model, Escape returns focus. Phone: the same groups as accordions in the existing drawer.
- Built files (branch `site-nav-float`, not yet hooked): `css/rz-nav-float.css`, `js/rz-mega-menu.js`,
  `tools/build-nav-menu.mjs`, `data/nav-menu.json`; gate `tools/test-nav-float.mjs` (F1–F10, planted defects).
- Hook (after the peer's N4a push): one `@import` in `css/rz-chrome.css`, one loader line in `js/rz-chrome.js`,
  index.html links the two files itself and keeps its three-way theme cycle. The final audit runs on every
  site-kind page at 1440 and 390.

---

## 6. Cockpit bar (B1) — E7a, the nine Conventional pages, then datahallAI by the peer

- `js/conv/shell.js` + `css/conv-shell.css`: one 48 px bar; slots back · portfolio · title (+ scope) · PRD · manual ·
  alarm history · primary CTA · login · theme · clock (· More below 1101 px); an empty slot keeps its width, so every
  slot sits at the same x on all pages.
- Login bare (no border, no fill, accent underline on hover/focus). Alarm history secondary. The page's own tools
  move to a toolbar row under the bar.
- CTA per §4.2: `Get the answer` → `Answer in seconds` (Ask, 8 pages); `Get my design` → `Design ready in one
  click` (dc-conventional). cdu-mini-bms has no Ask: the slot stays empty.
- Gate `tools/test-conv-shell.mjs` C1–C8 (positions ± 1 px across pages, bare login, CTA rest/hover/pressed/reduced
  motion, actions still work, 390 More menu, contrast, keyboard). Hover laws run with Chrome's pointer/hover
  emulation flags and refuse to run without them (a hover law that cannot fail proves nothing).
- Hand-off to the peer: file paths, slot order, right-edge offsets at 1440 / 390, CTA labels, the gate.

---

## 7. Gates (red before green)

| gate | proves |
|---|---|
| `test-conv-shell.mjs` | §6 |
| `test-nav-float.mjs` | §5 (F1–F10) |
| `test-text-budget.mjs` | §4.7 per page, ratchet |
| `test-quick-actions.mjs` | §4.6: widget on every page, ⌘K/Ctrl K opens the palette, quick actions = the page's real actions and each one works |
| `test-glass.mjs` | §4.3: only the allowed layers are frosted, one at a time, contrast worst case, fallback, frame cost at 390 |
| `test-accordion-order.mjs` | §4.4: DOM and visual order follow the order of operations; secondary blocks are inside `<details>`; open state restored |
| existing | `test-site-chrome.mjs`, `test-mobile-nav.mjs`, `test-search-palette.mjs`, `test-journal.mjs`, `audit-a11y`, `audit-responsive-layout`, `audit-dark-coverage`, `audit-editorial-render`, the slop gates with NARROW named exemptions only |

---

## 8. Phases

| phase | content | branch | state |
|---|---|---|---|
| C0 | app-pattern + text-density audit of every app page (fills §3.1) | read-only | first run stopped on a quota limit; rerun |
| E7a | cockpit bar + CTA (§6) | `conv-e7a` | built, gate running |
| N1 | floating frosted site bar + mega menu (§5) | `site-nav-float` | built, gate written, hook after N4a |
| C1 | quick-action widget + `RZPalette.registerActions` (§4.6) | — | queued |
| C2 | text budget on calculators and tools (§4.7) + accordions by order (§4.4) | — | queued |
| C3 | text budget and accordions on cockpits; left rails grouped with icons (§4.5) | — | queued (with PRD-CONV-EQUIPMENT-TRUTH E7) |
| C4 | frosted modal panels (§4.3) after the C0 frame-cost measurement | — | queued |

Each phase: laws → red → build → green → screenshots looked at → standards in the same release → release gates →
push → live check.

---

## 9. Risks

- Glass costs frames on phones (one composited layer per frosted element); bounded to one element at a time and
  measured before C4.
- Folding text hides it from people who scan; every fold carries a label that says what is inside.
- Two sessions edit chrome: the peer stops site-chrome features after N4a; until then N1 waits.

## 10. Non-goals
No new framework, no icon library, no change to article reading layout, no paid service.

## 11. Decisions taken (owner said "jangan tanya saya")
| id | decision |
|---|---|
| D1 | Frosted on the site bar always; on modal panels only after C0 shows ≤ 2 ms extra frame time at 390 / CPU 4× |
| D2 | Win labels: "Answer in seconds", "Design ready in one click"; calculators: "Calculate" → "See your result" |
| D3 | Quick actions come only from registered real actions |
| D4 | Text budget: 1 prose block on desktop first view, 0 on a phone, with the must-stay list of §4.7 |
| D5 | Left rails: ≤ 7 items per group, icons from the page's existing set |

## 12. Collaboration
The DC AI / site-chrome session owns `js/rz-chrome.js`, `css/rz-chrome.css`, the sweep tool and the site-chrome
gate until its N4a push, then stops feature work there. This PRD's site-bar hook lands after that push. The cockpit
bar is owned here and handed to that session for `datahallAI.html`. Shared state tables (`--hmi-st-*`) follow
PRD-DCAI-LIVING-PLANT §12a.

## 13. Status
| phase | status |
|---|---|
| E7a | built; gate fixed (hover emulation, cockpit gate) and running |
| N1 | built; gate written; waiting for N4a |
| C0 | static text count done (§3.1); rendered first-viewport count queued |
| C1–C4 | queued |
