# 2026-07-20 01:00 — Implementation Audit: Night Fleet → v1.96.0 `1c689ca4`

## Scope
Integrasi fleet 6 agent + serial main-thread sejak v1.95.0: article sweep final, korpus, trace site-intel, prefill, CB dinamis, DL explain, dedup input, kalender maintenance, riset harga O&M (DN).

## Shipped
| Item | Status | Bukti |
|---|---|---|
| Article sweep 22/22 (12 wired final + 2 prose-skip sah) | ✅ | engine 590/0, headless 12/12, katalog 49ns/200fn |
| Korpus DayOne (dayonedc.com) | ✅ | dc-corpus 389/0, 104 sumber |
| ?v engine unified | ✅ | `2026-07-20-b` × 57 loader (stale 2026-07-16 tersapu) |
| Site-intel ƒx total (owner Image #19) | ✅ | 30 node site.*, 24+7 wrap, bindings 73/0 |
| Edit Criteria prefill (Image #20) | ✅ | baseline negara cyan / screening amber / custom violet |
| 20kV sync (Image #21) | ✅ | label "Dedicated 20–33kV" 1.6+Capex; preset kV drawer +11/20/66 |
| 1.6 prefill dinamis (Image #22) | ✅ | recommended.ts 13 rule live + apply-all, tanpa silent overwrite |
| Decision explain Phased Financial (Image #23) | ✅ | reason + lever bisection + klik-navigasi + PDF section |
| Dedup input Staff Model (Image #24) | ✅ | country derived + link; dead region code dihapus |
| Slider predefined + Hidden Loss explain (Image #25) | ✅ | AQI per negara, turnover engine, panel "kenapa?" + lever terukur |
| Kalender maintenance per-system (Image #26) | ✅ | 222→19 baris; toggle week/month; hover+klik detail |
| DN riset harga O&M | ✅ tahap 1 | DATA.omContracts + DATA.sparesPricing (sourced) + 24 assert; spares-adapter wired |

## Bug NYATA ditemukan & difix (3)
1. **IRR tax ×100 dobel** (SiteCardsPanels) — engine sudah persen → tampilan "5780%". Fixed render+trace.
2. **PI "0x"** (PhasedFinancial) — formula nol-kan PI saat NPV ≤ 0. Fixed → (NPV+inv)/inv.
3. **Kalender blank rows** — filter nama per-unit tak match event batch sejak v1.91.4. Fixed via agregasi per-class.

## Gates (semua hijau)
engine 590/0 · accuracy 40/0 (2 skip) · parity 155/0 · bindings+staleness 73/0 · dc-corpus 389/0 · js-syntax 133 · script-tags 606 · tsc+build dcmoc · walk 23/23 · synergy 6/6 · export 44/0.

## Sisa (antrian malam — dieksekusi otonom)
- DG: biaya air + waste management + carbon per negara di Ops/Sustainability (owner 00:5x) — riset rate + tabel engine + section UI.
- #340 EB coverage: trace wave Staffing/Assets/Construction/Commissioning/Results + coverage gate.
- #341 DL rollout: Investment/Reliability/Sustainability verdicts.
- #342 DM: audit country-specificity semua kalkulasi + Data Library restructure (semua tabel per-negara + gap report).
- #343 DN sisa: konsumen omContracts (MaintenanceStrategyEngine tier kontrak) + surfacing Data Library.
- #326/#330/#333 sisa: DA3 snapshot chips, DE Cx/CDU, Financial dedup.
