# 2026-07-20 01:30 — DM Audit: Country-Specificity Inventory (Explore agent)

CATATAN VERIFIKASI: agent menyebut "16 negara" — countries.ts berisi 40 ID; hitungan gap per-field wajib diverifikasi ulang saat eksekusi.

## HIGH (material ke OPEX/CAPEX)
1. constants/countries.ts:26 `constructionIndex?` — field ada, sebagian/semua kosong → CapacityPlanningEngine fallback 1.0. Fix: isi 40 negara (sumber: turner/rlb/ICC construction cost index screening).
2. ShiftEngine.ts:195 social security `ID?0.04:0.06` — realita SG ~37% (CPF employer 17%+... verify), US 12.4% FICA employer-share 7.65%, AU super 11.5%. Fix: `labor.socialSecurityRate` per negara (employer statutory).
3. site-adapter.ts:303 staff cost ×1.3 benefits global — range riil 15-40%. Fix: `labor.benefitsOverheadRate`.
4. ShiftEngine.ts:255-259 night premium 0.07/0.10 by shift — harusnya statutory per negara. Fix: `labor.nightShiftPremiumRate`.
5. ShiftEngine.ts:175 `baseSalary/173` jam kerja global. Fix: `labor.workingHoursPerMonth` (158-176).

## MEDIUM
6. ShiftEngine.ts:263 allowance 0.06/0.08 shift-based.
7. FuelGenEngine.ts:240 permit env `genCount*2500+5000` global.
8. site-adapter.ts:122 land score threshold $500/m² global; :110 permit range 3-24mo global.
9. TalentAvailabilityEngine.ts:89 training ×1.5 global (scarce market butuh 2x+).
10. capex-data.ts:42 locationMultipliers region-proxy ketika constructionIndex kosong.

## DEAD DATA (fields tak terkonsumsi)
talentPool.talentScore, talentPool.certifiedProfessionals (semi), gridReliability.brownoutFrequency (dipakai site-intel trace? verify — grid engine pakai SAIDI), gridReliability.averageOutageDuration, fuelDiesel.hvoPricePerLiter (semi), fuelDiesel.fuelQualityRating.

## WORKLIST
Fase 1 (H): populate constructionIndex 40 + 4 field labor baru + konsumen (ShiftEngine ×3, site-adapter). Fase 2 (M): allowancePolicy, permit cost per negara, scoring normalization, training multiplier. Fase 3: konsumsi dead data / deprecate. Setiap perubahan countries.ts → node tools/build-countries-data.mjs regen + parity gate + terser + ?v.
