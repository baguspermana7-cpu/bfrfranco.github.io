# create-article.md
# Paste this at the start of a new session to build an article from scratch
# Modify [PLACEHOLDERS] before pasting

---

## Session Context

I need to build a new article for resistancezero.com. Start by reading the site context:
1. Read `/home/baguspermana7/rz-work/tools/Auto Update All/AGENT-GUIDE.md`
2. Read `/home/baguspermana7/rz-work/standarization/article prompt/ARTICLE_CREATION_PROMPT.md`
3. Read the last article (`article-26.html`) for reference on structure and style

Then build:

**Article**: [ARTICLE NUMBER — e.g., article-27]
**Series**: [Engineering Journal | Future Forward | Global Analysis]
**Angle**: [One sentence — the unique insider engineer angle, NOT available on other sites]
**Title**: [Working title]
**Primary keyword**: [main SEO keyword]

**Requirements:**
- Follow the 18-step ARTICLE-WORKFLOW.md exactly
- AEO/GEO: FAQPage schema with 5+ Q&As, question-based H2 headings
- Unique angle — cannot be found aggregated from other sites
- Series color: [hex color]
- CSS prefix: [prefix-]
- Hero image: I will provide the source file path after you confirm the outline

**After building the HTML:**
1. Update articles.html (new card at top, ticker updated)
2. Update article-[N-1].html series nav Next link
3. Update sitemap.xml
4. Update search-index.json
5. Create 11 post drafts at `Article/Post Draft/Article [N]/`
6. git commit + push

Confirm article number and series selection, then start with the research/outline phase.

---

## Quick Article Template Reference

**File**: `article-N.html`
**Series badge colors**: cyan #06b6d4 (EJ) | violet #a855f7 (FF) | red #ef4444 (GA)
**Section IDs**: `section-1` through `section-7` (EJ/GA) | `sec0` through `sec7` (FF)
**Navbar**: `.nav-menu` class
**Dark mode**: articles use global `script.js` theme (not calc-specific toggle)
**Hero**: `assets/article-N-hero.webp`, max 1200px, quality=80
**Calculator (if embedded)**: IIFE pattern, placed AFTER HTML, before `</body>`
