# Site chrome standard — one bar, one theme button

> Last updated: 2026-11-18 · PRD: `documentation/prd/PRD_SITE_CHROME.md` (approved by the owner 2026-11-18)
> Gate: `tools/test-site-chrome.mjs` · page kinds and exemptions: `tools/site-chrome.config.json`

Owner, 2026-11-17: "Navbar position, theme button nggak konsisten."

This standard is the rule for every page at the repository root. It is being rolled out family by family (PRD §5);
until a family is refitted the gate holds it as a ratchet — the number of failing pages per law may fall, never rise.

## 1. Page kinds

| kind | pages | bar | height |
|---|---|---|---|
| **site** | every page not listed in the config: content, calculators, journal, incidents, hubs, legal, account | `nav.navbar` | 56 px at every width |
| **app** | `tools/site-chrome.config.json` → `app`: cockpits, LTC labs, rz-ops, dashboards | the page's own app bar | 48 px at every width |
| **bare** | config → `bare`: verification file, print view, mock-ups, plan pages, 404 | none | — |

A page is `bare` only with a written reason in the config. A new page is a `site` page unless it is added to a list.

## 2. The bar

- A bar that used to be `position: fixed` (the older portfolio nav, from `styles.css`) is stamped
  `data-rz-bar="lift"` by the sweep tool and gives its height back with a negative bottom margin, because each of
  those pages pads its content for a bar that was out of the flow. A bar that was already in the flow is not lifted.
- A generated family (incidents) carries the standard bar in its generator's template; the generator's `--check`
  and the sweep's `--check` must both pass on its pages.
- The bar takes the page's theme (since 2026-11-20 translucent with a blur, §2a; the contrast law below holds over
  any content behind it). A page whose surface is dark in both themes declares
  `<html data-rz-surface="dark">` and gets the dark bar in both; a page that had a transparent nav over a dark hero
  (`body[data-rz-nav-over-dark]`) loses that mark at refit. Law CH11 measures every text in the bar at ≥ 4.5:1 in
  both themes.
- `position: sticky; top: 0` on every kind. Not `fixed` (it needs a hand-tuned body offset on every page, which is
  where 13 different heights came from) and not `static` (the bar scrolls away).
- One height per kind (the token above). A second row — breadcrumbs, a status strip, a reading-progress line — sits
  **under** the bar, never inside it.
- The bar never causes sideways scroll and never holds a control narrower than 44 px on a phone.

## 2a. The floating bar (site kind) — 2026-11-20, owner exception ANTI_VIBECODE §B-2026-11-20

- The site bar floats: `position: sticky`, 10 px from the top (8 px on a phone), 11 px side margin below the measure,
  8 px padding, 12 px radius, one hairline, a soft shadow. It touches no viewport edge and stays put on scroll.
- Translucent: `--rzf-glass` (alpha 0.82) with `backdrop-filter: blur(14px)`. It is the only painted backdrop-filter
  on the page. Every label holds 4.5:1 over white and over the darkest page ink.
- `scroll-padding-top` moves in-page anchors below it; the first heading starts under it at load.
- Source: `css/rz-nav-float.css`, reached by one `@import` at the top of `css/rz-chrome.css` (so first paint already
  floats). `index.html` links it directly and marks its nav `data-rz-float`. The `?v=` of that import is the file's
  hash, stamped by `tools/build-nav-menu.mjs` (its `--check` fails on drift).
- An app page (`<html data-rz-kind="app">`) never matches: the cockpits keep their own bar (§9).

## 2b. The mega menu — 2026-11-20

- Content is GENERATED: `data/nav-menu.json` from `tools/build-nav-menu.mjs` (sections, groups, items, a featured item
  per section). Never hand-edit the JSON or put menu links in a page. Every href must be a file of the checkout.
- `js/rz-mega-menu.js`, loaded by `js/rz-chrome.js` on site pages (token stamped by the builder) and by `index.html`
  directly. Desktop (> 768 px): a top-level section with groups is a `<button aria-expanded aria-controls>`; it opens
  ONE panel exactly as wide as the bar: three link columns and a fourth preview column for the highlighted item.
  Opens on click and on 120 ms hover intent; closes 200 ms after leaving, on Escape (focus back to the trigger), on
  Tab out and on a press outside. No animation when opened from the keyboard.
- Phone (≤ 768 px): no panel; the groups are accordions inside the drawer of `js/rz-mobile-nav.js`, every target
  ≥ 44 px high.
- The page's own nav links stay in the markup for crawlers and are hidden (`[data-rz-mm-orig]`) only once the menu is
  built. If the JSON cannot be read, nothing is hidden.
- Gate `tools/test-nav-float.mjs` (F1–F10, planted defects `edge`, `blur2`, `alpha`, `width`, `deadlink`).

## 3. The right-hand cluster

Order, left to right, wherever the control exists: **search · theme · sign-in / account · menu**.
On a phone (≤ 768 px) the bar keeps **theme · menu**; search and sign-in live in the menu drawer.
Each slot is a 44 × 44 box with one gap token (`--rz-bar-gap`, 8 px); sign-in is a fixed-width slot
(`--rz-bar-signin`, 104 px) whatever widget fills it (Login, an avatar, an e-mail); the bar's content sits in one
measure (`--rz-bar-measure`, 1120 px, 20 px gutters below it). So the theme button's distance from the right edge
depends only on which slots exist — measured after phase N1: 272 px at 1440 and 72 px at 390 on all 12 pages.

Slots are marked in the markup: `data-rz-bar` on the bar, `data-rz-slot="search|theme|signin"` on the controls.
On a phone `js/rz-chrome.js` moves the search and sign-in elements into the drawer (and back above 768 px); a
sign-in widget that `auth.js` injects among the links is moved behind the theme button on desktop.

`html, body { overflow-x: hidden }` (the old mobile patch) makes a sticky bar scroll away with the page on a phone;
`css/rz-chrome.css` sets `overflow-x: clip` at ≤ 768 px, which stops sideways scroll without that side effect.

## 4. The theme button

| property | value |
|---|---|
| element | `<button type="button" class="rz-theme-btn" data-rz-theme-toggle>`; the old ids (`#themeToggle`, `#navThemeBtn`) stay on it as aliases until phase N6 |
| size | 44 × 44 hit area, 36 × 36 visual, radius 4 px, 1 px hairline, no fill |
| icon | one inline SVG, `currentColor`: a sun when the page is dark, a moon when it is light. No "◐", no icon font, no text |
| name and state | `aria-label="Switch to light theme"` / `"Switch to dark theme"`, `aria-pressed` = dark is on |
| behaviour | sets `<html data-theme>`, writes `localStorage.theme`, dispatches `rz-theme-change` on `document`; a `storage` event applies it in other open tabs |
| motion | none on the page; no `transition: all`; identical under reduced motion |
| keyboard | reachable by Tab in bar order; Enter and Space toggle |

Exactly one visible theme button per page, inside the bar.

## 5. Theme state

- One key: `localStorage.theme` = `light` | `dark`. No per-page key.
- Order of authority: the stored choice → the page kind's default (site light, app dark) → the device preference.
- **Before the first paint**: one inline snippet at the top of `<head>`, identical on every page and stamped by
  `tools/sweep-site-chrome.py` (never hand-written), sets `data-theme`. No `data-theme` literal on `<html>`.
- Code that paints colours in script (charts, canvases, SVG builders) re-reads on `rz-theme-change`.
- A page never carries its own toggle function or its own `.navbar { … }` rule. One module (`js/rz-chrome.js`) and
  one stylesheet (`css/rz-chrome.css`) own them; the homepage loads the same stylesheet (it does not load
  `styles.css`).
- A cockpit that never had a second theme gets the button only after both themes pass `audit-dark-coverage` and the
  contrast gate.

## 6. Laws (`tools/test-site-chrome.mjs`, rendered at 1440 and 390; 768 with `--full`)

| law | claim |
|---|---|
| CH1 | a bar, computed `position: sticky`, top 0, height = the kind's token ± 1 px |
| CH2 | exactly one visible theme button, inside the bar, ≥ 44 × 44, SVG icon and no text glyph, the accessible name of §4 |
| CH3 | the button's distance from the right edge is one value per kind, width and slot set |
| CH4 | slot order of §3 |
| CH5 | a press flips `data-theme` and `localStorage.theme`; a second press flips them back |
| CH6 | the stored theme is on `<html>` at the first paint |
| CH7 | source: no own toggle code, no theme key other than `theme`, no `.navbar {` rule in the page, no `data-theme` literal on `<html>` |
| CH8 | phone: bar not taller than its token, no control under 44 px, no sideways scroll |
| CH9 | the config names only existing files, every `bare` entry has a reason (strict from day one) |
| CH11 | refitted pages, both themes at 1440: every text in the bar reads at ≥ 4.5:1 against what is painted behind it (strict) |
| CH10 | phone, refitted pages: a press on the menu button shows the drawer (strict from day one). `css/rz-chrome.css` must never contain the open-state class of `rz-mobile-nav.js` in a selector — that script then stops injecting its drawer CSS |

## 7. Baseline (2026-11-18, before any refit)

Recorded in `tools/site-chrome-baseline.json` by `--baseline`. Re-record only after a refit that lowered a count;
never to make a regression pass. `--list=CH2` prints every failing page of a law with its reason, `--list=all`
every law.

2026-11-18, phase N1: the gate was tightened before the first refit and re-measured on the unrefitted tree, which
is why three counts rose without any page changing — CH7 115 → 121 (any `toggle…Theme` function counts, not only
`toggleTheme`), CH4 128 → 140 and CH6 14 → 18, CH3 37 → 38 (the calculators' `#navSearchBtn` and `.nav-auth-wrap`
are now seen as slots). The N1 refit is measured against those tightened numbers.
CH6 was also unstable on an unchanged tree (14, 18, 20, 41, 44 across five runs): the paint entry arrives late or
never on a loaded machine and was counted as a failure. It now falls back to the theme at the first animation
frame, so every page gets a verdict.

| law | N0 baseline | tightened, before any refit | after N1 | after N2 | after N3 | after N4a (recorded) |
|---|---|---|---|---|---|---|
| CH1 | 134 | 134 | 132 | 91 | 40 | 33 |
| CH2 | 169 | 169 | 157 | 116 | 65 | 33 |
| CH3 | 37 | 38 | 28 | 13 | 13 | 6 |
| CH4 | 128 | 140 | 128 | 89 | 38 | 7 |
| CH5 | 2 | 2 | 1 | 1 | 1 | 1 |
| CH6 | 14 | 18 | 16 (none "not recorded": 13 pages with no theme at first paint, 3 with the wrong one; 0 refitted pages) | 15 | 15 | 14 |
| CH7 | 115 | 121 | 109 | 99 | 48 | 21 |
| CH8 | 162 | 162 | 150 | 109 | 58 | 26 |
| CH9 | 0 | 0 | 0 | 0 | 0 | 0 |
| CH10 | — | — | 0 (strict) | 0 (strict) | 0 (strict) | 0 (strict) |

## 7b. Refitting a page

`python3 tools/sweep-site-chrome.py --apply <page.html> …` then
`node tools/test-asset-cache-tokens.mjs --fix css/rz-chrome.css js/rz-chrome.js`. The tool stamps the head snippet,
the slots and the button, removes the page's own toggle code and one-line `.navbar { … }` rules, and loads the
stylesheet and the module last in `<head>`. What it cannot remove safely it prints as "left for hand review".
`--check` (ship gate) fails when a refitted page is no longer what the tool produces: never hand-edit the stamped
parts. Red proof of the module: with `toggle()` removed, CH5 fails on every refitted page.

| phase | family | pages | state |
|---|---|---|---|
| N1 | calculators, compare, tools, DC Solutions | 12 | refitted 2026-11-18: 0 failures on CH1–CH9 |
| N2 | journal: 30 articles, 3 FF, 3 Global Analysis, 4 hubs (`article-9-paper.html` has no bar and is left alone) | 40 | refitted 2026-11-18 (v3.71.0): 0 failures on CH1–CH10 |
| N3 | incidents: 50 dossiers + hub, through the `tools/build-incidents.py` template | 51 | refitted 2026-11-18 (v3.73.0): 0 failures on CH1–CH10 |
| N4a | guides, comparisons, hubs, pillars, infographics, glossary, tia-942, rfs workbench | 32 | refitted 2026-11-19 (v3.75.0): 0 failures on CH1–CH11 |
| N4b | `changelog` (generator), 6 `pln-java-grid*`, `network-compare` (no theme button in the bar); `account`, `privacy`, `terms` (no bar); homepage (rainbow mode) | 13 | open |
| N5 | app kind (cockpits, labs, rz-ops) | 21 | open |

## 8. Who edits what

Site, journal, incident and remaining pages, `datahallAI.html` and the LTC labs: the session that holds this PRD.
The Conventional cockpits: the Conventional session, from this standard. Generated pages (incidents, journal hub
and series, changelog) change in their generator's template, then are rebuilt.


## 9. The cockpit bar (page kind `app`, the nine Conventional BMS pages) — 2026-11-19

Owner, 2026-11-18: "This button combo is looking a bit flat. We don't need the login button (or the like) to have an outline … the main CTA needs to have some more lift … add some indent shadow. On hover, give it a subtle glow with a conic gradient stroke … creating a bloom glow around it that's rotating … swap the text … to something that feels like a win … pastikan semua page di BMS button location sama posisi". Component: `js/conv/shell.js` + `css/conv-shell.css`; gate `tools/test-conv-shell.mjs`.

- **One 48 px bar, sticky at top 0**, built once by `shell.js`; the page marks what it already has with
  `data-cv="back|portfolio|title|scope|prd|manual|cta|theme|clock"` and the module MOVES those elements into fixed
  slots, so every id, class and handler page code or gates select keeps working. The page's own tools (zoom, export,
  simulate, view switches) stay in its toolbar row under the bar (`data-cv-toolrow`).
- **Slot order, left → right:** Back · Portfolio · title (+ scope) · ‹spacer› · PRD · Manual · Alarm history ·
  primary CTA · Login · theme · clock (· More below 1101 px). Fixed widths: back 84, portfolio 108, PRD 56, manual 76,
  alarm 124, CTA 236, login 104, theme 44, clock 112 px. **A slot the page cannot fill stays EMPTY at its width**, so
  every slot sits at the same x on every page (law C2, ± 1 px, measured from the left for the left group and from the
  right edge for the right group, also while the CTA is hovered).
- **Login and its like are bare**: no border, no fill, weight 600; the accent underline on hover / focus only; hit
  height ≥ 44 px.
- **Alarm history is a secondary button** (one class: transparent, 1 px hairline face, 13 px): amber is reserved for
  abnormal state (ISA-101).
- **Exactly one primary CTA**: the Ask action on eight pages (`Get the answer`, win line `Answer in seconds`), the
  Design Studio on `dc-conventional` (`Get my design`, win line `Design ready in one click`); `cdu-mini-bms` has no Ask
  and keeps the slot empty. Its look is the owner exception of `ANTI_VIBECODE_STANDARD.md` §B (2026-11-19).
- **≤ 1100 px** Portfolio, PRD, Manual and Alarm history move into one **More** menu (focus moved in, Escape returns,
  every item ≥ 44 px, text of every item starts on one line); Back, title, CTA, Login stay. At 390 nothing of the bar
  leaves the viewport.
- **≤ 600 px** the theme button joins the More menu with a "Theme" label, and the title may take two lines (12 px,
  clamped): a long name ("Conventional DC Dashboard") is read, never cut to "Co…". A title that is still cut ends in an
  ellipsis (the bar title is `display:block`, never a flex box). The pages' v1.8.0 mobile patch sets
  `h1 { font-size: 1.6rem !important }`; the bar holds its title size with `!important` scoped to `.cv-bar .cv-title`.
- **Gated page** (`dc-conventional`): while `body.locked`, `auth.js` lifts the public PRD / Manual links into a fixed
  layer above the sign-in gate, each in the box of its slot; a slot inside the closed More menu has no box, so its link
  stands in a row just under the bar, right-aligned. The bar, its More panel and the old header are `inert` while
  locked. Unlocked, the links go back into their slots (bar or More), so reading and Tab order follow the menu.
- **EPMS on a phone** keeps ≥ 560 px for the single-line under the bar: the provenance line and the feed / state legend
  fold to one line each (tap to open, `role=button` only where they fold).
- A page whose `html` and `body` both scroll (chiller-plant) gets `body { overflow-x: clip; overflow-y: visible }`
  under the bar, else `position: sticky` binds to a body that never scrolls.
- Laws C1–C8 (`tools/test-conv-shell.mjs`): bar, positions, bare login, CTA rest / hover / pressed / reduced motion,
  actions still work, 390 More menu, contrast ≥ 4.5 : 1 in the dark AND the light theme (v3.78.1), keyboard order.
  Bar colour rules for the auth chrome sit under `:root` so a page register (`rz-cockpit-instrument.css`, 0,2,1)
  cannot repaint them. Login shows the word at every width (auth.js hides it at ≤ 768 px on other pages) and is
  ≥ 44 px wide (C6, v3.79.0). The hover laws run with Chrome's
  `--blink-settings=…HoverType=2…` flags and refuse to run when `(hover: hover)` does not match.
- `datahallAI.html` adopts the same component and gate (v3.80.0, owned by the DC AI session): CTA = Generate Design
  (`Get my design`), alarm slot empty at its width (alarms live in its Alarms & Events tab); `hmi-v2.js` keeps only the
  page's own tools (provenance banner, Ask, Replay, Docs) in a row under the bar, sticky at 48 px above 1480 px; the
  module tabs stick under it. The light-theme account letter is `#155e75` inside the bar (`css/rz-dh-shell.css`).

### 9a. State row and Details (2026-11-21, PRD-COCKPIT-QUIET Q1, owner R182)

Owner, on the chiller plant phone view: "tulisan2 yg over yg mana tidak berguna dan saya bisa lihat di mimic ui nya …
Nggak perlu di tampilkan. Kan sudah aku bilang dibuat hirarki yg di hide/expand". The drawing is the page; everything
else is one level down. PRD: `documentation/prd/PRD_COCKPIT_QUIET.md`.

- **L0, one thin row under the bar** (`.cv-sub`, 32 px; 44 px at ≤ 600 px), built by `shell.js`: the state chip(s) a
  page marks `data-cv="state"` (the telemetry banner slot, rendered as a one-word label `SIMULATED`, and the page's alarm
  state word, e.g. `NORMAL`, `FACP NORMAL · …`), then **Details ▾** at the right. Fuel also rides its headline figure
  there (Generator autonomy): the element is MOVED, never copied, so a `data-point` exists once.
- **L1, the Details panel** (`#cvDetailsPanel`, closed at rest): everything a page marks `data-cv="detail"`, in document
  order: the old tool row (`data-cv-toolrow`, unframed there: no fixed height, no border), the alarm/ticker strip, the
  provenance line `p.rz-prov`, basis and capacity-study cards, KPI strips, a second legend. `data-cv="subtitle"` becomes
  the bar title's tooltip and the first line of the panel. The control is a button with `aria-expanded` /
  `aria-controls`; the open state is remembered per page in `localStorage` `rz.cv.details.<file>` (try/catch).
  API: `RZConvShell.details(el)` adopts a node later; `RZConvShell.setDetails(open, remember)`.
- **Nothing is deleted.** Every id, `data-point`, `data-basis-param`, `data-rz-telemetry-banner-slot` and `p.rz-prov`
  stays in the DOM one tap away (proof: a static diff of the hooks against the release before, 0 missing on nine
  pages). A gate that counts visible readings opens Details first (`test-conv-point-coverage.mjs`, like the datahall
  disclosures); its floors are unchanged.
- The row and the panel span the viewport like the bar (`fitRow`), whatever padding the page gives `<body>`; an
  overflow gate sets them aside the way it sets the bar aside (`test-fire-system-runtime-authority.mjs`).
- A state moved into the row announces on its own (`role=status`, `aria-live=polite`, law Q-L8b). The telemetry chip
  in the row is in flow and never covers content, so on a phone it has no dismiss (`×` hidden); from 601 px the dismiss
  is 28 px inside the 28 px row (`test-conv-alarm-runtime.mjs` accepts both).
- Controls a gate or the owner needs at rest stay at L0: the hub keeps FAQ and Ask on one unframed row
  (`test-explain-ask.mjs` B9: the Ask trigger is visible on every page).
- Page code that resets a state element's `className` must not lose its row styling: the row CSS selects by position
  (`.cv-sub > :not(.cv-details)`), never by a class the shell adds.
- A page that sizes its drawing from the chrome above it (EPMS `--epms-context-height`) measures `.cv-bar` + `.cv-sub`
  + the open panel, not the elements that moved into them.
- Laws Q-L1…Q-L8 in `tools/test-cockpit-quiet.mjs` (drawing at ≤ 220 px / 300 px, ≤ 25 words above it, no value said
  twice, no developer prose, no empty framed box, Details keyboard + reload memory, the row names the data mode and the
  alarm state). The EPMS phone fold above is superseded: its provenance and status strip are in Details.
