# Finance Suite Design System — `css/rz-finance-suite.css` (v1.55.0)

ONE shared design language for the finance/admin suite. **Edit the token file once →
every surface re-skins** (the owner's "auto update ini semua" contract).

## Surfaces on the suite

| Surface | Adoption | Notes |
|---|---|---|
| `Apps/finance-terminal/index.html` | `<html … data-rz-suite>` + `<link …rz-finance-suite.css>` | Local `--bg0…--cyn` names remapped in §2 of the suite file (canonical vocabulary). |
| `rz-ops-p7x3k9m.html` | same | Dark-mode style block tokenized to `var(--fs-*)` (443 refs). `body.light-mode` rules keep literal hex (that page's light mode is class-based, vars never flip there). |
| `account.html` | same | Rebuilt ON the tokens (Account Center, v1.55.0). |
| `Apps/stock_screener/prototype/*` (StockMap) | `<html … data-rz-suite="stockmap">` | Its local var names (`--bg`, `--accent`, `--font-serif`, …) remapped to dark canonical values — flips the whole app dark; serif display type retired to the sans stack. |
| `Apps/dca-app` | at BUILD time | `src/ThemeContext.jsx` + `src/index.css` carry the canonical values; changing suite colors requires mirroring there + `npm run build` + redeploying `dist/`. |

## The contract

1. **Tokens live in ONE file**: `css/rz-finance-suite.css` §1 (`--fs-bg0…--fs-cyn`,
   `--fs-sans/--fs-mono`, `--fs-r/rs/rx`). Palette = the Finance Terminal vocabulary
   (deep-slate surfaces, 1px hairlines, tabular JetBrains Mono numerics — the RZ
   instrument aesthetic per `documentation/design.md`). Accent `#8b5cf6` (suite identity).
2. **A surface opts in** with `data-rz-suite` on `<html>` and loading the suite file.
   §2 remaps that surface's LOCAL var names onto `--fs-*` — `html[data-rz-suite]`
   (specificity 0,1,1) outranks the page's own `:root` (0,1,0), so the remap wins
   regardless of stylesheet order. Existing page CSS keeps working, now on shared values.
3. **Never hardcode a suite color in an adopting page.** New components use the tokens
   or the §3 shell classes (`.fs-card`, `.fs-chip`, `.fs-btn[.primary]`, `.fs-num`, `.fs-skel`).
4. **Cache-bust** the suite `?v=` on every adopting page when the file changes.
5. **Light theme**: `html[data-rz-suite][data-theme="light"]` flips the `--fs-*` values.
   Surfaces with a different light mechanism (rz-ops `body.light-mode`) keep their own
   light literals — only their dark look is suite-governed.

## Accessibility notes

- `.fs-btn.primary` uses `#6d28d9` (violet-700), NOT `--fs-acc`: white on `#8b5cf6`
  is ~3.9:1 and fails WCAG AA. Keep any white-text-on-accent at ≥ violet-700.
- Signal colors (`--fs-grn/red/amb/blu/cyn`) signal STATE, never decoration (design.md).

## Terminal keyboard map (C2)

- `S` — jump to Stocks tab + focus symbol search (`/` and `Ctrl+K` belong to the
  sitewide command palette — do NOT rebind them in the terminal).
- `↑/↓` navigate search results, `Enter` opens, `Esc` closes.

## Gotchas paid for

- rz-ops light mode is `body.light-mode` (class), not `[data-theme]` — blanket
  hex→var tokenization corrupted its light rules; light-rule literals were restored.
- The DCA app is a built React bundle: it CANNOT consume the runtime remap; tokens
  are mirrored at build (see table). If suite colors change, rebuild dca-app.
