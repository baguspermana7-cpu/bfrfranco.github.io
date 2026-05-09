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
python3 tools/audit-version-stamp.py --strict      # version stamp on all pages
python3 tools/audit-mobile-responsive.py --strict  # responsive checkpoints
python3 tools/audit-seo.py                         # SEO meta + JSON-LD
```

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
| `tools/audit-seo.py` | per-page SEO meta health — non-strict |
| `tools/build-sitemap.py` | regen sitemap.xml from filesystem |
| `tools/build-llms-txt.py` | regen llms.txt |
| `tools/build-llms-full.py` | regen llms-full.txt (concatenated Markdown) |
| `tools/build-og-images.py` | generate per-page OG cards |
| `tools/build-changelog-html.py` | regen public /changelog.html from CHANGELOG.md |
| `tools/insert-version-script.py` | walk pages and inject `<script src="js/rz-version.js">` |
| `tools/indexnow-submit.py` | POST changed URLs to Bing/Yandex IndexNow |
| `tools/inject-schema-faq-howto.py` | add FAQ/HowTo JSON-LD to calc/tool pages |

---

## Standardisation docs

Reference these BEFORE adding new patterns. Update them WHEN shipping a new pattern.

- `standarization/VERSIONING_STANDARD.md` — semver scheme + bump checklist
- `standarization/RESPONSIVE_STANDARD.md` — mobile breakpoints + 8 checkpoints
- `standarization/UI_FEATURES_STANDARD.md` — share-buttons, scroll cue, navbar, hero, bento, version stamp, dark-mode coverage
- `standarization/SEO_OPTIMIZATION_STANDARD.md` — meta, canonical, OG, JSON-LD, AI search optimisation
- `standarization/AUTH_STANDARD.md` — login modal, auth widget injection
- `standarization/PDF_EXPORT_STANDARD.md` — PDF print-window templates + `<\/script>` escape rule

---

## Process discipline

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
