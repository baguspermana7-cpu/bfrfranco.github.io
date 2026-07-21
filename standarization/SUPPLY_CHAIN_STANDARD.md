# Supply-Chain per Country Standard (Ship-C)

> Single source: `rz-engine.js` — `DATA.supplyChain` (shared logic) + `models.supplyChain` + per-country bands in `CountryProfile.supplyChain` (`dcmoc/src/constants/countries.ts`). Consumed by CapexEngine (landed cost) + the BOQ dossier (export-control + customs lead-time). NEVER hardcode a duty/tier/lead-time in a component.

## The split-rule (why duty is on equipment only)
A country's construction cost has two parts: **local labor/civil** (cheaper in low-cost regions — already captured by `constructionIndex`/`locMult`) and **imported equipment** (priced in USD, roughly location-invariant, PLUS import duty). Applying a single country multiplier to the whole cost would double-discount imported equipment in cheap-labor countries. So:
- **labor/civil** scaling stays via `locMult` (constructionIndex).
- **import duty** applies ONLY to the imported-equipment fraction of each category (`DATA.supplyChain.equipmentShareByCategory` — ups ~0.70, generator ~0.75, network ~0.80, cooling ~0.55, electrical ~0.40; building/permits/commissioning ≈ 0).

`models.supplyChain.landedFactor(country, category) = 1 + dutyRate × equipmentShare[category]`, **floored at 1.0** (an uplift on imports, never a discount). Applied in the CapexEngine cost loop after `locMult`.

## Duty bands (equipment, screening)
`DATA.supplyChain.importDutyBands`: fta 0 · low 3% · med 7.5% · high 17% · punitive 30% (China↔US). Per-country band in `CountryProfile.supplyChain.importDutyBand`. FTA/free-port (SG, AE, CL) → no uplift. IN/BR/CN/NG/KE/PH → high.

## Export-control — PROXY, NOT statutory
`DATA.supplyChain.exportTiers` (1 allied / 2 intermediate / 3 restricted) + `frontierArchKeys` (GB200/GB300/Rubin). `models.supplyChain.exportControl(country, archKey)` → `restricted` only when a frontier GPU ships to a Tier-3 country. **The US AI Diffusion Rule was RESCINDED (2025)** — the tier caps are NOT in force; this is an **advisory PROXY**, policy-fluid, **NOT legal advice**. Every tier note says so. China/embargo controls persist under separate rules. GPU hardware cost stays EXCLUDED from CAPEX (Ship-A) — export-control is a schedule/risk flag, not a cost line.

## Customs lead-time
`DATA.supplyChain.customsLeadWk` (fast 2 / normal 6 / slow 12 wk) + per-country `customsLeadBand`. Added to imported long-lead equipment in the dossier equipment schedule (on top of the MV-transformer ~120 wk global long-lead).

## Wiring
- **countries.ts** `CountryProfile.supplyChain` extended with `importDutyBand` / `gpuExportTier` / `customsLeadBand` (all 40) → **`build-countries-data.mjs` regenerates `DATA.countries` → `test-reference-parity.mjs` 155/0** (deep-equality, schema-elastic).
- **CapexEngine.ts** cost loop applies `landedFactor(country, key)` per category.
- **BOQ dossier** — "Supply Chain & Import" section (export tier, duty band, per-category landed uplift, customs lead, FTA note) + red export-control banner when restricted. `models.dossier.sections()` extended.
- **Data Library** — "Supply Chain" tab (per-country table + proxy/screening caption).

## Gates
`test-rz-engine.mjs`: landedFactor uplifts equipment for duty country, ==1.0 for FTA + labor category + null country, never < 1.0; exportControl frontier+T3 restricted + note contains "RESCINDED"; leadTimeCustomsWk band mapping; duty bands monotonic; sourced. **`test-reference-parity.mjs` 155/0 after build-countries-data.** See [AI_ARCH_STANDARD.md](AI_ARCH_STANDARD.md), [BOQ_DOSSIER_STANDARD.md](BOQ_DOSSIER_STANDARD.md).
