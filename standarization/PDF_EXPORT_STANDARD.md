# PDF Export Quality Standard — ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-02-16

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
│ INPUT PARAMETERS                         │
│ ┌────────────┬─────────┬────────┬─────┐│
│ │ Parameter  │ Value   │ Param  │ Val ││
│ ├────────────┼─────────┼────────┼─────┤│
│ │ ...        │ ...     │ ...    │ ... ││
│ └────────────┴─────────┴────────┴─────┘│
│                                          │
│ RESULTS                                  │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ KPI │ │ KPI │ │ KPI │ │ KPI │       │
│ └─────┘ └─────┘ └─────┘ └─────┘       │
│                                          │
│ SVG CHARTS                               │
│ ┌──────────────────┐ ┌────────────────┐ │
│ │  Radar/Bar Chart │ │ Histogram      │ │
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

---

*Refer to PRO_MODE_STANDARDIZATION.md for the complete implementation guide.*
