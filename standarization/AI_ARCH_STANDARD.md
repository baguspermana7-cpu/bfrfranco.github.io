# AI Reference-Architecture Standard (DCMOC CAPEX Ship-A)

> Single source: `rz-engine.js DATA.requirements.archProfiles` + `models.requirements.*`.
> DCMOC consumes via `rzData()/rzModels()`. NEVER hardcode rack-kW or arch facts in a component.

## Profiles (sourced + confidence-tagged)

| Key | Label | Nominal kW | Peak kW | GPU | Cooling | Tier floor | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|
| `h100_pod` | NVIDIA H100 SuperPOD | 30 | 45 | 32 | air | 3 | OFFICIAL | DGX H100 10.2kW/8U, ~4/rack |
| `gb200_nvl72` | NVIDIA GB200 NVL72 | 120 | 192 | 72 | liquid | 3 | OFFICIAL* | 120 nom / 132 TDP official; 192 peak = EDPp ANALYST est ~1.5×TDP (SemiAnalysis/HPE) |
| `gb300_nvl72` | NVIDIA GB300 NVL72 | 140 | 192 | 72 | liquid | 3 | OFFICIAL* | Blackwell Ultra; cooling kit $50k/rack = Morgan Stanley BOM ANALYST |
| `rubin_vr200` | Vera Rubin VR200 NVL72 | 200 | 300 | 144 | liquid | 4 | **ANALYST** | NVIDIA has NOT published rack-kW; only NVLink6/45°C DLC/800VDC official. 144 = dies, 72 packages |
| `ocp_hpr` | OCP ORV3 High-Power Rack | 120 | 140 | — | liquid | 3 | OFFICIAL | 92-140kW; busbar roadmap 750kW→1MW (Mount Diablo) |

\* label confidence reflects the nominal/TDP source (official); the peak/EDPp column and $50k cooling-kit are analyst-derived even on official rows — disclosed inline in each `ref` string.

## Peak-provisioning economics (the double-count trap)

The AI power plant (electrical/UPS/generator) is sized to **peak (EDPp)**, not nominal — GPU workloads overshoot TDP at 50ms granularity (arXiv 2508.14318). BUT the raw `peak/nominal` ratio (GB200 = 1.6×) must NOT be applied to the base $/kW directly:

- Conventional (CPU-era) DC power chains already carry ~1.2× peak/nominal headroom — **NEC 125% continuous-load rule** + Fan/Weber/Barroso Google power-provisioning literature. The T&T/C&W/JLL 2025 base $/kW benchmarks embed this.
- Applying raw 1.6× would **double-count** that ~1.2× → ~20% overstatement of power capex.

**Correct model** — `models.requirements.powerProvisionUplift(key)`:

```
uplift = max(1.0, (provisionedRackKw / rackKwNominal) / baselinePeakRatio)   // baselinePeakRatio = 1.2
```

GB200 → 192/120 / 1.2 = **1.333×** (not 1.6). OCP-HPR 140/120 / 1.2 = 0.97 → floored to **1.0** (never a discount). Applied to `electrical`, `ups`, `generator` cost keys ONLY.

## Scope boundaries

- **GPU/IT hardware cost is EXCLUDED** from CAPEX (facility infra only).
- **Interconnect** (IB $4900/GPU, Ethernet $2600/GPU — SemiAnalysis ÷512, ANALYST) returned as a **separate `CapexResult.interconnect` field, excluded from `total` and `costs`**.
- **GB300 cooling kit** ($50k/rack × racks) IS a real facility line → into `costs.coolingKit` + total.
- `applyArchProfile` sets shared density = **nominal** (nameplate UI), cooling from profile, tier-floor bump only when current tier is lower.

## Honesty rule

ANALYST / EMERGING values MUST render with a distinct chip (amber ANALYST vs emerald OFFICIAL) + explicit "estimasi analis, bukan datasheet vendor" note. Rubin kW is analyst; never display as a datasheet number. Microfluidic cooling is NEVER encoded as an NVIDIA architecture fact (Ship-B, EMERGING/pilot only).

## Gates

`test-rz-engine.mjs` asserts: archProfiles present/keys-stable/peak≥nominal/confidence-valid/sourced · `provisionedRackKw(gb200)=192` · `powerProvisionUplift(gb200)=192/120/1.2` · uplift never < 1.0 · null-arch → 1.0 no-op · interconnectCost IB 72gpu = 352800. Value-trace nodes `req.provisionedRackKw` + `capex.provisionedPowerUplift` gated by trace-parity (117/117).
