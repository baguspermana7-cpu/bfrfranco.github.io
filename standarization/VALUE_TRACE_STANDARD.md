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
`tools/test-value-bindings.mjs` (bindings + catalog staleness) — perluasan trace:
graf acyclic, semua deps resolve, formulaTemplate menyebut semua deps; probe
klik TraceValue → popover render rumus live (lihat /tmp probe pattern di memory).

## Status roll-out
v1.92.1 batch-1 (Dashboard IT Load + Facility Load; graf 12 node) · v1.92.3
UI v2 pill visual. Berikut: perluasan graf (NPV/opex/availability/staffing/
water) + instrumentasi semua halaman + external links (EB6).
