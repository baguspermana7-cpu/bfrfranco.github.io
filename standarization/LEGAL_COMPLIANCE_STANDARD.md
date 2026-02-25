# Legal & Compliance Standard — ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-02-25
> **Applies to**: All HTML pages in rz-work root + legal pages

---

## Overview

Legal protections ensuring ResistanceZero is clearly positioned as a personal educational project, independent from any employment relationship. All legal language was implemented on 2026-02-24.

| Component | Location | Purpose |
|-----------|----------|---------|
| Terms of Service | `terms.html` v1.2 | Full legal terms, data sources, employment separation |
| Privacy Policy | `privacy.html` v1.1 | Content independence section, cookie consent |
| Independence Disclaimer | `index.html` (experience section) | Visible per-page disclaimer |
| FAQ Schema | `index.html` (JSON-LD + visible FAQ) | Search-visible data source + non-commercial FAQ |
| Table Disclaimers | All 18 articles + geopolitics-1 | Per-table source attribution |
| articles.html Hero | `articles.html` hero subtitle | Educational journal declaration |
| Cookie Consent Banner | All pages | GDPR-style opt-in/out |

---

## 1. Terms of Service (`terms.html`)

### Key Sections

**Section 1 — Service Description**: Educational & analytical platform (no commercial language).

**Section 3 — Account Registration**: Free access with optional demo/preview features for educational purposes. No "PRO Subscription" paid language.

**Section 6 — Data Sources, Independence & Non-Confidentiality Disclaimer**: The core legal protection section. Contains:

1. **IMPORTANT NOTICE highlight box**: All data derived exclusively from publicly available sources
2. **Source list**: Synergy, CBRE, JLL, SEC filings, government data, trade publications, AI-assisted research, author's independent knowledge
3. **No affiliation or endorsement**: Company mentions are informational only
4. **No insider or confidential information**: Express warranty that no content derives from confidential sources
5. **Employment separation**: Full paragraph establishing independence from employer
6. **No investment or business advice**: Educational/informational purposes only

### Employment Separation Clause (Section 6)

This is the critical legal paragraph:

> "The author is employed in the data center industry. This platform operates independently and separately from any current or former employment relationship. No work is performed on this platform during any employer's working hours or using any employer's equipment, networks, or resources. All content is the product of the author's personal interest, independent reading, and self-directed research conducted in the author's own time. The platform does not offer consulting, advisory, bid support, feasibility studies, or any services that compete with any data center operator, colocation provider, or infrastructure company. ResistanceZero is a personal educational project driven by independent research and does not represent, reflect the views of, or act on behalf of any current or former employer."

### Removed Sections (v1.2)

These commercial sections were deleted:
- ~~Section 4 (Subscription & Pricing)~~ — included IDR pricing, Mayar payment
- ~~Section 5 (Payment & Billing)~~ — payment methods, PPN/VAT
- ~~Section 6 (Cancellation & Refund)~~ — refund policy

### Section Numbering (Current)

1. Service Description
2. Eligibility
3. Account Registration & Access
4. Acceptable Use Policy
5. Intellectual Property
6. Data Sources, Independence & Non-Confidentiality Disclaimer
7. Disclaimer of Warranties
8. Limitation of Liability
9. Indemnification
10. Data Protection & Privacy
11. Service Availability
12. Modifications to Terms
13. Governing Law (Indonesia)
14. Force Majeure
15. Severability
16. Entire Agreement
17. Waiver
18. Contact Information

---

## 2. Privacy Policy (`privacy.html`)

### Section 11 — Content Independence

> "All analytical content, benchmarks, operator data, and calculator methodologies on ResistanceZero are derived exclusively from publicly available sources, independent reading, and self-directed research. No confidential information from any current or former employer, client, or third party is used. This platform is a personal educational project and does not represent any organization. For full details, see Section 6 of our Terms of Service."

### Version
- **Current**: v1.1 (2026-02-24)
- Cross-references Terms Section 6

---

## 3. Independence Disclaimer (`index.html`)

### Location
Below the PureDC experience card in the bento experience section (line ~453).

### HTML Pattern
```html
<!-- Independence Disclaimer -->
<div style="width:100%;margin-top:0.5rem;padding:0.6rem 1rem;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:8px;text-align:center;">
    <p style="font-size:0.7rem;color:#94a3b8;font-style:italic;line-height:1.5;margin:0;">Views and content on this site are independent personal research and do not represent any current or former employer. <a href="terms.html" style="color:#8b5cf6;text-decoration:none;font-weight:500;">Terms &amp; Disclaimer</a></p>
</div>
```

### Rules
- Must always appear below the current employer experience card
- Links to `terms.html` for full legal details
- Styled subtly (small italic text, muted purple accent)

---

## 4. FAQ Schema & Visible FAQ (`index.html`)

### Search-Visible Legal FAQs

Two FAQ items in both visible HTML and JSON-LD schema:

**Q: Where does the data and analysis come from?**
> All content is derived exclusively from publicly available sources — published industry reports (Synergy, CBRE, JLL), SEC filings, press releases, trade publications (DCD, Uptime Institute), government data, and academic research. No confidential, proprietary, or non-public information from any employer, client, or third party is used.

**Q: Is this a commercial business or consulting service?**
> No. ResistanceZero is a personal educational project — it does not offer consulting, advisory, bid support, feasibility studies, or any commercial services. The calculators and articles are free analytical tools built from the author's independent reading and research into publicly available data center methodologies.

### Rules
- These two FAQs must always remain in the schema and visible FAQ section
- Answers must match between visible HTML and JSON-LD exactly

---

## 5. Table Source Disclaimers

### Coverage
- All 18 articles (article-1 through article-18) + geopolitics-1.html
- 91 new disclaimers added + 21 existing updated (2026-02-25)

### Existing Source Pattern (tables that already had source attribution)
Suffix added to existing `<p class="table-source">`:
```
[existing source text] For educational and research purposes only.
```

### New Disclaimer Pattern (tables without prior source)
```html
<p class="table-source" style="font-size:0.72rem;color:#64748b;font-style:italic;margin:0.4rem 0 1.2rem;">Source: Publicly available industry data and published standards. For educational and research purposes only.</p>
```

### Rules for New Articles
- Every `<table>` must have a source disclaimer immediately after the closing `</table>` tag
- Use specific source names when known (e.g., "Sources: NVIDIA GTC 2025, Tom's Hardware")
- Always end with "For educational and research purposes only."
- Class: `table-source`
- Never place disclaimers inside `<script>` blocks

---

## 6. Articles Landing Page (`articles.html`)

### Hero Subtitle

> "An independent educational journal exploring reliability, resilience, and human factors in data center operations — built from publicly available research, published standards, and personal study as a knowledge-sharing hobby project. Not affiliated with or representing any company."

### Schema
- `jobTitle`: "Independent Researcher" (not company title)
- `description`: References independent educational platform

---

## 7. Cookie Consent Banner

### Implementation
All pages have a GDPR-style cookie consent banner.

### HTML Pattern
```html
<!-- Cookie Consent Banner -->
<div class="cookie-banner hidden" id="cookieBanner">
    <p>We use cookies for analytics to improve your experience. <a href="privacy.html">Learn more</a></p>
    <div class="cookie-actions">
        <button class="cookie-accept" id="cookieAccept">Accept</button>
        <button class="cookie-decline" id="cookieDecline">Decline</button>
    </div>
</div>
```

### JS Logic
```javascript
var consent = localStorage.getItem('rz_cookie_consent');
if (!consent) { /* show banner */ }
// Accept → localStorage 'accepted'
// Decline → localStorage 'declined' + disable GA
```

### localStorage Key
- `rz_cookie_consent`: `'accepted'` | `'declined'`
- On decline: `window['ga-disable-G-GED7FX8RTV'] = true`

### CSS
- Styles in `styles.css` lines 5982-6049
- Class: `.cookie-banner`
- Dark mode: `[data-theme="dark"] .cookie-banner`
- Mobile: column layout at `max-width: 768px`
- Print: hidden

### Rules for New Pages
- Must include cookie banner HTML before `</body>`
- Must include cookie JS logic
- Banner starts with `hidden` class (shown via JS if no consent stored)

---

## 8. Admin/Dashboard Pages

### noindex Protection
Non-public pages have `<meta name="robots" content="noindex, nofollow">`:
- `dashboard.html`
- `rz-ops-p7x3k9m.html` (DC Industry Intelligence console)
- `article-9-paper.html`

### PureDC in Operator Console
PureDC appears in `rz-ops-p7x3k9m.html` (rank 31, source: "PureDC, DCD"). Kept because:
- Removing it would look more suspicious than keeping it
- Source attribution is public (DCD = DatacenterDynamics trade publication)
- Page is noindexed

---

## Checklist for New Content

When publishing any new article or page:

- [ ] Add table source disclaimers below every `<table>`
- [ ] End each disclaimer with "For educational and research purposes only."
- [ ] Include cookie consent banner HTML + JS
- [ ] Add `<meta name="robots">` (index or noindex as appropriate)
- [ ] Reference publicly available sources — never cite internal/confidential data
- [ ] Include hreflang + canonical tags
- [ ] Update `search-index.json` if page is indexable
- [ ] Create social media post drafts in `Article/Post Draft/[Article N - Title]/`
