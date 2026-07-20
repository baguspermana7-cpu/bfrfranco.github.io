# VALUE TRACE STANDARD — "Formula Field" Excel-style tracing (DCMOC)

> Owner mandate (2026-07-19): setiap angka/score/value harus bisa DIKLIK → tahu
> rumusnya (dengan angka live), sumbernya, dan bisa di-trace rekursif SAMPAI
> TITIK PALING UJUNG — lintas halaman DAN lintas surface (tidak terbatas DCMOC:
> glossary, artikel kalkulator, dokumen korpus publik, live gateway).

## Arsitektur
- **Registry**: `dcmoc/src/lib/value-trace.ts` — `TRACE: Record<traceId, TraceNode>`.
  `TraceNode = { label, page, unit?, provenance, formulaTemplate?, deps?, get(), sourceKey?, external? }`.
  - `get()` MEMBACA LIVE dari store/adapter/engine — trace bukan dokumentasi statis.
  - `deps` menunjuk traceId lain → graf terarah, WAJIB acyclic (gate).
  - `formulaTemplate` menyebut deps by id (contoh `"sim.itLoad × engine.pueMatrix ÷ 1000"`).
  - LEAF = input user (store param) ATAU konstanta engine (`sourceKey` → `DATA.sources`).
  - `external?: { href, label }` — link keluar DCMOC: glossary.html#term, artikel
    kalkulator site (dari engine-catalog consumers), source_url dokumen korpus,
    endpoint gateway live. Rantai audit penuh: angka → param → konstanta → dokumen publik.
- **UI**: `dcmoc/src/components/ui/TraceValue.tsx` — popover "Trace Angka":
  header nilai besar + chip provenance bahasa sederhana; rumus = PILL VISUAL
  klik-able berwarna provenance dengan nilai live; klik pill = drill-down +
  breadcrumb; leaf = kartu penjelasan + "↗ Edit di menu" + "🌐 Buka sumber eksternal".
- **Resolver**: `resolveTrace(id)` → pohon dengan rumus ter-substitusi angka live.

## Konvensi id
`traceId` ≡ atribut `data-bind` ≡ id `value-bindings.ts` — SATU namespace
(synergy probe + manual + trace pakai id yang sama). Format `domain.field`
(`sim.itLoad`, `arch.facilityMw`, `ops.energyCost`).

## Konvensi instrumentasi (v1.97.x)
- **Atribut `data-trace`**: tombol root `TraceValue` membawa `data-bind` DAN
  `data-trace={traceId}` — `[data-trace]` adalah selector stabil yang dipakai
  penghitung coverage walk probe (jangan diganti/dihapus).
- **Node mirror-page (live-reader helpers)**: `get()` node halaman WAJIB
  me-mirror komputasi halaman PEMILIK persis (contoh helpers di bawah
  `value-trace.ts`: `effHeadcounts()` mirrors `useEffectiveInputs`, payroll
  mirrors `StaffingDashboard results.totalMonthlyCost`, EVM mirrors
  `ConstructionEngine`) supaya angka popover = angka KPI yang dirender.
  Semua helper null-safe: store/engine hilang → resolve `null`, bukan crash.
- **Enum/label TIDAK di-trace**: teks kategori/badge meta ("N+1", "Class 4",
  tier chip, status label) bukan angka hasil rumus — JANGAN dipaksakan jadi
  node palsu. Didokumentasikan sebagai pengecualian sah di coverage
  (contoh: Dashboard 23/29, sisanya enum/badge).

## Warna provenance (seragam dgn konvensi input-vs-derived DCMOC)
| provenance | warna | arti |
|---|---|---|
| input | violet | angka yang user isi (atau predefined yang bisa diubah) |
| engine | emerald | konstanta/fungsi engine bersumber (`DATA.sources`) |
| derived | cyan | dihitung dari node lain |
| screening | amber | estimasi berlabel, bisa di-override |

## ATURAN ADOPSI (Definition of Done)
1. **Setiap angka/score/value BARU yang dirender di DCMOC WAJIB registrasi
   traceId** (node TRACE + wrap `TraceValue`) — angka tanpa trace = temuan gap
   (walk probe menghitung coverage per halaman).
2. Konstanta baru di rumus → node leaf engine + `sourceKey` (dan entri
   `DATA.sources` di engine bila belum ada).
3. Ship apa pun yang menyentuh sistem trace → update doc ini + CHANGELOG.

## Gates
- `tools/test-value-bindings.mjs` (bindings + catalog staleness) — perluasan
  trace: graf acyclic, semua deps resolve, formulaTemplate menyebut semua deps;
  probe klik TraceValue → popover render rumus live (lihat /tmp probe pattern
  di memory).
- **Trace-coverage gate PERMANEN di walk probe** (`tools/_dcmoc_walk_probe.mjs`,
  v1.97.0): per halaman menghitung elemen KPI numerik vs `[data-trace]` →
  log `trace-coverage <page>: x/y`; assert floor **≥30% halaman core
  ter-instrument** (≥1 KPI ter-trace). 10 halaman core di floor (Dashboard,
  Capacity, Capex, Reliability, Financial, Ops, Sustainability, Architecture,
  Staffing, Results) + 7 halaman telemetri log-only (Site, Commissioning,
  Construction, Maintenance, Investment, PhasedFinancial, Assets — kandidat
  floor berikutnya).

## Status roll-out
- v1.92.1 batch-1 (graf 12 node) · v1.92.3 UI v2 pill visual · v1.95.1 wave-2
  5 halaman.
- **v1.96.0–v1.97.4 (EB waves 3-final): graf ~130+ node** — Site Intelligence
  full trace 30 node `site.*` (5 engine + leaf SAIDI/tarif/AQI/WRI/PGA/tax),
  Financial 7/7, Sustainability 10/10 (termasuk 4 node Environmental Costs),
  Ops 7/7, Reliability 6/6, Staffing 8/8, Architecture 16/17, Dashboard 23/29
  (sisa = enum/badge, lihat kebijakan di atas), Results score + 4 dimensi,
  Construction SPI/CPI/EV, Commissioning readiness, Assets fleet/health.
  Walk probe 24/0 dengan coverage gate hijau.
- Berikut: naikkan halaman telemetri log-only ke floor assert + external
  links tersisa (EB6).
