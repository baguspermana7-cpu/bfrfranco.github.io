# CDU Toolkit Suite

> Liquid-cooling **Coolant Distribution Unit** toolkit — 6 linked pages on resistancezero.com.
> Mirror of the `cdu-*.html` family. Part of [[Apps-Hub]] · cross-links [[Calculators-Hub]] ·
> [[Comparisons-Hub]] · [[Standards-Hub]].

Last updated: **2026-06-27** · Versions: **v1.51.0** (FMECA integration) + **v1.52.0** (charts)

---

## Pages

| ID | Page | File | Role |
|---|---|---|---|
| cdu-hub | CDU Toolkit hub | `cdu-hub.html` | Landing — 6 cards incl. the new **Maintenance intelligence** card |
| cdu-sel | Selection & Deployment Guide | `cdu-selection-guide.html` | Types, sizing math, install envelope |
| cdu-chk | Install / Inspect / Maintenance Checklist | `cdu-checklist.html` | Bands, PM cadence, spares register, symptom table, **§10 FMECA reference** |
| cdu-bms | Mini-BMS cockpit | `cdu-mini-bms.html` | Per-type layout, ISA P&ID, live sim, fault injection |
| cdu-cmp | Deep Comparison | `cdu-comparison.html` | Field issues, control/BMS, after-sales, TCO |
| cdu-calc | Sizing & Thermohydraulic Calculator | `cdu-calculator.html` | ε-NTU / Darcy-Weisbach engine (`js/cdu-engine.js`) |

---

## FMECA / maintenance integration (v1.51.0)

The toolkit is wired to the predictive-maintenance engine instead of standing isolated:

- **Engine link:** cdu-hub + checklist + Mini-BMS link to the **AI Engineering-Maintenance** engine
  (`ai-engineering-maintenance.html#sec-knowledge-base`) and the spares-readiness calculator.
- **Fault IDs:** the liquid-cooling fault family **F11.1–F11.5** (from the FMECA knowledge graph
  `docs/research/csv/*`) is referenced throughout — checklist §09 symptom rows + Mini-BMS fault
  scenarios (leak = F11.3 · pump fail = F11.2 · clog = F11.5) are tagged with their IDs.
- **§10 FMECA fault reference:** the checklist renders all 5 fault modes with component (C-LQC-00x),
  mechanism, symptoms, detection, effect, corrective + preventive actions, and **S·O·D + RPN**.

| Fault | Name | RPN | Source |
|---|---|---|---|
| F11.1 | Coolant chemistry drift | 140 | ASME J.Electron.Packag.140 020902 |
| F11.4 | Dielectric fluid degradation | 120 | 3M |
| F11.3 | Manifold / hose leak | 108 | OCP |
| F11.2 | CDU pump failure | 60 | Vertiv / Uptime Institute |
| F11.5 | Filter clogging | 60 | OCP |

---

## Interactive sourced charts (v1.52.0)

Theme-aware `js/rz-article-chart.js`, each backed by a `data/cdu/` CSV with `source` + `basis_tag`,
gated by `tools/audit-article-charts.mjs --strict`.

| Page | Chart | Basis | Dataset |
|---|---|---|---|
| cdu-checklist | PM-cadence distribution | derived | `data/cdu/pm-cadence.csv` |
| cdu-checklist | Spares cost × criticality | illustrative | `data/cdu/spares-cost-criticality.csv` |
| cdu-checklist | FMECA F11.x RPN ranking | derived | `data/cdu/fmeca-rpn.csv` |
| cdu-comparison | Secondary ΔP across 9 vendor models | vendor | `data/cdu/cdu-models.csv` |
| cdu-selection-guide | Secondary flow vs capacity | vendor | `data/cdu/cdu-models.csv` |
| cdu-calculator | Pressure-drop vs flow (engine-sampled) | derived | `data/cdu/flow-dp.csv` |

---

## Standards compliance

| Check | Status |
|---|---|
| Editorial register + page `--cdu-`/`--ck-`/`--cp-`/`--bm-` vars preserved | ✅ no divergent styling |
| Dark-mode coverage (no white-body-in-dark) | ✅ all 6 pages — see [[Dark-Mode-Rollout]] (v1.48.1 fixed cdu-* cascade bug) |
| `audit-article-charts --strict` | ✅ 18 charts clean (6 new) |
| `audit-script-tags` / `audit-js-syntax` / `audit-mobile-responsive` | ✅ clean |
| Engines (`js/cdu-engine.js`) | ✅ unchanged — charts sample offline |
| `ai-engineering-maintenance.html` / `css/rz-article-dark.css` | linked / referenced — **never edited** (parallel-session-owned) |

---

Related: [[Apps-Hub]] · [[Calculators-Hub]] · [[Comparisons-Hub]] · [[Standards-Hub]] ·
`standarization/CONTENT_LINKAGE_PLAYBOOK.md` §2.6
