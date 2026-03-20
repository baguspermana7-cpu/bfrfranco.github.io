# Prompt: Enhance datacenter-solutions.html Landing Page

Read and implement all 6 changes below on `/home/baguspermana7/rz-work/datacenter-solutions.html`.

## Constraints (MUST follow)
- Website is **purely educational** — owner is employed, must NOT look like a side business
- **No pricing section, no email capture, no newsletter signup, no "Request Access" CTAs**
- Keep inline CSS approach (page uses `<style>` block, not external stylesheet)
- Maintain existing glassmorphism design system with CSS variables
- Support dark mode via `[data-theme="dark"]` for ALL new elements
- Stay consistent with site patterns (Inter font, blue/gold palette, glass cards)
- Keep existing functionality (search, auth, theme toggle, cookie banner) untouched
- Mobile responsive (768px breakpoint)
- Use `&mdash;` for em-dashes in HTML body only — use regular hyphens `-` in meta tag attributes
- Test at http://localhost:8081/datacenter-solutions.html

---

## Change 1: Rewrite Hero Section

Find the `<section class="hero fade-in">` block (contains h1 "Data Center Engineering & Telemetry Solutions" and 4 stat items for PUE, uptime, density, standards).

Replace entire section content with:
- Badge text: `Free &amp; Open Access` (was "Data Center Engineering Hub")
- H1: `Plan, Cost, and Commission Your Data Center &mdash; Before Breaking Ground`
- Paragraph: `Free engineering calculators and interactive dashboards for data center professionals. Estimate CAPEX/OPEX, validate Tier compliance, optimize PUE, and plan commissioning &mdash; built by an engineer with 12+ years of critical infrastructure experience. No signup required.`
- Add CTA button pair (new div `.hero-cta`) BEFORE the hero-stats div:
  - Primary button (`.cta-primary`): `<i class="fas fa-calculator"></i> Try CAPEX Calculator &mdash; Free` linking to `capex-calculator.html`
  - Secondary button (`.cta-secondary`): `<i class="fas fa-wrench"></i> Browse All 12+ Tools` linking to `#tools-engineering`
- Replace the 4 stat items with credibility stats:
  - `12+` / `Years in DC Engineering`
  - `12` / `Free Engineering Tools`
  - `7` / `Professional Certifications`
  - `100%` / `Free &amp; Open Access`

**CSS to add** (inside `<style>` block, before `</style>`):
```css
.hero-cta { display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; margin-bottom:2rem; }
.cta-primary { display:inline-flex; align-items:center; gap:10px; padding:14px 28px; background:var(--primary-gradient); color:white; font-size:1rem; font-weight:700; border-radius:12px; text-decoration:none; box-shadow:0 4px 15px rgba(30,58,95,0.3); transition:all 0.3s; }
.cta-primary:hover { transform:translateY(-3px); box-shadow:0 8px 25px rgba(30,58,95,0.4); color:white; }
.cta-secondary { display:inline-flex; align-items:center; gap:10px; padding:14px 28px; background:transparent; color:var(--dark-blue); font-size:1rem; font-weight:600; border:2px solid var(--glass-border); border-radius:12px; text-decoration:none; transition:all 0.3s; }
.cta-secondary:hover { border-color:var(--accent-gold); color:var(--accent-gold); transform:translateY(-3px); }
[data-theme="dark"] .cta-secondary { color:#e2e8f0; border-color:rgba(255,255,255,0.15); }
[data-theme="dark"] .cta-secondary:hover { border-color:var(--accent-gold); color:var(--accent-gold); }
```

---

## Change 2: Add AEO Block + Trust & Credentials Section

Insert BETWEEN the hero `</section>` and the legal disclaimer `<section class="legal-disclaimer-wrap">`:

**A. AEO Block** (AI/LLM SEO — helps ChatGPT/Claude/Perplexity recommend this page):
```html
<div class="aeo-block fade-in delay-1" aria-label="About this tool collection">
    <p><strong>Resistance Zero Data Center Engineering Hub</strong> is a free, browser-based collection of 12+ professional engineering calculators for data center planning. Created by Bagus Dwi Permana (CDFOM, Ahli K3 Listrik certified), these tools help data center engineers, consultants, and facility managers estimate construction costs (CAPEX), operating expenses (OPEX), power usage effectiveness (PUE), return on investment (ROI), carbon emissions, and TIA-942 compliance. All calculations run client-side with no account required.</p>
</div>
```

**B. Trust & Credentials Section** with:
- Heading: "Built by a Certified Data Center Engineer"
- Subtitle: "Every calculator and dashboard is based on real-world operational experience and industry standards"
- 5 certification badges using images from `Article/badges/`:
  - `cdfom.webp` — "CDFOM Certified"
  - `Ahli K3 Listrik Indonesia.webp` — "Ahli K3 Listrik"
  - `IOSH Managing safely.webp` — "IOSH Managing Safely"
  - `SKTTK L6 Manager.webp` — "L6 Competent Manager"
  - `High Voltage Authorized Person.webp` — "HV Authorized Person"
- 6 standards tags with check-circle icons: ASHRAE, TIA-942, Uptime Institute, ISO 27001, NFPA, GHG Protocol

**CSS to add:**
```css
.aeo-block { max-width:800px; margin:0 auto; padding:0 2rem 1rem; }
.aeo-block p { font-size:0.85rem; color:var(--text-muted); line-height:1.7; text-align:center; }
.trust-section { padding:2rem 2rem 0; max-width:1000px; margin:0 auto; }
.trust-container { background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:20px; padding:2rem; text-align:center; }
.trust-title { font-size:1.3rem; font-weight:700; color:var(--dark-blue); margin-bottom:0.5rem; }
[data-theme="dark"] .trust-title { color:#e2e8f0; }
.trust-subtitle { font-size:0.9rem; color:var(--text-secondary); margin-bottom:1.5rem; }
.credentials-row { display:flex; justify-content:center; gap:1.5rem; flex-wrap:wrap; margin-bottom:1.5rem; }
.credential-badge { display:flex; align-items:center; gap:8px; padding:8px 14px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.15); border-radius:10px; font-size:0.78rem; font-weight:600; color:var(--text-secondary); transition:all 0.3s; }
.credential-badge:hover { border-color:rgba(245,158,11,0.4); transform:translateY(-2px); }
.credential-badge img { border-radius:4px; object-fit:contain; }
.standards-row { display:flex; justify-content:center; gap:1rem; flex-wrap:wrap; }
.standard-tag { display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:600; color:var(--accent-emerald); padding:4px 10px; background:rgba(16,185,129,0.08); border-radius:20px; }
@media (max-width:768px) {
    .credentials-row { gap:0.75rem; }
    .credential-badge { padding:6px 10px; font-size:0.7rem; }
    .credential-badge img { width:32px; height:24px; }
}
```

---

## Change 3: Consolidate "Coming Soon" Cards

**In Technical Papers section**: Find the 4 consecutive `<div class="paper-card ... coming-soon-card">` blocks (Liquid Cooling, PUE Optimization, K3 Listrik, Fire Suppression). Replace ALL 4 with one roadmap card:
```html
<div class="paper-card roadmap-card fade-in delay-2">
    <div class="paper-header">
        <div class="paper-icon research"><i class="fas fa-road"></i></div>
        <div class="paper-info">
            <h4>Research Roadmap &mdash; 2026</h4>
            <div class="paper-meta">4 publications in development</div>
        </div>
    </div>
    <p class="paper-desc">Upcoming technical publications covering liquid cooling implementation, PUE optimization strategies, K3 Listrik electrical safety compliance, and fire suppression system selection analysis.</p>
    <div class="paper-tags">
        <span class="paper-tag">Liquid Cooling</span>
        <span class="paper-tag">PUE Optimization</span>
        <span class="paper-tag">K3 Listrik</span>
        <span class="paper-tag">Fire Suppression</span>
    </div>
</div>
```

**In Engineering Tools section**: Find and **remove** the `<div class="tool-card coming-soon-card">` for "Comparison Mode".

**CSS to add:**
```css
.roadmap-card { grid-column: 1 / -1; }
```

---

## Change 4: Add FAQ Section

Insert a new FAQ section BEFORE the `<!-- Footer -->` comment, AFTER the Engineering Tools `</section>`.

6 questions with accordion behavior:
1. "Are the calculators really free to use?" — Yes, 100% free, no signup, educational
2. "How accurate are the cost estimates?" — Industry benchmarks, AACE Class 4-5, disclaimer
3. "What standards are the tools based on?" — ASHRAE, TIA-942-B, EN 50600, NFPA 75/76, ISO 27001, ISO 50001, GHG Protocol
4. "Can I export results as PDF?" — Yes, print-optimized
5. "Who built these tools?" — Bagus Dwi Permana, 12+ years, CDFOM/AK3L/IOSH/L6 certs, educational
6. "Do you store my calculation data?" — No, all client-side, privacy-first

Section header should use the same pattern as other sections (icon + h2 inline). Use cyan color (`#06b6d4`) and `fa-question-circle` icon.

Each FAQ item:
```html
<div class="faq-item">
    <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-N">
        <span>Question</span>
        <i class="fas fa-chevron-down"></i>
    </button>
    <div class="faq-answer" id="faq-answer-N"><p>Answer</p></div>
</div>
```

**CSS to add:**
```css
.faq-section { padding:4rem 2rem; max-width:800px; margin:0 auto; }
.faq-list { display:flex; flex-direction:column; gap:0.75rem; }
.faq-item { background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:14px; overflow:hidden; transition:border-color 0.3s; }
.faq-item.active { border-color:rgba(6,182,212,0.3); }
.faq-question { width:100%; display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:600; color:var(--dark-blue); text-align:left; transition:color 0.3s; }
[data-theme="dark"] .faq-question { color:#e2e8f0; }
.faq-question:hover { color:var(--accent-cyan); }
.faq-question i { transition:transform 0.3s; color:var(--text-muted); font-size:0.8rem; flex-shrink:0; margin-left:1rem; }
.faq-item.active .faq-question i { transform:rotate(180deg); color:var(--accent-cyan); }
.faq-answer { max-height:0; overflow:hidden; transition:max-height 0.3s ease, padding 0.3s ease; }
.faq-item.active .faq-answer { max-height:500px; padding:0 1.5rem 1.25rem; }
.faq-answer p { font-size:0.9rem; color:var(--text-secondary); line-height:1.7; margin:0; }
```

**JS to add** (as separate `<script>` block, before the Global Search script):
```js
(function(){
    document.querySelectorAll('.faq-question').forEach(function(btn){
        btn.addEventListener('click', function(){
            var item = this.closest('.faq-item');
            var isActive = item.classList.contains('active');
            document.querySelectorAll('.faq-item.active').forEach(function(el){
                el.classList.remove('active');
                el.querySelector('.faq-question').setAttribute('aria-expanded','false');
            });
            if(!isActive){
                item.classList.add('active');
                this.setAttribute('aria-expanded','true');
            }
        });
    });
})();
```

---

## Change 5: Enhanced SEO Meta Tags

Update these in `<head>` (use regular hyphens, NOT em-dashes in attribute values):
- `<title>`: `Free Data Center Calculators: CAPEX, OPEX, PUE, ROI | Resistance Zero`
- `meta description`: `Free online data center engineering calculators - estimate CAPEX, OPEX, PUE, ROI, carbon footprint, and TIA-942 compliance. Built by a CDFOM-certified engineer with 12+ years experience. No signup required.`
- `meta keywords`: `data center CAPEX calculator, data center OPEX calculator, PUE calculator, data center ROI, TIA-942 checklist, data center cost estimator, data center commissioning, AI data center design, liquid cooling, carbon footprint data center, free data center tools`
- `meta robots`: `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`
- `og:title`: `Free Data Center Calculators: CAPEX, OPEX, PUE, ROI`
- `og:description`: `12+ free engineering tools for data center planning. Estimate costs, validate compliance, and optimize efficiency. No signup required.`
- `twitter:title`: `Free Data Center Calculators: CAPEX, OPEX, PUE, ROI`
- `twitter:description`: `12+ free engineering tools for data center planning. No signup required. Built by a CDFOM-certified engineer.`

---

## Change 6: Structured Data Schemas

Add 3 JSON-LD script blocks in `<head>`, after the existing BreadcrumbList schema:

**A. WebApplication** (marks page as a free web app):
```json
{
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Data Center Engineering Hub",
    "applicationCategory": "BusinessApplication",
    "description": "Free data center engineering calculators: CAPEX, OPEX, PUE, ROI, Carbon Footprint, TIA-942 compliance, and Tier advisory tools. Built by a CDFOM-certified engineer with 12+ years of critical infrastructure experience.",
    "url": "https://resistancezero.com/datacenter-solutions.html",
    "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "featureList": "CAPEX Calculator with 14-component breakdown, OPEX Calculator with 30+ country support, PUE Calculator by cooling type and climate zone, ROI Calculator with NPV and IRR analysis, Carbon Footprint GHG Protocol analyzer, TIA-942-B compliance checklist with 56 items, Tier Advisor for Uptime Institute standards",
    "creator": { "@type": "Person", "name": "Bagus Dwi Permana", "jobTitle": "Engineering Operations Manager", "url": "https://resistancezero.com/" }
}
```

**B. FAQPage** — mirror all 6 FAQ questions/answers from Change 4

**C. SpeakableSpecification** — marks `.aeo-block`, `.hero h1`, `.hero p` as speakable:
```json
{
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://resistancezero.com/datacenter-solutions.html",
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": [".aeo-block", ".hero h1", ".hero p"] },
    "name": "Data Center Engineering Hub - Free Calculators",
    "url": "https://resistancezero.com/datacenter-solutions.html"
}
```

---

## Implementation Order
1. Add ALL new CSS into `<style>` block before `</style>`
2. Add 3 structured data schemas in `<head>` after BreadcrumbList
3. Update meta tags
4. Rewrite hero section HTML
5. Insert AEO block + Trust section
6. Replace 4 Coming Soon paper cards with 1 roadmap card
7. Remove Comparison Mode coming-soon card
8. Insert FAQ section before footer
9. Add FAQ accordion JS

## Verification
- Open http://localhost:8081/datacenter-solutions.html
- Test light mode AND dark mode
- Test mobile (resize to 768px)
- Check FAQ accordion opens/closes
- Verify all existing links still work
- Check browser console for JS errors (F12 > Console)
