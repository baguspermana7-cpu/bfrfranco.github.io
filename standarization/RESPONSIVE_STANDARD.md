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

## Audit gate

Run before every push:

```bash
python3 tools/audit-mobile-responsive.py --strict
```

The audit scores each page 0-10 based on the 8 checkpoints above. `--strict`
mode fails CI if any indexable page scores < 7. Noindex pages are
correctly skipped.

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

## References

- Apple Human Interface Guidelines (44pt tap target)
- Material Design 3 (touch target 48dp)
- web.dev / Mobile UX (PageSpeed Insights mobile audit criteria)
- WCAG 2.1 SC 2.5.5 Target Size (Level AAA: 44×44 px)
