# CDU Liquid-Cooling Suite

> 6-page Coolant Distribution Unit toolkit + its FMECA / spares-engine integration.
> Part of [[Standards-Hub]]. Engine-backed sizing shares [[Calculators-Hub]]; the
> comparison page links into [[Comparisons-Hub]] (Air vs Liquid).
> **Living note — update on every CDU ship.** Last updated: **2026-06-28** (v1.50.19).

---

## Pages

| ID | Name | File | Role |
|---|---|---|---|
| cduh | [[CDU-Suite\|CDU Hub]] | cdu-hub.html | Toolkit hub — 5 sub-tools + a **maintenance-intelligence** row → FMECA engine + spares |
| cducal | CDU Sizing Calculator | cdu-calculator.html | Thermohydraulic sizing — engine-backed KPIs (`js/cdu-engine.js`, Darcy-Weisbach / Haaland) + flow-vs-dP chart |
| cdusel | CDU Selection Guide | cdu-selection-guide.html | In-row vs facility-scale selection + capacity-vs-flow vendor chart |
| cducmp | CDU Comparison | cdu-comparison.html | In-rack vs in-row vs facility L2L + capacity-by-type chart + TCO read |
| cduchk | CDU PM Checklist | cdu-checklist.html | Preventive-maintenance checklist + **FMECA fault reference** + 3 charts |
| cdubms | CDU Mini-BMS | cdu-mini-bms.html | Fault-injection simulator (leak / pump-fail / clog) mapped to FMECA modes |

Frozen engine: `js/cdu-model.js` + `js/cdu-engine.js` (40/40 `tools/test-cdu-calc.mjs`, in ship-gate).
Data: `data/cdu/` CSVs (models + the 6 new `chart-*.csv`).

---

## FMECA integration (v1.50.17–.18)

The CDU maintenance content is wired into the FMECA knowledge base on
`ai-engineering-maintenance.html` (the [[Standards-Hub]] AI-maintenance concept page).
Liquid-cooling fault modes **F11.1–F11.5** (component family **C-LQC-001..007**):

| Mode | Fault | Component | S·O·D | RPN | Basis |
|---|---|---|---|---|---|
| F11.1 | Coolant chemistry drift | C-LQC-005 | 7·5·4 | **140** | ASME (HIGH) |
| F11.4 | Dielectric fluid degradation | C-LQC-005 | 6·4·5 | **120** | 3M |
| F11.3 | Manifold / hose leak | C-LQC-003 | 9·4·3 | **108** | OCP (MEDIUM) |
| F11.2 | CDU pump failure | C-LQC-001 | 10·3·2 | **60** | Vertiv |
| F11.5 | Filter clogging | C-LQC-007 | 5·6·2 | **60** | OCP (MEDIUM) |

- `cdu-checklist.html` §10 renders all five as expandable cards (mechanism · effect ·
  detection · corrective + preventive · S/O/D + RPN), ordered by RPN.
- `cdu-mini-bms.html` fault scenarios are tagged: **leak → F11.3 · pump-fail → F11.2 · clog → F11.5**.
- `cdu-hub.html` maintenance-intelligence row links → `ai-engineering-maintenance.html` (Diagnose)
  + `spares-readiness-calculator.html` (Stock — CDU-coolant-distribution subsystem).

Source: FMECA-KG dataset `docs/research/csv/{components,faults,mechanisms,effects,actions,sod_rpn}.csv`.

---

## Interactive charts (v1.50.19 — `js/rz-article-chart.js`)

Six source-tagged charts (each carries a finding-title + `source` + `basisTag`; gated by
`tools/audit-article-charts.mjs --strict`). Datasets in `data/cdu/chart-*.csv` (each with
`source` + `basis_tag` columns).

| Page | Chart | Type | Basis |
|---|---|---|---|
| cduchk | PM-cadence task count | bar | derived |
| cduchk | Spares cost × criticality | bar | illustrative |
| cduchk | FMECA fault-criticality (RPN) | bar | derived (`sod_rpn.csv`) |
| cducmp | Capacity by CDU type | bar | vendor |
| cdusel | Capacity vs secondary flow | line | vendor (`cdu-models.csv`) |
| cducal | Flow vs ΔP trade-off | line | derived (`cdu-engine.js`) |

Chart CSS is supplied **inline per page** (the editorial chart skin in `css/rz-article-dark.css`
is register-scoped to `html[data-rz-register="editorial"]` and not loaded on CDU pages) using
each page's own `--ck-` / `--cp-` / `--cdu-` theme vars. Theme-aware (light + dark), CNBC crosshair.

---

## Standards compliance

| Standard | Status |
|---|---|
| Dark-mode coverage (`audit-dark-coverage.mjs`) | ✅ all 6 pages PASS (white-body-in-dark fixed v1.48.1) — see [[Dark-Mode-Rollout]] |
| Responsive layout (`audit-responsive-layout.mjs`) | ✅ no mobile/tablet overflow |
| Chart provenance (`audit-article-charts.mjs`) | ✅ every config has `source` + `basisTag` |
| Version stamp + script-tags + js-syntax | ✅ all strict-clean |
| design.md tokens (signal-amber / oscilloscope-green / fault-red / instrument-cyan) | ✅ chart accents map to design tokens; no new palette |

---

## Relationships

```
cdu-hub
├── cducal ←→ cspr (spares)            (sizing → readiness)
├── cdusel · cducmp                    (selection cluster)
├── cduchk ←→ aim (FMECA engine)       (PM checklist ↔ F11.x knowledge base)
├── cdubms → aim                       (fault-injection → FMECA modes)
└── pcool (Cooling pillar) · cpc (Air vs Liquid compare) · dcsol (DC Solutions)
```

Related: [[Standards-Hub]] · [[Calculators-Hub]] · [[Comparisons-Hub]] · [[Dark-Mode-Rollout]]
