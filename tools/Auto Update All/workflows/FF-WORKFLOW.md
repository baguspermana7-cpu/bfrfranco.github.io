# FF-WORKFLOW.md
# Future Forward Series — Article Creation Specifics
# Extends ARTICLE-WORKFLOW.md with FF-specific rules

---

## Future Forward Series Identity

- **Color**: violet #a855f7 (not purple, not indigo — specifically #a855f7)
- **Section IDs**: `sec0` → `sec7` (NOT `section-1`, NOT `section1`)
- **CSS prefix**: `-ff` (landing page), varies per article
- **Badge**: "Future Forward"
- **Landing page**: future-forward.html
- **Files**: FF-1.html, FF-2.html, FF-3.html (sequential FF-N.html)
- **Post drafts**: `Article/Post Draft/FF-N — [Title]/`
  - Different from Engineering Journal path!

---

## FF Article Angle Requirements

Future Forward articles must be:
1. **Predictive** — argues where the industry is going (not where it is now)
2. **Contrarian** — challenges the consensus narrative
3. **Engineer-grounded** — predictions backed by operational data, not speculation
4. **Timeboxed** — includes explicit timeframe ("by 2027", "within 3 years")

Template phrases that work:
- "The [consensus assumption] is wrong because [operational data]"
- "By [year], [X] will [happen] — here's why [industry] isn't ready"
- "Everyone is building for [X]. The actual demand will be [Y]"

---

## Section ID Pattern (CRITICAL — Different from Engineering Journal)

```html
<!-- FF uses sec0-sec7, NOT section-1 through section-7 -->
<section id="sec0" class="article-section ff-section">...</section>
<section id="sec1" class="article-section ff-section">...</section>
...
<section id="sec7" class="article-section ff-section">...</section>

<!-- TOC links use #sec0 not #section-0 -->
<a href="#sec0">Introduction</a>
```

---

## FF-Specific Color Variables

```css
/* FF accent colors (violet) */
--ff-accent: #a855f7;
--ff-accent-dark: #7c3aed;
--ff-accent-light: #d8b4fe;
--ff-gradient: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%);
```

Apply to:
- Series badge background
- Section border accents
- TOC active state
- Hero gradient overlay
- Pull quotes and blockquotes

---

## Existing FF Articles (Reference)

### FF-1: "The Web Didn't Die. It Split"
- Angle: Web hasn't died — it's bifurcated into native apps and API-driven experiences
- Color: violet #6d28d9 (older, slightly different shade)

### FF-2: "The Engineer Shortage Is Fake"
- Angle: DC engineer shortage is a skills mismatch, not true shortage
- Color: amber #b45309
- CSS prefix: `tgs-`

### FF-3: "The Training Era Is Over" (In Progress)
- Angle: Foundation model training is commoditizing; inference is the new battleground
- Color: cyan #0891b2
- CSS prefix: `iec-`

### FF-4 (Planned): "Data Centers Abandoning the Grid"
- Candidate angle: DC operators building private microgrids due to grid instability
- Color: TBD
- Status: Research phase

---

## FF Landing Page Maintenance (future-forward.html)

When adding a new FF article:
1. Add article card to the grid on future-forward.html
2. Update article count in hero stats if displayed
3. Update prefetch links in `<head>` of future-forward.html

---

## Post Draft Path (FF — different from Engineering Journal)

```
Article/Post Draft/FF-N — [Article Title]/
  FF-N-x-post-1.md
  FF-N-x-post-2.md
  FF-N-x-post-3.md
  FF-N-mastodon-1.md
  FF-N-mastodon-2.md
  FF-N-mastodon-3.md
  FF-N-linkedin.md
  FF-N-medium.md
  FF-N-quora.md
  FF-N-facebook.md
  FF-N-tiktok-script.md
```

Note: FF post tone is more thought-leadership/provocative than Engineering Journal posts.
X posts: lead with the contrarian take, not the headline.
LinkedIn: frame as professional prediction, invite disagreement.
