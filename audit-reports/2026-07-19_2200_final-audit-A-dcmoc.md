# AUDIT 2026-07-19 22:00 — Final Total Audit A (DCMOC regresi & konsistensi)
Agent sweep pasca 43 ship v1.89.1→v1.94.9. Ringkasan temuan (25 item, terprioritas):

## MUST FIX (SUDAH DIIMPLEMENTASI v1.95.0 `93393ce0`)
1. simulation.ts merge tanpa fallback `capacityPhasesCustomized` → derivasi fase bisa pecah di blob lama. FIXED.
2. ExecutiveDashboard dead tab state + DashTopBar dead props/ChevronDown (sisa penghapusan tab). FIXED.
3. sites.addSite koordinat skematik 0.4+0.12n → kini COUNTRY_GEO capital. FIXED.
4. portfolio createDefaultSite hardcoded 'ID' → live selectedCountry. FIXED (catatan: pakai require() — ganti import lazy proper saat sentuh file).
5. projects console.warn produksi → dev-guarded. FIXED.

## SHOULD FIX (antrian)
6. scenario.ts payload tanpa version field → migrasi rawan saat skema berubah.
7. sites.ts version hardcode 1 tanpa upgrade path.
8. Trace/explain coverage parsial: KPI capex hanya P50 ber-trace (P10/P80/perKw belum); 60+ label tanpa explain key.
9. Spares buildAssessment hanya di PDF, belum on-page.
10. Remediation chips belum di reliability/spares (baru capacity).
11. opsLog SEED overlay penuh (bukan per-key) → saved log tak auto-upgrade.
12. cxTracking/financialTracking quota silent-fail tanpa warning user.

## DEFER (P2)
Alerts row rollout, RiskHeatMap di Reliability, dsb. Detail penuh: transkrip agent ad740cb6.
