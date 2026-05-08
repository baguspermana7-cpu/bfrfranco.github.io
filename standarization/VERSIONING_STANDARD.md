# VERSIONING_STANDARD.md

Version scheme, bump checklist, and stamp mechanics for resistancezero.com.
Introduced in Plan v12 Phase K — 2026-05-09.

---

## Semver Scheme

This site follows [Semantic Versioning 2.0.0](https://semver.org/) with a fixed
interpretation for a content-heavy portfolio/tool site:

| Component | Format | When to bump |
|-----------|--------|--------------|
| **PATCH** | `1.0.x` | Bug fixes, copy edits, single-file styling fixes, broken-link repairs, accessibility tweaks that don't change layout. |
| **MINOR** | `1.x.0` | New pages, new components, new calculators, new articles, plan-shipping commits that add visible UI. |
| **MAJOR** | `x.0.0` | Breaking layout or information-architecture changes: sitewide navbar redesigns, URL structure changes, removing large feature sections, migrating from one hosting platform to another. |

### Concrete examples for this codebase

| Change | Version bump |
|--------|-------------|
| Fix a typo in `article-5.html` | PATCH (`1.0.1`) |
| Fix broken chart in `pue-calculator.html` | PATCH |
| Add `article-27.html` (Tax Break Reckoning) | MINOR (`1.1.0`) |
| Ship a new calculator (e.g. WUE calculator) | MINOR |
| Ship Plan v12 landing redesign (this plan) | MINOR (`1.1.0`) |
| Restructure nav so Calculators become a dedicated `/calc/` sub-path | MAJOR (`2.0.0`) |
| Migrate from GitHub Pages to a different hosting provider | MAJOR |

---

## Bump Checklist

When bumping the version for any release:

1. **Edit `js/rz-version.js`**
   ```js
   window.RZ_VERSION      = '1.1.0';        // new version string
   window.RZ_VERSION_DATE = '2026-05-09';   // ISO date of this release
   window.RZ_VERSION_CODENAME = 'Pixel Rise'; // optional human name
   ```

2. **Append an entry to `CHANGELOG.md`** at the repo root:
   ```markdown
   ## v1.1.0 — 2026-05-09 (Plan v12 ship)
   - Added: floating share column on index.html
   - Added: video modal for Get Started CTA
   - Added: js/rz-version.js version stamp system
   ```

3. **Update query-string cache-busting** on the `<script>` tag in every HTML
   file that loads `rz-version.js` — only needed if the version stamp ITSELF
   must be visually refreshed immediately (the stamp text is dynamic via JS, so
   this is rarely needed for version-only bumps):
   ```html
   <script src="js/rz-version.js?v=2026-05-09" defer></script>
   ```
   The helper tool `tools/insert-version-script.py --apply` handles bulk
   insertion; manually bump `?v=…` date only when changing the JS file itself.

4. **Rebuild minified assets** if `script.js` or `styles.css` were edited:
   ```bash
   terser script.js -o script.min.js --compress --mangle
   cleancss styles.css -o styles.min.css
   ```

5. **Commit** following the conventional-commits format:
   ```
   feat: ship Plan v12 landing redesign (v1.1.0 Pixel Rise)
   ```

---

## How the Stamp Works

### Loading

Every HTML page in the repo includes near the closing `</head>`:
```html
<script src="js/rz-version.js?v=2026-05-09" defer></script>
```

This sets three globals on `window`:
- `window.RZ_VERSION` — the semver string (e.g. `'1.0.0'`)
- `window.RZ_VERSION_DATE` — ISO date string
- `window.RZ_VERSION_CODENAME` — optional human release name

### Rendering

`script.js` contains a self-executing IIFE `injectVersionStamp()` that:
1. Checks for an existing `#rzVersionStamp` element (idempotent — only renders once).
2. Looks for `#rzVersionAnchor` in the DOM (a `<div>` placed inside the page's
   `<footer>`) or falls back to `document.body`.
3. Creates a `<div class="rz-version-stamp">` containing:
   - The 20×20 favicon brand mark (`assets/favicon-32.png`)
   - The label "Latest version"
   - The version in a `<code>` element: `v1.0.0`
4. Appends the stamp to the anchor.

The stamp is styled by `.rz-version-stamp` in `styles.css` — muted opacity
(0.55) at rest, full opacity on hover, monospace green code chip.

### Per-page anchor

To control where the stamp appears, add this anywhere in the page's `<footer>`
(or wherever you want it):
```html
<div id="rzVersionAnchor"></div>
```

If the anchor is absent, the stamp appends to `document.body` as a fallback.

---

## Audit Tool

`tools/audit-version-stamp.py` walks all HTML files and reports which pages
include `js/rz-version.js`. Run before releasing:

```bash
# Human-readable report
python3 tools/audit-version-stamp.py

# Exit 1 if any page is missing the stamp (for CI gates)
python3 tools/audit-version-stamp.py --strict
```

## Insertion Tool

`tools/insert-version-script.py` inserts the `<script>` tag into every HTML
file that is missing it:

```bash
# Dry run — shows what would change, writes nothing
python3 tools/insert-version-script.py --dry-run

# Apply changes
python3 tools/insert-version-script.py --apply
```
