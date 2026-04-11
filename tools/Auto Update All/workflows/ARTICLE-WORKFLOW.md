# ARTICLE-WORKFLOW.md
# Complete 18-Step Article Build Pipeline
# Use this for ALL article types: Engineering Journal, Future Forward, Global Analysis

---

## PRE-FLIGHT (Before Writing Anything)

### Step 1: Research & Gap Analysis
```
Goal: Find an angle NO other site covers
Method:
  1. Search 5+ existing articles on the topic
  2. List what they all say (the consensus narrative)
  3. Ask: "What does an insider engineer know that isn't published anywhere?"
  4. Unique angle test: If the angle exists on another site → PIVOT

Winning angles look like:
  - "Everyone says X → but actually Y because [engineer insider knowledge]"
  - "The industry assumes A → the data shows B"
  - "This is presented as Z → but operationally it creates W"
```

### Step 2: Series Selection
```
Engineering Journal (cyan #06b6d4): Technical how-it-works, procedures, methodologies
Future Forward (violet #a855f7): Future trends, predictions, paradigm shifts
Global Analysis (red #ef4444): Market, geopolitics, industry dynamics, investigations
```

### Step 3: AEO/GEO Planning
```
Plan 5+ FAQ Q&As that AI engines will extract (FAQPage schema)
Plan question-format H2 headings ("Why Does X", "How Does Y", "What Is Z")
Plan 3+ entity citations (industry reports, standards, organizations)
```

### Step 4: Read ARTICLE_CREATION_PROMPT.md
Path: `standarization/article prompt/ARTICLE_CREATION_PROMPT.md`
This contains the full HTML template and all required elements.

---

## BUILD PHASE

### Step 5: Determine Article Number
```bash
# Check latest article number
ls /home/baguspermana7/rz-work/article-*.html | sort -V | tail -1
# Next article = latest + 1
```

### Step 6: Part A — HEAD + Meta + Hero + TOC + Sections 0-3
Required in `<head>`:
- [ ] `<title>` — 50-60 chars, keyword-first
- [ ] `<meta name="description">` — 150-160 chars, includes primary keyword
- [ ] `<link rel="canonical">`
- [ ] Open Graph (og:title, og:description, og:image, og:url)
- [ ] Twitter Card meta
- [ ] Article schema (schema.org/Article)
- [ ] BreadcrumbList schema
- [ ] FAQPage schema (5+ Q&As)
- [ ] Preload hero image
- [ ] styles.min.css link
- [ ] Font Awesome link

Required after `<body>`:
- [ ] FOUC prevention inline script: `<script>(function(){var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);})();</script>`
- [ ] Navbar (`.nav-menu` pattern, NOT `.nav-links`)
- [ ] Hero section with `<img ... onerror="this.style.display='none'">`
- [ ] Article header (series badge, title, subtitle, metadata)
- [ ] TOC (table of contents, 7 sections)
- [ ] Section 0: Lead / hook paragraph
- [ ] Section 1-3: Core content

### Step 7: Part B — Sections 4-7 + Calculator + Footer
- [ ] Sections 4-7: Supporting content, data, recommendations
- [ ] Calculator HTML (if embedded) — inputs, outputs, KPI cards
- [ ] Author bio block (INSIDE `<article>` tag)
- [ ] Related articles (INSIDE `<article>` tag)
- [ ] Share buttons (OUTSIDE `<article>`, before footer)
- [ ] Footer

### Step 8: Part C — Calculator IIFE JavaScript
```javascript
// Pattern: Place AFTER all HTML, before </body>
<script>
(function() {
  'use strict';
  // All calculator logic here
  // NO global variables
  // Expose only what's needed for onclick handlers
})();
</script>
<script src="script.min.js"></script>
<script src="auth.min.js"></script>
```

---

## POST-BUILD PHASE

### Step 9: Hero Image
```bash
# Check if hero exists
ls /home/baguspermana7/rz-work/assets/article-N-hero.webp

# If not, process from source:
python3 -c "
from PIL import Image
img = Image.open('SOURCE_PATH')
img.thumbnail((1200, 630))
img.save('assets/article-N-hero.webp', 'WEBP', quality=80)
print('Done:', img.size)
"
```
- Format: WebP, quality=80, max 1200px wide
- No figcaption if generic/decorative image

### Step 10: Update articles.html
```
- Add new article card at TOP of grid (not bottom)
- Set badge to "NEW" (will be renumbered next article)
- Update previous "NEW" badge to article number
- Update ticker (top banner): add new article entry, remove oldest if >5
- Update prefetch links in <head> to article-N/N-1/N-2
```

### Step 11: Update Previous Article Series Nav
```html
<!-- In article-N-1.html, find the "Next" series nav link and change from: -->
<a href="#" style="opacity:0.4;pointer-events:none;" class="series-nav-link series-nav-next">
<!-- to: -->
<a href="article-N.html" class="series-nav-link series-nav-next">
```

### Step 12: Update sitemap.xml
```xml
<url>
  <loc>https://resistancezero.com/article-N.html</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```
Add BEFORE the closing `</urlset>` tag.

### Step 13: Update search-index.json
```json
{
  "id": NEXT_ID,
  "title": "Article Title",
  "url": "article-N.html",
  "type": "article",
  "series": "Engineering Journal|Future Forward|Global Analysis",
  "keywords": ["keyword1", "keyword2", "keyword3", "..."],
  "description": "150-char description",
  "date": "YYYY-MM-DD"
}
```
Add as last entry in the JSON array (before `]`).

### Step 14: Create Post Drafts
Create folder: `Article/Post Draft/Article N/`

Files (11 total):
```
A{N}-x-post-1.md    (280 chars max, hook/insight)
A{N}-x-post-2.md    (280 chars max, stat/data point)
A{N}-x-post-3.md    (280 chars max, question/engagement)
A{N}-mastodon-1.md  (500 chars max, longer version of X post 1)
A{N}-mastodon-2.md  (500 chars max)
A{N}-mastodon-3.md  (500 chars max)
A{N}-linkedin.md    (3000 chars max, professional angle, no hashtags in body)
A{N}-medium.md      (Full article-style, no bold markdown, SEO title ≤74 chars)
A{N}-quora.md       (Answer format, cite article as source)
A{N}-facebook.md    (2000 chars max, conversational, no hashtags, ends with question)
A{N}-tiktok-script.md (60-90 second script, hook+problem+insight+CTA)
```

### Step 15: Build Verification
```bash
# Start server if not running
cd /home/baguspermana7/rz-work && python3 -m http.server 8081 &

# Check article loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/article-N.html

# Verify title
curl -s http://localhost:8081/article-N.html | grep -o '<title>[^<]*</title>'

# Check hero image
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/assets/article-N-hero.webp

# Count key elements
curl -s http://localhost:8081/article-N.html | grep -c 'pfas-section\|section-'
```

### Step 16: Minification (if styles.css or script.js changed)
```bash
cd /home/baguspermana7/rz-work
cleancss styles.css -o styles.min.css
terser script.js -o script.min.js --compress --mangle
# If index page CSS was changed:
cleancss styles-index.css -o styles-index.min.css
```

### Step 17: Git Commit and Push
```bash
cd /home/baguspermana7/rz-work
git add article-N.html articles.html article-N-1.html sitemap.xml search-index.json
git add "Article/Post Draft/Article N/"
git add assets/article-N-hero.webp  # if new
git commit -m "feat: publish article-N — [short title]"
git push
```

### Step 18: Save Session
Run `/save-session` to capture the full session context.

---

## QUICK CHECKLIST

```
PRE-FLIGHT:
[ ] Unique angle confirmed — not aggregating other sites
[ ] Series selected
[ ] AEO/GEO elements planned
[ ] ARTICLE_CREATION_PROMPT.md read

BUILD:
[ ] Article number confirmed (N)
[ ] Part A: HEAD + hero + TOC + sec 0-3
[ ] Part B: sec 4-7 + calc HTML + author bio + related + share + footer
[ ] Part C: calculator IIFE JS (after HTML, before </body>)

POST-BUILD:
[ ] Hero image exists at assets/article-N-hero.webp (WebP, ≤1200px, quality=80)
[ ] articles.html updated (new card at top, ticker updated, prefetch updated)
[ ] article-N-1.html series nav Next link updated
[ ] sitemap.xml updated
[ ] search-index.json updated
[ ] Post drafts created (11 files at Article/Post Draft/Article N/)
[ ] curl returns 200 for article and hero
[ ] .min files rebuilt (if CSS/JS changed)
[ ] git commit + push
[ ] /save-session run
```
