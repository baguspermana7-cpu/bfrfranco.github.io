# CALCULATOR-WORKFLOW.md
# Calculator Creation and Update Checklist

---

## Two Calculator Types

### Type A: Standalone Calculator Page
File: `[topic]-calculator.html` at root level
Examples: pue-calculator.html, capex-calculator.html, opex-calculator.html, roi-calculator.html, tco-calculator.html, cx-calculator.html

### Type B: Embedded Calculator (in Article)
Embedded inside article-N.html, asean-dc-report-2026.html, rfs-readiness-workbench.html, etc.

---

## Type A: Standalone Calculator Checklist

### Structure
```html
<!-- REQUIRED elements for standalone calculator: -->
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <!-- FOUC prevention: set theme from localStorage before anything renders -->
  <script>(function(){var t=localStorage.getItem('theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);})();</script>

  <!-- SEO meta, styles, fonts... -->
</head>
<body>
  <!-- FOUC prevention inline script at TOP of body -->
  <script>(function(){var t=localStorage.getItem('theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);})();</script>

  <!-- Navbar with .nav-links class (NOT .nav-menu) -->
  <nav class="navbar">
    <div class="nav-container">
      <a href="../index.html" class="nav-logo">...</a>
      <ul class="nav-links">
        <li><a href="../index.html">Home</a></li>
        <li><a href="../articles.html">Articles</a></li>
        <!-- minimal links -->
      </ul>
      <!-- Dark mode toggle REQUIRED -->
      <button class="nav-theme-btn" id="navThemeBtn" onclick="toggleCalcTheme()" title="Toggle dark mode">
        <i id="themeIcon" class="fas fa-moon"></i>
      </button>
    </div>
  </nav>

  <!-- Calculator HTML: inputs, KPI cards, results -->
  <div class="calc-container">
    <!-- inputs -->
    <!-- output KPI cards (4-6 cards recommended) -->
    <!-- calculate button -->
    <!-- results section -->
    <!-- disclaimer (REQUIRED) -->
  </div>

  <!-- Calculator IIFE JS (AFTER HTML) -->
  <script>
  (function() {
    'use strict';

    function toggleCalcTheme() {
      var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      var icon = document.getElementById('themeIcon');
      if (icon) icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    window.toggleCalcTheme = toggleCalcTheme;

    // Calculator logic
    function calculate() { ... }
    window.calculate = calculate;

    // Initialize on load
    (function init() {
      var t = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t);
      var icon = document.getElementById('themeIcon');
      if (icon) icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    })();
  })();
  </script>

  <script src="script.min.js"></script>
  <script src="auth.min.js"></script>
</body>
</html>
```

### Dark Mode Requirements (Standalone)
- Default: dark mode (`localStorage.getItem('theme') || 'dark'`)
- Toggle button: `.nav-theme-btn` with moon → sun icon swap
- Function: `toggleCalcTheme()` exposed to `window`
- CSS must include `[data-theme="dark"]` overrides for:
  - body background
  - navbar
  - input fields and dropdowns
  - KPI card backgrounds
  - cookie banner
  - footer

### Post-Creation Steps
```
[ ] Add to sitemap.xml
[ ] Add to search-index.json
[ ] Add to main calculators section (if listed on index.html or articles.html)
[ ] Test dark mode toggle works
[ ] Test calculate function with edge cases
[ ] Add disclaimer section
[ ] git commit + push
```

---

## Type B: Embedded Calculator Checklist

### Placement in Article
```html
<!-- INSIDE <article> tag, after section-7 -->
<section id="calculator" class="article-section">
  <h2>Interactive [Topic] Calculator</h2>

  <div class="calc-wrapper">
    <!-- Inputs grid -->
    <div class="calc-inputs">
      <div class="input-group">
        <label>...</label>
        <input type="number" id="inputId" value="..." min="..." max="...">
      </div>
    </div>

    <!-- Calculate button -->
    <button onclick="calculateTopic()" class="calc-btn">Calculate</button>

    <!-- KPI output cards (4-6 cards) -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value" id="kpiOutput1">--</div>
        <div class="kpi-label">Metric Name</div>
      </div>
    </div>

    <!-- Disclaimer -->
    <p class="calc-disclaimer">
      This calculator provides estimates for planning purposes only...
    </p>
  </div>
</section>

<!-- IIFE JS placed BEFORE </body>, AFTER all HTML -->
<script>
(function() {
  'use strict';
  function calculateTopic() {
    // logic here
  }
  window.calculateTopic = calculateTopic;
})();
</script>
```

### NEVER Do This
```javascript
// WRONG: JS inside article content string
var html = '<script>function calc() {}</script>'; // Breaks everything

// WRONG: Global variables
var globalData = {}; // Pollutes window, causes conflicts

// WRONG: Scripts before calculator HTML
<script>...</script>
<div id="calculator">...</div>  // Elements don't exist yet
```

---

## Calculator Data Accuracy Rules

From past lessons learned:

1. **Salary benchmarks**: Use mid-level DC ops (not senior/all-roles). Verify via Glassdoor, PayScale, SalaryExpert
2. **Projection models**: Year-over-year flow, NOT cumulative subtraction. Available headcount should NEVER drop to 0. Include replacement hiring, training pipeline, floor at 30% of initial
3. **Evidence stats**: Cross-check against LATEST report version (e.g., Uptime 2025 says 65%, not 58%)
4. **Country/region change**: Auto-set ALL related fields (salary, turnover, training budget, power cost)
5. **KPI cards**: Include domain-specific metrics (Cost per MW, Time to Fill, Cost per Token). 4-6 cards, not just 4

---

## Maintenance: Updating Calculator Data

When industry reports update:
1. Find all calculators referencing the updated data
2. Update default values AND range limits in input fields
3. Update any hardcoded benchmark text in the UI
4. Update the "based on [report]" citation text
5. Test edge cases (min/max values, 0 inputs)
6. git commit with `fix: update [calc name] to [report year] benchmarks`
