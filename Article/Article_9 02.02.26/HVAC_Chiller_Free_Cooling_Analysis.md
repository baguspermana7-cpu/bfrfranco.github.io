# The HVAC Shock No One Priced In: No Chillers Doesn't Mean No Cooling

## A Comprehensive Technical Analysis for Tropical Data Centers

**Author:** Bagus Dwi Permana
**Date:** February 2025
**Category:** Critical Infrastructure | Data Center Operations | Cooling Systems

---

## Executive Summary

Industri data center sedang mengalami transformasi besar dalam pendekatan cooling. Konsep "chiller-free cooling" yang awalnya dianggap hanya cocok untuk iklim dingin, kini mulai merambah ke wilayah tropis termasuk Asia Tenggara. Artikel ini menganalisis secara mendalam: apakah pendekatan ini viable untuk Indonesia dan negara tropis lainnya?

**Key Insight:** "No chillers doesn't mean no cooling" - artinya kita menghilangkan chiller (mechanical refrigeration), bukan menghilangkan cooling system. Pendinginan tetap ada, hanya metodenya yang berbeda.

---

## Daftar Isi

1. [Memahami Konsep Chiller-Free Cooling](#1-memahami-konsep-chiller-free-cooling)
2. [Teknologi Alternatif Pengganti Chiller](#2-teknologi-alternatif-pengganti-chiller)
3. [Analisis Pros & Cons](#3-analisis-pros--cons)
4. [Implementasi di Asia Tropis](#4-implementasi-di-asia-tropis)
5. [Technical Calculations & Metrics](#5-technical-calculations--metrics)
6. [Fault Scenario Analysis](#6-fault-scenario-analysis-in-depth)
7. [Rekomendasi & Kesimpulan](#7-rekomendasi--kesimpulan)

---

## 1. Memahami Konsep Chiller-Free Cooling

### 1.1 Apa Itu Chiller dan Mengapa Ingin Dihilangkan?

**Chiller** adalah mesin pendingin mekanis yang menggunakan siklus refrigerasi (kompresi-kondensasi-ekspansi-evaporasi) untuk menghasilkan chilled water pada suhu rendah (typically 6-12°C).

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL CHILLER SYSTEM                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [Compressor] ──▶ [Condenser] ──▶ [Expansion] ──▶ [Evaporator]│
│        │              │               Valve            │        │
│        │              │                                │        │
│   HIGH ENERGY     HEAT REJECTION                  CHILLED WATER │
│   CONSUMPTION     (Cooling Tower)                  (6-12°C)     │
│                                                                 │
│   Typical Power: 0.5-0.7 kW/ton cooling                        │
│   Water Usage: 3-5 liters/kWh IT load                          │
└─────────────────────────────────────────────────────────────────┘
```

**Mengapa industri ingin menghilangkan chiller?**

| Faktor | Impact |
|--------|--------|
| **Energy Cost** | Chiller = 30-40% total facility energy |
| **Carbon Footprint** | Refrigerant (HFC) = high GWP (Global Warming Potential) |
| **Water Consumption** | Cooling tower = 3-5 L/kWh IT load |
| **Complexity** | Mechanical systems = high maintenance |
| **Reliability** | More moving parts = more failure points |

### 1.2 Paradigm Shift: Dari "Cold Water" ke "Warm Water"

**Nvidia's Game-Changer (2024-2025):**

Nvidia menyatakan bahwa GPU mereka dapat beroperasi dengan inlet water temperature hingga **45°C** (bukan 15-20°C seperti sebelumnya). Ini mengubah segalanya:

```
BEFORE (Cold Water Cooling):
─────────────────────────────
Ambient Air: 35°C
Required Chilled Water: 7°C
Delta-T needed: 28°C
Method: MUST use chiller (mechanical refrigeration)

AFTER (Warm Water Cooling):
─────────────────────────────
Ambient Air: 35°C
Acceptable Water Temp: 45°C
Delta-T available: +10°C headroom!
Method: CAN use dry cooler (no chiller needed)
```

**Impact Statement dari Nvidia:**
> "This enables us to save about 6% of the world's data center power."

---

## 2. Teknologi Alternatif Pengganti Chiller

### 2.1 Dry Cooler (Air-Cooled Heat Exchanger)

```
┌─────────────────────────────────────────────────────────────────┐
│                       DRY COOLER SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌──────────────┐                             │
│   AMBIENT AIR ───▶│  FIN-TUBE    │◀─── HOT WATER FROM DC       │
│   (Free Cooling)  │  HEAT        │                              │
│                   │  EXCHANGER   │───▶ COOLED WATER TO DC       │
│                    └──────────────┘                             │
│                          │                                      │
│                     [FANS ONLY]                                 │
│                                                                 │
│   Power: 5-10% of chiller consumption                          │
│   Water: ZERO (closed loop)                                    │
│   Effective when: Ambient < Water Return Temp                  │
└─────────────────────────────────────────────────────────────────┘
```

**Operating Principle:**
- Heat transfer via convection (ambient air → finned tubes)
- No refrigeration cycle
- Only fan power required
- Effective when T_ambient < T_water_return - Approach_Temperature

### 2.2 Direct-to-Chip Liquid Cooling (D2C)

```
┌─────────────────────────────────────────────────────────────────┐
│                 DIRECT-TO-CHIP LIQUID COOLING                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │ CPU/GPU │◀──▶│ COLD PLATE  │◀──▶│    CDU      │            │
│   │  DIE    │    │ (Microchannels)  │ (Coolant    │            │
│   └─────────┘    └─────────────┘    │ Distribution│            │
│                                     │    Unit)    │            │
│                                     └──────┬──────┘            │
│                                            │                    │
│                                     ┌──────▼──────┐            │
│                                     │ DRY COOLER  │            │
│                                     │ or COOLING  │            │
│                                     │   TOWER     │            │
│                                     └─────────────┘            │
│                                                                 │
│   Cooling Capacity: Up to 1,500W per chip                      │
│   Inlet Temp: 25-45°C (warm water capable)                     │
│   Heat Capture: 70-80% of IT load                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Immersion Cooling

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMMERSION COOLING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SINGLE-PHASE                    TWO-PHASE                     │
│   ─────────────                   ─────────────                 │
│   ┌───────────┐                   ┌───────────┐                │
│   │  Server   │                   │  Server   │                │
│   │ submerged │                   │ submerged │                │
│   │ in oil    │                   │ in fluid  │──▶ Vapor rises │
│   └───────────┘                   └───────────┘    │           │
│        │                               │           │           │
│   Dielectric                      Dielectric   ┌───▼───┐       │
│   Mineral Oil                     Fluid        │Condenser      │
│   (40-60°C)                       (Boils at    └───────┘       │
│        │                           34-50°C)                     │
│   ┌────▼────┐                                                  │
│   │Heat     │                                                  │
│   │Exchanger│                                                  │
│   └─────────┘                                                  │
│                                                                 │
│   Heat Capture: 95-100% of IT load                             │
│   Density: Up to 100 kW per rack                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Adiabatic/Evaporative Cooling (Hybrid)

```
┌─────────────────────────────────────────────────────────────────┐
│              ADIABATIC PRE-COOLING + DRY COOLER                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   HOT AMBIENT AIR ──▶ [ADIABATIC PAD] ──▶ [DRY COOLER]         │
│       (35°C)              │                    │               │
│                      Water spray          Cooled water          │
│                      evaporates           to facility           │
│                           │                                     │
│                      COOLED AIR                                 │
│                       (25-28°C)                                 │
│                                                                 │
│   Principle: Evaporation extracts latent heat                  │
│   Water Use: 1-2 L/kWh (less than cooling tower)               │
│   Effective when: RH < 60%                                     │
│   LIMITATION: Less effective in high humidity!                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Technology Comparison Matrix

| Technology | Energy Savings | Water Use | CAPEX | OPEX | Tropical Suitability |
|------------|---------------|-----------|-------|------|---------------------|
| **Traditional Chiller** | Baseline | High | Medium | High | ✅ Works everywhere |
| **Dry Cooler Only** | 60-90% | Zero | Low | Very Low | ❌ Limited |
| **D2C + Dry Cooler** | 40-60% | Low/Zero | High | Medium | ⚠️ Partial |
| **Immersion Cooling** | 50-70% | Zero | Very High | Low | ✅ Good potential |
| **Adiabatic Hybrid** | 30-50% | Medium | Medium | Medium | ⚠️ Limited by RH |
| **Desiccant + Liquid** | 40-50% | Low | High | Medium | ✅ Designed for tropics |

---

## 3. Analisis Pros & Cons

### 3.1 SHORT-TERM Analysis (0-3 Years)

#### PROS - Jangka Pendek

| Benefit | Impact | Quantification |
|---------|--------|----------------|
| **Immediate OPEX Reduction** | Lower electricity bills | 30-60% cooling energy savings |
| **Carbon Credits** | ESG compliance | Potential carbon credit revenue |
| **Water Conservation** | Reduced water bills | 30-40% water reduction |
| **Simplified Maintenance** | Fewer mechanical components | 20-30% reduction in maintenance calls |
| **No Refrigerant Compliance** | Avoid HFC phase-out regulations | Future-proof against F-gas regulations |

**Quantified Example - 10MW IT Load Facility:**
```
Traditional Chiller Cooling Cost (per year):
─────────────────────────────────────────────
Chiller Power: 10MW × 0.4 (COP factor) = 4MW
Hours/year: 8,760
Electricity rate: $0.10/kWh
Annual cost: 4,000kW × 8,760h × $0.10 = $3,504,000

Chiller-Free (Dry Cooler) Cost:
─────────────────────────────────────────────
Fan Power: 10MW × 0.05 (5% of IT) = 500kW
Annual cost: 500kW × 8,760h × $0.10 = $438,000

ANNUAL SAVINGS: $3,066,000 (87% reduction)
```

#### CONS - Jangka Pendek

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| **High Initial CAPEX** | $500-2000/kW for liquid cooling | Phased deployment, ROI 2-4 years |
| **Technology Immaturity** | Limited vendor ecosystem | Partner with established vendors |
| **Staff Retraining** | New skill requirements | Training programs, certifications |
| **Compatibility Issues** | Not all servers support liquid | Hybrid approach during transition |
| **Supply Chain** | Limited availability of components | Early procurement, strategic inventory |
| **Warranty Concerns** | OEM support for non-standard cooling | Negotiate with vendors upfront |

**Risk Matrix - Short Term:**
```
                    HIGH IMPACT
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    │   Technology       │   CAPEX            │
    │   Immaturity       │   Investment       │
    │                    │                    │
LOW ├────────────────────┼────────────────────┤ HIGH
PROB│                    │                    │ PROB
    │                    │                    │
    │   Warranty         │   Staff            │
    │   Issues           │   Readiness        │
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                    LOW IMPACT
```

### 3.2 LONG-TERM Analysis (3-10 Years)

#### PROS - Jangka Panjang

| Benefit | Impact | Strategic Value |
|---------|--------|-----------------|
| **Future-Proof Architecture** | Ready for AI/HPC densities | 50-100kW/rack capability |
| **Regulatory Compliance** | Ahead of environmental regulations | Avoid forced retrofits |
| **Heat Reuse Potential** | Warm water = usable waste heat | District heating revenue |
| **Market Differentiation** | Green credentials | Premium pricing opportunity |
| **Scalability** | Modular liquid cooling | Faster capacity additions |
| **Lower TCO** | Reduced mechanical complexity | 30-40% lower 10-year TCO |

**Heat Reuse Economics:**
```
Waste Heat Recovery Potential:
────────────────────────────────
10MW IT Load × 0.95 (heat capture efficiency) = 9.5MW thermal

Applications:
- District heating: $20-50/MWh revenue
- Agricultural (greenhouses): $15-30/MWh
- Industrial processes: $30-60/MWh

Annual Revenue Potential: 9,500kW × 8,760h × $0.03 = $2,496,600
```

#### CONS - Jangka Panjang

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| **Stranded Assets** | Existing chiller infrastructure | Gradual phase-out, resale market |
| **Technology Lock-in** | Dependency on specific vendors | Open standards, multi-vendor |
| **Climate Change Impact** | Rising ambient temperatures | Design for 2050 climate scenarios |
| **Fluid Management** | Dielectric fluid lifecycle | Recycling programs, monitoring |
| **Unknown Unknowns** | Emerging failure modes | Robust monitoring, R&D investment |

### 3.3 Comparative Summary

```
┌─────────────────────────────────────────────────────────────────┐
│           CHILLER-FREE COOLING: BENEFIT-RISK ANALYSIS          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SHORT-TERM (0-3 Years)                                       │
│   ──────────────────────                                       │
│   Benefits:  ████████████████░░░░  (75%)                       │
│   Risks:     ████████████░░░░░░░░  (55%)                       │
│   Net Score: POSITIVE but requires careful execution           │
│                                                                 │
│   LONG-TERM (3-10 Years)                                       │
│   ───────────────────────                                      │
│   Benefits:  ██████████████████░░  (90%)                       │
│   Risks:     ██████░░░░░░░░░░░░░░  (30%)                       │
│   Net Score: HIGHLY POSITIVE                                   │
│                                                                 │
│   VERDICT: Strategic investment with strong long-term ROI      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementasi di Asia Tropis

### 4.1 Kondisi Iklim Tropis - The Challenge

**Climate Data - Key Southeast Asian Cities:**

| City | Avg Temp | Max Temp | Avg RH | Design Conditions |
|------|----------|----------|--------|-------------------|
| **Jakarta** | 27°C | 35°C | 75-85% | 34°C DB, 28°C WB |
| **Singapore** | 27°C | 34°C | 80-90% | 33°C DB, 28°C WB |
| **Kuala Lumpur** | 28°C | 36°C | 75-85% | 35°C DB, 28°C WB |
| **Bangkok** | 29°C | 38°C | 70-80% | 36°C DB, 29°C WB |
| **Manila** | 28°C | 36°C | 75-85% | 35°C DB, 28°C WB |

**Key Insight:**
> "A warm and humid climate like Singapore is the **worst-case scenario** for the use of free cooling." - Uptime Institute

**Why Tropical Climate is Challenging:**

```
CHALLENGE 1: High Ambient Temperature
──────────────────────────────────────
Dry Cooler Approach Temperature: 5-8°C
Required Supply Water: 20°C
Minimum Ambient for Dry Cooling: 12-15°C
Jakarta Average: 27°C

RESULT: Dry cooler ALONE cannot work most of the time

CHALLENGE 2: High Humidity
──────────────────────────────────────
Adiabatic Cooling Efficiency vs RH:
- RH 30%: Very effective (ΔT = 10-12°C)
- RH 50%: Moderate (ΔT = 6-8°C)
- RH 70%: Limited (ΔT = 3-4°C)
- RH 85%: Minimal (ΔT = 1-2°C)

Jakarta Average RH: 75-85%

RESULT: Evaporative/adiabatic cooling SEVERELY LIMITED

CHALLENGE 3: Limited Diurnal Swing
──────────────────────────────────────
Temperate Climate: Day 30°C, Night 15°C (ΔT = 15°C)
Tropical Climate: Day 33°C, Night 25°C (ΔT = 8°C)

RESULT: Less opportunity for nighttime free cooling
```

### 4.2 What Needs to Change for Tropical Implementation

#### 4.2.1 Architecture Modifications

```
TEMPERATE CLIMATE DESIGN:
─────────────────────────
[IT Load] ──▶ [Dry Cooler] ──▶ Done!
              (Works 70-90% of year)


TROPICAL CLIMATE DESIGN:
─────────────────────────
                              ┌──────────────┐
                              │   BACKUP     │
                              │   CHILLER    │◀─── For extreme days
                              │  (20-30%)    │
                              └──────┬───────┘
                                     │
[IT Load] ──▶ [D2C/Immersion] ──▶ [Hybrid Heat Rejection]
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼─────┐
              │ Dry Cooler│   │  Adiabatic  │  │ Desiccant │
              │           │   │  Pre-Cool   │  │   Wheel   │
              └───────────┘   └─────────────┘  └───────────┘
                    │                │                │
                    └────────────────┴────────────────┘
                                     │
                              [Intelligent Control]
                              (Switch based on ambient)
```

#### 4.2.2 Key Design Parameters - Tropical Adaptation

| Parameter | Temperate Design | Tropical Adaptation | Delta |
|-----------|-----------------|---------------------|-------|
| **Supply Water Temp** | 15-20°C | 25-35°C | +10-15°C |
| **IT Inlet Temp** | 18-25°C | 27-35°C | +9-10°C |
| **Chiller Backup Capacity** | 0-20% | 30-50% | +30% |
| **Dry Cooler Sizing** | 1.0x | 1.3-1.5x | +30-50% |
| **Water Treatment** | Standard | Enhanced (anti-corrosion) | Higher spec |
| **Dehumidification** | Optional | Required | Additional system |
| **Condensation Control** | Basic | Critical | Enhanced monitoring |

#### 4.2.3 Singapore's STDCT Approach (World's First Tropical DC Testbed)

The **Sustainable Tropical Data Centre Testbed (STDCT)**, launched by NUS and NTU with S$23 million funding, is pioneering solutions specifically for tropical climates:

**Key Technologies Being Tested:**

1. **Desiccant-Coated Heat Exchangers**
   ```
   Principle: Uses HIGH humidity as an advantage
   - Desiccant absorbs moisture from humid air
   - Absorption process releases heat
   - Combined with evaporative cooling
   - More humid = more effective!

   Target: Works BETTER in high RH environments
   ```

2. **StatePoint Liquid Cooling (SPLC)**
   ```
   Hybrid approach combining:
   - Direct liquid cooling to chips
   - Indirect evaporative cooling
   - Membrane-based water vapor transfer

   Benefit: Reduced water consumption vs direct evaporative
   ```

3. **Immersion Cooling with Tropical-Optimized Heat Rejection**
   ```
   Two-stage approach:
   Stage 1: Immersion captures 95%+ of heat
   Stage 2: Fluid temp elevated (50-60°C)
   Stage 3: Higher temp = easier rejection even in hot ambient

   Key insight: Hot fluid + hot ambient = still viable ΔT
   ```

**STDCT Targets:**
- Energy reduction: 40%
- Water reduction: 30-40%
- CO2 reduction: 40%
- Target PUE: <1.2 (vs government requirement 1.3)

### 4.3 Indonesia-Specific Considerations

#### 4.3.1 Climate Zones in Indonesia

```
┌─────────────────────────────────────────────────────────────────┐
│              INDONESIA DATA CENTER CLIMATE ZONES                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ZONE A: Jakarta/Bekasi/Tangerang (Primary DC Hub)             │
│  ─────────────────────────────────────────────────              │
│  Temp: 24-34°C | RH: 70-90% | Monsoon: Nov-Mar                 │
│  Free Cooling Hours: ~500-800 hours/year (6-9%)                │
│  Recommendation: Hybrid with 40% chiller backup                 │
│                                                                 │
│  ZONE B: Surabaya/East Java                                    │
│  ─────────────────────────────────────────────────              │
│  Temp: 23-35°C | RH: 65-85% | Slightly drier                   │
│  Free Cooling Hours: ~800-1,200 hours/year (9-14%)             │
│  Recommendation: Hybrid with 35% chiller backup                 │
│                                                                 │
│  ZONE C: Batam (Growing DC Hub)                                │
│  ─────────────────────────────────────────────────              │
│  Temp: 24-33°C | RH: 75-90% | Coastal humidity                 │
│  Free Cooling Hours: ~400-600 hours/year (5-7%)                │
│  Recommendation: Hybrid with 45% chiller backup                 │
│                                                                 │
│  ZONE D: Highlands (Potential Future Sites)                    │
│  ─────────────────────────────────────────────────              │
│  Temp: 15-28°C | RH: 60-80% | Best conditions                  │
│  Free Cooling Hours: ~3,000-4,000 hours/year (34-46%)          │
│  Recommendation: Primary free cooling viable                    │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Required Infrastructure Changes for Indonesia

| Component | Standard Design | Indonesia Adaptation | Reason |
|-----------|----------------|---------------------|--------|
| **Air Filtration** | MERV 8-11 | MERV 13-16 | Air quality, volcanic ash |
| **Corrosion Protection** | Standard | Enhanced marine-grade | Coastal humidity, salt air |
| **Backup Diesel** | N+1 | 2N minimum | Grid reliability concerns |
| **Chiller Backup** | 20% | 40-50% | Limited free cooling hours |
| **Humidity Control** | Basic | Dedicated dehumidification | High ambient RH |
| **Condensation Sensors** | Optional | Mandatory extensive | Dew point management |
| **Lightning Protection** | Standard | Enhanced (SPD Tier 1) | High isokeraunic level |

#### 4.3.3 Regulatory Landscape - Indonesia

```
Current Regulations:
────────────────────
- No mandatory PUE requirements (yet)
- Green Building Council Indonesia (GBCI) voluntary certification
- PLN increasingly offering green tariffs

Expected Future Regulations (2025-2030):
────────────────────────────────────────
- Mandatory PUE reporting (likely <1.5 initial)
- Carbon tax implications
- Water usage disclosure
- Alignment with Singapore/regional standards

Strategic Implication:
────────────────────────────────────────
Early adoption of efficient cooling = competitive advantage
+ Future regulatory compliance
+ ESG investor attraction
+ Premium customer positioning
```

---

## 5. Technical Calculations & Metrics

### 5.1 PUE Impact Calculation

**Power Usage Effectiveness (PUE) Formula:**
```
PUE = Total Facility Power / IT Equipment Power

Where Total Facility Power includes:
- IT Load
- Cooling (chillers, pumps, fans, CRAHs)
- Power Distribution Losses
- Lighting, Security, etc.
```

**Cooling Contribution to PUE:**

| Cooling System | kW per kW IT | PUE Contribution |
|----------------|-------------|------------------|
| Chiller + CRAH | 0.35-0.50 | +0.35-0.50 |
| Chiller + In-Row | 0.25-0.35 | +0.25-0.35 |
| Dry Cooler + CRAH | 0.08-0.15 | +0.08-0.15 |
| D2C + Dry Cooler | 0.05-0.10 | +0.05-0.10 |
| Immersion + Dry Cooler | 0.03-0.08 | +0.03-0.08 |

**Example Calculation - Jakarta DC:**

```
Scenario: 5MW IT Load Data Center in Jakarta

TRADITIONAL (Chiller-Based):
────────────────────────────
IT Load:                    5,000 kW
Chiller Power:              5,000 × 0.40 = 2,000 kW
CRAH/AHU Power:             5,000 × 0.08 = 400 kW
Pumps:                      5,000 × 0.03 = 150 kW
Cooling Tower:              5,000 × 0.02 = 100 kW
Power Distribution Loss:    7,650 × 0.08 = 612 kW
Other (Lighting, etc.):     100 kW
────────────────────────────
Total:                      8,362 kW
PUE = 8,362 / 5,000 = 1.67


HYBRID LIQUID COOLING (Tropical Optimized):
────────────────────────────
IT Load:                    5,000 kW
D2C/CDU Pumps:              5,000 × 0.02 = 100 kW
Dry Cooler Fans:            5,000 × 0.04 = 200 kW
Backup Chiller (40% @ 50%): 2,000 × 0.50 × 0.40 = 400 kW
Adiabatic System:           5,000 × 0.01 = 50 kW
Dehumidification:           5,000 × 0.02 = 100 kW
Power Distribution Loss:    5,850 × 0.06 = 351 kW
Other:                      100 kW
────────────────────────────
Total:                      6,301 kW
PUE = 6,301 / 5,000 = 1.26

SAVINGS: PUE improvement of 0.41 (25% reduction)
Annual Energy Savings: 2,061 kW × 8,760h = 18.05 GWh
At $0.10/kWh: $1,805,000/year savings
```

### 5.2 Water Usage Effectiveness (WUE)

**WUE Formula:**
```
WUE = Annual Water Usage (Liters) / IT Equipment Energy (kWh)
```

**Comparison:**

| Cooling System | WUE (L/kWh) | For 5MW DC (L/year) |
|----------------|-------------|---------------------|
| Cooling Tower + Chiller | 1.8-2.5 | 79-110 million |
| Adiabatic + Dry Cooler | 0.5-1.2 | 22-53 million |
| Dry Cooler Only | 0.0 | 0 |
| Immersion + Dry Cooler | 0.0-0.1 | 0-4.4 million |
| D2C + Dry Cooler | 0.0-0.2 | 0-8.8 million |

### 5.3 Heat Load Calculations

**Server Heat Density Trends:**

| Server Type | Heat Density | Cooling Requirement |
|-------------|-------------|---------------------|
| Traditional 1U | 5-8 kW/rack | Air cooling OK |
| Dense Compute | 15-25 kW/rack | In-row cooling needed |
| AI/GPU (Current) | 40-70 kW/rack | Liquid cooling required |
| AI/GPU (2025+) | 100-150 kW/rack | Immersion or D2C required |
| HPC Future | 200+ kW/rack | Advanced liquid only |

**Cooling Capacity Sizing Formula:**

```
Required Cooling Capacity (kW) = IT Load (kW) × Safety Factor × Redundancy

Where:
- Safety Factor: 1.1-1.2 (for load variations)
- Redundancy: N+1 = 1.25, 2N = 2.0

Example for 5MW IT Load (N+1):
Cooling Capacity = 5,000 × 1.15 × 1.25 = 7,187 kW cooling
```

### 5.4 Dry Cooler Sizing for Tropics

**Approach Temperature Calculation:**

```
Approach Temperature = Fluid Outlet Temp - Ambient Dry Bulb

For Tropical Design:
- Required Fluid Outlet: 35°C (acceptable for warm-water systems)
- Worst Case Ambient: 35°C
- Approach Temp: 0°C (IMPOSSIBLE with dry cooler alone!)

Solution: Higher fluid temperatures
- If IT allows 45°C inlet water
- Design fluid outlet: 40°C
- Ambient: 35°C
- Approach: 5°C (achievable with oversized dry cooler)

Dry Cooler Oversizing Factor for Tropics: 1.5-2.0x
```

**Dry Cooler Selection Formula:**

```
Required Dry Cooler Capacity = Heat Load / (Approach Temp × Correction Factor)

Correction Factor for Tropics:
- High ambient penalty: 0.7-0.8
- High humidity penalty: 0.85-0.95
- Combined tropical factor: 0.60-0.75

Example:
Heat Load: 5,000 kW
Approach: 5°C
Correction Factor: 0.65

Dry Cooler Size = 5,000 / (5 × 0.65) = 1,538 kW nominal
Actual selection: 1,538 × 1.5 = 2,307 kW (with margin)
```

---

## 6. Fault Scenario Analysis (In-Depth)

### 6.1 Thermal Runaway Timeline

**Critical Understanding: Data centers can overheat FAST**

```
THERMAL RUNAWAY TIMELINE (No Cooling)
─────────────────────────────────────────────────────────────────

Time    │ Server Inlet  │ Status              │ Action Required
────────┼───────────────┼─────────────────────┼─────────────────
T+0     │ 25°C          │ NORMAL              │ -
T+2min  │ 35°C          │ WARNING             │ Alarms triggered
T+4min  │ 45°C          │ APPROACHING LIMIT   │ Emergency response
T+6min  │ 55°C          │ HIGH RISK           │ Load reduction
T+8min  │ 65°C          │ THERMAL THROTTLE    │ Auto-throttling
T+10min │ 75°C          │ CRITICAL            │ Some shutdowns
T+12min │ 85°C          │ THERMAL THROTTLE    │ Mass throttling
T+15min │ 95°C          │ EMERGENCY SHUTDOWN  │ Facility EPO
T+18min │ 105°C+        │ HARDWARE DAMAGE     │ Permanent damage
T+30min │ 150°C+        │ FIRE RISK           │ Fire suppression

KEY INSIGHT: You have approximately 8-15 minutes to restore cooling
before significant IT impact begins.
```

### 6.2 Failure Mode Analysis: Chiller-Free Systems

#### 6.2.1 Dry Cooler Failure Scenarios

```
┌─────────────────────────────────────────────────────────────────┐
│           FAULT SCENARIO 1: DRY COOLER FAN FAILURE             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FAILURE MODE: VFD failure, motor burnout, blade damage         │
│                                                                 │
│ IMPACT ANALYSIS:                                                │
│ ─────────────────                                               │
│ Single fan (of N fans):                                         │
│   - Capacity reduction: 10-20%                                  │
│   - Fluid temp rise: 2-5°C                                      │
│   - Immediate risk: LOW                                         │
│   - Action: Increase other fans, schedule replacement           │
│                                                                 │
│ Multiple fans (50% failure):                                    │
│   - Capacity reduction: 50%                                     │
│   - Fluid temp rise: 10-15°C                                    │
│   - Immediate risk: MEDIUM-HIGH                                 │
│   - Action: Activate backup chiller, reduce IT load             │
│                                                                 │
│ Complete dry cooler failure:                                    │
│   - Capacity: 0%                                                │
│   - Time to critical: 8-12 minutes                              │
│   - Immediate risk: CRITICAL                                    │
│   - Action: IMMEDIATE backup cooling + load shedding            │
│                                                                 │
│ MITIGATION:                                                     │
│ ───────────                                                     │
│ ✓ N+1 fan redundancy within each dry cooler                    │
│ ✓ Multiple dry cooler units (2N preferred)                     │
│ ✓ Chiller backup sized for 100% load                           │
│ ✓ Automatic failover controls                                  │
│ ✓ Real-time monitoring with predictive alerts                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.2 CDU (Coolant Distribution Unit) Failure

```
┌─────────────────────────────────────────────────────────────────┐
│           FAULT SCENARIO 2: CDU PUMP FAILURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FAILURE MODES:                                                  │
│ ─────────────                                                   │
│ A. Primary pump failure                                         │
│ B. Seal failure (leak)                                          │
│ C. VFD/motor failure                                            │
│ D. Control system failure                                       │
│                                                                 │
│ IMPACT BY SEVERITY:                                             │
│ ───────────────────                                             │
│                                                                 │
│ Single CDU (of N+1):                                            │
│ ┌─────────────────────────────────────────────┐                │
│ │ Time    │ Temp Rise │ Status                │                │
│ ├─────────┼───────────┼───────────────────────┤                │
│ │ T+0     │ +0°C      │ Failover initiated    │                │
│ │ T+30s   │ +2°C      │ Backup pump ramping   │                │
│ │ T+60s   │ +3°C      │ Stable on backup      │                │
│ │ T+5min  │ +3°C      │ Operating normally    │                │
│ └─────────────────────────────────────────────┘                │
│ Risk Level: LOW (if proper N+1 redundancy)                     │
│                                                                 │
│ All CDUs (catastrophic):                                        │
│ ┌─────────────────────────────────────────────┐                │
│ │ Time    │ Chip Temp │ Status                │                │
│ │ T+0     │ 70°C      │ NO COOLANT FLOW       │                │
│ │ T+10s   │ 85°C      │ Throttling begins     │                │
│ │ T+30s   │ 100°C     │ Emergency shutdown    │                │
│ │ T+60s   │ N/A       │ IT equipment OFF      │                │
│ └─────────────────────────────────────────────┘                │
│ Risk Level: CRITICAL                                           │
│ Note: Liquid cooling has FASTER thermal runaway than air!      │
│                                                                 │
│ MITIGATION:                                                     │
│ ───────────                                                     │
│ ✓ 2N CDU redundancy (not just N+1)                             │
│ ✓ Leak detection with auto-isolation valves                    │
│ ✓ UPS-backed CDU pumps (critical!)                             │
│ ✓ Automatic load shedding on pump failure                      │
│ ✓ Cross-connected CDU manifolds                                │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.3 Leak Detection and Management

```
┌─────────────────────────────────────────────────────────────────┐
│           FAULT SCENARIO 3: COOLANT LEAK                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ LEAK SEVERITY CLASSIFICATION:                                   │
│ ─────────────────────────────                                   │
│                                                                 │
│ CLASS 1: Minor Seepage (<1 L/hour)                             │
│ ├── Detection: Moisture sensors, visual inspection             │
│ ├── Impact: Minimal, contained                                 │
│ ├── Response Time: 24-72 hours to repair                       │
│ └── Action: Monitor, schedule maintenance                      │
│                                                                 │
│ CLASS 2: Moderate Leak (1-10 L/hour)                           │
│ ├── Detection: Leak detection cables, flow discrepancy         │
│ ├── Impact: Potential equipment damage                         │
│ ├── Response Time: 4-8 hours to repair                         │
│ └── Action: Isolate loop, switch to backup, emergency repair   │
│                                                                 │
│ CLASS 3: Major Leak (>10 L/hour)                               │
│ ├── Detection: Pressure drop, flow sensors, pooling alarms     │
│ ├── Impact: Immediate IT risk, potential electrical hazard     │
│ ├── Response Time: IMMEDIATE                                   │
│ └── Action: Emergency isolation, power down affected zone      │
│                                                                 │
│ CLASS 4: Catastrophic (Pipe rupture)                           │
│ ├── Detection: Pressure loss, multiple alarms                  │
│ ├── Impact: Facility-wide emergency                            │
│ ├── Response Time: SECONDS                                     │
│ └── Action: Auto-isolation, emergency shutdown, EPO if needed  │
│                                                                 │
│ LEAK DETECTION SYSTEM REQUIREMENTS:                            │
│ ────────────────────────────────────                           │
│ ✓ Leak detection cables under all liquid-carrying components   │
│ ✓ Spot detectors at joints, fittings, CDU locations           │
│ ✓ Drip pans with level sensors                                 │
│ ✓ Flow meters on supply and return (detect discrepancy)        │
│ ✓ Pressure sensors (detect sudden drops)                       │
│ ✓ Auto-isolation valves (close within 5 seconds)               │
│ ✓ Dielectric fluid preferred (non-conductive if leak occurs)   │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.4 Ambient Temperature Excursion

```
┌─────────────────────────────────────────────────────────────────┐
│       FAULT SCENARIO 4: EXTREME AMBIENT TEMPERATURE            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SCENARIO: Ambient exceeds design conditions                    │
│ (Jakarta: Design 35°C, Actual 38-40°C during heat wave)        │
│                                                                 │
│ IMPACT ON DRY COOLER PERFORMANCE:                              │
│ ──────────────────────────────────                             │
│                                                                 │
│ Design Condition (35°C ambient):                               │
│   Dry cooler output: 40°C water                                │
│   Capacity: 100%                                               │
│   IT inlet: Within spec                                        │
│                                                                 │
│ Elevated Condition (38°C ambient):                             │
│   Dry cooler output: 43°C water                                │
│   Capacity: 85% (derated)                                      │
│   IT inlet: Approaching limit                                  │
│                                                                 │
│ Extreme Condition (40°C ambient):                              │
│   Dry cooler output: 45°C water                                │
│   Capacity: 70% (severely derated)                             │
│   IT inlet: AT or ABOVE limit                                  │
│                                                                 │
│ RESPONSE MATRIX:                                               │
│ ─────────────────                                              │
│                                                                 │
│ Ambient  │ Action                                              │
│ ─────────┼───────────────────────────────────────────────────  │
│ 35-37°C  │ Increase dry cooler fan speed to 100%              │
│ 37-38°C  │ Activate adiabatic pre-cooling                     │
│ 38-39°C  │ Start backup chiller(s)                            │
│ 39-40°C  │ Full chiller operation + consider load reduction   │
│ >40°C    │ Maximum cooling + IT load shedding if needed       │
│                                                                 │
│ CRITICAL INSIGHT FOR TROPICAL DESIGN:                          │
│ ─────────────────────────────────────                          │
│ Must design for WORST-CASE ambient, not average!               │
│ Jakarta design: Use 38-40°C, not 35°C                          │
│ Include 10-20% margin above historical maximum                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Comparative Fault Analysis: Chiller vs Chiller-Free

```
┌─────────────────────────────────────────────────────────────────┐
│          FAULT RESPONSE COMPARISON                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    TRADITIONAL CHILLER SYSTEM                   │
│                    ──────────────────────────                   │
│ Failure Point     │ Time to Impact │ Complexity │ Spare Parts  │
│ ──────────────────┼────────────────┼────────────┼─────────────  │
│ Compressor        │ 15-30 min      │ HIGH       │ Long lead    │
│ Condenser         │ 20-40 min      │ MEDIUM     │ Medium lead  │
│ Evaporator        │ 10-20 min      │ MEDIUM     │ Medium lead  │
│ Refrigerant leak  │ Variable       │ HIGH       │ Specialty    │
│ Control failure   │ Immediate      │ MEDIUM     │ Available    │
│                                                                 │
│ Pros: Well-understood, many technicians available              │
│ Cons: Complex mechanically, refrigerant handling               │
│                                                                 │
│                    CHILLER-FREE LIQUID COOLING                  │
│                    ───────────────────────────                  │
│ Failure Point     │ Time to Impact │ Complexity │ Spare Parts  │
│ ──────────────────┼────────────────┼────────────┼─────────────  │
│ CDU pump          │ 1-5 min        │ LOW        │ Standard     │
│ Dry cooler fan    │ 5-15 min       │ LOW        │ Standard     │
│ Coolant leak      │ Seconds-min    │ MEDIUM     │ Available    │
│ Cold plate        │ Seconds        │ LOW        │ Available    │
│ Control failure   │ Immediate      │ MEDIUM     │ Available    │
│                                                                 │
│ Pros: Simpler mechanical, faster part replacement              │
│ Cons: Faster thermal runaway, new failure modes                │
│                                                                 │
│ KEY INSIGHT: Liquid cooling fails FASTER but recovers FASTER   │
│ Requires: Better monitoring + faster response + more redundancy│
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Redundancy Requirements for Tropical Chiller-Free

```
┌─────────────────────────────────────────────────────────────────┐
│      RECOMMENDED REDUNDANCY LEVELS FOR TROPICAL DC             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ COMPONENT          │ MINIMUM   │ RECOMMENDED │ CRITICAL        │
│ ───────────────────┼───────────┼─────────────┼────────────────  │
│ CDU (Pumps)        │ N+1       │ 2N          │ 2N+1            │
│ Dry Coolers        │ N+1       │ N+2         │ 2N              │
│ Backup Chillers    │ N         │ N+1         │ 2N              │
│ Piping Headers     │ Single    │ Ring        │ Dual Ring       │
│ Control Systems    │ N+1       │ 2N          │ 2N + Manual     │
│ Power to Cooling   │ N+1       │ 2N          │ 2N              │
│ Leak Detection     │ Zone      │ Point+Zone  │ Comprehensive   │
│                                                                 │
│ TIER CLASSIFICATION FOR TROPICS:                               │
│ ─────────────────────────────────                              │
│                                                                 │
│ Tier II Equivalent:                                            │
│   - N+1 cooling throughout                                     │
│   - Single backup chiller                                      │
│   - Basic leak detection                                       │
│   - Manual failover acceptable                                 │
│   - Expected uptime: 99.7%                                     │
│                                                                 │
│ Tier III Equivalent:                                           │
│   - N+1 minimum, 2N for critical                               │
│   - N+1 backup chillers                                        │
│   - Comprehensive leak detection                               │
│   - Automatic failover required                                │
│   - Concurrent maintainability                                 │
│   - Expected uptime: 99.98%                                    │
│                                                                 │
│ Tier IV Equivalent:                                            │
│   - 2N throughout                                              │
│   - 2N backup chillers                                         │
│   - Redundant distribution paths                               │
│   - Fault tolerant                                             │
│   - No single point of failure                                 │
│   - Expected uptime: 99.995%                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Fault Response Procedures

```
┌─────────────────────────────────────────────────────────────────┐
│              EMERGENCY RESPONSE FLOWCHART                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌───────────────────┐                        │
│                    │ COOLING ALARM     │                        │
│                    │ TRIGGERED         │                        │
│                    └─────────┬─────────┘                        │
│                              │                                  │
│                    ┌─────────▼─────────┐                        │
│                    │ Identify Failure  │                        │
│                    │ Type & Severity   │                        │
│                    └─────────┬─────────┘                        │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│   ┌─────▼─────┐       ┌──────▼──────┐     ┌──────▼──────┐      │
│   │ MINOR     │       │ MODERATE    │     │ CRITICAL    │      │
│   │ (Warning) │       │ (Alert)     │     │ (Emergency) │      │
│   └─────┬─────┘       └──────┬──────┘     └──────┬──────┘      │
│         │                    │                   │              │
│   ┌─────▼─────┐       ┌──────▼──────┐     ┌──────▼──────┐      │
│   │ Monitor   │       │ Activate    │     │ IMMEDIATE   │      │
│   │ & Log     │       │ Backup      │     │ All Backups │      │
│   └─────┬─────┘       └──────┬──────┘     └──────┬──────┘      │
│         │                    │                   │              │
│   ┌─────▼─────┐       ┌──────▼──────┐     ┌──────▼──────┐      │
│   │ Schedule  │       │ Assess Load │     │ Load Shed   │      │
│   │ Repair    │       │ Reduction   │     │ Non-Critical│      │
│   └───────────┘       └──────┬──────┘     └──────┬──────┘      │
│                              │                   │              │
│                       ┌──────▼──────┐     ┌──────▼──────┐      │
│                       │ Repair      │     │ Emergency   │      │
│                       │ (4-8 hrs)   │     │ Repair      │      │
│                       └─────────────┘     └──────┬──────┘      │
│                                                  │              │
│                                           ┌──────▼──────┐      │
│                                           │ If Repair   │      │
│                                           │ Fails: EPO  │      │
│                                           └─────────────┘      │
│                                                                 │
│ RESPONSE TIME REQUIREMENTS:                                    │
│ ──────────────────────────                                     │
│ Detection to Alarm: <30 seconds                                │
│ Alarm to Acknowledgment: <2 minutes                            │
│ Failover Initiation: <1 minute (automatic)                     │
│ Technician On-Site: <15 minutes (24/7)                         │
│ Load Shedding Decision: <5 minutes                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Rekomendasi & Kesimpulan

### 7.1 Implementation Roadmap for Indonesia

```
┌─────────────────────────────────────────────────────────────────┐
│           PHASED IMPLEMENTATION ROADMAP                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PHASE 1: ASSESSMENT & PILOT (6-12 months)                      │
│ ─────────────────────────────────────────                      │
│ □ Climate analysis for specific site                           │
│ □ IT load characterization (current & future)                  │
│ □ Existing infrastructure assessment                           │
│ □ Vendor evaluation and selection                              │
│ □ Pilot installation (1-2 racks)                               │
│ □ Performance baseline establishment                           │
│                                                                 │
│ PHASE 2: HYBRID DEPLOYMENT (12-24 months)                      │
│ ─────────────────────────────────────────                      │
│ □ Deploy hybrid cooling for new IT additions                   │
│ □ Maintain existing chillers as backup                         │
│ □ Install enhanced monitoring systems                          │
│ □ Train operations team                                        │
│ □ Develop tropical-specific SOPs                               │
│ □ Establish vendor support agreements                          │
│                                                                 │
│ PHASE 3: OPTIMIZATION (24-36 months)                           │
│ ─────────────────────────────────────────                      │
│ □ Expand liquid cooling to 50%+ of IT                          │
│ □ Optimize control algorithms for local climate                │
│ □ Reduce chiller dependency to backup-only                     │
│ □ Implement predictive maintenance                             │
│ □ Achieve target PUE (<1.3)                                    │
│                                                                 │
│ PHASE 4: FULL TRANSITION (36-60 months)                        │
│ ─────────────────────────────────────────                      │
│ □ Majority liquid-cooled infrastructure                        │
│ □ Chillers as emergency backup only                            │
│ □ Heat reuse initiatives                                       │
│ □ Target PUE: <1.2                                             │
│ □ Industry leadership position                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Decision Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│     SHOULD YOU GO CHILLER-FREE IN INDONESIA?                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FACTOR                        │ WEIGHT │ SCORE │ WEIGHTED      │
│ ──────────────────────────────┼────────┼───────┼────────────   │
│ Energy cost reduction         │ 25%    │ 8/10  │ 2.00          │
│ Environmental compliance      │ 15%    │ 9/10  │ 1.35          │
│ Future-proofing (AI/HPC)      │ 20%    │ 9/10  │ 1.80          │
│ Technical feasibility         │ 15%    │ 6/10  │ 0.90          │
│ Implementation complexity     │ 10%    │ 5/10  │ 0.50          │
│ Local expertise availability  │ 10%    │ 4/10  │ 0.40          │
│ Risk profile                  │ 5%     │ 5/10  │ 0.25          │
│ ──────────────────────────────┼────────┼───────┼────────────   │
│ TOTAL                         │ 100%   │       │ 7.20/10       │
│                                                                 │
│ VERDICT: PROCEED WITH CAUTION                                  │
│ ─────────────────────────────                                  │
│ Chiller-free cooling is viable for Indonesia, but requires:    │
│ • Hybrid approach (not 100% chiller-free)                      │
│ • Significant backup capacity (40-50%)                         │
│ • Enhanced monitoring and controls                             │
│ • Specialized tropical adaptations                             │
│ • Phased implementation with pilot testing                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Final Recommendations

| Recommendation | Priority | Rationale |
|----------------|----------|-----------|
| **Start with liquid cooling for new AI/HPC workloads** | HIGH | These REQUIRE liquid cooling anyway |
| **Maintain 40-50% chiller backup capacity** | CRITICAL | Tropical climate demands fallback |
| **Invest in comprehensive monitoring** | HIGH | Faster thermal dynamics require faster detection |
| **Partner with STDCT/research institutions** | MEDIUM | Leverage tropical-specific research |
| **Design for 2050 climate conditions** | MEDIUM | Climate change will increase challenges |
| **Train operations team extensively** | HIGH | New technology requires new skills |
| **Implement rigorous leak detection** | CRITICAL | Water + IT = disaster potential |

### 7.4 Conclusion

**"No chillers doesn't mean no cooling"** adalah konsep yang valid dan transformatif untuk industri data center global. Namun, implementasi di iklim tropis seperti Indonesia memerlukan pendekatan yang berbeda dari counterpart di iklim sedang.

**Key Takeaways:**

1. **Hybrid is the Answer**: Pure chiller-free tidak praktis untuk tropis. Target 60-70% chiller-free dengan 30-40% backup.

2. **Liquid Cooling is Inevitable**: Dengan densitas AI/GPU mencapai 100+ kW/rack, liquid cooling bukan pilihan - ini keharusan.

3. **Higher Risk, Higher Reward**: Sistem tanpa chiller memiliki thermal runway lebih cepat, tapi juga recovery lebih cepat. Redundansi dan monitoring adalah kunci.

4. **Singapore Shows the Way**: STDCT research akan memberikan blueprint untuk implementasi tropis. Indonesia harus memantau dan mengadopsi findings.

5. **Plan for Climate Change**: Desain untuk kondisi 2050, bukan kondisi hari ini.

---

## References & Sources

1. [Data Center Dynamics - Chilling Out in 2025](https://www.datacenterdynamics.com/en/analysis/chilling-out-in-2025-a-year-in-data-center-cooling/)
2. [IEEE Spectrum - Cool(ing) Ideas for Tropical Data Centers](https://spectrum.ieee.org/data-centers-designed-for-tropics)
3. [Microsoft Cloud Blog - Zero Water Cooling](https://www.microsoft.com/en-us/microsoft-cloud/blog/2024/12/09/sustainable-by-design-next-generation-datacenters-consume-zero-water-for-cooling/)
4. [NUS - Sustainable Tropical Data Centre Testbed](https://news.nus.edu.sg/worlds-first-tropical-climate-data-centre-testbed/)
5. [Vertiv - N+1 Redundancy for Cooling](https://www.vertiv.com/en-in/about/news-and-insights/articles/educational-articles/how-n1-redundancy-supports-continuous-data-center-cooling/)
6. [Rest of World - Data Center Heat Map](https://restofworld.org/2025/data-center-heat-map/)
7. [Schneider Electric - Adiabatic Cooling](https://blog.se.com/datacenter/architecture/2017/04/26/adiabatic-evaporative-cooling-techniques/)
8. [Boyd Corporation - Air vs Liquid Cooling](https://www.boydcorp.com/blog/energy-consumption-in-data-centers-air-versus-liquid-cooling.html)
9. [Uptime Institute - Data Center Cooling Technologies](https://journal.uptimeinstitute.com/a-look-at-data-center-cooling-technologies/)
10. [Semi Analysis - Datacenter Anatomy Part 2](https://newsletter.semianalysis.com/p/datacenter-anatomy-part-2-cooling-systems)

---

*Article prepared for publication on resistancezero.com*
*© 2025 Bagus Dwi Permana - Engineering Operations Manager*
