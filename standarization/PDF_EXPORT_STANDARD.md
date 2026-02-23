# PDF Export Quality Standard — ResistanceZero

> **Version**: 1.2 | **Updated**: 2026-02-23

---

## Color Palette

| Element | HEX | RGB | Usage |
|---------|-----|-----|-------|
| Primary Text | `#1f2937` | 31, 41, 55 | Body paragraphs, table cells |
| Headings | `#1e3a5f` | 30, 58, 95 | H1, H2, section headers |
| Sub-headings | `#374151` | 55, 65, 81 | H3, labels |
| Secondary Text | `#6b7280` | 107, 114, 128 | Captions, footnotes |
| Muted Text | `#94a3b8` | 148, 163, 184 | Methodology notes only |
| Table Header BG | `#f8fafc` | 248, 250, 252 | Light gray background |
| Table Border | `#e5e7eb` | 229, 231, 235 | Row separators |
| Accent | Per article | — | Score badges, dividers |

**CRITICAL**: Never use `#94a3b8` or `#6b7280` for primary body text. Use `#1f2937`.

---

## PDF Structure Template

```
┌─────────────────────────────────────────┐
│ HEADER                                   │
│ [Title] .............. [RESISTANCEZERO]  │
│ [Date]                 [Pro Analysis]    │
│─────────────────────────────────────────│
│                                          │
│ EXECUTIVE SCORE                          │
│    ┌───────────┐                        │
│    │   85/100  │ ← Large, color-coded   │
│    │  GRADE A  │                        │
│    └───────────┘                        │
│                                          │
│─────────── ACCENT COLOR LINE ───────────│
│                                          │
│ INPUT PARAMETERS (2-col grid)            │
│ ┌────────────┬─────────┬────────┬─────┐│
│ │ Parameter  │ Value   │ Param  │ Val ││
│ ├────────────┼─────────┼────────┼─────┤│
│ │ ...        │ ...     │ ...    │ ... ││
│ └────────────┴─────────┴────────┴─────┘│
│                                          │
│ RESULTS (4-col KPI grid, 2-col min)      │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ KPI │ │ KPI │ │ KPI │ │ KPI │       │
│ └─────┘ └─────┘ └─────┘ └─────┘       │
│                                          │
│ SVG CHARTS (SIDE-BY-SIDE, 2-col)         │
│ ┌──────────────────┐ ┌────────────────┐ │
│ │  Radar/Bar Chart │ │ Histogram      │ │
│ └──────────────────┘ └────────────────┘ │
│ ┌──────────────────┐ ┌────────────────┐ │
│ │  Tornado Chart   │ │ Risk Heatmap   │ │
│ └──────────────────┘ └────────────────┘ │
│                                          │
│ NARRATIVE ASSESSMENT                     │
│ "Your facility scores 85/100, placing   │
│  it in the top 15th percentile..."      │
│                                          │
│ RECOMMENDATIONS                          │
│ [P1-Critical] Action item 1             │
│ [P2-High]     Action item 2             │
│ [P3-Medium]   Action item 3             │
│                                          │
│ PRO ANALYSIS (if unlocked)              │
│ Monte Carlo: p5=72, p50=85, p95=93     │
│ Sensitivity: Input X has 45% impact     │
│                                          │
│ METHODOLOGY                              │
│ "Model v1.0. [N]-dimension weighted     │
│  scorecard, 10,000 Monte Carlo          │
│  iterations. Sources: [references]."    │
│                                          │
│─────────────────────────────────────────│
│ resistancezero.com | Generated [date]    │
│ All calculations performed client-side   │
└─────────────────────────────────────────┘
```

---

## SVG Chart Standards

### Radar Chart (6-8 axes)
- Actual values: solid fill with 0.3 opacity
- Benchmark polygon: dashed stroke, 0.15 opacity fill
- Axis labels: `font-size: 11px`, `fill: #374151`
- Grid circles: `stroke: #e5e7eb`, `stroke-dasharray: 4,4`

### Bar/Waterfall Chart
- Bars: article theme color, `rx: 3` rounded corners
- Labels below: `font-size: 9px`, `fill: #6b7280`
- Values above: `font-size: 10px`, `font-weight: 600`, `fill: #1f2937`

### Histogram (Monte Carlo)
- 30 bins minimum
- Color zones: green (good), yellow (caution), red (critical)
- P5/P50/P95 dashed vertical lines with labels
- X-axis: score range, Y-axis: frequency

### Tornado / Sensitivity Chart
- Bidirectional horizontal bars from baseline center
- Left side: negative impact (red tones)
- Right side: positive impact (green tones)
- Bars sorted by absolute impact (largest at top)
- Baseline vertical dashed line with label
- $ values or % shown at bar ends
- Bar height: 24-28px, gap: 4px

### Horizontal Bar Chart (Criteria Breakdown)
- Used for: ISA-18.2 compliance breakdown, multi-criteria scores
- Background: full-width `#f3f4f6` bar behind colored bar
- Fill color: green (`#059669`) if passing, amber (`#f59e0b`) if marginal, red (`#ef4444`) if failing
- Labels left-aligned, values right of bar end (e.g., `18/25`)
- Summary line below (e.g., "ISA Score: 75/100 (Grade C)")
- viewBox: `320×180` typical for side-by-side, `700×180` for full-width

### Semicircular Gauge (Utilization/Load)
- Used for: cognitive load, capacity utilization, risk meters
- SVG arc paths with 3 color zones (green 0-50%, yellow 50-70%, red 70-100%)
- Zone arcs: `stroke-width:18`, `opacity:0.3` for background zones
- Active arc: full opacity, `stroke-linecap:round`
- Needle: `<line>` from center to arc edge, `stroke-width:2.5`
- Center dot: `<circle r="5">`
- Large value text at center, zone labels at 0% and 100% endpoints
- viewBox: `320×180` typical

### Stacked Horizontal Bar (Distribution Comparison)
- Used for: priority distribution (Critical/Warning/Info) vs benchmark
- Two rows: "Your System" and "Benchmark" (e.g., ISA-18.2)
- Each row: stacked segments with different colors
- Segment colors: `#ef4444` (Critical), `#f59e0b` (Warning), `#3b82f6` (Info)
- Percentage labels inside segments if width > 25px
- Legend row below with color swatches
- viewBox: `700×100` typical for full-width layout

---

## White Space Minimization Rules

**CRITICAL**: Never leave a single chart centered alone with empty space on both sides. This wastes 50%+ of printable area.

### Rule 1: Side-by-Side Charts (2-Column Layout)
When there are 2+ charts, place them side-by-side using `display: flex`:

```css
/* PDF chart row */
.pdf-chart-row {
  display: flex;
  gap: 16px;
  margin: 16px 0;
}
.pdf-chart-row > div {
  flex: 1;
  min-width: 0;  /* prevent flex overflow */
}
```

```html
<div class="pdf-chart-row">
  <div><!-- Chart 1: Radar --><svg>...</svg></div>
  <div><!-- Chart 2: Histogram --><svg>...</svg></div>
</div>
<div class="pdf-chart-row">
  <div><!-- Chart 3: Tornado --><svg>...</svg></div>
  <div><!-- Chart 4: Heatmap --><svg>...</svg></div>
</div>
```

### Rule 2: If Only 1 Chart, Add a Companion
If a section only has 1 chart, create a complementary analysis to fill the adjacent space:
- Radar chart alone → add summary KPI table beside it
- Histogram alone → add percentile breakdown table beside it
- Tornado alone → add top-3 drivers table beside it

### Rule 3: KPI Grid Layout
KPIs should use 3-4 column grids, never a single centered column:

```css
.pdf-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 12px 0;
}
.pdf-kpi-card {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}
.pdf-kpi-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e3a5f;
}
.pdf-kpi-label {
  font-size: 9px;
  color: #6b7280;
  margin-top: 4px;
}
```

### Rule 4: Input Parameters Table
Always use 2-column key-value layout (4 columns total: param|value|param|value):

```html
<table style="width:100%;">
  <tr>
    <td style="width:30%;font-weight:600;">Param 1</td>
    <td style="width:20%;">Value 1</td>
    <td style="width:30%;font-weight:600;">Param 2</td>
    <td style="width:20%;">Value 2</td>
  </tr>
</table>
```

### Rule 5: Compact Spacing
```css
/* PDF body spacing */
body { padding: 20px 30px; }     /* Not 36px+ */
h2 { margin: 16px 0 8px; }       /* Not 24px+ */
h3 { margin: 12px 0 6px; }       /* Not 16px+ */
p { margin: 6px 0; }             /* Not 12px+ */
table { margin: 8px 0; }         /* Not 16px+ */
.pdf-chart-row { margin: 12px 0; } /* Not 24px+ */
```

---

## Implementation Pattern

```js
function exportPDF() {
  var w = window.open('', '_blank');
  var html = '<!DOCTYPE html><html><head>';
  html += '<meta charset="UTF-8">';
  html += '<title>Report Title — ' + dateStr + '</title>';
  html += '<style>';
  html += '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 15mm; } }';
  html += 'body { font-family: Arial, Helvetica, sans-serif; max-width: 820px; margin: 0 auto; padding: 36px; color: #1f2937; }';
  html += 'h1, h2 { color: #1e3a5f; }';
  html += '</style></head><body>';

  // ... build content ...

  html += '<div style="text-align:center;margin-top:24px;padding-top:16px;border-top:2px solid THEME_COLOR;font-size:9px;color:#94a3b8;">';
  html += 'resistancezero.com &middot; Generated ' + dateStr + ' &middot; All calculations performed client-side';
  html += '</div>';

  html += '</body></html>';
  w.document.write(html);
  w.document.close();
  setTimeout(function() { w.print(); }, 500);
}
```

---

## Per-Article PDF Accent Colors

| Article | Accent Color | Divider Color |
|---------|-------------|---------------|
| 1 | `#3b82f6` | `#3b82f6` |
| 2 | `#ef4444` | `#ef4444` |
| 3 | `#10b981` | `#10b981` |
| 4 | `#3b82f6` | `#3b82f6` |
| 5 | `#f59e0b` | `#f59e0b` |
| 6 | `#06b6d4` | `#06b6d4` |
| 7 | `#10b981` | `#10b981` |
| 8 | `#8b5cf6` | `#8b5cf6` |
| 9 | `#3b82f6` | `#3b82f6` |
| 10 | `#0891b2` | `#0891b2` |
| 11 | `#f59e0b` | `#f59e0b` |
| 12 | `#10b981` | `#10b981` |
| 13 | `#6366f1` | `#6366f1` |
| 14 | `#f97316` | `#f97316` |
| 15 | `#ec4899` | `#ec4899` |

---

## PDF Export Checklist (Pre-Deployment)

- [ ] All charts use side-by-side layout (no single centered chart with empty margins)
- [ ] KPIs in 3-4 column grid (never single column)
- [ ] Input parameters in 2-column key-value table
- [ ] Body text color is `#1f2937` (never `#94a3b8` for primary text)
- [ ] `print-color-adjust: exact` in `@media print`
- [ ] `@page { margin: 15mm; }` set
- [ ] Header has title, date, and RESISTANCEZERO branding
- [ ] Footer has resistancezero.com, generation date, client-side disclaimer
- [ ] SVG charts render correctly in print preview
- [ ] New chart types (gauge, stacked bar, horizontal bar) render with correct color zones
- [ ] Narrative text is data-aligned (references actual calculated values)
- [ ] Compact spacing: no margins > 16px between sections

---

*Refer to PRO_MODE_STANDARDIZATION.md for the complete implementation guide.*
