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

- `position: sticky; top: 0` on every kind. Not `fixed` (it needs a hand-tuned body offset on every page, which is
  where 13 different heights came from) and not `static` (the bar scrolls away).
- One height per kind (the token above). A second row — breadcrumbs, a status strip, a reading-progress line — sits
  **under** the bar, never inside it.
- The bar never causes sideways scroll and never holds a control narrower than 44 px on a phone.

## 3. The right-hand cluster

Order, left to right, wherever the control exists: **search · theme · sign-in / account · menu**.
On a phone (≤ 768 px) the bar keeps **theme · menu**; search and sign-in live in the menu drawer.
Each slot is a 44 × 44 box with one gap token, so the theme button's distance from the right edge depends only on
which slots exist — it is the same on every page of a kind.

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

## 7. Baseline (2026-11-18, before any refit)

Recorded in `tools/site-chrome-baseline.json` by `--baseline`. Re-record only after a refit that lowered a count;
never to make a regression pass. `--list=CH2` prints every failing page of a law with its reason.

## 8. Who edits what

Site, journal, incident and remaining pages, `datahallAI.html` and the LTC labs: the session that holds this PRD.
The Conventional cockpits: the Conventional session, from this standard. Generated pages (incidents, journal hub
and series, changelog) change in their generator's template, then are rebuilt.
