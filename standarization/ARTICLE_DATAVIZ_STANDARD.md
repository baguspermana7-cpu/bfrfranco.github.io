# Article Data-Viz Standard (v1.49.10)

> Every chartable article carries **≥1 free, interactive, finding-titled chart** in the
> reading flow, driven by a **validated, sourced** dataset. No un-sourced numbers — "tidak
> ngawur, ada sumbernya." Charts must read on-brand (instrument tokens) and pass the
> provenance gate.

## When to add a chart
Any article whose argument rests on numbers gets a chart of the **1–2 most decision-relevant
parameters** (chosen for reader engagement, per the article's topic). Charts live in the
**free** reading flow — never gated behind Pro. Text-only articles are a defect.

## The component — `js/rz-article-chart.js`
Reuse the shared renderer (Chart.js 4.4.x + a CNBC-style crosshair). Markup:

```html
<figure class="rz-chart" data-rz-chart>
  <div class="rz-chart-canvas"><canvas></canvas></div>
  <script type="application/json" class="rz-chart-cfg">
    { "type":"line|bar",
      "title":"<finding sentence — state the insight, not the variable pair>",
      "x":"axis label", "y":"axis label", "y1":"right axis (optional)",
      "labels":[...],
      "series":[{"label":"…","data":[...],"accent":"signal|info|data|alert","unit":"…","axis":"y|y1","colors":[...]}],
      "source":"<citation — named source(s) + dataset path>",
      "basisTag":"published|standard|vendor|derived|modelled|illustrative" }
  </script>
</figure>
```

Loaded once per chartable article, after Chart.js:
`<script src="js/rz-article-chart.js?v=…" defer></script>`. The renderer is theme-aware
(re-renders on `data-theme` toggle), honours `prefers-reduced-motion`, draws without entrance
animation (reliable), and auto-appends a **Source caption + basis chip** under every chart.
The `<figure>` is a direct child of `.article-body`, so it inherits the reading measure and
lines up with the prose column.

## On-brand styling (design.md §5 tokens — do not hand-pick colors)
- Series accents: signal-amber `#FFAA00`, instrument-cyan `#00DDFF`, oscilloscope-green
  `#00FF88`, fault-red `#FF3030` (dark); the renderer swaps to readable light-mode equivalents.
- Axes/labels: IBM Plex Mono, `tabular-nums`; grid hairline 0.6px. Title: IBM Plex Sans, the **finding**.
- Charts state the finding in the title (design.md §1): "Fluid loss scales linearly with make-up
  rate" — not "Loss vs make-up rate."

## Data provenance (the non-negotiable part)
- The canonical dataset lives in **`data/article-N/`** following the existing precedent
  (`data/fire/`, `data/cdu/`, `data/article-26/`): a CSV where **every row carries `source` +
  `basis_tag`**, plus a `README.md` documenting the basis-tag legend and a verification date.
- basis-tag legend: **published** (peer-reviewed / named survey / field measurement) ·
  **standard** (published code) · **vendor** (datasheet) · **derived** (computed from published
  figures) · **modelled / illustrative** (representative value chosen for a worked example — amber chip).
- The chart's inline config inlines the series (so it works on `file://`) and copies the `source`
  string verbatim from the dataset. Every charted number must trace to a row in `data/article-N/`.
- Prefer the article's **own already-cited statistics** as the data source.

## Gate (ship-blocking)
```bash
node tools/audit-article-charts.mjs --strict   # every [data-rz-chart] has source + basisTag + series
```
Add to the ship-audit suite. A chart with a missing/invalid `source` or `basisTag` fails CI.

## Reference implementations
- `article-26.html` — dual-axis line (make-up rate → fluid-loss kg + CO₂e), `data/article-26/worked-model-scenarios.csv`, basis **modelled**.
- `article-27.html` — bar (aging-workforce cohorts), `data/article-27/workforce-stats.csv` (AFCOM 2024), basis **published**.


## Living diagrams (v1.50.25)

Animated schematic widgets for the FREE reading flow — the cockpit visual language (flowing dots on SVG
pipes/busbars + live values + fault scenarios) packaged as `js/rz-article-diagram.js`.

Markup: `<figure class="rz-diagram" data-rz-diagram>` containing an authored inline SVG + a
`<script type="application/json" class="rz-diagram-cfg">` config. Inside the SVG:
- flow segments = `<g data-flow="name">` holding `.dg-pipe-base` (faint solid) + `.dg-pipe` (dashed, animated;
  `.alt` for the second accent). Engine toggles `.flow/.slow/.off`.
- live values = `<text data-pv="key">`; instrument groups = `data-inst="key"` (get `.warn/.alarm`).
Config: `baselines` (`{v, unit, dp, noise, min, max}` per key), `flows` (initial states), `scenarios`
(`{label, deltas, flows, alarms, msg}` — rendered as instrument buttons with "Normal" first), `title`
(finding sentence), `source` + `basisTag` (caption + chip, reuses `.rz-chart-src/.rz-chart-chip`).
Behavior: ~1s ticker (pauses offscreen via IntersectionObserver); `prefers-reduced-motion` disables the dash
animation (values still tick); theme-aware via the `--dg-*` CSS vars in `css/rz-article-dark.css`.

Provenance: same gate as charts — `tools/audit-article-charts.mjs` validates `rz-diagram-cfg` blocks too
(source + basisTag mandatory). Values must trace to the article body; anything modelled beyond stated figures
uses `basisTag: "illustrative"` and says so in the caption.

Reference implementations: `article-13` (2N power SLD — UPS-A failure re-routes flow, rack unaffected) and
`article-9` (warm-water DLC loop — "Tropical: Jakarta 35°C" collapses the dry-cooler approach; CDU pump failover).
