# Responsive Design Standard

> Established 2026-05-09 (Plan v15 ship, commit batch v1.8.0+).
> Mandate: every public HTML page MUST score ≥ 7/10 on
> `tools/audit-mobile-responsive.py`.

---

## Required breakpoints

```
<= 480 px  — small phones (vertical only)
<= 768 px  — phones (most mobile devices)
<= 1024 px — tablets
>  1024 px — desktop (default base styles)
```

Use `@media (max-width: 768px)` as the primary mobile breakpoint.
Add `@media (max-width: 480px)` for phone-specific tightening only when needed.

---

## Required CSS rules per page (8 checkpoints)

### 1. Viewport meta tag (REQUIRED)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 2. Mobile breakpoint defined

```css
@media (max-width: 768px) {
    /* mobile rules */
}
```

### 3. Body horizontal-overflow guard

```css
@media (max-width: 768px) {
    html, body { overflow-x: hidden; max-width: 100vw; }
}
```

Prevents the dreaded "horizontal scroll on mobile" caused by overflowing
elements (long text, oversized images, fixed-width components).

### 4. Image responsive default

```css
@media (max-width: 768px) {
    img { max-width: 100%; height: auto; display: block; }
}
```

### 5. Navbar mobile collapse

```css
@media (max-width: 768px) {
    .nav-menu, .nav-links { display: none; }
}
```

(Future: replace with hamburger toggle. Current pattern collapses for
simplicity — auth widget + theme toggle remain visible.)

### 6. Footer 3-column → single-column collapse

```css
@media (max-width: 768px) {
    .footer-grid {
        grid-template-columns: 1fr !important;
        gap: 1.25rem !important;
        padding: 1rem !important;
    }
}
```

### 7. v1.8.0 patch marker (idempotency)

Each page's mobile patch MUST start with a unique marker comment:

```css
/* v1.8.0 — mobile responsive patch */
```

Marker variants by page category:
- `mobile responsive patch` — calc pages
- `mobile responsive landing patch` — landing/hub pages
- `mobile article responsive patch` — article pages
- `mobile sim/lab responsive patch` — virtual labs + sims
- `mobile utility responsive patch` — utility/tool pages

### 8. Tap target minimum (Apple HIG / Material Design)

```css
@media (max-width: 768px) {
    button, a.btn, [role="button"] { min-height: 44px; }
}
```

44×44 px minimum hit area for any interactive element.

---

## Common collapse patterns

### Bento grid stacks

```css
@media (max-width: 768px) {
    .bento-container, .bento-row { grid-template-columns: 1fr !important; }
}
```

### KPI cards 2-col on phone, 1-col on small phone

```css
@media (max-width: 768px) {
    .kpi-grid { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 480px) {
    .kpi-grid { grid-template-columns: 1fr !important; }
}
```

### Tables become horizontal-scroll

```css
@media (max-width: 768px) {
    table {
        display: block !important;
        overflow-x: auto !important;
        white-space: nowrap;
    }
}
```

### Code blocks horizontal-scroll

```css
@media (max-width: 768px) {
    pre { overflow-x: auto !important; max-width: 100%; }
}
```

### Side panels become bottom-sheets / inline

```css
@media (max-width: 768px) {
    .side-panel, .lab-sidebar {
        position: relative !important;
        width: 100% !important;
        margin: 1rem 0 !important;
    }
}
```

### Floating share-buttons → bottom bar

```css
@media (max-width: 768px) {
    .share-buttons {
        position: fixed !important;
        bottom: 0 !important; top: auto !important; left: 0 !important; right: 0 !important;
        transform: none !important;
        flex-direction: row !important;
        justify-content: center !important;
        background: rgba(15,23,42,0.92) !important;
        backdrop-filter: blur(10px);
    }
}
```

---

## Article reading column (wide-screen) + responsive tables (v1.49.8)

**Problem this fixes:** articles relied on per-page inline styles for layout width, and most never set
one — so on a wide screen (e.g. a browser zoomed out to a ~2400px effective viewport) `.article-body` kept
growing with the viewport, the 68ch paragraph cap held text **left-aligned** instead of centered, and tables
filled the **full body width** — text stuck left, table wider than the prose, huge empty right margin
("sangat tidak responsive, tidak lurus dan berantakan"). There was no site-wide reading-width rule on
`.article-content` / `.article-body` outside `@media print`.

**The rule (lives in `styles.css`, so every non-index page inherits it):**

```css
/* Cap + center the body. Generous enough that embedded widgets (calculators,
   grids, charts) keep their width — they are NOT direct prose children. */
.article-body {
    max-width: 1180px;
    margin-inline: auto;
    padding-inline: clamp(16px, 4vw, 32px);
    box-sizing: border-box;
}
/* Reading measure: prose + tables share ONE centered ~760px column.
   DIRECT children only (`>`), so widget internals are never capped. */
.article-body > p,
.article-body > h2, .article-body > h3, .article-body > h4,
.article-body > ul, .article-body > ol, .article-body > dl,
.article-body > blockquote, .article-body > figure, .article-body > pre,
.article-body > .table-wrap, .article-body > table {
    max-width: 760px; margin-left: auto; margin-right: auto;
}
.article-body table { width: 100%; border-collapse: collapse; }
@media (max-width: 900px) {
    .article-body table, .article-body .table-wrap {
        display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
}
```

**Why `>` (direct child) matters — the widget-escape rule:** nearly every article embeds an interactive
widget (a calculator, a `*-strategy-grid`, a gantt, a chart) *inside* `.article-body`. Capping `.article-body`
itself, or using a descendant selector, would strangle those widgets. Capping only **direct prose children**
centers the text + tables into one column while leaving widget `<div>`s at full container width. Full-bleed
bands (hero, colored evidence strips) live **outside** `.article-body` and are intentionally viewport-wide —
do not cap them.

**The `overflow-x: hidden` scroll-promotion trap:** `html, body { overflow-x: hidden }` *without* also pinning
`overflow-y` lets the browser promote `overflow-x` back to `auto`, so a too-wide child still scrolls the page.
If a page genuinely has a wide fixed/absolute element (e.g. an instrument cockpit toolbar), use
`overflow-x: clip` on the guard and constrain the offending element to `100vw` with its own
`overflow-x: auto`. (See `EPMS_Telemetry.html`.)

> The legacy "Tables become horizontal-scroll" snippet above (`white-space:nowrap` on every `table`) is the
> blunt fallback for non-article pages. Inside `.article-body`, prefer the reading-column rule — it both caps
> the table to the prose width on desktop and scrolls it on mobile, without `nowrap` (which forces tall rows).

---

## Audit gate

Run before every push:

```bash
python3 tools/audit-mobile-responsive.py --strict   # 8-checkpoint static scorer (≥7/10)
node   tools/audit-responsive-layout.mjs --strict   # render gate: real horizontal-scroll + wide article tables
```

`audit-mobile-responsive.py` scores each page 0-10 on the 8 static checkpoints above; `--strict` fails CI if
any indexable page scores < 7. `audit-responsive-layout.mjs` renders every content page at 390 / 768 / 2400px
and fails on **actual** user-facing horizontal scroll (measured via real `scrollX`, not the `scrollWidth`
artifact that `overflow-x:hidden` leaves behind) or an article prose table wider than the reading column.
Noindex / print-variant pages are skipped.

---

## Pre-merge checklist for new pages

- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0">` in `<head>`
- [ ] At least one `@media (max-width: 768px)` rule
- [ ] `body { overflow-x: hidden; max-width: 100vw; }` in mobile rule
- [ ] `img { max-width: 100%; height: auto; }` in mobile rule
- [ ] Navbar mobile collapse (`.nav-menu, .nav-links { display: none; }`)
- [ ] Footer grid mobile collapse (`grid-template-columns: 1fr`)
- [ ] v1.8.0+ patch marker comment
- [ ] Tap-target minimum (`min-height: 44px` on buttons/links)
- [ ] Tested in Chrome DevTools Device Toolbar at 375×667 (iPhone SE)
- [ ] Tested in Chrome DevTools Device Toolbar at 414×896 (iPhone 11 Pro Max)
- [ ] No horizontal scroll at any tested breakpoint
- [ ] All interactive elements still tappable

---

## Out of scope (intentionally not enforced)

- Tablet-specific breakpoints (769-1024 px) — current strategy treats tablet as desktop.
- Foldable / dual-screen breakpoints — no UA pattern adopted yet.
- Print styles — separate `@media print` rules per page where needed.
- High-DPI image variants (`srcset`) — handled via WebP at base resolution.

---

## CRITICAL LESSON — never let a patch tool splice CSS by tag-matching (v1.19.0, 2026-05-17)

The v1.5.0 / v1.8.x mobile + typography patch tools located their injection
point by **string-matching `</style>` / `</head>` / `</body>`** in the raw
HTML. On ~33 pages those tags also appear *inside a JS string literal* in a
PDF/print builder (`html += '<style>…</style></head><body>'`). The tools
spliced their multi-line CSS there, clobbering the string terminator →
`SyntaxError: Invalid or unexpected token` → the **entire `<script>` died**
(calculator engine, free/pro, login, Export PDF, menus). It went undetected
because `audit-script-tags.py` only finds `</script>` in strings, and
`audit-mobile-responsive.py` *counted the dead in-string CSS as a pass*.

**Rules going forward**

1. A CSS/HTML patch tool MUST insert into a real `<head><style>` (or linked
   stylesheet), located by DOM/structure — never by a bare tag string match
   that can land inside a JS string literal.
2. The canonical mobile block ships via **`tools/inject-mobile-responsive.py`**
   as one idempotent `<style id="rz-mobile-v18">` before the document's first
   (structural) `</head>`. Re-run it (idempotent) instead of hand-editing.
3. **`tools/audit-js-syntax.py --strict`** is now a mandatory pre-push gate
   (it `node --check`s every executable inline `<script>`). A green
   `audit-mobile-responsive` is meaningless if `audit-js-syntax` is red.
4. Every restored line in a regression repair must come **verbatim from git
   history** (`tools/fix-css-in-js-injection.py`), never a heuristic guess;
   skip + flag for manual review rather than half-fix.

---

## References

- Apple Human Interface Guidelines (44pt tap target)
- Material Design 3 (touch target 48dp)
- web.dev / Mobile UX (PageSpeed Insights mobile audit criteria)
- WCAG 2.1 SC 2.5.5 Target Size (Level AAA: 44×44 px)
