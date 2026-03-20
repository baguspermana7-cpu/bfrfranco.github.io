# Article Creation Prompt Standard -- ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-03-20

---

## Quick-Start Prompt

Copy this prompt, fill in the `[PLACEHOLDERS]`, and hand to Claude:

```
Create article-[NN].html for ResistanceZero portfolio.

TOPIC: [TITLE]
SUBTITLE: [SUBTITLE]
DESCRIPTION: [META_DESCRIPTION — 160 chars max]
KEYWORDS: [COMMA_SEPARATED_SEO_KEYWORDS]
CATEGORY: [Engineering Analysis | Fact-Check | Infrastructure | Tutorial | etc.]
SERIES: [Engineering Journal | Global Analysis | Future Forward]
SERIES_NUMBER: [NN]
THEME_COLOR: [PRIMARY_HEX] ([COLOR_NAME], e.g., #059669 emerald)
DATE: [YYYY-MM-DD]
READING_TIME: [NN] min
WORD_COUNT: ~[NNNN]
PREVIOUS_ARTICLE: article-[NN-1].html

SECTIONS (H2 titles, id="section-N"):
1. [Section 1 Title]
2. [Section 2 Title]
3. [Section 3 Title]
...
N. [Section N Title]

EVIDENCE BLOCK (5 hero stats):
1. [VALUE] | [LABEL] | [SUB_TEXT]
2. [VALUE] | [LABEL] | [SUB_TEXT]
3. [VALUE] | [LABEL] | [SUB_TEXT]
4. [VALUE] | [LABEL] | [SUB_TEXT]
5. [VALUE] | [LABEL] | [SUB_TEXT]

FAQ (4+ questions for structured data):
Q1: [Question]?
A1: [Answer — 1-2 sentences]
Q2: ...

RELATED ARTICLES (3):
1. article-[X].html — [Title] — [Short description]
2. article-[Y].html — [Title] — [Short description]
3. article-[Z].html — [Title] — [Short description]

HAS_CALCULATOR: [yes/no]
  (If yes, specify: calculator name, inputs, outputs, formulas, Free/Pro)

SOCIAL MEDIA DRAFTS: [yes/no]
  (If yes: X 3 posts, Mastodon 3 posts, LinkedIn, Medium, Quora)

Follow the ARTICLE_CREATION_PROMPT.md standard at:
/home/baguspermana7/rz-work/standarization/article prompt/ARTICLE_CREATION_PROMPT.md
```

---

## 1. HTML Template Structure

Every article follows this exact structure. Elements marked `[REQUIRED]` must always be present.

### 1.1 Document Head `[REQUIRED]`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Google Analytics [REQUIRED] -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-GED7FX8RTV"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-GED7FX8RTV');
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <!-- SEO Meta Tags [REQUIRED] -->
    <title>[TITLE] | ResistanceZero</title>
    <meta name="description" content="[DESCRIPTION — 160 chars max]">
    <meta name="keywords" content="[KEYWORD1], [KEYWORD2], ...">
    <meta name="author" content="Bagus Dwi Permana">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
    <meta name="theme-color" content="[PRIMARY_HEX]">
    <link rel="canonical" href="https://resistancezero.com/article-[NN].html">
    <link rel="alternate" hreflang="en" href="https://resistancezero.com/article-[NN].html">

    <!-- Resource Hints [REQUIRED] -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">

    <!-- Open Graph [REQUIRED] -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://resistancezero.com/article-[NN].html">
    <meta property="og:title" content="[TITLE]">
    <meta property="og:description" content="[OG_DESCRIPTION — shorter version]">
    <meta property="og:image" content="https://resistancezero.com/assets/article-[NN]-hero.webp">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="[IMAGE_ALT]">
    <meta property="og:locale" content="en_US">
    <meta property="og:site_name" content="Bagus Dwi Permana Portfolio">
    <meta property="article:author" content="Bagus Dwi Permana">
    <meta property="article:published_time" content="[YYYY-MM-DD]T00:00:00Z">
    <meta property="article:modified_time" content="[YYYY-MM-DD]T00:00:00Z">
    <meta property="article:section" content="[CATEGORY]">
    <meta property="article:tag" content="[TAG1]">
    <meta property="article:tag" content="[TAG2]">

    <!-- Twitter Card [REQUIRED] -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@BagusDPermana">
    <meta name="twitter:creator" content="@BagusDPermana">
    <meta name="twitter:title" content="[TWITTER_TITLE — shorter if needed]">
    <meta name="twitter:description" content="[TWITTER_DESC — concise]">
    <meta name="twitter:image" content="https://resistancezero.com/assets/article-[NN]-hero.webp">
    <meta name="twitter:image:alt" content="[IMAGE_ALT]">

    <!-- Fonts & Icons [REQUIRED — always identical] -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="icon" type="image/png" href="assets/Favicon.png">
    <link rel="apple-touch-icon" href="assets/Favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="styles.min.css?v=[YYYY-MM-DD]">
    <link rel="preload" as="image" href="assets/article-[NN]-hero.webp">

    <!-- Structured Data (see Section 7) -->
    ...

    <!-- Article-Specific Styles -->
    <style>
        /* See Section 2: CSS Theming */
    </style>
</head>
```

### 1.2 Body Structure `[REQUIRED]`

```
<body>
  1. Scroll Progress Bar
  2. TOC Sidebar + TOC Mobile (toggle, backdrop, drawer)
  3. Search Overlay + Search Modal + Search Preview
  4. Navbar (.nav-menu pattern)
  5. Hero Section (<header class="article-hero">)
  6. Evidence Block (5 stats)
  7. Series Navigation
  8. <main> → <article class="article-content"> → <div class="container"> → <div class="article-body">
     a. Cover Image (<figure>)
     b. H2 sections (id="section-1", "section-2", ...)
     c. Author Bio (.author-bio)          ← INSIDE <article>
     d. Related Articles (.related-articles)  ← INSIDE <article>
     e. Article Navigation (.article-nav)     ← INSIDE <article>
     f. </div></div></article></main>
  9. Share Buttons (<aside>)              ← OUTSIDE <article>
 10. Footer (.footer.footer-enhanced)     ← OUTSIDE <article>
 11. Scripts (see Section 6)
</body>
```

**CRITICAL RULES:**
- `author-bio` + `related-articles` + `article-nav` go INSIDE `<article>` (after `</div><!-- .article-body -->`)
- `share-buttons` + `footer` go OUTSIDE `<article>`
- Div depth must balance exactly (validate with: `grep -c '<div' file.html` vs `grep -c '</div>' file.html`)

### 1.3 Scroll Progress Bar `[REQUIRED]`

```html
<div class="scroll-progress-container">
  <div class="scroll-progress-bar" id="scrollProgress"
       style="background: linear-gradient(90deg, [PRIMARY_HEX], [LIGHT_HEX]);"></div>
</div>
```

### 1.4 TOC Sidebar + Mobile `[REQUIRED — always identical]`

```html
<aside class="toc-sidebar" id="tocSidebar">
  <ul class="toc-sidebar-list" id="tocSidebarList"></ul>
</aside>

<button class="toc-mobile-toggle" id="tocMobileToggle" aria-label="Table of Contents">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="15" y2="12"/>
        <line x1="3" y1="18" x2="9" y2="18"/>
    </svg>
</button>
<div class="toc-mobile-backdrop" id="tocMobileBackdrop"></div>
<div class="toc-mobile-drawer" id="tocMobileDrawer">
    <div class="toc-drawer-header">
        <span class="toc-drawer-title">Table of Contents</span>
        <button class="toc-drawer-close" id="tocDrawerClose">&times;</button>
    </div>
    <ul class="toc-mobile-list" id="tocMobileList"></ul>
</div>
```

### 1.5 Search Overlay `[REQUIRED — always identical]`

```html
<div class="search-overlay" id="searchOverlay"></div>
<div class="search-modal" id="searchModal">
    <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" class="search-input" id="searchInput"
               placeholder="Search articles, calculators, tools..." autocomplete="off">
        <kbd class="search-kbd">ESC</kbd>
    </div>
    <div class="search-chips" id="searchChips">
        <button class="search-chip active" data-filter="all">All</button>
        <button class="search-chip" data-filter="articles">Articles</button>
        <button class="search-chip" data-filter="calculators">Calculators</button>
        <button class="search-chip" data-filter="tools">Tools</button>
    </div>
    <div class="search-results" id="searchResults"></div>
</div>
<div class="search-preview" id="searchPreview"></div>
```

### 1.6 Navbar `[REQUIRED — .nav-menu pattern]`

**IMPORTANT**: Content pages use `.nav-menu` (NOT `.nav-links` which is for calculator pages).

The navbar is standardized. Copy from the latest article. Key sections:
- Logo (profile photo)
- nav-menu with: Home, DC Solutions (dropdown), Results, Case Studies, Insights (dropdown with Engineering Journal / Global Analysis / Future Forward / All Insights), FAQ, Contact
- Search button
- Theme toggle (moon/sun icons)
- Hamburger for mobile

### 1.7 Hero Section `[REQUIRED]`

```html
<header class="article-hero">
    <div class="container">
        <a href="articles.html" class="back-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Articles
        </a>
        <span class="article-category">[CATEGORY] &mdash; [SUB_CATEGORY]</span>
        <h1 class="article-title">[TITLE_LINE_1]<br>
            <span class="highlight">[TITLE_LINE_2]</span>
        </h1>
        <p class="article-subtitle">[SUBTITLE]</p>
        <div class="article-meta">
            <span class="article-meta-item">
                <!-- User icon SVG -->
                Bagus Dwi Permana
            </span>
            <span class="article-meta-item">
                <!-- Calendar icon SVG -->
                [MONTH DD, YYYY]
            </span>
            <span class="article-meta-item">
                <!-- Clock icon SVG -->
                [NN] min read
            </span>
        </div>
    </div>
</header>
```

### 1.8 Evidence Block `[REQUIRED]`

```html
<div class="a[NN]-evidence-block">
    <div class="a[NN]-evidence-grid">
        <div class="a[NN]-evidence-card">
            <div class="a[NN]-evidence-value">[VALUE]</div>
            <div class="a[NN]-evidence-label">[LABEL]</div>
            <div class="a[NN]-evidence-sub">[SUB_TEXT]</div>
        </div>
        <!-- Repeat 5 total -->
    </div>
</div>
```

### 1.9 Series Navigation `[REQUIRED]`

```html
<div class="series-nav" style="margin-top: 1rem;">
    <div class="series-badge">
        <span class="series-badge-icon">[NN]</span>
        [SERIES_NAME] &mdash; Article [NN]
    </div>
    <span class="series-title"></span>
    <div class="series-links">
        <a href="article-[NN-1].html" class="series-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
            </svg>Prev
        </a>
        <a href="article-[NN+1].html" class="series-link"
           style="opacity:0.4;pointer-events:none;">
            Next<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        </a>
    </div>
</div>
```

**Note**: Latest article always has disabled "Next" link. When a new article is created, update the previous article's "Latest Article" span to link to the new one.

### 1.10 Article Body `[REQUIRED]`

```html
<main>
<article class="article-content">
<div class="container">
<div class="article-body">

    <!-- Cover Image -->
    <figure style="margin: 0 0 2.5rem 0; text-align: center;">
        <img src="assets/article-[NN]-hero.webp"
             alt="[DESCRIPTIVE_ALT_TEXT]"
             style="max-width: 100%; height: auto; border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
             loading="eager">
        <figcaption style="margin-top: 0.75rem; font-size: 0.875rem;
                          color: #64748b; font-style: italic;">
            [CAPTION]
        </figcaption>
    </figure>

    <!-- SECTION 1 -->
    <h2 id="section-1">1. [Section Title]</h2>
    <p>...</p>

    <!-- SECTION 2 -->
    <h2 id="section-2">2. [Section Title]</h2>
    <p>...</p>

    <!-- Continue sections... -->

<!-- Author Bio [REQUIRED — inside article] -->
<div class="author-bio">
    <div class="author-bio-image">
        <img loading="lazy" src="assets/profile-photo.jpg" alt="Bagus Dwi Permana">
    </div>
    <div class="author-bio-content">
        <h4>Bagus Dwi Permana</h4>
        <p class="author-bio-title">Engineering Operations Manager | Ahli K3 Listrik</p>
        <p>12+ years professional experience in critical infrastructure and operations.
           CDFOM certified. Transforming operations through systematic excellence
           and safety-first engineering.</p>
        <div class="author-bio-links">
            <a href="https://www.linkedin.com/in/bagus-dwi-permana-ba90b092" target="_blank">
                <!-- LinkedIn SVG --> LinkedIn
            </a>
            <a href="https://github.com/baguspermana7-cpu" target="_blank">
                <!-- GitHub SVG --> GitHub
            </a>
            <a href="mailto:baguspermana7@gmail.com">
                <!-- Email SVG --> Email
            </a>
        </div>
    </div>
</div>

<!-- Related Articles [REQUIRED — inside article] -->
<div class="related-articles">
    <h3>Continue Reading</h3>
    <div class="related-grid">
        <a href="article-[X].html" class="related-card">
            <div class="related-card-number">[X]</div>
            <div class="related-card-content">
                <h4>[Title]</h4>
                <p>[Short description]</p>
            </div>
        </a>
        <!-- 3 total related articles -->
    </div>
</div>

<!-- Article Navigation [REQUIRED — inside article] -->
<div class="article-nav">
    <a href="article-[NN-1].html"><i class="fas fa-arrow-left"></i> Previous Article</a>
    <a href="articles.html">All Articles</a>
    <span style="color: #64748b; cursor: default;">Latest Article</span>
</div>

</div><!-- .container -->
</div><!-- close inner container if used -->
</article>
</main>
```

### 1.11 Share Buttons `[REQUIRED — outside article]`

```html
<aside class="share-buttons" id="shareButtons" aria-label="Share this article">
    <span class="share-label">Share</span>
    <button class="share-btn linkedin" data-tooltip="Share on LinkedIn"
            onclick="shareLinkedIn()" aria-label="Share on LinkedIn">
        <!-- LinkedIn SVG -->
    </button>
    <button class="share-btn twitter" data-tooltip="Share on X"
            onclick="shareTwitter()" aria-label="Share on X">
        <!-- X/Twitter SVG -->
    </button>
    <button class="share-btn whatsapp" data-tooltip="Share on WhatsApp"
            onclick="shareWhatsApp()" aria-label="Share on WhatsApp">
        <!-- WhatsApp SVG -->
    </button>
    <button class="share-btn copy" data-tooltip="Copy link"
            onclick="copyLink()" aria-label="Copy article link">
        <!-- Copy/Check SVGs -->
    </button>
</aside>
```

### 1.12 Footer `[REQUIRED — outside article, always identical]`

```html
<footer class="footer footer-enhanced">
    <div class="container">
        <div class="footer-grid">
            <div class="footer-brand">
                <p class="footer-tagline-main">BUILT FOR MISSION CRITICAL INFRASTRUCTURE<br>
                   MANAGEMENT // 2026</p>
                <p class="footer-tagline-sub">ALL OPERATIONAL DATASETS PRESERVED.</p>
                <p class="footer-copyright">&copy; 2026 Bagus Dwi Permana. All rights reserved.</p>
            </div>
            <div class="footer-nav">
                <h4 class="footer-heading">NAVIGATION</h4>
                <ul class="footer-links">
                    <li><a href="index.html">Home Dashboard</a></li>
                    <li><a href="articles.html">Technical Journal</a></li>
                    <li><a href="index.html#case-studies">Case Studies</a></li>
                    <li><a href="datacenter-solutions.html">DC Solutions</a></li>
                </ul>
            </div>
            <div class="footer-connect">
                <h4 class="footer-heading">CONNECT</h4>
                <ul class="footer-links">
                    <li><a href="https://www.linkedin.com/in/bagus-dwi-permana-ba90b092"
                           target="_blank" rel="noopener">LinkedIn Profile</a></li>
                    <li><a href="articles.html">Technical Journal</a></li>
                    <li><a href="mailto:baguspermana7@gmail.com">Direct Contact</a></li>
                    <li><a href="https://github.com/baguspermana7-cpu"
                           target="_blank" rel="noopener">GitHub</a></li>
                </ul>
            </div>
        </div>
    </div>
</footer>
```

---

## 2. CSS Theming Guide

### 2.1 Color Variables `[REQUIRED]`

```css
:root {
    --a[NN]-[name]: [PRIMARY_HEX];        /* Main brand color */
    --a[NN]-[name]-light: [LIGHT_HEX];    /* Light accent */
    --a[NN]-dark: [DARK_HEX];             /* Dark shade */
    --a[NN]-darker: [DARKER_HEX];         /* Darkest shade */
    --a[NN]-light: [VERY_LIGHT_HEX];      /* Background tint */
    --a[NN]-accent: [ACCENT_HEX];         /* Secondary accent */
    --a[NN]-bg: [BG_HEX];                 /* Section backgrounds */
}
```

**Naming convention**: `--a[NN]-[color-name]` where `[NN]` is the article number.

| Article | Primary | Light | Dark | Darker | Accent | BG |
|---------|---------|-------|------|--------|--------|-----|
| 20 (red) | #dc2626 | #fca5a5 | #991b1b | #450a0a | #ef4444 | #fef2f2 |
| 21 (emerald) | #059669 | #34d399 | #064e3b | #022c22 | #10b981 | #ecfdf5 |

### 2.2 Hero Gradient Formula

```css
.article-hero {
    background: linear-gradient(135deg,
        [DARKER] 0%,
        [DARK] 25%,
        [PRIMARY] 55%,
        [ACCENT/LIGHT] 100%);
    padding: 7rem 2rem 3.5rem;
    color: #fff;
    text-align: center;
    position: relative;
    overflow: hidden;
}

/* Radial overlay for depth */
.article-hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
        radial-gradient(ellipse at 30% 50%, rgba([ACCENT_RGB],0.15) 0%, transparent 70%),
        radial-gradient(ellipse at 70% 20%, rgba([LIGHT_RGB],0.1) 0%, transparent 60%);
    pointer-events: none;
}
```

### 2.3 Required CSS Components

Each article needs CSS for these (prefix with `a[NN]-`):

| Component | Class Pattern | Purpose |
|-----------|--------------|---------|
| Evidence block | `.a[NN]-evidence-block/grid/card/value/label/sub` | Hero stats bar |
| H2 color override | `.article-body h2 { color: [DARK]; border-bottom: 2px solid [PRIMARY]; }` | Section headings |
| Insight box | `.a[NN]-insight-box` | Green-tinted callout |
| Warning box | `.a[NN]-warning-box` | Yellow/amber warning callout |
| Data table | `.a[NN]-table-container` | Responsive tables |
| Stat badge | `.a[NN]-stat` | Inline stat highlight |
| Quote callout | `.quote-callout` | Blockquote with left border |

**Optional components** (use when article needs them):
- Company/card grid: `.a[NN]-company-grid/card`
- Timeline: `.a[NN]-timeline/item/year/text`

### 2.4 Dark Mode `[REQUIRED]`

Every component needs `[data-theme="dark"]` overrides:

```css
[data-theme="dark"] .article-body h2 { color: [LIGHT]; border-color: [PRIMARY]; }
[data-theme="dark"] .article-body h3 { color: [LIGHTER]; }
[data-theme="dark"] .a[NN]-insight-box {
    background: linear-gradient(135deg, rgba([PRIMARY_RGB],0.1), rgba([ACCENT_RGB],0.08));
    border-color: rgba([LIGHT_RGB],0.3);
}
[data-theme="dark"] .a[NN]-insight-box h4 { color: [LIGHT]; }
[data-theme="dark"] .a[NN]-insight-box p { color: #d1d5db; }
[data-theme="dark"] .a[NN]-table-container { border-color: #374151; }
[data-theme="dark"] .a[NN]-table-container td { border-color: #374151; color: #d1d5db; }
[data-theme="dark"] .a[NN]-stat { background: rgba([PRIMARY_RGB],0.15); color: [LIGHT]; }
```

### 2.5 Responsive `[REQUIRED]`

```css
@media (max-width: 768px) {
    .a[NN]-evidence-grid { grid-template-columns: repeat(3, 1fr); }
    .a[NN]-evidence-value { font-size: 1.3rem; }
    .a[NN]-company-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
    .a[NN]-evidence-grid { grid-template-columns: repeat(2, 1fr); }
    .a[NN]-evidence-value { font-size: 1.1rem; }
    .a[NN]-evidence-label { font-size: 0.65rem; }
}
```

---

## 3. Content Components Reference

### 3.1 Insight Box

```html
<div class="a[NN]-insight-box">
    <h4><i class="fas fa-[ICON]" style="color:[PRIMARY];margin-right:6px"></i> [TITLE]</h4>
    <p>[CONTENT]</p>
</div>
```

### 3.2 Warning Box

```html
<div class="a[NN]-warning-box">
    <h4><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i> [TITLE]</h4>
    <p>[CONTENT]</p>
</div>
```

### 3.3 Data Table

```html
<div class="a[NN]-table-container">
    <table>
        <thead>
            <tr>
                <th>[COL1]</th>
                <th>[COL2]</th>
                ...
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>[DATA]</td>
                <td>[DATA]</td>
            </tr>
            <tr class="highlight-row"><!-- for emphasis rows --></tr>
        </tbody>
    </table>
</div>
```

### 3.4 Stat Badge (Inline)

```html
<span class="a[NN]-stat">[VALUE]</span>
```

### 3.5 Quote Callout

```html
<div class="quote-callout">
    <blockquote>[QUOTE TEXT]</blockquote>
    <cite>[ATTRIBUTION]</cite>
</div>
```

### 3.6 Timeline

```html
<div class="a[NN]-timeline">
    <div class="a[NN]-timeline-item">
        <span class="a[NN]-timeline-year">[YEAR]</span>
        <div class="a[NN]-timeline-text">[DESCRIPTION]</div>
    </div>
    <!-- Repeat -->
</div>
```

### 3.7 Company/Card Grid

```html
<div class="a[NN]-company-grid">
    <div class="a[NN]-company-card">
        <h4><i class="fas fa-[ICON]" style="color:[COLOR];margin-right:6px"></i> [TITLE]</h4>
        <p>[DESCRIPTION]</p>
        <div class="a[NN]-deal-stat">
            <span>[LABEL]</span>
            <span>[VALUE]</span>
        </div>
    </div>
    <!-- Repeat -->
</div>
```

---

## 4. Scripts `[REQUIRED]`

Scripts must appear in this exact order after `</footer>`:

```
1. <script src="script.min.js?v=[YYYY-MM-DD]"></script>
2. Share Functions <script>  (shareLinkedIn, shareTwitter, shareWhatsApp, copyLink)
3. Reading Progress Bar <script>  (requestAnimationFrame scroll handler)
4. TOC Sidebar <script>  (auto-discovers h2[id], builds sidebar + mobile drawer)
5. [Optional: Calculator IIFE scripts]
6. <script src="auth.js?v=20260228"></script>   ← ALWAYS LAST
```

### 4.1 Share Functions

```html
<script>
var shareUrl = 'https://resistancezero.com/article-[NN].html';
var shareTitle = '[FULL_TITLE]';
function shareLinkedIn(){window.open('https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(shareUrl),'_blank','width=600,height=600')}
function shareTwitter(){window.open('https://twitter.com/intent/tweet?url='+encodeURIComponent(shareUrl)+'&text='+encodeURIComponent(shareTitle),'_blank','width=600,height=400')}
function shareWhatsApp(){window.open('https://wa.me/?text='+encodeURIComponent(shareTitle+' '+shareUrl),'_blank')}
function copyLink(){navigator.clipboard.writeText(shareUrl).then(function(){var c=document.querySelector('.share-btn.copy .copy-icon'),k=document.querySelector('.share-btn.copy .check-icon');c.style.display='none';k.style.display='block';setTimeout(function(){c.style.display='block';k.style.display='none'},2000)})}
</script>
```

### 4.2 Reading Progress Bar

```html
<script>
(function() {
    var bar = document.getElementById('scrollProgress');
    if (!bar) return;
    var ticking = false;
    function updateProgress() {
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = Math.min(pct, 100) + '%';
        ticking = false;
    }
    window.addEventListener('scroll', function() {
        if (!ticking) { requestAnimationFrame(updateProgress); ticking = true; }
    }, { passive: true });
    updateProgress();
})();
</script>
```

### 4.3 TOC Sidebar

The TOC script auto-discovers `h2[id]` elements inside `.article-body` or `.article-content`. Copy from the latest article verbatim -- it requires no customization.

**CRITICAL**: Calculator IIFE scripts (if any) must come AFTER the share/progress/TOC scripts and BEFORE `auth.js`.

---

## 5. Calculator Integration (Optional)

Only add calculators to engineering/data-driven articles. Skip for editorial or analysis-only articles.

### 5.1 When to Add Calculators

- Article contains quantifiable data (measurements, comparisons, benchmarks)
- Readers would benefit from personalizing the data to their own situation
- Article has tables/charts that could be interactive

### 5.2 Calculator Pattern

| Element | Convention |
|---------|-----------|
| Container prefix | 2-3 letter prefix (e.g., `wc-` for water calc, `ai-` for AI calc) |
| Tab prefix | 3-letter per tab (e.g., `wfc`, `dcw`, `avh`) |
| CSS placement | Before `</style>` tag |
| HTML placement | After article body final paragraph, before `.author-bio` |
| JS placement | After TOC script, before `auth.js` |
| Free/Pro mode | `localStorage.getItem('rz_premium_session')`, demo credentials `demo@resistancezero.com` / `demo2026` |
| Auto-calculate | `change` event + debounced `input` event (400ms) |
| PDF export | Use shared helpers: `wcPDFCSS`, `wcPDFHead(title, subtitle)`, `wcPDFFoot()`, `wcSVGBar(data, highlightKey, w, h)` |
| Disclaimer | Required at bottom: "Results are estimates based on industry data..." |

### 5.3 Calculator Checklist

- [ ] All tabs switch correctly
- [ ] Each calculator produces correct results with default values
- [ ] Reset clears results
- [ ] PDF export opens new window with formatted report
- [ ] Free/Pro toggle works (if applicable)
- [ ] Mobile responsive (768px, 480px)
- [ ] Dark mode renders correctly
- [ ] No JS console errors
- [ ] Disclaimer present

---

## 6. Supporting File Updates `[REQUIRED]`

When creating a new article, these files MUST also be updated:

### 6.1 articles.html

**4 changes required:**

**A. Prepend card to `.articles-grid`:**
```html
<!-- Article [NN] - NEWEST ([SHORT_DESC]) -->
<a href="article-[NN].html" class="article-card">
    <div class="article-card-image"
         style="background: linear-gradient(135deg, [DARKER] 0%, [DARK] 50%, [PRIMARY] 100%);">
        <img loading="lazy" src="assets/article-[NN]-hero.webp"
             alt="[TITLE]" onerror="this.style.display='none'">
        <span class="article-card-number"
              style="background: linear-gradient(135deg, [DARK] 0%, [PRIMARY] 100%);">NEW</span>
    </div>
    <div class="article-card-content">
        <span class="article-card-category"
              style="background: rgba([PRIMARY_RGB], 0.1); color: [PRIMARY];">[CATEGORY]</span>
        <h3 class="article-card-title">[TITLE]</h3>
        <p class="article-card-excerpt">[EXCERPT]</p>
        <div class="article-card-meta">
            <span class="article-card-date">
                <!-- Calendar SVG -->
                [Mon DD, YYYY]
            </span>
            <span class="article-card-readtime">
                <!-- Clock SVG --> [NN] min
            </span>
            <span class="article-card-link">Read
                <!-- Arrow SVG -->
            </span>
        </div>
    </div>
</a>
```

**B. Update previous article badge**: Change `>NEW<` to `>[NN-1]<` on the previous newest article card.

**C. Update prefetch links**: Replace the oldest prefetch with the new article:
```html
<link rel="prefetch" href="article-[NN].html">
```

**D. Add ticker entry** (first in array):
```javascript
{ type: 'article', title: '[SHORT_TITLE]', url: 'article-[NN].html', date: '[DD Mon YYYY]' },
```

**E. Add structured data ListItem**:
```json
{
    "@type": "ListItem",
    "position": [NN],
    "item": {
        "@type": "TechnicalArticle",
        "headline": "[TITLE]",
        "url": "https://resistancezero.com/article-[NN].html",
        "description": "[DESCRIPTION]"
    }
}
```

### 6.2 sitemap.xml

Add before geopolitics section:
```xml
  <!-- Article [NN] - [SHORT_DESC] -->
  <url>
    <loc>https://resistancezero.com/article-[NN].html</loc>
    <lastmod>[YYYY-MM-DD]</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>https://resistancezero.com/assets/article-[NN]-hero.webp</image:loc>
      <image:caption>[TITLE]</image:caption>
    </image:image>
  </url>
```

### 6.3 search-index.json

Add entry before calculator entries:
```json
  {
    "id": "art-[NN]",
    "title": "[TITLE]",
    "url": "article-[NN].html",
    "description": "[DESCRIPTION]",
    "category": "[Category]",
    "keywords": ["keyword1", "keyword2", ...],
    "image": "assets/article-[NN]-hero.webp",
    "readingTime": [NN]
  },
```

### 6.4 Previous Article

In `article-[NN-1].html`, find:
```html
<span style="color: #64748b; cursor: default;">Latest Article</span>
```
Replace with:
```html
<a href="article-[NN].html">Next Article <i class="fas fa-arrow-right"></i></a>
```

### 6.5 Hero Image

Create `assets/article-[NN]-hero.webp`:
- Source: high-quality image relevant to topic
- Process: Python3 Pillow, max 1200px width, WebP quality=80
- Target: <100KB file size
- Command: `python3 -c "from PIL import Image; img=Image.open('[SOURCE]'); img.thumbnail((1200,1200)); img.save('assets/article-[NN]-hero.webp','WebP',quality=80)"`

---

## 7. Structured Data Schemas `[REQUIRED]`

### 7.1 TechnicalArticle

```json
{
    "@context": "https://schema.org",
    "@type": "TechnicalArticle",
    "headline": "[TITLE]",
    "description": "[DESCRIPTION]",
    "image": "https://resistancezero.com/assets/article-[NN]-hero.webp",
    "author": {
        "@type": "Person",
        "name": "Bagus Dwi Permana",
        "jobTitle": "Engineering Operations Manager",
        "sameAs": [
            "https://www.linkedin.com/in/bagus-dwi-permana-ba90b092/",
            "https://resistancezero.com"
        ]
    },
    "publisher": {
        "@type": "Organization",
        "name": "ResistanceZero",
        "url": "https://resistancezero.com",
        "logo": {
            "@type": "ImageObject",
            "url": "https://resistancezero.com/assets/Favicon.png"
        }
    },
    "datePublished": "[YYYY-MM-DD]",
    "dateModified": "[YYYY-MM-DD]",
    "wordCount": "[NNNN]",
    "articleSection": "[CATEGORY]",
    "keywords": ["keyword1", "keyword2", ...],
    "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://resistancezero.com/article-[NN].html"
    }
}
```

### 7.2 FAQPage

```json
{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "[QUESTION]?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "[ANSWER — 1-3 sentences, factual]"
            }
        }
        // Minimum 4 Q&A pairs
    ]
}
```

### 7.3 BreadcrumbList

```json
{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home",
         "item": "https://resistancezero.com/"},
        {"@type": "ListItem", "position": 2, "name": "Articles",
         "item": "https://resistancezero.com/articles.html"},
        {"@type": "ListItem", "position": 3, "name": "[SHORT_TITLE]",
         "item": "https://resistancezero.com/article-[NN].html"}
    ]
}
```

---

## 8. Social Media Drafts

Create files in `/rz-work/Article/Post Draft/Article [NN]/`:

### 8.1 X Posts (3 files, 280 chars max each)

| File | Angle | Template |
|------|-------|---------|
| `x-post-1.md` | Main hook | `# X Post 1 -- [ANGLE] (280 chars max)\n\n[HOOK LINE]\n\n[2-3 key stats]\n\n[CTA]\nresistancezero.com/article-[NN].html` |
| `x-post-2.md` | Data angle | Same format, different data focus |
| `x-post-3.md` | Contrarian/reality check | Same format, provocative angle |

**Rules**: No hashtags on X. Count chars excluding the header line. Max 280 chars for body.

### 8.2 Mastodon Posts (3 files, 500 chars max each)

| File | Angle | Template |
|------|-------|---------|
| `mastodon-post-1.md` | Overview | `# Mastodon Post 1 -- [ANGLE] (500 chars max)\n\n[CONTENT]\n\nresistancezero.com/article-[NN].html\n\n#Tag1 #Tag2 #Tag3 #Tag4` |
| `mastodon-post-2.md` | Deep data | Same format, different focus |
| `mastodon-post-3.md` | Unique angle | Same format, unique perspective |

**Rules**: 3-5 hashtags. Count chars including hashtags, excluding header line. Max 500 chars for body.

### 8.3 LinkedIn (1 file, 3000 chars max)

File: `linkedin-post.md`

```
# LinkedIn Post (3000 chars max)

[OPENING HOOK — 2-3 sentences]

[NOT X. NOT Y. [THE ANSWER].]

As a data center engineer with 12+ years in critical infrastructure, [PERSONAL CONTEXT].

THE DEALS / THE DATA
- [Bullet points with key stats]

WHY [TOPIC]
[Analysis paragraph]

THE REALITY
[Balanced assessment]

MY TIMELINE / ASSESSMENT
- [Year]: [Milestone]
- [Year]: [Milestone]

Full analysis: https://resistancezero.com/article-[NN].html

#Hashtag1 #Hashtag2 #Hashtag3 #Hashtag4 #Hashtag5
```

### 8.4 Medium (1 file)

File: `medium-post.md`

```
# Medium Post

SEO Title: [TITLE — max 74 chars]
Subtitle: [SUBTITLE]

NOTE: Run through humanizer before publishing. Free Medium account — no markdown bold.

[FULL ARTICLE CONTENT — adapted for Medium format]
[Use ## for H2, plain text, no bold]

---

*Originally published at [resistancezero.com](https://resistancezero.com/article-[NN].html)*
```

### 8.5 Quora (1 file)

File: `quora-post.md`

```
# Quora Post

Target Questions:
1. [Question 1]?
2. [Question 2]?
3. [Question 3]?
4. [Question 4]?
5. [Question 5]?

---

## Answer

[First-person answer from data center engineer perspective]
[Include specific data points and professional experience]
[End with link to full analysis]

Full analysis: [resistancezero.com/article-[NN].html](https://resistancezero.com/article-[NN].html)
```

---

## 9. Verification Checklist

### 9.1 HTML Validation
- [ ] Div balance: `grep -c '<div' article-[NN].html` == `grep -c '</div>' article-[NN].html`
- [ ] Script tags balance: `grep -c '<script' file` == `grep -c '</script>' file`
- [ ] No unclosed tags

### 9.2 Functional Testing
- [ ] `python3 -m http.server 8080` from rz-work
- [ ] HTTP 200 on `http://localhost:8080/article-[NN].html`
- [ ] All internal links work
- [ ] Dark mode toggle works
- [ ] TOC sidebar auto-discovers all sections
- [ ] Mobile responsive at 768px and 480px
- [ ] Share buttons open correct URLs
- [ ] Reading progress bar animates on scroll
- [ ] Search overlay opens (Ctrl+K)

### 9.3 Calculator Testing (if applicable)
- [ ] All tabs switch correctly
- [ ] Default values produce valid results
- [ ] Reset clears all results
- [ ] PDF export opens formatted report
- [ ] Free/Pro mode toggle works
- [ ] No JS console errors (`node -e "..."` or browser DevTools)

### 9.4 SEO Validation
- [ ] Structured data valid (Google Rich Results Test)
- [ ] Meta description <= 160 chars
- [ ] OG image URL correct
- [ ] Twitter card preview correct
- [ ] Canonical URL correct

### 9.5 Supporting Files
- [ ] articles.html: new card added, previous badge updated, prefetch updated, ticker updated, structured data added
- [ ] sitemap.xml: new URL block added
- [ ] search-index.json: new entry added
- [ ] Previous article: "Latest Article" span updated to link

### 9.6 Social Media
- [ ] X posts: all <= 280 chars (body only)
- [ ] Mastodon posts: all <= 500 chars (body + hashtags)
- [ ] LinkedIn post: <= 3000 chars
- [ ] Medium: SEO title <= 74 chars, humanizer note present
- [ ] Quora: 5 target questions listed, first-person answer

---

## 10. Color Reference (Past Articles)

| Article | Theme | Primary | Dark | Darker | Light | Accent |
|---------|-------|---------|------|--------|-------|--------|
| 18 | Blue | #2563eb | #1e40af | #1e3a8a | #dbeafe | #3b82f6 |
| 19 | Teal | #0d9488 | #115e59 | #042f2e | #ccfbf1 | #14b8a6 |
| 20 | Red | #dc2626 | #991b1b | #450a0a | #fef2f2 | #ef4444 |
| 21 | Emerald | #059669 | #064e3b | #022c22 | #d1fae5 | #10b981 |

Choose a distinct color for each new article to maintain visual variety.

---

## Bug Prevention

| Issue | Prevention |
|-------|-----------|
| Div imbalance | Always validate open/close div counts before committing |
| Script order wrong | Follow exact order: script.min.js -> share -> progress -> TOC -> [calculators] -> auth.js |
| Author bio outside article | Author bio, related articles, article-nav MUST be inside `<article>` |
| Share buttons inside article | Share buttons and footer MUST be outside `<article>` |
| Social post over char limit | Count chars excluding header line. Trim aggressively. |
| Missing dark mode | Every custom CSS class needs `[data-theme="dark"]` override |
| Navbar wrong pattern | Content pages use `.nav-menu`, calculator pages use `.nav-links` |
| H2 ID inconsistency | Use `id="section-N"` pattern consistently (most articles use this) |
| Missing hero image preload | Add `<link rel="preload" as="image" href="assets/article-[NN]-hero.webp">` in head |
