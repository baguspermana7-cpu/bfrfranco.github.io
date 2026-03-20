# Calculator Prompt Standard — ResistanceZero

> **Version**: 1.0 | **Last Updated**: 2026-03-20 | **Status**: Active
> **Purpose**: Reusable prompt template to request new article calculators with consistent architecture.
> **Applies to**: All articles with interactive calculators — Future Forward, Engineering Journal, Global Analysis, and any standalone calculator pages.

---

## How to Use This Document

When requesting a new calculator (for a new article or standalone page), paste the relevant sections below into the prompt. Replace bracketed placeholders (`[LIKE THIS]`) with article-specific values before sending.

---

## 1. Overview

Every article calculator on ResistanceZero follows a **unified architecture** documented in `PRO_MODE_STANDARDIZATION.md`, `PDF_EXPORT_STANDARD.md`, `AUTH_STANDARD.md`, and `TOOLTIP_STANDARD.md`. This document is the master prompt reference that consolidates all requirements into one place.

**Cross-reference files (read before implementing):**
- `standarization/PRO_MODE_STANDARDIZATION.md` — full component HTML patterns, auth JS, CSS consistency
- `standarization/PDF_EXPORT_STANDARD.md` — PDF color palette, SVG chart types, white-space rules
- `standarization/AUTH_STANDARD.md` — credentials, session format, event system, anti-patterns
- `standarization/TOOLTIP_STANDARD.md` — tooltip CSS, JS positioning, content rules

---

## 2. Article Context Block

> Copy and fill in before every new calculator request.

```
Article title:      [Full article title]
Series:             [Future Forward | Engineering Journal | Global Analysis]
Theme color:        [hex, e.g. #a855f7 for violet]
Theme color RGB:    [e.g. 168, 85, 247]
CSS prefix:         [e.g. ff1- or tgs- or hfx-]
File name:          [e.g. future-forward-1.html]
Calculator title:   [e.g. "AI Search Impact Estimator"]
Calculator focus:   [one-sentence description of what it calculates]
Domain/topic:       [e.g. web traffic, energy cost, workforce, infrastructure]
Country data:       [Yes / No — does it need a country/region selector?]
Benchmark sources:  [cite 2-3 sources that inform default values]
```

---

## 3. Calculator Architecture

### 3.1 Free Mode (always available, no auth required)

- **Minimum 6–8 input fields**, each with a tooltip (see Section 5)
- **4 result metric cards** — dark gradient background (`#1e293b`), accent-colored values, muted labels
- **Dynamic narrative block** — 2–3 sentences that update on every input change, referencing actual calculated values
- No login gate

### 3.2 Pro Mode (gated behind authentication)

- **4–6 additional Pro inputs** shown only when Pro is active
- **4 Pro panels**, each with a gate overlay (lock icon + "Unlock Pro Analysis") before login
- Pro inputs and panels are hidden by default (`display:none`), revealed after successful login
- Panels use Canvas charts (Chart.js) for interactive display; SVG for PDF export

---

## 4. Standard Pro Panels

Every calculator MUST include these 4 panels in this order.

---

### Panel 1: Monte Carlo Risk Distribution

**Purpose**: Quantify output uncertainty given input variability.

- Run **N = 10,000 iterations** minimum
- Use **Box-Muller normal distribution** for input perturbation (preferred) OR uniform ±15% random
- Default variance: **±15% on primary numeric variables**
- Sort results and extract: P5, P25, P50, P75, P95 percentiles
- **KPI cards**: P5 (pessimistic), P50 (median), P95 (optimistic) — labeled clearly
- **Chart.js histogram**: 30 bins across the result range, color zones (green/amber/red), dashed vertical lines at P5/P50/P95
- Chart height: 240px minimum

```js
// Monte Carlo pattern
function runMonteCarlo(baseInputs) {
  var N = 10000;
  var results = [];
  for (var i = 0; i < N; i++) {
    // Box-Muller normal distribution
    var u1 = Math.random(), u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    var varied = {};
    for (var key in baseInputs) {
      varied[key] = baseInputs[key] * (1 + z * 0.15);
      if (varied[key] < 0) varied[key] = 0;
    }
    results.push(calculatePrimaryMetric(varied));
  }
  results.sort(function(a, b) { return a - b; });
  return {
    scores: results,
    p5:  results[Math.floor(N * 0.05)],
    p25: results[Math.floor(N * 0.25)],
    p50: results[Math.floor(N * 0.50)],
    p75: results[Math.floor(N * 0.75)],
    p95: results[Math.floor(N * 0.95)],
    mean: results.reduce(function(a, b) { return a + b; }, 0) / N
  };
}
```

---

### Panel 2: Multi-Period Projection

**Purpose**: Show how key metrics evolve year-by-year (or month-by-month) over a forecast horizon.

- **Minimum 3 data series** (e.g., baseline / optimistic / pessimistic, or demand / supply / gap)
- **Forecast horizon**: 5–10 years typical (or 12–36 months for shorter-term analyses)
- **Chart.js line or area chart** with filled areas, legend, year labels on x-axis
- **KPI cards**: call out key milestone years or thresholds (e.g., "Breakeven: 2029")
- Y-axis units must match the primary metric (e.g., %, USD M, MW, etc.)

---

### Panel 3: Sensitivity Tornado Chart

**Purpose**: Rank which inputs drive the most variance in the output.

- Test **5–8 input variables** at ±20% from their current values (one at a time)
- Compute delta from the base-case result for each variable, low and high
- Sort results by **absolute impact** (largest at top — highest sensitivity)
- **Chart.js horizontal bar chart** (`indexAxis: 'y'`)
  - Left side (negative delta): red tones (`#ef4444`)
  - Right side (positive delta): green tones (`#10b981`)
  - Center baseline vertical dashed line
- Show delta values at bar ends (formatted with units)

```js
// Sensitivity tornado pattern
function runSensitivity(baseInputs, baseResult) {
  var results = [];
  Object.keys(baseInputs).forEach(function(key) {
    var low  = Object.assign({}, baseInputs);
    var high = Object.assign({}, baseInputs);
    low[key]  = baseInputs[key] * 0.80;
    high[key] = baseInputs[key] * 1.20;
    results.push({
      name:  key,
      low:   calculatePrimaryMetric(low)  - baseResult,
      high:  calculatePrimaryMetric(high) - baseResult,
      range: Math.abs(calculatePrimaryMetric(high) - calculatePrimaryMetric(low))
    });
  });
  results.sort(function(a, b) { return b.range - a.range; });
  return results;
}
```

---

### Panel 4: Strategic Narrative and Roadmap

**Purpose**: Translate numbers into executive-readable guidance.

- **3–4 dynamically generated paragraphs**, updating on every input change
- Must reference **actual calculated values** (never generic placeholder text)
- Use **branched logic** for at least 3 risk/outcome tiers (e.g., high / medium / low risk, or leading / average / lagging)
- Include **specific, actionable recommendations** relevant to the calculator domain
- Use **priority badges** (P1-Critical, P2-High, P3-Medium) or severity indicators
- Optional: 3–5 step roadmap timeline with phase labels and milestones

```js
// Narrative generator pattern
function generateNarrative(inputs, result, tier) {
  var html = '';
  // Para 1: Current state with specific numbers
  html += '<p><strong>Current Position:</strong> Based on your inputs, [primary metric] is [value]...';
  // Para 2: Risk or financial implication
  if (tier === 'high') {
    html += '<p><strong>Risk Implication:</strong> This places your [domain] in the high-risk zone...';
  } else if (tier === 'medium') {
    html += '<p><strong>Risk Implication:</strong> Performance is within acceptable range, however...';
  } else {
    html += '<p><strong>Risk Implication:</strong> Your [domain] is performing above benchmark...';
  }
  // Para 3: Prioritized actions
  html += '<p><strong>Recommended Actions:</strong>...';
  // Para 4: Benchmark comparison
  html += '<p><strong>Benchmark Context:</strong>...';
  return html;
}
```

---

## 5. Input Specifications

### 5.1 Every Input MUST Have a Tooltip

```html
<label class="calc-label">
  [Input Name]
  <span class="[prefix]tooltip-trigger">?
    <span class="[prefix]tooltip-content">
      <div class="[prefix]tooltip-title">[Input Name]</div>
      <div class="[prefix]tooltip-desc">[1–2 sentences: what this means and why it matters.]</div>
      <div class="[prefix]tooltip-formula">[Benchmark range or formula, e.g. "Typical range: 40–80%"]</div>
    </span>
  </span>
</label>
```

- `tooltip-title`: bold, accent color
- `tooltip-desc`: 1–2 sentences, muted (#cbd5e1)
- `tooltip-formula`: italic, muted (#94a3b8), separated by top border
- Positioning: viewport-aware JS (see PRO_MODE_STANDARDIZATION.md §3.6)

### 5.2 Input Types

| Type | HTML element | Use for |
|------|-------------|---------|
| Number | `<input type="number">` | Quantities, costs, rates |
| Select | `<select>` | Country, tier, scenario, category |
| Range/Slider | `<input type="range">` | Percentages, confidence levels, weights |

### 5.3 Event Hooks

ALL inputs fire recalculation on both `input` and `change`:

```js
document.querySelectorAll('.calc-input, .calc-select, .calc-slider').forEach(function(el) {
  el.addEventListener('input',  calculate);
  el.addEventListener('change', calculate);
});
```

If Pro mode is active, `calculate()` also calls `updateProPanels()`.

---

## 6. Auth Integration

Follow `AUTH_STANDARD.md` exactly.

### 6.1 Valid Credentials (NEVER deviate from this list)

| Email | Password | Tier |
|-------|----------|------|
| `demo@resistancezero.com` | `demo2026` | pro |
| `bagus@resistancezero.com` | `RZ@Premium2026!` | pro |
| `admin@resistancezero.com` | `RZ@Premium2026!` | pro |

### 6.2 Session Format

```json
{
  "email": "demo@resistancezero.com",
  "tier": "pro",
  "expires": "2026-04-19T00:00:00.000Z"
}
```

- localStorage key: `rz_premium_session`
- Expiry: 30 days from login
- Null / missing / expired = unauthenticated

### 6.3 Login Handler (required pattern)

```js
function handleLogin() {
  var email = document.getElementById('[prefix]LoginEmail').value.trim();
  var pass  = document.getElementById('[prefix]LoginPass').value;

  var VALID = [
    { email: 'demo@resistancezero.com',  password: 'demo2026' },
    { email: 'bagus@resistancezero.com',  password: 'RZ@Premium2026!' },
    { email: 'admin@resistancezero.com', password: 'RZ@Premium2026!' }
  ];
  var found = VALID.some(function(u) {
    return u.email.toLowerCase() === email.toLowerCase() && u.password === pass;
  });

  if (found) {
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: email, tier: 'pro',
      expires: new Date(Date.now() + 30 * 86400000).toISOString()
    }));
    isPremium = true;
    hideLogin();
    unlockPanels();
    setMode('pro');
    window.dispatchEvent(new CustomEvent('rz-auth-change', {
      detail: { email: email, tier: 'pro', action: 'login' }
    }));
  } else {
    document.getElementById('[prefix]LoginError').style.display = 'block';
  }
}
```

### 6.4 Session Check on Page Load

```js
var session = null;
try {
  session = JSON.parse(localStorage.getItem('rz_premium_session'));
  if (session && new Date(session.expires) < new Date()) {
    localStorage.removeItem('rz_premium_session');
    session = null;
  }
} catch(e) { session = null; }
var isPremium = !!session;
if (isPremium) { activatePremiumUI(); }  // must call setMode('pro')
```

### 6.5 Cross-Page Auth Listener

```js
window.addEventListener('rz-auth-change', function(e) {
  if (e.detail && e.detail.action === 'login') {
    isPremium = true;
    unlockPanels();
    if (mode === 'pro') updateProPanels();
  } else if (e.detail && e.detail.action === 'logout') {
    isPremium = false;
    lockPanels();
    setMode('free');
  }
});
```

### 6.6 Login Modal Required Elements

```html
<div class="[prefix]login-overlay" id="[prefix]LoginOverlay">
  <div class="[prefix]login-box" style="background:linear-gradient(145deg,#0f172a,#1e293b);">
    <button class="[prefix]login-close" onclick="hideLogin()">&times;</button>
    <h3><i class="fas fa-lock" style="color:[THEME_COLOR];"></i> Pro Analysis</h3>
    <p>Unlock [specific pro features] for this calculator.</p>
    <input type="email" id="[prefix]LoginEmail" placeholder="Email address">
    <input type="password" id="[prefix]LoginPass" placeholder="Password">
    <button class="[prefix]login-submit" onclick="handleLogin()">Unlock Pro Analysis</button>
    <div class="[prefix]login-error" id="[prefix]LoginError">Invalid credentials.</div>
    <div class="[prefix]login-demo">
      Demo: <code>demo@resistancezero.com</code> / <code>demo2026</code>
    </div>
    <div style="text-align:center;margin-top:10px;font-size:0.68rem;color:#475569;line-height:1.5;">
      By signing in, you agree to our
      <a href="terms.html" style="color:[THEME_COLOR];text-decoration:none;">Terms</a> &amp;
      <a href="privacy.html" style="color:[THEME_COLOR];text-decoration:none;">Privacy Policy</a>
    </div>
  </div>
</div>
```

**CRITICAL**: Terms & Privacy link line is MANDATORY in every login modal.

---

## 7. PDF Export

Follow `PDF_EXPORT_STANDARD.md` exactly.

### 7.1 PDF Export Pattern (MANDATORY)

```js
function exportPDF() {
  // MUST open window FIRST before any computation
  var w = window.open('', '_blank');
  if (!w) { alert('Allow popups to export PDF'); return; }

  // ... compute SVG charts and content AFTER window.open() ...

  w.document.write(html);
  w.document.close();
  setTimeout(function() { w.print(); }, 500);
}
```

Never use Blob/URL.createObjectURL pattern for PDF export.

### 7.2 Free PDF Contents

| Section | Required |
|---------|---------|
| Branded header (title, date, ResistanceZero) | Yes |
| 4-card KPI summary row | Yes |
| Input parameters table (2-col key-value) | Yes |
| SVG bar or line chart | Yes |
| Dynamic narrative text | Yes |
| Recommendations with priority badges | Yes |
| Methodology note with sources | Yes |
| Footer (URL, date, client-side disclaimer) | Yes |

### 7.3 Pro PDF Adds

| Section | Required |
|---------|---------|
| Monte Carlo KPI row (P5/P50/P95) | Yes |
| SVG histogram (30 bins, color zones, percentile lines) | Yes |
| SVG projection line chart with legend | Yes |
| SVG tornado horizontal bar chart | Yes |
| Executive narrative / roadmap text | Yes |

### 7.4 PDF Color Palette

| Element | Color |
|---------|-------|
| Body text | `#1f2937` (NEVER use light gray for primary text) |
| Headings | `#1e3a5f` |
| Sub-headings | `#374151` |
| Table header bg | `#f8fafc` |
| Table borders | `#e5e7eb` |
| Footer/captions | `#94a3b8` |
| Accent/dividers | Article theme color |

### 7.5 SVG Charts for PDF

Canvas charts CANNOT be captured into a `window.open()` print popup. Use **inline SVG** for all PDF charts.

Proven SVG chart types (see PDF_EXPORT_STANDARD.md for full patterns):
- Bar chart (vertical)
- Horizontal bar chart (criteria breakdown)
- Histogram (Monte Carlo results)
- Tornado (bidirectional horizontal bars)
- Line/area chart (projection over time)
- Semicircular gauge (utilization/load)
- Stacked horizontal bar (distribution comparison)

### 7.6 White Space Rules

- Place 2 charts side-by-side using `display:flex; gap:16px` (never one chart centered alone)
- KPI grids: 3–4 columns minimum
- If KPI count is not divisible by column count, use `grid-column: span 2` on the last card
- Spacing: `h2 { margin: 16px 0 8px }`, `p { margin: 6px 0 }`, `body { padding: 20px 30px }`

---

## 8. Visualization Requirements (Interactive)

| Requirement | Rule |
|------------|------|
| Chart library | Chart.js (CDN) |
| Minimum chart height | 240px |
| DPR-aware canvas | `devicePixelRatio` scaling on all canvas draws |
| Responsiveness | Charts scale with container width via `responsive: true` |
| Dark mode | Chart colors adapt under `[data-theme="dark"]` |
| Annotation plugin | Load `chartjs-plugin-annotation@3.0.1` separately if using annotation configs |

---

## 9. CSS Conventions

### 9.1 Article-Specific Prefix

Every article uses a unique CSS prefix (2–4 characters + hyphen). This prevents class collision across articles embedded in the same page or navigation context.

**Format**: `[2-4 chars]-` (e.g., `ff1-`, `tgs-`, `hfx-`, `rfs-`)

### 9.2 Standard Class Patterns

```
[prefix]input-grid          — grid wrapper for free inputs
[prefix]input-group         — individual input + label wrapper
[prefix]results-grid        — 4-card result grid
[prefix]result-card         — individual result card
[prefix]result-value        — metric number (accent color)
[prefix]result-label        — metric label (muted)
[prefix]narrative           — dynamic narrative block
[prefix]pro-inputs          — pro input grid (hidden by default)
[prefix]pro-grid            — grid wrapper for pro inputs
[prefix]pro-panels          — container for all 4 pro panels
[prefix]pro-panel           — individual pro panel
[prefix]pro-panel-inner     — inner content of panel
[prefix]gate-overlay        — lock overlay before auth
[prefix]kpi-grid            — pro panel KPI card grid
[prefix]kpi-card            — individual KPI card
[prefix]kpi-value           — KPI number (1.4rem, font-weight:800)
[prefix]kpi-label           — KPI label (0.72rem)
[prefix]chart-container     — canvas chart wrapper
[prefix]tooltip-trigger     — ? circle trigger element
[prefix]tooltip-content     — tooltip popup box
[prefix]benchmark-meta      — bottom benchmark tag row
[prefix]benchmark-tag       — individual benchmark tag
[prefix]disclaimer          — calculator disclaimer block
[prefix]toolbar             — toolbar row (mode + actions)
[prefix]mode-bar            — Free/Pro button group
[prefix]privacy-badge       — "PDF generated in browser" notice
[prefix]login-overlay       — full-screen login modal backdrop
[prefix]login-box           — login modal content box
```

### 9.3 Standardized Sizing (from PRO_MODE_STANDARDIZATION.md §12)

| Element | Standard |
|---------|---------|
| KPI value | `1.4rem`, `font-weight: 800` |
| KPI label | `0.72rem` |
| Panel title | `0.95rem`, `font-weight: 700` |
| KPI card padding | `0.875rem` |
| KPI grid gap | `0.75rem` |
| Toolbar padding | `0.75rem 1rem` |

Global attribute selectors in `styles.css` enforce these:
```css
[class*="-kpi-value"] { font-size: 1.4rem !important; font-weight: 800; }
[class*="-kpi-label"] { font-size: 0.72rem; }
[class*="-kpi-card"]  { padding: 0.875rem; border-radius: 10px; }
[class*="-kpi-grid"]  { gap: 0.75rem; }
```

---

## 10. Calculator Section Layout

```
.calculator-section
├── Title + Subtitle
├── Toolbar Row
│   ├── Mode Bar
│   │   ├── [Free Assessment] button (active by default)
│   │   └── [Pro Analysis] button (triggers auth check)
│   ├── Actions
│   │   ├── [Reset] button → resetDefaults() + re-dispatch input event
│   │   └── [Export PDF] button → exportPDF()
│   └── Privacy Badge ("PDF generated in browser — no data sent")
├── Free Input Grid (6–8 inputs with tooltips)
├── Results Grid (4 metric cards)
├── Narrative Block (dynamic, 2–3 sentences)
├── Pro Inputs (display:none by default)
│   └── 4–6 additional inputs with tooltips
├── Pro Panels (display:none by default)
│   ├── Panel 1: Monte Carlo Risk Distribution
│   │   ├── KPI cards (P5, P50, P95)
│   │   ├── Chart.js histogram (30 bins)
│   │   └── Gate overlay (lock icon + "Unlock Pro Analysis")
│   ├── Panel 2: Multi-Period Projection
│   │   ├── KPI cards (key milestones)
│   │   ├── Chart.js line/area chart
│   │   └── Gate overlay
│   ├── Panel 3: Sensitivity Tornado
│   │   ├── KPI cards (top 3 drivers)
│   │   ├── Chart.js horizontal bar (indexAxis: 'y')
│   │   └── Gate overlay
│   └── Panel 4: Strategic Narrative & Roadmap
│       ├── Dynamic paragraphs (3–4, branched by tier)
│       ├── Priority badges (P1/P2/P3)
│       └── Gate overlay
├── Disclaimer
└── Benchmark Meta Tags
```

---

## 11. Per-Article Customization Guide

### What Varies Per Article

| Element | Notes |
|---------|-------|
| CSS prefix | 2–4 chars unique to the article |
| Theme color | Series color or article-specific accent |
| Free inputs | Domain-specific fields and defaults |
| Pro inputs | Domain-specific extended parameters |
| Calculation formulas | All logic is article-specific |
| Narrative branches | Conditional text by risk/outcome tier |
| Country/benchmark data | Regional data maps for select inputs |
| Chart labels and series | Axis titles, legend labels |
| KPI card labels | Metric names relevant to the domain |

### What Stays Fixed Across All Articles

| Element | Standard |
|---------|---------|
| 4-panel pro structure | Monte Carlo → Projection → Tornado → Roadmap |
| Monte Carlo iterations | N = 10,000 minimum |
| Sensitivity test | ±20% per variable |
| Auth credentials | Exactly the 3 accounts from Section 6.1 |
| Auth event | `rz-auth-change` CustomEvent |
| Session key | `rz_premium_session` |
| Session expiry | 30 days |
| PDF window pattern | `window.open()` FIRST, then compute, then write |
| Tooltip system | CSS + JS positioning from PRO_MODE_STANDARDIZATION.md §3.6 |
| Gate overlay pattern | Lock icon + "Unlock Pro Analysis" text |
| Privacy badge text | "PDF generated in your browser — no data is sent to any server" |
| Free/Pro as separate buttons | Never a single toggle; two distinct buttons in mode-bar |
| Pro button onclick | NEVER rebound to logout — always calls mode-switch handler |
| Responsive breakpoints | 768px (tablet), 600px (mobile stack) |
| Dark mode selector | `[data-theme="dark"]` on root element |
| auth.js loading | `<script src="auth.js?v=20260228"></script>` before `</body>` |

---

## 12. Responsive and Dark Mode Rules

### Responsive Breakpoints

```css
@media (max-width: 768px) {
  /* Tablet: KPI grid 2-col, evidence 2-col */
}
@media (max-width: 600px) {
  /* Mobile: all grids stack, toolbar wraps to 2 rows,
     pro inputs full-width, charts 100% width */
}
```

### Dark Mode

All article-specific elements must include `[data-theme="dark"]` overrides:

```css
[data-theme="dark"] .[prefix]result-card   { background: #1e293b; }
[data-theme="dark"] .[prefix]gate-overlay  { background: rgba(15,23,42,0.85); }
[data-theme="dark"] .[prefix]login-box     { background: linear-gradient(145deg,#0f172a,#1e293b); }
```

NEVER hardcode light text colors (e.g., `color:#cbd5e1`) as inline styles on elements inside `.article-body`. Use CSS classes with both light/dark variants.

---

## 13. Quality Checklist

Before declaring a calculator complete, verify every item:

### Free Mode
- [ ] All 6–8 free inputs have tooltips (title / desc / formula)
- [ ] Tooltips position correctly without viewport overflow
- [ ] All 4 result cards populate on load with default values
- [ ] Result cards update on every input change
- [ ] Narrative block updates dynamically, referencing actual calculated values
- [ ] Country or select changes trigger appropriate default value updates
- [ ] Reset button restores defaults and fires `input` event to recalculate

### Authentication
- [ ] Pro button triggers login modal if not authenticated
- [ ] Login modal has demo credentials hint
- [ ] Login modal has Terms & Privacy links with accent color
- [ ] All 3 credential sets log in successfully (demo, bagus, admin)
- [ ] Session is stored in `rz_premium_session` localStorage
- [ ] `rz-auth-change` CustomEvent dispatched after login
- [ ] Page listens for `rz-auth-change` to sync cross-page auth
- [ ] Session check on page load — auto-unlocks Pro if valid session exists
- [ ] `activatePremiumUI()` calls `setMode('pro')` (prevents "--" on load)
- [ ] Pro button onclick NEVER rebound to logout function

### Pro Mode
- [ ] Pro inputs shown after login, hidden before
- [ ] All 4 Pro panels unlock after login (gate overlay hidden, blur removed)
- [ ] Panel 1 — Monte Carlo runs 10,000 iterations without UI freeze
- [ ] Panel 1 — KPI cards show P5, P50, P95 with correct values
- [ ] Panel 1 — Histogram renders 30 bins, color zones, percentile lines
- [ ] Panel 2 — Projection chart renders minimum 3 series over 5+ periods
- [ ] Panel 2 — Milestone KPI cards are populated
- [ ] Panel 3 — Tornado tests 5–8 variables at ±20%
- [ ] Panel 3 — Bars sorted by absolute impact (largest at top)
- [ ] Panel 3 — Positive delta green, negative delta red
- [ ] Panel 4 — Narrative generates 3–4 paragraphs with branched tier logic
- [ ] Panel 4 — References actual calculated values (not placeholder text)
- [ ] Panel 4 — Priority badges or severity indicators present
- [ ] All inputs trigger Pro panel recalculation when Pro mode is active

### PDF Export
- [ ] `window.open()` called immediately on button click — BEFORE any computation
- [ ] Popup opens correctly (not blocked)
- [ ] Free PDF: header, 4 KPI cards, input table, SVG chart, narrative, recommendations, methodology, footer
- [ ] Pro PDF: adds Monte Carlo row, SVG histogram, SVG projection, SVG tornado, executive narrative
- [ ] Body text color `#1f2937` (NEVER light gray for primary text)
- [ ] Heading color `#1e3a5f`
- [ ] Charts side-by-side (2-col flex) — never single centered chart
- [ ] KPI grid 3–4 columns — no orphan single card in a row
- [ ] Input table uses 2-col key-value layout
- [ ] `print-color-adjust: exact` in `@media print`
- [ ] `@page { margin: 15mm }` set
- [ ] Footer with resistancezero.com, generation date, client-side disclaimer

### Visual and Accessibility
- [ ] Dark mode: all elements readable, no hardcoded light text
- [ ] Mobile: inputs stack, charts scale, toolbar wraps, no overflow
- [ ] Privacy badge visible below calculator
- [ ] Disclaimer block present
- [ ] Benchmark meta tags present (model version, updated date, sources)
- [ ] Font Awesome CDN loaded (required for lock icons, calculator badges)
- [ ] `auth.js?v=20260228` loaded before `</body>`
- [ ] Calculator added to `sitemap.xml` and `search-index.json`

---

## 14. Lessons Learned (Critical — Do Not Repeat)

1. **NEVER hardcode custom credentials** — always use the exact 3 accounts from Section 6.1. Custom credentials reject valid root/pro users (bug: article-22).
2. **NEVER open PDF window after computation** — `window.open()` is blocked by browsers if called after heavy synchronous work. Open first, compute second.
3. **NEVER use Canvas in PDF** — Canvas cannot be captured in a `window.open()` print popup. Always use inline SVG for PDF charts.
4. **NEVER rebind Pro button onclick to logout** — causes logout confirm dialog when user clicks Pro (bug: CAPEX/OPEX calculators, 2026-03-20).
5. **NEVER use a single toggle** for Free/Pro — use two separate buttons in a mode-bar.
6. **NEVER omit Terms & Privacy line** from login modals — both the inline modal and auth.js global modal (bug: FF-1, geo-2/3, articles 19–21).
7. **NEVER use `</script>` inside PDF template strings** — it closes the main script block. Use `'</' + 'script>'` to escape.
8. **NEVER use `#94a3b8` or `#6b7280` as primary PDF body text** — use `#1f2937`.
9. **ALWAYS dispatch AND listen for `rz-auth-change`** — both. Dispatch after login/logout; listen to sync cross-page sessions.
10. **ALWAYS call `setMode('pro')` inside `activatePremiumUI()`** — without it, Pro panels show "--" on page load when a session exists.
11. **ALWAYS load `chartjs-plugin-annotation` separately** if using annotation configs — base Chart.js 4.x does not include it.
12. **NEVER place single chart centered alone** in PDF — always pair charts side-by-side to avoid 50%+ wasted whitespace.

---

*Cross-reference: PRO_MODE_STANDARDIZATION.md | PDF_EXPORT_STANDARD.md | AUTH_STANDARD.md | TOOLTIP_STANDARD.md*
*For active article registry, see PRO_MODE_STANDARDIZATION.md §2.*
