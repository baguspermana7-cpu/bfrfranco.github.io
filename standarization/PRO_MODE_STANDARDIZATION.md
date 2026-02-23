# ResistanceZero Pro Enhancement Mode — Standardization Guide

> **Version**: 2.1 | **Last Updated**: 2026-02-23 | **Status**: Active
> **Applies to**: All article pages with interactive calculators (articles 1–15)

---

## 1. Architecture Overview

Every article with an interactive calculator follows a **unified Pro Enhancement Mode** pattern:

```
[Hero Section]
  └─ Evidence Block (5 stats)
[Table of Contents]
  └─ Calculator items get toc-calculator class + badge
[Abstract / TL;DR]
  └─ CTA Block (action-oriented, links to calculator)
[Article Body...]
[Calculator Section]
  ├─ Toolbar Row (Free/Pro toggle + Reset + Export PDF)
  ├─ Calculator Inputs (ALL with tooltip triggers)
  ├─ Free Results (visible by default)
  ├─ Pro Panels (4-5 gated panels, hidden by default)
  │   ├─ Panel: Monte Carlo / Risk Distribution
  │   ├─ Panel: Cost / Financial Analysis
  │   ├─ Panel: Sensitivity / Tornado Analysis
  │   └─ Panel: Predictive / Roadmap
  ├─ Narrative Box (dynamic executive assessment)
  ├─ Privacy Badge
  └─ Benchmark Meta
[Login Modal]
[Rest of Article...]
```

---

## 2. Article Registry

| Article | Topic | CSS Prefix | Theme Color | Theme Accent | Pro Status |
|---------|-------|-----------|-------------|--------------|------------|
| 1 | CAPEX/OPEX Benchmarking | (generic) | `#3b82f6` blue | `#60a5fa` | GOLD STANDARD |
| 2 | Alarm Rationalization | (generic) | `#ef4444` red | `#f87171` | Full (3 SVG charts in PDF, Feb 2026) |
| 3 | Monitoring Maturity | (generic) | `#10b981` emerald | `#34d399` | Strong |
| 4 | In-House Capability / MTTR | (generic) | `#3b82f6` blue | `#60a5fa` | Strong (5 panels) |
| 5 | Technical Debt Risk | (generic) | `#f59e0b` gold | `#fbbf24` | Full (upgraded Feb 2026) |
| 6 | RCA Effectiveness | `.rca-` | `#06b6d4` cyan | `#22d3ee` | Full (upgraded Feb 2026) |
| 7 | Emergency Response | `.res-` | `#10b981` emerald | `#34d399` | Full (upgraded Feb 2026) |
| 8 | Safety Health Index | `.shi-` | `#8b5cf6` purple | `#a78bfa` | Full |
| 9 | HVAC/Cooling Strategy | `.hvac-` | `#3b82f6` blue | `#60a5fa` | Full |
| 10 | Water Stress Assessment | `.ws-` | `#0891b2` teal | `#06b6d4` | Full |
| 11 | Energy Equity | `.eeq-` | `#f59e0b` amber | `#fbbf24` | Full |
| 12 | Operational Maturity | `.opm-` | `#10b981` emerald | `#34d399` | Full (Feb 2026) |
| 13 | AI Governance | `.aig-` | `#6366f1` indigo | `#818cf8` | Full (Feb 2026) |
| 14 | Maintenance Staffing | `.msf-` | `#f97316` orange | `#fb923c` | Full (Feb 2026) |
| 15 | Mission Critical Leadership | `.mcl-` | `#ec4899` pink | `#f472b6` | Full (Feb 2026) |
| PUE | PUE Calculator (standalone) | `.pue-` | `#06b6d4` cyan | `#22d3ee` | Full (Feb 2026) |

---

## 3. Mandatory Components Checklist

### 3.1 HEAD Section
- [ ] Font Awesome CDN `<link>` (v6.4.0 or 6.5.1)
- [ ] Canonical URL correct (`https://resistancezero.com/article-N.html`)
- [ ] Meta robots: `index, follow`
- [ ] Structured data (JSON-LD with TechnicalArticle schema)

### 3.2 Evidence Block
**Position**: After hero `</section>`, before TOC

```html
<div class="[prefix]evidence-block">
  <div class="[prefix]evidence-grid">
    <!-- Exactly 5 cards -->
    <div class="[prefix]evidence-card">
      <div class="[prefix]evidence-value">VALUE</div>
      <div class="[prefix]evidence-label">Label</div>
      <div class="[prefix]evidence-sub">Sub-label</div>
    </div>
    <!-- ... 4 more cards -->
  </div>
  <div class="[prefix]evidence-source">Sources: citation text</div>
</div>
```

**Rules**:
- Always 5 stat cards
- Values should be impactful numbers from the article
- Source attribution line required
- Theme-colored left border + gradient background
- Mobile: 2-column grid on `<600px`

### 3.3 CTA Block
**Position**: After abstract/TL;DR, before Section 2

```html
<div class="[prefix]cta-block">
  <div class="[prefix]cta-headline">Action-Oriented Headline</div>
  <div class="[prefix]cta-subtitle">Descriptive subtitle</div>
  <a href="#calculator-section" class="[prefix]cta-btn">
    <i class="fas fa-calculator"></i> Open Calculator
  </a>
</div>
```

### 3.4 TOC Calculator Highlight
```html
<a href="#calc" class="toc-item toc-calculator">
  <div class="toc-item-number">
    SECTION N <span class="toc-calc-badge">Interactive <i class="fas fa-calculator"></i></span>
  </div>
  <div class="toc-item-title">Calculator Title</div>
</a>
```

### 3.5 Toolbar Row
**Position**: Inside calculator section, before input grid

```html
<div class="[prefix]toolbar">
  <div class="[prefix]mode-bar">
    <button class="[prefix]toolbar-btn [prefix]btn-free active" onclick="setMode('free')">
      <i class="fas fa-chart-bar"></i> Free Assessment
    </button>
    <button class="[prefix]toolbar-btn [prefix]btn-pro" onclick="setMode('pro')">
      <i class="fas fa-crown"></i> Pro Analysis
    </button>
  </div>
  <div class="[prefix]toolbar-actions">
    <button class="[prefix]btn-reset" onclick="resetDefaults()">
      <i class="fas fa-undo"></i> Reset
    </button>
    <button class="[prefix]btn-pdf" onclick="exportPDF()">
      <i class="fas fa-file-pdf"></i> Export PDF
    </button>
  </div>
</div>
```

**Rules**:
- Free button active by default
- Pro button triggers auth check — if not logged in, show login modal
- Reset returns all inputs to defaults and dispatches `input` event
- Export PDF disabled until Pro mode active (or generates free report)
- Wraps on mobile `<600px`

### 3.6 Calculator Input Tooltips
**EVERY calculator input MUST have a tooltip.**

```html
<label class="calc-label">
  Input Name
  <span class="tooltip-trigger">?
    <span class="tooltip-content">
      <div class="tooltip-title">Input Name</div>
      <div class="tooltip-desc">What this input means and why it matters.</div>
      <div class="tooltip-formula">Benchmark: typical value or formula</div>
    </span>
  </span>
</label>
```

**Tooltip CSS** (use theme color for accent):
```css
.tooltip-trigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(THEME_RGB, 0.15); color: THEME_COLOR;
  font-size: 0.65rem; font-weight: 700; cursor: help;
  margin-left: 6px; vertical-align: middle; position: relative;
}
.tooltip-content {
  display: none; position: fixed; width: 280px;
  background: #1e293b; border: 1px solid rgba(THEME_RGB, 0.3);
  border-radius: 10px; padding: 14px; z-index: 9999;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4); pointer-events: none;
}
.tooltip-title { font-size: 0.82rem; font-weight: 700; color: THEME_COLOR; margin-bottom: 6px; }
.tooltip-desc { font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin-bottom: 8px; }
.tooltip-formula { font-size: 0.72rem; color: #94a3b8; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-style: italic; }
```

**Tooltip JS positioning** (required for all articles):
```js
document.querySelectorAll('.tooltip-trigger').forEach(function(trigger) {
  trigger.addEventListener('mouseenter', function() {
    var content = this.querySelector('.tooltip-content');
    if (!content) return;
    content.style.display = 'block';
    var rect = this.getBoundingClientRect();
    var cRect = content.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left - cRect.width/2 + rect.width/2;
    if (left < 8) left = 8;
    if (left + cRect.width > window.innerWidth - 8) left = window.innerWidth - cRect.width - 8;
    if (top + cRect.height > window.innerHeight - 8) top = rect.top - cRect.height - 8;
    content.style.top = top + 'px';
    content.style.left = left + 'px';
  });
  trigger.addEventListener('mouseleave', function() {
    var content = this.querySelector('.tooltip-content');
    if (content) content.style.display = 'none';
  });
});
```

### 3.7 Pro Panels (4-5 panels minimum)
```html
<div id="[prefix]ProPanels" style="display:none;">
  <div class="[prefix]pro-panel gated" id="[prefix]Panel1">
    <div class="panel-title"><i class="fas fa-icon"></i> Panel Title</div>
    <div class="[prefix]kpi-grid">
      <!-- 4-6 KPI cards per panel -->
      <div class="[prefix]kpi-card">
        <div class="[prefix]kpi-value" id="proKpiId">--</div>
        <div class="[prefix]kpi-label">Label</div>
      </div>
    </div>
    <!-- Canvas chart (when applicable) -->
    <canvas id="chartId" width="800" height="280" style="width:100%;margin:1rem 0;display:block;"></canvas>
    <!-- Narrative box (when applicable) -->
    <div class="[prefix]narrative" id="narrativeId"></div>
    <!-- Gate overlay -->
    <div class="[prefix]gate-overlay" onclick="showLogin()">
      <i class="fas fa-lock"></i><span>Unlock Pro Analysis</span>
    </div>
  </div>
</div>
```

**Rules**:
- Each panel: gated class + blur + gate-overlay with lock icon
- Gate overlay `onclick` triggers login modal
- Container `display:none` by default
- Panels shown only in Pro mode after authentication
- MUST include deep analytics (see Section 4)

### 3.8 Login Modal
```html
<div class="[prefix]login-overlay" id="[prefix]LoginOverlay">
  <div class="[prefix]login-box">
    <button class="[prefix]login-close" onclick="hideLogin()">&times;</button>
    <h3><i class="fas fa-lock" style="color:THEME_COLOR;"></i> Pro Analysis</h3>
    <p>Description of what Pro unlocks.</p>
    <input type="email" id="[prefix]LoginEmail" placeholder="Email address">
    <input type="password" id="[prefix]LoginPass" placeholder="Password">
    <button class="[prefix]login-submit" onclick="handleLogin()">Unlock Pro Analysis</button>
    <div class="[prefix]login-error" id="[prefix]LoginError">Invalid credentials.</div>
    <div class="[prefix]login-demo">
      Demo: <code>demo@resistancezero.com</code> / <code>demo2026</code>
    </div>
  </div>
</div>
```

**Auth Convention**:
- localStorage key: `rz_premium_session`
- Format: `{ email, tier: 'pro', expires: ISO }`
- Demo: `demo@resistancezero.com` / `demo2026`
- Session: 30 days from login
- Custom event: `rz-auth-change` (dispatched after login/logout)
- auth.js listens for `rz-auth-change` to update navbar

### 3.9 Privacy Badge + Benchmark Meta
```html
<div class="[prefix]privacy-badge">
  <i class="fas fa-shield-halved"></i> PDF generated in your browser — no data is sent to any server
</div>
<div class="[prefix]benchmark-meta">
  <span class="[prefix]benchmark-tag"><i class="fas fa-code-branch"></i> Model v1.0</span>
  <span class="[prefix]benchmark-tag"><i class="fas fa-calendar"></i> Updated Feb 2026</span>
  <span class="[prefix]benchmark-tag"><i class="fas fa-book"></i> Sources: [relevant sources]</span>
  <span class="[prefix]benchmark-tag"><i class="fas fa-info-circle"></i> [model description]</span>
</div>
```

---

## 4. Pro Mode JavaScript — Depth Requirements

### 4.1 MINIMUM Analytics Engine
Every Pro Mode MUST include ALL of the following:

| Component | Requirement | Iterations |
|-----------|-------------|------------|
| **Monte Carlo Simulation** | Vary inputs ±15-20%, calculate distribution | 10,000 |
| **Sensitivity / Tornado** | Which input has most impact on output | All inputs |
| **Dynamic Narrative** | 3-4 paragraph executive assessment | Conditional |
| **Canvas Charts** | Radar + Histogram minimum | DPR-aware |
| **SVG Charts in PDF** | Embedded SVG, not screenshots | Required |

### 4.2 Monte Carlo Pattern
```js
function runMonteCarlo(baseInputs) {
  var N = 10000;
  var results = [];
  for (var i = 0; i < N; i++) {
    var varied = {};
    // Vary each input ±15% (uniform random)
    for (var key in baseInputs) {
      var v = baseInputs[key];
      varied[key] = v * (0.85 + Math.random() * 0.30);
    }
    // Calculate score with varied inputs
    var score = calculateScore(varied);
    results.push(score);
  }
  results.sort(function(a,b) { return a - b; });
  return {
    scores: results,
    mean: results.reduce(function(a,b){return a+b;},0) / N,
    p5: results[Math.floor(N * 0.05)],
    p25: results[Math.floor(N * 0.25)],
    p50: results[Math.floor(N * 0.50)],
    p75: results[Math.floor(N * 0.75)],
    p95: results[Math.floor(N * 0.95)],
    stdDev: /* calculate */,
    min: results[0],
    max: results[N-1]
  };
}
```

### 4.3 Sensitivity Tornado Pattern
```js
function runSensitivity(baseInputs, baseScore) {
  var results = [];
  var keys = Object.keys(baseInputs);
  keys.forEach(function(key) {
    var low = Object.assign({}, baseInputs);
    var high = Object.assign({}, baseInputs);
    low[key] = baseInputs[key] * 0.8;   // -20%
    high[key] = baseInputs[key] * 1.2;  // +20%
    var scoreLow = calculateScore(low);
    var scoreHigh = calculateScore(high);
    results.push({
      name: key,
      low: scoreLow,
      high: scoreHigh,
      range: Math.abs(scoreHigh - scoreLow)
    });
  });
  results.sort(function(a,b) { return b.range - a.range; });
  return results;
}
```

### 4.4 Narrative Generator Pattern
```js
function generateNarrative(inputs, score, grade) {
  var html = '';
  // Paragraph 1: Current State
  html += '<p><strong>Current Assessment:</strong> Your facility scores ' + score +
    '/100 (' + grade + '), placing it in the ' + getPercentile(score) + ' percentile...</p>';
  // Paragraph 2: Risk/Financial Impact
  html += '<p><strong>Risk Implications:</strong> ...' + getConditionalRisk(inputs) + '</p>';
  // Paragraph 3: Recommendations
  html += '<p><strong>Strategic Recommendations:</strong> ...' + getPrioritizedActions(inputs) + '</p>';
  // Paragraph 4: Benchmark Comparison
  html += '<p><strong>Industry Benchmark:</strong> ...' + getBenchmarkComparison(score) + '</p>';
  return html;
}
```

### 4.5 Auth Integration Pattern
```js
// Check session on load
var session = JSON.parse(localStorage.getItem('rz_premium_session') || 'null');
var isPremium = session && new Date(session.expires) > new Date();

// Listen for auth changes
window.addEventListener('rz-auth-change', function(e) {
  isPremium = true;
  unlockPanels();
  if (mode === 'pro') updateProPanels();
});

// After successful login in article's own modal
localStorage.setItem('rz_premium_session', JSON.stringify({
  email: email, tier: 'pro',
  expires: new Date(Date.now() + 30*86400000).toISOString()
}));
window.dispatchEvent(new CustomEvent('rz-auth-change', {
  detail: { email: email, tier: 'pro', action: 'login' }
}));
```

### 4.6 Input Event Hooks
ALL calculator inputs MUST trigger Pro panel recalculation:
```js
var calcInputs = document.querySelectorAll('.calc-input, .calc-select, .calc-slider');
calcInputs.forEach(function(el) {
  el.addEventListener('input', function() {
    if (isPremium && mode === 'pro') updateProPanels();
  });
  el.addEventListener('change', function() {
    if (isPremium && mode === 'pro') updateProPanels();
  });
});
```

---

## 5. PDF Export — Quality Standard

### 5.1 Color Palette (MANDATORY)
| Element | Color | Note |
|---------|-------|------|
| Body text | `#1f2937` | Dark charcoal — NEVER use light gray |
| Headings | `#1e3a5f` | Navy blue |
| Section dividers | Theme accent | Article-specific |
| Table headers | `#f8fafc` bg | Light gray background |
| Table borders | `#e5e7eb` | Subtle gray |
| Accent badges | Theme color | For grades, scores |

### 5.2 Required Sections
1. **Header** — Title, date, ResistanceZero branding
2. **Executive Score** — Large number + grade + color badge
3. **Input Parameters Table** — All calculator inputs
4. **Results Table** — All calculated outputs
5. **SVG Charts** — Minimum: radar/bar + histogram (if Pro)
6. **Narrative Section** — Dynamic assessment paragraphs
7. **Recommendations** — Prioritized action items with badges
8. **Pro Analysis** (if unlocked) — Monte Carlo stats, sensitivity table
9. **Methodology Note** — Academic references, model description
10. **Footer** — `resistancezero.com | Generated [date] | Client-side calculations`

### 5.3 SVG Chart Pattern for PDF
```js
function generateSVGBar(data, width, height, color) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'">';
  var barW = (width - 40) / data.length - 4;
  var maxVal = Math.max.apply(null, data.map(function(d){return d.value;}));
  data.forEach(function(d, i) {
    var h = (d.value / maxVal) * (height - 40);
    var x = 20 + i * (barW + 4);
    var y = height - 20 - h;
    svg += '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h+'" fill="'+color+'" rx="3"/>';
    svg += '<text x="'+(x+barW/2)+'" y="'+(height-4)+'" text-anchor="middle" font-size="9" fill="#64748b">'+d.label+'</text>';
    svg += '<text x="'+(x+barW/2)+'" y="'+(y-4)+'" text-anchor="middle" font-size="10" font-weight="600" fill="#1f2937">'+d.value+'</text>';
  });
  svg += '</svg>';
  return svg;
}
```

### 5.4 Print CSS
```css
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 15mm; }
}
```

---

## 6. Responsive / Mobile Rules

### 6.1 Breakpoints
- `@media (max-width: 768px)` — Tablet adjustments
- `@media (max-width: 600px)` — Mobile stack

### 6.2 Mobile Behavior
| Element | Mobile Rule |
|---------|-------------|
| Evidence grid | 2-column (from 5) |
| Toolbar row | Flex wrap, full width buttons |
| KPI grid | 2-column (from 3) |
| Pro panels | Full-width stack |
| Tooltip position | Constrained to viewport |
| Canvas charts | `width: 100%`, aspect ratio maintained |

---

## 7. Dark Mode Rules

All new elements MUST include `[data-theme="dark"]` overrides:
```css
[data-theme="dark"] .evidence-block { /* darker bg, lighter text */ }
[data-theme="dark"] .gate-overlay { background: rgba(15,23,42,0.85); }
[data-theme="dark"] .login-box { background: linear-gradient(145deg, #0f172a, #1e293b); }
```

---

## 8. auth.js Integration

### 8.1 Shared Module
- File: `auth.js` (loaded via `<script src="auth.js"></script>` at page bottom)
- Auto-detects navbar type (4 variants) and injects Login/Logout buttons
- Login modal with demo credentials hint
- Listens for `rz-auth-change` to update navbar state

### 8.2 Event Flow
```
User clicks Pro Mode
  → Article checks isPremium
  → If false: show article's login modal
  → User logs in
  → localStorage set
  → dispatch 'rz-auth-change'
  → auth.js updates navbar (Login → User badge)
  → Article unlocks Pro panels
  → updateProPanels() called
```

### 8.3 Cross-Article Session
Sessions persist across all articles via `rz_premium_session` localStorage key. A user who logs in on article-4 will be auto-detected as premium when visiting article-8.

---

## 9. File Naming & Structure

```
Sandbox/
├── article-1.html through article-17.html
├── auth.js                    # Shared auth module
├── styles.css                 # Base styles
├── standarization/
│   └── PRO_MODE_STANDARDIZATION.md  (this file)
├── Data/Freemium Scheme/
│   ├── article N review after deep-research-report.md
│   └── article-N deep-research-report.md
└── SESSION_NOTES.md
```

---

## 10. Lessons Learned (Critical)

1. **NEVER make Pro panels with just KPI cards** — ALWAYS include Monte Carlo (10K), sensitivity tornado, narrative generator, and canvas charts
2. **NEVER use light gray (#94a3b8, #6b7280) for primary PDF text** — use `#1f2937` minimum
3. **ALWAYS add tooltips to calculator inputs** at the same time as Pro Mode implementation
4. **ALWAYS add Font Awesome CDN** if the article doesn't have it (needed for lock icons, calculator badges, etc.)
5. **ALWAYS test PDF export readability** — print preview should show dark text on white background
6. **ALWAYS hook Pro panel updates to ALL calculator input change events** — missed events = stale data
7. **ALWAYS include SVG charts in PDF** — tables alone are insufficient for executive reports
8. **ALWAYS dispatch `rz-auth-change`** after login so auth.js updates the navbar
9. **ALWAYS add demo credentials hint** to login modals
10. **TOC calculator badges require Font Awesome** to render the calculator icon
11. **PDF export MUST open window FIRST** — `var w = window.open('', '_blank')` must be called **immediately** in the click handler, BEFORE any computation (Monte Carlo 10K, sensitivity, etc.). Browsers block `window.open` if called after async or heavy synchronous work. Then use `w.document.write(html); w.document.close();` to render content. NEVER use the Blob URL pattern (`URL.createObjectURL` → `window.open(url)`) for PDF export.
12. **PDF export pattern**: `var w = window.open('', '_blank'); if(!w){alert('Allow popups'); return;} /* compute */ w.document.write(html); w.document.close(); setTimeout(function(){w.print();},500);`
13. **Free/Pro mode buttons MUST be separate** — use a mode-bar with two buttons (Free Assessment + Pro Analysis), not a single toggle. Active button gets distinct styling (gradient background + shadow). Include a mode indicator badge showing current mode.
14. **PDF export MUST include executive summary KPI cards** — never just tables. Use `pdf-kpi-grid` with 4 columns, `pdf-score-card` for the hero metric, and side-by-side SVG charts (`pdf-chart-row`).
15. **PDF narrative section is MANDATORY** — generate dynamic assessment paragraphs referencing actual calculated values, industry benchmarks, and financial impact. Use `pdf-narrative` with left border accent.
16. **Chart.js annotation plugin MUST be loaded separately** — If any chart config uses `plugins.annotation.annotations`, the CDN `chartjs-plugin-annotation@3.0.1` must be included AFTER `chart.umd.min.js`. Base Chart.js 4.x does NOT include annotation. Without it, annotation configs may silently fail or cause blank charts.
17. **Inline styles on dark-themed elements cause light-mode readability issues** — NEVER hardcode light text colors (`color:#cbd5e1`, `color:#64748b`) directly on HTML elements inside `.article-body`. Instead, define CSS classes with both light and dark mode variants using `[data-theme="dark"]`. Use `!important` on the class rule to override global `.article-body p`/`.article-body blockquote` rules.
18. **Self-contained dark elements MUST have dedicated CSS classes** — Components like `.operator-story`, `.aif-quote`, calculator panels that have their own dark background need CSS rules with boosted specificity (`.article-body .operator-story blockquote`) and `!important` to prevent generic `styles.css` rules from overriding their colors in either theme mode.
19. **New SVG chart types for PDF exports** — Beyond radar/histogram/tornado, these patterns are now proven: (a) **Horizontal bar chart** for criteria breakdown (e.g., ISA-18.2 score per criterion), (b) **Semicircular gauge** for utilization/load metrics with color-coded zones, (c) **Stacked horizontal bar** for distribution comparison (e.g., user's system vs benchmark split). All use inline SVG with `viewBox` for responsive sizing.

---

## 11. Quality Verification Checklist

After implementing Pro Mode on any article, verify:

- [ ] Font Awesome CDN loaded (check for lock icon rendering)
- [ ] Evidence block: 5 cards with values, labels, sub-labels
- [ ] CTA block: links to calculator section
- [ ] TOC: calculator item has `toc-calculator` class + badge
- [ ] Toolbar: Free/Pro toggle, Reset, Export PDF buttons work
- [ ] ALL calculator inputs have tooltip triggers with title/desc/formula
- [ ] Tooltips position correctly (don't overflow viewport)
- [ ] Pro mode requires login (shows modal if not authenticated)
- [ ] Login modal has demo credentials hint
- [ ] Login stores session and dispatches `rz-auth-change`
- [ ] Pro panels unlock after login (blur removed, overlay hidden)
- [ ] Monte Carlo runs 10,000 iterations
- [ ] Sensitivity tornado shows sorted impact bars
- [ ] Narrative generates dynamic text based on inputs
- [ ] Canvas charts render (radar, histogram, waterfall as applicable)
- [ ] All inputs trigger Pro panel recalculation
- [ ] Reset button restores defaults and triggers recalc
- [ ] PDF export opens with proper colors (#1f2937 body, #1e3a5f headings)
- [ ] PDF includes SVG charts
- [ ] PDF includes narrative section
- [ ] PDF includes methodology note and footer
- [ ] Mobile: toolbar wraps, evidence grid 2-col, panels stack
- [ ] Dark mode: all new elements have appropriate overrides
- [ ] Privacy badge visible below calculator
- [ ] Benchmark meta tags present

---

## 12. CSS Consistency Standards (Global)

### 12.1 Problem Statement
Each article was developed independently, resulting in inconsistent sizing for the same semantic elements. For example, `.ws-kpi-value` (art-10) was `1.3rem` while `.shi-kpi-value` (art-8) was `1.2rem`. This section defines the unified standards.

### 12.2 Standardized Values

| Element | CSS Pattern | Standard Value | Previous Range |
|---------|------------|----------------|----------------|
| Body text `<p>` | — | `0.95rem` | 0.85–1.05rem |
| H2 section headers | — | `1.5rem` | 1.3–1.8rem |
| H3 subsections | — | `1.2rem` | 1.1–1.4rem |
| KPI values | `[prefix]-kpi-value` | **`1.4rem`**, `font-weight: 800` | 1.2–1.8rem |
| KPI labels | `[prefix]-kpi-label` | **`0.72rem`** | 0.65–0.78rem |
| Calculator labels | `.calc-label` | `0.85rem` | 0.78–0.95rem |
| Panel titles | `[prefix]-panel-title` | `0.95rem`, `font-weight: 700` | 0.85–1.1rem |
| Toolbar row | `[prefix]-toolbar` | `padding: 0.75rem 1rem` | 0.75–1.5rem |
| Pro panel | `[prefix]-pro-panel` | `margin: 1.5rem 0; padding: 1.25rem` | varies |
| KPI grid | `[prefix]-kpi-grid` | `gap: 0.75rem` | 0.5–1.5rem |
| KPI card | `[prefix]-kpi-card` | `padding: 0.875rem` | 0.75–2rem |
| Evidence stat values | `[prefix]-evidence-value` | `1.8rem`, `font-weight: 800` | 1.5–2.5rem |
| TOC items | `.toc-item` | `padding: 0.625rem 1rem` | 0.5–1.25rem |
| Tooltip text | `.tooltip-desc` | `0.78rem` | 0.7–0.85rem |
| Tooltip title | `.tooltip-title` | `0.82rem` | varies |

### 12.3 Global CSS Implementation (styles.css)
Global attribute selectors were added to `styles.css` at the bottom:

```css
/* Global Pro Mode Consistency */
[class*="-pro-panel"] { margin: 1.5rem 0; padding: 1.25rem; border-radius: 12px; }
[class*="-kpi-grid"] { gap: 0.75rem; }
[class*="-kpi-card"] { padding: 0.875rem; border-radius: 10px; }
[class*="-kpi-value"] { font-size: 1.4rem !important; font-weight: 800; }
[class*="-kpi-label"] { font-size: 0.72rem; }
[class*="-toolbar-row"], [class*="-toolbar"] { padding: 0.75rem 1rem; }
[class*="-panel-title"] { font-size: 0.95rem; margin-bottom: 0.75rem; }
```

### 12.4 Specificity Lesson (CRITICAL)

**CSS attribute selectors `[class*="-kpi-value"]` have LOWER specificity than class selectors `.ws-kpi-value`.**

This means:
- Global `[class*="-kpi-value"] { font-size: 1.4rem; }` is **overridden** by per-article `.ws-kpi-value { font-size: 1.3rem; }`
- To enforce global values, you must EITHER:
  1. **Use `!important`** on the global rule (used for kpi-value), OR
  2. **Edit each article's `<style>` block** individually to match the standard
- Best practice: **Do both** — add `!important` to global CSS as safety net, AND update per-article CSS to match for clarity

### 12.5 Articles Updated (Per-Article CSS Fixes)
| Article | Changes Made |
|---------|-------------|
| 1 | `.pro-panel-title` margin-bottom 1rem→0.75rem |
| 2 | `.pro-panel-title` font-size 0.8→0.95rem, margin-bottom 1rem→0.75rem |
| 3 | `.pro-panel-title` font-size .8→.95rem, margin-bottom 1rem→.75rem |
| 4 | `.pro-panel-title` font-size 0.8→0.95rem, margin-bottom 1rem→0.75rem, `.calc-result-value` 1.35→1.4rem |
| 5 | `.pro-panel-title` font-size 0.9→0.95rem, margin-bottom 1rem→0.75rem, `.pro-panel-inner` padding 1.5→1.25rem |
| 6 | `.rca-kpi-value` 1.3→1.4rem, `.rca-kpi-label` 0.7→0.72rem, `.panel-title` margin-bottom 1rem→0.75rem |
| 7 | `.res-kpi-value` 1.3→1.4rem, `.res-kpi-label` 0.7→0.72rem, `.panel-title` margin-bottom 1rem→0.75rem |
| 8 | `.shi-kpi-value` 1.2→1.4rem, `.shi-panel-title` font-size 1rem→0.95rem, margin-bottom 1rem→0.75rem |
| 9 | `.hvac-kpi-value` 1.2→1.4rem, `.hvac-panel-title` font-size 1rem→0.95rem, margin-bottom 1rem→0.75rem |
| 10 | `.ws-kpi-value` 1.3→1.4rem, `.ws-kpi-label` 0.7→0.72rem, `.panel-title` margin-bottom 1rem→0.75rem |
| 11 | `.eeq-kpi-value` 1.3→1.4rem, `.eeq-kpi-label` 0.7→0.72rem, `.panel-title` margin-bottom 1rem→0.75rem |
| 12 | `.opm-panel-title` font-size 1rem→0.95rem, margin-bottom 1rem→0.75rem |
| 13 | `.aig-kpi-value` 1.3→1.4rem, `.aig-kpi-label` 0.7→0.72rem, `.panel-title` margin-bottom 1rem→0.75rem |
| 14 | `.msf-panel-title` margin-bottom 1rem→0.75rem |
| 15 | `.mcl-panel-title` margin-bottom 1rem→0.75rem |

---

*Document maintained by the ResistanceZero development team.*
*For questions, refer to `C:\Users\User\.claude\projects\C--Users-User\memory\pro-mode-checklist.md`*
