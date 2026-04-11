# create-calculator.md
# Paste this at the start of a new session to build a calculator
# Modify [PLACEHOLDERS] before pasting

---

## Session Context

I need to build a new calculator for resistancezero.com. Start by reading:
1. Read `/home/baguspermana7/rz-work/tools/Auto Update All/AGENT-GUIDE.md`
2. Read `/home/baguspermana7/rz-work/standarization/CALCULATOR_PROMPT_STANDARD.md`
3. Read an existing calculator for reference: `pue-calculator.html`

Then build:

**Calculator type**: [STANDALONE page | EMBEDDED in article-N]
**Topic**: [calculator topic]
**File name**: [topic-calculator.html]
**Inputs**: [list the 4-8 inputs with default values and units]
**Outputs/KPIs**: [list 4-6 KPI cards with metric names]
**Primary calculation**: [what the main formula computes]

**Requirements:**
- Standalone: dark mode toggle (default dark), `.nav-links` navbar
- IIFE pattern for all JavaScript
- Scripts placed AFTER HTML divs
- Disclaimer section required
- Add to sitemap.xml and search-index.json after creating
- Data accuracy: verify all benchmark defaults against [specify source]

**After building:**
1. Add entry to sitemap.xml
2. Add entry to search-index.json (next available id)
3. Test dark mode toggle works correctly
4. git commit + push

---

## Calculator Checklist (quick reference from CALCULATOR-WORKFLOW.md)

```
[ ] FOUC prevention inline script at top of <body>
[ ] Default dark: localStorage.getItem('theme') || 'dark'
[ ] toggleCalcTheme() function exposed to window
[ ] .nav-links navbar (NOT .nav-menu)
[ ] IIFE wrapping all calculator logic
[ ] Scripts AFTER HTML elements (not before)
[ ] 4-6 KPI output cards
[ ] Disclaimer section
[ ] sitemap.xml entry
[ ] search-index.json entry
[ ] Dark mode CSS overrides (body, navbar, inputs, KPI cards)
```
