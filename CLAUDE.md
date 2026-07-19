# CLAUDE.md — resistancezero.com

> Project-specific instructions for Claude Code.
> **Read this file BEFORE making any changes.** Each section documents a class
> of mistakes already paid for in real regressions — don't repeat them.

---

## Site overview

- **Domain**: https://resistancezero.com
- **Hosting**: GitHub Pages (repo `baguspermana7-cpu/bfrfranco.github.io`, main branch, root)
- **Build**: zero-build — files served as-is
- **Tech**: HTML5 + CSS3 + vanilla ES5 JavaScript + Python tooling + Remotion (video)
- **Local server**: `python3 -m http.server 8081`
- **Pages**: 103+ indexable HTML pages (calc, articles, tools, virtual labs, simulations, hubs, legal)
- **Owner**: Bagus Dwi Permana (Engineering Operations Leader, Bekasi, Indonesia)

---

## Versioning discipline (REQUIRED)

Single source of truth: `js/rz-version.js`

```js
window.RZ_VERSION = '1.X.Y';
window.RZ_VERSION_DATE = 'YYYY-MM-DD';
window.RZ_VERSION_CODENAME = 'Pixel Rise';
```

**Every shipped change MUST**:
1. Bump `js/rz-version.js` per semver (PATCH for bug-fixes, MINOR for features, MAJOR for breaking layout/IA changes).
2. Append a `## v1.X.Y — YYYY-MM-DD` entry to `CHANGELOG.md`.
3. Run `python3 tools/build-changelog-html.py --apply` so the public `/changelog.html` regenerates.

**Audit before push**:
```bash
python3 tools/audit-script-tags.py --strict        # </script> in JS strings
python3 tools/audit-js-syntax.py --strict          # unterminated strings / CSS-in-JS (v1.19.0)
python3 tools/audit-version-stamp.py --strict      # version stamp on all pages
python3 tools/audit-mobile-responsive.py --strict  # responsive checkpoints (static scorer)
node   tools/audit-responsive-layout.mjs --strict  # render gate: real horizontal-scroll + wide article tables (v1.49.8)
python3 tools/audit-seo.py                         # SEO meta + JSON-LD
node   tools/audit-dark-coverage.mjs --strict      # NO white body/content in dark mode (v1.47.x)
node   tools/audit-article-charts.mjs --strict     # every article chart carries source + basisTag (v1.50.1)
node   tools/audit-interactions.mjs --strict      # REAL-input gate: palette, living diagrams, scrolly, polish (v1.50.34)
node   tools/audit-a11y.mjs --strict               # axe-core render gate: 0 critical/serious on 8-page set x both themes (v1.50.41)
```

**Engine + accuracy tests** (v1.32.x accuracy-review work — gate any ship that touches the BMS cockpit pages):
```bash
node tools/test-datahall-calc.mjs                  # 57/57 doc-21 worked examples
node tools/test-conv-calc.mjs                      # 22/22 conv DoD identities
RZ_BASE=file node tools/probe-accuracy-validation.mjs   # 40/40 reviewer acceptance tests
node tools/test-rz-engine.mjs                      # RZEngine v2.0 — model worked examples + data invariants + reachability + provenance (gate any change to rz-engine.js)
node tools/test-fin-engine.mjs                     # FIN Engine — ratios/valuation/technical/score worked examples + ta.js PARITY + invariants + provenance + disclaimer (gate any change to fin-engine.js)
node tools/backtest-fin-screener.mjs               # FIN Engine — walk-forward technical-gauge backtest vs live gateway /candles (accuracy check, needs network; not a strict gate — honest verdict: gauge is descriptive not predictive)
```

**RZEngine / FIN Engine build step** (whenever `rz-engine.js` or `fin-engine.js` changes): regenerate the min twin reproducibly, never hand-edit it, then bump the shared `?v=` on the pages that load it:
```bash
terser rz-engine.js  -c -m -o rz-engine.min.js    # reproducible minify (A8)
terser fin-engine.js -c -m -o fin-engine.min.js   # FIN Engine (finance) — see standarization/FIN_ENGINE.md
# then bump the min `?v=YYYY-MM-DD-tag` across the pages that load it (+ rz-engine pdf.scriptTagsHTML())
```
**AUTO-LINKING chain (owner mandate — engine changes must propagate to docs WITHOUT manual edits):** after ANY `rz-engine.js` change also run `node tools/build-engine-catalog.mjs` (regenerates `dcmoc/src/lib/engine-catalog.json` — models/functions/params/sources/consumers, grep-derived) then `node tools/test-value-bindings.mjs` (SHIP GATE: value-bindings coherence + catalog staleness — a changed engine with a stale catalog does NOT ship). The DCMOC Knowledge Base + FAQ render the catalog live, so regeneration = all doc surfaces current. See ENGINE_UNIFICATION.md §AUTO-LINKING CHAIN.

Every `DATA` value must carry a `DATA.sources` entry (`source`+`asOf`); no economically-material literal may live inside a `models.*` function body. See `standarization/SUPER_ENGINE.md` §Z (RZ) + `standarization/FIN_ENGINE.md` (finance). **FIN Engine is educational analysis only — not investment advice/not a licensed advisor; every scored output carries `FINEngine.DISCLAIMER` (gate-asserted).** Its `models.technical` must stay parity-identical to `cf-worker/src/ta.js`.

The probe is the verification harness for `Documents/screenshot bms rz/dc ai/review/26-accuracy-validation-and-correction-list.md` + `Documents/screenshot bms rz/conv/review/16-accuracy-validation-and-correction-list.md`. It covers per-page assertions on `datahallAI.html`, `dc-conventional.html`, `datahall.html` + cross-page consistency (PUE/WUE/IT reconciles across all displaying pages). See `standarization/ACCURACY_VALIDATION.md` for the 6 rules + 23 acceptance tests it enforces.

If the probe fails, do NOT push. Investigate the failure — the probe was authored specifically to catch the bugs the reviewer flagged, and it caught two real ones (FAQ ReferenceError + dashboard random KPIs) on its first run.

**After push**: `python3 tools/indexnow-submit.py --since HEAD~1` pings Bing/Yandex/Seznam.

---

## CRITICAL: 2-stylesheet architecture

**`index.html` loads ONLY `styles-index.min.css`. NO other page does.**

Most other pages load the full `styles.css` / `styles.min.css`.

This caused 3 separate session regressions:
- **v1.4.1**: Floating share-buttons invisible — `.share-buttons` rules were in `styles.css`, never reached index.
- **v1.6.3**: Video-modal X close button rendered as default browser button — same root cause.
- **(others)**: Various CSS additions to `styles.css` invisible on index.

**Rule**: When adding ANY CSS that affects `index.html`, the rule MUST be in BOTH:
- `styles.css` (for the rest of the site), AND
- `styles-index.css` (for the homepage)

After editing either, **re-minify**:
```bash
cleancss styles.css -o styles.min.css
cleancss styles-index.css -o styles-index.min.css
```

Bump the cache-bust query string when changes ship: `styles-index.min.css?v=YYYYMMDD-tag`.

---

## CRITICAL: `</script>` inside JS string literals

The browser HTML tokenizer is **not JS-aware**. A literal `</script>` inside a JS string terminates the surrounding `<script>` element early and silently breaks every function declaration below.

**Always escape as `<\/script>`** in:
- PDF print-window template strings
- Dynamic HTML injection
- Any JS template literal that emits HTML

This bug previously killed every interactive feature on 5 calc pages (commits `a9a2c4b`, `a93d7d0`).

**The auditor catches it**: `python3 tools/audit-script-tags.py --strict` blocks any push with a regression.

---

## Dark-mode coverage discipline

**Every CSS rule with hardcoded light backgrounds MUST have a matching `[data-theme="dark"]` override.**

3 separate regressions in one session traced to this gap:
- **v1.2.2**: `.brief-card` (un-prefixed) had no dark override on opex/capex (tco uses `.tco-brief-*` prefixed — agent missed the un-prefixed variant).
- **v1.2.3**: `.model-card` is opex-only — agent's pattern-match across pages didn't catch it.
- **v1.4.1**: HTML uses `.input-field` but CSS targeted page-prefixed `.opex-input` / `.capex-input` — class-mismatch broke ALL select dropdowns on 5 pages.

**Never trust class-name pattern-matching across pages.** Each calc page's classes must be enumerated individually before claiming dark-mode coverage is complete.

**Audit hint**: `grep -E '\\[data-theme="dark"\\]' <page>.html | wc -l` should report ≥30 on calc pages. Reference: `tco-calculator.html` (49 dark rules, canonical pattern).

### CRITICAL: the `:root, [data-theme="light"]` cascade bug (v1.47.x — fixed 11 pages)

Many bespoke pages (cdu-*, compare-*, fire-*, pln-sumatra) rendered **white body in dark mode** — "only the nav + title go dark, the article background stays white". Root cause was a theme-var cascade bug:

```css
[data-theme="dark"]          { --bg: #0f172a; }   /* dark values */
:root, [data-theme="light"]  { --bg: #f8fafc; }   /* WRONG: :root matches in ALL themes */
```

`:root` (specificity 0,1,0) matches the html element regardless of theme and, coming **after** the `[data-theme="dark"]` block (equal specificity), **always wins** — so dark values never apply. **Always write the light fallback as `:root:not([data-theme="dark"])`** (or `[data-theme="light"]` only):

```css
:root:not([data-theme="dark"]) { --bg: #f8fafc; }   /* CORRECT: light only when NOT dark */
```

**Every content page MUST define a dark palette** (a `[data-theme="dark"]{ --bg/--surface/--text/... }` block redefining its surface + text vars) **or load the standard skin, and MUST pass `node tools/audit-dark-coverage.mjs --strict`** — the render gate that fails any page showing a white body or large light content block in dark mode (it also statically flags the `:root,` cascade bug). This is now in the ship-audit suite. Don't ship a page that fails it. See [DARK_MODE_STANDARD.md] and the [implement-applicable-standards] memory mandate.

---

## Auth tiers (v1.22.x, educator-tier migration)

The auth model is a 4-tier matrix with a 5-role overlay. Session schema is
unchanged (`{email, tier, expires, role?}` in `rz_premium_session`).

**Tier ladder** (4 columns in `rz-feature-flags.js`):

```
free  →  demo  →  pro  →  root
```

**Role ladder** (orthogonal label on the session):

```
free  →  demo  →  pro  →  educator  →  root
```

Educator users have `session.tier === 'pro'` (educator is a ROLE, not a
tier) AND `session.role === 'educator'`. They consume the PRO column for
feature-flag access but are blocked from the rz-ops admin panel just like
plain pro users. Existing `session.tier === 'pro'` checks across article
pages remain correct because educator already satisfies them.

**Helpers** (in `auth.js`):

- `window._rzAuth.getTier(session?)` → `'free' | 'demo' | 'pro'` (root emails return `'pro'`)
- `window._rzAuth.getRoleFromSession(session)` → `'' | 'pro' | 'demo' | 'educator' | 'root'`
- `window._rzAuth.enforceTierFeatureAccess(pageKey)` — page-level gate that consults the `page-access` feature on the page entry. DC AI, DC Conventional, DCMOC, and all LTC labs were converted from the legacy `ROOT_ONLY_PATHS` hard block to this matrix-driven pattern. `/dc-market-tracker.html` remains root-only via the residual `ROOT_ONLY_PATHS` list.

**EDUCATOR badge** (header dropdown pill, post-login): instrument-cyan,
NOT purple. Tokens: `background: rgba(8,145,178,0.18); color: #67e8f9;`.
CSS rule is mirrored in BOTH `styles.css` AND `styles-index.css` per the
2-stylesheet architecture rule above.

**Educator allowlist** seed is hardcoded in `auth.js`
(`EDUCATOR_SEED_EMAILS`); admin overrides live in
`localStorage.rz_admin_educators` and fire a `rz-educators-changed` event
when written by the rz-ops admin panel.

Full spec: `standarization/AUTH_STANDARD.md` (§Auth tiers),
`standarization/PRO_MODE_STANDARDIZATION.md` (§14),
`standarization/FEATURE_FLAGS_STANDARD.md` (§12).

---

## Mobile responsive standard (mandate from Plan v15, v1.8.0+)

Every public HTML page MUST score ≥7/10 on `tools/audit-mobile-responsive.py`. Required checkpoints:

```css
@media (max-width: 768px) {
    html, body { overflow-x: hidden; max-width: 100vw; }
    img { max-width: 100%; height: auto; display: block; }
    .nav-menu, .nav-links { display: none; }
    .footer-grid { grid-template-columns: 1fr; gap: 1.25rem; padding: 1rem; }
    button, a.btn, [role="button"] { min-height: 44px; }
}
```

Plus required:
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` in `<head>`
- v1.8.0 marker comment for idempotency: `/* v1.8.0 — mobile responsive patch */` (variants per category — see `standarization/RESPONSIVE_STANDARD.md`)
- Floating `.share-buttons` → bottom-bar transition on mobile

### CRITICAL: hamburger toggle is MANDATORY (lesson from v1.8.4)

When `.nav-menu/.nav-links { display: none; }` hides the menu on mobile, you MUST also provide a hamburger toggle so users can still access navigation. v1.8.0 shipped without this and 116 pages had no mobile menu access.

The toggle is provided by `js/rz-mobile-nav.js` (auto-injects a hamburger button into any `nav.navbar` / `header.navbar` / `.navbar`). Loaded on every page via `<script src="js/rz-mobile-nav.js?v=…" defer>`. CSS for `.rz-nav-burger` + `body.rz-nav-open` drawer styling lives in BOTH `styles.css` AND `styles-index.css`.

DO NOT remove the hamburger script tag from any page. DO NOT remove the open-state CSS. If you change the navbar markup, ensure the hamburger script can still find the `.nav-container` or `.nav-right` host.

---

## Rejected patterns — DO NOT REINTRODUCE

These were explicitly rejected by the user. Adding them back is a regression:

1. **Dot-grid pattern on `.hero-background`** — looks like "default Claude noise". Use only soft radial washes (gold + mint, opacity ≤0.06).
2. **Rotated `.floating-side-cards`** at right-edge of index.html (`#DATACENTER AI / HPC` + `#DATACENTER CONVENTIONAL` vertical tabs) — rejected as noisy.
3. **Anthropic-default purple `#8B5CF6` user pill** — replaced with mint `#7DDDB4` (Motion+ feel).
4. **Cursor-tracking effects** (mouse spotlight, magnetic cursor, 3D card tilt with mouse follow) — explicitly disabled in `script.js` (`initCardTilt`, `initSpotlight` — early return). Don't re-enable.
5. **Visible "GitHub" label + `github.com/baguspermana7-cpu` URL** in Contact section + footer — removed in v1.1.0. Schema.org `sameAs` JSON-LD references are kept; visible text is gone.
6. **Saturated emerald solid bento cards** — replaced with calm pastel rotation (mint / lavender / peach / pink / cream).
7. **Saturated gradient callout fills + 3–4px accent borders** (`.info-box`/`.ws-insight-box`/`.ws-engineer-note`) — replaced (v1.50.1) by the editorial language: flat `color-mix` tint + 1px hairline + a 2px semantic accent rail, scoped to `html[data-rz-register="editorial"]` in `css/rz-article-dark.css`. See ARTICLE_DATAVIZ + DARK_MODE standards. **Extended (v1.51.9, "slop sweep 2")**: translucent `-card/-panel/-block` washes and prose `span[style*=background]` highlights are also banned — the editorial runtime (`flattenWashes()` in `js/rz-article-editorial.js`) MEASURES computed background alpha (.02–.5 = slop wash → `data-rz-flat` → flattened to panel+hairline) so opaque instrument embeds keep their skin. Never re-add tinted highlight spans or translucent card washes to article bodies; never flatten by class-name blanket (it can't tell a wash from an instrument surface — computed alpha can).
8. **White text on saturated category-gradient number badges** (articles grid) — washed out on red/teal thumbnails; replaced with one dark-glass instrument chip (`rgba(13,16,20,.72)` + hairline + mono tabular number) in `articles.html`.
9. **Article body centered per-paragraph with a `ch`-based measure** — caused ragged left edges (lead ¶ vs body ¶). Use the single LEFT-aligned, justified, fixed-`rem` reading column in `css/rz-article-dark.css` (v1.50.1).

---

## Canonical patterns to follow

### `.share-buttons` floating right-column

5 canonical platforms ONLY (in this order): LinkedIn / X (Twitter) / WhatsApp / Instagram / Facebook.

Pattern in `styles.css` and `styles-index.css`:
```css
.share-buttons { position: fixed; right: 20px; top: 50%; transform: translateY(-50%); }
.share-buttons.visible { opacity: 1; visibility: visible; }
@media (max-width: 768px) { /* collapses to bottom bar */ }
```

DON'T add per-page colour variants. Extend the canonical list in styles.css if a new platform is genuinely needed.

### Aurora mesh hero (v1.4.0+)

Multi-stop radial gradients drifting on alternating 22s + 28s loops. Mint + gold + violet + blue + pink. CSS-only, GPU-accelerated transforms. Honours `prefers-reduced-motion`.

### Pixel Rise scroll cue (v1.1.0+)

Soft chevron-bounce + uppercase letterspaced caption. Use on landing pages instead of static "↓ SCROLL" labels.

```html
<a href="#firstSection" class="scroll-explore-pixel">
  <span class="scroll-explore-caption">Scroll to explore more</span>
  <span class="scroll-explore-arrow"><svg>...chevron-down...</svg></span>
</a>
```

### Pastel bento card palette

5-card rotation in landing-page hero:
- Card 1: mint `#A7F3D0`
- Card 2: lavender `#C7D2FE`
- Card 3: peach `#FED7AA`
- Card 4: pink `#FBCFE8`
- Card 5: cream `#FDE68A`

Award badges (`.bento-award`) use muted pastel chip (mint bg + dark text), NOT saturated emerald.

### Card shine sweep on hover (v1.4.0+)

```css
.card::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.9s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover::after { transform: translateX(100%); }
```

### Marquee strip (v1.4.0+, vercel.com pattern)

Horizontal scroll of engineering keywords with edge fade-out masks. 60s linear loop. Honours `prefers-reduced-motion`.

### Open Graph cards

Per-page 1200×630 WebP at `assets/og/<slug>.webp`. Generated by `tools/build-og-images.py`. Page meta references this path.

Fallback for pages without their own OG card: `assets/profile-photo.jpg`.

### Dark-mode default colours

```css
[data-theme="dark"] body { background: #0f172a; color: #f1f5f9; }
[data-theme="dark"] .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); }
[data-theme="dark"] .input-field { background: #1e293b; color: #f1f5f9; border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] select option { background: #1e293b; color: #f1f5f9; }
```

---

## Remotion video (current: v4)

Source: `/home/baguspermana7/my-video/src/compositions/`
- `ResistanceZeroIntro.tsx` — 1920×1080 landscape (90s, 9 scenes)
- `ResistanceZeroIntroPortrait.tsx` — 1080×1920 portrait (90s, 9 scenes)

Reusable VFX components in `src/components/`:
- `glitch-transition.tsx` (RGB chromatic aberration + scan-line corruption between scenes)
- `holographic-grid.tsx` (animated hex-grid overlay)
- `kinetic-text.tsx` (spring-powered slide-in with blur-out)
- `lens-distortion.tsx` (pincushion warp on finale)

9-scene structure (2700 frames @ 30 fps):
1. Electricity Awakens · 2. DC Awakens · 3. SLD · 4. Calculators · 5. Virtual Labs (LTC honeycomb) · 6. DC AI vs Conventional · 7. Market & Grid Monitors · 8. DCMOC + Finance · 9. Knowledge Graph + Finale

Output: `assets/resistancezero-intro.mp4` (13 MB) + `assets/resistancezero-intro-portrait.mp4` (11 MB) + matching posters.

Auto-detect in `index.html` `openIntroVideo()`: `matchMedia('(max-width: 768px) and (orientation: portrait)')` → swap MP4.

Music: `my-video/public/audio/intro-music.mp3` — currently a synthesized electric drone via `ffmpeg lavfi sine`. Replace with a real CC0 cinematic track if user provides one.

---

## SEO + AI search

- **Sitemap**: `sitemap.xml` (103 URLs). Regen via `tools/build-sitemap.py --apply`.
- **AI content map**: `/llms.txt` (140 lines, 98 pages, llmstxt.org spec). Regen via `tools/build-llms-txt.py --apply`.
- **AI full-content**: `/llms-full.txt` (~1.9 MB Markdown extraction). Regen via `tools/build-llms-full.py --apply`.
- **`robots.txt`**: 12 explicit AI-bot allows (GPTBot, ClaudeBot, anthropic-ai, ChatGPT-User, OAI-SearchBot, PerplexityBot, Google-Extended, Bingbot, cohere-ai, Diffbot, etc.).
- **IndexNow**: key already verified at `/768683436ffdfcc2bb9140345660b139.txt` (2026-03). DO NOT generate new key — sync `.indexnow-key` to use this.
- **Per-page schema**: every page gets at least Article/WebApplication + BreadcrumbList. Calc pages get +FAQPage + HowTo. Index gets +Person + Organization + WebSite + SearchAction.

---

## Tooling reference

| Tool | Purpose |
|---|---|
| `tools/audit-script-tags.py` | `</script>` in JS strings — STRICT for CI |
| `tools/audit-version-stamp.py` | version-stamp on all pages — STRICT for CI |
| `tools/audit-mobile-responsive.py` | 8-checkpoint responsive scorer — STRICT for CI |
| `tools/audit-dark-coverage.mjs` | render gate — fails any page with white body/content in dark mode + the `:root,` cascade bug — STRICT for CI (v1.47.x) |
| `tools/audit-responsive-layout.mjs` | render gate — fails real mobile/tablet horizontal scroll (actual `scrollX`) + article tables wider than the reading column — STRICT for CI (v1.49.8) |
| `tools/audit-article-charts.mjs` | data-viz provenance gate — fails any `[data-rz-chart]` config missing `source`/`basisTag` — STRICT for CI (v1.50.1) |
| `tools/audit-interactions.mjs` | interaction gate — exercises palette / living diagrams / scrollytelling / reading polish with real keyboard+scroll input (own HTTP server) — STRICT for CI (v1.50.34) |
| `tools/audit-seo.py` | per-page SEO meta health — non-strict |
| `tools/build-sitemap.py` | regen sitemap.xml from filesystem |
| `tools/build-llms-txt.py` | regen llms.txt |
| `tools/build-llms-full.py` | regen llms-full.txt (concatenated Markdown) |
| `tools/build-search-sections.py` | regen search-sections.json (palette deep search over h2 sections) — run `--apply` after adding/renaming article sections |
| `tools/build-og-images.py` | generate per-page OG cards |
| `tools/build-changelog-html.py` | regen public /changelog.html from CHANGELOG.md |
| `tools/insert-version-script.py` | walk pages and inject `<script src="js/rz-version.js">` |
| `tools/indexnow-submit.py` | POST changed URLs to Bing/Yandex IndexNow |
| `tools/inject-schema-faq-howto.py` | add FAQ/HowTo JSON-LD to calc/tool pages |
| `tools/test-datahall-calc.mjs` | DC AI engine — 57/57 doc-21 worked examples |
| `tools/test-conv-calc.mjs` | DC Conv engine — 22/22 DoD identities |
| `tools/probe-accuracy-validation.mjs` | Reviewer's 23 acceptance tests + cross-page Rule-1 consistency — 40/40 PASS at v1.35.1 (see standarization/ACCURACY_VALIDATION.md) |
| `tools/build-countries-data.mjs` | Generates `rz-engine.js DATA.countries` (single-source country reference) from `dcmoc/src/constants/countries.ts`. Rerun after editing countries.ts, then terser + `?v=` bump. See standarization/ENGINE_UNIFICATION.md |
| `tools/test-reference-parity.mjs` | Reference-data parity gate — fails if `DATA.countries` drifts from the DCMOC source, or per-country electricity/grid-carbon/tax/enums/currency diverge (126/0) |

---

## Shared article/site JS modules — REUSE, never re-implement

These shared modules are the ONLY implementation of their feature. Do NOT hand-roll a per-page copy —
that is exactly how the site ended up with 3 divergent inline search implementations (2 of them broken,
unified in v1.50.23–.27). When editing any of these, **cache-bust the `?v=` on every page that loads it**.

| Module | Feature | Notes |
|---|---|---|
| `js/rz-command-palette.js` | Site search + command palette (Ctrl/Cmd+K, "/", Fuse.js over search-index.json, Commands group) | Self-injects modal markup if absent; guard `window.__rzPalette`. NEVER re-add an inline search block. |
| `js/rz-article-editorial.js` | Editorial runtime: read-progress, related rail, entrance stagger, heading anchors, "≈N min left" chip | Activates only under `data-rz-register="editorial"`. |
| `js/rz-article-chart.js` | Interactive sourced charts (`[data-rz-chart]` + `rz-chart-cfg` JSON) | Provenance gated (`audit-article-charts.mjs`). See ARTICLE_DATAVIZ_STANDARD.md. |
| `js/rz-article-diagram.js` | Living diagrams — animated SVG schematics + ticker + fault scenarios (`[data-rz-diagram]`) | Same provenance gate; conduit stroke idiom (4px base + 2px dash). |
| `js/rz-scrolly.js` | Scrollytelling — pinned canvas + step cards (`[data-rz-scrolly]`) | Flagship: article-23. Recipe in ARTICLE_DATAVIZ_STANDARD.md. |
| `js/rz-mobile-nav.js` | Hamburger nav (mandatory on every page) | See responsive section above. |
| `js/rz-calc-utils.js` | Calculator input-validation + CSV export (`window.RZCalc`) | Rollout tracker: standarization/CALC_HARDENING_ROLLOUT.md. |
| `css/rz-finance-suite.css` | Finance/admin suite design tokens (`--fs-*`) + shell classes (`.fs-card/.fs-chip/.fs-btn/.fs-skel`) | EDIT ONCE → re-skins rz-ops, Finance Terminal, account, StockMap, DCA (DCA at build). Adoption: `<html data-rz-suite>` + link the file. See standarization/FINANCE_SUITE_STANDARD.md. NEVER hardcode suite colors in adopting pages. |
| `js/rz-explain.js` + `js/rz-explain-db.js` | RZExplain — THE tooltip/explanation engine (hover any parameter/menu/tab → rich panel; nested terms; a11y; mobile bottom-sheet) | DB is GENERATED (`tools/build-explain-db.py` from glossary.html + tools/explain-extra.json — curated wins). NEVER hardcode tooltip text in a page; use `data-explain="key"` or `data-explain-scan`. Legacy per-page tooltip families DEPRECATED (see standarization/EXPLAIN_ROLLOUT.md). Gate: `node tools/test-explain-db.mjs`. |
| `js/rz-cookie-consent.js` | Cookie-consent banner (accept/decline + GA gating) | Self-injects markup+CSS; guard `window.__rzCookieConsent`; key `rz_cookie_consent` (migrates legacy `cookieConsent`); dispatches `rz-cookie-consent` CustomEvent on `document` — sequence first-visit features (e.g. spares tour) on it. Localize via inline `window.RZ_COOKIE_TEXT` BEFORE the script tag (`/id/` pages). NEVER re-add a per-page inline banner (115 copies removed v1.54.3 via `tools/rollout-cookie-consent.py`). Per-page head GA snippets read the same key pre-GA-load — leave them. |

## Standardisation docs

Reference these BEFORE adding new patterns. Update them WHEN shipping a new pattern.

- `standarization/VERSIONING_STANDARD.md` — semver scheme + bump checklist
- `standarization/RESPONSIVE_STANDARD.md` — mobile breakpoints + 8 checkpoints
- `standarization/UI_FEATURES_STANDARD.md` — share-buttons, scroll cue, navbar, hero, bento, version stamp, dark-mode coverage
- `standarization/SEO_OPTIMIZATION_STANDARD.md` — meta, canonical, OG, JSON-LD, AI search optimisation
- `standarization/AUTH_STANDARD.md` — login modal, auth widget injection
- `standarization/PDF_EXPORT_STANDARD.md` — PDF print-window templates + `<\/script>` escape rule
- **`standarization/CONTENT_LINKAGE_PLAYBOOK.md` — READ AT START & END of any content/feature task.** The "when X changes, also update Y" handoff (new article → insights feed + articles index + series page + glossary + sitemap + search-index + llms + post-drafts; new tool → tools/dc-solutions/rz-ops; every change → version+changelog+sw+gates+memory). Changelog is easter-egg-only (version stamp), never a nav item.
- **`standarization/ACCURACY_VALIDATION.md` — READ BEFORE touching cockpit pages** (DC AI / DC Conv / datahall / chiller-plant / water-system / fire-system / fuel-system / ict / EPMS). 6 rules (one source of truth · no Math.random on basis KPIs · explicit denominator on every metric · marketing target ≠ derived value · terminology must match engineering basis · basis chip on every critical KPI) + 23 acceptance tests codified in `tools/probe-accuracy-validation.mjs`. Owner-exclusion on `#p-dash` / `updateDashKPI()` / `dcCallouts` was LIFTED 2026-05-23 — those zones are now under the same accuracy gates as the rest. Source review docs: `Documents/screenshot bms rz/dc ai/review/26-accuracy-validation-and-correction-list.md` + `.../conv/review/16-accuracy-validation-and-correction-list.md`.
- **`standarization/BMS_SHELL.md`** — shared cockpit foundation library; adoption status across 9 pages.
- **`standarization/TECH_SPEC_PDF.md`** — Generate Design + FAQ buttons + Tech Spec PDF build pattern (datahallAI + dc-conventional).

---

## Process discipline

> **Cross-linkage handoff:** before starting AND before shipping any content
> or feature task, walk `standarization/CONTENT_LINKAGE_PLAYBOOK.md` §1–§4.
> A green build with a stale cross-reference (e.g. insights feed missing new
> articles, search-index missing a page) is still a failure.

### Use TaskCreate for multi-step work

Track progress + show user where you are. Mark completed as soon as done.

### Don't break what's working

Make MINIMAL surgical changes for the user's literal complaint. Don't refactor surrounding code. If unclear, ASK before changing.

### Verify before claiming "fixed"

Especially for second-attempt bugs. Screenshot or hard-refresh confirmation required before reporting a UI fix done.

### Think comprehensively

Never patch piecemeal. Audit ALL related state/counters/UI before fixing user-reported symptom. Pre-flight grep for related keys saves round-trips.

### Always log user comments

Every request → memory or task tracker, even if deferred.

### Always update standardization

After any CSS/JS pattern fix or new UI lesson, update `standarization/` docs.

---

## Project memory

Persistent memory at `~/.claude/projects/-home-baguspermana7/memory/`.

Key entries that affect this project:
- `project_rz_versioning.md` — versioning regime + Plan v12-v15 patterns
- `feedback_script_tag_in_js_string.md` — never embed unescaped `</script>` in JS strings
- `feedback_dont_break_approved.md` — minimal surgical changes
- `feedback_verify_before_claim.md` — screenshot-confirmed before reporting fixed
- `feedback_think_comprehensive.md` — pre-flight grep, audit related state
- `feedback_dispatch_sonnet_for_execution.md` — Opus plans, sonnet executes
- `feedback_user_reference_assets.md` — use exact reference assets user supplies
