# DCMOC — DC-OS User Manual

> The Data Center Intelligence Platform ("DC-OS"): an end-to-end decision
> platform for the full data-center lifecycle. This manual documents every
> engine's calculation (inputs → model → outputs → source) and the platform
> workflow. It is a LIVING document — sections marked *(scheduled)* are filled
> as each engine is wired to the shared engine. Companion:
> `standarization/DCMOC_DCOS_STANDARD.md`.

## 1. What DC-OS is
DCMOC is an **integrator**, not a calculator: every number is produced by the
shared **RZEngine** (`rz-engine.js`) / **FINEngine** (`fin-engine.js`) — the same
math the public calculators use — not by hardcoded values inside DCMOC. Change an
assumption once and the whole model re-flows. Access is root-only (Supabase
sign-in).

## 2. The lifecycle — 13 engines (Layers 1–13)
DC-OS models a project through 13 engines, plus a Layer-0 orchestrator that keeps
them in sync and a Layer-13 AI decision engine that reads them all:

| # | Engine | Purpose (headline outputs) | Calc source |
|---|--------|----------------------------|-------------|
| 1 | Requirements | Capture customer/contract/target/use-case | intake *(scheduled)* |
| 2 | Site Intelligence | Site Score from tax/disaster/grid/talent/compliance + geo | *(scheduled)* |
| 3 | Architecture | Electrical/Mechanical/Cooling/Fire/Network/Building | *(scheduled)* |
| 4 | Capacity Planning | Phased MW build-out, occupancy ramps | *(scheduled)* |
| 5 | CAPEX Engine | Total CAPEX, $/kW, timeline, cost breakdown | `RZEngine.data.capexDetail` (partial) |
| 6 | Construction | Schedule, milestones, critical path | *(scheduled)* |
| 7 | Commissioning | IST/SAT/FAT/punchlist → Operational Readiness Index | *(scheduled)* |
| 8 | Operations | OPEX, staffing, maintenance | *(scheduled)* |
| 9 | Asset Intelligence | Lifecycle replacements, digital passport, health | *(scheduled)* |
| 10 | Reliability | MTBF/MTTR/FMEA/RCM, availability | *(scheduled)* |
| 11 | Sustainability | PUE/WUE/CUE, carbon, ESG | `RZEngine.data` (partial) |
| 12 | Financial | NPV/IRR/EBITDA/DSCR/payback/LCC | `RZEngine.models.roi` ✓ |
| 13 | AI Decision | Feasibility + recommendations from all engines | deterministic (Layer-13) ✓ |

## 3. Layer 0 — the digital thread (auto-recompute)
Changing a master input (IT load, tier, cooling, region, redundancy, occupancy,
staffing) auto-recomputes every dependent engine, in dependency order. Example:
**IT load 10 MW → 15 MW** cascades to Capacity → Architecture → CAPEX →
Operations → Sustainability → Financial → (AI) Decision. The dependency graph is
deterministic and acyclic (`src/lib/orchestrator/dependencyGraph.ts`).

## 4. Engine reference

### Financial (Layer 12) — engine-sourced ✓
- **Inputs:** total CAPEX, annual OPEX, revenue/kW/month, IT load (kW), discount
  rate (WACC), project life, revenue & OPEX escalation, occupancy ramp, tax rate,
  depreciation years.
- **Model:** year-by-year cashflow (revenue·occupancy·escalation − OPEX −
  tax on EBITDA − depreciation) → free cashflow; NPV and IRR computed by
  **`RZEngine.models.roi.npv` / `.irr`** (the shared engine); ROI, profitability
  index, simple + discounted payback, break-even occupancy.
- **Outputs:** NPV, IRR %, ROI %, payback (yr), discounted payback, PI, per-year
  cashflow table, break-even occupancy.
- **Provenance:** identical to the site calculators (parity verified: IRR diff
  0.000000 pp, NPV diff $0.00). A local implementation remains only as a fallback
  if the engine is unavailable.

### AI Decision (Layer 13) — deterministic, AI-ready ✓
- **Inputs (`DecisionRequest`):** a snapshot of engine outputs (`DecisionContext`)
  + your constraints (budget, target tier, deadline, region, max PUE, min
  availability) + objectives (min cost / min carbon / max reliability / fastest
  delivery / max ROI).
- **Model:** a deterministic rule engine (no LLM) — e.g. *budget < Tier-IV CAPEX
  → recommend the highest tier that fits*; density → cooling; PUE/availability/
  schedule constraint checks; ROI read. Every rule produces an explainable step
  (observation → rule → conclusion).
- **Outputs (`DecisionResult`):** a one-line summary, ranked recommendations with
  confidence, a full rationale trace, feasibility + confidence metrics.
- **AI later:** a real AI backend can be plugged in behind the same interface
  (`DecisionProvider`) with no change to how you use it.
- **Honesty:** engineering guidance only — not investment/professional advice.

### CAPEX (Layer 5) — partial
Cost factors, redundancy/cooling/building multipliers, PUE-by-cooling and
timeline are sourced from `RZEngine.data.capexDetail` (the capex-calculator
engine); the city cost table and country profiles remain local for finer
granularity. *(Owner note: CAPEX is under active refinement.)*

### Other engines *(scheduled)*
OPEX, TCO, Workforce/Staffing, Market/Benchmarks, Investment, Monte Carlo
(Group-1: wire to existing engine functions) and Compliance, Tax, Risk (geo),
Maintenance, Capacity, Asset Lifecycle, Grid Reliability, Fuel/Gen (Group-2:
promoted into the shared engine). Each will document inputs → model → outputs →
source here as it lands.

## 5. Workflow (how to run a study)
1. **Requirements / inputs** — set IT load, tier, cooling, region, redundancy,
   occupancy ramp, staffing (top bar + Requirements engine).
2. The **orchestrator** recomputes all dependent engines automatically.
3. Open any engine to inspect its inputs → outputs, with a provenance tooltip
   naming the engine that computed each figure.
4. Review the **Executive Dashboard** for the roll-up (capacity, tier, CAPEX,
   OPEX, EBITDA, IRR, status) + the **AI Decision** recommendation.
5. **Save a scenario**; compare scenarios side-by-side.
6. **Export a PDF** per engine (super-complete: inputs → model → outputs →
   provenance → disclaimer) or a master executive report.

## 6. Reports (PDF)
Every engine and the dashboard generate a detailed PDF (`Reports` + each engine's
Export button). Reports render the input variables, the model, the output
variables, the data provenance, and the appropriate disclaimer.

## 7. Data provenance & honesty
Every engine figure is traceable to the shared engine + its `DATA.sources`
citation. Financial/decision outputs are educational/engineering guidance, not
investment or professional advice.

## 8. Engine & Data Reference — AUTO-GENERATED
The Knowledge Base "Engine Models" tab and the FAQ "Engine & Data Reference"
section render `src/lib/engine-catalog.json`, which is GENERATED from
`rz-engine.js` by `tools/build-engine-catalog.mjs` (every model namespace,
function, parameter list, data source, and the real consumers auto-detected
from usage). A staleness gate (`tools/test-value-bindings.mjs`) blocks any
engine change that skips regeneration — this reference cannot drift and is
never hand-edited. PDF exports end with an algorithmic Executive Assessment
(profile chip + narrative + prioritized actions) computed from the page's live
numbers by `src/modules/reporting/pdf/ReportNarrative.ts`.

---
*Status 2026-07-20: Financial + AI Decision + orchestrator engine-sourced and
verified; all 22 article calculators engine-bound (v1.96.0); remaining engine
sections scheduled per `standarization/DCMOC_DCOS_STANDARD.md`.*

## 9. Trace Angka (Formula Field) — AUDIT SETIAP ANGKA
Angka dengan garis-bawah titik violet bisa DIKLIK: popover "Trace Angka"
menampilkan rumusnya dengan angka live sebagai pill berwarna (violet = input
kamu, emerald = konstanta engine bersumber, cyan = dihitung, amber = screening).
Klik pill mana pun untuk masuk ke rumus pill itu — rekursif sampai titik paling
ujung; leaf menyediakan "Edit di menu" dan link sumber eksternal (glossary,
dokumen publik korpus). Coverage kini mencakup semua halaman engine inti
(Financial 7/7, Sustainability 10/10, Ops 7/7, Reliability 6/6, Staffing 8/8 —
sisa non-trace = label/enum, bukan angka). Standar:
`standarization/VALUE_TRACE_STANDARD.md`.

## 10. Panel "Kenapa?" — decision explainability (v1.96–v1.97)
Verdict dan status chip bukan sekadar warna — KLIK untuk melihat alasannya
dengan angka live + **lever terukur** (dihitung dengan bisection pada model
yang sama dengan yang merender angka, bukan saran generik):
- **Phased Financial**: verdict GO/NO-GO → alasan + "Revenue +X% ke $Y/kW/bln"
  / "CAPEX −Z%"; KPI merah → panel fase terburuk; PDF memuat section
  "Decision Rationale & Required Changes".
- **Investment**: threshold Min DSCR ≥1.25x, Equity IRR ≥15%, payback ≤7 th —
  chip klik → lever debt-ratio/revenue/exit; target tak tercapai → catatan
  jujur "unreachable".
- **Reliability**: availability di bawah target tier → gap nines + kontributor
  terbesar + lever ("paths +1", "MTTR −46%"); baris SPOF punya tombol FIX.
- **Site Intelligence**: band Poor/Fair per axis → kontributor weight×value +
  lever via scoreSite nyata ("SAIDI ≤407 → axis 60 Good").
- **Capacity**: chip OK/Watch/At-Risk → reason + lever (defer IT load) +
  tombol Phase Plan/Requirements.
- **Results**: skor dimensi <60 → chip ⓘ → formula + lever per dimensi; grade
  <B → ringkasan 2 dimensi terlemah + apakah lever cukup mencapai 70.
- **Staff Model**: Monthly Hidden Loss "▸ kenapa?" → formula + breakdown
  per-hire + lever terukur.

## 11. Environmental Costs (Sustainability) — country-auto
Section baru menjawab "di mana biaya air/waste/carbon?": **Water** (WUE engine
× climate multiplier ASHRAE × $/kgal per sumber; deep-sea ON → basis seawater
$0), **Carbon** (scope-2 × harga karbon compliance per negara dari
`DATA.envCosts` — 40 negara; tanpa skema → voluntary $10/t berlabel amber),
**Waste** (2 t/MW-IT + e-waste 150 kg/MW × band developed/emerging), plus total
+ forecast ramp. Ganti negara → semua rate ikut otomatis.

## 12. Data Library — dataset baru + Country Coverage
- Dataset live baru: **O&M Contracts** (band $/kW-yr per tier kontrak),
  **Spares Pricing** (8 kelas suku cadang), **Env Costs** (harga karbon +
  waste, 40 negara, sortable) — semua bersumber (`DATA.sources`).
- **Country Coverage**: matriks 40 negara × 30 field ✓/— dihitung live dari
  tabel negara (98.3%); klik negara → daftar field yang kosong.

## 13. Kalender maintenance per-system
Kalender dirombak: satu baris per SYSTEM ×count (bukan per unit — 500 MW: 20
baris, bukan 34.815), toggle **Week/Month**, blok ×N berwarna per tipe
maintenance, hover → panel ringkas, klik → detail event di bawah grid.

## 14. Prefill & rekomendasi (tanpa overwrite diam-diam)
- **Edit Criteria (Site)**: field kosong menampilkan nilai efektif — chip cyan
  = baseline negara, chip amber = screening typical; store tetap unset.
- **Requirements 1.6**: chip `rec: X` dihitung live dari parameter proyek
  (`lib/recommended.ts`, 13 rule — substation by band MW, refrigerant
  lowest-GWP, fee AACE band, solar 10% IT + BESS 2h, dll). Klik chip =
  terapkan satu; "Terapkan semua rekomendasi" = terapkan semuanya. Tidak ada
  nilai yang ditimpa tanpa aksi user.

## 15. Capacity Utilization — forecast-aware (v1.97.5)
Chip OK/Watch/At-Risk dihitung dari **puncak forecast pertumbuhan** (share
kapasitas design), bukan utilisasi saat ini (yang struktural ≈ 1/(1+margin));
tiap sistem mendapat estimasi **tahun exhaust** ("At Risk ·~2029"). Hover % =
"Sekarang X% · puncak forecast Y% · exhaust ~tahun".
