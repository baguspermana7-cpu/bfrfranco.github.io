# DIAGNOSTICS STANDARD — guidance untuk setiap indikator merah/skor jelek
(2026-07-20, owner mandate: "yang merah atau scorenya jelek, ada semacam guidance")

## Aturan
1. **Tidak ada chip/angka merah telanjang.** Setiap indikator buruk (status At-Risk/Critical, grade D-F, skor < ambang, NPV/ROI negatif, exposure > ambang) WAJIB klik-able → panel: (a) ALASAN dgn angka live dari model yang SAMA dgn render, (b) LEVER TERUKUR (bisection `explainThresholdMetric` / re-run diskret / neutralize-rerun atribusi — bukan saran generik), (c) navigasi ↗ ke parameter (setActiveTab / scroll / focus).
2. **Threshold satu konstanta** — dipakai pewarnaan + gate panel + collector (dilarang literal duplikat).
3. **Honest-unreachable**: lever yang tak mencapai target dalam bound dilaporkan dgn angka pencapaian maksimum ("bahkan −60% capex hanya membawa NPV ke −$8.9M"), bukan disembunyikan.
4. **Parity dekomposisi**: bila panel menampilkan dekomposisi, verifikasi runtime vs nilai model (chip "≡ engine" / warning bila drift) — pola MaintenanceDashboard.
5. **Collector**: setiap file guidance mengekspor `collect<Surface>Diagnostics(model): Finding[]` (pure, no hooks) — kontrak Diagnostics Center (DEFER sadar; ship terpisah saat diminta). Bentuk kanonik: `{surface, severity, metric, value, threshold, linkTab}` — file yang menyimpang (CapacityDashboard bentuk lama) diunifikasi saat Center dibangun.

## Sistem reusable (pilih per kasus)
- `lib/decision-explain.ts` explainThresholdMetric — metric kontinu ber-threshold (bisection recompute closure).
- `site-intel/axis-explain.ts` — skor komposit ber-breakdown faktor.
- `results/dimension-explain.ts` — dimensi skor formula-extracted single-source.
- `ReportNarrative buildAssessment/buildActions` — panel naratif on-page per family.

## Cakupan (2026-07-20)
Tier-1 SHIPPED: Financial NPV/ROI · Benchmark grade F/D + drift kalibrasi · Compliance <80/<60 · CapacityDashboard riskScore ≥60 · Maintenance riskExposure >50k/20k. Sebelumnya: PhasedFinancial NO-GO, Investment DSCR/IRR/payback, Reliability gap+SPOF, Site axes, CapacityPlanningPage util, Results dimensi, Hidden Loss sim. Tier-2/3/4 = ship berikut (AssetLifecycle, spares fill, GridReliability F, Disaster Extreme, FuelGen CO₂, Strategic bottleneck, Talent, MC P(NPV<0), DesignTools, sapu L).
## DoD: indikator merah baru tanpa guidance TIDAK boleh ship.
