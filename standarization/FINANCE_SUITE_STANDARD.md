# Finance Suite Design System — `css/rz-finance-suite.css` (v1.55.0)

ONE shared design language for the finance/admin suite. **Edit the token file once →
every surface re-skins** (the owner's "auto update ini semua" contract).

## Surfaces on the suite

| Surface | Adoption | Notes |
|---|---|---|
| `Apps/finance-terminal/index.html` | `<html … data-rz-suite>` + `<link …rz-finance-suite.css>` | Local `--bg0…--cyn` names remapped in §2 of the suite file (canonical vocabulary). |
| `rz-ops-p7x3k9m.html` | same | Both themes come from the tokens (w5, 2026-11-14): the toggle sets `<html data-theme>` (and keeps `body.light-mode` as the JS flag for chart colours); the 111 `body.light-mode` hex rules were deleted, and inline `style=` colours in markup and generated HTML read `var(--fs-*)`. The print report (`openReport`) keeps literal hex: it renders in a new window without the tokens. |
| `account.html` | same | Rebuilt ON the tokens (Account Center, v1.55.0). |
| `Apps/stock_screener/prototype/*` (StockMap) | `<html … data-rz-suite="stockmap">` + `assets/theme.js` in `<head>` | Its local var names (`--bg`, `--accent`, `--font-serif`, …) remapped to the canonical tokens; dark by default, light when `data-theme="light"` (theme-synced from rz-ops). Serif display type retired to the sans stack. |
| `Apps/dca-app` | at BUILD time | `src/ThemeContext.jsx` + `src/index.css` carry the canonical values; changing suite colors (or the theme-sync listener) requires mirroring there + `npx vite build` + committing `dist/`. No `node_modules` in a worktree: symlink `~/rz-work/Apps/dca-app/node_modules` for the build and remove the link before committing. |

## The contract

1. **Tokens live in ONE file**: `css/rz-finance-suite.css` §1 (`--fs-bg0…--fs-cyn`,
   `--fs-sans/--fs-mono`, `--fs-r/rs/rx`). Palette = the Finance Terminal vocabulary
   (deep-slate surfaces, 1px hairlines, tabular JetBrains Mono numerics — the RZ
   instrument aesthetic per `documentation/design.md`). Accent **cyan-800 `#155e75` / cyan-700
   `#0e7490`** (v3.6.1 — was `#8b5cf6`, then `#6d28d9`/`#7c3aed`; the whole violet family is
   banned and `tools/test-purple-family.mjs` now enforces it by hue).
2. **A surface opts in** with `data-rz-suite` on `<html>` and loading the suite file.
   §2 remaps that surface's LOCAL var names onto `--fs-*` — `html[data-rz-suite]`
   (specificity 0,1,1) outranks the page's own `:root` (0,1,0), so the remap wins
   regardless of stylesheet order. Existing page CSS keeps working, now on shared values.
3. **Never hardcode a suite color in an adopting page.** New components use the tokens
   or the §3 shell classes (`.fs-card`, `.fs-chip`, `.fs-btn[.primary]`, `.fs-num`, `.fs-skel`).
4. **No key in a page.** A provider token, API key or password never sits in suite HTML/JS or in a storage
   fallback (`getItem(k) || '<literal>'`). The secret gate `node tools/test-no-client-secrets.mjs --law X1.2a`
   (PRD-X-DEFECTS FR-X1.3) fails a new hit; `Apps/finance-terminal/index.html` is baselined until OA-1.
5. **Cache-bust** the suite `?v=` on every adopting page when the file changes.
6. **Light theme**: `html[data-rz-suite][data-theme="light"]` flips the `--fs-*` values. That is the ONLY
   light mechanism on the suite: a surface switches the attribute, never adds per-selector light hex
   (rz-ops did until w5 and drifted to 1.4–2.7:1 text). Every token pair holds WCAG AA as text on
   `--fs-bg0…3` in both themes (w5 raised dark `--fs-t4` to `#808998`, light `--fs-t4` `#5b6577`,
   `--fs-grn` `#047857`, `--fs-red` `#b91c1c`, `--fs-amb` `#92400e`, `--fs-cyn` `#155e75`).
7. **Theme sync for embedded apps** (rz-ops hosts DCA, Finance Terminal, StockMap in same-origin iframes):
   - the console posts `{type:'theme-sync', theme:'light'|'dark'}` with `targetOrigin = location.origin`
     to EVERY embedded app on each toggle AND on each iframe `load` (they load lazily, after the console
     theme is set — a toggle-only post leaves a late-loading app on its own default);
   - each app listens with an origin check (`e.origin === location.origin`), accepts only `light`/`dark`,
     and applies it to its own mechanism (`<html data-theme>`; DCA through `ThemeContext` state);
   - on first paint each app reads `localStorage.rz_admin_theme` when framed (`window.parent !== window`),
     else its own saved key (`rz_ft_theme`, `dca-theme`, `stockmap_theme`);
   - a new embedded app joins `THEME_IFRAMES` in rz-ops and implements the three points above.
   Gate: `node tools/test-rz-ops-theme.mjs` (T1 reads each app's `data-theme` AND the luminance it paints,
   after load and after each toggle, starting from either theme).

## Accessibility notes

- `.fs-btn.primary` pins **`#155e75`** (cyan-800) rather than reading `--fs-acc`, and the reason
  is worth stating exactly, because the version of this note that stood until v3.6.1 got the
  arithmetic wrong. Measured on white: `#8b5cf6` **4.23:1** (fails AA), `#64748b` — what `--fs-acc`
  resolves to in dark — **4.76:1** (passes AA, but with no margin at all under the semibold .82rem
  this button sets), `#0e7490` **5.36:1**, `#155e75` **7.27:1**. The pin is about the missing
  margin, not about a failure. Keep any white-text-on-accent at ≥ 7:1 here.
- Signal colors (`--fs-grn/red/amb/blu/cyn`) signal STATE, never decoration (design.md).

## Terminal keyboard map (C2)

- `S` — jump to Stocks tab + focus symbol search (`/` and `Ctrl+K` belong to the
  sitewide command palette — do NOT rebind them in the terminal).
- `↑/↓` navigate search results, `Enter` opens, `Esc` closes.

## Gotchas paid for

- rz-ops light mode WAS `body.light-mode` (class) with literal hex — tokenizing the dark rules while the
  light rules stayed literal corrupted them once. Since w5 the class only flags JS; `<html data-theme>`
  flips the tokens and the hex light rules are gone. A contrast checker must composite gradients by
  every stop: the seed audit read a gradient button against its parent colour and called it 1.05:1.
- The DCA app is a built React bundle: it CANNOT consume the runtime remap; tokens
  are mirrored at build (see table). If suite colors change, rebuild dca-app.
