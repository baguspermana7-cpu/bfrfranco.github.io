# PRD-SITE-CHROME — one navbar position, one theme button, on every page

Status: **APPROVED by the owner 2026-11-18 (plan mode, defaults OD-1 … OD-7 as written). Phase N0 done (0197411b0); N1 done in v3.68.0 (12 pages: 9 calculators, compare, tools, DC Solutions — the family is 12 pages, not ≈ 20; module is `js/rz-chrome.js`, tool `tools/sweep-site-chrome.py`). Next: N2 journal.**
Owner comment (R166): "Navbar position, theme button nggak konsisten. Rancang PRD dengan detail dan comprehensive."

## Reconciliation with the other draft of the same PRD
The owner gave the same comment to two sessions; the Conventional session wrote
`documentation/product-transformation/02-prds/PRD-SITE-CHROME/PRD.md` (draft, commit `383fe3775`). There must be one
implementation. This file is the approved specification; where the two differ, this table decides.

| topic | this PRD (approved) | the other draft | used |
|---|---|---|---|
| Slot order | search · theme · sign-in · menu | search · account · theme · menu (theme last) | **approved: theme before sign-in** (OD-3) |
| Bar height on a phone | 56 px site, 48 px app | 48 px for all at ≤ 768 px | **approved: 56 / 48 by kind** (OD-4) |
| First visit | Site light, App dark | follow the device preference | **approved: by page kind**; the device preference is the fallback when the kind sets none (OD-2) |
| rz-ops theme key | folded into `theme` | keeps `rz_admin_theme` | **open** — rz-ops keeps its key until N5, decided there with its owner |
| Module and tool names | `rz-theme.js`, `refit-chrome.py` | `js/rz-chrome.js`, `css/rz-chrome.css`, `tools/sweep-site-chrome.py`, hook `[data-rz-theme-toggle]`, class `rz-theme-btn` | **theirs** — names are not an owner decision; one set of names avoids two modules |
| Old button ids | removed by the refit | kept as aliases on the upgraded button until the last phase | **theirs** (page scripts that look them up keep working) |
| Other tabs | not specified | a `storage` event applies the theme without a reload | **theirs**, added |
| Widths measured | 1440, 390 | 1440, 768, 390 | **theirs**, added |
| Keyboard law | in CH2 | its own law (Tab order, Enter, Space, state announced) | **theirs**, added as CH10 |
| Cockpits with no second theme | button added in N5 | button only after both themes pass dark coverage and contrast | **theirs**, a precondition of N5 |
| Who edits what | — | Conventional cockpits: the Conventional session; datahallAI and the LTC labs: this session | **agreed**; site, journal, incident and remaining pages: this session (owner approval was given here) |
Where this document below still says `rz-theme.js` or `refit-chrome.py`, read `js/rz-chrome.js` and
`tools/sweep-site-chrome.py`.


## 0. Context
A reader moves between a calculator, an article, an incident page and a cockpit and the top bar changes under
them: it scrolls away on one page and stays on the next, it is 57 px here and 81 px there, the theme button is a
different size, a different icon and a different place, the theme they chose is forgotten or flashes, and 31 pages
have no theme button at all. The cause is that there is no shared implementation: each page family carries its own
copy. Outcome wanted: the bar and the button are in the same place, the same size and behave the same on every
page, by construction — one stylesheet, one script, a gate that measures the rendered page.

## 1. Where the site is today (measured: 183 pages rendered at 1440 × 900 and 390 × 844, plus a source scan of 190)

| what | measured | 
|---|---|
| Top bar element | 149 `nav.navbar` · 2 `header.navbar` · 6 `header.ltc-top` · 3 `div.topbar` · 5 one-off headers (`.bar`, `.hdr`, `.header`, `.topbar`, `.hero`) · **18 pages with none** |
| Position | **90 sticky · 63 fixed · 10 static · 2 relative** · 18 none — three different scroll behaviours |
| Height at 1440 | 81 px (53 pages) · 58 (52) · 57 (36) · 64 (7) · 48 (6) · ten other values up to 160 |
| Height at 390 | 61 (53) · 57 (37) · 77 (37) · 93 (14) · 64 (7) · 48 (6) · eleven other values up to 366 |
| Theme button present | 152 pages yes · **31 no** (the six Conventional cockpits, `account`, `404`, `privacy`, `terms`, six `pln-java-grid*`, `network-compare`, `all-in-one-dashboard`, mock-ups) |
| Theme button size | 44 × 44 (55 pages) · 26 × 28 (51) · 36 × 36 (37) · 38 × 32 (6) · three one-offs. On a phone 51 pages have a **26 px wide** tap target and one a 16 px one (the site's own minimum is 44) |
| Theme button icon | inline SVG (62) · the character "◐" (51) · Font Awesome moon (36) · Font Awesome sun (2) · the word "Dark" (1) |
| Distance from the top | 20 px (53) · 16 (52) · 12 (37) · 8 (8) |
| Distance from the right edge | 1440: ~160 px on 137 pages, then 16, 24, 32, 104, 120, 248, 304, 368. At 390: **thirteen different positions** (232, 184, 176, 112, 80, 16 …, one 16 px off-screen) |
| Order of the right-hand controls | sign-in then theme (128) · theme only (24) · neither (21) · sign-in only (10) |
| Default theme | `light` on 161 pages · `dark` hard-coded on 41 (`<html data-theme="dark">`) · none on 17 |
| Theme applied before first paint | Source scan: 77 of 190 pages carry a head snippet. **Rendered (gate CH6, two loads per page): 14 pages show the wrong theme at the first paint.** The first figure counted pages without the snippet; most of them still set the attribute early enough from an early script, so the rendered number is the finding |
| Implementations | 53 pages carry their own inline toggle code; `script.js` has one; `ltc-lab-ui.js`, `ltc-system-modelling-lab.js`, `rz-command-palette.js` each have another. 78 pages define `.navbar` CSS inline. There is no shared theme module and no navbar standard. Storage key: `theme` (101 pages), `rz_admin_theme` (1), none (88) |
| Mobile menu button | present on 150 pages at 390 px, absent on 33 |
| Generated pages | 51 incident pages (`tools/build-incidents.py` holds the template), the journal hub and series pages (`build-journal.py`), `changelog.html` (`build-changelog-html.py`) — a fix must go into the generator, not the output |

## 2. Goal and laws
- **C-1 One position.** The top bar is in the same place and has the same height on every page of a kind, and the
  same scroll behaviour on all pages.
- **C-2 One theme button.** Same control, same size, same icon, same place in the bar, same behaviour, on every page
  that has a bar; no page without one unless it is on a written exemption list.
- **C-3 The choice follows the reader.** Chosen once, applied on every page before the first paint, never flashed,
  never forgotten.
- **C-4 By construction.** One stylesheet and one script own it; a page cannot carry its own copy; a gate measures
  the rendered page (owner rule: computed, not source).

## 3. Design

### 3.1 Page kinds (three bars, one skeleton)
| kind | pages | bar | height (1440 / 390) |
|---|---|---|---|
| **Site** | content, calculators, journal, incidents, hubs, legal, account (≈ 160) | `nav.navbar` | 56 / 56 |
| **App** | cockpits, LTC labs, rz-ops, Finance Terminal, dashboards (≈ 25) | the page's own app bar, same slots | 48 / 48 |
| **Bare** | mock-ups, `google*.html`, plan pages, print views, 404 | none — exemption list by file name with a reason | — |

All bars: `position: sticky; top: 0` (one behaviour; `fixed` needs a body offset on every page and is where the
height drift came from), one z-index token, one bottom hairline, safe-area inset on phones. Heights are tokens
(`--rz-bar-h`); a page that needs a second row (breadcrumbs, a cockpit's status strip) puts it **under** the bar,
never inside it — that is what produced the 77, 93 and 160 px bars.

### 3.2 The right-hand cluster — fixed slot order
`[ search ] [ theme ] [ sign-in / account ] [ menu (phone only) ]`
- The cluster is right-aligned to the container edge with one gap token; each slot is a 44 × 44 box, so the theme
  button's distance from the right edge is a function of which slots exist, not of the page.
- Phone (≤ 768 px): `[ theme ] [ menu ]` stay in the bar; search and sign-in move into the menu drawer. The theme
  button therefore sits at the same x on every phone page.
- App bars use the same cluster after their own tools.

### 3.3 The theme button
One control, rendered by the shared script into the `[theme]` slot:
- 44 × 44 hit area, 36 × 36 visual, radius 4 px (the site register), 1 px hairline, no fill.
- One inline SVG: sun when the page is dark (press to go light), moon when light. No "◐", no icon font, no text.
- `<button type="button" aria-label="Switch to light theme" aria-pressed>`; label and `aria-pressed` follow the
  state; `:focus-visible` ring; keyboard and touch identical to pointer.
- Change is instant on colour tokens; no page transition, no `transition: all` (MOTION_STANDARD); reduced motion
  identical.

### 3.4 Theme state — one module
New `js/rz-theme.js` (`window.RZTheme`), loaded by every page:
- `RZTheme.get()` / `set('light'|'dark')` / `toggle()`; writes `<html data-theme>`, `localStorage 'theme'` (the key
  101 pages already use), dispatches `rz-theme-change` on `document`.
- Reads once, in this order: stored choice → the page kind's default → `prefers-color-scheme`.
- Migration: `rz_admin_theme` (rz-ops) is read once and folded into `theme`; a per-page key is never created again.
- Embedded apps (rz-ops iframes, Finance Terminal, the hidden calculator copies of `RZEmbedCompute`) follow the
  parent through the same event — the existing rule of `tools/test-rz-ops-theme.mjs` T1 stays.
- **Before first paint:** one four-line inline snippet in `<head>`, identical on every page and stamped by a tool
  (`tools/stamp-theme-head.py --check` in the freshness gate), sets `data-theme` before any stylesheet paints. It
  is the only inline theme code a page may carry.
- Charts, SVG drawings and canvases that pick colours in script re-read on `rz-theme-change` (several do this
  today through their own listeners; they move to the one event).

### 3.5 One stylesheet
New `css/rz-chrome.css`: bar tokens, cluster, theme button, phone rules, both themes. Loaded by every page; the
homepage too (the two-stylesheet rule: `index.html` does not load `styles.css`, so chrome must not live there).
The 78 inline `.navbar` blocks and the per-page `.theme-toggle` rules are removed by the refit tool, page family by
page family.

### 3.6 Defaults (owner decision OD-2)
Site pages default light; App pages default dark (operator screens, and what the cockpits already assume). A stored
choice always wins and is shared by both kinds. The 41 hard-coded `data-theme="dark"` attributes go; the default
comes from `<html data-rz-kind="site|app">`.

## 4. Rollout tool and gates

### 4.1 `tools/refit-chrome.py`
Per page: detect its kind, replace the bar's right cluster with the slot markup, remove inline toggle code and
inline `.navbar` / `.theme-toggle` CSS, add the head snippet, `rz-chrome.css` and `rz-theme.js`, set
`data-rz-kind`. `--check` (no write) lists what would change; `--page` for one page. Idempotent. Generated pages
are refitted through their generators' templates (incidents, journal, changelog), then rebuilt.

### 4.2 `tools/test-site-chrome.mjs` (browser, every page, 1440 and 390, both themes)
| law | claim | red today |
|---|---|---|
| CH1 | every non-exempt page has a bar; computed `position: sticky`, `top: 0`; height = its kind's token ± 1 px | 75 pages not sticky; 13 height values |
| CH2 | exactly one theme button, inside the bar, 44 × 44 hit area, the shared SVG, `aria-label` matches the state | 31 without; 4 sizes; 5 icons |
| CH3 | the button's x from the right edge is equal on all pages of a kind with the same slots (± 1 px), at both widths | 9 positions at 1440, 13 at 390 |
| CH4 | slot order is search · theme · sign-in · menu wherever those exist | 4 orders |
| CH5 | press the button → `data-theme` flips, body background luminance flips, `localStorage theme` set, `aria-pressed` flips; press again → back | per-page implementations |
| CH6 | with a theme stored, `<html data-theme>` equals it **at the first paint** (read in a `PerformanceObserver` paint callback; one reload before a failure counts) | 14 pages |
| CH7 | no page source contains its own toggle function, a theme key other than `theme`, or a `.navbar { … }` rule outside `rz-chrome.css` (source scan, exemption list by name) | 53 + 78 pages |
| CH8 | phone: the bar never exceeds its token height; nothing in it is narrower than 44 px; no horizontal scroll | 51 pages with a 26 px button |
| CH9 | the exemption list only names files that exist and each has a written reason | — |
Starts as a **ratchet** (per-family counts may fall, a rise fails), becomes strict when the last family is refitted.
Existing gates that must stay green: `test-mobile-nav`, `audit-dark-coverage`, `audit-a11y`, `test-rz-ops-theme`,
`audit-responsive-layout`, `audit-mobile-responsive`, the incident and journal freshness gates.

### 4.3 Baseline recorded in phase N0 (2026-11-18, 169 pages × 1440 and 390, 21 exempt)
| law | pages failing |
|---|---|
| CH1 bar sticky at its height | 134 |
| CH2 one theme button, 44 × 44, SVG, named | 169 (none has the accessible name of the standard; 51 are too small; 31 have none) |
| CH3 one position per kind | 37 off their family's value |
| CH4 slot order | 128 |
| CH5 a press toggles and stores | 2 (`index.html`, `spares-readiness-calculator.html`: the first press does nothing) |
| CH6 stored theme at first paint | 14 |
| CH7 own toggle code, own `.navbar` rule, hard-coded theme | 115 |
| CH8 phone bar height and 44 px controls | 162 |
| CH9 exemption list | 0 |
Two runs gave the same counts. The ratchet exits 1 when a count is above its baseline (shown with an all-zero
baseline on two pages).

## 5. Phases (one family live before the next; each with screenshots at 1440 and 390, both themes, looked at)
| phase | content | pages |
|---|---|---|
| **N0** — done 2026-11-18 | `standarization/SITE_CHROME_STANDARD.md`; the gate as a ratchet with today's numbers as baseline; exemption list; wired into `ship-gate.sh` | 0 changed |
| **N1** | `rz-theme.js`, `rz-chrome.css`, head snippet + stamp tool, refit tool; first family: **calculators and tools** (the pages a visitor crosses most) | ≈ 20 |
| **N2** | journal: articles, series, hub (generator template + rebuild) | 39 |
| **N3** | incidents (generator template + rebuild; freshness gate) | 51 |
| **N4** | hubs, comparison and guide pages, legal, account, homepage (`styles-index` path) | ≈ 50 |
| **N5** | App kind: DC AI cockpit, LTC labs, rz-ops, Finance Terminal. The six Conventional cockpits get their bar and theme button here too — **with the Conventional session**, which owns those pages | ≈ 25 |
| **N6** | gate strict; the old per-page code paths deleted; `UI_FEATURES_STANDARD.md`, `DARK_MODE_STANDARD.md`, `CLAUDE.md` point to the one module | — |
Every phase: laws red → refit → green → screenshots → ship gate → push → live check on the real site → pictures to
the owner.

## 6. Owner decisions (defaults stand if not changed at approval)
| id | decision | default |
|---|---|---|
| OD-1 | Bar behaviour | sticky on every page (stays visible while scrolling) |
| OD-2 | Default theme on a first visit | Site pages light, App pages (cockpits, labs, ops) dark; the reader's choice then applies everywhere |
| OD-3 | Slot order | search · theme · sign-in · menu |
| OD-4 | Heights | Site 56 px, App 48 px, at every width |
| OD-5 | Pages with no bar | only mock-ups, verification files, plan pages, print views and 404 (list in the standard) |
| OD-6 | Order of families | calculators first, then journal, incidents, the rest, cockpits last |
| OD-7 | Relation to the other drafts | this is small and visible on every page: it goes **before** PRD-DCAI-LIVING-PLANT phase A1 and after its A0 |

## 7. Risks
- **A refit touches about 180 pages.** Mitigation: family by family, the tool is idempotent, every page of the
  family is rendered by the gate before and after, and the diff of each page is limited to the bar, the head
  snippet and the removed inline code.
- **Sticky under a fixed-height app layout** (cockpits use full-height panes): the App bar sits in the layout grid,
  not over it; measured per cockpit in N5.
- **Inline code removed from 53 pages** may also be doing something else (a chart recolour). The refit lists every
  removed block; anything beyond theme switching moves to an `rz-theme-change` listener, not deleted.
- **Other sessions** own the Conventional cockpits and the LTC labs; N5 is done with them, shared files change
  additively, their gates run before the push.
- **Two stylesheets** on the homepage: chrome lives in its own file loaded by both paths.

## 8. Verification
`node tools/test-site-chrome.mjs` (ratchet, then strict) with each law quoted red on today's tree; the listed
existing gates; the sharded ship gate; then on the live site: open one page of each kind at 1440 and 390, switch
the theme, navigate to another kind, and send the screenshots.
