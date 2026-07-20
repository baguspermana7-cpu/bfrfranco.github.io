# DCMOC — DC-OS User Manual

> The Data Center Intelligence Platform ("DC-OS"): platform keputusan end-to-end
> untuk seluruh lifecycle data center. Manual ini mendokumentasikan SEMUA engine
> yang terintegrasi (apa fungsinya, fungsi kuncinya, halaman pemakainya), tabel
> DATA bersumber, semua fitur platform per menu, dan gate kualitas yang menjaga
> semuanya. Basis kebenaran: `src/lib/engine-catalog.json` (AUTO-GENERATED dari
> `rz-engine.js`) + `CHANGELOG.md`. Companion: `standarization/DCMOC_DCOS_STANDARD.md`.
>
> **Status katalog saat ini: DATA v2.5.1 · 49 model namespaces · 200 fungsi ·
> 105 sumber DATA.** Terverifikasi s/d v1.98.1 (2026-07-20).

---

## 1. Overview & alur kerja

DCMOC adalah **integrator**, bukan kalkulator: setiap angka dihitung oleh shared
**RZEngine** (`rz-engine.js`) / **FINEngine** (`fin-engine.js`) — matematika yang
sama dengan kalkulator publik situs — bukan nilai hardcode di dalam DCMOC. Ubah
satu asumsi → seluruh model mengalir ulang. Akses root-only (Supabase sign-in).
DCMOC memuat `rz-engine.min.js` dari SITE ROOT (tidak ada copy lokal).

### Alur kerja — 9 langkah engine pipeline (Requirements → Results)

| # | Langkah | Menu | Yang terjadi |
|---|---------|------|--------------|
| 1 | **Requirements** | Requirements 1.1–1.6 | Intake proyek: IT load, tier, cooling, negara/kota (dropdown DC-hub), use-case profile, contract duration, infrastructure options (deep-sea, refrigerant, substation, solar+BESS) — chip `rec:` menghitung rekomendasi live. |
| 2 | **Site Intelligence** | Site Intelligence | Site Score weighted-factor dari 5 engine terintegrasi (grid/disaster/tax/talent/compliance) + peta nyata (MapLibre) + Compare rail; band per-axis bisa diklik → alasan + lever. |
| 3 | **Architecture** | Architecture | Disiplin desain, kompleksitas, design fee (band AACE), topology tier, ASHRAE thermal check, diagram satu-garis dengan glyph detail + cascade ×N. |
| 4 | **Capacity Planning** | Capacity | Fase build-out derived dari IT load, occupancy S-curve, stranded capacity, binding constraint, chip utilisasi forecast-aware (tahun exhaust). |
| 5 | **CAPEX** | CAPEX Engine | Estimasi AACE Class-4 per negara/tier/cooling (anchor Turner & Townsend/C&W), P50→P80, distribusi MEP, timeline. |
| 6 | **Construction** | Construction | Jadwal CPM-style (design→permit→procurement→civil→MEP→Cx), risiko long-lead (trafo 60–120 minggu), SPI/CPI (plan-mode berlabel "baseline"). |
| 7 | **Commissioning** | Commissioning | Program Cx L1–L5 + FAT/SAT/IST (port RICH cx-calculator): durasi+biaya per level, 30 kartu day-rate regional, Monte-Carlo band, tornado sensitivity, Operational Readiness Index. |
| 8 | **Operations · Financial · Sustainability** | Ops / Financial / Phased Financial / Investment / Sustainability / Reliability / Staffing / Maintenance / Spares / Assets | OPEX, staffing sub-linear (MW^0.65), NPV/IRR/payback (engine `roi`), availability chain β-common-cause, PUE/WUE/carbon + Environmental Costs country-auto, kalender maintenance, newsvendor spares. |
| 9 | **Results & Decision** | Results / Dashboard / Reports | Skor komposit per dimensi (chip ⓘ formula + lever), AI Decision deterministik (observation→rule→conclusion), Executive Dashboard roll-up, PDF export dengan Executive Assessment algoritmik. |

**Layer 0 — digital thread (auto-recompute):** mengubah master input (IT load,
tier, cooling, negara, redundancy, occupancy, staffing) otomatis menghitung ulang
semua engine dependen dalam urutan dependency (deterministik & acyclic —
`src/lib/orchestrator/dependencyGraph.ts`). Contoh: IT load 10→15 MW mengalir ke
Capacity → Architecture → CAPEX → Operations → Sustainability → Financial → Decision.

Simpan **scenario** untuk perbandingan side-by-side; kartu proyek tersimpan
berlabel "saved snapshot · tanggal" + badge amber bila berbeda dari sim aktif.

---

## 2. DAFTAR LENGKAP ENGINE TERINTEGRASI

Basis: `src/lib/engine-catalog.json` — 49 namespace `RZEngine.models.*`,
konsumen grep-derived dari pemakaian nyata. **26 namespace dikonsumsi DCMOC**
(tabel 2.1), **19 namespace site/artikel** (tabel 2.2, tersedia via Knowledge
Base), **4 namespace tanpa konsumen grep** (2.3). 26+19+4 = 49 ✓.

### 2.1 Engine yang dikonsumsi DCMOC (26 namespace)

| Namespace | Untuk apa | Fungsi kunci | Halaman DCMOC |
|---|---|---|---|
| `architecture` | Kompleksitas desain multi-disiplin (electrical/mechanical/cooling/fire/network/building), fee A&E per band kompleksitas (ASHRAE Gl.0 + benchmark ARUP/Syska), topology redundansi per tier (Uptime/TIA-942), cek termal ASHRAE TC9.9, floor loading per kelas cooling. | `disciplines` `complexity` `designFee` `topology` `thermalCheck` `floorLoading` `band` | Architecture |
| `asset` | Manajemen aset lifecycle: umur desain per kelas (ASHRAE Equipment Life), probabilitas gagal by age (Weibull/IEEE 493), health index, jadwal replacement + $/kW per komponen. | `designLife` `failureProbability` `healthIndex` `replacementSchedule` `status` | Assets (via value-bindings/trace/provenance) |
| `capacity` | Perencanaan kapasitas: facility load dari IT×PUE per cooling/tier, occupancy ramp S-curve logistik (kalibrasi CBRE H1-2025), stranded capacity, binding constraint (power vs rack vs white-space), preset fase build-out. | `facilityLoad` `occupancyScurve` `occupancyAt` `strandedCapacity` `bindingConstraint` `preset` `totalMw` | Capacity (capacity-adapter) |
| `capex` | **Estimasi biaya modal AACE Class-4** per negara/tier/cooling — anchor city $/W Turner & Townsend DCCI + Cushman & Wakefield 2025; accuracy range P50→P80 per kelas AACE, distribusi MEP, region cost index, modular premium, timeline detail. | `datacenterBuildCost` `detailed` `totalCost` `accuracyRange` `mepDistribution` `regionCostIndex` `timelineDetailed` `modularPremium` | CAPEX Engine, Dashboard, Financial (juga capex-calculator situs) |
| `carbon` | Emisi karbon scope 1/2/3 (GHG Protocol): tonase & biaya tahunan dari MW×PUE×grid factor per negara (Ember/IEA), embodied carbon konstruksi (RICS/LETI), biaya offset. | `annualTonnes` `annualCost` `scopes` `gridFactor` `embodiedTonnes` `offsetCost` | Sustainability |
| `cdu` | Sizing CDU liquid-cooling + hidraulika (Darcy/Haaland, dew point Magnus, batas OCP/ASHRAE: supply temp, ΔT, flow, dP, dew margin, kecepatan pipa). | `size` `hydraulics` | CDU page (Design Tools; juga cdu-calculator situs) |
| `commissioning` | **Program Cx L1–L5 + FAT/SAT/IST** (port RICH dari cx-calculator): equipment quantities dari IT load + rack density → durasi & biaya staffed per level pada 30 kartu day-rate regional, Monte-Carlo N=10.000, tornado 7-param, Readiness Index berbobot (ASHRAE Gl.0/BCxA). | `programRich` `monteCarlo` `sensitivity` `equipScale` `mapInput` `readinessIndex` `programSchedule` `programCost` `status` | Commissioning, NewEngineDashboards (arch-adapter) |
| `compliance` | Biaya kepatuhan regulasi tahunan per kategori (fire/electrical/environmental/data-protection/building/security) + amortisasi one-time; matriks framework per negara di country profiles. | `annualCost` `baselineAnnual` `categoryCost` | Compliance (via provenance/trace) |
| `construction` | Jadwal konstruksi CPM-style forward-pass dengan overlap fast-track per fase; risiko procurement long-lead 2024–26 (trafo MV/HV 60–120 mgg, switchgear 50–80, genset 40–70). | `schedule` `fromTimeline` `longLeadRisk` | Construction (construction-adapter) |
| `cooling` | **Deep-sea cooling poster-exact** (150 MW ref: 8.625 m³/s, 4+1 pompa 2.9 m³/s @60 m ≈ 2 MW, PUE ≤1.15; accurate mode TEOS-10 ρ1025/cp3985), intake temp per depth (NOAA WOA), database 9 refrigerant (GWP/COP/safety-class/charge/leak). | `deepSea` `intakeTempForDepth` `refrigerant` | CAPEX, CDU/Design Tools, Requirements 1.6, CapexEngine.ts |
| `fire` | Proteksi kebakaran: massa clean-agent NFPA 2001 (m = V/s·C/(100−C)) + inert flooding, assessment sistem (deteksi/suppression/battery TR per NFPA 855/UL 9540A). | `assess` `agentQuantity` | Fire page (Design Tools; juga fire-calculator situs) |
| `grid` | Keandalan grid utilitas: skor 0–1 & band dari uptime% (SAIDI-informed), jam outage tahunan — blended dgn brownout/outage-duration profil negara. | `score` `band` `annualOutageHours` | Grid Reliability (via provenance/trace) |
| `opex` | **OPEX tahunan**: biaya listrik MW×PUE×tarif negara (basis presets util 0.7/1.0), staffing per region/role, kontrak O&M per scope, efisiensi cooling per climate zone. | `totalAnnual` `powerCostAnnual` `staffingCostAnnual` `contractCostAnnual` `coolingEfficiency` | Financial, Strategic Planning, screening.ts |
| `pue` | Efisiensi energi: PUE default per cooling×tier (matriks Uptime Global Survey 2026), partial-load PUE (share overhead 0.55), DCiE, biaya energi tahunan, WUE per cooling. | `defaultFor` `partialLoadPUE` `pueFromInputs` `dcie` `annualEnergyCost` `wue` | Sustainability, Architecture, Ops (bindings/trace/arch-adapter; juga pue-calculator situs) |
| `reliability` | **Availability chain RAM**: MTBF/MTTR per komponen (IEEE 493 Gold Book), komposisi seri/paralel/k-out-of-N, target availability per tier Uptime, downtime menit/tahun. DCMOC menambah β=5% common-cause (modul shared `availabilityChain`) — Dashboard/RAM tab/trace identik. | `systemAvailability` `parallelAvailability` `seriesAvailability` `kOutOfN` `mtbfFor` `mttrFor` `tierTarget` `annualDowntimeMinutes` `availability` | Reliability, Dashboard (juga article-13) |
| `requirements` | Intake proyek: profil use-case (AI/HPC/cloud/colo/enterprise/edge → density/cooling defaults), completeness %, validasi field wajib, jumlah rack, band density (batas cooling per ASHRAE/NVIDIA/OCP). | `profile` `completeness` `validate` `rackCount` `densityBand` | Requirements, Platform dashboards |
| `risk` | Geo-risk: skor hazard berbobot (seismic/flood/typhoon/volcano/tsunami/wildfire), multiplier premi asuransi, site score risiko. | `geo` `insuranceMultiplier` `siteScore` | Disaster Risk (via provenance/trace) |
| `roi` | **Inti Financial Layer-12**: NPV, IRR (scale-aware Newton, akurasi ~1e-16), payback & discounted payback, npvAuto dgn WACC regional (Damodaran). Parity dgn kalkulator situs terverifikasi (IRR diff 0.000000 pp). | `npv` `irr` `paybackPeriod` `discountedPayback` `npvAuto` | Financial (FinancialEngine.ts), Dashboard (juga roi-calculator situs) |
| `sim` | Kernel simulasi: Monte-Carlo seeded per distribusi input, tornado sensitivity, sensitivity grid 2-variabel — dipakai konsisten lintas kalkulator & DCMOC. | `monteCarlo` `tornado` `sensitivityGrid` | Monte Carlo (via provenance; juga capex/opex/roi/tco-calculator situs) |
| `site` | **Site Score** weighted-factor transparan (power+grid+seismic+talent+tax+carbon+flood+latency+water — kriteria 451/CBRE/Uptime), grade band, `deriveFactors` mengubah profil negara (SAIDI/ tarif/AQI/WRI Aqueduct/PGA/tax) → skor 0–1 per axis. | `score` `grade` `deriveFactors` | Site Intelligence (page, Compare rail, Map radar), site-adapter, countries.ts |
| `spares` | **Newsvendor spares optimization**: Q* dari critical ratio (Φ⁻¹ Acklam \|e\|<1.15e-9), reorder point, EOQ; kernel `normInv/normCdf/poissonCdf` juga dipakai engine lain (alarms, reliability). | `newsvendor` `reorderPoint` `eoq` `normInv` `normCdf` `poissonCdf` | Spares (Design Tools, spares-adapter) |
| `tax` | Insentif pajak: MACRS (IRS Pub 946), bonus depreciation TCJA (20% 2026), solar ITC IRA §48 (30%+10%), exemption sales tax negara bagian (VA/TX/NV/OH/AZ), bea impor. Bukan nasihat pajak. | `macrsDepreciation` `bonusDepreciationShield` `solarItc` `stateSalesTaxSaving` `importDuty` | Tax Incentives (via provenance) |
| `tco` | TCO lifecycle: NPV diskonto multi-tahun + siklus refresh aset, cashflow, $/MW-yr. Menghidupkan KPI Dashboard "LCC (15yr)". | `lifecycleNPV` `lifecycle` `cashflows` `costPerMwYear` `replacementCycles` | Dashboard (via value-trace `fin.lcc15`) |
| `tier` | Tier advisor Uptime-style: 15 component score-map berbobot → klasifikasi band + saran tier (bukan sertifikasi Uptime). | `advise` `classify` | Tier advisor (Design Tools) |
| `water` | **Footprint air WUE**: m³/tahun per cooling (deep-sea → basis seawater), biaya per negara, facility footprint lengkap (climate mult + upstream power water 1.5 L/kWh), water-stress cost (WRI Aqueduct), per-query AI water. | `wue` `annualM3` `annualCost` `facilityFootprint` `stressCost` `aiQueryFootprint` | Sustainability Environmental Costs (via trace; juga article-10/20) |
| `workforce` | Perencanaan tenaga kerja: hiring plan (attrition-compounded), biaya attrition (150% replacement SHRM), tahun menutup gap, strategy fit. | `hiringPlan` `attritionCost` `attritionCostWeighted` `annualHiresRequired` `cumulativeHires*` `yearsToCloseGap` `strategyFitScore` | Talent (via provenance; juga article-27) |

### 2.2 Engine site (artikel/kalkulator) — tersedia via Knowledge Base (19 namespace)

Namespace ini hidup di RZEngine yang sama dan ter-render di Knowledge Base
"Engine Models" + FAQ; konsumennya halaman artikel/kalkulator situs.

| Namespace | Untuk apa (ringkas) | Konsumen |
|---|---|---|
| `aiFactory` | Readiness retrofit AI-factory (rubrik banded cooling/structural/density/PUE/age) + GPU build cost/TCO (benchmark Colossus 122 hari). Termasuk fix bug ×1000 annualEnergy. | article-18, article-23 |
| `alarms` | Manajemen alarm ISA-18.2/EEMUA-191: rate/10 menit, cognitive load, flood probability (Poisson shared-kernel), Erlang-C, skor ISA komposit. | article-2 |
| `communityImpact` | Net-score dampak komunitas DC (air, noise, NOx/health, jobs, GDP). | article-14 |
| `dcMarket` | Screening pasar SEA: bubble risk & opportunity 0–100 (supply/demand/NPV/IRR). | article-16, -17 |
| `dcValue` | Dampak ekonomi DC per negara (jobs multiplier IMPLAN, grid surplus, CFE). | article-12 |
| `energy` | LCOE solar/wind/BESS (Lazard/IRENA/BNEF) + hybrid screen. | capex-calculator |
| `gridImpact` | Dampak tagihan listrik warga SEA dari beban DC (tarif PLN/TNB/EMA dll). | article-11 |
| `gridReserve` | Adequacy reserve-margin gaya PJM (ELCC, kurva harga capacity auction, risiko blackout). | article-25 |
| `hvac` | TCO arsitektur cooling (traditional/hybrid/DLC, tropis vs temperate). | article-9 |
| `interconnect` | Perbandingan power/latency/biaya interconnect AI (pluggable vs CPO vs copper). | article-22 |
| `maintCompliance` | Kapasitas vs demand maintenance (friction/CMMS/evidence) → compliance % + solver teknisi. | article-3 |
| `market` | Ringkasan pasar DC global per region + pemetaan warna maturity/CAGR. | dc-market-tracker |
| `mttr` | MTTR vendor-vs-inhouse per fase + ekonomi downtime tahunan. | article-4 |
| `opsBudget` | Budget OPEX + staffing resilience (burnout logistic, replacement cost). | article-15 |
| `opsMaturity` | Skor kematangan operasi 8-dimensi (Reactive→Generative) + translasi risiko outage Uptime 2024. | article-1 |
| `rca` | Efektivitas program RCA (rubrik 6 komponen berbobot). | article-6 |
| `resilience` | Reliability-vs-resilience assessment (redundansi desain + 7 dimensi operasional). | article-7 |
| `safetyCulture` | Safety Health Index leading-indicator + drift-to-failure (Rasmussen). | article-8 |
| `techDebt` | Skor risiko technical-debt Weibull-hazard + eskalasi biaya deferral + ROI remediasi. | article-5 |

### 2.3 Namespace tanpa konsumen grep-derived (4)

Tersedia di engine (ter-render di Knowledge Base), tetapi grep katalog tidak
menemukan konsumen langsung — halaman DCMOC terkait memakai implementasi
lokal/adapter se-basis DATA yang sama:

| Namespace | Isi | Catatan |
|---|---|---|
| `decision` | `recommend` (rule engine Layer-13) + `rankOptions`; `DATA.decision` = benchmark tier/biaya/PUE. | AI Decision DCMOC = rule engine deterministik lokal di balik interface `DecisionProvider` (lihat §3). |
| `forecast` | `compoundGrowth` `linearTrend` `projectByYear` `scenarioBands`. | Utility proyeksi; dipakai tidak langsung. |
| `fuel` | Konsumsi genset (EPA Tier 4 ~0.27 L/kWh), storage hours/liter per tier Uptime. | Halaman FuelGen memakai engine lokal + `DATA.fuelGen`; opsi HVO (EN 15940, CO₂ −90%) per harga negara. |
| `maintenance` | Ekonomi strategi O&M (reactive/planned/predictive), benchmark staffing Uptime 4.2 FTE/posisi. | Halaman Maintenance memakai adapter + `DATA.omContracts`. |

**Jumlah terverifikasi: 26 + 19 + 4 = 49 namespace ≡ `modelCount` katalog.**

---

## 3. Engine reference — Financial & AI Decision (engine-sourced ✓)

### Financial (Layer 12)
- **Input:** total CAPEX, OPEX tahunan, revenue/kW/bulan, IT load (kW), discount
  rate (WACC), umur proyek, eskalasi revenue & OPEX, occupancy ramp, tax rate
  (derived dari negara), depresiasi.
- **Model:** cashflow tahun-per-tahun → free cashflow; NPV & IRR oleh
  **`RZEngine.models.roi.npv` / `.irr`** (shared engine); ROI, PI, payback
  sederhana + diskonto, break-even occupancy.
- **Provenance:** identik dgn kalkulator situs (parity: IRR diff 0.000000 pp,
  NPV diff $0.00). Implementasi lokal hanya fallback bila engine tak termuat.
- **4 IRR berbeda basis** (Dashboard unlevered after-tax·ramp·15 th; Results
  screening flat; Investment equity/levered; Phased blended) — masing-masing
  berlabel basis + tooltip rekonsiliasi lintas halaman (sah berbeda, dijelaskan).

### AI Decision (Layer 13)
- **Input (`DecisionRequest`):** snapshot output engine (`DecisionContext`) +
  constraint (budget, target tier, deadline, region, max PUE, min availability)
  + objectives (min cost / min carbon / max reliability / fastest / max ROI).
- **Model:** rule engine deterministik (tanpa LLM) — setiap rule menghasilkan
  langkah explainable (observation → rule → conclusion). Benchmark ambang dari
  `DATA.decision` (target availability Uptime, band $/kW CBRE/JLL/C&W, band PUE
  ASHRAE).
- **Output (`DecisionResult`):** ringkasan satu baris, rekomendasi terperingkat
  + confidence, rationale trace penuh, metrik feasibility.
- **AI later:** backend AI nyata bisa dipasang di balik interface
  `DecisionProvider` tanpa mengubah cara pakai.
- **Kejujuran:** engineering guidance — bukan nasihat investasi/profesional.

---

## 4. Tabel DATA bersumber (ringkas)

Setiap nilai `DATA.*` membawa entri `DATA.sources` (source + asOf + method bila
screening). 105 sumber di katalog; keluarga utama:

| Dataset | Isi & arti |
|---|---|
| `countries` (40) | Referensi negara 2026-Q1: economy/labor/environment/grid/disaster/talent/fuel/tax/compliance/constructionIndex — GENERATED dari `dcmoc/src/constants/countries.ts` (single source situs+DCMOC). +Labor statutory 40 negara: `socialSecurityRate` (AU 12%, GB NIC 15%, FR 38%…), `benefitsOverheadRate`, `nightShiftPremiumRate` (JP 25%/KR 30%…), `workingHoursPerMonth`, `environmentalPermitCostPerYear`, `constructionIndex` 40/40. |
| `envCosts` (40) | Harga karbon compliance per negara (World Bank/OECD/NCCS 2025-26: SG $33, EU-ETS $61, SE $120, CH $130…; tanpa skema → voluntary $10/t berlabel) + band biaya waste developed/emerging. Menggerakkan Environmental Costs di Sustainability. |
| `omContracts` | Band kontrak O&M $/kW-yr per tier (Comprehensive 30–60 / Preventive 20–40 / On-call 10–20), multiplier third-party 0.65 & aging 1.5 — screening bersumber publik 2024–26. Konsumen: biaya SLA Maintenance. |
| `sparesPricing` (8 kelas) | Band harga suku cadang (modul UPS 50 kW $25–60K, string VRLA, kit PM genset, kompresor chiller $80–250K, CRAH EC-fan, MCCB, filter) — dipakai spares-adapter (provenance emerald). |
| `benchmarksCorpus` | **DC public-data corpus** (tools/dc-corpus): distribusi p10–p90 per metrik×segment dari 35 dokumen publik (10-K SEC, EIAR, OCP/ASHRAE spec, LBNL/IEA/Uptime research) — setiap fakta WAJIB source_url + kutipan verbatim; **gate 2.451 assert**. Render: Data Library "DC Corpus" + Benchmarks "posisi proyek vs korpus". |
| `capexDetail` | Faktor biaya kalkulator capex (anchor city $/W T&T DCCI + C&W 2025, JLL escalation), space program, cost factors per disiplin — estimate-grade budgetary. |
| `pueMatrix` / `pueDefaults` | PUE per tier×cooling (Uptime Global Survey 2026, cohort inrow/rdhx terpisah); `pue.partialLoad` screening berlabel. |
| `reliability` | MTBF/MTTR komponen IEEE 493 Gold Book + target availability tier Uptime. |
| `commissioning.cx` | Metodologi biaya/jadwal Cx RICH (30 kartu day-rate regional, kalibrasi ASHRAE Gl.0/BCxA/NETA/Uptime IST). |
| `deepSeaCooling` | Poster mode = OWNER BASELINE exact (8.625 m³/s; gate-locked); accurate mode TEOS-10; SWAC costing Makai/Hawaii. |
| `refrigerants` (9) | GWP100 IPCC AR4, kelas ASHRAE 34, copIndex relatif, charge/leak GHG Protocol/EPA. |
| `currency` + live FX | Snapshot ECB + **live rates via gateway `/fx`** (TTL 1 jam, fallback snapshot berlabel jujur). |
| `markets` / `dcMarket` | Per-market capacity/vacancy/pipeline (CBRE/JLL/C&W/Synergy) + SEA screening; `powerCost` per market ≠ `regions.*.powerKwh` (denominator beda — terdokumentasi). |
| `salaryBenchmarks` / `salaryRolesExt` / `attritionFactors` | Uptime/AFCOM/BLS/Levels.fyi 2025-26 + faktor attrition (CAP/DataX 2024). |
| `tax` / `tax.macrs` | TCJA/IRA §48/state exemptions + tabel MACRS IRS Pub 946. |
| `construction.longLeadWeeks` | Lead time procurement 2024-26 (EPRI + OEM quotes). |
| `spares.acklam` | Aproksimasi Φ⁻¹ Acklam 2003, \|rel. error\| < 1.15e-9. |
| `site.climateFreeHours` + SITE_AUGMENT | ASHRAE 169 climate zones → free-cooling hours; WRI Aqueduct 4.0; IEEE 1366 SAIDI; USGS PGA. |
| `cdu.*` / `fire.*` | Konstanta fisik & band operasional CDU (Moody/Colebrook, Magnus) dan fire (NFPA 2001/72/855, UL 9540A). |
| `aace` | Kelas estimasi AACE 18R-97 (Class 5 −50/+100% … Class 1 −10/+15%). |
| Artikel (`opsMaturity`, `alarmMgmt`, `maintCompliance`, `mttrResponse`, `techDebt`, `rcaScore`, `resilience`, `safetyCulture`, `hvacCooling`, `waterStress`, `waterFootprint`, `aiWater`, `gridImpact`, `dcValue`, `communityImpact`, `opsBudget`, `interconnect`, `gridReserve`, `aiFactory`) | Basis data model artikel yang dipromosikan ke engine — semua screening-grade berlabel method. |

---

## 5. Fitur platform per menu

### 5.1 Trace Angka "ƒx" — audit SETIAP angka (VALUE_TRACE_STANDARD)
Angka ber-badge ƒx violet bisa DIKLIK: popover "Trace Number" menampilkan rumus
dgn angka live sebagai pill berwarna (violet = Your input, emerald = Engine
(sourced), cyan = Computed, amber = Screening estimate — **teks UI kini bahasa
Inggris**). Klik pill → drill rekursif sampai leaf; leaf punya "Open / edit in
tab" + link "External source" (glossary, dokumen publik korpus) — rantai audit:
angka DCMOC → parameter → konstanta engine → dokumen sumber.

**Enhance (2026-07-20):** popover kini punya tiga alat audit tambahan (additif,
nilai tak berubah):
- **⧉ Copy** — menyalin SELURUH rantai trace (rumus + nilai live + sumber, pohon
  ter-indentasi teks) ke clipboard untuk ditempel ke laporan/audit.
- **▸ Expand all** — membuka seluruh pohon dependensi sekaligus sampai leaf
  (daftar rata ter-indentasi, klik baris = lompat trace); saat dep banyak muncul
  kolom **filter** untuk mencari dep by nama.
- **Made up of…** — ringkasan komposisi leaf per jenis di dasar popover (mis.
  "3 inputs · 2 engine constants · 1 screening estimate") supaya jelas angka
  disusun dari apa.

Coverage semua halaman engine inti (Financial 7/7, Sustainability 10/10, Ops
7/7, Reliability 6/6, Staffing 8/8, Maintenance 4/4, Investment 4/4, Phased 5/5,
Assets 5/5, Site 31/31; sisa non-trace = label/enum terdokumentasi). Dijaga gate
**trace-parity 117/117** (popover ≡ KPI render).

### 5.2 Panel "Kenapa?" — decision explainability
Verdict/status chip bukan sekadar warna — KLIK untuk alasan angka live +
**lever terukur** (bisection pada model yang SAMA dengan render, bukan saran
generik):
- **Phased Financial**: GO/NO-GO → alasan + "Revenue +X% ke $Y/kW/bln" / "CAPEX
  −Z%"; KPI merah → fase terburuk; PDF memuat "Decision Rationale & Required Changes".
- **Investment**: threshold Min DSCR ≥1.25x, Equity IRR ≥15%, payback ≤7 th —
  lever debt-ratio/revenue/exit; target tak tercapai → catatan jujur "unreachable".
- **Reliability**: gap nines vs target tier + kontributor terbesar + lever
  ("paths +1", "MTTR −46%"); baris SPOF tombol FIX.
- **Site Intelligence**: band Poor/Fair per axis → kontributor weight×value +
  lever via scoreSite nyata ("SAIDI ≤407 → axis 60 Good").
- **Capacity**: chip OK/Watch/At-Risk → reason + lever (defer IT load) + tombol
  Phase Plan/Requirements.
- **Results**: dimensi <60 → chip ⓘ → formula + lever per dimensi
  (single-source `dimension-explain.ts`); grade <B → 2 dimensi terlemah + apakah
  lever cukup mencapai 70 (dihitung).
- **Staff Model**: Monthly Hidden Loss "▸ kenapa?" → formula + breakdown per-hire + lever.

### 5.3 On-page guidance (assessment yang sama dgn PDF)
Panel guidance live (profile chip + narasi + aksi HIGH/MED/LOW berprioritas)
di Carbon/ESG, Reliability, Results, Commissioning, Site Intelligence, Spares —
setiap grade menjelaskan dirinya + apa yang di-fine-tune. Cx level bernama
lengkap (L1 Factory Witness … L5 IST) + hover explainer; capacity At-Risk
menyebut remediasi persis (+N unit / −MW / naikkan rating).

### 5.4 Prefill & rekomendasi (tanpa overwrite diam-diam)
- **Predefined editable**: Peak IT = IT load, Avg = 75% peak, SLA = target tier,
  Budget ≈ CAPEX P80 — auto-isi HANYA saat kosong, chip violet "predefined",
  edit manual dipertahankan; banner Pro-Forma menyatakan basis auto-derive.
- **Requirements 1.6 chip `rec: X`** dihitung live (`lib/recommended.ts`, 13
  rule — substation by band MW, refrigerant lowest-GWP, fee AACE band, solar 10%
  IT + BESS 2h, deep-sea dari poster spec, dll). Klik chip = terapkan satu;
  "Terapkan semua rekomendasi" = semuanya.
- **Edit Criteria (Site)**: field kosong menampilkan nilai efektif — chip cyan =
  baseline negara, amber = screening typical; store tetap unset.
- **Dedup input**: Tax Rate/Lease Term/Region/Country derived dari Requirements
  (satu sumber + link "Edit di ↗"); Strategic Planning mengunci input yang sudah
  ada di menu lain.

### 5.5 Environmental Costs (Sustainability) — country-auto
**Water** (WUE engine × climate mult ASHRAE × $/kgal per sumber; deep-sea ON →
basis seawater $0), **Carbon** (scope-2 × harga karbon compliance per negara
`DATA.envCosts`; tanpa skema → voluntary $10/t chip amber), **Waste** (2 t/MW-IT
+ e-waste 150 kg/MW × band), total + forecast ramp. Ganti negara → semua rate
ikut. KPI air = volume engine pre-climate (≡ node trace); kartu Env menampilkan
kedua baris berlabel.

### 5.6 Data Library
- **DC Corpus** (tab pertama): distribusi p10/p25/p50/p75/p90 per metrik×segment
  live dari `DATA.benchmarksCorpus` + provenance chip.
- Dataset live: **O&M Contracts**, **Spares Pricing**, **Env Costs** (40 negara,
  sortable) — semua bersumber.
- **Country Coverage**: matriks 40 negara × 30 field ✓/— live (98.3%,
  1.180/1.200; gap = harga HVO 20 negara); klik negara → daftar field kosong.

### 5.7 Knowledge Base & FAQ — AUTO-GENERATED
Tab "Engine Models" + FAQ "Engine & Data Reference" me-render
`src/lib/engine-catalog.json` — GENERATED dari `rz-engine.js` oleh
`tools/build-engine-catalog.mjs` (namespace, fungsi, parameter, sumber DATA,
konsumen grep-derived). Gate staleness (`tools/test-value-bindings.mjs`)
memblokir engine change yang lupa regen — referensi ini tidak bisa drift dan
tidak pernah diedit tangan. + **Research Library 35 dokumen** korpus (link,
segment, jumlah fakta) + **Value Bindings** manual + FAQ Q&A fitur.

### 5.8 Peta nyata & lokasi
Site map = **MapLibre GL + OpenFreeMap** vector (tanpa API key) + tab
**Satellite Esri World Imagery** (atribusi wajib dirender); pin site di
koordinat WGS84 nyata, klik-select, popup, fit-bounds; SVG skematik hanya
fallback offline jujur. City field = dropdown DC-hub (`DC_CITIES`, 2–4 kota per
40 negara, custom tetap boleh); Country dipilih cascading per Region.

### 5.9 PDF export standard
Setiap engine + dashboard men-generate PDF super-complete (input → model →
output → provenance → disclaimer) dan diakhiri **Executive Assessment
algoritmik** (`ReportNarrative.ts`, 16 family rubric) — profile chip + narasi
dari angka live halaman + aksi berprioritas. 16 call site, gate export 44/0.

### 5.10 Kalender maintenance per-system
Satu baris per SYSTEM ×count (500 MW: 20 baris, bukan 34.815), toggle
Week/Month, blok ×N berwarna per tipe, hover panel ringkas, klik → detail event.
Rating unit scale-aware (CRAC 100 kW → CRAH 300 kW → fan-wall 900 kW; genset
2.5→3.0 MW) — fleet count masuk akal di hyperscale.

### 5.11 Kejujuran presentasi
- **Plan-mode baseline chips**: Construction SPI/CPI/AC, Financial health "A
  (baseline)", dimensi Results Construction/Financial ber-chip "baseline" +
  footnote komposit — plan-mode tidak "berprestasi".
- **Snapshot chips**: kartu ACTIVE = live sim (chip hijau); kartu tersimpan
  "saved snapshot · tanggal" + badge amber "differs from current project".
- **Project-context bar** di semua halaman (nama proyek · negara · MW IT · tier
  · cooling dari shared store) + chip live FX bila currency ≠ USD.
- Basis eksplisit di setiap metrik (util current ≈ 1/(1+margin) by construction;
  Capacity chip = **puncak forecast** + tahun exhaust "At Risk ·~2029").
- **RZExplain** 802 entri: hover ⓘ pada semua label form (primitive `Field`
  cascade ~67 pemakaian) + istilah teknis sitewide.

---

## 6. Gate kualitas (yang menjaga semua ini)

| Gate | Menjaga |
|---|---|
| `tools/test-rz-engine.mjs` — **599/0** | Worked examples independen tiap model family + invariant DATA + provenance wajib + reachability (Decimal-50dp truth harness utk akurasi). |
| `tools/test-dc-corpus.mjs` — **2.451/0** | Setiap fakta korpus ber-source_url + kutipan verbatim; distribusi monotonic p10≤…≤p90. |
| `tools/test-reference-parity.mjs` — **155/0** | `DATA.countries` ≡ `dcmoc/src/constants/countries.ts` (40 negara; tarif/karbon/tax/enum/currency tak boleh drift). |
| `tools/test-value-bindings.mjs` — **73/0** | Koherensi value-bindings (id unik, engineFn resolve terhadap engine live) + **staleness catalog** — engine change dgn katalog basi TIDAK ship. |
| `tools/_dcmoc_trace_parity_probe.mjs` — **117/117** | Klik setiap angka ƒx di 14 halaman: nilai popover ≡ KPI render (anti mirror-drift). |
| `tools/probe-accuracy-validation.mjs` — **40/0** | 6 rules akurasi + acceptance tests reviewer lintas halaman cockpit. |
| Walk probe — **24/0** (+trace-coverage floor ≥30%/halaman) | Semua halaman DCMOC render 0 console error + telemetri coverage trace per halaman. |
| Synergy probe — **6/0** | Rantai auto-recompute lintas engine (Layer-0). |
| Export probe — **44/0** | Executive Assessment + actions + summary hadir di semua PDF, 0 page error. |
| `tsc` + `next build` · audit js-syntax/script-tags/dark-coverage | Kesehatan build & tema. |

**Auto-linking chain (WAJIB tiap engine change):** edit `rz-engine.js` → terser
min → `node tools/build-engine-catalog.mjs` (regen katalog) → `node
tools/test-value-bindings.mjs` (gate staleness) → KB/FAQ/Research Library
ter-update TANPA edit manual. Lihat `ENGINE_UNIFICATION.md` §AUTO-LINKING.

---

## 7. Changelog ringkas versi besar (detail: `CHANGELOG.md` root repo)

| Versi | Isi |
|---|---|
| v1.89.0–v1.90.2 (2026-07-19) | Article-calculator engine sweep batch 1–4 (gridImpact, water, aiFactory — termasuk fix bug ×1000, opsMaturity, alarms, maintCompliance, mttr, techDebt, rca) · **AUTO-LINKING system** + gate value-bindings · PDF Executive Assessment 16 family · architecture glyph depth. |
| v1.91.x | Binding-trust: store persist, site ikut negara proyek, phases derive dari IT load, engine-ready signal · staffing sub-linear MW^0.65 · fleet ratings scale-aware · kalender per-class · Financial hardcode dibersihkan · dark tooltips. |
| v1.92.x | **DC DATA CORPUS** (`DATA.benchmarksCorpus`) · **Value Trace ƒx** batch 1–3 + VALUE_TRACE_STANDARD + link lintas surface · live FX `/fx` · guidance Reliability. |
| v1.93.x | **Country expansion 32→40** · city dropdown DC-hub · **peta nyata MapLibre/OpenFreeMap** · cascading Region→Country · predefined values · Field tooltip cascade · dedup Financial · corpus round-2 · DC Corpus di Data Library + Benchmarks posisi proyek · Research Library. |
| v1.94.x | Integritas dashboard (fake selector/tab dihapus, map real styles) · Pro-Forma predefined visible · site score & Cx level explainers · At-Risk remediation guidance · Strategic Planning locked inputs · guidance Results/Cx/Site. |
| v1.95.x | Trace ƒx VISIBLE di semua tempat + instrument 5 halaman · RZExplain 802 · Spares on-page assessment. |
| v1.96.0 | **Article sweep COMPLETE 22/22** (engine 590/0) · O&M + spares pricing research · Site-Intel full trace 30 node · prefill dinamis `rec:` 13 rule · decision explainability Phased · kalender dirombak · 3 bug nyata (IRR ×100, PI 0x, kalender blank). |
| v1.97.x | **Environmental Costs country-auto** + `DATA.envCosts` 40 negara · labor statutory 40 negara · Data Library +3 dataset + Country Coverage 98.3% · threshold explain Investment/Reliability · trace coverage gate · Cx/CDU rebuild · Capacity forecast-aware · **gate trace-parity baru** (3 drift tertangkap run perdana) · Results dimension explain. |
| v1.98.x | **Korpus besar 47 dokumen → gate 2.451** + Research Library 35 dok · 4 bug HIGH fixed (CAPEX basis stale session, fake-100% availability → `availabilityChain` β=5%, Pro-Forma energy ~1000×, Cx racks/tier) · wave kejujuran (plan-mode baseline, 4 IRR berlabel basis, air berlabel, Asset MTBF terisi, LCC 15yr hidup). |

---

## 8. Data provenance & honesty

Setiap angka engine tertelusur ke shared engine + sitasi `DATA.sources`
(source + asOf + method utk screening). Output finansial/keputusan =
educational/engineering guidance — bukan nasihat investasi atau profesional.
Nilai screening-grade selalu berlabel; lever yang tak tercapai dinyatakan
"unreachable" jujur; basis setiap metrik eksplisit.

---

## 9. Model Calibration — engine vs dunia nyata

Menu **Benchmarks** memuat section collapsible "Model Calibration — engine vs
dunia nyata": konstanta engine (PUE matrix, CAPEX $/MW, WUE base) divalidasi
terhadap distribusi korpus publik LIVE (`DATA.benchmarksCorpus`) memakai 4
mapping `DATA.calibrationSpec` — sumber tunggal yang sama dengan ship gate
`tools/test-model-calibration.mjs`, jadi verdict di layar ≡ verdict gate.
Chip verdict: **in-band** (emerald, tier fail lolos) · **drift** (rose, keluar
band — temuan dilaporkan, band tidak dilonggarkan) · **indicative** (slate,
tier warn / n kecil). Blok "Tidak dapat dikalibrasi" menyatakan jujur metrik
yang tak bisa divalidasi (renewable scope beda, staffing/uptime tanpa fakta,
capex per-proyek tak berpasangan). Validasi AGREGAT saja — kalibrasi
per-proyek tidak feasible dari korpus. Angka posisi utama ber-trace ƒx
(`calib.pueLiquidPctile`, `calib.capexRatioFinance`). Metodologi:
`standarization/MODEL_CALIBRATION_STANDARD.md`.

---
*Status 2026-07-20 (v1.98.1): Financial + AI Decision + orchestrator
engine-sourced & parity-verified; 22/22 kalkulator artikel engine-bound; 26
namespace engine dikonsumsi DCMOC + 19 site + 4 utility = 49 total; semua gate
hijau (engine 599/0 · corpus 2451/0 · parity 155/0 · bindings 73/0 ·
trace-parity 117/117 · walk 24/0 · synergy 6/0 · export 44/0).*


## §16 — Cloud Projects & Share Link (Arc-4, 2026-07-20)
- **Simpan ke cloud (opsional)**: Projects → kartu project → "☁ Simpan ke cloud" (butuh login). localStorage TETAP penyimpanan utama; cloud = cadangan/multi-device, tanpa sinkron otomatis. Cap 20 project/akun, 240 KB/project (log tracking besar bisa perlu dikurangi).
- **Share view-only**: project cloud → Share → salin URL `?share=TOKEN`. Siapa pun dengan link MELIHAT salinan (bukan live, bukan edit) tanpa login; banner "Mode lihat-saja" + tombol keluar mengembalikan data viewer utuh (backup otomatis sebelum melihat). "Cabut share" mematikan link seketika.
- **Aktivasi**: fitur menyala setelah owner menjalankan SQL Module 9 (Owner Action Board di setup-supabase) — sebelum itu UI menampilkan pesan jujur.

## §17 — Diagnostics guidance (semua yang merah bisa diklik)
Setiap indikator merah/grade jelek kini klik-able → panel "kenapa" (angka live) + lever terukur (dihitung, dgn catatan jujur bila target tak tercapai) + navigasi ke parameter. Cakupan & aturan: standarization/DIAGNOSTICS_STANDARD.md.
