# BOQ Dossier Standard (Bill of Quantities — Ship-1)

> Single source: `rz-engine.js` — `DATA.boq` + `models.boq`. DCMOC consumes via `rzData()`/`rzModels()` and renders `dcmoc/src/modules/reporting/boq/BoqDossier.ts`. NEVER hardcode a quantity/unit-rate/margin in a component.

## Core principle: the BOQ is a RECONCILED DECOMPOSITION, not a second number

The CAPEX total (`CapexResult.total`, e.g. $2.25B) is the single source of truth. The BOQ **decomposes** that same money — it never computes a rival total. `models.boq.generate(costs, metrics, input, {locMult})`:
1. Maps each BOQ discipline → its `CapexResult.costs` categories (`categoryTotal`).
2. Builds bottom-up line items from `DATA.boq.takeoff × drivers × unitRates` (+ `laborPct`).
3. Computes `reconcileFactor = categoryTotal / Σ(bottom-up line totals)` and **scales every line so `Σ(lines) === categoryTotal` exactly**. The raw `bottomUpRaw` + `reconcileFactor` are reported — a factor far from ~1.0 is a *disclosed* signal the ratios diverge from the benchmark, never hidden.

So takeoff-ratio absolute error cannot move the total; it only shifts distribution across line items + the displayed quantities.

## Accuracy + honesty regime
- **AACE Class-4, −30% / +50%** (18R-97/17R-97) — stated on every dossier.
- Per-line `confidence`: `high` (code factors, clean-agent charge, BLS wages) carry face value; `med` (rebar/steel/raised-floor/coolant) usable with range; `low` (per-kW cable/tray/conduit, pipe-per-MW) rule-of-thumb → folded into the band + footnoted unsourced.
- Every `takeoff` line + `unitRate` + `commercialBasis` carries `DATA.sources['boq.*']` with confidence in the string. Unsourced number blocks the gate.

## Margin + safety factor (owner ask: "margin berapa % profit + safety factor")
- **Margin is DISCLOSED, not added.** T&T/C&W benchmark $/kW that build the CAPEX total are owner-delivered costs that already embed contractor margin. `models.boq.summary` backs it out: `embeddedMargin = hardSubtotal × m/(1+m)` (m = `epcMarginPctGross`, default 10% → markup 11.1% on cost; band 8-12% gross, 2-6% net realized). Shown as a transparent line, adjustable via `opts.epcMarginPct`. Adding margin on top would double-count → forbidden.
- **Safety factors** surfaced from `commercialBasis.safetyFactors`: NEC 210.20/215.3 continuous **1.25**, ASCE 7-22 LRFD **1.2D+1.6L**, NEC 310.15 ampacity derate **~0.75**, Uptime Tier-3 **N+1**, seismic per zone factor. All HIGH confidence (code-mandated).

## Output
- HTML dossier (`renderBoqDossierHTML`) — cover · prominent disclaimer+safety-factor+margin block · commercial summary (ties to CAPEX total, residual = greenCert+renewables disclosed as `unaccounted`) · 8 discipline sections with line-item tables + confidence chips + reconcile note. Owner opens it in-browser and exports to PDF via `window.print()` (reuses `PrintReport.ts` `openStandardReport` idiom).
- Entry points: `TraceValue.tsx` popover on `capex.total` ("Download BOQ"), + buttons on `CapexEnginePage` and `ConstructionEngine` (where owner clicked $2.25B).

## Disciplines (→ CapexResult categories)
civil_structural→[building,seismic] · electrical→[electrical,ups,generator] · mechanical_cooling→[cooling] · fire→[fireSuppression,fireAlarm] · elv_ict→[network,bms] · security→[security] · testing_cx→[commissioning,testing] · permits→[permits].

## Gates
`test-rz-engine.mjs` BOQ block: DATA.boq + all boq.* sources present; 8 disciplines; every takeoff line sourced+confidence+rateKey-resolves; every unitRate has usd+confidence+source; **reconciliation invariant `Σ lines === categoryTotal` all disciplines**; categoryTotal === Σ mapped costs; hardTotal === Σ 14 costs; summary.grandTotal === capexTotal; embeddedMargin = hard×m/(1+m) (not added); markup ≈ 11.1%; safety factors present; disclaimer = screening/not-a-quotation. Value-trace nodes `boq.grandTotal`+`boq.marginPct` gated by trace-parity.

## Phase 2 (SHIPPED v1.103.0)
`models.boq.equipmentSchedule` (UPS/genset/MV-transformer/PDU/CRAH/CDU, N+redundancy counts, lead times — MV transformer 120 wk long-lead) + `DATA.boq.procurement` 12 EPC packages + `models.boq.procurementPackages` (estValue NON-ADDITIVE — categories span packages). Dossier +2 sections. Cooling duty = IT heat load (not IT×PUE) per v1.103.1 fix.

## Phase 3 — EPC Technical Dossier (SHIPPED v1.104.0)
`DATA.dossier` (STANDARD-PRACTICE, sourced): permittingMatrix, designBasis (IEC/NEC/ASHRAE/ASCE/NFPA/Uptime refs), riskRegister (prob/impact/mitigation/owner), documentRegister, opsReadiness, engineeringCalcs (each → the engine model that computes it). `models.dossier.executiveSummary(input,result)` + `models.dossier.sections()` (10-section ordered manifest). The BOQ becomes one section of a full "Technical Project Dossier" (ToC + Executive Summary + Permitting Matrix + Design Basis + Engineering Calcs + Equipment + BOQ + Procurement + Risk Register + Ops Readiness + Document Register). STANDARD-PRACTICE reference — durations/risks indicative, validate against AHJ + full design; NOT a quotation/tender.

See [AI_ARCH_STANDARD.md](AI_ARCH_STANDARD.md), [COOLING_LADDER_STANDARD.md](COOLING_LADDER_STANDARD.md).
