# PRD-SITE-CHROME — one navbar position, one theme button, on every page

Status: **DRAFT for owner approval (2026-11-17). Plan only — nothing is executed before the owner says go.**
Owner comment: "Navbar position, theme button nggak konsisten. Rancang PRD dengan detail dan comprehensive. Plan mode."

---

## 1. What is inconsistent today (measured on the source of 190 root pages)

Static scan of every `*.html` in the repo root on 2026-11-17. A rendered measurement (pixel position per page) is
step P0 of this PRD; both browser lanes were busy with a ship gate when this was written, so **pixel offsets are not
measured yet** and no number below claims one.

| fact | count |
|---|---|
| Pages with a theme button | 158 of 190 |
| Pages with **no** theme button | **32** — among them 7 of the 9 Conventional cockpits (`datahall`, `chiller-plant`, `water-system`, `fire-system`, `fuel-system`, `ict`, `EPMS_Telemetry`): no button and no theme function at all |
| Different markups for the same button | **14** — `#themeToggle.theme-toggle` 56 pages, `#themeToggle.theme-btn` 51, `#themeToggle.nav-icon` 26, `#navThemeBtn.nav-icon` 9, `#themeToggle.ltc-iconbtn` 6, and 7 one-page ids (`#dmtThemeToggle`, five `#pjg*ThemeToggle`, `#rfsThemeToggle`) |
| Button drawn three ways | text glyph "◐" on 51 pages, an icon-font glyph on 45, an inline SVG on 8 |
| Button inside the navbar | 125 pages; **outside it on 33** (51 buttons sit directly before the article reading column, not in a `nav-right` group) |
| First navigation element | `nav.navbar` 124, article `nav.toc-sidebar` 24, none 19, `header.ltc-top` 6, and 8 one-off headers (`header.bar`, `header.hdr`, `header.header`, `header.topbar`, `nav.nav-rail`, …) |
| Navbar positioning | `styles.css` and `styles-index.css`: `position: fixed`; 57 pages override it to `sticky` in page CSS, 7 to `fixed`; `css/rz-hub.css` sets a 56 px bar, `styles.css` sets none (height follows `padding: 1rem 2rem`) |
| Default theme in the markup | no `data-theme` on `<html>` on 145 pages, `dark` on 41, `light` on 4 — so the first paint differs by page |
| Storage key | `theme` on 143 pages (consistent); `rz_admin_theme` on rz-ops |

So the visitor sees the bar jump between fixed and sticky, at different heights, and the theme button move, change
shape, or disappear, depending on which page they opened.

---

## 2. Goal

On every page of the site: the bar is in the same place and has the same height for its page family; the theme
button is the same control, in the same slot, with the same behaviour; the theme chosen on one page is the theme
of every other page, from the first painted frame.

### Laws (each is measured by the gate in §7)

- **N1.** Every page has exactly one visible theme button.
- **N2.** The button is the last control of the bar's right-hand group. Its right edge sits at the bar's content
  edge and its vertical centre on the bar's centre line (± 1 px), at 390, 768 and 1440 px.
- **N3.** The button is one component: same size (36 × 36 px; 44 × 44 px hit area on touch), same icon set, same
  focus ring, same accessible name, on every page.
- **N4.** The bar's top edge is at 0 and stays there while scrolling. Its height is one value per family (§3).
  Page content never starts underneath it.
- **N5.** A click switches the theme at once; the choice survives a reload and is the same on any other page
  opened afterwards; a second open tab follows without a reload.
- **N6.** No flash: the first painted frame already has the stored theme (or the system preference when nothing
  is stored).
- **N7.** Keyboard: the button is reachable by Tab in bar order, toggles on Enter and Space, announces its state.

---

## 3. Page families and their bar

| family | pages | bar | height | right-hand group, in order |
|---|---|---|---|---|
| **A. Site** — hub, index, calculators, tools, legal | ~100 | `nav.navbar`, sticky at top | 56 px (48 px ≤ 768 px) | search · account · **theme** · burger (burger only ≤ 768 px, after theme) |
| **B. Journal** — articles, FF, geopolitics | ~40 | same bar as A; the reading-progress line sits on its bottom edge; the TOC sidebar is not a bar | 56 / 48 px | same as A |
| **C. Cockpits** — DC Conventional family (9), datahallAI | 10 | the cockpit bar (title, scope, status), sticky at top | 48 px | status chips · help/basis · **theme** |
| **D. LTC labs** | 6 | `header.ltc-top` | 48 px | lab controls · **theme** |
| **E. Apps** — rz-ops, Finance Terminal, StockMap, DCA, Second Brain | ~6 | each app's own shell | app-defined | app controls · **theme** (same component; rz-ops keeps its own storage key, see OD-4) |

`position: sticky` for every family (OD-1): the bar takes its own space, so no page needs a hand-tuned
`padding-top`, which is where today's overlaps come from.

---

## 4. The theme button — one specification

| property | value |
|---|---|
| Element | `<button type="button" class="rz-theme-btn" data-rz-theme-toggle>` — one id-free hook; the old ids stay as aliases during migration so page scripts that look them up keep working |
| Icon | inline SVG, 18 px, `currentColor`: a sun when the page is dark ("switch to light"), a moon when it is light. No text glyph, no icon font |
| Size | 36 × 36 px box, 1 px hairline, radius 4 px; `@media (pointer: coarse)` 44 × 44 px |
| Colours | site tokens only (`--rz-line-tier-2`, text colour); hover = border colour change; no transform, no glow |
| Name / state | `aria-label="Switch to light theme"` / `"Switch to dark theme"`, `aria-pressed` = dark is on, `title` the same text |
| Behaviour | sets `data-theme` on `<html>`, writes `localStorage.theme`, dispatches `rz-theme-change` on `document` (charts and canvases that paint colours listen to it) |
| Other tabs | a `storage` event on `theme` applies the new theme without a reload |
| No stored choice | follows `prefers-color-scheme`, and keeps following it until the visitor clicks |
| Motion | none on the page; the icon cross-fades 120 ms; nothing under `prefers-reduced-motion` |

### No-flash rule (N6)

One inline snippet, the first thing in `<head>`, identical on every page (generated, never hand-written):

```html
<script>(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();</script>
```

The hard-coded `data-theme="dark"` / `"light"` on `<html>` (45 pages) is removed, so the snippet is the only
authority.

---

## 5. Architecture

| piece | role |
|---|---|
| `js/rz-chrome.js` (new, shared) | owns the theme: `RZChrome.theme()`, `.setTheme()`, `.toggle()`; upgrades any existing button (`#themeToggle`, `#navThemeBtn`, `.theme-toggle`, `.theme-btn`, the one-off ids) into the one component; **injects** the button into the bar's right-hand group on a page that has none; listens to `storage` |
| `css/rz-chrome.css` (new, shared) | bar position and height per family (`data-rz-chrome="site|cockpit|lab|app"` on `<body>`), the right-hand group, the button. Loaded by every page; the rules are mirrored into `styles-index.css` for the homepage (2-stylesheet rule) |
| head snippet | §4, stamped by the sweep tool |
| `tools/sweep-site-chrome.py` (new) | idempotent generator: stamps the head snippet, the two asset tags and the `data-rz-chrome` family; removes per-page theme scripts and `html[data-theme]` literals; `--check` mode for the freshness gate. Uses lambda replacements; refuses a page whose last `</style>` is inside a script string |
| Removed | per-page `toggleTheme()` copies, per-page `.navbar { position: … }` overrides, the "◐" glyph and icon-font markup |

Rules kept from the repo's standards: `js/rz-mobile-nav.js` still owns the burger; the cookie banner, command
palette and version stamp are untouched; no new dependency.

Cockpit pages that have no theme today (7) also need a light palette check: adding the button is only honest
if both themes render. `tools/audit-dark-coverage.mjs` and the axe contrast gate run on them in both themes
before the button ships there (phase P3).

---

## 6. Phases

| phase | content | release |
|---|---|---|
| **P0** | rendered baseline: `tools/test-site-chrome.mjs` in MONITOR mode on all 190 pages × 390 / 768 / 1440 — bar top, height, position type, button presence, box, slot order, icon kind, first-frame theme. The table of §1 is replaced by measured numbers; the worst 20 pages get screenshots | none (tooling) |
| **P1** | `rz-chrome.js` + `rz-chrome.css` + head snippet on family **A** (site pages); gate strict for A | PATCH |
| **P2** | family **B** (journal): the button moves from before the reading column into the bar; `tools/build-journal.py` and the article assembler emit the new markup so regenerated pages do not revert | PATCH |
| **P3** | family **C** (cockpits): the 7 pages without a theme get the button after both themes pass dark-coverage and contrast; the 9 cockpit bars get one height | MINOR |
| **P4** | families **D** and **E** (LTC labs and apps) — LTC-owned pages are edited by the LTC session from this spec, or handed over | PATCH |
| **P5** | gate strict for all families and wired into `ship-gate.sh`; `standarization/UI_FEATURES_STANDARD.md` (navbar + theme sections) and `DARK_MODE_STANDARD.md` updated; per-page overrides deleted | PATCH |

One phase live before the next starts. Each phase: red (the gate on today's pages) → sweep → green → screenshots
at 390 and 1440 in both themes, actually looked at → ship gate → push → live check.

---

## 7. Gate — `tools/test-site-chrome.mjs`

Real browser, every page of the family, 390 / 768 / 1440, both themes.

| check | law | how |
|---|---|---|
| C1 | N1 | exactly one visible `[data-rz-theme-toggle]` |
| C2 | N2 | the button is the last visible control of the right-hand group (the burger may follow at ≤ 768 px); right-edge offset to the bar's content edge and centre-line offset ≤ 1 px; the same offsets on every page of the family (spread ≤ 1 px) |
| C3 | N3 | computed box 36 × 36 (≥ 44 × 44 hit area on a touch profile), an `<svg>` child, no text node, accessible name matches the theme |
| C4 | N4 | bar `getBoundingClientRect().top === 0` before and after a 1,200 px scroll; height = the family value; first content element's top ≥ bar bottom |
| C5 | N5 | click → `data-theme` flips and `localStorage.theme` matches; reload keeps it; a second page opened in the same context has it; a `storage` event flips an already-open page |
| C6 | N6 | with `theme=light` stored and the page default dark: the theme attribute read from an inline script at the end of `<head>` is already `light` (and the reverse) |
| C7 | N7 | Tab reaches the button; Enter and Space toggle; `aria-pressed` follows |
| C8 | — | no page error; no horizontal overflow at 390 px; the burger still opens the menu |

Red proofs kept in the gate header: a page with the button outside the bar fails C2; a page with
`html[data-theme="dark"]` hard-coded and `theme=light` stored fails C6; a page with no button fails C1.
Freshness: `python3 tools/sweep-site-chrome.py --check` (a regenerated page that lost the chrome fails the ship).

---

## 8. Owner decisions (defaults stand if not overridden)

| id | decision | default |
|---|---|---|
| OD-1 | Bar positioning | **sticky** on every family (takes its own space; no content hidden under it) |
| OD-2 | Bar height | 56 px desktop / 48 px ≤ 768 px for site and journal; 48 px for cockpits and labs |
| OD-3 | Slot | theme button is the **last** control on the right (before the burger on a phone) |
| OD-4 | rz-ops theme | keeps its own key `rz_admin_theme` (an admin console may differ from the public site); same button component |
| OD-5 | First visit | follows the device's light/dark preference; dark when the browser gives none |
| OD-6 | Icon | sun / moon SVG (state shown = the theme you switch **to**) |

---

## 9. Risks

- **Generated pages revert.** Articles, incident dossiers and the journal hub are built by generators; the chrome
  must be emitted by them (P2), and the freshness gate must fail when it is missing.
- **Pages worked by another session.** `datahallAI.html`, the LTC labs and their scripts belong to the LTC
  session; this PRD gives the spec, the LTC session (or an agreed hand-over) applies it there.
- **Cockpits in light theme.** Seven cockpits never had a second theme. Adding a button before their light
  palette is checked would ship unreadable pages; P3 gates on contrast first.
- **Scripts that read the old ids.** `#themeToggle` and `#navThemeBtn` stay on the upgraded button as-is, so page
  code that looks them up keeps working; the one-off ids are aliased the same way and removed in P5.
- **The homepage.** `index.html` loads only `styles-index.min.css`; every rule lands in both stylesheets and both
  are re-minified.

## 10. Status

| phase | status |
|---|---|
| P0–P5 | NOT STARTED — awaiting owner approval |
