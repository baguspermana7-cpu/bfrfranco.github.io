# AGENT-GUIDE.md
# ResistanceZero — Complete Agent Onboarding Guide
# Any agent reading this file has full site context. No memory files needed.
# Last updated: 2026-04-11

---

## 1. WHAT THIS SITE IS

**resistancezero.com** — A data center engineering portfolio and technical authority site built by Bagus Permana, a senior data center engineer based in Indonesia. The site publishes original articles, calculators, tools, and comparison pages for the DC industry.

**Primary goals:**
- Establish authority as a DC engineering thought leader
- Attract premium professional visitors (engineers, investors, operators)
- Generate leads for consulting and DCMOC product
- Rank highly in AI search engines (ChatGPT, Perplexity, Gemini) via AEO/GEO

---

## 2. SITE ARCHITECTURE

### Root: `/home/baguspermana7/rz-work/`

### Page Types

| Type | Count | Examples |
|------|-------|---------|
| Articles (Engineering Journal) | 26 | article-1.html → article-26.html |
| Articles (Future Forward) | 3 | FF-1.html, FF-2.html, FF-3.html |
| Articles (Geopolitics) | 3 | geopolitics-1/2/3.html |
| Hub Pages | 4 | articles.html, future-forward.html, geopolitics.html, insights.html |
| Calculators (standalone) | 6 | pue/capex/opex/roi/tco/cx-calculator.html |
| Comparison Pages | 10 | compare-*.html |
| System Pages | 5 | chiller-plant, fire-system, fuel-system, water-system, ict.html |
| Pillar Pages | 5 | pillar-cooling/fire-safety/power/standards/sustainability.html |
| Learning/LTC Pages | 7 | ltc-*.html, standards-ltc-lab.html, tia-942-checklist.html |
| DC Market City Pages | 12 | dc-market/index + 11 cities |
| Infographic Pages | 3 | infographic-dc-*.html |
| Sub-Apps | 5 | dcmoc/, embed/, id/, Apps/ (finance-terminal, etc.) |
| Utility/System | 8 | index, dashboard, glossary, 404, privacy, terms, achievements, rz-ops |

### Key Files

```
styles.css              ← SOURCE of truth (~5950 lines), DO NOT edit min files directly
styles.min.css          ← minified from styles.css (cleancss)
styles-index.css        ← index-only optimized CSS (PageSpeed split)
styles-index.min.css    ← minified index CSS
script.js               ← SOURCE of truth, DO NOT edit .min directly
script.min.js           ← minified (terser)
auth.js                 ← auth logic (Supabase + Firebase)
auth.min.js             ← minified auth
search-index.json       ← search entries (82+ entries, id starts at 1)
sitemap.xml             ← all public URLs for SEO
robots.txt              ← crawler rules
manifest.json           ← PWA manifest
sw.js                   ← service worker
standarization/         ← ALL standards documents (12 core files)
```

---

## 3. ARTICLE SERIES

### Engineering Journal (cyan #06b6d4)
- CSS prefix: varies per article (e.g., `pfas-`, `tgs-`, `iec-`)
- Section IDs: `section-1` through `section-7` (most articles), some use `sec1` or `section1`
- Color accent: cyan #06b6d4
- Badge: "Engineering Journal"
- Article range: article-1.html → article-26.html
- article-9-paper.html is a companion PDF article

### Future Forward (violet #a855f7)
- CSS prefix: `-ff` (landing page), varies per article
- Section IDs: `sec0` → `sec7`
- Color accent: violet #a855f7
- Files: FF-1.html, FF-2.html, FF-3.html (also future-forward-1.html for FF-1 redirect)
- Landing: future-forward.html

### Global Analysis (red #ef4444)
- CSS prefix: varies per article
- Color accent: red #ef4444
- Articles embedded in article-N.html (e.g. article-26 is Global Analysis)

### Geopolitics (separate series)
- Files: geopolitics.html (hub), geopolitics-1/2/3.html
- Colors: geopolitics-1 = blue, geopolitics-2 = orange-red, geopolitics-3 = amber

---

## 4. ARTICLE CREATION WORKFLOW (18 Steps — MUST FOLLOW IN ORDER)

**Before writing a single line of HTML:**
1. Research — gap analysis vs existing coverage, find UNIQUE angle
2. Unique angle test — "Is this perspective on ANY other major site?" If yes, pivot
3. AEO/GEO check — entity-first headings, question H2s, FAQ schema planned
4. Read ARTICLE_CREATION_PROMPT.md at `standarization/article prompt/ARTICLE_CREATION_PROMPT.md`
5. Confirm series (Engineering Journal / Future Forward / Global Analysis)

**Build sequence:**
6. Part A — `<head>` + meta + schema + hero + TOC + sections 0-3
7. Part B — sections 4-7 + embedded calculator HTML + author-bio + related + share buttons + footer
8. Part C — calculator IIFE JavaScript (placed AFTER HTML, before `</body>`)

**Post-build:**
9. Verify hero image exists at `assets/[article-slug]-hero.webp`
10. Update `articles.html` — add card at top of grid, update ticker, update prefetch
11. Update previous article — add `href="article-N.html"` to the "Next" series nav link
12. Update `sitemap.xml` — add new `<url>` entry with today's date
13. Update `search-index.json` — add new entry (next available id)
14. Create post drafts at `Article/Post Draft/Article N/` (11 files: X×3, Mastodon×3, LinkedIn, Medium, Quora, Facebook, TikTok)
15. Build check — curl localhost:8081/article-N.html returns 200, title correct
16. Minification check — if styles.css or script.js changed, rebuild .min files
17. Git commit and push
18. Save session file with `/save-session`

**Post-draft char limits:**
- X (Twitter): 280 chars max
- Mastodon: 500 chars max
- LinkedIn: 3000 chars max
- Facebook: 2000 chars, conversational, no hashtags, ends with question
- Medium: No bold markdown, SEO title ≤74 chars, humanize before publish
- Quora: Answer format, cite article
- TikTok: Script format, 60-90 seconds

---

## 5. CALCULATOR CREATION WORKFLOW

**CRITICAL rules:**
- Calculator HTML goes INSIDE article (embedded) OR as standalone `[topic]-calculator.html`
- IIFE JS pattern: `(function() { /* all calculator logic */ })();`
- Scripts ALWAYS go AFTER the calculator HTML divs — NEVER inside PDF string literals
- Dark mode: All standalone calculators must have `.nav-theme-btn` toggle (default: dark)
- Default dark: `localStorage.getItem('theme') || 'dark'`
- FOUC prevention: Inline script at top of `<body>`: `<script>(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();</script>`
- Navbar pattern for calculators: `.nav-links` (NOT `.nav-menu`)
- Add to sitemap.xml and search-index.json after creating
- Add disclaimer section (required on all calc pages)

**5 standalone calcs with dark mode toggle (PUE, CAPEX, OPEX, ROI, TCO):**
- Button: `<button class="nav-theme-btn" id="navThemeBtn" onclick="toggleCalcTheme()" title="Toggle dark mode"><i id="themeIcon" class="fas fa-moon"></i></button>`
- Each uses its own accent color for `.nav-theme-btn:hover`

---

## 6. NAVBAR PATTERNS

**Content pages (articles, landing pages):** `.nav-menu` class
```html
<nav class="navbar" id="navbar">
  <div class="nav-container">
    <a href="index.html" class="nav-logo">...</a>
    <ul class="nav-menu" id="navMenu">
      <li><a href="index.html" class="nav-link">Home</a></li>
      <!-- Insights dropdown with 3 items -->
      <li class="nav-dropdown">...</li>
      <li><a href="dashboard.html" class="nav-link">Dashboard</a></li>
      <li><a href="glossary.html" class="nav-link">Glossary</a></li>
    </ul>
    <!-- auth buttons, search, hamburger -->
  </div>
</nav>
```

**Calculator pages:** `.nav-links` class (custom, simpler navbar — 25+ tool pages)

**Insights dropdown — 3 items (updated 2026-03-22):**
1. Engineering Journal → articles.html (cyan #06b6d4)
2. Global Analysis → articles.html#global-analysis (red #ef4444)
3. Future Forward → future-forward.html (violet #a855f7)

---

## 7. CSS / JS MODIFICATION RULES

**NEVER edit .min files directly. Always:**
1. Edit `styles.css` (source)
2. Run: `cleancss styles.css -o styles.min.css`
3. If index.html changed: regenerate `styles-index.css` from styles.css (Python script or manual)
4. Run: `cleancss styles-index.css -o styles-index.min.css`

**NEVER edit script.min.js directly. Always:**
1. Edit `script.js`
2. Run: `terser script.js -o script.min.js --compress --mangle`

**Dark mode pattern:**
- Root attribute: `document.documentElement.setAttribute('data-theme', 'dark'|'light')`
- CSS selectors: `[data-theme="dark"] .element { ... }`
- Key: `localStorage.key = 'theme'`, value = `'dark'` or `'light'`

**Motion effects: ALL DISABLED** (committed 2026-03-16)
- `initCardTilt()`, `initCardEffects()`, `initButtonEffects()`, `initCursorEffects()`, `initCursorSpotlight()` all have early `return` in script.js
- Do NOT re-enable these without user approval

---

## 8. SEO / AEO / GEO STANDARDS

**For AI engine crawlability (ChatGPT, Perplexity, Bing, Gemini):**
1. FAQPage schema with 5+ Q&As that directly answer search queries
2. Question-based H2 headings (`Why Does`, `How Does`, `What Is`)
3. Entity-first structure (define the core concept in section 0)
4. Inline source attribution with `<cite>` tags
5. Specific stats with uncertainty ranges (not vague "studies show")
6. `<time datetime="YYYY-MM-DD">` on all dates
7. BreadcrumbList schema on all content pages

**Sitemap maintenance:**
- File: `sitemap.xml`
- Add every new public page
- Format: `<url><loc>https://resistancezero.com/PAGE</loc><lastmod>YYYY-MM-DD</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`

**search-index.json maintenance:**
- Add every searchable page
- Format: `{"id": N, "title": "...", "url": "page.html", "type": "article|calculator|tool|comparison", "keywords": ["kw1", "kw2"], "description": "..."}`
- Current max id: 82 (as of 2026-04-11)

---

## 9. HERO IMAGE STANDARD

- Format: WebP, quality=80
- Max width: 1200px
- Path: `assets/[article-slug]-hero.webp`
- Processing: `python3 -c "from PIL import Image; img=Image.open('SOURCE'); img.thumbnail((1200,630)); img.save('assets/NAME-hero.webp', 'WEBP', quality=80); print('Done:', img.size)"`
- No figcaption if image is generic/decorative
- `onerror` hides broken img: `<img ... onerror="this.style.display='none'">`

---

## 10. SERVER & ENVIRONMENT

```bash
# HTTP server (ALWAYS start from rz-work root)
cd /home/baguspermana7/rz-work && python3 -m http.server 8081

# PORT CONFLICTS — DO NOT USE:
# 8080 = NemoClaw (Docker container, always running)
# 8082 = Affiliate app

# Minification tools (Node.js v24.13.1 via nvm)
terser script.js -o script.min.js --compress --mangle
cleancss styles.css -o styles.min.css
cleancss styles-index.css -o styles-index.min.css

# Image processing (Python Pillow)
python3 -c "from PIL import Image; ..."

# Git workflow
git add [files] && git commit -m "type: description" && git push
# Commit types: feat, fix, refactor, docs, test, chore, perf
```

---

## 11. WHAT NOT TO DO

- **NEVER** use port 8080 for rz-work server (NemoClaw conflict)
- **NEVER** edit `.min.css` or `.min.js` files directly
- **NEVER** put calculator JS inside PDF string literals
- **NEVER** add motion effects (tilt, cursor spotlight, card effects) — all disabled
- **NEVER** use `prompt()` or `alert()` for auth — use AUTH_STANDARD.md
- **NEVER** use custom SVG bubble maps — use Leaflet.js (CARTO dark)
- **NEVER** put post drafts in `Article/Global Analysis/` — always `Article/Post Draft/Article N/`
- **NEVER** commit without checking that hero image exists for new articles
- **NEVER** write an article angle that's just aggregating other sites' content

---

## 12. STANDARDS DOCUMENTS QUICK INDEX

All located at `standarization/`:

| File | Covers |
|------|--------|
| AUTH_STANDARD.md | Login modal, Supabase auth, no prompt/alert |
| CALCULATOR_PROMPT_STANDARD.md | Calculator UI, IIFE pattern, disclaimers |
| CONTENT_TAXONOMY_STANDARD.md | Article categories, tagging, series rules |
| DATAHALL_AI_STANDARD.md | DataHall AI page standards |
| EMAIL_DOMAIN_CONFIG.md | Email setup, DNS records |
| LEGAL_COMPLIANCE_STANDARD.md | Privacy, GDPR, cookie consent |
| PDF_EXPORT_STANDARD.md | PDF export using inline SVG, window.open() |
| PRO_MODE_STANDARDIZATION.md | Pro mode UI, separate buttons (not toggle) |
| SEO_OPTIMIZATION_STANDARD.md | SEO rules, meta tags, schema |
| TOOLTIP_STANDARD.md | Tooltip pattern, CSS variables |
| UI_FEATURES_STANDARD.md | Cookie banner, search modal, navbar scroll |
| article prompt/ARTICLE_CREATION_PROMPT.md | Full article creation prompt v1.2 |

---

## 13. MAINTENANCE PRIORITIES

Run health checks in this order:
1. **Security** — XSS, hardcoded secrets, CSP headers
2. **SEO** — broken links, missing meta, sitemap sync
3. **Data validity** — calculator stats match latest industry reports
4. **UI/UX** — dark mode, responsive, WCAG contrast
5. **Performance** — image sizes, JS bundle, Lighthouse score

**Health check scripts** (see `engine/` directory):
- `python3 engine/health-check.py` — runs all checks, generates report
- `python3 engine/validate-links.py` — checks for 404s
- `python3 engine/validate-seo.py` — meta tags, schema, sitemap sync
- `python3 engine/validate-consistency.py` — navbar, footer, theme consistency
- `python3 engine/validate-stats.py` — flags statistics older than 12 months
- `python3 engine/validate-security.py` — checks for XSS vectors, hardcoded keys

---

## 14. DCMOC APP (Separate from main site)

- Location: `dcmoc/` (Next.js 16, React 19, TypeScript, Tailwind, Zustand)
- NEVER use `antigravity/` folder in dcmoc
- Static export, NOT standard Next.js server
- Treat as SEPARATE project — don't mix dcmoc styles with rz-work styles

---

## 15. ARTICLE NUMBERING & NEXT ARTICLE RULES

Current state (as of 2026-04-11):
- Latest article: article-26.html (PFAS, Global Analysis, Apr 2026)
- Next article: article-27.html
- Candidate topics (from idea list): Tax Break Reckoning, FF-4 "Data Centers Abandoning the Grid"

When writing article-27:
- Update article-26.html series nav Next link
- Update articles.html card grid (new card at top)
- Update sitemap.xml, search-index.json
- Start post drafts at `Article/Post Draft/Article 27/`
